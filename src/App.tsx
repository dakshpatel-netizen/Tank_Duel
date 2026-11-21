import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildMap } from '../shared/maps/index';
import type { ChatMessage, WorldSnapshot } from '../shared/protocol';
import { sanitizeNickname } from '../shared/protocol';
import type {
  MatchResultSummary,
  MatchSettings,
  PlayerInput,
  RoomStateInfo,
  SimEvent,
  TankCustomization,
} from '../shared/types';
import { BattleHUD } from './components/BattleHUD';
import { LobbyScreen } from './components/LobbyScreen';
import {
  CountdownOverlay,
  CreditsModal,
  DeathOverlay,
  HowToPlayModal,
  LoadingOverlay,
  PauseMenuModal,
  PlanScreenOverlay,
  ReconnectingModal,
  ResultsScreen,
  SettingsModal,
} from './components/Overlays';
import { JoinRoomScreen, MainMenuScreen, TitleScreen } from './components/TitleAndMenu';
import { ToastStack, type ToastItem } from './components/UIPrimitives';
import { getDefaultPracticeSettings, LocalPracticeSession } from './game/localPractice';
import { NetClient } from './game/netClient';
import { soundEngine } from './game/sound';
import {
  loadCustomization,
  loadNickname,
  loadSettings,
  saveCustomization,
  saveNickname,
  saveSettings,
  type GameSettings,
} from './types/settings';

