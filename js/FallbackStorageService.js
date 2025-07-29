/**
 * FallbackStorageService - localStorage-based backup for IndexedDB
 * Provides identical API to IndexedDBStorageService for seamless fallback
 */

export class FallbackStorageService {
    static #STORAGE_KEY = 'reminders_vault_data';
    static #MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB localStorage limit

    #isAvailable = false;
    #initPromise = null;

    constructor() {
        this.#isAvailable = this.#checkStorageAvailability();
        this.#initPromise = this.#initialize();
    }

    /**
     * Check if localStorage is available and functional
     */
    #checkStorageAvailability() {
        try {
            const testKey = '__storage_test__';
            const testValue = 'test_data';

            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);

            return retrieved === testValue;
        } catch (error) {
            console.warn('localStorage not available:', error.message);
            return false;
        }
    }

    /**
     * Initialize the fallback storage system
     */
    async #initialize() {
        if (!this.#isAvailable) {
            throw new Error('localStorage is not available in this environment');
        }

        // Ensure data structure exists
        const existingData = this.#getRawData();
        if (!existingData) {
            await this.#createInitialStructure();
        }

        console.log('✅ FallbackStorageService initialized with localStorage');
        return true;
    }

    /**
     * Create initial data structure in localStorage
     */
    async #createInitialStructure() {
        const initialData = {
            version: 1,
            created: new Date().toISOString(),
            reminders: [],
            userPreferences: {},
            metadata: {}
        };

        this.#setRawData(initialData);
    }

    /**
     * Ensure service is ready before operations
     */
    async #ensureReady() {
        if (!this.#isAvailable) {
            throw new Error('localStorage not available');
        }

        await this.#initPromise;
        return true;
    }

    /**
     * Get raw data from localStorage with error handling
     */
    #getRawData() {
        try {
            const data = localStorage.getItem(FallbackStorageService.#STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to parse localStorage data:', error);
            return null;
        }
    }

    /**
     * Set raw data to localStorage with size validation
     */
    #setRawData(data) {
        try {
            const serialized = JSON.stringify(data);

            if (serialized.length > FallbackStorageService.#MAX_STORAGE_SIZE) {
                throw new Error('Data exceeds localStorage size limit');
            }

            localStorage.setItem(FallbackStorageService.#STORAGE_KEY, serialized);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.#handleQuotaExceeded();
                throw new Error('Storage quota exceeded. Please clear some data.');
            }
            throw error;
        }
    }

    /**
     * Handle storage quota exceeded by cleaning old data
     */
    #handleQuotaExceeded() {
        try {
            const data = this.#getRawData();
            if (!data?.reminders) return;

            // Remove completed reminders older than 30 days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);

            data.reminders = data.reminders.filter(reminder => {
                if (reminder.status === 'completed' && reminder.updatedAt) {
                    return new Date(reminder.updatedAt) > cutoffDate;
                }
                return true;
            });

            this.#setRawData(data);
            console.log('🧹 Cleaned old completed reminders to free storage space');
        } catch (error) {
            console.error('Failed to clean storage:', error);
        }
    }

    /**
     * Generate unique ID for new records
     */
    #generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    // === REMINDER CRUD OPERATIONS ===

    /**
     * Save reminder to localStorage
     */
    async saveReminder(reminderData) {
        await this.#ensureReady();

        const data = this.#getRawData();
        if (!data) throw new Error('Storage data corrupted');

        const timestamp = new Date().toISOString();
        const reminder = {
            ...reminderData,
            id: reminderData.id || this.#generateId(),
            updatedAt: timestamp,
            createdAt: reminderData.createdAt || timestamp
        };

        // Update existing or add new
        const existingIndex = data.reminders.findIndex(r => r.id === reminder.id);
        if (existingIndex >= 0) {
            data.reminders[existingIndex] = reminder;
        } else {
            data.reminders.push(reminder);
        }

        this.#setRawData(data);
        console.log(`💾 Reminder saved to localStorage: ${reminder.title}`);

        return reminder;
    }

    /**
     * Get reminders with filtering support
     */
    async getReminders(userId, filters = {}) {
        await this.#ensureReady();

        const data = this.#getRawData();
        if (!data?.reminders) return [];

        let reminders = data.reminders.filter(reminder =>
            !userId || reminder.userId === userId
        );

        // Apply filters
        if (filters.status) {
            reminders = reminders.filter(r => r.status === filters.status);
        }
        if (filters.category) {
            reminders = reminders.filter(r => r.category === filters.category);
        }
        if (filters.priority) {
            reminders = reminders.filter(r => r.priority === filters.priority);
        }

        // Sort results
        const sortBy = filters.sortBy || 'datetime';
        reminders.sort(this.#getSortFunction(sortBy));

        console.log(`📄 Retrieved ${reminders.length} reminders from localStorage`);
        return reminders;
    }

    /**
     * Get reminder by ID
     */
    async getReminderById(id) {
        await this.#ensureReady();

        const data = this.#getRawData();
        if (!data?.reminders) return null;

        return data.reminders.find(reminder => reminder.id === id) || null;
    }

    /**
     * Update existing reminder
     */
    async updateReminder(id, updates) {
        const existing = await this.getReminderById(id);
        if (!existing) {
            throw new Error(`Reminder with id ${id} not found`);
        }

        const updatedReminder = {
            ...existing,
            ...updates,
            id,
            updatedAt: new Date().toISOString()
        };

        return this.saveReminder(updatedReminder);
    }

    /**
     * Delete reminder by ID
     */
    async deleteReminder(id) {
        await this.#ensureReady();

        const data = this.#getRawData();
        if (!data?.reminders) return false;

        const initialLength = data.reminders.length;
        data.reminders = data.reminders.filter(reminder => reminder.id !== id);

        if (data.reminders.length < initialLength) {
            this.#setRawData(data);
            console.log(`🗑️ Reminder deleted from localStorage: ${id}`);
            return true;
        }

        return false;
    }

    /**
     * Delete reminders by status
     */
    async deleteRemindersByStatus(userId, status) {
        const reminders = await this.getReminders(userId, { status });
        const deletePromises = reminders.map(r => this.deleteReminder(r.id));

        await Promise.all(deletePromises);
        console.log(`🧹 Deleted ${reminders.length} ${status} reminders from localStorage`);

        return reminders.length;
    }

    // === USER PREFERENCES ===

    /**
     * Save user preferences
     */
    async saveUserPreferences(userId, preferences) {
        await this.#ensureReady();

        const data = this.#getRawData();
        if (!data) throw new Error('Storage data corrupted');

        data.userPreferences[userId] = {
            ...preferences,
            userId,
            updatedAt: new Date().toISOString()
        };

        this.#setRawData(data);
        console.log(`⚙️ User preferences saved to localStorage: ${userId}`);

        return data.userPreferences[userId];
    }

    /**
     * Get user preferences
     */
    async getUserPreferences(userId) {
        await this.#ensureReady();

        const data = this.#getRawData();
        return data?.userPreferences?.[userId] || null;
    }

    // === METADATA OPERATIONS ===

    /**
     * Save metadata
     */
    async saveMetadata(key, value) {
        await this.#ensureReady();

        const data = this.#getRawData();
        if (!data) throw new Error('Storage data corrupted');

        data.metadata[key] = {
            key,
            value,
            timestamp: new Date().toISOString()
        };

        this.#setRawData(data);
        return data.metadata[key];
    }

    /**
     * Get metadata
     */
    async getMetadata(key) {
        await this.#ensureReady();

        const data = this.#getRawData();
        const metadata = data?.metadata?.[key];
        return metadata ? metadata.value : null;
    }

    // === ANALYTICS & STATISTICS ===

    /**
     * Get comprehensive statistics
     */
    async getStatistics(userId) {
        const reminders = await this.getReminders(userId);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return {
            total: reminders.length,
            active: reminders.filter(r => r.status === 'active').length,
            completed: reminders.filter(r => r.status === 'completed').length,
            overdue: reminders.filter(r => r.status === 'overdue').length,
            completedToday: reminders.filter(r =>
                r.status === 'completed' &&
                r.updatedAt &&
                new Date(r.updatedAt) >= today &&
                new Date(r.updatedAt) < tomorrow
            ).length,
            totalConfiguredAlerts: reminders.reduce((sum, r) =>
                sum + (r.alertTimings?.length || 0), 0
            ),
            averageAlertsPerReminder: reminders.length > 0
                ? Math.round((reminders.reduce((sum, r) =>
                sum + (r.alertTimings?.length || 0), 0) / reminders.length) * 10) / 10
                : 0,
            storageType: 'localStorage',
            storageSize: this.#getStorageSize()
        };
    }

    /**
     * Get current storage size
     */
    #getStorageSize() {
        try {
            const data = localStorage.getItem(FallbackStorageService.#STORAGE_KEY);
            const sizeBytes = new Blob([data || '']).size;
            const sizeKB = Math.round(sizeBytes / 1024);
            return `${sizeKB} KB`;
        } catch {
            return 'Unknown';
        }
    }

    // === DATA EXPORT/IMPORT ===

    /**
     * Export all data
     */
    async exportAllData(userId) {
        const [reminders, preferences] = await Promise.all([
            this.getReminders(userId),
            this.getUserPreferences(userId)
        ]);

        const data = this.#getRawData();

        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            userId,
            storageType: 'localStorage',
            reminders,
            preferences,
            metadata: data?.metadata || {},
            statistics: await this.getStatistics(userId)
        };
    }

    /**
     * Import data from export
     */
    async importData(importData, userId) {
        const { reminders = [], preferences = null } = importData;

        // Import reminders
        const importPromises = reminders.map(reminder =>
            this.saveReminder({ ...reminder, userId, id: undefined })
        );

        const results = await Promise.all(importPromises);

        // Import preferences
        if (preferences) {
            await this.saveUserPreferences(userId, preferences);
        }

        console.log(`📥 Imported ${results.length} reminders to localStorage`);
        return results;
    }

    // === MAINTENANCE ===

    /**
     * Clear all user data
     */
    async clearUserData(userId) {
        const reminders = await this.getReminders(userId);
        const deletePromises = reminders.map(r => this.deleteReminder(r.id));

        await Promise.all([
            ...deletePromises,
            this.#deleteUserPreferences(userId)
        ]);

        console.log(`🧹 Cleared all localStorage data for user: ${userId}`);
        return reminders.length;
    }

    /**
     * Delete user preferences
     */
    async #deleteUserPreferences(userId) {
        const data = this.#getRawData();
        if (data?.userPreferences?.[userId]) {
            delete data.userPreferences[userId];
            this.#setRawData(data);
        }
    }

    /**
     * Get database information
     */
    async getDatabaseInfo() {
        const data = this.#getRawData();
        const storageSize = this.#getStorageSize();

        return {
            name: 'localStorage',
            version: data?.version || 1,
            type: 'Fallback Storage',
            size: storageSize,
            available: this.#isAvailable,
            created: data?.created || 'Unknown'
        };
    }

    /**
     * Get sort function for different sort types
     */
    #getSortFunction(sortBy) {
        const sortFunctions = {
            datetime: (a, b) => new Date(a.datetime) - new Date(b.datetime),
            priority: (a, b) => (b.priority || 2) - (a.priority || 2),
            title: (a, b) => (a.title || '').localeCompare(b.title || ''),
            created: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
            updated: (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        };

        return sortFunctions[sortBy] || sortFunctions.datetime;
    }

    /**
     * Cleanup resources
     */
    async close() {
        // localStorage doesn't need explicit closing
        console.log('📦 FallbackStorageService connection closed');
    }
}
