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
        tokensUsed?: number;
        processingTime: number;
    };
}

export class AIService {
    private ragService: RAGService;
    private llm: ChatOpenAI;
    private promptTemplate: ChatPromptTemplate;

    constructor() {
        this.ragService = new RAGService();
        
        // Inicializar LLM
        this.llm = new ChatOpenAI({
            temperature: CONFIG.openRouter.temperature,
            maxRetries: CONFIG.openRouter.maxRetries,
            modelName: CONFIG.openRouter.nlpModel,
            maxTokens: CONFIG.openRouter.maxTokens,
            openAIApiKey: CONFIG.openRouter.apiKey,
            configuration: {
                baseURL: CONFIG.openRouter.url,
                defaultHeaders: CONFIG.openRouter.defaultHeaders,
            }
        });

        // Criar template de prompt
        this.promptTemplate = ChatPromptTemplate.fromTemplate(CONFIG.templateText);
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
                        model: CONFIG.openRouter.nlpModel,
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
                        model: CONFIG.openRouter.nlpModel,
                        processingTime: Date.now() - startTime,
                    }
                };
            }

            // Passo 2: Formatar contexto
            const formattedContext = this.ragService.formatContextForPrompt(context);

            // Passo 3: Gerar resposta com LLM
            console.log('🤖 Gerando resposta com IA...');
            
            const answer = await this.generateResponse(question, formattedContext);

            const response: AIResponse = {
                answer,
                context,
                metadata: {
                    model: CONFIG.openRouter.nlpModel,
                    processingTime: Date.now() - startTime,
                }
            };

            console.log('\n💬 RESPOSTA:');
            console.log(answer);
            console.log(`\n⏱️  Tempo de processamento: ${response.metadata.processingTime}ms`);
            console.log('='.repeat(80) + '\n');

            return response;
        } catch (error) {
            console.error('❌ Erro ao responder pergunta:', error);
            
            return {
                answer: '',
                error: `Erro ao processar pergunta: ${error instanceof Error ? error.message : String(error)}`,
                metadata: {
                    model: CONFIG.openRouter.nlpModel,
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
                        model: CONFIG.openRouter.nlpModel,
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
                    model: CONFIG.openRouter.nlpModel,
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
                    model: CONFIG.openRouter.nlpModel,
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
