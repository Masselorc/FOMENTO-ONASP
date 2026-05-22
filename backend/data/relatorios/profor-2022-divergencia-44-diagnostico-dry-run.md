# PROFOR 2022 — Diagnóstico técnico da divergência #44 (dry-run)

Gerado em: 2026-05-22
Modo: dry-run — somente leitura. Não publica, não registra decisão, não altera status, não altera a origem ativa, não altera o `planoAplicacao` oficial e não altera o SQLite versionado.

## 1. Divergência-alvo

| Campo | Valor |
|---|---|
| Divergência | #44 |
| Convênio / UF | 938128 / SP |
| Tipo de alerta | `item_nao_apto` |
| Chave do item | `938128::SALDO RESIDUAL` |
| Status | ACEITO |
| Decisão | #186 (`usuario-local`, `liberacao_item_nao_apto`, `liberarUsoDryRun: true`) |
| `aplicadaAoPlano` | false (confirmado) |
| Snapshot de segurança | presente; hash `1c2ba2d2…f960f0e` |
| Payload alterado após a decisão | **Não** (hash atual = hash do snapshot) |

## 2. Problema encontrado

A #44 estava classificada como `saldo_residual_natureza_divergente` / `pendencia_operacional_real` com a evidência *"Natureza PAD 'CUSTEIO' sem rateio de mesma natureza na memória (rateios: 'CAPITAL')"*. Essa evidência era **enganosa**: sugeria que o PAD novo não teria correspondente CAPITAL para o saldo residual da memória.

Investigação dos relatórios PAD (`profor-2022-pad-rateios-dry-run.json` → `itensPadReconhecidos`) mostra que o PAD novo do convênio 938128/SP tem **DUAS** linhas "Saldo Residual" para a mesma chave de item:

| Linha PAD | Natureza | Cód. natureza | Valor previsto |
|---|---|---|---:|
| aba 938128, **linha 19** | CUSTEIO | 33903099 | R$ 71,36 |
| aba 938128, **linha 61** | CAPITAL | 44905299 | **R$ 20.704,73** |

A linha PAD CAPITAL (R$ 20.704,73), de **mesma natureza** da memória, **existe** — e foi inclusive usada na reconstrução dry-run. O alerta de "natureza divergente" era um falso positivo de pareamento.

## 3. Causa técnica (2 bugs sistêmicos de pareamento)

### Bug A — reconstrução

`gerarLinhasItem` (em `profor-pad-plano-reconstrucao-service.js`) é chamada **uma vez por linha PAD**, mas recebe os rateios do `itemConhecidoId`. As duas linhas PAD da chave `938128::SALDO RESIDUAL` compartilham o item conhecido #212, cujos rateios são todos CAPITAL.

Ao processar a linha PAD **CUSTEIO**, a regra `!naturezasRateio.has(naturezaPad)` disparava o impedimento `saldo_residual_natureza_divergente` — porque "CUSTEIO" não estava entre os rateios CAPITAL da memória. Mas cada linha PAD de saldo residual é de uma natureza própria e o PAD é a fonte de verdade da reconstrução: ter uma parcela CUSTEIO no PAD não é divergência de reconstrução.

### Bug B — auditor de saldos residuais / auditoria profunda

O auditor de saldos residuais (`detectarMisturas`) só reclassifica uma mistura CAPITAL/CUSTEIO como falso positivo se a divergência estiver em `fechadosPorNatureza`, conjunto derivado de `comparacaoSaldoResidualPorNatureza`. Esse campo era calculado pelo auditor de item não apto **apenas para divergências analisáveis** — divergências já decididas (status ACEITO) caíam em `ja_decidido` **sem** a comparação por natureza. Sem o dado, a #44 caía sempre em `saldo_residual_natureza_divergente`.

## 4. Evidência objetiva

- `payload_json` da #44: bloco `pad` traz `natureza: CUSTEIO, valorPrevisto: 71.36` (linha 19) — escolhe apenas uma das duas linhas PAD; os `rateiosAtivos` são ambos CAPITAL.
- `profor-2022-pad-rateios-dry-run.json` → `itensPadReconhecidos`: duas linhas "Saldo Residual" (19 CUSTEIO, 61 CAPITAL) com a mesma `chaveItem`.
- Reconstrução dry-run: gerou as duas linhas `938128::SALDO RESIDUAL` — CAPITAL R$ 20.704,73 (linha 61) e CUSTEIO R$ 71,36 (linha 19), ambas com `origemReconstrucao: relatorios-pad-rateados`.
- Decisão #186: hash do payload no momento da decisão = hash atual → payload não alterado após a decisão.

## 5. Divergência material remanescente (a #44 continua pendência real)

Corrigido o pareamento, **persiste uma divergência material legítima**:

| Natureza | Memória | PAD | Diferença |
|---|---:|---:|---:|
| CAPITAL | R$ 22.351,09 | R$ 20.704,73 | **−R$ 1.646,36** |
| CUSTEIO | (sem parcela na memória) | R$ 71,36 | parcela nova no PAD |
| **Total** | R$ 22.351,09 | R$ 20.776,09 | −R$ 1.575,00 |

