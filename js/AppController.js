// ===== APPLICATION CONTROLLER - MODERN ORCHESTRATION =====

import { authService } from './services/AuthService.js';
import { dataService } from './services/DataService.js';
import { uiService } from './services/UIService.js';
import { notificationService } from './services/NotificationService.js';
import { APP_CONFIG, FEATURE_FLAGS } from './config/constants.js';
import { debounce, throttle } from './utils.js';

/**
 * Application state management with immutable updates
 */
class AppState {
    #state = Object.freeze({
        initialized: false,
        currentRoute: null,
        user: null,
        reminders: [],
        statistics: null,
        loading: false,
        error: null
    });

    #subscribers = new Set();

    get current() {
        return this.#state;
    }

    update(updates) {
        const newState = Object.freeze({ ...this.#state, ...updates });
        const previousState = this.#state;
        this.#state = newState;

        this.#notifySubscribers(newState, previousState);
        return newState;
    }

    subscribe(callback) {
        this.#subscribers.add(callback);
        return () => this.#subscribers.delete(callback);
    }

    #notifySubscribers(newState, previousState) {
        this.#subscribers.forEach(callback => {
            try {
                callback(newState, previousState);
            } catch (error) {
                console.error('State subscriber error:', error);
            }
        });
    }
}

/**
 * Dependency injection container for services
 */
class ServiceContainer {
    #services = new Map();
    #initialized = new Set();

    register(name, serviceInstance) {
        this.#services.set(name, serviceInstance);
        return this;
    }

    get(name) {
        const service = this.#services.get(name);
        if (!service) throw new Error(`Service '${name}' not found`);
        return service;
    }

    async initializeAll() {
        const initPromises = Array.from(this.#services.entries())
            .filter(([name]) => !this.#initialized.has(name))
            .map(async ([name, service]) => {
                if (service.init && typeof service.init === 'function') {
                    await service.init();
                    this.#initialized.add(name);
                    console.log(`✅ Service '${name}' initialized`);
                }
            });

        await Promise.all(initPromises);
    }

    isInitialized(name) {
        return this.#initialized.has(name);
    }
}

/**
 * Modern Application Controller with clean architecture
 */
export class AppController {
    #state = new AppState();
    #services = new ServiceContainer();
    #eventBus = new Map();
    #performanceMetrics = {
        startTime: performance.now(),
        initDuration: 0,
        routeChanges: 0
    };

    constructor() {
        this.#setupServices();
        this.#setupEventHandlers();
        this.#setupPerformanceMonitoring();
    }

    /**
     * Initialize application with error boundaries
     */
    async init() {
        console.log('🚀 Initializing Application Controller...');

        try {
            await this.#validateEnvironment();
            await this.#initializeServices();
            await this.#setupRouting();
            await this.#restoreApplicationState();

            this.#state.update({ initialized: true });
            this.#performanceMetrics.initDuration = performance.now() - this.#performanceMetrics.startTime;

            console.log(`✅ Application initialized in ${this.#performanceMetrics.initDuration.toFixed(2)}ms`);
            this.#emit('app:ready', { metrics: this.#performanceMetrics });

        } catch (error) {
            this.#handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Navigate to different routes with state management
     */
    async navigateTo(route, options = {}) {
        const { replace = false, data = null } = options;

        this.#performanceMetrics.routeChanges++;

        try {
            const previousRoute = this.#state.current.currentRoute;
            await this.#cleanupRoute(previousRoute);

            this.#state.update({
                currentRoute: route,
                loading: true,
                error: null
            });

            await this.#initializeRoute(route, data);

            this.#state.update({ loading: false });
            this.#emit('route:changed', { from: previousRoute, to: route });

        } catch (error) {
            this.#state.update({ loading: false, error: error.message });
            this.#handleRouteError(error, route);
        }
    }

    /**
     * Handle reminder operations with optimistic updates
     */
    async handleReminderOperation(operation, data) {
        const operations = {
            create: () => this.#createReminder(data),
            update: () => this.#updateReminder(data.id, data.updates),
            delete: () => this.#deleteReminder(data.id),
            complete: () => this.#completeReminder(data.id),
            snooze: () => this.#snoozeReminder(data.id, data.newDateTime)
        };

        const handler = operations[operation];
        if (!handler) throw new Error(`Unknown operation: ${operation}`);

        return handler();
    }

    /**
     * Get current application state
     */
    getState() {
        return this.#state.current;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        return this.#state.subscribe(callback);
    }

    /**
     * Add global event listener
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

    /**
     * Graceful application shutdown
     */
    async shutdown() {
        console.log('🔄 Shutting down application...');

        try {
            await this.#persistApplicationState();
            this.#services.get('notification').clearAllNotifications();
            this.#emit('app:shutdown');

            console.log('✅ Application shutdown complete');
        } catch (error) {
            console.error('❌ Shutdown error:', error);
        }
    }

    // ===== PRIVATE METHODS =====

    /**
     * Setup service dependencies with clean injection
     */
    #setupServices() {
        this.#services
            .register('auth', authService)
            .register('data', dataService)
            .register('ui', uiService)
            .register('notification', notificationService);
    }

