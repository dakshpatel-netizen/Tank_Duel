import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, HelpCircle, LogOut, Play, RotateCcw, Settings, Trophy } from 'lucide-react';
import {
  GAME_MODES,
  LOADING_TIPS,
  POWER_BOX_ITEMS,
  TANK_CLASSES,
} from '../../shared/config';
import { MAPS } from '../../shared/maps/index';
import type {
  MatchResultSummary,
  MatchSettings,
  RoomStateInfo,
  TankState,
} from '../../shared/types';
import { renderMapThumbnailDataUrl } from '../game/mapThumbnail';
import {
  DEFAULT_SETTINGS,
  formatKeyCode,
  type AimPinStyle,
  type GameSettings,
  type KeyBindings,
  type QualityPreset,
} from '../types/settings';
import { PowerItemIcon } from './Icons';
import { TankPreviewCanvas } from './TankPreviewCanvas';
import {
  ArcadeButton,
  ArcadeSlider,
  ArcadeToggle,
  GlassCard,
  Modal,
  SegmentedControl,
} from './UIPrimitives';

// 1. Loading Screen Overlay
export const LoadingOverlay: React.FC<{ progress: number }> = ({ progress }) => {
  const tip = useMemo(
    () => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)],
    []
  );
  return (
    <div className="arcade-bg fixed inset-0 z-40 flex flex-col items-center justify-center p-6">
      <GlassCard className="max-w-lg w-full flex flex-col items-center text-center gap-5 anim-screen-enter">
        <div className="font-display text-3xl font-bold text-[#F5F7FF]">
          Deploying Arena...
        </div>
        <div className="w-full h-4 rounded-full bg-black/40 border border-white/15 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7C5CFF] via-[#00B8FF] to-[#00E5C3] transition-[width] duration-150"
            style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
          />
        </div>
        <div className="font-mono-num text-sm font-bold text-[#00E5C3]">
          {Math.round(progress)}%
        </div>
        <p className="text-sm text-[#AAB3DE]">
          <strong className="text-[#FFC83D]">Tip:</strong> {tip}
        </p>
      </GlassCard>
    </div>
  );
};

