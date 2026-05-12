import { CONFIG } from '../config.ts';

export interface Entity {
    name: string;
    type: string;
    occurrences: number;
    contexts: string[]; // Trechos onde a entidade aparece
}

export class EntityExtractor {
    private minLength: number;
    private maxLength: number;
    private minOccurrences: number;
    
    // Stopwords em português (palavras muito comuns que não são entidades)
    private readonly stopwords = new Set([
        'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
        'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
        'por', 'para', 'com', 'sem', 'sob', 'sobre', 'até',
        'e', 'ou', 'mas', 'que', 'se', 'não', 'como', 'quando',
        'este', 'esse', 'aquele', 'esta', 'essa', 'aquela',
        'muito', 'mais', 'menos', 'bem', 'mal', 'já',
        'é', 'são', 'foi', 'foram', 'ser', 'estar', 'ter', 'haver',
        'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'meus', 'minhas',
        'The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For',
    ]);

    constructor(config = CONFIG.entityExtraction) {
        this.minLength = config.minEntityLength;
        this.maxLength = config.maxEntityLength;
        this.minOccurrences = config.minOccurrences;
    }

    /**
     * Extrai entidades nomeadas de textos usando regex e heurísticas
     * @param texts Array de textos para extrair entidades
     * @returns Array de entidades encontradas
     */
    extractEntities(texts: string[]): Entity[] {
        console.log(`🔍 Extraindo entidades de ${texts.length} texto(s)...`);

        const entityMap = new Map<string, { count: number; contexts: Set<string> }>();

        texts.forEach((text, textIndex) => {
            // Padrão 1: Palavras/frases capitalizadas (possíveis nomes próprios)
            const capitalizedPattern = /\b[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+)*\b/g;
            const capitalizedMatches = text.match(capitalizedPattern) || [];

            capitalizedMatches.forEach(match => {
                const normalized = this.normalizeEntity(match);
                if (this.isValidEntity(normalized)) {
                    const context = this.extractContext(text, match);
                    this.addToMap(entityMap, normalized, 'PROPER_NOUN', context);
                }
            });

            // Padrão 2: Termos técnicos em CamelCase ou snake_case
            const technicalPattern = /\b[a-z]+[A-Z][a-zA-Z]*\b|\b[a-z]+_[a-z_]+\b/g;
            const technicalMatches = text.match(technicalPattern) || [];

            technicalMatches.forEach(match => {
                const normalized = this.normalizeEntity(match);
                if (this.isValidEntity(normalized) && match.length >= 5) {
                    const context = this.extractContext(text, match);
                    this.addToMap(entityMap, normalized, 'TECHNICAL_TERM', context);
                }
            });

            // Padrão 3: Siglas (2-6 letras maiúsculas)
            const acronymPattern = /\b[A-Z]{2,6}\b/g;
            const acronymMatches = text.match(acronymPattern) || [];

            acronymMatches.forEach(match => {
                if (this.isValidEntity(match)) {
                    const context = this.extractContext(text, match);
                    this.addToMap(entityMap, match, 'ACRONYM', context);
                }
            });
        });

        // Filtrar entidades por número mínimo de ocorrências
        const entities: Entity[] = [];
        entityMap.forEach((data, name) => {
            if (data.count >= this.minOccurrences) {
                entities.push({
                    name,
                    type: this.inferEntityType(name),
                    occurrences: data.count,
                    contexts: Array.from(data.contexts).slice(0, 3), // Limitar a 3 contextos
                });
            }
        });

        // Ordenar por número de ocorrências (mais relevantes primeiro)
        entities.sort((a, b) => b.occurrences - a.occurrences);

        console.log(`✅ Encontradas ${entities.length} entidades únicas (${entityMap.size} total antes de filtrar)`);
        
        return entities;
    }

    /**
     * Adiciona entidade ao mapa de contagem
     */
    private addToMap(
        map: Map<string, { count: number; contexts: Set<string> }>,
        entity: string,
        type: string,
        context: string
    ): void {
        if (!map.has(entity)) {
            map.set(entity, { count: 0, contexts: new Set() });
        }
        const data = map.get(entity)!;
        data.count++;
        data.contexts.add(context);
    }

