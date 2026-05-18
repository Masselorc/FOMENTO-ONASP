# PROFOR 2022 — Classificação das divergências planilha × banco-cache

## Identificação do documento

| Campo | Valor |
| --- | --- |
| Nome do documento | PROFOR 2022 — Classificação das divergências planilha × banco-cache |
| Arquivo | `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md` |
| Status | diagnóstico técnico de suporte à decisão |
| Última revisão | 18/05/2026 |
| Responsável | ONASP / FOMENTO-ONASP |
| Documento de governança? | sim (suporte à decisão de ativação do `banco-cache`) |
| Documento de implementação? | não — diagnóstico documental, sem alteração de código |

## 1. Contexto

Após a resolução do download/cache DETRU, do plano de aplicação filtrado e do fluxo público Transferegov para saldo de rendimentos, o consolidado PROFOR 2022 ficou tecnicamente completo:

| Métrica | Valor |
| --- | --- |
| `diagnostico.totalCarteira` | 15 |
| `diagnostico.totalComDetru` | 15 |
| `diagnostico.totalComPlano` | 15 |
| `diagnostico.totalComRendimentos` | 15 |
| `diagnostico.totalAvisos` | 60 |
| `comparacao.totalAntigo` | 15 |
| `comparacao.totalNovo` | 15 |
| `comparacao.totalIguais` | 0 |
| `comparacao.totalComDivergencia` | 15 |
| `comparacao.totalAusentesAntigo` | 0 |
| `comparacao.totalAusentesNovo` | 0 |
| Severidade alta | 15 convênios |
| Severidade média | 0 convênios |
| Origem padrão atual (`.env`) | `PROFOR_2022_ORIGEM_DADOS=planilha` |
| `banco-cache` ativado? | **não** |

Ou seja: todos os 15 convênios da carteira estão tecnicamente compostos pelo `banco-cache` (Carteira + DETRU + Plano + Transferegov/rendimentos), mas nenhum convênio é integralmente igual ao retornado pela origem antiga `planilha` (aba `Geral`). Este documento separa essas 15 divergências em categorias técnicas e de governança para sustentar decisão segura sobre a ativação.

## 2. Metodologia

A classificação foi feita por observação dos endpoints locais e diagnóstico documental, sem alteração de código de produção nesta etapa:

- `GET /api/profor-2022/consolidado` — origem `banco-cache` montada localmente em backend Node, sem ativar como padrão.
- `GET /api/profor-2022/comparar-origens` — compara `planilha` × `banco-cache` com tolerâncias monetária (R$ 0,01) e percentual (0,1 ponto).
- Análise da trilha de implementação do DETRU, dos cálculos internos do plano e do cache Transferegov/rendimentos.

Critérios de classificação:

1. **Grupo A — divergência esperada por fonte oficial DETRU**: campo extraído do DETRU/cache que substitui valor manual da aba `Geral`.
2. **Grupo B — divergência esperada por cálculo do plano**: campo calculado por soma sobre os itens do plano de aplicação filtrados por UF + número + ano.
3. **Grupo C — divergência por ausência na origem antiga**: campo só existe no `banco-cache` ou não era extraído no nível do convênio na origem antiga.
4. **Grupo D — divergência temporal esperada por fonte Transferegov atualizada**: campo existe na aba `Geral`, mas o `banco-cache` traz o valor atual capturado na tela pública do Transferegov.
5. **Grupo E — divergência que exige validação humana**: casos isolados sem justificativa técnica suficiente.

## 3. Diagnóstico

### 3.1. Distribuição das divergências por campo (estado em 18/05/2026, após atualização do cache Transferegov)

| Campo | Convênios divergentes | Status predominante | Severidade predominante |
| --- | ---: | --- | --- |
| `quantidadeTa` | 15 | `divergente` | baixa (dif=1) / média (dif=2) |
| `saldoRendimentosAtual` | 15 | `divergente` | alta |
| `execucaoGeralPercentual` | 15 | `ausente_antigo` | média |
| `saldoResidualCapital` | 14 | `divergente` | alta |
| `saldoResidualCusteio` | 12 | `divergente` | alta |
| `valorExecutadoGeral` | 1 (937698/MT) | `divergente` | alta |
| `valorGlobal` | 1 (937468/TO) | `divergente` | alta |
| `valorRepasse` | 1 (937782/AC) | `divergente` | alta |
| `rendimentoAprovado` | 1 (937468/TO) | `divergente` | alta |
| **Total ocorrências** | **75** distribuídas em 15 convênios | — | — |

### 3.2. Severidade agregada por convênio

| Severidade | Convênios |
| --- | ---: |
| alta | 15 |
| média | 0 |
| baixa | 0 |

