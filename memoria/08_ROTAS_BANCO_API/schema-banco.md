# Schema do Banco Local — FOMENTO-ONASP

## Finalidade

Este arquivo documenta o schema real do banco SQLite local do FOMENTO-ONASP, com base nos arquivos existentes no repositório.

O objetivo é apoiar manutenção, revisão técnica, uso de Codex/IA, validação de migrations futuras e prevenção de perda de dados. Este documento não propõe migration nova e não substitui a leitura de `backend/db/init-db.js`, que é a fonte de verdade do schema.

## Visão geral

O projeto usa banco SQLite local para os fluxos editáveis do modo local/API.

Pontos confirmados:

- o arquivo de banco é `backend/data/onasp.sqlite`;
- o banco é aberto por `backend/db/database.js`;
- a dependência usada é `better-sqlite3`;
- a criação e evolução do schema ficam em `backend/db/init-db.js`;
- o preparo operacional do banco fica em `backend/db/preparar-banco.js`;
- serviços em `backend/services/` leem e gravam nas tabelas;
- rotas em `backend/server.js` acionam os serviços;
- o modo estático/GitHub Pages não usa o banco local, mas sim JSONs publicados em `frontend/data/publicados/`.

O arquivo SQLite, WAL, SHM e backups são artefatos locais e não devem ser versionados.

## Arquivos responsáveis pelo banco

- `backend/db/database.js`: cria o diretório `backend/data`, abre `backend/data/onasp.sqlite`, aplica PRAGMAs e exporta a instância do banco e `dbPath`.
- `backend/db/init-db.js`: cria as tabelas confirmadas, adiciona colunas por evolução incremental e cria a tabela de movimentações do Orçamento 2026.
- `backend/db/preparar-banco.js`: executa `inicializarBanco()`, importa Parâmetros Mínimos quando a tabela está vazia, atualiza respostas originais, inicializa Formalização PROFOR e inicializa Orçamento 2026.
- `backend/services/parametros-minimos-service.js`: lê e grava `parametros_minimos`; lê e grava histórico em `historico_alteracoes`.
- `backend/services/formalizacao-profor-service.js`: inicializa, lê e grava `formalizacao_profor`; grava histórico em `historico_alteracoes`.
- `backend/services/orcamento-2026-service.js`: inicializa, lê e grava `orcamento_2026`; lê e grava `orcamento_2026_movimentacoes`; grava histórico em `historico_alteracoes`.
- `backend/services/historico-service.js`: insere registros em `historico_alteracoes`.
- `backend/services/excel-export-service.js`: lê dados por serviços para exportar Excel.
- `backend/services/static-publication-service.js`: lê dados por serviços para gerar JSONs publicados.
- `backend/scripts/importar-parametros-minimos.js`: importa e atualiza dados de `parametros_minimos`.
- `backend/scripts/publicar-dados-estaticos.js`: chama `prepararBanco()` antes de publicar JSONs estáticos.
- `backend/server.js`: chama `prepararBanco()` ao iniciar o servidor local e expõe rotas que acionam os serviços.

## Convenções deste documento

- **Tipo declarado:** tipo exatamente conforme aparece no SQL de criação ou em `garantirColuna`.
- **Origem:** criação inicial por `CREATE TABLE` ou evolução incremental por `garantirColuna`.
- **Constraint confirmada:** constraint explícita no SQL do código.
- **Relação operacional:** relação observada em serviços e rotas, sem afirmar foreign key quando ela não aparece no SQL.
- **Não confirmado:** item não evidenciado nos arquivos lidos.

## Banco local

**Caminho confirmado:** `backend/data/onasp.sqlite`.

**Dependência:** `better-sqlite3`.

**PRAGMAs confirmados:**

- `journal_mode = WAL`;
- `foreign_keys = ON`.

**Versionamento:** `.gitignore` ignora `backend/data/onasp.sqlite`, `backend/data/onasp.sqlite-*`, `*.sqlite`, `*.sqlite3`, `*.db`, `*.sqlite-shm`, `*.sqlite-wal` e `backend/data/backups/`.

**Backup:** serviços de escrita chamam `criarBackupBanco(pagina)`, que copia o SQLite para `backend/data/backups/<pagina>/onasp-<timestamp>.sqlite`.

**Observação:** esta tarefa não abriu nem alterou o arquivo SQLite.

## Tabelas confirmadas

### parametros_minimos

**Finalidade aparente:** persistir status, quantidades e resposta original dos Parâmetros Mínimos por UF e parâmetro.

