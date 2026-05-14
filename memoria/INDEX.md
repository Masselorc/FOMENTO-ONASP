# Índice da memória operacional

Este arquivo é o roteador da memória operacional do FOMENTO-ONASP. Ele orienta quais notas Markdown consultar antes de trabalhar no projeto, sem substituir a leitura dos arquivos reais do repositório.

## Regra central

- Não ler toda a pasta `memoria/` por padrão.
- Ler `AGENTS.md`, este `memoria/INDEX.md`, os arquivos de memória existentes indicados para a tarefa e os arquivos reais afetados.
- Para arquivos planejados ainda inexistentes, usar somente quando existirem.
- Não criar automaticamente arquivos temáticos da memória.
- Não inventar rotas, tabelas, colunas, endpoints, UFs, valores, processos, dados ou fundamentos normativos.
- Preservar a diferença entre modo local/API e modo estático/GitHub Pages.

## Estado atual da memória

Base inicial existente:

- `AGENTS.md`
- `memoria/INDEX.md`
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`

Arquivos temáticos existentes nesta árvore:

- `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`
- `memoria/01_PROJETO_APLICACAO/pendencias.md`
- `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`
- `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`
- `memoria/02_ONASP_INSTITUCIONAL/visao-geral-onasp.md`
- `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`
- `memoria/02_ONASP_INSTITUCIONAL/glossario-institucional.md`
- `memoria/03_NORMATIVOS/index-normativos.md`
- `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`
- `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`
- `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`
- `memoria/07_DADOS_E_PLANILHAS_TRATADAS/dicionario-de-dados.md`
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`
- `memoria/09_ERROS_E_CORRECOES/historico-erros.md` — base de erros reais, correções aplicadas, riscos recorrentes, boas práticas e lições exportáveis.
- `memoria/10_TESTES/checklist-validacao.md`

Arquivos ou pastas planejados para evolução futura:

- `memoria/12_ADR/`, quando existir.

Pastas de fontes tratadas criadas:

- `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/`
- `memoria/03_NORMATIVOS/fontes-tratadas/`
- `memoria/04_PENA_JUSTA/fontes-tratadas/`
- `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/`
- `memoria/06_UFS_OUVIDORIAS/fontes-tratadas/`
- `memoria/07_DADOS_E_PLANILHAS_TRATADAS/fontes-tratadas/`

Nota operacional: instruções e prompts para Codex/IA são elaborados externamente na versão web do ChatGPT, não como arquivo de memória deste repositório.

## Curadoria de fontes

A memória do projeto utiliza fichamentos técnicos e Markdown tratado como camada principal de trabalho.

Antes de consolidar memória institucional, normativa, Pena Justa, PROFOR, UFs ou dados, devem ser produzidos fichamentos, extratos normativos, notas de leitura técnica, dicionários de dados ou notas metodológicas nas respectivas pastas `fontes-tratadas/`.

O documento original deve permanecer rastreável a partir do fichamento. O Markdown tratado não substitui o original para citação formal, conferência literal, fundamento jurídico, dado sensível ou validação de versão.

## Modelos de fichamento técnico

A pasta `memoria/00_MODELOS/` reúne os modelos oficiais de fichamento técnico usados na curadoria documental do projeto.

Modelos disponíveis:

- `memoria/00_MODELOS/modelo-fichamento-institucional.md`
- `memoria/00_MODELOS/modelo-extrato-normativo.md`
- `memoria/00_MODELOS/modelo-nota-leitura-tecnica.md`
- `memoria/00_MODELOS/modelo-dicionario-dados.md`
- `memoria/00_MODELOS/modelo-nota-metodologica-base.md`

Esses modelos devem orientar a produção dos Markdown tratados nas pastas `fontes-tratadas/`.

## Estrutura planejada

- `00_DIARIO_DE_BORDO`
- `01_PROJETO_APLICACAO`
- `02_ONASP_INSTITUCIONAL`
- `03_NORMATIVOS`
- `04_PENA_JUSTA`
- `05_PROFOR_CONVENIOS`
- `06_UFS_OUVIDORIAS`
- `07_DADOS_E_PLANILHAS_TRATADAS`
- `08_ROTAS_BANCO_API`
- `09_ERROS_E_CORRECOES` — Erros, Correções e Boas Práticas
- `10_TESTES`
- `12_ADR`, quando existir

## Mapa técnico atual

- `package.json`: scripts de execução, banco, importação, publicação, hooks e validação.
- `backend/server.js`: servidor HTTP local, rotas de API e entrega de arquivos estáticos.
- `backend/db/`: preparação e acesso ao banco local.
- `backend/services/`: leitura, normalização, persistência, histórico, exportação e publicação.
- `backend/services/data-service.js`: camada de obtenção e fallback de dados para a aplicação.
- `backend/services/static-publication-service.js`: geração dos JSONs públicos.
- `frontend/js/app.js`: arquivo principal da SPA.
- `frontend/css/app.css`: estilos principais da aplicação.
- `frontend/data/publicados/`: JSONs públicos usados no modo estático/GitHub Pages.
- `Planilhas/`: bases de origem usadas no ambiente local.

