# Planejamento Macro — Automação do Plano de Aplicação dos Convênios

## 1. Finalidade deste documento

Este documento orienta agentes de IA, Codex, revisores técnicos e desenvolvedores na implementação gradual da nova sistemática de alimentação dos dados do plano de aplicação detalhado dos convênios acompanhados pela aplicação FOMENTO-ONASP.

A mudança pretendida consiste em substituir, de forma controlada e incremental, a dependência atual de uma planilha única com abas por UF por um novo fluxo baseado em múltiplos arquivos Excel, um por instrumento/convênio. Cada arquivo Excel deverá conter os dados do plano de aplicação detalhado daquele instrumento, incluindo itens, quantidades, valores previstos, valores executados e demais campos necessários aos cálculos da aplicação.

O objetivo não é alterar a interface inicialmente. O objetivo é criar uma nova origem de dados normalizada, validada e compatível com os cálculos e telas já existentes.

---

## 2. Contexto atual da aplicação

A aplicação FOMENTO-ONASP possui arquitetura híbrida:

- frontend em HTML, CSS e JavaScript;
- backend local em Node.js;
- banco SQLite local;
- serviços backend para leitura, normalização, persistência e publicação;
- modo local/API editável;
- modo estático/GitHub Pages somente leitura;
- publicação de dados em JSONs derivados dentro de `frontend/data/publicados/`.

A aplicação não deve ser tratada como uma simples página estática. Qualquer alteração em dados de convênios deve respeitar o pipeline existente de leitura, normalização, cálculo, publicação e validação.

### 2.1. Arquivos relevantes já identificados

Arquivos centrais:

- `package.json`
- `backend/server.js`
- `backend/data/aplicacao.json`
- `backend/services/data-service.js`
- `backend/services/dashboard-publication-service.js`
- `backend/services/static-publication-service.js`
- `backend/services/profor-2022/profor-consolidado-service.js`
- `backend/services/profor-2022/profor-plano-aplicacao-service.js`
- `backend/services/profor-2022/profor-calculos-service.js`
- `backend/db/init-db.js`
- `frontend/js/app.js`
- `frontend/data/publicados/aplicacao.json`
- `frontend/data/publicados/dashboard-geral.json`
- `frontend/data/publicados/resumo-publicacao.json`
- `scripts/validar-json-publicados.js`

Arquivos de memória/documentação relevantes:

- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`
- `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`
- `memoria/10_TESTES/checklist-validacao.md`

---

## 3. Situação atual dos dados de convênios

Atualmente, a origem principal dos dados de convênios está configurada em:

```text
backend/data/aplicacao.json
```

Campo:

```json
{
  "configuracao": {
    "arquivoPlanilhaConvenios": "Planilhas/gestao_financeira_ouvidoria.xlsx"
  }
}
```

A planilha atual contém:

- uma aba `Geral`;
- abas por UF;
- dados de itens dos instrumentos;
- dados de execução;
- recortes por área, como `OUVIDORIA`;
- valores previstos, executados, saldos e totais.

O serviço `backend/services/dashboard-publication-service.js` lê essa planilha, extrai os dados das abas por UF, consolida os dados de convênio, monta os dados PROFOR 2022 e gera as estruturas consumidas pelo dashboard e pela publicação estática.

### 3.1. Problema atual

A manutenção dos dados depende de edição manual da planilha única. Isso gera riscos:

- erro manual em células;
- dificuldade de rastrear origem de cada alteração;
- risco de quebra de fórmula;
- dependência de abas por UF;
- dificuldade de atualização por instrumento;
- dificuldade de automação futura via Transferegov;
- possibilidade de divergência entre aba `Geral` e abas estaduais;
- baixa rastreabilidade do arquivo-fonte de cada item.

### 3.2. Mudança desejada

A nova sistemática deverá permitir que a aplicação receba múltiplos arquivos Excel, um para cada convênio/instrumento.

Exemplo conceitual:

```text
Planilhas/profor-2022/instrumentos/
├── AC_937782_2022.xlsx
├── AL_937221_2022.xlsx
├── AM_937592_2022.xlsx
├── GO_937216_2022.xlsx
└── ...
```

Cada arquivo deverá ser lido, normalizado e incorporado ao plano de aplicação consolidado.

---

## 4. Objetivo técnico da alteração

Criar uma nova camada backend de importação e normalização dos planos de aplicação detalhados, capaz de:

1. ler múltiplos arquivos Excel;
2. identificar UF, número do convênio e ano;
3. mapear colunas com nomes diferentes;
4. normalizar os dados para o schema canônico já usado pela aplicação;
5. validar inconsistências;
6. gerar relatório de importação;
7. comparar a nova origem com a origem antiga;
8. alimentar o compositor PROFOR 2022;
9. preservar fallback para a planilha atual;
10. permitir futura substituição por extração automática do Transferegov.

A interface não deve ser alterada na primeira etapa, salvo necessidade pontual de exibir origem, diagnóstico ou alerta em etapa posterior.

---

## 5. Princípios obrigatórios para agentes de IA

### 5.1. Não quebrar o fluxo existente

Não remover a origem atual baseada em:

```text
Planilhas/gestao_financeira_ouvidoria.xlsx
```

A origem antiga deve permanecer como fallback até validação completa da nova origem.

### 5.2. Não fazer leitura direta pelo frontend

O frontend não deve ler os novos arquivos Excel diretamente.

O fluxo correto é:

```text
Excel bruto
↓
serviço backend de importação
↓
schema canônico
↓
compositor/cálculos
↓
JSON publicado
↓
frontend
```

### 5.3. Não editar manualmente JSON publicado

Os arquivos em:

```text
frontend/data/publicados/
```

são derivados. Não devem ser editados manualmente, salvo justificativa excepcional e registrada.

A publicação deve ocorrer por:

```bash
npm run publicar:dados
```

apenas quando houver alteração material de dados.

### 5.4. Não inventar campos, rotas ou tabelas

Antes de sugerir código, o agente deve verificar a estrutura real do repositório. Não presumir arquivos, funções, tabelas, endpoints ou colunas inexistentes.

### 5.5. Preferir mudanças pequenas e reversíveis

Cada etapa deve ser pequena, testável e compatível com rollback.

### 5.6. Manter rastreabilidade

Toda alteração relevante deve ser registrada no diário de bordo e, quando afetar arquitetura ou fluxo de dados, nos documentos de memória correspondentes.

---

## 6. Schema canônico dos itens do plano de aplicação

A nova importação deve produzir itens compatíveis com o formato já usado pela aplicação.

Campos canônicos esperados:

```js
{
  uf: "AC",
  instrumento: "Convênio",
  numero: "937782",
  ano: "2022",
  area: "OUVIDORIA",
  natureza: "CAPITAL",
  descricao: "Descrição do item",
  quantidade: 1,
  valorUnitario: 1000.00,
  valorPrevisto: 1000.00,
  valorExecutado: 0.00,
  saldo: 1000.00,
  saldoEconomicidade: 0.00,
  percentualExecucao: 0
}
```

### 6.1. Campos obrigatórios

- `uf`
- `numero`
- `ano`
- `descricao`
- `quantidade`
- `valorPrevisto`
- `valorExecutado`

### 6.2. Campos recomendados

- `instrumento`
- `area`
- `natureza`
- `valorUnitario`
- `saldo`
- `saldoEconomicidade`
- `percentualExecucao`

### 6.3. Campos calculáveis

Podem ser calculados pelo importador ou pelo compositor:

- `saldo = valorPrevisto - valorExecutado`
- `percentualExecucao = valorExecutado / valorPrevisto * 100`
- `saldoEconomicidade`, quando houver regra segura

Não inventar regra de economicidade quando ela não estiver clara.

---

## 7. Mapeamento de colunas

Os novos arquivos Excel podem ter cabeçalhos diferentes. O importador deve reconhecer variações e convertê-las para os campos canônicos.

Exemplo de equivalências:

| Campo canônico | Possíveis nomes na planilha |
| --- | --- |
| `descricao` | `Descrição`, `Item`, `Objeto`, `Descrição do Item`, `Especificação` |
| `quantidade` | `Qtd`, `Quantidade`, `Qtde` |
| `valorUnitario` | `Valor Unitário`, `Valor Unit.`, `Vl Unitário`, `Preço Unitário` |
| `valorPrevisto` | `Valor Total`, `Valor Previsto`, `Total Previsto`, `Valor Global do Item` |
| `valorExecutado` | `Valor Executado`, `Executado`, `Vl Executado`, `Pago`, `Liquidado` |
| `area` | `Área`, `Classificação`, `Setor`, `Unidade Beneficiária` |
| `natureza` | `Natureza`, `Capital/Custeio`, `Grupo de Despesa`, `Categoria Econômica` |
| `numero` | `Convênio`, `Nº Convênio`, `Número do Convênio`, `Instrumento` |
| `ano` | `Ano`, `Exercício` |
| `uf` | `UF`, `Estado`, `Unidade Federativa` |

O mapeamento deve ficar concentrado em serviço específico. Não espalhar regras de cabeçalho por múltiplos arquivos.

---

## 8. Identificação do convênio

A identificação do convênio pode vir de três fontes:

1. nome do arquivo;
2. conteúdo da planilha;
3. carteira monitorada no banco local.

### 8.1. Padrão recomendado de nome de arquivo

Adotar um padrão previsível, preferencialmente:

```text
UF_NUMERO_ANO.xlsx
```

Exemplo:

```text
AC_937782_2022.xlsx
```

ou:

```text
937782_2022_AC.xlsx
```

O padrão escolhido deve ser documentado e validado pelo script.

### 8.2. Regra de segurança

Se o nome do arquivo indicar um convênio e o conteúdo interno indicar outro, o importador deve bloquear a importação daquele arquivo ou registrar erro crítico.

Não aceitar divergência silenciosa.

---

## 9. Nova estrutura proposta de arquivos

### 9.1. Pasta de entrada

Sugestão inicial:

```text
Planilhas/profor-2022/instrumentos/
```

### 9.2. Serviço de importação

Sugestão de novo arquivo:

```text
backend/services/profor-2022/profor-plano-aplicacao-import-service.js
```

Responsabilidades:

- localizar arquivos Excel;
- ler workbooks;
- detectar layout;
- localizar cabeçalho;
- mapear colunas;
- normalizar valores;
- validar dados;
- gerar itens canônicos;
- gerar diagnóstico da importação.

### 9.3. Script de execução

Sugestão de novo arquivo:

```text
backend/scripts/importar-planos-aplicacao-profor-2022.js
```

Possíveis comandos no `package.json`:

```json
{
  "scripts": {
    "importar:planos-profor-2022": "node backend/scripts/importar-planos-aplicacao-profor-2022.js",
    "importar:planos-profor-2022:dry-run": "node backend/scripts/importar-planos-aplicacao-profor-2022.js --dry-run"
  }
}
```

### 9.4. Relatório de importação

Sugestão:

```text
backend/data/relatorios/importacao-planos-profor-2022.json
```

ou, se não for para versionar:

```text
Dados/relatorios/importacao-planos-profor-2022.json
```

Antes de definir o local, verificar `.gitignore` e a política do projeto para arquivos gerados.

---

## 10. Resolvedor de origem do plano de aplicação

Criar uma camada que escolha a origem do plano de aplicação.

Sugestão conceitual:

```js
resolverPlanoAplicacaoProfor2022(catalogoAplicacao, opcoes)
```

Origens possíveis:

```text
planilha-unica
arquivos-instrumentos
```

### 10.1. Flag de ambiente recomendada

```text
PROFOR_2022_ORIGEM_PLANO_APLICACAO=planilha-unica
```

ou:

```text
PROFOR_2022_ORIGEM_PLANO_APLICACAO=arquivos-instrumentos
```

O padrão deve permanecer:

```text
planilha-unica
```

A nova origem só deve ser ativada com flag explícita.

---

## 11. Fluxo futuro desejado

```text
Arquivos Excel individuais
↓
Serviço de importação
↓
Normalização para schema canônico
↓
Relatório de validação
↓
Comparador com origem antiga
↓
Resolvedor de origem
↓
Compositor PROFOR 2022
↓
Cálculos internos
↓
API local
↓
Publicação estática
↓
Frontend/GitHub Pages
```

---

## 12. Fases de implementação

## Fase 1 — Consolidar contrato de dados

### Objetivo

Formalizar o schema canônico dos itens do plano de aplicação.

### Arquivos prováveis

- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- novo documento específico, se necessário

### Entrega esperada

Documento curto com:

- campos obrigatórios;
- campos opcionais;
- campos calculados;
- regras de validação;
- exemplo de item normalizado.

### Critérios de aceite

- O schema é compatível com `profor-consolidado-service.js`.
- O schema é compatível com `profor-plano-aplicacao-service.js`.
- Nenhum código funcional é alterado nesta fase, salvo documentação.

---

## Fase 2 — Criar leitor isolado dos arquivos Excel

### Objetivo

Criar serviço backend capaz de ler múltiplos arquivos Excel sem integrar ainda com a aplicação.

### Arquivos prováveis

- `backend/services/profor-2022/profor-plano-aplicacao-import-service.js`
- `backend/scripts/importar-planos-aplicacao-profor-2022.js`
- `package.json`

### Entrega esperada

Script executável em modo dry-run:

```bash
npm run importar:planos-profor-2022:dry-run
```

### Critérios de aceite

- O script encontra arquivos `.xlsx`.
- O script ignora arquivos temporários, como `~$arquivo.xlsx`.
- O script lê os workbooks.
- O script não altera JSON publicado.
- O script não altera banco.
- O script exibe relatório básico no console.

---

## Fase 3 — Mapear e normalizar colunas

### Objetivo

Transformar os dados brutos dos Excel no schema canônico.

### Entrega esperada

Funções de normalização para:

- texto;
- UF;
- número do convênio;
- ano;
- valores monetários;
- quantidade;
- área;
- natureza;
- descrição.

### Critérios de aceite

- Cabeçalhos com variações comuns são reconhecidos.
- Valores em formato brasileiro são convertidos corretamente.
- Linhas vazias são ignoradas.
- Totais de rodapé não são tratados como item.
- Cabeçalhos repetidos no meio da planilha são ignorados.
- Itens inválidos são reportados, não importados silenciosamente.

---

## Fase 4 — Gerar relatório de validação

### Objetivo

Criar diagnóstico da importação antes de qualquer integração com a aplicação.

### Relatório mínimo

- arquivos lidos;
- arquivos com erro;
- arquivos ignorados;
- convênios identificados;
- UF identificada;
- quantidade de itens por convênio;
- total previsto por convênio;
- total executado por convênio;
- itens sem descrição;
- valores inválidos;
- divergência entre `quantidade * valorUnitario` e `valorPrevisto`;
- valor executado maior que valor previsto;
- duplicidade de convênio;
- divergência entre nome do arquivo e conteúdo interno.

### Critérios de aceite

- O relatório permite identificar o arquivo e a linha do problema.
- Erros críticos bloqueiam a importação.
- Alertas não críticos são listados separadamente.
- Nenhum dado é publicado nesta fase.

---

## Fase 5 — Comparar origem antiga e nova

### Objetivo

Comparar os dados extraídos da planilha única atual com os dados extraídos dos novos arquivos individuais.

### Comparações obrigatórias

Por convênio:

- total de itens;
- valor previsto total;
- valor executado total;
- previsto da área OUVIDORIA;
- executado da área OUVIDORIA;
- previsto CAPITAL;
- previsto CUSTEIO;
- executado CAPITAL;
- executado CUSTEIO;
- saldo;
- percentual de execução.

### Critérios de aceite

- Divergências são listadas por convênio.
- Divergências são classificadas como:
  - erro crítico;
  - divergência esperada;
  - alerta;
  - diferença de arredondamento.
- A nova origem não é ativada automaticamente.

---

## Fase 6 — Integrar com resolvedor de origem

### Objetivo

Permitir que o compositor PROFOR 2022 use a origem nova mediante flag.

### Arquivos prováveis

- `backend/services/dashboard-publication-service.js`
- `backend/services/profor-2022/profor-consolidado-service.js`
- novo resolvedor de origem do plano
- `.env.example`

### Critérios de aceite

- Origem padrão continua sendo a planilha única.
- Nova origem só funciona com flag explícita.
- Em caso de falha da nova origem, a aplicação consegue voltar para a origem antiga.
- A interface continua funcionando.

---

## Fase 7 — Testar em modo local/API

### Objetivo

Validar a aplicação localmente antes da publicação estática.

### Comandos mínimos

```bash
npm start
npm run validar:json
npm run validar:syntax
npm run validar:services
```

Quando afetar tela:

```bash
npm run validar:agente
```

### Testes manuais

- abrir Dashboard;
- abrir PROFOR 2022;
- abrir detalhe de convênio;
- conferir filtros por UF;
- conferir total previsto;
- conferir total executado;
- conferir percentuais;
- conferir cards de OUVIDORIA;
- conferir se GitHub Pages continua somente leitura;
- conferir console do navegador;
- conferir logs do backend.

---

## Fase 8 — Publicação estática controlada

### Objetivo

Gerar JSONs publicados apenas após validação local.

### Comando

```bash
npm run publicar:dados
```

### Validações após publicação

```bash
npm run validar:json
git diff -- frontend/data/publicados/
```

### Critérios de aceite

- `aplicacao.json` publicado continua válido.
- `dashboard-geral.json` publicado continua válido.
- `resumo-publicacao.json` reflete os totais esperados.
- Não há alteração indevida por simples churn de data, sem mudança material.

---

## Fase 9 — Ajuste visual opcional

### Objetivo

Somente se necessário, exibir na interface informações sobre a origem dos dados.

Possíveis exibições:

- origem do plano de aplicação;
- data da última importação;
- quantidade de arquivos importados;
- quantidade de alertas;
- aviso de fallback;
- link ou botão local para relatório de importação.

### Critérios de aceite

- Modo estático não permite edição.
- Interface não expõe caminhos locais sensíveis.
- Mensagens são claras e não poluem a tela principal.

---

## Fase 10 — Automação futura via Transferegov

### Objetivo

Criar, em etapa futura, rotina que gere automaticamente os mesmos dados hoje fornecidos pelos arquivos Excel individuais.

### Regra central

A automação Transferegov não deve criar um segundo modelo de dados.

O fluxo futuro deve ser:

```text
Transferegov
↓
extrator
↓
mesmo schema canônico
↓
mesmo compositor
↓
mesma publicação
↓
mesma interface
```

### Fora do escopo atual

- login em área restrita;
- uso de credenciais;
- bypass de captcha;
- uso de cookies fixos;
- automação em ambiente autenticado;
- scraping frágil sem validação.

---

## 13. Testes obrigatórios por tipo de alteração

### 13.1. Alteração em script de importação

Executar:

```bash
npm run importar:planos-profor-2022:dry-run
npm run validar:syntax
```

Conferir:

```bash
git diff --check
```

### 13.2. Alteração em serviço backend

Executar:

```bash
npm run validar:syntax
npm run validar:services
npm start
```

### 13.3. Alteração em publicação estática

Executar:

```bash
npm run publicar:dados
npm run validar:json
git diff -- frontend/data/publicados/
```

### 13.4. Alteração que afete interface

Executar:

```bash
npm run validar:agente
```

E testar manualmente:

- Dashboard;
- PROFOR 2022;
- detalhe de convênio;
- status do sistema;
- modo local/API;
- modo estático.

---

## 14. Riscos principais

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Quebra dos cálculos existentes | Alto | Preservar schema canônico atual |
| Divergência entre origem antiga e nova | Alto | Criar comparador antes de ativar |
| Arquivo Excel com layout inesperado | Alto | Detectar layout e bloquear erro crítico |
| Mistura de dados de convênios da mesma UF | Alto | Exigir número do convênio no filtro |
| Publicação estática incorreta | Alto | Validar JSONs e revisar diff |
| Edição manual indevida de JSON publicado | Médio | Usar apenas pipeline de publicação |
| Duplicidade de convênio | Médio | Validar número + ano + UF |
| Valores monetários mal convertidos | Alto | Testar formatos brasileiros e numéricos |
| Churn de `publicadoEm` sem mudança material | Baixo/Médio | Evitar publicação desnecessária |
| Automação futura gerar formato diferente | Alto | Reutilizar mesmo schema canônico |

---

## 15. Rollback

Durante toda a transição, manter a origem antiga como padrão.

Rollback lógico:

```text
PROFOR_2022_ORIGEM_PLANO_APLICACAO=planilha-unica
```

Rollback por Git:

```bash
git status --short
git log --oneline
git revert <hash_do_commit>
git push origin HEAD
```

Rollback operacional:

1. voltar flag para origem antiga;
2. restaurar planilha atual se necessário;
3. rodar publicação com origem antiga;
4. validar JSONs publicados;
5. testar Dashboard e PROFOR 2022.

---

## 16. Checklist antes de commit

Antes de qualquer commit relacionado a esta mudança:

```bash
git status --short
git diff --check
npm run validar:syntax
```

Se alterar JSONs publicados:

```bash
npm run validar:json
git diff -- frontend/data/publicados/
```

Se alterar backend:

```bash
npm run validar:services
```

Se alterar interface:

```bash
npm run validar:agente
```

Atualizar, quando aplicável:

- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`
- `memoria/10_TESTES/checklist-validacao.md`

