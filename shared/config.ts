// Single source of truth for all tunable numbers in Tank Duel Online.
// Sections 5, 6, 7, 8, 9, 10, 11, 12, 19, 20, 28, 31, 32.

export type TankClassId = 'scout' | 'standard' | 'heavy';
export type GameModeId = 'ffa' | 'tdm' | 'lts' | 'ctf' | 'koth';
export type MapId =
  | 'desert_outpost'
  | 'industrial_yard'
  | 'frozen_lake'
  | 'forest_maze'
  | 'twin_bases'
  | 'crater_hill';
export type MapSizeId = 'small' | 'medium' | 'large';
export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface TankClassConfig {
  id: TankClassId;
  name: string;
  tagline: string;
  width: number;
  length: number;
  height: number;
  turretRadius: number;
  barrelLength: number;
  health: number;
  forwardSpeed: number;
  reverseSpeed: number;
  accel: number;
  brake: number;
  hullTurnStandingDeg: number;
  hullTurnFullSpeedDeg: number;
  turretTurnDeg: number;
  cannonDamage: number;
  cannonReload: number;
  shellSpeed: number;
  turboMult: number;
  turboDuration: number;
  turboRecharge: number;
  dashDistance: number;
  dashDuration: number;
  dashCooldown: number;
  frontArmorReduction: number;
  frontArmorArcDeg: number;
  statBars: {
    speed: number;
    armor: number;
    firepower: number;
    reload: number;
    agility: number;
  };
  specialText: string;
}

export const TANK_CLASSES: Record<TankClassId, TankClassConfig> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    tagline: 'Fast & Agile',
    width: 1.4,
    length: 2.3,
    height: 0.7,
    turretRadius: 0.42,
    barrelLength: 1.35,
    health: 80,
    forwardSpeed: 12.0,
    reverseSpeed: 7.5,
    accel: 34,
    brake: 46,
    hullTurnStandingDeg: 210,
    hullTurnFullSpeedDeg: 155,
    turretTurnDeg: 460,
    cannonDamage: 24,
    cannonReload: 0.9,
    shellSpeed: 42,
    turboMult: 1.55,
    turboDuration: 3.0,
    turboRecharge: 5.0,
    dashDistance: 6.0,
    dashDuration: 0.25,
    dashCooldown: 4.0,
    frontArmorReduction: 0,
    frontArmorArcDeg: 0,
    statBars: { speed: 95, armor: 42, firepower: 55, reload: 92, agility: 96 },
    specialText: 'Dash: Sideways dodge (Q / E), 6m in 0.25s (4s CD)',
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    tagline: 'Balanced Fighter',
    width: 1.6,
    length: 2.6,
    height: 0.8,
    turretRadius: 0.5,
    barrelLength: 1.6,
    health: 100,
    forwardSpeed: 10.0,
    reverseSpeed: 6.2,
    accel: 28,
    brake: 40,
    hullTurnStandingDeg: 180,
    hullTurnFullSpeedDeg: 130,
    turretTurnDeg: 400,
    cannonDamage: 30,
    cannonReload: 1.05,
    shellSpeed: 39,
    turboMult: 1.5,
    turboDuration: 3.0,
    turboRecharge: 6.0,
    dashDistance: 0,
    dashDuration: 0,
    dashCooldown: 0,
    frontArmorReduction: 0,
    frontArmorArcDeg: 0,
    statBars: { speed: 72, armor: 65, firepower: 74, reload: 74, agility: 72 },
    specialText: 'Versatile all-rounder with balanced speed and punch',
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    tagline: 'Armored Juggernaut',
    width: 1.9,
    length: 3.0,
    height: 0.9,
    turretRadius: 0.62,
    barrelLength: 1.85,
    health: 150,
    forwardSpeed: 7.8,
    reverseSpeed: 4.8,
    accel: 22,
    brake: 34,
    hullTurnStandingDeg: 145,
    hullTurnFullSpeedDeg: 105,
    turretTurnDeg: 320,
    cannonDamage: 38,
    cannonReload: 1.45,
    shellSpeed: 36,
    turboMult: 1.35,
    turboDuration: 2.5,
    turboRecharge: 7.0,
    dashDistance: 0,
    dashDuration: 0,
    dashCooldown: 0,
    frontArmorReduction: 0.15,
    frontArmorArcDeg: 60,
    statBars: { speed: 48, armor: 98, firepower: 95, reload: 50, agility: 48 },
    specialText: 'Armor Plating: -15% damage from frontal 60° arc',
  },
};

