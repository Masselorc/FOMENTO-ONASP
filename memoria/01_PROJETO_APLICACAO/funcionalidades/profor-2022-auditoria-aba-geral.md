# PROFOR 2022 - Auditoria tecnica da aba Geral

## 1. Objetivo

Mapear, campo a campo, a dependencia operacional atual da aba `Geral` da planilha PROFOR 2022 e registrar a matriz tecnica para descontinuar essa aba como fonte da aplicacao, sem remover codigo nesta etapa.

Esta auditoria e documental. Nao altera logica de producao, frontend, schema, banco, planilhas ou JSONs publicados.

## 2. Decisao de governanca consolidada

1. DETRU prevalece sobre a aba `Geral` para dados cadastrais e financeiros oficiais do convenio.
2. Transferegov/rendimentos prevalece sobre a aba `Geral` para `saldoRendimentosAtual`.
3. Calculos internos devem substituir formulas e valores manuais antigos da planilha.
4. A aba `Geral` nao deve permanecer como fallback operacional da aplicacao.
5. A aba `Geral` pode continuar fisicamente na planilha apenas como controle historico.
6. Divergencias temporais ou por fonte oficial sao esperadas e nao bloqueiam a retirada.
7. Somente erro sem explicacao deve bloquear a retirada da dependencia.
8. Home principal, pagina PROFOR 2022 e publicacao estatica devem usar `banco-cache` quando o consolidado estiver completo.
9. Nao deve haver registro publico/visual de divergencias aceitas na aplicacao.

## 3. Criterio minimo para retirada

| Criterio | Estado observado |
| --- | --- |
| `totalComDetru = 15` | atendido nos JSONs publicados e na documentacao de divergencias |
| `totalComPlano = 15` | atendido nos JSONs publicados e na documentacao de divergencias |
| `totalComRendimentos = 15` | atendido nos JSONs publicados e na documentacao de divergencias |
| Publicacao estatica validada com `banco-cache` | publicada anteriormente; nao republicada nesta auditoria |
| Divergencias classificadas | classificadas em `profor-2022-divergencias.md` e complementadas nesta matriz |
| Erro sem explicacao | nenhum identificado nesta auditoria |

## 4. Matriz campo a campo

Legenda curta:

- Leitura antiga: `data-service.js:extrairProfor2022DoWorkbook` e `dashboard-publication-service.js:extrairProfor2022DoWorkbook`, salvo observacao.
- Uso: UI PROFOR 2022, home/dashboard, comparador ou resumo publicado.
- Risco: baixo, medio ou alto para retirada da aba `Geral`.

