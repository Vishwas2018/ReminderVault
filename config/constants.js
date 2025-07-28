// ===== APPLICATION CONSTANTS - CLEAN & EFFICIENT =====

/**
 * Core application configuration with modern defaults
 */
const APP_CONFIG = Object.freeze({
    VERSION: '1.0.0',
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    REMEMBER_ME_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days

    STORAGE_KEYS: Object.freeze({
        USER_SESSION: 'user_session',
        REMINDERS_DATA: 'reminders_data',
        USER_PREFERENCES: 'user_preferences',
        LAST_LOGIN: 'last_login'
    })
});

/**
 * Reminder system constants with clear semantics
 */
const REMINDER_STATUS = Object.freeze({
    ACTIVE: 'active',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    PENDING: 'pending'
});

const REMINDER_PRIORITIES = Object.freeze({
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    URGENT: 4
});

const REMINDER_CATEGORIES = Object.freeze({
    PERSONAL: 'personal',
    WORK: 'work',
    HEALTH: 'health',
    FINANCE: 'finance',
    EDUCATION: 'education',
    SOCIAL: 'social',
    OTHER: 'other'
});

/**
 * Demo user accounts for authentication testing
 */
const DEMO_USERS = Object.freeze({
    admin: {
        id: 'admin',
        username: 'admin',
        password: 'password123',
        role: 'administrator',
        permissions: ['read', 'write', 'delete', 'admin'],
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com'
        },
        loginAttempts: 0,
        lockedUntil: null
    },

    user: {
        id: 'user',
        username: 'user',
        password: 'userpass123',
        role: 'user',
        permissions: ['read', 'write'],
        profile: {
            firstName: 'Standard',
            lastName: 'User',
            email: 'user@example.com'
        },
        loginAttempts: 0,
        lockedUntil: null
    },

    manager: {
        id: 'manager',
        username: 'manager',
        password: 'manager456',
        role: 'manager',
        permissions: ['read', 'write', 'manage'],
        profile: {
            firstName: 'Team',
            lastName: 'Manager',
            email: 'manager@example.com'
        },
        loginAttempts: 0,
        lockedUntil: null
    }
});

/**
 * Comprehensive message system with consistent tone
 */
const SUCCESS_MESSAGES = Object.freeze({
    LOGIN_SUCCESS: 'Welcome back! You have been successfully logged in.',
    LOGOUT_SUCCESS: 'You have been logged out successfully.',
    REMINDER_CREATED: 'Reminder created successfully!',
    REMINDER_UPDATED: 'Reminder updated successfully!',
    REMINDER_DELETED: 'Reminder deleted successfully!',
    REMINDER_COMPLETED: 'Reminder marked as completed!'
});

const ERROR_MESSAGES = Object.freeze({
    INVALID_CREDENTIALS: 'Invalid username or password. Please try again.',
    SESSION_EXPIRED: 'Your session has expired. Please login again.',
    ACCOUNT_LOCKED: 'Account temporarily locked due to too many failed attempts.',
    NETWORK_ERROR: 'Network connection error. Please try again.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please refresh the page.',
    REMINDER_NOT_FOUND: 'Reminder not found.',
    INVALID_INPUT: 'Invalid input provided. Please check and try again.'
});

/**
 * Sample data for demonstration and testing
 */
const SAMPLE_DATA = Object.freeze({
    REMINDERS: [
        {
            id: 1,
            title: 'Team meeting with product team',
            description: 'Discuss quarterly roadmap and feature priorities',
            datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.WORK,
            priority: REMINDER_PRIORITIES.HIGH,
            status: REMINDER_STATUS.ACTIVE,
            notification: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 2,
            title: 'Doctor appointment',
            description: 'Annual checkup with Dr. Smith',
            datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.HEALTH,
            priority: REMINDER_PRIORITIES.MEDIUM,
            status: REMINDER_STATUS.ACTIVE,
            notification: true,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 3,
            title: 'Buy groceries',
            description: 'Weekly grocery shopping',
            datetime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.PERSONAL,
            priority: REMINDER_PRIORITIES.LOW,
            status: REMINDER_STATUS.OVERDUE,
            notification: true,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
    ],

    SCHEDULE: [
        { id: 1, time: '09:00', title: 'Daily standup', description: 'Team sync meeting' },
        { id: 2, time: '11:30', title: 'Client presentation', description: 'Present new features' },
        { id: 3, time: '14:00', title: 'Code review', description: 'Review pull requests' },
        { id: 4, time: '16:30', title: 'Sprint planning', description: 'Plan next sprint' }
    ]
});

/**
 * Input validation patterns with clear error messages
 */
const VALIDATION_RULES = Object.freeze({
    username: {
        pattern: /^[a-zA-Z0-9_-]{3,20}$/,
        message: 'Username must be 3-20 characters (letters, numbers, underscore, dash only)'
    },
    password: {
        minLength: 6,
        pattern: /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/,
        message: 'Password must be at least 6 characters with letters and numbers'
    },
    reminderTitle: {
        maxLength: 100,
        message: 'Title must be 1-100 characters'
    }
});

// Export to global scope for legacy compatibility
if (typeof window !== 'undefined') {
    Object.assign(window, {
        APP_CONFIG,
        REMINDER_STATUS,
        REMINDER_PRIORITIES,
        REMINDER_CATEGORIES,
        DEMO_USERS,
        SUCCESS_MESSAGES,
        ERROR_MESSAGES,
        SAMPLE_DATA,
        VALIDATION_RULES
    });
}

// Modern module export (if supported)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APP_CONFIG,
        REMINDER_STATUS,
        REMINDER_PRIORITIES,
        REMINDER_CATEGORIES,
        DEMO_USERS,
        SUCCESS_MESSAGES,
        ERROR_MESSAGES,
        SAMPLE_DATA,
        VALIDATION_RULES
    };
}