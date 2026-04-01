/* ═══════════════════════════════════════════════════════
   HABIT TRACKER — script.js
   Includes: Dashboard, Habits, Calendar (heatmap + month + week),
             Profile (edit, avatar, XP, settings, danger zone)
═══════════════════════════════════════════════════════ */

"use strict";

/* ─── Constants ─── */
const THEME_KEY = "habit-tracker-theme";
const PROFILE_KEY = "habit-tracker-profile";
const AUTH_KEY = "habit-tracker-auth";
const LOGIN_PAGE = "index.html";
const DASHBOARD_PAGE = "dashboard.html";
const TODAY = new Date(2026, 2, 24); // March 24 2026 (demo date)
const currentPage = document.body?.dataset?.page || "";
const isAuthPage = currentPage === "auth";
const isDashboardPage = currentPage === "dashboard";

/* ─── DOM refs ─── */
const navButtons      = document.querySelectorAll(".nav-btn");
const chips           = document.querySelectorAll("#view-habits .chip");
const themeToggleBtn  = document.getElementById("theme-toggle");
const themeIcon       = document.querySelector(".theme-icon");
const weeklyCanvas    = document.getElementById("weekly-overview-chart");
const trendCanvas     = document.getElementById("trend-chart");

const views = {
  dashboard : document.getElementById("view-dashboard"),
  habits    : document.getElementById("view-habits"),
  calendar  : document.getElementById("view-calendar"),
  profile   : document.getElementById("view-profile"),
};

const dashboardSection = views.dashboard;
const habitsSection    = views.habits;
const statCards        = dashboardSection ? dashboardSection.querySelectorAll(".stat-card") : [];
const habitsItems      = habitsSection ? habitsSection.querySelectorAll(".heading-row,.filters-card,.tabs-row,.habits-empty-panel") : [];

const authShell        = document.getElementById("auth-shell");
const appShell         = document.getElementById("app-shell");

const authState = {
  mode: "login",
  authenticated: false,
};

const authEls = {
  card: document.getElementById("auth-card"),
  title: document.getElementById("auth-title"),
  subtitle: document.getElementById("auth-subtitle"),
  btn: document.getElementById("main-btn"),
  toggleLogin: document.getElementById("toggle-login"),
  toggleSignup: document.getElementById("toggle-signup"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  error: document.getElementById("error-msg"),
  form: document.getElementById("auth-form"),
};

/* ─── State ─── */
let weeklyChart = null;
let trendChart  = null;
let appInitialized = false;

let calState = {
  activeTab   : "heatmap",   // heatmap | month | week
  monthDate   : new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
  weekStart   : getWeekStart(TODAY),
  selectedDay : new Date(TODAY),
};

let profileState = {
  name    : "User",
  email   : "user@email.com",
  initial : "U",
  avatar  : null,  // base64 image or null
};

/* ═════════════════════════════════════════
   AUTH
═════════════════════════════════════════ */
function loadAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (saved && typeof saved.authenticated === "boolean") {
      authState.authenticated = saved.authenticated;
    }
  } catch (_) {}
}

function saveAuth() {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ authenticated: authState.authenticated }));
}

function setAuthMode(mode) {
  authState.mode = mode;
  if (!authEls.form) return;

  authEls.error.textContent = "";
  const isLogin = mode === "login";

  authEls.title.textContent = isLogin ? "Login" : "Sign Up";
  authEls.subtitle.textContent = isLogin
    ? "Enter your details to access your account."
    : "Start building better habits today.";
  authEls.btn.textContent = isLogin ? "Login" : "Create Account";

  authEls.toggleLogin.classList.toggle("active", isLogin);
  authEls.toggleSignup.classList.toggle("active", !isLogin);
  authEls.toggleLogin.setAttribute("aria-selected", String(isLogin));
  authEls.toggleSignup.setAttribute("aria-selected", String(!isLogin));

  authEls.password.setAttribute("autocomplete", isLogin ? "current-password" : "new-password");
}

function showAuthScreen() {
  if (isAuthPage) {
    if (authShell) authShell.hidden = false;
    return;
  }
  window.location.replace(LOGIN_PAGE);
}

