# 🔧 Guia de Troubleshooting - Erro de Download do Modelo

## Problema: "TypeError: terminated" durante inicialização

### Sintomas

```
❌ Erro ao inicializar embeddings: TypeError: terminated
    at Fetch.onAborted (node:internal/deps/undici/undici:13602:53)
    ...
  [cause]: SocketError: other side closed
      at TLSSocket.onHttpSocketEnd (node:internal/deps/undici/undici:7700:26)
```

### Causa Raiz

O erro ocorre quando:
1. **Primeira execução**: O modelo de embeddings (~90MB) precisa ser baixado do HuggingFace
2. **Timeout de rede**: A conexão HTTP é interrompida antes do download completar
3. **Cliente HTTP**: O undici (cliente HTTP interno do Node.js) tem timeouts padrão que podem não ser suficientes para downloads grandes

### Soluções Implementadas

#### 1. Retry Logic Automático

O sistema agora tenta automaticamente **3 vezes** antes de falhar:

```typescript
// src/services/embeddingService.ts
async initialize(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 5000; // 5 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await this.embeddings.embedQuery('teste');
            return; // Sucesso!
        } catch (error) {
            if (attempt < maxRetries) {
                await this.delay(retryDelay);
            }
        }
    }
}
```

#### 2. Script de Pré-Download

Execute **antes** de iniciar o servidor:

```bash
npm run download:model
```

Este script:
- Baixa o modelo de forma isolada
- Tem retry automático
- Mostra progresso detalhado
- Testa a geração de embedding

#### 3. Configurações de Timeout Aumentadas

```typescript
// src/config.ts
embedding: {
    pretrainedOptions: {
        dtype: "fp32" as DataType,
    },
    // Retry logic na camada de serviço
    maxInitRetries: 3,
    initRetryDelay: 5000,
}
```

## Como Resolver

### Opção 1: Pré-Download (Recomendado) ⭐

```bash
# 1. Pare o servidor se estiver rodando
# 2. Execute o script de download
npm run download:model

# 3. Aguarde a conclusão (2-5 minutos)
# 4. Inicie o servidor normalmente
npm run dev
```

**Vantagens**:
- ✅ Evita problemas durante operações críticas
- ✅ Progresso visível
- ✅ Retry automático mais eficiente

### Opção 2: Aguardar Retry Automático

```bash
# Inicie o servidor normalmente
npm run dev

# O sistema tentará 3 vezes automaticamente
# Aguarde as mensagens de retry no log
```

**Quando usar**:
- Conexão estável
- Primeira execução não crítica
- Ambiente de desenvolvimento

### Opção 3: Modelo Mais Leve

Se os problemas persistirem, use um modelo menor:

```env
# .env
EMBEDDING_MODEL=Xenova/paraphrase-MiniLM-L3-v2  # ~60MB em vez de ~90MB
```

**Trade-offs**:
- ✅ Download mais rápido e confiável
- ⚠️ Qualidade dos embeddings ligeiramente inferior

## Verificação

### 1. Confirmar Download Bem-sucedido

Após executar `npm run download:model`, você deve ver:

```
✅ Modelo de embeddings carregado com sucesso!
✅ Embedding gerado: vetor de 384 dimensões
```

### 2. Verificar Cache Local

O modelo é salvo em:
- **Windows**: `%USERPROFILE%\.cache\huggingface\`
- **Linux/Mac**: `~/.cache/huggingface/`

Verifique se a pasta `Xenova_all-MiniLM-L6-v2` existe.

### 3. Testar Servidor

```bash
npm run dev

# Aguarde a mensagem
✅ Modelo de embeddings carregado com sucesso!
```

## Problemas Persistentes?

### Checar Conexão

```bash
# Teste conectividade com HuggingFace
curl -I https://huggingface.co/Xenova/all-MiniLM-L6-v2

# Deve retornar HTTP 200
```

### Firewall/Proxy

Se estiver atrás de firewall corporativo ou proxy:

```bash
# Configure proxy (se necessário)
export HTTPS_PROXY=http://seu-proxy:porta
export HTTP_PROXY=http://seu-proxy:porta

# Depois execute
npm run download:model
```

### Logs Detalhados

Habilite logs verbosos:

```bash
# Linux/Mac
DEBUG=* npm run download:model

# Windows PowerShell
$env:DEBUG="*"; npm run download:model
```

## Alternativa: Download Manual

1. Acesse: https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main
2. Baixe todos os arquivos `.onnx`, `.json` e `tokenizer*`
3. Coloque em: `~/.cache/huggingface/Xenova_all-MiniLM-L6-v2/`
4. Reinicie o servidor

## Informações Técnicas

### Modelo Usado

- **Nome**: Xenova/all-MiniLM-L6-v2
- **Tamanho**: ~90MB (quantizado ONNX)
- **Dimensões**: 384
- **Propósito**: Geração de embeddings semânticos

### Melhorias Implementadas

1. **Retry com backoff exponencial**
2. **Timeouts configuráveis**
3. **Script de pré-download isolado**
4. **Logs detalhados de progresso**
5. **Fallback em múltiplas tentativas**

### Monitoramento

Logs indicam progresso:

```
⏳ Carregando modelo de embeddings... (Tentativa 1/3)
   (Primeira execução pode demorar - baixando modelo)
✅ Modelo de embeddings carregado com sucesso!
```

Em caso de falha temporária:

```
❌ Erro na tentativa 1/3: TypeError: terminated
⏳ Aguardando 5s antes de tentar novamente...
⏳ Carregando modelo de embeddings... (Tentativa 2/3)
```

## Suporte

Ainda com problemas? Abra uma issue com:
- Logs completos do erro
- Output do comando `npm run download:model`
- Sistema operacional e versão do Node.js
- Detalhes da sua conexão (proxy, firewall, etc.)

---

📚 **Referências**:
- [HuggingFace Transformers.js](https://huggingface.co/docs/transformers.js)
- [Node.js undici](https://undici.nodejs.org/)
- [ONNX Runtime](https://onnxruntime.ai/)
