/**
 * Dashboard Application - API Integrated Version
 * Simplified version that uses the PHP API backend
 */

'use strict';

// State
let currentView = 'dashboard';
let currentUser = null;
let profileAvatarDraft = null;
let profileAvatarFile = null;
let dashboardData = null;
let habits = [];
let currentHabitsArchived = false;
let selectedHabitCategory = 'all';
let selectedHabitSort = 'custom';
let weeklyChart = null;
let trendChart = null;

const PROFILE_PREFERENCES_KEY = 'habit-tracker-profile-preferences';
const PROFILE_NOTIFICATION_LAST_KEY = 'habit-tracker-last-notification';
const DEFAULT_PROFILE_PREFERENCES = {
    notifications: false,
    notificationTime: '09:00'
};

let profilePreferences = { ...DEFAULT_PROFILE_PREFERENCES };
let profileScheduleInterval = null;
let isAuthenticated = false;

function normalizeBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function loadProfilePreferences() {
    const stored = localStorage.getItem(PROFILE_PREFERENCES_KEY);
    if (stored) {
        try {
            profilePreferences = { ...profilePreferences, ...JSON.parse(stored) };
        } catch (error) {
            console.warn('Invalid profile preferences JSON:', error);
        }
    }

    if (currentUser && currentUser.settings) {
        profilePreferences = {
            ...profilePreferences,
            notifications: normalizeBoolean(currentUser.settings.notifications_enabled),
            notificationTime: currentUser.settings.notification_time ? currentUser.settings.notification_time.slice(0, 5) : profilePreferences.notificationTime
        };
    }

    updateProfilePreferencesUI();
}

async function saveProfilePreferences(saveServer = true) {
    localStorage.setItem(PROFILE_PREFERENCES_KEY, JSON.stringify(profilePreferences));
    updateProfilePreferencesUI();

    if (!saveServer || !isAuthenticated) {
        return;
    }

    const storedTheme = localStorage.getItem('habit-tracker-theme') || 'auto';
    const theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'auto';

    const settingsPayload = {
        theme,
        notifications_enabled: Boolean(profilePreferences.notifications),
        notification_time: profilePreferences.notificationTime ? `${profilePreferences.notificationTime}:00` : null,
        weekly_report_enabled: normalizeBoolean(currentUser?.settings?.weekly_report_enabled ?? false),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    };

    try {
        const result = await HabitAPI.updateProfile({ settings: settingsPayload });
        if (result.success && result.user && result.user.settings) {
            currentUser.settings = result.user.settings;
        }
    } catch (error) {
        console.warn('Failed saving profile settings:', error);
    }
}

function updateProfilePreferencesUI() {
    const notificationsToggle = document.getElementById('profile-notifications-toggle');
    const notificationTimeInput = document.getElementById('profile-notification-time');

    if (notificationsToggle) {
        notificationsToggle.setAttribute('aria-checked', String(profilePreferences.notifications));
    }

    if (notificationTimeInput) {
        notificationTimeInput.value = profilePreferences.notificationTime;
    }
}

function toggleProfilePreference(prefKey) {
    const labelMap = {
        notifications: 'Notifications'
    };

    profilePreferences[prefKey] = !profilePreferences[prefKey];
    saveProfilePreferences();
    initScheduledPreferences();

    if (prefKey === 'notifications') {
        requestNotificationPermission();
    }

    showToast(`${labelMap[prefKey]} ${profilePreferences[prefKey] ? 'enabled' : 'disabled'}.`, 'success');
}

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Reminder notifications enabled', 'success');
            }
        });
    }
}

function initScheduledPreferences() {
    if (profileScheduleInterval) {
        clearInterval(profileScheduleInterval);
    }

    profileScheduleInterval = setInterval(checkScheduledTasks, 60 * 1000);
    checkScheduledTasks();
}

function checkScheduledTasks() {
    handleReminderSchedule();
}

function handleReminderSchedule() {
    if (!profilePreferences.notifications) {
        return;
    }

    const now = new Date();
    const [hour, minute] = profilePreferences.notificationTime.split(':').map(v => parseInt(v, 10));
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return;
    }

    if (now.getHours() !== hour || now.getMinutes() !== minute) {
        return;
    }

    const todayKey = now.toISOString().slice(0, 10);
    const lastKey = localStorage.getItem(PROFILE_NOTIFICATION_LAST_KEY);
    if (lastKey === todayKey) {
        return;
    }

    sendAppNotification('Habit Reminder', 'Time to complete your habits for today.');
    localStorage.setItem(PROFILE_NOTIFICATION_LAST_KEY, todayKey);
}

function sendAppNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: '/assets/img/notification-icon.png'
            });
        } catch (error) {
            console.warn('Notification failed:', error);
        }
    }
    showToast(body, 'info');
}

async function downloadWeeklyReport() {
    try {
        await ensureCalendarData(true);
        const report = generateWeeklyReport();
        if (!report || !report.overallStatistics) {
            showToast('Unable to generate weekly report', 'error');
            return;
        }

        const htmlContent = generateHtmlReport(report);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `weekly-habit-report-${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Weekly report generated and downloaded.', 'success');
    } catch (error) {
        console.error('Weekly report error:', error);
        showToast('Error generating weekly report', 'error');
    }
}

function generateWeeklyReport(days = 7) {
    const habitsArray = Object.values(calendarState.habits || {});
    const sortedDates = Object.keys(heatMapData).sort((a, b) => new Date(a) - new Date(b));
    const selectedDates = sortedDates.slice(-days);
    const weeklyHeatMap = selectedDates.reduce((acc, date) => {
        acc[date] = heatMapData[date] || { completed: 0, missed: 0, pending: 0 };
        return acc;
    }, {});

    const totalCompletions = selectedDates.reduce((sum, date) => sum + (weeklyHeatMap[date].completed || 0), 0);
    const totalMissed = selectedDates.reduce((sum, date) => sum + (weeklyHeatMap[date].missed || 0), 0);
    const totalPending = selectedDates.reduce((sum, date) => sum + (weeklyHeatMap[date].pending || 0), 0);
    const totalDays = selectedDates.length;
    const overallCompletionRate = totalDays > 0 ? Math.round((totalCompletions / (totalCompletions + totalMissed + totalPending)) * 100) : 0;

    const dailyPerformance = selectedDates.map(date => {
        const data = weeklyHeatMap[date];
        const total = (data.completed || 0) + (data.missed || 0) + (data.pending || 0);
        return {
            date,
            completed: data.completed || 0,
            missed: data.missed || 0,
            pending: data.pending || 0,
            total,
            completionRate: total > 0 ? ((data.completed || 0) / total) * 100 : 0
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const bestDay = dailyPerformance.reduce((best, day) => day.completionRate > best.completionRate ? day : best, dailyPerformance[0] || {});
    const worstDay = dailyPerformance.reduce((worst, day) => (day.missed > 0 || day.pending > 0) && day.completionRate < worst.completionRate ? day : worst, dailyPerformance[0] || {});

    const weekStats = selectedDates.reduce((acc, date) => {
        const data = weeklyHeatMap[date];
        const week = 'Last 7 days';
        acc[week] = acc[week] || { completed: 0, missed: 0, pending: 0, days: 0 };
        acc[week].completed += data.completed || 0;
        acc[week].missed += data.missed || 0;
        acc[week].pending += data.pending || 0;
        acc[week].days += 1;
        return acc;
    }, {});

    const insights = [];
    if (overallCompletionRate >= 90) insights.push('🌟 Excellent consistency! You\'re maintaining 90%+ completion rate.');
    else if (overallCompletionRate >= 75) insights.push('💪 Great job! You\'re maintaining a 75%+ completion rate.');
    else if (overallCompletionRate >= 50) insights.push('📈 Good effort! Keep pushing to improve your completion rate.');
    else insights.push('⚠️ Time to refocus! Try to set more achievable daily goals.');

    if (currentUser.current_streak >= 20) insights.push(`🔥 Amazing streak of ${currentUser.current_streak} days! Keep it up!`);
    else if (currentUser.current_streak >= 10) insights.push(`✨ Solid streak of ${currentUser.current_streak} days. You\'re on fire!`);
    if (totalPending > totalMissed) insights.push('⏳ You have pending habits. Try to complete them as soon as possible.');
    else if (totalMissed > 0) insights.push(`📊 ${totalMissed} missed habits detected. Consider adjusting your goals or routine.`);

    return {
        metadata: {
            exportDate: new Date().toISOString(),
            exportedBy: currentUser.name,
            dataRange: {
                from: selectedDates[0] || 'N/A',
                to: selectedDates[selectedDates.length - 1] || 'N/A'
            }
        },
        userProfile: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            level: currentUser.level,
            xp: currentUser.xp,
            currentStreak: currentUser.current_streak,
            bestStreak: currentUser.best_streak,
            memberSince: currentUser.member_since
        },
        overallStatistics: {
            totalHabits: habitsArray.length,
            totalDays,
            totalCompletions,
            totalMissed,
            totalPending,
            overallCompletionRate: `${overallCompletionRate}%`,
            averageCompletionsPerDay: totalDays > 0 ? (totalCompletions / totalDays).toFixed(1) : 0,
            averageMissedPerDay: totalDays > 0 ? (totalMissed / totalDays).toFixed(1) : 0
        },
        dailyPerformance: {
            bestDay,
            worstDay,
            allDays: dailyPerformance
        },
        weeklyAnalysis: weekStats,
        habits: habitsArray.map(habit => ({
            id: habit.id,
            name: habit.name,
            category: habit.category,
            frequency: habit.frequency,
            color: habit.color,
            icon: habit.icon
        })),
        insights,
        recommendations: generateRecommendations(overallCompletionRate, habitsArray.length, totalMissed)
    };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard initializing...');

    // Check if user is authenticated
    const session = await HabitAPI.checkSession();
    console.log('Session check result:', session);

    if (!session.authenticated) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    isAuthenticated = true;
    currentUser = session.user;
    console.log('Current user:', currentUser);

    loadProfilePreferences();
    await initializeDashboard();
    setupEventListeners();
    initScheduledPreferences();
});

