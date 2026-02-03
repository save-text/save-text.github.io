/**
 * Viewer Logic
 * Handles displaying, copying, and downloading saved texts
 */

class TextViewer {
    constructor() {
        this.code = null;
        this.textData = null;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.code = this.getCodeFromUrl();
            
            if (this.code) {
                this.loadText();
            }
            
            this.bindEvents();
            this.initializeTheme();
        });
    }

    getCodeFromUrl() {
        const path = window.location.pathname;
        const code = path.replace(/^\//, '').replace(/\/$/, '');
        
        if (code && /^[a-zA-Z0-9\-_]{6,12}$/.test(code)) {
            return code;
        }
        
        return null;
    }

    bindEvents() {
        // Copy button
        document.getElementById('copy-btn')?.addEventListener('click', () => this.copyText());
        
        // Copy URL button
        document.getElementById('copy-url-btn')?.addEventListener('click', () => this.copyUrl());
        
        // Download buttons
        document.getElementById('download-txt')?.addEventListener('click', () => this.download('txt'));
        document.getElementById('download-md')?.addEventListener('click', () => this.download('md'));
        document.getElementById('download-html')?.addEventListener('click', () => this.download('html'));
        document.getElementById('download-json')?.addEventListener('click', () => this.download('json'));
        document.getElementById('download-rtf')?.addEventListener('click', () => this.download('rtf'));
        
        // Raw view toggle
        document.getElementById('raw-toggle')?.addEventListener('click', () => this.toggleRawView());
        
        // Word wrap toggle
        document.getElementById('wrap-toggle')?.addEventListener('click', () => this.toggleWordWrap());
        
        // Line numbers toggle
        document.getElementById('lines-toggle')?.addEventListener('click', () => this.toggleLineNumbers());
        
        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        
        // Print button
        document.getElementById('print-btn')?.addEventListener('click', () => this.printText());
        
        // QR Code button
        document.getElementById('qr-btn')?.addEventListener('click', () => this.showQRCode());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    async loadText() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('text-content');
        const errorContainer = document.getElementById('error-container');
        
        if (loader) loader.classList.add('active');
        
        try {
            this.textData = await Storage.loadText(this.code);
            
            if (!this.textData) {
                throw new Error('Text not found');
            }
            
            // Display text
            if (content) {
                content.textContent = this.textData.content;
                content.classList.add('loaded');
            }
            
            // Update metadata
            this.updateMetadata();
            
            // Show content, hide loader
            document.getElementById('viewer-container')?.classList.add('loaded');
            
            // Record view
            this.recordView();
            
        } catch (error) {
            console.error('Load error:', error);
            
            if (errorContainer) {
                errorContainer.classList.add('active');
                document.getElementById('error-code')?.textContent 
                    = `/${this.code}`;
            }
            
        } finally {
            if (loader) loader.classList.remove('active');
        }
    }

    updateMetadata() {
        if (!this.textData) return;
        
        const content = this.textData.content;
        
        // Character count
        document.getElementById('char-count').textContent 
            = content.length.toLocaleString();
        
        // Word count
        const words = content.trim().split(/\s+/).filter(w => w.length > 0);
        document.getElementById('word-count').textContent 
            = words.length.toLocaleString();
        
        // Line count
        const lines = content.split('\n');
        document.getElementById('line-count').textContent 
            = lines.length.toLocaleString();
        
        // Size
        const byteSize = new Blob([content]).size;
        document.getElementById('size-info').textContent 
            = Utils.formatBytes(byteSize);
        
        // Created date
        if (this.textData.created) {
            const date = new Date(this.textData.created);
            document.getElementById('created-date').textContent 
                = Utils.formatDate(date);
        }
        
        // Expiry (if applicable)
        if (this.textData.expires) {
            const expiry = new Date(this.textData.expires);
            document.getElementById('expiry-info').textContent 
                = Utils.formatDate(expiry);
            document.getElementById('expiry-container')?.classList.add('active');
        }
        
        // Update page title
        document.title = `${this.code} | SaveText`;
        
        // Update line numbers
        this.updateLineNumbers();
    }

    updateLineNumbers() {
        const lineNumbers = document.getElementById('line-numbers');
        const content = this.textData?.content;
        
        if (!lineNumbers || !content) return;
        
        const lines = content.split('\n');
        lineNumbers.innerHTML = lines
            .map((_, i) => `<span>${i + 1}</span>`)
            .join('');
    }

    async copyText() {
        if (!this.textData?.content) return;
        
        try {
            await navigator.clipboard.writeText(this.textData.content);
            this.showNotification('Text copied to clipboard!', 'success');
            this.animateButton('copy-btn');
        } catch (error) {
            // Fallback for older browsers
            this.fallbackCopy(this.textData.content);
        }
    }

    async copyUrl() {
        const url = window.location.href;
        
        try {
            await navigator.clipboard.writeText(url);
            this.showNotification('URL copied to clipboard!', 'success');
            this.animateButton('copy-url-btn');
        } catch (error) {
            this.fallbackCopy(url);
        }
    }

    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification('Copied to clipboard!', 'success');
        } catch (error) {
            this.showNotification('Failed to copy', 'error');
        }
        
        document.body.removeChild(textarea);
    }

    download(format) {
        if (!this.textData?.content) return;
        
        const content = this.textData.content;
        let data, mimeType, extension;
        
        switch (format) {
            case 'txt':
                data = content;
                mimeType = 'text/plain';
                extension = 'txt';
                break;
                
            case 'md':
                data = content;
                mimeType = 'text/markdown';
                extension = 'md';
                break;
                
            case 'html':
                data = this.convertToHTML(content);
                mimeType = 'text/html';
                extension = 'html';
                break;
                
            case 'json':
                data = JSON.stringify({
                    code: this.code,
                    content: content,
                    created: this.textData.created,
                    metadata: {
                        characters: content.length,
                        words: content.trim().split(/\s+/).length,
                        lines: content.split('\n').length,
                        bytes: new Blob([content]).size
                    }
                }, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
                
            case 'rtf':
                data = this.convertToRTF(content);
                mimeType = 'application/rtf';
                extension = 'rtf';
                break;
                
            default:
                return;
        }
        
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.code}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Downloaded as ${extension.toUpperCase()}`, 'success');
    }

    convertToHTML(content) {
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>\n');
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.code} - SaveText</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 2rem auto;
            padding: 1rem;
            line-height: 1.6;
            background: #1a1a2e;
            color: #eee;
        }
        .header {
            border-bottom: 1px solid #333;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        .content {
            white-space: pre-wrap;
            font-family: 'Monaco', 'Menlo', monospace;
            background: #16213e;
            padding: 1.5rem;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SaveText: ${this.code}</h1>
        <p>Created: ${this.textData.created || 'Unknown'}</p>
    </div>
    <div class="content">${escaped}</div>
</body>
</html>`;
    }

    convertToRTF(content) {
        const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\n/g, '\\par\n');
        
        return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Courier New;}}
{\\colortbl;\\red255\\green255\\blue255;}
\\f0\\fs20
${escaped}
}`;
    }

    toggleRawView() {
        const container = document.getElementById('viewer-container');
        const btn = document.getElementById('raw-toggle');
        
        container?.classList.toggle('raw-view');
        
        if (btn) {
            const isRaw = container?.classList.contains('raw-view');
            btn.innerHTML = isRaw 
                ? '<i class="fas fa-eye"></i> Formatted'
                : '<i class="fas fa-code"></i> Raw';
        }
    }

    toggleWordWrap() {
        const content = document.getElementById('text-content');
        const btn = document.getElementById('wrap-toggle');
        
        content?.classList.toggle('no-wrap');
        
        if (btn) {
            const isWrapped = !content?.classList.contains('no-wrap');
            btn.classList.toggle('active', isWrapped);
        }
    }

    toggleLineNumbers() {
        const container = document.getElementById('content-wrapper');
        const btn = document.getElementById('lines-toggle');
        
        container?.classList.toggle('show-lines');
        
        if (btn) {
            const showLines = container?.classList.contains('show-lines');
            btn.classList.toggle('active', showLines);
        }
    }

    printText() {
        window.print();
    }

    async showQRCode() {
        const modal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qr-code');
        
        if (!modal || !qrContainer) return;
        
        // Generate QR code
        qrContainer.innerHTML = '';
        
        // Use QR code library or create SVG
        const url = window.location.href;
        const qrSvg = await this.generateQRCode(url);
        qrContainer.innerHTML = qrSvg;
        
        modal.classList.add('active');
        
        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    async generateQRCode(text) {
        // Simple QR code placeholder - in production use a library
        return `
            <div class="qr-placeholder">
                <i class="fas fa-qrcode"></i>
                <p>${text}</p>
            </div>
        `;
    }

    recordView() {
        // Increment view count (stored locally for demo)
        const views = JSON.parse(localStorage.getItem('viewCounts') || '{}');
        views[this.code] = (views[this.code] || 0) + 1;
        localStorage.setItem('viewCounts', JSON.stringify(views));
    }

    handleKeyboard(e) {
        // Ctrl/Cmd + C on selection copies, otherwise copies all
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            const selection = window.getSelection();
            if (!selection || selection.toString().length === 0) {
                e.preventDefault();
                this.copyText();
            }
        }
        
        // Ctrl/Cmd + S to download
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.download('txt');
        }
        
        // Ctrl/Cmd + P to print
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            this.printText();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-toggle')?.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    animateButton(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        btn.classList.add('clicked');
        setTimeout(() => btn.classList.remove('clicked'), 200);
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        const icon = notification.querySelector('.notification-icon');
        const text = notification.querySelector('.notification-text');
        
        if (icon) {
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            icon.className = `notification-icon fas ${icons[type] || icons.info}`;
        }
        
        if (text) {
            text.textContent = message;
        }
        
        notification.className = `notification ${type} active`;
        
        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }
}

// Initialize viewer if on a text page
const viewer = new TextViewer();
