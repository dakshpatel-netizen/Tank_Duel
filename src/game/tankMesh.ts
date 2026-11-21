import * as THREE from 'three';
import { TANK_CLASSES, TANK_COLORS } from '../../shared/config';
import type { DecalId, TankCustomization, TeamId, TurretStyleId } from '../../shared/types';

// Cached procedural textures so we never leak GPU textures
const trackTextureCache = new Map<string, THREE.CanvasTexture>();
const decalTextureCache = new Map<string, THREE.CanvasTexture>();
let hexBubbleTexture: THREE.CanvasTexture | null = null;
let contactShadowTexture: THREE.CanvasTexture | null = null;

export function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTexture) return contactShadowTexture;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  contactShadowTexture = new THREE.CanvasTexture(c);
  return contactShadowTexture;
}

function getTrackTexture(): THREE.CanvasTexture {
  const key = 'tread_v1';
  if (trackTextureCache.has(key)) return trackTextureCache.get(key)!.clone();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#222733';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = '#384152';
    ctx.fillRect(4, y + 2, 56, 8);
    ctx.fillStyle = '#141821';
    ctx.fillRect(6, y + 10, 52, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  trackTextureCache.set(key, tex);
  return tex.clone();
}

function getHexBubbleTexture(): THREE.CanvasTexture {
  if (hexBubbleTexture) return hexBubbleTexture;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
  ctx.lineWidth = 2;
  const r = 16;
  const h = r * Math.sqrt(3);
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 6; col++) {
      const cx = col * r * 1.5;
      const cy = row * h + (col % 2 === 0 ? 0 : h * 0.5);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const px = cx + Math.cos(ang) * (r - 1);
        const py = cy + Math.sin(ang) * (r - 1);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  hexBubbleTexture = tex;
  return tex;
}

function getDecalTexture(decal: DecalId, accentHex: string): THREE.CanvasTexture {
  const key = `${decal}_${accentHex}`;
  if (decalTextureCache.has(key)) return decalTextureCache.get(key)!;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;

  if (decal === 'stripes') {
    ctx.fillStyle = accentHex;
    ctx.fillRect(28, 8, 22, 112);
    ctx.fillRect(78, 8, 22, 112);
  } else if (decal === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? 46 : 20;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const px = 64 + Math.cos(a) * rad;
      const py = 64 + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (decal === 'skull') {
    ctx.beginPath();
    ctx.arc(64, 52, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(48, 68, 32, 24);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(53, 52, 7, 0, Math.PI * 2);
    ctx.arc(75, 52, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (decal === 'flame') {
    ctx.fillStyle = '#FFC83D';
    ctx.beginPath();
    ctx.moveTo(64, 14);
    ctx.quadraticCurveTo(106, 56, 86, 108);
    ctx.lineTo(64, 92);
    ctx.lineTo(42, 108);
    ctx.quadraticCurveTo(22, 56, 64, 14);
    ctx.fill();
    ctx.stroke();
  } else if (decal === 'checker') {
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#FFFFFF' : '#0F172A';
        ctx.fillRect(16 + col * 24, 16 + r * 24, 24, 24);
      }
    }
  } else if (decal === 'dots') {
    ctx.fillStyle = '#FFFFFF';
    [
      [40, 40],
      [88, 40],
      [64, 64],
      [40, 88],
      [88, 88],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  decalTextureCache.set(key, tex);
  return tex;
}

export interface TankVisualRig {
  root: THREE.Group;
  hullPivot: THREE.Group;
  turretPivot: THREE.Group;
  barrelPivot: THREE.Group;
  baseBarrelZ: number;
  antenna: THREE.Mesh;
  leftTrackMat: THREE.MeshStandardMaterial;
  rightTrackMat: THREE.MeshStandardMaterial;
  hullMat: THREE.MeshStandardMaterial;
  turretMat: THREE.MeshStandardMaterial;
  shieldMesh: THREE.Mesh;
  empArcGroup: THREE.Group;
  turboFlame: THREE.Mesh;
  spawnBeam: THREE.Mesh;
  // Animation state
  recoilTimer: number;
  hitFlashTimer: number;
  pitch: number;
  pitchVel: number;
  roll: number;
  rollVel: number;
  prevSpeed: number;
  prevAngle: number;
  dustAccum: number;
  treadAccum: number;
  smokeAccum: number;
  lastReloadSeen: number;
  colorHex: string;
}

export function resolveTankColors(custom: TankCustomization, team: TeamId, colorblindTeams = false): { main: string; accent: string } {
  const personal = TANK_COLORS.find((c) => c.id === custom.colorId)?.hex ?? '#00E5C3';
  if (team === 'red') {
    return { main: colorblindTeams ? '#EA580C' : '#FF4D5E', accent: personal };
  }
  if (team === 'blue') {
    return { main: colorblindTeams ? '#0EA5E9' : '#3B82F6', accent: personal };
  }
  return { main: personal, accent: '#F8FAFC' };
}

export function createTankVisualRig(
  custom: TankCustomization,
  team: TeamId,
  colorblindTeams = false
): TankVisualRig {
  const cls = TANK_CLASSES[custom.classId];
  const { main, accent } = resolveTankColors(custom, team, colorblindTeams);

  const root = new THREE.Group();
  const hullPivot = new THREE.Group();
  root.add(hullPivot);

  // Contact shadow disc
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(cls.width * 1.45, cls.length * 1.35),
    shadowMat
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  const hullMat = new THREE.MeshStandardMaterial({
    color: main,
    roughness: 0.48,
    metalness: 0.22,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.3,
    metalness: 0.45,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#1E2536',
    roughness: 0.72,
    metalness: 0.55,
  });
  const turretMat = new THREE.MeshStandardMaterial({
    color: main,
    roughness: 0.36,
    metalness: 0.3,
  });

  const leftTrackTex = getTrackTexture();
  const rightTrackTex = getTrackTexture();
  const leftTrackMat = new THREE.MeshStandardMaterial({
    map: leftTrackTex,
    roughness: 0.85,
    metalness: 0.15,
  });
  const rightTrackMat = new THREE.MeshStandardMaterial({
    map: rightTrackTex,
    roughness: 0.85,
    metalness: 0.15,
  });

  // 1. Two sculpted tracks + road wheels
  const trackW = cls.width * 0.24;
  const trackH = cls.height * 0.52;
  const trackL = cls.length * 0.96;
  const trackGeo = new THREE.BoxGeometry(trackW, trackH, trackL);
  const leftTrack = new THREE.Mesh(trackGeo, leftTrackMat);
  leftTrack.position.set(cls.width * 0.42, trackH * 0.5, 0);
  leftTrack.castShadow = true;
  leftTrack.receiveShadow = true;
  hullPivot.add(leftTrack);

  const rightTrack = new THREE.Mesh(trackGeo, rightTrackMat);
  rightTrack.position.set(-cls.width * 0.42, trackH * 0.5, 0);
  rightTrack.castShadow = true;
  rightTrack.receiveShadow = true;
  hullPivot.add(rightTrack);

  // Side skirts
  const skirtGeo = new THREE.BoxGeometry(trackW * 1.12, trackH * 0.32, trackL * 0.92);
  const leftSkirt = new THREE.Mesh(skirtGeo, trimMat);
  leftSkirt.position.set(cls.width * 0.42, trackH * 0.9, 0);
  hullPivot.add(leftSkirt);
  const rightSkirt = new THREE.Mesh(skirtGeo, trimMat);
  rightSkirt.position.set(-cls.width * 0.42, trackH * 0.9, 0);
  hullPivot.add(rightSkirt);

  // Sculpted 3D Road Wheels & Hub Caps along both tracks
  const wheelCount = custom.classId === 'heavy' ? 4 : 3;
  const wheelGeo = new THREE.CylinderGeometry(trackH * 0.42, trackH * 0.42, trackW * 1.16, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(trackH * 0.18, trackH * 0.18, trackW * 1.24, 8);
  hubGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < wheelCount; i++) {
    const zPos = ((i / (wheelCount - 1)) - 0.5) * trackL * 0.68;
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMetalMat);
      wheel.position.set(side * cls.width * 0.42, trackH * 0.42, zPos);
      hullPivot.add(wheel);
      const hub = new THREE.Mesh(hubGeo, trimMat);
      hub.position.set(side * cls.width * 0.42, trackH * 0.42, zPos);
      hullPivot.add(hub);
    }
  }

  // 2. Main beveled hull body
  const bodyW = cls.width * 0.68;
  const bodyH = cls.height * 0.62;
  const bodyL = cls.length * 0.86;
  const hullBody = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL), hullMat);
  hullBody.position.set(0, trackH * 0.55 + bodyH * 0.5, -cls.length * 0.03);
  hullBody.castShadow = true;
  hullBody.receiveShadow = true;
  hullPivot.add(hullBody);

  // Sloped front glacis wedge
  const glacisGeo = new THREE.BoxGeometry(bodyW * 0.96, bodyH * 0.65, cls.length * 0.28);
  const glacis = new THREE.Mesh(glacisGeo, hullMat);
  glacis.position.set(0, trackH * 0.62, cls.length * 0.35);
  glacis.rotation.x = 0.48;
  glacis.castShadow = true;
  hullPivot.add(glacis);

  // Rear engine deck vents
  const engineDeck = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.78, bodyH * 0.25, cls.length * 0.26),
    darkMetalMat
  );
  engineDeck.position.set(0, trackH * 0.55 + bodyH + 0.04, -cls.length * 0.28);
  hullPivot.add(engineDeck);

  // Emissive headlights (front +Z)
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#FFFBEB',
    emissive: '#FDE68A',
    emissiveIntensity: 1.8,
  });
  const hlGeo = new THREE.BoxGeometry(0.14, 0.1, 0.08);
  const hl1 = new THREE.Mesh(hlGeo, lightMat);
  hl1.position.set(bodyW * 0.34, trackH * 0.82, cls.length * 0.45);
  hullPivot.add(hl1);
  const hl2 = new THREE.Mesh(hlGeo, lightMat);
  hl2.position.set(-bodyW * 0.34, trackH * 0.82, cls.length * 0.45);
  hullPivot.add(hl2);

  // Decal plate on hull top/front
  const decalMat = new THREE.MeshBasicMaterial({
    map: getDecalTexture(custom.decal, accent),
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const decalPlane = new THREE.Mesh(new THREE.PlaneGeometry(bodyW * 0.58, bodyW * 0.58), decalMat);
  decalPlane.rotation.x = -Math.PI / 2;
  decalPlane.position.set(0, trackH * 0.55 + bodyH + 0.02, cls.length * 0.14);
  hullPivot.add(decalPlane);

  // Turbo exhaust flame at rear (-Z)
  const turboFlameMat = new THREE.MeshBasicMaterial({
    color: '#00E5FF',
    transparent: true,
    opacity: 0.85,
  });
  const turboFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 8), turboFlameMat);
  turboFlame.rotation.x = -Math.PI / 2;
  turboFlame.position.set(0, trackH * 0.78, -cls.length * 0.58);
  turboFlame.visible = false;
  hullPivot.add(turboFlame);

  // 3. Turret Pivot
  const turretPivot = new THREE.Group();
  turretPivot.position.set(0, trackH * 0.55 + bodyH, 0.04);
  hullPivot.add(turretPivot);

  const tr = cls.turretRadius;
  const turretStyle: TurretStyleId = custom.turretStyle;
  if (turretStyle === 'dome') {
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.82, tr * 1.05, tr * 0.72, 12), turretMat);
    dome.position.y = tr * 0.36;
    dome.castShadow = true;
    turretPivot.add(dome);
  } else if (turretStyle === 'angular') {
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.7, tr * 1.12, tr * 0.68, 6), turretMat);
    wedge.position.y = tr * 0.34;
    wedge.castShadow = true;
    turretPivot.add(wedge);
  } else {
    const brawler = new THREE.Mesh(new THREE.BoxGeometry(tr * 1.85, tr * 0.72, tr * 2.1), turretMat);
    brawler.position.y = tr * 0.36;
    brawler.castShadow = true;
    turretPivot.add(brawler);
  }

  // Hatch cupola
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.32, tr * 0.36, 0.14, 10), trimMat);
  hatch.position.set(-tr * 0.25, tr * 0.74, -tr * 0.18);
  turretPivot.add(hatch);

  // Swaying antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.85, 6), darkMetalMat);
  antenna.geometry.translate(0, 0.425, 0);
  antenna.position.set(tr * 0.48, tr * 0.65, -tr * 0.48);
  turretPivot.add(antenna);

  // 4. Barrel Pivot (for fire recoil)
  const baseBarrelZ = tr * 0.72;
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, tr * 0.36, baseBarrelZ);
  turretPivot.add(barrelPivot);

  // Armored Gun Mantlet collar
  const mantlet = new THREE.Mesh(
    new THREE.BoxGeometry(tr * 0.86, tr * 0.44, 0.24),
    trimMat
  );
  mantlet.position.set(0, 0, 0.04);
  barrelPivot.add(mantlet);

  if (custom.classId === 'heavy') {
    // Double barrel look for Heavy (still fires 1 shell per Section 28)
    const bGeo = new THREE.CylinderGeometry(0.095, 0.115, cls.barrelLength, 10);
    bGeo.rotateX(Math.PI / 2);
    const bL = new THREE.Mesh(bGeo, darkMetalMat);
    bL.position.set(0.14, 0, cls.barrelLength * 0.45);
    bL.castShadow = true;
    barrelPivot.add(bL);
    const bR = new THREE.Mesh(bGeo, darkMetalMat);
    bR.position.set(-0.14, 0, cls.barrelLength * 0.45);
    bR.castShadow = true;
    barrelPivot.add(bR);

    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.26), trimMat);
    brake.position.set(0, 0, cls.barrelLength * 0.9);
    barrelPivot.add(brake);
  } else {
    const bGeo = new THREE.CylinderGeometry(0.095, 0.125, cls.barrelLength, 10);
    bGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(bGeo, darkMetalMat);
    barrel.position.set(0, 0, cls.barrelLength * 0.45);
    barrel.castShadow = true;
    barrelPivot.add(barrel);

    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 8), trimMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0, cls.barrelLength * 0.92);
    barrelPivot.add(muzzleBrake);
  }

  // Shield bubble (hex fresnel-style)
  const shieldMat = new THREE.MeshBasicMaterial({
    color: '#00E5FF',
    map: getHexBubbleTexture(),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(cls.width, cls.length) * 0.72, 18, 14),
    shieldMat
  );
  shieldMesh.position.y = cls.height * 0.65;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  // EMP electric arc ring
  const empArcGroup = new THREE.Group();
  const arcMat = new THREE.MeshBasicMaterial({ color: '#38BDF8', wireframe: true, transparent: true, opacity: 0.85 });
  const arcRing = new THREE.Mesh(new THREE.TorusGeometry(cls.width * 0.75, 0.05, 6, 16), arcMat);
  arcRing.rotation.x = Math.PI / 2;
  arcRing.position.y = cls.height * 0.7;
  empArcGroup.add(arcRing);
  empArcGroup.visible = false;
  root.add(empArcGroup);

  // Spawn light beam
  const spawnBeamMat = new THREE.MeshBasicMaterial({
    color: '#00E5C3',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const spawnBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 14, 16, 1, true), spawnBeamMat);
  spawnBeam.position.y = 7;
  spawnBeam.visible = false;
  root.add(spawnBeam);

  return {
    root,
    hullPivot,
    turretPivot,
    barrelPivot,
    baseBarrelZ,
    antenna,
    leftTrackMat,
    rightTrackMat,
    hullMat,
    turretMat,
    shieldMesh,
    empArcGroup,
    turboFlame,
    spawnBeam,
    recoilTimer: 0,
    hitFlashTimer: 0,
    pitch: 0,
    pitchVel: 0,
    roll: 0,
    rollVel: 0,
    prevSpeed: 0,
    prevAngle: 0,
    dustAccum: 0,
    treadAccum: 0,
    smokeAccum: 0,
    lastReloadSeen: 0,
    colorHex: main,
  };
}

