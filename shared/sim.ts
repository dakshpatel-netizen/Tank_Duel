import {
  GAME_MODES,
  PHYSICS,
  POWER_BOX_CONFIG,
  POWER_BOX_ITEMS,
  STREAK_BANNERS,
  TANK_CLASSES,
  WEAPONS,
  WEAPON_TUNING,
  type PowerBoxItemId,
  type StoredWeaponId,
  type TankClassId,
  type TimedBuffId,
} from './config';
import { buildMap } from './maps/index';
import type {
  ActiveBuff,
  DestructibleObj,
  GroundType,
  LobbyPlayerInfo,
  MapDefinition,
  MatchAward,
  MatchResultSummary,
  MatchSettings,
  PlayerInput,
  ProjectileState,
  SimEvent,
  SimState,
  TankState,
  TeamId,
} from './types';

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

// Deterministic PRNG (Mulberry32) so simulation never calls Math.random or Date.now inside ticks
export function seededRand(seed: number, step: number): number {
  let t = (seed + step * 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pickWeightedPowerBoxItem(seed: number, step: number, mode: MatchSettings['mode']): PowerBoxItemId {
  // Filter items if needed (all 13 enabled across modes)
  let total = 0;
  for (const item of POWER_BOX_ITEMS) {
    total += item.weight;
  }
  let r = seededRand(seed, step) * total;
  for (const item of POWER_BOX_ITEMS) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return mode === 'ctf' ? 'speed_boost' : 'repair';
}

export function getTankClass(tank: Pick<TankState, 'custom'>, settings: MatchSettings) {
  const id: TankClassId = settings.tankRule === 'classes' ? tank.custom.classId : 'standard';
  return TANK_CLASSES[id];
}

export function getGroundTypeAt(map: MapDefinition, x: number, z: number): { ground: GroundType; padDirX: number; padDirZ: number } {
  for (const zone of map.zones) {
    if (zone.shape === 'circle' && zone.r) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      if (dx * dx + dz * dz <= zone.r * zone.r) {
        return { ground: zone.type, padDirX: zone.dirX ?? 0, padDirZ: zone.dirZ ?? 0 };
      }
    } else if (zone.shape === 'rect' && zone.w && zone.d) {
      if (Math.abs(x - zone.x) <= zone.w * 0.5 && Math.abs(z - zone.z) <= zone.d * 0.5) {
        return { ground: zone.type, padDirX: zone.dirX ?? 0, padDirZ: zone.dirZ ?? 0 };
      }
    }
  }
  return { ground: 'normal', padDirX: 0, padDirZ: 0 };
}

export function hasBuff(tank: TankState, id: TimedBuffId): boolean {
  return tank.buffs.some((b) => b.id === id && b.remaining > 0);
}

export function clampInput(input: PlayerInput, map: MapDefinition): PlayerInput {
  const halfW = map.width * 0.5;
  const halfD = map.depth * 0.5;
  return {
    seq: Math.max(0, Math.floor(input.seq || 0)),
    clientTime: Number.isFinite(input.clientTime) ? input.clientTime : 0,
    forward: Math.max(-1, Math.min(1, Number.isFinite(input.forward) ? input.forward : 0)),
    turn: Math.max(-1, Math.min(1, Number.isFinite(input.turn) ? input.turn : 0)),
    aimX: Math.max(-halfW, Math.min(halfW, Number.isFinite(input.aimX) ? input.aimX : 0)),
    aimZ: Math.max(-halfD, Math.min(halfD, Number.isFinite(input.aimZ) ? input.aimZ : 0)),
    fire: Boolean(input.fire),
    useWeapon: Boolean(input.useWeapon),
    turbo: Boolean(input.turbo),
    handbrake: Boolean(input.handbrake),
    dashDir: input.dashDir === -1 ? -1 : input.dashDir === 1 ? 1 : 0,
  };
}

export function resolveTankWorldCollisions(
  tank: TankState,
  map: MapDefinition,
  destructibles: DestructibleObj[],
  settings: MatchSettings
): void {
  const cls = getTankClass(tank, settings);
  const radius = Math.max(cls.width, cls.length) * 0.44;
  const halfW = map.width * 0.5 - 1.0 - radius;
  const halfD = map.depth * 0.5 - 1.0 - radius;

  // Perimeter clamp
  if (tank.x < -halfW) {
    tank.x = -halfW;
    if (tank.vx < 0) tank.vx = 0;
  } else if (tank.x > halfW) {
    tank.x = halfW;
    if (tank.vx > 0) tank.vx = 0;
  }
  if (tank.z < -halfD) {
    tank.z = -halfD;
    if (tank.vz < 0) tank.vz = 0;
  } else if (tank.z > halfD) {
    tank.z = halfD;
    if (tank.vz > 0) tank.vz = 0;
  }

  // Circle vs AABB helper for walls
  const pushFromBox = (bx: number, bz: number, bw: number, bd: number) => {
    const hw = bw * 0.5;
    const hd = bd * 0.5;
    const closestX = Math.max(bx - hw, Math.min(bx + hw, tank.x));
    const closestZ = Math.max(bz - hd, Math.min(bz + hd, tank.z));
    const dx = tank.x - closestX;
    const dz = tank.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        tank.x += nx * push;
        tank.z += nz * push;
        const vn = tank.vx * nx + tank.vz * nz;
        if (vn < 0) {
          tank.vx -= vn * nx;
          tank.vz -= vn * nz;
        }
      } else {
        // Inside box center fallback
        const penX = hw + radius - Math.abs(tank.x - bx);
        const penZ = hd + radius - Math.abs(tank.z - bz);
        if (penX < penZ) {
          tank.x += tank.x >= bx ? penX : -penX;
        } else {
          tank.z += tank.z >= bz ? penZ : -penZ;
        }
      }
    }
  };

  for (const w of map.walls) {
    if (w.destructible && (w.hp ?? 1) <= 0) continue;
    pushFromBox(w.x, w.z, w.w, w.d);
  }

  // Circle vs Circle helper for rocks, trees, crates, barrels
  const pushFromCircle = (cx: number, cz: number, cr: number) => {
    const minDist = radius + cr;
    const dx = tank.x - cx;
    const dz = tank.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      const nx = dist > 0.0001 ? dx / dist : 1;
      const nz = dist > 0.0001 ? dz / dist : 0;
      const push = minDist - dist;
      tank.x += nx * push;
      tank.z += nz * push;
      const vn = tank.vx * nx + tank.vz * nz;
      if (vn < 0) {
        tank.vx -= vn * nx;
        tank.vz -= vn * nz;
      }
    }
  };

  for (const r of map.rocks) {
    pushFromCircle(r.x, r.z, r.r);
  }
  for (const t of map.trees) {
    pushFromCircle(t.x, t.z, t.r);
  }
  for (const d of destructibles) {
    if (!d.alive) continue;
    if (d.kind === 'crate') {
      pushFromBox(d.x, d.z, 1.6, 1.6);
    } else {
      pushFromCircle(d.x, d.z, 0.5);
    }
  }
}

