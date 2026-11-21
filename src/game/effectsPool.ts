import * as THREE from 'three';

interface ParticleItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  endSize: number;
  gravity: number;
  bounce: boolean;
  color: THREE.Color;
  rotX: number;
  rotY: number;
  rotSpeed: number;
}

interface RingItem {
  active: boolean;
  mesh: THREE.Mesh;
  age: number;
  life: number;
  maxRadius: number;
}

interface DecalItem {
  active: boolean;
  mesh: THREE.Mesh;
  age: number;
  life: number;
}

interface FlyingTurretItem {
  active: boolean;
  group: THREE.Group;
  hullWreck: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  age: number;
  landed: boolean;
  secondaryCount: number;
}

interface MuzzleLightItem {
  light: THREE.PointLight;
  age: number;
  life: number;
}

const MAX_PARTICLES = 360;
const MAX_RINGS = 20;
const MAX_DECALS = 48;
const MAX_WRECKS = 6;
const MAX_MUZZLE_LIGHTS = 4;

// Reusable scratch math objects (Zero GC in render loop)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class EffectsPool {
  private scene: THREE.Scene;
  private particles: ParticleItem[] = [];
  private particleMesh: THREE.InstancedMesh;
  private rings: RingItem[] = [];
  private decals: DecalItem[] = [];
  private wrecks: FlyingTurretItem[] = [];
  private muzzleLights: MuzzleLightItem[] = [];
  private reducedMotion = false;
  private lowQuality = false;
  private nextParticleCursor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Instanced particle pool (crisp bright arcade smoke & explosion puffs)
    const pGeo = new THREE.DodecahedronGeometry(0.58, 1);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 1,
        size: 0.3,
        endSize: 0.1,
        gravity: 0,
        bounce: false,
        color: new THREE.Color(0xffffff),
        rotX: 0,
        rotY: 0,
        rotSpeed: 0,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.scene.add(this.particleMesh);

    // 2. Shockwave rings pool
    const ringGeo = new THREE.RingGeometry(0.75, 1.0, 28);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffa94d,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.rings.push({ active: false, mesh, age: 0, life: 0.4, maxRadius: 4 });
    }

    // 3. Blast & tread decals pool
    const decalGeo = new THREE.CircleGeometry(1, 16);
    decalGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_DECALS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(decalGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.decals.push({ active: false, mesh, age: 0, life: 15 });
    }

    // 4. Pooled Cinematic Tank Wrecks & Flying Turrets (Section 12)
    for (let i = 0; i < MAX_WRECKS; i++) {
      const group = new THREE.Group();
      const turretDome = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.85 })
      );
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 })
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 0.7);
      group.add(turretDome, barrel);
      group.visible = false;
      this.scene.add(group);

      const hullWreck = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.65, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 })
      );
      hullWreck.visible = false;
      this.scene.add(hullWreck);

      this.wrecks.push({
        active: false,
        group,
        hullWreck,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        age: 0,
        landed: false,
        secondaryCount: 0,
      });
    }

    // 5. Max 4 dynamic muzzle/explosion lights
    for (let i = 0; i < MAX_MUZZLE_LIGHTS; i++) {
      const light = new THREE.PointLight(0xffaa44, 0, 14);
      this.scene.add(light);
      this.muzzleLights.push({ light, age: 0, life: 0.08 });
    }
  }

  public setQuality(low: boolean, reducedMotion: boolean) {
    this.lowQuality = low;
    this.reducedMotion = reducedMotion;
  }

  private spawnParticle(cfg: Partial<ParticleItem> & { x: number; y: number; z: number; colorHex: number }) {
    const p = this.particles[this.nextParticleCursor];
    this.nextParticleCursor = (this.nextParticleCursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = cfg.x;
    p.y = cfg.y;
    p.z = cfg.z;
    p.vx = cfg.vx ?? 0;
    p.vy = cfg.vy ?? 0;
    p.vz = cfg.vz ?? 0;
    p.age = 0;
    p.life = cfg.life ?? 0.5;
    p.size = cfg.size ?? 0.35;
    p.endSize = cfg.endSize ?? 0.05;
    p.gravity = cfg.gravity ?? 0;
    p.bounce = cfg.bounce ?? false;
    p.color.setHex(cfg.colorHex);
    p.rotX = Math.random() * Math.PI;
    p.rotY = Math.random() * Math.PI;
    p.rotSpeed = cfg.rotSpeed ?? (Math.random() - 0.5) * 6;
  }

  private spawnRing(x: number, z: number, maxRadius: number, life: number, colorHex: number) {
    const slot = this.rings.find((r) => !r.active) ?? this.rings[0];
    slot.active = true;
    slot.age = 0;
    slot.life = life;
    slot.maxRadius = maxRadius;
    slot.mesh.position.set(x, 0.06, z);
    slot.mesh.scale.set(0.3, 1, 0.3);
    (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (slot.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
    slot.mesh.visible = true;
  }

  public spawnDecal(x: number, z: number, radius: number, life: number, colorHex = 0x18181b) {
    const slot = this.decals.find((d) => !d.active) ?? this.decals[0];
    slot.active = true;
    slot.age = 0;
    slot.life = life;
    slot.mesh.position.set(x, 0.03, z);
    slot.mesh.scale.set(radius, 1, radius);
    (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (slot.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55;
    slot.mesh.visible = true;
  }

  private flashLight(x: number, y: number, z: number, colorHex: number, intensity = 5, life = 0.08) {
    if (this.lowQuality) return;
    const slot = this.muzzleLights.find((l) => l.age >= l.life) ?? this.muzzleLights[0];
    slot.light.position.set(x, y, z);
    slot.light.color.setHex(colorHex);
    slot.light.intensity = intensity;
    slot.age = 0;
    slot.life = life;
  }

  public emitMuzzleFlash(x: number, z: number, angle: number) {
    const fx = x + Math.sin(angle) * 1.7;
    const fz = z + Math.cos(angle) * 1.7;
    this.flashLight(fx, 0.95, fz, 0xffb74d, 6.2, 0.11);
    this.spawnRing(fx, fz, 1.85, 0.22, 0xffd166);
    const count = this.lowQuality ? 7 : 12;
    for (let i = 0; i < count; i++) {
      const isSmoke = i >= 4;
      this.spawnParticle({
        x: fx + (Math.random() - 0.5) * (isSmoke ? 0.45 : 0.22),
        y: 0.78 + (Math.random() - 0.5) * 0.2,
        z: fz + (Math.random() - 0.5) * (isSmoke ? 0.45 : 0.22),
        vx: Math.sin(angle) * (isSmoke ? 1.8 + Math.random() * 2.2 : 5.5 + Math.random() * 4.5) + (Math.random() - 0.5) * 2.6,
        vy: isSmoke ? 0.9 + Math.random() * 1.3 : (Math.random() - 0.15) * 1.4,
        vz: Math.cos(angle) * (isSmoke ? 1.8 + Math.random() * 2.2 : 5.5 + Math.random() * 4.5) + (Math.random() - 0.5) * 2.6,
        life: isSmoke ? 0.52 + Math.random() * 0.24 : 0.22 + Math.random() * 0.1,
        size: i === 0 ? 0.85 : isSmoke ? 0.46 : 0.36,
        endSize: isSmoke ? 0.92 : 0.05,
        colorHex: i < 2 ? 0xfff3b0 : i < 4 ? 0xff7b29 : i % 2 === 0 ? 0xffffff : 0xf1f5f9,
      });
    }
  }

  public emitProjectileSmoke(x: number, y: number, z: number, kind: string) {
    if (this.lowQuality && Math.random() > 0.65) return;
    const isMissile = kind === 'homing' || kind === 'cluster' || kind === 'guided';
    const isBouncing = kind === 'bouncing';
    const colorHex =
      kind === 'guided'
        ? Math.random() < 0.32
          ? 0x7dd3fc
          : 0xffffff
        : isMissile
        ? Math.random() < 0.26
          ? 0xfdba74
          : 0xffffff
        : isBouncing
        ? 0xfef08a
        : Math.random() < 0.22
        ? 0xfdba74
        : 0xffffff;

    this.spawnParticle({
      x: x + (Math.random() - 0.5) * (isMissile ? 0.2 : 0.12),
      y: Math.max(0.38, y + (Math.random() - 0.5) * 0.1),
      z: z + (Math.random() - 0.5) * (isMissile ? 0.2 : 0.12),
      vx: (Math.random() - 0.5) * 0.4,
      vy: isMissile ? 0.65 + Math.random() * 0.4 : 0.42 + Math.random() * 0.25,
      vz: (Math.random() - 0.5) * 0.4,
      life: isMissile ? 0.8 : 0.65,
      size: isMissile ? 0.68 : 0.52,
      endSize: isMissile ? 1.35 : 1.05,
      colorHex,
    });
  }

  public emitGroundDust(x: number, z: number, ground: 'normal' | 'ice' | 'mud' | 'speed_pad') {
    if (this.lowQuality && Math.random() > 0.4) return;
    const colorHex =
      ground === 'ice' ? 0xe0f2fe : ground === 'mud' ? 0x5c4033 : ground === 'speed_pad' ? 0x00e5c3 : 0xd6b88a;
    this.spawnParticle({
      x: x + (Math.random() - 0.5) * 0.8,
      y: 0.15,
      z: z + (Math.random() - 0.5) * 0.8,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.8 + Math.random() * 0.8,
      vz: (Math.random() - 0.5) * 1.2,
      life: 0.75,
      size: 0.28,
      endSize: 0.65,
      colorHex,
    });
  }

  public emitRicochet(x: number, z: number) {
    this.spawnRing(x, z, 1.6, 0.22, 0xfbbf24);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawnParticle({
        x,
        y: 0.7,
        z,
        vx: Math.cos(a) * 7,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(a) * 7,
        gravity: 14,
        life: 0.3,
        size: 0.16,
        endSize: 0.02,
        colorHex: 0xfef08a,
      });
    }
  }

  public emitHitSparks(x: number, z: number, shielded = false) {
    const count = this.lowQuality ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawnParticle({
        x,
        y: 0.8,
        z,
        vx: Math.cos(a) * 5,
        vy: 2 + Math.random() * 2.5,
        vz: Math.sin(a) * 5,
        gravity: 12,
        life: 0.32,
        size: 0.18,
        endSize: 0.02,
        colorHex: shielded ? 0x38bdf8 : 0xfb923c,
      });
    }
    if (shielded) {
      this.spawnRing(x, z, 2.4, 0.3, 0x38bdf8);
    }
  }

  public emitExplosion(x: number, z: number, radius: number, kind: string) {
    if (kind === 'emp') {
      this.spawnRing(x, z, radius, 0.5, 0x38bdf8);
      this.flashLight(x, 2, z, 0x38bdf8, 6, 0.22);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.spawnParticle({
          x,
          y: 0.8,
          z,
          vx: Math.cos(a) * 14,
          vy: 1.5,
          vz: Math.sin(a) * 14,
          life: 0.45,
          size: 0.35,
          endSize: 0.05,
          colorHex: 0x00e5ff,
        });
      }
      return;
    }

    if (kind === 'crate') {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnParticle({
          x,
          y: 0.6,
          z,
          vx: Math.cos(a) * (3 + Math.random() * 4),
          vy: 3 + Math.random() * 4,
          vz: Math.sin(a) * (3 + Math.random() * 4),
          gravity: 16,
          bounce: true,
          life: 0.8,
          size: 0.36,
          endSize: 0.15,
          colorHex: 0xb47b44,
        });
      }
      return;
    }

    const scale = kind === 'large' || kind === 'barrel' ? 1.5 : kind === 'medium' ? 1.15 : 0.7;
    this.spawnRing(x, z, Math.max(2, radius), 0.4, kind === 'cluster_open' ? 0xf8fafc : 0xff7b29);
    this.flashLight(x, 1.6, z, 0xff7722, 6 * scale, 0.18);
    if (scale >= 1.1) {
      this.spawnDecal(x, z, Math.min(4.5, radius * 0.7), 18, 0x18181b);
    }
    const count = this.lowQuality ? 6 : Math.round(14 * scale);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (2 + Math.random() * 6) * scale;
      this.spawnParticle({
        x: x + (Math.random() - 0.5) * 0.8,
        y: 0.6,
        z: z + (Math.random() - 0.5) * 0.8,
        vx: Math.cos(a) * spd,
        vy: (2.5 + Math.random() * 5) * scale,
        vz: Math.sin(a) * spd,
        gravity: i % 3 === 0 ? 15 : -1.5, // embers/smoke float up, debris falls
        bounce: i % 3 === 0,
        life: 0.45 + Math.random() * 0.45,
        size: (0.4 + Math.random() * 0.4) * scale,
        endSize: 0.05,
        colorHex: i % 3 === 0 ? 0x334155 : i % 2 === 0 ? 0xff6b2b : 0xffd166,
      });
    }
  }

  public emitPowerBoxPickup(x: number, z: number, colorHex = 0x00e5c3) {
    this.spawnRing(x, z, 3.0, 0.35, colorHex);
    const count = this.lowQuality ? 8 : 20;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawnParticle({
        x,
        y: 0.8,
        z,
        vx: Math.cos(a) * (2 + Math.random() * 4),
        vy: 3 + Math.random() * 4,
        vz: Math.sin(a) * (2 + Math.random() * 4),
        gravity: 6,
        life: 0.5,
        size: 0.22,
        endSize: 0.02,
        colorHex,
      });
    }
  }

  public emitDashGhosts(x: number, z: number, hullAngle: number, colorHex: string) {
    const col = new THREE.Color(colorHex).getHex();
    for (let i = 0; i < 4; i++) {
      this.spawnParticle({
        x,
        y: 0.45 + i * 0.08,
        z,
        vx: Math.sin(hullAngle) * 0.5,
        vy: 0.4,
        vz: Math.cos(hullAngle) * 0.5,
        life: 0.25,
        size: 0.75,
        endSize: 0.2,
        colorHex: col,
      });
    }
  }

  // Full cinematic tank destruction sequence (Section 12)
  public emitTankDestruction(x: number, z: number) {
    // 0.05s fireball + 6m shockwave ring + scorched blast decal
    this.emitExplosion(x, z, 6.0, 'large');
    this.spawnDecal(x, z, 3.8, 20, 0x111111);

    // 0.10s 12-16 debris chunks (6 on Low / reduced motion)
    const debrisCount = this.lowQuality || this.reducedMotion ? 6 : 15;
    for (let i = 0; i < debrisCount; i++) {
      const a = (i / debrisCount) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 4 + Math.random() * 7;
      this.spawnParticle({
        x,
        y: 0.6,
        z,
        vx: Math.cos(a) * spd,
        vy: 5 + Math.random() * 6,
        vz: Math.sin(a) * spd,
        gravity: 18,
        bounce: true,
        life: 1.5 + Math.random() * 0.6,
        size: 0.38,
        endSize: 0.2,
        colorHex: i % 2 === 0 ? 0x334155 : 0x475569,
      });
    }

    // 0.10s Turret blow-off parabolic arc (6m high, lands up to 8m away after 1.2s)
    const slot = this.wrecks.find((w) => !w.active) ?? this.wrecks[0];
    slot.active = true;
    slot.age = 0;
    slot.landed = false;
    slot.secondaryCount = 0;
    const launchAng = Math.random() * Math.PI * 2;
    const horizSpd = 4.5 + Math.random() * 2.0; // ~6-8m in 1.2s
    slot.vx = Math.cos(launchAng) * horizSpd;
    slot.vz = Math.sin(launchAng) * horizSpd;
    slot.vy = 11.5; // peak ~6m with g=18
    slot.spinX = (Math.random() - 0.5) * 9;
    slot.spinY = 8;
    slot.group.position.set(x, 0.9, z);
    slot.group.rotation.set(0, 0, 0);
    slot.group.visible = true;

    slot.hullWreck.position.set(x, 0.32, z);
    slot.hullWreck.rotation.set(0.08, Math.random() * Math.PI, -0.1);
    slot.hullWreck.visible = true;
  }

  public update(dt: number) {
    // Update particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.bounce && p.y < 0.15) {
        p.y = 0.15;
        p.vy = Math.abs(p.vy) * 0.42;
        p.vx *= 0.65;
        p.vz *= 0.65;
      }
      p.rotX += p.rotSpeed * dt;
      p.rotY += p.rotSpeed * dt;

      const t = p.age / p.life;
      const sz = p.size + (p.endSize - p.size) * t;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rotX, p.rotY, 0);
      _dummy.scale.set(sz, sz, sz);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // Update shockwave rings
    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.life) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.age / r.life;
      const sc = 0.4 + r.maxRadius * t;
      r.mesh.scale.set(sc, 1, sc);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }

    // Update decals
    for (const d of this.decals) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.life) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      const fadeStart = d.life * 0.7;
      if (d.age > fadeStart) {
        const t = (d.age - fadeStart) / (d.life - fadeStart);
        (d.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
      }
    }

    // Update flying turrets & burning hull wrecks
    for (const w of this.wrecks) {
      if (!w.active) continue;
      w.age += dt;
      if (!w.landed) {
        w.vy -= 18 * dt;
        w.group.position.x += w.vx * dt;
        w.group.position.y += w.vy * dt;
        w.group.position.z += w.vz * dt;
        w.group.rotation.x += w.spinX * dt;
        w.group.rotation.y += w.spinY * dt;
        if (w.group.position.y <= 0.35) {
          w.group.position.y = 0.35;
          w.landed = true;
          this.emitGroundDust(w.group.position.x, w.group.position.z, 'normal');
        }
      }

      // 0.30s -> 2.8s rising black smoke column & embers + secondary pops
      if (w.age > 0.25 && w.age < 2.8 && Math.random() < dt * 14) {
        this.spawnParticle({
          x: w.hullWreck.position.x + (Math.random() - 0.5) * 0.9,
          y: 0.7,
          z: w.hullWreck.position.z + (Math.random() - 0.5) * 0.9,
          vx: (Math.random() - 0.5) * 0.8,
          vy: 3.5 + Math.random() * 2.5,
          vz: (Math.random() - 0.5) * 0.8,
          life: 1.4,
          size: 0.45,
          endSize: 1.1,
          colorHex: Math.random() < 0.25 ? 0xff6b2b : 0x1e293b,
        });
      }
      if (w.age > 0.45 && w.secondaryCount < 2 && w.age > 0.45 + w.secondaryCount * 0.45) {
        w.secondaryCount++;
        this.emitExplosion(
          w.hullWreck.position.x + (Math.random() - 0.5) * 1.2,
          w.hullWreck.position.z + (Math.random() - 0.5) * 1.2,
          1.8,
          'small'
        );
      }

      if (w.age >= 3.2) {
        w.active = false;
        w.group.visible = false;
        w.hullWreck.visible = false;
      }
    }

    // Update muzzle lights
    for (const ml of this.muzzleLights) {
      if (ml.age < ml.life) {
        ml.age += dt;
        const t = Math.min(1, ml.age / ml.life);
        ml.light.intensity *= 1 - t * 0.5;
      } else {
        ml.light.intensity = 0;
      }
    }
  }
}
