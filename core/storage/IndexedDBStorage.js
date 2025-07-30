/**
 * IndexedDB Storage Implementation
 * High-performance, reliable storage for modern browsers
 */

import { StorageInterface } from './StorageInterface.js';
import { StorageError, ERROR_CODES } from '../../types/interfaces.js';
import { APP_CONFIG } from '../../config/constants.js';

export class IndexedDBStorage extends StorageInterface {
  constructor() {
    super();
    this.dbName = APP_CONFIG.storage.dbName;
    this.dbVersion = APP_CONFIG.storage.dbVersion;
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;

    this.stores = {
      REMINDERS: 'reminders',
      USER_PREFERENCES: 'userPreferences',
      METADATA: 'metadata'
    };
  }

  static isSupported() {
    return 'indexedDB' in window &&
           'IDBTransaction' in window &&
           'IDBKeyRange' in window;
  }

  async initialize() {
    if (this.isInitialized) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._performInitialization();
    return this.initPromise;
  }

  async _performInitialization() {
    if (!IndexedDBStorage.isSupported()) {
      throw new StorageError('IndexedDB not supported', ERROR_CODES.STORAGE_UNAVAILABLE);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      const timeoutId = setTimeout(() => {
        reject(new StorageError('IndexedDB connection timeout', ERROR_CODES.TIMEOUT));
      }, 15000);

      request.onerror = () => {
        clearTimeout(timeoutId);
        reject(new StorageError(
          'IndexedDB error: ${request.error?.message || 'Unknown error'}',
          ERROR_CODES.STORAGE_UNAVAILABLE
        ));
      };

      request.onsuccess = () => {
        clearTimeout(timeoutId);
        this.db = request.result;
        this._setupEventHandlers();
        this.isInitialized = true;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        try {
          this._createObjectStores(event.target.result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(new StorageError('Database upgrade failed: ${error.message}', ERROR_CODES.STORAGE_UNAVAILABLE));
        }
      };
    });
  }

  _createObjectStores(db) {
    // Create reminders store
    if (!db.objectStoreNames.contains(this.stores.REMINDERS)) {
      const reminderStore = db.createObjectStore(this.stores.REMINDERS, {
        keyPath: 'id',
        autoIncrement: true
      });

      // Create indexes for efficient querying
      reminderStore.createIndex('userId', 'userId', { unique: false });
      reminderStore.createIndex('status', 'status', { unique: false });
      reminderStore.createIndex('datetime', 'datetime', { unique: false });
      reminderStore.createIndex('priority', 'priority', { unique: false });
      reminderStore.createIndex('category', 'category', { unique: false });
      reminderStore.createIndex('userStatus', ['userId', 'status'], { unique: false });
      reminderStore.createIndex('userCategory', ['userId', 'category'], { unique: false });
    }

    // Create user preferences store
    if (!db.objectStoreNames.contains(this.stores.USER_PREFERENCES)) {
      db.createObjectStore(this.stores.USER_PREFERENCES, { keyPath: 'userId' });
    }

    // Create metadata store
    if (!db.objectStoreNames.contains(this.stores.METADATA)) {
      db.createObjectStore(this.stores.METADATA, { keyPath: 'key' });
    }
  }

  _setupEventHandlers() {
    this.db.onerror = (event) => {
      console.error('IndexedDB runtime error:', event.target.error);
    };

    this.db.onversionchange = () => {
      console.warn('IndexedDB version changed by another connection');
      this._gracefulClose();
    };

    this.db.onclose = () => {
      console.warn('IndexedDB connection closed unexpectedly');
      this.isInitialized = false;
      this.db = null;
    };
  }

  async _executeTransaction(storeNames, mode, operation) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      let transaction;

