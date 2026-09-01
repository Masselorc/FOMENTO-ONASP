# Project: Auditoria de Fidelidade e Integridade dos Dados Publicados (GitHub Pages)

## Architecture
- **Publicação Estática**: Diretório `frontend/data/publicados/` contendo 6 datasets principais (`aplicacao.json`, `dashboard-geral.json`, `parametros-minimos.json`, `formalizacao-profor.json`, `orcamento-2026.json`, `contatos.json`) e o manifesto `resumo-publicacao.json`.
- **Backend & Serviços Locais**:
  - `dashboard-publication-service.js` & `data-service.js`: Consolidação de fomento, convênios PROFOR 2022 (`reconstrucao-pad`), FAF e doações.
  - `parametros-minimos-service.js`: Diagnóstico de 15 parâmetros em 28 unidades (27 UFs com desdobramento ES_1/ES_2).
  - `orcamento-2026-service.js`: 9 itens oficiais e frentes estratégicas.
  - `formalizacao-profor-service.js`: 14 propostas de celebração PROFOR 2026.
  - `contatos-publication-service.js`: 27 UFs, 29 órgãos e 150 contatos institucionais extraídos de `Planilhas/Contatos.xlsx` com whitelist restrita.
  - `static-publication-service.js`: Sanitização de dados brutos e escrita atômica para o GitHub Pages.
- **Camada de Integridade & Validação**:
  - `scripts/validar-json-publicados.js` (`npm run validar:json`): Verificação de esquemas, integridade de UFs, listas positivas de campos e ausência de injeção XSS/HTML.
  - `scripts/validar-syntax.js` (`npm run validar:syntax`): Verificação de sintaxe de 110 arquivos JS do projeto.
  - `tests/services/*.test.js` (`npm run validar:services`): Suite unitária de regras de negócio, autenticação, sanitização e segurança (578 testes).

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Validação Estrutural dos 6 JSONs Publicados | Checagem de integridade sintática e de esquema dos arquivos estáticos | M1 | Survey / R1 / R2 | DONE |
| 2 | Verificação de Segurança e Modo Somente Leitura | Garantir ausência de tokens, segredos, CPFs e isolamento GitHub Pages | M1 | Survey / R2 | DONE |
| 3 | Auditoria de Paridade do Dashboard Geral | Verificação de Total Fomento (R$ 15.022.372,24) e 15 Convênios PROFOR | M2 | Survey / R1 | DONE |
| 4 | Auditoria de Paridade de Parâmetros Mínimos | Verificação de 28 unidades/respostas, 15 parâmetros e 186 déficits | M2 | Survey / R1 | DONE |
| 5 | Auditoria de Paridade do Orçamento 2026 | Verificação de 9 itens oficiais (R$ 6.100.000,00) e 3 frentes | M2 | Survey / R1 | DONE |
| 6 | Auditoria de Paridade de Contatos e Formalização | Verificação de 27 UFs / 29 cadastros / 150 contatos e 14 propostas PROFOR | M2 | Survey / R1 | DONE |
| 7 | Diagnóstico de Fidelidade e Relatório Comparativo | Síntese de paridade, análise de discrepâncias e atesto formal de conformidade | M3 | Survey / R3 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Validação Estrutural e Segurança | Validação estrutural de todos os JSONs e blindagem de segurança/PII | none | DONE |
| 2 | M2: Auditoria de Paridade dos Dados | Verificação de fidelidade e paridade matemática/quantitativa total | M1 | DONE |
| 3 | M3: Diagnóstico Final e Relatório Comparativo | Síntese comparativa e relatório executivo de fidedignidade | M2 | DONE |

## Interface Contracts
### Publicação Estática ↔ Frontend
- `aplicacao.json`: `{ configuracao, regioes, nomesEstados, imagensBandeiras, infoConvenios, dadosBase: Array(180), dadosProfor2022: { diagnostico: { totalComDetru: 15, totalComPlano: 15, totalComRendimentos: 15 } } }`
- `dashboard-geral.json`: `{ publicadoEm, fonteDadosBase, dadosBase: Array(180), dadosProfor2022, resumoEsperado: { totalFomento: 15022372.24, totalConvenios: 10664015.24, totalFaf: 1757357, totalDoacoes: 2601000, quantidadeUfsConvenios: 15 } }`
- `parametros-minimos.json`: `{ arquivo, disponivel, aba, parametrosDisponiveis: Array(15), respostas: Array(28), resumo: { totalRespostas: 28, ufsDiagnosticadas: 28, deficitTotalDeclarado: 186 } }`
- `formalizacao-profor.json`: `{ ufsAutorizadas: Array(14), valorRepassePadrao: 200000, propostas: Array(14), resumo: { totalPropostas: 14, totalRepasse: 2800000 } }`
- `orcamento-2026.json`: `{ itens: Array(9), itensOficiais: Array(9), outrosProcessos: Array(3), resumo: { totalGeral: 6100000, totalEmExecucao: 5274476, saldoPlanejado: 825524 } }`
- `contatos.json`: `{ cadastroPorUf: Array(29), pessoasPorUf: Array(150), totais: { ufs: 27, cadastrosInstitucionais: 29, contatosNominais: 150 } }`

## Code Layout
- `frontend/data/publicados/`: Arquivos estáticos JSON auditados.
- `backend/services/`: Serviços de montagem de catálogo, sanitização e publicação.
- `scripts/`: Scripts de validação (`validar-json-publicados.js`, `validar-syntax.js`).
- `tests/services/`: Testes automatizados de serviços.
- `.agents/`: Metadados e relatórios de orquestração.
