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

## 13/05/2026 - Orçamento 2026 dividir recurso

- Branch atual: `main`.
- Objetivo: criar a ação de interface "Dividir recurso" no Orçamento 2026 para consumir a API de criação de processo vinculado.
- Botão criado: ação compacta na linha principal do processo, com bloqueio no modo estático e sem uso no cabeçalho do andamento processual.
- Modal criado: formulário de divisão com dados do processo pai, valor alocado, status, processo SEI, link, data, observação e senha.
- Endpoint consumido: `POST /api/orcamento-2026/processos-vinculados/criar`.
- Regra registrada: a divisão cria processo vinculado sem recompor o total global do orçamento; o front-end só antecipa validações básicas e o backend continua sendo a fonte de verdade.
- Testes executados: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`, smoke test manual no navegador com abertura e fechamento do modal, bloqueio de campos vazios e criação/remoção de processo vinculado de teste no ambiente local.
- Resultado: o botão aparece apenas em processos principais, o modal abre e valida preenchimento mínimo, a criação funciona com a API da etapa anterior e o processo vinculado reaparece após recarregar os dados; não ficou alteração residual em JSON publicado.
- Próxima etapa recomendada: avançar para a alocação de saldo entre processos, mantendo a separação entre visualização simples e renderização hierárquica avançada.
- Risco de regressão: médio; a alteração ficou restrita à tela Orçamento 2026, mas adiciona novo fluxo de criação com dependência direta do backend e do bloqueio correto do modo estático.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 5 Orçamento 2026 — renderização de processos vinculados junto ao pai

- Data: 13/05/2026.
- Objetivo: corrigir a exibição dos processos vinculados na tela Orçamento 2026, renderizando-os junto ao processo pai em vez de exibi-los no bloco "Outros processos de interesse da Ouvidoria".
- Problema visual corrigido: o processo vinculado criado na Etapa 4 aparecia solto em "Outros processos", porque `atualizarTabelaOutrosOrcamento` renderizava todos os itens de `outrosProcessos` sem filtrar `tipoProcesso === VINCULADO`.
- Regra de exibição dos filhos: item com `tipoProcesso === 'VINCULADO'` é excluído de "Outros processos" e renderizado como linha aninhada imediatamente abaixo do pai na tabela principal, com badge "Processo vinculado" e origem exibida.
- Regra do saldo básico restante: `saldoBasicoRestante = valorPrevisto(pai) - valorEmpenhado(pai) - valorExecutado(pai) - soma(valorPrevisto(filhos ativos))`. O `valorPrevisto` do pai permanece como envelope original; somente o saldo exibido desconta a distribuição.
- Funções adicionadas em `frontend/js/app.js`:
  - `obterFilhosVinculadosOrcamento(paiId, budgetData)` — retorna filhos vinculados ativos de um pai.
  - `calcularResumoVinculosOrcamento(pai, filhos)` — calcula `valorDistribuido` e `saldoBasicoRestante`.
  - `renderizarResumoVinculosNoPaiOrcamento(pai, filhos)` — renderiza resumo discreto no cell do pai.
  - `renderizarFilhosVinculadosOrcamento(filhos)` — renderiza linhas `<tr>` dos filhos abaixo do pai.
- Funções modificadas em `frontend/js/app.js`:
  - `atualizarTabelaOrcamento` — usa `obterFilhosVinculadosOrcamento` por item, injeta resumo no pai e filhos abaixo do rastreio.
  - `atualizarTabelaOutrosOrcamento` — filtra `itemEhProcessoVinculadoOrcamento` antes de renderizar "Outros processos".
- CSS adicionado em `frontend/css/app.css`: `.budget-linked-summary`, `.budget-linked-summary-alert`, `.budget-linked-summary-item`, `.budget-linked-child-row`, `.budget-linked-child-cell`, `.budget-linked-child-card`, `.budget-linked-child-header`, `.budget-linked-badge`, `.budget-linked-origin`, `.budget-linked-child-body`, `.budget-linked-child-desc`, `.budget-linked-child-meta`, `.budget-linked-child-valor`, `.budget-linked-child-actions`, mais breakpoint mobile.
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos não alterados: nenhum JSON publicado, nenhum backend, nenhum banco, nenhum dado de teste.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Resultado: filhos vinculados aparecem abaixo do pai com badge e origem; pai mostra resumo de valor distribuído e saldo básico; "Outros processos" não exibe mais filhos vinculados; botão "Dividir recurso" não aparece em filhos.
- Próxima etapa recomendada: Etapa 6 — alocação real de saldo entre processos, com movimentação registrada em `orcamento_2026_movimentacoes` e exibição do histórico de alocações.
- Risco de regressão: baixo; a mudança ficou restrita à camada de renderização do front-end, sem alterar o backend, o banco, os JSONs publicados ou o fluxo de salvamento.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 6 Orçamento 2026 — API de alocação real de saldo

- Data: 13/05/2026.
- Objetivo: criar regra backend para alocar saldo entre processos do Orçamento 2026, com rastreabilidade em `orcamento_2026_movimentacoes`.
- Funções criadas em `backend/services/orcamento-2026-service.js`:
  - `obterMovimentacoesAtivasOrcamento2026()` — consulta helper que retorna movimentações ativas.
  - `calcularSaldoTransferivelOrcamento2026(item, registros, movimentacoes)` — calcula saldo considerando alocações recebidas, cedidas, empenho, execução e filhos vinculados.
  - `alocarSaldoOrcamento2026(payload)` — função principal de alocação com todas as validações de negócio.
  - `listarMovimentacoesOrcamento2026()` — retorna movimentações em camelCase, até 500 registros.
- Funções exportadas: `alocarSaldoOrcamento2026`, `listarMovimentacoesOrcamento2026` adicionadas a `module.exports`.
- Endpoints criados em `backend/server.js`:
  - `POST /api/orcamento-2026/saldos/alocar` — chama `alocarSaldoOrcamento2026`, publica após salvamento.
  - `GET /api/orcamento-2026/movimentacoes` — retorna lista de movimentações.
- Regra do saldo transferível: `valorPrevisto + valorRecebido - valorCedido - valorEmpenhado - valorExecutado - valorDistribuidoParaFilhos`.
- Validações implementadas: senha, origemId obrigatório, destinoId obrigatório, origem ≠ destino, origem existente, destino existente, origem ativa, destino ativa, mesma categoria, valor > 0, valor ≤ saldo transferível, justificativa obrigatória.
- Rastreabilidade: `registrarHistorico` com `campo=alocacao_saldo`; `criarBackupBanco` antes de inserir; alocação não altera `valor_previsto`, `valor_empenhado`, `valor_executado` nem `valor_disponibilizado`.
- Tabela `orcamento_2026_movimentacoes`: já existia no banco (Etapa 1); nenhuma alteração estrutural necessária.
- Dado de teste: movimentação com `justificativa = "Teste local de alocacao - remover antes do commit"` e respectivo histórico foram removidos do banco local antes do commit.
- JSONs publicados alterados pelo teste restaurados via `git checkout --` antes do commit.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `backend/server.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Resultado: todos os bloqueios responderam com `success: false` e mensagem correta; alocação válida retornou `success: true` com movimentação registrada; JSONs publicados sem alteração no commit.
- Próxima etapa recomendada: Etapa 7 — criar botão "Alocar saldo" e modal no front-end para consumir `POST /api/orcamento-2026/saldos/alocar`, com exibição do histórico de alocações na tela Orçamento 2026.
- Risco de regressão: baixo a médio; o impacto ficou restrito ao serviço e às rotas do Orçamento 2026, sem alterar fluxos existentes de salvamento, criação de vinculados ou publicação.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` após o commit; antes do commit, `git checkout -- backend/services/orcamento-2026-service.js backend/server.js memoria/`.

## 13/05/2026 - Etapa 5.1 Orçamento 2026 — ajuste visual de processos vinculados

- Data: 13/05/2026.
- Objetivo: converter a renderização dos filhos vinculados de um card simplificado com `colspan="11"` para linhas completas com 11 colunas compatíveis com o cabeçalho da tabela; corrigir o corte lateral da coluna Ações; tornar o botão "Dividir recurso" ícone-apenas.
- Problema visual corrigido: `renderizarFilhosVinculadosOrcamento` usava `<td colspan="11">` com card interno, ocultando dados como Modalidade, Abrangência, Classificação, Empenhado e Executado dos filhos vinculados; a coluna Ações da tabela era cortada pelo `overflow: hidden` do `.table-container`.
- Alterações em `frontend/js/app.js`:
  - `renderizarFilhosVinculadosOrcamento(filhos)` — reescrita completa; filho agora usa `<tr>` com 11 `<td>` idênticos ao pai; inclui badge "Processo vinculado" e "Origem: X" na primeira coluna com recuo visual (`budget-linked-child-item`); suporta rastreio e painel de edição; sem botão "Dividir recurso".
  - Variável `resumoVinculosItem` adicionada antes do template do pai — alimenta o detalhe de distribuição na célula Valor previsto.
  - Célula "Valor previsto" do pai — exibe o valor original e, quando há filhos, mostra "Distr.:" e "Saldo:" em fonte menor abaixo do valor principal.
  - `renderizarBotaoDividirRecursoOrcamento` — adicionado `iconOnly: true`; botão agora exibe apenas o ícone de divisão, igual aos demais botões da coluna Ações.
- Alterações em `frontend/css/app.css`:
  - `.table-container { overflow: hidden }` → `overflow-x: auto` — corrige o corte lateral em viewports menores que a largura mínima da tabela.
  - Coluna Observação: 8% → 6% (`th:nth-child(10)` e `td[data-label="Observação"]`).
  - Coluna Ações: 7% → 9% (`th:nth-child(11)`, `td[data-label="Ações"]`, `.budget-col-acoes`) — acomoda dois ícones com espaço adequado.
  - `.budget-main-table td[data-label="Ações"] .budget-row-actions` — `flex-wrap: nowrap` → `flex-wrap: wrap`.
  - Bloco de CSS do card (`budget-linked-child-cell`, `budget-linked-child-card`, `budget-linked-child-header`, `budget-linked-child-body`, `budget-linked-child-desc`, `budget-linked-child-meta`, `budget-linked-child-valor`, `budget-linked-child-actions`) removido e substituído por: `.budget-linked-child-row > td`, `.budget-linked-child-item`, `.budget-linked-child-prefix`, `.budget-linked-badge`, `.budget-linked-origin`, `.budget-linked-parent-previsto-detail`.
  - CSS de override do botão "Dividir recurso" (`#view-orcamento .budget-split-button { width: auto; ... }`) removido, pois o botão agora usa o tamanho padrão de ícone.
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos não alterados: nenhum JSON publicado, nenhum backend, nenhum banco, nenhum dado de teste.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Resultado: filhos vinculados exibem todas as colunas alinhadas com o cabeçalho; a célula Valor previsto do pai mostra o resumo de distribuição; a tabela não é mais cortada lateralmente; o botão "Dividir recurso" exibe apenas o ícone.
- Próxima etapa recomendada: Etapa 7 — criar botão "Alocar saldo" e modal no front-end para consumir `POST /api/orcamento-2026/saldos/alocar`.
- Risco de regressão: baixo; a mudança ficou restrita à camada de renderização do front-end e ao CSS da tabela, sem alterar backend, banco, JSONs publicados ou fluxo de salvamento.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Correções pós-Etapa 5.1 (commits 24aa555 a e72f7df)

