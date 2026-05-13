# AGENTS.md

## Protocolo obrigatório

Antes de qualquer alteração no projeto:

1. Ler este `AGENTS.md`.
2. Ler `memoria/INDEX.md`.
3. Ler apenas os arquivos de memória indicados pelo índice para o tipo de tarefa.
4. Ler os arquivos reais do repositório diretamente afetados pela tarefa.

Não ler toda a pasta `memoria/` por padrão. A memória é apoio operacional, não substitui inspeção do código, dados, rotas, serviços, banco ou arquivos reais.

## Memória ausente ou incompleta

Se `memoria/INDEX.md` não existir, estiver vazio ou estiver incompleto:

- tratar a memória como incompleta;
- não inventar estrutura, arquivos, decisões, rotas, tabelas, colunas, endpoints, UFs, valores, processos ou fundamentos normativos;
- prosseguir apenas com os arquivos reais do repositório;
- não criar pastas ou arquivos temáticos de memória sem solicitação expressa.

Se `memoria/INDEX.md` indicar arquivos planejados ainda inexistentes, considerar esses arquivos opcionais e usar apenas quando existirem.

## Contexto técnico

O FOMENTO-ONASP é uma aplicação institucional com:

- backend local em Node, com servidor HTTP em `backend/server.js`;
- frontend SPA, com entrada principal em `frontend/js/app.js`;
- banco SQLite local em `backend/data/onasp.sqlite`, não versionável;
- serviços em `backend/services/` para leitura, normalização, persistência, histórico, exportação e publicação;
- publicação estática em `frontend/data/publicados/`;
- bases locais em `Planilhas/`.

O projeto possui dois modos relevantes:

- modo local/API: editável, com backend local e banco SQLite;
- modo estático/GitHub Pages: somente leitura, baseado nos JSONs publicados.

Toda alteração deve preservar essa diferença.

## Regras de trabalho

- Analisar a estrutura existente antes de sugerir ou aplicar código.
- Preservar a arquitetura atual e os fluxos já existentes.
- Priorizar patches pequenos, incrementais, testáveis e reversíveis.
- Não criar dependência nova sem justificar necessidade, alternativa nativa, impacto e risco de manutenção.
- Não remover service, rota, função, arquivo, coluna ou campo sem buscar referências.
- Não alterar diretamente JSONs publicados sem necessidade clara e rastreável.
- Não alterar regra de negócio de Parâmetros Mínimos, Formalização PROFOR ou Orçamento 2026 sem pedido explícito.
- Não reescrever fluxo existente quando uma correção localizada resolver.
- Não confundir nome visível de página com chave interna de rota.

## Segurança e sigilo

Não versionar nem copiar para a memória:

- credenciais, tokens, senhas ou chaves;
- banco SQLite;
- logs, backups e dumps;
- PDFs, DOCX, XLSX, imagens e anexos brutos;
- documentos SEI integrais;
- dados pessoais sensíveis ou informação sigilosa.

A pasta `memoria/` deve conter apenas Markdown tratado, sintético, operacional e não sensível. Não copiar documentos brutos para a memória.

## Dados e publicação estática

Ao trabalhar com dados, planilhas, dashboards, publicação ou modo estático:

1. Conferir a origem do dado.
2. Conferir o serviço responsável em `backend/services/`.
3. Conferir o endpoint local em `backend/server.js`, quando houver API envolvida.
4. Conferir o JSON correspondente em `frontend/data/publicados/`, quando a mudança afetar publicação.
5. Preservar o modo estático/GitHub Pages como somente leitura.

Não rodar `npm run publicar:dados` por hábito. Rodar apenas quando a tarefa depender de regenerar os JSONs publicados. Em commits que não tratem de dados, usar `SKIP_PUBLICAR_DADOS=1` quando necessário para impedir republicação automática pelo hook local.

## Diagnóstico

Ao revisar, corrigir ou implementar algo, apresentar quando aplicável:

1. Problema encontrado.
2. Evidência no código ou comportamento observado.
3. Impacto prático.
4. Correção aplicada ou recomendada.
5. Patch, trecho substitutivo ou prompt para Codex, quando útil.
6. Testes e validações recomendadas ou executadas.
7. Risco de regressão.
8. Rollback.

Classificar achados como:

- erro real;
- risco provável;
- melhoria recomendada;
- melhoria opcional;
- refatoração estética.

## Testes e validações

Usar validações proporcionais ao risco da mudança:

- `npm install`, quando dependências forem relevantes;
- `npm run init-db`, quando depender do banco local;
- `npm start`, para validar API local e entrega estática local;
- `npm run publicar:dados`, quando a tarefa exigir regenerar JSONs publicados;
- `npm run validar:json`, quando a mudança puder afetar publicação;
- `npm run validar:syntax` ou `node --check`, para JavaScript alterado;
- `npm run validar:agente`, quando a camada de validação agentic for relevante;
- console do navegador;
- logs do backend;
- validação local/API;
- validação estática/GitHub Pages;
- responsividade e acessibilidade básica;
- revisão de `git diff` antes de concluir.

## Atualização da memória

Ao final de tarefa relevante:

- atualizar `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, se existir e se a tarefa permitir alterar memória;
- atualizar `memoria/01_PROJETO_APLICACAO/pendencias.md`, se existir e houver mudança real de backlog;
- não criar arquivo temático automaticamente sem solicitação expressa;
- não registrar fontes brutas, documentos integrais, anexos ou dados sensíveis.

Se a tarefa restringir explicitamente os arquivos que podem ser alterados, respeitar essa restrição mesmo que o diário exista.

## Commit

Usar mensagens objetivas no padrão:

```text
tipo(escopo): descrição curta
```

Para esta família de alterações de memória agentic, a sugestão é:

```text
docs(memoria): orientar memoria agentica inicial
```
