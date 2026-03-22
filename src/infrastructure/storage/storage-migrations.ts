import type { ActiveMicroBreak, AnalyticsState, AppSettings, StoredAnalyticsState, StoredTimerState, TimerMode } from "@/app/types";
import { DEFAULT_SETTINGS } from "@/app/constants";
import { normalizeSettings } from "@/domain/settings/settings-service";
import { clampModeRemaining } from "@/domain/timer/timer-engine";
import { getTodayKey } from "@/utils/date";
import { clampNumber } from "@/utils/math";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimerMode(value: unknown): value is TimerMode {
  return value === "pomodoro" || value === "shortBreak" || value === "longBreak";
}

export function parseStoredJson(rawValue: string | null): unknown {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

export function normalizeStoredSettings(rawValue: unknown): AppSettings {
  if (!isRecord(rawValue)) {
    return { ...DEFAULT_SETTINGS };
  }

  return normalizeSettings({
    pomodoro: rawValue.pomodoro as number | undefined,
    shortBreak: rawValue.shortBreak as number | undefined,
    longBreak: rawValue.longBreak as number | undefined,
    microBreaksEnabled: rawValue.microBreaksEnabled as boolean | undefined,
    microBreakVariant: rawValue.microBreakVariant as AppSettings["microBreakVariant"] | undefined,
  });
}

export function normalizeStoredAnalytics(rawValue: unknown): AnalyticsState {
  if (!isRecord(rawValue) || !isRecord(rawValue.daily)) {
    return { daily: {} };
  }

  const daily = Object.fromEntries(
    Object.entries(rawValue.daily).map(([dateKey, entryValue]) => {
      if (!isRecord(entryValue)) {
        return [dateKey, { focusedSeconds: 0, accessed: false }];
      }

      return [
        dateKey,
        {
          focusedSeconds: clampNumber(
            entryValue.focusedSeconds ?? entryValue.focusSeconds,
            0,
            0,
            60 * 60 * 24 * 365,
          ),
          accessed: Boolean(entryValue.accessed),
        },
      ];
    }),
  );

  return { daily };
}

export function normalizeStoredTimerState(rawValue: unknown, settings: AppSettings): StoredTimerState | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  const mode: TimerMode = isTimerMode(rawValue.mode) ? rawValue.mode : "pomodoro";
  const remainingByMode = isRecord(rawValue.remainingByMode) ? rawValue.remainingByMode : {};
  const remainingSeconds = clampModeRemaining(
    mode,
    rawValue.remainingSeconds ?? remainingByMode[mode] ?? settings[mode] * 60,
    settings,
  );

  return {
    mode,
    remainingSeconds,
    remainingByMode: {
      pomodoro: clampModeRemaining("pomodoro", remainingByMode.pomodoro ?? (mode === "pomodoro" ? remainingSeconds : settings.pomodoro * 60), settings),
      shortBreak: clampModeRemaining("shortBreak", remainingByMode.shortBreak ?? (mode === "shortBreak" ? remainingSeconds : settings.shortBreak * 60), settings),
      longBreak: clampModeRemaining("longBreak", remainingByMode.longBreak ?? (mode === "longBreak" ? remainingSeconds : settings.longBreak * 60), settings),
    },
    isRunning: Boolean(rawValue.isRunning),
    isTimeHidden: Boolean(rawValue.isTimeHidden),
    activeMicroBreak: normalizeActiveMicroBreak(rawValue.activeMicroBreak, settings),
    nextMicroBreakIndex: clampNumber(rawValue.nextMicroBreakIndex, 0, 0, 16),
    completedPomodoros: clampNumber(rawValue.completedPomodoros, 0, 0, 999),
    completedDate: typeof rawValue.completedDate === "string" ? rawValue.completedDate : getTodayKey(),
    targetTime: typeof rawValue.targetTime === "number" ? rawValue.targetTime : null,
  };
}

function normalizeActiveMicroBreak(rawValue: unknown, settings: AppSettings): ActiveMicroBreak | null {
  if (!isRecord(rawValue) || typeof rawValue.endsAt !== "number" || typeof rawValue.resumeRemainingSeconds !== "number") {
    return null;
  }

  return {
    endsAt: rawValue.endsAt,
    resumeRemainingSeconds: clampModeRemaining("pomodoro", rawValue.resumeRemainingSeconds, settings),
    label: rawValue.label === "B1" || rawValue.label === "B2" ? rawValue.label : "A",
  };
}
