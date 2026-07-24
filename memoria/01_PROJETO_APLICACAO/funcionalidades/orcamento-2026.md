# Funcionalidade: Orçamento 2026

## Instruções de uso deste documento

Este MD é a primeira leitura para tarefas sobre Orçamento 2026.

Ele não substitui o código, a validação no navegador, a validação da API, a conferência do banco ou a checagem dos JSONs publicados.

Ele também não substitui conferência orçamentária formal.

Quando a funcionalidade mudar, este documento deve ser revisado com base em inspeção real do código e da memória técnica.

## Identificação da funcionalidade

| Campo | Valor |
| --- | --- |
| Nome da funcionalidade | Orçamento 2026 |
| Arquivo deste documento | `memoria/01_PROJETO_APLICACAO/funcionalidades/orcamento-2026.md` |
| Status do documento | `validado` |
| Última revisão | `16/05/2026` |
| Responsável pela revisão | `Codex` |
| Funcionalidade crítica? | `sim` |
| Requer atualização quando alterar código? | `sim` |

## 1. Spec — Especificação funcional

### 1.1. Problema do usuário

O usuário precisa visualizar, ajustar, salvar, vincular, alocar e exportar dados do Orçamento 2026 sem precisar varrer frontend, backend, banco e publicação estática separadamente.

### 1.2. Objetivo da funcionalidade

Permitir manutenção técnica do Orçamento 2026 com rastreabilidade de processos, saldos, movimentações, classificação gerencial e fallback para modo estático.

### 1.3. Perfil de usuário e uso esperado

| Perfil | Uso esperado | Observação |
| --- | --- | --- |
| Pessoa editora autorizada | Editar registros, criar processo vinculado, alocar saldo e salvar alterações | A escrita exige senha de confirmação no serviço |
| Pessoa revisora | Conferir histórico, exportar Excel/PDF e validar saldo | Deve usar a fonte real do backend e do JSON publicado |
| Agente documental | Entender a funcionalidade com leitura mínima | Deve abrir este MD antes de varrer o projeto |

### 1.4. Escopo incluído

- Leitura da view `orcamento`.
- Edição de campos orçamentários e de rastreio.
- Criação de processo vinculado a partir de processo pai.
- Alocação de saldo entre processos da mesma categoria observada no serviço.
- Consulta de movimentações e histórico.
- Exportação em Excel e PDF completo, com os andamentos processuais expandidos.
- Publicação estática em `orcamento-2026.json`.

### 1.5. Fora do escopo

- Definir política orçamentária nova.
- Inventar saldos, processos, naturezas, planos ou valores.
- Alterar fluxo institucional sem evidência no código.
- Recalcular manualmente valores sem regra confirmada.

### 1.6. Regras de negócio

| Regra | Evidência | Observação |
| --- | --- | --- |
| O backend é a fonte de verdade do saldo real | `backend/services/orcamento-2026-service.js` e comentário no frontend | O cálculo visual no front-end é apenas estimativa |
| Processo vinculado não pode usar valor maior que o saldo básico disponível | `calcularSaldoBasicoParaVinculo()` e `criarProcessoVinculadoOrcamento2026()` | O saldo básico considera filhos já criados e valores empenhados/executados |
| Alocação de saldo não altera o valor original do processo | `alocarSaldoOrcamento2026()` | A rastreabilidade fica na tabela de movimentações |
| Saldo transferível considera recebimentos, cessões, empenho, execução e filhos ativos | `calcularSaldoTransferivelOrcamento2026()` | Regra técnica confirmada no serviço |
| A publicação estática gera `orcamento-2026.json` e `resumo-publicacao.json` | `backend/services/static-publication-service.js` | O JSON publicado é consumido pelo modo estático |
| O modo estático bloqueia ações que dependem do backend | `frontend/js/app.js` e CSS da view | Leitura somente |

### 1.7. Critérios de aceite funcionais

