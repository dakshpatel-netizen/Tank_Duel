import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAMERA_CONFIG, POWER_BOX_ITEMS, TANK_CLASSES } from '../../shared/config';
import type { WorldSnapshot } from '../../shared/protocol';
import { angleDiff, getTankClass } from '../../shared/sim';
import type { MapDefinition, PlayerInput, SimEvent, TankState } from '../../shared/types';
import type { GameSettings } from '../types/settings';
import { EffectsPool } from './effectsPool';
import { soundEngine } from './sound';
import { animateTankRig, createTankVisualRig, type TankVisualRig } from './tankMesh';

export interface ProjectedTankTag {
  id: string;
  name: string;
  classId: string;
  team: string;
  hp: number;
  maxHp: number;
  shieldHp: number;
  sx: number;
  sy: number;
  onScreen: boolean;
  edgeAngle: number;
  distMeters: number;
  isEnemy: boolean;
  isLocal: boolean;
  afk: boolean;
  emp: boolean;
}

export interface FloatingDamage {
  id: number;
  sx: number;
  sy: number;
  text: string;
  color: string;
  age: number;
}

export interface InboundWarning {
  id: string;
  edgeAngle: number;
  sx: number;
  sy: number;
  dist: number;
}

export interface RendererOverlayFrame {
  fps: number;
  tags: ProjectedTankTag[];
  floatingDamages: FloatingDamage[];
  inboundWarnings: InboundWarning[];
  guidedActive: boolean;
  guidedFuelPct: number;
  spectatingName: string | null;
  lastPredError: number;
  entityCount: number;
}

