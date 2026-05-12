import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RAGService, type RAGContext } from './ragService.ts';
import { CONFIG } from '../config.ts';

export interface AIResponse {
    answer: string;
    context?: RAGContext;
    error?: string;
    metadata?: {
        model: string;
        modelIndex?: number;        // Índice do modelo usado (0-based)
        attemptedModels?: string[]; // Modelos tentados antes de sucesso
        tokensUsed?: number;
        processingTime: number;
    };
}

export class AIService {
    private ragService: RAGService;
    private llm: ChatOpenAI;
    private promptTemplate: ChatPromptTemplate;
    private availableModels: string[];
    private currentModelIndex: number = 0;

    constructor() {
        this.ragService = new RAGService();
        this.availableModels = CONFIG.openRouter.nlpModels;
        
        // Inicializar LLM com primeiro modelo
        this.llm = this.createLLM(this.availableModels[0]);

        // Criar template de prompt
        this.promptTemplate = ChatPromptTemplate.fromTemplate(CONFIG.templateText);
    }

    /**
     * Cria instância do LLM com modelo específico
     */
    private createLLM(modelName: string): ChatOpenAI {
        return new ChatOpenAI({
            temperature: CONFIG.openRouter.temperature,
            maxRetries: CONFIG.openRouter.maxRetries,
            modelName: modelName,
            maxTokens: CONFIG.openRouter.maxTokens,
            openAIApiKey: CONFIG.openRouter.apiKey,
            configuration: {
                baseURL: CONFIG.openRouter.url,
                defaultHeaders: CONFIG.openRouter.defaultHeaders,
            }
        });
    }

    /**
     * Troca para próximo modelo disponível
     */
    private switchToNextModel(): boolean {
        if (this.currentModelIndex < this.availableModels.length - 1) {
            this.currentModelIndex++;
            const nextModel = this.availableModels[this.currentModelIndex];
            console.log(`🔄 Tentando modelo alternativo: ${nextModel}`);
            this.llm = this.createLLM(nextModel);
            return true;
        }
        return false;
    }

    /**
     * Verifica se erro é recuperável (deve tentar próximo modelo)
     */
    private isRecoverableError(error: any): boolean {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorCode = error?.code || error?.error?.code || 0;
        const errorStatus = error?.status || error?.response?.status || 0;
        
        // Log para debug
        console.log(`   🔍 Debug erro - Status: ${errorStatus}, Code: ${errorCode}, Type: ${error?.constructor?.name}`);
        
        // Erros que devem acionar fallback
        return (
            errorStatus === 404 ||           // Modelo não encontrado
            errorStatus === 429 ||           // Rate limit
            errorStatus === 503 ||           // Serviço indisponível
            errorStatus === 500 ||           // Erro interno
            errorCode === 404 ||
            errorCode === 429 ||
            errorCode === 503 ||
            errorCode === 500 ||
            error?.constructor?.name === 'RateLimitError' ||
            errorMessage.includes('not found') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('unavailable')
        );
    }

    /**
     * Reseta índice de modelo para o primeiro
     */
    private resetModelIndex(): void {
        if (this.currentModelIndex !== 0) {
            this.currentModelIndex = 0;
            this.llm = this.createLLM(this.availableModels[0]);
        }
    }

    /**
     * Inicializa os serviços
     */
    async initialize(): Promise<void> {
        console.log('🤖 Inicializando AI Service...');
        await this.ragService.initialize();
        console.log('✅ AI Service inicializado');
    }

