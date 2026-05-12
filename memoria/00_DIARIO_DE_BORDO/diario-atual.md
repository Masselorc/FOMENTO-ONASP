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