- A view carrega no modo local/API ou no modo estático.
- O salvamento grava alterações e gera backup.
- A criação de processo vinculado valida processo pai, valor, status e tipo de rastreio.
- A alocação de saldo valida origem, destino, valor, justificativa e saldo transferível.
- O histórico mostra registros recentes da página `orcamento-2026`.
- A exportação em planilha entrega `.xlsx`.
- A exportação em PDF inclui cada processo com o respectivo andamento, atualizações cadastradas e paginação que não separa a linha do painel de rastreio.
- O PDF usa paleta clara independente do tema da tela, valores em cores sólidas, contraste mínimo de 4,5:1 nas combinações principais e não cria página final apenas com o rodapé interno da view.

## 2. Plan — Planejamento técnico

### 2.1. Arquivos front-end relacionados

| Camada | Arquivo | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| front-end | `frontend/js/app.js` | View `orcamento`, carregamento de dados, cálculo visual de saldo, modais de alocação e divisão, salvamento, histórico e exportações Excel/PDF | Fonte principal da interação |
| front-end | `frontend/css/app.css` | Estilo da tabela, modal, ações da linha, responsividade e layout da captura do PDF | Inclui regras para o modo estático |
| front-end | `frontend/data/publicados/orcamento-2026.json` | Fonte lida no modo estático | Não editar manualmente sem escopo claro |
| documentação | `memoria/01_PROJETO_APLICACAO/funcionalidades/orcamento-2026.md` | Guia técnico da funcionalidade | Documento desta tarefa |

### 2.2. Arquivos back-end relacionados

| Camada | Arquivo | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| back-end | `backend/server.js` | Expõe as rotas da funcionalidade | Roteamento real confirmado |
| serviço | `backend/services/orcamento-2026-service.js` | Regras, leitura, escrita, saldo, vínculo, alocação e histórico | Fonte principal da lógica |
| serviço | `backend/services/data-service.js` | Decide entre API local e JSON publicado | Suporta modo estático |
| serviço | `backend/services/static-publication-service.js` | Publica `orcamento-2026.json` e resumo | Gera JSON publicado em disco |
| serviço | `backend/services/excel-export-service.js` | Exporta Excel da funcionalidade | Usa dados do serviço |
| banco | `backend/db/init-db.js` | Criação e evolução de `orcamento_2026` e `orcamento_2026_movimentacoes` | Schema confirmado |
| banco | `backend/db/preparar-banco.js` | Inicialização operacional | Prepara o banco na abertura do servidor |
| script | `scripts/validar-json-publicados.js` | Validação dos JSONs publicados | Confirma `orcamento-2026.json` e `resumo-publicacao.json` |
| teste | `tests/e2e/app.spec.js` | Cobertura E2E de view, modal e rotas | Inclui ações de saldo |
| teste | `tests/services/validacoes-services.test.js` | Cobertura service-level de contratos de validação | Reforça erro de senha/entrada inválida |

### 2.3. Rotas/API relacionadas

