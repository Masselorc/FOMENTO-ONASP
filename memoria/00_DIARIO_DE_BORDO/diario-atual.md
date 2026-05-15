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

## 13/05/2026 - Etapa 9 — teste E2E do Orçamento 2026 sem persistir dados

- Data: 13/05/2026.
- Objetivo: criar cobertura E2E específica para a tela Orçamento 2026, validando carregamento da view, presença da tabela principal, visibilidade das colunas "Valor previsto" e "Ações" e abertura/fechamento seguro dos modais "Dividir recurso" e "Alocar saldo" sem escrita real.
- Teste criado: `tests/e2e/app.spec.js` ganhou `orcamento 2026 expõe ações de divisão e alocação sem erro crítico`.
- Regra de bloqueio: o teste bloqueia as rotas `POST /api/orcamento-2026/processos-vinculados/criar`, `POST /api/orcamento-2026/saldos/alocar` e `POST /api/orcamento-2026/salvar`; se alguma for acionada, o teste falha.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026 expõe ações de divisão e alocação sem erro crítico"`, `npm run validar:agente`.
- Resultado: validações passaram; o teste específico abriu a view Orçamento 2026, confirmou a tabela principal, validou as colunas pedidas, abriu e fechou os modais quando os botões estavam presentes e não persistiu dados reais.
- Próxima etapa recomendada: ampliar a cobertura E2E gradualmente para outros fluxos críticos da aplicação, mantendo a mesma regra de bloqueio de escrita.

## 13/05/2026 - Etapa 10 — publicação estática controlada e conferência do modo publicado

