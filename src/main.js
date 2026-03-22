const MODES = {
  pomodoro: {
    label: "Pomodoro",
    caption: "Fokuszeit",
    message: "Zeit zum Fokussieren.",
  },
  shortBreak: {
    label: "Kurze Pause",
    caption: "Kurz erholen",
    message: "Kurz durchatmen und Schultern lockern.",
  },
  longBreak: {
    label: "Lange Pause",
    caption: "Richtig abschalten",
    message: "Große Pause verdient. Einmal richtig abschalten.",
  },
};

const DEFAULT_SETTINGS = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  microBreaksEnabled: false,
  microBreakVariant: "A",
};

const STORAGE_KEY = "pomofocus-state-v1";
const ANALYTICS_KEY = "pomofocus-analytics-v1";
const SETTINGS_KEY = "pomofocus-settings-v1";

const state = {
  mode: "pomodoro",
  remainingSeconds: DEFAULT_SETTINGS.pomodoro * 60,
  remainingByMode: createModeSecondsMap(DEFAULT_SETTINGS),
  isRunning: false,
  isTimeHidden: false,
  activeMicroBreak: null,
  nextMicroBreakIndex: 0,
  completedPomodoros: 0,
  completedDate: getTodayKey(),
  intervalId: null,
  targetTime: null,
};

const reportState = {
  range: "week",
  offset: 0,
};

const uiState = {
  openModal: null,
};

const elements = {};
let analytics = createEmptyAnalytics();
let settings = { ...DEFAULT_SETTINGS };
let audioContext = null;

function getAudioContext() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

function playToneSequence(sequence) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const startAt = Math.max(context.currentTime, 0.01);

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  sequence.reduce((offset, tone) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const toneStart = startAt + offset;
    const attack = Math.min(0.02, tone.duration / 3);
    const releaseStart = tone.duration * 0.65;

    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, toneStart);

    gainNode.gain.setValueAtTime(0.0001, toneStart);
    gainNode.gain.exponentialRampToValueAtTime(tone.volume ?? 0.05, toneStart + attack);
    gainNode.gain.setValueAtTime(tone.volume ?? 0.05, toneStart + releaseStart);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, toneStart + tone.duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + tone.duration);

    return offset + tone.duration + (tone.gap ?? 0);
  }, 0);
}

function playStartSound() {
  playToneSequence([
    { frequency: 660, duration: 0.09, gap: 0.02, volume: 0.035, type: "triangle" },
    { frequency: 880, duration: 0.12, volume: 0.045, type: "triangle" },
  ]);
}

function playPauseSound() {
  playToneSequence([
    { frequency: 520, duration: 0.08, gap: 0.015, volume: 0.03, type: "sine" },
    { frequency: 400, duration: 0.1, volume: 0.035, type: "sine" },
  ]);
}

function playCompleteSound() {
  playToneSequence([
    { frequency: 784, duration: 0.12, gap: 0.025, volume: 0.04, type: "triangle" },
    { frequency: 988, duration: 0.12, gap: 0.025, volume: 0.045, type: "triangle" },
    { frequency: 1174, duration: 0.24, volume: 0.05, type: "triangle" },
  ]);
}

function playMicroBreakStartSound() {
  playToneSequence([
    { frequency: 740, duration: 0.09, gap: 0.03, volume: 0.04, type: "sine" },
    { frequency: 740, duration: 0.09, volume: 0.04, type: "sine" },
  ]);
}

