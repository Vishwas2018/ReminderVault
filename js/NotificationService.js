/**
 * NotificationService - Modern notification system with popup alerts
 * Handles browser notifications, sound alerts, and custom popups
 */
export class NotificationService {
    #scheduledNotifications = new Map();
    #activePopups = new Set();
    #permissionState = 'default';
    #checkInterval = null;
    #audioContext = null;

    constructor() {
        this.#initializeAudioContext();
        this.#addNotificationStyles();
    }

    /**
     * Initialize notification system with permission request
     */
    async initialize() {
        console.log('🔔 Initializing notification system...');

        await this.#requestPermission();
        this.#startNotificationChecker();
        this.#setupEventListeners();

        console.log('✅ Notification system ready');
        return this;
    }

    /**
     * Schedule notification for a reminder
     */
    scheduleNotification(reminder) {
        const reminderTime = new Date(reminder.datetime);
        const now = new Date();
        const delay = reminderTime.getTime() - now.getTime();

        // Only schedule future notifications within 24 hours
        if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return null;

        console.log(`⏰ Scheduling notification for "${reminder.title}" in ${Math.round(delay/60000)} minutes`);

        const timeoutId = setTimeout(() => {
            this.#triggerNotification(reminder);
        }, delay);

        this.#scheduledNotifications.set(reminder.id, timeoutId);
        return timeoutId;
    }

