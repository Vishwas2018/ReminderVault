/**
 * Reminder Service - Core business logic for reminders
 * Handles CRUD operations, validation, and business rules
 */

import { createReminder, validateReminder, ValidationError } from '../../types/interfaces.js';
import { REMINDER_CONFIG, VALIDATION_RULES } from '../../config/constants.js';
import { EventEmitter, DateUtils, StringUtils } from '../../utils/helpers.js';

export class ReminderService extends EventEmitter {
  constructor(storageService, notificationService) {
    super();
    this.storage = storageService;
    this.notifications = notificationService;
    this.cache = new Map();
  }

  // Create a new reminder
  async createReminder(data, userId) {
    try {
      // Validate input data
      const validation = validateReminder(data);
      if (!validation.isValid) {
        throw validation.errors[0];
      }

      // Create reminder object
      const reminder = createReminder(data, userId);

      // Save to storage
      const savedReminder = await this.storage.saveReminder(reminder);

      // Schedule notifications if enabled
      if (savedReminder.notification && savedReminder.status === REMINDER_CONFIG.status.ACTIVE) {
        this.notifications.scheduleNotification(savedReminder, savedReminder.alertTimings);
      }

      // Update cache
      this._updateCache(userId, savedReminder, 'create');

      // Emit event
      this.emit('reminder-created', { reminder: savedReminder, userId });

      return savedReminder;
    } catch (error) {
      console.error('Failed to create reminder:', error);
      this.emit('reminder-error', { action: 'create', error, data, userId });
      throw error;
    }
  }

