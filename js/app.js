// Configuration - UPDATED FOR YOUR SETUP
const CONFIG = {
    API_URL: 'https://stalica.net/save-text/api',
    MAX_SIZE: 2.5 * 1024 * 1024,
    MAX_CHARS: 2621440
};

// Utility Functions
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
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    getFileExtension(type) {
        const extensions = {
            'txt': 'txt', 'md': 'md', 'json': 'json',
            'xml': 'xml', 'html': 'html', 'css': 'css',
            'js': 'js', 'py': 'py', 'java': 'java',
            'cpp': 'cpp', 'php': 'php', 'other': 'txt'
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
        return `${hours}h ${minutes}m`;
    }
};

// Main Application
class SaveTextApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.checkViewMode();
    }

    setupElements() {
        this.elements = {
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
            searchBtn: document.getElementById('searchBtn')
        };
    }

    setupEventListeners() {
        if (this.elements.customId) {
            this.elements.customId.addEventListener('input', (e) => {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = value;
                this.validateCustomId(value);
            });
        }

        if (this.elements.dropZone) {
            this.elements.dropZone.addEventListener('click', () => {
                this.elements.fileInput.click();
            });

            this.elements.dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.elements.dropZone.classList.add('drag-over');
            });

            this.elements.dropZone.addEventListener('dragleave', () => {
                this.elements.dropZone.classList.remove('drag-over');
            });

            this.elements.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.elements.dropZone.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            });
        }

        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        if (this.elements.textEditor) {
            this.elements.textEditor.addEventListener('input', (e) => {
                this.updateCharCount(e.target.value.length);
            });
        }

        if (this.elements.submitBtn) {
            this.elements.submitBtn.addEventListener('click', () => {
                this.handleSubmit();
            });
        }

        if (this.elements.copyBtn) {
            this.elements.copyBtn.addEventListener('click', () => {
                this.copyToClipboard(this.elements.resultLink.value);
            });
        }

        if (this.elements.searchBtn) {
            this.elements.searchBtn.addEventListener('click', () => {
                this.handleSearch();
            });
        }

        if (this.elements.searchId) {
            this.elements.searchId.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });

            this.elements.searchId.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
    }

    async validateCustomId(id) {
        if (!id) {
            this.elements.idStatus.textContent = '';
            this.elements.idStatus.className = 'id-status';
            return;
        }

        if (!utils.validateId(id)) {
            this.elements.idStatus.textContent = '❌ Must be 6 digits';
            this.elements.idStatus.className = 'id-status taken';
            return;
        }

        const available = await utils.checkIdAvailability(id);
        if (available) {
            this.elements.idStatus.textContent = '✅ Available';
            this.elements.idStatus.className = 'id-status available';
        } else {
            this.elements.idStatus.textContent = '❌ Already taken';
            this.elements.idStatus.className = 'id-status taken';
        }
    }

    async handleFileUpload(file) {
        if (!file) return;

        if (file.size > CONFIG.MAX_SIZE) {
            alert(`File too large! Max size is ${utils.formatBytes(CONFIG.MAX_SIZE)}`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.elements.textEditor.value = e.target.result;
            this.updateCharCount(e.target.result.length);

            const ext = file.name.split('.').pop().toLowerCase();
            const option = Array.from(this.elements.fileType.options).find(
                opt => opt.value === ext
            );
            if (option) {
                this.elements.fileType.value = ext;
            }
        };
        reader.readAsText(file);
    }

    updateCharCount(length) {
        this.elements.charCount.textContent = `${length.toLocaleString()} / ${CONFIG.MAX_CHARS.toLocaleString()} characters`;
        
        if (length > CONFIG.MAX_CHARS) {
            this.elements.charCount.style.color = 'var(--error)';
        } else {
            this.elements.charCount.style.color = 'var(--text-secondary)';
        }
    }

    validateContent(content) {
        const byteSize = new Blob([content]).size;
        return byteSize <= CONFIG.MAX_SIZE;
    }

    async handleSubmit() {
        const content = this.elements.textEditor.value.trim();
        
        if (!content) {
            alert('Please enter some content!');
            return;
        }

        if (!this.validateContent(content)) {
            alert(`Content too large! Max size is ${utils.formatBytes(CONFIG.MAX_SIZE)}`);
            return;
        }

        let id = this.elements.customId.value.trim();
        
        if (!id) {
            id = utils.generateId();
            while (!(await utils.checkIdAvailability(id))) {
                id = utils.generateId();
            }
        } else {
            if (!utils.validateId(id)) {
                alert('ID must be exactly 6 digits!');
                return;
            }

            if (!(await utils.checkIdAvailability(id))) {
                alert('This ID is already taken!');
                return;
            }
        }

        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.innerHTML = '<span>⏳ Saving...</span>';

        try {
            const response = await fetch(`${CONFIG.API_URL}/save.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: id,
                    content: content,
                    fileType: this.elements.fileType.value
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
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.innerHTML = '<span>🚀 Save Text</span>';
        }
    }

    showResult(id) {
        const url = `${window.location.origin}/${id}`;
        
        this.elements.resultId.textContent = id;
        this.elements.resultLink.value = url;
        this.elements.resultSection.classList.remove('hidden');

        this.elements.resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = this.elements.copyBtn.textContent;
            this.elements.copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                this.elements.copyBtn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Failed to copy to clipboard');
        });
    }

    handleSearch() {
        const id = this.elements.searchId.value.trim();
        
        if (!utils.validateId(id)) {
            alert('Please enter a valid 6-digit ID');
            return;
        }

        window.location.href = `/${id}`;
    }

    checkViewMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        
        if (id && document.getElementById('viewerContent')) {
            this.loadSavedText(id);
        }
    }

    async loadSavedText(id) {
        const viewerContent = document.getElementById('viewerContent');
        const viewerId = document.getElementById('viewerId');
        const viewerType = document.getElementById('viewerType');
        const viewerExpires = document.getElementById('viewerExpires');
        const downloadBtn = document.getElementById('downloadBtn');
        const copyContentBtn = document.getElementById('copyContentBtn');
        const rawBtn = document.getElementById('rawBtn');

        try {
            const response = await fetch(`${CONFIG.API_URL}/get.php?id=${id}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Not found');
            }

            viewerId.textContent = id;
            viewerType.textContent = data.fileType.toUpperCase();
            viewerExpires.textContent = utils.formatExpiry(data.expiresAt);

            const codeLanguages = ['js', 'py', 'java', 'cpp', 'html', 'css', 'json', 'xml', 'php'];
            
            if (codeLanguages.includes(data.fileType)) {
                viewerContent.innerHTML = `<pre><code class="language-${data.fileType}">${this.escapeHtml(data.content)}</code></pre>`;
                if (typeof hljs !== 'undefined') {
                    hljs.highlightAll();
                }
            } else {
                viewerContent.innerHTML = `<pre>${this.escapeHtml(data.content)}</pre>`;
            }

            downloadBtn.addEventListener('click', () => {
                this.downloadContent(data.content, id, data.fileType);
            });

            copyContentBtn.addEventListener('click', () => {
                this.copyToClipboard(data.content);
                copyContentBtn.textContent = '✅ Copied!';
                setTimeout(() => {
                    copyContentBtn.textContent = '📋 Copy';
                }, 2000);
            });

            rawBtn.addEventListener('click', () => {
                window.open(`${CONFIG.API_URL}/raw.php?id=${id}`, '_blank');
            });

        } catch (error) {
            viewerContent.innerHTML = `
                <div class="error-message">
                    <h2>❌ Not Found</h2>
                    <p>This save doesn't exist or has expired.</p>
                    <a href="/" class="btn-primary" style="display: inline-block; text-decoration: none; width: auto;">
                        Create New Save
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SaveTextApp();
});