- Data: 13/05/2026.
- Objetivo: executar a publicação estática dos dados após as mudanças do Orçamento 2026, conferir o diff dos JSONs publicados e validar que a SPA continua abrindo com os dados publicados.
- Comando de publicação executado: `npm run publicar:dados`.
- JSONs alterados no diff real: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/resumo-publicacao.json`.
- Observação operacional: `frontend/data/publicados/orcamento-2026.json` foi tocado pela publicação, mas o conteúdo permaneceu idêntico ao HEAD; após a conferência, foi restaurado para evitar churn semântico.
- Síntese do diff: apenas `publicadoEm` foi atualizado nos JSONs alterados; não houve alteração de código, backend, banco, rotas, tests ou hooks; a publicação permaneceu consistente com os dados já consolidados do Orçamento 2026.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`.
- Resultado: validações aprovadas; a SPA carregou; a view Orçamento 2026 abriu; a tabela apareceu; `Valor previsto` e `Ações` permaneceram visíveis; não houve erro crítico de console nas validações E2E já existentes.
- Houve alteração de código: não.
- Próxima etapa recomendada: revisar se novos commits futuros exigem republicação ou se o modo publicado permanece estável sem churn adicional.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` se a publicação precisar ser desfeita após commit enviado.

## 13/05/2026 - Etapa 11 — documentação do fluxo operacional do Orçamento 2026

- Data: 13/05/2026.
- Objetivo: documentar, em formato operacional e institucional, o fluxo da tela Orçamento 2026 após as últimas implementações de divisão de recurso, alocação de saldo, consolidação visual e teste E2E sem persistência.
- Documento criado: `memoria/01_PROJETO_APLICACAO/orcamento-2026-fluxo-operacional.md`.
- Principais tópicos documentados: processo principal, processo vinculado, divisão de recurso, alocação de saldo, envelope original, envelope visual ajustado, valores recebido/cedido/vinculado, saldo transferível, cuidados com publicação estática e testes recomendados.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/orcamento-2026-fluxo-operacional.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`.
- Resultado: documentação criada com linguagem objetiva e operacional; nenhuma alteração em código, backend, banco, JSON publicado ou hooks.
- Próxima etapa recomendada: manter a documentação alinhada sempre que a operação do Orçamento 2026 sofrer mudança funcional relevante.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` caso o commit precise ser desfeito após envio.

## 13/05/2026 - Fluxo de dados da aplicação

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` com o fluxo real de dados do projeto.
- Arquivos alterados: `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentadas as fontes locais, planilhas, banco SQLite, serviços backend, rotas locais de API, frontend SPA, publicação estática, JSONs publicados, diferenças entre modo local/API e modo estático/GitHub Pages, fluxos por área funcional, exportações, validações e riscos de alteração de dados.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/08_ROTAS_BANCO_API/fluxo-dados.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: detalhar futuramente endpoints, payloads e respostas em `memoria/08_ROTAS_BANCO_API/rotas.md`; detalhar tabelas, colunas e constraints em `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização caso o fluxo de dados mude sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Rotas da API local

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/08_ROTAS_BANCO_API/rotas.md` com as rotas reais da API local.
- Arquivos alterados: `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentadas as rotas confirmadas em `backend/server.js`, os métodos HTTP, serviços chamados, payloads confirmados, respostas, efeitos colaterais, publicação estática por rota, exportações Excel, entrega de arquivos estáticos, relação com frontend, relação com banco/serviços e rotas não confirmadas.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/08_ROTAS_BANCO_API/rotas.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: detalhar schema, tabelas, colunas, tipos, chaves e constraints em `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização se novas rotas forem adicionadas ou alteradas sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Schema do banco local

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/08_ROTAS_BANCO_API/schema-banco.md` com o schema real do SQLite local.
- Arquivos alterados: `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentados o banco `backend/data/onasp.sqlite`, os arquivos responsáveis pela abertura e evolução do schema, as tabelas `parametros_minimos`, `formalizacao_profor`, `orcamento_2026`, `orcamento_2026_movimentacoes` e `historico_alteracoes`, colunas, tipos declarados, constraints explícitas, evolução incremental por `garantirColuna`, relações operacionais com serviços/rotas e dados fora do SQLite.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/08_ROTAS_BANCO_API/schema-banco.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem abrir ou alterar o SQLite, sem rodar `npm run init-db`, sem publicação, sem alteração de código, scripts, testes, planilhas ou JSONs publicados.
- Pendências: manter `schema-banco.md` atualizado se houver nova tabela, coluna, constraint, regra de histórico, movimentação orçamentária ou rota de escrita.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização se o schema evoluir sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Erros, Correções e Boas Práticas

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/09_ERROS_E_CORRECOES/historico-erros.md` como base operacional reutilizável de erros, correções, riscos, boas práticas e lições exportáveis.
- Arquivos alterados: `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/INDEX.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: registrados erros reais já evidenciados, como churn de `publicadoEm`, publicação automática indevida pelo hook, problemas corrigidos no fluxo do Orçamento 2026 e padrões preventivos para JSONs publicados, SQLite local, modo local/API versus estático, documentação, validação agentic, comentários de código e rollback.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/09_ERROS_E_CORRECOES/historico-erros.md memoria/INDEX.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, frontend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: manter o histórico atualizado quando houver novo erro real, correção validada, risco recorrente ou prática reutilizável.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de classificar como erro real algo que seja apenas prevenção ou boa prática.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Checklist de validação

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/10_TESTES/checklist-validacao.md` com checklist operacional por tipo de tarefa.
- Arquivos alterados: `memoria/10_TESTES/checklist-validacao.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentadas validações iniciais de workspace, documentação, frontend, backend/API, rotas, banco SQLite, dados/planilhas, JSONs publicados, publicação estática/GitHub Pages, áreas funcionais, testes automatizados, acessibilidade, segurança/sigilo, Git, commit, sync e rollback.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/10_TESTES/checklist-validacao.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, frontend, banco, scripts, testes, planilhas ou JSONs publicados; nenhum teste de aplicação foi executado nesta tarefa documental.
- Pendências: manter o checklist atualizado quando surgirem novos scripts, testes, rotas, regras de publicação, práticas de segurança ou riscos recorrentes.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização caso comandos ou automações mudem sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Saneamento da trilha de prompts

- Branch atual: `main`.
- Tarefa executada: remoção do arquivo vazio de prompt padrão da trilha operacional da memória.
- Arquivos alterados/removidos: `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md` e remoção do arquivo vazio de prompt padrão.
- Motivo da remoção: decisão operacional do usuário de manter instruções para Codex/IA fora do repositório, elaboradas externamente na versão web do ChatGPT.
- Validações executadas: `git status --short`, conferência de arquivo vazio, `git diff --name-only`, `git diff -- memoria/INDEX.md memoria/01_PROJETO_APLICACAO/pendencias.md memoria/09_ERROS_E_CORRECOES/historico-erros.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`, busca de referências residuais na memória.
- Resultado: trilha operacional saneada, índice sem orientação para consultar o arquivo removido, pendência ativa correspondente eliminada e referência residual em `historico-erros.md` substituída por referência ao checklist de validação, sem alteração de código, backend, frontend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: nenhuma pendência nova criada nesta tarefa.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de referência residual contraditória na memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Curadoria de fontes tratadas

- Branch atual: `main`.
- Tarefa executada: registro da política de curadoria de fontes tratadas e criação das subpastas `fontes-tratadas/` para futura consolidação documental.
- Arquivos alterados: `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `.gitignore`.
- Pastas criadas: `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/`, `memoria/03_NORMATIVOS/fontes-tratadas/`, `memoria/04_PENA_JUSTA/fontes-tratadas/`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/`, `memoria/06_UFS_OUVIDORIAS/fontes-tratadas/`, `memoria/07_DADOS_E_PLANILHAS_TRATADAS/fontes-tratadas/`.
- Resumo: formalizada a cadeia documental `documento original → fichamento Markdown tratado → memória consolidada → uso em minuta/análise`; documentos brutos ficam fora da memória como fonte primária; Markdown tratado passa a ser a camada versionada principal.
- Decisões registradas: `fontes-brutas/` foi incluída no `.gitignore`; documentos públicos e normativos podem ser versionados excepcionalmente com justificativa; documentos internos, sensíveis, SEI, planilhas brutas e anexos institucionais não devem ser versionados como regra.
- Validações executadas: `git status --short`, leitura de `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `.gitignore`, `git diff --name-only`, `git diff -- memoria/INDEX.md memoria/01_PROJETO_APLICACAO/regras-do-projeto.md memoria/00_DIARIO_DE_BORDO/diario-atual.md .gitignore`, `git diff --check`, `Get-ChildItem -Recurse -Filter .gitkeep memoria | Where-Object { $_.FullName -like "*fontes-tratadas*" }`, `rg "fontes-brutas" .gitignore`.
- Resultado: política registrada, estrutura documental criada e pasta `fontes-brutas/` ignorada pelo Git.
- Pendências: iniciar o primeiro fichamento Markdown tratado quando a próxima fonte institucional for disponibilizada.
- Risco de regressão: baixo; alteração exclusivamente documental e organizacional.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Curadoria sem fontes brutas

