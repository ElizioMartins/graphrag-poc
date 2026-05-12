import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { Document } from "@langchain/core/documents";
import { PDFParser } from '../parsers/pdfParser.ts';
import { XMLParser } from '../parsers/xmlParser.ts';
import { CONFIG, type TextSplitterConfig } from '../config.ts';
import { basename } from 'node:path';

export class DocumentProcessor {
    private pdfParser: PDFParser;
    private xmlParser: XMLParser;
    private textSplitter: RecursiveCharacterTextSplitter;

    constructor(textSplitterConfig: TextSplitterConfig = CONFIG.textSplitter) {
        this.pdfParser = new PDFParser();
        this.xmlParser = new XMLParser();
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: textSplitterConfig.chunkSize,
            chunkOverlap: textSplitterConfig.chunkOverlap,
            separators: ['\n\n', '\n', '. ', ' ', ''],
        });
    }

    /**
     * Processa um arquivo (PDF ou XML) e retorna documentos
     * @param filePath Caminho do arquivo
     * @returns Array de documentos parseados
     */
    async loadDocument(filePath: string): Promise<Document[]> {
        const fileName = basename(filePath);
        
        console.log(`\n📂 Processando arquivo: ${fileName}`);

        try {
            // Determinar tipo de arquivo e usar parser apropriado
            if (PDFParser.isValidPDF(filePath)) {
                return await this.pdfParser.parse(filePath);
            } else if (XMLParser.isValidXML(filePath)) {
                return await this.xmlParser.parse(filePath);
            } else {
                throw new Error(`Tipo de arquivo não suportado: ${fileName}`);
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar documento ${fileName}:`, error);
            throw error;
        }
    }

    /**
     * Divide documentos em chunks menores
     * @param documents Array de documentos
     * @returns Array de chunks
     */
    async splitDocuments(documents: Document[]): Promise<Document[]> {
        console.log(`✂️  Dividindo ${documents.length} documento(s) em chunks...`);

        try {
            const chunks = await this.textSplitter.splitDocuments(documents);
            
            // Enriquecer metadados dos chunks
            const enrichedChunks = chunks.map((chunk, index) => ({
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    chunkLength: chunk.pageContent.length,
                }
            }));

            console.log(`✅ Criados ${enrichedChunks.length} chunks`);
            
            return enrichedChunks;
        } catch (error) {
            console.error(`❌ Erro ao dividir documentos:`, error);
            throw error;
        }
    }

    /**
     * Processa arquivo completo: carrega + divide em chunks
     * @param filePath Caminho do arquivo
     * @returns Array de chunks processados
     */
    async loadAndSplit(filePath: string): Promise<Document[]> {
        try {
            // Carregar documento
            const documents = await this.loadDocument(filePath);
            
            if (!documents || documents.length === 0) {
                throw new Error('Nenhum conteúdo extraído do documento');
            }

            // Dividir em chunks
            const chunks = await this.splitDocuments(documents);
            
            if (!chunks || chunks.length === 0) {
                throw new Error('Nenhum chunk criado após processamento');
            }

            console.log(`✅ Documento processado: ${chunks.length} chunks criados\n`);
            
            return chunks;
        } catch (error) {
            console.error(`❌ Erro no processamento completo:`, error);
            throw error;
        }
    }

    /**
     * Processa múltiplos arquivos
     * @param filePaths Array de caminhos de arquivos
     * @returns Array de todos os chunks de todos os arquivos
     */
    async processMultipleFiles(filePaths: string[]): Promise<Document[]> {
        console.log(`\n📚 Processando ${filePaths.length} arquivo(s)...`);
        
        const allChunks: Document[] = [];
        const results = {
            successful: 0,
            failed: 0,
            errors: [] as { file: string; error: string }[]
        };

        for (const filePath of filePaths) {
            try {
                const chunks = await this.loadAndSplit(filePath);
                allChunks.push(...chunks);
                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    file: basename(filePath),
                    error: error instanceof Error ? error.message : String(error)
                });
                console.error(`⚠️  Falha ao processar ${basename(filePath)}`);
            }
        }

        // Relatório final
        console.log(`\n📊 Resumo do processamento:`);
        console.log(`   ✅ Sucesso: ${results.successful}/${filePaths.length}`);
        console.log(`   ❌ Falhas: ${results.failed}/${filePaths.length}`);
        console.log(`   📄 Total de chunks: ${allChunks.length}`);
        
        if (results.errors.length > 0) {
            console.log(`\n⚠️  Erros encontrados:`);
            results.errors.forEach(err => {
                console.log(`   - ${err.file}: ${err.error}`);
            });
        }

        return allChunks;
    }

    /**
     * Extrai informações estatísticas dos documentos
     * @param documents Array de documentos/chunks
     * @returns Estatísticas
     */
    static getStatistics(documents: Document[]): {
        totalDocuments: number;
        totalChars: number;
        avgCharsPerDoc: number;
        fileTypes: Record<string, number>;
        sources: string[];
    } {
        const stats = {
            totalDocuments: documents.length,
            totalChars: 0,
            avgCharsPerDoc: 0,
            fileTypes: {} as Record<string, number>,
            sources: [] as string[],
        };

        const uniqueSources = new Set<string>();

        documents.forEach(doc => {
            stats.totalChars += doc.pageContent.length;
            
            const fileType = doc.metadata.fileType || 'unknown';
            stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
            
            if (doc.metadata.source) {
                uniqueSources.add(doc.metadata.source);
            }
        });

        stats.avgCharsPerDoc = stats.totalDocuments > 0 
            ? Math.round(stats.totalChars / stats.totalDocuments) 
            : 0;
        
        stats.sources = Array.from(uniqueSources);

        return stats;
    }
}