| Método | Rota | Arquivo/função responsável | Entrada esperada | Saída esperada | Observação |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/orcamento-2026` | `backend/server.js` -> `listarOrcamento2026()` | Não aplicável | JSON com itens, itens oficiais, outros processos, filtros e resumo | Leitura principal |
| POST | `/api/orcamento-2026/salvar` | `backend/server.js` -> `salvarOrcamento2026()` | `password`, `changes`, `novos`, `inativos` | JSON com sucesso, mensagem, `updatedAt` e `backupPath` | Publicação indireta em caso de sucesso |
| POST | `/api/orcamento-2026/processos-vinculados/criar` | `backend/server.js` -> `criarProcessoVinculadoOrcamento2026()` | `password`, `processoPaiId`, `valorAlocado`, `descricao`, `status`, `tipoRastreio` | JSON com sucesso ou erro de validação | Cria filho vinculado |
| POST | `/api/orcamento-2026/saldos/alocar` | `backend/server.js` -> `alocarSaldoOrcamento2026()` | `password`, `origemId`, `destinoId`, `valor`, `justificativa`, `criadoPor` | JSON com sucesso ou erro de saldo/validação | Registra movimentação |
| POST | `/api/orcamento-2026/frentes/salvar` | `backend/server.js` -> `salvarValorFrenteOrcamento2026()` | `password`, `frente`, `valorDisponivel` | JSON com sucesso ou erro de validação | Atualiza o valor disponível da frente |
| GET | `/api/orcamento-2026/movimentacoes` | `backend/server.js` -> `listarMovimentacoesOrcamento2026()` | Não aplicável | Lista de movimentações ativas | Base da modal de saldo |
| GET | `/api/orcamento-2026/historico` | `backend/server.js` -> `listarHistoricoOrcamento2026()` | Não aplicável | Lista de histórico recente | Rastreabilidade |
| GET | `/api/orcamento-2026/exportar` | `backend/server.js` -> `exportarOrcamento2026Excel()` | Não aplicável | Arquivo `.xlsx` | Exportação da planilha |

### 2.4. Serviços, controllers ou módulos envolvidos

| Camada | Arquivo/função | Papel na funcionalidade | Observação |
| --- | --- | --- | --- |
| serviço | `listarOrcamento2026()` | Monta a visão consolidada do orçamento | Retorna itens, resumo e filtros |
| serviço | `salvarOrcamento2026()` | Persiste edição, novos itens e inativação | Faz backup antes da escrita |
| serviço | `criarProcessoVinculadoOrcamento2026()` | Cria processo filho vinculado | Valida saldo básico disponível |
| serviço | `alocarSaldoOrcamento2026()` | Registra movimentação entre processos | Usa justificativa obrigatória |
| serviço | `listarMovimentacoesOrcamento2026()` | Lê movimentações ativas | Usada pela UI e pela modal |
| serviço | `listarHistoricoOrcamento2026()` | Lê histórico recente | Base da trilha documental |

### 2.5. Banco de dados relacionado

| Tabela | Uso na funcionalidade | Risco | Observação |
| --- | --- | --- | --- |
| `orcamento_2026` | Processos, itens, valores, rastreio, classificação e vínculo | Alteração de colunas pode quebrar cálculo e publicação | Tabela principal |
| `orcamento_2026_movimentacoes` | Movimentações de saldo entre processos | Duplicidade ou inconsistência afeta saldo transferível | Não há foreign key explícita confirmada |
| `orcamento_2026_frentes` | Valor disponível informado para cada frente | Divergência afeta total por frente e saldo disponível | Tabela aditiva, chaveada por nome da frente |
| `historico_alteracoes` | Registro de alterações da página | Histórico inconsistente dificulta auditoria | Relacionamento operacional por `pagina` |

### 2.6. JSONs publicados e modo estático

| JSON | Origem | Consumidor | Quando é atualizado | Risco |
| --- | --- | --- | --- | --- |
| `frontend/data/publicados/orcamento-2026.json` | `backend/services/static-publication-service.js` | `backend/services/data-service.js` e SPA no modo estático | Após publicação estática bem-sucedida | Divergência entre banco e JSON |
| `frontend/data/publicados/resumo-publicacao.json` | Publicação estática global | SPA e diagnóstico de publicação | Após publicação estática | Churn de metadado sem mudança material |

### 2.7. Dependências e imports relevantes

| Dependência/import | Papel | Observação |
| --- | --- | --- |
| `better-sqlite3` | Persistência local | Dependência do banco SQLite |
| `xlsx` | Leitura/exportação de planilha | Usado no serviço do orçamento |
| `bootstrap` no front-end | Modal e interação visual | Modal de alocação usa componente Bootstrap |
| `fetchJsonApiOnasp` | Consumo de API no front-end | Abstrai leitura local/API |
| `obterModoDadosOnasp('orcamento2026')` | Seleção entre local/API e estático | Garante leitura mínima no modo correto |

## 3. Research — Decisões, fundamentos e restrições

### 3.1. Decisões técnicas já identificadas

| Decisão | Evidência | Observação |
| --- | --- | --- |
| O valor original do processo não é reescrito pela alocação | `alocarSaldoOrcamento2026()` | A alocação vira movimentação rastreável |
| O saldo visual no front-end é estimativa | comentário no `frontend/js/app.js` | O backend continua sendo a fonte de verdade |
| A classificação gerencial trabalha com `APARELHAMENTO` e `NAO_APARELHAMENTO` | `backend/services/orcamento-2026-service.js` e `frontend/js/app.js` | Regra já consolidada no código |
| O modo estático usa JSON publicado e bloqueia controles dependentes de backend | `frontend/js/app.js` e `frontend/css/app.css` | Preserva leitura somente |
| A publicação é acompanhada de validação de JSON | `scripts/validar-json-publicados.js` | Reduz regressão de dados publicados |

### 3.2. Fundamentos institucionais ou orçamentários relacionados

Fonte institucional formal específica para esta tela: `Não identificado ainda.`

Base operacional confirmada na memória e no código:

- Orçamento 2026 é tratado como funcionalidade crítica da aplicação.
- Há relação técnica com processos vinculados, saldo, movimentações e publicação estática.
- A classificação gerencial usa `APARELHAMENTO` e `NAO_APARELHAMENTO`.

### 3.3. Restrições técnicas

- O banco é local e não deve ser alterado sem backup.
- A publicação estática não deve ser recalculada sem necessidade.
- O front-end não deve assumir saldo real quando o backend já valida o valor.
- O modo estático não deve habilitar ações de escrita.

### 3.4. Limites de conhecimento

- Não foi identificado documento institucional formal de orçamento que substitua a inspeção do código.
- Não foi aberto todo o repositório de fontes tratadas.
- Não foi feita auditoria completa de acessibilidade.

## 4. Fluxo de dados

### 4.1. Origem dos dados

| Origem | Evidência | Observação |
| --- | --- | --- |
| Planilha `Planilhas/orcamento_onasp.xlsx` | `backend/services/orcamento-2026-service.js` | Fonte inicial observada no serviço |
| SQLite `orcamento_2026` | `backend/db/init-db.js` e serviço | Fonte persistida do modo local/API |
| JSON publicado `orcamento-2026.json` | `backend/services/static-publication-service.js` | Fonte do modo estático |

### 4.2. Entrada pela interface

- A view `orcamento` é aberta na SPA.
- A tela carrega no modo local/API ou estático conforme `obterModoDadosOnasp('orcamento2026')`.
- O front-end busca os dados e, quando aplicável, as movimentações.

### 4.3. Validação no front-end

- O front-end calcula saldo visual estimado para orientar o usuário.
- O botão de alocação é ocultado ou bloqueado quando o saldo estimado é insuficiente.
- O modal exige valor, justificativa e senha antes do envio.

### 4.4. Requisição à API

- Leitura principal: `GET /api/orcamento-2026`.
- Movimentações: `GET /api/orcamento-2026/movimentacoes`.
- Escrita: `POST /api/orcamento-2026/salvar`, `POST /api/orcamento-2026/processos-vinculados/criar`, `POST /api/orcamento-2026/saldos/alocar`.
- Valor da frente: `POST /api/orcamento-2026/frentes/salvar`.
- Histórico: `GET /api/orcamento-2026/historico`.
- Exportação: `GET /api/orcamento-2026/exportar`.

### 4.5. Validação no back-end

- Senha obrigatória para escrita.
- Valor precisa ser positivo.
- Processo pai e destino precisam existir quando aplicável.
- Saldo básico e saldo transferível precisam suportar a operação.
- Justificativa é obrigatória na alocação.

### 4.6. Persistência no banco

- Alterações vão para `orcamento_2026`.
- Alocações vão para `orcamento_2026_movimentacoes`.
- Valores disponíveis por frente vão para `orcamento_2026_frentes`.
- Alterações e reversões de trilha vão para `historico_alteracoes`.
- O serviço cria backup antes de salvar alterações.

### 4.7. Publicação estática, se houver

- `backend/services/static-publication-service.js` escreve `orcamento-2026.json`.
- O modo estático lê esse JSON e o resumo de publicação.
- O backend e o front-end respeitam a seleção entre API local e modo estático.

### 4.8. Exibição ao usuário

- O usuário vê tabela, filtros, resumo e ações da linha.
- O saldo estimado é exibido com detalhamento visual.
- A modal de alocação mostra origem, destino, saldo estimado e justificativa.

## 5. Estados da interface e experiência do usuário

### 5.1. Estados esperados da tela

| Estado | Evidência | Observação |
| --- | --- | --- |
| Carregando | `Carregando Orçamento 2026...` | Estado inicial ou de atualização |
| Conteúdo carregado | view com tabela e ações | Estado normal |
| Modo estático | controles backend-dependent ocultos | Leitura somente |
| Erro de carregamento | `Não foi possível carregar Orçamento 2026.` | Mostra detalhe com JSON/API |
| Modal de alocação aberta | `#modalAlocarSaldoOrcamento` | Ação de saldo |

