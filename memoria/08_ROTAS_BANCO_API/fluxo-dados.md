# Fluxo de Dados — FOMENTO-ONASP

## Finalidade

Este arquivo documenta o fluxo real de dados do projeto FOMENTO-ONASP, com base nos arquivos existentes no repositório.

Ele orienta manutenção, revisão técnica, uso de Codex/IA e futuras alterações incrementais. Não substitui a leitura do código. Quando houver divergência, prevalecem os arquivos reais do repositório.

Este documento descreve o fluxo entre fontes, serviços, banco, API local, frontend e publicação estática. O detalhamento completo de endpoints e schema deve ficar em `rotas.md` e `schema-banco.md`.

## Visão geral do fluxo

O projeto combina:

- fontes locais e arquivos-base em `backend/data/aplicacao.json` e `Planilhas/`;
- banco SQLite local em `backend/data/onasp.sqlite`;
- serviços backend em `backend/services/`;
- servidor HTTP local em `backend/server.js`;
- frontend SPA em `index.html` e `frontend/js/app.js`;
- publicação estática em `frontend/data/publicados/`;
- consumo em modo estático/GitHub Pages a partir dos JSONs publicados.

Fluxo geral confirmado:

1. O backend prepara o banco com `backend/db/preparar-banco.js`.
2. `backend/db/init-db.js` cria ou evolui tabelas e colunas locais.
3. Serviços em `backend/services/` leem planilhas, JSON local e banco SQLite, normalizam dados e expõem funções para rotas e publicação.
4. `backend/server.js` entrega arquivos estáticos e expõe rotas locais sob `/api/`.
5. O frontend importa `backend/services/data-service.js` como módulo ES e tenta carregar dados pela API local ou por JSONs publicados, conforme o modo de execução.
6. Salvamentos locais bem-sucedidos chamam `publicarAposSalvamento`, que aciona `publicarDadosEstaticos`.
7. `backend/services/static-publication-service.js` grava JSONs em `frontend/data/publicados/`.
8. Em GitHub Pages, a SPA trabalha em modo somente leitura com os JSONs publicados.

## Fontes de dados

Fontes confirmadas no repositório:

- `backend/data/aplicacao.json`: catálogo/base local consolidada da aplicação. Alimenta dados gerais, FAF 2021 e parte da publicação do dashboard.
- `Planilhas/gestao_financeira_ouvidoria.xlsx`: arquivo apontado por `backend/data/aplicacao.json` em `configuracao.arquivoPlanilhaConvenios`; usado na consolidação do dashboard e dados de convênios.
- `Planilhas/orcamento_onasp.xlsx`: fonte inicial do Orçamento 2026.
- `Planilhas/Planilha_Formalizacao_PROFOR_2026.xlsx`: fonte inicial da Formalização PROFOR.
- `Planilhas/Contatos.xlsx`: fonte aparente dos contatos das UFs no frontend.
- `Planilhas/Diagnostico.xlsx`: fonte auxiliar de respostas originais para Parâmetros Mínimos.
- `Planilhas/Parametros_Minimos.xlsx`: fonte de importação inicial de Parâmetros Mínimos.
- `backend/data/onasp.sqlite`: banco SQLite local, criado/acessado por `backend/db/database.js`.
- `frontend/data/publicados/*.json`: fonte do modo estático/GitHub Pages.

Não há evidência, nesta inspeção, de banco remoto, serviço externo ou API externa obrigatória para execução local.

## Camadas do fluxo

### Origem local e arquivos-base

`backend/data/aplicacao.json` contém catálogo, configuração, dados base e metadados usados pela aplicação e pela publicação.

As planilhas em `Planilhas/` são lidas por serviços backend ou pelo `data-service.js` no frontend. Elas funcionam como fontes locais tratadas, não como arquivos a serem copiados para a memória.

### Banco SQLite local

O banco confirmado é `backend/data/onasp.sqlite`.

Arquivos envolvidos:

- `backend/db/database.js`: abre o SQLite com `better-sqlite3`, ativa WAL e `foreign_keys`.
- `backend/db/init-db.js`: cria tabelas e adiciona colunas de evolução.
- `backend/db/preparar-banco.js`: inicializa banco, importa Parâmetros Mínimos quando necessário e inicializa Formalização PROFOR e Orçamento 2026.

