import { MODES } from "@/app/constants";
import type { AppSettings, TimerState, TimerViewModel } from "@/app/types";
import { getModeSecondsForSettings } from "@/domain/settings/settings-service";
import { getCurrentMicroBreakRemaining } from "@/domain/timer/micro-breaks";
import type { AppElements } from "@/ui/dom/elements";
import { formatTime } from "@/utils/time";

export function buildTimerViewModel(state: TimerState, settings: AppSettings, now: number = Date.now()): TimerViewModel {
  const activeMode = MODES[state.mode];
  const totalSeconds = getModeSecondsForSettings(state.mode, settings);
  const progressPercent = ((totalSeconds - state.remainingSeconds) / totalSeconds) * 100;
  const statusLabel = state.activeMicroBreak ? "Mikropause" : state.isRunning ? "Läuft" : "Pausiert";
  const displayTime = state.activeMicroBreak
    ? formatTime(getCurrentMicroBreakRemaining(state.activeMicroBreak, now))
    : formatTime(state.remainingSeconds);

  return {
    displayTime,
    statusLabel,
    statusState: state.activeMicroBreak ? "micro-break" : state.isRunning ? "running" : "paused",
    progressPercent: Math.max(0, Math.min(100, progressPercent)),
    caption: state.activeMicroBreak ? `Kurz stoppen · Variante ${state.activeMicroBreak.label}` : activeMode.caption,
    startPauseLabel: state.activeMicroBreak ? "Weiter" : state.isRunning ? "Pause" : "Start",
    focusModeLabel: state.isTimeHidden ? "Zeit zeigen" : "Zeit verbergen",
    hideTime: state.isTimeHidden,
    title: state.isTimeHidden ? `${statusLabel} · ${activeMode.label}` : `${displayTime} · ${activeMode.label}`,
    activeMode: state.mode,
  };
}

export function renderTimer(elements: AppElements, state: TimerState, settings: AppSettings, doc: Document, now: number = Date.now()): void {
  const viewModel = buildTimerViewModel(state, settings, now);

  elements.timerDisplay.textContent = viewModel.displayTime;
  elements.modeCaption.textContent = viewModel.caption;
  elements.timerStatusLabel.textContent = viewModel.statusLabel;
  elements.timerStatus.dataset.state = viewModel.statusState;
  elements.timerStatus.setAttribute("aria-label", `Timer ist ${viewModel.statusLabel}`);
  elements.timerStatus.hidden = !viewModel.hideTime;
  elements.startPauseBtn.textContent = viewModel.startPauseLabel;
  elements.toggleFocusModeBtn.textContent = viewModel.focusModeLabel;
  elements.progressBar.style.width = `${viewModel.progressPercent}%`;
  elements.progressRail.hidden = viewModel.hideTime;
  elements.timerDisplay.hidden = viewModel.hideTime;
  doc.title = viewModel.title;

  elements.modeTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === viewModel.activeMode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive.toString());
  });
}
