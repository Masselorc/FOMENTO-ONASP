# Entrada Rápida para Agentes — FOMENTO-ONASP

## 1. Finalidade deste arquivo

Este arquivo é a porta de entrada rápida para agentes de IA no FOMENTO-ONASP. Ele existe para reduzir leitura desnecessária, economizar tokens, diminuir erro de contexto e orientar o agente a abrir apenas o que for necessário para a tarefa.

## 2. Regra principal: não ler tudo

Não carregue toda a pasta `memoria/` por padrão. Leia este arquivo primeiro, classifique a tarefa e abra apenas os arquivos necessários.

## 3. Como classificar a tarefa antes de abrir arquivos

Antes de ler qualquer coisa além do mínimo, identifique a tarefa como uma destas classes:

- código geral
- funcionalidade ou tela
- banco/API/rotas/fluxo de dados
- publicação estática/JSONs publicados
- PROFOR/ONASP
- UFs e ouvidorias estaduais
- normativos/institucional
- tarefa documental simples
- Git/commit/sync/rollback

Se a tarefa não encaixar em uma classe, pare e peça o arquivo exato ou o contexto mínimo necessário.

## 4. Roteiro mínimo por tipo de tarefa

| Tipo de tarefa | Ler primeiro | Ler somente se necessário | Evitar |
| -------------- | ------------ | ------------------------- | ------ |
| Código geral | `AGENTS.md`; `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`; `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`; `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`; `memoria/08_ROTAS_BANCO_API/rotas.md`; `memoria/08_ROTAS_BANCO_API/schema-banco.md`; `memoria/09_ERROS_E_CORRECOES/historico-erros.md`; `memoria/10_TESTES/checklist-validacao.md` | Arquivos reais da área afetada no código | Fichamentos institucionais inteiros, consolidações não relacionadas e toda a pasta `memoria/` |
| Funcionalidade ou tela | `AGENTS.md`; `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`; `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`; `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`; `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`; `memoria/09_ERROS_E_CORRECOES/historico-erros.md`; `memoria/10_TESTES/checklist-validacao.md` | Futuramente o arquivo técnico da funcionalidade em `memoria/01_PROJETO_APLICACAO/funcionalidades/`, quando existir, e depois apenas os arquivos de código citados nele | Varredura ampla de backend, frontend e consolidações institucionais sem necessidade |
| Banco/API/rotas/fluxo de dados | `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`; `memoria/08_ROTAS_BANCO_API/rotas.md`; `memoria/08_ROTAS_BANCO_API/schema-banco.md`; `memoria/09_ERROS_E_CORRECOES/historico-erros.md` | Arquivo da funcionalidade relacionada, quando existir futuramente | Backend e frontend inteiros sem relação direta com a rota ou o schema |
| Publicação estática/JSONs publicados | `memoria/09_ERROS_E_CORRECOES/historico-erros.md`; `memoria/10_TESTES/checklist-validacao.md`; `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` | Futuro `memoria/01_PROJETO_APLICACAO/funcionalidades/publicacao-estatica.md`, quando existir | Alterar JSONs publicados sem escopo claro ou rodar publicação por hábito |
| PROFOR/ONASP | `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`; `memoria/03_NORMATIVOS/index-normativos.md`; `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`; `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md` | Código real apenas se a tarefa envolver implementação na aplicação | Backend/frontend sem relação com PROFOR |
| UFs e ouvidorias estaduais | `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`; `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`; `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, se envolver PROFOR | Fonte tratada específica da UF, quando houver necessidade documental real | Presumir situação real sem evidência documental |
| Normativos/institucional | `memoria/03_NORMATIVOS/index-normativos.md`; `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, quando a tarefa envolver competência da ONASP | Extrato normativo específico somente se necessário | Abrir toda a base institucional por padrão |
| Tarefa documental simples | `AGENTS.md`; `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`; `memoria/INDEX.md`; arquivo-alvo | Arquivos adjacentes de contexto imediato | Fichamentos, consolidações e código não relacionados |
| Git/commit/sync/rollback | `AGENTS.md`; `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`; `memoria/10_TESTES/checklist-validacao.md` | Arquivos do escopo alterado e o diff real | Reset destrutivo, clean, restaurações amplas e sync sem verificar estado |

## 5. Tarefas de código geral

Leia o mínimo suficiente para entender a área afetada e o risco da alteração.

- `AGENTS.md`
- `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`
- `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`
- `memoria/09_ERROS_E_CORRECOES/historico-erros.md`
- `memoria/10_TESTES/checklist-validacao.md`

Não leia documentos institucionais, Pena Justa, PROFOR ou UFs em tarefas de código geral, salvo se a funcionalidade depender diretamente desses temas.

## 6. Tarefas de funcionalidade ou tela

