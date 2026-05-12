import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import type { Document } from "@langchain/core/documents";
import { EmbeddingService } from './embeddingService.ts';
import { CONFIG } from '../config.ts';

export class VectorStore {
    private embeddingService: EmbeddingService;
    private vectorStore: Neo4jVectorStore | null = null;
    private isInitialized: boolean = false;

    constructor() {
        this.embeddingService = new EmbeddingService();
    }

    /**
     * Inicializa o vector store
     */
    async initialize(): Promise<void> {
        if (this.isInitialized && this.vectorStore) {
            return;
        }

        try {
            console.log('🔌 Conectando ao Neo4j Vector Store...');

            // Inicializar embeddings primeiro
            await this.embeddingService.initialize();

            // Criar vector store
            this.vectorStore = await Neo4jVectorStore.fromExistingGraph(
                this.embeddingService.getEmbeddingsInstance(),
                {
                    url: CONFIG.neo4j.url,
                    username: CONFIG.neo4j.username,
                    password: CONFIG.neo4j.password,
                    indexName: CONFIG.neo4j.indexName,
                    nodeLabel: CONFIG.neo4j.nodeLabel,
                    textNodeProperties: CONFIG.neo4j.textNodeProperties,
                    embeddingNodeProperty: 'embedding',
                    searchType: CONFIG.neo4j.searchType,
                }
            );

            this.isInitialized = true;
            console.log('✅ Vector Store inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar Vector Store:', error);
            throw error;
        }
    }

    /**
     * Adiciona documentos ao vector store
     * @param documents Array de documentos
     */
    async addDocuments(documents: Document[]): Promise<void> {
        await this.initialize();

        if (!this.vectorStore) {
            throw new Error('Vector Store não inicializado');
        }

        try {
            console.log(`📥 Adicionando ${documents.length} documento(s) ao vector store...`);

            // Adicionar em lotes
            const batchSize = 10;
            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = documents.slice(i, i + batchSize);
                
                for (const doc of batch) {
                    await this.vectorStore.addDocuments([doc]);
                }
                
                console.log(`   Adicionados ${Math.min(i + batchSize, documents.length)}/${documents.length}`);
            }

            console.log('✅ Documentos adicionados ao vector store');
        } catch (error) {
            console.error('❌ Erro ao adicionar documentos:', error);
            throw error;
        }
    }

    /**
     * Busca por similaridade
     * @param query Query de busca
     * @param k Número de resultados
     * @returns Array de documentos similares
     */
    async similaritySearch(query: string, k: number = CONFIG.similarity.topK): Promise<Document[]> {
        await this.initialize();

        if (!this.vectorStore) {
            throw new Error('Vector Store não inicializado');
        }

        try {
            console.log(`🔍 Buscando documentos similares para: "${query.substring(0, 50)}..."`);
            
            const results = await this.vectorStore.similaritySearch(query, k);
            
            console.log(`✅ Encontrados ${results.length} documento(s) similar(es)`);
            
            return results;
        } catch (error) {
            console.error('❌ Erro na busca por similaridade:', error);
            throw error;
        }
    }

    /**
     * Busca por similaridade com scores
     * @param query Query de busca
     * @param k Número de resultados
     * @returns Array de tuplas [documento, score]
     */
    async similaritySearchWithScore(
        query: string,
        k: number = CONFIG.similarity.topK
    ): Promise<[Document, number][]> {
        await this.initialize();

        if (!this.vectorStore) {
            throw new Error('Vector Store não inicializado');
        }

        try {
            console.log(`🔍 Buscando documentos similares (com scores)...`);
            
            const results = await this.vectorStore.similaritySearchWithScore(query, k);
            
            // Filtrar por threshold
            const filteredResults = results.filter(
                ([_, score]) => score >= CONFIG.similarity.scoreThreshold
            );
            
            console.log(`✅ Encontrados ${filteredResults.length} documento(s) acima do threshold (${CONFIG.similarity.scoreThreshold})`);
            
            if (filteredResults.length > 0) {
                const topScore = filteredResults[0]![1];
                console.log(`   Melhor score: ${topScore.toFixed(3)}`);
            }
            
            return filteredResults;
        } catch (error) {
            console.error('❌ Erro na busca por similaridade:', error);
            throw error;
        }
    }

    /**
     * Executa query Cypher customizada no Neo4j
     * @param query Query Cypher
     * @param params Parâmetros da query
     * @returns Resultados
     */
    async runCypherQuery(query: string, params: Record<string, any> = {}): Promise<any> {
        await this.initialize();

        if (!this.vectorStore) {
            throw new Error('Vector Store não inicializado');
        }

        try {
            const results = await this.vectorStore.query(query, params);
            return results;
        } catch (error) {
            console.error('❌ Erro ao executar query Cypher:', error);
            throw error;
        }
    }

    /**
     * Limpa todos os vetores do índice
     */
    async clearVectors(): Promise<void> {
        await this.initialize();

        if (!this.vectorStore) {
            throw new Error('Vector Store não inicializado');
        }

        try {
            console.log('🗑️  Removendo vetores do índice...');
            
            await this.vectorStore.query(
                `MATCH (n:\`${CONFIG.neo4j.nodeLabel}\`) DETACH DELETE n`
            );
            
            console.log('✅ Vetores removidos');
        } catch (error) {
            console.error('❌ Erro ao limpar vetores:', error);
            throw error;
        }
    }

    /**
     * Obtém estatísticas do vector store
     */
    async getStatistics(): Promise<{
        totalVectors: number;
        indexName: string;
        nodeLabel: string;
    }> {
        await this.initialize();

        if (!this.vectorStore) {
            throw new Error('Vector Store não inicializado');
        }

        try {
            const result = await this.vectorStore.query(
                `MATCH (n:\`${CONFIG.neo4j.nodeLabel}\`) RETURN count(n) as count`
            );

            const count = result?.[0]?.count?.toNumber?.() || 0;

            return {
                totalVectors: count,
                indexName: CONFIG.neo4j.indexName,
                nodeLabel: CONFIG.neo4j.nodeLabel,
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            return {
                totalVectors: 0,
                indexName: CONFIG.neo4j.indexName,
                nodeLabel: CONFIG.neo4j.nodeLabel,
            };
        }
    }

    /**
     * Fecha conexão com Neo4j
     */
    async close(): Promise<void> {
        if (this.vectorStore) {
            // Neo4jVectorStore não tem método close explícito
            // A conexão é gerenciada internamente
            this.vectorStore = null;
            this.isInitialized = false;
            console.log('🔌 Vector Store desconectado');
        }
    }
}
