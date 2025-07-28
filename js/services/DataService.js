// ===== DATA SERVICE - MODERN DATA MANAGEMENT =====

import { Storage, DateTime, ArrayUtils, generateUUID } from '../utils.js';
import {
    APP_CONFIG,
    REMINDER_STATUS,
    REMINDER_PRIORITIES,
    REMINDER_CATEGORIES,
    SAMPLE_DATA,
    MESSAGES,
    PERFORMANCE_CONFIG
} from '../config/constants.js';

/**
 * Data validation schemas
 */
const reminderSchema = Object.freeze({
    title: { required: true, type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    datetime: { required: true, type: 'date' },
    category: { required: true, enum: Object.values(REMINDER_CATEGORIES) },
    priority: { required: true, enum: Object.values(REMINDER_PRIORITIES) },
    notification: { type: 'boolean', default: true }
});

/**
 * Modern Data Service with caching, validation, and offline support
 */
export class DataService {
    #cache = new Map();
    #eventListeners = new Map();
    #syncQueue = [];
    #isOnline = navigator.onLine;
    #lastSync = null;

    constructor(storage = Storage) {
        this.storage = storage;
        this.#setupOfflineHandling();
    }

    /**
     * Initialize data service
     */
    async init() {
        console.log('💾 Initializing DataService...');

        try {
            await this.#loadData();
            this.#setupEventListeners();
            this.#startPeriodicSync();

            console.log('✅ DataService initialized successfully');
        } catch (error) {
            console.error('❌ DataService initialization failed:', error);
            throw new Error('Data service initialization failed');
        }
    }

    /**
     * Get all reminders with optional filtering
     */
    async getReminders(filters = {}) {
        const reminders = this.#cache.get('reminders') || [];

        if (Object.keys(filters).length === 0) {
            return this.#cloneDeep(reminders);
        }

        return reminders
            .filter(reminder => this.#matchesFilters(reminder, filters))
            .map(reminder => this.#cloneDeep(reminder));
    }

    /**
     * Get recent reminders (active/overdue, sorted by urgency)
     */
    async getRecentReminders(limit = 5) {
        const reminders = this.#cache.get('reminders') || [];

        return reminders
            .filter(reminder =>
                reminder.status === REMINDER_STATUS.ACTIVE ||
                reminder.status === REMINDER_STATUS.OVERDUE
            )
            .sort(this.#compareByUrgency)
            .slice(0, limit)
            .map(reminder => this.#cloneDeep(reminder));
    }

    /**
     * Get reminder by ID
     */
    async getReminderById(id) {
        const reminders = this.#cache.get('reminders') || [];
        const reminder = reminders.find(r => r.id === id);
        return reminder ? this.#cloneDeep(reminder) : null;
    }

    /**
     * Create new reminder with validation
     */
    async createReminder(reminderData) {
        const validatedData = await this.#validateReminder(reminderData);

        const reminder = {
            id: generateUUID(),
            ...validatedData,
            status: this.#calculateStatus(validatedData.datetime),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };

        const reminders = this.#cache.get('reminders') || [];
        const updatedReminders = [...reminders, reminder];

        await this.#updateCache('reminders', updatedReminders);
        await this.#persistData();

        this.#emit('data:reminder:created', { reminder: this.#cloneDeep(reminder) });

        return this.#cloneDeep(reminder);
    }

    /**
     * Update existing reminder
     */
    async updateReminder(id, updateData) {
        const reminders = this.#cache.get('reminders') || [];
        const reminderIndex = reminders.findIndex(r => r.id === id);

        if (reminderIndex === -1) {
            throw new Error('Reminder not found');
        }

        const existingReminder = reminders[reminderIndex];
        const validatedData = await this.#validateReminder(updateData, true);

        const updatedReminder = {
            ...existingReminder,
            ...validatedData,
            status: updateData.datetime
                ? this.#calculateStatus(updateData.datetime)
                : existingReminder.status,
            updatedAt: new Date().toISOString(),
            version: existingReminder.version + 1
        };

        const updatedReminders = [
            ...reminders.slice(0, reminderIndex),
            updatedReminder,
            ...reminders.slice(reminderIndex + 1)
        ];

        await this.#updateCache('reminders', updatedReminders);
        await this.#persistData();

        this.#emit('data:reminder:updated', {
            reminder: this.#cloneDeep(updatedReminder),
            previous: this.#cloneDeep(existingReminder)
        });

        return this.#cloneDeep(updatedReminder);
    }

    /**
     * Delete reminder
     */
    async deleteReminder(id) {
        const reminders = this.#cache.get('reminders') || [];
        const reminderIndex = reminders.findIndex(r => r.id === id);

        if (reminderIndex === -1) {
            throw new Error('Reminder not found');
        }

        const deletedReminder = reminders[reminderIndex];
        const updatedReminders = [
            ...reminders.slice(0, reminderIndex),
            ...reminders.slice(reminderIndex + 1)
        ];

        await this.#updateCache('reminders', updatedReminders);
        await this.#persistData();

        this.#emit('data:reminder:deleted', {
            reminder: this.#cloneDeep(deletedReminder)
        });

        return this.#cloneDeep(deletedReminder);
    }

    /**
     * Complete reminder with optimistic updates
     */
    async completeReminder(id) {
        const reminder = await this.getReminderById(id);
        if (!reminder) throw new Error('Reminder not found');

        const updates = {
            status: REMINDER_STATUS.COMPLETED,
            completedAt: new Date().toISOString()
        };

        return this.updateReminder(id, updates);
    }

    /**
     * Reactivate completed reminder
     */
    async reactivateReminder(id) {
        const reminder = await this.getReminderById(id);
        if (!reminder) throw new Error('Reminder not found');

        const updates = {
            status: this.#calculateStatus(reminder.datetime),
            completedAt: undefined
        };

        return this.updateReminder(id, updates);
    }

    /**
     * Snooze reminder to new datetime
     */
    async snoozeReminder(id, newDatetime) {
        const updates = {
            datetime: new Date(newDatetime).toISOString(),
            status: REMINDER_STATUS.ACTIVE,
            snoozeCount: (await this.getReminderById(id))?.snoozeCount + 1 || 1
        };

        return this.updateReminder(id, updates);
    }

    /**
     * Get dashboard statistics with caching
     */
    async getStatistics() {
        const cacheKey = 'statistics';
        const cached = this.#cache.get(cacheKey);

        if (cached && this.#isCacheValid(cached.timestamp)) {
            return cached.data;
        }

        const reminders = this.#cache.get('reminders') || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stats = {
            total: reminders.length,
            active: reminders.filter(r => r.status === REMINDER_STATUS.ACTIVE).length,
            completed: reminders.filter(r =>
                r.status === REMINDER_STATUS.COMPLETED &&
                DateTime.isToday(new Date(r.completedAt || r.updatedAt))
            ).length,
            overdue: reminders.filter(r => r.status === REMINDER_STATUS.OVERDUE).length,
            byCategory: this.#groupByCategory(reminders),
            byPriority: this.#groupByPriority(reminders),
            completionRate: this.#calculateCompletionRate(reminders)
        };

        this.#cache.set(cacheKey, {
            data: stats,
            timestamp: Date.now()
        });

        return stats;
    }

    /**
     * Search reminders with advanced filtering
     */
    async searchReminders(query, options = {}) {
        const {
            categories = [],
            priorities = [],
            statuses = [],
            dateRange = null,
            sortBy = 'datetime',
            sortOrder = 'asc',
            limit = 50
        } = options;

        const reminders = this.#cache.get('reminders') || [];
        const searchQuery = query.toLowerCase().trim();

        let results = reminders.filter(reminder => {
            // Text search
            const textMatch = !searchQuery ||
                reminder.title.toLowerCase().includes(searchQuery) ||
                reminder.description?.toLowerCase().includes(searchQuery);

            // Category filter
            const categoryMatch = categories.length === 0 ||
                categories.includes(reminder.category);

            // Priority filter
            const priorityMatch = priorities.length === 0 ||
                priorities.includes(reminder.priority);

            // Status filter
            const statusMatch = statuses.length === 0 ||
                statuses.includes(reminder.status);

            // Date range filter
            const dateMatch = !dateRange || this.#isInDateRange(
                new Date(reminder.datetime),
                dateRange
            );

            return textMatch && categoryMatch && priorityMatch && statusMatch && dateMatch;
        });

        // Sort results
        results = ArrayUtils.sortBy(results, sortBy, sortOrder);

        // Apply limit
        if (limit > 0) {
            results = results.slice(0, limit);
        }

        return results.map(reminder => this.#cloneDeep(reminder));
    }

    /**
     * Update overdue reminders in batch
     */
    async updateOverdueReminders() {
        const reminders = this.#cache.get('reminders') || [];
        const now = new Date();

        const updatedReminders = reminders.map(reminder => {
            if (reminder.status === REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) < now) {
                return {
                    ...reminder,
                    status: REMINDER_STATUS.OVERDUE,
                    updatedAt: new Date().toISOString()
                };
            }
            return reminder;
        });

        const updatedCount = updatedReminders.filter((reminder, index) =>
            reminder.status !== reminders[index].status
        ).length;

        if (updatedCount > 0) {
            await this.#updateCache('reminders', updatedReminders);
            await this.#persistData();

            this.#emit('data:overdue:updated', { count: updatedCount });
        }

        return updatedCount;
    }

    /**
     * Export data with metadata
     */
    async exportData() {
        const exportData = {
            reminders: this.#cache.get('reminders') || [],
            schedule: this.#cache.get('schedule') || [],
            preferences: this.storage.get(APP_CONFIG.storage.keys.USER_PREFERENCES, {}),
            metadata: {
                exportDate: new Date().toISOString(),
                version: APP_CONFIG.app.version,
                itemCount: (this.#cache.get('reminders') || []).length
            }
        };

        const dataBlob = new Blob(
            [JSON.stringify(exportData, null, 2)],
            { type: 'application/json' }
        );

        const filename = `reminder-backup-${DateTime.formatDate(new Date(), 'YYYY-MM-DD')}.json`;

        // Create download
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        this.#emit('data:exported', { filename, itemCount: exportData.reminders.length });

        return true;
    }

    /**
     * Import data with validation and merge options
     */
    async importData(file, options = {}) {
        const { merge = false, overwrite = false } = options;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);

                    // Validate import data structure
                    this.#validateImportData(importData);

                    if (merge) {
                        await this.#mergeImportData(importData, overwrite);
                    } else {
                        await this.#replaceData(importData);
                    }

                    this.#emit('data:imported', {
                        itemCount: importData.reminders?.length || 0,
                        merge
                    });

                    resolve(importData);
                } catch (error) {
                    reject(new Error(`Import failed: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.#eventListeners.has(event)) {
            this.#eventListeners.set(event, new Set());
        }
        this.#eventListeners.get(event).add(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        this.#eventListeners.get(event)?.delete(callback);
    }

    /**
     * Clear all data with confirmation
     */
    async clearAllData() {
        this.#cache.clear();

        const storageKeys = Object.values(APP_CONFIG.storage.keys);
        storageKeys.forEach(key => this.storage.remove(key));

        this.#emit('data:cleared');

        return true;
    }

    /**
     * Get sync status for offline functionality
     */
    getSyncStatus() {
        return {
            isOnline: this.#isOnline,
            lastSync: this.#lastSync,
            queueSize: this.#syncQueue.length,
            cacheSize: this.#cache.size
        };
    }

    // ===== PRIVATE METHODS =====

    /**
     * Load data from storage with migration support
     */
    async #loadData() {
        const storedReminders = this.storage.get(APP_CONFIG.storage.keys.REMINDERS_DATA);

        if (storedReminders?.length) {
            // Migrate data if needed
            const migratedReminders = this.#migrateReminders(storedReminders);
            this.#cache.set('reminders', migratedReminders);
        } else {
            // Use sample data for new users
            this.#cache.set('reminders', [...SAMPLE_DATA.reminders]);
            await this.#persistData();
        }

        // Load schedule data
        this.#cache.set('schedule', [...SAMPLE_DATA.schedule]);

        console.log(`📊 Loaded ${this.#cache.get('reminders').length} reminders`);
    }

    /**
     * Persist data to storage with error handling
     */
    async #persistData() {
        const reminders = this.#cache.get('reminders') || [];
        const result = this.storage.set(APP_CONFIG.storage.keys.REMINDERS_DATA, reminders);

        if (!result.success) {
            if (result.error.includes('quota')) {
                await this.#handleStorageQuotaExceeded();
            } else {
                throw new Error(`Failed to save data: ${result.error}`);
            }
        }

        this.#lastSync = new Date().toISOString();
    }

    /**
     * Validate reminder data against schema
     */
    async #validateReminder(data, isUpdate = false) {
        const errors = [];

        for (const [field, rules] of Object.entries(reminderSchema)) {
            const value = data[field];

            // Required field validation
            if (rules.required && !isUpdate && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }

            // Skip validation if field is not provided in update
            if (isUpdate && value === undefined) continue;

            // Type validation
            if (value !== undefined && rules.type) {
                if (!this.#validateType(value, rules.type)) {
                    errors.push(`${field} must be a valid ${rules.type}`);
                    continue;
                }
            }

            // Enum validation
            if (value !== undefined && rules.enum && !rules.enum.includes(value)) {
                errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }

            // Length validation
            if (value && rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${field} must be less than ${rules.maxLength} characters`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        // Apply defaults for missing optional fields
        const validated = { ...data };
        for (const [field, rules] of Object.entries(reminderSchema)) {
            if (validated[field] === undefined && rules.default !== undefined) {
                validated[field] = rules.default;
            }
        }

        return validated;
    }

    /**
     * Validate data type
     */
    #validateType(value, type) {
        switch (type) {
            case 'string': return typeof value === 'string';
            case 'number': return typeof value === 'number' && !isNaN(value);
            case 'boolean': return typeof value === 'boolean';
            case 'date': return !isNaN(Date.parse(value));
            default: return true;
        }
    }

    /**
     * Calculate reminder status based on datetime
     */
    #calculateStatus(datetime) {
        const reminderDate = new Date(datetime);
        const now = new Date();

        if (reminderDate <= now) {
            return REMINDER_STATUS.OVERDUE;
        }

        return REMINDER_STATUS.ACTIVE;
    }

    /**
     * Update cache with versioning
     */
    async #updateCache(key, data) {
        this.#cache.set(key, data);
        this.#cache.set(`${key}_updated`, Date.now());
    }

    /**
     * Check if cached data is still valid
     */
    #isCacheValid(timestamp, maxAge = PERFORMANCE_CONFIG.cacheExpiration) {
        return Date.now() - timestamp < maxAge;
    }

    /**
     * Deep clone object to prevent mutations
     */
    #cloneDeep(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (Array.isArray(obj)) return obj.map(item => this.#cloneDeep(item));

        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.#cloneDeep(obj[key]);
            }
        }
        return cloned;
    }

    /**
     * Compare reminders by urgency for sorting
     */
    #compareByUrgency = (a, b) => {
        // First by status (overdue > active)
        const statusOrder = {
            [REMINDER_STATUS.OVERDUE]: 0,
            [REMINDER_STATUS.ACTIVE]: 1
        };

        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;

        // Then by priority (higher priority first)
        const priorityDiff = b.priority - a.priority;
        if (priorityDiff !== 0) return priorityDiff;

        // Finally by datetime (earlier first)
        return new Date(a.datetime) - new Date(b.datetime);
    };

    /**
     * Check if filters match reminder
     */
    #matchesFilters(reminder, filters) {
        return Object.entries(filters).every(([key, value]) => {
            if (Array.isArray(value)) {
                return value.includes(reminder[key]);
            }
            return reminder[key] === value;
        });
    }

    /**
     * Group reminders by category with counts
     */
    #groupByCategory(reminders) {
        return Object.values(REMINDER_CATEGORIES).reduce((acc, category) => {
            acc[category] = reminders.filter(r => r.category === category).length;
            return acc;
        }, {});
    }

    /**
     * Group reminders by priority with counts
     */
    #groupByPriority(reminders) {
        return Object.values(REMINDER_PRIORITIES).reduce((acc, priority) => {
            acc[priority] = reminders.filter(r => r.priority === priority).length;
            return acc;
        }, {});
    }

    /**
     * Calculate completion rate percentage
     */
    #calculateCompletionRate(reminders) {
        if (reminders.length === 0) return 0;

        const completed = reminders.filter(r =>
            r.status === REMINDER_STATUS.COMPLETED
        ).length;

        return Math.round((completed / reminders.length) * 100);
    }

    /**
     * Check if date is in range
     */
    #isInDateRange(date, range) {
        const { start, end } = range;
        return date >= new Date(start) && date <= new Date(end);
    }

    /**
     * Migrate reminders data format if needed
     */
    #migrateReminders(reminders) {
        return reminders.map(reminder => ({
            ...reminder,
            // Ensure all required fields exist
            id: reminder.id || generateUUID(),
            version: reminder.version || 1,
            notification: reminder.notification ?? true
        }));
    }

    /**
     * Handle storage quota exceeded
     */
    async #handleStorageQuotaExceeded() {
        const reminders = this.#cache.get('reminders') || [];

        // Remove completed reminders older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const filteredReminders = reminders.filter(reminder => {
            if (reminder.status === REMINDER_STATUS.COMPLETED) {
                const completedDate = new Date(reminder.completedAt || reminder.updatedAt);
                return completedDate > thirtyDaysAgo;
            }
            return true;
        });

        await this.#updateCache('reminders', filteredReminders);

        // Try saving again
        const result = this.storage.set(
            APP_CONFIG.storage.keys.REMINDERS_DATA,
            filteredReminders
        );

        if (!result.success) {
            throw new Error('Storage quota exceeded - unable to save data');
        }

        this.#emit('data:storage:cleaned', {
            removed: reminders.length - filteredReminders.length
        });
    }

    /**
     * Validate import data structure
     */
    #validateImportData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }

        if (!Array.isArray(data.reminders)) {
            throw new Error('Reminders data must be an array');
        }

        // Validate each reminder
        data.reminders.forEach((reminder, index) => {
            if (!reminder.title || !reminder.datetime) {
                throw new Error(`Invalid reminder at index ${index}: missing required fields`);
            }
        });
    }

    /**
     * Merge import data with existing data
     */
    async #mergeImportData(importData, overwrite) {
        const existingReminders = this.#cache.get('reminders') || [];
        const importedReminders = importData.reminders || [];

        let mergedReminders;

        if (overwrite) {
            // Replace duplicates, add new ones
            const existingIds = new Set(existingReminders.map(r => r.id));
            const newReminders = importedReminders.filter(r => !existingIds.has(r.id));

            mergedReminders = [
                ...importedReminders.filter(r => existingIds.has(r.id)),
                ...existingReminders.filter(r => !importedReminders.find(ir => ir.id === r.id)),
                ...newReminders
            ];
        } else {
            // Keep existing, add only new ones
            const existingIds = new Set(existingReminders.map(r => r.id));
            const newReminders = importedReminders.filter(r => !existingIds.has(r.id));

            mergedReminders = [...existingReminders, ...newReminders];
        }

        await this.#updateCache('reminders', mergedReminders);
        await this.#persistData();
    }

    /**
     * Replace all data with import data
     */
    async #replaceData(importData) {
        await this.#updateCache('reminders', importData.reminders || []);

        if (importData.preferences) {
            this.storage.set(
                APP_CONFIG.storage.keys.USER_PREFERENCES,
                importData.preferences
            );
        }

        await this.#persistData();
    }

    /**
     * Setup offline handling
     */
    #setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.#isOnline = true;
            this.#processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.#isOnline = false;
        });
    }

    /**
     * Setup event listeners
     */
    #setupEventListeners() {
        // Auto-save on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.#persistData().catch(console.error);
            }
        });

        // Save before page unload
        window.addEventListener('beforeunload', () => {
            this.#persistData();
        });
    }

    /**
     * Start periodic sync for real-time updates
     */
    #startPeriodicSync() {
        setInterval(() => {
            this.updateOverdueReminders().catch(console.error);
        }, 60000); // Check every minute
    }

    /**
     * Process sync queue for offline support
     */
    async #processSyncQueue() {
        while (this.#syncQueue.length > 0 && this.#isOnline) {
            const operation = this.#syncQueue.shift();
            try {
                await operation();
            } catch (error) {
                console.error('Sync operation failed:', error);
                // Re-queue failed operations
                this.#syncQueue.unshift(operation);
                break;
            }
        }
    }

    /**
     * Emit events to listeners
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

        // Also emit as DOM event
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

// Create singleton instance
export const dataService = new DataService();

// Export both class and instance
export default dataService;