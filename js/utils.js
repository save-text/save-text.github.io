/**
 * Utility Functions for SaveText
 */

const Utils = {
    /**
     * Generate a random string of specified length
     */
    generateRandomCode(length = 6) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += chars[randomValues[i] % chars.length];
        }
        return result;
    },

    /**
     * Calculate size of text in bytes
     */
    getByteSize(text) {
        return new Blob([text]).size;
    },

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },

    /**
     * Format date to human readable format
     */
    formatDate(date) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(date).toLocaleDateString('en-US', options);
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (e) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Validate custom code
     */
    isValidCode(code) {
        if (!code) return true; // Empty is valid (will generate random)
        if (code.length < 6 || code.length > 12) return false;
        return /^[a-zA-Z0-9_-]+$/.test(code);
    },

    /**
     * Hash string using SHA-256
     */
    async hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Compress text using LZ-based compression
     */
    compressText(text) {
        try {
            return LZString.compressToEncodedURIComponent(text);
        } catch (e) {
            return null;
        }
    },

    /**
     * Decompress text
     */
    decompressText(compressed) {
        try {
            return LZString.decompressFromEncodedURIComponent(compressed);
        } catch (e) {
            return null;
        }
    },

    /**
     * Generate line numbers for text
     */
    generateLineNumbers(text) {
        const lines = text.split('\n').length;
        return Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    },

    /**
     * Download file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Convert text to different formats
     */
    convertToFormat(text, format, code) {
        const formats = {
            txt: {
                content: text,
                mime: 'text/plain',
                ext: 'txt'
            },
            md: {
                content: text,
                mime: 'text/markdown',
                ext: 'md'
            },
            html: {
                content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SaveText - ${code}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 2rem auto; padding: 1rem; line-height: 1.6; }
        pre { background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`,
                mime: 'text/html',
                ext: 'html'
            },
            json: {
                content: JSON.stringify({
                    code: code,
                    content: text,
                    created: new Date().toISOString(),
                    source: 'save-text.github.io'
                }, null, 2),
                mime: 'application/json',
                ext: 'json'
            },
            rtf: {
                content: `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Courier New;}}\\f0\\fs20 ${text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\par ')}}`,
                mime: 'application/rtf',
                ext: 'rtf'
            }
        };

        return formats[format] || formats.txt;
    },

    /**
     * Simple QR Code generator (minimal implementation)
     */
    generateQRCode(canvas, text, size = 150) {
        // This is a placeholder - in production, use a library like qrcode-generator
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;
        
        // Draw a placeholder pattern
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        ctx.fillStyle = '#000000';
        const cellSize = size / 25;
        
        // Generate a simple pattern based on text hash
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash = hash & hash;
        }
        
        // Draw position patterns
        const drawPositionPattern = (x, y) => {
            ctx.fillRect(x, y, 7 * cellSize, 7 * cellSize);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
            ctx.fillStyle = '#000000';
            ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize);
        };
        
        drawPositionPattern(0, 0);
        ctx.fillStyle = '#000000';
        drawPositionPattern(size - 7 * cellSize, 0);
        ctx.fillStyle = '#000000';
        drawPositionPattern(0, size - 7 * cellSize);
        
        // Draw data pattern
        const seed = Math.abs(hash);
        for (let i = 8; i < 17; i++) {
            for (let j = 8; j < 17; j++) {
                if ((seed * i * j) % 3 === 0) {
                    ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }
    }
};

// LZ-String library (minified) for compression
const LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",n={};function e(r,o){if(!n[r]){n[r]={};for(var e=0;e<r.length;e++)n[r][r.charAt(e)]=e}return n[r][o]}var t={compressToEncodedURIComponent:function(r){return null==r?"":t._compress(r,6,function(r){return o.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),t._decompress(r.length,32,function(n){return e(o,r.charAt(n))}))},_compress:function(o,n,e){if(null==o)return"";var t,i,s,u={},a={},p="",c="",l="",f=2,h=3,d=2,m=[],v=0,g=0;for(s=0;s<o.length;s+=1)if(p=o.charAt(s),Object.prototype.hasOwnProperty.call(u,p)||(u[p]=h++,a[p]=!0),c=l+p,Object.prototype.hasOwnProperty.call(u,c))l=c;else{if(Object.prototype.hasOwnProperty.call(a,l)){if(l.charCodeAt(0)<256){for(t=0;t<d;t++)v<<=1,g==n-1?(g=0,m.push(e(v)),v=0):g++;for(i=l.charCodeAt(0),t=0;t<8;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1}else{for(i=1,t=0;t<d;t++)v=v<<1|i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i=0;for(i=l.charCodeAt(0),t=0;t<16;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1}0==--f&&(f=Math.pow(2,d),d++),delete a[l]}else for(i=u[l],t=0;t<d;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1;0==--f&&(f=Math.pow(2,d),d++),u[c]=h++,l=String(p)}if(""!==l){if(Object.prototype.hasOwnProperty.call(a,l)){if(l.charCodeAt(0)<256){for(t=0;t<d;t++)v<<=1,g==n-1?(g=0,m.push(e(v)),v=0):g++;for(i=l.charCodeAt(0),t=0;t<8;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1}else{for(i=1,t=0;t<d;t++)v=v<<1|i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i=0;for(i=l.charCodeAt(0),t=0;t<16;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1}0==--f&&(f=Math.pow(2,d),d++),delete a[l]}else for(i=u[l],t=0;t<d;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1;0==--f&&(f=Math.pow(2,d),d++)}for(i=2,t=0;t<d;t++)v=v<<1|1&i,g==n-1?(g=0,m.push(e(v)),v=0):g++,i>>=1;for(;;){if(v<<=1,g==n-1){m.push(e(v));break}g++}return m.join("")},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return t}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
