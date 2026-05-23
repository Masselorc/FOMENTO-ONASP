# PROFOR 2022 — Promoção do snapshot anterior oficial + reconstrução dry-run com rateio fixo (execução em 23/05/2026)

## 1. Contexto

Continuação da frente PAD/PROFOR 2022 sobre política de snapshots e rateio por área + quantidade fixa. Esta etapa promoveu o snapshot atual como **snapshot anterior oficial** (sob aprovação humana expressa), rodou comparação e fila dry-run pós-promoção, e integrou o rateio fixo à reconstrução dry-run em modo simulado (plano original preservado intacto).

Não houve publicação, não houve alteração de origem ativa, não houve alteração do `planoAplicacao` oficial, não houve registro de decisão automática, não houve alteração de banco, não houve acionamento do Transferegov.

## 2. Aprovação humana expressa

> "Autorizo a promoção controlada do snapshot PAD atual como snapshot anterior oficial para fins exclusivos de comparação dry-run futura, sem publicação, sem alteração do plano oficial, sem decisão automática, sem alteração de banco e sem acionamento do Transferegov."

Responsável: Marcelo Cortez. Registrada no commit `7ed2633` (autorização original) e estendida nesta execução com instruções explícitas do projeto.

## 3. Promoção do snapshot anterior oficial

- Script criado: `backend/scripts/promover-snapshot-anterior-oficial-pad-profor-2022.js`.
- Script npm adicionado: `profor:pad:snapshot-anterior:promover`.
- Auditoria prévia (`profor:pad:snapshot-anterior:auditar-promocao:dry-run`): apto estruturalmente; gates de `commit_referencia_ausente` e `aprovacao_humana_ausente` supridos pelo promotor.
- Execução: `npm run profor:pad:snapshot-anterior:promover -- --aprovacao-humana-expressa --responsavel="Marcelo Cortez" --texto-aprovacao="…"`.

### 3.1. Resultado

- Snapshot atual permaneceu intacto.
- Cópia atômica (`.tmp` + `rename`) executada para `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json` e `.md`.
- Registro: `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.json` e `.md`.
- Sobrescrita silenciosa bloqueada pela política.

## 4. Checksum promovido

- **Checksum SHA-256:** `799dae331c4709ec26434e8c01de0218446255783527149c6cb32bb8d9abe678`
- **Commit de referência:** `6e6cbcf56e2662a9ac4e5cc5d3cc9079fdb1831c`
- **Versão do snapshot promovido:** conforme `versaoSnapshot` no registro.
- **Total de linhas:** 568.
- **Total de avisos:** 12 (não-classificados, registrados no relatório de auditoria; não impeditivos).
- **Total de erros críticos:** 0.

## 5. Arquivos criados

- `backend/scripts/promover-snapshot-anterior-oficial-pad-profor-2022.js`
- `backend/services/profor-2022/profor-pad-reconstrucao-rateio-fixo-integracao-service.js`
- `backend/scripts/reconstruir-plano-com-rateio-fixo-pad-profor-2022.js`
- `tests/services/profor-pad-promocao-snapshot-anterior-real.test.js`
- `tests/services/profor-pad-reconstrucao-rateio-fixo-integracao.test.js`
- `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json` (cópia controlada)
- `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.md` (cópia controlada)
- `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.json`
- `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.md`
- `backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.json` (regenerado)
- `backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.md` (regenerado)
- `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.json` (regenerado)
- `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.md` (regenerado)
- `backend/data/relatorios/profor-2022-pad-plano-reconstruido-com-rateio-fixo-dry-run.json`
- `backend/data/relatorios/profor-2022-pad-plano-reconstruido-com-rateio-fixo-dry-run.md`
- `backend/data/relatorios/profor-2022-pad-comparacao-rateio-fixo-vs-reconstrucao-dry-run.json`
- `backend/data/relatorios/profor-2022-pad-comparacao-rateio-fixo-vs-reconstrucao-dry-run.md`
- Este relatório consolidado.

## 6. Comparador pós-promoção

`npm run profor:pad:comparar-snapshots:dry-run`:

- Linhas anterior: 568. Linhas novo: 568.
- Iguais: 555. Novos: 13. Removidos: 13. Alterados: 0.
- Diferenças financeiras líquidas: **R$ 0,00 em previsto, executado e saldo** (snapshots materialmente idênticos).
- Bloqueios técnicos: 81 (colisões de chave 38 + chaves ambíguas 43, herdadas do estado atual; não-impeditivos para a comparação).
- Por UF: TO=8, PB=14, PR=4, "NAO_INFORMADO"=81.

