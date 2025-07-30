/**
 * Application Constants
 * Central configuration for the Reminders Vault application
 */

export const APP_CONFIG = Object.freeze({
    name: 'Reminders Vault',
    version: '2.0.0',

    storage: {
        keys: {
            USER_SESSION: 'user_session',
            LAST_LOGIN: 'last_login',
            USER_PREFERENCES: 'user_preferences',
            THEME: 'app_theme'
        },
        dbName: 'RemindersVaultDB',
        dbVersion: 1,
        maxStorageSize: 5 * 1024 * 1024, // 5MB
        backupInterval: 24 * 60 * 60 * 1000 // 24 hours
    },

    ui: {
        itemsPerPage: 10,
        maxTitleLength: 100,
        maxDescriptionLength: 500,
        animationDuration: 300,
        debounceDelay: 300
    },

    notifications: {
        maxActiveNotifications: 5,
        defaultAlertTimings: [5, 15],
        autoRefreshInterval: 60000,
        permissionRetryDelay: 30000
    },

    performance: {
        maxConcurrentRequests: 10,
        requestTimeout: 15000,
        memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
        performanceThreshold: 1000 // 1 second
    }
});

export const REMINDER_CONFIG = Object.freeze({
    status: {
        ACTIVE: 'active',
        COMPLETED: 'completed',
        OVERDUE: 'overdue',
        CANCELLED: 'cancelled'
    },

    priority: {
        LOW: { value: 1, label: 'Low', icon: '🔵', color: '#3498db' },
        MEDIUM: { value: 2, label: 'Medium', icon: '🟡', color: '#f39c12' },
        HIGH: { value: 3, label: 'High', icon: '🟠', color: '#e67e22' },
        URGENT: { value: 4, label: 'Urgent', icon: '🔴', color: '#e74c3c' }
    },

    categories: {
        PERSONAL: 'personal',
        WORK: 'work',
        HEALTH: 'health',
        FINANCE: 'finance',
        EDUCATION: 'education',
        SOCIAL: 'social',
        OTHER: 'other'
    },

    alertTimings: {
        FIVE_MINUTES: { value: 5, label: '5 minutes before', icon: '⏰' },
        FIFTEEN_MINUTES: { value: 15, label: '15 minutes before', icon: '⏰' },
        THIRTY_MINUTES: { value: 30, label: '30 minutes before', icon: '⏰' },
        ONE_HOUR: { value: 60, label: '1 hour before', icon: '🕐' },
        TWO_HOURS: { value: 120, label: '2 hours before', icon: '🕐' },
        ONE_DAY: { value: 1440, label: '1 day before', icon: '📅' },
        TWO_DAYS: { value: 2880, label: '2 days before', icon: '📅' }
    }
});

export const VALIDATION_RULES = Object.freeze({
    reminder: {
        title: {
            required: true,
            minLength: 1,
            maxLength: 100
        },
        description: {
            required: false,
            maxLength: 500
        },
        datetime: {
            required: true,
            minDate: () => new Date()
        },
        priority: {
            required: true,
            allowedValues: Object.values(REMINDER_CONFIG.priority).map(p => p.value)
        },
        category: {
            required: true,
            allowedValues: Object.values(REMINDER_CONFIG.categories)
        }
    },

    user: {
        username: {
            required: true,
            minLength: 3,
            maxLength: 20,
            pattern: /^[a-zA-Z0-9_-]+$/
        },
        password: {
            required: true,
            minLength: 6,
            maxLength: 128
        }
    }
});

export const UI_MESSAGES = Object.freeze({
    success: {
        reminderCreated: 'Reminder created successfully!',
        reminderUpdated: 'Reminder updated successfully!',
        reminderDeleted: 'Reminder deleted successfully!',
        dataExported: 'Data exported successfully!',
        dataImported: 'Data imported successfully!',
        loginSuccess: 'Login successful!'
    },

    error: {
        reminderCreateFailed: 'Failed to create reminder',
        reminderUpdateFailed: 'Failed to update reminder',
        reminderDeleteFailed: 'Failed to delete reminder',
        dataExportFailed: 'Failed to export data',
        dataImportFailed: 'Failed to import data',
        loginFailed: 'Login failed',
        storageUnavailable: 'Storage not available',
        networkError: 'Network error occurred'
    },

    warning: {
        storageQuotaExceeded: 'Storage quota exceeded',
        notificationPermissionDenied: 'Notification permission denied',
        unsavedChanges: 'You have unsaved changes'
    },

    info: {
        noReminders: 'No reminders found',
        loadingData: 'Loading data...',
        savingData: 'Saving data...',
        testNotification: 'Test notification sent'
    }
});

export const ERROR_CODES = Object.freeze({
    STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    TIMEOUT: 'TIMEOUT'
});

export const DEMO_USERS = Object.freeze({
    admin: {
        id: 'admin',
        username: 'admin',
        password: 'password123',
        role: 'administrator',
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            avatar: '👑'
        }
    },
    user: {
        id: 'user',
        username: 'user',
        password: 'userpass123',
        role: 'user',
        profile: {
            firstName: 'Standard',
            lastName: 'User',
            email: 'user@example.com',
            avatar: '👤'
        }
    },
    manager: {
        id: 'manager',
        username: 'manager',
        password: 'manager456',
        role: 'manager',
        profile: {
            firstName: 'Team',
            lastName: 'Manager',
            email: 'manager@example.com',
            avatar: '👥'
        }
    }
});

export const SAMPLE_DATA = Object.freeze({
    reminders: [
        {
            title: 'Team meeting with product team',
            description: 'Discuss quarterly roadmap and feature priorities',
            datetime: () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CONFIG.categories.WORK,
            priority: REMINDER_CONFIG.priority.HIGH.value,
            status: REMINDER_CONFIG.status.ACTIVE,
            notification: true,
            alertTimings: [15, 60]
        },
        {
            title: 'Test Multi-Alert Notification',
            description: 'This reminder will trigger multiple alerts for testing',
            datetime: () => new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            category: REMINDER_CONFIG.categories.PERSONAL,
            priority: REMINDER_CONFIG.priority.URGENT.value,
            status: REMINDER_CONFIG.status.ACTIVE,
            notification: true,
            alertTimings: [5, 15, 30]
        }
    ],

    schedule: [
        { id: 1, time: '09:00', title: 'Daily standup', description: 'Team sync meeting' },
        { id: 2, time: '11:30', title: 'Client presentation', description: 'Present new features' }
    ]
});

export default {
    APP_CONFIG,
    REMINDER_CONFIG,
    VALIDATION_RULES,
    UI_MESSAGES,
    ERROR_CODES,
    DEMO_USERS,
    SAMPLE_DATA
};