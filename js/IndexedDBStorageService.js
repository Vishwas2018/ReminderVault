/**
 * Complete IndexedDBStorageService implementation
 * Modern, efficient CRUD operations with comprehensive error handling
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
    #isInitialized = false;

    constructor() {
        this.#initPromise = this.#initialize();
    }

    // [Previous initialization code remains the same - keeping existing implementation]
    static isSupported() {
        const requiredAPIs = [
            () => 'indexedDB' in window,
            () => 'IDBTransaction' in window,
            () => 'IDBKeyRange' in window,
            () => typeof window.indexedDB?.open === 'function'
        ];

        return requiredAPIs.every(check => {
            try {
                return check();
            } catch {
                return false;
            }
        });
    }

    async #initialize() {
        if (this.#isInitialized) return this.#db;

        if (!IndexedDBStorageService.isSupported()) {
            throw new Error('IndexedDB not supported in this browser environment');
        }

        return this.#attemptConnection();
    }

    async #attemptConnection(retryCount = 0) {
        const MAX_RETRIES = 3;
        const TIMEOUT_MS = 15000;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('IndexedDB connection timeout after ${TIMEOUT_MS}ms'));
            }, TIMEOUT_MS);

            let request;
            try {
                request = indexedDB.open(IndexedDBStorageService.#DB_NAME, IndexedDBStorageService.#DB_VERSION);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(new Error('Failed to open IndexedDB: ${error.message}'));
                return;
            }

            request.onerror = () => {
                clearTimeout(timeoutId);
                const error = request.error;
                if (this.#isQuotaError(error) && retryCount < MAX_RETRIES) {
                    console.warn('IndexedDB quota exceeded, attempting cleanup (retry ${retryCount + 1})');
                    setTimeout(() => {
                        this.#attemptConnection(retryCount + 1).then(resolve).catch(reject);
                    }, 1000 * (retryCount + 1));
                    return;
                }
                reject(new Error(this.#getErrorMessage(error)));
            };

            request.onsuccess = () => {
                clearTimeout(timeoutId);
                this.#db = request.result;
                this.#setupErrorHandlers();
                this.#isInitialized = true;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.#db);
            };

            request.onupgradeneeded = (event) => {
                try {
                    const db = event.target.result;
                    this.#createObjectStores(db);
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(new Error('Database upgrade failed: ${error.message}'));
                }
            };
        });
    }

    #createObjectStores(db) {
        if (!db.objectStoreNames.contains(IndexedDBStorageService.#STORES.REMINDERS)) {
            const reminderStore = db.createObjectStore(
                IndexedDBStorageService.#STORES.REMINDERS,
                { keyPath: 'id', autoIncrement: true }
            );

            const indexes = [
                ['userId', 'userId', { unique: false }],
                ['status', 'status', { unique: false }],
                ['datetime', 'datetime', { unique: false }],
                ['priority', 'priority', { unique: false }],
                ['category', 'category', { unique: false }],
                ['userStatus', ['userId', 'status'], { unique: false }]
            ];

            indexes.forEach(([name, keyPath, options]) => {
                try {
                    reminderStore.createIndex(name, keyPath, options);
                } catch (error) {
                    console.warn('Failed to create index ${name}:', error.message);
                }
            });
        }

        if (!db.objectStoreNames.contains(IndexedDBStorageService.#STORES.USER_PREFERENCES)) {
            db.createObjectStore(IndexedDBStorageService.#STORES.USER_PREFERENCES, { keyPath: 'userId' });
        }

        if (!db.objectStoreNames.contains(IndexedDBStorageService.#STORES.METADATA)) {
            db.createObjectStore(IndexedDBStorageService.#STORES.METADATA, { keyPath: 'key' });
        }
    }

    #setupErrorHandlers() {
        this.#db.onerror = (event) => {
            const error = event.target.error;
            console.error('IndexedDB runtime error:', this.#getErrorMessage(error));
        };

        this.#db.onversionchange = () => {
            console.warn('IndexedDB version changed by another connection');
            this.#gracefulClose();
        };

        this.#db.onclose = () => {
            console.warn('IndexedDB connection closed unexpectedly');
            this.#isInitialized = false;
            this.#db = null;
        };
    }

    async #executeTransaction(storeNames, mode, operation) {
        await this.#ensureReady();

        return new Promise((resolve, reject) => {
            let transaction;
            try {
                transaction = this.#db.transaction(storeNames, mode);
            } catch (error) {
                reject(new Error('Transaction creation failed: ${error.message}'));
                return;
            }

            const stores = Array.isArray(storeNames)
                ? storeNames.map(name => transaction.objectStore(name))
                : transaction.objectStore(storeNames);

            let operationResult;
            let hasResolved = false;

            transaction.oncomplete = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve(operationResult);
                }
            };

            transaction.onerror = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    reject(new Error(this.#getErrorMessage(transaction.error)));
                }
            };

            transaction.onabort = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    reject(new Error('Transaction aborted'));
                }
            };

            try {
                const result = operation(stores, transaction);
                if (result instanceof Promise) {
                    result.then(res => operationResult = res).catch(reject);
                } else {
                    operationResult = result;
                }
            } catch (error) {
                if (!hasResolved) {
                    hasResolved = true;
                    reject(new Error('Operation failed: ${error.message}'));
                }
            }
        });
    }

    async #ensureReady() {
        if (this.#isInitialized && this.#db) return this.#db;
        if (!this.#initPromise) this.#initPromise = this.#initialize();
        return this.#initPromise;
    }

    // === CORE CRUD OPERATIONS ===

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
                        console.log('💾 Reminder saved: ${savedReminder.title}');
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

                    // Optimize query using appropriate index
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
                            if (this.#matchesFilters(reminder, filters)) {
                                reminders.push(reminder);
                            }
                            cursor.continue();
                        } else {
                            console.log('📄 Retrieved ${reminders.length} reminders');
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
            throw new Error('Reminder with id ${id} not found');
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
                        console.log('🗑️ Reminder deleted: ${id}');
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
        console.log('🧹 Deleted ${reminders.length} ${status} reminders');
        return reminders.length;
    }

    // === USER PREFERENCES ===

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
                        console.log('⚙️ User preferences saved: ${userId}');
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

    // === METADATA OPERATIONS ===

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

    // === ANALYTICS & STATISTICS ===

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
            storageType: 'IndexedDB'
        };
    }

    // === DATA EXPORT/IMPORT ===

    async exportAllData(userId) {
        const [reminders, preferences] = await Promise.all([
            this.getReminders(userId),
            this.getUserPreferences(userId)
        ]);

        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            userId,
            storageType: 'IndexedDB',
            reminders,
            preferences,
            statistics: await this.getStatistics(userId)
        };
    }

    async importData(importData, userId) {
        const { reminders = [], preferences = null } = importData;

        // Import reminders with batch processing for efficiency
        const batchSize = 50;
        const results = [];

        for (let i = 0; i < reminders.length; i += batchSize) {
            const batch = reminders.slice(i, i + batchSize);
            const batchPromises = batch.map(reminder =>
                this.saveReminder({ ...reminder, userId, id: undefined })
            );
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        // Import preferences if provided
        if (preferences) {
            await this.saveUserPreferences(userId, preferences);
        }

        console.log('📥 Imported ${results.length} reminders to IndexedDB');
        return results;
    }

    // === MAINTENANCE ===

    async clearUserData(userId) {
        const reminders = await this.getReminders(userId);

        // Batch delete for efficiency
        const deletePromises = reminders.map(r => this.deleteReminder(r.id));
        await Promise.all([
            ...deletePromises,
            this.#deleteUserPreferences(userId)
        ]);

        console.log('🧹 Cleared all IndexedDB data for user: ${userId}');
        return reminders.length;
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

    async getDatabaseInfo() {
        try {
            await this.#ensureReady();

            const info = {
                name: this.#db.name,
                version: this.#db.version,
                type: 'IndexedDB',
                objectStoreNames: Array.from(this.#db.objectStoreNames),
                isHealthy: this.#isInitialized && this.#db,
                connectionState: this.#db ? 'connected' : 'disconnected'
            };

            // Add storage estimate if available
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                try {
                    const estimate = await navigator.storage.estimate();
                    info.storageEstimate = {
                        quota: this.#formatBytes(estimate.quota),
                        usage: this.#formatBytes(estimate.usage),
                        available: this.#formatBytes(estimate.quota - estimate.usage),
                        usagePercentage: Math.round((estimate.usage / estimate.quota) * 100)
                    };
                } catch (estimateError) {
                    info.storageEstimate = { error: 'Unavailable' };
                }
            }

            return info;
        } catch (error) {
            return {
                error: error.message,
                isHealthy: false,
                connectionState: 'error'
            };
        }
    }

    // === HELPER METHODS ===

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
            priority: (a, b) => (b.priority || 2) - (a.priority || 2),
            title: (a, b) => (a.title || '').localeCompare(b.title || ''),
            created: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
            updated: (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
            alerts: (a, b) => (b.alertTimings?.length || 0) - (a.alertTimings?.length || 0)
        };

        return reminders.sort(sortFunctions[sortBy] || sortFunctions.datetime);
    }

    #formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const index = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = (bytes / Math.pow(1024, index)).toFixed(1);
        return '${size} ${units[index]}';
    }

    #getErrorMessage(error) {
        const errorMessages = {
            QuotaExceededError: 'Storage quota exceeded. Please clear some data.',
            InvalidStateError: 'Database in invalid state. Try refreshing the page.',
            NotFoundError: 'Requested data not found.',
            VersionError: 'Database version mismatch. Refresh to update.',
            AbortError: 'Operation was cancelled.',
            TimeoutError: 'Operation timed out. Please try again.',
            UnknownError: 'An unexpected database error occurred.'
        };

        const errorName = error?.name || 'UnknownError';
        return errorMessages[errorName] || 'Database error: ${error?.message || 'Unknown'}';
    }

    #isQuotaError(error) {
        return error?.name === 'QuotaExceededError' ||
            error?.message?.includes('quota') ||
            error?.message?.includes('storage');
    }

    #gracefulClose() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
            this.#isInitialized = false;
        }
    }

    async close() {
        if (this.#db) {
            await new Promise(resolve => {
                if (this.#db.transaction) {
                    setTimeout(resolve, 100);
                } else {
                    resolve();
                }
            });

            this.#gracefulClose();
            console.log('📦 IndexedDB connection closed gracefully');
        }
    }
}