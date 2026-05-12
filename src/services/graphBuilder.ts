import neo4j, { type Driver } from 'neo4j-driver';
import type { Document } from "@langchain/core/documents";
import { CONFIG } from '../config.ts';
import type { Entity } from './entityExtractor.ts';

export interface GraphNode {
    id: string;
    label: string;
    properties: Record<string, any>;
}

export interface GraphRelationship {
    from: string;
    to: string;
    type: string;
    properties?: Record<string, any>;
}

export class GraphBuilder {
    private driver: Driver;

    constructor() {
        this.driver = neo4j.driver(
            CONFIG.neo4j.url,
            neo4j.auth.basic(CONFIG.neo4j.username, CONFIG.neo4j.password)
        );
    }

    /**
     * Verifica conexão com Neo4j
     */
    async verifyConnection(): Promise<boolean> {
        const session = this.driver.session();
        try {
            await session.run('RETURN 1');
            console.log('✅ Conexão com Neo4j estabelecida');
            return true;
        } catch (error) {
            console.error('❌ Erro ao conectar com Neo4j:', error);
            return false;
        } finally {
            await session.close();
        }
    }

    /**
     * Cria nó de documento no grafo
     * @param filePath Caminho do arquivo
     * @param fileType Tipo do arquivo (pdf, xml)
     * @param metadata Metadados adicionais
     * @returns ID do nó criado
     */
    async createDocumentNode(
        filePath: string,
        fileType: string,
        metadata: Record<string, any> = {}
    ): Promise<string> {
        const session = this.driver.session();
        
        try {
            const documentId = this.generateId('doc', filePath);
            
            const result = await session.run(
                `
                MERGE (d:Document {id: $id})
                SET d.filePath = $filePath,
                    d.fileType = $fileType,
                    d.createdAt = datetime(),
                    d.metadata = $metadata
                RETURN d.id as id
                `,
                {
                    id: documentId,
                    filePath,
                    fileType,
                    metadata: JSON.stringify(metadata)
                }
            );

            console.log(`📄 Nó Document criado: ${documentId}`);
            return result.records[0]?.get('id') || documentId;
        } finally {
            await session.close();
        }
    }

