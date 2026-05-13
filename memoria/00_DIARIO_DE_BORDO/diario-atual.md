# Diário de bordo

## 12/05/2026

- Ajustada a estratégia de versionamento da memória do projeto.
- Removida a regra ampla `memoria/` do `.gitignore`.
- Adicionadas regras específicas para ignorar `.obsidian`, `.trash`, `99_FONTES_BRUTAS` e anexos pesados/sensíveis em `memoria/`.
- Preparado o versionamento dos arquivos Markdown da memória no GitHub.

## 13/05/2026 - Orçamento 2026 vinculos processuais

- Branch atual: `main`.
- Objetivo: criar a camada backend para permitir a criação de processo vinculado no Orçamento 2026, sem alterar front-end, cálculo consolidado ou publicação manual.
- Função criada: `criarProcessoVinculadoOrcamento2026(payload)` em `backend/services/orcamento-2026-service.js`.
- Endpoint criado: `POST /api/orcamento-2026/processos-vinculados/criar` em `backend/server.js`.
- Regra registrada: o processo filho recebe `tipoProcesso = VINCULADO`, `compoe_orcamento = 0`, vínculo ao pai e saldo básico conservador para impedir duplicidade do orçamento.
- Testes executados: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `npm start`, GET em `/api/orcamento-2026`, POST de criação com `valorAlocado = 1`, POSTs inválidos com senha errada, pai inexistente, valor negativo, valor acima do saldo e pai já vinculado.
- Resultado: criação aceita apenas para processo principal com saldo; bloqueios responderam com erro controlado; o registro de teste foi removido do banco local e o JSON publicado foi restaurado ao estado versionado.
- Próxima etapa recomendada: expor a ação no front-end somente quando a interface do Orçamento 2026 for tratada na próxima etapa.

## 12/05/2026 - Orçamento 2026

- Problema: a tela Orçamento 2026 não expunha a edição dos andamentos processuais no fluxo local/API, impedindo o preenchimento de campos como `termo_referencia`.
- Causa: a whitelist `CAMPOS_EDITAVEIS` do backend bloqueava os campos de rastreio e o editor do front-end não renderizava a seção de andamentos.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `frontend/js/app.js`, `frontend/css/app.css`.
- Testes realizados: `npm install`, `npm run init-db`, `npm start`, POST em `/api/orcamento-2026/salvar` para `APON-001` com `termo_referencia`, `link_termo_referencia` e `data_termo_referencia`, conferência do JSON publicado.
- Resultado: persistência confirmada no backend e publicação atualizada; o modo estático continua bloqueando a edição.

## 13/05/2026 - Validação mínima para agentes

- Branch atual: `main`.
- Objetivo: criar uma primeira camada segura de validação para alterações futuras feitas por IA agentic, sem alterar arquitetura, regras de negócio, backend, banco ou fluxos existentes.
- Arquivos criados: `scripts/validar-json-publicados.js`, `playwright.config.js`, `tests/e2e/app.spec.js`.
- Arquivos alterados: `package.json`, `package-lock.json`, `.gitignore`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Scripts adicionados: `validar:json`, `validar:syntax`, `validar:agente`.
- Testes executados: `npm install --save-dev @playwright/test`, `npm run validar:json`, `npm run validar:syntax`, `npm audit --omit=dev`, `npx playwright install chromium`, `npm run validar:agente`, `npm install`.
- Resultado: JSONs publicados esperados existem e são válidos; checagem sintática passou; Playwright abriu `http://localhost:8790/index.html` via servidor local e validou páginas principais sem `console.error` ou `pageerror`; `validar:agente` passou com 1 teste E2E.
- Observação de segurança: `npm audit --omit=dev` apontou 1 vulnerabilidade alta em `xlsx`, dependência já existente e sem correção direta disponível no pacote.
- Pendências: padronizar seletores E2E estáveis, preferencialmente `data-testid`, para fluxos mais profundos de Parâmetros Mínimos, Formalização PROFOR, Orçamento 2026 e Status do Sistema.
- Risco de regressão: baixo; a alteração adiciona validações e dependência de desenvolvimento, sem modificar `backend/server.js`, `backend/services/static-publication-service.js`, `frontend/js/app.js`, `frontend/data/publicados` ou banco SQLite local.
- Rollback: reverter os arquivos deste escopo e remover a dependência `@playwright/test` de `package.json`/`package-lock.json`.

## 13/05/2026 - Consolidação da validação agentic

