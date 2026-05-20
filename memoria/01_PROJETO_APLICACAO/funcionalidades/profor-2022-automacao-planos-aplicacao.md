# PROFOR 2022 — Orientação para Substituição das Abas por UF pelo Relatório PAD

## 1. Finalidade deste documento

Este documento orienta agentes de IA, Codex, revisores técnicos e desenvolvedores na implementação da substituição das abas/guias por UF da planilha antiga de gestão financeira pela nova sistemática baseada em relatórios PAD (`RelatorioItensDespesasPAD_*.xls`).

O objetivo é permitir que a aplicação FOMENTO-ONASP deixe de depender das abas/guias por UF para alimentar o `planoAplicacao`, preservando a divisão manual já existente dos itens entre áreas como `OUVIDORIA`, `CORREGEDORIA`, `ESCOLA PENAL`, `N/A` ou outras classificações institucionais.

Este documento não trata da antiga aba `Geral`. A aba `Geral` já foi substituída por outras fontes e está fora do escopo desta frente.

---

## 2. Escopo desta frente

### 2.1. Dentro do escopo

Esta frente trata de:

- substituir as abas/guias por UF da planilha antiga como fonte do `planoAplicacao`;
- ler relatórios PAD em formato `.xls`;
- extrair itens agregados dos relatórios PAD;
- identificar o convênio pelo conteúdo interno do relatório;
- deduzir UF, ano e instrumento a partir da carteira monitorada;
- preservar a memória de rateio dos itens entre áreas;
- permitir classificação e rateio manual de novos itens pela aplicação;
- detectar itens novos;
- detectar itens ausentes em atualizações futuras;
- emitir alertas de pendência de rateio e validação de exclusão;
- reconstruir o `planoAplicacao` em linhas por área;
- validar fechamento financeiro por item e por convênio;
- integrar a nova origem somente por flag, preservando fallback.

### 2.2. Fora do escopo

Não fazem parte desta frente:

- substituição da aba `Geral`;
- dados cadastrais gerais do convênio já migrados para carteira monitorada, DETRU/cache ou Transferegov/cache;
- processo SEI, vencimento, quantidade de TA, valor global, repasse, contrapartida, desembolsado, rendimento aprovado e saldo de rendimentos atual;
- alteração inicial da interface pública;
- publicação automática sem validação;
- automação direta do Transferegov;
- login, credenciais, cookies fixos, captcha, scraping autenticado ou área restrita.

---

## 3. Arquivos e serviços que agentes devem ler antes de implementar

Antes de qualquer alteração nesta frente, o agente deve ler:

- `AGENTS.md`;
- `memoria/INDEX.md`;
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`;
- este arquivo;
- `backend/data/aplicacao.json`;
- `backend/services/dashboard-publication-service.js`;
- `backend/services/profor-2022/profor-consolidado-service.js`;
- `backend/services/profor-2022/profor-plano-aplicacao-service.js`;
- `backend/services/static-publication-service.js`;
- `backend/server.js`.

Quando houver persistência, ler também:

- `backend/db/init-db.js`;
- `backend/db/database.js`;
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`.

---

## 4. Origem antiga a ser substituída

A origem antiga desta frente são as abas/guias por UF da planilha original, usadas para alimentar o `planoAplicacao`.

No código atual, o plano de aplicação é estruturado com campos equivalentes a:

```js
{
  uf,
  instrumento,
  numero,
  ano,
  area,
  natureza,
  descricao,
  quantidade,
  valorUnitario,
  valorPrevisto,
  valorExecutado,
  saldo,
  saldoEconomicidade,
  percentualExecucao
}
```

A planilha antiga podia conter o mesmo item repetido em várias linhas, com a mesma descrição, mas distribuído entre áreas diferentes.

Exemplo antigo:

| Descrição | Área | Quantidade |
| --- | --- | ---: |
| Notebook | OUVIDORIA | 3 |
| Notebook | CORREGEDORIA | 3 |
| Notebook | ESCOLA PENAL | 3 |

Na nova origem PAD, esse mesmo item pode vir agregado em uma única linha:

| Descrição | Quantidade |
| --- | ---: |
| Notebook | 9 |

Portanto, a substituição não é linha por linha. O sistema deve reconstruir as linhas por área com base em uma memória de rateio manual.

---

## 5. Nova origem principal: relatório PAD

