# Funcionalidade: Parâmetros Mínimos

## Instruções de uso deste documento

Este MD é a primeira leitura para tarefas sobre Parâmetros Mínimos.

Ele orienta leitura mínima, escopo técnico e pontos de validação. Não substitui o código, nem substitui a validação no navegador, na API, no banco ou nos JSONs publicados.

Quando a funcionalidade mudar, este documento deve ser revisado junto com os arquivos técnicos afetados.

Se alguma informação não puder ser confirmada por memória ou código, registre `Não identificado ainda.`. Se não se aplicar, registre `Não aplicável.`.

## Identificação da funcionalidade

| Campo | Valor |
| --- | --- |
| Nome da funcionalidade | Parâmetros Mínimos |
| Arquivo deste documento | `memoria/01_PROJETO_APLICACAO/funcionalidades/parametros-minimos.md` |
| Status do documento | validado |
| Última revisão | `16/05/2026` |
| Responsável pela revisão | Codex / inspeção técnica controlada |
| Funcionalidade crítica? | sim |
| Requer atualização quando alterar código? | sim |

## 1. Spec — Especificação funcional

### 1.1. Problema do usuário

O usuário precisa consultar, editar, salvar, reverter e exportar o diagnóstico de Parâmetros Mínimos sem varrer manualmente o projeto inteiro.

### 1.2. Objetivo da funcionalidade

Consolidar, por UF, o diagnóstico de parâmetros mínimos das ouvidorias de serviços penais, com leitura local/API, fallback para JSON publicado, edição controlada por senha, histórico e exportação Excel.

### 1.3. Perfil de usuário e uso esperado

Usuário interno da aplicação, com perfil operacional ou técnico, que precisa avaliar a situação dos parâmetros mínimos, registrar ajustes e revisar histórico com rastreabilidade.

### 1.4. Escopo incluído

- Visualização da página `diagnostico-ouvidorias`.
- Leitura de dados pela API local ou pelo JSON publicado.
- Edição controlada de status e quantidades.
- Salvamento com senha.
- Reversão de histórico.
- Exportação para Excel.
- Diagnóstico resumido por UF.

### 1.5. Fora do escopo

- Não inclui validação jurídica integral da situação de cada UF.
- Não inclui criação de outras áreas da aplicação.
- Não inclui inspeção completa de todos os consolidados institucionais.
- Não inclui alteração de dados sem inspeção real do código e da memória.

### 1.6. Regras de negócio

- O serviço normaliza status de parâmetro mínimo antes de persistir e antes de exportar.
- Parâmetros quantitativos aceitam `quantidadeAtual` e `quantidadeIdeal` quando esses valores são válidos e não negativos.
- Salvar e reverter exigem senha válida.
- Não há salvamento quando não existem alterações.
- O histórico é registrado em `historico_alteracoes`.
- A reversão usa o valor anterior do histórico e registra nova trilha.
- Em modo estático/publicação, a tela opera em leitura controlada.
- A exportação deve refletir os dados salvos; se houver alterações pendentes, a interface bloqueia a exportação.

### 1.7. Critérios de aceite funcionais

- A tela carrega dados da API local quando disponível.
- Se a API não estiver disponível, a tela usa o JSON publicado.
- O usuário consegue editar parâmetros mínimos permitidos pela interface.
- O usuário consegue salvar com senha válida.
- O usuário consegue reverter entradas de histórico válidas.
- O usuário consegue exportar o diagnóstico para Excel.
- A interface mostra erro amigável quando os dados não carregam.

## 2. Plan — Planejamento técnico

### 2.1. Arquivos front-end relacionados

| Camada | Arquivo | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| front-end | `frontend/js/app.js` | Renderiza `diagnostico-ouvidorias`, controla edição, histórico, salvamento e exportação | Principal ponto de interação |
| front-end | `frontend/js/core/view-errors.js` | Mostra mensagem de erro para falha de carregamento | Inclui referência a `parametros-minimos.json` |
| front-end | `tests/e2e/app.spec.js` | Valida a abertura da view e o comportamento em modo estático | Cobertura funcional existente |

### 2.2. Arquivos back-end relacionados

