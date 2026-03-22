import type { AppSettings, ModeSecondsMap, TimerMode, TimerState } from "@/app/types";
import { getNextMicroBreakIndex } from "@/domain/timer/micro-breaks";
import { createModeSecondsMap, getModeSecondsForSettings } from "@/domain/settings/settings-service";
import { getTodayKey } from "@/utils/date";
import { clampNumber } from "@/utils/math";

export function createInitialTimerState(settings: AppSettings): TimerState {
  const remainingByMode = createModeSecondsMap(settings);

  return {
    mode: "pomodoro",
    remainingSeconds: remainingByMode.pomodoro,
    remainingByMode,
    isRunning: false,
    isTimeHidden: false,
    activeMicroBreak: null,
    nextMicroBreakIndex: 0,
    completedPomodoros: 0,
    completedDate: getTodayKey(),
    targetTime: null,
  };
}

export function clampModeRemaining(mode: TimerMode, value: unknown, settings: AppSettings): number {
  return Math.min(
    getModeSecondsForSettings(mode, settings),
    clampNumber(value, getModeSecondsForSettings(mode, settings), 0, 60 * 60 * 8),
  );
}

export function setModeRemaining(state: TimerState, mode: TimerMode, seconds: number, settings: AppSettings): void {
  state.remainingByMode[mode] = clampModeRemaining(mode, seconds, settings);

  if (state.mode === mode) {
    state.remainingSeconds = state.remainingByMode[mode];
  }
}

export function syncCurrentModeRemaining(state: TimerState, settings: AppSettings): void {
  setModeRemaining(state, state.mode, state.remainingSeconds, settings);
}

export function resetModeRemaining(state: TimerState, mode: TimerMode, settings: AppSettings): void {
  setModeRemaining(state, mode, getModeSecondsForSettings(mode, settings), settings);
}

export function resetAllModeRemaining(state: TimerState, settings: AppSettings): void {
  state.remainingByMode = createModeSecondsMap(settings);
  state.remainingSeconds = state.remainingByMode[state.mode];
}

export function syncNextMicroBreakIndex(state: TimerState, settings: AppSettings): void {
  if (state.mode !== "pomodoro") {
    state.nextMicroBreakIndex = 0;
    return;
  }

  if (state.activeMicroBreak) {
    return;
  }

  state.nextMicroBreakIndex = getNextMicroBreakIndex(state, settings);
}

export function cloneModeSecondsMap(map: ModeSecondsMap): ModeSecondsMap {
  return {
    pomodoro: map.pomodoro,
    shortBreak: map.shortBreak,
    longBreak: map.longBreak,
  };
}