- Branch atual: `main`.
- Tarefa executada: ajuste da política documental para remover a lógica operacional de `fontes-brutas/` e manter apenas fichamentos técnicos e Markdown tratado no fluxo versionado.
- Arquivos alterados: `.gitignore`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: a memória passa a tratar somente a camada de fichamentos técnicos e Markdown tratado; a estrutura de documentos brutos deixa de compor o fluxo operacional do repositório.
- Decisão registrada: documentos originais permanecem nas origens externas ou institucionais; o repositório versiona apenas a camada tratada e rastreável.
- Validações executadas: registrar os comandos efetivamente executados.
- Resultado: política simplificada, `.gitignore` sem regra de `fontes-brutas/` e memória alinhada à nova decisão.
- Pendências: iniciar a padronização dos modelos de fichamento técnico.
- Risco de regressão: baixo; alteração documental e organizacional.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Modelos de fichamento técnico

- Branch atual: `main`.
- Tarefa executada: criação da pasta `memoria/00_MODELOS/` com os modelos oficiais de fichamento técnico da curadoria documental.
- Arquivos criados: `modelo-fichamento-institucional.md`, `modelo-extrato-normativo.md`, `modelo-nota-leitura-tecnica.md`, `modelo-dicionario-dados.md`, `modelo-nota-metodologica-base.md`.
- Arquivos alterados: `memoria/INDEX.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: versionados os modelos de fichamento institucional, extrato normativo comentado, nota de leitura técnica, dicionário de dados e nota metodológica da base, para orientar a produção dos futuros Markdown tratados.
- Decisão registrada: fichamentos técnicos passam a seguir modelos próprios conforme a natureza do documento ou base.
- Validações executadas: registrar os comandos efetivamente executados.
- Resultado: modelos criados e referenciados no índice da memória.
- Pendências: iniciar o primeiro fichamento documental, preferencialmente `COMPETÊNCIAS-ONASP.txt`.
- Risco de regressão: baixo; alteração documental e organizacional.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Sincronização status e autuação no Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: correção da sincronização entre `status` e `processo_autuado` no Orçamento 2026, com ajuste de persistência, backfill aditivo e sincronização visual no front-end.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema identificado: o item `CAMP-001` ficava com `status = PROCESSO AUTUADO`, mas `processo_autuado = 0`, mantendo a badge “Não autuado” na coluna “Em execução”.
- Causa raiz: a leitura já inferia autuação em alguns pontos, mas a persistência e a renderização pendente ainda podiam divergir entre `status` e `processo_autuado`.
- Regra registrada: status autuado ou etapa posterior força `processo_autuado = 1`; o front-end passa a considerar status pendente/persistido e processo autuado pendente/persistido na badge e no painel.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, e checagem direta por node do item `CAMP-001`.
- Resultado: correção validada; `CAMP-001` retorna `status = PROCESSO AUTUADO`, `processoAutuado = true` e `processoAutuadoNumero = 1`.
- Pendências: nenhuma pendência objetiva na correção; se necessário, a publicação estática será tratada em etapa separada.
- Risco de regressão: baixo a médio; alteração funcional pequena, mas sensível ao fluxo de edição, persistência e leitura da tabela do orçamento.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Publicação estática da autuação do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: republicação dos JSONs publicados após a correção de autuação do Orçamento 2026.
- JSONs alterados: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/orcamento-2026.json`, `frontend/data/publicados/resumo-publicacao.json`.
- Confirmação da autuação publicada: o item `CAMP-001` passou a constar em `frontend/data/publicados/orcamento-2026.json` com `status = "PROCESSO AUTUADO"`, `processoAutuado = true` e `processoAutuadoNumero = 1`.
- Resumo: a publicação estática foi regenerada com a correção funcional já estabilizada, sem alteração de código nesta fase.
- Validações executadas: `npm run publicar:dados`, `git status --short`, `git diff --stat`, `git diff -- frontend/data/publicados/`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `git diff --check`.
- Resultado: JSONs publicados atualizados e validados; o modo publicado passou a refletir a autuação corrigida.
- Próximo passo: diagnóstico de performance da tela Orçamento 2026 no modo publicado.
- Risco de regressão: baixo a médio; alteração de dados publicados pode gerar churn de metadados e totais derivados.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Otimização de renderização do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: otimização incremental da renderização da tela Orçamento 2026 para reduzir varreduras repetidas de itens e movimentações no modo publicado.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema identificado: a tabela do Orçamento 2026 fazia cálculos visuais repetidos por linha, com filtros sucessivos sobre todos os itens e movimentações.
- Causa provável: ausência de contexto de renderização compartilhado, levando a reprocessamento redundante de filhos vinculados, resumo de saldo e movimentações para cada linha e modal.
- Otimização aplicada: criação de um contexto de renderização com `Map` para filhos por pai, movimentações por item e cache de resumo visual, reutilizado na tabela principal e no modal de alocação.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `node --check frontend/js/app.js`, `git diff --check`, medição local no navegador com `toggleView('orcamento')` e verificação de console sem erros.
- Resultado: a tela continuou funcional, com 22 linhas renderizadas no teste local e carregamento observado em aproximadamente 1,1 s na medição automatizada.
- Riscos remanescentes: baixo a médio; ganhos dependem do volume de itens e movimentações, mas a mudança removeu o custo mais óbvio de varredura repetida.
- Próxima etapa recomendada: validar percepção de carregamento em uma sessão interativa do navegador local e, se necessário, considerar otimização adicional apenas após medir gargalos reais.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Carregamento percebido do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: medição do gargalo real e otimização do carregamento percebido da tela Orçamento 2026.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema relatado: a tela Orçamento 2026 ainda parecia lenta no uso real, mesmo após a otimização do contexto de renderização.
- Causa provável: o shell da view só aparecia depois do carregamento dos dados e da montagem completa da interface; além disso, a tabela “Outros processos” e os listeners de edição eram reanexados em cada render.
- Medições feitas: antes da alteração, o shell da view aparecia em cerca de 3,6 s; após o ajuste, o shell apareceu em cerca de 0,9 s e a tabela principal ficou pronta em cerca de 0,9 s também. O teste automatizado mostrou 12 linhas na tabela principal e a seção de outros processos abriu sob demanda com 1 linha de tabela.
- Correções aplicadas: skeleton inicial para Orçamento 2026 enquanto a base carrega, renderização progressiva da tabela principal, carregamento sob demanda de “Outros processos”, debounce no filtro de busca e delegação de eventos no documento para evitar reanexação de listeners por render.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `node --check frontend/js/app.js`, `git diff --check` e checagem manual automatizada de busca, modal de divisão e abertura da seção de outros processos.
- Resultado: a navegação do Orçamento 2026 ficou perceptivelmente mais rápida, sem regressão funcional; os modais de divisão e alocação continuaram abrindo, a busca respondeu sem travar e não houve erros no console.
- Riscos remanescentes: baixo a médio; o gargalo pode mudar de perfil conforme o volume de dados crescer, mas a renderização inicial já deixou de concentrar o maior custo visível.
- Próxima etapa recomendada: observar o uso real em navegador local e medir novamente apenas se surgir novo gargalo.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Medição do carregamento real do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: instrumentação controlada e medição objetiva do carregamento real da tela Orçamento 2026 com `debugPerf=1`.
- Arquivos alterados: `backend/services/data-service.js`, `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Tamanhos dos JSONs: `frontend/data/publicados/aplicacao.json` (391.262 bytes), `frontend/data/publicados/orcamento-2026.json` (77.160 bytes), `frontend/data/publicados/dashboard-geral.json` (386.644 bytes) e `frontend/data/publicados/resumo-publicacao.json` (859 bytes).
- Medições realizadas: `carregarCatalogoAplicacao` levou cerca de 3,9 ms; `carregarDadosAplicacao` levou cerca de 100,3 ms; `carregarDadosOrcamento` levou cerca de 75,2 ms; `renderOrcamentoView:container.innerHTML` levou cerca de 1,9 ms; `atualizarTabelaOrcamento` levou cerca de 4,2 ms; a abertura do orçamento após o boot ficou em torno de 78 ms na medição local.
- Gargalo identificado: o caminho do Orçamento 2026 em si não é o principal gargalo local; o custo maior observado está no bootstrap da aplicação e no carregamento da base da Home/convênios, não na montagem da tabela do orçamento.
- Patch aplicado: instrumentação controlada por `?debugPerf=1` em `data-service.js` e `app.js` para registrar tempos de fetch, parse, bootstrap e render sem alterar regra de negócio.
- Validações executadas: `node --check frontend/js/app.js`, `node --check backend/services/data-service.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `git diff --check` e medição automatizada em navegador headless com `debugPerf=1`.
- Resultado: o orçamento abriu rápido na medição local; não houve regressão funcional e os logs mostraram que o custo do orçamento ficou baixo em comparação ao bootstrap da aplicação.
- Riscos remanescentes: baixo a médio; em ambiente mais lento, o gargalo pode migrar para o bootstrap inicial ou para a base da Home.
- Próxima etapa recomendada: se a percepção de lentidão continuar no uso real, medir especificamente o bootstrap inicial da SPA antes de mexer em novos fluxos.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Lazy bootstrap da SPA e Home sob demanda

