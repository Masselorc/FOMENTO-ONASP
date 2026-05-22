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

### 5.5. Regra de equivalência por acentuação/diacrítico

Quando o item do PAD e o item da memória não possuem uma correspondência exata por descrição original (o que normalmente geraria a divergência `equivalencia_por_descricao_normalizada` na fila de revisão), o sistema aplica uma regra de saneamento automático se as únicas diferenças entre os textos forem acentuação/diacríticos e caixa alta/baixa, e se todos os dados materiais forem compatíveis.

#### 5.5.1. Critério de diferença de descrição
1. Textos originais são diferentes.
2. Após normalizar espaços duplicados, converter para caixa baixa, e remover acentuação/diacríticos (por exemplo, usando `.normalize("NFD").replace(/[\u0300-\u036f]/g, "")`), as descrições ficam idênticas.
3. Não são removidos números nem tokens técnicos (ex: "2.4ghz" e "4.2ghz" continuam divergindo).

#### 5.5.2. Critério material obrigatório
O saneamento automático por diacrítico só é aplicado se todos os seguintes dados materiais de controle coincidirem:
- Mesmo número de convênio.
- Naturezas de despesa compatíveis (normalizando e agrupando `CUSTEIO` / `CORRENTE` vs `CAPITAL`).
- Valor unitário idêntico ou com diferença menor ou igual a R$ 0,01.
- Caso haja rateios ativos na memória (referência), a quantidade rateada, valor previsto rateado, valor executado rateado e saldo rateado também não devem divergir materialmente (tolerância de 0.0001 para quantidade e R$ 0,01 para valores monetários).

Caso algum desses critérios não seja atendido, a divergência é mantida na fila de revisão como pendência operacional com bloqueio ativo (`bloqueia_publicacao = 1`) para decisão humana.

#### 5.5.3. Efeito na Fila de Revisão e Segurança Pré-Ativação
Os itens que se enquadrarem nos critérios de saneamento de diacrítico:
- Não geram uma nova pendência impeditiva `equivalencia_por_descricao_normalizada` na geração atual.
- Divergências pendentes antigas desses mesmos itens registradas em lotes anteriores têm o campo `bloqueia_publicacao` alterado para `0` (desbloqueado/saneado automaticamente), liberando a segurança pré-ativação de forma automática.
- São listadas como `equivalenciasDiacriticoSaneadas` no relatório de saneamento e no log de auditoria com nível `info`.

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

### 16.2. Revisão assistida de divergências (funcionalidade futura)

Esta seção define uma regra **futura**. A funcionalidade não deve ser
implementada agora no front-end, e nenhum componente visual deve ser criado
nesta etapa.

**Regra de revisão assistida.** A aplicação deverá futuramente exibir
divergências entre a memória atual e os dados novos do PAD em formato de
revisão assistida, com indicação do campo afetado, valor anterior, valor novo,
diferença, motivo provável e ações disponíveis ao usuário. A experiência
esperada é semelhante a um controle de alterações: o usuário poderá aceitar a
atualização, rejeitar, manter o valor anterior, corrigir manualmente ou marcar
para revisão posterior.

Exemplo: se a memória antiga possui o valor R$ 10,98 e o PAD atualizado traz
R$ 10,99, a aplicação deve exibir a divergência em um balão/pop-up de revisão.
O usuário visualiza o valor anterior, o valor novo, a diferença e a causa
provável, e decide expressamente o que fazer.

**Padrão visual recomendado.** Ícone no campo divergente, balão explicativo e
botões de decisão. O balão deve mostrar: valor anterior, valor novo,
diferença, explicação curta e as ações disponíveis.

**Ações disponíveis ao usuário**, conforme o caso:

- aceitar atualização;
- rejeitar atualização;
- manter valor anterior;
- corrigir manualmente;
- marcar para revisar depois;
- ver detalhes técnicos.

**Regra de aplicação.** Nenhuma atualização saneada deve ser aplicada de forma
silenciosa. O dado bruto da fonte não deve ser sobrescrito silenciosamente. O
dado novo só prevalece quando houver decisão validada. A decisão do usuário
funciona como camada de saneamento/validação. A reconstrução futura do
`planoAplicacao` e a eventual publicação só devem considerar alterações
aceitas, saneadas e auditáveis. Toda alteração efetiva deve estar vinculada a
uma decisão validada e a um evento de auditoria.

#### 16.2.1. Tipos mínimos de alerta de revisão

| Tipo de alerta |
| --- |
| `valor_diferente` |
| `quantidade_diferente` |
| `valor_unitario_diferente` |
| `descricao_divergente` |
| `item_novo_sem_rateio` |
| `item_ausente_no_pad` |
| `item_substituido` |
| `item_nao_apto` |
| `natureza_divergente` |
| `area_pendente` |
| `saldo_inconsistente` |
| `quantidade_valor_unitario_inconsistente` |
| `equivalencia_por_descricao_normalizada` |
| `rateio_novo` |
| `correcao_de_rateio` |
| `rollback_de_saneamento` |
| `publicacao_com_dados_saneados` |

#### 16.2.2. Campos previstos por alerta de revisão

Cada alerta deve prever, no desenho futuro:

- `tipo`;
- `nivel`: `info`, `aviso` ou `impeditivo`;
- `status`: `PENDENTE`, `ACEITO`, `REJEITADO`, `EM_REVISAO`, `CORRIGIDO`,
  `APLICADO` ou `REVERTIDO` (ver convenção em §16.2.5);
- `campoAfetado`;
- `valorAnterior`;
- `valorNovo`;
- `fonteAnterior`;
- `fonteNova`;
- `diferenca`;
- `motivoProvavel`;
- `acaoSugerida`;
- `impactoReconstrucao` (impacto na reconstrução do `planoAplicacao`);
- `bloqueiaPublicacao`: sim/não.

#### 16.2.3. Regra de log/auditoria obrigatória

Toda decisão tomada na revisão assistida de divergências deve gerar registro
de log/auditoria. O dado não deve ser simplesmente substituído. O registro
deve permitir rastrear posteriormente por que determinado dado foi aceito,
rejeitado, mantido, corrigido ou substituído.

Cada registro de auditoria deve manter rastreabilidade completa de:

- alerta gerado;
- tipo do alerta;
- nível do alerta;
- campo afetado;
- valor anterior;
- valor novo;
- fonte anterior;
- fonte nova;
- diferença identificada;
- motivo provável apresentado ao usuário;
- ação tomada pelo usuário (aceitar, rejeitar, manter anterior, revisar
  depois, corrigir manualmente);
- justificativa, quando aplicável;
- usuário responsável;
- data e hora da decisão;
- lote de saneamento/importação;
- impacto na reconstrução do `planoAplicacao`;
- eventual rollback;
- status final da decisão.

A regra de auditoria vale, no mínimo, para: divergência de valor; divergência
de quantidade; divergência de valor unitário; divergência de descrição; item
novo; item ausente; item substituído; item não apto liberado; rateio novo;
correção de rateio; aceitação de equivalência; rejeição de equivalência;
aplicação de lote de saneamento; rollback de lote; e publicação futura baseada
em dados saneados.

> Modelo de persistência da auditoria: ver pendência futura registrada em
> `memoria/08_ROTAS_BANCO_API/schema-banco.md`. Nenhuma tabela ou migration
> deve ser criada nesta etapa.

#### 16.2.4. Detalhamento visual — SISTEMA > Revisão de divergências PAD x memória

Esta seção detalha o **padrão visual futuro** da funcionalidade. Continua sendo
funcionalidade futura: não deve haver implementação de front-end nem criação de
componentes nesta etapa.

A interface deverá trabalhar em **três níveis**:

1. lista resumida de alertas;
2. card comparativo Antes × Depois;
3. balão/pop-up ou painel lateral de decisão.

**Nível 1 — Lista resumida de alertas.**

A lista deve permitir filtros por: `status`, `nivel`, convênio, UF, `tipo` e
bloqueio de publicação. Cada divergência exibe:

- status visual: `PENDENTE`, `ACEITO`, `REJEITADO`, `EM_REVISAO`, `CORRIGIDO`,
  `APLICADO` ou `REVERTIDO`;
- nível: `info`, `aviso` ou `impeditivo`.

**Nível 2 — Card comparativo Antes × Depois.**

O card principal compara lado a lado:

- `ANTES` — memória atual;
- `DEPOIS` — PAD novo.

Campos exibidos no card:

```text
convênio
UF
item
campo divergente
valor anterior
valor novo
diferença
fonte anterior
fonte nova
natureza
quantidade
valor unitário
valor previsto
valor executado
saldo
impacto na reconstrução
bloqueia publicação (sim/não)
```

O card deve conter um bloco de **diagnóstico automático**:

- tipo do alerta;
- motivo provável;
- evidências;
- risco de falso positivo;
- ação sugerida.

**Nível 3 — Painel/balão de decisão.**

O painel lateral (ou balão/pop-up) deve permitir as ações, conforme o tipo do
alerta:

- aceitar atualização;
- rejeitar atualização;
- manter valor anterior;
- corrigir manualmente;
- definir rateio;
- vincular item antigo;
- confirmar exclusão;
- vincular substituto;
- revisar depois;
- ver detalhes técnicos.

Regras transversais do detalhamento visual:

- toda decisão deve exigir ou permitir justificativa, conforme o tipo e o
  nível do alerta;
- toda decisão gera log/auditoria (ver §16.2.3);
- a experiência visual esperada é semelhante a um controle de alterações:
  valor anterior, valor novo, explicação curta e botões de decisão.

**Exemplos de uso da interface:**