type ScreenState =
  | 'title'
  | 'menu'
  | 'join'
  | 'lobby'
  | 'loading'
  | 'battle'
  | 'results';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('title');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [custom, setCustom] = useState<TankCustomization>(() => loadCustomization());
  const [nickname, setNickname] = useState<string>(() => loadNickname());

  const [netStatus, setNetStatus] = useState<'connecting' | 'online' | 'reconnecting' | 'offline'>('connecting');
  const [room, setRoom] = useState<RoomStateInfo | null>(null);
  const [yourId, setYourId] = useState<string>('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [canSpectateJoin, setCanSpectateJoin] = useState(false);

  const [isPractice, setIsPractice] = useState(false);
  const [activeMatchSettings, setActiveMatchSettings] = useState<MatchSettings>(() => getDefaultPracticeSettings());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [planSecondsLeft, setPlanSecondsLeft] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<WorldSnapshot | null>(null);
  const [pendingEvents, setPendingEvents] = useState<SimEvent[]>([]);
  const [lastKillerText, setLastKillerText] = useState('Eliminated in action');
  const [matchSummary, setMatchSummary] = useState<MatchResultSummary | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const netRef = useRef<NetClient | null>(null);
  const practiceRef = useRef<LocalPracticeSession | null>(null);
  const practiceSnapRef = useRef<WorldSnapshot | null>(null);
  const planTimerRef = useRef<number | null>(null);
  const activeSettingsRef = useRef(activeMatchSettings);
  activeSettingsRef.current = activeMatchSettings;

  const initialJoinCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('room') || '';
  }, []);

  const pushToast = useCallback((text: string, tone: 'info' | 'warn' | 'accent' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Sync audio & accessibility classes
  useEffect(() => {
    saveSettings(settings);
    soundEngine.setVolumes(
      settings.audio.master,
      settings.audio.music,
      settings.audio.effects,
      settings.audio.muted
    );
    document.documentElement.classList.toggle('reduced-motion', settings.accessibility.reducedMotion);
    document.documentElement.classList.toggle('large-ui', settings.accessibility.largeUi);
  }, [settings]);

  // Sync music mode & body data-state
  useEffect(() => {
    if (screen === 'battle') {
      document.body.dataset.state = paused ? 'paused' : 'playing';
      soundEngine.setMusicMode('battle');
    } else if (screen === 'results') {
      document.body.dataset.state = 'gameover';
      soundEngine.setMusicMode('menu');
    } else {
      document.body.dataset.state = screen;
      soundEngine.setMusicMode(screen === 'title' ? 'none' : 'menu');
    }
  }, [screen, paused]);

  useEffect(() => {
    if (isPractice) {
      practiceRef.current?.setPaused(paused || showHowToPlay || showSettings);
    }
  }, [isPractice, paused, showHowToPlay, showSettings]);

  // Pre-build active MapDefinition when in battle
  const activeMap = useMemo(
    () => buildMap(activeMatchSettings.mapId, activeMatchSettings.mapSize),
    [activeMatchSettings.mapId, activeMatchSettings.mapSize]
  );

  // Initialize NetClient once
  useEffect(() => {
    const client = new NetClient({
      onStatusChange: (status) => setNetStatus(status),
      onRoomJoined: (data) => {
        setRoom(data.room);
        setYourId(data.yourId);
        setIsSpectator(data.isSpectator);
        setChatHistory(data.chatHistory);
        setJoinError(null);
        setCanSpectateJoin(false);
        setIsPractice(false);
        setScreen('lobby');
      },
      onRoomUpdate: (r) => setRoom(r),
      onCountdown: (secondsLeft, ms) => {
        setActiveMatchSettings(ms);
        setIsPractice(false);
        setPaused(false);
        setMatchSummary(null);
        setScreen('loading');
        setLoadingProgress(secondsLeft > 6 ? 45 : 100);
        if (secondsLeft > 3) {
          setScreen('battle');
          setPlanSecondsLeft(secondsLeft - 3);
          setCountdownLabel(null);
        } else if (secondsLeft >= 1) {
          setScreen('battle');
          setPlanSecondsLeft(0);
          setCountdownLabel(String(secondsLeft));
          soundEngine.playCountdown(false);
        }
      },
      onMatchStart: (ms, _seed, snap) => {
        setActiveMatchSettings(ms);
        setLatestSnapshot(snap);
        setPlanSecondsLeft(0);
        setCountdownLabel('FIGHT!');
        soundEngine.playCountdown(true);
        setScreen('battle');
        window.setTimeout(() => setCountdownLabel(null), 850);
      },
      onSnapshot: (snap) => {
        setLatestSnapshot(snap);
        const m = buildMap(activeSettingsRef.current.mapId, activeSettingsRef.current.mapSize);
        client.reconcileLocalTank(snap, m, activeSettingsRef.current);
      },
      onEvents: (events) => {
        setPendingEvents((prev) => [...prev, ...events]);
        for (const ev of events) {
          if (ev.type === 'tank_destroyed' && ev.victimId === client.yourId) {
            setLastKillerText(`Destroyed by ${ev.killerName} [${ev.weapon}]`);
          }
        }
      },
      onChat: (msg) => setChatHistory((prev) => [...prev.slice(-39), msg]),
      onToast: (text, tone) => pushToast(text, tone),
      onMatchEnd: (summary, r) => {
        setRoom(r);
        setMatchSummary(summary);
        setPaused(false);
        setScreen('results');
        const didWin =
          summary.winnerId === client.yourId ||
          Boolean(summary.winnerTeam && summary.players.find((p) => p.id === client.yourId)?.team === summary.winnerTeam);
        soundEngine.playWinFanfare(didWin);
      },
      onKicked: (reason) => {
        setRoom(null);
        setScreen('menu');
        pushToast(reason, 'warn');
      },
      onError: (_code, message, canSpec) => {
        setJoinError(message);
        setCanSpectateJoin(Boolean(canSpec));
        pushToast(message, 'warn');
      },
    });
    netRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      netRef.current = null;
    };
  }, [pushToast]);

  const clearPlanTimers = useCallback(() => {
    if (planTimerRef.current !== null) {
      window.clearInterval(planTimerRef.current);
      planTimerRef.current = null;
    }
  }, []);

  const deployPracticeNow = useCallback(() => {
    clearPlanTimers();
    setPlanSecondsLeft(0);
    setCountdownLabel('FIGHT!');
    soundEngine.playCountdown(true);
    practiceRef.current?.start();
    window.setTimeout(() => setCountdownLabel(null), 800);
  }, [clearPlanTimers]);

  // Launch Practice vs Bots
  const startPracticeBattle = useCallback((skipBriefing = false) => {
    clearPlanTimers();
    practiceRef.current?.stop();
    const ms = getDefaultPracticeSettings();
    setIsPractice(true);
    setIsSpectator(false);
    setRoom(null);
    setActiveMatchSettings(ms);
    setYourId('local_player');
    setPaused(false);
    setMatchSummary(null);
    setChatHistory([]);

    const session = new LocalPracticeSession(nickname, custom, ms, {
      onSnapshot: (snap) => {
        practiceSnapRef.current = snap;
        setLatestSnapshot(snap);
      },
      onEvents: (events) => {
        setPendingEvents((prev) => [...prev, ...events]);
        for (const ev of events) {
          if (ev.type === 'tank_destroyed' && ev.victimId === 'local_player') {
            setLastKillerText(`Destroyed by ${ev.killerName} [${ev.weapon}]`);
          }
        }
      },
      onMatchEnd: (summary) => {
        setMatchSummary(summary);
        setScreen('results');
        soundEngine.playWinFanfare(summary.winnerId === 'local_player');
      },
    });
    practiceRef.current = session;
    const initSnap = session.buildSnapshot();
    practiceSnapRef.current = initSnap;
    setLatestSnapshot(initSnap);

    // Quick loading -> brief plan (unless autostart/rematch) -> fight
    setScreen('loading');
    setLoadingProgress(35);
    window.setTimeout(() => setLoadingProgress(100), 160);
    window.setTimeout(() => {
      setScreen('battle');
      if (skipBriefing) {
        setPlanSecondsLeft(0);
        setCountdownLabel('FIGHT!');
        session.start();
        window.setTimeout(() => setCountdownLabel(null), 800);
      } else {
        let secs = 3;
        setPlanSecondsLeft(secs);
        setCountdownLabel(null);
        planTimerRef.current = window.setInterval(() => {
          secs -= 1;
          if (secs <= 0) {
            deployPracticeNow();
          } else {
            setPlanSecondsLeft(secs);
          }
        }, 1000);
      }
    }, 320);
  }, [nickname, custom, clearPlanTimers, deployPracticeNow]);

  // Handle ?room= and ?autostart=1 on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startPracticeBattle(true);
    } else if (params.get('room')) {
      setScreen('join');
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global keyboard shortcuts (Esc & Mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Escape') {
        if (showSettings) setShowSettings(false);
        else if (showHowToPlay) setShowHowToPlay(false);
        else if (showCredits) setShowCredits(false);
        else if (screen === 'battle') {
          setPaused((prev) => {
            const next = !prev;
            if (isPractice) practiceRef.current?.setPaused(next);
            return next;
          });
        }
      } else if (e.code === settings.controls.bindings.mute && !e.repeat) {
        setSettings((prev) => ({
          ...prev,
          audio: { ...prev.audio, muted: !prev.audio.muted },
        }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSettings, showHowToPlay, showCredits, screen, isPractice, settings.controls.bindings.mute]);

  const handleNicknameChange = (name: string) => {
    setNickname(name);
    saveNickname(name);
  };

  const handleCustomChange = (next: TankCustomization) => {
    setCustom(next);
    saveCustomization(next);
    if (room && netRef.current) {
      netRef.current.send({ type: 'setTank', custom: next });
    }
  };

  const handleLeaveToMenu = () => {
    clearPlanTimers();
    practiceRef.current?.stop();
    practiceRef.current = null;
    if (room) {
      netRef.current?.send({ type: 'leaveRoom' });
    }
    sessionStorage.removeItem('tdo_room_code');
    setRoom(null);
    setPaused(false);
    setPlanSecondsLeft(0);
    setMatchSummary(null);
    setScreen('menu');
  };

  const snapshotProvider = useCallback(
    (dt: number) => {
      if (isPractice) return practiceSnapRef.current;
      return netRef.current?.getInterpolatedSnapshot(dt) ?? null;
    },
    [isPractice]
  );

  const handleInputSample = useCallback(
    (input: PlayerInput) => {
      if (isPractice) {
        practiceRef.current?.pushInput(input);
      } else if (netRef.current && latestSnapshot) {
        const carrying = Boolean(
          latestSnapshot.flags &&
            (latestSnapshot.flags.red.carrierId === yourId ||
              latestSnapshot.flags.blue.carrierId === yourId)
        );
        netRef.current.sendInput(input, activeMap, activeMatchSettings, carrying);
      }
    },
    [isPractice, latestSnapshot, yourId, activeMap, activeMatchSettings]
  );

  const localTank = latestSnapshot?.tanks.find((t) => t.id === yourId);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <ToastStack toasts={toasts} />

      {screen === 'title' && (
        <TitleScreen
          custom={custom}
          settings={settings}
          onEnterArena={() => {
            soundEngine.unlock();
            setScreen('menu');
          }}
        />
      )}

      {screen === 'menu' && (
        <MainMenuScreen
          nickname={nickname}
          onNicknameChange={handleNicknameChange}
          custom={custom}
          settings={settings}
          netStatus={netStatus}
          onCreateRoom={() => {
            const clean = sanitizeNickname(nickname);
            handleNicknameChange(clean);
            netRef.current?.createRoom(clean, custom);
          }}
          onOpenJoin={() => {
            setJoinError(null);
            setCanSpectateJoin(false);
            setScreen('join');
          }}
          onStartPractice={() => startPracticeBattle(false)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenCredits={() => setShowCredits(true)}
          onToggleMute={() =>
            setSettings((p) => ({ ...p, audio: { ...p.audio, muted: !p.audio.muted } }))
          }
        />
      )}

      {screen === 'join' && (
        <JoinRoomScreen
          initialCode={initialJoinCode}
          errorMsg={joinError}
          canSpectate={canSpectateJoin}
          onJoin={(code, pwd, asSpec) => {
            const clean = sanitizeNickname(nickname);
            handleNicknameChange(clean);
            netRef.current?.joinRoom(code, clean, custom, pwd, asSpec);
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'lobby' && room && (
        <LobbyScreen
          room={room}
          yourId={yourId}
          isSpectator={isSpectator}
          custom={custom}
          settings={settings}
          chatMessages={chatHistory}
          onChangeCustom={handleCustomChange}
          onToggleReady={(ready) => netRef.current?.send({ type: 'setReady', ready })}
          onChangeSettings={(patch) => netRef.current?.send({ type: 'hostSettings', settings: patch })}
          onSetTeam={(targetPlayerId, team) =>
            netRef.current?.send({ type: 'setTeam', targetPlayerId, team })
          }
          onKickPlayer={(targetPlayerId) =>
            netRef.current?.send({ type: 'kickPlayer', targetPlayerId })
          }
          onSendChat={(text, isQuick) =>
            netRef.current?.send({ type: 'chat', text, isQuick })
          }
          onStartMatch={() => netRef.current?.send({ type: 'startMatch' })}
          onLeaveRoom={handleLeaveToMenu}
          onCopyInvite={() => {
            const url = `${window.location.origin}/?room=${room.code}`;
            navigator.clipboard?.writeText(url).catch(() => {});
            pushToast(`Invite link copied for room ${room.code}`, 'accent');
          }}
        />
      )}

      {screen === 'loading' && <LoadingOverlay progress={loadingProgress} />}

      {screen === 'battle' && (
        <>
          <BattleHUD
            map={activeMap}
            matchSettings={activeMatchSettings}
            localId={yourId}
            isPractice={isPractice}
            isSpectator={isSpectator}
            paused={paused}
            settings={settings}
            pingMs={netRef.current?.pingMs ?? 0}
            lastPredError={netRef.current?.lastPredictionError ?? 0}
            snapshotProvider={snapshotProvider}
            latestSnapshot={latestSnapshot}
            pendingEvents={pendingEvents}
            onConsumeEvents={() => setPendingEvents([])}
            onInputSample={handleInputSample}
            onTogglePause={() =>
              setPaused((prev) => {
                const next = !prev;
                if (isPractice) practiceRef.current?.setPaused(next);
                return next;
              })
            }
            onToggleMute={() =>
              setSettings((p) => ({ ...p, audio: { ...p.audio, muted: !p.audio.muted } }))
            }
            onToggleAimMode={() =>
              setSettings((p) => {
                const nextMode = p.aiming.aimMode === 'mouse' ? 'barrel' : 'mouse';
                pushToast(
                  nextMode === 'mouse'
                    ? 'Aim Mode: Mouse Turret'
                    : 'Aim Mode: Tank Forward (Auto-Lock)',
                  'accent'
                );
                return { ...p, aiming: { ...p.aiming, aimMode: nextMode } };
              })
            }
            onOpenHowToPlay={() => setShowHowToPlay(true)}
            onSendQuickChat={(text) => {
              if (!isPractice) {
                netRef.current?.send({ type: 'chat', text, isQuick: true });
              } else {
                setChatHistory((prev) => [
                  ...prev.slice(-10),
                  {
                    id: String(Date.now()),
                    senderId: yourId,
                    senderName: nickname,
                    team: 'none',
                    text,
                    timestamp: Date.now(),
                    isQuick: true,
                  },
                ]);
              }
            }}
            chatFeed={chatHistory}
          />

          {planSecondsLeft > 0 && (
            <PlanScreenOverlay
              settings={activeMatchSettings}
              secondsLeft={planSecondsLeft}
              onDeployNow={isPractice ? deployPracticeNow : undefined}
            />
          )}

          {countdownLabel && <CountdownOverlay label={countdownLabel} />}

          {localTank && !localTank.alive && !isSpectator && (
            <DeathOverlay
              localTank={localTank}
              killerText={lastKillerText}
              isLts={activeMatchSettings.mode === 'lts'}
            />
          )}

          <PauseMenuModal
            open={paused}
            isPractice={isPractice}
            onResume={() => {
              setPaused(false);
              if (isPractice) practiceRef.current?.setPaused(false);
            }}
            onOpenSettings={() => setShowSettings(true)}
            onOpenHowToPlay={() => setShowHowToPlay(true)}
            onLeave={handleLeaveToMenu}
          />
        </>
      )}

      {screen === 'results' && matchSummary && (
        <ResultsScreen
          summary={matchSummary}
          yourId={yourId}
          room={room}
          isPractice={isPractice}
          settings={settings}
          onRematchVote={() => {
            if (isPractice) {
              startPracticeBattle(true);
            } else {
              netRef.current?.send({ type: 'rematch' });
            }
          }}
          onBackToLobby={() => {
            if (room) {
              netRef.current?.send({ type: 'backToLobby' });
              setScreen('lobby');
            }
          }}
          onLeave={handleLeaveToMenu}
        />
      )}

      {/* Global Modals */}
      <SettingsModal
        open={showSettings}
        settings={settings}
        onChange={setSettings}
        onClose={() => setShowSettings(false)}
      />
      <HowToPlayModal open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <CreditsModal open={showCredits} onClose={() => setShowCredits(false)} />
      <ReconnectingModal
        open={netStatus === 'reconnecting' && !isPractice}
        onCancel={handleLeaveToMenu}
      />
    </div>
  );
}