## Scripts conhecidos

- `npm start`
- `npm run init-db`
- `npm run import:parametros-minimos`
- `npm run publicar:dados`
- `npm run setup:hooks`
- `npm run validar:json`
- `npm run validar:syntax`
- `npm run validar:agente`
- `npm run validar:setup`

## Roteiros por tarefa

Alteração geral de código:

- Ler `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, quando existir.
- Ler `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, quando existir.
- Ler os arquivos reais afetados e suas referências com busca no repositório.

Correção de bug:

- Ler `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, quando existir, para consultar erros reais, correções aplicadas, riscos recorrentes, boas práticas e lições exportáveis.
- Ler `memoria/01_PROJETO_APLICACAO/pendencias.md`, quando existir.
- Reproduzir o comportamento ou localizar a evidência no código antes de corrigir.

Frontend, UX, responsividade e acessibilidade:

- Ler `frontend/js/app.js` e `frontend/css/app.css`.
- Ler `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, quando existir.
- Preservar modo local/API e modo estático.
- Validar console do navegador, responsividade e acessibilidade básica quando a mudança afetar interface.

Backend, API local e rotas:

- Ler `backend/server.js`.
- Ler serviços em `backend/services/` diretamente relacionados.
- Ler `memoria/08_ROTAS_BANCO_API/rotas.md`, quando existir.
- Validar com `npm start` e chamadas ao endpoint quando aplicável.

Banco de dados:

- Ler `backend/db/`.
- Ler `memoria/08_ROTAS_BANCO_API/schema-banco.md`, quando existir.
- Não versionar `backend/data/onasp.sqlite`.
- Prever backup e rollback antes de alteração estrutural.

Publicação estática e GitHub Pages:

- Ler `backend/services/static-publication-service.js`.
- Ler `backend/services/dashboard-publication-service.js`, quando afetado.
- Ler `frontend/data/publicados/` apenas para conferir o resultado esperado.
- Rodar `npm run publicar:dados` somente quando a tarefa exigir regeneração de JSONs.
- Evitar churn de timestamp em commits de documentação, testes, infraestrutura ou validação.

Orçamento 2026:

- Ler `backend/services/orcamento-2026-service.js`.
- Ler `frontend/js/app.js` nas funções da página.
- Ler `frontend/data/publicados/orcamento-2026.json` quando a mudança afetar publicação.
- Preservar edição no modo local/API e somente leitura no modo estático.

Formalização PROFOR:

- Ler `backend/services/formalizacao-profor-service.js`.
- Ler `frontend/js/app.js` nas funções da página.
- Ler `frontend/data/publicados/formalizacao-profor.json` quando a mudança afetar publicação.
- Conferir `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, quando existir.

Parâmetros Mínimos:

- Ler `backend/services/parametros-minimos-service.js`.
- Ler `frontend/js/app.js` nas funções da rota `diagnostico-ouvidorias`.
- Ler `frontend/data/publicados/parametros-minimos.json` quando a mudança afetar publicação.
- Manter o nome visível `Parâmetros Mínimos`, sem renomear chave interna de rota sem pedido explícito.

Dados, planilhas, importações e dashboards:

- Ler `memoria/07_DADOS_E_PLANILHAS_TRATADAS/dicionario-de-dados.md`, quando existir.
- Ler serviços de importação, normalização e publicação diretamente relacionados.
- Não inventar métricas, valores, UFs, processos ou bases.
- Calcular apenas a partir das fontes reais fornecidas ou integradas.

Git, branch, PR, merge e rollback:

- Conferir `git status` antes de alterar.
- Separar alterações de código, dados publicados e memória quando o escopo exigir.
- Não usar reset destrutivo sem autorização expressa.
- Evitar acionar publicação automática em commits que não tratem de dados.

Texto institucional, despacho, parecer, edital ou nota técnica:

- Ler `memoria/02_ONASP_INSTITUCIONAL/visao-geral-onasp.md`, quando existir.
- Ler `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, quando existir.
- Ler `memoria/03_NORMATIVOS/index-normativos.md`, quando existir.
- Usar documentos normativos ou institucionais reais; não inventar fundamento.

PROFOR, convênios e formalização de instrumentos:

- Ler `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, quando existir.
- Ler dados e serviços reais relacionados ao fluxo.
- Preservar distinção entre planejamento, formalização, execução e publicação.

## Modelo de diário de bordo

Quando o diário existir e a tarefa permitir atualizá-lo, registrar:

- data;
- branch;
- tarefa;
- arquivos alterados;
- problema;
- correção;
- validações;
- resultado;
- pendências;
- risco de regressão;
- rollback.

## Critério de aceite da memória

A memória está adequada quando permite que um agente de IA:

- entenda o estado atual do projeto sem inventar contexto;
- saiba quais arquivos ler por tipo de tarefa;
- não invente arquivos, dados, rotas, tabelas, colunas ou fundamentos;
- preserve segurança, sigilo e versionamento seletivo;
- respeite modo local/API e modo estático/GitHub Pages;
- registre alterações relevantes no diário de bordo quando aplicável;
- reduza retrabalho e perda de contexto.
