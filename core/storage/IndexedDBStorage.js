/**
 * IndexedDB Storage Implementation
 * High-performance, reliable storage for modern browsers with proper error handling
 */

import { StorageInterface } from './StorageInterface.js';
import { StorageError, ERROR_CODES } from '../../types/interfaces.js';
import { APP_CONFIG } from '../../config/constants.js';

export class IndexedDBStorage extends StorageInterface {
  #db = null;
  #dbName = null;
  #dbVersion = null;
  #isInitialized = false;
  #initPromise = null;
  #stores = null;

  constructor() {
    super();
    this.#dbName = APP_CONFIG.storage.dbName;
    this.#dbVersion = APP_CONFIG.storage.dbVersion;

    this.#stores = Object.freeze({
      REMINDERS: 'reminders',
      USER_PREFERENCES: 'userPreferences',
      METADATA: 'metadata'
    });
  }

  static isSupported() {
    return 'indexedDB' in window &&
        'IDBTransaction' in window &&
        'IDBKeyRange' in window;
  }

  async initialize() {
    if (this.#isInitialized) return this.#db;
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = this.#performInitialization();
    return this.#initPromise;
  }

  async #performInitialization() {
    if (!IndexedDBStorage.isSupported()) {
      throw new StorageError(
          'IndexedDB not supported in this browser',
          ERROR_CODES.STORAGE_UNAVAILABLE
      );
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, this.#dbVersion);
      const timeoutId = setTimeout(() => {
        reject(new StorageError('IndexedDB connection timeout', ERROR_CODES.TIMEOUT));
      }, 15000);

      request.onerror = () => {
        clearTimeout(timeoutId);
        const errorMessage = request.error?.message || 'Unknown IndexedDB error';
        reject(new StorageError(
            `IndexedDB initialization failed: ${errorMessage}`,
            ERROR_CODES.STORAGE_UNAVAILABLE
        ));
      };

      request.onsuccess = () => {
        clearTimeout(timeoutId);
        this.#db = request.result;
        this.#setupEventHandlers();
        this.#isInitialized = true;
        console.log('✅ IndexedDB initialized successfully');
        resolve(this.#db);
      };

      request.onupgradeneeded = (event) => {
        try {
          this.#createObjectStores(event.target.result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(new StorageError(
              `Database schema creation failed: ${error.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        }
      };
    });
  }

  #createObjectStores(db) {
    // Create reminders store with comprehensive indexing
    if (!db.objectStoreNames.contains(this.#stores.REMINDERS)) {
      const reminderStore = db.createObjectStore(this.#stores.REMINDERS, {
        keyPath: 'id',
        autoIncrement: false
      });

      // Create indexes for efficient querying
      reminderStore.createIndex('userId', 'userId', { unique: false });
      reminderStore.createIndex('status', 'status', { unique: false });
      reminderStore.createIndex('datetime', 'datetime', { unique: false });
      reminderStore.createIndex('priority', 'priority', { unique: false });
      reminderStore.createIndex('category', 'category', { unique: false });
      reminderStore.createIndex('userStatus', ['userId', 'status'], { unique: false });
      reminderStore.createIndex('userCategory', ['userId', 'category'], { unique: false });
      reminderStore.createIndex('userDatetime', ['userId', 'datetime'], { unique: false });
    }

    // Create user preferences store
    if (!db.objectStoreNames.contains(this.#stores.USER_PREFERENCES)) {
      db.createObjectStore(this.#stores.USER_PREFERENCES, { keyPath: 'userId' });
    }

    // Create metadata store
    if (!db.objectStoreNames.contains(this.#stores.METADATA)) {
      db.createObjectStore(this.#stores.METADATA, { keyPath: 'key' });
    }

    console.log('📦 IndexedDB object stores created');
  }

  #setupEventHandlers() {
    this.#db.onerror = (event) => {
      console.error('IndexedDB runtime error:', event.target.error);
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
    await this.initialize();

    return new Promise((resolve, reject) => {
      let transaction;

      try {
        transaction = this.#db.transaction(storeNames, mode);
      } catch (error) {
        reject(new StorageError(
            `Transaction creation failed: ${error.message}`,
            ERROR_CODES.STORAGE_UNAVAILABLE
        ));
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
          const errorMessage = transaction.error?.message || 'Unknown transaction error';
          reject(new StorageError(
              `Transaction failed: ${errorMessage}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        }
      };

      transaction.onabort = () => {
        if (!hasResolved) {
          hasResolved = true;
          reject(new StorageError('Transaction aborted', ERROR_CODES.STORAGE_UNAVAILABLE));
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
          reject(new StorageError(
              `Operation execution failed: ${error.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        }
      }
    });
  }

  // Core CRUD operations
  async saveReminder(reminderData) {
    this.validateReminderData(reminderData);

    const timestamp = new Date().toISOString();
    const reminder = {
      ...reminderData,
      id: reminderData.id || this.generateId(),
      updatedAt: timestamp,
      createdAt: reminderData.createdAt || timestamp
    };

    return this.#executeTransaction(this.#stores.REMINDERS, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(reminder);

        request.onsuccess = () => {
          resolve(reminder);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to save reminder: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  async getReminders(userId, filters = {}) {
    this.validateUserId(userId);

    return this.#executeTransaction(this.#stores.REMINDERS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const reminders = [];
        let request;

        // Optimize query using appropriate index
        if (filters.status) {
          const index = store.index('userStatus');
          request = index.openCursor([userId, filters.status]);
        } else if (filters.category) {
          const index = store.index('userCategory');
          request = index.openCursor([userId, filters.category]);
        } else {
          const index = store.index('userId');
          request = index.openCursor(userId);
        }

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            reminders.push(cursor.value);
            cursor.continue();
          } else {
            const processedReminders = this.processFilters(reminders, filters);
            resolve(processedReminders);
          }
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to retrieve reminders: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  async getReminderById(id) {
    this.validateReminderId(id);

    return this.#executeTransaction(this.#stores.REMINDERS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to retrieve reminder: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  async updateReminder(id, updates) {
    this.validateReminderId(id);

    const existing = await this.getReminderById(id);
    if (!existing) {
      throw new StorageError(`Reminder with id ${id} not found`, ERROR_CODES.NOT_FOUND);
    }

    const updatedReminder = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.validateReminderData(updatedReminder);
    return this.saveReminder(updatedReminder);
  }

  async deleteReminder(id) {
    this.validateReminderId(id);

    return this.#executeTransaction(this.#stores.REMINDERS, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to delete reminder: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  async deleteRemindersByStatus(userId, status) {
    this.validateUserId(userId);

    const reminders = await this.getReminders(userId, { status });
    const deletePromises = reminders.map(r => this.deleteReminder(r.id));

    const results = await Promise.allSettled(deletePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    return successful;
  }

  // User preferences operations
  async saveUserPreferences(userId, preferences) {
    this.validateUserId(userId);

    const userPrefs = {
      userId,
      ...preferences,
      updatedAt: new Date().toISOString()
    };

    return this.#executeTransaction(this.#stores.USER_PREFERENCES, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(userPrefs);

        request.onsuccess = () => {
          resolve(userPrefs);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to save user preferences: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  async getUserPreferences(userId) {
    this.validateUserId(userId);

    return this.#executeTransaction(this.#stores.USER_PREFERENCES, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(userId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to retrieve user preferences: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  // Metadata operations
  async saveMetadata(key, value) {
    const metadata = {
      key,
      value,
      timestamp: new Date().toISOString()
    };

    return this.#executeTransaction(this.#stores.METADATA, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(metadata);

        request.onsuccess = () => {
          resolve(metadata);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to save metadata: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  async getMetadata(key) {
    return this.#executeTransaction(this.#stores.METADATA, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };

        request.onerror = () => {
          reject(new StorageError(
              `Failed to retrieve metadata: ${request.error?.message}`,
              ERROR_CODES.STORAGE_UNAVAILABLE
          ));
        };
      });
    });
  }

  // Statistics and analytics
  async getStatistics(userId) {
    const reminders = await this.getReminders(userId);
    const baseStats = this.calculateStatistics(reminders);

    const databaseInfo = await this.getDatabaseInfo();

    return {
      ...baseStats,
      storageType: 'IndexedDB',
      databaseInfo,
      performance: {
        queryOptimization: 'Indexed queries enabled',
        transactionSupport: 'Full ACID compliance'
      }
    };
  }

  // Data export/import with batch processing
  async exportAllData(userId) {
    this.validateUserId(userId);

    const [reminders, preferences] = await Promise.all([
      this.getReminders(userId),
      this.getUserPreferences(userId)
    ]);

    return this.prepareExportData(reminders, preferences, {
      exportedFrom: 'IndexedDB',
      databaseVersion: this.#dbVersion,
      storageType: 'IndexedDB',
      capabilities: {
        transactional: true,
        indexed: true,
        concurrent: true
      }
    });
  }

  async importData(importData, userId) {
    this.validateImportData(importData);
    this.validateUserId(userId);

    const { reminders = [], preferences = null } = importData.data;

    // Import reminders in optimized batches
    const results = await this.#batchImportReminders(reminders, userId);

    // Import preferences if provided
    if (preferences) {
      await this.saveUserPreferences(userId, preferences);
    }

    const successfulImports = results.filter(r => r.status === 'fulfilled').length;
    console.log(`📥 Imported ${successfulImports}/${reminders.length} reminders to IndexedDB`);

    return successfulImports;
  }

  async #batchImportReminders(reminders, userId, batchSize = 50) {
    const results = [];

    for (let i = 0; i < reminders.length; i += batchSize) {
      const batch = reminders.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
          batch.map(reminder =>
              this.saveReminder({
                ...reminder,
                userId,
                id: this.generateId() // Generate new IDs for imports
              })
          )
      );

      results.push(...batchResults);

      // Small delay between batches to prevent blocking
      if (i + batchSize < reminders.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return results;
  }

  // Maintenance operations
  async clearUserData(userId) {
    this.validateUserId(userId);

    const reminders = await this.getReminders(userId);

    // Delete in batches for better performance
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < reminders.length; i += batchSize) {
      const batch = reminders.slice(i, i + batchSize);

      await this.#executeTransaction(this.#stores.REMINDERS, 'readwrite', (store) => {
        return Promise.all(
            batch.map(reminder =>
                new Promise((resolve, reject) => {
                  const request = store.delete(reminder.id);
                  request.onsuccess = () => resolve();
                  request.onerror = () => reject(request.error);
                })
            )
        );
      });

      deletedCount += batch.length;
    }

    // Also delete user preferences
    await this.#deleteUserPreferences(userId);

    console.log(`🗑️ Cleared ${deletedCount} reminders for user ${userId}`);
    return deletedCount;
  }

  async #deleteUserPreferences(userId) {
    return this.#executeTransaction(this.#stores.USER_PREFERENCES, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(userId);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getDatabaseInfo() {
    await this.initialize();

    try {
      const info = {
        name: this.#db.name,
        version: this.#db.version,
        type: 'IndexedDB',
        objectStoreNames: Array.from(this.#db.objectStoreNames),
        isHealthy: this.#isInitialized && this.#db,
        connectionState: this.#db ? 'connected' : 'disconnected',
        features: {
          transactions: true,
          indexing: true,
          largeObjects: true,
          concurrency: true
        }
      };

      // Add storage estimate if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          info.storageEstimate = {
            quota: this.#formatBytes(estimate.quota || 0),
            usage: this.#formatBytes(estimate.usage || 0),
            available: this.#formatBytes((estimate.quota || 0) - (estimate.usage || 0)),
            usagePercentage: estimate.quota ?
                Math.round((estimate.usage / estimate.quota) * 100) : 0
          };
        } catch (estimateError) {
          info.storageEstimate = {
            error: 'Storage estimation unavailable',
            reason: estimateError.message
          };
        }
      }

      // Add record counts
      try {
        const reminderCount = await this.#getRecordCount(this.#stores.REMINDERS);
        const userPrefsCount = await this.#getRecordCount(this.#stores.USER_PREFERENCES);

        info.recordCounts = {
          reminders: reminderCount,
          userPreferences: userPrefsCount,
          total: reminderCount + userPrefsCount
        };
      } catch (countError) {
        info.recordCounts = { error: 'Could not retrieve record counts' };
      }

      return info;
    } catch (error) {
      return {
        error: error.message,
        isHealthy: false,
        connectionState: 'error',
        type: 'IndexedDB'
      };
    }
  }

  async #getRecordCount(storeName) {
    return this.#executeTransaction(storeName, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  #formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, index)).toFixed(1);

    return `${size} ${units[index] || 'B'}`;
  }

  // Health check with comprehensive testing
  async healthCheck() {
    try {
      await this.initialize();

      // Test basic operations
      const testData = {
        id: `health_check_${Date.now()}`,
        title: 'Health Check Test',
        datetime: new Date().toISOString(),
        userId: 'health_check',
        category: 'other',
        priority: 1,
        status: 'active'
      };

      // Test save, retrieve, update, and delete
      const saved = await this.saveReminder(testData);
      const retrieved = await this.getReminderById(saved.id);
      const updated = await this.updateReminder(saved.id, { title: 'Updated Test' });
      await this.deleteReminder(saved.id);

      return {
        healthy: true,
        timestamp: new Date().toISOString(),
        storageType: 'IndexedDB',
        operations: {
          save: !!saved,
          retrieve: !!retrieved,
          update: !!updated,
          delete: true
        },
        performance: {
          connected: this.#isInitialized,
          database: this.#db?.name || 'N/A'
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        storageType: 'IndexedDB',
        errorCode: error.code || ERROR_CODES.STORAGE_UNAVAILABLE
      };
    }
  }

  #gracefulClose() {
    if (this.#db) {
      console.log('🔄 Gracefully closing IndexedDB connection');
      this.#db.close();
      this.#db = null;
      this.#isInitialized = false;
    }
  }

  async close() {
    if (this.#db) {
      // Wait for any pending transactions to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      this.#gracefulClose();
    }
  }

  // Performance monitoring
  async getPerformanceMetrics() {
    return {
      storageType: 'IndexedDB',
      isInitialized: this.#isInitialized,
      connectionState: this.#db ? 'active' : 'inactive',
      features: {
        asyncOperations: true,
        transactions: true,
        indexedQueries: true,
        largeDataSupport: true,
        offlineCapable: true
      },
      limitations: {
        crossOrigin: false,
        serverSideAccess: false,
        automaticBackup: false
      }
    };
  }
}