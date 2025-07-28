// ===== APPLICATION CONFIGURATION - ES6 MODULE =====

/**
 * Environment configuration with fallbacks
 */
const ENV = {
    NODE_ENV: typeof process !== 'undefined' ? process.env.NODE_ENV : 'development',
    APP_VERSION: typeof process !== 'undefined' ? process.env.APP_VERSION : '1.0.0',
    API_BASE_URL: typeof process !== 'undefined' ? process.env.API_BASE_URL : '/api/v1',
    ENABLE_DEBUG: typeof process !== 'undefined' ? process.env.ENABLE_DEBUG === 'true' : true
};

/**
 * Application Configuration
 */
export const APP_CONFIG = Object.freeze({
    app: {
        name: 'Reminder Manager',
        version: ENV.APP_VERSION,
        environment: ENV.NODE_ENV,
        debug: ENV.ENABLE_DEBUG
    },

    storage: {
        keys: Object.freeze({
            USER_SESSION: 'reminder_app_user',
            USER_PREFERENCES: 'reminder_app_preferences',
            REMINDERS_DATA: 'reminder_app_data',
            LAST_LOGIN: 'reminder_app_last_login',
            APP_STATE: 'reminder_app_state'
        }),

        // Storage quotas and limits
        limits: Object.freeze({
            MAX_REMINDERS: 1000,
            MAX_REMINDER_TITLE_LENGTH: 100,
            MAX_REMINDER_DESCRIPTION_LENGTH: 500,
            MAX_STORAGE_SIZE: 5 * 1024 * 1024 // 5MB
        })
    },

    session: Object.freeze({
        timeout: 24 * 60 * 60 * 1000, // 24 hours
        rememberMeDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
        checkInterval: 5 * 60 * 1000, // 5 minutes
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutes
    }),

    api: Object.freeze({
        baseUrl: ENV.API_BASE_URL,
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,

        endpoints: Object.freeze({
            auth: {
                login: '/auth/login',
                logout: '/auth/logout',
                refresh: '/auth/refresh',
                profile: '/user/profile'
            },
            reminders: {
                base: '/reminders',
                create: '/reminders',
                update: '/reminders/:id',
                delete: '/reminders/:id',
                list: '/reminders'
            },
            dashboard: {
                stats: '/dashboard/stats',
                recent: '/dashboard/recent'
            }
        })
    }),

    pagination: Object.freeze({
        defaultPageSize: 10,
        maxPageSize: 100,
        pageSizes: [10, 25, 50, 100]
    }),

    dateTime: Object.freeze({
        formats: Object.freeze({
            display: 'MMM DD, YYYY',
            input: 'YYYY-MM-DD',
            dateTime: 'YYYY-MM-DD HH:mm',
            time: 'HH:mm',
            iso: 'YYYY-MM-DDTHH:mm:ss.sssZ'
        }),

        timezones: Object.freeze({
            default: 'UTC',
            user: Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || 'UTC'
        })
    }),

    notifications: Object.freeze({
        durations: Object.freeze({
            default: 5000,
            error: 8000,
            success: 3000,
            warning: 6000,
            info: 4000
        }),

        positions: Object.freeze({
            TOP_RIGHT: 'top-right',
            TOP_LEFT: 'top-left',
            BOTTOM_RIGHT: 'bottom-right',
            BOTTOM_LEFT: 'bottom-left'
        }),

        maxVisible: 5,
        enableSound: true,
        enableBrowserNotifications: true
    })
});

/**
 * User roles and permissions system
 */
export const USER_ROLES = Object.freeze({
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
    GUEST: 'guest'
});

export const PERMISSIONS = Object.freeze({
    [USER_ROLES.ADMIN]: Object.freeze([
        'reminders:create',
        'reminders:read',
        'reminders:update',
        'reminders:delete',
        'users:manage',
        'settings:manage',
        'analytics:view'
    ]),

    [USER_ROLES.MANAGER]: Object.freeze([
        'reminders:create',
        'reminders:read',
        'reminders:update',
        'reminders:delete',
        'team:view'
    ]),

    [USER_ROLES.USER]: Object.freeze([
        'reminders:create',
        'reminders:read',
        'reminders:update',
        'profile:update'
    ]),

    [USER_ROLES.GUEST]: Object.freeze([
        'reminders:read'
    ])
});

/**
 * Demo users with enhanced security (for development only)
 */
