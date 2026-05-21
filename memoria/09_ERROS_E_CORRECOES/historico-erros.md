# Erros, Correções e Boas Práticas — FOMENTO-ONASP

## Finalidade

Este arquivo registra erros reais, correções aplicadas, riscos recorrentes, boas práticas e lições reutilizáveis do projeto FOMENTO-ONASP.

Ele deve apoiar manutenção, revisão técnica, uso de Codex/IA, prevenção de regressões e reaproveitamento de padrões em futuras aplicações institucionais.

Este arquivo não substitui o diário de bordo, as decisões técnicas, o fluxo de dados, as rotas ou o schema do banco. Ele consolida aprendizados operacionais derivados de evidências já registradas no repositório, no diário, nas memórias técnicas ou no código.

## Como usar este arquivo

- Consultar antes de iniciar correção de bug, tarefa de dados, publicação estática, alteração de banco, criação de teste ou mudança em fluxo local/API.
- Usar a classificação do registro para não tratar risco preventivo como erro real.
- Validar a evidência indicada antes de aplicar uma correção semelhante em outro contexto.
- Reaproveitar boas práticas apenas quando o projeto de destino tiver problema, arquitetura ou risco equivalente.
- Atualizar o registro quando a causa, correção, validação ou rollback mudarem no projeto.
- Não registrar informações sensíveis, dados brutos, bancos, planilhas ou documentos institucionais integrais.

## Convenções de classificação

- `erro real`: falha observada, reproduzida ou evidenciada em código, diff, comportamento, log, validação ou diário.
- `correção aplicada`: solução já implementada e validada.
- `risco provável`: situação com potencial de falha, mas sem erro observado no momento.
- `boa prática`: padrão recomendado a partir da experiência do projeto.
- `prevenção`: regra para evitar recorrência.
- `lição exportável`: aprendizado aplicável a outras aplicações.
- `não aplicável`: item que não deve ser tratado como erro ou prática reutilizável.

Critério operacional: se não houver evidência concreta, registrar como risco, prevenção ou lacuna. Não registrar como erro real.

## Modelo de registro

```markdown
## [ID] Título curto

**Classificação:** erro real | correção aplicada | risco provável | boa prática | prevenção | lição exportável

**Contexto:** onde ocorreu ou se aplica.

**Problema:** descrição objetiva.

**Evidência:** arquivo, comportamento, diff, validação, diário ou commit.

**Causa provável:** razão técnica ou operacional.

**Correção aplicada:** o que resolveu, quando houver.

**Por que funcionou:** explicação prática.

**Como prevenir:** regra para evitar recorrência.

**Boa prática reutilizável:** orientação exportável para outros projetos.

**Aplicável a futuras aplicações:** sim | não | com adaptação.

**Arquivos relacionados:** caminhos relevantes.

**Validações recomendadas:** comandos ou testes.

**Rollback:** como desfazer se necessário.
```

## Erros reais já encontrados

### ER-001 — Churn de `publicadoEm` em JSONs publicados sem ganho funcional

**Classificação:** erro real

**Contexto:** validação agentic e consolidação de commits com arquivos em `frontend/data/publicados/`.

**Problema:** JSONs publicados foram alterados apenas em metadado `publicadoEm`, sem alteração material de dados.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, entrada "Consolidação da validação agentic", registra que o commit local `38213dc` alterou apenas `publicadoEm` em `aplicacao.json`, `dashboard-geral.json` e `resumo-publicacao.json`, gerando churn de timestamp sem ganho funcional.

**Causa provável:** publicação automática ou execução de publicação em momento em que não havia mudança material nas fontes de dados.

**Correção aplicada:** restauração dos valores anteriores de `publicadoEm` e reforço da validação mínima de estrutura em `scripts/validar-json-publicados.js`.

**Por que funcionou:** removeu o diff semântico desnecessário e manteve a validação dos JSONs publicados esperados.

**Como prevenir:** conferir `git diff -- frontend/data/publicados/` antes do commit e diferenciar alteração material de dado versus metadado.

**Boa prática reutilizável:** tratar arquivos publicados como artefatos derivados e exigir justificativa para qualquer diff.

**Aplicável a futuras aplicações:** sim, quando houver build, publicação estática ou arquivos derivados versionados.