| Cenário | Tipo de alerta | Comportamento esperado |
| --- | --- | --- |
| Descrição diverge só por acentuação | `descricao_divergente` / `equivalencia_por_descricao_normalizada` | Card mostra ANTES e DEPOIS da descrição; diagnóstico aponta risco de falso positivo (acentuação); ações: aceitar equivalência, rejeitar, vincular item antigo, revisar depois. |
| Valor diverge entre memória e PAD | `valor_diferente` | Card mostra valor anterior, valor novo e diferença; ações: aceitar atualização, manter valor anterior, corrigir manualmente. |
| Item novo sem rateio | `item_novo_sem_rateio` / `rateio_novo` | Card marca ausência de rateio; ações: definir rateio, revisar depois; bloqueia publicação enquanto pendente. |
| Item ausente no PAD | `item_ausente_no_pad` / `item_substituido` | Card mostra o item da memória sem correspondência no PAD; ações: confirmar exclusão, vincular substituto, manter em observação, revisar depois. |
| Quantidade × valor unitário inconsistente | `quantidade_valor_unitario_inconsistente` | Card mostra quantidade, valor unitário e valor previsto; diagnóstico indica possível truncamento do valor unitário exibido (ver §5.4); ação sugerida não altera os totais do PAD. |

#### 16.2.5. Convenção de caixa do campo `status`

O campo `status` da revisão assistida usa **caixa alta** como valor canônico no
SQLite e na API, alinhado às demais tabelas e comandos de saneamento que vêm
sendo desenhados. Valores canônicos:

```text
PENDENTE
ACEITO
REJEITADO
EM_REVISAO
CORRIGIDO
APLICADO
REVERTIDO
```

A diferença de caixa entre seções anteriores era apenas de apresentação, sem
impacto funcional. Para evitar ambiguidade na implementação futura:

- o valor persistido e trafegado pela API é sempre em caixa alta;
- a interface pode exibir o rótulo com a capitalização que preferir, mas deve
  comparar e gravar o valor canônico em caixa alta;
- o mesmo critério se aplica aos níveis (`info`, `aviso`, `impeditivo`), que
  permanecem em caixa baixa por já serem o padrão usado nos relatórios e
  alertas PAD existentes.

#### 16.2.6. Fila persistente de revisão (Etapa 5.3 — implementada)

A fila persistente de divergências PAD x memória foi implementada no SQLite, em
quatro tabelas aditivas (criadas por `garantirTabelasRevisaoProfor2022()` em
`backend/db/init-db.js`):

- `profor_2022_revisao_lotes` — registra cada geração da fila;
- `profor_2022_revisao_divergencias` — fila de divergências, com
  `chave_divergencia` estável (`UNIQUE`) e `payload_json` suficiente para o
  card Antes × Depois;
- `profor_2022_revisao_decisoes` — decisões humanas (estrutura pronta; ainda
  não alimentada);
- `profor_2022_revisao_logs` — trilha de auditoria das gerações.

A finalidade da fila é **preparar a futura tela SISTEMA > Revisão de
divergências** descrita nas §16.2.1–16.2.5 — a deliberação não precisa mais ser
feita manualmente no JSON de decisões.

Distinção dos três conceitos:

- **divergência detectada** — registro técnico em `profor_2022_revisao_divergencias`,
  gerado a partir dos relatórios de saneamento e do leitor PAD;
- **decisão humana** — futura escolha do usuário (aceitar, rejeitar, etc.),
  registrada em `profor_2022_revisao_decisoes`;
- **log/auditoria** — trilha imutável de cada geração/atualização em
  `profor_2022_revisao_logs`.

Comandos:

- `npm run profor:pad:gerar-fila-revisao` — gera/regenera a fila em uma
  transação única; cria um lote, transforma os relatórios atuais em
  divergências, preserva `status` e decisões já tomadas quando a mesma
  `chave_divergencia` reaparece, registra logs e atualiza os totais do lote;
- `npm run profor:pad:auditar-fila-revisao` — relatório de auditoria somente
  leitura (totais por status, nível, tipo e convênio; pendentes; impeditivas;
  bloqueio de publicação; último lote).

A Etapa 5.3 **não aplica decisões**, não reconstrói o `planoAplicacao`, não
altera a origem ativa e não publica. A publicação e a reconstrução permanecem
bloqueadas enquanto houver divergência impeditiva pendente na fila.

#### 16.2.7. Camada backend/API de revisão (Etapa 5.4 — implementada)

A camada backend/API para consultar divergências e registrar decisões humanas
foi implementada, ainda **sem aplicar** as decisões ao `planoAplicacao`.

Serviço: `backend/services/profor-2022/profor-pad-revisao-decisao-service.js`
(regras e formatação), apoiado por `profor-pad-revisao-repository.js` (acesso
transacional ao SQLite). Rotas registradas em `backend/server.js`:

- `GET /api/profor-2022/revisao/divergencias` — lista com filtros opcionais
  (`status`, `nivel`, `tipo`, `convenio`, `uf`, `bloqueiaPublicacao`, `limite`,
  `offset`); impeditivas vêm primeiro;
- `GET /api/profor-2022/revisao/divergencias/:id` — divergência com
  `payload` parseado, `decisoes` e `logs`;
- `GET /api/profor-2022/revisao/divergencias/:id/logs` — logs da divergência;
- `GET /api/profor-2022/revisao/auditoria` — totais por status/nível/tipo/
  convênio, pendentes, impeditivas e bloqueio de publicação;
- `POST /api/profor-2022/revisao/divergencias/:id/decisoes` — registra uma
  decisão humana.

Regras da decisão:

- decisões aceitas: `ACEITO`, `REJEITADO`, `EM_REVISAO`, `CORRIGIDO`,
  `REVERTIDO` e `COMENTAR` (esta mantém o status `PENDENTE`, apenas registra
  comentário/log);
- `ACEITO`, `REJEITADO`, `CORRIGIDO` e `REVERTIDO` exigem justificativa;
  `EM_REVISAO` e `COMENTAR` aceitam justificativa opcional;
- toda decisão exige `usuario` responsável;
- cada decisão grava uma linha em `profor_2022_revisao_decisoes`, atualiza o
  `status` da divergência e registra log com estado anterior e novo;
- uma nova decisão sobre divergência já decidida **acrescenta** linha — não
  apaga decisões anteriores;
- **`ACEITO` significa apenas "decisão humana registrada"** — a API nunca
  aplica a decisão ao `planoAplicacao`; a aplicação material é etapa posterior.

A Etapa 5.4 não implementa front-end, não reconstrói o `planoAplicacao`, não
altera a origem ativa e não publica.

#### 16.2.8. Auditoria operacional da revisão (Etapa 5.4.1 — implementada)

A auditoria da fila de revisão foi ajustada para preparar a futura tela
SISTEMA > Revisão de divergências. A rota
`GET /api/profor-2022/revisao/auditoria` passou a retornar, além dos
agrupamentos por status, nível, tipo de alerta e convênio (observação:
a agregação/agrupamento por UF ainda não está implementada; a UF é apenas
deduzida via carteira monitorada pelo número do convênio), os seguintes
contadores com seus respectivos valores baseline na carga inicial:

- `totalDivergencias`: 145 (todas no status `PENDENTE` na carga inicial);
- `totalPendentes`: 145;
- `totalEmRevisao`: 0;
- `totalImpeditivas`: 44 (divergências de gravidade alta/impeditiva);
- `totalBloqueiamPublicacao`: 48 (divergências que impedem publicação);
- `totalPendentesQueBloqueiamPublicacao`: 48;
- `totalEmRevisaoQueBloqueiamPublicacao`: 0;
- `totalComDecisaoResolutiva`: 0;
- `totalComComentario`: 0;
- `totalSemDecisaoResolutiva`: 145;
- `publicacaoLiberada`: false.

Regra operacional de liberação:

- `publicacaoLiberada = true` somente quando não houver divergência com
  `status` `PENDENTE` ou `EM_REVISAO` e `bloqueia_publicacao = 1`;
- divergências já decididas como `ACEITO`, `REJEITADO`, `CORRIGIDO` ou
  `REVERTIDO` não bloqueiam a publicação por esse critério, ainda que tenham
  `bloqueia_publicacao = 1` como característica técnica;
- `ACEITO` continua significando apenas decisão humana registrada. A API não
  aplica decisão ao `planoAplicacao`.

Classificação das decisões:

- decisões resolutivas: `ACEITO`, `REJEITADO`, `CORRIGIDO`, `REVERTIDO`;
- comentário: `COMENTAR`;
- em revisão: `EM_REVISAO`.

A listagem `GET /api/profor-2022/revisao/divergencias` aceita também os filtros
`semDecisaoResolutiva=true|false` e
`comDecisaoResolutiva=true|false`, além de `bloqueiaPublicacao=true|false`.

Esta etapa não cria migration, não implementa front-end, não reconstrói o
`planoAplicacao`, não altera a origem ativa, não publica e não aplica decisões.

#### 16.2.9. Interface de revisão assistida (Etapa 5.5 — implementada)

A primeira versão da tela `SISTEMA > Revisão de divergências PAD x memória`
foi criada para operar sobre as rotas da Etapa 5.4/5.4.1, sem aplicar
decisões ao `planoAplicacao`.

Escopo implementado:

- comando local `npm run profor:pad:revisao:limpar-testes`, que remove de forma
  transacional apenas divergências com `chave_divergencia` iniciada por
  `revisao_teste:`, suas decisões e seus logs;
- a limpeza não remove lotes de revisão e não toca divergências reais;
- `GET /api/profor-2022/revisao/divergencias` passa a rejeitar filtros
  contraditórios de decisão resolutiva, retornando HTTP 400 quando
  `semDecisaoResolutiva` e `comDecisaoResolutiva` forem enviados com valores
  incompatíveis;
