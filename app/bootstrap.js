/**
 * Application Bootstrap - Fixed entry point for the Reminders Vault application
 */

import { Environment } from '../config/environment.js';

// Global application instance
let appInstance = null;

/**
 * Bootstrap the application with comprehensive error handling
 */
export async function bootstrap() {
  try {
    console.log('🌟 Bootstrapping Reminders Vault...');

    // Check browser compatibility first
    const compatibility = await checkBrowserCompatibility();
    if (!compatibility.isCompatible) {
      return showCompatibilityError(compatibility.issues);
    }

    // Initialize environment
    const envConfig = Environment.initialize();
    console.log(`🏗️ Environment: ${envConfig.environment.name}`);

    // Dynamic import to avoid circular dependencies
    const { App } = await import('./App.js');

    // Initialize and start the application
    appInstance = new App();
    const initialized = await appInstance.initialize();

    if (!initialized) {
      throw new Error('Application initialization failed');
    }

    // Setup hot reload for development
    if (envConfig.environment.isDevelopment) {
      setupHotReload();
    }

    // Register global app instance for debugging
    if (envConfig.environment.isDevelopment) {
      window.app = appInstance;
    }

    console.log('🎉 Reminders Vault ready!');
    return appInstance;

  } catch (error) {
    console.error('💥 Bootstrap failed:', error);
    showBootstrapError(error);
    return null;
  }
}

/**
 * Check browser compatibility and capabilities
 */
