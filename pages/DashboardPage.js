/**
 * Complete DashboardController Implementation
 * Modern, production-ready dashboard with intelligent storage selection
 */

import { NotificationService } from '../core/services/NotificationService.js';
import { StorageFactory } from '../core/storage/StorageFactory.js';
import { DateUtils, StringUtils, AsyncUtils, BrowserUtils } from '../utils/helpers.js';

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
                datetime: () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                category: 'work',
                priority: 3,
                status: 'active',
                notification: true,
                alertTimings: [15, 60]
            },
            {
                title: 'Test Multi-Alert Notification',
                description: 'This reminder will trigger multiple alerts for testing',
                datetime: () => new Date(Date.now() + 10 * 60 * 1000).toISOString(),
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
            console.log(`✅ Dashboard initialized with ${this.#state.storageType} storage`);
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
            alert(`Failed to get database information: ${error.message}`);
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
            this.#showNotification(`"${reminder.title}" completed!`, 'success');
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
            this.#showNotification(`"${reminder.title}" snoozed for ${timeText}`, 'success');
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

            this.#showNotification(`Data exported from ${this.#state.storageType}!`, 'success');
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
                `Imported ${results} reminders to ${this.#state.storageType}!`,
                'success'
            );
        } catch (error) {
            console.error('Failed to import data:', error);
            this.#showNotification(`Import failed: ${error.message}`, 'error');
        }
    }

    async clearAllData() {
        const confirmMessage = `⚠️ This will permanently delete ALL your reminders from ${this.#state.storageType}. This cannot be undone!\n\nAre you absolutely sure?`;

        if (!confirm(confirmMessage)) return;

        try {
            const userId = this.#getCurrentUserId();
            const deletedCount = await this.#storageService.clearUserData(userId);

            this.#reminders = [];
            this.#notificationService?.cleanup();
            this.#refreshView();

            this.#showNotification(`Cleared ${deletedCount} reminders from ${this.#state.storageType}`, 'success');
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
            `Test system activated! ${scheduledCount} alerts scheduled with ${this.#state.storageType} data.`,
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
            .then(() => this.#showNotification(`Dashboard refreshed from ${this.#state.storageType}!`, 'success'))
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

    async deleteReminder(id) {
        try {
            const reminder = this.#findReminder(id);
            if (!reminder) {
                this.#showNotification('Reminder not found', 'error');
                return;
            }

            if (!confirm(`Delete "${reminder.title}"?`)) return;

            // Remove from storage
            if (this.#storageService?.deleteReminder) {
                await this.#storageService.deleteReminder(id);
            }

            // Remove from local array
            this.#reminders = this.#reminders.filter(r => r.id !== id);

            // Cancel notifications
            this.#notificationService.cancelNotification(id);

            this.#refreshView();
            this.#showNotification('Reminder deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete reminder:', error);
            this.#showNotification('Failed to delete reminder', 'error');
        }
    }

    // === PRIVATE IMPLEMENTATION METHODS ===

    async #initializeStorage() {
        try {
            const userId = this.#getCurrentUserId();
            this.#storageService = await StorageFactory.getInstance(userId);
            this.#state.storageType = await this.#detectStorageType();

            console.log(`📦 Storage initialized: ${this.#state.storageType}`);
            this.#updateStorageIndicator();
        } catch (error) {
            console.error('Storage initialization failed:', error);
            throw new Error(`Storage unavailable: ${error.message}`);
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
        if (constructorName.includes('LocalStorage')) return 'localStorage';
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

    async #loadData() {
        try {
            const userId = this.#getCurrentUserId();

            // Load reminders from storage
            if (this.#storageService?.getReminders) {
                const result = await this.#storageService.getReminders(userId);
                this.#reminders = Array.isArray(result) ? result : result.reminders || [];
            }

            // If no data exists, load sample data
            if (this.#reminders.length === 0) {
                await this.#loadSampleData(userId);
            }

            // Load schedule
            this.#schedule = [...DashboardController.SAMPLE_DATA.schedule];

            // Apply current filters
            this.#applyFilters();

            // Schedule notifications for active reminders
            this.#scheduleAllNotifications();

            this.#state.lastSync = new Date();
            console.log(`📊 Loaded ${this.#reminders.length} reminders from ${this.#state.storageType}`);

        } catch (error) {
            console.error('Failed to load data:', error);
            this.#showNotification('Failed to load reminders', 'error');
        }
    }

    async #loadSampleData(userId) {
        try {
            const sampleReminders = DashboardController.SAMPLE_DATA.reminders.map(template => ({
                ...template,
                id: this.#generateId(),
                datetime: typeof template.datetime === 'function' ? template.datetime() : template.datetime,
                userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));

            for (const reminder of sampleReminders) {
                if (this.#storageService?.saveReminder) {
                    await this.#storageService.saveReminder(reminder);
                }
                this.#reminders.push(reminder);
            }

            console.log(`📝 Loaded ${sampleReminders.length} sample reminders`);
        } catch (error) {
            console.warn('Failed to load sample data:', error);
        }
    }

    #scheduleAllNotifications() {
        this.#reminders
            .filter(r => r.notification && r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE)
            .forEach(reminder => {
                this.#scheduleNotificationForReminder(reminder);
            });
    }

    #processReminderData(reminderData) {
        const alertTimings = this.#processAlertTimings(reminderData.alertTimings);
        const userId = this.#getCurrentUserId();

        return {
            id: this.#generateId(),
            title: reminderData.title.trim(),
            description: reminderData.description?.trim() || '',
            datetime: reminderData.datetime,
            category: reminderData.category || 'personal',
            priority: parseInt(reminderData.priority) || 2,
            notification: reminderData.notification !== false,
            alertTimings,
            status: this.#calculateStatus(reminderData.datetime),
            userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    #processAlertTimings(alertTimings) {
        if (!Array.isArray(alertTimings)) {
            return DashboardController.CONFIG.DEFAULT_ALERT_TIMINGS;
        }

        return alertTimings
            .map(timing => parseInt(timing))
            .filter(timing => !isNaN(timing) && timing > 0)
            .sort((a, b) => a - b);
    }

    #calculateStatus(datetime) {
        const now = new Date();
        const reminderTime = new Date(datetime);

        return reminderTime <= now
            ? DashboardController.CONFIG.REMINDER_STATUS.OVERDUE
            : DashboardController.CONFIG.REMINDER_STATUS.ACTIVE;
    }

    #scheduleNotificationForReminder(reminder) {
        if (reminder.notification && reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE) {
            const scheduledCount = this.#notificationService.scheduleNotification(reminder, reminder.alertTimings);
            console.log(`📅 Scheduled ${scheduledCount} alerts for reminder: ${reminder.title}`);
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

    #render() {
        this.#renderStatistics();
        this.#renderReminders();
        this.#renderSchedule();
        this.#updateCurrentDateTime();
    }

    #renderStatistics() {
        const stats = this.#calculateStatistics();

        this.#updateElementText('totalReminders', stats.total);
        this.#updateElementText('activeReminders', stats.active);
        this.#updateElementText('completedToday', stats.completed);
        this.#updateElementText('overdue', stats.overdue);
    }

    #calculateStatistics() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return {
            total: this.#reminders.length,
            active: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE).length,
            completed: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.COMPLETED).length,
            overdue: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.OVERDUE).length
        };
    }

    #renderReminders() {
        const container = document.getElementById('remindersList');
        if (!container) return;

        if (this.#state.filteredReminders.length === 0) {
            container.innerHTML = this.#createEmptyState();
            return;
        }

        const reminderItems = this.#state.filteredReminders.map(reminder =>
            this.#createReminderElement(reminder)
        ).join('');

        container.innerHTML = reminderItems;
    }

    #createReminderElement(reminder) {
        const priorityIcon = this.#getPriorityIcon(reminder.priority);
        const statusClass = this.#getStatusClass(reminder.status);
        const formattedTime = this.#formatDateTime(reminder.datetime);

        return `
            <div class="reminder-item ${statusClass}" data-id="${reminder.id}">
                <div class="reminder-status ${reminder.status}"></div>
                <div class="reminder-content">
                    <div class="reminder-title">
                        ${priorityIcon} ${StringUtils.escapeHtml(reminder.title)}
                    </div>
                    <div class="reminder-time">${formattedTime}</div>
                    ${reminder.description ? `<div class="reminder-description">${StringUtils.escapeHtml(reminder.description)}</div>` : ''}
                </div>
                <div class="reminder-actions">
                    ${reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE ? `
                        <button class="action-btn-small action-btn-complete" onclick="dashboard.completeReminder('${reminder.id}')" title="Complete">
                            ✅
                        </button>
                    ` : ''}
                    <button class="action-btn-small action-btn-delete" onclick="dashboard.deleteReminder('${reminder.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    #createEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>No reminders found</h3>
                <p>Create your first reminder to get started!</p>
            </div>
        `;
    }

    #renderSchedule() {
        const container = document.getElementById('todaySchedule');
        if (!container) return;

        if (this.#schedule.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No schedule items for today</p></div>';
            return;
        }

        const scheduleItems = this.#schedule.map(item => `
            <div class="schedule-item">
                <div class="schedule-time">${item.time}</div>
                <div class="schedule-content">
                    <div class="schedule-title">${StringUtils.escapeHtml(item.title)}</div>
                    <div class="schedule-description">${StringUtils.escapeHtml(item.description)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = scheduleItems;
    }

    #applyFilters() {
        let filtered = [...this.#reminders];

        // Apply status filter
        if (this.#state.currentFilter !== 'all') {
            filtered = filtered.filter(r => r.status === this.#state.currentFilter);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.#state.sortBy) {
                case 'priority':
                    return (b.priority || 2) - (a.priority || 2);
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'datetime':
                default:
                    return new Date(a.datetime) - new Date(b.datetime);
            }
        });

        this.#state.filteredReminders = filtered;
        this.#updateFilterDisplay();
    }

    #updateFilterDisplay() {
        const filterInfo = document.getElementById('filterInfo');
        const filterText = document.getElementById('filterText');
        const remindersTitle = document.getElementById('remindersTitle');

        if (this.#state.currentFilter === 'all') {
            filterInfo?.style.setProperty('display', 'none');
            if (remindersTitle) remindersTitle.textContent = 'All Reminders';
        } else {
            filterInfo?.style.setProperty('display', 'flex');
            if (filterText) {
                filterText.textContent = `Showing ${this.#state.currentFilter} reminders (${this.#state.filteredReminders.length})`;
            }
            if (remindersTitle) {
                remindersTitle.textContent = `${this.#capitalizeFirst(this.#state.currentFilter)} Reminders`;
            }
        }
    }

    #setupEventHandlers() {
        // Clear filter button
        const clearFilterBtn = document.getElementById('clearFilterBtn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => this.setFilter('all'));
        }

        // Sort selector
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.#state.sortBy = e.target.value;
                this.#applyFilters();
                this.#render();
            });
        }

        // Refresh button
        const refreshRemindersBtn = document.getElementById('refreshRemindersBtn');
        if (refreshRemindersBtn) {
            refreshRemindersBtn.addEventListener('click', () => this.refresh());
        }
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

    #updateOverdueReminders() {
        let hasUpdates = false;
        const now = new Date();

        this.#reminders.forEach(reminder => {
            if (reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) <= now) {
                reminder.status = DashboardController.CONFIG.REMINDER_STATUS.OVERDUE;
                hasUpdates = true;
            }
        });

        if (hasUpdates) {
            this.#refreshView();
        }
    }

    #updateCurrentDateTime() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const now = new Date();
            dateElement.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
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

    #setLoadingState(isLoading) {
        this.#state.isLoading = isLoading;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = isLoading ? 'flex' : 'none';
        }
    }

    #showStorageError(error) {
        const errorMessage = error.message.includes('Storage')
            ? 'Storage system unavailable. Please check your browser settings.'
            : 'Application failed to start. Please refresh the page.';

        alert(`Storage Error: ${errorMessage}`);
    }

    #checkAuthentication() {
        const session = localStorage.getItem('user_session');
        if (!session) {
            console.warn('No authentication session found');
            window.location.href = 'login.html';
            return false;
        }

        try {
            this.#currentUser = JSON.parse(session);
            return true;
        } catch (error) {
            console.error('Invalid session data:', error);
            localStorage.removeItem('user_session');
            window.location.href = 'login.html';
            return false;
        }
    }

    #getCurrentUserId() {
        return this.#currentUser?.username || 'default-user';
    }

    #clearSessionData() {
        localStorage.removeItem('user_session');
        localStorage.removeItem('last_login');
    }

    #refreshView() {
        this.#applyFilters();
        this.#render();
    }

    #findReminder(id) {
        return this.#reminders.find(r => r.id === id);
    }

    #validateReminderData(data) {
        if (!data.title?.trim()) {
            throw new Error('Title is required');
        }
        if (!data.datetime) {
            throw new Error('Date and time is required');
        }
        if (new Date(data.datetime) <= new Date()) {
            throw new Error('Date and time must be in the future');
        }
    }

    #generateId() {
        return StringUtils.generateUUID();
    }

    #showNotification(message, type = 'info') {
        // Use the notification system from components
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    #updateStorageIndicator() {
        const indicator = document.getElementById('storageIndicator');
        if (!indicator) return;

        indicator.textContent = `💾 ${this.#state.storageType}`;
        indicator.className = `storage-indicator ${this.#state.storageType.toLowerCase()}`;

        // Update storage info section
        const storageTitle = document.getElementById('storageTitle');
        const storageDescription = document.getElementById('storageDescription');

        if (storageTitle) {
            storageTitle.textContent = `${this.#state.storageType} Storage Active`;
        }

        if (storageDescription) {
            const descriptions = {
                'IndexedDB': 'Using browser IndexedDB for optimal performance and large storage capacity.',
                'localStorage': 'Using localStorage fallback for compatibility. Limited storage capacity.',
                'Memory': 'Using memory storage. Data will be lost when you close this tab.',
                'Unknown': 'Storage type could not be determined.'
            };
            storageDescription.textContent = descriptions[this.#state.storageType] || descriptions['Unknown'];
        }

        // Show warning for memory storage
        const storageWarning = document.getElementById('storageWarning');
        if (storageWarning) {
            if (this.#state.storageType === 'Memory') {
                storageWarning.classList.add('show');
            } else {
                storageWarning.classList.remove('show');
            }
        }
    }

    async #getNotificationStats() {
        try {
            return this.#notificationService?.getNotificationStats() || {
                totalScheduled: 0,
                activeReminders: 0,
                alertHistory: 0,
                permissionState: 'unknown'
            };
        } catch (error) {
            console.warn('Failed to get notification stats:', error);
            return { error: error.message };
        }
    }

    #formatDatabaseInfoMessage(dbInfo, notificationStats) {
        let message = `📊 Storage Information\n\n`;

        message += `Type: ${dbInfo.type || 'Unknown'}\n`;
        message += `Name: ${dbInfo.name || 'Unknown'}\n`;

        if (dbInfo.version) {
            message += `Version: ${dbInfo.version}\n`;
        }

        if (dbInfo.size) {
            message += `Size: ${dbInfo.size}\n`;
        }

        if (dbInfo.storageEstimate) {
            message += `\nStorage Usage:\n`;
            message += `• Used: ${dbInfo.storageEstimate.usage}\n`;
            message += `• Available: ${dbInfo.storageEstimate.available}\n`;
            message += `• Usage: ${dbInfo.storageEstimate.usagePercentage}%\n`;
        }

        message += `\n🔔 Notification System:\n`;
        message += `• Scheduled Alerts: ${notificationStats.totalScheduled || 0}\n`;
        message += `• Active Reminders: ${notificationStats.activeReminders || 0}\n`;
        message += `• Permission: ${notificationStats.permissionState || 'unknown'}\n`;

        message += `\n📈 Current Session:\n`;
        message += `• Total Reminders: ${this.#reminders.length}\n`;
        message += `• Last Sync: ${this.#state.lastSync ? DateUtils.formatDate(this.#state.lastSync) : 'Never'}\n`;

        return message;
    }

    #enhanceExportData(exportData) {
        exportData.metadata = {
            ...exportData.metadata,
            exportedBy: this.#getCurrentUserId(),
            storageType: this.#state.storageType,
            browserInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            },
            totalReminders: this.#reminders.length,
            activeReminders: this.#reminders.filter(r => r.status === 'active').length
        };
    }

    #downloadAsFile(data, format = 'json') {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `reminders-vault-backup-${timestamp}.${format}`;

        let content, mimeType;

        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
        } else if (format === 'csv') {
            content = this.#convertToCSV(data.data.reminders);
            mimeType = 'text/csv';
        }

        BrowserUtils.downloadFile(content, filename, mimeType);
    }

    #convertToCSV(reminders) {
        if (!reminders || reminders.length === 0) return '';

        const headers = ['Title', 'Description', 'DateTime', 'Category', 'Priority', 'Status', 'Created'];
        const rows = reminders.map(r => [
            r.title || '',
            r.description || '',
            r.datetime || '',
            r.category || '',
            r.priority || '',
            r.status || '',
            r.createdAt || ''
        ]);

        return [headers, ...rows].map(row =>
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    async #selectImportFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.csv';

            input.onchange = (e) => {
                const file = e.target.files[0];
                resolve(file);
            };

            input.oncancel = () => resolve(null);
            input.click();
        });
    }

    async #parseImportFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    const data = JSON.parse(content);
                    resolve(data);
                } catch (error) {
                    reject(new Error(`Failed to parse import file: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    #validateImportData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid import file format');
        }

        if (!data.data || !Array.isArray(data.data.reminders)) {
            throw new Error('Import file must contain reminders array');
        }

        // Basic validation of reminder structure
        data.data.reminders.forEach((reminder, index) => {
            if (!reminder.title) {
                throw new Error(`Reminder at index ${index} is missing title`);
            }
            if (!reminder.datetime) {
                throw new Error(`Reminder at index ${index} is missing datetime`);
            }
        });
    }

    #createTestReminder() {
        return {
            id: this.#generateId(),
            title: 'Test Notification System',
            description: 'This is a test reminder to verify the notification system is working correctly.',
            datetime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
            category: 'personal',
            priority: 3,
            status: 'active',
            notification: true,
            alertTimings: [1, 2, 5], // 1, 2, and 5 minutes before
            userId: this.#getCurrentUserId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    #formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }

    #getPriorityIcon(priority) {
        const icons = {
            1: '🔵', // Low
            2: '🟡', // Medium
            3: '🟠', // High
            4: '🔴'  // Urgent
        };
        return icons[priority] || '⚪';
    }

    #getStatusClass(status) {
        return `status-${status}`;
    }

    #formatDateTime(datetime) {
        return DateUtils.formatDate(datetime);
    }

    #updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    #capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    #updateDateTime() {
        this.#updateCurrentDateTime();
    }

    #showAddReminderModal() {
        const modal = document.getElementById('addReminderModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // Public method for debugging and testing
    debug() {
        return {
            reminders: this.#reminders.length,
            filteredReminders: this.#state.filteredReminders.length,
            currentFilter: this.#state.currentFilter,
            sortBy: this.#state.sortBy,
            storageType: this.#state.storageType,
            currentUser: this.#currentUser,
            lastSync: this.#state.lastSync,
            notificationService: !!this.#notificationService,
            storageService: !!this.#storageService
        };
    }

    // Health check method
    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            dashboard: true,
            storage: false,
            notifications: false,
            errors: []
        };

        try {
            if (this.#storageService) {
                const storageHealth = await this.#storageService.getDatabaseInfo();
                health.storage = !!storageHealth;
            }
        } catch (error) {
            health.errors.push(`Storage: ${error.message}`);
        }

        try {
            if (this.#notificationService) {
                const notifStats = await this.#getNotificationStats();
                health.notifications = !notifStats.error;
            }
        } catch (error) {
            health.errors.push(`Notifications: ${error.message}`);
        }

        return health;
    }
}