Conclusão: comparador confirma identidade material entre snapshots `anterior` e `atual` (cópia byte-a-byte recém-feita). Os 13 "novos" e 13 "removidos" são reflexos de pares com chave colidente preexistente — não indicam mudança material.

## 7. Fila dry-run pós-promoção

`npm run profor:pad:snapshots:gerar-fila-revisao:dry-run`:

- Status: `fila_gerada`.
- Candidatos: 107 (13 novos + 13 removidos + 81 bloqueios técnicos).
- Bloqueios técnicos: 81.
- **Fila oficial real não foi alterada.** Esta é apenas a fila dry-run derivada da comparação.

## 8. Integração do rateio fixo à reconstrução dry-run

- Serviço criado: `backend/services/profor-2022/profor-pad-reconstrucao-rateio-fixo-integracao-service.js` (adaptador isolado; reconstrutor oficial **não** alterado).
- Script criado: `backend/scripts/reconstruir-plano-com-rateio-fixo-pad-profor-2022.js`.
- Script npm adicionado: `profor:pad:reconstruir-plano-com-rateio-fixo:dry-run`.
- Entrada: plano reconstruído dry-run em `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json`.
- Instruções: amostra controlada gerada pelo script (2 itens multi-linha do plano), porque não existe `profor-2022-pad-rateio-quantidade-fixa-instrucoes.json` em disco.

### 8.1. Regras do rateio aplicadas

- Quantidade é fonte primária; percentual derivado.
- Soma superior à quantidade total ⇒ bloqueio.
- Soma inferior ⇒ saldo não rateado.
- Quantidade negativa ⇒ erro.
- `1.0` permanece `1` (sem inflação para `10`).
- CAPITAL e CUSTEIO não podem ser misturados (bloqueio).
- Valor rateado = quantidade × valor unitário.
- Residual de arredondamento aplicado na última linha simulada.
- Executado distribuído proporcionalmente ao valor previsto rateado.
- Plano original preservado intacto.

## 9. Comparação plano padrão × plano com rateio fixo

`npm run profor:pad:reconstruir-plano-com-rateio-fixo:dry-run`:

- Itens distintos no plano original: 494.
- Instruções recebidas: 2 (amostra controlada).
- Itens com rateio fixo aplicado: 2.
- Itens bloqueados: 0.
- Itens sem instrução (preservados originais): 492.
- Saldo não rateado total: 0.
- Diferença residual total: 0.
- Δ linhas: 0. Δ valor previsto: 0. Δ saldo: 0.

Conclusão: para a amostra-espelho (rateios fixos equivalentes ao rateio atual), a integração é **neutra** — confirma corretude estrutural do adaptador. Para amostras com rateio distinto, o relatório expõe explicitamente bloqueios, saldos não rateados e diferenças residuais sem mascarar nenhum aviso real.

## 10. Bloqueios

- **Promoção:** nenhum impeditivo (após aprovação humana + commit de referência fornecidos).
- **Comparador snapshots:** 81 bloqueios técnicos preexistentes (colisões/ambiguidades de chave em UF=NÃO_INFORMADO), herdados — não-impeditivos para esta etapa.
- **Reconstrução com rateio fixo:** 0 bloqueios na amostra controlada.

## 11. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Promoção sem aprovação humana | Baixa | Crítico | Flag `--aprovacao-humana-expressa` obrigatória; valor `false` por padrão; auditoria prévia bloqueia. |
| R2 | Sobrescrita silenciosa do snapshot anterior oficial | Baixa | Alto | Política proíbe; promotor recusa se anterior já existir (gate `--forcar-sobrescrita`). |
| R3 | Instruções de rateio inválidas (qty negativa, natureza mista) | Média | Médio | Validação no serviço de rateio fixo gera bloqueio explícito (testes cobrem). |
| R4 | Adaptador alterar o plano original | Baixa | Crítico | Cópia defensiva (`clonarLinha`); teste explícito `plano original permanece intacto`. |
| R5 | Tentativa indevida de publicação | Baixa | Crítico | Adaptador não importa scripts de publicação; flag `garantias.publicacaoExecutada=false`. |
| R6 | Acionamento de Transferegov | Baixa | Crítico | Adaptador não importa clientes Transferegov; flag `garantias.transferegovAcionado=false`. |
| R7 | Resíduo de arredondamento gera Δ saldo agregado | Baixa | Médio | Executado distribuído proporcionalmente; teste `residual de arredondamento` cobre. |