A nova fonte dos itens será composta por arquivos do tipo:

```text
RelatorioItensDespesasPAD_*.xls
```

O arquivo é um `.xls` antigo, não `.xlsx`. O importador deve testar explicitamente a leitura com a biblioteca `xlsx` já usada pelo projeto.

### 5.1. Identificação do convênio

A identificação do convênio não deve depender do nome do arquivo.

A fonte principal é o conteúdo interno da planilha, especialmente:

```text
Código do Instrumento
```

O nome da aba pode conter o número do instrumento e pode ser usado como validação auxiliar, mas não deve ser a fonte principal.

### 5.2. Estrutura esperada do relatório PAD

O relatório PAD observado possui estrutura semelhante a:

```text
Código do Instrumento
Concedente
Convenente
Situação
Valor Total Previsto
Valor Previsto Custeio
Valor Previsto Investimento
Valor Total Executado
Valor Executado Custeio
Valor Executado Investimento
Saldo Total
Saldo Custeio
Saldo Investimento
Data/hora de geração
Tabela de itens
Total Geral
```

Colunas esperadas da tabela de itens:

| Coluna no PAD | Significado |
| --- | --- |
| `Tipo Despesa` | Tipo de despesa informado no relatório. |
| `Descrição` | Nome do item. |
| `Cód. Nat. Despesa` | Código da natureza da despesa. |
| `Unid` | Unidade. |
| `Quantidade` | Quantidade agregada do item. |
| `Valor Unit` | Valor unitário. |
| `Valor Total Previsto` | Valor total previsto agregado. |
| `Valor Total Executado` | Valor total executado agregado. |
| `Saldo` | Saldo agregado do item. |

### 5.3. Regra de leitura da coluna Quantidade

A coluna `Quantidade` possui normalização própria, separada do normalizador
monetário. Nos arquivos `RelatorioItensDespesasPAD_*.xls` exportados do
Transferegov, o ponto eventualmente presente na quantidade deve ser
interpretado como separador decimal, não como separador de milhar. Assim,
valores como `1.0`, `2.0`, `57.0` e `5700.0` devem ser lidos como `1`, `2`,
`57` e `5700`, respectivamente.

Tratar o ponto como separador de milhar (como faz o normalizador de moeda)
inflaria `1.0` para `10`, `57.0` para `570` e `5700.0` para `57000`.

Essa regra não se aplica aos campos monetários (`Valor Unit`, `Valor Total
Previsto`, `Valor Total Executado`, `Saldo`), que seguem o normalizador de
moeda. A coluna `Quantidade` trata tanto o ponto quanto a vírgula como
separador decimal e não admite separador de milhar.

### 5.4. Valor Unit como referência auxiliar

O `Valor Unit` exibido no relatório PAD pode estar arredondado ou truncado
para apresentação, enquanto o `Valor Total Previsto` preserva a precisão
original. Portanto, o `Valor Unit` exibido é referência auxiliar e indício de
equivalência — não deve ser usado para recalcular o `Valor Total Previsto`.

Exemplos observados no convênio 937698:

- Cartilhas: quantidade `5700`, `Valor Unit` exibido `7,32`, `Valor Total
  Previsto` `41.743,00`. O valor unitário implícito (`previsto ÷ quantidade`)
  é `7,323333...`.
- Folders: quantidade `5713`, `Valor Unit` exibido `4,12`, `Valor Total
  Previsto` `23.556,60`. O valor unitário implícito é `4,123333...`.

Nesses casos, `quantidade × Valor Unit exibido` diverge do `Valor Total
Previsto` por truncamento do valor unitário exibido, não por erro de
quantidade ou de total.

A comparação `Valor Unit` do PAD contra `valor_unitario_referencia` da memória
de rateio continua sendo apenas indício de equivalência para decisão humana —
nunca critério de matching automático.

---

## 6. Matriz de associação entre origem antiga e nova origem

