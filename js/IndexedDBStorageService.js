/**
 * Modern IndexedDB Storage Service
 * Provides persistent storage for reminders with efficient querying and error handling
 */

export class IndexedDBStorageService {
    static #DB_NAME = 'RemindersVaultDB';
    static #DB_VERSION = 1;
    static #STORES = {
        REMINDERS: 'reminders',
        USER_PREFERENCES: 'userPreferences',
        METADATA: 'metadata'
    };

    #db = null;
    #initPromise = null;

    constructor() {
        this.#initPromise = this.#initialize();
    }

    // Ensure database is ready before any operation
    async #ensureReady() {
        if (!this.#db) {
            await this.#initPromise;
        }
        return this.#db;
    }

    async #initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(
                IndexedDBStorageService.#DB_NAME,
                IndexedDBStorageService.#DB_VERSION
            );

            request.onerror = () => {
                console.error('IndexedDB initialization failed:', request.error);
                reject(new Error(`Database initialization failed: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                this.#db = request.result;
                this.#setupErrorHandlers();
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.#db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.#createObjectStores(db);
            };
        });
    }

    #createObjectStores(db) {
        // Reminders store with comprehensive indexing
        if (!db.objectStoreNames.contains(IndexedDBStorageService.#STORES.REMINDERS)) {
            const reminderStore = db.createObjectStore(
                IndexedDBStorageService.#STORES.REMINDERS,
                { keyPath: 'id', autoIncrement: true }
            );

            // Create indexes for efficient querying
            reminderStore.createIndex('userId', 'userId', { unique: false });
            reminderStore.createIndex('status', 'status', { unique: false });
            reminderStore.createIndex('datetime', 'datetime', { unique: false });
            reminderStore.createIndex('priority', 'priority', { unique: false });
            reminderStore.createIndex('category', 'category', { unique: false });
            reminderStore.createIndex('createdAt', 'createdAt', { unique: false });
            reminderStore.createIndex('updatedAt', 'updatedAt', { unique: false });

            // Compound indexes for complex queries
            reminderStore.createIndex('userStatus', ['userId', 'status'], { unique: false });
            reminderStore.createIndex('userDateTime', ['userId', 'datetime'], { unique: false });
        }

        // User preferences store
        if (!db.objectStoreNames.contains(IndexedDBStorageService.#STORES.USER_PREFERENCES)) {
            db.createObjectStore(
                IndexedDBStorageService.#STORES.USER_PREFERENCES,
                { keyPath: 'userId' }
            );
        }

        // Metadata store for app configuration
        if (!db.objectStoreNames.contains(IndexedDBStorageService.#STORES.METADATA)) {
            db.createObjectStore(
                IndexedDBStorageService.#STORES.METADATA,
                { keyPath: 'key' }
            );
        }

        console.log('📦 IndexedDB object stores created');
    }

    #setupErrorHandlers() {
        this.#db.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
        };

        this.#db.onversionchange = () => {
            console.warn('IndexedDB version changed, closing connection');
            this.#db.close();
            this.#db = null;
        };
    }

    // Generic transaction wrapper with error handling
    async #executeTransaction(storeNames, mode, operation) {
        const db = await this.#ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            const stores = Array.isArray(storeNames)
                ? storeNames.map(name => transaction.objectStore(name))
                : transaction.objectStore(storeNames);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(new Error('Transaction aborted'));

            try {
                const result = operation(stores, transaction);
                if (result instanceof Promise) {
                    result.then(resolve).catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Reminder CRUD Operations
    async saveReminder(reminderData) {
        const timestamp = new Date().toISOString();
        const reminder = {
            ...reminderData,
            updatedAt: timestamp,
            createdAt: reminderData.createdAt || timestamp
        };

        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.REMINDERS,
            'readwrite',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.put(reminder);
                    request.onsuccess = () => {
                        const savedReminder = { ...reminder, id: request.result };
                        console.log(`💾 Reminder saved: ${savedReminder.title}`);
                        resolve(savedReminder);
                    };
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async getReminders(userId, filters = {}) {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.REMINDERS,
            'readonly',
            (store) => {
                return new Promise((resolve, reject) => {
                    const reminders = [];
                    let request;

                    // Use appropriate index based on filters
                    if (filters.status && userId) {
                        const index = store.index('userStatus');
                        request = index.openCursor([userId, filters.status]);
                    } else if (userId) {
                        const index = store.index('userId');
                        request = index.openCursor(userId);
                    } else {
                        request = store.openCursor();
                    }

                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const reminder = cursor.value;

                            // Apply additional filters
                            if (this.#matchesFilters(reminder, filters)) {
                                reminders.push(reminder);
                            }

                            cursor.continue();
                        } else {
                            console.log(`📄 Retrieved ${reminders.length} reminders`);
                            resolve(this.#sortReminders(reminders, filters.sortBy));
                        }
                    };

                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async getReminderById(id) {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.REMINDERS,
            'readonly',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.get(id);
                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

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

    async deleteReminder(id) {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.REMINDERS,
            'readwrite',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(id);
                    request.onsuccess = () => {
                        console.log(`🗑️ Reminder deleted: ${id}`);
                        resolve(true);
                    };
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async deleteRemindersByStatus(userId, status) {
        const reminders = await this.getReminders(userId, { status });
        const deletePromises = reminders.map(r => this.deleteReminder(r.id));

        await Promise.all(deletePromises);
        console.log(`🧹 Deleted ${reminders.length} ${status} reminders`);

        return reminders.length;
    }

    // User Preferences Operations
    async saveUserPreferences(userId, preferences) {
        const userPrefs = {
            userId,
            ...preferences,
            updatedAt: new Date().toISOString()
        };

        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.USER_PREFERENCES,
            'readwrite',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.put(userPrefs);
                    request.onsuccess = () => {
                        console.log(`⚙️ User preferences saved for: ${userId}`);
                        resolve(userPrefs);
                    };
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async getUserPreferences(userId) {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.USER_PREFERENCES,
            'readonly',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.get(userId);
                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    // Metadata Operations
    async saveMetadata(key, value) {
        const metadata = {
            key,
            value,
            timestamp: new Date().toISOString()
        };

        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.METADATA,
            'readwrite',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.put(metadata);
                    request.onsuccess = () => resolve(metadata);
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async getMetadata(key) {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.METADATA,
            'readonly',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.get(key);
                    request.onsuccess = () => {
                        const result = request.result;
                        resolve(result ? result.value : null);
                    };
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    // Analytics and Statistics
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
                new Date(r.updatedAt) >= today &&
                new Date(r.updatedAt) < tomorrow
            ).length,
            totalAlerts: reminders.reduce((sum, r) => sum + (r.alertTimings?.length || 0), 0),
            averageAlertsPerReminder: reminders.length > 0
                ? Math.round((reminders.reduce((sum, r) => sum + (r.alertTimings?.length || 0), 0) / reminders.length) * 10) / 10
                : 0,
            categories: this.#getCategoryStats(reminders),
            priorities: this.#getPriorityStats(reminders)
        };
    }

    // Data Export/Import
    async exportAllData(userId) {
        const [reminders, preferences, metadata] = await Promise.all([
            this.getReminders(userId),
            this.getUserPreferences(userId),
            this.#getAllMetadata()
        ]);

        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            userId,
            reminders,
            preferences,
            metadata,
            statistics: await this.getStatistics(userId)
        };
    }

    async importData(data, userId) {
        const { reminders = [], preferences = null } = data;

        // Import reminders
        const importPromises = reminders.map(reminder =>
            this.saveReminder({ ...reminder, userId, id: undefined })
        );

        const results = await Promise.all(importPromises);

        // Import preferences
        if (preferences) {
            await this.saveUserPreferences(userId, preferences);
        }

        console.log(`📥 Imported ${results.length} reminders`);
        return results;
    }

    // Database Maintenance
    async clearUserData(userId) {
        const reminders = await this.getReminders(userId);
        const deletePromises = reminders.map(r => this.deleteReminder(r.id));

        await Promise.all([
            ...deletePromises,
            this.#deleteUserPreferences(userId)
        ]);

        console.log(`🧹 Cleared all data for user: ${userId}`);
        return reminders.length;
    }

    async getDatabaseInfo() {
        const db = await this.#ensureReady();

        return {
            name: db.name,
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
            size: await this.#estimateDbSize()
        };
    }

    // Private Helper Methods
    #matchesFilters(reminder, filters) {
        if (filters.category && reminder.category !== filters.category) return false;
        if (filters.priority && reminder.priority !== filters.priority) return false;
        if (filters.dateFrom && new Date(reminder.datetime) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && new Date(reminder.datetime) > new Date(filters.dateTo)) return false;

        return true;
    }

    #sortReminders(reminders, sortBy = 'datetime') {
        const sortFunctions = {
            datetime: (a, b) => new Date(a.datetime) - new Date(b.datetime),
            priority: (a, b) => b.priority - a.priority,
            title: (a, b) => a.title.localeCompare(b.title),
            created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            updated: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        };

        return reminders.sort(sortFunctions[sortBy] || sortFunctions.datetime);
    }

    #getCategoryStats(reminders) {
        return reminders.reduce((stats, reminder) => {
            stats[reminder.category] = (stats[reminder.category] || 0) + 1;
            return stats;
        }, {});
    }

    #getPriorityStats(reminders) {
        return reminders.reduce((stats, reminder) => {
            const priority = reminder.priority || 2;
            stats[priority] = (stats[priority] || 0) + 1;
            return stats;
        }, {});
    }

    async #getAllMetadata() {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.METADATA,
            'readonly',
            (store) => {
                return new Promise((resolve, reject) => {
                    const metadata = {};
                    const request = store.openCursor();

                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            metadata[cursor.value.key] = cursor.value.value;
                            cursor.continue();
                        } else {
                            resolve(metadata);
                        }
                    };

                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async #deleteUserPreferences(userId) {
        return this.#executeTransaction(
            IndexedDBStorageService.#STORES.USER_PREFERENCES,
            'readwrite',
            (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(userId);
                    request.onsuccess = () => resolve(true);
                    request.onerror = () => reject(request.error);
                });
            }
        );
    }

    async #estimateDbSize() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    quota: estimate.quota,
                    usage: estimate.usage,
                    available: estimate.quota - estimate.usage
                };
            } catch (error) {
                console.warn('Failed to estimate storage:', error);
            }
        }

        return { quota: 'unknown', usage: 'unknown', available: 'unknown' };
    }

    // Cleanup
    async close() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
            console.log('📦 IndexedDB connection closed');
        }
    }
}