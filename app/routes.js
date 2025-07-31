/**
 * Modern Routing System for Reminders Vault
 * Clean, efficient route definitions with lazy loading and middleware support
 */

/**
 * Route configuration with lazy loading and guard middleware
 */
export const routes = new Map([
    ['/', {
        handler: 'redirect',
        middleware: ['determineDestination'],
        meta: { title: 'Reminders Vault' }
    }],

    ['/login', {
        handler: 'page',
        component: () => import('../pages/LoginPage.js'),
        middleware: ['redirectIfAuthenticated'],
        meta: {
            title: 'Login - Reminders Vault',
            requiresAuth: false,
            redirectTo: '/dashboard'
        }
    }],

    ['/dashboard', {
        handler: 'page',
        component: () => import('../pages/DashboardPage.js'),
        middleware: ['requiresAuthentication'],
        meta: {
            title: 'Dashboard - Reminders Vault',
            requiresAuth: true,
            redirectTo: '/login'
        }
    }],

    ['/logout', {
        handler: 'action',
        middleware: ['executeLogout'],
        meta: { title: 'Logging out...' }
    }]
]);

/**
 * Middleware functions for route protection and logic
 */
export const middleware = {
    /**
     * Determines initial destination based on auth status
     */
    determineDestination: (context) => {
        const { app } = context;
        const isAuthenticated = app.getServices().auth.isAuthenticated();

        return {
            redirect: isAuthenticated ? '/dashboard' : '/login',
            handled: true
        };
    },

    /**
     * Redirects authenticated users away from login
     */
    redirectIfAuthenticated: (context) => {
        const { app, route } = context;
        const isAuthenticated = app.getServices().auth.isAuthenticated();

        if (isAuthenticated) {
            return {
                redirect: route.meta.redirectTo,
                handled: true
            };
        }

        return { handled: false };
    },

    /**
     * Ensures user is authenticated before accessing protected routes
     */
    requiresAuthentication: (context) => {
        const { app, route } = context;
        const isAuthenticated = app.getServices().auth.isAuthenticated();

        if (!isAuthenticated) {
            return {
                redirect: route.meta.redirectTo,
                handled: true
            };
        }

        return { handled: false };
    },

    /**
     * Executes logout action and redirects
     */
    executeLogout: (context) => {
        const { app } = context;

        try {
            app.getServices().auth.logout();
            return {
                redirect: '/login',
                handled: true
            };
        } catch (error) {
            console.error('Logout failed:', error);
            return {
                redirect: '/dashboard',
                handled: true
            };
        }
    }
};

/**
 * Modern router class with async component loading and middleware pipeline
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
     * Navigate to a specific route with optional state
     */
    async navigate(path, { replace = false, state = null } = {}) {
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
     * Handle route resolution with middleware pipeline
     */
    async #handleRoute(path, state = null) {
        const route = routes.get(path);

        if (!route) {
            return this.#handleNotFound(path);
        }

        // Update page title
        this.#updatePageTitle(route.meta?.title);

        // Create middleware context
        const context = {
            app: this.#app,
            route,
            path,
            state,
            currentPage: this.#currentPage
        };

        // Execute middleware pipeline
        const middlewareResult = await this.#executeMiddleware(route.middleware, context);

        if (middlewareResult.handled) {
            if (middlewareResult.redirect) {
                return this.navigate(middlewareResult.redirect, { replace: true });
            }
            return; // Middleware handled the route completely
        }

        // Execute route handler
        await this.#executeRouteHandler(route, context);

        this.#currentRoute = path;
        this.#app.emit('route:changed', { path, route, state });
    }

    /**
     * Execute middleware pipeline with short-circuit logic
     */
    async #executeMiddleware(middlewareList = [], context) {
        for (const middlewareName of middlewareList) {
            const middlewareFunc = middleware[middlewareName];

            if (!middlewareFunc) {
                console.warn(`Unknown middleware: ${middlewareName}`);
                continue;
            }

            try {
                const result = await middlewareFunc(context);

                if (result.handled) {
                    return result; // Short-circuit on first handler
                }

            } catch (error) {
                console.error(`Middleware ${middlewareName} failed:`, error);
                continue; // Continue pipeline on middleware errors
            }
        }

        return { handled: false };
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
                // Handled by middleware
                break;

            case 'action':
                // Handled by middleware
                break;

            default:
                console.warn(`Unknown route handler: ${route.handler}`);
        }
    }

    /**
     * Load page component with caching and error handling
     */
    async #loadPageComponent(route, context) {
        try {
            // Cleanup current page
            await this.#cleanupCurrentPage();

            // Load component with caching
            const ComponentModule = await this.#loadComponentWithCache(route.component);
            const ComponentClass = this.#extractComponentClass(ComponentModule);

            // Initialize new page
            this.#currentPage = new ComponentClass(this.#app);
            await this.#currentPage.initialize();

        } catch (error) {
            console.error('Page component loading failed:', error);
            throw error;
        }
    }

    /**
     * Load component with intelligent caching
     */
    async #loadComponentWithCache(componentLoader) {
        const cacheKey = componentLoader.toString();

        if (this.#loadingCache.has(cacheKey)) {
            return this.#loadingCache.get(cacheKey);
        }

        const modulePromise = componentLoader();
        this.#loadingCache.set(cacheKey, modulePromise);

        try {
            return await modulePromise;
        } catch (error) {
            // Remove failed loads from cache
            this.#loadingCache.delete(cacheKey);
            throw error;
        }
    }

    /**
     * Extract component class from module with fallback strategies
     */
    #extractComponentClass(module) {
        // Try common export patterns
        const candidates = [
            module.default,
            module.DashboardPage,
            module.LoginPage,
            module.DashboardController, // Legacy support
            Object.values(module).find(exp => typeof exp === 'function' && exp.prototype)
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
     * Cleanup current page with proper error handling
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

        // Handle initial page load
        document.addEventListener('DOMContentLoaded', () => {
            this.#handleRoute(window.location.pathname);
        });
    }

    /**
     * Handle 404 errors with fallback routing
     */
    async #handleNotFound(path) {
        console.warn(`Route not found: ${path}`);

        // Fallback to root route
        await this.navigate('/', { replace: true });

        this.#app.emit('route:notfound', { path });
    }

    /**
     * Handle navigation errors with recovery
     */
    async #handleNavigationError(error, path) {
        console.error(`Navigation error for ${path}:`, error);

        // Show user-friendly error
        this.#app.getServices().notifications?.showError?.(
            'Navigation failed. Returning to home page.'
        );

        // Fallback navigation
        try {
            await this.navigate('/', { replace: true });
        } catch (fallbackError) {
            console.error('Fallback navigation failed:', fallbackError);
            // Last resort: reload page
            window.location.reload();
        }

        this.#app.emit('route:error', { error, path });
    }

    /**
     * Utility methods
     */
    #normalizePath(path) {
        return path.startsWith('/') ? path : `/${path}`;
    }

    #updatePageTitle(title) {
        if (title) {
            document.title = title;
        }
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
     * Programmatic route checking
     */
    canNavigateTo(path) {
        const route = routes.get(this.#normalizePath(path));

        if (!route) return false;

        // Check authentication requirements
        if (route.meta?.requiresAuth) {
            return this.#app.getServices().auth.isAuthenticated();
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
 * Route utilities for external use
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
    middleware,
    Router,
    RouteUtils,
    createRouter
};