| Campo atual nas abas por UF | Nova fonte | Regra de obtenção |
| --- | --- | --- |
| `uf` | Carteira monitorada | Deduzir pelo `numero_convenio` extraído do PAD. |
| `instrumento` | Carteira monitorada | Deduzir pelo `numero_convenio`; fallback controlado: `Convênio`. |
| `numero` | Relatório PAD | Extrair de `Código do Instrumento`. |
| `ano` | Carteira monitorada | Deduzir pelo `numero_convenio`. Não usar data de geração do relatório. |
| `area` | Base de rateio manual | Reconstruir por rateio/classificação salva. Não vem do PAD. |
| `natureza` | Derivação do `Cód. Nat. Despesa` | `33` = `CUSTEIO`; `44` = `CAPITAL`. |
| `descricao` | Relatório PAD | Coluna `Descrição`. Chave principal de identificação do item. |
| `quantidade` | Relatório PAD + rateio | PAD traz quantidade agregada (ver §5.3); aplicação distribui por área. |
| `valorUnitario` | Relatório PAD (auxiliar) / derivação | Coluna `Valor Unit` como referência auxiliar (ver §5.4); na linha reconstruída, derivar de `valorPrevistoRateado ÷ quantidadeRateada` (ver §12.2). |
| `valorPrevisto` | Relatório PAD + rateio | PAD traz total agregado; aplicação distribui por área. |
| `valorExecutado` | Relatório PAD + rateio | PAD traz total agregado; aplicação distribui por área. |
| `saldo` | Relatório PAD + rateio | PAD traz saldo agregado; aplicação distribui por área e valida contra `valorPrevisto - valorExecutado`. |
| `saldoEconomicidade` | Cálculo interno/regra vigente | Não vem do PAD. Não inventar regra nova nesta frente. |
| `percentualExecucao` | Cálculo interno | `valorExecutado / valorPrevisto * 100`, quando `valorPrevisto > 0`. |

---

## 7. Campos novos necessários

A nova origem deve carregar campos adicionais para rastreabilidade, rateio e controle de ciclo de vida.

| Campo novo | Fonte | Finalidade |
| --- | --- | --- |
| `tipoDespesa` | PAD | Preservar classificação original do relatório. |
| `codigoNaturezaDespesa` | PAD | Derivar `natureza` e reduzir ambiguidades. |
| `unidade` | PAD | Apoiar identificação e conferência do item. |
| `descricaoNormalizada` | Calculado | Chave técnica para reaproveitamento de rateio. |
| `arquivoOrigem` | Nome do arquivo | Rastreabilidade. |
| `geradoEmRelatorio` | Cabeçalho do PAD | Data/hora da extração. |
| `statusItem` | Sistema | Controlar item ativo, novo, ausente, excluído, substituído ou reativado. |
| `classificacaoOrigem` | Sistema | Indicar se rateio foi reaproveitado, criado manualmente, pendente ou validado. |
| `pendenteRateio` | Sistema | Indicar item novo sem rateio. |
| `pendenteValidacaoExclusao` | Sistema | Indicar item conhecido ausente no PAD atual. |

---

## 8. Regras definidas pelo usuário

### 8.1. Escopo

1. A aba `Geral` já foi integralmente substituída.
2. A aba `Geral` não é objeto desta frente.
3. O trabalho atual trata apenas da substituição das abas/guias por UF.
4. A planilha original com abas/guias deve ser descontinuada/removida ao final do processo.
5. A nova fonte será composta por relatórios PAD `.xls`, um para cada convênio.

### 8.2. Identificação do convênio

6. O convênio não será identificado pelo nome do arquivo.
7. O convênio será identificado pelos dados internos da planilha PAD.
8. O campo principal é `Código do Instrumento`.
9. O nome da aba pode ser usado apenas como validação auxiliar.
10. O ano será deduzido pelo número do convênio.
11. O ano não deve ser extraído da data de geração do relatório.
12. A UF também deve ser deduzida pela carteira monitorada a partir do número do convênio.

### 8.3. Natureza de despesa

13. Se `Cód. Nat. Despesa` iniciar por `33`, a natureza será `CUSTEIO`.
14. Se `Cód. Nat. Despesa` iniciar por `44`, a natureza será `CAPITAL`.
15. O código deve ser tratado como texto.
16. Caracteres não numéricos podem ser removidos antes de verificar o prefixo.
17. Códigos que não iniciem por `33` nem `44` devem gerar alerta de natureza não classificada.

### 8.4. Identificação dos itens

18. A identificação de item coincidente será feita pelo nome do item.
19. Se o nome do item for exatamente igual, trata-se do mesmo item.
20. O sistema não deve usar similaridade aproximada para considerar itens iguais.
21. Não usar regra do tipo “parecido com”, “contém”, “começa com” ou distância textual.
22. O sistema pode normalizar tecnicamente o texto para remover ruídos de espaços, entidades HTML e quebras de linha.
23. A normalização não deve alterar semanticamente a descrição.
24. Se o item reaparecer com o mesmo nome em atualização futura, deve manter o rateio salvo.