- nova opção de menu `Revisão de divergências`;
- resumo de auditoria consumindo `GET /api/profor-2022/revisao/auditoria`;
- lista filtrável por `status`, `nivel`, `tipo`, `convenio`, `uf`,
  `bloqueiaPublicacao`, `semDecisaoResolutiva` e `comDecisaoResolutiva`;
- a interface impede marcar simultaneamente `sem decisão resolutiva` e
  `com decisão resolutiva`;
- detalhe por divergência consumindo
  `GET /api/profor-2022/revisao/divergencias/:id`;
- visualização `ANTES — memória atual` x `DEPOIS — PAD novo`, com campos
  estruturados quando existirem no payload;
- logs/decisões e formulário para registrar `ACEITO`, `REJEITADO`,
  `EM_REVISAO`, `CORRIGIDO`, `REVERTIDO` e `COMENTAR`.

Regras preservadas:

- toda decisão exige usuário;
- `ACEITO`, `REJEITADO`, `CORRIGIDO` e `REVERTIDO` exigem justificativa;
- `COMENTAR` mantém a divergência como `PENDENTE`;
- `EM_REVISAO` muda o status para `EM_REVISAO`;
- a resposta do registro de decisão deve deixar claro `aplicadaAoPlano=false`;
- nenhuma decisão altera `planoAplicacao`, JSON publicado, origem ativa ou
  publicação.

Pendências ainda fora desta etapa:

- tratar divergências não reapresentadas em fluxo próprio antes de publicação
  controlada;
- validar decisão antiga cujo payload tenha sido alterado por nova leitura PAD;
- desenhar aplicação material das decisões ao plano em etapa posterior, com
  rollback específico.

#### 16.2.10. Saneamento pós-interface (Etapa 5.5.1 — implementada)

A Etapa 5.5.1 corrigiu a consistência operacional da fila após a criação da
interface, sem aplicar decisões ao `planoAplicacao`.

Escopo implementado:

- rotina `listarStatusResolutivosOrfaos()` para localizar divergências com
  status resolutivo (`ACEITO`, `REJEITADO`, `CORRIGIDO`, `REVERTIDO`) sem
  decisão resolutiva correspondente em `profor_2022_revisao_decisoes`;
- rotina `sanearStatusResolutivosOrfaos()` para reverter esses status para
  `PENDENTE`, com transação e log de auditoria;
- script `backend/scripts/sanear-status-orfaos-revisao-pad-profor-2022.js`;
- comando `npm run profor:pad:revisao:sanear-status-orfaos`;
- modo de conferência `npm run profor:pad:revisao:sanear-status-orfaos -- --dry-run`.

Regras de saneamento:

- não apaga divergência real;
- não apaga logs;
- não apaga decisões;
- não cria decisão falsa;
- ignora chaves de teste `revisao_teste:%`;
- registra log `status_resolutivo_orfao_saneado` com usuário
  `sistema-saneamento`.

Também foram atualizados os cache-busters de `app.css` e `app.js` e corrigida
a exibição monetária do Antes x Depois para tratar corretamente strings como
`37.59`, `37,59`, `1.234,56` e `1,234.56`.

#### 16.2.11. Reconstrução dry-run do plano e comparador antigo × novo (Etapa 5.6 + 6 + 7 — implementada)

A camada técnica que reconstrói o `planoAplicacao` pelos relatórios PAD e o
comparador entre origem antiga e reconstrução foram implementados **somente em
dry-run**. Esta etapa não altera a origem ativa, não publica e não aplica
decisões materialmente ao `planoAplicacao`.

Serviços criados:

- `backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js` —
  reconstrói, em memória, o `planoAplicacao` a partir dos itens PAD lidos, dos
  itens conhecidos e dos rateios ativos persistidos no SQLite;
- `backend/services/profor-2022/profor-pad-plano-comparador-service.js` —
  compara o `planoAplicacao` da origem antiga com o reconstruído.

Comandos criados:

- `npm run profor:pad:reconstruir-plano:dry-run` — gera a reconstrução e salva
  `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json`;
- `npm run profor:pad:comparar-plano:dry-run` — executa a reconstrução e o
  comparador e salva `profor-2022-pad-plano-comparacao-dry-run.json` e
  `.md` em `backend/data/relatorios`.

**Regras de reconstrução.**

1. `Valor Total Previsto`, `Valor Total Executado` e `Saldo` do PAD são a fonte
   de verdade financeira; o `Valor Unit` do PAD é referência auxiliar e nunca
   recalcula o total previsto.
2. Para cada item PAD com rateio ativo é gerada uma linha por área/natureza;
   `valorPrevistoRateado` e `valorExecutadoRateado` vêm dos totais do PAD
   aplicando `percentual_valor` (fallback controlado: valores de referência;
   último recurso: distribuição igual, que registra impedimento).
3. A `quantidade` é rateada por `percentual_quantidade`.
4. `saldo = valorPrevistoRateado − valorExecutadoRateado`;
   `percentualExecucao = valorExecutadoRateado ÷ valorPrevistoRateado × 100`
   com proteção contra divisão por zero;
   `valorUnitario = valorPrevistoRateado ÷ quantidadeRateada` quando a
   quantidade rateada é maior que zero — caso contrário usa o `Valor Unit` do
   PAD como referência auxiliar, sem recalcular o total.
5. Arredondamento controlado em centavos; diferença residual lançada na última
   linha ativa do rateio, com alerta técnico `ajuste_residual_arredondamento`.
6. A origem antiga é representada pela memória de rateio persistida (itens
   conhecidos + rateios ativos), que captura as abas por UF agregadas por
   item/área/natureza; a planilha antiga não é relida.

**Regras de bloqueio e aptidão.**

- `aptoParaAtivacao = true` somente se: não houver divergência PENDENTE/EM_REVISAO
  com `bloqueia_publicacao = 1`; não houver item PAD sem rateio; não houver item
  conhecido não apto usado na reconstrução; não houver convênio PAD fora da
  carteira; não houver erro crítico de leitura.
- `aptoParaPublicacao = true` somente se: `aptoParaAtivacao = true`;
  `publicacaoLiberada = true` na auditoria; e o comparador não encontrar
  diferença crítica.
- A reconstrução é executável mesmo com pendências: gera diagnóstico e
  comparador, registra impedimentos e mantém `aptoParaAtivacao` e
  `aptoParaPublicacao` como `false` enquanto houver pendências.

**Regras de comparação.** O comparador usa chave estável
`numeroConvenio + descrição + área + natureza` (exata, sem fuzzy matching),
não consolida itens ambíguos silenciosamente (registra como `itens ambíguos`)
e classifica diferenças como `critica`, `aviso`,
`diferenca_esperada_por_atualizacao_pad` ou `diferenca_por_pendencia_de_decisao`.
Gera itens iguais, novos, ausentes, divergentes por quantidade/valor/saldo,
área e natureza, totais por convênio/UF/área/natureza e a diferença total
origem antiga × reconstrução PAD.

Na base atual (145 divergências pendentes, 48 bloqueando publicação), a
reconstrução produz `aptoParaAtivacao = false` e `aptoParaPublicacao = false`,
com impedimentos listados. Esta etapa não cria migration, não cria API, não
implementa front-end, não reconstrói materialmente o `planoAplicacao` publicado
e não altera a origem ativa.

#### 16.2.12. Motor de aplicação de decisões em dry-run (Etapa 8.1 — implementada)

O motor que interpreta as decisões resolutivas registradas na revisão assistida
e as transforma em regras técnicas de reconstrução foi implementado **somente
em dry-run**. Não altera a origem ativa, não publica, não toca
`frontend/data/publicados` e não modifica nenhuma tabela do SQLite.

Serviço criado:
`backend/services/profor-2022/profor-pad-decisao-aplicacao-service.js`. Comando
de auditoria somente leitura: `npm run profor:pad:decisoes:auditar-aplicacao-dry-run`.

**Decisões resolutivas suportadas.** `ACEITO`, `REJEITADO`, `CORRIGIDO` e
`REVERTIDO`. `COMENTAR` e `EM_REVISAO` não são resolutivas e não geram aplicação
material.

**Efeitos técnicos por tipo de alerta.**

- `equivalencia_por_descricao_normalizada`: `ACEITO` usa o rateio do item
  equivalente da memória na reconstrução; `REJEITADO`/`REVERTIDO` mantêm o item
  sem rateio.
- `item_pad_sem_rateio` / `item_novo_sem_rateio` / `rateio_novo` /
  `correcao_de_rateio`: `ACEITO`/`CORRIGIDO` com rateio válido no
  `payloadDecisao` geram as linhas pelo rateio informado (validando áreas,
  naturezas e soma de percentuais); sem rateio no payload → impedimento
  `decisao_sem_rateio_aplicavel`; rateio inválido → `decisao_rateio_invalido`;
  `REJEITADO`/`REVERTIDO` recusam o rateio.
  A auditoria local
  `npm run profor:pad:item-sem-rateio:auditar-rateio-antigo` verifica, em
  dry-run, se um `item_novo_sem_rateio` já possui rateio antigo por área na
  memória persistida ou nos artefatos de rateio inicial. O critério exige mesmo
  convênio, natureza compatível, áreas antigas preenchidas, percentuais
  calculáveis e fechamento de quantidade, valor previsto, valor executado e
  saldo dentro das tolerâncias (`0,000001` para quantidade e `0,01` para
  valores). A compatibilidade de descrição é controlada: primeiro tenta
  igualdade normalizada; se necessário, permite apenas a remoção de token decimal
  de frequência `GHz`, sempre condicionada ao fechamento financeiro. Em modo
  padrão, essa etapa não registra decisão nem altera payload/status da
  divergência. A aplicação assistida exige comando explícito
  `npm run profor:pad:item-sem-rateio:aplicar-rateio-antigo`, valida novamente o
  candidato e registra `ACEITO` via serviço de decisão com `payloadDecisao` de
  `rateio_manual`; a decisão permanece `aplicadaAoPlano=false` e só tem efeito
  em dry-run.