// Pure shared tank movement function used identically by server (truth) and client (prediction).
export function stepTank(
  tank: TankState,
  rawInput: PlayerInput,
  dt: number,
  map: MapDefinition,
  destructibles: DestructibleObj[],
  settings: MatchSettings,
  carryingFlag: boolean
): void {
  if (!tank.alive) return;

  const input = clampInput(rawInput, map);
  const cls = getTankClass(tank, settings);

  // If guiding a missile, tank cannot move or rotate hull/turret
  if (tank.guidedMissileId) {
    tank.vx *= 0.85;
    tank.vz *= 0.85;
    tank.speed = Math.hypot(tank.vx, tank.vz);
    tank.turboActive = false;
    tank.x = round3(tank.x + tank.vx * dt);
    tank.z = round3(tank.z + tank.vz * dt);
    resolveTankWorldCollisions(tank, map, destructibles, settings);
    tank.x = round3(tank.x);
    tank.z = round3(tank.z);
    return;
  }

  // Ground check
  const { ground } = getGroundTypeAt(map, tank.x, tank.z);
  tank.groundType = ground;
  if (ground === 'speed_pad') {
    tank.speedPadTimer = PHYSICS.speedPadDuration;
  }

  // Turbo stamina management
  if (tank.turboStamina <= 0) {
    tank.turboStamina = 0;
    tank.turboLockout = true;
  } else if (tank.turboLockout && tank.turboStamina >= 0.25) {
    tank.turboLockout = false;
  }

  const wantsTurbo = input.turbo && !tank.turboLockout && !carryingFlag && tank.turboStamina > 0.01 && Math.abs(input.forward) > 0.05;
  tank.turboActive = wantsTurbo;
  if (wantsTurbo) {
    tank.turboStamina = Math.max(0, tank.turboStamina - dt / cls.turboDuration);
  } else {
    tank.turboStamina = Math.min(1, tank.turboStamina + dt / cls.turboRecharge);
  }

  // Scout sideways dash
  if (cls.id === 'scout' && input.dashDir !== 0 && tank.dashCooldown <= 0 && tank.dashTimer <= 0) {
    // Sideways vector perpendicular to hull forward (sin, cos) -> right is (-cos, sin), left is (cos, -sin)
    const dir = input.dashDir;
    tank.dashDirX = -Math.cos(tank.hullAngle) * dir;
    tank.dashDirZ = Math.sin(tank.hullAngle) * dir;
    tank.dashTimer = cls.dashDuration;
    tank.dashCooldown = cls.dashCooldown;
  }

  // Speed multipliers
  let speedMult = 1.0;
  if (tank.groundType === 'mud') speedMult *= PHYSICS.mudSpeedMult;
  if (tank.speedPadTimer > 0) speedMult *= PHYSICS.speedPadMult;
  if (hasBuff(tank, 'speed_boost')) speedMult *= POWER_BOX_CONFIG.speedBoostMult;
  if (tank.turboActive) speedMult *= cls.turboMult;
  if (tank.empTimer > 0) speedMult *= WEAPON_TUNING.empSlowMult;
  if (carryingFlag) speedMult *= PHYSICS.ctfCarrierSpeedMult;
  if (input.handbrake) speedMult *= PHYSICS.handbrakeSpeedCapRatio;

  const maxFwd = cls.forwardSpeed * speedMult;
  const maxRev = cls.reverseSpeed * speedMult;

  const currentSpeedAlongFwd =
    tank.vx * Math.sin(tank.hullAngle) + tank.vz * Math.cos(tank.hullAngle);

  // Hull turning: slower when moving fast, faster when standing, boosted by handbrake
  const speedRatio = Math.min(1, Math.abs(currentSpeedAlongFwd) / Math.max(0.1, cls.forwardSpeed));
  let turnDeg =
    cls.hullTurnStandingDeg + (cls.hullTurnFullSpeedDeg - cls.hullTurnStandingDeg) * speedRatio;
  if (input.handbrake) {
    turnDeg *= PHYSICS.handbrakeTurnMult;
  }
  if (tank.groundType === 'ice') {
    turnDeg *= 0.65;
  }
  const turnRad = (turnDeg * Math.PI) / 180;
  // A = turn < 0 (increases angle -> left), D = turn > 0 (decreases angle -> right)
  tank.hullAngle = normalizeAngle(tank.hullAngle - input.turn * turnRad * dt);

  const fwdX = Math.sin(tank.hullAngle);
  const fwdZ = Math.cos(tank.hullAngle);

  const targetSpeed = input.forward >= 0 ? input.forward * maxFwd : input.forward * maxRev;
  const desiredVx = fwdX * targetSpeed;
  const desiredVz = fwdZ * targetSpeed;

  if (tank.groundType === 'ice') {
    // Ice low friction: velocity drifts and turns have delayed response
    const iceAccel = (input.forward !== 0 ? cls.accel : 2.5) * PHYSICS.iceFriction * 4.5;
    const blend = Math.min(1, iceAccel * dt);
    tank.vx += (desiredVx - tank.vx) * blend;
    tank.vz += (desiredVz - tank.vz) * blend;
  } else {
    // Normal / mud traction: redirect existing forward momentum cleanly along hull treads
    const alongSpeed = tank.vx * fwdX + tank.vz * fwdZ;
    const gripBlend = Math.min(1, 14 * dt);
    tank.vx += (fwdX * alongSpeed - tank.vx) * gripBlend;
    tank.vz += (fwdZ * alongSpeed - tank.vz) * gripBlend;

    const isBraking =
      input.forward === 0 ||
      Math.sign(input.forward) !== Math.sign(currentSpeedAlongFwd) ||
      input.handbrake;
    const rate = (isBraking ? cls.brake : cls.accel) * (tank.turboActive ? 1.35 : 1.0);
    const dvx = desiredVx - tank.vx;
    const dvz = desiredVz - tank.vz;
    const dvLen = Math.hypot(dvx, dvz);
    const maxStep = rate * dt;
    if (dvLen <= maxStep || dvLen < 0.0001) {
      tank.vx = desiredVx;
      tank.vz = desiredVz;
    } else {
      tank.vx += (dvx / dvLen) * maxStep;
      tank.vz += (dvz / dvLen) * maxStep;
    }
  }

  // Apply Dash burst velocity override
  let moveVx = tank.vx;
  let moveVz = tank.vz;
  if (tank.dashTimer > 0 && cls.dashDuration > 0) {
    const dashSpeed = cls.dashDistance / cls.dashDuration;
    moveVx += tank.dashDirX * dashSpeed;
    moveVz += tank.dashDirZ * dashSpeed;
  }

  tank.x = round3(tank.x + moveVx * dt);
  tank.z = round3(tank.z + moveVz * dt);
  resolveTankWorldCollisions(tank, map, destructibles, settings);

  tank.x = round3(tank.x);
  tank.z = round3(tank.z);
  tank.vx = round3(tank.vx);
  tank.vz = round3(tank.vz);
  tank.hullAngle = round3(tank.hullAngle);
  tank.speed = round3(Math.hypot(tank.vx, tank.vz));

  // Turret aims smoothly toward aim pin
  const aimDx = input.aimX - tank.x;
  const aimDz = input.aimZ - tank.z;
  if (aimDx * aimDx + aimDz * aimDz > 0.04) {
    const desiredTurret = Math.atan2(aimDx, aimDz);
    const diff = angleDiff(tank.turretAngle, desiredTurret);
    const maxTurretStep = ((cls.turretTurnDeg * Math.PI) / 180) * dt;
    if (Math.abs(diff) <= maxTurretStep) {
      tank.turretAngle = desiredTurret;
    } else {
      tank.turretAngle = normalizeAngle(tank.turretAngle + Math.sign(diff) * maxTurretStep);
    }
  }
  tank.turretAngle = round3(tank.turretAngle);
  tank.lastProcessedSeq = input.seq;
}