export function animateTankRig(
  rig: TankVisualRig,
  params: {
    dt: number;
    elapsed: number;
    speed: number;
    hullAngle: number;
    turretAngle: number;
    handbrake: boolean;
    turboActive: boolean;
    dashTimer: number;
    hasShield: boolean;
    hasEmp: boolean;
    spawnShieldTimer: number;
    hp: number;
    maxHp: number;
    reducedMotion: boolean;
  }
) {
  const { dt, elapsed, speed, hullAngle, turretAngle, handbrake, turboActive, dashTimer, hasShield, hasEmp, spawnShieldTimer, reducedMotion } = params;

  // Turret relative rotation
  rig.turretPivot.rotation.y = turretAngle - hullAngle;

  // Idle vibration & antenna sway
  if (!reducedMotion) {
    const jitter = speed < 0.3 ? Math.sin(elapsed * 14 * Math.PI * 2) * 0.015 : 0;
    rig.hullPivot.position.y = jitter;
    rig.antenna.rotation.z = Math.sin(elapsed * 1.2 * Math.PI * 2) * 0.1;
    rig.antenna.rotation.x = Math.cos(elapsed * 0.9 * Math.PI * 2) * 0.06;
  } else {
    rig.hullPivot.position.y = 0;
  }

  // Track UV scroll (reverse when reversing, counter-rotate on handbrake)
  const scrollRate = speed * 0.55 * dt;
  if (handbrake && speed > 0.2) {
    rig.leftTrackMat.map!.offset.y -= scrollRate;
    rig.rightTrackMat.map!.offset.y += scrollRate;
  } else {
    rig.leftTrackMat.map!.offset.y -= scrollRate;
    rig.rightTrackMat.map!.offset.y -= scrollRate;
  }

  // Spring-damped hull pitch & roll (max 3 deg pitch, 4 deg roll)
  const accel = (speed - rig.prevSpeed) / Math.max(0.008, dt);
  rig.prevSpeed = speed;
  let dAng = hullAngle - rig.prevAngle;
  while (dAng > Math.PI) dAng -= Math.PI * 2;
  while (dAng < -Math.PI) dAng += Math.PI * 2;
  rig.prevAngle = hullAngle;
  const angVel = dAng / Math.max(0.008, dt);

  const targetPitch = Math.max(-0.052, Math.min(0.052, -accel * 0.004));
  const targetRoll = Math.max(-0.07, Math.min(0.07, angVel * 0.032));

  const stiffness = 12;
  const damping = 0.8;
  rig.pitch += (targetPitch - rig.pitch) * Math.min(1, stiffness * dt);
  rig.roll += (targetRoll - rig.roll) * Math.min(1, damping * 12 * dt);
  rig.hullPivot.rotation.x = rig.pitch;
  rig.hullPivot.rotation.z = rig.roll;

  // Barrel recoil (0.28m back in 0.08s, smooth return in 0.27s)
  if (rig.recoilTimer > 0) {
    rig.recoilTimer = Math.max(0, rig.recoilTimer - dt);
    const total = 0.35;
    const t = total - rig.recoilTimer;
    let offset = 0;
    if (t < 0.08) {
      offset = -0.28 * (t / 0.08);
    } else {
      offset = -0.28 * (1 - (t - 0.08) / 0.27);
    }
    rig.barrelPivot.position.z = rig.baseBarrelZ + offset;
    rig.hullPivot.position.z = offset * 0.35;
  } else {
    rig.barrelPivot.position.z = rig.baseBarrelZ;
    rig.hullPivot.position.z = 0;
  }

  // White hit flash (80 ms)
  if (rig.hitFlashTimer > 0) {
    rig.hitFlashTimer = Math.max(0, rig.hitFlashTimer - dt);
    rig.hullMat.emissive.setHex(0xffffff);
    rig.hullMat.emissiveIntensity = 1.6;
    rig.turretMat.emissive.setHex(0xffffff);
    rig.turretMat.emissiveIntensity = 1.6;
  } else {
    rig.hullMat.emissive.setHex(0x000000);
    rig.hullMat.emissiveIntensity = 0;
    rig.turretMat.emissive.setHex(0x000000);
    rig.turretMat.emissiveIntensity = 0;
  }

  // Shield bubble pulse (1.5 Hz) or subtle spawn protection aura
  const showShieldVisual = hasShield || spawnShieldTimer > 0;
  rig.shieldMesh.visible = showShieldVisual;
  if (showShieldVisual) {
    const pulseRate = hasShield ? 1.5 : 3.5;
    const s = (hasShield ? 1.0 : 0.94) + Math.sin(elapsed * pulseRate * Math.PI * 2) * 0.04;
    rig.shieldMesh.scale.set(s, s, s);
    rig.shieldMesh.rotation.y += dt * (hasShield ? 0.8 : 1.8);
    (rig.shieldMesh.material as THREE.MeshBasicMaterial).opacity = hasShield
      ? 0.42
      : 0.16 + Math.sin(elapsed * 10) * 0.08;
  }

  // EMP electric arcs
  rig.empArcGroup.visible = hasEmp;
  if (hasEmp) {
    rig.empArcGroup.rotation.y += dt * 7;
    rig.empArcGroup.rotation.z = Math.sin(elapsed * 18) * 0.25;
  }

  // Turbo rear blue flame
  rig.turboFlame.visible = turboActive;
  if (turboActive) {
    const fScale = 0.85 + Math.sin(elapsed * 45) * 0.25;
    rig.turboFlame.scale.set(1, fScale, 1);
  }

  // Scout dash stretch
  if (dashTimer > 0) {
    rig.hullPivot.scale.set(1.12, 0.92, 1.0);
  } else {
    rig.hullPivot.scale.set(1, 1, 1);
  }

  // Brief spawn beam (always keep tank solid and visible!)
  if (spawnShieldTimer > 1.55) {
    rig.spawnBeam.visible = true;
    const norm = (spawnShieldTimer - 1.55) / 0.45;
    const sc = 0.72 + (1 - norm) * 0.28;
    rig.root.scale.set(sc, sc, sc);
  } else {
    rig.spawnBeam.visible = false;
    rig.root.scale.set(1, 1, 1);
  }
  rig.hullPivot.visible = true;
}
