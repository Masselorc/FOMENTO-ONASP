# PROFOR 2022 — Classificação das divergências planilha × banco-cache

## Identificação do documento

| Campo | Valor |
| --- | --- |
| Nome do documento | PROFOR 2022 — Classificação das divergências planilha × banco-cache |
| Arquivo | `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md` |
| Status | rascunho técnico de diagnóstico |
| Última revisão | 17/05/2026 |
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
| `diagnostico.totalComRendimentos` | 0 |
| `diagnostico.totalAvisos` | 90 |
| `comparacao.totalAntigo` | 15 |
| `comparacao.totalNovo` | 15 |
| `comparacao.totalIguais` | 0 |
| `comparacao.totalComDivergencia` | 15 |
| `comparacao.totalAusentesAntigo` | 0 |
| `comparacao.totalAusentesNovo` | 0 |
| Severidade alta | 14 convênios |
| Severidade média | 1 convênio |
| Origem padrão atual (`.env`) | `PROFOR_2022_ORIGEM_DADOS=planilha` |
| `banco-cache` ativado? | **não** |

Ou seja: todos os 15 convênios da carteira estão tecnicamente compostos pelo `banco-cache` (DETRU + Plano + Carteira), mas nenhum convênio é integralmente igual ao retornado pela origem antiga `planilha` (aba `Geral`). Este documento separa essas 15 divergências em categorias técnicas e de governança para sustentar decisão segura sobre futura ativação.

## 2. Metodologia

A classificação foi feita exclusivamente por observação dos endpoints locais e diagnóstico documental, sem alteração de código de produção:

- `GET /api/profor-2022/consolidado` — origem `banco-cache` montada localmente em backend Node, sem ativar como padrão.
- `GET /api/profor-2022/comparar-origens` — compara `planilha` × `banco-cache` com tolerâncias monetária (R$ 0,01) e percentual (0,1 ponto).
- Script temporário (apagado após análise) inspecionou as 15 abas estaduais da planilha `Planilhas/gestao_financeira_ouvidoria.xlsx` e cruzou com a carteira ativa do banco local SQLite.

Critérios de classificação:

1. **Grupo A — divergência esperada por fonte oficial DETRU**: campo extraído do DETRU/cache que substitui valor manual da aba Geral.
2. **Grupo B — divergência esperada por cálculo do plano**: campo calculado por soma sobre os itens do plano de aplicação filtrados por UF + número + ano.
3. **Grupo C — divergência por ausência na origem antiga**: campo só existe no `banco-cache` (não estava extraído no nível do convênio na aba Geral).
4. **Grupo D — pendência real por ausência na origem nova**: campo existe na aba Geral, mas está `null` no `banco-cache`.
5. **Grupo E — divergência que exige validação humana**: casos isolados de divergência monetária alta que exigem análise individual.

## 3. Diagnóstico

### 3.1. Distribuição das divergências por campo (estado em 18/05/2026 02:01 UTC)

| Campo | Convênios divergentes | Status predominante | Severidade predominante |
| --- | ---: | --- | --- |
| `quantidadeTa` | 15 | `divergente` | baixa (dif=1) / média (dif=2) |
| `saldoRendimentosAtual` | 15 | `ausente_novo` | média |
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
| alta | 14 |
| média | 1 (937592/AM) |
| baixa | 0 |

Total: 15 convênios divergentes.

### 3.3. Convênios e divergências individuais (resumo)

| UF | Convênio/ano | Total divergências | Severidade |
| --- | --- | ---: | --- |
| MT | 937698/2022 | 5 | alta |
| GO | 937216/2022 | 4 | alta |
| PR | 937871/2022 | 5 | alta |
| AM | 937592/2022 | 3 | média |
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
| `saldoRendimentosAtual` | aba Geral (coluna 13, manual atualizado periodicamente) | cache Transferegov (vazio) | `ausente_novo` | 15 | **bloqueante parcial — fonte ausente** | **parcial (sim)** | Não corrigir por suposição. Cache Transferegov depende de sessão pública do convênio (regra absoluta: sem login/senha/captcha/certificado). Ver alternativas na seção 5.4 |

### 4.1. Resumo dos grupos

