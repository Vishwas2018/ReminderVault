// ===== MODERN AUTHENTICATION SERVICE =====

import { Storage, UI, generateUUID } from '../utils.js';

/**
 * Configuration constants for authentication
 */
const AUTH_CONFIG = {
    session: {
        timeout: 30 * 60 * 1000, // 30 minutes
        rememberMeDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
        checkInterval: 60 * 1000, // 1 minute
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutes
    },
    storage: {
        keys: {
            USER_SESSION: 'user_session',
            LAST_LOGIN: 'last_login',
            USER_PREFERENCES: 'user_preferences',
            REMINDERS_DATA: 'reminders_data'
        }
    }
};

/**
 * Demo users for authentication
 */
const DEMO_USERS = {
    admin: {
        id: 'admin',
        username: 'admin',
        password: 'password123',
        role: 'administrator',
        permissions: ['read', 'write', 'delete', 'admin'],
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            avatar: '👑'
        },
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: null
    },
    user: {
        id: 'user',
        username: 'user',
        password: 'userpass123',
        role: 'user',
        permissions: ['read', 'write'],
        profile: {
            firstName: 'Standard',
            lastName: 'User',
            email: 'user@example.com',
            avatar: '👤'
        },
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: null
    },
    manager: {
        id: 'manager',
        username: 'manager',
        password: 'manager456',
        role: 'manager',
        permissions: ['read', 'write', 'manage'],
        profile: {
            firstName: 'Team',
            lastName: 'Manager',
            email: 'manager@example.com',
            avatar: '👥'
        },
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: null
    }
};

/**
 * Validation rules for authentication
 */
const VALIDATION_RULES = {
    username: {
        pattern: /^[a-zA-Z0-9_-]{3,20}$/,
        message: 'Username must be 3-20 characters, letters, numbers, underscore, or dash only'
    },
    password: {
        minLength: 6,
        pattern: /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/,
        message: 'Password must be at least 6 characters with letters and numbers'
    }
};

/**
 * Message constants
 */
const MESSAGES = {
    success: {
        loginSuccess: 'Login successful! Welcome back.',
        logoutSuccess: 'You have been logged out successfully.'
    },
    errors: {
        invalidCredentials: 'Invalid username or password. Please try again.',
        accountLocked: 'Account temporarily locked due to too many failed attempts.',
        sessionExpired: 'Your session has expired. Please login again.',
        networkError: 'Network error. Please check your connection and try again.',
        unknownError: 'An unexpected error occurred. Please try again.'
    }
};

/**
 * Modern Authentication Service with enhanced security
 */
export class AuthService {
    #currentUser = null;
    #sessionTimer = null;
    #eventListeners = new Map();
    #storage = Storage;
    #ui = UI;

    /**
     * Initialize authentication service
     */
    async init() {
        console.log('🔐 Initializing AuthService...');

        try {
            await this.#checkExistingSession();
            this.#startSessionMonitoring();
            this.#setupVisibilityHandler();

            console.log('✅ AuthService initialized successfully');
        } catch (error) {
            console.error('❌ AuthService initialization failed:', error);
            throw new Error('Authentication system initialization failed');
        }
    }

    /**
     * Authenticate user with enhanced validation
     */
    async login(username, password, rememberMe = false) {
        const startTime = performance.now();

        try {
            // Input validation
            this.#validateLoginInputs(username, password);

            // Check account lockout
            await this.#checkAccountLockout(username);

            // Authenticate user
            const user = await this.#authenticateUser(username, password);

            // Create session
            const sessionData = await this.#createSession(user, rememberMe);
            this.#currentUser = sessionData;

            // Track successful login
            await this.#trackLoginAttempt(username, true);

            // Emit success event
            this.#emit('auth:login:success', {
                user: this.#sanitizeUser(sessionData)
            });

            const duration = performance.now() - startTime;
            console.log(`✅ Login successful for "${username}" (${duration.toFixed(2)}ms)`);