window.addEventListener('pageshow', async (event) => {
    if (!event.persisted) {
        return;
    }

    const session = await HabitAPI.checkSession();
    if (!session.authenticated) {
        window.location.replace('index.html');
    }
});

/**
 * Initialize Dashboard
 */
async function initializeDashboard() {
    showLoading();
    console.log('Loading dashboard data...');

    try {
        // Load dashboard data
        const result = await HabitAPI.getDashboardStats();
        console.log('Dashboard result:', result);

        if (result.success) {
            dashboardData = result.data;
            console.log('Dashboard data loaded:', dashboardData);
            updateDashboardUI();
            updateCharts();
        } else {
            console.error('Dashboard load failed:', result.message);
            showToast('Failed to load dashboard data: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Dashboard init error:', error);
        showToast('Error loading dashboard: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Update Dashboard UI
 */
function updateDashboardUI() {
    const data = dashboardData;

    // Update user info
    document.getElementById('dash-username').textContent = data.user.name;
    document.querySelector('.level-pill').innerHTML =
        `Lv ${data.user.level} <span class="muted">${data.user.xp} XP</span>`;

    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card');

    // Active Habits
    statCards[0].querySelector('.stat-value').textContent = data.active_habits;
    statCards[0].querySelector('.stat-sub').textContent = `${data.total_habits} total`;

    // Current Streak
    statCards[1].querySelector('.stat-value').textContent = data.user.current_streak;
    statCards[1].querySelector('.stat-sub').textContent = `Best: ${data.user.best_streak} days`;

    // Completion Rate
    statCards[2].querySelector('.stat-value').textContent = `${data.completion_rate_30d}%`;

    // Today's Progress
    const todayProgress = data.today_progress;
    statCards[3].querySelector('.stat-value').textContent = `${todayProgress.percentage}%`;
    statCards[3].querySelector('.stat-sub').textContent =
        `${todayProgress.completed}/${todayProgress.total} completed`;

    // Update today's date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const todayStr = new Date().toLocaleDateString('en-US', dateOptions);
    document.querySelector('.habits-panel p').textContent = todayStr;

    // Render today's habits
    renderTodayHabits(data.today_habits);
}

/**
 * Render Today's Habits
 */
function renderTodayHabits(habits) {
    const panel = document.querySelector('.habits-panel');
    const emptyState = panel.querySelector('.empty-state');

    if (habits.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Create habit list if it doesn't exist
    let habitList = panel.querySelector('.habit-list');
    if (!habitList) {
        habitList = document.createElement('div');
        habitList.className = 'habit-list';
        panel.appendChild(habitList);
    }

    habitList.innerHTML = habits.map(habit => `
        <div class="habit-item ${habit.status}" data-habit-id="${habit.id}">
            <div class="habit-check" onclick="toggleHabitCompletion(${habit.id}, '${getTodayDate()}')">
                <span class="check-icon">${habit.status === 'completed' ? '✓' : ''}</span>
            </div>
            <div class="habit-info">
                <div class="habit-main">
                    <span class="habit-icon">${habit.icon}</span>
                    <span class="habit-name">${habit.name}</span>
                </div>
                <span class="habit-category">${habit.category}</span>
            </div>
            <span class="habit-status-badge ${habit.status}">${habit.status}</span>
        </div>
    `).join('');
}

/**
 * Toggle Habit Completion
 */
async function toggleHabitCompletion(habitId, date) {
    const habitItem = document.querySelector(`[data-habit-id="${habitId}"]`);
    const currentStatus = habitItem.classList.contains('completed') ? 'completed' : 'pending';
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    try {
        const result = await HabitAPI.toggleCompletion(habitId, date, newStatus);

        if (result.success) {
            // Refresh dashboard data
            await initializeDashboard();
            showToast(result.message, 'success');
        } else {
            showToast('Failed to update habit', 'error');
        }
    } catch (error) {
        console.error('Toggle error:', error);
        showToast('Error updating habit', 'error');
    }
}

// Make it globally available
window.toggleHabitCompletion = toggleHabitCompletion;

/**
 * Update Charts
 */
function updateCharts() {
    const weeklyData = Array.isArray(dashboardData?.weekly_overview) ? dashboardData.weekly_overview : [];

    // Weekly Overview Chart
    const weeklyCtx = document.getElementById('weekly-overview-chart');
    if (weeklyCtx) {
        if (weeklyChart) weeklyChart.destroy();

        weeklyChart = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: weeklyData.map(d => d.day),
                datasets: [{
                    label: 'Completion %',
                    data: weeklyData.map(d => d.percentage),
                    backgroundColor: '#4CAF50',
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const point = weeklyData[ctx.dataIndex] || {};
                                return `${point.completed || 0}/${point.total || 0} habits (${point.percentage || 0}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { callback: value => `${value}%` }
                    }
                }
            }
        });
    }

    // Trend Chart
    const trendCtx = document.getElementById('trend-chart');
    if (trendCtx) {
        if (trendChart) trendChart.destroy();

        trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: weeklyData.map(d => d.day),
                datasets: [{
                    label: 'Completion %',
                    data: weeklyData.map(d => d.percentage),
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
                }
            }
        });
    }
}

/**
 * Load Habits List
 */
async function loadHabits(archived = false, category = null) {
    currentHabitsArchived = archived;

    try {
        const result = await HabitAPI.getHabits(archived, category);

        if (result.success) {
            habits = result.habits;

            updateCategoryFilterOptions(habits);

            let visibleHabits = [...habits];

            if (selectedHabitCategory !== 'all') {
                visibleHabits = visibleHabits.filter(habit => habit.category === selectedHabitCategory);
            }

            visibleHabits = sortHabitsList(visibleHabits, selectedHabitSort);

            renderHabitsList(visibleHabits, archived);
        } else {
            showToast('Failed to load habits', 'error');
        }
    } catch (error) {
        console.error('Load habits error:', error);
        showToast('Error loading habits', 'error');
    }
}

function updateCategoryFilterOptions(habitsList) {
    const categoryFilter = document.getElementById('habits-category-filter');
    if (!categoryFilter) {
        return;
    }

    const categories = new Set(DEFAULT_CATEGORIES);
    (habitsList || []).forEach(habit => {
        if (habit.category) {
            categories.add(habit.category);
        }
    });

    const sortedCategories = Array.from(categories).sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';

    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        if (category === selectedHabitCategory) {
            option.selected = true;
        }
        categoryFilter.appendChild(option);
    });

    if (selectedHabitCategory !== 'all' && !categories.has(selectedHabitCategory)) {
        selectedHabitCategory = 'all';
        categoryFilter.value = 'all';
    }
}

/**
 * Render Habits List
 */
function renderHabitsList(habitsList, archived) {
    const emptyPanel = document.querySelector('.habits-empty-panel');
    const tabChips = document.querySelectorAll('#view-habits .chip');

    // Update tab counts
    if (tabChips.length >= 2) {
        const activeCount = habitsList.filter(h => !h.is_archived).length;
        const archivedCount = habitsList.filter(h => h.is_archived).length;
        tabChips[0].textContent = `Active (${activeCount})`;
        tabChips[1].textContent = `Archived (${archivedCount})`;
    }

    if (habitsList.length === 0) {
        emptyPanel.style.display = 'block';
        return;
    }

    emptyPanel.style.display = 'none';

    // Create habits grid if it doesn't exist
    let habitsGrid = document.querySelector('.habits-grid');
    if (!habitsGrid) {
        habitsGrid = document.createElement('div');
        habitsGrid.className = 'habits-grid';
        emptyPanel.parentNode.insertBefore(habitsGrid, emptyPanel);
    }

    habitsGrid.innerHTML = habitsList.map(habit => `
        <article class="card habit-card" data-habit-id="${habit.id}" data-habit-name="${habit.name}">
            <div class="habit-card-header">
                <div class="habit-card-icon" style="background: ${habit.color}">${habit.icon}</div>
                <div class="habit-card-info">
                    <h4>${habit.name}</h4>
                    <span class="habit-card-category">${habit.category}</span>
                </div>
            </div>
            <p class="habit-card-desc">${habit.description || 'No description'}</p>
            <div class="habit-card-stats">
                <div class="stat-item">
                    <span class="stat-label">Streak</span>
                    <span class="stat-number">${habit.total_completions || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Last 30d</span>
                    <span class="stat-number">${habit.completions_last_30d || 0}</span>
                </div>
            </div>
            <div class="habit-card-actions">
                <button class="btn-ghost" onclick="toggleHabitCompletion(${habit.id}, '${getTodayDate()}')">
                    ${habit.today_status === 'completed' ? '✓ Done' : 'Mark Done'}
                </button>
                <button class="btn-danger" onclick="deleteHabit(${habit.id})">
                    Delete
                </button>
            </div>
        </article>
    `).join('');
}

function sortHabitsList(habitsList, sortBy) {
    const sortedHabits = [...habitsList];

    switch (sortBy) {
        case 'name':
            sortedHabits.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'newest':
            sortedHabits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'streak':
            sortedHabits.sort((a, b) => {
                const aStreak = Number(a.total_completions || 0);
                const bStreak = Number(b.total_completions || 0);
                return bStreak - aStreak;
            });
            break;
        case 'custom':
        default:
            // Keep backend order (display_order then created_at)
            break;
    }

    return sortedHabits;
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const profileThemeToggle = document.getElementById('profile-theme-toggle');
    if (profileThemeToggle) {
        profileThemeToggle.addEventListener('click', toggleTheme);
    }

    const savedTheme = localStorage.getItem('habit-tracker-theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        updateThemeIcon('dark');
    } else {
        updateThemeIcon('light');
    }

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });

    // Habits tab toggle
    document.querySelectorAll('#view-habits .chip').forEach((chip, index) => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#view-habits .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            loadHabits(index === 1); // index 1 = archived
        });
    });

    // Habits category filter
    const categoryFilter = document.getElementById('habits-category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            selectedHabitCategory = categoryFilter.value;
            loadHabits(currentHabitsArchived);
        });
    }

    // Habits sort selector
    const sortBy = document.getElementById('habits-sort-by');
    if (sortBy) {
        sortBy.addEventListener('change', () => {
            selectedHabitSort = sortBy.value;
            loadHabits(currentHabitsArchived);
        });
    }

    // New Habit buttons
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('New Habit') || btn.textContent.includes('Create Your First Habit')) {
            btn.addEventListener('click', openNewHabitModal);
        }
    });

    const notificationsToggle = document.getElementById('profile-notifications-toggle');
    if (notificationsToggle) {
        notificationsToggle.addEventListener('click', () => toggleProfilePreference('notifications'));
    }

    const notificationTimeInput = document.getElementById('profile-notification-time');
    if (notificationTimeInput) {
        notificationTimeInput.addEventListener('change', (e) => {
            profilePreferences.notificationTime = e.target.value;
            saveProfilePreferences();
            initScheduledPreferences();
            showToast(`Reminder time set to ${e.target.value}`, 'success');
        });
    }

    const downloadWeeklyReportBtn = document.getElementById('download-weekly-report-btn');
    if (downloadWeeklyReportBtn) {
        downloadWeeklyReportBtn.addEventListener('click', downloadWeeklyReport);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await HabitAPI.logout();
            window.location.replace('index.html');
        });
    }

    const profileEditBtn = document.getElementById('profile-edit-btn');
    if (profileEditBtn) {
        profileEditBtn.addEventListener('click', showProfileEditForm);
    }

    const profileSaveBtn = document.getElementById('profile-save-btn');
    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', handleProfileSave);
    }

    const profileCancelBtn = document.getElementById('profile-cancel-btn');
    if (profileCancelBtn) {
        profileCancelBtn.addEventListener('click', hideProfileEditForm);
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportData);
    }

    const resetDataBtn = document.getElementById('reset-data-btn');
    if (resetDataBtn) {
        resetDataBtn.addEventListener('click', handleResetData);
    }

    const avatarInput = document.getElementById('profile-avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarUpload);
    }
    // Attach the same upload handler to any Save Avatar buttons (hero + edit form)
    const avatarSaveBtns = document.querySelectorAll('.profile-avatar-save-btn, #profile-avatar-save-btn');
    avatarSaveBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!profileAvatarFile && !profileAvatarDraft) {
                showToast('No avatar selected', 'error');
                return;
            }

            showLoading();
            try {
                const payload = profileAvatarFile instanceof File ? profileAvatarFile : profileAvatarDraft;
                const uploadResult = await HabitAPI.uploadAvatar(payload);
                if (!uploadResult.success) {
                    showToast(uploadResult.message || 'Failed to upload avatar', 'error');
                    return;
                }

                currentUser = uploadResult.user || currentUser;
                profileAvatarDraft = null;
                profileAvatarFile = null;
                // hide all avatar save buttons
                document.querySelectorAll('.profile-avatar-save-btn, #profile-avatar-save-btn').forEach(b => b.style.display = 'none');
                renderProfileAvatar(currentUser.avatar);
                showToast('Avatar saved', 'success');
            } catch (err) {
                console.error('Avatar save error:', err);
                showToast('Error saving avatar', 'error');
            } finally {
                hideLoading();
            }
        });
    });
}

const NEW_HABIT_ICONS = ['💧', '🏃', '📖', '🧘', '💻', '🎨', '🎵', '🥦', '💰'];
const DEFAULT_HABIT_ICON = NEW_HABIT_ICONS[0];
const DEFAULT_CATEGORIES = ['Health', 'Study', 'Work', 'Personal', 'Fitness', 'Mind', 'Social', 'Other'];

function buildNewHabitModal() {
    return `
        <div id="new-habit-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="new-habit-title">
            <div class="modal-content new-habit-modal">
                <div class="modal-header">
                    <h2 id="new-habit-title">Create New Habit</h2>
                    <button class="close-btn" type="button" data-modal-close aria-label="Close">&times;</button>
                </div>
                <form id="new-habit-form" class="new-habit-form">
                    <div class="field">
                        <label for="habit-name">Habit Name</label>
                        <input type="text" id="habit-name" name="name" required placeholder="e.g., Drink Water" />
                    </div>
                    <div class="field">
                        <label for="habit-desc">Description (Optional)</label>
                        <textarea id="habit-desc" name="description" placeholder="e.g., 8 glasses per day"></textarea>
                    </div>
                    <div class="field">
                        <label for="habit-category-select">Category</label>
                        <select id="habit-category-select" name="category">
                            <option value="" selected disabled>Select a category</option>
                        </select>
                        <span class="field-hint">Pick one or add a custom category below.</span>
                    </div>
                    <div class="field">
                        <label for="habit-category-custom">Custom Category</label>
                        <input type="text" id="habit-category-custom" name="custom_category" maxlength="50" placeholder="e.g., Nutrition" />
                    </div>
                    <div class="field">
                        <label>Icon</label>
                        <div class="icon-selector">
                            <div class="predefined-icons icon-grid" role="listbox" aria-label="Choose an icon">
                                ${NEW_HABIT_ICONS.map(icon => `
                                    <button type="button" class="icon-option" data-icon="${icon}" aria-pressed="false">${icon}</button>
                                `).join('')}
                                <button type="button" class="icon-option icon-add" id="add-custom-icon" aria-label="Add custom icon">+</button>
                            </div>
                            <div class="icon-custom" id="custom-icon-row" hidden>
                                <input type="text" id="custom-icon-input" placeholder="Paste emoji" aria-label="Custom icon" autocomplete="off" />
                                <button type="button" class="btn-ghost" id="custom-icon-apply">Add</button>
                            </div>
                            <div class="icon-preview" aria-live="polite">
                                <span class="icon-preview-label">Selected</span>
                                <span class="icon-preview-value" id="selected-icon-preview">${DEFAULT_HABIT_ICON}</span>
                            </div>
                            <input type="hidden" id="habit-icon-input" name="icon" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-ghost" data-modal-close>Cancel</button>
                        <button type="submit" class="btn-primary">Create Habit</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * New Habit Modal
 */
function openNewHabitModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        return;
    }

    modalContainer.innerHTML = buildNewHabitModal();
    const modal = document.getElementById('new-habit-modal');
    const form = modal.querySelector('#new-habit-form');
    const iconInput = modal.querySelector('#habit-icon-input');
    const iconPreview = modal.querySelector('#selected-icon-preview');
    const iconGrid = modal.querySelector('.icon-grid');
    const addCustomBtn = modal.querySelector('#add-custom-icon');
    const customRow = modal.querySelector('#custom-icon-row');
    const customInput = modal.querySelector('#custom-icon-input');
    const customApply = modal.querySelector('#custom-icon-apply');
    const categorySelect = modal.querySelector('#habit-category-select');
    const categoryCustom = modal.querySelector('#habit-category-custom');

    const setSelectedIcon = (icon, button) => {
        iconInput.value = icon;
        iconPreview.textContent = icon;
        modal.querySelectorAll('.icon-option').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
        });
        if (button) {
            button.classList.add('selected');
            button.setAttribute('aria-pressed', 'true');
        }
    };

    const createIconButton = (icon) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-option';
        btn.dataset.icon = icon;
        btn.textContent = icon;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => setSelectedIcon(icon, btn));
        return btn;
    };

    const addCustomIcon = () => {
        const icon = customInput.value.trim();
        if (!icon) {
            showToast('Add an emoji first.', 'error');
            customInput.focus();
            return;
        }

        const existing = Array.from(iconGrid.querySelectorAll('.icon-option[data-icon]'))
            .find(btn => btn.dataset.icon === icon);
        if (existing) {
            setSelectedIcon(icon, existing);
            customInput.value = '';
            customRow.hidden = true;
            return;
        }

        const customBtn = createIconButton(icon);
        iconGrid.insertBefore(customBtn, addCustomBtn);
        setSelectedIcon(icon, customBtn);
        customInput.value = '';
        customRow.hidden = true;
    };

    const setCategoryOptions = (categories) => {
        const unique = Array.from(new Set(categories.filter(Boolean).map(c => c.trim()).filter(Boolean)));
        unique.sort((a, b) => a.localeCompare(b));
        categorySelect.innerHTML = '<option value="" selected disabled>Select a category</option>';
        unique.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    };

    const collectExistingCategories = async () => {
        const categories = new Set(DEFAULT_CATEGORIES);

        if (Array.isArray(habits) && habits.length > 0) {
            habits.forEach(habit => {
                if (habit.category) {
                    categories.add(habit.category);
                }
            });
            setCategoryOptions(Array.from(categories));
            return;
        }

        try {
            const result = await HabitAPI.getHabits(false);
            if (result.success && Array.isArray(result.habits)) {
                result.habits.forEach(habit => {
                    if (habit.category) {
                        categories.add(habit.category);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }

        setCategoryOptions(Array.from(categories));
    };

    modal.querySelectorAll('.icon-option[data-icon]').forEach(btn => {
        btn.addEventListener('click', () => setSelectedIcon(btn.dataset.icon, btn));
    });

    addCustomBtn.addEventListener('click', () => {
        customRow.hidden = !customRow.hidden;
        if (!customRow.hidden) {
            customInput.focus();
        }
    });

    categorySelect.addEventListener('change', () => {
        if (categorySelect.value) {
            categoryCustom.value = '';
        }
    });

    categoryCustom.addEventListener('input', () => {
        if (categoryCustom.value.trim()) {
            categorySelect.value = '';
        }
    });

    customApply.addEventListener('click', addCustomIcon);
    customInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addCustomIcon();
        }
    });

    modal.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', closeNewHabitModal);
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeNewHabitModal();
        }
    });

    form.addEventListener('submit', handleNewHabitSubmit);
    setSelectedIcon(DEFAULT_HABIT_ICON, modal.querySelector(`.icon-option[data-icon="${DEFAULT_HABIT_ICON}"]`));
    collectExistingCategories();
    modal.querySelector('#habit-name').focus();
}

function closeNewHabitModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.innerHTML = '';
    }
}

