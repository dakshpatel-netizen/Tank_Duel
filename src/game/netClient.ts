import { NETWORK_CONFIG, PHYSICS } from '../../shared/config';
import type { ChatMessage, ClientMessage, ServerMessage, WorldSnapshot } from '../../shared/protocol';
import { stepTank } from '../../shared/sim';
import type {
  MapDefinition,
  MatchResultSummary,
  MatchSettings,
  PlayerInput,
  RoomStateInfo,
  SimEvent,
  TankCustomization,
  TankState,
} from '../../shared/types';

export interface NetCallbacks {
  onStatusChange: (status: 'connecting' | 'online' | 'reconnecting' | 'offline') => void;
  onRoomJoined: (data: {
    room: RoomStateInfo;
    yourId: string;
    isSpectator: boolean;
    chatHistory: ChatMessage[];
  }) => void;
  onRoomUpdate: (room: RoomStateInfo) => void;
  onCountdown: (secondsLeft: number, settings: MatchSettings) => void;
  onMatchStart: (settings: MatchSettings, seed: number, snapshot: WorldSnapshot) => void;
  onSnapshot: (snapshot: WorldSnapshot) => void;
  onEvents: (events: SimEvent[]) => void;
  onChat: (msg: ChatMessage) => void;
  onToast: (text: string, tone?: 'info' | 'warn' | 'accent') => void;
  onMatchEnd: (summary: MatchResultSummary, room: RoomStateInfo) => void;
  onKicked: (reason: string) => void;
  onError: (code: string, message: string, canSpectate?: boolean) => void;
}

const TOKEN_STORAGE_KEY = 'tdo_player_token';
const ROOM_STORAGE_KEY = 'tdo_room_code';

export class NetClient {
  private ws: WebSocket | null = null;
  private cb: NetCallbacks;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDeadline = 0;

  public yourId = '';
  public isSpectator = false;
  public pingMs = 0;
  public serverClockOffsetMs = 0;
  public simLagMs = 0;
  public simLossPct = 0;

  // Prediction & reconciliation state
  private pendingInputs: PlayerInput[] = [];
  private predictedTank: TankState | null = null;
  private renderErrorOffsetX = 0;
  private renderErrorOffsetZ = 0;
  public lastPredictionError = 0;
  private snapshotBuffer: { time: number; snap: WorldSnapshot }[] = [];

