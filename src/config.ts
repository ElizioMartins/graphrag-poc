import type { DataType, PretrainedModelOptions } from "@huggingface/transformers";
import { readFileSync, existsSync } from 'node:fs';

const promptsFolder = './prompts';
const promptsFiles = {
    answerPrompt: `${promptsFolder}/answerPrompt.json`,
    template: `${promptsFolder}/template.txt`,
};

export interface TextSplitterConfig {
    chunkSize: number;
    chunkOverlap: number;
}

// Função auxiliar para ler arquivos com fallback
function readConfigFile(path: string, fallback: any = null): any {
    try {
        if (existsSync(path)) {
            return readFileSync(path, 'utf-8');
        }
        console.warn(`⚠️  Arquivo não encontrado: ${path}`);
        return fallback;
    } catch (error) {
        console.error(`❌ Erro ao ler arquivo ${path}:`, error);
        return fallback;
    }
}

// Carregar configurações de prompts (com fallback)
const promptConfigRaw = readConfigFile(promptsFiles.answerPrompt, '{}');
const templateTextRaw = readConfigFile(promptsFiles.template, 'Contexto: {context}\n\nPergunta: {question}\n\nResposta:');

export const CONFIG = Object.freeze({
    // Configurações de prompts
    promptConfig: typeof promptConfigRaw === 'string' 
        ? JSON.parse(promptConfigRaw) 
        : promptConfigRaw,
    templateText: templateTextRaw,

    // Configurações do servidor
    server: {
        port: Number.parseInt(process.env.PORT || '3000', 10),
        host: '0.0.0.0',
    },

    // Configurações de upload
    upload: {
        maxFileSizeMB: Number.parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        allowedMimeTypes: [
            'application/pdf',
            'application/xml',
            'text/xml',
        ],
        allowedExtensions: ['.pdf', '.xml'],
    },

    // Configurações do Neo4j
    neo4j: {
        url: process.env.NEO4J_URI || 'bolt://localhost:7687',
        username: process.env.NEO4J_USER || 'neo4j',
        password: process.env.NEO4J_PASSWORD || 'password',
        indexName: "document_embeddings_index",
        searchType: "vector" as const,
        textNodeProperties: ["text"],
        nodeLabel: "Chunk",
        database: "neo4j", // default database
    },

    // Configurações do OpenRouter (LLM)
    openRouter: {
        nlpModel: process.env.NLP_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        url: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY || '',
        temperature: 0.3,
        maxRetries: 2,
        maxTokens: 2000,
        defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
            "X-Title": process.env.OPENROUTER_SITE_NAME || 'GraphRAG POC',
        }
    },

    // Configurações de embeddings
    embedding: {
        modelName: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
        pretrainedOptions: {
            dtype: "fp32" as DataType, // Options: 'fp32' (best quality), 'fp16' (faster), 'q8', 'q4', 'q4f16' (quantized)
        } satisfies PretrainedModelOptions,
        dimension: 384, // Dimensão do modelo all-MiniLM-L6-v2
    },

    // Configurações de text splitter
    textSplitter: {
        chunkSize: 1000,
        chunkOverlap: 200,
    },

    // Configurações de similaridade
    similarity: {
        topK: 5, // Número de chunks mais similares a recuperar
        scoreThreshold: 0.5, // Threshold mínimo de similaridade (0-1)
    },

    // Configurações de extração de entidades
    entityExtraction: {
        minEntityLength: 3, // Tamanho mínimo de uma entidade
        maxEntityLength: 50, // Tamanho máximo de uma entidade
        minOccurrences: 2, // Mínimo de ocorrências para considerar entidade
    },

    // Configurações de GraphRAG
    graphRAG: {
        enableEntityExtraction: true,
        enableRelationships: true,
        maxGraphDepth: 2, // Profundidade máxima para traversal no grafo
        relationshipTypes: {
            contains: 'CONTAINS', // Document -> Chunk
            mentions: 'MENTIONS', // Chunk -> Entity
            coOccurs: 'CO_OCCURS', // Entity <-> Entity
            relatesTo: 'RELATES_TO', // Document <-> Document
        }
    },

    // Configurações de output
    output: {
        answersFolder: './respostas',
        fileName: 'resposta',
        saveResponses: false, // Salvar respostas em arquivos (útil para debug)
    },

    // Configurações de logging
    logging: {
        level: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
        enableConsole: true,
        enableFile: false,
    }
});

// Validação de configurações críticas
export function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!CONFIG.openRouter.apiKey) {
        errors.push('OPENROUTER_API_KEY não configurada no .env');
    }

    if (!CONFIG.neo4j.url || !CONFIG.neo4j.username || !CONFIG.neo4j.password) {
        errors.push('Configurações do Neo4j incompletas no .env');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// Log de configuração (útil para debug)
export function logConfig(): void {
    console.log('\n📋 Configurações carregadas:');
    console.log(`   Servidor: http://localhost:${CONFIG.server.port}`);
    console.log(`   Neo4j: ${CONFIG.neo4j.url}`);
    console.log(`   LLM: ${CONFIG.openRouter.nlpModel}`);
    console.log(`   Embedding: ${CONFIG.embedding.modelName}`);
    console.log(`   Upload dir: ${CONFIG.upload.uploadDir}`);
    console.log(`   Max file size: ${CONFIG.upload.maxFileSizeMB}MB`);
    
    const validation = validateConfig();
    if (!validation.valid) {
        console.warn('\n⚠️  Avisos de configuração:');
        validation.errors.forEach(error => console.warn(`   - ${error}`));
    }
    console.log('');
}