async function handleNewHabitSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const selectedCategory = (data.category || '').trim();
    const customCategory = (data.custom_category || '').trim();
    const resolvedCategory = customCategory || selectedCategory;

    const payload = {
        name: (data.name || '').trim(),
        description: (data.description || '').trim(),
        category: resolvedCategory,
        icon: (data.icon || '').trim()
    };

    if (!payload.name || !payload.category || !payload.icon) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    try {
        const result = await HabitAPI.createHabit(payload);
        if (result.success) {
            showToast('Habit created successfully!', 'success');
            closeNewHabitModal();
            await initializeDashboard();
            await loadHabits(currentHabitsArchived);
        } else {
            showToast(result.message || 'Failed to create habit.', 'error');
        }
    } catch (error) {
        showToast('An error occurred: ' + error.message, 'error');
    }
}

/* ═════════════════════════════════════════
   CALENDAR HELPERS
═════════════════════════════════════════ */

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function addDaysToDate(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calculateActivityLevel(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);

    if (dateToCheck > today) return 'none';

    const dateKey = dateToCheck.getFullYear() + '-' +
                   String(dateToCheck.getMonth() + 1).padStart(2, '0') + '-' +
                   String(dateToCheck.getDate()).padStart(2, '0');
    const dayData = heatMapData[dateKey];

    if (!dayData) return 'none';
    if (dayData.completed > 0) return 'completed';
    if (dayData.missed > 0) return 'missed';
    if (dayData.pending > 0) return 'pending';

    return 'none';
}

