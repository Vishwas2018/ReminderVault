/**
 * Enhanced NotificationService - Advanced notification system with configurable alert timing
 * Supports multiple alert schedules per reminder (5min, 15min, 30min, 1hr, 2hr, 1day, 2days before due)
 */
export class NotificationService {
    #scheduledNotifications = new Map(); // reminderId -> Set of timeoutIds
    #activePopups = new Set();
    #permissionState = 'default';
    #checkInterval = null;
    #audioContext = null;
    #alertHistory = new Map(); // Track sent alerts to avoid duplicates

    // Pre-defined alert timing options (in minutes before due time)
    static ALERT_TIMINGS = {
        FIVE_MINUTES: { value: 5, label: '5 minutes before', icon: '⏰' },
        FIFTEEN_MINUTES: { value: 15, label: '15 minutes before', icon: '⏰' },
        THIRTY_MINUTES: { value: 30, label: '30 minutes before', icon: '⏰' },
        ONE_HOUR: { value: 60, label: '1 hour before', icon: '🕐' },
        TWO_HOURS: { value: 120, label: '2 hours before', icon: '🕐' },
        ONE_DAY: { value: 1440, label: '1 day before', icon: '📅' },
        TWO_DAYS: { value: 2880, label: '2 days before', icon: '📅' }
    };

    constructor() {
        this.#initializeAudioContext();
        this.#addNotificationStyles();
    }

    /**
     * Initialize notification system with permission request
     */
    async initialize() {
        console.log('🔔 Initializing enhanced notification system...');

        await this.#requestPermission();
        this.#startNotificationChecker();
        this.#setupEventListeners();

        console.log('✅ Enhanced notification system ready');
        return this;
    }

    /**
     * Schedule notifications for a reminder with user-selected alert timings
     * @param {Object} reminder - The reminder object
     * @param {Array} alertTimings - Array of timing values in minutes (e.g., [5, 15, 60, 1440])
     */
    scheduleNotification(reminder, alertTimings = [5, 15]) {
        const reminderTime = new Date(reminder.datetime);
        const now = new Date();
        const maxAdvanceTime = 3 * 24 * 60 * 60 * 1000; // 3 days max advance scheduling

        // Clear any existing notifications for this reminder
        this.cancelNotification(reminder.id);

        const timeoutIds = new Set();
        let scheduledCount = 0;

        alertTimings.forEach(minutesBefore => {
            const alertTime = new Date(reminderTime.getTime() - (minutesBefore * 60 * 1000));
            const delay = alertTime.getTime() - now.getTime();

            // Only schedule future notifications within reasonable timeframe
            if (delay > 0 && delay <= maxAdvanceTime) {
                const timeoutId = setTimeout(() => {
                    this.#triggerNotification(reminder, minutesBefore);
                }, delay);

                timeoutIds.add(timeoutId);
                scheduledCount++;

                console.log('⏰ Scheduled alert for "${reminder.title}" ${minutesBefore} minutes before (${this.#formatDelay(delay)})');
            }
        });

        if (scheduledCount > 0) {
            this.#scheduledNotifications.set(reminder.id, timeoutIds);
            console.log('📅 Scheduled ${scheduledCount} alerts for reminder #${reminder.id}');
        }

        return scheduledCount;
    }

    /**
     * Cancel all scheduled notifications for a reminder
     */
    cancelNotification(reminderId) {
        const timeoutIds = this.#scheduledNotifications.get(reminderId);
        if (!timeoutIds) return false;

        let cancelledCount = 0;
        timeoutIds.forEach(timeoutId => {
            clearTimeout(timeoutId);
            cancelledCount++;
        });

        this.#scheduledNotifications.delete(reminderId);
        this.#alertHistory.delete(reminderId);

        console.log('🚫 Cancelled ${cancelledCount} alerts for reminder #${reminderId}');
        return true;
    }