Total: 15 convênios divergentes.

### 3.3. Convênios e divergências individuais (resumo)

| UF | Convênio/ano | Total divergências | Severidade |
| --- | --- | ---: | --- |
| MT | 937698/2022 | 5 | alta |
| GO | 937216/2022 | 4 | alta |
| PR | 937871/2022 | 5 | alta |
| AM | 937592/2022 | 3 | alta |
| AC | 937782/2022 | 6 | alta |
| MS | 937265/2022 | 5 | alta |
| SP | 938128/2022 | 5 | alta |
| MA | 938277/2022 | 5 | alta |
| PB | 937818/2022 | 5 | alta |
| PI | 937780/2022 | 5 | alta |
| RO | 937917/2022 | 5 | alta |
| TO | 937468/2022 | 7 | alta |
| RJ | 937817/2022 | 5 | alta |
| AL | 937221/2022 | 5 | alta |
| SC | 937783/2022 | 5 | alta |

## 4. Matriz de divergências (classificação técnica e de governança)

| Campo | Origem antiga | Origem nova | Tipo de divergência | Convênios | Classificação | Bloqueia ativação? | Providência recomendada |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| `quantidadeTa` | aba Geral (coluna 6, manual) | DETRU/cache (`QTD_TA`) | `divergente` | 15 | aceitável — fonte oficial DETRU | não | Aceitar valor DETRU; documentar diferença de critério (DETRU conta total de TA assinados, planilha pode contar parciais). |
| `valorGlobal` | aba Geral (coluna 8, manual) | DETRU/cache (`VL_GLOBAL_CONV`) | `divergente` | 1 (937468/TO) | aceitável — fonte oficial DETRU | não | Aceitar DETRU. Diferença de R$ 21.868,00 indica atualização oficial não refletida na planilha. |
| `valorRepasse` | aba Geral (coluna 9, manual) | DETRU/cache (`VL_REPASSE_CONV`) | `divergente` | 1 (937782/AC) | aceitável — fonte oficial DETRU | não | Aceitar DETRU. Diferença de R$ 5.993,71 indica ajuste de repasse não refletido na planilha. |
| `rendimentoAprovado` | aba Geral (coluna 12, manual) | DETRU/cache (`VL_RENDIMENTO_APLICACAO`) | `divergente` | 1 (937468/TO) | aceitável — fonte oficial DETRU | não | Aceitar DETRU. Antigo=0, novo=R$ 21.868,00 (rendimento aprovado e registrado oficialmente). |
| `valorExecutadoGeral` | aba Geral (coluna 17, manual) | soma `valorExecutado` do plano filtrado por UF+nº+ano | `divergente` | 1 (937698/MT) | aceitável — cálculo do plano | não | Aceitar cálculo. Antigo=R$ 26.067,41; novo=R$ 337.453,87 (soma dos itens do plano MT). |
| `saldoResidualCapital` | aba Geral (coluna 14, manual) | soma `saldo` dos itens do plano com natureza=CAPITAL | `divergente` | 14 | aceitável — cálculo do plano | não | Aceitar cálculo. Aba Geral trazia valores manuais antigos, frequentemente zerados ou negativos; novo reflete saldo por natureza. |
| `saldoResidualCusteio` | aba Geral (coluna 15, manual) | soma `saldo` dos itens do plano com natureza=CUSTEIO | `divergente` | 12 | aceitável — cálculo do plano | não | Aceitar cálculo. Mesmo critério do `saldoResidualCapital`. |
| `execucaoGeralPercentual` | **não extraído** no nível do convênio em `extrairProfor2022DoWorkbook` | `valorExecutado/valorPrevisto*100` calculado do plano | `ausente_antigo` | 15 | não bloqueante — campo novo calculado | não | Ignorar diferença. Antigo retorna `null` porque o campo não era extraído da aba Geral no nível do convênio. |
| `saldoRendimentosAtual` | aba Geral (coluna 13, manual; retrato de data anterior) | cache Transferegov populado pela tela pública atual de Rendimento de Aplicação | `divergente` | 15 | aceitável — divergência temporal esperada | **não** | Aceitar como atualização de fonte. O saldo de rendimentos é dinâmico e pode mudar quase diariamente. A divergência com a planilha indica defasagem temporal do valor manual antigo, não erro técnico do `banco-cache`. Exibir fonte e data/hora da captura na interface/relatório. |

### 4.1. Resumo dos grupos