Tabelas confirmadas em alto nível:

- `parametros_minimos`;
- `formalizacao_profor`;
- `orcamento_2026`;
- `orcamento_2026_movimentacoes`;
- `historico_alteracoes`.

O schema detalhado deve ser documentado em `schema-banco.md`.

### Serviços backend

Responsabilidades confirmadas:

- `backend/services/data-service.js`: camada de obtenção, normalização, cache e fallback de dados usada pela SPA.
- `backend/services/parametros-minimos-service.js`: lista, salva, reverte e consulta histórico de Parâmetros Mínimos no SQLite.
- `backend/services/formalizacao-profor-service.js`: inicializa, lista, salva e consulta histórico da Formalização PROFOR no SQLite.
- `backend/services/orcamento-2026-service.js`: inicializa, lista, salva, cria vinculados, aloca saldo, lista movimentações e consulta histórico do Orçamento 2026 no SQLite.
- `backend/services/faf-2021-service.js`: lista e salva execução do FAF 2021 em `backend/data/aplicacao.json`.
- `backend/services/static-publication-service.js`: publica JSONs estáticos em `frontend/data/publicados/`.
- `backend/services/dashboard-publication-service.js`: consolida catálogo e dashboard a partir de `backend/data/aplicacao.json` e da planilha configurada.
- `backend/services/excel-export-service.js`: gera exportações Excel para Parâmetros Mínimos, Formalização PROFOR e Orçamento 2026.
- `backend/services/historico-service.js`: registra histórico em `historico_alteracoes`.

### Rotas locais de API

`backend/server.js` expõe rotas locais sob `/api/`.

Áreas com rotas confirmadas:

- Parâmetros Mínimos: leitura, salvamento, histórico, reversão de histórico e exportação.
- Formalização PROFOR: leitura, salvamento, histórico e exportação.
- Orçamento 2026: leitura, salvamento, criação de processo vinculado, alocação de saldo, movimentações, histórico e exportação.
- FAF 2021: leitura e salvamento de execução por item.

Payloads, respostas completas, códigos de erro e efeitos colaterais devem ser detalhados em `rotas.md`.

### Frontend SPA

`frontend/js/app.js` concentra navegação, renderização de views, modais, filtros, estados de edição e chamadas ao backend.

Ele usa funções importadas de `backend/services/data-service.js`, incluindo:

- `carregarDadosAplicacao`;
- `carregarDadosFormalizacaoProfor`;
- `carregarDadosDiagnosticoOuvidorias`;
- `carregarDadosOrcamento`;
- `carregarDadosContatos`;
- `fetchJsonApiOnasp`;
- getters de dados em cache, como `obterDadosOrcamento` e `obterDadosContatos`.

Controles que dependem do backend usam `data-requer-backend="true"` por meio dos helpers de UI. `frontend/js/core/static-mode.js` aplica bloqueio visual e funcional no modo estático.

### Publicação estática

`backend/services/static-publication-service.js` é o ponto central da publicação.

Ele:

- lê `backend/data/aplicacao.json`;
- chama `listarParametrosMinimos`;
- chama `listarFormalizacaoProfor`;
- chama `listarOrcamento2026`;
- chama `consolidarCatalogoDashboard`;
- grava JSONs em `frontend/data/publicados/` por escrita atômica.

`backend/scripts/publicar-dados-estaticos.js` executa `prepararBanco()` e depois `publicarDadosEstaticos()`.

### JSONs publicados

Arquivos reais confirmados em `frontend/data/publicados/`:

- `aplicacao.json`: catálogo/base publicada da aplicação, com `dadosBase`, `dadosProfor2022` e metadados de publicação.
- `dashboard-geral.json`: dados publicados usados pelo dashboard geral.
- `parametros-minimos.json`: dados publicados de Parâmetros Mínimos.
- `formalizacao-profor.json`: dados publicados da Formalização PROFOR.
- `orcamento-2026.json`: dados publicados do Orçamento 2026.
- `resumo-publicacao.json`: resumo da publicação e lista de arquivos publicados.

Esses arquivos são derivados. Não devem ser editados manualmente sem justificativa explícita.

