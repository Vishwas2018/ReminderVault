// ===== NOTIFICATION SERVICE - MODERN NOTIFICATION MANAGEMENT =====

import { UI, DateTime, generateUUID } from '../utils.js';
import {
    APP_CONFIG,
    REMINDER_STATUS,
    MESSAGES,
    FEATURE_FLAGS
} from '../config/constants.js';

/**
 * Modern notification service with advanced scheduling and cross-platform support
 */
export class NotificationService {
    #scheduledNotifications = new Map();
    #activePopups = new Set();
    #permissionState = 'default';
    #audioContext = null;
    #eventBus = new Map();
    #config = {
        maxConcurrentPopups: 3,
        defaultSoundEnabled: true,
        vibrationPattern: [200, 100, 200]
    };

    constructor(ui = UI) {
        this.ui = ui;
        this.#initializeAudioContext();
    }

    /**
     * Initialize notification service with permission handling
     */
    async init() {
        console.log('🔔 Initializing NotificationService...');

        try {
            await this.#requestPermissions();
            this.#setupEventListeners();
            this.#registerServiceWorker();

            console.log('✅ NotificationService initialized successfully');
        } catch (error) {
            console.error('❌ NotificationService initialization failed:', error);
            throw new Error('Notification service initialization failed');
        }
    }

    /**
     * Schedule notification for reminder with advanced options
     */
    async scheduleNotification(reminder, options = {}) {
        const {
            showBrowserNotification = true,
            showPopup = true,
            playSound = this.#config.defaultSoundEnabled,
            vibrate = false,
            snoozeOptions = this.#getDefaultSnoozeOptions()
        } = options;

        if (!this.#isValidReminder(reminder)) {
            throw new Error('Invalid reminder data for notification');
        }

        const reminderTime = new Date(reminder.datetime).getTime();
        const currentTime = Date.now();
        const delay = reminderTime - currentTime;

        // Only schedule future notifications within reasonable limits (30 days)
        if (delay <= 0 || delay > 30 * 24 * 60 * 60 * 1000) {
            console.warn(`Notification scheduling skipped for reminder ${reminder.id}: invalid timing`);
            return null;
        }

        const notificationConfig = {
            id: generateUUID(),
            reminderId: reminder.id,
            reminder: Object.freeze({ ...reminder }),
            scheduledTime: reminderTime,
            options: Object.freeze({
                showBrowserNotification,
                showPopup,
                playSound,
                vibrate,
                snoozeOptions
            })
        };

        // Schedule the notification
        const timeoutId = setTimeout(
            () => this.#triggerNotification(notificationConfig),
            delay
        );

        this.#scheduledNotifications.set(reminder.id, {
            ...notificationConfig,
            timeoutId
        });

        console.log(`⏰ Notification scheduled for "${reminder.title}" in ${Math.round(delay / 60000)} minutes`);

        this.#emit('notification:scheduled', {
            reminderId: reminder.id,
            delay,
            scheduledTime: reminderTime
        });

        return notificationConfig.id;
    }

    /**
     * Cancel scheduled notification
     */
    cancelNotification(reminderId) {
        const notification = this.#scheduledNotifications.get(reminderId);

        if (notification) {
            clearTimeout(notification.timeoutId);
            this.#scheduledNotifications.delete(reminderId);

            console.log(`❌ Notification cancelled for reminder ${reminderId}`);
            this.#emit('notification:cancelled', { reminderId });

            return true;
        }

        return false;
    }

    /**
     * Clear all scheduled notifications
     */
    clearAllNotifications() {
        const count = this.#scheduledNotifications.size;

        this.#scheduledNotifications.forEach(({ timeoutId }) => {
            clearTimeout(timeoutId);
        });

        this.#scheduledNotifications.clear();

        console.log(`🧹 Cleared ${count} scheduled notifications`);
        this.#emit('notification:all-cleared', { count });

        return count;
    }

    /**
     * Reschedule notifications for multiple reminders
     */
    async rescheduleNotifications(reminders, options = {}) {
        this.clearAllNotifications();

        const scheduled = [];
        const failed = [];

        for (const reminder of reminders) {
            if (reminder.status === REMINDER_STATUS.ACTIVE && reminder.notification) {
                try {
                    const notificationId = await this.scheduleNotification(reminder, options);
                    if (notificationId) {
                        scheduled.push({ reminderId: reminder.id, notificationId });
                    }
                } catch (error) {
                    console.error(`Failed to schedule notification for reminder ${reminder.id}:`, error);
                    failed.push({ reminderId: reminder.id, error: error.message });
                }
            }
        }

        console.log(`🔄 Rescheduled ${scheduled.length} notifications, ${failed.length} failed`);

        this.#emit('notification:rescheduled', { scheduled, failed });

        return { scheduled, failed };
    }

    /**
     * Show immediate notification (for testing or urgent alerts)
     */
    async showImmediateNotification(reminder, options = {}) {
        const notificationConfig = {
            id: generateUUID(),
            reminderId: reminder.id,
            reminder: Object.freeze({ ...reminder }),
            scheduledTime: Date.now(),
            options: Object.freeze({
                showBrowserNotification: true,
                showPopup: true,
                playSound: true,
                vibrate: false,
                ...options
            })
        };

        await this.#triggerNotification(notificationConfig);
        return notificationConfig.id;
    }

    /**
     * Test notification system with configurable delay
     */
    async test(delaySeconds = 5, options = {}) {
        const testReminder = {
            id: `test-${Date.now()}`,
            title: 'Test Notification',
            description: 'This is a test notification to verify the system is working correctly.',
            datetime: new Date(Date.now() + delaySeconds * 1000).toISOString(),
            category: 'personal',
            priority: 3,
            status: REMINDER_STATUS.ACTIVE,
            notification: true
        };

        this.ui.showNotification(
            `Test notification scheduled for ${delaySeconds} seconds`,
            'info'
        );

        return this.scheduleNotification(testReminder, {
            ...options,
            playSound: true,
            vibrate: true
        });
    }

    /**
     * Update notification configuration
     */
    updateConfig(newConfig) {
        this.#config = { ...this.#config, ...newConfig };
        console.log('🔧 Notification config updated:', this.#config);
        this.#emit('notification:config-updated', { config: this.#config });
    }

    /**
     * Get current notification status and statistics
     */
    getStatus() {
        return Object.freeze({
            permissionState: this.#permissionState,
            scheduledCount: this.#scheduledNotifications.size,
            activePopups: this.#activePopups.size,
            browserSupport: this.#getBrowserSupport(),
            config: { ...this.#config }
        });
    }

    /**
     * Add event listener for notification events
     */
    on(event, callback) {
        if (!this.#eventBus.has(event)) {
            this.#eventBus.set(event, new Set());
        }
        this.#eventBus.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        this.#eventBus.get(event)?.delete(callback);
    }

    // ===== PRIVATE METHODS =====

    /**
     * Request notification permissions with fallback handling
     */
    async #requestPermissions() {
        if (!('Notification' in window)) {
            console.warn('Browser notifications not supported');
            this.#permissionState = 'unsupported';
            return;
        }

        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                this.#permissionState = permission;

                if (permission === 'granted') {
                    this.ui.showNotification(
                        'Notifications enabled! You\'ll receive alerts for your reminders.',
                        'success'
                    );
                } else {
                    this.ui.showNotification(
                        'Notifications disabled. You can enable them in browser settings.',
                        'warning'
                    );
                }
            } catch (error) {
                console.error('Permission request failed:', error);
                this.#permissionState = 'denied';
            }
        } else {
            this.#permissionState = Notification.permission;
        }

        console.log(`🔔 Notification permission: ${this.#permissionState}`);
    }

    /**
     * Trigger notification with all configured methods
     */
    async #triggerNotification(config) {
        const { reminder, options } = config;

        console.log(`🔔 Triggering notification for: ${reminder.title}`);

        // Play notification sound first for immediate feedback
        if (options.playSound) {
            await this.#playNotificationSound();
        }

        // Vibrate if supported and enabled
        if (options.vibrate && navigator.vibrate) {
            navigator.vibrate(this.#config.vibrationPattern);
        }

        // Show browser notification
        if (options.showBrowserNotification && this.#permissionState === 'granted') {
            await this.#showBrowserNotification(reminder);
        }

        // Show custom popup
        if (options.showPopup) {
            await this.#showNotificationPopup(reminder, options.snoozeOptions);
        }

        // Emit notification triggered event
        this.#emit('notification:triggered', {
            reminderId: reminder.id,
            title: reminder.title,
            methods: {
                browser: options.showBrowserNotification && this.#permissionState === 'granted',
                popup: options.showPopup,
                sound: options.playSound,
                vibration: options.vibrate
            }
        });

        // Clean up from scheduled notifications
        this.#scheduledNotifications.delete(reminder.id);
    }

    /**
     * Show browser notification with rich content
     */
    async #showBrowserNotification(reminder) {
        if (this.#permissionState !== 'granted') return;

        const notification = new Notification('Reminder Alert', {
            body: reminder.title,
            icon: '/favicon.ico',
            badge: '/badge-icon.png',
            tag: `reminder-${reminder.id}`,
            requireInteraction: true,
            data: { reminderId: reminder.id },
            actions: FEATURE_FLAGS.enableAdvancedNotifications ? [
                { action: 'complete', title: 'Mark Complete' },
                { action: 'snooze', title: 'Snooze 15m' }
            ] : undefined
        });

        // Handle notification click
        notification.onclick = () => {
            window.focus();
            notification.close();
            this.#handleNotificationAction(reminder, 'view');
        };

        // Handle action clicks (if supported)
        if (notification.actions) {
            notification.onnotificationclick = (event) => {
                event.notification.close();
                this.#handleNotificationAction(reminder, event.action);
            };
        }

        // Auto-close after timeout
        setTimeout(() => notification.close(), 15000);

        return notification;
    }

    /**
     * Show custom notification popup with enhanced UX
     */
    async #showNotificationPopup(reminder, snoozeOptions) {
        // Limit concurrent popups for better UX
        if (this.#activePopups.size >= this.#config.maxConcurrentPopups) {
            console.warn('Maximum concurrent popups reached, queueing notification');
            return;
        }

        const popup = this.#createNotificationPopup(reminder, snoozeOptions);
        this.#activePopups.add(popup);

        // Auto-dismiss after 30 seconds
        const autoDismissTimer = setTimeout(() => {
            this.#closeNotificationPopup(popup);
        }, 30000);

        popup.autoDismissTimer = autoDismissTimer;

        // Handle escape key
        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                this.#closeNotificationPopup(popup);
                document.removeEventListener('keydown', escapeHandler);
            }
        };

        document.addEventListener('keydown', escapeHandler);
        popup.escapeHandler = escapeHandler;

        return popup;
    }

    /**
     * Create notification popup with modern design
     */
    #createNotificationPopup(reminder, snoozeOptions) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'notification-popup-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'notification-popup';
        popup.setAttribute('role', 'alertdialog');
        popup.setAttribute('aria-labelledby', 'popup-title');
        popup.setAttribute('aria-describedby', 'popup-content');

        const formattedTime = DateTime.formatDate(
            new Date(reminder.datetime),
            'localeDateTime'
        );

        popup.innerHTML = `
      <div class="popup-header">
        <div class="popup-icon">🔔</div>
        <h3 id="popup-title" class="popup-title">Reminder Alert</h3>
      </div>
      
      <div id="popup-content" class="popup-content">
        <div class="popup-reminder-title">${this.#escapeHtml(reminder.title)}</div>
        <div class="popup-reminder-time">Due: ${formattedTime}</div>
        ${reminder.description ? `
          <div class="popup-reminder-description">
            ${this.#escapeHtml(reminder.description)}
          </div>
        ` : ''}
      </div>
      
      <div class="popup-actions">
        <button class="popup-btn popup-btn-complete" data-action="complete" aria-label="Mark as complete">
          ✅ Complete
        </button>
        <button class="popup-btn popup-btn-snooze" data-action="snooze" aria-label="Snooze reminder">
          ⏰ Snooze
        </button>
        <button class="popup-btn popup-btn-dismiss" data-action="dismiss" aria-label="Dismiss notification">
          ❌ Dismiss
        </button>
      </div>
    `;

        // Add event listeners
        popup.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (action) {
                event.preventDefault();
                this.#handlePopupAction(reminder, action, popup, snoozeOptions);
            }
        });

        // Prevent overlay clicks from closing
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.#closeNotificationPopup(popup);
            }
        });

        // Assemble and show
        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            popup.classList.add('popup-show');
        });

        // Focus first button for accessibility
        const firstButton = popup.querySelector('.popup-btn');
        firstButton?.focus();

        return popup;
    }

    /**
     * Handle popup action with appropriate response
     */
    async #handlePopupAction(reminder, action, popup, snoozeOptions) {
        switch (action) {
            case 'complete':
                this.#emit('reminder:complete', { reminder });
                this.ui.showNotification(
                    `Reminder "${reminder.title}" marked as complete!`,
                    'success'
                );
                this.#closeNotificationPopup(popup);
                break;

            case 'snooze':
                await this.#showSnoozeOptions(reminder, popup, snoozeOptions);
                break;

            case 'dismiss':
                this.ui.showNotification('Reminder dismissed', 'info');
                this.#closeNotificationPopup(popup);
                break;

            default:
                console.warn(`Unknown popup action: ${action}`);
        }
    }

    /**
     * Show snooze options with enhanced UX
     */
    async #showSnoozeOptions(reminder, originalPopup, snoozeOptions) {
        const snoozePopup = document.createElement('div');
        snoozePopup.className = 'notification-popup snooze-popup';
        snoozePopup.setAttribute('role', 'dialog');
        snoozePopup.setAttribute('aria-label', 'Snooze options');

        const optionsHtml = snoozeOptions.map(option => `
      <button class="popup-btn popup-btn-snooze" 
              data-minutes="${option.minutes || 0}"
              data-hours="${option.hours || 0}"
              data-days="${option.days || 0}">
        ${option.label}
      </button>
    `).join('');

        snoozePopup.innerHTML = `
      <div class="popup-header">
        <div class="popup-icon">⏰</div>
        <h3 class="popup-title">Snooze Reminder</h3>
      </div>
      
      <div class="popup-content">
        <div class="popup-reminder-title">${this.#escapeHtml(reminder.title)}</div>
        <p>How long would you like to snooze this reminder?</p>
      </div>
      
      <div class="popup-actions snooze-actions">
        ${optionsHtml}
        <button class="popup-btn popup-btn-dismiss" data-action="cancel">
          Cancel
        </button>
      </div>
    `;

        // Handle snooze selection
        snoozePopup.addEventListener('click', (event) => {
            const button = event.target.closest('.popup-btn');
            if (!button) return;

            if (button.dataset.action === 'cancel') {
                this.#replacePopup(snoozePopup, originalPopup);
                return;
            }

            const minutes = parseInt(button.dataset.minutes) || 0;
            const hours = parseInt(button.dataset.hours) || 0;
            const days = parseInt(button.dataset.days) || 0;

            this.#applySnooze(reminder, { minutes, hours, days });
            this.#closeNotificationPopup(snoozePopup);
        });

        this.#replacePopup(originalPopup, snoozePopup);
    }

    /**
     * Apply snooze with calculated time
     */
    #applySnooze(reminder, { minutes, hours, days }) {
        const totalMinutes = minutes + (hours * 60) + (days * 24 * 60);
        const newTime = new Date(Date.now() + totalMinutes * 60 * 1000);

        this.#emit('reminder:snooze', {
            reminder,
            newDateTime: newTime.toISOString(),
            snoozeMinutes: totalMinutes
        });

        this.ui.showNotification(
            `Reminder snoozed for ${this.#formatDuration(totalMinutes)}`,
            'success'
        );
    }

    /**
     * Close notification popup with cleanup
     */
    #closeNotificationPopup(popup) {
        if (!this.#activePopups.has(popup)) return;

        // Clear timers
        clearTimeout(popup.autoDismissTimer);

        // Remove event listeners
        if (popup.escapeHandler) {
            document.removeEventListener('keydown', popup.escapeHandler);
        }

        // Animate out
        const overlay = document.querySelector('.notification-popup-overlay');
        popup.classList.add('popup-hide');

        if (overlay) overlay.style.opacity = '0';

        setTimeout(() => {
            popup.remove();
            overlay?.remove();
            this.#activePopups.delete(popup);
        }, 300);
    }

    /**
     * Replace one popup with another smoothly
     */
    #replacePopup(oldPopup, newPopup) {
        document.body.appendChild(newPopup);

        // Animate transition
        oldPopup.style.transform = 'translateX(-100%)';
        newPopup.style.transform = 'translateX(100%)';

        requestAnimationFrame(() => {
            newPopup.style.transform = 'translateX(0)';
            newPopup.classList.add('popup-show');
        });

        setTimeout(() => {
            oldPopup.remove();
            this.#activePopups.delete(oldPopup);
            this.#activePopups.add(newPopup);
        }, 300);
    }

    /**
     * Play notification sound using Web Audio API
     */
    async #playNotificationSound() {
        if (!this.#audioContext || !this.#config.defaultSoundEnabled) return;

        try {
            // Resume audio context if suspended (required by some browsers)
            if (this.#audioContext.state === 'suspended') {
                await this.#audioContext.resume();
            }

            const oscillator = this.#audioContext.createOscillator();
            const gainNode = this.#audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.#audioContext.destination);

            // Create pleasant notification sound
            oscillator.frequency.setValueAtTime(800, this.#audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, this.#audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(600, this.#audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, this.#audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.#audioContext.currentTime + 0.4);

            oscillator.start(this.#audioContext.currentTime);
            oscillator.stop(this.#audioContext.currentTime + 0.4);

        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }

    /**
     * Initialize audio context for sound generation
     */
    #initializeAudioContext() {
        try {
            this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    /**
     * Setup global event listeners
     */
    #setupEventListeners() {
        // Handle page visibility to pause/resume notifications
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden, maintaining notification schedule');
            } else {
                console.log('Page visible, checking notification queue');
                this.#emit('page:visibility-changed', { hidden: document.hidden });
            }
        });

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            this.clearAllNotifications();
        });
    }

    /**
     * Register service worker for background notifications
     */
    async #registerServiceWorker() {
        if (!('serviceWorker' in navigator) || !FEATURE_FLAGS.enableAdvancedNotifications) {
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            this.#emit('service-worker:registered', { registration });
        } catch (error) {
            console.warn('Service Worker registration failed:', error);
        }
    }

    /**
     * Handle notification actions (complete, snooze, etc.)
     */
    #handleNotificationAction(reminder, action) {
        switch (action) {
            case 'complete':
                this.#emit('reminder:complete', { reminder });
                break;
            case 'snooze':
                this.#applySnooze(reminder, { minutes: 15 }); // Default 15min snooze
                break;
            case 'view':
                this.#emit('reminder:view', { reminder });
                break;
        }
    }

    /**
     * Get browser support information
     */
    #getBrowserSupport() {
        return {
            notifications: 'Notification' in window,
            serviceWorker: 'serviceWorker' in navigator,
            audioContext: !!(window.AudioContext || window.webkitAudioContext),
            vibration: 'vibrate' in navigator,
            permissions: 'permissions' in navigator
        };
    }

    /**
     * Get default snooze options
     */
    #getDefaultSnoozeOptions() {
        return [
            { label: '5 minutes', minutes: 5 },
            { label: '15 minutes', minutes: 15 },
            { label: '30 minutes', minutes: 30 },
            { label: '1 hour', hours: 1 },
            { label: '2 hours', hours: 2 },
            { label: 'Tomorrow', hours: 24 }
        ];
    }

    /**
     * Validate reminder data
     */
    #isValidReminder(reminder) {
        return reminder &&
            reminder.id &&
            reminder.title &&
            reminder.datetime &&
            !isNaN(Date.parse(reminder.datetime));
    }

    /**
     * Format duration for display
     */
    #formatDuration(totalMinutes) {
        if (totalMinutes < 60) {
            return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours < 24) {
            return minutes > 0
                ? `${hours}h ${minutes}m`
                : `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        return remainingHours > 0
            ? `${days}d ${remainingHours}h`
            : `${days} day${days !== 1 ? 's' : ''}`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Emit events to listeners
     */
    #emit(eventName, data = {}) {
        const listeners = this.#eventBus.get(eventName);
        listeners?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in notification event listener for "${eventName}":`, error);
            }
        });

        // Also emit as DOM event for global listeners
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

// Create singleton instance
export const notificationService = new NotificationService();

// Export both class and instance for flexibility
export default notificationService;