// Segment vs AABB intersection returning t in [0,1] and hit normal
function segmentVsAabb(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  bx: number,
  bz: number,
  hw: number,
  hd: number
): { t: number; nx: number; nz: number } | null {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tmin = 0;
  let tmax = 1;
  let nx = 0;
  let nz = 0;

  if (Math.abs(dx) < 1e-8) {
    if (x1 < bx - hw || x1 > bx + hw) return null;
  } else {
    const inv = 1 / dx;
    let t1 = (bx - hw - x1) * inv;
    let t2 = (bx + hw - x1) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = sign;
      nz = 0;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  if (Math.abs(dz) < 1e-8) {
    if (z1 < bz - hd || z1 > bz + hd) return null;
  } else {
    const inv = 1 / dz;
    let t1 = (bz - hd - z1) * inv;
    let t2 = (bz + hd - z1) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = 0;
      nz = sign;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  return { t: tmin, nx, nz };
}

// Segment vs Circle intersection returning earliest t in [0,1] and normal
export function segmentVsCircle(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  cx: number,
  cz: number,
  r: number
): { t: number; nx: number; nz: number } | null {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const fx = x1 - cx;
  const fz = z1 - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) {
    if (fx * fx + fz * fz <= r * r) {
      const len = Math.hypot(fx, fz) || 1;
      return { t: 0, nx: fx / len, nz: fz / len };
    }
    return null;
  }
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  if (t1 >= 0 && t1 <= 1) {
    const hx = x1 + dx * t1;
    const hz = z1 + dz * t1;
    const len = Math.hypot(hx - cx, hz - cz) || 1;
    return { t: t1, nx: (hx - cx) / len, nz: (hz - cz) / len };
  }
  if (t1 < 0 && t2 >= 0) {
    const len = Math.hypot(fx, fz) || 1;
    return { t: 0, nx: fx / len, nz: fz / len };
  }
  return null;
}

export function selectSafeSpawn(
  map: MapDefinition,
  tanks: TankState[],
  team: TeamId,
  lastSpawnIdx: number,
  seed: number,
  tick: number
): { x: number; z: number; angle: number; idx: number } {
  const candidates = map.spawns.map((sp, idx) => ({ sp, idx }));
  const teamPool = team !== 'none' ? candidates.filter((c) => c.sp.team === team) : candidates;
  const pool = teamPool.length > 0 ? teamPool : candidates;

  let bestScore = -Infinity;
  let bestList: typeof pool = [];

  for (const cand of pool) {
    if (cand.idx === lastSpawnIdx && pool.length > 1) continue;

    let minEnemyDist = Infinity;
    let minAnyDist = Infinity;
    let minMateDist = Infinity;
    let inEnemyView = false;

    for (const other of tanks) {
      if (!other.alive) continue;
      const d = Math.hypot(other.x - cand.sp.x, other.z - cand.sp.z);
      if (d < minAnyDist) minAnyDist = d;
      const isEnemy = team === 'none' || other.team !== team;
      if (isEnemy) {
        if (d < minEnemyDist) minEnemyDist = d;
        // Check enemy turret view cone (~35 deg)
        const toSpawnAngle = Math.atan2(cand.sp.x - other.x, cand.sp.z - other.z);
        if (d < 65 && Math.abs(angleDiff(other.turretAngle, toSpawnAngle)) < 0.6) {
          inEnemyView = true;
        }
      } else {
        if (d < minMateDist) minMateDist = d;
      }
    }

    let score = Math.min(minEnemyDist, 80);
    if (minAnyDist < PHYSICS.spawnMinAnyTankDist) score -= 500;
    if (minEnemyDist < PHYSICS.spawnMinEnemyDist) score -= 120;
    if (inEnemyView) score -= 45;
    if (team !== 'none' && minMateDist < 45) score += 15;

    if (score > bestScore + 0.5) {
      bestScore = score;
      bestList = [cand];
    } else if (Math.abs(score - bestScore) <= 0.5) {
      bestList.push(cand);
    }
  }

  const chosenPool = bestList.length > 0 ? bestList : pool;
  const pickIdx = Math.floor(seededRand(seed, tick + lastSpawnIdx + 17) * chosenPool.length);
  const chosen = chosenPool[Math.min(chosenPool.length - 1, pickIdx)];
  return { x: chosen.sp.x, z: chosen.sp.z, angle: chosen.sp.angle, idx: chosen.idx };
}

export function createSimState(
  players: LobbyPlayerInfo[],
  settings: MatchSettings,
  seed: number
): SimState {
  const map = buildMap(settings.mapId, settings.mapSize);
  const modeMeta = GAME_MODES[settings.mode];

  const destructibles: DestructibleObj[] = [
    ...map.crates.map((c) => ({
      id: c.id,
      kind: 'crate' as const,
      x: c.x,
      z: c.z,
      hp: PHYSICS.crateHp,
      maxHp: PHYSICS.crateHp,
      alive: true,
      respawnTimer: 0,
    })),
    ...map.barrels.map((b) => ({
      id: b.id,
      kind: 'barrel' as const,
      x: b.x,
      z: b.z,
      hp: PHYSICS.barrelHp,
      maxHp: PHYSICS.barrelHp,
      alive: true,
      respawnTimer: 0,
    })),
  ];

  const powerBoxes = settings.powerBoxesEnabled
    ? map.pads.map((pad, i) => ({
        id: pad.id,
        x: pad.x,
        z: pad.z,
        active: true,
        itemId: pickWeightedPowerBoxItem(seed, i + 101, settings.mode),
        respawnTimer: 0,
      }))
    : [];

  const tanks: TankState[] = [];
  players.forEach((p, idx) => {
    const team: TeamId = modeMeta.isTeam ? (p.team === 'red' || p.team === 'blue' ? p.team : idx % 2 === 0 ? 'red' : 'blue') : 'none';
    const clsId: TankClassId = settings.tankRule === 'classes' ? p.custom.classId : 'standard';
    const cls = TANK_CLASSES[clsId];
    const maxHp = settings.tankRule === 'classic' ? settings.classicHp : cls.health;
    const sp = selectSafeSpawn(map, tanks, team, -1, seed, idx + 1);
    tanks.push({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      team,
      custom: { ...p.custom, classId: clsId },
      x: sp.x,
      z: sp.z,
      vx: 0,
      vz: 0,
      hullAngle: sp.angle,
      turretAngle: sp.angle,
      speed: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      respawnTimer: 0,
      spawnShieldTimer: PHYSICS.spawnShieldDuration,
      reloadTimer: 0,
      reloadMax: cls.cannonReload,
      turboStamina: 1,
      turboActive: false,
      turboLockout: false,
      dashTimer: 0,
      dashCooldown: 0,
      dashDirX: 0,
      dashDirZ: 0,
      speedPadTimer: 0,
      empTimer: 0,
      shieldHp: 0,
      storedWeapon: null,
      storedAmmo: 0,
      buffs: [],
      groundType: 'normal',
      lastSpawnIndex: sp.idx,
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      shotsFired: 0,
      shotsHit: 0,
      powerUpsCollected: 0,
      streak: 0,
      bestStreak: 0,
      flagCaptures: 0,
      hillSeconds: 0,
      lastProcessedSeq: 0,
      afk: false,
      disconnected: false,
      guidedMissileId: null,
      pingMs: p.pingMs,
    });
  });

  const flags =
    settings.mode === 'ctf' && map.ctfBases
      ? {
          red: {
            team: 'red' as const,
            x: map.ctfBases.red.flagX,
            z: map.ctfBases.red.flagZ,
            homeX: map.ctfBases.red.flagX,
            homeZ: map.ctfBases.red.flagZ,
            carrierId: null,
            droppedTimer: 0,
            atHome: true,
          },
          blue: {
            team: 'blue' as const,
            x: map.ctfBases.blue.flagX,
            z: map.ctfBases.blue.flagZ,
            homeX: map.ctfBases.blue.flagX,
            homeZ: map.ctfBases.blue.flagZ,
            carrierId: null,
            droppedTimer: 0,
            atHome: true,
          },
        }
      : settings.mode === 'ctf'
      ? {
          red: {
            team: 'red' as const,
            x: -map.width * 0.4,
            z: 0,
            homeX: -map.width * 0.4,
            homeZ: 0,
            carrierId: null,
            droppedTimer: 0,
            atHome: true,
          },
          blue: {
            team: 'blue' as const,
            x: map.width * 0.4,
            z: 0,
            homeX: map.width * 0.4,
            homeZ: 0,
            carrierId: null,
            droppedTimer: 0,
            atHome: true,
          },
        }
      : null;

  const hill =
    settings.mode === 'koth' && map.hillSpots.length > 0
      ? {
          activeIndex: 0,
          nextIndex: 1 % map.hillSpots.length,
          x: map.hillSpots[0].x,
          z: map.hillSpots[0].z,
          r: map.hillSpots[0].r,
          nextX: map.hillSpots[1 % map.hillSpots.length].x,
          nextZ: map.hillSpots[1 % map.hillSpots.length].z,
          moveTimer: PHYSICS.kothMoveIntervalSec,
          holderTeam: 'none' as TeamId,
          holderPlayerId: null,
        }
      : null;

  const initRadius = Math.hypot(map.width * 0.5, map.depth * 0.5);
  const safeZoneEnabled = settings.mode === 'lts' || settings.shrinkingZone;

  return {
    tick: 0,
    seed,
    map,
    settings,
    tanks,
    projectiles: [],
    mines: [],
    airstrikes: [],
    powerBoxes,
    destructibles,
    flags,
    hill,
    safeZone: {
      enabled: safeZoneEnabled,
      x: 0,
      z: 0,
      currentRadius: initRadius,
      initialRadius: initRadius,
      finalRadius: PHYSICS.safeZoneFinalRadius,
      shrinking: false,
    },
    teamScores: { red: 0, blue: 0 },
    roundNumber: 1,
    roundWins: {},
    roundDraws: 0,
    roundOverTimer: 0,
    timeRemainingSec: settings.timeLimitSec,
    suddenDeath: false,
    matchEnded: false,
    winnerId: null,
    winnerTeam: null,
    winnerReason: '',
    damageLog: {},
  };
}

let nextEntitySeq = 1;
function genId(prefix: string, tick: number): string {
  nextEntitySeq = (nextEntitySeq + 1) % 1000000;
  return `${prefix}_${tick}_${nextEntitySeq}`;
}

// Applies damage to a tank, respects spawn shield, Heavy frontal armor, shield bubble, and logs assists
export function applyDamageToTank(
  state: SimState,
  target: TankState,
  rawDamage: number,
  attackerId: string | null,
  sourceX: number,
  sourceZ: number,
  weaponLabel: string,
  events: SimEvent[],
  bypassShield = false
): void {
  if (!target.alive || target.disconnected) return;
  if (target.spawnShieldTimer > 0 && !bypassShield) {
    events.push({ type: 'hit', targetId: target.id, attackerId: attackerId ?? '', x: target.x, z: target.z, damage: 0, shielded: true });
    return;
  }

  const attacker = attackerId ? state.tanks.find((t) => t.id === attackerId) : undefined;
  const modeMeta = GAME_MODES[state.settings.mode];
  // Friendly fire off check in team modes (self-damage via barrels/mines still allowed per rules, or handled by caller)
  if (
    modeMeta.isTeam &&
    !state.settings.friendlyFire &&
    attacker &&
    attacker.id !== target.id &&
    attacker.team === target.team &&
    weaponLabel !== 'Barrel'
  ) {
    return;
  }

  let dmg = rawDamage;
  let frontArmor = false;
  const cls = getTankClass(target, state.settings);
  if (!bypassShield && cls.frontArmorReduction > 0 && dmg > 0) {
    const incomingAngle = Math.atan2(sourceX - target.x, sourceZ - target.z);
    const diffDeg = Math.abs((angleDiff(target.hullAngle, incomingAngle) * 180) / Math.PI);
    if (diffDeg <= cls.frontArmorArcDeg * 0.5) {
      dmg = Math.round(dmg * (1 - cls.frontArmorReduction));
      frontArmor = true;
    }
  }

  let shielded = false;
  if (!bypassShield && target.shieldHp > 0 && dmg > 0) {
    shielded = true;
    const absorbed = Math.min(target.shieldHp, dmg);
    target.shieldHp -= absorbed;
    dmg -= absorbed;
    if (target.shieldHp <= 0) {
      target.buffs = target.buffs.filter((b) => b.id !== 'shield');
    }
  }

  if (dmg > 0) {
    target.hp = Math.max(0, target.hp - dmg);
    if (attacker && attacker.id !== target.id) {
      attacker.damageDealt += dmg;
      const log = (state.damageLog[target.id] ??= []);
      log.push({ attackerId: attacker.id, time: state.tick * PHYSICS.fixedDt });
    }
  }

  events.push({
    type: 'hit',
    targetId: target.id,
    attackerId: attackerId ?? '',
    x: target.x,
    z: target.z,
    damage: dmg,
    shielded,
    frontArmor,
  });

  if (target.hp <= 0 && target.alive) {
    killTank(state, target, attacker ?? null, weaponLabel, events);
  }
}

function killTank(
  state: SimState,
  victim: TankState,
  killer: TankState | null,
  weaponLabel: string,
  events: SimEvent[]
): void {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths += 1;
  victim.streak = 0;
  victim.respawnTimer = state.settings.mode === 'lts' ? 9999 : PHYSICS.respawnDelay;
  victim.shieldHp = 0;
  victim.buffs = [];
  victim.turboActive = false;
  victim.dashTimer = 0;

  // Edge case 16: Guided missile owner dies -> detonate missile immediately
  if (victim.guidedMissileId) {
    const gm = state.projectiles.find((p) => p.id === victim.guidedMissileId);
    if (gm) {
      gm.lifetime = 0;
      triggerExplosion(state, gm.x, gm.z, gm.blastRadius, gm.damage, victim.id, 'Guided Missile', 'large', events);
    }
    victim.guidedMissileId = null;
  }

  // Edge case 9: Flag carrier dies -> drop flag at position
  if (state.flags) {
    for (const f of [state.flags.red, state.flags.blue]) {
      if (f.carrierId === victim.id) {
        f.carrierId = null;
        f.x = victim.x;
        f.z = victim.z;
        f.atHome = false;
        f.droppedTimer = PHYSICS.ctfFlagReturnSec;
        events.push({ type: 'flag_event', action: 'dropped', team: f.team, x: f.x, z: f.z });
      }
    }
  }

  // Chain mini-explosion if victim held a stored missile/mine (Section 12)
  const hadStored = victim.storedWeapon !== null;
  victim.storedWeapon = null;
  victim.storedAmmo = 0;

  let streakBanner: number | undefined;
  if (killer && killer.id !== victim.id) {
    killer.kills += 1;
    killer.streak += 1;
    if (killer.streak > killer.bestStreak) killer.bestStreak = killer.streak;
    if (STREAK_BANNERS[killer.streak]) {
      streakBanner = killer.streak;
    }
    if (state.settings.mode === 'tdm') {
      if (killer.team === 'red') state.teamScores.red += 1;
      else if (killer.team === 'blue') state.teamScores.blue += 1;
    }
  }

  // Assists (damaged victim within last 5s, not the killer)
  const nowSec = state.tick * PHYSICS.fixedDt;
  const log = state.damageLog[victim.id] ?? [];
  const credited = new Set<string>();
  for (const entry of log) {
    if (nowSec - entry.time <= PHYSICS.assistWindowSec && entry.attackerId !== killer?.id && !credited.has(entry.attackerId)) {
      credited.add(entry.attackerId);
      const assister = state.tanks.find((t) => t.id === entry.attackerId);
      if (assister) assister.assists += 1;
    }
  }
  state.damageLog[victim.id] = [];

  events.push({
    type: 'tank_destroyed',
    victimId: victim.id,
    victimName: victim.name,
    victimTeam: victim.team,
    victimClass: victim.custom.classId,
    killerId: killer?.id ?? null,
    killerName: killer?.name ?? (weaponLabel === 'Safe Zone' ? 'Safe Zone' : 'Hazard'),
    killerTeam: killer?.team ?? 'none',
    x: victim.x,
    z: victim.z,
    weapon: weaponLabel,
    streak: streakBanner,
  });

  if (hadStored) {
    triggerExplosion(
      state,
      victim.x,
      victim.z,
      PHYSICS.destructionChainRadius,
      PHYSICS.destructionChainDamage,
      victim.id,
      'Ammo Cookoff',
      'small',
      events
    );
  }
}

export function triggerExplosion(
  state: SimState,
  x: number,
  z: number,
  radius: number,
  damage: number,
  ownerId: string | null,
  weaponLabel: string,
  kind: 'small' | 'medium' | 'large' | 'barrel',
  events: SimEvent[]
): void {
  events.push({ type: 'explosion', x, z, radius, kind });
  const owner = ownerId ? state.tanks.find((t) => t.id === ownerId) : null;
  const modeMeta = GAME_MODES[state.settings.mode];

  // Damage tanks in radius
  for (const t of state.tanks) {
    if (!t.alive) continue;
    const dist = Math.hypot(t.x - x, t.z - z);
    if (dist <= radius + 0.9) {
      // Edge case 15: Airstrike/barrel self-damage rules
      if (owner && t.id === owner.id && modeMeta.isTeam && weaponLabel === 'Airstrike') {
        continue;
      }
      const falloff = dist < radius * 0.4 ? 1.0 : Math.max(0.4, 1 - (dist - radius * 0.4) / Math.max(0.5, radius));
      const dmg = Math.round(damage * falloff);
      applyDamageToTank(state, t, dmg, ownerId, x, z, weaponLabel, events);
    }
  }

  // Chain damage to crates and barrels
  for (const d of state.destructibles) {
    if (!d.alive) continue;
    const dist = Math.hypot(d.x - x, d.z - z);
    if (dist <= radius + 0.8) {
      damageDestructible(state, d, damage, ownerId, events);
    }
  }
}

function damageDestructible(
  state: SimState,
  obj: DestructibleObj,
  dmg: number,
  attackerId: string | null,
  events: SimEvent[]
): void {
  if (!obj.alive) return;
  obj.hp -= dmg;
  if (obj.hp <= 0) {
    obj.alive = false;
    obj.hp = 0;
    obj.respawnTimer = 35;
    if (obj.kind === 'crate') {
      events.push({ type: 'explosion', x: obj.x, z: obj.z, radius: 1.5, kind: 'crate' });
    } else {
      triggerExplosion(
        state,
        obj.x,
        obj.z,
        PHYSICS.barrelBlastRadius,
        PHYSICS.barrelBlastDamage,
        attackerId,
        'Barrel',
        'barrel',
        events
      );
    }
  }
}

// Main 30 Hz deterministic server/practice simulation tick following Section 32 tick order!
export function stepSim(
  state: SimState,
  inputsByTankId: Record<string, PlayerInput>,
  events: SimEvent[]
): void {
  if (state.matchEnded) return;

  const dt = PHYSICS.fixedDt;
  state.tick += 1;

  // LTS round transition pause
  if (state.roundOverTimer > 0) {
    state.roundOverTimer -= dt;
    if (state.roundOverTimer <= 0) {
      startNextLtsRound(state, events);
    }
    return;
  }

  // 1 & 2. Inputs are already validated/clamped before or inside stepTank
  // 3. Update timed effects and cooldowns
  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    if (tank.spawnShieldTimer > 0) tank.spawnShieldTimer = Math.max(0, round3(tank.spawnShieldTimer - dt));
    if (tank.reloadTimer > 0) tank.reloadTimer = Math.max(0, round3(tank.reloadTimer - dt));
    if (tank.dashTimer > 0) tank.dashTimer = Math.max(0, round3(tank.dashTimer - dt));
    if (tank.dashCooldown > 0) tank.dashCooldown = Math.max(0, round3(tank.dashCooldown - dt));
    if (tank.speedPadTimer > 0) tank.speedPadTimer = Math.max(0, round3(tank.speedPadTimer - dt));
    if (tank.empTimer > 0) tank.empTimer = Math.max(0, round3(tank.empTimer - dt));

    for (const b of tank.buffs) {
      b.remaining = Math.max(0, round3(b.remaining - dt));
    }
    tank.buffs = tank.buffs.filter((b) => b.remaining > 0);
    if (!hasBuff(tank, 'shield')) {
      tank.shieldHp = 0;
    }
  }

  // 4. Move tanks & resolve tank-vs-world and tank-vs-tank collisions
  for (const tank of state.tanks) {
    if (!tank.alive || tank.disconnected || tank.afk) continue;
    const rawIn: PlayerInput = inputsByTankId[tank.id] ?? {
      seq: tank.lastProcessedSeq,
      clientTime: 0,
      forward: 0,
      turn: 0,
      aimX: tank.x + Math.sin(tank.turretAngle) * 10,
      aimZ: tank.z + Math.cos(tank.turretAngle) * 10,
      fire: false,
      useWeapon: false,
      turbo: false,
      handbrake: false,
      dashDir: 0,
    };
    const prevDashTimer = tank.dashTimer;
    const carrying = Boolean(
      state.flags && (state.flags.red.carrierId === tank.id || state.flags.blue.carrierId === tank.id)
    );
    stepTank(tank, rawIn, dt, state.map, state.destructibles, state.settings, carrying);
    if (prevDashTimer <= 0 && tank.dashTimer > 0) {
      events.push({ type: 'dash', tankId: tank.id, x: tank.x, z: tank.z, dirX: tank.dashDirX, dirZ: tank.dashDirZ });
    }
  }

  // Tank-vs-tank separation (Edge case 5: 4 m/s separation, never permanent overlap)
  for (let i = 0; i < state.tanks.length; i++) {
    const a = state.tanks[i];
    if (!a.alive) continue;
    const ra = Math.max(getTankClass(a, state.settings).width, getTankClass(a, state.settings).length) * 0.44;
    for (let j = i + 1; j < state.tanks.length; j++) {
      const b = state.tanks[j];
      if (!b.alive) continue;
      const rb = Math.max(getTankClass(b, state.settings).width, getTankClass(b, state.settings).length) * 0.44;
      const minDist = ra + rb;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0.0001 ? dx / dist : 1;
        const nz = dist > 0.0001 ? dz / dist : 0;
        const overlap = minDist - dist;
        const step = Math.min(overlap, PHYSICS.tankSeparationSpeed * dt + overlap * 0.5);
        a.x = round3(a.x - nx * step * 0.5);
        a.z = round3(a.z - nz * step * 0.5);
        b.x = round3(b.x + nx * step * 0.5);
        b.z = round3(b.z + nz * step * 0.5);
        resolveTankWorldCollisions(a, state.map, state.destructibles, state.settings);
        resolveTankWorldCollisions(b, state.map, state.destructibles, state.settings);
      }
    }
  }

  // 5. Handle fire / weapon use requests
  for (const tank of state.tanks) {
    if (!tank.alive || tank.disconnected || tank.afk) continue;
    const input = inputsByTankId[tank.id];
    if (!input) continue;

    // Guided missile control / early detonation
    if (tank.guidedMissileId) {
      const gm = state.projectiles.find((p) => p.id === tank.guidedMissileId);
      if (gm) {
        const toAimAngle = Math.atan2(input.aimX - gm.x, input.aimZ - gm.z);
        const diff = angleDiff(gm.angle, toAimAngle);
        const maxTurn = ((WEAPON_TUNING.guidedTurnDeg * Math.PI) / 180) * dt;
        gm.angle = normalizeAngle(gm.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
        gm.vx = Math.sin(gm.angle) * gm.speed;
        gm.vz = Math.cos(gm.angle) * gm.speed;
        if (input.fire) {
          // Detonate manually
          gm.lifetime = 0;
          tank.guidedMissileId = null;
          triggerExplosion(state, gm.x, gm.z, gm.blastRadius, gm.damage, tank.id, 'Guided Missile', 'large', events);
        }
      } else {
        tank.guidedMissileId = null;
      }
      continue;
    }

    const cls = getTankClass(tank, state.settings);

    // Primary cannon (firing drops spawn shield immediately so shots are never blocked at spawn)
    if (input.fire && tank.reloadTimer <= 0) {
      tank.spawnShieldTimer = 0;
      const rapid = hasBuff(tank, 'rapid_fire');
      const reloadTime = Math.max(0.32, cls.cannonReload * (rapid ? POWER_BOX_CONFIG.rapidFireMult : 1));
      tank.reloadTimer = reloadTime;
      tank.reloadMax = reloadTime;

      const dmgMult = hasBuff(tank, 'damage_up') ? POWER_BOX_CONFIG.damageUpMult : 1;
      const dmg = Math.round(cls.cannonDamage * dmgMult);
      const isTriple = hasBuff(tank, 'triple_shot');
      const angles = isTriple
        ? [
            tank.turretAngle - (POWER_BOX_CONFIG.tripleShotSpreadDeg * Math.PI) / 180,
            tank.turretAngle,
            tank.turretAngle + (POWER_BOX_CONFIG.tripleShotSpreadDeg * Math.PI) / 180,
          ]
        : [tank.turretAngle];

      for (const ang of angles) {
        const spawnDist = cls.barrelLength * 0.9 + 0.35;
        const sx = round3(tank.x + Math.sin(ang) * spawnDist);
        const sz = round3(tank.z + Math.cos(ang) * spawnDist);
        state.projectiles.push({
          id: genId('sh', state.tick),
          kind: 'cannon',
          ownerId: tank.id,
          ownerTeam: tank.team,
          x: sx,
          y: 0.65,
          z: sz,
          vx: Math.sin(ang) * cls.shellSpeed,
          vy: 0,
          vz: Math.cos(ang) * cls.shellSpeed,
          angle: ang,
          speed: cls.shellSpeed,
          radius: PHYSICS.shellRadius,
          damage: dmg,
          blastRadius: 0,
          lifetime: PHYSICS.shellLifetime,
          maxLifetime: PHYSICS.shellLifetime,
          bouncesLeft: PHYSICS.shellMaxRicochets,
          hp: 999,
          createdAtTick: state.tick,
        });
      }
      tank.shotsFired += 1;
      events.push({ type: 'fired', tankId: tank.id, x: tank.x, z: tank.z, angle: tank.turretAngle, kind: 'cannon' });
    }

    // Stored missile / special weapon (disabled during EMP!)
    if (input.useWeapon && tank.storedWeapon && tank.storedAmmo > 0 && tank.empTimer <= 0) {
      tank.spawnShieldTimer = 0;
      fireStoredWeapon(state, tank, input, events);
    }
  }

  // 6. Move projectiles, mines, airstrikes with swept collision
  stepProjectiles(state, dt, events);
  stepMines(state, dt, events);
  stepAirstrikes(state, dt, events);

  // 7. Process pickups (Power Boxes & Flags)
  stepPowerBoxes(state, dt, events);
  stepFlags(state, dt, events);

  // 8 & 9. Mode logic (KOTH, Safe Zone, Win Conditions, Sudden Death)
  stepModes(state, dt, events);

  // 10. Process respawns (tanks & destructibles)
  for (const d of state.destructibles) {
    if (!d.alive) {
      d.respawnTimer -= dt;
      if (d.respawnTimer <= 0) {
        d.alive = true;
        d.hp = d.kind === 'crate' ? PHYSICS.crateHp : PHYSICS.barrelHp;
      }
    }
  }

  if (state.settings.mode !== 'lts') {
    for (const tank of state.tanks) {
      if (!tank.alive && !tank.disconnected) {
        tank.respawnTimer -= dt;
        if (tank.respawnTimer <= 0) {
          const sp = selectSafeSpawn(state.map, state.tanks, tank.team, tank.lastSpawnIndex, state.seed, state.tick);
          tank.x = sp.x;
          tank.z = sp.z;
          tank.vx = 0;
          tank.vz = 0;
          tank.hullAngle = sp.angle;
          tank.turretAngle = sp.angle;
          tank.lastSpawnIndex = sp.idx;
          tank.hp = tank.maxHp;
          tank.alive = true;
          tank.spawnShieldTimer = PHYSICS.spawnShieldDuration;
          tank.reloadTimer = 0;
          tank.turboStamina = 1;
          tank.empTimer = 0;
        }
      }
    }
  }
}

