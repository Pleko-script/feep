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

const state = {
  mode: "pomodoro",
  remainingSeconds: MODES.pomodoro.seconds,
  isRunning: false,
  completedPomodoros: 0,
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
  syncRemainingTime();

  const activeMode = MODES[state.mode];
  elements.timerDisplay.textContent = formatTime(state.remainingSeconds);
  elements.modeCaption.textContent = activeMode.caption;
  elements.startPauseBtn.textContent = state.isRunning ? "Pause" : "Start";
  elements.sessionCount.textContent = `#${getCurrentSessionNumber()}`;
  elements.completedCount.textContent = state.completedPomodoros.toString();
  elements.nextLabel.textContent = getNextLabel();
  elements.statusCopy.textContent = state.statusCopy;

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
}

function completeSession() {
  stopInterval();
  state.isRunning = false;
  state.targetTime = null;
  state.remainingSeconds = 0;

  if (state.mode === "pomodoro") {
    state.completedPomodoros += 1;
    const nextMode = state.completedPomodoros % 4 === 0 ? "longBreak" : "shortBreak";
    switchMode(nextMode, "Fokusblock erledigt. Gonn dir kurz Abstand.");
    return;
  }

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
  state.intervalId = window.setInterval(tick, 250);
  render();
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

window.addEventListener("DOMContentLoaded", () => {
  elements.timerDisplay = document.querySelector("#timer-display");
  elements.modeCaption = document.querySelector("#mode-caption");
  elements.startPauseBtn = document.querySelector("#start-pause-btn");
  elements.resetBtn = document.querySelector("#reset-btn");
  elements.sessionCount = document.querySelector("#session-count");
  elements.completedCount = document.querySelector("#completed-count");
  elements.nextLabel = document.querySelector("#next-label");
  elements.statusCopy = document.querySelector("#status-copy");
  elements.modeTabs = Array.from(document.querySelectorAll(".mode-tab"));

  elements.startPauseBtn.addEventListener("click", toggleTimer);
  elements.resetBtn.addEventListener("click", resetTimer);

  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchMode(tab.dataset.mode);
    });
  });

  render();
});
