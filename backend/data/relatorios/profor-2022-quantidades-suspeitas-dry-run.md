# Auditoria de quantidades suspeitas - PROFOR 2022

Gerado em: 2026-05-22T16:56:43.709Z

## Resumo

- Total de rateios ativos auditados: 567
- Total de suspeitos: 19
- Total de convenios/UF afetados: 9

## Suspeitos (amostra)

| Rateio | Convenio/UF | Item | Classificação | Qtd gravada | Qtd estimada | Fator | Diff qtd | VU | Previsto | Fechamento diff |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 649 | 937871/PR | Veículo tipo SUV | quantidade_incompativel_com_valor_previsto | 2 | 2.454354 | 0.814878 | -0.454354 | 51133.66 | 125500.08 | -23232.76 |
| 832 | 938128/SP | Saldo Residual | quantidade_incompativel_com_valor_previsto | 1 | 0.003203 | 312.207306 | 0.996797 | 22279.73 | 71.36 | 22208.37 |
| 852 | 938277/MA | SALDO REMANESCENTE | quantidade_incompativel_com_valor_previsto | 1 | 1.22676 | 0.815155 | -0.22676 | 5924.45 | 7267.88 | -1343.43 |
| 895 | 937818/PB | NOTEBOOK TIPO II Processador: AMD Ryzen | quantidade_incompativel_com_valor_previsto | 29 | 29.445211 | 0.98488 | -0.445211 | 2464 | 72553 | -1097 |
| 998 | 937468/TO | ETAPA 3 ESCOLA - BEBEDOURO DE ALUMINIO | quantidade_incompativel_com_valor_previsto | 2 | 1.767805 | 1.131347 | 0.232195 | 3933.72 | 6954.05 | 913.39 |
| 896 | 937818/PB | NOTEBOOK TIPO II Processador: AMD Ryzen | quantidade_incompativel_com_valor_previsto | 6 | 6.267127 | 0.957376 | -0.267127 | 2464 | 15442.2 | -658.2 |
| 756 | 937265/MS | Meia Militar | quantidade_incompativel_com_valor_previsto | 57 | 57.667564 | 0.988424 | -0.667564 | 37.15 | 2142.35 | -24.8 |
| 570 | 937698/MT | Serviço de confecção de Folders, 45x45cm | quantidade_incompativel_com_valor_previsto | 5713 | 5717.621359 | 0.999192 | -4.621359 | 4.12 | 23556.6 | -19.04 |
| 568 | 937698/MT | Cartilhas, Capa: 29,7x42,2cm, 4x4 cores, | quantidade_incompativel_com_valor_previsto | 5700 | 5702.595628 | 0.999545 | -2.595628 | 7.32 | 41743 | -19 |
| 721 | 937265/MS | Alvo Silhueta padrão SAT/ANP cx com 1.000 | quantidade_incompativel_com_valor_previsto | 300 | 299.874055 | 1.00042 | 0.125945 | 7.94 | 2381 | 1 |
| 722 | 937265/MS | Alvo percepção c/ 4 cores SAT c/100unid | quantidade_incompativel_com_valor_previsto | 300 | 299.465241 | 1.001786 | 0.534759 | 1.87 | 560 | 1 |
| 932 | 937917/RO | Banner 0,60 x 0,50 | quantidade_incompativel_com_valor_previsto | 275 | 274.956542 | 1.000158 | 0.043458 | 21.17 | 5820.83 | 0.92 |
| 933 | 937917/RO | Placa PVC 70 x 60 | quantidade_incompativel_com_valor_previsto | 100 | 100.006074 | 0.999939 | -0.006074 | 54.33 | 5433.33 | -0.33 |
| 740 | 937265/MS | PASTA L | quantidade_incompativel_com_valor_previsto | 100 | 99.961202 | 1.000388 | 0.038798 | 7.99 | 798.69 | 0.31 |
| 1025 | 937817/RJ | CAIXAS DE GRAMPO COM 4000 UNIDADES | quantidade_incompativel_com_valor_previsto | 50 | 49.993722 | 1.000126 | 0.006278 | 27.08 | 1353.83 | 0.17 |
| 753 | 937265/MS | Tonfa padrão 58cm | quantidade_incompativel_com_valor_previsto | 39 | 39.001422 | 0.999964 | -0.001422 | 98.42 | 3838.52 | -0.14 |
| 976 | 937468/TO | ETAPA 3 ESCOLA - BASTÃO POLICIAL PR-24 | quantidade_incompativel_com_valor_previsto | 32 | 31.998221 | 1.000056 | 0.001779 | 61.82 | 1978.13 | 0.11 |
| 946 | 937917/RO | Apoiador de pés ergonômico | quantidade_incompativel_com_valor_previsto | 25 | 24.998989 | 1.00004 | 0.001011 | 79.1 | 1977.42 | 0.08 |
| 572 | 937698/MT | ** TA Contrapartida - Fone ouvido tipo: | quantidade_incompativel_com_valor_previsto | 5 | 4.997669 | 1.000466 | 0.002331 | 8.58 | 42.88 | 0.02 |