export const TANK_COLORS = [
  { id: 'red', name: 'Crimson', hex: '#EF4444' },
  { id: 'blue', name: 'Cobalt', hex: '#3B82F6' },
  { id: 'green', name: 'Emerald', hex: '#10B981' },
  { id: 'yellow', name: 'Solar', hex: '#FACC15' },
  { id: 'orange', name: 'Blaze', hex: '#F97316' },
  { id: 'purple', name: 'Violet', hex: '#8B5CF6' },
  { id: 'pink', name: 'Neon Rose', hex: '#EC4899' },
  { id: 'teal', name: 'Mint', hex: '#00E5C3' },
  { id: 'white', name: 'Arctic', hex: '#F1F5F9' },
  { id: 'black', name: 'Obsidian', hex: '#1E293B' },
  { id: 'gold', name: 'Royal Gold', hex: '#FFC83D' },
  { id: 'camo', name: 'Olive Camo', hex: '#65A30D' },
] as const;

export const TURRET_STYLES = [
  { id: 'dome', name: 'Classic Dome' },
  { id: 'angular', name: 'Stealth Wedge' },
  { id: 'brawler', name: 'Heavy Box' },
] as const;

export const DECAL_STYLES = [
  { id: 'stripes', name: 'Stripes' },
  { id: 'star', name: 'Star' },
  { id: 'skull', name: 'Skull' },
  { id: 'flame', name: 'Flame' },
  { id: 'checker', name: 'Checker' },
  { id: 'dots', name: 'Dots' },
] as const;

export const PHYSICS = {
  simHz: 30,
  fixedDt: 1 / 30,
  snapshotHz: 20,
  handbrakeTurnMult: 1.8,
  handbrakeSpeedCapRatio: 0.4,
  iceFriction: 0.15,
  iceTurnDelayFactor: 2.2,
  mudSpeedMult: 0.6,
  speedPadMult: 1.4,
  speedPadDuration: 2.0,
  tankSeparationSpeed: 4.0,
  shellRadius: 0.3,
  shellLifetime: 2.2,
  shellMaxRicochets: 1,
  respawnDelay: 3.0,
  spawnShieldDuration: 2.0,
  spawnMinEnemyDist: 40,
  spawnMinAnyTankDist: 8,
  assistWindowSec: 5.0,
  ctfCarrierSpeedMult: 0.85,
  ctfFlagReturnSec: 15.0,
  ctfCaptureRadius: 5.0,
  kothMoveIntervalSec: 45.0,
  kothZoneRadius: 10.0,
  safeZoneStartSec: 30.0,
  safeZoneEndRatio: 0.7,
  safeZoneFinalRadius: 20.0,
  safeZoneDps: 5.0,
  suddenDeathMaxSec: 60.0,
  destructionChainRadius: 2.0,
  destructionChainDamage: 15,
  crateHp: 30,
  barrelHp: 20,
  barrelBlastRadius: 6.0,
  barrelBlastDamage: 40,
  wallCrackedHp: 60,
};

export type StoredWeaponId =
  | 'homing'
  | 'cluster'
  | 'guided'
  | 'bouncing'
  | 'emp'
  | 'mines'
  | 'airstrike';

export type TimedBuffId =
  | 'repair'
  | 'shield'
  | 'rapid_fire'
  | 'triple_shot'
  | 'speed_boost'
  | 'damage_up';

export type PowerBoxItemId = StoredWeaponId | TimedBuffId;

export interface WeaponDef {
  id: StoredWeaponId;
  name: string;
  uses: number;
  damage: number;
  blastRadius: number;
  speed: number;
  lifetime: number;
  missileHp: number;
  description: string;
  rarity: 'gold' | 'purple';
}