**Arquivo de criação/evolução:** `backend/db/init-db.js`.

**Serviços relacionados:** `backend/services/parametros-minimos-service.js`, `backend/scripts/importar-parametros-minimos.js`, `backend/services/historico-service.js`, `backend/services/excel-export-service.js`, `backend/services/static-publication-service.js`.

**Rotas relacionadas:** `GET /api/parametros-minimos`, `POST /api/parametros-minimos/salvar`, `GET /api/parametros-minimos/historico`, `POST /api/parametros-minimos/historico/reverter`, `GET /api/parametros-minimos/exportar`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `uf TEXT NOT NULL`, `parametro TEXT NOT NULL`, `status TEXT NOT NULL`, `UNIQUE (uf, parametro)`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `uf` | `TEXT` | criação inicial | `NOT NULL`; compõe `UNIQUE (uf, parametro)`. |
| `parametro` | `TEXT` | criação inicial | `NOT NULL`; compõe `UNIQUE (uf, parametro)`. |
| `status` | `TEXT` | criação inicial | `NOT NULL`; validado pelo serviço. |
| `atualizado_em` | `TEXT` | criação inicial | atualizado em importação, salvamento e reversão. |
| `quantidade_atual` | `REAL` | `garantirColuna` | usado em parâmetros quantitativos. |
| `quantidade_ideal` | `REAL` | `garantirColuna` | usado em parâmetros quantitativos. |
| `resposta_original` | `TEXT` | `garantirColuna` | preenchido/atualizado pelo importador a partir do diagnóstico. |

**Campos adicionados por evolução incremental:** sim: `quantidade_atual`, `quantidade_ideal`, `resposta_original`.

**Riscos de alteração:** alterar `uf`, `parametro` ou `UNIQUE (uf, parametro)` pode quebrar upserts, importação, salvamento e reversão de histórico. Alterar tipos de quantidade pode afetar cálculo e exportação.

**Observações de manutenção:** a reversão usa `historico_alteracoes` e volta a gravar nesta tabela; não há foreign key formal confirmada entre as tabelas.

### formalizacao_profor

**Finalidade aparente:** persistir status e observação das etapas da Formalização PROFOR por UF.

**Arquivo de criação/evolução:** `backend/db/init-db.js`.

**Serviços relacionados:** `backend/services/formalizacao-profor-service.js`, `backend/services/historico-service.js`, `backend/services/excel-export-service.js`, `backend/services/static-publication-service.js`.

**Rotas relacionadas:** `GET /api/formalizacao-profor`, `POST /api/formalizacao-profor/salvar`, `GET /api/formalizacao-profor/historico`, `GET /api/formalizacao-profor/exportar`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `uf TEXT NOT NULL`, `etapa TEXT NOT NULL`, `status TEXT NOT NULL`, `UNIQUE (uf, etapa)`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `uf` | `TEXT` | criação inicial | `NOT NULL`; compõe `UNIQUE (uf, etapa)`. |
| `etapa` | `TEXT` | criação inicial | `NOT NULL`; compõe `UNIQUE (uf, etapa)`. |
| `status` | `TEXT` | criação inicial | `NOT NULL`; validado pelo serviço. |
| `observacao` | `TEXT` | criação inicial | sanitizada pelo serviço. |
| `atualizado_em` | `TEXT` | criação inicial | atualizado em inicialização e salvamento. |

**Campos adicionados por evolução incremental:** não confirmado; todas as colunas aparecem na criação inicial.

**Riscos de alteração:** mudar `UNIQUE (uf, etapa)` quebra upsert por UF/etapa; alterar `status` ou `observacao` impacta histórico, exportação e publicação.

**Observações de manutenção:** a inicialização insere registros por UF/etapa quando a tabela está vazia. Não há rota de reversão de histórico confirmada para esta tabela.

### orcamento_2026

**Finalidade aparente:** persistir processos e itens do Orçamento 2026, incluindo valores financeiros, status, classificação, vínculo entre processos, rastreio processual e controle de exibição/atividade.

**Arquivo de criação/evolução:** `backend/db/init-db.js`.

**Serviços relacionados:** `backend/services/orcamento-2026-service.js`, `backend/services/historico-service.js`, `backend/services/excel-export-service.js`, `backend/services/static-publication-service.js`.

