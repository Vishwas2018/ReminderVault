/**
 * Complete DashboardController Implementation
 * Modern, production-ready dashboard with intelligent storage selection
 */

import { NotificationService } from '../core/services/NotificationService.js';
import { StorageFactory } from '../core/storage/StorageFactory.js';

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
                        ${priorityIcon} ${this.#escapeHtml(reminder.title)}
                    </div>
                    <div class="reminder-time">${formattedTime}</div>
                    ${reminder.description ? `<div class="reminder-description">${this.#escapeHtml(reminder.description)}</div>` : ''}
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
                    <div class="schedule-title">${this.#escapeHtml(item.title)}</div>
                    <div class="schedule-description">${this.#escapeHtml(item.description)}</div>
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
        // Additional loading state UI updates can be added here
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

    #validateImportData(data) {
        if (!data || !data.data || !Array.isArray(data.data.reminders)) {
            throw new Error('Invalid import data format');
        }
    }

    #createTestReminder() {
        return {
            id: 99999,
            title: `Test ${this.#state.storageType} System`,
            description: `Testing the enhanced notification system with ${this.#state.storageType} storage`,
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
        const filename = `reminders-${this.#state.storageType.toLowerCase()}-export-${new Date().toISOString().split('T')[0]}.${format}`;
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

    #formatDuration(minutes) {
        if (minutes >= 1440) {
            const days = Math.floor(minutes / 1440);
            return `${days} day${days > 1 ? 's' : ''}`;
        }
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    #formatDatabaseInfoMessage(dbInfo, stats) {
        let message = 'Storage Information:\n\n';
        message += `Type: ${this.#state.storageType}\n`;
        message += `Database: ${dbInfo.name || 'N/A'}\n`;
        message += `Version: ${dbInfo.version || 'N/A'}\n`;

        if (dbInfo.storageEstimate) {
            message += '\nStorage Usage:\n';
            message += `Used: ${dbInfo.storageEstimate.usage}\n`;
            message += `Available: ${dbInfo.storageEstimate.available}\n`;
            message += `Total: ${dbInfo.storageEstimate.quota}\n`;
            message += `Usage: ${dbInfo.storageEstimate.usagePercentage}%\n`;
        }

        message += '\nStatistics:\n';
        message += `- Total Reminders: ${stats.totalReminders || 0}\n`;
        message += `- Active: ${stats.active || 0}\n`;
        message += `- Completed: ${stats.completed || 0}\n`;
        message += `- Overdue: ${stats.overdue || 0}\n`;

        return message;
    }

    async #getNotificationStats() {
        return {
            totalReminders: this.#reminders.length,
            active: this.#reminders.filter(r => r.status === 'active').length,
            completed: this.#reminders.filter(r => r.status === 'completed').length,
            overdue: this.#reminders.filter(r => r.status === 'overdue').length
        };
    }

    #updateStorageIndicator() {
        const indicator = document.getElementById('storageIndicator');
        if (indicator) {
            const icons = {
                'IndexedDB': '💿',
                'localStorage': '💾',
                'Memory': '🧠'
            };

            indicator.textContent = `${icons[this.#state.storageType] || '📦'} ${this.#state.storageType}`;
            indicator.className = `storage-indicator ${this.#state.storageType.toLowerCase()}`;
        }

        const storageTitle = document.getElementById('storageTitle');
        const storageDescription = document.getElementById('storageDescription');

        if (storageTitle) {
            storageTitle.textContent = `${this.#state.storageType} Storage Active`;
        }

        if (storageDescription) {
            const descriptions = {
                'IndexedDB': 'High-performance database storage for optimal speed and capacity.',
                'localStorage': 'Browser fallback storage with limited capacity but good compatibility.',
                'Memory': 'Temporary storage - data will be lost when you close this tab.'
            };
            storageDescription.textContent = descriptions[this.#state.storageType] || 'Smart storage mechanism selected automatically.';
        }
    }

    #showAddReminderModal() {
        const modal = document.getElementById('addReminderModal');
        if (modal) {
            modal.style.display = 'flex';

            // Set default datetime to 1 hour from now
            const defaultDateTime = new Date(Date.now() + 60 * 60 * 1000);
            const datetimeInput = document.getElementById('reminderDate');
            if (datetimeInput) {
                datetimeInput.value = defaultDateTime.toISOString().slice(0, 16);
            }
        }
    }

    #showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.#getNotificationIcon(type)}</span>
                <span class="notification-message">${this.#escapeHtml(message)}</span>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.#getNotificationColor(type)};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Auto remove
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    #getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    #getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    #getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    }

    #getStatusClass(status) {
        return `status-${status}`;
    }

    #formatDateTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) {
            const pastTime = Math.abs(diffMs);
            if (pastTime < 60000) return 'Just passed';
            if (pastTime < 3600000) return `${Math.round(pastTime / 60000)} minutes ago`;
            if (pastTime < 86400000) return `${Math.round(pastTime / 3600000)} hours ago`;
            return `${Math.round(pastTime / 86400000)} days ago`;
        }

        if (diffMs < 60000) return 'In less than a minute';
        if (diffMs < 3600000) return `In ${Math.round(diffMs / 60000)} minutes`;
        if (diffMs < 86400000) return `In ${Math.round(diffMs / 3600000)} hours`;

        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    #capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    #generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    #updateElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    #updateDateTime() {
        this.#updateCurrentDateTime();
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
}

// Add global styles for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .notification {
        font-family: system-ui, -apple-system, sans-serif;
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .notification-icon {
        font-size: 1.25rem;
    }

    .notification-message {
        font-weight: 500;
    }
`;

if (!document.getElementById('notification-styles')) {
    notificationStyles.id = 'notification-styles';
    document.head.appendChild(notificationStyles);
}