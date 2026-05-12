# GraphRAG POC - Sistema RAG com GraphRAG

Prova de Conceito (POC) de um sistema inteligente capaz de ler documentos (PDF e XML) e responder perguntas sobre eles usando arquitetura RAG (Retrieval-Augmented Generation) com GraphRAG.

## 🎯 O que é isso?

Este projeto implementa um sistema de perguntas e respostas sobre documentos que:
1. **Processa documentos** - Lê PDFs e XMLs, extrai o texto e divide em chunks
2. **Cria embeddings** - Gera vetores semânticos usando modelo local (HuggingFace)
3. **Constrói um grafo** - Identifica entidades e relacionamentos entre informações
4. **Responde perguntas** - Usa RAG com expansão via grafo para respostas contextuais

**Diferencial**: Em vez de apenas buscar chunks similares (RAG tradicional), o sistema também explora o **grafo de conhecimento** para encontrar informações relacionadas através de entidades e co-ocorrências.

## 🚀 Tecnologias

- **Node.js v22+** - Runtime JavaScript
- **TypeScript** - Tipagem estática (experimental-strip-types)
- **LangChain.js** - Framework para aplicações LLM
- **Neo4j** - Banco de dados de grafos para GraphRAG
- **OpenRouter** - Provider de LLM
- **HuggingFace Transformers** - Embeddings locais
- **Express.js** - API REST
- **Multer** - Upload de arquivos

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

### Passo 4: Iniciar o Sistema
```bash
npm run dev
```

Acesse: `http://localhost:3000`

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
# Desenvolvimento
npm run dev              # Inicia servidor com hot-reload

# Produção
npm start                # Inicia servidor

# Infraestrutura
npm run infra:up         # Sobe o Neo4j
npm run infra:down       # Para o Neo4j e remove volumes

# Banco de Dados
npm run init:db          # Inicializa índices no Neo4j
npm run clear:db         # Limpa todos os dados do Neo4j
```

## 🌐 Endpoints da API

- `GET /` - Interface web
- `GET /api/health` - Status do sistema
- `POST /api/upload` - Upload de arquivos
- `GET /api/documents` - Lista documentos processados
- `POST /api/chat` - Enviar pergunta

## 🔐 Segurança

- Nunca commite o arquivo `.env` com suas chaves de API
- O `.gitignore` já está configurado para ignorar arquivos sensíveis
- Para produção, considere usar secrets managers

## 📝 Notas

- Esta é uma POC para demonstração, não está pronta para produção
- O Neo4j roda em Docker para facilitar o setup
- Os embeddings são gerados localmente para economizar custos
- O sistema limita as respostas ao conteúdo dos documentos enviados

## 🤝 Contribuindo

Esta é uma POC educacional. Sinta-se livre para fazer fork e melhorar!

## 📄 Licença

MIT
