# Registros do PAD — Status de Implementação

## 1. Objetivo

Implementar histórico persistente e imutável das atualizações do PAD do PROFOR 2022,
com snapshots ANTES/DEPOIS, reaproveitamento do comparador existente, preservação
da memória de classificação e nova tela “Registros do PAD”.

## 2. Fonte de verdade

Especificação completa: `PLANO_REGISTROS_PAD_PROFOR_2022.md` na raiz.

> Em caso de dúvida, consultar o plano. Este arquivo de status não substitui a especificação completa.

## 3. Escopo fixado

- Recurso exclusivo do PAD do PROFOR 2022, em tela própria dentro do módulo.
- Histórico permanente e imutável, inclusive para atualização sem mudanças.
- Comparação ANTES × DEPOIS.
- Preservar classificação Ouvidoria / Corregedoria / Escola.
- Correspondências inequívocas podem herdar classificação; ambiguidades seguem para revisão humana.
- Reutilizar comparador e snapshots existentes; não criar mecanismo paralelo.
- Ações locais do PROFOR 2022 dispensam senha; chamadas remotas continuam protegidas.

## 4. Componentes existentes que DEVEM ser reutilizados

- `profor-pad-fotografia-service.js`
- `profor-pad-comparador-snapshots-service.js`
- Memória existente de itens/rateios.
- Sistema existente de revisão de divergências.
- Decisões de `vinculo_item_substituto`.
- PostgreSQL/Supabase operacional.
- Job atual de atualização Transferegov.

Não reimplementar essas responsabilidades.

## 5. Etapas

- [x] Etapa 0 — Preparação da execução
- [x] Etapa 1 — Inspeção dirigida e confirmação da arquitetura
- [x] Etapa 2 — Migration das tabelas de histórico
- [x] Etapa 3 — Repository de histórico
- [x] Etapa 4 — Serviço de histórico e snapshots ANTES/DEPOIS
- [x] Etapa 5 — Estado completo do snapshot
- [x] Etapa 6 — Memória de classificação e substitutos
- [x] Etapa 7 — Integração com o job Transferegov e atomicidade
- [x] Etapa 8 — Remoção da senha local do PROFOR 2022
- [x] Etapa 9 — APIs de leitura do histórico
- [x] Etapa 10 — Tela Registros do PAD
- [x] Etapa 11 — Botão Ver alterações e deep-link
- [x] Etapa 12 — Testes integrados e regressão
- [ ] Etapa 13 — Auditoria final de arquitetura e diff
- [ ] Etapa 14 — Documentação, handoff final e commit

## 6. Estado atual

- Etapa atual: concluída — Etapa 12.
- Última etapa concluída: Etapa 12 — Testes integrados e regressão.
- Próxima etapa: Etapa 13 — Auditoria final de arquitetura e diff; não iniciada nesta execução.
- Atualizado em: 2026-09-29 19:56:42 -03:00.
- Branch: `main` (HEAD de entrada da Etapa 12: `61d6456edc5bfb8baaec4315f8ec5551329407a9`).
- Working tree: com alterações preexistentes staged e unstaged; preservadas.
- Alterações preexistentes: cache/relatórios PAD, JSONs publicados, um script staged e `tmp-scan.js` não rastreado; preservadas e não incluídas na Etapa 12.
- Plano original presente na raiz; não alterado.

### 6.1. Mapa confirmado na Etapa 1

