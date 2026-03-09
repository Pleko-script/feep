const MODES = {
  pomodoro: {
    label: "Pomodoro",
    caption: "Focus session",
    seconds: 25 * 60,
    message: "Zeit zum Fokussieren.",
  },
  shortBreak: {
    label: "Short Break",
    caption: "Quick recharge",
    seconds: 5 * 60,
    message: "Kurz durchatmen und Schultern lockern.",
  },
  longBreak: {
    label: "Long Break",
    caption: "Deep reset",
    seconds: 15 * 60,
    message: "Große Pause verdient. Einmal richtig abschalten.",
  },
};

const STORAGE_KEY = "pomofocus-state-v1";

const state = {
  mode: "pomodoro",
  remainingSeconds: MODES.pomodoro.seconds,
  isRunning: false,
  completedPomodoros: 0,
  completedDate: getTodayKey(),
  intervalId: null,
  targetTime: null,
  statusCopy: MODES.pomodoro.message,
};

const elements = {};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getModeSeconds(mode) {
  return MODES[mode]?.seconds ?? MODES.pomodoro.seconds;
}

function syncDailyCount() {
  const today = getTodayKey();

  if (state.completedDate === today) {
    return;
  }

  state.completedDate = today;
  state.completedPomodoros = 0;
}

function saveState() {
  const snapshot = {
    mode: state.mode,
    remainingSeconds: state.remainingSeconds,
    isRunning: state.isRunning,
    completedPomodoros: state.completedPomodoros,
    completedDate: state.completedDate,
    targetTime: state.targetTime,
    statusCopy: state.statusCopy,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function ensureNotificationPermission() {
  if (typeof window.Notification === "undefined" || window.Notification.permission !== "default") {
    return;
  }

  window.Notification.requestPermission().catch(() => {});
}

function showNotification(title, body) {
  if (typeof window.Notification === "undefined" || window.Notification.permission !== "granted") {
    return;
  }

  new window.Notification(title, { body });
}

function hydrateState() {
  const rawState = window.localStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    render();
    return;
  }

  try {
    const savedState = JSON.parse(rawState);
    const mode = MODES[savedState.mode] ? savedState.mode : "pomodoro";
    const totalSeconds = getModeSeconds(mode);

    state.mode = mode;
    state.completedDate = savedState.completedDate || getTodayKey();
    state.completedPomodoros = Number(savedState.completedPomodoros) || 0;
    state.statusCopy = typeof savedState.statusCopy === "string" ? savedState.statusCopy : MODES[mode].message;

    syncDailyCount();

    if (savedState.isRunning && typeof savedState.targetTime === "number") {
      state.targetTime = savedState.targetTime;
      state.isRunning = savedState.targetTime > Date.now();

      if (state.isRunning) {
        syncRemainingTime();
        state.intervalId = window.setInterval(tick, 250);
      } else {
        if (mode === "pomodoro") {
          state.completedPomodoros += 1;
          state.mode = state.completedPomodoros % 4 === 0 ? "longBreak" : "shortBreak";
          state.remainingSeconds = getModeSeconds(state.mode);
          state.statusCopy = "Die letzte Fokus-Session ist im Hintergrund abgelaufen.";
        } else {
          state.mode = "pomodoro";
          state.remainingSeconds = MODES.pomodoro.seconds;
          state.statusCopy = "Die letzte Pause ist im Hintergrund abgelaufen.";
        }

        state.targetTime = null;
        state.isRunning = false;
      }
    } else {
      const remainingSeconds = Number(savedState.remainingSeconds);
      state.remainingSeconds = Number.isFinite(remainingSeconds)
        ? Math.min(totalSeconds, Math.max(1, Math.round(remainingSeconds)))
        : totalSeconds;
    }
  } catch {
    state.mode = "pomodoro";
    state.remainingSeconds = MODES.pomodoro.seconds;
    state.isRunning = false;
    state.completedPomodoros = 0;
    state.completedDate = getTodayKey();
    state.targetTime = null;
    state.statusCopy = MODES.pomodoro.message;
  }

  render();
  saveState();
}

function getCurrentSessionNumber() {
  if (state.mode === "pomodoro") {
    return state.completedPomodoros + 1;
  }

  return Math.max(1, state.completedPomodoros);
}

function getNextLabel() {
  if (state.mode === "pomodoro") {
    return (state.completedPomodoros + 1) % 4 === 0 ? "Long Break" : "Short Break";
  }

  return "Pomodoro";
}

function stopInterval() {
  if (state.intervalId) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function syncRemainingTime() {
  if (!state.isRunning || !state.targetTime) {
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((state.targetTime - Date.now()) / 1000));
  state.remainingSeconds = secondsLeft;
}

function updateCycleTrack() {
  const dots = document.querySelectorAll(".cycle-dot");
  const completedInCycle = state.completedPomodoros % 4;
  const currentIndex = state.mode === "pomodoro" ? completedInCycle + 1 : 0;

  dots.forEach((dot, index) => {
    const dotIndex = index + 1;
    dot.classList.toggle("is-complete", dotIndex <= completedInCycle);
    dot.classList.toggle("is-current", dotIndex === currentIndex);
  });
}

function render() {
  syncDailyCount();
  syncRemainingTime();

  const activeMode = MODES[state.mode];
  const progress = ((getModeSeconds(state.mode) - state.remainingSeconds) / getModeSeconds(state.mode)) * 100;

  elements.timerDisplay.textContent = formatTime(state.remainingSeconds);
  elements.modeCaption.textContent = activeMode.caption;
  elements.startPauseBtn.textContent = state.isRunning ? "Pause" : "Start";
  elements.sessionCount.textContent = `#${getCurrentSessionNumber()}`;
  elements.completedCount.textContent = state.completedPomodoros.toString();
  elements.nextLabel.textContent = getNextLabel();
  elements.statusCopy.textContent = state.statusCopy;
  elements.progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;

  document.title = `${formatTime(state.remainingSeconds)} · ${activeMode.label}`;

  elements.modeTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === state.mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive.toString());
  });

  updateCycleTrack();
}

