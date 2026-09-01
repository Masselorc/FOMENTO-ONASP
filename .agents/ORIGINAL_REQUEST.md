# Original User Request

## 2026-09-01T13:03:56Z

Auditar a fidelidade e a atualização dos dados estáticos publicados no GitHub Pages (`frontend/data/publicados/`) em relação às fontes e serviços da aplicação local (Postgres/Supabase, carteiras e parâmetros operacionais).

Working directory: c:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTIÇA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP\FOMENTO-ONASP

Integrity mode: development

## Requirements

### R1. Auditoria de Paridade dos Dados Publicados
Verificar se cada um dos JSONs em `frontend/data/publicados/` (`aplicacao.json`, `dashboard-geral.json`, `parametros-minimos.json`, `formalizacao-profor.json`, `orcamento-2026.json`, `contatos.json`) reflete com precisão os dados atuais produzidos pelos respectivos serviços da aplicação local.

### R2. Verificação de Integridade e Regras de Segurança
Garantir que a publicação estática preserva o modo somente leitura, sem expor segredos, tokens, senhas operacionais ou campos sensíveis, e cumpre os critérios estruturais validados por `npm run validar:json` e `npm run validar:services`.

### R3. Relatório Comparativo e Diagnóstico de Fidelidade
Produzir um relatório objetivo apontando se há divergências, desatualizações ou pendências entre o ambiente local e a versão estática do GitHub Pages.

## Acceptance Criteria

### Integridade e Fidelidade dos Dados
- [ ] Todos os 6 JSONs publicados em `frontend/data/publicados/` validados estruturalmente contra seus esquemas e contratos.
- [ ] Verificação de paridade total dos valores do Dashboard (Total Fomento: R$ 15.022.372,24; Convênios: 15; Parâmetros Mínimos: 28 UFs/unidades; Orçamento 2026: 9 frentes; Contatos: 27 UFs).
- [ ] Diagnóstico explícito sobre a fidedignidade da publicação estática versus a base local.