## 12. Testes

- `tests/services/profor-pad-promocao-snapshot-anterior-real.test.js` (10 testes): parsearArgs, carregarTextoAprovacao, montarRegistro (com checksum/commit/aprovacao/garantias), montarRegistroMarkdown, recusa quando aprovação ausente, recusa quando anterior já existe, snapshot atual preservado.
- `tests/services/profor-pad-reconstrucao-rateio-fixo-integracao.test.js` (13 testes): chaveItemPad, agruparLinhasOriginalPorItem, plano original intacto, rateio espelho Δ=0, saldo não rateado, soma superior gera bloqueio, qty negativa gera bloqueio, CAPITAL/CUSTEIO misturados bloqueiam, residual fecha, `1.0` permanece `1`, garantias dry-run, itens sem instrução preservados, comparador estrutural.
- **Total:** 23 testes novos, **219/219 testes passando** (`validar:services`).

## 13. Validações

- `validar:syntax` → 100 arquivos OK.
- `validar:services` → 219/219.
- `npm run profor:pad:snapshot-anterior:auditar-promocao:dry-run` → OK (após gates supridos no promotor).
- `npm run profor:pad:snapshot-anterior:promover -- --aprovacao-humana-expressa --responsavel=... --texto-aprovacao=...` → OK.
- `npm run profor:pad:comparar-snapshots:dry-run` → OK (Δ$ = R$ 0,00).
- `npm run profor:pad:snapshots:gerar-fila-revisao:dry-run` → OK (107 candidatos, 81 bloqueios técnicos preexistentes).
- `npm run profor:pad:reconstruir-plano:dry-run` → OK (568 linhas, 15 convênios).
- `npm run profor:pad:comparar-plano:dry-run` → OK (diff líquido inalterado).
- `npm run profor:pad:reconstruir-plano-com-rateio-fixo:dry-run` → OK (Δ$ = 0 para amostra-espelho).
- `git diff --check` → limpo (apenas avisos LF/CRLF).

## 14. Preservações

- `frontend/data/publicados/` → **não alterado**.
- `backend/data/onasp.sqlite` / WAL / SHM → **não alterados, não versionados**.
- `.env` → **não alterado** (origem ativa local permanece `reconstrucao-pad`).
- Snapshot atual (`profor-2022-pad-fotografia-canonica.json`) → **intacto**.
- Reconstrutor oficial (`profor-pad-plano-reconstrucao-service.js`) → **não alterado**.
- Plano reconstruído dry-run oficial (`profor-2022-pad-plano-reconstruido-dry-run.json`) → regenerado pelo `reconstruir-plano:dry-run` (esperado); valores materialmente idênticos.
- Decisões, divergências, logs → **não tocados**.
- Fila de revisão oficial real → **não tocada**.
- Sem SQL direto, sem nova migration, sem rebase/merge/squash automático.

## 15. Rollback

Se necessário reverter:

1. **Apagar o snapshot anterior oficial e os registros:**
   ```
   rm backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json
   rm backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.md
   rm backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.json
   rm backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.md
   ```
2. **Reverter commits** com `git revert <sha>` para cada commit gerado nesta execução. Não usar `git reset --hard`.
3. Reexecutar a bateria dry-run completa (`reconstruir-plano:dry-run`, `comparar-plano:dry-run`, `auditar-pendencias-profundo`, `seguranca-pre-ativacao:final`).
4. Registrar o gatilho no diário; não apagar decisões, logs ou divergências.

## 16. Próximos passos

- Promoção homologada permite, em janela futura separada, comparar snapshot anterior oficial × próxima geração de snapshot (snapshot atual será regenerado quando houver novo PAD).
- Aplicação de rateio fixo a casos reais (não-amostra) exige criação de `backend/data/relatorios/profor-2022-pad-rateio-quantidade-fixa-instrucoes.json` por revisor humano, com aprovação separada.
- Nenhuma integração com fila oficial real está autorizada por esta execução.
- Nenhuma publicação está autorizada por esta execução; publicação continua exigindo roteiro e autorização próprios.
- Automação Transferegov continua fora de escopo.
