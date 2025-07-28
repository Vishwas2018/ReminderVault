// ===== UI SERVICE - MODERN COMPONENT-BASED ARCHITECTURE =====

import { DOM, UI, debounce, throttle } from '../utils.js';
import {
    APP_CONFIG,
    REMINDER_CONFIG,
    UI_CONSTANTS,
    MESSAGES,
    PERFORMANCE_CONFIG
} from '../config/constants.js';

/**
 * Modern UI Service with component-based architecture and reactive state management
 */
export class UIService {
    #components = new Map();
    #state = new Proxy({}, {
        set: (target, prop, value) => {
            const oldValue = target[prop];
            target[prop] = value;
            this.#notifyStateChange(prop, value, oldValue);
            return true;
        }
    });
    #eventListeners = new Map();
    #animationFrameId = null;
    #renderQueue = new Set();

    constructor() {
        this.#setupPerformanceOptimizations();
        this.#setupGlobalEventHandlers();
    }

    /**
     * Initialize UI service with reactive state management
     */
    async init() {
        console.log('🎨 Initializing UIService...');

        try {
            await this.#registerComponents();
            await this.#setupKeyboardShortcuts();
            await this.#setupAccessibility();

            this.#state.initialized = true;
            console.log('✅ UIService initialized successfully');
        } catch (error) {
            console.error('❌ UIService initialization failed:', error);
            throw new Error('UI service initialization failed');
        }
    }

    /**
     * Update dashboard display with optimized rendering
     */
    async updateDashboard(data) {
        const { reminders, statistics, schedule } = data;

        this.#batchUpdate(() => {
            this.#state.reminders = reminders;
            this.#state.statistics = statistics;
            this.#state.schedule = schedule;
        });
    }

    /**
     * Show modal with enhanced UX
     */
    async showModal(modalId, options = {}) {
        const {
            data = null,
            onShow = null,
            onHide = null,
            preventClose = false
        } = options;

        const modal = this.#getComponent(modalId);
        if (!modal) throw new Error(`Modal ${modalId} not found`);

        // Setup modal state
        modal.dataset.preventClose = preventClose;

        // Populate data if provided
        if (data && modal.populate) {
            await modal.populate(data);
        }

        // Show with animation
        await this.#animateModal(modal, 'show');

        // Setup escape key handler
        this.#setupModalEscapeHandler(modal);

        // Callback
        onShow?.(modal);

        // Store hide callback for later use
        if (onHide) modal._onHide = onHide;

        return modal;
    }

    /**
     * Hide modal with cleanup
     */
    async hideModal(modalId) {
        const modal = this.#getComponent(modalId);
        if (!modal) return;

        // Check if close is prevented
        if (modal.dataset.preventClose === 'true') return;

        // Cleanup
        modal._onHide?.(modal);
        delete modal._onHide;

        // Hide with animation
        await this.#animateModal(modal, 'hide');

        // Clear form data if applicable
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            this.#clearFormErrors(form);
        }
    }

    /**
     * Show notification with enhanced styling and queueing
     */
    showNotification(message, type = 'info', options = {}) {
        const {
            duration = APP_CONFIG.notifications.durations[type],
            position = APP_CONFIG.notifications.positions.TOP_RIGHT,
            persistent = false,
            actions = []
        } = options;

        // Limit visible notifications
        this.#enforceNotificationLimit();

        const notification = this.#createNotification(message, type, {
            position,
            persistent,
            actions
        });

        this.#animateNotification(notification, 'show');

        if (!persistent && duration > 0) {
            setTimeout(() => {
                this.#animateNotification(notification, 'hide');
            }, duration);
        }

        return notification;
    }

    /**
     * Render reminder list with virtual scrolling for performance
     */
    renderReminderList(containerId, reminders, options = {}) {
        const {
            virtualScroll = reminders.length > PERFORMANCE_CONFIG.virtualScrollThreshold,
            itemHeight = 80,
            onItemClick = null
        } = options;

        const container = this.#getComponent(containerId);
        if (!container) return;

        if (virtualScroll) {
            this.#renderVirtualList(container, reminders, itemHeight, onItemClick);
        } else {
            this.#renderStandardList(container, reminders, onItemClick);
        }
    }

    /**
     * Create form with validation and reactive updates
     */
    createForm(containerId, schema, options = {}) {
        const {
            onSubmit = null,
            onValidate = null,
            realTimeValidation = true
        } = options;

        const container = this.#getComponent(containerId);
        if (!container) throw new Error(`Container ${containerId} not found`);

        const form = new FormComponent(schema, {
            onSubmit,
            onValidate,
            realTimeValidation
        });

        container.appendChild(form.element);
        this.#registerComponent(form.id, form);

        return form;
    }

    /**
     * Update statistics display with animations
     */
    updateStatistics(stats) {
        const statsElements = {
            total: this.#getComponent('totalReminders'),
            active: this.#getComponent('activeReminders'),
            completed: this.#getComponent('completedToday'),
            overdue: this.#getComponent('overdue')
        };

        Object.entries(stats).forEach(([key, value]) => {
            const element = statsElements[key];
            if (element) {
                this.#animateCounterUpdate(element, value);
            }
        });
    }

    /**
     * Add event listener with automatic cleanup
     */
    on(event, callback) {
        if (!this.#eventListeners.has(event)) {
            this.#eventListeners.set(event, new Set());
        }
        this.#eventListeners.get(event).add(callback);

        // Return cleanup function
        return () => this.off(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        this.#eventListeners.get(event)?.delete(callback);
    }

    /**
     * Show loading state with better UX
     */
    showLoading(target, message = 'Loading...') {
        const element = typeof target === 'string'
            ? this.#getComponent(target)
            : target;

        if (!element) return;

        const loader = this.#createLoader(message);
        element.dataset.originalContent = element.innerHTML;
        element.appendChild(loader);
        element.classList.add('loading');

        return () => this.hideLoading(element);
    }

    /**
     * Hide loading state
     */
    hideLoading(target) {
        const element = typeof target === 'string'
            ? this.#getComponent(target)
            : target;

        if (!element) return;

        const loader = element.querySelector('.ui-loader');
        loader?.remove();
        element.classList.remove('loading');
    }

    // ===== PRIVATE METHODS =====

    /**
     * Register built-in UI components
     */
    async #registerComponents() {
        // Cache DOM elements
        const elements = [
            'addReminderModal', 'reminderDetailsModal',
            'totalReminders', 'activeReminders', 'completedToday', 'overdue',
            'recentReminders', 'todaySchedule', 'addReminderForm'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.#registerComponent(id, element);
            }
        });

        // Initialize modal components
        await this.#initializeModals();
    }

    /**
     * Register a component in the registry
     */
    #registerComponent(id, component) {
        this.#components.set(id, component);
    }

    /**
     * Get component from registry
     */
    #getComponent(id) {
        return this.#components.get(id) || document.getElementById(id);
    }

    /**
     * Initialize modal components with enhanced functionality
     */
    async #initializeModals() {
        const modals = document.querySelectorAll('.modal');

        modals.forEach(modal => {
            // Setup close handlers
            const closeBtn = modal.querySelector('.close');
            closeBtn?.addEventListener('click', () => this.hideModal(modal.id));

            // Setup overlay click to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal && modal.dataset.preventClose !== 'true') {
                    this.hideModal(modal.id);
                }
            });

            // Setup form submission if present
            const form = modal.querySelector('form');
            if (form) {
                this.#setupFormHandlers(form, modal);
            }
        });
    }

    /**
     * Setup form handlers with validation
     */
    #setupFormHandlers(form, modal) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Emit form submit event
            this.#emit('form:submit', { form, data, modal });
        });

        // Real-time validation
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const debouncedValidation = debounce(
                () => this.#validateField(input),
                PERFORMANCE_CONFIG.debounceDelay
            );

            input.addEventListener('input', debouncedValidation);
            input.addEventListener('blur', () => this.#validateField(input));
        });
    }

    /**
     * Validate form field with visual feedback
     */
    #validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name || field.id;

        // Clear previous errors
        this.#clearFieldError(field);

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            this.#showFieldError(field, `${fieldName} is required`);
            return false;
        }

        // Pattern validation
        const pattern = field.getAttribute('pattern');
        if (pattern && value && !new RegExp(pattern).test(value)) {
            this.#showFieldError(field, `Invalid ${fieldName} format`);
            return false;
        }

        // Length validation
        const maxLength = field.getAttribute('maxlength');
        if (maxLength && value.length > parseInt(maxLength)) {
            this.#showFieldError(field, `${fieldName} is too long`);
            return false;
        }

        // Show success indicator
        this.#showFieldSuccess(field);
        return true;
    }

    /**
     * Show field error with accessibility
     */
    #showFieldError(field, message) {
        field.classList.add('error');
        field.setAttribute('aria-invalid', 'true');

        const errorElement = DOM.createElement('div', {
            className: 'field-error',
            role: 'alert',
            'aria-live': 'polite'
        }, message);

        field.parentNode.insertBefore(errorElement, field.nextSibling);
    }

    /**
     * Show field success indicator
     */
    #showFieldSuccess(field) {
        field.classList.remove('error');
        field.classList.add('valid');
        field.setAttribute('aria-invalid', 'false');
    }

    /**
     * Clear field error state
     */
    #clearFieldError(field) {
        field.classList.remove('error', 'valid');
        field.removeAttribute('aria-invalid');

        const errorElement = field.parentNode.querySelector('.field-error');
        errorElement?.remove();
    }

    /**
     * Clear all form errors
     */
    #clearFormErrors(form) {
        const errorElements = form.querySelectorAll('.field-error');
        errorElements.forEach(el => el.remove());

        const fields = form.querySelectorAll('.error, .valid');
        fields.forEach(field => {
            field.classList.remove('error', 'valid');
            field.removeAttribute('aria-invalid');
        });
    }

    /**
     * Animate modal show/hide with modern CSS
     */
    async #animateModal(modal, action) {
        if (action === 'show') {
            modal.style.display = 'flex';
            modal.classList.add('modal-entering');

            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    modal.classList.add('modal-entered');
                    modal.classList.remove('modal-entering');
                    setTimeout(resolve, UI_CONSTANTS.animation.normal);
                });
            });
        } else {
            modal.classList.add('modal-leaving');

            await new Promise(resolve => {
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.remove('modal-entered', 'modal-leaving');
                    resolve();
                }, UI_CONSTANTS.animation.normal);
            });
        }
    }

    /**
     * Create enhanced notification element
     */
    #createNotification(message, type, options) {
        const { position, persistent, actions } = options;

        const notification = DOM.createElement('div', {
            className: `notification notification-${type}`,
            role: 'alert',
            'aria-live': 'polite',
            style: this.#getNotificationStyles(position)
        });

        // Message content
        const content = DOM.createElement('div', {
            className: 'notification-content'
        }, message);

        notification.appendChild(content);

        // Add action buttons if provided
        if (actions.length > 0) {
            const actionsContainer = DOM.createElement('div', {
                className: 'notification-actions'
            });

            actions.forEach(action => {
                const button = DOM.createElement('button', {
                    className: 'notification-action',
                    onClick: () => {
                        action.callback?.();
                        this.#animateNotification(notification, 'hide');
                    }
                }, action.label);

                actionsContainer.appendChild(button);
            });

            notification.appendChild(actionsContainer);
        }

        // Close button for persistent notifications
        if (persistent) {
            const closeBtn = DOM.createElement('button', {
                className: 'notification-close',
                'aria-label': 'Close notification',
                onClick: () => this.#animateNotification(notification, 'hide')
            }, '×');

            notification.appendChild(closeBtn);
        }

        document.body.appendChild(notification);
        return notification;
    }

    /**
     * Get notification positioning styles
     */
    #getNotificationStyles(position) {
        const baseStyles = `
      position: fixed;
      z-index: ${UI_CONSTANTS.zIndex.notification};
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      color: white;
      font-weight: 500;
      max-width: 400px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      backdrop-filter: blur(10px);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

        const positionStyles = {
            'top-right': 'top: 1rem; right: 1rem;',
            'top-left': 'top: 1rem; left: 1rem; transform: translateX(-100%);',
            'bottom-right': 'bottom: 1rem; right: 1rem;',
            'bottom-left': 'bottom: 1rem; left: 1rem; transform: translateX(-100%);'
        };

        return baseStyles + (positionStyles[position] || positionStyles['top-right']);
    }

    /**
     * Animate notification show/hide
     */
    #animateNotification(notification, action) {
        if (action === 'show') {
            requestAnimationFrame(() => {
                notification.style.transform = 'translateX(0)';
            });
        } else {
            const isLeft = notification.style.left;
            notification.style.transform = isLeft ? 'translateX(-100%)' : 'translateX(100%)';

            setTimeout(() => notification.remove(), UI_CONSTANTS.animation.normal);
        }
    }

    /**
     * Enforce notification limit for performance
     */
    #enforceNotificationLimit() {
        const notifications = document.querySelectorAll('.notification');
        const maxVisible = APP_CONFIG.notifications.maxVisible;

        if (notifications.length >= maxVisible) {
            // Remove oldest notifications
            const toRemove = notifications.length - maxVisible + 1;
            for (let i = 0; i < toRemove; i++) {
                this.#animateNotification(notifications[i], 'hide');
            }
        }
    }

    /**
     * Render virtual list for large datasets
     */
    #renderVirtualList(container, items, itemHeight, onItemClick) {
        const virtualList = new VirtualListComponent(container, {
            items,
            itemHeight,
            onItemClick,
            renderItem: this.#renderReminderItem.bind(this)
        });

        this.#registerComponent(`virtual-${container.id}`, virtualList);
    }

    /**
     * Render standard list for smaller datasets
     */
    #renderStandardList(container, items, onItemClick) {
        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            const element = this.#renderReminderItem(item);
            if (onItemClick) {
                element.addEventListener('click', () => onItemClick(item));
            }
            fragment.appendChild(element);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    /**
     * Render individual reminder item
     */
    #renderReminderItem(reminder) {
        const config = REMINDER_CONFIG.priorities[reminder.priority];
        const statusConfig = REMINDER_CONFIG.statuses[reminder.status];

        return DOM.createElement('div', {
            className: `reminder-item priority-${reminder.priority} status-${reminder.status}`,
            'data-id': reminder.id,
            role: 'button',
            tabindex: '0'
        }, `
      <div class="reminder-indicator" style="background: ${statusConfig.color}"></div>
      <div class="reminder-content">
        <div class="reminder-title">
          ${config.icon} ${reminder.title}
        </div>
        <div class="reminder-time">
          ${this.#formatReminderTime(reminder.datetime)}
        </div>
      </div>
      <div class="reminder-actions">
        <button class="reminder-action" data-action="complete" aria-label="Complete">
          ✓
        </button>
      </div>
    `);
    }

    /**
     * Format reminder time for display
     */
    #formatReminderTime(datetime) {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = date - now;

        if (diffMs < 0) {
            return `Overdue by ${this.#formatDuration(Math.abs(diffMs))}`;
        }

        if (diffMs < 24 * 60 * 60 * 1000) {
            return `In ${this.#formatDuration(diffMs)}`;
        }

        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    /**
     * Format duration for human reading
     */
    #formatDuration(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Animate counter updates with easing
     */
    #animateCounterUpdate(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const difference = targetValue - currentValue;
        const duration = UI_CONSTANTS.animation.normal;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentCount = Math.round(currentValue + (difference * easeOut));

            element.textContent = currentCount;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Create loading spinner component
     */
    #createLoader(message) {
        return DOM.createElement('div', {
            className: 'ui-loader'
        }, `
      <div class="loader-spinner"></div>
      <div class="loader-message">${message}</div>
    `);
    }

    /**
     * Setup keyboard shortcuts with accessibility
     */
    async #setupKeyboardShortcuts() {
        const shortcuts = {
            'Escape': () => this.#handleEscapeKey(),
            'n': (e) => e.ctrlKey && this.#emit('shortcut:new-reminder'),
            'r': (e) => e.ctrlKey && this.#emit('shortcut:refresh'),
            '/': (e) => !e.ctrlKey && this.#focusSearch()
        };

        document.addEventListener('keydown', (e) => {
            const handler = shortcuts[e.key];
            if (handler) {
                handler(e);
                e.preventDefault();
            }
        });
    }

    /**
     * Handle escape key press
     */
    #handleEscapeKey() {
        // Close any open modals
        const openModal = document.querySelector('.modal[style*="flex"]');
        if (openModal) {
            this.hideModal(openModal.id);
        }
    }

    /**
     * Focus search input
     */
    #focusSearch() {
        const searchInput = document.querySelector('[role="search"] input');
        searchInput?.focus();
    }

    /**
     * Setup accessibility features
     */
    async #setupAccessibility() {
        // Announce dynamic content changes
        this.on('state:change', ({ prop, value }) => {
            if (prop === 'statistics') {
                this.#announceToScreenReader(
                    `Statistics updated: ${value.active} active reminders`
                );
            }
        });

        // Setup focus management
        this.#setupFocusManagement();
    }

    /**
     * Setup focus management for modals and components
     */
    #setupFocusManagement() {
        let lastFocusedElement = null;

        this.on('modal:show', ({ modal }) => {
            lastFocusedElement = document.activeElement;

            // Focus first focusable element in modal
            const focusable = modal.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            focusable?.focus();
        });

        this.on('modal:hide', () => {
            lastFocusedElement?.focus();
            lastFocusedElement = null;
        });
    }

    /**
     * Setup modal escape key handler
     */
    #setupModalEscapeHandler(modal) {
        const handler = (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                this.hideModal(modal.id);
                document.removeEventListener('keydown', handler);
            }
        };

        document.addEventListener('keydown', handler);
    }

    /**
     * Announce content to screen readers
     */
    #announceToScreenReader(message) {
        const announcement = DOM.createElement('div', {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            style: 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;'
        }, message);

        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    }

    /**
     * Setup performance optimizations
     */
    #setupPerformanceOptimizations() {
        // Batch DOM updates
        this.#scheduleRender = throttle(() => {
            this.#renderQueue.forEach(fn => fn());
            this.#renderQueue.clear();
        }, 16); // 60fps
    }

    /**
     * Batch multiple state updates
     */
    #batchUpdate(updateFn) {
        const updates = [];
        const originalNotify = this.#notifyStateChange;

        // Collect updates without triggering notifications
        this.#notifyStateChange = (prop, value, oldValue) => {
            updates.push({ prop, value, oldValue });
        };

        updateFn();

        // Restore original notification and trigger batch
        this.#notifyStateChange = originalNotify;
        this.#emit('state:batch-change', { updates });
    }

    /**
     * Notify state change to listeners
     */
    #notifyStateChange(prop, value, oldValue) {
        this.#emit('state:change', { prop, value, oldValue });
    }

    /**
     * Setup global event handlers
     */
    #setupGlobalEventHandlers() {
        // Handle window resize for responsive components
        const debouncedResize = debounce(() => {
            this.#emit('window:resize', {
                width: window.innerWidth,
                height: window.innerHeight
            });
        }, PERFORMANCE_CONFIG.debounceDelay);

        window.addEventListener('resize', debouncedResize);

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            this.#emit('document:visibility-change', {
                hidden: document.hidden
            });
        });
    }

    /**
     * Emit events to listeners
     */
    #emit(eventName, data = {}) {
        const listeners = this.#eventListeners.get(eventName);
        listeners?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${eventName}":`, error);
            }
        });

        // Also emit as DOM event
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

