# BRIEFING — 2026-09-01T13:22:30Z

## Mission
Adversarial empirical challenge of data parity, financial arithmetic, referential consistency, and UF mappings for ONASP static published datasets.

## ?? My Identity
- Archetype: empirical_challenger
- Roles: critic, specialist
- Working directory: c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP\.agents\teamwork_preview_challenger_2
- Original parent: af6d1490-1f29-4931-a859-f547129e2c5e
- Milestone: M2/M3 Parity and Integrity Challenge
- Instance: 2 of 2

## ?? Key Constraints
- Review-only — do NOT modify implementation code unless creating test harnesses
- Never place source code or test harnesses in .agents/
- Empirical verification: run all test oracles directly

## Current Parent
- Conversation ID: af6d1490-1f29-4931-a859-f547129e2c5e
- Updated: 2026-09-01T13:22:30Z

## Review Scope
- **Files reviewed**:
  - rontend/data/publicados/aplicacao.json
  - rontend/data/publicados/dashboard-geral.json
  - rontend/data/publicados/parametros-minimos.json
  - rontend/data/publicados/formalizacao-profor.json
  - rontend/data/publicados/orcamento-2026.json
  - rontend/data/publicados/contatos.json
  - rontend/data/publicados/resumo-publicacao.json
- **Interface contracts**: PROJECT.md / ORIGINAL_REQUEST.md
- **Review criteria**: Exact penny/centavos arithmetic, referential integrity, UF mapping consistency, edge cases

## Key Decisions Made
- Created and executed standalone test oracle 	ests/services/challenger-auditoria-paridade-empirica.test.js with 10 comprehensive tests.
- Reconciled exact penny sums: Total Fomento R$ 15.022.372,24 (Convênios: R$ 10.664.015,24, FAF: R$ 1.757.357,00, Doações: R$ 2.601.000,00); Orçamento 2026 R$ 6.100.000,00 (Em Execução: R$ 5.274.476,00, Saldo: R$ 825.524,00); Formalização PROFOR R$ 2.800.000,00 (14 UFs x R$ 200.000,00); Parâmetros Mínimos 28 unidades / 186 déficits; Contatos 27 UFs / 29 órgãos / 150 contatos.
- Formulated verdict: APPROVE.

## Attack Surface
- **Hypotheses tested**:
  - Penny/centavos drift in 180 dadosBase items -> REJECTED (Exact match: 1502237224 cents).
  - Orçamento 2026 process balance drift -> REJECTED (Exact match: 605460000 cents in processes + 4540000 cents in available balance = 610000000 cents).
  - Formalização PROFOR individual proposal mismatch -> REJECTED (14 x 20000000 cents = 280000000 cents).
  - Parâmetros Mínimos individual unit vs parameter deficit sum mismatch -> REJECTED (28/28 units matched, sum = 186).
  - UF partition drift -> REJECTED (27 IBGE UFs, with ES split as ES_1/ES_2 only where specified, and 29 institutions in Contatos with ES and PR having 2 organs each).
- **Vulnerabilities found**: None in published static artifacts.
- **Untested angles**: Full database sync requires live Postgres, which is documented and out-of-scope for static published data review.

## Loaded Skills
- None required

## Artifact Index
- .agents/teamwork_preview_challenger_2/BRIEFING.md — persistent memory
- .agents/teamwork_preview_challenger_2/progress.md — heartbeat
- .agents/teamwork_preview_challenger_2/handoff.md — final verdict report
- 	ests/services/challenger-auditoria-paridade-empirica.test.js — empirical test oracle
