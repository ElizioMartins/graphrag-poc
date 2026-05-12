import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG, logConfig, validateConfig } from '../config.ts';

// Configurar timeouts do Node.js para downloads grandes
// Aumentar timeout de conexão e headersTimeout
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-http-header-size=16384`;

// Importar rotas
import healthRoutes from './routes/health.ts';
import uploadRoutes from './routes/upload.ts';
import documentsRoutes from './routes/documents.ts';
import chatRoutes from './routes/chat.ts';

// Criar aplicação Express
const app: Express = express();
const PORT = CONFIG.server.port;

// Middlewares
app.use(cors()); // CORS para permitir frontend acessar API
app.use(express.json({ limit: '50mb' })); // Parse JSON
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Servir arquivos estáticos (frontend)
const publicPath = join(process.cwd(), 'public');
if (existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log(`📁 Servindo arquivos estáticos de: ${publicPath}`);
} else {
    console.warn(`⚠️  Pasta public não encontrada: ${publicPath}`);
}

// Rotas da API
app.use('/api/health', healthRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/chat', chatRoutes);

// Rota raiz - servir index.html ou info da API
app.get('/', (req: Request, res: Response) => {
    const indexPath = join(publicPath, 'index.html');
    
    if (existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({
            name: 'GraphRAG POC API',
            version: '1.0.0',
            description: 'API para sistema RAG com GraphRAG',
            endpoints: {
                health: 'GET /api/health',
                upload: 'POST /api/upload',
                documents: {
                    list: 'GET /api/documents',
                    get: 'GET /api/documents/:id',
                    delete: 'DELETE /api/documents/:id',
                },
                chat: {
                    question: 'POST /api/chat',
                    stream: 'POST /api/chat/stream',
                }
            },
            frontend: 'http://localhost:' + PORT,
        });
    }
});

// Tratamento de erro 404
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        path: req.path,
    });
});

// Tratamento de erros global
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Erro não tratado:', error);
    
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message,
    });
});

// Iniciar servidor
function startServer() {
    // Validar configurações
    console.log('\n🔍 Validando configurações...');
    logConfig();
    
    const validation = validateConfig();
    if (!validation.valid) {
        console.error('\n❌ Erros de configuração:');
        validation.errors.forEach(error => console.error(`   - ${error}`));
        console.error('\n⚠️  Por favor, configure o arquivo .env corretamente');
        console.error('   Copie .env.example para .env e preencha as variáveis\n');
        process.exit(1);
    }

    // Iniciar servidor
    app.listen(PORT, CONFIG.server.host, () => {
        console.log('\n' + '='.repeat(80));
        console.log('🚀 Servidor GraphRAG POC iniciado!');
        console.log('='.repeat(80));
        console.log(`📍 URL: http://localhost:${PORT}`);
        console.log(`🌐 API: http://localhost:${PORT}/api`);
        console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
        console.log(`📤 Upload: POST http://localhost:${PORT}/api/upload`);
        console.log(`💬 Chat: POST http://localhost:${PORT}/api/chat`);
        console.log('='.repeat(80));
        console.log('\n✅ Servidor pronto para receber requisições!\n');
    });
}

// Tratamento de sinais de término
process.on('SIGINT', () => {
    console.log('\n\n🛑 Encerrando servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Encerrando servidor...');
    process.exit(0);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejeição não tratada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
    process.exit(1);
});

// Iniciar
startServer();

export default app;
