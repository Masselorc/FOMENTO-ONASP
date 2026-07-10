# Schema de banco — FOMENTO-ONASP

## Finalidade

Este arquivo diferencia o banco operacional Postgres/Supabase do artefato SQLite local legado e preserva a descrição histórica do schema anterior.

O objetivo é apoiar manutenção, revisão técnica e validação de migrations sem induzir o operador a usar o SQLite como banco atual. Para o estado operacional, as fontes de verdade são `supabase/migrations/`, `backend/db/postgres-client.js`, `backend/db/preparar-banco.js` e o SQL dos serviços. `backend/db/init-db.js` permanece como referência do schema SQLite legado, não como inicializador do banco usado no boot atual.

## Visão geral

O backend local/API atual depende de Postgres/Supabase por `DATABASE_URL`. O boot é Postgres-only e não possui fallback para SQLite.

Pontos confirmados:

- o pool operacional é criado por `backend/db/postgres-client.js` a partir de `DATABASE_URL`;
- `backend/db/preparar-banco.js` valida a conexão/tabela mínima e executa apenas backfills Postgres idempotentes;
- serviços ativos em `backend/services/` leem e gravam no Postgres/Supabase;
- o schema Postgres versionado fica em `supabase/migrations/`;
- `backend/data/onasp.sqlite` ainda pode existir localmente como artefato legado, aberto por `backend/db/database.js` em scripts antigos e controlados;
- `better-sqlite3` e `backend/db/init-db.js` permanecem para compatibilidade/histórico de fluxos legados, não para o boot operacional atual;
- rotas em `backend/server.js` acionam os serviços;
- o modo estático/GitHub Pages não consulta o banco em tempo real; usa JSONs publicados em `frontend/data/publicados/`.

O arquivo SQLite, WAL, SHM e backups continuam sendo artefatos locais não versionáveis. Menções a eles nas seções históricas abaixo não autorizam seu uso como fonte operacional atual.

## Arquivos responsáveis pelo banco

- `backend/db/postgres-client.js`: cria o pool Postgres e fornece `query`/transações aos serviços ativos.
- `backend/db/preparar-banco.js`: exige `DATABASE_URL`, valida a disponibilidade do Postgres e não toca o SQLite.
- `supabase/migrations/`: registra a evolução versionada do schema Postgres/Supabase.
- `backend/db/database.js`: abre `backend/data/onasp.sqlite` somente para compatibilidade com scripts legados ainda existentes.
- `backend/db/init-db.js`: descreve/cria o schema SQLite legado; não é chamado pelo preparo operacional atual.
- `backend/services/parametros-minimos-service.js`, `formalizacao-profor-service.js`, `orcamento-2026-service.js` e `historico-service.js`: usam Postgres/Supabase.
- `backend/services/excel-export-service.js`: lê dados por serviços para exportar Excel.
- `backend/services/static-publication-service.js`: lê dados por serviços para gerar JSONs publicados.
- `backend/scripts/importar-parametros-minimos.js`: mantém um caminho SQLite legado explicitamente bloqueado por guard; não representa o fluxo operacional Postgres.
- `backend/scripts/publicar-dados-estaticos.js`: chama o preparo Postgres antes da publicação.
- `backend/server.js`: chama o preparo Postgres ao iniciar e expõe rotas que acionam os serviços.

## Convenções deste documento

- **Tipo declarado:** tipo exatamente conforme aparece no SQL de criação ou em `garantirColuna`.
- **Origem:** criação inicial por `CREATE TABLE` ou evolução incremental por `garantirColuna`.
- **Constraint confirmada:** constraint explícita no SQL do código.
- **Relação operacional:** relação observada em serviços e rotas, sem afirmar foreign key quando ela não aparece no SQL.
- **Estado operacional:** comportamento confirmado no Postgres/Supabase pelos serviços e migrations atuais.
- **Legado SQLite:** estrutura histórica/local que não participa do boot atual, salvo scripts explicitamente identificados e protegidos.
- **Não confirmado:** item não evidenciado nos arquivos lidos.

## Estratégia Supabase/Postgres e RLS

O acesso operacional ao Postgres/Supabase ocorre preferencialmente pelo backend,
por conexão direta configurada em `DATABASE_URL`. O frontend público não deve
consultar diretamente tabelas sensíveis por Supabase Client, PostgREST ou outra
interface da Data API.

Para tabelas expostas, RLS habilitado sem policy representa bloqueio por padrão
para os papéis `anon` e `authenticated`, não uma autorização nem um erro
funcional quando o fluxo previsto é backend-only. Essa situação deve permanecer
registrada como decisão de arquitetura e ser reavaliada se o modelo de acesso
mudar.

A função `public.rls_auto_enable()` mantém o auto-RLS das novas tabelas, mas,
por ser `SECURITY DEFINER`, não deve ser executável por `PUBLIC`, `anon` ou
`authenticated`. A migration
`supabase/migrations/20260710142445_revoke_rls_auto_enable_execute.sql` revoga
esses privilégios sem remover a função, desabilitar RLS ou alterar dados.

Qualquer acesso futuro de leitura ou escrita pelo frontend via Supabase Client
deve receber grants e policies explícitas, mínimas e revisadas para o caso de
uso. Não criar policy genérica do tipo `allow all`.

## SQLite legado/local — não operacional no boot atual

**Caminho legado confirmado:** `backend/data/onasp.sqlite`.

**Dependência legada:** `better-sqlite3`.

**PRAGMAs confirmados:**

- `journal_mode = WAL`;
- `foreign_keys = ON`.

