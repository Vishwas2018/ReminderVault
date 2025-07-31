/**
 * Validation Utilities - Comprehensive validation functions
 */

import { VALIDATION_RULES } from '../config/constants.js';

export class ValidationUtils {
  // Core validation predicates
  static validators = {
    required: (value) => value !== null && value !== undefined && String(value).trim() !== '',

    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),

    minLength: (min) => (value) => String(value).length >= min,

    maxLength: (max) => (value) => String(value).length <= max,

    pattern: (regex) => (value) => regex.test(value),

    numeric: (value) => !isNaN(Number(value)) && isFinite(Number(value)),

    integer: (value) => Number.isInteger(Number(value)),

    positive: (value) => Number(value) > 0,

    range: (min, max) => (value) => {
      const num = Number(value);
      return num >= min && num <= max;
    },

    url: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },

    date: (value) => !isNaN(Date.parse(value)),

    futureDate: (value) => new Date(value) > new Date(),

    pastDate: (value) => new Date(value) < new Date(),

    sameAs: (otherValue) => (value) => value === otherValue,

    oneOf: (allowedValues) => (value) => allowedValues.includes(value),

    custom: (validatorFn) => validatorFn
  };

  // Validation rule builder
  static createRule(validatorType, ...args) {
    const validator = this.validators[validatorType];
    if (!validator) {
      throw new Error(`Unknown validator type: ${validatorType}`);
    }

    return typeof validator === 'function' && args.length > 0
      ? validator(...args)
      : validator;
  }

  // Combine multiple validators
  static combine(...validators) {
    return (value) => {
      for (const validator of validators) {
        const result = validator(value);
        if (result !== true) return result;
      }
      return true;
    };
  }

  // Validate single field
  static validateField(value, rules, fieldName = 'Field') {
    const errors = [];

    for (const rule of rules) {
      const result = rule.validator(value);
      if (result !== true) {
        errors.push(rule.message || `${fieldName} is invalid`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      value
    };
  }

  // Validate object against schema
  static validateObject(data, schema) {
    const errors = {};
    let isValid = true;

    Object.entries(schema).forEach(([field, rules]) => {
      const value = data[field];
      const fieldResult = this.validateField(value, rules, field);

      if (!fieldResult.isValid) {
        errors[field] = fieldResult.errors;
        isValid = false;
      }
    });

    return { isValid, errors, data };
  }

  // Async validation support
  static async validateAsync(value, asyncValidator) {
    try {
      const result = await asyncValidator(value);
      return result === true ? true : result;
    } catch (error) {
      return error.message || 'Validation failed';
    }
  }

  // Pre-built validation schemas
  static schemas = {
    reminder: {
      title: [
        {
          validator: ValidationUtils.validators.required,
          message: 'Title is required'
        },
        {
          validator: ValidationUtils.validators.maxLength(100),
          message: 'Title must be 100 characters or less'
        }
      ],

      description: [
        {
          validator: ValidationUtils.validators.maxLength(500),
          message: 'Description must be 500 characters or less'
        }
      ],

      datetime: [
        {
          validator: ValidationUtils.validators.required,
          message: 'Date and time is required'
        },
        {
          validator: ValidationUtils.validators.date,
          message: 'Must be a valid date and time'
        },
        {
          validator: ValidationUtils.validators.futureDate,
          message: 'Date and time must be in the future'
        }
      ],

      priority: [
        {
          validator: ValidationUtils.validators.required,
          message: 'Priority is required'
        },
        {
          validator: ValidationUtils.validators.oneOf([1, 2, 3, 4]),
          message: 'Priority must be between 1 and 4'
        }
      ],

      category: [
        {
          validator: ValidationUtils.validators.required,
          message: 'Category is required'
        },
        {
          validator: ValidationUtils.validators.oneOf([
            'personal', 'work', 'health', 'finance', 'education', 'social', 'other'
          ]),
          message: 'Invalid category'
        }
      ],

      alertTimings: [
        {
          validator: (value) => Array.isArray(value),
          message: 'Alert timings must be an array'
        },
        {
          validator: (value) => value.every(t => ValidationUtils.validators.positive(t)),
          message: 'All alert timings must be positive numbers'
        }
      ]
    },

    user: {
      username: [
        {
          validator: ValidationUtils.validators.required,
          message: 'Username is required'
        },
        {
          validator: ValidationUtils.validators.minLength(3),
          message: 'Username must be at least 3 characters'
        },
        {
          validator: ValidationUtils.validators.maxLength(20),
          message: 'Username must be 20 characters or less'
        },
        {
          validator: ValidationUtils.validators.pattern(/^[a-zA-Z0-9_-]+$/),
          message: 'Username can only contain letters, numbers, underscores, and hyphens'
        }
      ],

      password: [
        {
          validator: ValidationUtils.validators.required,
          message: 'Password is required'
        },
        {
          validator: ValidationUtils.validators.minLength(6),
          message: 'Password must be at least 6 characters'
        },
        {
          validator: ValidationUtils.validators.maxLength(128),
          message: 'Password must be 128 characters or less'
        }
      ],

      email: [
        {
          validator: ValidationUtils.validators.email,
          message: 'Must be a valid email address'
        }
      ]
    },

    settings: {
      theme: [
        {
          validator: ValidationUtils.validators.oneOf(['light', 'dark', 'auto']),
          message: 'Theme must be light, dark, or auto'
        }
      ],

      notifications: [
        {
          validator: (value) => typeof value === 'boolean',
          message: 'Notifications setting must be true or false'
        }
      ],

      autoRefresh: [
        {
          validator: ValidationUtils.validators.integer,
          message: 'Auto refresh interval must be a whole number'
        },
        {
          validator: ValidationUtils.validators.range(30, 300),
          message: 'Auto refresh interval must be between 30 and 300 seconds'
        }
      ]
    }
  };

  // Convenience methods for common validations
  static validateReminder(reminderData) {
    return this.validateObject(reminderData, this.schemas.reminder);
  }

  static validateUser(userData) {
    return this.validateObject(userData, this.schemas.user);
  }

  static validateSettings(settingsData) {
    return this.validateObject(settingsData, this.schemas.settings);
  }

  // Form validation helpers
  static createFormValidator(schema) {
    return (formData) => this.validateObject(formData, schema);
  }

  // Real-time validation debouncer
  static createRealtimeValidator(validator, delay = 300) {
    let timeoutId;

    return (value, callback) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const result = validator(value);
        callback(result);
      }, delay);
    };
  }

  // Error message formatter
  static formatErrors(errors, options = {}) {
    const {
      format = 'object', // 'object', 'array', 'string'
      separator = '; ',
      includeField = true
    } = options;

    switch (format) {
      case 'array':
        return Object.entries(errors).flatMap(([field, fieldErrors]) =>
          fieldErrors.map(error => includeField ? `${field}: ${error}` : error)
        );

      case 'string':
        const messages = Object.entries(errors).flatMap(([field, fieldErrors]) =>
          fieldErrors.map(error => includeField ? `${field}: ${error}` : error)
        );
        return messages.join(separator);

      case 'object':
      default:
        return errors;
    }
  }

  // Sanitization helpers
  static sanitize = {
    string: (value, maxLength = 1000) => {
      return String(value || '').trim().substring(0, maxLength);
    },

    html: (value) => {
      const div = document.createElement('div');
      div.textContent = value;
      return div.innerHTML;
    },

    number: (value, min = -Infinity, max = Infinity) => {
      const num = Number(value);
      return isNaN(num) ? 0 : Math.min(Math.max(num, min), max);
    },

    boolean: (value) => {
      return Boolean(value);
    },

    array: (value) => {
      return Array.isArray(value) ? value : [];
    },

    object: (value) => {
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
  };
}