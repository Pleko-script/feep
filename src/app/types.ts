export type TimerMode = "pomodoro" | "shortBreak" | "longBreak";
export type MicroBreakVariant = "A" | "B";
export type MicroBreakLabel = "A" | "B1" | "B2";
export type ReportRange = "week" | "month" | "year";
export type OpenModal = "report" | "settings" | "completion" | null;
export type TimerStatusState = "running" | "paused" | "micro-break";

export interface ModeDescriptor {
  label: string;
  caption: string;
  message: string;
}

export interface AppSettings {
  pomodoro: number;
  shortBreak: number;
  longBreak: number;
  microBreaksEnabled: boolean;
  microBreakVariant: MicroBreakVariant;
}

export interface MicroBreakScheduleItem {
  triggerSeconds: number;
  durationSeconds: number;
}

export interface ActiveMicroBreak {
  endsAt: number;
  resumeRemainingSeconds: number;
  label: MicroBreakLabel;
}

export type ModeSecondsMap = Record<TimerMode, number>;

export interface TimerState {
  mode: TimerMode;
  remainingSeconds: number;
  remainingByMode: ModeSecondsMap;
  isRunning: boolean;
  isTimeHidden: boolean;
  activeMicroBreak: ActiveMicroBreak | null;
  nextMicroBreakIndex: number;
  completedPomodoros: number;
  completedDate: string;
  targetTime: number | null;
}

export interface CompletionPrompt {
  completedMode: TimerMode;
  nextMode: TimerMode;
  title: string;
  message: string;
  notificationTitle: string;
  notificationBody: string;
}

export interface UIState {
  openModal: OpenModal;
  pendingCompletion: CompletionPrompt | null;
  completionAlarmId: number | null;
}

export interface ReportState {
  range: ReportRange;
  offset: number;
}

export interface AnalyticsEntry {
  focusedSeconds: number;
  accessed: boolean;
}

export interface AnalyticsState {
  daily: Record<string, AnalyticsEntry>;
}

export interface ChartPoint {
  key: string;
  label: string;
  valueHours: number;
  isCurrent: boolean;
}

export interface ChartDataset {
  points: ChartPoint[];
  label: string;
}

export interface ReportViewModel {
  hoursFocused: string;
  daysAccessed: string;
  dayStreak: string;
  periodLabel: string;
  canGoForward: boolean;
  activeRange: ReportRange;
  columns: number;
  scaleLabels: string[];
  bars: Array<{
    label: string;
    heightPercent: number;
    isCurrent: boolean;
    title: string;
  }>;
}

export interface TimerViewModel {
  displayTime: string;
  statusLabel: string;
  statusState: TimerStatusState;
  progressPercent: number;
  caption: string;
  startPauseLabel: string;
  focusModeLabel: string;
  hideTime: boolean;
  title: string;
  activeMode: TimerMode;
}

export interface ToneDefinition {
  frequency: number;
  duration: number;
  gap?: number;
  volume?: number;
  type?: OscillatorType;
}

export interface StoredTimerState {
  mode: TimerMode;
  remainingSeconds: number;
  remainingByMode: Partial<Record<TimerMode, number>>;
  isRunning: boolean;
  isTimeHidden: boolean;
  activeMicroBreak: ActiveMicroBreak | null;
  nextMicroBreakIndex: number;
  completedPomodoros: number;
  completedDate: string;
  targetTime: number | null;
}

export interface StoredAnalyticsEntry {
  focusSeconds: number;
  accessed: boolean;
}

export interface StoredAnalyticsState {
  daily: Record<string, StoredAnalyticsEntry>;
}

export interface HydrationResult {
  shouldResumeTicker: boolean;
  recoveredCompletion: {
    completedMode: TimerMode;
    completedDateKey: string;
  } | null;
}

export type StartResult = "started" | "noop" | "micro-break-ended";
export type PauseResult = "paused" | "noop" | "cancelled-micro-break";

export type TickResult =
  | { type: "none" }
  | { type: "micro-break-started" }
  | { type: "micro-break-ended" }
  | { type: "completed"; completedMode: TimerMode };