async function checkBrowserCompatibility() {
  const issues = [];
  const warnings = [];

  // Essential features check
  const requiredFeatures = {
    'ES6 Modules': () => true, // If this runs, modules work
    'Promises': () => typeof Promise !== 'undefined',
    'Fetch API': () => typeof fetch !== 'undefined',
    'localStorage': () => testStorage('localStorage'),
    'JSON support': () => typeof JSON !== 'undefined',
    'Date API': () => !isNaN(new Date().getTime())
  };

  // Check each required feature
  for (const [name, check] of Object.entries(requiredFeatures)) {
    try {
      if (!check()) {
        issues.push(`Missing ${name}`);
      }
    } catch (error) {
      issues.push(`${name} check failed: ${error.message}`);
    }
  }

  // Check recommended features with fallback support
  const recommendedFeatures = {
    'IndexedDB': () => 'indexedDB' in window,
    'Notifications': () => 'Notification' in window,
    'Service Workers': () => 'serviceWorker' in navigator,
    'Web Audio': () => 'AudioContext' in window || 'webkitAudioContext' in window,
    'Clipboard API': () => 'clipboard' in navigator
  };

  for (const [name, check] of Object.entries(recommendedFeatures)) {
    try {
      if (!check()) {
        warnings.push(`${name} not available - some features may be limited`);
      }
    } catch (error) {
      warnings.push(`${name} check failed`);
    }
  }

  // Log warnings for development
  if (warnings.length > 0) {
    console.warn('⚠️ Feature warnings:', warnings);
  }

  return {
    isCompatible: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Test storage availability
 */
function testStorage(type) {
  try {
    const storage = window[type];
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Show browser compatibility error
 */
function showCompatibilityError(issues) {
  document.body.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem; text-align: center;
      font-family: system-ui, -apple-system, sans-serif; 
      background: linear-gradient(135deg, #fee2e2, #fecaca);
      color: #991b1b;
    ">
      <div style="max-width: 500px; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        <h1 style="margin-bottom: 1rem; color: #dc2626;">🚫 Browser Not Supported</h1>
        <p style="margin-bottom: 1rem;">Your browser is missing required features:</p>
        <ul style="text-align: left; margin: 1rem 0; padding-left: 1.5rem;">
          ${issues.map(issue => `<li style="margin: 0.5rem 0;">${issue}</li>`).join('')}
        </ul>
        <p style="margin-bottom: 1.5rem;"><strong>Please update your browser to continue.</strong></p>
        <div style="margin-bottom: 1.5rem;">
          <p style="margin-bottom: 0.5rem; font-weight: 600;">Recommended browsers:</p>
          <p style="font-size: 0.9rem;">Chrome 61+, Firefox 60+, Safari 11+, Edge 16+</p>
        </div>
        <button onclick="window.location.reload()" style="
          padding: 0.75rem 1.5rem; background: #dc2626; color: white; 
          border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;
          font-weight: 600; transition: background 0.2s;
        " onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
          🔄 Try Again
        </button>
      </div>
    </div>
  `;
}

/**
 * Show bootstrap error with recovery options
 */
function showBootstrapError(error) {
  const isStorageError = error.message.toLowerCase().includes('storage');
  const isNetworkError = error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('fetch');

  document.body.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem; text-align: center;
      font-family: system-ui, -apple-system, sans-serif; 
      background: linear-gradient(135deg, #fef3c7, #fed7aa);
      color: #92400e;
    ">
      <div style="max-width: 600px; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        <h1 style="margin-bottom: 1rem; color: #d97706;">⚠️ Application Failed to Start</h1>
        <p style="margin-bottom: 1rem;">Something went wrong during initialization:</p>
        
        ${isStorageError ? `
          <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #f59e0b;">
            <strong>Storage Issue Detected</strong>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">
              The application requires browser storage to function. This might be due to:
              <br>• Private/Incognito browsing mode
              <br>• Browser storage restrictions
              <br>• Storage quota exceeded
            </p>
          </div>
        ` : ''}

        ${isNetworkError ? `
          <div style="background: #dbeafe; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #3b82f6;">
            <strong>Network Issue Detected</strong>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">
              Failed to load application resources. Please check your internet connection.
            </p>
          </div>
        ` : ''}

        <pre style="
          background: #fef2f2; padding: 1rem; border-radius: 8px;
          margin: 1rem 0; text-align: left; overflow: auto;
          max-height: 200px; font-size: 0.8rem; color: #7f1d1d;
          border: 1px solid #fecaca;
        ">${error.message}</pre>

        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem;">
          <button onclick="window.location.reload()" style="
            padding: 0.75rem 1.5rem; background: #d97706; color: white;
            border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;
            font-weight: 600; transition: background 0.2s;
          " onmouseover="this.style.background='#b45309'" onmouseout="this.style.background='#d97706'">
            🔄 Reload Application
          </button>

          <button onclick="clearStorageAndReload()" style="
            padding: 0.75rem 1.5rem; background: #6b7280; color: white;
            border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;
            font-weight: 600; transition: background 0.2s;
          " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            🗑️ Clear Data & Reload
          </button>
        </div>

        <details style="margin-top: 2rem; text-align: left;">
          <summary style="cursor: pointer; font-weight: 600; color: #374151; margin-bottom: 1rem;">
            🔧 Troubleshooting Steps
          </summary>
          <ol style="margin: 0; line-height: 1.6; color: #4b5563;">
            <li>Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)</li>
            <li>Clear your browser cache and cookies</li>
            <li>Disable browser extensions temporarily</li>
            <li>Try using a different browser</li>
            <li>Check if you're in private/incognito mode</li>
            <li>Ensure JavaScript is enabled</li>
            <li>Check your internet connection</li>
            ${isStorageError ? '<li>Try exiting private/incognito mode</li>' : ''}
          </ol>
        </details>

        <div style="margin-top: 1.5rem; padding: 1rem; background: #f3f4f6; border-radius: 8px; font-size: 0.85rem; color: #4b5563;">
          <strong>Need Help?</strong> If the problem persists, this might be a browser compatibility issue. 
          Try using a modern browser like Chrome, Firefox, Safari, or Edge.
        </div>
      </div>
    </div>

    <script>
      function clearStorageAndReload() {
        try {
          // Clear all storage types
          localStorage.clear();
          sessionStorage.clear();

          // Clear IndexedDB if available
          if ('indexedDB' in window) {
            const deleteReq = indexedDB.deleteDatabase('RemindersVaultDB');
            deleteReq.onsuccess = () => console.log('IndexedDB cleared');
            deleteReq.onerror = () => console.log('Failed to clear IndexedDB');
          }

          // Clear caches if available
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => caches.delete(name));
            });
          }

          setTimeout(() => {
            window.location.reload(true);
          }, 1000);
        } catch (error) {
          console.error('Failed to clear storage:', error);
          window.location.reload();
        }
      }
    </script>
  `;
}

/**
 * Setup hot reload for development
 */
function setupHotReload() {
  // Hot module replacement support
  if (typeof module !== 'undefined' && module.hot) {
    module.hot.accept();
  }

  // Simple development auto-reload on focus
  let wasHidden = false;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && wasHidden) {
      // Optional: Auto-reload on focus in development
      // Uncomment the next line if you want this behavior
      // console.log('🔄 Development: Page focused, checking for updates...');
    }
    wasHidden = document.hidden;
  });

  console.log('🔥 Hot reload enabled for development');
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const shutdown = () => {
    if (appInstance && typeof appInstance.cleanup === 'function') {
      console.log('👋 Shutting down application gracefully...');
      try {
        appInstance.cleanup();
      } catch (error) {
        console.warn('Shutdown cleanup failed:', error);
      }
      appInstance = null;
    }
  };

  // Handle page unload
  window.addEventListener('beforeunload', shutdown);

  // Handle page visibility change (mobile apps)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && appInstance) {
      // Save last activity timestamp
      try {
        localStorage.setItem('app_last_activity', Date.now().toString());
      } catch {
        // Ignore storage errors during shutdown
      }
    }
  });

  // Handle app state changes (mobile)
  window.addEventListener('pagehide', shutdown);
}

/**
 * Initialize when DOM is ready with proper error handling
 */
function initializeWhenReady() {
  const init = async () => {
    try {
      await bootstrap();
    } catch (error) {
      console.error('Initialization failed:', error);
      showBootstrapError(error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already ready
    init();
  }
}

/**
 * Global error handling
 */
function setupGlobalErrorHandling() {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // Handle specific error types gracefully
    if (event.reason?.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded - this is handled by the storage system');
      event.preventDefault(); // Prevent default browser error
    } else if (event.reason?.code === 'MODULE_NOT_FOUND') {
      console.error('Module loading failed - this may be a network issue');
      showBootstrapError(new Error('Failed to load application modules. Please check your connection and try again.'));
      event.preventDefault();
    }
  });

  // Global JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);

    // Handle module loading errors specifically
    if (event.error?.message?.includes('module') ||
        event.error?.message?.includes('import') ||
        event.filename?.includes('.js')) {
      console.error('Module loading error detected');
      // Don't show error UI for every module error, let the bootstrap handle it
    }
  });

  console.log('🛡️ Global error handling initialized');
}

// Initialize error handling first
setupGlobalErrorHandling();

// Setup graceful shutdown
setupGracefulShutdown();

// Start the application
initializeWhenReady();

// Export for manual initialization if needed
export { App } from './App.js';
export default bootstrap;