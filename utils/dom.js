/**
 * DOM Utilities - Clean, modern DOM manipulation helpers
 */

export const DOM = {
  // Element selection with null safety
  get: (selector) => document.querySelector(selector),
  getAll: (selector) => Array.from(document.querySelectorAll(selector)),
  getById: (id) => document.getElementById(id),

  // Element creation with modern approach
  create: (tag, options = {}) => {
    const element = document.createElement(tag);

    const {
      className,
      textContent,
      innerHTML,
      attributes = {},
      dataset = {},
      styles = {},
      events = {}
    } = options;

    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    if (innerHTML) element.innerHTML = innerHTML;

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    // Set dataset properties
    Object.assign(element.dataset, dataset);

    // Set styles
    Object.assign(element.style, styles);

    // Attach event listeners
    Object.entries(events).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });

    return element;
  },

  // Safe event handling with cleanup
  on: (element, event, handler, options = {}) => {
    if (!element) return () => {};

    const safeHandler = (e) => {
      try {
        handler(e);
      } catch (error) {
        console.error('Event handler error for ${event}:', error);
      }
    };

    element.addEventListener(event, safeHandler, options);
    return () => element.removeEventListener(event, safeHandler, options);
  },

  // Element manipulation
  show: (element) => {
    if (element) element.style.display = '';
  },

  hide: (element) => {
    if (element) element.style.display = 'none';
  },

  toggle: (element, force) => {
    if (!element) return false;

    if (typeof force === 'boolean') {
      element.style.display = force ? '' : 'none';
      return force;
    }

    const isHidden = element.style.display === 'none' ||
                    getComputedStyle(element).display === 'none';
    element.style.display = isHidden ? '' : 'none';
    return !isHidden;
  },

  // Class utilities
  addClass: (element, ...classes) => {
    if (element) element.classList.add(...classes);
  },

  removeClass: (element, ...classes) => {
    if (element) element.classList.remove(...classes);
  },

  toggleClass: (element, className, force) => {
    return element ? element.classList.toggle(className, force) : false;
  },

  hasClass: (element, className) => {
    return element ? element.classList.contains(className) : false;
  },

  // Content manipulation
  empty: (element) => {
    if (element) element.innerHTML = '';
  },

  append: (parent, ...children) => {
    if (!parent) return;
    children.forEach(child => {
      if (typeof child === 'string') {
        parent.insertAdjacentHTML('beforeend', child);
      } else if (child) {
        parent.appendChild(child);
      }
    });
  },

  prepend: (parent, ...children) => {
    if (!parent) return;
    children.reverse().forEach(child => {
      if (typeof child === 'string') {
        parent.insertAdjacentHTML('afterbegin', child);
      } else if (child) {
        parent.insertBefore(child, parent.firstChild);
      }
    });
  },

  // Position and dimensions
  getRect: (element) => {
    return element ? element.getBoundingClientRect() : null;
  },

  isInViewport: (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  },

  // Smooth scrolling
  scrollTo: (element, options = {}) => {
    if (!element) return;

    const defaultOptions = {
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    };

    element.scrollIntoView({ ...defaultOptions, ...options });
  },

  scrollToTop: (element = window, behavior = 'smooth') => {
    if (element === window) {
      window.scrollTo({ top: 0, behavior });
    } else if (element) {
      element.scrollTop = 0;
    }
  },

  // Form utilities
  getFormData: (form) => {
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
  },

  setFormData: (form, data) => {
    if (!form || !data) return;

    Object.entries(data).forEach(([key, value]) => {
      const field = form.querySelector('[name="${key}"]');
      if (field) {
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = Boolean(value);
        } else {
          field.value = value;
        }
      }
    });
  },

  clearForm: (form) => {
    if (form) form.reset();
  },

  // Animation helpers
  fadeIn: (element, duration = 300) => {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      element.style.opacity = '0';
      element.style.display = '';
      element.style.transition = 'opacity ${duration}ms ease';

      requestAnimationFrame(() => {
        element.style.opacity = '1';
        setTimeout(() => {
          element.style.transition = '';
          resolve();
        }, duration);
      });
    });
  },

  fadeOut: (element, duration = 300) => {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      element.style.transition = 'opacity ${duration}ms ease';
      element.style.opacity = '0';

      setTimeout(() => {
        element.style.display = 'none';
        element.style.transition = '';
        element.style.opacity = '';
        resolve();
      }, duration);
    });
  },

  slideDown: (element, duration = 300) => {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      const height = element.scrollHeight;
      element.style.height = '0px';
      element.style.overflow = 'hidden';
      element.style.transition = 'height ${duration}ms ease';
      element.style.display = '';

      requestAnimationFrame(() => {
        element.style.height = '${height}px';
        setTimeout(() => {
          element.style.height = '';
          element.style.overflow = '';
          element.style.transition = '';
          resolve();
        }, duration);
      });
    });
  },

  slideUp: (element, duration = 300) => {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      const height = element.scrollHeight;
      element.style.height = '${height}px';
      element.style.overflow = 'hidden';
      element.style.transition = 'height ${duration}ms ease';

      requestAnimationFrame(() => {
        element.style.height = '0px';
        setTimeout(() => {
          element.style.display = 'none';
          element.style.height = '';
          element.style.overflow = '';
          element.style.transition = '';
          resolve();
        }, duration);
      });
    });
  },

  // Utility methods
  ready: (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  },

  // Safe HTML insertion with XSS protection
  safeHTML: (element, html) => {
    if (!element) return;

    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove potentially dangerous elements and attributes
    const dangerous = temp.querySelectorAll('script, object, embed, link[rel="import"]');
    dangerous.forEach(el => el.remove());

    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
      dangerousAttrs.forEach(attr => el.removeAttribute(attr));
    });

    element.innerHTML = temp.innerHTML;
  },

  // Element validation
  exists: (element) => element && element.nodeType === Node.ELEMENT_NODE,

  isVisible: (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  },

  // Cleanup utility for event listeners
  cleanupEvents: (element) => {
    if (!element) return;

    // Clone node to remove all event listeners
    const newElement = element.cloneNode(true);
    element.parentNode?.replaceChild(newElement, element);
    return newElement;
  }
};