    /**
     * Cria nós de chunks e relacionamentos com documento
     * @param documentId ID do documento pai
     * @param chunks Array de chunks do documento
     */
    async createChunkNodes(documentId: string, chunks: Document[]): Promise<void> {
        const session = this.driver.session();
        
        try {
            console.log(`📝 Criando ${chunks.length} chunks para documento ${documentId}...`);

            // Usar UNWIND para criar todos os chunks em uma única query (mais eficiente)
            const batchSize = 50;
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                
                const chunksData = batch.map((chunk, batchIndex) => {
                    const chunkIndex = i + batchIndex;
                    const chunkId = `${documentId}_chunk_${chunkIndex}`;
                    
                    return {
                        chunkId,
                        text: chunk.pageContent,
                        chunkIndex,
                        chunkLength: chunk.pageContent.length,
                        metadata: JSON.stringify(chunk.metadata)
                    };
                });

                await session.run(
                    `
                    MATCH (d:Document {id: $documentId})
                    UNWIND $chunks AS chunkData
                    MERGE (c:Chunk {id: chunkData.chunkId})
                    SET c.text = chunkData.text,
                        c.chunkIndex = chunkData.chunkIndex,
                        c.chunkLength = chunkData.chunkLength,
                        c.metadata = chunkData.metadata
                    MERGE (d)-[:CONTAINS]->(c)
                    `,
                    {
                        documentId,
                        chunks: chunksData
                    }
                );

                console.log(`   Processados ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`);
            }

            console.log(`✅ ${chunks.length} chunks criados e relacionados ao documento`);
        } finally {
            await session.close();
        }
    }

    /**
     * Cria nós de entidades
     * @param entities Array de entidades extraídas
     */
    async createEntityNodes(entities: Entity[]): Promise<void> {
        const session = this.driver.session();
        
        try {
            console.log(`🏷️  Criando ${entities.length} entidades...`);

            // Usar UNWIND para criar todas as entidades em uma query
            const batchSize = 100;
            for (let i = 0; i < entities.length; i += batchSize) {
                const batch = entities.slice(i, i + batchSize);
                
                const entitiesData = batch.map((entity) => ({
                    id: this.generateId('entity', entity.name),
                    name: entity.name,
                    type: entity.type,
                    occurrences: entity.occurrences,
                    contexts: JSON.stringify(entity.contexts)
                }));

                await session.run(
                    `
                    UNWIND $entities AS entityData
                    MERGE (e:Entity {id: entityData.id})
                    SET e.name = entityData.name,
                        e.type = entityData.type,
                        e.occurrences = entityData.occurrences,
                        e.contexts = entityData.contexts
                    `,
                    { entities: entitiesData }
                );

                console.log(`   Processadas ${Math.min(i + batchSize, entities.length)}/${entities.length} entidades`);
            }

            console.log(`✅ ${entities.length} entidades criadas`);
        } finally {
            await session.close();
        }
    }

    /**
     * Cria relacionamentos MENTIONS entre chunks e entidades
     * @param documentId ID do documento
     * @param chunks Chunks do documento
     * @param entities Entidades encontradas
     */
    async createMentionsRelationships(
        documentId: string,
        chunks: Document[],
        entities: Entity[]
    ): Promise<void> {
        const session = this.driver.session();
        
        try {
            console.log(`🔗 Criando relacionamentos MENTIONS...`);
            
            const entityNames = entities.map(e => e.name);
            const mentionsData: Array<{ chunkId: string; entityId: string }> = [];

            // Para cada chunk, verificar quais entidades são mencionadas
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i]!;
                const chunkId = `${documentId}_chunk_${i}`;
                
                // Encontrar entidades presentes neste chunk
                const mentionedEntities = entityNames.filter(entityName =>
                    chunk.pageContent.includes(entityName)
                );

                // Adicionar aos relacionamentos
                for (const entityName of mentionedEntities) {
                    const entityId = this.generateId('entity', entityName);
                    mentionsData.push({ chunkId, entityId });
                }
            }

            // Criar todos os relacionamentos de uma vez usando UNWIND
            if (mentionsData.length > 0) {
                await session.run(
                    `
                    UNWIND $mentions AS mention
                    MATCH (c:Chunk {id: mention.chunkId})
                    MATCH (e:Entity {id: mention.entityId})
                    MERGE (c)-[r:MENTIONS]->(e)
                    SET r.count = coalesce(r.count, 0) + 1
                    `,
                    { mentions: mentionsData }
                );
            }

            console.log(`✅ ${mentionsData.length} relacionamentos MENTIONS criados`);
        } finally {
            await session.close();
        }
    }

    /**
     * Cria relacionamentos CO_OCCURS entre entidades
     * @param coOccurrences Array de co-ocorrências
     */
    async createCoOccurrenceRelationships(
        coOccurrences: Array<{ entity1: string; entity2: string; count: number }>
    ): Promise<void> {
        const session = this.driver.session();
        
        try {
            console.log(`🔗 Criando ${coOccurrences.length} relacionamentos CO_OCCURS...`);

            // Preparar dados para batch insert
            const coOccurrencesData = coOccurrences.map(coOccurrence => ({
                entity1Id: this.generateId('entity', coOccurrence.entity1),
                entity2Id: this.generateId('entity', coOccurrence.entity2),
                count: coOccurrence.count,
                strength: Math.min(coOccurrence.count / 10, 1.0)
            }));

            // Criar todos os relacionamentos usando UNWIND
            if (coOccurrencesData.length > 0) {
                await session.run(
                    `
                    UNWIND $coOccurrences AS coOcc
                    MATCH (e1:Entity {id: coOcc.entity1Id})
                    MATCH (e2:Entity {id: coOcc.entity2Id})
                    MERGE (e1)-[r:CO_OCCURS]-(e2)
                    SET r.count = coOcc.count,
                        r.strength = coOcc.strength
                    `,
                    { coOccurrences: coOccurrencesData }
                );
            }

            console.log(`✅ Relacionamentos CO_OCCURS criados`);
        } finally {
            await session.close();
        }
    }

    /**
     * Limpa todos os dados do grafo
     */
    async clearGraph(): Promise<void> {
        const session = this.driver.session();
        
        try {
            console.log('🗑️  Limpando grafo...');
            
            await session.run('MATCH (n) DETACH DELETE n');
            
            console.log('✅ Grafo limpo');
        } finally {
            await session.close();
        }
    }

    /**
     * Obtém estatísticas do grafo
     */
    async getGraphStatistics(): Promise<{
        documents: number;
        chunks: number;
        entities: number;
        relationships: number;
    }> {
        const session = this.driver.session();
        
        try {
            const result = await session.run(`
                MATCH (d:Document) WITH count(d) as docs
                MATCH (c:Chunk) WITH docs, count(c) as chunks
                MATCH (e:Entity) WITH docs, chunks, count(e) as entities
                MATCH ()-[r]->() WITH docs, chunks, entities, count(r) as rels
                RETURN docs, chunks, entities, rels
            `);

            const record = result.records[0];
            return {
                documents: record?.get('docs').toNumber() || 0,
                chunks: record?.get('chunks').toNumber() || 0,
                entities: record?.get('entities').toNumber() || 0,
                relationships: record?.get('rels').toNumber() || 0,
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Fecha conexão com Neo4j
     */
    async close(): Promise<void> {
        await this.driver.close();
        console.log('🔌 Conexão com Neo4j fechada');
    }

    /**
     * Gera ID único para nós
     */
    private generateId(prefix: string, value: string): string {
        // Usar hash simples para IDs consistentes
        const hash = this.simpleHash(value);
        return `${prefix}_${hash}`;
    }

    /**
     * Hash simples para gerar IDs
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
}
