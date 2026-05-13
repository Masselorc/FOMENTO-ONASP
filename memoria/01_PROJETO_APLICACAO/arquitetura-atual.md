# Arquitetura Atual — FOMENTO-ONASP

## Finalidade

Este arquivo registra a arquitetura técnica real e atual do projeto FOMENTO-ONASP, com base nos arquivos existentes no repositório. Ele orienta manutenção, revisão, uso de IA/Codex e futuras alterações incrementais.

Este documento não substitui a leitura do código. Quando houver divergência, prevalecem os arquivos reais do repositório.

## Visão geral da aplicação

O projeto combina uma SPA em HTML, CSS e JavaScript, um backend local em Node, serviços de dados, banco SQLite local e publicação estática por JSONs.

A aplicação possui dois modos relevantes:

- modo local/API, usado para leitura com backend local e fluxos editáveis;
- modo estático/GitHub Pages, usado para consulta em modo somente leitura a partir de JSONs publicados.

O ponto de entrada da interface é `index.html`, que carrega `frontend/js/app.js`. O servidor local é `backend/server.js`. Os dados publicados ficam em `frontend/data/publicados/`.

## Camadas principais

### Frontend

- `index.html` define a estrutura base da SPA, menus e contêineres das views.
- `frontend/js/app.js` concentra navegação, renderização das páginas, filtros, modais, chamadas de API, leitura de dados normalizados e integração com componentes visuais.
- `frontend/css/app.css` concentra tokens visuais, layout, responsividade e estilos específicos das páginas.
- `frontend/js/core/` contém helpers compartilhados para modo estático, componentes de UI e estados de erro.
- `frontend/assets/` contém recursos visuais, incluindo bandeiras das UFs e o SVG de fundo do mapa de contatos.

### Backend local

- `backend/server.js` cria o servidor HTTP local, entrega arquivos estáticos e expõe rotas de API.
- O servidor usa `HOST` e `PORT` do ambiente quando disponíveis; o padrão observado é porta `8790`.
- As rotas de escrita chamam serviços específicos e, quando salvam com sucesso, acionam publicação estática por `publicarAposSalvamento`.
- O backend inicializa o banco local por meio de `prepararBanco()` ao subir o servidor.

### Serviços

- `backend/services/` concentra leitura, normalização, persistência, histórico, exportação e publicação.
- Parte dos serviços roda no backend Node CommonJS.
- `backend/services/data-service.js` é importado pelo frontend como módulo ES e funciona como fronteira de dados da SPA, incluindo fallback entre API, arquivos locais, planilhas e JSONs publicados.

### Banco de dados local

- O banco local confirmado é SQLite em `backend/data/onasp.sqlite`.
- O acesso usa `better-sqlite3` via `backend/db/database.js`.
- A inicialização e evolução mínima de schema ficam em `backend/db/init-db.js`.
- O preparo operacional do banco fica em `backend/db/preparar-banco.js`.
- O banco é artefato local e não deve ser versionado.

### Publicação estática

- A publicação estática gera JSONs em `frontend/data/publicados/`.
- `backend/services/static-publication-service.js` é o serviço principal de geração dos JSONs publicados.
- `backend/scripts/publicar-dados-estaticos.js` prepara o banco e executa a publicação.
- O modo GitHub Pages deve consumir os JSONs publicados sem depender do backend local.

### Testes e validações

- O projeto possui validação de JSONs publicados em `scripts/validar-json-publicados.js`.
- Há teste E2E básico com Playwright em `tests/e2e/app.spec.js`.
- `playwright.config.js` configura Chromium, servidor local com `npm start` e `baseURL` na porta `8790`.
- O hook local de pre-commit é configurado por `scripts/configurar-git-hooks.js`.

## Modos de execução

### Modo local/API

O modo local/API é editável. Ele usa:

- `npm start` para subir `backend/server.js`;
- rotas de API sob `/api/`;
- banco SQLite local;
- serviços backend para salvar dados e registrar histórico quando aplicável;
- publicação estática após salvamentos em fluxos que chamam `publicarAposSalvamento`.

Neste modo, a SPA pode tentar primeiro a API local e usar fallback publicado quando o serviço local estiver indisponível, conforme a lógica de `backend/services/data-service.js`.

### Modo estático/GitHub Pages

O modo estático/GitHub Pages é somente leitura. Ele:

- não deve depender de backend local;
- consome `frontend/data/publicados/`;
- usa helpers de `frontend/js/core/static-mode.js`;
- bloqueia ou sinaliza controles dependentes de backend por `data-requer-backend="true"`;
- deve preservar navegação, visualização de dados e páginas críticas sem rotas de escrita.

