# PROFOR 2022 — Auditoria final de fallback por workbook (planilha antiga)

## 1. Contexto

Esta auditoria encerra o ciclo previsto pelo plano original de limpeza (inventário, classificação, linha de base, bloqueio do que for perigoso). Foi feita **após** a migração funcional para PAD/reconstrução estar concluída e **após** os commits `773ea98` (bloqueio do script legado da aba `Geral`) e `055bcdc` (documentação da limpeza pós-migração).

Esta auditoria **não é uma remoção ampla** de fallback. O escopo é estritamente classificar o que sobrou e bloquear apenas o **fallback silencioso** ou o **caminho operacional perigoso**.

## 2. Relação com o plano original de limpeza

| Fase do plano | Status |
|---|---|
| Inventário dos pontos legados de workbook/planilha | concluído no commit `055bcdc` |
| Bloqueio do script legado de aba `Geral` (escrita em banco) | concluído em `773ea98` (gate `ALLOW_PROFOR_2022_IMPORT_PLANILHA_LEGADA=1`) |
| Documentação viva atualizada | concluído em `055bcdc` |
| Classificação final dos resíduos remanescentes | **esta auditoria** |
| Bloqueio do último fallback silencioso identificado | **patch desta etapa** (gate `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1` em `montarConsolidadoProfor2022Local`) |
| Remoção ampla das rotas/serviços de workbook | **fora desta etapa**; exigiria frente dedicada com plano de descontinuação |

## 3. Achados

Os 5 pontos auditados nesta etapa, na ordem do escopo declarado:

| # | Arquivo | Ponto | Observação |
|---|---|---|---|
| 1 | `backend/server.js` | `carregarWorkbookProfor2022` (linha 295) e `montarConsolidadoProfor2022Local` (linha 304) | Lê workbook **sem verificar** `PROFOR_2022_ORIGEM_DADOS`. O endpoint `GET /api/profor-2022/consolidado` (linha 581) chamava essa função e retornava dados extraídos da planilha antiga mesmo com origem ativa `reconstrucao-pad`. **Fallback silencioso perigoso.** |
| 2 | `backend/server.js` | `montarComparacaoOrigensProfor2022Local` (linha 314) → endpoint `GET /api/profor-2022/comparar-origens` | Lê workbook **por desenho** — compara `planilha` × `banco-cache`. **Fallback explícito de desenvolvimento.** |
| 3 | `backend/services/dashboard-publication-service.js` | `montarDadosProfor2022Publicacao` (linha 564) | Já tem 3 branches por origem (`reconstrucao-pad`, `planilha` explícita, `banco-cache`). O branch `reconstrucao-pad` **não** faz fallback silencioso para planilha. **Fallback explícito por branch.** |
| 4 | `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` | `carregarPlanoAplicacaoLocal` (linha 47) e seu uso em `executarEtapaConsolidado` (linha 228) | Lê workbook ignorando origem ativa, mas faz parte do orquestrador `atualizar:profor-2022`, **já proibido** pelos roteiros de ativação/publicação controladas (aciona Transferegov). **Não mexer por risco alto** (mantido). |
| 5 | `tests/services/profor-pad-origem-reconstrucao.test.js` | Casos que aceitam `planilha` e `banco-cache` como origens válidas | Apenas compatibilidade de teste; preserva a propriedade do `normalizarOrigemDadosProfor2022` de aceitar as três origens. **Compatibilidade de teste.** |

## 4. Classificação

