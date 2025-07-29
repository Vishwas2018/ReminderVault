/**
 * StorageFactory - Intelligent storage service selection with graceful degradation
 * Automatically selects the best available storage mechanism with comprehensive fallback strategy
 */

import { IndexedDBStorageService } from './IndexedDBStorageService.js';
import { FallbackStorageService } from './FallbackStorageService.js';

export class StorageFactory {
    static #instance = null;
    static #storageServiceCache = new Map();

    // Storage capability detection results
    static #capabilities = {
        indexedDB: null,
        localStorage: null,
        evaluated: false
    };

    /**
     * Singleton pattern - ensures consistent storage service across app
     */
    static async getInstance(userId = 'default') {
        const cacheKey = `storage_${userId}`;

        if (this.#storageServiceCache.has(cacheKey)) {
            return this.#storageServiceCache.get(cacheKey);
        }

        const storageService = await this.createOptimalStorage(userId);
        this.#storageServiceCache.set(cacheKey, storageService);

        return storageService;
    }

    /**
     * Create optimal storage service based on browser capabilities
     */
    static async createOptimalStorage(userId = 'default') {
        await this.#evaluateCapabilities();

        const strategies = [
            () => this.#tryIndexedDB(),
            () => this.#tryLocalStorage(),
            () => this.#createMemoryStorage()
        ];

        for (const strategy of strategies) {
            try {
                const service = await strategy();
                const storageType = service.constructor.name;

                console.log(`✅ Storage initialized: ${storageType} for user: ${userId}`);
                return this.#wrapWithMetrics(service, storageType);

            } catch (error) {
                console.warn(`Storage strategy failed:`, error.message);
                continue;
            }
        }

        throw new Error('No storage mechanism available - all strategies failed');
    }

    /**
     * Evaluate browser storage capabilities comprehensively
     */
    static async #evaluateCapabilities() {
        if (this.#capabilities.evaluated) return this.#capabilities;

        this.#capabilities = {
            indexedDB: await this.#testIndexedDB(),
            localStorage: await this.#testLocalStorage(),
            evaluated: true
        };

        return this.#capabilities;
    }

    /**
     * Test IndexedDB availability and functionality
     */
    static async #testIndexedDB() {
        const checks = {
            apiExists: 'indexedDB' in window,
            transactionSupport: 'IDBTransaction' in window,
            keyRangeSupport: 'IDBKeyRange' in window,
            privateMode: false,
            operational: false
        };

        if (!checks.apiExists || !checks.transactionSupport || !checks.keyRangeSupport) {
            return { available: false, reason: 'API_MISSING', checks };
        }

        try {
            // Test for private browsing mode restrictions
            const testDB = await new Promise((resolve, reject) => {
                const request = indexedDB.open('__capability_test__', 1);
                const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);

                request.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error(`IndexedDB error: ${request.error?.message}`));
                };

                request.onsuccess = () => {
                    clearTimeout(timeout);
                    resolve(request.result);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('test')) {
                        db.createObjectStore('test', { keyPath: 'id' });
                    }
                };
            });

            // Test basic operations
            await new Promise((resolve, reject) => {
                const transaction = testDB.transaction(['test'], 'readwrite');
                const store = transaction.objectStore('test');

                store.add({ id: 1, data: 'test' });

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });

            testDB.close();
            indexedDB.deleteDatabase('__capability_test__');

            checks.operational = true;
            return { available: true, checks };

        } catch (error) {
            if (error.name === 'InvalidStateError' || error.message.includes('private')) {
                checks.privateMode = true;
                return { available: false, reason: 'PRIVATE_MODE', checks };
            }

            return { available: false, reason: 'OPERATIONAL_FAILURE', error: error.message, checks };
        }
    }

    /**
     * Test localStorage availability and quota
     */
    static async #testLocalStorage() {
        const checks = {
            apiExists: 'localStorage' in window,
            writable: false,
            quota: 0
        };

        if (!checks.apiExists) {
            return { available: false, reason: 'API_MISSING', checks };
        }

        try {
            const testKey = '__storage_capability_test__';
            const testValue = 'capability_test_data';

            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);

            checks.writable = retrieved === testValue;

            if (checks.writable) {
                checks.quota = await this.#estimateLocalStorageQuota();
            }

            return {
                available: checks.writable,
                quota: checks.quota,
                checks
            };

        } catch (error) {
            return {
                available: false,
                reason: 'WRITE_FAILURE',
                error: error.message,
                checks
            };
        }
    }

    /**
     * Estimate localStorage quota through binary search
     */
    static async #estimateLocalStorageQuota() {
        const testKey = '__quota_test__';
        let size = 1024; // Start with 1KB
        let maxSize = 0;

        try {
            // Find approximate maximum by doubling
            while (size <= 10 * 1024 * 1024) { // Cap at 10MB
                try {
                    const testData = 'x'.repeat(size);
                    localStorage.setItem(testKey, testData);
                    localStorage.removeItem(testKey);
                    maxSize = size;
                    size *= 2;
                } catch {
                    break;
                }
            }

            return maxSize;
        } catch {
            return 0;
        }
    }

    /**
     * Attempt to create IndexedDB storage service
     */
    static async #tryIndexedDB() {
        if (!this.#capabilities.indexedDB?.available) {
            throw new Error(`IndexedDB unavailable: ${this.#capabilities.indexedDB?.reason}`);
        }

        const service = new IndexedDBStorageService();
        await service; // Trigger initialization

        return service;
    }

    /**
     * Attempt to create localStorage fallback service
     */
    static async #tryLocalStorage() {
        if (!this.#capabilities.localStorage?.available) {
            throw new Error(`localStorage unavailable: ${this.#capabilities.localStorage?.reason}`);
        }

        const service = new FallbackStorageService();
        await service; // Trigger initialization

        return service;
    }

    /**
     * Create in-memory storage as last resort
     */
    static async #createMemoryStorage() {
        return new MemoryStorageService();
    }

    /**
     * Wrap storage service with performance metrics and monitoring
     */
    static #wrapWithMetrics(service, storageType) {
        const factory = this; // Capture context for static methods

        return new Proxy(service, {
            get(target, prop, receiver) {
                const originalMethod = Reflect.get(target, prop, receiver);

                if (typeof originalMethod === 'function' && factory.#shouldMonitor(prop)) {
                    return async function(...args) {
                        const startTime = performance.now();
                        const operationId = `${storageType}.${prop}`;

                        try {
                            const result = await originalMethod.apply(target, args);
                            const duration = performance.now() - startTime;

                            factory.#logMetric(operationId, duration, 'success');
                            return result;

                        } catch (error) {
                            const duration = performance.now() - startTime;
                            factory.#logMetric(operationId, duration, 'error', error.message);
                            throw error;
                        }
                    };
                }

                return originalMethod;
            }
        });
    }

    /**
     * Check if method should be monitored for performance metrics
     */
    static #shouldMonitor(methodName) {
        const monitoredMethods = [
            'saveReminder', 'getReminders', 'updateReminder', 'deleteReminder',
            'saveUserPreferences', 'getUserPreferences', 'exportAllData'
        ];
        return monitoredMethods.includes(methodName);
    }

    /**
     * Log performance metrics for storage operations
     */
    static #logMetric(operation, duration, status, error = null) {
        const metric = {
            operation,
            duration: Math.round(duration * 100) / 100,
            status,
            timestamp: new Date().toISOString(),
            ...(error && { error })
        };

        console.debug(`📊 Storage metric:`, metric);
    }

    /**
     * Get comprehensive storage capabilities report
     */
    static async getCapabilitiesReport() {
        await this.#evaluateCapabilities();

        return {
            timestamp: new Date().toISOString(),
            browser: this.#getBrowserInfo(),
            capabilities: this.#capabilities,
            recommendations: this.#getStorageRecommendations()
        };
    }

    /**
     * Get browser information for diagnostics
     */
    static #getBrowserInfo() {
        const { userAgent } = navigator;
        const isPrivate = this.#capabilities.indexedDB?.checks?.privateMode || false;

        return {
            userAgent,
            isPrivateMode: isPrivate,
            cookiesEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };
    }

    /**
     * Generate storage recommendations based on capabilities
     */
    static #getStorageRecommendations() {
        const { indexedDB, localStorage } = this.#capabilities;
        const recommendations = [];

        if (!indexedDB?.available) {
            if (indexedDB?.reason === 'PRIVATE_MODE') {
                recommendations.push({
                    type: 'warning',
                    message: 'Private browsing detected. Data will not persist between sessions.',
                    action: 'Consider using normal browsing mode for data persistence.'
                });
            } else {
                recommendations.push({
                    type: 'info',
                    message: 'IndexedDB not available. Using localStorage fallback.',
                    action: 'Upgrade browser for better performance and storage capacity.'
                });
            }
        }

        if (!localStorage?.available) {
            recommendations.push({
                type: 'error',
                message: 'No persistent storage available.',
                action: 'Enable cookies and local storage in browser settings.'
            });
        } else if (localStorage?.quota < 1024 * 1024) { // Less than 1MB
            recommendations.push({
                type: 'warning',
                message: 'Limited storage space available.',
                action: 'Clear browser data or use a different browser.'
            });
        }

        return recommendations;
    }

    /**
     * Clear all cached storage instances
     */
    static clearCache() {
        this.#storageServiceCache.clear();
        this.#capabilities.evaluated = false;
        console.log('🧹 Storage factory cache cleared');
    }

    /**
     * Force storage type for testing purposes
     */
    static async createSpecificStorage(type, userId = 'default') {
        const factories = {
            indexeddb: () => new IndexedDBStorageService(),
            localstorage: () => new FallbackStorageService(),
            memory: () => new MemoryStorageService()
        };

        const factory = factories[type.toLowerCase()];
        if (!factory) {
            throw new Error(`Unknown storage type: ${type}`);
        }

        const service = factory();
        await service; // Trigger initialization

        console.log(`🔧 Force-created ${type} storage for testing`);
        return service;
    }
}

