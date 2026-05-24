# PROFOR 2022 — Governança de endpoints externos/dev e limpeza workbook

## 1. Contexto

A migração funcional da planilha antiga por abas/UF para PAD/reconstrução já foi concluída. A frente anterior encerrou os fallbacks workbook operacionais, bloqueou `comparar-origens` em produção e aposentou `atualizar:profor-2022` como comando ordinário.

Esta frente trata a camada remanescente de governança: endpoints e scripts que podem acionar DETRU, Transferegov, processos persistentes de agendamento ou caminhos workbook legados.

## 2. Relação com o encerramento dos fallbacks workbook

O consolidado operacional continua resolvido por origem ativa. Quando a origem é `reconstrucao-pad`, o fluxo usa PAD/reconstrução sem workbook.

Os caminhos workbook remanescentes continuam classificados como legado/dev:
- `GET /api/profor-2022/comparar-origens`: auditoria dev, bloqueada em produção;
- `montarConsolidadoProfor2022Local`: legado interno para `banco-cache`/`planilha` sob guard;
- `carregarPlanoAplicacaoLocal`: legado interno do orquestrador descontinuado.

Não houve remoção física nesta etapa porque ainda existem consumidores controlados e documentados.

## 3. Inventário dos endpoints DETRU/Transferegov

| Endpoint | Serviço acionado | Classificação | Política final |
| --- | --- | --- | --- |
| `GET /api/profor-2022/origem` | leitura local | operacional/leitura | permitido; não aciona rede externa |
| `GET /api/profor-2022/consolidado` | origem ativa | operacional | permitido; sem workbook em `reconstrucao-pad` |
| `GET /api/profor-2022/comparar-origens` | workbook + banco-cache | dev/auditoria | exige `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1` em dev; bloqueado em produção |
| `POST /api/profor-2022/detru/atualizar` | `atualizarCacheDetruProfor2022` | administrativo sensível / externo DETRU | exige `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1` e `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1` em dev; bloqueado em produção e teste |
| `GET /api/profor-2022/detru/ultima-atualizacao` | cache local | operacional/leitura | permitido; não aciona rede externa |
| `POST /api/profor-2022/rendimentos/atualizar` | `executarEtapaRendimentos` / Transferegov | administrativo sensível / externo Transferegov | exige `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1` e `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1` em dev; bloqueado em produção e teste |
| `POST /api/profor-2022/atualizar` | orquestrador legado | legado/descontinuado / externo | exige guards administrativos/externos e ainda passa pelo guard do orquestrador; bloqueado em produção |
| `GET /api/profor-2022/atualizacao/status` | cache local | operacional/leitura | permitido; não aciona rede externa |

## 4. Inventário dos scripts/agendadores

| Script npm | Arquivo | Classificação | Política final |
| --- | --- | --- | --- |
| `atualizar:detru-profor` | `backend/scripts/atualizar-cache-detru-profor-2022.js` | externo DETRU / administrativo sensível | exige `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1`; bloqueado em produção e teste antes de banco/rede |
| `atualizar:rendimentos-profor` | `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js` | externo Transferegov / administrativo sensível | exige `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1`; bloqueado em produção e teste antes de banco/rede |
| `agendar:detru-profor` | `backend/scripts/agendar-atualizacao-detru-profor-2022.js` | agendador / externo DETRU | exige `ALLOW_PROFOR_2022_SCHEDULER=1` e `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1`; bloqueado em produção e teste |
| `agendar:profor-2022` | `backend/scripts/bloquear-agendar-profor-2022-legado.js` | legado/descontinuado | wrapper bloqueador; falha cedo com exit code `2` |
| `profor:legado:agendar-atualizacao:dev` | `backend/scripts/agendar-atualizacao-profor-2022.js` | agendador legado dev | exige `ALLOW_PROFOR_2022_SCHEDULER=1`; bloqueado em produção e teste; o ciclo ainda depende do orquestrador legado |
| `atualizar:profor-2022` | `backend/scripts/bloquear-atualizar-profor-2022-legado.js` | legado/descontinuado | wrapper bloqueador; permanece aposentado |

## 5. Política global para endpoints administrativos/dev

O guard central `profor-workbook-fallback-guard-service.js` passou a cobrir:
- `assertEndpointDevPermitido`;
- `assertEndpointAdminPermitido`;
- `assertChamadaExternaPermitida`;
- `assertAgendadorPermitido`;
- detecção conservadora de produção via `FOMENTO_AMBIENTE`, `NODE_ENV`, `APP_ENV` e `AMBIENTE`;
- detecção de teste para impedir liberação de chamadas externas por flag.

Classes:
- endpoint operacional: pode responder em produção, desde que não acione rede externa nem ignore origem ativa;
- endpoint administrativo: exige `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1` em desenvolvimento e é bloqueado em produção/teste;
- endpoint dev/auditoria: exige `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1` em desenvolvimento e é bloqueado em produção;
- endpoint externo: exige `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1` em desenvolvimento e é bloqueado em produção/teste;
- agendador: exige `ALLOW_PROFOR_2022_SCHEDULER=1` em desenvolvimento e é bloqueado em produção/teste.

## 6. Política para chamadas externas

Chamadas DETRU/Transferegov agora são bloqueadas por padrão:
- em produção: bloqueadas sempre, mesmo com flag;
- em teste: bloqueadas sempre, mesmo com flag;
- em desenvolvimento: exigem `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1`;
- endpoints administrativos que acionam rede exigem também `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1`.

