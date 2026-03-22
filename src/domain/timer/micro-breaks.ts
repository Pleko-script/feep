import type { ActiveMicroBreak, AppSettings, MicroBreakLabel, MicroBreakScheduleItem, TimerMode, TimerState } from "@/app/types";
import { getModeSecondsForSettings } from "@/domain/settings/settings-service";

export function getMicroBreakSchedule(mode: TimerMode, settings: AppSettings): MicroBreakScheduleItem[] {
  if (mode !== "pomodoro" || !settings.microBreaksEnabled) {
    return [];
  }

  const pomodoroSeconds = getModeSecondsForSettings("pomodoro", settings);
  const variantADuration = Math.min(60, Math.max(20, Math.round(pomodoroSeconds * 0.02)));
  const variantBDuration = Math.min(45, Math.max(20, Math.round(pomodoroSeconds * 0.015)));

  if (settings.microBreakVariant === "B") {
    return [
      { triggerSeconds: Math.round(pomodoroSeconds * 0.4), durationSeconds: variantBDuration },
      { triggerSeconds: Math.round(pomodoroSeconds * 0.78), durationSeconds: variantBDuration },
    ].filter((item, index, items) => item.triggerSeconds > 0 && (index === 0 || item.triggerSeconds > items[index - 1].triggerSeconds));
  }

  return [{ triggerSeconds: Math.round(pomodoroSeconds * 0.5), durationSeconds: variantADuration }];
}

export function getCurrentMicroBreakRemaining(activeMicroBreak: ActiveMicroBreak | null, now: number): number {
  if (!activeMicroBreak?.endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((activeMicroBreak.endsAt - now) / 1000));
}

export function getMicroBreakLabel(index: number, settings: AppSettings): MicroBreakLabel {
  if (settings.microBreakVariant === "B") {
    return index === 0 ? "B1" : "B2";
  }

  return "A";
}

export function getNextMicroBreakIndex(state: TimerState, settings: AppSettings): number {
  if (state.mode !== "pomodoro" || state.activeMicroBreak) {
    return 0;
  }

  const elapsedSeconds = getModeSecondsForSettings("pomodoro", settings) - state.remainingSeconds;
  return getMicroBreakSchedule("pomodoro", settings).filter((item) => elapsedSeconds >= item.triggerSeconds).length;
}
