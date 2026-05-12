# 🧪 Guia de Teste - GraphRAG POC

Este guia ajudará você a testar todas as funcionalidades do sistema.

## ✅ Pré-requisitos

Antes de começar os testes, certifique-se que:

```bash
# 1. Neo4j está rodando
docker ps | grep neo4j  # Deve mostrar o container rodando

# 2. Banco foi inicializado
npm run init:db  # Deve mostrar "✅ Banco de dados inicializado"

# 3. Servidor está rodando
npm run dev  # Deve mostrar "🚀 Servidor rodando em http://localhost:3000"
```

## 📝 Roteiro de Testes

### 1. Teste de Conexão

**Objetivo**: Verificar se todos os serviços estão online

1. Abra `http://localhost:3000` no navegador
2. Verifique o indicador de status no canto inferior esquerdo
3. Deve mostrar: **"Sistema online"** com um ponto verde

**Problemas comuns**:
- ❌ "Sistema offline" → Verificar se Neo4j está rodando (`npm run infra:up`)
- ❌ "Erro de conexão" → Verificar logs do servidor no terminal

---

### 2. Teste de Upload de Documentos

**Objetivo**: Processar documentos e construir o grafo

#### 2.1 Upload de PDF

1. Clique no botão **"Upload de Arquivos"**
2. Selecione um arquivo PDF (até 50MB)
3. Aguarde o processamento:
   - Progresso de upload (0-100%)
   - Mensagem "Processando documentos..."
   - Mensagem final "✅ Processamento concluído!"
4. O arquivo deve aparecer na lista lateral

**Verificar**:
- ✅ Nome do arquivo exibido corretamente
- ✅ Número de chunks processados (ex: "42 chunks")
- ✅ Data e hora do upload

#### 2.2 Upload de XML

1. Repita o processo com um arquivo XML
2. Verifique se foi processado corretamente

**Exemplo de estrutura XML esperada**:
```xml
<?xml version="1.0"?>
<document>
    <title>Título do Documento</title>
    <section>
        <heading>Seção 1</heading>
        <content>Conteúdo da seção...</content>
    </section>
</document>
```

#### 2.3 Upload Múltiplo

1. Selecione 2-3 arquivos de uma vez
2. Verifique se todos foram processados
3. Confirme que todos aparecem na lista

---

### 3. Teste de Perguntas e Respostas

**Objetivo**: Verificar a recuperação de informações e geração de respostas

#### 3.1 Pergunta Simples

1. Digite uma pergunta direta sobre o conteúdo:
   - **Exemplo**: "Qual o nome do autor mencionado no documento?"
2. Pressione Enter ou clique em 📤
3. Aguarde a resposta (5-10 segundos)

**Verificar**:
- ✅ Mensagem do usuário aparece no chat
- ✅ Indicador de digitação (três pontos) aparece
- ✅ Resposta da IA aparece
- ✅ Metadados são exibidos:
  - ⏱️ Tempo de processamento
  - 📄 Número de fontes usadas
  - 🔍 Chunks recuperados
  - 🔗 Expansões via grafo

#### 3.2 Pergunta Complexa

1. Faça uma pergunta que requer informações de múltiplos trechos:
   - **Exemplo**: "Quais são as principais tecnologias mencionadas e como elas se relacionam?"
2. Verifique se a resposta integra informações de diferentes partes

#### 3.3 Teste GraphRAG ON/OFF

**Com GraphRAG (checkbox marcado)**:
1. Marque a opção "Usar GraphRAG"
2. Faça uma pergunta: "Quais entidades estão relacionadas a [conceito]?"
3. Observe o número de **expansões via grafo** nos metadados

**Sem GraphRAG (checkbox desmarcado)**:
1. Desmarque a opção "Usar GraphRAG"
2. Faça a mesma pergunta
3. Compare a resposta (deve ser mais limitada)

**Esperado**: Com GraphRAG, o sistema deve encontrar mais informações relacionadas.

---

### 4. Teste de Remoção de Documentos

#### 4.1 Remover Um Documento

1. Clique no ícone 🗑️ ao lado de um documento
2. Confirme a remoção no diálogo
3. Verifique que o documento sumiu da lista

#### 4.2 Limpar Todos os Documentos

1. Clique no ícone 🗑️ no topo da barra lateral
2. Confirme a ação (ATENÇÃO: remove tudo!)
3. Verifique que a lista ficou vazia

---

### 5. Testes de Validação

#### 5.1 Teste de Limitação de Contexto

**Objetivo**: Verificar que o sistema NÃO inventa informações