## Fluxo por modo de execução

### Modo local/API

Características confirmadas:

- o backend local roda por `npm start`, executando `backend/server.js`;
- o servidor prepara o banco antes de ouvir a porta;
- a SPA tenta consumir API local para áreas editáveis;
- salvamentos exigem senha validada no backend;
- serviços persistem em SQLite ou em `backend/data/aplicacao.json`, conforme o módulo;
- salvamentos bem-sucedidos acionam publicação estática quando passam por `publicarAposSalvamento`;
- a aplicação pode cair para JSON publicado quando a API local não responde em alguns carregamentos.

Este é o modo editável.

### Modo estático/GitHub Pages

Características confirmadas:

- detectado em `data-service.js` quando o hostname termina com `github.io`;
- usa JSONs em `frontend/data/publicados/`;
- registra modo `estatico` nas chaves de dados;
- bloqueia controles dependentes de backend por `data-requer-backend="true"`;
- exibe avisos de publicação em páginas compatíveis;
- não persiste alterações.

Este é o modo somente leitura.

## Fluxo por área funcional

### Dashboard geral

**Origem aparente:** `backend/data/aplicacao.json` e planilha configurada em `configuracao.arquivoPlanilhaConvenios`, atualmente `Planilhas/gestao_financeira_ouvidoria.xlsx`.

**Serviços envolvidos:** `backend/services/data-service.js`, `backend/services/dashboard-publication-service.js`, `backend/services/static-publication-service.js`.

**Rotas envolvidas:** não há rota local específica de dashboard confirmada em `backend/server.js`.

**Persistência:** a base principal está em `backend/data/aplicacao.json`; a publicação consolida dados de convênios a partir da planilha configurada.

**Publicação estática:** `aplicacao.json` e `dashboard-geral.json`.

**Frontend:** `frontend/js/app.js` usa dados carregados por `carregarCatalogoAplicacao` e `carregarDadosAplicacao`.

**Observações de manutenção:** alterações no dashboard podem exigir conferência da planilha configurada, do catálogo local e dos JSONs publicados.

### Parâmetros Mínimos

**Origem aparente:** `Planilhas/Parametros_Minimos.xlsx` e `Planilhas/Diagnostico.xlsx` para importação/contexto inicial; depois, SQLite.

**Serviços envolvidos:** `backend/scripts/importar-parametros-minimos.js`, `backend/services/parametros-minimos-service.js`, `backend/services/historico-service.js`, `backend/services/static-publication-service.js`.

**Rotas envolvidas:** `/api/parametros-minimos`, `/api/parametros-minimos/salvar`, `/api/parametros-minimos/historico`, `/api/parametros-minimos/historico/reverter`, `/api/parametros-minimos/exportar`.

**Persistência:** tabela `parametros_minimos` e histórico em `historico_alteracoes`.

**Publicação estática:** `parametros-minimos.json`.

**Frontend:** view interna `diagnostico-ouvidorias`, com nome visível Parâmetros Mínimos.

**Observações de manutenção:** preservar o nome visível Parâmetros Mínimos e a chave interna existente, salvo pedido explícito de renomeação.

### Formalização PROFOR

**Origem aparente:** `Planilhas/Planilha_Formalizacao_PROFOR_2026.xlsx` para inicialização; depois, SQLite.

**Serviços envolvidos:** `backend/services/formalizacao-profor-service.js`, `backend/services/historico-service.js`, `backend/services/static-publication-service.js`.

**Rotas envolvidas:** `/api/formalizacao-profor`, `/api/formalizacao-profor/salvar`, `/api/formalizacao-profor/historico`, `/api/formalizacao-profor/exportar`.

**Persistência:** tabela `formalizacao_profor` e histórico em `historico_alteracoes`.

**Publicação estática:** `formalizacao-profor.json`.

**Frontend:** views `formalizacao` e `formalizacao-detalhe`.

**Observações de manutenção:** salvamentos são por etapa/UF e devem preservar histórico e publicação.

### Orçamento 2026

**Origem aparente:** `Planilhas/orcamento_onasp.xlsx` para inicialização/backfill; depois, SQLite.

