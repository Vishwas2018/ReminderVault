// ===== DASHBOARD MODULE =====

/**
 * Dashboard functionality and data management
 */
const Dashboard = {

    // Dashboard data
    data: {
        reminders: [],
        schedule: [],
        stats: {
            total: 0,
            active: 0,
            completed: 0,
            overdue: 0
        }
    },

    // UI elements
    elements: {},

    /**
     * Initialize dashboard
     */
    init: function() {
        console.log('Initializing Dashboard...');

        // Check authentication
        if (!Auth.isAuthenticated()) {
            Utils.Navigation.navigateTo('login.html');
            return;
        }

        // Cache DOM elements
        this.cacheElements();

        // Set up event listeners
        this.setupEventListeners();

        // Load initial data
        this.loadData();

        // Update UI
        this.updateUI();

        // Set up periodic refresh
        this.setupPeriodicRefresh();

        console.log('Dashboard initialized successfully');
    },

    /**
     * Cache frequently used DOM elements
     */
    cacheElements: function() {
        this.elements = {
            // Header elements
            welcomeMessage: Utils.DOM.getElementById('welcomeMessage'),
            currentDate: Utils.DOM.getElementById('currentDate'),
            logoutBtn: Utils.DOM.getElementById('logoutBtn'),
            profileBtn: Utils.DOM.getElementById('profileBtn'),

            // Stats elements
            totalReminders: Utils.DOM.getElementById('totalReminders'),
            activeReminders: Utils.DOM.getElementById('activeReminders'),
            completedToday: Utils.DOM.getElementById('completedToday'),
            overdue: Utils.DOM.getElementById('overdue'),

            // Action buttons
            addReminderBtn: Utils.DOM.getElementById('addReminderBtn'),
            viewAllBtn: Utils.DOM.getElementById('viewAllBtn'),
            settingsBtn: Utils.DOM.getElementById('settingsBtn'),
            refreshBtn: Utils.DOM.getElementById('refreshBtn'),

            // Content areas
            recentReminders: Utils.DOM.getElementById('recentReminders'),
            todaySchedule: Utils.DOM.getElementById('todaySchedule'),

            // Modal
            addReminderModal: Utils.DOM.getElementById('addReminderModal'),
            addReminderForm: Utils.DOM.getElementById('addReminderForm')
        };
    },

    /**
     * Set up event listeners
     */
    setupEventListeners: function() {
        // Logout button
        Utils.DOM.on(this.elements.logoutBtn, 'click', () => {
            this.handleLogout();
        });

        // Profile button
        Utils.DOM.on(this.elements.profileBtn, 'click', () => {
            this.handleProfile();
        });

        // Action buttons
        Utils.DOM.on(this.elements.addReminderBtn, 'click', () => {
            this.handleAddReminder();
        });

        Utils.DOM.on(this.elements.viewAllBtn, 'click', () => {
            this.handleViewAll();
        });

        Utils.DOM.on(this.elements.settingsBtn, 'click', () => {
            this.handleSettings();
        });

        Utils.DOM.on(this.elements.refreshBtn, 'click', () => {
            this.handleRefresh();
        });

        // Modal close events
        if (this.elements.addReminderModal) {
            const closeBtn = this.elements.addReminderModal.querySelector('.close');
            Utils.DOM.on(closeBtn, 'click', () => {
                this.closeModal();
            });

            Utils.DOM.on(this.elements.addReminderModal, 'click', (e) => {
                if (e.target === this.elements.addReminderModal) {
                    this.closeModal();
                }
            });
        }

        // Add reminder form submission
        Utils.DOM.on(this.elements.addReminderForm, 'submit', (e) => {
            e.preventDefault();
            this.handleAddReminderSubmit();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    },

    /**
     * Load dashboard data
     */
    loadData: function() {
        // Load reminders from storage or use sample data
        const storedReminders = Utils.Storage.get(APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA);
        this.data.reminders = storedReminders || SAMPLE_DATA.REMINDERS;

        // Load schedule data
        this.data.schedule = SAMPLE_DATA.SCHEDULE;

        // Calculate stats
        this.calculateStats();

        // Save data if not already stored
        if (!storedReminders) {
            this.saveData();
        }
    },

    /**
     * Save data to storage
     */
    saveData: function() {
        Utils.Storage.set(APP_CONFIG.STORAGE_KEYS.REMINDERS_DATA, this.data.reminders);
    },

    /**
     * Calculate dashboard statistics
     */
    calculateStats: function() {
        const reminders = this.data.reminders;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.data.stats = {
            total: reminders.length,
            active: reminders.filter(r => r.status === REMINDER_STATUS.ACTIVE).length,
            completed: reminders.filter(r => {
                return r.status === REMINDER_STATUS.COMPLETED &&
                    Utils.DateTime.isToday(r.updatedAt);
            }).length,
            overdue: reminders.filter(r => r.status === REMINDER_STATUS.OVERDUE).length
        };
    },

    /**
     * Update UI with current data
     */
    updateUI: function() {
        this.updateHeader();
        this.updateStats();
        this.updateRecentReminders();
        this.updateTodaySchedule();
    },

    /**
     * Update header information
     */
    updateHeader: function() {
        const currentUser = Auth.getCurrentUser();

        if (this.elements.welcomeMessage && currentUser) {
            const firstName = currentUser.profile?.firstName || Utils.String.capitalize(currentUser.username);
            this.elements.welcomeMessage.textContent = `Welcome back, ${firstName}!`;
        }

        if (this.elements.currentDate) {
            const now = new Date();
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            this.elements.currentDate.textContent = now.toLocaleDateString('en-US', options);
        }
    },

    /**
     * Update statistics display
     */
    updateStats: function() {
        const stats = this.data.stats;

        if (this.elements.totalReminders) {
            this.elements.totalReminders.textContent = stats.total;
        }

        if (this.elements.activeReminders) {
            this.elements.activeReminders.textContent = stats.active;
        }

        if (this.elements.completedToday) {
            this.elements.completedToday.textContent = stats.completed;
        }

        if (this.elements.overdue) {
            this.elements.overdue.textContent = stats.overdue;
        }
    },

    /**
     * Update recent reminders section
     */
    updateRecentReminders: function() {
        if (!this.elements.recentReminders) return;

        const recentReminders = this.data.reminders
            .filter(r => r.status !== REMINDER_STATUS.COMPLETED)
            .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
            .slice(0, 5);

        if (recentReminders.length === 0) {
            this.elements.recentReminders.innerHTML = this.getEmptyState(
                '📝',
                'No reminders found',
                'Create your first reminder to get started!'
            );
            return;
        }

        const html = recentReminders.map(reminder => {
            const statusClass = this.getStatusClass(reminder.status);
            const timeText = this.getTimeText(reminder.datetime);
            const priorityIcon = this.getPriorityIcon(reminder.priority);

            return `
                <div class="reminder-item" data-id="${reminder.id}">
                    <div class="reminder-status ${statusClass}"></div>
                    <div class="reminder-content">
                        <div class="reminder-title">
                            ${priorityIcon} ${Utils.String.escapeHtml(reminder.title)}
                        </div>
                        <div class="reminder-time">${timeText}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.recentReminders.innerHTML = html;

        // Add click handlers for reminder items
        this.elements.recentReminders.querySelectorAll('.reminder-item').forEach(item => {
            Utils.DOM.on(item, 'click', () => {
                const reminderId = parseInt(item.getAttribute('data-id'));
                this.handleReminderClick(reminderId);
            });
        });
    },

    /**
     * Update today's schedule section
     */
    updateTodaySchedule: function() {
        if (!this.elements.todaySchedule) return;

        const schedule = this.data.schedule;

        if (schedule.length === 0) {
            this.elements.todaySchedule.innerHTML = this.getEmptyState(
                '📅',
                'No schedule for today',
                'Your day is free!'
            );
            return;
        }

        const html = schedule.map(item => `
            <div class="schedule-item">
                <div class="schedule-time">${item.time}</div>
                <div class="schedule-content">
                    <div class="schedule-title">${Utils.String.escapeHtml(item.title)}</div>
                    <div class="schedule-description">${Utils.String.escapeHtml(item.description)}</div>
                </div>
            </div>
        `).join('');

        this.elements.todaySchedule.innerHTML = html;
    },

    /**
     * Get empty state HTML
     */
    getEmptyState: function(icon, title, description) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <h3>${title}</h3>
                <p>${description}</p>
            </div>
        `;
    },

    /**
     * Get status CSS class for reminder
     */
    getStatusClass: function(status) {
        const statusMap = {
            [REMINDER_STATUS.ACTIVE]: 'active',
            [REMINDER_STATUS.COMPLETED]: 'completed',
            [REMINDER_STATUS.OVERDUE]: 'overdue',
            [REMINDER_STATUS.PENDING]: 'pending'
        };
        return statusMap[status] || 'active';
    },

    /**
     * Get time text for reminder
     */
    getTimeText: function(datetime) {
        const date = new Date(datetime);
        const now = new Date();

        if (Utils.DateTime.isToday(date)) {
            return `Today at ${Utils.DateTime.formatDate(date, 'HH:mm')}`;
        } else if (date < now) {
            return `Overdue - ${Utils.DateTime.getRelativeTime(date)}`;
        } else {
            const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                return `Tomorrow at ${Utils.DateTime.formatDate(date, 'HH:mm')}`;
            } else if (diffDays <= 7) {
                return `In ${diffDays} days`;
            } else {
                return Utils.DateTime.formatDate(date, 'MMM DD, YYYY');
            }
        }
    },

    /**
     * Get priority icon
     */
    getPriorityIcon: function(priority) {
        const priorityIcons = {
            [REMINDER_PRIORITIES.LOW]: '🔵',
            [REMINDER_PRIORITIES.MEDIUM]: '🟡',
            [REMINDER_PRIORITIES.HIGH]: '🟠',
            [REMINDER_PRIORITIES.URGENT]: '🔴'
        };
        return priorityIcons[priority] || '⚪';
    },

    /**
     * Handle logout button click
     */
    handleLogout: function() {
        if (confirm('Are you sure you want to logout?')) {
            Auth.logout().then(() => {
                Utils.UI.showNotification(SUCCESS_MESSAGES.LOGOUT_SUCCESS, 'success');
                setTimeout(() => {
                    Utils.Navigation.navigateTo('login.html');
                }, 1000);
            });
        }
    },

    /**
     * Handle profile button click
     */
    handleProfile: function() {
        Utils.UI.showNotification('Profile feature coming soon!', 'info');
    },

    /**
     * Handle add reminder button click
     */
    handleAddReminder: function() {
        if (this.elements.addReminderModal) {
            Utils.DOM.show(this.elements.addReminderModal);

            // Set default datetime to 1 hour from now
            const defaultTime = new Date();
            defaultTime.setHours(defaultTime.getHours() + 1);

            const datetimeInput = this.elements.addReminderForm.querySelector('#reminderDate');
            if (datetimeInput) {
                datetimeInput.value = Utils.DateTime.formatDate(defaultTime, 'YYYY-MM-DDTHH:mm');
            }

            // Focus on title input
            const titleInput = this.elements.addReminderForm.querySelector('#reminderTitle');
            if (titleInput) {
                setTimeout(() => titleInput.focus(), 100);
            }
        }
    },

    /**
     * Handle view all button click
     */
    handleViewAll: function() {
        Utils.UI.showNotification('View all reminders feature coming soon!', 'info');
    },

    /**
     * Handle settings button click
     */
    handleSettings: function() {
        Utils.UI.showNotification('Settings feature coming soon!', 'info');
    },

    /**
     * Handle refresh button click
     */
    handleRefresh: function() {
        Utils.UI.showLoading(this.elements.refreshBtn, '🔄');

        // Simulate loading delay
        setTimeout(() => {
            this.loadData();
            this.updateUI();
            Utils.UI.hideLoading(this.elements.refreshBtn);
            Utils.UI.showNotification('Dashboard refreshed!', 'success', 2000);
        }, 1000);
    },

    /**
     * Handle reminder item click
     */
    handleReminderClick: function(reminderId) {
        const reminder = this.data.reminders.find(r => r.id === reminderId);
        if (reminder) {
            const action = confirm(`Mark "${reminder.title}" as completed?`);
            if (action) {
                this.markReminderCompleted(reminderId);
            }
        }
    },

    /**
     * Mark reminder as completed
     */
    markReminderCompleted: function(reminderId) {
        const reminderIndex = this.data.reminders.findIndex(r => r.id === reminderId);
        if (reminderIndex !== -1) {
            this.data.reminders[reminderIndex].status = REMINDER_STATUS.COMPLETED;
            this.data.reminders[reminderIndex].updatedAt = new Date().toISOString();

            this.saveData();
            this.calculateStats();
            this.updateUI();

            Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_UPDATED, 'success');
        }
    },

    /**
     * Handle add reminder form submission
     */
    handleAddReminderSubmit: function() {
        const form = this.elements.addReminderForm;
        const formData = new FormData(form);

        const title = formData.get('reminderTitle')?.trim();
        const datetime = formData.get('reminderDate');
        const description = formData.get('reminderDescription')?.trim() || '';

        // Validate inputs
        if (!title) {
            Utils.UI.showNotification('Please enter a reminder title', 'error');
            return;
        }

        if (!datetime) {
            Utils.UI.showNotification('Please select a date and time', 'error');
            return;
        }

        // Create new reminder
        const newReminder = {
            id: Date.now(), // Simple ID generation
            title: title,
            description: description,
            datetime: new Date(datetime).toISOString(),
            category: REMINDER_CATEGORIES.PERSONAL,
            priority: REMINDER_PRIORITIES.MEDIUM,
            status: REMINDER_STATUS.ACTIVE,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add to data
        this.data.reminders.push(newReminder);

        // Save and update UI
        this.saveData();
        this.calculateStats();
        this.updateUI();

        // Close modal and show success
        this.closeModal();
        Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_CREATED, 'success');

        // Reset form
        form.reset();
    },

    /**
     * Close modal
     */
    closeModal: function() {
        if (this.elements.addReminderModal) {
            Utils.DOM.hide(this.elements.addReminderModal);
        }
    },

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts: function(e) {
        // Only handle shortcuts if no modal is open and not typing in input
        if (this.elements.addReminderModal.style.display !== 'none' ||
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch(e.key) {
            case 'n':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.handleAddReminder();
                }
                break;
            case 'r':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.handleRefresh();
                }
                break;
            case 'Escape':
                this.closeModal();
                break;
        }
    },

    /**
     * Set up periodic refresh
     */
    setupPeriodicRefresh: function() {
        // Refresh stats every 5 minutes
        setInterval(() => {
            this.calculateStats();
            this.updateStats();
        }, 5 * 60 * 1000);

        // Update overdue reminders every minute
        setInterval(() => {
            this.updateOverdueStatus();
        }, 60 * 1000);
    },

    /**
     * Update overdue status for reminders
     */
    updateOverdueStatus: function() {
        let updated = false;
        const now = new Date();

        this.data.reminders.forEach(reminder => {
            if (reminder.status === REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) < now) {
                reminder.status = REMINDER_STATUS.OVERDUE;
                updated = true;
            }
        });

        if (updated) {
            this.saveData();
            this.calculateStats();
            this.updateUI();
        }
    }
};

// Make Dashboard available globally
if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;
}

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
}