### 8.5. Classificação e rateio por área

25. A área não vem do relatório PAD.
26. A área foi classificada manualmente na planilha antiga.
27. Essa classificação deve ser preservada pela aplicação.
28. O dado correto a persistir não é apenas `item -> area`, mas `item -> rateio entre áreas`.
29. Um mesmo item pode ter sido duplicado ou triplicado na planilha antiga por distribuição entre áreas.
30. Exemplo: 9 notebooks podem estar divididos em 3 para Ouvidoria, 3 para Corregedoria e 3 para Escola Penal.
31. O relatório PAD novo virá com o item agregado, exemplo: 9 notebooks em uma linha.
32. A aplicação deve manter a divisão feita entre as áreas.
33. A aplicação deve reconstruir múltiplas linhas do `planoAplicacao` a partir de um item agregado do PAD.
34. A aplicação deve permitir fazer esse rateio manual futuramente.
35. Uma vez feito o rateio, ele deve ser mantido nas próximas atualizações.
36. A classificação não deve ser preenchida automaticamente como `OUVIDORIA` para todos os itens.

### 8.6. Itens novos

37. Se surgirem novos itens nas atualizações, o sistema deve emitir alerta de pendência para classificação/rateio.
38. O sistema não deve classificar automaticamente item novo.
39. Item novo deve ficar pendente até validação/classificação pelo usuário.
40. Depois de classificado/rateado, o item novo passa a manter essa classificação/rateio nas próximas atualizações.

### 8.7. Itens desaparecidos

41. Se um item desaparecer em atualização futura, significa que ele foi excluído do plano ou provavelmente substituído por outro.
42. O sistema não deve apagar automaticamente item desaparecido.
43. O sistema deve emitir alerta para o usuário validar a exclusão.
44. A validação de exclusão deve ser feita pelo usuário.
45. O sistema deve permitir distinguir item excluído, item substituído e item apenas ausente temporariamente.
46. Se item ausente reaparecer depois, o sistema deve alertar reativação/reentrada e reaplicar o rateio salvo.

### 8.8. Publicação e bloqueios

47. O modo dry-run pode listar pendências sem bloquear.
48. A publicação não deve ocorrer se houver item novo sem rateio.
49. A publicação não deve ocorrer se houver item ausente sem validação de exclusão.
50. A publicação não deve ocorrer se houver divergência financeira crítica.
51. A publicação só deve ocorrer quando todos os relatórios estiverem lidos, validados, cruzados com a carteira e sem pendências críticas.
52. Os JSONs publicados não devem ser editados manualmente.
53. A aplicação deve preservar modo local/API e modo estático/GitHub Pages.

### 8.9. Fechamento financeiro e cálculo

54. O valor previsto do PAD é o valor agregado do item.
55. O valor executado do PAD é o valor agregado do item.
56. O saldo do PAD é o saldo agregado do item.
57. A aplicação deve ratear esses valores conforme o rateio salvo.
58. A soma das linhas geradas por área deve bater com o total do PAD.
59. Diferenças de centavos devem ser ajustadas de forma controlada.
60. O percentual de execução deve ser calculado internamente.
61. O saldo deve ser validado contra `valorPrevisto - valorExecutado`.

---

## 9. Modelo de persistência recomendado

A aplicação deverá preservar três memórias operacionais:

1. memória de rateio;
2. memória de existência do item;
3. memória de validação pelo usuário.

### 9.1. Tabela de itens conhecidos

Tabela sugerida:

```text
profor_pad_itens_conhecidos
```

Campos recomendados:

```text
id
numero_convenio
descricao_normalizada
descricao_original_referencia
codigo_natureza_despesa
unidade
status_item
ultima_ocorrencia_em
ultima_ausencia_em
validacao_exclusao
item_substituido_id
motivo_substituicao
observacao_substituicao
validado_por
validado_em
observacao
criado_em
atualizado_em
```

### 9.2. Tabela de rateio por área

Tabela sugerida:

```text
profor_pad_item_rateios
```

Campos recomendados:

