import { DEFAULT_SETTINGS } from "@/app/constants";
import type { AppController } from "@/app/app-controller";
import type { AppElements } from "@/ui/dom/elements";

export function bindSettingsHandlers(controller: AppController, elements: AppElements): void {
  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    controller.submitSettings(new FormData(elements.settingsForm));
  });

  elements.settingsResetDefaults.addEventListener("click", () => {
    controller.resetSettingsInputs(DEFAULT_SETTINGS);
  });

  elements.settingsMicroBreaksEnabled.addEventListener("change", () => {
    controller.previewMicroBreakToggle(elements.settingsMicroBreaksEnabled.checked);
  });
}
