// Upload Manager - Handles file upload logic

import { APIClient } from './apiClient.js';
import { UIView } from './uiView.js';

export class UploadManager {
    constructor(uiView) {
        this.uiView = uiView;
        this.fileInput = document.getElementById('file-input');
        this.uploadBtn = document.getElementById('upload-btn');
        this.clearAllBtn = document.getElementById('clear-all-btn');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Upload button opens file picker
        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File input change triggers upload
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleUpload(e.target.files);
            }
        });

        // Clear all button
        this.clearAllBtn.addEventListener('click', () => {
            this.handleClearAll();
        });

        // Delegate delete buttons
        this.uiView.fileList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-file-btn')) {
                const documentId = e.target.dataset.id;
                this.handleDelete(documentId);
            }
        });
    }

    async handleUpload(files) {
        const fileArray = Array.from(files);
        
        console.log(`Uploading ${fileArray.length} file(s)...`);
        
        // Show modal
        this.uiView.showUploadModal();

        try {
            // Upload with progress
            const result = await APIClient.uploadFiles(files, (percent) => {
                this.uiView.updateUploadProgress(
                    percent,
                    `Fazendo upload... ${Math.round(percent)}%`
                );
            });

            // Processing phase
            this.uiView.updateUploadProgress(
                100,
                'Processando documentos...',
                'Extraindo texto, gerando embeddings e construindo grafo...'
            );

            // Wait a bit for processing to show
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Check results
            if (result.success) {
                console.log('Upload successful:', result);
                
                // Show success details
                const successCount = result.results.filter(r => r.status === 'success').length;
                this.uiView.updateUploadProgress(
                    100,
                    '✅ Processamento concluído!',
                    `${successCount} arquivo(s) processado(s) com sucesso`
                );

                // Wait before closing
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Hide modal
                this.uiView.hideUploadModal();

                // Refresh file list
                await this.refreshFileList();

                // Clear file input
                this.fileInput.value = '';
            } else {
                throw new Error(result.error || 'Upload falhou');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.uiView.updateUploadProgress(
                0,
                '❌ Erro no upload',
                error.message
            );

            // Wait before closing
            await new Promise(resolve => setTimeout(resolve, 3000));
            this.uiView.hideUploadModal();
        }
    }

    async handleDelete(documentId) {
        if (!confirm('Tem certeza que deseja remover este documento?')) {
            return;
        }

        try {
            console.log('Deleting document:', documentId);
            const result = await APIClient.deleteDocument(documentId);
            
            if (result.success) {
                console.log('Document deleted:', result);
                await this.refreshFileList();
            } else {
                alert('Erro ao remover documento: ' + result.error);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Erro ao remover documento: ' + error.message);
        }
    }

    async handleClearAll() {
        const confirmMsg = 'Tem certeza que deseja remover TODOS os documentos?\n\nEsta ação não pode ser desfeita.';
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            // Get all documents
            const documentsResult = await APIClient.getDocuments();
            
            if (!documentsResult.success || documentsResult.documents.length === 0) {
                alert('Não há documentos para remover');
                return;
            }

            // Delete each document
            console.log(`Deleting ${documentsResult.documents.length} documents...`);
            
            for (const doc of documentsResult.documents) {
                await APIClient.deleteDocument(doc.id);
            }

            console.log('All documents deleted');
            await this.refreshFileList();
        } catch (error) {
            console.error('Clear all error:', error);
            alert('Erro ao limpar documentos: ' + error.message);
        }
    }

    async refreshFileList() {
        try {
            const result = await APIClient.getDocuments();
            
            if (result.success) {
                this.uiView.renderFileList(result.documents);
            }
        } catch (error) {
            console.error('Failed to refresh file list:', error);
        }
    }

    async loadInitialDocuments() {
        await this.refreshFileList();
    }
}