```text
id
item_conhecido_id
area
quantidade_referencia
percentual_quantidade
percentual_valor
ativo
criado_em
atualizado_em
```

### 9.3. Exportação/importação de backup

Embora a fonte operacional recomendada seja SQLite, deve existir exportação/importação JSON para backup e rastreabilidade.

Arquivo possível:

```text
Planilhas/profor-2022/rateio-itens-plano-aplicacao.json
```

ou:

```text
backend/data/profor-2022-rateio-itens.json
```

A escolha final deve respeitar `.gitignore`, segurança e política de versionamento do projeto.

---

## 10. Estados dos itens

| Estado | Descrição | Ação |
| --- | --- | --- |
| `ATIVO` | Item conhecido e presente no PAD atual | Aplicar rateio automaticamente. |
| `PENDENTE_RATEIO` | Item novo sem rateio | Gerar alerta e aguardar classificação/rateio. |
| `AUSENTE_NO_PAD` | Item conhecido não apareceu no relatório atual | Gerar alerta de possível exclusão/substituição. |
| `EXCLUSAO_VALIDADA` | Usuário confirmou exclusão | Não gerar linha ativa no plano. |
| `SUBSTITUIDO` | Usuário vinculou item antigo a item novo | Manter rastreabilidade da substituição. |
| `REATIVADO` | Item ausente voltou a aparecer | Alertar e reaplicar rateio salvo. |
| `INATIVO` | Item desativado no controle interno | Não usar na reconstrução, salvo reativação manual. |

---

## 11. Regra de reconstrução do plano de aplicação

Para cada item agregado do PAD:

1. extrair `numeroConvenio`;
2. buscar UF, ano e instrumento na carteira monitorada;
3. normalizar a descrição;
4. buscar item conhecido;
5. se item conhecido e ativo, buscar rateios ativos;
6. se houver rateio, gerar uma linha do `planoAplicacao` para cada área;
7. se não houver rateio, gerar pendência;
8. calcular quantidade, valor previsto, valor executado e saldo por área;
9. calcular percentual de execução por linha;
10. validar fechamento financeiro contra o total agregado do PAD.

### 11.1. Exemplo

PAD:

| Descrição | Quantidade | Valor previsto | Valor executado | Saldo |
| --- | ---: | ---: | ---: | ---: |
| Notebook | 9 | 45.000,00 | 15.000,00 | 30.000,00 |

Rateio salvo:

| Área | Quantidade referência | Percentual |
| --- | ---: | ---: |
| OUVIDORIA | 3 | 33,333333% |
| CORREGEDORIA | 3 | 33,333333% |
| ESCOLA PENAL | 3 | 33,333333% |

Linhas reconstruídas:

| Descrição | Área | Quantidade | Valor previsto | Valor executado | Saldo |
| --- | --- | ---: | ---: | ---: | ---: |
| Notebook | OUVIDORIA | 3 | 15.000,00 | 5.000,00 | 10.000,00 |
| Notebook | CORREGEDORIA | 3 | 15.000,00 | 5.000,00 | 10.000,00 |
| Notebook | ESCOLA PENAL | 3 | 15.000,00 | 5.000,00 | 10.000,00 |

---

## 12. Regra de rateio financeiro

Regra recomendada:

```text
valor por área = valor agregado do PAD × percentual_valor da área
```

Quando `percentual_valor` não existir e houver `percentual_quantidade`, usar `percentual_quantidade` como fallback controlado.

Se o item tiver valor unitário uniforme, percentual por quantidade e percentual por valor tendem a coincidir.

### 12.1. Arredondamento

Para evitar divergências de centavos:

1. calcular todos os rateios em centavos;
2. arredondar cada linha para duas casas decimais;
3. calcular diferença residual;
4. lançar eventual diferença na última linha ativa do rateio;
5. validar que a soma das linhas reconstruídas bate com o total do PAD.

### 12.2. Fonte de verdade financeira

Na reconstrução do `planoAplicacao`, o dado financeiro confiável é o `Valor
Total Previsto`, o `Valor Total Executado` e o `Saldo` informados no PAD. Os
valores financeiros devem ser reconstruídos a partir desses totais, não de
`quantidade × Valor Unit`.

Regras:

1. os valores financeiros são rateados a partir dos totais do PAD, aplicando
   `percentual_valor` de cada área;
