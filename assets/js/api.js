/**
 * API Integration Module for Habit Tracker
 * Handles all communication with the PHP backend
 */

const HabitAPI = {
    baseURL: '/jira/api',
    currentUser: null,

    /**
     * Make an API request
     */
    async request(endpoint, method = 'GET', data = null) {
        try {
            console.log(`API Request: ${method} ${this.baseURL}${endpoint}`);

            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            };

            if (data) {
                options.body = JSON.stringify(data);
                console.log('Request data:', data);
            }

            const response = await fetch(this.baseURL + endpoint, options);
            const result = await response.json();

            console.log(`API Response:`, result);

            if (!result.success) {
                console.error('API Error:', result.message);
            }

            return result;
        } catch (error) {
            console.error('Request failed:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Authentication
     */
    async login(email, password) {
        const result = await this.request('/auth/login.php', 'POST', { email, password });
        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('habit-tracker-auth', JSON.stringify({ authenticated: true }));
        }
        return result;
    },

    async signup(email, password, name) {
        const result = await this.request('/auth/signup.php', 'POST', { email, password, name });
        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('habit-tracker-auth', JSON.stringify({ authenticated: true }));
        }
        return result;
    },

    async logout() {
        const result = await this.request('/auth/logout.php', 'POST');
        if (result.success) {
            this.currentUser = null;
            localStorage.removeItem('habit-tracker-auth');
        }
        return result;
    },

    async checkSession() {
        const result = await this.request('/auth/session.php');
        if (result.success && result.authenticated) {
            this.currentUser = result.user;
        }
        return result;
    },

    /**
     * Dashboard & Stats
     */
    async getDashboardStats() {
        return await this.request('/stats/dashboard.php');
    },

    /**
     * Habits
     */
    async getHabits(archived = false, category = null) {
        let url = '/habits/list.php?archived=' + (archived ? '1' : '0');
        if (category) {
            url += '&category=' + encodeURIComponent(category);
        }
        return await this.request(url);
    },

    async updateProfile(profileData) {
        return await this.request('/auth/update.php', 'POST', profileData);
    },

    async createHabit(habitData) {
        return await this.request('/habits/create.php', 'POST', habitData);
    },

    async updateHabit(habitId, habitData) {
        return await this.request('/habits/update.php', 'POST', { id: habitId, ...habitData });
    },

    async deleteHabit(habitId) {
        return await this.request('/habits/delete.php', 'POST', { id: habitId });
    },

    async archiveHabit(habitId) {
        return await this.request('/habits/archive.php', 'POST', { id: habitId });
    },

    /**
     * Completions
     */
    async toggleCompletion(habitId, date, status = 'completed') {
        return await this.request('/completions/toggle.php', 'POST', {
            habit_id: habitId,
            date: date,
            status: status
        });
    },

    /**
     * Sync localStorage data to API (migration helper)
     */
    async migrateLocalStorageData() {
        try {
            // Get habits from localStorage
            const habitData = localStorage.getItem('habit-tracker-habits');
            if (habitData) {
                const localHabits = JSON.parse(habitData);
                console.log('Found', localHabits.length, 'habits in localStorage');

                // Create habits in database
                for (const habit of localHabits) {
                    await this.createHabit({
                        name: habit.name,
                        category: habit.category,
                        description: habit.description,
                        color: habit.color,
                        icon: habit.icon,
                        frequency: habit.frequency || 'daily'
                    });
                }

                console.log('Migration completed');
                return { success: true, message: 'Data migrated successfully' };
            }
        } catch (error) {
            console.error('Migration failed:', error);
            return { success: false, message: error.message };
        }
    }
};

// Make it globally available
window.HabitAPI = HabitAPI;