**Rotas relacionadas:** `GET /api/orcamento-2026`, `POST /api/orcamento-2026/salvar`, `POST /api/orcamento-2026/processos-vinculados/criar`, `POST /api/orcamento-2026/saldos/alocar`, `GET /api/orcamento-2026/movimentacoes`, `GET /api/orcamento-2026/historico`, `GET /api/orcamento-2026/exportar`.

**Chave primária:** `id TEXT PRIMARY KEY`.

**Constraints confirmadas:** `id TEXT PRIMARY KEY`. Não há `NOT NULL` explícito nas demais colunas da criação desta tabela.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `TEXT` | criação inicial | `PRIMARY KEY`; usado como identificador de processo/item. |
| `categoria` | `TEXT` | criação inicial | usado em filtros, agrupamentos e validação de alocação por categoria. |
| `descricao` | `TEXT` | criação inicial | descrição do processo/item. |
| `acao_orcamentaria` | `TEXT` | criação inicial | campo orçamentário. |
| `plano_orcamentario` | `TEXT` | criação inicial | campo orçamentário. |
| `natureza` | `TEXT` | criação inicial | campo orçamentário. |
| `valor_previsto` | `REAL DEFAULT 0` | criação inicial | valor original/envelope persistido. |
| `valor_disponibilizado` | `REAL DEFAULT 0` | criação inicial | campo financeiro. |
| `valor_empenhado` | `REAL DEFAULT 0` | criação inicial; protegido por `garantirColuna` | campo financeiro usado no saldo. |
| `valor_executado` | `REAL DEFAULT 0` | criação inicial | campo financeiro usado no saldo. |
| `status` | `TEXT` | criação inicial | validado pelo serviço. |
| `observacao` | `TEXT` | criação inicial | campo operacional. |
| `classificacao_gerencial` | `TEXT DEFAULT 'NAO_APARELHAMENTO'` | criação inicial; protegido por `garantirColuna` | classifica item como aparelhamento ou não aparelhamento. |
| `atualizado_em` | `TEXT` | criação inicial | atualizado em inserts, updates e inativações. |
| `processo_pai_id` | `TEXT` | `garantirColuna` | relação operacional com processo pai; sem foreign key confirmada. |
| `tipo_processo` | `TEXT DEFAULT 'PRINCIPAL'` | `garantirColuna` | usado para distinguir `PRINCIPAL` e `VINCULADO`. |
| `origem_recurso_id` | `TEXT` | `garantirColuna` | origem operacional do recurso; sem foreign key confirmada. |
| `ordem_exibicao` | `INTEGER` | `garantirColuna` | ordenação de filhos vinculados. |
| `valor_alocado_origem` | `REAL DEFAULT 0` | `garantirColuna` | valor alocado a processo vinculado. |
| `valor_estimado_pesquisa_preco` | `REAL DEFAULT 0` | `garantirColuna` | valor financeiro usado em edição/exportação. |
| `processo_autuado` | `INTEGER DEFAULT 0` | `garantirColuna` | flag numérica de autuação. |
| `processo_sei` | `TEXT` | `garantirColuna` | número/identificador SEI. |
| `compoe_orcamento` | `INTEGER DEFAULT 1` | `garantirColuna` | filhos vinculados e outros processos podem ter `0`. |
| `ativo` | `INTEGER DEFAULT 1` | `garantirColuna` | usado para inativação lógica. |
| `tipo_rastreio` | `TEXT` | `garantirColuna` | tipo de rastreio processual. |
| `abrangencia` | `TEXT` | `garantirColuna` | campo de rastreio. |
| `quantidade` | `TEXT` | `garantirColuna` | campo de rastreio. |
| `unidade` | `TEXT` | `garantirColuna` | campo de rastreio. |
| `valor_unitario` | `REAL DEFAULT 0` | `garantirColuna` | campo de rastreio/valor unitário. |
| `link_processo_sei` | `TEXT` | `garantirColuna` | link de rastreio SEI. |
| `data_processo_sei` | `TEXT` | `garantirColuna` | data de rastreio SEI. |
| `demanda_formalizada` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_demanda_formalizada` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_demanda_formalizada` | `TEXT` | `garantirColuna` | data da etapa. |
| `estudo_tecnico` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_estudo_tecnico` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_estudo_tecnico` | `TEXT` | `garantirColuna` | data da etapa. |
| `termo_referencia` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_termo_referencia` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_termo_referencia` | `TEXT` | `garantirColuna` | data da etapa. |
| `pesquisa_precos` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_pesquisa_precos` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_pesquisa_precos` | `TEXT` | `garantirColuna` | data da etapa. |
| `autorizacao_autoridade` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_autorizacao_autoridade` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_autorizacao_autoridade` | `TEXT` | `garantirColuna` | data da etapa. |
| `parecer_juridico` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_parecer_juridico` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_parecer_juridico` | `TEXT` | `garantirColuna` | data da etapa. |
| `empenho` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_empenho` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_empenho` | `TEXT` | `garantirColuna` | data da etapa. |
| `contrato` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_contrato` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_contratacao` | `TEXT` | `garantirColuna` | data da etapa. |
| `ordem_servico` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_ordem_servico` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_ordem_servico` | `TEXT` | `garantirColuna` | data da etapa. |
| `data_entrega` | `TEXT` | `garantirColuna` | data de entrega. |
| `ordem_bancaria` | `TEXT` | `garantirColuna` | etapa de rastreio. |
| `link_ordem_bancaria` | `TEXT` | `garantirColuna` | link da etapa. |
| `data_ordem_bancaria` | `TEXT` | `garantirColuna` | data da etapa. |
| `profor_autuacao` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_autuacao` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_autuacao` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |
| `profor_parecer_tecnico` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_parecer_tecnico` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_parecer_tecnico` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |
| `profor_minuta_edital` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_minuta_edital` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_minuta_edital` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |
| `profor_ddo_cgof` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_ddo_cgof` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_ddo_cgof` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |
| `profor_abertura_programa` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_abertura_programa` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_abertura_programa` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |
| `profor_parecer_conjur` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_parecer_conjur` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_parecer_conjur` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |
| `profor_publicacao_gabsec` | `TEXT` | `garantirColuna` | etapa PROFOR. |
| `link_profor_publicacao_gabsec` | `TEXT` | `garantirColuna` | link da etapa PROFOR. |
| `data_profor_publicacao_gabsec` | `TEXT` | `garantirColuna` | data da etapa PROFOR. |