- Problema: o commit local `38213dc` alterou apenas `publicadoEm` em `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json` e `frontend/data/publicados/resumo-publicacao.json`, gerando churn de timestamp sem ganho funcional.
- Correção: revertidos os `publicadoEm` desses três JSONs para o valor anterior e reforçada a validação mínima de estrutura em `scripts/validar-json-publicados.js`.
- Arquivos alterados: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/resumo-publicacao.json`, `package.json`, `scripts/validar-json-publicados.js`.
- Scripts adicionados: `validar:setup`.
- Validação: a camada agentic continua restrita a checagens de JSON, sintaxe e smoke test de navegação, sem alterar regra de negócio, backend principal, frontend principal ou banco.
- Pendências: manter evolução gradual de `data-testid` e ampliar testes E2E apenas quando houver necessidade funcional.

## 13/05/2026 - Hook de publicacao

- Fato observado: o hook local de pre-commit acionou `npm run publicar:dados` ao tentar consolidar a correção, o que reintroduziu `publicadoEm` novo nos três JSONs publicados.
- Correção aplicada: os três JSONs foram devolvidos ao valor anterior e a próxima gravação do commit deve ocorrer com `SKIP_PUBLICAR_DADOS=1` para evitar republish automático.
- Impacto: sem mudança de regra de negócio, backend, frontend principal ou banco; o ajuste continua restrito à higiene de validação e rastreabilidade.

## 13/05/2026 - Saneamento do hook

- Problema: commits de infraestrutura, documentação, testes e validação ainda podiam acionar publicação automática pelo hook.
- Saneamento aplicado: o hook passou a ignorar automaticamente arquivos de documentação, memória, testes e scripts de validação, e a respeitar explicitamente `SKIP_PUBLICAR_DADOS=1` com mensagem objetiva.
- Uso: definir `SKIP_PUBLICAR_DADOS=1` no ambiente do commit quando a intenção for evitar qualquer republicação automática.
- Impacto esperado: commits não ligados a fontes reais de dados deixam de reescrever `frontend/data/publicados/*.json`, reduzindo churn de timestamp.

## 13/05/2026 - FAF 2021 executável por item

- Branch atual: `main`.
- Problema: a tela FAF 2021 exibía os itens, mas não havia fluxo seguro para editar `valorExecutado` por linha com preservação do modo estático.
- Solução: criado o serviço `backend/services/faf-2021-service.js`, adicionados os endpoints `GET /api/faf2021` e `POST /api/faf2021/salvar`, e incluído botão compacto de edição na lista e no detalhe da FAF 2021 com modal de edição.
- Arquivos alterados: `backend/server.js`, `backend/services/data-service.js`, `backend/services/faf-2021-service.js`, `frontend/js/app.js`, `frontend/css/app.css`, `index.html`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Testes executados: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, smoke test headless em `http://127.0.0.1:8790/index.html`, abertura do modal FAF 2021, verificação dos botões na lista e no detalhe, POST de teste em `/api/faf2021/salvar` e restauração do item para o valor original.
- Resultado: a edição por item funcionou, o modal abriu corretamente, o backend persistiu `valorExecutado` e a restauração retornou o item ao estado original sem deixar alteração residual em `backend/data/aplicacao.json` ou em `frontend/data/publicados/`.
- Observação operacional: o commit final deste escopo deve usar `SKIP_PUBLICAR_DADOS=1` para evitar republicação automática e churn de timestamp.
- Pendências: ampliar a cobertura E2E específica da FAF 2021 e, quando necessário, padronizar seletores estáveis para futuros fluxos editáveis.
- Risco de regressão: baixo a médio; o impacto ficou restrito ao fluxo FAF 2021, com preservação do modo local/API e do modo estático.
- Rollback: `git revert <hash_do_commit>` após o commit, ou `git checkout --` apenas nos arquivos ainda não commitados neste escopo.

## 13/05/2026 - Decisões técnicas

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md` com decisões técnicas reais já adotadas no projeto.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: registradas decisões vigentes sobre arquitetura incremental, modo local/API, modo estático/GitHub Pages, JSONs publicados, SQLite local, serviços backend, publicação estática, validação agentic, hook de publicação e memória operacional em Markdown tratado.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada para commit, sem alteração de código, banco, planilhas, frontend, backend ou JSONs publicados.
- Pendências: detalhar futuramente rotas, payloads, fluxo de dados, schema do banco e ADRs somente quando houver tarefa específica.
- Risco de regressão: baixo; alteração exclusivamente documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 0 Orçamento 2026

- Data: 13/05/2026.
- Objetivo da inspeção: congelar a arquitetura atual da tela Orçamento 2026 para futura implementação de processos vinculados e alocação de saldos.
- Arquivos inspecionados: `backend/db/init-db.js`, `backend/services/orcamento-2026-service.js`, `backend/server.js`, `backend/services/static-publication-service.js`, `backend/services/data-service.js`, `frontend/js/app.js`, `frontend/css/app.css`, `frontend/data/publicados/orcamento-2026.json`, `tests/e2e/app.spec.js`, `package.json`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Conclusão: a tela Orçamento 2026 já está integrada a uma tabela SQLite local, serviço próprio, rotas `GET /api/orcamento-2026` e `POST /api/orcamento-2026/salvar`, publicação automática pós-salvamento e bloqueio no modo estático; porém, não há no código atual hierarquia de processos, tabela de movimentação de saldo, campo de processo pai ou mecanismo explícito de alocação entre processos.
- Riscos identificados: duplicidade de orçamento se uma futura hierarquia não for modelada com chave estável; saldo negativo ou inconsistência se a alocação for implementada sem validação de origem e destino; perda de rastreabilidade se a movimentação de saldo não tiver histórico dedicado; quebra do modo estático se controles dependentes de backend não respeitarem `data-requer-backend="true"`; regressão em edição de andamento se o fluxo atual de `salvarOrcamento2026` for alterado sem compatibilidade; regressão em publicação estática se o pós-salvamento deixar de acionar `publicarDadosEstaticos()`.
- Próxima etapa recomendada: Etapa 1 - banco, com modelagem explícita para vínculo entre processos e movimentação de saldo antes de expor novos controles na interface.
- Validações executadas: `git status`, `git log --oneline -5`, `npm run validar:json`, `npm run validar:syntax`, `git diff --check`.
- Resultado: diagnóstico documental concluído; nenhuma alteração funcional aplicada.
- Registro em memória: não foi necessário atualizar `pendencias.md`, porque não surgiu pendência nova objetiva fora do backlog já existente.
- Risco de regressão: baixo, porque a etapa foi apenas de inspeção e documentação.
- Rollback: `git revert <hash_do_commit>` somente após eventual commit desta documentação; antes do commit, `git checkout -- memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

## 13/05/2026 - Etapa 1 Banco Orçamento 2026

- Data: 13/05/2026.
- Objetivo: preparar a base persistente mínima para vincular processos e registrar movimentações de saldo no Orçamento 2026.
- Alteração no banco: migração aditiva em `backend/db/init-db.js`, sem remover colunas e sem tocar em dados existentes.
- Colunas criadas: `processo_pai_id`, `tipo_processo`, `origem_recurso_id`, `ordem_exibicao`, `valor_alocado_origem`.
- Tabela criada: `orcamento_2026_movimentacoes`.
- Arquivos alterados: `backend/db/init-db.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Comandos de validação: `npm run init-db`, `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `npm start` com verificação da porta/HTTP local.
- Resultado: banco inicializado com a migração aditiva aplicada; validações de JSON e sintaxe passaram; servidor subiu e respondeu `200` em `http://127.0.0.1:8790/`; nenhum JSON publicado foi alterado.
- Próxima etapa recomendada: Etapa 2, exposição dos novos campos no serviço de orçamento e leitura controlada sem alterar o cálculo.
- Risco de regressão: baixo; a mudança é estrutural e aditiva, mas ainda exige cuidado para não impactar o fluxo atual de edição do Orçamento 2026.
- Rollback: antes do commit, `git checkout -- backend/db/init-db.js memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 2 Orçamento 2026

- Data: 13/05/2026.
- Objetivo: expor no serviço do Orçamento 2026 os campos de vínculo processual criados na etapa anterior.
- Campos expostos no serviço: `processoPaiId`, `tipoProcesso`, `origemRecursoId`, `ordemExibicao`, `valorAlocadoOrigem`.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, subida do servidor local e consulta a `GET /api/orcamento-2026`.
- Resultado: a API respondeu `200`, os itens continuaram sendo retornados e os novos campos apareceram em camelCase com defaults seguros para registros antigos; nenhum JSON publicado foi alterado.
- Próxima etapa recomendada: Etapa 3, leitura/aproveitamento dos novos campos no fluxo de regra de negócio sem alterar o cálculo financeiro ainda.
- Risco de regressão: baixo; a mudança ficou restrita à exposição de dados no serviço do orçamento.
- Rollback: antes do commit, `git checkout -- backend/services/orcamento-2026-service.js memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Botao duplicado do Orçamento 2026

- Data: 13/05/2026.
- Objetivo: remover o botão duplicado de edição exibido no cabeçalho do andamento processual da tela Orçamento 2026.
- Ajuste aplicado: o cabeçalho do rastreio passou a exibir apenas o status informado; o botão duplicado foi removido, preservando o botão principal da linha.
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, verificação no navegador com `trackingButtons = 0` e `lineButtons = 10`.
- Resultado: o botão duplicado deixou de aparecer quando o processo é expandido, sem alterar a edição principal do orçamento.
- Próxima etapa recomendada: seguir a Etapa 3 do Orçamento 2026 sem reintroduzir ação duplicada no cabeçalho do rastreio.
- Risco de regressão: baixo; a mudança ficou restrita à remoção de um controle redundante.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.
