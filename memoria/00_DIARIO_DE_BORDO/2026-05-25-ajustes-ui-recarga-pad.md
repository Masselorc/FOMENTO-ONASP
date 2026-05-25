# 25/05/2026 — Ajustes de interface, cache e responsividade

- **Objetivo:** registrar os ajustes pontuais de interface relacionados ao acesso ao menu lateral, cache de arquivos estáticos e responsividade do cabeçalho.
- **Arquivos envolvidos:** `index.html`, `frontend/css/ui-fixes.css`, `frontend/css/budget-dark-fix.css`.
- **Ajuste do menu lateral:** a regra global de acesso ao menu lateral foi isolada em `frontend/css/ui-fixes.css`, deixando `frontend/css/budget-dark-fix.css` restrito ao ajuste visual do Orçamento 2026.
- **Cache-buster:** `index.html` passou a carregar `budget-dark-fix.css?v=20260525-02-orcamento` e `ui-fixes.css?v=20260525-01-menu-lateral`.
- **Responsividade:** `ui-fixes.css` recebeu reforço para manter o acionador do menu lateral visível no cabeçalho e ocultar textos dos botões em telas menores, preservando os ícones.
- **Preservações:** sem alteração de backend, PADs, recarga, cálculos, `frontend/data/publicados/`, `.env`, SQLite/WAL/SHM, DETRU ou Transferegov.
- **Risco:** baixo; alterações restritas à camada visual e cache de arquivos estáticos.
- **Rollback:** reverter os commits de UI/cache relacionados a `ui-fixes.css`, `budget-dark-fix.css` e `index.html`.
- **Pendência técnica:** atualizar o cache-buster interno do import de `data-service.js` em `frontend/js/app.js`, ainda apontando para `v=20260518-01`, em etapa segura com edição local ou ferramenta de patch pontual.