    /**
     * Responde uma pergunta usando RAG
     * @param question Pergunta do usuário
     * @param useGraphRAG Se deve usar GraphRAG expansion
     * @returns Resposta gerada
     */
    async answerQuestion(
        question: string,
        useGraphRAG: boolean = CONFIG.graphRAG.enableRelationships
    ): Promise<AIResponse> {
        const startTime = Date.now();
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📌 PERGUNTA: ${question}`);
        console.log('='.repeat(80));

        try {
            // Passo 1: Recuperar contexto via RAG
            const context = await this.ragService.retrieveContext(
                question,
                CONFIG.similarity.topK,
                useGraphRAG
            );

            // Verificar se encontrou contexto relevante
            if (context.chunks.length === 0) {
                const noContextResponse: AIResponse = {
                    answer: 'Desculpe, não encontrei informações relevantes nos documentos enviados para responder essa pergunta. Por favor, verifique se fez upload dos documentos corretos ou reformule sua pergunta.',
                    context,
                    metadata: {
                        model: this.availableModels[0],
                        processingTime: Date.now() - startTime,
                    }
                };
                
                console.log('\n❌ Nenhum contexto relevante encontrado');
                return noContextResponse;
            }

            // Verificar score mínimo
            const topScore = context.scores[0] || 0;
            if (topScore < CONFIG.similarity.scoreThreshold) {
                console.log(`⚠️  Score muito baixo: ${topScore.toFixed(3)} < ${CONFIG.similarity.scoreThreshold}`);
                
                return {
                    answer: 'Não tenho confiança suficiente para responder essa pergunta com base nos documentos enviados. O conteúdo encontrado não parece ser suficientemente relevante.',
                    context,
                    metadata: {
                        model: this.availableModels[0],
                        processingTime: Date.now() - startTime,
                    }
                };
            }

            // Passo 2: Formatar contexto
            const formattedContext = this.ragService.formatContextForPrompt(context);

            // Passo 3: Gerar resposta com LLM (com fallback automático)
            console.log('🤖 Gerando resposta com IA...');
            
            const attemptedModels: string[] = [];
            let answer: string | null = null;
            let lastError: any = null;

            // Tentar cada modelo até obter sucesso
            for (let attempt = 0; attempt < this.availableModels.length; attempt++) {
                const currentModel = this.availableModels[this.currentModelIndex];
                attemptedModels.push(currentModel);
                
                try {
                    console.log(`   Tentando modelo: ${currentModel} (${attempt + 1}/${this.availableModels.length})`);
                    answer = await this.generateResponse(question, formattedContext);
                    
                    // Sucesso! Log e break
                    if (attempt > 0) {
                        console.log(`   ✅ Sucesso com modelo alternativo: ${currentModel}`);
                    }
                    break;
                } catch (error) {
                    lastError = error;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const errorType = error?.constructor?.name || 'Unknown';
                    const errorCode = error?.code || error?.error?.code || error?.status;
                    
                    console.warn(`   ⚠️  Falha no modelo ${currentModel}:`);
                    console.warn(`       Tipo: ${errorType}, Código: ${errorCode}`);
                    console.warn(`       Mensagem: ${errorMsg.split('\n')[0]}`);
                    
                    // Se é erro recuperável e ainda há modelos, tentar próximo
                    const isRecoverable = this.isRecoverableError(error);
                    const hasMoreModels = this.currentModelIndex < this.availableModels.length - 1;
                    
                    console.log(`   📊 Recuperável: ${isRecoverable}, Mais modelos: ${hasMoreModels}`);
                    
                    if (isRecoverable && this.switchToNextModel()) {
                        continue;
                    } else {
                        // Não há mais modelos ou erro não recuperável
                        if (!isRecoverable) {
                            console.error(`   🛑 Erro não recuperável, parando tentativas`);
                        }
                        break;
                    }
                }
            }

            // Se todos os modelos falharam
            if (!answer) {
                console.error('❌ Todos os modelos falharam');
                this.resetModelIndex(); // Reset para próxima tentativa
                
                return {
                    answer: '',
                    error: `Todos os modelos LLM falharam. Último erro: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
                    context,
                    metadata: {
                        model: attemptedModels.at(-1) || this.availableModels[0],
                        attemptedModels,
                        processingTime: Date.now() - startTime,
                    }
                };
            }

            // Sucesso!
            const response: AIResponse = {
                answer,
                context,
                metadata: {
                    model: this.availableModels[this.currentModelIndex],
                    modelIndex: this.currentModelIndex,
                    attemptedModels: attemptedModels.length > 1 ? attemptedModels.slice(0, -1) : undefined,
                    processingTime: Date.now() - startTime,
                }
            };

            // Reset para primeiro modelo após sucesso
            this.resetModelIndex();

            console.log('\n💬 RESPOSTA:');
            console.log(answer);
            console.log(`\n⏱️  Tempo de processamento: ${response.metadata.processingTime}ms`);
            console.log('='.repeat(80) + '\n');

            return response;
        } catch (error) {
            console.error('❌ Erro ao responder pergunta:', error);
            this.resetModelIndex(); // Reset após erro
            
            return {
                answer: '',
                error: `Erro ao processar pergunta: ${error instanceof Error ? error.message : String(error)}`,
                metadata: {
                    model: this.availableModels[0],
                    processingTime: Date.now() - startTime,
                }
            };
        }
    }

    /**
     * Gera resposta usando LLM
     * @param question Pergunta do usuário
     * @param context Contexto formatado
     * @returns Resposta gerada
     */
    private async generateResponse(question: string, context: string): Promise<string> {
        try {
            // Preparar variáveis do prompt
            const promptVariables = {
                role: CONFIG.promptConfig.role,
                task: CONFIG.promptConfig.task,
                tone: CONFIG.promptConfig.constraints.tone,
                language: CONFIG.promptConfig.constraints.language,
                format: CONFIG.promptConfig.constraints.format,
                instructions: CONFIG.promptConfig.instructions
                    .map((instruction: string, idx: number) => `${idx + 1}. ${instruction}`)
                    .join('\n'),
                question,
                context,
            };

            // Criar chain
            const chain = this.promptTemplate
                .pipe(this.llm)
                .pipe(new StringOutputParser());

            // Invocar LLM
            const response = await chain.invoke(promptVariables);

            return response.trim();
        } catch (error) {
            console.error('❌ Erro ao gerar resposta:', error);
            throw error;
        }
    }

    /**
     * Gera resposta com streaming (para UI interativa)
     * @param question Pergunta do usuário
     * @param onChunk Callback para cada chunk de resposta
     * @returns Resposta completa
     */
    async answerQuestionStream(
        question: string,
        onChunk: (chunk: string) => void
    ): Promise<AIResponse> {
        const startTime = Date.now();
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📌 PERGUNTA (STREAMING): ${question}`);
        console.log('='.repeat(80));

        try {
            // Recuperar contexto
            const context = await this.ragService.retrieveContext(question);

            if (context.chunks.length === 0) {
                const noContextMsg = 'Desculpe, não encontrei informações relevantes nos documentos enviados.';
                onChunk(noContextMsg);
                
                return {
                    answer: noContextMsg,
                    context,
                    metadata: {
                        model: this.availableModels[0],
                        processingTime: Date.now() - startTime,
                    }
                };
            }

            // Formatar contexto
            const formattedContext = this.ragService.formatContextForPrompt(context);

            // Preparar prompt
            const promptVariables = {
                role: CONFIG.promptConfig.role,
                task: CONFIG.promptConfig.task,
                tone: CONFIG.promptConfig.constraints.tone,
                language: CONFIG.promptConfig.constraints.language,
                format: CONFIG.promptConfig.constraints.format,
                instructions: CONFIG.promptConfig.instructions
                    .map((instruction: string, idx: number) => `${idx + 1}. ${instruction}`)
                    .join('\n'),
                question,
                context: formattedContext,
            };

            // Streaming
            console.log('🤖 Gerando resposta com streaming...');
            
            const chain = this.promptTemplate
                .pipe(this.llm)
                .pipe(new StringOutputParser());

            let fullAnswer = '';
            const stream = await chain.stream(promptVariables);

            for await (const chunk of stream) {
                fullAnswer += chunk;
                onChunk(chunk);
            }

            console.log('\n✅ Resposta completa gerada');

            return {
                answer: fullAnswer.trim(),
                context,
                metadata: {
                    model: this.availableModels[this.currentModelIndex],
                    processingTime: Date.now() - startTime,
                }
            };
        } catch (error) {
            console.error('❌ Erro no streaming:', error);
            
            const errorMsg = `Erro: ${error instanceof Error ? error.message : String(error)}`;
            onChunk(errorMsg);
            
            return {
                answer: '',
                error: errorMsg,
                metadata: {
                    model: this.availableModels[0],
                    processingTime: Date.now() - startTime,
                }
            };
        }
    }

    /**
     * Fecha conexões
     */
    async close(): Promise<void> {
        await this.ragService.close();
        console.log('🔌 AI Service desconectado');
    }
}