**Campos adicionados por evolução incremental:** sim. Inclui campos de vínculo processual, classificação, flags, valor estimado, autuação, SEI e rastreio processual/PROFOR.

**Riscos de alteração:** remover ou renomear coluna quebra `COLUNAS_ORCAMENTO`, inserts dinâmicos, backfill, edição, exportação e publicação. Alterar tipos financeiros pode gerar cálculo incorreto de saldo. Alterar `id` quebra histórico, vínculos operacionais e movimentações.

**Observações de manutenção:** `processo_pai_id`, `origem_recurso_id`, `origem_id` e `destino_id` são relações operacionais no serviço; não há foreign key explícita confirmada no SQL.

### orcamento_2026_movimentacoes

**Finalidade aparente:** registrar movimentações de saldo do Orçamento 2026 sem sobrescrever o valor original dos processos.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelaMovimentacoesOrcamento2026()`.

**Serviços relacionados:** `backend/services/orcamento-2026-service.js`, `backend/services/historico-service.js`.

**Rotas relacionadas:** `POST /api/orcamento-2026/saldos/alocar`, `GET /api/orcamento-2026/movimentacoes`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `tipo TEXT NOT NULL`, `valor REAL NOT NULL DEFAULT 0`, `criado_em TEXT NOT NULL`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial da tabela | `PRIMARY KEY AUTOINCREMENT`. |
| `tipo` | `TEXT` | criação inicial da tabela | `NOT NULL`; alocação grava `ALOCACAO_SALDO`. |
| `origem_id` | `TEXT` | criação inicial da tabela | relação operacional com `orcamento_2026.id`; sem foreign key confirmada. |
| `destino_id` | `TEXT` | criação inicial da tabela | relação operacional com `orcamento_2026.id`; sem foreign key confirmada. |
| `valor` | `REAL DEFAULT 0` | criação inicial da tabela | `NOT NULL`; valor alocado. |
| `justificativa` | `TEXT` | criação inicial da tabela | exigida pelo serviço para rastreabilidade da alocação. |
| `criado_em` | `TEXT` | criação inicial da tabela | `NOT NULL`; timestamp da movimentação. |
| `criado_por` | `TEXT` | criação inicial da tabela | campo opcional. |
| `ativo` | `INTEGER DEFAULT 1` | criação inicial da tabela | usado para listar movimentações ativas. |

**Campos adicionados por evolução incremental:** não confirmado; a tabela é criada completa por `CREATE TABLE IF NOT EXISTS`.

**Riscos de alteração:** alterar `origem_id`, `destino_id`, `valor` ou `ativo` quebra cálculo de saldo transferível, consolidação visual e histórico de alocações.

**Observações de manutenção:** esta tabela não tem foreign keys explícitas no SQL; as validações de origem, destino, categoria e saldo ficam no serviço.

### historico_alteracoes

**Finalidade aparente:** registrar alterações realizadas em páginas editáveis, preservando rastreabilidade para consulta e, no caso de Parâmetros Mínimos, reversão.

**Arquivo de criação/evolução:** `backend/db/init-db.js`.

**Serviços relacionados:** `backend/services/historico-service.js`, `backend/services/parametros-minimos-service.js`, `backend/services/formalizacao-profor-service.js`, `backend/services/orcamento-2026-service.js`.

**Rotas relacionadas:** `GET /api/parametros-minimos/historico`, `POST /api/parametros-minimos/historico/reverter`, `GET /api/formalizacao-profor/historico`, `GET /api/orcamento-2026/historico`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `pagina TEXT NOT NULL`, `registro TEXT NOT NULL`, `campo TEXT NOT NULL`, `alterado_em TEXT NOT NULL`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `pagina` | `TEXT` | criação inicial | `NOT NULL`; identifica área funcional. |
| `registro` | `TEXT` | criação inicial | `NOT NULL`; identifica UF, processo ou registro. |
| `campo` | `TEXT` | criação inicial | `NOT NULL`; campo alterado. |
| `valor_anterior` | `TEXT` | criação inicial | valor serializado como texto pelo serviço. |
| `valor_novo` | `TEXT` | criação inicial | valor serializado como texto pelo serviço. |
| `alterado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp da alteração. |