| Camada | Arquivo | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| back-end | `backend/server.js` | Expõe as rotas da funcionalidade | Roteamento HTTP principal |
| serviço | `backend/services/parametros-minimos-service.js` | Lista, salva, reverte e monta o diagnóstico | Serviço central |
| configuração | `backend/services/parametros-minimos-config.js` | Define parâmetros, status e normalização | Base de regra operacional |
| serviço | `backend/services/data-service.js` | Carrega dados da API local ou do JSON publicado | Faz fallback para publicação estática |
| serviço | `backend/services/excel-export-service.js` | Exporta a planilha de validação | Gera XLSX |
| serviço | `backend/services/static-publication-service.js` | Publica `parametros-minimos.json` | Integra a publicação estática |
| banco | `backend/db/init-db.js` | Cria tabelas e colunas da base | Schema local |
| banco | `backend/db/preparar-banco.js` | Garante importação e atualização inicial | Executado na preparação do banco |
| script | `backend/scripts/importar-parametros-minimos.js` | Importa base de planilhas para SQLite | Fonte inicial de carga |
| validação | `scripts/validar-json-publicados.js` | Valida o JSON publicado da funcionalidade | Proteção de publicação |
| teste | `tests/services/validacoes-services.test.js` | Confirma rejeição por senha inválida | Cobertura de contrato |

### 2.3. Rotas/API relacionadas

