// ===== APPLICATION CONSTANTS =====

/**
 * Application Configuration
 */
const APP_CONFIG = {
    // Application Info
    APP_NAME: 'Reminder Manager',
    VERSION: '1.0.0',

    // Local Storage Keys
    STORAGE_KEYS: {
        USER_SESSION: 'reminder_app_user',
        USER_PREFERENCES: 'reminder_app_preferences',
        REMINDERS_DATA: 'reminder_app_data',
        LAST_LOGIN: 'reminder_app_last_login'
    },

    // Session Management
    SESSION: {
        TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        REMEMBER_ME_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days
        CHECK_INTERVAL: 5 * 60 * 1000 // Check session every 5 minutes
    },

    // API Configuration (for future backend integration)
    API: {
        BASE_URL: '/api/v1',
        ENDPOINTS: {
            LOGIN: '/auth/login',
            LOGOUT: '/auth/logout',
            PROFILE: '/user/profile',
            REMINDERS: '/reminders',
            DASHBOARD: '/dashboard/stats'
        },
        TIMEOUT: 10000 // 10 seconds
    },

    // Pagination
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 10,
        MAX_PAGE_SIZE: 100
    },

    // Date/Time Formats
    DATE_FORMATS: {
        DISPLAY: 'MMM DD, YYYY',
        INPUT: 'YYYY-MM-DD',
        DATETIME: 'YYYY-MM-DD HH:mm',
        TIME: 'HH:mm'
    },

    // Notification Settings
    NOTIFICATIONS: {
        DEFAULT_DURATION: 5000, // 5 seconds
        ERROR_DURATION: 8000,   // 8 seconds
        SUCCESS_DURATION: 3000  // 3 seconds
    }
};

/**
 * User Roles and Permissions
 */
const USER_ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
    GUEST: 'guest'
};

const PERMISSIONS = {
    [USER_ROLES.ADMIN]: ['create', 'read', 'update', 'delete', 'manage_users'],
    [USER_ROLES.MANAGER]: ['create', 'read', 'update', 'delete'],
    [USER_ROLES.USER]: ['create', 'read', 'update'],
    [USER_ROLES.GUEST]: ['read']
};

/**
 * Demo User Credentials
 * In a real application, this would be handled by the backend
 */
const DEMO_USERS = {
    'admin': {
        password: 'password123',
        role: USER_ROLES.ADMIN,
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@reminderapp.com',
            avatar: null
        }
    },
    'user': {
        password: 'userpass123',
        role: USER_ROLES.USER,
        profile: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@reminderapp.com',
            avatar: null
        }
    },
    'manager': {
        password: 'manager456',
        role: USER_ROLES.MANAGER,
        profile: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@reminderapp.com',
            avatar: null
        }
    }
};

/**
 * Reminder Categories and Priorities
 */
const REMINDER_CATEGORIES = {
    WORK: 'work',
    PERSONAL: 'personal',
    HEALTH: 'health',
    FINANCE: 'finance',
    EDUCATION: 'education',
    SOCIAL: 'social',
    OTHER: 'other'
};

const REMINDER_PRIORITIES = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    URGENT: 4
};

const REMINDER_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    OVERDUE: 'overdue'
};

/**
 * UI Constants
 */
const UI_CONSTANTS = {
    // Animation Durations
    ANIMATION: {
        FAST: 200,
        NORMAL: 300,
        SLOW: 500
    },

    // Breakpoints
    BREAKPOINTS: {
        MOBILE: 480,
        TABLET: 768,
        DESKTOP: 1024,
        LARGE: 1200
    },

    // Z-Index Layers
    Z_INDEX: {
        DROPDOWN: 1000,
        MODAL: 1050,
        TOOLTIP: 1100,
        NOTIFICATION: 1200
    },

    // Colors (matching CSS variables)
    COLORS: {
        PRIMARY: '#4CAF50',
        SECONDARY: '#2196F3',
        SUCCESS: '#4CAF50',
        WARNING: '#FF9800',
        DANGER: '#f44336',
        INFO: '#2196F3'
    }
};

