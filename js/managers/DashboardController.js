// ===== DASHBOARD CONTROLLER =====

/**
 * Main dashboard controller that orchestrates all managers and handles
 * the overall dashboard functionality
 */
const DashboardController = {

    // Initialization state
    initialized: false,

    // Periodic update intervals
    intervals: {
        stats: null,
        overdue: null
    },

    /**
     * Initialize dashboard
     */
    init: function() {
        console.log('Initializing Dashboard Controller...');

        // Check authentication
        if (!Auth.isAuthenticated()) {
            console.log('User not authenticated, redirecting to login');
            Utils.Navigation.navigateTo('login.html');
            return;
        }

        try {
            // Initialize all managers in sequence
            this.initializeManagers();

            // Set up periodic tasks
            this.setupPeriodicTasks();

            // Mark as initialized
            this.initialized = true;

            console.log('Dashboard Controller initialized successfully');

            // Trigger ready event
            this.triggerEvent('dashboard:ready');

        } catch (error) {
            console.error('Failed to initialize Dashboard Controller:', error);
            Utils.UI.showNotification('Failed to initialize dashboard. Please refresh the page.', 'error');
        }
    },

    /**
     * Initialize all manager modules
     */
    initializeManagers: function() {
        console.log('Initializing managers...');

        // Initialize DataManager first (provides data)
        if (typeof DataManager !== 'undefined') {
            DataManager.init();
            console.log('✅ DataManager initialized');
        } else {
            throw new Error('DataManager not found');
        }

        // Initialize NotificationManager (handles notifications)
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.init();
            console.log('✅ NotificationManager initialized');
        } else {
            console.warn('⚠️ NotificationManager not found - notifications disabled');
        }

        // Initialize UIManager last (handles display)
        if (typeof UIManager !== 'undefined') {
            UIManager.init();
            console.log('✅ UIManager initialized');
        } else {
            throw new Error('UIManager not found');
        }

        // Schedule notifications for existing reminders
        if (NotificationManager && NotificationManager.rescheduleNotifications) {
            NotificationManager.rescheduleNotifications(DataManager.getReminders());
            console.log('✅ Notifications scheduled');
        }

        // Initial UI update
        UIManager.updateDisplay();
        console.log('✅ Initial UI update completed');
    },

    /**
     * Set up periodic background tasks
     */
    setupPeriodicTasks: function() {
        console.log('Setting up periodic tasks...');

        // Update stats every 5 minutes
        this.intervals.stats = setInterval(() => {
            if (this.initialized) {
                DataManager.calculateStats();
                UIManager.updateStats();
                console.log('📊 Stats updated');
            }
        }, 5 * 60 * 1000);

        // Check for overdue reminders every minute
        this.intervals.overdue = setInterval(() => {
            if (this.initialized) {
                const updatedCount = DataManager.updateOverdueReminders();
                if (updatedCount > 0) {
                    UIManager.updateDisplay();
                    console.log(`⏰ ${updatedCount} reminders marked as overdue`);
                }
            }
        }, 60 * 1000);

        console.log('✅ Periodic tasks configured');
    },

    /**
     * Cleanup resources
     */
    cleanup: function() {
        console.log('Cleaning up Dashboard Controller...');

        // Clear intervals
        if (this.intervals.stats) {
            clearInterval(this.intervals.stats);
            this.intervals.stats = null;
        }

        if (this.intervals.overdue) {
            clearInterval(this.intervals.overdue);
            this.intervals.overdue = null;
        }

        // Clear notifications
        if (NotificationManager && NotificationManager.clearAllNotifications) {
            NotificationManager.clearAllNotifications();
        }

        this.initialized = false;
        console.log('✅ Dashboard Controller cleaned up');
    },

    /**
     * Handle application logout
     */
    handleLogout: function() {
        console.log('Dashboard logout initiated...');

        // Show confirmation
        const confirmed = confirm('Are you sure you want to logout?');
        if (!confirmed) {
            return;
        }

        // Cleanup resources
        this.cleanup();

        // Perform logout through Auth
        Auth.logout()
            .then(() => {
                console.log('Logout successful');
                Utils.UI.showNotification(SUCCESS_MESSAGES.LOGOUT_SUCCESS, 'success', 2000);

                // Redirect after delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            })
            .catch((error) => {
                console.error('Logout error:', error);
                Utils.UI.showNotification('Logout failed. Please try again.', 'error');
            });
    },

    /**
     * Refresh entire dashboard
     */
    refresh: function() {
        console.log('Refreshing dashboard...');

        try {
            // Refresh data
            DataManager.refresh();

            // Update UI
            UIManager.updateDisplay();

            // Reschedule notifications
            if (NotificationManager && NotificationManager.rescheduleNotifications) {
                NotificationManager.rescheduleNotifications(DataManager.getReminders());
            }

            Utils.UI.showNotification('Dashboard refreshed!', 'success', 2000);
            console.log('✅ Dashboard refresh completed');

        } catch (error) {
            console.error('Dashboard refresh error:', error);
            Utils.UI.showNotification('Failed to refresh dashboard', 'error');
        }
    },

    /**
     * Handle reminder creation
     */
    createReminder: function(reminderData) {
        try {
            console.log('Creating reminder:', reminderData.title);

            // Create reminder through DataManager
            const newReminder = DataManager.addReminder(reminderData);

            // Schedule notification if enabled
            if (reminderData.notification && NotificationManager) {
                NotificationManager.scheduleNotification(newReminder);
            }

            // Update UI
            UIManager.updateDisplay();

            Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_CREATED, 'success');
            console.log('✅ Reminder created successfully');

            return newReminder;

        } catch (error) {
            console.error('Create reminder error:', error);
            Utils.UI.showNotification('Failed to create reminder. Please try again.', 'error');
            throw error;
        }
    },

    /**
     * Handle reminder update
     */
    updateReminder: function(id, updateData) {
        try {
            console.log('Updating reminder:', id);

            // Update reminder through DataManager
            const updatedReminder = DataManager.updateReminder(id, updateData);

            // Update notification if needed
            if (NotificationManager) {
                NotificationManager.clearNotification(id);
                if (updateData.notification && updatedReminder.status === REMINDER_STATUS.ACTIVE) {
                    NotificationManager.scheduleNotification(updatedReminder);
                }
            }

            // Update UI
            UIManager.updateDisplay();

            Utils.UI.showNotification('Reminder updated successfully!', 'success');
            console.log('✅ Reminder updated successfully');

            return updatedReminder;

        } catch (error) {
            console.error('Update reminder error:', error);
            Utils.UI.showNotification('Failed to update reminder. Please try again.', 'error');
            throw error;
        }
    },

    /**
     * Handle reminder deletion
     */
    deleteReminder: function(id) {
        try {
            console.log('Deleting reminder:', id);

            // Delete reminder through DataManager
            const deletedReminder = DataManager.deleteReminder(id);

            // Clear notification
            if (NotificationManager) {
                NotificationManager.clearNotification(id);
            }

            // Update UI
            UIManager.updateDisplay();

            Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_DELETED, 'success');
            console.log('✅ Reminder deleted successfully');

            return deletedReminder;

        } catch (error) {
            console.error('Delete reminder error:', error);
            Utils.UI.showNotification('Failed to delete reminder. Please try again.', 'error');
            throw error;
        }
    },

    /**
     * Handle reminder completion
     */
    completeReminder: function(id) {
        try {
            console.log('Completing reminder:', id);

            const reminder = DataManager.getReminderById(id);
            if (!reminder) {
                throw new Error('Reminder not found');
            }

            // Mark as complete through DataManager
            const updatedReminder = DataManager.markReminderComplete(reminder);

            // Clear notification
            if (NotificationManager) {
                NotificationManager.clearNotification(id);
            }

            // Update UI
            UIManager.updateDisplay();

            Utils.UI.showNotification('Reminder marked as completed!', 'success');
            console.log('✅ Reminder completed successfully');

            return updatedReminder;

        } catch (error) {
            console.error('Complete reminder error:', error);
            Utils.UI.showNotification('Failed to complete reminder. Please try again.', 'error');
            throw error;
        }
    },

    /**
     * Handle reminder reactivation
     */
    reactivateReminder: function(id) {
        try {
            console.log('Reactivating reminder:', id);

            // Reactivate through DataManager
            const updatedReminder = DataManager.reactivateReminder(id);

            // Schedule notification if enabled
            if (NotificationManager && updatedReminder.notification) {
                NotificationManager.scheduleNotification(updatedReminder);
            }

            // Update UI
            UIManager.updateDisplay();

            Utils.UI.showNotification('Reminder reactivated!', 'success');
            console.log('✅ Reminder reactivated successfully');

            return updatedReminder;

        } catch (error) {
            console.error('Reactivate reminder error:', error);
            Utils.UI.showNotification('Failed to reactivate reminder. Please try again.', 'error');
            throw error;
        }
    },

    /**
     * Handle reminder snoozing
     */
    snoozeReminder: function(id, newDateTime) {
        try {
            console.log('Snoozing reminder:', id);

            const reminder = DataManager.getReminderById(id);
            if (!reminder) {
                throw new Error('Reminder not found');
            }

            // Snooze through DataManager
            const updatedReminder = DataManager.snoozeReminder(reminder, newDateTime);

            // Reschedule notification
            if (NotificationManager) {
                NotificationManager.clearNotification(id);
                if (updatedReminder.notification) {
                    NotificationManager.scheduleNotification(updatedReminder);
                }
            }

            // Update UI
            UIManager.updateDisplay();

            const minutes = Math.round((new Date(newDateTime) - new Date()) / (1000 * 60));
            Utils.UI.showNotification(`Reminder snoozed for ${minutes} minutes`, 'success');
            console.log('✅ Reminder snoozed successfully');

            return updatedReminder;

        } catch (error) {
            console.error('Snooze reminder error:', error);
            Utils.UI.showNotification('Failed to snooze reminder. Please try again.', 'error');
            throw error;
        }
    },

    /**
     * Export dashboard data
     */
    exportData: function() {
        try {
            console.log('Exporting dashboard data...');
            const success = DataManager.exportData();

            if (success) {
                console.log('✅ Data exported successfully');
            }

            return success;

        } catch (error) {
            console.error('Export data error:', error);
            Utils.UI.showNotification('Failed to export data', 'error');
            return false;
        }
    },

    /**
     * Import dashboard data
     */
    importData: function(file) {
        return DataManager.importData(file)
            .then((data) => {
                console.log('✅ Data imported successfully');

                // Refresh entire dashboard
                this.refresh();

                // Show success message
                setTimeout(() => {
                    Utils.Navigation.reload();
                }, 2000);

                return data;
            })
            .catch((error) => {
                console.error('Import data error:', error);
                Utils.UI.showNotification('Failed to import data. Please check the file format.', 'error');
                throw error;
            });
    },

    /**
     * Get dashboard statistics
     */
    getStatistics: function() {
        try {
            return {
                ui: UIManager ? 'Available' : 'Not Available',
                data: DataManager ? DataManager.debug() : 'Not Available',
                notifications: NotificationManager ? NotificationManager.getStatus() : 'Not Available',
                controller: {
                    initialized: this.initialized,
                    intervals: {
                        stats: this.intervals.stats !== null,
                        overdue: this.intervals.overdue !== null
                    }
                }
            };
        } catch (error) {
            console.error('Get statistics error:', error);
            return { error: error.message };
        }
    },

    /**
     * Test notification system
     */
    testNotificationSystem: function(delaySeconds = 5) {
        if (!NotificationManager) {
            Utils.UI.showNotification('Notification system not available', 'error');
            return;
        }

        console.log(`Testing notification system with ${delaySeconds}s delay...`);
        NotificationManager.test(delaySeconds);
    },

    /**
     * Test alert popup
     */
    testAlertPopup: function() {
        if (!NotificationManager) {
            Utils.UI.showNotification('Notification system not available', 'error');
            return;
        }

        console.log('Testing alert popup...');
        NotificationManager.testPopup();
    },

    /**
     * Trigger custom event
     */
    triggerEvent: function(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
        console.log(`Event triggered: ${eventName}`, data);
    },

    /**
     * Handle errors gracefully
     */
    handleError: function(error, context = 'Dashboard') {
        console.error(`${context} error:`, error);

        const message = error.message || 'An unexpected error occurred';
        Utils.UI.showNotification(`${context}: ${message}`, 'error');

        // Log error for debugging
        this.triggerEvent('dashboard:error', { error, context });
    },

    /**
     * Check if dashboard is ready
     */
    isReady: function() {
        return this.initialized &&
            typeof DataManager !== 'undefined' &&
            typeof UIManager !== 'undefined';
    },

    /**
     * Get current dashboard state
     */
    getState: function() {
        return {
            initialized: this.initialized,
            ready: this.isReady(),
            managers: {
                data: typeof DataManager !== 'undefined',
                ui: typeof UIManager !== 'undefined',
                notifications: typeof NotificationManager !== 'undefined'
            },
            stats: DataManager ? DataManager.getStats() : null,
            reminderCount: DataManager ? DataManager.getReminders().length : 0
        };
    }
};

// Make DashboardController available globally
if (typeof window !== 'undefined') {
    window.DashboardController = DashboardController;

    // Add convenient global functions
    window.testNotification = function(delay = 5) {
        DashboardController.testNotificationSystem(delay);
    };

    window.testAlertPopup = function() {
        DashboardController.testAlertPopup();
    };

    window.getDashboardStats = function() {
        return DashboardController.getStatistics();
    };

    window.refreshDashboard = function() {
        DashboardController.refresh();
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardController;
}