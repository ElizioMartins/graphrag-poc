/**
 * Script para pré-baixar o modelo de embeddings
 * Execute: node --env-file .env --experimental-strip-types src/scripts/downloadModel.ts
 */

import { EmbeddingService } from '../services/embeddingService.ts';

console.log('🚀 Iniciando download do modelo de embeddings...\n');

try {
    const embeddingService = new EmbeddingService();
    
    console.log('📥 Baixando modelo (isso pode levar alguns minutos)...');
    await embeddingService.initialize();
    
    console.log('\n🎉 Modelo baixado e pronto para uso!');
    console.log('✅ Próximas inicializações serão instantâneas.\n');
    
    // Testar embedding
    console.log('🧪 Testando geração de embedding...');
    const testEmbedding = await embeddingService.embedQuery('teste de embedding');
    console.log(`✅ Embedding gerado: vetor de ${testEmbedding.length} dimensões\n`);
    
    process.exit(0);
} catch (error) {
    console.error('\n❌ Erro ao baixar modelo:', error);
    console.error('\n💡 Dicas para resolver:');
    console.error('   1. Verifique sua conexão com a internet');
    console.error('   2. Tente novamente (o script tem retry automático)');
    console.error('   3. Se persistir, considere usar outro modelo ou baixar manualmente\n');
    process.exit(1);
}