| Método | Rota | Arquivo/função responsável | Entrada esperada | Saída esperada | Observação |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/parametros-minimos` | `backend/server.js` -> `listarParametrosMinimos()` | Não aplicável | JSON com diagnóstico consolidado | Fonte principal de leitura |
| POST | `/api/parametros-minimos/salvar` | `backend/server.js` -> `salvarParametrosMinimos()` | `password` e `changes` | `success`, `message`, `updatedAt`, `backupPath` | Exige senha |
| GET | `/api/parametros-minimos/historico` | `backend/server.js` -> `listarHistoricoParametrosMinimos()` | Não aplicável | `historico` | Limite técnico de 200 registros |
| POST | `/api/parametros-minimos/historico/reverter` | `backend/server.js` -> `reverterHistoricoParametrosMinimos()` | `password` e `historicoId` | `success`, `message`, `updatedAt`, `backupPath` | Exige senha |
| GET | `/api/parametros-minimos/exportar` | `backend/server.js` -> `exportarParametrosMinimosExcel()` | Não aplicável | Arquivo XLSX | Download da planilha |

### 2.4. Serviços, controllers ou módulos envolvidos

| Camada | Arquivo | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| serviço | `backend/services/parametros-minimos-service.js` | Monta `respostas`, `resumo`, `diagnostico`, `faltasParametrosMinimos` e `providenciasParametrosMinimos` | Agrupado por UF |
| serviço | `backend/services/parametros-minimos-service.js` | Salva alterações com backup e histórico | Usa `criarBackupBanco()` e `registrarHistorico()` |
| serviço | `backend/services/parametros-minimos-service.js` | Reverte histórico por `historicoId` | Valida UF, campo e valor anterior |
| serviço | `backend/services/data-service.js` | Normaliza resposta publicada e define modo `api` ou `estatico` | Usa `carregarJsonPublicadoPorChave()` |
| serviço | `backend/services/static-publication-service.js` | Escreve `parametros-minimos.json` e `resumo-publicacao.json` | Parte do fluxo de publicação estática |
| serviço | `backend/services/excel-export-service.js` | Formata exportação para Excel | Usa `PARAMETROS_MINIMOS` e normalização de status |

### 2.5. Banco de dados relacionado

| Tabela | Coluna/campo | Uso na funcionalidade | Risco | Observação |
| --- | --- | --- | --- | --- |
| `parametros_minimos` | `uf` | Agrupa a resposta por UF | Baixo | Chave operacional da consulta |
| `parametros_minimos` | `parametro` | Identifica cada parâmetro mínimo | Baixo | Relacionado ao catálogo de parâmetros |
| `parametros_minimos` | `status` | Guarda o status operacional | Médio | Exige normalização |
| `parametros_minimos` | `quantidade_atual` | Guarda o quantitativo atual | Médio | Aplicável aos itens quantitativos |
| `parametros_minimos` | `quantidade_ideal` | Guarda o quantitativo ideal | Médio | Aplicável aos itens quantitativos |
| `parametros_minimos` | `resposta_original` | Preserva a resposta bruta/formatada | Médio | Ajuda a rastrear origem |
| `parametros_minimos` | `atualizado_em` | Marca atualização da linha | Baixo | Usado na auditoria visual |
| `historico_alteracoes` | `pagina`, `registro`, `campo`, `valor_anterior`, `valor_novo`, `alterado_em` | Registra alterações e reversões | Médio | Histórico compartilhado entre páginas |

### 2.6. JSONs publicados e modo estático

| JSON | Origem | Consumidor | Quando é atualizado | Risco |
| --- | --- | --- | --- | --- |
| `frontend/data/publicados/parametros-minimos.json` | `backend/services/static-publication-service.js` via `listarParametrosMinimos()` | `backend/services/data-service.js` e `frontend/js/app.js` | Na publicação estática | Médio |
| `frontend/data/publicados/resumo-publicacao.json` | Publicação estática consolidada | Tela de status/publicação | A cada publicação | Baixo |

### 2.7. Dependências e imports relevantes

| Camada | Arquivo | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| módulo | `backend/services/parametros-minimos-config.js` | Normalização de status e catálogo de parâmetros | Base lógica da funcionalidade |
| módulo | `backend/services/backup-service.js` | Gera backup antes de salvar/reverter | Suporte ao rollback |
| módulo | `backend/services/historico-service.js` | Registra histórico de alteração | Rastreamento documental |
| módulo | `backend/services/auth-service.js` | Valida senha de edição | Proteção de escrita |
| módulo | `xlsx` | Geração da planilha exportada | Dependência de exportação |
| módulo | `tests/e2e/app.spec.js` | Cobertura de interface e modo estático | Validação end-to-end |
| módulo | `scripts/validar-json-publicados.js` | Validação estrutural do JSON publicado | Protege publicação |

## 3. Research — Decisões, fundamentos e restrições

### 3.1. Decisões técnicas já identificadas

- A funcionalidade tem serviço dedicado em `backend/services/parametros-minimos-service.js`.
- A leitura prioriza API local e recorre ao JSON publicado quando necessário.
- O frontend usa a view `diagnostico-ouvidorias` como porta de entrada visual.
- O salvamento e a reversão exigem senha.
- O fluxo de publicação estática inclui `parametros-minimos.json`.

### 3.2. Fundamentos institucionais ou normativos relacionados

- A IN GABSEC/SENAPPEN/MJSP nº 75/2026 é a referência técnica central para os parâmetros mínimos.
- O checklist de parâmetros mínimos consolida critérios operacionais e cautelas de evidência.
- O índice de UFs deixa claro que estrutura formal não prova funcionamento efetivo.
- O recorte PROFOR/ONASP é relacionado, mas não substitui a evidência documental por UF.

### 3.3. Restrições técnicas

- Não presumir que uma UF está funcional apenas por ter estrutura relacionada.
- Não presumir conformidade integral com a IN nº 75/2026 sem evidência documental.
- Não editar sem senha.
- Não exportar com alterações pendentes.
- Não tratar o JSON publicado como fonte de edição manual.

### 3.4. Limites de conhecimento

- Não identificado ainda o grau de cobertura de acessibilidade formal da tela.
- Não identificado ainda se há outros consumidores externos do JSON publicado fora do próprio app.
- Não identificado ainda se existem fluxos de importação adicionais além do script localizado.

## 4. Fluxo de dados

### 4.1. Origem dos dados

1. Carga inicial por importação das planilhas referenciadas pelo script `backend/scripts/importar-parametros-minimos.js`.
2. Base persistida na tabela `parametros_minimos`.
3. Publicação estática em `frontend/data/publicados/parametros-minimos.json`.

### 4.2. Entrada pela interface

- O usuário abre `diagnostico-ouvidorias`.
- A tela carrega os dados por `carregarDadosDiagnosticoOuvidorias()`.
- O usuário pode alternar edição, abrir histórico, salvar ou exportar.

### 4.3. Validação no front-end

- O frontend mantém alterações pendentes em memória.
- O botão de exportação bloqueia quando há alterações não salvas.
- Em modo estático, a tela vira leitura controlada.

### 4.4. Requisição à API

- Leitura: `GET /api/parametros-minimos`.
- Salvamento: `POST /api/parametros-minimos/salvar`.
- Histórico: `GET /api/parametros-minimos/historico`.
- Reversão: `POST /api/parametros-minimos/historico/reverter`.
- Exportação: `GET /api/parametros-minimos/exportar`.

### 4.5. Validação no back-end

- A senha é validada antes de salvar ou reverter.
- O payload precisa ser um objeto plano.
- Status inválidos são rejeitados.
- Quantidades negativas ou não finitas são rejeitadas para parâmetros quantitativos.
- UF inválida é rejeitada na reversão.

### 4.6. Persistência no banco

- O serviço salva linhas em `parametros_minimos`.
- O histórico é gravado em `historico_alteracoes`.
- O salvamento gera backup antes da escrita.
- A reversão também gera backup antes da escrita.

### 4.7. Publicação estática, se houver

- `publicarDadosEstaticos()` escreve `parametros-minimos.json`.
- O resumo de publicação inclui esse arquivo.
- Em modo estático, o frontend lê o JSON publicado em vez da API.

### 4.8. Exibição ao usuário

- A interface mostra o diagnóstico consolidado por UF.
- A view de erro informa falha de carregamento com referência a `parametros-minimos.json`.
- A exportação produz planilha XLSX.

## 5. Estados da interface e experiência do usuário

### 5.1. Estados esperados da tela

| Estado | Evidência | Observação |
| --- | --- | --- |
| carregando | mensagem `Carregando Parâmetros Mínimos...` | Estado transitório |
| conteúdo carregado | `renderDiagnosticoOuvidoriasView()` | Estado normal |
| modo estático | `dadosPaginaEmModoEstatico('parametrosMinimos')` | Leitura controlada |
| edição ativa | `parametrosMinimosModoEdicao` e `parametrosMinimosEditorAtivo` | Permite alteração pontual |
| histórico | modal de histórico | Permite reversão |
| erro de carregamento | `frontend/js/core/view-errors.js` | Mensagem amigável |

### 5.2. Mensagens de sucesso, erro e vazio

- Sucesso: `Alterações salvas com sucesso.` e `Alteração revertida com sucesso.`.
- Erro: `Não foi possível salvar...`, `Não foi possível reverter...`, `Não foi possível carregar Parâmetros Mínimos.`.
- Vazio: não identificado ainda uma tela vazia exclusiva; a view usa carregamento, conteúdo ou erro.

### 5.3. Responsividade

- Há cobertura E2E de navegabilidade da view em perfis de tela menores, mas a auditoria visual completa não foi feita nesta etapa.

### 5.4. Acessibilidade

- Há uso de `aria-label` em ações de edição.
- A cobertura de acessibilidade formal completa não foi identificada ainda.

### 5.5. Pontos de atenção de UX

- Não permitir exportação com alterações pendentes.
- Manter clara a distinção entre leitura e edição.
- Deixar evidente quando a tela está em modo estático.
- Evitar que a reversão seja acionada sem confirmação explícita.

## 6. Validação e tratamento de erros

### 6.1. Validações obrigatórias

- Senha obrigatória para salvar e reverter.
- UF válida na reversão.
- Status válido por parâmetro.
- Quantidades válidas, finitas e não negativas quando aplicável.
- Changes precisa ser objeto plano.

### 6.2. Erros esperados

| Situação | Resposta observada | Classificação |
| --- | --- | --- |
| senha inválida | falha com mensagem específica | risco provável |
| alteração vazia | falha com mensagem específica | melhoria recomendada |
| histórico inválido | falha com mensagem específica | erro real tratado |
| UF inválida | falha com mensagem específica | erro real tratado |
| status inválido | falha com mensagem específica | erro real tratado |
| API indisponível | fallback para JSON publicado | risco provável |

### 6.3. Respostas HTTP esperadas

| Rota | Código esperado | Observação |
| --- | --- | --- |
| GET `/api/parametros-minimos` | 200 | Leitura consolidada |
| POST `/api/parametros-minimos/salvar` | 200 ou 400 | Depende da validação |
| GET `/api/parametros-minimos/historico` | 200 | Retorna histórico |
| POST `/api/parametros-minimos/historico/reverter` | 200 ou 400 | Depende da validação |
| GET `/api/parametros-minimos/exportar` | 200 | Retorna XLSX |

### 6.4. Logs e diagnóstico

- `console.warn` é usado quando a API local está indisponível e o sistema tenta o JSON publicado.
- O carregamento publicado também pode registrar aviso ao normalizar dados.

### 6.5. Falhas que não devem ser silenciadas

- Falha de senha.
- Falha de validação de payload.
- Falha de reversão de histórico.
- Falha de exportação.
- Falha de carregamento com ausência de fallback válido.

## 7. Segurança e proteção de dados

### 7.1. Dados sensíveis ou administrativos

- Não identificado ainda o uso de dados pessoais sensíveis nesta funcionalidade.
- Há dados administrativos e de diagnóstico que exigem cuidado operacional.

### 7.2. Validação de entrada

- A entrada é validada no serviço antes da persistência.
- O frontend bloqueia exportação quando há alterações não salvas.

### 7.3. Autorização e exposição indevida

- Escrita protegida por senha.
- A publicação estática deve ser tratada como leitura pública controlada.
- Não expor em front-end dados que dependam de credencial de edição.

### 7.4. Riscos de XSS, SQL injection ou vazamento

- O uso de dados renderizados deve manter escaping adequado.
- O banco recebe escrita parametrizada pelo serviço.
- Não editar JSON publicado manualmente fora do fluxo de publicação.

### 7.5. Cuidados com JSONs publicados

- Não alterar JSON publicado sem publicação consciente.
- Não confundir leitura do JSON com fonte de edição.
- Confirmar se a publicação precisa refletir a última escrita no banco.

## 8. Performance e manutenibilidade

### 8.1. Pontos de custo computacional

- Leitura consolidada por UF.
- Geração de exportação XLSX.
- Normalização de dados na leitura publicada.

### 8.2. Riscos de consultas ou renderizações custosas

- Reprocessar toda a lista de parâmetros a cada atualização pode custar mais quando a base crescer.
- Exportações em planilhas grandes podem aumentar o tempo de resposta.

### 8.3. Acoplamentos relevantes

- `app.js` depende do contrato da API e do JSON publicado.
- `data-service.js` depende do formato retornado pelo serviço e pelo JSON.
- `static-publication-service.js` depende do formato consolidado do serviço.

### 8.4. Oportunidades de simplificação

- Centralizar contratos em um único serviço de domínio.
- Evitar duplicação de regras entre frontend, serviço e publicação.
- Manter o catálogo de parâmetros em um ponto único de verdade.

## 9. Tasks — Microtarefas típicas

### 9.1. Alteração simples de campo

- Ajustar rótulo exibido.
- Ajustar texto auxiliar.
- Ajustar status permitido.

### 9.2. Alteração de regra de negócio

- Ajustar cálculo de status.
- Ajustar validação de quantidade.
- Ajustar condição de exportação.

### 9.3. Alteração de layout ou componente

- Ajustar cards, tabela, badges ou modal da view.
- Ajustar estado de leitura/edição.

### 9.4. Alteração de rota/API

- Ajustar rota de leitura, salvamento, histórico, reversão ou exportação.

### 9.5. Alteração de banco/schema

- Incluir ou ajustar coluna em `parametros_minimos`.
- Revisar impacto em `historico_alteracoes`.

### 9.6. Alteração de publicação estática

- Revisar `parametros-minimos.json`.
- Revisar `resumo-publicacao.json`.

### 9.7. Atualização documental obrigatória

- Atualizar este MD.
- Atualizar `fluxo-dados.md`, `rotas.md`, `schema-banco.md`, `historico-erros.md`, `checklist-validacao.md`, `pendencias.md` e `diario-atual.md` quando a mudança exigir.

## 10. Test Plan — Plano de teste

### 10.1. Testes manuais da interface

- Abrir `diagnostico-ouvidorias`.
- Confirmar carregamento com API local.
- Confirmar fallback publicado quando a API falhar.
- Editar um parâmetro permitido.
- Salvar com senha válida.
- Reabrir histórico.
- Reverter um item válido.

### 10.2. Testes de API

- GET da lista consolidada.
- POST de salvamento com senha inválida.
- POST de reversão com histórico inválido.
- GET de exportação.

### 10.3. Testes de banco de dados

- Confirmar escrita em `parametros_minimos`.
- Confirmar gravação em `historico_alteracoes`.
- Confirmar preservação de `resposta_original`.

### 10.4. Testes de modo estático

- Confirmar leitura do `parametros-minimos.json`.
- Confirmar bloqueio de escrita em modo estático.

### 10.5. Testes de responsividade

- Validar a view em viewport reduzida e intermediária.

### 10.6. Testes de acessibilidade básica

- Confirmar foco e nomes acessíveis em ações principais.
- Confirmar leitura adequada de mensagens de erro.

### 10.7. Verificação de console e logs

- Confirmar ausência de erro não tratado no console.
- Confirmar apenas warnings esperados quando houver fallback.

### 10.8. Checklist antes do commit

- Confirmar escopo.
- Conferir `git status --short`.
- Conferir diff.
- Conferir validação local.
- Atualizar o MD se houve mudança relevante.

## 11. Riscos conhecidos

| Classificação | Risco | Evidência | Impacto | Mitigação |
| --- | --- | --- | --- | --- |
| risco provável | fallback estático mascarar indisponibilidade da API local | `data-service.js` usa fallback para JSON publicado | leitura desatualizada | validar publicação e origem antes de aceitar o dado |
| risco provável | exportação refletir estado anterior quando há alterações pendentes | frontend bloqueia exportação, mas a regra precisa ser mantida | planilha inconsistente | preservar bloqueio e revisar após mudanças |
| risco provável | inferir situação de UF sem evidência documental | memória de UFs e checklist exigem prova própria | conclusão incorreta | usar `Não identificado ainda.` quando faltar evidência |
| melhoria recomendada | duplicação de regra entre serviço, frontend e publicação | vários módulos tocam o mesmo contrato | manutenção mais cara | centralizar contrato e evitar lógica duplicada |
| refatoração estética | ajustes de layout da view sem efeito funcional | interface de diagnóstico pode receber refinamento visual | baixo | manter separado de mudança funcional |

## 12. Como alterar esta funcionalidade com segurança

1. Ler `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`.
2. Ler este MD.
3. Confirmar os arquivos-alvo reais no código.
4. Conferir `git status --short`.
5. Alterar o mínimo necessário.
6. Validar localmente a leitura, o salvamento, o histórico, a reversão e a exportação, conforme o caso.
7. Atualizar este MD se a alteração afetar rota, banco, JSON, regra, fluxo ou teste.
8. Validar diff antes de registrar a mudança.
9. Usar mensagem de commit objetiva.
10. Prever rollback antes de sincronizar.

## 13. O que não fazer

- Não varrer o projeto inteiro sem necessidade.
- Não alterar banco sem backup/rollback.
- Não alterar JSON publicado sem escopo claro.
- Não alterar rotas sem conferir consumidores.
- Não alterar schema sem avaliar impacto.
- Não inventar dados, critérios, UFs, indicadores ou status.
- Não presumir situação real de UF sem evidência.
- Não alterar checklist institucional sem fonte.
- Não misturar refatoração estética com correção funcional.
- Não criar dependência nova sem justificativa.

## 14. Rollback

| Tipo de alteração | Estratégia de rollback | Observação |
| --- | --- | --- |
| documento | `git revert <hash>` ou restauração seletiva | Reverte apenas o MD |
| front-end | restaurar `frontend/js/app.js` e arquivos correlatos | Validar a view após voltar |
| back-end | restaurar `backend/server.js` e services afetados | Revisar rotas e resposta HTTP |
| banco/schema | restaurar schema/migração e backup da base | Exige cautela com dados |
| JSON publicado | republicar ou restaurar o último artefato válido | Confirmar o consumo pelo frontend |
| script | restaurar o script afetado | Validar importação/publicação novamente |
| dependência | reverter alteração de import/export | Confirmar compatibilidade com o contrato |

## 15. Histórico de decisões e bugs relacionados

| Data | Tipo | Registro | Observação |
| --- | --- | --- | --- |
| 15/05/2026 | decisão técnica | validações de `backend/services/parametros-minimos-service.js` foram reforçadas para UF, status, changes e reversão | Mantida a regra de negócio |
| 15/05/2026 | validação | testes service-level passaram a cobrir `salvarParametrosMinimos` e `reverterHistoricoParametrosMinimos` com senha inválida | Sem persistência real |
| 16/05/2026 | memória/documentação | entrada rápida, README da pasta de funcionalidades e modelo técnico foram criados antes deste MD | Camada agentiva consolidada |

## 16. Arquivos que devem ser atualizados junto com esta funcionalidade

| Arquivo | Quando atualizar | Observação |
| --- | --- | --- |
| `memoria/01_PROJETO_APLICACAO/funcionalidades/parametros-minimos.md` | sempre que a funcionalidade mudar | Documento principal |
| `memoria/08_ROTAS_BANCO_API/rotas.md` | se rotas mudarem | Contrato HTTP |
| `memoria/08_ROTAS_BANCO_API/schema-banco.md` | se schema mudar | Contrato de persistência |
| `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` | se o fluxo de dados mudar | Contrato entre camadas |
| `memoria/09_ERROS_E_CORRECOES/historico-erros.md` | se houver bug ou correção relevante | Rastreabilidade de incidentes |
| `memoria/10_TESTES/checklist-validacao.md` | se os testes obrigatórios mudarem | Validação operacional |
| `memoria/01_PROJETO_APLICACAO/pendencias.md` | se surgir nova pendência ou conclusão | Gestão documental |
| `memoria/00_DIARIO_DE_BORDO/diario-atual.md` | sempre que houver mudança relevante | Registro cronológico |