/**
 * Emergency in-memory storage service for extreme fallback scenarios
 */
class MemoryStorageService {
    #data = { reminders: [], userPreferences: {}, metadata: {} };
    #initialized = true;

    async saveReminder(reminderData) {
        const reminder = {
            ...reminderData,
            id: reminderData.id || Date.now() + Math.random(),
            createdAt: reminderData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const existingIndex = this.#data.reminders.findIndex(r => r.id === reminder.id);
        if (existingIndex >= 0) {
            this.#data.reminders[existingIndex] = reminder;
        } else {
            this.#data.reminders.push(reminder);
        }

        return reminder;
    }

    async getReminders(userId, filters = {}) {
        let reminders = this.#data.reminders.filter(r => !userId || r.userId === userId);

        if (filters.status) {
            reminders = reminders.filter(r => r.status === filters.status);
        }

        return reminders;
    }

    async getReminderById(id) {
        return this.#data.reminders.find(r => r.id === id) || null;
    }

    async updateReminder(id, updates) {
        const existing = await this.getReminderById(id);
        if (!existing) throw new Error(`Reminder ${id} not found`);

        return this.saveReminder({ ...existing, ...updates, id });
    }

    async deleteReminder(id) {
        const initialLength = this.#data.reminders.length;
        this.#data.reminders = this.#data.reminders.filter(r => r.id !== id);
        return this.#data.reminders.length < initialLength;
    }

    async saveUserPreferences(userId, preferences) {
        this.#data.userPreferences[userId] = { ...preferences, userId };
        return this.#data.userPreferences[userId];
    }

    async getUserPreferences(userId) {
        return this.#data.userPreferences[userId] || null;
    }

    async getStatistics(userId) {
        const reminders = await this.getReminders(userId);
        return {
            total: reminders.length,
            active: reminders.filter(r => r.status === 'active').length,
            completed: reminders.filter(r => r.status === 'completed').length,
            overdue: reminders.filter(r => r.status === 'overdue').length,
            storageType: 'memory'
        };
    }

    async exportAllData(userId) {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            userId,
            storageType: 'memory',
            reminders: await this.getReminders(userId),
            preferences: await this.getUserPreferences(userId),
            warning: 'Data from memory storage - will be lost on page refresh'
        };
    }

    async clearUserData(userId) {
        const reminders = await this.getReminders(userId);
        this.#data.reminders = this.#data.reminders.filter(r => r.userId !== userId);
        delete this.#data.userPreferences[userId];
        return reminders.length;
    }

    async getDatabaseInfo() {
        return {
            name: 'Memory Storage',
            type: 'Emergency Fallback',
            persistent: false,
            size: `${JSON.stringify(this.#data).length} bytes`
        };
    }

    async close() {
        console.log('🧠 Memory storage closed - data will be lost');
    }
}