// Keyboard utilities
export const Keyboard = {
  KEYS: {
    ENTER: 'Enter',
    ESCAPE: 'Escape',
    SPACE: ' ',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight'
  },

  isKey: (event, key) => event.key === key,

  isModified: (event) => event.ctrlKey || event.metaKey || event.altKey || event.shiftKey,

  onKey: (element, key, handler, options = {}) => {
    return DOM.on(element, 'keydown', (e) => {
      if (e.key === key && (!options.requireModifier || Keyboard.isModified(e))) {
        if (options.preventDefault) e.preventDefault();
        handler(e);
      }
    });
  }
};

// Touch/mobile utilities
export const Touch = {
  isTouch: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,

  onSwipe: (element, handlers = {}) => {
    if (!element) return () => {};

    let startX, startY, startTime;
    const threshold = 50; // minimum distance for swipe
    const timeLimit = 300; // maximum time for swipe

    const cleanup = [
      DOM.on(element, 'touchstart', (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
      }),

      DOM.on(element, 'touchend', (e) => {
        if (!startX || !startY) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const deltaTime = Date.now() - startTime;

        if (deltaTime > timeLimit) return;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0 && handlers.right) handlers.right(e);
            if (deltaX < 0 && handlers.left) handlers.left(e);
          }
        } else {
          // Vertical swipe
          if (Math.abs(deltaY) > threshold) {
            if (deltaY > 0 && handlers.down) handlers.down(e);
            if (deltaY < 0 && handlers.up) handlers.up(e);
          }
        }

        startX = startY = null;
      })
    ];

    return () => cleanup.forEach(fn => fn());
  }
};

export default { DOM, Keyboard, Touch };