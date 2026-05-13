# Regras do Projeto - FOMENTO-ONASP

## Finalidade

Este arquivo registra regras operacionais especificas do projeto FOMENTO-ONASP. Ele complementa o `AGENTS.md` e o `memoria/INDEX.md`, sem substitui-los.

Use este arquivo para orientar alteracoes tecnicas, revisoes, validacoes e tarefas com IA/Codex. Ele nao deve conter documentos brutos, dados sigilosos, credenciais, anexos ou regras de negocio inventadas.

## Arquitetura operacional

O projeto combina:

- backend local em Node, com ponto principal em `backend/server.js`;
- servicos de leitura, normalizacao, persistencia, historico, exportacao e publicacao em `backend/services/`;
- banco SQLite local em `backend/data/onasp.sqlite`, nao versionavel;
- frontend SPA com arquivo principal em `frontend/js/app.js` e estilos em `frontend/css/app.css`;
- JSONs publicos em `frontend/data/publicados/`, usados no modo estatico/GitHub Pages;
- planilhas e bases de origem em `Planilhas/`, usadas no fluxo local de dados.

Antes de alterar qualquer comportamento, confira a camada diretamente afetada e o impacto nas demais: frontend, backend, servicos, banco, publicacao estatica e memoria.

## Modos de execucao

### Modo local/API

- E o modo editavel do projeto.
- Usa backend local, rotas de API e banco SQLite.
- Pode executar importacoes, persistencias e publicacao de JSONs quando a tarefa exigir.
- Validacoes devem considerar console do navegador, logs do backend, resposta das APIs e integridade do banco quando houver impacto.

### Modo estatico/GitHub Pages

- E modo somente leitura.
- Usa os arquivos em `frontend/data/publicados/`.
- Nao deve depender de backend local, banco SQLite ou rotas de escrita.
- Controles que dependem do backend devem permanecer bloqueados ou identificados de forma compativel com o modo estatico, inclusive quando houver uso de `data-requer-backend="true"` e `static-mode.js`.
- Qualquer alteracao deve preservar a leitura dos JSONs publicados e evitar quebrar a publicacao estatica.

## Regras para frontend

- Preservar a arquitetura da SPA e os pontos de entrada existentes.
- Nao reescrever fluxos inteiros para resolver ajustes localizados.
- Nao renomear rotas, views, IDs, classes estruturais ou chaves internas sem buscar referencias.
- Manter diferenca entre nome visivel da pagina e identificador tecnico interno quando isso ja existir no projeto.
- Evitar mudancas cosmeticas fora do escopo da tarefa.
- Em paginas criticas, preferir seletores estaveis para teste, como `data-testid`, quando a tarefa permitir.
- Preservar responsividade, acessibilidade basica e leitura em modo estatico.

## Regras para backend

- Nao alterar `backend/server.js`, rotas ou endpoints sem necessidade clara e evidencia no codigo.
- Antes de remover rota, parametro, campo de payload ou resposta, buscar referencias no frontend, servicos e testes.
- Nao introduzir novo backend, framework ou camada paralela.
- Validar entradas, erros e respostas de API quando a tarefa tocar rotas ou persistencia.
- Preservar compatibilidade com os fluxos de importacao, salvamento e publicacao ja existentes.

## Regras para banco de dados

- `backend/data/onasp.sqlite` e demais arquivos SQLite locais nao devem ser versionados.
- Nao executar alteracoes destrutivas sem backup, criterio de validacao e rollback.
- Nao inventar tabelas, colunas, campos, chaves ou migrations.
- Quando uma tarefa depender do banco, validar com os scripts e rotas existentes antes de concluir.
- Evitar tocar em `backend/db/` se a tarefa for apenas documental, visual ou de publicacao estatica.

## Regras para servicos

- `backend/services/` concentra logicas de leitura, normalizacao, persistencia, historico, exportacao e publicacao.
- Antes de alterar um servico, identificar quem o chama: rotas, scripts, frontend, publicacao ou importadores.
- Nao remover funcao, campo, normalizacao ou compatibilidade sem verificar referencias.
- Mudancas em servicos que alimentam JSONs publicados devem considerar tambem o modo estatico.
- Evitar duplicar regra de negocio no frontend quando ela ja estiver consolidada em servico.

## Regras para dados e planilhas

- Planilhas e bases de origem devem ser tratadas como fontes, nao como texto livre.
- Nao inventar UFs, processos, valores, metricas, percentuais, datas ou situacoes.
- Qualquer metrica deve ser calculada a partir de fonte existente ou dado retornado pelo sistema.
- Nao versionar planilhas, PDFs, DOCX, logs, backups, anexos pesados ou documentos sensiveis na memoria.
- Se houver divergencia entre dado publicado e origem local, registrar a evidencia antes de corrigir.

