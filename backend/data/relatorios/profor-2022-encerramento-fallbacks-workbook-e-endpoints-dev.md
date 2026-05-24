# PROFOR 2022 — Encerramento de fallbacks workbook e endpoints dev/auditoria

## 1. Contexto

A migração funcional da planilha antiga por abas/UF para PAD/reconstrução já foi concluída. Esta frente encerra pendências técnicas remanescentes: exposição de endpoint dev com workbook, variável dedicada de ambiente, aposentadoria do comando operacional legado e política de endpoints.

## 2. Correção da ressalva sobre `comparar-origens`

A documentação anterior dizia que `/api/profor-2022/comparar-origens` passava por gate, mas o código ainda chamava workbook diretamente. A rota agora chama `assertEndpointDevPermitido("api_profor_2022_comparar_origens")` antes de ler catálogo, workbook ou plano.

Resultado:
- em produção, bloqueia sempre;
- em desenvolvimento, exige `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1`;
- em erro de bloqueio, retorna HTTP 403 com mensagem explícita;
- continua existindo apenas como ferramenta dev/auditoria.

## 3. Detecção de produção com `FOMENTO_AMBIENTE`

O guard central `profor-workbook-fallback-guard-service.js` passou a reconhecer `FOMENTO_AMBIENTE` além de `NODE_ENV`, `APP_ENV` e `AMBIENTE`.

Valores reconhecidos como produção:
- `producao`
- `produção`
- `production`
- `prod`

A detecção é conservadora: se qualquer variável indicar produção, o ambiente é tratado como produção, mesmo que outra diga `development`.

## 4. Estado final de `/api/profor-2022/consolidado`

Permanece endpoint operacional. Usa `montarConsolidadoProfor2022PorOrigemAtiva()`.

Com `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad`, consome `montarDadosProfor2022Publicacao` no branch PAD/reconstrução, sem workbook.

## 5. Estado final de `/api/profor-2022/comparar-origens`

Classificação: dev/auditoria.

Política:
- bloqueado em produção;
- liberado em desenvolvimento apenas com `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1`;
- não é fluxo operacional;
- pode ler workbook porque seu objetivo é comparar a origem legada com a origem consolidada.

## 6. Estado final de `atualizar:profor-2022`

O comando npm ordinário foi aposentado. Agora aponta para `backend/scripts/bloquear-atualizar-profor-2022-legado.js`, que falha imediatamente com exit code `2`, sem ler `.env`, sem inicializar banco, sem workbook e sem Transferegov.

O script legado foi preservado apenas em `profor:legado:atualizar-consolidado:dev`, ainda bloqueado pelo guard e proibido em produção.

## 7. Estado final de `carregarPlanoAplicacaoLocal`

Mantida como legado interno do orquestrador descontinuado. Não é alcançável por execução ordinária porque `atualizarProfor2022Consolidado()` bloqueia cedo via `assertOrquestradorLegadoPermitido`.

## 8. Estado final de `montarConsolidadoProfor2022Local`

Mantida como legado interno para caminhos explícitos de desenvolvimento/fallback. O endpoint operacional `/api/profor-2022/consolidado` usa origem ativa; quando a origem é `reconstrucao-pad`, não chama workbook.

## 9. Política de endpoints dev/auditoria

Classificação mínima:

| Endpoint | Classe | Política |
| --- | --- | --- |
| `GET /api/profor-2022/origem` | operacional/leitura | Permitido; não lê workbook. |
| `GET /api/profor-2022/consolidado` | operacional | Deve respeitar origem ativa; sem fallback silencioso para workbook em `reconstrucao-pad`. |
| `GET /api/profor-2022/comparar-origens` | dev/auditoria | Bloqueado em produção; em dev exige `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1`. |
| `POST /api/profor-2022/detru/atualizar` | atualização operacional sensível | Fora do escopo desta frente; não executado. Requer frente própria de governança. |
| `POST /api/profor-2022/rendimentos/atualizar` | atualização operacional sensível | Fora do escopo desta frente; não executado. Aciona Transferegov. |
| `POST /api/profor-2022/atualizar` | legado/descontinuado | Protegido por `assertOrquestradorLegadoPermitido`; proibido em produção. |

Regras:
- endpoint operacional deve respeitar origem ativa;
- endpoint dev/auditoria não pode ler workbook em produção;
- endpoint legado não deve ser comando ordinário;
- endpoint que aciona Transferegov precisa de frente própria;
- `comparar-origens` não pode ser usado como fluxo operacional.

## 10. Arquivos alterados

- `backend/services/profor-2022/profor-workbook-fallback-guard-service.js`
- `backend/server.js`
- `backend/scripts/bloquear-atualizar-profor-2022-legado.js`
- `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`
- `package.json`
- `.env.example`
- `scripts/validar-syntax.js`
- `tests/services/profor-workbook-fallback-guard.test.js`

## 11. Testes executados

- `node --test tests/services/profor-workbook-fallback-guard.test.js`
- `npm run validar:services`

Coberturas adicionadas:
- `FOMENTO_AMBIENTE` em valores de produção;
- variáveis contraditórias tratadas como produção;
- flags permissivas bloqueadas em produção;
- endpoint dev bloqueado/liberado conforme política;
- `atualizar:profor-2022` apontando para wrapper aposentado;
- wrapper aposentado falhando cedo com exit code `2`.

## 12. Validações executadas

- `git diff --check`
- `npm run validar:syntax`
- `npm run validar:services`
- `npm run profor:pad:reconstruir-plano:dry-run`
- `npm run profor:pad:comparar-plano:dry-run`
- `npm run profor:pad:comparar-snapshots:dry-run`
- `node backend/scripts/bloquear-atualizar-profor-2022-legado.js`

## 13. Preservações

- Sem publicação de dados.
- `frontend/data/publicados/` preservado.
- `.env` preservado e não exibido.
- SQLite/WAL/SHM preservados.
- Sem migration.
- Sem decisão por SQL direto.
- Fila oficial real preservada.
- Decisões, divergências, logs, snapshots e relatórios históricos preservados.
- Transferegov não acionado.
- `planoAplicacao` oficial preservado.

## 14. Risco residual

Baixo a moderado:
- `carregarPlanoAplicacaoLocal` e `montarConsolidadoProfor2022Local` ainda existem por compatibilidade de legado/auditoria dev;
- `POST /api/profor-2022/detru/atualizar` e `POST /api/profor-2022/rendimentos/atualizar` seguem como endpoints sensíveis fora desta frente;
- uma política futura pode aplicar gates administrativos específicos a esses endpoints.

## 15. Rollback

1. `git revert <commit_docs>`
2. `git revert <commit_aposentadoria>`
3. `git revert <commit_guard>`

Depois, reexecutar `npm run validar:syntax` e `npm run validar:services`. Não apagar relatórios históricos, decisões, divergências, logs ou snapshots.

## 16. Próximos passos

1. Definir governança específica para endpoints que acionam DETRU/Transferegov.
2. Planejar remoção definitiva de `carregarPlanoAplicacaoLocal` e `montarConsolidadoProfor2022Local` quando a auditoria dev por workbook for aposentada.
3. Avaliar autenticação/autorização administrativa para endpoints sensíveis em ambiente local/API.
