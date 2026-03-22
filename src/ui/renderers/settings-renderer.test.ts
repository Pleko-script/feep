import { describe, expect, it } from "vitest";

import { renderSettingsForm } from "@/ui/renderers/settings-renderer";
import { getAppElements } from "@/ui/dom/elements";

describe("renderSettingsForm", () => {
  it("syncs values and the micro-break toggle state", () => {
    document.body.innerHTML = `
      <p id="timer-display"></p>
      <p id="timer-status"></p>
      <p id="timer-status-label"></p>
      <p id="mode-caption"></p>
      <div id="progress-rail"></div>
      <div id="progress-bar"></div>
      <button id="start-pause-btn"></button>
      <button id="reset-btn"></button>
      <button id="toggle-focus-mode-btn"></button>
      <button class="mode-tab" data-mode="pomodoro"></button>
      <button id="open-report-btn"></button>
      <button id="open-settings-btn"></button>
      <div id="report-modal"></div>
      <div id="completion-modal"></div>
      <h2 id="completion-title"></h2>
      <p id="completion-message"></p>
      <button id="completion-ok-btn"></button>
      <div id="settings-modal"></div>
      <p id="hours-focused"></p>
      <p id="days-accessed"></p>
      <p id="day-streak"></p>
      <button class="range-tab" data-range="week"></button>
      <p id="period-label"></p>
      <button id="period-prev"></button>
      <button id="period-next"></button>
      <div id="chart-grid"></div>
      <form id="settings-form"></form>
      <input id="settings-pomodoro" />
      <input id="settings-short-break" />
      <input id="settings-long-break" />
      <section id="micro-break-settings"></section>
      <input id="settings-micro-breaks-enabled" type="checkbox" />
      <span id="settings-micro-breaks-state"></span>
      <select id="settings-micro-break-variant">
        <option value="A">A</option>
        <option value="B">B</option>
      </select>
      <button id="settings-reset-defaults"></button>
    `;

    const elements = getAppElements(document);

    renderSettingsForm(elements, {
      pomodoro: 50,
      shortBreak: 8,
      longBreak: 20,
      microBreaksEnabled: true,
      microBreakVariant: "B",
    });

    expect(elements.settingsPomodoro.value).toBe("50");
    expect(elements.settingsMicroBreakVariant.disabled).toBe(false);
    expect(elements.settingsMicroBreaksState.textContent).toBe("An");
  });
});
