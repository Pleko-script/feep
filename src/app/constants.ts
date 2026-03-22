import type { AppSettings, ModeDescriptor, ReportState, TimerMode, UIState } from "@/app/types";

export const MODES: Record<TimerMode, ModeDescriptor> = {
  pomodoro: {
    label: "Pomodoro",
    caption: "Fokuszeit",
    message: "Zeit zum Fokussieren.",
  },
  shortBreak: {
    label: "Kurze Pause",
    caption: "Kurz erholen",
    message: "Kurz durchatmen und Schultern lockern.",
  },
  longBreak: {
    label: "Lange Pause",
    caption: "Richtig abschalten",
    message: "Grosse Pause verdient. Einmal richtig abschalten.",
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  microBreaksEnabled: false,
  microBreakVariant: "A",
};

export const DEFAULT_REPORT_STATE: ReportState = {
  range: "week",
  offset: 0,
};

export const DEFAULT_UI_STATE: UIState = {
  openModal: null,
  pendingCompletion: null,
  completionAlarmId: null,
};