| Grupo | Campos | Convênios distintos | Classificação | Bloqueia? |
| --- | --- | ---: | --- | --- |
| **A — DETRU oficial** | `quantidadeTa`, `valorGlobal`, `valorRepasse`, `rendimentoAprovado` | 15 (em ao menos 1 campo) | aceitável | não |
| **B — Cálculo do plano** | `valorExecutadoGeral`, `saldoResidualCapital`, `saldoResidualCusteio` | 14 | aceitável | não |
| **C — Ausente na origem antiga** | `execucaoGeralPercentual` | 15 | não bloqueante | não |
| **D — Ausente na origem nova** | `saldoRendimentosAtual` | 15 | pendência real | **parcial** |
| **E — Validação humana** | nenhum caso identificado | 0 | — | — |

**Nenhuma divergência foi classificada como erro provável.** Todas as 75 ocorrências estão tecnicamente justificadas pela arquitetura definida nos blocos 14–18 (DETRU como fonte oficial + cálculo do plano + Transferegov para rendimento).

## 5. Recomendações técnicas

### 5.1. Opção 1 — Não ativar `banco-cache` (status quo)

**Quando aplicar**: se a tela PROFOR 2022 considerar `saldoRendimentosAtual` indispensável e a governança não autorizar exibir esse campo como `null`.

**Consequência**: a origem `planilha` continua única; o cache DETRU populado fica disponível apenas para consultas administrativas (rota local), sem impacto visual; o trabalho dos blocos 11–18 fica em modo de prontidão.

### 5.2. Opção 2 — Ativar `banco-cache` parcialmente

**Quando aplicar**: se a governança aceitar `saldoRendimentosAtual = null` com aviso explícito ao usuário até a solução do Transferegov.

**Implementação futura sugerida** (não implementar agora):
- Tornar `PROFOR_2022_ORIGEM_DADOS=banco-cache` o padrão.
- Garantir que o frontend mostre aviso visível: "Saldo de rendimentos: cache pendente; consulte o Transferegov diretamente."
- Manter a rota e o botão de atualização DETRU para refresco diário.

**Risco**: usuários podem ler `null` como "zero", reduzindo confiança operacional. Aviso de UI mitiga, mas não elimina.

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

### 5.5. Alternativas específicas para o Grupo D (`saldoRendimentosAtual`)

1. **Manter `null` com aviso**: opção mais conservadora.
2. **Manter origem `planilha` apenas para esse campo** (Opção 3): não recomendada — adiciona complexidade arquitetural.
3. **Importação manual controlada**: criar rotina local que aceita CSV/JSON exportado manualmente do Transferegov pelo responsável, gravando no cache. Permite popular o cache sem burlar sessão; trabalho operacional recorrente.
4. **Fonte pública alternativa**: pesquisar se a Plataforma +Brasil ou o Portal da Transparência publicam saldo de rendimentos. Requer pesquisa institucional formal, não diagnóstico técnico.

## 6. Critérios para ativação futura do `banco-cache`

A ativação como origem padrão (`PROFOR_2022_ORIGEM_DADOS=banco-cache`) só deve ocorrer quando **todos** os critérios abaixo forem atendidos:

1. ✅ DETRU populado para os 15 convênios da carteira (`totalComDetru = 15`).
2. ✅ Plano de aplicação casando para os 15 convênios (`totalComPlano = 15`).
3. ⚠️ Decisão de governança formalizada sobre `saldoRendimentosAtual`: aceitar `null` (Opção 2) ou outra alternativa (5.5).
4. ⚠️ Decisão de governança formalizada sobre divergências do Grupo A (DETRU): aceitar `quantidadeTa`, `valorGlobal`, `valorRepasse`, `rendimentoAprovado` da fonte oficial.
5. ⚠️ Decisão de governança formalizada sobre divergências do Grupo B (Cálculo do plano): aceitar `saldoResidualCapital`, `saldoResidualCusteio`, `valorExecutadoGeral` calculados.
6. ⚠️ (Recomendado) Validação visual no modo local/API antes da publicação estática.
7. ⚠️ (Recomendado) Comunicar usuários da SENAPPEN/ONASP sobre mudança de origem antes da virada, para evitar interpretações equivocadas dos novos valores.

Status em 17/05/2026:
- Critérios técnicos (1 e 2): ✅ atendidos.
- Critérios de governança (3–5): ⚠️ pendentes.
- Critérios operacionais (6 e 7): ⚠️ a executar quando a governança decidir.

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