function switchMode(mode, statusCopy = MODES[mode].message) {
  stopInterval();
  state.mode = mode;
  state.remainingSeconds = MODES[mode].seconds;
  state.targetTime = null;
  state.isRunning = false;
  state.statusCopy = statusCopy;
  render();
  saveState();
}

function completeSession() {
  const completedMode = state.mode;

  stopInterval();
  state.isRunning = false;
  state.targetTime = null;
  state.remainingSeconds = 0;

  if (completedMode === "pomodoro") {
    state.completedPomodoros += 1;
    const nextMode = state.completedPomodoros % 4 === 0 ? "longBreak" : "shortBreak";
    showNotification("Pomodoro abgeschlossen", `Wechsel zu ${MODES[nextMode].label}.`);
    switchMode(nextMode, "Fokusblock erledigt. Gonn dir kurz Abstand.");
    return;
  }

  showNotification("Pause beendet", "Der naechste Fokusblock ist bereit.");
  switchMode("pomodoro", "Pause vorbei. Der nächste Fokusblock wartet.");
}

function tick() {
  syncRemainingTime();

  if (state.remainingSeconds <= 0) {
    completeSession();
    return;
  }

  render();
}

function startTimer() {
  if (state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.statusCopy = `Aktiv: ${MODES[state.mode].message}`;
  state.targetTime = Date.now() + state.remainingSeconds * 1000;
  ensureNotificationPermission();
  state.intervalId = window.setInterval(tick, 250);
  render();
  saveState();
}

function pauseTimer() {
  if (!state.isRunning) {
    return;
  }

  syncRemainingTime();
  stopInterval();
  state.targetTime = null;
  state.isRunning = false;
  state.statusCopy = `Pausiert: ${MODES[state.mode].message}`;
  render();
  saveState();
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
    return;
  }

  startTimer();
}

function resetTimer() {
  switchMode(state.mode, `${MODES[state.mode].label} zurückgesetzt.`);
}

function handleKeydown(event) {
  const target = event.target;
  const isEditable = target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']");

  if (isEditable) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    toggleTimer();
  }

  if (event.key.toLowerCase() === "r") {
    resetTimer();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  elements.timerDisplay = document.querySelector("#timer-display");
  elements.modeCaption = document.querySelector("#mode-caption");
  elements.progressBar = document.querySelector("#progress-bar");
  elements.startPauseBtn = document.querySelector("#start-pause-btn");
  elements.resetBtn = document.querySelector("#reset-btn");
  elements.sessionCount = document.querySelector("#session-count");
  elements.completedCount = document.querySelector("#completed-count");
  elements.nextLabel = document.querySelector("#next-label");
  elements.statusCopy = document.querySelector("#status-copy");
  elements.modeTabs = Array.from(document.querySelectorAll(".mode-tab"));

  elements.startPauseBtn.addEventListener("click", toggleTimer);
  elements.resetBtn.addEventListener("click", resetTimer);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", saveState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      syncRemainingTime();
      saveState();
    }
  });

  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchMode(tab.dataset.mode);
    });
  });

  hydrateState();
});
