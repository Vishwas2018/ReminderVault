// ===== DASHBOARD MODULE =====

/**
 * Dashboard functionality and data management
 */
let Dashboard = {

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

    // Current state
    currentReminder: null,
    isEditMode: false,

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
        console.log('Caching DOM elements...');

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

        // Log which elements were found/missing
        Object.keys(this.elements).forEach(key => {
            if (this.elements[key]) {
                console.log(`✅ Found element: ${key}`);
            } else {
                console.warn(`❌ Missing element: ${key}`);
            }
        });

        // Special check for logout button
        if (!this.elements.logoutBtn) {
            console.error('CRITICAL: Logout button not found!');
            // Try alternative selectors
            this.elements.logoutBtn = document.querySelector('.logout-btn') ||
                document.querySelector('[data-action="logout"]') ||
                document.querySelector('button[onclick*="logout"]');

            if (this.elements.logoutBtn) {
                console.log('✅ Found logout button with alternative selector');
            }
        }
    },

    /**
     * Set up event listeners
     */
    setupEventListeners: function() {
        console.log('Setting up Dashboard event listeners...');

        // Logout button - with multiple fallbacks
        const logoutBtn = this.elements.logoutBtn;
        if (logoutBtn) {
            console.log('Logout button found, adding event listener');

            // Add the event listener
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Logout button event fired');
                this.handleLogout();
            });
        } else {
            console.error('Logout button not found!');
        }

        // Profile button
        if (this.elements.profileBtn) {
            Utils.DOM.on(this.elements.profileBtn, 'click', () => {
                this.handleProfile();
            });
        }

        // Action buttons
        if (this.elements.addReminderBtn) {
            Utils.DOM.on(this.elements.addReminderBtn, 'click', () => {
                this.handleAddReminder();
            });
        }

        if (this.elements.viewAllBtn) {
            Utils.DOM.on(this.elements.viewAllBtn, 'click', () => {
                this.handleViewAll();
            });
        }

        if (this.elements.settingsBtn) {
            Utils.DOM.on(this.elements.settingsBtn, 'click', () => {
                this.handleSettings();
            });
        }

        if (this.elements.refreshBtn) {
            Utils.DOM.on(this.elements.refreshBtn, 'click', () => {
                this.handleRefresh();
            });
        }

        // Modal close events
        if (this.elements.addReminderModal) {
            const closeBtn = this.elements.addReminderModal.querySelector('.close');
            if (closeBtn) {
                Utils.DOM.on(closeBtn, 'click', () => {
                    this.closeModal('add');
                });
            }

            Utils.DOM.on(this.elements.addReminderModal, 'click', (e) => {
                if (e.target === this.elements.addReminderModal) {
                    this.closeModal('add');
                }
            });

            // Cancel button
            const cancelBtn = Utils.DOM.getElementById('cancelReminderBtn');
            if (cancelBtn) {
                Utils.DOM.on(cancelBtn, 'click', () => {
                    this.closeModal('add');
                });
            }
        }

        // Reminder details modal
        const reminderDetailsModal = Utils.DOM.getElementById('reminderDetailsModal');
        if (reminderDetailsModal) {
            const closeBtn = reminderDetailsModal.querySelector('.close');
            if (closeBtn) {
                Utils.DOM.on(closeBtn, 'click', () => {
                    this.closeModal('details');
                });
            }

            Utils.DOM.on(reminderDetailsModal, 'click', (e) => {
                if (e.target === reminderDetailsModal) {
                    this.closeModal('details');
                }
            });
        }

        // Add reminder form submission
        if (this.elements.addReminderForm) {
            Utils.DOM.on(this.elements.addReminderForm, 'submit', (e) => {
                e.preventDefault();
                this.handleAddReminderSubmit();
            });
        }

        // Quick time buttons
        const timeButtons = document.querySelectorAll('.time-btn');
        timeButtons.forEach(btn => {
            Utils.DOM.on(btn, 'click', () => {
                this.handleQuickTimeClick(btn);
            });
        });

        // Character count for description
        const descriptionTextarea = Utils.DOM.getElementById('reminderDescription');
        if (descriptionTextarea) {
            Utils.DOM.on(descriptionTextarea, 'input', () => {
                this.updateCharacterCount(descriptionTextarea);
            });
        }

        // Real-time validation
        const titleInput = Utils.DOM.getElementById('reminderTitle');
        if (titleInput) {
            Utils.DOM.on(titleInput, 'input', () => {
                this.validateField(titleInput);
            });
        }

        // Reminder details modal buttons
        const editBtn = Utils.DOM.getElementById('editReminderBtn');
        const deleteBtn = Utils.DOM.getElementById('deleteReminderBtn');
        const completeBtn = Utils.DOM.getElementById('completeReminderBtn');

        if (editBtn) {
            Utils.DOM.on(editBtn, 'click', () => this.handleEditReminder());
        }
        if (deleteBtn) {
            Utils.DOM.on(deleteBtn, 'click', () => this.handleDeleteReminder());
        }
        if (completeBtn) {
            Utils.DOM.on(completeBtn, 'click', () => this.handleCompleteReminder());
        }

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
     * Handle logout button click
     */
    handleLogout: function() {
        console.log('Logout button clicked');

        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to logout?');
        if (!confirmed) {
            console.log('Logout cancelled by user');
            return;
        }

        console.log('Proceeding with logout...');

        // Show loading state on logout button
        const logoutBtn = this.elements.logoutBtn;
        if (logoutBtn) {
            const originalText = logoutBtn.textContent;
            logoutBtn.textContent = 'Logging out...';
            logoutBtn.disabled = true;
        }

        // Perform logout
        Auth.logout()
            .then(() => {
                console.log('Logout successful');
                Utils.UI.showNotification(SUCCESS_MESSAGES.LOGOUT_SUCCESS, 'success', 2000);

                // Redirect after short delay
                setTimeout(() => {
                    console.log('Redirecting to login page...');
                    window.location.href = 'login.html';
                }, 1500);
            })
            .catch((error) => {
                console.error('Logout error:', error);
                Utils.UI.showNotification('Logout failed. Please try again.', 'error');

                // Reset button state
                if (logoutBtn) {
                    logoutBtn.textContent = 'Logout';
                    logoutBtn.disabled = false;
                }
            });
    },

    /**
     * Handle add reminder button click
     */
    handleAddReminder: function() {
        console.log('Add reminder button clicked');

        if (!this.elements.addReminderModal) {
            console.error('Add reminder modal not found');
            Utils.UI.showNotification('Modal not found. Please refresh the page.', 'error');
            return;
        }

        if (!this.elements.addReminderForm) {
            console.error('Add reminder form not found');
            Utils.UI.showNotification('Form not found. Please refresh the page.', 'error');
            return;
        }

        Utils.DOM.show(this.elements.addReminderModal);

        // Set default datetime to 1 hour from now
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);

        const datetimeInput = this.elements.addReminderForm.querySelector('#reminderDate');
        if (datetimeInput) {
            datetimeInput.value = Utils.DateTime.formatDate(defaultTime, 'YYYY-MM-DDTHH:mm');
        } else {
            console.warn('Datetime input not found in form');
        }

        // Focus on title input
        const titleInput = this.elements.addReminderForm.querySelector('#reminderTitle');
        if (titleInput) {
            setTimeout(() => titleInput.focus(), 100);
        } else {
            console.warn('Title input not found in form');
        }
    },

    /**
     * Handle profile button click
     */
    handleProfile: function() {
        Utils.UI.showNotification('Profile feature coming soon!', 'info');
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
            this.showReminderDetails(reminder);
        }
    },

    /**
     * Show reminder details modal
     */
    showReminderDetails: function(reminder) {
        const modal = Utils.DOM.getElementById('reminderDetailsModal');
        const content = Utils.DOM.getElementById('reminderDetailsContent');

        if (!modal || !content) return;

        // Store current reminder for actions
        this.currentReminder = reminder;

        // Generate details HTML
        const priorityText = this.getPriorityText(reminder.priority);
        const categoryText = this.getCategoryText(reminder.category);
        const statusText = this.getStatusText(reminder.status);
        const formattedDate = this.getFormattedDateTime(reminder.datetime);

        content.innerHTML = `
            <div class="reminder-details">
                <div class="detail-row">
                    <div class="detail-icon">📝</div>
                    <div class="detail-content">
                        <div class="detail-label">Title</div>
                        <div class="detail-value">${Utils.String.escapeHtml(reminder.title)}</div>
                    </div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-icon">📅</div>
                    <div class="detail-content">
                        <div class="detail-label">Date & Time</div>
                        <div class="detail-value">${formattedDate}</div>
                    </div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-icon">⚡</div>
                    <div class="detail-content">
                        <div class="detail-label">Priority</div>
                        <div class="detail-value">
                            <span class="priority-badge priority-${this.getPriorityClass(reminder.priority)}">
                                ${this.getPriorityIcon(reminder.priority)} ${priorityText}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-icon">🏷️</div>
                    <div class="detail-content">
                        <div class="detail-label">Category</div>
                        <div class="detail-value">
                            <span class="category-badge">
                                ${this.getCategoryIcon(reminder.category)} ${categoryText}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-icon">📊</div>
                    <div class="detail-content">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="status-badge status-${reminder.status}">
                                ${this.getStatusIcon(reminder.status)} ${statusText}
                            </span>
                        </div>
                    </div>
                </div>
                
                ${reminder.description ? `
                <div class="detail-row">
                    <div class="detail-icon">📄</div>
                    <div class="detail-content">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${Utils.String.escapeHtml(reminder.description)}</div>
                    </div>
                </div>
                ` : ''}
                
                <div class="detail-row">
                    <div class="detail-icon">🕒</div>
                    <div class="detail-content">
                        <div class="detail-label">Created</div>
                        <div class="detail-value">${Utils.DateTime.formatDate(reminder.createdAt, 'MMM DD, YYYY at HH:mm')}</div>
                    </div>
                </div>
            </div>
        `;

        // Update modal buttons based on status
        this.updateDetailsModalButtons(reminder);

        // Show modal
        Utils.DOM.show(modal);
    },

    /**
     * Update details modal buttons based on reminder status
     */
    updateDetailsModalButtons: function(reminder) {
        const completeBtn = Utils.DOM.getElementById('completeReminderBtn');
        const editBtn = Utils.DOM.getElementById('editReminderBtn');

        if (reminder.status === REMINDER_STATUS.COMPLETED) {
            completeBtn.textContent = 'Reactivate';
            completeBtn.className = 'btn-secondary';
        } else {
            completeBtn.textContent = 'Mark Complete';
            completeBtn.className = 'btn-primary';
        }

        // Disable edit for completed reminders (optional)
        editBtn.disabled = false; // Allow editing completed reminders
    },

    /**
     * Handle add reminder form submission
     */
    handleAddReminderSubmit: function() {
        console.log('Starting form submission...');

        const form = this.elements.addReminderForm;
        if (!form) {
            console.error('Form not found');
            Utils.UI.showNotification('Form not found. Please refresh the page.', 'error');
            return;
        }

        const submitBtn = Utils.DOM.getElementById('submitReminderBtn');
        if (!submitBtn) {
            console.error('Submit button not found');
            Utils.UI.showNotification('Submit button not found. Please refresh the page.', 'error');
            return;
        }

        // Get form data
        const formData = new FormData(form);
        const reminderData = {
            title: formData.get('reminderTitle')?.trim(),
            datetime: formData.get('reminderDate'),
            priority: parseInt(formData.get('reminderPriority')) || REMINDER_PRIORITIES.MEDIUM,
            category: formData.get('reminderCategory') || REMINDER_CATEGORIES.PERSONAL,
            description: formData.get('reminderDescription')?.trim() || '',
            notification: formData.get('reminderNotification') === 'on'
        };

        console.log('Form data:', reminderData);

        // Validate form
        const validation = this.validateReminderForm(reminderData);
        if (!validation.isValid) {
            console.log('Validation failed:', validation.errors);
            this.showFormErrors(validation.errors);
            return;
        }

        // Show loading state
        console.log('Showing loading state...');
        this.showSubmitLoading(submitBtn, true);

        // Simulate processing delay (remove in real app)
        setTimeout(() => {
            try {
                console.log('Processing reminder...');

                // Create new reminder
                const newReminder = {
                    id: Date.now() + Math.random(), // Better ID generation
                    title: reminderData.title,
                    description: reminderData.description,
                    datetime: new Date(reminderData.datetime).toISOString(),
                    category: reminderData.category,
                    priority: reminderData.priority,
                    status: new Date(reminderData.datetime) <= new Date()
                        ? REMINDER_STATUS.OVERDUE
                        : REMINDER_STATUS.ACTIVE,
                    notification: reminderData.notification,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // If in edit mode, update existing reminder
                if (this.isEditMode && this.currentReminder) {
                    console.log('Updating existing reminder...');
                    const index = this.data.reminders.findIndex(r => r.id === this.currentReminder.id);
                    if (index !== -1) {
                        // Preserve original creation date and ID
                        newReminder.id = this.currentReminder.id;
                        newReminder.createdAt = this.currentReminder.createdAt;

                        // Update the reminder
                        this.data.reminders[index] = newReminder;
                        Utils.UI.showNotification('Reminder updated successfully!', 'success');
                    }
                } else {
                    console.log('Adding new reminder...');
                    // Add new reminder
                    this.data.reminders.push(newReminder);
                    Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_CREATED, 'success');
                }

                // Save and update UI
                this.saveData();
                this.calculateStats();
                this.updateUI();

                // Close modal
                console.log('Closing modal...');
                this.closeModal('add');

                // Reset form
                form.reset();
                this.clearFormErrors();

                // Schedule notification if enabled
                if (reminderData.notification) {
                    this.scheduleNotification(newReminder);
                }

                console.log('Reminder processed successfully');

            } catch (error) {
                console.error('Error creating reminder:', error);
                Utils.UI.showNotification('Failed to create reminder. Please try again.', 'error');
            } finally {
                // Hide loading state
                console.log('Hiding loading state...');
                this.showSubmitLoading(submitBtn, false);
            }
        }, 500);
    },

    /**
     * Show/hide loading state on submit button
     */
    showSubmitLoading: function(submitBtn, isLoading) {
        if (!submitBtn) {
            console.warn('Submit button not provided for loading state');
            return;
        }

        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');

        if (isLoading) {
            submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline';
        } else {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    },

    /**
     * Close modal
     */
    closeModal: function(type = 'add') {
        const modalId = type === 'add' ? 'addReminderModal' : 'reminderDetailsModal';
        const modal = Utils.DOM.getElementById(modalId);

        if (modal) {
            Utils.DOM.hide(modal);

            if (type === 'add') {
                // Reset form and edit mode
                this.isEditMode = false;
                this.currentReminder = null;

                // Reset modal title and button text with null checks
                const modalTitle = modal.querySelector('h2');
                const submitBtn = Utils.DOM.getElementById('submitReminderBtn');

                if (modalTitle) {
                    modalTitle.innerHTML = '✨ Create New Reminder';
                }

                if (submitBtn) {
                    const btnText = submitBtn.querySelector('.btn-text');
                    if (btnText) {
                        btnText.textContent = 'Create Reminder';
                    }
                }

                // Clear form errors
                this.clearFormErrors();

                // Reset form
                const form = this.elements.addReminderForm;
                if (form) {
                    form.reset();
                }

                // Clear active time buttons
                const activeButtons = document.querySelectorAll('.time-btn.active');
                activeButtons.forEach(btn => {
                    Utils.DOM.removeClass(btn, 'active');
                });
            }
        }
    },

    /**
     * Validate reminder form data
     */
    validateReminderForm: function(data) {
        const errors = {};

        // Validate title
        if (!data.title) {
            errors.title = 'Title is required';
        } else if (data.title.length > 100) {
            errors.title = 'Title must be less than 100 characters';
        }

        // Validate datetime
        if (!data.datetime) {
            errors.datetime = 'Date and time are required';
        } else {
            const selectedDate = new Date(data.datetime);
            const now = new Date();

            if (isNaN(selectedDate.getTime())) {
                errors.datetime = 'Invalid date and time';
            }
        }

        // Validate description length
        if (data.description && data.description.length > 500) {
            errors.description = 'Description must be less than 500 characters';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Show form validation errors
     */
    showFormErrors: function(errors) {
        // Clear previous errors
        this.clearFormErrors();

        Object.keys(errors).forEach(field => {
            const fieldElement = Utils.DOM.getElementById(`reminder${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (fieldElement) {
                this.showFieldError(fieldElement, errors[field]);
            }
        });
    },

    /**
     * Clear form validation errors
     */
    clearFormErrors: function() {
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(el => el.remove());

        const errorFields = document.querySelectorAll('.error');
        errorFields.forEach(el => Utils.DOM.removeClass(el, 'error'));
    },

    /**
     * Show field validation error
     */
    showFieldError: function(field, message) {
        if (!field) return;

        Utils.DOM.addClass(field, 'error');

        const errorElement = Utils.DOM.createElement('div', {
            class: 'field-error',
            style: 'color: #c62828; font-size: 0.875rem; margin-top: 0.25rem;'
        }, message);

        field.parentNode.insertBefore(errorElement, field.nextSibling);
    },

    /**
     * Handle quick time button clicks
     */
    handleQuickTimeClick: function(button) {
        const minutes = parseInt(button.getAttribute('data-minutes'));
        const hours = parseInt(button.getAttribute('data-hours'));
        const days = parseInt(button.getAttribute('data-days'));

        const now = new Date();
        let targetTime = new Date(now);

        if (minutes) {
            targetTime.setMinutes(targetTime.getMinutes() + minutes);
        } else if (hours) {
            targetTime.setHours(targetTime.getHours() + hours);
        } else if (days) {
            if (days === 1) {
                // Tomorrow at 9 AM
                targetTime.setDate(targetTime.getDate() + 1);
                targetTime.setHours(9, 0, 0, 0);
            } else {
                targetTime.setDate(targetTime.getDate() + days);
            }
        }

        // Update datetime input
        const datetimeInput = Utils.DOM.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = Utils.DateTime.formatDate(targetTime, 'YYYY-MM-DDTHH:mm');
        }

        // Visual feedback
        document.querySelectorAll('.time-btn').forEach(btn => {
            Utils.DOM.removeClass(btn, 'active');
        });
        Utils.DOM.addClass(button, 'active');

        setTimeout(() => {
            Utils.DOM.removeClass(button, 'active');
        }, 1000);
    },

    /**
     * Update character count for textarea
     */
    updateCharacterCount: function(textarea) {
        const maxLength = parseInt(textarea.getAttribute('maxlength')) || 500;
        const currentLength = textarea.value.length;

        let countElement = textarea.parentNode.querySelector('.char-count');
        if (!countElement) {
            countElement = Utils.DOM.createElement('small', {
                class: 'char-count',
                style: 'display: block; text-align: right; margin-top: 0.25rem; font-size: 0.75rem;'
            });
            textarea.parentNode.appendChild(countElement);
        }

        countElement.textContent = `${currentLength}/${maxLength}`;
        countElement.style.color = currentLength > maxLength * 0.9 ? '#f44336' : '#999';
    },

    /**
     * Validate individual field
     */
    validateField: function(field) {
        const fieldName = field.id.replace('reminder', '').toLowerCase();
        let isValid = true;
        let message = '';

        switch (fieldName) {
            case 'title':
                if (!field.value.trim()) {
                    isValid = false;
                    message = 'Title is required';
                } else if (field.value.length > 100) {
                    isValid = false;
                    message = 'Title must be less than 100 characters';
                }
                break;
        }

        // Clear previous error
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) existingError.remove();
        Utils.DOM.removeClass(field, 'error');

        // Show error if invalid
        if (!isValid) {
            this.showFieldError(field, message);
        }

        return isValid;
    },

    /**
     * Handle edit reminder
     */
    handleEditReminder: function() {
        if (!this.currentReminder) return;

        // Close details modal
        this.closeModal('details');

        // Populate form with current data
        this.populateEditForm(this.currentReminder);

        // Show add modal in edit mode
        this.isEditMode = true;

        if (this.elements.addReminderModal) {
            Utils.DOM.show(this.elements.addReminderModal);

            // Update modal title and button text with null checks
            const modalTitle = this.elements.addReminderModal.querySelector('h2');
            const submitBtn = Utils.DOM.getElementById('submitReminderBtn');

            if (modalTitle) {
                modalTitle.innerHTML = '✏️ Edit Reminder';
            }

            if (submitBtn) {
                const btnText = submitBtn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = 'Update Reminder';
                }
            }
        }
    },

    /**
     * Populate form for editing
     */
    populateEditForm: function(reminder) {
        const form = this.elements.addReminderForm;
        if (!form) return;

        // Populate form fields
        const titleInput = Utils.DOM.getElementById('reminderTitle');
        const dateInput = Utils.DOM.getElementById('reminderDate');
        const prioritySelect = Utils.DOM.getElementById('reminderPriority');
        const categorySelect = Utils.DOM.getElementById('reminderCategory');
        const descriptionTextarea = Utils.DOM.getElementById('reminderDescription');
        const notificationCheckbox = Utils.DOM.getElementById('reminderNotification');

        if (titleInput) titleInput.value = reminder.title;
        if (dateInput) dateInput.value = Utils.DateTime.formatDate(reminder.datetime, 'YYYY-MM-DDTHH:mm');
        if (prioritySelect) prioritySelect.value = reminder.priority;
        if (categorySelect) categorySelect.value = reminder.category;
        if (descriptionTextarea) descriptionTextarea.value = reminder.description || '';
        if (notificationCheckbox) notificationCheckbox.checked = reminder.notification || false;
    },

    /**
     * Handle delete reminder
     */
    handleDeleteReminder: function() {
        if (!this.currentReminder) return;

        const confirmed = confirm(`Are you sure you want to delete "${this.currentReminder.title}"?`);
        if (!confirmed) return;

        // Remove from data array
        const index = this.data.reminders.findIndex(r => r.id === this.currentReminder.id);
        if (index !== -1) {
            this.data.reminders.splice(index, 1);

            // Save and update UI
            this.saveData();
            this.calculateStats();
            this.updateUI();

            // Close modal and show success
            this.closeModal('details');
            Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_DELETED, 'success');

            // Clear current reminder
            this.currentReminder = null;
        }
    },

    /**
     * Handle complete/reactivate reminder
     */
    handleCompleteReminder: function() {
        if (!this.currentReminder) return;

        const isCompleted = this.currentReminder.status === REMINDER_STATUS.COMPLETED;
        const newStatus = isCompleted ? REMINDER_STATUS.ACTIVE : REMINDER_STATUS.COMPLETED;

        // Update reminder status
        const index = this.data.reminders.findIndex(r => r.id === this.currentReminder.id);
        if (index !== -1) {
            this.data.reminders[index].status = newStatus;
            this.data.reminders[index].updatedAt = new Date().toISOString();

            if (newStatus === REMINDER_STATUS.COMPLETED) {
                this.data.reminders[index].completedAt = new Date().toISOString();
            } else {
                delete this.data.reminders[index].completedAt;
            }

            // Save and update UI
            this.saveData();
            this.calculateStats();
            this.updateUI();

            // Update current reminder and modal
            this.currentReminder = this.data.reminders[index];
            this.showReminderDetails(this.currentReminder);

            // Show success message
            const message = isCompleted ? 'Reminder reactivated!' : 'Reminder marked as completed!';
            Utils.UI.showNotification(message, 'success');
        }
    },

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts: function(e) {
        // Only handle shortcuts if no modal is open and not typing in input
        const addModalOpen = this.elements.addReminderModal?.style.display !== 'none';
        const detailsModalOpen = Utils.DOM.getElementById('reminderDetailsModal')?.style.display !== 'none';

        if (addModalOpen || detailsModalOpen ||
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.tagName === 'SELECT') {

            // Handle modal-specific shortcuts
            if (e.key === 'Escape') {
                if (addModalOpen) this.closeModal('add');
                if (detailsModalOpen) this.closeModal('details');
            }
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
                this.closeModal('add');
                this.closeModal('details');
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
    },

    /**
     * Schedule browser notification
     */
    scheduleNotification: function(reminder) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const reminderTime = new Date(reminder.datetime).getTime();
        const now = Date.now();
        const delay = reminderTime - now;

        if (delay > 0 && delay <= 24 * 60 * 60 * 1000) { // Only schedule if within 24 hours
            setTimeout(() => {
                new Notification('Reminder Manager', {
                    body: reminder.title,
                    icon: '/assets/icons/notification-icon.png',
                    tag: `reminder-${reminder.id}`,
                    requireInteraction: true
                });
            }, delay);
        }
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
     * Get helper text functions for display
     */
    getPriorityText: function(priority) {
        const priorityMap = {
            [REMINDER_PRIORITIES.LOW]: 'Low',
            [REMINDER_PRIORITIES.MEDIUM]: 'Medium',
            [REMINDER_PRIORITIES.HIGH]: 'High',
            [REMINDER_PRIORITIES.URGENT]: 'Urgent'
        };
        return priorityMap[priority] || 'Medium';
    },

    getPriorityClass: function(priority) {
        const classMap = {
            [REMINDER_PRIORITIES.LOW]: 'low',
            [REMINDER_PRIORITIES.MEDIUM]: 'medium',
            [REMINDER_PRIORITIES.HIGH]: 'high',
            [REMINDER_PRIORITIES.URGENT]: 'urgent'
        };
        return classMap[priority] || 'medium';
    },

    getCategoryText: function(category) {
        return Utils.String.capitalize(category);
    },

    getCategoryIcon: function(category) {
        const iconMap = {
            'personal': '👤',
            'work': '💼',
            'health': '🏥',
            'finance': '💰',
            'education': '📚',
            'social': '👥',
            'other': '📦'
        };
        return iconMap[category] || '📦';
    },

    getStatusText: function(status) {
        return Utils.String.capitalize(status);
    },

    getStatusIcon: function(status) {
        const iconMap = {
            [REMINDER_STATUS.ACTIVE]: '🟢',
            [REMINDER_STATUS.COMPLETED]: '✅',
            [REMINDER_STATUS.OVERDUE]: '🔴',
            [REMINDER_STATUS.PENDING]: '🟡'
        };
        return iconMap[status] || '🟡';
    },

    getFormattedDateTime: function(datetime) {
        const date = new Date(datetime);
        return Utils.DateTime.formatDate(date, 'MMM DD, YYYY') + ' at ' + Utils.DateTime.formatDate(date, 'HH:mm');
    },

    /**
     * Manual logout function (for testing/debugging)
     */
    forceLogout: function() {
        console.log('Force logout initiated...');

        // Direct logout without confirmation
        Auth.logout()
            .then(() => {
                console.log('Force logout successful');
                alert('Logged out successfully!');
                window.location.href = 'login.html';
            })
            .catch((error) => {
                console.error('Force logout error:', error);
                alert('Logout failed: ' + error.message);
            });
    },

    /**
     * Test logout button functionality
     */
    testLogoutButton: function() {
        console.log('Testing logout button...');

        const logoutBtn = document.getElementById('logoutBtn');
        console.log('Logout button element:', logoutBtn);
        console.log('Button visible:', logoutBtn ? 'Yes' : 'No');
        console.log('Button enabled:', logoutBtn && !logoutBtn.disabled ? 'Yes' : 'No');

        if (logoutBtn) {
            console.log('Button text:', logoutBtn.textContent);
            console.log('Button classes:', logoutBtn.className);
            console.log('Button style:', logoutBtn.style.cssText);

            // Test click programmatically
            console.log('Triggering click event...');
            logoutBtn.click();
        } else {
            console.error('Logout button not found in DOM!');

            // Show all buttons for debugging
            const allButtons = document.querySelectorAll('button');
            console.log('All buttons found:', allButtons.length);
            allButtons.forEach((btn, index) => {
                console.log(`Button ${index}:`, btn.id, btn.className, btn.textContent.trim());
            });
        }
    },

    /**
     * Debug modal elements
     */
    debugModalElements: function() {
        console.group('🔍 Modal Elements Debug');

        // Check modal container
        const modal = document.getElementById('addReminderModal');
        console.log('Modal container:', modal ? '✅ Found' : '❌ Missing');

        if (modal) {
            // Check form
            const form = modal.querySelector('#addReminderForm');
            console.log('Form:', form ? '✅ Found' : '❌ Missing');

            // Check submit button
            const submitBtn = document.getElementById('submitReminderBtn');
            console.log('Submit button:', submitBtn ? '✅ Found' : '❌ Missing');

            if (submitBtn) {
                const btnText = submitBtn.querySelector('.btn-text');
                const btnLoader = submitBtn.querySelector('.btn-loader');
                console.log('Button text element:', btnText ? '✅ Found' : '❌ Missing');
                console.log('Button loader element:', btnLoader ? '✅ Found' : '❌ Missing');
            }

            // Check form inputs
            const inputs = [
                'reminderTitle',
                'reminderDate',
                'reminderPriority',
                'reminderCategory',
                'reminderDescription',
                'reminderNotification'
            ];

            inputs.forEach(inputId => {
                const input = document.getElementById(inputId);
                console.log(`${inputId}:`, input ? '✅ Found' : '❌ Missing');
            });
        }

        console.groupEnd();
    }
};

// Make Dashboard available globally with debugging functions
if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;

    // Add global debugging functions
    window.testLogout = function() {
        if (Dashboard.testLogoutButton) {
            Dashboard.testLogoutButton();
        } else {
            console.error('Dashboard not initialized');
        }
    };

    window.forceLogout = function() {
        if (Dashboard.forceLogout) {
            Dashboard.forceLogout();
        } else {
            console.error('Dashboard not initialized');
        }
    };

    window.debugModal = function() {
        if (Dashboard.debugModalElements) {
            Dashboard.debugModalElements();
        } else {
            console.error('Dashboard not initialized');
        }
    };

    console.log('🔧 Debug functions available:');
    console.log('- testLogout() - Test logout button functionality');
    console.log('- forceLogout() - Force logout without confirmation');
    console.log('- debugModal() - Debug modal elements');
}

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
}