const _vec3 = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ndc = new THREE.Vector2();

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function makeQuestionTexture(bgHex: string, outlineHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = outlineHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 74px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture(baseHex: string, accentHex: string, mapId: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (mapId === 'desert_outpost') {
    // Crisp sinusoidal desert sand wave bands matching classic arcade tank arenas
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.3;
    for (let row = -1; row < 5; row++) {
      const yBase = row * 64;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= 256; x += 8) {
        const wave = Math.sin((x / 256) * Math.PI * 4) * 11;
        ctx.lineTo(x, yBase + wave);
      }
      for (let x = 256; x >= 0; x -= 8) {
        const wave = Math.sin((x / 256) * Math.PI * 4) * 11;
        ctx.lineTo(x, yBase + 28 + wave);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.22)';
    ctx.lineWidth = 2;
    for (let row = -1; row < 5; row++) {
      const yBase = row * 64;
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const wave = Math.sin((x / 256) * Math.PI * 4) * 11;
        if (x === 0) ctx.moveTo(x, yBase + wave);
        else ctx.lineTo(x, yBase + wave);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Subtle organic sand/pebble speckles
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = i % 2 === 0 ? accentHex : 'rgba(255,255,255,0.08)';
    ctx.globalAlpha = 0.14;
    const rx = (i * 73) % 256;
    const ry = (i * 137) % 256;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (mapId === 'industrial_yard') {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);
  } else if (mapId !== 'desert_outpost') {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  return tex;
}

function makeHazardBarrierTexture(baseHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 128);

  // Dark concrete frame & center yellow/black hazard chevron strip
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 24);
  ctx.fillRect(0, 104, 256, 24);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 24, 256, 80);
  ctx.clip();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 24, 256, 80);
  ctx.fillStyle = '#FACC15';
  for (let x = -128; x < 384; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 104);
    ctx.lineTo(x + 24, 104);
    ctx.lineTo(x + 64, 24);
    ctx.lineTo(x + 40, 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 124);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeCrateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#B47B44';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#9A6232';
  for (let y = 16; y < 128; y += 24) {
    ctx.fillRect(8, y, 112, 3);
  }
  // X-brace + border
  ctx.strokeStyle = '#6B3F1A';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 114, 114);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(114, 114);
  ctx.moveTo(114, 14);
  ctx.lineTo(14, 114);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBarrelTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(0, 0, 128, 128);
  // Steel ribs
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 128, 14);
  ctx.fillRect(0, 114, 128, 14);
  ctx.fillRect(0, 38, 128, 8);
  ctx.fillRect(0, 82, 128, 8);
  // Yellow hazard middle band
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, 50, 128, 28);
  ctx.fillStyle = '#1E293B';
  for (let x = 0; x < 128; x += 24) {
    ctx.fillRect(x, 50, 10, 28);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ArenaRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private effects: EffectsPool;
  private settings: GameSettings;

  private map: MapDefinition;
  private localId: string;
  private frameId = 0;
  private disposed = false;

  // Dynamic visual maps
  private tankRigs = new Map<string, TankVisualRig>();
  private crateMeshes = new Map<string, THREE.Mesh>();
  private barrelMeshes = new Map<string, THREE.Mesh>();
  private boxGroups = new Map<string, { group: THREE.Group; cube: THREE.Mesh; beam: THREE.Mesh; ring: THREE.Mesh; respawnRing: THREE.Mesh }>();
  private projMeshes = new Map<string, THREE.Object3D>();
  private projPrevPos = new Map<string, { x: number; y: number; z: number }>();
  private mineMeshes = new Map<string, { group: THREE.Group; light: THREE.Mesh }>();
  private airstrikeMeshes = new Map<string, { group: THREE.Group; innerRing: THREE.Mesh }>();
  private flagMeshes: { red: THREE.Group; blue: THREE.Group } | null = null;
  private hillMesh: { active: THREE.Mesh; next: THREE.Mesh } | null = null;
  private safeZoneMesh: THREE.Mesh | null = null;
  private speedPadArrows: THREE.Mesh[] = [];

  // Forward turret laser sight + tank-base reload ring + optional subtle mouse reticle
  private aimPinGroup: THREE.Group;
  private aimPinRing: THREE.Mesh;
  private aimReloadRing: THREE.Mesh;
  private aimLine: THREE.Line;
  private aimTargetDiamond: THREE.Mesh;
  private lockOnRing: THREE.Mesh;
  private leadDots: THREE.Mesh[] = [];
  private hitMarkerTimer = 0;
  private projSmokeAccum = 0;

  // Input state
  private keys = new Set<string>();
  private mouseClientX = 0;
  private mouseClientY = 0;
  private hasMouseMoved = false;
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private pendingDashDir: -1 | 0 | 1 = 0;
  private inputSeq = 0;
  private aimWorldX = 0;
  private aimWorldZ = -12;

  // Camera state
  private zoomDist = CAMERA_CONFIG.baseDist;
  private camPos = new THREE.Vector3(0, CAMERA_CONFIG.baseHeight, CAMERA_CONFIG.baseDist);
  private camLook = new THREE.Vector3(0, 0, 0);
  private camInitialized = false;
  private trauma = 0;
  private slowMoTimer = 0;
  private spectateIndex = 0;

  // Latest state
  private latestSnapshot: WorldSnapshot | null = null;
  private snapshotProvider: ((dt: number) => WorldSnapshot | null) | null = null;
  private onInputSample: ((input: PlayerInput) => void) | null = null;
  private onOverlayFrame: ((frame: RendererOverlayFrame) => void) | null = null;

  private floatingDamages: { x: number; z: number; text: string; color: string; age: number; id: number }[] = [];
  private nextDamageId = 1;
  private fpsCounter = 60;
  private fpsFrames = 0;
  private fpsAccum = 0;
  private lowFpsDuration = 0;
  private lastTime = performance.now();
  private inputAccum = 0;
  private overlayAccum = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    map: MapDefinition,
    localId: string,
    settings: GameSettings
  ) {
    this.container = container;
    this.map = map;
    this.localId = localId;
    this.settings = settings;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && settings.graphics.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    const maxDpr = settings.graphics.quality === 'high' ? 2 : 1.5;
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr) * settings.graphics.resolutionScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && settings.graphics.shadows && settings.graphics.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const rect = container.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.graphics.fov, w / h, 0.5, 450);

    // Studio PBR environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.effects = new EffectsPool(this.scene);
    this.effects.setQuality(settings.graphics.quality === 'low', settings.accessibility.reducedMotion);

    this.buildWorld();

    // Sleek turret sightline + tank-base reload ring + minimal cursor dot (no awkward ground pin stick)
    this.aimPinGroup = new THREE.Group();
    const pinRingMat = new THREE.MeshBasicMaterial({ color: settings.aiming.pinColor, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false });
    this.aimPinRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.5, 20), pinRingMat);
    this.aimPinRing.rotation.x = -Math.PI / 2;
    this.aimPinRing.position.y = 0.08;
    const pinDot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: settings.aiming.pinColor, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }));
    pinDot.rotation.x = -Math.PI / 2;
    pinDot.position.y = 0.09;
    this.aimPinGroup.add(this.aimPinRing, pinDot);
    this.scene.add(this.aimPinGroup);

    // Tank-base reload progress halo (stays centered under local tank)
    this.aimReloadRing = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.58, 32),
      new THREE.MeshBasicMaterial({ color: 0x00e5c3, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false })
    );
    this.aimReloadRing.rotation.x = -Math.PI / 2;
    this.aimReloadRing.position.y = 0.06;
    this.scene.add(this.aimReloadRing);

    // Barrel-forward laser sightline + impact reticle
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.75, 16)]);
    this.aimLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x00e5c3, transparent: true, opacity: 0.72 })
    );
    this.scene.add(this.aimLine);

    this.aimTargetDiamond = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.44, 4),
      new THREE.MeshBasicMaterial({ color: 0x00e5c3, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.aimTargetDiamond.rotation.x = -Math.PI / 2;
    this.aimTargetDiamond.position.y = 0.1;
    this.scene.add(this.aimTargetDiamond);

    this.lockOnRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xff4d6d, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.lockOnRing.rotation.x = -Math.PI / 2;
    this.lockOnRing.position.y = 0.15;
    this.lockOnRing.visible = false;
    this.scene.add(this.lockOnRing);

    for (let i = 0; i < 12; i++) {
      const dot = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.36, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc83d, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.y = 0.12;
      dot.visible = false;
      this.scene.add(dot);
      this.leadDots.push(dot);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.mouseClientX = w * 0.5;
    this.mouseClientY = h * 0.38;

    this.startLoop();
  }

  public setCallbacks(opts: {
    snapshotProvider: (dt: number) => WorldSnapshot | null;
    onInputSample: (input: PlayerInput) => void;
    onOverlayFrame: (frame: RendererOverlayFrame) => void;
  }) {
    this.snapshotProvider = opts.snapshotProvider;
    this.onInputSample = opts.onInputSample;
    this.onOverlayFrame = opts.onOverlayFrame;
  }

  public applySettings(settings: GameSettings) {
    this.settings = settings;
    this.camera.fov = settings.graphics.fov;
    this.camera.updateProjectionMatrix();
    this.effects.setQuality(settings.graphics.quality === 'low', settings.accessibility.reducedMotion);
    const maxDpr = settings.graphics.quality === 'high' ? 2 : 1.5;
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr) * settings.graphics.resolutionScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && settings.graphics.shadows && settings.graphics.quality !== 'low';
  }

  public handleSimEvents(events: SimEvent[]) {
    const localTank = this.latestSnapshot?.tanks.find((t) => t.id === this.localId);
    const lx = localTank?.x ?? 0;
    const lz = localTank?.z ?? 0;

    for (const ev of events) {
      if (ev.type === 'fired') {
        const rig = this.tankRigs.get(ev.tankId);
        if (rig) rig.recoilTimer = 0.35;
        this.effects.emitMuzzleFlash(ev.x, ev.z, ev.angle);
        this.effects.emitProjectileSmoke(
          ev.x + Math.sin(ev.angle) * 1.9,
          0.72,
          ev.z + Math.cos(ev.angle) * 1.9,
          ev.kind
        );
        const dist = Math.hypot(ev.x - lx, ev.z - lz);
        soundEngine.playCannon(dist);
        if (ev.tankId === this.localId && this.settings.gameplay.cameraShake) {
          this.trauma = Math.min(1, this.trauma + 0.14);
        }
      } else if (ev.type === 'ricochet') {
        this.effects.emitRicochet(ev.x, ev.z);
        soundEngine.playRicochet(Math.hypot(ev.x - lx, ev.z - lz));
      } else if (ev.type === 'hit') {
        const rig = this.tankRigs.get(ev.targetId);
        if (rig) rig.hitFlashTimer = 0.08;
        this.effects.emitHitSparks(ev.x, ev.z, ev.shielded);
        if (ev.attackerId === this.localId) {
          this.hitMarkerTimer = 0.16;
          soundEngine.playHitMarker(false);
        }
        if (ev.damage > 0) {
          this.floatingDamages.push({
            id: this.nextDamageId++,
            x: ev.x,
            z: ev.z,
            text: `-${ev.damage}${ev.frontArmor ? ' ARMOR' : ''}`,
            color: ev.targetId === this.localId ? '#FF4D6D' : '#FFC83D',
            age: 0,
          });
        }
        if (ev.targetId === this.localId && this.settings.gameplay.cameraShake) {
          this.trauma = Math.min(1, this.trauma + 0.32);
        }
      } else if (ev.type === 'explosion') {
        this.effects.emitExplosion(ev.x, ev.z, ev.radius, ev.kind);
        const dist = Math.hypot(ev.x - lx, ev.z - lz);
        if (ev.kind === 'emp') {
          soundEngine.playEmp();
        } else {
          soundEngine.playExplosion(ev.kind === 'large' || ev.kind === 'barrel' ? 'large' : 'medium', dist);
        }
        if (dist < 35 && this.settings.gameplay.cameraShake && ev.kind !== 'crate') {
          this.trauma = Math.min(1, this.trauma + Math.max(0.1, 0.45 * (1 - dist / 35)));
        }
      } else if (ev.type === 'tank_destroyed') {
        this.effects.emitTankDestruction(ev.x, ev.z);
        const dist = Math.hypot(ev.x - lx, ev.z - lz);
        soundEngine.playExplosion('large', dist);
        if (ev.killerId === this.localId) {
          soundEngine.playHitMarker(true);
        }
        if (ev.victimId === this.localId && !this.settings.accessibility.reducedMotion && this.settings.graphics.quality !== 'low') {
          this.slowMoTimer = 0.3;
        }
        if (dist < 45 && this.settings.gameplay.cameraShake) {
          this.trauma = Math.min(1, this.trauma + 0.65 * (1 - dist / 45));
        }
      } else if (ev.type === 'pickup') {
        const def = POWER_BOX_ITEMS.find((p) => p.id === ev.itemId);
        const col = def?.rarity === 'purple' ? 0xc084fc : def?.rarity === 'gold' ? 0xffc83d : def?.rarity === 'blue' ? 0x38bdf8 : 0x3ddc84;
        this.effects.emitPowerBoxPickup(ev.x, ev.z, col);
        if (ev.tankId === this.localId) {
          soundEngine.playPowerBoxPickup();
        }
      } else if (ev.type === 'flag_event') {
        soundEngine.playFlagHorn(ev.action === 'captured');
      } else if (ev.type === 'dash') {
        const rig = this.tankRigs.get(ev.tankId);
        this.effects.emitDashGhosts(ev.x, ev.z, rig?.root.rotation.y ?? 0, rig?.colorHex ?? '#00E5C3');
      }
    }
  }

  private buildWorld() {
    const m = this.map;
    this.scene.background = new THREE.Color(m.palette.fog);
    this.scene.fog = new THREE.FogExp2(m.palette.fog, m.id === 'forest_maze' ? 0.0085 : 0.0045);

    // Sky dome gradient
    const skyGeo = new THREE.SphereGeometry(260, 20, 14);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(m.palette.skyTop) },
        bottomColor: { value: new THREE.Color(m.palette.skyBottom) },
      },
      vertexShader: `varying vec3 vWorldPos; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorldPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorldPos; void main(){ float h = clamp(normalize(vWorldPos).y * 1.4 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0); }`,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Lighting (warm directional key + cool hemisphere fill)
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(m.palette.sunColor, 1.6);
    const elev = (m.sunElevationDeg * Math.PI) / 180;
    sun.position.set(Math.cos(elev) * 85, Math.sin(elev) * 110, 55);
    sun.castShadow = !this.isSoftwareGl && this.settings.graphics.shadows;
    const shadowSize = this.settings.graphics.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const bound = Math.max(m.width, m.depth) * 0.6;
    sun.shadow.camera.left = -bound;
    sun.shadow.camera.right = bound;
    sun.shadow.camera.top = bound;
    sun.shadow.camera.bottom = -bound;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    // Extended surrounding horizon ground (prevents floating box in empty void)
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({ color: m.palette.groundAccent, roughness: 0.95 })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.06;
    this.scene.add(outerGround);

    // Arena ground with procedural texture
    const gTex = makeGroundTexture(m.palette.ground, m.palette.groundAccent, m.id);
    gTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(m.width, m.depth),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: gTex, roughness: 0.86, metalness: 0.04 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Twin Bases team floor tints
    if (m.id === 'twin_bases') {
      const halfMatR = new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.14, depthWrite: false });
      const halfR = new THREE.Mesh(new THREE.PlaneGeometry(m.width * 0.45, m.depth), halfMatR);
      halfR.rotation.x = -Math.PI / 2;
      halfR.position.set(-m.width * 0.275, 0.015, 0);
      this.scene.add(halfR);

      const halfMatB = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.14, depthWrite: false });
      const halfB = new THREE.Mesh(new THREE.PlaneGeometry(m.width * 0.45, m.depth), halfMatB);
      halfB.rotation.x = -Math.PI / 2;
      halfB.position.set(m.width * 0.275, 0.015, 0);
      this.scene.add(halfB);
    }

    // Crater Hill glowing floor
    if (m.id === 'crater_hill') {
      const lava = new THREE.Mesh(
        new THREE.CircleGeometry(29, 32),
        new THREE.MeshStandardMaterial({
          color: 0x9a3412,
          emissive: 0xea580c,
          emissiveIntensity: 0.42,
          roughness: 0.7,
        })
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = 0.02;
      this.scene.add(lava);
    }

    // Terrain zones (Ice, Mud, Speed Pads)
    for (const z of m.zones) {
      if (z.type === 'ice' && z.r) {
        const ice = new THREE.Mesh(
          new THREE.CircleGeometry(z.r, 36),
          new THREE.MeshStandardMaterial({
            color: 0xbae6fd,
            roughness: 0.12,
            metalness: 0.25,
          })
        );
        ice.rotation.x = -Math.PI / 2;
        ice.position.set(z.x, 0.025, z.z);
        ice.receiveShadow = true;
        this.scene.add(ice);
      } else if (z.type === 'mud' && z.r) {
        const mud = new THREE.Mesh(
          new THREE.CircleGeometry(z.r, 24),
          new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.92 })
        );
        mud.rotation.x = -Math.PI / 2;
        mud.position.set(z.x, 0.025, z.z);
        mud.receiveShadow = true;
        this.scene.add(mud);
      } else if (z.type === 'speed_pad' && z.w && z.d) {
        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(z.w, z.d),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x00e5c3, emissiveIntensity: 0.45, roughness: 0.4 })
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(z.x, 0.03, z.z);
        this.scene.add(pad);

        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.9, 1.8, 3),
          new THREE.MeshBasicMaterial({ color: 0x00ffcc })
        );
        arrow.rotation.x = Math.PI / 2;
        arrow.position.set(z.x, 0.12, z.z);
        if (z.dirX) arrow.rotation.z = z.dirX > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.scene.add(arrow);
        this.speedPadArrows.push(arrow);
      }
    }

    // Tactical arena ground accents (central stone ring & perimeter border apron)
    if (m.id === 'desert_outpost') {
      const centerPad = new THREE.Mesh(
        new THREE.RingGeometry(13.5, 16.5, 36),
        new THREE.MeshStandardMaterial({ color: 0xb67d43, roughness: 0.88 })
      );
      centerPad.rotation.x = -Math.PI / 2;
      centerPad.position.y = 0.015;
      centerPad.receiveShadow = true;
      this.scene.add(centerPad);

      const innerArenaRing = new THREE.Mesh(
        new THREE.RingGeometry(34.5, 35.4, 48),
        new THREE.MeshBasicMaterial({ color: 0x9e6834, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
      );
      innerArenaRing.rotation.x = -Math.PI / 2;
      innerArenaRing.position.y = 0.014;
      this.scene.add(innerArenaRing);
    }

    // Perimeter Walls (4m high, 2m thick) with beveled stone cap trim & bastions
    const perimMat = new THREE.MeshStandardMaterial({ color: m.palette.wallColor, roughness: 0.78 });
    const perimTrimMat = new THREE.MeshStandardMaterial({ color: m.palette.groundAccent, roughness: 0.65 });
    const hw = m.width * 0.5;
    const hd = m.depth * 0.5;
    const perimDefs = [
      [0, -hd, m.width + 2, 2],
      [0, hd, m.width + 2, 2],
      [-hw, 0, 2, m.depth + 2],
      [hw, 0, 2, m.depth + 2],
    ];
    for (const [px, pz, pw, pd] of perimDefs) {
      const pm = new THREE.Mesh(new THREE.BoxGeometry(pw, 4, pd), perimMat);
      pm.position.set(px, 2, pz);
      pm.castShadow = true;
      pm.receiveShadow = true;
      this.scene.add(pm);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.4, 0.35, pd + 0.4), perimTrimMat);
      cap.position.set(px, 4.15, pz);
      this.scene.add(cap);
    }

    // Corner & mid-wall bastions for clearer arena landmark readability
    const bastionCoords: [number, number][] = [
      [-hw, -hd],
      [hw, -hd],
      [-hw, hd],
      [hw, hd],
      [0, -hd],
      [0, hd],
      [-hw, 0],
      [hw, 0],
    ];
    const bastionGeo = new THREE.BoxGeometry(3.4, 5.2, 3.4);
    for (const [bx, bz] of bastionCoords) {
      const bastion = new THREE.Mesh(bastionGeo, perimTrimMat);
      bastion.position.set(bx, 2.6, bz);
      bastion.castShadow = true;
      bastion.receiveShadow = true;
      this.scene.add(bastion);
    }

    // Interior Walls & Containers with hazard-chevron barriers & cap trims
    const containerColors = [0x334155, 0x1e40af, 0xb45309, 0x0f766e];
    const capMat = new THREE.MeshStandardMaterial({ color: m.palette.groundAccent, roughness: 0.7 });
    const hazardTex = makeHazardBarrierTexture(m.palette.wallColor);
    const barrierMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.72,
      metalness: 0.12,
    });
    m.walls.forEach((w, idx) => {
      const isBarrier = w.kind !== 'container' && w.kind !== 'hedge';
      const color =
        w.kind === 'container'
          ? containerColors[idx % containerColors.length]
          : w.kind === 'hedge'
          ? 0x2d5a2e
          : m.palette.wallColor;
      const mat = isBarrier
        ? barrierMat
        : new THREE.MeshStandardMaterial({
            color,
            roughness: w.kind === 'container' ? 0.45 : 0.8,
            metalness: w.kind === 'container' ? 0.35 : 0.05,
          });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
      mesh.position.set(w.x, w.h * 0.5, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      if (w.kind !== 'hedge') {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.25, 0.22, w.d + 0.25), capMat);
        cap.position.set(w.x, w.h + 0.06, w.z);
        this.scene.add(cap);
      }
    });

    // Rocks (InstancedMesh)
    if (m.rocks.length > 0) {
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: m.palette.rockColor, roughness: 0.9, flatShading: true });
      const inst = new THREE.InstancedMesh(rockGeo, rockMat, m.rocks.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const dummy = new THREE.Object3D();
      m.rocks.forEach((r, i) => {
        dummy.position.set(r.x, r.h * 0.38, r.z);
        dummy.scale.set(r.r, r.h * 0.55, r.r);
        dummy.rotation.set(0.1 * i, i * 0.8, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.computeBoundingSphere();
      this.scene.add(inst);
    }

    // Trees (Instanced trunks + Instanced canopies, foliage does not block shots)
    if (m.trees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.2, 7);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, m.trees.length);
      const crownGeo = new THREE.ConeGeometry(2.1, 4.2, 7);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.78, flatShading: true });
      const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, m.trees.length);
      crownInst.castShadow = true;
      const dummy = new THREE.Object3D();
      m.trees.forEach((t, i) => {
        dummy.position.set(t.x, 1.1, t.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, 3.6, t.z);
        const s = 0.88 + (i % 3) * 0.14;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        crownInst.setMatrixAt(i, dummy.matrix);
      });
      trunkInst.computeBoundingSphere();
      crownInst.computeBoundingSphere();
      this.scene.add(trunkInst, crownInst);
    }

    // Landmarks / Decorations outside or around map
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3b7a3e, roughness: 0.82 });
    for (const d of m.decorations) {
      if (d.kind === 'mesa') {
        const mesa = new THREE.Mesh(
          new THREE.CylinderGeometry(10 * d.scale, 18 * d.scale, 16 * d.scale, 7),
          new THREE.MeshStandardMaterial({ color: 0xa15c38, roughness: 0.92, flatShading: true })
        );
        mesa.position.set(d.x, 8 * d.scale, d.z);
        this.scene.add(mesa);
      } else if (d.kind === 'crane') {
        const g = new THREE.Group();
        const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 2), new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 }));
        mast.position.y = 11;
        const jib = new THREE.Mesh(new THREE.BoxGeometry(22, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 }));
        jib.position.set(7, 21, 0);
        g.add(mast, jib);
        g.position.set(d.x, 0, d.z);
        g.rotation.y = d.rot;
        this.scene.add(g);
      } else if (d.kind === 'cactus') {
        // Sculpted 3-part Saguaro cactus outside perimeter
        const cg = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 2.1, 4, 8), cactusMat);
        trunk.position.y = 1.35;
        const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 4, 8), cactusMat);
        armL.position.set(-0.55, 1.65, 0);
        const armLJ = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 8), cactusMat);
        armLJ.rotation.z = Math.PI / 2;
        armLJ.position.set(-0.32, 1.28, 0);
        const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 4, 8), cactusMat);
        armR.position.set(0.52, 1.45, 0);
        const armRJ = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 8), cactusMat);
        armRJ.rotation.z = Math.PI / 2;
        armRJ.position.set(0.3, 1.15, 0);
        cg.add(trunk, armL, armLJ, armR, armRJ);
        cg.position.set(d.x, 0, d.z);
        cg.rotation.y = d.rot;
        cg.scale.setScalar(d.scale);
        this.scene.add(cg);
      }
    }

    // Destructible Crates & Barrels
    const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const crateMat = new THREE.MeshStandardMaterial({ map: makeCrateTexture(), roughness: 0.82 });
    for (const c of m.crates) {
      const mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.position.set(c.x, 0.8, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.crateMeshes.set(c.id, mesh);
    }

    const barrelGeo = new THREE.CylinderGeometry(0.46, 0.46, 1.28, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ map: makeBarrelTexture(), emissive: 0x7f1d1d, emissiveIntensity: 0.25, roughness: 0.42 });
    for (const b of m.barrels) {
      const mesh = new THREE.Mesh(barrelGeo, barrelMat);
      mesh.position.set(b.x, 0.64, b.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.barrelMeshes.set(b.id, mesh);
    }
  }

  private bindEvents() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
      const b = this.settings.controls.bindings;
      if (e.code === b.dashLeft) this.pendingDashDir = -1;
      if (e.code === b.dashRight) this.pendingDashDir = 1;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const onMouseMove = (e: MouseEvent) => {
      this.mouseClientX = e.clientX;
      this.mouseClientY = e.clientY;
      this.hasMouseMoved = true;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== this.renderer.domElement) return;
      soundEngine.unlock();
      this.mouseClientX = e.clientX;
      this.mouseClientY = e.clientY;
      this.hasMouseMoved = true;
      if (e.button === 0) {
        this.mouseDownLeft = true;
        this.spectateIndex++;
      }
      if (e.button === 2) this.mouseDownRight = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.mouseDownLeft = false;
      if (e.button === 2) this.mouseDownRight = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoomDist = Math.max(
        CAMERA_CONFIG.minZoomDist,
        Math.min(CAMERA_CONFIG.maxZoomDist, this.zoomDist + e.deltaY * 0.025)
      );
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onBlur = () => {
      this.keys.clear();
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);
    this.renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    this.renderer.domElement.addEventListener('contextmenu', onContextMenu);

    this.unbindEvents = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onBlur);
      this.renderer.domElement.removeEventListener('wheel', onWheel);
      this.renderer.domElement.removeEventListener('contextmenu', onContextMenu);
    };
  }

  private unbindEvents = () => {};

  private handleResize() {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private sampleInput(snap: WorldSnapshot | null): PlayerInput {
    const b = this.settings.controls.bindings;
    const fwd =
      (this.keys.has(b.forward) || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has(b.reverse) || this.keys.has('ArrowDown') ? 1 : 0);
    const turn =
      (this.keys.has(b.turnRight) || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has(b.turnLeft) || this.keys.has('ArrowLeft') ? 1 : 0);

    const localTank = snap?.tanks.find((t) => t.id === this.localId);
    let finalAimX = this.aimWorldX;
    let finalAimZ = this.aimWorldZ;

    if ((this.settings.aiming.aimMode === 'barrel' || !this.hasMouseMoved) && localTank && localTank.alive) {
      // Tank-Forward aim mode (or before initial mouse move): turret aligns with hull forward (+12deg smart front-cone lock)
      let lockAngle = localTank.hullAngle;
      if (snap && this.settings.aiming.aimAssist === 'light') {
        let bestErr = (12 * Math.PI) / 180;
        let bestDist = 65;
        for (const other of snap.tanks) {
          if (!other.alive || other.id === this.localId) continue;
          if (localTank.team !== 'none' && other.team === localTank.team) continue;
          const d = Math.hypot(other.x - localTank.x, other.z - localTank.z);
          if (d > bestDist) continue;
          const toEnemy = Math.atan2(other.x - localTank.x, other.z - localTank.z);
          const err = Math.abs(angleDiff(localTank.hullAngle, toEnemy));
          if (err < bestErr) {
            bestErr = err;
            bestDist = d;
            lockAngle = toEnemy;
          }
        }
      }
      finalAimX = localTank.x + Math.sin(lockAngle) * 18;
      finalAimZ = localTank.z + Math.cos(lockAngle) * 18;
      this.aimWorldX = finalAimX;
      this.aimWorldZ = finalAimZ;
    } else {
      // Raycast mouse to ground plane
      const rect = this.renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        _ndc.x = ((this.mouseClientX - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -((this.mouseClientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_ndc, this.camera);
        if (_raycaster.ray.intersectPlane(_groundPlane, _vec3)) {
          this.aimWorldX = _vec3.x;
          this.aimWorldZ = _vec3.z;
        }
      }

      finalAimX = this.aimWorldX;
      finalAimZ = this.aimWorldZ;
      if (snap && localTank && localTank.alive && this.settings.aiming.aimAssist === 'light') {
        const aimAngle = Math.atan2(finalAimX - localTank.x, finalAimZ - localTank.z);
        const aimDist = Math.hypot(finalAimX - localTank.x, finalAimZ - localTank.z);
        let bestErr = (4 * Math.PI) / 180;
        for (const other of snap.tanks) {
          if (!other.alive || other.id === this.localId) continue;
          if (localTank.team !== 'none' && other.team === localTank.team) continue;
          const toEnemy = Math.atan2(other.x - localTank.x, other.z - localTank.z);
          const err = Math.abs(angleDiff(aimAngle, toEnemy));
          if (err < bestErr) {
            bestErr = err;
            finalAimX = localTank.x + Math.sin(toEnemy) * aimDist;
            finalAimZ = localTank.z + Math.cos(toEnemy) * aimDist;
          }
        }
      }
    }

    // Spacebar smart fire: fires special weapon if held, else fires main cannon
    const spaceHeld = this.keys.has(b.useWeapon);
    const hasSpecial = Boolean(localTank?.storedWeapon);
    let gpFwd = fwd;
    let gpTurn = turn;
    let gpFire = this.mouseDownLeft || (spaceHeld && !hasSpecial);
    let gpWeapon = this.mouseDownRight || (spaceHeld && hasSpecial);
    let gpTurbo = this.keys.has(b.turbo);
    let gpBrake = this.keys.has(b.handbrake);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads?.[0];
    if (gp) {
      if (Math.abs(gp.axes[1]) > 0.2) gpFwd = -gp.axes[1];
      if (Math.abs(gp.axes[0]) > 0.2) gpTurn = gp.axes[0];
      if (gp.buttons[7]?.pressed) gpFire = true;
      if (gp.buttons[6]?.pressed) gpWeapon = true;
      if (gp.buttons[4]?.pressed) gpTurbo = true;
      if (gp.buttons[1]?.pressed) gpBrake = true;
    }

    this.inputSeq += 1;
    const dashDir = this.pendingDashDir;
    this.pendingDashDir = 0;

    return {
      seq: this.inputSeq,
      clientTime: Date.now(),
      forward: Math.max(-1, Math.min(1, gpFwd)),
      turn: Math.max(-1, Math.min(1, gpTurn)),
      aimX: finalAimX,
      aimZ: finalAimZ,
      fire: gpFire,
      useWeapon: gpWeapon,
      turbo: gpTurbo,
      handbrake: gpBrake,
      dashDir,
    };
  }

  private startLoop() {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      let simDt = rawDt;
      if (this.slowMoTimer > 0) {
        this.slowMoTimer = Math.max(0, this.slowMoTimer - rawDt);
        simDt = rawDt * 0.3;
      }

      const snap = this.snapshotProvider ? this.snapshotProvider(simDt) : this.latestSnapshot;
      if (snap) {
        this.latestSnapshot = snap;
        this.syncScene(snap, simDt, now / 1000);
      }

      this.inputAccum += rawDt;
      if (this.inputAccum >= 1 / 30) {
        this.inputAccum = 0;
        if (this.onInputSample) {
          this.onInputSample(this.sampleInput(snap));
        }
      }

      this.effects.update(simDt);
      this.updateCamera(snap, rawDt);
      this.renderer.render(this.scene, this.camera);

      // FPS & auto-quality fallback (Section 11)
      this.fpsFrames++;
      this.fpsAccum += rawDt;
      if (this.fpsAccum >= 0.5) {
        this.fpsCounter = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsFrames = 0;
        this.fpsAccum = 0;
        if (!this.isSoftwareGl && this.fpsCounter < 40 && this.settings.graphics.quality !== 'low') {
          this.lowFpsDuration += 0.5;
          if (this.lowFpsDuration >= 5.0) {
            this.settings.graphics.quality = 'low';
            this.applySettings(this.settings);
            this.lowFpsDuration = 0;
          }
        } else {
          this.lowFpsDuration = 0;
        }
      }

      // Project 2D HUD overlay state at ~18Hz
      this.overlayAccum += rawDt;
      if (this.overlayAccum >= 0.055 && this.onOverlayFrame && snap) {
        this.overlayAccum = 0;
        this.emitOverlayFrame(snap, rawDt);
      }

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private syncScene(snap: WorldSnapshot, dt: number, elapsed: number) {
    // Speed pad arrow animation
    for (const a of this.speedPadArrows) {
      a.position.y = 0.14 + Math.sin(elapsed * Math.PI * 4) * 0.04;
    }

    // Tanks
    const seenTanks = new Set<string>();
    for (const t of snap.tanks) {
      seenTanks.add(t.id);
      let rig = this.tankRigs.get(t.id);
      if (!rig) {
        rig = createTankVisualRig(t.custom, t.team, this.settings.accessibility.colorblindTeams);
        this.scene.add(rig.root);
        this.tankRigs.set(t.id, rig);
      }
      rig.root.visible = t.alive;
      if (!t.alive) continue;

      rig.root.position.set(t.x, 0, t.z);
      rig.root.rotation.y = t.hullAngle;
      const cls = getTankClass(t, {
        mode: 'ffa',
        mapId: this.map.id,
        mapSize: 'medium',
        timeLimitSec: 480,
        scoreLimit: 15,
        powerBoxesEnabled: true,
        botCount: 0,
        botDifficulty: 'medium',
        friendlyFire: false,
        tankRule: 'classes',
        classicHp: 100,
        shrinkingZone: false,
        password: '',
      });
      animateTankRig(rig, {
        dt,
        elapsed,
        speed: t.speed,
        hullAngle: t.hullAngle,
        turretAngle: t.turretAngle,
        handbrake: false,
        turboActive: t.turboActive,
        dashTimer: t.dashTimer,
        hasShield: t.shieldHp > 0,
        hasEmp: t.empTimer > 0,
        spawnShieldTimer: t.spawnShieldTimer,
        hp: t.hp,
        maxHp: t.maxHp,
        reducedMotion: this.settings.accessibility.reducedMotion,
      });

      // Dust / snow / mud puffs & low HP smoke
      if (t.speed > 1.2) {
        rig.dustAccum += dt;
        if (rig.dustAccum >= 0.09) {
          rig.dustAccum = 0;
          this.effects.emitGroundDust(t.x, t.z, t.groundType);
        }
      }
      if (t.hp < 30) {
        rig.smokeAccum += dt;
        if (rig.smokeAccum >= 0.14) {
          rig.smokeAccum = 0;
          this.effects.emitGroundDust(t.x, t.z, 'mud');
        }
      }

      if (t.id === this.localId) {
        soundEngine.updateEngineHum(t.alive, Math.min(1, t.speed / cls.forwardSpeed));
      }
    }
    for (const [id, rig] of this.tankRigs.entries()) {
      if (!seenTanks.has(id)) {
        this.scene.remove(rig.root);
        this.tankRigs.delete(id);
      }
    }

    // Destructibles visibility
    for (const d of snap.destructibles) {
      const mesh = d.kind === 'crate' ? this.crateMeshes.get(d.id) : this.barrelMeshes.get(d.id);
      if (mesh) mesh.visible = d.alive;
    }

    // Power Boxes
    for (const b of snap.powerBoxes) {
      let entry = this.boxGroups.get(b.id);
      if (!entry) {
        const def = POWER_BOX_ITEMS.find((p) => p.id === b.itemId);
        const rarityHex =
          def?.rarity === 'purple' ? '#C084FC' : def?.rarity === 'gold' ? '#FFC83D' : def?.rarity === 'blue' ? '#38BDF8' : '#3DDC84';
        const g = new THREE.Group();
        g.position.set(b.x, 0, b.z);
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.2, 1.2),
          new THREE.MeshStandardMaterial({
            map: makeQuestionTexture('#1E293B', rarityHex),
            roughness: 0.25,
            emissive: rarityHex,
            emissiveIntensity: 0.35,
          })
        );
        cube.position.y = 1.2;
        cube.castShadow = true;

        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.75, 14, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: rarityHex, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
        );
        beam.position.y = 7;

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.1, 1.4, 24),
          new THREE.MeshBasicMaterial({ color: rarityHex, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;

        const respawnRing = new THREE.Mesh(
          new THREE.RingGeometry(0.7, 0.9, 20),
          new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false })
        );
        respawnRing.rotation.x = -Math.PI / 2;
        respawnRing.position.y = 0.04;

        g.add(cube, beam, ring, respawnRing);
        this.scene.add(g);
        entry = { group: g, cube, beam, ring, respawnRing };
        this.boxGroups.set(b.id, entry);
      }

      entry.cube.visible = b.active;
      entry.beam.visible = b.active;
      entry.ring.visible = b.active;
      entry.respawnRing.visible = !b.active;
      if (b.active) {
        entry.cube.rotation.y += dt * ((45 * Math.PI) / 180);
        entry.cube.position.y = 1.2 + Math.sin(elapsed * 0.8 * Math.PI * 2) * 0.2;
        const rs = 1 + Math.sin(elapsed * 1.5 * Math.PI * 2) * 0.12;
        entry.ring.scale.set(rs, rs, 1);
      } else {
        const prog = Math.max(0.1, 1 - b.respawnTimer / 20);
        entry.respawnRing.scale.set(prog, prog, 1);
      }
    }

    // Projectiles & lush continuous interpolated smoke trails
    const seenProj = new Set<string>();
    let homingTargetId: string | null = null;
    for (const p of snap.projectiles) {
      seenProj.add(p.id);
      if (p.kind === 'homing' && p.targetId) homingTargetId = p.targetId;
      let obj = this.projMeshes.get(p.id);
      if (!obj) {
        obj = this.createProjectileMesh(p.kind);
        this.scene.add(obj);
        this.projMeshes.set(p.id, obj);
      }
      const py = p.y + 0.14;
      obj.position.set(p.x, py, p.z);
      obj.rotation.y = p.angle;
      const flameChild = obj.getObjectByName('thrusterFlame');
      if (flameChild) {
        const pulse = 0.9 + Math.sin(elapsed * 55 + p.x) * 0.25;
        flameChild.scale.set(pulse, pulse, 0.9 + pulse * 0.25);
      }

      if (p.kind !== 'bomblet') {
        const isMissile = p.kind === 'homing' || p.kind === 'cluster' || p.kind === 'guided';
        const tailOffset = isMissile ? 0.72 : 0.52;
        const tailX = p.x - Math.sin(p.angle) * tailOffset;
        const tailZ = p.z - Math.cos(p.angle) * tailOffset;
        let prev = this.projPrevPos.get(p.id);
        if (!prev) {
          const owner = snap.tanks.find((t) => t.id === p.ownerId);
          if (owner) {
            const mx = owner.x + Math.sin(p.angle) * 1.65;
            const mz = owner.z + Math.cos(p.angle) * 1.65;
            if (Math.hypot(tailX - mx, tailZ - mz) < 18) {
              prev = { x: mx, y: py, z: mz };
            }
          }
        }
        if (prev) {
          const dx = tailX - prev.x;
          const dz = tailZ - prev.z;
          const dist = Math.hypot(dx, dz);
          const steps = Math.max(1, Math.min(10, Math.ceil(dist / 0.75)));
          for (let s = 1; s <= steps; s++) {
            const frac = s / steps;
            this.effects.emitProjectileSmoke(
              prev.x + dx * frac,
              py,
              prev.z + dz * frac,
              p.kind
            );
          }
        } else {
          this.effects.emitProjectileSmoke(tailX, py, tailZ, p.kind);
        }
        this.projPrevPos.set(p.id, { x: tailX, y: py, z: tailZ });
      }
    }
    for (const [id, obj] of this.projMeshes.entries()) {
      if (!seenProj.has(id)) {
        this.scene.remove(obj);
        this.projMeshes.delete(id);
        this.projPrevPos.delete(id);
      }
    }

    // Homing red lock-on ring on target
    const lockedTank = homingTargetId ? snap.tanks.find((t) => t.id === homingTargetId && t.alive) : null;
    this.lockOnRing.visible = Boolean(lockedTank);
    if (lockedTank) {
      this.lockOnRing.position.set(lockedTank.x, 0.15, lockedTank.z);
      this.lockOnRing.rotation.z += dt * 4;
    }

    // Mines (hidden from enemies after 2s)
    const localTank = snap.tanks.find((t) => t.id === this.localId);
    const seenMines = new Set<string>();
    for (const m of snap.mines) {
      seenMines.add(m.id);
      const isFriendly = m.ownerId === this.localId || (localTank && localTank.team !== 'none' && localTank.team === m.ownerTeam);
      const hidden = !isFriendly && m.age >= 2.0;
      let entry = this.mineMeshes.get(m.id);
      if (!entry) {
        const g = new THREE.Group();
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.45, 0.14, 12),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
        );
        disc.position.y = 0.07;
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshBasicMaterial({ color: isFriendly ? 0x3ddc84 : 0xff4d6d })
        );
        light.position.y = 0.16;
        g.add(disc, light);
        this.scene.add(g);
        entry = { group: g, light };
        this.mineMeshes.set(m.id, entry);
      }
      entry.group.visible = !hidden;
      entry.group.position.set(m.x, 0, m.z);
      entry.light.visible = Math.floor(elapsed * 4) % 2 === 0;
    }
    for (const [id, entry] of this.mineMeshes.entries()) {
      if (!seenMines.has(id)) {
        this.scene.remove(entry.group);
        this.mineMeshes.delete(id);
      }
    }

    // Airstrike warning circles (6m pulsing red)
    const seenAs = new Set<string>();
    for (const as of snap.airstrikes) {
      seenAs.add(as.id);
      let entry = this.airstrikeMeshes.get(as.id);
      if (!entry) {
        const g = new THREE.Group();
        const outer = new THREE.Mesh(
          new THREE.RingGeometry(5.5, 6.0, 32),
          new THREE.MeshBasicMaterial({ color: 0xff4d6d, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
        );
        outer.rotation.x = -Math.PI / 2;
        outer.position.y = 0.08;
        const innerRing = new THREE.Mesh(
          new THREE.CircleGeometry(6.0, 32),
          new THREE.MeshBasicMaterial({ color: 0xff4d6d, side: THREE.DoubleSide, transparent: true, opacity: 0.22, depthWrite: false })
        );
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = 0.06;
        g.add(outer, innerRing);
        g.position.set(as.x, 0, as.z);
        this.scene.add(g);
        entry = { group: g, innerRing };
        this.airstrikeMeshes.set(as.id, entry);
      }
      const prog = Math.max(0.05, 1 - as.countdown / 1.5);
      entry.innerRing.scale.set(prog, prog, 1);
    }
    for (const [id, entry] of this.airstrikeMeshes.entries()) {
      if (!seenAs.has(id)) {
        this.scene.remove(entry.group);
        this.airstrikeMeshes.delete(id);
      }
    }

    // CTF Flags
    if (snap.flags) {
      if (!this.flagMeshes) {
        const makeFlag = (hex: number) => {
          const g = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
          pole.position.y = 2.1;
          const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.08), new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.35 }));
          cloth.position.set(0.8, 3.6, 0);
          const glow = new THREE.Mesh(
            new THREE.RingGeometry(1.2, 1.5, 24),
            new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false })
          );
          glow.rotation.x = -Math.PI / 2;
          glow.position.y = 0.04;
          g.add(pole, cloth, glow);
          this.scene.add(g);
          return g;
        };
        this.flagMeshes = { red: makeFlag(0xff4d5e), blue: makeFlag(0x3b82f6) };
      }
      this.flagMeshes.red.position.set(snap.flags.red.x, snap.flags.red.carrierId ? 2.2 : 0, snap.flags.red.z);
      this.flagMeshes.blue.position.set(snap.flags.blue.x, snap.flags.blue.carrierId ? 2.2 : 0, snap.flags.blue.z);
      this.flagMeshes.red.children[1].rotation.y = Math.sin(elapsed * 3) * 0.22;
      this.flagMeshes.blue.children[1].rotation.y = Math.sin(elapsed * 3) * 0.22;
    }

    // KOTH Hill Zone
    if (snap.hill) {
      if (!this.hillMesh) {
        const active = new THREE.Mesh(
          new THREE.CylinderGeometry(snap.hill.r, snap.hill.r, 3.2, 32, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
        );
        active.position.y = 1.6;
        const next = new THREE.Mesh(
          new THREE.RingGeometry(snap.hill.r - 0.5, snap.hill.r, 32),
          new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
        );
        next.rotation.x = -Math.PI / 2;
        next.position.y = 0.05;
        this.scene.add(active, next);
        this.hillMesh = { active, next };
      }
      this.hillMesh.active.position.set(snap.hill.x, 1.6, snap.hill.z);
      const hMat = this.hillMesh.active.material as THREE.MeshBasicMaterial;
      if (snap.hill.holderTeam === 'red') hMat.color.setHex(0xff4d5e);
      else if (snap.hill.holderTeam === 'blue') hMat.color.setHex(0x3b82f6);
      else if (snap.hill.holderTeam === 'contested') hMat.color.setHex(Math.floor(elapsed * 6) % 2 === 0 ? 0xff4d6d : 0xffffff);
      else hMat.color.setHex(0xffffff);

      this.hillMesh.next.visible = snap.hill.moveTimer <= 5.0;
      this.hillMesh.next.position.set(snap.hill.nextX, 0.05, snap.hill.nextZ);
    }

    // Safe Zone shrinking translucent cylinder wall
    if (snap.safeZone.enabled) {
      if (!this.safeZoneMesh) {
        const geo = new THREE.CylinderGeometry(1, 1, 14, 48, 1, true);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff4d6d,
          transparent: true,
          opacity: 0.26,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this.safeZoneMesh = new THREE.Mesh(geo, mat);
        this.safeZoneMesh.position.y = 7;
        this.scene.add(this.safeZoneMesh);
      }
      this.safeZoneMesh.position.set(snap.safeZone.x, 7, snap.safeZone.z);
      this.safeZoneMesh.scale.set(snap.safeZone.currentRadius, 1, snap.safeZone.currentRadius);
    }

    // Update 3D Aim Pin & Lead Indicator Dots
    this.updateAimVisuals(snap, localTank ?? null, elapsed, dt);
  }

  private createProjectileMesh(kind: string): THREE.Object3D {
    if (kind === 'homing' || kind === 'cluster' || kind === 'guided') {
      const g = new THREE.Group();
      const bodyHex = kind === 'guided' ? 0x38bdf8 : kind === 'cluster' ? 0xfacc15 : 0xf8fafc;
      const tipHex = kind === 'guided' ? 0x0284c7 : kind === 'cluster' ? 0x1e293b : 0xef4444;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 1.05, 10),
        new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.28, metalness: 0.3 })
      );
      body.rotation.x = Math.PI / 2;
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.48, 10),
        new THREE.MeshStandardMaterial({ color: tipHex, emissive: tipHex, emissiveIntensity: 0.55 })
      );
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 0.74;
      const finMat = new THREE.MeshStandardMaterial({ color: tipHex, roughness: 0.45 });
      const finH = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.3), finMat);
      finH.position.z = -0.38;
      const finV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.3), finMat);
      finV.position.z = -0.38;
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.65, 8),
        new THREE.MeshBasicMaterial({ color: kind === 'guided' ? 0x00e5ff : 0xff9f1c })
      );
      flame.name = 'thrusterFlame';
      flame.rotation.x = -Math.PI / 2;
      flame.position.z = -0.82;
      g.add(body, nose, finH, finV, flame);
      return g;
    }
    if (kind === 'bomblet') {
      return new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
    }
    if (kind === 'bouncing') {
      const g = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xff8c00, emissive: 0xea580c, emissiveIntensity: 0.75 })
      );
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 12), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      g.add(core, ring);
      return g;
    }
    // Primary cannon rocket-shell: high-contrast silver/charcoal casing, vivid red warhead nose, glowing thruster flame & wake puffs
    const g = new THREE.Group();
    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 0.66, 10),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.35 })
    );
    casing.rotation.x = Math.PI / 2;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.215, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.z = -0.14;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.21, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.6 })
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.5;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.65, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa929 })
    );
    flame.name = 'thrusterFlame';
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -0.62;
    const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false });
    const wake1 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), wakeMat);
    wake1.position.z = -0.92;
    const wake2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), wakeMat);
    wake2.position.z = -1.32;
    g.add(casing, band, tip, flame, wake1, wake2);
    return g;
  }

  private updateAimVisuals(snap: WorldSnapshot, local: TankState | null, _elapsed: number, dt: number) {
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);

    // Keep floor clean of all target marks / laser lines / ground rings per user preference
    this.aimPinGroup.visible = false;
    this.aimReloadRing.visible = false;
    this.aimLine.visible = false;
    this.aimTargetDiamond.visible = false;
    for (const dot of this.leadDots) {
      dot.visible = false;
    }

    // Keep fallback aim coordinates centered ahead of tank if untouched
    if (local && local.alive && !snap.projectiles.length) {
      void local;
    }
  }

  private updateCamera(snap: WorldSnapshot | null, dt: number) {
    const local = snap?.tanks.find((t) => t.id === this.localId);

    // 1. Guided missile chase camera (FOV 75)
    if (local?.guidedMissileId && snap) {
      const gm = snap.projectiles.find((p) => p.id === local.guidedMissileId);
      if (gm) {
        const backX = gm.x - Math.sin(gm.angle) * 6;
        const backZ = gm.z - Math.cos(gm.angle) * 6;
        const targetPos = _vec3.set(backX, 4.2, backZ);
        this.camPos.lerp(targetPos, 1 - Math.exp(-12 * dt));
        this.camLook.lerp(new THREE.Vector3(gm.x + Math.sin(gm.angle) * 12, 0.8, gm.z + Math.cos(gm.angle) * 12), 1 - Math.exp(-14 * dt));
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.camLook);
        return;
      }
    }

    // Determine follow target (local tank, or spectate living tank in LTS)
    let followTarget: TankState | undefined = local;
    if ((!followTarget || !followTarget.alive) && snap) {
      const alive = snap.tanks.filter((t) => t.alive);
      if (alive.length > 0) {
        followTarget = alive[this.spectateIndex % alive.length];
      }
    }

    const baseFov = this.settings.graphics.fov + (local?.turboActive ? 4 : 0);
    if (Math.abs(this.camera.fov - baseFov) > 0.1) {
      this.camera.fov += (baseFov - this.camera.fov) * Math.min(1, 8 * dt);
      this.camera.updateProjectionMatrix();
    }

    const tx = followTarget?.x ?? 0;
    const tz = followTarget?.z ?? 0;
    const leadX = local?.alive ? (this.aimWorldX - tx) * CAMERA_CONFIG.aimLeadFactor : 0;
    const leadZ = local?.alive ? (this.aimWorldZ - tz) * CAMERA_CONFIG.aimLeadFactor : 0;
    const clampedLeadX = Math.max(-2.5, Math.min(2.5, leadX));
    const clampedLeadZ = Math.max(-2.5, Math.min(2.5, leadZ));

    const zoomRatio = this.zoomDist / CAMERA_CONFIG.baseDist;
    const desiredCamX = tx + clampedLeadX * 0.45;
    const desiredCamY = CAMERA_CONFIG.baseHeight * zoomRatio;
    // Camera sits on +Z looking North (-Z), matching minimap 1:1 (+X Right, -Z Up)
    const desiredCamZ = tz + this.zoomDist + clampedLeadZ * 0.45;

    if (!this.camInitialized && followTarget) {
      this.camInitialized = true;
      this.camPos.set(desiredCamX, desiredCamY, desiredCamZ);
      this.camLook.set(tx, 0.5, tz);
    } else {
      const camDt = Math.min(0.2, Math.max(dt, 0.016));
      const damp = 1 - Math.exp(-CAMERA_CONFIG.followDamping * camDt);
      this.camPos.x += (desiredCamX - this.camPos.x) * damp;
      this.camPos.y += (desiredCamY - this.camPos.y) * damp;
      this.camPos.z += (desiredCamZ - this.camPos.z) * damp;

      this.camLook.x += (tx + clampedLeadX - this.camLook.x) * damp;
      this.camLook.y = 0.5;
      this.camLook.z += (tz + clampedLeadZ - this.camLook.z) * damp;
    }

    this.camera.position.copy(this.camPos);
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * 0.45;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.trauma = Math.max(0, this.trauma - dt * 2.4);
    }
    this.camera.lookAt(this.camLook);
  }

  private emitOverlayFrame(snap: WorldSnapshot, dt: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    const local = snap.tanks.find((t) => t.id === this.localId);

    const project = (wx: number, wy: number, wz: number) => {
      _vec3.set(wx, wy, wz).project(this.camera);
      const behind = _vec3.z > 1;
      const sx = (_vec3.x * 0.5 + 0.5) * w;
      const sy = (-_vec3.y * 0.5 + 0.5) * h;
      const onScreen = !behind && _vec3.z >= -1 && sx >= 20 && sx <= w - 20 && sy >= 20 && sy <= h - 20;
      let edgeAngle = Math.atan2(sy - h * 0.5, sx - w * 0.5);
      if (behind) edgeAngle += Math.PI;
      return { sx, sy, onScreen, edgeAngle };
    };

    const tags: ProjectedTankTag[] = [];
    for (const t of snap.tanks) {
      if (!t.alive) continue;
      const p = project(t.x, 1.85, t.z);
      const isEnemy = t.id !== this.localId && (t.team === 'none' || !local || local.team !== t.team);
      const distMeters = local ? Math.round(Math.hypot(t.x - local.x, t.z - local.z)) : 0;
      tags.push({
        id: t.id,
        name: t.name,
        classId: t.custom.classId,
        team: t.team,
        hp: t.hp,
        maxHp: t.maxHp,
        shieldHp: t.shieldHp,
        sx: p.sx,
        sy: p.sy,
        onScreen: p.onScreen,
        edgeAngle: p.edgeAngle,
        distMeters,
        isEnemy,
        isLocal: t.id === this.localId,
        afk: t.afk,
        emp: t.empTimer > 0,
      });
    }

    // Inbound missile warnings (Homing or Guided targeting near local tank)
    const inboundWarnings: InboundWarning[] = [];
    if (local && local.alive) {
      for (const p of snap.projectiles) {
        if (p.ownerId === this.localId) continue;
        if (p.kind !== 'homing' && p.kind !== 'guided') continue;
        const dist = Math.hypot(p.x - local.x, p.z - local.z);
        if (p.targetId === this.localId || dist < 40) {
          const pr = project(p.x, p.y, p.z);
          inboundWarnings.push({
            id: p.id,
            edgeAngle: pr.edgeAngle,
            sx: Math.max(48, Math.min(w - 48, pr.sx)),
            sy: Math.max(48, Math.min(h - 48, pr.sy)),
            dist: Math.round(dist),
          });
        }
      }
      if (inboundWarnings.length > 0 && Math.random() < 0.25) {
        soundEngine.playMissileWarning();
      }
    }

    // Floating damage numbers (overlay runs at ~18Hz -> 0.055s step)
    this.floatingDamages = this.floatingDamages
      .map((fd) => ({ ...fd, age: fd.age + Math.max(dt, 0.055) }))
      .filter((fd) => fd.age < 0.85);
    const projectedDamages: FloatingDamage[] = this.floatingDamages.map((fd) => {
      const pr = project(fd.x, 1.8 + fd.age * 1.4, fd.z);
      return { id: fd.id, sx: pr.sx, sy: pr.sy, text: fd.text, color: fd.color, age: fd.age };
    });

    let guidedFuelPct = 0;
    if (local?.guidedMissileId) {
      const gm = snap.projectiles.find((p) => p.id === local.guidedMissileId);
      if (gm) guidedFuelPct = Math.max(0, gm.lifetime / gm.maxLifetime);
    }

    let spectatingName: string | null = null;
    if (local && !local.alive) {
      const alive = snap.tanks.filter((t) => t.alive);
      if (alive.length > 0) spectatingName = alive[this.spectateIndex % alive.length].name;
    }

    this.onOverlayFrame!({
      fps: this.fpsCounter,
      tags,
      floatingDamages: projectedDamages,
      inboundWarnings,
      guidedActive: Boolean(local?.guidedMissileId),
      guidedFuelPct,
      spectatingName,
      lastPredError: 0,
      entityCount: snap.tanks.length + snap.projectiles.length + snap.powerBoxes.length + snap.mines.length,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.resizeObserver.disconnect();
    soundEngine.updateEngineHum(false, 0);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
