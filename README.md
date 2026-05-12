# 🤖 GraphRAG POC - Sistema RAG com GraphRAG

[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-experimental-blue.svg)](https://www.typescriptlang.org/)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.14-red.svg)](https://neo4j.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Prova de Conceito (POC) de um sistema inteligente capaz de ler documentos (PDF e XML) e responder perguntas sobre eles usando arquitetura RAG (Retrieval-Augmented Generation) com GraphRAG.

## 🎯 O que é isso?

Este projeto implementa um sistema de perguntas e respostas sobre documentos que:

1. **📤 Processa documentos** - Lê PDFs e XMLs, extrai o texto e divide em chunks
2. **🧠 Cria embeddings** - Gera vetores semânticos usando modelo local (HuggingFace)
3. **🔗 Constrói um grafo** - Identifica entidades e relacionamentos entre informações
4. **💬 Responde perguntas** - Usa RAG com expansão via grafo para respostas contextuais

**✨ Diferencial**: Em vez de apenas buscar chunks similares (RAG tradicional), o sistema também explora o **grafo de conhecimento** para encontrar informações relacionadas através de entidades e co-ocorrências.

### 📊 Arquitetura do Grafo

```
📄 Documento
    │
    └─[CONTAINS]─> 📝 Chunk (+ embedding vetorial)
                     │
                     └─[MENTIONS]─> 🏷️ Entity
                                      │
                                      └─[CO_OCCURS]─> 🏷️ Entity
```

**Fluxo de recuperação**:
```
Pergunta → Embedding → Busca Vetorial (Top 5 chunks)
                            ↓
                    Entidades mencionadas
                            ↓
                    Chunks relacionados (via grafo)
                            ↓
                    Contexto expandido → LLM → Resposta
```

## 🚀 Tecnologias

- **Node.js v22+** - Runtime JavaScript
- **TypeScript** - Tipagem estática (experimental-strip-types)
- **LangChain.js** - Framework para aplicações LLM
- **Neo4j** - Banco de dados de grafos para GraphRAG
- **OpenRouter** - Provider de LLM (Meta Llama 3.1 8B)
- **HuggingFace Transformers** - Embeddings locais (all-MiniLM-L6-v2)
- **Express.js** - API REST
- **Multer** - Upload de arquivos

## ✨ Features

- ✅ **Upload de múltiplos documentos** (PDF e XML, até 50MB cada)
- ✅ **Processamento automático** com extração de texto e chunking inteligente
- ✅ **Embeddings locais** (sem custo de API, primeira execução baixa o modelo)
- ✅ **Extração de entidades** com NER baseado em regex
- ✅ **Grafo de conhecimento** com relacionamentos de co-ocorrência
- ✅ **Busca híbrida** (vetorial + expansão via grafo)
- ✅ **GraphRAG configurável** (ON/OFF na interface)
- ✅ **Respostas contextuais** limitadas ao conteúdo dos documentos
- ✅ **Interface web responsiva** com dark theme
- ✅ **API REST** completa (health, upload, documents, chat)
- ✅ **Scripts de gerenciamento** (init DB, clear DB)
- ✅ **Docker Compose** para Neo4j (setup simplificado)

## 📋 Pré-requisitos

- Node.js v22.0.0 ou superior
- Docker e Docker Compose
- Chave de API do OpenRouter (gratuita em https://openrouter.ai)

## 🔧 Instalação

### Passo 1: Dependências
```bash
cd Projeto-01
npm install
```

### Passo 2: Variáveis de Ambiente
```bash
# Copie o arquivo de exemplo
cp .env.example .env
```

Edite o arquivo `.env` e configure:
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
OPENROUTER_API_KEY=sua_chave_aqui  # Pegue em https://openrouter.ai
```

### Passo 3: Infraestrutura
```bash
# Inicia o Neo4j via Docker
npm run infra:up

# Inicializa os índices do banco
npm run init:db
```

### Passo 4: Download do Modelo (Recomendado)
```bash
# Pré-baixa o modelo de embeddings (~90MB)
# Isso evita timeout na primeira execução
npm run download:model
```

> 💡 **Opcional mas recomendado**: Este passo baixa o modelo de embeddings antecipadamente. Se pular, o download acontecerá automaticamente no primeiro uso (pode levar 2-5 minutos e ocasionalmente falhar por timeout).

### Passo 5: Iniciar o Sistema
```bash
npm run dev
```

Acesse: `http://localhost:3000`

## 💡 Exemplo de Uso

### Interface Web

1. **Upload de documentos** - Arraste PDFs/XMLs ou clique para selecionar
2. **Processamento** - Sistema extrai texto, gera embeddings e constrói grafo automaticamente
3. **Chat** - Digite perguntas sobre o conteúdo dos documentos
4. **Respostas contextuais** - Veja metadados: tempo, fontes, chunks, expansões via grafo

### Via API (cURL)

```bash
# Health check
curl http://localhost:3000/api/health

# Upload de documento
curl -X POST http://localhost:3000/api/upload \
  -F "files=@documento.pdf"

# Listar documentos
curl http://localhost:3000/api/documents

# Fazer pergunta
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Qual o tema principal do documento?", "useGraphRAG": true}'
```

## 🎯 Como Usar

## 📁 Estrutura do Projeto

```
Projeto-01/
├── src/
│   ├── api/                    # API REST
│   │   ├── server.ts          # Servidor Express
│   │   └── routes/            # Rotas da API
│   ├── parsers/               # Parsers de documentos
│   │   ├── pdfParser.ts      # Parser de PDF
│   │   └── xmlParser.ts      # Parser de XML
│   ├── services/              # Serviços principais
│   │   ├── documentProcessor.ts   # Processamento de documentos
│   │   ├── embeddingService.ts    # Geração de embeddings
│   │   ├── entityExtractor.ts     # Extração de entidades
│   │   ├── graphBuilder.ts        # Construção do grafo
│   │   ├── ragService.ts          # Serviço RAG
│   │   ├── vectorStore.ts         # Vector store Neo4j
│   │   └── aiService.ts           # Geração de respostas
│   ├── scripts/               # Scripts utilitários
│   │   ├── initDatabase.ts   # Inicializar BD
│   │   └── clearDatabase.ts  # Limpar BD
│   └── config.ts             # Configurações centralizadas
├── public/                    # Frontend
│   ├── index.html            # Interface web
│   ├── style.css             # Estilos
│   └── js/                   # JavaScript do frontend
│       ├── uploadManager.js  # Gerenciamento de uploads
│       ├── apiClient.js      # Cliente API
│       ├── chatController.js # Controlador de chat
│       └── uiView.js         # Manipulação DOM
├── prompts/                   # Templates de prompts
├── uploads/                   # Arquivos temporários
├── docker-compose.yml         # Configuração Docker
├── .env.example              # Exemplo de variáveis
└── package.json              # Dependências

```

## 🔍 Comandos Úteis

```bash
# 🛠️ Desenvolvimento
npm run dev              # Inicia servidor com hot-reload (watch mode)
npm start                # Inicia servidor (produção)

# 🐳 Infraestrutura
npm run infra:up         # Sobe o Neo4j via Docker
npm run infra:down       # Para o Neo4j e remove volumes

# 🗄️ Banco de Dados
npm run init:db          # Inicializa índices vetoriais no Neo4j
npm run clear:db         # Limpa todos os dados (reset completo)

# 🤖 Modelo de Embeddings
npm run download:model   # Pré-baixa o modelo de embeddings (recomendado)
```

## 🔎 Explorando o Grafo no Neo4j

Acesse o Neo4j Browser em `http://localhost:7474` (neo4j/password) e execute:

```cypher
// Ver todos os documentos
MATCH (d:Document)
RETURN d.fileName, d.fileType, d.createdAt
LIMIT 10

// Ver entidades mais mencionadas
MATCH (e:Entity)
RETURN e.name, e.type, e.occurrences
ORDER BY e.occurrences DESC
LIMIT 20

// Visualizar grafo de um documento
MATCH path = (d:Document)-[:CONTAINS]->(c:Chunk)-[:MENTIONS]->(e:Entity)
WHERE d.fileName CONTAINS "nome_arquivo"
RETURN path
LIMIT 25

// Ver co-ocorrências entre entidades
MATCH (e1:Entity)-[r:CO_OCCURS]-(e2:Entity)
RETURN e1.name, e2.name, r.count
ORDER BY r.count DESC
LIMIT 10
```

## 🌐 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Interface web |
| GET | `/api/health` | Status do sistema (Neo4j, vector store) |
| POST | `/api/upload` | Upload de arquivos (multipart/form-data) |
| GET | `/api/documents` | Lista documentos processados |
| GET | `/api/documents/:id` | Detalhes de um documento |
| DELETE | `/api/documents/:id` | Remove documento e seus dados |
| POST | `/api/chat` | Envia pergunta (retorna resposta completa) |
| POST | `/api/chat/stream` | Envia pergunta (streaming SSE) |

## 🧪 Testes

Siga o guia detalhado de testes em **[TESTING.md](./TESTING.md)** que inclui:
- ✅ Teste de conexão
- ✅ Upload de PDF/XML
- ✅ Perguntas simples e complexas
- ✅ GraphRAG ON/OFF
- ✅ Remoção de documentos
- ✅ Inspeção do grafo via Cypher

## 📦 Estrutura de Dados

### Nós do Grafo

- **Document**: `{ id, fileName, filePath, fileType, createdAt }`
- **Chunk**: `{ id, text, embedding[384], chunkIndex, source }`
- **Entity**: `{ id, name, type, occurrences }`

### Relacionamentos

- **CONTAINS**: `Document → Chunk` (um documento contém vários chunks)
- **MENTIONS**: `Chunk → Entity` (um chunk menciona uma entidade)
- **CO_OCCURS**: `Entity ↔ Entity` (entidades que aparecem próximas, com `count` e `strength`)

## 🔐 Segurança e Boas Práticas

- ⚠️ **Nunca commite o arquivo `.env`** com suas chaves de API
- ✅ O `.gitignore` já está configurado para arquivos sensíveis
- ✅ Para produção, use secrets managers (AWS Secrets, Azure Key Vault, etc.)
- ✅ Configure CORS adequadamente para ambientes de produção
- ✅ Adicione rate limiting e autenticação se expor publicamente

## 🚨 Troubleshooting

### "Failed to fetch" no frontend
- **Causa**: Servidor não está rodando
- **Solução**: Execute `npm run dev`

### "Neo4j offline" no health check
- **Causa**: Container Docker não está rodando
- **Solução**: Execute `npm run infra:up`

### ❌ Erro "TypeError: terminated" ou "other side closed"
- **Causa**: Conexão interrompida durante download do modelo de embeddings (primeira execução)
- **Sintomas**: 
  ```
  ❌ Erro ao inicializar embeddings: TypeError: terminated
  SocketError: other side closed
  ```
- **Soluções**:
  1. **Aguarde e tente novamente** - O sistema agora tem retry automático (3 tentativas)
  2. **Pré-baixe o modelo**: Execute `npm run download:model` antes de iniciar o servidor
  3. **Verifique sua conexão** - Certifique-se de ter uma conexão estável com a internet
  4. **Use um modelo menor** (opcional):
     ```env
     # No arquivo .env
     EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # Padrão: ~90MB
     # Ou use: Xenova/paraphrase-MiniLM-L3-v2  # Mais leve: ~60MB
     ```

### Upload travado em "Processando..."
- **Causa**: Primeira execução está baixando modelo de embeddings (~90MB)
- **Solução**: 
  - Aguarde 2-5 minutos (só acontece na primeira vez)
  - Ou execute `npm run download:model` antes para evitar espera

### "Index not found" ao fazer pergunta
- **Causa**: Banco não foi inicializado
- **Solução**: Execute `npm run init:db`

## 📚 Recursos e Referências

- [LangChain.js Documentation](https://js.langchain.com/docs/get_started/introduction)
- [Neo4j Vector Search](https://neo4j.com/docs/cypher-manual/current/indexes-for-vector-search/)
- [OpenRouter API](https://openrouter.ai/docs)
- [HuggingFace Transformers.js](https://huggingface.co/docs/transformers.js)
- [GraphRAG Concepts](https://microsoft.github.io/graphrag/)

## 📝 Notas

- 🎓 Esta é uma **POC educacional**, não está pronta para produção
- 🐳 Neo4j roda em Docker para facilitar o setup (sem instalação local)
- 💰 Embeddings são gerados **localmente** para economizar custos de API
- 🎯 Sistema **limita respostas** ao conteúdo dos documentos enviados (não alucina)

## 🤝 Contribuindo

Esta é uma POC educacional. Sinta-se livre para fazer fork e melhorar!

## 📄 Licença

MIT
