// server.ts
import http from "http";
import path from "path";
import express from "express";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";

// server/roomManager.ts
import crypto from "crypto";

// shared/config.ts
var TANK_CLASSES = {
  scout: {
    id: "scout",
    name: "Scout",
    tagline: "Fast & Agile",
    width: 1.4,
    length: 2.3,
    height: 0.7,
    turretRadius: 0.42,
    barrelLength: 1.35,
    health: 80,
    forwardSpeed: 8.5,
    reverseSpeed: 5,
    accel: 22,
    brake: 32,
    hullTurnStandingDeg: 130,
    hullTurnFullSpeedDeg: 85,
    turretTurnDeg: 300,
    cannonDamage: 24,
    cannonReload: 0.9,
    shellSpeed: 58,
    turboMult: 1.6,
    turboDuration: 3,
    turboRecharge: 5,
    dashDistance: 6,
    dashDuration: 0.25,
    dashCooldown: 4,
    frontArmorReduction: 0,
    frontArmorArcDeg: 0,
    statBars: { speed: 95, armor: 42, firepower: 55, reload: 92, agility: 96 },
    specialText: "Dash: Sideways dodge (Q / E), 6m in 0.25s (4s CD)"
  },
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "Balanced Fighter",
    width: 1.6,
    length: 2.6,
    height: 0.8,
    turretRadius: 0.5,
    barrelLength: 1.6,
    health: 100,
    forwardSpeed: 7,
    reverseSpeed: 4,
    accel: 18,
    brake: 28,
    hullTurnStandingDeg: 110,
    hullTurnFullSpeedDeg: 70,
    turretTurnDeg: 260,
    cannonDamage: 30,
    cannonReload: 1.1,
    shellSpeed: 55,
    turboMult: 1.5,
    turboDuration: 3,
    turboRecharge: 6,
    dashDistance: 0,
    dashDuration: 0,
    dashCooldown: 0,
    frontArmorReduction: 0,
    frontArmorArcDeg: 0,
    statBars: { speed: 72, armor: 65, firepower: 74, reload: 74, agility: 72 },
    specialText: "Versatile all-rounder with balanced speed and punch"
  },
  heavy: {
    id: "heavy",
    name: "Heavy",
    tagline: "Armored Juggernaut",
    width: 1.9,
    length: 3,
    height: 0.9,
    turretRadius: 0.62,
    barrelLength: 1.85,
    health: 150,
    forwardSpeed: 5.5,
    reverseSpeed: 3,
    accel: 14,
    brake: 24,
    hullTurnStandingDeg: 85,
    hullTurnFullSpeedDeg: 55,
    turretTurnDeg: 200,
    cannonDamage: 38,
    cannonReload: 1.5,
    shellSpeed: 50,
    turboMult: 1.35,
    turboDuration: 2.5,
    turboRecharge: 7,
    dashDistance: 0,
    dashDuration: 0,
    dashCooldown: 0,
    frontArmorReduction: 0.15,
    frontArmorArcDeg: 60,
    statBars: { speed: 48, armor: 98, firepower: 95, reload: 50, agility: 48 },
    specialText: "Armor Plating: -15% damage from frontal 60\xB0 arc"
  }
};
var TANK_COLORS = [
  { id: "red", name: "Crimson", hex: "#EF4444" },
  { id: "blue", name: "Cobalt", hex: "#3B82F6" },
  { id: "green", name: "Emerald", hex: "#10B981" },
  { id: "yellow", name: "Solar", hex: "#FACC15" },
  { id: "orange", name: "Blaze", hex: "#F97316" },
  { id: "purple", name: "Violet", hex: "#8B5CF6" },
  { id: "pink", name: "Neon Rose", hex: "#EC4899" },
  { id: "teal", name: "Mint", hex: "#00E5C3" },
  { id: "white", name: "Arctic", hex: "#F1F5F9" },
  { id: "black", name: "Obsidian", hex: "#1E293B" },
  { id: "gold", name: "Royal Gold", hex: "#FFC83D" },
  { id: "camo", name: "Olive Camo", hex: "#65A30D" }
];
var PHYSICS = {
  simHz: 30,
  fixedDt: 1 / 30,
  snapshotHz: 20,
  handbrakeTurnMult: 1.8,
  handbrakeSpeedCapRatio: 0.4,
  iceFriction: 0.15,
  iceTurnDelayFactor: 2.2,
  mudSpeedMult: 0.6,
  speedPadMult: 1.4,
  speedPadDuration: 2,
  tankSeparationSpeed: 4,
  shellRadius: 0.3,
  shellLifetime: 2.2,
  shellMaxRicochets: 1,
  respawnDelay: 3,
  spawnShieldDuration: 2,
  spawnMinEnemyDist: 40,
  spawnMinAnyTankDist: 8,
  assistWindowSec: 5,
  ctfCarrierSpeedMult: 0.85,
  ctfFlagReturnSec: 15,
  ctfCaptureRadius: 5,
  kothMoveIntervalSec: 45,
  kothZoneRadius: 10,
  safeZoneStartSec: 30,
  safeZoneEndRatio: 0.7,
  safeZoneFinalRadius: 20,
  safeZoneDps: 5,
  suddenDeathMaxSec: 60,
  destructionChainRadius: 2,
  destructionChainDamage: 15,
  crateHp: 30,
  barrelHp: 20,
  barrelBlastRadius: 6,
  barrelBlastDamage: 40,
  wallCrackedHp: 60
};
var WEAPONS = {
  homing: {
    id: "homing",
    name: "Homing Missile",
    uses: 1,
    damage: 45,
    blastRadius: 2,
    speed: 32,
    lifetime: 4,
    missileHp: 10,
    description: "Curves toward enemies in a 60\xB0 front cone up to 90m.",
    rarity: "gold"
  },
  cluster: {
    id: "cluster",
    name: "Cluster Missile",
    uses: 1,
    damage: 18,
    blastRadius: 2.5,
    speed: 38,
    lifetime: 2.5,
    missileHp: 10,
    description: "Airbursts at aim pin (max 70m), dropping 5 bomblets in 6m.",
    rarity: "gold"
  },
  guided: {
    id: "guided",
    name: "Guided Missile",
    uses: 1,
    damage: 50,
    blastRadius: 3,
    speed: 28,
    lifetime: 4,
    missileHp: 10,
    description: "Steer directly with mouse for 4s while your tank holds still.",
    rarity: "purple"
  },
  bouncing: {
    id: "bouncing",
    name: "Bouncing Shell",
    uses: 3,
    damage: 35,
    blastRadius: 1.5,
    speed: 48,
    lifetime: 3.2,
    missileHp: 10,
    description: "Heavy incendiary shell that ricochets up to 3 times.",
    rarity: "gold"
  },
  emp: {
    id: "emp",
    name: "EMP Pulse",
    uses: 1,
    damage: 0,
    blastRadius: 15,
    speed: 0,
    lifetime: 0.5,
    missileHp: 999,
    description: "15m blast slows enemies 50%, strips shields, disables weapons 3s.",
    rarity: "gold"
  },
  mines: {
    id: "mines",
    name: "Mines",
    uses: 3,
    damage: 50,
    blastRadius: 3,
    speed: 0,
    lifetime: 45,
    missileHp: 10,
    description: "Drop behind tank. Arms in 1s, cloaks from enemies after 2s.",
    rarity: "gold"
  },
  airstrike: {
    id: "airstrike",
    name: "Airstrike",
    uses: 1,
    damage: 40,
    blastRadius: 4,
    speed: 0,
    lifetime: 1.5,
    missileHp: 999,
    description: "Marks pin; 3 shells rain down in a 5m line after 1.5s.",
    rarity: "purple"
  }
};
var WEAPON_TUNING = {
  homingConeDeg: 60,
  homingRange: 90,
  homingTurnDeg: 80,
  clusterMaxRange: 70,
  clusterBombletCount: 5,
  clusterSpreadRadius: 6,
  clusterDropTime: 0.6,
  guidedTurnDeg: 135,
  bouncingMaxBounces: 3,
  empSlowMult: 0.5,
  empDuration: 3,
  mineArmDelay: 1,
  mineHideDelay: 2,
  mineTriggerRadius: 1.8,
  airstrikeDelay: 1.5,
  airstrikeSpacing: 5,
  airstrikeCount: 3,
  airstrikeInterval: 0.4
};
var POWER_BOX_ITEMS = [
  { id: "repair", kind: "timed", name: "Repair Kit", duration: 0, weight: 18, rarity: "green", summary: "+40 HP instant" },
  { id: "shield", kind: "timed", name: "Shield", duration: 6, weight: 10, rarity: "blue", summary: "50 HP barrier (6s)" },
  { id: "rapid_fire", kind: "timed", name: "Rapid Fire", duration: 8, weight: 10, rarity: "blue", summary: "Reload x0.4 (8s)" },
  { id: "triple_shot", kind: "timed", name: "Triple Shot", duration: 8, weight: 8, rarity: "blue", summary: "3-shell fan (8s)" },
  { id: "speed_boost", kind: "timed", name: "Speed Boost", duration: 6, weight: 8, rarity: "blue", summary: "Speed x1.4 + Turbo (6s)" },
  { id: "damage_up", kind: "timed", name: "Damage Up", duration: 8, weight: 6, rarity: "purple", summary: "Damage x1.6 (8s)" },
  { id: "homing", kind: "stored", name: "Homing Missile", duration: 0, weight: 8, rarity: "gold", summary: "Tracking missile" },
  { id: "cluster", kind: "stored", name: "Cluster Missile", duration: 0, weight: 7, rarity: "gold", summary: "5-bomblet airburst" },
  { id: "guided", kind: "stored", name: "Guided Missile", duration: 0, weight: 4, rarity: "purple", summary: "Mouse-steered missile" },
  { id: "bouncing", kind: "stored", name: "Bouncing Shell", duration: 0, weight: 7, rarity: "gold", summary: "3x ricochet (3 uses)" },
  { id: "emp", kind: "stored", name: "EMP Pulse", duration: 0, weight: 5, rarity: "gold", summary: "15m slow + strip" },
  { id: "mines", kind: "stored", name: "Mines", duration: 0, weight: 5, rarity: "gold", summary: "Stealth mines (3 uses)" },
  { id: "airstrike", kind: "stored", name: "Airstrike", duration: 0, weight: 4, rarity: "purple", summary: "3-blast carpet strike" }
];
var POWER_BOX_CONFIG = {
  respawnSec: 20,
  pickupRadius: 2.2,
  shieldAbsorb: 50,
  rapidFireMult: 0.4,
  tripleShotSpreadDeg: 14,
  speedBoostMult: 1.4,
  damageUpMult: 1.6
};
var GAME_MODES = {
  ffa: {
    id: "ffa",
    name: "Free For All",
    shortName: "FFA",
    isTeam: false,
    defaultTimeSec: 480,
    defaultScoreLimit: 15,
    planLine1: "Every tank fights alone. First to 15 kills or top score wins.",
    planLine2: "Grab Power Boxes, ambush duels, and guard your streaks.",
    tip: "Shoot red explosive barrels when rivals pass nearby.",
    recommendedMaps: ["desert_outpost", "industrial_yard", "frozen_lake", "forest_maze"]
  },
  tdm: {
    id: "tdm",
    name: "Team Deathmatch",
    shortName: "TDM",
    isTeam: true,
    defaultTimeSec: 600,
    defaultScoreLimit: 30,
    planLine1: "Red vs Blue squads. First team to 30 kills wins.",
    planLine2: "Push lanes together and focus fire on weakened targets.",
    tip: "Friendly fire is off by default\u2014use crossfire angles.",
    recommendedMaps: ["industrial_yard", "desert_outpost", "twin_bases"]
  },
  lts: {
    id: "lts",
    name: "Last Tank Standing",
    shortName: "LTS",
    isTeam: false,
    defaultTimeSec: 180,
    defaultScoreLimit: 3,
    // Best of 5 (first to 3 rounds)
    planLine1: "No respawns! Best of 5 rounds\u2014survive as the safe zone shrinks.",
    planLine2: "Play smart cover until the final circle forces a duel.",
    tip: "Shields do not block safe-zone damage\u2014stay inside the ring.",
    recommendedMaps: ["frozen_lake", "forest_maze", "crater_hill"]
  },
  ctf: {
    id: "ctf",
    name: "Capture the Flag",
    shortName: "CTF",
    isTeam: true,
    defaultTimeSec: 720,
    defaultScoreLimit: 3,
    planLine1: "Steal the enemy flag and return it to your base while yours is home.",
    planLine2: "Carriers move 15% slower without turbo\u2014escort your runner.",
    tip: "Touch a dropped teammate flag to return it to base instantly.",
    recommendedMaps: ["twin_bases", "industrial_yard", "desert_outpost"]
  },
  koth: {
    id: "koth",
    name: "King of the Hill",
    shortName: "KOTH",
    isTeam: true,
    defaultTimeSec: 600,
    defaultScoreLimit: 120,
    planLine1: "Hold the glowing hill zone uncontested to earn 1 point per second.",
    planLine2: "The zone moves every 45s\u2014rotate early when the preview ring appears.",
    tip: "A single rival inside the ring halts points for everyone.",
    recommendedMaps: ["crater_hill", "desert_outpost", "frozen_lake"]
  }
};
var MAP_SIZE_SCALES = {
  small: { scale: 0.75, label: "Small", recPlayers: "2\u20134 players" },
  medium: { scale: 1, label: "Medium", recPlayers: "4\u20138 players" },
  large: { scale: 1.4, label: "Large", recPlayers: "8\u201312 players" }
};
var STREAK_BANNERS = {
  3: "Triple!",
  5: "Rampage!",
  7: "Unstoppable!",
  10: "Legend!"
};
var BOT_CONFIG = {
  easy: { reactionSec: 0.6, aimErrorDeg: 12, leadFactor: 0 },
  medium: { reactionSec: 0.35, aimErrorDeg: 6, leadFactor: 0.45 },
  hard: { reactionSec: 0.15, aimErrorDeg: 2, leadFactor: 0.95 }
};
var NETWORK_CONFIG = {
  maxHumans: 10,
  maxTotalTanks: 12,
  maxSpectators: 6,
  roomCodeAlphabet: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  // no I, O, L, 0, 1
  roomCodeLength: 4,
  reconnectGraceSec: 60,
  roomDeleteIdleSec: 60,
  kickBanSec: 60,
  pingIntervalMs: 2e3,
  pingTimeoutMs: 1e4,
  maxLagCompMs: 150,
  interpDelayMs: 100,
  maxExtrapMs: 200,
  reconcileSmoothMs: 100,
  reconcileSnapDist: 2,
  maxMsgsPerSec: 120,
  banMsgsPerSec: 200,
  maxPacketBytes: 4096,
  afkWarnSec: 10,
  afkKickSec: 60,
  neutralInputTimeoutSec: 0.3,
  minFireIntervalClamp: 0.32
  // Rapid fire on Scout = 0.9 * 0.4 = 0.36s
};

