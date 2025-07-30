/**
 * Notification Service - Enhanced notification system
 * Handles browser notifications, custom popups, and alert scheduling
 */

import { REMINDER_CONFIG, APP_CONFIG } from '../../config/constants.js';
import { EventEmitter } from '../../utils/helpers.js';

export class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.scheduledNotifications = new Map();
    this.activePopups = new Set();
    this.permissionState = 'default';
    this.checkInterval = null;
    this.audioContext = null;
    this.alertHistory = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return this;

    console.log('🔔 Initializing notification service...');

    await this._initializeAudioContext();
    await this._requestPermission();
    this._setupEventListeners();
    this._startNotificationChecker();
    this._addNotificationStyles();

    this.isInitialized = true;
    console.log('✅ Notification service ready');
    return this;
  }

  // Permission management
  async _requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      this.permissionState = 'unsupported';
      return;
    }

    if (Notification.permission === 'default') {
      try {
        this.permissionState = await Notification.requestPermission();
      } catch (error) {
        console.error('Permission request failed:', error);
        this.permissionState = 'denied';
      }
    } else {
      this.permissionState = Notification.permission;
    }

    console.log(`🔔 Notification permission: ${this.permissionState}`);
  }

  // Audio context setup
  async _initializeAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioContext = new AudioContext();
      }
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  // Event listeners setup
  _setupEventListeners() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('📱 Page visible - checking notifications...');
        this.emit('check-due-reminders');
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  // Notification checker
  _startNotificationChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.emit('check-due-reminders');
    }, APP_CONFIG.notifications.autoRefreshInterval);
  }

  // Schedule notifications for a reminder
  scheduleNotification(reminder, alertTimings = REMINDER_CONFIG.alertTimings) {
    const reminderTime = new Date(reminder.datetime);
    const now = new Date();
    const maxAdvanceTime = 3 * 24 * 60 * 60 * 1000; // 3 days max

    // Clear existing notifications
    this.cancelNotification(reminder.id);

    const timeoutIds = new Set();
    let scheduledCount = 0;

    // Convert alertTimings array to timing values
    const timingValues = Array.isArray(alertTimings)
      ? alertTimings
      : Object.values(REMINDER_CONFIG.alertTimings).map(t => t.value);

    timingValues.forEach(minutesBefore => {
      const alertTime = new Date(reminderTime.getTime() - (minutesBefore * 60 * 1000));
      const delay = alertTime.getTime() - now.getTime();

      // Only schedule future notifications within reasonable timeframe
      if (delay > 0 && delay <= maxAdvanceTime) {
        const timeoutId = setTimeout(() => {
          this._triggerNotification(reminder, minutesBefore);
        }, delay);

        timeoutIds.add(timeoutId);
        scheduledCount++;

        console.log(`⏰ Scheduled alert for "${reminder.title}" ${minutesBefore} minutes before`);
      }
    });

    if (scheduledCount > 0) {
      this.scheduledNotifications.set(reminder.id, timeoutIds);
    }

    return scheduledCount;
  }

  // Cancel notifications for a reminder
  cancelNotification(reminderId) {
    const timeoutIds = this.scheduledNotifications.get(reminderId);
    if (!timeoutIds) return false;

    let cancelledCount = 0;
    timeoutIds.forEach(timeoutId => {
      clearTimeout(timeoutId);
      cancelledCount++;
    });

    this.scheduledNotifications.delete(reminderId);
    this.alertHistory.delete(reminderId);

    console.log(`🚫 Cancelled ${cancelledCount} alerts for reminder #${reminderId}`);
    return true;
  }

  // Check for due reminders
  checkDueReminders(reminders) {
    const now = new Date();

    reminders.forEach(reminder => {
      if (reminder.status !== 'active' || !reminder.notification) return;

      const reminderTime = new Date(reminder.datetime);
      const timeDiff = reminderTime - now;

      // Check each configured alert timing
      const alertTimings = reminder.alertTimings || [5, 15];
      alertTimings.forEach(minutesBefore => {
        const alertThreshold = minutesBefore * 60 * 1000;
        const alertKey = `${reminder.id}-${minutesBefore}`;

        if (timeDiff <= alertThreshold &&
            timeDiff > (alertThreshold - 60000) &&
            !this.alertHistory.has(alertKey)) {

          this._triggerNotification(reminder, minutesBefore);
          this.alertHistory.set(alertKey, now);
        }
      });

      // Handle overdue reminders
      if (timeDiff <= 0 && timeDiff > -60000 && !this.alertHistory.has(`${reminder.id}-overdue`)) {
        this._triggerNotification(reminder, 0, true);
        this.alertHistory.set(`${reminder.id}-overdue`, now);
      }
    });
  }

  // Trigger a notification
  async _triggerNotification(reminder, minutesBefore, isOverdue = false) {
    const alertType = this._getAlertType(minutesBefore, isOverdue);

    console.log(`🔔 Triggering ${alertType} notification: ${reminder.title}`);

    // Play sound
    await this._playNotificationSound(alertType);

    // Show browser notification
    if (this.permissionState === 'granted') {
      this._showBrowserNotification(reminder, minutesBefore, isOverdue);
    }

    // Show custom popup
    this._showCustomPopup(reminder, minutesBefore, isOverdue);

    // Emit event for external handling
    this.emit('notification-triggered', {
      reminder,
      minutesBefore,
      isOverdue,
      alertType
    });
  }

  // Play notification sound
  async _playNotificationSound(alertType) {
    if (!this.audioContext || this.audioContext.state === 'suspended') {
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      const soundPatterns = {
        OVERDUE: { frequencies: [400, 600, 400], duration: 0.6 },
        URGENT: { frequencies: [800, 1000, 1200], duration: 0.5 },
        NORMAL: { frequencies: [600, 800, 600], duration: 0.4 },
        ADVANCE: { frequencies: [500, 700, 500], duration: 0.3 }
      };

      const pattern = soundPatterns[alertType] || soundPatterns.NORMAL;
      const stepDuration = pattern.duration / pattern.frequencies.length;

      pattern.frequencies.forEach((freq, index) => {
        const time = this.audioContext.currentTime + (index * stepDuration);
        oscillator.frequency.setValueAtTime(freq, time);
      });

      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + pattern.duration);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + pattern.duration);

    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  // Show browser notification
  _showBrowserNotification(reminder, minutesBefore, isOverdue) {
    if (this.permissionState !== 'granted') return;

    const title = isOverdue
      ? '⚠️ Overdue Reminder!'
      : `🔔 Reminder Alert! (${minutesBefore} min)`;

    const body = isOverdue
      ? `Overdue: ${reminder.title}`
      : `Coming up in ${minutesBefore} minutes: ${reminder.title}`;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.png',
      tag: `reminder-${reminder.id}-${minutesBefore || 'overdue'}`,
      requireInteraction: isOverdue || minutesBefore <= 5,
      data: { reminderId: reminder.id, minutesBefore, isOverdue }
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      this.emit('notification-clicked', { reminder, minutesBefore, isOverdue });
    };

    const autoCloseDelay = isOverdue ? 30000 : (minutesBefore <= 15 ? 15000 : 10000);
    setTimeout(() => notification.close(), autoCloseDelay);
  }

  // Show custom popup notification
  _showCustomPopup(reminder, minutesBefore, isOverdue) {
    const popupId = `${reminder.id}-${minutesBefore || 'overdue'}`;
    if (this.activePopups.has(popupId)) return;

    this.activePopups.add(popupId);

    const overlay = this._createPopupOverlay(reminder, minutesBefore, isOverdue);
    document.body.appendChild(overlay);

    // Auto-dismiss timing
    const autoDismissTime = isOverdue ? 60 : (minutesBefore <= 15 ? 45 : 30);
    this._startCountdown(popupId, autoDismissTime);

    // Setup event handlers
    this._setupPopupHandlers(overlay, reminder, minutesBefore, isOverdue);
  }

  // Create popup overlay
  _createPopupOverlay(reminder, minutesBefore, isOverdue) {
    const overlay = document.createElement('div');
    overlay.className = 'reminder-alert-overlay';
    overlay.dataset.popupId = `${reminder.id}-${minutesBefore || 'overdue'}`;

    const alertInfo = this._getAlertInfo(minutesBefore, isOverdue);
    const formattedTime = this._formatTime(reminder.datetime);

    overlay.innerHTML = `
      <div class="reminder-alert-popup ${isOverdue ? 'overdue' : ''}">
        <div class="alert-header">
          <div class="alert-icon">${alertInfo.icon}</div>
          <h2 class="alert-title">${alertInfo.title}</h2>
          <div class="alert-timing">${alertInfo.subtitle}</div>
        </div>

        <div class="alert-content">
          <div class="alert-reminder-title">
            ${this._getPriorityIcon(reminder.priority)} ${this._escapeHtml(reminder.title)}
          </div>

          <div class="alert-reminder-time">
            ⏰ <strong>${isOverdue ? 'Was due' : 'Due'}:</strong> ${formattedTime}
          </div>

          ${reminder.description ? `
            <div class="alert-reminder-description">
              📝 ${this._escapeHtml(reminder.description)}
            </div>
          ` : ''}

          <div class="alert-actions">
            <button class="alert-btn alert-btn-complete" data-action="complete">
              ✅ Complete
            </button>
            <button class="alert-btn alert-btn-snooze" data-action="snooze">
              ⏰ Snooze
            </button>
            <button class="alert-btn alert-btn-dismiss" data-action="dismiss">
              ❌ Dismiss
            </button>
          </div>

          <div class="alert-auto-dismiss">
            Auto-dismiss in <span class="countdown">${isOverdue ? 60 : 30}</span> seconds
          </div>
        </div>
      </div>
    `;

    return overlay;
  }

  // Test notification
  testNotification() {
    const testReminder = {
      id: 99999,
      title: 'Test Notification System',
      description: 'Testing the notification system functionality',
      datetime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      priority: 3,
      category: 'personal'
    };

    this._triggerNotification(testReminder, 5, false);
  }

  // Utility methods
  _getAlertType(minutesBefore, isOverdue) {
    if (isOverdue) return 'OVERDUE';
    if (minutesBefore <= 5) return 'URGENT';
    if (minutesBefore <= 60) return 'NORMAL';
    return 'ADVANCE';
  }

  _getAlertInfo(minutesBefore, isOverdue) {
    if (isOverdue) {
      return {
        title: 'Overdue Reminder!',
        subtitle: 'This reminder is past due',
        icon: '⚠️'
      };
    }

    const timing = Object.values(REMINDER_CONFIG.alertTimings)
      .find(t => t.value === minutesBefore);

    return {
      title: 'Reminder Alert!',
      subtitle: timing ? timing.label : `${minutesBefore} minutes before`,
      icon: timing ? timing.icon : '🔔'
    };
  }

  _getPriorityIcon(priority) {
    const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
    return icons[priority] || '⚪';
  }

  _formatTime(datetime) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(datetime));
  }

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Cleanup method
  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.scheduledNotifications.forEach(timeoutIds => {
      timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    });
    this.scheduledNotifications.clear();

    this.activePopups.forEach(popupId => {
      this._closePopup(popupId);
    });

    this.alertHistory.clear();
    this.removeAllListeners();

    console.log('🧹 Notification service cleaned up');
  }

  // Add notification styles
  _addNotificationStyles() {
    if (document.getElementById('notification-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
      .reminder-alert-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      }

      .reminder-alert-popup {
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        border: 3px solid #3b82f6;
        animation: slideIn 0.3s ease;
      }

      .reminder-alert-popup.overdue {
        border-color: #ef4444;
        animation: urgentPulse 1s ease-in-out infinite;
      }

      .alert-header {
        text-align: center;
        margin-bottom: 20px;
        padding: 16px;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        border-radius: 12px;
        margin: -24px -24px 20px -24px;
      }

      .alert-header.overdue {
        background: linear-gradient(135deg, #ef4444, #dc2626);
      }

      .alert-icon {
        font-size: 2rem;
        margin-bottom: 8px;
      }

      .alert-title {
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0;
      }

      .alert-timing {
        font-size: 0.9rem;
        opacity: 0.9;
        margin-top: 4px;
      }

      .alert-reminder-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 12px;
        color: #1f2937;
      }

      .alert-reminder-time {
        margin-bottom: 12px;
        padding: 8px 12px;
        background: #f3f4f6;
        border-radius: 8px;
        border-left: 3px solid #3b82f6;
      }

      .alert-reminder-description {
        margin-bottom: 16px;
        color: #6b7280;
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .alert-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .alert-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }

      .alert-btn-complete {
        background: #10b981;
        color: white;
      }

      .alert-btn-snooze {
        background: #f59e0b;
        color: white;
      }

      .alert-btn-dismiss {
        background: #6b7280;
        color: white;
      }

      .alert-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      .alert-auto-dismiss {
        text-align: center;
        font-size: 0.8rem;
        color: #6b7280;
      }

      .countdown {
        font-weight: 600;
        color: #ef4444;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { transform: scale(0.9) translateY(20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }

      @keyframes urgentPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }

      @media (max-width: 768px) {
        .reminder-alert-popup {
          margin: 16px;
          max-width: none;
        }

        .alert-actions {
          flex-direction: column;
        }

        .alert-btn {
          flex: none;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  // Setup popup event handlers
  _setupPopupHandlers(overlay, reminder, minutesBefore, isOverdue) {
    overlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        e.preventDefault();
        this._handlePopupAction(reminder.id, action, minutesBefore, isOverdue);
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._closePopup(`${reminder.id}-${minutesBefore || 'overdue'}`);
      }
    });

    // ESC key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this._closePopup(`${reminder.id}-${minutesBefore || 'overdue'}`);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  // Handle popup actions
  _handlePopupAction(reminderId, action, minutesBefore, isOverdue) {
    const popupId = `${reminderId}-${minutesBefore || 'overdue'}`;

    switch (action) {
      case 'complete':
        this.emit('reminder-complete', { reminderId });
        this._closePopup(popupId);
        break;
      case 'snooze':
        this.emit('reminder-snooze', { reminderId, minutes: 15 }); // Default 15 min snooze
        this._closePopup(popupId);
        break;
      case 'dismiss':
        this._closePopup(popupId);
        break;
    }
  }

  // Start countdown timer
  _startCountdown(popupId, seconds) {
    const countdownElement = document.querySelector(`[data-popup-id="${popupId}"] .countdown`);
    if (!countdownElement) return;

    let remaining = seconds;
    const timer = setInterval(() => {
      remaining--;
      if (countdownElement) {
        countdownElement.textContent = remaining;

        if (remaining <= 10) {
          countdownElement.style.color = '#ef4444';
          countdownElement.style.fontWeight = 'bold';
        }
      }

      if (remaining <= 0) {
        clearInterval(timer);
        this._closePopup(popupId);
      }
    }, 1000);

    // Store timer for cleanup
    const overlay = document.querySelector(`[data-popup-id="${popupId}"]`);
    if (overlay) overlay.dataset.timer = timer;
  }

  // Close popup
  _closePopup(popupId) {
    const overlay = document.querySelector(`[data-popup-id="${popupId}"]`);
    if (!overlay) return;

    // Clear timer
    const timer = overlay.dataset.timer;
    if (timer) clearInterval(parseInt(timer));

    // Remove from active popups
    this.activePopups.delete(popupId);

    // Animate out and remove
    overlay.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }

  // Get notification statistics
  getNotificationStats() {
    const totalScheduled = Array.from(this.scheduledNotifications.values())
      .reduce((sum, timeouts) => sum + timeouts.size, 0);

    return {
      totalScheduled,
      activeReminders: this.scheduledNotifications.size,
      alertHistory: this.alertHistory.size,
      permissionState: this.permissionState,
      activePopups: this.activePopups.size
    };
  }

  // Get available alert timing options
  static getAlertTimingOptions() {
    return Object.entries(REMINDER_CONFIG.alertTimings).map(([key, timing]) => ({
      key,
      value: timing.value,
      label: timing.label,
      icon: timing.icon,
      category: timing.value < 60 ? 'minutes' : timing.value < 1440 ? 'hours' : 'days'
    }));
  }
}