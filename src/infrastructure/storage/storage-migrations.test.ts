import { describe, expect, it } from "vitest";

import { normalizeStoredAnalytics, normalizeStoredSettings, normalizeStoredTimerState } from "@/infrastructure/storage/storage-migrations";

describe("storage migrations", () => {
  it("normalizes legacy analytics entries with focusSeconds", () => {
    const analytics = normalizeStoredAnalytics({
      daily: {
        "2026-03-22": {
          focusSeconds: 1200,
          accessed: true,
        },
      },
    });

    expect(analytics.daily["2026-03-22"]).toEqual({
      focusedSeconds: 1200,
      accessed: true,
    });
  });

  it("falls back to default settings when data is invalid", () => {
    const settings = normalizeStoredSettings({
      pomodoro: "oops",
    });

    expect(settings.pomodoro).toBe(25);
    expect(settings.shortBreak).toBe(5);
    expect(settings.longBreak).toBe(15);
  });

  it("normalizes a stored timer snapshot safely", () => {
    const settings = normalizeStoredSettings(null);
    const snapshot = normalizeStoredTimerState(
      {
        mode: "pomodoro",
        remainingSeconds: 300,
        remainingByMode: {
          pomodoro: 300,
        },
        isRunning: true,
        isTimeHidden: true,
        nextMicroBreakIndex: 1,
        completedPomodoros: 2,
        completedDate: "2026-03-22",
        targetTime: 123456,
      },
      settings,
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot?.remainingByMode.pomodoro).toBe(300);
    expect(snapshot?.isTimeHidden).toBe(true);
  });
});
