/**
 * Modern DashboardController with IndexedDB persistent storage
 * Complete implementation with proper error handling and storage integration
 */
import { NotificationService } from './NotificationService.js';
import { StorageFactory } from './StorageFactory.js';

export class DashboardController {
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
        lastSync: null,
        storageType: 'detecting'
    };

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
        this.#setupNotificationHandlers();
    }

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

    async #initializeStorage() {
        try {
            const userId = this.#getCurrentUserId();
            this.#storageService = await StorageFactory.getInstance(userId);

            // Enhanced storage type detection
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

            // Enhanced detection logic
            if (dbInfo.name === 'RemindersVaultDB' || dbInfo.type?.includes('IndexedDB')) {
                return 'IndexedDB';
            }
            if (dbInfo.name === 'localStorage' || dbInfo.type?.includes('localStorage')) {
                return 'localStorage';
            }
            if (dbInfo.name === 'Memory Storage' || dbInfo.type?.includes('Memory')) {
                return 'Memory';
            }

            // Fallback detection based on constructor
            const constructorName = this.#storageService.constructor.name;
            if (constructorName.includes('IndexedDB')) return 'IndexedDB';
            if (constructorName.includes('Fallback')) return 'localStorage';
            if (constructorName.includes('Memory')) return 'Memory';

            return 'Unknown';
        } catch (error) {
            console.warn('Storage type detection failed:', error);
            return 'Unknown';
        }
    }

    #updateStorageIndicator() {
        const indicators = {
            'IndexedDB': { icon: '💾', text: 'IndexedDB', class: 'indexeddb' },
            'localStorage': { icon: '💿', text: 'localStorage', class: 'localstorage' },
            'Memory': { icon: '🧠', text: 'Memory', class: 'memory' },
            'detecting': { icon: '🔍', text: 'Detecting', class: 'detecting' }
        };

        const indicator = indicators[this.#state.storageType] ||
            { icon: '❓', text: 'Unknown', class: 'unknown' };

        const storageIndicator = document.querySelector('.storage-indicator, .indexeddb-indicator');
        if (storageIndicator) {
            storageIndicator.innerHTML = `${indicator.icon} ${indicator.text} Storage`;
            storageIndicator.className = `storage-indicator ${indicator.class}`;
        }

        this.#updateStorageInfoSection();
    }

    #updateStorageInfoSection() {
        const storageInfo = document.querySelector('.storage-info');
        if (!storageInfo) return;

        const messages = {
            'IndexedDB': 'Your reminders are stored in IndexedDB and will persist across browser sessions, restarts, and updates.',
            'localStorage': 'Using localStorage fallback. Data persists across sessions but has storage limits.',
            'Memory': 'Using temporary memory storage. Data will be lost when you close this tab.',
            'detecting': 'Detecting optimal storage mechanism for your browser...'
        };

        const message = messages[this.#state.storageType] || 'Storage type could not be determined.';
        const strongElement = storageInfo.querySelector('strong');
        const paragraphElement = storageInfo.querySelector('p');

        if (strongElement) {
            strongElement.textContent = `${this.#state.storageType} Storage Active`;
        }
        if (paragraphElement) {
            paragraphElement.textContent = message;
        }
    }

    #showStorageError(error) {
        const isStorageError = error.message.includes('Storage') ||
            error.message.includes('IndexedDB') ||
            error.message.includes('localStorage');

        if (isStorageError) {
            this.#showNotification(
                `Storage Error: ${error.message}. Some features may be limited.`,
                'warning'
            );
        } else {
            this.#showNotification('Failed to initialize dashboard', 'error');
        }
    }

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

    #setLoadingState(isLoading) {
        this.#state.isLoading = isLoading;
        const loader = document.querySelector('.dashboard-loader');
        if (loader) {
            loader.style.display = isLoading ? 'flex' : 'none';
        }
    }

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

    #getCurrentUserId() {
        return this.#currentUser?.id || this.#currentUser?.username || 'anonymous';
    }

    #getSessionData() {
        try {
            const sessionData = localStorage.getItem('user_session');
            return sessionData ? JSON.parse(sessionData) : null;
        } catch {
            return null;
        }
    }

    async #loadData() {
        try {
            const userId = this.#getCurrentUserId();
            this.#reminders = await this.#storageService.getReminders(userId);

            if (this.#reminders.length === 0) {
                console.log('No existing reminders found, creating sample data...');
                await this.#createSampleData(userId);
            }

            this.#schedule = [...DashboardController.SAMPLE_DATA.schedule];
            this.#applyFilters();
            this.#scheduleExistingNotifications();
            await this.#updateOverdueReminders();

            this.#state.lastSync = new Date().toISOString();
            console.log(`📊 Loaded ${this.#reminders.length} reminders from ${this.#state.storageType}`);
        } catch (error) {
            console.error('Failed to load data:', error);
            this.#showNotification(`Failed to load data from ${this.#state.storageType}`, 'error');
            this.#reminders = [];
            this.#schedule = [];
        }
    }

    async #createSampleData(userId) {
        const samplePromises = DashboardController.SAMPLE_DATA.reminders.map(reminder =>
            this.#storageService.saveReminder({ ...reminder, userId })
        );

        this.#reminders = await Promise.all(samplePromises);
        console.log(`📝 Created ${this.#reminders.length} sample reminders in ${this.#state.storageType}`);
    }

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

    async #updateOverdueReminders() {
        if (!this.#storageService?.updateReminder) {
            console.warn('Storage service does not support updateReminder method');
            return;
        }

        const now = new Date();
        const overdueUpdates = [];

        for (const reminder of this.#reminders) {
            if (reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) <= now) {

                try {
                    overdueUpdates.push(
                        this.#storageService.updateReminder(reminder.id, {
                            status: DashboardController.CONFIG.REMINDER_STATUS.OVERDUE
                        })
                    );

                    reminder.status = DashboardController.CONFIG.REMINDER_STATUS.OVERDUE;
                    reminder.updatedAt = new Date().toISOString();
                } catch (error) {
                    console.warn(`Failed to update reminder ${reminder.id}:`, error);
                }
            }
        }

        if (overdueUpdates.length > 0) {
            try {
                await Promise.all(overdueUpdates);
                this.#refreshView();
                console.log(`⏰ Updated ${overdueUpdates.length} overdue reminders in ${this.#state.storageType}`);
            } catch (error) {
                console.warn('Some overdue updates failed:', error);
            }
        }
    }

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

            const savedReminder = await this.#storageService.saveReminder(reminder);
            this.#reminders = [...this.#reminders, savedReminder];

            if (savedReminder.notification && savedReminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE) {
                const scheduledCount = this.#notificationService.scheduleNotification(savedReminder, savedReminder.alertTimings);
                console.log(`📅 Scheduled ${scheduledCount} alerts for reminder: ${savedReminder.title}`);
            }

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

            const originalStatus = reminder.status;
            reminder.status = DashboardController.CONFIG.REMINDER_STATUS.COMPLETED;
            reminder.updatedAt = new Date().toISOString();
            this.#refreshView();

            try {
                if (this.#storageService?.updateReminder) {
                    await this.#storageService.updateReminder(reminderId, {
                        status: DashboardController.CONFIG.REMINDER_STATUS.COMPLETED,
                        updatedAt: reminder.updatedAt
                    });
                }

                this.#notificationService.cancelNotification(reminderId);
                this.#showNotification(`"${reminder.title}" completed!`, 'success');
            } catch (error) {
                reminder.status = originalStatus;
                this.#refreshView();
                throw error;
            }
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

            const newTime = new Date();
            newTime.setMinutes(newTime.getMinutes() + minutes);

            const updates = {
                datetime: newTime.toISOString(),
                status: DashboardController.CONFIG.REMINDER_STATUS.ACTIVE,
                updatedAt: new Date().toISOString()
            };

            if (this.#storageService?.updateReminder) {
                await this.#storageService.updateReminder(reminderId, updates);
            }

            Object.assign(reminder, updates);

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

    async exportData() {
        try {
            const userId = this.#getCurrentUserId();
            const exportData = await this.#storageService.exportAllData(userId);

            exportData.exportMetadata = {
                storageType: this.#state.storageType,
                exportedAt: new Date().toISOString(),
                appVersion: '2.0',
                compatibility: ['IndexedDB', 'localStorage', 'Memory']
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `reminders-${this.#state.storageType.toLowerCase()}-export-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(link.href);

            this.#showNotification(`Data exported from ${this.#state.storageType}!`, 'success');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.#showNotification('Failed to export data', 'error');
        }
    }

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

            this.#validateImportData(importData);

            const userId = this.#getCurrentUserId();
            const results = await this.#storageService.importData(importData, userId);

            await this.#loadData();
            this.#refreshView();

            this.#showNotification(
                `Imported ${results.length} reminders to ${this.#state.storageType}!`,
                'success'
            );
        } catch (error) {
            console.error('Failed to import data:', error);
            this.#showNotification(`Import failed: ${error.message}`, 'error');
        }
    }

    #validateImportData(importData) {
        if (!importData || typeof importData !== 'object') {
            throw new Error('Invalid import file format');
        }
        if (!Array.isArray(importData.reminders)) {
            throw new Error('No reminders found in import file');
        }
        console.log(`✅ Import validation passed: ${importData.reminders.length} reminders`);
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
        const testReminder = {
            id: 99999,
            title: `Test ${this.#state.storageType} System`,
            description: `Testing the enhanced notification system with ${this.#state.storageType} storage`,
            datetime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            priority: 3,
            category: 'personal',
            alertTimings: [5, 15]
        };

        const scheduledCount = this.#notificationService.scheduleNotification(testReminder, testReminder.alertTimings);
        this.#notificationService.testNotification();

        this.#showNotification(
            `Test system activated! ${scheduledCount} alerts scheduled with ${this.#state.storageType} data.`,
            'info'
        );
    }

    showAlertPreferencesModal() {
        this.#showNotification('Alert preferences modal - implementation pending', 'info');
    }

    #showAddReminderModal() {
        const modal = document.getElementById('addReminderModal');
        if (!modal) {
            this.#showNotification('Add reminder modal not found', 'error');
            return;
        }

        const form = document.getElementById('addReminderForm');
        if (form) form.reset();

        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);
        const datetimeInput = document.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = defaultTime.toISOString().slice(0, 16);
        }

        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('reminderTitle')?.focus(), 100);
    }

    async #showDatabaseInfo() {
        try {
            const dbInfo = await this.#storageService.getDatabaseInfo();
            const stats = await this.#getNotificationStats();

            let message = `Storage Information:\n\n`;
            message += `Type: ${this.#state.storageType}\n`;
            message += `Database: ${dbInfo.name || 'N/A'}\n`;
            message += `Version: ${dbInfo.version || 'N/A'}\n`;

            if (dbInfo.storageEstimate) {
                message += `\nStorage Usage:\n`;
                message += `Used: ${dbInfo.storageEstimate.usage}\n`;
                message += `Available: ${dbInfo.storageEstimate.available}\n`;
                message += `Total: ${dbInfo.storageEstimate.quota}\n`;
                message += `Usage: ${dbInfo.storageEstimate.usagePercentage}%\n`;
            }

            message += `\nStatistics:\n`;
            message += `- Total Reminders: ${stats.totalReminders || 0}\n`;
            message += `- Active: ${stats.active || 0}\n`;
            message += `- Completed: ${stats.completed || 0}\n`;
            message += `- Overdue: ${stats.overdue || 0}\n`;

            alert(message);
        } catch (error) {
            console.error('Failed to show database info:', error);
            alert(`Failed to get database information: ${error.message}`);
        }
    }

    async #getNotificationStats() {
        try {
            const userId = this.#getCurrentUserId();
            const stats = await this.#storageService.getStatistics(userId);
            const notificationStats = this.#notificationService.getNotificationStats();

            return {
                ...stats,
                ...notificationStats,
                storageType: this.#state.storageType,
                lastSync: this.#state.lastSync
            };
        } catch (error) {
            console.error('Failed to get statistics:', error);
            return {
                totalReminders: this.#reminders.length,
                storageType: this.#state.storageType,
                error: error.message
            };
        }
    }

    #closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    async #handleFormSubmit() {
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

        await this.createReminder(reminderData);
        this.#closeModal('addReminderModal');
    }

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

    // === UTILITY METHODS ===

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

    #calculateStatus(datetime) {
        return new Date(datetime) <= new Date()
            ? DashboardController.CONFIG.REMINDER_STATUS.OVERDUE
            : DashboardController.CONFIG.REMINDER_STATUS.ACTIVE;
    }

    #findReminder(id) {
        return this.#reminders.find(r => r.id === id);
    }

    #formatDuration(minutes) {
        if (minutes >= 1440) return `${Math.floor(minutes/1440)} day(s)`;
        if (minutes >= 60) return `${Math.floor(minutes/60)} hour(s)`;
        return `${minutes} minute(s)`;
    }

    #applyFilters() {
        let filtered = [...this.#reminders];

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

    #render() {
        this.#updateDateTime();
        this.#updateStatistics();
        this.#renderReminders();
        this.#renderSchedule();
        this.#updateFilterInfo();
    }

    #refreshView() {
        this.#applyFilters();
        this.#render();
    }

    #updateDateTime() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    #updateWelcomeMessage() {
        const welcomeElement = document.getElementById('welcomeMessage');
        if (welcomeElement && this.#currentUser) {
            const name = this.#currentUser.profile?.firstName || this.#currentUser.username || 'User';
            welcomeElement.textContent = `Welcome back, ${name}!`;
        }
    }

    #updateStatistics() {
        const stats = this.#calculateStatistics();
        this.#animateCounter('totalReminders', stats.total);
        this.#animateCounter('activeReminders', stats.active);
        this.#animateCounter('completedToday', stats.completed);
        this.#animateCounter('overdue', stats.overdue);
    }

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
                r.updatedAt && new Date(r.updatedAt) >= today && new Date(r.updatedAt) < tomorrow
            ).length,
            overdue: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.OVERDUE).length
        };
    }

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

    #renderReminders() {
        const container = document.getElementById('remindersList');
        if (!container) return;

        if (this.#state.filteredReminders.length === 0) {
            this.#renderEmptyState(container);
            return;
        }

        const html = this.#state.filteredReminders.slice(0, 10).map(reminder =>
            this.#renderReminderItem(reminder)
        ).join('');
        container.innerHTML = html;

        this.#setupReminderActionHandlers();
    }

    #renderReminderItem(reminder) {
        const priorityIcon = this.#getPriorityIcon(reminder.priority);
        const priorityName = this.#getPriorityName(reminder.priority);
        const alertCount = reminder.alertTimings?.length || 0;

        return `
            <div class="reminder-item enhanced" data-id="${reminder.id}">
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
                            <strong>Storage:</strong> ${this.#state.storageType}
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
                            title="Edit reminder">
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

    #renderEmptyState(container) {
        const emptyStates = {
            all: { icon: '📝', title: `No reminders in ${this.#state.storageType}`, message: 'Create your first reminder to get started!' },
            active: { icon: '🎉', title: 'No active reminders', message: 'All caught up! You have no active reminders.' },
            completed: { icon: '✅', title: 'No completed reminders', message: 'Complete some reminders to see them here.' },
            overdue: { icon: '🎯', title: 'No overdue reminders', message: 'Great job! You\'re all caught up.' }
        };

        const state = emptyStates[this.#state.currentFilter] || emptyStates.all;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${state.icon}</div>
                <h3>${state.title}</h3>
                <p>${state.message}</p>
                <button class="btn btn-primary" onclick="dashboard.showAddReminderModal()">
                    ➕ Add Your First Reminder
                </button>
            </div>
        `;
    }

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

    #setupReminderActionHandlers() {
        const actionHandlers = {
            'action-btn-complete': (btn) => this.completeReminder(parseInt(btn.dataset.id)),
            'action-btn-edit': (btn) => this.#showNotification('Edit reminder - implementation pending', 'info'),
            'action-btn-delete': (btn) => this.#deleteReminder(parseInt(btn.dataset.id))
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

    async #deleteReminder(reminderId) {
        const reminder = this.#findReminder(reminderId);
        if (!reminder) return;

        if (!confirm(`Delete "${reminder.title}"?`)) return;

        try {
            this.#reminders = this.#reminders.filter(r => r.id !== reminderId);
            this.#refreshView();

            if (this.#storageService?.deleteReminder) {
                await this.#storageService.deleteReminder(reminderId);
            }

            this.#notificationService.cancelNotification(reminderId);
            this.#showNotification(`"${reminder.title}" deleted`, 'info');
        } catch (error) {
            this.#reminders.push(reminder);
            this.#refreshView();
            console.error('Failed to delete reminder:', error);
            this.#showNotification('Failed to delete reminder', 'error');
        }
    }

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

    #setupEventHandlers() {
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
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                document.getElementById(id).addEventListener('click', handler);
            }
        });
    }

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

    #setupFormHandlers() {
        const form = document.getElementById('addReminderForm');
        if (!form) return;

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

        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => this.#setQuickTime(btn));
        });
    }

    #startAutoRefresh() {
        const refreshInterval = setInterval(() => {
            this.#updateDateTime();
            this.#updateOverdueReminders();
        }, DashboardController.CONFIG.AUTO_REFRESH_INTERVAL);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('📱 Page visible - checking for updates...');
                this.#updateOverdueReminders();
            }
        });

        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterval);
            this.#cleanup();
        });
    }

    #cleanup() {
        this.#notificationService?.cleanup();

        if (this.#storageService?.close) {
            this.#storageService.close().catch(error => {
                console.warn('Storage cleanup warning:', error.message);
            });
        }

        console.log('🧹 Dashboard cleanup completed');
    }

    // === UTILITY HELPER METHODS ===

    #getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    }

    #getPriorityName(priority) {
        const names = { 1: 'low', 2: 'medium', 3: 'high', 4: 'urgent' };
        return names[priority] || 'unknown';
    }

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

    #formatTimingValue(minutes) {
        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
        return `${Math.round(minutes / 1440)}d`;
    }

    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === PUBLIC API METHODS ===

    setFilter(filter) {
        this.#state.currentFilter = filter;
        this.#state.currentPage = 1;
        this.#applyFilters();
        this.#render();
    }

    refresh() {
        this.#loadData().then(() => {
            this.#showNotification(`Dashboard refreshed from ${this.#state.storageType}!`, 'success');
        }).catch(error => {
            console.error('Failed to refresh:', error);
            this.#showNotification('Failed to refresh data', 'error');
        });
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

    #clearSessionData() {
        try {
            localStorage.removeItem('user_session');
        } catch (error) {
            console.warn('Failed to clear session data:', error);
        }
    }

    #showNotification(message, type = 'info') {
        console.log(`Notification (${type}):`, message);

        let enhancedMessage = message;
        if (type === 'error' && message.includes('storage')) {
            enhancedMessage += ` Current storage: ${this.#state.storageType}`;
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
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
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = enhancedMessage;

        document.body.appendChild(notification);
        requestAnimationFrame(() => notification.style.transform = 'translateX(0)');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, type === 'error' ? 5000 : 3000);
    }

    // === GLOBAL METHODS FOR HTML ACCESS ===

    showAddReminderModal() {
        this.#showAddReminderModal();
    }
}