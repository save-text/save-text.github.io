/**
 * Security Module for SaveText
 * Handles rate limiting, bot detection, and spam prevention
 */

const Security = {
    // Configuration
    config: {
        maxRequestsPerMinute: 10,
        maxRequestsPerHour: 50,
        maxRequestsPerDay: 200,
        minTimeBetweenRequests: 2000, // 2 seconds
        banDuration: 3600000, // 1 hour in ms
        suspiciousPatterns: [
            /(.)\1{20,}/,  // Same character repeated 20+ times
            /<script/i,     // Script tags
            /javascript:/i, // JavaScript protocol
            /data:text\/html/i, // Data URLs
        ]
    },

    // Storage keys
    storageKeys: {
        requests: 'savetext_requests',
        banned: 'savetext_banned',
        fingerprint: 'savetext_fp'
    },

    /**
     * Initialize security module
     */
    init() {
        this.cleanupOldRecords();
        this.generateFingerprint();
    },

    /**
     * Generate a browser fingerprint
     */
    async generateFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.platform
        ];

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('SaveText FP', 2, 2);
        components.push(canvas.toDataURL());

        const fingerprint = await Utils.hashString(components.join('|'));
        localStorage.setItem(this.storageKeys.fingerprint, fingerprint);
        return fingerprint;
    },

    /**
     * Get current fingerprint
     */
    getFingerprint() {
        return localStorage.getItem(this.storageKeys.fingerprint) || 'unknown';
    },

    /**
     * Check if user is banned
     */
    isBanned() {
        const banned = JSON.parse(localStorage.getItem(this.storageKeys.banned) || '{}');
        const fp = this.getFingerprint();
        
        if (banned[fp] && banned[fp] > Date.now()) {
            return true;
        }
        
        // Clean up expired bans
        if (banned[fp]) {
            delete banned[fp];
            localStorage.setItem(this.storageKeys.banned, JSON.stringify(banned));
        }
        
        return false;
    },

    /**
     * Ban user
     */
    banUser(duration = this.config.banDuration) {
        const banned = JSON.parse(localStorage.getItem(this.storageKeys.banned) || '{}');
        const fp = this.getFingerprint();
        banned[fp] = Date.now() + duration;
        localStorage.setItem(this.storageKeys.banned, JSON.stringify(banned));
    },

    /**
     * Record a request
     */
    recordRequest() {
        const requests = JSON.parse(localStorage.getItem(this.storageKeys.requests) || '[]');
        requests.push(Date.now());
        
        // Keep only last 24 hours
        const oneDayAgo = Date.now() - 86400000;
        const filtered = requests.filter(t => t > oneDayAgo);
        
        localStorage.setItem(this.storageKeys.requests, JSON.stringify(filtered));
    },

    /**
     * Check rate limits
     */
    checkRateLimits() {
        const requests = JSON.parse(localStorage.getItem(this.storageKeys.requests) || '[]');
        const now = Date.now();
        
        // Check minimum time between requests
        if (requests.length > 0) {
            const lastRequest = requests[requests.length - 1];
            if (now - lastRequest < this.config.minTimeBetweenRequests) {
                return {
                    allowed: false,
                    reason: 'Please wait a moment before saving again.',
                    waitTime: this.config.minTimeBetweenRequests - (now - lastRequest)
                };
            }
        }

        // Check requests per minute
        const oneMinuteAgo = now - 60000;
        const requestsLastMinute = requests.filter(t => t > oneMinuteAgo).length;
        if (requestsLastMinute >= this.config.maxRequestsPerMinute) {
            return {
                allowed: false,
                reason: 'Too many requests. Please wait a minute.',
                waitTime: 60000
            };
        }

        // Check requests per hour
        const oneHourAgo = now - 3600000;
        const requestsLastHour = requests.filter(t => t > oneHourAgo).length;
        if (requestsLastHour >= this.config.maxRequestsPerHour) {
            return {
                allowed: false,
                reason: 'Hourly limit reached. Please try again later.',
                waitTime: 3600000
            };
        }

        // Check requests per day
        const oneDayAgo = now - 86400000;
        const requestsLastDay = requests.filter(t => t > oneDayAgo).length;
        if (requestsLastDay >= this.config.maxRequestsPerDay) {
            this.banUser();
            return {
                allowed: false,
                reason: 'Daily limit reached. Please try again tomorrow.',
                waitTime: 86400000
            };
        }

        return { allowed: true };
    },

    /**
     * Validate content for suspicious patterns
     */
    validateContent(text) {
        // Check for empty content
        if (!text || text.trim().length === 0) {
            return {
                valid: false,
                reason: 'Content cannot be empty.'
            };
        }

        // Check size
        const size = Utils.getByteSize(text);
        if (size > 25600) {
            return {
                valid: false,
                reason: 'Content exceeds maximum size of 25KB.'
            };
        }

        // Check for suspicious patterns
        for (const pattern of this.config.suspiciousPatterns) {
            if (pattern.test(text)) {
                return {
                    valid: false,
                    reason: 'Content contains suspicious patterns.'
                };
            }
        }

        // Check for entropy (detect random/spam content)
        const entropy = this.calculateEntropy(text);
        if (entropy < 1 && text.length > 100) {
            return {
                valid: false,
                reason: 'Content appears to be spam.'
            };
        }

        return { valid: true };
    },

    /**
     * Calculate Shannon entropy of text
     */
    calculateEntropy(text) {
        const freq = {};
        for (const char of text) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        let entropy = 0;
        const len = text.length;
        for (const char in freq) {
            const p = freq[char] / len;
            entropy -= p * Math.log2(p);
        }
        
        return entropy;
    },

    /**
     * Simple proof of work challenge
     */
    async generateChallenge() {
        const difficulty = 3; // Number of leading zeros required
        const prefix = Utils.generateRandomCode(8);
        return { prefix, difficulty };
    },

    /**
     * Verify proof of work
     */
    async verifyChallenge(prefix, difficulty, nonce) {
        const hash = await Utils.hashString(prefix + nonce);
        const target = '0'.repeat(difficulty);
        return hash.startsWith(target);
    },

    /**
     * Solve proof of work (for legitimate users)
     */
    async solveChallenge(prefix, difficulty) {
        const target = '0'.repeat(difficulty);
        let nonce = 0;
        
        while (true) {
            const hash = await Utils.hashString(prefix + nonce);
            if (hash.startsWith(target)) {
                return nonce;
            }
            nonce++;
            
            // Prevent infinite loop
            if (nonce > 1000000) {
                throw new Error('Challenge too difficult');
            }
            
            // Yield to prevent blocking
            if (nonce % 1000 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    },

    /**
     * Cleanup old records
     */
    cleanupOldRecords() {
        const requests = JSON.parse(localStorage.getItem(this.storageKeys.requests) || '[]');
        const oneDayAgo = Date.now() - 86400000;
        const filtered = requests.filter(t => t > oneDayAgo);
        localStorage.setItem(this.storageKeys.requests, JSON.stringify(filtered));
    },

    /**
     * Full security check
     */
    async performSecurityCheck(text) {
        // Check if banned
        if (this.isBanned()) {
            return {
                passed: false,
                reason: 'You are temporarily banned. Please try again later.'
            };
        }

        // Check rate limits
        const rateCheck = this.checkRateLimits();
        if (!rateCheck.allowed) {
            return {
                passed: false,
                reason: rateCheck.reason
            };
        }

        // Validate content
        const contentCheck = this.validateContent(text);
        if (!contentCheck.valid) {
            return {
                passed: false,
                reason: contentCheck.reason
            };
        }

        return { passed: true };
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    Security.init();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Security;
}
