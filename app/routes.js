/**
 * Fixed Routing System for Reminders Vault
 * Simplified, reliable route handling with proper error management
 */

/**
 * Route configuration with lazy loading
 */
export const routes = new Map([
    ['/', {
        handler: 'redirect',
        meta: { title: 'Reminders Vault' }
    }],

    ['/login', {
        handler: 'page',
        component: () => import('../pages/LoginPage.js'),
        meta: {
            title: 'Login - Reminders Vault',
            requiresAuth: false
        }
    }],

    ['/dashboard', {
        handler: 'page',
        component: () => import('../pages/DashboardPage.js'),
        meta: {
            title: 'Dashboard - Reminders Vault',
            requiresAuth: true
        }
    }],

    ['/logout', {
        handler: 'action',
        meta: { title: 'Logging out...' }
    }]
]);

/**
 * Simple router class with essential functionality
 */
export class Router {
    #app = null;
    #currentRoute = null;
    #currentPage = null;
    #loadingCache = new Map();

    constructor(app) {
        this.#app = app;
        this.#setupNavigationHandlers();
    }

    /**
     * Navigate to a specific route
     */
    async navigate(path, options = {}) {
        const { replace = false, state = null } = options;

        try {
            const normalizedPath = this.#normalizePath(path);

            // Update browser history
            if (replace) {
                history.replaceState(state, '', normalizedPath);
            } else {
                history.pushState(state, '', normalizedPath);
            }

            await this.#handleRoute(normalizedPath, state);

        } catch (error) {
            console.error(`Navigation failed for ${path}:`, error);
            await this.#handleNavigationError(error, path);
        }
    }

    /**
     * Handle route resolution
     */
    async #handleRoute(path, state = null) {
        const route = routes.get(path);

        if (!route) {
            return this.#handleNotFound(path);
        }

        // Update page title
        if (route.meta?.title) {
            document.title = route.meta.title;
        }

        // Check authentication if required
        if (route.meta?.requiresAuth && !this.#checkAuth()) {
            return this.navigate('/login', { replace: true });
        }

        // Redirect authenticated users away from login
        if (path === '/login' && this.#checkAuth()) {
            return this.navigate('/dashboard', { replace: true });
        }

        // Execute route handler
        await this.#executeRouteHandler(route, { path, state });

