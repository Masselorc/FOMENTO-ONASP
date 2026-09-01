## 2026-09-01T13:10:58Z

You are teamwork_preview_worker_1.
Your working directory is: c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP\.agents\teamwork_preview_worker_1
The project root is: c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP

Please read the user's original request in:
c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP\.agents\ORIGINAL_REQUEST.md

Also read the project specification in:
c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP\PROJECT.md

And read previous survey findings in:
- .agents/teamwork_preview_explorer_survey_1/handoff.md
- .agents/teamwork_preview_explorer_survey_2/handoff.md
- .agents/teamwork_preview_explorer_survey_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
1. Execute full verification and structural validation across the 6 published JSON datasets (`aplicacao.json`, `dashboard-geral.json`, `parametros-minimos.json`, `formalizacao-profor.json`, `orcamento-2026.json`, `contatos.json`) and `resumo-publicacao.json` in `frontend/data/publicados/`.
2. Run the validation commands:
   - `npm run validar:json`
   - `npm run validar:syntax`
   - `npm run validar:services`
3. Execute automated parity checks comparing every published metric against the local service aggregations and source data:
   - Total Fomento: R$ 15.022.372,24 (Convênios: R$ 10.664.015,24; FAF: R$ 1.757.357,00; Doações: R$ 2.601.000,00)
   - Convênios: 15 convênios em 15 UFs, 568 itens PAD, 180 itens base, 15/15/15 integridade
   - Parâmetros Mínimos: 28 unidades diagnosticadas (26 estados + DF + ES_1/ES_2), 15 parâmetros, 186 déficits apurados
   - Orçamento 2026: 9 frentes/itens oficiais totalizando R$ 6.100.000,00 (R$ 5.274.476,00 em execução)
   - Contatos: 27 UFs, 29 cadastros institucionais, 150 contatos nominais
   - Formalização PROFOR: 14 UFs, R$ 2.800.000,00
4. Execute security checks: confirm zero exposure of secrets, tokens, database passwords, internal URLs, CPFs or personal cellular numbers, and verify read-only mode behavior.
5. Write your comprehensive verification and audit execution report to `handoff.md` in your working directory (`.agents/teamwork_preview_worker_1/handoff.md`), update `progress.md`, and message parent.
