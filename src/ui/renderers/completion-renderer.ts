import type { CompletionPrompt } from "@/app/types";
import type { AppElements } from "@/ui/dom/elements";

export function renderCompletionPrompt(elements: AppElements, prompt: CompletionPrompt): void {
  elements.completionTitle.textContent = prompt.title;
  elements.completionMessage.textContent = prompt.message;
}
