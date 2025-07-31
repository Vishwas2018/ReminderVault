/**
 * DashboardController - Fixed with proper private field declarations
 * Modern implementation with comprehensive cleanup and error handling
 */
import { NotificationService } from './NotificationService.js';
import { StorageFactory } from './StorageFactory.js';

export class DashboardController {
    // Core data state
    #reminders = [];
    #schedule = [];
    #currentUser = null;

    // Service instances
    #notificationService = null;
    #storageService = null;

    // Application state
    #state = {
        currentFilter: 'all',
        currentPage: 1,
        sortBy: 'datetime',
        filteredReminders: [],
        isLoading: false,
        lastSync: null,
        storageType: 'detecting'
    };

    // Event management and cleanup tracking
    #eventCleanupFunctions = new Set();
    #refreshInterval = null;
    #visibilityChangeHandler = null;
    #beforeUnloadHandler = null;

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
        DEFAULT_ALERT_TIMINGS: Object.freeze([5, 15])
    });

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
            }
        ],
        schedule: [
            { id: 1, time: '09:00', title: 'Daily standup', description: 'Team sync meeting' },
            { id: 2, time: '11:30', title: 'Client presentation', description: 'Present new features' }
        ]
    });

    constructor() {
        this.#notificationService = new NotificationService();
        this.#setupNotificationHandlers();
    }

    // === PUBLIC API METHODS ===

    async initialize() {
        try {
            console.log('🚀 Initializing dashboard with intelligent storage selection...');
            this.#setLoadingState(true);

            if (!this.#checkAuthentication()) return false;

            await this.#initializeStorage();
            await this.#notificationService.initialize();
            await this.#loadData();

            this.#setupEventHandlers();
            this.#startAutoRefresh();
            this.#render();

            this.#setLoadingState(false);
            console.log('✅ Dashboard initialized with ${this.#state.storageType} storage');
            return true;
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.#setLoadingState(false);
            this.#showStorageError(error);
            return false;
        }
    }

    async showDatabaseInfo() {
        try {
            const dbInfo = await this.#storageService.getDatabaseInfo();
            const stats = await this.#getNotificationStats();

            const message = this.#formatDatabaseInfoMessage(dbInfo, stats);
            alert(message);
        } catch (error) {
            console.error('Failed to show database info:', error);
            alert('Failed to get database information: ${error.message}');
        }
    }

    getStorageType() {
        return this.#state.storageType;
    }

    showAddReminderModal() {
        this.#showAddReminderModal();
    }

    showAlertPreferencesModal() {
        this.#showNotification('Alert preferences modal will be implemented in the next update', 'info');
    }

    async createReminder(reminderData) {
        try {
            this.#validateReminderData(reminderData);

            const processedReminder = this.#processReminderData(reminderData);
            const savedReminder = await this.#storageService.saveReminder(processedReminder);

            this.#reminders = [...this.#reminders, savedReminder];
            this.#scheduleNotificationForReminder(savedReminder);

            this.#refreshView();
            this.#showNotification('Reminder saved successfully!', 'success');
            return savedReminder;
        } catch (error) {
            console.error('Failed to create reminder:', error);
            this.#showNotification(error.message, 'error');
            throw error;
        }
    }

    async completeReminder(reminderId) {
        try {
            const reminder = this.#findReminder(reminderId);
            if (!reminder) {
                this.#showNotification('Reminder not found', 'error');
                return;
            }

            await this.#updateReminderStatus(reminder, DashboardController.CONFIG.REMINDER_STATUS.COMPLETED);
            this.#notificationService.cancelNotification(reminderId);
            this.#showNotification('"${reminder.title}" completed!', 'success');
        } catch (error) {
            console.error('Failed to complete reminder:', error);
            this.#showNotification('Failed to complete reminder', 'error');
        }
    }

    async snoozeReminder(reminderId, minutes) {
        try {
            const reminder = this.#findReminder(reminderId);
            if (!reminder) {
                this.#showNotification('Reminder not found', 'error');
                return;
            }

            const newDateTime = new Date(Date.now() + minutes * 60 * 1000);
            const updates = {
                datetime: newDateTime.toISOString(),
                status: DashboardController.CONFIG.REMINDER_STATUS.ACTIVE,
                updatedAt: new Date().toISOString()
            };

            await this.#updateReminderWithChanges(reminder, updates);
            this.#rescheduleNotifications(reminder);

            const timeText = this.#formatDuration(minutes);
            this.#showNotification('"${reminder.title}" snoozed for ${timeText}', 'success');
        } catch (error) {
            console.error('Failed to snooze reminder:', error);
            this.#showNotification('Failed to snooze reminder', 'error');
        }
    }

    async exportData() {
        try {
            const userId = this.#getCurrentUserId();
            const exportData = await this.#storageService.exportAllData(userId);

            this.#enhanceExportData(exportData);
            this.#downloadAsFile(exportData, 'json');

            this.#showNotification('Data exported from ${this.#state.storageType}!', 'success');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.#showNotification('Failed to export data', 'error');
        }
    }

    async importData() {
        try {
            const file = await this.#selectImportFile();
            if (!file) return;

            const importData = await this.#parseImportFile(file);
            this.#validateImportData(importData);

            const userId = this.#getCurrentUserId();
            const results = await this.#storageService.importData(importData, userId);

            await this.#loadData();
            this.#refreshView();

            this.#showNotification(
                'Imported ${results.length} reminders to ${this.#state.storageType}!',
                'success'
            );
        } catch (error) {
            console.error('Failed to import data:', error);
            this.#showNotification('Import failed: ${error.message}', 'error');
        }
    }

    async clearAllData() {
        const confirmMessage = '⚠️ This will permanently delete ALL your reminders from ${this.#state.storageType}. This cannot be undone!\n\nAre you absolutely sure?';

        if (!confirm(confirmMessage)) return;

        try {
            const userId = this.#getCurrentUserId();
            const deletedCount = await this.#storageService.clearUserData(userId);

            this.#reminders = [];
            this.#notificationService?.cleanup();
            this.#refreshView();

            this.#showNotification('Cleared ${deletedCount} reminders from ${this.#state.storageType}', 'success');
        } catch (error) {
            console.error('Failed to clear data:', error);
            this.#showNotification('Failed to clear data', 'error');
        }
    }

    testNotificationSystem() {
        const testReminder = this.#createTestReminder();
        const scheduledCount = this.#notificationService.scheduleNotification(testReminder, testReminder.alertTimings);
        this.#notificationService.testNotification();

        this.#showNotification(
            'Test system activated! ${scheduledCount} alerts scheduled with ${this.#state.storageType} data.',
            'info'
        );
    }

    setFilter(filter) {
        this.#state.currentFilter = filter;
        this.#state.currentPage = 1;
        this.#applyFilters();
        this.#render();
    }

    refresh() {
        this.#loadData()
            .then(() => this.#showNotification('Dashboard refreshed from ${this.#state.storageType}!', 'success'))
            .catch(error => {
                console.error('Failed to refresh:', error);
                this.#showNotification('Failed to refresh data', 'error');
            });
    }

    logout() {
        if (!confirm('Are you sure you want to logout?')) return;

        this.#cleanup();
        this.#clearSessionData();
        this.#showNotification('Logged out successfully', 'success');

        setTimeout(() => window.location.href = 'login.html', 1000);
    }

    // === PRIVATE IMPLEMENTATION METHODS ===

    async #initializeStorage() {
        try {
            const userId = this.#getCurrentUserId();
            this.#storageService = await StorageFactory.getInstance(userId);
            this.#state.storageType = await this.#detectStorageType();

            console.log('📦 Storage initialized: ${this.#state.storageType}');
            this.#updateStorageIndicator();
        } catch (error) {
            console.error('Storage initialization failed:', error);
            throw new Error('Storage unavailable: ${error.message}');
        }
    }

    async #detectStorageType() {
        try {
            const dbInfo = await this.#storageService.getDatabaseInfo();

            const typeMapping = {
                'RemindersVaultDB': 'IndexedDB',
                'localStorage': 'localStorage',
                'Memory Storage': 'Memory'
            };

            return typeMapping[dbInfo.name] ||
                this.#inferTypeFromConstructor() ||
                'Unknown';
        } catch (error) {
            console.warn('Storage type detection failed:', error);
            return 'Unknown';
        }
    }

    #inferTypeFromConstructor() {
        const constructorName = this.#storageService.constructor.name;
        if (constructorName.includes('IndexedDB')) return 'IndexedDB';
        if (constructorName.includes('Fallback')) return 'localStorage';
        if (constructorName.includes('Memory')) return 'Memory';
        return null;
    }

    #setupNotificationHandlers() {
        this.#cleanupNotificationHandlers();

        const handlers = new Map([
            ['notification:check-due-reminders', () => this.#notificationService.checkDueReminders(this.#reminders)],
            ['notification:reminder-complete', (e) => this.completeReminder(e.detail.reminderId)],
            ['notification:reminder-snooze', (e) => this.snoozeReminder(e.detail.reminderId, e.detail.minutes)]
        ]);

        handlers.forEach((handler, event) => {
            document.addEventListener(event, handler);
            this.#eventCleanupFunctions.add(() => document.removeEventListener(event, handler));
        });
    }

    #cleanupNotificationHandlers() {
        this.#eventCleanupFunctions.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.warn('Event cleanup error:', error);
            }
        });
        this.#eventCleanupFunctions.clear();
    }

    #processReminderData(reminderData) {
        const alertTimings = this.#processAlertTimings(reminderData.alertTimings);
        const userId = this.#getCurrentUserId();

        return {
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
    }

    #scheduleNotificationForReminder(reminder) {
        if (reminder.notification && reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE) {
            const scheduledCount = this.#notificationService.scheduleNotification(reminder, reminder.alertTimings);
            console.log('📅 Scheduled ${scheduledCount} alerts for reminder: ${reminder.title}');
        }
    }

    async #updateReminderStatus(reminder, status) {
        const originalStatus = reminder.status;
        reminder.status = status;
        reminder.updatedAt = new Date().toISOString();

        this.#refreshView();

        try {
            if (this.#storageService?.updateReminder) {
                await this.#storageService.updateReminder(reminder.id, {
                    status,
                    updatedAt: reminder.updatedAt
                });
            }
        } catch (error) {
            // Rollback on failure
            reminder.status = originalStatus;
            this.#refreshView();
            throw error;
        }
    }

    async #updateReminderWithChanges(reminder, updates) {
        if (this.#storageService?.updateReminder) {
            await this.#storageService.updateReminder(reminder.id, updates);
        }
        Object.assign(reminder, updates);
        this.#refreshView();
    }

    #rescheduleNotifications(reminder) {
        this.#notificationService.cancelNotification(reminder.id);
        this.#notificationService.scheduleNotification(reminder, reminder.alertTimings);
    }

    #createTestReminder() {
        return {
            id: 99999,
            title: 'Test ${this.#state.storageType} System',
            description: 'Testing the enhanced notification system with ${this.#state.storageType} storage',
            datetime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            priority: 3,
            category: 'personal',
            alertTimings: [5, 15]
        };
    }

    #enhanceExportData(exportData) {
        exportData.exportMetadata = {
            storageType: this.#state.storageType,
            exportedAt: new Date().toISOString(),
            appVersion: '2.0',
            compatibility: ['IndexedDB', 'localStorage', 'Memory']
        };
    }

    #downloadAsFile(data, format) {
        const filename = 'reminders-${this.#state.storageType.toLowerCase()}-export-${new Date().toISOString().split('T')[0]}.${format}';
        const mimeType = format === 'json' ? 'application/json' : 'text/plain';

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async #selectImportFile() {
        return new Promise(resolve => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.onchange = e => resolve(e.target.files[0]);
            fileInput.click();
        });
    }

    async #parseImportFile(file) {
        const text = await file.text();
        return JSON.parse(text);
    }

    #startAutoRefresh() {
        // Clear any existing interval
        if (this.#refreshInterval) {
            clearInterval(this.#refreshInterval);
        }

        this.#refreshInterval = setInterval(() => {
            this.#updateDateTime();
            this.#updateOverdueReminders();
        }, DashboardController.CONFIG.AUTO_REFRESH_INTERVAL);

        // Enhanced visibility change handler
        this.#visibilityChangeHandler = () => {
            if (!document.hidden) {
                console.log('📱 Page visible - checking for updates...');
                this.#updateOverdueReminders();
            }
        };

        this.#beforeUnloadHandler = () => this.#cleanup();

        document.addEventListener('visibilitychange', this.#visibilityChangeHandler);
        window.addEventListener('beforeunload', this.#beforeUnloadHandler);

        // Track cleanup functions
        this.#eventCleanupFunctions.add(() => {
            if (this.#refreshInterval) {
                clearInterval(this.#refreshInterval);
                this.#refreshInterval = null;
            }
        });

        this.#eventCleanupFunctions.add(() => {
            if (this.#visibilityChangeHandler) {
                document.removeEventListener('visibilitychange', this.#visibilityChangeHandler);
                this.#visibilityChangeHandler = null;
            }
        });

        this.#eventCleanupFunctions.add(() => {
            if (this.#beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this.#beforeUnloadHandler);
                this.#beforeUnloadHandler = null;
            }
        });
    }

    #cleanup() {
        console.log('🧹 Starting comprehensive dashboard cleanup...');

        try {
            this.#notificationService?.cleanup();
        } catch (error) {
            console.warn('Notification service cleanup error:', error);
        }

        if (this.#storageService?.close) {
            this.#storageService.close().catch(error => {
                console.warn('Storage cleanup warning:', error.message);
            });
        }

        // Clear all intervals and handlers
        this.#cleanupNotificationHandlers();

        // Clear state references for GC
        this.#reminders = [];
        this.#schedule = [];
        this.#state.filteredReminders = [];

        console.log('✅ Dashboard cleanup completed');
    }

    // === UTILITY HELPER METHODS ===

    #formatDuration(minutes) {
        if (minutes >= 1440) {
            const days = Math.floor(minutes / 1440);
            return '${days} day${days > 1 ? 's' : ''}';
        }
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            return '${hours} hour${hours > 1 ? 's' : ''}';
        }
        return '${minutes} minute${minutes > 1 ? 's' : ''}';
    }

    #formatDatabaseInfoMessage(dbInfo, stats) {
        let message = 'Storage Information:\n\n';
        message += 'Type: ${this.#state.storageType}\n';
        message += 'Database: ${dbInfo.name || 'N/A'}\n';
        message += 'Version: ${dbInfo.version || 'N/A'}\n';

        if (dbInfo.storageEstimate) {
            message += '\nStorage Usage:\n';
            message += 'Used: ${dbInfo.storageEstimate.usage}\n';
            message += 'Available: ${dbInfo.storageEstimate.available}\n';
            message += 'Total: ${dbInfo.storageEstimate.quota}\n';
            message += 'Usage: ${dbInfo.storageEstimate.usagePercentage}%\n';
        }

        message += '\nStatistics:\n';
        message += '- Total Reminders: ${stats.totalReminders || 0}\n';
        message += '- Active: ${stats.active || 0}\n';
        message += '- Completed: ${stats.completed || 0}\n';
        message += '- Overdue: ${stats.overdue || 0}\n';

        return message;
    }

    // [Include other essential helper methods from the previous implementation]
    // Note: This is a condensed version showing the key structural fixes
    // The full implementation would include all rendering, validation, and utility methods
}