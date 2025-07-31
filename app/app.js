/**
 * Main Application Class - Fixed core orchestrator for Reminders Vault
 * Manages services, routing, authentication, and application lifecycle
 */

import { AuthService, NotificationService, ReminderService } from '../core/services/index.js';
import { StorageFactory } from '../core/storage/index.js';
import { Environment } from '../config/environment.js';
import { showError, showSuccess } from '../components/ui/Notification.js';
import { EventEmitter } from '../utils/helpers.js';
import { Router } from './routes.js';

export class App extends EventEmitter {
    #services = new Map();
    #currentPage = null;
    #isInitialized = false;
    #router = null;
    #storageService = null;
    #environment = null;

    constructor() {
        super();
        this.#environment = Environment.initialize();
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
            this.emit('app:initialized', { environment: this.#environment });

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
            console.log('⚙️ Initializing core services...');

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
        if (reminderService) {
            reminderService.on('reminder-created', (data) => {
                showSuccess(`Reminder "${data.reminder.title}" created successfully`);
            });

            reminderService.on('reminder-error', (data) => {
                showError(`Reminder operation failed: ${data.error.message}`);
            });
        }
    }

    /**
     * Initialize client-side routing
     */
    #initializeRouter() {
        this.#router = new Router(this);

        // Handle initial route
        const currentPath = window.location.pathname;
        this.#router.navigate(currentPath, { replace: true });

        console.log('🗺️ Router initialized');
    }

    /**
     * Programmatic navigation
     */
    navigateTo(path, replace = false) {
        if (this.#router) {
            return this.#router.navigate(path, { replace });
        } else {
            // Fallback navigation
            if (replace) {
                window.history.replaceState({}, '', path);
            } else {
                window.history.pushState({}, '', path);
            }
            window.location.href = path;
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
        if (authService) {
            authService.logout();
        }

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
            this.cleanup();
        });

        // Handle visibility changes for mobile
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.emit('app:focus');
                // Check for session updates when app regains focus
                const authService = this.#services.get('auth');
                if (authService?.isAuthenticated()) {
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

        console.log('📡 Global event listeners setup complete');
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
                padding: 2rem; z-index: 99999;
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
        return this.#services.get(name) || this.#storageService;
    }

    /**
     * Application state
     */
    isInitialized() {
        return this.#isInitialized;
    }

    getCurrentRoute() {
        return this.#router?.getCurrentRoute();
    }

    getCurrentUser() {
        return this.#services.get('auth')?.getCurrentUser();
    }

    getEnvironment() {
        return this.#environment;
    }

    /**
     * Page management
     */
    setCurrentPage(page) {
        if (this.#currentPage?.cleanup) {
            this.#currentPage.cleanup();
        }
        this.#currentPage = page;
    }

    getCurrentPage() {
        return this.#currentPage;
    }

    /**
     * Cleanup and shutdown
     */
    cleanup() {
        console.log('🧹 Cleaning up application...');

        try {
            // Cleanup current page
            if (this.#currentPage?.cleanup) {
                this.#currentPage.cleanup();
            }

            // Cleanup router
            if (this.#router?.destroy) {
                this.#router.destroy();
            }

            // Cleanup services
            this.#services.forEach((service, name) => {
                try {
                    if (service.cleanup) {
                        service.cleanup();
                    } else if (service.destroy) {
                        service.destroy();
                    }
                } catch (error) {
                    console.warn(`Failed to cleanup service ${name}:`, error);
                }
            });

            // Close storage
            if (this.#storageService?.close) {
                this.#storageService.close().catch(error => {
                    console.warn('Storage close warning:', error);
                });
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

        this.cleanup();
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
            currentRoute: this.#router?.getCurrentRoute(),
            currentPage: this.#currentPage?.constructor?.name,
            isInitialized: this.#isInitialized,
            environment: this.#environment,
            storageType: StorageFactory.getStorageTypeFromService(this.#storageService),
            currentUser: this.getCurrentUser()
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            isInitialized: this.#isInitialized,
            services: {},
            storage: null,
            router: null
        };

        // Check services
        for (const [name, service] of this.#services) {
            try {
                if (service.healthCheck) {
                    health.services[name] = await service.healthCheck();
                } else {
                    health.services[name] = { healthy: true, note: 'No health check available' };
                }
            } catch (error) {
                health.services[name] = { healthy: false, error: error.message };
            }
        }

        // Check storage
        try {
            if (this.#storageService?.getDatabaseInfo) {
                const dbInfo = await this.#storageService.getDatabaseInfo();
                health.storage = { healthy: true, info: dbInfo };
            }
        } catch (error) {
            health.storage = { healthy: false, error: error.message };
        }

        // Check router
        health.router = {
            healthy: !!this.#router,
            currentRoute: this.getCurrentRoute()
        };

        return health;
    }
}