### 5.2. Mensagens de sucesso, erro e vazio

| Tipo | Mensagem observada | Origem |
| --- | --- | --- |
| Sucesso | Não identificado ainda. | A captura exata depende do fluxo acionado |
| Erro | `Não foi possível carregar Orçamento 2026.` | `frontend/js/app.js` |
| Validação | `O valor excede o saldo transferível estimado.` | Front-end da modal |
| Vazio | Não identificado ainda. | Não houve leitura completa da experiência vazia |

### 5.3. Responsividade

- A tabela usa rolagem horizontal controlada.
- O CSS contém regras específicas para telas menores.
- A interface foi pensada para não quebrar em listas extensas.

### 5.4. Acessibilidade

- A modal usa estrutura com título e botão de fechar.
- O front-end registra controles com `aria-disabled` no modo estático em testes.
- Auditoria formal completa de acessibilidade: `Não identificado ainda.`

### 5.5. Pontos de atenção de UX

- Evitar expor saldo estimado como se fosse saldo real.
- Evitar permitir ação em modo estático.
- Manter texto curto e institucional.

## 6. Validação e tratamento de erros

| Condição | Tratamento observado | Origem |
| --- | --- | --- |
| Senha inválida | Operação rejeitada | Serviço do orçamento |
| Processo pai não localizado | Operação rejeitada | `criarProcessoVinculadoOrcamento2026()` |
| Processo de origem não localizado | Operação rejeitada | `alocarSaldoOrcamento2026()` |
| Processo inativo | Operação rejeitada | Serviço do orçamento |
| Valor inválido ou não positivo | Operação rejeitada | Serviço do orçamento e modal |
| Justificativa ausente | Operação rejeitada | `alocarSaldoOrcamento2026()` |
| Saldo básico/transferível insuficiente | Operação rejeitada | Serviço do orçamento |
| `status` inválido quando informado | Operação rejeitada | `criarProcessoVinculadoOrcamento2026()` |
| `tipoRastreio` inválido quando informado | Operação rejeitada | `criarProcessoVinculadoOrcamento2026()` |
| Sem alterações para salvar | Operação rejeitada | `salvarOrcamento2026()` |

