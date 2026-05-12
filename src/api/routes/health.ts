import { Router, type Request, type Response } from 'express';
import { GraphBuilder } from '../../services/graphBuilder.ts';
import { VectorStore } from '../../services/vectorStore.ts';

const router = Router();

/**
 * GET /api/health
 * Verifica status do sistema
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const graphBuilder = new GraphBuilder();
        const vectorStore = new VectorStore();

        // Verificar conexão Neo4j
        const neo4jConnected = await graphBuilder.verifyConnection();
        
        // Tentar obter estatísticas
        let stats = null;
        try {
            await vectorStore.initialize();
            stats = await vectorStore.getStatistics();
            const graphStats = await graphBuilder.getGraphStatistics();
            stats = { ...stats, ...graphStats };
        } catch (error) {
            console.warn('⚠️  Não foi possível obter estatísticas:', error);
        }

        await graphBuilder.close();
        await vectorStore.close();

        const health = {
            status: neo4jConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                neo4j: neo4jConnected ? 'connected' : 'disconnected',
                vectorStore: stats ? 'initialized' : 'not initialized',
            },
            statistics: stats,
        };

        res.status(neo4jConnected ? 200 : 503).json(health);
    } catch (error) {
        console.error('❌ Erro no health check:', error);
        
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
