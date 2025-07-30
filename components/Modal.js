/**
 * Modal Component - Reusable modal dialog
 * Modern, accessible modal with proper focus management
 */

import { DOM, Keyboard } from '../../utils/dom.js';
import { EventEmitter } from '../../utils/helpers.js';

export class Modal extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      id: options.id || `modal-${Date.now()}`,
      title: options.title || '',
      size: options.size || 'medium', // small, medium, large, fullscreen
      closable: options.closable !== false,
      backdrop: options.backdrop !== false,
      keyboard: options.keyboard !== false,
      focus: options.focus !== false,
      autoDestroy: options.autoDestroy !== false,
      cssClass: options.cssClass || '',
      ...options
    };

    this.element = null;
    this.isOpen = false;
    this.previousFocus = null;
    this.cleanupFunctions = new Set();
  }

  // Create modal element
  create() {
    if (this.element) return this.element;

    this.element = DOM.create('div', {
      className: `modal ${this.options.cssClass}`,
      attributes: {
        id: this.options.id,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': `${this.options.id}-title`,
        tabindex: '-1'
      },
      styles: { display: 'none' }
    });

    const content = this._createContent();
    this.element.appendChild(content);

    // Add to DOM
    document.body.appendChild(this.element);

    // Setup event listeners
    this._setupEventListeners();

    return this.element;
  }

  _createContent() {
    const sizes = {
      small: 'max-width: 400px',
      medium: 'max-width: 600px',
      large: 'max-width: 800px',
      fullscreen: 'width: 100vw; height: 100vh; max-width: none'
    };

    const content = DOM.create('div', {
      className: 'modal-content',
      styles: sizes[this.options.size] || sizes.medium
    });

    // Header
    if (this.options.title || this.options.closable) {
      const header = DOM.create('div', { className: 'modal-header' });

      if (this.options.title) {
        const title = DOM.create('h2', {
          className: 'modal-title',
          attributes: { id: `${this.options.id}-title` },
          textContent: this.options.title
        });
        header.appendChild(title);
      }

      if (this.options.closable) {
        const closeBtn = DOM.create('button', {
          className: 'modal-close',
          attributes: {
            type: 'button',
            'aria-label': 'Close modal'
          },
          innerHTML: '&times;',
          events: {
            click: () => this.close()
          }
        });
        header.appendChild(closeBtn);
      }

      content.appendChild(header);
    }

    // Body
    const body = DOM.create('div', {
      className: 'modal-body',
      attributes: { id: `${this.options.id}-body` }
    });
    content.appendChild(body);

    // Footer (will be added if needed)
    const footer = DOM.create('div', {
      className: 'modal-footer',
      attributes: { id: `${this.options.id}-footer` },
      styles: { display: 'none' }
    });
    content.appendChild(footer);

    return content;
  }

  _setupEventListeners() {
    // Backdrop click
    if (this.options.backdrop) {
      const cleanup = DOM.on(this.element, 'click', (e) => {
        if (e.target === this.element) {
          this.close();
        }
      });
      this.cleanupFunctions.add(cleanup);
    }

    // Keyboard handling
    if (this.options.keyboard) {
      const cleanup = DOM.on(document, 'keydown', (e) => {
        if (this.isOpen && e.key === Keyboard.KEYS.ESCAPE) {
          e.preventDefault();
          this.close();
        }
      });
      this.cleanupFunctions.add(cleanup);
    }

    // Focus trap
    if (this.options.focus) {
      const cleanup = DOM.on(document, 'keydown', (e) => {
        if (this.isOpen && e.key === Keyboard.KEYS.TAB) {
          this._handleTabKey(e);
        }
      });
      this.cleanupFunctions.add(cleanup);
    }
  }

  _handleTabKey(e) {
    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }

  // Public API methods
  open() {
    if (this.isOpen) return this;

    if (!this.element) {
      this.create();
    }

    // Store current focus
    this.previousFocus = document.activeElement;

    // Show modal
    DOM.show(this.element);
    DOM.addClass(this.element, 'active');

    // Add body class to prevent scrolling
    DOM.addClass(document.body, 'modal-open');

    // Focus management
    if (this.options.focus) {
      const focusTarget = this.element.querySelector('[autofocus]') ||
                         this.element.querySelector('button, input, select, textarea') ||
                         this.element;
      focusTarget?.focus();
    }

    this.isOpen = true;
    this.emit('open');

    return this;
  }

  close() {
    if (!this.isOpen) return this;

    // Remove active class (triggers CSS transition)
    DOM.removeClass(this.element, 'active');

    // Wait for transition, then hide
    setTimeout(() => {
      if (this.element) {
        DOM.hide(this.element);
      }

      // Remove body class
      DOM.removeClass(document.body, 'modal-open');

      // Restore focus
      if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
        this.previousFocus.focus();
      }

      this.isOpen = false;
      this.emit('close');

      // Auto-destroy if enabled
      if (this.options.autoDestroy) {
        this.destroy();
      }
    }, 300);

    return this;
  }

  destroy() {
    if (this.element) {
      // Clean up event listeners
      this.cleanupFunctions.forEach(cleanup => cleanup());
      this.cleanupFunctions.clear();

      // Remove from DOM
      this.element.remove();
      this.element = null;
    }

    this.isOpen = false;
    this.removeAllListeners();
    this.emit('destroy');

    return this;
  }

  // Content management
  setTitle(title) {
    const titleElement = this.element?.querySelector('.modal-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
    return this;
  }

  setBody(content) {
    const bodyElement = this.element?.querySelector('.modal-body');
    if (bodyElement) {
      if (typeof content === 'string') {
        bodyElement.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        DOM.empty(bodyElement);
        bodyElement.appendChild(content);
      }
    }
    return this;
  }

  setFooter(content, show = true) {
    const footerElement = this.element?.querySelector('.modal-footer');
    if (footerElement) {
      if (typeof content === 'string') {
        footerElement.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        DOM.empty(footerElement);
        footerElement.appendChild(content);
      }

      footerElement.style.display = show ? '' : 'none';
    }
    return this;
  }

  addFooterButton(text, onClick, cssClass = 'btn btn-secondary') {
    const footerElement = this.element?.querySelector('.modal-footer');
    if (!footerElement) return this;

    const button = DOM.create('button', {
      className: cssClass,
      textContent: text,
      events: { click: onClick }
    });

    footerElement.appendChild(button);
    footerElement.style.display = '';

    return this;
  }

  // Utility methods
  getBody() {
    return this.element?.querySelector('.modal-body');
  }

  getFooter() {
    return this.element?.querySelector('.modal-footer');
  }

  isVisible() {
    return this.isOpen;
  }

  // Static factory methods
  static confirm(message, title = 'Confirm', options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        size: 'small',
        autoDestroy: true,
        ...options
      });

      modal.create();
      modal.setBody(`<p>${message}</p>`);

      const footer = DOM.create('div', {
        styles: { display: 'flex', gap: '12px', justifyContent: 'flex-end' }
      });

      const cancelBtn = DOM.create('button', {
        className: 'btn btn-secondary',
        textContent: options.cancelText || 'Cancel',
        events: {
          click: () => {
            modal.close();
            resolve(false);
          }
        }
      });

      const confirmBtn = DOM.create('button', {
        className: 'btn btn-primary',
        textContent: options.confirmText || 'Confirm',
        events: {
          click: () => {
            modal.close();
            resolve(true);
          }
        }
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      modal.setFooter(footer);

      modal.open();
    });
  }

  static alert(message, title = 'Alert', options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        size: 'small',
        autoDestroy: true,
        ...options
      });

      modal.create();
      modal.setBody(`<p>${message}</p>`);

      const okBtn = DOM.create('button', {
        className: 'btn btn-primary',
        textContent: options.okText || 'OK',
  static alert(message, title = 'Alert', options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        size: 'small',
        autoDestroy: true,
        ...options
      });

      modal.create();
      modal.setBody(`<p>${message}</p>`);

      const okBtn = DOM.create('button', {
        className: 'btn btn-primary',
        textContent: options.okText || 'OK',
        events: {
          click: () => {
            modal.close();
            resolve();
          }
        }
      });

      modal.setFooter(okBtn);
      modal.open();
    });
  }

  static prompt(message, defaultValue = '', title = 'Input', options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        size: 'small',
        autoDestroy: true,
        ...options
      });

      modal.create();

      const form = DOM.create('form');
      const label = DOM.create('label', {
        textContent: message,
        styles: { display: 'block', marginBottom: '12px' }
      });

      const input = DOM.create('input', {
        attributes: {
          type: 'text',
          value: defaultValue,
          autofocus: true
        },
        className: 'form-input',
        styles: { width: '100%' }
      });

      form.appendChild(label);
      form.appendChild(input);
      modal.setBody(form);

      const footer = DOM.create('div', {
        styles: { display: 'flex', gap: '12px', justifyContent: 'flex-end' }
      });

      const cancelBtn = DOM.create('button', {
        className: 'btn btn-secondary',
        textContent: options.cancelText || 'Cancel',
        attributes: { type: 'button' },
        events: {
          click: () => {
            modal.close();
            resolve(null);
          }
        }
      });

      const submitBtn = DOM.create('button', {
        className: 'btn btn-primary',
        textContent: options.submitText || 'OK',
        attributes: { type: 'submit' }
      });

      const handleSubmit = (e) => {
        e.preventDefault();
        modal.close();
        resolve(input.value);
      };

      DOM.on(form, 'submit', handleSubmit);
      DOM.on(submitBtn, 'click', handleSubmit);

      footer.appendChild(cancelBtn);
      footer.appendChild(submitBtn);
      modal.setFooter(footer);

      modal.open();
    });
  }
}