function showAppScreen() {
  if (!isDashboardPage) {
    window.location.replace(DASHBOARD_PAGE);
    return;
  }

  if (!appInitialized) {
    setActiveView("dashboard");
    createCharts();
    updateChartsTheme();
    const dashDate = document.getElementById("dash-today-date");
    if (dashDate) dashDate.textContent = formatFull(TODAY);
    appInitialized = true;
  } else {
    renderProfile();
    refreshCharts();
  }
}

function initAuth() {
  if (!authEls.form) return;

  setAuthMode("login");

  authEls.toggleLogin?.addEventListener("click", () => setAuthMode("login"));
  authEls.toggleSignup?.addEventListener("click", () => setAuthMode("signup"));

  authEls.form.addEventListener("submit", e => {
    e.preventDefault();
    authEls.error.textContent = "";

    const email = authEls.email.value.trim();
    const pass = authEls.password.value;

    if (!email || !pass) {
      authEls.error.textContent = "All fields are required.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      authEls.error.textContent = "Please enter a valid email address.";
      return;
    }
    if (pass.length < 6) {
      authEls.error.textContent = "Password must be at least 6 characters.";
      return;
    }

    authEls.btn.disabled = true;
    authEls.btn.style.opacity = "0.7";
    authEls.btn.textContent = authState.mode === "login" ? "Logging in..." : "Creating account...";

    setTimeout(() => {
      const derivedName = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "User";
      profileState.name = derivedName.replace(/\b\w/g, c => c.toUpperCase());
      profileState.email = email;
      profileState.initial = profileState.name.charAt(0).toUpperCase();
      saveProfile();

      authState.authenticated = true;
      saveAuth();
      window.location.assign(DASHBOARD_PAGE);

      authEls.btn.disabled = false;
      authEls.btn.style.opacity = "1";
      authEls.form.reset();
      setAuthMode("login");
    }, 700);
  });
}

/* ═════════════════════════════════════════
   THEME
═════════════════════════════════════════ */
function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.body.classList.toggle("dark", dark);
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute("aria-pressed", String(dark));
    themeToggleBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  if (themeIcon) themeIcon.textContent = dark ? "☀" : "🌙";

  // Profile page theme toggle mirror
  const ptToggle = document.getElementById("profile-theme-toggle");
  if (ptToggle) ptToggle.setAttribute("aria-checked", String(dark));

  updateChartsTheme();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "dark" ? "dark" : (saved === "light" ? "light" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")));
}

function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

themeToggleBtn?.addEventListener("click", toggleTheme);

/* ═════════════════════════════════════════
   VIEW NAVIGATION
═════════════════════════════════════════ */
function setActiveView(name) {
  navButtons.forEach(btn => {
    const active = btn.dataset.view === name;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
  });
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    const active = k === name;
    el.classList.toggle("active", active);
    el.hidden = !active;
  });

  if (name === "dashboard") { animateDashboard(); refreshCharts(); }
  if (name === "habits")    { animateHabits(); }
  if (name === "calendar")  { initCalendar(); }
  if (name === "profile")   { renderProfile(); }
}

navButtons.forEach(btn => {
  btn.addEventListener("click", () => setActiveView(btn.dataset.view));
  btn.addEventListener("keydown", e => {
    if (!["ArrowRight","ArrowLeft","Home","End"].includes(e.key)) return;
    e.preventDefault();
    const list = Array.from(navButtons);
    const i = list.findIndex(b => b.classList.contains("active"));
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % list.length;
    if (e.key === "ArrowLeft")  n = (i - 1 + list.length) % list.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End")  n = list.length - 1;
    list[n].focus();
    setActiveView(list[n].dataset.view);
  });
});