2. a quantidade é rateada separadamente, usando `percentual_quantidade`;
3. o `Valor Unit` exibido no PAD não deve ser usado para recalcular o `Valor
   Total Previsto`;
4. o `valorUnitario` de uma linha reconstruída, quando necessário, deve ser
   derivado depois: `valorPrevistoRateado ÷ quantidadeRateada`, somente quando
   `quantidadeRateada > 0`.

### 12.3. Alertas de quantidade × valor unitário

O alerta `quantidade_valor_unitario_inconsistente` indica divergência entre
`quantidade × Valor Unit exibido` e o `Valor Total Previsto`. Deve ser tratado
como alerta de consistência da fonte.

Quando os totais do relatório permanecem coerentes (cabeçalho, soma dos itens
e `Total Geral`), essa divergência pode indicar apenas truncamento ou
arredondamento do `Valor Unit` exibido, e não erro do `Valor Total Previsto`.
Por si só, o alerta não deve alterar os totais financeiros do PAD.

---

## 13. Ciclo de vida dos itens em cada atualização

A cada nova rodada de relatórios PAD, o sistema deve comparar:

```text
itens conhecidos na base
×
itens encontrados no PAD atual
```

Regras:

```text
Se está no PAD e tem rateio salvo:
  aplicar rateio automaticamente.

Se está no PAD e não tem rateio salvo:
  criar pendência de classificação/rateio.

Se não está no PAD, mas existe na base de itens conhecidos:
  criar alerta de possível exclusão ou substituição.

Se estava ausente e voltou a constar no PAD:
  alertar reativação e reaplicar rateio salvo.
```

---

## 14. Alertas e pendências

O relatório de importação deve ter, no mínimo:

```text
pendenciasRateio
alertasExclusao
alertasReativacao
alertasNatureza
alertasFechamentoFinanceiro
errosCriticos
```

### 14.1. Pendência de rateio

Gerar quando item aparece no PAD atual, mas não existe na base ou não possui rateio ativo.

Dados mínimos:

```text
numeroConvenio
uf
ano
descricao
descricaoNormalizada
codigoNaturezaDespesa
unidade
quantidadeTotalPad
valorPrevistoTotalPad
valorExecutadoTotalPad
saldoTotalPad
```

### 14.2. Alerta de exclusão

Gerar quando item conhecido não aparece no PAD atual.

Ações possíveis para o usuário:

```text
confirmar exclusão
manter em observação
vincular a item substituto
ignorar nesta atualização
```

### 14.3. Alerta de reativação

Gerar quando item anteriormente ausente volta a aparecer em relatório futuro.

---

## 15. Regras de bloqueio

### 15.1. Modo dry-run

Pode listar pendências e alertas sem bloquear.

### 15.2. Modo local/API

Deve permitir visualizar pendências, corrigir rateios, validar exclusões e reprocessar.

### 15.3. Modo publicação

Bloquear publicação se houver:

- item novo sem rateio;
- item ausente sem validação de exclusão;
- relatório ausente para convênio esperado;
- convênio do PAD não encontrado na carteira monitorada;
- divergência financeira crítica;
- natureza não classificada, se afetar totalização;
- erro de leitura do relatório.

---

## 16. Interface futura de gestão de rateio

A aplicação deve permitir ratear itens futuramente.

Funcionalidades mínimas:

- listar itens importados do PAD;
- listar itens já rateados;
- listar itens pendentes de rateio;
- abrir item agregado;
- distribuir quantidade e/ou percentual por área;
- salvar rateio;
- editar rateio existente;
- inativar rateio;
- validar exclusão de item ausente;
- vincular item substituído a novo item;
- reprocessar plano de aplicação;
- visualizar prévia das linhas geradas;
- exportar/importar backup dos rateios.

### 16.1. Tela de rateio sugerida

Para cada item pendente, exibir:

```text
Convênio
UF
Ano
Descrição
Quantidade total no PAD
Valor previsto total
Valor executado total
Saldo total
Código da natureza de despesa
Natureza derivada
```

Permitir preenchimento por área:

| Área | Quantidade | Percentual | Valor previsto calculado | Valor executado calculado |
| --- | ---: | ---: | ---: | ---: |
| OUVIDORIA |  |  |  |  |
| CORREGEDORIA |  |  |  |  |
| ESCOLA PENAL |  |  |  |  |
| N/A |  |  |  |  |

Validações da tela:

