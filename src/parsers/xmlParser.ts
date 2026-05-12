import { parseString } from 'xml2js';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { Document } from "@langchain/core/documents";

const parseXML = promisify(parseString);

export class XMLParser {
    /**
     * Extrai texto de forma recursiva de um objeto XML parseado
     * @param obj Objeto XML
     * @param parentKey Chave pai (para contexto)
     * @returns Texto extraído
     */
    private extractText(obj: any, parentKey: string = ''): string {
        let text = '';

        if (typeof obj === 'string') {
            return obj.trim();
        }

        if (typeof obj === 'number' || typeof obj === 'boolean') {
            return String(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.extractText(item, parentKey)).join(' ');
        }

        if (typeof obj === 'object' && obj !== null) {
            // Extrair texto de todos os valores do objeto
            for (const [key, value] of Object.entries(obj)) {
                // Ignorar atributos do XML (começam com $)
                if (key === '$' || key.startsWith('_')) continue;
                
                const extractedText = this.extractText(value, key);
                if (extractedText) {
                    // Adicionar contexto da tag quando apropriado
                    const contextPrefix = key && key !== '#text' ? `[${key}] ` : '';
                    text += contextPrefix + extractedText + ' ';
                }
            }
        }

        return text.trim();
    }

    /**
     * Extrai estrutura do XML para metadados
     * @param obj Objeto XML parseado
     * @param maxDepth Profundidade máxima
     * @returns Estrutura simplificada
     */
    private extractStructure(obj: any, maxDepth: number = 2, currentDepth: number = 0): any {
        if (currentDepth >= maxDepth) return '[...]';
        
        if (typeof obj !== 'object' || obj === null) return null;
        
        if (Array.isArray(obj)) {
            return obj.length > 0 ? [this.extractStructure(obj[0], maxDepth, currentDepth + 1)] : [];
        }

        const structure: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === '$' || key.startsWith('_')) continue;
            
            if (typeof value === 'object') {
                structure[key] = this.extractStructure(value, maxDepth, currentDepth + 1);
            } else {
                structure[key] = typeof value;
            }
        }
        return structure;
    }

    /**
     * Carrega e extrai texto de um arquivo XML
     * @param filePath Caminho do arquivo XML
     * @returns Array de documentos (único documento com todo o conteúdo)
     */
    async parse(filePath: string): Promise<Document[]> {
        try {
            console.log(`📄 Carregando XML: ${filePath}`);
            
            // Ler arquivo
            const xmlContent = readFileSync(filePath, 'utf-8');
            
            // Parsear XML
            const parsedXML = await parseXML(xmlContent, {
                trim: true,
                normalize: true,
                explicitArray: true,
            });

            // Extrair texto de forma recursiva
            const text = this.extractText(parsedXML);
            
            if (!text || text.length === 0) {
                console.warn(`⚠️  XML não contém texto extraível: ${filePath}`);
            }

            // Extrair estrutura para metadados
            const structure = this.extractStructure(parsedXML);
            const rootElement = Object.keys(parsedXML)[0] || 'root';

            console.log(`✅ XML carregado: ${text.length} caracteres extraídos`);

            // Retornar como documento único
            return [{
                pageContent: text,
                metadata: {
                    source: filePath,
                    fileType: 'xml',
                    rootElement: rootElement,
                    structure: JSON.stringify(structure),
                    contentLength: text.length,
                }
            }];
        } catch (error) {
            console.error(`❌ Erro ao processar XML ${filePath}:`, error);
            throw new Error(`Falha ao processar XML: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Valida se o arquivo é um XML válido
     * @param filePath Caminho do arquivo
     * @returns true se válido
     */
    static isValidXML(filePath: string): boolean {
        const lowerPath = filePath.toLowerCase();
        return lowerPath.endsWith('.xml');
    }

    /**
     * Tenta validar o conteúdo XML (básico)
     * @param content Conteúdo do arquivo
     * @returns true se parece ser XML válido
     */
    static looksLikeXML(content: string): boolean {
        const trimmed = content.trim();
        return trimmed.startsWith('<?xml') || trimmed.startsWith('<');
    }
}