let calendarState = {
    activeTab: 'heatmap',
    monthDate: new Date(),
    weekStart: getWeekStartDate(new Date()),
    selectedDay: new Date(),
    habits: [],
    completions: {}
};

let heatMapData = {};
let calendarListenersReady = false;

async function ensureCalendarData(forceRefresh = false) {
    if (forceRefresh || !Array.isArray(calendarState.habits) || calendarState.habits.length === 0) {
        const habitsResult = await HabitAPI.getHabits(false);
        if (habitsResult.success) {
            calendarState.habits = habitsResult.habits || [];
        }
    }

    if (forceRefresh || !heatMapData || Object.keys(heatMapData).length === 0) {
        const heatMapJson = await HabitAPI.getCalendarHeatmap();
        if (heatMapJson.success) {
            heatMapData = heatMapJson.data || {};
        }
    }
}

async function initializeCalendar() {
    showLoading();
    try {
        await ensureCalendarData(true);

        if (!calendarListenersReady) {
            setupCalendarTabs();
            setupCalendarNavigation();
            calendarListenersReady = true;
        }

        renderHeatmap();
        renderMonthView();
        renderWeekView();
        renderDayPanel(calendarState.selectedDay);
    } catch (error) {
        console.error('Calendar init error:', error);
        showToast('Error loading calendar', 'error');
    } finally {
        hideLoading();
    }
}

