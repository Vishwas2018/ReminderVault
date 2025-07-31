/**
 * Main Application Class - Core orchestrator for Reminders Vault
 * Manages services, routing, authentication, and application lifecycle
 */

import { AuthService, NotificationService, ReminderService } from '../core/services/index.js';
import { StorageFactory } from '../core/storage/index.js';
import { Environment } from '../config/environment.js';
import { LoginPage } from '../pages/LoginPage.js';
import { showError, showSuccess } from '../components/ui/Notification.js';
import { EventEmitter } from '../utils/helpers.js';

export class App extends EventEmitter {
    #services = new Map();
    #currentPage = null;
    #isInitialized = false;
    #router = null;
    #storageService = null;

    constructor() {
        super();
        this.environment = Environment.initialize();
        this.#setupGlobalErrorHandlers();
    }

    /**
     * Initialize the application with environment detection and service setup
     */
    async initialize() {
        if (this.#isInitialized) {
            console.warn('App already initialized');
            return this;
        }

        try {
            console.log('🚀 Initializing Reminders Vault...');

            // Initialize storage with intelligent selection
            await this.#initializeStorage();

            // Initialize core services
            await this.#initializeServices();

            // Setup routing system
            this.#initializeRouter();

            // Setup global event listeners
            this.#setupGlobalListeners();

            this.#isInitialized = true;
            this.emit('app:initialized', { environment: this.environment });

            console.log('✅ Application initialization complete');
            return this;

        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this.emit('app:initialization-failed', error);
            this.#handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize storage service with fallback detection
     */
    async #initializeStorage() {
        try {
            console.log('📦 Initializing intelligent storage...');

            this.#storageService = await StorageFactory.getInstance('default-user');

            const storageType = StorageFactory.getStorageTypeFromService(this.#storageService);
            console.log(`✅ Storage ready: ${storageType}`);

            this.emit('storage:ready', { type: storageType, service: this.#storageService });

        } catch (error) {
            console.error('Storage initialization failed:', error);
            throw new Error(`Storage unavailable: ${error.message}`);
        }
    }

    /**
     * Initialize all core services with dependency injection
     */
    async #initializeServices() {
        try {
            // Authentication service
            const authService = new AuthService();
            this.#services.set('auth', authService);

            // Notification service
            const notificationService = new NotificationService();
            await notificationService.initialize();
            this.#services.set('notifications', notificationService);

            // Reminder service with dependencies
            const reminderService = new ReminderService(this.#storageService, notificationService);
            this.#services.set('reminders', reminderService);

            // Setup service event handlers
            this.#setupServiceEventHandlers();

            console.log('✅ Services initialized:', Array.from(this.#services.keys()));

        } catch (error) {
            console.error('Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event handlers for service communication
     */
    #setupServiceEventHandlers() {
        const authService = this.#services.get('auth');

        // Authentication events
        authService.on('authenticated', (session) => {
            console.log(`👤 User authenticated: ${session.username}`);
            this.#handleAuthentication(session);
        });

        authService.on('logout', () => {
            console.log('👋 User logged out');
            this.#handleLogout();
        });

        authService.on('session-expired', () => {
            console.log('⏰ Session expired');
            this.#handleSessionExpired();
        });

        // Reminder service events
        const reminderService = this.#services.get('reminders');
        reminderService.on('reminder-created', (data) => {
            showSuccess(`Reminder "${data.reminder.title}" created successfully`);
        });

        reminderService.on('reminder-error', (data) => {
            showError(`Reminder operation failed: ${data.error.message}`);
        });
    }

    /**
     * Initialize client-side routing
     */
    #initializeRouter() {
        this.#router = {
            currentRoute: null,
            routes: new Map([
                ['/', () => this.#redirectBasedOnAuth()],
                ['/login', () => this.#loadLoginPage()],
                ['/dashboard', () => this.#loadDashboardPage()],
                ['/logout', () => this.#handleLogout()]
            ])
        };

        // Handle browser navigation
        window.addEventListener('popstate', () => {
            this.#handleRoute(window.location.pathname);
        });

        console.log('🗺️ Router initialized');
    }

    /**
     * Handle route changes with authentication checks
     */
    async #handleRoute(path = window.location.pathname) {
        console.log(`🧭 Navigating to: ${path}`);

        const handler = this.#router.routes.get(path);
        if (!handler) {
            console.warn(`Route not found: ${path}, redirecting to root`);
            return this.navigateTo('/');
        }

        try {
            this.#router.currentRoute = path;
            await handler();
            this.emit('route:changed', { path, route: this.#router.currentRoute });
        } catch (error) {
            console.error(`Route handler error for ${path}:`, error);
            this.#handleRouteError(error, path);
        }
    }

    /**
     * Programmatic navigation
     */
    navigateTo(path, replace = false) {
        if (replace) {
            window.history.replaceState({}, '', path);
        } else {
            window.history.pushState({}, '', path);
        }
        this.#handleRoute(path);
    }

    /**
     * Route handlers
     */
    async #redirectBasedOnAuth() {
        const authService = this.#services.get('auth');
        const isAuthenticated = authService.isAuthenticated();

        this.navigateTo(isAuthenticated ? '/dashboard' : '/login', true);
    }

    async #loadLoginPage() {
        if (this.#currentPage?.cleanup) {
            this.#currentPage.cleanup();
        }

        // Check if already authenticated
        const authService = this.#services.get('auth');
        if (authService.isAuthenticated()) {
            return this.navigateTo('/dashboard', true);
        }

        this.#currentPage = new LoginPage(this);
        await this.#currentPage.initialize();

        console.log('🔐 Login page loaded');
    }

    async #loadDashboardPage() {
        const authService = this.#services.get('auth');
        if (!authService.isAuthenticated()) {
            return this.navigateTo('/login', true);
        }

        if (this.#currentPage?.cleanup) {
            this.#currentPage.cleanup();
        }

        // Dynamic import for better code splitting
        try {
            const { DashboardPage } = await import('../pages/DashboardPage.js');
            this.#currentPage = new DashboardPage(this);
            await this.#currentPage.initialize();

            console.log('📊 Dashboard page loaded');
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            showError('Failed to load dashboard. Please refresh the page.');
        }
    }

    /**
     * Authentication event handlers
     */
    #handleAuthentication(session) {
        this.emit('user:authenticated', session);
        this.navigateTo('/dashboard');
    }

    #handleLogout() {
        const authService = this.#services.get('auth');
        authService.logout();

        if (this.#currentPage?.cleanup) {
            this.#currentPage.cleanup();
            this.#currentPage = null;
        }

        this.emit('user:logout');
        this.navigateTo('/login');
    }

    #handleSessionExpired() {
        showError('Your session has expired. Please login again.');
        this.#handleLogout();
    }

    /**
     * Global event listeners
     */
    #setupGlobalListeners() {
        // Handle app lifecycle
        window.addEventListener('beforeunload', () => {
            this.#cleanup();
        });

        // Handle visibility changes for mobile
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.emit('app:focus');
                // Check for session updates when app regains focus
                const authService = this.#services.get('auth');
                if (authService.isAuthenticated()) {
                    authService.refreshSession();
                }
            } else {
                this.emit('app:blur');
            }
        });

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.emit('app:online');
            showSuccess('Connection restored');
        });