export const DEMO_USERS = Object.freeze({
    admin: Object.freeze({
        id: 'demo_admin_001',
        password: 'password123', // In production, this would be hashed
        role: USER_ROLES.ADMIN,
        profile: Object.freeze({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@reminderapp.com',
            avatar: null,
            theme: 'light',
            notifications: true,
            timezone: 'UTC'
        }),
        permissions: PERMISSIONS[USER_ROLES.ADMIN],
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
    }),

    user: Object.freeze({
        id: 'demo_user_001',
        password: 'userpass123',
        role: USER_ROLES.USER,
        profile: Object.freeze({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@reminderapp.com',
            avatar: null,
            theme: 'light',
            notifications: true,
            timezone: 'America/New_York'
        }),
        permissions: PERMISSIONS[USER_ROLES.USER],
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
    }),

    manager: Object.freeze({
        id: 'demo_manager_001',
        password: 'manager456',
        role: USER_ROLES.MANAGER,
        profile: Object.freeze({
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@reminderapp.com',
            avatar: null,
            theme: 'dark',
            notifications: true,
            timezone: 'Europe/London'
        }),
        permissions: PERMISSIONS[USER_ROLES.MANAGER],
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
    })
});

/**
 * Reminder system constants
 */
export const REMINDER_CATEGORIES = Object.freeze({
    WORK: 'work',
    PERSONAL: 'personal',
    HEALTH: 'health',
    FINANCE: 'finance',
    EDUCATION: 'education',
    SOCIAL: 'social',
    OTHER: 'other'
});

export const REMINDER_PRIORITIES = Object.freeze({
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    URGENT: 4
});

export const REMINDER_STATUS = Object.freeze({
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    OVERDUE: 'overdue',
    SNOOZED: 'snoozed'
});

/**
 * Enhanced reminder configuration
 */
export const REMINDER_CONFIG = Object.freeze({
    categories: Object.freeze({
        [REMINDER_CATEGORIES.WORK]: Object.freeze({
            label: 'Work',
            icon: '💼',
            color: '#3B82F6',
            defaultPriority: REMINDER_PRIORITIES.MEDIUM
        }),
        [REMINDER_CATEGORIES.PERSONAL]: Object.freeze({
            label: 'Personal',
            icon: '👤',
            color: '#10B981',
            defaultPriority: REMINDER_PRIORITIES.LOW
        }),
        [REMINDER_CATEGORIES.HEALTH]: Object.freeze({
            label: 'Health',
            icon: '🏥',
            color: '#EF4444',
            defaultPriority: REMINDER_PRIORITIES.HIGH
        }),
        [REMINDER_CATEGORIES.FINANCE]: Object.freeze({
            label: 'Finance',
            icon: '💰',
            color: '#F59E0B',
            defaultPriority: REMINDER_PRIORITIES.MEDIUM
        }),
        [REMINDER_CATEGORIES.EDUCATION]: Object.freeze({
            label: 'Education',
            icon: '📚',
            color: '#8B5CF6',
            defaultPriority: REMINDER_PRIORITIES.MEDIUM
        }),
        [REMINDER_CATEGORIES.SOCIAL]: Object.freeze({
            label: 'Social',
            icon: '👥',
            color: '#EC4899',
            defaultPriority: REMINDER_PRIORITIES.LOW
        }),
        [REMINDER_CATEGORIES.OTHER]: Object.freeze({
            label: 'Other',
            icon: '📦',
            color: '#6B7280',
            defaultPriority: REMINDER_PRIORITIES.LOW
        })
    }),

    priorities: Object.freeze({
        [REMINDER_PRIORITIES.LOW]: Object.freeze({
            label: 'Low',
            icon: '🔵',
            color: '#3B82F6',
            urgencyScore: 1
        }),
        [REMINDER_PRIORITIES.MEDIUM]: Object.freeze({
            label: 'Medium',
            icon: '🟡',
            color: '#F59E0B',
            urgencyScore: 2
        }),
        [REMINDER_PRIORITIES.HIGH]: Object.freeze({
            label: 'High',
            icon: '🟠',
            color: '#F97316',
            urgencyScore: 3
        }),
        [REMINDER_PRIORITIES.URGENT]: Object.freeze({
            label: 'Urgent',
            icon: '🔴',
            color: '#EF4444',
            urgencyScore: 4
        })
    }),

    statuses: Object.freeze({
        [REMINDER_STATUS.PENDING]: Object.freeze({
            label: 'Pending',
            icon: '🟡',
            color: '#F59E0B'
        }),
        [REMINDER_STATUS.ACTIVE]: Object.freeze({
            label: 'Active',
            icon: '🟢',
            color: '#10B981'
        }),
        [REMINDER_STATUS.COMPLETED]: Object.freeze({
            label: 'Completed',
            icon: '✅',
            color: '#059669'
        }),
        [REMINDER_STATUS.CANCELLED]: Object.freeze({
            label: 'Cancelled',
            icon: '❌',
            color: '#6B7280'
        }),
        [REMINDER_STATUS.OVERDUE]: Object.freeze({
            label: 'Overdue',
            icon: '🔴',
            color: '#EF4444'
        }),
        [REMINDER_STATUS.SNOOZED]: Object.freeze({
            label: 'Snoozed',
            icon: '😴',
            color: '#8B5CF6'
        })
    }),

    snoozeOptions: Object.freeze([
        { label: '5 minutes', minutes: 5 },
        { label: '15 minutes', minutes: 15 },
        { label: '30 minutes', minutes: 30 },
        { label: '1 hour', minutes: 60 },
        { label: '2 hours', minutes: 120 },
        { label: '4 hours', minutes: 240 },
        { label: 'Tomorrow', hours: 24 },
        { label: 'Next week', days: 7 }
    ])
});

