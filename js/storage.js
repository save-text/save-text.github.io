/**
 * Storage Handler
 * Manages saving and loading texts via GitHub API or Cloudflare Worker
 */

class StorageHandler {
    constructor() {
        // Configuration
        this.config = {
            // Use Cloudflare Worker as backend
            workerUrl: 'https://save-text-worker.your-subdomain.workers.dev',
            
            // Fallback to GitHub API directly (requires token)
            githubRepo: 'save-text/save-text.github.io',
            githubBranch: 'main',
            dataPath: 'data',
            
            // Local storage keys
            cachePrefix: 'st_cache_',
            cacheExpiry: 60 * 60 * 1000, // 1 hour
        };
        
        // Cache for loaded texts
        this.cache = new Map();
    }

    /**
     * Save text with a given code
     */
    async saveText(code, content, options = {}) {
        const { expires = null, password = null } = options;
        
        // Prepare data
        const data = {
            code,
            content,
            created: new Date().toISOString(),
            expires,
            protected: !!password,
            metadata: {
                size: new Blob([content]).size,
                lines: content.split('\n').length,
                words: content.trim().split(/\s+/).length
            }
        };
        
        // Hash password if provided
        if (password) {
            data.passwordHash = await this.hashPassword(password);
        }
        
        try {
            // Try Cloudflare Worker first
            const response = await fetch(`${this.config.workerUrl}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Save failed');
            }
            
            const result = await response.json();
            
            // Cache locally
            this.cacheText(code, data);
            
            return { success: true, code, url: `/${code}` };
            
        } catch (error) {
            console.error('Save error:', error);
            
            // Fallback: Save to localStorage for demo
            return this.saveToLocalStorage(code, data);
        }
    }

    /**
     * Load text by code
     */
    async loadText(code, password = null) {
        // Check cache first
        const cached = this.getCachedText(code);
        if (cached) {
            return cached;
        }
        
        try {
            // Try Cloudflare Worker
            const url = new URL(`${this.config.workerUrl}/load/${code}`);
            if (password) {
                url.searchParams.set('password', password);
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                if (response.status === 401) {
                    throw new Error('Password required');
                }
                throw new Error('Load failed');
            }
            
            const data = await response.json();
            
            // Cache the result
            this.cacheText(code, data);
            
            return data;
            
        } catch (error) {
            console.error('Load error:', error);
            
            // Fallback: Try localStorage
            return this.loadFromLocalStorage(code);
        }
    }

    /**
     * Check if a code is available
     */
    async checkCodeAvailability(code) {
        try {
            const response = await fetch(
                `${this.config.workerUrl}/check/${code}`
            );
            
            if (response.ok) {
                const result = await response.json();
                return result.available;
            }
            
            // Fallback: Check localStorage
            const local = localStorage.getItem(`st_text_${code}`);
            return !local;
            
        } catch (error) {
            console.error('Check error:', error);
            
            // Default to checking localStorage
            const local = localStorage.getItem(`st_text_${code}`);
            return !local;
        }
    }

    /**
     * Delete text by code (if authorized)
     */
    async deleteText(code, password = null) {
        try {
            const response = await fetch(`${this.config.workerUrl}/delete/${code}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });
            
            if (!response.ok) {
                throw new Error('Delete failed');
            }
            
            // Remove from cache
            this.cache.delete(code);
            localStorage.removeItem(`${this.config.cachePrefix}${code}`);
            
            return { success: true };
            
        } catch (error) {
            console.error('Delete error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cache text locally
     */
    cacheText(code, data) {
        // Memory cache
        this.cache.set(code, {
            data,
            timestamp: Date.now()
        });
        
        // LocalStorage cache
        try {
            localStorage.setItem(`${this.config.cachePrefix}${code}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            // Storage quota exceeded - clear old caches
            this.clearOldCaches();
        }
    }

    /**
     * Get cached text
     */
    getCachedText(code) {
        // Check memory cache
        const memCached = this.cache.get(code);
        if (memCached && Date.now() - memCached.timestamp < this.config.cacheExpiry) {
            return memCached.data;
        }
        
        // Check localStorage cache
        try {
            const stored = localStorage.getItem(`${this.config.cachePrefix}${code}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Date.now() - parsed.timestamp < this.config.cacheExpiry) {
                    // Refresh memory cache
                    this.cache.set(code, parsed);
                    return parsed.data;
                }
            }
        } catch (e) {
            // Invalid cache data
        }
        
        return null;
    }

    /**
     * Clear old caches
     */
    clearOldCaches() {
        const prefix = this.config.cachePrefix;
        const now = Date.now();
        
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (now - data.timestamp > this.config.cacheExpiry) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    }

    /**
     * Save to localStorage (fallback)
     */
    saveToLocalStorage(code, data) {
        try {
            localStorage.setItem(`st_text_${code}`, JSON.stringify(data));
            return { success: true, code, url: `/${code}` };
        } catch (error) {
            return { success: false, error: 'Storage full' };
        }
    }

    /**
     * Load from localStorage (fallback)
     */
    loadFromLocalStorage(code) {
        try {
            const data = localStorage.getItem(`st_text_${code}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Hash password for storage
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Verify password
     */
    async verifyPassword(password, hash) {
        const inputHash = await this.hashPassword(password);
        return inputHash === hash;
    }

    /**
     * Get storage stats
     */
    getStorageStats() {
        let totalSize = 0;
        let itemCount = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('st_')) {
                const item = localStorage.getItem(key);
                totalSize += item?.length || 0;
                itemCount++;
            }
        }
        
        return {
            itemCount,
            totalSize,
            formattedSize: Utils.formatBytes(totalSize * 2) // UTF-16
        };
    }
}

// Export singleton instance
const Storage = new StorageHandler();
