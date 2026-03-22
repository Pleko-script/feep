import { describe, expect, it } from "vitest";

import { normalizeSettings } from "@/domain/settings/settings-service";
import { TimerService } from "@/domain/timer/timer-service";

describe("TimerService", () => {
  it("completes a session cleanly when the timer reaches zero", () => {
    let now = 1_000;
    const settings = normalizeSettings({
      pomodoro: 1,
    });
    const timerService = new TimerService(settings, () => now);

    expect(timerService.start()).toBe("started");

    now += 60_000;

    const result = timerService.tick();

    expect(result).toEqual({ type: "completed", completedMode: "pomodoro" });
    expect(timerService.getState().remainingSeconds).toBe(0);
    expect(timerService.getState().isRunning).toBe(false);
  });

  it("keeps per-mode remaining time when switching tabs", () => {
    let now = 1_000;
    const settings = normalizeSettings({
      pomodoro: 25,
      shortBreak: 5,
      longBreak: 15,
    });
    const timerService = new TimerService(settings, () => now);

    timerService.start();
    now += 30_000;
    timerService.pause();

    const pomodoroRemaining = timerService.getState().remainingSeconds;

    timerService.switchMode("shortBreak");
    timerService.switchMode("pomodoro");

    expect(timerService.getState().remainingSeconds).toBe(pomodoroRemaining);
  });
});