- Branch atual: `main`.
- Tarefa executada: ajuste do bootstrap mínimo da SPA para deixar a Home/convênios sob demanda e não bloquear o Orçamento 2026.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema tratado: a Home/convênios entrava no caminho crítico do boot e fazia o Orçamento 2026 parecer dependente da base geral, mesmo quando a view pedida era outra.
- Diagnóstico do bootstrap: o app iniciava com o shell da dashboard, mas o carregamento da base geral podia ocupar o caminho de abertura; agora a base geral é pedida apenas quando a dashboard ou outras views dependentes são acionadas.
- Funções alteradas: `garantirDadosBaseAplicacao`, `garantirDadosDaView` e o bootstrap de `DOMContentLoaded`.
- Views afetadas: dashboard, detalhamento, estado-detalhe, PROFOR 2022, detalhamento de convênio, FAF 2021, Doações 2023 e Orçamento 2026.
- Medições antes/depois: o Orçamento 2026 continuou abrindo em poucos milissegundos após o bootstrap; a dashboard voltou a carregar dados quando solicitada, com valor final exibido em teste manual automatizado.
- Validações executadas: `node --check frontend/js/app.js`, `node --check backend/services/data-service.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `git diff --check` e smoke manual automatizado alternando entre Orçamento 2026 e dashboard.
- Resultado: o bootstrap ficou mais leve; o orçamento não dependeu da Home para abrir, e a dashboard continuou funcionando quando aberta explicitamente.
- Riscos remanescentes: baixo a médio; a dashboard inicial exibe apenas o shell até ser acionada, então o próximo ajuste, se necessário, é melhorar a mensagem visual de carregamento da Home.
- Próxima etapa recomendada: observar a percepção do usuário na abertura inicial e decidir se vale inserir um indicador visual discreto para a Home carregando sob demanda.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Failsafe do Orçamento publicado

- Branch atual: `main`.
- Tarefa executada: correção do travamento do skeleton do Orçamento 2026 no modo publicado, com atualização de cache-busting e timeout operacional.
- Arquivos alterados: `index.html`, `frontend/js/app.js`, `tests/e2e/app.spec.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema observado no GitHub Pages: a tela Orçamento 2026 podia permanecer presa em “Carregando orçamento...” e “Preparando a tabela principal...”, sem substituição pela view final.
- Causa provável: bundle antigo em cache no GitHub Pages, import da `data-service.js` com versão defasada e await do carregamento do orçamento sem failsafe explícito.
- Versão nova do cache-busting: `index.html` passou a carregar `./frontend/js/app.js?v=20260514-03` e `frontend/js/app.js` passou a importar `../../backend/services/data-service.js?v=20260514-03`.
- Timeout/failsafe criado: o carregamento do Orçamento 2026 passou a usar timeout operacional de 15 s para evitar skeleton indefinido e mostrar erro de operação se houver travamento.
- Validações executadas: `node --check frontend/js/app.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"` e smoke local na Home inicial.
- Resultado: o Orçamento 2026 deixa de depender de uma espera indefinida no skeleton e o teste E2E foi reforçado para falhar se a mensagem de preparação persistir.
- Riscos remanescentes: baixo a médio; o principal risco agora é cache antigo no navegador do GitHub Pages até o novo bundle ser recarregado.
- Próxima etapa recomendada: validar no GitHub Pages com hard refresh e `?debugPerf=1` após o push.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Ajuste da Home inicial

