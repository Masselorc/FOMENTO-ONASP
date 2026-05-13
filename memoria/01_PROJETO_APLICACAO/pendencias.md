# Pendências - FOMENTO-ONASP

## Finalidade

Este arquivo organiza pendências técnicas e documentais conhecidas do projeto FOMENTO-ONASP.

Ele não é lista de bugs presumidos. Registre aqui apenas pendências evidenciadas por tarefa, diário de bordo, validação executada ou planejamento explícito da memória.

## Como atualizar este arquivo

- Diferenciar erro real, risco técnico, melhoria recomendada, melhoria opcional e pendência documental.
- Nao inventar rotas, endpoints, tabelas, colunas, UFs, processos, valores ou funcionalidades.
- Registrar pendências documentais da memória como memória/documentação, não como falha da aplicação.
- Mover itens para "Itens concluidos recentemente" somente quando houver evidencia clara no repositorio, diario ou diff.
- Manter texto curto e operacional.

## Pendências críticas

Nenhuma pendência crítica está registrada neste arquivo no momento.

Use esta seção apenas para bloqueios reais evidenciados, como indisponibilidade da aplicação, perda de dados, falha de publicação estática, regressão de regra de negócio ou risco de vazamento de informação.

## Pendências de memória e documentação

- Preencher ou consolidar `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md` com a arquitetura real do projeto.
- Preencher ou consolidar `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md` com decisões já evidenciadas.
- Preencher ou consolidar `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` com o fluxo entre planilhas, banco, API, frontend e publicacao estatica.
- Preencher ou consolidar `memoria/08_ROTAS_BANCO_API/rotas.md` com rotas reais, quando documentadas a partir do codigo.
- Preencher ou consolidar `memoria/08_ROTAS_BANCO_API/schema-banco.md` com schema real do banco, quando validado no projeto.
- Preencher ou consolidar `memoria/09_ERROS_E_CORRECOES/historico-erros.md` com erros corrigidos e respectivas evidencias.
- Preencher ou consolidar `memoria/10_TESTES/checklist-validacao.md` com checklist operacional por tipo de tarefa.
- Preencher ou consolidar `memoria/11_PROMPTS_CODEX/prompt-padrao.md` com modelo de ordem de servico tecnica para IA.
- Avaliar futura criação de ADRs em `memoria/12_ADR/` quando houver decisões arquiteturais relevantes.

## Pendências técnicas da aplicação

Nenhuma pendência técnica específica da aplicação está registrada aqui sem evidência adicional.

Quando houver novo item, registrar a pagina, rota, servico ou arquivo afetado, a evidencia observada, o impacto e a validacao esperada.

## Pendências de validação e testes

- Padronizar seletores E2E estáveis, preferencialmente `data-testid`, para cobrir fluxos críticos sem depender de texto visível ou estrutura visual.
- Ampliar testes E2E gradualmente com fluxos reais, não apenas visibilidade de views.
- Priorizar nos testes E2E: Dashboard inicial, Parâmetros Mínimos, Formalização PROFOR 2026, Orçamento 2026 e Status do Sistema.
- Validar fluxos reais de leitura, edição local quando aplicável, bloqueio em modo estático e ausência de erro crítico no console.
- Evoluir a validacao agentic conforme os seletores e fluxos ficarem mais estaveis.

## Pendências de dados e publicação estática

- Documentar critérios para quando executar `npm run publicar:dados` e quando evitar republicação.
- Documentar o uso operacional de `SKIP_PUBLICAR_DADOS=1` em commits que nao tratem de dados publicados.
- Manter monitoramento de churn indevido de timestamp em `frontend/data/publicados/*.json`.
- Documentar a relacao entre fontes locais, servicos de publicacao e JSONs publicos quando a memoria de fluxo de dados for consolidada.

## Pendências institucionais/documentais

- Manter a memória institucional apenas em Markdown tratado, sintético, operacional e não sensível.
- Não copiar documentos SEI integrais, PDFs, DOCX, XLSX, imagens, bancos, logs ou anexos brutos para a memória.
- Quando arquivos institucionais forem resumidos futuramente, registrar fonte, escopo e limitacao sem expor dado sensivel.

## Itens concluidos recentemente

- `AGENTS.md` e `memoria/INDEX.md` foram consolidados como protocolo operacional e roteador da memoria.
- Base minima de validacao agentic foi criada com scripts de validacao de JSON, sintaxe e Playwright.
- Script `validar:setup` foi adicionado para instalar Chromium do Playwright quando necessario.
- Hook de publicacao foi saneado para respeitar `SKIP_PUBLICAR_DADOS=1` e reduzir churn indevido de JSONs publicados.
- Versionamento seletivo da memoria foi orientado para preservar Markdown tratado e ignorar fontes brutas, anexos sensiveis e artefatos locais.

## Historico resumido

- A validação futura deve crescer de forma incremental, sem forçar refatoração ampla do frontend.
- A memória do projeto está em consolidação e deve diferenciar arquivos existentes, planejados e condicionais.
- Alterações documentais devem permanecer separadas de mudanças de código, dados, banco e publicação estática.
