import crypto from 'crypto';
import type { WebSocket } from 'ws';
import {
  GAME_MODES,
  NETWORK_CONFIG,
  PHYSICS,
  TANK_COLORS,
} from '../shared/config';
import { computeBotInput, type BotMemory } from '../shared/bots';
import {
  deduplicateNickname,
  generateRoomCode,
  sanitizeChatText,
  sanitizeNickname,
  type ChatMessage,
  type ClientMessage,
  type ServerMessage,
  type WorldSnapshot,
} from '../shared/protocol';
import {
  buildMatchResultSummary,
  clampInput,
  createSimState,
  finishMatch,
  selectSafeSpawn,
  stepSim,
} from '../shared/sim';
import type {
  LobbyPlayerInfo,
  MatchSettings,
  PlayerInput,
  RoomPhase,
  RoomStateInfo,
  SimEvent,
  SimState,
  TankCustomization,
} from '../shared/types';

interface ClientConn {
  ws: WebSocket;
  playerId: string | null;
  roomCode: string | null;
  msgTimestamps: number[];
  lastPongAt: number;
  lastChatAt: number;
  isSpectator: boolean;
}

interface RoomPlayer extends LobbyPlayerInfo {
  token: string;
  conn: ClientConn | null;
  disconnectedAt: number | null;
  lastInput: PlayerInput | null;
  lastInputAt: number;
  lastNeutralWarning: boolean;
  lastActiveAt: number;
}

interface RoomInstance {
  code: string;
  phase: RoomPhase;
  settings: MatchSettings;
  players: RoomPlayer[];
  spectators: ClientConn[];
  kickedIpsOrTokens: Map<string, number>;
  chatHistory: ChatMessage[];
  rematchVotes: Set<string>;
  sim: SimState | null;
  botMemories: Map<string, BotMemory>;
  countdownTimer: number;
  countdownLastInt: number;
  matchStartMs: number;
  lastTickAt: number;
  snapshotAccum: number;
  emptySince: number | null;
  tickTimer: NodeJS.Timeout | null;
}

const DEFAULT_SETTINGS: MatchSettings = {
  mode: 'ffa',
  mapId: 'desert_outpost',
  mapSize: 'medium',
  timeLimitSec: GAME_MODES.ffa.defaultTimeSec,
  scoreLimit: GAME_MODES.ffa.defaultScoreLimit,
  powerBoxesEnabled: true,
  botCount: 2,
  botDifficulty: 'medium',
  friendlyFire: false,
  tankRule: 'classes',
  classicHp: 100,
  shrinkingZone: false,
  password: '',
};

