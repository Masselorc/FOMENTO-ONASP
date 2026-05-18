# PROFOR 2022 — Classificação das divergências planilha × banco-cache

## Identificação do documento

| Campo | Valor |
| --- | --- |
| Nome do documento | PROFOR 2022 — Classificação das divergências planilha × banco-cache |
| Arquivo | `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md` |
| Status | rascunho técnico de diagnóstico |
| Última revisão | 18/05/2026 |
| Responsável | ONASP / FOMENTO-ONASP |
| Documento de governança? | sim (suporte à decisão de futura ativação do `banco-cache`) |
| Documento de implementação? | não — diagnóstico documental, sem alteração de código |

## 1. Contexto

Após a resolução do download e do cache DETRU (commit `ebe861f` e anteriores), o estado real do consolidado PROFOR 2022 ficou:

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

Ou seja: todos os 15 convênios da carteira estão tecnicamente compostos pelo `banco-cache` (DETRU + Plano + Carteira + Transferegov/rendimentos), mas nenhum convênio é integralmente igual ao retornado pela origem antiga `planilha` (aba `Geral`). Este documento separa essas 15 divergências em categorias técnicas e de governança para sustentar decisão segura sobre futura ativação.

## 2. Metodologia

A classificação foi feita exclusivamente por observação dos endpoints locais e diagnóstico documental, sem alteração de código de produção:

- `GET /api/profor-2022/consolidado` — origem `banco-cache` montada localmente em backend Node, sem ativar como padrão.
- `GET /api/profor-2022/comparar-origens` — compara `planilha` × `banco-cache` com tolerâncias monetária (R$ 0,01) e percentual (0,1 ponto).
- Script temporário (apagado após análise) inspecionou as 15 abas estaduais da planilha `Planilhas/gestao_financeira_ouvidoria.xlsx` e cruzou com a carteira ativa do banco local SQLite.

Critérios de classificação:

1. **Grupo A — divergência esperada por fonte oficial DETRU**: campo extraído do DETRU/cache que substitui valor manual da aba Geral.
2. **Grupo B — divergência esperada por cálculo do plano**: campo calculado por soma sobre os itens do plano de aplicação filtrados por UF + número + ano.
3. **Grupo C — divergência por ausência na origem antiga**: campo só existe no `banco-cache` (não estava extraído no nível do convênio na aba Geral).
4. **Grupo D — divergência por fonte Transferegov atualizada**: campo existe na aba Geral, mas o `banco-cache` agora traz o valor capturado na tela pública atual do Transferegov.
5. **Grupo E — divergência que exige validação humana**: casos isolados de divergência monetária alta que exigem análise individual.

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
| `quantidadeTa` | aba Geral (coluna 6, manual) | DETRU/cache (`QTD_TA`) | `divergente` | 15 | aceitável — fonte oficial DETRU | não | Aceitar valor DETRU; documentar diferença de critério (DETRU conta total de TA assinados, planilha pode contar parciais) |
| `valorGlobal` | aba Geral (coluna 8, manual) | DETRU/cache (`VL_GLOBAL_CONV`) | `divergente` | 1 (937468/TO) | aceitável — fonte oficial DETRU | não | Aceitar DETRU. Diferença R$ 21.868 = valor de TA não refletido na planilha |
| `valorRepasse` | aba Geral (coluna 9, manual) | DETRU/cache (`VL_REPASSE_CONV`) | `divergente` | 1 (937782/AC) | aceitável — fonte oficial DETRU | não | Aceitar DETRU. Diferença R$ 5.993,71 = ajuste de repasse não refletido na planilha |
| `rendimentoAprovado` | aba Geral (coluna 12, manual) | DETRU/cache (`VL_RENDIMENTO_APLICACAO`) | `divergente` | 1 (937468/TO) | aceitável — fonte oficial DETRU | não | Aceitar DETRU. Antigo=0, Novo=R$ 21.868 (rendimento aprovado e registrado oficialmente) |
| `valorExecutadoGeral` | aba Geral (coluna 17, manual) | soma `valorExecutado` do plano filtrado por UF+nº+ano | `divergente` | 1 (937698/MT) | aceitável — cálculo do plano | não | Aceitar cálculo. Antigo=R$ 26.067,41 (desatualizado); Novo=R$ 337.453,87 (soma real dos 12 itens do plano MT) |
| `saldoResidualCapital` | aba Geral (coluna 14, manual) | soma `saldo` dos itens do plano com natureza=CAPITAL | `divergente` | 14 | aceitável — cálculo do plano | não | Aceitar cálculo. Aba Geral tinha valores manuais antigos, frequentemente zerados ou negativos; novo reflete saldo real por natureza |
| `saldoResidualCusteio` | aba Geral (coluna 15, manual) | soma `saldo` dos itens do plano com natureza=CUSTEIO | `divergente` | 12 | aceitável — cálculo do plano | não | Aceitar cálculo. Mesmo critério do `saldoResidualCapital` |
| `execucaoGeralPercentual` | **não extraído** no nível do convênio em `extrairProfor2022DoWorkbook` | `valorExecutado/valorPrevisto*100` calculado do plano | `ausente_antigo` | 15 | não bloqueante — campo novo calculado | não | Ignorar diferença. Antigo retorna `null` simplesmente porque o campo nunca foi extraído da aba Geral no nível do convênio. Opcionalmente, adicionar extração futura para reduzir ruído de comparação |
| `saldoRendimentosAtual` | aba Geral (coluna 13, manual atualizado periodicamente) | cache Transferegov populado pela tela pública de Rendimento de Aplicação | `divergente` | 15 | pendência de governança — fonte atualizada | **parcial (sim)** | A fonte técnica deste campo é o **Transferegov Acesso Livre**, na tela de Rendimento de Aplicação, após posicionar sessão no convênio (consulta por `numeroConvenio` → `idConvenio` → seleção do instrumento → tela final). Em 18/05/2026 o fluxo foi automatizado no modo local/API e o cache foi populado para 15/15 convênios. A divergência restante é entre valor manual da aba `Geral` e saldo atual capturado no Transferegov. DETRU **não** é fonte deste campo. Ver seção 5.5 |

### 4.1. Resumo dos grupos

| Grupo | Campos | Convênios distintos | Classificação | Bloqueia? |
| --- | --- | ---: | --- | --- |
| **A — DETRU oficial** | `quantidadeTa`, `valorGlobal`, `valorRepasse`, `rendimentoAprovado` | 15 (em ao menos 1 campo) | aceitável | não |
| **B — Cálculo do plano** | `valorExecutadoGeral`, `saldoResidualCapital`, `saldoResidualCusteio` | 14 | aceitável | não |
| **C — Ausente na origem antiga** | `execucaoGeralPercentual` | 15 | não bloqueante | não |
| **D — Transferegov atualizado** | `saldoRendimentosAtual` | 15 | pendência de governança | **parcial** |
| **E — Validação humana** | nenhum caso identificado | 0 | — | — |

**Nenhuma divergência foi classificada como erro provável.** Todas as 75 ocorrências estão tecnicamente justificadas pela arquitetura definida nos blocos 14–18 e pela correção do fluxo Transferegov em 18/05/2026 (DETRU como fonte oficial + cálculo do plano + saldo de rendimento capturado no Transferegov público).

## 5. Recomendações técnicas

### 5.1. Opção 1 — Não ativar `banco-cache` (status quo)

**Quando aplicar**: se a governança não autorizar trocar o valor manual da aba `Geral` pelo saldo atual capturado no Transferegov público.

**Consequência**: a origem `planilha` continua única; os caches DETRU e Transferegov ficam disponíveis apenas para consultas administrativas/locais, sem impacto visual; o trabalho dos blocos 11–18 e da correção de 18/05/2026 fica em modo de prontidão.

