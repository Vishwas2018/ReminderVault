// ===== NOTIFICATION MANAGER =====

/**
 * Manages all notification functionality including browser notifications,
 * alert popups, and reminder scheduling
 */
const NotificationManager = {

    // Timer tracking for scheduled notifications
    timers: new Map(),

    // Permission status
    permissionGranted: false,

    /**
     * Initialize notification system
     */
    init: function() {
        console.log('Initializing NotificationManager...');

        this.requestPermission();
        this.setupEventListeners();

        console.log('NotificationManager initialized');
    },

    /**
     * Request notification permission
     */
    requestPermission: function() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    console.log('Notification permission:', permission);
                    this.permissionGranted = permission === 'granted';

                    if (this.permissionGranted) {
                        Utils.UI.showNotification('Notifications enabled! You\'ll receive alerts for your reminders.', 'success');
                    }
                });
            } else {
                this.permissionGranted = Notification.permission === 'granted';
            }
        } else {
            console.warn('This browser does not support desktop notifications');
        }
    },

    /**
     * Set up event listeners for notification interactions
     */
    setupEventListeners: function() {
        // Handle escape key to close popups
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAlertPopup();
            }
        });
    },

    /**
     * Schedule notification for a reminder
     */
    scheduleNotification: function(reminder) {
        if (!this.permissionGranted) {
            console.log('Notification permission not granted, skipping schedule');
            return;
        }

        const reminderTime = new Date(reminder.datetime).getTime();
        const now = Date.now();
        const delay = reminderTime - now;

        // Only schedule if reminder is in the future and within 24 hours
        if (delay > 0 && delay <= 24 * 60 * 60 * 1000) {
            const timerId = setTimeout(() => {
                this.showReminderAlert(reminder);
                this.timers.delete(reminder.id);
            }, delay);

            this.timers.set(reminder.id, timerId);
            console.log(`Notification scheduled for reminder "${reminder.title}" in ${Math.round(delay / 1000 / 60)} minutes`);
        }
    },

    /**
     * Clear scheduled notification
     */
    clearNotification: function(reminderId) {
        const timerId = this.timers.get(reminderId);
        if (timerId) {
            clearTimeout(timerId);
            this.timers.delete(reminderId);
            console.log(`Notification cleared for reminder ID: ${reminderId}`);
        }
    },

    /**
     * Clear all scheduled notifications
     */
    clearAllNotifications: function() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        console.log('All notifications cleared');
    },

    /**
     * Reschedule all notifications for active reminders
     */
    rescheduleNotifications: function(reminders) {
        this.clearAllNotifications();

        reminders.forEach(reminder => {
            if (reminder.status === REMINDER_STATUS.ACTIVE && reminder.notification) {
                this.scheduleNotification(reminder);
            }
        });
    },

    /**
     * Show reminder alert (browser notification + popup)
     */
    showReminderAlert: function(reminder) {
        console.log('Showing reminder alert for:', reminder.title);

        // Play notification sound
        this.playNotificationSound();

        // Show browser notification
        this.showBrowserNotification(reminder);

        // Show custom alert popup
        this.showAlertPopup(reminder);
    },

    /**
     * Show browser notification
     */
    showBrowserNotification: function(reminder) {
        if (!this.permissionGranted) return;

        const notification = new Notification('Reminder Alert', {
            body: reminder.title,
            icon: '/favicon.ico',
            tag: `reminder-${reminder.id}`,
            requireInteraction: true
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
            this.showAlertPopup(reminder);
        };

        // Auto-close after 10 seconds
        setTimeout(() => {
            notification.close();
        }, 10000);
    },

    /**
     * Show custom alert popup with action buttons
     */
    showAlertPopup: function(reminder) {
        // Remove any existing popup
        this.closeAlertPopup();

        // Create overlay
        const overlay = Utils.DOM.createElement('div', {
            class: 'reminder-alert-overlay'
        });

        // Create popup
        const popup = Utils.DOM.createElement('div', {
            class: 'reminder-alert-popup'
        });

        const formattedTime = Utils.DateTime.formatDate(new Date(reminder.datetime), 'MMM DD, YYYY at HH:mm');

        popup.innerHTML = `
            <div class="alert-header">
                <div class="alert-icon">🔔</div>
                <h3 class="alert-title">Reminder Alert</h3>
            </div>
            
            <div class="alert-content">
                <div class="alert-reminder-title">${Utils.String.escapeHtml(reminder.title)}</div>
                <div class="alert-reminder-time">Due: ${formattedTime}</div>
                ${reminder.description ? `
                    <div class="alert-reminder-description">${Utils.String.escapeHtml(reminder.description)}</div>
                ` : ''}
            </div>
            
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
        `;

        // Add event listeners
        popup.addEventListener('click', (e) => {
            if (e.target.classList.contains('alert-btn')) {
                const action = e.target.getAttribute('data-action');
                this.handleAlertAction(reminder, action);

                if (action !== 'snooze') {
                    this.closeAlertPopup();
                }
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', () => {
            this.closeAlertPopup();
        });

        // Add to document
        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Auto-dismiss after 30 seconds if no action taken
        setTimeout(() => {
            if (document.body.contains(popup)) {
                this.closeAlertPopup();
            }
        }, 30000);
    },

    /**
     * Show snooze options popup
     */
    showSnoozePopup: function(reminder) {
        const snoozeOptions = [
            { label: '5 minutes', minutes: 5 },
            { label: '15 minutes', minutes: 15 },
            { label: '30 minutes', minutes: 30 },
            { label: '1 hour', minutes: 60 },
            { label: '2 hours', minutes: 120 }
        ];

        const optionsHtml = snoozeOptions.map(option =>
            `<button class="alert-btn alert-btn-snooze" data-minutes="${option.minutes}">${option.label}</button>`
        ).join('');

        const snoozePopup = Utils.DOM.createElement('div', {
            class: 'reminder-alert-popup'
        });

        snoozePopup.innerHTML = `
            <div class="alert-header">
                <div class="alert-icon">⏰</div>
                <h3 class="alert-title">Snooze Reminder</h3>
            </div>
            
            <div class="alert-content">
                <div class="alert-reminder-title">${Utils.String.escapeHtml(reminder.title)}</div>
                <p>How long would you like to snooze this reminder?</p>
            </div>
            
            <div class="alert-actions" style="flex-wrap: wrap;">
                ${optionsHtml}
                <button class="alert-btn alert-btn-dismiss" data-action="cancel">Cancel</button>
            </div>
        `;

        snoozePopup.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-minutes')) {
                const minutes = parseInt(e.target.getAttribute('data-minutes'));
                this.applySnooze(reminder, minutes);
                this.closeAlertPopup();
            } else if (e.target.getAttribute('data-action') === 'cancel') {
                this.showAlertPopup(reminder); // Go back to original popup
            }
        });

        // Replace current popup
        this.closeAlertPopup();
        const overlay = Utils.DOM.createElement('div', { class: 'reminder-alert-overlay' });
        document.body.appendChild(overlay);
        document.body.appendChild(snoozePopup);
    },

    /**
     * Handle alert action (complete, snooze, dismiss)
     */
    handleAlertAction: function(reminder, action) {
        console.log(`Reminder alert action: ${action} for reminder:`, reminder.title);

        switch (action) {
            case 'complete':
                this.triggerEvent('reminder:complete', reminder);
                Utils.UI.showNotification(`Reminder "${reminder.title}" marked as complete!`, 'success');
                break;

            case 'snooze':
                this.showSnoozePopup(reminder);
                break;

            case 'dismiss':
                Utils.UI.showNotification('Reminder dismissed', 'info');
                break;
        }
    },

    /**
     * Apply snooze duration to reminder
     */
    applySnooze: function(reminder, minutes) {
        const newTime = new Date(Date.now() + (minutes * 60 * 1000));

        this.triggerEvent('reminder:snooze', {
            reminder: reminder,
            newDateTime: newTime.toISOString(),
            snoozeMinutes: minutes
        });

        Utils.UI.showNotification(`Reminder snoozed for ${minutes} minutes`, 'success');
    },

    /**
     * Close alert popup
     */
    closeAlertPopup: function() {
        const popup = document.querySelector('.reminder-alert-popup');
        const overlay = document.querySelector('.reminder-alert-overlay');

        if (popup) popup.remove();
        if (overlay) overlay.remove();
    },

    /**
     * Play notification sound
     */
    playNotificationSound: function() {
        try {
            // Create audio context for notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    },

    /**
     * Trigger custom event
     */
    triggerEvent: function(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    },

    /**
     * Test notification system
     */
    test: function(delaySeconds = 5) {
        console.log(`Testing notification system - alert in ${delaySeconds} seconds...`);

        const testReminder = {
            id: 'test-' + Date.now(),
            title: 'Test Notification',
            description: 'This is a test notification to verify the system is working correctly.',
            datetime: new Date(Date.now() + (delaySeconds * 1000)).toISOString(),
            category: REMINDER_CATEGORIES.PERSONAL,
            priority: REMINDER_PRIORITIES.HIGH,
            status: REMINDER_STATUS.ACTIVE,
            notification: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.scheduleNotification(testReminder);
        Utils.UI.showNotification(`Test notification scheduled for ${delaySeconds} seconds!`, 'info');
    },

    /**
     * Test alert popup immediately
     */
    testPopup: function() {
        const testReminder = {
            id: 'test-popup',
            title: 'Test Alert Popup',
            description: 'This is a test of the alert popup system with all available actions.',
            datetime: new Date().toISOString(),
            category: REMINDER_CATEGORIES.WORK,
            priority: REMINDER_PRIORITIES.URGENT,
            status: REMINDER_STATUS.ACTIVE,
            notification: true
        };

        this.showAlertPopup(testReminder);
    },

    /**
     * Get notification status
     */
    getStatus: function() {
        return {
            permissionGranted: this.permissionGranted,
            scheduledCount: this.timers.size,
            browserSupport: 'Notification' in window
        };
    }
};

// Make NotificationManager available globally
if (typeof window !== 'undefined') {
    window.NotificationManager = NotificationManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}