function fireStoredWeapon(state: SimState, tank: TankState, input: PlayerInput, events: SimEvent[]): void {
  const weaponId = tank.storedWeapon!;
  const def = WEAPONS[weaponId];
  const cls = getTankClass(tank, state.settings);
  const spawnDist = cls.barrelLength * 0.9 + 0.45;
  const sx = round3(tank.x + Math.sin(tank.turretAngle) * spawnDist);
  const sz = round3(tank.z + Math.cos(tank.turretAngle) * spawnDist);

  tank.storedAmmo -= 1;
  events.push({ type: 'fired', tankId: tank.id, x: tank.x, z: tank.z, angle: tank.turretAngle, kind: weaponId });

  if (weaponId === 'homing') {
    state.projectiles.push({
      id: genId('hm', state.tick),
      kind: 'homing',
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: sx,
      y: 0.75,
      z: sz,
      vx: Math.sin(tank.turretAngle) * def.speed,
      vy: 0,
      vz: Math.cos(tank.turretAngle) * def.speed,
      angle: tank.turretAngle,
      speed: def.speed,
      radius: 0.35,
      damage: def.damage,
      blastRadius: def.blastRadius,
      lifetime: def.lifetime,
      maxLifetime: def.lifetime,
      bouncesLeft: 0,
      hp: def.missileHp,
      targetId: null,
      createdAtTick: state.tick,
    });
  } else if (weaponId === 'cluster') {
    const dx = input.aimX - tank.x;
    const dz = input.aimZ - tank.z;
    const dist = Math.min(WEAPON_TUNING.clusterMaxRange, Math.max(8, Math.hypot(dx, dz)));
    const ang = Math.atan2(dx, dz);
    const tx = round3(tank.x + Math.sin(ang) * dist);
    const tz = round3(tank.z + Math.cos(ang) * dist);
    const flightTime = Math.max(0.35, dist / def.speed);
    state.projectiles.push({
      id: genId('cl', state.tick),
      kind: 'cluster',
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: sx,
      y: 0.9,
      z: sz,
      vx: Math.sin(ang) * def.speed,
      vy: 0,
      vz: Math.cos(ang) * def.speed,
      angle: ang,
      speed: def.speed,
      radius: 0.4,
      damage: def.damage,
      blastRadius: def.blastRadius,
      lifetime: flightTime,
      maxLifetime: flightTime,
      bouncesLeft: 0,
      hp: def.missileHp,
      targetX: tx,
      targetZ: tz,
      createdAtTick: state.tick,
    });
  } else if (weaponId === 'guided') {
    const id = genId('gd', state.tick);
    tank.guidedMissileId = id;
    state.projectiles.push({
      id,
      kind: 'guided',
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: sx,
      y: 0.85,
      z: sz,
      vx: Math.sin(tank.turretAngle) * def.speed,
      vy: 0,
      vz: Math.cos(tank.turretAngle) * def.speed,
      angle: tank.turretAngle,
      speed: def.speed,
      radius: 0.4,
      damage: def.damage,
      blastRadius: def.blastRadius,
      lifetime: def.lifetime,
      maxLifetime: def.lifetime,
      bouncesLeft: 0,
      hp: def.missileHp,
      createdAtTick: state.tick,
    });
  } else if (weaponId === 'bouncing') {
    state.projectiles.push({
      id: genId('bc', state.tick),
      kind: 'bouncing',
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: sx,
      y: 0.65,
      z: sz,
      vx: Math.sin(tank.turretAngle) * def.speed,
      vy: 0,
      vz: Math.cos(tank.turretAngle) * def.speed,
      angle: tank.turretAngle,
      speed: def.speed,
      radius: 0.35,
      damage: def.damage,
      blastRadius: def.blastRadius,
      lifetime: def.lifetime,
      maxLifetime: def.lifetime,
      bouncesLeft: WEAPON_TUNING.bouncingMaxBounces,
      hp: def.missileHp,
      createdAtTick: state.tick,
    });
  } else if (weaponId === 'emp') {
    events.push({ type: 'explosion', x: tank.x, z: tank.z, radius: def.blastRadius, kind: 'emp' });
    const modeMeta = GAME_MODES[state.settings.mode];
    for (const other of state.tanks) {
      if (!other.alive || other.id === tank.id) continue;
      if (modeMeta.isTeam && other.team === tank.team) continue;
      const dist = Math.hypot(other.x - tank.x, other.z - tank.z);
      if (dist <= def.blastRadius) {
        other.empTimer = WEAPON_TUNING.empDuration;
        other.shieldHp = 0;
        other.buffs = other.buffs.filter((b) => b.id !== 'shield');
      }
    }
  } else if (weaponId === 'mines') {
    const dropX = round3(tank.x - Math.sin(tank.hullAngle) * 1.9);
    const dropZ = round3(tank.z - Math.cos(tank.hullAngle) * 1.9);
    state.mines.push({
      id: genId('mn', state.tick),
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: dropX,
      z: dropZ,
      armTimer: WEAPON_TUNING.mineArmDelay,
      age: 0,
      lifetime: def.lifetime,
    });
  } else if (weaponId === 'airstrike') {
    const dx = input.aimX - tank.x;
    const dz = input.aimZ - tank.z;
    const dist = Math.hypot(dx, dz) || 1;
    state.airstrikes.push({
      id: genId('as', state.tick),
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: input.aimX,
      z: input.aimZ,
      dirX: dx / dist,
      dirZ: dz / dist,
      countdown: WEAPON_TUNING.airstrikeDelay,
      strikesDropped: 0,
      nextDropTimer: 0,
    });
  }

  if (tank.storedAmmo <= 0) {
    tank.storedWeapon = null;
    tank.storedAmmo = 0;
  }
}