**Versionamento:** `.gitignore` ignora `backend/data/onasp.sqlite`, `backend/data/onasp.sqlite-*`, `*.sqlite`, `*.sqlite3`, `*.db`, `*.sqlite-shm`, `*.sqlite-wal` e `backend/data/backups/`.

**Backup histórico:** os fluxos SQLite anteriores criavam cópias em `backend/data/backups/<pagina>/onasp-<timestamp>.sqlite`. Os serviços operacionais Postgres atuais não usam esse mecanismo como backup do banco remoto.

**Observação:** esta revisão não abriu nem alterou o SQLite. Scripts que ainda importam `backend/db/database.js` devem ser tratados como legados e executados somente sob seus guards específicos.

## Tabelas documentadas no legado SQLite

As seções de colunas e tipos abaixo preservam a fotografia do schema SQLite anterior. Nomes e relações continuam úteis para rastreabilidade, mas os tipos/constraints operacionais devem ser confirmados nas migrations e no SQL Postgres dos serviços antes de qualquer alteração.

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

### profor_convenios_monitorados

**Finalidade aparente:** armazenar a carteira de convênios PROFOR 2022 acompanhados pela aplicação. Esta tabela é a fonte local da lista de convênios monitorados. O DETRU e o Transferegov público serão usados em etapas futuras apenas para atualizar e enriquecer dados desses convênios — não para definir quais convênios são acompanhados.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelaConveniosMonitoradosProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/convenios-monitorados-service.js` — criado na Etapa 4. Exporta `listarConveniosMonitorados`, `obterConvenioMonitoradoPorId`, `obterConvenioMonitoradoPorNumero`, `criarConvenioMonitorado`, `atualizarConvenioMonitorado` e `inativarConvenioMonitorado`.

**Rotas relacionadas:** nenhuma rota criada nesta etapa. Rotas futuras previstas em `backend/server.js` (não existem ainda).

**Uso futuro:** a tabela alimentará a página PROFOR 2022, substituindo a leitura atual da aba `Geral` da planilha. A ativação deve ocorrer por etapas com fallback para a origem atual.

**Dados populados nesta etapa:** nenhum. A tabela foi criada vazia.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `numero_convenio TEXT NOT NULL`, `UNIQUE (numero_convenio, ano)`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `numero_convenio` | `TEXT` | criação inicial | `NOT NULL`; chave operacional principal; compõe `UNIQUE (numero_convenio, ano)`. |
| `ano` | `TEXT` | criação inicial | compõe `UNIQUE (numero_convenio, ano)`; pode ser nulo quando não informado. |
| `uf` | `TEXT` | criação inicial | UF do convenente; não obrigatório no schema, mas esperado para filtros futuros. |
| `instrumento` | `TEXT DEFAULT 'Convênio'` | criação inicial | tipo de instrumento; default `'Convênio'`. |
| `programa_origem` | `TEXT DEFAULT 'PROFOR 2022'` | criação inicial | origem do programa; default `'PROFOR 2022'`. |
| `ativo` | `INTEGER DEFAULT 1` | criação inicial | inativação lógica; `1` ativo, `0` inativo. Convênios removidos do acompanhamento devem ser inativados, não excluídos. |
| `id_convenio_transferegov` | `TEXT` | criação inicial | identificador futuro para consulta no Transferegov público. |
| `observacao` | `TEXT` | criação inicial | campo livre de observação operacional. |
| `criado_em` | `TEXT` | criação inicial | timestamp de inserção do registro. |
| `atualizado_em` | `TEXT` | criação inicial | timestamp da última atualização. |

**Campos adicionados por evolução incremental:** não há; a tabela é criada completa por `CREATE TABLE IF NOT EXISTS`.

**Riscos de alteração:** alterar `UNIQUE (numero_convenio, ano)` quebra a restrição de unicidade e pode permitir duplicidade na carteira. Remover `numero_convenio NOT NULL` invalida a chave operacional. Alterar `ativo` pode interferir em inativações lógicas futuras. Antes de qualquer migration destrutiva, criar backup do banco.

**Observações de manutenção:** a exclusão física de registros não é recomendada; usar `ativo = 0` para remover convênio do acompanhamento. O número do convênio é a chave de cruzamento com DETRU e Transferegov; deve ser tratado como string numérica.

### profor_detru_cache

**Finalidade aparente:** armazenar o snapshot filtrado dos convênios monitorados encontrados no arquivo DETRU (`siconv_convenio.csv.zip`). Apenas os convênios da carteira ativa são gravados — não o CSV completo. O cache anterior não é apagado em falha; apenas convênios encontrados são atualizados via upsert.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelaDetruCacheProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-detru-cache-service.js` — exporta `salvarSnapshotDetru`, `listarCacheDetruProfor2022`, `obterCacheDetruPorConvenio`. Script de atualização: `backend/scripts/atualizar-cache-detru-profor-2022.js` (`npm run atualizar:detru-profor`).

**Rotas relacionadas:** nenhuma rota pública criada nesta etapa.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `numero_convenio TEXT NOT NULL`, `consultado_em TEXT NOT NULL`, `atualizado_em TEXT NOT NULL`, `UNIQUE(numero_convenio, ano)`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `numero_convenio` | `TEXT` | criação inicial | `NOT NULL`; compõe `UNIQUE(numero_convenio, ano)`. |
| `ano` | `TEXT` | criação inicial | compõe `UNIQUE(numero_convenio, ano)`; pode ser nulo — SQLite trata NULLs como distintos em constraints únicas. |
| `payload_json` | `TEXT` | criação inicial | `NOT NULL`; objeto mapeado por `detru-convenio-mapper.js` serializado como JSON. |
| `fonte` | `TEXT DEFAULT 'DETRU/siconv_convenio.csv.zip'` | criação inicial | identifica a origem do dado. |
| `arquivo_origem` | `TEXT` | criação inicial | caminho local do arquivo ZIP usado na atualização. |
| `arquivo_hash` | `TEXT` | criação inicial | SHA-256 do arquivo ZIP calculado em `calcularHashArquivo`. |
| `consultado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp ISO do cruzamento que gerou o dado. |
| `atualizado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp da última gravação do registro. |