- Branch atual: `main`.
- Tarefa executada: correção do boot inicial para voltar a carregar os dados da Home/convênios sem bloquear o Orçamento 2026.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema observado: a dashboard inicial abria no shell, mas os dados não eram carregados automaticamente no primeiro acesso após o bootstrap mínimo.
- Causa provável: a etapa de bootstrap mínimo passou a exibir a Home sem disparar a carga assíncrona da base geral no carregamento inicial.
- Correção aplicada: o boot passou a acionar `garantirDadosBaseAplicacao()` de forma assíncrona quando a view inicial é `dashboard`, mantendo o orçamento fora do caminho crítico.
- Validações executadas: registrar os comandos efetivamente executados após a correção.
- Resultado: a Home inicial volta a carregar dados de forma automática, sem reintroduzir bloqueio no fluxo do Orçamento 2026.
- Riscos remanescentes: baixo a médio; o ganho depende da resposta da base geral, mas o orçamento continua protegido do carregamento obrigatório na abertura direta.
- Próxima etapa recomendada: confirmar no navegador que a Home preenche os KPIs ao abrir e que o Orçamento 2026 continua acessível sem espera desnecessária.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Consolidação das competências da ONASP

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md` com base nos fichamentos técnicos já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/competencias-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/historia-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`.
- Arquivos alterados: `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidadas as competências formais, competências operacionais, base normativa e institucional, papel da ONASP na RENOSPEN, no Plano Pena Justa e no PROFOR/ONASP, bem como limites de atuação e cautelas de fundamentação.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- FOMENTO-ONASP/memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md FOMENTO-ONASP/memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória institucional operacional.
- Pendências: consolidar `pena-justa-e-ouvidorias.md`, `visao-geral-profor.md` e `index-normativos.md`, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Consolidação Pena Justa e ouvidorias

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md` com base nos fichamentos técnicos já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/competencias-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/historia-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`.
- Arquivos alterados: `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidada a relação entre Plano Pena Justa, ONASP, ouvidorias de serviços penais, IN nº 75/2026, indicadores `2.4.2.1.1.1` e `2.4.2.1.2.1`, PROFOR, RENOSPEN, canais de denúncia, transparência e controle social.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória operacional do recorte Pena Justa/ouvidorias.
- Pendências: consolidar `visao-geral-profor.md` e `index-normativos.md`, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Trilha de andamento em Outros processos do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: inclusão da visualização/edição de trilha de andamento para processos existentes da seção `Outros processos de interesse da Ouvidoria`.
- Arquivo alterado: `frontend/js/app.js`.
- Correção aplicada: reaproveitamento de `renderizarRastreioOrcamento`, `renderizarPainelEdicaoOrcamento` e estado `orcamentoItensRastreioAbertos` também na tabela de outros processos, com ajuste de `colspan=7` e renderização da trilha abaixo da linha do processo.
- Comportamento preservado: processos novos temporários (`novo-*`) continuam sem trilha antes de salvar; após persistência passam a usar o mesmo fluxo de rastreio dos demais itens.
- Validações executadas: `npm run validar:syntax`, `npm run validar:json`, `npm run validar:agente` e smoke local automatizado da view Orçamento 2026 para toggle de trilha/painel de edição em outros processos.
- Resultado: processos existentes em outros processos passaram a exibir botão de trilha e painel de edição com campos de andamento processual.

