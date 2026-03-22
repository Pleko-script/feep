import type { TimerMode } from "@/app/types";

export interface AppElements {
  timerDisplay: HTMLElement;
  timerStatus: HTMLElement;
  timerStatusLabel: HTMLElement;
  modeCaption: HTMLElement;
  progressRail: HTMLElement;
  progressBar: HTMLElement;
  startPauseBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  toggleFocusModeBtn: HTMLButtonElement;
  modeTabs: HTMLButtonElement[];
  openReportBtn: HTMLButtonElement;
  openSettingsBtn: HTMLButtonElement;
  reportModal: HTMLElement;
  completionModal: HTMLElement;
  completionTitle: HTMLElement;
  completionMessage: HTMLElement;
  completionOkBtn: HTMLButtonElement;
  settingsModal: HTMLElement;
  hoursFocused: HTMLElement;
  daysAccessed: HTMLElement;
  dayStreak: HTMLElement;
  rangeTabs: HTMLButtonElement[];
  periodLabel: HTMLElement;
  periodPrev: HTMLButtonElement;
  periodNext: HTMLButtonElement;
  chartGrid: HTMLElement;
  settingsForm: HTMLFormElement;
  settingsPomodoro: HTMLInputElement;
  settingsShortBreak: HTMLInputElement;
  settingsLongBreak: HTMLInputElement;
  microBreakSettings: HTMLElement;
  settingsMicroBreaksEnabled: HTMLInputElement;
  settingsMicroBreaksState: HTMLElement;
  settingsMicroBreakVariant: HTMLSelectElement;
  settingsResetDefaults: HTMLButtonElement;
}

export function getAppElements(doc: Document = document): AppElements {
  return {
    timerDisplay: queryRequired<HTMLElement>(doc, "#timer-display"),
    timerStatus: queryRequired<HTMLElement>(doc, "#timer-status"),
    timerStatusLabel: queryRequired<HTMLElement>(doc, "#timer-status-label"),
    modeCaption: queryRequired<HTMLElement>(doc, "#mode-caption"),
    progressRail: queryRequired<HTMLElement>(doc, "#progress-rail"),
    progressBar: queryRequired<HTMLElement>(doc, "#progress-bar"),
    startPauseBtn: queryRequired<HTMLButtonElement>(doc, "#start-pause-btn"),
    resetBtn: queryRequired<HTMLButtonElement>(doc, "#reset-btn"),
    toggleFocusModeBtn: queryRequired<HTMLButtonElement>(doc, "#toggle-focus-mode-btn"),
    modeTabs: queryAllRequired<HTMLButtonElement>(doc, ".mode-tab"),
    openReportBtn: queryRequired<HTMLButtonElement>(doc, "#open-report-btn"),
    openSettingsBtn: queryRequired<HTMLButtonElement>(doc, "#open-settings-btn"),
    reportModal: queryRequired<HTMLElement>(doc, "#report-modal"),
    completionModal: queryRequired<HTMLElement>(doc, "#completion-modal"),
    completionTitle: queryRequired<HTMLElement>(doc, "#completion-title"),
    completionMessage: queryRequired<HTMLElement>(doc, "#completion-message"),
    completionOkBtn: queryRequired<HTMLButtonElement>(doc, "#completion-ok-btn"),
    settingsModal: queryRequired<HTMLElement>(doc, "#settings-modal"),
    hoursFocused: queryRequired<HTMLElement>(doc, "#hours-focused"),
    daysAccessed: queryRequired<HTMLElement>(doc, "#days-accessed"),
    dayStreak: queryRequired<HTMLElement>(doc, "#day-streak"),
    rangeTabs: queryAllRequired<HTMLButtonElement>(doc, ".range-tab"),
    periodLabel: queryRequired<HTMLElement>(doc, "#period-label"),
    periodPrev: queryRequired<HTMLButtonElement>(doc, "#period-prev"),
    periodNext: queryRequired<HTMLButtonElement>(doc, "#period-next"),
    chartGrid: queryRequired<HTMLElement>(doc, "#chart-grid"),
    settingsForm: queryRequired<HTMLFormElement>(doc, "#settings-form"),
    settingsPomodoro: queryRequired<HTMLInputElement>(doc, "#settings-pomodoro"),
    settingsShortBreak: queryRequired<HTMLInputElement>(doc, "#settings-short-break"),
    settingsLongBreak: queryRequired<HTMLInputElement>(doc, "#settings-long-break"),
    microBreakSettings: queryRequired<HTMLElement>(doc, "#micro-break-settings"),
    settingsMicroBreaksEnabled: queryRequired<HTMLInputElement>(doc, "#settings-micro-breaks-enabled"),
    settingsMicroBreaksState: queryRequired<HTMLElement>(doc, "#settings-micro-breaks-state"),
    settingsMicroBreakVariant: queryRequired<HTMLSelectElement>(doc, "#settings-micro-break-variant"),
    settingsResetDefaults: queryRequired<HTMLButtonElement>(doc, "#settings-reset-defaults"),
  };
}

export function getModeFromButton(button: HTMLButtonElement): TimerMode {
  const mode = button.dataset.mode;

  if (mode === "pomodoro" || mode === "shortBreak" || mode === "longBreak") {
    return mode;
  }

  throw new Error("Unknown timer mode button");
}

function queryRequired<TElement extends Element>(doc: Document, selector: string): TElement {
  const element = doc.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element as TElement;
}

function queryAllRequired<TElement extends Element>(doc: Document, selector: string): TElement[] {
  const elements = Array.from(doc.querySelectorAll(selector)) as TElement[];

  if (elements.length === 0) {
    throw new Error(`Missing required elements: ${selector}`);
  }

  return elements;
}