- Migrations: `supabase/migrations/`, nomes com timestamp `YYYYMMDDHHMMSS_descricao.sql`; schema `public`, IDs identity, timestamps `timestamptz`, FKs e índices. RLS está habilitado nas tabelas PROFOR; nenhuma `CREATE POLICY` apareceu nas migrations inspecionadas. A próxima etapa deve manter acesso pelo backend/Postgres e conferir os grants efetivos.
- Banco: `backend/db/postgres-client.js` expõe `query(text, params)` e `withTransaction(callback)` (BEGIN/COMMIT; ROLLBACK em erro); `preparar-banco.js` exige `DATABASE_URL`, verifica `parametros_minimos` e não cria schema.
- Snapshot: reutilizar `gerarFotografiaCanonica`, `calcularHashItem` e `calcularChecksumSnapshot`; versões atuais `0.2` e parser `profor-pad-fotografia-service@0.2`.
- Comparador: reutilizar `compararSnapshotsPad`; versão `0.3`; retorna `itensIguais`, `itensNovos`, `itensAusentes`/`itensRemovidos`, `itensAlterados`, divergências e `modo: "dry-run"`.
- Memória/revisão: loader `carregarPadsOperacional` usa itens conhecidos e `profor_2022_item_rateios`; sem rateio, itens vão a `pendenciasRevisao`; decisões usam `profor_2022_revisao_decisoes.payload_decisao_json` via repository existente.
- Áreas normalizadas: `OUVIDORIA`, `CORREGEDORIA`, `ESCOLA_PENAL`, `N/A`, `NAO_CLASSIFICADO`. Compatibilidade legada/UI também usa `ESCOLA PENAL` e rótulo “Não classificado”.
- Substitutos: `vinculo_item_substituto` é registrado no payload da decisão, com `aplicadaAoPlano: false`; é referência de auditoria/revisão, não alteração automática do plano.
- Job/orquestrador: `GerenciadorAtualizacaoTransferegov.iniciar()` cria `jobId` e mantém exclusividade global. O orquestrador valida e salva o cache antes de chamar `carregarPadsOperacional`; o job publica dados estáticos após o orquestrador. `jobId` ainda não é passado ao orquestrador.
- Integração futura: ANTES precisa ser capturado antes de `salvar(cache)`; DEPOIS após a recarga operacional. Considerar que falha na publicação pode ocorrer após cache/recarga bem-sucedidos.
- Rotas/UI: POST `/api/profor-2022/pad/atualizar-transferegov`; status GET `/api/profor-2022/pad/atualizar-transferegov/status/:jobId`; blocos relacionados ficam no PROFOR de `backend/server.js` e `renderProfor2022View` em `frontend/js/app.js`. Fluxo atual tem senha local e proteção de chamada remota; preservar modo estático somente leitura.
- Testes relacionados existentes: fotografia, comparador de snapshots, orquestrador, loader operacional, matching, revisão e auditoria de substituto em `tests/services/`. Nenhum teste foi executado nesta etapa.
- Diferenças documentais: `AGENTS.md` e trechos históricos da memória ainda citam SQLite para PROFOR; o item 2.2 do plano e os módulos operacionais conferidos apontam PostgreSQL/Supabase via `DATABASE_URL`. A geração de snapshot atual recebe apenas o plano reconstruído com rateios; incluir itens pendentes/sem classificação continua sendo requisito da Etapa 5.
- Resultado: mapa atual compatível com o plano; sem decisão arquitetural nova e sem bloqueio conhecido para iniciar a Etapa 2.

### 6.2. Migration criada na Etapa 2

- `supabase/migrations/20260929163637_create_profor_2022_pad_historico.sql`: define `public.profor_2022_pad_atualizacoes`, `public.profor_2022_pad_snapshots` e `public.profor_2022_pad_alteracoes`.
- FKs incluídas: snapshots→atualizações e alterações→atualizações (`ON DELETE RESTRICT`); alterações→divergências e alterações→decisões (`ON DELETE SET NULL`). IDs das tabelas de revisão confirmados como `bigint` na migration vigente.
- Índices: 10 explícitos (3 atualizações, 2 snapshots, 5 alterações); unicidade por `(atualizacao_id, momento)` e `(atualizacao_id, chave_alteracao)`, sem `UNIQUE(checksum)`.
- RLS: habilitado nas três tabelas; nenhuma policy ou GRANT criada; `REVOKE ALL PRIVILEGES` de `anon` e `authenticated` incluído para cada tabela. Migration aplicada ao banco remoto: não.
- Validação: inspeção integral do SQL e checagem estrutural estática aprovada; `git diff --check` e `git diff --cached --check` sem erros. CLI Supabase indisponível; nenhum banco foi acessado.
- Diferença operacional: `.gitignore` ignora `supabase/`; esta migration exigiu `git add -f` por pathspec, sem alterar o ignore.

### 6.3. Repository criado na Etapa 3

