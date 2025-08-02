/**
 * LocalStorage Adapter - Fallback storage implementation
 * Provides IndexedDB-compatible interface using localStorage
 */

import { StorageInterface } from './StorageInterface.js';
import { StorageError, ERROR_CODES } from '../../types/interfaces.js';
import { APP_CONFIG } from '../../config/constants.js';

export class LocalStorageAdapter extends StorageInterface {
  #storageKey = null;
  #maxStorageSize = null;
  #isAvailable = false;

  constructor() {
    super();
    this.#storageKey = 'reminders_vault_data';
    this.#maxStorageSize = APP_CONFIG.storage.maxStorageSize || 5 * 1024 * 1024; // 5MB default
    this.#isAvailable = this.#checkAvailability();
  }

  static isSupported() {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  #checkAvailability() {
    if (!LocalStorageAdapter.isSupported()) {
      return false;
    }

    try {
      // Test actual write capability
      const testKey = '__availability_test__';
      const testData = { test: true, timestamp: Date.now() };
      localStorage.setItem(testKey, JSON.stringify(testData));

      const retrieved = JSON.parse(localStorage.getItem(testKey) || '{}');
      localStorage.removeItem(testKey);

      return retrieved.test === true;
    } catch {
      return false;
    }
  }

  async initialize() {
    if (!this.#isAvailable) {
      throw new StorageError(
          'localStorage not available or accessible',
          ERROR_CODES.STORAGE_UNAVAILABLE
      );
    }

    // Ensure data structure exists and is valid
    const existingData = this.#getRawData();
    if (!existingData || !this.#validateDataStructure(existingData)) {
      await this.#createInitialStructure();
    }

    console.log('📦 localStorage adapter initialized');
    return true;
  }

