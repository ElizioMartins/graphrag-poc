import type { Document } from "@langchain/core/documents";
import { VectorStore } from './vectorStore.ts';
import { GraphBuilder } from './graphBuilder.ts';
import { CONFIG } from '../config.ts';

export interface RAGContext {
    chunks: Document[];
    scores: number[];
    expandedChunks?: Document[]; // Chunks encontrados via graph traversal
    entities?: string[]; // Entidades relacionadas
    totalSources: number;
}

export class RAGService {
    private vectorStore: VectorStore;
    private graphBuilder: GraphBuilder;

    constructor() {
        this.vectorStore = new VectorStore();
        this.graphBuilder = new GraphBuilder();
    }

    /**
     * Inicializa os serviços
     */
    async initialize(): Promise<void> {
        console.log('🚀 Inicializando RAG Service...');
        await this.vectorStore.initialize();
        await this.graphBuilder.verifyConnection();
        console.log('✅ RAG Service inicializado');
    }

    /**
     * Recupera contexto relevante usando vector search + GraphRAG
     * @param query Query do usuário
     * @param topK Número de chunks iniciais a recuperar
     * @param useGraphExpansion Se deve expandir via grafo
     * @returns Contexto recuperado
     */
    async retrieveContext(
        query: string,
        topK: number = CONFIG.similarity.topK,
        useGraphExpansion: boolean = CONFIG.graphRAG.enableRelationships
    ): Promise<RAGContext> {
        console.log(`\n🔍 Recuperando contexto para query: "${query.substring(0, 80)}..."`);
        console.log(`   Configuração: topK=${topK}, graphExpansion=${useGraphExpansion}`);

        // Passo 1: Vector similarity search
        const vectorResults = await this.vectorStore.similaritySearchWithScore(query, topK);

        if (vectorResults.length === 0) {
            console.log('⚠️  Nenhum resultado encontrado');
            return {
                chunks: [],
                scores: [],
                totalSources: 0,
            };
        }

        const chunks = vectorResults.map(([doc, _]) => doc);
        const scores = vectorResults.map(([_, score]) => score);

        console.log(`✅ Vector search: ${chunks.length} chunks encontrados`);
        scores.forEach((score, i) => {
            console.log(`   Chunk ${i + 1}: score = ${score.toFixed(3)}`);
        });

        // Se GraphRAG não está habilitado, retornar apenas vector search
        if (!useGraphExpansion) {
            return {
                chunks,
                scores,
                totalSources: this.countUniqueSources(chunks),
            };
        }

        // Passo 2: Graph expansion
        try {
            const expandedContext = await this.expandViaGraph(chunks);
            
            return {
                chunks,
                scores,
                expandedChunks: expandedContext.chunks,
                entities: expandedContext.entities,
                totalSources: this.countUniqueSources([...chunks, ...expandedContext.chunks]),
            };
        } catch (error) {
            console.warn('⚠️  Erro na expansão via grafo, usando apenas vector search:', error);
            return {
                chunks,
                scores,
                totalSources: this.countUniqueSources(chunks),
            };
        }
    }

    /**
     * Expande contexto através de relações no grafo
     * @param initialChunks Chunks iniciais do vector search
     * @returns Chunks adicionais e entidades encontradas
     */
    private async expandViaGraph(
        initialChunks: Document[]
    ): Promise<{ chunks: Document[]; entities: string[] }> {
        console.log(`🔗 Expandindo contexto via GraphRAG...`);

        const expandedChunks: Document[] = [];
        const entities = new Set<string>();

        // Para cada chunk inicial, buscar entidades e chunks relacionados
        for (const chunk of initialChunks) {
            const chunkId = this.extractChunkId(chunk);
            if (!chunkId) continue;

            try {
                // Query Cypher para encontrar:
                // 1. Entidades mencionadas no chunk
                // 2. Outros chunks que mencionam as mesmas entidades
                const query = `
                    MATCH (c:Chunk {id: $chunkId})-[:MENTIONS]->(e:Entity)
                    WITH e, c
                    MATCH (c2:Chunk)-[:MENTIONS]->(e)
                    WHERE c2.id <> c.id
                    RETURN DISTINCT 
                        c2.id as chunkId,
                        c2.text as text,
                        c2.metadata as metadata,
                        e.name as entityName
                    LIMIT 5
                `;

                const results = await this.vectorStore.runCypherQuery(query, { chunkId });

                if (results && results.length > 0) {
                    results.forEach((record: any) => {
                        // Adicionar chunk relacionado
                        const relatedChunk: Document = {
                            pageContent: record.text,
                            metadata: JSON.parse(record.metadata || '{}'),
                        };
                        expandedChunks.push(relatedChunk);

                        // Adicionar entidade
                        if (record.entityName) {
                            entities.add(record.entityName);
                        }
                    });
                }
            } catch (error) {
                console.warn(`⚠️  Erro ao expandir chunk ${chunkId}:`, error);
            }
        }

        console.log(`✅ GraphRAG: +${expandedChunks.length} chunks, ${entities.size} entidades`);

        return {
            chunks: expandedChunks,
            entities: Array.from(entities),
        };
    }

