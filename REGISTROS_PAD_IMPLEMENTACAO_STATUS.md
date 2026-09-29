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
- [x] Etapa 13 — Auditoria final de arquitetura e diff
- [ ] Etapa 14 — Documentação, handoff final e commit

## 6. Estado atual

- Etapa atual: concluída — Etapa 13.
- Última etapa concluída: Etapa 13 — Auditoria final de arquitetura e diff.
- Próxima etapa: Etapa 14 — Documentação, handoff final e commit; não executada nesta auditoria.
- Atualizado em: 2026-09-29 20:44:37 -03:00.
- Branch: `main` (HEAD de entrada da retomada: `690f19252c86369378c249eb281899af75a7cfd7`).
- Working tree: com alterações preexistentes staged e unstaged; preservadas.
- Alterações preexistentes: cache/relatórios PAD, JSONs publicados, um script staged e `tmp-scan.js` não rastreado; preservadas e excluídas do commit desta auditoria.
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

### 6.9. Auditoria final — Etapa 13 concluída

**A13-01 — FECHADO**

- Commit corretivo: `690f19252c86369378c249eb281899af75a7cfd7`; diff contra `b7298e066e2b584f6a44600e3c38d43499552b45` conferido após a regressão focada.
- Regressão focada reexecutada (pass/fail/skip): carregador **18/0/0**; histórico **45/0/0**; comparador **16/0/0**; job/orquestrador **14/0/0**. Total: **93/0/0**.
- Loader preserva os dados materiais originais dos dois tipos corrigidos; snapshot os representa como `NAO_CLASSIFICADO`, com natureza, quantidade, valores e saldo preservados. Deduplicação por chaveItem e rateios legítimos mantidos; nenhuma inferência de área ou aplicação de distribuição igual.
- Arquitetura final: **APROVADA** no intervalo `9720424fac9fc347862828615a5a4c3784bb4042..690f19252c86369378c249eb281899af75a7cfd7`. Nenhum novo erro real ou caminho concreto de atualização sem registro histórico auditável identificado no fluxo inspecionado.
- ANTES é gerado e persistido antes da mutação; falha nessa captura impede o orquestrador. DEPOIS inclui linhas reconstruídas e os quatro tipos de pendência material; snapshot, alterações e conclusão são gravados na mesma transação.
- Comparador existente reutilizado; classificação enriquecida não modifica snapshots. Herança exige vínculo efetivo inequívoco; reversões e ambiguidades não atribuem área automaticamente.
- Snapshots/alterações permanecem append-only, sem purge ou sobrescrita; unicidade por execução/momento, não por checksum. Estados terminais protegidos; retry de CONCLUIDA não abre transação nem grava. Exclusividade do job e referências jobId/registroPadId coerentes; falha posterior de publicação conserva o histórico.
- Loopback usa socket; token e governança remotos preservados. APIs somente GET, com metadados/alterações sem snapshot integral e erros internos genéricos. Modo estático bloqueia entrada/consulta/deep-link; histórico e token não foram incluídos na publicação estática pelo diff auditado.
- **568 × 564: LEGÍTIMO — ALTERAÇÃO DE PAD/RATEIO**, conclusão mantida sem repetir a auditoria 13.1.
- Validações: `npm run validar:syntax` aprovado (110 arquivos); `git diff --check` sem erros. Suíte ampla não reexecutada; resultado anterior de 628 pass / 6 fail / 20 skip preservado com suas limitações.
- Banco remoto: não acessado. Persistência real após restart: ainda não validada nesta auditoria. Nenhuma execução de migration, publicação, Transferegov ou Playwright.
- Única alteração desta retomada: este status; código, testes, dados, plano e staged preexistentes preservados. Risco residual: validação de persistência limitada a fixtures/mocks e inspeção. Rollback documental, se autorizado: reverter somente o registro desta retomada; não alterar dados ou a correção A13-01. Etapa 14 não executada.

**Registro histórico da correção (antes desta retomada):**

