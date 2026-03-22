import type { OpenModal } from "@/app/types";
import type { AppElements } from "@/ui/dom/elements";

export class ModalManager {
  public constructor(
    private readonly elements: Pick<AppElements, "reportModal" | "completionModal" | "settingsModal">,
  ) {}

  public open(modal: OpenModal): void {
    this.elements.reportModal.hidden = modal !== "report";
    this.elements.completionModal.hidden = modal !== "completion";
    this.elements.settingsModal.hidden = modal !== "settings";
  }

  public close(openModal: OpenModal): OpenModal {
    if (openModal === "completion") {
      return openModal;
    }

    this.open(null);
    return null;
  }

  public forceCloseAll(): void {
    this.open(null);
  }
}
