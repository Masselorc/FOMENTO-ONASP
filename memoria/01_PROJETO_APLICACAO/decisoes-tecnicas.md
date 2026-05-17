# Decisões Técnicas — FOMENTO-ONASP

## Finalidade

Este arquivo registra decisões técnicas reais já adotadas no projeto FOMENTO-ONASP. Ele serve como referência para manutenção, revisão, uso de IA/Codex, planejamento de alterações e preservação da arquitetura existente.

O arquivo não substitui `AGENTS.md`, `memoria/INDEX.md`, `regras-do-projeto.md`, `pendencias.md` ou `arquitetura-atual.md`. Ele registra decisões confirmadas e suas consequências práticas.

## Como usar este arquivo

- Consultar este arquivo antes de propor alteração estrutural, nova dependência, nova rota, novo serviço, mudança de persistência, mudança no fluxo de publicação ou alteração relevante no frontend.
- Tratar decisões com status `vigente` como restrições operacionais do projeto, salvo decisão posterior documentada.
- Não usar este arquivo como backlog. Pendências devem ficar em `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Não registrar preferência genérica como decisão técnica. Toda decisão deve ter evidência em arquivo real, memória técnica já preenchida ou histórico do repositório.
- Quando uma decisão deixar de valer, registrar a revisão neste arquivo e, se necessário, criar ADR futura.

## Convenções de status

- `vigente`: decisão confirmada no estado atual do projeto.
- `provisória`: decisão operacional adotada por enquanto, mas que pode mudar após análise técnica.
- `a revisar`: decisão ou prática existente que exige reavaliação quando houver evolução do projeto.
- `não decidida`: tema conhecido, mas sem decisão técnica adotada.

## Decisões vigentes

### DT-001 — Manter arquitetura incremental com frontend SPA e backend local Node

**Status:** vigente

**Decisão:** manter a aplicação como frontend SPA servido por arquivos estáticos, com backend local em Node usando `http` nativo, sem migração para framework de frontend ou backend.

**Evidência:** `index.html`, `frontend/js/app.js`, `frontend/js/core/`, `backend/server.js`, `package.json` e `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`.

**Consequência prática:** alterações devem ser pequenas, compatíveis com a SPA existente e integradas ao servidor local atual. Nova arquitetura, framework ou build pipeline exige justificativa específica.

**Risco:** introduzir framework ou reescrita ampla pode quebrar o modo local/API, o modo estático/GitHub Pages e o fluxo de manutenção institucional.

**Orientação de manutenção:** preservar `index.html`, `frontend/js/app.js`, módulos auxiliares em `frontend/js/core/` e `backend/server.js` como base operacional, fazendo extrações apenas quando reduzirem risco real.

### DT-002 — Preservar diferença entre modo local/API e modo estático/GitHub Pages

**Status:** vigente

**Decisão:** manter dois modos de execução: modo local/API editável, com backend e persistência local; e modo estático/GitHub Pages somente leitura, baseado em JSONs publicados.

**Evidência:** `frontend/js/core/static-mode.js`, `frontend/js/app.js`, `backend/services/data-service.js`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md` e `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`.

**Consequência prática:** controles que dependem de backend devem ser sinalizados e bloqueados no modo estático, preservando leitura pública sem tentativa de escrita.

**Risco:** misturar os modos pode expor botões de edição sem backend, gerar erro no GitHub Pages ou induzir alteração de dados fora do fluxo local.

**Orientação de manutenção:** ao adicionar tela, botão, rota ou salvamento, verificar comportamento nos dois modos e usar os bloqueios existentes para ações dependentes de backend.

### DT-003 — Usar JSONs publicados como fonte do modo estático

**Status:** vigente

**Decisão:** usar os arquivos em `frontend/data/publicados/` como fonte de dados do modo estático/GitHub Pages.