function stepProjectiles(state: SimState, dt: number, events: SimEvent[]): void {
  const remaining: ProjectileState[] = [];
  const halfW = state.map.width * 0.5 - 1.0;
  const halfD = state.map.depth * 0.5 - 1.0;

  for (const p of state.projectiles) {
    if (p.lifetime <= 0 || p.hp <= 0) continue;
    p.lifetime -= dt;

    // Homing guidance
    if (p.kind === 'homing') {
      const modeMeta = GAME_MODES[state.settings.mode];
      let bestTarget: TankState | null = null;
      let bestDist = WEAPON_TUNING.homingRange;
      for (const t of state.tanks) {
        if (!t.alive || t.id === p.ownerId) continue;
        if (modeMeta.isTeam && t.team === p.ownerTeam) continue;
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > bestDist) continue;
        const toAng = Math.atan2(dx, dz);
        const diffDeg = Math.abs((angleDiff(p.angle, toAng) * 180) / Math.PI);
        if (diffDeg <= WEAPON_TUNING.homingConeDeg) {
          bestDist = dist;
          bestTarget = t;
        }
      }
      p.targetId = bestTarget?.id ?? null;
      if (bestTarget) {
        const toAng = Math.atan2(bestTarget.x - p.x, bestTarget.z - p.z);
        const diff = angleDiff(p.angle, toAng);
        const maxTurn = ((WEAPON_TUNING.homingTurnDeg * Math.PI) / 180) * dt;
        p.angle = normalizeAngle(p.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
        p.vx = Math.sin(p.angle) * p.speed;
        p.vz = Math.cos(p.angle) * p.speed;
      }
    }

    // Cluster airburst & bomblets
    if (p.kind === 'cluster') {
      const progress = 1 - Math.max(0, p.lifetime) / Math.max(0.01, p.maxLifetime);
      p.y = 0.9 + Math.sin(progress * Math.PI) * 11.0;
      if (p.lifetime <= 0) {
        events.push({ type: 'explosion', x: p.x, z: p.z, radius: 2.5, kind: 'cluster_open' });
        for (let b = 0; b < WEAPON_TUNING.clusterBombletCount; b++) {
          const ang = (b / WEAPON_TUNING.clusterBombletCount) * Math.PI * 2 + seededRand(state.seed, state.tick + b) * 0.5;
          const r = 1.5 + seededRand(state.seed, state.tick + b * 7) * (WEAPON_TUNING.clusterSpreadRadius - 1.5);
          const bx = p.x + Math.cos(ang) * r;
          const bz = p.z + Math.sin(ang) * r;
          state.projectiles.push({
            id: genId('bm', state.tick),
            kind: 'bomblet',
            ownerId: p.ownerId,
            ownerTeam: p.ownerTeam,
            x: p.x,
            y: p.y,
            z: p.z,
            vx: (bx - p.x) / WEAPON_TUNING.clusterDropTime,
            vy: -p.y / WEAPON_TUNING.clusterDropTime,
            vz: (bz - p.z) / WEAPON_TUNING.clusterDropTime,
            angle: ang,
            speed: 0,
            radius: 0.25,
            damage: WEAPONS.cluster.damage,
            blastRadius: WEAPONS.cluster.blastRadius,
            lifetime: WEAPON_TUNING.clusterDropTime,
            maxLifetime: WEAPON_TUNING.clusterDropTime,
            bouncesLeft: 0,
            hp: 99,
            createdAtTick: state.tick,
          });
        }
        continue;
      }
      p.x = round3(p.x + p.vx * dt);
      p.z = round3(p.z + p.vz * dt);
      remaining.push(p);
      continue;
    }

    if (p.kind === 'bomblet') {
      p.x = round3(p.x + p.vx * dt);
      p.y = round3(Math.max(0, p.y + p.vy * dt));
      p.z = round3(p.z + p.vz * dt);
      if (p.lifetime <= 0 || p.y <= 0.05) {
        triggerExplosion(state, p.x, p.z, p.blastRadius, p.damage, p.ownerId, 'Cluster Missile', 'small', events);
        continue;
      }
      remaining.push(p);
      continue;
    }

    const nextX = p.x + p.vx * dt;
    const nextZ = p.z + p.vz * dt;

    // Swept collision check against walls, rocks, destructibles, missiles, mines, and tanks
    let earliestT = 1.01;
    let hitType: 'none' | 'wall' | 'tank' | 'destructible' | 'missile' | 'mine' = 'none';
    let hitNx = 0;
    let hitNz = 0;
    let hitTank: TankState | null = null;
    let hitDestructible: DestructibleObj | null = null;
    let hitMissile: ProjectileState | null = null;
    let hitMineIdx = -1;

    // Perimeter walls
    if (nextX < -halfW || nextX > halfW || nextZ < -halfD || nextZ > halfD) {
      let tWall = 1;
      if (nextX < -halfW) {
        tWall = Math.min(tWall, (-halfW - p.x) / (nextX - p.x || -1));
        hitNx = 1;
        hitNz = 0;
      } else if (nextX > halfW) {
        tWall = Math.min(tWall, (halfW - p.x) / (nextX - p.x || 1));
        hitNx = -1;
        hitNz = 0;
      }
      if (nextZ < -halfD) {
        const tz = (-halfD - p.z) / (nextZ - p.z || -1);
        if (tz < tWall) {
          tWall = tz;
          hitNx = 0;
          hitNz = 1;
        }
      } else if (nextZ > halfD) {
        const tz = (halfD - p.z) / (nextZ - p.z || 1);
        if (tz < tWall) {
          tWall = tz;
          hitNx = 0;
          hitNz = -1;
        }
      }
      earliestT = Math.max(0, tWall);
      hitType = 'wall';
    }

    // Map walls
    for (const w of state.map.walls) {
      if (w.destructible && (w.hp ?? 1) <= 0) continue;
      const res = segmentVsAabb(p.x, p.z, nextX, nextZ, w.x, w.z, w.w * 0.5 + p.radius, w.d * 0.5 + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = 'wall';
        hitNx = res.nx;
        hitNz = res.nz;
      }
    }

    // Rocks
    for (const r of state.map.rocks) {
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, r.x, r.z, r.r + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = 'wall';
        hitNx = res.nx;
        hitNz = res.nz;
      }
    }

    // Destructibles
    for (const d of state.destructibles) {
      if (!d.alive) continue;
      const res =
        d.kind === 'crate'
          ? segmentVsAabb(p.x, p.z, nextX, nextZ, d.x, d.z, 0.8 + p.radius, 0.8 + p.radius)
          : segmentVsCircle(p.x, p.z, nextX, nextZ, d.x, d.z, 0.5 + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = 'destructible';
        hitDestructible = d;
        hitNx = res.nx;
        hitNz = res.nz;
      }
    }

    // Edge case 4: Shootable missiles (10 HP)
    for (const otherP of state.projectiles) {
      if (otherP.id === p.id || otherP.hp <= 0 || otherP.hp > 50) continue;
      if (otherP.ownerId === p.ownerId) continue;
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, otherP.x, otherP.z, otherP.radius + p.radius + 0.2);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = 'missile';
        hitMissile = otherP;
      }
    }

    // Shootable mines
    for (let mi = 0; mi < state.mines.length; mi++) {
      const m = state.mines[mi];
      if (m.ownerId === p.ownerId) continue;
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, m.x, m.z, 0.5 + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = 'mine';
        hitMineIdx = mi;
      }
    }

    // Tanks
    const modeMeta = GAME_MODES[state.settings.mode];
    for (const t of state.tanks) {
      if (!t.alive) continue;
      if (t.id === p.ownerId && p.lifetime > p.maxLifetime - 0.12) continue;
      if (modeMeta.isTeam && !state.settings.friendlyFire && t.team === p.ownerTeam && t.id !== p.ownerId) continue;
      const cls = getTankClass(t, state.settings);
      const hitRadius = (cls.width + cls.length) * 0.25 + p.radius;
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, t.x, t.z, hitRadius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = 'tank';
        hitTank = t;
      }
    }

    if (hitType === 'none') {
      p.x = round3(nextX);
      p.z = round3(nextZ);
      if (p.lifetime > 0) {
        remaining.push(p);
      } else if (p.kind === 'guided' || p.kind === 'homing') {
        const owner = state.tanks.find((t) => t.id === p.ownerId);
        if (owner && owner.guidedMissileId === p.id) owner.guidedMissileId = null;
        triggerExplosion(state, p.x, p.z, p.blastRadius, p.damage, p.ownerId, p.kind === 'guided' ? 'Guided Missile' : 'Homing Missile', 'medium', events);
      }
      continue;
    }

    const hitX = round3(p.x + (nextX - p.x) * earliestT);
    const hitZ = round3(p.z + (nextZ - p.z) * earliestT);

    if (hitType === 'wall') {
      if (p.bouncesLeft > 0) {
        p.bouncesLeft -= 1;
        const dot = p.vx * hitNx + p.vz * hitNz;
        p.vx = p.vx - 2 * dot * hitNx;
        p.vz = p.vz - 2 * dot * hitNz;
        p.angle = Math.atan2(p.vx, p.vz);
        p.x = round3(hitX + hitNx * 0.15);
        p.z = round3(hitZ + hitNz * 0.15);
        events.push({ type: 'ricochet', x: hitX, z: hitZ, kind: p.kind === 'bouncing' ? 'bouncing' : 'cannon' });
        if (p.lifetime > 0) remaining.push(p);
      } else {
        if (p.kind === 'guided' || p.kind === 'homing') {
          const owner = state.tanks.find((t) => t.id === p.ownerId);
          if (owner && owner.guidedMissileId === p.id) owner.guidedMissileId = null;
          triggerExplosion(state, hitX, hitZ, p.blastRadius, p.damage, p.ownerId, p.kind === 'guided' ? 'Guided Missile' : 'Homing Missile', 'medium', events);
        } else {
          events.push({ type: 'explosion', x: hitX, z: hitZ, radius: 0.9, kind: 'small' });
        }
      }
    } else if (hitType === 'destructible' && hitDestructible) {
      damageDestructible(state, hitDestructible, p.damage, p.ownerId, events);
      if (p.blastRadius > 0) {
        triggerExplosion(state, hitX, hitZ, p.blastRadius, p.damage, p.ownerId, p.kind, 'medium', events);
      }
    } else if (hitType === 'missile' && hitMissile) {
      hitMissile.hp = 0;
      events.push({ type: 'explosion', x: hitX, z: hitZ, radius: 1.5, kind: 'small' });
      const gmOwner = state.tanks.find((t) => t.guidedMissileId === hitMissile!.id);
      if (gmOwner) gmOwner.guidedMissileId = null;
    } else if (hitType === 'mine' && hitMineIdx >= 0) {
      const m = state.mines[hitMineIdx];
      state.mines.splice(hitMineIdx, 1);
      triggerExplosion(state, m.x, m.z, WEAPONS.mines.blastRadius, WEAPONS.mines.damage, p.ownerId, 'Mines', 'medium', events);
    } else if (hitType === 'tank' && hitTank) {
      const attacker = state.tanks.find((t) => t.id === p.ownerId);
      if (attacker) attacker.shotsHit += 1;
      if (p.kind === 'guided' || p.kind === 'homing') {
        if (attacker && attacker.guidedMissileId === p.id) attacker.guidedMissileId = null;
        triggerExplosion(state, hitX, hitZ, p.blastRadius, p.damage, p.ownerId, p.kind === 'guided' ? 'Guided Missile' : 'Homing Missile', 'medium', events);
      } else {
        applyDamageToTank(state, hitTank, p.damage, p.ownerId, p.x, p.z, p.kind === 'bouncing' ? 'Bouncing Shell' : 'Cannon', events);
        events.push({ type: 'explosion', x: hitX, z: hitZ, radius: 1.0, kind: 'small' });
      }
    }
  }

  state.projectiles = remaining;
}

