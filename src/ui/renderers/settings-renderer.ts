import type { AppSettings } from "@/app/types";
import type { AppElements } from "@/ui/dom/elements";

export function renderSettingsForm(elements: AppElements, settings: AppSettings): void {
  elements.settingsPomodoro.value = String(settings.pomodoro);
  elements.settingsShortBreak.value = String(settings.shortBreak);
  elements.settingsLongBreak.value = String(settings.longBreak);
  elements.settingsMicroBreaksEnabled.checked = settings.microBreaksEnabled;
  elements.settingsMicroBreakVariant.value = settings.microBreakVariant;
  renderMicroBreakSettingsState(elements, settings.microBreaksEnabled);
}

export function renderMicroBreakSettingsState(elements: AppElements, isEnabled: boolean): void {
  elements.settingsMicroBreakVariant.disabled = !isEnabled;
  elements.microBreakSettings.dataset.enabled = isEnabled ? "true" : "false";
  elements.settingsMicroBreaksState.textContent = isEnabled ? "An" : "Aus";
}
