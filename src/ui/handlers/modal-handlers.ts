import type { ReportRange } from "@/app/types";
import type { AppController } from "@/app/app-controller";
import type { AppElements } from "@/ui/dom/elements";

export function bindModalHandlers(controller: AppController, elements: AppElements): void {
  elements.openReportBtn.addEventListener("click", () => controller.openModal("report"));
  elements.openSettingsBtn.addEventListener("click", () => controller.openModal("settings"));
  elements.completionOkBtn.addEventListener("click", () => controller.acknowledgeCompletion());
  elements.periodPrev.addEventListener("click", () => controller.shiftReportPeriod(-1));
  elements.periodNext.addEventListener("click", () => controller.shiftReportPeriod(1));

  elements.rangeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      controller.setReportRange(tab.dataset.range as ReportRange);
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("[data-close-modal]")) {
      controller.closeModal();
    }
  });
}