    /**
     * Check for due reminders and trigger immediate notifications
     */
    checkDueReminders(reminders) {
        const now = new Date();

        reminders.forEach(reminder => {
            if (reminder.status !== 'active' || !reminder.notification) return;

            const reminderTime = new Date(reminder.datetime);
            const timeDiff = reminderTime - now;

            // Check each alert timing to see if we should trigger
            Object.values(NotificationService.ALERT_TIMINGS).forEach(timing => {
                const alertThreshold = timing.value * 60 * 1000; // Convert to milliseconds
                const alertKey = '${reminder.id}-${timing.value}';

                // Trigger if within alert window and not already sent
                if (timeDiff <= alertThreshold &&
                    timeDiff > (alertThreshold - 60000) && // 1-minute window
                    !this.#alertHistory.has(alertKey)) {

                    this.#triggerNotification(reminder, timing.value);
                    this.#alertHistory.set(alertKey, now);
                }
            });

            // Special handling for overdue reminders
            if (timeDiff <= 0 && timeDiff > -60000 && !this.#alertHistory.has('${reminder.id}-overdue')) {
                this.#triggerNotification(reminder, 0, true);
                this.#alertHistory.set('${reminder.id}-overdue', now);
            }
        });
    }

    /**
     * Get available alert timing options for UI
     */
    static getAlertTimingOptions() {
        return Object.entries(NotificationService.ALERT_TIMINGS).map(([key, timing]) => ({
            key,
            value: timing.value,
            label: timing.label,
            icon: timing.icon,
            category: timing.value < 60 ? 'minutes' : timing.value < 1440 ? 'hours' : 'days'
        }));
    }

    /**
     * Test notification system with sample alert
     */
    testNotification() {
        const testReminder = {
            id: 9999,
            title: 'Test Notification Alert',
            description: 'This is a test to verify the enhanced notification system is working correctly.',
            datetime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
            priority: 3,
            category: 'personal'
        };

        this.#triggerNotification(testReminder, 5, false);
    }

    /**
     * Get notification statistics
     */
    getNotificationStats() {
        const totalScheduled = Array.from(this.#scheduledNotifications.values())
            .reduce((sum, timeouts) => sum + timeouts.size, 0);

        return {
            totalScheduled,
            activeReminders: this.#scheduledNotifications.size,
            alertHistory: this.#alertHistory.size,
            permissionState: this.#permissionState
        };
    }

    /**
     * Cleanup notification system
     */
    cleanup() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }

