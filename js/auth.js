// ===== AUTHENTICATION MODULE =====

/**
 * Authentication and session management
 */
const Auth = {

    // Current user session
    currentUser: null,
    sessionTimer: null,

    /**
     * Initialize authentication system
     */
    init: function() {
        console.log('Initializing Auth module...');

        // Check for existing session on app start
        this.checkExistingSession();

        // Set up session monitoring
        this.startSessionMonitoring();

        // Handle browser tab visibility change
        this.handleVisibilityChange();
    },

    /**
     * Login user with credentials
     */
    login: function(username, password, rememberMe = false) {
        return new Promise((resolve, reject) => {
            try {
                // Validate input
                if (!username || !password) {
                    reject(new Error('Username and password are required'));
                    return;
                }

                // Check credentials against demo users
                const user = DEMO_USERS[username];
                if (!user || user.password !== password) {
                    reject(new Error(ERROR_MESSAGES.INVALID_CREDENTIALS));
                    return;
                }

                // Create session
                const sessionData = {
                    username: username,
                    role: user.role,
                    profile: user.profile,
                    loginTime: new Date().toISOString(),
                    rememberMe: rememberMe,
                    sessionId: Utils.generateUUID()
                };

                // Store session
                this.setSession(sessionData);

                // Set current user
                this.currentUser = sessionData;

                console.log(`User ${username} logged in successfully`);
                resolve(sessionData);

            } catch (error) {
                console.error('Login error:', error);
                reject(new Error(ERROR_MESSAGES.UNKNOWN_ERROR));
            }
        });
    },

    /**
     * Logout current user
     */
    logout: function() {
        console.log('Starting logout process...');

        return new Promise((resolve) => {
            try {
                const username = this.currentUser?.username || 'Unknown';
                console.log(`Logging out user: ${username}`);

                // Clear session data
                this.clearSession();
                console.log('Session data cleared');

                // Reset current user
                this.currentUser = null;
                console.log('Current user reset');

                // Stop session monitoring
                this.stopSessionMonitoring();
                console.log('Session monitoring stopped');

                // Clear any cached data (optional)
                if (typeof Utils !== 'undefined' && Utils.Storage) {
                    // Clear app-specific data but keep some user preferences
                    const keysToRemove = [
                        APP_CONFIG.STORAGE_KEYS.USER_SESSION,
                        APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA
                    ];

                    keysToRemove.forEach(key => {
                        Utils.Storage.remove(key);
                    });
                    console.log('App data cleared');
                }

                console.log(`User ${username} logged out successfully`);
                resolve();

            } catch (error) {
                console.error('Logout error:', error);
                // Always resolve logout to ensure UI can proceed
                resolve();
            }
        });
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: function() {
        return this.currentUser !== null && this.isSessionValid();
    },

    /**
     * Get current user data
     */
    getCurrentUser: function() {
        return this.currentUser;
    },

    /**
     * Check user permission
     */
    hasPermission: function(permission) {
        if (!this.currentUser) return false;

        const userRole = this.currentUser.role;
        const permissions = PERMISSIONS[userRole] || [];

        return permissions.includes(permission);
    },

    /**
     * Refresh session (extend expiry)
     */
    refreshSession: function() {
        if (!this.currentUser) return false;

        try {
            const sessionData = {
                ...this.currentUser,
                lastActivity: new Date().toISOString()
            };

            this.setSession(sessionData);
            this.currentUser = sessionData;

            return true;
        } catch (error) {
            console.error('Session refresh error:', error);
            return false;
        }
    },

    /**
     * Set session data in storage
     */
    setSession: function(sessionData) {
        const storageKey = APP_CONFIG.STORAGE_KEYS.USER_SESSION;
        const expiryTime = sessionData.rememberMe
            ? Date.now() + APP_CONFIG.SESSION.REMEMBER_ME_DURATION
            : Date.now() + APP_CONFIG.SESSION.TIMEOUT;

        const sessionWithExpiry = {
            ...sessionData,
            expiresAt: expiryTime,
            lastActivity: new Date().toISOString()
        };

        Utils.Storage.set(storageKey, sessionWithExpiry);
        Utils.Storage.set(APP_CONFIG.STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
    },

    /**
     * Get session data from storage
     */
    getSession: function() {
        const storageKey = APP_CONFIG.STORAGE_KEYS.USER_SESSION;
        return Utils.Storage.get(storageKey);
    },

    /**
     * Clear session data
     */
    clearSession: function() {
        Utils.Storage.remove(APP_CONFIG.STORAGE_KEYS.USER_SESSION);
    },

    /**
     * Check if session is valid
     */
    isSessionValid: function() {
        const session = this.getSession();
        if (!session) return false;

        const now = Date.now();
        const expiresAt = session.expiresAt || 0;

        return now < expiresAt;
    },

    /**
     * Check for existing session on app start
     */
    checkExistingSession: function() {
        const session = this.getSession();

        if (session && this.isSessionValid()) {
            this.currentUser = session;
            console.log('Existing session found for user:', session.username);
            return true;
        } else if (session) {
            // Session expired
            this.clearSession();
            console.log('Session expired, cleared storage');
        }

        return false;
    },

    /**
     * Start session monitoring
     */
    startSessionMonitoring: function() {
        this.stopSessionMonitoring(); // Clear any existing timer

        this.sessionTimer = setInterval(() => {
            if (this.currentUser && !this.isSessionValid()) {
                console.log('Session expired during monitoring');
                this.handleSessionExpiry();
            }
        }, APP_CONFIG.SESSION.CHECK_INTERVAL);
    },

    /**
     * Stop session monitoring
     */
    stopSessionMonitoring: function() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
    },

    /**
     * Handle session expiry
     */
    handleSessionExpiry: function() {
        Utils.UI.showNotification(ERROR_MESSAGES.SESSION_EXPIRED, 'error');

        this.logout().then(() => {
            // Redirect to login if not already there
            const currentPath = window.location.pathname;
            if (!currentPath.includes('login.html')) {
                setTimeout(() => {
                    Utils.Navigation.navigateTo('pages/login.html');
                }, 1000);
            }
        });
    },

    /**
     * Handle browser tab visibility change
     */
    handleVisibilityChange: function() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser) {
                // Tab became visible, refresh session
                this.refreshSession();
            }
        });
    },

    /**
     * Initialize login page
     */
    initLoginPage: function() {
        console.log('Initializing login page...');

        // Check if already logged in
        if (this.isAuthenticated()) {
            console.log('User already authenticated, redirecting to dashboard...');
            Utils.Navigation.navigateTo('dashboard.html');
            return;
        }

        // Set up login form
        this.setupLoginForm();

        // Set up demo credential clicks
        this.setupDemoCredentials();
    },

    /**
     * Set up login form event handlers
     */
    setupLoginForm: function() {
        const loginForm = Utils.DOM.getElementById('loginForm');
        const usernameInput = Utils.DOM.getElementById('username');
        const passwordInput = Utils.DOM.getElementById('password');
        const rememberMeCheckbox = Utils.DOM.getElementById('rememberMe');
        const loginBtn = Utils.DOM.getElementById('loginBtn');

        if (!loginForm) {
            console.error('Login form not found');
            return;
        }

        // Handle form submission
        Utils.DOM.on(loginForm, 'submit', (e) => {
            e.preventDefault();
            this.handleLoginSubmit();
        });

        // Handle Enter key in password field
        Utils.DOM.on(passwordInput, 'keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleLoginSubmit();
            }
        });

        // Real-time validation
        Utils.DOM.on(usernameInput, 'input', () => {
            this.clearFieldError(usernameInput);
        });

        Utils.DOM.on(passwordInput, 'input', () => {
            this.clearFieldError(passwordInput);
        });
    },

    /**
     * Handle login form submission
     */
    handleLoginSubmit: function() {
        const usernameInput = Utils.DOM.getElementById('username');
        const passwordInput = Utils.DOM.getElementById('password');
        const rememberMeCheckbox = Utils.DOM.getElementById('rememberMe');
        const loginBtn = Utils.DOM.getElementById('loginBtn');

        // Get form values
        const username = usernameInput?.value?.trim();
        const password = passwordInput?.value;
        const rememberMe = rememberMeCheckbox?.checked || false;

        // Clear previous messages
        this.clearMessages();

        // Validate inputs
        if (!this.validateLoginInputs(username, password)) {
            return;
        }

        // Show loading state
        Utils.UI.showLoading(loginBtn, 'Signing in...');

        // Attempt login
        this.login(username, password, rememberMe)
            .then((user) => {
                // Success
                this.showMessage(SUCCESS_MESSAGES.LOGIN_SUCCESS, 'success');

                // Redirect after short delay
                setTimeout(() => {
                    Utils.Navigation.navigateTo('dashboard.html');
                }, 1000);
            })
            .catch((error) => {
                // Error
                this.showMessage(error.message, 'error');

                // Clear password field
                if (passwordInput) passwordInput.value = '';

                // Focus username field
                if (usernameInput) usernameInput.focus();
            })
            .finally(() => {
                // Hide loading state
                Utils.UI.hideLoading(loginBtn);
            });
    },

    /**
     * Validate login inputs
     */
    validateLoginInputs: function(username, password) {
        let isValid = true;

        const usernameInput = Utils.DOM.getElementById('username');
        const passwordInput = Utils.DOM.getElementById('password');

        // Validate username
        if (!username) {
            this.showFieldError(usernameInput, 'Username is required');
            isValid = false;
        } else if (!Utils.Validation.isValidUsername(username)) {
            this.showFieldError(usernameInput, VALIDATION_RULES.USERNAME.MESSAGE);
            isValid = false;
        }

        // Validate password
        if (!password) {
            this.showFieldError(passwordInput, 'Password is required');
            isValid = false;
        }

        return isValid;
    },

    /**
     * Set up demo credential click handlers
     */
    setupDemoCredentials: function() {
        const credentialItems = Utils.DOM.qsa('.credential-item');

        credentialItems.forEach(item => {
            Utils.DOM.on(item, 'click', () => {
                const username = item.getAttribute('data-username');
                const password = item.getAttribute('data-password');

                const usernameInput = Utils.DOM.getElementById('username');
                const passwordInput = Utils.DOM.getElementById('password');

                if (usernameInput && passwordInput) {
                    usernameInput.value = username;
                    passwordInput.value = password;

                    // Clear any existing errors
                    this.clearFieldError(usernameInput);
                    this.clearFieldError(passwordInput);

                    // Focus the login button
                    const loginBtn = Utils.DOM.getElementById('loginBtn');
                    if (loginBtn) loginBtn.focus();
                }
            });
        });
    },

    /**
     * Show message in message container
     */
    showMessage: function(message, type = 'info') {
        const messageContainer = Utils.DOM.getElementById('messageContainer');
        if (!messageContainer) return;

        messageContainer.innerHTML = `<div class="message ${type}">${Utils.String.escapeHtml(message)}</div>`;
        messageContainer.style.display = 'block';
    },

    /**
     * Clear all messages
     */
    clearMessages: function() {
        const messageContainer = Utils.DOM.getElementById('messageContainer');
        if (messageContainer) {
            messageContainer.innerHTML = '';
            messageContainer.style.display = 'none';
        }
    },

    /**
     * Show field error
     */
    showFieldError: function(field, message) {
        if (!field) return;

        // Remove existing error
        this.clearFieldError(field);

        // Add error class
        Utils.DOM.addClass(field, 'error');

        // Create error message element
        const errorElement = Utils.DOM.createElement('div', {
            class: 'field-error',
            style: 'color: #c62828; font-size: 0.875rem; margin-top: 0.25rem;'
        }, message);

        // Insert after field
        field.parentNode.insertBefore(errorElement, field.nextSibling);
    },

    /**
     * Clear field error
     */
    clearFieldError: function(field) {
        if (!field) return;

        // Remove error class
        Utils.DOM.removeClass(field, 'error');

        // Remove error message
        const errorElement = field.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }
};

// Initialize Auth module when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    Auth.init();
});

// Make Auth available globally
if (typeof window !== 'undefined') {
    window.Auth = Auth;
}

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
}