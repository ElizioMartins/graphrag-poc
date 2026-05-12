// Main entry point

import { APIClient } from './apiClient.js';
import { UIView } from './uiView.js';
import { UploadManager } from './uploadManager.js';
import { ChatController } from './chatController.js';

class App {
    constructor() {
        this.uiView = new UIView();
        this.uploadManager = new UploadManager(this.uiView);
        this.chatController = new ChatController(this.uiView);
    }

    async init() {
        console.log('🚀 Initializing GraphRAG POC...');

        // Check system health
        await this.checkHealth();

        // Load initial documents
        await this.uploadManager.loadInitialDocuments();

        console.log('✅ App initialized');
    }

    async checkHealth() {
        try {
            const health = await APIClient.checkHealth();
            
            if (health.status === 'healthy') {
                this.uiView.setStatus('online', 'Sistema online');
                console.log('✅ System healthy:', health);
            } else {
                this.uiView.setStatus('error', 'Sistema offline');
                console.warn('⚠️ System unhealthy:', health);
            }
        } catch (error) {
            this.uiView.setStatus('error', 'Erro de conexão');
            console.error('❌ Health check failed:', error);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new App();
        app.init();
    });
} else {
    const app = new App();
    app.init();
}
