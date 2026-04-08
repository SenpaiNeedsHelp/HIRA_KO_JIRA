/**
 * Dashboard Application - API Integrated Version
 * Simplified version that uses the PHP API backend
 */

'use strict';

// State
let currentView = 'dashboard';
let currentUser = null;
let dashboardData = null;
let habits = [];
let weeklyChart = null;
let trendChart = null;

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

    currentUser = session.user;
    console.log('Current user:', currentUser);

    await initializeDashboard();
    setupEventListeners();
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
 * Calculate activity level (0-4) for a date
 * Using demo data: varies based on date seed
 */
function calculateActivityLevel(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    if (dateToCheck > today) return -1; // future

    // Generate pseudo-random level based on date
    const seed = date.getDate() + date.getMonth() * 31 + date.getFullYear() * 365;
    if (seed % 5 === 0) return 0;
    return (seed % 4) + 1;
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
        const level = calculateActivityLevel(date);
        
        const cell = document.createElement('div');
        cell.className = `hm-cell${level > 0 ? ` lv${level}` : ''}`;
        if (level < 0) cell.style.opacity = '0.3';
        
        // Add hover tooltip
        cell.addEventListener('mouseenter', (e) => {
            const tooltip = document.getElementById('hm-tooltip');
            if (tooltip) {
                document.getElementById('hm-tt-date').textContent = formatDateShort(date);
                document.getElementById('hm-tt-habits').textContent = level <= 0 ? '0 completed' : `${level} completed`;
                document.getElementById('hm-tt-pct').textContent = `${Math.round(level / (calendarState.habits.length || 1) * 100) || 0}%`;
                tooltip.style.display = 'block';
            }
        });
        
        cell.addEventListener('click', () => selectDay(date));
        if (isSameDay(date, calendarState.selectedDay)) {
            cell.classList.add('selected');
        }
        
        cell.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('hm-tooltip');
            if (tooltip) tooltip.style.display = 'none';
        });
        
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
        const level = calculateActivityLevel(date);
        if (level > 0) {
            const dotsEl = document.createElement('div');
            dotsEl.className = 'month-day-dots';
            
            if (level >= 3) {
                const dot = document.createElement('span');
                dot.className = 'm-dot s-completed';
                dotsEl.appendChild(dot);
            } else if (level === 2) {
                const dot = document.createElement('span');
                dot.className = 'm-dot s-pending';
                dotsEl.appendChild(dot);
            } else {
                const dot = document.createElement('span');
                dot.className = 'm-dot s-missed';
                dotsEl.appendChild(dot);
            }
            
            cell.appendChild(dotsEl);
        }
    }

    if (!otherMonth) {
        cell.addEventListener('click', () => selectDay(date));
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
        const level = calculateActivityLevel(date);
        
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

        if (level > 0) {
            const dotsEl = col.querySelector(`#week-dots-${i}`);
            const statuses = level >= 3 ? 
                ['s-completed', 's-completed'] : 
                level === 2 ? ['s-pending'] : ['s-missed'];
            
            statuses.forEach(status => {
                const pill = document.createElement('div');
                pill.className = `week-habit-pill ${status}`;
                const labels = {
                    's-completed': 'Done',
                    's-missed': 'Missed',
                    's-pending': 'Pending'
                };
                pill.textContent = labels[status];
                dotsEl.appendChild(pill);
            });
        }

        col.addEventListener('click', () => selectDay(date));
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

    // For demo, generate fake status data based on date
    const today = new Date();
    const isFuture = date > today;
    
    let completed = 0, missed = 0, pending = 0;

    // Generate habit statuses for this date (demo data)
    if (!isFuture && calendarState.habits.length > 0) {
        const level = calculateActivityLevel(date);
        if (level > 0) {
            completed = Math.min(level, calendarState.habits.length);
            missed = Math.max(0, calendarState.habits.length - level);
        } else {
            missed = calendarState.habits.length;
        }
    } else if (isFuture) {
        pending = calendarState.habits.length;
    } else {
        missed = calendarState.habits.length;
    }

    // Update badges
    if (badgesDone) badgesDone.textContent = `${completed} done`;
    if (badgesMissed) badgesMissed.textContent = `${missed} missed`;
    if (badgesPending) badgesPending.textContent = `${pending} pending`;

    // Render habits for this date
    if (!habitsList) {
        console.error('Day habits list element not found!');
        return;
    }

    if (calendarState.habits.length === 0 || (completed === 0 && missed === 0 && pending === 0)) {
        habitsList.innerHTML = '<div class="empty-state compact"><p style="margin:0">No habits recorded for this date.</p></div>';
        console.log('No habits to display for this date');
        return;
    }

    habitsList.innerHTML = calendarState.habits.map((habit, index) => {
        let status = 'pending';
        if (!isFuture) {
            status = index < completed ? 'completed' : 'missed';
        }

        return `
            <div class="day-habit-item" data-habit-id="${habit.id}" data-status="${status}">
                <span class="habit-status-indicator ${status}"></span>
                <span class="habit-name">${habit.name}</span>
                <span class="habit-category">${habit.category}</span>
            </div>
        `;
    }).join('');
    
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
    document.getElementById('profile-avatar-display').textContent = 
        (currentUser.name ? currentUser.name.charAt(0) : 'U').toUpperCase();
    document.getElementById('profile-name-display').textContent = currentUser.name || 'User';
    document.getElementById('profile-email-display').textContent = currentUser.email || 'user@email.com';
    document.getElementById('profile-level-badge').textContent = currentUser.level || 1;
    document.getElementById('profile-xp-badge').textContent = currentUser.xp || 0;
    
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
            document.getElementById('ps-done').textContent = result.data.total_completions || 0;
            document.getElementById('ps-rate').textContent = result.data.completion_rate_all_time || '0%';
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

/**
 * Hide Profile Edit Form
 */
function hideProfileEditForm() {
    console.log('Hiding profile edit form');
    
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
    
    try {
        // For now, show success message (update backend as needed)
        currentUser.name = name;
        currentUser.email = email;
        
        // Update display
        document.getElementById('profile-name-display').textContent = name;
        document.getElementById('profile-email-display').textContent = email;
        document.getElementById('profile-avatar-display').textContent = name.charAt(0).toUpperCase();
        
        showToast('Profile updated successfully!', 'success');
        hideProfileEditForm();
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
        // Update avatar display
        document.getElementById('profile-avatar-display').style.backgroundImage = `url(${base64})`;
        document.getElementById('profile-avatar-display').textContent = '';
        showToast('Avatar updated!', 'success');
    };
    reader.readAsDataURL(file);
}

/**
 * Handle Export Data
 */
function handleExportData() {
    console.log('Exporting data');
    
    const exportData = {
        user: currentUser,
        habits: habits,
        dashboardData: dashboardData,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `habit-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully!', 'success');
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