- `backend/services/profor-2022/profor-pad-historico-repository.js`: `criarAtualizacao`, `concluirAtualizacao`, `falharAtualizacao`, `inserirSnapshot`, `inserirAlteracoes`, `buscarAtualizacaoPorId`, `buscarAtualizacaoPorJobId`, `listarAtualizacoesPorMes`, `listarAtualizacoesPorData` e `buscarDetalheAtualizacao`.
- Aceita executor/client transacional externo ou `postgresClient.query`; não abre transação nem conexão. Escritas usam parâmetros e alterações em lote, com conflito ignorado sem UPDATE.
- Consultas mensal e por data usam `America/Sao_Paulo`; filtros de alteração usam `EXISTS`. Detalhe retorna metadados dos snapshots sem selecionar `snapshot_json`.
- `tests/services/profor-pad-historico-repository.test.js`: 17 testes unitários aprovados com executor falso.
- Validações: `node --check` nos dois arquivos, `node --test` direcionado e `npm run validar:syntax` aprovados; `git diff --check` sem erros. Banco remoto acessado: não.

### 6.4. Serviço e snapshots completos — Etapas 4 e 5

- `profor-pad-historico-service.js`: `montarPlanoCompletoParaHistorico`, `gerarSnapshotHistorico`, `normalizarAlteracoesComparador`, `montarResumoAtualizacaoHistorico`, `iniciarHistoricoPad`, `finalizarHistoricoPad`, `falharHistoricoPad`.
- Comparador existente mantido: padrão `dry-run`, opção `historico`, `itemAnterior`/`itemNovo` aditivos; pareamento intacto.
- Snapshot completo: linhas reconstruídas + `item_novo_sem_rateio_memorizado` e `item_pad_sem_rateio_memorizado`; área pendente `NAO_CLASSIFICADO`; deduplicação por `chaveItem`.
- Início transacional: execução + ANTES. Finalização transacional: DEPOIS + alterações + conclusão. Sem mudanças: execução e ambos os snapshots registrados com `SEM_ALTERACOES`.
- Testes: histórico 21/21, comparador 16/16, repository 17/17; `node --check` e `npm run validar:syntax` aprovados. Banco remoto acessado: não.

### 6.5. Memória de classificação e integração — Etapas 6 e 7

- Consultas em lote e somente leitura recuperam rateios ativos, divergências e decisão efetiva de `vinculo_item_substituto`.
- Alterações normalizadas recebem `PRESERVADA`, `PENDENTE_REVISAO` ou `HERDADA_SUBSTITUTO` por correspondência inequívoca; `ESCOLA PENAL` legada é normalizada. Snapshots e memória operacional não são reescritos.
- Captura ANTES obrigatória precede o orquestrador original; a recarga já produzida por ele alimenta DEPOIS. Falha de finalização marca o registro FALHOU separadamente.
- Job passa `jobId`, expõe `registroPadId` e `resultadoHistorico` no polling e mantém exclusividade e publicação estática posterior.
- Validação local: 76 testes direcionados aprovados; `node --check` nos seis arquivos JS, `npm run validar:syntax` e `git diff --check` aprovados. Banco remoto e Transferegov real não acessados.
- Correção dirigida da Etapa 7: recarga operacional DEPOIS validada antes da finalização; `sucesso=false`, impedimentos ou resultado ausente geram FALHOU. Estado inválido nunca vira snapshot DEPOIS.
- Regressão da correção: 80 testes direcionados aprovados, inclusive recarga falha/ausente e classificação inequívoca; `node --check`, `npm run validar:syntax` e `git diff --check` aprovados.

### 6.6. Operação local e APIs do histórico — Etapas 8 e 9

- Ações administrativas PROFOR em loopback não exigem senha; a decisão usa somente o endereço remoto do socket. Guards, flags e token para requisições remotas foram preservados.
- `ONASP_EDIT_PASSWORD` permanece documentada para módulos que ainda exigem senha. As ações do frontend PROFOR mantêm bloqueio em modo estático e verificação de hostname local; não enviam senha.
- Criadas as rotas GET backend-only `/api/profor-2022/pad/historico` (consulta mensal ou por data) e `/api/profor-2022/pad/historico/:id` (detalhe 404 quando ausente).
- Filtros por data: UF, convênio, tipo e área. Detalhe retorna atualização, alterações e metadados dos snapshots; snapshot integral não é exposto. Nenhuma publicação estática foi criada.
- Validação: guard 27/27; API 10/10; repository 19/19; recarga operacional 2 aprovados e 4 ignorados pelo teste. `npm run validar:syntax` e `git diff --check` aprovados. Banco remoto acessado: não.

### 6.7. Tela e deep-link do histórico — Etapas 10 e 11

