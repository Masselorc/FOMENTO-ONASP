# FOMENTO-ONASP

Aplicação institucional Node: backend/API em `backend/`, SPA em `frontend/`, SQLite local não versionável e publicação estática somente leitura em `frontend/data/publicados/`. `AGENTS.md` e `memoria/INDEX.md` são obrigatórios.

## Regras críticas

- Preservar separação local/API versus GitHub Pages; não expor `.env`, credenciais Supabase, bancos, logs ou anexos.
- Não editar JSON publicado manualmente; usar `npm run publicar:dados` somente quando a tarefa exigir regeneração.
- Evitar dependência nova e patches amplos. Conferir serviços, rotas e fluxos antes de alterar.

## Validação rápida

JavaScript: `npm run validar:syntax`. Dados: `npm run validar:json`. Serviços: `npm run validar:services`. Revisar `git diff`; validar local e estático conforme o risco.