/**
 * Virtual List Component for performance with large datasets
 */
class VirtualListComponent {
    constructor(container, options) {
        this.container = container;
        this.options = options;
        this.visibleStart = 0;
        this.visibleEnd = 0;

        this.#setup();
    }

    #setup() {
        const { items, itemHeight } = this.options;
        const containerHeight = this.container.clientHeight;
        const totalHeight = items.length * itemHeight;

        // Create virtual container
        this.virtualContainer = DOM.createElement('div', {
            style: `height: ${totalHeight}px; position: relative;`
        });

        // Create visible area
        this.visibleArea = DOM.createElement('div', {
            style: 'position: absolute; top: 0; left: 0; right: 0;'
        });

        this.virtualContainer.appendChild(this.visibleArea);
        this.container.appendChild(this.virtualContainer);

        // Setup scroll handler
        this.container.addEventListener('scroll',
            throttle(() => this.#updateVisibleItems(), 16)
        );

        this.#updateVisibleItems();
    }

    #updateVisibleItems() {
        const { items, itemHeight, renderItem } = this.options;
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        const start = Math.floor(scrollTop / itemHeight);
        const end = Math.min(
            start + Math.ceil(containerHeight / itemHeight) + 1,
            items.length
        );

        if (start !== this.visibleStart || end !== this.visibleEnd) {
            this.visibleStart = start;
            this.visibleEnd = end;

            // Clear current items
            this.visibleArea.innerHTML = '';

            // Render visible items
            for (let i = start; i < end; i++) {
                const item = renderItem(items[i]);
                item.style.position = 'absolute';
                item.style.top = `${i * itemHeight}px`;
                item.style.left = '0';
                item.style.right = '0';
                item.style.height = `${itemHeight}px`;

                this.visibleArea.appendChild(item);
            }
        }
    }
}

