import { SkinId, ZoneConfig } from './types';

const MENU_VOICE_URLS: Partial<Record<SkinId, string>> = {
  duktur_bocek: '/assets/aistudio/Acilci_Duktur_ana_sayfa_776dfd35.mp3',
};

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceNoise: AudioBufferSourceNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private ambienceTimer: number | null = null;
  private currentAmbience: ZoneConfig['ambienceType'] = 'street_evening';

  private sfxEnabled = true;
  private ambienceEnabled = true;
  private sfxVolume = 0.85;
  private ambienceVolume = 0.75;
  private coinCombo = 0;
  private lastCoinTime = 0;
  private isPlaying = false;
  private menuVoiceElements = new Map<SkinId, HTMLAudioElement>();
  private menuVoiceRawBytes = new Map<SkinId, ArrayBuffer>();
  private menuVoiceFetchPromises = new Map<SkinId, Promise<ArrayBuffer | null>>();
  private menuVoiceBuffers = new Map<SkinId, AudioBuffer>();
  private menuVoiceDecoding = new Set<SkinId>();
  private activeMenuAudioEl: HTMLAudioElement | null = null;
  private activeMenuBufferSrc: AudioBufferSourceNode | null = null;
  private menuVoiceGain: GainNode | null = null;
  private menuVoicePlayToken = 0;

  constructor() {
    this.preloadMenuVoices();
  }

  private preloadMenuVoices(): void {
    if (typeof window === 'undefined') return;
    (Object.entries(MENU_VOICE_URLS) as [SkinId, string][]).forEach(([skinId, url]) => {
      if (!this.menuVoiceElements.has(skinId)) {
        const el = new Audio(url);
        el.preload = 'auto';
        el.load();
        this.menuVoiceElements.set(skinId, el);
      }
      if (!this.menuVoiceFetchPromises.has(skinId) && typeof fetch === 'function') {
        const p = fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .then((buf) => {
            if (!buf) return null;
            this.menuVoiceRawBytes.set(skinId, buf);
            this.decodeMenuVoice(skinId);
            return buf;
          })
          .catch(() => null);
        this.menuVoiceFetchPromises.set(skinId, p);
      }
    });
  }

  private async decodeMenuVoice(skinId: SkinId): Promise<AudioBuffer | null> {
    const existing = this.menuVoiceBuffers.get(skinId);
    if (existing) return existing;
    if (!this.ctx || this.menuVoiceDecoding.has(skinId)) {
      return null;
    }
    let raw = this.menuVoiceRawBytes.get(skinId) ?? null;
    if (!raw) {
      const pending = this.menuVoiceFetchPromises.get(skinId);
      if (pending) {
        raw = await pending;
      }
    }
    if (!raw || !this.ctx) return null;
    const afterWait = this.menuVoiceBuffers.get(skinId);
    if (afterWait) return afterWait;

    this.menuVoiceDecoding.add(skinId);
    try {
      const decoded = await this.ctx.decodeAudioData(raw.slice(0));
      this.menuVoiceBuffers.set(skinId, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      this.menuVoiceDecoding.delete(skinId);
    }
  }

  public configure(opts: {
    sfxEnabled: boolean;
    ambienceEnabled: boolean;
    sfxVolume?: number;
    ambienceVolume?: number;
  }): void {
    this.sfxEnabled = opts.sfxEnabled;
    this.ambienceEnabled = opts.ambienceEnabled;
    if (typeof opts.sfxVolume === 'number') this.sfxVolume = opts.sfxVolume;
    if (typeof opts.ambienceVolume === 'number') this.ambienceVolume = opts.ambienceVolume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.sfxEnabled ? 0.75 * this.sfxVolume : 0,
        this.ctx.currentTime,
        0.08,
      );
    }
    if (this.menuVoiceGain && this.ctx) {
      this.menuVoiceGain.gain.setTargetAtTime(
        this.sfxEnabled ? this.sfxVolume : 0,
        this.ctx.currentTime,
        0.05,
      );
    }
    if (this.activeMenuAudioEl) {
      this.activeMenuAudioEl.volume = this.sfxEnabled ? this.sfxVolume : 0;
    }
    this.updateAmbienceGain();
  }

  public hasMenuVoice(skinId: SkinId): boolean {
    return Boolean(MENU_VOICE_URLS[skinId]);
  }

  private playBufferVoice(buffer: AudioBuffer, targetVol: number, token: number): boolean {
    if (!this.ctx || token !== this.menuVoicePlayToken) return false;
    if (!this.menuVoiceGain) {
      this.menuVoiceGain = this.ctx.createGain();
      this.menuVoiceGain.connect(this.ctx.destination);
    }
    this.menuVoiceGain.gain.setValueAtTime(targetVol, this.ctx.currentTime);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.menuVoiceGain);
    src.onended = () => {
      if (this.activeMenuBufferSrc === src) {
        this.activeMenuBufferSrc = null;
      }
    };
    this.activeMenuBufferSrc = src;
    src.start(0);
    return true;
  }

  public async playMenuCharacterVoice(
    skinId: SkinId,
    opts?: { auto?: boolean },
  ): Promise<'played' | 'blocked' | 'unavailable'> {
    if (typeof window === 'undefined') return 'unavailable';
    const url = MENU_VOICE_URLS[skinId];
    if (!url) return 'unavailable';

    if (opts?.auto && (!this.sfxEnabled || this.sfxVolume <= 0.01)) {
      return 'unavailable';
    }

    if (!opts?.auto) {
      this.unlock();
    }

    this.stopMenuVoice();
    const token = ++this.menuVoicePlayToken;
    const targetVol = this.sfxEnabled ? this.sfxVolume : 0;

    if (this.ctx && this.ctx.state === 'running') {
      const buffer = this.menuVoiceBuffers.get(skinId) ?? (await this.decodeMenuVoice(skinId));
      if (token !== this.menuVoicePlayToken) return 'unavailable';
      if (buffer && this.playBufferVoice(buffer, targetVol, token)) {
        return 'played';
      }
    }

    if (token !== this.menuVoicePlayToken) return 'unavailable';

    if (!opts?.auto) {
      void this.decodeMenuVoice(skinId);
    }

    let audio = this.menuVoiceElements.get(skinId);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      this.menuVoiceElements.set(skinId, audio);
    }
    audio.volume = targetVol;
    if (audio.readyState > 0) {
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    }
    this.activeMenuAudioEl = audio;
    try {
      await audio.play();
      if (token !== this.menuVoicePlayToken) {
        try {
          audio.pause();
        } catch {
          // ignore
        }
        return 'unavailable';
      }
      return 'played';
    } catch {
      if (this.activeMenuAudioEl === audio) {
        this.activeMenuAudioEl = null;
      }
      return 'blocked';
    }
  }

  public stopMenuVoice(): void {
    this.menuVoicePlayToken += 1;
    if (this.activeMenuBufferSrc) {
      try {
        this.activeMenuBufferSrc.stop();
      } catch {
        // ignore
      }
      this.activeMenuBufferSrc = null;
    }
    if (this.activeMenuAudioEl) {
      try {
        this.activeMenuAudioEl.pause();
        if (this.activeMenuAudioEl.readyState > 0) {
          this.activeMenuAudioEl.currentTime = 0;
        }
      } catch {
        // ignore
      }
      this.activeMenuAudioEl = null;
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.sfxEnabled ? 0.75 * this.sfxVolume : 0;
      this.masterGain.connect(this.ctx.destination);

      this.setupAmbienceNodes();
      (Object.keys(MENU_VOICE_URLS) as SkinId[]).forEach((skinId) => {
        this.decodeMenuVoice(skinId);
      });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private setupAmbienceNodes(): void {
    if (!this.ctx || !this.masterGain) return;
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0;
    this.ambienceGain.connect(this.masterGain);

    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.025 * white) / 1.025;
      lastOut = data[i];
      data[i] *= 1.8;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;

    noise.connect(filter);
    filter.connect(this.ambienceGain);
    noise.start();

    this.ambienceNoise = noise;
    this.ambienceFilter = filter;

    this.startAmbienceEvents();
  }

  private startAmbienceEvents(): void {
    if (this.ambienceTimer !== null) {
      window.clearInterval(this.ambienceTimer);
    }
    this.ambienceTimer = window.setInterval(() => {
      if (
        !this.isPlaying ||
        !this.ambienceEnabled ||
        !this.ctx ||
        this.ctx.state !== 'running'
      ) {
        return;
      }
      const roll = Math.random();
      switch (this.currentAmbience) {
        case 'street_evening':
          if (roll < 0.32) this.playDistantHorn();
          else if (roll < 0.6) this.playCarPassWhoosh();
          break;
        case 'earth_cavern':
          if (roll < 0.5) this.playCricketChirp();
          break;
        case 'ice_wind':
          if (roll < 0.65) this.playCarPassWhoosh();
          break;
        case 'fire_volcano':
          if (roll < 0.45) this.playDistantSiren();
          else if (roll < 0.7) this.playCarPassWhoosh();
          break;
        case 'kitchen_clatter':
          if (roll < 0.5) this.playKitchenClink();
          break;
        case 'bath_bubbles':
          if (roll < 0.6) this.playBubblePop();
          break;
        case 'lab_hum':
          if (roll < 0.5) this.playLabBlip();
          break;
        case 'space_synth':
          if (roll < 0.55) this.playSpaceShimmer();
          break;
      }
    }, 2400);
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    if (playing) {
      this.stopMenuVoice();
    }
    this.updateAmbienceGain();
  }

  public setZoneAmbience(type: ZoneConfig['ambienceType']): void {
    this.currentAmbience = type;
    if (!this.ctx || !this.ambienceFilter) return;
    const freqMap: Record<ZoneConfig['ambienceType'], number> = {
      street_evening: 340,
      earth_cavern: 170,
      ice_wind: 740,
      fire_volcano: 260,
      kitchen_clatter: 480,
      bath_bubbles: 560,
      lab_hum: 220,
      space_synth: 410,
    };
    this.ambienceFilter.frequency.setTargetAtTime(
      freqMap[type],
      this.ctx.currentTime,
      0.4,
    );
  }

  private updateAmbienceGain(): void {
    if (!this.ctx || !this.ambienceGain) return;
    const target =
      this.isPlaying && this.ambienceEnabled ? 0.09 * this.ambienceVolume : 0;
    this.ambienceGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  private playCarPassWhoosh(): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    this.ambienceGain.gain.setValueAtTime(0.08, now);
    this.ambienceGain.gain.linearRampToValueAtTime(0.16, now + 0.35);
    this.ambienceGain.gain.linearRampToValueAtTime(0.08, now + 0.9);
  }

  private playCricketChirp(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.065;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4200 + Math.random() * 150, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.028, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  private playDistantHorn(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [340, 425].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 680;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.025, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.27);
    });
  }

  private playBikeBell(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [0, 0.11].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2600, t);
      g.gain.setValueAtTime(0.032, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  private playDistantSiren(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(840, now + 0.35);
    osc.frequency.linearRampToValueAtTime(620, now + 0.7);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.025, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.74);
  }

  private playKitchenClink(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [1480, 2120].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq + Math.random() * 120, t);
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  private playBubblePop(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const startF = 380 + Math.random() * 240;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(startF * 2.2, now + 0.09);
    g.gain.setValueAtTime(0.032, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  private playLabBlip(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [880, 1174].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.022, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  private playSpaceShimmer(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.linearRampToValueAtTime(783.99, now + 0.45);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.028, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  public playCoin(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCoinTime < 0.45) {
      this.coinCombo = Math.min(this.coinCombo + 1, 10);
    } else {
      this.coinCombo = 0;
    }
    this.lastCoinTime = now;

    const baseFreq = 860 + this.coinCombo * 52;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.08);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playLaneSwitch(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.045);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playJump(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playSlide(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(105, now + 0.14);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 560;
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playTrafficWarning(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [0, 0.14].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, t);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 780;
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  public playPowerup(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  public playShieldBreak(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [1400, 1900, 1100].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.03;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  public playZoneTransition(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playSpringLaunch(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.28);
    g.gain.setValueAtTime(0.19, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playWingsFlap(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [0, 0.1].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 480 : 640, t);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 780 : 980, t + 0.14);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playStumble(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playNewRecord(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    fanfare.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.065;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playCrash(): void {
    if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.42);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 580;
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public dispose(): void {
    this.stopMenuVoice();
    this.menuVoiceElements.clear();
    this.menuVoiceRawBytes.clear();
    this.menuVoiceFetchPromises.clear();
    this.menuVoiceBuffers.clear();
    if (this.ambienceTimer !== null) {
      window.clearInterval(this.ambienceTimer);
      this.ambienceTimer = null;
    }
    try {
      this.ambienceNoise?.stop();
    } catch {
      // ignore
    }
    try {
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}

export const gameAudio = new GameAudioEngine();