function setupCalendarTabs() {
    const tabs = {
        heatmap: document.getElementById('cal-tab-heatmap'),
        month: document.getElementById('cal-tab-month'),
        week: document.getElementById('cal-tab-week')
    };

    const panels = {
        heatmap: document.getElementById('cal-panel-heatmap'),
        month: document.getElementById('cal-panel-month'),
        week: document.getElementById('cal-panel-week')
    };

    function activateTab(tabName) {
        calendarState.activeTab = tabName;

        Object.entries(tabs).forEach(([k, btn]) => {
            if (btn) {
                btn.classList.toggle('active', k === tabName);
                btn.setAttribute('aria-pressed', String(k === tabName));
            }
        });

        Object.entries(panels).forEach(([k, panel]) => {
            if (panel) {
                panel.style.display = k === tabName ? '' : 'none';
            }
        });

        if (tabName === 'heatmap') renderHeatmap();
        if (tabName === 'month') renderMonthView();
        if (tabName === 'week') renderWeekView();
    }

    Object.entries(tabs).forEach(([k, btn]) => {
        if (btn) {
            btn.addEventListener('click', () => activateTab(k));
        }
    });

    activateTab(calendarState.activeTab);
}

function setupCalendarNavigation() {
    const monthPrev = document.getElementById('month-prev');
    const monthNext = document.getElementById('month-next');
    if (monthPrev) {
        monthPrev.addEventListener('click', () => {
            calendarState.monthDate.setMonth(calendarState.monthDate.getMonth() - 1);
            renderMonthView();
        });
    }
    if (monthNext) {
        monthNext.addEventListener('click', () => {
            calendarState.monthDate.setMonth(calendarState.monthDate.getMonth() + 1);
            renderMonthView();
        });
    }

    const weekPrev = document.getElementById('week-prev');
    const weekNext = document.getElementById('week-next');
    if (weekPrev) {
        weekPrev.addEventListener('click', () => {
            calendarState.weekStart = addDaysToDate(calendarState.weekStart, -7);
            renderWeekView();
        });
    }
    if (weekNext) {
        weekNext.addEventListener('click', () => {
            calendarState.weekStart = addDaysToDate(calendarState.weekStart, 7);
            renderWeekView();
        });
    }
}

function getCalendarTooltip() {
    return document.getElementById('hm-tooltip');
}

function showCalendarTooltip(date, event) {
    const tooltip = getCalendarTooltip();
    if (!tooltip) return;

    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayData = heatMapData[dateKey] || { completed: 0, missed: 0, pending: 0 };
    document.getElementById('hm-tt-date').textContent = formatDateShort(date);
    document.getElementById('hm-tt-habits').textContent = `${dayData.completed} completed, ${dayData.missed} missed, ${dayData.pending} pending`;
    document.getElementById('hm-tt-pct').textContent = `${Math.round((dayData.completed / (dayData.completed + dayData.missed + dayData.pending || 1)) * 100)}%`;
    tooltip.style.display = 'block';
    moveCalendarTooltip(event);
}

function moveCalendarTooltip(event) {
    const tooltip = getCalendarTooltip();
    if (!tooltip) return;
    const offsetX = 0;
    const offsetY = 14;
    tooltip.style.left = `${event.clientX - tooltip.offsetWidth / 2 + offsetX}px`;
    tooltip.style.top = `${event.clientY - tooltip.offsetHeight - offsetY}px`;
}

function hideCalendarTooltip() {
    const tooltip = getCalendarTooltip();
    if (!tooltip) return;
    tooltip.style.display = 'none';
}

function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) {
        return;
    }

    grid.innerHTML = '';
    const today = new Date();

    for (let i = 89; i >= 0; i--) {
        const date = addDaysToDate(today, -i);
        const status = calculateActivityLevel(date);

        const cell = document.createElement('div');
        cell.className = `hm-cell${status !== 'none' ? ` ${status}` : ''}`;
        if (status === 'none') cell.style.opacity = '0.3';

        cell.addEventListener('mouseenter', (e) => showCalendarTooltip(date, e));
        cell.addEventListener('mousemove', moveCalendarTooltip);
        cell.addEventListener('mouseleave', hideCalendarTooltip);
        cell.addEventListener('click', () => selectDay(date));
        if (isSameDay(date, calendarState.selectedDay)) {
            cell.classList.add('selected');
        }

        grid.appendChild(cell);
    }
}

function renderMonthView() {
    const title = document.getElementById('month-title');
    const grid = document.getElementById('month-grid');
    if (!grid || !title) {
        return;
    }

    const year = calendarState.monthDate.getFullYear();
    const month = calendarState.monthDate.getMonth();

    title.textContent = new Date(year, month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    grid.innerHTML = '';

    for (let i = firstDay - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, daysInPrevMonth - i);
        const dayEl = createMonthDayElement(date, true);
        grid.appendChild(dayEl);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dayEl = createMonthDayElement(date, false);
        grid.appendChild(dayEl);
    }

    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remainingCells; d++) {
        const date = new Date(year, month + 1, d);
        const dayEl = createMonthDayElement(date, true);
        grid.appendChild(dayEl);
    }
}

