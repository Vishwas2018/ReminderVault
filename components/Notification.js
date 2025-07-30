/**
 * UI Notification Component - Toast notifications for user feedback
 * Modern, accessible toast notifications with animations
 */

import { DOM } from '../../utils/dom.js';
import { AsyncUtils } from '../../utils/helpers.js';

export class UINotification {
  constructor(message, type = 'info', options = {}) {
    this.message = message;
    this.type = type;
    this.options = {
      duration: options.duration || this._getDefaultDuration(type),
      position: options.position || 'top-right',
      closable: options.closable !== false,
      persistent: options.persistent || false,
      icon: options.icon || this._getDefaultIcon(type),
      actions: options.actions || [],
      ...options
    };

    this.element = null;
    this.isVisible = false;
    this.timeoutId = null;
  }

  _getDefaultDuration(type) {
    const durations = {
      success: 4000,
      error: 6000,
      warning: 5000,
      info: 4000
    };
    return durations[type] || 4000;
  }

  _getDefaultIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  create() {
    if (this.element) return this.element;

    this.element = DOM.create('div', {
      className: `notification notification-${this.type} notification-${this.options.position}`,
      attributes: {
        role: 'alert',
        'aria-live': this.type === 'error' ? 'assertive' : 'polite'
      }
    });

    // Create content
    const content = this._createContent();
    this.element.appendChild(content);

    return this.element;
  }

  _createContent() {
    const content = DOM.create('div', { className: 'notification-content' });

    // Icon
    if (this.options.icon) {
      const icon = DOM.create('div', {
        className: 'notification-icon',
        textContent: this.options.icon
      });
      content.appendChild(icon);
    }

    // Message container
    const messageContainer = DOM.create('div', { className: 'notification-message-container' });

    // Title (if provided)
    if (this.options.title) {
      const title = DOM.create('div', {
        className: 'notification-title',
        textContent: this.options.title
      });
      messageContainer.appendChild(title);
    }

    // Message
    const message = DOM.create('div', {
      className: 'notification-message',
      textContent: this.message
    });
    messageContainer.appendChild(message);

    content.appendChild(messageContainer);

    // Actions
    if (this.options.actions.length > 0) {
      const actionsContainer = DOM.create('div', { className: 'notification-actions' });

      this.options.actions.forEach(action => {
        const button = DOM.create('button', {
          className: `notification-action ${action.className || ''}`,
          textContent: action.text,
          events: {
            click: (e) => {
              e.preventDefault();
              if (action.handler) {
                action.handler(this);
              }
              if (action.dismiss !== false) {
                this.dismiss();
              }
            }
          }
        });
        actionsContainer.appendChild(button);
      });

      content.appendChild(actionsContainer);
    }

    // Close button
    if (this.options.closable) {
      const closeBtn = DOM.create('button', {
        className: 'notification-close',
        attributes: {
          type: 'button',
          'aria-label': 'Close notification'
        },
        innerHTML: '&times;',
        events: {
          click: () => this.dismiss()
        }
      });
      content.appendChild(closeBtn);
    }

    return content;
  }

  show() {
    if (this.isVisible) return this;

    if (!this.element) {
      this.create();
    }

    // Add to container
    const container = NotificationContainer.getInstance();
    container.add(this);

    // Show with animation
    this.element.style.transform = this._getInitialTransform();
    this.element.style.opacity = '0';

    // Trigger animation
    requestAnimationFrame(() => {
      this.element.style.transform = 'translateX(0)';
      this.element.style.opacity = '1';
    });

    this.isVisible = true;

    // Auto dismiss
    if (!this.options.persistent && this.options.duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.dismiss();
      }, this.options.duration);
    }

    return this;
  }

  dismiss() {
    if (!this.isVisible) return this;

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Animate out
    this.element.style.transform = this._getExitTransform();
    this.element.style.opacity = '0';

    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      this.isVisible = false;
    }, 300);

    return this;
  }

  _getInitialTransform() {
    const position = this.options.position;
    if (position.includes('right')) return 'translateX(100%)';
    if (position.includes('left')) return 'translateX(-100%)';
    if (position.includes('top')) return 'translateY(-100%)';
    if (position.includes('bottom')) return 'translateY(100%)';
    return 'scale(0.8)';
  }

  _getExitTransform() {
    return this._getInitialTransform();
  }

  // Update content
  updateMessage(message) {
    this.message = message;
    const messageElement = this.element?.querySelector('.notification-message');
    if (messageElement) {
      messageElement.textContent = message;
    }
    return this;
  }

  updateType(type) {
    if (this.element) {
      DOM.removeClass(this.element, `notification-${this.type}`);
      DOM.addClass(this.element, `notification-${type}`);
    }
    this.type = type;
    return this;
  }

  // Extend duration
  extend(additionalTime = 3000) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        this.dismiss();
      }, additionalTime);
    }
    return this;
  }
}

