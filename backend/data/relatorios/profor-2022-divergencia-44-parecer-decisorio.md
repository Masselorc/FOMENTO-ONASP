# PROFOR 2022 - Parecer tecnico-operacional da divergencia #44

Data: 2026-05-22  
Modo: diagnostico decisorio, sem registro de decisao, sem publicacao e sem alteracao do plano oficial.

## 1. Identificacao

- Divergencia: `#44`
- Convenio/UF: `938128/SP`
- Tipo: `item_nao_apto`
- Item: `Saldo Residual`
- Chave: `938128::SALDO RESIDUAL`
- Status atual: `ACEITO`
- Decisao relacionada: `#186`
- Categoria operacional atual: `pendencia_operacional_real`

## 2. Tipo de problema

A divergencia nao e mais um erro simples de pareamento entre `CAPITAL` e `CUSTEIO`. O PAD novo contem linha de `Saldo Residual` de mesma natureza `CAPITAL`, mas em valor menor que a memoria antiga. Tambem contem uma parcela de `R$ 71,36` em `CUSTEIO`, enquanto a memoria antiga mantinha essa parcela dentro da chave `CAPITAL`.

Como saldo residual/remanescente e item tecnico nao setorializado, a area deve permanecer tecnica (`N/A`/`NAO INFORMADO`) e a comparacao deve ser segregada por natureza. `CAPITAL` e `CUSTEIO` nao podem ser tratados como equivalentes.

## 3. Evidencias

### Payload da #44

- Memoria:
  - area: `N/A, NAO INFORMADO`
  - natureza: `CAPITAL`
  - valor previsto: `R$ 22.351,09`
  - valor executado: `R$ 0,00`
  - saldo: `R$ 22.351,09`
- PAD usado no payload original:
  - natureza: `CUSTEIO`
  - valor previsto: `R$ 71,36`
  - valor executado: `R$ 0,00`
  - saldo: `R$ 71,36`

### Memoria/rateio antigo

Na memoria inicial, a chave `938128::SALDO RESIDUAL` possui dois rateios ativos, ambos marcados como `CAPITAL`:

| Area | Natureza | Valor previsto | Executado | Saldo |
|---|---|---:|---:|---:|
| N/A | CAPITAL | R$ 22.279,73 | R$ 0,00 | R$ 22.279,73 |
| NAO INFORMADO | CAPITAL | R$ 71,36 | R$ 0,00 | R$ 71,36 |
| Total | CAPITAL | R$ 22.351,09 | R$ 0,00 | R$ 22.351,09 |

### Linhas PAD do convenio 938128/SP relacionadas a saldo residual

| Linha PAD | Descricao | Natureza | Codigo | Valor previsto | Executado | Saldo |
|---:|---|---|---|---:|---:|---:|
| 19 | Saldo Residual | CUSTEIO | 33903099 | R$ 71,36 | R$ 0,00 | R$ 71,36 |
| 23 | Saldo Residual Servicos EAP | CUSTEIO | 33903999 | R$ 46.233,82 | R$ 0,00 | R$ 46.233,82 |
| 28 | sobra de saldo residual | CAPITAL | 44905200 | R$ 32.765,74 | R$ 0,00 | R$ 32.765,74 |
| 61 | Saldo Residual | CAPITAL | 44905299 | R$ 20.704,73 | R$ 0,00 | R$ 20.704,73 |

Para a divergencia `#44`, a linha PAD materialmente comparavel por mesma descricao/natureza e a linha 61: `Saldo Residual` `CAPITAL` de `R$ 20.704,73`.

### Decisao #186

A decisao `#186` registrou `ACEITO`, com `tipoSaneamento: liberacao_item_nao_apto`, `liberarUsoDryRun: true` e snapshot de seguranca presente. Ela libera o item nao apto para o dry-run, mas nao documenta nem resolve a diferenca material entre a memoria `CAPITAL` e o PAD `CAPITAL`.

