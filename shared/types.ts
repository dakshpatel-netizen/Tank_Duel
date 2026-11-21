import type {
  BotDifficulty,
  GameModeId,
  MapId,
  MapSizeId,
  PowerBoxItemId,
  StoredWeaponId,
  TankClassId,
  TimedBuffId,
} from './config';

export type TeamId = 'none' | 'red' | 'blue';
export type TurretStyleId = 'dome' | 'angular' | 'brawler';
export type DecalId = 'stripes' | 'star' | 'skull' | 'flame' | 'checker' | 'dots';
export type GroundType = 'normal' | 'ice' | 'mud' | 'speed_pad';
export type RoomPhase = 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS';

export interface TankCustomization {
  classId: TankClassId;
  colorId: string;
  turretStyle: TurretStyleId;
  decal: DecalId;
}

export interface PlayerInput {
  seq: number;
  clientTime: number;
  forward: number; // -1..1
  turn: number; // -1..1
  aimX: number;
  aimZ: number;
  fire: boolean;
  useWeapon: boolean;
  turbo: boolean;
  handbrake: boolean;
  dashDir: -1 | 0 | 1; // Scout Q=-1, E=+1
}

export interface WallObj {
  id: string;
  x: number;
  z: number;
  w: number; // along x
  d: number; // along z
  h: number;
  destructible?: boolean;
  hp?: number;
  maxHp?: number;
  kind?: 'wall' | 'container' | 'hedge' | 'crater_rim';
}

export interface RockObj {
  id: string;
  x: number;
  z: number;
  r: number;
  h: number;
}

export interface DestructibleObj {
  id: string;
  kind: 'crate' | 'barrel';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
}

export interface TreeObj {
  id: string;
  x: number;
  z: number;
  r: number;
  h: number;
}

export interface TerrainZone {
  id: string;
  type: 'ice' | 'mud' | 'speed_pad';
  shape: 'circle' | 'rect';
  x: number;
  z: number;
  r?: number;
  w?: number;
  d?: number;
  dirX?: number;
  dirZ?: number;
}

export interface SpawnPoint {
  x: number;
  z: number;
  angle: number;
  team?: 'red' | 'blue';
}

export interface PowerPadData {
  id: string;
  x: number;
  z: number;
  team?: 'red' | 'blue';
}

export interface HillZoneSpot {
  id: string;
  x: number;
  z: number;
  r: number;
}

export interface DecorationObj {
  kind: 'cactus' | 'dune' | 'crane' | 'banner_red' | 'banner_blue' | 'mesa';
  x: number;
  z: number;
  scale: number;
  rot: number;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  description: string;
  bestFor: string;
  hazards: ('ice' | 'mud' | 'barrels' | 'speed_pads')[];
  width: number;
  depth: number;
  palette: {
    ground: string;
    groundAccent: string;
    skyTop: string;
    skyBottom: string;
    fog: string;
    sunColor: string;
    wallColor: string;
    rockColor: string;
  };
  sunElevationDeg: number;
  walls: WallObj[];
  rocks: RockObj[];
  crates: { id: string; x: number; z: number }[];
  barrels: { id: string; x: number; z: number }[];
  trees: TreeObj[];
  zones: TerrainZone[];
  spawns: SpawnPoint[];
  pads: PowerPadData[];
  hillSpots: HillZoneSpot[];
  ctfBases?: {
    red: { flagX: number; flagZ: number; capX: number; capZ: number };
    blue: { flagX: number; flagZ: number; capX: number; capZ: number };
  };
  decorations: DecorationObj[];
}

export interface ActiveBuff {
  id: TimedBuffId;
  remaining: number;
  duration: number;
}

export interface TankState {
  id: string;
  name: string;
  isBot: boolean;
  team: TeamId;
  custom: TankCustomization;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hullAngle: number; // radians, 0 = +Z, or standard math: let's define 0 = +Z, forward = (sin(angle), cos(angle))
  turretAngle: number;
  speed: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  spawnShieldTimer: number;
  reloadTimer: number;
  reloadMax: number;
  turboStamina: number; // 0..1
  turboActive: boolean;
  turboLockout: boolean;
  dashTimer: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirZ: number;
  speedPadTimer: number;
  empTimer: number;
  shieldHp: number;
  storedWeapon: StoredWeaponId | null;
  storedAmmo: number;
  buffs: ActiveBuff[];
  groundType: GroundType;
  lastSpawnIndex: number;
  // Stats
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  powerUpsCollected: number;
  streak: number;
  bestStreak: number;
  flagCaptures: number;
  hillSeconds: number;
  // Network/status flags
  lastProcessedSeq: number;
  afk: boolean;
  disconnected: boolean;
  guidedMissileId: string | null;
  pingMs: number;
}

export interface ProjectileState {
  id: string;
  kind: 'cannon' | 'homing' | 'cluster' | 'bomblet' | 'guided' | 'bouncing';
  ownerId: string;
  ownerTeam: TeamId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  speed: number;
  radius: number;
  damage: number;
  blastRadius: number;
  lifetime: number;
  maxLifetime: number;
  bouncesLeft: number;
  hp: number;
  targetId?: string | null;
  targetX?: number;
  targetZ?: number;
  createdAtTick: number;
}

