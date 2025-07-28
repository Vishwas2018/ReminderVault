import { NotificationService } from './NotificationService.js';

/**
 * DashboardController - Modern dashboard management with clean separation of concerns
 */
export class DashboardController {
    // Private fields for encapsulation
    #reminders = [];
    #schedule = [];
    #currentUser = null;
    #notificationService = null;
    #state = {
        currentFilter: 'all',
        currentPage: 1,
        sortBy: 'datetime',
        filteredReminders: []
    };

    // Configuration constants
    static CONFIG = {
        ITEMS_PER_PAGE: 10,
        AUTO_REFRESH_INTERVAL: 60000,
        STORAGE_KEYS: {
            USER_SESSION: 'user_session',
            REMINDERS_DATA: 'reminders_data'
        },
        REMINDER_STATUS: {
            ACTIVE: 'active',
            COMPLETED: 'completed',
            OVERDUE: 'overdue'
        },
        REMINDER_PRIORITIES: {
            LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4
        }
    };

    // Sample data for initialization
    static SAMPLE_DATA = {
        reminders: [
            {
                id: 1,
                title: 'Team meeting with product team',
                description: 'Discuss quarterly roadmap and feature priorities',
                datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                category: 'work',
                priority: 3,
                status: 'active',
                notification: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: 'Test Notification - 2 Minutes',
                description: 'This reminder will trigger in 2 minutes for testing',
                datetime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
                category: 'personal',
                priority: 4,
                status: 'active',
                notification: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 3,
                title: 'Doctor appointment',
                description: 'Annual checkup with Dr. Smith',
                datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                category: 'health',
                priority: 2,
                status: 'active',
                notification: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 4,
                title: 'Buy groceries',
                description: 'Weekly grocery shopping',
                datetime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                category: 'personal',
                priority: 1,
                status: 'overdue',
                notification: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 5,
                title: 'Call Mom',
                description: '',
                datetime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                category: 'personal',
                priority: 2,
                status: 'completed',
                notification: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ],
        schedule: [
            { id: 1, time: '09:00', title: 'Daily standup', description: 'Team sync meeting' },
            { id: 2, time: '11:30', title: 'Client presentation', description: 'Present new features' },
            { id: 3, time: '14:00', title: 'Code review', description: 'Review pull requests' },
            { id: 4, time: '16:30', title: 'Sprint planning', description: 'Plan next sprint' }
        ]
    };

    constructor() {
        this.#notificationService = new NotificationService();
        this.#setupNotificationHandlers();
    }

    /**
     * Initialize dashboard with all required systems
     */
    async initialize() {
        try {
            console.log('🚀 Initializing dashboard...');

            if (!this.#checkAuthentication()) return false;

            await this.#notificationService.initialize();
            await this.#loadData();

            this.#setupEventHandlers();
            this.#startAutoRefresh();
            this.#render();

            console.log('✅ Dashboard initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.#showNotification('Failed to initialize dashboard', 'error');
            return false;
        }
    }

    /**
     * Create new reminder with validation and notification scheduling
     */
    async createReminder(reminderData) {
        try {
            // Validate required fields
            if (!reminderData.title?.trim()) {
                throw new Error('Title is required');
            }
            if (!reminderData.datetime) {
                throw new Error('Date and time is required');
            }

            const reminder = {
                id: this.#generateId(),
                title: reminderData.title.trim(),
                description: reminderData.description?.trim() || '',
                datetime: reminderData.datetime,
                category: reminderData.category || 'personal',
                priority: parseInt(reminderData.priority) || 2,
                notification: reminderData.notification !== false,
                status: this.#calculateStatus(reminderData.datetime),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.#reminders.push(reminder);
            this.#persistData();

            // Schedule notification if enabled and future
            if (reminder.notification && reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE) {
                this.#notificationService.scheduleNotification(reminder);
            }

            this.#refreshView();
            this.#showNotification('Reminder created successfully!', 'success');

            return reminder;
        } catch (error) {
            this.#showNotification(error.message, 'error');
            throw error;
        }
    }

    /**
     * Complete reminder and update status
     */
    completeReminder(reminderId) {
        const reminder = this.#findReminder(reminderId);
        if (!reminder) return;

        reminder.status = DashboardController.CONFIG.REMINDER_STATUS.COMPLETED;
        reminder.updatedAt = new Date().toISOString();

        this.#notificationService.cancelNotification(reminderId);
        this.#persistData();
        this.#refreshView();

        this.#showNotification(`"${reminder.title}" completed!`, 'success');
    }

    /**
     * Delete reminder with confirmation
     */
    deleteReminder(reminderId) {
        const reminder = this.#findReminder(reminderId);
        if (!reminder) return;

        if (!confirm(`Delete "${reminder.title}"?`)) return;

        this.#reminders = this.#reminders.filter(r => r.id !== reminderId);
        this.#notificationService.cancelNotification(reminderId);
        this.#persistData();
        this.#refreshView();

        this.#showNotification(`"${reminder.title}" deleted`, 'info');
    }

    /**
     * Snooze reminder to new time
     */
    snoozeReminder(reminderId, minutes) {
        const reminder = this.#findReminder(reminderId);
        if (!reminder) return;

        const newTime = new Date();
        newTime.setMinutes(newTime.getMinutes() + minutes);

        reminder.datetime = newTime.toISOString();
        reminder.status = DashboardController.CONFIG.REMINDER_STATUS.ACTIVE;
        reminder.updatedAt = new Date().toISOString();

        this.#notificationService.cancelNotification(reminderId);
        this.#notificationService.scheduleNotification(reminder);

        this.#persistData();
        this.#refreshView();

        this.#showNotification(`"${reminder.title}" snoozed for ${timeText}`, 'success');
    }

    /**
     * Set filter and update view
     */
    setFilter(filter) {
        this.#state.currentFilter = filter;
        this.#state.currentPage = 1;
        this.#applyFilters();
        this.#render();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.setFilter('all');
    }

    /**
     * Export data as JSON file
     */
    exportData() {
        const exportData = {
            reminders: this.#reminders,
            exportDate: new Date().toISOString(),
            user: this.#currentUser?.username,
            statistics: this.#calculateStatistics()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reminders-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        this.#showNotification('Data exported successfully!', 'success');
    }

    /**
     * Refresh dashboard data and view
     */
    refresh() {
        this.#updateOverdueReminders();
        this.#refreshView();
        this.#showNotification('Dashboard refreshed!', 'success');
    }

    /**
     * Test notification system
     */
    testNotification() {
        this.#notificationService.testNotification();
        this.#showNotification('Test notification triggered!', 'info');
    }

    /**
     * Logout user and cleanup
     */
    logout() {
        if (!confirm('Are you sure you want to logout?')) return;

        this.#cleanup();
        localStorage.removeItem(DashboardController.CONFIG.STORAGE_KEYS.USER_SESSION);
        this.#showNotification('Logged out successfully', 'success');

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }

    /**
     * Cleanup resources
     */
    #cleanup() {
        this.#notificationService?.cleanup();
        console.log('🧹 Dashboard cleanup completed');
    }

    // === PRIVATE METHODS ===

    #checkAuthentication() {
        const session = this.#getStoredData(DashboardController.CONFIG.STORAGE_KEYS.USER_SESSION);

        if (!session?.username) {
            console.log('No valid session, redirecting to login...');
            setTimeout(() => window.location.href = 'login.html', 1000);
            return false;
        }

        this.#currentUser = session;
        this.#updateWelcomeMessage();
        return true;
    }

    async #loadData() {
        const storedReminders = this.#getStoredData(DashboardController.CONFIG.STORAGE_KEYS.REMINDERS_DATA);

        if (storedReminders?.length > 0) {
            this.#reminders = storedReminders;
        } else {
            this.#reminders = [...DashboardController.SAMPLE_DATA.reminders];
            this.#persistData();
        }

        this.#schedule = [...DashboardController.SAMPLE_DATA.schedule];
        this.#applyFilters();

        // Schedule notifications for existing active reminders
        this.#scheduleExistingNotifications();

        console.log(`📊 Loaded ${this.#reminders.length} reminders`);
    }

    #scheduleExistingNotifications() {
        const activeReminders = this.#reminders.filter(r =>
            r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE &&
            r.notification &&
            new Date(r.datetime) > new Date()
        );

        activeReminders.forEach(reminder => {
            this.#notificationService.scheduleNotification(reminder);
        });

        console.log(`📅 Scheduled ${activeReminders.length} notifications`);
    }

    #setupEventHandlers() {
        // Statistics card click handlers
        document.querySelectorAll('.clickable-stat').forEach(card => {
            card.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Button handlers
        this.#setupButtonHandlers();
        this.#setupModalHandlers();
        this.#setupFormHandlers();
        this.#setupPaginationHandlers();
    }

    #setupButtonHandlers() {
        const handlers = {
            'logoutBtn': () => this.logout(),
            'addReminderBtn': () => this.#showAddReminderModal(),
            'refreshBtn': () => this.refresh(),
            'exportBtn': () => this.exportData(),
            'testNotificationBtn': () => this.testNotification(),
            'clearFiltersBtn': () => this.clearFilters(),
            'clearFilterBtn': () => this.clearFilters()
        };

        Object.entries(handlers).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('click', handler);
        });

        // Sort handler
        document.getElementById('sortBy')?.addEventListener('change', (e) => {
            this.#state.sortBy = e.target.value;
            this.#applyFilters();
            this.#renderReminders();
        });
    }

    #setupModalHandlers() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.#closeModal(modal.id);
            });
        });

        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.#closeModal(modal.id);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal[style*="flex"]');
                if (openModal) this.#closeModal(openModal.id);
            }
        });
    }

    #setupFormHandlers() {
        const form = document.getElementById('addReminderForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.#handleFormSubmit();
        });

        // Quick time buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => this.#setQuickTime(btn));
        });
    }

    #setupPaginationHandlers() {
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.#state.currentPage > 1) {
                this.#state.currentPage--;
                this.#renderReminders();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.#state.filteredReminders.length / DashboardController.CONFIG.ITEMS_PER_PAGE);
            if (this.#state.currentPage < totalPages) {
                this.#state.currentPage++;
                this.#renderReminders();
            }
        });
    }

    #setupNotificationHandlers() {
        // Listen for notification service events
        document.addEventListener('notification:check-due-reminders', () => {
            this.#notificationService.checkDueReminders(this.#reminders);
        });

        document.addEventListener('notification:reminder-complete', (e) => {
            this.completeReminder(e.detail.reminderId);
        });

        document.addEventListener('notification:reminder-snooze', (e) => {
            this.snoozeReminder(e.detail.reminderId, e.detail.minutes);
        });
    }

    #startAutoRefresh() {
        setInterval(() => {
            this.#updateDateTime();
            this.#updateOverdueReminders();
        }, DashboardController.CONFIG.AUTO_REFRESH_INTERVAL);

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('📱 Page visible - refreshing...');
                this.#updateOverdueReminders();
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.#cleanup();
        });
    }

    #applyFilters() {
        let filtered = [...this.#reminders];

        // Apply status filter
        switch (this.#state.currentFilter) {
            case 'active':
                filtered = filtered.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE);
                break;
            case 'completed':
                filtered = filtered.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.COMPLETED);
                break;
            case 'overdue':
                filtered = filtered.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.OVERDUE);
                break;
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.#state.sortBy) {
                case 'priority':
                    return b.priority - a.priority;
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'datetime':
                default:
                    return new Date(a.datetime) - new Date(b.datetime);
            }
        });

        this.#state.filteredReminders = filtered;
    }

    #render() {
        this.#updateDateTime();
        this.#updateStatistics();
        this.#renderReminders();
        this.#renderSchedule();
        this.#updateFilterInfo();
    }

    #refreshView() {
        this.#applyFilters();
        this.#render();
    }

    #updateDateTime() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    #updateWelcomeMessage() {
        const welcomeElement = document.getElementById('welcomeMessage');
        if (welcomeElement && this.#currentUser) {
            const name = this.#currentUser.profile?.firstName || this.#currentUser.username || 'User';
            welcomeElement.textContent = `Welcome back, ${name}!`;
        }
    }

    #updateStatistics() {
        const stats = this.#calculateStatistics();

        this.#animateCounter('totalReminders', stats.total);
        this.#animateCounter('activeReminders', stats.active);
        this.#animateCounter('completedToday', stats.completed);
        this.#animateCounter('overdue', stats.overdue);

        this.#updateStatCardStates();
    }

    #calculateStatistics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return {
            total: this.#reminders.length,
            active: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE).length,
            completed: this.#reminders.filter(r =>
                r.status === DashboardController.CONFIG.REMINDER_STATUS.COMPLETED &&
                new Date(r.updatedAt) >= today && new Date(r.updatedAt) < tomorrow
            ).length,
            overdue: this.#reminders.filter(r => r.status === DashboardController.CONFIG.REMINDER_STATUS.OVERDUE).length
        };
    }

    #animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentValue = parseInt(element.textContent) || 0;
        const difference = targetValue - currentValue;
        const duration = 500;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentNumber = Math.round(currentValue + (difference * progress));

            element.textContent = currentNumber;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    #updateStatCardStates() {
        document.querySelectorAll('.clickable-stat').forEach(card => {
            const filter = card.dataset.filter;
            if (filter === this.#state.currentFilter) {
                card.style.transform = 'scale(1.05)';
                card.style.boxShadow = '0 15px 30px rgba(102, 126, 234, 0.3)';
            } else {
                card.style.transform = '';
                card.style.boxShadow = '';
            }
        });
    }

    #renderReminders() {
        const container = document.getElementById('remindersList');
        if (!container) return;

        if (this.#state.filteredReminders.length === 0) {
            this.#renderEmptyState(container);
            this.#hidePagination();
            return;
        }

        // Pagination
        const totalPages = Math.ceil(this.#state.filteredReminders.length / DashboardController.CONFIG.ITEMS_PER_PAGE);
        const startIndex = (this.#state.currentPage - 1) * DashboardController.CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + DashboardController.CONFIG.ITEMS_PER_PAGE;
        const pageReminders = this.#state.filteredReminders.slice(startIndex, endIndex);

        // Render items
        const html = pageReminders.map(reminder => this.#renderReminderItem(reminder)).join('');
        container.innerHTML = html;

        this.#setupReminderActionHandlers();
        this.#updatePagination(totalPages);
    }

    #renderReminderItem(reminder) {
        const priorityIcon = this.#getPriorityIcon(reminder.priority);
        const priorityColor = this.#getPriorityColor(reminder.priority);
        const priorityName = this.#getPriorityName(reminder.priority);

        return `
      <div class="reminder-item enhanced" data-id="${reminder.id}">
        <div class="reminder-priority-indicator" style="background-color: ${priorityColor}"></div>
        
        <div class="reminder-details">
          <div class="reminder-title-enhanced">
            ${priorityIcon} ${this.#escapeHtml(reminder.title)}
          </div>
          
          <div class="reminder-meta">
            <span class="reminder-time">
              <strong>Due:</strong> ${this.#formatReminderTime(reminder.datetime)}
            </span>
            <span class="reminder-created">
              <strong>Created:</strong> ${this.#formatDate(reminder.createdAt)}
            </span>
          </div>
          
          ${reminder.description ? `
            <div class="reminder-description">
              ${this.#escapeHtml(reminder.description)}
            </div>
          ` : ''}
        </div>
        
        <div class="reminder-badges">
          <span class="badge badge-priority-${priorityName}">
            ${priorityName.toUpperCase()}
          </span>
          <span class="badge badge-category">
            ${reminder.category.toUpperCase()}
          </span>
          <span class="badge badge-status-${reminder.status}">
            ${reminder.status.toUpperCase()}
          </span>
        </div>
        
        <div class="reminder-actions-enhanced">
          ${reminder.status !== DashboardController.CONFIG.REMINDER_STATUS.COMPLETED ? `
            <button class="action-btn-small action-btn-complete" 
                    data-id="${reminder.id}" 
                    title="Mark as complete">
              ✅
            </button>
          ` : ''}
          <button class="action-btn-small action-btn-delete" 
                  data-id="${reminder.id}" 
                  title="Delete reminder">
            🗑️
          </button>
        </div>
      </div>
    `;
    }

    #renderEmptyState(container) {
        const emptyStates = {
            all: { icon: '📝', title: 'No reminders found', message: 'Create your first reminder to get started!', showAction: true },
            active: { icon: '🎉', title: 'No active reminders', message: 'All caught up! You have no active reminders.', showAction: true },
            completed: { icon: '✅', title: 'No completed reminders', message: 'Complete some reminders to see them here.', showAction: false },
            overdue: { icon: '🎯', title: 'No overdue reminders', message: 'Great job! You\'re all caught up.', showAction: false }
        };

        const state = emptyStates[this.#state.currentFilter] || emptyStates.all;

        container.innerHTML = `
      <div class="empty-state-enhanced">
        <div class="empty-icon">${state.icon}</div>
        <h3>${state.title}</h3>
        <p>${state.message}</p>
        ${state.showAction ? `
          <button class="empty-state-action" onclick="dashboard.showAddReminderModal()">
            ➕ Add Your First Reminder
          </button>
        ` : ''}
      </div>
    `;
    }

    #renderSchedule() {
        const container = document.getElementById('todaySchedule');
        if (!container) return;

        if (this.#schedule.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <h3>No schedule items</h3>
          <p>Your schedule is clear for today!</p>
        </div>
      `;
            return;
        }

        const html = this.#schedule.map(item => `
      <div class="schedule-item">
        <div class="schedule-time">${item.time}</div>
        <div class="schedule-content">
          <div class="schedule-title">${this.#escapeHtml(item.title)}</div>
          <div class="schedule-description">${this.#escapeHtml(item.description)}</div>
        </div>
      </div>
    `).join('');

        container.innerHTML = html;
    }

    #setupReminderActionHandlers() {
        document.querySelectorAll('.action-btn-complete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.completeReminder(parseInt(btn.dataset.id));
            });
        });

        document.querySelectorAll('.action-btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteReminder(parseInt(btn.dataset.id));
            });
        });
    }

    #updateFilterInfo() {
        const filterInfo = document.getElementById('filterInfo');
        const filterText = document.getElementById('filterText');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');

        if (this.#state.currentFilter === 'all') {
            filterInfo.style.display = 'none';
            clearFiltersBtn.style.display = 'none';
        } else {
            filterInfo.style.display = 'flex';
            clearFiltersBtn.style.display = 'block';

            const filterNames = {
                active: 'Active Reminders',
                completed: 'Completed Reminders',
                overdue: 'Overdue Reminders'
            };

            filterText.textContent = `Showing ${this.#state.filteredReminders.length} ${filterNames[this.#state.currentFilter]}`;
        }

        // Update title
        const titleElement = document.getElementById('remindersTitle');
        if (titleElement) {
            const titles = {
                all: 'All Reminders',
                active: 'Active Reminders',
                completed: 'Completed Reminders',
                overdue: 'Overdue Reminders'
            };
            titleElement.textContent = titles[this.#state.currentFilter];
        }
    }

    #updatePagination(totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');

        if (totalPages <= 1) {
            this.#hidePagination();
            return;
        }

        paginationContainer.style.display = 'flex';
        prevBtn.disabled = this.#state.currentPage === 1;
        nextBtn.disabled = this.#state.currentPage === totalPages;
        pageInfo.textContent = `Page ${this.#state.currentPage} of ${totalPages}`;
    }

    #hidePagination() {
        const container = document.getElementById('paginationContainer');
        if (container) container.style.display = 'none';
    }

    #showAddReminderModal() {
        const modal = document.getElementById('addReminderModal');
        if (!modal) return;

        // Reset form
        const form = document.getElementById('addReminderForm');
        if (form) form.reset();

        // Set default datetime (1 hour from now)
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);
        const datetimeInput = document.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = defaultTime.toISOString().slice(0, 16);
        }

        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('reminderTitle')?.focus(), 100);
    }

    #closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    #handleFormSubmit() {
        const form = document.getElementById('addReminderForm');
        const formData = new FormData(form);

        const reminderData = {
            title: formData.get('title'),
            description: formData.get('description'),
            datetime: formData.get('datetime'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            notification: formData.get('notification') === 'on'
        };

        this.createReminder(reminderData)
            .then(() => {
                this.#closeModal('addReminderModal');
            })
            .catch(error => {
                console.error('Failed to create reminder:', error);
            });
    }

    #setQuickTime(button) {
        const minutes = parseInt(button.dataset.minutes) || 0;
        const hours = parseInt(button.dataset.hours) || 0;

        const now = new Date();
        now.setMinutes(now.getMinutes() + minutes);
        now.setHours(now.getHours() + hours);

        const datetimeInput = document.getElementById('reminderDate');
        if (datetimeInput) {
            datetimeInput.value = now.toISOString().slice(0, 16);
        }

        // Visual feedback
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    }

    #updateOverdueReminders() {
        const now = new Date();
        let updated = false;

        this.#reminders.forEach(reminder => {
            if (reminder.status === DashboardController.CONFIG.REMINDER_STATUS.ACTIVE &&
                new Date(reminder.datetime) <= now) {
                reminder.status = DashboardController.CONFIG.REMINDER_STATUS.OVERDUE;
                reminder.updatedAt = new Date().toISOString();
                updated = true;
            }
        });

        if (updated) {
            this.#persistData();
            this.#refreshView();
        }
    }

    // === UTILITY METHODS ===

    #findReminder(id) {
        return this.#reminders.find(r => r.id === id);
    }

    #generateId() {
        return Math.max(...this.#reminders.map(r => r.id), 0) + 1;
    }

    #calculateStatus(datetime) {
        return new Date(datetime) <= new Date()
            ? DashboardController.CONFIG.REMINDER_STATUS.OVERDUE
            : DashboardController.CONFIG.REMINDER_STATUS.ACTIVE;
    }

    #getPriorityIcon(priority) {
        const icons = { 1: '🔵', 2: '🟡', 3: '🟠', 4: '🔴' };
        return icons[priority] || '⚪';
    }

    #getPriorityColor(priority) {
        const colors = { 1: '#2196F3', 2: '#FF9800', 3: '#FF5722', 4: '#F44336' };
        return colors[priority] || '#9E9E9E';
    }

    #getPriorityName(priority) {
        const names = { 1: 'low', 2: 'medium', 3: 'high', 4: 'urgent' };
        return names[priority] || 'unknown';
    }

    #formatReminderTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) {
            const days = Math.floor(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
            return days > 0 ? `Overdue by ${days} day${days > 1 ? 's' : ''}` : 'Overdue';
        }

        if (diffMs < 60 * 60 * 1000) {
            return `In ${Math.round(diffMs / 60000)}m`;
        }

        if (diffMs < 24 * 60 * 60 * 1000) {
            return `In ${Math.round(diffMs / 3600000)}h`;
        }

        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    #formatDate(dateString) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        }).format(new Date(dateString));
    }

    #formatDuration(minutes) {
        if (minutes >= 1440) return `${Math.floor(minutes/1440)} day(s)`;
        if (minutes >= 60) return `${Math.floor(minutes/60)} hour(s)`;
        return `${minutes} minute(s)`;
    }

    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    #getStoredData(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    #persistData() {
        try {
            localStorage.setItem(DashboardController.CONFIG.STORAGE_KEYS.REMINDERS_DATA, JSON.stringify(this.#reminders));
        } catch (error) {
            console.error('Failed to persist data:', error);
        }
    }

    #showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; padding: 12px 16px;
      border-radius: 6px; color: white; font-weight: 500; z-index: 10000;
      max-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%); transition: transform 0.3s ease;
    `;

        const colors = { success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        document.body.appendChild(notification);
        requestAnimationFrame(() => notification.style.transform = 'translateX(0)');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, type === 'error' ? 5000 : 3000);
    }

    // === PUBLIC API FOR GLOBAL ACCESS ===

    showAddReminderModal() {
        this.#showAddReminderModal();
    }
}