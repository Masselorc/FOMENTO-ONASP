# PROFOR 2022 - Remocao fisica do legado da planilha antiga por abas

## 1. Contexto

A migracao funcional para PAD/reconstrucao ja estava concluida. Esta etapa nao reimplementou migracao; removeu entradas remanescentes da planilha antiga por abas/UF (`Planilhas/gestao_financeira_ouvidoria.xlsx`) que ainda existiam como fallback, comparacao, script legado ou caminho de publicacao.

## 2. Sem nova auditoria historica pela planilha antiga

Nao havera nova auditoria historica pela planilha antiga. Registros e relatorios ja versionados foram preservados como historico, mas a aplicacao nao deve mais usar a planilha antiga como origem operacional, fallback, comparacao ou rota dev.

## 3. Planilha antiga x PADs novos em Excel

A remocao se restringiu ao legado `gestao_financeira_ouvidoria.xlsx` e aos helpers associados. A dependencia `xlsx` foi preservada porque os arquivos PAD atuais continuam em Excel e os leitores PAD permanecem ativos.

## 4. O que foi removido

- Rota `GET /api/profor-2022/comparar-origens`.
- Helpers de runtime no servidor: `carregarWorkbookProfor2022`, `montarConsolidadoProfor2022Local` e `montarComparacaoOrigensProfor2022Local`.
- Origens operacionais legadas `planilha` e `banco-cache` no resolver PROFOR 2022.
- Script `backend/scripts/importar-convenios-monitorados-profor-2022.js`.
- Script `backend/scripts/atualizar-profor-2022-consolidado.js`.
- Script `backend/scripts/agendar-atualizacao-profor-2022.js`.
- Scripts antigos de rateio inicial baseados na planilha por abas: `extrair-rateios-profor-2022.js`, `importar-rateio-inicial-profor-2022.js`, `rollback-rateio-inicial-profor-2022.js` e o servico `profor-rateio-import-service.js`.
- Flags de workbook/orquestrador/dev em `.env.example`: `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK`, `ALLOW_PROFOR_2022_ENDPOINTS_DEV`, `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO`.
- Campo local `arquivoPlanilhaConvenios` e configuracoes associadas em `backend/data/aplicacao.json`.

## 5. O que foi mantido por ser leitura PAD atual

- Dependencia `xlsx`.
- `backend/scripts/ler-relatorios-pad-profor-2022.js`.
- Servicos `backend/services/profor-2022/profor-pad-*`.
- Dry-runs PAD de leitura, reconstrucao, comparacao de plano e comparacao de snapshots.

## 6. O que foi preservado como historico

- Relatorios existentes em `backend/data/relatorios/`.
- Memorias historicas e entradas antigas do diario.
- Decisoes, divergencias, logs, snapshots, fila oficial e plano oficial.
- `frontend/data/publicados/`, incluindo referencias historicas ja publicadas.

## 7. Arquivos alterados

- `backend/server.js`
- `backend/data/aplicacao.json`
- `backend/services/data-service.js`
- `backend/services/dashboard-publication-service.js`
- `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`
- `backend/services/profor-2022/profor-origem-service.js`
- `backend/services/profor-2022/profor-pad-origem-reconstrucao-service.js`
- `backend/services/profor-2022/profor-rateio-extracao-service.js`
- `backend/services/profor-2022/profor-workbook-fallback-guard-service.js`
- `backend/scripts/bloquear-atualizar-profor-2022-legado.js`
- `backend/scripts/bloquear-agendar-profor-2022-legado.js`
- `frontend/js/app.js`
- `package.json`
- `scripts/validar-syntax.js`
- `tests/services/profor-admin-endpoint-guard.test.js`
- `tests/services/profor-pad-origem-reconstrucao.test.js`
- `.env.example`
- `memoria/INDEX.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`

## 8. Scripts removidos ou ajustados

Removidos do `package.json`: `import:profor-convenios`, `profor:legado:atualizar-consolidado:dev`, `profor:legado:agendar-atualizacao:dev`, `extrair:rateios-profor-2022:dry-run`, `profor:rateio:importar:dry-run-json`, `profor:rateio:importar-json` e `profor:rateio:rollback-lote`.

Mantidos como wrappers bloqueadores: `atualizar:profor-2022` e `agendar:profor-2022`; ambos falham cedo antes de banco, rede, DETRU, Transferegov ou workbook.

## 9. Flags removidas ou mantidas

Removidas: flags de liberacao de workbook legado, endpoint dev de workbook e orquestrador legado.

Mantidas: `FOMENTO_AMBIENTE`, `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS`, `ALLOW_PROFOR_2022_EXTERNAL_CALLS` e `ALLOW_PROFOR_2022_SCHEDULER`, como protecoes tecnicas contra execucao acidental. Nao foi criado nem documentado sistema de login/autorizacao por usuario.

## 10. Testes executados

- `npm run validar:syntax` - 103 arquivos validados.
- `npm run validar:services` - 239 testes aprovados.

## 11. Validacoes executadas

- `git diff --check`.
- `npm run profor:pad:ler-relatorios:dry-run`.
- `npm run profor:pad:reconstruir-plano:dry-run`.
- `npm run profor:pad:comparar-plano:dry-run`.
- `npm run profor:pad:comparar-snapshots:dry-run`.

Os relatórios dry-run derivados foram restaurados depois da validação para evitar versionar artefatos sem relação material com esta frente. Comandos proibidos de publicacao, atualizacao externa e agendamento real nao foram executados.

## 12. Preservacoes

Nao houve publicacao. `frontend/data/publicados/`, `.env`, SQLite/WAL/SHM, snapshots, fila oficial, decisoes, divergencias, logs e relatorios historicos foram preservados. DETRU e Transferegov nao foram acionados.

## 13. Risco residual

Ainda existem funcoes antigas de parsing de workbook em `data-service.js` e `dashboard-publication-service.js` porque o arquivo tambem centraliza leitores Excel de outras frentes e a dependencia `xlsx` segue necessaria. O acesso automatico/manual a `gestao_financeira_ouvidoria.xlsx` foi removido dos fluxos PROFOR ativos.

## 14. Rollback

Reverter os commits desta frente. A reversao nao deve apagar relatorios historicos nem alterar dados publicados, SQLite, WAL, SHM, snapshots, fila oficial ou plano oficial.

## 15. Proximos passos

- Avaliar, em frente separada, limpeza de nomes legados em funcoes internas compartilhadas de parser Excel sem afetar Orçamento, Formalizacao, Contatos, Diagnostico e PADs.
- Manter os dry-runs PAD como fonte de validacao do PROFOR 2022.
