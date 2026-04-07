import { DEFAULT_REPORT_STATE, DEFAULT_UI_STATE } from "@/app/constants";
import type {
  AppSettings,
  CompletionPrompt,
  HydrationResult,
  OpenModal,
  ReportRange,
  StoredTimerState,
  TimerMode,
} from "@/app/types";
import { resolveCompletion } from "@/domain/session/completion-flow";
import { ReportService } from "@/domain/report/report-service";
import { SettingsService } from "@/domain/settings/settings-service";
import { TimerService } from "@/domain/timer/timer-service";
import { AudioService } from "@/infrastructure/audio/audio-service";
import { NotificationService } from "@/infrastructure/notifications/notification-service";
import { StorageService } from "@/infrastructure/storage/storage-service";
import { ModalManager } from "@/ui/dom/modal-manager";
import type { AppElements } from "@/ui/dom/elements";
import { renderCompletionPrompt } from "@/ui/renderers/completion-renderer";
import { renderReport } from "@/ui/renderers/report-renderer";
import { renderMicroBreakSettingsState, renderSettingsForm } from "@/ui/renderers/settings-renderer";
import { renderTimer } from "@/ui/renderers/timer-renderer";
import { getTodayKey } from "@/utils/date";

const IDLE_REMINDER_DELAY_MS = 3 * 60 * 1000;

export class AppController {
  private readonly reportState = { ...DEFAULT_REPORT_STATE };
  private readonly uiState = { ...DEFAULT_UI_STATE };
  private tickTimeoutId: number | null = null;
  private idleReminderTimeoutId: number | null = null;

  public constructor(
    private readonly elements: AppElements,
    private readonly modalManager: ModalManager,
    private readonly storageService: StorageService,
    private readonly settingsService: SettingsService,
    private readonly timerService: TimerService,
    private readonly reportService: ReportService,
    private readonly audioService: AudioService,
    private readonly notificationService: NotificationService,
    private readonly doc: Document = document,
  ) {}

  public initialize(storedTimerState: StoredTimerState | null): void {
    this.reportService.markAccess();

    const hydration = this.timerService.hydrate(storedTimerState);

    if (hydration.recoveredCompletion) {
      this.applyRecoveredCompletion(hydration);
    }

    this.renderAll();
    this.persistAll();

    if (hydration.shouldResumeTicker) {
      this.startTicking();
    }

    this.syncIdleReminder();
  }

  public toggleTimer(): void {
    if (this.uiState.openModal === "completion") {
      return;
    }

    const state = this.timerService.getState();

    if (state.isRunning) {
      const result = this.timerService.pause();

      if (result === "paused") {
        this.audioService.playPause();
      }

      this.stopTicking();
      this.renderTimerPanel();
      this.persistTimerState();
      this.syncIdleReminder();
      return;
    }

    const result = this.timerService.start();

    if (result === "noop") {
      return;
    }

    if (result === "started") {
      this.audioService.playStart();
    }

    if (result === "micro-break-ended") {
      this.audioService.playMicroBreakEnd();
    }

    this.notificationService.ensurePermission();
    this.renderTimerPanel();
    this.persistTimerState();
    this.startTicking();
    this.syncIdleReminder();
  }

  public resetTimer(): void {
    if (this.uiState.openModal === "completion") {
      return;
    }

    this.stopTicking();
    this.timerService.resetCurrentMode();
    this.renderTimerPanel();
    this.persistTimerState();
    this.syncIdleReminder();
  }

  public switchMode(mode: TimerMode): void {
    if (this.uiState.openModal === "completion") {
      return;
    }

    this.stopTicking();
    this.timerService.switchMode(mode);
    this.renderTimerPanel();
    this.persistTimerState();
    this.syncIdleReminder();
  }

  public toggleFocusMode(): void {
    this.timerService.toggleFocusMode();
    this.renderTimerPanel();
    this.persistTimerState();
    this.syncIdleReminder();
  }

  public openModal(name: OpenModal): void {
    if (this.uiState.openModal === "completion" && name !== "completion") {
      return;
    }

    this.uiState.openModal = name;
    this.modalManager.open(name);

    if (name === "settings") {
      this.renderSettingsPanel(true);
    }

    if (name === "report") {
      this.renderReportPanel(true);
    }
  }