// shared/maps/index.ts
function makeDesertOutpost() {
  const walls = [];
  const corners = [
    [35, 35],
    [-35, 35],
    [35, -35],
    [-35, -35]
  ];
  corners.forEach(([cx, cz], idx) => {
    const sx = Math.sign(cx);
    const sz = Math.sign(cz);
    walls.push({
      id: `l_h_${idx}`,
      x: cx - sx * 9,
      z: cz,
      w: 20,
      d: 2,
      h: 3,
      kind: "wall"
    });
    walls.push({
      id: `l_v_${idx}`,
      x: cx,
      z: cz - sz * 9,
      w: 2,
      d: 20,
      h: 3,
      kind: "wall"
    });
  });
  const rocks = [
    { id: "r0", x: 0, z: 0, r: 6, h: 4 },
    { id: "r1", x: 10, z: 6, r: 4, h: 3.2 },
    { id: "r2", x: -9, z: 5, r: 4, h: 3.1 },
    { id: "r3", x: 4, z: -10, r: 5, h: 3.6 },
    { id: "r4", x: -7, z: -9, r: 3.5, h: 2.8 }
  ];
  const crateCenters = [
    [55, 0],
    [-55, 0],
    [0, 55],
    [0, -55],
    [22, -48],
    [-22, 48]
  ];
  const crates = [];
  crateCenters.forEach(([gx, gz], gIdx) => {
    crates.push({ id: `c_${gIdx}_0`, x: gx - 1, z: gz });
    crates.push({ id: `c_${gIdx}_1`, x: gx + 1, z: gz });
    crates.push({ id: `c_${gIdx}_2`, x: gx, z: gz + 1.8 });
  });
  const barrelCoords = [
    [25, 10],
    [25, -10],
    [-25, 10],
    [-25, -10],
    [60, 30],
    [-60, -30],
    [30, 60],
    [-30, -60]
  ];
  const barrels = barrelCoords.map(([x, z], i) => ({ id: `b_${i}`, x, z }));
  const zones = [
    { id: "sp_1", type: "speed_pad", shape: "rect", x: 0, z: 34, w: 5, d: 12, dirX: 0, dirZ: -1 },
    { id: "sp_2", type: "speed_pad", shape: "rect", x: 0, z: -34, w: 5, d: 12, dirX: 0, dirZ: 1 }
  ];
  const spawns = [];
  for (let i = 0; i < 12; i++) {
    const deg = 15 + i * 30;
    const rad = deg * Math.PI / 180;
    const x = Math.cos(rad) * 68;
    const z = Math.sin(rad) * 68;
    const angle = Math.atan2(-x, -z);
    spawns.push({ x, z, angle, team: i % 2 === 0 ? "red" : "blue" });
  }
  const padCoords = [
    [18, 0],
    [-18, 0],
    [0, 18],
    [0, -18],
    [45, 25],
    [-45, -25],
    [25, -45],
    [-25, 45],
    [62, 62],
    [-62, -62]
  ];
  const pads = padCoords.map(([x, z], i) => ({ id: `pad_${i}`, x, z }));
  const hillSpots = [
    { id: "h0", x: 0, z: 0, r: 10 },
    { id: "h1", x: 35, z: 0, r: 10 },
    { id: "h2", x: -35, z: 0, r: 10 },
    { id: "h3", x: 0, z: 35, r: 10 },
    { id: "h4", x: 0, z: -35, r: 10 }
  ];
  const decorations = [
    { kind: "mesa", x: -115, z: -110, scale: 1.5, rot: 0.4 },
    { kind: "mesa", x: 118, z: -105, scale: 1.3, rot: 1.1 },
    { kind: "mesa", x: 112, z: 118, scale: 1.4, rot: 2.3 },
    { kind: "mesa", x: -118, z: 112, scale: 1.2, rot: 0.8 },
    { kind: "cactus", x: -90, z: 24, scale: 1.1, rot: 0.2 },
    { kind: "cactus", x: 92, z: -22, scale: 1, rot: 1.5 },
    { kind: "cactus", x: 20, z: 91, scale: 1.05, rot: 2.1 },
    { kind: "cactus", x: -24, z: -91, scale: 1.15, rot: 0.9 }
  ];
  return {
    id: "desert_outpost",
    name: "Desert Outpost",
    description: "Sun-baked sandstone canyon with L-bunkers, speed strips, and high-risk center rocks.",
    bestFor: "Open fights",
    hazards: ["barrels", "speed_pads"],
    width: 160,
    depth: 160,
    palette: {
      ground: "#D9A566",
      groundAccent: "#C28B4E",
      skyTop: "#2E1E59",
      skyBottom: "#F59E6C",
      fog: "#E4A876",
      sunColor: "#FFD19A",
      wallColor: "#8B6544",
      rockColor: "#9E734E"
    },
    sunElevationDeg: 25,
    walls,
    rocks,
    crates,
    barrels,
    trees: [],
    zones,
    spawns,
    pads,
    hillSpots,
    decorations
  };
}
function makeIndustrialYard() {
  const walls = [];
  const horiz = [
    [-50, -48],
    [-25, -48],
    [25, -48],
    [50, -48],
    [-50, 48],
    [-25, 48],
    [25, 48],
    [50, 48]
  ];
  horiz.forEach(([x, z], i) => {
    walls.push({ id: `ch_${i}`, x, z, w: 12, d: 2.6, h: 2.8, kind: "container" });
  });
  const vert = [
    [-38, -16],
    [-38, 16],
    [38, -16],
    [38, 16],
    [-62, -16],
    [-62, 16],
    [62, -16],
    [62, 16]
  ];
  vert.forEach(([x, z], i) => {
    walls.push({ id: `cv_${i}`, x, z, w: 2.6, d: 12, h: 2.8, kind: "container" });
  });
  walls.push({ id: "cw_0", x: 0, z: 10, w: 10, d: 2, h: 2.4, kind: "wall" });
  walls.push({ id: "cw_1", x: 0, z: -10, w: 10, d: 2, h: 2.4, kind: "wall" });
  walls.push({ id: "cw_2", x: 10, z: 0, w: 2, d: 10, h: 2.4, kind: "wall" });
  walls.push({ id: "cw_3", x: -10, z: 0, w: 2, d: 10, h: 2.4, kind: "wall" });
  const barrelClusters = [
    [38, 8],
    [-38, 8],
    [38, -8],
    [-38, -8],
    [8, 38],
    [-8, 38],
    [8, -38],
    [-8, -38],
    [0, 62],
    [0, -62]
  ];
  const barrels = [];
  barrelClusters.forEach(([bx, bz], i) => {
    barrels.push({ id: `ib_${i}_0`, x: bx, z: bz });
    if (i < 4) barrels.push({ id: `ib_${i}_1`, x: bx + 1.8, z: bz + 1.2 });
  });
  const crateCenters = [
    [70, 0],
    [-70, 0],
    [0, 70],
    [0, -70]
  ];
  const crates = [];
  crateCenters.forEach(([cx, cz], idx) => {
    crates.push({ id: `ic_${idx}_0`, x: cx - 1, z: cz - 1 });
    crates.push({ id: `ic_${idx}_1`, x: cx + 1, z: cz - 1 });
    crates.push({ id: `ic_${idx}_2`, x: cx - 1, z: cz + 1 });
    crates.push({ id: `ic_${idx}_3`, x: cx + 1, z: cz + 1 });
  });
  const spawns = [
    // North edge
    { x: -35, z: -68, angle: 0, team: "red" },
    { x: 0, z: -68, angle: 0, team: "red" },
    { x: 35, z: -68, angle: 0, team: "red" },
    // South edge
    { x: -35, z: 68, angle: Math.PI, team: "blue" },
    { x: 0, z: 68, angle: Math.PI, team: "blue" },
    { x: 35, z: 68, angle: Math.PI, team: "blue" },
    // West edge
    { x: -68, z: -32, angle: Math.PI / 2, team: "red" },
    { x: -68, z: 0, angle: Math.PI / 2, team: "red" },
    { x: -68, z: 32, angle: Math.PI / 2, team: "blue" },
    // East edge
    { x: 68, z: -32, angle: -Math.PI / 2, team: "red" },
    { x: 68, z: 0, angle: -Math.PI / 2, team: "blue" },
    { x: 68, z: 32, angle: -Math.PI / 2, team: "blue" }
  ];
  const padCoords = [
    [20, 32],
    [-20, 32],
    [20, -32],
    [-20, -32],
    [50, 32],
    [-50, 32],
    [50, -32],
    [-50, -32],
    [55, 0],
    [-55, 0],
    [0, 35],
    [0, -35]
  ];
  const pads = padCoords.map(([x, z], i) => ({ id: `ipad_${i}`, x, z }));
  const hillSpots = [
    { id: "ih0", x: 0, z: 0, r: 10 },
    { id: "ih1", x: 0, z: 32, r: 10 },
    { id: "ih2", x: 0, z: -32, r: 10 },
    { id: "ih3", x: 48, z: 0, r: 10 },
    { id: "ih4", x: -48, z: 0, r: 10 }
  ];
  return {
    id: "industrial_yard",
    name: "Industrial Yard",
    description: "Shipping container corridors, loading dock choke points, and ambush sightlines.",
    bestFor: "Close fights",
    hazards: ["barrels"],
    width: 160,
    depth: 160,
    palette: {
      ground: "#647082",
      groundAccent: "#4E5868",
      skyTop: "#26344E",
      skyBottom: "#7E90A8",
      fog: "#7B8A9E",
      sunColor: "#DCE8F5",
      wallColor: "#475569",
      rockColor: "#6B7280"
    },
    sunElevationDeg: 48,
    walls,
    rocks: [],
    crates,
    barrels,
    trees: [],
    zones: [],
    spawns,
    pads,
    hillSpots,
    decorations: [
      { kind: "crane", x: -102, z: -96, scale: 1.2, rot: 0.4 },
      { kind: "crane", x: 104, z: 98, scale: 1.3, rot: 2.4 }
    ]
  };
}
function makeFrozenLake() {
  const zones = [
    { id: "ice_center", type: "ice", shape: "circle", x: 0, z: 0, r: 45 }
  ];
  const rocks = [];
  const gapAngles = /* @__PURE__ */ new Set([0, 60, 120, 180, 240, 300]);
  let rockIdx = 0;
  for (let deg = 0; deg < 360; deg += 18) {
    if (Array.from(gapAngles).some((g) => Math.abs(deg - g) <= 10)) continue;
    if (rockIdx >= 14) break;
    const rad = deg * Math.PI / 180;
    const dist = 52 + (rockIdx % 2 === 0 ? 0 : 4);
    rocks.push({
      id: `fr_${rockIdx}`,
      x: Math.round(Math.cos(rad) * dist * 10) / 10,
      z: Math.round(Math.sin(rad) * dist * 10) / 10,
      r: rockIdx % 3 === 0 ? 4.5 : 3.5,
      h: 3.2
    });
    rockIdx++;
  }
  const iceBlockCoords = [
    [12, 12],
    [-12, 12],
    [12, -12],
    [-12, -12],
    [25, 0],
    [-25, 0]
  ];
  const walls = iceBlockCoords.map(([x, z], i) => ({
    id: `ice_blk_${i}`,
    x,
    z,
    w: 4,
    d: 4,
    h: 2.6,
    kind: "wall"
  }));
  const barrels = [];
  for (let i = 0; i < 6; i++) {
    const rad = (i * 60 + 30) * Math.PI / 180;
    barrels.push({
      id: `fb_${i}`,
      x: Math.round(Math.cos(rad) * 60 * 10) / 10,
      z: Math.round(Math.sin(rad) * 60 * 10) / 10
    });
  }
  const spawns = [];
  for (let i = 0; i < 12; i++) {
    const rad = i * 30 * Math.PI / 180;
    const x = Math.cos(rad) * 68;
    const z = Math.sin(rad) * 68;
    spawns.push({ x, z, angle: Math.atan2(-x, -z), team: i % 2 === 0 ? "red" : "blue" });
  }
  const pads = [
    { id: "fp_0", x: 14, z: 0 },
    { id: "fp_1", x: -14, z: 0 },
    { id: "fp_2", x: 0, z: 14 },
    { id: "fp_3", x: 0, z: -14 },
    { id: "fp_4", x: 58, z: 22 },
    { id: "fp_5", x: -58, z: 22 },
    { id: "fp_6", x: 58, z: -22 },
    { id: "fp_7", x: -58, z: -22 },
    { id: "fp_8", x: 0, z: 62 },
    { id: "fp_9", x: 0, z: -62 }
  ];
  const hillSpots = [
    { id: "fh0", x: 0, z: 0, r: 10 },
    { id: "fh1", x: 24, z: 24, r: 10 },
    { id: "fh2", x: -24, z: -24, r: 10 },
    { id: "fh3", x: 0, z: 60, r: 10 },
    { id: "fh4", x: 0, z: -60, r: 10 }
  ];
  return {
    id: "frozen_lake",
    name: "Frozen Lake",
    description: "Slick drifting ice arena encircled by snowdrifts, glacial cover blocks, and rocky shore.",
    bestFor: "Drift duels",
    hazards: ["ice", "barrels"],
    width: 160,
    depth: 160,
    palette: {
      ground: "#DCEAF7",
      groundAccent: "#BBD6F2",
      skyTop: "#0F2547",
      skyBottom: "#7CD4E8",
      fog: "#CFE4F7",
      sunColor: "#E8F6FF",
      wallColor: "#7CC6EB",
      rockColor: "#69839E"
    },
    sunElevationDeg: 35,
    walls,
    rocks,
    crates: [
      { id: "fc_0", x: 38, z: 38 },
      { id: "fc_1", x: -38, z: -38 },
      { id: "fc_2", x: 38, z: -38 },
      { id: "fc_3", x: -38, z: 38 }
    ],
    barrels,
    trees: [],
    zones,
    spawns,
    pads,
    hillSpots,
    decorations: []
  };
}
function makeForestMaze() {
  const walls = [
    // 8 axial walls
    { id: "mh_0", x: 30, z: 16, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mh_1", x: -30, z: 16, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mh_2", x: 30, z: -16, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mh_3", x: -30, z: -16, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mv_0", x: 16, z: 30, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mv_1", x: -16, z: 30, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mv_2", x: 16, z: -30, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mv_3", x: -16, z: -30, w: 2, d: 24, h: 3, kind: "hedge" },
    // 10 outer lane walls
    { id: "mo_0", x: 60, z: 24, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mo_1", x: -60, z: 24, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mo_2", x: 60, z: -24, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mo_3", x: -60, z: -24, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mo_4", x: 24, z: 60, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mo_5", x: -24, z: 60, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mo_6", x: 24, z: -60, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mo_7", x: -24, z: -60, w: 2, d: 24, h: 3, kind: "hedge" },
    { id: "mo_8", x: 0, z: 46, w: 24, d: 2, h: 3, kind: "hedge" },
    { id: "mo_9", x: 0, z: -46, w: 24, d: 2, h: 3, kind: "hedge" }
  ];
  const mudCoords = [
    [30, 0],
    [-30, 0],
    [0, 30],
    [0, -30],
    [55, 55],
    [-55, -55]
  ];
  const zones = mudCoords.map(([x, z], i) => ({
    id: `mud_${i}`,
    type: "mud",
    shape: "circle",
    x,
    z,
    r: 9
  }));
  const trees = [];
  for (let i = 0; i < 40; i++) {
    const angle = i / 40 * Math.PI * 2;
    const ring = i % 2 === 0 ? 69 : 50;
    const tx = Math.round(Math.cos(angle) * ring * 10) / 10;
    const tz = Math.round(Math.sin(angle) * ring * 10) / 10;
    trees.push({ id: `tr_${i}`, x: tx, z: tz, r: 0.8, h: 4.5 + i % 3 * 0.8 });
  }
  const barrels = [
    { id: "fb0", x: 34, z: 34 },
    { id: "fb1", x: -34, z: 34 },
    { id: "fb2", x: 34, z: -34 },
    { id: "fb3", x: -34, z: -34 },
    { id: "fb4", x: 46, z: 46 },
    { id: "fb5", x: -46, z: 46 },
    { id: "fb6", x: 46, z: -46 },
    { id: "fb7", x: -46, z: -46 }
  ];
  const crates = [
    { id: "mc0", x: 8, z: 0 },
    { id: "mc1", x: -8, z: 0 },
    { id: "mc2", x: 0, z: 8 },
    { id: "mc3", x: 0, z: -8 },
    { id: "mc4", x: 48, z: 0 },
    { id: "mc5", x: -48, z: 0 },
    { id: "mc6", x: 0, z: 64 },
    { id: "mc7", x: 0, z: -64 },
    { id: "mc8", x: 64, z: 40 },
    { id: "mc9", x: -64, z: -40 }
  ];
  const spawns = [
    { x: 40, z: 40, angle: -Math.PI * 0.75, team: "blue" },
    { x: -40, z: 40, angle: Math.PI * 0.75, team: "red" },
    { x: 40, z: -40, angle: -Math.PI * 0.25, team: "blue" },
    { x: -40, z: -40, angle: Math.PI * 0.25, team: "red" },
    { x: 70, z: 0, angle: -Math.PI / 2, team: "blue" },
    { x: -70, z: 0, angle: Math.PI / 2, team: "red" },
    { x: 0, z: 70, angle: Math.PI, team: "blue" },
    { x: 0, z: -70, angle: 0, team: "red" },
    { x: 70, z: 50, angle: -Math.PI / 2, team: "blue" },
    { x: -70, z: 50, angle: Math.PI / 2, team: "red" },
    { x: 70, z: -50, angle: -Math.PI / 2, team: "blue" },
    { x: -70, z: -50, angle: Math.PI / 2, team: "red" }
  ];
  const pads = [
    { id: "mp0", x: 40, z: 40 },
    { id: "mp1", x: -40, z: 40 },
    { id: "mp2", x: 40, z: -40 },
    { id: "mp3", x: -40, z: -40 },
    { id: "mp4", x: 24, z: 0 },
    { id: "mp5", x: -24, z: 0 },
    { id: "mp6", x: 0, z: 24 },
    { id: "mp7", x: 0, z: -24 },
    { id: "mp8", x: 64, z: 12 },
    { id: "mp9", x: -64, z: 12 },
    { id: "mp10", x: 64, z: -12 },
    { id: "mp11", x: -64, z: -12 }
  ];
  const hillSpots = [
    { id: "mh0", x: 0, z: 0, r: 10 },
    { id: "mh1", x: 40, z: 40, r: 10 },
    { id: "mh2", x: -40, z: 40, r: 10 },
    { id: "mh3", x: 40, z: -40, r: 10 },
    { id: "mh4", x: -40, z: -40, r: 10 }
  ];
  return {
    id: "forest_maze",
    name: "Forest Maze",
    description: "Tall hedge lanes, boggy mud traps, and pine clearings built for ambush play.",
    bestFor: "Stealth ambush",
    hazards: ["mud", "barrels"],
    width: 160,
    depth: 160,
    palette: {
      ground: "#4C7C46",
      groundAccent: "#3C6637",
      skyTop: "#1F3A3D",
      skyBottom: "#88C48E",
      fog: "#74A97E",
      sunColor: "#FFF3C4",
      wallColor: "#2E5931",
      rockColor: "#6E7A6A"
    },
    sunElevationDeg: 40,
    walls,
    rocks: [],
    crates,
    barrels,
    trees,
    zones,
    spawns,
    pads,
    hillSpots,
    decorations: []
  };
}
function makeTwinBases() {
  const walls = [
    // Red base U-wall behind flag (-85, 0)
    { id: "ru_back", x: -91, z: 0, w: 2, d: 14, h: 3, kind: "wall" },
    { id: "ru_top", x: -85, z: -7, w: 12, d: 2, h: 3, kind: "wall" },
    { id: "ru_bot", x: -85, z: 7, w: 12, d: 2, h: 3, kind: "wall" },
    // Blue base U-wall behind flag (+85, 0)
    { id: "bu_back", x: 91, z: 0, w: 2, d: 14, h: 3, kind: "wall" },
    { id: "bu_top", x: 85, z: -7, w: 12, d: 2, h: 3, kind: "wall" },
    { id: "bu_bot", x: 85, z: 7, w: 12, d: 2, h: 3, kind: "wall" },
    // Center ridge wall along x=0 with 3 gaps (14m wide) at z=-35, 0, 35
    { id: "cr_0", x: 0, z: -51, w: 2, d: 18, h: 3.4, kind: "wall" },
    { id: "cr_1", x: 0, z: -17.5, w: 2, d: 21, h: 3.4, kind: "wall" },
    { id: "cr_2", x: 0, z: 17.5, w: 2, d: 21, h: 3.4, kind: "wall" },
    { id: "cr_3", x: 0, z: 51, w: 2, d: 18, h: 3.4, kind: "wall" },
    // Mid-field cover walls (+-25, +-45)
    { id: "mw_0", x: -25, z: -42, w: 14, d: 2, h: 2.8, kind: "wall" },
    { id: "mw_1", x: -25, z: 42, w: 14, d: 2, h: 2.8, kind: "wall" },
    { id: "mw_2", x: 25, z: -42, w: 14, d: 2, h: 2.8, kind: "wall" },
    { id: "mw_3", x: 25, z: 42, w: 14, d: 2, h: 2.8, kind: "wall" }
  ];
  const rocks = [
    { id: "tr_0", x: -40, z: 0, r: 5, h: 3.4 },
    { id: "tr_1", x: 40, z: 0, r: 5, h: 3.4 },
    { id: "tr_2", x: -6, z: -35, r: 2.6, h: 2.5 },
    { id: "tr_3", x: 6, z: 35, r: 2.6, h: 2.5 },
    { id: "tr_4", x: -6, z: 4, r: 2.4, h: 2.5 },
    { id: "tr_5", x: 6, z: -4, r: 2.4, h: 2.5 }
  ];
  const crates = [
    { id: "tc0", x: -35, z: -20 },
    { id: "tc1", x: -35, z: -18 },
    { id: "tc2", x: -35, z: 20 },
    { id: "tc3", x: -35, z: 18 },
    { id: "tc4", x: 35, z: -20 },
    { id: "tc5", x: 35, z: -18 },
    { id: "tc6", x: 35, z: 20 },
    { id: "tc7", x: 35, z: 18 }
  ];
  const barrels = [
    { id: "tb0", x: -55, z: -30 },
    { id: "tb1", x: -55, z: 0 },
    { id: "tb2", x: -55, z: 30 },
    { id: "tb3", x: 55, z: -30 },
    { id: "tb4", x: 55, z: 0 },
    { id: "tb5", x: 55, z: 30 }
  ];
  const zones = [
    { id: "tsp0", type: "speed_pad", shape: "rect", x: -30, z: -50, w: 20, d: 5, dirX: 1, dirZ: 0 },
    { id: "tsp1", type: "speed_pad", shape: "rect", x: 30, z: -50, w: 20, d: 5, dirX: -1, dirZ: 0 },
    { id: "tsp2", type: "speed_pad", shape: "rect", x: -30, z: 50, w: 20, d: 5, dirX: 1, dirZ: 0 },
    { id: "tsp3", type: "speed_pad", shape: "rect", x: 30, z: 50, w: 20, d: 5, dirX: -1, dirZ: 0 }
  ];
  const spawns = [
    // Red (left)
    { x: -72, z: -28, angle: Math.PI / 2, team: "red" },
    { x: -72, z: -14, angle: Math.PI / 2, team: "red" },
    { x: -72, z: 14, angle: Math.PI / 2, team: "red" },
    { x: -72, z: 28, angle: Math.PI / 2, team: "red" },
    { x: -84, z: -36, angle: Math.PI / 2, team: "red" },
    { x: -84, z: 36, angle: Math.PI / 2, team: "red" },
    // Blue (right)
    { x: 72, z: -28, angle: -Math.PI / 2, team: "blue" },
    { x: 72, z: -14, angle: -Math.PI / 2, team: "blue" },
    { x: 72, z: 14, angle: -Math.PI / 2, team: "blue" },
    { x: 72, z: 28, angle: -Math.PI / 2, team: "blue" },
    { x: 84, z: -36, angle: -Math.PI / 2, team: "blue" },
    { x: 84, z: 36, angle: -Math.PI / 2, team: "blue" }
  ];
  const pads = [
    { id: "tp0", x: -65, z: -20, team: "red" },
    { id: "tp1", x: -65, z: 20, team: "red" },
    { id: "tp2", x: -45, z: -40, team: "red" },
    { id: "tp3", x: -45, z: 40, team: "red" },
    { id: "tp4", x: -20, z: -16, team: "red" },
    { id: "tp5", x: -20, z: 16, team: "red" },
    { id: "tp6", x: 65, z: -20, team: "blue" },
    { id: "tp7", x: 65, z: 20, team: "blue" },
    { id: "tp8", x: 45, z: -40, team: "blue" },
    { id: "tp9", x: 45, z: 40, team: "blue" },
    { id: "tp10", x: 20, z: -16, team: "blue" },
    { id: "tp11", x: 20, z: 16, team: "blue" },
    { id: "tp12", x: 0, z: -35 },
    { id: "tp13", x: 0, z: 35 }
  ];
  const hillSpots = [
    { id: "th0", x: 0, z: 0, r: 10 },
    { id: "th1", x: 0, z: -35, r: 10 },
    { id: "th2", x: 0, z: 35, r: 10 },
    { id: "th3", x: -45, z: 0, r: 10 },
    { id: "th4", x: 45, z: 0, r: 10 }
  ];
  return {
    id: "twin_bases",
    name: "Twin Bases",
    description: "Symmetrical Red vs Blue stronghold split by a 3-gate ridge and fast flank rails.",
    bestFor: "Flag battle",
    hazards: ["barrels", "speed_pads"],
    width: 200,
    depth: 120,
    palette: {
      ground: "#7C8596",
      groundAccent: "#5C6577",
      skyTop: "#1A3463",
      skyBottom: "#9EC8F5",
      fog: "#8EB3DC",
      sunColor: "#FFF8E8",
      wallColor: "#4B5568",
      rockColor: "#667185"
    },
    sunElevationDeg: 55,
    walls,
    rocks,
    crates,
    barrels,
    trees: [],
    zones,
    spawns,
    pads,
    hillSpots,
    ctfBases: {
      red: { flagX: -85, flagZ: 0, capX: -80, capZ: 0 },
      blue: { flagX: 85, flagZ: 0, capX: 80, capZ: 0 }
    },
    decorations: [
      { kind: "banner_red", x: -94, z: -18, scale: 1.2, rot: 0 },
      { kind: "banner_red", x: -94, z: 18, scale: 1.2, rot: 0 },
      { kind: "banner_blue", x: 94, z: -18, scale: 1.2, rot: Math.PI },
      { kind: "banner_blue", x: 94, z: 18, scale: 1.2, rot: Math.PI }
    ]
  };
}
function makeCraterHill() {
  const walls = [];
  const segCount = 24;
  const r = 30;
  for (let i = 0; i < segCount; i++) {
    const deg = i * (360 / segCount);
    if (Math.abs(deg - 0) < 16 || Math.abs(deg - 360) < 16 || Math.abs(deg - 90) < 16 || Math.abs(deg - 180) < 16 || Math.abs(deg - 270) < 16) {
      continue;
    }
    const rad = deg * Math.PI / 180;
    const x = Math.round(Math.cos(rad) * r * 10) / 10;
    const z = Math.round(Math.sin(rad) * r * 10) / 10;
    const horiz = Math.abs(Math.sin(rad)) > Math.abs(Math.cos(rad));
    walls.push({
      id: `cr_rim_${i}`,
      x,
      z,
      w: horiz ? 8.2 : 3.2,
      d: horiz ? 3.2 : 8.2,
      h: 3.2,
      kind: "crater_rim"
    });
  }
  const rocks = [];
  for (let i = 0; i < 16; i++) {
    const rad = (i * 22.5 + 11) * Math.PI / 180;
    const dist = 42 + i % 3 * 7;
    rocks.push({
      id: `ck_r_${i}`,
      x: Math.round(Math.cos(rad) * dist * 10) / 10,
      z: Math.round(Math.sin(rad) * dist * 10) / 10,
      r: 3 + i % 3 * 0.6,
      h: 3.4
    });
  }
  const crates = [
    { id: "cc0", x: 18, z: 18 },
    { id: "cc1", x: -18, z: 18 },
    { id: "cc2", x: 18, z: -18 },
    { id: "cc3", x: -18, z: -18 },
    { id: "cc4", x: 56, z: 22 },
    { id: "cc5", x: -56, z: 22 },
    { id: "cc6", x: 56, z: -22 },
    { id: "cc7", x: -56, z: -22 }
  ];
  const barrels = [
    { id: "cb0", x: 0, z: 22 },
    { id: "cb1", x: 0, z: -22 },
    { id: "cb2", x: 22, z: 0 },
    { id: "cb3", x: -22, z: 0 },
    { id: "cb4", x: 38, z: 38 },
    { id: "cb5", x: -38, z: 38 },
    { id: "cb6", x: 38, z: -38 },
    { id: "cb7", x: -38, z: -38 },
    { id: "cb8", x: 64, z: 0 },
    { id: "cb9", x: -64, z: 0 }
  ];
  const spawns = [];
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 + 15) * Math.PI / 180;
    const x = Math.cos(rad) * 70;
    const z = Math.sin(rad) * 70;
    spawns.push({ x, z, angle: Math.atan2(-x, -z), team: i % 2 === 0 ? "red" : "blue" });
  }
  const pads = [
    { id: "cp0", x: 12, z: 12 },
    { id: "cp1", x: -12, z: 12 },
    { id: "cp2", x: 12, z: -12 },
    { id: "cp3", x: -12, z: -12 },
    { id: "cp4", x: 0, z: 48 },
    { id: "cp5", x: 0, z: -48 },
    { id: "cp6", x: 48, z: 0 },
    { id: "cp7", x: -48, z: 0 },
    { id: "cp8", x: 52, z: 52 },
    { id: "cp9", x: -52, z: 52 },
    { id: "cp10", x: 52, z: -52 },
    { id: "cp11", x: -52, z: -52 }
  ];
  const hillSpots = [
    { id: "kh0", x: 0, z: 0, r: 10 },
    { id: "kh1", x: 0, z: -48, r: 10 },
    { id: "kh2", x: 48, z: 0, r: 10 },
    { id: "kh3", x: 0, z: 48, r: 10 },
    { id: "kh4", x: -48, z: 0, r: 10 }
  ];
  return {
    id: "crater_hill",
    name: "Crater Hill",
    description: "Volcanic caldera rim with 4 fortress gates, ember glow, and rotating hill points.",
    bestFor: "Hill control",
    hazards: ["barrels"],
    width: 160,
    depth: 160,
    palette: {
      ground: "#5A4640",
      groundAccent: "#7C3E2A",
      skyTop: "#23101E",
      skyBottom: "#D65A38",
      fog: "#7B4035",
      sunColor: "#FF9E6D",
      wallColor: "#46332E",
      rockColor: "#3D2F2D"
    },
    sunElevationDeg: 28,
    walls,
    rocks,
    crates,
    barrels,
    trees: [],
    zones: [],
    spawns,
    pads,
    hillSpots,
    decorations: []
  };
}
var BASE_MAPS = {
  desert_outpost: makeDesertOutpost,
  industrial_yard: makeIndustrialYard,
  frozen_lake: makeFrozenLake,
  forest_maze: makeForestMaze,
  twin_bases: makeTwinBases,
  crater_hill: makeCraterHill
};
var MAPS = {
  desert_outpost: makeDesertOutpost(),
  industrial_yard: makeIndustrialYard(),
  frozen_lake: makeFrozenLake(),
  forest_maze: makeForestMaze(),
  twin_bases: makeTwinBases(),
  crater_hill: makeCraterHill()
};
function buildMap(mapId, size = "medium") {
  const base = BASE_MAPS[mapId]();
  const s = MAP_SIZE_SCALES[size].scale;
  if (s === 1) return base;
  const scaleVal = (v) => Math.round(v * s * 100) / 100;
  return {
    ...base,
    width: Math.round(base.width * s),
    depth: Math.round(base.depth * s),
    walls: base.walls.map((w) => ({
      ...w,
      x: scaleVal(w.x),
      z: scaleVal(w.z),
      w: scaleVal(w.w),
      d: scaleVal(w.d)
    })),
    rocks: base.rocks.map((r) => ({
      ...r,
      x: scaleVal(r.x),
      z: scaleVal(r.z),
      r: Math.max(1.5, scaleVal(r.r))
    })),
    crates: base.crates.map((c) => ({ ...c, x: scaleVal(c.x), z: scaleVal(c.z) })),
    barrels: base.barrels.map((b) => ({ ...b, x: scaleVal(b.x), z: scaleVal(b.z) })),
    trees: base.trees.map((t) => ({ ...t, x: scaleVal(t.x), z: scaleVal(t.z) })),
    zones: base.zones.map((z) => ({
      ...z,
      x: scaleVal(z.x),
      z: scaleVal(z.z),
      r: z.r ? scaleVal(z.r) : void 0,
      w: z.w ? scaleVal(z.w) : void 0,
      d: z.d ? scaleVal(z.d) : void 0
    })),
    spawns: base.spawns.map((sp) => ({ ...sp, x: scaleVal(sp.x), z: scaleVal(sp.z) })),
    pads: base.pads.map((p) => ({ ...p, x: scaleVal(p.x), z: scaleVal(p.z) })),
    hillSpots: base.hillSpots.map((h) => ({
      ...h,
      x: scaleVal(h.x),
      z: scaleVal(h.z),
      r: Math.max(7, scaleVal(h.r))
    })),
    ctfBases: base.ctfBases ? {
      red: {
        flagX: scaleVal(base.ctfBases.red.flagX),
        flagZ: scaleVal(base.ctfBases.red.flagZ),
        capX: scaleVal(base.ctfBases.red.capX),
        capZ: scaleVal(base.ctfBases.red.capZ)
      },
      blue: {
        flagX: scaleVal(base.ctfBases.blue.flagX),
        flagZ: scaleVal(base.ctfBases.blue.flagZ),
        capX: scaleVal(base.ctfBases.blue.capX),
        capZ: scaleVal(base.ctfBases.blue.capZ)
      }
    } : void 0,
    decorations: base.decorations.map((d) => ({ ...d, x: scaleVal(d.x), z: scaleVal(d.z) }))
  };
}