/* ═════════════════════════════════════════
   DASHBOARD ANIMATIONS
═════════════════════════════════════════ */
function animateDashboard() {
  if (!statCards.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  statCards.forEach((card, i) => {
    card.style.setProperty("--stagger-delay", `${i * 90}ms`);
    card.classList.remove("is-animating");
    void card.offsetWidth;
    card.classList.add("is-animating");
  });

  // Today date
  const el = document.getElementById("dash-today-date");
  if (el) el.textContent = formatFull(TODAY);
}

function animateHabits() {
  if (!habitsItems.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  habitsItems.forEach((s, i) => {
    s.style.setProperty("--habits-delay", `${i * 90}ms`);
    s.classList.remove("is-habits-animating");
    void s.offsetWidth;
    s.classList.add("is-habits-animating");
  });
}

/* ─── Habit chips ─── */
chips.forEach(chip => {
  chip.addEventListener("click", () => {
    chips.forEach(c => { c.classList.toggle("active", c === chip); c.setAttribute("aria-pressed", String(c === chip)); });
  });
});

/* ═════════════════════════════════════════
   CHARTS
═════════════════════════════════════════ */
function getChartPalette() {
  const cs = getComputedStyle(document.body);
  return {
    text   : cs.getPropertyValue("--text").trim()         || "#0f172a",
    muted  : cs.getPropertyValue("--muted-strong").trim() || "#64748b",
    grid   : cs.getPropertyValue("--chart-grid").trim()   || "#edf1f7",
    blue   : cs.getPropertyValue("--blue").trim()         || "#3b82f6",
    green  : cs.getPropertyValue("--green").trim()        || "#22c55e",
  };
}

function createCharts() {
  if (typeof Chart === "undefined" || !weeklyCanvas || !trendCanvas) return;
  const p = getChartPalette();
  const sc = {
    border: { color: p.grid },
    grid  : { color: p.grid, drawTicks: false },
    ticks : { color: p.muted, font: { size: 11, weight: "600" } },
  };

  weeklyChart = new Chart(weeklyCanvas, {
    type: "bar",
    data: {
      labels  : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
      datasets: [{ label:"Habits completed", data:[1,2,3,2,4,3,2], backgroundColor:`${p.blue}bf`, borderColor:p.blue, borderWidth:1, borderRadius:6, maxBarThickness:26 }],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:{ displayColors:false, callbacks:{ label:ctx=>`${ctx.parsed.y} completed` } } },
      scales:{ x:{...sc}, y:{...sc, beginAtZero:true, suggestedMax:5, ticks:{...sc.ticks, stepSize:1 } } },
    },
  });

  trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels  : ["03/17","03/18","03/19","03/20","03/21","03/22","03/23"],
      datasets: [{ label:"Completion %", data:[10,25,32,40,45,58,70], borderColor:p.blue, backgroundColor:`${p.green}26`, fill:true, tension:.35, pointRadius:4, pointHoverRadius:6, pointBackgroundColor:"#ffffff", pointBorderColor:p.blue, pointBorderWidth:2 }],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:ctx=>`${ctx.parsed.y}% completion` } } },
      scales:{ x:{...sc}, y:{...sc, beginAtZero:true, max:100, ticks:{...sc.ticks, stepSize:20, callback:v=>`${v}%` } } },
    },
  });
}

function updateChartsTheme() {
  const p = getChartPalette();
  [weeklyChart, trendChart].filter(Boolean).forEach(c => {
    c.options.scales.x.grid.color = p.grid;
    c.options.scales.y.grid.color = p.grid;
    c.options.scales.x.border.color = p.grid;
    c.options.scales.y.border.color = p.grid;
    c.options.scales.x.ticks.color = p.muted;
    c.options.scales.y.ticks.color = p.muted;
  });
  if (weeklyChart) { weeklyChart.data.datasets[0].backgroundColor=`${p.blue}bf`; weeklyChart.data.datasets[0].borderColor=p.blue; weeklyChart.update("none"); }
  if (trendChart)  { trendChart.data.datasets[0].borderColor=p.blue; trendChart.data.datasets[0].backgroundColor=`${p.green}26`; trendChart.data.datasets[0].pointBorderColor=p.blue; trendChart.update("none"); }
}

function refreshCharts() {
  const charts = [weeklyChart, trendChart].filter(Boolean);
  if (!charts.length) return;
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    charts.forEach(c => {
      c.resize();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { c.update("none"); return; }
      c.reset(); c.update();
    });
  }));
}