**Serviços envolvidos:** `backend/services/orcamento-2026-service.js`, `backend/services/historico-service.js`, `backend/services/static-publication-service.js`, `backend/services/excel-export-service.js`.

**Rotas envolvidas:** `/api/orcamento-2026`, `/api/orcamento-2026/salvar`, `/api/orcamento-2026/processos-vinculados/criar`, `/api/orcamento-2026/saldos/alocar`, `/api/orcamento-2026/movimentacoes`, `/api/orcamento-2026/historico`, `/api/orcamento-2026/exportar`.

**Persistência:** tabela `orcamento_2026`, tabela `orcamento_2026_movimentacoes` e histórico em `historico_alteracoes`.

**Publicação estática:** `orcamento-2026.json`.

**Frontend:** view `orcamento`, com modais de edição, divisão de recurso e alocação de saldo.

**Observações de manutenção:** o backend é fonte de verdade para saldo real, criação de vinculados e alocação; o frontend faz leitura visual e estimativas operacionais.

### FAF 2021

**Origem aparente:** itens com instrumento `FAF 2021` em `backend/data/aplicacao.json`.

**Serviços envolvidos:** `backend/services/faf-2021-service.js`, `backend/services/static-publication-service.js`, `backend/services/data-service.js`.

**Rotas envolvidas:** `/api/faf2021`, `/api/faf2021/salvar`.

**Persistência:** escrita direta em `backend/data/aplicacao.json` para `valorExecutado`, `observacaoExecucao` e `atualizadoEm`, conforme serviço.

**Publicação estática:** via `aplicacao.json` e `dashboard-geral.json`, quando a publicação estática é executada após salvamento.

**Frontend:** views `faf2021` e `faf2021-detalhe`.

**Observações de manutenção:** por não usar SQLite neste serviço, alterações exigem cuidado adicional com diff de `backend/data/aplicacao.json` e publicação estática.

### Contatos das UFs

**Origem aparente:** `Planilhas/Contatos.xlsx`, carregada pelo frontend por `carregarDadosContatos`.

**Serviços envolvidos:** `backend/services/data-service.js` no frontend; não há serviço CommonJS backend específico confirmado para persistência de contatos.

**Rotas envolvidas:** não há rota `/api` de contatos confirmada em `backend/server.js`.

**Persistência:** não há persistência local confirmada para contatos nesta inspeção.

**Publicação estática:** não há JSON específico de contatos em `frontend/data/publicados/`.

**Frontend:** view `contatos`, com mapa/lista derivados dos dados carregados.

**Observações de manutenção:** mudanças em contatos devem confirmar disponibilidade da planilha e comportamento em modo estático antes de alterar a interface.

### Status do Sistema

**Origem aparente:** estado de carregamento da própria SPA, modos de dados registrados por `data-service.js` e `resumo-publicacao.json`.

**Serviços envolvidos:** `backend/services/data-service.js` e helpers de modo estático.

**Rotas envolvidas:** não há rota local específica de status confirmada em `backend/server.js`.

**Persistência:** não há persistência própria confirmada.

**Publicação estática:** lê informações de publicação a partir de `frontend/data/publicados/resumo-publicacao.json`.

**Frontend:** view `status-sistema`.

**Observações de manutenção:** útil para diagnosticar modo local/API versus estático e disponibilidade dos dados carregados.

## Publicação estática após salvamento

`backend/server.js` possui `publicarAposSalvamento(resultado)`.

Quando uma rota de escrita retorna `success: true`, essa função chama `publicarDadosEstaticos()` e adiciona o resultado da publicação à resposta.

Rotas de escrita que passam por esse fluxo confirmado:

- `POST /api/parametros-minimos/salvar`;
- `POST /api/parametros-minimos/historico/reverter`;
- `POST /api/formalizacao-profor/salvar`;
- `POST /api/orcamento-2026/salvar`;
- `POST /api/orcamento-2026/processos-vinculados/criar`;
- `POST /api/orcamento-2026/saldos/alocar`;
- `POST /api/faf2021/salvar`.

Publicação manual:

- `npm run publicar:dados`;
- executa `backend/scripts/publicar-dados-estaticos.js`;
- chama `prepararBanco()`;
- chama `publicarDadosEstaticos()`.

