# Regras do Projeto - FOMENTO-ONASP

## Finalidade

Este arquivo registra regras operacionais específicas do projeto FOMENTO-ONASP. Ele complementa o `AGENTS.md` e o `memoria/INDEX.md`, sem substituí-los.

Use este arquivo para orientar alterações técnicas, revisões, validações e tarefas com IA/Codex. Ele não deve conter documentos brutos, dados sigilosos, credenciais, anexos ou regras de negócio inventadas.

## Arquitetura operacional

O projeto combina:

- backend local em Node, com ponto principal em `backend/server.js`;
- serviços de leitura, normalização, persistência, histórico, exportação e publicação em `backend/services/`;
- banco SQLite local em `backend/data/onasp.sqlite`, não versionável;
- frontend SPA com arquivo principal em `frontend/js/app.js` e estilos em `frontend/css/app.css`;
- JSONs públicos em `frontend/data/publicados/`, usados no modo estático/GitHub Pages;
- planilhas e bases de origem em `Planilhas/`, usadas no fluxo local de dados.

Antes de alterar qualquer comportamento, confira a camada diretamente afetada e o impacto nas demais: frontend, backend, serviços, banco, publicação estática e memória.

## Modos de execução

### Modo local/API

- É o modo editável do projeto.
- Usa backend local, rotas de API e banco SQLite.
- Pode executar importações, persistências e publicação de JSONs quando a tarefa exigir.
- Validações devem considerar console do navegador, logs do backend, resposta das APIs e integridade do banco quando houver impacto.

### Modo estático/GitHub Pages

- É modo somente leitura.
- Usa os arquivos em `frontend/data/publicados/`.
- Não deve depender de backend local, banco SQLite ou rotas de escrita.
- Controles que dependem do backend devem permanecer bloqueados ou identificados de forma compatível com o modo estático, inclusive quando houver uso de `data-requer-backend="true"` e `static-mode.js`.
- Qualquer alteração deve preservar a leitura dos JSONs publicados e evitar quebrar a publicação estática.

## Regras para frontend

- Preservar a arquitetura da SPA e os pontos de entrada existentes.
- Não reescrever fluxos inteiros para resolver ajustes localizados.
- Não renomear rotas, views, IDs, classes estruturais ou chaves internas sem buscar referências.
- Manter diferença entre nome visível da página e identificador técnico interno quando isso já existir no projeto.
- Evitar mudanças cosméticas fora do escopo da tarefa.
- Em páginas críticas, preferir seletores estáveis para teste, como `data-testid`, quando a tarefa permitir.
- Preservar responsividade, acessibilidade básica e leitura em modo estático.

## Regras para backend

- Não alterar `backend/server.js`, rotas ou endpoints sem necessidade clara e evidência no código.
- Antes de remover rota, parâmetro, campo de payload ou resposta, buscar referências no frontend, serviços e testes.
- Não introduzir novo backend, framework ou camada paralela.
- Validar entradas, erros e respostas de API quando a tarefa tocar rotas ou persistência.
- Preservar compatibilidade com os fluxos de importação, salvamento e publicação já existentes.

## Regras para banco de dados

- `backend/data/onasp.sqlite` e demais arquivos SQLite locais não devem ser versionados.
- Não executar alterações destrutivas sem backup, critério de validação e rollback.
- Não inventar tabelas, colunas, campos, chaves ou migrations.
- Quando uma tarefa depender do banco, validar com os scripts e rotas existentes antes de concluir.
- Evitar tocar em `backend/db/` se a tarefa for apenas documental, visual ou de publicação estática.

## Regras para serviços

- `backend/services/` concentra lógicas de leitura, normalização, persistência, histórico, exportação e publicação.
- Antes de alterar um serviço, identificar quem o chama: rotas, scripts, frontend, publicação ou importadores.
- Não remover função, campo, normalização ou compatibilidade sem verificar referências.
- Mudanças em serviços que alimentam JSONs publicados devem considerar também o modo estático.
- Evitar duplicar regra de negócio no frontend quando ela já estiver consolidada em serviço.

## Regras para dados e planilhas

- Planilhas e bases de origem devem ser tratadas como fontes, não como texto livre.
- Não inventar UFs, processos, valores, métricas, percentuais, datas ou situações.
- Qualquer métrica deve ser calculada a partir de fonte existente ou dado retornado pelo sistema.
- Não versionar planilhas, PDFs, DOCX, logs, backups, anexos pesados ou documentos sensíveis na memória.
- Se houver divergência entre dado publicado e origem local, registrar a evidência antes de corrigir.