function stepMines(state: SimState, dt: number, events: SimEvent[]): void {
  const remaining: typeof state.mines = [];
  const modeMeta = GAME_MODES[state.settings.mode];

  for (const m of state.mines) {
    m.age += dt;
    m.lifetime -= dt;
    if (m.lifetime <= 0) continue;
    if (m.armTimer > 0) {
      m.armTimer -= dt;
      remaining.push(m);
      continue;
    }

    let triggered = false;
    for (const t of state.tanks) {
      if (!t.alive) continue;
      // Edge case 14: Mine on teammate no damage in team modes; in FFA hurts everyone including owner
      if (modeMeta.isTeam && t.team === m.ownerTeam) continue;
      if (!modeMeta.isTeam && t.id === m.ownerId && m.age < 2.0) continue;
      const dist = Math.hypot(t.x - m.x, t.z - m.z);
      if (dist <= WEAPON_TUNING.mineTriggerRadius) {
        triggered = true;
        break;
      }
    }

    if (triggered) {
      triggerExplosion(state, m.x, m.z, WEAPONS.mines.blastRadius, WEAPONS.mines.damage, m.ownerId, 'Mines', 'medium', events);
    } else {
      remaining.push(m);
    }
  }
  state.mines = remaining;
}

function stepAirstrikes(state: SimState, dt: number, events: SimEvent[]): void {
  const remaining: typeof state.airstrikes = [];
  for (const as of state.airstrikes) {
    if (as.countdown > 0) {
      as.countdown -= dt;
      remaining.push(as);
      continue;
    }
    as.nextDropTimer -= dt;
    if (as.nextDropTimer <= 0) {
      const offset = (as.strikesDropped - 1) * WEAPON_TUNING.airstrikeSpacing;
      const sx = round3(as.x + as.dirX * offset);
      const sz = round3(as.z + as.dirZ * offset);
      triggerExplosion(state, sx, sz, WEAPONS.airstrike.blastRadius, WEAPONS.airstrike.damage, as.ownerId, 'Airstrike', 'large', events);
      as.strikesDropped += 1;
      as.nextDropTimer = WEAPON_TUNING.airstrikeInterval;
    }
    if (as.strikesDropped < WEAPON_TUNING.airstrikeCount) {
      remaining.push(as);
    }
  }
  state.airstrikes = remaining;
}

