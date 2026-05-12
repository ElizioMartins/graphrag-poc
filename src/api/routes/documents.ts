import { Router, type Request, type Response } from 'express';
import { GraphBuilder } from '../../services/graphBuilder.ts';

const router = Router();

/**
 * GET /api/documents
 * Lista todos os documentos processados
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const graphBuilder = new GraphBuilder();
        await graphBuilder.verifyConnection();

        // Query Cypher para buscar todos os documentos
        const query = `
            MATCH (d:Document)
            OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)
            WITH d, count(c) as chunkCount
            RETURN 
                d.id as id,
                d.filePath as filePath,
                d.fileType as fileType,
                d.createdAt as createdAt,
                d.metadata as metadata,
                chunkCount
            ORDER BY d.createdAt DESC
        `;

        const results: any = await graphBuilder['driver']
            .session()
            .run(query)
            .then(result => result.records.map(record => ({
                id: record.get('id'),
                filePath: record.get('filePath'),
                fileType: record.get('fileType'),
                createdAt: record.get('createdAt'),
                metadata: record.get('metadata') ? JSON.parse(record.get('metadata')) : {},
                chunkCount: record.get('chunkCount').toNumber(),
            })));

        await graphBuilder.close();

        res.status(200).json({
            success: true,
            count: results.length,
            documents: results,
        });
    } catch (error) {
        console.error('❌ Erro ao listar documentos:', error);
        
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/documents/:id
 * Obtém detalhes de um documento específico
 */
router.get('/:id', async (req: Request, res: Response) => {
    const documentId = req.params.id;

    try {
        const graphBuilder = new GraphBuilder();
        await graphBuilder.verifyConnection();

        // Query para buscar documento e suas entidades
        const query = `
            MATCH (d:Document {id: $documentId})
            OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)
            OPTIONAL MATCH (c)-[:MENTIONS]->(e:Entity)
            WITH d, count(DISTINCT c) as chunkCount, collect(DISTINCT e.name) as entities
            RETURN 
                d.id as id,
                d.filePath as filePath,
                d.fileType as fileType,
                d.createdAt as createdAt,
                d.metadata as metadata,
                chunkCount,
                entities
        `;

        const session = graphBuilder['driver'].session();
        const result = await session.run(query, { documentId });
        await session.close();
        await graphBuilder.close();

        if (result.records.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Documento não encontrado',
            });
        }

        const record = result.records[0]!;
        const document = {
            id: record.get('id'),
            filePath: record.get('filePath'),
            fileType: record.get('fileType'),
            createdAt: record.get('createdAt'),
            metadata: record.get('metadata') ? JSON.parse(record.get('metadata')) : {},
            chunkCount: record.get('chunkCount').toNumber(),
            entities: record.get('entities'),
        };

        res.status(200).json({
            success: true,
            document,
        });
    } catch (error) {
        console.error('❌ Erro ao buscar documento:', error);
        
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * DELETE /api/documents/:id
 * Remove um documento e seus chunks/relações
 */
router.delete('/:id', async (req: Request, res: Response) => {
    const documentId = req.params.id;

    try {
        const graphBuilder = new GraphBuilder();
        await graphBuilder.verifyConnection();

        // Query para remover documento e tudo relacionado
        const query = `
            MATCH (d:Document {id: $documentId})
            OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)
            DETACH DELETE d, c
            RETURN count(c) as deletedChunks
        `;

        const session = graphBuilder['driver'].session();
        const result = await session.run(query, { documentId });
        const deletedChunks = result.records[0]?.get('deletedChunks').toNumber() || 0;
        
        await session.close();
        await graphBuilder.close();

        res.status(200).json({
            success: true,
            message: 'Documento removido com sucesso',
            deletedChunks,
        });
    } catch (error) {
        console.error('❌ Erro ao remover documento:', error);
        
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
