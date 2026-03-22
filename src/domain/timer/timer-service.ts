import type {
  AppSettings,
  HydrationResult,
  PauseResult,
  StartResult,
  StoredTimerState,
  TickResult,
  TimerMode,
  TimerState,
} from "@/app/types";
import { getModeSecondsForSettings } from "@/domain/settings/settings-service";
import { getCurrentMicroBreakRemaining, getMicroBreakLabel, getMicroBreakSchedule } from "@/domain/timer/micro-breaks";
import {
  cloneModeSecondsMap,
  createInitialTimerState,
  resetAllModeRemaining,
  resetModeRemaining,
  setModeRemaining,
  syncCurrentModeRemaining,
  syncNextMicroBreakIndex,
} from "@/domain/timer/timer-engine";
import { getTodayKey, toDateKey } from "@/utils/date";
import { getRemainingMilliseconds } from "@/utils/time";

export class TimerService {
  private settings: AppSettings;
  private state: TimerState;

  public constructor(settings: AppSettings, private readonly now: () => number = () => Date.now()) {
    this.settings = { ...settings };
    this.state = createInitialTimerState(this.settings);
  }

  public getState(): TimerState {
    return this.state;
  }

  public getModeSeconds(mode: TimerMode): number {
    return getModeSecondsForSettings(mode, this.settings);
  }

  public replaceSettings(settings: AppSettings): void {
    this.settings = { ...settings };
    this.state.isRunning = false;
    this.state.targetTime = null;
    this.state.activeMicroBreak = null;
    this.state.nextMicroBreakIndex = 0;
    resetAllModeRemaining(this.state, this.settings);
  }

  public hydrate(snapshot: StoredTimerState | null): HydrationResult {
    this.state = createInitialTimerState(this.settings);

    if (!snapshot) {
      return {
        shouldResumeTicker: false,
        recoveredCompletion: null,
      };
    }

    this.state.mode = snapshot.mode;
    this.state.remainingByMode = cloneModeSecondsMap(snapshot.remainingByMode as TimerState["remainingByMode"]);
    this.state.isTimeHidden = snapshot.isTimeHidden;
    this.state.nextMicroBreakIndex = snapshot.nextMicroBreakIndex;
    this.state.completedPomodoros = snapshot.completedPomodoros;
    this.state.completedDate = snapshot.completedDate;
    this.state.activeMicroBreak = snapshot.activeMicroBreak ? { ...snapshot.activeMicroBreak } : null;
    this.state.targetTime = null;
    this.state.isRunning = false;

    if (this.state.activeMicroBreak) {
      if (this.state.activeMicroBreak.endsAt > this.now()) {
        this.state.remainingSeconds = this.state.activeMicroBreak.resumeRemainingSeconds;
        return {
          shouldResumeTicker: true,
          recoveredCompletion: null,
        };
      }

      this.state.activeMicroBreak = null;
    }

    this.state.remainingSeconds = this.state.remainingByMode[this.state.mode];

    if (snapshot.isRunning && typeof snapshot.targetTime === "number") {
      if (snapshot.targetTime > this.now()) {
        this.state.targetTime = snapshot.targetTime;
        this.state.isRunning = true;
        this.syncRemainingTime();
        return {
          shouldResumeTicker: true,
          recoveredCompletion: null,
        };
      }

      this.state.remainingSeconds = 0;
      setModeRemaining(this.state, snapshot.mode, 0, this.settings);

      return {
        shouldResumeTicker: false,
        recoveredCompletion: {
          completedMode: snapshot.mode,
          completedDateKey: toDateKey(new Date(snapshot.targetTime)),
        },
      };
    }

    syncNextMicroBreakIndex(this.state, this.settings);

    return {
      shouldResumeTicker: false,
      recoveredCompletion: null,
    };
  }

  public syncDailyCount(dateKey: string = getTodayKey()): boolean {
    if (this.state.completedDate === dateKey) {
      return false;
    }

    this.state.completedDate = dateKey;
    this.state.completedPomodoros = 0;
    return true;
  }

  public registerPomodoroCompletion(dateKey: string = getTodayKey()): number {
    if (this.state.completedDate !== dateKey) {
      this.state.completedDate = dateKey;
      this.state.completedPomodoros = 0;
    }

    this.state.completedPomodoros += 1;
    return this.state.completedPomodoros;
  }

  public getCurrentMicroBreakRemaining(): number {
    return getCurrentMicroBreakRemaining(this.state.activeMicroBreak, this.now());
  }

  public syncRemainingTime(now: number = this.now()): number {
    if (!this.state.isRunning || !this.state.targetTime) {
      return 0;
    }

    const remainingMilliseconds = getRemainingMilliseconds(this.state.targetTime, now);
    const secondsLeft = remainingMilliseconds <= 0 ? 0 : Math.ceil(remainingMilliseconds / 1000);
    this.state.remainingSeconds = secondsLeft;
    syncCurrentModeRemaining(this.state, this.settings);
    return remainingMilliseconds;
  }