**Campos adicionados por evolução incremental:** não confirmado; todas as colunas aparecem na criação inicial.

**Riscos de alteração:** alterar campos de histórico quebra consulta de histórico, reversão de Parâmetros Mínimos e rastreabilidade de alterações.

**Observações de manutenção:** `registrarHistorico` não insere registro quando `valorAnterior` e `valorNovo` são iguais. Não há foreign key formal para registros das tabelas de origem.

## Evolução incremental de schema

`backend/db/init-db.js` usa `garantirColuna(tabela, coluna, definicao)` para evolução incremental.

Funcionamento confirmado:

1. consulta `PRAGMA table_info(<tabela>)`;
2. verifica se a coluna já existe;
3. se não existir, executa `ALTER TABLE <tabela> ADD COLUMN <coluna> <definicao>`.

Tabelas com evolução incremental confirmada:

- `parametros_minimos`: `quantidade_atual`, `quantidade_ideal`, `resposta_original`.
- `orcamento_2026`: campos de vínculo, classificação, autuação, valor estimado, flags e rastreio.

Riscos:

- `garantirColuna` não remove, renomeia ou altera tipo de coluna existente.
- não há tabela de versionamento de migrations confirmada.
- remover ou renomear coluna exige migration própria, backup e validação completa.
- colunas adicionadas com `DEFAULT` afetam registros antigos conforme regras do SQLite.

## Relação entre tabelas, serviços e rotas

| Tabela | Serviço principal | Rotas que impactam | Publicação estática relacionada |
|---|---|---|---|
| `parametros_minimos` | `parametros-minimos-service.js` | `POST /api/parametros-minimos/salvar`, `POST /api/parametros-minimos/historico/reverter` | `parametros-minimos.json` via `publicarDadosEstaticos()`. |
| `formalizacao_profor` | `formalizacao-profor-service.js` | `POST /api/formalizacao-profor/salvar` | `formalizacao-profor.json` via `publicarDadosEstaticos()`. |
| `orcamento_2026` | `orcamento-2026-service.js` | `POST /api/orcamento-2026/salvar`, `POST /api/orcamento-2026/processos-vinculados/criar` | `orcamento-2026.json` via `publicarDadosEstaticos()`. |
| `orcamento_2026_movimentacoes` | `orcamento-2026-service.js` | `POST /api/orcamento-2026/saldos/alocar` | não há publicação estática específica confirmada para movimentações no estado atual. |
| `historico_alteracoes` | `historico-service.js` | escritas de Parâmetros Mínimos, Formalização PROFOR e Orçamento 2026; reversão de Parâmetros Mínimos | não há JSON público específico de histórico confirmado. |

Relações operacionais confirmadas:

- `parametros_minimos` se relaciona com `historico_alteracoes` por `pagina`, `registro` e `campo`, sem foreign key.
- `formalizacao_profor` se relaciona com `historico_alteracoes` por `pagina`, `registro` e `campo`, sem foreign key.
- `orcamento_2026` se relaciona com `historico_alteracoes` por `pagina`, `registro` e `campo`, sem foreign key.
- `orcamento_2026_movimentacoes.origem_id` e `destino_id` apontam operacionalmente para `orcamento_2026.id`, sem foreign key.
- `orcamento_2026.processo_pai_id` e `origem_recurso_id` apontam operacionalmente para `orcamento_2026.id`, sem foreign key.

## Dados fora do SQLite

Dados confirmados fora do SQLite:

- `backend/data/aplicacao.json`: fonte local para catálogo/base da aplicação e persistência do fluxo FAF 2021.
- FAF 2021: `backend/services/faf-2021-service.js` grava `valorExecutado`, `observacaoExecucao` e `atualizadoEm` diretamente em `backend/data/aplicacao.json`.
- `Planilhas/`: fontes locais de importação, inicialização e leitura, incluindo Parâmetros Mínimos, Diagnóstico, Formalização PROFOR e Orçamento 2026.
- `frontend/data/publicados/*.json`: JSONs derivados para modo estático/GitHub Pages.
- `backend/data/backups/`: cópias locais do SQLite criadas antes de alterações, ignoradas pelo Git.

Esses dados não devem ser confundidos com tabelas do SQLite.

## Cuidados com versionamento

- Não versionar `backend/data/onasp.sqlite`.
- Não versionar WAL/SHM: `*.sqlite-wal`, `*.sqlite-shm` e `backend/data/onasp.sqlite-*`.
- Não versionar backups em `backend/data/backups/`.
- Não copiar banco, dumps, planilhas brutas ou anexos para `memoria/`.
- Registrar schema em Markdown tratado, sem dados reais sensíveis.
- Conferir `git status --short` antes de commit para garantir que nenhum SQLite, backup, planilha ou JSON publicado indevido entrou no diff.

## Riscos ao alterar schema

- Perda de dados por migration destrutiva.
- Corrupção do banco local.
- Divergência entre serviço e tabela.
- Quebra de `COLUNAS_ORCAMENTO` por remoção/renomeação de coluna.
- Quebra de upserts por alteração de constraints únicas.
- Quebra de exportação Excel por campo ausente.
- Quebra de publicação estática por alteração em campos lidos pelos serviços.
- Quebra do frontend por campo ausente ou mudança de nome na API.
- Histórico inconsistente ou impossível de reverter.
- Alteração de tipo financeiro com impacto em saldo, execução, empenho e orçamento.
- Uso indevido de relação operacional como se fosse foreign key formal.

## Validações recomendadas para mudanças futuras

Não executadas nesta tarefa documental, mas recomendadas para mudança real de banco:

- criar backup do SQLite antes de migration;
- revisar `git status --short` antes e depois para confirmar que o banco não entrou no diff;
- executar `npm run init-db`;
- executar `npm start`;
- testar rotas afetadas por leitura e escrita controlada;
- testar exportações Excel afetadas;
- executar `npm run validar:json` se a publicação for impactada;
- executar `npm run publicar:dados` somente quando a etapa exigir atualização controlada de JSONs publicados;
- conferir `frontend/data/publicados/` quando houver publicação;
- validar rollback por backup do banco e por `git revert` quando houver alteração de código versionado.

## O que não está confirmado

- Integridade dos dados reais dentro de `backend/data/onasp.sqlite`, pois o banco não foi aberto nesta tarefa.
- Foreign keys formais entre tabelas; `foreign_keys = ON` está ativo, mas o SQL de criação não declara foreign keys nas tabelas documentadas.
- Índices além dos índices implícitos de `PRIMARY KEY` e `UNIQUE` confirmados no SQL.
- Triggers, views ou tabelas auxiliares criadas fora de `backend/db/init-db.js`.
- Histórico completo de migrations anteriores além do estado atual codificado em `init-db.js`.
- Política de retenção de backups em `backend/data/backups/`.

## Critérios para atualizar este arquivo

Atualizar este arquivo quando houver:

- nova tabela;
- nova coluna;
- nova constraint;
- alteração de tipo;
- nova regra de histórico;
- nova movimentação orçamentária;
- alteração de serviço que usa banco;
- alteração de rota que grava dados;
- alteração de exportação dependente de tabela;
- alteração no fluxo de inicialização do banco;
- mudança em `backend/db/database.js`, `backend/db/init-db.js` ou `backend/db/preparar-banco.js`.
