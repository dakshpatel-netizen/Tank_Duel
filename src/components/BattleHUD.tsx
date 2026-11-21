import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Crosshair, HelpCircle, Menu, Pause, Shield, Volume2, VolumeX, Zap } from 'lucide-react';
import {
  GAME_MODES,
  POWER_BOX_ITEMS,
  QUICK_CHAT_OPTIONS,
  TANK_CLASSES,
  WEAPONS,
} from '../../shared/config';
import type { ChatMessage, WorldSnapshot } from '../../shared/protocol';
import type {
  MapDefinition,
  MatchSettings,
  PlayerInput,
  SimEvent,
  TankState,
} from '../../shared/types';
import { ArenaRenderer, type RendererOverlayFrame } from '../game/arenaRenderer';
import { drawMapTopDown } from '../game/mapThumbnail';
import { soundEngine } from '../game/sound';
import type { GameSettings } from '../types/settings';
import { formatKeyCode } from '../types/settings';
import { PowerItemIcon } from './Icons';

interface KillFeedEntry {
  id: number;
  killerName: string;
  victimName: string;
  weapon: string;
  killerTeam: string;
  victimTeam: string;
  createdAt: number;
}

interface BattleHUDProps {
  map: MapDefinition;
  matchSettings: MatchSettings;
  localId: string;
  isPractice: boolean;
  isSpectator: boolean;
  paused: boolean;
  settings: GameSettings;
  pingMs: number;
  lastPredError: number;
  snapshotProvider: (dt: number) => WorldSnapshot | null;
  latestSnapshot: WorldSnapshot | null;
  pendingEvents: SimEvent[];
  onConsumeEvents: () => void;
  onInputSample: (input: PlayerInput) => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleAimMode: () => void;
  onOpenHowToPlay: () => void;
  onSendQuickChat: (text: string) => void;
  chatFeed: ChatMessage[];
}

