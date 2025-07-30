/**
 * Storage Utilities - Safe localStorage/sessionStorage wrapper
 */

import { StorageError, ERROR_CODES } from '../types/interfaces.js';

export class SafeStorage {
  constructor(storageType = 'localStorage') {
    this.storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
    this.isAvailable = this.checkAvailability();
  }

  checkAvailability() {
    try {
      const testKey = '__storage_test__';
      this.storage.setItem(testKey, 'test');
      this.storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  set(key, value, options = {}) {
    if (!this.isAvailable) {
      throw new StorageError('Storage not available', ERROR_CODES.STORAGE_UNAVAILABLE);
    }

    try {
      const data = {
        value,
        timestamp: Date.now(),
        expires: options.expires ? Date.now() + options.expires : null
      };

      const serialized = JSON.stringify(data);

      // Check size limit (rough estimate)
      if (serialized.length > 5 * 1024 * 1024) { // 5MB
        throw new StorageError('Data too large', ERROR_CODES.QUOTA_EXCEEDED);
      }

      this.storage.setItem(key, serialized);

      if (options.timestamp) {
        this.storage.setItem('${key}_timestamp', Date.now().toString());
      }

      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded(key, value, options);
        return true;
      }
      throw new StorageError('Failed to store data: ${error.message}', ERROR_CODES.STORAGE_UNAVAILABLE);
    }
  }

  get(key, defaultValue = null) {
    if (!this.isAvailable) return defaultValue;

    try {
      const item = this.storage.getItem(key);
      if (!item) return defaultValue;

      const data = JSON.parse(item);

      // Check expiration
      if (data.expires && Date.now() > data.expires) {
        this.remove(key);
        return defaultValue;
      }

      return data.value;
    } catch (error) {
      console.warn('Storage get error for key "${key}":', error);
      this.remove(key); // Clean up corrupted data
      return defaultValue;
    }
  }

  remove(key) {
    if (!this.isAvailable) return false;

    try {
      this.storage.removeItem(key);
      this.storage.removeItem('${key}_timestamp');
      return true;
    } catch (error) {
      console.warn('Storage remove error for key "${key}":', error);
      return false;
    }
  }

  clear() {
    if (!this.isAvailable) return false;

    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.warn('Storage clear error:', error);
      return false;
    }
  }

  keys() {
    if (!this.isAvailable) return [];

    try {
      return Object.keys(this.storage);
    } catch {
      return [];
    }
  }

  size() {
    if (!this.isAvailable) return 0;

    try {
      return this.keys().length;
    } catch {
      return 0;
    }
  }

