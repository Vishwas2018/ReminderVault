// ===== UTILITY FUNCTIONS - ES6 MODULE =====

/**
 * DOM Manipulation Utilities
 */
export const DOM = {
    // Get element by ID
    getElementById: (id) => document.getElementById(id),

    // Get elements by class name
    getElementsByClass: (className) => document.getElementsByClassName(className),

    // Query selector
    qs: (selector) => document.querySelector(selector),

    // Query selector all
    qsa: (selector) => document.querySelectorAll(selector),

    // Create element with modern approach
    createElement: (tag, attributes = {}, textContent = '') => {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.assign(element.dataset, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2), value);
            } else {
                element.setAttribute(key, value);
            }
        });

        if (textContent) element.textContent = textContent;
        return element;
    },

    // Add event listener with better error handling
    on: (element, event, handler, options = {}) => {
        if (!element) {
            console.warn(`DOM.on: Element not found for event "${event}"`);
            return;
        }

        const wrappedHandler = (e) => {
            try {
                handler(e);
            } catch (error) {
                console.error(`Error in event handler for "${event}":`, error);
            }
        };

        element.addEventListener(event, wrappedHandler, options);
        return () => element.removeEventListener(event, wrappedHandler, options);
    },

    // Remove event listener
    off: (element, event, handler, options = {}) => {
        if (element) element.removeEventListener(event, handler, options);
    },

    // Show/hide with modern methods
    show: (element) => {
        if (element) element.style.display = 'block';
    },

    hide: (element) => {
        if (element) element.style.display = 'none';
    },

    toggle: (element) => {
        if (!element) return;
        const isHidden = element.style.display === 'none' ||
            getComputedStyle(element).display === 'none';
        element.style.display = isHidden ? 'block' : 'none';
    },

    // Class manipulation
    addClass: (element, className) => {
        if (element) element.classList.add(className);
    },

    removeClass: (element, className) => {
        if (element) element.classList.remove(className);
    },

    toggleClass: (element, className) => {
        if (element) return element.classList.toggle(className);
        return false;
    },

    hasClass: (element, className) => {
        return element ? element.classList.contains(className) : false;
    }
};

/**
 * Enhanced Storage Utilities with error recovery
 */
export const Storage = {
    // Set item with error handling and size limits
    set: (key, value) => {
        try {
            const serialized = JSON.stringify(value);

            // Check storage quota (5MB typical limit)
            if (serialized.length > 5 * 1024 * 1024) {
                throw new Error('Data too large for localStorage');
            }

            localStorage.setItem(key, serialized);
            return { success: true };
        } catch (error) {
            console.error('Storage.set error:', error);

            if (error.name === 'QuotaExceededError') {
                // Attempt to clear old data
                return Storage.handleQuotaExceeded(key, value);
            }

            return { success: false, error: error.message };
        }
    },

    // Get with fallback and validation
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;

            const parsed = JSON.parse(item);
            return parsed;
        } catch (error) {
            console.warn(`Storage.get error for key "${key}":`, error);

            // Attempt to clean corrupted data
            Storage.remove(key);
            return defaultValue;
        }
    },

    // Remove with validation
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return { success: true };
        } catch (error) {
            console.error('Storage.remove error:', error);
            return { success: false, error: error.message };
        }
    },

    // Clear all with confirmation
    clear: () => {
        try {
            localStorage.clear();
            return { success: true };
        } catch (error) {
            console.error('Storage.clear error:', error);
            return { success: false, error: error.message };
        }
    },

    // Enhanced availability check
    isAvailable: () => {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, 'test');
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    },

    // Handle quota exceeded by cleaning old data
    handleQuotaExceeded: (key, value) => {
        try {
            // Get all keys and their sizes
            const keys = Object.keys(localStorage);
            const sizes = keys.map(k => ({
                key: k,
                size: localStorage.getItem(k).length,
                lastModified: Storage.getTimestamp(k)
            }));

            // Sort by last modified (oldest first)
            sizes.sort((a, b) => a.lastModified - b.lastModified);

            // Remove oldest items until we have space
            let removedSize = 0;
            const targetSize = JSON.stringify(value).length;

            for (const item of sizes) {
                if (removedSize >= targetSize) break;
                if (item.key !== key) { // Don't remove the key we're trying to set
                    localStorage.removeItem(item.key);
                    removedSize += item.size;
                }
            }

            // Try again
            localStorage.setItem(key, JSON.stringify(value));
            return { success: true, cleaned: true };
        } catch (error) {
            return { success: false, error: 'Storage quota exceeded and cleanup failed' };
        }
    },

    // Get timestamp for a key (used for cleanup)
    getTimestamp: (key) => {
        const timestampKey = `${key}_timestamp`;
        return parseInt(localStorage.getItem(timestampKey) || Date.now());
    },

    // Set timestamp for a key
    setTimestamp: (key) => {
        const timestampKey = `${key}_timestamp`;
        localStorage.setItem(timestampKey, Date.now().toString());
    }
};

/**
 * Enhanced DateTime Utilities
 */