### 5.2. Opção 2 — Ativar `banco-cache` parcialmente

**Quando aplicar**: se a governança aceitar os saldos atuais capturados no Transferegov como fonte do campo `saldoRendimentosAtual`, mesmo que divirjam dos valores manuais da aba `Geral`.

**Implementação futura sugerida** (não implementar agora):
- Tornar `PROFOR_2022_ORIGEM_DADOS=banco-cache` o padrão.
- Garantir que o frontend mostre aviso técnico discreto de origem: "Saldo de rendimentos capturado no Transferegov Acesso Livre."
- Manter a rota e o botão de atualização DETRU para refresco diário.

**Risco**: usuários podem estranhar diferenças frente à planilha antiga. Aviso de origem e comunicação operacional mitigam, mas não eliminam a necessidade de validação.

### 5.3. Opção 3 — Ativar `banco-cache` com composição híbrida

**Quando aplicar**: se for tecnicamente seguro manter apenas `saldoRendimentosAtual` vindo da aba Geral enquanto os demais campos vêm do `banco-cache`. **Avaliar; não implementar agora.**

**Custo arquitetural**: cria uma terceira origem efetiva (híbrida `banco-cache` + planilha por campo), aumenta complexidade do `dashboard-publication-service.js`, gera dependência continuada da planilha como fonte de campo único, e dilui a clareza do mapeamento "uma origem por consolidado".

**Recomendação interna**: evitar. Se necessário, preferir Opção 2 com cache importado manualmente quando houver janela de tempo, ou Opção 4 com validação humana periódica.

### 5.4. Opção 4 — Validação humana dos campos divergentes (governança)

**Quando aplicar**: se a governança não aceitar trocar valores manuais por DETRU oficial e cálculo do plano sem revisão caso a caso.

**Procedimento sugerido** (operacional, não código):
1. Revisor compara cada um dos 15 convênios entre `planilha` e `banco-cache` usando a saída atual de `/api/profor-2022/comparar-origens`.
2. Para cada campo divergente, registra-se decisão (manter antigo / aceitar novo / ajustar planilha) em ata.
3. Após aprovação, planilha é atualizada para refletir DETRU oficial (campos A) e o cálculo do plano (campos B).
4. Reexecuta-se a comparação até `totalIguais` ≈ 15.
5. Após convergência, opção 2 ou ativação plena passa a ser segura.

### 5.5. Situação específica do Grupo D (`saldoRendimentosAtual`)

A fonte oficial e única do campo é a **tela de Rendimento de Aplicação do Transferegov Acesso Livre**, acessada após posicionar sessão pública no convênio (consulta por `numeroConvenio` → extrair `idConvenio` → selecionar instrumento → ler tela final). Esta é a estratégia correta; DETRU **não** substitui esse campo.

Estado em 18/05/2026: o fluxo foi implementado no cliente local/API. O cliente tenta primeiro HTTP público com cookie jar em memória; quando o IdP/SAML impede o cliente HTTP simples, usa fallback local com Playwright/Chromium já disponível no projeto para reproduzir sessão pública Acesso Livre de navegador, sem login, senha, gov.br, captcha, certificado, cookies do HAR ou persistência de cookies.

Validações executadas:

1. `880892`: `idConvenio=732378`, `Instrumento 880892`, `R$ 131.799,75`.
2. `937216`: `idConvenio=1031156`, `Instrumento 937216`, `-R$ 25.373,11`.
3. `npm run atualizar:rendimentos-profor`: 15 convênios consultados, 15 sucessos, 0 falhas.
4. `/api/profor-2022/consolidado`: `totalComRendimentos=15`.

Pendência remanescente:

