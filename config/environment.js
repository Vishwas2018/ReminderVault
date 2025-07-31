/**
 * Environment Configuration - Runtime environment detection and configuration
 */

export class Environment {
  static #config = null;

  // Detect current environment
  static detect() {
    if (this.#config) return this.#config;

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    let environment = 'production';

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('local')) {
      environment = 'development';
    } else if (hostname.includes('staging') || hostname.includes('test')) {
      environment = 'staging';
    }

    this.#config = {
      name: environment,
      isDevelopment: environment === 'development',
      isStaging: environment === 'staging',
      isProduction: environment === 'production',
      isSecure: protocol === 'https:',
      hostname,
      protocol
    };

    return this.#config;
  }

  // Get environment-specific configuration
  static getConfig() {
    const env = this.detect();

    const baseConfig = {
      app: {
        name: 'Reminders Vault',
        version: '2.0.0',
        description: 'Modern task management application'
      },

      storage: {
        fallbackOrder: ['indexeddb', 'localstorage', 'memory'],
        quotaWarningThreshold: 0.8, // 80%
        cleanupThreshold: 0.9, // 90%
        maxRetries: 3
      },

      notifications: {
        requestPermissionOnStart: true,
        showBrowserNotifications: true,
        showCustomPopups: true,
        maxActivePopups: 3
      },

      ui: {
        theme: 'auto', // auto, light, dark
        animations: true,
        reducedMotion: false,
        autoSave: true,
        autoSaveDelay: 1000 // ms
      },

      performance: {
        enableMetrics: false,
        logSlowOperations: false,
        slowOperationThreshold: 1000 // ms
      },

      features: {
        offlineMode: true,
        exportImport: true,
        multipleAlerts: true,
        keyboardShortcuts: true
      }
    };

    // Environment-specific overrides
    const envConfigs = {
      development: {
        performance: {
          enableMetrics: true,
          logSlowOperations: true,
          slowOperationThreshold: 500
        },
        storage: {
          maxRetries: 1
        },
        ui: {
          autoSaveDelay: 2000
        }
      },

      staging: {
        performance: {
          enableMetrics: true,
          logSlowOperations: true
        },
        notifications: {
          requestPermissionOnStart: false
        }
      },

      production: {
        performance: {
          enableMetrics: false,
          logSlowOperations: false
        }
      }
    };

    // Merge configurations
    const envSpecific = envConfigs[env.name] || {};
    return this.#deepMerge(baseConfig, envSpecific);
  }

  // Feature flags
  static getFeatureFlags() {
    const env = this.detect();

    return {
      // Core features
      enableIndexedDB: true,
      enableServiceWorker: env.isProduction,
      enableOfflineMode: true,

      // UI features
      enableDarkMode: true,
      enableAnimations: !this.isReducedMotion(),
      enableSounds: true,

      // Development features
      enableDebugMode: env.isDevelopment,
      enablePerformanceMetrics: env.isDevelopment || env.isStaging,
      enableErrorBoundary: true,

      // Experimental features
      enableAdvancedSearch: true,
      enableBulkOperations: true,
      enableDataSync: false, // Future feature

      // Platform features
      enablePWA: env.isProduction,
      enableNotifications: this.hasNotificationSupport(),
      enableClipboard: this.hasClipboardSupport()
    };
  }

  // Browser capability detection
  static getBrowserCapabilities() {
    return {
      // Storage
      hasIndexedDB: 'indexedDB' in window,
      hasLocalStorage: this.#testStorage('localStorage'),
      hasSessionStorage: this.#testStorage('sessionStorage'),

      // APIs
      hasNotifications: 'Notification' in window,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasClipboard: 'clipboard' in navigator,
      hasWebAudio: 'AudioContext' in window || 'webkitAudioContext' in window,

      // Modern features
      hasES6Modules: true, // If this runs, modules are supported
      hasWebComponents: 'customElements' in window,
      hasIntersectionObserver: 'IntersectionObserver' in window,
      hasResizeObserver: 'ResizeObserver' in window,

      // Device capabilities
      isTouchDevice: this.#isTouchDevice(),
      isOnline: navigator.onLine,
      hasCamera: this.#hasMediaDevices(),

      // Performance
      hasRequestIdleCallback: 'requestIdleCallback' in window,
      hasPerformanceObserver: 'PerformanceObserver' in window
    };
  }

  // Device information
  static getDeviceInfo() {
    const userAgent = navigator.userAgent;

    return {
      userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages || [navigator.language],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Screen info
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,

      // Browser detection
      browser: this.#detectBrowser(),

      // Device type
      isMobile: this.#isMobile(),
      isTablet: this.#isTablet(),
      isDesktop: this.#isDesktop()
    };
  }

  // Accessibility preferences
  static getAccessibilityPreferences() {
    return {
      prefersReducedMotion: this.isReducedMotion(),
      prefersHighContrast: this.#prefersHighContrast(),
      prefersColorScheme: this.#getPreferredColorScheme()
    };
  }

  // Utility methods
  static isReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  static hasNotificationSupport() {
    return 'Notification' in window;
  }

  static hasClipboardSupport() {
    return 'clipboard' in navigator;
  }

  // Private methods
  static #testStorage(type) {
    try {
      const storage = window[type];
      const testKey = '__test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  static #isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  static #hasMediaDevices() {
    return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  }

  static #prefersHighContrast() {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }

  static #getPreferredColorScheme() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'no-preference';
  }

  static #detectBrowser() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
      return { name: 'Chrome', family: 'Chromium' };
    }
    if (userAgent.includes('Firefox')) {
      return { name: 'Firefox', family: 'Gecko' };
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return { name: 'Safari', family: 'WebKit' };
    }
    if (userAgent.includes('Edge')) {
      return { name: 'Edge', family: 'Chromium' };
    }
    if (userAgent.includes('Opera')) {
      return { name: 'Opera', family: 'Chromium' };
    }

    return { name: 'Unknown', family: 'Unknown' };
  }

  static #isMobile() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  static #isTablet() {
    return /iPad|Android/i.test(navigator.userAgent) && !this.#isMobile();
  }

  static #isDesktop() {
    return !this.#isMobile() && !this.#isTablet();
  }

  static #deepMerge(target, source) {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.#deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  // Runtime configuration
  static initialize() {
    const config = this.getConfig();
    const capabilities = this.getBrowserCapabilities();
    const device = this.getDeviceInfo();
    const accessibility = this.getAccessibilityPreferences();
    const features = this.getFeatureFlags();

    // Apply accessibility preferences
    if (accessibility.prefersReducedMotion) {
      config.ui.animations = false;
    }

    // Disable features based on capabilities
    if (!capabilities.hasNotifications) {
      config.notifications.showBrowserNotifications = false;
      features.enableNotifications = false;
    }

    if (!capabilities.hasIndexedDB) {
      config.storage.fallbackOrder = config.storage.fallbackOrder.filter(s => s !== 'indexeddb');
    }

    // Mobile optimizations
    if (device.isMobile) {
      config.ui.autoSaveDelay = 500; // Faster auto-save on mobile
      config.notifications.maxActivePopups = 1; // Fewer popups on mobile
    }

    return {
      environment: this.detect(),
      config,
      capabilities,
      device,
      accessibility,
      features
    };
  }
}