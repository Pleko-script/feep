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
const ANALYTICS_KEY = "pomofocus-analytics-v1";

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

const reportState = {
  range: "week",
  offset: 0,
};

const elements = {};
let analytics = createEmptyAnalytics();

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

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addYears(date, amount) {
  return new Date(date.getFullYear() + amount, 0, 1);
}

function startOfWeek(date) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - offset);
  return nextDate;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function createEmptyAnalytics() {
  return {
    daily: {},
  };
}

function saveAnalytics() {
  window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

function loadAnalytics() {
  const rawAnalytics = window.localStorage.getItem(ANALYTICS_KEY);

  if (!rawAnalytics) {
    analytics = createEmptyAnalytics();
    saveAnalytics();
    return;
  }

  try {
    const parsed = JSON.parse(rawAnalytics);
    analytics = {
      daily: parsed.daily && typeof parsed.daily === "object" ? parsed.daily : {},
    };
  } catch {
    analytics = createEmptyAnalytics();
  }

  saveAnalytics();
}

function ensureAnalyticsDay(dateKey) {
  if (!analytics.daily[dateKey]) {
    analytics.daily[dateKey] = {
      focusSeconds: 0,
      accessed: false,
    };
  }

  return analytics.daily[dateKey];
}

function markAccess(dateKey = getTodayKey()) {
  const entry = ensureAnalyticsDay(dateKey);
  entry.accessed = true;
  saveAnalytics();
}

function recordFocusSession(seconds, dateKey = getTodayKey()) {
  const entry = ensureAnalyticsDay(dateKey);
  entry.focusSeconds += seconds;
  entry.accessed = true;
  saveAnalytics();
}

function getSortedAccessedDates() {
  return Object.keys(analytics.daily)
    .filter((dateKey) => analytics.daily[dateKey]?.accessed)
    .sort();
}

function getAccessedDayCount() {
  return getSortedAccessedDates().length;
}

function getCurrentStreak() {
  const accessedDates = getSortedAccessedDates();

  if (accessedDates.length === 0) {
    return 0;
  }

  const accessedSet = new Set(accessedDates);
  let cursor = parseDateKey(getTodayKey());
  let streak = 0;

  while (accessedSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getTotalFocusHours() {
  const totalSeconds = Object.values(analytics.daily).reduce((sum, entry) => {
    return sum + (Number(entry.focusSeconds) || 0);
  }, 0);

  return totalSeconds / 3600;
}

function formatSummaryHours(hours) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hours < 10 ? 1 : 0,
    maximumFractionDigits: hours < 10 ? 1 : 1,
  }).format(hours);
}

function formatAxisValue(value) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(date, config) {
  if (config === "week") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  if (config === "month") {
    return String(date.getDate());
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(date);
}

function formatPeriodLabel(startDate, endDate, range) {
  if (range === "week") {
    if (reportState.offset === 0) {
      return "This Week";
    }

    const startLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(startDate);
    const endLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(endDate);
    return `${startLabel} - ${endLabel}`;
  }

  if (range === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(startDate);
  }

  return String(startDate.getFullYear());
}

function getChartDataset() {
  const today = new Date();
  const points = [];

  if (reportState.range === "week") {
    const startDate = addDays(startOfWeek(today), reportState.offset * 7);

    for (let index = 0; index < 7; index += 1) {
      const date = addDays(startDate, index);
      const dateKey = toDateKey(date);
      points.push({
        key: dateKey,
        label: formatDateLabel(date, "week"),
        valueHours: (analytics.daily[dateKey]?.focusSeconds || 0) / 3600,
        isCurrent: dateKey === getTodayKey(),
      });
    }

    return {
      points,
      label: formatPeriodLabel(startDate, addDays(startDate, 6), "week"),
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
        valueHours: (analytics.daily[dateKey]?.focusSeconds || 0) / 3600,
        isCurrent: dateKey === getTodayKey(),
      });
    }

    return {
      points,
      label: formatPeriodLabel(startDate, endDate, "month"),
    };
  }

  const startDate = addYears(startOfYear(today), reportState.offset);

  for (let month = 0; month < 12; month += 1) {
    const date = new Date(startDate.getFullYear(), month, 1);
    let focusSeconds = 0;

    Object.entries(analytics.daily).forEach(([dateKey, entry]) => {
      const pointDate = parseDateKey(dateKey);

      if (pointDate.getFullYear() === startDate.getFullYear() && pointDate.getMonth() === month) {
        focusSeconds += Number(entry.focusSeconds) || 0;
      }
    });

    points.push({
      key: `${startDate.getFullYear()}-${String(month + 1).padStart(2, "0")}`,
      label: formatDateLabel(date, "year"),
      valueHours: focusSeconds / 3600,
      isCurrent: reportState.offset === 0 && today.getMonth() === month,
    });
  }

  return {
    points,
    label: formatPeriodLabel(startDate, new Date(startDate.getFullYear(), 11, 31), "year"),
  };
}

