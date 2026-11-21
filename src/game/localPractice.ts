import { GAME_MODES, PHYSICS, TANK_COLORS } from '../../shared/config';
import { computeBotInput, type BotMemory } from '../../shared/bots';
import type { WorldSnapshot } from '../../shared/protocol';
import { buildMatchResultSummary, clampInput, createSimState, stepSim } from '../../shared/sim';
import type {
  LobbyPlayerInfo,
  MatchResultSummary,
  MatchSettings,
  PlayerInput,
  SimEvent,
  SimState,
  TankCustomization,
} from '../../shared/types';

export class LocalPracticeSession {
  public sim: SimState;
  public yourId = 'local_player';
  private botMemories = new Map<string, BotMemory>();
  private latestInput: PlayerInput;
  private timer: number | null = null;
  private onSnapshot: (snap: WorldSnapshot) => void;
  private onEvents: (events: SimEvent[]) => void;
  private onMatchEnd: (summary: MatchResultSummary) => void;
  private paused = false;

  constructor(
    nickname: string,
    custom: TankCustomization,
    settings: MatchSettings,
    callbacks: {
      onSnapshot: (snap: WorldSnapshot) => void;
      onEvents: (events: SimEvent[]) => void;
      onMatchEnd: (summary: MatchResultSummary) => void;
    }
  ) {
    this.onSnapshot = callbacks.onSnapshot;
    this.onEvents = callbacks.onEvents;
    this.onMatchEnd = callbacks.onMatchEnd;

    const participants: LobbyPlayerInfo[] = [
      {
        id: this.yourId,
        name: nickname || 'AceTanker',
        isHost: true,
        isBot: false,
        ready: true,
        team: 'red',
        custom,
        pingMs: 0,
        joinedAt: Date.now(),
      },
    ];

    const botCount = Math.max(1, Math.min(8, settings.botCount || 4));
    const classIds: ('scout' | 'standard' | 'heavy')[] = ['scout', 'standard', 'heavy'];
    for (let i = 0; i < botCount; i++) {
      const botId = `bot_${i + 1}`;
      const team = i % 2 === 0 ? 'blue' : 'red';
      participants.push({
        id: botId,
        name: `Bot ${['Viper', 'Titan', 'Nova', 'Apex', 'Rex', 'Bolt', 'Kilo', 'Zero'][i] ?? i + 1}`,
        isHost: false,
        isBot: true,
        ready: true,
        team,
        custom: {
          classId: settings.tankRule === 'classes' ? classIds[i % 3] : 'standard',
          colorId: TANK_COLORS[(i + 2) % TANK_COLORS.length].id,
          turretStyle: i % 3 === 0 ? 'angular' : i % 3 === 1 ? 'brawler' : 'dome',
          decal: 'stripes',
        },
        pingMs: 0,
        joinedAt: Date.now(),
      });
      this.botMemories.set(botId, {
        patrolX: 0,
        patrolZ: 0,
        patrolTimer: 0,
        strafeSign: i % 2 === 0 ? 1 : -1,
        strafeTimer: 1.5,
        reactionTimer: 0.25,
        seq: 0,
      });
    }

    const seed = Math.floor(Math.random() * 100000) + 1;
    this.sim = createSimState(participants, settings, seed);
    this.latestInput = {
      seq: 0,
      clientTime: 0,
      forward: 0,
      turn: 0,
      aimX: 0,
      aimZ: 10,
      fire: false,
      useWeapon: false,
      turbo: false,
      handbrake: false,
      dashDir: 0,
    };
  }

  public start() {
    if (this.timer !== null) return;
    this.onSnapshot(this.buildSnapshot());
    this.timer = window.setInterval(() => this.tick(), 1000 / PHYSICS.simHz);
  }

  public stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setPaused(p: boolean) {
    this.paused = p;
  }

  public pushInput(input: PlayerInput) {
    this.latestInput = clampInput(input, this.sim.map);
  }

  private tick() {
    if (this.paused || this.sim.matchEnded) return;
    const inputs: Record<string, PlayerInput> = {
      [this.yourId]: this.latestInput,
    };
    for (const t of this.sim.tanks) {
      if (!t.isBot || !t.alive) continue;
      const mem = this.botMemories.get(t.id);
      if (mem) {
        inputs[t.id] = computeBotInput(this.sim, t, mem, this.sim.settings.botDifficulty);
      }
    }
    const events: SimEvent[] = [];
    stepSim(this.sim, inputs, events);
    // Reset one-shot dashDir after processed
    this.latestInput.dashDir = 0;

    if (events.length > 0) {
      this.onEvents(events);
    }
    this.onSnapshot(this.buildSnapshot());

    if (this.sim.matchEnded) {
      this.stop();
      this.onMatchEnd(buildMatchResultSummary(this.sim));
    }
  }

  public buildSnapshot(): WorldSnapshot {
    return {
      tick: this.sim.tick,
      serverTime: Date.now(),
      timeRemainingSec: this.sim.timeRemainingSec,
      suddenDeath: this.sim.suddenDeath,
      roundNumber: this.sim.roundNumber,
      roundWins: this.sim.roundWins,
      teamScores: this.sim.teamScores,
      tanks: this.sim.tanks.map((t) => ({ ...t })),
      projectiles: this.sim.projectiles.map((p) => ({ ...p })),
      mines: this.sim.mines.map((m) => ({ ...m })),
      airstrikes: this.sim.airstrikes.map((a) => ({ ...a })),
      powerBoxes: this.sim.powerBoxes.map((b) => ({ ...b })),
      destructibles: this.sim.destructibles.map((d) => ({ ...d })),
      flags: this.sim.flags
        ? { red: { ...this.sim.flags.red }, blue: { ...this.sim.flags.blue } }
        : null,
      hill: this.sim.hill ? { ...this.sim.hill } : null,
      safeZone: { ...this.sim.safeZone },
    };
  }
}

export function getDefaultPracticeSettings(): MatchSettings {
  return {
    mode: 'ffa',
    mapId: 'desert_outpost',
    mapSize: 'medium',
    timeLimitSec: GAME_MODES.ffa.defaultTimeSec,
    scoreLimit: 10,
    powerBoxesEnabled: true,
    botCount: 4,
    botDifficulty: 'easy',
    friendlyFire: false,
    tankRule: 'classes',
    classicHp: 100,
    shrinkingZone: false,
    password: '',
  };
}