/**
 * Validation Rules
 */
const VALIDATION_RULES = {
    USERNAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 20,
        PATTERN: /^[a-zA-Z0-9_]+$/,
        MESSAGE: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores'
    },
    PASSWORD: {
        MIN_LENGTH: 6,
        MAX_LENGTH: 50,
        PATTERN: /^(?=.*[a-zA-Z])(?=.*\d).+$/,
        MESSAGE: 'Password must be at least 6 characters long and contain both letters and numbers'
    },
    EMAIL: {
        PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        MESSAGE: 'Please enter a valid email address'
    },
    REMINDER_TITLE: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 100,
        MESSAGE: 'Reminder title must be between 1 and 100 characters'
    }
};

/**
 * Error Messages
 */
const ERROR_MESSAGES = {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid username or password',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    ACCESS_DENIED: 'You do not have permission to access this resource',

    // General
    NETWORK_ERROR: 'Network error. Please check your connection and try again.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
    VALIDATION_ERROR: 'Please correct the errors and try again.',

    // Data
    DATA_NOT_FOUND: 'The requested data was not found',
    DATA_LOAD_ERROR: 'Failed to load data. Please refresh the page.',
    DATA_SAVE_ERROR: 'Failed to save changes. Please try again.'
};

/**
 * Success Messages
 */
const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Welcome back! Login successful.',
    LOGOUT_SUCCESS: 'You have been logged out successfully.',
    DATA_SAVED: 'Changes saved successfully.',
    REMINDER_CREATED: 'Reminder created successfully.',
    REMINDER_UPDATED: 'Reminder updated successfully.',
    REMINDER_DELETED: 'Reminder deleted successfully.'
};

/**
 * Sample Data for Demo
 */
const SAMPLE_DATA = {
    REMINDERS: [
        {
            id: 1,
            title: 'Team Meeting',
            description: 'Weekly team sync meeting',
            datetime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
            category: REMINDER_CATEGORIES.WORK,
            priority: REMINDER_PRIORITIES.HIGH,
            status: REMINDER_STATUS.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 2,
            title: 'Doctor Appointment',
            description: 'Annual health checkup',
            datetime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            category: REMINDER_CATEGORIES.HEALTH,
            priority: REMINDER_PRIORITIES.MEDIUM,
            status: REMINDER_STATUS.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 3,
            title: 'Pay Bills',
            description: 'Monthly utility bills',
            datetime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
            category: REMINDER_CATEGORIES.FINANCE,
            priority: REMINDER_PRIORITIES.URGENT,
            status: REMINDER_STATUS.OVERDUE,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 4,
            title: 'Buy Groceries',
            description: 'Weekly grocery shopping',
            datetime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago (completed)
            category: REMINDER_CATEGORIES.PERSONAL,
            priority: REMINDER_PRIORITIES.LOW,
            status: REMINDER_STATUS.COMPLETED,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ],

    SCHEDULE: [
        {
            id: 1,
            time: '09:00',
            title: 'Morning Standup',
            description: 'Daily team standup meeting'
        },
        {
            id: 2,
            time: '14:00',
            title: 'Client Call',
            description: 'Project review with client'
        },
        {
            id: 3,
            time: '16:30',
            title: 'Code Review',
            description: 'Review pull requests'
        }
    ]
};

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APP_CONFIG,
        USER_ROLES,
        PERMISSIONS,
        DEMO_USERS,
        REMINDER_CATEGORIES,
        REMINDER_PRIORITIES,
        REMINDER_STATUS,
        UI_CONSTANTS,
        VALIDATION_RULES,
        ERROR_MESSAGES,
        SUCCESS_MESSAGES,
        SAMPLE_DATA
    };
}