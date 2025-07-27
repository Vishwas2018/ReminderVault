// ===== UI MANAGER =====

/**
 * Manages all UI updates, rendering, and user interactions
 */
const UIManager = {

    // UI element cache
    elements: {},

    // Current state
    currentReminder: null,
    isEditMode: false,

    /**
     * Initialize UI manager
     */
    init: function() {
        console.log('Initializing UIManager...');

        this.cacheElements();
        this.setupEventListeners();
        this.updateHeader();

        console.log('UIManager initialized');
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

            // Modal elements
            addReminderModal: Utils.DOM.getElementById('addReminderModal'),
            addReminderForm: Utils.DOM.getElementById('addReminderForm'),
            reminderDetailsModal: Utils.DOM.getElementById('reminderDetailsModal')
        };

        // Log which elements were found/missing
        Object.keys(this.elements).forEach(key => {
            if (this.elements[key]) {
                console.log(`✅ Found element: ${key}`);
            } else {
                console.warn(`❌ Missing element: ${key}`);
            }
        });
    },

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners: function() {
        console.log('Setting up UI event listeners...');

        // Button event listeners
        this.setupButtonListeners();

        // Modal event listeners
        this.setupModalListeners();

        // Form event listeners
        this.setupFormListeners();

        // Data event listeners
        this.setupDataListeners();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    },

    /**
     * Set up button event listeners
     */
    setupButtonListeners: function() {
        // Logout button
        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
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
                this.showAddReminderModal();
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
    },

    /**
     * Set up modal event listeners
     */
    setupModalListeners: function() {
        // Add reminder modal
        if (this.elements.addReminderModal) {
            const closeBtn = this.elements.addReminderModal.querySelector('.close');
            if (closeBtn) {
                Utils.DOM.on(closeBtn, 'click', () => {
                    this.closeModal('add');
                });
            }

            // Click outside modal to close
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
        if (this.elements.reminderDetailsModal) {
            const closeBtn = this.elements.reminderDetailsModal.querySelector('.close');
            if (closeBtn) {
                Utils.DOM.on(closeBtn, 'click', () => {
                    this.closeModal('details');
                });
            }

            Utils.DOM.on(this.elements.reminderDetailsModal, 'click', (e) => {
                if (e.target === this.elements.reminderDetailsModal) {
                    this.closeModal('details');
                }
            });

            // Modal action buttons
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
        }
    },

    /**
     * Set up form event listeners
     */
    setupFormListeners: function() {
        // Add reminder form submission
        if (this.elements.addReminderForm) {
            Utils.DOM.on(this.elements.addReminderForm, 'submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
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
    },

    /**
     * Set up data event listeners
     */
    setupDataListeners: function() {
        // Listen for data changes
        document.addEventListener('data:reminder:added', () => {
            this.updateDisplay();
        });

        document.addEventListener('data:reminder:updated', () => {
            this.updateDisplay();
        });

        document.addEventListener('data:reminder:deleted', () => {
            this.updateDisplay();
        });

        document.addEventListener('data:refreshed', () => {
            this.updateDisplay();
        });
    },

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts: function() {
        document.addEventListener('keydown', (e) => {
            const addModalOpen = this.elements.addReminderModal?.style.display !== 'none';
            const detailsModalOpen = this.elements.reminderDetailsModal?.style.display !== 'none';

            if (addModalOpen || detailsModalOpen ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.tagName === 'SELECT') {

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
                        this.showAddReminderModal();
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
        });
    },

    /**
     * Update all UI displays
     */
    updateDisplay: function() {
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
        const stats = DataManager.getStats();

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

        const recentReminders = DataManager.getRecentReminders();

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
                this.showReminderDetails(reminderId);
            });
        });
    },

    /**
     * Update today's schedule section
     */
    updateTodaySchedule: function() {
        if (!this.elements.todaySchedule) return;

        const schedule = DataManager.getSchedule();

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
     * Show add reminder modal
     */
    showAddReminderModal: function() {
        console.log('Opening add reminder modal');

        if (!this.elements.addReminderModal) {
            console.error('Add reminder modal not found');
            Utils.UI.showNotification('Modal not found. Please refresh the page.', 'error');
            return;
        }

        Utils.DOM.show(this.elements.addReminderModal);

        // Set default datetime to 1 hour from now
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);

        const datetimeInput = Utils.DOM.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = Utils.DateTime.formatDate(defaultTime, 'YYYY-MM-DDTHH:mm');
        }

        // Focus on title input
        const titleInput = Utils.DOM.getElementById('reminderTitle');
        if (titleInput) {
            setTimeout(() => titleInput.focus(), 100);
        }
    },

    /**
     * Show reminder details modal
     */
    showReminderDetails: function(reminderId) {
        const reminder = DataManager.getReminderById(reminderId);
        if (!reminder) {
            Utils.UI.showNotification('Reminder not found', 'error');
            return;
        }

        const modal = this.elements.reminderDetailsModal;
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
                        <div class="detail-value">${Utils.DateTime.formatDate(new Date(reminder.createdAt), 'MMM DD, YYYY at HH:mm')}</div>
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

        if (completeBtn) {
            if (reminder.status === REMINDER_STATUS.COMPLETED) {
                completeBtn.textContent = '🔄 Reactivate';
                completeBtn.className = 'btn btn-secondary';
            } else {
                completeBtn.textContent = '✅ Mark Complete';
                completeBtn.className = 'btn btn-primary';
            }
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
                this.isEditMode = false;
                this.currentReminder = null;

                // Reset modal title and button text
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

                this.clearFormErrors();

                // Clear active time buttons
                const activeButtons = document.querySelectorAll('.time-btn.active');
                activeButtons.forEach(btn => {
                    Utils.DOM.removeClass(btn, 'active');
                });
            }
        }
    },

    /**
     * Handle form submission
     */
    handleFormSubmit: function() {
        console.log('Handling form submission...');

        const form = this.elements.addReminderForm;
        const submitBtn = Utils.DOM.getElementById('submitReminderBtn');

        if (!form || !submitBtn) {
            console.error('Form or submit button not found');
            Utils.UI.showNotification('Form not found. Please refresh the page.', 'error');
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
        const validation = this.validateForm(reminderData);
        if (!validation.isValid) {
            console.log('Validation failed:', validation.errors);
            this.showFormErrors(validation.errors);
            return;
        }

        // Show loading state
        this.showSubmitLoading(submitBtn, true);

        // Process form
        setTimeout(() => {
            try {
                let result;

                if (this.isEditMode && this.currentReminder) {
                    // Update existing reminder
                    result = DataManager.updateReminder(this.currentReminder.id, reminderData);
                    Utils.UI.showNotification('Reminder updated successfully!', 'success');
                } else {
                    // Create new reminder
                    result = DataManager.addReminder(reminderData);
                    Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_CREATED, 'success');
                }

                // Schedule notification if enabled
                if (reminderData.notification && result.status === REMINDER_STATUS.ACTIVE) {
                    NotificationManager.scheduleNotification(result);
                }

                // Close modal and reset form
                this.closeModal('add');
                form.reset();
                this.clearFormErrors();

            } catch (error) {
                console.error('Error processing reminder:', error);
                Utils.UI.showNotification('Failed to save reminder. Please try again.', 'error');
            } finally {
                this.showSubmitLoading(submitBtn, false);
            }
        }, 500);
    },

    /**
     * Handle button actions
     */
    handleLogout: function() {
        if (confirm('Are you sure you want to logout?')) {
            const logoutBtn = this.elements.logoutBtn;
            if (logoutBtn) {
                const originalText = logoutBtn.textContent;
                logoutBtn.textContent = 'Logging out...';
                logoutBtn.disabled = true;

                Auth.logout()
                    .then(() => {
                        Utils.UI.showNotification(SUCCESS_MESSAGES.LOGOUT_SUCCESS, 'success', 2000);
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 1500);
                    })
                    .catch((error) => {
                        console.error('Logout error:', error);
                        Utils.UI.showNotification('Logout failed. Please try again.', 'error');
                        logoutBtn.textContent = originalText;
                        logoutBtn.disabled = false;
                    });
            }
        }
    },

    handleProfile: function() {
        Utils.UI.showNotification('Profile feature coming soon!', 'info');
    },

    handleViewAll: function() {
        Utils.UI.showNotification('View all reminders feature coming soon!', 'info');
    },

    handleSettings: function() {
        Utils.UI.showNotification('Settings feature coming soon!', 'info');
    },

    handleRefresh: function() {
        Utils.UI.showLoading(this.elements.refreshBtn, '🔄');

        setTimeout(() => {
            DataManager.refresh();
            NotificationManager.rescheduleNotifications(DataManager.getReminders());
            Utils.UI.hideLoading(this.elements.refreshBtn);
            Utils.UI.showNotification('Dashboard refreshed!', 'success', 2000);
        }, 1000);
    },

    handleEditReminder: function() {
        if (!this.currentReminder) return;

        this.closeModal('details');
        this.populateEditForm(this.currentReminder);
        this.isEditMode = true;

        if (this.elements.addReminderModal) {
            Utils.DOM.show(this.elements.addReminderModal);

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

    handleDeleteReminder: function() {
        if (!this.currentReminder) return;

        const confirmed = confirm(`Are you sure you want to delete "${this.currentReminder.title}"?`);
        if (!confirmed) return;

        try {
            DataManager.deleteReminder(this.currentReminder.id);
            NotificationManager.clearNotification(this.currentReminder.id);

            this.closeModal('details');
            Utils.UI.showNotification(SUCCESS_MESSAGES.REMINDER_DELETED, 'success');
            this.currentReminder = null;
        } catch (error) {
            console.error('Delete error:', error);
            Utils.UI.showNotification('Failed to delete reminder', 'error');
        }
    },

    handleCompleteReminder: function() {
        if (!this.currentReminder) return;

        try {
            const isCompleted = this.currentReminder.status === REMINDER_STATUS.COMPLETED;

            let result;
            if (isCompleted) {
                result = DataManager.reactivateReminder(this.currentReminder.id);
                NotificationManager.scheduleNotification(result);
            } else {
                result = DataManager.markReminderComplete(this.currentReminder);
                NotificationManager.clearNotification(this.currentReminder.id);
            }

            this.currentReminder = result;
            this.showReminderDetails(result.id);

            const message = isCompleted ? 'Reminder reactivated!' : 'Reminder marked as completed!';
            Utils.UI.showNotification(message, 'success');
        } catch (error) {
            console.error('Complete/reactivate error:', error);
            Utils.UI.showNotification('Failed to update reminder', 'error');
        }
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
                targetTime.setDate(targetTime.getDate() + 1);
                targetTime.setHours(9, 0, 0, 0);
            } else {
                targetTime.setDate(targetTime.getDate() + days);
            }
        }

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
     * Populate form for editing
     */
    populateEditForm: function(reminder) {
        const form = this.elements.addReminderForm;
        if (!form) return;

        const titleInput = Utils.DOM.getElementById('reminderTitle');
        const dateInput = Utils.DOM.getElementById('reminderDate');
        const prioritySelect = Utils.DOM.getElementById('reminderPriority');
        const categorySelect = Utils.DOM.getElementById('reminderCategory');
        const descriptionTextarea = Utils.DOM.getElementById('reminderDescription');
        const notificationCheckbox = Utils.DOM.getElementById('reminderNotification');

        if (titleInput) titleInput.value = reminder.title;
        if (dateInput) dateInput.value = Utils.DateTime.formatDate(new Date(reminder.datetime), 'YYYY-MM-DDTHH:mm');
        if (prioritySelect) prioritySelect.value = reminder.priority;
        if (categorySelect) categorySelect.value = reminder.category;
        if (descriptionTextarea) descriptionTextarea.value = reminder.description || '';
        if (notificationCheckbox) notificationCheckbox.checked = reminder.notification || false;
    },

    /**
     * Form validation and helper methods
     */
    validateForm: function(data) {
        const errors = {};

        if (!data.title) {
            errors.title = 'Title is required';
        } else if (data.title.length > 100) {
            errors.title = 'Title must be less than 100 characters';
        }

        if (!data.datetime) {
            errors.datetime = 'Date and time are required';
        } else {
            const selectedDate = new Date(data.datetime);
            if (isNaN(selectedDate.getTime())) {
                errors.datetime = 'Invalid date and time';
            }
        }

        if (data.description && data.description.length > 500) {
            errors.description = 'Description must be less than 500 characters';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    showFormErrors: function(errors) {
        this.clearFormErrors();

        Object.keys(errors).forEach(field => {
            const fieldElement = Utils.DOM.getElementById(`reminder${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (fieldElement) {
                this.showFieldError(fieldElement, errors[field]);
            }
        });
    },

    clearFormErrors: function() {
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(el => el.remove());

        const errorFields = document.querySelectorAll('.error');
        errorFields.forEach(el => Utils.DOM.removeClass(el, 'error'));
    },

    showFieldError: function(field, message) {
        if (!field) return;

        Utils.DOM.addClass(field, 'error');

        const errorElement = Utils.DOM.createElement('div', {
            class: 'field-error',
            style: 'color: #c62828; font-size: 0.875rem; margin-top: 0.25rem;'
        }, message);

        field.parentNode.insertBefore(errorElement, field.nextSibling);
    },

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

    showSubmitLoading: function(submitBtn, isLoading) {
        if (!submitBtn) return;

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
     * Display helper methods
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

    getStatusClass: function(status) {
        const statusMap = {
            [REMINDER_STATUS.ACTIVE]: 'active',
            [REMINDER_STATUS.COMPLETED]: 'completed',
            [REMINDER_STATUS.OVERDUE]: 'overdue',
            [REMINDER_STATUS.PENDING]: 'pending'
        };
        return statusMap[status] || 'active';
    },

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

    getPriorityIcon: function(priority) {
        const priorityIcons = {
            [REMINDER_PRIORITIES.LOW]: '🔵',
            [REMINDER_PRIORITIES.MEDIUM]: '🟡',
            [REMINDER_PRIORITIES.HIGH]: '🟠',
            [REMINDER_PRIORITIES.URGENT]: '🔴'
        };
        return priorityIcons[priority] || '⚪';
    },

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
    }
};

// Make UIManager available globally
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}