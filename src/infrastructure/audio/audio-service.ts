import type { ToneDefinition } from "@/app/types";

export class AudioService {
  private audioContext: AudioContext | null = null;

  public playStart(): void {
    this.playToneSequence([
      { frequency: 660, duration: 0.09, gap: 0.02, volume: 0.035, type: "triangle" },
      { frequency: 880, duration: 0.12, volume: 0.045, type: "triangle" },
    ]);
  }

  public playPause(): void {
    this.playToneSequence([
      { frequency: 520, duration: 0.08, gap: 0.015, volume: 0.03, type: "sine" },
      { frequency: 400, duration: 0.1, volume: 0.035, type: "sine" },
    ]);
  }

  public playComplete(): void {
    this.playToneSequence([
      { frequency: 784, duration: 0.12, gap: 0.025, volume: 0.04, type: "triangle" },
      { frequency: 988, duration: 0.12, gap: 0.025, volume: 0.045, type: "triangle" },
      { frequency: 1174, duration: 0.24, volume: 0.05, type: "triangle" },
    ]);
  }

  public playMicroBreakStart(): void {
    this.playToneSequence([
      { frequency: 740, duration: 0.09, gap: 0.03, volume: 0.04, type: "sine" },
      { frequency: 740, duration: 0.09, volume: 0.04, type: "sine" },
    ]);
  }

  public playMicroBreakEnd(): void {
    this.playToneSequence([
      { frequency: 932, duration: 0.1, gap: 0.03, volume: 0.04, type: "triangle" },
      { frequency: 1174, duration: 0.13, volume: 0.045, type: "triangle" },
    ]);
  }

  public startCompletionAlarmLoop(): number | null {
    if (!this.getAudioContext()) {
      return null;
    }

    this.playComplete();
    return window.setInterval(() => {
      this.playComplete();
    }, 1600);
  }

  public stopCompletionAlarmLoop(alarmId: number | null): void {
    if (alarmId === null) {
      return;
    }

    window.clearInterval(alarmId);
  }

  private getAudioContext(): AudioContext | null {
    const legacyWindow = window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor = window.AudioContext || legacyWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextCtor();
    }

    return this.audioContext;
  }

  private playToneSequence(sequence: ToneDefinition[]): void {
    const context = this.getAudioContext();

    if (!context) {
      return;
    }

    const startAt = Math.max(context.currentTime, 0.01);

    if (context.state === "suspended") {
      context.resume().catch(() => undefined);
    }

    sequence.reduce((offset, tone) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const toneStart = startAt + offset;
      const attack = Math.min(0.02, tone.duration / 3);
      const releaseStart = tone.duration * 0.65;

      oscillator.type = tone.type ?? "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, toneStart);

      gainNode.gain.setValueAtTime(0.0001, toneStart);
      gainNode.gain.exponentialRampToValueAtTime(tone.volume ?? 0.05, toneStart + attack);
      gainNode.gain.setValueAtTime(tone.volume ?? 0.05, toneStart + releaseStart);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, toneStart + tone.duration);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneStart + tone.duration);

      return offset + tone.duration + (tone.gap ?? 0);
    }, 0);
  }
}
