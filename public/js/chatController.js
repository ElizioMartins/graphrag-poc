// Chat Controller - Handles chat logic

import { APIClient } from './apiClient.js';
import { UIView } from './uiView.js';

export class ChatController {
    constructor(uiView) {
        this.uiView = uiView;
        this.questionForm = document.getElementById('question-form');
        this.questionInput = document.getElementById('question-input');
        this.useGraphRAGCheckbox = document.getElementById('use-graph-rag');
        this.sendBtn = document.getElementById('send-btn');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form submit
        this.questionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Input changes
        this.questionInput.addEventListener('input', () => {
            this.uiView.updateCharCount();
        });

        // Enter to submit (Shift+Enter for new line)
        this.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.sendBtn.disabled) {
                    this.handleSubmit();
                }
            }
        });
    }

    async handleSubmit() {
        const question = this.questionInput.value.trim();
        
        if (question.length === 0) {
            return;
        }

        // Get GraphRAG setting
        const useGraphRAG = this.useGraphRAGCheckbox.checked;

        // Disable input
        this.questionInput.disabled = true;
        this.sendBtn.disabled = true;

        // Add user message
        this.uiView.addUserMessage(question);
        this.uiView.clearInput();

        // Show typing indicator
        const typingIndicator = this.uiView.addTypingIndicator();

        try {
            console.log('Sending question:', question);

            // Send question
            const response = await APIClient.sendQuestion(question, useGraphRAG);

            // Remove typing indicator
            this.uiView.removeTypingIndicator();

            if (response.success) {
                // Add assistant response
                this.uiView.addAssistantMessage(response.answer, response.metadata);
            } else {
                // Show error
                this.uiView.showError(response.error || 'Erro ao processar pergunta');
            }
        } catch (error) {
            console.error('Question error:', error);
            this.uiView.removeTypingIndicator();
            this.uiView.showError('Erro de conexão: ' + error.message);
        } finally {
            // Re-enable input
            this.questionInput.disabled = false;
            this.sendBtn.disabled = false;
            this.questionInput.focus();
        }
    }

    async handleSubmitStream() {
        const question = this.questionInput.value.trim();
        
        if (question.length === 0) {
            return;
        }

        const useGraphRAG = this.useGraphRAGCheckbox.checked;

        // Disable input
        this.questionInput.disabled = true;
        this.sendBtn.disabled = true;

        // Add user message
        this.uiView.addUserMessage(question);
        this.uiView.clearInput();

        // Create assistant message placeholder
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';
        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-text"></div>
            </div>
        `;
        this.uiView.chatContainer.appendChild(messageEl);
        
        const textEl = messageEl.querySelector('.message-text');
        let fullText = '';

        try {
            console.log('Sending question (streaming):', question);

            // Send question with streaming
            const metadata = await APIClient.sendQuestionStream(
                question,
                (chunk) => {
                    fullText += chunk;
                    textEl.textContent = fullText;
                    this.uiView.scrollToBottom();
                },
                useGraphRAG
            );

            // Add metadata
            if (metadata) {
                const metadataEl = document.createElement('div');
                metadataEl.className = 'message-metadata';
                metadataEl.innerHTML = `
                    <span>⏱️ ${metadata.processingTime}ms</span>
                    <span>📄 ${metadata.sourcesUsed} fonte(s)</span>
                `;
                messageEl.querySelector('.message-content').appendChild(metadataEl);
            }

        } catch (error) {
            console.error('Streaming error:', error);
            textEl.style.color = 'var(--error)';
            textEl.textContent = 'Erro: ' + error.message;
        } finally {
            // Re-enable input
            this.questionInput.disabled = false;
            this.sendBtn.disabled = false;
            this.questionInput.focus();
        }
    }
}