As mensagens de erro indicam o contexto e a justificativa: chamada externa bloqueada por política de governança.

## 7. Política para agendadores

Agendadores não devem iniciar por acidente:
- `agendar:profor-2022` virou wrapper bloqueador;
- o agendador real PROFOR ficou em `profor:legado:agendar-atualizacao:dev` e exige guard;
- `agendar:detru-profor` foi protegido por guard de agendador e chamada externa;
- em produção/teste, flags não liberam.

## 8. Estado final de `/api/profor-2022/comparar-origens`

Permanece dev/auditoria. Continua podendo ler workbook apenas porque seu objetivo é comparar origem legada e origem consolidada. Está bloqueado em produção e não é fluxo operacional.

## 9. Estado final de `/api/profor-2022/consolidado`

Permanece operacional. Usa `montarConsolidadoProfor2022PorOrigemAtiva()`. Em `reconstrucao-pad`, usa `montarDadosProfor2022Publicacao(null, catalogo, { origemDados: "reconstrucao-pad" })`, sem workbook.

## 10. Estado final de `agendar:profor-2022`

A entrada npm ordinária foi bloqueada. O comando agora aponta para `backend/scripts/bloquear-agendar-profor-2022-legado.js`, que falha cedo com exit code `2`, sem banco, rede, workbook, DETRU ou Transferegov.

## 11. Estado final de `atualizar:profor-2022`

Permanece aposentado. Continua apontando para `backend/scripts/bloquear-atualizar-profor-2022-legado.js`.

## 12. Estado final das funções workbook legadas

- `carregarWorkbookProfor2022`: mantida para `comparar-origens` dev/auditoria, bloqueado em produção.
- `montarConsolidadoProfor2022Local`: mantida como legado interno para `banco-cache`/`planilha`, sob `assertWorkbookFallbackPermitido`.
- `carregarPlanoAplicacaoLocal`: mantida como legado interno do orquestrador descontinuado; não é alcançada por comando ordinário.
- `extrairPlanoAplicacaoProforDoWorkbook`: mantida porque também pertence ao serviço de publicação/dashboard legado e não foi alvo de remoção nesta frente.

## 13. O que foi removido fisicamente

Nada foi removido fisicamente. A decisão foi manter consumidores controlados e bloquear pontos de entrada acidentais. O único novo bloqueio físico de entrada operacional foi a troca do script npm `agendar:profor-2022` para wrapper.

## 14. O que foi mantido isolado

- workbook legado: isolado em dev/auditoria e legado interno;
- `agendar-atualizacao-profor-2022.js`: mantido como script legado de desenvolvimento, com guard;
- `agendar-atualizacao-detru-profor-2022.js`: mantido, agora com guard de agendador e chamada externa;
- scripts DETRU/Transferegov: mantidos, agora bloqueados antes de banco/rede sem flag explícita.

## 15. Arquivos alterados

- `backend/services/profor-2022/profor-workbook-fallback-guard-service.js`
- `backend/server.js`
- `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`
- `backend/scripts/atualizar-cache-detru-profor-2022.js`
- `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`
- `backend/scripts/agendar-atualizacao-detru-profor-2022.js`
- `backend/scripts/agendar-atualizacao-profor-2022.js`
- `backend/scripts/bloquear-agendar-profor-2022-legado.js`
- `package.json`
- `.env.example`
- `scripts/validar-syntax.js`
- `tests/services/profor-admin-endpoint-guard.test.js`

## 16. Testes executados

- `node --test tests/services/profor-admin-endpoint-guard.test.js tests/services/profor-workbook-fallback-guard.test.js`
- `npm run validar:services`

## 17. Validações executadas

- `git diff --check`
- `npm run validar:syntax`
- `npm run validar:services`
- `npm run profor:pad:reconstruir-plano:dry-run`
- `npm run profor:pad:comparar-plano:dry-run`
- `npm run profor:pad:comparar-snapshots:dry-run`
- `node backend/scripts/bloquear-agendar-profor-2022-legado.js`

## 18. Preservações

- Sem publicação de dados.
- `frontend/data/publicados/` preservado.
- `.env` preservado e não exibido.
- SQLite/WAL/SHM preservados.
- Sem migration.
- Sem decisão por SQL direto.
- Fila oficial real preservada.
- Decisões, divergências, logs, snapshots e relatórios históricos preservados.
- DETRU real não consultado.
- Transferegov não acionado.
- `planoAplicacao` oficial preservado.

## 19. Risco residual

Baixo a moderado:
- scripts externos continuam existindo para uso local controlado;
- endpoints de leitura de cache permanecem acessíveis, mas não acionam rede externa;
- remoção física dos helpers workbook depende da aposentadoria completa da auditoria dev `comparar-origens` e do serviço legado de publicação/dashboard;
- uma política futura pode substituir flags por autenticação/autorização administrativa mais forte.

## 20. Rollback

1. `git revert <commit_docs>`
2. `git revert <commit_agendador_workbook>`
3. `git revert <commit_guard_admin>`

Depois, reexecutar `npm run validar:syntax` e `npm run validar:services`. Não apagar histórico, decisões, divergências, logs, snapshots ou relatórios.

## 21. Próximos passos

1. Definir autenticação/autorização administrativa para endpoints sensíveis se forem usados fora do ambiente local.
2. Aposentar completamente `comparar-origens` quando a auditoria workbook deixar de ser necessária.
3. Planejar remoção física dos helpers workbook após eliminação de todos os consumidores controlados.