- `item_ausente_no_pad` / `item_substituido`: `ACEITO` confirma a ausência (o
  comparador a classifica como `ausencia_confirmada_por_decisao`);
  `REJEITADO`/`REVERTIDO` mantêm o alerta de ausência. O item não é apagado da
  memória.
- `item_nao_apto` / `item_conhecido_nao_apto` / `item_conhecido_nao_apto_usado`:
  `ACEITO`/`CORRIGIDO` liberam o uso do item na reconstrução dry-run, sem
  alterar `apto_para_importacao_futura` no banco; `REJEITADO`/`REVERTIDO` mantêm
  o impedimento. O tipo de divergência gerado na fila é `item_nao_apto`;
  `item_conhecido_nao_apto` (alerta do leitor/matching) e
  `item_conhecido_nao_apto_usado` (impedimento interno da reconstrução) são
  aceitos como aliases, para evitar incompatibilidade futura caso a fila receba
  uma divergência com esse rótulo.
  O payload da fila deve trazer o lado `ANTES — memória atual` explicitamente em
  `payload.memoria` e `payload.antes`, além dos campos planos
  `descricaoMemoria`, `areaMemoria`, `naturezaMemoria`, `quantidadeMemoria`,
  `valorUnitarioMemoria`, `valorPrevistoMemoria`, `valorExecutadoMemoria` e
  `saldoMemoria`. Esses valores são resumidos dos rateios ativos do item
  conhecido: áreas/naturezas únicas, valores previstos/executados somados,
  `saldo = valorPrevisto - valorExecutado` e `valorUnitarioReferencia` da
  memória quando disponível para exibição do valor unitário/quantidade. Sem
  rateio ativo, os campos quantitativos/financeiros permanecem nulos e a
  divergência segue impedindo uso automático até saneamento humano.
  A auditoria local `npm run profor:pad:item-nao-apto:auditar` identifica, em
  modo dry-run, itens `item_nao_apto` pendentes/em revisão e sem decisão
  resolutiva cujos dados materiais de memória e PAD coincidem. O critério usa
  tolerância de `0,000001` para quantidade e `0,01` para valores monetários,
  exige natureza normalizada igual e não exige área, pois o PAD pode não trazer
  esse campo. A aplicação assistida só ocorre pelo comando dedicado
  `npm run profor:pad:item-nao-apto:aceitar-iguais`, cujo script npm invoca o
  auditor com `--aplicar`, registrando `ACEITO` pelo serviço existente de
  decisão, com `aplicadaAoPlano=false`.
- `quantidade_valor_unitario_inconsistente`: `ACEITO` marca a inconsistência
  como saneada em dry-run, mantendo os totais do PAD como fonte de verdade, sem
  recalcular o total previsto.
- `valor_diferente`, `quantidade_diferente`, `valor_unitario_diferente`,
  `saldo_inconsistente`, `descricao_divergente`, `natureza_divergente`:
  `ACEITO` aceita o campo do PAD como fonte; `CORRIGIDO` aplica o valor
  corrigido do `payloadDecisao` (sem valor → `decisao_corrigido_sem_valor`);
  `REJEITADO`/`REVERTIDO` não substituem o PAD automaticamente.

**Decisões ainda não aplicáveis.** Decisões `CORRIGIDO` sem rateio/valor no
payload, rateios inválidos e tipos de alerta sem efeito definido são listados em
`decisoesNaoAplicaveis`, com motivo técnico, e geram impedimento na reconstrução.

**Campos adicionados aos relatórios.** A reconstrução
(`profor-2022-pad-plano-reconstruido-dry-run.json`) passou a conter
`decisoesResolutivasEncontradas`, `decisoesAplicadasDryRun`,
`decisoesNaoAplicaveis` e os totais `resumo.totalDecisoesResolutivasEncontradas`,
`resumo.totalDecisoesAplicadasDryRun` e `resumo.totalDecisoesNaoAplicaveis`. O
comparador (`profor-2022-pad-plano-comparacao-dry-run.json`/`.md`) passou a
conter `totalDiferencasSaneadasPorDecisao`, `totalAusenciasConfirmadasPorDecisao`,
`totalDecisoesAplicadasDryRun`, `totalDecisoesNaoAplicaveis` e as listas
correspondentes.

Na base atual não há decisões resolutivas registradas: o motor encontra `0`
decisões, aplica `0` e os relatórios da Etapa 5.6+6+7 permanecem com os mesmos
números. `aptoParaAtivacao` e `aptoParaPublicacao` continuam `false`. Esta etapa
não cria migration, não cria estrutura persistida nova, não cria front-end e não
aplica decisão materialmente ao `planoAplicacao` oficial.

**Métricas desambiguadas das decisões.** Como `REJEITADO`/`REVERTIDO` são
decisões interpretadas mas com `afetaReconstrucao = false`, os relatórios
expõem, além de `totalDecisoesAplicadasDryRun` (mantido como alias por
compatibilidade): `totalDecisoesInterpretadasDryRun` (decisões traduzidas em
efeito técnico determinístico), `totalDecisoesComEfeitoNaReconstrucao` e
`totalDecisoesSemEfeitoNaReconstrucao`. `interpretadas = comEfeito + semEfeito`.

#### 16.2.13. Segurança pré-ativação PAD (Etapa 8.2 — implementada)

A auditoria dry-run de segurança pré-ativação foi implementada para impedir
dois riscos antes de qualquer ativação/publicação: (1) decisão resolutiva
validando payload de divergência que mudou; (2) divergência antiga que não
aparece mais na geração atual da fila. Não altera a origem ativa, não publica,
não toca `frontend/data/publicados`, não cria migration/coluna nova e não aplica
decisão ao `planoAplicacao` oficial.

Serviço criado:
`backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service.js`.
Comando somente leitura: `npm run profor:pad:seguranca-pre-ativacao:dry-run`,
que gera `profor-2022-pad-seguranca-pre-ativacao-dry-run.json` e `.md` em
`backend/data/relatorios`.

**Hash e snapshot de payload.** `gerarHashPayloadDivergencia()` produz um
SHA-256 estável da divergência, considerando `chave_divergencia`, `tipo_alerta`,
`campo_afetado`, `numero_convenio`, `uf`, `chave_item` e `payload_json`;
`stringifyOrdenado()` ordena recursivamente as chaves, de modo que o hash
independe da ordem das chaves do JSON. Ao registrar uma nova decisão humana, o
serviço de decisão acrescenta `_segurancaPreAtivacao` ao `payload_decisao_json`
(versão, `divergenciaId`, `chaveDivergencia`, `tipoAlerta`, `campoAfetado`,
`payloadHashNoMomentoDaDecisao`, `registradoEm`), preservando o payload original
do usuário. Nenhuma coluna é criada. Decisões antigas sem o snapshot são
tratadas como “sem snapshot”, não como erro fatal.

**Auditoria de payload alterado.** Para cada decisão resolutiva (`ACEITO`,
`REJEITADO`, `CORRIGIDO`, `REVERTIDO`), compara o `payloadHashNoMomentoDaDecisao`
com o hash atual da divergência e classifica em `payload_preservado`,
`payload_alterado_apos_decisao`, `decisao_sem_snapshot_payload` ou
`divergencia_nao_encontrada_para_decisao`. `payload_alterado_apos_decisao` e
`divergencia_nao_encontrada_para_decisao` geram bloqueio de ativação;
`decisao_sem_snapshot_payload` é aviso, mas vira bloqueio quando a decisão é
usada para liberar ativação. Nenhum status é reaberto automaticamente.

**Auditoria de divergências não reapresentadas.** Reaproveita `coletarDivergencias()`
para obter as chaves que seriam geradas hoje e as compara com as divergências
persistidas, classificando em `reapresentada`, `nao_reapresentada_sem_decisao`,
`nao_reapresentada_com_decisao_resolutiva`, `nao_reapresentada_bloqueante` e
`nao_reapresentada_em_revisao`. `nao_reapresentada_com_decisao_resolutiva` e
`nao_reapresentada_bloqueante` geram bloqueio. A auditoria não apaga divergências,
não altera status e não cria decisão automática.

**Integração.** A reconstrução e o comparador dry-run embutem o resumo de
segurança pré-ativação (`segurancaPreAtivacao`); havendo bloqueio de segurança,
`aptoParaAtivacao = false` e, em cascata, `aptoParaPublicacao = false`. A
auditoria não interrompe a geração dos relatórios.

Na base atual há `0` decisões resolutivas registradas e as `145` divergências
existentes são todas reapresentadas pela geração atual: `0` bloqueios de
segurança e `aptoParaProsseguirAtivacao = true` para esse critério específico.
A reconstrução continua com `aptoParaAtivacao = false` pelas divergências
pendentes, não pela segurança.

#### 16.2.14. Interface avançada de saneamento PAD (Etapa 9.1 — implementada)

A tela `SISTEMA > Revisão de divergências` passou a montar decisões humanas
estruturadas para alimentar o motor de aplicação de decisões em dry-run já
existente. A evolução é incremental no frontend: não cria rota, não cria
migration, não altera origem ativa, não publica, não toca
`frontend/data/publicados` e não aplica decisão materialmente ao
`planoAplicacao` oficial.

**Tipos com painel estruturado.**

