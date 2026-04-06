const navButtons = document.querySelectorAll(".nav-btn");
const chips = document.querySelectorAll(".chip");
const themeToggleButton = document.getElementById("theme-toggle");
const themeIcon = document.querySelector(".theme-icon");
const weeklyOverviewCanvas = document.getElementById("weekly-overview-chart");
const trendCanvas = document.getElementById("trend-chart");
const dashboardSection = document.getElementById("view-dashboard");
const habitsSection = document.getElementById("view-habits");
const statCards = dashboardSection ? dashboardSection.querySelectorAll(".stat-card") : [];
const habitsAnimatedItems = habitsSection
  ? habitsSection.querySelectorAll(".heading-row, .filters-card, .tabs-row, .habits-empty-panel")
  : [];
const THEME_STORAGE_KEY = "habit-tracker-theme";
let weeklyOverviewChart = null;
let trendChart = null;
const views = {
  dashboard: document.getElementById("view-dashboard"),
  habits: document.getElementById("view-habits"),
  calendar: document.getElementById("view-calendar"),
  profile: document.getElementById("view-profile")
};

function applyTheme(theme) {
  const useDark = theme === "dark";
  document.documentElement.classList.toggle("dark", useDark);
  document.body.classList.toggle("dark", useDark);
  themeToggleButton.setAttribute("aria-pressed", String(useDark));
  themeToggleButton.setAttribute("aria-label", useDark ? "Switch to light mode" : "Switch to dark mode");
  themeIcon.textContent = useDark ? "☀" : "🌙";
  updateChartsTheme();
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    applyTheme(savedTheme);
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function setActiveView(viewName) {
  navButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  Object.entries(views).forEach(([key, view]) => {
    const isActive = key === viewName;
    view.classList.toggle("active", isActive);
    view.hidden = !isActive;
  });

  if (viewName === "dashboard") {
    animateDashboardStats();
    refreshDashboardCharts();
  }

  if (viewName === "habits") {
    animateHabitsSections();
  }
}

function animateDashboardStats() {
  if (!statCards.length) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  statCards.forEach((card, index) => {
    card.style.setProperty("--stagger-delay", `${index * 90}ms`);
    card.classList.remove("is-animating");

    if (prefersReducedMotion) {
      return;
    }

    // Restart animation so it replays when navigating back to Dashboard.
    void card.offsetWidth;
    card.classList.add("is-animating");
  });
}

function animateHabitsSections() {
  if (!habitsAnimatedItems.length) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  habitsAnimatedItems.forEach((section, index) => {
    section.style.setProperty("--habits-delay", `${index * 90}ms`);
    section.classList.remove("is-habits-animating");

    if (prefersReducedMotion) {
      return;
    }

    void section.offsetWidth;
    section.classList.add("is-habits-animating");
  });
}

function refreshDashboardCharts() {
  const charts = [weeklyOverviewChart, trendChart].filter(Boolean);
  if (!charts.length) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      charts.forEach((chart) => {
        chart.resize();
        if (prefersReducedMotion) {
          chart.update("none");
          return;
        }

        chart.reset();
        chart.update();
      });
    });
  });
}

function handleNavKeyboard(event) {
  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  const navList = Array.from(navButtons);
  const activeIndex = navList.findIndex((button) => button.classList.contains("active"));
  let nextIndex = activeIndex;

  if (event.key === "ArrowRight") {
    nextIndex = (activeIndex + 1) % navList.length;
  }

  if (event.key === "ArrowLeft") {
    nextIndex = (activeIndex - 1 + navList.length) % navList.length;
  }

  if (event.key === "Home") {
    nextIndex = 0;
  }

  if (event.key === "End") {
    nextIndex = navList.length - 1;
  }

  const targetButton = navList[nextIndex];
  targetButton.focus();
  setActiveView(targetButton.dataset.view);
}

function initializeChipToggle() {
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((current) => {
        const isCurrent = current === chip;
        current.classList.toggle("active", isCurrent);
        current.setAttribute("aria-pressed", String(isCurrent));
      });
    });
  });
}