/**
 * UI Constants with design tokens
 */
export const UI_CONSTANTS = Object.freeze({
    animation: Object.freeze({
        fast: 150,
        normal: 300,
        slow: 500,
        slower: 750
    }),

    breakpoints: Object.freeze({
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        large: 1200,
        xlarge: 1440
    }),

    zIndex: Object.freeze({
        dropdown: 1000,
        sticky: 1020,
        fixed: 1030,
        modalBackdrop: 1040,
        modal: 1050,
        popover: 1060,
        tooltip: 1070,
        toast: 1080,
        notification: 1090
    }),

    colors: Object.freeze({
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        light: '#F8FAFC',
        dark: '#1E293B'
    }),

    spacing: Object.freeze({
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        xxl: '3rem'
    }),

    typography: Object.freeze({
        fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'Monaco', 'monospace']
        },

        fontSize: Object.freeze({
            xs: '0.75rem',
            sm: '0.875rem',
            base: '1rem',
            lg: '1.125rem',
            xl: '1.25rem',
            '2xl': '1.5rem',
            '3xl': '1.875rem',
            '4xl': '2.25rem'
        })
    })
});

/**
 * Enhanced validation rules with better patterns
 */
export const VALIDATION_RULES = Object.freeze({
    username: Object.freeze({
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_-]+$/,
        message: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'
    }),

    password: Object.freeze({
        minLength: 6,
        maxLength: 128,
        pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
        message: 'Password must be at least 6 characters with letters and numbers'
    }),

    email: Object.freeze({
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email address'
    }),

    reminderTitle: Object.freeze({
        minLength: 1,
        maxLength: APP_CONFIG.storage.limits.MAX_REMINDER_TITLE_LENGTH,
        message: `Title must be 1-${APP_CONFIG.storage.limits.MAX_REMINDER_TITLE_LENGTH} characters`
    }),

    reminderDescription: Object.freeze({
        maxLength: APP_CONFIG.storage.limits.MAX_REMINDER_DESCRIPTION_LENGTH,
        message: `Description must be less than ${APP_CONFIG.storage.limits.MAX_REMINDER_DESCRIPTION_LENGTH} characters`
    })
});

/**
 * Application messages with i18n support structure
 */
export const MESSAGES = Object.freeze({
    errors: Object.freeze({
        auth: Object.freeze({
            invalidCredentials: 'Invalid username or password',
            sessionExpired: 'Your session has expired. Please log in again.',
            accessDenied: 'You do not have permission to access this resource',
            tooManyAttempts: 'Too many login attempts. Please try again later.',
            accountLocked: 'Account temporarily locked due to multiple failed attempts'
        }),

        general: Object.freeze({
            networkError: 'Network error. Please check your connection and try again.',
            unknownError: 'An unexpected error occurred. Please try again.',
            validationError: 'Please correct the errors and try again.',
            storageQuotaExceeded: 'Storage limit exceeded. Please delete some data.'
        }),

        data: Object.freeze({
            notFound: 'The requested data was not found',
            loadError: 'Failed to load data. Please refresh the page.',
            saveError: 'Failed to save changes. Please try again.',
            deleteError: 'Failed to delete item. Please try again.'
        })
    }),

    success: Object.freeze({
        auth: Object.freeze({
            loginSuccess: 'Welcome! Login successful.',
            logoutSuccess: 'You have been logged out successfully.'
        }),

        data: Object.freeze({
            saved: 'Changes saved successfully.',
            reminderCreated: 'Reminder created successfully.',
            reminderUpdated: 'Reminder updated successfully.',
            reminderDeleted: 'Reminder deleted successfully.',
            reminderCompleted: 'Reminder marked as completed!',
            reminderReactivated: 'Reminder reactivated successfully!'
        })
    }),

    info: Object.freeze({
        loading: 'Loading...',
        saving: 'Saving...',
        processing: 'Processing...',
        offline: 'You are currently offline. Changes will sync when reconnected.'
    })
});

