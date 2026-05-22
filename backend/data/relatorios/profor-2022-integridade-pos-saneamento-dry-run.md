# PROFOR 2022 — Auditoria integrada de integridade pós-saneamento e segurança pré-ativação (dry-run)

Gerado em: 2026-05-22T19:31:52Z
Modo: dry-run

Auditoria somente leitura. Não publica, não registra decisão, não altera status, não altera a origem ativa, não altera o `planoAplicacao` oficial e não altera o SQLite versionado.

> **Reexecução após correção do pareamento de saldo residual da #44.** Esta auditoria foi regenerada depois de corrigir dois bugs sistêmicos de pareamento de saldo residual: (A) a reconstrução gerava impedimento `saldo_residual_natureza_divergente` falso para a #44 — a linha PAD CAPITAL de mesma natureza existe; (B) o auditor de item não apto não computava a comparação por natureza para divergências já decididas. **A #44 permanece `pendencia_operacional_real`** por divergência material real de valor (CAPITAL R$ 22.351,09 → R$ 20.704,73). Os impedimentos de reconstrução caíram de 34 para 33. Diagnóstico completo em `profor-2022-divergencia-44-diagnostico-dry-run.md`.

## 1. Resumo executivo

| Indicador | Antes | Agora | Critério |
|---|---:|---:|---|
| Pendência operacional real | 2 | **1** | Esperado 0 — ainda não atendido (resta #44, material) |
| Bloqueio técnico de segurança pré-ativação | 35 | 35 | Sem impeditivo por dado oficial alterado |
| Decisão resolutiva com pendência técnica | 7 | 8 | #18 (de auditoria anterior) |
| Impedimentos de reconstrução | 34 | **33** | Falso impedimento da #44 eliminado |
| Apto para preparar ativação controlada | NÃO | **NÃO** | Bloqueios listados abaixo |
| Decisão registrada nesta tarefa | 0 | 0 | OK |
| Dado oficial / publicação alterada | Nenhum | Nenhum | OK |

**Recomendação final: NÃO APTO, com bloqueios listados.** A correção do classificador reduziu `pendencia_operacional_real` de 2 para 1. A pendência remanescente (#44) é divergência material legítima de saldo residual. A base ainda não está apta por causa de #44, dos 35 bloqueios de segurança e dos 34 impedimentos de reconstrução.

## 2. Comandos executados

- `npm run profor:pad:auditar-pendencias-profundo`
- `npm run profor:pad:seguranca-pre-ativacao:dry-run`
- `npm run profor:pad:seguranca-pre-ativacao:detalhar`
- `npm run profor:pad:reconstruir-plano:dry-run`
- `npm run profor:pad:comparar-plano:dry-run`
- `npm run validar:syntax` — OK, 70 arquivos
- `npm run validar:services` — 104 testes, 104 aprovados, 0 falhas
- `git diff --check` — sem erros de whitespace
- `git status --short frontend/data/publicados` — vazio
- `git status --short "*.sqlite*"` — vazio

## 3. Bloco A — Integridade pós-saneamento

| Item | Valor |
|---|---:|
| 1. Total de divergências na fila | 145 |
| 2. Total analisado pela auditoria profunda | 143 |
| 3. Pendências operacionais reais | **1** (#44) |
| 4. Falsos positivos saneáveis | 73 |
| 5. Históricos saneados | 34 |
| 6. Revalidações necessárias | 27 |
| 7. Decisões resolutivas com pendência técnica | 8 (inclui #18) |
| 8. Divergências PENDENTE/EM_REVISAO (status) | 73 |
| 9. Decisões registradas / resolutivas | 74 / 70 |
| 10. Logs existentes | 2410 (73 `decisao_registrada`) |
| 11. Divergências sem payload / payload inválido | 0 |
| 12. Coerência status × decisão × log × classificação | 1 ressalva (decisão legada #1) |

**Critério central — `pendencia_operacional_real` deve ser 0:** caiu de **2 para 1**. A pendência remanescente é #44 (divergência material de saldo residual), que não é candidata a saneamento automático.

### 3.1. Reclassificação da #18

| Campo | Valor |
|---|---|
| Convênio/UF | 937221/AL |
| Tipo | `item_novo_sem_rateio` |
| Status / decisão | ACEITO / decisão #150 (`sistema-saneamento-pad-al-937221`) |
| Snapshot de segurança | presente; hash atual **= hash do snapshot** → payload **não alterado** |
| Log `decisao_registrada` | presente (log #2340) |
| Classificação anterior | `pendencia_operacional_real` |
| **Classificação nova** | **`decisao_resolutiva_com_pendencia_tecnica`** |

**Justificativa:** #18 tem decisão resolutiva canônica, sem divergência material de natureza e sem payload alterado. A única pendência é técnica: a decisão #150 rateia o saldo residual por áreas operacionais (OUVIDORIA/CORREGEDORIA/ESCOLA), incompatível com a regra de saldo residual não setorializado. Isso exige **revalidação do efeito da decisão**, não nova decisão de mérito — portanto não é pendência operacional real comum.

### 3.2. #44 preservada como pendência operacional real (com pareamento corrigido)

#44 (938128/SP, `item_nao_apto`) permanece `pendencia_operacional_real`. **Diagnóstico aprofundado** (ver `profor-2022-divergencia-44-diagnostico-dry-run.md`): o PAD novo do convênio 938128/SP tem **duas** linhas "Saldo Residual" para a mesma chave — CUSTEIO R$ 71,36 (linha 19) e **CAPITAL R$ 20.704,73 (linha 61)**. A linha PAD de mesma natureza da memória **existe**; o alerta anterior de "natureza divergente sem correspondente" era falso positivo de pareamento.

Dois bugs sistêmicos de pareamento foram corrigidos: (A) a reconstrução gerava impedimento `saldo_residual_natureza_divergente` ao processar a linha PAD CUSTEIO porque os rateios da memória eram todos CAPITAL — agora gera apenas alerta informativo; (B) o auditor de item não apto não computava `comparacaoSaldoResidualPorNatureza` para divergências já decididas — agora computa.

Mesmo com o pareamento corrigido, **persiste divergência material**: natureza CAPITAL memória R$ 22.351,09 vs PAD R$ 20.704,73 (diferença líquida R$ 1.575,00, considerando que a parcela de R$ 71,36 foi reclassificada CAPITAL→CUSTEIO). A decisão #186 (liberação de item não apto) **não resolve o mérito material**. A #44 não foi tratada como falso positivo.

## 4. Bloco B — Segurança pré-ativação final

| Item | Valor |
|---|---:|
| 1. `payload_alterado_apos_decisao` | 28 (27 divergências) |
| 2. Decisão sem snapshot de segurança | 0 |
| 3. Hash divergente | 28 |
| 4. Decisão canônica ausente ou ambígua | 1 (decisão #1) |
| 5. Decisão legada incompatível | 1 |
| 6. Divergência não reapresentada com decisão resolutiva | 7 (#25, #26, #27, #28, #75, #77, #78) |
| 7. Bloqueio técnico remanescente | 35 |
| 8. Decisão com efeito inseguro na reconstrução | 0 |
| 9. `aplicadaAoPlano` permanece `false` | Sim |
| 10. Log `decisao_registrada` para decisões relevantes | 73 de 74 |

**Critério central — nenhum bloqueio técnico pode impedir a preparação da ativação controlada:** `aptoParaProsseguirAtivacao = false`.

Classificação dos 35 bloqueios: **0 impeditivos por dado oficial alterado**; 28 revalidação necessária (payload alterado); 7 histórico documentado (não reapresentadas).

**A correção do classificador não mascara bloqueios de segurança.** A #18 não está entre as decisões com payload alterado (hash do snapshot confere); por isso foi classificada como `decisao_resolutiva_com_pendencia_tecnica` e não `revalidacao_necessaria`. Os 35 bloqueios de segurança permanecem visíveis e inalterados.

## 5. Bloco C — Reconstrução dry-run

| Item | Valor |
|---|---:|
| Plano reconstruído gerado | Sim (623 linhas, 15 convênios) |
| `planoAplicacao` oficial alterado | Não |
| Valor previsto / executado / saldo | R$ 10.654.508,70 / R$ 3.217.739,50 / R$ 7.436.769,20 |
| Impedimentos | **33** (era 34 — falso impedimento da #44 eliminado) |

Saldos residuais reconstruídos com área técnica `NAO INFORMADO` e segregados por natureza. A correção do pareamento de saldo residual eliminou o impedimento `saldo_residual_natureza_divergente` da #44 (938128) — era falso positivo: a linha PAD CAPITAL de mesma natureza existe (linha 61, R$ 20.704,73). Em seu lugar há um alerta informativo `saldo_residual_natureza_sem_rateio_memoria`. Impedimento relevante remanescente: `decisao_nao_aplicavel:saldo_residual_rateio_invalido` (937221/#18 — o rateio por área operacional da decisão #150 é rejeitado no dry-run).

`aptoParaAtivacao = false`, `aptoParaPublicacao = false`.

## 6. Bloco D — Comparador final

| Item | Valor |
|---|---:|
| Diferenças críticas | 30 (todas itens novos) |
| Diferenças esperadas por atualização PAD | 12 |
| Diferenças por pendência de decisão | 15 |
| Itens iguais / novos / ausentes | 460 / 30 / 34 |

Diferença total origem antiga × reconstrução PAD: previsto −R$ 9.506,78, executado +R$ 15.043,60, saldo −R$ 24.550,38. Comparador não afetado pela correção do pareamento de saldo residual.

## 7. Bloco E — Confirmação de não publicação

| Item | Resultado |
|---|---|
| `frontend/data/publicados` sem alteração | Confirmado |
| Nenhum SQLite novo/alterado versionado | Confirmado |
| Origem ativa intacta | Confirmado |
| `planoAplicacao` oficial intacto | Confirmado |
| Nenhuma publicação automática | Confirmado |
| Decisão registrada nesta tarefa | Nenhuma |
| Status alterado nesta tarefa | Nenhum |

Os arquivos alterados são código (reconstrução, auditores de item não apto e de saldos residuais), 1 teste novo, relatórios dry-run e docs de memória.

## 8. Achados classificados por severidade

**Alto**
- `pendencia_operacional_real = 1` (#44) — divergência material real de saldo residual (natureza CAPITAL memória R$ 22.351,09 vs PAD R$ 20.704,73); não é candidato a saneamento automático.

**Médio**
- 35 bloqueios de segurança pré-ativação — `aptoParaProsseguirAtivacao = false`.
- 33 impedimentos de reconstrução e 30 diferenças críticas no comparador.

**Baixo**
- 1 decisão legada não canônica (decisão #1, divergência #24, valor `"aceitar"`).

## 9. Recomendação final

**NÃO APTO para preparar ativação controlada, com bloqueios listados:**

1. Bloco A — `pendencia_operacional_real = 1` (#44, material).
2. Bloco B — 35 bloqueios de segurança (`aptoParaProsseguirAtivacao = false`).
3. Bloco C — 33 impedimentos de reconstrução.
4. Bloco D — 30 diferenças críticas (itens novos).

**Ressalvas documentadas:**
- #18 carrega pendência técnica residual — a decisão #150 rateia saldo residual por área operacional; exige revalidação do efeito da decisão em tarefa futura, sem nova decisão de mérito.
- #44 permanece pendente legitimamente. O alerta de "natureza divergente" era falso positivo de pareamento (a linha PAD CAPITAL existe); a pendência real é a divergência material de valor na natureza CAPITAL. Diagnóstico completo em `profor-2022-divergencia-44-diagnostico-dry-run.md`.

## 10. Rollback

`git revert <commit>`. Depois regenerar os relatórios dry-run. Não apagar decisões, divergências, logs nem relatórios históricos.

## 11. Próximo passo recomendado

1. Revalidar o efeito da decisão #150 da #18 (rateio de saldo residual por área operacional).
2. Esclarecer #44 (saldo residual 938128) com correspondente PAD de mesma natureza ou decisão retificadora.
3. Revalidar humanamente as 28 decisões com payload alterado.
4. Tratar as 7 divergências não reapresentadas com decisão resolutiva.
5. Sanear a decisão legada não canônica #1.
6. Reexecutar esta auditoria integrada após os tratamentos.