    /**
     * Setup application event handlers
     */
    #setupEventHandlers() {
        // Authentication events
        this.#services.get('auth').on('auth:login:success', this.#handleLoginSuccess.bind(this));
        this.#services.get('auth').on('auth:logout:success', this.#handleLogoutSuccess.bind(this));
        this.#services.get('auth').on('auth:session:expired', this.#handleSessionExpired.bind(this));

        // Data events
        this.#services.get('data').on('data:reminder:created', this.#handleReminderCreated.bind(this));
        this.#services.get('data').on('data:reminder:updated', this.#handleReminderUpdated.bind(this));
        this.#services.get('data').on('data:reminder:deleted', this.#handleReminderDeleted.bind(this));

        // Notification events
        this.#services.get('notification').on('reminder:complete', this.#handleNotificationComplete.bind(this));
        this.#services.get('notification').on('reminder:snooze', this.#handleNotificationSnooze.bind(this));

        // UI events
        this.#services.get('ui').on('form:submit', this.#handleFormSubmit.bind(this));
        this.#services.get('ui').on('shortcut:new-reminder', () => this.#showAddReminderModal());
        this.#services.get('ui').on('shortcut:refresh', () => this.#refreshData());

        // Global error handling
        window.addEventListener('error', this.#handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.#handleUnhandledRejection.bind(this));
    }

    /**
     * Setup performance monitoring
     */
    #setupPerformanceMonitoring() {
        if (!FEATURE_FLAGS.enableAnalytics) return;

        // Monitor memory usage
        const monitorPerformance = debounce(() => {
            if (performance.memory) {
                const memoryInfo = {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };

                this.#emit('app:performance', { memory: memoryInfo });
            }
        }, 30000);