**Campos adicionados por evolução incremental:** não há; a tabela é criada completa por `CREATE TABLE IF NOT EXISTS`.

**Riscos de alteração:** alterar `UNIQUE(numero_convenio, ano)` quebra o upsert. Alterar `payload_json` sem atualizar o mapeador pode causar campos ausentes na leitura. Remover `numero_convenio NOT NULL` invalida a chave operacional.

**Observações de manutenção:** a exclusão física não é usada; se um convênio deixar de estar na carteira, ele permanece no cache até a próxima atualização que o inclua. Convênios não encontrados no DETRU não têm registro no cache — apenas no log de auditoria da tabela `profor_detru_atualizacoes`.

### profor_detru_atualizacoes

**Finalidade aparente:** registrar o histórico de execuções da rotina de atualização do cache DETRU. Cada execução grava um registro com início, fim, resultado e resumo. Preserva rastreabilidade para diagnóstico e auditoria.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelaDetruAtualizacoesProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-detru-cache-service.js` — exporta `registrarAtualizacaoDetruInicio`, `registrarAtualizacaoDetruFim`, `registrarAtualizacaoDetruErro`, `obterUltimaAtualizacaoDetru`. Script de atualização: `backend/scripts/atualizar-cache-detru-profor-2022.js`.

**Rotas relacionadas:** nenhuma rota pública criada nesta etapa.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `iniciado_em TEXT NOT NULL`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `iniciado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp ISO de início da execução. |
| `concluido_em` | `TEXT` | criação inicial | timestamp ISO de fim; nulo se ainda em andamento ou se houve erro antes do fim. |
| `sucesso` | `INTEGER DEFAULT 0` | criação inicial | `1` quando a execução concluiu com sucesso; `0` caso contrário. |
| `caminho_arquivo` | `TEXT` | criação inicial | caminho local do arquivo ZIP usado. |
| `arquivo_hash` | `TEXT` | criação inicial | SHA-256 do arquivo ZIP. |
| `total_carteira_ativa` | `INTEGER DEFAULT 0` | criação inicial | número de convênios ativos na carteira no momento da execução. |
| `total_linhas_detru_lidas` | `INTEGER DEFAULT 0` | criação inicial | número de linhas lidas do CSV DETRU. |
| `total_encontrados` | `INTEGER DEFAULT 0` | criação inicial | número de convênios da carteira encontrados no DETRU. |
| `total_nao_encontrados` | `INTEGER DEFAULT 0` | criação inicial | número de convênios da carteira não encontrados no DETRU. |
| `erro` | `TEXT` | criação inicial | mensagem de erro quando `sucesso = 0`. |
| `resumo_json` | `TEXT` | criação inicial | objeto completo retornado por `cruzarCarteiraComDetru` serializado como JSON. |

**Campos adicionados por evolução incremental:** não há; a tabela é criada completa por `CREATE TABLE IF NOT EXISTS`.

**Riscos de alteração:** esta tabela é de auditoria — alterações destrutivas apagam rastreabilidade. Remover `iniciado_em NOT NULL` remove a âncora temporal da execução.

**Observações de manutenção:** não há política de retenção automática. Registros de execuções com falha (`sucesso = 0`) devem ser preservados para diagnóstico. Não há foreign key entre esta tabela e `profor_detru_cache`.

### profor_transferegov_rendimentos_cache

**Finalidade aparente:** armazenar o último saldo de rendimentos de aplicação capturado com sucesso no acesso público do Transferegov para cada convênio monitorado do PROFOR 2022. Falhas de consulta não apagam nem zeram o último valor válido.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelaTransferegovRendimentosCacheProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`; cliente de captura em `backend/services/profor-2022/transferegov-rendimentos-client.js`; script de atualização em `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js` (`npm run atualizar:rendimentos-profor`).

**Rotas relacionadas:** nenhuma rota criada nesta etapa.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `numero_convenio TEXT NOT NULL`, `consultado_em TEXT NOT NULL`, `atualizado_em TEXT NOT NULL`, `UNIQUE(numero_convenio, ano)`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `numero_convenio` | `TEXT` | criação inicial | `NOT NULL`; número do instrumento monitorado. |
| `ano` | `TEXT` | criação inicial | compõe `UNIQUE(numero_convenio, ano)`; pode ser nulo. |
| `saldo_rendimentos_atual` | `REAL` | criação inicial | valor numérico convertido de moeda brasileira. |
| `valor_original` | `TEXT` | criação inicial | texto original capturado, por exemplo `R$ 131.799,75`. |
| `subtitulo` | `TEXT` | criação inicial | subtítulo da página pública de rendimentos. |
| `aviso` | `TEXT` | criação inicial | aviso explicativo da página pública, quando presente. |
| `convenio_texto` | `TEXT` | criação inicial | texto do campo `#convenio`, usado para conferência do instrumento. |
| `url_final` | `TEXT` | criação inicial | URL final após redirecionamentos públicos. |
| `consultado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp ISO da consulta. |
| `atualizado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp da gravação no cache. |
| `sucesso` | `INTEGER DEFAULT 1` | criação inicial | `1` para consulta salva com sucesso. |
| `erro` | `TEXT` | criação inicial | preservado para compatibilidade, mas falhas não sobrescrevem cache válido nesta etapa. |
| `payload_json` | `TEXT` | criação inicial | resultado bruto relevante da extração, sem cookies, credenciais ou HTML completo. |