            return this.#sanitizeUser(sessionData);

        } catch (error) {
            // Track failed attempt
            await this.#trackLoginAttempt(username, false);

            // Emit error event
            this.#emit('auth:login:error', {
                username,
                error: error.message
            });

            console.error(`❌ Login failed for "${username}":`, error.message);
            throw error;
        }
    }

    /**
     * Logout current user with cleanup
     */
    async logout() {
        const username = this.#currentUser?.username || 'Unknown';
        console.log(`🚪 Logging out user: ${username}`);

        try {
            this.#emit('auth:logout:start', { username });

            // Clear session and cleanup
            await this.#clearSession();
            this.#stopSessionMonitoring();
            this.#currentUser = null;
            await this.#clearSensitiveData();

            this.#emit('auth:logout:success', { username });
            console.log(`✅ Logout successful for "${username}"`);

        } catch (error) {
            console.error('❌ Logout error:', error);

            // Force cleanup even on error
            this.#currentUser = null;
            this.#stopSessionMonitoring();

            this.#emit('auth:logout:error', {
                username,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Check authentication status
     */
    isAuthenticated() {
        return this.#currentUser !== null && this.#isSessionValid();
    }

    /**
     * Get sanitized current user data
     */
    getCurrentUser() {
        return this.#currentUser ? this.#sanitizeUser(this.#currentUser) : null;
    }

    /**
     * Check user permissions
     */
    hasPermission(permission) {
        if (!this.#currentUser) return false;
        return this.#currentUser.permissions?.includes(permission) ?? false;
    }

    /**
     * Check user role
     */
    hasRole(role) {
        return this.#currentUser?.role === role;
    }

    /**
     * Refresh session with extended timeout
     */
    async refreshSession() {
        if (!this.#currentUser) return false;

        try {
            const sessionData = {
                ...this.#currentUser,
                lastActivity: new Date().toISOString(),
                refreshedAt: new Date().toISOString()
            };

            await this.#setSession(sessionData);
            this.#currentUser = sessionData;

            this.#emit('auth:session:refreshed', {
                user: this.#sanitizeUser(sessionData)
            });

            return true;
        } catch (error) {
            console.error('❌ Session refresh failed:', error);
            return false;
        }
    }

    /**
     * Update user profile information
     */
    async updateProfile(profileData) {
        if (!this.#currentUser) {
            throw new Error('No authenticated user');
        }

        try {
            const updatedUser = {
                ...this.#currentUser,
                profile: {
                    ...this.#currentUser.profile,
                    ...profileData
                },
                updatedAt: new Date().toISOString()
            };

            await this.#setSession(updatedUser);
            this.#currentUser = updatedUser;

            this.#emit('auth:profile:updated', {
                user: this.#sanitizeUser(updatedUser)
            });

            return this.#sanitizeUser(updatedUser);
        } catch (error) {
            console.error('❌ Profile update failed:', error);
            throw error;
        }
    }

    /**
     * Event subscription
     */
    on(event, callback) {
        if (!this.#eventListeners.has(event)) {
            this.#eventListeners.set(event, new Set());
        }
        this.#eventListeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        this.#eventListeners.get(event)?.delete(callback);
    }

    /**
     * Initialize login page (legacy compatibility)
     */
    async initLoginPage() {
        console.log('🏠 Initializing login page...');

        try {
            if (this.isAuthenticated()) {
                console.log('✅ User already authenticated, redirecting...');
                this.#redirect('/pages/dashboard.html');
                return;
            }

            await this.#setupLoginForm();
            await this.#setupDemoCredentials();

            console.log('✅ Login page initialized');
        } catch (error) {
            console.error('❌ Login page initialization failed:', error);
            this.#ui.showNotification('Failed to initialize login page', 'error');
        }
    }

    // ===== PRIVATE METHODS =====

    /**
     * Validate login input parameters
     */
    #validateLoginInputs(username, password) {
        if (!username?.trim()) {
            throw new Error('Username is required');
        }

        if (!password) {
            throw new Error('Password is required');
        }

        if (!this.#isValidUsername(username)) {
            throw new Error(VALIDATION_RULES.username.message);
        }
    }

    /**
     * Check for account lockout status
     */
    async #checkAccountLockout(username) {
        const user = DEMO_USERS[username];
        if (!user) return;

        const now = Date.now();
        if (user.lockedUntil && now < user.lockedUntil) {
            const remainingTime = Math.ceil((user.lockedUntil - now) / 60000);
            throw new Error(`Account locked. Try again in ${remainingTime} minute(s).`);
        }
    }

    /**
     * Authenticate against demo user database
     */
    async #authenticateUser(username, password) {
        const user = DEMO_USERS[username];

        if (!user || user.password !== password) {
            throw new Error(MESSAGES.errors.invalidCredentials);
        }

        return user;
    }

    /**
     * Create secure session data
     */
    async #createSession(user, rememberMe) {
        const now = new Date();
        const sessionDuration = rememberMe
            ? AUTH_CONFIG.session.rememberMeDuration
            : AUTH_CONFIG.session.timeout;

        const sessionData = {
            id: generateUUID(),
            username: user.id,
            role: user.role,
            profile: { ...user.profile },
            permissions: [...user.permissions],
            loginTime: now.toISOString(),
            lastActivity: now.toISOString(),
            expiresAt: now.getTime() + sessionDuration,
            rememberMe,
            userAgent: navigator.userAgent,
            ipAddress: await this.#getUserIP()
        };

        await this.#setSession(sessionData);
        return sessionData;
    }

    /**
     * Track login attempts for security
     */
    async #trackLoginAttempt(username, success) {
        const user = DEMO_USERS[username];
        if (!user) return;

        if (success) {
            user.loginAttempts = 0;
            user.lockedUntil = null;
            user.lastLogin = new Date().toISOString();
        } else {
            user.loginAttempts = (user.loginAttempts || 0) + 1;

            if (user.loginAttempts >= AUTH_CONFIG.session.maxLoginAttempts) {
                user.lockedUntil = Date.now() + AUTH_CONFIG.session.lockoutDuration;
            }
        }
    }

    /**
     * Check existing session on startup
     */
    async #checkExistingSession() {
        const session = await this.#getSession();

        if (session && this.#isSessionValid(session)) {
            this.#currentUser = session;
            console.log(`🔄 Session restored for user: ${session.username}`);

            this.#emit('auth:session:restored', {
                user: this.#sanitizeUser(session)
            });

            return true;
        }

        if (session) {
            await this.#clearSession();
            console.log('🧹 Expired session cleared');
        }

        return false;
    }

    /**
     * Validate session timing
     */
    #isSessionValid(session = this.#currentUser) {
        if (!session) return false;

        const now = Date.now();
        const expiresAt = session.expiresAt || 0;

        return now < expiresAt;
    }

    /**
     * Start periodic session monitoring
     */
    #startSessionMonitoring() {
        this.#stopSessionMonitoring();

        this.#sessionTimer = setInterval(() => {
            if (this.#currentUser && !this.#isSessionValid()) {
                console.log('⏰ Session expired during monitoring');
                this.#handleSessionExpiry();
            }
        }, AUTH_CONFIG.session.checkInterval);
    }

    /**
     * Stop session monitoring
     */
    #stopSessionMonitoring() {
        if (this.#sessionTimer) {
            clearInterval(this.#sessionTimer);
            this.#sessionTimer = null;
        }
    }

    /**
     * Handle session expiry
     */
    async #handleSessionExpiry() {
        this.#ui.showNotification(MESSAGES.errors.sessionExpired, 'error');

        this.#emit('auth:session:expired', {
            user: this.#sanitizeUser(this.#currentUser)
        });

        try {
            await this.logout();
        } catch (error) {
            console.error('❌ Error during session expiry logout:', error);
        }

        if (!window.location.pathname.includes('login.html')) {
            setTimeout(() => this.#redirect('/pages/login.html'), 1000);
        }
    }

    /**
     * Handle browser visibility changes
     */
    #setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.#currentUser) {
                this.refreshSession();
            }
        });
    }

    /**
     * Session storage operations
     */
    async #setSession(sessionData) {
        const result = this.#storage.set(AUTH_CONFIG.storage.keys.USER_SESSION, sessionData);

        if (!result.success) {
            throw new Error('Failed to save session');
        }

        this.#storage.set(AUTH_CONFIG.storage.keys.LAST_LOGIN, new Date().toISOString());
    }

    async #getSession() {
        return this.#storage.get(AUTH_CONFIG.storage.keys.USER_SESSION);
    }

    async #clearSession() {
        const result = this.#storage.remove(AUTH_CONFIG.storage.keys.USER_SESSION);
        if (!result.success) {
            console.warn('⚠️ Failed to clear session from storage');
        }
    }

    /**
     * Clear sensitive data from storage
     */
    async #clearSensitiveData() {
        const sensitiveKeys = [AUTH_CONFIG.storage.keys.REMINDERS_DATA];
        sensitiveKeys.forEach(key => this.#storage.remove(key));
    }

    /**
     * Setup login form handlers
     */
    async #setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (!loginForm) {
            throw new Error('Login form not found');
        }

        // Form submission
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.#handleLoginSubmit();
        });

        // Enter key handling
        passwordInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.#handleLoginSubmit();
            }
        });

        // Real-time validation
        [usernameInput, passwordInput].forEach(input => {
            input?.addEventListener('input', () => this.#clearFieldError(input));
        });
    }

    /**
     * Handle login form submission
     */
    async #handleLoginSubmit() {
        const formData = new FormData(document.getElementById('loginForm'));
        const credentials = {
            username: formData.get('username')?.trim(),
            password: formData.get('password'),
            rememberMe: formData.get('rememberMe') === 'on'
        };

        this.#clearMessages();

        if (!this.#validateLoginForm(credentials)) {
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        this.#setButtonLoading(loginBtn, true);

        try {
            await this.login(credentials.username, credentials.password, credentials.rememberMe);

            this.#showMessage(MESSAGES.success.loginSuccess, 'success');

            setTimeout(() => {
                this.#redirect('/pages/dashboard.html');
            }, 1000);

        } catch (error) {
            this.#showMessage(error.message, 'error');

            const passwordInput = document.getElementById('password');
            if (passwordInput) passwordInput.value = '';

            document.getElementById('username')?.focus();

        } finally {
            this.#setButtonLoading(loginBtn, false);
        }
    }

    /**
     * Setup demo credential handlers
     */
    async #setupDemoCredentials() {
        const credentialItems = document.querySelectorAll('.credential-item');

        credentialItems.forEach(item => {
            item.addEventListener('click', () => {
                const username = item.getAttribute('data-username');
                const password = item.getAttribute('data-password');

                const usernameInput = document.getElementById('username');
                const passwordInput = document.getElementById('password');

                if (usernameInput && passwordInput) {
                    usernameInput.value = username;
                    passwordInput.value = password;

                    this.#clearFieldError(usernameInput);
                    this.#clearFieldError(passwordInput);

                    document.getElementById('loginBtn')?.focus();
                }
            });
        });
    }

    /**
     * Form validation helpers
     */
    #validateLoginForm({ username, password }) {
        let isValid = true;

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (!username) {
            this.#showFieldError(usernameInput, 'Username is required');
            isValid = false;
        } else if (!this.#isValidUsername(username)) {
            this.#showFieldError(usernameInput, VALIDATION_RULES.username.message);
            isValid = false;
        }

        if (!password) {
            this.#showFieldError(passwordInput, 'Password is required');
            isValid = false;
        }

        return isValid;
    }

    #isValidUsername(username) {
        return VALIDATION_RULES.username.pattern.test(username?.trim() || '');
    }

    /**
     * UI helper methods
     */
    #showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) return;

        messageContainer.innerHTML = `
      <div class="message ${type}">${this.#escapeHtml(message)}</div>
    `;
        messageContainer.style.display = 'block';
    }

    #clearMessages() {
        const messageContainer = document.getElementById('messageContainer');
        if (messageContainer) {
            messageContainer.innerHTML = '';
            messageContainer.style.display = 'none';
        }
    }

    #showFieldError(field, message) {
        if (!field) return;

        this.#clearFieldError(field);
        field.classList.add('error');

        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
      color: #EF4444;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    `;

        field.parentNode.insertBefore(errorElement, field.nextSibling);
    }

    #clearFieldError(field) {
        if (!field) return;

        field.classList.remove('error');
        const errorElement = field.parentNode.querySelector('.field-error');
        errorElement?.remove();
    }

    #setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner"></span> Signing in...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Sign In';
        }
    }

    /**
     * Utility methods
     */
    #sanitizeUser(userData) {
        if (!userData) return null;

        const { password, ipAddress, userAgent, ...sanitized } = userData;
        return sanitized;
    }

    async #getUserIP() {
        return 'demo-ip'; // Simplified for demo
    }

    #escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    #redirect(url) {
        window.location.href = url;
    }

    /**
     * Event emission
     */
    #emit(eventName, data) {
        const listeners = this.#eventListeners.get(eventName);
        listeners?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${eventName}":`, error);
            }
        });

        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

// Create singleton instance
export const authService = new AuthService();

// Legacy compatibility - expose as global
if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
    window.authService = authService;
}

export default authService;