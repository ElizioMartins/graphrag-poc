import neo4j, { type Driver } from 'neo4j-driver';
import { CONFIG } from '../config.ts';

async function clearDatabase() {
    console.log('\n🗑️  Limpando banco de dados Neo4j...\n');

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

        // Confirmar ação
        console.log('⚠️  ATENÇÃO: Esta ação irá remover TODOS os dados do banco!');
        console.log('   - Documentos');
        console.log('   - Chunks');
        console.log('   - Entidades');
        console.log('   - Embeddings');
        console.log('   - Relacionamentos\n');

        // Obter estatísticas antes de limpar
        const statsSession = driver.session();
        try {
            const statsResult = await statsSession.run(`
                MATCH (d:Document) WITH count(d) as docs
                MATCH (c:Chunk) WITH docs, count(c) as chunks
                MATCH (e:Entity) WITH docs, chunks, count(e) as entities
                MATCH ()-[r]->() WITH docs, chunks, entities, count(r) as rels
                RETURN docs, chunks, entities, rels
            `);

            if (statsResult.records.length > 0) {
                const record = statsResult.records[0]!;
                const docs = record.get('docs').toNumber();
                const chunks = record.get('chunks').toNumber();
                const entities = record.get('entities').toNumber();
                const rels = record.get('rels').toNumber();

                console.log('📊 Dados atuais:');
                console.log(`   - Documentos: ${docs}`);
                console.log(`   - Chunks: ${chunks}`);
                console.log(`   - Entidades: ${entities}`);
                console.log(`   - Relacionamentos: ${rels}\n`);

                if (docs === 0 && chunks === 0 && entities === 0) {
                    console.log('✨ Banco de dados já está vazio!\n');
                    return;
                }
            }
        } finally {
            await statsSession.close();
        }

        // Limpar dados
        console.log('🧹 Removendo todos os nós e relacionamentos...');
        
        const deleteSession = driver.session();
        try {
            // Remover tudo em lotes para evitar problemas de memória
            let totalDeleted = 0;
            let batchDeleted = 0;
            
            do {
                const result = await deleteSession.run(`
                    MATCH (n)
                    WITH n LIMIT 1000
                    DETACH DELETE n
                    RETURN count(n) as deleted
                `);
                
                batchDeleted = result.records[0]?.get('deleted').toNumber() || 0;
                totalDeleted += batchDeleted;
                
                if (batchDeleted > 0) {
                    console.log(`   Removidos ${totalDeleted} nós...`);
                }
            } while (batchDeleted > 0);

            console.log(`\n✅ Total removido: ${totalDeleted} nós\n`);

        } finally {
            await deleteSession.close();
        }

        // Verificar se está limpo
        console.log('🔍 Verificando limpeza...');
        
        const verifySession = driver.session();
        try {
            const result = await verifySession.run('MATCH (n) RETURN count(n) as count');
            const remaining = result.records[0]?.get('count').toNumber() || 0;
            
            if (remaining === 0) {
                console.log('✅ Banco de dados limpo com sucesso!\n');
            } else {
                console.warn(`⚠️  Ainda restam ${remaining} nós no banco\n`);
            }
        } finally {
            await verifySession.close();
        }

        console.log('💡 Dica: Execute "npm run init:db" para recriar os índices se necessário\n');

    } catch (error) {
        console.error('\n❌ Erro ao limpar banco de dados:', error);
        
        if (error instanceof Error) {
            console.error('   Mensagem:', error.message);
        }
        
        process.exit(1);
    } finally {
        if (driver) {
            await driver.close();
        }
    }
}

// Executar
clearDatabase();