- Data: 13/05/2026.
- Commits registrados nesta entrada: `24aa555`, `b580142`, `3b04467`, `0d7b267`, `812453f`, `e72f7df`.

### 24aa555 — valor previsto do pai exibe saldo do envelope

- Problema: a célula Valor previsto do pai mostrava o valor original com notas de cálculo ("Distr." e "Saldo:") inline, gerando poluição visual.
- Correção: a célula passa a exibir diretamente `valorPrevisto − valorDistribuído` (saldo do envelope) quando há filhos vinculados, sem texto adicional.
- CSS removido: `.budget-linked-parent-previsto-detail` (não mais utilizado).
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

### b580142 — ajustes visuais menores na tabela principal

- `style="border-color: rgba(23, 74, 124, 0.2);"` inline removido do botão SEI (era uma tentativa de ajuste de borda que conflitava com Bootstrap).
- `align-items: flex-end` → `align-items: center` em `.budget-execution-cell` — centraliza o badge Autuado/Não autuado abaixo do valor.
- `text-align: center !important` adicionado a `td[data-label="Observação"]` — centraliza o hífen e o texto truncado da coluna.
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

### 3b04467 — remoção da menção à origem no badge de processo vinculado

- O texto "Origem: CAMP-001" foi removido do prefixo do filho vinculado; o badge "Processo vinculado" permanece.
- CSS `.budget-linked-origin` removido (não mais utilizado).
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