- soma das quantidades deve bater com quantidade total ou soma dos percentuais deve bater com 100%;
- soma dos valores calculados deve bater com total do PAD;
- não permitir salvar linha sem área;
- não permitir publicar plano com pendência crítica;
- exibir diferença de centavos quando houver ajuste residual.

---

## 17. Fases de implementação recomendadas

### Fase 1 — Diagnóstico do plano antigo por linhas

Objetivo: entender como os itens aparecem hoje nas abas/guias por UF e identificar itens repetidos por descrição.

Entrega:

- relatório de itens por convênio;
- itens com nomes repetidos;
- áreas associadas;
- quantidades por área;
- valores previstos por área;
- percentuais de rateio por área.

### Fase 2 — Extrator de rateio inicial da planilha antiga

Objetivo: usar a planilha antiga uma última vez para criar a memória inicial de rateio.

Entrega:

- serviço/script que lê as abas por UF;
- gera base de itens conhecidos;
- gera base de rateios por área;
- não altera JSON publicado;
- não altera frontend.

### Fase 3 — Persistência dos itens conhecidos e rateios

Objetivo: criar tabelas SQLite ou estrutura equivalente para persistir itens conhecidos e rateios.

Entrega:

- migration aditiva;
- serviço backend de CRUD;
- exportação/importação JSON como backup, se aplicável.

### Fase 4 — Leitor dos relatórios PAD

Objetivo: ler arquivos `RelatorioItensDespesasPAD_*.xls`.

Entrega:

- extrair cabeçalho;
- extrair itens;
- validar total geral;
- emitir relatório de leitura.

### Fase 5 — Dedução de UF, ano e instrumento

Objetivo: cruzar número do convênio extraído do PAD com carteira monitorada.

Entrega:

- erro crítico se convênio não existir na carteira;
- UF/ano/instrumento preenchidos por carteira.

### Fase 6 — Casamento entre PAD e itens conhecidos

Objetivo: aplicar rateio existente a itens conhecidos e gerar pendências para novos itens.

Entrega:

- comparação por `numeroConvenio + descricaoNormalizada`;
- validação auxiliar por código de natureza e unidade;
- alerta se houver ambiguidade.

### Fase 7 — Controle de ciclo de vida

Objetivo: identificar itens novos, ausentes e reativados.

Entrega:

- pendências de rateio;
- alertas de exclusão;
- alertas de reativação;
- status atualizado sem apagar dados automaticamente.

### Fase 8 — Reconstrução do `planoAplicacao`

Objetivo: transformar itens agregados do PAD em linhas por área.

Entrega:

- gerar uma linha por área do rateio;
- calcular valores rateados;
- validar fechamento financeiro;
- manter formato compatível com os cálculos atuais.

### Fase 9 — Comparador entre origem antiga e nova

Objetivo: comparar plano antigo e plano reconstruído.

Comparar:

- total por convênio;
- total por área;
- total por natureza;
- total por descrição;
- quantidade de linhas;
- itens sem rateio;
- itens ausentes;
- divergências financeiras.

### Fase 10 — Integração por flag

Criar origem controlada:

```text
PROFOR_2022_ORIGEM_PLANO_APLICACAO=abas-uf
PROFOR_2022_ORIGEM_PLANO_APLICACAO=relatorios-pad-rateados
```

Padrão inicial obrigatório:

```text
abas-uf
```

### Fase 11 — Interface local/API de rateio

Objetivo: permitir que o usuário classifique/rateie novos itens e valide exclusões pela aplicação.

Entrega:

- tela ou painel administrativo;
- rotas locais/API;
- validações;
- prévia das linhas reconstruídas.

### Fase 12 — Publicação controlada

Objetivo: publicar somente quando não houver pendências críticas.

Comandos esperados:

```bash
npm run publicar:dados
npm run validar:json
git diff -- frontend/data/publicados/
```

---

## 18. Testes obrigatórios

### 18.1. Alteração em script de importação

```bash
npm run importar:planos-profor-2022:dry-run
npm run validar:syntax
git diff --check
```

### 18.2. Alteração em backend

```bash
npm run validar:syntax
npm run validar:services
npm start
```

### 18.3. Alteração em banco

- verificar migration aditiva;
- não apagar dados;
- prever backup;
- documentar rollback;
- atualizar `memoria/08_ROTAS_BANCO_API/schema-banco.md`.

