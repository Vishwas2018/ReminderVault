/**
 * Storage Interface - Unified storage abstraction layer
 * Provides consistent API across different storage implementations
 */

import { StorageError, ERROR_CODES } from '../../types/interfaces.js';

export class StorageInterface {
  constructor() {
    if (this.constructor === StorageInterface) {
      throw new Error('StorageInterface is abstract and cannot be instantiated directly');
    }
  }

  // Abstract methods that must be implemented by concrete classes
  async saveReminder(reminderData) {
    throw new Error('saveReminder method must be implemented');
  }

  async getReminders(userId, filters = {}) {
    throw new Error('getReminders method must be implemented');
  }

  async getReminderById(id) {
    throw new Error('getReminderById method must be implemented');
  }

  async updateReminder(id, updates) {
    throw new Error('updateReminder method must be implemented');
  }

  async deleteReminder(id) {
    throw new Error('deleteReminder method must be implemented');
  }

  async deleteRemindersByStatus(userId, status) {
    throw new Error('deleteRemindersByStatus method must be implemented');
  }

  async saveUserPreferences(userId, preferences) {
    throw new Error('saveUserPreferences method must be implemented');
  }

  async getUserPreferences(userId) {
    throw new Error('getUserPreferences method must be implemented');
  }

  async saveMetadata(key, value) {
    throw new Error('saveMetadata method must be implemented');
  }

  async getMetadata(key) {
    throw new Error('getMetadata method must be implemented');
  }

  async getStatistics(userId) {
    throw new Error('getStatistics method must be implemented');
  }

  async exportAllData(userId) {
    throw new Error('exportAllData method must be implemented');
  }

  async importData(importData, userId) {
    throw new Error('importData method must be implemented');
  }

  async clearUserData(userId) {
    throw new Error('clearUserData method must be implemented');
  }

  async getDatabaseInfo() {
    throw new Error('getDatabaseInfo method must be implemented');
  }

  async close() {
    throw new Error('close method must be implemented');
  }

