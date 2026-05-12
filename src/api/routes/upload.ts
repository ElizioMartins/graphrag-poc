import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { CONFIG } from '../../config.ts';
import { DocumentProcessor } from '../../services/documentProcessor.ts';
import { EntityExtractor } from '../../services/entityExtractor.ts';
import { GraphBuilder } from '../../services/graphBuilder.ts';
import { VectorStore } from '../../services/vectorStore.ts';

const router = Router();

// Configurar diretório de upload
const uploadDir = CONFIG.upload.uploadDir;
if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
}

// Configurar Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Nome único: timestamp + nome original
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: CONFIG.upload.maxFileSizeMB * 1024 * 1024, // Converter para bytes
    },
    fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        
        // Verificar extensão
        if (!CONFIG.upload.allowedExtensions.includes(ext)) {
            return cb(new Error(`Tipo de arquivo não suportado: ${ext}. Permitidos: ${CONFIG.upload.allowedExtensions.join(', ')}`));
        }

        // Verificar MIME type
        if (!CONFIG.upload.allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error(`MIME type não suportado: ${file.mimetype}`));
        }

        cb(null, true);
    }
});

/**
 * POST /api/upload
 * Faz upload e processa documentos
 */
router.post('/', upload.array('files', 10), async (req: Request, res: Response) => {
    const uploadedFiles = req.files as Express.Multer.File[];

    if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Nenhum arquivo foi enviado',
        });
    }

    console.log(`\n📤 Recebidos ${uploadedFiles.length} arquivo(s) para upload`);

    try {
        // Instanciar serviços
        const documentProcessor = new DocumentProcessor();
        const entityExtractor = new EntityExtractor();
        const graphBuilder = new GraphBuilder();
        const vectorStore = new VectorStore();

        await vectorStore.initialize();
        await graphBuilder.verifyConnection();

        const results = [];

        // Processar cada arquivo
        for (const file of uploadedFiles) {
            const filePath = file.path;
            const fileName = file.originalname;

            console.log(`\n📄 Processando: ${fileName}`);

            try {
                // 1. Processar documento (parse + chunking)
                const chunks = await documentProcessor.loadAndSplit(filePath);

                if (chunks.length === 0) {
                    throw new Error('Nenhum conteúdo extraído do documento');
                }

                // 2. Criar nó do documento no grafo
                const fileType = extname(fileName).substring(1);
                const documentId = await graphBuilder.createDocumentNode(filePath, fileType, {
                    originalName: fileName,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                });

                // 3. Criar chunks no grafo
                await graphBuilder.createChunkNodes(documentId, chunks);

                // 4. Adicionar chunks ao vector store (com embeddings)
                await vectorStore.addDocuments(chunks);

                // 5. Extrair entidades (se habilitado)
                if (CONFIG.graphRAG.enableEntityExtraction) {
                    const texts = chunks.map(c => c.pageContent);
                    const entities = entityExtractor.extractEntities(texts);

                    if (entities.length > 0) {
                        // Criar nós de entidades
                        await graphBuilder.createEntityNodes(entities);

                        // Criar relacionamentos MENTIONS
                        await graphBuilder.createMentionsRelationships(documentId, chunks, entities);

                        // Encontrar e criar co-ocorrências
                        if (CONFIG.graphRAG.enableRelationships) {
                            const coOccurrences = entityExtractor.findCoOccurrences(texts, entities);
                            await graphBuilder.createCoOccurrenceRelationships(coOccurrences);
                        }

                        console.log(`✅ Entidades processadas: ${entities.length}`);
                    }
                }

                results.push({
                    fileName,
                    status: 'success',
                    chunks: chunks.length,
                    documentId,
                });

                console.log(`✅ Arquivo processado com sucesso: ${fileName}`);
            } catch (error) {
                console.error(`❌ Erro ao processar ${fileName}:`, error);
                
                results.push({
                    fileName,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Fechar conexões
        await vectorStore.close();
        await graphBuilder.close();

        // Verificar se houve algum sucesso
        const successCount = results.filter(r => r.status === 'success').length;
        const failCount = results.filter(r => r.status === 'error').length;

        const response = {
            success: successCount > 0,
            message: `${successCount} arquivo(s) processado(s) com sucesso, ${failCount} falha(s)`,
            results,
        };

        console.log(`\n✅ Upload concluído: ${successCount}/${uploadedFiles.length} sucesso\n`);

        res.status(200).json(response);
    } catch (error) {
        console.error('❌ Erro no processamento de upload:', error);
        
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// Tratamento de erro do Multer
router.use((error: any, req: Request, res: Response, next: any) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: `Arquivo muito grande. Tamanho máximo: ${CONFIG.upload.maxFileSizeMB}MB`,
            });
        }
        return res.status(400).json({
            success: false,
            error: `Erro no upload: ${error.message}`,
        });
    }
    
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.message || 'Erro no upload',
        });
    }
    
    next();
});

export default router;
