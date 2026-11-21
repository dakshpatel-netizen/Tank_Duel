import type { TankCustomization } from '../../shared/types';

export type AimPinStyle = 'classic' | 'cross' | 'chevron';
export type QualityPreset = 'low' | 'medium' | 'high';

export interface KeyBindings {
  forward: string;
  reverse: string;
  turnLeft: string;
  turnRight: string;
  useWeapon: string;
  turbo: string;
  handbrake: string;
  dashLeft: string;
  dashRight: string;
  quickChat: string;
  mute: string;
}

export interface GameSettings {
  graphics: {
    quality: QualityPreset;
    resolutionScale: number;
    shadows: boolean;
    fov: number;
    showFpsPing: boolean;
  };
  audio: {
    master: number;
    music: number;
    effects: number;
    muted: boolean;
  };
  controls: {
    bindings: KeyBindings;
    mouseSensitivity: number;
    turretSpeedScale: number;
  };
  aiming: {
    aimMode: 'mouse' | 'barrel';
    pinStyle: AimPinStyle;
    pinSize: number;
    pinColor: string;
    leadIndicator: boolean;
    aimAssist: 'off' | 'light';
  };
  gameplay: {
    cameraShake: boolean;
    showKillCam: boolean;
  };
  accessibility: {
    largeUi: boolean;
    colorblindTeams: boolean;
    reducedMotion: boolean;
  };
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: 'KeyW',
  reverse: 'KeyS',
  turnLeft: 'KeyA',
  turnRight: 'KeyD',
  useWeapon: 'Space',
  turbo: 'ShiftLeft',
  handbrake: 'ControlLeft',
  dashLeft: 'KeyQ',
  dashRight: 'KeyE',
  quickChat: 'KeyT',
  mute: 'KeyM',
};

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    quality: 'medium',
    resolutionScale: 1.0,
    shadows: true,
    fov: 60,
    showFpsPing: true,
  },
  audio: {
    master: 0.75,
    music: 0.25,
    effects: 0.85,
    muted: false,
  },
  controls: {
    bindings: { ...DEFAULT_KEY_BINDINGS },
    mouseSensitivity: 1.0,
    turretSpeedScale: 1.0,
  },
  aiming: {
    aimMode: 'mouse',
    pinStyle: 'classic',
    pinSize: 1.0,
    pinColor: '#FFFFFF',
    leadIndicator: true,
    aimAssist: 'light',
  },
  gameplay: {
    cameraShake: true,
    showKillCam: true,
  },
  accessibility: {
    largeUi: false,
    colorblindTeams: false,
    reducedMotion: false,
  },
};

export const DEFAULT_CUSTOMIZATION: TankCustomization = {
  classId: 'standard',
  colorId: 'teal',
  turretStyle: 'dome',
  decal: 'stripes',
};

const SETTINGS_KEY = 'tdo_settings_v1';
const CUSTOM_KEY = 'tdo_custom_v1';
const NICK_KEY = 'tdo_nickname_v1';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      graphics: { ...DEFAULT_SETTINGS.graphics, ...parsed.graphics },
      audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio },
      controls: {
        ...DEFAULT_SETTINGS.controls,
        ...parsed.controls,
        bindings: { ...DEFAULT_KEY_BINDINGS, ...parsed.controls?.bindings },
      },
      aiming: { ...DEFAULT_SETTINGS.aiming, ...parsed.aiming },
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...parsed.gameplay },
      accessibility: { ...DEFAULT_SETTINGS.accessibility, ...parsed.accessibility },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

export function loadCustomization(): TankCustomization {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return { ...DEFAULT_CUSTOMIZATION };
    return { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CUSTOMIZATION };
  }
}

export function saveCustomization(c: TankCustomization): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

export function loadNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) || 'AceTanker';
  } catch {
    return 'AceTanker';
  }
}

export function saveNickname(nick: string): void {
  try {
    localStorage.setItem(NICK_KEY, nick);
  } catch {
    // ignore
  }
}

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  return code.toUpperCase();
}