  getUsage() {
    if (!this.isAvailable) return { used: 0, available: 0 };

    try {
      let used = 0;
      this.keys().forEach(key => {
        const item = this.storage.getItem(key);
        used += item ? item.length : 0;
      });

      // Rough estimate of available space
      const available = 5 * 1024 * 1024 - used; // 5MB typical limit

      return {
        used,
        available: Math.max(0, available),
        percentage: (used / (5 * 1024 * 1024)) * 100
      };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  handleQuotaExceeded(key, value, options) {
    try {
      // Get all items with timestamps
      const items = this.keys()
        .filter(k => !k.endsWith('_timestamp'))
        .map(k => ({
          key: k,
          timestamp: parseInt(this.storage.getItem('${k}_timestamp') || '0'),
          size: (this.storage.getItem(k) || '').length
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest items until we have space
      const targetSize = JSON.stringify({ value, timestamp: Date.now() }).length;
      let freedSpace = 0;

      for (const item of items) {
        if (freedSpace >= targetSize || item.key === key) break;

        this.remove(item.key);
        freedSpace += item.size;
      }

      // Try again
      this.set(key, value, options);
    } catch (error) {
      throw new StorageError('Storage quota exceeded and cleanup failed', ERROR_CODES.QUOTA_EXCEEDED);
    }
  }

  // Batch operations
  setMultiple(items) {
    const results = {};

    Object.entries(items).forEach(([key, value]) => {
      try {
        this.set(key, value);
        results[key] = { success: true };
      } catch (error) {
        results[key] = { success: false, error: error.message };
      }
    });

    return results;
  }

  getMultiple(keys) {
    const results = {};

    keys.forEach(key => {
      results[key] = this.get(key);
    });

    return results;
  }

  // Advanced operations
  exists(key) {
    return this.get(key) !== null;
  }

  touch(key) {
    const value = this.get(key);
    if (value !== null) {
      this.set(key, value, { timestamp: true });
      return true;
    }
    return false;
  }

  cleanup() {
    if (!this.isAvailable) return 0;

    let cleaned = 0;
    const now = Date.now();

    this.keys().forEach(key => {
      if (key.endsWith('_timestamp')) return;

      try {
        const item = this.storage.getItem(key);
        if (!item) return;

        const data = JSON.parse(item);
        if (data.expires && now > data.expires) {
          this.remove(key);
          cleaned++;
        }
      } catch {
        // Remove corrupted items
        this.remove(key);
        cleaned++;
      }
    });

    return cleaned;
  }
}

// Global storage instances
export const LocalStorage = new SafeStorage('localStorage');
export const SessionStorage = new SafeStorage('sessionStorage');

// Enhanced storage with encryption (simple XOR for demo)
export class SecureStorage extends SafeStorage {
  constructor(storageType = 'localStorage', secretKey = 'default_key') {
    super(storageType);
    this.secretKey = secretKey;
  }

  encrypt(text) {
    if (typeof text !== 'string') return text;

    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ this.secretKey.charCodeAt(i % this.secretKey.length)
      );
    }
    return btoa(result); // Base64 encode
  }

  decrypt(encryptedText) {
    if (typeof encryptedText !== 'string') return encryptedText;

    try {
      const text = atob(encryptedText); // Base64 decode
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
          text.charCodeAt(i) ^ this.secretKey.charCodeAt(i % this.secretKey.length)
        );
      }
      return result;
    } catch {
      return encryptedText; // Return as-is if decryption fails
    }
  }

  set(key, value, options = {}) {
    const encryptedValue = typeof value === 'string' ? this.encrypt(value) : value;
    return super.set(key, encryptedValue, options);
  }

  get(key, defaultValue = null) {
    const value = super.get(key, defaultValue);
    return typeof value === 'string' ? this.decrypt(value) : value;
  }
}

// Storage utilities
export const StorageUtils = {
  // Check if storage is available
  isStorageAvailable: (type = 'localStorage') => {
    try {
      const storage = window[type];
      const testKey = '__test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  },

  // Get storage size in bytes
  getStorageSize: (type = 'localStorage') => {
    try {
      const storage = window[type];
      let size = 0;

      for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
          size += storage.getItem(key).length + key.length;
        }
      }

      return size;
    } catch {
      return 0;
    }
  },

  // Format bytes to human readable
  formatBytes: (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return '${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}';
  },

  // Migrate data between storage types
  migrate: (fromType, toType, keys = null) => {
    try {
      const fromStorage = window[fromType];
      const toStorage = window[toType];

      const keysToMigrate = keys || Object.keys(fromStorage);
      let migrated = 0;

      keysToMigrate.forEach(key => {
        try {
          const value = fromStorage.getItem(key);
          if (value !== null) {
            toStorage.setItem(key, value);
            migrated++;
          }
        } catch (error) {
          console.warn('Failed to migrate key "${key}":', error);
        }
      });

      return migrated;
    } catch (error) {
      console.error('Migration failed:', error);
      return 0;
    }
  },

  // Backup storage to JSON
  backup: (type = 'localStorage') => {
    try {
      const storage = window[type];
      const backup = {};

      for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
          backup[key] = storage.getItem(key);
        }
      }

      return {
        timestamp: new Date().toISOString(),
        type,
        data: backup
      };
    } catch (error) {
      console.error('Backup failed:', error);
      return null;
    }
  },

  // Restore from backup
  restore: (backup, type = 'localStorage', options = { clear: false }) => {
    try {
      const storage = window[type];

      if (options.clear) {
        storage.clear();
      }

      let restored = 0;
      Object.entries(backup.data || {}).forEach(([key, value]) => {
        try {
          storage.setItem(key, value);
          restored++;
        } catch (error) {
          console.warn('Failed to restore key "${key}":', error);
        }
      });

      return restored;
    } catch (error) {
      console.error('Restore failed:', error);
      return 0;
    }
  }
};

export default {
  SafeStorage,
  SecureStorage,
  LocalStorage,
  SessionStorage,
  StorageUtils
};