## Estrutura de pastas e arquivos relevantes

- `package.json`: scripts, dependências e dependências de desenvolvimento.
- `index.html`: estrutura base da SPA e contêineres de views.
- `backend/server.js`: servidor HTTP local, rotas de API e entrega estática local.
- `backend/data/aplicacao.json`: catálogo/base local consolidada usada pela aplicação.
- `backend/db/`: acesso, inicialização e preparo do banco SQLite.
- `backend/services/`: serviços de dados, persistência, publicação, histórico, exportação e apoio.
- `backend/scripts/`: scripts locais de importação e publicação.
- `frontend/js/app.js`: arquivo principal da SPA.
- `frontend/js/core/`: helpers compartilhados de modo estático, UI e erros.
- `frontend/css/app.css`: estilos principais.
- `frontend/assets/`: bandeiras das UFs e mapa de contatos.
- `frontend/data/publicados/`: JSONs usados no modo estático/GitHub Pages.
- `scripts/`: scripts de hook e validação agentic.
- `tests/`: testes E2E.
- `Planilhas/`: bases locais de origem usadas em ambiente local.
- `memoria/`: memória operacional em Markdown tratado.

## Scripts do projeto

Scripts reais encontrados em `package.json`:

- `npm start`: executa `node backend/server.js`.
- `npm run init-db`: executa `node backend/db/init-db.js`.
- `npm run import:parametros-minimos`: executa `node backend/scripts/importar-parametros-minimos.js`.
- `npm run publicar:dados`: executa `node backend/scripts/publicar-dados-estaticos.js`.
- `npm run setup:hooks`: executa `node scripts/configurar-git-hooks.js`.
- `npm run validar:setup`: instala Chromium do Playwright com `npx playwright install chromium`.
- `npm run validar:json`: valida JSONs publicados esperados.
- `npm run validar:syntax`: executa `node --check` nos scripts de validação e Playwright.
- `npm run validar:agente`: roda validação de JSON, sintaxe e teste Playwright.

## Fluxo geral de dados

Fluxo observado em alto nível:

1. Bases locais e arquivos de origem ficam em `Planilhas/` e `backend/data/aplicacao.json`.
2. `backend/services/data-service.js` normaliza e disponibiliza dados para a SPA, com leitura de planilhas, JSON local e JSONs publicados conforme o contexto.
3. `backend/server.js` expõe rotas locais para páginas editáveis.
4. Serviços específicos salvam alterações em banco SQLite ou em arquivo JSON, conforme o módulo.
5. Após salvamentos de rotas editáveis, `publicarAposSalvamento` chama `publicarDadosEstaticos`.
6. `backend/services/static-publication-service.js` gera JSONs em `frontend/data/publicados/`.
7. Em modo estático/GitHub Pages, a SPA consome os JSONs publicados e mantém edição bloqueada.

O fluxo completo de payloads, tabelas e dependências entre páginas deve ser detalhado posteriormente em `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md` e `memoria/08_ROTAS_BANCO_API/schema-banco.md`.

## Principais páginas ou áreas funcionais

Áreas evidenciadas em `index.html`, `frontend/js/app.js` e testes:

- Dashboard inicial.
- Detalhamento geral.
- Detalhe por UF.
- PROFOR 2022.
- Detalhe de convênio PROFOR.
- FAF 2021.
- Detalhe de FAF 2021 por UF.
- Doações 2023.
- Detalhe de Doações 2023.
- Orçamento 2026.
- Formalização PROFOR.
- Detalhe da Formalização PROFOR.
- Contatos das Unidades Federativas.
- Parâmetros Mínimos, com chave interna `diagnostico-ouvidorias`.
- Status do Sistema.

## Principais serviços backend

- `analytics.js`: cálculos agregados e métricas financeiras aparentes para dados da aplicação.
- `auth-service.js`: validação de senha de edição a partir de variável de ambiente.
- `backup-service.js`: criação de backup do banco SQLite por página antes de alterações.
- `dashboard-publication-service.js`: consolidação aparente do catálogo e dados do dashboard para publicação.
- `data-service.js`: fronteira de dados da SPA; carrega, normaliza e faz fallback entre API, planilhas e JSONs publicados.
- `excel-export-service.js`: exportação de Parâmetros Mínimos, Formalização PROFOR e Orçamento 2026 para Excel.
- `faf-2021-service.js`: listagem e salvamento de execução por item FAF 2021 em `backend/data/aplicacao.json`.
- `formalizacao-profor-service.js`: inicialização, listagem, salvamento e histórico da Formalização PROFOR.
- `historico-service.js`: registro de histórico de alterações no banco.
- `orcamento-2026-service.js`: inicialização, listagem, salvamento e histórico do Orçamento 2026.
- `parametros-minimos-config.js`: configuração dos parâmetros mínimos e normalização de status.
- `parametros-minimos-service.js`: listagem, salvamento, reversão e histórico de Parâmetros Mínimos.
- `static-publication-service.js`: geração dos JSONs publicados em `frontend/data/publicados/`.

