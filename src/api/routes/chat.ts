import { Router, type Request, type Response } from 'express';
import { AIService } from '../../services/aiService.ts';

const router = Router();

/**
 * POST /api/chat
 * Envia uma pergunta e recebe resposta usando RAG
 */
router.post('/', async (req: Request, res: Response) => {
    const { question, useGraphRAG } = req.body;

    // Validação
    if (!question || typeof question !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Campo "question" é obrigatório e deve ser uma string',
        });
    }

    if (question.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Pergunta não pode ser vazia',
        });
    }

    console.log(`\n💬 Recebida pergunta: "${question}"`);

    try {
        const aiService = new AIService();
        await aiService.initialize();

        // Determinar useGraphRAG (padrão: true)
        const useGraphRAGValue = useGraphRAG === undefined ? true : useGraphRAG;

        // Gerar resposta
        const response = await aiService.answerQuestion(
            question.trim(),
            useGraphRAGValue
        );

        await aiService.close();

        // Verificar se houve erro
        if (response.error) {
            return res.status(500).json({
                success: false,
                error: response.error,
            });
        }

        // Retornar resposta
        res.status(200).json({
            success: true,
            answer: response.answer,
            metadata: {
                model: response.metadata?.model,
                processingTime: response.metadata?.processingTime,
                sourcesUsed: response.context?.totalSources || 0,
                chunksRetrieved: response.context?.chunks.length || 0,
                graphExpansion: response.context?.expandedChunks?.length || 0,
            }
        });
    } catch (error) {
        console.error('❌ Erro ao processar pergunta:', error);
        
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/chat/stream
 * Envia uma pergunta e recebe resposta via streaming (Server-Sent Events)
 */
router.post('/stream', async (req: Request, res: Response) => {
    const { question, useGraphRAG } = req.body;

    // Validação
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Campo "question" é obrigatório e não pode ser vazio',
        });
    }

    console.log(`\n💬 Recebida pergunta (streaming): "${question}"`);

    try {
        // Configurar SSE (Server-Sent Events)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const aiService = new AIService();
        await aiService.initialize();

        // Callback para enviar chunks
        const sendChunk = (chunk: string) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        };

        // Gerar resposta com streaming
        const response = await aiService.answerQuestionStream(
            question.trim(),
            sendChunk
        );

        // Enviar metadados finais
        res.write(`data: ${JSON.stringify({ 
            done: true,
            metadata: {
                model: response.metadata?.model,
                processingTime: response.metadata?.processingTime,
                sourcesUsed: response.context?.totalSources || 0,
            }
        })}\n\n`);

        await aiService.close();
        res.end();
    } catch (error) {
        console.error('❌ Erro no streaming:', error);
        
        // Enviar erro via SSE
        res.write(`data: ${JSON.stringify({ 
            error: error instanceof Error ? error.message : String(error)
        })}\n\n`);
        
        res.end();
    }
});

export default router;