// Modal Manager for handling multiple modals
export class ModalManager {
  constructor() {
    this.modals = new Map();
    this.stack = [];
    this.zIndexBase = 1050;
  }

  register(modal) {
    if (!(modal instanceof Modal)) {
      throw new Error('Only Modal instances can be registered');
    }

    this.modals.set(modal.options.id, modal);

    // Listen for modal events
    modal.on('open', () => this._onModalOpen(modal));
    modal.on('close', () => this._onModalClose(modal));
    modal.on('destroy', () => this._onModalDestroy(modal));

    return modal;
  }

  create(options) {
    const modal = new Modal(options);
    return this.register(modal);
  }

  get(id) {
    return this.modals.get(id);
  }

  closeAll() {
    this.stack.forEach(modal => modal.close());
  }

  closeTop() {
    const topModal = this.stack[this.stack.length - 1];
    if (topModal) {
      topModal.close();
    }
  }

  _onModalOpen(modal) {
    // Add to stack
    if (!this.stack.includes(modal)) {
      this.stack.push(modal);
    }

    // Update z-index
    if (modal.element) {
      modal.element.style.zIndex = this.zIndexBase + this.stack.length;
    }

    // Update body class
    document.body.classList.add('modal-open');
  }

  _onModalClose(modal) {
    // Remove from stack
    const index = this.stack.indexOf(modal);
    if (index > -1) {
      this.stack.splice(index, 1);
    }

    // Remove body class if no modals are open
    if (this.stack.length === 0) {
      document.body.classList.remove('modal-open');
    }
  }

  _onModalDestroy(modal) {
    this.modals.delete(modal.options.id);
    this._onModalClose(modal);
  }

  getOpenModals() {
    return [...this.stack];
  }

  hasOpenModals() {
    return this.stack.length > 0;
  }
}

// Global modal manager instance
export const modalManager = new ModalManager();

// Convenience functions
export const showModal = (options) => {
  const modal = modalManager.create(options);
  modal.open();
  return modal;
};

export const showConfirm = (message, title, options) => {
  return Modal.confirm(message, title, options);
};

export const showAlert = (message, title, options) => {
  return Modal.alert(message, title, options);
};

export const showPrompt = (message, defaultValue, title, options) => {
  return Modal.prompt(message, defaultValue, title, options);
};

export default {
  Modal,
  ModalManager,
  modalManager,
  showModal,
  showConfirm,
  showAlert,
  showPrompt
};