export const DateTime = {
    // Format date with locale support
    formatDate: (date, format = 'YYYY-MM-DD', locale = 'en-US') => {
        if (!date) return '';

        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        // Use Intl for better formatting
        if (format === 'locale') {
            return new Intl.DateTimeFormat(locale).format(d);
        }

        if (format === 'localeTime') {
            return new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit'
            }).format(d);
        }

        if (format === 'localeDateTime') {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(d);
        }

        // Fallback to manual formatting
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes);
    },

    // Enhanced relative time with better precision
    getRelativeTime: (date, locale = 'en-US') => {
        if (!date) return '';

        const now = new Date();
        const target = new Date(date);
        const diffMs = now - target;

        // Use Intl.RelativeTimeFormat for better localization
        if (Intl.RelativeTimeFormat) {
            const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (Math.abs(diffDays) >= 1) return rtf.format(-diffDays, 'day');
            if (Math.abs(diffHours) >= 1) return rtf.format(-diffHours, 'hour');
            if (Math.abs(diffMinutes) >= 1) return rtf.format(-diffMinutes, 'minute');
            return rtf.format(-diffSeconds, 'second');
        }

        // Fallback for older browsers
        const seconds = Math.floor(Math.abs(diffMs) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${diffMs > 0 ? 'ago' : 'from now'}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${diffMs > 0 ? 'ago' : 'from now'}`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ${diffMs > 0 ? 'ago' : 'from now'}`;
        return 'Just now';
    },

    // Check if date is today with timezone handling
    isToday: (date, timezone = undefined) => {
        if (!date) return false;

        const today = new Date();
        const checkDate = new Date(date);

        if (timezone && Intl.DateTimeFormat) {
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
            const todayFormatted = formatter.format(today);
            const checkFormatted = formatter.format(checkDate);
            return todayFormatted === checkFormatted;
        }

        return today.toDateString() === checkDate.toDateString();
    },

    // Enhanced overdue check with grace period
    isOverdue: (date, gracePeriodMs = 0) => {
        if (!date) return false;
        return new Date(date).getTime() + gracePeriodMs < Date.now();
    },

    // Get current date/time with timezone
    getCurrentDateTime: (timezone = undefined) => {
        const now = new Date();
        if (timezone && Intl.DateTimeFormat) {
            return new Intl.DateTimeFormat('sv-SE', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(now).replace(' ', 'T');
        }
        return now.toISOString();
    },

    // Add time zone support
    getTimeZone: () => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
};

/**
 * Enhanced Validation with better patterns
 */
export const Validation = {
    // Email validation with modern regex
    isValidEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email?.toString() || '');
    },

    // Username validation with Unicode support
    isValidUsername: (username) => {
        if (!username || typeof username !== 'string') return false;

        const trimmed = username.trim();
        if (trimmed.length < 3 || trimmed.length > 20) return false;

        // Allow letters, numbers, underscores, and hyphens
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        return usernameRegex.test(trimmed);
    },

    // Enhanced password validation
    isValidPassword: (password) => {
        if (!password || typeof password !== 'string') return false;
        if (password.length < 6 || password.length > 128) return false;

        // At least one letter and one number
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);

        return hasLetter && hasNumber;
    },

    // Required field validation
    isRequired: (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.length > 0;
        return true;
    },

    // Enhanced form validation with async support
    validateForm: async (formData, rules) => {
        const errors = {};
        const warnings = {};

        for (const [field, rule] of Object.entries(rules)) {
            const value = formData[field];

            try {
                // Required validation
                if (rule.required && !Validation.isRequired(value)) {
                    errors[field] = rule.requiredMessage || `${field} is required`;
                    continue;
                }

                // Skip other validations if value is empty and not required
                if (!value && !rule.required) continue;

                // Type validation
                if (rule.type && !Validation.validateType(value, rule.type)) {
                    errors[field] = rule.typeMessage || `${field} must be a valid ${rule.type}`;
                    continue;
                }

                // Pattern validation
                if (rule.pattern && !rule.pattern.test(value)) {
                    errors[field] = rule.patternMessage || `${field} format is invalid`;
                    continue;
                }

                // Length validation
                if (rule.minLength && value.length < rule.minLength) {
                    errors[field] = rule.minLengthMessage ||
                        `${field} must be at least ${rule.minLength} characters`;
                    continue;
                }

                if (rule.maxLength && value.length > rule.maxLength) {
                    errors[field] = rule.maxLengthMessage ||
                        `${field} must be no more than ${rule.maxLength} characters`;
                    continue;
                }

                // Custom validation
                if (rule.validate && typeof rule.validate === 'function') {
                    const customResult = await rule.validate(value, formData);
                    if (customResult !== true) {
                        errors[field] = customResult || `${field} is invalid`;
                        continue;
                    }
                }

                // Warning validation
                if (rule.warn && typeof rule.warn === 'function') {
                    const warnResult = await rule.warn(value, formData);
                    if (warnResult !== true) {
                        warnings[field] = warnResult;
                    }
                }

            } catch (error) {
                console.error(`Validation error for field ${field}:`, error);
                errors[field] = 'Validation failed';
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            warnings
        };
    },

    // Type validation helper
    validateType: (value, type) => {
        switch (type) {
            case 'email': return Validation.isValidEmail(value);
            case 'number': return !isNaN(Number(value));
            case 'date': return !isNaN(Date.parse(value));
            case 'url':
                try { new URL(value); return true; } catch { return false; }
            default: return true;
        }
    }
};

