import type { AnalyticsEntry, AnalyticsState, ChartDataset, ChartPoint, ReportState, ReportViewModel } from "@/app/types";
import { addDays, addMonths, addYears, getTodayKey, parseDateKey, startOfMonth, startOfWeek, startOfYear, toDateKey } from "@/utils/date";

function createGermanNumberFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat("de-DE", options);
}

function createEmptyEntry(): AnalyticsEntry {
  return {
    focusedSeconds: 0,
    accessed: false,
  };
}

export class ReportService {
  private analytics: AnalyticsState;

  public constructor(initialState: AnalyticsState = { daily: {} }) {
    this.analytics = cloneAnalyticsState(initialState);
  }

  public getState(): AnalyticsState {
    return cloneAnalyticsState(this.analytics);
  }

  public replaceState(nextState: AnalyticsState): void {
    this.analytics = cloneAnalyticsState(nextState);
  }

  public markAccess(dateKey: string = getTodayKey()): void {
    const entry = this.ensureAnalyticsDay(dateKey);
    entry.accessed = true;
  }

  public recordFocusSession(seconds: number, dateKey: string = getTodayKey()): void {
    const entry = this.ensureAnalyticsDay(dateKey);
    entry.focusedSeconds += seconds;
    entry.accessed = true;
  }

  public buildViewModel(reportState: ReportState, today: Date = new Date()): ReportViewModel {
    const dataset = this.getChartDataset(reportState, today);
    const peakValue = dataset.points.reduce((maxValue, point) => Math.max(maxValue, point.valueHours), 0);
    const scaleMax = getChartScale(peakValue);
    const scaleLabels = Array.from({ length: 5 }, (_, index) => scaleMax - (scaleMax / 4) * index).map((value) => formatAxisValue(value));
    const todayKey = toDateKey(today);

    return {
      hoursFocused: formatSummaryHours(this.getTotalFocusHours()),
      daysAccessed: String(this.getAccessedDayCount()),
      dayStreak: String(this.getCurrentStreak(todayKey)),
      periodLabel: dataset.label,
      canGoForward: reportState.offset < 0,
      activeRange: reportState.range,
      columns: dataset.points.length,
      scaleLabels,
      bars: dataset.points.map((point) => ({
        label: point.label,
        heightPercent: scaleMax === 0 ? 0 : (point.valueHours / scaleMax) * 100,
        isCurrent: point.isCurrent,
        title: `${point.label}: ${formatAxisValue(point.valueHours)} Std.`,
      })),
    };
  }

  private ensureAnalyticsDay(dateKey: string): AnalyticsEntry {
    if (!this.analytics.daily[dateKey]) {
      this.analytics.daily[dateKey] = createEmptyEntry();
    }

    return this.analytics.daily[dateKey];
  }

  private getSortedAccessedDates(): string[] {
    return Object.keys(this.analytics.daily)
      .filter((dateKey) => this.analytics.daily[dateKey]?.accessed)
      .sort();
  }

  private getAccessedDayCount(): number {
    return this.getSortedAccessedDates().length;
  }

  private getCurrentStreak(todayKey: string): number {
    const accessedDates = this.getSortedAccessedDates();

    if (accessedDates.length === 0) {
      return 0;
    }

    const accessedSet = new Set(accessedDates);
    let cursor = parseDateKey(todayKey);
    let streak = 0;

    while (accessedSet.has(toDateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return streak;
  }

  private getTotalFocusHours(): number {
    const totalSeconds = Object.values(this.analytics.daily).reduce((sum, entry) => {
      return sum + (Number(entry.focusedSeconds) || 0);
    }, 0);

    return totalSeconds / 3600;
  }

  private getChartDataset(reportState: ReportState, today: Date): ChartDataset {
    const points: ChartPoint[] = [];

    if (reportState.range === "week") {
      const startDate = addDays(startOfWeek(today), reportState.offset * 7);

      for (let index = 0; index < 7; index += 1) {
        const date = addDays(startDate, index);
        const dateKey = toDateKey(date);
        points.push({
          key: dateKey,
          label: formatDateLabel(date, "week"),
          valueHours: (this.analytics.daily[dateKey]?.focusedSeconds || 0) / 3600,
          isCurrent: dateKey === getTodayKey(),
        });
      }

      return {
        points,
        label: formatPeriodLabel(startDate, addDays(startDate, 6), "week", reportState.offset),
      };
    }

    if (reportState.range === "month") {
      const startDate = addMonths(startOfMonth(today), reportState.offset);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      for (let day = 1; day <= endDate.getDate(); day += 1) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth(), day);
        const dateKey = toDateKey(date);
        points.push({
          key: dateKey,
          label: formatDateLabel(date, "month"),
          valueHours: (this.analytics.daily[dateKey]?.focusedSeconds || 0) / 3600,
          isCurrent: dateKey === getTodayKey(),
        });
      }

      return {
        points,
        label: formatPeriodLabel(startDate, endDate, "month", reportState.offset),
      };
    }

    const startDate = addYears(startOfYear(today), reportState.offset);

    for (let month = 0; month < 12; month += 1) {
      const date = new Date(startDate.getFullYear(), month, 1);
      let focusedSeconds = 0;

      Object.entries(this.analytics.daily).forEach(([dateKey, entry]) => {
        const pointDate = parseDateKey(dateKey);

        if (pointDate.getFullYear() === startDate.getFullYear() && pointDate.getMonth() === month) {
          focusedSeconds += Number(entry.focusedSeconds) || 0;
        }
      });

      points.push({
        key: `${startDate.getFullYear()}-${String(month + 1).padStart(2, "0")}`,
        label: formatDateLabel(date, "year"),
        valueHours: focusedSeconds / 3600,
        isCurrent: reportState.offset === 0 && today.getMonth() === month,
      });
    }

    return {
      points,
      label: formatPeriodLabel(startDate, new Date(startDate.getFullYear(), 11, 31), "year", reportState.offset),
    };
  }
}

function cloneAnalyticsState(analytics: AnalyticsState): AnalyticsState {
  const daily = Object.fromEntries(
    Object.entries(analytics.daily).map(([dateKey, entry]) => [
      dateKey,
      {
        focusedSeconds: Number(entry.focusedSeconds) || 0,
        accessed: Boolean(entry.accessed),
      },
    ]),
  );

  return { daily };
}

function formatSummaryHours(hours: number): string {
  return createGermanNumberFormatter({
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(hours);
}

function formatAxisValue(value: number): string {
  return createGermanNumberFormatter({
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(date: Date, range: ReportState["range"]): string {
  if (range === "week") {
    return new Intl.DateTimeFormat("de-DE", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  if (range === "month") {
    return String(date.getDate());
  }

  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
  }).format(date);
}

function formatPeriodLabel(startDate: Date, endDate: Date, range: ReportState["range"], offset: number): string {
  if (range === "week") {
    if (offset === 0) {
      return "Diese Woche";
    }

    const formatter = new Intl.DateTimeFormat("de-DE", {
      month: "short",
      day: "numeric",
    });
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
  }

  if (range === "month") {
    return new Intl.DateTimeFormat("de-DE", {
      month: "long",
      year: "numeric",
    }).format(startDate);
  }

  return String(startDate.getFullYear());
}

function getChartScale(maxValue: number): number {
  if (maxValue <= 1) {
    return 1;
  }

  if (maxValue <= 2) {
    return 2;
  }

  if (maxValue <= 4) {
    return 4;
  }

  if (maxValue <= 8) {
    return 8;
  }

  const step = Math.ceil(maxValue / 4);
  return step * 4;
}