### Respostas HTTP esperadas

| Tipo de rota | Resposta esperada | Observação |
| --- | --- | --- |
| Leitura | JSON com dados da funcionalidade | Confirmado nas rotas GET |
| Escrita | JSON com sucesso ou erro | Status HTTP exato não foi aberto em detalhe nesta inspeção |
| Exportação | `.xlsx` | `Content-Disposition` de arquivo |

### Logs e diagnóstico

- O backend registra erros técnicos no servidor.
- A publicação estática e o validador de JSON ajudam a diagnosticar divergência.
- O histórico de alterações serve como trilha documental.

### Falhas que não devem ser silenciadas

- Saldo negativo ou inconsistente.
- Valor excedendo saldo transferível.
- Alocação sem justificativa.
- Divergência entre banco e JSON publicado.

## 7. Segurança e proteção de dados

### 7.1. Dados sensíveis ou administrativos

| Tipo | Situação | Observação |
| --- | --- | --- |
| Dados orçamentários | Confirmados | Exigem cuidado operacional |
| Processos administrativos | Confirmados | Devem manter rastreabilidade |
| Senha de edição | Confirmada no serviço | Não deve ser exposta no front-end |

### 7.2. Validação de entrada

- O serviço valida senha e campos obrigatórios.
- O front-end repete parte da validação para UX.
- Entradas monetárias e IDs precisam ser normalizados.

### 7.3. Autorização e exposição indevida

- A escrita depende de senha.
- O modo estático não deve expor controles de escrita.
- Não há evidência de autorização por perfil além da senha de confirmação.

### 7.4. Riscos de XSS, SQL injection ou vazamento