- `equivalencia_por_descricao_normalizada`: exibe item PAD, item/memória
  provável, valores unitários, diferença, naturezas e motivo provável; `ACEITO`
  envia equivalência aceita e `REJEITADO` envia equivalência recusada.
- `item_pad_sem_rateio`, `item_novo_sem_rateio`, `rateio_novo` e
  `correcao_de_rateio`: exibem editor de rateio manual com área, natureza,
  percentual de valor, percentual de quantidade e observação opcional.
- `item_ausente_no_pad` e `item_substituido`: exibem item da memória, convênio,
  UF, natureza/área quando disponível e alerta de ausência no PAD atual.
- `item_nao_apto`, `item_conhecido_nao_apto` e
  `item_conhecido_nao_apto_usado`: exibem motivo original, alertas vinculados e
  impacto na reconstrução.
- `quantidade_valor_unitario_inconsistente`: exibe quantidade, valor unitário,
  total previsto, cálculo/diferença e diagnóstico de possível
  truncamento/arredondamento.
- divergências de campo (`valor_diferente`, `quantidade_diferente`,
  `valor_unitario_diferente`, `saldo_inconsistente`, `descricao_divergente`,
  `natureza_divergente`): permitem aceitar o dado PAD ou informar valor
  corrigido.

**Payloads enviados em `payloadDecisao`.**

- equivalência aceita:
  `{ tipoSaneamento: "equivalencia_por_descricao_normalizada", equivalenciaAceita: true, chaveItemEquivalente, descricaoPad, descricaoMemoria, motivo }`;
- rateio manual:
  `{ tipoSaneamento: "rateio_manual", rateio: [{ area, natureza, percentualValor, percentualQuantidade }], observacao }`;
- ausência confirmada:
  `{ tipoSaneamento: "ausencia_confirmada", ausenciaConfirmada: true, motivo }`;
- liberação de item não apto em dry-run:
  `{ tipoSaneamento: "liberacao_item_nao_apto", liberarUsoDryRun: true, motivo }`;
- consistência quantidade x valor unitário:
  `{ tipoSaneamento: "consistencia_quantidade_valor_unitario", manterTotaisPad: true, valorUnitarioApenasReferencia: true, motivo }`;
- campo PAD aceito:
  `{ tipoSaneamento: "campo_pad_aceito", campoAfetado, valorAceito, fonteAceita: "PAD" }`;
- campo corrigido:
  `{ tipoSaneamento: "campo_corrigido", campoAfetado, valorCorrigido }`.

**Validações do frontend antes do POST.** Usuário responsável é obrigatório.
Justificativa é obrigatória para `ACEITO`, `REJEITADO`, `CORRIGIDO` e
`REVERTIDO`. Para rateio manual, `ACEITO`/`CORRIGIDO` exigem área e natureza em
todas as linhas, soma de `percentualValor = 100` com tolerância pequena e soma
de `percentualQuantidade = 100` quando esse percentual for preenchido. Para
divergência de campo, `CORRIGIDO` exige `valorCorrigido`.

**Usabilidade e auditoria.** O detalhe da divergência destaca se há bloqueio de
publicação e se o saneamento exige payload estruturado. O formulário mostra
resumo do payload e bloco recolhível "Ver payload técnico". Após registro de
decisão, a tela recarrega auditoria, lista e detalhe, e informa que
`aplicadaAoPlano=false`, com reconstrução/publicação não alteradas. O serviço de
decisão continua acrescentando o snapshot `_segurancaPreAtivacao` dentro do
JSON `payload_decisao_json`, preservando o payload do usuário.

**Limitações remanescentes.** A interface não faz fuzzy matching, não resolve
divergência automaticamente, não cria rateio no banco, não limpa divergências e
não substitui a auditoria/dry-runs obrigatórios antes de qualquer ativação.

#### 16.2.15. Decisão assistida na tela de revisão (Etapa 9.2 — implementada)

A Etapa 9.2 reformulou a usabilidade do painel "Registrar decisão" da tela
`SISTEMA > Revisão de divergências PAD x memória` para reduzir a digitação
manual no saneamento das divergências PAD/PROFOR 2022. É uma mudança
**exclusivamente de frontend/UX**: não altera backend, banco, migration,
dependências, publicação, origem ativa nem o `planoAplicacao` oficial. O patch é
incremental e reversível; a tela não foi reescrita.

**Problema de UX.** O formulário anterior exigia, em toda decisão, justificativa
em texto livre, redigitação do usuário responsável e exibição permanente de
campos técnicos (valor aplicado, decisão técnica, payload). Para divergências
repetitivas — como equivalência por descrição normalizada, em que a diferença é
apenas de acentuação — isso tornava o fluxo lento e propenso a inconsistência
textual.

**Presets por tipo de divergência.** A função `obterPresetsDecisaoRevisao()`
gera, conforme a categoria de saneamento, opções pré-definidas que já trazem
decisão e justificativa padronizada:

- `equivalencia_por_descricao_normalizada`: Aceitar equivalência (`ACEITO`,
  justificativa "Descrição coincide após normalização textual, com mesma
  natureza e mesmo valor unitário dentro da tolerância definida."), Rejeitar
  (`REJEITADO`), Revisar depois (`EM_REVISAO`).
- `item_nao_apto` e variantes: Liberar item para dry-run (`ACEITO`), Manter
  bloqueado (`REJEITADO`), Revisar depois (`EM_REVISAO`).
- categoria `rateio` (`item_novo_sem_rateio`, `item_pad_sem_rateio`,
  `rateio_novo`, `correcao_de_rateio`): Aplicar rateio sugerido (quando o
  payload traz `rateioSugerido`), Informar rateio manual, Revisar depois.
- categoria `ausencia` (`item_ausente_no_pad`, `item_substituido`): Confirmar
  ausência, Não confirmar (revisar), Revisar depois.
- categoria `consistencia` (`quantidade_valor_unitario_inconsistente`): Aceitar
  total do PAD, Manter alerta, Revisar depois.
- categoria `campo` (`valor_diferente` etc.): Aceitar valor do PAD, Corrigir
  manualmente (`CORRIGIDO`), Manter memória (`REJEITADO`), Revisar depois.
- categoria genérica: Aceitar, Rejeitar, Revisar depois.

**Ações rápidas e motivo selecionável.** No topo do painel há chips de ação
rápida (um por preset). Clicar um chip — ou escolher no dropdown "Motivo da
decisão" — pré-preenche a decisão técnica e a justificativa, monta/atualiza o
`payloadDecisao` e atualiza o resumo, **sem registrar**. O registro só ocorre ao
clicar "Registrar decisão". A justificativa enviada ao backend é composta por
`comporJustificativaDecisaoRevisao()` = texto padrão do motivo + observação
adicional opcional; não é mais exigido texto livre quando há motivo padrão
selecionado.

**Campos ocultados/recolhidos.** O campo "Valor aplicado" fica oculto por padrão
e só aparece quando a decisão é `CORRIGIDO`. O payload técnico permanece em
`<details>` recolhível. A observação livre virou `<details>` "Observação
adicional (opcional)". A decisão técnica (`select #revisao-decisao`) foi movida
para `<details>` "Opções avançadas (decisão manual)", para decisões fora dos
presets. O formulário principal ficou enxuto: ação → motivo → usuário
responsável → campos específicos do tipo → botão registrar.

**Usuário responsável.** O campo é pré-preenchido com o valor salvo em
`localStorage` (`profor2022:revisao:usuarioResponsavel`); na ausência de valor
salvo, usa o padrão local `usuario-local`. Ao registrar uma decisão, o valor
atual é persistido no `localStorage`, evitando redigitação nas próximas.

**Compatibilidade preservada.** O rateio manual da categoria `rateio` continua
funcionando integralmente — adicionar/remover linha, validação da soma de
`% valor` e `% quantidade` e geração de `payloadDecisao.rateio`. O payload
técnico exibido continua sendo exatamente o objeto enviado no POST (ambos vêm de
`montarPayloadDecisaoRevisao()`). O snapshot `_segurancaPreAtivacao`, os logs e a
rastreabilidade permanecem inalterados, assim como o contrato do backend. As
decisões já existentes não são afetadas.

**Confirmação.** Esta etapa é apenas de frontend/UX e documentação; não houve
publicação, alteração da origem ativa, de `frontend/data/publicados` ou do
`planoAplicacao` oficial.

#### 16.2.16. Saneamento sistêmico de pendências de diacrítico (Etapa 9.3 — implementada)

A Etapa 9.3 trata as pendências residuais cuja diferença é exclusivamente de
acentuação/diacrítico e corrige a exibição/payload de `item_ausente_no_pad`. A
mudança é de frontend/UX, auditoria/saneamento auditável em dry-run e testes;
não cria migration, não publica e não altera a origem ativa nem o
`planoAplicacao` oficial.

**Auditoria dry-run.** O comando `npm run profor:pad:diacritico:auditar-pendencias`
(script `auditar-pendencias-diacritico-pad-profor-2022.js`) lê a fila de revisão
e classifica cada divergência, gerando
`backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.json` e `.md`.
A lógica de classificação fica no serviço puro
`profor-pad-diacritico-auditoria-service.js` (testável sem banco).
Classificações: `saneavel_automaticamente_por_diacritico`, `divergencia_material`,
`historico_nao_reapresentado_sem_correspondencia`, `dados_insuficientes` e
`ja_decidido`.

**Critério de saneamento automático.** Uma divergência só é
`saneavel_automaticamente_por_diacritico` quando a descrição memória x PAD difere
apenas por acentuação/diacrítico; números e tokens técnicos são idênticos; mesmo
convênio; natureza compatível; valor unitário compatível dentro de R$ 0,01; há
evidência de correspondência no PAD (`saneadoPorDiacritico` no payload ou em
`equivalenciasDiacriticoSaneadas`); e não há decisão humana conflitante. Não são
saneáveis diferenças numéricas/técnicas (`2.4ghz` x `4.2ghz`), divergências de
valor unitário, naturezas divergentes ou itens sem dados materiais suficientes.

**Saneamento sistêmico auditável.** O comando
`npm run profor:pad:diacritico:sanear-pendencias` (script
`sanear-pendencias-diacritico-pad-profor-2022.js`) reaproveita o relatório
dry-run e registra decisão resolutiva **apenas** para os IDs classificados como
`saneavel_automaticamente_por_diacritico`, sempre pelo serviço existente
`registrarDecisao` (nunca SQL direto). Decisão registrada: `CORRIGIDO`; usuário
`sistema-saneamento-diacritico`; `aplicadaAoPlano=false`; o serviço gera o
snapshot `_segurancaPreAtivacao` e o log automaticamente. Proteção defensiva:
antes de registrar, o script re-consulta o status atual e ignora qualquer
divergência que já tenha decisão resolutiva, evitando decisão duplicada. A
justificativa padrão registra que a diferença é exclusivamente de
acentuação/diacrítico, sem ausência real nem alteração material.

**Correção de `item_ausente_no_pad`.** `divergenciasAusentes()` em
`profor-pad-revisao-service.js` produz `valorAnterior: "presente_na_memoria"` e
`valorNovo: "ausente_no_pad"` (marcadores de estado, nunca descrição). O payload
carrega `descricaoMemoria`, `naturezaMemoria`, `quantidadeMemoria`,
`valorUnitarioMemoria`, `valorPrevistoMemoria`, `valorExecutadoMemoria`,
`saldoMemoria`, `totalRateiosAtivosMemoria`, `memoria`, `antes` e a flag
`saneadoPorDiacritico`. Quando um valor não existe, vai como `null` — nunca a
descrição.

**Correção da interface.** Para `campoAfetado = 'existencia'` a tela de revisão
não exibe mais descrição em "Valor anterior/novo": mostra "Estado anterior/novo"
(Presente na memória / Ausente no PAD) e os valores financeiros reais da memória,
exibindo "não informado" quando ausentes. Quando há evidência de saneamento por
diacrítico, "Confirmar ausência" deixa de ser a ação principal — a ação primária
passa a ser "Não é ausência (diferença de acento)". A lista operacional padrão
oculta divergências com decisão resolutiva, históricas não reapresentadas e
saneadas por diacrítico; o checkbox "Mostrar históricos/saneados automaticamente"
reexibe tudo para auditoria.

**Estado da fila e confirmação.** No diagnóstico atual (145 divergências), os 3
casos reais de equivalência por diacrítico do convênio 937782 já estavam
`ACEITO` e o `item_ausente_no_pad` correspondente já estava `CORRIGIDO` —
portanto a auditoria reporta 0 pendências saneáveis residuais e o saneamento
sistêmico registra 0 decisões. A divergência #24 ("Meia militar", convênio
937265) permanece `PENDENTE` por divergência material de valor unitário. Nenhuma
decisão falsa de ausência foi criada; nenhuma decisão ou log foi apagado.