        // Monitor route performance
        this.on('route:changed', monitorPerformance);
    }

    /**
     * Validate environment and dependencies
     */
    async #validateEnvironment() {
        const requiredFeatures = [
            'localStorage',
            'JSON',
            'Promise',
            'addEventListener',
            'querySelector'
        ];

        const missingFeatures = requiredFeatures.filter(feature => {
            switch (feature) {
                case 'localStorage': return typeof Storage === 'undefined';
                case 'JSON': return typeof JSON === 'undefined';
                case 'Promise': return typeof Promise === 'undefined';
                case 'addEventListener': return typeof document.addEventListener === 'undefined';
                case 'querySelector': return typeof document.querySelector === 'undefined';
                default: return false;
            }
        });

        if (missingFeatures.length > 0) {
            throw new Error(`Browser missing required features: ${missingFeatures.join(', ')}`);
        }
    }

    /**
     * Initialize all services with dependency resolution
     */
    async #initializeServices() {
        console.log('🔧 Initializing services...');

        try {
            await this.#services.initializeAll();
            console.log('✅ All services initialized successfully');
        } catch (error) {
            console.error('❌ Service initialization failed:', error);
            throw new Error(`Service initialization failed: ${error.message}`);
        }
    }

    /**
     * Setup routing with modern browser history
     */
    async #setupRouting() {
        const currentPath = window.location.pathname;
        const route = this.#getRouteFromPath(currentPath);

        this.#state.update({ currentRoute: route });

        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            const newRoute = this.#getRouteFromPath(window.location.pathname);
            this.navigateTo(newRoute);
        });

        await this.#initializeRoute(route);
    }

    /**
     * Restore application state from storage
     */
    async #restoreApplicationState() {
        try {
            const authService = this.#services.get('auth');

            if (authService.isAuthenticated()) {
                const user = authService.getCurrentUser();
                this.#state.update({ user });

                // Load user data
                await this.#refreshData();
            }
        } catch (error) {
            console.warn('Failed to restore application state:', error);
        }
    }

    /**
     * Get route from URL path
     */
    #getRouteFromPath(path) {
        if (path.includes('login.html')) return 'login';
        if (path.includes('dashboard.html')) return 'dashboard';
        if (path === '/' || path.endsWith('/') || path.includes('index.html')) return 'home';
        return 'unknown';
    }

    /**
     * Initialize specific route
     */
    async #initializeRoute(route, data = null) {
        const routeHandlers = {
            home: () => this.#initializeHome(),
            login: () => this.#initializeLogin(),
            dashboard: () => this.#initializeDashboard(data),
            unknown: () => this.#handleUnknownRoute(route)
        };

        const handler = routeHandlers[route];
        if (handler) {
            await handler();
        } else {
            throw new Error(`Unknown route: ${route}`);
        }
    }

    /**
     * Cleanup previous route
     */
    async #cleanupRoute(route) {
        if (!route) return;

        // Route-specific cleanup
        const cleanupHandlers = {
            dashboard: () => this.#cleanupDashboard()
        };

        const handler = cleanupHandlers[route];
        if (handler) await handler();
    }

    /**
     * Initialize home route
     */
    async #initializeHome() {
        const authService = this.#services.get('auth');

        if (authService.isAuthenticated()) {
            window.location.href = '/pages/dashboard.html';
        } else {
            window.location.href = '/pages/login.html';
        }
    }

    /**
     * Initialize login route
     */
    async #initializeLogin() {
        const authService = this.#services.get('auth');

        if (authService.isAuthenticated()) {
            window.location.href = '/pages/dashboard.html';
            return;
        }

        await authService.initLoginPage();
    }

    /**
     * Initialize dashboard route with data loading
     */
    async #initializeDashboard(data) {
        const authService = this.#services.get('auth');

        if (!authService.isAuthenticated()) {
            window.location.href = '/pages/login.html';
            return;
        }

        // Load dashboard data
        await this.#refreshData();

        // Setup dashboard-specific event handlers
        this.#setupDashboardHandlers();
    }

    /**
     * Setup dashboard-specific event handlers
     */
    #setupDashboardHandlers() {
        const uiService = this.#services.get('ui');
        const dataService = this.#services.get('data');

        // Auto-refresh data periodically
        const refreshInterval = setInterval(async () => {
            if (this.#state.current.currentRoute === 'dashboard') {
                await dataService.updateOverdueReminders();
                await this.#updateStatistics();
            }
        }, 60000); // Every minute

        // Store interval for cleanup
        this.dashboardRefreshInterval = refreshInterval;
    }

    /**
     * Cleanup dashboard resources
     */
    async #cleanupDashboard() {
        if (this.dashboardRefreshInterval) {
            clearInterval(this.dashboardRefreshInterval);
            this.dashboardRefreshInterval = null;
        }
    }

    /**
     * Handle unknown route
     */
    async #handleUnknownRoute(route) {
        console.warn(`Unknown route: ${route}, redirecting to home`);
        await this.navigateTo('home');
    }

    /**
     * Refresh application data
     */
    async #refreshData() {
        try {
            this.#state.update({ loading: true });

            const dataService = this.#services.get('data');
            const [reminders, statistics] = await Promise.all([
                dataService.getReminders(),
                dataService.getStatistics()
            ]);

            this.#state.update({
                reminders,
                statistics,
                loading: false
            });

            // Update UI if on dashboard
            if (this.#state.current.currentRoute === 'dashboard') {
                await this.#updateDashboardUI();
            }

            // Reschedule notifications
            const notificationService = this.#services.get('notification');
            await notificationService.rescheduleNotifications(reminders);

        } catch (error) {
            this.#state.update({ loading: false, error: error.message });
            throw error;
        }
    }

    /**
     * Update dashboard UI with current data
     */
    async #updateDashboardUI() {
        const uiService = this.#services.get('ui');
        const { reminders, statistics } = this.#state.current;

        await uiService.updateDashboard({
            reminders,
            statistics,
            schedule: [] // Could be loaded separately
        });
    }

    /**
     * Update statistics only
     */
    async #updateStatistics() {
        const dataService = this.#services.get('data');
        const statistics = await dataService.getStatistics();

        this.#state.update({ statistics });

        if (this.#state.current.currentRoute === 'dashboard') {
            const uiService = this.#services.get('ui');
            uiService.updateStatistics(statistics);
        }
    }

    /**
     * Create reminder with optimistic updates
     */
    async #createReminder(reminderData) {
        const dataService = this.#services.get('data');
        const notificationService = this.#services.get('notification');

        try {
            const reminder = await dataService.createReminder(reminderData);

            // Schedule notification if enabled
            if (reminder.notification && reminder.status === 'active') {
                await notificationService.scheduleNotification(reminder);
            }

            return reminder;
        } catch (error) {
            console.error('Failed to create reminder:', error);
            throw error;
        }
    }

    /**
     * Update reminder with notification rescheduling
     */
    async #updateReminder(id, updates) {
        const dataService = this.#services.get('data');
        const notificationService = this.#services.get('notification');

        try {
            const reminder = await dataService.updateReminder(id, updates);

            // Update notification
            notificationService.cancelNotification(id);
            if (reminder.notification && reminder.status === 'active') {
                await notificationService.scheduleNotification(reminder);
            }

            return reminder;
        } catch (error) {
            console.error('Failed to update reminder:', error);
            throw error;
        }
    }

    /**
     * Delete reminder with cleanup
     */
    async #deleteReminder(id) {
        const dataService = this.#services.get('data');
        const notificationService = this.#services.get('notification');

        try {
            notificationService.cancelNotification(id);
            return await dataService.deleteReminder(id);
        } catch (error) {
            console.error('Failed to delete reminder:', error);
            throw error;
        }
    }

    /**
     * Complete reminder with notification cleanup
     */
    async #completeReminder(id) {
        const dataService = this.#services.get('data');
        const notificationService = this.#services.get('notification');

        try {
            notificationService.cancelNotification(id);
            return await dataService.completeReminder(id);
        } catch (error) {
            console.error('Failed to complete reminder:', error);
            throw error;
        }
    }

    /**
     * Snooze reminder with new scheduling
     */
    async #snoozeReminder(id, newDateTime) {
        const dataService = this.#services.get('data');
        const notificationService = this.#services.get('notification');

        try {
            const reminder = await dataService.snoozeReminder(id, newDateTime);

            // Reschedule notification
            if (reminder.notification) {
                await notificationService.scheduleNotification(reminder);
            }

            return reminder;
        } catch (error) {
            console.error('Failed to snooze reminder:', error);
            throw error;
        }
    }

    /**
     * Show add reminder modal
     */
    async #showAddReminderModal() {
        const uiService = this.#services.get('ui');
        await uiService.showModal('addReminderModal');
    }

    /**
     * Persist application state for recovery
     */
    async #persistApplicationState() {
        // Implementation depends on storage strategy
        // Could save current route, user preferences, etc.
    }

    // ===== EVENT HANDLERS =====

    async #handleLoginSuccess({ user }) {
        this.#state.update({ user });
        await this.#refreshData();
        this.#emit('app:login-success', { user });
    }

    async #handleLogoutSuccess() {
        this.#state.update({
            user: null,
            reminders: [],
            statistics: null
        });
        this.#emit('app:logout-success');
    }

    async #handleSessionExpired() {
        await this.navigateTo('login');
        this.#emit('app:session-expired');
    }

    async #handleReminderCreated({ reminder }) {
        await this.#refreshData();
        this.#emit('app:reminder-created', { reminder });
    }

    async #handleReminderUpdated({ reminder }) {
        await this.#refreshData();
        this.#emit('app:reminder-updated', { reminder });
    }

    async #handleReminderDeleted({ reminder }) {
        await this.#refreshData();
        this.#emit('app:reminder-deleted', { reminder });
    }

    async #handleNotificationComplete({ reminder }) {
        await this.#completeReminder(reminder.id);
    }

    async #handleNotificationSnooze({ reminder, newDateTime }) {
        await this.#snoozeReminder(reminder.id, newDateTime);
    }

    async #handleFormSubmit({ form, data, modal }) {
        if (form.id === 'addReminderForm') {
            try {
                await this.#createReminder(data);
                const uiService = this.#services.get('ui');
                await uiService.hideModal(modal.id);
                uiService.showNotification('Reminder created successfully!', 'success');
            } catch (error) {
                const uiService = this.#services.get('ui');
                uiService.showNotification(`Failed to create reminder: ${error.message}`, 'error');
            }
        }
    }

    #handleInitializationError(error) {
        console.error('❌ Application initialization failed:', error);

        // Show user-friendly error
        document.body.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex; align-items: center; justify-content: center;
        color: white; font-family: system-ui, sans-serif; text-align: center;
      ">
        <div>
          <h1>Application Error</h1>
          <p>Failed to initialize the application. Please refresh the page.</p>
          <button onclick="window.location.reload()" style="
            margin-top: 1rem; padding: 0.5rem 1rem; border: none;
            background: rgba(255,255,255,0.2); color: white;
            border-radius: 4px; cursor: pointer;
          ">Refresh Page</button>
        </div>
      </div>
    `;
    }

    #handleRouteError(error, route) {
        console.error(`Route error for ${route}:`, error);
        this.#services.get('ui').showNotification(
            'Navigation error occurred. Please try again.',
            'error'
        );
    }

    #handleGlobalError(event) {
        console.error('Global error:', event.error);
        this.#emit('app:error', { error: event.error, type: 'javascript' });
    }

    #handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        this.#emit('app:error', { error: event.reason, type: 'promise' });
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
                console.error(`Error in app event listener for "${eventName}":`, error);
            }
        });

        // Global DOM event
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

// Create and export singleton instance
export const appController = new AppController();

// Export class for testing and extension
export default appController;