### 0d7b267 — correção da abertura do trâmite em processos vinculados

- Problema: clicar no botão de trâmite de um filho vinculado não abria o painel, pois o ID do filho era removido de `orcamentoItensRastreioAbertos` a cada re-render.
- Causa: `idsFiltrados` era construído apenas com `budgetData.itens`; filhos VINCULADO vivem em `outrosProcessos` e eram descartados imediatamente.
- Correção: `idsFilhosVinculados` (via `obterTodosItensOrcamentoParaDivisao` + filtro `itemEhProcessoVinculadoOrcamento`) é concatenado a `idsFiltrados` para preservar o estado de abertura dos filhos.
- Arquivos: `frontend/js/app.js`.

### 812453f — padroniza variante do botão SEI para outline-primary

- `btn-outline-secondary` → `btn-outline-primary` no botão SEI; borda agora igual aos demais botões da coluna Ações.
- Arquivos: `frontend/js/app.js`.

### e72f7df — iguala visual do botão SEI aos demais botões de ação

- Causa identificada: `.budget-link-button` tinha `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)` e `padding: 0.15rem 0.35rem` que sobrescreviam o Bootstrap e tornavam o botão visualmente diferente.
- Correção: classe `budget-row-action` adicionada ao `<a>` SEI (garante 28×28 px e padding: 0); CSS de `.budget-link-button` reduzido a `text-decoration: none`.
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