function createMonthDayElement(date, otherMonth) {
    const cell = document.createElement('div');
    cell.className = `month-day${otherMonth ? ' other-month' : ''}`;

    const today = new Date();
    if (isSameDay(date, today)) {
        cell.classList.add('is-today');
    }
    if (isSameDay(date, calendarState.selectedDay)) {
        cell.classList.add('selected');
    }

    const numEl = document.createElement('span');
    numEl.className = 'month-day-num';
    numEl.textContent = date.getDate();
    cell.appendChild(numEl);

    if (!otherMonth) {
        const status = calculateActivityLevel(date);
        if (status !== 'none') {
            const dotsEl = document.createElement('div');
            dotsEl.className = 'month-day-dots';

            const dot = document.createElement('span');
            dot.className = `m-dot s-${status}`;
            dotsEl.appendChild(dot);

            cell.appendChild(dotsEl);
        }
    }

    if (!otherMonth) {
        cell.addEventListener('click', () => selectDay(date));
        cell.addEventListener('mouseenter', (e) => showCalendarTooltip(date, e));
        cell.addEventListener('mousemove', moveCalendarTooltip);
        cell.addEventListener('mouseleave', hideCalendarTooltip);
    }

    return cell;
}

function renderWeekView() {
    const title = document.getElementById('week-title');
    const grid = document.getElementById('week-grid');
    if (!grid || !title) {
        return;
    }

    const weekStart = calendarState.weekStart;
    const weekEnd = addDaysToDate(weekStart, 6);

    title.textContent = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;
    grid.innerHTML = '';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
        const date = addDaysToDate(weekStart, i);
        const status = calculateActivityLevel(date);

        const col = document.createElement('div');
        col.className = 'week-day-col';

        const today = new Date();
        if (isSameDay(date, today)) {
            col.classList.add('is-today');
        }
        if (isSameDay(date, calendarState.selectedDay)) {
            col.classList.add('selected');
        }

        col.innerHTML = `
            <div class="week-day-name">${dayNames[date.getDay()]}</div>
            <div class="week-day-num">${date.getDate()}</div>
            <div class="week-habit-dots" id="week-dots-${i}"></div>
        `;

        if (status !== 'none') {
            const dotsEl = col.querySelector(`#week-dots-${i}`);
            const pill = document.createElement('div');
            pill.className = `week-habit-pill s-${status}`;
            const labels = {
                completed: 'Done',
                missed: 'Missed',
                pending: 'Pending'
            };
            pill.textContent = labels[status];
            dotsEl.appendChild(pill);
        }

        col.addEventListener('click', () => selectDay(date));
        col.addEventListener('mouseenter', (e) => showCalendarTooltip(date, e));
        col.addEventListener('mousemove', moveCalendarTooltip);
        col.addEventListener('mouseleave', hideCalendarTooltip);
        grid.appendChild(col);
    }
}

function selectDay(date) {
    calendarState.selectedDay = new Date(date);
    renderDayPanel(date);

    document.querySelectorAll('.hm-cell.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.month-day.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.week-day-col.selected').forEach(el => el.classList.remove('selected'));

    if (calendarState.activeTab === 'heatmap') renderHeatmap();
    if (calendarState.activeTab === 'month') renderMonthView();
    if (calendarState.activeTab === 'week') renderWeekView();
}

function renderDayPanel(date) {
    const title = document.getElementById('cal-day-title');
    const badgesDone = document.getElementById('day-done-badge');
    const badgesMissed = document.getElementById('day-missed-badge');
    const badgesPending = document.getElementById('day-pending-badge');
    const habitsList = document.getElementById('day-habits-list');

    if (!title || !habitsList) {
        return;
    }

    title.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const dateKey = date.getFullYear() + '-' +
                   String(date.getMonth() + 1).padStart(2, '0') + '-' +
                   String(date.getDate()).padStart(2, '0');
    const dayData = heatMapData[dateKey] || { completed: 0, missed: 0, pending: 0 };

    const completed = dayData.completed || 0;
    const missed = dayData.missed || 0;
    const pending = dayData.pending || 0;

    if (badgesDone) badgesDone.textContent = `${completed} done`;
    if (badgesMissed) badgesMissed.textContent = `${missed} missed`;
    if (badgesPending) badgesPending.textContent = `${pending} pending`;

    if (completed === 0 && missed === 0 && pending === 0) {
        habitsList.innerHTML = '<div class="empty-state compact"><p style="margin:0">No habits recorded for this date.</p></div>';
        return;
    }

    habitsList.innerHTML = `
        <div class="day-summary">
            <div class="summary-item completed">
                <span class="summary-count">${completed}</span>
                <span class="summary-label">Completed</span>
            </div>
            <div class="summary-item missed">
                <span class="summary-count">${missed}</span>
                <span class="summary-label">Missed</span>
            </div>
            <div class="summary-item pending">
                <span class="summary-count">${pending}</span>
                <span class="summary-label">Pending</span>
            </div>
        </div>
    `;
}

/* ═════════════════════════════════════════
   PROFILE FUNCTIONALITY
═════════════════════════════════════════ */

async function loadProfileData() {
    if (!currentUser) {
        return;
    }

    renderProfileAvatar(currentUser.avatar);
    document.getElementById('profile-name-display').textContent = currentUser.name || 'User';
    document.getElementById('profile-email-display').textContent = currentUser.email || 'user@email.com';
    document.getElementById('profile-level-badge').textContent = currentUser.level || 1;
    document.getElementById('profile-xp-badge').textContent = currentUser.xp || 0;

    const memberSinceEl = document.getElementById('profile-since');
    if (memberSinceEl) {
        memberSinceEl.textContent = currentUser.member_since ?
            `Member since ${new Date(currentUser.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
            'Member since N/A';
    }

    const streakBadge = document.getElementById('profile-streak-badge');
    if (streakBadge) {
        streakBadge.textContent = `${currentUser.current_streak || 0} day streak 🔥`;
    }

    const xpLevel = currentUser.level || 1;
    const xpCurrent = currentUser.xp || 0;
    const xpNeeded = xpLevel * 100;
    const xpPercent = Math.min(100, (xpCurrent / xpNeeded) * 100);

    document.getElementById('xp-level').textContent = xpLevel;
    document.getElementById('xp-bar').style.width = xpPercent + '%';
    document.getElementById('xp-label').textContent = `${xpCurrent} / ${xpNeeded} XP`;

    try {
        const result = await HabitAPI.getDashboardStats();
        if (result.success) {
            document.getElementById('ps-total').textContent = result.data.total_habits || 0;
            document.getElementById('ps-streak').textContent = currentUser.best_streak || 0;

            let totalCompletions = 0;
            if (result.data.weekly_overview) {
                totalCompletions = result.data.weekly_overview.reduce((sum, day) => sum + day.completed, 0);
            }
            document.getElementById('ps-done').textContent = totalCompletions;

            const totalPossible = (result.data.total_habits || 0) * 30;
            const rate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
            document.getElementById('ps-rate').textContent = rate + '%';
        }
    } catch (error) {
        console.error('Error loading profile stats:', error);
    }
}

function showProfileEditForm() {
    document.getElementById('edit-name').value = currentUser.name || '';
    document.getElementById('edit-email').value = currentUser.email || '';
    document.getElementById('edit-password').value = '';
    document.getElementById('edit-password-confirm').value = '';
    const currentPwdEl = document.getElementById('edit-current-password');
    if (currentPwdEl) currentPwdEl.value = '';

    const avatarSaveBtn = document.getElementById('profile-avatar-save-btn');
    if (avatarSaveBtn) avatarSaveBtn.style.display = 'none';

    document.querySelector('.profile-hero').style.display = 'none';
    document.getElementById('profile-edit-card').style.display = 'block';

    clearProfileErrors();
}

function renderProfileAvatar(avatar) {
    const avatarEl = document.getElementById('profile-avatar-display');
    if (!avatarEl) return;

    const displayAvatar = profileAvatarDraft !== null ? profileAvatarDraft : avatar;

    if (displayAvatar) {
        avatarEl.style.backgroundImage = `url(${displayAvatar})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
    } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.style.backgroundSize = '';
        avatarEl.style.backgroundPosition = '';
        avatarEl.textContent = (currentUser && currentUser.name ? currentUser.name.charAt(0) : 'U').toUpperCase();
    }
}

