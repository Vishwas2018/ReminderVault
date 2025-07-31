/**
 * Login Page Component - Extracted from HTML for better modularity
 */

import { DOM } from '../utils/dom.js';
import { FormComponents, Button } from '../components/ui/index.js';
import { ValidationUtils } from '../utils/validation.js';
import { showError, showSuccess, showInfo } from '../components/ui/Notification.js';
import { DEMO_USERS } from '../config/constants.js';

export class LoginPage {
  #app = null;
  #form = null;
  #isSubmitting = false;
  #cleanupFunctions = new Set();

  constructor(app) {
    this.#app = app;
  }

  async initialize() {
    await this.#render();
    this.#setupEventHandlers();
    this.#checkExistingSession();
    console.log('🔐 Login page initialized');
  }

  // Main render method
  async #render() {
    const container = this.#createPageStructure();

    // Clear body and add login page
    document.body.innerHTML = '';
    document.body.appendChild(container);

    // Add theme toggle
    this.#addThemeToggle();

    // Focus first input
    setTimeout(() => {
      const firstInput = document.querySelector('#username');
      firstInput?.focus();
    }, 100);
  }

  #createPageStructure() {
    return DOM.create('div', {
      className: 'login-page',
      innerHTML: `
        ${this.#getPageStyles()}
        <div class="login-container">
          ${this.#createHeader()}
          <div id="messageContainer" class="message-container"></div>
          ${this.#createLoginForm()}
          ${this.#createDemoCredentials()}
          ${this.#createFooter()}
        </div>
        ${this.#createFloatingShapes()}
      `
    });
  }

  #createHeader() {
    return `
      <header class="login-header">
        <h1>Reminders Vault</h1>
        <p>Sign in to manage your reminders with smart storage</p>
      </header>
    `;
  }

  #createLoginForm() {
    return `
      <form id="loginForm" class="login-form" novalidate>
        <div class="form-group">
          <label for="username">
            <span class="label-icon">👤</span>
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            required
            autocomplete="username"
            placeholder="Enter your username"
            class="form-input"
          >
        </div>

        <div class="form-group">
          <label for="password">
            <span class="label-icon">🔒</span>
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="current-password"
            placeholder="Enter your password"
            class="form-input"
          >
        </div>

        <div class="form-options">
          <label class="checkbox-container">
            <input type="checkbox" id="rememberMe" name="rememberMe">
            <span class="checkbox-label">Remember me for 30 days</span>
          </label>
        </div>

        <button type="submit" class="login-btn" id="loginBtn">
          <span class="btn-text">
            <span class="btn-icon">🔐</span>
            Sign In
          </span>
          <span class="btn-loader" style="display: none;">
            <span class="spinner"></span>
            Signing in...
          </span>
        </button>
      </form>
    `;
  }

  #createDemoCredentials() {
    const credentials = Object.values(DEMO_USERS).map(user => `
      <button
        type="button"
        class="credential-item"
        data-username="${user.username}"
        data-password="${user.password}"
        aria-label="Use ${user.username} demo account"
      >
        <div class="credential-avatar">${user.profile.avatar}</div>
        <div class="credential-info">
          <strong>${user.profile.firstName} ${user.profile.lastName}</strong>
          <span>${user.role === 'administrator' ? 'Full system access' :
                user.role === 'manager' ? 'Team management' : 'Basic features'}</span>
          <code>${user.username} / ${user.password}</code>
        </div>
      </button>
    `).join('');

    return `
      <section class="demo-credentials">
        <h2>Demo Accounts</h2>
        <p class="demo-description">Click any account below to auto-fill the login form</p>
        <div class="credentials-grid">
          ${credentials}
        </div>
      </section>
    `;
  }

  #createFooter() {
    return `
      <footer class="login-footer">
        <p>&copy; 2025 Reminders Vault. Modern task management with intelligent storage.</p>
      </footer>
    `;
  }

  #createFloatingShapes() {
    return `
      <div class="floating-shapes" aria-hidden="true">
        <div class="floating-shape shape-1"></div>
        <div class="floating-shape shape-2"></div>
        <div class="floating-shape shape-3"></div>
        <div class="floating-shape shape-4"></div>
      </div>
    `;
  }

  #addThemeToggle() {
    const toggle = DOM.create('button', {
      className: 'theme-toggle',
      innerHTML: '🌙',
      attributes: {
        'aria-label': 'Toggle theme',
        title: 'Toggle between light and dark theme'
      }
    });

    const cleanup = DOM.on(toggle, 'click', () => {
      this.#toggleTheme();
    });
    this.#cleanupFunctions.add(cleanup);

    document.body.appendChild(toggle);
  }

  #setupEventHandlers() {
    this.#form = document.getElementById('loginForm');

    // Form submission
    const submitCleanup = DOM.on(this.#form, 'submit', (e) => {
      e.preventDefault();
      this.#handleLogin();
    });
    this.#cleanupFunctions.add(submitCleanup);

    // Demo credentials
    const demoButtons = document.querySelectorAll('.credential-item');
    demoButtons.forEach(button => {
      const cleanup = DOM.on(button, 'click', () => {
        const username = button.dataset.username;
        const password = button.dataset.password;
        this.#fillCredentials(username, password);
      });
      this.#cleanupFunctions.add(cleanup);
    });

    // Real-time validation
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    const usernameCleanup = DOM.on(usernameInput, 'input', () => {
      FormComponents.clearFieldError(usernameInput);
    });
    this.#cleanupFunctions.add(usernameCleanup);

    const passwordCleanup = DOM.on(passwordInput, 'input', () => {
      FormComponents.clearFieldError(passwordInput);
    });
    this.#cleanupFunctions.add(passwordCleanup);

    // Enter key handling
    const enterCleanup = DOM.on(passwordInput, 'keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#handleLogin();
      }
    });
    this.#cleanupFunctions.add(enterCleanup);
  }

  async #handleLogin() {
    if (this.#isSubmitting) return;

    const formData = FormComponents.getFormData(this.#form);
    const credentials = {
      username: formData.username?.trim(),
      password: formData.password,
      rememberMe: formData.rememberMe === 'on'
    };

    // Clear previous messages
    this.#clearMessages();

    // Validate
    const validation = this.#validateCredentials(credentials);
    if (!validation.isValid) {
      return;
    }

    // Show loading state
    this.#setLoading(true);

    try {
      // Simulate network delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));

      // Authenticate through app's auth service
      const session = await this.#app.getServices().auth.authenticate(credentials);

      // Success feedback
      this.#showMessage('Login successful! Redirecting to dashboard...', 'success');

      // Navigation will be handled by auth service events in App class

    } catch (error) {
      this.#showMessage(error.message, 'error');
      this.#clearPassword();
    } finally {
      this.#setLoading(false);
    }
  }

  #validateCredentials(credentials) {
    const validation = ValidationUtils.validateUser(credentials);

    if (!validation.isValid) {
      Object.entries(validation.errors).forEach(([field, errors]) => {
        const input = document.getElementById(field);
        if (input && errors.length > 0) {
          FormComponents.showFieldError(input, errors[0].message || errors[0]);
        }
      });
    }

    return validation;
  }

  #fillCredentials(username, password) {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (usernameInput && passwordInput) {
      usernameInput.value = username;
      passwordInput.value = password;

      FormComponents.clearFieldError(usernameInput);
      FormComponents.clearFieldError(passwordInput);

      this.#showMessage(`Demo credentials filled for ${username}. Click "Sign In" to continue.`, 'info');

      // Focus login button
      document.getElementById('loginBtn')?.focus();
    }
  }

  #setLoading(isLoading) {
    this.#isSubmitting = isLoading;
    const loginBtn = document.getElementById('loginBtn');

    if (loginBtn) {
      Button.setLoading(loginBtn, isLoading, 'Signing in...');
    }
  }

  #showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const messageEl = DOM.create('div', {
      className: `message ${type}`,
      innerHTML: `
        <span class="message-icon">${icons[type]}</span>
        <span class="message-text">${this.#escapeHtml(message)}</span>
      `
    });

    container.innerHTML = '';
    container.appendChild(messageEl);
    container.classList.add('show');

    // Auto-hide after delay
    if (type === 'success' || type === 'info') {
      setTimeout(() => this.#clearMessages(), 3000);
    }
  }

  #clearMessages() {
    const container = document.getElementById('messageContainer');
    if (container) {
      container.innerHTML = '';
      container.classList.remove('show');
    }
  }

  #clearPassword() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
  }

  #toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);

    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
    }
  }

  #checkExistingSession() {
    const authService = this.#app.getServices().auth;
    if (authService.isAuthenticated()) {
      console.log('Existing session found, redirecting...');
      this.#app.navigateTo('/dashboard');
    }
  }

  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  #getPageStyles() {
    return `
      <style>
        .login-page {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
          overflow: hidden;
        }

        .message-container {
          margin-bottom: 1rem;
          display: none;
          animation: slideDown 0.4s ease;
        }

        .message-container.show {
          display: block;
        }

        .message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-weight: 500;
          backdrop-filter: blur(10px);
        }

        .message.success {
          background: rgba(16, 185, 129, 0.9);
          color: white;
        }

        .message.error {
          background: rgba(239, 68, 68, 0.9);
          color: white;
        }

        .message.info {
          background: rgba(59, 130, 246, 0.9);
          color: white;
        }

        .theme-toggle {
          position: fixed;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          font-size: 1.25rem;
          cursor: pointer;
          z-index: 1000;
          transition: all 0.3s ease;
        }

        .theme-toggle:hover {
          background: white;
          transform: scale(1.1);
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;
  }

  // Cleanup when page is destroyed
  cleanup() {
    this.#cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Login page cleanup error:', error);
      }
    });
    this.#cleanupFunctions.clear();

    console.log('🧹 Login page cleaned up');
  }
}