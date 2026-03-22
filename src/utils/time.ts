export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getRemainingMilliseconds(targetTime: number | null, now: number): number {
  if (!targetTime) {
    return 0;
  }

  return Math.max(0, targetTime - now);
}