/**
 * Enhanced String utilities
 */
export const StringUtils = {
    capitalize: (str) => {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    toTitleCase: (str) => {
        if (!str || typeof str !== 'string') return '';
        return str.replace(/\w\S*/g, (txt) =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    },

    truncate: (str, length, suffix = '...') => {
        if (!str || typeof str !== 'string') return '';
        if (str.length <= length) return str;
        return str.substring(0, length - suffix.length) + suffix;
    },

    generateId: (length = 8) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');
    },

    escapeHtml: (str) => {
        if (!str || typeof str !== 'string') return '';

        const entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };

        return str.replace(/[&<>"'\/]/g, (char) => entityMap[char]);
    },

    // Slugify for URLs
    slugify: (str) => {
        if (!str || typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
};

/**
 * Enhanced Array utilities with modern methods
 */
export const ArrayUtils = {
    isEmpty: (arr) => !Array.isArray(arr) || arr.length === 0,

    unique: (arr, keyFn = null) => {
        if (!Array.isArray(arr)) return [];

        if (keyFn) {
            const seen = new Set();
            return arr.filter(item => {
                const key = keyFn(item);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return [...new Set(arr)];
    },

    groupBy: (arr, keyFn) => {
        if (!Array.isArray(arr)) return {};

        return arr.reduce((groups, item) => {
            const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
            groups[key] = groups[key] || [];
            groups[key].push(item);
            return groups;
        }, {});
    },

    sortBy: (arr, keyFn, direction = 'asc') => {
        if (!Array.isArray(arr)) return [];

        return [...arr].sort((a, b) => {
            const aVal = typeof keyFn === 'function' ? keyFn(a) : a[keyFn];
            const bVal = typeof keyFn === 'function' ? keyFn(b) : b[keyFn];

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    findBy: (arr, keyFn, value) => {
        if (!Array.isArray(arr)) return undefined;

        return arr.find(item => {
            const itemValue = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
            return itemValue === value;
        });
    },

    filterBy: (arr, keyFn, value) => {
        if (!Array.isArray(arr)) return [];

        return arr.filter(item => {
            const itemValue = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
            return itemValue === value;
        });
    },

    // Chunk array into smaller arrays
    chunk: (arr, size) => {
        if (!Array.isArray(arr) || size <= 0) return [];

        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
};

/**
 * Enhanced Navigation utilities
 */
export const Navigation = {
    getUrlParams: () => {
        return Object.fromEntries(new URLSearchParams(window.location.search));
    },

    navigateTo: (url, options = {}) => {
        if (options.replace) {
            window.location.replace(url);
        } else {
            window.location.href = url;
        }
    },

    reload: (forceReload = false) => {
        window.location.reload(forceReload);
    },

    goBack: () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            Navigation.navigateTo('/');
        }
    },

    // Get current route info
    getCurrentRoute: () => {
        return {
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            params: Navigation.getUrlParams()
        };
    }
};

/**
 * Enhanced UI utilities with better error handling
 */
export const UI = {
    showNotification: (message, type = 'info', duration = 5000) => {
        // Remove existing notifications of same type
        const existingNotifications = document.querySelectorAll(`.notification.${type}`);
        existingNotifications.forEach(notification => notification.remove());

        const notification = DOM.createElement('div', {
            className: `notification ${type}`,
            style: `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 350px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        backdrop-filter: blur(10px);
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      `
        }, message);

        // Set colors based on type
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        notification.style.backgroundColor = colors[type] || colors.info;

        // Add close button
        const closeBtn = DOM.createElement('button', {
            style: `
        position: absolute;
        top: 5px;
        right: 8px;
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.7;
        line-height: 1;
      `,
            onClick: () => notification.remove()
        }, '×');

        notification.appendChild(closeBtn);
        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }

        return notification;
    },

    showLoading: (element, text = 'Loading...') => {
        if (!element) return;

        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = text;
        element.classList.add('loading');
    },

    hideLoading: (element) => {
        if (!element) return;

        element.disabled = false;
        element.textContent = element.dataset.originalText || element.textContent;
        element.classList.remove('loading');
        delete element.dataset.originalText;
    },

    scrollTo: (element, options = {}) => {
        if (!element) return;

        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };

        element.scrollIntoView({ ...defaultOptions, ...options });
    }
};

/**
 * Modern utility functions
 */
export const debounce = (func, wait, immediate = false) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };

        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func.apply(this, args);
    };
};

export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));

    if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }

    return obj;
};

export const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

export const generateUUID = () => {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Default export for convenience
export default {
    DOM,
    Storage,
    DateTime,
    Validation,
    String: StringUtils,
    Array: ArrayUtils,
    Navigation,
    UI,
    debounce,
    throttle,
    deepClone,
    isEmpty,
    generateUUID,
    formatFileSize
};