// shared/sim.ts
function round3(n) {
  return Math.round(n * 1e3) / 1e3;
}
function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function angleDiff(from, to) {
  return normalizeAngle(to - from);
}
function seededRand(seed, step) {
  let t = seed + step * 1831565813 | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function pickWeightedPowerBoxItem(seed, step, mode) {
  let total = 0;
  for (const item of POWER_BOX_ITEMS) {
    total += item.weight;
  }
  let r = seededRand(seed, step) * total;
  for (const item of POWER_BOX_ITEMS) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return mode === "ctf" ? "speed_boost" : "repair";
}
function getTankClass(tank, settings) {
  const id = settings.tankRule === "classes" ? tank.custom.classId : "standard";
  return TANK_CLASSES[id];
}
function getGroundTypeAt(map, x, z) {
  for (const zone of map.zones) {
    if (zone.shape === "circle" && zone.r) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      if (dx * dx + dz * dz <= zone.r * zone.r) {
        return { ground: zone.type, padDirX: zone.dirX ?? 0, padDirZ: zone.dirZ ?? 0 };
      }
    } else if (zone.shape === "rect" && zone.w && zone.d) {
      if (Math.abs(x - zone.x) <= zone.w * 0.5 && Math.abs(z - zone.z) <= zone.d * 0.5) {
        return { ground: zone.type, padDirX: zone.dirX ?? 0, padDirZ: zone.dirZ ?? 0 };
      }
    }
  }
  return { ground: "normal", padDirX: 0, padDirZ: 0 };
}
function hasBuff(tank, id) {
  return tank.buffs.some((b) => b.id === id && b.remaining > 0);
}
function clampInput(input, map) {
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
    dashDir: input.dashDir === -1 ? -1 : input.dashDir === 1 ? 1 : 0
  };
}
function resolveTankWorldCollisions(tank, map, destructibles, settings) {
  const cls = getTankClass(tank, settings);
  const radius = Math.max(cls.width, cls.length) * 0.44;
  const halfW = map.width * 0.5 - 1 - radius;
  const halfD = map.depth * 0.5 - 1 - radius;
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
  const pushFromBox = (bx, bz, bw, bd) => {
    const hw = bw * 0.5;
    const hd = bd * 0.5;
    const closestX = Math.max(bx - hw, Math.min(bx + hw, tank.x));
    const closestZ = Math.max(bz - hd, Math.min(bz + hd, tank.z));
    const dx = tank.x - closestX;
    const dz = tank.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-4) {
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
  const pushFromCircle = (cx, cz, cr) => {
    const minDist = radius + cr;
    const dx = tank.x - cx;
    const dz = tank.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      const nx = dist > 1e-4 ? dx / dist : 1;
      const nz = dist > 1e-4 ? dz / dist : 0;
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
    if (d.kind === "crate") {
      pushFromBox(d.x, d.z, 1.6, 1.6);
    } else {
      pushFromCircle(d.x, d.z, 0.5);
    }
  }
}
function stepTank(tank, rawInput, dt, map, destructibles, settings, carryingFlag) {
  if (!tank.alive) return;
  const input = clampInput(rawInput, map);
  const cls = getTankClass(tank, settings);
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
  const { ground } = getGroundTypeAt(map, tank.x, tank.z);
  tank.groundType = ground;
  if (ground === "speed_pad") {
    tank.speedPadTimer = PHYSICS.speedPadDuration;
  }
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
  if (cls.id === "scout" && input.dashDir !== 0 && tank.dashCooldown <= 0 && tank.dashTimer <= 0) {
    const dir = input.dashDir;
    tank.dashDirX = -Math.cos(tank.hullAngle) * dir;
    tank.dashDirZ = Math.sin(tank.hullAngle) * dir;
    tank.dashTimer = cls.dashDuration;
    tank.dashCooldown = cls.dashCooldown;
  }
  let speedMult = 1;
  if (tank.groundType === "mud") speedMult *= PHYSICS.mudSpeedMult;
  if (tank.speedPadTimer > 0) speedMult *= PHYSICS.speedPadMult;
  if (hasBuff(tank, "speed_boost")) speedMult *= POWER_BOX_CONFIG.speedBoostMult;
  if (tank.turboActive) speedMult *= cls.turboMult;
  if (tank.empTimer > 0) speedMult *= WEAPON_TUNING.empSlowMult;
  if (carryingFlag) speedMult *= PHYSICS.ctfCarrierSpeedMult;
  if (input.handbrake) speedMult *= PHYSICS.handbrakeSpeedCapRatio;
  const maxFwd = cls.forwardSpeed * speedMult;
  const maxRev = cls.reverseSpeed * speedMult;
  const currentSpeedAlongFwd = tank.vx * Math.sin(tank.hullAngle) + tank.vz * Math.cos(tank.hullAngle);
  const speedRatio = Math.min(1, Math.abs(currentSpeedAlongFwd) / Math.max(0.1, cls.forwardSpeed));
  let turnDeg = cls.hullTurnStandingDeg + (cls.hullTurnFullSpeedDeg - cls.hullTurnStandingDeg) * speedRatio;
  if (input.handbrake) {
    turnDeg *= PHYSICS.handbrakeTurnMult;
  }
  if (tank.groundType === "ice") {
    turnDeg *= 0.65;
  }
  const turnRad = turnDeg * Math.PI / 180;
  tank.hullAngle = normalizeAngle(tank.hullAngle - input.turn * turnRad * dt);
  const fwdX = Math.sin(tank.hullAngle);
  const fwdZ = Math.cos(tank.hullAngle);
  const targetSpeed = input.forward >= 0 ? input.forward * maxFwd : input.forward * maxRev;
  const desiredVx = fwdX * targetSpeed;
  const desiredVz = fwdZ * targetSpeed;
  if (tank.groundType === "ice") {
    const iceAccel = (input.forward !== 0 ? cls.accel : 2.5) * PHYSICS.iceFriction * 4.5;
    const blend = Math.min(1, iceAccel * dt);
    tank.vx += (desiredVx - tank.vx) * blend;
    tank.vz += (desiredVz - tank.vz) * blend;
  } else {
    const isBraking = input.forward === 0 || Math.sign(input.forward) !== Math.sign(currentSpeedAlongFwd) || input.handbrake;
    const rate = (isBraking ? cls.brake : cls.accel) * (tank.turboActive ? 1.35 : 1);
    const dvx = desiredVx - tank.vx;
    const dvz = desiredVz - tank.vz;
    const dvLen = Math.hypot(dvx, dvz);
    const maxStep = rate * dt;
    if (dvLen <= maxStep || dvLen < 1e-4) {
      tank.vx = desiredVx;
      tank.vz = desiredVz;
    } else {
      tank.vx += dvx / dvLen * maxStep;
      tank.vz += dvz / dvLen * maxStep;
    }
  }
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
  const aimDx = input.aimX - tank.x;
  const aimDz = input.aimZ - tank.z;
  if (aimDx * aimDx + aimDz * aimDz > 0.04) {
    const desiredTurret = Math.atan2(aimDx, aimDz);
    const diff = angleDiff(tank.turretAngle, desiredTurret);
    const maxTurretStep = cls.turretTurnDeg * Math.PI / 180 * dt;
    if (Math.abs(diff) <= maxTurretStep) {
      tank.turretAngle = desiredTurret;
    } else {
      tank.turretAngle = normalizeAngle(tank.turretAngle + Math.sign(diff) * maxTurretStep);
    }
  }
  tank.turretAngle = round3(tank.turretAngle);
  tank.lastProcessedSeq = input.seq;
}
function segmentVsAabb(x1, z1, x2, z2, bx, bz, hw, hd) {
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
function segmentVsCircle(x1, z1, x2, z2, cx, cz, r) {
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
function selectSafeSpawn(map, tanks, team, lastSpawnIdx, seed, tick) {
  const candidates = map.spawns.map((sp, idx) => ({ sp, idx }));
  const teamPool = team !== "none" ? candidates.filter((c) => c.sp.team === team) : candidates;
  const pool = teamPool.length > 0 ? teamPool : candidates;
  let bestScore = -Infinity;
  let bestList = [];
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
      const isEnemy = team === "none" || other.team !== team;
      if (isEnemy) {
        if (d < minEnemyDist) minEnemyDist = d;
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
    if (team !== "none" && minMateDist < 45) score += 15;
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
function createSimState(players, settings, seed) {
  const map = buildMap(settings.mapId, settings.mapSize);
  const modeMeta = GAME_MODES[settings.mode];
  const destructibles = [
    ...map.crates.map((c) => ({
      id: c.id,
      kind: "crate",
      x: c.x,
      z: c.z,
      hp: PHYSICS.crateHp,
      maxHp: PHYSICS.crateHp,
      alive: true,
      respawnTimer: 0
    })),
    ...map.barrels.map((b) => ({
      id: b.id,
      kind: "barrel",
      x: b.x,
      z: b.z,
      hp: PHYSICS.barrelHp,
      maxHp: PHYSICS.barrelHp,
      alive: true,
      respawnTimer: 0
    }))
  ];
  const powerBoxes = settings.powerBoxesEnabled ? map.pads.map((pad, i) => ({
    id: pad.id,
    x: pad.x,
    z: pad.z,
    active: true,
    itemId: pickWeightedPowerBoxItem(seed, i + 101, settings.mode),
    respawnTimer: 0
  })) : [];
  const tanks = [];
  players.forEach((p, idx) => {
    const team = modeMeta.isTeam ? p.team === "red" || p.team === "blue" ? p.team : idx % 2 === 0 ? "red" : "blue" : "none";
    const clsId = settings.tankRule === "classes" ? p.custom.classId : "standard";
    const cls = TANK_CLASSES[clsId];
    const maxHp = settings.tankRule === "classic" ? settings.classicHp : cls.health;
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
      groundType: "normal",
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
      pingMs: p.pingMs
    });
  });
  const flags = settings.mode === "ctf" && map.ctfBases ? {
    red: {
      team: "red",
      x: map.ctfBases.red.flagX,
      z: map.ctfBases.red.flagZ,
      homeX: map.ctfBases.red.flagX,
      homeZ: map.ctfBases.red.flagZ,
      carrierId: null,
      droppedTimer: 0,
      atHome: true
    },
    blue: {
      team: "blue",
      x: map.ctfBases.blue.flagX,
      z: map.ctfBases.blue.flagZ,
      homeX: map.ctfBases.blue.flagX,
      homeZ: map.ctfBases.blue.flagZ,
      carrierId: null,
      droppedTimer: 0,
      atHome: true
    }
  } : settings.mode === "ctf" ? {
    red: {
      team: "red",
      x: -map.width * 0.4,
      z: 0,
      homeX: -map.width * 0.4,
      homeZ: 0,
      carrierId: null,
      droppedTimer: 0,
      atHome: true
    },
    blue: {
      team: "blue",
      x: map.width * 0.4,
      z: 0,
      homeX: map.width * 0.4,
      homeZ: 0,
      carrierId: null,
      droppedTimer: 0,
      atHome: true
    }
  } : null;
  const hill = settings.mode === "koth" && map.hillSpots.length > 0 ? {
    activeIndex: 0,
    nextIndex: 1 % map.hillSpots.length,
    x: map.hillSpots[0].x,
    z: map.hillSpots[0].z,
    r: map.hillSpots[0].r,
    nextX: map.hillSpots[1 % map.hillSpots.length].x,
    nextZ: map.hillSpots[1 % map.hillSpots.length].z,
    moveTimer: PHYSICS.kothMoveIntervalSec,
    holderTeam: "none",
    holderPlayerId: null
  } : null;
  const initRadius = Math.hypot(map.width * 0.5, map.depth * 0.5);
  const safeZoneEnabled = settings.mode === "lts" || settings.shrinkingZone;
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
      shrinking: false
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
    winnerReason: "",
    damageLog: {}
  };
}
var nextEntitySeq = 1;
function genId(prefix, tick) {
  nextEntitySeq = (nextEntitySeq + 1) % 1e6;
  return `${prefix}_${tick}_${nextEntitySeq}`;
}
function applyDamageToTank(state, target, rawDamage, attackerId, sourceX, sourceZ, weaponLabel, events, bypassShield = false) {
  if (!target.alive || target.disconnected) return;
  if (target.spawnShieldTimer > 0 && !bypassShield) {
    events.push({ type: "hit", targetId: target.id, attackerId: attackerId ?? "", x: target.x, z: target.z, damage: 0, shielded: true });
    return;
  }
  const attacker = attackerId ? state.tanks.find((t) => t.id === attackerId) : void 0;
  const modeMeta = GAME_MODES[state.settings.mode];
  if (modeMeta.isTeam && !state.settings.friendlyFire && attacker && attacker.id !== target.id && attacker.team === target.team && weaponLabel !== "Barrel") {
    return;
  }
  let dmg = rawDamage;
  let frontArmor = false;
  const cls = getTankClass(target, state.settings);
  if (!bypassShield && cls.frontArmorReduction > 0 && dmg > 0) {
    const incomingAngle = Math.atan2(sourceX - target.x, sourceZ - target.z);
    const diffDeg = Math.abs(angleDiff(target.hullAngle, incomingAngle) * 180 / Math.PI);
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
      target.buffs = target.buffs.filter((b) => b.id !== "shield");
    }
  }
  if (dmg > 0) {
    target.hp = Math.max(0, target.hp - dmg);
    if (attacker && attacker.id !== target.id) {
      attacker.damageDealt += dmg;
      const log = state.damageLog[target.id] ??= [];
      log.push({ attackerId: attacker.id, time: state.tick * PHYSICS.fixedDt });
    }
  }
  events.push({
    type: "hit",
    targetId: target.id,
    attackerId: attackerId ?? "",
    x: target.x,
    z: target.z,
    damage: dmg,
    shielded,
    frontArmor
  });
  if (target.hp <= 0 && target.alive) {
    killTank(state, target, attacker ?? null, weaponLabel, events);
  }
}
function killTank(state, victim, killer, weaponLabel, events) {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths += 1;
  victim.streak = 0;
  victim.respawnTimer = state.settings.mode === "lts" ? 9999 : PHYSICS.respawnDelay;
  victim.shieldHp = 0;
  victim.buffs = [];
  victim.turboActive = false;
  victim.dashTimer = 0;
  if (victim.guidedMissileId) {
    const gm = state.projectiles.find((p) => p.id === victim.guidedMissileId);
    if (gm) {
      gm.lifetime = 0;
      triggerExplosion(state, gm.x, gm.z, gm.blastRadius, gm.damage, victim.id, "Guided Missile", "large", events);
    }
    victim.guidedMissileId = null;
  }
  if (state.flags) {
    for (const f of [state.flags.red, state.flags.blue]) {
      if (f.carrierId === victim.id) {
        f.carrierId = null;
        f.x = victim.x;
        f.z = victim.z;
        f.atHome = false;
        f.droppedTimer = PHYSICS.ctfFlagReturnSec;
        events.push({ type: "flag_event", action: "dropped", team: f.team, x: f.x, z: f.z });
      }
    }
  }
  const hadStored = victim.storedWeapon !== null;
  victim.storedWeapon = null;
  victim.storedAmmo = 0;
  let streakBanner;
  if (killer && killer.id !== victim.id) {
    killer.kills += 1;
    killer.streak += 1;
    if (killer.streak > killer.bestStreak) killer.bestStreak = killer.streak;
    if (STREAK_BANNERS[killer.streak]) {
      streakBanner = killer.streak;
    }
    if (state.settings.mode === "tdm") {
      if (killer.team === "red") state.teamScores.red += 1;
      else if (killer.team === "blue") state.teamScores.blue += 1;
    }
  }
  const nowSec = state.tick * PHYSICS.fixedDt;
  const log = state.damageLog[victim.id] ?? [];
  const credited = /* @__PURE__ */ new Set();
  for (const entry of log) {
    if (nowSec - entry.time <= PHYSICS.assistWindowSec && entry.attackerId !== killer?.id && !credited.has(entry.attackerId)) {
      credited.add(entry.attackerId);
      const assister = state.tanks.find((t) => t.id === entry.attackerId);
      if (assister) assister.assists += 1;
    }
  }
  state.damageLog[victim.id] = [];
  events.push({
    type: "tank_destroyed",
    victimId: victim.id,
    victimName: victim.name,
    victimTeam: victim.team,
    victimClass: victim.custom.classId,
    killerId: killer?.id ?? null,
    killerName: killer?.name ?? (weaponLabel === "Safe Zone" ? "Safe Zone" : "Hazard"),
    killerTeam: killer?.team ?? "none",
    x: victim.x,
    z: victim.z,
    weapon: weaponLabel,
    streak: streakBanner
  });
  if (hadStored) {
    triggerExplosion(
      state,
      victim.x,
      victim.z,
      PHYSICS.destructionChainRadius,
      PHYSICS.destructionChainDamage,
      victim.id,
      "Ammo Cookoff",
      "small",
      events
    );
  }
}
function triggerExplosion(state, x, z, radius, damage, ownerId, weaponLabel, kind, events) {
  events.push({ type: "explosion", x, z, radius, kind });
  const owner = ownerId ? state.tanks.find((t) => t.id === ownerId) : null;
  const modeMeta = GAME_MODES[state.settings.mode];
  for (const t of state.tanks) {
    if (!t.alive) continue;
    const dist = Math.hypot(t.x - x, t.z - z);
    if (dist <= radius + 0.9) {
      if (owner && t.id === owner.id && modeMeta.isTeam && weaponLabel === "Airstrike") {
        continue;
      }
      const falloff = dist < radius * 0.4 ? 1 : Math.max(0.4, 1 - (dist - radius * 0.4) / Math.max(0.5, radius));
      const dmg = Math.round(damage * falloff);
      applyDamageToTank(state, t, dmg, ownerId, x, z, weaponLabel, events);
    }
  }
  for (const d of state.destructibles) {
    if (!d.alive) continue;
    const dist = Math.hypot(d.x - x, d.z - z);
    if (dist <= radius + 0.8) {
      damageDestructible(state, d, damage, ownerId, events);
    }
  }
}
function damageDestructible(state, obj, dmg, attackerId, events) {
  if (!obj.alive) return;
  obj.hp -= dmg;
  if (obj.hp <= 0) {
    obj.alive = false;
    obj.hp = 0;
    obj.respawnTimer = 35;
    if (obj.kind === "crate") {
      events.push({ type: "explosion", x: obj.x, z: obj.z, radius: 1.5, kind: "crate" });
    } else {
      triggerExplosion(
        state,
        obj.x,
        obj.z,
        PHYSICS.barrelBlastRadius,
        PHYSICS.barrelBlastDamage,
        attackerId,
        "Barrel",
        "barrel",
        events
      );
    }
  }
}
function stepSim(state, inputsByTankId, events) {
  if (state.matchEnded) return;
  const dt = PHYSICS.fixedDt;
  state.tick += 1;
  if (state.roundOverTimer > 0) {
    state.roundOverTimer -= dt;
    if (state.roundOverTimer <= 0) {
      startNextLtsRound(state, events);
    }
    return;
  }
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
    if (!hasBuff(tank, "shield")) {
      tank.shieldHp = 0;
    }
  }
  for (const tank of state.tanks) {
    if (!tank.alive || tank.disconnected || tank.afk) continue;
    const rawIn = inputsByTankId[tank.id] ?? {
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
      dashDir: 0
    };
    const prevDashTimer = tank.dashTimer;
    const carrying = Boolean(
      state.flags && (state.flags.red.carrierId === tank.id || state.flags.blue.carrierId === tank.id)
    );
    stepTank(tank, rawIn, dt, state.map, state.destructibles, state.settings, carrying);
    if (prevDashTimer <= 0 && tank.dashTimer > 0) {
      events.push({ type: "dash", tankId: tank.id, x: tank.x, z: tank.z, dirX: tank.dashDirX, dirZ: tank.dashDirZ });
    }
  }
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
        const nx = dist > 1e-4 ? dx / dist : 1;
        const nz = dist > 1e-4 ? dz / dist : 0;
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
  for (const tank of state.tanks) {
    if (!tank.alive || tank.disconnected || tank.afk) continue;
    const input = inputsByTankId[tank.id];
    if (!input) continue;
    if (tank.guidedMissileId) {
      const gm = state.projectiles.find((p) => p.id === tank.guidedMissileId);
      if (gm) {
        const toAimAngle = Math.atan2(input.aimX - gm.x, input.aimZ - gm.z);
        const diff = angleDiff(gm.angle, toAimAngle);
        const maxTurn = WEAPON_TUNING.guidedTurnDeg * Math.PI / 180 * dt;
        gm.angle = normalizeAngle(gm.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
        gm.vx = Math.sin(gm.angle) * gm.speed;
        gm.vz = Math.cos(gm.angle) * gm.speed;
        if (input.fire) {
          gm.lifetime = 0;
          tank.guidedMissileId = null;
          triggerExplosion(state, gm.x, gm.z, gm.blastRadius, gm.damage, tank.id, "Guided Missile", "large", events);
        }
      } else {
        tank.guidedMissileId = null;
      }
      continue;
    }
    if (tank.spawnShieldTimer > 0) continue;
    const cls = getTankClass(tank, state.settings);
    if (input.fire && tank.reloadTimer <= 0) {
      const rapid = hasBuff(tank, "rapid_fire");
      const reloadTime = Math.max(0.32, cls.cannonReload * (rapid ? POWER_BOX_CONFIG.rapidFireMult : 1));
      tank.reloadTimer = reloadTime;
      tank.reloadMax = reloadTime;
      const dmgMult = hasBuff(tank, "damage_up") ? POWER_BOX_CONFIG.damageUpMult : 1;
      const dmg = Math.round(cls.cannonDamage * dmgMult);
      const isTriple = hasBuff(tank, "triple_shot");
      const angles = isTriple ? [
        tank.turretAngle - POWER_BOX_CONFIG.tripleShotSpreadDeg * Math.PI / 180,
        tank.turretAngle,
        tank.turretAngle + POWER_BOX_CONFIG.tripleShotSpreadDeg * Math.PI / 180
      ] : [tank.turretAngle];
      for (const ang of angles) {
        const spawnDist = cls.barrelLength * 0.9 + 0.35;
        const sx = round3(tank.x + Math.sin(ang) * spawnDist);
        const sz = round3(tank.z + Math.cos(ang) * spawnDist);
        state.projectiles.push({
          id: genId("sh", state.tick),
          kind: "cannon",
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
          createdAtTick: state.tick
        });
      }
      tank.shotsFired += 1;
      events.push({ type: "fired", tankId: tank.id, x: tank.x, z: tank.z, angle: tank.turretAngle, kind: "cannon" });
    }
    if (input.useWeapon && tank.storedWeapon && tank.storedAmmo > 0 && tank.empTimer <= 0) {
      fireStoredWeapon(state, tank, input, events);
    }
  }
  stepProjectiles(state, dt, events);
  stepMines(state, dt, events);
  stepAirstrikes(state, dt, events);
  stepPowerBoxes(state, dt, events);
  stepFlags(state, dt, events);
  stepModes(state, dt, events);
  for (const d of state.destructibles) {
    if (!d.alive) {
      d.respawnTimer -= dt;
      if (d.respawnTimer <= 0) {
        d.alive = true;
        d.hp = d.kind === "crate" ? PHYSICS.crateHp : PHYSICS.barrelHp;
      }
    }
  }
  if (state.settings.mode !== "lts") {
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
function fireStoredWeapon(state, tank, input, events) {
  const weaponId = tank.storedWeapon;
  const def = WEAPONS[weaponId];
  const cls = getTankClass(tank, state.settings);
  const spawnDist = cls.barrelLength * 0.9 + 0.45;
  const sx = round3(tank.x + Math.sin(tank.turretAngle) * spawnDist);
  const sz = round3(tank.z + Math.cos(tank.turretAngle) * spawnDist);
  tank.storedAmmo -= 1;
  events.push({ type: "fired", tankId: tank.id, x: tank.x, z: tank.z, angle: tank.turretAngle, kind: weaponId });
  if (weaponId === "homing") {
    state.projectiles.push({
      id: genId("hm", state.tick),
      kind: "homing",
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
      createdAtTick: state.tick
    });
  } else if (weaponId === "cluster") {
    const dx = input.aimX - tank.x;
    const dz = input.aimZ - tank.z;
    const dist = Math.min(WEAPON_TUNING.clusterMaxRange, Math.max(8, Math.hypot(dx, dz)));
    const ang = Math.atan2(dx, dz);
    const tx = round3(tank.x + Math.sin(ang) * dist);
    const tz = round3(tank.z + Math.cos(ang) * dist);
    const flightTime = Math.max(0.35, dist / def.speed);
    state.projectiles.push({
      id: genId("cl", state.tick),
      kind: "cluster",
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
      createdAtTick: state.tick
    });
  } else if (weaponId === "guided") {
    const id = genId("gd", state.tick);
    tank.guidedMissileId = id;
    state.projectiles.push({
      id,
      kind: "guided",
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
      createdAtTick: state.tick
    });
  } else if (weaponId === "bouncing") {
    state.projectiles.push({
      id: genId("bc", state.tick),
      kind: "bouncing",
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
      createdAtTick: state.tick
    });
  } else if (weaponId === "emp") {
    events.push({ type: "explosion", x: tank.x, z: tank.z, radius: def.blastRadius, kind: "emp" });
    const modeMeta = GAME_MODES[state.settings.mode];
    for (const other of state.tanks) {
      if (!other.alive || other.id === tank.id) continue;
      if (modeMeta.isTeam && other.team === tank.team) continue;
      const dist = Math.hypot(other.x - tank.x, other.z - tank.z);
      if (dist <= def.blastRadius) {
        other.empTimer = WEAPON_TUNING.empDuration;
        other.shieldHp = 0;
        other.buffs = other.buffs.filter((b) => b.id !== "shield");
      }
    }
  } else if (weaponId === "mines") {
    const dropX = round3(tank.x - Math.sin(tank.hullAngle) * 1.9);
    const dropZ = round3(tank.z - Math.cos(tank.hullAngle) * 1.9);
    state.mines.push({
      id: genId("mn", state.tick),
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: dropX,
      z: dropZ,
      armTimer: WEAPON_TUNING.mineArmDelay,
      age: 0,
      lifetime: def.lifetime
    });
  } else if (weaponId === "airstrike") {
    const dx = input.aimX - tank.x;
    const dz = input.aimZ - tank.z;
    const dist = Math.hypot(dx, dz) || 1;
    state.airstrikes.push({
      id: genId("as", state.tick),
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: input.aimX,
      z: input.aimZ,
      dirX: dx / dist,
      dirZ: dz / dist,
      countdown: WEAPON_TUNING.airstrikeDelay,
      strikesDropped: 0,
      nextDropTimer: 0
    });
  }
  if (tank.storedAmmo <= 0) {
    tank.storedWeapon = null;
    tank.storedAmmo = 0;
  }
}
function stepProjectiles(state, dt, events) {
  const remaining = [];
  const halfW = state.map.width * 0.5 - 1;
  const halfD = state.map.depth * 0.5 - 1;
  for (const p of state.projectiles) {
    if (p.lifetime <= 0 || p.hp <= 0) continue;
    p.lifetime -= dt;
    if (p.kind === "homing") {
      const modeMeta2 = GAME_MODES[state.settings.mode];
      let bestTarget = null;
      let bestDist = WEAPON_TUNING.homingRange;
      for (const t of state.tanks) {
        if (!t.alive || t.id === p.ownerId) continue;
        if (modeMeta2.isTeam && t.team === p.ownerTeam) continue;
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > bestDist) continue;
        const toAng = Math.atan2(dx, dz);
        const diffDeg = Math.abs(angleDiff(p.angle, toAng) * 180 / Math.PI);
        if (diffDeg <= WEAPON_TUNING.homingConeDeg) {
          bestDist = dist;
          bestTarget = t;
        }
      }
      p.targetId = bestTarget?.id ?? null;
      if (bestTarget) {
        const toAng = Math.atan2(bestTarget.x - p.x, bestTarget.z - p.z);
        const diff = angleDiff(p.angle, toAng);
        const maxTurn = WEAPON_TUNING.homingTurnDeg * Math.PI / 180 * dt;
        p.angle = normalizeAngle(p.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
        p.vx = Math.sin(p.angle) * p.speed;
        p.vz = Math.cos(p.angle) * p.speed;
      }
    }
    if (p.kind === "cluster") {
      const progress = 1 - Math.max(0, p.lifetime) / Math.max(0.01, p.maxLifetime);
      p.y = 0.9 + Math.sin(progress * Math.PI) * 11;
      if (p.lifetime <= 0) {
        events.push({ type: "explosion", x: p.x, z: p.z, radius: 2.5, kind: "cluster_open" });
        for (let b = 0; b < WEAPON_TUNING.clusterBombletCount; b++) {
          const ang = b / WEAPON_TUNING.clusterBombletCount * Math.PI * 2 + seededRand(state.seed, state.tick + b) * 0.5;
          const r = 1.5 + seededRand(state.seed, state.tick + b * 7) * (WEAPON_TUNING.clusterSpreadRadius - 1.5);
          const bx = p.x + Math.cos(ang) * r;
          const bz = p.z + Math.sin(ang) * r;
          state.projectiles.push({
            id: genId("bm", state.tick),
            kind: "bomblet",
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
            createdAtTick: state.tick
          });
        }
        continue;
      }
      p.x = round3(p.x + p.vx * dt);
      p.z = round3(p.z + p.vz * dt);
      remaining.push(p);
      continue;
    }
    if (p.kind === "bomblet") {
      p.x = round3(p.x + p.vx * dt);
      p.y = round3(Math.max(0, p.y + p.vy * dt));
      p.z = round3(p.z + p.vz * dt);
      if (p.lifetime <= 0 || p.y <= 0.05) {
        triggerExplosion(state, p.x, p.z, p.blastRadius, p.damage, p.ownerId, "Cluster Missile", "small", events);
        continue;
      }
      remaining.push(p);
      continue;
    }
    const nextX = p.x + p.vx * dt;
    const nextZ = p.z + p.vz * dt;
    let earliestT = 1.01;
    let hitType = "none";
    let hitNx = 0;
    let hitNz = 0;
    let hitTank = null;
    let hitDestructible = null;
    let hitMissile = null;
    let hitMineIdx = -1;
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
      hitType = "wall";
    }
    for (const w of state.map.walls) {
      if (w.destructible && (w.hp ?? 1) <= 0) continue;
      const res = segmentVsAabb(p.x, p.z, nextX, nextZ, w.x, w.z, w.w * 0.5 + p.radius, w.d * 0.5 + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = "wall";
        hitNx = res.nx;
        hitNz = res.nz;
      }
    }
    for (const r of state.map.rocks) {
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, r.x, r.z, r.r + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = "wall";
        hitNx = res.nx;
        hitNz = res.nz;
      }
    }
    for (const d of state.destructibles) {
      if (!d.alive) continue;
      const res = d.kind === "crate" ? segmentVsAabb(p.x, p.z, nextX, nextZ, d.x, d.z, 0.8 + p.radius, 0.8 + p.radius) : segmentVsCircle(p.x, p.z, nextX, nextZ, d.x, d.z, 0.5 + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = "destructible";
        hitDestructible = d;
        hitNx = res.nx;
        hitNz = res.nz;
      }
    }
    for (const otherP of state.projectiles) {
      if (otherP.id === p.id || otherP.hp <= 0 || otherP.hp > 50) continue;
      if (otherP.ownerId === p.ownerId) continue;
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, otherP.x, otherP.z, otherP.radius + p.radius + 0.2);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = "missile";
        hitMissile = otherP;
      }
    }
    for (let mi = 0; mi < state.mines.length; mi++) {
      const m = state.mines[mi];
      if (m.ownerId === p.ownerId) continue;
      const res = segmentVsCircle(p.x, p.z, nextX, nextZ, m.x, m.z, 0.5 + p.radius);
      if (res && res.t < earliestT) {
        earliestT = res.t;
        hitType = "mine";
        hitMineIdx = mi;
      }
    }
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
        hitType = "tank";
        hitTank = t;
      }
    }
    if (hitType === "none") {
      p.x = round3(nextX);
      p.z = round3(nextZ);
      if (p.lifetime > 0) {
        remaining.push(p);
      } else if (p.kind === "guided" || p.kind === "homing") {
        const owner = state.tanks.find((t) => t.id === p.ownerId);
        if (owner && owner.guidedMissileId === p.id) owner.guidedMissileId = null;
        triggerExplosion(state, p.x, p.z, p.blastRadius, p.damage, p.ownerId, p.kind === "guided" ? "Guided Missile" : "Homing Missile", "medium", events);
      }
      continue;
    }
    const hitX = round3(p.x + (nextX - p.x) * earliestT);
    const hitZ = round3(p.z + (nextZ - p.z) * earliestT);
    if (hitType === "wall") {
      if (p.bouncesLeft > 0) {
        p.bouncesLeft -= 1;
        const dot = p.vx * hitNx + p.vz * hitNz;
        p.vx = p.vx - 2 * dot * hitNx;
        p.vz = p.vz - 2 * dot * hitNz;
        p.angle = Math.atan2(p.vx, p.vz);
        p.x = round3(hitX + hitNx * 0.15);
        p.z = round3(hitZ + hitNz * 0.15);
        events.push({ type: "ricochet", x: hitX, z: hitZ, kind: p.kind === "bouncing" ? "bouncing" : "cannon" });
        if (p.lifetime > 0) remaining.push(p);
      } else {
        if (p.kind === "guided" || p.kind === "homing") {
          const owner = state.tanks.find((t) => t.id === p.ownerId);
          if (owner && owner.guidedMissileId === p.id) owner.guidedMissileId = null;
          triggerExplosion(state, hitX, hitZ, p.blastRadius, p.damage, p.ownerId, p.kind === "guided" ? "Guided Missile" : "Homing Missile", "medium", events);
        } else {
          events.push({ type: "explosion", x: hitX, z: hitZ, radius: 0.9, kind: "small" });
        }
      }
    } else if (hitType === "destructible" && hitDestructible) {
      damageDestructible(state, hitDestructible, p.damage, p.ownerId, events);
      if (p.blastRadius > 0) {
        triggerExplosion(state, hitX, hitZ, p.blastRadius, p.damage, p.ownerId, p.kind, "medium", events);
      }
    } else if (hitType === "missile" && hitMissile) {
      hitMissile.hp = 0;
      events.push({ type: "explosion", x: hitX, z: hitZ, radius: 1.5, kind: "small" });
      const gmOwner = state.tanks.find((t) => t.guidedMissileId === hitMissile.id);
      if (gmOwner) gmOwner.guidedMissileId = null;
    } else if (hitType === "mine" && hitMineIdx >= 0) {
      const m = state.mines[hitMineIdx];
      state.mines.splice(hitMineIdx, 1);
      triggerExplosion(state, m.x, m.z, WEAPONS.mines.blastRadius, WEAPONS.mines.damage, p.ownerId, "Mines", "medium", events);
    } else if (hitType === "tank" && hitTank) {
      const attacker = state.tanks.find((t) => t.id === p.ownerId);
      if (attacker) attacker.shotsHit += 1;
      if (p.kind === "guided" || p.kind === "homing") {
        if (attacker && attacker.guidedMissileId === p.id) attacker.guidedMissileId = null;
        triggerExplosion(state, hitX, hitZ, p.blastRadius, p.damage, p.ownerId, p.kind === "guided" ? "Guided Missile" : "Homing Missile", "medium", events);
      } else {
        applyDamageToTank(state, hitTank, p.damage, p.ownerId, p.x, p.z, p.kind === "bouncing" ? "Bouncing Shell" : "Cannon", events);
        events.push({ type: "explosion", x: hitX, z: hitZ, radius: 1, kind: "small" });
      }
    }
  }
  state.projectiles = remaining;
}
function stepMines(state, dt, events) {
  const remaining = [];
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
      if (modeMeta.isTeam && t.team === m.ownerTeam) continue;
      if (!modeMeta.isTeam && t.id === m.ownerId && m.age < 2) continue;
      const dist = Math.hypot(t.x - m.x, t.z - m.z);
      if (dist <= WEAPON_TUNING.mineTriggerRadius) {
        triggered = true;
        break;
      }
    }
    if (triggered) {
      triggerExplosion(state, m.x, m.z, WEAPONS.mines.blastRadius, WEAPONS.mines.damage, m.ownerId, "Mines", "medium", events);
    } else {
      remaining.push(m);
    }
  }
  state.mines = remaining;
}
function stepAirstrikes(state, dt, events) {
  const remaining = [];
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
      triggerExplosion(state, sx, sz, WEAPONS.airstrike.blastRadius, WEAPONS.airstrike.damage, as.ownerId, "Airstrike", "large", events);
      as.strikesDropped += 1;
      as.nextDropTimer = WEAPON_TUNING.airstrikeInterval;
    }
    if (as.strikesDropped < WEAPON_TUNING.airstrikeCount) {
      remaining.push(as);
    }
  }
  state.airstrikes = remaining;
}
function stepPowerBoxes(state, dt, events) {
  for (let bIdx = 0; bIdx < state.powerBoxes.length; bIdx++) {
    const box = state.powerBoxes[bIdx];
    if (!box.active) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.active = true;
        box.itemId = pickWeightedPowerBoxItem(state.seed, state.tick * 31 + bIdx, state.settings.mode);
        events.push({ type: "box_respawn", boxId: box.id, x: box.x, z: box.z });
      }
      continue;
    }
    let winner = null;
    let bestDist = POWER_BOX_CONFIG.pickupRadius;
    for (const t of state.tanks) {
      if (!t.alive || t.disconnected) continue;
      const dist = Math.hypot(t.x - box.x, t.z - box.z);
      if (dist <= bestDist) {
        if (!winner || dist < bestDist - 1e-3 || Math.abs(dist - bestDist) <= 1e-3 && t.lastProcessedSeq < winner.lastProcessedSeq) {
          bestDist = dist;
          winner = t;
        }
      }
    }
    if (winner) {
      box.active = false;
      box.respawnTimer = POWER_BOX_CONFIG.respawnSec;
      winner.powerUpsCollected += 1;
      const def = POWER_BOX_ITEMS.find((i) => i.id === box.itemId);
      let replacedWeapon = false;
      if (def.kind === "timed") {
        const timedId = def.id;
        if (timedId === "repair") {
          winner.hp = Math.min(winner.maxHp, winner.hp + 40);
        } else {
          if (timedId === "shield") {
            winner.shieldHp = POWER_BOX_CONFIG.shieldAbsorb;
          } else if (timedId === "speed_boost") {
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
        const wId = def.id;
        replacedWeapon = winner.storedWeapon !== null;
        winner.storedWeapon = wId;
        winner.storedAmmo = WEAPONS[wId].uses;
      }
      events.push({
        type: "pickup",
        tankId: winner.id,
        boxId: box.id,
        itemId: box.itemId,
        replacedWeapon,
        x: box.x,
        z: box.z
      });
    }
  }
}
function stepFlags(state, dt, events) {
  if (!state.flags) return;
  const flags = [state.flags.red, state.flags.blue];
  for (const flag of flags) {
    if (flag.carrierId) {
      const carrier = state.tanks.find((t) => t.id === flag.carrierId);
      if (!carrier || !carrier.alive || carrier.disconnected) {
        flag.carrierId = null;
        flag.atHome = false;
        flag.droppedTimer = PHYSICS.ctfFlagReturnSec;
        events.push({ type: "flag_event", action: "dropped", team: flag.team, x: flag.x, z: flag.z });
      } else {
        flag.x = carrier.x;
        flag.z = carrier.z;
        const ownFlag = carrier.team === "red" ? state.flags.red : state.flags.blue;
        const distHome = Math.hypot(carrier.x - ownFlag.homeX, carrier.z - ownFlag.homeZ);
        if (distHome <= PHYSICS.ctfCaptureRadius) {
          if (ownFlag.atHome) {
            carrier.flagCaptures += 1;
            if (carrier.team === "red") state.teamScores.red += 1;
            else state.teamScores.blue += 1;
            flag.carrierId = null;
            flag.x = flag.homeX;
            flag.z = flag.homeZ;
            flag.atHome = true;
            flag.droppedTimer = 0;
            events.push({
              type: "flag_event",
              action: "captured",
              team: flag.team,
              byName: carrier.name,
              x: ownFlag.homeX,
              z: ownFlag.homeZ
            });
          } else if (state.tick % 45 === 0) {
            events.push({ type: "announcement", text: "Your flag is taken! Recover it first!", tone: "danger" });
          }
        }
      }
      continue;
    }
    if (!flag.atHome) {
      flag.droppedTimer -= dt;
      if (flag.droppedTimer <= 0) {
        flag.x = flag.homeX;
        flag.z = flag.homeZ;
        flag.atHome = true;
        flag.droppedTimer = 0;
        events.push({ type: "flag_event", action: "returned", team: flag.team, x: flag.x, z: flag.z });
        continue;
      }
    }
    for (const t of state.tanks) {
      if (!t.alive || t.disconnected) continue;
      const dist = Math.hypot(t.x - flag.x, t.z - flag.z);
      if (dist <= 2.4) {
        if (t.team === flag.team && !flag.atHome) {
          flag.x = flag.homeX;
          flag.z = flag.homeZ;
          flag.atHome = true;
          flag.droppedTimer = 0;
          events.push({ type: "flag_event", action: "returned", team: flag.team, byName: t.name, x: flag.x, z: flag.z });
          break;
        } else if (t.team !== flag.team) {
          flag.carrierId = t.id;
          flag.atHome = false;
          flag.droppedTimer = 0;
          events.push({ type: "flag_event", action: "taken", team: flag.team, byName: t.name, x: flag.x, z: flag.z });
          break;
        }
      }
    }
  }
}
function stepModes(state, dt, events) {
  const prevTime = state.timeRemainingSec;
  state.timeRemainingSec = Math.max(0, state.timeRemainingSec - dt);
  if (prevTime > 30 && state.timeRemainingSec <= 30 && !state.suddenDeath) {
    events.push({ type: "announcement", text: "Last 30 seconds!", tone: "gold" });
  }
  if (state.safeZone.enabled) {
    const elapsed = state.settings.mode === "lts" ? state.settings.timeLimitSec - state.timeRemainingSec : state.settings.timeLimitSec - state.timeRemainingSec;
    const shrinkEnd = state.settings.timeLimitSec * PHYSICS.safeZoneEndRatio;
    if (elapsed >= PHYSICS.safeZoneStartSec) {
      if (!state.safeZone.shrinking) {
        state.safeZone.shrinking = true;
        events.push({ type: "announcement", text: "Zone shrinking!", tone: "danger" });
      }
      const span = Math.max(10, shrinkEnd - PHYSICS.safeZoneStartSec);
      const t = Math.min(1, (elapsed - PHYSICS.safeZoneStartSec) / span);
      state.safeZone.currentRadius = round3(
        state.safeZone.initialRadius + (state.safeZone.finalRadius - state.safeZone.initialRadius) * t
      );
    }
    if (state.tick % 15 === 0) {
      const tickDmg = PHYSICS.safeZoneDps * 0.5;
      for (const t of state.tanks) {
        if (!t.alive) continue;
        const dist = Math.hypot(t.x - state.safeZone.x, t.z - state.safeZone.z);
        if (dist > state.safeZone.currentRadius) {
          applyDamageToTank(state, t, tickDmg, null, state.safeZone.x, state.safeZone.z, "Safe Zone", events, true);
        }
      }
    }
  }
  if (state.hill && state.settings.mode === "koth") {
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
      events.push({ type: "hill_moved", x: spot.x, z: spot.z });
    }
    const inside = state.tanks.filter(
      (t) => t.alive && Math.hypot(t.x - state.hill.x, t.z - state.hill.z) <= state.hill.r
    );
    const hasRed = inside.some((t) => t.team === "red");
    const hasBlue = inside.some((t) => t.team === "blue");
    if (hasRed && hasBlue) {
      state.hill.holderTeam = "contested";
      state.hill.holderPlayerId = null;
    } else if (hasRed) {
      state.hill.holderTeam = "red";
      if (state.tick % PHYSICS.simHz === 0) {
        state.teamScores.red += 1;
        inside.forEach((t) => t.hillSeconds += 1);
      }
    } else if (hasBlue) {
      state.hill.holderTeam = "blue";
      if (state.tick % PHYSICS.simHz === 0) {
        state.teamScores.blue += 1;
        inside.forEach((t) => t.hillSeconds += 1);
      }
    } else {
      state.hill.holderTeam = "none";
      state.hill.holderPlayerId = null;
    }
  }
  const limit = state.settings.scoreLimit;
  if (state.settings.mode === "ffa") {
    const leader = state.tanks.find((t) => t.kills >= limit);
    if (leader) {
      finishMatch(state, leader.id, null, `${leader.name} reached ${limit} kills!`);
      return;
    }
  } else if (state.settings.mode === "tdm" || state.settings.mode === "ctf" || state.settings.mode === "koth") {
    if (state.teamScores.red >= limit) {
      finishMatch(state, null, "red", `Red Team reached ${limit}!`);
      return;
    }
    if (state.teamScores.blue >= limit) {
      finishMatch(state, null, "blue", `Blue Team reached ${limit}!`);
      return;
    }
  } else if (state.settings.mode === "lts") {
    const aliveTanks = state.tanks.filter((t) => t.alive && !t.disconnected);
    if (state.tanks.length >= 2 && aliveTanks.length <= 1) {
      if (aliveTanks.length === 1) {
        const winner = aliveTanks[0];
        state.roundWins[winner.id] = (state.roundWins[winner.id] ?? 0) + 1;
        events.push({ type: "round_end", winnerId: winner.id, draw: false, roundNumber: state.roundNumber });
        if (state.roundWins[winner.id] >= limit) {
          finishMatch(state, winner.id, null, `${winner.name} won ${limit} rounds!`);
          return;
        }
      } else {
        state.roundDraws += 1;
        events.push({ type: "round_end", winnerId: null, draw: true, roundNumber: state.roundNumber });
        if (state.roundDraws > 2) {
          for (const t of state.tanks) {
            state.roundWins[t.id] = (state.roundWins[t.id] ?? 0) + 1;
            if (state.roundWins[t.id] >= limit) {
              finishMatch(state, t.id, null, `${t.name} won by round tiebreaker!`);
              return;
            }
          }
        }
      }
      state.roundOverTimer = 3;
      return;
    }
  }
  if (state.timeRemainingSec <= 0) {
    if (!state.suddenDeath) {
      if (state.settings.mode === "ffa") {
        const sorted = [...state.tanks].sort((a, b) => b.kills - a.kills);
        if (sorted.length >= 2 && sorted[0].kills === sorted[1].kills) {
          state.suddenDeath = true;
          state.timeRemainingSec = PHYSICS.suddenDeathMaxSec;
          events.push({ type: "announcement", text: "SUDDEN DEATH! Next kill wins!", tone: "danger" });
          return;
        }
        const top = sorted[0];
        finishMatch(state, top?.id ?? null, null, "Time expired!");
      } else if (state.settings.mode === "lts") {
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
          events.push({ type: "announcement", text: "SUDDEN DEATH! Next point wins!", tone: "danger" });
          return;
        }
        const winTeam = state.teamScores.red > state.teamScores.blue ? "red" : "blue";
        finishMatch(state, null, winTeam, `${winTeam === "red" ? "Red" : "Blue"} Team wins on time!`);
      }
    } else {
      finishMatch(state, null, null, "Draw! Sudden death expired.");
    }
  }
}
function startNextLtsRound(state, events) {
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
  events.push({ type: "announcement", text: `Round ${state.roundNumber}!`, tone: "gold" });
}
function finishMatch(state, winnerId, winnerTeam, reason) {
  state.matchEnded = true;
  state.winnerId = winnerId;
  state.winnerTeam = winnerTeam;
  state.winnerReason = reason;
}
function buildMatchResultSummary(state) {
  const sortedPlayers = [...state.tanks].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (a.deaths !== b.deaths) return a.deaths - b.deaths;
    if (b.damageDealt !== a.damageDealt) return b.damageDealt - a.damageDealt;
    return a.name.localeCompare(b.name);
  });
  const winnerTank = state.winnerId ? state.tanks.find((t) => t.id === state.winnerId) : sortedPlayers[0];
  let winnerName = "Draw";
  if (state.winnerTeam === "red") winnerName = "Red Team";
  else if (state.winnerTeam === "blue") winnerName = "Blue Team";
  else if (winnerTank && state.winnerId) winnerName = winnerTank.name;
  else if (sortedPlayers[0] && state.winnerReason !== "Draw! Sudden death expired.") winnerName = sortedPlayers[0].name;
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
    accuracy: t.shotsFired > 0 ? Math.round(t.shotsHit / t.shotsFired * 100) : 0,
    powerUpsCollected: t.powerUpsCollected,
    bestStreak: t.bestStreak,
    flagCaptures: t.flagCaptures,
    hillSeconds: t.hillSeconds,
    leftEarly: t.disconnected
  }));
  const awards = [];
  const withShots = players.filter((p) => p.kills > 0 || p.accuracy > 0);
  if (withShots.length > 0) {
    const sharp = [...withShots].sort((a, b) => b.accuracy - a.accuracy)[0];
    awards.push({ id: "sharpshooter", title: "Sharpshooter", subtitle: "Highest accuracy", playerId: sharp.id, playerName: sharp.name, valueText: `${sharp.accuracy}%` });
  }
  if (players.length > 0) {
    const buster = [...players].sort((a, b) => b.damageDealt - a.damageDealt)[0];
    if (buster.damageDealt > 0) {
      awards.push({ id: "tank_buster", title: "Tank Buster", subtitle: "Most damage dealt", playerId: buster.id, playerName: buster.name, valueText: `${buster.damageDealt}` });
    }
    const survivor = [...players].sort((a, b) => a.deaths - b.deaths || b.kills - a.kills)[0];
    awards.push({ id: "survivor", title: "Survivor", subtitle: "Fewest deaths", playerId: survivor.id, playerName: survivor.name, valueText: `${survivor.deaths} deaths` });
    const collector = [...players].sort((a, b) => b.powerUpsCollected - a.powerUpsCollected)[0];
    if (collector.powerUpsCollected > 0) {
      awards.push({ id: "collector", title: "Collector", subtitle: "Most Power Boxes", playerId: collector.id, playerName: collector.name, valueText: `${collector.powerUpsCollected}` });
    }
    const flagHero = [...players].sort((a, b) => b.flagCaptures - a.flagCaptures)[0];
    if (flagHero.flagCaptures > 0) {
      awards.push({ id: "flag_hero", title: "Flag Hero", subtitle: "Most flag captures", playerId: flagHero.id, playerName: flagHero.name, valueText: `${flagHero.flagCaptures}` });
    }
    const hillKing = [...players].sort((a, b) => b.hillSeconds - a.hillSeconds)[0];
    if (hillKing.hillSeconds > 0) {
      awards.push({ id: "hill_king", title: "Hill King", subtitle: "Most hill time", playerId: hillKing.id, playerName: hillKing.name, valueText: `${hillKing.hillSeconds}s` });
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
    awards: awards.slice(0, 6)
  };
}