## JSONs publicados

Arquivos reais encontrados em `frontend/data/publicados/`:

- `aplicacao.json`: catálogo/base publicada da aplicação.
- `dashboard-geral.json`: dados publicados usados pelo dashboard geral.
- `formalizacao-profor.json`: dados publicados da Formalização PROFOR.
- `orcamento-2026.json`: dados publicados do Orçamento 2026.
- `parametros-minimos.json`: dados publicados de Parâmetros Mínimos.
- `resumo-publicacao.json`: resumo da publicação, arquivos gerados e totais publicados.

Esses arquivos sustentam o modo estático/GitHub Pages. Alterações diretas devem ser evitadas; quando a tarefa exigir publicação, usar o fluxo existente.

## Banco de dados

O banco confirmado é `backend/data/onasp.sqlite`, criado/acessado por `backend/db/database.js`.

O arquivo `backend/db/init-db.js` confirma tabelas para:

- `parametros_minimos`;
- `formalizacao_profor`;
- `orcamento_2026`;
- `historico_alteracoes`.

Também há evolução incremental de colunas por `garantirColuna`, incluindo campos adicionais de Parâmetros Mínimos e rastreio do Orçamento 2026.

O schema detalhado, relações, índices, payloads e regras de migração ainda devem ser documentados em `memoria/08_ROTAS_BANCO_API/schema-banco.md`.

## Testes, validações e automações

- `scripts/validar-json-publicados.js` valida existência e estrutura mínima dos JSONs publicados esperados.
- `tests/e2e/app.spec.js` abre a SPA, acessa páginas principais e verifica ausência de erro crítico de console, page error e request local falha.
- `playwright.config.js` usa `npm start` como web server e `reuseExistingServer: true`.
- `scripts/configurar-git-hooks.js` cria hook local de pre-commit.
- O hook respeita `SKIP_PUBLICAR_DADOS=1` e só executa `npm run publicar:dados` quando detecta arquivos que podem afetar dados publicados.

## Pontos de atenção arquitetural

- Preservar a diferença entre modo local/API editável e modo estático/GitHub Pages somente leitura.
- Não editar manualmente `frontend/data/publicados/*.json` sem justificativa rastreável.
- Evitar republicação desnecessária e churn de `publicadoEm` em commits documentais, de teste ou infraestrutura.
- Não versionar `backend/data/onasp.sqlite`, backups, logs, `.env`, planilhas brutas ou anexos sensíveis.
- Evitar refatoração ampla de `frontend/js/app.js` sem plano incremental; o arquivo concentra grande parte da SPA.
- Validar impacto em serviços antes de alterar rotas, payloads, campos persistidos ou publicação estática.
- Preservar compatibilidade de páginas críticas: Dashboard, Parâmetros Mínimos, Formalização PROFOR, Orçamento 2026, FAF 2021, Contatos e Status do Sistema.
- Controles dependentes de backend devem usar bloqueio compatível com modo estático, especialmente `data-requer-backend="true"` quando aplicável.
- Alterações em serviços que salvam dados podem gerar JSONs publicados; conferir diff antes de concluir.

## O que não está confirmado

- O schema completo do banco ainda não está documentado em memória própria.
- Os payloads completos de todas as rotas ainda não estão documentados em `memoria/08_ROTAS_BANCO_API/rotas.md`.
- O fluxo completo de cada página, incluindo dependências finas de filtros, modais, histórico e exportação, ainda depende de análise específica por módulo.
- A política completa de versionamento de planilhas e dados brutos deve ser consultada no `.gitignore` e nas regras do projeto quando houver tarefa de dados.

## Critérios para atualizar este arquivo

Atualizar este arquivo quando houver mudança real em:

- arquitetura geral da aplicação;
- nova camada técnica;
- novo serviço backend relevante;
- nova rota estrutural;
- novo modo de execução;
- nova estratégia de publicação estática;
- nova automação de validação;
- mudança relevante no banco local;
- reorganização de frontend, backend, serviços, scripts ou testes.

Não atualizar este arquivo para mudanças pontuais de texto, estilo, dado operacional isolado ou correções que não alterem a arquitetura.