**Campos adicionados por evolução incremental:** não há; a tabela é criada completa por `CREATE TABLE IF NOT EXISTS`.

**Riscos de alteração:** alterar `UNIQUE(numero_convenio, ano)` quebra o upsert do serviço. Como em outras tabelas do módulo, `ano` pode ser nulo; no SQLite, `UNIQUE(numero_convenio, ano)` permite múltiplas linhas com o mesmo `numero_convenio` quando `ano IS NULL`. Esse risco está documentado e não foi corrigido nesta etapa para evitar refatoração ampla.

**Observações de manutenção:** salvar apenas resultados com `sucesso = true`. Consulta falha deve ser registrada no histórico de consultas e não deve apagar, zerar ou substituir o último saldo capturado com sucesso.

### profor_transferegov_rendimentos_consultas

**Finalidade aparente:** registrar execuções da rotina de atualização de saldos de rendimentos do Transferegov público para a carteira PROFOR 2022.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelaTransferegovRendimentosConsultasProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`; script `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`.

**Rotas relacionadas:** nenhuma rota criada nesta etapa.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `iniciado_em TEXT NOT NULL`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `iniciado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp ISO de início da rotina. |
| `concluido_em` | `TEXT` | criação inicial | timestamp ISO de encerramento. |
| `sucesso` | `INTEGER DEFAULT 0` | criação inicial | `1` quando a execução da rotina conclui; `0` em falha fatal. |
| `total_carteira_ativa` | `INTEGER DEFAULT 0` | criação inicial | total de convênios ativos no início da rotina. |
| `total_consultados` | `INTEGER DEFAULT 0` | criação inicial | total de convênios consultados. |
| `total_sucesso` | `INTEGER DEFAULT 0` | criação inicial | consultas salvas no cache. |
| `total_falha` | `INTEGER DEFAULT 0` | criação inicial | consultas que retornaram erro controlado. |
| `erro` | `TEXT` | criação inicial | erro fatal da rotina, quando houver. |
| `resumo_json` | `TEXT` | criação inicial | resumo da execução, incluindo falhas por convênio. |

**Campos adicionados por evolução incremental:** não há; a tabela é criada completa por `CREATE TABLE IF NOT EXISTS`.

**Riscos de alteração:** esta tabela é trilha de auditoria operacional; limpeza ou alteração destrutiva reduz capacidade de diagnóstico de instabilidade no acesso público do Transferegov.

**Observações de manutenção:** falhas por ausência de sessão pública, HTTP não 200 ou mudança de HTML devem ficar registradas no resumo da consulta sem afetar o cache válido.

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

### logs_operacionais

**Finalidade aparente:** registrar de forma aditiva eventos operacionais executivos do sistema (atualização consolidada PROFOR 2022, publicação estática, atualizações DETRU/rendimentos), para auditoria e diagnóstico via tela de Sistema em modo local/API.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, função `garantirTabelaLogsOperacionais()`. Criada com `CREATE TABLE IF NOT EXISTS`.

**Serviços relacionados:** `backend/services/logs-operacionais-service.js` (registro, listagem, detalhe, exportação JSON/CSV, sanitização). Consumida indiretamente por `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` e `backend/scripts/publicar-profor-2022-estatico.js`.

**Rotas relacionadas:** `GET /api/sistema/logs-operacionais`, `GET /api/sistema/logs-operacionais/:id`, `GET /api/sistema/logs-operacionais/export`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `modulo TEXT NOT NULL`, `tipo_evento TEXT NOT NULL`, `status TEXT NOT NULL`, `criado_em TEXT NOT NULL`.

**Colunas confirmadas:**

| Coluna | Tipo declarado | Origem | Observações |
|---|---:|---|---|
| `id` | `INTEGER` | criação inicial | `PRIMARY KEY AUTOINCREMENT`. |
| `modulo` | `TEXT` | criação inicial | `NOT NULL`; identifica área funcional (ex.: `profor-2022`). |
| `tipo_evento` | `TEXT` | criação inicial | `NOT NULL`; tipos esperados: `profor_atualizacao_consolidada`, `profor_publicacao_estatica`, `profor_detru`, `profor_rendimentos_transferegov`. |
| `status` | `TEXT` | criação inicial | `NOT NULL`; valores esperados: `sucesso`, `falha`, `bloqueado`, `parcial`. |
| `iniciado_em` | `TEXT` | criação inicial | timestamp de início do evento (opcional). |
| `concluido_em` | `TEXT` | criação inicial | timestamp de conclusão do evento. |
| `duracao_ms` | `INTEGER` | criação inicial | duração total do evento em ms. |
| `resumo` | `TEXT` | criação inicial | resumo curto sanitizado. |
| `payload_json` | `TEXT` | criação inicial | payload sanitizado em JSON; nunca contém dados sensíveis. |
| `criado_em` | `TEXT` | criação inicial | `NOT NULL`; timestamp de gravação do log. |

**Índices confirmados:** `idx_logs_operacionais_criado_em (criado_em DESC)`, `idx_logs_operacionais_tipo_evento (tipo_evento)`, `idx_logs_operacionais_status (status)`.

**Campos adicionados por evolução incremental:** não se aplica; criação inicial em 18/05/2026.

**Riscos de alteração:** alterar tipo de coluna ou remover índices pode degradar consulta na tela de Sistema. Remover sanitização no serviço expõe risco de vazamento de cookies, SAML, tokens ou caminhos locais.

