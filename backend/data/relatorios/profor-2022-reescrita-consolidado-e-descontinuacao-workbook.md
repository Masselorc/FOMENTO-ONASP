# PROFOR 2022 — Reescrita do consolidado por origem ativa + descontinuação do orquestrador legado + endurecimento em produção

## 1. Contexto

Esta frente substitui o último fallback operacional silencioso por workbook (planilha antiga) no fluxo PROFOR 2022. Atua em três frentes complementares:

1. O endpoint `GET /api/profor-2022/consolidado` passa a consumir a origem ativa via `montarDadosProfor2022Publicacao`, em vez de ler a planilha antiga incondicionalmente.
2. O orquestrador legado `atualizar:profor-2022` (que aciona Transferegov e lê workbook via `carregarPlanoAplicacaoLocal`) ganha gate explícito de descontinuação.
3. As duas flags de bypass (`ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` e `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO`) ficam **proibidas em produção** mesmo quando explicitamente setadas.

## 2. Relação com o ciclo anterior de limpeza

Esta etapa fecha as "próximas frentes dedicadas" deixadas em aberto em `profor-2022-auditoria-final-fallback-workbook.md` (commit `6bf047a`):

- Reescrita do `/api/profor-2022/consolidado` para consumir origem ativa via `montarDadosProfor2022Publicacao`.
- Descontinuação do `carregarPlanoAplicacaoLocal` em conjunto com a aposentadoria do orquestrador `atualizar:profor-2022`.
- Endurecimento do gate `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` para falhar em produção mesmo com a flag.

## 3. Problema identificado

- O endpoint `/api/profor-2022/consolidado` chamava `montarConsolidadoProfor2022Local`, que sempre lia workbook independentemente da `PROFOR_2022_ORIGEM_DADOS`. O gate adicionado no commit `ad55672` bloqueava a leitura quando origem ativa era `reconstrucao-pad`, mas o endpoint não tinha alternativa funcional — quebrava o `/consolidado` em vez de retornar o consolidado correto.
- O orquestrador `atualizar:profor-2022` continuava executável sem aviso; mesmo com proibição declarada nos roteiros, qualquer chamada acidental (script, agendador, endpoint `POST /api/profor-2022/atualizar`) acionaria Transferegov e leitura de workbook.
- O gate `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1` liberava workbook em qualquer ambiente — sem freio para produção.

## 4. Risco

- **Antes**: operadores podiam ver o `/consolidado` reflexão da planilha antiga (após `ad55672`, esse endpoint quebrava com origem `reconstrucao-pad` em vez de devolver dado correto). Setar a flag de bypass em produção liberava silenciosamente o caminho legado.
- **Após o patch**: `/consolidado` reflete a origem ativa real; flags só funcionam em desenvolvimento; orquestrador legado falha cedo, antes de qualquer chamada externa.

## 5. Correção aplicada em `/api/profor-2022/consolidado`

Nova função `montarConsolidadoProfor2022PorOrigemAtiva()` em `backend/server.js`:

- Resolve `PROFOR_2022_ORIGEM_DADOS`.
- Se `reconstrucao-pad`: chama `montarDadosProfor2022Publicacao(null, catalogo, { origemDados: "reconstrucao-pad" })`. O serviço, nesse branch, lê o relatório de reconstrução PAD via `carregarPlanoAplicacaoReconstrucaoPad`, sem tocar workbook.
- Se `banco-cache` ou `planilha`: cai no `montarConsolidadoProfor2022Local` legado (sob o gate centralizado).
- Se origem inesperada: erro explícito.

O endpoint `GET /api/profor-2022/consolidado` agora consome essa função e propaga `origemDados` e `origemDadosEfetiva` ao cliente, sem hardcoded `"banco-cache"`. Também foi atualizado o segundo uso (linha do endpoint `/origem`, coleta de `diagnosticoConsolidado`) para a mesma função.

## 6. Tratamento dado a `montarConsolidadoProfor2022Local`

Preservada como **legado interno**. Continua disponível para:
- O caminho `banco-cache`/`planilha` no wrapper acima.
- O endpoint `/api/profor-2022/comparar-origens` (que compara planilha × banco-cache por desenho).

Acessada apenas após passar pelo gate centralizado (`assertWorkbookFallbackPermitido`), que agora também falha em produção mesmo com flag.

## 7. Tratamento dado a `comparar-origens`

**Mantido sem alteração funcional.** Continua sendo a ferramenta explícita de desenvolvimento para comparar `planilha` × `banco-cache`. Quando origem ativa é `reconstrucao-pad`, o caminho ainda passa pelo gate (via `montarConsolidadoProfor2022Local` interno) e exige `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1` em dev — proibido em produção.

## 8. Tratamento dado a `carregarPlanoAplicacaoLocal`

**Não removida.** A função permanece como dependência interna do orquestrador `atualizar:profor-2022`, agora cercada pelo gate de descontinuação do orquestrador. Como `atualizarProfor2022Consolidado` falha cedo (no novo `assertOrquestradorLegadoPermitido`), `carregarPlanoAplicacaoLocal` não é mais alcançável por execução ordinária. Será removida quando o orquestrador for definitivamente aposentado.

## 9. Tratamento dado a `atualizar:profor-2022`

Adicionado `assertOrquestradorLegadoPermitido(contexto)` em dois pontos:
1. No início do script `backend/scripts/atualizar-profor-2022-consolidado.js` (falha cedo, antes de tocar banco).
2. No início do serviço `atualizarProfor2022Consolidado` (defesa em profundidade — protege agendador, endpoint `POST /api/profor-2022/atualizar` e qualquer outro caller).