        // Clear all scheduled notifications
        this.#scheduledNotifications.forEach((timeoutIds) => {
            timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        });
        this.#scheduledNotifications.clear();

        // Close active popups
        this.#activePopups.forEach(reminderId => {
            this.#closePopup(reminderId);
        });

        this.#alertHistory.clear();
        console.log('🧹 Enhanced notification system cleaned up');
    }

    // === PRIVATE METHODS ===

    async #requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Browser notifications not supported');
            this.#permissionState = 'unsupported';
            return;
        }

        if (Notification.permission === 'default') {
            try {
                this.#permissionState = await Notification.requestPermission();
            } catch (error) {
                console.error('Permission request failed:', error);
                this.#permissionState = 'denied';
            }
        } else {
            this.#permissionState = Notification.permission;
        }

        console.log('🔔 Notification permission: ${this.#permissionState}');
    }

    #initializeAudioContext() {
        try {
            this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    #startNotificationChecker() {
        // Check every 30 seconds for due reminders
        this.#checkInterval = setInterval(() => {
            this.#emitEvent('check-due-reminders');
        }, 30000);
    }

    #setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('📱 Page visible - checking notifications...');
                this.#emitEvent('check-due-reminders');
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    async #triggerNotification(reminder, minutesBefore, isOverdue = false) {
        const alertType = isOverdue ? 'OVERDUE' : this.#getAlertType(minutesBefore);
        const alertKey = '${reminder.id}-${minutesBefore || 'overdue'}';

        console.log('🔔 Triggering ${alertType} notification: ${reminder.title} (${minutesBefore}min before)');

        // Play contextual sound based on alert timing
        await this.#playNotificationSound(alertType);

        // Show browser notification if permitted
        if (this.#permissionState === 'granted') {
            this.#showBrowserNotification(reminder, minutesBefore, isOverdue);
        }

        // Show custom popup with enhanced information
        this.#showEnhancedPopup(reminder, minutesBefore, isOverdue);

        // Emit event for external handling
        this.#emitEvent('notification-triggered', {
            reminder,
            minutesBefore,
            isOverdue,
            alertType
        });
    }

    async #playNotificationSound(alertType) {
        if (!this.#audioContext) return;

        try {
            if (this.#audioContext.state === 'suspended') {
                await this.#audioContext.resume();
            }

            const oscillator = this.#audioContext.createOscillator();
            const gainNode = this.#audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.#audioContext.destination);

            // Different sound patterns for different alert types
            const soundPatterns = {
                OVERDUE: { frequencies: [400, 600, 400], duration: 0.6 },
                URGENT: { frequencies: [800, 1000, 1200], duration: 0.5 },
                NORMAL: { frequencies: [600, 800, 600], duration: 0.4 },
                ADVANCE: { frequencies: [500, 700, 500], duration: 0.3 }
            };

            const pattern = soundPatterns[alertType] || soundPatterns.NORMAL;
            const stepDuration = pattern.duration / pattern.frequencies.length;

            pattern.frequencies.forEach((freq, index) => {
                const time = this.#audioContext.currentTime + (index * stepDuration);
                oscillator.frequency.setValueAtTime(freq, time);
            });

            gainNode.gain.setValueAtTime(0.3, this.#audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.#audioContext.currentTime + pattern.duration);

            oscillator.start();
            oscillator.stop(this.#audioContext.currentTime + pattern.duration);

        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }

    #showBrowserNotification(reminder, minutesBefore, isOverdue) {
        if (this.#permissionState !== 'granted') return;

        const title = isOverdue ?
            '⚠️ Overdue Reminder!' :
            '🔔 Reminder Alert! (${minutesBefore} min)';

        const body = isOverdue ?
            'Overdue: ${reminder.title}' :
            'Coming up in ${minutesBefore} minutes: ${reminder.title}';

        const notification = new Notification(title, {
            body,
            icon: '/favicon.png',
            tag: 'reminder-${reminder.id}-${minutesBefore || 'overdue'}',
            requireInteraction: isOverdue || minutesBefore <= 5,
            data: { reminderId: reminder.id, minutesBefore, isOverdue }
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
            this.#emitEvent('notification-clicked', { reminder, minutesBefore, isOverdue });
        };

        const autoCloseDelay = isOverdue ? 30000 : (minutesBefore <= 15 ? 15000 : 10000);
        setTimeout(() => notification.close(), autoCloseDelay);
    }

    #showEnhancedPopup(reminder, minutesBefore, isOverdue) {
        const popupId = '${reminder.id}-${minutesBefore || 'overdue'}';
        if (this.#activePopups.has(popupId)) return;

        this.#activePopups.add(popupId);

        const overlay = this.#createEnhancedPopupOverlay(reminder, minutesBefore, isOverdue);
        document.body.appendChild(overlay);

        // Auto-dismiss timing based on urgency
        const autoDismissTime = isOverdue ? 60 : (minutesBefore <= 15 ? 45 : 30);
        this.#startCountdown(popupId, autoDismissTime);

        // Setup event handlers
        this.#setupEnhancedPopupHandlers(overlay, reminder, minutesBefore, isOverdue);
    }

    #createEnhancedPopupOverlay(reminder, minutesBefore, isOverdue) {
        const overlay = document.createElement('div');
        overlay.className = 'reminder-alert-overlay enhanced';
        overlay.dataset.popupId = '${reminder.id}-${minutesBefore || 'overdue'}';

        const priorityIcon = this.#getPriorityIcon(reminder.priority);
        const formattedTime = this.#formatTime(reminder.datetime);
        const alertInfo = this.#getAlertInfo(minutesBefore, isOverdue);

        overlay.innerHTML = '
            <div class="reminder-alert-popup enhanced ${isOverdue ? 'overdue' : ''}">
                <div class="alert-header ${isOverdue ? 'overdue' : ''}">
                    <div class="alert-icon ${isOverdue ? 'overdue' : ''}">${alertInfo.icon}</div>
                    <h2 class="alert-title">${alertInfo.title}</h2>
                    <div class="alert-timing">${alertInfo.subtitle}</div>
                </div>

                <div class="alert-content">
                    <div class="alert-reminder-title">
                        ${priorityIcon} ${this.#escapeHtml(reminder.title)}
                    </div>

                    <div class="alert-reminder-time ${isOverdue ? 'overdue' : ''}">
                        ⏰ <strong>${isOverdue ? 'Was due' : 'Due'}:</strong> ${formattedTime}
                    </div>

                    ${reminder.description ? '
                        <div class="alert-reminder-description">
                            📝 ${this.#escapeHtml(reminder.description)}
                        </div>
                    ' : ''}

                    <div class="alert-reminder-meta">
                        <span class="meta-item">
                            📂 Category: <strong>${reminder.category}</strong>
                        </span>
                        <span class="meta-item">
                            ⭐ Priority: <strong>${this.#getPriorityName(reminder.priority)}</strong>
                        </span>
                    </div>

                    <div class="alert-actions enhanced">
                        ${!isOverdue ? '
                            <button class="alert-btn alert-btn-complete" data-action="complete">
                                ✅ Complete Now
                            </button>
                            <button class="alert-btn alert-btn-snooze" data-action="snooze">
                                ⏰ Snooze
                            </button>
                        ' : '
                            <button class="alert-btn alert-btn-complete priority" data-action="complete">
                                ✅ Mark Complete
                            </button>
                            <button class="alert-btn alert-btn-reschedule" data-action="reschedule">
                                📅 Reschedule
                            </button>
                        '}
                        <button class="alert-btn alert-btn-dismiss" data-action="dismiss">
                            ❌ Dismiss
                        </button>
                    </div>

                    <div class="alert-auto-dismiss">
                        Auto-dismiss in <span class="countdown">${isOverdue ? 60 : (minutesBefore <= 15 ? 45 : 30)}</span> seconds
                    </div>
                </div>
            </div>
        ';

        return overlay;
    }

    #setupEnhancedPopupHandlers(overlay, reminder, minutesBefore, isOverdue) {
        // Action button handlers
        overlay.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                e.preventDefault();
                this.#handleEnhancedPopupAction(reminder.id, action, minutesBefore, isOverdue);
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.#closePopup('${reminder.id}-${minutesBefore || 'overdue'}');
            }
        });

        // ESC key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.#closePopup('${reminder.id}-${minutesBefore || 'overdue'}');
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    #handleEnhancedPopupAction(reminderId, action, minutesBefore, isOverdue) {
        const popupId = '${reminderId}-${minutesBefore || 'overdue'}';

        switch (action) {
            case 'complete':
                this.#emitEvent('reminder-complete', { reminderId });
                this.#closePopup(popupId);
                break;
            case 'snooze':
                this.#showEnhancedSnoozeOptions(reminderId, popupId);
                break;
            case 'reschedule':
                this.#showRescheduleOptions(reminderId, popupId);
                break;
            case 'dismiss':
                this.#closePopup(popupId);
                break;
        }
    }

    #showEnhancedSnoozeOptions(reminderId, popupId) {
        const popup = document.querySelector('[data-popup-id="${popupId}"] .alert-content');
        if (!popup) return;

        popup.innerHTML = '
            <div class="snooze-header">
                <div class="snooze-title">⏰ Snooze Reminder</div>
                <div class="snooze-subtitle">How much more time do you need?</div>
            </div>

            <div class="snooze-categories">
                <div class="snooze-category">
                    <h4>Quick Snooze</h4>
                    <div class="snooze-buttons">
                        <button class="snooze-btn quick" data-minutes="5">
                            <span class="snooze-icon">⏰</span>
                            <span class="snooze-time">5 min</span>
                        </button>
                        <button class="snooze-btn quick" data-minutes="15">
                            <span class="snooze-icon">⏰</span>
                            <span class="snooze-time">15 min</span>
                        </button>
                        <button class="snooze-btn quick" data-minutes="30">
                            <span class="snooze-icon">⏰</span>
                            <span class="snooze-time">30 min</span>
                        </button>
                    </div>
                </div>

                <div class="snooze-category">
                    <h4>Extended Snooze</h4>
                    <div class="snooze-buttons">
                        <button class="snooze-btn extended" data-minutes="60">
                            <span class="snooze-icon">🕐</span>
                            <span class="snooze-time">1 hour</span>
                        </button>
                        <button class="snooze-btn extended" data-minutes="120">
                            <span class="snooze-icon">🕐</span>
                            <span class="snooze-time">2 hours</span>
                        </button>
                        <button class="snooze-btn extended" data-minutes="1440">
                            <span class="snooze-icon">📅</span>
                            <span class="snooze-time">Tomorrow</span>
                        </button>
                    </div>
                </div>
            </div>

            <button class="alert-btn alert-btn-dismiss" data-action="cancel" style="width: 100%; margin-top: 1rem;">
                ← Back to Alert
            </button>
        ';

        // Setup enhanced snooze handlers
        popup.addEventListener('click', (e) => {
            const minutes = parseInt(e.target.closest('[data-minutes]')?.dataset.minutes);
            if (minutes) {
                this.#emitEvent('reminder-snooze', { reminderId, minutes });
                this.#closePopup(popupId);
            } else if (e.target.dataset.action === 'cancel') {
                this.#closePopup(popupId);
            }
        });
    }

    #showRescheduleOptions(reminderId, popupId) {
        const popup = document.querySelector('[data-popup-id="${popupId}"] .alert-content');
        if (!popup) return;

        popup.innerHTML = '
            <div class="reschedule-header">
                <div class="reschedule-title">📅 Reschedule Reminder</div>
                <div class="reschedule-subtitle">When would you like to be reminded instead?</div>
            </div>

            <div class="reschedule-options">
                <div class="quick-reschedule">
                    <h4>Quick Options</h4>
                    <div class="reschedule-buttons">
                        <button class="reschedule-btn" data-hours="1">
                            <span class="reschedule-icon">🕐</span>
                            <span class="reschedule-time">In 1 hour</span>
                        </button>
                        <button class="reschedule-btn" data-hours="3">
                            <span class="reschedule-icon">🕐</span>
                            <span class="reschedule-time">In 3 hours</span>
                        </button>
                        <button class="reschedule-btn" data-days="1">
                            <span class="reschedule-icon">📅</span>
                            <span class="reschedule-time">Tomorrow</span>
                        </button>
                        <button class="reschedule-btn" data-days="7">
                            <span class="reschedule-icon">📅</span>
                            <span class="reschedule-time">Next week</span>
                        </button>
                    </div>
                </div>
            </div>

            <button class="alert-btn alert-btn-dismiss" data-action="cancel" style="width: 100%; margin-top: 1rem;">
                ← Back to Alert
            </button>
        ';

        // Setup reschedule handlers
        popup.addEventListener('click', (e) => {
            const hours = parseInt(e.target.closest('[data-hours]')?.dataset.hours);
            const days = parseInt(e.target.closest('[data-days]')?.dataset.days);

            if (hours) {
                const minutes = hours * 60;
                this.#emitEvent('reminder-snooze', { reminderId, minutes });
                this.#closePopup(popupId);
            } else if (days) {
                const minutes = days * 24 * 60;
                this.#emitEvent('reminder-snooze', { reminderId, minutes });
                this.#closePopup(popupId);
            } else if (e.target.dataset.action === 'cancel') {
                this.#closePopup(popupId);
            }
        });
    }

    #startCountdown(popupId, seconds) {
        const countdownElement = document.querySelector('[data-popup-id="${popupId}"] .countdown');
        if (!countdownElement) return;

        let remaining = seconds;
        const timer = setInterval(() => {
            remaining--;
            if (countdownElement) {
                countdownElement.textContent = remaining;

                // Visual warning when time is running out
                if (remaining <= 10) {
                    countdownElement.style.color = '#EF4444';
                    countdownElement.style.fontWeight = 'bold';
                }
            }

            if (remaining <= 0) {
                clearInterval(timer);
                this.#closePopup(popupId);
            }
        }, 1000);

        // Store timer for cleanup
        const overlay = document.querySelector('[data-popup-id="${popupId}"]');
        if (overlay) overlay.dataset.timer = timer;
    }

    #closePopup(popupId) {
        const overlay = document.querySelector('[data-popup-id="${popupId}"]');
        if (!overlay) return;

        // Clear timer
        const timer = overlay.dataset.timer;
        if (timer) clearInterval(parseInt(timer));

        // Remove from active popups
        this.#activePopups.delete(popupId);

        // Animate out and remove
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => overlay.remove(), 300);
    }

    // === UTILITY METHODS ===

    #getAlertType(minutesBefore) {
        if (minutesBefore <= 5) return 'URGENT';
        if (minutesBefore <= 60) return 'NORMAL';
        return 'ADVANCE';
    }

    #getAlertInfo(minutesBefore, isOverdue) {
        if (isOverdue) {
            return {
                title: 'Overdue Reminder!',
                subtitle: 'This reminder is past due',
                icon: '⚠️'
            };
        }

        const timing = Object.values(NotificationService.ALERT_TIMINGS)
            .find(t => t.value === minutesBefore);

        if (timing) {
            return {
                title: 'Reminder Alert!',
                subtitle: timing.label,
                icon: timing.icon
            };
        }

        return {
            title: 'Reminder Alert!',
            subtitle: '${minutesBefore} minutes before due',
            icon: '🔔'
        };
    }

    #getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    }

    #getPriorityName(priority) {
        const names = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' };
        return names[priority] || 'Unknown';
    }

    #formatTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) {
            const pastTime = Math.abs(diffMs);
            if (pastTime < 60000) return 'Just passed';
            if (pastTime < 3600000) return '${Math.round(pastTime / 60000)} minutes ago';
            if (pastTime < 86400000) return '${Math.round(pastTime / 3600000)} hours ago';
            return '${Math.round(pastTime / 86400000)} days ago';
        }

        if (diffMs < 60000) return 'In less than a minute';
        if (diffMs < 3600000) return 'In ${Math.round(diffMs / 60000)} minutes';
        if (diffMs < 86400000) return 'In ${Math.round(diffMs / 3600000)} hours';

        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    #formatDelay(delayMs) {
        const minutes = Math.round(delayMs / 60000);
        if (minutes < 60) return '${minutes}m';
        if (minutes < 1440) return '${Math.round(minutes / 60)}h';
        return '${Math.round(minutes / 1440)}d';
    }

    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    #emitEvent(eventName, data = {}) {
        const event = new CustomEvent('notification:${eventName}', { detail: data });
        document.dispatchEvent(event);
    }

    #addNotificationStyles() {
        if (document.getElementById('enhanced-notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'enhanced-notification-styles';
        styles.textContent = '
            .reminder-alert-overlay.enhanced {
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
            }

            .reminder-alert-popup.enhanced {
                min-width: 450px;
                max-width: 550px;
                border: 3px solid #667eea;
                box-shadow: 0 25px 80px rgba(0,0,0,0.4);
            }

            .reminder-alert-popup.enhanced.overdue {
                border-color: #EF4444;
                animation: urgentPulse 1s ease-in-out infinite;
            }

            .alert-header.overdue {
                background: linear-gradient(135deg, #EF4444, #DC2626);
            }

            .alert-timing {
                font-size: 0.9rem;
                opacity: 0.9;
                margin-top: 0.25rem;
                font-weight: 500;
            }

            .alert-reminder-time.overdue {
                background: rgba(239, 68, 68, 0.15);
                border-left-color: #EF4444;
                color: #DC2626;
                font-weight: 600;
            }

            .alert-reminder-meta {
                display: flex;
                gap: 1rem;
                margin: 1rem 0;
                flex-wrap: wrap;
            }

            .meta-item {
                font-size: 0.85rem;
                color: #666;
                background: #f8f9fa;
                padding: 0.4rem 0.8rem;
                border-radius: 6px;
                border: 1px solid #e9ecef;
            }

            .alert-actions.enhanced {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 0.75rem;
                margin-top: 1.5rem;
            }

            .alert-btn.priority {
                background: linear-gradient(135deg, #059669, #10B981);
                transform: scale(1.05);
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
            }

            .alert-btn-reschedule {
                background: linear-gradient(135deg, #7C3AED, #8B5CF6);
                color: white;
            }

            .snooze-header {
                text-align: center;
                margin-bottom: 1.5rem;
            }

            .snooze-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 0.5rem;
            }

            .snooze-subtitle {
                font-size: 0.9rem;
                color: #666;
            }

            .snooze-categories {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            .snooze-category h4 {
                font-size: 1rem;
                font-weight: 600;
                color: #374151;
                margin-bottom: 0.75rem;
                text-align: center;
            }

            .snooze-buttons {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 0.5rem;
            }

            .snooze-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.25rem;
                padding: 0.75rem 0.5rem;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 0.85rem;
            }

            .snooze-btn:hover {
                border-color: #667eea;
                background: #f8faff;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
            }

            .snooze-btn.quick:hover {
                border-color: #10B981;
                background: #f0fdf4;
            }

            .snooze-btn.extended:hover {
                border-color: #F59E0B;
                background: #fffbeb;
            }

            .snooze-icon {
                font-size: 1.2rem;
            }

            .snooze-time {
                font-weight: 600;
                color: #374151;
            }

            .reschedule-header {
                text-align: center;
                margin-bottom: 1.5rem;
            }

            .reschedule-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 0.5rem;
            }

            .reschedule-subtitle {
                font-size: 0.9rem;
                color: #666;
            }

            .quick-reschedule h4 {
                font-size: 1rem;
                font-weight: 600;
                color: #374151;
                margin-bottom: 0.75rem;
                text-align: center;
            }

            .reschedule-buttons {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }

            .reschedule-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.25rem;
                padding: 0.75rem 0.5rem;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 0.85rem;
            }

            .reschedule-btn:hover {
                border-color: #7C3AED;
                background: #faf5ff;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
            }

            .reschedule-icon {
                font-size: 1.2rem;
            }

            .reschedule-time {
                font-weight: 600;
                color: #374151;
            }

            @keyframes urgentPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 25px 80px rgba(0,0,0,0.4); }
                50% { transform: scale(1.02); box-shadow: 0 30px 100px rgba(239, 68, 68, 0.3); }
            }

            @media (max-width: 768px) {
                .reminder-alert-popup.enhanced {
                    min-width: 90%;
                    margin: 1rem;
                }

                .alert-actions.enhanced {
                    grid-template-columns: 1fr;
                }

                .snooze-buttons {
                    grid-template-columns: 1fr 1fr;
                }

                .alert-reminder-meta {
                    flex-direction: column;
                    gap: 0.5rem;
                }
            }
        ';

        document.head.appendChild(styles);
    }
}