| Campo atual | Coluna original | Onde e lido hoje | Onde e usado | Fonte nova oficial | Regra futura | Situacao | Risco | Observacao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `uf` | A/0 | `COLUNAS_GERAL_PROFOR.uf` | filtros, lista, detalhe, chave visual | Carteira monitorada SQLite | derivar da carteira | pronto para desligar | baixo | carteira ja guarda UF |
| `instrumento` | B/1 | `COLUNAS_GERAL_PROFOR.instrumento` | filtro de convenio e home | Carteira monitorada SQLite | derivar da carteira | pronto para desligar | baixo | usar instrumento monitorado |
| `numero` | C/2 | `COLUNAS_GERAL_PROFOR.numero` | lista, detalhe, chaves | Carteira monitorada SQLite | derivar da carteira | pronto para desligar | baixo | DETRU confirma, carteira define escopo |
| `ano` | D/3 | `COLUNAS_GERAL_PROFOR.ano` | lista, detalhe, chaves | Carteira monitorada SQLite | derivar da carteira | pronto para desligar | baixo | chave unica com numero |
| `processoSei` | E/4 | `COLUNAS_GERAL_PROFOR.processoSei` | detalhe do convenio | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | fonte oficial cadastral |
| `vencimento` | F/5 | `COLUNAS_GERAL_PROFOR.vencimento` | countdown e detalhe | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | usar fim de vigencia oficial |
| `quantidadeTa` | G/6 | `COLUNAS_GERAL_PROFOR.quantidadeTa` | detalhe do convenio | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | decisao: sempre DETRU |
| `solicitouProrrogacao` | H/7 | `COLUNAS_GERAL_PROFOR.solicitouProrrogacao` | sem uso visual identificado | Não usado | remover da interface | sem uso identificado | baixo | nao reintroduzir |
| `valorGlobal` | I/8 | `COLUNAS_GERAL_PROFOR.valorGlobal` | KPIs, tabela, detalhe, resumo | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | fonte oficial prevalece |
| `valorRepasse` | J/9 | `COLUNAS_GERAL_PROFOR.valorRepasse` | KPIs e detalhe | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | fonte oficial prevalece |
| `valorContrapartida` | K/10 | `COLUNAS_GERAL_PROFOR.valorContrapartida` | KPIs e detalhe | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | fonte oficial prevalece |
| `repasseDesembolsado` | L/11 | `COLUNAS_GERAL_PROFOR.repasseDesembolsado` | detalhe do convenio | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | desembolso oficial |
| `rendimentoAprovado` | M/12 | `COLUNAS_GERAL_PROFOR.rendimentoAprovado` | bloco financeiro do detalhe | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | diferente de saldo atual |
| `saldoRendimentosAtual` | N/13 | `COLUNAS_GERAL_PROFOR.saldoRendimentosAtual` | KPI, detalhe e resumo | Transferegov/rendimentos | substituir por Transferegov | pronto para desligar | baixo | dado dinamico; divergencia temporal esperada |
| `saldoResidualCapital` | O/14 | `COLUNAS_GERAL_PROFOR.saldoResidualCapital` | detalhe e resumo | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | soma de saldos CAPITAL |
| `saldoResidualCusteio` | P/15 | `COLUNAS_GERAL_PROFOR.saldoResidualCusteio` | detalhe e resumo | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | soma de saldos CUSTEIO |
| `contrapartidaIntegralizada` | Q/16 | `COLUNAS_GERAL_PROFOR.contrapartidaIntegralizada` | bloco financeiro do detalhe | DETRU/siconv_convenio | substituir por DETRU | pronto para desligar | baixo | usar campo oficial quando houver |
| `valorExecutadoGeral` | R/17 | `COLUNAS_GERAL_PROFOR.valorExecutadoGeral` | execucao geral, resumo, detalhe | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | soma executado do plano |
| `previstoOuvidoria` | S/18 | `COLUNAS_GERAL_PROFOR.previstoOuvidoria` | KPI, tabela, home, detalhe | Plano de aplicação por UF | revisar fórmula | requer revisão de cálculo | medio | soma previsto OUVIDORIA |
| `previstoCorregedoria` | T/19 | `COLUNAS_GERAL_PROFOR.previstoCorregedoria` | resumo e comparador | Plano de aplicação por UF | revisar fórmula | requer revisão de cálculo | medio | soma previsto CORREGEDORIA |
| `previstoEscolaPenal` | U/20 | `COLUNAS_GERAL_PROFOR.previstoEscolaPenal` | resumo e comparador | Plano de aplicação por UF | revisar fórmula | requer revisão de cálculo | medio | soma previsto ESCOLA PENAL |
| `valorRelativoOuvidoria` | V/21 | `COLUNAS_GERAL_PROFOR.valorRelativoOuvidoria` | sem uso visual identificado | Não usado | remover da interface | sem uso identificado | baixo | calcular sob demanda se voltar |
| `execucaoOuvidoriaPercentual` | W/22 | `COLUNAS_GERAL_PROFOR.execucaoOuvidoriaPercentual` | KPI, filtros, alertas, tabela | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | executado/previsto OUVIDORIA |
| `execucaoCorregedoriaPercentual` | X/23 | `COLUNAS_GERAL_PROFOR.execucaoCorregedoriaPercentual` | comparador/resumo tecnico | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | executado/previsto CORREGEDORIA |
| `execucaoEscolaPenalPercentual` | Y/24 | `COLUNAS_GERAL_PROFOR.execucaoEscolaPenalPercentual` | comparador/resumo tecnico | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | executado/previsto ESCOLA PENAL |
| `saldoDisponivelOuvidoria` | Z/25 | `COLUNAS_GERAL_PROFOR.saldoDisponivelOuvidoria` | KPI, tabela, filtros, alertas | Pendente de decisão técnica | revisar fórmula | requer revisão de cálculo | alto | compositor atual define `null` |
| `valorExecutadoOuvidoria` | derivado | `resumirPlanoAplicacaoProfor` | KPI, home, detalhe | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | nao vem da aba Geral |
| `valorPrevistoOuvidoriaPlano` | derivado | `resumirPlanoAplicacaoProfor` | suporte tecnico | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | redundante com previsto Ouvidoria |
| `previstoCapitalOuvidoria` | derivado | `resumirPlanoAplicacaoProfor` | suporte tecnico | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | calculo por natureza |
| `previstoCusteioOuvidoria` | derivado | `resumirPlanoAplicacaoProfor` | suporte tecnico | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | calculo por natureza |
| `totalItensPlano` | derivado | `resumirPlanoAplicacaoProfor` | detalhe, diagnostico | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | usado em diagnostico 15/15/15 |
| `totalItensOuvidoria` | derivado | `resumirPlanoAplicacaoProfor` | detalhe e home | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | contagem filtrada |
| `planoAplicacao` | abas UF | `extrairPlanoAplicacaoProforDaAba` | detalhe e calculos | Plano de aplicação por UF | derivar do plano de aplicação | pronto para desligar | baixo | nao depende da aba Geral |
| `execucaoGeralPercentual` | resumo | `montarResumoProfor2022`/calculos | KPI principal e comparador | Cálculo interno | revisar fórmula | requer revisão de cálculo | medio | novo consolidado calcula pelo plano |