## 13/05/2026 - Etapa 5.2 — saneamento pós-ajustes visuais

- Data: 13/05/2026.
- Objetivo: registrar os commits pós-Etapa 5.1 no diário, escopar o `overflow-x: auto` ao `#view-orcamento` e validar o estado atual.
- Decisão técnica: `.table-container { overflow: hidden }` foi restaurado como regra global; a regra `#view-orcamento .table-container { overflow-x: auto }` sobrescreve apenas a view do Orçamento 2026, evitando impacto nas 16+ outras seções que usam `.table-container` no projeto.
- Arquivos alterados: `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Risco de regressão: baixo; a mudança restaura o comportamento original das outras views e restringe o scroll horizontal ao escopo correto.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 8 — consolidar saldos de alocação na tabela do Orçamento 2026

- Data: 13/05/2026.
- Objetivo: exibir, visualmente na tabela, o envelope ajustado e os componentes de saldo (recebido, cedido, distribuído) de cada processo, sem alterar backend, banco nem JSONs publicados.
- Helper criado: `calcularResumoSaldoVisualOrcamento(item, budgetData, movimentacoes)` — retorna `{ valorOriginal, valorRecebidoPorAlocacao, valorCedidoPorAlocacao, valorDistribuidoParaFilhos, envelopeVisualAjustado, valorEmpenhado, valorExecutado, saldoTransferivelEstimado, temMovimentacao, temFilhos, temAlerta }`. Substitui a lógica dispersa antes repetida em `calcularSaldoTransferivelVisualOrcamento` (que agora delega para o helper e clampeia com `Math.max(0, ...)`).
- Novo helper de renderização: `renderizarDetalheEnvelopeOrcamento(resumo)` — retorna bloco compacto com `Orig.`, `Rec.`, `Ced.`, `Vinc.` apenas quando diferente de zero; exibe alerta vermelho se envelope ou saldo forem negativos; retorna `''` quando não há movimentação nem filhos.
- Envelope visual ajustado: `valorOriginal + valorRecebidoPorAlocacao − valorCedidoPorAlocacao − valorDistribuidoParaFilhos`.
- Saldo transferível estimado: `envelopeVisualAjustado − valorEmpenhado − valorExecutado` (valor bruto, pode ser negativo).
- Coluna "Valor previsto" (pai e filho): exibe `envelopeVisualAjustado` como valor principal; exibe `renderizarDetalheEnvelopeOrcamento` abaixo somente quando há movimentação, filhos ou alerta. Sem movimentação nem filhos, aparência continua idêntica ao anterior.
- `renderizarFilhosVinculadosOrcamento`: adicionado parâmetro `budgetData` (com fallback `obterDadosOrcamento()`); computa `resumoSaldoFilho` por filho; usa envelope no valor previsto; passa resumo ao botão "Alocar saldo".
- `atualizarTabelaOrcamento`: computa `resumoSaldoItem` por item pai; usa envelope na coluna valor previsto; passa resumo ao botão "Alocar saldo"; passa `budgetData` para `renderizarFilhosVinculadosOrcamento`.
- Botão "Alocar saldo": oculto quando `saldoTransferivelEstimado <= 0` (parâmetro opcional — quando não informado, mantém comportamento anterior de exibir).
- Modal "Alocar saldo": cálculos inline substituídos por `calcularResumoSaldoVisualOrcamento`; resumo agora exibe "Valor original", "Recebido", "Cedido", "Distribuído", "Envelope ajustado", "Empenhado", "Executado", "Saldo transferível"; saldo usa valor bruto (pode mostrar negativo em vermelho); select de destino exibe envelope ajustado do destino.
- CSS adicionado: bloco `.budget-balance-detail`, `.budget-balance-detail-item`, `.budget-balance-detail-positive`, `.budget-balance-detail-negative`, `.budget-balance-alert`.
- Arquivos alterados: `frontend/js/app.js` (+121/-58 linhas), `frontend/css/app.css` (+28 linhas), `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos NÃO alterados: backend, banco, `frontend/data/publicados/*.json`.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Risco de regressão: baixo; processos sem movimentação e sem filhos têm comportamento visual idêntico ao anterior (helper retorna `envelopeVisualAjustado = valorOriginal` e detalhe fica vazio).
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 7 — botão e modal "Alocar saldo" no Orçamento 2026