/**
 * Sample data for demo/testing
 */
export const SAMPLE_DATA = Object.freeze({
    reminders: Object.freeze([
        Object.freeze({
            id: 1,
            title: 'Team Meeting',
            description: 'Weekly team sync meeting to discuss project progress',
            datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.WORK,
            priority: REMINDER_PRIORITIES.HIGH,
            status: REMINDER_STATUS.ACTIVE,
            notification: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'demo_user_001'
        }),

        Object.freeze({
            id: 2,
            title: 'Doctor Appointment',
            description: 'Annual health checkup with Dr. Smith',
            datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.HEALTH,
            priority: REMINDER_PRIORITIES.MEDIUM,
            status: REMINDER_STATUS.ACTIVE,
            notification: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'demo_user_001'
        }),

        Object.freeze({
            id: 3,
            title: 'Pay Utility Bills',
            description: 'Monthly electricity, water, and internet bills',
            datetime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.FINANCE,
            priority: REMINDER_PRIORITIES.URGENT,
            status: REMINDER_STATUS.OVERDUE,
            notification: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'demo_user_001'
        }),

        Object.freeze({
            id: 4,
            title: 'Buy Groceries',
            description: 'Weekly grocery shopping - milk, bread, vegetables',
            datetime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            category: REMINDER_CATEGORIES.PERSONAL,
            priority: REMINDER_PRIORITIES.LOW,
            status: REMINDER_STATUS.COMPLETED,
            notification: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'demo_user_001'
        })
    ]),

    schedule: Object.freeze([
        Object.freeze({
            id: 1,
            time: '09:00',
            title: 'Morning Standup',
            description: 'Daily team standup meeting',
            type: 'meeting',
            duration: 30
        }),

        Object.freeze({
            id: 2,
            time: '14:00',
            title: 'Client Call',
            description: 'Project review with client',
            type: 'call',
            duration: 60
        }),

        Object.freeze({
            id: 3,
            time: '16:30',
            title: 'Code Review',
            description: 'Review pull requests and provide feedback',
            type: 'review',
            duration: 45
        })
    ])
});

/**
 * Feature flags for progressive feature rollout
 */
export const FEATURE_FLAGS = Object.freeze({
    enableOfflineMode: ENV.NODE_ENV === 'development',
    enableAdvancedNotifications: true,
    enableThemes: true,
    enableAnalytics: ENV.NODE_ENV === 'production',
    enableCollaboration: false,
    enableCalendarIntegration: false,
    enableVoiceReminders: false
});

/**
 * Performance and optimization constants
 */
export const PERFORMANCE_CONFIG = Object.freeze({
    debounceDelay: 300,
    throttleDelay: 100,
    virtualScrollThreshold: 100,
    imageLoadingThreshold: 3,
    maxConcurrentRequests: 6,
    cacheExpiration: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3
});

/**
 * Utility function to get configuration by environment
 */
export const getConfig = (key, defaultValue = null) => {
    const keys = key.split('.');
    let current = { APP_CONFIG };

    for (const k of keys) {
        current = current[k];
        if (current === undefined) return defaultValue;
    }

    return current;
};

/**
 * Validate configuration on module load
 */
const validateConfig = () => {
    const requiredKeys = [
        'app.name',
        'app.version',
        'storage.keys.USER_SESSION',
        'storage.keys.REMINDERS_DATA'
    ];

    const missing = requiredKeys.filter(key => !getConfig(key));

    if (missing.length > 0) {
        console.error('Missing required configuration keys:', missing);
        throw new Error(`Invalid configuration: missing keys ${missing.join(', ')}`);
    }
};

// Validate configuration on import
validateConfig();

// Default export for convenience
export default {
    APP_CONFIG,
    USER_ROLES,
    PERMISSIONS,
    DEMO_USERS,
    REMINDER_CATEGORIES,
    REMINDER_PRIORITIES,
    REMINDER_STATUS,
    REMINDER_CONFIG,
    UI_CONSTANTS,
    VALIDATION_RULES,
    MESSAGES,
    SAMPLE_DATA,
    FEATURE_FLAGS,
    PERFORMANCE_CONFIG,
    getConfig
};