// shared/bots.ts
function isPointBlocked(map, x, z) {
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
function hasLineOfSight(map, x1, z1, x2, z2) {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(2, Math.ceil(dist / 3));
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
function computeBotInput(state, bot, memory, difficulty) {
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
  let nearestEnemy = null;
  let nearestDist = Infinity;
  let visibleEnemy = null;
  let visibleDist = Infinity;
  for (const other of state.tanks) {
    if (!other.alive || other.id === bot.id) continue;
    if (bot.team !== "none" && other.team === bot.team) continue;
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
  let goalX = memory.patrolX;
  let goalZ = memory.patrolZ;
  let urgentObjective = false;
  if (state.safeZone.enabled) {
    const distCenter = Math.hypot(bot.x - state.safeZone.x, bot.z - state.safeZone.z);
    if (distCenter > state.safeZone.currentRadius * 0.8) {
      goalX = state.safeZone.x;
      goalZ = state.safeZone.z;
      urgentObjective = true;
    }
  }
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
  if (!urgentObjective && state.settings.mode === "ctf" && state.flags) {
    const ownFlag = bot.team === "red" ? state.flags.red : state.flags.blue;
    const enemyFlag = bot.team === "red" ? state.flags.blue : state.flags.red;
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
  } else if (!urgentObjective && state.settings.mode === "koth" && state.hill) {
    const distHill = Math.hypot(state.hill.x - bot.x, state.hill.z - bot.z);
    if (distHill > state.hill.r * 0.65) {
      goalX = state.hill.x;
      goalZ = state.hill.z;
      urgentObjective = true;
    }
  }
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
  if (!urgentObjective) {
    if (visibleEnemy) {
      if (visibleDist > 36) {
        goalX = visibleEnemy.x;
        goalZ = visibleEnemy.z;
      } else if (visibleDist < 18) {
        goalX = bot.x - (visibleEnemy.x - bot.x);
        goalZ = bot.z - (visibleEnemy.z - bot.z);
      } else {
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
      memory.patrolTimer = 4;
      goalX = memory.patrolX;
      goalZ = memory.patrolZ;
    }
  }
  const desiredHeading = Math.atan2(goalX - bot.x, goalZ - bot.z);
  const whiskerAngles = [0, 0.45, -0.45, 0.9, -0.9];
  let chosenHeading = desiredHeading;
  for (const offset of whiskerAngles) {
    const testAng = desiredHeading + offset;
    const probeX = bot.x + Math.sin(testAng) * 6;
    const probeZ = bot.z + Math.cos(testAng) * 6;
    if (!isPointBlocked(state.map, probeX, probeZ)) {
      chosenHeading = testAng;
      break;
    }
  }
  const diff = angleDiff(bot.hullAngle, chosenHeading);
  let turn = 0;
  if (Math.abs(diff) > 0.12) {
    turn = diff > 0 ? -1 : 1;
  }
  const forward = Math.abs(diff) > 1.8 ? -0.4 : Math.abs(diff) > 1.1 ? 0.35 : 1;
  const target = visibleEnemy ?? nearestEnemy;
  let aimX = bot.x + Math.sin(bot.hullAngle) * 20;
  let aimZ = bot.z + Math.cos(bot.hullAngle) * 20;
  let fire = false;
  let useWeapon = false;
  let dashDir = 0;
  if (target) {
    let aimTargetX = target.x;
    let aimTargetZ = target.z;
    let aimTargetVx = target.vx;
    let aimTargetVz = target.vz;
    if (difficulty !== "easy") {
      for (const d of state.destructibles) {
        if (!d.alive || d.kind !== "barrel") continue;
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
    const jitter = (seededRand(state.seed, Math.floor(state.tick / 15) + bot.name.length) - 0.5) * 2 * cfg.aimErrorDeg * Math.PI / 180;
    const finalAimAng = rawAimAng + jitter;
    const aimDist = Math.hypot(predX - bot.x, predZ - bot.z);
    aimX = bot.x + Math.sin(finalAimAng) * aimDist;
    aimZ = bot.z + Math.cos(finalAimAng) * aimDist;
    if (visibleEnemy && memory.reactionTimer <= 0) {
      const aimErr = Math.abs(angleDiff(bot.turretAngle, rawAimAng));
      if (aimErr < 0.22) {
        fire = true;
      }
      if (bot.storedWeapon && bot.storedWeapon !== "guided") {
        if (bot.storedWeapon === "emp" && visibleDist < 14) useWeapon = true;
        else if (bot.storedWeapon === "mines" && visibleDist < 20) useWeapon = true;
        else if (bot.storedWeapon !== "emp" && bot.storedWeapon !== "mines" && aimErr < 0.28) useWeapon = true;
      }
      if (cls.dashDistance > 0 && bot.dashCooldown <= 0 && visibleDist < 26 && difficulty !== "easy" && state.tick % 45 === 0) {
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
    turbo: (urgentObjective || visibleEnemy !== null && visibleDist > 34) && bot.turboStamina > 0.35,
    handbrake: Math.abs(diff) > 1.35,
    dashDir
  };
}

// shared/protocol.ts
var BAD_WORDS = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot"];
function sanitizeNickname(raw) {
  if (typeof raw !== "string") {
    return `Player${Math.floor(100 + Math.random() * 900)}`;
  }
  let clean = raw.replace(/[<>]/g, "").replace(/[\r\n\t]/g, " ").trim().slice(0, 14);
  if (!clean) {
    return `Player${Math.floor(100 + Math.random() * 900)}`;
  }
  const lower = clean.toLowerCase();
  for (const w of BAD_WORDS) {
    if (lower.includes(w)) {
      clean = clean.replace(new RegExp(w, "gi"), "***");
    }
  }
  return clean;
}
function sanitizeChatText(raw) {
  if (typeof raw !== "string") return "";
  let clean = raw.replace(/[<>]/g, "").replace(/[\r\n\t]/g, " ").trim().slice(0, 80);
  const lower = clean.toLowerCase();
  for (const w of BAD_WORDS) {
    if (lower.includes(w)) {
      clean = clean.replace(new RegExp(w, "gi"), "***");
    }
  }
  return clean;
}
function deduplicateNickname(name, existing) {
  const taken = new Set(existing.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  let idx = 2;
  while (idx < 99) {
    const suffix = ` (${idx})`;
    const base = name.slice(0, Math.max(1, 14 - suffix.length));
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
    idx++;
  }
  return `${name.slice(0, 10)}${Math.floor(100 + Math.random() * 900)}`;
}
function generateRoomCode(existingCodes) {
  const alpha = NETWORK_CONFIG.roomCodeAlphabet;
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = "";
    for (let i = 0; i < NETWORK_CONFIG.roomCodeLength; i++) {
      code += alpha[Math.floor(Math.random() * alpha.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  return "TANK";
}

// server/roomManager.ts
var DEFAULT_SETTINGS = {
  mode: "ffa",
  mapId: "desert_outpost",
  mapSize: "medium",
  timeLimitSec: GAME_MODES.ffa.defaultTimeSec,
  scoreLimit: GAME_MODES.ffa.defaultScoreLimit,
  powerBoxesEnabled: true,
  botCount: 2,
  botDifficulty: "medium",
  friendlyFire: false,
  tankRule: "classes",
  classicHp: 100,
  shrinkingZone: false,
  password: ""
};
var RoomManager = class {
  constructor() {
    this.rooms = /* @__PURE__ */ new Map();
    this.conns = /* @__PURE__ */ new Map();
    this.cleanupTimer = setInterval(() => this.housekeep(), 1e3);
  }
  dispose() {
    clearInterval(this.cleanupTimer);
    for (const room of this.rooms.values()) {
      if (room.tickTimer) clearInterval(room.tickTimer);
    }
    this.rooms.clear();
  }
  getRoomCount() {
    return this.rooms.size;
  }
  handleConnection(ws) {
    const conn = {
      ws,
      playerId: null,
      roomCode: null,
      msgTimestamps: [],
      lastPongAt: Date.now(),
      lastChatAt: 0,
      isSpectator: false
    };
    this.conns.set(ws, conn);
    ws.on("message", (raw) => {
      const byteLen = typeof raw === "string" ? Buffer.byteLength(raw) : raw.length;
      if (byteLen > NETWORK_CONFIG.maxPacketBytes) {
        this.send(ws, { type: "error", code: "BAD_INPUT", message: "Packet too large." });
        return;
      }
      const now = Date.now();
      conn.msgTimestamps.push(now);
      while (conn.msgTimestamps.length > 0 && now - conn.msgTimestamps[0] > 1e3) {
        conn.msgTimestamps.shift();
      }
      if (conn.msgTimestamps.length >= NETWORK_CONFIG.banMsgsPerSec) {
        ws.close(1008, "Rate limit exceeded");
        return;
      }
      if (conn.msgTimestamps.length > NETWORK_CONFIG.maxMsgsPerSec) {
        return;
      }
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      conn.lastPongAt = now;
      this.handleMessage(conn, msg);
    });
    ws.on("close", () => {
      this.handleDisconnect(conn);
      this.conns.delete(ws);
    });
    ws.on("error", () => {
    });
  }
  send(ws, msg) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }
  broadcastRoom(room, msg) {
    const payload = JSON.stringify(msg);
    for (const p of room.players) {
      if (p.conn && p.conn.ws.readyState === 1) {
        p.conn.ws.send(payload);
      }
    }
    for (const s of room.spectators) {
      if (s.ws.readyState === 1) {
        s.ws.send(payload);
      }
    }
  }
  sanitizeCustom(raw) {
    const validClass = raw?.classId === "scout" || raw?.classId === "heavy" ? raw.classId : "standard";
    const validColor = TANK_COLORS.some((c) => c.id === raw?.colorId) ? raw.colorId : "red";
    const validTurret = raw?.turretStyle === "angular" || raw?.turretStyle === "brawler" ? raw.turretStyle : "dome";
    const validDecal = raw?.decal === "star" || raw?.decal === "skull" || raw?.decal === "flame" || raw?.decal === "checker" || raw?.decal === "dots" ? raw.decal : "stripes";
    return { classId: validClass, colorId: validColor, turretStyle: validTurret, decal: validDecal };
  }
  pickFreeColor(room, preferred) {
    if (GAME_MODES[room.settings.mode].isTeam) return preferred;
    const used = new Set(room.players.map((p) => p.custom.colorId));
    if (!used.has(preferred)) return preferred;
    for (const c of TANK_COLORS) {
      if (!used.has(c.id)) return c.id;
    }
    return preferred;
  }
  toRoomStateInfo(room) {
    const safeSettings = { ...room.settings, password: "" };
    return {
      code: room.code,
      phase: room.phase,
      hasPassword: Boolean(room.settings.password),
      settings: safeSettings,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isBot: p.isBot,
        ready: p.ready,
        team: p.team,
        custom: p.custom,
        pingMs: p.pingMs,
        joinedAt: p.joinedAt
      })),
      spectatorCount: room.spectators.length,
      countdownSec: Math.ceil(room.countdownTimer),
      rematchVotes: Array.from(room.rematchVotes)
    };
  }
  handleMessage(conn, msg) {
    if (msg.type === "ping") {
      conn.lastPongAt = Date.now();
      this.send(conn.ws, { type: "pong", clientTime: msg.clientTime, serverTime: Date.now() });
      return;
    }
    if (msg.type === "createRoom") {
      this.leaveCurrentRoom(conn);
      const code = generateRoomCode(new Set(this.rooms.keys()));
      const id = `p_${crypto.randomUUID().slice(0, 8)}`;
      const token = crypto.randomUUID();
      const name = sanitizeNickname(msg.nickname);
      const custom = this.sanitizeCustom(msg.custom);
      const player2 = {
        id,
        token,
        name,
        isHost: true,
        isBot: false,
        ready: false,
        team: "red",
        custom,
        pingMs: 25,
        joinedAt: Date.now(),
        conn,
        disconnectedAt: null,
        lastInput: null,
        lastInputAt: Date.now(),
        lastNeutralWarning: false,
        lastActiveAt: Date.now()
      };
      const room2 = {
        code,
        phase: "LOBBY",
        settings: { ...DEFAULT_SETTINGS, password: typeof msg.password === "string" ? msg.password.slice(0, 24) : "" },
        players: [player2],
        spectators: [],
        kickedIpsOrTokens: /* @__PURE__ */ new Map(),
        chatHistory: [],
        rematchVotes: /* @__PURE__ */ new Set(),
        sim: null,
        botMemories: /* @__PURE__ */ new Map(),
        countdownTimer: 0,
        countdownLastInt: 0,
        matchStartMs: 0,
        lastTickAt: Date.now(),
        snapshotAccum: 0,
        emptySince: null,
        tickTimer: null
      };
      this.rooms.set(code, room2);
      conn.playerId = id;
      conn.roomCode = code;
      conn.isSpectator = false;
      this.send(conn.ws, {
        type: "roomJoined",
        room: this.toRoomStateInfo(room2),
        yourId: id,
        playerToken: token,
        isSpectator: false,
        serverTime: Date.now(),
        chatHistory: []
      });
      return;
    }
    if (msg.type === "joinRoom") {
      const code = typeof msg.code === "string" ? msg.code.trim().toUpperCase() : "";
      const room2 = this.rooms.get(code);
      if (!room2) {
        this.send(conn.ws, {
          type: "error",
          code: "ROOM_NOT_FOUND",
          message: "Room not found. Check the 4-letter code."
        });
        return;
      }
      if (msg.playerToken) {
        const kickUntil = room2.kickedIpsOrTokens.get(msg.playerToken);
        if (kickUntil && kickUntil > Date.now()) {
          this.send(conn.ws, {
            type: "error",
            code: "KICK_COOLDOWN",
            message: "You were removed by the host. Try again in 60s."
          });
          return;
        }
      }
      if (room2.settings.password && msg.password !== room2.settings.password) {
        this.send(conn.ws, {
          type: "error",
          code: "WRONG_PASSWORD",
          message: "Incorrect room password."
        });
        return;
      }
      if (msg.playerToken) {
        const existing = room2.players.find((p) => p.token === msg.playerToken);
        if (existing) {
          this.leaveCurrentRoom(conn);
          existing.conn = conn;
          existing.disconnectedAt = null;
          existing.lastActiveAt = Date.now();
          conn.playerId = existing.id;
          conn.roomCode = room2.code;
          conn.isSpectator = false;
          if (room2.sim) {
            const simTank = room2.sim.tanks.find((t) => t.id === existing.id);
            if (simTank) {
              simTank.disconnected = false;
              simTank.afk = false;
            }
          }
          this.send(conn.ws, {
            type: "roomJoined",
            room: this.toRoomStateInfo(room2),
            yourId: existing.id,
            playerToken: existing.token,
            isSpectator: false,
            serverTime: Date.now(),
            chatHistory: room2.chatHistory
          });
          if (room2.phase === "PLAYING" && room2.sim) {
            this.send(conn.ws, {
              type: "matchStart",
              settings: { ...room2.settings, password: "" },
              seed: room2.sim.seed,
              serverTime: Date.now(),
              snapshot: this.buildSnapshot(room2.sim)
            });
          }
          this.broadcastRoom(room2, { type: "roomUpdate", room: this.toRoomStateInfo(room2) });
          return;
        }
      }
      if (msg.asSpectator) {
        if (room2.spectators.length >= NETWORK_CONFIG.maxSpectators) {
          this.send(conn.ws, { type: "error", code: "ROOM_FULL", message: "Spectator slots are full." });
          return;
        }
        this.leaveCurrentRoom(conn);
        conn.playerId = `spec_${crypto.randomUUID().slice(0, 6)}`;
        conn.roomCode = room2.code;
        conn.isSpectator = true;
        room2.spectators.push(conn);
        this.send(conn.ws, {
          type: "roomJoined",
          room: this.toRoomStateInfo(room2),
          yourId: conn.playerId,
          playerToken: "",
          isSpectator: true,
          serverTime: Date.now(),
          chatHistory: room2.chatHistory
        });
        if (room2.phase === "PLAYING" && room2.sim) {
          this.send(conn.ws, {
            type: "matchStart",
            settings: { ...room2.settings, password: "" },
            seed: room2.sim.seed,
            serverTime: Date.now(),
            snapshot: this.buildSnapshot(room2.sim)
          });
        }
        this.broadcastRoom(room2, { type: "roomUpdate", room: this.toRoomStateInfo(room2) });
        return;
      }
      if (room2.players.length >= NETWORK_CONFIG.maxHumans) {
        this.send(conn.ws, {
          type: "error",
          code: "ROOM_FULL",
          message: "Room is full.",
          canSpectate: room2.spectators.length < NETWORK_CONFIG.maxSpectators
        });
        return;
      }
      const isLatePlaying = room2.phase === "PLAYING" && room2.sim;
      if (isLatePlaying && room2.sim.timeRemainingSec < 60 && room2.settings.mode !== "lts") {
        this.send(conn.ws, {
          type: "error",
          code: "IN_PROGRESS_FULL",
          message: "Match ending soon (<60s). Join as spectator?",
          canSpectate: true
        });
        return;
      }
      this.leaveCurrentRoom(conn);
      const id = `p_${crypto.randomUUID().slice(0, 8)}`;
      const token = crypto.randomUUID();
      const baseName = sanitizeNickname(msg.nickname);
      const name = deduplicateNickname(baseName, room2.players);
      const custom = this.sanitizeCustom(msg.custom);
      custom.colorId = this.pickFreeColor(room2, custom.colorId);
      const redCount = room2.players.filter((p) => p.team === "red").length;
      const blueCount = room2.players.filter((p) => p.team === "blue").length;
      const team = redCount <= blueCount ? "red" : "blue";
      const newPlayer = {
        id,
        token,
        name,
        isHost: room2.players.length === 0,
        isBot: false,
        ready: false,
        team,
        custom,
        pingMs: 25,
        joinedAt: Date.now(),
        conn,
        disconnectedAt: null,
        lastInput: null,
        lastInputAt: Date.now(),
        lastNeutralWarning: false,
        lastActiveAt: Date.now()
      };
      room2.players.push(newPlayer);
      room2.emptySince = null;
      conn.playerId = id;
      conn.roomCode = room2.code;
      conn.isSpectator = false;
      this.send(conn.ws, {
        type: "roomJoined",
        room: this.toRoomStateInfo(room2),
        yourId: id,
        playerToken: token,
        isSpectator: false,
        serverTime: Date.now(),
        chatHistory: room2.chatHistory
      });
      if (isLatePlaying && room2.sim) {
        if (room2.settings.mode !== "lts") {
          const sp = selectSafeSpawn(room2.sim.map, room2.sim.tanks, team, -1, room2.sim.seed, room2.sim.tick);
          room2.sim.tanks.push({
            id: newPlayer.id,
            name: newPlayer.name,
            isBot: false,
            team: GAME_MODES[room2.settings.mode].isTeam ? team : "none",
            custom: newPlayer.custom,
            x: sp.x,
            z: sp.z,
            vx: 0,
            vz: 0,
            hullAngle: sp.angle,
            turretAngle: sp.angle,
            speed: 0,
            hp: room2.settings.classicHp,
            maxHp: room2.settings.classicHp,
            alive: false,
            respawnTimer: 3,
            spawnShieldTimer: 2,
            reloadTimer: 0,
            reloadMax: 1.1,
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
            groundType: "normal",
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
            pingMs: 25
          });
        }
        this.send(conn.ws, {
          type: "matchStart",
          settings: { ...room2.settings, password: "" },
          seed: room2.sim.seed,
          serverTime: Date.now(),
          snapshot: this.buildSnapshot(room2.sim)
        });
      } else if (room2.phase === "RESULTS") {
        room2.phase = "LOBBY";
      }
      this.broadcastRoom(room2, { type: "roomUpdate", room: this.toRoomStateInfo(room2) });
      return;
    }
    if (!conn.roomCode) return;
    const room = this.rooms.get(conn.roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === conn.playerId);
    switch (msg.type) {
      case "leaveRoom": {
        this.leaveCurrentRoom(conn);
        break;
      }
      case "setReady": {
        if (!player || room.phase !== "LOBBY") break;
        player.ready = Boolean(msg.ready);
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        break;
      }
      case "setTank": {
        if (!player || room.phase !== "LOBBY") break;
        const custom = this.sanitizeCustom(msg.custom);
        custom.colorId = this.pickFreeColor(room, custom.colorId);
        player.custom = custom;
        player.ready = false;
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        break;
      }
      case "setTeam": {
        if (!player || !player.isHost || room.phase !== "LOBBY") break;
        const target = room.players.find((p) => p.id === msg.targetPlayerId);
        if (target && (msg.team === "red" || msg.team === "blue")) {
          target.team = msg.team;
          this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        }
        break;
      }
      case "hostSettings": {
        if (!player || !player.isHost || room.phase !== "LOBBY") break;
        const next = msg.settings;
        if (next.mode && GAME_MODES[next.mode]) {
          room.settings.mode = next.mode;
          room.settings.timeLimitSec = GAME_MODES[next.mode].defaultTimeSec;
          room.settings.scoreLimit = GAME_MODES[next.mode].defaultScoreLimit;
        }
        if (next.mapId) room.settings.mapId = next.mapId;
        if (next.mapSize) room.settings.mapSize = next.mapSize;
        if (typeof next.timeLimitSec === "number") {
          room.settings.timeLimitSec = Math.max(60, Math.min(1800, Math.round(next.timeLimitSec)));
        }
        if (typeof next.scoreLimit === "number") {
          room.settings.scoreLimit = Math.max(1, Math.min(300, Math.round(next.scoreLimit)));
        }
        if (typeof next.powerBoxesEnabled === "boolean") room.settings.powerBoxesEnabled = next.powerBoxesEnabled;
        if (typeof next.botCount === "number") {
          const maxBots = Math.max(0, Math.min(8, NETWORK_CONFIG.maxTotalTanks - room.players.length));
          room.settings.botCount = Math.max(0, Math.min(maxBots, Math.round(next.botCount)));
        }
        if (next.botDifficulty) room.settings.botDifficulty = next.botDifficulty;
        if (typeof next.friendlyFire === "boolean") room.settings.friendlyFire = next.friendlyFire;
        if (next.tankRule === "classic" || next.tankRule === "classes") room.settings.tankRule = next.tankRule;
        if (next.classicHp === 100 || next.classicHp === 150) room.settings.classicHp = next.classicHp;
        if (typeof next.shrinkingZone === "boolean") room.settings.shrinkingZone = next.shrinkingZone;
        if (typeof next.password === "string") room.settings.password = next.password.slice(0, 24);
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        break;
      }
      case "kickPlayer": {
        if (!player || !player.isHost) break;
        const idx = room.players.findIndex((p) => p.id === msg.targetPlayerId);
        if (idx === -1 || room.players[idx].id === player.id) break;
        const kicked = room.players[idx];
        room.players.splice(idx, 1);
        room.kickedIpsOrTokens.set(kicked.token, Date.now() + NETWORK_CONFIG.kickBanSec * 1e3);
        if (kicked.conn) {
          this.send(kicked.conn.ws, { type: "kicked", reason: "You were removed by the host." });
          kicked.conn.roomCode = null;
          kicked.conn.playerId = null;
        }
        this.broadcastRoom(room, { type: "toast", text: `${kicked.name} was removed by the host.`, tone: "warn" });
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        break;
      }
      case "startMatch": {
        if (!player || !player.isHost || room.phase !== "LOBBY") break;
        const readyHumans = room.players.filter((p) => p.ready || p.isHost).length;
        const allHumansReady = room.players.every((p) => p.ready || p.isHost);
        const canStart = room.players.length >= 2 && allHumansReady || room.players.length === 1 && room.settings.botCount >= 1;
        if (!canStart || readyHumans < 1) {
          this.send(conn.ws, {
            type: "error",
            code: "CANNOT_START",
            message: "Need at least 2 ready players or 1 player with bots."
          });
          break;
        }
        this.beginCountdown(room);
        break;
      }
      case "input": {
        if (!player || room.phase !== "PLAYING" || !room.sim) break;
        player.lastInput = clampInput(msg.input, room.sim.map);
        player.lastInputAt = Date.now();
        player.lastActiveAt = Date.now();
        const t = room.sim.tanks.find((tk) => tk.id === player.id);
        if (t && t.afk) {
          t.afk = false;
        }
        break;
      }
      case "chat": {
        if (!player) break;
        const now = Date.now();
        if (now - conn.lastChatAt < 1e3) break;
        if (room.phase === "PLAYING" && now - room.matchStartMs < 5e3 && !msg.isQuick) break;
        const text = sanitizeChatText(msg.text);
        if (!text) break;
        conn.lastChatAt = now;
        const chatMsg = {
          id: crypto.randomUUID().slice(0, 8),
          senderId: player.id,
          senderName: player.name,
          team: GAME_MODES[room.settings.mode].isTeam ? player.team : "none",
          text,
          timestamp: now,
          isQuick: Boolean(msg.isQuick)
        };
        room.chatHistory.push(chatMsg);
        if (room.chatHistory.length > 50) room.chatHistory.shift();
        this.broadcastRoom(room, { type: "chat", message: chatMsg });
        break;
      }
      case "rematch": {
        if (!player || room.phase !== "RESULTS") break;
        room.rematchVotes.add(player.id);
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        if (room.rematchVotes.size >= room.players.length) {
          room.rematchVotes.clear();
          this.beginCountdown(room);
        }
        break;
      }
      case "backToLobby": {
        if (!player || !player.isHost || room.phase !== "RESULTS") break;
        room.phase = "LOBBY";
        room.sim = null;
        room.rematchVotes.clear();
        room.players.forEach((p) => {
          if (!p.isHost) p.ready = false;
        });
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
        break;
      }
    }
  }
  beginCountdown(room) {
    room.phase = "COUNTDOWN";
    room.countdownTimer = 3;
    room.countdownLastInt = 4;
    if (room.tickTimer) clearInterval(room.tickTimer);
    room.lastTickAt = Date.now();
    room.tickTimer = setInterval(() => this.tickRoom(room), 1e3 / PHYSICS.simHz);
    this.broadcastRoom(room, {
      type: "countdown",
      secondsLeft: 3,
      settings: { ...room.settings, password: "" }
    });
  }
  startMatch(room) {
    const seed = Math.floor(Math.random() * 1e6) + 1;
    const participants = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isBot: false,
      ready: true,
      team: p.team,
      custom: p.custom,
      pingMs: p.pingMs,
      joinedAt: p.joinedAt
    }));
    const botCount = Math.min(room.settings.botCount, NETWORK_CONFIG.maxTotalTanks - participants.length);
    room.botMemories.clear();
    const classIds = ["scout", "standard", "heavy"];
    for (let i = 0; i < botCount; i++) {
      const botId = `bot_${i + 1}`;
      const redCount = participants.filter((p) => p.team === "red").length;
      const blueCount = participants.filter((p) => p.team === "blue").length;
      const team = redCount <= blueCount ? "red" : "blue";
      const color = TANK_COLORS[(i + 3) % TANK_COLORS.length].id;
      participants.push({
        id: botId,
        name: `Bot ${["Alpha", "Bravo", "Cobra", "Delta", "Echo", "Fox", "Ghost", "Hawk"][i] ?? i + 1}`,
        isHost: false,
        isBot: true,
        ready: true,
        team,
        custom: {
          classId: room.settings.tankRule === "classes" ? classIds[i % 3] : "standard",
          colorId: color,
          turretStyle: i % 2 === 0 ? "dome" : "angular",
          decal: "stripes"
        },
        pingMs: 0,
        joinedAt: Date.now()
      });
      room.botMemories.set(botId, {
        patrolX: 0,
        patrolZ: 0,
        patrolTimer: 0,
        strafeSign: i % 2 === 0 ? 1 : -1,
        strafeTimer: 1.5,
        reactionTimer: 0.3,
        seq: 0
      });
    }
    room.sim = createSimState(participants, room.settings, seed);
    room.phase = "PLAYING";
    room.matchStartMs = Date.now();
    room.snapshotAccum = 0;
    this.broadcastRoom(room, {
      type: "matchStart",
      settings: { ...room.settings, password: "" },
      seed,
      serverTime: Date.now(),
      snapshot: this.buildSnapshot(room.sim)
    });
  }
  tickRoom(room) {
    try {
      const now = Date.now();
      if (room.phase === "COUNTDOWN") {
        room.countdownTimer -= PHYSICS.fixedDt;
        const ceil = Math.ceil(room.countdownTimer);
        if (ceil !== room.countdownLastInt && ceil > 0) {
          room.countdownLastInt = ceil;
          this.broadcastRoom(room, {
            type: "countdown",
            secondsLeft: ceil,
            settings: { ...room.settings, password: "" }
          });
        }
        if (room.countdownTimer <= 0) {
          this.startMatch(room);
        }
        return;
      }
      if (room.phase !== "PLAYING" || !room.sim) return;
      const activeTanks = room.sim.tanks.filter((t) => !t.disconnected);
      if (activeTanks.length < 2 && room.settings.botCount === 0) {
        finishMatch(room.sim, activeTanks[0]?.id ?? null, null, "Other players left the match.");
      }
      const inputsByTankId = {};
      for (const p of room.players) {
        const tank = room.sim.tanks.find((t) => t.id === p.id);
        if (!tank) continue;
        if (!p.disconnectedAt && now - p.lastActiveAt > NETWORK_CONFIG.afkWarnSec * 1e3) {
          tank.afk = true;
        }
        if (p.lastInput && now - p.lastInputAt <= NETWORK_CONFIG.neutralInputTimeoutSec * 1e3) {
          inputsByTankId[p.id] = p.lastInput;
        }
      }
      for (const tank of room.sim.tanks) {
        if (!tank.isBot || !tank.alive) continue;
        const mem = room.botMemories.get(tank.id);
        if (mem) {
          inputsByTankId[tank.id] = computeBotInput(room.sim, tank, mem, room.settings.botDifficulty);
        }
      }
      const events = [];
      stepSim(room.sim, inputsByTankId, events);
      if (events.length > 0) {
        this.broadcastRoom(room, { type: "event", events });
      }
      room.snapshotAccum += PHYSICS.fixedDt;
      if (room.snapshotAccum >= 1 / PHYSICS.snapshotHz) {
        room.snapshotAccum = 0;
        this.broadcastRoom(room, { type: "snapshot", snapshot: this.buildSnapshot(room.sim) });
      }
      if (room.sim.matchEnded) {
        if (room.tickTimer) {
          clearInterval(room.tickTimer);
          room.tickTimer = null;
        }
        room.phase = "RESULTS";
        room.rematchVotes.clear();
        const summary = buildMatchResultSummary(room.sim);
        this.broadcastRoom(room, {
          type: "matchEnd",
          summary,
          room: this.toRoomStateInfo(room)
        });
      }
    } catch (err) {
      console.error(`[Room ${room.code}] Tick error:`, err);
    }
  }
  buildSnapshot(sim) {
    const r2 = (n) => Math.round(n * 100) / 100;
    return {
      tick: sim.tick,
      serverTime: Date.now(),
      timeRemainingSec: r2(sim.timeRemainingSec),
      suddenDeath: sim.suddenDeath,
      roundNumber: sim.roundNumber,
      roundWins: sim.roundWins,
      teamScores: sim.teamScores,
      tanks: sim.tanks.map((t) => ({
        ...t,
        x: r2(t.x),
        z: r2(t.z),
        vx: r2(t.vx),
        vz: r2(t.vz),
        hullAngle: Math.round(t.hullAngle * 1e3) / 1e3,
        turretAngle: Math.round(t.turretAngle * 1e3) / 1e3
      })),
      projectiles: sim.projectiles.map((p) => ({
        ...p,
        x: r2(p.x),
        y: r2(p.y),
        z: r2(p.z)
      })),
      mines: sim.mines,
      airstrikes: sim.airstrikes,
      powerBoxes: sim.powerBoxes,
      destructibles: sim.destructibles,
      flags: sim.flags,
      hill: sim.hill,
      safeZone: sim.safeZone
    };
  }
  handleDisconnect(conn) {
    if (!conn.roomCode) return;
    const room = this.rooms.get(conn.roomCode);
    if (!room) return;
    if (conn.isSpectator) {
      room.spectators = room.spectators.filter((s) => s !== conn);
      this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
      return;
    }
    const player = room.players.find((p) => p.id === conn.playerId);
    if (!player) return;
    if (room.phase === "PLAYING" && room.sim) {
      player.conn = null;
      player.disconnectedAt = Date.now();
      const t = room.sim.tanks.find((tk) => tk.id === player.id);
      if (t) {
        t.disconnected = true;
        t.vx = 0;
        t.vz = 0;
        if (room.sim.flags) {
          for (const f of [room.sim.flags.red, room.sim.flags.blue]) {
            if (f.carrierId === t.id) {
              f.carrierId = null;
              f.atHome = false;
              f.droppedTimer = PHYSICS.ctfFlagReturnSec;
            }
          }
        }
      }
      this.migrateHostIfNeeded(room, player.id);
    } else {
      this.removePlayerFromRoom(room, player.id);
    }
  }
  leaveCurrentRoom(conn) {
    if (!conn.roomCode) return;
    const room = this.rooms.get(conn.roomCode);
    if (room) {
      if (conn.isSpectator) {
        room.spectators = room.spectators.filter((s) => s !== conn);
      } else if (conn.playerId) {
        this.removePlayerFromRoom(room, conn.playerId);
      }
    }
    conn.roomCode = null;
    conn.playerId = null;
    conn.isSpectator = false;
  }
  removePlayerFromRoom(room, playerId) {
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    const removed = room.players[idx];
    room.players.splice(idx, 1);
    if (room.sim) {
      const t = room.sim.tanks.find((tk) => tk.id === playerId);
      if (t) t.disconnected = true;
    }
    if (removed.isHost && room.players.length > 0) {
      this.migrateHost(room);
    }
    if (room.players.every((p) => !p.conn)) {
      room.emptySince = Date.now();
    }
    this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
  }
  migrateHostIfNeeded(room, disconnectedId) {
    const p = room.players.find((pl) => pl.id === disconnectedId);
    if (p?.isHost) {
      const next = room.players.find((pl) => pl.id !== disconnectedId && pl.conn);
      if (next) {
        p.isHost = false;
        next.isHost = true;
        this.broadcastRoom(room, { type: "toast", text: `${next.name} is now the host`, tone: "info" });
        this.broadcastRoom(room, { type: "roomUpdate", room: this.toRoomStateInfo(room) });
      }
    }
  }
  migrateHost(room) {
    const sorted = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt);
    room.players.forEach((p) => p.isHost = false);
    if (sorted[0]) {
      sorted[0].isHost = true;
      this.broadcastRoom(room, { type: "toast", text: `${sorted[0].name} is now the host`, tone: "info" });
    }
  }
  housekeep() {
    const now = Date.now();
    for (const [ws, conn] of this.conns.entries()) {
      if (now - conn.lastPongAt > NETWORK_CONFIG.pingTimeoutMs) {
        ws.terminate();
        this.handleDisconnect(conn);
        this.conns.delete(ws);
      }
    }
    for (const [code, room] of this.rooms.entries()) {
      for (const p of [...room.players]) {
        if (p.disconnectedAt && now - p.disconnectedAt > NETWORK_CONFIG.reconnectGraceSec * 1e3) {
          this.removePlayerFromRoom(room, p.id);
        }
      }
      const activeHumans = room.players.filter((p) => p.conn !== null).length;
      if (activeHumans === 0 && room.spectators.length === 0) {
        if (!room.emptySince) room.emptySince = now;
        if (now - room.emptySince > NETWORK_CONFIG.roomDeleteIdleSec * 1e3) {
          if (room.tickTimer) clearInterval(room.tickTimer);
          this.rooms.delete(code);
        }
      } else {
        room.emptySince = null;
      }
    }
  }
};

// server.ts
var PORT = Number(process.env.PORT) || 3e3;
var IS_PROD = process.env.NODE_ENV === "production";
async function bootstrap() {
  const app = express();
  const server = http.createServer(app);
  const roomManager = new RoomManager();
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, rooms: roomManager.getRoomCount() });
  });
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 8192 });
  wss.on("connection", (ws) => {
    roomManager.handleConnection(ws);
  });
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Tank Duel Online server listening on http://0.0.0.0:${PORT}`);
  });
  const shutdown = () => {
    roomManager.dispose();
    wss.close();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
bootstrap().catch((err) => {
  console.error("Failed to start Tank Duel Online server:", err);
  process.exit(1);
});