## 4. Respostas decisorias

1. Valor do saldo residual de `CAPITAL` na memoria antiga: `R$ 22.351,09`.
2. Valor do saldo residual de `CAPITAL` no PAD novo: `R$ 20.704,73`.
3. Diferenca bruta, PAD menos memoria: `-R$ 1.646,36`.
4. Diferenca liquida considerando a parcela de `R$ 71,36` em `CUSTEIO`: `-R$ 1.575,00`.
5. O PAD mostra reducao do saldo `CAPITAL` e reclassificacao/apresentacao separada de `R$ 71,36` em `CUSTEIO`, mas nao prova sozinho que isso foi deliberado.
6. Nao foi encontrada evidencia documental externa no escopo consultado que comprove deliberacao formal da reducao ou reclassificacao.
7. A decisao `#186` nao resolve o merito material; ela apenas libera o item nao apto para uso em dry-run.
8. A decisao `#186` nao deve ser apagada nem revertida automaticamente. Deve ser complementada ou retificada apenas se houver confirmacao documental.
9. A `#44` deve continuar como `pendencia_operacional_real` ate confirmacao da reducao/reclassificacao.
10. Decisao recomendada agora: `revisar depois`, com dependencia de confirmacao documental externa. Se a area confirmar o ajuste do PAD, registrar decisao complementar `CORRIGIDO` por servico, com payload explicito sobre reducao de `CAPITAL` e reclassificacao de `R$ 71,36` para `CUSTEIO`.

## 5. Justificativa da recomendacao

Nao ha base tecnica para aceitar a `#44` como falso positivo: o PAD novo possui saldo residual `CAPITAL`, mas o valor e menor que a memoria. Tambem nao ha base para rejeitar ou reverter a decisao `#186`, porque ela tem escopo limitado a liberacao do item nao apto no dry-run e nao altera o plano oficial.

A decisao segura e manter a pendencia operacional real enquanto se confirma, por documento ou pela area responsavel, se:

- a reducao de `R$ 1.575,00` em `CAPITAL` e ajuste real do PAD;
- a parcela de `R$ 71,36` foi legitimamente reclassificada de `CAPITAL` para `CUSTEIO`;
- nao ha redistribuicao ou substituicao documentada em outra linha do PAD.

## 6. Efeito esperado

### Reconstrucao dry-run

A linha `Saldo Residual` `CAPITAL` e reconstruida em area tecnica `NAO INFORMADO`, valor `R$ 20.704,73`. A linha `Saldo Residual` `CUSTEIO` e reconstruida em area tecnica `NAO INFORMADO`, valor `R$ 71,36`. A decisao `#186` permite o uso do item no dry-run, mas a pendencia material permanece sinalizada pela auditoria/comparador.

### Comparador

O comparador mantem:

- `Saldo Residual` `CAPITAL` como divergente: memoria `R$ 22.351,09` x PAD/reconstrucao `R$ 20.704,73`;
- `Saldo Residual` `CUSTEIO` como linha nova de `R$ 71,36` sem correspondente antigo de mesma natureza;
- publicacao/ativacao nao apta enquanto houver pendencias materiais e bloqueios remanescentes.

## 7. Risco de regressao

Risco baixo se a regra atual for mantida: saldo residual continua separado por natureza e nao e distribuido para areas operacionais. O risco principal e operacional: registrar uma decisao `ACEITO` ou `CORRIGIDO` sem documentacao pode mascarar reducao/reclassificacao material de recurso.

## 8. Rollback/desfazer

Como este parecer nao registra decisao nem altera banco, o rollback deste artefato e apenas `git revert <commit>` se ele for versionado. Caso uma decisao futura seja registrada indevidamente, nao apagar decisao/log; registrar decisao posterior `REVERTIDO` ou decisao retificadora pelo servico existente, com `aplicadaAoPlano=false`.

