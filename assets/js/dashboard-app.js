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