**A13-01 — CORRIGIDO, AGUARDANDO AUDITORIA EXTERNA**

- Correção dirigida: loader reutiliza `dadosOriginaisDoItemPad` em `rateio_memorizado_sem_peso_operacional` e `distribuicao_igual_provisoria_bloqueada`; mantém as duas ocorrências como pendências não impeditivas. Distribuição igual continua não aplicada; sem alteração de sucesso/aptidão.
- Histórico inclui os dois tipos como material `NAO_CLASSIFICADO`, preservando natureza, identidade e valores originais; saldo derivado pela fotografia existente. Nenhuma inferência de área; deduplicação por chaveItem e linhas legítimas de rateio preservadas.
- Acrescentados 11 testes: loader→snapshot, bloqueio por valor e quantidade, identidade/valores/saldo, ANTES/DEPOIS com totais preservados e deduplicação. Fixture do loader injeta logger sem efeito para isolar os testes.
- Testes focados (pass/fail/skip): carregador operacional **18/0/0**; histórico **45/0/0**; comparador **16/0/0**; job/orquestrador **14/0/0**. `node --check` aprovado nos quatro JS alterados.
- `npm run validar:syntax`: sucesso, 110 arquivos. `npm run validar:services`: **628 pass / 6 fail / 20 skip**; mesmas seis falhas de 6.8 (três ABI 147 versus 137; três expectativa 568 versus 564), mais 11 aprovações. Nenhuma nova regressão encontrada; DATABASE_URL ausente no processo. `git diff --check`: sucesso.
- Dados/cache/relatório 564/plano e staged preexistentes preservados por comparação de hashes; banco remoto não acessado. Sem publicação, migration, Playwright, Transferegov real ou alteração de dependências.
- Risco residual: cobertura com fixtures/mocks; aprovação externa pendente. Rollback, se autorizado: reversão exclusiva deste patch, que reintroduziria A13-01; não restaurar dados nem snapshots. Próxima ação: auditoria externa do commit, depois regressão focada e retomada da Etapa 13. Etapas 13 e 14 permanecem abertas e não foram executadas nesta correção.

**Registro histórico da auditoria anterior (antes desta correção):**

