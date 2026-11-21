// Procedural Web Audio API sound & music synthesizer (Section 18).
// Starts strictly after first user gesture; all nodes pooled/lightweight.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicMode: 'none' | 'menu' | 'battle' = 'none';
  private musicStep = 0;

  private masterVol = 0.75;
  private musicVol = 0.25;
  private sfxVol = 0.85;
  private muted = false;

  public unlock() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolumes(master: number, music: number, sfx: number, muted: boolean) {
    this.masterVol = master;
    this.musicVol = music;
    this.sfxVol = sfx;
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicVol, now, 0.04);
  }

  private distGain(dist: number, maxDist = 75): number {
    return Math.max(0, Math.min(1, 1 - dist / maxDist));
  }

  public playUiHover() {
    this.tone(540, 620, 0.035, 'sine', 0.08);
  }

  public playUiClick() {
    this.tone(440, 660, 0.06, 'triangle', 0.16);
  }

  public playReady() {
    this.tone(523, 784, 0.14, 'triangle', 0.22);
  }

  public playCountdown(isFight: boolean) {
    if (isFight) {
      this.tone(523, 1046, 0.28, 'sawtooth', 0.24);
    } else {
      this.tone(440, 440, 0.14, 'triangle', 0.2);
    }
  }

  public playCannon(dist = 0) {
    const g = this.distGain(dist, 90);
    if (g <= 0.02) return;
    this.tone(160, 42, 0.18, 'sawtooth', 0.35 * g);
    this.noise(0.12, 900, 0.28 * g);
  }

  public playRicochet(dist = 0) {
    const g = this.distGain(dist, 70);
    if (g <= 0.02) return;
    this.tone(1350 + Math.random() * 260, 680, 0.14, 'sine', 0.2 * g);
  }

  public playHitMarker(isKill = false) {
    if (isKill) {
      this.tone(880, 1180, 0.08, 'triangle', 0.25);
      setTimeout(() => this.tone(1180, 1560, 0.1, 'triangle', 0.25), 70);
    } else {
      this.tone(920, 740, 0.05, 'triangle', 0.18);
    }
  }

  public playExplosion(size: 'small' | 'medium' | 'large', dist = 0) {
    const g = this.distGain(dist, 100);
    if (g <= 0.02) return;
    const dur = size === 'large' ? 0.65 : size === 'medium' ? 0.42 : 0.22;
    const freq = size === 'large' ? 95 : size === 'medium' ? 130 : 180;
    this.tone(freq, 26, dur, 'sawtooth', 0.42 * g);
    this.noise(dur, size === 'large' ? 500 : 750, 0.35 * g);
  }

  public playPowerBoxPickup() {
    this.tone(523, 659, 0.09, 'sine', 0.22);
    setTimeout(() => this.tone(659, 987, 0.14, 'sine', 0.22), 75);
  }

  public playEmp() {
    this.tone(980, 140, 0.36, 'sawtooth', 0.28);
  }

  public playMissileWarning() {
    this.tone(1040, 1040, 0.07, 'square', 0.15);
  }

  public playFlagHorn(captured = false) {
    if (captured) {
      this.tone(440, 554, 0.15, 'triangle', 0.28);
      setTimeout(() => this.tone(554, 659, 0.22, 'triangle', 0.28), 140);
    } else {
      this.tone(330, 440, 0.2, 'sawtooth', 0.22);
    }
  }

  public playWinFanfare(won: boolean) {
    const notes = won ? [523, 659, 784, 1046] : [392, 349, 311, 261];
    notes.forEach((n, idx) => {
      setTimeout(() => this.tone(n, n, 0.22, 'triangle', 0.22), idx * 130);
    });
  }

  public updateEngineHum(active: boolean, speedRatio: number) {
    if (!this.ctx || !this.sfxGain) return;
    if (!active) {
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }
    if (!this.engineOsc || !this.engineGain) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 46;
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);
      this.engineOsc.start();
    }
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(44 + speedRatio * 34, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, now, 0.08);
  }

  public setMusicMode(mode: 'none' | 'menu' | 'battle') {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (mode === 'none') return;

    const intervalMs = mode === 'battle' ? 240 : 480;
    const menuNotes = [220, 261.6, 329.6, 293.7, 220, 261.6, 392, 329.6];
    const battleNotes = [146.8, 146.8, 220, 174.6, 146.8, 196, 220, 261.6];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted || this.ctx.state !== 'running') return;
      const seq = mode === 'battle' ? battleNotes : menuNotes;
      const freq = seq[this.musicStep % seq.length];
      this.musicStep++;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = mode === 'battle' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const now = this.ctx.currentTime;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(mode === 'battle' ? 0.14 : 0.11, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + (intervalMs / 1000) * 0.9);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + intervalMs / 1000);
    }, intervalMs);
  }

  private tone(startFreq: number, endFreq: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.sfxGain || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    g.gain.setValueAtTime(Math.max(0.001, vol), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  private noise(dur: number, cutoff: number, vol: number) {
    if (!this.ctx || !this.sfxGain || this.muted || this.ctx.state !== 'running') return;
    const sampleCount = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }
}

export const soundEngine = new SoundEngine();