- Validar se os saldos atuais capturados no Transferegov devem substituir os valores manuais antigos da aba `Geral`.
- Confirmar se o fallback local com Playwright/Chromium é aceito como mecanismo operacional de atualização em ambiente local/API.
- Manter `banco-cache` fora do padrão até decisão de governança.

**Não recomendadas**:
- Composição híbrida campo a campo (Opção 3 da seção 5): aumenta complexidade arquitetural.
- DETRU como fonte do campo: o SICONV não traz `saldoRendimentosAtual`; traz apenas `VL_RENDIMENTO_APLICACAO` (rendimento aprovado, campo distinto que já é coberto pelo Grupo A).

## 6. Critérios para ativação futura do `banco-cache`

A ativação como origem padrão (`PROFOR_2022_ORIGEM_DADOS=banco-cache`) só deve ocorrer quando **todos** os critérios abaixo forem atendidos:

1. ✅ DETRU populado para os 15 convênios da carteira (`totalComDetru = 15`).
2. ✅ Plano de aplicação casando para os 15 convênios (`totalComPlano = 15`).
3. ✅ Cache Transferegov/rendimentos populado para os 15 convênios (`totalComRendimentos = 15`).
4. ⚠️ Decisão de governança formalizada sobre divergências do Grupo A (DETRU): aceitar `quantidadeTa`, `valorGlobal`, `valorRepasse`, `rendimentoAprovado` da fonte oficial.
5. ⚠️ Decisão de governança formalizada sobre divergências do Grupo B (Cálculo do plano): aceitar `saldoResidualCapital`, `saldoResidualCusteio`, `valorExecutadoGeral` calculados.
6. ⚠️ Decisão de governança formalizada sobre divergências do Grupo D (Transferegov): aceitar saldos atuais capturados frente aos valores manuais antigos.
7. ⚠️ (Recomendado) Validação visual no modo local/API antes da publicação estática.
8. ⚠️ (Recomendado) Comunicar usuários da SENAPPEN/ONASP sobre mudança de origem antes da virada, para evitar interpretações equivocadas dos novos valores.

Status em 17/05/2026:
- Critérios técnicos (1, 2 e 3): ✅ atendidos.
- Critérios de governança (4–6): ⚠️ pendentes.
- Critérios operacionais (7 e 8): ⚠️ a executar quando a governança decidir.

## 7. Rollback

A ativação futura do `banco-cache` é totalmente reversível por configuração:

```text
PROFOR_2022_ORIGEM_DADOS=planilha
```

Reverter essa variável em `.env` é suficiente para retornar à origem antiga sem alterar código, banco, JSONs publicados ou frontend.

Em caso de falha pontual do `banco-cache` após ativação, o serviço `dashboard-publication-service.js` já possui fallback automático para `planilha` (com aviso), preservando continuidade operacional sem necessidade de intervenção manual.

## 8. Histórico

| Data | Evento |
| --- | --- |
| 17/05/2026 | Criação do documento. Diagnóstico inicial das 15 divergências e classificação em Grupos A–E. Recomendação: aguardar decisão de governança antes de ativar `banco-cache`. Nenhuma alteração de código nesta etapa. |
| 17/05/2026 | Grupo D corrigido: fonte oficial de `saldoRendimentosAtual` é Transferegov Acesso Livre (consulta por número → idConvenio → seleção do instrumento → tela de rendimento), **não** DETRU nem importação manual como solução principal. Sondagem técnica revelou bloqueio SAML/SSO no IdP do Transferegov para clientes HTTP simples; implementação automatizada pendente de evidências (HAR/HTML) do usuário. Seção 5.5 reorganizada com nova ordem de preferência das alternativas. |
| 18/05/2026 | Grupo D atualizado: fluxo público Transferegov implementado no cliente local/API com cookie jar em memória e fallback público Playwright/Chromium. Cache populado para 15/15 convênios; `totalComRendimentos=15`. Divergência remanescente passa a ser governança entre saldo manual da aba `Geral` e saldo atual capturado na tela pública. |
