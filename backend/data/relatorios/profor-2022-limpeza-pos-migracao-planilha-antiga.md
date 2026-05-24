# PROFOR 2022 — Limpeza pós-migração da planilha antiga

## 1. Contexto

Esta etapa executa limpeza técnica pós-migração no FOMENTO-ONASP para reduzir resíduos que ainda tratam a planilha antiga por abas/UF como origem operacional.

## 2. Confirmação de migração já realizada

A migração funcional para a sistemática PAD/reconstrução já está realizada. Esta etapa não reimplementa migração; apenas saneia resíduos técnicos e documentais.

## 3. Objetivo da limpeza

Identificar e classificar resíduos legados em código, scripts, testes, documentação e configuração, bloqueando uso perigoso e preservando histórico necessário.

## 4. Termos pesquisados

`gestao_financeira_ouvidoria.xlsx`, `arquivoPlanilhaConvenios`, `Planilhas/`, `abas por UF`, `aba Geral`, `planilha antiga`, `origem planilha`, `carregarPlanoAplicacaoLocal`, `extrairPlanoAplicacaoProforDoWorkbook`, `xlsx.readFile`, `banco-cache`, `fallback`, `fallback planilha`, `PROFOR_2022_ORIGEM_DADOS`, `planilha`, `geral`, `workbook`.

## 5. Achados por arquivo

1. `backend/scripts/importar-convenios-monitorados-profor-2022.js`
   - Script legado importa carteira a partir da aba `Geral` da planilha antiga e grava em banco.
   - Classificação: `bloquear agora`.
2. `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`
   - Usa `carregarPlanoAplicacaoLocal()` e `xlsx.readFile` da planilha para compor consolidado local.
   - Classificação: `não mexer por risco alto` nesta etapa (serviço operacional amplo fora do escopo mínimo).
3. `backend/server.js`
   - Endpoints locais `GET /api/profor-2022/consolidado` e `GET /api/profor-2022/comparar-origens` passam por leitura de workbook/planilha.
   - Classificação: `manter como fallback explícito de desenvolvimento` (sem mudança nesta etapa).
4. `backend/services/dashboard-publication-service.js`
   - Suporta origens `planilha`, `banco-cache` e `reconstrucao-pad`; contém trilha de leitura de workbook.
   - Classificação: `manter como fallback explícito de desenvolvimento` (sem fallback silencioso em `reconstrucao-pad`).
5. `.env.example`
   - Definia `PROFOR_2022_ORIGEM_DADOS=planilha` com comentário de padrão antigo.
   - Classificação: `atualizar documentação`.
6. `memoria/INDEX.md`
   - Texto antigo sugeria preservar planilha como origem atual.
   - Classificação: `atualizar documentação`.
7. `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
   - Documento vivo com trechos históricos conflitantes sobre origem ativa.
   - Classificação: `atualizar documentação` com nota explícita de obsolescência.
8. `backend/data/relatorios/*` e `memoria/09_ERROS_E_CORRECOES/historico-erros.md`
   - Referências à planilha antiga em contexto histórico/auditoria.
   - Classificação: `manter como relatório histórico`.
9. `tests/services/profor-pad-origem-reconstrucao.test.js`
   - Menções a `planilha`/`banco-cache` no contexto de compatibilidade de origem.
   - Classificação: `manter como fallback explícito de desenvolvimento`.
10. `frontend/data/publicados/aplicacao.json` e `backend/data/aplicacao.json`
    - Campo `arquivoPlanilhaConvenios` presente.
    - Classificação: `não mexer por risco alto` nesta etapa (fora do escopo e com restrição de não alterar publicados).

## 6. Classificação consolidada

- `remover agora`: nenhum item.
- `bloquear agora`: script legado de importação da aba `Geral`.
- `manter como histórico`: relatórios e memória histórica.
- `manter como fallback explícito de desenvolvimento`: rotas/serviços locais de comparação e compatibilidade.
- `manter como relatório histórico`: todos os relatórios dry-run e registros passados.
- `atualizar documentação`: `.env.example`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`.
- `não mexer por risco alto`: fluxo operacional amplo de consolidação local e catálogos publicados nesta etapa.
- `falso positivo`: menções de planilha em módulos não-PROFOR (Orçamento, Formalização, Parâmetros) sem relação com esta frente.

## 7. Resíduos removidos ou bloqueados

- Bloqueada execução por padrão do script legado `backend/scripts/importar-convenios-monitorados-profor-2022.js`.
- Novo gate obrigatório: `ALLOW_PROFOR_2022_IMPORT_PLANILHA_LEGADA=1`.
- Sem gate, o script falha explicitamente com erro de legado.

## 8. Resíduos mantidos e justificativa

- Leitura de workbook em serviços/rotas locais foi mantida por risco de regressão operacional fora do escopo mínimo.
- Trilhas históricas e relatórios foram preservados por rastreabilidade.
- Fallbacks de desenvolvimento não foram removidos sem plano dedicado de desativação.

## 9. Riscos

- Risco residual moderado: ainda existem caminhos locais que leem workbook/planilha para consolidação/comparação.
- Mitigação aplicada: bloqueio de script legado de escrita em banco + atualização da documentação viva para evitar interpretação de planilha como origem ativa.

## 10. Arquivos alterados

- `backend/scripts/importar-convenios-monitorados-profor-2022.js`
- `.env.example`
- `memoria/INDEX.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `backend/data/relatorios/profor-2022-limpeza-pos-migracao-planilha-antiga.md`

## 11. Arquivos preservados

- `frontend/data/publicados/*`
- `.env`
- `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`
- snapshots PAD (atual e anterior oficial)
- planoAplicacao oficial
- fila oficial real
- decisões, divergências, logs e relatórios históricos

## 12. Validações

- `git diff --check`
- `npm run validar:syntax`
- `npm run validar:services`
- `npm run profor:pad:reconstruir-plano:dry-run`
- `npm run profor:pad:comparar-plano:dry-run`
- `npm run profor:pad:comparar-snapshots:dry-run`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`

## 13. Rollback

1. `git revert <commit_fix_limpeza>`
2. `git revert <commit_docs_limpeza>` (se separado)
3. Reexecutar validações dry-run

Sem apagar decisões, divergências, logs ou relatórios históricos.

## 14. Próximos passos

1. Planejar frente dedicada para desativar gradualmente as rotas locais que ainda dependem de workbook no fluxo PROFOR.
2. Definir política explícita para fallback de desenvolvimento (`planilha`), incluindo janela de descontinuação.
3. Consolidar documentação viva PROFOR 2022 para remover contradições históricas de origem ativa.