export const WEAPONS: Record<StoredWeaponId, WeaponDef> = {
  homing: {
    id: 'homing',
    name: 'Homing Missile',
    uses: 1,
    damage: 45,
    blastRadius: 2.0,
    speed: 28,
    lifetime: 4.0,
    missileHp: 10,
    description: 'Curves toward enemies in a 60° front cone up to 90m.',
    rarity: 'gold',
  },
  cluster: {
    id: 'cluster',
    name: 'Cluster Missile',
    uses: 1,
    damage: 18,
    blastRadius: 2.5,
    speed: 32,
    lifetime: 2.5,
    missileHp: 10,
    description: 'Airbursts at aim pin (max 70m), dropping 5 bomblets in 6m.',
    rarity: 'gold',
  },
  guided: {
    id: 'guided',
    name: 'Guided Missile',
    uses: 1,
    damage: 50,
    blastRadius: 3.0,
    speed: 26,
    lifetime: 4.0,
    missileHp: 10,
    description: 'Steer directly with mouse for 4s while your tank holds still.',
    rarity: 'purple',
  },
  bouncing: {
    id: 'bouncing',
    name: 'Bouncing Shell',
    uses: 3,
    damage: 35,
    blastRadius: 1.5,
    speed: 38,
    lifetime: 3.2,
    missileHp: 10,
    description: 'Heavy incendiary shell that ricochets up to 3 times.',
    rarity: 'gold',
  },
  emp: {
    id: 'emp',
    name: 'EMP Pulse',
    uses: 1,
    damage: 0,
    blastRadius: 15.0,
    speed: 0,
    lifetime: 0.5,
    missileHp: 999,
    description: '15m blast slows enemies 50%, strips shields, disables weapons 3s.',
    rarity: 'gold',
  },
  mines: {
    id: 'mines',
    name: 'Mines',
    uses: 3,
    damage: 50,
    blastRadius: 3.0,
    speed: 0,
    lifetime: 45.0,
    missileHp: 10,
    description: 'Drop behind tank. Arms in 1s, cloaks from enemies after 2s.',
    rarity: 'gold',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Airstrike',
    uses: 1,
    damage: 40,
    blastRadius: 4.0,
    speed: 0,
    lifetime: 1.5,
    missileHp: 999,
    description: 'Marks pin; 3 shells rain down in a 5m line after 1.5s.',
    rarity: 'purple',
  },
};

export const WEAPON_TUNING = {
  homingConeDeg: 60,
  homingRange: 90,
  homingTurnDeg: 80,
  clusterMaxRange: 70,
  clusterBombletCount: 5,
  clusterSpreadRadius: 6.0,
  clusterDropTime: 0.6,
  guidedTurnDeg: 135,
  bouncingMaxBounces: 3,
  empSlowMult: 0.5,
  empDuration: 3.0,
  mineArmDelay: 1.0,
  mineHideDelay: 2.0,
  mineTriggerRadius: 1.8,
  airstrikeDelay: 1.5,
  airstrikeSpacing: 5.0,
  airstrikeCount: 3,
  airstrikeInterval: 0.4,
};

export interface PowerBoxDef {
  id: PowerBoxItemId;
  kind: 'timed' | 'stored';
  name: string;
  duration: number; // 0 for instant/stored
  weight: number;
  rarity: 'green' | 'blue' | 'gold' | 'purple';
  summary: string;
}

