import React, { useMemo, useState } from 'react';
import { Check, Copy, Crown, Lock, LogOut, Play, Send, Shield, UserX } from 'lucide-react';
import {
  BOT_CONFIG,
  DECAL_STYLES,
  GAME_MODES,
  MAP_SIZE_SCALES,
  QUICK_CHAT_OPTIONS,
  TANK_CLASSES,
  TANK_COLORS,
  TURRET_STYLES,
  type BotDifficulty,
  type GameModeId,
  type MapId,
  type MapSizeId,
  type TankClassId,
} from '../../shared/config';
import { MAPS } from '../../shared/maps/index';
import type { ChatMessage } from '../../shared/protocol';
import type { DecalId, MatchSettings, RoomStateInfo, TankCustomization, TurretStyleId } from '../../shared/types';
import { renderMapThumbnailDataUrl } from '../game/mapThumbnail';
import type { GameSettings } from '../types/settings';
import { ClassIcon, DecalIcon, TurretStyleIcon } from './Icons';
import { TankPreviewCanvas } from './TankPreviewCanvas';
import { ArcadeButton, ArcadeToggle, GlassCard, SegmentedControl, StatBar } from './UIPrimitives';

interface LobbyScreenProps {
  room: RoomStateInfo;
  yourId: string;
  isSpectator: boolean;
  custom: TankCustomization;
  settings: GameSettings;
  chatMessages: ChatMessage[];
  onChangeCustom: (c: TankCustomization) => void;
  onToggleReady: (ready: boolean) => void;
  onChangeSettings: (patch: Partial<MatchSettings>) => void;
  onSetTeam: (targetPlayerId: string, team: 'red' | 'blue') => void;
  onKickPlayer: (targetPlayerId: string) => void;
  onSendChat: (text: string, isQuick?: boolean) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onCopyInvite: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  yourId,
  isSpectator,
  custom,
  settings,
  chatMessages,
  onChangeCustom,
  onToggleReady,
  onChangeSettings,
  onSetTeam,
  onKickPlayer,
  onSendChat,
  onStartMatch,
  onLeaveRoom,
  onCopyInvite,
}) => {
  const [mobileTab, setMobileTab] = useState<'garage' | 'players' | 'match'>('garage');
  const [chatText, setChatText] = useState('');

  const me = room.players.find((p) => p.id === yourId);
  const isHost = Boolean(me?.isHost);
  const modeMeta = GAME_MODES[room.settings.mode];
  const isTeamMode = modeMeta.isTeam;
  const activeMap = MAPS[room.settings.mapId];
  const isClassic = room.settings.tankRule === 'classic';

  // Recommended maps listed first in dropdown
  const sortedMaps = useMemo(() => {
    const recSet = new Set(modeMeta.recommendedMaps);
    const list = Object.values(MAPS);
    return [
      ...list.filter((m) => recSet.has(m.id)),
      ...list.filter((m) => !recSet.has(m.id)),
    ];
  }, [modeMeta]);

  const mapThumbUrl = useMemo(
    () => renderMapThumbnailDataUrl(room.settings.mapId, room.settings.mapSize),
    [room.settings.mapId, room.settings.mapSize]
  );

  // Ready & Start validation
  const humanPlayers = room.players.filter((p) => !p.isBot);
  const totalTanks = room.players.length + room.settings.botCount;
  const unreadyHumans = humanPlayers.filter((p) => !p.isHost && !p.ready);
  const canStart = totalTanks >= 2 && unreadyHumans.length === 0;
  const startReason =
    totalTanks < 2
      ? 'Need at least 2 tanks (add bots or wait for another player)'
      : unreadyHumans.length > 0
      ? `Waiting for ready: ${unreadyHumans.map((p) => p.name).join(', ')}`
      : '';

  const activeCls = TANK_CLASSES[isClassic ? 'standard' : custom.classId];

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatText.trim();
    if (!clean) return;
    onSendChat(clean, false);
    setChatText('');
  };

  return (
    <div className="arcade-bg w-full h-full flex flex-col px-4 sm:px-6 py-4 overflow-hidden">
      {/* Top Bar */}
      <header className="max-w-[1680px] w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/35 border border-[#00E5C3]/40">
            <span className="text-xs text-[#AAB3DE] uppercase tracking-wider">Room</span>
            <span className="font-mono-num text-xl font-bold text-[#00E5C3] tracking-widest">
              {room.code}
            </span>
          </div>

          <ArcadeButton variant="secondary" size="sm" onClick={onCopyInvite}>
            <Copy className="w-4 h-4" />
            Copy Link
          </ArcadeButton>

          <span className="px-3 py-1 rounded-full bg-white/8 border border-white/12 text-xs font-semibold text-[#F5F7FF]">
            {isSpectator ? 'Spectator' : isHost ? 'Host' : 'Lobby'}
          </span>
        </div>

        {/* Responsive Tab Switcher below 1500px */}
        <div className="flex min-[1500px]:hidden gap-1.5 bg-black/30 p-1 rounded-[16px] border border-white/10">
          {([
            ['garage', 'Garage'],
            ['players', `Players (${room.players.length})`],
            ['match', 'Match Setup'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              className={`px-3.5 py-1.5 rounded-[12px] font-display text-sm font-semibold cursor-pointer ${
                mobileTab === key ? 'bg-[#7C5CFF] text-white' : 'text-[#AAB3DE] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ArcadeButton variant="danger" size="sm" onClick={onLeaveRoom}>
          <LogOut className="w-4 h-4" />
          Leave Room
        </ArcadeButton>
      </header>

      {/* Main 3-Column Grid */}
      <div className="max-w-[1680px] w-full mx-auto flex-1 min-h-0 grid grid-cols-1 min-[1500px]:grid-cols-12 gap-4 py-4">
        {/* LEFT: GARAGE */}
        <GlassCard
          className={`min-[1500px]:col-span-4 flex flex-col gap-3.5 overflow-y-auto ${
            mobileTab === 'garage' ? 'flex' : 'hidden min-[1500px]:flex'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#F5F7FF]">Tank Garage</h2>
            {isClassic && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFC83D]/20 text-[#FFC83D] font-semibold">
                Classic Rule Active
              </span>
            )}
          </div>

          <div className="relative h-44 rounded-[20px] bg-black/30 border border-white/10 overflow-hidden shrink-0">
            <TankPreviewCanvas
              custom={isClassic ? { ...custom, classId: 'standard' } : custom}
              team={isTeamMode ? me?.team ?? 'red' : 'none'}
              colorblindTeams={settings.accessibility.colorblindTeams}
              reducedMotion={settings.accessibility.reducedMotion}
              className="w-full h-full"
            />
            {me && (
              <div className="pointer-events-none absolute top-3 left-3 px-3 py-1 rounded-full bg-black/55 border border-white/15 text-xs font-display font-bold text-white">
                {me.name}
              </div>
            )}
          </div>

          {/* 3 Class Cards */}
          <div className="grid grid-cols-3 gap-2">
            {(['scout', 'standard', 'heavy'] as TankClassId[]).map((cid) => {
              const cls = TANK_CLASSES[cid];
              const selected = !isClassic && custom.classId === cid;
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={isClassic || isSpectator}
                  onClick={() => onChangeCustom({ ...custom, classId: cid })}
                  className={`p-2.5 rounded-[16px] border text-left cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                    selected
                      ? 'bg-[#7C5CFF]/25 border-[#00E5C3] anim-card-selected'
                      : 'bg-white/5 border-white/12 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <ClassIcon classId={cid} className="w-5 h-5 text-[#00E5C3]" />
                    <span className="font-mono-num text-xs text-[#FFC83D]">{cls.health} HP</span>
                  </div>
                  <div className="font-display text-sm font-bold text-[#F5F7FF]">{cls.name}</div>
                  <div className="text-[11px] text-[#AAB3DE] leading-tight">{cls.tagline}</div>
                </button>
              );
            })}
          </div>

          {/* 5 Stat Bars + Special */}
          <div className="p-3 rounded-[16px] bg-black/25 border border-white/10 flex flex-col gap-1.5">
            <StatBar label="Speed" value={activeCls.statBars.speed} color="#00E5C3" />
            <StatBar label="Armor" value={activeCls.statBars.armor} color="#3B82F6" />
            <StatBar label="Damage" value={activeCls.statBars.firepower} color="#FFC83D" />
            <StatBar label="Reload" value={activeCls.statBars.reload} color="#3DDC84" />
            <StatBar label="Agility" value={activeCls.statBars.agility} color="#C084FC" />
            <div className="text-xs text-[#AAB3DE] pt-1 border-t border-white/8">
              {activeCls.specialText}
            </div>
          </div>

          {/* 12 Color Swatches */}
          <div>
            <div className="flex items-center justify-between text-xs text-[#AAB3DE] mb-1.5">
              <span className="font-semibold">Hull Paint</span>
              {isTeamMode && (
                <span className="inline-flex items-center gap-1 text-[#FFC83D]">
                  <Lock className="w-3 h-3" /> Team color overrides hull (trim kept)
                </span>
              )}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {TANK_COLORS.map((col) => {
                const active = custom.colorId === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    disabled={isSpectator}
                    aria-label={`Color ${col.name}`}
                    onClick={() => onChangeCustom({ ...custom, colorId: col.id })}
                    className={`h-8 rounded-[10px] border-2 cursor-pointer flex items-center justify-center ${
                      active ? 'border-white scale-105' : 'border-white/20 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col.hex }}
                  >
                    {active && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Turret Styles & Decals */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[#AAB3DE] font-semibold mb-1.5">Turret Style</div>
              <div className="grid grid-cols-3 gap-1.5">
                {TURRET_STYLES.map((ts) => (
                  <button
                    key={ts.id}
                    type="button"
                    disabled={isSpectator}
                    aria-label={ts.name}
                    onClick={() => onChangeCustom({ ...custom, turretStyle: ts.id as TurretStyleId })}
                    className={`p-2 rounded-[12px] border flex flex-col items-center gap-1 text-[11px] cursor-pointer ${
                      custom.turretStyle === ts.id
                        ? 'bg-[#00E5C3]/20 border-[#00E5C3] text-white'
                        : 'bg-white/5 border-white/12 text-[#AAB3DE]'
                    }`}
                  >
                    <TurretStyleIcon styleId={ts.id as TurretStyleId} className="w-5 h-5" />
                    <span>{ts.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#AAB3DE] font-semibold mb-1.5">Hull Decal</div>
              <div className="grid grid-cols-3 gap-1.5">
                {DECAL_STYLES.map((ds) => (
                  <button
                    key={ds.id}
                    type="button"
                    disabled={isSpectator}
                    aria-label={`Decal ${ds.name}`}
                    onClick={() => onChangeCustom({ ...custom, decal: ds.id as DecalId })}
                    className={`p-1.5 rounded-[12px] border flex items-center justify-center cursor-pointer ${
                      custom.decal === ds.id
                        ? 'bg-[#00E5C3]/20 border-[#00E5C3] text-white'
                        : 'bg-white/5 border-white/12 text-[#AAB3DE]'
                    }`}
                  >
                    <DecalIcon decalId={ds.id as DecalId} className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* CENTER: PLAYERS + CHAT */}
        <GlassCard
          className={`min-[1500px]:col-span-4 flex flex-col gap-3 overflow-hidden ${
            mobileTab === 'players' ? 'flex' : 'hidden min-[1500px]:flex'
          }`}
        >
          <div className="flex items-center justify-between shrink-0">
            <h2 className="font-display text-xl font-bold text-[#F5F7FF]">
              Squad & Players ({room.players.length} + {room.settings.botCount} Bots)
            </h2>
            {room.spectatorCount > 0 && (
              <span className="text-xs text-[#AAB3DE]">{room.spectatorCount} watching</span>
            )}
          </div>

          <div className="flex-1 min-h-[160px] overflow-y-auto flex flex-col gap-2 pr-1">
            {room.players.map((p) => {
              const cls = TANK_CLASSES[p.custom.classId];
              return (
                <div
                  key={p.id}
                  className="anim-player-row flex items-center justify-between gap-2 px-3 py-2 rounded-[16px] bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.isHost && <Crown className="w-4 h-4 text-[#FFC83D] shrink-0" aria-label="Host" />}
                    <ClassIcon classId={p.custom.classId} className="w-5 h-5 text-[#00E5C3] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display text-sm font-bold text-[#F5F7FF] truncate">
                        {p.name} {p.id === yourId && <span className="text-xs text-[#00E5C3]">(You)</span>}
                      </div>
                      <div className="text-[11px] text-[#AAB3DE]">
                        {cls.name} • {p.pingMs}ms
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isTeamMode && (
                      <button
                        type="button"
                        disabled={!isHost && p.id !== yourId}
                        onClick={() => onSetTeam(p.id, p.team === 'red' ? 'blue' : 'red')}
                        className={`px-2.5 py-1 rounded-full text-xs font-display font-bold cursor-pointer disabled:cursor-default ${
                          p.team === 'red'
                            ? 'bg-[#FF4D5E]/25 text-[#FF4D5E] border border-[#FF4D5E]/50'
                            : 'bg-[#3B82F6]/25 text-[#3B82F6] border border-[#3B82F6]/50'
                        }`}
                      >
                        {p.team === 'red' ? 'RED' : 'BLUE'}
                      </button>
                    )}

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        p.isHost || p.ready
                          ? 'bg-[#3DDC84]/20 text-[#3DDC84]'
                          : 'bg-white/10 text-[#AAB3DE]'
                      }`}
                    >
                      {p.isHost ? 'Host' : p.ready ? 'Ready' : 'Wait'}
                    </span>

                    {isHost && p.id !== yourId && !p.isBot && (
                      <button
                        type="button"
                        aria-label={`Kick ${p.name}`}
                        onClick={() => onKickPlayer(p.id)}
                        className="p-1.5 rounded-lg text-[#FF4D6D] hover:bg-[#FF4D6D]/15 cursor-pointer"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat */}
          <div className="border-t border-white/10 pt-3 flex flex-col gap-2 shrink-0 h-56">
            <div className="flex flex-wrap gap-1">
              {QUICK_CHAT_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSendChat(q, true)}
                  className="px-2 py-0.5 rounded-full bg-white/8 hover:bg-white/15 text-[11px] text-[#AAB3DE] hover:text-white cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto rounded-[14px] bg-black/30 p-2.5 flex flex-col gap-1 text-xs">
              {chatMessages.length === 0 ? (
                <span className="text-[#AAB3DE]/60">Say hello to the lobby...</span>
              ) : (
                chatMessages.map((m) => (
                  <div key={m.id}>
                    <span className="font-bold text-[#00E5C3]">{m.senderName}: </span>
                    <span className="text-[#F5F7FF]">{m.text}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                maxLength={80}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type chat message..."
                className="flex-1 px-3 py-1.5 rounded-[12px] bg-black/35 border border-white/12 text-sm text-[#F5F7FF]"
              />
              <ArcadeButton type="submit" variant="secondary" size="sm" aria-label="Send chat">
                <Send className="w-4 h-4" />
              </ArcadeButton>
            </form>
          </div>
        </GlassCard>

        {/* RIGHT: MATCH SETUP & LIVE MAP PREVIEW CARD */}
        <GlassCard
          className={`min-[1500px]:col-span-4 flex flex-col gap-3 overflow-y-auto ${
            mobileTab === 'match' ? 'flex' : 'hidden min-[1500px]:flex'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#F5F7FF]">Match Setup</h2>
            {!isHost && (
              <span className="text-xs text-[#AAB3DE]">Host controls settings</span>
            )}
          </div>

          {/* 5 Mode Cards */}
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(GAME_MODES) as GameModeId[]).map((mid) => {
              const meta = GAME_MODES[mid];
              const active = room.settings.mode === mid;
              return (
                <button
                  key={mid}
                  type="button"
                  disabled={!isHost}
                  onClick={() =>
                    onChangeSettings({
                      mode: mid,
                      timeLimitSec: meta.defaultTimeSec,
                      scoreLimit: meta.defaultScoreLimit,
                      shrinkingZone: mid === 'lts',
                    })
                  }
                  className={`py-2 px-1 rounded-[14px] border text-center cursor-pointer disabled:cursor-default ${
                    active
                      ? 'bg-[#7C5CFF]/35 border-[#00E5C3] text-white'
                      : 'bg-white/5 border-white/12 text-[#AAB3DE] hover:text-white'
                  }`}
                >
                  <div className="font-display text-sm font-bold">{meta.shortName}</div>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-[#AAB3DE] px-1">
            <strong className="text-[#F5F7FF]">{modeMeta.name}:</strong> {modeMeta.planLine1}
          </div>

          {/* Map Dropdown */}
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[#AAB3DE] font-semibold">Arena Map</span>
            <select
              disabled={!isHost}
              value={room.settings.mapId}
              aria-label="Arena Map"
              onChange={(e) => onChangeSettings({ mapId: e.target.value as MapId })}
              className="px-3 py-2 rounded-[14px] bg-[#0B102B] border border-white/15 text-sm font-display font-semibold text-[#F5F7FF] disabled:opacity-70"
            >
              {sortedMaps.map((m) => (
                <option key={m.id} value={m.id}>
                  {modeMeta.recommendedMaps.includes(m.id) ? `★ ${m.name} (Recommended)` : m.name}
                </option>
              ))}
            </select>
          </label>

          {/* Live Map Preview Card (Section 30.2) */}
          <div
            key={`${room.settings.mapId}_${room.settings.mapSize}`}
            className="anim-map-preview rounded-[18px] bg-black/35 border border-white/15 overflow-hidden shrink-0"
          >
            <div className="relative h-36 w-full overflow-hidden bg-[#0C122D]">
              <img
                src={mapThumbUrl}
                alt={`${activeMap.name} map preview`}
                className="anim-map-thumb w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-xs font-display font-bold text-[#F5F7FF]">
                {activeMap.name}
              </div>
              <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-[11px] font-mono-num text-[#00E5C3]">
                {activeMap.width}x{activeMap.depth}m
              </div>
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              <div className="text-xs text-[#F5F7FF]">{activeMap.description}</div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#AAB3DE]">
                <span>Best for: {activeMap.bestFor}</span>
                <div className="flex gap-1">
                  {activeMap.hazards.map((h) => (
                    <span
                      key={h}
                      className="px-2 py-0.5 rounded-full bg-white/8 border border-white/10 uppercase text-[10px] font-bold text-[#FFC83D]"
                    >
                      {h.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Map Size & Bot Settings */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[#AAB3DE] font-semibold">
              Map Size ({MAP_SIZE_SCALES[room.settings.mapSize].recPlayers})
            </span>
            <SegmentedControl<MapSizeId>
              disabled={!isHost}
              ariaLabel="Map Size"
              value={room.settings.mapSize}
              onChange={(sz) => onChangeSettings({ mapSize: sz })}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[#AAB3DE]">Bots ({room.settings.botCount})</span>
              <input
                type="range"
                min={0}
                max={8}
                disabled={!isHost}
                value={room.settings.botCount}
                onChange={(e) => onChangeSettings({ botCount: Number(e.target.value) })}
                className="accent-[#00E5C3]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[#AAB3DE]">Bot Difficulty</span>
              <select
                disabled={!isHost}
                value={room.settings.botDifficulty}
                onChange={(e) => onChangeSettings({ botDifficulty: e.target.value as BotDifficulty })}
                className="px-2.5 py-1.5 rounded-[12px] bg-[#0B102B] border border-white/15 text-xs text-[#F5F7FF]"
              >
                {(Object.keys(BOT_CONFIG) as BotDifficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {d.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-2">
            <ArcadeToggle
              label="Power Boxes"
              checked={room.settings.powerBoxesEnabled}
              disabled={!isHost}
              onChange={(v) => onChangeSettings({ powerBoxesEnabled: v })}
            />
            <ArcadeToggle
              label="Tank Classes"
              checked={room.settings.tankRule === 'classes'}
              disabled={!isHost}
              onChange={(v) => onChangeSettings({ tankRule: v ? 'classes' : 'classic' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ArcadeToggle
              label="Shrinking Zone"
              checked={room.settings.shrinkingZone}
              disabled={!isHost}
              onChange={(v) => onChangeSettings({ shrinkingZone: v })}
            />
            <ArcadeToggle
              label="Friendly Fire"
              checked={room.settings.friendlyFire}
              disabled={!isHost || !isTeamMode}
              onChange={(v) => onChangeSettings({ friendlyFire: v })}
            />
          </div>
        </GlassCard>
      </div>

      {/* Bottom Action Bar */}
      <footer className="max-w-[1680px] w-full mx-auto pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="text-sm text-[#AAB3DE]">
          {startReason ? (
            <span className="inline-flex items-center gap-1.5 text-[#FFC83D]">
              <Shield className="w-4 h-4" />
              {startReason}
            </span>
          ) : (
            <span className="text-[#3DDC84] font-semibold">All tanks ready for deployment</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isHost && !isSpectator && me && (
            <ArcadeButton
              variant={me.ready ? 'accent' : 'secondary'}
              size="lg"
              onClick={() => onToggleReady(!me.ready)}
            >
              {me.ready ? 'Ready!' : 'Mark Ready'}
            </ArcadeButton>
          )}

          {isHost && (
            <ArcadeButton
              variant="primary"
              size="lg"
              disabled={!canStart}
              title={startReason || 'Start Match'}
              onClick={onStartMatch}
            >
              <Play className="w-5 h-5 fill-current" />
              Start Match
            </ArcadeButton>
          )}
        </div>
      </footer>
    </div>
  );
};