  public start(): StartResult {
    if (this.state.activeMicroBreak) {
      this.completeMicroBreak();
      return "micro-break-ended";
    }

    if (this.state.isRunning) {
      return "noop";
    }

    if (this.state.mode === "pomodoro" && this.state.remainingSeconds === this.getModeSeconds("pomodoro")) {
      this.state.nextMicroBreakIndex = 0;
    } else if (this.state.mode === "pomodoro") {
      syncNextMicroBreakIndex(this.state, this.settings);
    }

    this.state.isRunning = true;
    this.state.targetTime = this.now() + this.state.remainingSeconds * 1000;
    return "started";
  }

  public pause(): PauseResult {
    if (this.state.activeMicroBreak) {
      this.state.activeMicroBreak = null;
      this.state.remainingSeconds = this.state.remainingByMode[this.state.mode];
      syncNextMicroBreakIndex(this.state, this.settings);
      return "cancelled-micro-break";
    }

    if (!this.state.isRunning) {
      return "noop";
    }

    this.syncRemainingTime();
    this.state.targetTime = null;
    this.state.isRunning = false;
    return "paused";
  }

  public switchMode(mode: TimerMode): void {
    this.syncRemainingTime();
    syncCurrentModeRemaining(this.state, this.settings);
    this.state.isRunning = false;
    this.state.targetTime = null;
    this.state.activeMicroBreak = null;
    this.state.mode = mode;
    this.state.remainingSeconds = this.state.remainingByMode[mode];
    syncNextMicroBreakIndex(this.state, this.settings);
  }

  public resetCurrentMode(): void {
    this.state.isRunning = false;
    this.state.targetTime = null;
    this.state.activeMicroBreak = null;
    resetModeRemaining(this.state, this.state.mode, this.settings);
    syncNextMicroBreakIndex(this.state, this.settings);
  }

  public toggleFocusMode(): void {
    this.state.isTimeHidden = !this.state.isTimeHidden;
  }

  public applyCompletionTransition(completedMode: TimerMode, nextMode: TimerMode): void {
    resetModeRemaining(this.state, completedMode, this.settings);
    resetModeRemaining(this.state, nextMode, this.settings);
    this.switchMode(nextMode);
  }

  public tick(): TickResult {
    if (this.state.activeMicroBreak) {
      if (getCurrentMicroBreakRemaining(this.state.activeMicroBreak, this.now()) <= 0) {
        this.completeMicroBreak();
        return { type: "micro-break-ended" };
      }

      return { type: "none" };
    }

    const remainingMilliseconds = this.syncRemainingTime();

    if (this.maybeTriggerMicroBreak()) {
      return { type: "micro-break-started" };
    }

    if (remainingMilliseconds <= 0 || this.state.remainingSeconds <= 0) {
      const completedMode = this.state.mode;
      this.state.isRunning = false;
      this.state.targetTime = null;
      this.state.remainingSeconds = 0;
      setModeRemaining(this.state, completedMode, 0, this.settings);
      return { type: "completed", completedMode };
    }

    return { type: "none" };
  }

  private maybeTriggerMicroBreak(): boolean {
    if (!this.state.isRunning || this.state.mode !== "pomodoro" || this.state.activeMicroBreak) {
      return false;
    }

    const schedule = getMicroBreakSchedule(this.state.mode, this.settings);
    const nextBreak = schedule[this.state.nextMicroBreakIndex];

    if (!nextBreak) {
      return false;
    }

    const elapsedSeconds = this.getModeSeconds("pomodoro") - this.state.remainingSeconds;

    if (elapsedSeconds < nextBreak.triggerSeconds) {
      return false;
    }

    this.state.isRunning = false;
    this.state.targetTime = null;
    this.state.activeMicroBreak = {
      endsAt: this.now() + nextBreak.durationSeconds * 1000,
      resumeRemainingSeconds: this.state.remainingSeconds,
      label: getMicroBreakLabel(this.state.nextMicroBreakIndex, this.settings),
    };
    this.state.nextMicroBreakIndex += 1;
    return true;
  }

  private completeMicroBreak(): void {
    if (!this.state.activeMicroBreak) {
      return;
    }

    const resumeRemainingSeconds = this.state.activeMicroBreak.resumeRemainingSeconds;
    this.state.activeMicroBreak = null;
    this.state.remainingSeconds = resumeRemainingSeconds;
    this.state.isRunning = true;
    this.state.targetTime = this.now() + resumeRemainingSeconds * 1000;
    syncCurrentModeRemaining(this.state, this.settings);
  }
}