export class RoomManager {
  private rooms = new Map<string, RoomInstance>();
  private conns = new Map<WebSocket, ClientConn>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.housekeep(), 1000);
  }

  public dispose() {
    clearInterval(this.cleanupTimer);
    for (const room of this.rooms.values()) {
      if (room.tickTimer) clearInterval(room.tickTimer);
    }
    this.rooms.clear();
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public handleConnection(ws: WebSocket) {
    const conn: ClientConn = {
      ws,
      playerId: null,
      roomCode: null,
      msgTimestamps: [],
      lastPongAt: Date.now(),
      lastChatAt: 0,
      isSpectator: false,
    };
    this.conns.set(ws, conn);

    ws.on('message', (raw) => {
      const byteLen = typeof raw === 'string' ? Buffer.byteLength(raw) : (raw as Buffer).length;
      if (byteLen > NETWORK_CONFIG.maxPacketBytes) {
        this.send(ws, { type: 'error', code: 'BAD_INPUT', message: 'Packet too large.' });
        return;
      }

      const now = Date.now();
      conn.msgTimestamps.push(now);
      while (conn.msgTimestamps.length > 0 && now - conn.msgTimestamps[0] > 1000) {
        conn.msgTimestamps.shift();
      }
      if (conn.msgTimestamps.length >= NETWORK_CONFIG.banMsgsPerSec) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      if (conn.msgTimestamps.length > NETWORK_CONFIG.maxMsgsPerSec) {
        return;
      }

      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;
      conn.lastPongAt = now;

      this.handleMessage(conn, msg);
    });

    ws.on('close', () => {
      this.handleDisconnect(conn);
      this.conns.delete(ws);
    });

    ws.on('error', () => {
      // Handled by close
    });
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastRoom(room: RoomInstance, msg: ServerMessage) {
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

  private sanitizeCustom(raw: Partial<TankCustomization> | undefined): TankCustomization {
    const validClass = raw?.classId === 'scout' || raw?.classId === 'heavy' ? raw.classId : 'standard';
    const validColor = TANK_COLORS.some((c) => c.id === raw?.colorId) ? raw!.colorId! : 'red';
    const validTurret = raw?.turretStyle === 'angular' || raw?.turretStyle === 'brawler' ? raw.turretStyle : 'dome';
    const validDecal =
      raw?.decal === 'star' ||
      raw?.decal === 'skull' ||
      raw?.decal === 'flame' ||
      raw?.decal === 'checker' ||
      raw?.decal === 'dots'
        ? raw.decal
        : 'stripes';
    return { classId: validClass, colorId: validColor, turretStyle: validTurret, decal: validDecal };
  }

  private pickFreeColor(room: RoomInstance, preferred: string): string {
    if (GAME_MODES[room.settings.mode].isTeam) return preferred;
    const used = new Set(room.players.map((p) => p.custom.colorId));
    if (!used.has(preferred)) return preferred;
    for (const c of TANK_COLORS) {
      if (!used.has(c.id)) return c.id;
    }
    return preferred;
  }

  private toRoomStateInfo(room: RoomInstance): RoomStateInfo {
    const safeSettings = { ...room.settings, password: '' };
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
        joinedAt: p.joinedAt,
      })),
      spectatorCount: room.spectators.length,
      countdownSec: Math.ceil(room.countdownTimer),
      rematchVotes: Array.from(room.rematchVotes),
    };
  }

  private handleMessage(conn: ClientConn, msg: ClientMessage) {
    if (msg.type === 'ping') {
      conn.lastPongAt = Date.now();
      this.send(conn.ws, { type: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
      return;
    }

    if (msg.type === 'createRoom') {
      this.leaveCurrentRoom(conn);
      const code = generateRoomCode(new Set(this.rooms.keys()));
      const id = `p_${crypto.randomUUID().slice(0, 8)}`;
      const token = crypto.randomUUID();
      const name = sanitizeNickname(msg.nickname);
      const custom = this.sanitizeCustom(msg.custom);

      const player: RoomPlayer = {
        id,
        token,
        name,
        isHost: true,
        isBot: false,
        ready: false,
        team: 'red',
        custom,
        pingMs: 25,
        joinedAt: Date.now(),
        conn,
        disconnectedAt: null,
        lastInput: null,
        lastInputAt: Date.now(),
        lastNeutralWarning: false,
        lastActiveAt: Date.now(),
      };

      const room: RoomInstance = {
        code,
        phase: 'LOBBY',
        settings: { ...DEFAULT_SETTINGS, password: typeof msg.password === 'string' ? msg.password.slice(0, 24) : '' },
        players: [player],
        spectators: [],
        kickedIpsOrTokens: new Map(),
        chatHistory: [],
        rematchVotes: new Set(),
        sim: null,
        botMemories: new Map(),
        countdownTimer: 0,
        countdownLastInt: 0,
        matchStartMs: 0,
        lastTickAt: Date.now(),
        snapshotAccum: 0,
        emptySince: null,
        tickTimer: null,
      };
      this.rooms.set(code, room);
      conn.playerId = id;
      conn.roomCode = code;
      conn.isSpectator = false;

      this.send(conn.ws, {
        type: 'roomJoined',
        room: this.toRoomStateInfo(room),
        yourId: id,
        playerToken: token,
        isSpectator: false,
        serverTime: Date.now(),
        chatHistory: [],
      });
      return;
    }

    if (msg.type === 'joinRoom') {
      const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
      const room = this.rooms.get(code);
      if (!room) {
        this.send(conn.ws, {
          type: 'error',
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found. Check the 4-letter code.',
        });
        return;
      }

      if (msg.playerToken) {
        const kickUntil = room.kickedIpsOrTokens.get(msg.playerToken);
        if (kickUntil && kickUntil > Date.now()) {
          this.send(conn.ws, {
            type: 'error',
            code: 'KICK_COOLDOWN',
            message: 'You were removed by the host. Try again in 60s.',
          });
          return;
        }
      }

      if (room.settings.password && msg.password !== room.settings.password) {
        this.send(conn.ws, {
          type: 'error',
          code: 'WRONG_PASSWORD',
          message: 'Incorrect room password.',
        });
        return;
      }

      // Check reconnect by playerToken (Edge case 20)
      if (msg.playerToken) {
        const existing = room.players.find((p) => p.token === msg.playerToken);
        if (existing) {
          this.leaveCurrentRoom(conn);
          existing.conn = conn;
          existing.disconnectedAt = null;
          existing.lastActiveAt = Date.now();
          conn.playerId = existing.id;
          conn.roomCode = room.code;
          conn.isSpectator = false;

          if (room.sim) {
            const simTank = room.sim.tanks.find((t) => t.id === existing.id);
            if (simTank) {
              simTank.disconnected = false;
              simTank.afk = false;
            }
          }

          this.send(conn.ws, {
            type: 'roomJoined',
            room: this.toRoomStateInfo(room),
            yourId: existing.id,
            playerToken: existing.token,
            isSpectator: false,
            serverTime: Date.now(),
            chatHistory: room.chatHistory,
          });
          if (room.phase === 'PLAYING' && room.sim) {
            this.send(conn.ws, {
              type: 'matchStart',
              settings: { ...room.settings, password: '' },
              seed: room.sim.seed,
              serverTime: Date.now(),
              snapshot: this.buildSnapshot(room.sim),
            });
          }
          this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
          return;
        }
      }

      // Spectator join
      if (msg.asSpectator) {
        if (room.spectators.length >= NETWORK_CONFIG.maxSpectators) {
          this.send(conn.ws, { type: 'error', code: 'ROOM_FULL', message: 'Spectator slots are full.' });
          return;
        }
        this.leaveCurrentRoom(conn);
        conn.playerId = `spec_${crypto.randomUUID().slice(0, 6)}`;
        conn.roomCode = room.code;
        conn.isSpectator = true;
        room.spectators.push(conn);
        this.send(conn.ws, {
          type: 'roomJoined',
          room: this.toRoomStateInfo(room),
          yourId: conn.playerId,
          playerToken: '',
          isSpectator: true,
          serverTime: Date.now(),
          chatHistory: room.chatHistory,
        });
        if (room.phase === 'PLAYING' && room.sim) {
          this.send(conn.ws, {
            type: 'matchStart',
            settings: { ...room.settings, password: '' },
            seed: room.sim.seed,
            serverTime: Date.now(),
            snapshot: this.buildSnapshot(room.sim),
          });
        }
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        return;
      }

      if (room.players.length >= NETWORK_CONFIG.maxHumans) {
        this.send(conn.ws, {
          type: 'error',
          code: 'ROOM_FULL',
          message: 'Room is full.',
          canSpectate: room.spectators.length < NETWORK_CONFIG.maxSpectators,
        });
        return;
      }

      // Late join in progress check (Edge case 17 & 32)
      const isLatePlaying = room.phase === 'PLAYING' && room.sim;
      if (isLatePlaying && room.sim!.timeRemainingSec < 60 && room.settings.mode !== 'lts') {
        this.send(conn.ws, {
          type: 'error',
          code: 'IN_PROGRESS_FULL',
          message: 'Match ending soon (<60s). Join as spectator?',
          canSpectate: true,
        });
        return;
      }

      this.leaveCurrentRoom(conn);
      const id = `p_${crypto.randomUUID().slice(0, 8)}`;
      const token = crypto.randomUUID();
      const baseName = sanitizeNickname(msg.nickname);
      const name = deduplicateNickname(baseName, room.players);
      const custom = this.sanitizeCustom(msg.custom);
      custom.colorId = this.pickFreeColor(room, custom.colorId);

      // Auto-balance team
      const redCount = room.players.filter((p) => p.team === 'red').length;
      const blueCount = room.players.filter((p) => p.team === 'blue').length;
      const team = redCount <= blueCount ? 'red' : 'blue';

      const newPlayer: RoomPlayer = {
        id,
        token,
        name,
        isHost: room.players.length === 0,
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
        lastActiveAt: Date.now(),
      };
      room.players.push(newPlayer);
      room.emptySince = null;
      conn.playerId = id;
      conn.roomCode = room.code;
      conn.isSpectator = false;

      this.send(conn.ws, {
        type: 'roomJoined',
        room: this.toRoomStateInfo(room),
        yourId: id,
        playerToken: token,
        isSpectator: false,
        serverTime: Date.now(),
        chatHistory: room.chatHistory,
      });

      // Handle joining during PLAYING (Edge case 17)
      if (isLatePlaying && room.sim) {
        if (room.settings.mode !== 'lts') {
          const sp = selectSafeSpawn(room.sim.map, room.sim.tanks, team, -1, room.sim.seed, room.sim.tick);
          room.sim.tanks.push({
            id: newPlayer.id,
            name: newPlayer.name,
            isBot: false,
            team: GAME_MODES[room.settings.mode].isTeam ? team : 'none',
            custom: newPlayer.custom,
            x: sp.x,
            z: sp.z,
            vx: 0,
            vz: 0,
            hullAngle: sp.angle,
            turretAngle: sp.angle,
            speed: 0,
            hp: room.settings.classicHp,
            maxHp: room.settings.classicHp,
            alive: false,
            respawnTimer: 3.0,
            spawnShieldTimer: 2.0,
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
            pingMs: 25,
          });
        }
        this.send(conn.ws, {
          type: 'matchStart',
          settings: { ...room.settings, password: '' },
          seed: room.sim.seed,
          serverTime: Date.now(),
          snapshot: this.buildSnapshot(room.sim),
        });
      } else if (room.phase === 'RESULTS') {
        // Edge case 32: joining during RESULTS places them in lobby
        room.phase = 'LOBBY';
      }

      this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
      return;
    }

    if (!conn.roomCode) return;
    const room = this.rooms.get(conn.roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === conn.playerId);

    switch (msg.type) {
      case 'leaveRoom': {
        this.leaveCurrentRoom(conn);
        break;
      }
      case 'setReady': {
        if (!player || room.phase !== 'LOBBY') break;
        player.ready = Boolean(msg.ready);
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        break;
      }
      case 'setTank': {
        if (!player || room.phase !== 'LOBBY') break;
        const custom = this.sanitizeCustom(msg.custom);
        custom.colorId = this.pickFreeColor(room, custom.colorId);
        player.custom = custom;
        // Section 28: changing anything clears Ready automatically
        player.ready = false;
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        break;
      }
      case 'setTeam': {
        if (!player || !player.isHost || room.phase !== 'LOBBY') break;
        const target = room.players.find((p) => p.id === msg.targetPlayerId);
        if (target && (msg.team === 'red' || msg.team === 'blue')) {
          target.team = msg.team;
          this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        }
        break;
      }
      case 'hostSettings': {
        if (!player || !player.isHost || room.phase !== 'LOBBY') break;
        const next = msg.settings;
        if (next.mode && GAME_MODES[next.mode]) {
          room.settings.mode = next.mode;
          room.settings.timeLimitSec = GAME_MODES[next.mode].defaultTimeSec;
          room.settings.scoreLimit = GAME_MODES[next.mode].defaultScoreLimit;
        }
        if (next.mapId) room.settings.mapId = next.mapId;
        if (next.mapSize) room.settings.mapSize = next.mapSize;
        if (typeof next.timeLimitSec === 'number') {
          room.settings.timeLimitSec = Math.max(60, Math.min(1800, Math.round(next.timeLimitSec)));
        }
        if (typeof next.scoreLimit === 'number') {
          room.settings.scoreLimit = Math.max(1, Math.min(300, Math.round(next.scoreLimit)));
        }
        if (typeof next.powerBoxesEnabled === 'boolean') room.settings.powerBoxesEnabled = next.powerBoxesEnabled;
        if (typeof next.botCount === 'number') {
          const maxBots = Math.max(0, Math.min(8, NETWORK_CONFIG.maxTotalTanks - room.players.length));
          room.settings.botCount = Math.max(0, Math.min(maxBots, Math.round(next.botCount)));
        }
        if (next.botDifficulty) room.settings.botDifficulty = next.botDifficulty;
        if (typeof next.friendlyFire === 'boolean') room.settings.friendlyFire = next.friendlyFire;
        if (next.tankRule === 'classic' || next.tankRule === 'classes') room.settings.tankRule = next.tankRule;
        if (next.classicHp === 100 || next.classicHp === 150) room.settings.classicHp = next.classicHp;
        if (typeof next.shrinkingZone === 'boolean') room.settings.shrinkingZone = next.shrinkingZone;
        if (typeof next.password === 'string') room.settings.password = next.password.slice(0, 24);
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        break;
      }
      case 'kickPlayer': {
        if (!player || !player.isHost) break;
        const idx = room.players.findIndex((p) => p.id === msg.targetPlayerId);
        if (idx === -1 || room.players[idx].id === player.id) break;
        const kicked = room.players[idx];
        room.players.splice(idx, 1);
        room.kickedIpsOrTokens.set(kicked.token, Date.now() + NETWORK_CONFIG.kickBanSec * 1000);
        if (kicked.conn) {
          this.send(kicked.conn.ws, { type: 'kicked', reason: 'You were removed by the host.' });
          kicked.conn.roomCode = null;
          kicked.conn.playerId = null;
        }
        this.broadcastRoom(room, { type: 'toast', text: `${kicked.name} was removed by the host.`, tone: 'warn' });
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        break;
      }
      case 'startMatch': {
        if (!player || !player.isHost || room.phase !== 'LOBBY') break;
        const readyHumans = room.players.filter((p) => p.ready || p.isHost).length;
        const allHumansReady = room.players.every((p) => p.ready || p.isHost);
        const canStart =
          (room.players.length >= 2 && allHumansReady) ||
          (room.players.length === 1 && room.settings.botCount >= 1);
        if (!canStart || readyHumans < 1) {
          this.send(conn.ws, {
            type: 'error',
            code: 'CANNOT_START',
            message: 'Need at least 2 ready players or 1 player with bots.',
          });
          break;
        }
        this.beginCountdown(room);
        break;
      }
      case 'input': {
        if (!player || room.phase !== 'PLAYING' || !room.sim) break;
        player.lastInput = clampInput(msg.input, room.sim.map);
        player.lastInputAt = Date.now();
        player.lastActiveAt = Date.now();
        const t = room.sim.tanks.find((tk) => tk.id === player.id);
        if (t && t.afk) {
          t.afk = false;
        }
        break;
      }
      case 'chat': {
        if (!player) break;
        const now = Date.now();
        if (now - conn.lastChatAt < 1000) break;
        // Quick chat only during first 5s of match
        if (room.phase === 'PLAYING' && now - room.matchStartMs < 5000 && !msg.isQuick) break;
        const text = sanitizeChatText(msg.text);
        if (!text) break;
        conn.lastChatAt = now;
        const chatMsg: ChatMessage = {
          id: crypto.randomUUID().slice(0, 8),
          senderId: player.id,
          senderName: player.name,
          team: GAME_MODES[room.settings.mode].isTeam ? player.team : 'none',
          text,
          timestamp: now,
          isQuick: Boolean(msg.isQuick),
        };
        room.chatHistory.push(chatMsg);
        if (room.chatHistory.length > 50) room.chatHistory.shift();
        this.broadcastRoom(room, { type: 'chat', message: chatMsg });
        break;
      }
      case 'rematch': {
        if (!player || room.phase !== 'RESULTS') break;
        room.rematchVotes.add(player.id);
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        if (room.rematchVotes.size >= room.players.length) {
          room.rematchVotes.clear();
          this.beginCountdown(room);
        }
        break;
      }
      case 'backToLobby': {
        if (!player || !player.isHost || room.phase !== 'RESULTS') break;
        room.phase = 'LOBBY';
        room.sim = null;
        room.rematchVotes.clear();
        room.players.forEach((p) => {
          if (!p.isHost) p.ready = false;
        });
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
        break;
      }
    }
  }

  private beginCountdown(room: RoomInstance) {
    room.phase = 'COUNTDOWN';
    room.countdownTimer = 3.0;
    room.countdownLastInt = 4;
    if (room.tickTimer) clearInterval(room.tickTimer);
    room.lastTickAt = Date.now();
    room.tickTimer = setInterval(() => this.tickRoom(room), 1000 / PHYSICS.simHz);
    this.broadcastRoom(room, {
      type: 'countdown',
      secondsLeft: 3,
      settings: { ...room.settings, password: '' },
    });
  }

  private startMatch(room: RoomInstance) {
    const seed = Math.floor(Math.random() * 1000000) + 1;
    const participants: LobbyPlayerInfo[] = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isBot: false,
      ready: true,
      team: p.team,
      custom: p.custom,
      pingMs: p.pingMs,
      joinedAt: p.joinedAt,
    }));

    const botCount = Math.min(room.settings.botCount, NETWORK_CONFIG.maxTotalTanks - participants.length);
    room.botMemories.clear();
    const classIds: ('scout' | 'standard' | 'heavy')[] = ['scout', 'standard', 'heavy'];
    for (let i = 0; i < botCount; i++) {
      const botId = `bot_${i + 1}`;
      const redCount = participants.filter((p) => p.team === 'red').length;
      const blueCount = participants.filter((p) => p.team === 'blue').length;
      const team = redCount <= blueCount ? 'red' : 'blue';
      const color = TANK_COLORS[(i + 3) % TANK_COLORS.length].id;
      participants.push({
        id: botId,
        name: `Bot ${['Alpha', 'Bravo', 'Cobra', 'Delta', 'Echo', 'Fox', 'Ghost', 'Hawk'][i] ?? i + 1}`,
        isHost: false,
        isBot: true,
        ready: true,
        team,
        custom: {
          classId: room.settings.tankRule === 'classes' ? classIds[i % 3] : 'standard',
          colorId: color,
          turretStyle: i % 2 === 0 ? 'dome' : 'angular',
          decal: 'stripes',
        },
        pingMs: 0,
        joinedAt: Date.now(),
      });
      room.botMemories.set(botId, {
        patrolX: 0,
        patrolZ: 0,
        patrolTimer: 0,
        strafeSign: i % 2 === 0 ? 1 : -1,
        strafeTimer: 1.5,
        reactionTimer: 0.3,
        seq: 0,
      });
    }

    room.sim = createSimState(participants, room.settings, seed);
    room.phase = 'PLAYING';
    room.matchStartMs = Date.now();
    room.snapshotAccum = 0;

    this.broadcastRoom(room, {
      type: 'matchStart',
      settings: { ...room.settings, password: '' },
      seed,
      serverTime: Date.now(),
      snapshot: this.buildSnapshot(room.sim),
    });
  }

  private tickRoom(room: RoomInstance) {
    // Edge case 39: Per-room try/catch so one room error never crashes others
    try {
      const now = Date.now();
      if (room.phase === 'COUNTDOWN') {
        room.countdownTimer -= PHYSICS.fixedDt;
        const ceil = Math.ceil(room.countdownTimer);
        if (ceil !== room.countdownLastInt && ceil > 0) {
          room.countdownLastInt = ceil;
          this.broadcastRoom(room, {
            type: 'countdown',
            secondsLeft: ceil,
            settings: { ...room.settings, password: '' },
          });
        }
        if (room.countdownTimer <= 0) {
          this.startMatch(room);
        }
        return;
      }

      if (room.phase !== 'PLAYING' || !room.sim) return;

      // Edge case 18: Fewer than 2 tanks left with no bots -> immediate match end
      const activeTanks = room.sim.tanks.filter((t) => !t.disconnected);
      if (activeTanks.length < 2 && room.settings.botCount === 0) {
        finishMatch(room.sim, activeTanks[0]?.id ?? null, null, 'Other players left the match.');
      }

      const inputsByTankId: Record<string, PlayerInput> = {};

      for (const p of room.players) {
        const tank = room.sim.tanks.find((t) => t.id === p.id);
        if (!tank) continue;
        // AFK check (Edge case 23)
        if (!p.disconnectedAt && now - p.lastActiveAt > NETWORK_CONFIG.afkWarnSec * 1000) {
          tank.afk = true;
        }
        if (p.lastInput && now - p.lastInputAt <= NETWORK_CONFIG.neutralInputTimeoutSec * 1000) {
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

      const events: SimEvent[] = [];
      stepSim(room.sim, inputsByTankId, events);

      if (events.length > 0) {
        this.broadcastRoom(room, { type: 'event', events });
      }

      room.snapshotAccum += PHYSICS.fixedDt;
      if (room.snapshotAccum >= 1 / PHYSICS.snapshotHz) {
        room.snapshotAccum = 0;
        this.broadcastRoom(room, { type: 'snapshot', snapshot: this.buildSnapshot(room.sim) });
      }

      if (room.sim.matchEnded) {
        if (room.tickTimer) {
          clearInterval(room.tickTimer);
          room.tickTimer = null;
        }
        room.phase = 'RESULTS';
        room.rematchVotes.clear();
        const summary = buildMatchResultSummary(room.sim);
        this.broadcastRoom(room, {
          type: 'matchEnd',
          summary,
          room: this.toRoomStateInfo(room),
        });
      }
    } catch (err) {
      console.error(`[Room ${room.code}] Tick error:`, err);
    }
  }

  private buildSnapshot(sim: SimState): WorldSnapshot {
    const r2 = (n: number) => Math.round(n * 100) / 100;
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
        hullAngle: Math.round(t.hullAngle * 1000) / 1000,
        turretAngle: Math.round(t.turretAngle * 1000) / 1000,
      })),
      projectiles: sim.projectiles.map((p) => ({
        ...p,
        x: r2(p.x),
        y: r2(p.y),
        z: r2(p.z),
      })),
      mines: sim.mines,
      airstrikes: sim.airstrikes,
      powerBoxes: sim.powerBoxes,
      destructibles: sim.destructibles,
      flags: sim.flags,
      hill: sim.hill,
      safeZone: sim.safeZone,
    };
  }

  private handleDisconnect(conn: ClientConn) {
    if (!conn.roomCode) return;
    const room = this.rooms.get(conn.roomCode);
    if (!room) return;

    if (conn.isSpectator) {
      room.spectators = room.spectators.filter((s) => s !== conn);
      this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
      return;
    }

    const player = room.players.find((p) => p.id === conn.playerId);
    if (!player) return;

    if (room.phase === 'PLAYING' && room.sim) {
      // Edge case 20: 60s reconnect grace, tank parked & invulnerable meanwhile
      player.conn = null;
      player.disconnectedAt = Date.now();
      const t = room.sim.tanks.find((tk) => tk.id === player.id);
      if (t) {
        t.disconnected = true;
        t.vx = 0;
        t.vz = 0;
        // Edge case 9: flag carrier disconnects -> drop flag
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

  private leaveCurrentRoom(conn: ClientConn) {
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

  private removePlayerFromRoom(room: RoomInstance, playerId: string) {
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
    this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
  }

  private migrateHostIfNeeded(room: RoomInstance, disconnectedId: string) {
    const p = room.players.find((pl) => pl.id === disconnectedId);
    if (p?.isHost) {
      const next = room.players.find((pl) => pl.id !== disconnectedId && pl.conn);
      if (next) {
        p.isHost = false;
        next.isHost = true;
        this.broadcastRoom(room, { type: 'toast', text: `${next.name} is now the host`, tone: 'info' });
        this.broadcastRoom(room, { type: 'roomUpdate', room: this.toRoomStateInfo(room) });
      }
    }
  }

  private migrateHost(room: RoomInstance) {
    // Earliest-joined human becomes host
    const sorted = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt);
    room.players.forEach((p) => (p.isHost = false));
    if (sorted[0]) {
      sorted[0].isHost = true;
      this.broadcastRoom(room, { type: 'toast', text: `${sorted[0].name} is now the host`, tone: 'info' });
    }
  }

  private housekeep() {
    const now = Date.now();

    // Kick silent WebSockets (>10s)
    for (const [ws, conn] of this.conns.entries()) {
      if (now - conn.lastPongAt > NETWORK_CONFIG.pingTimeoutMs) {
        ws.terminate();
        this.handleDisconnect(conn);
        this.conns.delete(ws);
      }
    }

    for (const [code, room] of this.rooms.entries()) {
      // Remove disconnected players past 60s grace
      for (const p of [...room.players]) {
        if (p.disconnectedAt && now - p.disconnectedAt > NETWORK_CONFIG.reconnectGraceSec * 1000) {
          this.removePlayerFromRoom(room, p.id);
        }
      }

      const activeHumans = room.players.filter((p) => p.conn !== null).length;
      if (activeHumans === 0 && room.spectators.length === 0) {
        if (!room.emptySince) room.emptySince = now;
        if (now - room.emptySince > NETWORK_CONFIG.roomDeleteIdleSec * 1000) {
          if (room.tickTimer) clearInterval(room.tickTimer);
          this.rooms.delete(code);
        }
      } else {
        room.emptySince = null;
      }
    }
  }
}
