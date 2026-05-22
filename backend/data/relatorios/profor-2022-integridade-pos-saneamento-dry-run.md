# PROFOR 2022 — Auditoria integrada de integridade pós-saneamento e segurança pré-ativação (dry-run)

Gerado em: 2026-05-22T19:02:43Z
Modo: dry-run

Auditoria somente leitura. Não publica, não registra decisão, não altera status, não altera a origem ativa, não altera o `planoAplicacao` oficial e não altera o SQLite versionado.

> **Observação sobre o estado informado.** O pedido informou "0 pendências operacionais restantes". A evidência atual (relatório profundo regenerado em 2026-05-22T19:02) **não confirma** esse estado: há **2 pendências operacionais reais** (`#18`, `#44`). Esta auditoria reporta o estado observado, não o estado presumido.

## 1. Resumo executivo

| Indicador | Valor | Critério |
|---|---:|---|
| Pendência operacional real | **2** | Esperado 0 — **não atendido** |
| Bloqueio técnico de segurança pré-ativação | **35** | Nenhum impeditivo de ativação por dado oficial alterado |
| Apto para preparar ativação controlada | **NÃO** | Bloqueios listados abaixo |
| Decisão registrada nesta auditoria | 0 | OK |
| Dado oficial / publicação alterada | Nenhum | OK |

**Recomendação final: NÃO APTO, com bloqueios listados.** A base não está pronta para iniciar a ativação controlada. Nenhum bloqueio decorre de alteração indevida de dado oficial — todos são revalidações humanas ou pendências técnicas legítimas, registradas apenas em dry-run.

## 2. Comandos executados

- `npm run profor:pad:auditar-fila-revisao`
- `npm run profor:pad:auditar-pendencias-profundo`
- `npm run profor:pad:seguranca-pre-ativacao:dry-run`
- `npm run profor:pad:seguranca-pre-ativacao:detalhar`
- `npm run profor:pad:reconstruir-plano:dry-run`
- `npm run profor:pad:comparar-plano:dry-run`
- `npm run validar:syntax` — OK, 70 arquivos
- `npm run validar:services` — 97 testes, 97 aprovados, 0 falhas
- `git diff --check` — sem erros de whitespace
- `git status --short frontend/data/publicados` — vazio
- `git status --short "*.sqlite*"` — vazio

## 3. Bloco A — Integridade pós-saneamento

| Item | Valor |
|---|---:|
| 1. Total de divergências na fila | 145 |
| 2. Total analisado pela auditoria profunda | 143 |
| 3. Pendências operacionais reais | **2** |
| 4. Falsos positivos saneáveis | 73 |
| 5. Históricos saneados | 34 |
| 6. Revalidações necessárias | 27 |
| 7. Decisões resolutivas com pendência técnica | 7 |
| 8. Divergências PENDENTE/EM_REVISAO (status) | 73 |
| 9. Decisões registradas / resolutivas | 74 / 70 |
| 10. Logs existentes | 2410 (73 `decisao_registrada`) |
| 11. Divergências sem payload / payload inválido | 0 |
| 12. Coerência status × decisão × log × classificação | 1 ressalva (ver abaixo) |

**Critério central — `pendencia_operacional_real` deve ser 0: NÃO ATENDIDO (valor = 2).**

| ID | Convênio/UF | Tipo | Status | Causa | Classificação |
|---:|---|---|---|---|---|
| #18 | 937221/AL | `item_novo_sem_rateio` | ACEITO (decisão #150) | Divergência já decidida, reclassificada como pendência operacional pelo ramo de saldo residual do classificador, avaliado antes do ramo de decisão resolutiva. Carrega decisão anterior incompatível. | Revalidação necessária — decisão resolutiva presente com pendência técnica de saldo residual. |
| #44 | 938128/SP | `item_nao_apto` | ACEITO (decisão #186) | Saldo residual com **natureza divergente real**: memória CAPITAL R$ 22.351,09 sem linha PAD de mesma natureza/valor (PAD apresenta CUSTEIO R$ 71,36). A divergência de natureza permanece tecnicamente aberta apesar do status ACEITO. | Pendência técnica real de saldo residual; exige correspondente PAD de mesma natureza ou decisão retificadora. |