  public closeModal(): void {
    this.uiState.openModal = this.modalManager.close(this.uiState.openModal);
  }

  public acknowledgeCompletion(): void {
    const prompt = this.uiState.pendingCompletion;

    if (!prompt) {
      return;
    }

    this.stopCompletionAlarm();
    this.uiState.pendingCompletion = null;
    this.uiState.openModal = null;
    this.modalManager.forceCloseAll();
    this.timerService.applyCompletionTransition(prompt.completedMode, prompt.nextMode);
    this.renderAll();
    this.persistTimerState();
    this.syncIdleReminder();
  }

  public setReportRange(range: ReportRange): void {
    this.reportState.range = range;
    this.reportState.offset = 0;
    this.renderReportPanel(true);
  }

  public shiftReportPeriod(amount: number): void {
    this.reportState.offset = Math.min(0, this.reportState.offset + amount);
    this.renderReportPanel(true);
  }

  public submitSettings(formData: FormData): void {
    const nextSettings = this.settingsService.replace({
      pomodoro: Number(formData.get("pomodoro")),
      shortBreak: Number(formData.get("shortBreak")),
      longBreak: Number(formData.get("longBreak")),
      microBreaksEnabled: formData.get("microBreaksEnabled") === "on",
      microBreakVariant: formData.get("microBreakVariant") === "B" ? "B" : "A",
    });

    this.stopTicking();
    this.timerService.replaceSettings(nextSettings);
    this.storageService.saveSettings(nextSettings);
    this.closeModal();
    this.renderAll();
    this.persistTimerState();
    this.syncIdleReminder();
  }

  public resetSettingsInputs(defaultSettings: AppSettings): void {
    this.renderSettingsPanel(true, defaultSettings);
  }

  public previewMicroBreakToggle(isEnabled: boolean): void {
    renderMicroBreakSettingsState(this.elements, isEnabled);
  }

  public readonly handleKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    const isEditable =
      target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']");

    if (event.key === "Escape" && this.uiState.openModal && this.uiState.openModal !== "completion") {
      this.closeModal();
      return;
    }

