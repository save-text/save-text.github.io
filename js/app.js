// ============================================
// SaveText - Application JavaScript
// ============================================

const CONFIG = {
    API_URL: 'https://stalica.net/save-text/api',
    MAX_SIZE: 2.5 * 1024 * 1024,
    MAX_CHARS: 2621440
};

// ============================================
// Utilities
// ============================================

const utils = {
    generateId() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    async checkIdAvailability(id) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/check.php?id=${id}`);
            const data = await response.json();
            return !data.exists;
        } catch (error) {
            console.error('Error checking ID:', error);
            return false;
        }
    },

    validateId(id) {
        return /^\d{6}$/.test(id);
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getFileExtension(type) {
        const extensions = {
            'txt': 'txt', 'md': 'md', 'json': 'json',
            'xml': 'xml', 'html': 'html', 'css': 'css',
            'js': 'js', 'py': 'py', 'java': 'java',
            'cpp': 'cpp', 'php': 'php', 'sql': 'sql',
            'yaml': 'yaml', 'other': 'txt'
        };
        return extensions[type] || 'txt';
    },

    formatExpiry(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = date - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours <= 0 && minutes <= 0) return 'Expired';
        if (hours < 1) return `${minutes}m`;
        return `${hours}h ${minutes}m`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================
// Main Application
// ============================================

class SaveTextApp {
    constructor() {
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkViewMode();
    }

    cacheElements() {
        this.els = {
            // Main page elements
            customId: document.getElementById('customId'),
            idStatus: document.querySelector('.id-status'),
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            textEditor: document.getElementById('textEditor'),
            charCount: document.querySelector('.char-count'),
            fileType: document.getElementById('fileType'),
            submitBtn: document.getElementById('submitBtn'),
            resultSection: document.getElementById('resultSection'),
            resultId: document.getElementById('resultId'),
            resultLink: document.getElementById('resultLink'),
            copyBtn: document.getElementById('copyBtn'),
            searchId: document.getElementById('searchId'),
            searchBtn: document.getElementById('searchBtn'),
            
            // View page elements
            viewerContent: document.getElementById('viewerContent'),
            viewerId: document.getElementById('viewerId'),
            viewerType: document.getElementById('viewerType'),
            viewerExpires: document.getElementById('viewerExpires'),
            downloadBtn: document.getElementById('downloadBtn'),
            copyContentBtn: document.getElementById('copyContentBtn'),
            rawBtn: document.getElementById('rawBtn')
        };
    }

    bindEvents() {
        // Custom ID validation
        if (this.els.customId) {
            this.els.customId.addEventListener('input', (e) => {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = value;
                this.validateCustomId(value);
            });
        }

        // Drop zone
        if (this.els.dropZone) {
            this.els.dropZone.addEventListener('click', () => {
                this.els.fileInput.click();
            });

            this.els.dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.els.dropZone.classList.add('drag-over');
            });

            this.els.dropZone.addEventListener('dragleave', () => {
                this.els.dropZone.classList.remove('drag-over');
            });

            this.els.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.els.dropZone.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            });
        }

        // File input
        if (this.els.fileInput) {
            this.els.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        // Text editor
        if (this.els.textEditor) {
            this.els.textEditor.addEventListener('input', (e) => {
                this.updateCharCount(e.target.value);
            });
        }

        // Submit button
        if (this.els.submitBtn) {
            this.els.submitBtn.addEventListener('click', () => {
                this.handleSubmit();
            });
        }

        // Copy button
        if (this.els.copyBtn) {
            this.els.copyBtn.addEventListener('click', () => {
                this.copyToClipboard(this.els.resultLink.value, this.els.copyBtn);
            });
        }

        // Search
        if (this.els.searchBtn) {
            this.els.searchBtn.addEventListener('click', () => {
                this.handleSearch();
            });
        }

        if (this.els.searchId) {
            this.els.searchId.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });

            this.els.searchId.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
    }

    async validateCustomId(id) {
        if (!this.els.idStatus) return;

        if (!id) {
            this.els.idStatus.textContent = '';
            this.els.idStatus.className = 'id-status';
            return;
        }

        if (!utils.validateId(id)) {
            this.els.idStatus.innerHTML = '<i class="bi bi-x-circle"></i>';
            this.els.idStatus.className = 'id-status taken';
            return;
        }

        const available = await utils.checkIdAvailability(id);
        if (available) {
            this.els.idStatus.innerHTML = '<i class="bi bi-check-circle"></i>';
            this.els.idStatus.className = 'id-status available';
        } else {
            this.els.idStatus.innerHTML = '<i class="bi bi-x-circle"></i>';
            this.els.idStatus.className = 'id-status taken';
        }
    }

    async handleFileUpload(file) {
        if (!file) return;

        if (file.size > CONFIG.MAX_SIZE) {
            alert(`File too large. Maximum size is ${utils.formatBytes(CONFIG.MAX_SIZE)}`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.els.textEditor.value = e.target.result;
            this.updateCharCount(e.target.result);

            const ext = file.name.split('.').pop().toLowerCase();
            const option = Array.from(this.els.fileType.options).find(
                opt => opt.value === ext
            );
            if (option) {
                this.els.fileType.value = ext;
            }
        };
        reader.readAsText(file);
    }

    updateCharCount(content) {
        if (!this.els.charCount) return;
        
        const bytes = new Blob([content]).size;
        this.els.charCount.textContent = `${utils.formatBytes(bytes)} / 2.5MB`;
        
        if (bytes > CONFIG.MAX_SIZE) {
            this.els.charCount.style.color = 'var(--color-error)';
        } else {
            this.els.charCount.style.color = '';
        }
    }

    validateContent(content) {
        const byteSize = new Blob([content]).size;
        return byteSize <= CONFIG.MAX_SIZE;
    }

    async handleSubmit() {
        const content = this.els.textEditor.value.trim();
        
        if (!content) {
            alert('Please enter some content');
            return;
        }

        if (!this.validateContent(content)) {
            alert(`Content exceeds maximum size of ${utils.formatBytes(CONFIG.MAX_SIZE)}`);
            return;
        }

        let id = this.els.customId.value.trim();
        
        if (!id) {
            id = utils.generateId();
            let attempts = 0;
            while (!(await utils.checkIdAvailability(id)) && attempts < 10) {
                id = utils.generateId();
                attempts++;
            }
        } else {
            if (!utils.validateId(id)) {
                alert('ID must be exactly 6 digits');
                return;
            }

            if (!(await utils.checkIdAvailability(id))) {
                alert('This ID is already taken');
                return;
            }
        }

        this.els.submitBtn.disabled = true;
        const originalContent = this.els.submitBtn.innerHTML;
        this.els.submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i><span>Saving...</span>';

        try {
            const response = await fetch(`${CONFIG.API_URL}/save.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: id,
                    content: content,
                    fileType: this.els.fileType.value
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showResult(id);
            } else {
                throw new Error(data.message || 'Failed to save');
            }
        } catch (error) {
            alert('Error: ' + error.message);
            console.error('Save error:', error);
        } finally {
            this.els.submitBtn.disabled = false;
            this.els.submitBtn.innerHTML = originalContent;
        }
    }

    showResult(id) {
        const url = `${window.location.origin}/${id}`;
        
        this.els.resultId.textContent = id;
        this.els.resultLink.value = url;
        this.els.resultSection.classList.remove('hidden');

        this.els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            if (button) {
                const icon = button.querySelector('i');
                if (icon) {
                    icon.className = 'bi bi-check';
                    setTimeout(() => {
                        icon.className = 'bi bi-clipboard';
                    }, 2000);
                }
            }
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }

    handleSearch() {
        const id = this.els.searchId.value.trim();
        
        if (!utils.validateId(id)) {
            alert('Please enter a valid 6-digit code');
            return;
        }

        window.location.href = `/${id}`;
    }

    checkViewMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        
        if (id && this.els.viewerContent) {
            this.loadSavedText(id);
        }
    }

    async loadSavedText(id) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/get.php?id=${id}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Not found');
            }

            // Update metadata
            this.els.viewerId.textContent = id;
            this.els.viewerType.textContent = data.fileType.toUpperCase();
            this.els.viewerExpires.textContent = utils.formatExpiry(data.expiresAt);

            // Render content
            const codeLanguages = ['js', 'py', 'java', 'cpp', 'html', 'css', 'json', 'xml', 'php', 'sql', 'yaml'];
            
            if (codeLanguages.includes(data.fileType)) {
                this.els.viewerContent.innerHTML = `<pre><code class="language-${data.fileType}">${utils.escapeHtml(data.content)}</code></pre>`;
                if (typeof hljs !== 'undefined') {
                    hljs.highlightAll();
                }
            } else {
                this.els.viewerContent.innerHTML = `<pre><code>${utils.escapeHtml(data.content)}</code></pre>`;
            }

            // Bind action buttons
            this.els.downloadBtn.addEventListener('click', () => {
                this.downloadContent(data.content, id, data.fileType);
            });

            this.els.copyContentBtn.addEventListener('click', () => {
                this.copyToClipboard(data.content, this.els.copyContentBtn);
            });

            this.els.rawBtn.addEventListener('click', () => {
                window.open(`${CONFIG.API_URL}/raw.php?id=${id}`, '_blank');
            });

        } catch (error) {
            this.els.viewerContent.innerHTML = `
                <div class="error-state">
                    <i class="bi bi-file-earmark-x"></i>
                    <h2>Not Found</h2>
                    <p>This save doesn't exist or has expired.</p>
                    <a href="/" class="btn btn-primary">
                        <i class="bi bi-plus"></i>
                        <span>Create New</span>
                    </a>
                </div>
            `;
        }
    }

    downloadContent(content, id, fileType) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.${utils.getFileExtension(fileType)}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new SaveTextApp();
});
