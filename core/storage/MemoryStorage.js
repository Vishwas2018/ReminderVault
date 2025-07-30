/**
 * Memory Storage - Emergency fallback storage
 * In-memory storage for extreme fallback scenarios
 */

import { StorageInterface } from './StorageInterface.js';
import { StorageError, ERROR_CODES } from '../../types/interfaces.js';

export class MemoryStorage extends StorageInterface {
  constructor() {
    super();
    this.data = {
      reminders: [],
      userPreferences: {},
      metadata: {}
    };
    this.isInitialized = false;
  }

  static isSupported() {
    return true; // Memory storage is always available
  }

  async initialize() {
    this.isInitialized = true;
    console.warn('⚠️ Using memory storage - data will be lost on page refresh');
    return true;
  }

  // Core CRUD operations
  async saveReminder(reminderData) {
    this.validateReminderData(reminderData);

    const timestamp = new Date().toISOString();
    const reminder = {
      ...reminderData,
      id: reminderData.id || this.generateId(),
      createdAt: reminderData.createdAt || timestamp,
      updatedAt: timestamp
    };

    const existingIndex = this.data.reminders.findIndex(r => r.id === reminder.id);
    if (existingIndex >= 0) {
      this.data.reminders[existingIndex] = reminder;
    } else {
      this.data.reminders.push(reminder);
    }

    return reminder;
  }

  async getReminders(userId, filters = {}) {
    this.validateUserId(userId);

    let reminders = this.data.reminders.filter(r => r.userId === userId);
    return this.processFilters(reminders, filters);
  }

  async getReminderById(id) {
    this.validateReminderId(id);
    return this.data.reminders.find(r => r.id === id) || null;
  }

  async updateReminder(id, updates) {
    const existing = await this.getReminderById(id);
    if (!existing) {
      throw new StorageError('Reminder ${id} not found', ERROR_CODES.NOT_FOUND);
    }

    return this.saveReminder({ ...existing, ...updates, id });
  }

  async deleteReminder(id) {
    this.validateReminderId(id);

    const initialLength = this.data.reminders.length;
    this.data.reminders = this.data.reminders.filter(r => r.id !== id);
    return this.data.reminders.length < initialLength;
  }

  async deleteRemindersByStatus(userId, status) {
    const reminders = await this.getReminders(userId, { status });
    reminders.forEach(r => this.deleteReminder(r.id));
    return reminders.length;
  }

  // User preferences
  async saveUserPreferences(userId, preferences) {
    this.validateUserId(userId);

    this.data.userPreferences[userId] = {
      ...preferences,
      userId,
      updatedAt: new Date().toISOString()
    };

    return this.data.userPreferences[userId];
  }

  async getUserPreferences(userId) {
    this.validateUserId(userId);
    return this.data.userPreferences[userId] || null;
  }

  // Metadata operations
  async saveMetadata(key, value) {
    this.data.metadata[key] = {
      key,
      value,
      timestamp: new Date().toISOString()
    };
    return this.data.metadata[key];
  }

  async getMetadata(key) {
    const metadata = this.data.metadata[key];
    return metadata ? metadata.value : null;
  }

  // Statistics
  async getStatistics(userId) {
    const reminders = await this.getReminders(userId);
    const baseStats = this.calculateStatistics(reminders);

    return {
      ...baseStats,
      storageType: 'Memory',
      persistent: false,
      warning: 'Data will be lost on page refresh'
    };
  }

  // Export/Import
  async exportAllData(userId) {
    const [reminders, preferences] = await Promise.all([
      this.getReminders(userId),
      this.getUserPreferences(userId)
    ]);

    return this.prepareExportData(reminders, preferences, {
      exportedFrom: 'Memory Storage',
      warning: 'Data exported from non-persistent storage'
    });
  }

  async importData(importData, userId) {
    this.validateImportData(importData);
    this.validateUserId(userId);

    const { reminders = [], preferences = null } = importData.data;

    const results = await Promise.allSettled(
      reminders.map(reminder =>
        this.saveReminder({ ...reminder, userId, id: undefined })
      )
    );

    if (preferences) {
      await this.saveUserPreferences(userId, preferences);
    }

    return results.filter(r => r.status === 'fulfilled').length;
  }

  // Maintenance
  async clearUserData(userId) {
    this.validateUserId(userId);

    const reminders = await this.getReminders(userId);
    this.data.reminders = this.data.reminders.filter(r => r.userId !== userId);
    delete this.data.userPreferences[userId];

    return reminders.length;
  }

  async getDatabaseInfo() {
    const dataSize = JSON.stringify(this.data).length;

    return {
      name: 'Memory Storage',
      type: 'Emergency Fallback',
      persistent: false,
      size: '${dataSize} bytes',
      itemCount: this.data.reminders.length,
      warning: 'Data will be lost on page refresh'
    };
  }

  async close() {
    console.log('🧠 Memory storage closed - data will be lost');
    this.data = { reminders: [], userPreferences: {}, metadata: {} };
  }
}