### 18.4. Alteração em interface

```bash
npm run validar:agente
```

Testar manualmente:

- Dashboard;
- PROFOR 2022;
- tela/painel de rateio;
- detalhe do convênio;
- filtros por UF;
- console do navegador;
- logs do backend.

### 18.5. Alteração em publicação

```bash
npm run publicar:dados
npm run validar:json
git diff -- frontend/data/publicados/
```

---

## 19. Riscos principais

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Perder rateio manual da planilha antiga | Alto | Extrair memória de rateio antes de descontinuar a planilha. |
| Classificar item novo automaticamente errado | Alto | Gerar pendência e exigir ação do usuário. |
| Apagar item que desapareceu do PAD | Alto | Gerar alerta de exclusão e exigir validação. |
| Misturar itens parecidos | Alto | Identificação por nome exato/normalizado, sem fuzzy matching. |
| Divergência de centavos no rateio | Médio | Ajuste residual controlado na última linha. |
| Publicar com item sem rateio | Alto | Bloqueio em modo publicação. |
| Convênio PAD não localizado na carteira | Alto | Erro crítico. |
| Natureza não classificada | Médio | Alerta e validação antes da publicação. |
| Quebrar cálculos existentes | Alto | Preservar formato final do `planoAplicacao`. |

---

## 20. Rollback

Enquanto a origem nova não estiver validada, manter origem antiga por flag:

```text
PROFOR_2022_ORIGEM_PLANO_APLICACAO=abas-uf
```

Rollback operacional:

1. voltar flag para `abas-uf`;
2. ignorar relatórios PAD na composição;
3. restaurar base anterior, se necessário;
4. rodar validações;
5. publicar novamente apenas se necessário.

Rollback Git:

```bash
git status --short
git log --oneline
git revert <hash_do_commit>
git push origin HEAD
```

---

## 21. Prompt base para Codex/IA

```text
Tarefa:
Implementar a etapa [NOME DA ETAPA] da substituição das abas/guias por UF pelo fluxo de relatórios PAD rateados do PROFOR 2022.

Contexto:
A aba Geral está fora do escopo, pois já foi substituída. O trabalho atual é substituir apenas as abas/guias por UF que alimentavam o planoAplicacao. A nova origem é composta por relatórios PAD .xls, carteira monitorada, base de itens conhecidos, base de rateio manual por área e cálculos internos. O relatório PAD traz itens agregados; a aplicação deve reconstruir linhas por área usando rateio salvo.

Arquivos obrigatórios de leitura:
- AGENTS.md
- memoria/INDEX.md
- memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md
- memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md
- backend/services/dashboard-publication-service.js
- backend/services/profor-2022/profor-plano-aplicacao-service.js
- backend/services/profor-2022/profor-consolidado-service.js
- backend/server.js

Restrições:
- Não tratar a aba Geral nesta tarefa.
- Não editar manualmente frontend/data/publicados/*.json.
- Não remover a origem antiga antes de validação.
- Não fazer o frontend ler arquivos Excel diretamente.
- Não classificar item novo automaticamente.
- Não apagar item ausente automaticamente.
- Não usar fuzzy matching para identificar itens.
- Preservar o formato final do planoAplicacao.
- Preservar modo local/API e modo estático/GitHub Pages.

Entrega esperada:
[Descrever entrega concreta da etapa.]

Critérios de aceite:
[Listar critérios objetivos.]

Testes:
Executar validações proporcionais ao risco:
- git diff --check
- npm run validar:syntax
- npm run validar:services, quando backend for alterado
- npm run validar:json, quando publicação for afetada

Rollback:
A origem antiga por abas/guias deve permanecer disponível até validação final.
```

---

## 22. Conclusão técnica

A nova planilha PAD será fonte dos valores agregados dos itens. A aplicação será responsável por preservar a memória institucional de rateio entre áreas.

Modelo final:

```text
Relatórios PAD .xls
+
carteira monitorada
+
base de itens conhecidos
+
base de rateio manual por área
+
controle de ciclo de vida dos itens
+
cálculos internos
=
planoAplicacao reconstruído
```

A implementação correta não substitui linhas antigas por linhas novas. Ela transforma cada item agregado do PAD em uma ou mais linhas por área, preservando os rateios manuais, alertando itens novos, alertando itens ausentes e bloqueando publicação quando houver pendências críticas.