**Evidência:** `frontend/data/publicados/`, `backend/services/data-service.js`, `backend/services/static-publication-service.js`, `scripts/validar-json-publicados.js` e `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`.

**Consequência prática:** o modo estático deve consumir JSONs publicados e não depender de rotas locais.

**Risco:** alterar formato ou conteúdo dos JSONs sem compatibilidade com a interface pode quebrar páginas publicadas.

**Orientação de manutenção:** validar JSONs publicados com `npm run validar:json` e evitar mudanças estruturais sem atualizar consumidores e validações.

### DT-004 — Manter SQLite como banco local não versionável

**Status:** vigente

**Decisão:** manter o banco SQLite como artefato local de execução, não versionado no Git.

**Evidência:** `backend/db/database.js`, `backend/db/init-db.js`, `backend/db/preparar-banco.js`, `package.json` e `.gitignore`.

**Consequência prática:** tarefas que dependem de persistência local devem usar scripts e serviços existentes, sem versionar `backend/data/onasp.sqlite` ou cópias de banco.

**Risco:** versionar banco local pode expor dados, gerar conflitos binários e comprometer rastreabilidade.

**Orientação de manutenção:** tratar schema, importações e dados derivados como código/documentação; tratar o arquivo SQLite como ambiente local descartável ou restaurável.

### DT-005 — Concentrar publicação estática em serviço próprio

**Status:** vigente

**Decisão:** manter a geração dos JSONs publicados concentrada em `backend/services/static-publication-service.js`, acionada pelo script de publicação ou após salvamentos relevantes.

**Evidência:** `backend/services/static-publication-service.js`, `backend/scripts/publicar-dados-estaticos.js`, `backend/server.js` e `package.json`.

**Consequência prática:** novas publicações ou ajustes no formato publicado devem passar pelo serviço de publicação, não por escrita manual dispersa.

**Risco:** gerar JSONs por caminhos paralelos aumenta chance de divergência entre modo local/API e modo estático.

**Orientação de manutenção:** ao mudar dado exibido publicamente, verificar serviço de origem, endpoint local, serviço de publicação e arquivo JSON correspondente.

### DT-006 — Evitar edição manual de JSONs publicados

**Status:** vigente

**Decisão:** não editar manualmente `frontend/data/publicados/*.json` sem necessidade clara e justificativa, pois esses arquivos são derivados do fluxo de publicação.

**Evidência:** `AGENTS.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `backend/services/static-publication-service.js`, `scripts/configurar-git-hooks.js` e histórico recente documentado no diário de bordo sobre churn de publicação.

**Consequência prática:** alterações em JSONs publicados devem normalmente vir de dados-fonte, serviços ou comando de publicação, e não de edição direta.

**Risco:** edição manual pode criar divergência entre dados locais, banco, serviços e publicação estática.

**Orientação de manutenção:** quando JSON publicado aparecer modificado, classificar se é dado material ou churn de metadado antes de commitar.

### DT-007 — Preservar serviços backend como camada de regra e persistência

**Status:** vigente

**Decisão:** manter `backend/services/` como camada responsável por leitura, normalização, validação, persistência, histórico, exportação e publicação, com `backend/server.js` atuando como roteador HTTP local.

**Evidência:** `backend/server.js`, `backend/services/parametros-minimos-service.js`, `backend/services/formalizacao-profor-service.js`, `backend/services/orcamento-2026-service.js`, `backend/services/data-service.js` e `backend/services/static-publication-service.js`.

**Consequência prática:** regras de negócio e persistência não devem ser concentradas no frontend nem duplicadas diretamente nas rotas.

**Risco:** mover lógica sensível para a interface ou para rotas sem serviço aumenta risco de inconsistência, perda de histórico e validação incompleta.

**Orientação de manutenção:** novas operações editáveis devem ter validação no backend e, quando aplicável, backup, histórico e publicação estática.

### DT-008 — Manter validação agentic incremental com JSON, sintaxe e Playwright

**Status:** vigente

**Decisão:** manter uma camada mínima de validação para alterações feitas por IA, combinando validação de JSONs publicados, checagem sintática e smoke tests Playwright.

**Evidência:** `package.json`, `scripts/validar-json-publicados.js`, `playwright.config.js`, `tests/e2e/app.spec.js`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md` e `memoria/01_PROJETO_APLICACAO/pendencias.md`.

