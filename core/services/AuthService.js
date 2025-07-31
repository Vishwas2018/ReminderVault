/**
 * Authentication Service - Handles user authentication and session management
 */

import { EventEmitter } from '../../utils/helpers.js';
import { LocalStorage } from '../../utils/storage.js';
import { APP_CONFIG, DEMO_USERS } from '../../config/constants.js';
import { ValidationError, createUserSession } from '../../types/interfaces.js';

export class AuthService extends EventEmitter {
  #currentUser = null;
  #sessionCheckInterval = null;

  constructor() {
    super();
    this.#setupSessionMonitoring();
  }

  // Authenticate user with credentials
  async authenticate(credentials) {
    const { username, password, rememberMe = false } = credentials;

    try {
      // Validate credentials format
      this.#validateCredentials(username, password);

      // Find user in demo users
      const user = this.#findUser(username, password);
      if (!user) {
        throw new ValidationError('credentials', 'Invalid username or password');
      }

      // Create session
      const session = createUserSession(user, rememberMe);

      // Store session
      LocalStorage.set(APP_CONFIG.storage.keys.USER_SESSION, session, {
        expires: session.expiresAt - Date.now()
      });

      LocalStorage.set(APP_CONFIG.storage.keys.LAST_LOGIN, new Date().toISOString());

      this.#currentUser = session;
      this.emit('authenticated', session);

      return session;
    } catch (error) {
      this.emit('authentication-failed', error);
      throw error;
    }
  }

  // Check if user is currently authenticated
  isAuthenticated() {
    if (this.#currentUser) return true;

    // Check stored session
    const session = this.#getStoredSession();
    if (session && this.#isSessionValid(session)) {
      this.#currentUser = session;
      return true;
    }

    return false;
  }

  // Get current user session
  getCurrentUser() {
    if (!this.isAuthenticated()) return null;
    return this.#currentUser;
  }

  // Logout current user
  logout() {
    const user = this.#currentUser;

    this.#currentUser = null;
    LocalStorage.remove(APP_CONFIG.storage.keys.USER_SESSION);

    this.emit('logout', user);
  }

  // Refresh session (extend expiration)
  refreshSession() {
    const session = this.#currentUser;
    if (!session) return false;

    const extendedSession = {
      ...session,
      expiresAt: Date.now() + (session.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
    };

    LocalStorage.set(APP_CONFIG.storage.keys.USER_SESSION, extendedSession, {
      expires: extendedSession.expiresAt - Date.now()
    });

    this.#currentUser = extendedSession;
    this.emit('session-refreshed', extendedSession);

    return true;
  }

  // Check session validity
  #isSessionValid(session) {
    if (!session?.username || !session?.expiresAt) return false;

    return Date.now() < session.expiresAt;
  }

  // Get stored session from localStorage
  #getStoredSession() {
    return LocalStorage.get(APP_CONFIG.storage.keys.USER_SESSION);
  }

  // Validate credential format
  #validateCredentials(username, password) {
    if (!username?.trim()) {
      throw new ValidationError('username', 'Username is required');
    }

    if (!password) {
      throw new ValidationError('password', 'Password is required');
    }
  }

  // Find user in demo users database
  #findUser(username, password) {
    const user = DEMO_USERS[username];
    return user?.password === password ? user : null;
  }

  // Setup automatic session monitoring
  #setupSessionMonitoring() {
    // Check session validity every 5 minutes
    this.#sessionCheckInterval = setInterval(() => {
      if (this.#currentUser && !this.#isSessionValid(this.#currentUser)) {
        this.emit('session-expired', this.#currentUser);
        this.logout();
      }
    }, 5 * 60 * 1000);

    // Monitor visibility changes to refresh session
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.#currentUser) {
        const storedSession = this.#getStoredSession();
        if (storedSession && this.#isSessionValid(storedSession)) {
          this.#currentUser = storedSession;
        } else if (this.#currentUser) {
          this.emit('session-expired', this.#currentUser);
          this.logout();
        }
      }
    });
  }

  // Cleanup when service is destroyed
  destroy() {
    if (this.#sessionCheckInterval) {
      clearInterval(this.#sessionCheckInterval);
      this.#sessionCheckInterval = null;
    }

    this.removeAllListeners();
  }

  // Get authentication statistics
  getAuthStats() {
    const lastLogin = LocalStorage.get(APP_CONFIG.storage.keys.LAST_LOGIN);

    return {
      isAuthenticated: this.isAuthenticated(),
      currentUser: this.getCurrentUser()?.username || null,
      lastLogin,
      sessionExpiry: this.#currentUser?.expiresAt || null,
      sessionType: this.#currentUser?.rememberMe ? 'persistent' : 'session'
    };
  }
}