## Regras para JSONs publicados

- `frontend/data/publicados/` e a base do modo estatico/GitHub Pages.
- Nao alterar JSON publicado manualmente sem justificativa explicita.
- Preferir gerar publicacao pelos comandos existentes quando a tarefa for de dados.
- Nao rodar `npm run publicar:dados` em tarefas documentais, cosmeticas, de teste ou de infraestrutura sem necessidade clara.
- Evitar churn de timestamp em `frontend/data/publicados/*.json`.
- Quando o hook de commit puder republicar dados indevidamente, usar `SKIP_PUBLICAR_DADOS=1` conforme o fluxo registrado do projeto.
- Toda mudanca em JSON publicado deve ser revisada para confirmar que nao alterou regra de negocio ou dado financeiro por acidente.

## Regras para seguranca e sigilo

- Nao versionar credenciais, tokens, `.env`, bancos SQLite, logs, backups, planilhas brutas ou anexos sensiveis.
- Nao copiar documentos SEI integrais, PDFs, DOCX, XLSX, imagens ou bases brutas para `memoria/`.
- A memoria deve conter apenas Markdown tratado, sintetico, operacional e nao sensivel.
- Em dados pessoais ou administrativos, aplicar minima exposicao e evitar exemplos com informacao real desnecessaria.
- Nao publicar no frontend informacao que dependa de sigilo, autenticacao ou contexto interno.

## Regras para alteracoes com IA/Codex

- Tratar modelos de IA como executores controlados.
- Ler `AGENTS.md`, `memoria/INDEX.md`, os arquivos de memoria indicados e os arquivos reais afetados antes de editar.
- Fazer patches pequenos, rastreaveis, testaveis e reversiveis.
- Nao criar dependencia nova sem justificar necessidade, alternativa nativa, impacto e risco de manutencao.
- Nao inventar arquitetura, endpoint, schema, arquivo, valor, fundamento normativo ou pendencia.
- Interromper e relatar quando o contexto for insuficiente para uma mudanca segura.

## Regras para testes e validacao

- Para tarefa documental, usar validacoes de diff e Markdown; nao rodar testes de aplicacao sem necessidade.
- Para JavaScript alterado, usar `node --check` quando aplicavel.
- Para dados publicados, usar `npm run validar:json` e conferir se nao houve churn indevido.
- Para validacao agentic, usar `npm run validar:syntax` e `npm run validar:agente` quando a tarefa tocar scripts ou testes.
- Para backend/API, validar com `npm start`, logs do backend e chamadas reais de API quando necessario.
- Para frontend, validar abertura da pagina, console do navegador, responsividade e fluxo principal afetado.
- Sempre revisar `git diff --check` antes de finalizar alteracoes versionaveis.

## Regras para Git, commit, PR e rollback

- Antes de commitar, conferir `git status`, `git diff --name-only`, `git diff --check` e arquivos staged.
- Adicionar ao commit apenas arquivos do escopo.
- Mensagens devem seguir `tipo(escopo): descricao curta`.
- Nao usar `git reset --hard`, force push ou limpeza destrutiva sem pedido explicito.
- Para commits que nao tratem de dados publicados, evitar republicacao automatica indevida com `SKIP_PUBLICAR_DADOS=1`, quando aplicavel.
- Todo fechamento deve permitir rollback claro, preferencialmente por reversao dos arquivos alterados ou `git revert <hash>` quando ja houver commit publicado.

## Regras para atualizacao da memoria

- Atualizar `memoria/00_DIARIO_DE_BORDO/diario-atual.md` quando a tarefa alterar comportamento, fluxo, validacao, arquitetura, publicacao ou decisao relevante.
- Atualizar `memoria/01_PROJETO_APLICACAO/pendencias.md` quando houver nova pendencia evidenciada ou conclusao de item registrado.
- Nao criar arquivo tematico novo sem solicitacao expressa.
- Diferenciar pendencia documental, risco tecnico, erro real e melhoria opcional.
- Nao registrar no diario dados sensiveis, anexos brutos ou conteudo institucional integral.

## Criterios de aceite antes de concluir tarefa

- O escopo alterado corresponde ao pedido do usuario.
- Nao houve alteracao indevida em backend, frontend, banco, planilhas ou JSONs publicados.
- O modo local/API e o modo estatico continuam preservados quando a tarefa puder afeta-los.
- Dados, metricas, UFs, valores, processos e fundamentos nao foram inventados.
- As validacoes apropriadas ao tipo de tarefa foram executadas ou a impossibilidade foi registrada.
- O diff esta limpo, restrito e sem erro de whitespace.
- A memoria e o diario foram atualizados quando necessario.
- Ha rollback objetivo para desfazer a alteracao.