    /**
     * Normaliza uma entidade (remove espaços extras, etc.)
     */
    private normalizeEntity(entity: string): string {
        return entity.trim().replace(/\s+/g, ' ');
    }

    /**
     * Valida se uma string é uma entidade válida
     */
    private isValidEntity(entity: string): boolean {
        const length = entity.length;
        
        // Verificar comprimento
        if (length < this.minLength || length > this.maxLength) {
            return false;
        }

        // Verificar stopwords
        if (this.stopwords.has(entity) || this.stopwords.has(entity.toLowerCase())) {
            return false;
        }

        // Verificar se não é apenas números ou caracteres especiais
        if (!/[a-zA-ZÀ-ÿ]/.test(entity)) {
            return false;
        }

        return true;
    }

    /**
     * Extrai contexto ao redor da entidade (para análise)
     */
    private extractContext(text: string, entity: string, contextLength: number = 100): string {
        const index = text.indexOf(entity);
        if (index === -1) return '';

        const start = Math.max(0, index - contextLength);
        const end = Math.min(text.length, index + entity.length + contextLength);
        
        let context = text.substring(start, end);
        
        // Adicionar reticências se truncado
        if (start > 0) context = '...' + context;
        if (end < text.length) context = context + '...';
        
        return context.trim();
    }

    /**
     * Infere o tipo de entidade baseado em padrões
     */
    private inferEntityType(entity: string): string {
        // Sigla
        if (/^[A-Z]{2,6}$/.test(entity)) {
            return 'ACRONYM';
        }

        // Termo técnico (CamelCase ou snake_case)
        if (/[a-z]+[A-Z]/.test(entity) || entity.includes('_')) {
            return 'TECHNICAL_TERM';
        }

        // Nome próprio (primeira letra maiúscula)
        if (/^[A-Z]/.test(entity)) {
            return 'PROPER_NOUN';
        }

        return 'CONCEPT';
    }

    /**
     * Encontra co-ocorrências entre entidades (entidades que aparecem próximas)
     * @param texts Textos para analisar
     * @param entities Entidades já extraídas
     * @param windowSize Janela de tokens para considerar co-ocorrência
     * @returns Pares de entidades que co-ocorrem
     */
    findCoOccurrences(
        texts: string[],
        entities: Entity[],
        windowSize: number = 50
    ): Array<{ entity1: string; entity2: string; count: number }> {
        console.log(`🔗 Analisando co-ocorrências entre ${entities.length} entidades...`);

        const coOccurrenceMap = new Map<string, number>();
        const entityNames = new Set(entities.map(e => e.name));

        texts.forEach(text => {
            const words = text.split(/\s+/);
            
            // Para cada janela de texto
            for (let i = 0; i < words.length - windowSize; i++) {
                const window = words.slice(i, i + windowSize).join(' ');
                
                // Encontrar entidades presentes nesta janela
                const entitiesInWindow = Array.from(entityNames).filter(entity => 
                    window.includes(entity)
                );

                // Criar pares de entidades que co-ocorrem
                for (let j = 0; j < entitiesInWindow.length; j++) {
                    for (let k = j + 1; k < entitiesInWindow.length; k++) {
                        const pair = this.createPairKey(entitiesInWindow[j]!, entitiesInWindow[k]!);
                        coOccurrenceMap.set(pair, (coOccurrenceMap.get(pair) || 0) + 1);
                    }
                }
            }
        });

        // Converter mapa para array e filtrar co-ocorrências significativas
        const coOccurrences = Array.from(coOccurrenceMap.entries())
            .filter(([_, count]) => count >= 2) // Mínimo 2 co-ocorrências
            .map(([pair, count]) => {
                const [entity1, entity2] = pair.split('|||');
                return { entity1: entity1!, entity2: entity2!, count };
            })
            .sort((a, b) => b.count - a.count);

        console.log(`✅ Encontradas ${coOccurrences.length} co-ocorrências significativas`);

        return coOccurrences;
    }

    /**
     * Cria chave única para par de entidades (ordem alfabética)
     */
    private createPairKey(entity1: string, entity2: string): string {
        return entity1 < entity2 
            ? `${entity1}|||${entity2}` 
            : `${entity2}|||${entity1}`;
    }
}
