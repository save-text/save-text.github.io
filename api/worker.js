/**
 * Cloudflare Worker - Backend API for SaveText
 * Handles saving, loading, and managing texts with GitHub integration
 */

// Environment variables (set in Cloudflare dashboard)
// GITHUB_TOKEN - GitHub Personal Access Token
// GITHUB_REPO - Repository in format "owner/repo"
// KV_NAMESPACE - Cloudflare KV namespace binding

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

// Rate limiting configuration
const RATE_LIMITS = {
    save: { requests: 5, window: 60 * 1000 }, // 5 saves per minute
    load: { requests: 60, window: 60 * 1000 }, // 60 loads per minute
    check: { requests: 30, window: 60 * 1000 }, // 30 checks per minute
};

// Banned patterns
const BANNED_PATTERNS = [
    /^(admin|api|www|mail|ftp|test|null|undefined)$/i,
    /^[0-9]+$/,
    /fuck|shit|ass|porn|xxx/i,
];

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Get client IP for rate limiting
            const clientIP = request.headers.get('CF-Connecting-IP') || 
                           request.headers.get('X-Forwarded-For') || 
                           'unknown';

            // Route handling
            if (path === '/save' && request.method === 'POST') {
                return await this.handleSave(request, env, clientIP);
            }
            
            if (path.startsWith('/load/') && request.method === 'GET') {
                const code = path.replace('/load/', '');
                return await this.handleLoad(code, request, env, clientIP);
            }
            
            if (path.startsWith('/check/') && request.method === 'GET') {
                const code = path.replace('/check/', '');
                return await this.handleCheck(code, env, clientIP);
            }
            
            if (path.startsWith('/delete/') && request.method === 'DELETE') {
                const code = path.replace('/delete/', '');
                return await this.handleDelete(code, request, env, clientIP);
            }

            if (path === '/stats' && request.method === 'GET') {
                return await this.handleStats(env);
            }

            return this.jsonResponse({ error: 'Not found' }, 404);

        } catch (error) {
            console.error('Worker error:', error);
            return this.jsonResponse({ error: 'Internal server error' }, 500);
        }
    },

    /**
     * Handle save requests
     */
    async handleSave(request, env, clientIP) {
        // Rate limit check
        const rateLimitResult = await this.checkRateLimit(env, clientIP, 'save');
        if (!rateLimitResult.allowed) {
            return this.jsonResponse({
                error: 'Rate limit exceeded',
                retryAfter: rateLimitResult.retryAfter
            }, 429);
        }

        // Parse request body
        let data;
        try {
            data = await request.json();
        } catch (e) {
            return this.jsonResponse({ error: 'Invalid JSON' }, 400);
        }

        // Validate required fields
        if (!data.code || !data.content) {
            return this.jsonResponse({ error: 'Missing code or content' }, 400);
        }

        // Validate code format
        if (!/^[a-zA-Z0-9\-_]{6,12}$/.test(data.code)) {
            return this.jsonResponse({ 
                error: 'Invalid code format. Use 6-12 alphanumeric characters, hyphens, or underscores.' 
            }, 400);
        }

        // Check banned patterns
        for (const pattern of BANNED_PATTERNS) {
            if (pattern.test(data.code)) {
                return this.jsonResponse({ error: 'This code is not allowed' }, 400);
            }
        }

        // Check content size (25KB max)
        const contentSize = new TextEncoder().encode(data.content).length;
        if (contentSize > 25 * 1024) {
            return this.jsonResponse({ error: 'Content exceeds 25KB limit' }, 400);
        }

        // Check if code already exists
        const existing = await this.getFromKV(env, data.code);
        if (existing) {
            return this.jsonResponse({ error: 'Code already exists' }, 409);
        }

        // Prepare data for storage
        const storageData = {
            content: data.content,
            created: new Date().toISOString(),
            expires: data.expires || null,
            protected: !!data.passwordHash,
            passwordHash: data.passwordHash || null,
            metadata: data.metadata || {},
            ip: this.hashIP(clientIP), // Store hashed IP for abuse prevention
        };

        // Save to KV store
        await this.saveToKV(env, data.code, storageData);

        // Optionally save to GitHub (for persistence)
        if (env.GITHUB_TOKEN) {
            ctx.waitUntil(this.saveToGitHub(env, data.code, storageData));
        }

        // Increment save counter
        await this.incrementCounter(env, 'total_saves');

        return this.jsonResponse({
            success: true,
            code: data.code,
            url: `/${data.code}`
        }, 201);
    },

    /**
     * Handle load requests
     */
    async handleLoad(code, request, env, clientIP) {
        // Rate limit check
        const rateLimitResult = await this.checkRateLimit(env, clientIP, 'load');
        if (!rateLimitResult.allowed) {
            return this.jsonResponse({
                error: 'Rate limit exceeded',
                retryAfter: rateLimitResult.retryAfter
            }, 429);
        }

        // Validate code format
        if (!/^[a-zA-Z0-9\-_]{6,12}$/.test(code)) {
            return this.jsonResponse({ error: 'Invalid code format' }, 400);
        }

        // Get from KV store
        let data = await this.getFromKV(env, code);

        // If not in KV, try GitHub
        if (!data && env.GITHUB_TOKEN) {
            data = await this.loadFromGitHub(env, code);
            
            // Cache in KV if found
            if (data) {
                await this.saveToKV(env, code, data);
            }
        }

        if (!data) {
            return this.jsonResponse({ error: 'Not found' }, 404);
        }

        // Check expiry
        if (data.expires && new Date(data.expires) < new Date()) {
            await this.deleteFromKV(env, code);
            return this.jsonResponse({ error: 'This text has expired' }, 410);
        }

        // Check password protection
        if (data.protected) {
            const url = new URL(request.url);
            const password = url.searchParams.get('password');
            
            if (!password) {
                return this.jsonResponse({ 
                    error: 'Password required',
                    protected: true 
                }, 401);
            }

            const isValid = await this.verifyPassword(password, data.passwordHash);
            if (!isValid) {
                return this.jsonResponse({ error: 'Invalid password' }, 403);
            }
        }

        // Remove sensitive data before sending
        const response = {
            code,
            content: data.content,
            created: data.created,
            expires: data.expires,
            metadata: data.metadata
        };

        return this.jsonResponse(response, 200);
    },

    /**
     * Handle check requests (availability)
     */
    async handleCheck(code, env, clientIP) {
        // Rate limit check
        const rateLimitResult = await this.checkRateLimit(env, clientIP, 'check');
        if (!rateLimitResult.allowed) {
            return this.jsonResponse({
                error: 'Rate limit exceeded',
                retryAfter: rateLimitResult.retryAfter
            }, 429);
        }

        // Validate code format
        if (!/^[a-zA-Z0-9\-_]{6,12}$/.test(code)) {
            return this.jsonResponse({ available: false, reason: 'Invalid format' }, 200);
        }

        // Check banned patterns
        for (const pattern of BANNED_PATTERNS) {
            if (pattern.test(code)) {
                return this.jsonResponse({ available: false, reason: 'Reserved' }, 200);
            }
        }

        // Check if exists
        const existing = await this.getFromKV(env, code);
        
        return this.jsonResponse({
            available: !existing,
            code
        }, 200);
    },

    /**
     * Handle delete requests
     */
    async handleDelete(code, request, env, clientIP) {
        // Parse request body for password
        let data = {};
        try {
            data = await request.json();
        } catch (e) {
            // No body is OK for non-protected texts
        }

        // Get existing data
        const existing = await this.getFromKV(env, code);
        
        if (!existing) {
            return this.jsonResponse({ error: 'Not found' }, 404);
        }

        // Verify password if protected
        if (existing.protected) {
            if (!data.password) {
                return this.jsonResponse({ error: 'Password required' }, 401);
            }

            const isValid = await this.verifyPassword(data.password, existing.passwordHash);
            if (!isValid) {
                return this.jsonResponse({ error: 'Invalid password' }, 403);
            }
        }

        // Delete from KV
        await this.deleteFromKV(env, code);

        // Delete from GitHub
        if (env.GITHUB_TOKEN) {
            ctx.waitUntil(this.deleteFromGitHub(env, code));
        }

        return this.jsonResponse({ success: true }, 200);
    },

    /**
     * Handle stats requests
     */
    async handleStats(env) {
        const totalSaves = await this.getCounter(env, 'total_saves') || 0;
        
        return this.jsonResponse({
            totalSaves,
            status: 'operational'
        }, 200);
    },

    // ==================== KV Operations ====================

    async saveToKV(env, code, data) {
        const key = `text:${code}`;
        const ttl = data.expires 
            ? Math.floor((new Date(data.expires) - new Date()) / 1000)
            : undefined;
        
        await env.KV_NAMESPACE.put(key, JSON.stringify(data), {
            expirationTtl: ttl
        });
    },

    async getFromKV(env, code) {
        const key = `text:${code}`;
        const data = await env.KV_NAMESPACE.get(key);
        return data ? JSON.parse(data) : null;
    },

    async deleteFromKV(env, code) {
        const key = `text:${code}`;
        await env.KV_NAMESPACE.delete(key);
    },

    // ==================== GitHub Operations ====================

    async saveToGitHub(env, code, data) {
        const path = `data/${code}.json`;
        const content = btoa(JSON.stringify(data, null, 2));
        
        try {
            // Check if file exists
            const existingFile = await this.getGitHubFile(env, path);
            
            const body = {
                message: `Save text: ${code}`,
                content,
                branch: 'main'
            };
            
            if (existingFile?.sha) {
                body.sha = existingFile.sha;
            }
            
            const response = await fetch(
                `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${env.GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'SaveText-Worker'
                    },
                    body: JSON.stringify(body)
                }
            );
            
            return response.ok;
        } catch (error) {
            console.error('GitHub save error:', error);
            return false;
        }
    },

    async loadFromGitHub(env, code) {
        const path = `data/${code}.json`;
        
        try {
            const file = await this.getGitHubFile(env, path);
            
            if (file?.content) {
                const content = atob(file.content.replace(/\n/g, ''));
                return JSON.parse(content);
            }
            
            return null;
        } catch (error) {
            console.error('GitHub load error:', error);
            return null;
        }
    },

    async getGitHubFile(env, path) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
                {
                    headers: {
                        'Authorization': `token ${env.GITHUB_TOKEN}`,
                        'User-Agent': 'SaveText-Worker'
                    }
                }
            );
            
            if (response.ok) {
                return await response.json();
            }
            
            return null;
        } catch (error) {
            return null;
        }
    },

    async deleteFromGitHub(env, code) {
        const path = `data/${code}.json`;
        
        try {
            const file = await this.getGitHubFile(env, path);
            
            if (!file?.sha) return false;
            
            const response = await fetch(
                `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${env.GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'SaveText-Worker'
                    },
                    body: JSON.stringify({
                        message: `Delete text: ${code}`,
                        sha: file.sha,
                        branch: 'main'
                    })
                }
            );
            
            return response.ok;
        } catch (error) {
            console.error('GitHub delete error:', error);
            return false;
        }
    },

    // ==================== Rate Limiting ====================

    async checkRateLimit(env, clientIP, action) {
        const key = `ratelimit:${action}:${this.hashIP(clientIP)}`;
        const limit = RATE_LIMITS[action];
        
        const data = await env.KV_NAMESPACE.get(key);
        const current = data ? JSON.parse(data) : { count: 0, resetAt: Date.now() + limit.window };
        
        // Reset if window expired
        if (Date.now() > current.resetAt) {
            current.count = 0;
            current.resetAt = Date.now() + limit.window;
        }
        
        current.count++;
        
        // Save updated count
        await env.KV_NAMESPACE.put(key, JSON.stringify(current), {
            expirationTtl: Math.ceil(limit.window / 1000)
        });
        
        if (current.count > limit.requests) {
            return {
                allowed: false,
                retryAfter: Math.ceil((current.resetAt - Date.now()) / 1000)
            };
        }
        
        return { allowed: true };
    },

    // ==================== Counters ====================

    async incrementCounter(env, name) {
        const key = `counter:${name}`;
        const current = await env.KV_NAMESPACE.get(key);
        const value = current ? parseInt(current) + 1 : 1;
        await env.KV_NAMESPACE.put(key, value.toString());
        return value;
    },

    async getCounter(env, name) {
        const key = `counter:${name}`;
        const value = await env.KV_NAMESPACE.get(key);
        return value ? parseInt(value) : 0;
    },

    // ==================== Utilities ====================

    hashIP(ip) {
        // Simple hash for privacy
        let hash = 0;
        for (let i = 0; i < ip.length; i++) {
            const char = ip.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    },

    async verifyPassword(password, hash) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return inputHash === hash;
    },

    jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            }
        });
    }
};