#### 16.2.17. Rateio por quantidade por setor (Etapa 9.4 — implementada)

A Etapa 9.4 reformulou o painel de rateio da tela `SISTEMA > Revisão de
divergências` para refletir como o usuário realmente trabalha: classificar o
item entre os setores e atribuir quantidades inteiras. É mudança
**exclusivamente de frontend/UX**; o backend, o banco e o contrato de API não
foram alterados.

**Rateio por quantidade.** Cada linha do rateio passou a ter apenas dois campos:
**Setor** — `<select>` fixo com `OUVIDORIA`, `CORREGEDORIA` e `ESCOLA PENAL`, sem
digitação livre — e **Quantidade** (inteiro). Foram removidos os campos de
percentual (`% valor`, `% quantidade`), a observação por linha e a observação
geral do rateio. Não há mais rateio de valor: o que se divide é a quantidade.

**Natureza automática.** A natureza do item não é digitada — vem do PAD
(`payload.naturezaPad`) e é exibida como referência. O PAD novo traz a natureza
de todos os itens.

**Quantidade total.** Usa `payload.quantidadePad` quando disponível; quando o PAD
não traz, a tela pede a quantidade total em campo próprio. Um indicador mostra,
em tempo real, "Atribuído: X de Y" e se o rateio fechou.

**Conversão para o backend.** O backend (`validarRateioManual` em
`profor-pad-decisao-aplicacao-service.js`) continua esperando `percentualQuantidade`
somando 100 e `area`/`natureza` por linha. Em `montarPayloadDecisaoRevisao`, a
quantidade de cada setor é convertida em `percentualQuantidade`
(`quantidadeDaLinha ÷ somaDasQuantidades × 100`); cada item de
`payloadDecisao.rateio` carrega `area`, `natureza` (do PAD), `quantidade`
absoluta (rastreabilidade) e `percentualQuantidade`. `percentualValor` deixou de
ser enviado. O backend não foi tocado.

**Validação.** Toda linha exige setor e quantidade maior que zero; setor não pode
repetir; a soma das quantidades deve fechar o total do item quando conhecido.

**Formulário de decisão simplificado.** O campo "Usuário responsável" foi
removido da tela — o usuário é sempre o mesmo, usado silenciosamente do
`localStorage` (fallback `usuario-local`); o POST continua enviando `usuario`. O
dropdown "Motivo da decisão" foi removido — a justificativa vem inteiramente do
preset da ação sugerida. O fluxo é: clicar na ação sugerida (chip) e em
"Registrar decisão".

**Confirmação.** Mudança apenas de frontend/UX; sem alteração de backend, banco,
migration, dependência, publicação, origem ativa ou `planoAplicacao` oficial.

#### 16.2.18. Vínculo de itens ausentes a substitutos no PAD (Etapa 9.5 — implementada)

A Etapa 9.5 trata o caso em que uma divergência `item_ausente_no_pad` não é, na
verdade, ausência real: o item foi reapresentado no PAD com alteração de
descrição/especificação (ex.: "Notebook 2.4ghz" → "Notebook 4.2ghz"), gerando um
item novo correspondente — possivelmente já tratado/aceito noutra divergência.
Sem essa regra, a tela induzia o usuário a confirmar ausência falsa.

**Regra de vínculo.** O serviço puro `profor-pad-substituto-auditoria-service.js`
classifica cada `item_ausente_no_pad` buscando um item novo no PAD
(`item_novo_sem_rateio`, `item_pad_sem_rateio` etc.). Só é `substituto_compativel`
quando: mesmo convênio; mesma UF; natureza compatível; quantidade igual; valor
unitário, valor previsto, valor executado e saldo compatíveis dentro de R$ 0,01;
e descrição compatível por **alteração controlada** — iguais após normalização ou
divergindo em no máximo um token que contenha dígitos. Sem fuzzy amplo: sem essas
travas materiais o caso vira `possivel_substituto_com_divergencia` (revisão
humana) ou `ausencia_real_sem_substituto`.

**Auditoria dry-run.** `npm run profor:pad:ausentes:auditar-substitutos` gera
`profor-2022-ausentes-substitutos-dry-run.{json,md}` com a lista de vínculos
sugeridos. Não altera o banco.

**Saneamento assistido.** `npm run profor:pad:ausentes:sanear-substitutos`
registra decisão resolutiva apenas para `substituto_compativel`, via serviço
existente `registrarDecisao` (sem SQL direto): decisão `CORRIGIDO`, usuário
`sistema-saneamento-substituto-pad`, `aplicadaAoPlano=false`,
`payloadDecisao.tipoSaneamento = "vinculo_item_substituto"`, snapshot
`_segurancaPreAtivacao` e log automáticos. A decisão registra o **vínculo**, não
confirma ausência. O motor de aplicação de decisões não interpreta esse tipo de
saneamento — é puramente de auditoria/rastreabilidade, não gera linha de plano.

**Interface.** Quando há vínculo de substituto, a tela exibe o bloco "Item
substituído no PAD" / "Vínculo com substituto saneado", indicando a divergência
vinculada; "Confirmar ausência" deixa de ser a ação principal, substituída por
"Confirmar vínculo com substituto". Itens realmente ausentes, sem substituto,
continuam como `item_ausente_no_pad` com a opção de confirmar ausência.

**Caso #76 → #23.** A divergência #76 ("Notebook 2.4ghz") era o espelho antigo da
#23 ("Notebook 4.2ghz", já `ACEITO`): mesmos convênio, UF, natureza, quantidade e
todos os valores; a decisão da #23 declara `itemMemoria.chaveItem` igual à
`chave_item` da #76. O saneamento vinculou a #76 à #23 (`PENDENTE → CORRIGIDO`); a
#23 permanece `ACEITO` e inalterada.

**Confirmação.** Sem publicação, sem alterar origem ativa, `frontend/data/publicados`
ou o `planoAplicacao` oficial; sem migration; nenhuma decisão falsa de ausência.

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

Regra técnica consolidada (21/05/2026):

- parsing de quantidade deve usar parser dedicado (`quantidadeParaNumeroProfor`);
- `moedaParaNumeroProfor` fica restrito a campos monetários;
- motivo: evitar inflação de quantidade em strings decimais da planilha antiga,
  como `"1.0"` sendo convertida para `10`.

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

---

## 23. Validação Ponta a Ponta (Etapa 9.2)

Em 21/05/2026, foi implementada e executada com sucesso a validação controlada ponta a ponta das decisões estruturadas para o PAD/PROFOR 2022.