| Grupo | Campos | Convênios distintos | Classificação | Bloqueia? |
| --- | --- | ---: | --- | --- |
| **A — DETRU oficial** | `quantidadeTa`, `valorGlobal`, `valorRepasse`, `rendimentoAprovado` | 15 (em ao menos 1 campo) | aceitável | não |
| **B — Cálculo do plano** | `valorExecutadoGeral`, `saldoResidualCapital`, `saldoResidualCusteio` | 14 | aceitável | não |
| **C — Ausente na origem antiga** | `execucaoGeralPercentual` | 15 | não bloqueante | não |
| **D — Transferegov atualizado** | `saldoRendimentosAtual` | 15 | aceitável — divergência temporal esperada | **não** |
| **E — Validação humana** | nenhum caso identificado | 0 | — | — |

**Nenhuma divergência foi classificada como erro provável.** Todas as 75 ocorrências estão tecnicamente justificadas pela arquitetura definida: DETRU como fonte oficial, cálculo interno do plano e saldo de rendimento atual capturado no Transferegov público.

## 5. Recomendações técnicas

### 5.1. Opção 1 — Manter `planilha` como origem padrão (status quo)

**Quando aplicar**: se a ONASP optar por adiar a virada de origem por razões operacionais, comunicação interna ou validação visual adicional.

**Consequência**: a origem `planilha` continua única para a interface padrão; os caches DETRU e Transferegov permanecem disponíveis para consultas administrativas/locais, mas sem impacto visual padrão.

### 5.2. Opção 2 — Ativar `banco-cache` como origem padrão controlada

**Quando aplicar**: recomendada quando a equipe aceitar que campos oficiais/atualizados devem prevalecer sobre os valores manuais antigos da aba `Geral`.

**Justificativa técnica**:

- DETRU é fonte oficial para dados cadastrais e financeiros do convênio.
- O plano de aplicação filtrado por UF + número + ano permite cálculo interno auditável.
- O Transferegov Acesso Livre fornece o saldo atual de rendimentos, campo dinâmico cuja divergência com a planilha é temporal e esperada.

**Implementação futura sugerida**:

- Tornar `PROFOR_2022_ORIGEM_DADOS=banco-cache` o padrão no ambiente local/API.
- Garantir aviso técnico discreto de origem para `saldoRendimentosAtual`: "Saldo de rendimentos capturado no Transferegov Acesso Livre em [data/hora]. Valor sujeito a alteração conforme movimentação financeira do convênio."
- Manter rollback imediato para `PROFOR_2022_ORIGEM_DADOS=planilha`.
- Não publicar estaticamente antes de validação visual local.

**Risco**: usuários podem estranhar diferenças frente à planilha antiga. O aviso de fonte, a data de captura e a comunicação operacional mitigam esse risco.

### 5.3. Opção 3 — Ativar `banco-cache` com composição híbrida

**Quando aplicar**: não recomendada, salvo decisão excepcional.

**Custo arquitetural**: cria uma terceira origem efetiva (híbrida `banco-cache` + planilha por campo), aumenta complexidade do `dashboard-publication-service.js`, mantém dependência continuada da planilha para campo único e enfraquece a rastreabilidade.

**Recomendação interna**: evitar. Preferir Opção 2 com aviso de origem e rollback.

### 5.4. Opção 4 — Validação humana dos campos divergentes

**Quando aplicar**: se a governança quiser revisar caso a caso antes de trocar valores manuais por DETRU oficial, cálculo do plano e Transferegov atualizado.

**Procedimento sugerido**:

1. Revisor compara cada um dos 15 convênios entre `planilha` e `banco-cache` usando `/api/profor-2022/comparar-origens`.
2. Para cada campo divergente, registra-se decisão (aceitar novo / manter antigo / ajustar planilha) em ata ou registro técnico.
3. Após aprovação, a planilha pode ser atualizada para refletir a nova origem ou mantida apenas como fallback histórico.
4. A ativação pode ocorrer com rollback por variável de ambiente.

### 5.5. Situação específica do Grupo D (`saldoRendimentosAtual`)

A fonte operacional correta do campo é a **tela de Rendimento de Aplicação do Transferegov Acesso Livre**, acessada após posicionar sessão pública no convênio (consulta por `numeroConvenio` → extrair `idConvenio` → selecionar instrumento → ler tela final). DETRU **não** substitui esse campo.

O campo `saldoRendimentosAtual` tem natureza dinâmica. Ele representa o saldo disponível no Transferegov em determinada data de referência e pode variar conforme movimentações financeiras, aprovações, uso de rendimento, atualização bancária ou registro sistêmico. A aba `Geral` contém valor manual e, por definição, pode estar defasada em relação à tela pública atual.

