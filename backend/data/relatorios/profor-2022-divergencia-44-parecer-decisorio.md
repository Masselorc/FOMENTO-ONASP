# PROFOR 2022 - Parecer tecnico-operacional da divergencia #44

Data: 2026-05-22  
Modo: diagnostico decisorio com regra fixa de prevalencia do PAD novo. Nao publica, nao altera origem ativa e nao altera o plano oficial.

## 1. Identificacao

- Divergencia: `#44`
- Convenio/UF: `938128/SP`
- Tipo: `item_nao_apto`
- Item: `Saldo Residual`
- Chave: `938128::SALDO RESIDUAL`
- Status antes da regra de prevalencia: `ACEITO`
- Decisao previa relacionada: `#186`
- Categoria operacional revisada: resolvida por prevalencia do PAD novo, com rastreabilidade da diferenca memoria x PAD.

## 2. Regra decisoria aplicada

Regra fixa definida para a frente PAD/PROFOR 2022: os dados do PAD novo sao a fonte correta e prevalecem integralmente sobre a memoria antiga. A memoria antiga passa a ser referencia historica/comparativa quando divergir do PAD.

Essa regra nao autoriza misturar `CAPITAL` e `CUSTEIO` nem setorializar saldo residual. O saldo residual/remanescente continua sendo item tecnico, em area `N/A`/`NAO INFORMADO`, e deve ser mantido segregado por natureza.

## 3. Evidencias

### Memoria antiga

Na memoria inicial, a chave `938128::SALDO RESIDUAL` possui dois rateios ativos, ambos marcados como `CAPITAL`:

| Area | Natureza | Valor previsto | Executado | Saldo |
|---|---|---:|---:|---:|
| N/A | CAPITAL | R$ 22.279,73 | R$ 0,00 | R$ 22.279,73 |
| NAO INFORMADO | CAPITAL | R$ 71,36 | R$ 0,00 | R$ 71,36 |
| Total | CAPITAL | R$ 22.351,09 | R$ 0,00 | R$ 22.351,09 |

### PAD novo - convenio 938128/SP

| Linha PAD | Descricao | Natureza | Codigo | Valor previsto | Executado | Saldo |
|---:|---|---|---|---:|---:|---:|
| 19 | Saldo Residual | CUSTEIO | 33903099 | R$ 71,36 | R$ 0,00 | R$ 71,36 |
| 23 | Saldo Residual Servicos EAP | CUSTEIO | 33903999 | R$ 46.233,82 | R$ 0,00 | R$ 46.233,82 |
| 28 | sobra de saldo residual | CAPITAL | 44905200 | R$ 32.765,74 | R$ 0,00 | R$ 32.765,74 |
| 61 | Saldo Residual | CAPITAL | 44905299 | R$ 20.704,73 | R$ 0,00 | R$ 20.704,73 |

Para a divergencia `#44`, a linha PAD materialmente comparavel por mesma descricao/natureza e a linha 61: `Saldo Residual` `CAPITAL` de `R$ 20.704,73`. A parcela `CUSTEIO` de `R$ 71,36` permanece segregada e nao e tratada como equivalente a `CAPITAL`.

### Decisao #186

A decisao `#186` registrou `ACEITO`, com `tipoSaneamento: liberacao_item_nao_apto`, `liberarUsoDryRun: true`, `aplicadaAoPlano=false` e snapshot de seguranca presente. Ela nao deve ser apagada. Com a regra fixa de prevalencia do PAD, a decisao fica preservada como historico e pode ser complementada por decisao retificadora `CORRIGIDO`.

## 4. Respostas decisorias

1. Valor do saldo residual de `CAPITAL` na memoria antiga: `R$ 22.351,09`.
2. Valor do saldo residual de `CAPITAL` no PAD novo: `R$ 20.704,73`.
3. Diferenca bruta, PAD menos memoria: `-R$ 1.646,36`.
4. Diferenca liquida considerando a parcela de `R$ 71,36` em `CUSTEIO`: `-R$ 1.575,00`.
5. O PAD novo mostra reducao do saldo `CAPITAL` e apresentacao segregada de `R$ 71,36` em `CUSTEIO`; pela regra fixa, isso e atualizacao valida do PAD.
6. Nao se exige documento externo para validar valor, natureza, codigo, quantidade, valor previsto, executado ou saldo do PAD.
7. A decisao `#186` nao precisa ser apagada; ela e historico de liberacao do item nao apto em dry-run.
8. A decisao `#186` deve ser complementada por decisao retificadora `CORRIGIDO`, se registrada pelo servico existente.
9. A `#44` nao deve mais permanecer como `pendencia_operacional_real`.
10. Decisao recomendada: `CORRIGIDO`, com payload explicito de prevalencia do PAD novo e `aplicadaAoPlano=false`.

## 5. Justificativa da decisao

A diferenca entre memoria antiga e PAD novo deixa de ser pendencia material porque a fonte prevalente foi definida: o PAD novo e correto e suficiente. A memoria antiga continua servindo para rastrear a mudanca, mas nao bloqueia a reconstrucao dry-run nem exige confirmacao documental.

A correcao nao mistura naturezas:

- `CAPITAL` memoria `R$ 22.351,09` x PAD `CAPITAL` `R$ 20.704,73` fica registrado como diferenca historica aceita por prevalencia do PAD;
- `CUSTEIO` PAD `R$ 71,36` permanece linha propria, sem equivalencia com `CAPITAL`;
- area tecnica permanece `NAO INFORMADO`, sem distribuicao para OUVIDORIA, CORREGEDORIA, ESCOLA PENAL ou outra area operacional.

## 6. Efeito esperado

### Reconstrucao dry-run

A reconstrucao usa as linhas do PAD novo:

- `Saldo Residual` `CAPITAL`, codigo `44905299`, area tecnica `NAO INFORMADO`, valor `R$ 20.704,73`;
- `Saldo Residual` `CUSTEIO`, codigo `33903099`, area tecnica `NAO INFORMADO`, valor `R$ 71,36`.

Nenhuma linha e setorializada por area operacional.

### Comparador

O comparador continua exibindo a diferenca memoria x PAD como rastreabilidade, mas a auditoria operacional nao deve classificá-la como pendencia real. A diferenca passa a ser atualizacao valida do PAD novo.

## 7. Risco de regressao

Risco baixo se a regra ficar restrita a prevalencia do PAD novo e continuar exigindo segregacao por natureza. O risco principal e permitir pareamento por descricao sem natureza; por isso `CAPITAL` e `CUSTEIO` continuam separados.

## 8. Rollback/desfazer

Rollback de codigo/documentacao: `git revert <commit>` e regeneracao dos relatorios dry-run.
Rollback de decisao, se uma decisao retificadora for registrada indevidamente: nao apagar decisao/log; registrar decisao posterior `REVERTIDO` pelo servico existente, com `aplicadaAoPlano=false`.