/**
 * Form Component with validation and reactive updates
 */
class FormComponent {
    constructor(schema, options) {
        this.id = `form-${Date.now()}`;
        this.schema = schema;
        this.options = options;
        this.element = this.#createForm();
        this.#setupValidation();
    }

    #createForm() {
        const form = DOM.createElement('form', {
            id: this.id,
            className: 'dynamic-form'
        });

        Object.entries(this.schema).forEach(([fieldName, config]) => {
            const fieldGroup = this.#createField(fieldName, config);
            form.appendChild(fieldGroup);
        });

        return form;
    }

    #createField(name, config) {
        const { type, label, required, placeholder, options: selectOptions } = config;

        const group = DOM.createElement('div', { className: 'form-group' });

        // Label
        const labelEl = DOM.createElement('label', {
            htmlFor: name,
            className: required ? 'required' : ''
        }, label);

        group.appendChild(labelEl);

        // Input
        let input;
        switch (type) {
            case 'select':
                input = DOM.createElement('select', { id: name, name });
                selectOptions?.forEach(opt => {
                    const option = DOM.createElement('option', { value: opt.value }, opt.label);
                    input.appendChild(option);
                });
                break;
            case 'textarea':
                input = DOM.createElement('textarea', {
                    id: name,
                    name,
                    placeholder,
                    required
                });
                break;
            default:
                input = DOM.createElement('input', {
                    id: name,
                    name,
                    type: type || 'text',
                    placeholder,
                    required
                });
        }

        group.appendChild(input);
        return group;
    }

    #setupValidation() {
        if (!this.options.realTimeValidation) return;

        const inputs = this.element.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const validateField = debounce(() => {
                const isValid = this.#validateField(input);
                this.options.onValidate?.(input.name, input.value, isValid);
            }, 300);

            input.addEventListener('input', validateField);
            input.addEventListener('blur', validateField);
        });
    }

    #validateField(input) {
        const config = this.schema[input.name];
        if (!config) return true;

        const value = input.value.trim();

        // Required validation
        if (config.required && !value) {
            this.#showFieldError(input, `${config.label} is required`);
            return false;
        }

        // Custom validation
        if (config.validate && value) {
            const result = config.validate(value);
            if (result !== true) {
                this.#showFieldError(input, result);
                return false;
            }
        }

        this.#clearFieldError(input);
        return true;
    }

    #showFieldError(input, message) {
        this.#clearFieldError(input);
        input.classList.add('error');

        const error = DOM.createElement('div', {
            className: 'field-error',
            role: 'alert'
        }, message);

        input.parentNode.appendChild(error);
    }

    #clearFieldError(input) {
        input.classList.remove('error');
        const error = input.parentNode.querySelector('.field-error');
        error?.remove();
    }

    populate(data) {
        Object.entries(data).forEach(([key, value]) => {
            const input = this.element.querySelector(`[name="${key}"]`);
            if (input) input.value = value;
        });
    }

    getData() {
        const formData = new FormData(this.element);
        return Object.fromEntries(formData.entries());
    }

    validate() {
        const inputs = this.element.querySelectorAll('input, textarea, select');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.#validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    reset() {
        this.element.reset();
        const errors = this.element.querySelectorAll('.field-error');
        errors.forEach(error => error.remove());

        const errorFields = this.element.querySelectorAll('.error');
        errorFields.forEach(field => field.classList.remove('error'));
    }
}

// Create singleton instance
export const uiService = new UIService();

// Export both class and instance
export default uiService;