## 5. Campos prontos para desligar

Campos cadastrais e de carteira: `uf`, `instrumento`, `numero`, `ano`.

Campos DETRU: `processoSei`, `vencimento`, `quantidadeTa`, `valorGlobal`, `valorRepasse`, `valorContrapartida`, `repasseDesembolsado`, `rendimentoAprovado`, `contrapartidaIntegralizada`.

Campo Transferegov: `saldoRendimentosAtual`.

Campos ja derivados fora da aba `Geral`: `valorExecutadoOuvidoria`, `valorPrevistoOuvidoriaPlano`, `previstoCapitalOuvidoria`, `previstoCusteioOuvidoria`, `totalItensPlano`, `totalItensOuvidoria`, `planoAplicacao`.

Total nesta categoria: 21 campos.

## 6. Campos que exigem revisao de calculo

Exigem revisao/lock de formula antes da retirada definitiva:

`saldoResidualCapital`, `saldoResidualCusteio`, `valorExecutadoGeral`, `previstoOuvidoria`, `previstoCorregedoria`, `previstoEscolaPenal`, `execucaoOuvidoriaPercentual`, `execucaoCorregedoriaPercentual`, `execucaoEscolaPenalPercentual`, `saldoDisponivelOuvidoria`, `execucaoGeralPercentual`.

O maior ponto de atencao e `saldoDisponivelOuvidoria`: o compositor consolidado hoje retorna `null` e registra aviso de formula pendente. Enquanto a formula segura nao for definida, a interface nao deve apresentar esse campo como valor operacional confiavel.

Total nesta categoria: 11 campos.

## 7. Campos sem uso identificado

`solicitouProrrogacao` e `valorRelativoOuvidoria` nao tiveram uso visual/operacional identificado na tela PROFOR 2022, home ou publicacao. A recomendacao e nao migra-los para o fluxo operacional.

Total nesta categoria: 2 campos.