- Textos de observação e justificativa precisam ser tratados com escape/sanitização.
- O banco é local; o vazamento mais sensível é por publicação ou logs indevidos.
- Auditoria completa de todos os pontos de sanitização: `Não identificado ainda.`

### 7.5. Cuidados com JSONs publicados

- Não editar JSON publicado manualmente sem necessidade.
- Não permitir churn de timestamp sem mudança material.
- Validar `orcamento-2026.json` e `resumo-publicacao.json` após publicação.

## 8. Performance e manutenibilidade

| Ponto | Impacto | Observação |
| --- | --- | --- |
| Cálculo visual de saldo | Recalcula por item e movimentação | Pode pesar em listas maiores |
| Renderização da tabela | Complexidade de layout | Tabela extensa exige responsividade |
| Exportação Excel | Custo de geração de arquivo | Execução pontual, mas relevante |
| Exportação PDF completo | Captura temporária da view com todas as trilhas abertas | Execução pontual; restaura o estado visual ao terminar |
| Publicação estática | Recompõe JSON | Deve ocorrer só quando necessário |
| Hierarquia pai/filho | Agrupamento e expansão | Pode gerar regressão visual se alterado sem cuidado |

### Acoplamentos relevantes

- Front-end depende do formato retornado pela API.
- Serviço depende do schema de `orcamento_2026` e `orcamento_2026_movimentacoes`.
- Publicação estática depende do mesmo serviço usado pela API.

### Oportunidades de simplificação

- Manter roteamento de dados centralizado no serviço.
- Reutilizar o mesmo contrato para API local e JSON publicado.
- Evitar duplicar regra de saldo em front-end e backend.

## 9. Tasks — Microtarefas típicas

- Alterar campo orçamentário.
- Alterar cálculo de saldo.
- Alterar visualização de processo pai/filho.
- Alterar regra de alocação.
- Alterar rota/API, se existir.
- Alterar schema, se existir.
- Alterar publicação estática, se existir.
- Atualizar documentação da funcionalidade.

## 10. Test Plan — Plano de teste

### 10.1. Testes manuais da interface

- Abrir a view `orcamento`.
- Verificar carregamento em modo local/API.
- Verificar carregamento em modo estático.
- Abrir a modal de alocação.
- Testar criação de processo vinculado.
- Testar salvamento de alteração.
- Testar exportação Excel.
- Testar o PDF com todos os rastreios abertos, observações legíveis, etapas completas e blocos não divididos entre páginas.

### 10.2. Testes de API

- `GET /api/orcamento-2026`
- `POST /api/orcamento-2026/salvar`
- `POST /api/orcamento-2026/processos-vinculados/criar`
- `POST /api/orcamento-2026/saldos/alocar`
- `GET /api/orcamento-2026/movimentacoes`
- `GET /api/orcamento-2026/historico`
- `GET /api/orcamento-2026/exportar`

### 10.3. Testes de banco de dados

- Confirmar escrita em `orcamento_2026`.
- Confirmar escrita em `orcamento_2026_movimentacoes`.
- Confirmar histórico em `historico_alteracoes`.
- Validar ausência de duplicidade após salvar e reabrir.

### 10.4. Testes de modo estático

- Conferir leitura de `frontend/data/publicados/orcamento-2026.json`.
- Conferir leitura do `resumo-publicacao.json`.
- Confirmar bloqueio de ações de escrita.

### 10.5. Testes de responsividade

- Conferir tabela em largura reduzida.
- Conferir modal em tela pequena.
- Conferir ações da linha sem quebra visual relevante.

### 10.6. Testes de acessibilidade básica

- Conferir foco inicial do modal.
- Conferir botão de fechar.
- Conferir texto legível e contraste básico.
- Conferir `aria-disabled` quando aplicável.

### 10.7. Verificação de console e logs

- Conferir ausência de erro crítico no console.
- Conferir logs do servidor local.
- Conferir erro de backend quando a API ou JSON não estiver disponível.

### 10.8. Checklist antes do commit

- Confirmar que a alteração ficou restrita ao escopo.
- Confirmar que a documentação reflete o código real.
- Confirmar que não houve alteração indevida de JSON publicado.
- Confirmar que o rollback foi considerado.