    /**
     * Cancel scheduled notification
     */
    cancelNotification(reminderId) {
        const timeoutId = this.#scheduledNotifications.get(reminderId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.#scheduledNotifications.delete(reminderId);
            return true;
        }
        return false;
    }

    /**
     * Check for due reminders and trigger notifications
     */
    checkDueReminders(reminders) {
        const now = new Date();

        const dueReminders = reminders.filter(reminder => {
            if (reminder.status !== 'active' || !reminder.notification) return false;

            const reminderTime = new Date(reminder.datetime);
            const timeDiff = reminderTime - now;

            // Trigger if within 1 minute of due time
            return timeDiff <= 60000 && timeDiff > -60000;
        });

        dueReminders.forEach(reminder => {
            if (!this.#scheduledNotifications.has(reminder.id)) {
                this.#triggerNotification(reminder);
                this.#scheduledNotifications.set(reminder.id, Date.now());
            }
        });
    }

    /**
     * Test notification system
     */
    testNotification() {
        const testReminder = {
            id: 9999,
            title: 'Test Notification',
            description: 'This is a test to verify notifications are working correctly.',
            datetime: new Date().toISOString(),
            priority: 3,
            category: 'personal'
        };

        this.#triggerNotification(testReminder);
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
        this.#scheduledNotifications.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.#scheduledNotifications.clear();

        // Close active popups
        this.#activePopups.forEach(reminderId => {
            this.#closePopup(reminderId);
        });

        console.log('🧹 Notification system cleaned up');
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

        console.log(`🔔 Notification permission: ${this.#permissionState}`);
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

    async #triggerNotification(reminder) {
        console.log(`🔔 Triggering notification: ${reminder.title}`);

        // Play sound
        await this.#playNotificationSound();

        // Show browser notification if permitted
        if (this.#permissionState === 'granted') {
            this.#showBrowserNotification(reminder);
        }

        // Show custom popup
        this.#showCustomPopup(reminder);

        // Emit event for external handling
        this.#emitEvent('notification-triggered', reminder);
    }

    async #playNotificationSound() {
        if (!this.#audioContext) return;

        try {
            // Resume audio context if suspended
            if (this.#audioContext.state === 'suspended') {
                await this.#audioContext.resume();
            }

            const oscillator = this.#audioContext.createOscillator();
            const gainNode = this.#audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.#audioContext.destination);

            // Pleasant notification chime
            oscillator.frequency.setValueAtTime(800, this.#audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, this.#audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(600, this.#audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, this.#audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.#audioContext.currentTime + 0.4);

            oscillator.start();
            oscillator.stop(this.#audioContext.currentTime + 0.4);

        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }

    #showBrowserNotification(reminder) {
        if (this.#permissionState !== 'granted') return;

        const notification = new Notification('Reminder Alert! 🔔', {
            body: reminder.title,
            icon: '/favicon.png',
            tag: `reminder-${reminder.id}`,
            requireInteraction: true,
            data: { reminderId: reminder.id }
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
            this.#emitEvent('notification-clicked', reminder);
        };

        setTimeout(() => notification.close(), 10000);
    }

    #showCustomPopup(reminder) {
        if (this.#activePopups.has(reminder.id)) return;

        this.#activePopups.add(reminder.id);

        const overlay = this.#createPopupOverlay(reminder);
        document.body.appendChild(overlay);

        // Auto-dismiss after 30 seconds
        this.#startCountdown(reminder.id, 30);

        // Setup event handlers
        this.#setupPopupHandlers(overlay, reminder);
    }

    #createPopupOverlay(reminder) {
        const overlay = document.createElement('div');
        overlay.className = 'reminder-alert-overlay';
        overlay.dataset.reminderId = reminder.id;

        const priorityIcon = this.#getPriorityIcon(reminder.priority);
        const formattedTime = this.#formatTime(reminder.datetime);

        overlay.innerHTML = `
      <div class="reminder-alert-popup">
        <div class="alert-header">
          <div class="alert-icon">🔔</div>
          <h2 class="alert-title">Reminder Alert!</h2>
        </div>
        
        <div class="alert-content">
          <div class="alert-reminder-title">
            ${priorityIcon} ${this.#escapeHtml(reminder.title)}
          </div>
          
          <div class="alert-reminder-time">
            ⏰ <strong>Due:</strong> ${formattedTime}
          </div>
          
          ${reminder.description ? `
            <div class="alert-reminder-description">
              📝 ${this.#escapeHtml(reminder.description)}
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
            Auto-dismiss in <span class="countdown">${30}</span> seconds
          </div>
        </div>
      </div>
    `;

        return overlay;
    }

    #setupPopupHandlers(overlay, reminder) {
        // Action button handlers
        overlay.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                e.preventDefault();
                this.#handlePopupAction(reminder.id, action);
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.#closePopup(reminder.id);
            }
        });

        // ESC key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.#closePopup(reminder.id);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    #handlePopupAction(reminderId, action) {
        switch (action) {
            case 'complete':
                this.#emitEvent('reminder-complete', { reminderId });
                this.#closePopup(reminderId);
                break;
            case 'snooze':
                this.#showSnoozeOptions(reminderId);
                break;
            case 'dismiss':
                this.#closePopup(reminderId);
                break;
        }
    }

    #showSnoozeOptions(reminderId) {
        const popup = document.querySelector(`[data-reminder-id="${reminderId}"] .alert-content`);
        if (!popup) return;

        popup.innerHTML = `
      <div class="snooze-title">⏰ Snooze for how long?</div>
      <div class="snooze-buttons">
        <button class="snooze-btn" data-minutes="5">5 minutes</button>
        <button class="snooze-btn" data-minutes="15">15 minutes</button>
        <button class="snooze-btn" data-minutes="30">30 minutes</button>
        <button class="snooze-btn" data-minutes="60">1 hour</button>
        <button class="snooze-btn" data-minutes="120">2 hours</button>
        <button class="snooze-btn" data-minutes="1440">Tomorrow</button>
      </div>
      <button class="alert-btn alert-btn-dismiss" data-action="cancel" style="width: 100%; margin-top: 1rem;">
        Cancel
      </button>
    `;

        // Setup snooze handlers
        popup.addEventListener('click', (e) => {
            const minutes = parseInt(e.target.dataset.minutes);
            if (minutes) {
                this.#emitEvent('reminder-snooze', { reminderId, minutes });
                this.#closePopup(reminderId);
            } else if (e.target.dataset.action === 'cancel') {
                this.#closePopup(reminderId);
            }
        });
    }

    #startCountdown(reminderId, seconds) {
        const countdownElement = document.querySelector(`[data-reminder-id="${reminderId}"] .countdown`);
        if (!countdownElement) return;

        let remaining = seconds;
        const timer = setInterval(() => {
            remaining--;
            if (countdownElement) {
                countdownElement.textContent = remaining;
            }

            if (remaining <= 0) {
                clearInterval(timer);
                this.#closePopup(reminderId);
            }
        }, 1000);

        // Store timer for cleanup
        const overlay = document.querySelector(`[data-reminder-id="${reminderId}"]`);
        if (overlay) overlay.dataset.timer = timer;
    }

    #closePopup(reminderId) {
        const overlay = document.querySelector(`[data-reminder-id="${reminderId}"]`);
        if (!overlay) return;

        // Clear timer
        const timer = overlay.dataset.timer;
        if (timer) clearInterval(parseInt(timer));

        // Remove from active popups
        this.#activePopups.delete(reminderId);

        // Animate out and remove
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => overlay.remove(), 300);
    }

    #getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    }

    #formatTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) return 'Now';
        if (diffMs < 60000) return 'In less than a minute';
        if (diffMs < 3600000) return `In ${Math.round(diffMs / 60000)} minutes`;
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    #emitEvent(eventName, data = {}) {
        const event = new CustomEvent(`notification:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }

    #addNotificationStyles() {
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
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      }

      .reminder-alert-popup {
        background: white;
        border-radius: 16px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: popupSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        border: 3px solid #667eea;
      }

      .alert-header {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 1.5rem;
        text-align: center;
      }

      .alert-icon {
        font-size: 3rem;
        margin-bottom: 0.5rem;
        animation: alertPulse 2s ease-in-out infinite;
      }

      .alert-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
      }

      .alert-content {
        padding: 1.5rem;
      }

      .alert-reminder-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .alert-reminder-time {
        font-size: 1rem;
        color: #e74c3c;
        font-weight: 500;
        margin-bottom: 1rem;
        padding: 0.5rem;
        background: rgba(231, 76, 60, 0.1);
        border-radius: 8px;
        border-left: 4px solid #e74c3c;
      }

      .alert-reminder-description {
        font-size: 0.95rem;
        color: #555;
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border-left: 4px solid #667eea;
      }

      .alert-actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .alert-btn {
        padding: 0.75rem 1rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .alert-btn-complete {
        background: linear-gradient(135deg, #27ae60, #2ecc71);
        color: white;
      }

      .alert-btn-snooze {
        background: linear-gradient(135deg, #f39c12, #e67e22);
        color: white;
      }

      .alert-btn-dismiss {
        background: #ecf0f1;
        color: #2c3e50;
        border: 2px solid #bdc3c7;
      }

      .alert-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      .alert-auto-dismiss {
        text-align: center;
        margin-top: 1rem;
        font-size: 0.8rem;
        color: #7f8c8d;
      }

      .countdown {
        font-weight: bold;
        color: #e74c3c;
      }

      .snooze-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 1rem;
        text-align: center;
      }

      .snooze-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .snooze-btn {
        padding: 0.5rem;
        background: #f8f9fa;
        border: 2px solid #dee2e6;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
        text-align: center;
      }

      .snooze-btn:hover {
        background: #e9ecef;
        border-color: #667eea;
        color: #667eea;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      @keyframes popupSlideIn {
        from { transform: scale(0.8) translateY(-20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }

      @keyframes alertPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      @media (max-width: 768px) {
        .reminder-alert-popup {
          min-width: 90%;
          margin: 1rem;
        }
        
        .alert-actions {
          grid-template-columns: 1fr;
        }
        
        .snooze-buttons {
          grid-template-columns: 1fr;
        }
      }
    `;

        document.head.appendChild(styles);
    }
}