## 15/05/2026 - Consolidação da visão geral do PROFOR/ONASP

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md` com base nos fichamentos técnicos e arquivos consolidados já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`.
- Arquivos alterados: `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidada a visão geral do PROFOR/ONASP, incluindo finalidade, objeto, UFs contempladas, valores previstos, papel da ONASP como área temática, relação com Pena Justa, IN nº 75/2026, Lei nº 13.460/2017, RENOSPEN, condição suspensiva, riscos, controles e limites de completude.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa. Termo de Abertura, Minuta de Edital e Solicitação de Dotação foram ignorados por decisão operacional e registrados como limite de completude.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória operacional do PROFOR/ONASP.
- Pendências: consolidar `index-normativos.md` e `INDEX_UFS.md`, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Consolidação do índice normativo

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/03_NORMATIVOS/index-normativos.md` com base nos fichamentos técnicos e consolidações já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`.
- Arquivos alterados: `memoria/03_NORMATIVOS/index-normativos.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidado o índice normativo da memória ONASP, diferenciando normativos tratados, ignorados por decisão operacional e citados sem extrato próprio.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: registrar os comandos efetivamente executados.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como mapa normativo operacional.
- Pendências: avaliar futuramente se será necessário extrair Portaria MSP nº 199/2018, Portaria SENAPPEN nº 327/2024 e Portarias Conjuntas MGI/MF/CGU nº 28/2024 e nº 33/2023.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Consolidação do índice operacional das UFs

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md` com base nas fontes tratadas e consolidadas já existentes.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`.
- Arquivos alterados: `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidada a visão operacional das UFs no contexto da política de fortalecimento das ouvidorias de serviços penais, com UFs contempladas no PROFOR/ONASP, condição suspensiva, UFs com estrutura relacionada, UFs não contempladas por convênio vigente, evidências mínimas, riscos e limites de uso.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- "memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md"`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória operacional das UFs.
- Pendências: criar futuramente matriz de parâmetros mínimos por UF, checklist de condição suspensiva e base de evidências por UF, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Checklist de parâmetros mínimos das ouvidorias

