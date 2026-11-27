// Gentle retro Web Audio synthesizer — zero external audio dependencies, never auto-plays

class RetroSoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(next: boolean): void {
    this.enabled = next;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playTone(params: {
    freq: number;
    endFreq?: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
  }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + (params.delay ?? 0);
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = params.type ?? 'triangle';
      osc.frequency.setValueAtTime(params.freq, start);
      if (params.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(40, params.endFreq),
          start + params.duration
        );
      }
      const peak = params.gain ?? 0.08;
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.linearRampToValueAtTime(peak, start + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + params.duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + params.duration + 0.02);
    } catch {
      // Ignore audio errors when context is blocked
    }
  }

  public playSelect(): void {
    this.playTone({ freq: 520, endFreq: 660, duration: 0.06, type: 'sine', gain: 0.055 });
  }

  public playDeselect(): void {
    this.playTone({ freq: 440, endFreq: 340, duration: 0.055, type: 'sine', gain: 0.04 });
  }

  public playMatch(combo = 1): void {
    const boost = Math.min(combo - 1, 8) * 32;
    this.playTone({
      freq: 523.25 + boost,
      duration: 0.085,
      type: 'triangle',
      gain: 0.075,
      delay: 0,
    });
    this.playTone({
      freq: 783.99 + boost,
      duration: 0.14,
      type: 'triangle',
      gain: 0.08,
      delay: 0.065,
    });
  }

  public playMismatch(): void {
    this.playTone({ freq: 210, endFreq: 155, duration: 0.13, type: 'triangle', gain: 0.065 });
  }

  public playHint(): void {
    this.playTone({ freq: 659.25, duration: 0.08, type: 'sine', gain: 0.06, delay: 0 });
    this.playTone({ freq: 880, duration: 0.14, type: 'sine', gain: 0.065, delay: 0.07 });
  }

  public playShuffle(): void {
    const notes = [392, 493.88, 587.33];
    notes.forEach((freq, idx) => {
      this.playTone({ freq, duration: 0.07, type: 'sine', gain: 0.05, delay: idx * 0.045 });
    });
  }

  public playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone({
        freq,
        duration: idx === notes.length - 1 ? 0.34 : 0.11,
        type: 'triangle',
        gain: 0.08,
        delay: idx * 0.095,
      });
    });
  }

  public playGameOver(): void {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      this.playTone({
        freq,
        duration: idx === notes.length - 1 ? 0.28 : 0.12,
        type: 'sine',
        gain: 0.065,
        delay: idx * 0.11,
      });
    });
  }
}

export const soundManager = new RetroSoundManager();
