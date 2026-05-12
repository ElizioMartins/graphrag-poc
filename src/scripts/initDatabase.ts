import neo4j, { type Driver } from 'neo4j-driver';
import { CONFIG, logConfig } from '../config.ts';

async function initializeDatabase() {
    console.log('\n🔧 Inicializando banco de dados Neo4j...\n');
    
    logConfig();

    let driver: Driver | null = null;

    try {
        // Conectar ao Neo4j
        console.log('📡 Conectando ao Neo4j...');
        driver = neo4j.driver(
            CONFIG.neo4j.url,
            neo4j.auth.basic(CONFIG.neo4j.username, CONFIG.neo4j.password)
        );

        // Verificar conexão
        const session = driver.session();
        await session.run('RETURN 1');
        await session.close();
        console.log('✅ Conexão estabelecida\n');

        // Criar índice para vector search
        console.log('📊 Criando índices...');
        
        const indexSession = driver.session();
        
        try {
            // Índice de vector para chunks (usando procedure para compatibilidade)
            // Neo4j 5.14 requer uso de db.index.vector.createNodeIndex
            const vectorIndexQuery = `
                CALL db.index.vector.createNodeIndex(
                    '${CONFIG.neo4j.indexName}',
                    'Chunk',
                    'embedding',
                    ${CONFIG.embedding.dimension},
                    'cosine'
                )
            `;
            
            try {
                await indexSession.run(vectorIndexQuery);
                console.log(`   ✅ Índice de vetor criado: ${CONFIG.neo4j.indexName}`);
            } catch (err: any) {
                // Se o índice já existe, apenas log
                if (err.code === 'Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists') {
                    console.log(`   ℹ️  Índice de vetor já existe: ${CONFIG.neo4j.indexName}`);
                } else {
                    throw err;
                }
            }

            // Constraint para IDs únicos de documentos
            await indexSession.run(`
                CREATE CONSTRAINT document_id_unique IF NOT EXISTS
                FOR (d:Document)
                REQUIRE d.id IS UNIQUE
            `);
            console.log('   ✅ Constraint de Document.id criado');

            // Constraint para IDs únicos de chunks
            await indexSession.run(`
                CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS
                FOR (c:Chunk)
                REQUIRE c.id IS UNIQUE
            `);
            console.log('   ✅ Constraint de Chunk.id criado');

            // Constraint para IDs únicos de entidades
            await indexSession.run(`
                CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
                FOR (e:Entity)
                REQUIRE e.id IS UNIQUE
            `);
            console.log('   ✅ Constraint de Entity.id criado');

            // Índice para busca por nome de entidade
            await indexSession.run(`
                CREATE INDEX entity_name_index IF NOT EXISTS
                FOR (e:Entity)
                ON (e.name)
            `);
            console.log('   ✅ Índice de Entity.name criado');

        } finally {
            await indexSession.close();
        }

        console.log('\n✅ Banco de dados inicializado com sucesso!\n');
        console.log('📋 Resumo:');
        console.log(`   - Índice de vetor: ${CONFIG.neo4j.indexName}`);
        console.log(`   - Dimensão: ${CONFIG.embedding.dimension}`);
        console.log(`   - Similaridade: cosine`);
        console.log(`   - Constraints: Document.id, Chunk.id, Entity.id`);
        console.log(`   - Índices: Entity.name`);
        console.log('\n🚀 Pronto para uso!\n');

    } catch (error) {
        console.error('\n❌ Erro ao inicializar banco de dados:', error);
        
        if (error instanceof Error) {
            console.error('   Mensagem:', error.message);
            
            // Dicas de troubleshooting
            if (error.message.includes('authentication')) {
                console.error('\n💡 Dica: Verifique as credenciais do Neo4j no arquivo .env');
            } else if (error.message.includes('connection')) {
                console.error('\n💡 Dica: Certifique-se que o Neo4j está rodando (npm run infra:up)');
            }
        }
        
        process.exit(1);
    } finally {
        if (driver) {
            await driver.close();
        }
    }
}

// Executar
initializeDatabase();