Análise adicional: a parcela de **R$ 71,36** existe nos dois lados — na memória estava no rateio "NAO INFORMADO" marcada como **CAPITAL**, no PAD novo aparece como **CUSTEIO** (linha 19). É a mesma parcela **reclassificada de natureza**. Considerando essa reclassificação, a divergência material líquida da natureza CAPITAL é de **R$ 1.575,00** (memória R$ 22.279,73 → PAD R$ 20.704,73).

Em qualquer leitura — natureza reclassificada ou valor reduzido — há divergência material real que a decisão #186 não resolve no mérito. **A #44 permanece `pendencia_operacional_real`.**

## 6. Impacto prático

- **Reconstrução**: o impedimento `saldo_residual_natureza_divergente` deixou de ser gerado (era falso). Impedimentos caíram de **34 para 33**. A linha CUSTEIO passou a ser reconstruída normalmente, com um alerta informativo de rastreabilidade.
- **Comparador**: inalterado — já classificava corretamente (CAPITAL como `diferenca_esperada_por_atualizacao_pad`, CUSTEIO como item novo). 30 diferenças críticas.
- **Auditoria profunda**: `pendencia_operacional_real` permanece **1** (#44). A correção **não mascarou** a pendência real — a #44 continua bloqueada por divergência material.

## 7. Correção aplicada

1. `profor-pad-plano-reconstrucao-service.js`: o impedimento `saldo_residual_natureza_divergente` para linha PAD de saldo residual sem rateio de mesma natureza na memória foi substituído por **alerta informativo** `saldo_residual_natureza_sem_rateio_memoria`. O PAD é a fonte de verdade da reconstrução; a divergência material por natureza é aferida pelo comparador.
2. `auditar-item-nao-apto-sem-divergencia-pad-profor-2022.js`: divergências de saldo residual **já decididas** passam a carregar `comparacaoSaldoResidualPorNatureza`, permitindo que outros auditores avaliem o fechamento por natureza mesmo após decisão registrada.
3. `auditar-saldos-residuais-profor-2022.js`: `detectarMisturas` passou a ler o mapa completo de comparações por natureza (incluindo `jaDecididos`); rateio por área operacional mantém precedência como impedimento técnico.
4. Teste novo: `tests/services/profor-saldo-residual-pareamento-44.test.js` (7 casos).

## 8. Classificação final da #44

**`pendencia_operacional_real`** — confirmada.

Critério técnico: a #44 só deixaria de ser pendência operacional real se houvesse evidência objetiva de que o saldo residual CAPITAL de R$ 22.351,09 tem correspondente PAD de mesma natureza e valor, foi redistribuído de forma rastreável ou eliminado por decisão documentada. O correspondente PAD de mesma natureza **existe** (CAPITAL R$ 20.704,73), mas **com valor menor** — há divergência material de R$ 1.575,00 (CAPITAL) e uma parcela de R$ 71,36 reclassificada CAPITAL→CUSTEIO. A decisão #186 (liberação de item não apto) não resolve esse mérito material.

## 9. Decisão recomendada (não registrada — exige decisão humana)

Esta auditoria **não registra decisão**. Recomendação para tarefa futura autorizada:

- **Não reverter** a decisão #186: ela apenas libera o item não apto para uso dry-run e está corretamente registrada (snapshot íntegro). A liberação do item não é o problema.
- **Esclarecer o mérito material** da natureza CAPITAL: confirmar com a área se a redução de R$ 1.575,00 e a reclassificação da parcela de R$ 71,36 CAPITAL→CUSTEIO refletem ajuste real do PAD 2022 do convênio 938128/SP.
- Se confirmado ajuste legítimo do PAD: registrar **decisão retificadora** documentando a divergência memória×PAD por natureza, pelo fluxo do serviço de revisão (`registrarDecisao`), sem alterar a origem ativa.
- Se não confirmado: manter a #44 como pendência aberta até o esclarecimento.

## 10. Efeito esperado

- **Reconstrução dry-run**: 33 impedimentos (1 a menos); linha CUSTEIO reconstruída com alerta informativo.
- **Comparador**: sem alteração de comportamento.
- **Auditoria profunda**: `pendencia_operacional_real = 1` (#44) — inalterado.

## 11. Risco de regressão

Baixo. A correção da reconstrução apenas troca um impedimento por alerta informativo para um padrão específico (saldo residual com linha PAD de natureza ausente nos rateios). O caso de **rateio por área operacional** continua impeditivo (coberto por teste). A mudança no auditor de item não apto é aditiva (computa um campo a mais para itens já decididos). Suíte: 111 testes, 111 aprovados.

## 12. Rollback

`git revert <commit>`. Depois regenerar os relatórios dry-run na ordem: reconstrução → item-não-apto → saldos-residuais → segurança → comparador → auditoria profunda. Não apagar decisões, divergências, logs nem relatórios históricos.