## 11. Riscos conhecidos

| Risco | Classificação | Evidência | Observação |
| --- | --- | --- | --- |
| Cálculo incorreto de saldo | risco provável | há cálculo visual no front-end e cálculo real no backend | Validar sempre os dois lados |
| Duplicidade de movimentação | risco provável | tabela própria de movimentações | Evitar reenvio e repetição |
| Alteração indevida de valor | risco provável | serviço salva itens e cria backup | Revisar payload antes de salvar |
| Divergência entre banco e JSON publicado | risco provável | modo estático depende da publicação | Validar `orcamento-2026.json` |
| Regressão de publicação estática | risco provável | publication service escreve JSON | Mudança deve ser testada |
| Exibição incorreta de processo pai/filho | erro real | histórico técnico do projeto registrou regressão semelhante | Conferir renderização após alterações |
| Alteração de metadado sem mudança material | melhoria recomendada | histórico de publicação estática e JSONs | Evitar churn de timestamps |

## 12. Como alterar esta funcionalidade com segurança

1. Ler `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`.
2. Ler este MD.
3. Confirmar os arquivos-alvo reais no código.
4. Conferir `git status --short`.
5. Alterar o mínimo necessário.
6. Validar localmente no navegador, na API e no banco.
7. Validar cálculos e persistência quando houver impacto financeiro.
8. Atualizar este MD se a mudança afetar rota, banco, JSON, regra, fluxo ou teste.
9. Validar o diff.
10. Comitar com mensagem objetiva.
11. Prever rollback antes de encerrar.

## 13. O que não fazer

- Não alterar valores sem fonte.
- Não recalcular orçamento sem regra clara.
- Não alterar saldos sem validar movimentações.
- Não alterar JSONs publicados sem escopo claro.
- Não alterar banco sem backup e rollback.
- Não alterar rotas sem conferir consumidores.
- Não inventar processos, valores, dotações, planos orçamentários, fontes ou naturezas de despesa.
- Não misturar refatoração estética com correção funcional.

## 14. Rollback

| Tipo de alteração | Estratégia de rollback | Observação |
| --- | --- | --- |
| documento | `git revert <hash_do_commit>` | Aplicável a esta etapa documental |
| front-end | Restaurar o arquivo alterado e revalidar a view | Não executado nesta tarefa |
| back-end | Restaurar o serviço/roteador alterado e validar saldo/publicação | Não executado nesta tarefa |
| banco/schema | Reverter migration ou restaurar backup do SQLite | Exige cuidado com dados |
| JSON publicado | Regerar publicação estática anterior ou restaurar cópia válida | Evitar churn indevido |
| script | Reverter o script e validar JSONs novamente | Usar quando a validação mudar |
| dependência | Voltar a versão anterior e validar compatibilidade | Confirmar impacto antes de subir |

## 15. Histórico de decisões e bugs relacionados

| Item | Tipo | Evidência | Observação |
| --- | --- | --- | --- |
| Renderização incorreta de processo vinculado em agrupamento visual | erro real | memória de erro e correção do projeto | Regra relevante para revisão de árvore pai/filho |
| Saldo visual ajustado sem substituir a validação do backend | decisão técnica | comentário no front-end | Mantém UX sem quebrar a fonte de verdade |
| Alocação de saldo preservando rastreabilidade | decisão técnica | serviço de movimentações | Movimentação não sobrescreve valor original |
| Valor disponível por frente separado dos processos | decisão técnica | `orcamento_2026_frentes` e rota `/api/orcamento-2026/frentes/salvar` | O saldo da frente é calculado por valor disponível menos o previsto dos processos |

## 16. Arquivos que devem ser atualizados junto com esta funcionalidade

Conforme o caso, atualizar:

- este próprio MD;
- `memoria/08_ROTAS_BANCO_API/rotas.md`;
- `memoria/08_ROTAS_BANCO_API/schema-banco.md`;
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`;
- `memoria/09_ERROS_E_CORRECOES/historico-erros.md`;
- `memoria/10_TESTES/checklist-validacao.md`;
- `memoria/01_PROJETO_APLICACAO/pendencias.md`;
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
