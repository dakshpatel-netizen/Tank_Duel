import { BOT_CONFIG, PHYSICS, type BotDifficulty } from './config';
import { angleDiff, getTankClass, seededRand } from './sim';
import type { MapDefinition, PlayerInput, SimState, TankState } from './types';

export interface BotMemory {
  patrolX: number;
  patrolZ: number;
  patrolTimer: number;
  strafeSign: number;
  strafeTimer: number;
  reactionTimer: number;
  seq: number;
}

function isPointBlocked(map: MapDefinition, x: number, z: number): boolean {
  const halfW = map.width * 0.5 - 2.5;
  const halfD = map.depth * 0.5 - 2.5;
  if (Math.abs(x) > halfW || Math.abs(z) > halfD) return true;
  for (const w of map.walls) {
    if (Math.abs(x - w.x) < w.w * 0.5 + 1.4 && Math.abs(z - w.z) < w.d * 0.5 + 1.4) return true;
  }
  for (const r of map.rocks) {
    const dx = x - r.x;
    const dz = z - r.z;
    if (dx * dx + dz * dz < (r.r + 1.4) * (r.r + 1.4)) return true;
  }
  return false;
}

function hasLineOfSight(map: MapDefinition, x1: number, z1: number, x2: number, z2: number): boolean {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(2, Math.ceil(dist / 3.0));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    for (const w of map.walls) {
      if (Math.abs(px - w.x) < w.w * 0.5 && Math.abs(pz - w.z) < w.d * 0.5) return false;
    }
    for (const r of map.rocks) {
      const dx = px - r.x;
      const dz = pz - r.z;
      if (dx * dx + dz * dz < r.r * r.r) return false;
    }
  }
  return true;
}

