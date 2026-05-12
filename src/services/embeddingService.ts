import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import type { PretrainedOptions } from "@huggingface/transformers";
import { CONFIG } from '../config.ts';

export class EmbeddingService {
    private embeddings: HuggingFaceTransformersEmbeddings;
    private isInitialized: boolean = false;

    constructor() {
        console.log(`🧠 Inicializando EmbeddingService com modelo: ${CONFIG.embedding.modelName}`);
        
        this.embeddings = new HuggingFaceTransformersEmbeddings({
            model: CONFIG.embedding.modelName,
            pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions
        });
    }

    /**
     * Inicializa o modelo de embeddings (download se necessário)
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('⏳ Carregando modelo de embeddings...');
            console.log('   (Primeira execução pode demorar - baixando modelo)');
            
            // Fazer uma embedding de teste para forçar download do modelo
            await this.embeddings.embedQuery('teste');
            
            this.isInitialized = true;
            console.log('✅ Modelo de embeddings carregado');
        } catch (error) {
            console.error('❌ Erro ao inicializar embeddings:', error);
            throw new Error(`Falha ao carregar modelo de embeddings: ${error}`);
        }
    }

    /**
     * Gera embedding para uma query
     * @param query Texto da query
     * @returns Vetor de embedding
     */
    async embedQuery(query: string): Promise<number[]> {
        await this.initialize();
        
        try {
            const embedding = await this.embeddings.embedQuery(query);
            return embedding;
        } catch (error) {
            console.error('❌ Erro ao gerar embedding para query:', error);
            throw error;
        }
    }

    /**
     * Gera embeddings para múltiplos documentos
     * @param documents Array de textos
     * @returns Array de vetores de embedding
     */
    async embedDocuments(documents: string[]): Promise<number[][]> {
        await this.initialize();
        
        try {
            console.log(`🔢 Gerando embeddings para ${documents.length} documento(s)...`);
            
            // Processar em lotes para evitar sobrecarga de memória
            const batchSize = 10;
            const allEmbeddings: number[][] = [];
            
            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = documents.slice(i, i + batchSize);
                const batchEmbeddings = await this.embeddings.embedDocuments(batch);
                allEmbeddings.push(...batchEmbeddings);
                
                console.log(`   Processados ${Math.min(i + batchSize, documents.length)}/${documents.length}`);
            }
            
            console.log(`✅ Embeddings gerados`);
            return allEmbeddings;
        } catch (error) {
            console.error('❌ Erro ao gerar embeddings para documentos:', error);
            throw error;
        }
    }

    /**
     * Calcula similaridade de cosseno entre dois vetores
     * @param vec1 Primeiro vetor
     * @param vec2 Segundo vetor
     * @returns Similaridade (0-1)
     */
    static cosineSimilarity(vec1: number[], vec2: number[]): number {
        if (vec1.length !== vec2.length) {
            throw new Error('Vetores devem ter o mesmo tamanho');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i]! * vec2[i]!;
            norm1 += vec1[i]! * vec1[i]!;
            norm2 += vec2[i]! * vec2[i]!;
        }

        const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
        
        if (denominator === 0) {
            return 0;
        }

        return dotProduct / denominator;
    }

    /**
     * Retorna a instância de embeddings (para usar com LangChain)
     */
    getEmbeddingsInstance(): HuggingFaceTransformersEmbeddings {
        return this.embeddings;
    }

    /**
     * Obtém informações sobre o modelo
     */
    getModelInfo(): {
        modelName: string;
        dimension: number;
        dtype: string;
    } {
        return {
            modelName: CONFIG.embedding.modelName,
            dimension: CONFIG.embedding.dimension,
            dtype: CONFIG.embedding.pretrainedOptions.dtype,
        };
    }
}