// Notification Container - Manages positioning and stacking
class NotificationContainer {
  static instance = null;

  constructor() {
    this.containers = new Map();
    this.notifications = new Set();
    this._createContainers();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new NotificationContainer();
    }
    return this.instance;
  }

  _createContainers() {
    const positions = [
      'top-left', 'top-center', 'top-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ];

    positions.forEach(position => {
      const container = DOM.create('div', {
        className: `notification-container notification-container-${position}`,
        attributes: { id: `notification-container-${position}` }
      });

      document.body.appendChild(container);
      this.containers.set(position, container);
    });

    this._addContainerStyles();
  }

  _addContainerStyles() {
    if (document.getElementById('notification-container-styles')) return;

    const styles = DOM.create('style', {
      attributes: { id: 'notification-container-styles' },
      textContent: `
        .notification-container {
          position: fixed;
          z-index: 10000;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 400px;
        }

        .notification-container-top-left {
          top: 20px;
          left: 20px;
        }

        .notification-container-top-center {
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
        }

        .notification-container-top-right {
          top: 20px;
          right: 20px;
        }

        .notification-container-bottom-left {
          bottom: 20px;
          left: 20px;
          flex-direction: column-reverse;
        }

        .notification-container-bottom-center {
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          flex-direction: column-reverse;
        }

        .notification-container-bottom-right {
          bottom: 20px;
          right: 20px;
          flex-direction: column-reverse;
        }

        .notification {
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          padding: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: auto;
          border-left: 4px solid;
          max-width: 100%;
          word-wrap: break-word;
        }

        .notification-success {
          border-left-color: #10b981;
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        }

        .notification-error {
          border-left-color: #ef4444;
          background: linear-gradient(135deg, #fef2f2, #fee2e2);
        }

        .notification-warning {
          border-left-color: #f59e0b;
          background: linear-gradient(135deg, #fffbeb, #fef3c7);
        }

        .notification-info {
          border-left-color: #3b82f6;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
        }

        .notification:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }

        .notification-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .notification-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .notification-message-container {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 4px;
          color: #1f2937;
        }

        .notification-message {
          font-size: 0.9rem;
          line-height: 1.4;
          color: #4b5563;
        }

        .notification-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
        }

        .notification-action {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .notification-action:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .notification-close {
          background: none;
          border: none;
          font-size: 1.2rem;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          margin-left: 8px;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .notification-close:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #374151;
        }

        @media (max-width: 768px) {
          .notification-container {
            left: 16px !important;
            right: 16px !important;
            max-width: none;
          }

          .notification-container-top-center,
          .notification-container-bottom-center {
            transform: none;
          }

          .notification {
            padding: 12px;
          }

          .notification-content {
            gap: 8px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .notification {
            transition: none;
          }

          .notification:hover {
            transform: none;
          }
        }
      `
    });

    document.head.appendChild(styles);
  }

  add(notification) {
    const container = this.containers.get(notification.options.position);
    if (container) {
      container.appendChild(notification.element);
      this.notifications.add(notification);
    }
  }

  remove(notification) {
    if (notification.element && notification.element.parentNode) {
      notification.element.parentNode.removeChild(notification.element);
    }
    this.notifications.delete(notification);
  }

  clear(position = null) {
    if (position) {
      const container = this.containers.get(position);
      if (container) {
        DOM.empty(container);
      }
    } else {
      this.containers.forEach(container => DOM.empty(container));
    }
    this.notifications.clear();
  }

  getNotifications() {
    return Array.from(this.notifications);
  }
}

// Convenience functions for common notification types
export const showNotification = (message, type = 'info', options = {}) => {
  const notification = new UINotification(message, type, options);
  notification.show();
  return notification;
};

export const showSuccess = (message, options = {}) => {
  return showNotification(message, 'success', options);
};

export const showError = (message, options = {}) => {
  return showNotification(message, 'error', options);
};

export const showWarning = (message, options = {}) => {
  return showNotification(message, 'warning', options);
};

export const showInfo = (message, options = {}) => {
  return showNotification(message, 'info', options);
};

// Clear all notifications
export const clearNotifications = (position = null) => {
  NotificationContainer.getInstance().clear(position);
};

export default {
  UINotification,
  NotificationContainer,
  showNotification,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  clearNotifications
};