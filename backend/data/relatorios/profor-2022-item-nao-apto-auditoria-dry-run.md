# PROFOR 2022 - Auditoria item_nao_apto sem divergência material

Gerado em: 2026-05-22T14:03:28.690Z
Modo: dry-run

## Resumo

- Total item_nao_apto encontrados: 19
- Candidatos a aceite automático: 1
- Falsos positivos saneáveis: 4
- Divergência material: 3
- Dados insuficientes: 0
- Já decididos: 11
- Erros de payload: 0
- Decisões aplicadas: 0

### Candidatos a aceite automático

| ID | Convênio | UF | Descrição | Qtd mem/PAD | Previsto mem/PAD | Executado mem/PAD | Saldo mem/PAD | Motivos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 38 | 937817 | RJ | CAPACETE PROTETOR | 20.000323 / 20 | 4340.07 / 4340.07 | 0 / 0 | 4340.07 / 4340.07 | Natureza, quantidade e valores coincidem dentro das tolerâncias.; Descrição normalizada coincide. |

### Falsos positivos saneáveis

| ID | Convênio | UF | Descrição | Qtd mem/PAD | Previsto mem/PAD | Executado mem/PAD | Saldo mem/PAD | Motivos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 31 | 937265 | MS | Calça Tática | 49.999486 / 50 | 16526.33 / 16526.33 | 0 / 0 | 16526.33 / 16526.33 | PAD possui 2 linhas equivalentes consolidadas por convênio, descrição, natureza e valor unitário.; Quantidade, valor previsto total e valor unitário fecham no conjunto consolidado.; Bloqueio anterior decorre de comparação contra linha PAD isolada.; Rateios da memória apresentam quantidade legada incompatível com valor previsto / valor unitário, com indício de inflação decimal.; Alertas originais indicam saldo antigo inconsistente; saldo calculado por previsto - executado fecha com o PAD consolidado. |
| 32 | 937265 | MS | Cinto Tático | 50.000622 / 50 | 10456.63 / 10456.63 | 0 / 0 | 10456.63 / 10456.63 | PAD possui 2 linhas equivalentes consolidadas por convênio, descrição, natureza e valor unitário.; Quantidade, valor previsto total e valor unitário fecham no conjunto consolidado.; Bloqueio anterior decorre de comparação contra linha PAD isolada.; Rateios da memória apresentam quantidade legada incompatível com valor previsto / valor unitário, com indício de inflação decimal.; Alertas originais indicam saldo antigo inconsistente; saldo calculado por previsto - executado fecha com o PAD consolidado. |
| 33 | 937265 | MS | Coturno | 50 / 50 | 17810 / 17810 | 0 / 0 | 17810 / 17810 | PAD possui 2 linhas equivalentes consolidadas por convênio, descrição, natureza e valor unitário.; Quantidade, valor previsto total e valor unitário fecham no conjunto consolidado.; Bloqueio anterior decorre de comparação contra linha PAD isolada.; Rateios da memória apresentam quantidade legada incompatível com valor previsto / valor unitário, com indício de inflação decimal.; Alertas originais indicam saldo antigo inconsistente; saldo calculado por previsto - executado fecha com o PAD consolidado. |
| 34 | 937265 | MS | Geladeira minimo 410L Frost Free 110v Branca | 2 / 2 | 7780 / 7780 | 5999.98 / 5999.98 | 1780.02 / 1780.02 | PAD possui 2 linhas equivalentes consolidadas por convênio, descrição, natureza e valor unitário.; Quantidade, valor previsto total e valor unitário fecham no conjunto consolidado.; Bloqueio anterior decorre de comparação contra linha PAD isolada.; Rateios da memória apresentam quantidade legada incompatível com valor previsto / valor unitário, com indício de inflação decimal.; Alertas originais indicam saldo antigo inconsistente; saldo calculado por previsto - executado fecha com o PAD consolidado. |

### Divergência material

| ID | Convênio | UF | Descrição | Qtd mem/PAD | Previsto mem/PAD | Executado mem/PAD | Saldo mem/PAD | Motivos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 39 | 938128 | SP | Agenda Planner | 10 / 10 | 1134.3 / 1134.27 | 0 / 0 | 1134.3 / 1134.27 | natureza divergente; valorPrevisto divergente (0.03); saldo divergente (0.03) |
| 44 | 938128 | SP | Saldo Residual | 1.003203 / 1 | 22351.09 / 71.36 | 0 / 0 | 22351.09 / 71.36 | natureza divergente; valorUnitario divergente (22208.37); valorPrevisto divergente (22279.73); saldo divergente (22279.73) |
| 46 | 938277 | MA | SALDO REMANESCENTE | 2.22676 / 1 | 13192.33 / 5924.45 | 0 / 0 | 13192.33 / 5924.45 | natureza divergente; quantidade divergente (1.22676); valorPrevisto divergente (7267.88); saldo divergente (7267.88) |

### Dados insuficientes

_Nenhum item._