export const POWER_BOX_ITEMS: PowerBoxDef[] = [
  { id: 'repair', kind: 'timed', name: 'Repair Kit', duration: 0, weight: 18, rarity: 'green', summary: '+40 HP instant' },
  { id: 'shield', kind: 'timed', name: 'Shield', duration: 6, weight: 10, rarity: 'blue', summary: '50 HP barrier (6s)' },
  { id: 'rapid_fire', kind: 'timed', name: 'Rapid Fire', duration: 8, weight: 10, rarity: 'blue', summary: 'Reload x0.4 (8s)' },
  { id: 'triple_shot', kind: 'timed', name: 'Triple Shot', duration: 8, weight: 8, rarity: 'blue', summary: '3-shell fan (8s)' },
  { id: 'speed_boost', kind: 'timed', name: 'Speed Boost', duration: 6, weight: 8, rarity: 'blue', summary: 'Speed x1.4 + Turbo (6s)' },
  { id: 'damage_up', kind: 'timed', name: 'Damage Up', duration: 8, weight: 6, rarity: 'purple', summary: 'Damage x1.6 (8s)' },
  { id: 'homing', kind: 'stored', name: 'Homing Missile', duration: 0, weight: 8, rarity: 'gold', summary: 'Tracking missile' },
  { id: 'cluster', kind: 'stored', name: 'Cluster Missile', duration: 0, weight: 7, rarity: 'gold', summary: '5-bomblet airburst' },
  { id: 'guided', kind: 'stored', name: 'Guided Missile', duration: 0, weight: 4, rarity: 'purple', summary: 'Mouse-steered missile' },
  { id: 'bouncing', kind: 'stored', name: 'Bouncing Shell', duration: 0, weight: 7, rarity: 'gold', summary: '3x ricochet (3 uses)' },
  { id: 'emp', kind: 'stored', name: 'EMP Pulse', duration: 0, weight: 5, rarity: 'gold', summary: '15m slow + strip' },
  { id: 'mines', kind: 'stored', name: 'Mines', duration: 0, weight: 5, rarity: 'gold', summary: 'Stealth mines (3 uses)' },
  { id: 'airstrike', kind: 'stored', name: 'Airstrike', duration: 0, weight: 4, rarity: 'purple', summary: '3-blast carpet strike' },
];

export const POWER_BOX_CONFIG = {
  respawnSec: 20,
  pickupRadius: 2.2,
  shieldAbsorb: 50,
  rapidFireMult: 0.4,
  tripleShotSpreadDeg: 14,
  speedBoostMult: 1.4,
  damageUpMult: 1.6,
};

export interface GameModeMeta {
  id: GameModeId;
  name: string;
  shortName: string;
  isTeam: boolean;
  defaultTimeSec: number;
  defaultScoreLimit: number;
  planLine1: string;
  planLine2: string;
  tip: string;
  recommendedMaps: MapId[];
}

export const GAME_MODES: Record<GameModeId, GameModeMeta> = {
  ffa: {
    id: 'ffa',
    name: 'Free For All',
    shortName: 'FFA',
    isTeam: false,
    defaultTimeSec: 480,
    defaultScoreLimit: 15,
    planLine1: 'Every tank fights alone. First to 15 kills or top score wins.',
    planLine2: 'Grab Power Boxes, ambush duels, and guard your streaks.',
    tip: 'Shoot red explosive barrels when rivals pass nearby.',
    recommendedMaps: ['desert_outpost', 'industrial_yard', 'frozen_lake', 'forest_maze'],
  },
  tdm: {
    id: 'tdm',
    name: 'Team Deathmatch',
    shortName: 'TDM',
    isTeam: true,
    defaultTimeSec: 600,
    defaultScoreLimit: 30,
    planLine1: 'Red vs Blue squads. First team to 30 kills wins.',
    planLine2: 'Push lanes together and focus fire on weakened targets.',
    tip: 'Friendly fire is off by default—use crossfire angles.',
    recommendedMaps: ['industrial_yard', 'desert_outpost', 'twin_bases'],
  },
  lts: {
    id: 'lts',
    name: 'Last Tank Standing',
    shortName: 'LTS',
    isTeam: false,
    defaultTimeSec: 180,
    defaultScoreLimit: 3, // Best of 5 (first to 3 rounds)
    planLine1: 'No respawns! Best of 5 rounds—survive as the safe zone shrinks.',
    planLine2: 'Play smart cover until the final circle forces a duel.',
    tip: 'Shields do not block safe-zone damage—stay inside the ring.',
    recommendedMaps: ['frozen_lake', 'forest_maze', 'crater_hill'],
  },
  ctf: {
    id: 'ctf',
    name: 'Capture the Flag',
    shortName: 'CTF',
    isTeam: true,
    defaultTimeSec: 720,
    defaultScoreLimit: 3,
    planLine1: 'Steal the enemy flag and return it to your base while yours is home.',
    planLine2: 'Carriers move 15% slower without turbo—escort your runner.',
    tip: 'Touch a dropped teammate flag to return it to base instantly.',
    recommendedMaps: ['twin_bases', 'industrial_yard', 'desert_outpost'],
  },
  koth: {
    id: 'koth',
    name: 'King of the Hill',
    shortName: 'KOTH',
    isTeam: true,
    defaultTimeSec: 600,
    defaultScoreLimit: 120,
    planLine1: 'Hold the glowing hill zone uncontested to earn 1 point per second.',
    planLine2: 'The zone moves every 45s—rotate early when the preview ring appears.',
    tip: 'A single rival inside the ring halts points for everyone.',
    recommendedMaps: ['crater_hill', 'desert_outpost', 'frozen_lake'],
  },
};