**Observações de manutenção:** a tabela é estritamente aditiva (INSERT-only); não há UPDATE/DELETE no serviço. Limite padrão de consulta é 50 e máximo 200; limite padrão de exportação é 500 e máximo 2000. Toda escrita passa por `sanitizarPayloadLog`.

### profor_2022_rateio_import_lotes

**Finalidade aparente:** rastrear cada importação da memória inicial de rateio PROFOR 2022 a partir do JSON da Etapa 2, com hash, totais e status de rollback lógico.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRateioInicialProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-rateio-import-service.js`.

**Scripts relacionados:** `backend/scripts/importar-rateio-inicial-profor-2022.js`, `backend/scripts/rollback-rateio-inicial-profor-2022.js`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `arquivo_origem TEXT NOT NULL`, `arquivo_json_dry_run TEXT NOT NULL`, `status TEXT NOT NULL`, `criado_em TEXT NOT NULL`.

### profor_2022_itens_conhecidos

**Finalidade aparente:** persistir a memória operacional de itens conhecidos por `chave_item` (`numeroConvenio + descricaoNormalizada`), incluindo aptidão para uso futuro e flags impeditivas.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRateioInicialProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-rateio-import-service.js`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `UNIQUE(chave_item)`, `numero_convenio TEXT NOT NULL`, `descricao_normalizada TEXT NOT NULL`, FKs para `profor_2022_rateio_import_lotes(id)` e autorreferência em `item_substituido_id`.

**Índices confirmados:** `idx_itens_numero_convenio`, `idx_itens_numero_descricao`, `idx_itens_apto`, `idx_itens_status_item`.

### profor_2022_item_rateios

**Finalidade aparente:** persistir os rateios por área/natureza vinculados a item conhecido, preservando histórico por lote e ativo/inativo sem exclusão física.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRateioInicialProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-rateio-import-service.js`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `UNIQUE(item_conhecido_id, area, natureza, lote_importacao_id)` e FK para `profor_2022_itens_conhecidos(id)`.

**Índices confirmados:** `idx_rateios_item`, `idx_rateios_chave_item`, `idx_rateio_ativo_unico` (índice único parcial por `ativo = 1`).

### profor_2022_rateio_import_alertas

**Finalidade aparente:** registrar os alertas do JSON de importação por lote, com tipo, nível e origem (arquivo/aba/linha).

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRateioInicialProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-rateio-import-service.js`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `lote_importacao_id INTEGER NOT NULL`, `tipo TEXT NOT NULL`, `nivel TEXT NOT NULL`, FK para `profor_2022_rateio_import_lotes(id)`.

**Índices confirmados:** `idx_alertas_lote`, `idx_alertas_tipo_nivel`.

### profor_2022_revisao_lotes

**Finalidade:** rastrear cada geração da fila de revisão assistida de divergências PAD x memória (Etapa 5.3), com origem, hash e totais.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRevisaoProfor2022()`.

**Serviços relacionados:** `backend/services/profor-2022/profor-pad-revisao-repository.js`, `backend/services/profor-2022/profor-pad-revisao-service.js`.

**Scripts relacionados:** `backend/scripts/gerar-fila-revisao-pad-profor-2022.js`, `backend/scripts/auditar-fila-revisao-pad-profor-2022.js`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `origem TEXT NOT NULL`, `status TEXT NOT NULL DEFAULT 'ABERTO'`, `criado_em TEXT NOT NULL`, `atualizado_em TEXT NOT NULL`.

### profor_2022_revisao_divergencias

**Finalidade:** fila persistente das divergências PAD x memória, com payload técnico suficiente para o futuro card Antes × Depois. `status` em caixa alta (`PENDENTE`, `ACEITO`, `REJEITADO`, `EM_REVISAO`, `CORRIGIDO`, `APLICADO`, `REVERTIDO`); `nivel` em caixa baixa (`info`, `aviso`, `impeditivo`).

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRevisaoProfor2022()`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `UNIQUE(chave_divergencia)` (chave estável que evita duplicação na regeneração), `lote_revisao_id INTEGER NOT NULL`, `tipo_alerta TEXT NOT NULL`, `nivel TEXT NOT NULL`, `status TEXT NOT NULL DEFAULT 'PENDENTE'`, `payload_json TEXT NOT NULL DEFAULT '{}'`, FK para `profor_2022_revisao_lotes(id)`.

**Índices confirmados:** `idx_revisao_divergencias_status`, `idx_revisao_divergencias_tipo`, `idx_revisao_divergencias_nivel`, `idx_revisao_divergencias_convenio`, `idx_revisao_divergencias_chave_item`.

### profor_2022_revisao_decisoes

**Finalidade:** registrar as decisões humanas tomadas sobre cada divergência (uma divergência pode acumular histórico de decisões). O fluxo automático não grava decisão; a tela de revisão pode registrar decisão humana auditada via API.