function stepPowerBoxes(state: SimState, dt: number, events: SimEvent[]): void {
  for (let bIdx = 0; bIdx < state.powerBoxes.length; bIdx++) {
    const box = state.powerBoxes[bIdx];
    if (!box.active) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.active = true;
        box.itemId = pickWeightedPowerBoxItem(state.seed, state.tick * 31 + bIdx, state.settings.mode);
        events.push({ type: 'box_respawn', boxId: box.id, x: box.x, z: box.z });
      }
      continue;
    }

    // Edge case 6 & 7: Only alive tanks; lowest server-side distance wins (tie-break: earliest seq)
    let winner: TankState | null = null;
    let bestDist = POWER_BOX_CONFIG.pickupRadius;
    for (const t of state.tanks) {
      if (!t.alive || t.disconnected) continue;
      const dist = Math.hypot(t.x - box.x, t.z - box.z);
      if (dist <= bestDist) {
        if (
          !winner ||
          dist < bestDist - 0.001 ||
          (Math.abs(dist - bestDist) <= 0.001 && t.lastProcessedSeq < winner.lastProcessedSeq)
        ) {
          bestDist = dist;
          winner = t;
        }
      }
    }

    if (winner) {
      box.active = false;
      box.respawnTimer = POWER_BOX_CONFIG.respawnSec;
      winner.powerUpsCollected += 1;
      const def = POWER_BOX_ITEMS.find((i) => i.id === box.itemId)!;
      let replacedWeapon = false;

      if (def.kind === 'timed') {
        const timedId = def.id as TimedBuffId;
        if (timedId === 'repair') {
          winner.hp = Math.min(winner.maxHp, winner.hp + 40);
        } else {
          if (timedId === 'shield') {
            winner.shieldHp = POWER_BOX_CONFIG.shieldAbsorb;
          } else if (timedId === 'speed_boost') {
            winner.turboStamina = 1;
            winner.turboLockout = false;
          }
          const existing = winner.buffs.find((b) => b.id === timedId);
          if (existing) {
            existing.remaining = def.duration;
            existing.duration = def.duration;
          } else {
            winner.buffs.push({ id: timedId, remaining: def.duration, duration: def.duration });
          }
        }
      } else {
        const wId = def.id as StoredWeaponId;
        replacedWeapon = winner.storedWeapon !== null;
        winner.storedWeapon = wId;
        winner.storedAmmo = WEAPONS[wId].uses;
      }

      events.push({
        type: 'pickup',
        tankId: winner.id,
        boxId: box.id,
        itemId: box.itemId,
        replacedWeapon,
        x: box.x,
        z: box.z,
      });
    }
  }
}

function stepFlags(state: SimState, dt: number, events: SimEvent[]): void {
  if (!state.flags) return;

  const flags = [state.flags.red, state.flags.blue];
  for (const flag of flags) {
    if (flag.carrierId) {
      const carrier = state.tanks.find((t) => t.id === flag.carrierId);
      if (!carrier || !carrier.alive || carrier.disconnected) {
        flag.carrierId = null;
        flag.atHome = false;
        flag.droppedTimer = PHYSICS.ctfFlagReturnSec;
        events.push({ type: 'flag_event', action: 'dropped', team: flag.team, x: flag.x, z: flag.z });
      } else {
        flag.x = carrier.x;
        flag.z = carrier.z;
        // Check capture at carrier's home base
        const ownFlag = carrier.team === 'red' ? state.flags.red : state.flags.blue;
        const distHome = Math.hypot(carrier.x - ownFlag.homeX, carrier.z - ownFlag.homeZ);
        if (distHome <= PHYSICS.ctfCaptureRadius) {
          if (ownFlag.atHome) {
            // Capture!
            carrier.flagCaptures += 1;
            if (carrier.team === 'red') state.teamScores.red += 1;
            else state.teamScores.blue += 1;

            flag.carrierId = null;
            flag.x = flag.homeX;
            flag.z = flag.homeZ;
            flag.atHome = true;
            flag.droppedTimer = 0;

            events.push({
              type: 'flag_event',
              action: 'captured',
              team: flag.team,
              byName: carrier.name,
              x: ownFlag.homeX,
              z: ownFlag.homeZ,
            });
          } else if (state.tick % 45 === 0) {
            // Edge case 10: Your flag is stolen -> cannot score
            events.push({ type: 'announcement', text: 'Your flag is taken! Recover it first!', tone: 'danger' });
          }
        }
      }
      continue;
    }

    // Dropped flag countdown
    if (!flag.atHome) {
      flag.droppedTimer -= dt;
      if (flag.droppedTimer <= 0) {
        flag.x = flag.homeX;
        flag.z = flag.homeZ;
        flag.atHome = true;
        flag.droppedTimer = 0;
        events.push({ type: 'flag_event', action: 'returned', team: flag.team, x: flag.x, z: flag.z });
        continue;
      }
    }

    // Tank touches flag
    for (const t of state.tanks) {
      if (!t.alive || t.disconnected) continue;
      const dist = Math.hypot(t.x - flag.x, t.z - flag.z);
      if (dist <= 2.4) {
        if (t.team === flag.team && !flag.atHome) {
          // Own team returns dropped flag instantly
          flag.x = flag.homeX;
          flag.z = flag.homeZ;
          flag.atHome = true;
          flag.droppedTimer = 0;
          events.push({ type: 'flag_event', action: 'returned', team: flag.team, byName: t.name, x: flag.x, z: flag.z });
          break;
        } else if (t.team !== flag.team) {
          // Enemy picks up flag
          flag.carrierId = t.id;
          flag.atHome = false;
          flag.droppedTimer = 0;
          events.push({ type: 'flag_event', action: 'taken', team: flag.team, byName: t.name, x: flag.x, z: flag.z });
          break;
        }
      }
    }
  }
}

