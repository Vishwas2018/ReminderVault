/**
 * Application Bootstrap - Entry point for the Reminders Vault application
 */

import { App } from './App.js';
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

    // Initialize and start the application
    appInstance = new App();
    const initialized = await appInstance.initialize();

    if (!initialized) {
      throw new Error('Application initialization failed');
    }

    // Setup hot reload for development
    if (Environment.detect().isDevelopment) {
      setupHotReload();
    }

    // Register global app instance
    window.app = appInstance;

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

  // Essential features check
  const requiredFeatures = {
    'ES6 Modules': () => true, // If this runs, modules work
    'Promises': () => typeof Promise !== 'undefined',
    'Fetch API': () => typeof fetch !== 'undefined',
    'localStorage': () => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    },
    'JSON support': () => typeof JSON !== 'undefined'
  };

  // Check each required feature
  Object.entries(requiredFeatures).forEach(([name, check]) => {
    try {
      if (!check()) {
        issues.push(`Missing ${name}`);
      }
    } catch (error) {
      issues.push(`${name} check failed: ${error.message}`);
    }
  });

  // Check recommended features
  const recommendedFeatures = {
    'IndexedDB': () => 'indexedDB' in window,
    'Notifications': () => 'Notification' in window,
    'Service Workers': () => 'serviceWorker' in navigator
  };

  const warnings = [];
  Object.entries(recommendedFeatures).forEach(([name, check]) => {
    try {
      if (!check()) {
        warnings.push(`${name} not available - some features may be limited`);
      }
    } catch (error) {
      warnings.push(`${name} check failed`);
    }
  });

  return {
    isCompatible: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Show browser compatibility error
 */
function showCompatibilityError(issues) {
  document.body.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem; text-align: center;
      font-family: system-ui, sans-serif; background: #fee; color: #c66;
    ">
      <div style="max-width: 500px;">
        <h1>🚫 Browser Not Supported</h1>
        <p>Your browser is missing required features:</p>
        <ul style="text-align: left; margin: 1rem 0;">
          ${issues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
        <p><strong>Please update your browser to continue.</strong></p>
        <div style="margin-top: 2rem;">
          <p>Recommended browsers:</p>
          <p>Chrome 61+, Firefox 60+, Safari 11+, Edge 16+</p>
        </div>
        <button onclick="window.location.reload()" style="
          margin-top: 1rem; padding: 0.75rem 1.5rem;
          background: #c66; color: white; border: none;
          border-radius: 4px; cursor: pointer; font-size: 1rem;
        ">
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
  document.body.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem; text-align: center;
      font-family: system-ui, sans-serif; background: #fee; color: #c66;
    ">
      <div style="max-width: 600px;">
        <h1>⚠️ Application Failed to Start</h1>
        <p>Something went wrong during initialization:</p>
        <pre style="
          background: #fdd; padding: 1rem; border-radius: 4px;
          margin: 1rem 0; text-align: left; overflow: auto;
          max-height: 200px; font-size: 0.875rem;
        ">${error.message}</pre>

        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.location.reload()" style="
            padding: 0.75rem 1.5rem; background: #c66; color: white;
            border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;
          ">
            🔄 Reload Application
          </button>

          <button onclick="clearStorageAndReload()" style="
            padding: 0.75rem 1.5rem; background: #666; color: white;
            border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;
          ">
            🗑️ Clear Data & Reload
          </button>
        </div>

        <details style="margin-top: 2rem; text-align: left;">
          <summary style="cursor: pointer; font-weight: bold;">
            🔧 Troubleshooting Steps
          </summary>
          <ol style="margin-top: 1rem; line-height: 1.6;">
            <li>Try refreshing the page</li>
            <li>Clear your browser cache and cookies</li>
            <li>Disable browser extensions temporarily</li>
            <li>Check if you're in private/incognito mode</li>
            <li>Try a different browser</li>
            <li>Check your internet connection</li>
          </ol>
        </details>
      </div>
    </div>

    <script>
      function clearStorageAndReload() {
        try {
          localStorage.clear();
          sessionStorage.clear();

          if ('indexedDB' in window) {
            indexedDB.deleteDatabase('RemindersVaultDB');
          }

          setTimeout(() => window.location.reload(), 500);
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
  if (typeof module !== 'undefined' && module.hot) {
    module.hot.accept();
  }

  // Simple page visibility reload for development
  let reloadOnFocus = false;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && reloadOnFocus) {
      console.log('🔄 Development: Reloading on focus');
      window.location.reload();
    }
    reloadOnFocus = document.hidden;
  });
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const shutdown = () => {
    if (appInstance) {
      console.log('👋 Shutting down application...');
      appInstance.destroy();
      appInstance = null;
    }
  };

  // Handle page unload
  window.addEventListener('beforeunload', shutdown);

  // Handle page visibility change (mobile)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Save state before going to background
      if (appInstance) {
        localStorage.setItem('last_activity', Date.now().toString());
      }
    }
  });
}

/**
 * Initialize when DOM is ready
 */
function initializeWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

// Setup graceful shutdown
setupGracefulShutdown();

// Start the application
initializeWhenReady();

// Export for manual initialization if needed
export { App };
export default bootstrap;