### 23.1. Objetivos da Validação
1. Validar que a interface monta o payloadDecisao estruturado correto.
2. Confirmar que o registro via API (POST real) grava a decisão preservando o payload do usuário.
3. Garantir que o backend gera automaticamente o nó de integridade `_segurancaPreAtivacao`.
4. Assegurar que os logs de auditoria correspondentes são criados.
5. Confirmar que a resposta da API retorna `aplicadaAoPlano=false` (sinalizando dry-run).
6. Validar que o motor de aplicação interpreta e aplica as decisões corretas em modo dry-run na reconstrução e comparação.
7. Assegurar que o validador de segurança em produção ignora os casos de teste.
8. Confirmar que a rotina de limpeza remove os registros de teste e retorna o banco exatamente ao baseline.

### 23.2. Script de Validação
O script `backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js` foi criado e executado. Ele insere 6 divergências controladas de teste (usando o prefixo `revisao_teste:`) cobrindo todos os tipos de saneamento estruturado mínimos:
- Equivalência normalizada (`equivalencia_por_descricao_normalizada`) -> status ACEITO
- Rateio manual (`rateio_manual` para `item_novo_sem_rateio`) -> status ACEITO
- Ausência confirmada (`ausencia_confirmada` para `item_ausente_no_pad`) -> status ACEITO
- Liberação de item não apto (`liberacao_item_nao_apto` para `item_conhecido_nao_apto`) -> status ACEITO
- Inconsistência de cálculo (`consistencia_quantidade_valor_unitario`) -> status ACEITO
- Campo corrigido (`campo_corrigido` para `valor_diferente`) -> status CORRIGIDO

### 23.3. Resultados Obtidos
- Baseline verificado com sucesso (145 divergências reais, todas pendentes, 44 impeditivas, 48 bloqueantes).
- As 6 divergências e decisões correspondentes foram inseridas e persistidas com sucesso.
- O nó `_segurancaPreAtivacao` foi gerado perfeitamente com hash SHA-256 estável do payload da divergência.
- A auditoria pré-ativação de produção ignorou corretamente as decisões com prefixo `revisao_teste:`.
- Os motores dry-run de reconstrução e comparação interpretaram corretamente as 6 decisões.
- A limpeza removeu as 6 divergências de teste, decisões e logs vinculados, excluindo também o lote temporário.
- O banco SQLite de produção retornou exatamente ao baseline original de 145 divergências reais pendentes.

---

## 24. Auditoria Profunda de Pendências PAD (Etapa 9.3 — dry-run)

Em 21/05/2026, foi finalizada a entrega do commit `auditoria` (`d6e265a`), que havia adicionado o motor `backend/scripts/auditar-pendencias-profor-2022-profundo.js` sem integrá-lo ao fluxo npm, sem incluí-lo na validação de sintaxe e sem versionar os relatórios de saída.

### 24.1. Natureza da etapa
Esta etapa é **somente diagnóstico dry-run e documentação**. Não registra decisão, não altera status, não publica, não altera a origem ativa, não altera `frontend/data/publicados`, não altera o `planoAplicacao` oficial e não cria migration. O relatório gerado carrega o bloco `garantias` com todos os campos `false`.

### 24.2. Integração concluída
- Novo comando npm: `profor:pad:auditar-pendencias-profundo` → `node backend/scripts/auditar-pendencias-profor-2022-profundo.js`.
- Script incluído em `scripts/validar-syntax.js`.
- Revisão do motor confirmou: executa apenas `SELECT` (nenhum `INSERT/UPDATE/DELETE`), grava exclusivamente em `backend/data/relatorios`, e consome corretamente os 8 relatórios auxiliares (ausentes, diacrítico, item não apto, rateio antigo, quantidades, segurança pré-ativação, reconstrução e comparação).

### 24.3. Esteira executada
Auditorias auxiliares, nesta ordem: `auditar-fila-revisao`, `seguranca-pre-ativacao:dry-run`, `ausentes:auditar-substitutos`, `item-sem-rateio:auditar-rateio-antigo`, `item-nao-apto:auditar`, `diacritico:auditar-pendencias`, `rateio:auditar-quantidades:dry-run`, `reconstruir-plano:dry-run`, `comparar-plano:dry-run`. Em seguida, a auditoria profunda `profor:pad:auditar-pendencias-profundo`. Todos os comandos concluíram sem erro.

### 24.4. Relatórios gerados
- `backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json`
- `backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.md`

### 24.5. Resumo dos achados
- Total de divergências na fila: 145.
- Total analisado pela auditoria profunda: 110.
- Total `PENDENTE/EM_REVISAO`: 76.
- Total bloqueante técnico: 45.
- Total bloqueante operacional: 11.
- Total com decisão resolutiva: 34 (de 71 decisões registradas).
- Total de suspeitas/falsos positivos: 62.
- Total de pendências reais estimadas: 8.
- Bloqueios de segurança pré-ativação: 35 (28 decisões com payload alterado após a decisão + 7 divergências não reapresentadas).

### 24.6. Categorias encontradas
| Categoria | Qtd | Risco |
|---|---:|---|
| `valor_ou_saldo_inconsistente` | 67 | médio |
| `possivel_falso_positivo` | 62 | médio |
| `ja_saneado_mas_ainda_pendente` | 34 | médio |
| `duplicidade_ou_ambiguidade_pad` | 30 | alto |
| `pendencia_real` | 8 | alto |
| `diacritico_ou_acentuacao` | 1 | baixo |
| `historico_nao_reapresentado` | 1 | alto |

### 24.7. IDs prioritários
- Pendências reais que exigem decisão humana: `31, 32, 33, 34, 38, 39, 44, 46` — todas `item_nao_apto` com divergência material entre memória e PAD, nos convênios `937265` (MS), `937817` (RJ), `938128` (SP) e `938277` (MA).
- Possível diacrítico com divergência material: `#24` (`937265/MS`, "Meia militar") — diferença de acentuação acompanhada de divergência de preço (memória R$ 37,15 × PAD R$ 37,59); não saneável apenas por diacrítico.
- Histórico não reapresentado: `#28` (`937216/GO`) — já `ACEITO`, deve sair da lista operacional.
- Não foram encontrados IDs em `quantidade_suspeita`, `decisao_antiga_com_payload_alterado` (por ID), `ausente_com_substituto_*` nem `rateio_*` no conjunto analisado.

### 24.8. Problemas observados
- Código — decisão legada com valor não canônico em caixa baixa (`decisaoId 1: aceitar`): não entra nos conjuntos resolutivos que comparam valores canônicos em caixa alta; requer saneamento auditável específico ou nova decisão resolutiva.
- Código/risco — segurança pré-ativação acusa 35 bloqueios (payload alterado / divergência não reapresentada); decisões antigas não devem liberar ativação até revalidação assistida.
- UX — a filtragem de históricos/saneados ocorre no cliente após carregar a lista da API; recomenda-se filtro backend para pendência operacional efetiva.
- UX — o rateio manual coleta quantidade por área mas ainda converte para `percentualQuantidade` no payload; evoluir o motor para aceitar quantidade absoluta como fonte primária.

### 24.9. Próximos passos recomendados
1. Revalidar as decisões antigas bloqueadas pela segurança pré-ativação.
2. Resolver as 8 pendências reais bloqueantes (`item_nao_apto` material).
3. Tratar os 67 alertas de quantidade × valor unitário por decisão sistêmica auditável, mantendo o total PAD como fonte de verdade.
4. Manter históricos/saneados fora da lista operacional e avaliar filtro backend.
5. Só depois repetir reconstrução/comparador dry-run e avaliar ativação.

---

## 25. Detalhamento da Segurança Pré-ativação e Separação Operacional (Etapa 9.4 — dry-run)

Em 22/05/2026, após a resolução manual da divergência `#24` (decisão canônica `#184`, `ACEITO`), a auditoria profunda foi aprofundada com foco nos bloqueios de segurança pré-ativação e na separação explícita entre pendência operacional e bloqueio técnico.

### 25.1. Natureza da etapa
Etapa **somente diagnóstico dry-run e documentação**. Não registra decisão, não altera status, não publica, não altera a origem ativa, `frontend/data/publicados` nem o `planoAplicacao` oficial, e não cria migration. A `#24` não foi reaberta nem refeita.

### 25.2. Entregas de código
- Novo script `backend/scripts/detalhar-seguranca-pre-ativacao-pad-profor-2022.js` (comando `npm run profor:pad:seguranca-pre-ativacao:detalhar`), que lê `profor-2022-pad-seguranca-pre-ativacao-dry-run.json` e produz um relatório dedicado de bloqueios.
- A auditoria profunda (`auditar-pendencias-profor-2022-profundo.js`) ganhou uma **camada operacional** que reduz as 15 classificações detalhadas a 6 categorias mutuamente exclusivas, e passou a incluir na análise as divergências citadas pela segurança pré-ativação (consulta ampliada). Ambos os scripts entraram em `scripts/validar-syntax.js`.

### 25.3. Camada operacional (6 categorias)
Cada divergência analisada recai em **exatamente uma** categoria operacional:

| Categoria operacional | Critério | Qtd |
|---|---|---:|
| `pendencia_operacional_real` | Pendente, sem decisão resolutiva, exige decisão humana substantiva | 12 |
| `bloqueio_tecnico_seguranca` | Pendente e bloqueante, sem enquadramento operacional/falso positivo | 2 |
| `decisao_resolutiva_com_pendencia_tecnica` | Já decidido, mas mantém bloqueio técnico (não reapresentada) | 7 |
| `revalidacao_necessaria` | Decisão resolutiva com payload alterado após a decisão | 27 |
| `historico_saneado` | Já decidido sem bloqueio, ou pendente histórico/não reapresentado | 34 |
| `falso_positivo_saneavel` | Pendente com indício de falso positivo saneável por regra | 61 |

