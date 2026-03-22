import { describe, expect, it } from "vitest";

import { normalizeSettings } from "@/domain/settings/settings-service";
import { getMicroBreakSchedule } from "@/domain/timer/micro-breaks";

describe("getMicroBreakSchedule", () => {
  it("returns one scheduled break for variant A", () => {
    const settings = normalizeSettings({
      pomodoro: 25,
      microBreaksEnabled: true,
      microBreakVariant: "A",
    });

    expect(getMicroBreakSchedule("pomodoro", settings)).toEqual([
      { triggerSeconds: 750, durationSeconds: 30 },
    ]);
  });

  it("returns two scheduled breaks for variant B", () => {
    const settings = normalizeSettings({
      pomodoro: 25,
      microBreaksEnabled: true,
      microBreakVariant: "B",
    });

    expect(getMicroBreakSchedule("pomodoro", settings)).toEqual([
      { triggerSeconds: 600, durationSeconds: 23 },
      { triggerSeconds: 1170, durationSeconds: 23 },
    ]);
  });
});
