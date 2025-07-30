/**
 * Type definitions and interfaces for Reminders Vault
 * Provides runtime type validation and interface definitions
 */

import { REMINDER_CONFIG, ERROR_CODES } from '../config/constants.js';

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
    constructor(field, message, code = ERROR_CODES.VALIDATION_ERROR) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
    }
}

export class StorageError extends Error {
    constructor(message, code = ERROR_CODES.STORAGE_UNAVAILABLE, details = {}) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
        this.details = details;
    }
}

export class NetworkError extends Error {
    constructor(message, code = ERROR_CODES.NETWORK_ERROR, status = null) {
        super(message);
        this.name = 'NetworkError';
        this.code = code;
        this.status = status;
    }
}

/**
 * Type validation utilities
 */
export const TypeValidators = {
    isString: (value) => typeof value === 'string',
    isNumber: (value) => typeof value === 'number' && !isNaN(value),
    isBoolean: (value) => typeof value === 'boolean',
    isObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    isArray: (value) => Array.isArray(value),
    isDate: (value) => value instanceof Date && !isNaN(value.getTime()),
    isValidDateString: (value) => typeof value === 'string' && !isNaN(Date.parse(value)),
    isNonEmptyString: (value) => typeof value === 'string' && value.trim().length > 0,
    isValidEmail: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    isValidId: (value) => (typeof value === 'string' || typeof value === 'number') && value !== null && value !== undefined
};

/**
 * Reminder data structure validator
 */