## Inconsistencias quantidade x valor unitario (divergencias PAD)

Auditoria somente leitura: nao registra decisao, nao altera status e nao publica.

- Inconsistencias avaliadas: 67
- Saneadas por arredondamento do valor unitario exibido: 67
- Mantidas como pendencia real: 0
- Sem dados suficientes: 0

Regra: a diferenca e falso positivo quando o valor unitario exibido coincide com o unitario efetivo (valor previsto informado / quantidade) arredondado para 2 casas e a diferenca absoluta esta dentro de quantidade x 0,005 + 0,01. O total previsto informado pelo PAD prevalece.

### Casos saneados por arredondamento

| ID | Convenio/UF | Linha PAD | Descricao | Qtd | VU exibido | VU efetivo | Previsto informado | Calculo exibido | Diff | Tolerancia |
|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 79 | 937698/937698 | 16 | Cartilhas, Capa: 29,7x42,2cm, 4x4 cores, | 5700 | 7.32 | 7.32 | 41743 | 41724 | 19 | 28.51 |
| 80 | 937698/937698 | 18 | Serviço de confecção de Folders, 45x45cm | 5713 | 4.12 | 4.12 | 23556.6 | 23537.56 | 19.04 | 28.58 |
| 81 | 937698/937698 | 19 | ** TA Contrapartida - Computador Desktop | 4 | 3462.23 | 3462.23 | 13848.91 | 13848.92 | 0.01 | 0.03 |
| 82 | 937698/937698 | 20 | ** TA Contrapartida - Fone ouvido tipo: | 5 | 8.58 | 8.58 | 42.88 | 42.9 | 0.02 | 0.04 |
| 83 | 937698/937698 | 22 | Fone ouvido tipo: fechado, dinâmico , im | 5 | 170.42 | 170.42 | 852.12 | 852.1 | 0.02 | 0.04 |
| 84 | 937698/937698 | 23 | Webcan Full HD para chamadas e gravações | 4 | 545.26 | 545.26 | 2181.05 | 2181.04 | 0.01 | 0.03 |
| 85 | 937871/937871 | 16 | * Curso de Pós Graduação Processo Admini | 20 | 2555.28 | 2555.28 | 51105.53 | 51105.6 | 0.07 | 0.11 |
| 86 | 937871/937871 | 17 | Curso de Pós Graduação em Compliance e L | 2 | 4224.67 | 4224.67 | 8449.33 | 8449.34 | 0.01 | 0.02 |
| 87 | 937592/937592 | 20 | MICROCOMPUTADOR, tipo: Estação de trabalho | 20 | 5493.81 | 5493.81 | 109876.1 | 109876.2 | 0.1 | 0.11 |
| 88 | 937265/937265 | 16 | Alvo Silhueta padrão SAT/ANP cx com 1.000 | 300 | 7.94 | 7.94 | 2381 | 2382 | 1 | 1.51 |
| 89 | 937265/937265 | 17 | Alvo percepção c/ 4 cores SAT c/100unid | 300 | 1.87 | 1.87 | 560 | 561 | 1 | 1.51 |
| 90 | 937265/937265 | 18 | Alvos Metálicos plates | 20 | 188.89 | 188.89 | 3777.87 | 3777.8 | 0.07 | 0.11 |
| 91 | 937265/937265 | 22 | Calça Tática | 30 | 330.53 | 330.53 | 9915.8 | 9915.9 | 0.1 | 0.16 |
| 92 | 937265/937265 | 23 | Calça Tática | 20 | 330.53 | 330.53 | 6610.53 | 6610.6 | 0.07 | 0.11 |
| 93 | 937265/937265 | 24 | Camisa Tática | 30 | 198.38 | 198.38 | 5951.5 | 5951.4 | 0.1 | 0.16 |
| 94 | 937265/937265 | 27 | Cinto Tático | 30 | 209.13 | 209.13 | 6273.98 | 6273.9 | 0.08 | 0.16 |
| 95 | 937265/937265 | 28 | Cinto Tático | 20 | 209.13 | 209.13 | 4182.65 | 4182.6 | 0.05 | 0.11 |
| 96 | 937265/937265 | 31 | Kit limpeza de armamento pistola SW.40 | 20 | 90.73 | 90.73 | 1814.67 | 1814.6 | 0.07 | 0.11 |
| 97 | 937265/937265 | 34 | PASTA L | 100 | 7.99 | 7.99 | 798.69 | 799 | 0.31 | 0.51 |
| 98 | 937265/937265 | 43 | Camisa Tática | 40 | 198.38 | 198.38 | 7935.33 | 7935.2 | 0.13 | 0.21 |
| 99 | 937265/937265 | 46 | Descanso para pés ergonômico | 5 | 163.77 | 163.77 | 818.87 | 818.85 | 0.02 | 0.04 |
| 100 | 937265/937265 | 48 | Tonfa padrão 58cm | 39 | 98.42 | 98.42 | 3838.52 | 3838.38 | 0.14 | 0.21 |
| 101 | 937265/937265 | 51 | Meia militar | 57 | 37.59 | 37.59 | 2142.35 | 2142.63 | 0.28 | 0.3 |
| 102 | 937265/937265 | 53 | Ar condicionado inverter 12.000 BTUs | 3 | 2595.3 | 2595.3 | 7785.91 | 7785.9 | 0.01 | 0.03 |
| 103 | 937265/937265 | 58 | Cadeira Fixa | 9 | 655.09 | 655.09 | 5895.84 | 5895.81 | 0.03 | 0.06 |
| 104 | 937265/937265 | 61 | Cadeira Giratória com braços | 5 | 2510.22 | 2510.22 | 12551.12 | 12551.1 | 0.02 | 0.04 |
| 105 | 937265/937265 | 62 | Cadeira Giratória com braços | 9 | 2510.22 | 2510.22 | 22592.01 | 22591.98 | 0.03 | 0.06 |
| 106 | 937265/937265 | 63 | Cadeira Giratória com braços | 5 | 2510.22 | 2510.22 | 12551.12 | 12551.1 | 0.02 | 0.04 |
| 107 | 938277/938277 | 35 | Curso de capacitação em VCQB (MODULO I) | 4 | 4221.04 | 4221.04 | 16884.14 | 16884.16 | 0.02 | 0.03 |
| 108 | 938128/938128 | 16 | Agenda Planner | 10 | 113.43 | 113.43 | 1134.27 | 1134.3 | 0.03 | 0.06 |
| 109 | 938128/938128 | 21 | Curso de Pós Graduação Direitos Humanos | 250 | 2181.34 | 2181.34 | 545334.9 | 545335 | 0.1 | 1.26 |
| 110 | 938128/938128 | 32 | Armário de Escritório com 02 portas Ouvi | 5 | 688.43 | 688.43 | 3442.17 | 3442.15 | 0.02 | 0.04 |
| 111 | 938128/938128 | 34 | Cadeira Giratória Modelo Presidente - Co | 28 | 720.31 | 720.31 | 20168.59 | 20168.68 | 0.09 | 0.15 |
| 112 | 938128/938128 | 56 | Monitor Vídeo 32 - para Corregedoria - CASP | 28 | 1732.33 | 1732.33 | 48505.33 | 48505.24 | 0.09 | 0.15 |
| 113 | 937780/937780 | 25 | Urnas de Acrílico | 18 | 189.38 | 189.38 | 3408.8 | 3408.84 | 0.04 | 0.1 |
| 114 | 937917/937917 | 16 | Descanso Ergonômico Apoio de punho para | 25 | 99.9 | 99.9 | 2497.42 | 2497.5 | 0.08 | 0.14 |
| 115 | 937917/937917 | 18 | Banner 0,60 x 0,50 | 275 | 21.17 | 21.17 | 5820.83 | 5821.75 | 0.92 | 1.39 |
| 116 | 937917/937917 | 19 | Placa PVC 70 x 60 | 100 | 54.33 | 54.33 | 5433.33 | 5433 | 0.33 | 0.51 |
| 117 | 937917/937917 | 25 | Microfone de Lapela sem fio | 2 | 3566.85 | 3566.85 | 7133.69 | 7133.7 | 0.01 | 0.02 |
| 118 | 937917/937917 | 30 | Notebook core i7 8GB 512GB SSD Tela Full | 2 | 6546.04 | 6546.04 | 13092.07 | 13092.08 | 0.01 | 0.02 |
| 119 | 937917/937917 | 32 | Apoiador de pés ergonômico | 25 | 79.1 | 79.1 | 1977.42 | 1977.5 | 0.08 | 0.14 |
| 120 | 937917/937917 | 34 | Ar Condicionado Split12.000 BTUS (instalado) | 5 | 1823 | 1823 | 9114.98 | 9115 | 0.02 | 0.04 |
| 121 | 937917/937917 | 35 | Armário Alto Organizado | 3 | 884.9 | 884.9 | 2654.71 | 2654.7 | 0.01 | 0.03 |
| 122 | 937917/937917 | 40 | Computador 8gb Ddr4 Ssd 240 gb Monitor 1 | 2 | 2429.77 | 2429.77 | 4859.53 | 4859.54 | 0.01 | 0.02 |
| 123 | 937917/937917 | 41 | Computador de Mesa (desktop) PROCESSADOR | 12 | 2928.39 | 2928.39 | 35140.64 | 35140.68 | 0.04 | 0.07 |
| 124 | 937917/937917 | 46 | Nobreak 1.200 VA | 5 | 866.07 | 866.07 | 4330.33 | 4330.35 | 0.02 | 0.04 |
| 125 | 937917/937917 | 47 | Nobreak 1200Va 120V | 12 | 827.85 | 827.85 | 9934.16 | 9934.2 | 0.04 | 0.07 |
| 126 | 937917/937917 | 48 | Nobreak XNB 720 VA - 120V | 8 | 438.9 | 438.9 | 3511.23 | 3511.2 | 0.03 | 0.05 |
| 127 | 937917/937917 | 51 | Televisor 43 Smart TV 4K | 2 | 2532.94 | 2532.94 | 5065.87 | 5065.88 | 0.01 | 0.02 |
| 128 | 937468/937468 | 25 | ETAPA 3 ESCOLA - BASTÃO POLICIAL PR-24 | 32 | 61.82 | 61.82 | 1978.13 | 1978.24 | 0.11 | 0.17 |
| 129 | 937468/937468 | 38 | ETAPA 3 ESCOLA - PLACA DE MEMÓRIA RAM 1 | 6 | 344.91 | 344.91 | 2069.44 | 2069.46 | 0.02 | 0.04 |
| 130 | 937468/937468 | 68 | ETAPA 3 ESCOLA - PISTOLA AIRSOFT-ELÉTRI | 8 | 1278.83 | 1278.83 | 10230.67 | 10230.64 | 0.03 | 0.05 |
| 131 | 937817/937817 | 16 | ABAFADOR ELETRONICO TIRO ESPORTIVO | 45 | 386.8 | 386.8 | 17406.15 | 17406 | 0.15 | 0.24 |
| 132 | 937817/937817 | 18 | APARADOR DE CHUTE | 10 | 237.6 | 237.6 | 2375.97 | 2376 | 0.03 | 0.06 |
| 133 | 937817/937817 | 21 | CAIXAS DE GRAMPO COM 4000 UNIDADES | 50 | 27.08 | 27.08 | 1353.83 | 1354 | 0.17 | 0.26 |
| 134 | 937817/937817 | 22 | CAPACETE PROTETOR | 20 | 217 | 217 | 4340.07 | 4340 | 0.07 | 0.11 |
| 135 | 937817/937817 | 23 | FACA DE TREINO | 30 | 169.53 | 169.53 | 5086 | 5085.9 | 0.1 | 0.16 |
| 136 | 937817/937817 | 24 | GRAMPEADOR PROFISSIONAL PARA MADEIRA | 10 | 94.67 | 94.67 | 946.66 | 946.7 | 0.04 | 0.06 |
| 137 | 937817/937817 | 25 | LUVA DE BOXE | 27 | 262.8 | 262.8 | 7095.51 | 7095.6 | 0.09 | 0.15 |
| 138 | 937817/937817 | 31 | PLACAS DE TATAME DE 40MM | 40 | 584.43 | 584.43 | 23377.33 | 23377.2 | 0.13 | 0.21 |
| 139 | 937817/937817 | 36 | AR CONDICIONADO JANELA 18.000 BTUs | 5 | 3137.95 | 3137.95 | 15689.73 | 15689.75 | 0.02 | 0.04 |
| 140 | 937817/937817 | 37 | AR CONDICIONADO SPLIT 18.000 BTUs | 10 | 2782.3 | 2782.3 | 27822.97 | 27823 | 0.03 | 0.06 |
| 141 | 937817/937817 | 55 | MANEQUIM DE TREINAMENTO RCP | 4 | 5737.91 | 5737.91 | 22951.65 | 22951.64 | 0.01 | 0.03 |
| 142 | 937817/937817 | 65 | PROJETOR INTERATIVO | 3 | 20765.67 | 20765.67 | 62297 | 62297.01 | 0.01 | 0.03 |
| 143 | 937817/937817 | 70 | TELEFONE SEM FIO | 12 | 209.63 | 209.63 | 2515.52 | 2515.56 | 0.04 | 0.07 |
| 144 | 937817/937817 | 71 | TENDAS BRANCAS DE PRAIA 3X3M | 5 | 253.07 | 253.07 | 1265.33 | 1265.35 | 0.02 | 0.04 |
| 145 | 937817/937817 | 74 | VENTILADOR 50 CM PAREDE | 10 | 177.55 | 177.55 | 1775.47 | 1775.5 | 0.03 | 0.06 |