**Contrato atual de payload:** `payload_decisao_json` recebe o objeto
`payloadDecisao` enviado por `POST /api/profor-2022/revisao/divergencias/:id/decisoes`.
A interface avançada de saneamento PAD/PROFOR 2022 envia payload estruturado
para equivalência por descrição normalizada, rateio manual, ausência confirmada,
liberação de item não apto em dry-run, consistência quantidade x valor unitário
e divergências genéricas de campo. O serviço acrescenta o snapshot
`_segurancaPreAtivacao` ao mesmo JSON. Não há coluna, tabela ou constraint nova.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRevisaoProfor2022()`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `divergencia_id INTEGER NOT NULL`, `decisao TEXT NOT NULL`, `decidido_em TEXT NOT NULL`, `payload_decisao_json TEXT NOT NULL DEFAULT '{}'`, FK para `profor_2022_revisao_divergencias(id)`.

**Índices confirmados:** `idx_revisao_decisoes_divergencia`.

### profor_2022_revisao_logs

**Finalidade:** trilha de auditoria da fila de revisão — criação/atualização de divergências, divergências não reapresentadas e geração de lotes.

**Arquivo de criação/evolução:** `backend/db/init-db.js`, por `garantirTabelasRevisaoProfor2022()`.

**Chave primária:** `id INTEGER PRIMARY KEY AUTOINCREMENT`.

**Constraints confirmadas:** `entidade_tipo TEXT NOT NULL`, `evento TEXT NOT NULL`, `criado_em TEXT NOT NULL`.

**Índices confirmados:** `idx_revisao_logs_entidade`.

## Evolução incremental do schema SQLite legado

`backend/db/init-db.js` usa `garantirColuna(tabela, coluna, definicao)` para evolução incremental do artefato SQLite legado. O fluxo operacional Postgres usa migrations e SQL compatível com Postgres; não usar esta seção como procedimento atual de migration.

Funcionamento confirmado:

1. consulta `PRAGMA table_info(<tabela>)`;
2. verifica se a coluna já existe;
3. se não existir, executa `ALTER TABLE <tabela> ADD COLUMN <coluna> <definicao>`.

Tabelas com evolução incremental confirmada:

- `parametros_minimos`: `quantidade_atual`, `quantidade_ideal`, `resposta_original`.
- `orcamento_2026`: campos de vínculo, classificação, autuação, valor estimado, flags e rastreio.

Riscos:

- no legado, `garantirColuna` não remove, renomeia ou altera tipo de coluna existente;
- no legado, não há tabela própria de versionamento de migrations confirmada;
- no Postgres/Supabase operacional, remover ou renomear coluna exige migration versionada, revisão e rollback;
- colunas adicionadas no SQLite legado com `DEFAULT` afetam registros antigos conforme as regras desse mecanismo.

## Relação operacional atual entre tabelas, serviços e rotas

Os serviços relacionados abaixo usam Postgres/Supabase via `DATABASE_URL`, salvo indicação explícita de legado.

| Tabela | Serviço principal | Rotas que impactam | Publicação estática relacionada |
|---|---|---|---|
| `parametros_minimos` | `parametros-minimos-service.js` | `POST /api/parametros-minimos/salvar`, `POST /api/parametros-minimos/historico/reverter` | `parametros-minimos.json` via `publicarDadosEstaticos()`. |
| `formalizacao_profor` | `formalizacao-profor-service.js` | `POST /api/formalizacao-profor/salvar` | `formalizacao-profor.json` via `publicarDadosEstaticos()`. |
| `orcamento_2026` | `orcamento-2026-service.js` | `POST /api/orcamento-2026/salvar`, `POST /api/orcamento-2026/processos-vinculados/criar` | `orcamento-2026.json` via `publicarDadosEstaticos()`. |
| `orcamento_2026_movimentacoes` | `orcamento-2026-service.js` | `POST /api/orcamento-2026/saldos/alocar` | não há publicação estática específica confirmada para movimentações no estado atual. |
| `historico_alteracoes` | `historico-service.js` | escritas de Parâmetros Mínimos, Formalização PROFOR e Orçamento 2026; reversão de Parâmetros Mínimos | não há JSON público específico de histórico confirmado. |
| `profor_convenios_monitorados` | `backend/services/profor-2022/convenios-monitorados-service.js` | `GET /api/profor-2022/convenios-monitorados`, `POST /api/profor-2022/convenios-monitorados`, `POST /api/profor-2022/convenios-monitorados/:id/salvar`, `POST /api/profor-2022/convenios-monitorados/:id/inativar` | nenhuma publicação estática criada nesta etapa. |
| `profor_detru_cache` | `backend/services/profor-2022/profor-detru-cache-service.js` | `POST /api/profor-2022/detru/atualizar`, leituras de status/consolidado | não publica automaticamente. |
| `profor_detru_atualizacoes` | `backend/services/profor-2022/profor-detru-cache-service.js` | `POST /api/profor-2022/detru/atualizar`, `GET /api/profor-2022/detru/ultima-atualizacao` | não publica automaticamente. |
| `profor_transferegov_rendimentos_cache` | `backend/services/profor-2022/transferegov-rendimentos-cache-service.js` | `POST /api/profor-2022/rendimentos/atualizar`, leituras de status/consolidado | não publica automaticamente. |
| `profor_transferegov_rendimentos_consultas` | `backend/services/profor-2022/transferegov-rendimentos-cache-service.js` | `POST /api/profor-2022/rendimentos/atualizar`, leituras de status | não publica automaticamente. |
| `profor_2022_revisao_divergencias` | `profor-pad-revisao-repository.js`, `profor-pad-revisao-decisao-service.js` | `GET /api/profor-2022/revisao/divergencias`, `GET /api/profor-2022/revisao/divergencias/:id`, `GET /api/profor-2022/revisao/auditoria` | nenhuma publicação estática criada nesta etapa. |
| `profor_2022_revisao_decisoes` | `profor-pad-revisao-decisao-service.js` | `POST /api/profor-2022/revisao/divergencias/:id/decisoes` | nenhuma publicação estática criada nesta etapa. |
| `profor_2022_revisao_logs` | `profor-pad-revisao-repository.js` | `GET /api/profor-2022/revisao/divergencias/:id/logs` (leitura); escrita em toda decisão | nenhuma publicação estática criada nesta etapa. |
| `profor_2022_revisao_lotes` | `profor-pad-revisao-repository.js`, `profor-pad-revisao-service.js` | nenhuma rota direta; gerado por `profor:pad:gerar-fila-revisao` | nenhuma publicação estática criada nesta etapa. |

Relações operacionais confirmadas:

- `parametros_minimos` se relaciona com `historico_alteracoes` por `pagina`, `registro` e `campo`, sem foreign key.
- `formalizacao_profor` se relaciona com `historico_alteracoes` por `pagina`, `registro` e `campo`, sem foreign key.
- `orcamento_2026` se relaciona com `historico_alteracoes` por `pagina`, `registro` e `campo`, sem foreign key.
- `orcamento_2026_movimentacoes.origem_id` e `destino_id` apontam operacionalmente para `orcamento_2026.id`, sem foreign key.
- `orcamento_2026.processo_pai_id` e `origem_recurso_id` apontam operacionalmente para `orcamento_2026.id`, sem foreign key.

## Artefatos fora do banco operacional

Artefatos confirmados fora do Postgres/Supabase operacional:

- `backend/data/aplicacao.json`: catálogo/base local ainda consumido por partes da aplicação; não é a persistência operacional atual do FAF 2021.
- FAF 2021: `backend/services/faf-2021-service.js` lê e grava a tabela `faf_2021_itens` no Postgres/Supabase.
- `Planilhas/`: fontes locais de importação, inicialização e leitura, incluindo Parâmetros Mínimos, Diagnóstico, Formalização PROFOR e Orçamento 2026.
- `frontend/data/publicados/*.json`: JSONs derivados para modo estático/GitHub Pages.
- `backend/data/onasp.sqlite` e `backend/data/backups/`: artefatos SQLite legados locais, ignorados pelo Git.

Esses artefatos não devem ser confundidos com as tabelas operacionais do Postgres/Supabase.

## Cuidados com versionamento

- Não versionar `backend/data/onasp.sqlite`.
- Não versionar WAL/SHM: `*.sqlite-wal`, `*.sqlite-shm` e `backend/data/onasp.sqlite-*`.
- Não versionar backups em `backend/data/backups/`.
- Não copiar banco, dumps, planilhas brutas ou anexos para `memoria/`.
- Registrar schema em Markdown tratado, sem dados reais sensíveis.
- Conferir `git status --short` antes de commit para garantir que nenhum SQLite, backup, planilha ou JSON publicado indevido entrou no diff.

## Riscos ao alterar schema

- Perda de dados por migration destrutiva.
- Divergência entre migrations Postgres e schema remoto.
- Corrupção do artefato SQLite legado quando algum script antigo for autorizado.
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

- criar e revisar migration Postgres/Supabase com rollback antes de alteração estrutural;
- conferir o histórico de migrations e validar o schema no ambiente apropriado;
- revisar `git status --short` antes e depois para confirmar que nenhum banco, dump ou segredo entrou no diff;
- executar `npm start` somente com `DATABASE_URL` configurada de forma segura;
- testar rotas afetadas por leitura e escrita controlada;
- testar exportações Excel afetadas;
- executar `npm run validar:json` se a publicação for impactada;
- executar `npm run publicar:dados` somente quando a etapa exigir atualização controlada de JSONs publicados;
- conferir `frontend/data/publicados/` quando houver publicação;
- validar rollback por migration compensatória/reversível e por `git revert` quando houver alteração versionada;
- se um script SQLite legado for expressamente autorizado, criar backup local antes de executá-lo e não versionar o artefato.

## O que não está confirmado

- Integridade dos dados no artefato legado `backend/data/onasp.sqlite`, pois ele não foi aberto nesta tarefa.
- Foreign keys formais do SQLite legado; `foreign_keys = ON` está ativo nesse arquivo, mas o SQL histórico não declara foreign keys em todas as tabelas documentadas.
- Índices além dos índices implícitos de `PRIMARY KEY` e `UNIQUE` confirmados no SQL.
- Triggers, views ou tabelas auxiliares do legado criadas fora de `backend/db/init-db.js`.
- Correspondência integral entre todas as seções históricas deste documento e o schema Postgres atual; para operação, prevalecem migrations e serviços.
- Política de retenção de backups em `backend/data/backups/`.

## Modelo de auditoria da revisão assistida de divergências PAD

A regra de revisão assistida de divergências PAD x memória está definida em
`memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`,
seção 16.2.

**Estado atual (Etapa 5.3 — fila persistente).** O modelo de persistência foi
implementado de forma aditiva nas quatro tabelas `profor_2022_revisao_*`
documentadas acima:

- `profor_2022_revisao_lotes` — geração da fila;
- `profor_2022_revisao_divergencias` — fila de divergências com payload para o
  card Antes × Depois;
- `profor_2022_revisao_decisoes` — decisões humanas (estrutura pronta; nenhuma
  decisão é gravada pelo fluxo automático);
- `profor_2022_revisao_logs` — trilha de auditoria de criação/atualização de
  divergências e geração de lotes.

A fila é gerada/regenerada por `npm run profor:pad:gerar-fila-revisao` e
auditada por `npm run profor:pad:auditar-fila-revisao`. A regeneração preserva
`status` e decisões já registradas (chave estável `chave_divergencia` com
`UNIQUE`); divergências antigas não reapresentadas não são apagadas — apenas
registradas em log.

**Auditoria operacional (Etapa 5.4.1).** A auditoria é calculada por consultas
SQL sobre as tabelas existentes, sem migration adicional. A API
`GET /api/profor-2022/revisao/auditoria` expõe:

- `totalDivergencias`;
- `totalPendentes`;
- `totalEmRevisao`;
- `totalImpeditivas`;
- `totalBloqueiamPublicacao`;
- `totalPendentesQueBloqueiamPublicacao`;
- `totalEmRevisaoQueBloqueiamPublicacao`;
- `totalComDecisaoResolutiva`;
- `totalComComentario`;
- `totalSemDecisaoResolutiva`;
- `publicacaoLiberada`.

Decisões resolutivas são `ACEITO`, `REJEITADO`, `CORRIGIDO` e `REVERTIDO`.
`COMENTAR` é comentário e `EM_REVISAO` mantém a divergência em revisão. A
publicação fica liberada apenas quando não existir divergência com status
`PENDENTE` ou `EM_REVISAO` e `bloqueia_publicacao = 1`. `ACEITO` é decisão
humana registrada, sem aplicação automática ao `planoAplicacao`.

Filtros adicionais de listagem: `bloqueiaPublicacao=true|false`,
`semDecisaoResolutiva=true|false` e `comDecisaoResolutiva=true|false`.

**Interface operacional (Etapa 5.5).** A tela local `SISTEMA > Revisão de
divergências PAD x memória` consome as rotas acima e permite consultar a fila,
abrir o detalhe Antes x Depois, visualizar logs/decisões e registrar decisão
humana. A tela não altera `planoAplicacao`, não publica e não muda a origem
ativa do PROFOR 2022.

Comandos relacionados:

- `npm run profor:pad:revisao:limpar-testes` — remove de forma transacional
  somente divergências controladas com `chave_divergencia LIKE 'revisao_teste:%'`,
  suas decisões e seus logs. Lotes de revisão são preservados.
- `npm run profor:pad:revisao:sanear-status-orfaos` — reverte para `PENDENTE`
  divergências reais com status resolutivo sem decisão resolutiva auditável,
  registrando log `status_resolutivo_orfao_saneado`.
- `npm run profor:pad:revisao:sanear-status-orfaos -- --dry-run` — lista os
  status resolutivos órfãos sem alterar o banco.

Validação de filtros:

- `semDecisaoResolutiva=true` e `comDecisaoResolutiva=true` não podem ser
  usados simultaneamente; a rota retorna HTTP 400.
- Valores booleanos diferentes de `true` ou `false` também retornam HTTP 400.

**Pendência futura.** A Etapa 5.5 **não aplica decisões**. A aplicação das
decisões ao `planoAplicacao` e a publicação com dados saneados continuam
pendentes. Quando forem planejadas, devem reaproveitar estas tabelas e o padrão
das tabelas de saneamento previstas para a Etapa E
(`profor_2022_saneamento_lotes`, `profor_2022_saneamento_decisoes`).

**Reconstrução dry-run e comparador (Etapa 5.6 + 6 + 7).** Foram criados dois
serviços de leitura — `profor-pad-plano-reconstrucao-service.js` e
`profor-pad-plano-comparador-service.js` — e dois comandos:

- `npm run profor:pad:reconstruir-plano:dry-run`;
- `npm run profor:pad:comparar-plano:dry-run`.

Esses comandos **não criam tabela, coluna, constraint nem qualquer estrutura
persistida**. Apenas leem, em modo somente leitura, as tabelas
`profor_2022_itens_conhecidos`, `profor_2022_item_rateios`,
`profor_2022_revisao_divergencias`, `profor_2022_revisao_decisoes` e
`profor_convenios_monitorados`, além dos relatórios PAD em `Planilhas/`. A
saída é gravada apenas em arquivos de relatório, fora do banco operacional:

- `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.md`.

A etapa não altera a origem ativa do `planoAplicacao`, não publica e não aplica
decisões materialmente; mantém `aptoParaAtivacao` e `aptoParaPublicacao` como
`false` enquanto houver divergências pendentes/bloqueantes.

**Motor de aplicação de decisões em dry-run (Etapa 8.1).** Foi criado o serviço
`profor-pad-decisao-aplicacao-service.js` e o comando somente leitura
`npm run profor:pad:decisoes:auditar-aplicacao-dry-run`. O serviço lê as tabelas
`profor_2022_revisao_divergencias` e `profor_2022_revisao_decisoes` para
interpretar as decisões resolutivas (`ACEITO`, `REJEITADO`, `CORRIGIDO`,
`REVERTIDO`) e transformá-las em regras técnicas de reconstrução aplicadas
apenas em dry-run. **Não cria tabela, coluna, constraint nem estrutura
persistida** e **não escreve em nenhuma tabela** — em particular, não altera
`status` de divergências, `apto_para_importacao_futura` de itens conhecidos nem
os rateios. A reconstrução e o comparador dry-run passaram a consumir essas
regras e a registrar `decisoesAplicadasDryRun`/`decisoesNaoAplicaveis` nos
relatórios. Nenhuma decisão é aplicada materialmente ao `planoAplicacao`.

**Segurança pré-ativação (Etapa 8.2).** Foi criado o serviço
`profor-pad-seguranca-pre-ativacao-service.js` e o comando somente leitura
`npm run profor:pad:seguranca-pre-ativacao:dry-run`. A auditoria **não cria
tabela, coluna, constraint nem estrutura persistida** e **não escreve em
nenhuma tabela**. Ao registrar uma nova decisão humana, o serviço de decisão
passou a gravar a chave `_segurancaPreAtivacao` **dentro do JSON já existente**
`payload_decisao_json` da tabela `profor_2022_revisao_decisoes` — um snapshot
com o hash do payload da divergência no momento da decisão. Não há coluna nova:
o snapshot é apenas mais uma propriedade do objeto JSON. Decisões antigas sem o
snapshot são tratadas como “sem snapshot”. A auditoria lê
`profor_2022_revisao_divergencias` e `profor_2022_revisao_decisoes`, recompõe a
geração atual da fila e grava a saída apenas em
`backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json` e
`.md`, fora do banco operacional.

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