function getChartScale(maxValue) {
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

function renderReport() {
  const dataset = getChartDataset();
  const peakValue = dataset.points.reduce((max, point) => Math.max(max, point.valueHours), 0);
  const scaleMax = getChartScale(peakValue);
  const scaleValues = Array.from({ length: 5 }, (_, index) => scaleMax - (scaleMax / 4) * index);

  elements.hoursFocused.textContent = formatSummaryHours(getTotalFocusHours());
  elements.daysAccessed.textContent = String(getAccessedDayCount());
  elements.dayStreak.textContent = String(getCurrentStreak());
  elements.periodLabel.textContent = dataset.label;
  elements.periodNext.disabled = reportState.offset === 0;

  elements.rangeTabs.forEach((tab) => {
    const isActive = tab.dataset.range === reportState.range;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive.toString());
  });

  const scaleMarkup = `
    <div class="chart-scale">
      ${scaleValues
        .map((value) => `<div class="chart-scale-label">${formatAxisValue(value)}</div>`)
        .join("")}
    </div>
  `;

  const barsMarkup = `
    <div class="chart-bars" style="--columns:${dataset.points.length}">
      ${dataset.points
        .map((point) => {
          const height = scaleMax === 0 ? 0 : (point.valueHours / scaleMax) * 100;
          return `
            <div class="chart-column" title="${point.label}: ${formatAxisValue(point.valueHours)} h">
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${Math.max(height, point.valueHours > 0 ? 2 : 0)}%"></div>
              </div>
              <div class="chart-x-label${point.isCurrent ? " is-current" : ""}">${point.label}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  elements.chartGrid.innerHTML = scaleMarkup + barsMarkup;
}

function syncDailyCount() {
  const today = getTodayKey();

  if (state.completedDate === today) {
    return;
  }

  state.completedDate = today;
  state.completedPomodoros = 0;
  markAccess(today);

  if (elements.chartGrid) {
    renderReport();
  }
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
    renderReport();
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
        const completedDateKey = toDateKey(new Date(savedState.targetTime));

        if (mode === "pomodoro") {
          recordFocusSession(MODES.pomodoro.seconds, completedDateKey);
          const completedToday = completedDateKey === getTodayKey();
          const completedInCycle = completedToday ? state.completedPomodoros + 1 : 1;

          if (completedToday) {
            state.completedPomodoros = completedInCycle;
          }

          state.mode = completedInCycle % 4 === 0 ? "longBreak" : "shortBreak";
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
  renderReport();
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
    recordFocusSession(MODES.pomodoro.seconds);
    renderReport();
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

function setReportRange(range) {
  reportState.range = range;
  reportState.offset = 0;
  renderReport();
}

function shiftReportPeriod(amount) {
  reportState.offset = Math.min(0, reportState.offset + amount);
  renderReport();
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
  elements.hoursFocused = document.querySelector("#hours-focused");
  elements.daysAccessed = document.querySelector("#days-accessed");
  elements.dayStreak = document.querySelector("#day-streak");
  elements.rangeTabs = Array.from(document.querySelectorAll(".range-tab"));
  elements.periodLabel = document.querySelector("#period-label");
  elements.periodPrev = document.querySelector("#period-prev");
  elements.periodNext = document.querySelector("#period-next");
  elements.chartGrid = document.querySelector("#chart-grid");

  loadAnalytics();
  markAccess();

  elements.startPauseBtn.addEventListener("click", toggleTimer);
  elements.resetBtn.addEventListener("click", resetTimer);
  elements.periodPrev.addEventListener("click", () => shiftReportPeriod(-1));
  elements.periodNext.addEventListener("click", () => shiftReportPeriod(1));
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", saveState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      syncRemainingTime();
      saveState();
    } else {
      markAccess();
      renderReport();
    }
  });

  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchMode(tab.dataset.mode);
    });
  });

  elements.rangeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setReportRange(tab.dataset.range);
    });
  });

  hydrateState();
});