- Base funcional auditada: `9720424fac9fc347862828615a5a4c3784bb4042..661dd5a341f2e0fe3bc053537820c77a85b60162`; arquivos funcionais locais iguais ao HEAD. Dados preexistentes considerados somente na subetapa 13.1.
- **13.1: LEGÍTIMO — ALTERAÇÃO DE PAD/RATEIO.** A diferença é líquida: 24 representações somente no HEAD e 20 somente no working tree, todas RO/937917; não existem quatro linhas isoladas cuja simples exclusão descreva a mudança. Há ainda 12 representações comuns com valores alterados (RO: 6; TO: 4; RJ: 2).
- Metadados HEAD → local: dataHora 2026-08-31T18:25:48.494Z → 2026-09-29T17:55:53.225Z; geradoEm ausente em ambos; arquivosEncontrados/arquivosLidos/totalConvenios/conveniosReconstruidos 15 → 15; itensProcessados/totalItensPad/rateiosAplicados 525 → 516; linhasReconstruidas/totalLinhasReconstruidas 568 → 564; itensNovosSemRateio 0 → 0; itensSuprimidos 52 → 76; totalPendenciasRevisao/totalImpedimentos/totalAlertas 0 → 0; sucesso/aptoParaUsoLocal true → true; aptoParaPublicacao false → false.
- Causa observável: cache Transferegov de 31/08 → 29/09; RO passa de 37 para 28 itens PAD e de 37 para 33 linhas. Cinco chaves atuais têm dois rateios: MONITOR DE 23 POLEGADAS; CADEIRA EM LONGARINA 3 LUGARES; CENTRAL DE AR-CONDICIONADO DE 12.000 BTU/H; COMPUTADOR DE MESA (DESKTOP); NOBREAK 1.500VA. Cada chave identifica duas áreas no relatório; os demais 23 itens geram uma linha cada. Um item PAD pode gerar múltiplas linhas: totalLinhasReconstruidas não é necessariamente totalItensPad (plano-reconstrucao:288–306; carregador:453–458).
- Conferência determinística: `normalizarLinhaPadCanonica`/chaveMaterial, sem fuzzy/índice. Nos três convênios afetados, agrupando por identidade material sem área para comparar cache versus soma dos rateios, todos os previstos/executados/saldos coincidem em centavos, tanto no HEAD quanto no local. Não houve item atual desses caches omitido pela reconstrução. O relatório registra origem memoria_rateio_operacional; não há pendências nesta base. Não se inferiram vínculos de substituição entre descrições antigas e novas; relatórios antigos de decisões não comprovam vínculos atuais.
- Contagens por chave: 24 chaves antigas ausentes; 15 chaves novas produzem 20 linhas. Por convênio, somente RO muda a contagem; os 15 convênios permanecem. Áreas brutas: ESCOLA PENAL 285→277; ESCOLA_PENAL 7→12; CORREGEDORIA 118→116; OUVIDORIA 143→143; NAO INFORMADO 15→16. Natureza: CAPITAL 415→411; CUSTEIO permanece 153.
- Totais previsto/executado/saldo: HEAD R$ 10.679.416,34 / R$ 3.631.992,04 / R$ 7.047.424,30; local R$ 10.679.416,34 / R$ 3.632.804,00 / R$ 7.046.612,34. Deltas: R$ 0,00 / +R$ 811,96 / −R$ 811,96.
- RO/937917: ambas as versões R$ 234.072,01 / R$ 13.450,00 / R$ 220.622,01, com redistribuição interna. TO/937468: R$ 287.128,78 / R$ 38.993,91 / R$ 248.134,87 → R$ 287.128,78 / R$ 39.805,87 / R$ 247.322,91; novos executados de R$ 219,96 (garrafa térmica) e R$ 592,00 (tomada/extensão), além da redistribuição de R$ 10.619,91 entre monitores. RJ/937817: ambas R$ 1.583.018,92 / R$ 163.193,05 / R$ 1.419.825,87; R$ 23.130,00 executados redistribuídos do saldo de rendimento para manequim RCP. Alterações financeiras coincidem com o PAD no cache local (categoria C); RO é redistribuição interna com total preservado (categoria B).
- Consumo confirmado: loader puro retornou 564 linhas/15 convênios; o endpoint consolidado não fornece mínimo 568 (server:361; dashboard-publication:63–69). Muda a lista, distribuição por área e executado/saldo; previsto global e conjunto de convênios permanecem. Expectativa fixa 568 é obsoleta para esta base atual, válida apenas para a base antiga; testes não foram alterados.
- Skips da Etapa 12: os cinco arquivos de testes usam `process.env.DATABASE_URL ? test : test.skip`; ausência no processo foi registrada em 6.8. Servidor em execução não é requisito para esses testes; eles usam conexão direta pelo cliente Postgres quando DATABASE_URL está presente.
- **Achado A13-01 — erro real, criticidade alta (integridade material), bloqueante.** `backend/services/profor-2022/profor-pad-historico-service.js:8–25` aceita apenas duas pendências materiais. `profor-pad-carregador-operacional-service.js:426–451` omite linhas para `rateio_memorizado_sem_peso_operacional` e `distribuicao_igual_provisoria_bloqueada`, registrando pendências sem os dados financeiros originais. São pendências não impeditivas (:199–200, :512); a integração aceita sucesso com zero impedimentos (historico-service:402–408), e o snapshot ignora esses itens.
- Impacto: item ainda presente no PAD pode desaparecer do ANTES/DEPOIS e dos totais históricos; uma transição pode produzir falso REMOVIDO ou SEM_ALTERACOES, com execução CONCLUIDA. A contagem de pendências não preserva a identidade/valores no snapshot. Erro demonstrado por fluxo estático alcançável; não foi observado na base 564, que tem zero pendências. Testes atuais cobrem apenas os dois tipos aceitos e não os dois caminhos omitidos.
- Correção mínima recomendada (não executada): carregar os dados originais nas duas pendências via helper existente `dadosOriginaisDoItemPad`; incluí-las como material NAO_CLASSIFICADO no histórico, preservando deduplicação por chave e rateios legítimos. Adicionar regressões dirigidas para ambos os tipos, totais, ANTES/DEPOIS e ausência de falso REMOVIDO. Devolver à **Etapa 5 — GPT-6 Sol / high**, seguida de regressão focada da Etapa 12 e retomada da Etapa 13.
- Demais pontos inspecionados: criação+ANTES transacional antes do orquestrador; finalização DEPOIS+alterações+conclusão transacional; falha operacional preserva ANTES/registro; falha de publicação posterior não reverte histórico concluído. Repository sem UPDATE de snapshots/alterações ou DELETE; transições condicionadas a EM_EXECUCAO; retry de finalização CONCLUIDA sem escrita; unicidade por execução/momento e exclusividade do job no processo. Comparador reutilizado; memória consultada sem escrita; herança exige vínculo efetivo e área única. Não há aprovação global enquanto A13-01 permanecer.
- Guards de escrita remota/token/flags preservados no diff; loopback usa socket. Consulta de detalhe não seleciona snapshot_json; nenhuma publicação de histórico adicionada; pontos de entrada/fetch/deep-link do frontend bloqueiam modo estático. Persistência real após restart, grants efetivos e concorrência entre processos não foram validados; sem alegação de erro distribuído.
- Validação desta etapa: somente inspeções/leitura de funções puras e git diff --check; sem nova suíte, servidor, publicação, Transferegov ou banco remoto. Somente este status alterado; plano/dados/índice preexistentes preservados. Risco da alteração documental: baixo; rollback documental por revisão exclusiva deste arquivo em tarefa autorizada.

