import type { CompletionPrompt, TimerMode } from "@/app/types";
import { MODES } from "@/app/constants";

export function resolveCompletion(completedMode: TimerMode, completedPomodoros: number): CompletionPrompt {
  if (completedMode === "pomodoro") {
    const nextMode: TimerMode = completedPomodoros % 4 === 0 ? "longBreak" : "shortBreak";

    return {
      completedMode,
      nextMode,
      title: "Pomodoro abgeschlossen",
      message: `${MODES[nextMode].label} ist bereit. Bestaetige mit OK.`,
      notificationTitle: "Pomodoro abgeschlossen",
      notificationBody: `${MODES[nextMode].label} ist bereit.`,
    };
  }

  return {
    completedMode,
    nextMode: "pomodoro",
    title: "Pause beendet",
    message: "Die naechste Fokuszeit ist bereit. Bestaetige mit OK.",
    notificationTitle: "Pause beendet",
    notificationBody: "Die naechste Fokuszeit ist bereit.",
  };
}