/* ═════════════════════════════════════════
   CALENDAR HELPERS
═════════════════════════════════════════ */
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatFull(date) {
  return date.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}
function formatShort(date) {
  return date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}
function formatMonthYear(date) {
  return date.toLocaleDateString("en-US", { month:"long", year:"numeric" });
}

/* Fake habit data generator — replace with real API */
function getFakeHabitsForDate(date) {
  /* No habits yet — returns empty. Swap this with your backend call. */
  return [];
}

/* Fake activity level for heatmap (0–4) */
function activityLevel(date) {
  if (date > TODAY) return -1; // future
  const seed = date.getDate() + date.getMonth() * 31;
  if (seed % 5 === 0) return 0;
  return (seed % 4) + 1;
}

/* ═════════════════════════════════════════
   CALENDAR INIT & TAB SWITCHING
═════════════════════════════════════════ */
function initCalendar() {
  setupCalTabs();
  renderHeatmap();
  renderMonth();
  renderWeek();
  renderDayPanel(calState.selectedDay);
}

function setupCalTabs() {
  const tabs = {
    heatmap : document.getElementById("cal-tab-heatmap"),
    month   : document.getElementById("cal-tab-month"),
    week    : document.getElementById("cal-tab-week"),
  };
  const panels = {
    heatmap : document.getElementById("cal-panel-heatmap"),
    month   : document.getElementById("cal-panel-month"),
    week    : document.getElementById("cal-panel-week"),
  };

  function activateTab(name) {
    calState.activeTab = name;
    Object.entries(tabs).forEach(([k, btn]) => {
      btn.classList.toggle("active", k === name);
      btn.setAttribute("aria-pressed", String(k === name));
    });
    Object.entries(panels).forEach(([k, panel]) => {
      panel.style.display = k === name ? "" : "none";
    });
  }

  Object.entries(tabs).forEach(([k, btn]) => {
    btn.addEventListener("click", () => activateTab(k));
  });
  activateTab(calState.activeTab);
}

/* ═════════════════════════════════════════
   HEATMAP
═════════════════════════════════════════ */
function renderHeatmap() {
  const grid    = document.getElementById("heatmap-grid");
  const tooltip = document.getElementById("hm-tooltip");
  const ttDate  = document.getElementById("hm-tt-date");
  const ttHab   = document.getElementById("hm-tt-habits");
  const ttPct   = document.getElementById("hm-tt-pct");
  if (!grid) return;

  grid.innerHTML = "";

  for (let i = 89; i >= 0; i--) {
    const date  = addDays(TODAY, -i);
    const level = activityLevel(date);
    const cell  = document.createElement("div");
    cell.className = "hm-cell" + (level > 0 ? ` lv${level}` : "");
    if (level < 0) cell.style.opacity = ".3";

    cell.addEventListener("mouseenter", e => {
      ttDate.textContent  = formatShort(date);
      ttHab.textContent   = level <= 0 ? "0/0 habits completed" : `${level}/4 habits completed`;
      ttPct.textContent   = level <= 0 ? "0%" : `${Math.round(level/4*100)}%`;
      tooltip.style.display = "block";
      tooltip.setAttribute("aria-hidden","false");
      moveTooltip(e);
    });
    cell.addEventListener("mousemove", moveTooltip);
    cell.addEventListener("mouseleave", () => { tooltip.style.display="none"; tooltip.setAttribute("aria-hidden","true"); });
    cell.addEventListener("click", () => selectDay(date));

    if (isSameDay(date, calState.selectedDay)) cell.classList.add("selected");
    grid.appendChild(cell);
  }

  function moveTooltip(e) {
    tooltip.style.left = `${e.clientX - tooltip.offsetWidth/2}px`;
    tooltip.style.top  = `${e.clientY - tooltip.offsetHeight - 16}px`;
  }
}

