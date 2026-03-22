import { AppController } from "@/app/app-controller";
import { AudioService } from "@/infrastructure/audio/audio-service";
import { NotificationService } from "@/infrastructure/notifications/notification-service";
import { ReportService } from "@/domain/report/report-service";
import { SettingsService } from "@/domain/settings/settings-service";
import { TimerService } from "@/domain/timer/timer-service";
import { StorageService } from "@/infrastructure/storage/storage-service";
import { ModalManager } from "@/ui/dom/modal-manager";
import { getAppElements } from "@/ui/dom/elements";
import { bindModalHandlers } from "@/ui/handlers/modal-handlers";
import { bindSettingsHandlers } from "@/ui/handlers/settings-handlers";
import { bindTimerHandlers } from "@/ui/handlers/timer-handlers";

export function bootstrap(doc: Document = document): AppController {
  const elements = getAppElements(doc);
  const storageService = new StorageService(window.localStorage);
  const settingsService = new SettingsService(storageService.loadSettings());
  const timerService = new TimerService(settingsService.getSettings());
  const reportService = new ReportService(storageService.loadAnalytics());
  const audioService = new AudioService();
  const notificationService = new NotificationService();
  const modalManager = new ModalManager(elements);
  const controller = new AppController(
    elements,
    modalManager,
    storageService,
    settingsService,
    timerService,
    reportService,
    audioService,
    notificationService,
    doc,
  );

  bindTimerHandlers(controller, elements);
  bindSettingsHandlers(controller, elements);
  bindModalHandlers(controller, elements);
  controller.initialize(storageService.loadTimerState(settingsService.getSettings()));

  return controller;
}