**Coerência (item 12):** 1 decisão legada não canônica — decisão `#1` (divergência #24) gravada como `"aceitar"` em caixa baixa. É anterior ao log `decisao_registrada` (74 decisões × 73 logs). Não bloqueia ativação; recomenda-se saneamento canônico auditável.

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
| 9. `aplicadaAoPlano` permanece `false` nas decisões auditadas | Sim |
| 10. Log `decisao_registrada` para decisões relevantes | 73 de 74 (falta apenas a legada #1) |

**Critério central — nenhum bloqueio técnico pode impedir a preparação da ativação controlada: NÃO ATENDIDO** (`aptoParaProsseguirAtivacao = false`).

Classificação dos 35 bloqueios:

- **Impeditivo de ativação: 0** — nenhum bloqueio decorre de dado oficial alterado.
- **Revalidação necessária: 28** — payload alterado após a decisão; divergências #47–#54, #56–#74. Origem provável: reextração/regeração do PAD. Exigem revalidação humana.
- **Histórico documentado: 7** — divergências não reapresentadas com decisão resolutiva (#25, #26, #27, #28, #75, #77, #78).
- **Alerta não impeditivo: 0.**

As decisões com payload alterado **possuem snapshot** (hash do momento da decisão registrado) e o hash atual diverge — comportamento esperado quando o PAD é regerado. `aplicadaAoPlano` permanece `false` em todas: nenhuma decisão produziu efeito sobre o plano oficial.

## 5. Bloco C — Reconstrução dry-run

| Item | Valor |
|---|---:|
| 1. Plano reconstruído gerado | Sim (623 linhas) |
| 2. `planoAplicacao` oficial alterado | Não |
| 3. Convênios reconstruídos | 15 |
| 6. Valor previsto reconstruído | R$ 10.654.508,70 |
| 7. Valor executado reconstruído | R$ 3.217.739,50 |
| 8. Saldo reconstruído | R$ 7.436.769,20 |
| Impedimentos / alertas | 34 / 119 |

Impedimentos por tipo: `rateio_percentual_indefinido` 19, `item_conhecido_nao_apto_usado` 6, `decisao_nao_aplicavel:decisao_sem_efeito_definido` 5, `saldo_residual_natureza_divergente` 1, `item_pad_sem_rateio` 1, `decisao_nao_aplicavel:saldo_residual_rateio_invalido` 1, `divergencias_revisao_bloqueiam_publicacao` 1.

- **9. Saldos residuais/remanescentes:** reconstruídos com área técnica `NAO INFORMADO` e segregados por natureza; 1 impedimento `saldo_residual_natureza_divergente` (convênio 938128 / #44).
- **10. Itens saneados tecnicamente:** inconsistências quantidade × valor unitário saneadas por arredondamento preservam o total previsto do PAD e não geram impedimento.

`aptoParaAtivacao = false`, `aptoParaPublicacao = false`.

## 6. Bloco D — Comparador final

| Item | Valor |
|---|---:|
| 1. Diferenças críticas | 30 (todas itens novos) |
| 2. Diferenças esperadas por atualização PAD | 12 |
| 3. Diferenças saneadas por decisão | 0 |
| 4. Diferenças de arredondamento | 0 críticas — total do PAD prevalece |
| 5. Diferenças por saldo residual | Área divergente 0, natureza divergente 0 |
| 6. Diferenças que impedem ativação | 30 críticas + 34 impedimentos de reconstrução |
| 7. Diferenças apenas informativas | 7 avisos |

Linhas antigo/novo: 566 / 623. Itens iguais 460, novos 30, ausentes 34, ambíguos 45. Valor previsto divergente 14, valor executado divergente 13, saldo divergente 27.

Diferença total origem antiga × reconstrução PAD: previsto −R$ 9.506,78, executado +R$ 15.043,60, saldo −R$ 24.550,38.

As 30 diferenças críticas são todas itens novos (linhas reconstruídas pelo PAD sem correspondência na origem antiga) — exigem conferência de rateio/área antes da ativação controlada.

## 7. Bloco E — Confirmação de não publicação

| Item | Resultado |
|---|---|
| 1. `frontend/data/publicados` sem alteração | Confirmado (`git status` vazio) |
| 2. Nenhum SQLite novo/alterado versionado | Confirmado (`git status "*.sqlite*"` vazio) |
| 3. Origem ativa intacta | Confirmado |
| 4. `planoAplicacao` oficial intacto | Confirmado |
| 5. Nenhuma publicação automática executada | Confirmado |
| 6. Hook de publicação ignorou publicação | Confirmado — sem alteração pública |

Os únicos arquivos alterados são relatórios dry-run em `backend/data/relatorios/`.

## 8. Achados classificados por severidade

**Alto**
- `pendencia_operacional_real = 2` (#18, #44), não 0 — critério central do Bloco A não atendido. #44 é pendência técnica real de saldo residual; #18 está decidida mas reclassificada pelo ordenamento do classificador.

**Médio**
- 35 bloqueios de segurança pré-ativação (28 revalidação por payload alterado + 7 não reapresentadas) — `aptoParaProsseguirAtivacao = false`.
- 34 impedimentos de reconstrução e 30 diferenças críticas no comparador — reconstrução/comparação não aptas para ativação automática.

**Baixo**
- 1 decisão legada não canônica (decisão #1, divergência #24, valor `"aceitar"`) — não bloqueia ativação; sanear em etapa posterior.

## 9. Recomendação final

**NÃO APTO para preparar ativação controlada, com bloqueios listados:**

1. Bloco A — `pendencia_operacional_real = 2` (#18, #44): critério central não atendido.
2. Bloco B — 35 bloqueios de segurança (`aptoParaProsseguirAtivacao = false`).
3. Bloco C — 34 impedimentos de reconstrução.
4. Bloco D — 30 diferenças críticas (itens novos).

**Ressalvas documentadas:**
- O estado informado de "0 pendências operacionais" não foi confirmado pela evidência atual.
- #18 já possui decisão ACEITO e é candidato a reclassificação (`revalidacao_necessaria`/`historico_saneado`); a correção do ordenamento do classificador operacional para itens de saldo residual já decididos deve ser tratada em tarefa de código separada — esta auditoria não altera código.

## 10. Rollback

`git revert <commit>`. Não apagar decisões, divergências, logs nem relatórios históricos. Os relatórios dry-run podem ser regenerados pelos comandos `npm` correspondentes.

## 11. Próximo passo recomendado

1. Revalidar humanamente as 28 decisões com payload alterado (grupo 1 do plano de revalidação).
2. Tratar as 7 divergências não reapresentadas com decisão resolutiva (grupo 2).
3. Esclarecer #44 (saldo residual 938128) com correspondente PAD de mesma natureza ou decisão retificadora.
4. Avaliar a reclassificação de #18 (decisão resolutiva já presente).
5. Sanear a decisão legada não canônica #1.
6. Reexecutar esta auditoria integrada após os tratamentos.