    if (isEditable || this.uiState.openModal) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      this.toggleTimer();
    }

    if (event.key.toLowerCase() === "r") {
      this.resetTimer();
    }
  };

  public readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.timerService.syncRemainingTime();
      this.persistTimerState();
      return;
    }

    this.reportService.markAccess();
    this.timerService.syncRemainingTime();
    this.renderTimerPanel();
    this.renderReportPanel();
    this.persistAnalytics();
    this.syncIdleReminder();

    if (this.timerService.getNextTickDelay() === null || this.uiState.openModal === "completion") {
      this.stopTicking();
      return;
    }

    this.startTicking();
  };

  public readonly handleBeforeUnload = (): void => {
    this.timerService.syncRemainingTime();
    this.stopIdleReminder();
    this.persistAll();
  };

  private renderAll(): void {
    this.syncDailyState();
    this.timerService.syncRemainingTime();
    this.renderTimerPanel();
    this.renderReportPanel();
    this.renderSettingsPanel();
    this.renderCompletionState();
  }

  private renderTimerPanel(): void {
    renderTimer(this.elements, this.timerService.getState(), this.settingsService.getSettings(), this.doc);
  }

  private renderReportPanel(force: boolean = false): void {
    if (!force && this.uiState.openModal !== "report") {
      return;
    }

    renderReport(this.elements, this.reportService.buildViewModel(this.reportState));
  }

  private renderSettingsPanel(force: boolean = false, settings: AppSettings = this.settingsService.getSettings()): void {
    if (!force && this.uiState.openModal !== "settings") {
      return;
    }

    renderSettingsForm(this.elements, settings);
  }

  private renderCompletionState(): void {
    if (!this.uiState.pendingCompletion) {
      return;
    }

    renderCompletionPrompt(this.elements, this.uiState.pendingCompletion);
  }

  private handleTick = (): void => {
    const result = this.timerService.tick();

    if (result.type === "micro-break-started") {
      this.audioService.playMicroBreakStart();
    }

    if (result.type === "micro-break-ended") {
      this.audioService.playMicroBreakEnd();
    }

    if (result.type === "completed") {
      this.stopTicking();
      this.handleLiveCompletion(result.completedMode);
      this.renderAll();
      this.persistTimerState();
      this.syncIdleReminder();
      return;
    }

    this.syncDailyState();
    this.renderTimerPanel();

    if (result.type !== "none") {
      this.persistTimerState();
    }

    this.syncIdleReminder();
    this.startTicking();
  };

  private handleLiveCompletion(completedMode: TimerMode): void {
    const completedPomodoros =
      completedMode === "pomodoro"
        ? this.handlePomodoroCompletion(getTodayKey())
        : this.timerService.getState().completedPomodoros;
    const prompt = resolveCompletion(completedMode, completedPomodoros);
    this.notificationService.show(prompt.notificationTitle, prompt.notificationBody);
    this.openCompletionModal(prompt);
  }

  private applyRecoveredCompletion(hydration: HydrationResult): void {
    if (!hydration.recoveredCompletion) {
      return;
    }

    const { completedMode, completedDateKey } = hydration.recoveredCompletion;
    const completedPomodoros =
      completedMode === "pomodoro"
        ? this.handlePomodoroCompletion(completedDateKey)
        : this.timerService.getState().completedPomodoros;
    const prompt = resolveCompletion(completedMode, completedPomodoros);
    this.timerService.applyCompletionTransition(completedMode, prompt.nextMode);
  }

  private handlePomodoroCompletion(completedDateKey: string): number {
    this.reportService.recordFocusSession(this.timerService.getModeSeconds("pomodoro"), completedDateKey);
    this.persistAnalytics();
    return this.timerService.registerPomodoroCompletion(completedDateKey);
  }

  private openCompletionModal(prompt: CompletionPrompt): void {
    this.stopCompletionAlarm();
    this.uiState.pendingCompletion = prompt;
    this.uiState.completionAlarmId = this.audioService.startCompletionAlarmLoop();
    this.uiState.openModal = "completion";
    this.renderCompletionState();
    this.modalManager.open("completion");
    this.syncIdleReminder();
  }

  private stopCompletionAlarm(): void {
    this.audioService.stopCompletionAlarmLoop(this.uiState.completionAlarmId);
    this.uiState.completionAlarmId = null;
  }

  private syncIdleReminder(): void {
    if (!this.shouldPlayIdleReminder()) {
      this.stopIdleReminder();
      return;
    }

    if (this.idleReminderTimeoutId !== null) {
      return;
    }

    this.scheduleIdleReminder();
  }

  private shouldPlayIdleReminder(): boolean {
    const state = this.timerService.getState();
    return !state.isRunning && !state.activeMicroBreak && this.uiState.openModal !== "completion";
  }

  private scheduleIdleReminder(): void {
    this.idleReminderTimeoutId = window.setTimeout(() => {
      this.idleReminderTimeoutId = null;

      if (!this.shouldPlayIdleReminder()) {
        return;
      }

      this.audioService.playIdleReminder();
      this.scheduleIdleReminder();
    }, IDLE_REMINDER_DELAY_MS);
  }

  private stopIdleReminder(): void {
    if (this.idleReminderTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.idleReminderTimeoutId);
    this.idleReminderTimeoutId = null;
  }

  private syncDailyState(): boolean {
    if (this.timerService.syncDailyCount()) {
      this.reportService.markAccess();
      this.persistAnalytics();
      this.renderReportPanel();
      return true;
    }

    return false;
  }

  private startTicking(): void {
    this.stopTicking();
    this.scheduleNextTick();
  }

  private stopTicking(): void {
    if (this.tickTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.tickTimeoutId);
    this.tickTimeoutId = null;
  }

  private scheduleNextTick(): void {
    const delay = this.uiState.openModal === "completion" ? null : this.timerService.getNextTickDelay();

    if (delay === null) {
      return;
    }

    this.tickTimeoutId = window.setTimeout(() => {
      this.tickTimeoutId = null;
      this.handleTick();
    }, delay);
  }

  private persistTimerState(): void {
    this.storageService.saveTimerState(this.timerService.getState());
  }

  private persistSettings(): void {
    this.storageService.saveSettings(this.settingsService.getSettings());
  }

  private persistAnalytics(): void {
    this.storageService.saveAnalytics(this.reportService.getState());
  }

  private persistAll(): void {
    this.persistTimerState();
    this.persistSettings();
    this.persistAnalytics();
  }
}