Mensagem de commit sugerida:

```text
feat(profor-2022): adiciona importação controlada de planos de aplicação
```

ou, para etapa documental:

```text
docs(profor-2022): documenta planejamento da nova origem de planos
```

---

## 17. Prompt base para Codex/IA executar cada etapa

Use este modelo ao acionar Codex ou outra IA no VS Code.

```text
Tarefa:
Implementar a etapa [NOME DA ETAPA] do planejamento de automação do plano de aplicação dos convênios PROFOR 2022.

Contexto:
A aplicação FOMENTO-ONASP possui backend Node, frontend SPA, banco SQLite local e publicação estática em JSONs. A origem atual dos planos de aplicação dos convênios é a planilha única `Planilhas/gestao_financeira_ouvidoria.xlsx`, configurada em `backend/data/aplicacao.json`. A nova sistemática deverá permitir leitura de múltiplos arquivos Excel, um por instrumento, sem quebrar o fluxo atual.

Arquivos-alvo:
[Listar arquivos específicos da etapa.]

Restrições:
- Não remover a origem atual.
- Não editar manualmente `frontend/data/publicados/*.json`.
- Não alterar a interface se a etapa for apenas backend.
- Não criar dependências novas sem justificativa.
- Não inventar campos, rotas, tabelas ou arquivos.
- Manter fallback para a origem antiga.
- Preservar o schema canônico dos itens do plano de aplicação.

Entrega esperada:
[Descrever entrega concreta da etapa.]

Critérios de aceite:
[Listar critérios objetivos.]

Testes:
Executar:
- `git diff --check`
- `npm run validar:syntax`
- outros comandos aplicáveis à etapa.

Risco de regressão:
Avaliar impacto em Dashboard, PROFOR 2022, detalhe de convênio, publicação estática e modo GitHub Pages.

Rollback:
A alteração deve permitir retorno à origem antiga sem perda de dados.
```

---

## 18. Conclusão técnica

A alteração deve ser implementada como evolução do pipeline backend de dados, não como adaptação direta do frontend.

A estratégia correta é:

1. criar uma nova origem normalizada para os planos de aplicação;
2. preservar o contrato de dados consumido pelos cálculos atuais;
3. validar a nova origem contra a planilha atual;
4. ativar a nova origem por flag;
5. publicar somente após comparação e validação;
6. manter fallback para rollback;
7. preparar o caminho para automação futura via Transferegov usando o mesmo schema canônico.

Nenhuma IA ou agente deve iniciar a implementação criando tela, rota pública ou alteração visual ampla. A primeira etapa é consolidar o contrato de dados e criar o importador isolado em modo dry-run.
