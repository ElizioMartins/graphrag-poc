# 🤝 Contribuindo para GraphRAG POC

Obrigado por considerar contribuir para este projeto! 🎉

## 📋 Código de Conduta

Este projeto é uma POC educacional. Mantenha um ambiente respeitoso e construtivo para todos.

## 🐛 Reportando Bugs

Se encontrou um bug, por favor abra uma [issue](https://github.com/ElizioMartins/graphrag-poc/issues) incluindo:

- **Descrição clara** do problema
- **Passos para reproduzir** o bug
- **Comportamento esperado** vs. **comportamento atual**
- **Ambiente**: Node.js version, OS, Docker version
- **Logs relevantes** (se aplicável)

## 💡 Sugerindo Melhorias

Sugestões são bem-vindas! Abra uma [issue](https://github.com/ElizioMartins/graphrag-poc/issues) com:

- **Título descritivo**
- **Descrição detalhada** da melhoria proposta
- **Use cases** ou exemplos de como seria útil
- **Possíveis implementações** (opcional)

## 🔧 Contribuindo com Código

### Setup do Ambiente

1. **Fork** o repositório
2. **Clone** seu fork:
   ```bash
   git clone https://github.com/seu-usuario/graphrag-poc.git
   cd graphrag-poc
   ```
3. **Instale** as dependências:
   ```bash
   npm install
   ```
4. **Configure** o ambiente:
   ```bash
   cp .env.example .env
   # Edite .env com suas configurações
   ```
5. **Inicie** a infraestrutura:
   ```bash
   npm run infra:up
   npm run init:db
   ```

### Workflow de Desenvolvimento

1. **Crie uma branch** para sua feature/fix:
   ```bash
   git checkout -b feature/minha-feature
   # ou
   git checkout -b fix/meu-bugfix
   ```

2. **Faça suas alterações** seguindo os padrões do projeto:
   - Use TypeScript para código backend
   - Mantenha código limpo e comentado
   - Siga convenções de nomenclatura existentes
   - Adicione logs úteis com `console.log()` quando apropriado

3. **Teste suas mudanças**:
   ```bash
   npm run dev
   # Teste manualmente usando a interface ou API
   ```

4. **Commit** suas mudanças com mensagens descritivas:
   ```bash
   git add .
   git commit -m "✨ Feature: Adicionar suporte para DOCX
   
   - Implementar parser para documentos Word
   - Adicionar testes para novo formato
   - Atualizar documentação"
   ```

   **Convenção de commits**:
   - `✨ Feature:` - Nova funcionalidade
   - `🐛 Fix:` - Correção de bug
   - `📚 Docs:` - Mudanças na documentação
   - `♻️ Refactor:` - Refatoração de código
   - `⚡ Perf:` - Melhorias de performance
   - `🧪 Test:` - Adição ou correção de testes
   - `🔧 Chore:` - Tarefas de manutenção

5. **Push** para seu fork:
   ```bash
   git push origin feature/minha-feature
   ```

6. **Abra um Pull Request** no repositório original:
   - Descreva as mudanças claramente
   - Referencie issues relacionadas (#123)
   - Adicione screenshots se mudanças visuais
   - Aguarde revisão

## 📝 Padrões de Código

### TypeScript/JavaScript

- Use `const` e `let`, evite `var`
- Prefira async/await sobre callbacks
- Use template strings para concatenação
- Adicione tipos TypeScript quando possível
- Comente código complexo

### Estrutura de Arquivos

```
src/
├── api/           # Rotas e servidor Express
├── parsers/       # Parsers de documentos
├── services/      # Lógica de negócio
├── scripts/       # Scripts utilitários
└── config.ts      # Configurações centralizadas
```

### Nomeação

- **Arquivos**: camelCase (ex: `documentProcessor.ts`)
- **Classes**: PascalCase (ex: `DocumentProcessor`)
- **Funções/variáveis**: camelCase (ex: `processDocument`)
- **Constantes**: UPPER_SNAKE_CASE (ex: `MAX_FILE_SIZE`)

## 🎯 Áreas para Contribuição

Algumas ideias de melhorias bem-vindas:

### 🌟 Features

- [ ] Suporte para mais formatos (DOCX, TXT, Markdown, HTML)
- [ ] Upload via URL (baixar documento de link)
- [ ] Streaming de respostas no frontend (SSE)
- [ ] Múltiplos LLMs (seleção na interface)
- [ ] Export de conversas (JSON, Markdown)
- [ ] Suporte a múltiplos idiomas
- [ ] Autenticação e multi-tenancy
- [ ] Embeddings customizáveis (OpenAI, Cohere, etc.)

### 🐛 Melhorias

- [ ] Testes automatizados (Jest/Vitest)
- [ ] CI/CD com GitHub Actions
- [ ] Linting (ESLint) e formatação (Prettier)
- [ ] Docker para aplicação completa
- [ ] Logs estruturados (Winston/Pino)
- [ ] Métricas e observabilidade
- [ ] Rate limiting e segurança
- [ ] Cache de embeddings

### 📚 Documentação

- [ ] Tutoriais em vídeo
- [ ] Exemplos de uso avançado
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Diagramas de arquitetura (draw.io, mermaid)
- [ ] Troubleshooting expandido
- [ ] Tradução para outros idiomas

## 🧪 Testes

Ao adicionar novas features:

1. Teste manualmente usando o guia [TESTING.md](./TESTING.md)
2. Verifique logs no console para erros
3. Inspecione o grafo no Neo4j Browser
4. Teste casos de erro (arquivos inválidos, entradas vazias, etc.)

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [MIT License](./LICENSE).

## 💬 Dúvidas?

- Abra uma [issue](https://github.com/ElizioMartins/graphrag-poc/issues)
- Entre em contato via discussões do GitHub

---

**Obrigado por contribuir! 🚀**