export const validateReminder = (reminder) => {
    const errors = [];

    // Required fields validation
    if (!TypeValidators.isNonEmptyString(reminder?.title)) {
        errors.push(new ValidationError('title', 'Title is required and must be a non-empty string'));
    }

    if (reminder?.title && reminder.title.length > 100) {
        errors.push(new ValidationError('title', 'Title must be 100 characters or less'));
    }

    if (!TypeValidators.isValidDateString(reminder?.datetime)) {
        errors.push(new ValidationError('datetime', 'Valid datetime is required'));
    }

    if (reminder?.datetime && new Date(reminder.datetime) <= new Date()) {
        errors.push(new ValidationError('datetime', 'Datetime must be in the future'));
    }

    // Optional fields validation
    if (reminder?.description && typeof reminder.description !== 'string') {
        errors.push(new ValidationError('description', 'Description must be a string'));
    }

    if (reminder?.description && reminder.description.length > 500) {
        errors.push(new ValidationError('description', 'Description must be 500 characters or less'));
    }

    if (reminder?.priority && !Object.values(REMINDER_CONFIG.priority).some(p => p.value === reminder.priority)) {
        errors.push(new ValidationError('priority', 'Invalid priority value'));
    }

    if (reminder?.category && !Object.values(REMINDER_CONFIG.categories).includes(reminder.category)) {
        errors.push(new ValidationError('category', 'Invalid category value'));
    }

    if (reminder?.alertTimings && !TypeValidators.isArray(reminder.alertTimings)) {
        errors.push(new ValidationError('alertTimings', 'Alert timings must be an array'));
    }

    if (reminder?.alertTimings && reminder.alertTimings.some(timing => !TypeValidators.isNumber(timing) || timing <= 0)) {
        errors.push(new ValidationError('alertTimings', 'All alert timings must be positive numbers'));
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * User data structure validator
 */
export const validateUser = (user) => {
    const errors = [];

    if (!TypeValidators.isNonEmptyString(user?.username)) {
        errors.push(new ValidationError('username', 'Username is required'));
    }

    if (user?.username && (user.username.length < 3 || user.username.length > 20)) {
        errors.push(new ValidationError('username', 'Username must be between 3 and 20 characters'));
    }

    if (user?.username && !/^[a-zA-Z0-9_-]+$/.test(user.username)) {
        errors.push(new ValidationError('username', 'Username can only contain letters, numbers, underscores, and hyphens'));
    }

    if (!TypeValidators.isNonEmptyString(user?.password)) {
        errors.push(new ValidationError('password', 'Password is required'));
    }

    if (user?.password && user.password.length < 6) {
        errors.push(new ValidationError('password', 'Password must be at least 6 characters'));
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Storage service interface definition
 */
export const StorageServiceInterface = {
    // Core CRUD operations
    saveReminder: 'function',
    getReminders: 'function',
    getReminderById: 'function',
    updateReminder: 'function',
    deleteReminder: 'function',
    deleteRemindersByStatus: 'function',

    // User preferences
    saveUserPreferences: 'function',
    getUserPreferences: 'function',

    // Metadata operations
    saveMetadata: 'function',
    getMetadata: 'function',

    // Analytics
    getStatistics: 'function',

    // Data export/import
    exportAllData: 'function',
    importData: 'function',

    // Maintenance
    clearUserData: 'function',
    getDatabaseInfo: 'function',
    close: 'function'
};

/**
 * Validate storage service implementation
 */
export const validateStorageService = (service) => {
    const missingMethods = [];

    Object.entries(StorageServiceInterface).forEach(([method, expectedType]) => {
        if (typeof service[method] !== expectedType) {
            missingMethods.push(method);
        }
    });

    if (missingMethods.length > 0) {
        throw new Error('Storage service missing required methods: ${missingMethods.join(', ')}');
    }

    return true;
};

/**
 * Reminder factory with validation
 */
export const createReminder = (data, userId) => {
    const validation = validateReminder(data);
    if (!validation.isValid) {
        throw validation.errors[0];
    }

    const timestamp = new Date().toISOString();

    return {
        id: data.id || null, // Will be assigned by storage
        title: data.title.trim(),
        description: data.description?.trim() || '',
        datetime: data.datetime,
        category: data.category || REMINDER_CONFIG.categories.PERSONAL,
        priority: data.priority || REMINDER_CONFIG.priority.MEDIUM.value,
        status: data.status || REMINDER_CONFIG.status.ACTIVE,
        notification: data.notification !== false,
        alertTimings: data.alertTimings || [5, 15],
        userId,
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp
    };
};

/**
 * User session factory with validation
 */
export const createUserSession = (user, rememberMe = false) => {
    const validation = validateUser(user);
    if (!validation.isValid) {
        throw validation.errors[0];
    }

    const now = new Date();
    const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    return {
        id: crypto.randomUUID ? crypto.randomUUID() : generateId(),
        username: user.username,
        role: user.role || 'user',
        profile: { ...user.profile },
        loginTime: now.toISOString(),
        expiresAt: now.getTime() + sessionDuration,
        rememberMe
    };
};

/**
 * Generate unique ID fallback
 */
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/**
 * API response structure
 */
export const createApiResponse = (success, data = null, error = null, metadata = {}) => {
    const response = {
        success,
        timestamp: new Date().toISOString(),
        ...metadata
    };

    if (success) {
        response.data = data;
    } else {
        response.error = {
            message: error?.message || 'Unknown error',
            code: error?.code || ERROR_CODES.UNKNOWN_ERROR,
            details: error?.details || {}
        };
    }

    return response;
};

/**
 * Type guards for runtime type checking
 */
export const TypeGuards = {
    isReminder: (obj) => {
        return TypeValidators.isObject(obj) &&
            TypeValidators.isNonEmptyString(obj.title) &&
            TypeValidators.isValidDateString(obj.datetime) &&
            Object.values(REMINDER_CONFIG.status).includes(obj.status);
    },

    isUser: (obj) => {
        return TypeValidators.isObject(obj) &&
            TypeValidators.isNonEmptyString(obj.username) &&
            TypeValidators.isValidId(obj.id);
    },

    isUserSession: (obj) => {
        return TypeValidators.isObject(obj) &&
            TypeValidators.isNonEmptyString(obj.username) &&
            TypeValidators.isValidId(obj.id) &&
            TypeValidators.isValidDateString(obj.loginTime);
    },

    isStorageService: (obj) => {
        try {
            validateStorageService(obj);
            return true;
        } catch {
            return false;
        }
    }
};

/**
 * Data sanitization utilities
 */
export const DataSanitizers = {
    sanitizeString: (str, maxLength = 1000) => {
        if (!TypeValidators.isString(str)) return '';
        return str.trim().substring(0, maxLength);
    },

    sanitizeHtml: (str) => {
        if (!TypeValidators.isString(str)) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    sanitizeReminder: (reminder) => {
        if (!TypeValidators.isObject(reminder)) return null;

        return {
            ...reminder,
            title: DataSanitizers.sanitizeString(reminder.title, 100),
            description: DataSanitizers.sanitizeString(reminder.description, 500),
            category: Object.values(REMINDER_CONFIG.categories).includes(reminder.category)
                ? reminder.category
                : REMINDER_CONFIG.categories.PERSONAL,
            priority: Object.values(REMINDER_CONFIG.priority).some(p => p.value === reminder.priority)
                ? reminder.priority
                : REMINDER_CONFIG.priority.MEDIUM.value
        };
    }
};

export default {
    ValidationError,
    StorageError,
    NetworkError,
    TypeValidators,
    TypeGuards,
    DataSanitizers,
    validateReminder,
    validateUser,
    validateStorageService,
    createReminder,
    createUserSession,
    createApiResponse
};