- Subview interna `Registros do PAD` criada em `#view-profor-2022`, sem item global de menu.
- Calendário mensal, lista por data e filtros UF/convênio/tipo/área consomem as APIs existentes.
- Detalhe Antes/Depois usa alterações e metadados da API; suporta COM_ALTERACOES, SEM_ALTERACOES e FALHOU.
- Modo estático não chama a API do histórico. CTA pós-job usa `registroPadId` e `resultadoHistorico` somente em conclusão.
- Deep-link usa `proforSubview`/`registroPadId`; refresh e `popstate` restauram a subview e o detalhe.
- Correção dirigida: Antes/Depois prioriza `areaAnterior/areaNova` e `naturezaAnterior/naturezaNova`; `HERDADA_SUBSTITUTO` mostra a área herdada, sem reescrever o snapshot.
- Retorno de deep-link carrega a base principal sob demanda; aria-label do calendário usa “execução”/“execuções”.
- Testes de regressão: frontend 13/13; API 10/10; job/orquestrador 14/14. `node --check`, `npm run validar:syntax` e `git diff --check` aprovados.
- Backend alterado: não. Banco remoto acessado: não.

### 6.8. Regressão integrada — Etapa 12 concluída

- Deduplicação por `chaveItem`, preservação dos rateios reconstruídos, retry sem novas escritas e transições terminais revalidados; os dois bloqueios corrigidos não reapareceram.
- Suíte central (pass/fail/skip): histórico 37/0/0; repository 19/0/0; comparador 16/0/0; job/orquestrador 14/0/0; guard 27/0/0; API 10/0/0; frontend 13/0/0; fotografia 10/0/0.
- Regressões PAD relacionadas: 117 pass / 5 fail / 6 skip. Duas falhas são do ABI `better-sqlite3` 147 versus Node 137; três são do relatório local preexistente com 564 linhas versus 568 esperadas. Os seis skips exigem `DATABASE_URL`.
- `npm run validar:services` executado: 617 pass / 6 fail / 20 skip. As seis falhas são as mesmas cinco acima mais um terceiro teste afetado pelo mesmo ABI (`profor-saldo-residual-pareamento-44.test.js`); os skips dependem de `DATABASE_URL` ausente.
- Nenhuma regressão da feature encontrada nas áreas cobertas. Inspeção dirigida: sem `DELETE` automático ou `UPDATE` de snapshot/alteração no repository; constraint única `(atualizacao_id, momento)` preservada; checksum não é chave única global.
- `npm run validar:syntax`: sucesso (110 arquivos); `git diff --check`: sucesso. Alterações preexistentes preservadas, com hashes iguais após os testes.
- Playwright: não executado. Banco remoto: não acessado. Migration aplicada: não. Persistência real após restart: não validada.

## 7. Arquivos alterados pela última etapa

- `REGISTROS_PAD_IMPLEMENTACAO_STATUS.md`

## 8. Decisões que não devem ser rediscutidas

- Usar PostgreSQL/Supabase.
- Histórico específico do PAD, com snapshots imutáveis.
- Reaproveitar o comparador existente.
- Não substituir o sistema de classificação nem duplicar a revisão.
- Não usar `historico_alteracoes` como histórico principal do PAD.
- Não usar `logs_operacionais` como armazenamento principal do histórico.
- Preservar modo estático/GitHub Pages.
- Evitar dependências novas e refatorações não relacionadas.

## 9. Pendências/bloqueios

- Nenhum bloqueio da feature identificado na Etapa 12. As falhas ambientais e do relatório local preexistente permanecem fora do escopo desta etapa.

## 10. Instruções para o próximo agente

O próximo agente deve:
1. ler `AGENTS.md`;
2. ler `memoria/INDEX.md`;
3. ler este `REGISTROS_PAD_IMPLEMENTACAO_STATUS.md`;
4. ler somente a seção da Etapa 13 em `PLANO_REGISTROS_PAD_PROFOR_2022.md`;
5. executar a auditoria final de arquitetura e diff em tarefa própria;
6. considerar as limitações ambientais e de dados registradas em 6.8;
7. não iniciar a Etapa 14 antes de concluir a Etapa 13;
8. atualizar este arquivo ao terminar.

## 11. Protocolo de fechamento por etapa

Uma etapa somente é considerada concluída após validação local, commit exclusivo da etapa e push para o repositório remoto. O SHA do commit deve ser informado para auditoria antes da etapa seguinte.