O hook local configurado por `scripts/configurar-git-hooks.js` pode rodar publicação antes do commit quando arquivos de fonte de dados são staged. Para commits documentais, usar `SKIP_PUBLICAR_DADOS=1` quando necessário para evitar churn de JSON publicado.

## Exportações

Exportações confirmadas:

- `GET /api/parametros-minimos/exportar`: usa `exportarParametrosMinimosExcel`.
- `GET /api/formalizacao-profor/exportar`: usa `exportarFormalizacaoProforExcel`.
- `GET /api/orcamento-2026/exportar`: usa `exportarOrcamento2026Excel`.

Serviço responsável:

- `backend/services/excel-export-service.js`.

Não há exportação confirmada para Dashboard, FAF 2021, Contatos ou Status do Sistema nesta inspeção.

## Validações relacionadas a dados

Validações e automações confirmadas:

- `npm run validar:json`: executa `scripts/validar-json-publicados.js`.
- `scripts/validar-json-publicados.js`: confere a existência e estrutura mínima dos JSONs publicados esperados.
- `npm run validar:syntax`: confere sintaxe de scripts de validação, Playwright config e teste E2E.
- `npm run validar:agente`: combina validação de JSON, sintaxe e Playwright.
- `git diff --check`: deve ser usado antes de commits para detectar whitespace inválido.
- revisão de `git diff -- frontend/data/publicados/`: necessária quando houver publicação estática.

Cuidados recorrentes:

- diferenciar alteração material de dado versus churn de `publicadoEm`;
- não commitar JSON publicado em tarefa documental;
- não rodar `npm run publicar:dados` fora de etapa de publicação ou alteração real de dados.

## Riscos e cuidados ao alterar dados

- Alteração manual indevida em `frontend/data/publicados/*.json`.
- Divergência entre banco SQLite local e JSONs publicados.
- Perda de histórico em `historico_alteracoes`.
- Republicação desnecessária com churn de `publicadoEm`.
- Alteração acidental de valores orçamentários.
- Alteração de status sem trilha de histórico.
- Mudança em payload de rota sem atualizar frontend.
- Mudança em schema sem documentar em `schema-banco.md`.
- Versionamento indevido de `backend/data/onasp.sqlite`.
- Commit de planilha, backup, log ou anexo sensível fora do padrão do projeto.
- Uso do frontend como fonte de verdade para regra que deve ser validada no backend.

## O que deve ser documentado em rotas.md

`rotas.md` deve detalhar, para cada endpoint:

- caminho;
- método;
- payload;
- resposta;
- serviço chamado;
- validações de entrada;
- efeito colateral;
- publicação estática após salvamento;
- exportação, quando houver;
- mensagens de erro esperadas;
- comportamento no modo local/API e no modo estático, quando aplicável.

## O que deve ser documentado em schema-banco.md

`schema-banco.md` deve detalhar:

- tabelas;
- colunas;
- tipos;
- chaves primárias;
- chaves únicas;
- constraints;
- colunas adicionadas por evolução;
- tabelas de histórico;
- relação entre tabelas e serviços;
- riscos de migração;
- comandos de validação e rollback para mudanças estruturais.

## O que não está confirmado

- Payloads completos e exemplos de resposta de todas as rotas.
- Schema completo com tipos, constraints e evolução histórica de cada coluna.
- Relação completa entre cada filtro visual do frontend e sua origem de dados.
- Existência de fluxo publicado específico para contatos além da leitura aparente da planilha.
- Política completa de versionamento das planilhas reais; para cada tarefa de dados, conferir `.gitignore` e o escopo do pedido.
- Detalhe de todos os campos sanitizados na publicação; este documento registra apenas a sanitização confirmada em alto nível.

## Critérios para atualizar este arquivo

Atualizar este arquivo quando houver:

- nova origem de dados;
- nova rotina de importação;
- nova rota estrutural;
- nova tabela ou mudança relevante de schema;
- alteração no serviço de publicação;
- novo JSON publicado;
- alteração relevante no modo local/API;
- alteração relevante no modo estático/GitHub Pages;
- mudança no fluxo de salvamento;
- mudança no histórico;
- nova exportação;
- mudança em automação de validação ou hook que afete dados publicados.
