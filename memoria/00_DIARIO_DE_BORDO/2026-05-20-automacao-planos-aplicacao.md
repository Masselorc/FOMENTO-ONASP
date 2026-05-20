# Diário complementar — Automação dos Planos de Aplicação PROFOR 2022

## 20/05/2026 — Planejamento e roteamento agentic

- Branch-alvo: `main`.
- Tarefa: registrar o planejamento macro da automação dos planos de aplicação dos convênios e garantir que agentes de IA/Codex leiam o documento antes de trabalhar nessa frente.
- Contexto: a aplicação FOMENTO-ONASP ainda depende da planilha única `Planilhas/gestao_financeira_ouvidoria.xlsx` para consolidar dados dos planos de aplicação. A mudança planejada é evoluir para leitura de múltiplos arquivos Excel, um por instrumento/convênio, mantendo fallback e validação comparativa.
- Arquivo criado:
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`
- Arquivos de roteamento atualizados:
  - `AGENTS.md`
  - `memoria/INDEX.md`
- Objetivo do novo documento:
  - orientar agentes de IA, Codex e revisores técnicos sobre contexto, escopo, arquitetura atual, schema canônico, fases de implementação, critérios de aceite, testes, riscos e rollback;
  - impedir que a implementação comece por alteração visual ou leitura direta de Excel no frontend;
  - preservar a arquitetura backend de importação, normalização, cálculo e publicação estática;
  - manter a origem antiga como fallback até validação completa.
- Regra agentic adicionada:
  - tarefas envolvendo PROFOR 2022, itens de convênio, plano de aplicação detalhado, planilhas Excel, importação de múltiplos arquivos por instrumento ou automação futura via Transferegov devem ler obrigatoriamente `profor-2022.md` e `profor-2022-automacao-planos-aplicacao.md`.
- Arquivos reais que agentes devem conferir antes de alterar código nessa frente:
  - `backend/data/aplicacao.json`
  - `backend/services/dashboard-publication-service.js`
  - `backend/services/profor-2022/profor-consolidado-service.js`
  - `backend/services/profor-2022/profor-plano-aplicacao-service.js`
  - `backend/services/static-publication-service.js`
  - `backend/server.js`
- Validações executadas:
  - Alteração documental/roteamento; não houve alteração de código executável, banco, planilhas ou JSONs publicados.
  - Não foi executado `npm run publicar:dados`, pois não houve mudança material de dados publicados.
- Risco de regressão: baixo. Alteração restrita à memória operacional e protocolo de orientação de agentes.
- Rollback:
  - remover o arquivo `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - reverter as alterações em `AGENTS.md` e `memoria/INDEX.md`;
  - remover este diário complementar.