    /**
     * Formata contexto para usar no prompt
     * @param context Contexto recuperado
     * @returns String formatada para o prompt
     */
    formatContextForPrompt(context: RAGContext): string {
        let formattedContext = '';

        // Adicionar chunks principais
        if (context.chunks.length > 0) {
            formattedContext += '=== INFORMAÇÕES PRINCIPAIS ===\n\n';
            context.chunks.forEach((chunk, index) => {
                const source = chunk.metadata.source || 'Desconhecido';
                const score = context.scores[index] || 0;
                
                formattedContext += `[Fonte ${index + 1}: ${this.formatSourceName(source)}, Relevância: ${score.toFixed(2)}]\n`;
                formattedContext += `${chunk.pageContent}\n\n`;
            });
        }

        // Adicionar contexto expandido (se houver)
        if (context.expandedChunks && context.expandedChunks.length > 0) {
            formattedContext += '=== INFORMAÇÕES RELACIONADAS ===\n\n';
            context.expandedChunks.forEach((chunk, index) => {
                const source = chunk.metadata.source || 'Desconhecido';
                
                formattedContext += `[Fonte adicional ${index + 1}: ${this.formatSourceName(source)}]\n`;
                formattedContext += `${chunk.pageContent}\n\n`;
            });
        }

        // Adicionar entidades relacionadas (se houver)
        if (context.entities && context.entities.length > 0) {
            formattedContext += '=== CONCEITOS/ENTIDADES RELACIONADOS ===\n';
            formattedContext += context.entities.join(', ') + '\n\n';
        }

        return formattedContext.trim();
    }

    /**
     * Extrai ID do chunk dos metadados
     */
    private extractChunkId(chunk: Document): string | null {
        // Tentar extrair de diferentes formatos de metadata
        if (chunk.metadata.id) return chunk.metadata.id;
        if (chunk.metadata.chunkId) return chunk.metadata.chunkId;
        
        // Tentar construir a partir de source + index
        if (chunk.metadata.source && chunk.metadata.chunkIndex !== undefined) {
            const docId = this.generateId('doc', chunk.metadata.source);
            return `${docId}_chunk_${chunk.metadata.chunkIndex}`;
        }
        
        return null;
    }

    /**
     * Conta número de fontes únicas
     */
    private countUniqueSources(chunks: Document[]): number {
        const sources = new Set(chunks.map(c => c.metadata.source).filter(Boolean));
        return sources.size;
    }

    /**
     * Formata nome da fonte para exibição
     */
    private formatSourceName(source: string): string {
        // Extrair apenas o nome do arquivo
        const parts = source.split(/[/\\]/);
        return parts[parts.length - 1] || source;
    }

    /**
     * Gera ID consistente (mesmo método do GraphBuilder)
     */
    private generateId(prefix: string, value: string): string {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            const char = value.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `${prefix}_${Math.abs(hash).toString(36)}`;
    }

    /**
     * Fecha conexões
     */
    async close(): Promise<void> {
        await this.vectorStore.close();
        await this.graphBuilder.close();
        console.log('🔌 RAG Service desconectado');
    }
}