<details>
<summary>13.1 — representações exatas exclusivas de cada versão (44; saldo líquido −4)</summary>

Todas as linhas abaixo são do convênio **937917 / RO**. A chave está completa; valores em reais, quantidades na unidade do relatório. Exclusividade por chave material canônica não afirma equivalência ou vínculo entre descrições diferentes.

| Versão | chaveItem | Descrição | Área | Natureza | itemConhecidoId / código natureza | Quantidade | Unitário | Previsto | Executado | Saldo |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| HEAD | 937917::DESCANSO ERGONOMICO APOIO DE PUNHO PARA | Descanso Ergonômico Apoio de punho para | CORREGEDORIA | CUSTEIO | 297 / 33903099 | 25,00 | 99,8968 | 2.497,42 | 0,00 | 2.497,42 |
| HEAD | 937917::PROJETOR 3.400 LUMENS, HDMI. | Projetor 3.400 lumens, Hdmi. | ESCOLA PENAL | CAPITAL | 307 / 44905233 | 2,00 | 4.646,18 | 9.292,36 | 0,00 | 9.292,36 |
| HEAD | 937917::MONITOR 23 POLEGADAS | Monitor 23 polegadas | CORREGEDORIA | CAPITAL | 310 / 44905235 | 8,00 | 1.053,33 | 8.426,64 | 0,00 | 8.426,64 |
| HEAD | 937917::NOTEBOOK CORE I7 8GB 512GB SSD TELA FULL | Notebook core i7 8GB 512GB SSD Tela Full | ESCOLA PENAL | CAPITAL | 311 / 44905235 | 2,00 | 6.546,035 | 13.092,07 | 0,00 | 13.092,07 |
| HEAD | 937917::CADEIRA LONGARINA 3 LUGARES | Cadeira Longarina 3 lugares | ESCOLA PENAL | CAPITAL | 312 / 44905242 | 4,00 | 858,0275 | 3.432,11 | 0,00 | 3.432,11 |
| HEAD | 937917::APOIADOR DE PES ERGONOMICO | Apoiador de pés ergonômico | CORREGEDORIA | CAPITAL | 313 / 44905299 | 25,00 | 79,0968 | 1.977,42 | 0,00 | 1.977,42 |
| HEAD | 937917::AR CONDICIONADO SPLIT 30.000 BTUS (INSTA | Ar Condicionado Split 30.000 BTUS (insta | CORREGEDORIA | CAPITAL | 314 / 44905299 | 1,00 | 4.296,92 | 4.296,92 | 0,00 | 4.296,92 |
| HEAD | 937917::AR CONDICIONADO SPLIT12.000 BTUS (INSTALADO) | Ar Condicionado Split12.000 BTUS (instalado) | CORREGEDORIA | CAPITAL | 315 / 44905299 | 5,00 | 1.822,996 | 9.114,98 | 0,00 | 9.114,98 |
| HEAD | 937917::ARMARIO ALTO ORGANIZADO | Armário Alto Organizado | CORREGEDORIA | CAPITAL | 316 / 44905299 | 3,00 | 884,903333 | 2.654,71 | 0,00 | 2.654,71 |
| HEAD | 937917::CADEIRA EXECUTIVA EM LONGARINA | Cadeira Executiva em Longarina | CORREGEDORIA | CAPITAL | 318 / 44905299 | 3,00 | 2.594,94 | 7.784,82 | 0,00 | 7.784,82 |
| HEAD | 937917::CENTRAL DE AR 12.000 MIL BTUS INVERTER | Central de ar 12.000 mil btus inverter | ESCOLA PENAL | CAPITAL | 319 / 44905299 | 3,00 | 2.149,00 | 6.447,00 | 0,00 | 6.447,00 |
| HEAD | 937917::CENTRAL DE AR 18.000 MIL BTUS INVERTER | Central de ar 18.000 mil btus inverter | ESCOLA PENAL | CAPITAL | 320 / 44905299 | 2,00 | 3.479,695 | 6.959,39 | 0,00 | 6.959,39 |
| HEAD | 937917::COMPUTADOR 8GB DDR4 SSD 240 GB MONITOR 1 | Computador 8gb Ddr4 Ssd 240 gb Monitor 1 | CORREGEDORIA | CAPITAL | 321 / 44905299 | 2,00 | 2.429,765 | 4.859,53 | 0,00 | 4.859,53 |
| HEAD | 937917::COMPUTADOR DE MESA (DESKTOP) PROCESSADOR | Computador de Mesa (desktop) PROCESSADOR | OUVIDORIA | CAPITAL | 322 / 44905299 | 12,00 | 2.928,386667 | 35.140,64 | 0,00 | 35.140,64 |
| HEAD | 937917::CAMERA DIGITAL T100 18MP LENTE 18 55MM W | Câmera Digital T100 18mp Lente 18 55mm W | CORREGEDORIA | CAPITAL | 323 / 44905299 | 1,00 | 4.766,75 | 4.766,75 | 0,00 | 4.766,75 |
| HEAD | 937917::ESTABILIZADOR | Estabilizador | ESCOLA PENAL | CAPITAL | 324 / 44905299 | 5,00 | 531,69 | 2.658,45 | 0,00 | 2.658,45 |
| HEAD | 937917::MONITOR WIDESCREEN 24MK430H - 23.8' LED, | MONITOR WIDESCREEN 24MK430H - 23.8' LED, | OUVIDORIA | CAPITAL | 326 / 44905299 | 12,00 | 775,08 | 9.300,96 | 0,00 | 9.300,96 |
| HEAD | 937917::NOBREAK 1.200 VA | Nobreak 1.200 VA | ESCOLA PENAL | CAPITAL | 327 / 44905299 | 5,00 | 866,066 | 4.330,33 | 0,00 | 4.330,33 |
| HEAD | 937917::NOBREAK 1200VA 120V | Nobreak 1200Va 120V | OUVIDORIA | CAPITAL | 328 / 44905299 | 12,00 | 827,846667 | 9.934,16 | 0,00 | 9.934,16 |
| HEAD | 937917::NOBREAK XNB 720 VA - 120V | Nobreak XNB 720 VA - 120V | CORREGEDORIA | CAPITAL | 329 / 44905299 | 8,00 | 438,90375 | 3.511,23 | 0,00 | 3.511,23 |
| HEAD | 937917::SCANNER PORTATIL I940 PRETO USB | Scanner Portátil i940 Preto USB | CORREGEDORIA | CAPITAL | 330 / 44905299 | 1,00 | 1.399,00 | 1.399,00 | 0,00 | 1.399,00 |
| HEAD | 937917::TECLADO E MOUSE SEM FIO MULTI SLIM, ABNT | Teclado e mouse sem fio multi slim, abnt | OUVIDORIA | CAPITAL | 331 / 44905299 | 12,00 | 78,73 | 944,76 | 0,00 | 944,76 |
| HEAD | 937917::TELEVISOR 43 SMART TV 4K | Televisor 43 Smart TV 4K | ESCOLA PENAL | CAPITAL | 332 / 44905299 | 2,00 | 2.532,935 | 5.065,87 | 0,00 | 5.065,87 |
| HEAD | 937917::WEBCAM FULL HD 4K MICROFONE CONEXAO | Webcam Full Hd 4k Microfone Conexão | OUVIDORIA | CAPITAL | 333 / 44905299 | 12,00 | 246,65 | 2.959,80 | 0,00 | 2.959,80 |
| Local | 937917::DESCANSO DE PUNHOS ERGONOMICO | Descanso de punhos ergonômico | CORREGEDORIA | CUSTEIO | 1077 / 33903099 | 25,00 | 99,8968 | 2.497,42 | 0,00 | 2.497,42 |
| Local | 937917::PROJETOR 3.400 LUMENS | Projetor 3.400 lumens | ESCOLA_PENAL | CAPITAL | 1079 / 44905233 | 2,00 | 4.646,18 | 9.292,36 | 0,00 | 9.292,36 |
| Local | 937917::MONITOR DE 23 POLEGADAS | Monitor de 23 polegadas | CORREGEDORIA | CAPITAL | 1086 / 44905235 | 8,00 | 775,08 | 6.200,64 | 0,00 | 6.200,64 |
| Local | 937917::MONITOR DE 23 POLEGADAS | Monitor de 23 polegadas | OUVIDORIA | CAPITAL | 1086 / 44905235 | 12,00 | 775,08 | 9.300,96 | 0,00 | 9.300,96 |
| Local | 937917::NOTEBOOK | Notebook | ESCOLA_PENAL | CAPITAL | 1078 / 44905235 | 2,00 | 8.200,00 | 16.400,00 | 0,00 | 16.400,00 |
| Local | 937917::CADEIRA EM LONGARINA 3 LUGARES | Cadeira em Longarina 3 lugares | CORREGEDORIA | CAPITAL | 1083 / 44905242 | 3,00 | 2.594,94 | 7.784,82 | 0,00 | 7.784,82 |
| Local | 937917::CADEIRA EM LONGARINA 3 LUGARES | Cadeira em Longarina 3 lugares | ESCOLA_PENAL | CAPITAL | 1083 / 44905242 | 4,00 | 2.594,94 | 10.379,76 | 0,00 | 10.379,76 |
| Local | 937917::APOIO DE PES ERGONOMICO | Apoio de pés ergonômico | CORREGEDORIA | CAPITAL | 1073 / 44905299 | 25,00 | 79,0968 | 1.977,42 | 0,00 | 1.977,42 |
| Local | 937917::ARMARIO ALTO | Armário Alto | CORREGEDORIA | CAPITAL | 1074 / 44905299 | 3,00 | 1.367,28 | 4.101,84 | 0,00 | 4.101,84 |
| Local | 937917::CENTRAL DE AR-CONDICIONADO DE 12.000 BTU/H | Central de ar-condicionado de 12.000 BTU/h | CORREGEDORIA | CAPITAL | 1084 / 44905299 | 5,00 | 2.999,00 | 14.995,00 | 0,00 | 14.995,00 |
| Local | 937917::CENTRAL DE AR-CONDICIONADO DE 12.000 BTU/H | Central de ar-condicionado de 12.000 BTU/h | ESCOLA_PENAL | CAPITAL | 1084 / 44905299 | 3,00 | 2.999,00 | 8.997,00 | 0,00 | 8.997,00 |
| Local | 937917::CENTRAL DE AR-CONDICIONADO DE 18.000 BTU/H | Central de ar-condicionado de 18.000 BTU/h | ESCOLA_PENAL | CAPITAL | 1075 / 44905299 | 2,00 | 4.100,00 | 8.200,00 | 0,00 | 8.200,00 |
| Local | 937917::CENTRAL DE AR-CONDICIONADO DE 30.000 BTU/H | Central de ar-condicionado de 30.000 BTU/h | CORREGEDORIA | CAPITAL | 1076 / 44905299 | 1,00 | 5.444,00 | 5.444,00 | 0,00 | 5.444,00 |
| Local | 937917::COMPUTADOR DE MESA (DESKTOP) | Computador de Mesa (Desktop) | CORREGEDORIA | CAPITAL | 1085 / 44905299 | 2,00 | 2.928,39 | 5.856,78 | 0,00 | 5.856,78 |
| Local | 937917::COMPUTADOR DE MESA (DESKTOP) | Computador de Mesa (Desktop) | OUVIDORIA | CAPITAL | 1085 / 44905299 | 12,00 | 2.928,39 | 35.140,68 | 0,00 | 35.140,68 |
| Local | 937917::NOBREAK 1.500VA | Nobreak 1.500Va | CORREGEDORIA | CAPITAL | 1087 / 44905299 | 8,00 | 533,02 | 4.264,16 | 0,00 | 4.264,16 |
| Local | 937917::NOBREAK 1.500VA | Nobreak 1.500Va | OUVIDORIA | CAPITAL | 1087 / 44905299 | 12,00 | 533,02 | 6.396,24 | 0,00 | 6.396,24 |
| Local | 937917::SALDO REMANESCENTE | Saldo Remanescente | NAO INFORMADO | CAPITAL | 1080 / 44905299 | 1,00 | 5.445,39 | 5.445,39 | 0,00 | 5.445,39 |
| Local | 937917::TECLADO E MOUSE SEM FIO | Teclado e mouse sem fio | OUVIDORIA | CAPITAL | 1081 / 44905299 | 12,00 | 78,73 | 944,76 | 0,00 | 944,76 |
| Local | 937917::WEBCAM FULL HD 4K | Webcam Full Hd 4k | OUVIDORIA | CAPITAL | 1082 / 44905299 | 12,00 | 246,65 | 2.959,80 | 0,00 | 2.959,80 |

</details>

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

- Nenhum bloqueio arquitetural identificado para a Etapa 14; A13-01 fechado. Permanecem as limitações ambientais/dados de 6.8 e a ausência de validação real após restart, sem nova regressão.

## 10. Instruções para o próximo agente

O próximo agente deve:
1. ler `AGENTS.md`;
2. ler `memoria/INDEX.md`;
3. ler este `REGISTROS_PAD_IMPLEMENTACAO_STATUS.md`;
4. ler somente a seção da Etapa 14 em `PLANO_REGISTROS_PAD_PROFOR_2022.md`, quando essa etapa for autorizada;
5. considerar a Etapa 13 aprovada e A13-01 fechado conforme 6.9;
6. preservar dados preexistentes, a conclusão legítima 568 × 564 e as limitações de validação registradas;
7. executar a Etapa 14 somente em tarefa própria autorizada; não reabrir decisões encerradas;
8. atualizar este arquivo ao terminar.

## 11. Protocolo de fechamento por etapa

Uma etapa somente é considerada concluída após validação local, commit exclusivo da etapa e push para o repositório remoto. O SHA do commit deve ser informado para auditoria antes da etapa seguinte.