## Regras para JSONs publicados

- `frontend/data/publicados/` é a base do modo estático/GitHub Pages.
- Não alterar JSON publicado manualmente sem justificativa explícita.
- Preferir gerar publicação pelos comandos existentes quando a tarefa for de dados.
- Não rodar `npm run publicar:dados` em tarefas documentais, cosméticas, de teste ou de infraestrutura sem necessidade clara.
- Evitar churn de timestamp em `frontend/data/publicados/*.json`.
- Quando o hook de commit puder republicar dados indevidamente, usar `SKIP_PUBLICAR_DADOS=1` conforme o fluxo registrado do projeto.
- Toda mudança em JSON publicado deve ser revisada para confirmar que não alterou regra de negócio ou dado financeiro por acidente.

## Regras para segurança e sigilo

- Não versionar credenciais, tokens, `.env`, bancos SQLite, logs, backups, planilhas brutas ou anexos sensíveis.
- Não copiar documentos SEI integrais, PDFs, DOCX, XLSX, imagens ou bases brutas para `memoria/`.
- A memória deve conter apenas Markdown tratado, sintético, operacional e não sensível.
- Em dados pessoais ou administrativos, aplicar mínima exposição e evitar exemplos com informação real desnecessária.
- Não publicar no frontend informação que dependa de sigilo, autenticação ou contexto interno.

## Regras para alterações com IA/Codex

- Tratar modelos de IA como executores controlados.
- Ler `AGENTS.md`, `memoria/INDEX.md`, os arquivos de memória indicados e os arquivos reais afetados antes de editar.
- Fazer patches pequenos, rastreáveis, testáveis e reversíveis.
- Não criar dependência nova sem justificar necessidade, alternativa nativa, impacto e risco de manutenção.
- Não inventar arquitetura, endpoint, schema, arquivo, valor, fundamento normativo ou pendência.
- Interromper e relatar quando o contexto for insuficiente para uma mudança segura.

## Regras para testes e validação

- Para tarefa documental, usar validações de diff e Markdown; não rodar testes de aplicação sem necessidade.
- Para JavaScript alterado, usar `node --check` quando aplicável.
- Para dados publicados, usar `npm run validar:json` e conferir se não houve churn indevido.
- Para validação agentic, usar `npm run validar:syntax` e `npm run validar:agente` quando a tarefa tocar scripts ou testes.
- Para backend/API, validar com `npm start`, logs do backend e chamadas reais de API quando necessário.
- Para frontend, validar abertura da página, console do navegador, responsividade e fluxo principal afetado.
- Sempre revisar `git diff --check` antes de finalizar alterações versionáveis.

## Regras para Git, commit, PR e rollback

- Antes de commitar, conferir `git status`, `git diff --name-only`, `git diff --check` e arquivos staged.
- Adicionar ao commit apenas arquivos do escopo.
- Mensagens devem seguir `tipo(escopo): descrição curta`.
- Não usar `git reset --hard`, force push ou limpeza destrutiva sem pedido explícito.
- Para commits que não tratem de dados publicados, evitar republicação automática indevida com `SKIP_PUBLICAR_DADOS=1`, quando aplicável.
- Todo fechamento deve permitir rollback claro, preferencialmente por reversão dos arquivos alterados ou `git revert <hash>` quando já houver commit publicado.

## Regras para atualização da memória

- Atualizar `memoria/00_DIARIO_DE_BORDO/diario-atual.md` quando a tarefa alterar comportamento, fluxo, validação, arquitetura, publicação ou decisão relevante.
- Atualizar `memoria/01_PROJETO_APLICACAO/pendencias.md` quando houver nova pendência evidenciada ou conclusão de item registrado.
- Não criar arquivo temático novo sem solicitação expressa.
- Diferenciar pendência documental, risco técnico, erro real e melhoria opcional.
- Não registrar no diário dados sensíveis, anexos brutos ou conteúdo institucional integral.

## Critérios de aceite antes de concluir tarefa

- O escopo alterado corresponde ao pedido do usuário.
- Não houve alteração indevida em backend, frontend, banco, planilhas ou JSONs publicados.
- O modo local/API e o modo estático continuam preservados quando a tarefa puder afetá-los.
- Dados, métricas, UFs, valores, processos e fundamentos não foram inventados.
- As validações apropriadas ao tipo de tarefa foram executadas ou a impossibilidade foi registrada.
- O diff está limpo, restrito e sem erro de whitespace.
- A memória e o diário foram atualizados quando necessário.
- Há rollback objetivo para desfazer a alteração.