export const BattleHUD: React.FC<BattleHUDProps> = ({
  map,
  matchSettings,
  localId,
  isPractice,
  isSpectator,
  paused,
  settings,
  pingMs,
  lastPredError,
  snapshotProvider,
  latestSnapshot,
  pendingEvents,
  onConsumeEvents,
  onInputSample,
  onTogglePause,
  onToggleMute,
  onToggleAimMode,
  onOpenHowToPlay,
  onSendQuickChat,
  chatFeed,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapBaseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [overlay, setOverlay] = useState<RendererOverlayFrame>({
    fps: 60,
    tags: [],
    floatingDamages: [],
    inboundWarnings: [],
    guidedActive: false,
    guidedFuelPct: 0,
    spectatingName: null,
    lastPredError: 0,
    entityCount: 0,
  });

  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; tone: 'gold' | 'danger' | 'accent' } | null>(null);
  const [pickupBanner, setPickupBanner] = useState<{ id: number; text: string } | null>(null);
  const [hudShake, setHudShake] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [enlargeMinimap, setEnlargeMinimap] = useState(false);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [showHints, setShowHints] = useState(true);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onInputRef = useRef(onInputSample);
  onInputRef.current = onInputSample;
  const snapProvRef = useRef(snapshotProvider);
  snapProvRef.current = snapshotProvider;

  const isDebugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // Pre-render static minimap terrain once per map
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = 280;
    off.height = 280;
    const ctx = off.getContext('2d');
    if (ctx) {
      drawMapTopDown(ctx, map, 280, 280, false);
    }
    mapBaseCanvasRef.current = off;
  }, [map]);

  // First 6s control hints auto-hide
  useEffect(() => {
    const t = window.setTimeout(() => setShowHints(false), 6000);
    return () => window.clearTimeout(t);
  }, []);

  // Mount Three.js ArenaRenderer
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const renderer = new ArenaRenderer(el, map, localId, settings);
    rendererRef.current = renderer;

    renderer.setCallbacks({
      snapshotProvider: (dt) => snapProvRef.current(dt),
      onInputSample: (inp) => {
        if (!pausedRef.current) onInputRef.current(inp);
      },
      onOverlayFrame: (frame) => setOverlay(frame),
    });

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [map, localId]);

  useEffect(() => {
    rendererRef.current?.applySettings(settings);
  }, [settings]);

  // Process incoming SimEvents
  useEffect(() => {
    if (pendingEvents.length === 0) return;
    rendererRef.current?.handleSimEvents(pendingEvents);

    const now = Date.now();
    for (const ev of pendingEvents) {
      if (ev.type === 'hit' && ev.targetId === localId && ev.damage > 0) {
        setHudShake(true);
        window.setTimeout(() => setHudShake(false), 260);
      } else if (ev.type === 'tank_destroyed') {
        setKillFeed((prev) => [
          {
            id: now + Math.random(),
            killerName: ev.killerName,
            victimName: ev.victimName,
            weapon: ev.weapon,
            killerTeam: ev.killerTeam,
            victimTeam: ev.victimTeam,
            createdAt: now,
          },
          ...prev.slice(0, 3),
        ]);
        if (ev.killerId === localId && ev.streak && ev.streak >= 3) {
          const label =
            ev.streak >= 10
              ? 'LEGEND!'
              : ev.streak >= 7
              ? 'UNSTOPPABLE!'
              : ev.streak >= 5
              ? 'RAMPAGE!'
              : 'TRIPLE!';
          setBanner({ id: now, text: `${label} (${ev.streak} Streak)`, tone: 'gold' });
        }
      } else if (ev.type === 'pickup' && ev.tankId === localId) {
        const def = POWER_BOX_ITEMS.find((p) => p.id === ev.itemId);
        if (def) {
          setPickupBanner({ id: now, text: `${def.name} — ${def.summary}` });
        }
      } else if (ev.type === 'announcement') {
        setBanner({ id: now, text: ev.text, tone: ev.tone ?? 'accent' });
      } else if (ev.type === 'flag_event') {
        setBanner({
          id: now,
          text: `${ev.team.toUpperCase()} FLAG ${ev.action.toUpperCase()}${ev.byName ? ` (${ev.byName})` : ''}`,
          tone: ev.team === 'red' ? 'danger' : 'accent',
        });
      }
    }
    onConsumeEvents();
  }, [pendingEvents, localId, onConsumeEvents]);

  // Auto-expire banners & killfeed entries
  useEffect(() => {
    const id = window.setInterval(() => {
      const cutoff = Date.now() - 5000;
      setKillFeed((prev) => prev.filter((k) => k.createdAt > cutoff));
    }, 600);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 2600);
    return () => window.clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    if (!pickupBanner) return;
    const t = window.setTimeout(() => setPickupBanner(null), 2000);
    return () => window.clearTimeout(t);
  }, [pickupBanner]);

  // Tab scoreboard / minimap tap + Quick Chat T key
  useEffect(() => {
    let tabDownAt = 0;
    let tabTimer: number | null = null;
    const quickKey = settings.controls.bindings.quickChat;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!e.repeat) {
          tabDownAt = performance.now();
          tabTimer = window.setTimeout(() => setShowScoreboard(true), 180);
        }
      } else if (e.code === quickKey && !e.repeat) {
        setQuickChatOpen((prev) => !prev);
      } else if (quickChatOpen && e.code.startsWith('Digit')) {
        const idx = Number(e.code.slice(5)) - 1;
        if (idx >= 0 && idx < QUICK_CHAT_OPTIONS.length) {
          onSendQuickChat(QUICK_CHAT_OPTIONS[idx]);
          setQuickChatOpen(false);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (tabTimer) window.clearTimeout(tabTimer);
        setShowScoreboard(false);
        if (performance.now() - tabDownAt < 180) {
          setEnlargeMinimap(true);
          window.setTimeout(() => setEnlargeMinimap(false), 3000);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [quickChatOpen, settings.controls.bindings.quickChat, onSendQuickChat]);

  // Draw live minimap dots at snapshot updates
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const base = mapBaseCanvasRef.current;
    if (!canvas || !base || !latestSnapshot) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sz = canvas.width;
    ctx.clearRect(0, 0, sz, sz);
    ctx.drawImage(base, 0, 0, sz, sz);

    const pad = 6;
    const scale = Math.min((sz - pad * 2) / map.width, (sz - pad * 2) / map.depth);
    const ox = sz * 0.5;
    const oz = sz * 0.5;
    const tx = (x: number) => ox + x * scale;
    const tz = (z: number) => oz + z * scale;

    // Safe Zone circle
    if (latestSnapshot.safeZone.enabled) {
      ctx.strokeStyle = '#FF4D6D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx(latestSnapshot.safeZone.x), tz(latestSnapshot.safeZone.z), latestSnapshot.safeZone.currentRadius * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hill Zone
    if (latestSnapshot.hill) {
      ctx.strokeStyle = '#FFC83D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx(latestSnapshot.hill.x), tz(latestSnapshot.hill.z), latestSnapshot.hill.r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Power Boxes
    for (const b of latestSnapshot.powerBoxes) {
      if (!b.active) continue;
      ctx.fillStyle = '#FFC83D';
      ctx.fillRect(tx(b.x) - 2, tz(b.z) - 2, 4, 4);
    }

    // CTF Flags
    if (latestSnapshot.flags) {
      ctx.fillStyle = '#FF4D5E';
      ctx.fillRect(tx(latestSnapshot.flags.red.x) - 3.5, tz(latestSnapshot.flags.red.z) - 3.5, 7, 7);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(tx(latestSnapshot.flags.blue.x) - 3.5, tz(latestSnapshot.flags.blue.z) - 3.5, 7, 7);
    }

    // Tanks
    const localTank = latestSnapshot.tanks.find((t) => t.id === localId);
    for (const t of latestSnapshot.tanks) {
      if (!t.alive) continue;
      const isMe = t.id === localId;
      const isAlly = localTank && localTank.team !== 'none' && localTank.team === t.team;
      ctx.fillStyle = isMe ? '#00E5C3' : isAlly ? '#38BDF8' : '#FF4D6D';
      ctx.beginPath();
      ctx.arc(tx(t.x), tz(t.z), isMe ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (isMe) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [latestSnapshot, map, localId, enlargeMinimap]);

  const localTank: TankState | undefined = latestSnapshot?.tanks.find((t) => t.id === localId);
  const hpPct = localTank ? Math.max(0, Math.min(100, (localTank.hp / localTank.maxHp) * 100)) : 0;
  const hpColor = hpPct > 60 ? '#3DDC84' : hpPct > 30 ? '#FFC83D' : '#FF4D6D';
  const storedDef = localTank?.storedWeapon ? WEAPONS[localTank.storedWeapon] : null;
  const timeSec = Math.max(0, Math.ceil(latestSnapshot?.timeRemainingSec ?? matchSettings.timeLimitSec));
  const mm = String(Math.floor(timeSec / 60)).padStart(2, '0');
  const ss = String(timeSec % 60).padStart(2, '0');
  const modeMeta = GAME_MODES[matchSettings.mode];
  const sortedTanks = useMemo(() => {
    if (!latestSnapshot) return [];
    return [...latestSnapshot.tanks].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }, [latestSnapshot]);

  const minimapSizePx = enlargeMinimap ? 260 : 160;

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${hudShake ? 'anim-hud-shake' : ''}`}>
      {/* 3D WebGL Arena Viewport */}
      <div
        ref={viewportRef}
        data-testid="arena-viewport"
        className={`absolute inset-0 w-full h-full ${settings.aiming.aimMode === 'mouse' ? 'cursor-crosshair' : ''}`}
      />

      {/* Projected Enemy Tags & Off-Screen Edge Arrows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {overlay.tags.map((tag) => {
          if (tag.isLocal) return null;
          if (tag.onScreen) {
            const pct = Math.max(0, Math.min(100, (tag.hp / tag.maxHp) * 100));
            return (
              <div
                key={tag.id}
                className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center gap-0.5"
                style={{ left: `${tag.sx}px`, top: `${tag.sy}px` }}
              >
                <div className="px-2 py-0.5 rounded-full bg-black/75 border border-white/15 text-[11px] font-display font-bold text-white whitespace-nowrap flex items-center gap-1">
                  <span className={tag.isEnemy ? 'text-[#FF4D6D]' : 'text-[#38BDF8]'}>
                    {tag.name}
                  </span>
                  {tag.afk && <span className="text-[#FFC83D]">AFK</span>}
                </div>
                <div className="w-14 h-1.5 rounded-full bg-black/70 overflow-hidden border border-white/20">
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      background: tag.isEnemy ? '#FF4D6D' : '#3DDC84',
                    }}
                  />
                </div>
              </div>
            );
          }
          if (!tag.isEnemy) return null;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const cx = w * 0.5;
          const cy = h * 0.5;
          const dx = Math.cos(tag.edgeAngle);
          const dy = Math.sin(tag.edgeAngle);
          const leftBound = 44;
          const rightBound = w - 44;
          const topBound = 104;
          const bottomBound = h - 134;
          const txMax = dx >= 0 ? (rightBound - cx) / Math.max(0.001, dx) : (leftBound - cx) / Math.min(-0.001, dx);
          const tyMax = dy >= 0 ? (bottomBound - cy) / Math.max(0.001, dy) : (topBound - cy) / Math.min(-0.001, dy);
          const scale = Math.min(txMax, tyMax);
          let ax = cx + dx * scale;
          let ay = cy + dy * scale;
          // Exclude top-right minimap area
          const mmLimitX = w - (minimapSizePx + 58);
          const mmLimitY = minimapSizePx + 74;
          if (ax > mmLimitX && ay < mmLimitY) {
            if (ax - mmLimitX < mmLimitY - ay) {
              ax = mmLimitX;
            } else {
              ay = mmLimitY;
            }
          }
          return (
            <div
              key={tag.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${ax}px`, top: `${ay}px` }}
            >
              <div
                className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[11px] border-b-[#FF4D6D]"
                style={{ transform: `rotate(${tag.edgeAngle + Math.PI / 2}rad)` }}
              />
              <span className="text-[10px] font-mono-num font-bold text-[#FF4D6D] bg-black/80 px-1.5 py-0.5 rounded mt-0.5 border border-[#FF4D6D]/35">
                {tag.distMeters}m
              </span>
            </div>
          );
        })}

        {/* Floating Damage Numbers */}
        {overlay.floatingDamages.map((fd) => (
          <div
            key={fd.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 font-mono-num text-base font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            style={{
              left: `${fd.sx}px`,
              top: `${fd.sy}px`,
              color: fd.color,
              opacity: Math.max(0, 1 - fd.age / 0.85),
            }}
          >
            {fd.text}
          </div>
        ))}

        {/* Inbound Homing/Guided Missile Warnings */}
        {overlay.inboundWarnings.map((w) => (
          <div
            key={w.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-[#FF4D6D] text-white text-[11px] font-display font-bold shadow-lg"
            style={{ left: `${w.sx}px`, top: `${w.sy}px` }}
          >
            MISSILE {w.dist}m
          </div>
        ))}
      </div>

      {/* TOP-LEFT: Kills/Deaths + Menu/Mute */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="hud-panel px-4 py-2 rounded-[18px] flex items-center gap-4">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-[#AAB3DE]">Kills</div>
            <div className="font-mono-num text-xl font-bold text-[#00E5C3]">
              {localTank?.kills ?? 0}
            </div>
          </div>
          <div className="w-px h-6 bg-white/15" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-[#AAB3DE]">Deaths</div>
            <div className="font-mono-num text-xl font-bold text-[#FF4D6D]">
              {localTank?.deaths ?? 0}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={settings.audio.muted ? 'Unmute' : 'Mute'}
          className="hud-panel p-2.5 rounded-[14px] text-[#F5F7FF] hover:text-[#00E5C3] cursor-pointer"
        >
          {settings.audio.muted ? <VolumeX className="w-5 h-5 text-[#FF4D6D]" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleAimMode}
          aria-label="Toggle Aim Mode"
          title="Switch between Mouse Turret aim and Tank-Forward aim"
          className="hud-panel px-3 py-2.5 rounded-[14px] text-[#F5F7FF] hover:text-[#00E5C3] cursor-pointer flex items-center gap-1.5 text-xs font-display font-semibold"
        >
          {settings.aiming.aimMode === 'mouse' ? (
            <Crosshair className="w-4 h-4 text-[#00E5C3]" />
          ) : (
            <Compass className="w-4 h-4 text-[#FFC83D]" />
          )}
          <span className="hidden sm:inline">
            Aim: {settings.aiming.aimMode === 'mouse' ? 'Mouse' : 'Tank'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenHowToPlay}
          aria-label="How to Play"
          title="Battle Controls & Tactics"
          className="hud-panel p-2.5 rounded-[14px] text-[#F5F7FF] hover:text-[#FFC83D] cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onTogglePause}
          aria-label="Open Pause Menu"
          className="hud-panel px-3 py-2.5 rounded-[14px] text-[#F5F7FF] hover:text-[#00E5C3] cursor-pointer flex items-center gap-1.5 text-sm font-display font-semibold"
        >
          {isPractice ? <Pause className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          Esc
        </button>
      </div>

      {/* TOP-CENTER: Objective Bar + Clock */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
        <div className="hud-panel px-5 py-2 rounded-[20px] flex items-center gap-4">
          {modeMeta.isTeam && latestSnapshot && (
            <div className="flex items-center gap-2 font-mono-num text-xl font-extrabold">
              <span className="text-[#FF4D5E]">RED {latestSnapshot.teamScores.red}</span>
              <span className="text-white/30">:</span>
              <span className="text-[#3B82F6]">{latestSnapshot.teamScores.blue} BLUE</span>
            </div>
          )}

          {!modeMeta.isTeam && matchSettings.mode === 'ffa' && sortedTanks[0] && (
            <div className="text-sm font-display font-bold text-[#FFC83D]">
              Leader: {sortedTanks[0].name} ({sortedTanks[0].kills}/{matchSettings.scoreLimit})
            </div>
          )}

          {matchSettings.mode === 'lts' && latestSnapshot && (
            <div className="text-sm font-display font-bold text-[#FFC83D]">
              Round {latestSnapshot.roundNumber} • Alive{' '}
              {latestSnapshot.tanks.filter((t) => t.alive).length}/{latestSnapshot.tanks.length}
            </div>
          )}

          <div className="w-px h-6 bg-white/15" />

          <div
            className={`font-mono-num text-2xl font-extrabold ${
              timeSec <= 15 || latestSnapshot?.suddenDeath ? 'text-[#FF4D6D]' : 'text-[#F5F7FF]'
            }`}
          >
            {latestSnapshot?.suddenDeath ? `SD ${mm}:${ss}` : `${mm}:${ss}`}
          </div>
        </div>

        {/* CTF Flag Status */}
        {latestSnapshot?.flags && (
          <div className="hud-panel px-3 py-1 rounded-full flex items-center gap-3 text-xs font-semibold">
            <span className="text-[#FF4D5E]">
              Red Flag:{' '}
              {latestSnapshot.flags.red.atHome
                ? 'Home'
                : latestSnapshot.flags.red.carrierId
                ? 'Carried!'
                : 'Dropped'}
            </span>
            <span className="text-white/25">|</span>
            <span className="text-[#3B82F6]">
              Blue Flag:{' '}
              {latestSnapshot.flags.blue.atHome
                ? 'Home'
                : latestSnapshot.flags.blue.carrierId
                ? 'Carried!'
                : 'Dropped'}
            </span>
          </div>
        )}

        {/* KOTH Hill Status */}
        {latestSnapshot?.hill && (
          <div className="hud-panel px-3 py-1 rounded-full text-xs font-semibold text-[#FFC83D]">
            Hill: {latestSnapshot.hill.holderTeam.toUpperCase()} • Moves in{' '}
            {Math.ceil(latestSnapshot.hill.moveTimer)}s
          </div>
        )}
      </div>

      {/* TOP-RIGHT: Minimap + FPS/Ping */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        <div
          className="hud-panel p-1.5 rounded-[18px] transition-all duration-150 cursor-pointer"
          onClick={() => setEnlargeMinimap((v) => !v)}
          title="Tap Tab or click to resize minimap"
        >
          <canvas
            ref={minimapCanvasRef}
            width={minimapSizePx}
            height={minimapSizePx}
            className="rounded-[12px] block"
          />
        </div>

        {(settings.graphics.showFpsPing || isDebugMode) && (
          <div className="hud-panel px-3 py-1 rounded-full text-xs font-mono-num text-[#AAB3DE] flex items-center gap-2">
            <span className="text-[#3DDC84]">{overlay.fps} FPS</span>
            {!isPractice && <span>{pingMs}ms</span>}
          </div>
        )}
      </div>

      {/* MIDDLE-LEFT: Kill Feed + Recent Chat */}
      <div className="pointer-events-none absolute top-24 left-3 flex flex-col gap-1.5 max-w-xs">
        {killFeed.map((k) => (
          <div
            key={k.id}
            className="hud-panel anim-killfeed-in px-3 py-1.5 rounded-[12px] text-xs font-semibold flex items-center gap-1.5"
          >
            <span className="text-[#00E5C3] font-bold">{k.killerName}</span>
            <span className="text-[#AAB3DE]">[{k.weapon}]</span>
            <span className="text-[#FF4D6D] font-bold">{k.victimName}</span>
          </div>
        ))}
        {chatFeed.slice(-3).map((c) => (
          <div
            key={c.id}
            className="px-2.5 py-1 rounded-[10px] bg-black/55 text-xs text-white/90"
          >
            <span className="text-[#FFC83D] font-bold">{c.senderName}: </span>
            {c.text}
          </div>
        ))}
      </div>

      {/* CENTER-TOP: Streak / Event Banner & Pickup Toast */}
      {banner && (
        <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2">
          <div
            className={`hud-panel anim-streak-in px-6 py-2.5 rounded-full font-display text-2xl font-extrabold border-2 ${
              banner.tone === 'gold'
                ? 'border-[#FFC83D] text-[#FFC83D]'
                : banner.tone === 'danger'
                ? 'border-[#FF4D6D] text-[#FF4D6D]'
                : 'border-[#00E5C3] text-[#00E5C3]'
            }`}
          >
            {banner.text}
          </div>
        </div>
      )}

      {pickupBanner && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2">
          <div className="hud-panel anim-pickup-pop px-5 py-2 rounded-full font-display text-sm font-bold text-[#FFC83D] border border-[#FFC83D]/50">
            {pickupBanner.text}
          </div>
        </div>
      )}

      {/* GUIDED MISSILE HUD */}
      {overlay.guidedActive && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 hud-panel px-5 py-2.5 rounded-[18px] border-[#C084FC]/60 flex flex-col items-center gap-1.5">
          <div className="font-display text-sm font-bold text-[#C084FC] flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" />
            GUIDED MISSILE ACTIVE — STEER WITH MOUSE
          </div>
          <div className="w-48 h-2 rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-[#C084FC]"
              style={{ width: `${Math.round(overlay.guidedFuelPct * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* SPECTATOR INDICATOR */}
      {isSpectator && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 hud-panel px-4 py-1.5 rounded-full text-xs font-display font-bold text-[#00E5C3]">
          Spectating: {overlay.spectatingName || 'Arena'} — Click to cycle camera
        </div>
      )}

      {/* BOTTOM-LEFT: Health (with white lag bar), Shield, Turbo, Scout Dash */}
      {localTank && !isSpectator && (
        <div className="absolute bottom-4 left-4 hud-panel p-4 rounded-[22px] w-72 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-[#F5F7FF]">
                {TANK_CLASSES[localTank.custom.classId].name}
              </span>
              {localTank.shieldHp > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] text-xs font-bold">
                  <Shield className="w-3 h-3" /> {Math.ceil(localTank.shieldHp)}
                </span>
              )}
              {localTank.empTimer > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FF4D6D]/25 text-[#FF4D6D] text-xs font-bold">
                  EMP {localTank.empTimer.toFixed(1)}s
                </span>
              )}
            </div>
            <span className="font-mono-num text-xl font-extrabold text-[#F5F7FF]">
              {Math.ceil(localTank.hp)}/{localTank.maxHp}
            </span>
          </div>

          {/* Health bar with white lag trail */}
          <div className="relative h-4 rounded-full bg-black/45 overflow-hidden border border-white/12">
            <div
              className="absolute inset-y-0 left-0 bg-white/80 transition-[width] duration-300 ease-out"
              style={{ width: `${hpPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-75"
              style={{ width: `${hpPct}%`, backgroundColor: hpColor }}
            />
          </div>

          {/* Turbo bar */}
          <div className="flex items-center gap-2 text-xs">
            <Zap className={`w-4 h-4 shrink-0 ${localTank.turboActive ? 'text-[#00E5C3]' : 'text-[#AAB3DE]'}`} />
            <div className="flex-1 h-2 rounded-full bg-black/45 overflow-hidden">
              <div
                className="h-full transition-[width] duration-75"
                style={{
                  width: `${Math.round(localTank.turboStamina * 100)}%`,
                  backgroundColor: localTank.turboLockout ? '#FF4D6D' : '#00E5C3',
                }}
              />
            </div>
            <span className="font-mono-num text-[11px] text-[#AAB3DE]">
              {formatKeyCode(settings.controls.bindings.turbo)}
            </span>
          </div>

          {/* Scout Dash Cooldown */}
          {localTank.custom.classId === 'scout' && matchSettings.tankRule === 'classes' && (
            <div className="flex items-center justify-between text-xs text-[#AAB3DE]">
              <span>Side Dash ({formatKeyCode(settings.controls.bindings.dashLeft)}/{formatKeyCode(settings.controls.bindings.dashRight)})</span>
              <span className={`font-mono-num font-bold ${localTank.dashCooldown <= 0 ? 'text-[#00E5C3]' : 'text-[#FFC83D]'}`}>
                {localTank.dashCooldown <= 0 ? 'READY' : `${localTank.dashCooldown.toFixed(1)}s`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM-RIGHT: Tactile 5-Slot Ammo & Missile Rack + Active Timed Buffs */}
      {localTank && !isSpectator && (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
          {/* Active Timed Buffs */}
          {localTank.buffs.length > 0 && (
            <div className="flex gap-2">
              {localTank.buffs.map((b) => (
                <div
                  key={b.id}
                  className="hud-panel px-3 py-1.5 rounded-[14px] flex items-center gap-2 text-xs font-bold text-[#38BDF8]"
                >
                  <PowerItemIcon itemId={b.id} className="w-4 h-4" />
                  <span className="font-mono-num">{b.remaining.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          )}

          {/* 5-Slot Ammo & Missile Rack */}
          {(() => {
            const reloadPct =
              localTank.reloadMax > 0
                ? Math.max(0, Math.min(1, 1 - localTank.reloadTimer / localTank.reloadMax))
                : 1;
            const cannonReady = reloadPct >= 0.99;
            const specialCharges = localTank.storedWeapon ? Math.max(1, Math.min(5, localTank.storedAmmo)) : 0;
            const rackAccent = storedDef
              ? storedDef.rarity === 'purple'
                ? '#C084FC'
                : '#FFC83D'
              : '#00E5C3';

            return (
              <div className="hud-panel px-4 py-3 rounded-[22px] w-[264px] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-[10px] bg-black/45 border border-white/15 flex items-center justify-center shrink-0">
                      {localTank.storedWeapon ? (
                        <PowerItemIcon itemId={localTank.storedWeapon} className="w-4 h-4" />
                      ) : (
                        <Crosshair className="w-4 h-4 text-[#00E5C3]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold text-[#F5F7FF] truncate">
                        {storedDef ? storedDef.name : 'Main Cannon'}
                      </div>
                      <div className="text-[10px] text-[#AAB3DE] truncate">
                        {storedDef
                          ? `${formatKeyCode(settings.controls.bindings.useWeapon)} / RMB (${localTank.storedAmmo} left)`
                          : `${formatKeyCode(settings.controls.bindings.useWeapon)} / LMB Fire`}
                      </div>
                    </div>
                  </div>
                  <span
                    className="font-mono-num text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: storedDef
                        ? `${rackAccent}26`
                        : cannonReady
                        ? 'rgba(0,229,195,0.18)'
                        : 'rgba(255,200,61,0.18)',
                      color: storedDef ? rackAccent : cannonReady ? '#00E5C3' : '#FFC83D',
                    }}
                  >
                    {storedDef ? `x${localTank.storedAmmo}` : cannonReady ? 'READY' : `${Math.round(reloadPct * 100)}%`}
                  </span>
                </div>

                {/* 5 Visual Missile / Shell Bays */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 4].map((slotIdx) => {
                    const isSpecialLit = storedDef ? slotIdx < specialCharges : false;
                    const isCannonLit = !storedDef && (slotIdx > 0 || cannonReady);
                    const lit = storedDef ? isSpecialLit : isCannonLit;

                    return (
                      <div
                        key={slotIdx}
                        className="relative h-9 rounded-[10px] bg-black/45 border flex items-center justify-center overflow-hidden"
                        style={{
                          borderColor: lit ? `${rackAccent}80` : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        {!storedDef && slotIdx === 0 && !cannonReady && (
                          <div
                            className="absolute inset-x-0 bottom-0 bg-[#FFC83D]/25"
                            style={{ height: `${Math.round(reloadPct * 100)}%` }}
                          />
                        )}
                        <svg
                          viewBox="0 0 24 32"
                          className="w-4 h-6 relative z-10"
                          aria-hidden="true"
                        >
                          {storedDef ? (
                            <>
                              <path
                                d="M12 2 L17 9 L17 23 L20 27 L17 27 L17 28 L7 28 L7 27 L4 27 L7 23 L7 9 Z"
                                fill={lit ? rackAccent : 'rgba(255,255,255,0.14)'}
                              />
                              <path
                                d="M12 2 L17 9 L7 9 Z"
                                fill={lit ? '#FF4D6D' : 'rgba(255,255,255,0.22)'}
                              />
                            </>
                          ) : (
                            <>
                              <path
                                d="M12 3 C15 6 16 10 16 14 L16 26 L8 26 L8 14 C8 10 9 6 12 3 Z"
                                fill={lit ? '#00E5C3' : 'rgba(255,255,255,0.16)'}
                              />
                              <rect
                                x="7.5"
                                y="24"
                                width="9"
                                height="3.5"
                                rx="1"
                                fill={lit ? '#FFC83D' : 'rgba(255,255,255,0.18)'}
                              />
                            </>
                          )}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* FIRST-6s CONTROL HINTS (wide viewports only, zero overlap with corner cards) */}
      {showHints && !paused && (
        <div className="pointer-events-none hidden xl:flex items-center gap-2 absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[calc(100vw-660px)] truncate hud-panel px-4 py-1.5 rounded-full text-xs text-[#AAB3DE] whitespace-nowrap">
          WASD Drive • {settings.aiming.aimMode === 'mouse' ? 'Mouse Aim' : 'Tank-Forward Aim'} • Space / LMB Fire • Shift Turbo • Tab Scoreboard
        </div>
      )}

      {/* QUICK CHAT WHEEL (T) */}
      {quickChatOpen && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 hud-panel p-3 rounded-[22px] flex flex-wrap gap-2 max-w-md justify-center z-30">
          {QUICK_CHAT_OPTIONS.map((q, idx) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                onSendQuickChat(q);
                setQuickChatOpen(false);
              }}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-[#00E5C3] hover:text-[#0A0F25] text-xs font-display font-bold cursor-pointer"
            >
              [{idx + 1}] {q}
            </button>
          ))}
        </div>
      )}

      {/* TAB-HOLD SCOREBOARD */}
      {showScoreboard && latestSnapshot && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-6 bg-black/45">
          <div className="hud-panel w-full max-w-3xl rounded-[26px] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/12">
              <h3 className="font-display text-xl font-bold text-[#F5F7FF]">
                Scoreboard — {modeMeta.name} ({map.name})
              </h3>
              <span className="font-mono-num text-sm text-[#00E5C3]">
                {mm}:{ss}
              </span>
            </div>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-[#AAB3DE] border-b border-white/10">
                  <th className="py-2">Tank</th>
                  <th>Class</th>
                  <th className="text-right">Kills</th>
                  <th className="text-right">Deaths</th>
                  <th className="text-right">Assists</th>
                  <th className="text-right">Damage</th>
                  <th className="text-right">Ping</th>
                </tr>
              </thead>
              <tbody>
                {sortedTanks.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-white/6 ${
                      t.id === localId ? 'bg-[#00E5C3]/12 text-white font-bold' : 'text-[#F5F7FF]'
                    }`}
                  >
                    <td className="py-2">
                      {t.name}{' '}
                      {t.team !== 'none' && (
                        <span className={t.team === 'red' ? 'text-[#FF4D5E]' : 'text-[#3B82F6]'}>
                          [{t.team.toUpperCase()}]
                        </span>
                      )}
                    </td>
                    <td className="text-[#AAB3DE] capitalize">{t.custom.classId}</td>
                    <td className="text-right font-mono-num">{t.kills}</td>
                    <td className="text-right font-mono-num">{t.deaths}</td>
                    <td className="text-right font-mono-num">{t.assists}</td>
                    <td className="text-right font-mono-num">{Math.round(t.damageDealt)}</td>
                    <td className="text-right font-mono-num text-[#AAB3DE]">
                      {t.isBot ? 'BOT' : `${t.pingMs}ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ?debug=1 DIAGNOSTIC OVERLAY */}
      {isDebugMode && (
        <div className="pointer-events-none fixed bottom-28 left-4 hud-panel px-3 py-2 rounded-[14px] text-[11px] font-mono-num text-[#00E5C3]">
          FPS: {overlay.fps} | Ping: {pingMs}ms | PredErr: {lastPredError.toFixed(3)}m | Entities: {overlay.entityCount}
        </div>
      )}
    </div>
  );
};