- Branch atual: `main`.
- Tarefa executada: criação/consolidação do arquivo `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md` com base nas fontes tratadas e consolidadas já existentes.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`.
- Arquivos alterados: `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criado checklist operacional dos parâmetros mínimos das ouvidorias de serviços penais, com blocos de verificação, evidências mínimas, escala de avaliação, classificação de maturidade, riscos e limites de uso.
- Decisão registrada: o checklist não classifica UFs nesta etapa e deve ser aplicado futuramente apenas com evidências documentais por UF.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- "memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md"`, `git diff --check`.
- Resultado: arquivo criado/atualizado e pronto para uso como instrumento de avaliação futura.
- Pendências: criar futuramente matriz por UF, base de evidências por UF e checklist de condição suspensiva, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Fechamento do ciclo de curadoria documental ONASP

- Branch atual: `main`.
- Tarefa executada: fechamento do ciclo de curadoria documental institucional, normativa, Pena Justa, PROFOR e UFs.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`, `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`.
- Arquivos alterados: `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: atualizado o índice da memória, saneadas pendências documentais e registrado o encerramento do modo curto de consolidação documental.
- Consolidados existentes ao final do ciclo:
  - `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`
  - `memoria/03_NORMATIVOS/index-normativos.md`
  - `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`
  - `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`
  - `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`
  - `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`
- Decisão registrada: o ciclo foi encerrado no modo curto; bases futuras por UF, checklist de condição suspensiva e novos fichamentos normativos ficam como opcionais e dependem de decisão posterior.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/INDEX.md memoria/01_PROJETO_APLICACAO/pendencias.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: memória documental consolidada, navegável e sem pendências obrigatórias imediatas deste ciclo.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.
- Data: 2026-05-15 13:56:13
- Objetivo: P0 incremental de testes E2E para bloquear escrita real indevida e ampliar smoke das views principais.
- Arquivo alterado: tests/e2e/app.spec.js
- Helper criado: bloquearEscritasReais(page, { permitir = [] }) com bloqueio global de POST/PUT/PATCH/DELETE por padrão.
- Views incluídas no smoke test: dashboard, detalhamento, formalizacao, profor2022, faf2021, doacoes2023, contatos, diagnostico-ouvidorias, orcamento, status-sistema.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: validações e E2E aprovados (2 passed), sem alteração em JSON publicado ou arquivos de banco.
- Risco de regressão: baixo; principal risco é bloquear futuras escritas legítimas de teste sem inclusão explícita em permitir.
- Rollback: git restore tests/e2e/app.spec.js (ou incluir memoria/00_DIARIO_DE_BORDO/diario-atual.md se necessário).
- Data: 2026-05-15 14:11:38
- Objetivo: corrigir divergência de instância do data-service e validar modo estático/somente leitura no E2E.
- Causa diagnosticada: import com querystring divergente entre app.js e static-mode.js criava instâncias diferentes de módulo ESM, quebrando leitura do estado estático.
- Arquivo de produção alterado: frontend/js/core/static-mode.js
- Arquivo de teste alterado: tests/e2e/app.spec.js
- Teste criado: "modo estático mantém a aplicação somente leitura e bloqueia escrita real".
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- frontend/js/core/static-mode.js; git diff -- tests/e2e/app.spec.js.
- Resultado: validações aprovadas (3 testes E2E passados), com bloqueio de escrita real mantido.
- Risco de regressão: baixo; principal risco é depender da mensagem de erro 503 esperada no navegador durante fallback controlado.
- Rollback: git restore frontend/js/core/static-mode.js tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:17:11
- Objetivo: ampliar E2E de fallback API local para JSON publicado em Formalização PROFOR e Parâmetros Mínimos.
- Testes criados: fallback de formalizacao-profor e fallback de parametros-minimos, mantendo teste estático de orçamento.
- Rotas interceptadas: **/api/formalizacao-profor e **/api/parametros-minimos (503 controlado).
- Como o fallback foi validado: navegação por toggleView, view visível, ausência de .app-error-state e body em modo-publicacao-estatica.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: validações aprovadas e 5 testes E2E passados, sem escrita real e sem alterações em JSON publicado.
- Risco de regressão: baixo; principal risco é variação de mensagem de console para 503 em ambientes/browsers diferentes.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:21:33
- Objetivo: criar E2E de renderização segura contra XSS em campo livre sem alterar produção.
- Teste criado: "renderiza campos livres como texto seguro sem executar XSS".
- View escolhida: Orçamento 2026 (estrutura conhecida no E2E e campo livre de observação/descrição).
- Campo/payload testado: observacao, descricao e processoSei com payload <img src=x onerror="window.__xssExecutado = true"> e javascript:window.__xssExecutado = true.
- Estratégia de mock: interceptação temporária de GET **/api/orcamento-2026 com
oute.fetch() + mutação em memória do payload retornado.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 6 testes E2E aprovados; payload renderizado como texto inofensivo, sem execução JavaScript.
- Risco de regressão: baixo; depende da continuidade do escaping em renderizadores de campos livres.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:28:04
- Objetivo: ampliar E2E de fluxos editáveis sem persistência real.
- Fluxos editáveis cobertos: FAF 2021 (modal de edição de execução) e Formalização PROFOR (editor de linha com cancelar).
- Seletores usados: [data-faf2021-editar-item], #modalFaf2021Execucao, #faf2021SalvarExecucao, [data-formalizacao-toggle-editor], [data-formalizacao-salvar-linha], [data-formalizacao-cancelar-linha].
- Lacuna: Parâmetros Mínimos sem [data-parametros-toggle-editor] disponível no estado atual dos dados durante o E2E; fluxo não foi incluído para evitar teste frágil.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 8 testes E2E aprovados, sem persistência de dados e com bloqueio global de escrita ativo.
- Risco de regressão: baixo; risco residual é variação de disponibilidade de controles editáveis conforme dataset carregado.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:32:53
- Objetivo: adicionar cobertura E2E mínima de responsividade sem alterar produção.
- Viewports testados: tablet (768x1024) e mobile (390x844).
- Views cobertas: dashboard, orcamento, formalizacao, diagnostico-ouvidorias, faf2021, contatos.
- Critérios usados: view visível, ausência de .app-error-state, body visível, sem modal aberto e sem loading overlay preso.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 9 testes E2E aprovados com bloqueio global de escrita ativo.
- Risco de regressão: baixo; cobertura é funcional de navegabilidade, não valida layout pixel-perfect.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:39:49
- Objetivo: adicionar cobertura E2E mínima de acessibilidade básica sem alterar produção.
- Critérios cobertos: html lang pt-BR, meta viewport, headings principais, nomes acessíveis de botões-chave, foco por teclado, abertura/fechamento do offcanvas com aria-labelledby, título e navegação nomeada, modal FAF com título e botão salvar, e aria-disabled em modo estático.
- Testes criados: "estrutura básica de acessibilidade permanece válida" e "modo estático mantém controles de backend com aria-disabled".
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 11 testes E2E aprovados, sem escrita real e sem alterações em produção.
- Risco de regressão: baixo; cobertura é de acessibilidade básica/funcional, não auditoria WCAG completa.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:53:39
- Objetivo: ampliar validação de sintaxe para arquivos críticos de backend, frontend, scripts, testes e configuração.
- Arquivos incluídos na validação de sintaxe: backend/server.js; backend/db/{database.js,init-db.js,preparar-banco.js}; backend/services/{auth-service.js,parametros-minimos-service.js,formalizacao-profor-service.js,orcamento-2026-service.js,faf-2021-service.js,historico-service.js,backup-service.js,static-publication-service.js,excel-export-service.js,dashboard-publication-service.js,data-service.js,analytics.js}; frontend/js/{app.js,core/static-mode.js,core/ui-components.js,core/view-errors.js}; scripts/{validar-json-publicados.js,configurar-git-hooks.js,validar-syntax.js}; playwright.config.js; tests/e2e/app.spec.js.
- Estratégia: script auxiliar scripts/validar-syntax.js chamado por validar:syntax no package.json.
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:json; npm run validar:agente; git diff --check; git diff -- package.json; git diff -- scripts/validar-syntax.js.
- Resultado: validação de sintaxe passou para 24 arquivos; validações JSON e agente aprovadas com 11 testes E2E passados.
- Risco de regressão: baixo; impacto restrito ao pipeline de validação local.
- Rollback: git restore package.json scripts/validar-syntax.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
