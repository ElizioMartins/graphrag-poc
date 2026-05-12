// API Client - Handles all API requests

const API_BASE = globalThis.location.origin + '/api';

export class APIClient {
    /**
     * Check system health
     */
    static async checkHealth() {
        try {
            const response = await fetch(`${API_BASE}/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Upload files
     * @param {FileList} files - Files to upload
     * @param {Function} onProgress - Progress callback
     */
    static async uploadFiles(files, onProgress = null) {
        const formData = new FormData();
        
        for (const file of files) {
            formData.append('files', file);
        }

        try {
            const xhr = new XMLHttpRequest();
            
            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed: ${xhr.statusText}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'));
                });

                xhr.open('POST', `${API_BASE}/upload`);
                xhr.send(formData);
            });
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    /**
     * Get list of documents
     */
    static async getDocuments() {
        try {
            const response = await fetch(`${API_BASE}/documents`);
            return await response.json();
        } catch (error) {
            console.error('Failed to get documents:', error);
            throw error;
        }
    }

    /**
     * Get document details
     * @param {string} documentId - Document ID
     */
    static async getDocument(documentId) {
        try {
            const response = await fetch(`${API_BASE}/documents/${documentId}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to get document:', error);
            throw error;
        }
    }

    /**
     * Delete document
     * @param {string} documentId - Document ID
     */
    static async deleteDocument(documentId) {
        try {
            const response = await fetch(`${API_BASE}/documents/${documentId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to delete document:', error);
            throw error;
        }
    }

    /**
     * Send question to chat
     * @param {string} question - User question
     * @param {boolean} useGraphRAG - Whether to use GraphRAG
     */
    static async sendQuestion(question, useGraphRAG = true) {
        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, useGraphRAG })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to send question:', error);
            throw error;
        }
    }

    /**
     * Send question with streaming response
     * @param {string} question - User question
     * @param {Function} onChunk - Callback for each chunk
     * @param {boolean} useGraphRAG - Whether to use GraphRAG
     */
    static async sendQuestionStream(question, onChunk, useGraphRAG = true) {
        try {
            const response = await fetch(`${API_BASE}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, useGraphRAG })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            onChunk(data.chunk);
                        } else if (data.done) {
                            return data.metadata;
                        } else if (data.error) {
                            throw new Error(data.error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming failed:', error);
            throw error;
        }
    }
}
