# Pendências - FOMENTO-ONASP

## Finalidade

Este arquivo organiza pendências técnicas e documentais conhecidas do projeto FOMENTO-ONASP.

Ele não é lista de bugs presumidos. Registre aqui apenas pendências evidenciadas por tarefa, diário de bordo, validação executada ou planejamento explícito da memória.

## Como atualizar este arquivo

- Diferenciar erro real, risco técnico, melhoria recomendada, melhoria opcional e pendência documental.
- Não inventar rotas, endpoints, tabelas, colunas, UFs, processos, valores ou funcionalidades.
- Registrar pendências documentais da memória como memória/documentação, não como falha da aplicação.
- Mover itens para "Itens concluídos recentemente" somente quando houver evidência clara no repositório, diário ou diff.
- Manter texto curto e operacional.

## Pendências críticas

Nenhuma pendência crítica está registrada neste arquivo no momento.

Use esta seção apenas para bloqueios reais evidenciados, como indisponibilidade da aplicação, perda de dados, falha de publicação estática, regressão de regra de negócio ou risco de vazamento de informação.

## Pendências de memória e documentação

Pendências documentais obrigatórias deste ciclo: nenhuma.

Pendências futuras não críticas:

- Documentar funcionalidades críticas a partir de MD próprio, em ordem sugerida:
  - formalização PROFOR
  - publicação estática
  - dashboard geral
- Preencher ou consolidar `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md` com a arquitetura real do projeto.
- Preencher ou consolidar `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md` com decisões já evidenciadas.
- Preencher ou consolidar `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` com o fluxo entre planilhas, banco, API, frontend e publicação estática.
- Preencher ou consolidar `memoria/08_ROTAS_BANCO_API/rotas.md` com rotas reais, quando documentadas a partir do código.
- Preencher ou consolidar `memoria/08_ROTAS_BANCO_API/schema-banco.md` com schema real do banco, quando validado no projeto.
- Preencher ou consolidar `memoria/09_ERROS_E_CORRECOES/historico-erros.md` com erros corrigidos e respectivas evidências.
- Preencher ou consolidar `memoria/10_TESTES/checklist-validacao.md` com checklist operacional por tipo de tarefa.
- Avaliar futura criação de ADRs em `memoria/12_ADR/` quando houver decisões arquiteturais relevantes.
- Criar matriz de evidências por UF quando houver necessidade de ampliação do diagnóstico operacional.
- Criar checklist de condição suspensiva por UF se houver decisão posterior de detalhamento.
- Tratar atos normativos estaduais por UF quando houver demanda específica e fontes tratadas suficientes.
- Tratar normativos complementares ignorados por decisão operacional apenas se houver nova decisão de curadoria.

## Pendências técnicas da aplicação

Nenhuma pendência técnica específica da aplicação está registrada aqui sem evidência adicional.

Quando houver novo item, registrar a página, rota, serviço ou arquivo afetado, a evidência observada, o impacto e a validação esperada.

## Pendências de validação e testes

- Padronizar seletores E2E estáveis, preferencialmente `data-testid`, para cobrir fluxos críticos sem depender de texto visível ou estrutura visual.
- Ampliar testes E2E gradualmente com fluxos reais, não apenas visibilidade de views.
- Priorizar nos testes E2E: Dashboard inicial, Parâmetros Mínimos, Formalização PROFOR 2026, Orçamento 2026 e Status do Sistema.
- Validar fluxos reais de leitura, edição local quando aplicável, bloqueio em modo estático e ausência de erro crítico no console.
- Evoluir a validação agentic conforme os seletores e fluxos ficarem mais estáveis.

## Pendências de dados e publicação estática

- Documentar critérios para quando executar `npm run publicar:dados` e quando evitar republicação.
- Documentar o uso operacional de `SKIP_PUBLICAR_DADOS=1` em commits que não tratem de dados publicados.
- Manter monitoramento de churn indevido de timestamp em `frontend/data/publicados/*.json`.
- Documentar a relação entre fontes locais, serviços de publicação e JSONs públicos quando a memória de fluxo de dados for consolidada.

## Pendências institucionais/documentais

- Manter a memória institucional apenas em Markdown tratado, sintético, operacional e não sensível.
- Não copiar documentos SEI integrais, PDFs, DOCX, XLSX, imagens, bancos, logs ou anexos brutos para a memória.
- Quando arquivos institucionais forem resumidos futuramente, registrar fonte, escopo e limitação sem expor dado sensível.

## Itens concluídos recentemente

- `AGENTS.md` e `memoria/INDEX.md` foram consolidados como protocolo operacional e roteador da memória.
- Base mínima de validação agentic foi criada com scripts de validação de JSON, sintaxe e Playwright.
- Script `validar:setup` foi adicionado para instalar Chromium do Playwright quando necessário.
- Hook de publicação foi saneado para respeitar `SKIP_PUBLICAR_DADOS=1` e reduzir churn indevido de JSONs publicados.
- Versionamento seletivo da memória foi orientado para preservar Markdown tratado e ignorar fontes brutas, anexos sensíveis e artefatos locais.
- A etapa de documento local para instruções de IA foi retirada da trilha operacional da memória por decisão do usuário; esse material será elaborado externamente no ChatGPT web.
- `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md` foi consolidado como referência institucional operacional.
- `memoria/03_NORMATIVOS/index-normativos.md` foi consolidado como mapa normativo operacional.
- `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md` foi consolidado como memória operacional do recorte Pena Justa/ouvidorias.
- `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md` foi consolidado como visão geral operacional do PROFOR/ONASP.
- `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md` foi consolidado como índice operacional das UFs.
- `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md` foi consolidado como checklist operacional dos parâmetros mínimos das ouvidorias.
- `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md` foi criado como estrutura inicial da documentação técnica por funcionalidade.
- `memoria/01_PROJETO_APLICACAO/funcionalidades/_modelo-funcionalidade.md` foi criado como modelo padrão para documentos de funcionalidade.
- `memoria/01_PROJETO_APLICACAO/funcionalidades/parametros-minimos.md` foi criado como documentação técnica da funcionalidade Parâmetros Mínimos.
- `memoria/01_PROJETO_APLICACAO/funcionalidades/orcamento-2026.md` foi criado como documentação técnica da funcionalidade Orçamento 2026.
- Etapa 7 (13/05/2026): botão e modal "Alocar saldo" implementados no frontend do Orçamento 2026 — `frontend/js/app.js` e `frontend/css/app.css`; consumo da rota `POST /api/orcamento-2026/saldos/alocar` e `GET /api/orcamento-2026/movimentacoes`; sem alteração de backend, banco ou JSONs publicados.
- Etapa 8 (13/05/2026): helper `calcularResumoSaldoVisualOrcamento` criado; envelope visual ajustado e detalhe discreto (Orig./Rec./Ced./Vinc.) exibidos na coluna "Valor previsto" do pai e filho; botão "Alocar saldo" oculto quando saldo transferível estimado ≤ 0; modal atualizado para usar helper; sem alteração de backend, banco ou JSONs publicados.

## Histórico resumido

- A validação futura deve crescer de forma incremental, sem forçar refatoração ampla do frontend.
- A memória do projeto está em consolidação e deve diferenciar arquivos existentes, planejados e condicionais.
- Alterações documentais devem permanecer separadas de mudanças de código, dados, banco e publicação estática.