  constructor(cb: NetCallbacks) {
    this.cb = cb;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      this.simLagMs = Math.max(0, Number(params.get('lag')) || 0);
      this.simLossPct = Math.max(0, Math.min(50, Number(params.get('loss')) || 0));
    }
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.cb.onStatusChange('connecting');
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.cb.onStatusChange('online');
      this.reconnectDeadline = 0;
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'ping', clientTime: Date.now() });
      }, NETWORK_CONFIG.pingIntervalMs);
    };

    ws.onmessage = (ev) => {
      const deliver = () => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        this.handleServerMessage(msg);
      };
      if (this.simLagMs > 0) {
        if (Math.random() * 100 < this.simLossPct) return;
        window.setTimeout(deliver, this.simLagMs * 0.5);
      } else {
        deliver();
      }
    };

    ws.onclose = () => {
      if (this.pingTimer) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      const savedRoom = sessionStorage.getItem(ROOM_STORAGE_KEY);
      if (savedRoom && !this.reconnectDeadline) {
        this.reconnectDeadline = Date.now() + 45000;
        this.cb.onStatusChange('reconnecting');
        this.scheduleReconnect();
      } else if (!savedRoom) {
        this.cb.onStatusChange('offline');
      }
    };

    ws.onerror = () => {
      // handled by onclose
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (Date.now() > this.reconnectDeadline) {
      sessionStorage.removeItem(ROOM_STORAGE_KEY);
      this.cb.onStatusChange('offline');
      return;
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, 1500);
  }

  public disconnect() {
    sessionStorage.removeItem(ROOM_STORAGE_KEY);
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  public send(msg: ClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const raw = JSON.stringify(msg);
    if (this.simLagMs > 0 && msg.type === 'input') {
      if (Math.random() * 100 < this.simLossPct) return;
      window.setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(raw);
      }, this.simLagMs * 0.5);
    } else {
      this.ws.send(raw);
    }
  }

  public createRoom(nickname: string, custom: TankCustomization, password = '') {
    this.connectAndSend(() => this.send({ type: 'createRoom', nickname, custom, password }));
  }

  public joinRoom(
    code: string,
    nickname: string,
    custom: TankCustomization,
    password = '',
    asSpectator = false
  ) {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || undefined;
    this.connectAndSend(() =>
      this.send({ type: 'joinRoom', code, nickname, custom, password, playerToken: token, asSpectator })
    );
  }

  private connectAndSend(fn: () => void) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      fn();
      return;
    }
    this.connect();
    const wait = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        window.clearInterval(wait);
        fn();
      }
    }, 80);
    window.setTimeout(() => window.clearInterval(wait), 5000);
  }

  public sendInput(input: PlayerInput, map: MapDefinition, settings: MatchSettings, carryingFlag: boolean) {
    this.send({ type: 'input', input });
    if (this.predictedTank && this.predictedTank.alive) {
      this.pendingInputs.push(input);
      if (this.pendingInputs.length > 60) this.pendingInputs.shift();
      stepTank(this.predictedTank, input, PHYSICS.fixedDt, map, [], settings, carryingFlag);
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'pong': {
        this.pingMs = Math.max(1, Date.now() - msg.clientTime);
        this.serverClockOffsetMs = msg.serverTime - (msg.clientTime + this.pingMs * 0.5);
        break;
      }
      case 'roomJoined': {
        this.yourId = msg.yourId;
        this.isSpectator = msg.isSpectator;
        if (msg.playerToken) sessionStorage.setItem(TOKEN_STORAGE_KEY, msg.playerToken);
        sessionStorage.setItem(ROOM_STORAGE_KEY, msg.room.code);
        this.cb.onRoomJoined({
          room: msg.room,
          yourId: msg.yourId,
          isSpectator: msg.isSpectator,
          chatHistory: msg.chatHistory,
        });
        break;
      }
      case 'roomUpdate': {
        this.cb.onRoomUpdate(msg.room);
        break;
      }
      case 'countdown': {
        this.cb.onCountdown(msg.secondsLeft, msg.settings);
        break;
      }
      case 'matchStart': {
        this.pendingInputs = [];
        this.snapshotBuffer = [{ time: performance.now(), snap: msg.snapshot }];
        const self = msg.snapshot.tanks.find((t) => t.id === this.yourId);
        this.predictedTank = self ? { ...self } : null;
        this.cb.onMatchStart(msg.settings, msg.seed, msg.snapshot);
        break;
      }
      case 'snapshot': {
        const now = performance.now();
        this.snapshotBuffer.push({ time: now, snap: msg.snapshot });
        while (this.snapshotBuffer.length > 8) this.snapshotBuffer.shift();
        this.cb.onSnapshot(msg.snapshot);
        break;
      }
      case 'event': {
        this.cb.onEvents(msg.events);
        break;
      }
      case 'chat': {
        this.cb.onChat(msg.message);
        break;
      }
      case 'toast': {
        this.cb.onToast(msg.text, msg.tone);
        break;
      }
      case 'matchEnd': {
        this.cb.onMatchEnd(msg.summary, msg.room);
        break;
      }
      case 'kicked': {
        sessionStorage.removeItem(ROOM_STORAGE_KEY);
        this.cb.onKicked(msg.reason);
        break;
      }
      case 'error': {
        this.cb.onError(msg.code, msg.message, msg.canSpectate);
        break;
      }
    }
  }

  public reconcileLocalTank(
    serverSnap: WorldSnapshot,
    map: MapDefinition,
    settings: MatchSettings
  ) {
    const auth = serverSnap.tanks.find((t) => t.id === this.yourId);
    if (!auth) return;

    const prevX = this.predictedTank?.x ?? auth.x;
    const prevZ = this.predictedTank?.z ?? auth.z;

    const cloned: TankState = { ...auth };
    this.pendingInputs = this.pendingInputs.filter((inp) => inp.seq > auth.lastProcessedSeq);
    const carrying = Boolean(
      serverSnap.flags &&
        (serverSnap.flags.red.carrierId === auth.id || serverSnap.flags.blue.carrierId === auth.id)
    );
    for (const inp of this.pendingInputs) {
      stepTank(cloned, inp, PHYSICS.fixedDt, map, serverSnap.destructibles, settings, carrying);
    }

    const err = Math.hypot(cloned.x - prevX, cloned.z - prevZ);
    this.lastPredictionError = err;
    if (err > NETWORK_CONFIG.reconcileSnapDist || !auth.alive) {
      this.renderErrorOffsetX = 0;
      this.renderErrorOffsetZ = 0;
    } else if (err > 0.02) {
      this.renderErrorOffsetX = prevX - cloned.x;
      this.renderErrorOffsetZ = prevZ - cloned.z;
    }
    this.predictedTank = cloned;
  }

  public getInterpolatedSnapshot(dt: number): WorldSnapshot | null {
    if (this.snapshotBuffer.length === 0) return null;
    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1].snap;
    if (this.snapshotBuffer.length === 1) return latest;

    const renderTime = performance.now() - NETWORK_CONFIG.interpDelayMs;
    let older = this.snapshotBuffer[0];
    let newer = this.snapshotBuffer[this.snapshotBuffer.length - 1];

    for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
      if (this.snapshotBuffer[i].time <= renderTime && this.snapshotBuffer[i + 1].time >= renderTime) {
        older = this.snapshotBuffer[i];
        newer = this.snapshotBuffer[i + 1];
        break;
      }
    }

    // Smoothly decay reconciliation error over 100ms
    const decay = Math.exp(-dt * 20);
    this.renderErrorOffsetX *= decay;
    this.renderErrorOffsetZ *= decay;

    const span = Math.max(1, newer.time - older.time);
    const rawAlpha = (renderTime - older.time) / span;
    const alpha = Math.max(0, Math.min(1, rawAlpha));
    const extrapSec = rawAlpha > 1 ? Math.min(NETWORK_CONFIG.maxExtrapMs / 1000, (renderTime - newer.time) / 1000) : 0;

    const lerpAngle = (a: number, b: number, t: number) => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    };

    const tanks = newer.snap.tanks.map((nt) => {
      if (nt.id === this.yourId && this.predictedTank && nt.alive) {
        return {
          ...this.predictedTank,
          x: this.predictedTank.x + this.renderErrorOffsetX,
          z: this.predictedTank.z + this.renderErrorOffsetZ,
        };
      }
      const ot = older.snap.tanks.find((t) => t.id === nt.id);
      if (!ot || !nt.alive || !ot.alive) return nt;
      return {
        ...nt,
        x: ot.x + (nt.x - ot.x) * alpha + nt.vx * extrapSec,
        z: ot.z + (nt.z - ot.z) * alpha + nt.vz * extrapSec,
        hullAngle: lerpAngle(ot.hullAngle, nt.hullAngle, alpha),
        turretAngle: lerpAngle(ot.turretAngle, nt.turretAngle, alpha),
      };
    });

    return {
      ...newer.snap,
      tanks,
    };
  }
}
