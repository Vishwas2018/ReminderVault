// ===== DATA MANAGER =====

/**
 * Manages all data operations including loading, saving, and manipulation
 * of reminders and application data
 */
let DataManager = {

    // Data cache
    cache: {
        reminders: [],
        schedule: [],
        stats: {
            total: 0,
            active: 0,
            completed: 0,
            overdue: 0
        }
    },

    /**
     * Initialize data manager
     */
    init: function() {
        console.log('Initializing DataManager...');

        this.loadData();
        this.setupEventListeners();

        console.log('DataManager initialized');
    },

    /**
     * Set up event listeners for data operations
     */
    setupEventListeners: function() {
        // Listen for reminder events from NotificationManager
        document.addEventListener('reminder:complete', (e) => {
            this.markReminderComplete(e.detail);
        });

        document.addEventListener('reminder:snooze', (e) => {
            this.snoozeReminder(e.detail.reminder, e.detail.newDateTime);
        });

        // Auto-save data when window closes
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });
    },

    /**
     * Load all data from storage
     */
    loadData: function() {
        console.log('Loading data...');

        // Load reminders from storage or use sample data
        const storedReminders = Utils.Storage.get(APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA);
        this.cache.reminders = storedReminders || [...SAMPLE_DATA.REMINDERS];

        // Load schedule data (for demo purposes, from constants)
        this.cache.schedule = [...SAMPLE_DATA.SCHEDULE];

        // Calculate stats
        this.calculateStats();

        // Save data if not already stored
        if (!storedReminders) {
            this.saveData();
        }

        console.log(`Loaded ${this.cache.reminders.length} reminders`);
    },

    /**
     * Save data to storage
     */
    saveData: function() {
        try {
            Utils.Storage.set(APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA, this.cache.reminders);
            console.log('Data saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save data:', error);
            return false;
        }
    },

    /**
     * Calculate dashboard statistics
     */
    calculateStats: function() {
        const reminders = this.cache.reminders;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.cache.stats = {
            total: reminders.length,
            active: reminders.filter(r => r.status === REMINDER_STATUS.ACTIVE).length,
            completed: reminders.filter(r => {
                return r.status === REMINDER_STATUS.COMPLETED &&
                    Utils.DateTime.isToday(new Date(r.updatedAt || r.createdAt));
            }).length,
            overdue: reminders.filter(r => r.status === REMINDER_STATUS.OVERDUE).length
        };

        console.log('Stats calculated:', this.cache.stats);
    },

    /**
     * Get all reminders
     */
    getReminders: function() {
        return [...this.cache.reminders];
    },

    /**
     * Get recent reminders (non-completed, sorted by date)
     */
    getRecentReminders: function(limit = 5) {
        return this.cache.reminders
            .filter(r => r.status !== REMINDER_STATUS.COMPLETED)
            .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
            .slice(0, limit);
    },

    /**
     * Get schedule data
     */
    getSchedule: function() {
        return [...this.cache.schedule];
    },

    /**
     * Get statistics
     */
    getStats: function() {
        return { ...this.cache.stats };
    },

    /**
     * Get reminder by ID
     */
    getReminderById: function(id) {
        return this.cache.reminders.find(r => r.id === id);
    },

    /**
     * Add new reminder
     */
    addReminder: function(reminderData) {
        try {
            const newReminder = {
                id: Date.now() + Math.random(),
                title: reminderData.title,
                description: reminderData.description || '',
                datetime: new Date(reminderData.datetime).toISOString(),
                category: reminderData.category || REMINDER_CATEGORIES.PERSONAL,
                priority: reminderData.priority || REMINDER_PRIORITIES.MEDIUM,
                status: new Date(reminderData.datetime) <= new Date()
                    ? REMINDER_STATUS.OVERDUE
                    : REMINDER_STATUS.ACTIVE,
                notification: reminderData.notification || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.cache.reminders.push(newReminder);
            this.calculateStats();
            this.saveData();

            console.log('Reminder added:', newReminder.title);
            this.triggerEvent('data:reminder:added', newReminder);

            return newReminder;
        } catch (error) {
            console.error('Failed to add reminder:', error);
            throw error;
        }
    },

    /**
     * Update existing reminder
     */
    updateReminder: function(id, updateData) {
        try {
            const index = this.cache.reminders.findIndex(r => r.id === id);
            if (index === -1) {
                throw new Error('Reminder not found');
            }

            const existingReminder = this.cache.reminders[index];
            const updatedReminder = {
                ...existingReminder,
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            // Recalculate status if datetime changed
            if (updateData.datetime) {
                updatedReminder.status = new Date(updateData.datetime) <= new Date()
                    ? REMINDER_STATUS.OVERDUE
                    : REMINDER_STATUS.ACTIVE;
            }

            this.cache.reminders[index] = updatedReminder;
            this.calculateStats();
            this.saveData();

            console.log('Reminder updated:', updatedReminder.title);
            this.triggerEvent('data:reminder:updated', updatedReminder);

            return updatedReminder;
        } catch (error) {
            console.error('Failed to update reminder:', error);
            throw error;
        }
    },

    /**
     * Delete reminder
     */
    deleteReminder: function(id) {
        try {
            const index = this.cache.reminders.findIndex(r => r.id === id);
            if (index === -1) {
                throw new Error('Reminder not found');
            }

            const deletedReminder = this.cache.reminders.splice(index, 1)[0];
            this.calculateStats();
            this.saveData();

            console.log('Reminder deleted:', deletedReminder.title);
            this.triggerEvent('data:reminder:deleted', deletedReminder);

            return deletedReminder;
        } catch (error) {
            console.error('Failed to delete reminder:', error);
            throw error;
        }
    },

    /**
     * Mark reminder as complete
     */
    markReminderComplete: function(reminder) {
        try {
            const updates = {
                status: REMINDER_STATUS.COMPLETED,
                completedAt: new Date().toISOString()
            };

            return this.updateReminder(reminder.id, updates);
        } catch (error) {
            console.error('Failed to mark reminder as complete:', error);
            throw error;
        }
    },

    /**
     * Reactivate completed reminder
     */
    reactivateReminder: function(id) {
        try {
            const reminder = this.getReminderById(id);
            if (!reminder) {
                throw new Error('Reminder not found');
            }

            const updates = {
                status: new Date(reminder.datetime) <= new Date()
                    ? REMINDER_STATUS.OVERDUE
                    : REMINDER_STATUS.ACTIVE
            };

            // Remove completedAt timestamp
            const updatedReminder = this.updateReminder(id, updates);
            delete updatedReminder.completedAt;

            return updatedReminder;
        } catch (error) {
            console.error('Failed to reactivate reminder:', error);
            throw error;
        }
    },

    /**
     * Snooze reminder (update datetime)
     */
    snoozeReminder: function(reminder, newDateTime) {
        try {
            const updates = {
                datetime: newDateTime,
                status: REMINDER_STATUS.ACTIVE // Reset to active since it's in the future
            };

            return this.updateReminder(reminder.id, updates);
        } catch (error) {
            console.error('Failed to snooze reminder:', error);
            throw error;
        }
    },

    /**
     * Update overdue reminders
     */
    updateOverdueReminders: function() {
        let updatedCount = 0;
        const now = new Date();

        this.cache.reminders.forEach((reminder, index) => {
            if (reminder.status === REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) < now) {
                this.cache.reminders[index].status = REMINDER_STATUS.OVERDUE;
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            this.calculateStats();
            this.saveData();
            console.log(`Updated ${updatedCount} reminders to overdue status`);
            this.triggerEvent('data:overdue:updated', { count: updatedCount });
        }

        return updatedCount;
    },

    /**
     * Get reminders by status
     */
    getRemindersByStatus: function(status) {
        return this.cache.reminders.filter(r => r.status === status);
    },

    /**
     * Get reminders by category
     */
    getRemindersByCategory: function(category) {
        return this.cache.reminders.filter(r => r.category === category);
    },

    /**
     * Get reminders by priority
     */
    getRemindersByPriority: function(priority) {
        return this.cache.reminders.filter(r => r.priority === priority);
    },

    /**
     * Search reminders
     */
    searchReminders: function(query) {
        const searchQuery = query.toLowerCase();
        return this.cache.reminders.filter(r =>
            r.title.toLowerCase().includes(searchQuery) ||
            (r.description && r.description.toLowerCase().includes(searchQuery))
        );
    },

    /**
     * Export data
     */
    exportData: function() {
        try {
            const exportData = {
                reminders: this.cache.reminders,
                preferences: Utils.Storage.get(APP_CONFIG.STORAGE_KEYS.USER_PREFERENCES, {}),
                exportDate: new Date().toISOString(),
                version: APP_CONFIG.VERSION
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `reminder-manager-backup-${Utils.DateTime.formatDate(new Date(), 'YYYY-MM-DD')}.json`;
            link.click();

            Utils.UI.showNotification('Data exported successfully!', 'success');
            return true;
        } catch (error) {
            console.error('Export error:', error);
            Utils.UI.showNotification('Failed to export data', 'error');
            return false;
        }
    },

    /**
     * Import data
     */
    importData: function(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

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
                        reject(new Error('Import cancelled by user'));
                        return;
                    }

                    // Import data
                    this.cache.reminders = data.reminders;
                    if (data.preferences) {
                        Utils.Storage.set(APP_CONFIG.STORAGE_KEYS.USER_PREFERENCES, data.preferences);
                    }

                    this.calculateStats();
                    this.saveData();

                    Utils.UI.showNotification('Data imported successfully!', 'success');
                    this.triggerEvent('data:imported', { count: data.reminders.length });

                    resolve(data);
                } catch (error) {
                    console.error('Import error:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    },

    /**
     * Clear all data
     */
    clearData: function() {
        if (confirm('This will delete all your reminders. Are you sure?')) {
            this.cache.reminders = [];
            this.calculateStats();
            this.saveData();

            console.log('All data cleared');
            this.triggerEvent('data:cleared');
            Utils.UI.showNotification('All data cleared', 'info');

            return true;
        }
        return false;
    },

    /**
     * Trigger custom event
     */
    triggerEvent: function(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    },

    /**
     * Refresh data and recalculate
     */
    refresh: function() {
        this.calculateStats();
        this.updateOverdueReminders();
        this.triggerEvent('data:refreshed');
        console.log('Data refreshed');
    },

    /**
     * Get debug information
     */
    debug: function() {
        return {
            cacheSize: {
                reminders: this.cache.reminders.length,
                schedule: this.cache.schedule.length
            },
            stats: this.cache.stats,
            storageUsed: JSON.stringify(this.cache.reminders).length,
            lastSaved: Utils.Storage.get('lastSaved', 'Never')
        };
    }
};

// Make DataManager available globally
if (typeof window !== 'undefined') {
    window.DataManager = DataManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}