import type { AnalyticsState, AppSettings, StoredAnalyticsState, StoredTimerState, TimerState } from "@/app/types";
import { normalizeStoredAnalytics, normalizeStoredSettings, normalizeStoredTimerState, parseStoredJson } from "@/infrastructure/storage/storage-migrations";
import { ANALYTICS_KEY, SETTINGS_KEY, STORAGE_KEY } from "@/infrastructure/storage/storage-keys";

export class StorageService {
  private readonly serializedCache: Record<string, string | null>;

  public constructor(private readonly storage: Storage) {
    this.serializedCache = {
      [STORAGE_KEY]: this.storage.getItem(STORAGE_KEY),
      [ANALYTICS_KEY]: this.storage.getItem(ANALYTICS_KEY),
      [SETTINGS_KEY]: this.storage.getItem(SETTINGS_KEY),
    };
  }

  public loadSettings(): AppSettings {
    return normalizeStoredSettings(parseStoredJson(this.storage.getItem(SETTINGS_KEY)));
  }

  public saveSettings(settings: AppSettings): void {
    this.writeSerialized(SETTINGS_KEY, JSON.stringify(settings));
  }

  public loadAnalytics(): AnalyticsState {
    return normalizeStoredAnalytics(parseStoredJson(this.storage.getItem(ANALYTICS_KEY)));
  }

  public saveAnalytics(analytics: AnalyticsState): void {
    const storedAnalytics: StoredAnalyticsState = {
      daily: Object.fromEntries(
        Object.entries(analytics.daily).map(([dateKey, entry]) => [
          dateKey,
          {
            focusSeconds: entry.focusedSeconds,
            accessed: entry.accessed,
          },
        ]),
      ),
    };

    this.writeSerialized(ANALYTICS_KEY, JSON.stringify(storedAnalytics));
  }

  public loadTimerState(settings: AppSettings): StoredTimerState | null {
    return normalizeStoredTimerState(parseStoredJson(this.storage.getItem(STORAGE_KEY)), settings);
  }

  public saveTimerState(timerState: TimerState): void {
    const snapshot: StoredTimerState = {
      mode: timerState.mode,
      remainingSeconds: timerState.remainingSeconds,
      remainingByMode: timerState.remainingByMode,
      isRunning: timerState.isRunning,
      isTimeHidden: timerState.isTimeHidden,
      activeMicroBreak: timerState.activeMicroBreak,
      nextMicroBreakIndex: timerState.nextMicroBreakIndex,
      completedPomodoros: timerState.completedPomodoros,
      completedDate: timerState.completedDate,
      targetTime: timerState.targetTime,
    };

    this.writeSerialized(STORAGE_KEY, JSON.stringify(snapshot));
  }

  private writeSerialized(key: string, value: string): void {
    if (this.serializedCache[key] === value) {
      return;
    }

    this.storage.setItem(key, value);
    this.serializedCache[key] = value;
  }
}
