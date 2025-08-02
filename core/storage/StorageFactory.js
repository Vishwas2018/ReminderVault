/**
 * Fixed Storage Factory - Intelligent storage service selection
 * Automatically chooses the best available storage mechanism
 */

import { IndexedDBStorage } from './IndexedDBStorage.js';
import { LocalStorageAdapter } from './LocalStorageAdapter.js';
import { MemoryStorage } from './MemoryStorage.js';
import { StorageError, ERROR_CODES } from '../../types/interfaces.js';

export class StorageFactory {
  static instance = null;
  static storageCache = new Map();
  static capabilities = null;

  static async getInstance(userId = 'default') {
    const cacheKey = `storage_${userId}`;

    if (this.storageCache.has(cacheKey)) {
      return this.storageCache.get(cacheKey);
    }

    const storageService = await this.createOptimalStorage(userId);
    this.storageCache.set(cacheKey, storageService);

    return storageService;
  }

  static async createOptimalStorage(userId) {
    await this.evaluateCapabilities();

    const strategies = [
      () => this._tryIndexedDB(),
      () => this._tryLocalStorage(),
      () => this._createMemoryStorage()
    ];

    for (const strategy of strategies) {
      try {
        const service = await strategy();
        const storageType = service.constructor.name;

        console.log(`✅ Storage initialized: ${storageType} for user: ${userId}`);
        return this._wrapWithMetrics(service, storageType);

      } catch (error) {
        console.warn('Storage strategy failed:', error.message);
        continue;
      }
    }

    throw new StorageError('No storage mechanism available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  static async evaluateCapabilities() {
    if (this.capabilities) return this.capabilities;

    this.capabilities = {
      indexedDB: await this._testIndexedDB(),
      localStorage: await this._testLocalStorage(),
      evaluated: true
    };

    return this.capabilities;
  }

  static async _testIndexedDB() {
    const checks = {
      apiExists: IndexedDBStorage.isSupported(),
      operational: false,
      privateMode: false
    };

    if (!checks.apiExists) {
      return { available: false, reason: 'API_MISSING', checks };
    }

    try {
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

  static async _testLocalStorage() {
    const checks = {
      apiExists: LocalStorageAdapter.isSupported(),
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
        checks.quota = await this._estimateLocalStorageQuota();
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

  static async _estimateLocalStorageQuota() {
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

  static async _tryIndexedDB() {
    if (!this.capabilities.indexedDB?.available) {
      throw new StorageError(`IndexedDB unavailable: ${this.capabilities.indexedDB?.reason}`);
    }

    const service = new IndexedDBStorage();
    await service.initialize();
    return service;
  }

  static async _tryLocalStorage() {
    if (!this.capabilities.localStorage?.available) {
      throw new StorageError(`localStorage unavailable: ${this.capabilities.localStorage?.reason}`);
    }

    const service = new LocalStorageAdapter();
    await service.initialize();
    return service;
  }

  static async _createMemoryStorage() {
    const service = new MemoryStorage();
    await service.initialize();
    return service;
  }

  // Fixed wrapper that properly handles method calls
  static _wrapWithMetrics(service, storageType) {
    const monitoredMethods = [
      'saveReminder', 'getReminders', 'updateReminder', 'deleteReminder',
      'saveUserPreferences', 'getUserPreferences', 'exportAllData', 'clearUserData'
    ];

    return new Proxy(service, {
      get(target, prop, receiver) {
        const originalMethod = Reflect.get(target, prop, receiver);

        if (typeof originalMethod === 'function' && monitoredMethods.includes(prop)) {
          return async function(...args) {
            const startTime = performance.now();
            const operationId = `${storageType}.${prop}`;

            try {
              // Ensure 'this' context is preserved
              const result = await originalMethod.apply(target, args);
              const duration = performance.now() - startTime;

              StorageFactory._logMetric(operationId, duration, 'success');
              return result;

            } catch (error) {
              const duration = performance.now() - startTime;
              StorageFactory._logMetric(operationId, duration, 'error', error.message);
              throw error;
            }
          };
        }

        // Bind other methods to maintain context
        if (typeof originalMethod === 'function') {
          return originalMethod.bind(target);
        }

        return originalMethod;
      }
    });
  }

  static _logMetric(operation, duration, status, error = null) {
    const metric = {
      operation,
      duration: Math.round(duration * 100) / 100,
      status,
      timestamp: new Date().toISOString(),
      ...(error && { error })
    };

    if (duration > 1000) { // Log slow operations
      console.warn('🐌 Slow storage operation:', metric);
    } else {
      console.debug('📊 Storage metric:', metric);
    }
  }

  static async getCapabilitiesReport() {
    await this.evaluateCapabilities();

    return {
      timestamp: new Date().toISOString(),
      browser: this._getBrowserInfo(),
      capabilities: this.capabilities,
      recommendations: this._getStorageRecommendations()
    };
  }

  static _getBrowserInfo() {
    const { userAgent } = navigator;
    const isPrivate = this.capabilities?.indexedDB?.checks?.privateMode || false;

    return {
      userAgent,
      isPrivateMode: isPrivate,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      language: navigator.language,
      platform: navigator.platform
    };
  }

  static _getStorageRecommendations() {
    const { indexedDB, localStorage } = this.capabilities;
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

  static clearCache() {
    this.storageCache.clear();
    this.capabilities = null;
    console.log('🧹 Storage factory cache cleared');
  }

  static async createSpecificStorage(type, userId = 'default') {
    const factories = {
      indexeddb: () => new IndexedDBStorage(),
      localstorage: () => new LocalStorageAdapter(),
      memory: () => new MemoryStorage()
    };

    const factory = factories[type.toLowerCase()];
    if (!factory) {
      throw new StorageError(`Unknown storage type: ${type}`, ERROR_CODES.VALIDATION_ERROR);
    }

    const service = factory();
    await service.initialize();

    console.log(`🔧 Force-created ${type} storage for testing`);
    return service;
  }

  static async healthCheck(storageService) {
    if (!storageService) {
      return {
        healthy: false,
        error: 'No storage service provided',
        timestamp: new Date().toISOString()
      };
    }

    try {
      return await storageService.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        storageType: storageService.constructor.name
      };
    }
  }

  static getStorageTypeFromService(service) {
    if (!service) return 'Unknown';

    const constructorName = service.constructor.name;
    const typeMapping = {
      'IndexedDBStorage': 'IndexedDB',
      'LocalStorageAdapter': 'localStorage',
      'MemoryStorage': 'Memory'
    };

    return typeMapping[constructorName] || constructorName;
  }
}