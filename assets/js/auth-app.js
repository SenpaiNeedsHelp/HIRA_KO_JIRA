/**
 * Authentication Application
 * Handles login, signup, and password reset using the PHP API
 */

'use strict';

let authMode = 'login';
let otpTimer = null;
let currentResendCount = 0;
const RESEND_LIMIT = 3;
const RESEND_WAIT_SECONDS = 50;

document.addEventListener('DOMContentLoaded', async () => {
    const session = await HabitAPI.checkSession();

    if (session.success || session.authenticated) {
        window.location.href = 'dashboard.html';
        return;
    }

    setupAuthListeners();
    setAuthMode('login');
});

function setupAuthListeners() {
    const loginToggle = document.getElementById('toggle-login');
    const signupToggle = document.getElementById('toggle-signup');
    const forgotPasswordAction = document.getElementById('forgot-password-action');
    const requestOtpBtn = document.getElementById('request-otp-btn');
    const authForm = document.getElementById('auth-form');

    loginToggle?.addEventListener('click', () => setAuthMode('login'));
    signupToggle?.addEventListener('click', () => setAuthMode('signup'));
    forgotPasswordAction?.addEventListener('click', () => setAuthMode('reset'));
    requestOtpBtn?.addEventListener('click', handleRequestOtp);
    authForm?.addEventListener('submit', handleAuthSubmit);
}

function setAuthMode(mode) {
    authMode = mode;

    const loginToggle = document.getElementById('toggle-login');
    const signupToggle = document.getElementById('toggle-signup');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('main-btn');
    const errorMsg = document.getElementById('error-msg');
    const nameField = document.getElementById('name-field');
    const confirmPasswordField = document.getElementById('confirm-password-field');
    const otpField = document.getElementById('otp-field');
    const passwordLabel = document.querySelector('#password-field span');
    const requestOtpBtn = document.getElementById('request-otp-btn');
    const forgotPasswordAction = document.getElementById('forgot-password-action');
    const otpStatus = document.getElementById('otp-status');

    if (errorMsg) {
        errorMsg.textContent = '';
    }

    if (otpStatus) {
        otpStatus.textContent = '';
        otpStatus.classList.add('auth-field-hidden');
    }

    clearOtpTimer();

    nameField?.classList.add('auth-field-hidden');
    confirmPasswordField?.classList.add('auth-field-hidden');
    otpField?.classList.add('auth-field-hidden');
    requestOtpBtn?.classList.add('auth-field-hidden');
    requestOtpBtn?.removeAttribute('disabled');
    if (requestOtpBtn) requestOtpBtn.textContent = 'Send OTP';

    if (mode === 'login') {
        loginToggle?.classList.add('active');
        signupToggle?.classList.remove('active');
        loginToggle?.setAttribute('aria-selected', 'true');
        signupToggle?.setAttribute('aria-selected', 'false');

        if (authTitle) authTitle.textContent = 'Login';
        if (authSubtitle) authSubtitle.textContent = 'Enter your details to access your account.';
        if (mainBtn) mainBtn.textContent = 'Login';
        forgotPasswordAction?.classList.remove('auth-field-hidden');
        if (passwordLabel) passwordLabel.textContent = 'Password';
    } else if (mode === 'signup') {
        loginToggle?.classList.remove('active');
        signupToggle?.classList.add('active');
        loginToggle?.setAttribute('aria-selected', 'false');
        signupToggle?.setAttribute('aria-selected', 'true');

        nameField?.classList.remove('auth-field-hidden');
        confirmPasswordField?.classList.remove('auth-field-hidden');
        forgotPasswordAction?.classList.add('auth-field-hidden');

        if (authTitle) authTitle.textContent = 'Sign Up';
        if (authSubtitle) authSubtitle.textContent = 'Create a new account to get started.';
        if (mainBtn) mainBtn.textContent = 'Sign Up';
        if (passwordLabel) passwordLabel.textContent = 'Password';
    } else {
        loginToggle?.classList.remove('active');
        signupToggle?.classList.remove('active');
        loginToggle?.setAttribute('aria-selected', 'false');
        signupToggle?.setAttribute('aria-selected', 'false');

        otpField?.classList.remove('auth-field-hidden');
        confirmPasswordField?.classList.remove('auth-field-hidden');
        requestOtpBtn?.classList.remove('auth-field-hidden');
        forgotPasswordAction?.classList.add('auth-field-hidden');

        if (authTitle) authTitle.textContent = 'Reset Password';
        if (authSubtitle) authSubtitle.textContent = 'Enter your email and OTP to reset your password.';
        if (mainBtn) mainBtn.textContent = 'Reset Password';
        if (passwordLabel) passwordLabel.textContent = 'New Password';
    }
}