Mensagem em dev: "está em descontinuação; para execução pontual em desenvolvimento, defina `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1`". Em produção: "PROIBIDA em produção: aciona Transferegov e lê workbook. ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO não libera em produção". A documentação inline do script foi atualizada para declarar o caminho como legado/descontinuação.

## 10. Regra de produção para `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` e `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO`

Novo módulo `backend/services/profor-2022/profor-workbook-fallback-guard-service.js` centraliza:

- `isAmbienteProducao(env?)` — detecta produção quando:
  - `NODE_ENV` ∈ {`production`, `prod`}, ou
  - `APP_ENV` ∈ {`production`, `prod`, `producao`}, ou
  - `AMBIENTE` ∈ {`producao`, `production`, `prod`}.
- `assertWorkbookFallbackPermitido(contexto, opcoes?)` — em produção falha sempre; em dev, exige `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1` quando origem ativa é `reconstrucao-pad`.
- `assertOrquestradorLegadoPermitido(contexto, opcoes?)` — em produção falha sempre; em dev, exige `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1`.

Documentação atualizada no `.env.example`.

## 11. Arquivos alterados

- `backend/services/profor-2022/profor-workbook-fallback-guard-service.js` (novo).
- `backend/server.js` (remove gate inline duplicado, importa do guard service; adiciona `montarConsolidadoProfor2022PorOrigemAtiva`; endpoint `/consolidado` e coleta de diagnóstico passam a usar o wrapper).
- `backend/scripts/atualizar-profor-2022-consolidado.js` (gate cedo + cabeçalho atualizado para "LEGADO/DESCONTINUAÇÃO").
- `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` (gate em defesa em profundidade dentro de `atualizarProfor2022Consolidado`).
- `.env.example` (gates documentados com regra de produção).
- `scripts/validar-syntax.js` (novo módulo incluído).
- `tests/services/profor-workbook-fallback-guard.test.js` (novo; 19 testes).

## 12. Testes executados

- `tests/services/profor-workbook-fallback-guard.test.js` — 19 casos cobrindo:
  - `isAmbienteProducao` reconhece `NODE_ENV`, `APP_ENV`, `AMBIENTE`; rejeita dev/staging/teste/vazio.
  - Workbook gate: não age para `planilha`/`banco-cache`; bloqueia `reconstrucao-pad` sem flag em dev; libera com flag em dev; bloqueia em produção mesmo com flag (via NODE_ENV, APP_ENV ou AMBIENTE); flag != `"1"` (`"true"`, `"0"`, etc.) não libera.
  - Orquestrador gate: bloqueia sem flag em dev; libera com flag em dev; bloqueia em produção mesmo com flag.
  - Contexto aparece em ambas as mensagens.
  - Garantia estrutural: o módulo não importa SQLite/dotenv/publicar-*/Transferegov; não escreve arquivos.
- Suíte completa: **244/244** testes passando.

## 13. Validações executadas

- `npm run validar:syntax` → 101 arquivos OK (novo módulo incluído).
- `npm run validar:services` → 244/244.
- `npm run profor:pad:reconstruir-plano:dry-run` → 568 linhas / 15 convênios preservados.
- `npm run profor:pad:comparar-plano:dry-run` → diferença líquida saldo idêntica (`-15043.84`).
- `npm run profor:pad:comparar-snapshots:dry-run` → 568/0/0/6 ruídos/76 bloqueios técnicos (mesma fotografia).
- `git diff --check` → limpo (apenas avisos LF/CRLF).
- Comandos proibidos (`publicar:profor-2022`, `atualizar:profor-2022`, `publicar:dados`) **não executados**.

## 14. Preservações

- `frontend/data/publicados/` intacto.
- `backend/data/onasp.sqlite`, WAL, SHM intactos e não versionados.
- `.env` inalterado.
- Snapshots PAD (atual e anterior oficial) intactos.
- `planoAplicacao` oficial inalterado.
- Fila oficial real inalterada.
- Decisões, divergências, logs e relatórios históricos preservados.
- Transferegov não acionado.
- `comparar-origens` mantido como ferramenta dev (sem alteração funcional).

## 15. Risco residual

Baixo. Pontos remanescentes:

- `carregarPlanoAplicacaoLocal` ainda existe no código (acessível apenas via orquestrador legado, agora gateado). Sua remoção definitiva exige aposentadoria total do orquestrador em frente própria.
- Operador com acesso ao servidor de produção poderia setar `NODE_ENV=development` para burlar a detecção. Mitigação: configuração de ambiente de produção deve fixar `NODE_ENV=production` no nível do runtime/serviço.
- Gate só atua nos pontos onde foi explicitamente chamado. Nenhum novo caminho de leitura de workbook deve ser criado sem chamar `assertWorkbookFallbackPermitido`.

## 16. Rollback

- `git revert <commit_fix>` reverte código + gate em ambos os scripts/serviços.
- `git revert <commit_docs>` reverte este relatório e o diário.
- Não apagar relatórios históricos, snapshots, decisões, divergências ou logs.

## 17. Próximos passos

1. Aposentadoria definitiva do orquestrador `atualizar:profor-2022` quando o fluxo PAD/reconstrução cobrir 100% das necessidades operacionais. Plano dedicado com janela e backup.
2. Remoção de `carregarPlanoAplicacaoLocal` e `montarConsolidadoProfor2022Local` no mesmo movimento da aposentadoria do orquestrador.
3. Avaliar variável dedicada de ambiente (ex.: `FOMENTO_AMBIENTE=producao`) caso `NODE_ENV` se mostre insuficiente em algum deploy específico.
4. Considerar gate similar para o endpoint `comparar-origens` (atualmente exposto sob a mesma API; talvez restringi-lo por permissão/sessão em produção).
