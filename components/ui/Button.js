/**
 * Reusable UI Components
 */

import { DOM } from '../../utils/dom.js';
import { StringUtils } from '../../utils/helpers.js';

// Button Component
export class Button {
  static create(options = {}) {
    const {
      text = '',
      variant = 'primary',
      size = 'medium',
      icon = null,
      disabled = false,
      loading = false,
      onClick = null,
      className = '',
      attributes = {}
    } = options;

    const button = DOM.create('button', {
      className: `btn btn-${variant} btn-${size} ${className} ${loading ? 'btn-loading' : ''}`.trim(),
      attributes: {
        type: 'button',
        disabled: disabled || loading,
        ...attributes
      }
    });

    if (loading) {
      button.innerHTML = `
        <span class="btn-loader">
          <span class="spinner"></span>
          Loading...
        </span>
      `;
    } else {
      const content = [];
      if (icon) content.push(`<span class="btn-icon">${icon}</span>`);
      if (text) content.push(`<span class="btn-text">${StringUtils.escapeHtml(text)}</span>`);
      button.innerHTML = content.join('');
    }

    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return button;
  }

  static setLoading(button, loading = true, loadingText = 'Loading...') {
    if (!button) return;

    if (loading) {
      button.disabled = true;
      button.classList.add('btn-loading');
      button.innerHTML = `
        <span class="btn-loader">
          <span class="spinner"></span>
          ${StringUtils.escapeHtml(loadingText)}
        </span>
      `;
    } else {
      button.disabled = false;
      button.classList.remove('btn-loading');
      // Restore original content if stored
      if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
      }
    }
  }
}

// Form Components
export class FormComponents {
  static createField(options = {}) {
    const {
      type = 'text',
      name = '',
      label = '',
      placeholder = '',
      required = false,
      value = '',
      icon = null,
      helpText = '',
      validation = null,
      className = ''
    } = options;

    const fieldId = `field-${StringUtils.generateId()}`;
    const wrapper = DOM.create('div', {
      className: `form-group ${className}`.trim()
    });

    // Label
    if (label) {
      const labelEl = DOM.create('label', {
        attributes: { for: fieldId },
        className: 'form-label'
      });

      const labelContent = [];
      if (icon) labelContent.push(`<span class="label-icon">${icon}</span>`);
      labelContent.push(StringUtils.escapeHtml(label));
      if (required) labelContent.push('<span class="required">*</span>');

      labelEl.innerHTML = labelContent.join('');
      wrapper.appendChild(labelEl);
    }

    // Input wrapper for positioning
    const inputWrapper = DOM.create('div', {
      className: 'form-input-wrapper'
    });

    // Input element
    let input;
    if (type === 'textarea') {
      input = DOM.create('textarea', {
        className: 'form-textarea',
        attributes: {
          id: fieldId,
          name,
          placeholder,
          required
        }
      });
      input.value = value;
    } else if (type === 'select') {
      input = DOM.create('select', {
        className: 'form-select',
        attributes: {
          id: fieldId,
          name,
          required
        }
      });
      // Options should be added separately
    } else {
      input = DOM.create('input', {
        className: 'form-input',
        attributes: {
          type,
          id: fieldId,
          name,
          placeholder,
          required,
          value
        }
      });
    }

    // Add validation event listener
    if (validation) {
      input.addEventListener('blur', () => {
        FormComponents.validateField(input, validation);
      });

      input.addEventListener('input', () => {
        FormComponents.clearFieldError(input);
      });
    }

    inputWrapper.appendChild(input);
    wrapper.appendChild(inputWrapper);

    // Help text
    if (helpText) {
      const help = DOM.create('div', {
        className: 'form-hint',
        textContent: helpText
      });
      wrapper.appendChild(help);
    }

    return { wrapper, input };
  }

  static createSelectOptions(select, options = []) {
    if (!select) return;

    options.forEach(option => {
      const optionEl = DOM.create('option', {
        attributes: {
          value: option.value || option,
          selected: option.selected || false
        },
        textContent: option.label || option.text || option
      });
      select.appendChild(optionEl);
    });
  }

