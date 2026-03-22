import { describe, expect, it } from "vitest";

import { ReportService } from "@/domain/report/report-service";

describe("ReportService", () => {
  it("builds summary and chart data from analytics state", () => {
    const reportService = new ReportService({
      daily: {
        "2026-03-20": { focusedSeconds: 3600, accessed: true },
        "2026-03-21": { focusedSeconds: 1800, accessed: true },
        "2026-03-22": { focusedSeconds: 7200, accessed: true },
      },
    });

    const viewModel = reportService.buildViewModel(
      {
        range: "week",
        offset: 0,
      },
      new Date("2026-03-22T10:00:00Z"),
    );

    expect(viewModel.hoursFocused).toBe("3,5");
    expect(viewModel.daysAccessed).toBe("3");
    expect(viewModel.dayStreak).toBe("3");
    expect(viewModel.bars).toHaveLength(7);
  });
});