  // Common utility methods available to all implementations
  generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : this._fallbackId();
  }

  _fallbackId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  validateReminderId(id) {
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
      throw new StorageError('Invalid reminder ID', ERROR_CODES.VALIDATION_ERROR);
    }
    return true;
  }

  validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new StorageError('Invalid user ID', ERROR_CODES.VALIDATION_ERROR);
    }
    return true;
  }

  calculateStatus(datetime) {
    const now = new Date();
    const reminderTime = new Date(datetime);

    if (reminderTime <= now) {
      return 'overdue';
    }
    return 'active';
  }

  processFilters(reminders, filters) {
    let filtered = [...reminders];

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(r => r.category === filters.category);
    }

    // Priority filter
    if (filters.priority) {
      filtered = filtered.filter(r => r.priority === filters.priority);
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(r => new Date(r.datetime) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filtered = filtered.filter(r => new Date(r.datetime) <= toDate);
    }

    // Text search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(r =>
          r.title.toLowerCase().includes(searchTerm) ||
          (r.description && r.description.toLowerCase().includes(searchTerm))
      );
    }

    // Sort results
    if (filters.sortBy) {
      filtered = this.sortReminders(filtered, filters.sortBy, filters.sortDirection);
    }

    return filtered;
  }

  sortReminders(reminders, sortBy, direction = 'asc') {
    const sortFunctions = {
      datetime: (a, b) => new Date(a.datetime) - new Date(b.datetime),
      priority: (a, b) => (b.priority || 2) - (a.priority || 2),
      title: (a, b) => (a.title || '').localeCompare(b.title || ''),
      created: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      updated: (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
      category: (a, b) => (a.category || '').localeCompare(b.category || ''),
      status: (a, b) => (a.status || '').localeCompare(b.status || ''),
      alerts: (a, b) => (b.alertTimings?.length || 0) - (a.alertTimings?.length || 0)
    };

    const sortFn = sortFunctions[sortBy] || sortFunctions.datetime;
    const sorted = [...reminders].sort(sortFn);

    return direction === 'desc' ? sorted.reverse() : sorted;
  }

  async withTimeout(operation, timeoutMs = 15000) {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new StorageError('Operation timed out', ERROR_CODES.TIMEOUT)), timeoutMs)
    );

    return Promise.race([operation, timeoutPromise]);
  }

  async withRetry(operation, maxAttempts = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError;
  }

  // Batch operations helper
  async batchOperation(items, operation, batchSize = 50) {
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item => operation(item));
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  // Data validation helpers
  validateReminderData(data) {
    const errors = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!data.datetime || isNaN(Date.parse(data.datetime))) {
      errors.push('Valid datetime is required');
    }

    if (data.priority !== undefined && (typeof data.priority !== 'number' || data.priority < 1 || data.priority > 4)) {
      errors.push('Priority must be between 1 and 4');
    }

    if (errors.length > 0) {
      throw new StorageError(`Validation failed: ${errors.join(', ')}`, ERROR_CODES.VALIDATION_ERROR);
    }

    return true;
  }

  // Common statistics calculation
  calculateStatistics(reminders) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      total: reminders.length,
      active: reminders.filter(r => r.status === 'active').length,
      completed: reminders.filter(r => r.status === 'completed').length,
      overdue: reminders.filter(r => r.status === 'overdue').length,
      cancelled: reminders.filter(r => r.status === 'cancelled').length,
      completedToday: reminders.filter(r =>
          r.status === 'completed' &&
          r.updatedAt &&
          new Date(r.updatedAt) >= today &&
          new Date(r.updatedAt) < tomorrow
      ).length,
      totalConfiguredAlerts: reminders.reduce((sum, r) => sum + (r.alertTimings?.length || 0), 0),
      averageAlertsPerReminder: reminders.length > 0
          ? Math.round((reminders.reduce((sum, r) => sum + (r.alertTimings?.length || 0), 0) / reminders.length) * 10) / 10
          : 0,
      categoryCounts: this._getCategoryCounts(reminders),
      priorityCounts: this._getPriorityCounts(reminders)
    };
  }

  _getCategoryCounts(reminders) {
    const counts = {};
    reminders.forEach(reminder => {
      const category = reminder.category || 'other';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }

  _getPriorityCounts(reminders) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    reminders.forEach(reminder => {
      const priority = reminder.priority || 2;
      counts[priority] = (counts[priority] || 0) + 1;
    });
    return counts;
  }

  // Export/Import helpers
  prepareExportData(reminders, preferences, metadata = {}) {
    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      storageType: this.constructor.name,
      data: {
        reminders: reminders.map(r => ({
          ...r,
          exportedAt: new Date().toISOString()
        })),
        preferences,
        metadata
      },
      statistics: this.calculateStatistics(reminders)
    };
  }

  validateImportData(importData) {
    if (!importData || typeof importData !== 'object') {
      throw new StorageError('Invalid import data format', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!importData.data || !Array.isArray(importData.data.reminders)) {
      throw new StorageError('Import data must contain reminders array', ERROR_CODES.VALIDATION_ERROR);
    }

    // Validate each reminder
    importData.data.reminders.forEach((reminder, index) => {
      try {
        this.validateReminderData(reminder);
      } catch (error) {
        throw new StorageError(
            `Invalid reminder at index ${index}: ${error.message}`,
            ERROR_CODES.VALIDATION_ERROR
        );
      }
    });

    return true;
  }

  // Connection health check
  async healthCheck() {
    try {
      // Basic operation test
      const testData = {
        title: 'Health Check Test',
        datetime: new Date().toISOString(),
        userId: 'health_check'
      };

      const saved = await this.saveReminder(testData);
      await this.getReminderById(saved.id);
      await this.deleteReminder(saved.id);

      return {
        healthy: true,
        timestamp: new Date().toISOString(),
        storageType: this.constructor.name
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        storageType: this.constructor.name
      };
    }
  }
}