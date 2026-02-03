/**
 * Main Application Logic
 * Handles text saving, code generation, and UI interactions
 */

class SaveTextApp {
    constructor() {
        this.maxSize = 25 * 1024; // 25KB
        this.minCodeLength = 6;
        this.maxCodeLength = 12;
        this.textarea = null;
        this.saveBtn = null;
        this.customCodeInput = null;
        this.charCounter = null;
        this.modal = null;
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.cacheElements();
            this.bindEvents();
            this.initializeUI();
            this.checkForExistingDraft();
        });
    }

    cacheElements() {
        this.textarea = document.getElementById('text-input');
        this.saveBtn = document.getElementById('save-btn');
        this.customCodeInput = document.getElementById('custom-code');
        this.charCounter = document.getElementById('char-counter');
        this.sizeIndicator = document.getElementById('size-indicator');
        this.modal = document.getElementById('confirm-modal');
        this.previewCode = document.getElementById('preview-code');
        this.previewUrl = document.getElementById('preview-url');
        this.confirmBtn = document.getElementById('confirm-save');
        this.cancelBtn = document.getElementById('cancel-save');
        this.generateBtn = document.getElementById('generate-code');
        this.themeToggle = document.getElementById('theme-toggle');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.notification = document.getElementById('notification');
    }

    bindEvents() {
        // Text input events
        this.textarea?.addEventListener('input', (e) => this.handleTextInput(e));
        this.textarea?.addEventListener('paste', (e) => this.handlePaste(e));
        
        // Save button
        this.saveBtn?.addEventListener('click', () => this.handleSave());
        
        // Custom code input
        this.customCodeInput?.addEventListener('input', (e) => this.validateCustomCode(e));
        this.customCodeInput?.addEventListener('blur', (e) => this.formatCustomCode(e));
        
        // Generate random code
        this.generateBtn?.addEventListener('click', () => this.generateRandomCode());
        
        // Modal buttons
        this.confirmBtn?.addEventListener('click', () => this.confirmSave());
        this.cancelBtn?.addEventListener('click', () => this.closeModal());
        
        // Theme toggle
        this.themeToggle?.addEventListener('click', () => this.toggleTheme());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Auto-save draft
        this.textarea?.addEventListener('input', 
            Utils.debounce(() => this.saveDraft(), 1000)
        );
        
        // Modal overlay click to close
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Window beforeunload
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
    }

    initializeUI() {
        // Set initial theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
        
        // Initialize counter
        this.updateCharCounter();
        
        // Focus textarea
        this.textarea?.focus();
        
        // Generate initial code
        this.generateRandomCode();
        
        // Initialize particles
        this.initParticles();
    }

    handleTextInput(e) {
        const text = e.target.value;
        const byteSize = new Blob([text]).size;
        
        if (byteSize > this.maxSize) {
            // Trim to max size
            let trimmed = text;
            while (new Blob([trimmed]).size > this.maxSize) {
                trimmed = trimmed.slice(0, -1);
            }
            e.target.value = trimmed;
            this.showNotification('Maximum size (25KB) reached', 'warning');
        }
        
        this.updateCharCounter();
        this.updateSaveButton();
    }

    handlePaste(e) {
        const pastedText = e.clipboardData?.getData('text') || '';
        const currentText = this.textarea.value;
        const selectionStart = this.textarea.selectionStart;
        const selectionEnd = this.textarea.selectionEnd;
        
        const newText = currentText.slice(0, selectionStart) + 
                        pastedText + 
                        currentText.slice(selectionEnd);
        
        const byteSize = new Blob([newText]).size;
        
        if (byteSize > this.maxSize) {
            e.preventDefault();
            
            // Calculate how much we can paste
            let allowedPaste = pastedText;
            let testText = currentText.slice(0, selectionStart) + 
                          allowedPaste + 
                          currentText.slice(selectionEnd);
            
            while (new Blob([testText]).size > this.maxSize && allowedPaste.length > 0) {
                allowedPaste = allowedPaste.slice(0, -1);
                testText = currentText.slice(0, selectionStart) + 
                          allowedPaste + 
                          currentText.slice(selectionEnd);
            }
            
            // Insert trimmed paste
            document.execCommand('insertText', false, allowedPaste);
            this.showNotification('Pasted content was trimmed to fit size limit', 'warning');
        }
    }

    updateCharCounter() {
        if (!this.textarea || !this.charCounter || !this.sizeIndicator) return;
        
        const text = this.textarea.value;
        const charCount = text.length;
        const byteSize = new Blob([text]).size;
        const percentage = (byteSize / this.maxSize) * 100;
        
        this.charCounter.textContent = `${charCount.toLocaleString()} characters`;
        this.sizeIndicator.textContent = `${Utils.formatBytes(byteSize)} / 25 KB`;
        
        // Update progress bar
        const progressBar = document.getElementById('size-progress');
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
            progressBar.className = 'progress-fill';
            
            if (percentage > 90) {
                progressBar.classList.add('danger');
            } else if (percentage > 70) {
                progressBar.classList.add('warning');
            }
        }
    }

    updateSaveButton() {
        if (!this.saveBtn || !this.textarea) return;
        
        const hasContent = this.textarea.value.trim().length > 0;
        this.saveBtn.disabled = !hasContent;
    }

    validateCustomCode(e) {
        const input = e.target;
        let value = input.value;
        
        // Only allow alphanumeric, hyphens, and underscores
        value = value.replace(/[^a-zA-Z0-9\-_]/g, '');
        
        // Limit to max length
        if (value.length > this.maxCodeLength) {
            value = value.slice(0, this.maxCodeLength);
        }
        
        input.value = value;
        
        // Update validation UI
        this.updateCodeValidation(value);
    }

    formatCustomCode(e) {
        const input = e.target;
        let value = input.value.toLowerCase();
        
        // Pad with random characters if too short and not empty
        if (value.length > 0 && value.length < this.minCodeLength) {
            const needed = this.minCodeLength - value.length;
            value += Utils.generateRandomString(needed);
            input.value = value;
        }
        
        this.updateCodeValidation(value);
    }

    async updateCodeValidation(code) {
        const validationIcon = document.getElementById('code-validation');
        const validationText = document.getElementById('code-validation-text');
        
        if (!validationIcon || !validationText) return;
        
        if (code.length === 0) {
            validationIcon.className = 'validation-icon';
            validationText.textContent = '';
            return;
        }
        
        if (code.length < this.minCodeLength) {
            validationIcon.className = 'validation-icon warning';
            validationIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            validationText.textContent = `Minimum ${this.minCodeLength} characters`;
            return;
        }
        
        // Check availability
        validationIcon.className = 'validation-icon loading';
        validationIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        validationText.textContent = 'Checking availability...';
        
        try {
            const isAvailable = await Storage.checkCodeAvailability(code);
            
            if (isAvailable) {
                validationIcon.className = 'validation-icon success';
                validationIcon.innerHTML = '<i class="fas fa-check"></i>';
                validationText.textContent = 'Available!';
            } else {
                validationIcon.className = 'validation-icon error';
                validationIcon.innerHTML = '<i class="fas fa-times"></i>';
                validationText.textContent = 'Already taken';
            }
        } catch (error) {
            validationIcon.className = 'validation-icon';
            validationText.textContent = '';
        }
    }

    generateRandomCode() {
        const code = Utils.generateRandomString(6);
        
        if (this.customCodeInput) {
            this.customCodeInput.value = code;
            this.customCodeInput.dispatchEvent(new Event('input'));
        }
        
        return code;
    }

    async handleSave() {
        if (!this.textarea || this.textarea.value.trim().length === 0) {
            this.showNotification('Please enter some text to save', 'error');
            return;
        }

        // Security check
        const securityCheck = await Security.performPreSaveChecks();
        if (!securityCheck.allowed) {
            this.showNotification(securityCheck.message, 'error');
            return;
        }

        const code = this.customCodeInput?.value || this.generateRandomCode();
        
        // Validate code length
        if (code.length < this.minCodeLength || code.length > this.maxCodeLength) {
            this.showNotification(
                `Code must be between ${this.minCodeLength} and ${this.maxCodeLength} characters`,
                'error'
            );
            return;
        }

        // Check availability
        const isAvailable = await Storage.checkCodeAvailability(code);
        if (!isAvailable) {
            this.showNotification('This code is already taken. Please choose another.', 'error');
            return;
        }

        // Show confirmation modal
        this.showConfirmModal(code);
    }

    showConfirmModal(code) {
        if (!this.modal || !this.previewCode || !this.previewUrl) return;
        
        this.previewCode.textContent = code;
        this.previewUrl.textContent = `save-text.github.io/${code}`;
        this.previewUrl.href = `/${code}`;
        
        // Show text preview
        const previewText = document.getElementById('preview-text');
        if (previewText) {
            const text = this.textarea.value;
            previewText.textContent = text.length > 200 
                ? text.slice(0, 200) + '...' 
                : text;
        }
        
        // Show size info
        const previewSize = document.getElementById('preview-size');
        if (previewSize) {
            const byteSize = new Blob([this.textarea.value]).size;
            previewSize.textContent = Utils.formatBytes(byteSize);
        }
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus confirm button
        this.confirmBtn?.focus();
    }

    closeModal() {
        if (!this.modal) return;
        
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async confirmSave() {
        const code = this.previewCode?.textContent;
        const text = this.textarea?.value;
        
        if (!code || !text) return;
        
        this.closeModal();
        this.showLoading(true);
        
        try {
            // Perform security checks again
            const securityCheck = await Security.performPreSaveChecks();
            if (!securityCheck.allowed) {
                throw new Error(securityCheck.message);
            }

            // Save the text
            const result = await Storage.saveText(code, text);
            
            if (result.success) {
                // Clear draft
                this.clearDraft();
                
                // Record successful save for rate limiting
                Security.recordSave();
                
                // Show success and redirect
                this.showNotification('Text saved successfully! Redirecting...', 'success');
                
                setTimeout(() => {
                    window.location.href = `/${code}`;
                }, 1500);
            } else {
                throw new Error(result.error || 'Failed to save text');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showNotification(error.message || 'Failed to save text', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    handleKeyboard(e) {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.handleSave();
        }
        
        // Escape to close modal
        if (e.key === 'Escape' && this.modal?.classList.contains('active')) {
            this.closeModal();
        }
        
        // Ctrl/Cmd + Enter to confirm save
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && 
            this.modal?.classList.contains('active')) {
            this.confirmSave();
        }
    }

    saveDraft() {
        if (!this.textarea) return;
        
        const text = this.textarea.value;
        if (text.trim().length > 0) {
            localStorage.setItem('draft', text);
            localStorage.setItem('draftTime', Date.now().toString());
        }
    }

    checkForExistingDraft() {
        const draft = localStorage.getItem('draft');
        const draftTime = localStorage.getItem('draftTime');
        
        if (draft && draftTime) {
            const age = Date.now() - parseInt(draftTime);
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (age < maxAge && this.textarea) {
                // Show draft recovery option
                this.showDraftRecovery(draft);
            } else {
                this.clearDraft();
            }
        }
    }

    showDraftRecovery(draft) {
        const draftBanner = document.getElementById('draft-banner');
        if (!draftBanner) return;
        
        draftBanner.classList.add('active');
        
        document.getElementById('restore-draft')?.addEventListener('click', () => {
            this.textarea.value = draft;
            this.updateCharCounter();
            this.updateSaveButton();
            draftBanner.classList.remove('active');
            this.showNotification('Draft restored', 'success');
        });
        
        document.getElementById('discard-draft')?.addEventListener('click', () => {
            this.clearDraft();
            draftBanner.classList.remove('active');
        });
    }

    clearDraft() {
        localStorage.removeItem('draft');
        localStorage.removeItem('draftTime');
    }

    handleBeforeUnload(e) {
        if (this.textarea?.value.trim().length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = this.themeToggle?.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    showLoading(show) {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.toggle('active', show);
        }
    }

    showNotification(message, type = 'info') {
        if (!this.notification) return;
        
        const icon = this.notification.querySelector('.notification-icon');
        const text = this.notification.querySelector('.notification-text');
        
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
        
        this.notification.className = `notification ${type} active`;
        
        setTimeout(() => {
            this.notification.classList.remove('active');
        }, 4000);
    }

    initParticles() {
        const canvas = document.getElementById('particles');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        let particles = [];
        
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        
        resize();
        window.addEventListener('resize', resize);
        
        class Particle {
            constructor() {
                this.reset();
            }
            
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
                this.opacity = Math.random() * 0.5 + 0.2;
            }
            
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                
                if (this.x < 0 || this.x > canvas.width ||
                    this.y < 0 || this.y > canvas.height) {
                    this.reset();
                }
            }
            
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99, 102, 241, ${this.opacity})`;
                ctx.fill();
            }
        }
        
        // Create particles
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }
        
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            
            // Draw connections
            particles.forEach((p1, i) => {
                particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 150) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 * (1 - distance / 150)})`;
                        ctx.stroke();
                    }
                });
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
}

// Initialize app
const app = new SaveTextApp();