      try {
        transaction = this.db.transaction(storeNames, mode);
      } catch (error) {
        reject(new StorageError('Transaction creation failed: ${error.message}', ERROR_CODES.STORAGE_UNAVAILABLE));
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
          reject(new StorageError(
            'Transaction failed: ${transaction.error?.message || 'Unknown error'}',
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
          reject(new StorageError('Operation failed: ${error.message}', ERROR_CODES.STORAGE_UNAVAILABLE));
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
      updatedAt: timestamp,
      createdAt: reminderData.createdAt || timestamp
    };

    return this._executeTransaction(this.stores.REMINDERS, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(reminder);

        request.onsuccess = () => {
          const savedReminder = { ...reminder, id: request.result };
          resolve(savedReminder);
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  async getReminders(userId, filters = {}) {
    this.validateUserId(userId);

    return this._executeTransaction(this.stores.REMINDERS, 'readonly', (store) => {
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
            resolve(this.processFilters(reminders, filters));
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  async getReminderById(id) {
    this.validateReminderId(id);

    return this._executeTransaction(this.stores.REMINDERS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async updateReminder(id, updates) {
    this.validateReminderId(id);

    const existing = await this.getReminderById(id);
    if (!existing) {
      throw new StorageError('Reminder with id ${id} not found', ERROR_CODES.NOT_FOUND);
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

    return this._executeTransaction(this.stores.REMINDERS, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async deleteRemindersByStatus(userId, status) {
    this.validateUserId(userId);

    const reminders = await this.getReminders(userId, { status });
    const deletePromises = reminders.map(r => this.deleteReminder(r.id));

    await Promise.all(deletePromises);
    return reminders.length;
  }

  // User preferences
  async saveUserPreferences(userId, preferences) {
    this.validateUserId(userId);

    const userPrefs = {
      userId,
      ...preferences,
      updatedAt: new Date().toISOString()
    };

    return this._executeTransaction(this.stores.USER_PREFERENCES, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(userPrefs);

        request.onsuccess = () => resolve(userPrefs);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getUserPreferences(userId) {
    this.validateUserId(userId);

    return this._executeTransaction(this.stores.USER_PREFERENCES, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(userId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
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

    return this._executeTransaction(this.stores.METADATA, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(metadata);

        request.onsuccess = () => resolve(metadata);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getMetadata(key) {
    return this._executeTransaction(this.stores.METADATA, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Statistics and analytics
  async getStatistics(userId) {
    const reminders = await this.getReminders(userId);
    const baseStats = this.calculateStatistics(reminders);

    return {
      ...baseStats,
      storageType: 'IndexedDB',
      databaseInfo: await this.getDatabaseInfo()
    };
  }

  // Data export/import
  async exportAllData(userId) {
    const [reminders, preferences] = await Promise.all([
      this.getReminders(userId),
      this.getUserPreferences(userId)
    ]);

    return this.prepareExportData(reminders, preferences, {
      exportedFrom: 'IndexedDB',
      databaseVersion: this.dbVersion
    });
  }

  async importData(importData, userId) {
    this.validateImportData(importData);
    this.validateUserId(userId);

    const { reminders = [], preferences = null } = importData.data;

    // Import reminders in batches for better performance
    const results = await this.batchOperation(
      reminders,
      (reminder) => this.saveReminder({ ...reminder, userId, id: undefined }),
      50
    );

    // Import preferences if provided
    if (preferences) {
      await this.saveUserPreferences(userId, preferences);
    }

    const successfulImports = results.filter(r => r.status === 'fulfilled').length;
    return successfulImports;
  }

  // Maintenance operations
  async clearUserData(userId) {
    this.validateUserId(userId);

    const reminders = await this.getReminders(userId);
    const deletePromises = reminders.map(r => this.deleteReminder(r.id));

    await Promise.all([
      ...deletePromises,
      this._deleteUserPreferences(userId)
    ]);

    return reminders.length;
  }

  async _deleteUserPreferences(userId) {
    return this._executeTransaction(this.stores.USER_PREFERENCES, 'readwrite', (store) => {
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
        name: this.db.name,
        version: this.db.version,
        type: 'IndexedDB',
        objectStoreNames: Array.from(this.db.objectStoreNames),
        isHealthy: this.isInitialized && this.db,
        connectionState: this.db ? 'connected' : 'disconnected'
      };

      // Add storage estimate if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          info.storageEstimate = {
            quota: this._formatBytes(estimate.quota),
            usage: this._formatBytes(estimate.usage),
            available: this._formatBytes(estimate.quota - estimate.usage),
            usagePercentage: Math.round((estimate.usage / estimate.quota) * 100)
          };
        } catch {
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

  _formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, index)).toFixed(1);
    return '${size} ${units[index]}';
  }

  _gracefulClose() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  async close() {
    if (this.db) {
      // Wait a moment for any pending transactions
      await new Promise(resolve => setTimeout(resolve, 100));
      this._gracefulClose();
    }
  }
}