## 8. Campos que devem ser removidos da interface

1. `saldoDisponivelOuvidoria`: deve ser removido ou ocultado da interface enquanto nao houver formula segura.
2. `solicitouProrrogacao`: nao deve ser reintroduzido como campo visual.
3. `valorRelativoOuvidoria`: nao deve ser reintroduzido; se necessario, deve ser calculado sob demanda.

## 9. Campos que podem permanecer fisicamente na planilha

Todos os campos da aba `Geral` podem permanecer fisicamente na planilha como controle historico, desde que nao sejam fonte operacional nem fallback da aplicacao.

O uso futuro aceitavel da aba `Geral` e apenas:

1. consulta humana historica;
2. comparacao tecnica temporaria durante retirada;
3. apoio de auditoria fora da aplicacao.

## 10. Riscos

| Risco | Impacto | Mitigacao |
| --- | --- | --- |
| Remover fallback antes de revisar `saldoDisponivelOuvidoria` | alto | ocultar/remover campo visual ou definir formula segura antes |
| Usuario comparar com planilha antiga | medio | comunicacao operacional; sem painel publico de divergencias |
| Formula de plano misturar convenios da mesma UF | medio | manter filtro UF + numero + ano |
| Publicacao estatica cair para planilha em erro silencioso | medio | retirar fallback automatico na etapa propria e validar 15/15/15 |
| Campos sem uso voltarem por regressao visual | baixo | documentar como nao migrados |

## 11. Rollback recomendado

Como esta etapa e documental, o rollback e reverter o commit.

Na etapa de implementacao, o rollback tecnico recomendado e:

1. manter branch pequena;
2. antes da remocao definitiva, validar `banco-cache` 15/15/15;
3. se a retirada quebrar a tela ou publicacao, reverter o commit da etapa;
4. nao restaurar fallback para planilha como solucao permanente sem nova decisao de governanca.

## 12. Proxima etapa de implementacao

Recomendacao: implementar a retirada operacional da aba `Geral` em ordem conservadora:

1. Em `backend/services/profor-2022/profor-origem-service.js`, mudar o padrao efetivo para `banco-cache` ou remover a opcao operacional `planilha`, conforme decisao final.
2. Em `backend/services/dashboard-publication-service.js`, remover o fallback automatico para `extrairProfor2022DoWorkbook` quando `banco-cache` falhar; erro sem consolidado completo deve bloquear a publicacao.
3. Em `backend/services/data-service.js`, parar de montar `dadosProfor2022` a partir da aba `Geral` para uso operacional do navegador.
4. Em `backend/services/profor-2022/profor-consolidado-service.js`, revisar `saldoDisponivelOuvidoria` antes de expor o campo como operacional ou manter `null` e retirar da UI.
5. Em `frontend/js/app.js`, remover/ocultar campos sem utilidade operacional e `saldoDisponivelOuvidoria` se a formula continuar pendente.
6. Atualizar `profor-2022.md` e diario com a virada.

Nao implementar nesta auditoria.

## 13. Evidencias consultadas

Arquivos lidos nesta auditoria:

- `package.json`
- `backend/services/data-service.js`
- `backend/services/dashboard-publication-service.js`
- `backend/services/static-publication-service.js`
- `backend/services/profor-2022/profor-consolidado-service.js`
- `backend/services/profor-2022/profor-calculos-service.js`
- `backend/services/profor-2022/profor-plano-aplicacao-service.js`
- `backend/services/profor-2022/profor-origem-service.js`
- `backend/services/profor-2022/profor-comparador-service.js`
- `frontend/js/app.js`
- `frontend/data/publicados/aplicacao.json`
- `frontend/data/publicados/dashboard-geral.json`
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md`

Confirmacoes:

- `npm run publicar:dados` nao foi executado nesta auditoria.
- Nenhum JSON publicado foi alterado nesta auditoria.
- Nenhum codigo de producao foi alterado nesta auditoria.