  #validateDataStructure(data) {
    return data &&
        typeof data === 'object' &&
        Array.isArray(data.reminders) &&
        typeof data.userPreferences === 'object' &&
        typeof data.metadata === 'object';
  }

  async #createInitialStructure() {
    const initialData = {
      version: 2,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      reminders: [],
      userPreferences: {},
      metadata: {},
      schemaVersion: '2.0'
    };

    this.#setRawData(initialData);
    console.log('🏗️ localStorage structure initialized');
  }

  #getRawData() {
    try {
      const data = localStorage.getItem(this.#storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
      return null;
    }
  }

  #setRawData(data) {
    try {
      const serialized = JSON.stringify(data);

      // Check size before saving
      if (serialized.length > this.#maxStorageSize) {
        throw new StorageError(
            'Data exceeds localStorage size limit',
            ERROR_CODES.QUOTA_EXCEEDED
        );
      }

      localStorage.setItem(this.#storageKey, serialized);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.code === ERROR_CODES.QUOTA_EXCEEDED) {
        this.#handleQuotaExceeded(data);
        return true;
      }
      throw new StorageError(
          `Failed to save to localStorage: ${error.message}`,
          ERROR_CODES.STORAGE_UNAVAILABLE
      );
    }
  }

  #handleQuotaExceeded(newData) {
    try {
      const data = this.#getRawData();
      if (!data?.reminders) {
        throw new StorageError('Cannot free space: invalid data structure');
      }

      // Clean up old completed reminders (older than 30 days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const originalCount = data.reminders.length;
      data.reminders = data.reminders.filter(reminder => {
        if (reminder.status === 'completed' && reminder.updatedAt) {
          return new Date(reminder.updatedAt) > cutoffDate;
        }
        return true;
      });

      const cleanedCount = originalCount - data.reminders.length;

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} old completed reminders to free space`);
        this.#setRawData(newData);
      } else {
        throw new StorageError(
            'Storage quota exceeded and no old data to clean',
            ERROR_CODES.QUOTA_EXCEEDED
        );
      }
    } catch (error) {
      throw new StorageError(
          'Storage quota exceeded and cleanup failed',
          ERROR_CODES.QUOTA_EXCEEDED
      );
    }
  }

  // Core CRUD operations
  async saveReminder(reminderData) {
    await this.initialize();
    this.validateReminderData(reminderData);

    const data = this.#getRawData();
    if (!data) {
      throw new StorageError('Storage data corrupted', ERROR_CODES.STORAGE_UNAVAILABLE);
    }

    const timestamp = new Date().toISOString();
    const reminder = {
      ...reminderData,
      id: reminderData.id || this.generateId(),
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

    data.lastModified = timestamp;
    this.#setRawData(data);
    return reminder;
  }

  async getReminders(userId, filters = {}) {
    await this.initialize();
    this.validateUserId(userId);

    const data = this.#getRawData();
    if (!data?.reminders) return [];

    let reminders = data.reminders.filter(reminder => reminder.userId === userId);
    return this.processFilters(reminders, filters);
  }

  async getReminderById(id) {
    await this.initialize();
    this.validateReminderId(id);

    const data = this.#getRawData();
    if (!data?.reminders) return null;

    return data.reminders.find(reminder => reminder.id === id) || null;
  }

  async updateReminder(id, updates) {
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

    return this.saveReminder(updatedReminder);
  }

  async deleteReminder(id) {
    await this.initialize();
    this.validateReminderId(id);

    const data = this.#getRawData();
    if (!data?.reminders) return false;

    const initialLength = data.reminders.length;
    data.reminders = data.reminders.filter(reminder => reminder.id !== id);

    if (data.reminders.length < initialLength) {
      data.lastModified = new Date().toISOString();
      this.#setRawData(data);
      return true;
    }

    return false;
  }

  async deleteRemindersByStatus(userId, status) {
    const reminders = await this.getReminders(userId, { status });
    const deletePromises = reminders.map(r => this.deleteReminder(r.id));

    const results = await Promise.allSettled(deletePromises);
    return results.filter(r => r.status === 'fulfilled').length;
  }

  // User preferences
  async saveUserPreferences(userId, preferences) {
    await this.initialize();
    this.validateUserId(userId);

    const data = this.#getRawData();
    if (!data) {
      throw new StorageError('Storage data corrupted', ERROR_CODES.STORAGE_UNAVAILABLE);
    }

    data.userPreferences[userId] = {
      ...preferences,
      userId,
      updatedAt: new Date().toISOString()
    };

    data.lastModified = new Date().toISOString();
    this.#setRawData(data);
    return data.userPreferences[userId];
  }

  async getUserPreferences(userId) {
    await this.initialize();
    this.validateUserId(userId);

    const data = this.#getRawData();
    return data?.userPreferences?.[userId] || null;
  }

  // Metadata operations
  async saveMetadata(key, value) {
    await this.initialize();

    const data = this.#getRawData();
    if (!data) {
      throw new StorageError('Storage data corrupted', ERROR_CODES.STORAGE_UNAVAILABLE);
    }

    data.metadata[key] = {
      key,
      value,
      timestamp: new Date().toISOString()
    };

    data.lastModified = new Date().toISOString();
    this.#setRawData(data);
    return data.metadata[key];
  }

  async getMetadata(key) {
    await this.initialize();

    const data = this.#getRawData();
    const metadata = data?.metadata?.[key];
    return metadata ? metadata.value : null;
  }

  // Statistics and analytics
  async getStatistics(userId) {
    const reminders = await this.getReminders(userId);
    const baseStats = this.calculateStatistics(reminders);

    const storageInfo = this.#getStorageInfo();

    return {
      ...baseStats,
      storageType: 'localStorage',
      storageInfo,
      databaseInfo: await this.getDatabaseInfo()
    };
  }

  #getStorageInfo() {
    try {
      const data = localStorage.getItem(this.#storageKey);
      const sizeBytes = new Blob([data || '']).size;
      const sizeKB = Math.round(sizeBytes / 1024);
      const maxSizeKB = Math.round(this.#maxStorageSize / 1024);

      return {
        size: `${sizeKB} KB`,
        maxSize: `${maxSizeKB} KB`,
        usage: `${sizeKB}/${maxSizeKB} KB`,
        percentage: Math.round((sizeBytes / this.#maxStorageSize) * 100)
      };
    } catch {
      return { size: 'Unknown', usage: 'Unknown' };
    }
  }

  // Data export/import
  async exportAllData(userId) {
    const [reminders, preferences] = await Promise.all([
      this.getReminders(userId),
      this.getUserPreferences(userId)
    ]);

    const data = this.#getRawData();
    return this.prepareExportData(reminders, preferences, {
      exportedFrom: 'localStorage',
      storageVersion: data?.version || 1,
      metadata: data?.metadata || {},
      limitations: {
        maxSize: this.#maxStorageSize,
        persistent: true,
        crossOrigin: false
      }
    });
  }

  async importData(importData, userId) {
    this.validateImportData(importData);
    this.validateUserId(userId);

    const { reminders = [], preferences = null } = importData.data;

    // Import reminders in smaller batches for localStorage
    const results = await this.batchOperation(
        reminders,
        (reminder) => this.saveReminder({
          ...reminder,
          userId,
          id: this.generateId() // Generate new IDs for imports
        }),
        25 // Smaller batches for localStorage performance
    );

    // Import preferences
    if (preferences) {
      await this.saveUserPreferences(userId, preferences);
    }

    const successfulImports = results.filter(r => r.status === 'fulfilled').length;
    console.log(`📥 Imported ${successfulImports}/${reminders.length} reminders to localStorage`);

    return successfulImports;
  }

  // Maintenance operations
  async clearUserData(userId) {
    this.validateUserId(userId);

    const reminders = await this.getReminders(userId);
    const data = this.#getRawData();

    if (data) {
      // Remove user's reminders
      data.reminders = data.reminders.filter(r => r.userId !== userId);

      // Remove user preferences
      delete data.userPreferences[userId];

      data.lastModified = new Date().toISOString();
      this.#setRawData(data);
    }

    console.log(`🗑️ Cleared ${reminders.length} reminders for user ${userId} from localStorage`);
    return reminders.length;
  }

  async getDatabaseInfo() {
    const data = this.#getRawData();
    const storageInfo = this.#getStorageInfo();

    return {
      name: 'localStorage',
      version: data?.version || 1,
      type: 'Fallback Storage',
      size: storageInfo.size,
      maxSize: storageInfo.maxSize,
      available: this.#isAvailable,
      created: data?.created || 'Unknown',
      lastModified: data?.lastModified || 'Unknown',
      features: {
        persistent: true,
        synchronous: true,
        crossTab: true,
        largeObjects: false
      },
      limitations: {
        maxSize: this.#maxStorageSize,
        stringOnly: true,
        noTransactions: true,
        quotaLimited: true
      }
    };
  }

  // Health check
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
        storageType: 'localStorage',
        operations: {
          save: !!saved,
          retrieve: !!retrieved,
          update: !!updated,
          delete: true
        },
        storageInfo: this.#getStorageInfo()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        storageType: 'localStorage',
        errorCode: error.code || ERROR_CODES.STORAGE_UNAVAILABLE
      };
    }
  }

  async close() {
    // localStorage doesn't need explicit closing, but we can clean up
    console.log('📦 localStorage adapter closed');
    return Promise.resolve();
  }

  // Performance utilities
  async optimizeStorage() {
    const data = this.#getRawData();
    if (!data) return { optimized: false, reason: 'No data found' };

    let optimized = false;
    const before = JSON.stringify(data).length;

    // Remove expired temporary data
    if (data.metadata) {
      const now = Date.now();
      Object.keys(data.metadata).forEach(key => {
        const meta = data.metadata[key];
        if (meta.expires && now > meta.expires) {
          delete data.metadata[key];
          optimized = true;
        }
      });
    }

    // Compact reminders array (remove null entries)
    if (data.reminders) {
      const originalLength = data.reminders.length;
      data.reminders = data.reminders.filter(r => r && typeof r === 'object');
      if (data.reminders.length < originalLength) {
        optimized = true;
      }
    }

    if (optimized) {
      data.lastModified = new Date().toISOString();
      this.#setRawData(data);

      const after = JSON.stringify(data).length;
      const savedBytes = before - after;

      return {
        optimized: true,
        savedBytes,
        savedPercentage: Math.round((savedBytes / before) * 100)
      };
    }

    return { optimized: false, reason: 'No optimization needed' };
  }

  // Backup and restore utilities
  async createBackup() {
    const data = this.#getRawData();
    if (!data) return null;

    return {
      timestamp: new Date().toISOString(),
      version: data.version,
      storageType: 'localStorage',
      data: data,
      checksum: this.#calculateChecksum(data)
    };
  }

  async restoreFromBackup(backup, options = { merge: false }) {
    if (!backup || !backup.data) {
      throw new StorageError('Invalid backup data', ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify checksum if present
    if (backup.checksum) {
      const currentChecksum = this.#calculateChecksum(backup.data);
      if (currentChecksum !== backup.checksum) {
        throw new StorageError('Backup data integrity check failed', ERROR_CODES.VALIDATION_ERROR);
      }
    }

    if (options.merge) {
      const currentData = this.#getRawData();
      if (currentData) {
        // Merge reminders
        const existingIds = new Set(currentData.reminders.map(r => r.id));
        const newReminders = backup.data.reminders.filter(r => !existingIds.has(r.id));
        currentData.reminders.push(...newReminders);

        // Merge preferences
        Object.assign(currentData.userPreferences, backup.data.userPreferences);

        // Merge metadata
        Object.assign(currentData.metadata, backup.data.metadata);

        currentData.lastModified = new Date().toISOString();
        this.#setRawData(currentData);
      } else {
        this.#setRawData(backup.data);
      }
    } else {
      // Full restore
      this.#setRawData(backup.data);
    }

    return true;
  }

  #calculateChecksum(data) {
    // Simple checksum for data integrity
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}