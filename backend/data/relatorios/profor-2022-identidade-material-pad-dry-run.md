# PROFOR 2022 — Auditoria de identidade material das linhas PAD (dry-run)

Gerado em: 2026-05-22T21:48:00.961Z
Modo: dry-run — somente leitura. Não publica, não registra decisão, não altera SQLite, origem ativa nem `planoAplicacao` oficial.

> Diagnostico da divergencia #44 (938128/SP): o PAD tinha duas linhas 'Saldo Residual' com naturezas/codigos diferentes para a mesma descricao. Chave de pareamento por descricao normalizada nao e identidade material suficiente.

## 1. Resumo

- Linhas PAD analisadas: 525
- Descrições distintas (convênio + descrição): 494
- Identidades materiais distintas (convênio + descrição + natureza + código): 499
- Descrições repetidas no convênio: 25
- Descrições com múltiplas naturezas: **2**
- Descrições com múltiplos códigos de natureza: **5**
- Saldos residuais/remanescentes: 11 (repetidos: 2)
- Grupos com risco: 34 (alto 2, médio 3, baixo 29)
- Itens conhecidos afetados por risco material: 5

Chave de identidade material recomendada: `numeroConvenio + descricaoNormalizada + natureza + codigoNaturezaDespesa`.

## 2. Grupos com risco de identidade material

| Severidade | Convênio | UF | Descrição | Linhas PAD | Naturezas | Códigos | Riscos |
|---|---|---|---|---:|---|---|---|
| alto | 938128 | SP | SALDO RESIDUAL | 2 | CUSTEIO, CAPITAL | 33903099, 44905299 | descricao_repetida_no_convenio; descricao_com_multiplas_naturezas; descricao_com_multiplos_codigos_natureza; descricao_com_valores_unitarios_distintos; saldo_residual_ou_remanescente; saldo_residual_repetido_no_convenio; mesma_descricao_capital_e_custeio |
| alto | 938277 | MA | SALDO REMANESCENTE | 2 | CUSTEIO, CAPITAL | 33903099, 44905299 | descricao_repetida_no_convenio; descricao_com_multiplas_naturezas; descricao_com_multiplos_codigos_natureza; descricao_com_valores_unitarios_distintos; saldo_residual_ou_remanescente; saldo_residual_repetido_no_convenio; mesma_descricao_capital_e_custeio |
| medio | 937265 | MS | CAMISA TATICA | 2 | CUSTEIO | 33903016, 33903023 | descricao_repetida_no_convenio; descricao_com_multiplos_codigos_natureza |
| medio | 937468 | TO | ETAPA 2 - CORREGEDORIA - CADEIRA GIRATOR | 2 | CAPITAL | 44905242, 44905299 | descricao_repetida_no_convenio; descricao_com_multiplos_codigos_natureza |
| medio | 937468 | TO | ETAPA 3 ESCOLA - BEBEDOURO DE ALUMINIO | 2 | CAPITAL | 44905242, 44905299 | descricao_repetida_no_convenio; descricao_com_multiplos_codigos_natureza; descricao_com_valores_unitarios_distintos |
| baixo | 937216 | GO | SALDO REMANESCENTE - CONFORME NOTA TECNI | 1 | CAPITAL | 44322015 | saldo_residual_ou_remanescente |
| baixo | 937221 | AL | SALDO RESIDUAL | 1 | CAPITAL | 44905299 | saldo_residual_ou_remanescente |
| baixo | 937265 | MS | AR CONDICIONADO INVERTER 12.000 BTUS | 3 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | AR CONDICIONADO INVERTER 24.000 BTUS | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | CADEIRA FIXA | 3 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | CADEIRA GIRATORIA COM BRACOS | 3 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | CALCA TATICA | 2 | CUSTEIO | 33903016 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | CINTO TATICO | 2 | CUSTEIO | 33903016 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | COMPUTADOR COMPLETO COM MONITOR | 3 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | COTURNO | 2 | CUSTEIO | 33903016 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | ESTANTE EM ACO COM 6 PRATELEIRAS | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | GELADEIRA MINIMO 410L FROST FREE 110V BRANCA | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | LONGARINA COM 3 LUGARES | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | LOUSA BRANCA, TAMANHO MINIMO 1,80X1,20 C | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | MEIA MILITAR | 2 | CUSTEIO | 33903099 | descricao_repetida_no_convenio; descricao_com_valores_unitarios_distintos |
| baixo | 937265 | MS | MESA EM L | 3 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | MICROONDAS MINIMO 20L. BRANCO 110V | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | NOTEBOOK | 2 | CAPITAL | 44905287 | descricao_repetida_no_convenio |
| baixo | 937265 | MS | PERSIANA ROLO - TECIDO BLACKOUT - ALTURA | 2 | CUSTEIO | 33903016 | descricao_repetida_no_convenio |
| baixo | 937780 | PI | SALDO RESIDUAL APOS O AJUSTE DO PT | 1 | CAPITAL | 44905242 | saldo_residual_ou_remanescente |
| baixo | 937783 | SC | ITEM 021 - SALDO REMANESCENTE CONSUMO | 1 | CUSTEIO | 33903099 | saldo_residual_ou_remanescente |
| baixo | 937783 | SC | ITEM 022 - SALDO REMANESCENTE CAPITAL | 1 | CAPITAL | 44905299 | saldo_residual_ou_remanescente |
| baixo | 937817 | RJ | SALDO REMANESCENTE - AQUISICAO | 1 | CAPITAL | 44905299 | saldo_residual_ou_remanescente |
| baixo | 937818 | PB | CONDICIONADOR DE AR TIPO SPLIT HI WALL, | 3 | CAPITAL | 44905299 | descricao_repetida_no_convenio |
| baixo | 937818 | PB | NOTEBOOK TIPO II PROCESSADOR: AMD RYZEN | 2 | CAPITAL | 44905235 | descricao_repetida_no_convenio; descricao_com_valores_unitarios_distintos |
| baixo | 937871 | PR | SALDO REMANESCENTE DE CAPITAL 44 | 1 | CAPITAL | 44905200 | saldo_residual_ou_remanescente |
| baixo | 937871 | PR | VEICULO TIPO SUV | 2 | CAPITAL | 44905248 | descricao_repetida_no_convenio; descricao_com_valores_unitarios_distintos |
| baixo | 938128 | SP | SALDO RESIDUAL SERVICOS EAP | 1 | CUSTEIO | 33903999 | saldo_residual_ou_remanescente |
| baixo | 938128 | SP | SOBRA DE SALDO RESIDUAL | 1 | CAPITAL | 44905200 | saldo_residual_ou_remanescente |

