import { DEFAULT_SETTINGS } from "@/app/constants";
import type { AppSettings, ModeSecondsMap, TimerMode } from "@/app/types";
import { clampNumber } from "@/utils/math";

export class SettingsService {
  private settings: AppSettings;

  public constructor(initialSettings: AppSettings = DEFAULT_SETTINGS) {
    this.settings = normalizeSettings(initialSettings);
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public update(nextSettings: Partial<AppSettings>): AppSettings {
    this.settings = normalizeSettings({ ...this.settings, ...nextSettings });
    return this.getSettings();
  }

  public replace(nextSettings: AppSettings): AppSettings {
    this.settings = normalizeSettings(nextSettings);
    return this.getSettings();
  }

  public reset(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    return this.getSettings();
  }
}

export function normalizeSettings(rawSettings: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    pomodoro: clampNumber(rawSettings?.pomodoro, DEFAULT_SETTINGS.pomodoro, 1, 180),
    shortBreak: clampNumber(rawSettings?.shortBreak, DEFAULT_SETTINGS.shortBreak, 1, 60),
    longBreak: clampNumber(rawSettings?.longBreak, DEFAULT_SETTINGS.longBreak, 1, 120),
    microBreaksEnabled: Boolean(rawSettings?.microBreaksEnabled),
    microBreakVariant: rawSettings?.microBreakVariant === "B" ? "B" : "A",
  };
}

export function getModeSecondsForSettings(mode: TimerMode, settings: AppSettings): number {
  return settings[mode] * 60;
}

export function createModeSecondsMap(settings: AppSettings): ModeSecondsMap {
  return {
    pomodoro: getModeSecondsForSettings("pomodoro", settings),
    shortBreak: getModeSecondsForSettings("shortBreak", settings),
    longBreak: getModeSecondsForSettings("longBreak", settings),
  };
}
