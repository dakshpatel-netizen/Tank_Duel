import { NETWORK_CONFIG } from './config';
import type {
  LobbyPlayerInfo,
  MatchResultSummary,
  MatchSettings,
  PlayerInput,
  RoomStateInfo,
  SimEvent,
  TankCustomization,
  TankState,
  ProjectileState,
  MineState,
  AirstrikeState,
  PowerBoxState,
  DestructibleObj,
  FlagState,
  HillState,
  SafeZoneState,
  TeamId,
} from './types';

export interface WorldSnapshot {
  tick: number;
  serverTime: number;
  timeRemainingSec: number;
  suddenDeath: boolean;
  roundNumber: number;
  roundWins: Record<string, number>;
  teamScores: { red: number; blue: number };
  tanks: TankState[];
  projectiles: ProjectileState[];
  mines: MineState[];
  airstrikes: AirstrikeState[];
  powerBoxes: PowerBoxState[];
  destructibles: DestructibleObj[];
  flags: { red: FlagState; blue: FlagState } | null;
  hill: HillState | null;
  safeZone: SafeZoneState;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  team: TeamId;
  text: string;
  timestamp: number;
  isQuick?: boolean;
}

// Client -> Server
export type ClientMessage =
  | {
      type: 'createRoom';
      nickname: string;
      custom: TankCustomization;
      password?: string;
    }
  | {
      type: 'joinRoom';
      code: string;
      nickname: string;
      custom: TankCustomization;
      password?: string;
      playerToken?: string;
      asSpectator?: boolean;
    }
  | { type: 'leaveRoom' }
  | { type: 'setReady'; ready: boolean }
  | { type: 'setTank'; custom: TankCustomization }
  | { type: 'setTeam'; targetPlayerId: string; team: 'red' | 'blue' }
  | { type: 'hostSettings'; settings: Partial<MatchSettings> }
  | { type: 'kickPlayer'; targetPlayerId: string }
  | { type: 'startMatch' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'chat'; text: string; isQuick?: boolean }
  | { type: 'rematch' }
  | { type: 'backToLobby' }
  | { type: 'ping'; clientTime: number };

// Server -> Client
export type ServerMessage =
  | {
      type: 'roomJoined';
      room: RoomStateInfo;
      yourId: string;
      playerToken: string;
      isSpectator: boolean;
      serverTime: number;
      chatHistory: ChatMessage[];
    }
  | {
      type: 'roomUpdate';
      room: RoomStateInfo;
    }
  | {
      type: 'countdown';
      secondsLeft: number;
      settings: MatchSettings;
    }
  | {
      type: 'matchStart';
      settings: MatchSettings;
      seed: number;
      serverTime: number;
      snapshot: WorldSnapshot;
    }
  | {
      type: 'snapshot';
      snapshot: WorldSnapshot;
    }
  | {
      type: 'event';
      events: SimEvent[];
    }
  | {
      type: 'chat';
      message: ChatMessage;
    }
  | {
      type: 'toast';
      text: string;
      tone?: 'info' | 'warn' | 'accent';
    }
  | {
      type: 'matchEnd';
      summary: MatchResultSummary;
      room: RoomStateInfo;
    }
  | {
      type: 'kicked';
      reason: string;
    }
  | {
      type: 'error';
      code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'WRONG_PASSWORD' | 'IN_PROGRESS_FULL' | 'KICK_COOLDOWN' | 'BAD_INPUT' | 'RATE_LIMIT' | 'CANNOT_START';
      message: string;
      canSpectate?: boolean;
    }
  | {
      type: 'pong';
      clientTime: number;
      serverTime: number;
    };

const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot'];

export function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') {
    return `Player${Math.floor(100 + Math.random() * 900)}`;
  }
  let clean = raw
    .replace(/[<>]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .slice(0, 14);
  if (!clean) {
    return `Player${Math.floor(100 + Math.random() * 900)}`;
  }
  const lower = clean.toLowerCase();
  for (const w of BAD_WORDS) {
    if (lower.includes(w)) {
      clean = clean.replace(new RegExp(w, 'gi'), '***');
    }
  }
  return clean;
}

export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let clean = raw.replace(/[<>]/g, '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 80);
  const lower = clean.toLowerCase();
  for (const w of BAD_WORDS) {
    if (lower.includes(w)) {
      clean = clean.replace(new RegExp(w, 'gi'), '***');
    }
  }
  return clean;
}

export function deduplicateNickname(name: string, existing: Pick<LobbyPlayerInfo, 'name'>[]): string {
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

export function generateRoomCode(existingCodes: Set<string>): string {
  const alpha = NETWORK_CONFIG.roomCodeAlphabet;
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < NETWORK_CONFIG.roomCodeLength; i++) {
      code += alpha[Math.floor(Math.random() * alpha.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  return 'TANK';
}