  static validateField(input, validator) {
    if (!input || !validator) return true;

    try {
      const result = validator(input.value, input);

      if (result === true) {
        FormComponents.clearFieldError(input);
        input.classList.add('valid');
        return true;
      } else {
        FormComponents.showFieldError(input, result || 'Invalid value');
        return false;
      }
    } catch (error) {
      FormComponents.showFieldError(input, error.message);
      return false;
    }
  }

  static showFieldError(input, message) {
    if (!input) return;

    FormComponents.clearFieldError(input);
    input.classList.add('error');
    input.classList.remove('valid');

    const errorElement = DOM.create('div', {
      className: 'form-error',
      textContent: message
    });

    const formGroup = input.closest('.form-group');
    if (formGroup) {
      formGroup.appendChild(errorElement);
    }
  }

  static clearFieldError(input) {
    if (!input) return;

    input.classList.remove('error');
    const formGroup = input.closest('.form-group');
    if (formGroup) {
      const errorElement = formGroup.querySelector('.form-error');
      if (errorElement) {
        errorElement.remove();
      }
    }
  }

  static getFormData(form) {
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      if (data[key]) {
        // Handle multiple values (checkboxes, etc.)
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  static validateForm(form, validators = {}) {
    if (!form) return { isValid: false, errors: {} };

    const data = FormComponents.getFormData(form);
    const errors = {};
    let isValid = true;

    Object.entries(validators).forEach(([fieldName, validator]) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const fieldValid = FormComponents.validateField(field, validator);
        if (!fieldValid) {
          errors[fieldName] = 'Validation failed';
          isValid = false;
        }
      }
    });

    return { isValid, errors, data };
  }

  static clearForm(form) {
    if (!form) return;

    form.reset();

    // Clear validation states
    const fields = form.querySelectorAll('.form-input, .form-textarea, .form-select');
    fields.forEach(field => {
      FormComponents.clearFieldError(field);
      field.classList.remove('error', 'valid');
    });
  }
}

// Dialog Component (simplified version of Modal)
export class Dialog {
  static confirm(message, title = 'Confirm', options = {}) {
    return new Promise((resolve) => {
      const dialog = DOM.create('div', {
        className: 'dialog-overlay',
        innerHTML: `
          <div class="dialog">
            <div class="dialog-header">
              <h3>${StringUtils.escapeHtml(title)}</h3>
            </div>
            <div class="dialog-body">
              <p>${StringUtils.escapeHtml(message)}</p>
            </div>
            <div class="dialog-footer">
              <button class="btn btn-secondary" data-action="cancel">
                ${options.cancelText || 'Cancel'}
              </button>
              <button class="btn btn-primary" data-action="confirm">
                ${options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        `
      });

      // Handle clicks
      dialog.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action) {
          resolve(action === 'confirm');
          dialog.remove();
        } else if (e.target === dialog) {
          resolve(false);
          dialog.remove();
        }
      });

      // Handle escape key
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          resolve(false);
          dialog.remove();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      document.body.appendChild(dialog);
    });
  }

  static alert(message, title = 'Alert', options = {}) {
    return new Promise((resolve) => {
      const dialog = DOM.create('div', {
        className: 'dialog-overlay',
        innerHTML: `
          <div class="dialog">
            <div class="dialog-header">
              <h3>${StringUtils.escapeHtml(title)}</h3>
            </div>
            <div class="dialog-body">
              <p>${StringUtils.escapeHtml(message)}</p>
            </div>
            <div class="dialog-footer">
              <button class="btn btn-primary" data-action="ok">
                ${options.okText || 'OK'}
              </button>
            </div>
          </div>
        `
      });

      // Handle clicks
      dialog.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'ok' || e.target === dialog) {
          resolve();
          dialog.remove();
        }
      });

      // Handle escape key
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          resolve();
          dialog.remove();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      document.body.appendChild(dialog);
    });
  }
}

// Loading Component
export class Loading {
  static show(target = document.body, message = 'Loading...') {
    const existing = target.querySelector('.loading-overlay');
    if (existing) return existing;

    const overlay = DOM.create('div', {
      className: 'loading-overlay',
      innerHTML: `
        <div class="loading-content">
          <div class="spinner-large"></div>
          <p class="loading-message">${StringUtils.escapeHtml(message)}</p>
        </div>
      `
    });

    target.appendChild(overlay);
    return overlay;
  }

  static hide(target = document.body) {
    const overlay = target.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  static updateMessage(target = document.body, message) {
    const messageEl = target.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }
}