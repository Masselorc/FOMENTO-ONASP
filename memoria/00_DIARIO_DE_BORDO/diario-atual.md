# Diário de bordo

## 12/05/2026

- Ajustada a estratégia de versionamento da memória do projeto.
- Removida a regra ampla `memoria/` do `.gitignore`.
- Adicionadas regras específicas para ignorar `.obsidian`, `.trash`, `99_FONTES_BRUTAS` e anexos pesados/sensíveis em `memoria/`.
- Preparado o versionamento dos arquivos Markdown da memória no GitHub.

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