**Consequência prática:** alterações devem ser acompanhadas por validações proporcionais, usando `npm run validar:json`, `npm run validar:syntax` e `npm run validar:agente` quando aplicável.

**Risco:** remover ou ignorar essa camada reduz a capacidade de detectar erro de console, JSON inválido ou quebra básica de navegação.

**Orientação de manutenção:** ampliar testes gradualmente, priorizando seletores estáveis e fluxos reais, sem transformar o projeto em stack complexa.

### DT-009 — Usar hook local para publicar dados apenas quando necessário

**Status:** vigente

**Decisão:** manter hook local de pre-commit para publicação controlada, respeitando `SKIP_PUBLICAR_DADOS=1` e evitando republicação automática em commits sem alteração relevante de dados.

**Evidência:** `scripts/configurar-git-hooks.js`, `package.json`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md` e histórico recente de saneamento do hook.

**Consequência prática:** commits documentais, de infraestrutura ou validação podem usar `SKIP_PUBLICAR_DADOS=1` quando necessário para impedir churn de timestamps nos JSONs publicados.

**Risco:** publicação automática indevida pode gerar diff sem ganho funcional e dificultar rastreabilidade.

**Orientação de manutenção:** antes de commitar, conferir se JSONs publicados foram alterados de forma material ou apenas por metadado; não commitar churn sem justificativa.

### DT-010 — Manter memória operacional em Markdown tratado

**Status:** vigente

**Decisão:** manter a memória operacional versionada como Markdown sintético, tratado e não sensível dentro de `memoria/`.

**Evidência:** `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md` e `.gitignore`.

**Consequência prática:** a memória deve orientar agentes e mantenedores sem copiar fontes brutas, bancos, anexos pesados, documentos sensíveis ou credenciais.

**Risco:** misturar memória operacional com fontes brutas ou sensíveis pode expor informações indevidas e prejudicar versionamento.

**Orientação de manutenção:** atualizar diário e arquivos temáticos existentes quando houver mudança relevante, sem criar novos arquivos temáticos automaticamente fora do escopo.

### DT-011 — Manter carteira de convênios monitorados do PROFOR 2022 em banco SQLite local

**Status:** vigente

**Decisão:** a lista de convênios acompanhados pela aplicação será mantida em banco SQLite local, não na aba Geral da planilha nem no DETRU. O número do convênio é a chave operacional principal para consultas automáticas. O usuário poderá futuramente cadastrar novos convênios diretamente na aplicação.

**Evidência:** decisão registrada em 17/05/2026 a partir de definição conceitual do projeto; o banco local (`backend/data/onasp.sqlite`) já é a camada de persistência central do projeto conforme DT-004.

**Regra conceitual obrigatória:** o DETRU não define quais convênios serão acompanhados. O DETRU é fonte de dados oficiais atualizados (especialmente `siconv_convenio.csv.zip`) sobre convênios existentes, não a carteira de acompanhamento. A carteira de acompanhamento é mantida localmente para permitir cadastro futuro de novos convênios pelo usuário.

**Fontes previstas na composição futura:**
- banco local: convênios monitorados (carteira de acompanhamento);
- DETRU (`siconv_convenio.csv.zip`): dados cadastrais e financeiros atualizados do convênio;
- Transferegov público: saldo atual de rendimentos e dados não disponíveis diretamente no DETRU;
- cálculos internos da aplicação a partir do plano de aplicação.

**Fonte transitória:** a aba Geral da planilha será tratada como origem transitória a ser substituída futuramente pela composição automática acima.

**Consequência prática:** a ativação da nova origem de dados deve ocorrer por etapas, com fallback para a origem atual (planilha). A migração deve preservar modo local/API e modo estático/GitHub Pages.

**Risco:** migrar a carteira antes de o banco estar estruturado pode quebrar a leitura atual baseada na planilha.

**Orientação de manutenção:** não criar tabela de convênios monitorados nesta etapa; registrar aqui a decisão e planejar criação da tabela em etapa posterior com schema, seed e service próprios.

## Decisões provisórias ou a revisar

### DP-001 — Ampliar testes E2E conforme estabilização de seletores

**Status:** a revisar

**Decisão:** manter os testes E2E atuais como base mínima e ampliar cobertura conforme páginas críticas ganhem seletores estáveis.

**Evidência:** `tests/e2e/app.spec.js`, `playwright.config.js` e `memoria/01_PROJETO_APLICACAO/pendencias.md`.

**Consequência prática:** a validação atual cobre carregamento e navegação básica, mas fluxos reais devem ser adicionados gradualmente.

**Risco:** tentar cobrir fluxos complexos sem seletores estáveis pode gerar testes frágeis e manutenção excessiva.

**Orientação de manutenção:** priorizar `data-testid` em telas críticas antes de ampliar E2E de edição, salvamento e publicação.

### DP-002 — Registrar ADRs apenas quando houver decisão arquitetural relevante

**Status:** provisória

**Decisão:** tratar ADRs como possibilidade futura, não como obrigação atual para toda alteração.

**Evidência:** `memoria/INDEX.md` e `memoria/01_PROJETO_APLICACAO/pendencias.md` citam `memoria/12_ADR/` como evolução planejada.

**Consequência prática:** decisões técnicas atuais ficam neste arquivo; ADRs devem ser criadas somente quando houver mudança arquitetural com impacto relevante.

**Risco:** criar ADRs para decisões pequenas pode burocratizar manutenção; deixar decisões grandes sem ADR pode perder contexto.

**Orientação de manutenção:** avaliar ADR quando houver mudança de arquitetura, persistência, publicação, autenticação, stack, integração externa ou estratégia de deploy.

## Itens ainda não decididos

- Não há decisão vigente para migrar o frontend para React, Vue, Angular, TypeScript ou outra stack de build.
- Não há decisão vigente para trocar o backend local em `http` nativo por Express, Fastify ou outro framework.
- Não há decisão confirmada de CI/CD remoto; as validações registradas são locais e baseadas em scripts do `package.json`.
- Não há decisão para tratar o SQLite local como banco de produção.
- Não há decisão para criar automaticamente arquivos ADR ou novos arquivos temáticos de memória sem tarefa específica.
- O detalhamento completo de rotas, payloads e schema do banco ainda deve ser documentado em arquivos próprios da memória quando forem preenchidos.

## Critérios para registrar nova decisão técnica

Registrar nova decisão técnica somente quando houver:

- mudança real de arquitetura, persistência, publicação, validação, segurança ou fluxo de dados;
- introdução ou remoção de dependência relevante;
- criação de nova camada, serviço estrutural, rota relevante ou modo de execução;
- alteração no comportamento entre modo local/API e modo estático;
- mudança com impacto recorrente para Codex, manutenção, commit, publicação ou rollback.

Cada nova decisão deve informar status, evidência, consequência prática, risco e orientação de manutenção.

## Histórico de atualização

- 13/05/2026 — Registro inicial das decisões técnicas com base em `AGENTS.md`, `memoria/INDEX.md`, regras do projeto, arquitetura atual, diário de bordo, `package.json`, backend, frontend, serviços, scripts de validação e hook de publicação.
- 17/05/2026 — DT-011 registrada: carteira de convênios monitorados do PROFOR 2022 em banco SQLite local; DETRU como fonte de dados, não como carteira; aba Geral como transitória.
