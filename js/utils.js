// ===== UTILITY FUNCTIONS =====

/**
 * Utility functions used across the application
 */
const Utils = {

    /**
     * DOM Manipulation Utilities
     */
    DOM: {
        // Get element by ID
        getElementById: (id) => document.getElementById(id),

        // Get elements by class name
        getElementsByClass: (className) => document.getElementsByClassName(className),

        // Query selector
        qs: (selector) => document.querySelector(selector),

        // Query selector all
        qsa: (selector) => document.querySelectorAll(selector),

        // Create element
        createElement: (tag, attributes = {}, textContent = '') => {
            const element = document.createElement(tag);
            Object.keys(attributes).forEach(attr => {
                element.setAttribute(attr, attributes[attr]);
            });
            if (textContent) element.textContent = textContent;
            return element;
        },

        // Add event listener
        on: (element, event, handler) => {
            if (element) element.addEventListener(event, handler);
        },

        // Remove event listener
        off: (element, event, handler) => {
            if (element) element.removeEventListener(event, handler);
        },

        // Show element
        show: (element) => {
            if (element) element.style.display = 'block';
        },

        // Hide element
        hide: (element) => {
            if (element) element.style.display = 'none';
        },

        // Toggle element visibility
        toggle: (element) => {
            if (element) {
                element.style.display = element.style.display === 'none' ? 'block' : 'none';
            }
        },

        // Add class
        addClass: (element, className) => {
            if (element) element.classList.add(className);
        },

        // Remove class
        removeClass: (element, className) => {
            if (element) element.classList.remove(className);
        },

        // Toggle class
        toggleClass: (element, className) => {
            if (element) element.classList.toggle(className);
        },

        // Check if element has class
        hasClass: (element, className) => {
            return element ? element.classList.contains(className) : false;
        }
    },

    /**
     * Local Storage Utilities
     */
    Storage: {
        // Set item in localStorage
        set: (key, value) => {
            try {
                const serializedValue = JSON.stringify(value);
                localStorage.setItem(key, serializedValue);
                return true;
            } catch (error) {
                console.error('Error setting localStorage item:', error);
                return false;
            }
        },

        // Get item from localStorage
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Error getting localStorage item:', error);
                return defaultValue;
            }
        },

        // Remove item from localStorage
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Error removing localStorage item:', error);
                return false;
            }
        },

        // Clear all localStorage
        clear: () => {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('Error clearing localStorage:', error);
                return false;
            }
        },

        // Check if localStorage is available
        isAvailable: () => {
            try {
                const test = '__localStorage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (error) {
                return false;
            }
        }
    },

    /**
     * Date/Time Utilities
     */
    DateTime: {
        // Format date
        formatDate: (date, format = 'YYYY-MM-DD') => {
            if (!date) return '';
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';

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

        // Get relative time (e.g., "2 hours ago")
        getRelativeTime: (date) => {
            if (!date) return '';
            const now = new Date();
            const diff = now - new Date(date);
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
            if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
            if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            return 'Just now';
        },

        // Check if date is today
        isToday: (date) => {
            if (!date) return false;
            const today = new Date();
            const checkDate = new Date(date);
            return today.toDateString() === checkDate.toDateString();
        },

        // Check if date is overdue
        isOverdue: (date) => {
            if (!date) return false;
            return new Date(date) < new Date();
        },

        // Get current date/time string
        getCurrentDateTime: () => {
            return new Date().toISOString();
        }
    },

    /**
     * Validation Utilities
     */
    Validation: {
        // Validate email
        isValidEmail: (email) => {
            return VALIDATION_RULES.EMAIL.PATTERN.test(email);
        },

        // Validate username
        isValidUsername: (username) => {
            if (!username || username.length < VALIDATION_RULES.USERNAME.MIN_LENGTH ||
                username.length > VALIDATION_RULES.USERNAME.MAX_LENGTH) {
                return false;
            }
            return VALIDATION_RULES.USERNAME.PATTERN.test(username);
        },

        // Validate password
        isValidPassword: (password) => {
            if (!password || password.length < VALIDATION_RULES.PASSWORD.MIN_LENGTH ||
                password.length > VALIDATION_RULES.PASSWORD.MAX_LENGTH) {
                return false;
            }
            return VALIDATION_RULES.PASSWORD.PATTERN.test(password);
        },

        // Validate required field
        isRequired: (value) => {
            return value !== null && value !== undefined && String(value).trim() !== '';
        },

        // Validate form
        validateForm: (formData, rules) => {
            const errors = {};

            Object.keys(rules).forEach(field => {
                const value = formData[field];
                const rule = rules[field];

                if (rule.required && !Utils.Validation.isRequired(value)) {
                    errors[field] = rule.message || `${field} is required`;
                }

                if (value && rule.pattern && !rule.pattern.test(value)) {
                    errors[field] = rule.message || `${field} is invalid`;
                }

                if (value && rule.minLength && value.length < rule.minLength) {
                    errors[field] = rule.message || `${field} must be at least ${rule.minLength} characters`;
                }

                if (value && rule.maxLength && value.length > rule.maxLength) {
                    errors[field] = rule.message || `${field} must be no more than ${rule.maxLength} characters`;
                }
            });

            return {
                isValid: Object.keys(errors).length === 0,
                errors
            };
        }
    },

    /**
     * String Utilities
     */
    String: {
        // Capitalize first letter
        capitalize: (str) => {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        // Convert to title case
        toTitleCase: (str) => {
            if (!str) return '';
            return str.replace(/\w\S*/g, (txt) =>
                txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
        },

        // Truncate string
        truncate: (str, length, suffix = '...') => {
            if (!str || str.length <= length) return str;
            return str.substring(0, length) + suffix;
        },

        // Generate random string
        generateId: (length = 8) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },

        // Escape HTML
        escapeHtml: (str) => {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    },

    /**
     * Array Utilities
     */
    Array: {
        // Check if array is empty
        isEmpty: (arr) => !arr || !Array.isArray(arr) || arr.length === 0,

        // Remove duplicates
        unique: (arr) => [...new Set(arr)],

        // Group by property
        groupBy: (arr, key) => {
            return arr.reduce((groups, item) => {
                const group = item[key];
                groups[group] = groups[group] || [];
                groups[group].push(item);
                return groups;
            }, {});
        },

        // Sort by property
        sortBy: (arr, key, direction = 'asc') => {
            return [...arr].sort((a, b) => {
                const aVal = a[key];
                const bVal = b[key];

                if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        },

        // Find item by property
        findBy: (arr, key, value) => {
            return arr.find(item => item[key] === value);
        },

        // Filter by property
        filterBy: (arr, key, value) => {
            return arr.filter(item => item[key] === value);
        }
    },

    /**
     * URL and Navigation Utilities
     */
    Navigation: {
        // Get URL parameters
        getUrlParams: () => {
            const params = {};
            const urlParams = new URLSearchParams(window.location.search);
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
            return params;
        },

        // Navigate to page
        navigateTo: (url) => {
            window.location.href = url;
        },

        // Reload current page
        reload: () => {
            window.location.reload();
        },

        // Go back
        goBack: () => {
            window.history.back();
        }
    },

    /**
     * UI Utilities
     */
    UI: {
        // Show notification
        showNotification: (message, type = 'info', duration = 5000) => {
            // Create notification element
            const notification = Utils.DOM.createElement('div', {
                class: `notification ${type}`,
                style: `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 5px;
                    color: white;
                    font-weight: 500;
                    z-index: ${UI_CONSTANTS.Z_INDEX.NOTIFICATION};
                    animation: slideInRight 0.3s ease;
                    max-width: 300px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                `
            }, message);

            // Set background color based on type
            const colors = {
                success: '#4CAF50',
                error: '#f44336',
                warning: '#FF9800',
                info: '#2196F3'
            };
            notification.style.backgroundColor = colors[type] || colors.info;

            // Add to document
            document.body.appendChild(notification);

            // Auto remove after duration
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                }
            }, duration);

            return notification;
        },

        // Show loading state
        showLoading: (element, text = 'Loading...') => {
            if (!element) return;

            element.disabled = true;
            element.dataset.originalText = element.textContent;
            element.textContent = text;
            Utils.DOM.addClass(element, 'loading');
        },

        // Hide loading state
        hideLoading: (element) => {
            if (!element) return;

            element.disabled = false;
            element.textContent = element.dataset.originalText || element.textContent;
            Utils.DOM.removeClass(element, 'loading');
        },

        // Smooth scroll to element
        scrollTo: (element, offset = 0) => {
            if (!element) return;

            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    },

    /**
     * Debounce function
     */
    debounce: (func, wait, immediate = false) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    },

    /**
     * Throttle function
     */
    throttle: (func, limit) => {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Deep clone object
     */
    deepClone: (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },

    /**
     * Check if object is empty
     */
    isEmpty: (obj) => {
        if (obj === null || obj === undefined) return true;
        if (typeof obj === 'string' || Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    },

    /**
     * Generate UUID
     */
    generateUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Format file size
     */
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

// Make Utils available globally
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}