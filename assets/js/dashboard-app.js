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
let currentHabitsArchived = false;
let selectedHabitCategory = 'all';
let selectedHabitSort = 'custom';
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
    currentHabitsArchived = archived;

    try {
        const result = await HabitAPI.getHabits(archived, category);

        if (result.success) {
            habits = result.habits;

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

// Initialize theme on load
const savedTheme = localStorage.getItem('habit-tracker-theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}
updateThemeIcon(savedTheme);