  // Get reminders with filtering and pagination
  async getReminders(userId, options = {}) {
    try {
      const {
        filters = {},
        sortBy = 'datetime',
        sortDirection = 'asc',
        page = 1,
        limit = 20,
        useCache = true
      } = options;

      // Check cache first
      const cacheKey = this._getCacheKey(userId, options);
      if (useCache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) { // 30 second cache
          return cached.data;
        }
      }

      // Get from storage
      const reminders = await this.storage.getReminders(userId, {
        ...filters,
        sortBy,
        sortDirection
      });

      // Update reminder statuses
      const updatedReminders = await this._updateReminderStatuses(reminders);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedReminders = updatedReminders.slice(startIndex, startIndex + limit);

      const result = {
        reminders: paginatedReminders,
        total: updatedReminders.length,
        page,
        limit,
        totalPages: Math.ceil(updatedReminders.length / limit),
        hasMore: startIndex + limit < updatedReminders.length
      };

      // Update cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Failed to get reminders:', error);
      this.emit('reminder-error', { action: 'get', error, userId, options });
      throw error;
    }
  }

  // Get single reminder by ID
  async getReminderById(id, userId) {
    try {
      const reminder = await this.storage.getReminderById(id);

      if (!reminder) {
        return null;
      }

      // Verify user owns this reminder
      if (reminder.userId !== userId) {
        throw new ValidationError('access', 'Access denied to this reminder');
      }

      // Update status if needed
      const updatedReminder = this._updateReminderStatus(reminder);

      if (updatedReminder.status !== reminder.status) {
        await this.storage.updateReminder(id, { status: updatedReminder.status });
      }

      return updatedReminder;
    } catch (error) {
      console.error('Failed to get reminder:', error);
      this.emit('reminder-error', { action: 'getById', error, id, userId });
      throw error;
    }
  }

  // Update an existing reminder
  async updateReminder(id, updates, userId) {
    try {
      // Get existing reminder
      const existing = await this.getReminderById(id, userId);
      if (!existing) {
        throw new ValidationError('id', `Reminder with id ${id} not found`);
      }

      // Validate updates
      const updatedData = { ...existing, ...updates };
      const validation = validateReminder(updatedData);
      if (!validation.isValid) {
        throw validation.errors[0];
      }

      // Update in storage
      const updatedReminder = await this.storage.updateReminder(id, {
        ...updates,
        updatedAt: new Date().toISOString()
      });

      // Update notifications if needed
      if (updates.notification !== undefined || updates.alertTimings || updates.datetime) {
        this.notifications.cancelNotification(id);

        if (updatedReminder.notification && updatedReminder.status === REMINDER_CONFIG.status.ACTIVE) {
          this.notifications.scheduleNotification(updatedReminder, updatedReminder.alertTimings);
        }
      }

      // Update cache
      this._updateCache(userId, updatedReminder, 'update');

      // Emit event
      this.emit('reminder-updated', { reminder: updatedReminder, changes: updates, userId });

      return updatedReminder;
    } catch (error) {
      console.error('Failed to update reminder:', error);
      this.emit('reminder-error', { action: 'update', error, id, updates, userId });
      throw error;
    }
  }

  // Complete a reminder
  async completeReminder(id, userId) {
    try {
      const updatedReminder = await this.updateReminder(id, {
        status: REMINDER_CONFIG.status.COMPLETED,
        completedAt: new Date().toISOString()
      }, userId);

      // Cancel notifications
      this.notifications.cancelNotification(id);

      // Emit event
      this.emit('reminder-completed', { reminder: updatedReminder, userId });

      return updatedReminder;
    } catch (error) {
      console.error('Failed to complete reminder:', error);
      throw error;
    }
  }

  // Snooze a reminder
  async snoozeReminder(id, minutes, userId) {
    try {
      const newDateTime = DateUtils.addTime(new Date(), minutes, 'minutes');

      const updatedReminder = await this.updateReminder(id, {
        datetime: newDateTime.toISOString(),
        status: REMINDER_CONFIG.status.ACTIVE,
        snoozedAt: new Date().toISOString(),
        snoozeCount: (await this.getReminderById(id, userId))?.snoozeCount || 0 + 1
      }, userId);

      // Emit event
      this.emit('reminder-snoozed', { reminder: updatedReminder, minutes, userId });

      return updatedReminder;
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
      throw error;
    }
  }

  // Delete a reminder
  async deleteReminder(id, userId) {
    try {
      // Verify ownership
      const existing = await this.getReminderById(id, userId);
      if (!existing) {
        throw new ValidationError('id', `Reminder with id ${id} not found`);
      }

      // Delete from storage
      const deleted = await this.storage.deleteReminder(id);

      if (deleted) {
        // Cancel notifications
        this.notifications.cancelNotification(id);

        // Update cache
        this._removeFromCache(userId, id);

        // Emit event
        this.emit('reminder-deleted', { reminder: existing, userId });
      }

      return deleted;
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      this.emit('reminder-error', { action: 'delete', error, id, userId });
      throw error;
    }
  }

  // Bulk operations
  async deleteMultipleReminders(ids, userId) {
    const results = await Promise.allSettled(
      ids.map(id => this.deleteReminder(id, userId))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    this.emit('bulk-delete-completed', { successful, failed, total: ids.length, userId });

    return { successful, failed, total: ids.length };
  }

  async completeMultipleReminders(ids, userId) {
    const results = await Promise.allSettled(
      ids.map(id => this.completeReminder(id, userId))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    this.emit('bulk-complete-completed', { successful, failed, total: ids.length, userId });

    return { successful, failed, total: ids.length };
  }

  // Get reminder statistics
  async getStatistics(userId) {
    try {
      const stats = await this.storage.getStatistics(userId);

      // Add computed statistics
      const reminders = await this.storage.getReminders(userId);
      const now = new Date();

      const additionalStats = {
        dueToday: reminders.filter(r =>
          r.status === REMINDER_CONFIG.status.ACTIVE &&
          DateUtils.isToday(r.datetime)
        ).length,

        dueTomorrow: reminders.filter(r => {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return r.status === REMINDER_CONFIG.status.ACTIVE &&
                 DateUtils.isToday(r.datetime, tomorrow);
        }).length,

        priorityDistribution: this._getPriorityDistribution(reminders),
        categoryDistribution: this._getCategoryDistribution(reminders),
        completionRate: this._calculateCompletionRate(reminders)
      };

      return { ...stats, ...additionalStats };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }

  // Search reminders
  async searchReminders(query, userId, options = {}) {
    try {
      const searchTerms = StringUtils.escapeHtml(query.toLowerCase().trim()).split(/\s+/);
      if (searchTerms.length === 0 || searchTerms[0] === '') {
        return { reminders: [], total: 0 };
      }

      const allReminders = await this.storage.getReminders(userId);

      const matchingReminders = allReminders.filter(reminder => {
        const searchableText = [
          reminder.title,
          reminder.description,
          reminder.category
        ].join(' ').toLowerCase();

        return searchTerms.every(term => searchableText.includes(term));
      });

      const result = await this.getReminders(userId, {
        ...options,
        filters: {
          ...options.filters,
          search: query
        }
      });

      return {
        ...result,
        query,
        searchTerms
      };
    } catch (error) {
      console.error('Failed to search reminders:', error);
      throw error;
    }
  }

  // Private helper methods
  async _updateReminderStatuses(reminders) {
    const updatedReminders = [];
    const now = new Date();

    for (const reminder of reminders) {
      const updatedReminder = this._updateReminderStatus(reminder);

      // Update in storage if status changed
      if (updatedReminder.status !== reminder.status) {
        try {
          await this.storage.updateReminder(reminder.id, {
            status: updatedReminder.status,
            statusUpdatedAt: now.toISOString()
          });
        } catch (error) {
          console.warn(`Failed to update status for reminder ${reminder.id}:`, error);
        }
      }

      updatedReminders.push(updatedReminder);
    }

    return updatedReminders;
  }

  _updateReminderStatus(reminder) {
    if (reminder.status === REMINDER_CONFIG.status.COMPLETED) {
      return reminder; // Don't change completed status
    }

    const now = new Date();
    const dueTime = new Date(reminder.datetime);

    if (dueTime <= now && reminder.status === REMINDER_CONFIG.status.ACTIVE) {
      return { ...reminder, status: REMINDER_CONFIG.status.OVERDUE };
    }

    return reminder;
  }

  _getCacheKey(userId, options) {
    return `${userId}-${JSON.stringify(options)}`;
  }

  _updateCache(userId, reminder, action) {
    // Clear cache entries that might be affected
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(userId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  _removeFromCache(userId, reminderId) {
    this._updateCache(userId, null, 'delete');
  }

  _getPriorityDistribution(reminders) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0 };
    reminders.forEach(r => {
      distribution[r.priority || 2]++;
    });
    return distribution;
  }

  _getCategoryDistribution(reminders) {
    const distribution = {};
    reminders.forEach(r => {
      const category = r.category || 'other';
      distribution[category] = (distribution[category] || 0) + 1;
    });
    return distribution;
  }

  _calculateCompletionRate(reminders) {
    if (reminders.length === 0) return 0;

    const completed = reminders.filter(r =>
      r.status === REMINDER_CONFIG.status.COMPLETED
    ).length;

    return Math.round((completed / reminders.length) * 100);
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}