function getChartPalette() {
  const computed = getComputedStyle(document.body);
  const textColor = computed.getPropertyValue("--text").trim() || "#0f172a";
  const mutedColor = computed.getPropertyValue("--muted-strong").trim() || "#64748b";
  const gridColor = computed.getPropertyValue("--chart-grid").trim() || "#edf1f7";
  const blueColor = computed.getPropertyValue("--blue").trim() || "#3b82f6";
  const greenColor = computed.getPropertyValue("--green").trim() || "#22c55e";

  return {
    textColor,
    mutedColor,
    gridColor,
    blueColor,
    greenColor
  };
}

function createCharts() {
  if (typeof Chart === "undefined" || !weeklyOverviewCanvas || !trendCanvas) {
    return;
  }

  const palette = getChartPalette();
  const commonScale = {
    border: {
      color: palette.gridColor
    },
    grid: {
      color: palette.gridColor,
      drawTicks: false
    },
    ticks: {
      color: palette.mutedColor,
      font: {
        size: 11,
        weight: "600"
      }
    }
  };

  weeklyOverviewChart = new Chart(weeklyOverviewCanvas, {
    type: "bar",
    data: {
      labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      datasets: [
        {
          label: "Habits completed",
          data: [1, 2, 3, 2, 4, 3, 2],
          backgroundColor: `${palette.blueColor}bf`,
          borderColor: palette.blueColor,
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 26
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          displayColors: false,
          callbacks: {
            label(context) {
              return `${context.parsed.y} completed`;
            }
          }
        }
      },
      scales: {
        x: {
          ...commonScale
        },
        y: {
          ...commonScale,
          beginAtZero: true,
          suggestedMax: 5,
          ticks: {
            ...commonScale.ticks,
            stepSize: 1
          }
        }
      }
    }
  });

  trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels: ["03/17", "03/18", "03/19", "03/20", "03/21", "03/22", "03/23"],
      datasets: [
        {
          label: "Completion %",
          data: [10, 25, 32, 40, 45, 58, 70],
          borderColor: palette.blueColor,
          backgroundColor: `${palette.greenColor}26`,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: palette.blueColor,
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label(context) {
              return `${context.parsed.y}% completion`;
            }
          }
        }
      },
      scales: {
        x: {
          ...commonScale
        },
        y: {
          ...commonScale,
          beginAtZero: true,
          max: 100,
          ticks: {
            ...commonScale.ticks,
            stepSize: 20,
            callback(value) {
              return `${value}%`;
            }
          }
        }
      }
    }
  });
}

function updateChartsTheme() {
  const palette = getChartPalette();
  const charts = [weeklyOverviewChart, trendChart].filter(Boolean);

  charts.forEach((chart) => {
    chart.options.scales.x.grid.color = palette.gridColor;
    chart.options.scales.y.grid.color = palette.gridColor;
    chart.options.scales.x.border.color = palette.gridColor;
    chart.options.scales.y.border.color = palette.gridColor;
    chart.options.scales.x.ticks.color = palette.mutedColor;
    chart.options.scales.y.ticks.color = palette.mutedColor;
  });

  if (weeklyOverviewChart) {
    weeklyOverviewChart.data.datasets[0].backgroundColor = `${palette.blueColor}bf`;
    weeklyOverviewChart.data.datasets[0].borderColor = palette.blueColor;
    weeklyOverviewChart.update("none");
  }

  if (trendChart) {
    trendChart.data.datasets[0].borderColor = palette.blueColor;
    trendChart.data.datasets[0].backgroundColor = `${palette.greenColor}26`;
    trendChart.data.datasets[0].pointBorderColor = palette.blueColor;
    trendChart.update("none");
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view);
  });

  button.addEventListener("keydown", handleNavKeyboard);
});

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
});

setActiveView("dashboard");
initializeTheme();
initializeChipToggle();
createCharts();
updateChartsTheme();
