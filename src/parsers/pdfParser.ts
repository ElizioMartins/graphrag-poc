import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Document } from "@langchain/core/documents";

export class PDFParser {
    /**
     * Carrega e extrai texto de um arquivo PDF
     * @param filePath Caminho do arquivo PDF
     * @returns Array de documentos (um por página)
     */
    async parse(filePath: string): Promise<Document[]> {
        try {
            console.log(`📄 Carregando PDF: ${filePath}`);
            
            const loader = new PDFLoader(filePath, {
                splitPages: true, // Separar por páginas
            });
            
            const documents = await loader.load();
            
            console.log(`✅ PDF carregado: ${documents.length} páginas`);
            
            // Enriquecer metadados
            return documents.map((doc, index) => ({
                ...doc,
                metadata: {
                    ...doc.metadata,
                    source: filePath,
                    fileType: 'pdf',
                    pageNumber: index + 1,
                    totalPages: documents.length,
                }
            }));
        } catch (error) {
            console.error(`❌ Erro ao processar PDF ${filePath}:`, error);
            throw new Error(`Falha ao processar PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Valida se o arquivo é um PDF válido
     * @param filePath Caminho do arquivo
     * @returns true se válido
     */
    static isValidPDF(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.pdf');
    }
}
