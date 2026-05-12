// UI View - Manages DOM manipulation

export class UIView {
    constructor() {
        // Sidebar elements
        this.fileList = document.getElementById('file-list');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusDot = this.statusIndicator.querySelector('.status-dot');
        this.statusText = this.statusIndicator.querySelector('.status-text');

        // Main elements
        this.chatContainer = document.getElementById('chat-container');
        this.questionInput = document.getElementById('question-input');
        this.sendBtn = document.getElementById('send-btn');
        this.charCount = document.getElementById('char-count');

        // Modal
        this.uploadModal = document.getElementById('upload-modal');
        this.uploadProgress = document.getElementById('upload-progress');
        this.uploadStatus = document.getElementById('upload-status');
        this.uploadDetails = document.getElementById('upload-details');
    }

    /**
     * Update status indicator
     */
    setStatus(status, text) {
        this.statusDot.className = `status-dot ${status}`;
        this.statusText.textContent = text;
    }

    /**
     * Render file list
     */
    renderFileList(documents) {
        if (documents.length === 0) {
            this.fileList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📄</span>
                    <p>Nenhum documento ainda</p>
                    <p class="empty-hint">Faça upload para começar</p>
                </div>
            `;
            return;
        }

        this.fileList.innerHTML = documents.map(doc => {
            const fileName = this.extractFileName(doc.filePath);
            const fileIcon = this.getFileIcon(doc.fileType);
            const date = new Date(doc.createdAt).toLocaleString('pt-BR');

            return `
                <div class="file-item" data-id="${doc.id}">
                    <span class="file-icon">${fileIcon}</span>
                    <div class="file-info">
                        <div class="file-name" title="${fileName}">${fileName}</div>
                        <div class="file-meta">${doc.chunkCount} chunks • ${date}</div>
                    </div>
                    <div class="file-actions">
                        <button class="delete-file-btn" data-id="${doc.id}" title="Remover">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Show upload modal
     */
    showUploadModal() {
        this.uploadModal.classList.remove('hidden');
        this.updateUploadProgress(0, 'Iniciando upload...');
    }

    /**
     * Hide upload modal
     */
    hideUploadModal() {
        this.uploadModal.classList.add('hidden');
    }

    /**
     * Update upload progress
     */
    updateUploadProgress(percent, status, details = '') {
        const progressFill = this.uploadProgress.querySelector('.progress-fill');
        progressFill.style.width = `${percent}%`;
        this.uploadStatus.textContent = status;
        this.uploadDetails.textContent = details;
    }

    /**
     * Add user message to chat
     */
    addUserMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message user';
        messageEl.innerHTML = `
            <div class="message-avatar">👤</div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(text)}</div>
            </div>
        `;

        // Remove welcome message if exists
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        this.chatContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    /**
     * Add assistant message to chat
     */
    addAssistantMessage(text, metadata = null) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';
        
        let metadataHtml = '';
        if (metadata) {
            metadataHtml = `
                <div class="message-metadata">
                    <span>⏱️ ${metadata.processingTime}ms</span>
                    <span>📄 ${metadata.sourcesUsed} fonte(s)</span>
                    <span>🔍 ${metadata.chunksRetrieved} chunk(s)</span>
                    ${metadata.graphExpansion ? `<span>🔗 +${metadata.graphExpansion} via grafo</span>` : ''}
                </div>
            `;
        }

        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(text)}</div>
                ${metadataHtml}
            </div>
        `;

        this.chatContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    /**
     * Add typing indicator
     */
    addTypingIndicator() {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant typing-indicator-msg';
        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.chatContainer.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl;
    }

    /**
     * Remove typing indicator
     */
    removeTypingIndicator() {
        const indicator = this.chatContainer.querySelector('.typing-indicator-msg');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Clear input
     */
    clearInput() {
        this.questionInput.value = '';
        this.updateCharCount();
    }

    /**
     * Update character count
     */
    updateCharCount() {
        const count = this.questionInput.value.length;
        this.charCount.textContent = count;
        
        // Enable/disable send button
        this.sendBtn.disabled = count === 0;
    }

    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 100);
    }

    /**
     * Extract file name from path
     */
    extractFileName(path) {
        return path.split(/[/\\]/).pop() || path;
    }

    /**
     * Get file icon based on type
     */
    getFileIcon(type) {
        const icons = {
            'pdf': '📕',
            'xml': '📜',
        };
        return icons[type] || '📄';
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'message assistant';
        errorEl.innerHTML = `
            <div class="message-avatar">⚠️</div>
            <div class="message-content">
                <div class="message-text" style="color: var(--error);">${this.escapeHtml(message)}</div>
            </div>
        `;

        this.chatContainer.appendChild(errorEl);
        this.scrollToBottom();
    }
}
