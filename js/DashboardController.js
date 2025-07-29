import { NotificationService } from './NotificationService.js';
import { IndexedDBStorageService } from './IndexedDBStorageService.js';

/**
 * Modern DashboardController with IndexedDB persistent storage
 * Implements clean architecture patterns with proper separation of concerns
 */
export class DashboardController {
    // Private fields for encapsulation
    #reminders = [];
    #schedule = [];
    #currentUser = null;
    #notificationService = null;
    #storageService = null;
    #state = {
        currentFilter: 'all',
        currentPage: 1,
        sortBy: 'datetime',
        filteredReminders: [],
        isLoading: false,
        lastSync: null
    };

    // Configuration constants using modern const patterns
    static CONFIG = Object.freeze({
        ITEMS_PER_PAGE: 10,
        AUTO_REFRESH_INTERVAL: 60000,
        REMINDER_STATUS: Object.freeze({
            ACTIVE: 'active',
            COMPLETED: 'completed',
            OVERDUE: 'overdue'
        }),
        REMINDER_PRIORITIES: Object.freeze({
            LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4
        }),
        DEFAULT_ALERT_TIMINGS: Object.freeze([5, 15, 60])
    });

    // Sample data with modern object syntax
    static SAMPLE_DATA = Object.freeze({
        reminders: [
            {
                title: 'Team meeting with product team',
                description: 'Discuss quarterly roadmap and feature priorities',
                datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                category: 'work',
                priority: 3,
                status: 'active',
                notification: true,
                alertTimings: [15, 60]
            },
            {
                title: 'Test Multi-Alert Notification',
                description: 'This reminder will trigger multiple alerts for testing',
                datetime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                category: 'personal',
                priority: 4,
                status: 'active',
                notification: true,
                alertTimings: [5, 15, 30]
            },
            {
                title: 'Doctor appointment',
                description: 'Annual checkup with Dr. Smith',
                datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                category: 'health',
                priority: 2,
                status: 'active',
                notification: true,
                alertTimings: [60, 1440]
            }
        ],
        schedule: [
            { id: 1, time: '09:00', title: 'Daily standup', description: 'Team sync meeting' },
            { id: 2, time: '11:30', title: 'Client presentation', description: 'Present new features' }
        ]
    });

    constructor() {
        this.#notificationService = new NotificationService();
        this.#storageService = new IndexedDBStorageService();
        this.#setupNotificationHandlers();
    }

    /**
     * Initialize dashboard with comprehensive error handling
     */
    async initialize() {
        try {
            console.log('🚀 Initializing dashboard with IndexedDB storage...');
            this.#setLoadingState(true);

            if (!this.#checkAuthentication()) return false;

            // Parallel initialization for better performance
            await Promise.all([
                this.#storageService,
                this.#notificationService.initialize()
            ]);

            await this.#loadData();
            this.#setupEventHandlers();
            this.#startAutoRefresh();
            this.#render();

            this.#setLoadingState(false);
            console.log('✅ Dashboard initialized with persistent storage');
            return true;
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.#setLoadingState(false);
            this.#showNotification('Failed to initialize dashboard', 'error');
            return false;
        }
    }

    /**
     * Create reminder with comprehensive validation and error handling
     */
    async createReminder(reminderData) {
        try {
            this.#validateReminderData(reminderData);

            const alertTimings = this.#processAlertTimings(reminderData.alertTimings);
            const userId = this.#getCurrentUserId();

            const reminder = {
                title: reminderData.title.trim(),
                description: reminderData.description?.trim() || '',
                datetime: reminderData.datetime,
                category: reminderData.category || 'personal',
                priority: parseInt(reminderData.priority) || 2,
                notification: reminderData.notification !== false,
                alertTimings,
                status: this.#calculateStatus(reminderData.datetime),
                userId
            };

            // Save to IndexedDB with error handling
            const savedReminder = await this.#storageService.saveReminder(reminder);

            // Update local state immutably
            this.#reminders = [...this.#reminders, savedReminder];

            // Schedule notifications if applicable
            if (savedReminder.notification && savedReminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE) {
                const scheduledCount = this.#notificationService.scheduleNotification(savedReminder, savedReminder.alertTimings);
                console.log(`📅 Scheduled ${scheduledCount} alerts for reminder: ${savedReminder.title}`);
            }

            this.#refreshView();
            this.#showNotification('Reminder saved to IndexedDB!', 'success');

            return savedReminder;
        } catch (error) {
            console.error('Failed to create reminder:', error);
            this.#showNotification(error.message, 'error');
            throw error;
        }
    }

    /**
     * Complete reminder with optimistic updates
     */
    async completeReminder(reminderId) {
        try {
            const reminder = this.#findReminder(reminderId);
            if (!reminder) return;

            // Optimistic update for better UX
            const originalStatus = reminder.status;
            reminder.status = DashboardController.CONFIG.REMINDER_STATUS.COMPLETED;
            reminder.updatedAt = new Date().toISOString();
            this.#refreshView();

            try {
                // Update in IndexedDB
                await this.#storageService.updateReminder(reminderId, {
                    status: DashboardController.CONFIG.REMINDER_STATUS.COMPLETED
                });

                // Cancel notifications
                this.#notificationService.cancelNotification(reminderId);

                this.#showNotification(`"${reminder.title}" completed!`, 'success');
            } catch (error) {
                // Rollback on failure
                reminder.status = originalStatus;
                this.#refreshView();
                throw error;
            }
        } catch (error) {
            console.error('Failed to complete reminder:', error);
            this.#showNotification('Failed to complete reminder', 'error');
        }
    }

    /**
     * Delete reminder with confirmation and cleanup
     */
    async deleteReminder(reminderId) {
        try {
            const reminder = this.#findReminder(reminderId);
            if (!reminder) return;

            if (!confirm(`Delete "${reminder.title}"?`)) return;

            // Optimistic update
            this.#reminders = this.#reminders.filter(r => r.id !== reminderId);
            this.#refreshView();

            try {
                // Delete from IndexedDB
                await this.#storageService.deleteReminder(reminderId);

                // Cancel notifications
                this.#notificationService.cancelNotification(reminderId);

                this.#showNotification(`"${reminder.title}" deleted`, 'info');
            } catch (error) {
                // Rollback on failure
                this.#reminders.push(reminder);
                this.#refreshView();
                throw error;
            }
        } catch (error) {
            console.error('Failed to delete reminder:', error);
            this.#showNotification('Failed to delete reminder', 'error');
        }
    }

    /**
     * Snooze reminder with smart scheduling
     */
    async snoozeReminder(reminderId, minutes) {
        try {
            const reminder = this.#findReminder(reminderId);
            if (!reminder) return;

            const newTime = new Date();
            newTime.setMinutes(newTime.getMinutes() + minutes);

            const updates = {
                datetime: newTime.toISOString(),
                status: DashboardController.CONFIG.REMINDER_STATUS.ACTIVE
            };

            // Update in IndexedDB
            await this.#storageService.updateReminder(reminderId, updates);

            // Update local state
            Object.assign(reminder, updates, { updatedAt: new Date().toISOString() });

            // Reschedule notifications
            this.#notificationService.cancelNotification(reminderId);
            this.#notificationService.scheduleNotification(reminder, reminder.alertTimings);

            this.#refreshView();
            const timeText = this.#formatDuration(minutes);
            this.#showNotification(`"${reminder.title}" snoozed for ${timeText}`, 'success');
        } catch (error) {
            console.error('Failed to snooze reminder:', error);
            this.#showNotification('Failed to snooze reminder', 'error');
        }
    }

    /**
     * Update reminder alerts with transaction-like behavior
     */
    async updateReminderAlerts(reminderId, newAlertTimings) {
        try {
            const reminder = this.#findReminder(reminderId);
            if (!reminder) return false;

            const processedTimings = this.#processAlertTimings(newAlertTimings);
            const originalTimings = [...reminder.alertTimings];

            // Optimistic update
            reminder.alertTimings = processedTimings;
            reminder.updatedAt = new Date().toISOString();

            try {
                // Update in IndexedDB
                await this.#storageService.updateReminder(reminderId, {
                    alertTimings: processedTimings
                });

                // Reschedule notifications
                this.#notificationService.cancelNotification(reminderId);
                if (reminder.notification && reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE) {
                    const scheduledCount = this.#notificationService.scheduleNotification(reminder, processedTimings);
                    console.log(`🔄 Rescheduled ${scheduledCount} alerts for reminder #${reminderId}`);
                }

                this.#refreshView();
                this.#showNotification('Alert preferences updated in IndexedDB!', 'success');
                return true;
            } catch (error) {
                // Rollback on failure
                reminder.alertTimings = originalTimings;
                throw error;
            }
        } catch (error) {
            console.error('Failed to update reminder alerts:', error);
            this.#showNotification('Failed to update alert preferences', 'error');
            return false;
        }
    }

    /**
     * Get user alert preferences with caching
     */
    async getUserAlertPreferences() {
        try {
            const userId = this.#getCurrentUserId();
            const preferences = await this.#storageService.getUserPreferences(userId);

            return preferences || {
                defaultAlertTimings: DashboardController.CONFIG.DEFAULT_ALERT_TIMINGS
            };
        } catch (error) {
            console.error('Failed to get user preferences:', error);
            return { defaultAlertTimings: DashboardController.CONFIG.DEFAULT_ALERT_TIMINGS };
        }
    }

    /**
     * Update user alert preferences with validation
     */
    async updateUserAlertPreferences(preferences) {
        try {
            const userId = this.#getCurrentUserId();
            await this.#storageService.saveUserPreferences(userId, preferences);

            this.#showNotification('Preferences saved to IndexedDB!', 'success');
        } catch (error) {
            console.error('Failed to save user preferences:', error);
            this.#showNotification('Failed to save preferences', 'error');
        }
    }

    /**
     * Get comprehensive notification statistics
     */
    async getNotificationStats() {
        try {
            const userId = this.#getCurrentUserId();
            const stats = await this.#storageService.getStatistics(userId);
            const notificationStats = this.#notificationService.getNotificationStats();

            return {
                ...stats,
                ...notificationStats,
                storage: 'IndexedDB',
                lastSync: this.#state.lastSync
            };
        } catch (error) {
            console.error('Failed to get statistics:', error);
            return {
                totalReminders: this.#reminders.length,
                storage: 'IndexedDB (error)',
                error: error.message
            };
        }
    }

    /**
     * Export data with comprehensive metadata
     */
    async exportData() {
        try {
            const userId = this.#getCurrentUserId();
            const exportData = await this.#storageService.exportAllData(userId);

            // Create and trigger download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `reminders-indexeddb-export-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(link.href);

            this.#showNotification('Data exported from IndexedDB!', 'success');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.#showNotification('Failed to export data', 'error');
        }
    }

    /**
     * Import data with merge strategy
     */
    async importData() {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';

            const file = await new Promise(resolve => {
                fileInput.onchange = e => resolve(e.target.files[0]);
                fileInput.click();
            });

            if (!file) return;

            const text = await file.text();
            const importData = JSON.parse(text);

            const userId = this.#getCurrentUserId();
            const results = await this.#storageService.importData(importData, userId);

            // Reload data to refresh the view
            await this.#loadData();
            this.#refreshView();

            this.#showNotification(`Imported ${results.length} reminders to IndexedDB!`, 'success');
        } catch (error) {
            console.error('Failed to import data:', error);
            this.#showNotification('Failed to import data', 'error');
        }
    }

    /**
     * Clear all data with confirmation
     */
    async clearAllData() {
        if (!confirm('Are you sure you want to clear ALL data? This cannot be undone.')) return;

        try {
            const userId = this.#getCurrentUserId();
            const deletedCount = await this.#storageService.clearUserData(userId);

            // Clear local state
            this.#reminders = [];
            this.#notificationService?.cleanup();

            this.#refreshView();
            this.#showNotification(`Cleared ${deletedCount} reminders from IndexedDB`, 'success');
        } catch (error) {
            console.error('Failed to clear data:', error);
            this.#showNotification('Failed to clear data', 'error');
        }
    }

    /**
     * Get database information for debugging
     */
    async getDatabaseInfo() {
        try {
            return await this.#storageService.getDatabaseInfo();
        } catch (error) {
            console.error('Failed to get database info:', error);
            return { error: error.message };
        }
    }

    /**
     * Public API methods for external access
     */
    setFilter(filter) {
        this.#state.currentFilter = filter;
        this.#state.currentPage = 1;
        this.#applyFilters();
        this.#render();
    }

    refresh() {
        this.#loadData().then(() => {
            this.#showNotification('Dashboard refreshed from IndexedDB!', 'success');
        }).catch(error => {
            console.error('Failed to refresh:', error);
            this.#showNotification('Failed to refresh data', 'error');
        });
    }

    testNotificationSystem() {
        this.getUserAlertPreferences().then(prefs => {
            const testReminder = {
                id: 99999,
                title: 'Test IndexedDB System',
                description: 'Testing the enhanced notification system with IndexedDB storage',
                datetime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                priority: 3,
                category: 'personal',
                alertTimings: prefs.defaultAlertTimings
            };

            const scheduledCount = this.#notificationService.scheduleNotification(testReminder, testReminder.alertTimings);
            this.#notificationService.testNotification();

            this.#showNotification(
                `Test system activated! ${scheduledCount} alerts scheduled with IndexedDB data.`,
                'info'
            );
        });
    }

    showAlertPreferencesModal(reminderId = null) {
        const isGlobal = reminderId === null;

        if (isGlobal) {
            this.getUserAlertPreferences().then(prefs => {
                const modal = this.#createAlertPreferencesModal(prefs.defaultAlertTimings, true, null);
                document.body.appendChild(modal);
                modal.style.display = 'flex';
            });
        } else {
            const reminder = this.#findReminder(reminderId);
            if (reminder) {
                const modal = this.#createAlertPreferencesModal(reminder.alertTimings || [], false, reminderId);
                document.body.appendChild(modal);
                modal.style.display = 'flex';
            }
        }
    }

    showAddReminderModal() {
        this.#showAddReminderModal();
    }

    testAlertPreferences() {
        this.testNotificationSystem();
    }

    logout() {
        if (!confirm('Are you sure you want to logout?')) return;

        this.#cleanup();
        this.#clearSessionData();
        this.#showNotification('Logged out successfully', 'success');

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }

    // === PRIVATE METHODS ===

    /**
     * Validate reminder data with comprehensive checks
     */
    #validateReminderData(reminderData) {
        if (!reminderData.title?.trim()) {
            throw new Error('Title is required');
        }
        if (!reminderData.datetime) {
            throw new Error('Date and time is required');
        }

        const reminderDate = new Date(reminderData.datetime);
        if (isNaN(reminderDate.getTime())) {
            throw new Error('Invalid date and time');
        }
    }

    /**
     * Set loading state with UI updates
     */
    #setLoadingState(isLoading) {
        this.#state.isLoading = isLoading;

        const loader = document.querySelector('.dashboard-loader');
        if (loader) {
            loader.style.display = isLoading ? 'flex' : 'none';
        }
    }

    /**
     * Check authentication with session validation
     */
    #checkAuthentication() {
        const session = this.#getSessionData();

        if (!session?.username) {
            console.log('No valid session, redirecting to login...');
            setTimeout(() => window.location.href = 'login.html', 1000);
            return false;
        }

        this.#currentUser = session;
        this.#updateWelcomeMessage();
        return true;
    }

    /**
     * Get current user ID with fallback
     */
    #getCurrentUserId() {
        return this.#currentUser?.id || this.#currentUser?.username || 'anonymous';
    }

    /**
     * Get session data from localStorage
     */
    #getSessionData() {
        try {
            const sessionData = localStorage.getItem('user_session');
            return sessionData ? JSON.parse(sessionData) : null;
        } catch {
            return null;
        }
    }

    /**
     * Clear session data on logout
     */
    #clearSessionData() {
        try {
            localStorage.removeItem('user_session');
        } catch (error) {
            console.warn('Failed to clear session data:', error);
        }
    }

    /**
     * Load data from IndexedDB with error handling
     */
    async #loadData() {
        try {
            const userId = this.#getCurrentUserId();

            // Load reminders from IndexedDB
            this.#reminders = await this.#storageService.getReminders(userId);

            // Create sample data if none exists
            if (this.#reminders.length === 0) {
                console.log('No existing reminders found, creating sample data...');
                await this.#createSampleData(userId);
            }

            // Load static schedule data
            this.#schedule = [...DashboardController.SAMPLE_DATA.schedule];

            this.#applyFilters();
            this.#scheduleExistingNotifications();
            await this.#updateOverdueReminders();

            this.#state.lastSync = new Date().toISOString();
            console.log(`📊 Loaded ${this.#reminders.length} reminders from IndexedDB`);
        } catch (error) {
            console.error('Failed to load data from IndexedDB:', error);
            this.#showNotification('Failed to load data', 'error');

            // Fallback to empty state
            this.#reminders = [];
            this.#schedule = [];
        }
    }

    /**
     * Create sample data for new users
     */
    async #createSampleData(userId) {
        const samplePromises = DashboardController.SAMPLE_DATA.reminders.map(reminder =>
            this.#storageService.saveReminder({ ...reminder, userId })
        );

        this.#reminders = await Promise.all(samplePromises);
        console.log(`📝 Created ${this.#reminders.length} sample reminders in IndexedDB`);
    }

    /**
     * Schedule notifications for existing active reminders
     */
    #scheduleExistingNotifications() {
        const activeReminders = this.#reminders.filter(r =>
            r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE &&
            r.notification &&
            new Date(r.datetime) > new Date()
        );

        let totalScheduled = 0;
        activeReminders.forEach(reminder => {
            const scheduledCount = this.#notificationService.scheduleNotification(reminder, reminder.alertTimings || []);
            totalScheduled += scheduledCount;
        });

        console.log(`📅 Scheduled ${totalScheduled} total alerts for ${activeReminders.length} active reminders`);
    }

    /**
     * Update overdue reminders with batch processing
     */
    async #updateOverdueReminders() {
        const now = new Date();
        const overdueUpdates = [];

        for (const reminder of this.#reminders) {
            if (reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) <= now) {

                overdueUpdates.push(
                    this.#storageService.updateReminder(reminder.id, {
                        status: DashboardController.CONFIG.REMINDER_STATUS.OVERDUE
                    })
                );

                reminder.status = DashboardController.CONFIG.REMINDER_STATUS.OVERDUE;
                reminder.updatedAt = new Date().toISOString();
            }
        }

        if (overdueUpdates.length > 0) {
            await Promise.all(overdueUpdates);
            this.#refreshView();
            console.log(`⏰ Updated ${overdueUpdates.length} overdue reminders in IndexedDB`);
        }
    }

    /**
     * Setup notification event handlers
     */
    #setupNotificationHandlers() {
        const handlers = new Map([
            ['notification:check-due-reminders', () => {
                this.#notificationService.checkDueReminders(this.#reminders);
            }],
            ['notification:reminder-complete', (e) => {
                this.completeReminder(e.detail.reminderId);
            }],
            ['notification:reminder-snooze', (e) => {
                this.snoozeReminder(e.detail.reminderId, e.detail.minutes);
            }]
        ]);

        handlers.forEach((handler, event) => {
            document.addEventListener(event, handler);
        });
    }

    /**
     * Setup event handlers with delegation
     */
    #setupEventHandlers() {
        // Stats card click handlers
        document.querySelectorAll('.clickable-stat').forEach(card => {
            card.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });

        this.#setupButtonHandlers();
        this.#setupModalHandlers();
        this.#setupFormHandlers();
    }

    /**
     * Setup button handlers with modern Map approach
     */
    #setupButtonHandlers() {
        const handlerMap = new Map([
            ['logoutBtn', () => this.logout()],
            ['addReminderBtn', () => this.#showAddReminderModal()],
            ['refreshBtn', () => this.refresh()],
            ['exportBtn', () => this.exportData()],
            ['importBtn', () => this.importData()],
            ['clearDataBtn', () => this.clearAllData()],
            ['testNotificationBtn', () => this.testNotificationSystem()],
            ['alertPreferencesBtn', () => this.showAlertPreferencesModal()],
            ['alertPrefsBtn', () => this.showAlertPreferencesModal()],
            ['dbInfoBtn', () => this.#showDatabaseInfo()]
        ]);

        handlerMap.forEach((handler, id) => {
            const element = document.getElementById(id);
            if (element) {
                // Remove existing listeners by cloning
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                document.getElementById(id).addEventListener('click', handler);
            }
        });
    }

    /**
     * Show database information dialog
     */
    async #showDatabaseInfo() {
        try {
            const info = await this.getDatabaseInfo();
            const stats = await this.getNotificationStats();

            const message = `IndexedDB Information:
            
Database: ${info.name} (version ${info.version})
Stores: ${info.objectStoreNames?.join(', ') || 'N/A'}
Storage: ${JSON.stringify(info.size, null, 2)}

Statistics:
- Total Reminders: ${stats.totalReminders}
- Active: ${stats.active}
- Completed: ${stats.completed}
- Overdue: ${stats.overdue}
- Total Alerts: ${stats.totalConfiguredAlerts}
- Storage Type: ${stats.storage}`;

            alert(message);
        } catch (error) {
            console.error('Failed to show database info:', error);
        }
    }

    /**
     * Setup modal event handlers
     */
    #setupModalHandlers() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.#closeModal(modal.id);
            });
        });

        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.#closeModal(modal.id);
            });
        });
    }

    /**
     * Setup form handlers with duplicate prevention
     */
    #setupFormHandlers() {
        const form = document.getElementById('addReminderForm');
        if (!form) return;

        // Clone to remove existing listeners
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        const freshForm = document.getElementById('addReminderForm');

        let isProcessing = false;
        freshForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (isProcessing) return;
            isProcessing = true;

            try {
                await this.#handleFormSubmit();
            } catch (error) {
                console.error('Form submission error:', error);
            } finally {
                isProcessing = false;
            }
        });

        // Quick time buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => this.#setQuickTime(btn));
        });
    }

    /**
     * Start auto-refresh with cleanup
     */
    #startAutoRefresh() {
        const refreshInterval = setInterval(() => {
            this.#updateDateTime();
            this.#updateOverdueReminders();
        }, DashboardController.CONFIG.AUTO_REFRESH_INTERVAL);

        // Page visibility handling
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('📱 Page visible - checking for updates...');
                this.#updateOverdueReminders();
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterval);
            this.#cleanup();
        });
    }

    /**
     * Cleanup resources
     */
    #cleanup() {
        this.#notificationService?.cleanup();
        console.log('🧹 Dashboard cleanup completed');
    }

    /**
     * Process alert timings with validation
     */
    #processAlertTimings(alertTimings) {
        if (!Array.isArray(alertTimings)) {
            return [...DashboardController.CONFIG.DEFAULT_ALERT_TIMINGS];
        }

        const validTimings = alertTimings
            .filter(timing => typeof timing === 'number' && timing > 0)
            .filter((timing, index, arr) => arr.indexOf(timing) === index)
            .sort((a, b) => a - b);

        return validTimings.length > 0 ? validTimings : [...DashboardController.CONFIG.DEFAULT_ALERT_TIMINGS];
    }

    /**
     * Generate unique ID
     */
    #generateId() {
        return Date.now() + Math.random();
    }

    /**
     * Calculate reminder status based on datetime
     */
    #calculateStatus(datetime) {
        return new Date(datetime) <= new Date()
            ? DashboardController.CONFIG.REMINDER_STATUS.OVERDUE
            : DashboardController.CONFIG.REMINDER_STATUS.ACTIVE;
    }

    /**
     * Find reminder by ID with error handling
     */
    #findReminder(id) {
        return this.#reminders.find(r => r.id === id);
    }

    /**
     * Apply filters and sorting with immutable updates
     */
    #applyFilters() {
        let filtered = [...this.#reminders];

        // Apply status filter
        switch (this.#state.currentFilter) {
            case 'active':
                filtered = filtered.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE);
                break;
            case 'completed':
                filtered = filtered.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.COMPLETED);
                break;
            case 'overdue':
                filtered = filtered.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.OVERDUE);
                break;
        }

        // Apply sorting
        const sortFunctions = {
            priority: (a, b) => b.priority - a.priority,
            title: (a, b) => a.title.localeCompare(b.title),
            created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            alerts: (a, b) => (b.alertTimings?.length || 0) - (a.alertTimings?.length || 0),
            datetime: (a, b) => new Date(a.datetime) - new Date(b.datetime)
        };

        const sortFunction = sortFunctions[this.#state.sortBy] || sortFunctions.datetime;
        filtered.sort(sortFunction);

        this.#state.filteredReminders = filtered;
    }

    /**
     * Render dashboard with all components
     */
    #render() {
        this.#updateDateTime();
        this.#updateStatistics();
        this.#renderReminders();
        this.#renderSchedule();
        this.#updateFilterInfo();
    }

    /**
     * Refresh view with optimized updates
     */
    #refreshView() {
        this.#applyFilters();
        this.#render();
    }

    /**
     * Update current date/time display
     */
    #updateDateTime() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    /**
     * Update welcome message with user info
     */
    #updateWelcomeMessage() {
        const welcomeElement = document.getElementById('welcomeMessage');
        if (welcomeElement && this.#currentUser) {
            const name = this.#currentUser.profile?.firstName || this.#currentUser.username || 'User';
            welcomeElement.textContent = `Welcome back, ${name}!`;
        }
    }

    /**
     * Update statistics with smooth animations
     */
    #updateStatistics() {
        const stats = this.#calculateStatistics();

        this.#animateCounter('totalReminders', stats.total);
        this.#animateCounter('activeReminders', stats.active);
        this.#animateCounter('completedToday', stats.completed);
        this.#animateCounter('overdue', stats.overdue);

        this.#updateStatCardStates();
    }

    /**
     * Calculate comprehensive statistics
     */
    #calculateStatistics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return {
            total: this.#reminders.length,
            active: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE).length,
            completed: this.#reminders.filter(r =>
                r.status === DashboardController.CONFIG.REMINDER_STATUS.COMPLETED &&
                new Date(r.updatedAt) >= today && new Date(r.updatedAt) < tomorrow
            ).length,
            overdue: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.OVERDUE).length
        };
    }

    /**
     * Animate counter with smooth transitions
     */
    #animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

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

        if (Math.abs(difference) > 0) {
            requestAnimationFrame(animate);
        }
    }

    /**
     * Update stat card visual states
     */
    #updateStatCardStates() {
        document.querySelectorAll('.clickable-stat').forEach(card => {
            const filter = card.dataset.filter;
            if (filter === this.#state.currentFilter) {
                card.style.transform = 'scale(1.05)';
                card.style.boxShadow = '0 15px 30px rgba(102, 126, 234, 0.3)';
            } else {
                card.style.transform = '';
                card.style.boxShadow = '';
            }
        });
    }

    /**
     * Render reminders with pagination
     */
    #renderReminders() {
        const container = document.getElementById('remindersList');
        if (!container) return;

        if (this.#state.filteredReminders.length === 0) {
            this.#renderEmptyState(container);
            this.#hidePagination();
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(this.#state.filteredReminders.length / DashboardController.CONFIG.ITEMS_PER_PAGE);
        const startIndex = (this.#state.currentPage - 1) * DashboardController.CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + DashboardController.CONFIG.ITEMS_PER_PAGE;
        const pageReminders = this.#state.filteredReminders.slice(startIndex, endIndex);

        // Render items
        const html = pageReminders.map(reminder => this.#renderReminderItem(reminder)).join('');
        container.innerHTML = html;

        this.#setupReminderActionHandlers();
        this.#updatePagination(totalPages);
    }

    /**
     * Render individual reminder item
     */
    #renderReminderItem(reminder) {
        const priorityIcon = this.#getPriorityIcon(reminder.priority);
        const priorityName = this.#getPriorityName(reminder.priority);
        const alertCount = reminder.alertTimings?.length || 0;

        return `
            <div class="reminder-item enhanced enhanced-reminder-item" data-id="${reminder.id}">
                <div class="reminder-alerts-indicator">${alertCount} alerts</div>
                
                <div class="reminder-details">
                    <div class="reminder-title-enhanced">
                        ${priorityIcon} ${this.#escapeHtml(reminder.title)}
                    </div>
                    
                    <div class="reminder-meta">
                        <span class="reminder-time">
                            <strong>Due:</strong> ${this.#formatReminderTime(reminder.datetime)}
                        </span>
                        <span class="reminder-created">
                            <strong>Storage:</strong> IndexedDB
                        </span>
                    </div>
                    
                    ${reminder.description ? `
                        <div class="reminder-description">
                            ${this.#escapeHtml(reminder.description)}
                        </div>
                    ` : ''}

                    ${alertCount > 0 ? `
                        <div class="reminder-alerts-preview">
                            ${reminder.alertTimings.map(minutes =>
            `<span class="alert-chip">${this.#formatTimingValue(minutes)}</span>`
        ).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="reminder-badges">
                    <span class="badge badge-priority-${priorityName}">
                        ${priorityName.toUpperCase()}
                    </span>
                    <span class="badge badge-category">
                        ${reminder.category.toUpperCase()}
                    </span>
                    <span class="badge badge-status-${reminder.status}">
                        ${reminder.status.toUpperCase()}
                    </span>
                </div>
                
                <div class="reminder-actions-enhanced">
                    ${reminder.status !== DashboardController.CONFIG.REMINDER_STATUS.COMPLETED ? `
                        <button class="action-btn-small action-btn-complete" 
                                data-id="${reminder.id}" 
                                title="Mark as complete">
                            ✅
                        </button>
                    ` : ''}
                    <button class="action-btn-small action-btn-edit" 
                            data-id="${reminder.id}" 
                            title="Edit alert settings">
                        ⚙️
                    </button>
                    <button class="action-btn-small action-btn-delete" 
                            data-id="${reminder.id}" 
                            title="Delete reminder">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state with contextual messages
     */
    #renderEmptyState(container) {
        const emptyStates = {
            all: { icon: '📝', title: 'No reminders in IndexedDB', message: 'Create your first reminder to get started!' },
            active: { icon: '🎉', title: 'No active reminders', message: 'All caught up! You have no active reminders.' },
            completed: { icon: '✅', title: 'No completed reminders', message: 'Complete some reminders to see them here.' },
            overdue: { icon: '🎯', title: 'No overdue reminders', message: 'Great job! You\'re all caught up.' }
        };

        const state = emptyStates[this.#state.currentFilter] || emptyStates.all;

        container.innerHTML = `
            <div class="empty-state-enhanced">
                <div class="empty-icon">${state.icon}</div>
                <h3>${state.title}</h3>
                <p>${state.message}</p>
                <button class="empty-state-action" onclick="dashboard.showAddReminderModal()">
                    ➕ Add Your First Reminder
                </button>
            </div>
        `;
    }

    /**
     * Render schedule items
     */
    #renderSchedule() {
        const container = document.getElementById('todaySchedule');
        if (!container) return;

        if (this.#schedule.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3>No schedule items</h3>
                    <p>Your schedule is clear for today!</p>
                </div>
            `;
            return;
        }

        const html = this.#schedule.map(item => `
            <div class="schedule-item">
                <div class="schedule-time">${item.time}</div>
                <div class="schedule-content">
                    <div class="schedule-title">${this.#escapeHtml(item.title)}</div>
                    <div class="schedule-description">${this.#escapeHtml(item.description)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Setup reminder action handlers with delegation
     */
    #setupReminderActionHandlers() {
        const actionHandlers = {
            'action-btn-complete': (btn) => this.completeReminder(parseInt(btn.dataset.id)),
            'action-btn-edit': (btn) => this.showAlertPreferencesModal(parseInt(btn.dataset.id)),
            'action-btn-delete': (btn) => this.deleteReminder(parseInt(btn.dataset.id))
        };

        Object.entries(actionHandlers).forEach(([className, handler]) => {
            document.querySelectorAll(`.${className}`).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handler(btn);
                });
            });
        });
    }

    /**
     * Update filter information display
     */
    #updateFilterInfo() {
        const filterInfo = document.getElementById('filterInfo');
        const filterText = document.getElementById('filterText');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');

        if (this.#state.currentFilter === 'all') {
            filterInfo?.style.setProperty('display', 'none');
            clearFiltersBtn?.style.setProperty('display', 'none');
        } else {
            filterInfo?.style.setProperty('display', 'flex');
            clearFiltersBtn?.style.setProperty('display', 'block');

            const filterNames = {
                active: 'Active Reminders',
                completed: 'Completed Reminders',
                overdue: 'Overdue Reminders'
            };

            if (filterText) {
                filterText.textContent = `Showing ${this.#state.filteredReminders.length} ${filterNames[this.#state.currentFilter]}`;
            }
        }

        // Update title
        const titleElement = document.getElementById('remindersTitle');
        if (titleElement) {
            const titles = {
                all: 'All Reminders',
                active: 'Active Reminders',
                completed: 'Completed Reminders',
                overdue: 'Overdue Reminders'
            };
            titleElement.textContent = titles[this.#state.currentFilter];
        }
    }

    /**
     * Update pagination controls
     */
    #updatePagination(totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');

        if (totalPages <= 1) {
            this.#hidePagination();
            return;
        }

        paginationContainer?.style.setProperty('display', 'flex');

        if (prevBtn) prevBtn.disabled = this.#state.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.#state.currentPage === totalPages;
        if (pageInfo) pageInfo.textContent = `Page ${this.#state.currentPage} of ${totalPages}`;
    }

    /**
     * Hide pagination controls
     */
    #hidePagination() {
        const container = document.getElementById('paginationContainer');
        container?.style.setProperty('display', 'none');
    }

    /**
     * Show add reminder modal
     */
    #showAddReminderModal() {
        const modal = document.getElementById('addReminderModal');
        if (!modal) return;

        const form = document.getElementById('addReminderForm');
        if (form) form.reset();

        // Set default datetime (1 hour from now)
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);
        const datetimeInput = document.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = defaultTime.toISOString().slice(0, 16);
        }

        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('reminderTitle')?.focus(), 100);
    }

    /**
     * Close modal by ID
     */
    #closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    /**
     * Handle form submission
     */
    #handleFormSubmit() {
        const form = document.getElementById('addReminderForm');
        const formData = new FormData(form);

        const selectedAlerts = Array.from(form.querySelectorAll('input[name="alertTiming"]:checked'))
            .map(input => parseInt(input.value));

        const reminderData = {
            title: formData.get('title'),
            description: formData.get('description'),
            datetime: formData.get('datetime'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            notification: formData.get('notification') === 'on',
            alertTimings: selectedAlerts
        };

        return this.createReminder(reminderData)
            .then(() => {
                this.#closeModal('addReminderModal');
            });
    }

    /**
     * Set quick time for reminder
     */
    #setQuickTime(button) {
        const minutes = parseInt(button.dataset.minutes) || 0;
        const hours = parseInt(button.dataset.hours) || 0;

        const now = new Date();
        now.setMinutes(now.getMinutes() + minutes);
        now.setHours(now.getHours() + hours);

        const datetimeInput = document.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = now.toISOString().slice(0, 16);
        }

        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    }

    /**
     * Create alert preferences modal
     */
    #createAlertPreferencesModal(currentTimings, isGlobal, reminderId) {
        const modal = document.createElement('div');
        modal.className = 'modal alert-preferences-modal';
        modal.style.display = 'none';

        const availableTimings = NotificationService.getAlertTimingOptions();
        const groupedTimings = this.#groupTimingsByCategory(availableTimings);

        modal.innerHTML = `
            <div class="modal-content enhanced">
                <div class="modal-header">
                    <h2>
                        <span class="label-icon">🔔</span>
                        ${isGlobal ? 'Default Alert Preferences (IndexedDB)' : 'Reminder Alert Settings'}
                    </h2>
                    <button class="close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="alert-preferences-intro">
                        <p>${isGlobal ?
            'Set your default alert timing preferences stored in IndexedDB. These will be applied to new reminders.' :
            'Customize when you want to be alerted for this specific reminder stored in IndexedDB.'
        }</p>
                    </div>

                    <form id="alertPreferencesForm">
                        ${Object.entries(groupedTimings).map(([category, timings]) => `
                            <div class="timing-category">
                                <h3 class="category-title">
                                    ${category.charAt(0).toUpperCase() + category.slice(1)} Alerts
                                    <span class="category-subtitle">(${timings.length} options)</span>
                                </h3>
                                
                                <div class="timing-options">
                                    ${timings.map(timing => `
                                        <label class="timing-option">
                                            <input 
                                                type="checkbox" 
                                                name="alertTiming" 
                                                value="${timing.value}"
                                                ${currentTimings.includes(timing.value) ? 'checked' : ''}
                                            >
                                            <div class="timing-card">
                                                <div class="timing-icon">${timing.icon}</div>
                                                <div class="timing-info">
                                                    <div class="timing-label">${timing.label}</div>
                                                    <div class="timing-value">${this.#formatTimingValue(timing.value)}</div>
                                                </div>
                                            </div>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}

                        <div class="alert-preview">
                            <h3>Selected Alerts Preview</h3>
                            <div id="selectedAlertsPreview" class="selected-alerts">
                                <!-- Dynamic content -->
                            </div>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn-cancel" onclick="this.closest('.modal').remove()">
                        Cancel
                    </button>
                    <button type="button" class="btn-test" onclick="dashboard.testAlertPreferences()">
                        🔔 Test Alerts
                    </button>
                    <button type="submit" form="alertPreferencesForm" class="btn-submit">
                        💾 Save to IndexedDB
                    </button>
                </div>
            </div>
        `;

        this.#setupAlertPreferencesHandlers(modal, isGlobal, reminderId);
        return modal;
    }

    /**
     * Setup alert preferences modal handlers
     */
    #setupAlertPreferencesHandlers(modal, isGlobal, reminderId) {
        const form = modal.querySelector('#alertPreferencesForm');
        const preview = modal.querySelector('#selectedAlertsPreview');

        const updatePreview = () => {
            const selected = Array.from(form.querySelectorAll('input[name="alertTiming"]:checked'))
                .map(input => parseInt(input.value))
                .sort((a, b) => a - b);

            if (selected.length === 0) {
                preview.innerHTML = '<p class="no-alerts">No alerts selected</p>';
                return;
            }

            preview.innerHTML = selected.map(minutes => {
                const timing = NotificationService.getAlertTimingOptions().find(t => t.value === minutes);
                return `
                    <div class="alert-preview-item">
                        <span class="preview-icon">${timing?.icon || '⏰'}</span>
                        <span class="preview-text">${timing?.label || `${minutes} minutes before`}</span>
                    </div>
                `;
            }).join('');
        };

        updatePreview();
        form.addEventListener('change', updatePreview);

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const selectedTimings = Array.from(form.querySelectorAll('input[name="alertTiming"]:checked'))
                .map(input => parseInt(input.value));

            if (selectedTimings.length === 0) {
                this.#showNotification('Please select at least one alert timing', 'warning');
                return;
            }

            if (isGlobal) {
                this.updateUserAlertPreferences({ defaultAlertTimings: selectedTimings });
            } else {
                this.updateReminderAlerts(reminderId, selectedTimings);
            }

            modal.remove();
        });
    }

    // === UTILITY METHODS ===

    /**
     * Group timings by category
     */
    #groupTimingsByCategory(timings) {
        return timings.reduce((groups, timing) => {
            const category = timing.category;
            if (!groups[category]) groups[category] = [];
            groups[category].push(timing);
            return groups;
        }, {});
    }

    /**
     * Format timing value for display
     */
    #formatTimingValue(minutes) {
        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
        return `${Math.round(minutes / 1440)}d`;
    }

    /**
     * Get priority icon
     */
    #getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    }

    /**
     * Get priority name
     */
    #getPriorityName(priority) {
        const names = { 1: 'low', 2: 'medium', 3: 'high', 4: 'urgent' };
        return names[priority] || 'unknown';
    }

    /**
     * Format reminder time with relative display
     */
    #formatReminderTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) {
            const days = Math.floor(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
            return days > 0 ? `Overdue by ${days} day${days > 1 ? 's' : ''}` : 'Overdue';
        }

        if (diffMs < 60 * 60 * 1000) {
            return `In ${Math.round(diffMs / 60000)}m`;
        }

        if (diffMs < 24 * 60 * 60 * 1000) {
            return `In ${Math.round(diffMs / 3600000)}h`;
        }

        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    /**
     * Format duration
     */
    #formatDuration(minutes) {
        if (minutes >= 1440) return `${Math.floor(minutes/1440)} day(s)`;
        if (minutes >= 60) return `${Math.floor(minutes/60)} hour(s)`;
        return `${minutes} minute(s)`;
    }

    /**
     * Escape HTML for security
     */
    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show notification with automatic dismissal
     */
    #showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 16px;
            border-radius: 6px; color: white; font-weight: 500; z-index: 10000;
            max-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%); transition: transform 0.3s ease;
        `;

        const colors = { success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        document.body.appendChild(notification);
        requestAnimationFrame(() => notification.style.transform = 'translateX(0)');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, type === 'error' ? 5000 : 3000);
    }
}