/* ═════════════════════════════════════════
   MONTH VIEW
═════════════════════════════════════════ */
function renderMonth() {
  const title = document.getElementById("month-title");
  const grid  = document.getElementById("month-grid");
  if (!grid || !title) return;

  const year  = calState.monthDate.getFullYear();
  const month = calState.monthDate.getMonth();
  title.textContent = formatMonthYear(calState.monthDate);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  grid.innerHTML = "";

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(year, month-1, daysInPrev - i);
    grid.appendChild(buildMonthDay(d, true));
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(buildMonthDay(new Date(year, month, d), false));
  }
  // Next month padding
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    grid.appendChild(buildMonthDay(new Date(year, month+1, d), true));
  }
}

function buildMonthDay(date, otherMonth) {
  const cell = document.createElement("div");
  cell.className = "month-day" + (otherMonth ? " other-month" : "");
  if (isSameDay(date, TODAY))              cell.classList.add("is-today");
  if (isSameDay(date, calState.selectedDay)) cell.classList.add("selected");

  const num = document.createElement("span");
  num.className   = "month-day-num";
  num.textContent = date.getDate();
  cell.appendChild(num);

  // Status dots (demo: use activity level to simulate)
  const level = activityLevel(date);
  if (level > 0 && !otherMonth) {
    const dots = document.createElement("div");
    dots.className = "month-day-dots";
    if (level >= 3) { const d=document.createElement("span"); d.className="m-dot s-completed"; dots.appendChild(d); }
    if (level === 2) { const d=document.createElement("span"); d.className="m-dot s-pending"; dots.appendChild(d); }
    if (level === 1) { const d=document.createElement("span"); d.className="m-dot s-missed"; dots.appendChild(d); }
    cell.appendChild(dots);
  }

  if (!otherMonth) cell.addEventListener("click", () => selectDay(date));
  return cell;
}

document.getElementById("month-prev")?.addEventListener("click", () => {
  calState.monthDate.setMonth(calState.monthDate.getMonth() - 1);
  renderMonth();
});
document.getElementById("month-next")?.addEventListener("click", () => {
  calState.monthDate.setMonth(calState.monthDate.getMonth() + 1);
  renderMonth();
});

/* ═════════════════════════════════════════
   WEEK VIEW
═════════════════════════════════════════ */
function renderWeek() {
  const title = document.getElementById("week-title");
  const grid  = document.getElementById("week-grid");
  if (!grid || !title) return;

  const ws  = calState.weekStart;
  const we  = addDays(ws, 6);
  title.textContent = `${formatShort(ws)} – ${formatShort(we)}`;
  grid.innerHTML    = "";

  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  for (let i = 0; i < 7; i++) {
    const date  = addDays(ws, i);
    const level = activityLevel(date);
    const col   = document.createElement("div");
    col.className = "week-day-col";
    if (isSameDay(date, TODAY))              col.classList.add("is-today");
    if (isSameDay(date, calState.selectedDay)) col.classList.add("selected");

    col.innerHTML = `
      <div class="week-day-name">${dayNames[date.getDay()]}</div>
      <div class="week-day-num">${date.getDate()}</div>
      <div class="week-habit-dots" id="wk-dots-${i}"></div>
    `;

    const dotsEl = col.querySelector(`#wk-dots-${i}`);
    if (level > 0 && date <= TODAY) {
      const statuses = level >= 3 ? ["s-completed","s-completed"] : level === 2 ? ["s-pending"] : ["s-missed"];
      const labels   = { "s-completed":"Done","s-missed":"Missed","s-pending":"Pending" };
      statuses.forEach(s => {
        const p = document.createElement("div");
        p.className = `week-habit-pill ${s}`;
        p.textContent = labels[s];
        dotsEl.appendChild(p);
      });
    }

    col.addEventListener("click", () => selectDay(date));
    grid.appendChild(col);
  }
}

document.getElementById("week-prev")?.addEventListener("click", () => {
  calState.weekStart = addDays(calState.weekStart, -7);
  renderWeek();
});
document.getElementById("week-next")?.addEventListener("click", () => {
  calState.weekStart = addDays(calState.weekStart, 7);
  renderWeek();
});

/* ═════════════════════════════════════════
   DAY SELECTION & DETAIL PANEL
═════════════════════════════════════════ */
function selectDay(date) {
  calState.selectedDay = new Date(date);
  renderDayPanel(date);
  // Update selections in active view
  refreshCalSelections();
}

