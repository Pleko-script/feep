export class NotificationService {
  public ensurePermission(): void {
    if (typeof window.Notification === "undefined" || window.Notification.permission !== "default") {
      return;
    }

    window.Notification.requestPermission().catch(() => undefined);
  }

  public show(title: string, body: string): void {
    if (typeof window.Notification === "undefined" || window.Notification.permission !== "granted") {
      return;
    }

    new window.Notification(title, { body });
  }
}
