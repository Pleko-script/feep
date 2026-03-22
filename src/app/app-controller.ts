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

export class AppController {
  private readonly reportState = { ...DEFAULT_REPORT_STATE };
  private readonly uiState = { ...DEFAULT_UI_STATE };
  private tickIntervalId: number | null = null;

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

    if (hydration.shouldResumeTicker) {
      this.startTicking();
    }

    this.renderAll();
    this.persistAll();
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
      this.renderAll();
      this.persistTimerState();
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
    this.startTicking();
    this.renderAll();
    this.persistTimerState();
  }

  public resetTimer(): void {
    if (this.uiState.openModal === "completion") {
      return;
    }

    this.stopTicking();
    this.timerService.resetCurrentMode();
    this.renderAll();
    this.persistTimerState();
  }

  public switchMode(mode: TimerMode): void {
    if (this.uiState.openModal === "completion") {
      return;
    }

    this.stopTicking();
    this.timerService.switchMode(mode);
    this.renderAll();
    this.persistTimerState();
  }

  public toggleFocusMode(): void {
    this.timerService.toggleFocusMode();
    this.renderAll();
    this.persistTimerState();
  }

  public openModal(name: OpenModal): void {
    if (this.uiState.openModal === "completion" && name !== "completion") {
      return;
    }

    this.uiState.openModal = name;
    this.modalManager.open(name);

    if (name === "settings") {
      renderSettingsForm(this.elements, this.settingsService.getSettings());
    }

    if (name === "report") {
      this.renderReportPanel();
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
  }

  public setReportRange(range: ReportRange): void {
    this.reportState.range = range;
    this.reportState.offset = 0;
    this.renderReportPanel();
  }

  public shiftReportPeriod(amount: number): void {
    this.reportState.offset = Math.min(0, this.reportState.offset + amount);
    this.renderReportPanel();
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
    this.renderAll();
    this.closeModal();
    this.persistTimerState();
  }

  public resetSettingsInputs(defaultSettings: AppSettings): void {
    renderSettingsForm(this.elements, defaultSettings);
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
    this.renderAll();
    this.persistAnalytics();
  };

  public readonly handleBeforeUnload = (): void => {
    this.timerService.syncRemainingTime();
    this.persistAll();
  };

  private renderAll(): void {
    this.syncDailyState();
    this.timerService.syncRemainingTime();
    renderTimer(this.elements, this.timerService.getState(), this.settingsService.getSettings(), this.doc);
    this.renderReportPanel();
    renderSettingsForm(this.elements, this.settingsService.getSettings());

    if (this.uiState.pendingCompletion) {
      renderCompletionPrompt(this.elements, this.uiState.pendingCompletion);
    }
  }

  private renderReportPanel(): void {
    renderReport(this.elements, this.reportService.buildViewModel(this.reportState));
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
    }

    this.renderAll();
    this.persistTimerState();
  };

  private handleLiveCompletion(completedMode: TimerMode): void {
    const completedPomodoros =
      completedMode === "pomodoro"
        ? this.handlePomodoroCompletion(getTodayKey())
        : this.timerService.getState().completedPomodoros;
    const prompt = resolveCompletion(completedMode, completedPomodoros);
    this.notificationService.show(prompt.notificationTitle, prompt.notificationBody);
    this.uiState.pendingCompletion = prompt;
    renderCompletionPrompt(this.elements, prompt);
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
    this.modalManager.open("completion");
  }

  private stopCompletionAlarm(): void {
    this.audioService.stopCompletionAlarmLoop(this.uiState.completionAlarmId);
    this.uiState.completionAlarmId = null;
  }

  private syncDailyState(): void {
    if (this.timerService.syncDailyCount()) {
      this.reportService.markAccess();
      this.persistAnalytics();
    }
  }

  private startTicking(): void {
    if (this.tickIntervalId !== null) {
      return;
    }

    this.tickIntervalId = window.setInterval(this.handleTick, 250);
  }

  private stopTicking(): void {
    if (this.tickIntervalId === null) {
      return;
    }

    window.clearInterval(this.tickIntervalId);
    this.tickIntervalId = null;
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
