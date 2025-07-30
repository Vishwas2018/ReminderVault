/**
 * Helper Utilities - Common utility functions
 */

// Async utilities
export const AsyncUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  timeout: (promise, ms, errorMessage = 'Operation timed out') => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeoutPromise]);
  },

  retry: async (fn, maxAttempts = 3, delay = 1000) => {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await AsyncUtils.delay(delay * attempt);
        }
      }
    }

    throw lastError;
  },

  debounce: (func, wait, immediate = false) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };

      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);

      if (callNow) func.apply(this, args);
    };
  },

  throttle: (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Date and time utilities
export const DateUtils = {
  formatDate: (date, options = {}) => {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(d);
  },

  getRelativeTime: (date) => {
    if (!date) return '';

    const now = new Date();
    const target = new Date(date);
    const diffMs = target - now;
    const absDiffMs = Math.abs(diffMs);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    const units = [
      { unit: 'second', ms: 1000 },
      { unit: 'minute', ms: 60 * 1000 },
      { unit: 'hour', ms: 60 * 60 * 1000 },
      { unit: 'day', ms: 24 * 60 * 60 * 1000 },
      { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
      { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
      { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 }
    ];

    for (let i = units.length - 1; i >= 0; i--) {
      const { unit, ms } = units[i];
      if (absDiffMs >= ms) {
        const value = Math.round(diffMs / ms);
        return rtf.format(value, unit);
      }
    }

    return rtf.format(0, 'second');
  },

  isToday: (date) => {
    if (!date) return false;
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
  },

  isOverdue: (date, gracePeriodMs = 0) => {
    if (!date) return false;
    return new Date(date).getTime() + gracePeriodMs < Date.now();
  },

  addTime: (date, amount, unit = 'minutes') => {
    const d = new Date(date);

    switch (unit) {
      case 'seconds':
        d.setSeconds(d.getSeconds() + amount);
        break;
      case 'minutes':
        d.setMinutes(d.getMinutes() + amount);
        break;
      case 'hours':
        d.setHours(d.getHours() + amount);
        break;
      case 'days':
        d.setDate(d.getDate() + amount);
        break;
      default:
        d.setMinutes(d.getMinutes() + amount);
    }

    return d;
  },

  getCurrentDateTime: (timezone) => {
    const now = new Date();
    if (timezone) {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(now).replace(' ', 'T');
    }
    return now.toISOString().slice(0, 19);
  }
};

// String utilities
export const StringUtils = {
  capitalize: (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  camelCase: (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
  },

  kebabCase: (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/([a-z])([A-Z])/g, '$1-$2')
              .replace(/[\s_]+/g, '-')
              .toLowerCase();
  },

  truncate: (str, length, suffix = '...') => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  },

  slugify: (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase()
              .trim()
              .replace(/[^\w\s-]/g, '')
              .replace(/[\s_-]+/g, '-')
              .replace(/^-+|-+$/g, '');
  },

  escapeHtml: (str) => {
    if (!str || typeof str !== 'string') return '';
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };
    return str.replace(/[&<>"'\/]/g, char => entityMap[char]);
  },

  unescapeHtml: (str) => {
    if (!str || typeof str !== 'string') return '';
    const entityMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x2F;': '/'
    };
    return str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x2F;/g, entity => entityMap[entity]);
  },

  generateId: (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },

  generateUUID: () => {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Array utilities
export const ArrayUtils = {
  isEmpty: (arr) => !Array.isArray(arr) || arr.length === 0,

  unique: (arr, keyFn) => {
    if (!Array.isArray(arr)) return [];

    if (keyFn) {
      const seen = new Set();
      return arr.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return [...new Set(arr)];
  },

  groupBy: (arr, keyFn) => {
    if (!Array.isArray(arr)) return {};

    return arr.reduce((groups, item) => {
      const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  },

  sortBy: (arr, keyFn, direction = 'asc') => {
    if (!Array.isArray(arr)) return [];

    return [...arr].sort((a, b) => {
      const aVal = typeof keyFn === 'function' ? keyFn(a) : a[keyFn];
      const bVal = typeof keyFn === 'function' ? keyFn(b) : b[keyFn];

      let result;
      if (aVal < bVal) result = -1;
      else if (aVal > bVal) result = 1;
      else result = 0;

      return direction === 'desc' ? -result : result;
    });
  },

  chunk: (arr, size) => {
    if (!Array.isArray(arr) || size <= 0) return [];

    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  shuffle: (arr) => {
    if (!Array.isArray(arr)) return [];

    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  findBy: (arr, keyFn, value) => {
    if (!Array.isArray(arr)) return undefined;
    return arr.find(item => {
      const itemValue = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      return itemValue === value;
    });
  },

  partition: (arr, predicate) => {
    if (!Array.isArray(arr)) return [[], []];

    const truthy = [];
    const falsy = [];

    arr.forEach(item => {
      if (predicate(item)) {
        truthy.push(item);
      } else {
        falsy.push(item);
      }
    });

    return [truthy, falsy];
  }
};

// Object utilities
export const ObjectUtils = {
  isEmpty: (obj) => {
    if (!obj || typeof obj !== 'object') return true;
    return Object.keys(obj).length === 0;
  },

  pick: (obj, keys) => {
    if (!obj || typeof obj !== 'object') return {};

    const result = {};
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  },

  omit: (obj, keys) => {
    if (!obj || typeof obj !== 'object') return {};

    const result = { ...obj };
    keys.forEach(key => {
      delete result[key];
    });
    return result;
  },

  deepClone: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => ObjectUtils.deepClone(item));

    if (typeof obj === 'object') {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = ObjectUtils.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  },

  deepMerge: (target, ...sources) => {
    if (!sources.length) return target;
    const source = sources.shift();

    if (ObjectUtils.isObject(target) && ObjectUtils.isObject(source)) {
      for (const key in source) {
        if (ObjectUtils.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          ObjectUtils.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return ObjectUtils.deepMerge(target, ...sources);
  },

  isObject: (item) => {
    return item && typeof item === 'object' && !Array.isArray(item);
  },

  flatten: (obj, prefix = '') => {
    const flattened = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? '${prefix}.${key}' : key;

        if (ObjectUtils.isObject(obj[key])) {
          Object.assign(flattened, ObjectUtils.flatten(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }
};

// Number utilities
export const NumberUtils = {
  isNumeric: (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  clamp: (num, min, max) => {
    return Math.min(Math.max(num, min), max);
  },

  random: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  round: (num, decimals = 0) => {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },

  formatBytes: (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return '${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}';
  },

  formatNumber: (num, options = {}) => {
    const defaultOptions = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    };

    return new Intl.NumberFormat('en-US', { ...defaultOptions, ...options }).format(num);
  },

  percentage: (value, total, decimals = 1) => {
    if (total === 0) return 0;
    return NumberUtils.round((value / total) * 100, decimals);
  }
};

// URL utilities
export const UrlUtils = {
  getParams: (url = window.location.search) => {
    return Object.fromEntries(new URLSearchParams(url));
  },

  setParams: (params, url = window.location.href) => {
    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        urlObj.searchParams.delete(key);
      } else {
        urlObj.searchParams.set(key, value);
      }
    });
    return urlObj.toString();
  },

  removeParams: (params, url = window.location.href) => {
    const urlObj = new URL(url);
    params.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  },

  isValidUrl: (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }
};

// Browser utilities
export const BrowserUtils = {
  isMobile: () => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  isTablet: () => {
    return /iPad|Android/i.test(navigator.userAgent) && !BrowserUtils.isMobile();
  },

  isDesktop: () => {
    return !BrowserUtils.isMobile() && !BrowserUtils.isTablet();
  },

  getBrowser: () => {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';

    return 'Unknown';
  },

  getOS: () => {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';

    return 'Unknown';
  },

  copyToClipboard: async (text) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  },

  downloadFile: (content, filename, mimeType = 'text/plain') => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      return false;
    }
  }
};

// Performance utilities
export const PerformanceUtils = {
  measure: (fn, name = 'Operation') => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    console.log('${name} took ${end - start} milliseconds');
    return result;
  },

  measureAsync: async (fn, name = 'Async Operation') => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    console.log('${name} took ${end - start} milliseconds');
    return result;
  },

  benchmark: (fn, iterations = 1000) => {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b) / times.length,
      total: times.reduce((a, b) => a + b)
    };
  },

  memoize: (fn, keyGenerator = (...args) => JSON.stringify(args)) => {
    const cache = new Map();

    return (...args) => {
      const key = keyGenerator(...args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn(...args);
      cache.set(key, result);
      return result;
    };
  }
};

// Event emitter utility
export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(listener);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  off(event, listenerToRemove) {
    if (!this.events.has(event)) return;

    const listeners = this.events.get(event);
    const index = listeners.indexOf(listenerToRemove);

    if (index > -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.events.delete(event);
    }
  }

  emit(event, ...args) {
    if (!this.events.has(event)) return;

    const listeners = this.events.get(event);
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Error in event listener for "${event}":', error);
      }
    });
  }

  once(event, listener) {
    const onceListener = (...args) => {
      this.off(event, onceListener);
      listener(...args);
    };

    return this.on(event, onceListener);
  }

  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0;
  }
}

export default {
  AsyncUtils,
  DateUtils,
  StringUtils,
  ArrayUtils,
  ObjectUtils,
  NumberUtils,
  UrlUtils,
  BrowserUtils,
  PerformanceUtils,
  EventEmitter
};