function playMicroBreakEndSound() {
  playToneSequence([
    { frequency: 932, duration: 0.1, gap: 0.03, volume: 0.04, type: "triangle" },
    { frequency: 1174, duration: 0.13, volume: 0.045, type: "triangle" },
  ]);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getTodayKey() {
  const now = new Date();
  return toDateKey(now);
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

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function getModeSeconds(mode) {
  return (settings[mode] ?? DEFAULT_SETTINGS[mode]) * 60;
}

function getMicroBreakSchedule(mode = state.mode, sourceSettings = settings) {
  if (mode !== "pomodoro" || !sourceSettings.microBreaksEnabled) {
    return [];
  }

  const pomodoroSeconds = getModeSecondsForSettings("pomodoro", sourceSettings);
  const variant = sourceSettings.microBreakVariant === "B" ? "B" : "A";
  const variantADuration = Math.min(60, Math.max(20, Math.round(pomodoroSeconds * 0.02)));
  const variantBDuration = Math.min(45, Math.max(20, Math.round(pomodoroSeconds * 0.015)));

  if (variant === "B") {
    return [
      { triggerSeconds: Math.round(pomodoroSeconds * 0.4), durationSeconds: variantBDuration },
      { triggerSeconds: Math.round(pomodoroSeconds * 0.78), durationSeconds: variantBDuration },
    ].filter((item, index, items) => item.triggerSeconds > 0 && (index === 0 || item.triggerSeconds > items[index - 1].triggerSeconds));
  }

  return [{ triggerSeconds: Math.round(pomodoroSeconds * 0.5), durationSeconds: variantADuration }];
}

function getCurrentMicroBreakRemaining() {
  if (!state.activeMicroBreak?.endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((state.activeMicroBreak.endsAt - Date.now()) / 1000));
}

function syncNextMicroBreakIndexForPomodoro() {
  if (state.mode !== "pomodoro") {
    state.nextMicroBreakIndex = 0;
    return;
  }

  if (state.activeMicroBreak) {
    return;
  }

  const elapsedSeconds = getModeSeconds("pomodoro") - state.remainingSeconds;
  state.nextMicroBreakIndex = getMicroBreakSchedule().filter((item) => elapsedSeconds >= item.triggerSeconds).length;
}

function getModeSecondsForSettings(mode, sourceSettings = settings) {
  return (sourceSettings[mode] ?? DEFAULT_SETTINGS[mode]) * 60;
}

function createModeSecondsMap(sourceSettings = settings) {
  return {
    pomodoro: getModeSecondsForSettings("pomodoro", sourceSettings),
    shortBreak: getModeSecondsForSettings("shortBreak", sourceSettings),
    longBreak: getModeSecondsForSettings("longBreak", sourceSettings),
  };
}

function clampModeRemaining(mode, value, sourceSettings = settings) {
  return Math.min(
    getModeSecondsForSettings(mode, sourceSettings),
    clampNumber(value, getModeSecondsForSettings(mode, sourceSettings), 1, 60 * 60 * 8),
  );
}

function setModeRemaining(mode, seconds) {
  state.remainingByMode[mode] = clampModeRemaining(mode, seconds);

  if (state.mode === mode) {
    state.remainingSeconds = state.remainingByMode[mode];
  }
}

function syncCurrentModeRemaining() {
  setModeRemaining(state.mode, state.remainingSeconds);
}

function resetModeRemaining(mode) {
  setModeRemaining(mode, getModeSeconds(mode));
}

function resetAllModeRemaining() {
  state.remainingByMode = createModeSecondsMap();
  state.remainingSeconds = state.remainingByMode[state.mode];
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
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(hours);
}

function formatAxisValue(value) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(date, range) {
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

function formatPeriodLabel(startDate, endDate, range) {
  if (range === "week") {
    if (reportState.offset === 0) {
      return "Diese Woche";
    }

    const startLabel = new Intl.DateTimeFormat("de-DE", {
      month: "short",
      day: "numeric",
    }).format(startDate);
    const endLabel = new Intl.DateTimeFormat("de-DE", {
      month: "short",
      day: "numeric",
    }).format(endDate);
    return `${startLabel} - ${endLabel}`;
  }

  if (range === "month") {
    return new Intl.DateTimeFormat("de-DE", {
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
  if (!elements.chartGrid) {
    return;
  }

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
            <div class="chart-column" title="${point.label}: ${formatAxisValue(point.valueHours)} Std.">
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

function saveSettings() {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const rawSettings = window.localStorage.getItem(SETTINGS_KEY);

  if (!rawSettings) {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    return;
  }

  try {
    const parsed = JSON.parse(rawSettings);
    settings = {
      pomodoro: clampNumber(parsed.pomodoro, DEFAULT_SETTINGS.pomodoro, 1, 180),
      shortBreak: clampNumber(parsed.shortBreak, DEFAULT_SETTINGS.shortBreak, 1, 60),
      longBreak: clampNumber(parsed.longBreak, DEFAULT_SETTINGS.longBreak, 1, 120),
      microBreaksEnabled: Boolean(parsed.microBreaksEnabled),
      microBreakVariant: parsed.microBreakVariant === "B" ? "B" : "A",
    };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  saveSettings();
}

function syncSettingsForm() {
  if (!elements.settingsPomodoro) {
    return;
  }

  elements.settingsPomodoro.value = String(settings.pomodoro);
  elements.settingsShortBreak.value = String(settings.shortBreak);
  elements.settingsLongBreak.value = String(settings.longBreak);
  elements.settingsMicroBreaksEnabled.checked = settings.microBreaksEnabled;
  elements.settingsMicroBreakVariant.value = settings.microBreakVariant;
  syncMicroBreakSettingsState(settings.microBreaksEnabled);
}

function syncMicroBreakSettingsState(isEnabled) {
  elements.settingsMicroBreakVariant.disabled = !isEnabled;

  if (elements.microBreakSettings) {
    elements.microBreakSettings.dataset.enabled = isEnabled ? "true" : "false";
  }

  if (elements.settingsMicroBreaksState) {
    elements.settingsMicroBreaksState.textContent = isEnabled ? "An" : "Aus";
  }
}

function applySettings(nextSettings) {
  settings = {
    pomodoro: clampNumber(nextSettings.pomodoro, DEFAULT_SETTINGS.pomodoro, 1, 180),
    shortBreak: clampNumber(nextSettings.shortBreak, DEFAULT_SETTINGS.shortBreak, 1, 60),
    longBreak: clampNumber(nextSettings.longBreak, DEFAULT_SETTINGS.longBreak, 1, 120),
    microBreaksEnabled: Boolean(nextSettings.microBreaksEnabled),
    microBreakVariant: nextSettings.microBreakVariant === "B" ? "B" : "A",
  };

  stopInterval();
  state.isRunning = false;
  state.targetTime = null;
  state.activeMicroBreak = null;
  state.nextMicroBreakIndex = 0;
  resetAllModeRemaining();
  saveSettings();
  syncSettingsForm();
  render();
  saveState();
}

function syncDailyCount() {
  const today = getTodayKey();

  if (state.completedDate === today) {
    return;
  }

  state.completedDate = today;
  state.completedPomodoros = 0;
  markAccess(today);
}

function saveState() {
  const snapshot = {
    mode: state.mode,
    remainingSeconds: state.remainingSeconds,
    remainingByMode: state.remainingByMode,
    isRunning: state.isRunning,
    isTimeHidden: state.isTimeHidden,
    activeMicroBreak: state.activeMicroBreak,
    nextMicroBreakIndex: state.nextMicroBreakIndex,
    completedPomodoros: state.completedPomodoros,
    completedDate: state.completedDate,
    targetTime: state.targetTime,
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
    state.remainingByMode = createModeSecondsMap();
    state.remainingSeconds = state.remainingByMode[state.mode];
    render();
    return;
  }

  try {
    const savedState = JSON.parse(rawState);
    const savedRemainingByMode = savedState.remainingByMode && typeof savedState.remainingByMode === "object" ? savedState.remainingByMode : {};

    state.mode = MODES[savedState.mode] ? savedState.mode : "pomodoro";
    state.isTimeHidden = Boolean(savedState.isTimeHidden);
    state.nextMicroBreakIndex = Number.isInteger(savedState.nextMicroBreakIndex) ? savedState.nextMicroBreakIndex : 0;
    state.activeMicroBreak =
      savedState.activeMicroBreak &&
      typeof savedState.activeMicroBreak === "object" &&
      typeof savedState.activeMicroBreak.endsAt === "number" &&
      typeof savedState.activeMicroBreak.resumeRemainingSeconds === "number"
        ? {
            endsAt: savedState.activeMicroBreak.endsAt,
            resumeRemainingSeconds: clampModeRemaining("pomodoro", savedState.activeMicroBreak.resumeRemainingSeconds),
            label: savedState.activeMicroBreak.label === "B2" ? "B2" : savedState.activeMicroBreak.label === "B1" ? "B1" : "A",
          }
        : null;
    state.completedDate = savedState.completedDate || getTodayKey();
    state.completedPomodoros = Number(savedState.completedPomodoros) || 0;
    state.remainingByMode = {
      pomodoro: clampModeRemaining(
        "pomodoro",
        savedRemainingByMode.pomodoro ?? (savedState.mode === "pomodoro" ? savedState.remainingSeconds : getModeSeconds("pomodoro")),
      ),
      shortBreak: clampModeRemaining(
        "shortBreak",
        savedRemainingByMode.shortBreak ?? (savedState.mode === "shortBreak" ? savedState.remainingSeconds : getModeSeconds("shortBreak")),
      ),
      longBreak: clampModeRemaining(
        "longBreak",
        savedRemainingByMode.longBreak ?? (savedState.mode === "longBreak" ? savedState.remainingSeconds : getModeSeconds("longBreak")),
      ),
    };

    syncDailyCount();

    if (state.activeMicroBreak) {
      if (state.activeMicroBreak.endsAt > Date.now()) {
        state.remainingSeconds = state.activeMicroBreak.resumeRemainingSeconds;
        state.intervalId = window.setInterval(tick, 250);
      } else {
        state.activeMicroBreak = null;
        state.remainingSeconds = state.remainingByMode[state.mode];
      }
      state.targetTime = null;
      state.isRunning = false;
    } else if (savedState.isRunning && typeof savedState.targetTime === "number") {
      state.targetTime = savedState.targetTime;
      state.isRunning = savedState.targetTime > Date.now();

      if (state.isRunning) {
        syncRemainingTime();
        state.intervalId = window.setInterval(tick, 250);
      } else {
        const completedDateKey = toDateKey(new Date(savedState.targetTime));

        if (savedState.mode === "pomodoro") {
          recordFocusSession(getModeSeconds("pomodoro"), completedDateKey);
          const baseCount = completedDateKey === getTodayKey() ? state.completedPomodoros : 0;
          const completedInCycle = baseCount + 1;

          if (completedDateKey === getTodayKey()) {
            state.completedPomodoros = completedInCycle;
          }

          resetModeRemaining("pomodoro");
          state.mode = completedInCycle % 4 === 0 ? "longBreak" : "shortBreak";
          resetModeRemaining(state.mode);
        } else {
          resetModeRemaining(savedState.mode);
          state.mode = "pomodoro";
          resetModeRemaining("pomodoro");
        }

        state.targetTime = null;
        state.isRunning = false;
      }
    } else {
      state.targetTime = null;
      state.isRunning = false;
      state.remainingSeconds = state.remainingByMode[state.mode];
    }

    syncNextMicroBreakIndexForPomodoro();
  } catch {
    state.mode = "pomodoro";
    state.remainingByMode = createModeSecondsMap();
    state.remainingSeconds = state.remainingByMode[state.mode];
    state.isRunning = false;
    state.isTimeHidden = false;
    state.activeMicroBreak = null;
    state.nextMicroBreakIndex = 0;
    state.completedPomodoros = 0;
    state.completedDate = getTodayKey();
    state.targetTime = null;
    syncNextMicroBreakIndexForPomodoro();
  }

  render();
  saveState();
}

function stopInterval() {
  if (state.intervalId) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function cancelMicroBreak() {
  state.activeMicroBreak = null;
}

function getRemainingMilliseconds(targetTime = state.targetTime) {
  if (!targetTime) {
    return 0;
  }

  return Math.max(0, targetTime - Date.now());
}

function syncRemainingTime() {
  if (!state.isRunning || !state.targetTime) {
    return 0;
  }

  const remainingMilliseconds = getRemainingMilliseconds();
  const secondsLeft = remainingMilliseconds <= 0 ? 0 : Math.ceil(remainingMilliseconds / 1000);
  state.remainingSeconds = secondsLeft;
  syncCurrentModeRemaining();
  return remainingMilliseconds;
}

function maybeTriggerMicroBreak() {
  if (!state.isRunning || state.mode !== "pomodoro" || state.activeMicroBreak) {
    return false;
  }

  const schedule = getMicroBreakSchedule();
  const nextBreak = schedule[state.nextMicroBreakIndex];

  if (!nextBreak) {
    return false;
  }

  const elapsedSeconds = getModeSeconds("pomodoro") - state.remainingSeconds;

  if (elapsedSeconds < nextBreak.triggerSeconds) {
    return false;
  }

  playMicroBreakStartSound();
  stopInterval();
  state.isRunning = false;
  state.targetTime = null;
  state.activeMicroBreak = {
    endsAt: Date.now() + nextBreak.durationSeconds * 1000,
    resumeRemainingSeconds: state.remainingSeconds,
    label: settings.microBreakVariant === "B" ? `B${state.nextMicroBreakIndex + 1}` : "A",
  };
  state.nextMicroBreakIndex += 1;
  state.intervalId = window.setInterval(tick, 250);
  render();
  saveState();
  return true;
}

function completeMicroBreak() {
  if (!state.activeMicroBreak) {
    return;
  }

  const resumeRemainingSeconds = state.activeMicroBreak.resumeRemainingSeconds;
  cancelMicroBreak();
  playMicroBreakEndSound();
  state.remainingSeconds = resumeRemainingSeconds;
  startTimer({ silent: true });
}

function render() {
  syncDailyCount();
  if (state.activeMicroBreak) {
    state.remainingSeconds = state.activeMicroBreak.resumeRemainingSeconds;
  } else {
    syncRemainingTime();
  }

  const activeMode = MODES[state.mode];
  const totalSeconds = getModeSeconds(state.mode);
  const progress = ((totalSeconds - state.remainingSeconds) / totalSeconds) * 100;
  const statusText = state.activeMicroBreak ? "Mikropause" : state.isRunning ? "Läuft" : "Pausiert";
  const hideTime = state.isTimeHidden;
  const displayedTime = state.activeMicroBreak ? formatTime(getCurrentMicroBreakRemaining()) : formatTime(state.remainingSeconds);

  elements.timerDisplay.textContent = displayedTime;
  elements.modeCaption.textContent = state.activeMicroBreak ? `Kurz stoppen · Variante ${state.activeMicroBreak.label}` : activeMode.caption;
  elements.timerStatusLabel.textContent = statusText;
  elements.timerStatus.dataset.state = state.activeMicroBreak ? "micro-break" : state.isRunning ? "running" : "paused";
  elements.timerStatus.setAttribute("aria-label", `Timer ist ${statusText}`);
  elements.timerStatus.hidden = !hideTime;
  elements.startPauseBtn.textContent = state.activeMicroBreak ? "Weiter" : state.isRunning ? "Pause" : "Start";
  elements.toggleFocusModeBtn.textContent = hideTime ? "Zeit zeigen" : "Zeit verbergen";
  elements.progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  elements.progressRail.hidden = hideTime;
  elements.timerDisplay.hidden = hideTime;
  document.title = hideTime ? `${statusText} · ${activeMode.label}` : `${displayedTime} · ${activeMode.label}`;

  elements.modeTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === state.mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive.toString());
  });

  renderReport();
}

function switchMode(mode) {
  syncRemainingTime();
  syncCurrentModeRemaining();
  stopInterval();
  cancelMicroBreak();
  state.mode = mode;
  state.remainingSeconds = state.remainingByMode[mode];
  state.targetTime = null;
  state.isRunning = false;
  syncNextMicroBreakIndexForPomodoro();
  render();
  saveState();
}

function completeSession() {
  const completedMode = state.mode;

  stopInterval();
  state.isRunning = false;
  state.targetTime = null;
  cancelMicroBreak();
  state.remainingSeconds = 0;
  setModeRemaining(completedMode, 0);
  playCompleteSound();

  if (completedMode === "pomodoro") {
    recordFocusSession(getModeSeconds("pomodoro"));
    state.completedPomodoros += 1;

    const nextMode = state.completedPomodoros % 4 === 0 ? "longBreak" : "shortBreak";
    showNotification("Pomodoro abgeschlossen", `Wechsel zu ${MODES[nextMode].label}.`);
    resetModeRemaining(completedMode);
    resetModeRemaining(nextMode);
    switchMode(nextMode);
    return;
  }

  showNotification("Pause beendet", "Die nächste Fokuszeit ist bereit.");
  resetModeRemaining(completedMode);
  resetModeRemaining("pomodoro");
  switchMode("pomodoro");
}

function tick() {
  if (state.activeMicroBreak) {
    if (getCurrentMicroBreakRemaining() <= 0) {
      completeMicroBreak();
      return;
    }

    render();
    return;
  }

  const remainingMilliseconds = syncRemainingTime();

  if (maybeTriggerMicroBreak()) {
    return;
  }

  if (remainingMilliseconds <= 0 || state.remainingSeconds <= 0) {
    completeSession();
    return;
  }

  render();
}

function startTimer(options = {}) {
  if (state.activeMicroBreak) {
    completeMicroBreak();
    return;
  }

  if (state.isRunning) {
    return;
  }

  if (state.mode === "pomodoro" && state.remainingSeconds === getModeSeconds("pomodoro")) {
    state.nextMicroBreakIndex = 0;
  } else if (state.mode === "pomodoro") {
    syncNextMicroBreakIndexForPomodoro();
  }

  if (!options.silent) {
    playStartSound();
  }
  state.isRunning = true;
  state.targetTime = Date.now() + state.remainingSeconds * 1000;
  ensureNotificationPermission();
  state.intervalId = window.setInterval(tick, 250);
  render();
  saveState();
}

function pauseTimer() {
  if (state.activeMicroBreak) {
    cancelMicroBreak();
    stopInterval();
    state.remainingSeconds = state.remainingByMode[state.mode];
    syncNextMicroBreakIndexForPomodoro();
    render();
    saveState();
    return;
  }

  if (!state.isRunning) {
    return;
  }

  playPauseSound();
  syncRemainingTime();
  stopInterval();
  state.targetTime = null;
  state.isRunning = false;
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
  stopInterval();
  state.isRunning = false;
  state.targetTime = null;
  cancelMicroBreak();
  resetModeRemaining(state.mode);
  syncNextMicroBreakIndexForPomodoro();
  render();
  saveState();
}

function toggleFocusMode() {
  state.isTimeHidden = !state.isTimeHidden;
  render();
  saveState();
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

function openModal(name) {
  uiState.openModal = name;
  elements.reportModal.hidden = name !== "report";
  elements.settingsModal.hidden = name !== "settings";

  if (name === "report") {
    renderReport();
  }

  if (name === "settings") {
    syncSettingsForm();
  }
}

function closeModal() {
  uiState.openModal = null;
  elements.reportModal.hidden = true;
  elements.settingsModal.hidden = true;
}

function handleKeydown(event) {
  const target = event.target;
  const isEditable = target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']");

  if (event.key === "Escape" && uiState.openModal) {
    closeModal();
    return;
  }

  if (isEditable || uiState.openModal) {
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

function handleSettingsSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  applySettings({
    pomodoro: formData.get("pomodoro"),
    shortBreak: formData.get("shortBreak"),
    longBreak: formData.get("longBreak"),
    microBreaksEnabled: formData.get("microBreaksEnabled") === "on",
    microBreakVariant: formData.get("microBreakVariant"),
  });
  closeModal();
}

function resetSettingsInputs() {
  elements.settingsPomodoro.value = String(DEFAULT_SETTINGS.pomodoro);
  elements.settingsShortBreak.value = String(DEFAULT_SETTINGS.shortBreak);
  elements.settingsLongBreak.value = String(DEFAULT_SETTINGS.longBreak);
  elements.settingsMicroBreaksEnabled.checked = DEFAULT_SETTINGS.microBreaksEnabled;
  elements.settingsMicroBreakVariant.value = DEFAULT_SETTINGS.microBreakVariant;
  syncMicroBreakSettingsState(DEFAULT_SETTINGS.microBreaksEnabled);
}

window.addEventListener("DOMContentLoaded", () => {
  elements.timerDisplay = document.querySelector("#timer-display");
  elements.timerStatus = document.querySelector("#timer-status");
  elements.timerStatusLabel = document.querySelector("#timer-status-label");
  elements.modeCaption = document.querySelector("#mode-caption");
  elements.progressRail = document.querySelector("#progress-rail");
  elements.progressBar = document.querySelector("#progress-bar");
  elements.startPauseBtn = document.querySelector("#start-pause-btn");
  elements.resetBtn = document.querySelector("#reset-btn");
  elements.toggleFocusModeBtn = document.querySelector("#toggle-focus-mode-btn");
  elements.modeTabs = Array.from(document.querySelectorAll(".mode-tab"));
  elements.openReportBtn = document.querySelector("#open-report-btn");
  elements.openSettingsBtn = document.querySelector("#open-settings-btn");
  elements.reportModal = document.querySelector("#report-modal");
  elements.settingsModal = document.querySelector("#settings-modal");
  elements.hoursFocused = document.querySelector("#hours-focused");
  elements.daysAccessed = document.querySelector("#days-accessed");
  elements.dayStreak = document.querySelector("#day-streak");
  elements.rangeTabs = Array.from(document.querySelectorAll(".range-tab"));
  elements.periodLabel = document.querySelector("#period-label");
  elements.periodPrev = document.querySelector("#period-prev");
  elements.periodNext = document.querySelector("#period-next");
  elements.chartGrid = document.querySelector("#chart-grid");
  elements.settingsForm = document.querySelector("#settings-form");
  elements.settingsPomodoro = document.querySelector("#settings-pomodoro");
  elements.settingsShortBreak = document.querySelector("#settings-short-break");
  elements.settingsLongBreak = document.querySelector("#settings-long-break");
  elements.microBreakSettings = document.querySelector("#micro-break-settings");
  elements.settingsMicroBreaksEnabled = document.querySelector("#settings-micro-breaks-enabled");
  elements.settingsMicroBreaksState = document.querySelector("#settings-micro-breaks-state");
  elements.settingsMicroBreakVariant = document.querySelector("#settings-micro-break-variant");
  elements.settingsResetDefaults = document.querySelector("#settings-reset-defaults");

  loadSettings();
  syncSettingsForm();
  loadAnalytics();
  markAccess();

  elements.startPauseBtn.addEventListener("click", toggleTimer);
  elements.resetBtn.addEventListener("click", resetTimer);
  elements.toggleFocusModeBtn.addEventListener("click", toggleFocusMode);
  elements.openReportBtn.addEventListener("click", () => openModal("report"));
  elements.openSettingsBtn.addEventListener("click", () => openModal("settings"));
  elements.periodPrev.addEventListener("click", () => shiftReportPeriod(-1));
  elements.periodNext.addEventListener("click", () => shiftReportPeriod(1));
  elements.settingsForm.addEventListener("submit", handleSettingsSubmit);
  elements.settingsResetDefaults.addEventListener("click", resetSettingsInputs);
  elements.settingsMicroBreaksEnabled.addEventListener("change", () => {
    syncMicroBreakSettingsState(elements.settingsMicroBreaksEnabled.checked);
  });

  document.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest("[data-close-modal]");

    if (closeTrigger) {
      closeModal();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      syncRemainingTime();
      saveState();
      return;
    }

    markAccess();
    renderReport();
  });

  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", saveState);

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