**Arquivos relacionados:** `frontend/data/publicados/*.json`, `scripts/validar-json-publicados.js`, `scripts/configurar-git-hooks.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

**Validações recomendadas:** `git status --short`, `git diff -- frontend/data/publicados/`, `npm run validar:json`, `git diff --check`.

**Rollback:** restaurar os JSONs publicados ao HEAD antes do commit; após commit publicado, usar `git revert <hash_do_commit>`.

### ER-002 — Hook de pre-commit reintroduziu publicação automática indevida

**Classificação:** erro real

**Contexto:** hook local de publicação estática.

**Problema:** o hook local de pre-commit acionou `npm run publicar:dados` ao tentar consolidar correção documental/de validação, reintroduzindo `publicadoEm` novo em JSONs publicados.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, entrada "Hook de publicacao", registra o fato observado e a correção aplicada.

**Causa provável:** hook ainda não diferenciava adequadamente commits de dados de commits documentais, testes, infraestrutura ou validação.

**Correção aplicada:** uso de `SKIP_PUBLICAR_DADOS=1` no commit seguinte e saneamento posterior do hook para ignorar documentação, memória, testes e scripts de validação.

**Por que funcionou:** impediu republish automático quando o commit não alterava fonte real de dados publicados.

**Como prevenir:** usar `SKIP_PUBLICAR_DADOS=1` quando a intenção for bloquear publicação e conferir os arquivos staged antes de commitar.

**Boa prática reutilizável:** hooks que geram artefatos devem ter allowlist/ignorelist clara e mensagem objetiva.

**Aplicável a futuras aplicações:** sim, com adaptação ao mecanismo de build/publicação.

**Arquivos relacionados:** `scripts/configurar-git-hooks.js`, `frontend/data/publicados/*.json`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

**Validações recomendadas:** `git diff --cached --name-only`, `git diff --cached --check`, `git status --short`.

**Rollback:** restaurar artefatos publicados antes do commit; após commit publicado, usar `git revert <hash_do_commit>`.

### ER-003 — Rastreio do Orçamento 2026 não era editável no modo local/API

**Classificação:** erro real

**Contexto:** tela Orçamento 2026, campos de andamento processual.

**Problema:** a tela não expunha edição dos andamentos processuais no fluxo local/API, impedindo preenchimento de campos como `termo_referencia`.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, entrada "Orçamento 2026", registra o problema, causa, arquivos alterados e testes com `POST /api/orcamento-2026/salvar`.

**Causa provável:** whitelist de campos editáveis no backend bloqueava campos de rastreio e o frontend não renderizava a seção de andamentos para edição.

**Correção aplicada:** ajuste no serviço do Orçamento 2026 e no frontend para expor a edição de rastreio no modo local/API, preservando bloqueio no modo estático.

**Por que funcionou:** a correção alinhou payload, whitelist do backend e UI de edição.

**Como prevenir:** ao adicionar campo editável, validar frontend, payload, serviço, whitelist, publicação e modo estático.

**Boa prática reutilizável:** não resolver campo "sumido" apenas no frontend; verificar allowlist, serviço e persistência.

**Aplicável a futuras aplicações:** sim, especialmente em telas com campos controlados por whitelist.

**Arquivos relacionados:** `backend/services/orcamento-2026-service.js`, `frontend/js/app.js`, `frontend/css/app.css`, `frontend/data/publicados/orcamento-2026.json`.

**Validações recomendadas:** `npm run init-db` quando houver schema, `npm start`, chamada real ao endpoint de salvamento, `npm run validar:json`, `npm run validar:syntax`, `git diff --check`.

**Rollback:** reverter o commit da alteração e restaurar eventual dado de teste criado no ambiente local.

### ER-004 — Processo vinculado apareceu fora do pai no Orçamento 2026

**Classificação:** erro real

**Contexto:** renderização hierárquica de processos vinculados na tela Orçamento 2026.

**Problema:** processo vinculado criado no fluxo de divisão aparecia solto em "Outros processos" em vez de aparecer junto ao processo pai.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, entrada "Etapa 5 Orçamento 2026 — renderização de processos vinculados junto ao pai".

**Causa provável:** a renderização de "Outros processos" não filtrava `tipoProcesso === 'VINCULADO'`.

**Correção aplicada:** filhos vinculados passaram a ser excluídos de "Outros processos" e renderizados como linhas aninhadas abaixo do pai.

**Por que funcionou:** a visualização passou a respeitar a relação operacional `processoPaiId`/`tipoProcesso`.

**Como prevenir:** quando houver hierarquia, testar listagem principal, listagem secundária e estado vazio para evitar duplicidade visual.

**Boa prática reutilizável:** itens derivados ou filhos devem ter regra explícita de inclusão e exclusão por área de renderização.

**Aplicável a futuras aplicações:** sim, com adaptação para telas hierárquicas.

**Arquivos relacionados:** `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

**Validações recomendadas:** smoke test visual da view, teste de criação/remoção controlada de filho, `npm run validar:agente`, `git diff --check`.

**Rollback:** reverter commit da renderização hierárquica e remover dado local de teste, se existir.

### ER-005 — Trâmite de processo vinculado não abria após re-render

**Classificação:** erro real

**Contexto:** estado de expansão do rastreio em processos vinculados do Orçamento 2026.

**Problema:** clicar no botão de trâmite de um filho vinculado não abria o painel porque o ID do filho era removido do estado de abertos a cada re-render.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, entrada "Correções pós-Etapa 5.1", commit `0d7b267`.

**Causa provável:** o filtro de IDs válidos considerava apenas `budgetData.itens`, enquanto filhos vinculados estavam em `outrosProcessos`.

**Correção aplicada:** inclusão dos IDs de filhos vinculados no conjunto de IDs preservados para rastreio aberto.

**Por que funcionou:** o estado visual deixou de descartar itens que pertencem operacionalmente à tabela principal, embora venham de outra coleção.

**Como prevenir:** quando uma tela combina múltiplas coleções, validar estados interativos em todos os tipos de item renderizado.

**Boa prática reutilizável:** estado de UI deve usar a coleção efetivamente renderizada, não apenas a coleção original de dados.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

**Validações recomendadas:** teste manual de abrir/fechar filhos, navegação após re-render, `npm run validar:syntax`, `npm run validar:agente`.

**Rollback:** reverter o commit específico ou a alteração em `frontend/js/app.js`.

### ER-006 — Botão duplicado no cabeçalho do andamento processual

**Classificação:** erro real

**Contexto:** tela Orçamento 2026, painel de rastreio/andamento processual.

**Problema:** a tela exibia botão de edição duplicado no cabeçalho do andamento processual, além do botão principal da linha.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, entrada "Botao duplicado do Orçamento 2026".

**Causa provável:** a renderização do cabeçalho do rastreio incluiu ação redundante que já existia na linha principal.

**Correção aplicada:** remoção do botão duplicado no cabeçalho, preservando o botão principal da linha.

**Por que funcionou:** reduziu ambiguidade da UI sem alterar o fluxo de edição.

**Como prevenir:** revisar ações duplicadas quando componentes de detalhe e linha principal compartilham controles.

**Boa prática reutilizável:** em tabelas com linha expansível, concentrar ação principal na linha e evitar controles redundantes no detalhe.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

**Validações recomendadas:** inspeção visual, contagem de botões no DOM, `npm run validar:syntax`, `git diff --check`.

**Rollback:** reverter o commit que removeu o botão duplicado.

## Correções aplicadas

### CA-001 — Saneamento do hook de publicação

**Classificação:** correção aplicada

**Contexto:** pre-commit local e publicação estática.

**Problema:** commits que não tratavam de dados podiam acionar publicação automática.

**Evidência:** `scripts/configurar-git-hooks.js` contém verificação de `SKIP_PUBLICAR_DADOS=1`, inspeção dos arquivos staged, ignorância para documentação/memória/testes/scripts de validação e execução de `npm run publicar:dados` apenas quando detecta fonte de dados publicada.

**Causa provável:** regra inicial do hook era ampla demais para o fluxo documental e de validação.

**Correção aplicada:** hook saneado com escape explícito e filtro de escopo.

**Por que funcionou:** commits documentais passam a informar "Nenhuma fonte de dados publicada foi alterada" e não reescrevem JSONs publicados.

**Como prevenir:** revisar o hook quando novos tipos de arquivo de dados forem adicionados ao projeto.

**Boa prática reutilizável:** hooks geradores devem operar por detecção de fonte, não por hábito.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `scripts/configurar-git-hooks.js`, `package.json`.

**Validações recomendadas:** `git diff --cached --name-only`, commit de documentação com conferência de que `frontend/data/publicados/*.json` não entrou no staged.

**Rollback:** reverter a alteração do hook e usar `SKIP_PUBLICAR_DADOS=1` enquanto a regra for corrigida.

### CA-002 — Teste E2E do Orçamento 2026 sem escrita real

**Classificação:** correção aplicada

**Contexto:** cobertura de regressão do Orçamento 2026.

**Problema:** fluxos de modal de divisão e alocação precisavam de cobertura sem persistir dados reais.

**Evidência:** `tests/e2e/app.spec.js` contém teste "orcamento 2026 expõe ações de divisão e alocação sem erro crítico" e bloqueia `POST /api/orcamento-2026/processos-vinculados/criar`, `POST /api/orcamento-2026/saldos/alocar` e `POST /api/orcamento-2026/salvar`.

**Causa provável:** fluxos editáveis em E2E podem persistir dados se o teste clicar em confirmação válida.

**Correção aplicada:** teste abre a view, valida tabela/colunas, abre e fecha modais quando existem botões e falha se rota de escrita for chamada.

**Por que funcionou:** cobre regressão de UI sem acionar persistência no backend.

**Como prevenir:** todo E2E de fluxo editável deve bloquear rotas POST perigosas ou usar ambiente descartável.

**Boa prática reutilizável:** "abrir modal sem salvar" é cobertura aceitável para regressão visual quando persistência real não é objetivo do teste.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `tests/e2e/app.spec.js`, `playwright.config.js`.

**Validações recomendadas:** `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `npm run validar:agente`.

**Rollback:** reverter o teste específico, sem tocar no backend ou nos dados.

### CA-003 — Separação documental entre fluxo, rotas e schema

**Classificação:** correção aplicada

**Contexto:** memória técnica do item 8.

**Problema:** risco de misturar fluxo de dados, endpoints e schema do banco em uma documentação única e difícil de manter.

**Evidência:** `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md` e `memoria/08_ROTAS_BANCO_API/schema-banco.md` estão preenchidos com escopos distintos.

**Causa provável:** sem separação, agentes podem inventar ou confundir rota, tabela e fonte de dados.

**Correção aplicada:** cada arquivo passou a documentar uma camada: fluxo, rotas e schema.

**Por que funcionou:** reduz ambiguidade e força consulta ao arquivo certo por tipo de tarefa.

**Como prevenir:** atualizar o documento correspondente sempre que houver mudança real em rota, schema ou fluxo de dados.

**Boa prática reutilizável:** separar memória por camada técnica quando o projeto combina API, banco, frontend e publicação estática.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`.

**Validações recomendadas:** `git diff --check` e revisão cruzada com arquivos reais citados.

**Rollback:** reverter commit documental correspondente.

### CA-004 — `item_ausente_no_pad` exibindo descrição em campo de estado e pendências de diacrítico na lista operacional

**Classificação:** correção aplicada

**Contexto:** tela `SISTEMA > Revisão de divergências PAD x memória`, PROFOR 2022.

**Problema:** divergências `item_ausente_no_pad` podiam exibir descrição textual no campo "Valor anterior/novo" (que deve ser apenas marcador de estado), e itens cuja diferença é exclusivamente de acentuação/diacrítico apareciam como pendência operacional, podendo induzir o usuário a "Confirmar ausência" de item que existe no PAD.

**Evidência:** `backend/services/profor-2022/profor-pad-revisao-service.js` (`divergenciasAusentes()` com `valorAnterior: "presente_na_memoria"` e payload financeiro); `frontend/js/app.js` (bloco `categoria === 'ausencia'` e `renderComparacaoRevisao`); relatório `backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.md`.

**Causa provável:** o campo `valorAnterior` foi reutilizado para texto descritivo; a lista não distinguia pendência operacional real de histórico/saneado.

**Correção aplicada:** payload de `item_ausente_no_pad` passou a usar marcadores de estado e campos financeiros próprios (`valorUnitarioMemoria` etc., `null` quando ausentes); a UI exibe "Estado anterior/novo" e valores financeiros; a lista operacional oculta históricos/saneados por padrão, com checkbox de auditoria. Criados a auditoria dry-run `profor:pad:diacritico:auditar-pendencias` e o saneamento auditável `profor:pad:diacritico:sanear-pendencias` (decisão via `registrarDecisao`, sem SQL direto).

**Por que funcionou:** separa marcador de estado de descrição; o saneamento sistêmico só atua sobre casos comprovadamente diacríticos, preservando histórico e rastreabilidade.

**Como prevenir:** nunca reutilizar campo de estado/marcador para texto livre; toda divergência de existência deve carregar valores materiais em campos próprios.

**Boa prática reutilizável:** classificar pendências por auditoria dry-run antes de qualquer saneamento, e registrar decisão somente pelo serviço de decisão existente.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `backend/services/profor-2022/profor-pad-revisao-service.js`, `backend/services/profor-2022/profor-pad-diacritico-auditoria-service.js`, `backend/scripts/auditar-pendencias-diacritico-pad-profor-2022.js`, `backend/scripts/sanear-pendencias-diacritico-pad-profor-2022.js`, `frontend/js/app.js`.

**Validações recomendadas:** `npm run validar:services`, `npm run profor:pad:diacritico:auditar-pendencias`, suíte E2E e `validar-decisao-estruturada-ponta-a-ponta.js`.

**Rollback:** reverter o commit `fix(profor-2022): saneia pendencias residuais de diacritico`. Como o saneamento usa o serviço de decisão sem SQL direto e o banco não é versionado, não há rollback de schema.

## Riscos recorrentes

### RR-001 — Workspace sujo antes de iniciar nova tarefa

**Classificação:** risco provável

**Contexto:** tarefas incrementais com escopo controlado.

**Problema:** iniciar patch com alterações pendentes pode misturar escopos, commitar artefatos indevidos ou mascarar churn de publicação.

**Evidência:** `AGENTS.md`, `regras-do-projeto.md`, `schema-banco.md` e o fluxo operacional recente exigem conferência de `git status` e separação entre código, dados publicados e memória.

**Causa provável:** tarefas sequenciais podem deixar JSONs publicados, banco local, dados de teste ou documentação em estado modificado.

**Correção aplicada:** não se aplica como correção única; é regra preventiva.

**Por que funcionou:** não aplicável.

**Como prevenir:** executar `git fetch origin`, `git status` ou `git status --short` antes de editar; se aparecer arquivo fora do escopo, parar e diagnosticar.

**Boa prática reutilizável:** nunca iniciar patch controlado em cima de worktree sujo sem decisão explícita.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `AGENTS.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`.

**Validações recomendadas:** `git status --short`, `git diff --name-only`.

**Rollback:** restaurar apenas arquivos indevidos com comando específico e não destrutivo, ou parar e solicitar decisão quando houver conflito.

### RR-002 — Versionamento indevido do SQLite local

**Classificação:** risco provável

**Contexto:** banco local `backend/data/onasp.sqlite`.

**Problema:** versionar SQLite, WAL, SHM ou backups pode expor dados, gerar conflitos binários e confundir o estado real da aplicação.

**Evidência:** `.gitignore` ignora `backend/data/onasp.sqlite`, `backend/data/onasp.sqlite-*`, `backend/data/backups/`, `*.sqlite`, `*.sqlite3`, `*.db`, `*.sqlite-shm` e `*.sqlite-wal`; `schema-banco.md` documenta o schema em Markdown sem abrir ou copiar o banco.

**Causa provável:** operações de banco e testes locais geram artefatos que não pertencem ao repositório.

**Correção aplicada:** regra de ignore e documentação do schema em Markdown.

**Por que funcionou:** mantém o banco como artefato local e versiona apenas conhecimento técnico tratado.

**Como prevenir:** conferir `git status --short` antes do commit e nunca copiar banco para `memoria/`.

**Boa prática reutilizável:** versionar schema e migrations, não arquivo de banco local.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `.gitignore`, `backend/db/database.js`, `backend/db/init-db.js`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`.

**Validações recomendadas:** `git status --short`, `git check-ignore -v backend/data/onasp.sqlite`.

**Rollback:** remover do staged com `git restore --staged <arquivo>` e apagar/restaurar apenas se o arquivo for artefato local não versionável.

### RR-003 — Misturar modo local/API com modo estático/GitHub Pages

**Classificação:** risco provável

**Contexto:** SPA híbrida com backend local editável e publicação estática somente leitura.

**Problema:** presumir API local no GitHub Pages ou expor ação de escrita no modo estático pode quebrar a experiência publicada.

**Evidência:** `AGENTS.md`, `regras-do-projeto.md`, `arquitetura-atual.md`, `fluxo-dados.md`, `rotas.md`, `backend/services/data-service.js` e `frontend/js/core/static-mode.js`.

**Causa provável:** o mesmo frontend roda em dois modos com fontes de dados e permissões diferentes.

**Correção aplicada:** controles dependentes de backend usam `data-requer-backend="true"` e `static-mode.js` desabilita esses controles; `data-service.js` usa fallback para JSONs publicados.

**Por que funcionou:** a UI continua navegável e somente leitura quando não há backend.

**Como prevenir:** ao criar botão, modal, exportação ou salvamento, validar local/API e estático separadamente.

**Boa prática reutilizável:** todo controle editável deve declarar dependência de backend quando houver modo publicado sem API.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `frontend/js/core/static-mode.js`, `backend/services/data-service.js`, `frontend/data/publicados/*.json`.

**Validações recomendadas:** smoke test local, inspeção de `data-requer-backend="true"`, validação de JSONs publicados.

**Rollback:** reverter a alteração de UI/serviço que misturou os modos.

### RR-004 — Documentar rota, tabela ou coluna sem confirmar no código

**Classificação:** risco provável

**Contexto:** memória de rotas, fluxo de dados e schema.

**Problema:** IA ou mantenedor pode registrar endpoint, payload, tabela, coluna ou relação que não existe.

**Evidência:** `AGENTS.md`, `INDEX.md`, `rotas.md` e `schema-banco.md` reforçam que arquivos reais prevalecem sobre memória.

**Causa provável:** documentação preenchida por inferência, sem leitura de `backend/server.js`, `backend/db/init-db.js` ou serviços.

**Correção aplicada:** documentos do item 8 foram preenchidos com linguagem cautelosa e lacunas marcadas como "não confirmado".

**Por que funcionou:** reduz risco de agentes seguirem informação falsa.

**Como prevenir:** documentar apenas o que estiver confirmado e remeter detalhes incertos ao arquivo correto.

**Boa prática reutilizável:** memória técnica deve declarar sua fonte e suas lacunas.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `backend/server.js`, `backend/db/init-db.js`, `memoria/08_ROTAS_BANCO_API/*.md`.

**Validações recomendadas:** busca no código com `rg`, revisão de diff e `git diff --check`.

**Rollback:** corrigir a memória ou reverter commit documental com informação incorreta.

## Boas práticas consolidadas

### BP-001 — Escopo documental restrito

**Classificação:** boa prática

**Contexto:** tarefas de memória, documentação e registro técnico.

**Problema:** documentação pode contaminar código, dados publicados ou arquivos de configuração se o escopo não for controlado.

**Evidência:** tarefas recentes de `fluxo-dados.md`, `rotas.md` e `schema-banco.md` alteraram somente o arquivo de memória alvo e o diário.

**Causa provável:** não aplicável.

**Correção aplicada:** não aplicável.

**Por que funcionou:** diffs pequenos facilitam revisão e rollback.

**Como prevenir:** listar arquivos permitidos antes do patch e conferir `git diff --name-only` antes do commit.

**Boa prática reutilizável:** para tarefa documental, não rodar publicação, não executar testes de aplicação e não tocar em artefatos derivados.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `memoria/INDEX.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

**Validações recomendadas:** `git status --short`, `git diff --name-only`, `git diff --check`.

**Rollback:** `git restore <arquivos_documentais>` antes do commit ou `git revert <hash_do_commit>` após push.

### BP-002 — Validação proporcional ao tipo de mudança

**Classificação:** boa prática

**Contexto:** alterações documentais, frontend, backend, dados e testes.

**Problema:** rodar validação excessiva pode alterar estado local ou desperdiçar tempo; rodar validação insuficiente pode deixar regressão passar.

**Evidência:** `regras-do-projeto.md`, `package.json`, `playwright.config.js` e o diário de bordo registram validações distintas para documentação, JSON, sintaxe, Playwright e banco.

**Causa provável:** não aplicável.

**Correção aplicada:** não aplicável.

**Por que funcionou:** cada tipo de tarefa recebeu validação compatível com o risco.

**Como prevenir:** escolher comandos de validação conforme camada alterada.

**Boa prática reutilizável:** validação deve ser proporcional: diff para documentação, JSON para publicação, `node --check` para JS, API/testes para alteração funcional.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `package.json`, `scripts/validar-json-publicados.js`, `playwright.config.js`, `tests/e2e/app.spec.js`.

**Validações recomendadas:** conforme escopo: `git diff --check`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`.

**Rollback:** reverter alteração que falhou validação e reaplicar patch menor.

### BP-003 — Diário de bordo como trilha operacional

**Classificação:** boa prática

**Contexto:** tarefas incrementais com Codex/IA.

**Problema:** sem diário, correções, riscos, validações e rollback se perdem entre etapas.

**Evidência:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md` registra etapas de Orçamento 2026, validação agentic, publicação estática, fluxo de dados, rotas e schema.

**Causa provável:** não aplicável.

**Correção aplicada:** não aplicável.

**Por que funcionou:** o diário permite recuperar causa, escopo, validações e próxima etapa.

**Como prevenir:** atualizar o diário sempre que a tarefa permitir alteração de memória e tiver relevância técnica.

**Boa prática reutilizável:** diário técnico deve registrar data, branch, tarefa, arquivos, validações, resultado, pendências, risco e rollback.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/INDEX.md`.

**Validações recomendadas:** revisão do diff do diário e coerência com os arquivos realmente alterados.

**Rollback:** remover entrada antes do commit ou reverter commit documental.

### BP-004 — Comentários de código apenas para razão técnica não óbvia

**Classificação:** boa prática

**Contexto:** alterações futuras de código.

**Problema:** comentários óbvios aumentam ruído; ausência de comentário em integração sensível dificulta manutenção.

**Evidência:** regras operacionais do projeto e instruções de tarefas recentes exigem comentário apenas em integrações sensíveis, como modo local/API versus estático, publicação, persistência, hooks, migrações e validações.

**Causa provável:** não aplicável.

**Correção aplicada:** não aplicável.

**Por que funcionou:** mantém o código legível e explica apenas decisões que não são evidentes pela implementação.

**Como prevenir:** comentar o porquê técnico, não repetir o que a linha faz.

**Boa prática reutilizável:** em aplicações institucionais, comentários devem explicar risco, contrato ou decisão operacional.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** aplicável a futuras alterações em `backend/*`, `frontend/*`, `scripts/*` e `tests/*`.

**Validações recomendadas:** revisão de código e diff.

**Rollback:** remover comentário redundante ou ajustar comentário incorreto.

## Padrões preventivos para futuras aplicações

### PP-001 — Arquivos publicados são artefatos derivados

**Classificação:** prevenção

**Contexto:** aplicações com modo estático, GitHub Pages ou publicação de JSON.

**Problema:** editar ou commitar artefato publicado sem conferir fonte pode criar divergência.

**Evidência:** `static-publication-service.js` gera JSONs em `frontend/data/publicados/`; `validar-json-publicados.js` valida estrutura mínima; diário registra churn de `publicadoEm`.

**Causa provável:** artefatos publicados parecem dados-fonte, mas são saída de publicação.

**Correção aplicada:** fluxo de publicação controlada e validação de diff.

**Por que funcionou:** separa fonte, derivação e consumo publicado.

**Como prevenir:** quando `frontend/data/publicados/*.json` mudar, revisar origem, conteúdo material, metadado e necessidade de commit.

**Boa prática reutilizável:** documentar no repositório quais arquivos são fonte e quais são derivados.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `backend/services/static-publication-service.js`, `frontend/data/publicados/*.json`.

**Validações recomendadas:** `npm run validar:json`, `git diff -- frontend/data/publicados/`.

**Rollback:** restaurar artefato derivado e regenerar apenas em etapa controlada.

### PP-002 — Testes E2E de escrita devem bloquear persistência quando o objetivo for navegação

**Classificação:** prevenção

**Contexto:** Playwright e fluxos com modal de confirmação.

**Problema:** teste de navegação pode virar teste de escrita se clicar no botão final com payload válido.

**Evidência:** teste E2E do Orçamento 2026 bloqueia rotas POST perigosas.

**Causa provável:** UI real e backend local compartilham ambiente com dados operacionais.

**Correção aplicada:** bloqueio explícito de rotas de escrita no teste.

**Por que funcionou:** qualquer tentativa de persistência falha o teste imediatamente.

**Como prevenir:** definir, no início do teste, quais POSTs são proibidos e quais são permitidos.

**Boa prática reutilizável:** diferenciar teste de navegação, teste de validação e teste de persistência.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `tests/e2e/app.spec.js`.

**Validações recomendadas:** rodar teste específico com filtro por título.

**Rollback:** remover teste inseguro e criar versão sem escrita.

### PP-003 — Modelos de IA como executores controlados

**Classificação:** prevenção

**Contexto:** tarefas com Codex/IA em repositório institucional.

**Problema:** instruções amplas podem levar a reescrita indevida, invenção de rotas ou alteração fora do escopo.

**Evidência:** `AGENTS.md`, `INDEX.md`, `regras-do-projeto.md` e prompts recentes usam arquivos-alvo, restrições, validações, critérios de aceite e rollback.

**Causa provável:** modelos tendem a preencher lacunas se o escopo não for fechado.

**Correção aplicada:** tarefas decomponíveis, arquivos permitidos, comandos proibidos e validações explícitas.

**Por que funcionou:** reduz liberdade perigosa e aumenta rastreabilidade.

**Como prevenir:** toda ordem de serviço técnica deve informar tarefa, contexto, arquivos-alvo, restrições, entrega, validações e rollback.

**Boa prática reutilizável:** tratar IA como executor incremental, não como arquiteto livre.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `AGENTS.md`, `memoria/INDEX.md`, `memoria/10_TESTES/checklist-validacao.md`.

**Validações recomendadas:** revisão de escopo antes do patch e revisão do diff antes do commit.

**Rollback:** reverter patch pequeno; se a tarefa ficou ampla demais, parar e replanejar.

## Lições exportáveis

### LE-001 — Separar modos editável e publicado desde o início

**Classificação:** lição exportável

**Contexto:** aplicações institucionais com consulta pública e edição local.

**Problema:** misturar escrita local e leitura publicada dificulta segurança, UX e manutenção.

**Evidência:** FOMENTO-ONASP mantém modo local/API editável e modo estático/GitHub Pages somente leitura, com bloqueio de controles dependentes de backend.

**Causa provável:** não aplicável.

**Correção aplicada:** arquitetura híbrida documentada e preservada.

**Por que funcionou:** permite publicar consulta estática sem expor backend ou persistência.

**Como prevenir:** definir fonte de dados, permissões e fallback por modo antes de criar ações editáveis.

**Boa prática reutilizável:** todo botão de escrita deve saber se está em ambiente com backend disponível.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `frontend/js/core/static-mode.js`, `backend/services/data-service.js`, `frontend/data/publicados/*.json`.

**Validações recomendadas:** testar local/API e publicado separadamente.

**Rollback:** remover ação editável do modo publicado e restaurar consumo de JSONs.

### LE-002 — Documentar schema, rotas e fluxo em arquivos diferentes

**Classificação:** lição exportável

**Contexto:** projetos com banco local, API e publicação estática.

**Problema:** um documento único tende a misturar conceitos e perder precisão.

**Evidência:** item 8 da memória foi separado em `fluxo-dados.md`, `rotas.md` e `schema-banco.md`.

**Causa provável:** não aplicável.

**Correção aplicada:** separação por camada técnica.

**Por que funcionou:** cada tarefa futura consulta o nível de detalhe adequado.

**Como prevenir:** criar índice que roteie consultas por tipo de tarefa.

**Boa prática reutilizável:** manter documentação operacional com fronteiras claras entre dados, API e persistência.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `memoria/08_ROTAS_BANCO_API/*.md`, `memoria/INDEX.md`.

**Validações recomendadas:** revisão cruzada contra código antes de commitar documentação.

**Rollback:** reverter documentação incorreta e preencher novamente com base em evidência.

### LE-003 — Rollback deve ser planejado antes do commit

**Classificação:** lição exportável

**Contexto:** tarefas de código, dados e documentação.

**Problema:** sem rollback explícito, correção pequena pode virar operação arriscada após push.

**Evidência:** diário de bordo registra rollback por `git revert <hash_do_commit>` e restauração específica de arquivos em etapas recentes.

**Causa provável:** não aplicável.

**Correção aplicada:** cada etapa documenta rollback antes de finalizar.

**Por que funcionou:** facilita reversão segura e reduz decisões improvisadas.

**Como prevenir:** incluir rollback nos critérios de aceite e no relatório final.

**Boa prática reutilizável:** em projeto institucional, toda alteração versionada deve ter caminho de desfazimento.

**Aplicável a futuras aplicações:** sim.

**Arquivos relacionados:** `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `AGENTS.md`.

**Validações recomendadas:** conferir hash do commit e working tree limpo após push.

**Rollback:** `git revert <hash_do_commit>` e `git push origin HEAD`.

## Checklist antes de replicar em outro projeto

- Confirmar se o outro projeto possui modo local/API, modo estático ou ambos.
- Identificar quais arquivos são fontes e quais são artefatos derivados.
- Conferir se há hook local, build automático ou publicação no commit.
- Conferir se banco local, backups, logs e anexos estão ignorados no Git.
- Conferir se há diário de bordo ou equivalente.
- Conferir se existem validações mínimas de JSON, sintaxe e navegação.
- Conferir se testes E2E de navegação bloqueiam escrita real.
- Conferir se rotas, schema e fluxo estão documentados separadamente ou se precisam de consolidação.
- Conferir se a aplicação de destino aceita `SKIP_PUBLICAR_DADOS=1` ou mecanismo equivalente.
- Adaptar nomes de arquivos, comandos, rotas e scripts; não copiar literalmente se a arquitetura for diferente.

## O que não registrar aqui

- Erro presumido sem evidência.
- Preferência estética sem impacto operacional.
- Dado institucional bruto, planilha, PDF, documento SEI integral, credencial ou informação sensível.
- Rota, tabela, coluna, payload ou arquivo que não exista no repositório.
- Pendência nova de backlog sem relação com erro, correção ou prática reutilizável.
- Tutorial genérico que não derive do uso real do projeto.
- Registro duplicado que já esteja melhor documentado em `rotas.md`, `schema-banco.md`, `fluxo-dados.md` ou decisão técnica.

## Critérios para atualizar este arquivo

Atualizar este arquivo quando houver:

- erro real reproduzido ou evidenciado;
- correção aplicada e validada;
- risco recorrente observado em mais de uma etapa;
- nova boa prática consolidada pelo uso do projeto;
- nova regra preventiva para publicação, banco, testes, hooks, IA ou modo estático;
- lição que possa ser reaproveitada em aplicação institucional futura;
- mudança no hook, validação agentic, publicação estática ou estratégia de rollback;
- revisão de classificação de um item já registrado.

Ao atualizar:

- manter classificação correta;
- informar evidência;
- não inventar causa;
- registrar validações;
- registrar rollback;
- manter linguagem operacional e reutilizável.