// 2. Plan Screen Overlay (pre-battle tactical briefing)
export const PlanScreenOverlay: React.FC<{
  settings: MatchSettings;
  secondsLeft: number;
  onDeployNow?: () => void;
}> = ({ settings, secondsLeft, onDeployNow }) => {
  const mode = GAME_MODES[settings.mode];
  const map = MAPS[settings.mapId];
  const thumb = useMemo(
    () => renderMapThumbnailDataUrl(settings.mapId, settings.mapSize),
    [settings.mapId, settings.mapSize]
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/75">
      <GlassCard className="max-w-2xl w-full flex flex-col gap-5 anim-screen-enter">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#00E5C3] font-bold">
              Battle Briefing &amp; Game Plan
            </div>
            <h2 className="font-display text-3xl font-bold text-[#F5F7FF]">{mode.name}</h2>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-[#7C5CFF]/25 border border-[#7C5CFF]/50 font-mono-num text-2xl font-extrabold text-white">
            {secondsLeft}s
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <img
            src={thumb}
            alt={map.name}
            className="w-full aspect-video rounded-[16px] object-cover border border-white/15"
          />
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="font-display text-lg font-bold text-[#FFC83D]">{map.name}</div>
            <p className="text-[#F5F7FF]">{mode.planLine1}</p>
            <p className="text-[#AAB3DE]">{mode.planLine2}</p>
            <div className="p-2.5 rounded-[12px] bg-[#00E5C3]/12 border border-[#00E5C3]/35 text-xs text-[#00E5C3] font-semibold">
              Pro Tip: {mode.tip}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-[12px] bg-white/5 border border-white/10">
            <div className="font-display font-bold text-[#00E5C3]">1. Drive &amp; Angle</div>
            <div className="text-[#AAB3DE]">WASD / Arrows + Shift Turbo</div>
          </div>
          <div className="p-2.5 rounded-[12px] bg-white/5 border border-white/10">
            <div className="font-display font-bold text-[#FFC83D]">2. Aim &amp; Shoot</div>
            <div className="text-[#AAB3DE]">Space or Left-Click fires</div>
          </div>
          <div className="p-2.5 rounded-[12px] bg-white/5 border border-white/10">
            <div className="font-display font-bold text-[#C084FC]">3. Grab ? Boxes</div>
            <div className="text-[#AAB3DE]">Homing, Cluster &amp; Shields</div>
          </div>
        </div>

        {onDeployNow && (
          <div className="flex justify-end">
            <ArcadeButton variant="primary" size="md" onClick={onDeployNow}>
              <Play className="w-4 h-4 fill-current" />
              Deploy Now
            </ArcadeButton>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

// 3. Countdown Overlay (3-2-1-FIGHT!)
export const CountdownOverlay: React.FC<{ label: string }> = ({ label }) => (
  <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
    <div
      key={label}
      className="anim-countdown-pop font-display text-8xl font-extrabold text-[#FFC83D] drop-shadow-[0_10px_30px_rgba(0,0,0,0.85)]"
    >
      {label}
    </div>
  </div>
);

// 4. Pause / Esc Menu
export const PauseMenuModal: React.FC<{
  open: boolean;
  isPractice: boolean;
  onResume: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
  onLeave: () => void;
}> = ({ open, isPractice, onResume, onOpenSettings, onOpenHowToPlay, onLeave }) => (
  <Modal open={open} title={isPractice ? 'Game Paused' : 'Match Menu'} onClose={onResume} maxWidth="max-w-sm">
    <div className="flex flex-col gap-3">
      {!isPractice && (
        <div className="text-xs text-[#FFC83D] bg-[#FFC83D]/12 border border-[#FFC83D]/35 rounded-xl p-2.5">
          Online match remains live in the background.
        </div>
      )}
      <ArcadeButton variant="primary" size="lg" onClick={onResume}>
        <Play className="w-5 h-5 fill-current" />
        Resume Battle
      </ArcadeButton>
      <ArcadeButton variant="secondary" onClick={onOpenSettings}>
        <Settings className="w-4 h-4" />
        Settings
      </ArcadeButton>
      <ArcadeButton variant="secondary" onClick={onOpenHowToPlay}>
        <HelpCircle className="w-4 h-4" />
        How to Play
      </ArcadeButton>
      <ArcadeButton variant="danger" onClick={onLeave}>
        <LogOut className="w-4 h-4" />
        Leave Match
      </ArcadeButton>
    </div>
  </Modal>
);

// 5. Death / Respawn Overlay
export const DeathOverlay: React.FC<{
  localTank: TankState;
  killerText: string;
  isLts: boolean;
}> = ({ localTank, killerText, isLts }) => (
  <div className="pointer-events-none fixed inset-x-0 top-1/4 z-30 flex justify-center px-4">
    <div className="hud-panel anim-screen-enter px-7 py-5 rounded-[24px] border-[#FF4D6D]/50 text-center flex flex-col items-center gap-2.5">
      <div className="font-display text-2xl font-extrabold text-[#FF4D6D]">TANK DESTROYED</div>
      <div className="text-sm text-[#F5F7FF] font-semibold">{killerText}</div>
      {isLts ? (
        <div className="text-xs text-[#FFC83D] font-semibold">
          Last Tank Standing — Click canvas to cycle spectator camera
        </div>
      ) : (
        <div className="w-56 flex flex-col gap-1">
          <div className="text-xs text-[#AAB3DE]">
            Respawning in <span className="font-mono-num font-bold text-[#00E5C3]">{localTank.respawnTimer.toFixed(1)}s</span>
          </div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-[#00E5C3]"
              style={{ width: `${Math.max(0, Math.min(100, (1 - localTank.respawnTimer / 3) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  </div>
);

// 6. Results & 3D Podium Screen
export const ResultsScreen: React.FC<{
  summary: MatchResultSummary;
  yourId: string;
  room: RoomStateInfo | null;
  isPractice: boolean;
  settings: GameSettings;
  onRematchVote: () => void;
  onBackToLobby: () => void;
  onLeave: () => void;
}> = ({
  summary,
  yourId,
  room,
  isPractice,
  settings,
  onRematchVote,
  onBackToLobby,
  onLeave,
}) => {
  const confettiRef = useRef<HTMLCanvasElement | null>(null);
  const top3 = summary.players.slice(0, 3);
  const myRank = summary.players.findIndex((p) => p.id === yourId) + 1;
  const didWin =
    summary.winnerId === yourId ||
    (summary.winnerTeam && summary.players.find((p) => p.id === yourId)?.team === summary.winnerTeam);

  useEffect(() => {
    if (settings.accessibility.reducedMotion) return;
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#00E5C3', '#FFC83D', '#7C5CFF', '#FF4D6D', '#3B82F6'];
    const parts = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 3,
      vy: 2.2 + Math.random() * 3.5,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      col: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += 0.08;
        if (p.y < canvas.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [settings.accessibility.reducedMotion]);

  const myVoted = Boolean(room?.rematchVotes.includes(yourId));
  const humanCount = room ? room.players.filter((p) => !p.isBot).length : 1;

  return (
    <div className="arcade-bg relative w-full h-full overflow-y-auto px-6 py-6">
      <canvas ref={confettiRef} className="pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 max-w-6xl mx-auto flex flex-col gap-5 anim-screen-enter">
        {/* Winner Banner */}
        <GlassCard className="flex flex-wrap items-center justify-between gap-4 border-[#FFC83D]/45">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[#FFC83D]/20 text-[#FFC83D]">
              <Trophy className="w-9 h-9" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#00E5C3] font-bold">
                {didWin ? 'Victory!' : `Match Complete • #${myRank || '-'}`}
              </div>
              <h1 className="font-display text-3xl font-extrabold text-[#F5F7FF]">
                {summary.winnerName} Wins!
              </h1>
              <div className="text-sm text-[#AAB3DE]">
                {summary.reason} • {GAME_MODES[summary.mode].name} on {MAPS[summary.mapId].name}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isPractice ? (
              <ArcadeButton variant="primary" size="lg" onClick={onRematchVote}>
                <RotateCcw className="w-5 h-5" />
                Play Again
              </ArcadeButton>
            ) : (
              <>
                <ArcadeButton
                  variant={myVoted ? 'accent' : 'primary'}
                  size="lg"
                  onClick={onRematchVote}
                >
                  <RotateCcw className="w-5 h-5" />
                  Rematch ({room?.rematchVotes.length ?? 0}/{humanCount})
                </ArcadeButton>
                {room?.players.find((p) => p.id === yourId)?.isHost && (
                  <ArcadeButton variant="secondary" size="lg" onClick={onBackToLobby}>
                    Back to Lobby
                  </ArcadeButton>
                )}
              </>
            )}
            <ArcadeButton variant="ghost" size="lg" onClick={onLeave}>
              <LogOut className="w-5 h-5" />
              Main Menu
            </ArcadeButton>
          </div>
        </GlassCard>

        {/* Top 3 3D Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((p, idx) => (
            <GlassCard
              key={p.id}
              className={`flex flex-col gap-2 ${
                idx === 0 ? 'border-[#FFC83D]/60 md:-translate-y-2' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold text-[#FFC83D]">
                  #{idx + 1} {p.name}
                </span>
                <span className="font-mono-num text-sm text-[#00E5C3]">
                  {p.kills}K / {p.deaths}D
                </span>
              </div>
              <div className="h-44 rounded-[18px] bg-black/30 overflow-hidden">
                <TankPreviewCanvas
                  custom={p.custom}
                  team={p.team}
                  interactive={false}
                  winPose={idx === 0}
                  colorblindTeams={settings.accessibility.colorblindTeams}
                  reducedMotion={settings.accessibility.reducedMotion}
                  className="w-full h-full"
                />
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Awards Row */}
        {summary.awards.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summary.awards.map((a) => (
              <div
                key={a.id}
                className="glass-panel p-3 rounded-[18px] flex flex-col gap-1 border-[#7C5CFF]/35"
              >
                <div className="flex items-center gap-1.5 text-xs font-display font-bold text-[#FFC83D]">
                  <Award className="w-4 h-4 shrink-0" />
                  {a.title}
                </div>
                <div className="text-sm font-bold text-[#F5F7FF] truncate">{a.playerName}</div>
                <div className="text-xs font-mono-num text-[#00E5C3]">{a.valueText}</div>
              </div>
            ))}
          </div>
        )}

        {/* Full Stats Table */}
        <GlassCard className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-[#AAB3DE] border-b border-white/12">
                <th className="py-2">#</th>
                <th>Player</th>
                <th>Class</th>
                <th className="text-right">Kills</th>
                <th className="text-right">Deaths</th>
                <th className="text-right">Assists</th>
                <th className="text-right">Damage</th>
                <th className="text-right">Acc%</th>
                <th className="text-right">Best Streak</th>
              </tr>
            </thead>
            <tbody>
              {summary.players.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`border-b border-white/6 ${
                    p.id === yourId ? 'bg-[#00E5C3]/12 font-bold text-white' : 'text-[#F5F7FF]'
                  }`}
                >
                  <td className="py-2.5 font-mono-num">{idx + 1}</td>
                  <td>
                    {p.name} {p.leftEarly && <span className="text-xs text-[#AAB3DE]">(Left)</span>}
                  </td>
                  <td className="capitalize text-[#AAB3DE]">{p.custom.classId}</td>
                  <td className="text-right font-mono-num">{p.kills}</td>
                  <td className="text-right font-mono-num">{p.deaths}</td>
                  <td className="text-right font-mono-num">{p.assists}</td>
                  <td className="text-right font-mono-num">{p.damageDealt}</td>
                  <td className="text-right font-mono-num">{p.accuracy}%</td>
                  <td className="text-right font-mono-num">{p.bestStreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
};

// 7. Settings Modal (6 tabs + Key Remapper)
export const SettingsModal: React.FC<{
  open: boolean;
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}> = ({ open, settings, onChange, onClose }) => {
  const [tab, setTab] = useState<'graphics' | 'audio' | 'controls' | 'aiming' | 'gameplay' | 'access'>('graphics');
  const [listeningKey, setListeningKey] = useState<keyof KeyBindings | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    if (!listeningKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (['Escape', 'Tab', 'F11', 'Enter'].includes(e.code)) {
        setKeyError(`${e.code} is reserved by the browser/game.`);
        setListeningKey(null);
        return;
      }
      const existing = (Object.entries(settings.controls.bindings) as [keyof KeyBindings, string][]).find(
        ([k, v]) => k !== listeningKey && v === e.code
      );
      if (existing) {
        setKeyError(`${formatKeyCode(e.code)} is already bound to ${existing[0]}.`);
        setListeningKey(null);
        return;
      }
      setKeyError(null);
      onChange({
        ...settings,
        controls: {
          ...settings.controls,
          bindings: { ...settings.controls.bindings, [listeningKey]: e.code },
        },
      });
      setListeningKey(null);
    };
    window.addEventListener('keydown', onKey, { once: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [listeningKey, settings, onChange]);

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          {([
            ['graphics', 'Graphics'],
            ['audio', 'Audio'],
            ['controls', 'Controls'],
            ['aiming', 'Aiming'],
            ['gameplay', 'Gameplay'],
            ['access', 'Accessibility'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 rounded-[12px] font-display text-sm font-semibold cursor-pointer ${
                tab === id ? 'bg-[#7C5CFF] text-white' : 'bg-white/6 text-[#AAB3DE] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'graphics' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Quality Preset</span>
              <SegmentedControl<QualityPreset>
                value={settings.graphics.quality}
                onChange={(quality) =>
                  onChange({ ...settings, graphics: { ...settings.graphics, quality } })
                }
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
            <ArcadeSlider
              label="Resolution Scale"
              value={settings.graphics.resolutionScale}
              min={0.75}
              max={1.25}
              step={0.05}
              suffix="x"
              onChange={(resolutionScale) =>
                onChange({ ...settings, graphics: { ...settings.graphics, resolutionScale } })
              }
            />
            <ArcadeSlider
              label="Camera FOV"
              value={settings.graphics.fov}
              min={50}
              max={75}
              step={1}
              suffix="°"
              onChange={(fov) => onChange({ ...settings, graphics: { ...settings.graphics, fov } })}
            />
            <ArcadeToggle
              label="Dynamic Shadows"
              checked={settings.graphics.shadows}
              onChange={(shadows) =>
                onChange({ ...settings, graphics: { ...settings.graphics, shadows } })
              }
            />
            <ArcadeToggle
              label="Show FPS & Ping"
              checked={settings.graphics.showFpsPing}
              onChange={(showFpsPing) =>
                onChange({ ...settings, graphics: { ...settings.graphics, showFpsPing } })
              }
            />
          </div>
        )}

        {tab === 'audio' && (
          <div className="flex flex-col gap-4">
            <ArcadeToggle
              label="Mute All Audio (M)"
              checked={settings.audio.muted}
              onChange={(muted) => onChange({ ...settings, audio: { ...settings.audio, muted } })}
            />
            <ArcadeSlider
              label="Master Volume"
              value={Math.round(settings.audio.master * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                onChange({ ...settings, audio: { ...settings.audio, master: v / 100 } })
              }
            />
            <ArcadeSlider
              label="Music Volume"
              value={Math.round(settings.audio.music * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                onChange({ ...settings, audio: { ...settings.audio, music: v / 100 } })
              }
            />
            <ArcadeSlider
              label="Effects Volume"
              value={Math.round(settings.audio.effects * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                onChange({ ...settings, audio: { ...settings.audio, effects: v / 100 } })
              }
            />
          </div>
        )}

        {tab === 'controls' && (
          <div className="flex flex-col gap-3">
            {keyError && (
              <div className="p-2.5 rounded-xl bg-[#FF4D6D]/15 border border-[#FF4D6D]/45 text-xs text-[#FF4D6D]">
                {keyError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(settings.controls.bindings) as [keyof KeyBindings, string][]).map(
                ([action, code]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setListeningKey(action)}
                    className="flex items-center justify-between px-3 py-2 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/12 text-xs cursor-pointer"
                  >
                    <span className="capitalize text-[#AAB3DE]">{action}</span>
                    <span className="font-mono-num font-bold text-[#00E5C3]">
                      {listeningKey === action ? 'Press Key...' : formatKeyCode(code)}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {tab === 'aiming' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Aiming Mode</div>
                <div className="text-xs text-[#AAB3DE]">
                  Mouse Turret aims toward cursor; Tank Forward auto-locks ahead for keyboard play.
                </div>
              </div>
              <SegmentedControl<'mouse' | 'barrel'>
                value={settings.aiming.aimMode}
                onChange={(aimMode) =>
                  onChange({ ...settings, aiming: { ...settings.aiming, aimMode } })
                }
                options={[
                  { value: 'mouse', label: 'Mouse Turret' },
                  { value: 'barrel', label: 'Tank Forward' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Aim Reticle Style</span>
              <SegmentedControl<AimPinStyle>
                value={settings.aiming.pinStyle}
                onChange={(pinStyle) =>
                  onChange({ ...settings, aiming: { ...settings.aiming, pinStyle } })
                }
                options={[
                  { value: 'classic', label: 'Classic' },
                  { value: 'cross', label: 'Cross' },
                  { value: 'chevron', label: 'Chevron' },
                ]}
              />
            </div>
            <ArcadeSlider
              label="Reticle Size"
              value={settings.aiming.pinSize}
              min={0.7}
              max={1.6}
              step={0.1}
              suffix="x"
              onChange={(pinSize) =>
                onChange({ ...settings, aiming: { ...settings.aiming, pinSize } })
              }
            />
            <ArcadeToggle
              label="Lead Prediction Dots"
              description="Shows yellow target lead dots for moving enemies"
              checked={settings.aiming.leadIndicator}
              onChange={(leadIndicator) =>
                onChange({ ...settings, aiming: { ...settings.aiming, leadIndicator } })
              }
            />
            <ArcadeToggle
              label="Smart Aim Assist"
              checked={settings.aiming.aimAssist === 'light'}
              onChange={(v) =>
                onChange({ ...settings, aiming: { ...settings.aiming, aimAssist: v ? 'light' : 'off' } })
              }
            />
          </div>
        )}

        {tab === 'gameplay' && (
          <div className="flex flex-col gap-3">
            <ArcadeToggle
              label="Camera Screen Shake"
              checked={settings.gameplay.cameraShake}
              onChange={(cameraShake) =>
                onChange({ ...settings, gameplay: { ...settings.gameplay, cameraShake } })
              }
            />
            <ArcadeToggle
              label="Kill-Cam Focus"
              checked={settings.gameplay.showKillCam}
              onChange={(showKillCam) =>
                onChange({ ...settings, gameplay: { ...settings.gameplay, showKillCam } })
              }
            />
          </div>
        )}

        {tab === 'access' && (
          <div className="flex flex-col gap-3">
            <ArcadeToggle
              label="Large UI Scale"
              checked={settings.accessibility.largeUi}
              onChange={(largeUi) =>
                onChange({ ...settings, accessibility: { ...settings.accessibility, largeUi } })
              }
            />
            <ArcadeToggle
              label="Colorblind High-Contrast Teams"
              description="Orange vs Cyan instead of Red vs Blue"
              checked={settings.accessibility.colorblindTeams}
              onChange={(colorblindTeams) =>
                onChange({ ...settings, accessibility: { ...settings.accessibility, colorblindTeams } })
              }
            />
            <ArcadeToggle
              label="Reduced Motion"
              description="Disables camera shake, slow-motion, and confetti"
              checked={settings.accessibility.reducedMotion}
              onChange={(reducedMotion) =>
                onChange({ ...settings, accessibility: { ...settings.accessibility, reducedMotion } })
              }
            />
          </div>
        )}

        <div className="pt-3 border-t border-white/12 flex justify-between">
          <ArcadeButton
            variant="ghost"
            size="sm"
            onClick={() => onChange(structuredClone(DEFAULT_SETTINGS))}
          >
            Reset Defaults
          </ArcadeButton>
          <ArcadeButton variant="primary" onClick={onClose}>
            Done
          </ArcadeButton>
        </div>
      </div>
    </Modal>
  );
};

// 8. How to Play Modal
export const HowToPlayModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal open={open} title="How to Play & Winning Game Plan" onClose={onClose} maxWidth="max-w-4xl">
    <div className="flex flex-col gap-5 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-[16px] bg-[#00E5C3]/10 border border-[#00E5C3]/35">
          <div className="font-display font-bold text-[#00E5C3] mb-1">1. Win Angles &amp; Cover</div>
          <p className="text-xs text-[#AAB3DE]">
            Peek around hazard barriers, bounce cannon shells 1x off walls, and never sit still when locked on.
          </p>
        </div>
        <div className="p-3.5 rounded-[16px] bg-[#FFC83D]/10 border border-[#FFC83D]/35">
          <div className="font-display font-bold text-[#FFC83D] mb-1">2. Control ? Power Boxes</div>
          <p className="text-xs text-[#AAB3DE]">
            Grab Homing, Cluster, Bouncing x3, or Shields to flip tough duels—your 5-slot rack tracks charges live.
          </p>
        </div>
        <div className="p-3.5 rounded-[16px] bg-[#FF4D6D]/10 border border-[#FF4D6D]/35">
          <div className="font-display font-bold text-[#FF4D6D] mb-1">3. Bait Explosive Barrels</div>
          <p className="text-xs text-[#AAB3DE]">
            Shoot red hazard barrels when enemies pass close for a massive 40-damage blast radius!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-[18px] bg-white/5 border border-white/10">
          <h3 className="font-display text-lg font-bold text-[#00E5C3] mb-2">Controls</h3>
          <ul className="flex flex-col gap-1 text-[#AAB3DE]">
            <li><strong className="text-white">W / S or Up / Down:</strong> Drive Forward / Reverse</li>
            <li><strong className="text-white">A / D or Left / Right:</strong> Turn Tank Hull</li>
            <li><strong className="text-white">Aim Toggle (HUD / Settings):</strong> Mouse Turret or Tank-Forward</li>
            <li><strong className="text-white">Left Click / Space:</strong> Fire Cannon (1x ricochet)</li>
            <li><strong className="text-white">Space / Right Click:</strong> Launch Held Missile / Weapon</li>
            <li><strong className="text-white">Shift / Ctrl:</strong> Turbo Boost / Handbrake</li>
            <li><strong className="text-white">Q / E:</strong> Scout Sideways Dash</li>
            <li><strong className="text-white">Tab / T:</strong> Minimap &amp; Scoreboard / Quick Chat</li>
          </ul>
        </div>
        <div className="p-4 rounded-[18px] bg-white/5 border border-white/10">
          <h3 className="font-display text-lg font-bold text-[#FFC83D] mb-2">Tank Classes</h3>
          <ul className="flex flex-col gap-2 text-[#AAB3DE]">
            {(['scout', 'standard', 'heavy'] as const).map((id) => (
              <li key={id}>
                <strong className="text-white">{TANK_CLASSES[id].name} ({TANK_CLASSES[id].health} HP):</strong>{' '}
                {TANK_CLASSES[id].specialText}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-[#F5F7FF] mb-2">Power Box Arsenal (13 Items)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {POWER_BOX_ITEMS.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-[14px] bg-black/30 border border-white/10 flex items-center gap-2.5"
            >
              <PowerItemIcon itemId={item.id} className="w-6 h-6 shrink-0" />
              <div className="min-w-0">
                <div className="font-display text-xs font-bold text-white truncate">{item.name}</div>
                <div className="text-[11px] text-[#AAB3DE] truncate">{item.summary}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Modal>
);

// 9. Credits Modal
export const CreditsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal open={open} title="Credits" onClose={onClose} maxWidth="max-w-lg">
    <div className="flex flex-col gap-4 text-sm text-[#AAB3DE]">
      <div>
        <div className="font-display text-xl font-bold text-[#00E5C3]">Tank Duel Online</div>
        <p>Authoritative 3D Multiplayer Tank Arena built with TypeScript, Three.js, React, and WebSockets.</p>
      </div>
      <div className="p-3.5 rounded-[16px] bg-white/5 border border-white/10">
        <div className="font-display font-bold text-white mb-1">Open Source Technology</div>
        <ul className="flex flex-col gap-1 text-xs">
          <li>• Three.js — MIT License</li>
          <li>• React & ReactDOM — MIT License</li>
          <li>• Lucide Icons — ISC License</li>
          <li>• ws (Node WebSocket) — MIT License</li>
          <li>• Procedural Web Audio SFX & Music — Synthesized in-browser</li>
        </ul>
      </div>
    </div>
  </Modal>
);

// 10. Reconnecting Modal
export const ReconnectingModal: React.FC<{ open: boolean; onCancel: () => void }> = ({
  open,
  onCancel,
}) => (
  <Modal open={open} title="Connection Lost" maxWidth="max-w-sm">
    <div className="flex flex-col gap-4 text-center">
      <p className="text-sm text-[#AAB3DE]">
        Reconnecting to the game server... Your tank slot is held for 60 seconds.
      </p>
      <ArcadeButton variant="danger" onClick={onCancel}>
        Return to Main Menu
      </ArcadeButton>
    </div>
  </Modal>
);