- Data: 13/05/2026.
- Objetivo: criar o botão "Alocar saldo" em cada linha de processo (pai e filho vinculado) da view do Orçamento 2026, com modal de confirmação que consome a rota `POST /api/orcamento-2026/saldos/alocar` já existente no backend.
- Escopo: apenas frontend (`frontend/js/app.js`, `frontend/css/app.css`). Nenhuma alteração no backend, banco, JSONs publicados ou outras views.
- Novos símbolos no módulo:
  - Variáveis de estado (escopo do módulo): `orcamentoMovimentacoes` (array de movimentações em cache), `orcamentoAlocacaoEmAndamento` (flag de lock durante POST).
  - `calcularSaldoTransferivelVisualOrcamento(item, budgetData, movimentacoes)` — antecipa o saldo transferível para UX sem depender de round-trip ao backend; fórmula: `valorPrevisto + valorRecebido − valorCedido − valorEmpenhado − valorExecutado − valorDistribuidoParaFilhos`.
  - `carregarMovimentacoesOrcamento2026()` — chama `GET /api/orcamento-2026/movimentacoes` e popula `orcamentoMovimentacoes`; retorna silenciosamente em modo estático.
  - `itemPodeAlocarSaldoOrcamento(item)` — guard: item ativo, fora do modo estático.
  - `renderizarBotaoAlocarSaldoOrcamento(item)` — renderiza botão compacto (28×28 px) com ícone `fa-right-left`; usa `renderActionButton` com `backend: true`.
  - `renderizarModalAlocarSaldoOrcamento(item, todosItens, movimentacoes, saldoTransferivel)` — retorna HTML completo do modal com resumo somente-leitura, select de destinos filtrados por mesma categoria/frente, campo de valor, justificativa, senha e histórico das últimas 5 movimentações do item.
  - `abrirModalAlocarSaldoOrcamento(itemId)` — orquestra abertura do modal, validações de formulário, POST à API e fluxo pós-sucesso (fechar modal → recarregar dados → recarregar movimentações → re-renderizar view → alerta).
- Alterações em funções existentes:
  - `garantirDadosDaView`: passa a chamar `carregarMovimentacoesOrcamento2026()` toda vez que a view `orcamento` é ativada.
  - `atualizarTabelaOrcamento` (linha de pai): botão "Alocar saldo" adicionado entre o botão "Dividir recurso" e o botão de edição.
  - `renderizarFilhosVinculadosOrcamento` (linha de filho): botão "Alocar saldo" adicionado entre o link SEI e o botão de edição.
  - `registrarEventosOutrosProcessosOrcamento`: listener `[data-orcamento-alocar-saldo]` → `abrirModalAlocarSaldoOrcamento`.
  - `abrirModalDividirRecursoOrcamento` e `salvarOrcamentoComSenha`: adicionado `await carregarMovimentacoesOrcamento2026()` após `carregarDadosOrcamento(true)` para manter o cache sincronizado.
  - `UI_ICONS`: entrada `allocate: 'fa-right-left'` adicionada.
  - Import de `data-service.js` com versão bumpeada para `?v=20260513-02`.
- CSS adicionado (`frontend/css/app.css`): bloco escopo `.budget-allocation-*` com botão (`.budget-allocate-button`), grid de resumo (`.budget-allocation-summary`), histórico (`.budget-allocation-history`, `.budget-allocation-history-item`, `.budget-allocation-history-title`) e badge (`.budget-allocation-badge`).
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Arquivos NÃO alterados: backend, banco, `frontend/data/publicados/*.json`.
- Risco de regressão: baixo; todas as novas funções são aditivas e as alterações em funções existentes restringem-se a chamadas de `carregarMovimentacoesOrcamento2026()` e inserção de botão no template HTML.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`.