export const MAP_SIZE_SCALES: Record<MapSizeId, { scale: number; label: string; recPlayers: string }> = {
  small: { scale: 0.75, label: 'Small', recPlayers: '2–4 players' },
  medium: { scale: 1.0, label: 'Medium', recPlayers: '4–8 players' },
  large: { scale: 1.4, label: 'Large', recPlayers: '8–12 players' },
};

export const STREAK_BANNERS: Record<number, string> = {
  3: 'Triple!',
  5: 'Rampage!',
  7: 'Unstoppable!',
  10: 'Legend!',
};

export const BOT_CONFIG: Record<BotDifficulty, { reactionSec: number; aimErrorDeg: number; leadFactor: number }> = {
  easy: { reactionSec: 0.85, aimErrorDeg: 14, leadFactor: 0 },
  medium: { reactionSec: 0.4, aimErrorDeg: 6.5, leadFactor: 0.45 },
  hard: { reactionSec: 0.16, aimErrorDeg: 2.2, leadFactor: 0.95 },
};

export const NETWORK_CONFIG = {
  maxHumans: 10,
  maxTotalTanks: 12,
  maxSpectators: 6,
  roomCodeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // no I, O, L, 0, 1
  roomCodeLength: 4,
  reconnectGraceSec: 60,
  roomDeleteIdleSec: 60,
  kickBanSec: 60,
  pingIntervalMs: 2000,
  pingTimeoutMs: 10000,
  maxLagCompMs: 150,
  interpDelayMs: 100,
  maxExtrapMs: 200,
  reconcileSmoothMs: 100,
  reconcileSnapDist: 2.0,
  maxMsgsPerSec: 120,
  banMsgsPerSec: 200,
  maxPacketBytes: 4096,
  afkWarnSec: 10,
  afkKickSec: 60,
  neutralInputTimeoutSec: 0.3,
  minFireIntervalClamp: 0.32, // Rapid fire on Scout = 0.9 * 0.4 = 0.36s
};

export const CAMERA_CONFIG = {
  baseHeight: 23,
  baseDist: 14.5,
  minZoomDist: 11,
  maxZoomDist: 38,
  defaultFov: 60,
  aimLeadFactor: 0.06,
  followDamping: 14.0,
};

export const LOADING_TIPS = [
  'Shoot red barrels to trigger chain explosions near enemy tanks.',
  'Mud patches cut your speed by 40%—use speed pads or flank around them.',
  'On Frozen Lake, your hull drifts on ice while your turret aims steadily.',
  'Heavy tanks take 15% less damage from shots hitting their front armor arc.',
  'Scouts can sideways dash with Q or E to dodge incoming shells and missiles.',
  'You can shoot down incoming Homing and Guided missiles—they only have 10 HP!',
  'Tap Tab to enlarge the minimap for 3 seconds, or hold Tab for the scoreboard.',
  'In Capture the Flag, touch your dropped team flag to send it straight back home.',
];

export const QUICK_CHAT_OPTIONS = [
  'Attack!',
  'Defend base!',
  'Nice shot!',
  'Need backup!',
  'On my way!',
  'Good game!',
];
