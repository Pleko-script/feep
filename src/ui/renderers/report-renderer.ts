import type { ReportViewModel } from "@/app/types";
import type { AppElements } from "@/ui/dom/elements";

export function renderReport(elements: AppElements, viewModel: ReportViewModel): void {
  elements.hoursFocused.textContent = viewModel.hoursFocused;
  elements.daysAccessed.textContent = viewModel.daysAccessed;
  elements.dayStreak.textContent = viewModel.dayStreak;
  elements.periodLabel.textContent = viewModel.periodLabel;
  elements.periodNext.disabled = !viewModel.canGoForward;

  elements.rangeTabs.forEach((tab) => {
    const isActive = tab.dataset.range === viewModel.activeRange;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive.toString());
  });

  const scaleMarkup = `
    <div class="chart-scale">
      ${viewModel.scaleLabels.map((label) => `<div class="chart-scale-label">${label}</div>`).join("")}
    </div>
  `;

  const barsMarkup = `
    <div class="chart-bars" style="--columns:${viewModel.columns}">
      ${viewModel.bars
        .map((bar) => {
          const renderHeight = Math.max(bar.heightPercent, bar.heightPercent > 0 ? 2 : 0);
          return `
            <div class="chart-column" title="${bar.title}">
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${renderHeight}%"></div>
              </div>
              <div class="chart-x-label${bar.isCurrent ? " is-current" : ""}">${bar.label}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  elements.chartGrid.innerHTML = scaleMarkup + barsMarkup;
}
