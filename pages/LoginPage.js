export const LoginPageCorrected = `
/**
 * Login Page Component - Clean implementation with correct imports
 */
import { DOM } from '../utils/dom.js';
import { FormComponents, Button } from '../components/ui/Button.js';
import { ValidationUtils } from '../utils/validation.js';
import { showError, showSuccess, showInfo } from '../components/ui/Notification.js';
import { DEMO_USERS } from '../config/constants.js';
import { StringUtils } from '../utils/helpers.js';

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

  async #render() {
    const container = this.#createPageStructure();
    document.body.innerHTML = '';
    document.body.appendChild(container);
    this.#addThemeToggle();
    
    // Focus management
    setTimeout(() => {
      DOM.get('#username')?.focus();
    }, 100);
  }

  #createPageStructure() {
    return DOM.create('div', {
      className: 'login-page',
      innerHTML: \`
        \${this.#getPageStyles()}
        <div class="login-container">
          \${this.#createHeader()}
          <div id="messageContainer" class="message-container"></div>
          \${this.#createLoginForm()}
          \${this.#createDemoCredentials()}
          \${this.#createFooter()}
        </div>
        \${this.#createFloatingShapes()}
      \`
    });
  }

  async #handleLogin() {
    if (this.#isSubmitting) return;

    const formData = FormComponents.getFormData(this.#form);
    const credentials = {
      username: formData.username?.trim(),
      password: formData.password,
      rememberMe: formData.rememberMe === 'on'
    };

    this.#clearMessages();
    
    const validation = this.#validateCredentials(credentials);
    if (!validation.isValid) return;

    this.#setLoading(true);

    try {
      await AsyncUtils.delay(800); // UX improvement
      const session = await this.#app.getServices().auth.authenticate(credentials);
      this.#showMessage('Login successful! Redirecting...', 'success');
    } catch (error) {
      this.#showMessage(error.message, 'error');
      this.#clearPassword();
    } finally {
      this.#setLoading(false);
    }
  }

  cleanup() {
    this.#cleanupFunctions.forEach(cleanup => cleanup());
    this.#cleanupFunctions.clear();
    console.log('🧹 Login page cleaned up');
  }
}
`;