        window.addEventListener('offline', () => {
            this.emit('app:offline');
            showError('Connection lost - working offline');
        });
    }

    /**
     * Global error handlers
     */
    #setupGlobalErrorHandlers() {
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            // Handle specific error types
            if (event.reason?.name === 'QuotaExceededError') {
                showError('Storage quota exceeded. Please clear some data.');
                event.preventDefault();
            } else if (event.reason?.message?.includes('storage')) {
                showError('Storage error occurred. Some features may not work properly.');
                event.preventDefault();
            }

            this.emit('error:unhandled-promise', event.reason);
        });

        // Global JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);

            // Handle module loading errors
            if (event.error?.message?.includes('module')) {
                this.#handleModuleError(event.error);
            }

            this.emit('error:global', event.error);
        });
    }

    /**
     * Error handlers
     */
    #handleInitializationError(error) {
        const errorMessage = error.message.includes('Storage')
            ? 'Storage system unavailable. Please check your browser settings.'
            : 'Application failed to start. Please refresh the page.';

        document.body.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        display: flex; align-items: center; justify-content: center;
        color: white; font-family: system-ui, sans-serif; text-align: center;
        padding: 2rem;
      ">
        <div>
          <h1>⚠️ Startup Error</h1>
          <p>${errorMessage}</p>
          <button onclick="window.location.reload()" style="
            margin-top: 2rem; padding: 1rem 2rem;
            background: white; color: #dc2626; border: none;
            border-radius: 8px; font-weight: bold; cursor: pointer;
          ">
            🔄 Reload Application
          </button>
        </div>
      </div>
    `;
    }

    #handleModuleError(error) {
        console.error('Module loading error:', error);
        showError('Failed to load application module. Please refresh the page.');
    }

    #handleRouteError(error, path) {
        console.error(`Route error for ${path}:`, error);
        showError(`Navigation error: ${error.message}`);

        // Fallback to root route
        this.navigateTo('/');
    }

    /**
     * Service access
     */
    getServices() {
        return {
            auth: this.#services.get('auth'),
            notifications: this.#services.get('notifications'),
            reminders: this.#services.get('reminders'),
            storage: this.#storageService
        };
    }

    getService(name) {
        return this.#services.get(name);
    }

    /**
     * Application state
     */
    isInitialized() {
        return this.#isInitialized;
    }

    getCurrentRoute() {
        return this.#router?.currentRoute;
    }

    getCurrentUser() {
        return this.#services.get('auth')?.getCurrentUser();
    }

    /**
     * Cleanup and shutdown
     */
    #cleanup() {
        console.log('🧹 Cleaning up application...');

        try {
            // Cleanup current page
            if (this.#currentPage?.cleanup) {
                this.#currentPage.cleanup();
            }

            // Cleanup services
            this.#services.forEach((service, name) => {
                if (service.cleanup) {
                    service.cleanup();
                } else if (service.destroy) {
                    service.destroy();
                }
            });

            // Close storage
            if (this.#storageService?.close) {
                this.#storageService.close();
            }

            // Clear event listeners
            this.removeAllListeners();

            console.log('✅ Application cleanup complete');

        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    /**
     * Restart application
     */
    async restart() {
        console.log('🔄 Restarting application...');

        this.#cleanup();
        this.#isInitialized = false;
        this.#services.clear();

        await this.initialize();
        this.navigateTo('/');
    }

    /**
     * Development utilities
     */
    debug() {
        return {
            services: Array.from(this.#services.keys()),
            currentRoute: this.#router?.currentRoute,
            isInitialized: this.#isInitialized,
            environment: this.environment,
            storageType: StorageFactory.getStorageTypeFromService(this.#storageService),
            currentUser: this.getCurrentUser()
        };
    }
}