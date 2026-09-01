# BRIEFING — 2026-09-01T13:10:00Z

## Mission
Audit and document local backend services, databases (Postgres/Supabase vs legacy SQLite), domain aggregators, and parity with the 6 static published datasets in `frontend/data/publicados/`.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP\.agents\teamwork_preview_explorer_survey_2
- Original parent: af6d1490-1f29-4931-a859-f547129e2c5e
- Milestone: survey_2_local_services_and_parity_audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Explore local application backend services, databases, repositories, domain aggregators
- Map local data to 6 published datasets
- Compare local metrics vs frontend/data/publicados/

## Current Parent
- Conversation ID: af6d1490-1f29-4931-a859-f547129e2c5e
- Updated: 2026-09-01T13:10:00Z

## Investigation State
- **Explored paths**:
  - `backend/server.js`, `backend/db/postgres-client.js`, `backend/db/preparar-banco.js`, `backend/db/database.js`
  - `backend/services/` (`static-publication-service.js`, `dashboard-publication-service.js`, `contatos-publication-service.js`, `parametros-minimos-service.js`, `orcamento-2026-service.js`, `formalizacao-profor-service.js`, `profor-2022/*`)
  - `frontend/data/publicados/` (7 JSONs)
  - `Planilhas/` (`Contatos.xlsx`, `Parametros_Minimos.xlsx`, `orcamento_onasp.xlsx`, `Planilha_Formalizacao_PROFOR_2026.xlsx`)
  - `scripts/validar-json-publicados.js`, `scripts/validar-syntax.js`, `tests/services/*.test.js`
- **Key findings**:
  - 100% data parity confirmed across all 5 key metric groups (Dashboard R$ 15.022.372,24 / 15 convênios; Parâmetros Mínimos 28 UFs/unidades; Orçamento 2026 9 frentes; Contatos 27 UFs / 29 inst / 150 nominais; Formalização PROFOR 14 UFs).
  - Validation commands `npm run validar:json` and `npm run validar:syntax` (110 files) passed 100%.
  - `npm run validar:services` has 533 passed, 20 skipped, 1 failure (`tests/services/profor-pad-origem-reconstrucao.test.js:253` with inverted expectation for Tocantins monitor items).
  - Database architecture: Boot is strictly Postgres-only (`DATABASE_URL`). SQLite is retained as legacy reference only.
  - Zero sensitive secrets or credentials leaked in static files.

## Key Decisions Made
- Fully documented mapping and parity analysis in `handoff.md`.

## Artifact Index
- `.agents/teamwork_preview_explorer_survey_2/DISPATCH.md` — Dispatch log
- `.agents/teamwork_preview_explorer_survey_2/BRIEFING.md` — Persistent memory
- `.agents/teamwork_preview_explorer_survey_2/progress.md` — Progress heartbeat
- `.agents/teamwork_preview_explorer_survey_2/handoff.md` — Final 5-component handoff report