export interface MineState {
  id: string;
  ownerId: string;
  ownerTeam: TeamId;
  x: number;
  z: number;
  armTimer: number; // armed when <= 0
  age: number; // hidden from enemies when >= 2.0
  lifetime: number;
}

export interface AirstrikeState {
  id: string;
  ownerId: string;
  ownerTeam: TeamId;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  countdown: number; // 1.5 -> 0
  strikesDropped: number;
  nextDropTimer: number;
}

export interface PowerBoxState {
  id: string;
  x: number;
  z: number;
  active: boolean;
  itemId: PowerBoxItemId;
  respawnTimer: number;
}

export interface FlagState {
  team: 'red' | 'blue';
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  carrierId: string | null;
  droppedTimer: number; // > 0 when dropped on ground
  atHome: boolean;
}

export interface SafeZoneState {
  enabled: boolean;
  x: number;
  z: number;
  currentRadius: number;
  initialRadius: number;
  finalRadius: number;
  shrinking: boolean;
}

export interface HillState {
  activeIndex: number;
  nextIndex: number;
  x: number;
  z: number;
  r: number;
  nextX: number;
  nextZ: number;
  moveTimer: number;
  holderTeam: TeamId | 'contested';
  holderPlayerId: string | null;
}

export interface MatchSettings {
  mode: GameModeId;
  mapId: MapId;
  mapSize: MapSizeId;
  timeLimitSec: number;
  scoreLimit: number;
  powerBoxesEnabled: boolean;
  botCount: number;
  botDifficulty: BotDifficulty;
  friendlyFire: boolean;
  tankRule: 'classic' | 'classes';
  classicHp: 100 | 150;
  shrinkingZone: boolean;
  password: string;
}

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  team: 'red' | 'blue' | 'none';
  custom: TankCustomization;
  pingMs: number;
  joinedAt: number;
}

export interface RoomStateInfo {
  code: string;
  phase: RoomPhase;
  hasPassword: boolean;
  settings: MatchSettings;
  players: LobbyPlayerInfo[];
  spectatorCount: number;
  countdownSec: number;
  rematchVotes: string[];
}

export interface SimState {
  tick: number;
  seed: number;
  map: MapDefinition;
  settings: MatchSettings;
  tanks: TankState[];
  projectiles: ProjectileState[];
  mines: MineState[];
  airstrikes: AirstrikeState[];
  powerBoxes: PowerBoxState[];
  destructibles: DestructibleObj[];
  flags: { red: FlagState; blue: FlagState } | null;
  hill: HillState | null;
  safeZone: SafeZoneState;
  teamScores: { red: number; blue: number };
  roundNumber: number;
  roundWins: Record<string, number>;
  roundDraws: number;
  roundOverTimer: number;
  timeRemainingSec: number;
  suddenDeath: boolean;
  matchEnded: boolean;
  winnerId: string | null;
  winnerTeam: TeamId | null;
  winnerReason: string;
  damageLog: Record<string, { attackerId: string; time: number }[]>;
}

export type SimEvent =
  | { type: 'fired'; tankId: string; x: number; z: number; angle: number; kind: 'cannon' | StoredWeaponId }
  | { type: 'hit'; targetId: string; attackerId: string; x: number; z: number; damage: number; shielded?: boolean; frontArmor?: boolean }
  | { type: 'ricochet'; x: number; z: number; kind: 'cannon' | 'bouncing' }
  | { type: 'explosion'; x: number; z: number; radius: number; kind: 'small' | 'medium' | 'large' | 'emp' | 'barrel' | 'crate' | 'cluster_open' }
  | { type: 'tank_destroyed'; victimId: string; victimName: string; victimTeam: TeamId; victimClass: TankClassId; killerId: string | null; killerName: string; killerTeam: TeamId; x: number; z: number; weapon: string; streak?: number }
  | { type: 'pickup'; tankId: string; boxId: string; itemId: PowerBoxItemId; replacedWeapon: boolean; x: number; z: number }
  | { type: 'box_respawn'; boxId: string; x: number; z: number }
  | { type: 'flag_event'; action: 'taken' | 'dropped' | 'returned' | 'captured'; team: 'red' | 'blue'; byName?: string; x: number; z: number }
  | { type: 'hill_moved'; x: number; z: number }
  | { type: 'round_end'; winnerId: string | null; draw: boolean; roundNumber: number }
  | { type: 'announcement'; text: string; tone?: 'gold' | 'danger' | 'accent' }
  | { type: 'dash'; tankId: string; x: number; z: number; dirX: number; dirZ: number };

export interface MatchAward {
  id: string;
  title: string;
  subtitle: string;
  playerId: string;
  playerName: string;
  valueText: string;
}

export interface MatchResultSummary {
  winnerId: string | null;
  winnerName: string;
  winnerTeam: TeamId | null;
  reason: string;
  mode: GameModeId;
  mapId: MapId;
  durationSec: number;
  players: {
    id: string;
    name: string;
    isBot: boolean;
    team: TeamId;
    custom: TankCustomization;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    accuracy: number;
    powerUpsCollected: number;
    bestStreak: number;
    flagCaptures: number;
    hillSeconds: number;
    leftEarly: boolean;
  }[];
  awards: MatchAward[];
}
