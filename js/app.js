// ===== MAIN APPLICATION CONTROLLER =====

/**
 * Main application entry point and router
 */
const App = {

    // Application state
    state: {
        initialized: false,
        currentPage: null,
        isLoading: false
    },

    // Configuration
    config: {
        enableDebug: true,
        enableServiceWorker: false,
        enableNotifications: true
    },

    /**
     * Initialize the application
     */
    init: function() {
        console.log('Initializing Reminders Vault App...');

        // Check browser compatibility
        if (!this.checkBrowserCompatibility()) {
            this.showBrowserWarning();
            return;
        }

        // Initialize core modules
        this.initializeModules();

        // Set up global error handling
        this.setupErrorHandling();

        // Set up page routing
        this.setupRouting();

        // Set up notifications
        if (this.config.enableNotifications) {
            this.setupNotifications();
        }

        // Set up service worker (if enabled)
        if (this.config.enableServiceWorker) {
            this.setupServiceWorker();
        }

        // Mark as initialized
        this.state.initialized = true;

        console.log('App initialized successfully');

        // Trigger app ready event
        this.triggerEvent('app:ready');
    },

    /**
     * Check browser compatibility
     */
    checkBrowserCompatibility: function() {
        const features = {
            localStorage: typeof(Storage) !== 'undefined',
            JSON: typeof JSON !== 'undefined',
            addEventListener: typeof document.addEventListener !== 'undefined',
            querySelector: typeof document.querySelector !== 'undefined',
            Promise: typeof Promise !== 'undefined'
        };

        const unsupported = Object.keys(features).filter(feature => !features[feature]);

        if (unsupported.length > 0) {
            console.error('Unsupported browser features:', unsupported);
            return false;
        }

        return true;
    },

    /**
     * Show browser compatibility warning
     */
    showBrowserWarning: function() {
        document.body.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #f44336;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                font-family: Arial, sans-serif;
                z-index: 9999;
            ">
                <div>
                    <h1>Browser Not Supported</h1>
                    <p>Please use a modern browser to access this application.</p>
                    <p>Recommended: Chrome, Firefox, Safari, or Edge (latest versions)</p>
                </div>
            </div>
        `;
    },

    /**
     * Initialize core modules
     */
    initializeModules: function() {
        try {
            // Initialize Utils first (no dependencies)
            if (typeof Utils !== 'undefined') {
                console.log('✓ Utils module loaded');
            } else {
                throw new Error('Utils module not found');
            }

            // Initialize Auth module
            if (typeof Auth !== 'undefined') {
                console.log('✓ Auth module loaded');
            } else {
                throw new Error('Auth module not found');
            }

            // Other modules will be initialized on their respective pages

        } catch (error) {
            console.error('Module initialization error:', error);
            this.showError('Failed to initialize application modules');
        }
    },

    /**
     * Set up global error handling
     */
    setupErrorHandling: function() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);

            if (this.config.enableDebug) {
                this.showError(`Error: ${event.error?.message || 'Unknown error'}`);
            } else {
                this.showError('An unexpected error occurred. Please refresh the page.');
            }
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            if (this.config.enableDebug) {
                this.showError(`Promise rejection: ${event.reason}`);
            } else {
                this.showError('An unexpected error occurred. Please refresh the page.');
            }
        });

        // Handle network errors
        window.addEventListener('offline', () => {
            this.showError('You are offline. Some features may not work properly.');
        });

        window.addEventListener('online', () => {
            Utils.UI.showNotification('Connection restored!', 'success');
        });
    },

    /**
     * Set up page routing
     */
    setupRouting: function() {
        // Determine current page from URL
        const path = window.location.pathname;
        const page = this.getPageFromPath(path);

        this.state.currentPage = page;

        // Initialize page-specific functionality
        this.initializePage(page);

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            const newPage = this.getPageFromPath(window.location.pathname);
            this.navigateToPage(newPage);
        });
    },

    /**
     * Get page identifier from URL path
     */
    getPageFromPath: function(path) {
        if (path.includes('login.html')) return 'login';
        if (path.includes('dashboard.html')) return 'dashboard';
        if (path.includes('index.html') || path === '/') return 'home';
        return 'unknown';
    },

    /**
     * Initialize page-specific functionality
     */
    initializePage: function(page) {
        console.log(`Initializing page: ${page}`);

        switch (page) {
            case 'login':
                // Login page is handled by Auth module
                break;

            case 'dashboard':
                // Initialize dashboard if module is available
                if (typeof Dashboard !== 'undefined') {
                    Dashboard.init();
                } else {
                    console.error('Dashboard module not found');
                }
                break;

            case 'home':
                this.initializeHomePage();
                break;

            default:
                console.warn(`Unknown page: ${page}`);
                break;
        }
    },

    /**
     * Initialize home page (index.html)
     */
    initializeHomePage: function() {
        // Check if user is already authenticated
        if (Auth.isAuthenticated()) {
            // Redirect to dashboard
            Utils.Navigation.navigateTo('pages/dashboard.html');
        } else {
            // Redirect to login
            Utils.Navigation.navigateTo('pages/login.html');
        }
    },

    /**
     * Navigate to a new page
     */
    navigateToPage: function(page) {
        if (this.state.currentPage === page) return;

        console.log(`Navigating from ${this.state.currentPage} to ${page}`);

        // Clean up current page
        this.cleanupPage(this.state.currentPage);

        // Update state
        this.state.currentPage = page;

        // Initialize new page
        this.initializePage(page);
    },

    /**
     * Clean up page-specific resources
     */
    cleanupPage: function(page) {
        switch (page) {
            case 'dashboard':
                // Clean up dashboard resources if needed
                break;
            default:
                break;
        }
    },

    /**
     * Set up notification permissions
     */
    setupNotifications: function() {
        if ('Notification' in window) {
            // Request permission if not already granted
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    console.log('Notification permission:', permission);
                });
            }
        }
    },

    /**
     * Set up service worker for offline functionality
     */
    setupServiceWorker: function() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    },

    /**
     * Show error message to user
     */
    showError: function(message, duration = 8000) {
        if (typeof Utils !== 'undefined' && Utils.UI) {
            Utils.UI.showNotification(message, 'error', duration);
        } else {
            // Fallback error display
            alert(message);
        }
    },

    /**
     * Show loading state
     */
    showLoading: function(message = 'Loading...') {
        this.state.isLoading = true;

        // Create or update loading overlay
        let loadingOverlay = document.getElementById('app-loading');
        if (!loadingOverlay) {
            loadingOverlay = Utils.DOM.createElement('div', {
                id: 'app-loading',
                style: `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    backdrop-filter: blur(5px);
                `
            });

            const loadingContent = Utils.DOM.createElement('div', {
                style: `
                    text-align: center;
                    padding: 2rem;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                `
            });

            loadingContent.innerHTML = `
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #4CAF50;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem auto;
                "></div>
                <div style="color: #666; font-weight: 500;">${message}</div>
            `;

            loadingOverlay.appendChild(loadingContent);
            document.body.appendChild(loadingOverlay);

            // Add CSS animation if not already present
            if (!document.getElementById('loading-styles')) {
                const style = document.createElement('style');
                style.id = 'loading-styles';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            const messageElement = loadingOverlay.querySelector('div:last-child');
            if (messageElement) {
                messageElement.textContent = message;
            }
            loadingOverlay.style.display = 'flex';
        }
    },

    /**
     * Hide loading state
     */
    hideLoading: function() {
        this.state.isLoading = false;

        const loadingOverlay = document.getElementById('app-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    },

    /**
     * Get application state
     */
    getState: function() {
        return { ...this.state };
    },

    /**
     * Update application configuration
     */
    updateConfig: function(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('App config updated:', this.config);
    },

    /**
     * Trigger custom event
     */
    triggerEvent: function(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
        console.log(`Event triggered: ${eventName}`, data);
    },

    /**
     * Listen for custom events
     */
    on: function(eventName, callback) {
        document.addEventListener(eventName, callback);
    },

    /**
     * Remove event listener
     */
    off: function(eventName, callback) {
        document.removeEventListener(eventName, callback);
    },

    /**
     * Debug information
     */
    debug: function() {
        if (!this.config.enableDebug) return;

        console.group('🐛 App Debug Information');
        console.log('State:', this.state);
        console.log('Config:', this.config);
        console.log('Current User:', Auth.getCurrentUser());
        console.log('Storage Available:', Utils.Storage.isAvailable());
        console.log('Browser Info:', {
            userAgent: navigator.userAgent,
            language: navigator.language,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled
        });
        console.groupEnd();
    },

    /**
     * Reset application (clear all data)
     */
    reset: function() {
        if (confirm('This will clear all your data. Are you sure?')) {
            // Clear all storage
            Utils.Storage.clear();

            // Logout current user
            Auth.logout();

            // Reload page
            Utils.Navigation.reload();
        }
    },

    /**
     * Export application data
     */
    exportData: function() {
        try {
            const data = {
                reminders: Utils.Storage.get(APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA, []),
                preferences: Utils.Storage.get(APP_CONFIG.STORAGE_KEYS.USER_PREFERENCES, {}),
                exportDate: new Date().toISOString(),
                version: APP_CONFIG.VERSION
            };

            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `reminder-manager-backup-${Utils.DateTime.formatDate(new Date(), 'YYYY-MM-DD')}.json`;
            link.click();

            Utils.UI.showNotification('Data exported successfully!', 'success');

        } catch (error) {
            console.error('Export error:', error);
            Utils.UI.showNotification('Failed to export data', 'error');
        }
    },

    /**
     * Import application data
     */
    importData: function(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate data structure
                if (!data.reminders || !Array.isArray(data.reminders)) {
                    throw new Error('Invalid data format');
                }

                // Confirm import
                if (!confirm(`Import ${data.reminders.length} reminders? This will overwrite existing data.`)) {
                    return;
                }

                // Import data
                Utils.Storage.set(APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA, data.reminders);
                if (data.preferences) {
                    Utils.Storage.set(APP_CONFIG.STORAGE_KEYS.USER_PREFERENCES, data.preferences);
                }

                Utils.UI.showNotification('Data imported successfully! Refreshing...', 'success');

                // Refresh page after short delay
                setTimeout(() => {
                    Utils.Navigation.reload();
                }, 2000);

            } catch (error) {
                console.error('Import error:', error);
                Utils.UI.showNotification('Failed to import data. Please check the file format.', 'error');
            }
        };

        reader.readAsText(file);
    },

    /**
     * Check for application updates
     */
    checkForUpdates: function() {
        // This would typically check against a server API
        console.log('Checking for updates...');
        Utils.UI.showNotification('You are running the latest version!', 'info');
    },

    /**
     * Get application version information
     */
    getVersionInfo: function() {
        return {
            version: APP_CONFIG.VERSION,
            name: APP_CONFIG.APP_NAME,
            initialized: this.state.initialized,
            currentPage: this.state.currentPage
        };
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});

// Make App available globally
if (typeof window !== 'undefined') {
    window.App = App;

    // Add global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Shift + D for debug info
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            App.debug();
        }

        // Ctrl/Cmd + Shift + R for reset (with confirmation)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            App.reset();
        }
    });
}

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}

// Add some helpful console commands for development
if (typeof window !== 'undefined' && window.console) {
    console.log(`
🎉 Welcome to Reminders Vault!

Development Commands:
- App.debug() - Show debug information
- App.reset() - Reset all application data
- App.exportData() - Export your data
- App.checkForUpdates() - Check for updates
- Auth.getCurrentUser() - Get current user info
- Utils.Storage.get('${APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA}') - View stored reminders

Keyboard Shortcuts:
- Ctrl/Cmd + Shift + D - Debug info
- Ctrl/Cmd + Shift + R - Reset app
- Ctrl/Cmd + N - New reminder (on dashboard)
- Ctrl/Cmd + R - Refresh (on dashboard)
    `);
}