### Casos mantidos como pendencia real

Nenhum.

### Justificativa por ID

- #79 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (7.32) coincide com o unitario efetivo arredondado (7.32); diferenca 19 dentro da tolerancia 28.51. O total previsto informado pelo PAD prevalece.
- #80 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (4.12) coincide com o unitario efetivo arredondado (4.12); diferenca 19.04 dentro da tolerancia 28.58. O total previsto informado pelo PAD prevalece.
- #81 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (3462.23) coincide com o unitario efetivo arredondado (3462.23); diferenca 0.01 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #82 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (8.58) coincide com o unitario efetivo arredondado (8.58); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #83 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (170.42) coincide com o unitario efetivo arredondado (170.42); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #84 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (545.26) coincide com o unitario efetivo arredondado (545.26); diferenca 0.01 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #85 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2555.28) coincide com o unitario efetivo arredondado (2555.28); diferenca 0.07 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #86 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (4224.67) coincide com o unitario efetivo arredondado (4224.67); diferenca 0.01 dentro da tolerancia 0.02. O total previsto informado pelo PAD prevalece.
- #87 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (5493.81) coincide com o unitario efetivo arredondado (5493.81); diferenca 0.1 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #88 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (7.94) coincide com o unitario efetivo arredondado (7.94); diferenca 1 dentro da tolerancia 1.51. O total previsto informado pelo PAD prevalece.
- #89 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (1.87) coincide com o unitario efetivo arredondado (1.87); diferenca 1 dentro da tolerancia 1.51. O total previsto informado pelo PAD prevalece.
- #90 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (188.89) coincide com o unitario efetivo arredondado (188.89); diferenca 0.07 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #91 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (330.53) coincide com o unitario efetivo arredondado (330.53); diferenca 0.1 dentro da tolerancia 0.16. O total previsto informado pelo PAD prevalece.
- #92 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (330.53) coincide com o unitario efetivo arredondado (330.53); diferenca 0.07 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #93 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (198.38) coincide com o unitario efetivo arredondado (198.38); diferenca 0.1 dentro da tolerancia 0.16. O total previsto informado pelo PAD prevalece.
- #94 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (209.13) coincide com o unitario efetivo arredondado (209.13); diferenca 0.08 dentro da tolerancia 0.16. O total previsto informado pelo PAD prevalece.
- #95 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (209.13) coincide com o unitario efetivo arredondado (209.13); diferenca 0.05 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #96 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (90.73) coincide com o unitario efetivo arredondado (90.73); diferenca 0.07 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #97 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (7.99) coincide com o unitario efetivo arredondado (7.99); diferenca 0.31 dentro da tolerancia 0.51. O total previsto informado pelo PAD prevalece.
- #98 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (198.38) coincide com o unitario efetivo arredondado (198.38); diferenca 0.13 dentro da tolerancia 0.21. O total previsto informado pelo PAD prevalece.
- #99 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (163.77) coincide com o unitario efetivo arredondado (163.77); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #100 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (98.42) coincide com o unitario efetivo arredondado (98.42); diferenca 0.14 dentro da tolerancia 0.21. O total previsto informado pelo PAD prevalece.
- #101 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (37.59) coincide com o unitario efetivo arredondado (37.59); diferenca 0.28 dentro da tolerancia 0.3. O total previsto informado pelo PAD prevalece.
- #102 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2595.3) coincide com o unitario efetivo arredondado (2595.3); diferenca 0.01 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #103 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (655.09) coincide com o unitario efetivo arredondado (655.09); diferenca 0.03 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
- #104 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2510.22) coincide com o unitario efetivo arredondado (2510.22); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #105 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2510.22) coincide com o unitario efetivo arredondado (2510.22); diferenca 0.03 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
- #106 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2510.22) coincide com o unitario efetivo arredondado (2510.22); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #107 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (4221.04) coincide com o unitario efetivo arredondado (4221.04); diferenca 0.02 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #108 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (113.43) coincide com o unitario efetivo arredondado (113.43); diferenca 0.03 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
- #109 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2181.34) coincide com o unitario efetivo arredondado (2181.34); diferenca 0.1 dentro da tolerancia 1.26. O total previsto informado pelo PAD prevalece.
- #110 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (688.43) coincide com o unitario efetivo arredondado (688.43); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #111 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (720.31) coincide com o unitario efetivo arredondado (720.31); diferenca 0.09 dentro da tolerancia 0.15. O total previsto informado pelo PAD prevalece.
- #112 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (1732.33) coincide com o unitario efetivo arredondado (1732.33); diferenca 0.09 dentro da tolerancia 0.15. O total previsto informado pelo PAD prevalece.
- #113 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (189.38) coincide com o unitario efetivo arredondado (189.38); diferenca 0.04 dentro da tolerancia 0.1. O total previsto informado pelo PAD prevalece.
- #114 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (99.9) coincide com o unitario efetivo arredondado (99.9); diferenca 0.08 dentro da tolerancia 0.14. O total previsto informado pelo PAD prevalece.
- #115 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (21.17) coincide com o unitario efetivo arredondado (21.17); diferenca 0.92 dentro da tolerancia 1.39. O total previsto informado pelo PAD prevalece.
- #116 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (54.33) coincide com o unitario efetivo arredondado (54.33); diferenca 0.33 dentro da tolerancia 0.51. O total previsto informado pelo PAD prevalece.
- #117 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (3566.85) coincide com o unitario efetivo arredondado (3566.85); diferenca 0.01 dentro da tolerancia 0.02. O total previsto informado pelo PAD prevalece.
- #118 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (6546.04) coincide com o unitario efetivo arredondado (6546.04); diferenca 0.01 dentro da tolerancia 0.02. O total previsto informado pelo PAD prevalece.
- #119 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (79.1) coincide com o unitario efetivo arredondado (79.1); diferenca 0.08 dentro da tolerancia 0.14. O total previsto informado pelo PAD prevalece.
- #120 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (1823) coincide com o unitario efetivo arredondado (1823); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #121 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (884.9) coincide com o unitario efetivo arredondado (884.9); diferenca 0.01 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #122 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2429.77) coincide com o unitario efetivo arredondado (2429.77); diferenca 0.01 dentro da tolerancia 0.02. O total previsto informado pelo PAD prevalece.
- #123 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2928.39) coincide com o unitario efetivo arredondado (2928.39); diferenca 0.04 dentro da tolerancia 0.07. O total previsto informado pelo PAD prevalece.
- #124 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (866.07) coincide com o unitario efetivo arredondado (866.07); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #125 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (827.85) coincide com o unitario efetivo arredondado (827.85); diferenca 0.04 dentro da tolerancia 0.07. O total previsto informado pelo PAD prevalece.
- #126 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (438.9) coincide com o unitario efetivo arredondado (438.9); diferenca 0.03 dentro da tolerancia 0.05. O total previsto informado pelo PAD prevalece.
- #127 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2532.94) coincide com o unitario efetivo arredondado (2532.94); diferenca 0.01 dentro da tolerancia 0.02. O total previsto informado pelo PAD prevalece.
- #128 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (61.82) coincide com o unitario efetivo arredondado (61.82); diferenca 0.11 dentro da tolerancia 0.17. O total previsto informado pelo PAD prevalece.
- #129 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (344.91) coincide com o unitario efetivo arredondado (344.91); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #130 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (1278.83) coincide com o unitario efetivo arredondado (1278.83); diferenca 0.03 dentro da tolerancia 0.05. O total previsto informado pelo PAD prevalece.
- #131 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (386.8) coincide com o unitario efetivo arredondado (386.8); diferenca 0.15 dentro da tolerancia 0.24. O total previsto informado pelo PAD prevalece.
- #132 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (237.6) coincide com o unitario efetivo arredondado (237.6); diferenca 0.03 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
- #133 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (27.08) coincide com o unitario efetivo arredondado (27.08); diferenca 0.17 dentro da tolerancia 0.26. O total previsto informado pelo PAD prevalece.
- #134 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (217) coincide com o unitario efetivo arredondado (217); diferenca 0.07 dentro da tolerancia 0.11. O total previsto informado pelo PAD prevalece.
- #135 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (169.53) coincide com o unitario efetivo arredondado (169.53); diferenca 0.1 dentro da tolerancia 0.16. O total previsto informado pelo PAD prevalece.
- #136 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (94.67) coincide com o unitario efetivo arredondado (94.67); diferenca 0.04 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
- #137 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (262.8) coincide com o unitario efetivo arredondado (262.8); diferenca 0.09 dentro da tolerancia 0.15. O total previsto informado pelo PAD prevalece.
- #138 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (584.43) coincide com o unitario efetivo arredondado (584.43); diferenca 0.13 dentro da tolerancia 0.21. O total previsto informado pelo PAD prevalece.
- #139 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (3137.95) coincide com o unitario efetivo arredondado (3137.95); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #140 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (2782.3) coincide com o unitario efetivo arredondado (2782.3); diferenca 0.03 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
- #141 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (5737.91) coincide com o unitario efetivo arredondado (5737.91); diferenca 0.01 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #142 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (20765.67) coincide com o unitario efetivo arredondado (20765.67); diferenca 0.01 dentro da tolerancia 0.03. O total previsto informado pelo PAD prevalece.
- #143 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (209.63) coincide com o unitario efetivo arredondado (209.63); diferenca 0.04 dentro da tolerancia 0.07. O total previsto informado pelo PAD prevalece.
- #144 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (253.07) coincide com o unitario efetivo arredondado (253.07); diferenca 0.02 dentro da tolerancia 0.04. O total previsto informado pelo PAD prevalece.
- #145 (falso_positivo_saneavel): Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: unitario exibido (177.55) coincide com o unitario efetivo arredondado (177.55); diferenca 0.03 dentro da tolerancia 0.06. O total previsto informado pelo PAD prevalece.