Critério-chave: item `ACEITO/CORRIGIDO` **nunca** é contado como pendência operacional, mesmo carregando bloqueio técnico de segurança.

### 25.4. Totais atualizados após a `#24`
- Divergências na fila: 145; analisadas pela auditoria profunda: 143.
- `PENDENTE/EM_REVISAO` (status): 75.
- Bloqueante operacional: 10 (era 11 — a `#24` saiu).
- Com decisão resolutiva: 68 (de 71 decisões registradas).

### 25.5. Bloqueios de segurança pré-ativação
Total de 35 bloqueios, detalhados em `profor-2022-seguranca-pre-ativacao-detalhada-dry-run`:
- 28 decisões com `payload_alterado_apos_decisao`, em 27 divergências distintas (`#47`–`#74`, exceto `#55` e `#76`); todas `item_ausente_no_pad`.
- 7 divergências `nao_reapresentada_com_decisao_resolutiva` (`#25, #26, #27, #28, #75, #77, #78`).
- Origem provável da mudança: `provavel_reextracao_ou_regeracao_pad` em 100% dos casos. **Nenhum** bloqueio decorre diretamente da correção do parser de quantidade — os 28 são alertas de existência (`item_ausente_no_pad`), não de quantidade.

### 25.6. Pendências reais (excluída a `#24`)
Confirmadas `PENDENTE/impeditivo/bloqueante`, nenhuma resolvida:
`#31` Calça Tática, `#32` Cinto Tático, `#33` Coturno, `#34` Geladeira 410L (`937265/MS`); `#38` Capacete Protetor (`937817/RJ`); `#39` Agenda Planner, `#44` Saldo Residual (`938128/SP`); `#46` Saldo Remanescente (`938277/MA`). A auditoria ainda sinaliza `#88, #89, #97, #115` como pendência operacional adicional (alertas de quantidade × valor unitário sem enquadramento de falso positivo).

### 25.7. Plano de revalidação
1. **Payload alterado** (27 divergências): revalidar decisão, comparar payload antigo × atual, confirmar origem técnica; registrar nova decisão apenas em etapa posterior.
2. **Não reapresentadas com decisão resolutiva** (7): manter como histórico; avaliar se ainda devem bloquear a segurança; não exibir como pendência operacional.
3. **Pendências reais** (8 + 4 adicionais): manter para revisão humana substantiva.
4. **Falsos positivos saneáveis** (61): propor saneamento sistêmico auditável em etapa posterior.

### 25.8. Confirmações
Nenhuma decisão registrada nesta etapa; nenhuma publicação; origem ativa, `frontend/data/publicados` e `planoAplicacao` oficial intactos; divergências, decisões e logs preservados.

---

## 26. Saneamento técnico de `item_nao_apto` por conjunto PAD equivalente

Em 22/05/2026, a auditoria de `item_nao_apto` foi ajustada para evitar falso positivo quando a memória está agregada e o PAD novo apresenta o mesmo item em múltiplas linhas equivalentes.

### 26.1. Caso motivador
- Divergência: `#31`.
- Convênio/UF: `937265/MS`.
- Item: `Calça Tática`.
- Memória: `valorPrevistoMemoria = 16526.33`, `valorUnitarioMemoria = 330.53`, `quantidadeMemoria = 49.999486`.
- Rateios antigos: quantidades `300` e `200`, com valores previstos compatíveis com aproximadamente `30` e `20` unidades.
- PAD: duas linhas equivalentes de `30` e `20` unidades, totalizando `50` unidades e `R$ 16.526,33`.

### 26.2. Regra técnica
A auditoria `backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022.js` passa a:
- carregar `backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json`;
- localizar linhas PAD equivalentes por `numeroConvenio`, descrição normalizada, natureza e valor unitário aproximado;
- consolidar quantidade, valor previsto, valor executado e saldo;
- detectar rateios legados com quantidade incompatível com `valorPrevistoReferencia / valorUnitarioReferencia`, inclusive padrão de inflação decimal por fator 10;
- classificar como `falso_positivo_saneavel` quando o conjunto PAD consolidado fecha com a memória, mesmo que a comparação contra a linha PAD isolada diverja.

### 26.3. Limite da regra
A regra não registra decisão, não altera aptidão no banco, não aplica decisão ao `planoAplicacao`, não publica e não altera a origem ativa. Ela apenas qualifica a pendência operacional para saneamento assistido posterior.

### 26.4. Impacto operacional
A divergência `#31` deixa de ser pendência operacional real quando o conjunto `Calça Tática` fecha com:
- quantidade consolidada PAD: `50`;
- valor unitário compatível: `330.53`;
- valor previsto total: `16526.33`;
- valor executado: `0`;
- saldo consolidado: `16526.33`.

O relatório passa a explicar que o bloqueio anterior decorreu de saldo antigo inconsistente e quantidade legada contaminada, combinados com comparação contra apenas uma linha PAD.

### 26.5. Integração com a tela de revisão
Em 22/05/2026, a tela `SISTEMA > Revisão de divergências PAD x memória` passou a consumir a classificação operacional da auditoria profunda.

A API de revisão enriquece `listarDivergencias()` e `obterDivergencia()` com:
- `categoriaOperacional`;
- `classificacaoDetalhada`;
- `riscoOperacional`;
- `falsoPositivoSaneavel`;
- `padConsolidado`;
- `memoriaConsolidada`;
- `motivosSaneamento`;
- `acaoOperacionalRecomendada`.

Filtros adicionados:
- `categoriaOperacional=pendencia_operacional_real`;
- `categoriaOperacional=falso_positivo_saneavel`;
- `operacionalEfetiva=true`.

Regra de interface:
- por padrão, a lista usa `operacionalEfetiva=true`;
- falsos positivos saneáveis não aparecem na fila operacional padrão;
- ao filtrar `falso_positivo_saneavel`, a divergência `#31` aparece com badge `Saneado tecnicamente`;
- o detalhe da `#31` exibe memória consolidada e PAD consolidado com `50` unidades e `R$ 16.526,33`, preservando as duas linhas PAD equivalentes (`30 + 20`).

A integração não altera status no banco, não registra decisão, não publica e não altera a origem ativa do `planoAplicacao`.

---

## 27. Regra de Saldo Residual/Saldo Remanescente

Em 22/05/2026, foi adicionada regra específica para itens denominados `Saldo Residual`, `Saldo Remanescente`, `Saldo Remanescente de Aplicação`, `Saldo de Aplicação`, `sobra de saldo residual` e equivalentes controlados.

### 27.1. Invariantes

- Saldo residual/remanescente é item técnico, não setorializado por área operacional.
- A área deve permanecer como `N/A`, `NAO INFORMADO`, `SEM AREA`, nulo técnico ou equivalente controlado.
- O item deve ter natureza orçamentária obrigatória: `CAPITAL` ou `CUSTEIO`.
- `CAPITAL` e `CUSTEIO` não podem ser misturados.
- Para equivalência, comparação, reconstrução e auditoria, a chave mínima é `numeroConvenio + descricaoNormalizada + natureza`.
- Saldo residual não pode ser redistribuído para OUVIDORIA, CORREGEDORIA, ESCOLA PENAL ou outra área operacional.

### 27.2. Implementação

- Serviço central: `backend/services/profor-2022/profor-saldo-residual-service.js`.
- Auditoria dry-run: `npm run profor:pad:saldos-residuais:auditar`.
- Relatórios:
  - `backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.json`;
  - `backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.md`.
- Reconstrução dry-run:
  - cria linha técnica com área `NAO INFORMADO`;
  - registra impedimento `saldo_residual_natureza_divergente` quando a natureza PAD diverge da memória/rateio;
  - registra impedimento `saldo_residual_rateado_indevidamente` quando houver rateio por área operacional;
  - não usa distribuição percentual por setor para saldo residual.
- Comparador:
  - consolida saldos residuais por convênio, descrição e natureza;
  - normaliza áreas técnicas equivalentes (`N/A`, `NAO INFORMADO`) sem transformar em área operacional;
  - recria chave de decisão de saldo residual com natureza.
- Motor de decisões:
  - rejeita como não aplicável decisão `rateio_manual` que tente ratear saldo residual por área operacional;
  - não apaga decisão histórica incompatível, apenas impede efeito automático no dry-run.

### 27.3. Caso-piloto `#44`

A divergência `#44` (`938128/SP`, `Saldo Residual`) permanece como `pendencia_operacional_real`, com classificação `saldo_residual_natureza_divergente`.

Motivo: a memória aponta `CAPITAL` de R$ 22.351,09 e o PAD novo aponta `CUSTEIO` de R$ 71,36. Esses itens não são equivalentes, ainda que tenham a mesma descrição normalizada.

A tela `SISTEMA > Revisão de divergências` exibe:
- badge `Saldo residual técnico`;
- alerta de segregação por natureza;
- recomendação operacional específica.

### 27.4. Resultado da auditoria

Na geração de 22/05/2026:
- saldos residuais/remanescentes encontrados: 113;
- mistura `CAPITAL/CUSTEIO`: 57;
- rateio por setor no relatório final pós-correção: 0;
- decisões anteriores afetadas: 23;
- decisão histórica `#150` da divergência `#18` identificada como incompatível por rateio setorial, sem apagamento.

### 27.5. Escopo preservado

Esta correção não registra decisão, não altera status, não publica, não altera origem ativa, não muda `frontend/data/publicados` e não altera o `planoAplicacao` oficial. O efeito é limitado a auditoria, reconstrução/comparação dry-run, neutralização de efeitos incompatíveis e exibição operacional na tela.