Leia primeiro esta entrada rápida. Futuramente, leia o arquivo técnico da funcionalidade em `memoria/01_PROJETO_APLICACAO/funcionalidades/`, quando existir. Depois, abra apenas os arquivos de código citados nesse MD.

Se o MD da funcionalidade ainda não existir, use:

- `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`
- `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`
- `memoria/09_ERROS_E_CORRECOES/historico-erros.md`
- `memoria/10_TESTES/checklist-validacao.md`

A pasta `memoria/01_PROJETO_APLICACAO/funcionalidades/` será criada em etapa posterior.

## 7. Tarefas de banco, API, rotas ou fluxo de dados

Leia em primeira linha:

- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`

Se existir, leia também o arquivo da funcionalidade relacionada. Não abra backend ou frontend inteiro sem necessidade direta.

## 8. Tarefas sobre publicação estática e JSONs publicados

Leia primeiro:

- `memoria/09_ERROS_E_CORRECOES/historico-erros.md`
- `memoria/10_TESTES/checklist-validacao.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`

Se existir futuramente, use `memoria/01_PROJETO_APLICACAO/funcionalidades/publicacao-estatica.md`.

Cuidados obrigatórios:

- distinguir alteração material de dado e churn de metadado
- não rodar publicação estática sem necessidade
- não alterar JSONs publicados sem escopo claro
- usar `SKIP_PUBLICAR_DADOS=1` quando necessário em commits documentais

## 9. Tarefas sobre PROFOR/ONASP

Leia primeiro:

- `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`
- `memoria/03_NORMATIVOS/index-normativos.md`
- `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`
- `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`

Evite backend e frontend, salvo quando a tarefa envolver implementação na aplicação.

## 10. Tarefas sobre UFs e ouvidorias estaduais

Leia primeiro:

- `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`
- `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`
- `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, se envolver PROFOR

Cuidados:

- não presumir situação real de UF sem evidência documental
- não tratar existência formal como funcionamento efetivo
- não inventar ato normativo, canal, equipe, execução ou status

## 11. Tarefas normativas ou institucionais

Leia primeiro:

- `memoria/03_NORMATIVOS/index-normativos.md`
- extrato normativo específico, somente se necessário
- `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, quando a tarefa envolver competência da ONASP

Não leia toda a base institucional por padrão.

## 12. Tarefas documentais simples

Leia apenas:

- `AGENTS.md`
- `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`
- `memoria/INDEX.md`
- arquivo-alvo

Não abra fichamentos ou consolidações sem necessidade.

## 13. Tarefas de Git, commit, sync e rollback

Antes de agir, confira o estado real:

- `git status --short`
- `git branch --show-current`, quando necessário
- `git diff --name-only`, quando necessário
- `git diff --check`, antes de concluir

Regras:

- não usar `git reset --hard`
- não usar `git clean`
- não usar comandos destrutivos
- separar alterações documentais, de código, de dados e de JSONs publicados
- prever rollback antes e depois do commit
- commitar somente quando houver alteração efetiva
- fazer push ou sync apenas quando explicitamente solicitado

## 14. Arquivos que não devem ser lidos por padrão

Não leia por padrão:

- arquivos em `fontes-tratadas/`
- diário de bordo inteiro, salvo necessidade
- documentos institucionais longos
- backend inteiro quando a tarefa for institucional
- frontend inteiro quando a tarefa for institucional
- Pena Justa e PROFOR quando a tarefa for só código
- código quando a tarefa for só minuta ou documento

## 15. Quando abrir fichamentos técnicos

Abra fichamentos técnicos quando precisar de:

- conferência
- aprofundamento
- citação formal
- verificação de divergência entre consolidado e fonte
- criação de novo consolidado
- revisão de fundamentação

## 16. Quando atualizar o diário de bordo

Atualize o diário quando houver:

- alteração em memória
- alteração de código
- alteração em banco ou schema
- alteração em publicação estática
- alteração de dados
- decisão técnica relevante
- commit relevante

## 17. Quando fazer commit e push

Faça commit somente quando houver alteração efetiva. Não commite se for apenas diagnóstico. Sempre valide o diff antes. Use commit pequeno e objetivo. Preveja rollback.

## 18. Política de economia de tokens

- ler o mínimo suficiente
- preferir consolidados a fichamentos
- preferir o MD da funcionalidade a varrer o código inteiro, quando essa camada existir
- não duplicar leitura de arquivos
- interromper se faltar contexto
- pedir o arquivo exato quando necessário
- não inventar estrutura

## 19. Checklist antes de agir

- identificar o tipo de tarefa
- listar os arquivos necessários
- confirmar o escopo permitido
- confirmar os arquivos proibidos
- conferir `git status --short`
- alterar apenas o necessário
- validar o diff
- atualizar o diário quando aplicável
- commitar e sincronizar somente se houver alteração efetiva