function refreshCalSelections() {
  // Heatmap
  document.querySelectorAll(".hm-cell.selected").forEach(c => c.classList.remove("selected"));
  // Month
  document.querySelectorAll(".month-day.selected").forEach(c => c.classList.remove("selected"));
  // Week
  document.querySelectorAll(".week-day-col.selected").forEach(c => c.classList.remove("selected"));

  // Re-render affected panels to pick up new selection
  if (calState.activeTab === "heatmap") renderHeatmap();
  if (calState.activeTab === "month")   renderMonth();
  if (calState.activeTab === "week")    renderWeek();
}

function renderDayPanel(date) {
  const titleEl   = document.getElementById("cal-day-title");
  const listEl    = document.getElementById("day-habits-list");
  const doneBadge = document.getElementById("day-done-badge");
  const missedBadge = document.getElementById("day-missed-badge");
  const pendingBadge = document.getElementById("day-pending-badge");
  if (!titleEl || !listEl) return;

  titleEl.textContent = formatFull(date);

  const habits = getFakeHabitsForDate(date);
  const done    = habits.filter(h=>h.status==="completed").length;
  const missed  = habits.filter(h=>h.status==="missed").length;
  const pending = habits.filter(h=>h.status==="pending").length;

  if (doneBadge)   doneBadge.textContent   = `${done} done`;
  if (missedBadge) missedBadge.textContent = `${missed} missed`;
  if (pendingBadge) pendingBadge.textContent = `${pending} pending`;

  if (!habits.length) {
    listEl.innerHTML = `<div class="empty-state compact"><p style="margin:0">No active habits for this date.</p></div>`;
    return;
  }

  const icons = { completed:"✓", missed:"✗", pending:"○" };
  listEl.innerHTML = habits.map(h => `
    <div class="habit-row">
      <div class="habit-status-icon s-${h.status}">${icons[h.status]||"○"}</div>
      <div class="habit-row-info">
        <p class="habit-row-name">${h.name}</p>
        <p class="habit-row-cat">${h.category || "General"}</p>
      </div>
      <span class="habit-row-status s-${h.status}">${h.status.charAt(0).toUpperCase()+h.status.slice(1)}</span>
    </div>
  `).join("");
}

/* ═════════════════════════════════════════
   PROFILE
═════════════════════════════════════════ */
function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (saved) profileState = { ...profileState, ...saved };
  } catch (_) {}
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileState));
}

function renderProfile() {
  // Avatar
  const avatarEl = document.getElementById("profile-avatar-display");
  if (avatarEl) {
    if (profileState.avatar) {
      avatarEl.innerHTML = `<img src="${profileState.avatar}" alt="Profile picture" />`;
    } else {
      avatarEl.innerHTML = profileState.initial || profileState.name.charAt(0).toUpperCase() || "U";
    }
  }

  // Name / email
  const nameDisp  = document.getElementById("profile-name-display");
  const emailDisp = document.getElementById("profile-email-display");
  if (nameDisp)  nameDisp.textContent  = profileState.name;
  if (emailDisp) emailDisp.textContent = profileState.email;

  // Sync dashboard greeting
  const dashUser = document.getElementById("dash-username");
  if (dashUser) dashUser.textContent = profileState.name;

  // Dark mode toggle mirror
  const ptToggle = document.getElementById("profile-theme-toggle");
  if (ptToggle) {
    const dark = document.documentElement.classList.contains("dark");
    ptToggle.setAttribute("aria-checked", String(dark));
  }
}

/* Edit form */
document.getElementById("profile-edit-btn")?.addEventListener("click", () => {
  const card = document.getElementById("profile-edit-card");
  if (!card) return;
  document.getElementById("edit-name").value  = profileState.name;
  document.getElementById("edit-email").value = profileState.email;
  card.style.display = "";
  card.scrollIntoView({ behavior:"smooth", block:"nearest" });
});

document.getElementById("profile-cancel-btn")?.addEventListener("click", () => {
  document.getElementById("profile-edit-card").style.display = "none";
  clearFormErrors();
});