export function computeBotInput(
  state: SimState,
  bot: TankState,
  memory: BotMemory,
  difficulty: BotDifficulty
): PlayerInput {
  const dt = PHYSICS.fixedDt;
  const cfg = BOT_CONFIG[difficulty];
  memory.seq += 1;
  memory.patrolTimer -= dt;
  memory.strafeTimer -= dt;
  memory.reactionTimer -= dt;

  if (memory.strafeTimer <= 0) {
    memory.strafeSign = seededRand(state.seed, state.tick + bot.name.length) > 0.5 ? 1 : -1;
    memory.strafeTimer = 1.6 + seededRand(state.seed, state.tick + 11) * 1.4;
  }

  // Find nearest enemy
  let nearestEnemy: TankState | null = null;
  let nearestDist = Infinity;
  let visibleEnemy: TankState | null = null;
  let visibleDist = Infinity;

  for (const other of state.tanks) {
    if (!other.alive || other.id === bot.id) continue;
    if (bot.team !== 'none' && other.team === bot.team) continue;
    const d = Math.hypot(other.x - bot.x, other.z - bot.z);
    if (d < nearestDist) {
      nearestDist = d;
      nearestEnemy = other;
    }
    if (d < 85 && d < visibleDist && hasLineOfSight(state.map, bot.x, bot.z, other.x, other.z)) {
      visibleDist = d;
      visibleEnemy = other;
    }
  }

  // Objective navigation priority
  let goalX = memory.patrolX;
  let goalZ = memory.patrolZ;
  let urgentObjective = false;

  // 1. Safe zone priority
  if (state.safeZone.enabled) {
    const distCenter = Math.hypot(bot.x - state.safeZone.x, bot.z - state.safeZone.z);
    if (distCenter > state.safeZone.currentRadius * 0.8) {
      goalX = state.safeZone.x;
      goalZ = state.safeZone.z;
      urgentObjective = true;
    }
  }

  // 2. Low HP -> seek nearest active Power Box (especially Repair Kit)
  if (!urgentObjective && bot.hp < 35 && state.powerBoxes.length > 0) {
    let bestBoxDist = 60;
    for (const box of state.powerBoxes) {
      if (!box.active) continue;
      const d = Math.hypot(box.x - bot.x, box.z - bot.z);
      if (d < bestBoxDist) {
        bestBoxDist = d;
        goalX = box.x;
        goalZ = box.z;
        urgentObjective = true;
      }
    }
  }

  // 3. Mode objectives (CTF / KOTH)
  if (!urgentObjective && state.settings.mode === 'ctf' && state.flags) {
    const ownFlag = bot.team === 'red' ? state.flags.red : state.flags.blue;
    const enemyFlag = bot.team === 'red' ? state.flags.blue : state.flags.red;
    if (enemyFlag.carrierId === bot.id) {
      goalX = ownFlag.homeX;
      goalZ = ownFlag.homeZ;
      urgentObjective = true;
    } else if (!ownFlag.atHome && Math.hypot(ownFlag.x - bot.x, ownFlag.z - bot.z) < 45) {
      goalX = ownFlag.x;
      goalZ = ownFlag.z;
      urgentObjective = true;
    } else {
      goalX = enemyFlag.x;
      goalZ = enemyFlag.z;
      urgentObjective = true;
    }
  } else if (!urgentObjective && state.settings.mode === 'koth' && state.hill) {
    const distHill = Math.hypot(state.hill.x - bot.x, state.hill.z - bot.z);
    if (distHill > state.hill.r * 0.65) {
      goalX = state.hill.x;
      goalZ = state.hill.z;
      urgentObjective = true;
    }
  }

  // 4. Nearby Power Box pickup opportunistically
  if (!urgentObjective) {
    for (const box of state.powerBoxes) {
      if (!box.active) continue;
      const d = Math.hypot(box.x - bot.x, box.z - bot.z);
      if (d < 22) {
        goalX = box.x;
        goalZ = box.z;
        urgentObjective = true;
        break;
      }
    }
  }

  // 5. Combat spacing (20 to 40m) or patrol
  if (!urgentObjective) {
    if (visibleEnemy) {
      if (visibleDist > 36) {
        goalX = visibleEnemy.x;
        goalZ = visibleEnemy.z;
      } else if (visibleDist < 18) {
        goalX = bot.x - (visibleEnemy.x - bot.x);
        goalZ = bot.z - (visibleEnemy.z - bot.z);
      } else {
        // Strafe around target
        const toAng = Math.atan2(visibleEnemy.x - bot.x, visibleEnemy.z - bot.z) + memory.strafeSign * 1.1;
        goalX = bot.x + Math.sin(toAng) * 14;
        goalZ = bot.z + Math.cos(toAng) * 14;
      }
    } else if (memory.patrolTimer <= 0 || Math.hypot(memory.patrolX - bot.x, memory.patrolZ - bot.z) < 6) {
      if (nearestEnemy && seededRand(state.seed, state.tick + memory.seq) > 0.35) {
        memory.patrolX = nearestEnemy.x;
        memory.patrolZ = nearestEnemy.z;
      } else {
        const pad = state.map.pads[Math.floor(seededRand(state.seed, state.tick + 5) * state.map.pads.length)];
        memory.patrolX = pad ? pad.x : 0;
        memory.patrolZ = pad ? pad.z : 0;
      }
      memory.patrolTimer = 4.0;
      goalX = memory.patrolX;
      goalZ = memory.patrolZ;
    }
  }

  // Whisker raycasts for obstacle avoidance
  const desiredHeading = Math.atan2(goalX - bot.x, goalZ - bot.z);
  const whiskerAngles = [0, 0.45, -0.45, 0.9, -0.9];
  let chosenHeading = desiredHeading;
  for (const offset of whiskerAngles) {
    const testAng = desiredHeading + offset;
    const probeX = bot.x + Math.sin(testAng) * 6.0;
    const probeZ = bot.z + Math.cos(testAng) * 6.0;
    if (!isPointBlocked(state.map, probeX, probeZ)) {
      chosenHeading = testAng;
      break;
    }
  }

  const diff = angleDiff(bot.hullAngle, chosenHeading);
  let turn = 0;
  if (Math.abs(diff) > 0.12) {
    // Remember A = turn < 0 increases angle, D = turn > 0 decreases angle
    turn = diff > 0 ? -1 : 1;
  }
  const forward = Math.abs(diff) > 1.8 ? -0.4 : Math.abs(diff) > 1.1 ? 0.35 : 1.0;

  // Aiming + target prediction (plus explosive barrel sniping when enemy is within 6m)
  const target = visibleEnemy ?? nearestEnemy;
  let aimX = bot.x + Math.sin(bot.hullAngle) * 20;
  let aimZ = bot.z + Math.cos(bot.hullAngle) * 20;
  let fire = false;
  let useWeapon = false;
  let dashDir: -1 | 0 | 1 = 0;

  if (target) {
    let aimTargetX = target.x;
    let aimTargetZ = target.z;
    let aimTargetVx = target.vx;
    let aimTargetVz = target.vz;

    if (difficulty !== 'easy') {
      for (const d of state.destructibles) {
        if (!d.alive || d.kind !== 'barrel') continue;
        if (Math.hypot(d.x - target.x, d.z - target.z) < 5.8 && hasLineOfSight(state.map, bot.x, bot.z, d.x, d.z)) {
          aimTargetX = d.x;
          aimTargetZ = d.z;
          aimTargetVx = 0;
          aimTargetVz = 0;
          break;
        }
      }
    }

    const cls = getTankClass(bot, state.settings);
    const travelTime = Math.hypot(aimTargetX - bot.x, aimTargetZ - bot.z) / cls.shellSpeed;
    const predX = aimTargetX + aimTargetVx * travelTime * cfg.leadFactor;
    const predZ = aimTargetZ + aimTargetVz * travelTime * cfg.leadFactor;
    const rawAimAng = Math.atan2(predX - bot.x, predZ - bot.z);
    const jitter = ((seededRand(state.seed, Math.floor(state.tick / 15) + bot.name.length) - 0.5) * 2 * cfg.aimErrorDeg * Math.PI) / 180;
    const finalAimAng = rawAimAng + jitter;
    const aimDist = Math.hypot(predX - bot.x, predZ - bot.z);
    aimX = bot.x + Math.sin(finalAimAng) * aimDist;
    aimZ = bot.z + Math.cos(finalAimAng) * aimDist;

    if (visibleEnemy && memory.reactionTimer <= 0) {
      const aimErr = Math.abs(angleDiff(bot.turretAngle, rawAimAng));
      if (aimErr < 0.22) {
        fire = true;
      }
      if (bot.storedWeapon && bot.storedWeapon !== 'guided') {
        if (bot.storedWeapon === 'emp' && visibleDist < 14) useWeapon = true;
        else if (bot.storedWeapon === 'mines' && visibleDist < 20) useWeapon = true;
        else if (bot.storedWeapon !== 'emp' && bot.storedWeapon !== 'mines' && aimErr < 0.28) useWeapon = true;
      }
      if (
        cls.dashDistance > 0 &&
        bot.dashCooldown <= 0 &&
        visibleDist < 26 &&
        difficulty !== 'easy' &&
        state.tick % 45 === 0
      ) {
        dashDir = memory.strafeSign > 0 ? 1 : -1;
      }
    }
  } else {
    memory.reactionTimer = cfg.reactionSec;
  }

  return {
    seq: memory.seq,
    clientTime: 0,
    forward,
    turn,
    aimX,
    aimZ,
    fire,
    useWeapon,
    turbo: (urgentObjective || (visibleEnemy !== null && visibleDist > 34)) && bot.turboStamina > 0.35,
    handbrake: Math.abs(diff) > 1.35,
    dashDir,
  };
}
