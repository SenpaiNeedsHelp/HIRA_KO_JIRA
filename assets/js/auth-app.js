/**
 * Authentication Application
 * Handles login and signup using the PHP API
 */

'use strict';

let authMode = 'login';

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already authenticated
    const session = await HabitAPI.checkSession();

    if (session.authenticated) {
        window.location.href = 'dashboard.html';
        return;
    }

    setupAuthListeners();
});

/**
 * Setup Event Listeners
 */
function setupAuthListeners() {
    // Toggle buttons
    const loginToggle = document.getElementById('toggle-login');
    const signupToggle = document.getElementById('toggle-signup');

    if (loginToggle) {
        loginToggle.addEventListener('click', () => setAuthMode('login'));
    }

    if (signupToggle) {
        signupToggle.addEventListener('click', () => setAuthMode('signup'));
    }

    // Form submission
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
}

/**
 * Set Authentication Mode
 */
function setAuthMode(mode) {
    authMode = mode;

    const loginToggle = document.getElementById('toggle-login');
    const signupToggle = document.getElementById('toggle-signup');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('main-btn');
    const errorMsg = document.getElementById('error-msg');

    // Clear error
    errorMsg.textContent = '';

    // Update toggles
    if (mode === 'login') {
        loginToggle?.classList.add('active');
        signupToggle?.classList.remove('active');
        loginToggle?.setAttribute('aria-selected', 'true');
        signupToggle?.setAttribute('aria-selected', 'false');

        if (authTitle) authTitle.textContent = 'Login';
        if (authSubtitle) authSubtitle.textContent = 'Enter your details to access your account.';
        if (mainBtn) mainBtn.textContent = 'Login';
    } else {
        loginToggle?.classList.remove('active');
        signupToggle?.classList.add('active');
        loginToggle?.setAttribute('aria-selected', 'false');
        signupToggle?.setAttribute('aria-selected', 'true');

        if (authTitle) authTitle.textContent = 'Sign Up';
        if (authSubtitle) authSubtitle.textContent = 'Create a new account to get started.';
        if (mainBtn) mainBtn.textContent = 'Sign Up';
    }
}

/**
 * Handle Form Submission
 */
async function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    const mainBtn = document.getElementById('main-btn');

    // Clear previous error
    errorMsg.textContent = '';

    // Validate inputs
    if (!email || !password) {
        errorMsg.textContent = 'Please fill in all fields';
        return;
    }

    if (!isValidEmail(email)) {
        errorMsg.textContent = 'Please enter a valid email address';
        return;
    }

    if (password.length < 6) {
        errorMsg.textContent = 'Password must be at least 6 characters';
        return;
    }

    // Disable button during request
    mainBtn.disabled = true;
    mainBtn.textContent = 'Please wait...';

    try {
        let result;

        if (authMode === 'login') {
            result = await HabitAPI.login(email, password);
        } else {
            // For signup, we need a name
            const name = prompt('Please enter your name:');
            if (!name) {
                errorMsg.textContent = 'Name is required for signup';
                mainBtn.disabled = false;
                mainBtn.textContent = 'Sign Up';
                return;
            }
            result = await HabitAPI.signup(email, password, name);
        }

        if (result.success) {
            showToast('Success! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            errorMsg.textContent = result.message || 'Authentication failed';
            mainBtn.disabled = false;
            mainBtn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
        }
    } catch (error) {
        console.error('Auth error:', error);
        errorMsg.textContent = 'An error occurred. Please try again.';
        mainBtn.disabled = false;
        mainBtn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
    }
}

/**
 * Utility Functions
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
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

// Initialize theme on load
const savedTheme = localStorage.getItem('habit-tracker-theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}