function hideProfileEditForm() {
    if (profileAvatarDraft) {
        profileAvatarDraft = null;
        profileAvatarFile = null;
        const avatarInput = document.getElementById('profile-avatar-input');
        if (avatarInput) {
            avatarInput.value = '';
        }
        renderProfileAvatar(currentUser.avatar);
        const avatarSaveBtn = document.getElementById('profile-avatar-save-btn');
        if (avatarSaveBtn) avatarSaveBtn.style.display = 'none';
    }

    document.querySelector('.profile-hero').style.display = 'block';
    document.getElementById('profile-edit-card').style.display = 'none';

    clearProfileErrors();
}

function clearProfileErrors() {
    document.getElementById('err-name').textContent = '';
    document.getElementById('err-email').textContent = '';
    document.getElementById('err-password').textContent = '';
    document.getElementById('err-password-confirm').textContent = '';
    const cp = document.getElementById('err-current-password');
    if (cp) cp.textContent = '';
}

function validateProfileForm() {
    clearProfileErrors();
    let isValid = true;

    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const password = document.getElementById('edit-password').value;
    const currentPassword = document.getElementById('edit-current-password').value;
    const passwordConfirm = document.getElementById('edit-password-confirm').value;

    if (!name) {
        document.getElementById('err-name').textContent = 'Name is required';
        isValid = false;
    }

    if (!email || !isValidEmail(email)) {
        document.getElementById('err-email').textContent = 'Valid email is required';
        isValid = false;
    }

    if (password && password.length < 6) {
        document.getElementById('err-password').textContent = 'Password must be at least 6 characters';
        isValid = false;
    }

    if (password && password !== passwordConfirm) {
        document.getElementById('err-password-confirm').textContent = 'Passwords do not match';
        isValid = false;
    }

    if (password && !currentPassword) {
        document.getElementById('err-current-password').textContent = 'Current password is required to change password';
        isValid = false;
    }

    return isValid;
}

async function handleProfileSave() {
    if (!validateProfileForm()) {
        showToast('Please fix the errors', 'error');
        return;
    }

    showLoading();

    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const password = document.getElementById('edit-password').value;

    const storedTheme = localStorage.getItem('habit-tracker-theme') || 'auto';
    const theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'auto';

    const updateData = {
        name,
        email,
        settings: {
            theme,
            notifications_enabled: Boolean(profilePreferences.notifications),
            notification_time: profilePreferences.notificationTime ? `${profilePreferences.notificationTime}:00` : null,
            weekly_report_enabled: normalizeBoolean(currentUser?.settings?.weekly_report_enabled ?? false),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        }
    };

    if (password) {
        updateData.password = password;
    }
    const currentPassword = document.getElementById('edit-current-password').value;
    if (currentPassword) {
        updateData.current_password = currentPassword;
    }
    if (profileAvatarDraft !== null) {
        // Upload avatar via separate endpoint to avoid JSON size limits
        try {
            const uploadResult = await HabitAPI.uploadAvatar(profileAvatarDraft);
            if (!uploadResult.success) {
                showToast(uploadResult.message || 'Failed to upload avatar', 'error');
                return;
            }
            // server returns updated user
            currentUser = uploadResult.user || currentUser;
            profileAvatarDraft = null;
        } catch (err) {
            console.error('Avatar upload error:', err);
            showToast('Error uploading avatar', 'error');
            return;
        }
    }

    try {
        const result = await HabitAPI.updateProfile(updateData);
        if (!result.success) {
            showToast(result.message || 'Failed to update profile', 'error');
            return;
        }

        currentUser = result.user;
        profileAvatarDraft = null;
        loadProfilePreferences();

        await loadProfileData();
        hideProfileEditForm();

        showToast('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Profile save error:', error);
        showToast('Error saving profile', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast('File size must be less than 2MB', 'error');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        profileAvatarDraft = base64;
        profileAvatarFile = file;
        renderProfileAvatar(base64);
        const avatarSaveBtn = document.getElementById('profile-avatar-save-btn');
        if (avatarSaveBtn) avatarSaveBtn.style.display = 'inline-block';
        showToast('Avatar ready to save!', 'success');
    };
    reader.readAsDataURL(file);
}

/* ═════════════════════════════════════════
   REPORTING & EXPORT
═════════════════════════════════════════ */

function generateComprehensiveReport() {
    const habitsArray = Object.values(calendarState.habits || {});

    const totalCompletions = Object.values(heatMapData).reduce((sum, day) => sum + (day.completed || 0), 0);
    const totalMissed = Object.values(heatMapData).reduce((sum, day) => sum + (day.missed || 0), 0);
    const totalPending = Object.values(heatMapData).reduce((sum, day) => sum + (day.pending || 0), 0);
    const totalDays = Object.keys(heatMapData).length;
    const overallCompletionRate = totalDays > 0 ? Math.round((totalCompletions / (totalCompletions + totalMissed + totalPending)) * 100) : 0;

    const dailyPerformance = Object.entries(heatMapData).map(([date, data]) => ({
        date,
        completed: data.completed || 0,
        missed: data.missed || 0,
        pending: data.pending || 0,
        total: (data.completed || 0) + (data.missed || 0) + (data.pending || 0),
        completionRate: ((data.completed || 0) / ((data.completed || 0) + (data.missed || 0) + (data.pending || 0) || 1)) * 100
    })).sort((a, b) => new Date(b.date) - new Date(a.date));

    const bestDay = dailyPerformance.reduce((best, day) => day.completionRate > best.completionRate ? day : best, dailyPerformance[0] || {});
    const worstDay = dailyPerformance.reduce((worst, day) => (day.missed > 0 || day.pending > 0) && day.completionRate < worst.completionRate ? day : worst, dailyPerformance[0] || {});

    const weekStats = {};
    dailyPerformance.forEach(day => {
        const date = new Date(day.date);
        const weekNum = Math.ceil(date.getDate() / 7);
        const week = `Week ${weekNum}`;
        if (!weekStats[week]) {
            weekStats[week] = { completed: 0, missed: 0, pending: 0, days: 0 };
        }
        weekStats[week].completed += day.completed;
        weekStats[week].missed += day.missed;
        weekStats[week].pending += day.pending;
        weekStats[week].days += 1;
    });

    return {
        metadata: {
            exportDate: new Date().toISOString(),
            exportedBy: currentUser.name,
            dataRange: {
                from: dailyPerformance[dailyPerformance.length - 1]?.date || 'N/A',
                to: dailyPerformance[0]?.date || 'N/A'
            }
        },
        userProfile: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            level: currentUser.level,
            xp: currentUser.xp,
            currentStreak: currentUser.current_streak,
            bestStreak: currentUser.best_streak,
            memberSince: currentUser.member_since
        },
        overallStatistics: {
            totalHabits: habitsArray.length,
            totalDays,
            totalCompletions,
            totalMissed,
            totalPending,
            overallCompletionRate: `${overallCompletionRate}%`,
            averageCompletionsPerDay: totalDays > 0 ? (totalCompletions / totalDays).toFixed(1) : 0,
            averageMissedPerDay: totalDays > 0 ? (totalMissed / totalDays).toFixed(1) : 0
        },
        dailyPerformance: {
            bestDay,
            worstDay,
            allDays: dailyPerformance
        },
        weeklyAnalysis: weekStats,
        habits: habitsArray.map(habit => ({
            id: habit.id,
            name: habit.name,
            category: habit.category,
            frequency: habit.frequency,
            color: habit.color,
            icon: habit.icon
        })),
        insights: generateRecommendations(overallCompletionRate, habitsArray.length, totalMissed, true),
        recommendations: generateRecommendations(overallCompletionRate, habitsArray.length, totalMissed)
    };
}