function stepModes(state: SimState, dt: number, events: SimEvent[]): void {
  // Match timer
  const prevTime = state.timeRemainingSec;
  state.timeRemainingSec = Math.max(0, state.timeRemainingSec - dt);
  if (prevTime > 30 && state.timeRemainingSec <= 30 && !state.suddenDeath) {
    events.push({ type: 'announcement', text: 'Last 30 seconds!', tone: 'gold' });
  }

  // Safe zone shrinking (LTS or toggle in FFA/TDM)
  if (state.safeZone.enabled) {
    const elapsed =
      state.settings.mode === 'lts'
        ? state.settings.timeLimitSec - state.timeRemainingSec
        : state.settings.timeLimitSec - state.timeRemainingSec;
    const shrinkEnd = state.settings.timeLimitSec * PHYSICS.safeZoneEndRatio;
    if (elapsed >= PHYSICS.safeZoneStartSec) {
      if (!state.safeZone.shrinking) {
        state.safeZone.shrinking = true;
        events.push({ type: 'announcement', text: 'Zone shrinking!', tone: 'danger' });
      }
      const span = Math.max(10, shrinkEnd - PHYSICS.safeZoneStartSec);
      const t = Math.min(1, (elapsed - PHYSICS.safeZoneStartSec) / span);
      state.safeZone.currentRadius = round3(
        state.safeZone.initialRadius + (state.safeZone.finalRadius - state.safeZone.initialRadius) * t
      );
    }

    // Damage outside safe zone (bypasses shield per Edge case 13)
    if (state.tick % 15 === 0) {
      const tickDmg = PHYSICS.safeZoneDps * 0.5;
      for (const t of state.tanks) {
        if (!t.alive) continue;
        const dist = Math.hypot(t.x - state.safeZone.x, t.z - state.safeZone.z);
        if (dist > state.safeZone.currentRadius) {
          applyDamageToTank(state, t, tickDmg, null, state.safeZone.x, state.safeZone.z, 'Safe Zone', events, true);
        }
      }
    }
  }

  // King of the Hill
  if (state.hill && state.settings.mode === 'koth') {
    state.hill.moveTimer -= dt;
    if (state.hill.moveTimer <= 0 && state.map.hillSpots.length > 0) {
      state.hill.activeIndex = state.hill.nextIndex;
      state.hill.nextIndex = (state.hill.activeIndex + 1) % state.map.hillSpots.length;
      const spot = state.map.hillSpots[state.hill.activeIndex];
      const nextSpot = state.map.hillSpots[state.hill.nextIndex];
      state.hill.x = spot.x;
      state.hill.z = spot.z;
      state.hill.r = spot.r;
      state.hill.nextX = nextSpot.x;
      state.hill.nextZ = nextSpot.z;
      state.hill.moveTimer = PHYSICS.kothMoveIntervalSec;
      events.push({ type: 'hill_moved', x: spot.x, z: spot.z });
    }

    // Check who is inside the hill (dead tanks excluded, EMP tanks count normally per Edge case 12)
    const inside = state.tanks.filter(
      (t) => t.alive && Math.hypot(t.x - state.hill!.x, t.z - state.hill!.z) <= state.hill!.r
    );
    const hasRed = inside.some((t) => t.team === 'red');
    const hasBlue = inside.some((t) => t.team === 'blue');
    if (hasRed && hasBlue) {
      state.hill.holderTeam = 'contested';
      state.hill.holderPlayerId = null;
    } else if (hasRed) {
      state.hill.holderTeam = 'red';
      if (state.tick % PHYSICS.simHz === 0) {
        state.teamScores.red += 1;
        inside.forEach((t) => (t.hillSeconds += 1));
      }
    } else if (hasBlue) {
      state.hill.holderTeam = 'blue';
      if (state.tick % PHYSICS.simHz === 0) {
        state.teamScores.blue += 1;
        inside.forEach((t) => (t.hillSeconds += 1));
      }
    } else {
      state.hill.holderTeam = 'none';
      state.hill.holderPlayerId = null;
    }
  }

  // Check score limit win conditions
  const limit = state.settings.scoreLimit;
  if (state.settings.mode === 'ffa') {
    const leader = state.tanks.find((t) => t.kills >= limit);
    if (leader) {
      finishMatch(state, leader.id, null, `${leader.name} reached ${limit} kills!`);
      return;
    }
  } else if (state.settings.mode === 'tdm' || state.settings.mode === 'ctf' || state.settings.mode === 'koth') {
    if (state.teamScores.red >= limit) {
      finishMatch(state, null, 'red', `Red Team reached ${limit}!`);
      return;
    }
    if (state.teamScores.blue >= limit) {
      finishMatch(state, null, 'blue', `Blue Team reached ${limit}!`);
      return;
    }
  } else if (state.settings.mode === 'lts') {
    const aliveTanks = state.tanks.filter((t) => t.alive && !t.disconnected);
    if (state.tanks.length >= 2 && aliveTanks.length <= 1) {
      if (aliveTanks.length === 1) {
        const winner = aliveTanks[0];
        state.roundWins[winner.id] = (state.roundWins[winner.id] ?? 0) + 1;
        events.push({ type: 'round_end', winnerId: winner.id, draw: false, roundNumber: state.roundNumber });
        if (state.roundWins[winner.id] >= limit) {
          finishMatch(state, winner.id, null, `${winner.name} won ${limit} rounds!`);
          return;
        }
      } else {
        // Edge case 1: Mutual kill leaving no survivor -> draw & replay (max 2 replays, then credit top killers)
        state.roundDraws += 1;
        events.push({ type: 'round_end', winnerId: null, draw: true, roundNumber: state.roundNumber });
        if (state.roundDraws > 2) {
          // Credit all players with round point on 3rd draw
          for (const t of state.tanks) {
            state.roundWins[t.id] = (state.roundWins[t.id] ?? 0) + 1;
            if (state.roundWins[t.id] >= limit) {
              finishMatch(state, t.id, null, `${t.name} won by round tiebreaker!`);
              return;
            }
          }
        }
      }
      state.roundOverTimer = 3.0;
      return;
    }
  }

  // Time up -> check tie -> sudden death (Edge case 33)
  if (state.timeRemainingSec <= 0) {
    if (!state.suddenDeath) {
      if (state.settings.mode === 'ffa') {
        const sorted = [...state.tanks].sort((a, b) => b.kills - a.kills);
        if (sorted.length >= 2 && sorted[0].kills === sorted[1].kills) {
          state.suddenDeath = true;
          state.timeRemainingSec = PHYSICS.suddenDeathMaxSec;
          events.push({ type: 'announcement', text: 'SUDDEN DEATH! Next kill wins!', tone: 'danger' });
          return;
        }
        const top = sorted[0];
        finishMatch(state, top?.id ?? null, null, 'Time expired!');
      } else if (state.settings.mode === 'lts') {
        // LTS round timeout -> most HP wins round
        const alive = [...state.tanks].filter((t) => t.alive).sort((a, b) => b.hp - a.hp);
        if (alive.length >= 1) {
          state.roundWins[alive[0].id] = (state.roundWins[alive[0].id] ?? 0) + 1;
          if (state.roundWins[alive[0].id] >= limit) {
            finishMatch(state, alive[0].id, null, `${alive[0].name} won the round!`);
            return;
          }
        }
        state.roundOverTimer = 2.5;
      } else {
        if (state.teamScores.red === state.teamScores.blue) {
          state.suddenDeath = true;
          state.timeRemainingSec = PHYSICS.suddenDeathMaxSec;
          events.push({ type: 'announcement', text: 'SUDDEN DEATH! Next point wins!', tone: 'danger' });
          return;
        }
        const winTeam: TeamId = state.teamScores.red > state.teamScores.blue ? 'red' : 'blue';
        finishMatch(state, null, winTeam, `${winTeam === 'red' ? 'Red' : 'Blue'} Team wins on time!`);
      }
    } else {
      // Sudden death expired -> draw
      finishMatch(state, null, null, 'Draw! Sudden death expired.');
    }
  }
}

function startNextLtsRound(state: SimState, events: SimEvent[]): void {
  state.roundNumber += 1;
  state.projectiles = [];
  state.mines = [];
  state.airstrikes = [];
  state.timeRemainingSec = state.settings.timeLimitSec;
  const initRadius = Math.hypot(state.map.width * 0.5, state.map.depth * 0.5);
  state.safeZone.currentRadius = initRadius;
  state.safeZone.shrinking = false;

  for (const t of state.tanks) {
    if (t.disconnected) continue;
    const sp = selectSafeSpawn(state.map, state.tanks, t.team, t.lastSpawnIndex, state.seed, state.tick + state.roundNumber);
    t.x = sp.x;
    t.z = sp.z;
    t.vx = 0;
    t.vz = 0;
    t.hullAngle = sp.angle;
    t.turretAngle = sp.angle;
    t.lastSpawnIndex = sp.idx;
    t.hp = t.maxHp;
    t.alive = true;
    t.spawnShieldTimer = PHYSICS.spawnShieldDuration;
    t.reloadTimer = 0;
    t.turboStamina = 1;
    t.storedWeapon = null;
    t.storedAmmo = 0;
    t.buffs = [];
    t.shieldHp = 0;
  }
  events.push({ type: 'announcement', text: `Round ${state.roundNumber}!`, tone: 'gold' });
}

export function finishMatch(
  state: SimState,
  winnerId: string | null,
  winnerTeam: TeamId | null,
  reason: string
): void {
  state.matchEnded = true;
  state.winnerId = winnerId;
  state.winnerTeam = winnerTeam;
  state.winnerReason = reason;
}

export function buildMatchResultSummary(state: SimState): MatchResultSummary {
  const sortedPlayers = [...state.tanks].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (a.deaths !== b.deaths) return a.deaths - b.deaths;
    if (b.damageDealt !== a.damageDealt) return b.damageDealt - a.damageDealt;
    return a.name.localeCompare(b.name);
  });

  const winnerTank = state.winnerId ? state.tanks.find((t) => t.id === state.winnerId) : sortedPlayers[0];
  let winnerName = 'Draw';
  if (state.winnerTeam === 'red') winnerName = 'Red Team';
  else if (state.winnerTeam === 'blue') winnerName = 'Blue Team';
  else if (winnerTank && state.winnerId) winnerName = winnerTank.name;
  else if (sortedPlayers[0] && state.winnerReason !== 'Draw! Sudden death expired.') winnerName = sortedPlayers[0].name;

  const players = sortedPlayers.map((t) => ({
    id: t.id,
    name: t.name,
    isBot: t.isBot,
    team: t.team,
    custom: t.custom,
    kills: t.kills,
    deaths: t.deaths,
    assists: t.assists,
    damageDealt: Math.round(t.damageDealt),
    accuracy: t.shotsFired > 0 ? Math.round((t.shotsHit / t.shotsFired) * 100) : 0,
    powerUpsCollected: t.powerUpsCollected,
    bestStreak: t.bestStreak,
    flagCaptures: t.flagCaptures,
    hillSeconds: t.hillSeconds,
    leftEarly: t.disconnected,
  }));

  const awards: MatchAward[] = [];
  const withShots = players.filter((p) => p.kills > 0 || p.accuracy > 0);
  if (withShots.length > 0) {
    const sharp = [...withShots].sort((a, b) => b.accuracy - a.accuracy)[0];
    awards.push({ id: 'sharpshooter', title: 'Sharpshooter', subtitle: 'Highest accuracy', playerId: sharp.id, playerName: sharp.name, valueText: `${sharp.accuracy}%` });
  }
  if (players.length > 0) {
    const buster = [...players].sort((a, b) => b.damageDealt - a.damageDealt)[0];
    if (buster.damageDealt > 0) {
      awards.push({ id: 'tank_buster', title: 'Tank Buster', subtitle: 'Most damage dealt', playerId: buster.id, playerName: buster.name, valueText: `${buster.damageDealt}` });
    }
    const survivor = [...players].sort((a, b) => a.deaths - b.deaths || b.kills - a.kills)[0];
    awards.push({ id: 'survivor', title: 'Survivor', subtitle: 'Fewest deaths', playerId: survivor.id, playerName: survivor.name, valueText: `${survivor.deaths} deaths` });

    const collector = [...players].sort((a, b) => b.powerUpsCollected - a.powerUpsCollected)[0];
    if (collector.powerUpsCollected > 0) {
      awards.push({ id: 'collector', title: 'Collector', subtitle: 'Most Power Boxes', playerId: collector.id, playerName: collector.name, valueText: `${collector.powerUpsCollected}` });
    }
    const flagHero = [...players].sort((a, b) => b.flagCaptures - a.flagCaptures)[0];
    if (flagHero.flagCaptures > 0) {
      awards.push({ id: 'flag_hero', title: 'Flag Hero', subtitle: 'Most flag captures', playerId: flagHero.id, playerName: flagHero.name, valueText: `${flagHero.flagCaptures}` });
    }
    const hillKing = [...players].sort((a, b) => b.hillSeconds - a.hillSeconds)[0];
    if (hillKing.hillSeconds > 0) {
      awards.push({ id: 'hill_king', title: 'Hill King', subtitle: 'Most hill time', playerId: hillKing.id, playerName: hillKing.name, valueText: `${hillKing.hillSeconds}s` });
    }
  }

  return {
    winnerId: state.winnerId,
    winnerName,
    winnerTeam: state.winnerTeam,
    reason: state.winnerReason,
    mode: state.settings.mode,
    mapId: state.settings.mapId,
    durationSec: Math.round(state.tick * PHYSICS.fixedDt),
    players,
    awards: awards.slice(0, 6),
  };
}