## 3. Detalhe dos grupos de severidade alta

### 938128 — SALDO RESIDUAL

| Aba | Linha | Natureza | Código | Qtd | Valor unit. | Previsto | Saldo |
|---|---:|---|---|---:|---:|---:|---:|
| 938128 | 19 | CUSTEIO | 33903099 | 1 | 71.36 | 71.36 | 71.36 |
| 938128 | 61 | CAPITAL | 44905299 | 1 | 20704.73 | 20704.73 | 20704.73 |

### 938277 — SALDO REMANESCENTE

| Aba | Linha | Natureza | Código | Qtd | Valor unit. | Previsto | Saldo |
|---|---:|---|---|---:|---:|---:|---:|
| 938277 | 27 | CUSTEIO | 33903099 | 1 | 5924.45 | 5924.45 | 5924.45 |
| 938277 | 52 | CAPITAL | 44905299 | 1 | 7267.88 | 7267.88 | 7267.88 |

## 4. Itens conhecidos afetados

| Item conhecido | Descrição | Naturezas | Códigos | Linhas PAD |
|---:|---|---|---|---:|
| 132 | 937265::CAMISA TATICA | CUSTEIO | 33903016, 33903023 | 2 |
| 231 | 938277::SALDO REMANESCENTE | CUSTEIO, CAPITAL | 33903099, 44905299 | 2 |
| 212 | 938128::SALDO RESIDUAL | CUSTEIO, CAPITAL | 33903099, 44905299 | 2 |
| 362 | 937468::ETAPA 2 - CORREGEDORIA - CADEIRA GIRATOR | CAPITAL | 44905242, 44905299 | 2 |
| 365 | 937468::ETAPA 3 ESCOLA - BEBEDOURO DE ALUMINIO | CAPITAL | 44905242, 44905299 | 2 |

Rollback: reverter o commit e regenerar os relatórios dry-run; não apagar decisões, logs, divergências nem relatórios históricos.
