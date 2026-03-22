import type { TimerMode } from "@/app/types";
import type { AppController } from "@/app/app-controller";
import type { AppElements } from "@/ui/dom/elements";
import { getModeFromButton } from "@/ui/dom/elements";

export function bindTimerHandlers(controller: AppController, elements: AppElements): void {
  elements.startPauseBtn.addEventListener("click", () => controller.toggleTimer());
  elements.resetBtn.addEventListener("click", () => controller.resetTimer());
  elements.toggleFocusModeBtn.addEventListener("click", () => controller.toggleFocusMode());

  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      controller.switchMode(getModeFromButton(tab));
    });
  });

  window.addEventListener("keydown", controller.handleKeydown);
  window.addEventListener("beforeunload", controller.handleBeforeUnload);
  document.addEventListener("visibilitychange", controller.handleVisibilityChange);
}
