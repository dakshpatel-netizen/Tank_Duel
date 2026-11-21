import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Play, Settings, Shield, Sparkles, Trophy, Users, Volume2, VolumeX } from 'lucide-react';
import { NETWORK_CONFIG, TANK_CLASSES } from '../../shared/config';
import { sanitizeNickname } from '../../shared/protocol';
import type { TankCustomization } from '../../shared/types';
import type { GameSettings } from '../types/settings';
import { ClassIcon, TankDuelLogo } from './Icons';
import { TankPreviewCanvas } from './TankPreviewCanvas';
import { ArcadeButton, GlassCard } from './UIPrimitives';

interface TitleScreenProps {
  custom: TankCustomization;
  settings: GameSettings;
  onEnterArena: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ custom, settings, onEnterArena }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onEnterArena();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnterArena]);

  return (
    <div className="arcade-bg relative w-full h-full flex flex-col items-center justify-center px-6 py-8 overflow-hidden">
      {/* Subtle drifting ambient blobs */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#7C5CFF]/20 blur-3xl"
        style={{ animation: 'floatSlow 14s ease-in-out infinite' }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#00B8FF]/20 blur-3xl"
        style={{ animation: 'floatSlow 16s ease-in-out infinite reverse' }}
      />

      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center gap-5 anim-screen-enter">
        <TankDuelLogo className="w-full max-w-[540px] h-auto" />

        <p className="text-lg text-[#AAB3DE] max-w-xl font-semibold">
          Fast 3D multiplayer tank combat across 6 stylized arenas. Pick a class, grab Power Boxes, and rule the battlefield.
        </p>

        <div className="w-full max-w-[440px] h-[250px] sm:h-[280px] rounded-[28px] glass-panel overflow-hidden">
          <TankPreviewCanvas
            custom={custom}
            colorblindTeams={settings.accessibility.colorblindTeams}
            reducedMotion={settings.accessibility.reducedMotion}
            className="w-full h-full"
          />
        </div>

        <div className="flex flex-col items-center gap-2.5 mt-1">
          <ArcadeButton
            variant="primary"
            size="lg"
            data-start="true"
            onClick={onEnterArena}
            className="min-w-[240px] text-xl py-4"
          >
            <Play className="w-6 h-6 fill-current" />
            Enter Arena
          </ArcadeButton>
          <span className="text-xs text-[#AAB3DE] tracking-wider uppercase">
            Press Enter or Space to Launch
          </span>
        </div>
      </div>
    </div>
  );
};

interface MainMenuProps {
  nickname: string;
  onNicknameChange: (name: string) => void;
  custom: TankCustomization;
  settings: GameSettings;
  netStatus: 'connecting' | 'online' | 'reconnecting' | 'offline';
  onCreateRoom: () => void;
  onOpenJoin: () => void;
  onStartPractice: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
  onToggleMute: () => void;
}

export const MainMenuScreen: React.FC<MainMenuProps> = ({
  nickname,
  onNicknameChange,
  custom,
  settings,
  netStatus,
  onCreateRoom,
  onOpenJoin,
  onStartPractice,
  onOpenHowToPlay,
  onOpenSettings,
  onOpenCredits,
  onToggleMute,
}) => {
  const cls = TANK_CLASSES[custom.classId];

  const statusLabel =
    netStatus === 'online'
      ? 'Server Online'
      : netStatus === 'connecting' || netStatus === 'reconnecting'
      ? 'Connecting...'
      : 'Server Offline';
  const statusColor =
    netStatus === 'online'
      ? 'bg-[#3DDC84]'
      : netStatus === 'offline'
      ? 'bg-[#FF4D6D]'
      : 'bg-[#FFC83D]';

  return (
    <div className="arcade-bg w-full h-full flex flex-col px-6 py-5 overflow-y-auto">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <TankDuelLogo className="h-11 w-auto" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/30 border border-white/12 text-xs font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
            <span className="text-[#F5F7FF]">{statusLabel}</span>
          </div>

          <label className="flex items-center gap-2 bg-black/30 border border-white/15 rounded-[16px] px-3 py-1.5">
            <span className="text-xs text-[#AAB3DE] font-semibold">Callsign</span>
            <input
              type="text"
              maxLength={14}
              value={nickname}
              aria-label="Player Callsign"
              onChange={(e) => onNicknameChange(e.target.value)}
              onBlur={() => onNicknameChange(sanitizeNickname(nickname))}
              className="w-32 bg-transparent text-sm font-display font-bold text-[#F5F7FF] focus:outline-none"
              placeholder="AceTanker"
            />
          </label>

          <ArcadeButton
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            aria-label={settings.audio.muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {settings.audio.muted ? <VolumeX className="w-4 h-4 text-[#FF4D6D]" /> : <Volume2 className="w-4 h-4 text-[#00E5C3]" />}
          </ArcadeButton>

          <ArcadeButton variant="secondary" size="sm" onClick={onOpenSettings}>
            <Settings className="w-4 h-4" />
            Settings
          </ArcadeButton>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-6 anim-screen-enter">
        {/* Menu Action Cards */}
        <div className="lg:col-span-6 flex flex-col gap-3.5">
          <button
            type="button"
            onClick={onCreateRoom}
            className="card-lift text-left p-5 rounded-[24px] bg-gradient-to-br from-[#7C5CFF] to-[#00B8FF] text-white shadow-[0_12px_32px_rgba(124,92,255,0.4)] cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="font-display text-2xl font-bold">Create Room</div>
              <div className="text-sm text-white/85">Host a multiplayer arena, invite friends, or battle with bots</div>
            </div>
            <Users className="w-9 h-9 shrink-0 opacity-90" />
          </button>

          <button
            type="button"
            onClick={onOpenJoin}
            className="card-lift text-left p-5 rounded-[24px] glass-panel hover:border-[#00E5C3]/60 cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="font-display text-xl font-bold text-[#F5F7FF]">Join Room</div>
              <div className="text-sm text-[#AAB3DE]">Enter a 4-letter room code or join as spectator</div>
            </div>
            <Shield className="w-8 h-8 text-[#00E5C3] shrink-0" />
          </button>

          <button
            type="button"
            onClick={onStartPractice}
            className="card-lift text-left p-5 rounded-[24px] glass-panel hover:border-[#FFC83D]/60 cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="font-display text-xl font-bold text-[#F5F7FF]">Practice vs Bots</div>
              <div className="text-sm text-[#AAB3DE]">Instant offline skirmish — test classes, drifts, and Power Boxes</div>
            </div>
            <Sparkles className="w-8 h-8 text-[#FFC83D] shrink-0" />
          </button>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <ArcadeButton variant="secondary" onClick={onOpenHowToPlay} className="py-3">
              <HelpCircle className="w-4 h-4" />
              How to Play
            </ArcadeButton>
            <ArcadeButton variant="secondary" onClick={onOpenSettings} className="py-3">
              <Settings className="w-4 h-4" />
              Settings
            </ArcadeButton>
            <ArcadeButton variant="secondary" onClick={onOpenCredits} className="py-3">
              <Trophy className="w-4 h-4" />
              Credits
            </ArcadeButton>
          </div>
        </div>

        {/* Live 3D Showcase */}
        <GlassCard className="lg:col-span-6 flex flex-col gap-4 h-full min-h-[380px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#00E5C3]/15 text-[#00E5C3]">
                <ClassIcon classId={custom.classId} className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-[#F5F7FF]">{cls.name} Class</div>
                <div className="text-xs text-[#AAB3DE]">{cls.tagline} — {cls.health} HP</div>
              </div>
            </div>
            <span className="text-xs text-[#AAB3DE]">Drag to inspect tank</span>
          </div>

          <div className="flex-1 min-h-[260px] rounded-[20px] bg-black/25 border border-white/10 overflow-hidden">
            <TankPreviewCanvas
              custom={custom}
              colorblindTeams={settings.accessibility.colorblindTeams}
              reducedMotion={settings.accessibility.reducedMotion}
              className="w-full h-full"
            />
          </div>

          <div className="text-xs text-[#AAB3DE] flex items-center justify-between px-1">
            <span>{cls.specialText}</span>
            <span className="font-mono-num text-[#00E5C3]">DMG {cls.cannonDamage} / {cls.cannonReload}s</span>
          </div>
        </GlassCard>
      </main>
    </div>
  );
};

interface JoinRoomProps {
  initialCode?: string;
  errorMsg: string | null;
  canSpectate: boolean;
  onJoin: (code: string, password: string, asSpectator: boolean) => void;
  onBack: () => void;
}

export const JoinRoomScreen: React.FC<JoinRoomProps> = ({
  initialCode = '',
  errorMsg,
  canSpectate,
  onJoin,
  onBack,
}) => {
  const cleanInit = initialCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const [chars, setChars] = useState<string[]>([
    cleanInit[0] || '',
    cleanInit[1] || '',
    cleanInit[2] || '',
    cleanInit[3] || '',
  ]);
  const [password, setPassword] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const allowed = NETWORK_CONFIG.roomCodeAlphabet;

  const code = chars.join('');
  const isComplete = code.length === 4;

  const updateChar = (idx: number, raw: string) => {
    const ch = raw.toUpperCase().slice(-1);
    if (ch && !allowed.includes(ch)) return;
    const next = [...chars];
    next[idx] = ch;
    setChars(next);
    if (ch && idx < 3) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const txt = e.clipboardData
      .getData('text')
      .toUpperCase()
      .split('')
      .filter((c) => allowed.includes(c))
      .slice(0, 4);
    if (txt.length > 0) {
      e.preventDefault();
      setChars([txt[0] || '', txt[1] || '', txt[2] || '', txt[3] || '']);
      inputRefs.current[Math.min(3, txt.length)]?.focus();
    }
  };

  return (
    <div className="arcade-bg w-full h-full flex items-center justify-center p-6">
      <GlassCard className="max-w-md w-full flex flex-col gap-5 anim-screen-enter">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-[#F5F7FF]">Join Room</h1>
          <ArcadeButton variant="ghost" size="sm" onClick={onBack}>
            Back
          </ArcadeButton>
        </div>

        <div>
          <div className="text-sm text-[#AAB3DE] mb-2">Enter 4-character Room Code</div>
          <div className="grid grid-cols-4 gap-3" onPaste={handlePaste}>
            {chars.map((c, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                maxLength={1}
                value={c}
                aria-label={`Room code character ${idx + 1}`}
                onChange={(e) => updateChar(idx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !chars[idx] && idx > 0) {
                    inputRefs.current[idx - 1]?.focus();
                  } else if (e.key === 'Enter' && isComplete) {
                    onJoin(code, password, false);
                  }
                }}
                className="h-16 text-center font-mono-num text-3xl font-bold rounded-[18px] bg-black/35 border-2 border-white/15 focus:border-[#00E5C3] text-[#F5F7FF] uppercase"
              />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#AAB3DE]">Room Password (if required)</span>
          <input
            type="password"
            value={password}
            maxLength={24}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank if public"
            className="px-4 py-2.5 rounded-[14px] bg-black/35 border border-white/15 text-[#F5F7FF]"
          />
        </label>

        {errorMsg && (
          <div className="p-3 rounded-[14px] bg-[#FF4D6D]/15 border border-[#FF4D6D]/45 text-sm text-[#FF4D6D] font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <ArcadeButton
            variant="primary"
            size="lg"
            disabled={!isComplete}
            onClick={() => onJoin(code, password, false)}
          >
            Join Battle
          </ArcadeButton>
          {canSpectate && (
            <ArcadeButton
              variant="secondary"
              disabled={!isComplete}
              onClick={() => onJoin(code, password, true)}
            >
              Join as Spectator
            </ArcadeButton>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
