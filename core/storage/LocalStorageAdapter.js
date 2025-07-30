/**
 * LocalStorage Adapter - Fallback storage for when IndexedDB is unavailable
 * Provides the same interface as IndexedDB but uses localStorage
 */

import { StorageInterface } from './StorageInterface.js';
import { StorageError, ERROR_CODES } from '../../types/interfaces.js';
import { APP_CONFIG } from '../../config/constants.js';

export class LocalStorageAdapter extends StorageInterface {
  constructor() {
    super();
    this.storageKey = 'reminders_vault_data';
    this.maxStorageSize = APP_CONFIG.storage.maxStorageSize;
    this.isAvailable = this._checkAvailability();
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

  _checkAvailability() {
    return LocalStorageAdapter.isSupported();
  }

  async initialize() {
    if (!this.isAvailable) {
      throw new StorageError('localStorage not available', ERROR_CODES.STORAGE_UNAVAILABLE);
    }

    // Ensure data structure exists
    const existingData = this._getRawData();
    if (!existingData) {
      await this._createInitialStructure();
    }

    return true;
  }

  async _createInitialStructure() {
    const initialData = {
      version: 1,
      created: new Date().toISOString(),
      reminders: [],
      userPreferences: {},
      metadata: {}
    };

    this._setRawData(initialData);
  }

  _getRawData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
      return null;
    }
  }

  _setRawData(data) {
    try {
      const serialized = JSON.stringify(data);

      if (serialized.length > this.maxStorageSize) {
        throw new StorageError('Data exceeds localStorage size limit', ERROR_CODES.QUOTA_EXCEEDED);
      }

      localStorage.setItem(this.storageKey, serialized);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.code === ERROR_CODES.QUOTA_EXCEEDED) {
        this._handleQuotaExceeded();
        // Try again after cleanup
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        return true;
      }
      throw error;
    }
  }

  _handleQuotaExceeded() {
    try {
      const data = this._getRawData();
      if (!data?.reminders) return;

      // Remove completed reminders older than 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const originalCount = data.reminders.length;
      data.reminders = data.reminders.filter(reminder => {
        if (reminder.status === 'completed' && reminder.updatedAt) {
          return new Date(reminder.updatedAt) > cutoffDate;
        }
        return true;
      });

      this._setRawData(data);
      console.log('Cleaned ${originalCount - data.reminders.length} old reminders to free space');
    } catch (error) {
      console.error('Failed to clean storage:', error);
      throw new StorageError('Storage quota exceeded and cleanup failed', ERROR_CODES.QUOTA_EXCEEDED);
    }
  }

  // Core CRUD operations
  async saveReminder(reminderData) {
    await this.initialize();
    this.validateReminderData(reminderData);

    const data = this._getRawData();
    if (!data) throw new StorageError('Storage data corrupted', ERROR_CODES.STORAGE_UNAVAILABLE);

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

    this._setRawData(data);
    return reminder;
  }

  async getReminders(userId, filters = {}) {
    await this.initialize();
    this.validateUserId(userId);

    const data = this._getRawData();
    if (!data?.reminders) return [];

    let reminders = data.reminders.filter(reminder => reminder.userId === userId);
    return this.processFilters(reminders, filters);
  }

  async getReminderById(id) {
    await this.initialize();
    this.validateReminderId(id);

    const data = this._getRawData();
    if (!data?.reminders) return null;

    return data.reminders.find(reminder => reminder.id === id) || null;
  }

  async updateReminder(id, updates) {
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

    return this.saveReminder(updatedReminder);
  }

  async deleteReminder(id) {
    await this.initialize();
    this.validateReminderId(id);

    const data = this._getRawData();
    if (!data?.reminders) return false;

    const initialLength = data.reminders.length;
    data.reminders = data.reminders.filter(reminder => reminder.id !== id);

    if (data.reminders.length < initialLength) {
      this._setRawData(data);
      return true;
    }

    return false;
  }

  async deleteRemindersByStatus(userId, status) {
    const reminders = await this.getReminders(userId, { status });
    const deletePromises = reminders.map(r => this.deleteReminder(r.id));

    await Promise.all(deletePromises);
    return reminders.length;
  }

  // User preferences
  async saveUserPreferences(userId, preferences) {
    await this.initialize();
    this.validateUserId(userId);

    const data = this._getRawData();
    if (!data) throw new StorageError('Storage data corrupted', ERROR_CODES.STORAGE_UNAVAILABLE);

    data.userPreferences[userId] = {
      ...preferences,
      userId,
      updatedAt: new Date().toISOString()
    };

    this._setRawData(data);
    return data.userPreferences[userId];
  }

  async getUserPreferences(userId) {
    await this.initialize();
    this.validateUserId(userId);

    const data = this._getRawData();
    return data?.userPreferences?.[userId] || null;
  }

  // Metadata operations
  async saveMetadata(key, value) {
    await this.initialize();

    const data = this._getRawData();
    if (!data) throw new StorageError('Storage data corrupted', ERROR_CODES.STORAGE_UNAVAILABLE);

    data.metadata[key] = {
      key,
      value,
      timestamp: new Date().toISOString()
    };

    this._setRawData(data);
    return data.metadata[key];
  }

  async getMetadata(key) {
    await this.initialize();

    const data = this._getRawData();
    const metadata = data?.metadata?.[key];
    return metadata ? metadata.value : null;
  }

  // Statistics and analytics
  async getStatistics(userId) {
    const reminders = await this.getReminders(userId);
    const baseStats = this.calculateStatistics(reminders);

    return {
      ...baseStats,
      storageType: 'localStorage',
      storageSize: this._getStorageSize(),
      databaseInfo: await this.getDatabaseInfo()
    };
  }

  _getStorageSize() {
    try {
      const data = localStorage.getItem(this.storageKey);
      const sizeBytes = new Blob([data || '']).size;
      const sizeKB = Math.round(sizeBytes / 1024);
      return '${sizeKB} KB';
    } catch {
      return 'Unknown';
    }
  }

  // Data export/import
  async exportAllData(userId) {
    const [reminders, preferences] = await Promise.all([
      this.getReminders(userId),
      this.getUserPreferences(userId)
    ]);

    const data = this._getRawData();
    return this.prepareExportData(reminders, preferences, {
      exportedFrom: 'localStorage',
      metadata: data?.metadata || {}
    });
  }

  async importData(importData, userId) {
    this.validateImportData(importData);
    this.validateUserId(userId);

    const { reminders = [], preferences = null } = importData.data;

    // Import reminders
    const results = await this.batchOperation(
      reminders,
      (reminder) => this.saveReminder({ ...reminder, userId, id: undefined }),
      25 // Smaller batches for localStorage
    );

    // Import preferences
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
    const data = this._getRawData();
    if (data?.userPreferences?.[userId]) {
      delete data.userPreferences[userId];
      this._setRawData(data);
    }
  }

  async getDatabaseInfo() {
    const data = this._getRawData();
    const storageSize = this._getStorageSize();

    return {
      name: 'localStorage',
      version: data?.version || 1,
      type: 'Fallback Storage',
      size: storageSize,
      available: this.isAvailable,
      created: data?.created || 'Unknown',
      maxSize: '${Math.round(this.maxStorageSize / 1024)} KB'
    };
  }

  async close() {
    // localStorage doesn't need explicit closing
    return Promise.resolve();
  }
}