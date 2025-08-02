/**
 * Core Interfaces and Types - Foundation for the Reminders Vault application
 * Provides error classes, validation utilities, and data factories
 */

// Error codes enumeration
export const ERROR_CODES = Object.freeze({
    STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    TIMEOUT: 'TIMEOUT',
    INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED'
});

// Custom error classes
export class StorageError extends Error {
    constructor(message, code = ERROR_CODES.STORAGE_UNAVAILABLE, details = null) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

export class ValidationError extends Error {
    constructor(field, message, code = ERROR_CODES.VALIDATION_ERROR) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            field: this.field,
            code: this.code,
            timestamp: this.timestamp
        };
    }
}

export class AuthenticationError extends Error {
    constructor(message, code = ERROR_CODES.AUTHENTICATION_FAILED) {
        super(message);
        this.name = 'AuthenticationError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

// Reminder status enumeration
export const REMINDER_STATUS = Object.freeze({
    ACTIVE: 'active',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
    SNOOZED: 'snoozed'
});

// Priority levels
export const PRIORITY_LEVELS = Object.freeze({
    LOW: { value: 1, label: 'Low', icon: '🔵', color: '#3498db' },
    MEDIUM: { value: 2, label: 'Medium', icon: '🟡', color: '#f39c12' },
    HIGH: { value: 3, label: 'High', icon: '🟠', color: '#e67e22' },
    URGENT: { value: 4, label: 'Urgent', icon: '🔴', color: '#e74c3c' }
});

// Categories
export const REMINDER_CATEGORIES = Object.freeze({
    PERSONAL: 'personal',
    WORK: 'work',
    HEALTH: 'health',
    FINANCE: 'finance',
    EDUCATION: 'education',
    SOCIAL: 'social',
    OTHER: 'other'
});

// Data factory functions
export function createReminder(data, userId) {
    const now = new Date().toISOString();

    return {
        id: data.id || generateId(),
        title: String(data.title || '').trim(),
        description: String(data.description || '').trim(),
        datetime: data.datetime,
        category: data.category || REMINDER_CATEGORIES.PERSONAL,
        priority: Number(data.priority) || PRIORITY_LEVELS.MEDIUM.value,
        status: data.status || REMINDER_STATUS.ACTIVE,
        notification: Boolean(data.notification !== false),
        alertTimings: Array.isArray(data.alertTimings) ? data.alertTimings : [5, 15],
        userId: userId || 'default',
        createdAt: data.createdAt || now,
        updatedAt: now,
        completedAt: data.completedAt || null,
        snoozedAt: data.snoozedAt || null,
        snoozeCount: Number(data.snoozeCount) || 0
    };
}

export function createUserSession(user, rememberMe = false) {
    const now = new Date();
    const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    return {
        id: generateId(),
        username: user.username,
        role: user.role,
        profile: { ...user.profile },
        loginTime: now.toISOString(),
        expiresAt: now.getTime() + sessionDuration,
        rememberMe,
        lastActivity: now.toISOString()
    };
}

// Validation functions
export function validateReminder(data) {
    const errors = [];

    // Title validation
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push(new ValidationError('title', 'Title is required'));
    } else if (data.title.length > 100) {
        errors.push(new ValidationError('title', 'Title must be 100 characters or less'));
    }

    // Description validation
    if (data.description && data.description.length > 500) {
        errors.push(new ValidationError('description', 'Description must be 500 characters or less'));
    }

    // DateTime validation
    if (!data.datetime) {
        errors.push(new ValidationError('datetime', 'Date and time is required'));
    } else {
        const date = new Date(data.datetime);
        if (isNaN(date.getTime())) {
            errors.push(new ValidationError('datetime', 'Invalid date and time format'));
        } else if (date <= new Date()) {
            errors.push(new ValidationError('datetime', 'Date and time must be in the future'));
        }
    }

    // Priority validation
    if (data.priority !== undefined) {
        const priority = Number(data.priority);
        if (!Number.isInteger(priority) || priority < 1 || priority > 4) {
            errors.push(new ValidationError('priority', 'Priority must be between 1 and 4'));
        }
    }

    // Category validation
    if (data.category && !Object.values(REMINDER_CATEGORIES).includes(data.category)) {
        errors.push(new ValidationError('category', 'Invalid category'));
    }

    // Alert timings validation
    if (data.alertTimings && !Array.isArray(data.alertTimings)) {
        errors.push(new ValidationError('alertTimings', 'Alert timings must be an array'));
    } else if (data.alertTimings) {
        const invalidTimings = data.alertTimings.filter(t =>
            !Number.isInteger(Number(t)) || Number(t) <= 0
        );
        if (invalidTimings.length > 0) {
            errors.push(new ValidationError('alertTimings', 'All alert timings must be positive integers'));
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        data
    };
}

export function validateUserSession(session) {
    const errors = [];

    if (!session || typeof session !== 'object') {
        errors.push(new ValidationError('session', 'Invalid session data'));
        return { isValid: false, errors };
    }

    if (!session.username || typeof session.username !== 'string') {
        errors.push(new ValidationError('username', 'Valid username required in session'));
    }

    if (!session.expiresAt || typeof session.expiresAt !== 'number') {
        errors.push(new ValidationError('expiresAt', 'Valid expiration time required'));
    } else if (session.expiresAt <= Date.now()) {
        errors.push(new ValidationError('expiresAt', 'Session has expired'));
    }

    return {
        isValid: errors.length === 0,
        errors,
        session
    };
}

// Utility functions
export function generateId() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') {
        return String(input || '');
    }

    return input
        .trim()
        .substring(0, maxLength)
        .replace(/[<>]/g, ''); // Basic XSS protection
}

export function formatError(error) {
    if (error instanceof ValidationError || error instanceof StorageError || error instanceof AuthenticationError) {
        return {
            type: error.name,
            message: error.message,
            code: error.code,
            field: error.field,
            timestamp: error.timestamp
        };
    }

    return {
        type: 'Error',
        message: error.message || 'An unknown error occurred',
        timestamp: new Date().toISOString()
    };
}

// Type checking utilities
export const TypeCheckers = {
    isString: (value) => typeof value === 'string',
    isNumber: (value) => typeof value === 'number' && !isNaN(value),
    isBoolean: (value) => typeof value === 'boolean',
    isArray: (value) => Array.isArray(value),
    isObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    isFunction: (value) => typeof value === 'function',
    isDate: (value) => value instanceof Date && !isNaN(value.getTime()),
    isEmpty: (value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }
};

// Data transformation utilities
export const DataTransformers = {
    reminderToExport: (reminder) => ({
        ...reminder,
        exportedAt: new Date().toISOString(),
        version: '2.0'
    }),

    reminderFromImport: (importedReminder, userId) => ({
        ...importedReminder,
        id: generateId(), // Generate new ID for imports
        userId,
        importedAt: new Date().toISOString(),
        createdAt: importedReminder.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }),

    sessionToStorage: (session) => ({
        ...session,
        serializedAt: new Date().toISOString()
    }),

    sessionFromStorage: (storedSession) => {
        if (!storedSession) return null;

        // Validate session structure
        const validation = validateUserSession(storedSession);
        return validation.isValid ? storedSession : null;
    }
};

// Default export for convenience
export default {
    ERROR_CODES,
    REMINDER_STATUS,
    PRIORITY_LEVELS,
    REMINDER_CATEGORIES,
    StorageError,
    ValidationError,
    AuthenticationError,
    createReminder,
    createUserSession,
    validateReminder,
    validateUserSession,
    generateId,
    sanitizeInput,
    formatError,
    TypeCheckers,
    DataTransformers
};