| Classificação | Itens |
|---|---|
| Fallback silencioso perigoso | (#1) `montarConsolidadoProfor2022Local` (server.js) |
| Fallback explícito de desenvolvimento | (#2) `montarComparacaoOrigensProfor2022Local`; (#3) `dashboard-publication-service.montarDadosProfor2022Publicacao` |
| Não mexer por risco alto | (#4) `profor-atualizacao-consolidada-service.carregarPlanoAplicacaoLocal` |
| Compatibilidade de teste | (#5) `tests/services/profor-pad-origem-reconstrucao.test.js` |
| Histórico (preservado) | relatórios dry-run anteriores, `historico-erros.md`, snapshots PAD |
| Documentação obsoleta | nenhum — já tratado nos commits anteriores |

## 5. O que foi bloqueado nesta etapa

Adicionada função `assertWorkbookFallbackPermitido(contexto)` em `backend/server.js`. Chamada na entrada de `montarConsolidadoProfor2022Local`. Comportamento:

- Se `PROFOR_2022_ORIGEM_DADOS` ≠ `reconstrucao-pad` → não age (preserva fluxo legado para `planilha` e `banco-cache`).
- Se `PROFOR_2022_ORIGEM_DADOS` = `reconstrucao-pad` **e** `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` ≠ `1` → lança erro claro orientando o operador a definir a flag para uso temporário de desenvolvimento ou descontinuar o caminho em produção.
- Se `PROFOR_2022_ORIGEM_DADOS` = `reconstrucao-pad` **e** `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` = `1` → permite, mantendo fluxo legado disponível para inspeção dev sob aviso explícito.

`.env.example` recebeu o novo gate documentado com aviso de uso temporário.

## 6. O que foi mantido como fallback explícito

- `montarComparacaoOrigensProfor2022Local` (`/api/profor-2022/comparar-origens`): comparação `planilha` × `banco-cache` por desenho. Comentário inline reforça que é fallback explícito de desenvolvimento e **não** está sujeito ao gate (a comparação só faz sentido lendo as duas fontes).
- `montarDadosProfor2022Publicacao` em `dashboard-publication-service.js`: já estruturado por branch de origem com semântica explícita; sem alteração.

## 7. O que foi mantido como histórico

- Relatórios dry-run anteriores (`backend/data/relatorios/*`).
- `memoria/09_ERROS_E_CORRECOES/historico-erros.md`.
- Snapshots PAD (atual e anterior oficial).
- Decisões, divergências e logs.

## 8. O que NÃO foi alterado por risco

- `backend/services/profor-2022/profor-atualizacao-consolidada-service.js::carregarPlanoAplicacaoLocal` — caminho do orquestrador `atualizar:profor-2022`, que já é **proibido** pelos roteiros de ativação/publicação controladas. Mexer aqui exigiria frente dedicada com plano de descontinuação do orquestrador.
- `frontend/data/publicados/aplicacao.json` e `backend/data/aplicacao.json` (campo `arquivoPlanilhaConvenios`) — fora do escopo e sob restrição absoluta de não alterar publicados.

## 9. Risco residual

Baixo. Após o patch:

- O endpoint `/api/profor-2022/consolidado` deixa de devolver dados silenciosamente extraídos da planilha quando a origem ativa é `reconstrucao-pad`.
- `comparar-origens` continua funcionando (uso legítimo de comparação).
- O orquestrador `atualizar:profor-2022` permanece com leitura de workbook, mas é cercado por proibição operacional nos roteiros vigentes.
- Risco remanescente principal: alguém com acesso ao servidor pode setar `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1` por engano. Mitigação: `.env.example` documenta uso "NUNCA sem aviso" e mensagem do erro orienta a descontinuação em produção.

## 10. Critérios para futura descontinuação

Quando todas as condições abaixo forem atendidas, abrir frente dedicada para remover o caminho de workbook em `montarConsolidadoProfor2022Local` e `carregarPlanoAplicacaoLocal`:

1. Endpoint `/api/profor-2022/consolidado` reescrito para consumir a origem ativa via `montarDadosProfor2022Publicacao`, eliminando a chamada local independente.
2. Orquestrador `atualizar:profor-2022` aposentado ou completamente refatorado para consumir a origem ativa.
3. Janela de descontinuação anunciada com pré-aviso e backup completo de `frontend/data/publicados/` e SQLite.
4. Roteiro próprio com critérios de sucesso, parada e rollback.

## 11. Validações

- `git diff --check` → limpo (apenas avisos LF/CRLF).
- `npm run validar:syntax` → 100 arquivos OK.
- `npm run validar:services` → 225/225 passando (sem regressão).
- `npm run profor:pad:reconstruir-plano:dry-run` → 568 linhas / 15 convênios (sem regressão).
- `npm run profor:pad:comparar-plano:dry-run` → diferença líquida saldo preservada.
- `npm run profor:pad:comparar-snapshots:dry-run` → 568 iguais / 0 novos / 0 removidos / 6 ruídos controlados / 76 bloqueios técnicos (mesma fotografia da etapa anterior).
- Teste ao vivo do gate (sem subir servidor): com `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` no `.env` e sem flag → erro claro disparado; com flag = `1` → liberado.

## 12. Rollback

`git revert <commit_fix>` reverte o gate. `git revert <commit_docs>` reverte este relatório e o diário. Não apagar relatórios históricos, snapshots, decisões, divergências ou logs.

## 13. Próximos passos

1. Reescrita do endpoint `/api/profor-2022/consolidado` para consumir a origem ativa via `montarDadosProfor2022Publicacao` (eliminando a função local independente). Frente dedicada.
2. Frente dedicada para descontinuação do `profor-atualizacao-consolidada-service.carregarPlanoAplicacaoLocal` em conjunto com a aposentadoria do orquestrador `atualizar:profor-2022`.
3. Avaliar gate `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` em modo produção (por padrão, sem flag, o gate já protege; pode ser endurecido para falhar sempre em ambiente identificado como produção, em frente futura).
