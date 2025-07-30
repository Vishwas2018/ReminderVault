/**
 * Dashboard Page Controller - Main dashboard functionality
 * Manages the dashboard UI and coordinates between services
 */

import { StorageFactory } from '../../core/storage/StorageFactory.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { ReminderService } from '../../core/services/ReminderService.js';
import { Modal, modalManager } from '../components/Modal.js';
import { showSuccess, showError, showWarning, showInfo } from '../components/Notification.js';
import { DOM, Keyboard } from '../../utils/dom.js';
import { DateUtils, AsyncUtils } from '../../utils/helpers.js';
import { LocalStorage } from '../../utils/storage.js';
import { APP_CONFIG, REMINDER_CONFIG } from '../../config/constants.js';

export class DashboardPage {
  constructor() {
    this.storageService = null;
    this.notificationService = null;
    this.reminderService = null;

    this.state = {
      currentUser: null,
      currentFilter: 'all',
      currentPage: 1,
      sortBy: 'datetime',
      sortDirection: 'asc',
      isLoading: false,
      reminders: [],
      statistics: {}
    };

    this.refreshInterval = null;
    this.cleanupFunctions = new Set();
  }

  // Initialize dashboard
  async initialize() {
    try {
      this._showLoading('Initializing dashboard...', 'Setting up services');

      // Check authentication
      if (!this._checkAuthentication()) {
        return false;
      }

      // Initialize services
      await this._initializeServices();

      // Setup UI
      this._setupEventHandlers();
      this._setupAutoRefresh();

      // Load initial data
      await this._loadData();
      this._render();

      this._hideLoading();
      console.log('✅ Dashboard initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      this._hideLoading();
      this._showError('Failed to initialize dashboard', error.message);
      return false;
    }
  }

  // Check if user is authenticated
  _checkAuthentication() {
    const session = LocalStorage.get(APP_CONFIG.storage.keys.USER_SESSION);

    if (!session || !session.username) {
      this._redirectToLogin();
      return false;
    }

    // Check session expiration
    if (session.expiresAt && Date.now() > session.expiresAt) {
      showWarning('Session expired. Please log in again.');
      this._redirectToLogin();
      return false;
    }

    this.state.currentUser = session;
    return true;
  }

  // Initialize all services
  async _initializeServices() {
    // Storage service
    this.storageService = await StorageFactory.getInstance(this.state.currentUser.username);

    // Notification service
    this.notificationService = new NotificationService();
    await this.notificationService.initialize();

    // Reminder service
    this.reminderService = new ReminderService(this.storageService, this.notificationService);

    // Setup notification handlers
    this._setupNotificationHandlers();
  }

  // Setup notification event handlers
  _setupNotificationHandlers() {
    // Reminder completion from notification
    const completeHandler = this.notificationService.on('reminder-complete', async ({ reminderId }) => {
      try {
        await this.reminderService.completeReminder(reminderId, this.state.currentUser.username);
        await this._refreshData();
        showSuccess('Reminder completed!');
      } catch (error) {
        showError('Failed to complete reminder');
      }
    });

    // Reminder snooze from notification
    const snoozeHandler = this.notificationService.on('reminder-snooze', async ({ reminderId, minutes }) => {
      try {
        await this.reminderService.snoozeReminder(reminderId, minutes, this.state.currentUser.username);
        await this._refreshData();
        showSuccess(`Reminder snoozed for ${minutes} minutes`);
      } catch (error) {
        showError('Failed to snooze reminder');
      }
    });

    // Due reminder check
    const checkHandler = this.notificationService.on('check-due-reminders', () => {
      this.notificationService.checkDueReminders(this.state.reminders);
    });

    this.cleanupFunctions.add(completeHandler);
    this.cleanupFunctions.add(snoozeHandler);
    this.cleanupFunctions.add(checkHandler);
  }

  // Setup event handlers
  _setupEventHandlers() {
    // Add reminder button
    const addReminderBtn = DOM.getById('addReminderBtn');
    if (addReminderBtn) {
      const cleanup = DOM.on(addReminderBtn, 'click', () => this.showAddReminderModal());
      this.cleanupFunctions.add(cleanup);
    }

    // Refresh button
    const refreshBtn = DOM.getById('refreshBtn');
    if (refreshBtn) {
      const cleanup = DOM.on(refreshBtn, 'click', () => this.refresh());
      this.cleanupFunctions.add(cleanup);
    }

    // Export button
    const exportBtn = DOM.getById('exportBtn');
    if (exportBtn) {
      const cleanup = DOM.on(exportBtn, 'click', () => this.exportData());
      this.cleanupFunctions.add(cleanup);
    }

    // Import button
    const importBtn = DOM.getById('importBtn');
    if (importBtn) {
      const cleanup = DOM.on(importBtn, 'click', () => this.importData());
      this.cleanupFunctions.add(cleanup);
    }

    // Clear data button
    const clearDataBtn = DOM.getById('clearDataBtn');
    if (clearDataBtn) {
      const cleanup = DOM.on(clearDataBtn, 'click', () => this.clearAllData());
      this.cleanupFunctions.add(cleanup);
    }

    // Test notification button
    const testNotificationBtn = DOM.getById('testNotificationBtn');
    if (testNotificationBtn) {
      const cleanup = DOM.on(testNotificationBtn, 'click', () => this.testNotificationSystem());
      this.cleanupFunctions.add(cleanup);
    }

    // Logout button
    const logoutBtn = DOM.getById('logoutBtn');
    if (logoutBtn) {
      const cleanup = DOM.on(logoutBtn, 'click', () => this.logout());
      this.cleanupFunctions.add(cleanup);
    }

    // Filter buttons
    const filterButtons = DOM.getAll('[data-filter]');
    filterButtons.forEach(btn => {
      const cleanup = DOM.on(btn, 'click', () => {
        const filter = btn.dataset.filter;
        this.setFilter(filter);
      });
      this.cleanupFunctions.add(cleanup);
    });

    // Sort select
    const sortSelect = DOM.getById('sortBy');
    if (sortSelect) {
      const cleanup = DOM.on(sortSelect, 'change', (e) => {
        this.setSortBy(e.target.value);
      });
      this.cleanupFunctions.add(cleanup);
    }

    // Keyboard shortcuts
    const keyboardHandler = DOM.on(document, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            this.showAddReminderModal();
            break;
          case 'r':
            e.preventDefault();
            this.refresh();
            break;
        }
      }
    });
    this.cleanupFunctions.add(keyboardHandler);
  }

  // Setup auto refresh
  _setupAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this._updateDateTime();
      this._checkOverdueReminders();
    }, APP_CONFIG.notifications.autoRefreshInterval);

    // Visibility change handler
    const visibilityHandler = () => {
      if (!document.hidden) {
        this._checkOverdueReminders();
      }
    };

    const cleanup = DOM.on(document, 'visibilitychange', visibilityHandler);
    this.cleanupFunctions.add(cleanup);
    this.cleanupFunctions.add(() => {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    });
  }

  // Load data from storage
  async _loadData() {
    try {
      const [remindersResult, statistics] = await Promise.all([
        this.reminderService.getReminders(this.state.currentUser.username, {
          filters: this._getActiveFilters(),
          sortBy: this.state.sortBy,
          sortDirection: this.state.sortDirection,
          page: this.state.currentPage,
          limit: APP_CONFIG.ui.itemsPerPage
        }),
        this.reminderService.getStatistics(this.state.currentUser.username)
      ]);

      this.state.reminders = remindersResult.reminders;
      this.state.statistics = statistics;

      return true;
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Failed to load reminders', 'Please try refreshing