async function handleRequestOtp() {
    const email = document.getElementById('email').value.trim();
    const errorMsg = document.getElementById('error-msg');

    if (errorMsg) {
        errorMsg.textContent = '';
    }

    if (!email) {
        if (errorMsg) errorMsg.textContent = 'Enter your email to receive OTP';
        return;
    }

    if (!isValidEmail(email)) {
        if (errorMsg) errorMsg.textContent = 'Please enter a valid email address';
        return;
    }

    const result = await HabitAPI.requestPasswordReset(email);

    if (!result.success) {
        if (errorMsg) errorMsg.textContent = result.message || 'Unable to send OTP';
        return;
    }

    const otpStatus = document.getElementById('otp-status');
    if (otpStatus) {
        otpStatus.classList.remove('auth-field-hidden');
        otpStatus.textContent = `OTP has been sent. Resend attempts ${result.resend_count || 1}/${RESEND_LIMIT}`;
    }

    showToast(result.message || 'OTP sent to your email.', 'success');
    if (result.otp) {
        console.log('Password reset OTP:', result.otp);
    }

    currentResendCount = Number(result.resend_count || 1);
    startOtpTimer(Number(result.wait || RESEND_WAIT_SECONDS));
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    const mainBtn = document.getElementById('main-btn');

    if (errorMsg) {
        errorMsg.textContent = '';
    }

    if (!email || !password) {
        if (errorMsg) errorMsg.textContent = 'Please fill in all fields';
        return;
    }

    if (!isValidEmail(email)) {
        if (errorMsg) errorMsg.textContent = 'Please enter a valid email address';
        return;
    }

    if (password.length < 6) {
        if (errorMsg) errorMsg.textContent = 'Password must be at least 6 characters';
        return;
    }

    let name = '';
    let confirmPassword = '';
    let otp = '';

    if (authMode === 'signup') {
        name = document.getElementById('full-name').value.trim();
        confirmPassword = document.getElementById('confirm-password').value;

        if (!name) {
            if (errorMsg) errorMsg.textContent = 'Full name is required';
            return;
        }

        if (!confirmPassword) {
            if (errorMsg) errorMsg.textContent = 'Please confirm your password';
            return;
        }

        if (password !== confirmPassword) {
            if (errorMsg) errorMsg.textContent = 'Passwords do not match';
            return;
        }
    }

    if (authMode === 'reset') {
        otp = document.getElementById('otp').value.trim();
        confirmPassword = document.getElementById('confirm-password').value;

        if (!otp) {
            if (errorMsg) errorMsg.textContent = 'Please enter the OTP code';
            return;
        }

        if (!confirmPassword) {
            if (errorMsg) errorMsg.textContent = 'Please confirm your new password';
            return;
        }

        if (password !== confirmPassword) {
            if (errorMsg) errorMsg.textContent = 'Passwords do not match';
            return;
        }
    }

    if (mainBtn) {
        mainBtn.disabled = true;
        mainBtn.textContent = 'Please wait...';
    }

    try {
        let result;

        if (authMode === 'login') {
            result = await HabitAPI.login(email, password);
        } else if (authMode === 'signup') {
            result = await HabitAPI.signup(email, password, name);
        } else {
            result = await HabitAPI.resetPassword(email, otp, password);
        }

        if (result.success) {
            if (authMode === 'reset') {
                showToast('Password reset successful. Please login.', 'success');
                setAuthMode('login');
            } else if (authMode === 'signup') {
                showToast('Signed up successfully. Please verify your email before login.', 'success');
                setAuthMode('login');
            } else {
                showToast('Login successful. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            }
        } else {
            if (errorMsg) {
                errorMsg.textContent = result.message || 'Authentication failed';
            }
            if (mainBtn) {
                mainBtn.disabled = false;
                mainBtn.textContent = authMode === 'login' ? 'Login' : authMode === 'signup' ? 'Sign Up' : 'Reset Password';
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        if (errorMsg) {
            errorMsg.textContent = 'An error occurred. Please try again.';
        }
        if (mainBtn) {
            mainBtn.disabled = false;
            mainBtn.textContent = authMode === 'login' ? 'Login' : authMode === 'signup' ? 'Sign Up' : 'Reset Password';
        }
    }
}

function startOtpTimer(seconds) {
    const requestOtpBtn = document.getElementById('request-otp-btn');
    const otpStatus = document.getElementById('otp-status');
    let remaining = Number(seconds) || RESEND_WAIT_SECONDS;

    if (requestOtpBtn) {
        requestOtpBtn.disabled = true;
        requestOtpBtn.textContent = `Resend OTP in ${remaining}s`;
    }

    if (otpStatus) {
        otpStatus.classList.remove('auth-field-hidden');
        otpStatus.textContent = `OTP sent. Resend attempts ${currentResendCount}/${RESEND_LIMIT}`;
    }

    clearOtpTimer();
    otpTimer = setInterval(() => {
        remaining -= 1;

        if (!requestOtpBtn) {
            clearOtpTimer();
            return;
        }

        if (remaining <= 0) {
            clearOtpTimer();
            if (currentResendCount >= RESEND_LIMIT) {
                requestOtpBtn.disabled = true;
                requestOtpBtn.textContent = 'Resend limit reached';
            } else {
                requestOtpBtn.disabled = false;
                requestOtpBtn.textContent = 'Resend OTP';
            }
        } else {
            requestOtpBtn.textContent = `Resend OTP in ${remaining}s`;
        }
    }, 1000);
}

function clearOtpTimer() {
    if (otpTimer) {
        clearInterval(otpTimer);
        otpTimer = null;
    }
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

const savedTheme = localStorage.getItem('habit-tracker-theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}