function generateRecommendations(completionRate, habitCount, totalMissed, includeInsights = false) {
    const recommendations = [];

    if (includeInsights) {
        if (completionRate >= 90) recommendations.push('🌟 Excellent consistency! You\'re maintaining 90%+ completion rate.');
        else if (completionRate >= 75) recommendations.push('💪 Great job! You\'re maintaining a 75%+ completion rate.');
        else if (completionRate >= 50) recommendations.push('📈 Good effort! Keep pushing to improve your completion rate.');
        else recommendations.push('⚠️ Time to refocus! Try to set more achievable daily goals.');

        if (currentUser.current_streak >= 20) recommendations.push(`🔥 Amazing streak of ${currentUser.current_streak} days! Keep it up!`);
        else if (currentUser.current_streak >= 10) recommendations.push(`✨ Solid streak of ${currentUser.current_streak} days. You\'re on fire!`);

        if (totalMissed > 0 && totalMissed >= habitCount) {
            recommendations.push(`📊 ${totalMissed} missed habits detected. Consider adjusting your goals or routine.`);
        }

        return recommendations;
    }

    if (habitCount > 7) {
        recommendations.push('Consider reducing the number of habits to focus on quality over quantity.');
    }
    if (completionRate < 70) {
        recommendations.push('Try setting more realistic daily goals or spreading habits throughout the week.');
    }
    if (totalMissed > 5) {
        recommendations.push('Identify the habits with the most misses and consider reassessing their feasibility.');
    }
    if (completionRate >= 80) {
        recommendations.push('Great job! Consider adding new habits to your tracker.');
    }
    if (recommendations.length === 0) {
        recommendations.push('Keep maintaining your current routine - it\'s working well for you!');
    }

    return recommendations;
}

function generateSimpleHtmlReport(report) {
    return generateHtmlReport(report);
}

function generateHtmlReport(report) {
    const completionRate = parseInt(report.overallStatistics.overallCompletionRate.replace('%', '')) || 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Habit Tracker Report</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f7fb; color: #0f172a; margin: 0; padding: 24px; }
    .wrap { max-width: 1000px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 12px 30px rgba(15,23,42,.12); }
    h1 { margin: 0 0 6px; }
    .muted { color: #667085; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .card { border: 1px solid #e4e8ef; border-radius: 10px; padding: 12px; background: #f9fafc; }
    .label { font-size: 12px; text-transform: uppercase; color: #667085; letter-spacing: .05em; }
    .value { font-size: 22px; font-weight: 700; }
    .bar { height: 10px; border-radius: 999px; background: #e4e8ef; overflow: hidden; margin-top: 8px; }
    .bar-fill { height: 100%; background: #10b981; width: ${completionRate}%; }
    ul { padding-left: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e8ef; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Habit Tracker Report</h1>
    <p class="muted">Generated ${new Date(report.metadata.exportDate).toLocaleString()}</p>

    <h2>Overview</h2>
    <div class="grid">
      <div class="card"><div class="label">Total Habits</div><div class="value">${report.overallStatistics.totalHabits}</div></div>
      <div class="card"><div class="label">Days Tracked</div><div class="value">${report.overallStatistics.totalDays}</div></div>
      <div class="card"><div class="label">Completion Rate</div><div class="value">${report.overallStatistics.overallCompletionRate}</div><div class="bar"><div class="bar-fill"></div></div></div>
      <div class="card"><div class="label">Completions</div><div class="value">${report.overallStatistics.totalCompletions}</div></div>
      <div class="card"><div class="label">Missed</div><div class="value">${report.overallStatistics.totalMissed}</div></div>
      <div class="card"><div class="label">Pending</div><div class="value">${report.overallStatistics.totalPending}</div></div>
    </div>

    <h2>Insights</h2>
    <ul>
      ${(report.insights || []).map(item => `<li>${item}</li>`).join('')}
    </ul>

    <h2>Recommendations</h2>
    <ul>
      ${(report.recommendations || []).map(item => `<li>${item}</li>`).join('')}
    </ul>

    <h2>Your Habits</h2>
    <table>
      <thead><tr><th>Habit</th><th>Category</th></tr></thead>
      <tbody>
        ${(report.habits || []).map(habit => `<tr><td>${habit.name}</td><td>${habit.category}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

async function handleExportData() {
    try {
        showLoading();
        await ensureCalendarData(true);
        const report = generateComprehensiveReport();

        if (!report || !report.overallStatistics) {
            showToast('Error: Invalid report data', 'error');
            return;
        }

        let htmlContent;
        try {
            htmlContent = generateHtmlReport(report);
        } catch (e) {
            htmlContent = generateSimpleHtmlReport(report);
        }

        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(htmlBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `habit-tracker-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Report exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast(`Export failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function handleResetData() {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        return;
    }

    if (!confirm('This will permanently delete all your habits and progress. Continue?')) {
        return;
    }

    showLoading();

    try {
        habits = [];
        dashboardData = null;

        showToast('All data has been reset', 'success');

        setTimeout(() => {
            switchView('dashboard');
            hideLoading();
        }, 1000);
    } catch (error) {
        console.error('Reset error:', error);
        showToast('Error resetting data', 'error');
        hideLoading();
    }
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Switch View
 */
function switchView(viewName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.setAttribute('hidden', '');
    });

    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) {
        activeView.classList.add('active');
        activeView.removeAttribute('hidden');
    }

    currentView = viewName;

    // Load data for specific views
    if (viewName === 'habits') {
        loadHabits(false);
    }

    if (viewName === 'calendar') {
        initializeCalendar();
    }

    if (viewName === 'profile') {
        loadProfileData();
    }
}

/**
 * Theme Toggle
 */
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');

    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('habit-tracker-theme', 'light');
        updateThemeIcon('light');
        if (currentUser && currentUser.settings) {
            currentUser.settings.theme = 'light';
        }
    } else {
        html.classList.add('dark');
        localStorage.setItem('habit-tracker-theme', 'dark');
        updateThemeIcon('dark');
        if (currentUser && currentUser.settings) {
            currentUser.settings.theme = 'dark';
        }
    }

    saveProfilePreferences();
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    const btn = document.getElementById('theme-toggle');
    const profileToggle = document.getElementById('profile-theme-toggle');

    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    if (btn) {
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }

    if (profileToggle) {
        profileToggle.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    }
}

/**
 * Utility Functions
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

function showLoading() {
    document.body.style.cursor = 'wait';
}

function hideLoading() {
    document.body.style.cursor = 'default';
}

async function deleteHabit(habitId) {
    const habitCard = document.querySelector(`[data-habit-id="${habitId}"]`);
    const habitName = habitCard ? habitCard.dataset.habitName : 'this habit';
    
    const confirmed = window.confirm(`Delete "${habitName}" permanently? This cannot be undone.`);
    if (!confirmed) {
        return;
    }

    showLoading();

    try {
        const result = await HabitAPI.deleteHabit(habitId);

        if (result.success) {
            showToast(result.message || 'Habit deleted successfully', 'success');

            if (currentView === 'dashboard') {
                await initializeDashboard();
            }

            await loadHabits(currentHabitsArchived);
        } else {
            showToast('Failed to delete habit: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Delete habit error:', error);
        showToast('Error deleting habit', 'error');
    } finally {
        hideLoading();
    }
}

window.deleteHabit = deleteHabit;
