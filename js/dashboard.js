// ===== MINIMAL WORKING DASHBOARD - DEBUG VERSION =====

console.log('🔍 Debug Dashboard Loading...');

// Check what's available in global scope
console.log('Available globals:', {
    Auth: typeof Auth,
    Utils: typeof Utils,
    DataManager: typeof DataManager,
    UIManager: typeof UIManager,
    NotificationManager: typeof NotificationManager,
    APP_CONFIG: typeof APP_CONFIG,
    DEMO_USERS: typeof DEMO_USERS
});

// Simple Dashboard that works with your existing setup
const Dashboard = {
    initialized: false,

    init() {
        console.log('🚀 Starting Dashboard Init...');

        try {
            // Step 1: Check authentication
            console.log('Step 1: Checking authentication...');
            if (!this.checkAuth()) {
                console.log('❌ Auth failed, redirecting...');
                return;
            }
            console.log('✅ Auth passed');

            // Step 2: Wait for DOM
            console.log('Step 2: Checking DOM...');
            if (document.readyState === 'loading') {
                console.log('⏳ DOM still loading, waiting...');
                document.addEventListener('DOMContentLoaded', () => this.init());
                return;
            }
            console.log('✅ DOM ready');

            // Step 3: Initialize components
            console.log('Step 3: Initializing components...');
            this.initComponents();
            console.log('✅ Components initialized');

            // Step 4: Load data
            console.log('Step 4: Loading data...');
            this.loadData();
            console.log('✅ Data loaded');

            // Step 5: Setup events
            console.log('Step 5: Setting up events...');
            this.setupEvents();
            console.log('✅ Events setup');

            // Step 6: Hide loader
            console.log('Step 6: Hiding loader...');
            this.hideLoader();
            console.log('✅ Loader hidden');

            this.initialized = true;
            console.log('🎉 Dashboard initialization complete!');

        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.showError('Failed to load dashboard: ' + error.message);
            this.hideLoader();
        }
    },

    checkAuth() {
        // Check both Auth patterns
        let isAuthenticated = false;
        let currentUser = null;

        if (typeof Auth !== 'undefined' && Auth.isAuthenticated) {
            isAuthenticated = Auth.isAuthenticated();
            currentUser = Auth.getCurrentUser ? Auth.getCurrentUser() : null;
            console.log('Using legacy Auth service');
        } else if (typeof authService !== 'undefined' && authService.isAuthenticated) {
            isAuthenticated = authService.isAuthenticated();
            currentUser = authService.getCurrentUser ? authService.getCurrentUser() : null;
            console.log('Using modern AuthService');
        } else {
            console.warn('No Auth service found!');
            // For debugging, let's continue anyway
            return true;
        }

        if (!isAuthenticated) {
            console.log('User not authenticated, redirecting to login...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 100);
            return false;
        }

        console.log('User authenticated:', currentUser?.username || 'unknown');

        // Update welcome message
        this.updateWelcomeMessage(currentUser);

        return true;
    },

    initComponents() {
        // Initialize available managers
        if (typeof DataManager !== 'undefined' && DataManager.init) {
            console.log('Initializing DataManager...');
            DataManager.init();
        } else {
            console.warn('DataManager not available');
        }

        if (typeof UIManager !== 'undefined' && UIManager.init) {
            console.log('Initializing UIManager...');
            UIManager.init();
        } else {
            console.warn('UIManager not available');
        }

        if (typeof NotificationManager !== 'undefined' && NotificationManager.init) {
            console.log('Initializing NotificationManager...');
            NotificationManager.init();
        } else {
            console.warn('NotificationManager not available');
        }

        // Update current date/time
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 60000);
    },

    loadData() {
        try {
            // Load and display data
            let reminders = [];
            let stats = { total: 0, active: 0, completed: 0, overdue: 0 };

            if (typeof DataManager !== 'undefined') {
                reminders = DataManager.getReminders ? DataManager.getReminders() : [];
                stats = DataManager.getStats ? DataManager.getStats() : stats;
            } else {
                console.warn('DataManager not available, using mock data');
                reminders = this.getMockReminders();
                stats = this.calculateMockStats(reminders);
            }

            console.log('Loaded data:', { reminders: reminders.length, stats });

            // Update displays
            this.updateStats(stats);
            this.updateReminders(reminders.slice(0, 5)); // Show first 5

        } catch (error) {
            console.error('Error loading data:', error);
            // Continue with empty data
            this.updateStats({ total: 0, active: 0, completed: 0, overdue: 0 });
            this.updateReminders([]);
        }
    },

    setupEvents() {
        try {
            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
                console.log('Logout button connected');
            }

            // Add reminder button
            const addBtn = document.getElementById('addReminderBtn');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    this.showAddModal();
                });
                console.log('Add reminder button connected');
            }

            // Refresh button
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.refresh();
                });
                console.log('Refresh button connected');
            }

            // Modal close buttons
            document.querySelectorAll('.close').forEach(closeBtn => {
                closeBtn.addEventListener('click', (e) => {
                    const modal = e.target.closest('.modal');
                    if (modal) this.closeModal(modal);
                });
            });

            console.log('Events setup complete');

        } catch (error) {
            console.error('Error setting up events:', error);
            // Continue anyway
        }
    },

    updateDateTime() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const now = new Date();
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    },

    updateWelcomeMessage(user) {
        const welcomeElement = document.getElementById('welcomeMessage');
        if (welcomeElement && user) {
            const name = user.profile?.firstName || user.username || 'User';
            welcomeElement.textContent = `Welcome back, ${name}!`;
        }
    },

    updateStats(stats) {
        console.log('Updating stats:', stats);

        const statElements = {
            totalReminders: document.getElementById('totalReminders'),
            activeReminders: document.getElementById('activeReminders'),
            completedToday: document.getElementById('completedToday'),
            overdue: document.getElementById('overdue')
        };

        // Update each stat with animation
        Object.entries(stats).forEach(([key, value]) => {
            const element = statElements[key];
            if (element) {
                this.animateNumber(element, value);
            }
        });
    },

    updateReminders(reminders) {
        console.log('Updating reminders:', reminders.length);

        const container = document.getElementById('recentReminders');
        if (!container) {
            console.warn('Recent reminders container not found');
            return;
        }

        if (reminders.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>No reminders found</h3>
          <p>Create your first reminder to get started!</p>
        </div>
      `;
            return;
        }

        const html = reminders.map(reminder => `
      <div class="reminder-item" data-id="${reminder.id}">
        <div class="reminder-status ${reminder.status}"></div>
        <div class="reminder-content">
          <div class="reminder-title">
            ${this.getPriorityIcon(reminder.priority)} ${this.escapeHtml(reminder.title)}
          </div>
          <div class="reminder-time">
            ${this.formatTime(reminder.datetime)}
          </div>
        </div>
        <div class="reminder-actions">
          <button class="reminder-action" onclick="Dashboard.completeReminder(${reminder.id})" 
                  aria-label="Complete reminder">✓</button>
        </div>
      </div>
    `).join('');

        container.innerHTML = html;
    },

    // Utility methods
    animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const difference = targetValue - currentValue;
        const duration = 500;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentNumber = Math.round(currentValue + (difference * progress));

            element.textContent = currentNumber;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    },

    getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    },

    formatTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) {
            return 'Overdue';
        } else if (diffMs < 60 * 60 * 1000) {
            const minutes = Math.round(diffMs / (60 * 1000));
            return `In ${minutes}m`;
        } else if (diffMs < 24 * 60 * 60 * 1000) {
            const hours = Math.round(diffMs / (60 * 60 * 1000));
            return `In ${hours}h`;
        } else {
            return date.toLocaleDateString();
        }
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    getMockReminders() {
        return [
            {
                id: 1,
                title: 'Team meeting',
                datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                priority: 3,
                status: 'active'
            },
            {
                id: 2,
                title: 'Doctor appointment',
                datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                priority: 2,
                status: 'active'
            },
            {
                id: 3,
                title: 'Buy groceries',
                datetime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                priority: 1,
                status: 'overdue'
            }
        ];
    },

    calculateMockStats(reminders) {
        return {
            total: reminders.length,
            active: reminders.filter(r => r.status === 'active').length,
            completed: 0,
            overdue: reminders.filter(r => r.status === 'overdue').length
        };
    },

    // Action handlers
    handleLogout() {
        if (!confirm('Are you sure you want to logout?')) return;

        console.log('Logging out...');

        try {
            if (typeof Auth !== 'undefined' && Auth.logout) {
                Auth.logout();
            } else if (typeof authService !== 'undefined' && authService.logout) {
                authService.logout();
            }

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 100);

        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect anyway
            window.location.href = 'login.html';
        }
    },

    showAddModal() {
        console.log('Showing add reminder modal...');

        const modal = document.getElementById('addReminderModal');
        if (modal) {
            modal.style.display = 'flex';

            // Set default datetime
            const datetimeInput = document.getElementById('reminderDate');
            if (datetimeInput) {
                const defaultTime = new Date();
                defaultTime.setHours(defaultTime.getHours() + 1);
                datetimeInput.value = defaultTime.toISOString().slice(0, 16);
            }

            // Focus title
            const titleInput = document.getElementById('reminderTitle');
            if (titleInput) {
                setTimeout(() => titleInput.focus(), 100);
            }
        } else {
            console.warn('Add reminder modal not found');
            this.showNotification('Modal not available', 'error');
        }
    },

    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    },

    refresh() {
        console.log('Refreshing dashboard...');

        try {
            this.loadData();
            this.showNotification('Dashboard refreshed!', 'success');
        } catch (error) {
            console.error('Refresh error:', error);
            this.showNotification('Refresh failed', 'error');
        }
    },

    completeReminder(id) {
        console.log('Completing reminder:', id);

        try {
            if (typeof DataManager !== 'undefined' && DataManager.markReminderComplete) {
                const reminder = DataManager.getReminderById(id);
                if (reminder) {
                    DataManager.markReminderComplete(reminder);
                    this.loadData(); // Refresh
                    this.showNotification('Reminder completed!', 'success');
                }
            } else {
                this.showNotification('Feature not available', 'warning');
            }
        } catch (error) {
            console.error('Complete reminder error:', error);
            this.showNotification('Failed to complete reminder', 'error');
        }
    },

    hideLoader() {
        const loader = document.getElementById('dashboardLoader');
        if (loader) {
            loader.style.display = 'none';
            console.log('Loader hidden');
        }

        // Also hide any workspace loader
        const workspaceLoader = document.querySelector('.dashboard-loader');
        if (workspaceLoader) {
            workspaceLoader.style.display = 'none';
            console.log('Workspace loader hidden');
        }
    },

    showError(message) {
        console.error('Dashboard Error:', message);

        // Try multiple notification methods
        if (typeof Utils !== 'undefined' && Utils.UI && Utils.UI.showNotification) {
            Utils.UI.showNotification(message, 'error');
        } else {
            this.showNotification(message, 'error');
        }
    },

    showNotification(message, type = 'info') {
        console.log(`Notification (${type}):`, message);

        // Fallback notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
};

// Global access for debugging
window.Dashboard = Dashboard;
window.debugDashboard = () => {
    console.log('Dashboard State:', {
        initialized: Dashboard.initialized,
        authAvailable: typeof Auth !== 'undefined',
        utilsAvailable: typeof Utils !== 'undefined',
        dataManagerAvailable: typeof DataManager !== 'undefined',
        domReady: document.readyState
    });
};

// Error boundary for debugging
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);
    Dashboard.hideLoader();
    Dashboard.showError('Application error: ' + event.error.message);
});

// Initialize when ready
console.log('Dashboard script loaded, DOM state:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, starting dashboard...');
        Dashboard.init();
    });
} else {
    console.log('DOM already loaded, starting dashboard immediately...');
    setTimeout(() => Dashboard.init(), 100);
}