1. Faça upload de um documento sobre um tema específico
2. Faça uma pergunta sobre algo que NÃO está no documento:
   - **Exemplo**: Se o doc é sobre tecnologia, pergunte sobre receitas de comida
3. **Resultado esperado**: O sistema deve responder que não encontrou informações sobre isso

#### 5.2 Teste de Caracteres Especiais

1. Faça upload de um documento com:
   - Acentuação (português)
   - Caracteres especiais (&, %, @, etc.)
   - Números e datas
2. Faça perguntas sobre esses dados
3. Verifique se são recuperados corretamente

#### 5.3 Teste de Documentos Vazios

1. Tente fazer upload de:
   - PDF com poucas palavras (< 100)
   - XML vazio ou mal formatado
2. Verifique se o sistema trata erros graciosamente

---

## 🔍 Verificação no Neo4j Browser

Para inspecionar o grafo diretamente:

1. Abra `http://localhost:7474` no navegador
2. Login: `neo4j` / `password`
3. Execute queries Cypher:

### Ver todos os documentos
```cypher
MATCH (d:Document)
RETURN d.fileName, d.fileType, d.createdAt
LIMIT 10
```

### Ver chunks de um documento
```cypher
MATCH (d:Document)-[:CONTAINS]->(c:Chunk)
WHERE d.fileName CONTAINS "nome_arquivo"
RETURN c.text, c.chunkIndex
LIMIT 5
```

### Ver entidades extraídas
```cypher
MATCH (e:Entity)
RETURN e.name, e.type, e.occurrences
ORDER BY e.occurrences DESC
LIMIT 20
```

### Ver relacionamentos de co-ocorrência
```cypher
MATCH (e1:Entity)-[r:CO_OCCURS]-(e2:Entity)
RETURN e1.name, e2.name, r.count
ORDER BY r.count DESC
LIMIT 10
```

### Ver grafo de um documento
```cypher
MATCH path = (d:Document)-[:CONTAINS]->(c:Chunk)-[:MENTIONS]->(e:Entity)
WHERE d.fileName CONTAINS "nome_arquivo"
RETURN path
LIMIT 25
```

---

## 📊 Métricas de Sucesso

Considere o teste bem-sucedido se:

- ✅ Uploads processam em < 30 segundos para arquivos de 1-2MB
- ✅ Perguntas são respondidas em < 10 segundos
- ✅ Respostas citam trechos dos documentos
- ✅ GraphRAG aumenta o número de chunks recuperados
- ✅ Sistema não alucina informações fora do contexto
- ✅ Interface não trava ou mostra erros

---

## 🐛 Problemas Comuns

### Erro: "Failed to fetch"
- **Causa**: Servidor não está rodando
- **Solução**: `npm run dev` em um terminal

### Erro: "Neo4j offline"
- **Causa**: Container Docker não está rodando
- **Solução**: `npm run infra:up`

### Upload travado em "Processando..."
- **Causa**: Primeiro upload está baixando modelo de embeddings
- **Solução**: Aguardar (pode levar 2-5 minutos na primeira vez)

### Respostas genéricas/vazias
- **Causa**: Documentos não foram processados corretamente
- **Solução**: Verificar logs do servidor, reprocessar documentos

### Erro: "Index not found"
- **Causa**: Banco não foi inicializado
- **Solução**: `npm run init:db`

---

## 🧹 Limpar e Recomeçar

Se algo der errado e você quiser começar do zero:

```bash
# 1. Parar servidor (Ctrl+C no terminal)

# 2. Limpar banco de dados
npm run clear:db

# 3. Recriar índices
npm run init:db

# 4. Reiniciar servidor
npm run dev
```

---

## 📝 Log de Testes

Use esta checklist para acompanhar seus testes:

- [ ] Conexão verificada
- [ ] Upload de PDF funcionando
- [ ] Upload de XML funcionando
- [ ] Upload múltiplo funcionando
- [ ] Pergunta simples respondida
- [ ] Pergunta complexa respondida
- [ ] GraphRAG ON testado
- [ ] GraphRAG OFF testado
- [ ] Remoção de documento funcionando
- [ ] Limpeza total funcionando
- [ ] Limitação de contexto verificada
- [ ] Caracteres especiais testados
- [ ] Grafo inspecionado no Neo4j

---

## 🎓 Próximos Passos

Depois de validar tudo:
1. Experimente com seus próprios documentos
2. Ajuste os parâmetros em `src/config.ts`
3. Personalize os prompts em `prompts/`
4. Explore melhorias (streaming, múltiplos LLMs, etc.)

Boa sorte! 🚀