        this.#currentRoute = path;
        this.#app.emit('route:changed', { path, route, state });
    }

    /**
     * Execute route handler based on type
     */
    async #executeRouteHandler(route, context) {
        switch (route.handler) {
            case 'page':
                await this.#loadPageComponent(route, context);
                break;

            case 'redirect':
                await this.#handleRedirect(context);
                break;

            case 'action':
                await this.#handleAction(context);
                break;

            default:
                console.warn(`Unknown route handler: ${route.handler}`);
        }
    }

    /**
     * Load page component with error handling
     */
    async #loadPageComponent(route, context) {
        try {
            // Cleanup current page
            await this.#cleanupCurrentPage();

            // Load component
            const ComponentModule = await this.#loadComponentWithCache(route.component);
            const ComponentClass = this.#extractComponentClass(ComponentModule);

            // Initialize new page
            this.#currentPage = new ComponentClass(this.#app);

            // Set the current page in the app
            this.#app.setCurrentPage(this.#currentPage);

            if (this.#currentPage.initialize) {
                await this.#currentPage.initialize();
            }

        } catch (error) {
            console.error('Page component loading failed:', error);
            throw error;
        }
    }

    /**
     * Handle redirect logic
     */
    async #handleRedirect(context) {
        const isAuthenticated = this.#checkAuth();
        const destination = isAuthenticated ? '/dashboard' : '/login';
        return this.navigate(destination, { replace: true });
    }

    /**
     * Handle action routes (like logout)
     */
    async #handleAction(context) {
        if (context.path === '/logout') {
            const authService = this.#app.getService('auth');
            if (authService) {
                authService.logout();
            }
            return this.navigate('/login', { replace: true });
        }
    }

    /**
     * Load component with caching
     */
    async #loadComponentWithCache(componentLoader) {
        const cacheKey = componentLoader.toString();

        if (this.#loadingCache.has(cacheKey)) {
            return this.#loadingCache.get(cacheKey);
        }

        try {
            const modulePromise = componentLoader();
            this.#loadingCache.set(cacheKey, modulePromise);
            return await modulePromise;
        } catch (error) {
            this.#loadingCache.delete(cacheKey);
            throw error;
        }
    }

    /**
     * Extract component class from module
     */
    #extractComponentClass(module) {
        // Try common export patterns
        const candidates = [
            module.default,
            module.DashboardPage,
            module.DashboardController,
            module.LoginPage,
            Object.values(module).find(exp =>
                typeof exp === 'function' && exp.prototype && exp.prototype.constructor === exp
            )
        ];

        const ComponentClass = candidates.find(candidate =>
            candidate && typeof candidate === 'function'
        );

        if (!ComponentClass) {
            throw new Error('No valid component class found in module');
        }

        return ComponentClass;
    }

    /**
     * Cleanup current page
     */
    async #cleanupCurrentPage() {
        if (!this.#currentPage) return;

        try {
            if (this.#currentPage.cleanup) {
                await this.#currentPage.cleanup();
            } else if (this.#currentPage.destroy) {
                await this.#currentPage.destroy();
            }
        } catch (error) {
            console.warn('Page cleanup failed:', error);
        } finally {
            this.#currentPage = null;
        }
    }

    /**
     * Setup browser navigation event handlers
     */
    #setupNavigationHandlers() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            this.#handleRoute(window.location.pathname, event.state);
        });
    }

    /**
     * Handle 404 errors
     */
    async #handleNotFound(path) {
        console.warn(`Route not found: ${path}`);

        // Fallback to appropriate route based on auth status
        const fallbackRoute = this.#checkAuth() ? '/dashboard' : '/login';
        await this.navigate(fallbackRoute, { replace: true });

        this.#app.emit('route:notfound', { path });
    }

    /**
     * Handle navigation errors
     */
    async #handleNavigationError(error, path) {
        console.error(`Navigation error for ${path}:`, error);

        // Show user-friendly error if notification service is available
        const notifications = this.#app.getService('notifications');
        if (notifications && notifications.showError) {
            notifications.showError('Navigation failed. Returning to home page.');
        }

        // Fallback navigation
        try {
            const fallbackRoute = this.#checkAuth() ? '/dashboard' : '/login';
            await this.navigate(fallbackRoute, { replace: true });
        } catch (fallbackError) {
            console.error('Fallback navigation failed:', fallbackError);
            // Last resort: reload page
            window.location.reload();
        }

        this.#app.emit('route:error', { error, path });
    }

    /**
     * Check authentication status
     */
    #checkAuth() {
        const authService = this.#app.getService('auth');
        return authService ? authService.isAuthenticated() : false;
    }

    /**
     * Utility methods
     */
    #normalizePath(path) {
        // Ensure path starts with /
        return path.startsWith('/') ? path : `/${path}`;
    }

    /**
     * Public API
     */
    getCurrentRoute() {
        return this.#currentRoute;
    }

    getCurrentPage() {
        return this.#currentPage;
    }

    getAvailableRoutes() {
        return Array.from(routes.keys());
    }

    /**
     * Check if navigation to path is allowed
     */
    canNavigateTo(path) {
        const route = routes.get(this.#normalizePath(path));

        if (!route) return false;

        // Check authentication requirements
        if (route.meta?.requiresAuth) {
            return this.#checkAuth();
        }

        return true;
    }

    /**
     * Cleanup router resources
     */
    destroy() {
        this.#cleanupCurrentPage();
        this.#loadingCache.clear();
        this.#currentRoute = null;
    }
}

/**
 * Route utilities
 */
export const RouteUtils = {
    /**
     * Build URL with query parameters
     */
    buildUrl(path, params = {}) {
        const url = new URL(path, window.location.origin);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });

        return url.pathname + url.search;
    },

    /**
     * Parse current URL parameters
     */
    getUrlParams() {
        return Object.fromEntries(new URLSearchParams(window.location.search));
    },

    /**
     * Check if current route matches pattern
     */
    matchesRoute(pattern, path = window.location.pathname) {
        if (typeof pattern === 'string') {
            return pattern === path;
        }

        if (pattern instanceof RegExp) {
            return pattern.test(path);
        }

        return false;
    }
};

/**
 * Factory function for router creation
 */
export const createRouter = (app) => new Router(app);

export default {
    routes,
    Router,
    RouteUtils,
    createRouter
};