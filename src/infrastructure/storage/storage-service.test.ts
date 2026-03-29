import { describe, expect, it } from "vitest";

import { normalizeSettings } from "@/domain/settings/settings-service";
import { StorageService } from "@/infrastructure/storage/storage-service";

class FakeStorage implements Storage {
  private readonly store = new Map<string, string>();
  public setItemCalls = 0;

  public get length(): number {
    return this.store.size;
  }

  public clear(): void {
    this.store.clear();
  }

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.setItemCalls += 1;
    this.store.set(key, value);
  }
}

describe("StorageService", () => {
  it("skips redundant writes for identical timer snapshots", () => {
    const fakeStorage = new FakeStorage();
    const storageService = new StorageService(fakeStorage);
    const settings = normalizeSettings({
      pomodoro: 25,
      shortBreak: 5,
      longBreak: 15,
    });

    const timerState = {
      mode: "pomodoro" as const,
      remainingSeconds: 1_500,
      remainingByMode: {
        pomodoro: 1_500,
        shortBreak: 300,
        longBreak: 900,
      },
      isRunning: false,
      isTimeHidden: false,
      activeMicroBreak: null,
      nextMicroBreakIndex: 0,
      completedPomodoros: 0,
      completedDate: "2026-03-29",
      targetTime: null,
    };

    storageService.saveTimerState(timerState);
    storageService.saveTimerState(timerState);
    storageService.saveSettings(settings);
    storageService.saveSettings(settings);

    expect(fakeStorage.setItemCalls).toBe(2);
  });
});