Estado em 18/05/2026: o fluxo foi implementado no cliente local/API. O cliente tenta primeiro HTTP público com cookie jar em memória; quando o IdP/SAML impede o cliente HTTP simples, usa fallback local com Playwright/Chromium já disponível no projeto para reproduzir sessão pública Acesso Livre de navegador, sem login, senha, gov.br, captcha, certificado, cookies do HAR ou persistência de cookies.

Validações executadas:

1. `880892`: `idConvenio=732378`, `Instrumento 880892`, `R$ 131.799,75`.
2. `937216`: `idConvenio=1031156`, `Instrumento 937216`, `-R$ 25.373,11`.
3. `npm run atualizar:rendimentos-profor`: 15 convênios consultados, 15 sucessos, 0 falhas.
4. `/api/profor-2022/consolidado`: `totalComRendimentos=15`.

Conclusão atualizada:

- A divergência de `saldoRendimentosAtual` com a aba `Geral` **não bloqueia tecnicamente** a ativação.
- A divergência deve ser classificada como **temporal esperada**, pois a nova origem captura valor atual do Transferegov.
- A providência correta é exibir fonte e data/hora de captura, não tentar igualar a planilha.
- A ativação de `banco-cache` passa a depender de validação visual/operacional e comunicação, não de correção técnica do campo.

Não recomendadas:

- Composição híbrida campo a campo.
- DETRU como fonte de `saldoRendimentosAtual`.
- Correção manual para forçar igualdade com a planilha.

## 6. Critérios para ativação futura do `banco-cache`

A ativação como origem padrão (`PROFOR_2022_ORIGEM_DADOS=banco-cache`) pode ser considerada tecnicamente apta quando os critérios abaixo forem atendidos:

1. ✅ DETRU populado para os 15 convênios da carteira (`totalComDetru = 15`).
2. ✅ Plano de aplicação casando para os 15 convênios (`totalComPlano = 15`).
3. ✅ Cache Transferegov/rendimentos populado para os 15 convênios (`totalComRendimentos = 15`).
4. ✅ Divergências do Grupo A justificadas por fonte oficial DETRU.
5. ✅ Divergências do Grupo B justificadas por cálculo interno do plano.
6. ✅ Divergências do Grupo D justificadas por atualização temporal do Transferegov.
7. ⚠️ Validação visual no modo local/API antes de publicação estática.
8. ⚠️ Comunicação operacional aos usuários da ONASP/SENAPPEN sobre mudança de origem, especialmente para valores de rendimentos.
9. ⚠️ Exibição de fonte/data de captura para `saldoRendimentosAtual` na interface ou relatório, quando disponível no objeto consolidado.

Status em 18/05/2026:

- Critérios técnicos (1–6): ✅ atendidos.
- Critérios operacionais/comunicação (7–9): ⚠️ a executar antes da virada definitiva/publicação.

## 7. Rollback

A ativação futura do `banco-cache` é reversível por configuração:

```text
PROFOR_2022_ORIGEM_DADOS=planilha
```

Reverter essa variável em `.env` é suficiente para retornar à origem antiga sem alterar código, banco, JSONs publicados ou frontend.

Em caso de falha pontual do `banco-cache` após ativação, o serviço `dashboard-publication-service.js` já possui fallback automático para `planilha` (com aviso), preservando continuidade operacional sem necessidade de intervenção manual.

## 8. Histórico

| Data | Evento |
| --- | --- |
| 17/05/2026 | Criação do documento. Diagnóstico inicial das 15 divergências e classificação em Grupos A–E. Recomendação: aguardar decisão de governança antes de ativar `banco-cache`. Nenhuma alteração de código nesta etapa. |
| 17/05/2026 | Grupo D corrigido: fonte operacional de `saldoRendimentosAtual` é Transferegov Acesso Livre (consulta por número → idConvenio → seleção do instrumento → tela de rendimento), **não** DETRU nem importação manual como solução principal. Sondagem técnica inicial revelou bloqueio SAML/SSO no IdP do Transferegov para clientes HTTP simples; implementação automatizada dependente de HAR/HTML do usuário. |
| 18/05/2026 | Grupo D atualizado: fluxo público Transferegov implementado no cliente local/API com cookie jar em memória e fallback público Playwright/Chromium. Cache populado para 15/15 convênios; `totalComRendimentos=15`. Divergência remanescente passou a ser entre valor manual da aba `Geral` e saldo atual capturado na tela pública. |
| 18/05/2026 | Grupo D reclassificado: `saldoRendimentosAtual` passou de bloqueio parcial para divergência temporal esperada. Como o saldo de rendimentos é dinâmico e pode mudar quase diariamente, a divergência com a planilha manual não é erro técnico e não bloqueia a ativação; exige exibição de fonte/data de captura e comunicação operacional. |
