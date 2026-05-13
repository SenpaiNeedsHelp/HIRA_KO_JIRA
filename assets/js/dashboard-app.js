/**
 * Dashboard Application - API Integrated Version
 * Simplified version that uses the PHP API backend
 */

'use strict';

// State
let currentView = 'dashboard';
let currentUser = null;
let profileAvatarDraft = null;
let dashboardData = null;
let habits = [];
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

    const settingsPayload = {
        theme: currentUser?.settings?.theme ?? 'auto',
        notifications_enabled: Boolean(profilePreferences.notifications),
        notification_time: profilePreferences.notificationTime ? `${profilePreferences.notificationTime}:00` : null,
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
        console.log('Not authenticated, using test user');
        // Temporary: use test user for development
        currentUser = {
            id: 5,
            email: 'geeksatyam@gmail.com',
            name: 'satyam',
            avatar: null,
            level: 4,
            xp: 320,
            current_streak: 15,
            best_streak: 22,
            member_since: '2026-01-01 00:00:00'
        };
    } else {
        isAuthenticated = true;
        currentUser = session.user;
    }
    console.log('Current user:', currentUser);

    loadProfilePreferences();
    await initializeDashboard();
    setupEventListeners();
    initScheduledPreferences();
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
    const weeklyData = dashboardData.weekly_overview;

    // Weekly Overview Chart
    const weeklyCtx = document.getElementById('weekly-overview-chart');
    if (weeklyCtx) {
        if (weeklyChart) weeklyChart.destroy();

        weeklyChart = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: weeklyData.map(d => d.day),
                datasets: [{
                    label: 'Completed',
                    data: weeklyData.map(d => d.completed),
                    backgroundColor: '#4CAF50',
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
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
    try {
        const result = await HabitAPI.getHabits(archived, category);

        if (result.success) {
            habits = result.habits;
            renderHabitsList(habits, archived);
        } else {
            showToast('Failed to load habits', 'error');
        }
    } catch (error) {
        console.error('Load habits error:', error);
        showToast('Error loading habits', 'error');
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
        <article class="card habit-card" data-habit-id="${habit.id}">
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
            </div>
        </article>
    `).join('');
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
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

    // New Habit buttons
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('New Habit')) {
            btn.addEventListener('click', showNewHabitModal);
        }
    });

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Profile theme toggle
    const profileThemeToggle = document.getElementById('profile-theme-toggle');
    if (profileThemeToggle) {
        profileThemeToggle.addEventListener('click', toggleTheme);
        // Update initial state
        const isDark = document.documentElement.classList.contains('dark');
        profileThemeToggle.setAttribute('aria-checked', isDark ? 'true' : 'false');
    }

    // Notifications toggle
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

    // Download weekly report button
    const downloadWeeklyReportBtn = document.getElementById('download-weekly-report-btn');
    if (downloadWeeklyReportBtn) {
        downloadWeeklyReportBtn.addEventListener('click', downloadWeeklyReport);
    }

    // Logout (if exists in profile)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await HabitAPI.logout();
            window.location.href = 'index.html';
        });
    }

    // Profile edit button
    const profileEditBtn = document.getElementById('profile-edit-btn');
    if (profileEditBtn) {
        profileEditBtn.addEventListener('click', showProfileEditForm);
    }

    // Profile save button
    const profileSaveBtn = document.getElementById('profile-save-btn');
    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', handleProfileSave);
    }

    // Profile cancel button
    const profileCancelBtn = document.getElementById('profile-cancel-btn');
    if (profileCancelBtn) {
        profileCancelBtn.addEventListener('click', hideProfileEditForm);
    }

    // Export data button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportData);
    }

    // Reset data button  
    const resetDataBtn = document.getElementById('reset-data-btn');
    if (resetDataBtn) {
        resetDataBtn.addEventListener('click', handleResetData);
    }

    // Avatar upload
    const avatarInput = document.getElementById('profile-avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarUpload);
    }
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
    } else {
        html.classList.add('dark');
        localStorage.setItem('habit-tracker-theme', 'dark');
        updateThemeIcon('dark');
    }
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

/**
 * New Habit Modal
 */
function showNewHabitModal() {
    const modal = document.getElementById('modal-backdrop');
    if (!modal) {
        // Create modal dynamically
        createNewHabitModal();
        return;
    }

    // Show existing modal
    const modalBox = modal.querySelector('.modal-box');
    modalBox.innerHTML = `
        <h3>Create New Habit</h3>
        <form id="new-habit-form" style="margin: 20px 0;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Habit Name <span style="color: #e53935;">*</span></label>
                <input type="text" id="habit-name" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Category</label>
                <select id="habit-category" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;">
                    <option value="Health">Health</option>
                    <option value="Fitness">Fitness</option>
                    <option value="Study">Study</option>
                    <option value="Work">Work</option>
                    <option value="Mind">Mind</option>
                    <option value="Personal">Personal</option>
                    <option value="Social">Social</option>
                    <option value="Other">Other</option>
                </select>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Description</label>
                <textarea id="habit-description" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Icon (Emoji)</label>
                <input type="text" id="habit-icon" value="⭐" maxlength="2" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 24px; text-align: center;">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Color</label>
                <input type="color" id="habit-color" value="#4CAF50" style="width: 100%; height: 50px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
            </div>
        </form>

        <div class="modal-actions">
            <button class="btn-primary" id="create-habit-btn" type="button">Create Habit</button>
            <button class="btn-ghost" id="cancel-habit-btn" type="button">Cancel</button>
        </div>
    `;

    modal.style.display = 'flex';

    // Event listeners
    document.getElementById('create-habit-btn').addEventListener('click', handleCreateHabit);
    document.getElementById('cancel-habit-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function createNewHabitModal() {
    const modal = document.createElement('div');
    modal.id = 'habit-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div class="modal-box" style="background: white; padding: 30px; border-radius: 16px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h3>Create New Habit</h3>
            <form id="new-habit-form" style="margin: 20px 0;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Habit Name <span style="color: #e53935;">*</span></label>
                    <input type="text" id="habit-name" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Category</label>
                    <select id="habit-category" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;">
                        <option value="Health">Health</option>
                        <option value="Fitness">Fitness</option>
                        <option value="Study">Study</option>
                        <option value="Work">Work</option>
                        <option value="Mind">Mind</option>
                        <option value="Personal">Personal</option>
                        <option value="Social">Social</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Description</label>
                    <textarea id="habit-description" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Icon (Emoji)</label>
                    <input type="text" id="habit-icon" value="⭐" maxlength="2" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 24px; text-align: center;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Color</label>
                    <input type="color" id="habit-color" value="#4CAF50" style="width: 100%; height: 50px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
                </div>
            </form>

            <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn-ghost" id="cancel-habit-btn" type="button" style="padding: 10px 20px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; background: white;">Cancel</button>
                <button class="btn-primary" id="create-habit-btn" type="button" style="padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; background: #4CAF50; color: white; font-weight: 600;">Create Habit</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('create-habit-btn').addEventListener('click', handleCreateHabit);
    document.getElementById('cancel-habit-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

async function handleCreateHabit() {
    const name = document.getElementById('habit-name').value.trim();
    const category = document.getElementById('habit-category').value;
    const description = document.getElementById('habit-description').value.trim();
    const icon = document.getElementById('habit-icon').value || '⭐';
    const color = document.getElementById('habit-color').value;

    if (!name) {
        showToast('Please enter a habit name', 'error');
        return;
    }

    const habitData = {
        name,
        category,
        description,
        icon,
        color,
        frequency: 'daily'
    };

    showLoading();

    try {
        const result = await HabitAPI.createHabit(habitData);

        if (result.success) {
            showToast('Habit created successfully!', 'success');

            // Close modal
            const modal = document.getElementById('habit-modal') || document.getElementById('modal-backdrop');
            if (modal) modal.style.display = 'none';

            // Refresh dashboard
            await initializeDashboard();

            // If on habits view, reload habits
            if (currentView === 'habits') {
                await loadHabits(false);
            }
        } else {
            showToast('Failed to create habit: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Create habit error:', error);
        showToast('Error creating habit', 'error');
    } finally {
        hideLoading();
    }
}

/* ═════════════════════════════════════════
   CALENDAR HELPER FUNCTIONS (defined first)
═════════════════════════════════════════ */

/**
 * Check if two dates are the same day
 */
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Get the start of the week (Sunday)
 */
function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

/**
 * Add days to a date
 */
function addDaysToDate(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Format date short (e.g., "Mar 15")
 */
function formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate activity status for a date
 * Returns: 'completed', 'pending', 'missed', or 'none'
 */
function calculateActivityLevel(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    if (dateToCheck > today) return 'none'; // future

    // Use local date string to match API format
    const dateKey = dateToCheck.getFullYear() + '-' + 
                   String(dateToCheck.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(dateToCheck.getDate()).padStart(2, '0');
    const dayData = heatMapData[dateKey];
    
    if (!dayData) return 'none';
    
    // If there are completed habits, return completed
    if (dayData.completed > 0) return 'completed';
    
    // If there are missed habits, return missed
    if (dayData.missed > 0) return 'missed';
    
    // If there are pending habits, return pending
    if (dayData.pending > 0) return 'pending';
    
    return 'none';
}

/* ═════════════════════════════════════════
   CALENDAR FUNCTIONALITY
═════════════════════════════════════════ */

// Calendar state (now safe to use helper functions)
let calendarState = {
    activeTab: 'heatmap',
    monthDate: new Date(),
    weekStart: getWeekStartDate(new Date()),
    selectedDay: new Date(),
    habits: [],
    completions: {} // { 'YYYY-MM-DD': { habit_id: 'status' } }
};

let heatMapData = {}; // { 'YYYY-MM-DD': { completed: count, missed: count, pending: count } }

/**
 * Initialize Calendar
 */
async function initializeCalendar() {
    console.log('initializeCalendar called');
    showLoading();
    try {
        // Fetch all habits for calendar display
        const habitsResult = await HabitAPI.getHabits(false);
        console.log('Habits result:', habitsResult);
        if (habitsResult.success) {
            calendarState.habits = habitsResult.habits || [];
            console.log('Loaded', calendarState.habits.length, 'habits');
        }
        
        // Fetch heat map data
        const heatMapJson = await HabitAPI.request(`/calendar/heatmap.php?user_id=${currentUser.id}`);
        if (heatMapJson.success) {
            heatMapData = heatMapJson.data || {};
            console.log('Loaded heatmap data:', heatMapData);
        }
        
        // Setup calendar UI
        console.log('Setting up calendar tabs...');
        setupCalendarTabs();
        console.log('Rendering heatmap...');
        renderHeatmap();
        console.log('Rendering month view...');
        renderMonthView();
        console.log('Rendering week view...');
        renderWeekView();
        console.log('Rendering day panel...');
        renderDayPanel(calendarState.selectedDay);
        console.log('Calendar initialization complete');
    } catch (error) {
        console.error('Calendar init error:', error);
        showToast('Error loading calendar', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Setup Calendar Tab Switching
 */
function setupCalendarTabs() {
    console.log('setupCalendarTabs called');
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
    
    console.log('Tabs and panels found:', {
        tabs: Object.entries(tabs).map(([k, v]) => [k, !!v]),
        panels: Object.entries(panels).map(([k, v]) => [k, !!v])
    });

    function activateTab(tabName) {
        console.log('Activating tab:', tabName);
        calendarState.activeTab = tabName;
        
        // Update tab buttons
        Object.entries(tabs).forEach(([k, btn]) => {
            if (btn) {
                btn.classList.toggle('active', k === tabName);
                btn.setAttribute('aria-pressed', String(k === tabName));
            }
        });
        
        // Update panels
        Object.entries(panels).forEach(([k, panel]) => {
            if (panel) {
                panel.style.display = k === tabName ? '' : 'none';
            }
        });

        // Re-render the active view
        if (tabName === 'heatmap') renderHeatmap();
        if (tabName === 'month') renderMonthView();
        if (tabName === 'week') renderWeekView();
    }

    // Add click listeners
    Object.entries(tabs).forEach(([k, btn]) => {
        if (btn) {
            btn.addEventListener('click', () => activateTab(k));
        }
    });

    // Set initial tab
    activateTab(calendarState.activeTab);
    
    // Setup navigation buttons
    setupCalendarNavigation();
}

/**
 * Setup Calendar Navigation
 */
function setupCalendarNavigation() {
    // Month navigation
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
    
    // Week navigation
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

/**
 * Render Heatmap (Last 90 Days)
 */
function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    console.log('renderHeatmap called, grid:', grid);
    if (!grid) {
        console.error('Heatmap grid element not found!');
        return;
    }

    grid.innerHTML = '';
    const today = new Date();
    console.log('Creating heatmap for today:', today);

    // Generate 90 days of cells (12 weeks = 84 + 6 buffer = 90)
    for (let i = 89; i >= 0; i--) {
        const date = addDaysToDate(today, -i);
        const status = calculateActivityLevel(date);
        
        const cell = document.createElement('div');
        cell.className = `hm-cell${status !== 'none' ? ` ${status}` : ''}`;
        if (status === 'none') cell.style.opacity = '0.3';
        
        // Add hover tooltip
        cell.addEventListener('mouseenter', (e) => showCalendarTooltip(date, e));
        cell.addEventListener('mousemove', moveCalendarTooltip);
        cell.addEventListener('mouseleave', hideCalendarTooltip);
        
        cell.addEventListener('click', () => selectDay(date));
        if (isSameDay(date, calendarState.selectedDay)) {
            cell.classList.add('selected');
        }
        
        grid.appendChild(cell);
    }
    console.log('Heatmap rendered with', grid.children.length, 'cells');
}

/**
 * Render Month View
 */
function renderMonthView() {
    const title = document.getElementById('month-title');
    const grid = document.getElementById('month-grid');
    
    console.log('renderMonthView called, title:', !!title, 'grid:', !!grid);
    if (!grid || !title) {
        console.error('Month view elements not found!');
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

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, daysInPrevMonth - i);
        const dayEl = createMonthDayElement(date, true);
        grid.appendChild(dayEl);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dayEl = createMonthDayElement(date, false);
        grid.appendChild(dayEl);
    }

    // Next month padding
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remainingCells; d++) {
        const date = new Date(year, month + 1, d);
        const dayEl = createMonthDayElement(date, true);
        grid.appendChild(dayEl);
    }
    
    console.log('Month view rendered with', grid.children.length, 'days');
}

/**
 * Create Month Day Element
 */
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

    // Day number
    const numEl = document.createElement('span');
    numEl.className = 'month-day-num';
    numEl.textContent = date.getDate();
    cell.appendChild(numEl);

    // Status dots
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

/**
 * Render Week View
 */
function renderWeekView() {
    const title = document.getElementById('week-title');
    const grid = document.getElementById('week-grid');
    
    console.log('renderWeekView called, title:', !!title, 'grid:', !!grid);
    if (!grid || !title) {
        console.error('Week view elements not found!');
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
                'completed': 'Done',
                'missed': 'Missed',
                'pending': 'Pending'
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
    
    console.log('Week view rendered with', grid.children.length, 'days');
}

/**
 * Select Day and Update Panel
 */
function selectDay(date) {
    calendarState.selectedDay = new Date(date);
    renderDayPanel(date);
    
    // Update selections in active tab
    document.querySelectorAll('.hm-cell.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.month-day.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.week-day-col.selected').forEach(el => el.classList.remove('selected'));

    // Re-render active view
    if (calendarState.activeTab === 'heatmap') renderHeatmap();
    if (calendarState.activeTab === 'month') renderMonthView();
    if (calendarState.activeTab === 'week') renderWeekView();
}

/**
 * Render Day Detail Panel
 */
function renderDayPanel(date) {
    const title = document.getElementById('cal-day-title');
    const badgesDone = document.getElementById('day-done-badge');
    const badgesMissed = document.getElementById('day-missed-badge');
    const badgesPending = document.getElementById('day-pending-badge');
    const habitsList = document.getElementById('day-habits-list');

    console.log('renderDayPanel called for', date, {
        title: !!title,
        badgesDone: !!badgesDone,
        badgesMissed: !!badgesMissed,
        badgesPending: !!badgesPending,
        habitsList: !!habitsList
    });

    if (!title) {
        console.error('Day panel title element not found!');
        return;
    }

    // Set date title
    title.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Get real completion data for this date
    const dateKey = date.getFullYear() + '-' + 
                   String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(date.getDate()).padStart(2, '0');
    const dayData = heatMapData[dateKey] || { completed: 0, missed: 0, pending: 0 };
    
    const completed = dayData.completed || 0;
    const missed = dayData.missed || 0;
    const pending = dayData.pending || 0;

    // Update badges
    if (badgesDone) badgesDone.textContent = `${completed} done`;
    if (badgesMissed) badgesMissed.textContent = `${missed} missed`;
    if (badgesPending) badgesPending.textContent = `${pending} pending`;

    // Render habits summary for this date
    if (!habitsList) {
        console.error('Day habits list element not found!');
        return;
    }

    if (completed === 0 && missed === 0 && pending === 0) {
        habitsList.innerHTML = '<div class="empty-state compact"><p style="margin:0">No habits recorded for this date.</p></div>';
        console.log('No habits to display for this date');
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
    
    console.log('Day panel rendered with', calendarState.habits.length, 'habits');
}

/* ═════════════════════════════════════════
   PROFILE FUNCTIONALITY
═════════════════════════════════════════ */

/**
 * Load and Display Profile Data
 */
async function loadProfileData() {
    console.log('Loading profile data for user:', currentUser);
    
    // Display user info
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
    
    // Update XP bar
    const xpLevel = currentUser.level || 1;
    const xpCurrent = currentUser.xp || 0;
    const xpNeeded = xpLevel * 100; // Simple calculation: level * 100 XP needed
    const xpPercent = Math.min(100, (xpCurrent / xpNeeded) * 100);
    
    document.getElementById('xp-level').textContent = xpLevel;
    document.getElementById('xp-bar').style.width = xpPercent + '%';
    document.getElementById('xp-label').textContent = `${xpCurrent} / ${xpNeeded} XP`;
    
    // Load profile stats
    try {
        const result = await HabitAPI.getDashboardStats();
        if (result.success) {
            document.getElementById('ps-total').textContent = result.data.total_habits || 0;
            document.getElementById('ps-streak').textContent = currentUser.best_streak || 0;
            
            // Calculate total completions
            let totalCompletions = 0;
            if (result.data.weekly_overview) {
                totalCompletions = result.data.weekly_overview.reduce((sum, day) => sum + day.completed, 0);
            }
            document.getElementById('ps-done').textContent = totalCompletions;
            
            // Calculate all-time completion rate (simplified)
            const totalPossible = (result.data.total_habits || 0) * 30; // Rough estimate
            const rate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
            document.getElementById('ps-rate').textContent = rate + '%';
        }
    } catch (error) {
        console.error('Error loading profile stats:', error);
    }
}

/**
 * Show Profile Edit Form
 */
function showProfileEditForm() {
    console.log('Showing profile edit form');
    
    // Populate form with current data
    document.getElementById('edit-name').value = currentUser.name || '';
    document.getElementById('edit-email').value = currentUser.email || '';
    document.getElementById('edit-password').value = '';
    document.getElementById('edit-password-confirm').value = '';
    
    // Hide hero card, show edit card
    document.querySelector('.profile-hero').style.display = 'none';
    document.getElementById('profile-edit-card').style.display = 'block';
    
    // Clear errors
    clearProfileErrors();
}

function renderProfileAvatar(avatar) {
    const avatarEl = document.getElementById('profile-avatar-display');
    if (!avatarEl) return;

    // Use draft avatar if available
    const displayAvatar = profileAvatarDraft !== null ? profileAvatarDraft : avatar;

    if (displayAvatar) {
        avatarEl.style.backgroundImage = `url(${displayAvatar})`;
        avatarEl.textContent = '';
    } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = (currentUser && currentUser.name ? currentUser.name.charAt(0) : 'U').toUpperCase();
    }
}

/**
 * Hide Profile Edit Form
 */
function hideProfileEditForm() {
    console.log('Hiding profile edit form');

    if (profileAvatarDraft) {
        profileAvatarDraft = null;
        const avatarInput = document.getElementById('profile-avatar-input');
        if (avatarInput) {
            avatarInput.value = '';
        }
        renderProfileAvatar(currentUser.avatar);
    }
    
    // Show hero card, hide edit card
    document.querySelector('.profile-hero').style.display = 'block';
    document.getElementById('profile-edit-card').style.display = 'none';
    
    // Clear errors
    clearProfileErrors();
}

/**
 * Clear Profile Form Errors
 */
function clearProfileErrors() {
    document.getElementById('err-name').textContent = '';
    document.getElementById('err-email').textContent = '';
    document.getElementById('err-password').textContent = '';
    document.getElementById('err-password-confirm').textContent = '';
}

/**
 * Validate Profile Form
 */
function validateProfileForm() {
    clearProfileErrors();
    let isValid = true;
    
    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const password = document.getElementById('edit-password').value;
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
    
    return isValid;
}

/**
 * Handle Profile Save
 */
async function handleProfileSave() {
    console.log('Saving profile changes');
    
    if (!validateProfileForm()) {
        showToast('Please fix the errors', 'error');
        return;
    }
    
    showLoading();
    
    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const password = document.getElementById('edit-password').value;
    
    const updateData = {
        name,
        email,
        settings: {
            theme: currentUser?.settings?.theme ?? 'auto',
            notifications_enabled: Boolean(profilePreferences.notifications),
            notification_time: profilePreferences.notificationTime ? `${profilePreferences.notificationTime}:00` : null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        }
    };

    if (password) {
        updateData.password = password;
    }
    if (profileAvatarDraft !== null) {
        updateData.avatar = profileAvatarDraft;
    }
    
    try {
        const result = await HabitAPI.updateProfile(updateData);
        if (!result.success) {
            showToast(result.message || 'Failed to update profile', 'error');
            return;
        }

        currentUser = result.user;
        profileAvatarDraft = null;

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

/**
 * Handle Avatar Upload
 */
async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('File size must be less than 2MB', 'error');
        return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        profileAvatarDraft = base64;
        renderProfileAvatar(base64);
        showToast('Avatar ready to save!', 'success');
    };
    reader.readAsDataURL(file);
}

/**
 * Generate comprehensive report with analysis
 */
function generateComprehensiveReport() {
    const habitsArray = Object.values(calendarState.habits || {});
    
    // Calculate statistics
    const totalCompletions = Object.values(heatMapData).reduce((sum, day) => sum + (day.completed || 0), 0);
    const totalMissed = Object.values(heatMapData).reduce((sum, day) => sum + (day.missed || 0), 0);
    const totalPending = Object.values(heatMapData).reduce((sum, day) => sum + (day.pending || 0), 0);
    const totalDays = Object.keys(heatMapData).length;
    const overallCompletionRate = totalDays > 0 ? Math.round((totalCompletions / (totalCompletions + totalMissed + totalPending)) * 100) : 0;
    
    // Analyze daily performance
    const dailyPerformance = Object.entries(heatMapData).map(([date, data]) => ({
        date,
        completed: data.completed || 0,
        missed: data.missed || 0,
        pending: data.pending || 0,
        total: (data.completed || 0) + (data.missed || 0) + (data.pending || 0),
        completionRate: ((data.completed || 0) / ((data.completed || 0) + (data.missed || 0) + (data.pending || 0) || 1)) * 100
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Find best and worst days
    const bestDay = dailyPerformance.reduce((best, day) => day.completionRate > best.completionRate ? day : best, dailyPerformance[0] || {});
    const worstDay = dailyPerformance.reduce((worst, day) => (day.missed > 0 || day.pending > 0) && day.completionRate < worst.completionRate ? day : worst, dailyPerformance[0] || {});
    
    // Week analysis
    const weekStats = {};
    dailyPerformance.forEach(day => {
        const date = new Date(day.date);
        const weekNum = Math.ceil((date.getDate()) / 7);
        const week = `Week ${weekNum}`;
        if (!weekStats[week]) {
            weekStats[week] = { completed: 0, missed: 0, pending: 0, days: 0 };
        }
        weekStats[week].completed += day.completed;
        weekStats[week].missed += day.missed;
        weekStats[week].pending += day.pending;
        weekStats[week].days += 1;
    });
    
    // Insights
    const insights = [];
    if (overallCompletionRate >= 90) insights.push('🌟 Excellent consistency! You\'re maintaining 90%+ completion rate.');
    else if (overallCompletionRate >= 75) insights.push('💪 Great job! You\'re maintaining a 75%+ completion rate.');
    else if (overallCompletionRate >= 50) insights.push('📈 Good effort! Keep pushing to improve your completion rate.');
    else insights.push('⚠️ Time to refocus! Try to set more achievable daily goals.');
    
    if (currentUser.current_streak >= 20) insights.push(`🔥 Amazing streak of ${currentUser.current_streak} days! Keep it up!`);
    else if (currentUser.current_streak >= 10) insights.push(`✨ Solid streak of ${currentUser.current_streak} days. You\'re on fire!`);
    
    if (totalPending > totalMissed) insights.push('⏳ You have pending habits. Try to complete them as soon as possible.');
    else if (totalMissed > 0) insights.push(`📊 ${totalMissed} missed habits detected. Consider adjusting your goals or routine.`);
    
    const report = {
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
            totalDays: totalDays,
            totalCompletions: totalCompletions,
            totalMissed: totalMissed,
            totalPending: totalPending,
            overallCompletionRate: `${overallCompletionRate}%`,
            averageCompletionsPerDay: totalDays > 0 ? (totalCompletions / totalDays).toFixed(1) : 0,
            averageMissedPerDay: totalDays > 0 ? (totalMissed / totalDays).toFixed(1) : 0
        },
        dailyPerformance: {
            bestDay: bestDay,
            worstDay: worstDay,
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
        insights: insights,
        recommendations: generateRecommendations(overallCompletionRate, habitsArray.length, totalMissed)
    };
    
    return report;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(completionRate, habitCount, totalMissed) {
    const recommendations = [];
    
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

/**
 * Generate simple HTML report (fallback)
 */
function generateSimpleHtmlReport(report) {
    const rate = parseInt(report.overallStatistics.overallCompletionRate.replace('%', '')) || 0;
    
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Habit Report</title>
<style>body{font-family:Arial;max-width:900px;margin:50px auto;background:#f5f5f5;padding:20px;}
.header{background:#667eea;color:white;padding:20px;border-radius:8px;margin-bottom:20px;}
.section{background:white;padding:20px;margin:20px 0;border-radius:8px;box-shadow:0 2px 4px #0001;}
h2{color:#667eea;border-bottom:2px solid #667eea;padding-bottom:10px;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0;}
.stat{background:#f0f0f0;padding:15px;border-radius:4px;text-align:center;}
.stat-value{font-size:24px;font-weight:bold;color:#667eea;}
.insights{background:#e7f3ff;border-left:4px solid #2196F3;padding:15px;margin:10px 0;}
.habits{width:100%;border-collapse:collapse;}
.habits th{background:#667eea;color:white;padding:10px;}
.habits td{padding:10px;border-bottom:1px solid #ddd;}
</style></head><body>
<div class="header"><h1>📊 Habit Tracker Report</h1><p>${new Date().toLocaleString()}</p></div>
<div class="section">
<h2>User: ${report.userProfile.name}</h2>
<p>Email: ${report.userProfile.email}</p>
<p>Level: ⭐ ${report.userProfile.level} | XP: ✨ ${report.userProfile.xp}</p>
<p>Streak: 🔥 ${report.userProfile.currentStreak} days (Best: 🏆 ${report.userProfile.bestStreak})</p>
</div>
<div class="section">
<h2>📈 Statistics</h2>
<div class="stats">
<div class="stat"><div class="stat-value">${report.overallStatistics.totalHabits}</div>Total Habits</div>
<div class="stat"><div class="stat-value">${report.overallStatistics.totalDays}</div>Days Tracked</div>
<div class="stat"><div class="stat-value">${report.overallStatistics.overallCompletionRate}</div>Completion</div>
</div>
<div class="stats">
<div class="stat"><div class="stat-value">${report.overallStatistics.totalCompletions}</div>Completed</div>
<div class="stat"><div class="stat-value">${report.overallStatistics.totalMissed}</div>Missed</div>
<div class="stat"><div class="stat-value">${report.overallStatistics.totalPending}</div>Pending</div>
</div>
</div>
<div class="section">
<h2>💡 Insights</h2>
${report.insights.map(i => `<div class="insights">✓ ${i}</div>`).join('')}
</div>
<div class="section">
<h2>🎯 Recommendations</h2>
${report.recommendations.map(r => `<div class="insights">→ ${r}</div>`).join('')}
</div>
<div class="section">
<h2>🎪 Your Habits</h2>
<table class="habits"><thead><tr><th>Habit</th><th>Category</th></tr></thead><tbody>
${report.habits.map(h => `<tr><td>${h.name}</td><td>${h.category}</td></tr>`).join('')}
</tbody></table>
</div>
</body></html>`;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report) {
    const completionRate = parseInt(report.overallStatistics.overallCompletionRate.replace('%', '')) || 0;
    const completionColor = completionRate >= 80 ? '#10b981' : completionRate >= 60 ? '#fbbf24' : '#ef4444';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Habit Tracker - Comprehensive Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section h2 {
            font-size: 1.8em;
            color: #667eea;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            transition: transform 0.3s;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            border-color: #667eea;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        
        .stat-label {
            font-size: 0.9em;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .completion-bar {
            width: 100%;
            height: 30px;
            background: #e9ecef;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .completion-fill {
            height: 100%;
            background: ${completionColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 0.3s;
        }
        
        .insights {
            background: #f0f7ff;
            border-left: 4px solid #0284c7;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        
        .insights li {
            margin: 10px 0;
            font-size: 1em;
            line-height: 1.6;
        }
        
        .recommendations {
            background: #f0fdf4;
            border-left: 4px solid #16a34a;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        
        .recommendations li {
            margin: 10px 0;
            font-size: 1em;
            line-height: 1.6;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
        }
        
        tr:hover {
            background: #f8f9fa;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .badge-completed {
            background: #d1fae5;
            color: #065f46;
        }
        
        .badge-missed {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .badge-pending {
            background: #fef3c7;
            color: #92400e;
        }
        
        .user-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .user-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        
        .user-info-item {
            padding: 10px;
        }
        
        .user-info-label {
            color: #6c757d;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        
        .user-info-value {
            color: #333;
            font-size: 1.1em;
            font-weight: 600;
            margin-top: 5px;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }
        
        .progress-item {
            margin: 15px 0;
        }
        
        .progress-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-weight: 500;
        }
        
        .best-worst {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        
        .day-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid;
        }
        
        .day-card.best {
            border-left-color: #10b981;
        }
        
        .day-card.worst {
            border-left-color: #ef4444;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
                border-radius: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Habit Tracker Report</h1>
            <p>Comprehensive Analysis & Insights</p>
            <p style="font-size: 0.9em; margin-top: 10px;">Generated ${new Date(report.metadata.exportDate).toLocaleString()}</p>
        </div>
        
        <div class="content">
            <!-- User Profile -->
            <div class="section">
                <h2>👤 User Profile</h2>
                <div class="user-card">
                    <div class="user-info">
                        <div class="user-info-item">
                            <div class="user-info-label">Name</div>
                            <div class="user-info-value">${report.userProfile.name}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">Email</div>
                            <div class="user-info-value">${report.userProfile.email}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">Level</div>
                            <div class="user-info-value">⭐ ${report.userProfile.level}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">XP/Experience</div>
                            <div class="user-info-value">✨ ${report.userProfile.xp.toLocaleString()}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">Current Streak</div>
                            <div class="user-info-value">🔥 ${report.userProfile.currentStreak} days</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">Best Streak</div>
                            <div class="user-info-value">🏆 ${report.userProfile.bestStreak} days</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Overall Statistics -->
            <div class="section">
                <h2>📈 Overall Statistics</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Habits</div>
                        <div class="stat-value">${report.overallStatistics.totalHabits}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Days Tracked</div>
                        <div class="stat-value">${report.overallStatistics.totalDays}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Completions</div>
                        <div class="stat-value" style="color: #10b981;">${report.overallStatistics.totalCompletions}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Missed</div>
                        <div class="stat-value" style="color: #ef4444;">${report.overallStatistics.totalMissed}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Pending</div>
                        <div class="stat-value" style="color: #fbbf24;">${report.overallStatistics.totalPending}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Avg per Day</div>
                        <div class="stat-value">${report.overallStatistics.averageCompletionsPerDay}</div>
                    </div>
                </div>
                
                <div class="progress-item">
                    <div class="progress-label">
                        <span>Overall Completion Rate</span>
                        <strong>${report.overallStatistics.overallCompletionRate}</strong>
                    </div>
                    <div class="completion-bar">
                        <div class="completion-fill" style="width: ${completionRate}%">
                            ${completionRate}%
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Daily Performance -->
            <div class="section">
                <h2>📅 Daily Performance</h2>
                <div class="best-worst">
                    <div class="day-card best">
                        <h3>🏆 Best Day</h3>
                        <p><strong>Date:</strong> ${report.dailyPerformance.bestDay.date || 'N/A'}</p>
                        <p><strong>Completion Rate:</strong> ${(report.dailyPerformance.bestDay.completionRate || 0).toFixed(0)}%</p>
                        <p><span class="badge badge-completed">${report.dailyPerformance.bestDay.completed} Completed</span></p>
                    </div>
                    <div class="day-card worst">
                        <h3>⚠️ Challenging Day</h3>
                        <p><strong>Date:</strong> ${report.dailyPerformance.worstDay.date || 'N/A'}</p>
                        <p><strong>Completion Rate:</strong> ${(report.dailyPerformance.worstDay.completionRate || 0).toFixed(0)}%</p>
                        <p><span class="badge badge-missed">${report.dailyPerformance.worstDay.missed} Missed</span></p>
                    </div>
                </div>
            </div>
            
            <!-- Insights -->
            <div class="section">
                <h2>💡 Key Insights</h2>
                <div class="insights">
                    <ul>
                        ${report.insights.map(insight => `<li>${insight}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <!-- Recommendations -->
            <div class="section">
                <h2>🎯 Recommendations</h2>
                <div class="recommendations">
                    <ul>
                        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <!-- Habits List -->
            <div class="section">
                <h2>🎪 Your Habits</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Habit</th>
                            <th>Category</th>
                            <th>Frequency</th>
                            <th>Icon</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.habits.map(habit => `
                            <tr>
                                <td>${habit.name}</td>
                                <td>${habit.category}</td>
                                <td>${habit.frequency}</td>
                                <td>${habit.icon}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by Habit Tracker | ${new Date(report.metadata.exportDate).toLocaleDateString()}</p>
            <p style="font-size: 0.9em; margin-top: 10px;">Keep building better habits! 💪</p>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Handle Export Data
 */
function handleExportData() {
    try {
        console.log('Starting export...');
        const report = generateComprehensiveReport();
        console.log('Report generated:', report);
        
        if (!report || !report.overallStatistics) {
            console.error('Invalid report structure');
            showToast('Error: Invalid report data', 'error');
            return;
        }
        
        let htmlContent;
        try {
            htmlContent = generateHtmlReport(report);
            console.log('Beautiful HTML generated, length:', htmlContent.length);
        } catch (e) {
            console.warn('Beautiful HTML failed, using simple version:', e);
            htmlContent = generateSimpleHtmlReport(report);
            console.log('Simple HTML generated, length:', htmlContent.length);
        }
        
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        console.log('Blob created, size:', htmlBlob.size);
        
        const url = URL.createObjectURL(htmlBlob);
        console.log('Object URL created:', url);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `habit-tracker-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        console.log('Link created and appended');
        
        link.click();
        console.log('Link clicked');
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('Cleanup completed');
        
        showToast('Beautiful report exported successfully! 🎉', 'success');
    } catch (error) {
        console.error('Export error:', error);
        console.error('Stack:', error.stack);
        showToast(`Export failed: ${error.message}`, 'error');
    }
}

/**
 * Handle Reset Data
 */
function handleResetData() {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will permanently delete all your habits and progress. Continue?')) {
        return;
    }
    
    showLoading();
    
    try {
        // Clear local data
        habits = [];
        dashboardData = null;
        
        // Update UI
        showToast('All data has been reset', 'success');
        
        // Redirect to dashboard
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

/**
 * Utility: Check if email is valid
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Initialize theme on load
const savedTheme = localStorage.getItem('habit-tracker-theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}
updateThemeIcon(savedTheme);