document.getElementById("profile-save-btn")?.addEventListener("click", () => {
  if (!validateEditForm()) return;

  profileState.name  = document.getElementById("edit-name").value.trim();
  profileState.email = document.getElementById("edit-email").value.trim();
  profileState.initial = profileState.name.charAt(0).toUpperCase();
  saveProfile();
  renderProfile();
  document.getElementById("profile-edit-card").style.display = "none";
  showToast("Profile updated successfully!");
});

function validateEditForm() {
  clearFormErrors();
  let valid = true;

  const name = document.getElementById("edit-name").value.trim();
  if (!name) { showFieldError("err-name","Name is required."); valid=false; }

  const email = document.getElementById("edit-email").value.trim();
  if (!email) { showFieldError("err-email","Email is required."); valid=false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError("err-email","Enter a valid email."); valid=false; }

  const pw  = document.getElementById("edit-password").value;
  const pw2 = document.getElementById("edit-password-confirm").value;
  if (pw && pw.length < 6) { showFieldError("err-password","Password must be at least 6 characters."); valid=false; }
  if (pw && pw !== pw2)    { showFieldError("err-password-confirm","Passwords do not match."); valid=false; }

  return valid;
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearFormErrors() {
  ["err-name","err-email","err-password","err-password-confirm"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

/* Avatar upload */
document.getElementById("profile-avatar-input")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast("Image must be under 2 MB."); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    profileState.avatar = ev.target.result;
    saveProfile();
    renderProfile();
    showToast("Avatar updated!");
  };
  reader.readAsDataURL(file);
});

/* Profile theme toggle */
document.getElementById("profile-theme-toggle")?.addEventListener("click", function() {
  toggleTheme();
  this.setAttribute("aria-checked", String(document.documentElement.classList.contains("dark")));
});

/* Export */
document.getElementById("export-btn")?.addEventListener("click", () => {
  const data = { profile: profileState, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "habit-tracker-data.json"; a.click();
  URL.revokeObjectURL(url);
  showToast("Data exported!");
});

/* Logout */
document.getElementById("logout-btn")?.addEventListener("click", () => {
  showModal("Log Out", "Are you sure you want to log out?", () => {
    authState.authenticated = false;
    saveAuth();
    window.location.replace(LOGIN_PAGE);
  });
});

/* Reset */
document.getElementById("reset-data-btn")?.addEventListener("click", () => {
  showModal("Reset All Data", "This will permanently delete all your habits and progress. This cannot be undone.", () => {
    localStorage.removeItem(PROFILE_KEY);
    profileState = { name:"User", email:"user@email.com", initial:"U", avatar:null };
    renderProfile();
    showToast("All data has been reset.");
  });
});

/* ═════════════════════════════════════════
   MODAL
═════════════════════════════════════════ */
let _modalCallback = null;

function showModal(title, body, onConfirm) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").textContent  = body;
  _modalCallback = onConfirm;
  document.getElementById("modal-backdrop").style.display = "flex";
}

document.getElementById("modal-confirm")?.addEventListener("click", () => {
  document.getElementById("modal-backdrop").style.display = "none";
  if (typeof _modalCallback === "function") _modalCallback();
  _modalCallback = null;
});

document.getElementById("modal-cancel")?.addEventListener("click", () => {
  document.getElementById("modal-backdrop").style.display = "none";
  _modalCallback = null;
});

document.getElementById("modal-backdrop")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-backdrop")) {
    document.getElementById("modal-backdrop").style.display = "none";
    _modalCallback = null;
  }
});

/* ═════════════════════════════════════════
   TOAST
═════════════════════════════════════════ */
let _toastTimer = null;
function showToast(msg, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

/* ═════════════════════════════════════════
   BOOT
═════════════════════════════════════════ */
loadProfile();
loadAuth();
initTheme();
initAuth();

if (isDashboardPage && !authState.authenticated) {
  window.location.replace(LOGIN_PAGE);
} else if (isAuthPage && authState.authenticated) {
  window.location.replace(DASHBOARD_PAGE);
} else if (authState.authenticated) {
  showAppScreen();
  renderProfile();
} else {
  showAuthScreen();
}
