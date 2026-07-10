# Rotas da API Local — FOMENTO-ONASP

## Finalidade

Este arquivo documenta as rotas reais da API local do FOMENTO-ONASP, com base em `backend/server.js` e nos serviços chamados por cada endpoint.

A API descrita aqui é local. Ela apoia o modo local/API, editável, servido por `npm start`. Não se trata de API pública externa e não é usada diretamente pelo modo estático/GitHub Pages.

O detalhamento do banco operacional Postgres/Supabase e do artefato SQLite legado deve ficar em `schema-banco.md`.

## Visão geral

As rotas locais ficam em `backend/server.js`.

O backend local:

- usa `http` nativo do Node;
- entrega arquivos estáticos a partir da raiz do repositório;
- roteia caminhos iniciados por `/api/`;
- aceita `GET`, `POST` e `OPTIONS`;
- lê JSON de entrada por `lerJsonBody` nas rotas `POST`;
- devolve JSON nas rotas de leitura, salvamento e histórico;
- devolve arquivo `.xlsx` nas rotas de exportação;
- aciona publicação estática em rotas de escrita quando o serviço retorna `success: true`.

No modo estático/GitHub Pages, a aplicação não usa essas rotas locais. A SPA consome os JSONs publicados em `frontend/data/publicados/` e bloqueia ações que exigem backend.

## Convenções deste documento

- **leitura:** `GET` que retorna JSON.
- **escrita:** `POST` que altera dado local.
- **histórico:** rota que retorna registros de `historico_alteracoes`.
- **reversão:** rota que altera dado para restaurar valor de histórico.
- **exportação:** `GET` que retorna `.xlsx`.
- **publicação indireta:** rota de escrita que chama `publicarAposSalvamento`.
- **Payload confirmado:** campos confirmados no serviço chamado ou no consumo aparente em `frontend/js/app.js`.
- **Resposta confirmada:** formato observado no serviço ou no roteador.
- **Não confirmado nesta inspeção:** item que exigiria análise adicional ou não aparece nos arquivos inspecionados.

## Rotas confirmadas

### Parâmetros Mínimos

#### GET /api/parametros-minimos

**Finalidade:** retornar os dados consolidados de Parâmetros Mínimos.

**Serviço chamado:** `listarParametrosMinimos()`, de `backend/services/parametros-minimos-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna objeto com `arquivo`, `disponivel`, `erro`, `aba`, `parametrosDisponiveis`, `respostasBrutas`, `respostas`, `resumo` e `diagnostico`.

**Efeito colateral:** nenhum efeito de escrita confirmado.

**Publicação estática:** não.

**Frontend consumidor:** `carregarDadosDiagnosticoOuvidorias()` em `backend/services/data-service.js`, consumido pela view interna `diagnostico-ouvidorias` em `frontend/js/app.js`.

**Observações de manutenção:** manter compatibilidade com o modo estático, que usa `frontend/data/publicados/parametros-minimos.json` quando a API local não está disponível ou quando está em GitHub Pages.

#### POST /api/parametros-minimos/salvar

**Finalidade:** salvar alterações de status e quantidades dos Parâmetros Mínimos.

**Serviço chamado:** `salvarParametrosMinimos(payload)`, de `backend/services/parametros-minimos-service.js`.

**Tipo:** escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O serviço espera `password` e `changes`. O frontend envia `changes` a partir de `parametrosMinimosAlteracoesPendentes`; o serviço valida alterações por UF e parâmetro, aceitando status e, para parâmetros quantitativos, `quantidadeAtual` e `quantidadeIdeal`.

**Resposta:** confirmada. Em sucesso, o serviço retorna `success: true`, `message` e `updatedAt`.

**Efeito colateral:** grava Postgres/Supabase pelo backend via `DATABASE_URL` e registra histórico. Não aciona publicação estática automaticamente.

**Publicação estática:** não.

**Frontend consumidor:** `salvarParametrosMinimosComSenha()` em `frontend/js/app.js`.

**Observações de manutenção:** não alterar formato de `changes` sem atualizar o frontend, a publicação e a documentação de payload.

#### GET /api/parametros-minimos/historico

**Finalidade:** retornar histórico recente de alterações dos Parâmetros Mínimos.

**Serviço chamado:** `listarHistoricoParametrosMinimos()`, de `backend/services/parametros-minimos-service.js`.

**Tipo:** histórico; leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna `{ success: true, historico: [...] }`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** `abrirHistoricoParametrosMinimos()` em `frontend/js/app.js`.

**Observações de manutenção:** a consulta limita a lista a registros recentes no serviço. O detalhamento da tabela fica em `schema-banco.md`.

#### POST /api/parametros-minimos/historico/reverter

**Finalidade:** reverter uma alteração de Parâmetros Mínimos a partir de um registro de histórico.

**Serviço chamado:** `reverterHistoricoParametrosMinimos(payload)`, de `backend/services/parametros-minimos-service.js`.

**Tipo:** reversão; escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O serviço espera `password` e `historicoId`.

**Resposta:** confirmada. Em sucesso, retorna `success: true`, `message` e `updatedAt`.

**Efeito colateral:** grava Postgres/Supabase pelo backend via `DATABASE_URL` e registra novo histórico de reversão. Não aciona publicação estática automaticamente.

**Publicação estática:** não.

**Frontend consumidor:** `reverterHistoricoParametrosMinimos(historicoId)` em `frontend/js/app.js`.

**Observações de manutenção:** reversão depende de `historicoId` válido e de campo ainda editável no serviço.

#### GET /api/parametros-minimos/exportar

**Finalidade:** exportar Parâmetros Mínimos para Excel.

**Serviço chamado:** `exportarParametrosMinimosExcel()`, de `backend/services/excel-export-service.js`.

**Tipo:** exportação.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna buffer `.xlsx` com `Content-Type` de planilha e `Content-Disposition: attachment; filename="parametros-minimos.xlsx"`.

**Efeito colateral:** exporta arquivo; não grava dados.

**Publicação estática:** não.

**Frontend consumidor:** botão `btnExportarParametrosMinimos` em `frontend/js/app.js`, que aponta para `obterUrlApiOnasp('/api/parametros-minimos/exportar')`.

**Observações de manutenção:** o frontend bloqueia exportação se houver alterações não salvas, para evitar Excel divergente da base persistida.

### Formalização PROFOR

#### GET /api/formalizacao-profor

**Finalidade:** retornar dados consolidados da Formalização PROFOR.

**Serviço chamado:** `listarFormalizacaoProfor()`, de `backend/services/formalizacao-profor-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna objeto com `arquivo`, `disponivel`, `aba`, `ufsAutorizadas`, `ufsCondicaoSuspensiva`, `valorRepassePadrao`, `etapas`, `statusPermitidos`, `propostas`, `registros`, `diagnostico` e `resumo`.

**Efeito colateral:** pode executar backfill idempotente no Postgres/Supabase quando necessário pelo serviço; não salva payload da requisição.

**Publicação estática:** não.

**Frontend consumidor:** `carregarDadosFormalizacaoProfor()` em `backend/services/data-service.js`, usado pelas views `formalizacao` e `formalizacao-detalhe` em `frontend/js/app.js`.

**Observações de manutenção:** preservar compatibilidade com `frontend/data/publicados/formalizacao-profor.json`.

#### POST /api/formalizacao-profor/salvar

**Finalidade:** salvar status e observações das etapas da Formalização PROFOR.

**Serviço chamado:** `salvarFormalizacaoProfor(payload)`, de `backend/services/formalizacao-profor-service.js`.

**Tipo:** escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O serviço espera `password` e `changes`. O frontend envia `changes` por UF e etapa, com `status` e `observacao`.

**Resposta:** confirmada. Em sucesso, retorna `success: true`, `message` e `updatedAt`.

**Efeito colateral:** grava Postgres/Supabase pelo backend via `DATABASE_URL` e registra histórico de status e observação. Não aciona publicação estática automaticamente.

**Publicação estática:** não.

**Frontend consumidor:** `salvarFormalizacaoComSenha()` em `frontend/js/app.js`.

**Observações de manutenção:** o frontend indica que alguns campos exibidos são informativos e não são enviados para esta rota.

#### GET /api/formalizacao-profor/historico

**Finalidade:** retornar histórico recente da Formalização PROFOR.

**Serviço chamado:** `listarHistoricoFormalizacaoProfor()`, de `backend/services/formalizacao-profor-service.js`.

**Tipo:** histórico; leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna `{ success: true, historico: [...] }`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** `abrirHistoricoFormalizacao()` em `frontend/js/app.js`.

**Observações de manutenção:** não há rota de reversão de histórico para Formalização PROFOR confirmada em `backend/server.js`.

#### GET /api/formalizacao-profor/exportar

**Finalidade:** exportar Formalização PROFOR para Excel.

**Serviço chamado:** `exportarFormalizacaoProforExcel()`, de `backend/services/excel-export-service.js`.

**Tipo:** exportação.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna buffer `.xlsx` com `Content-Type` de planilha e `Content-Disposition: attachment; filename="formalizacao-profor.xlsx"`.

**Efeito colateral:** exporta arquivo; não grava dados.

**Publicação estática:** não.

**Frontend consumidor:** botão `btnExportarFormalizacao` em `frontend/js/app.js`, que aponta para `obterUrlApiOnasp('/api/formalizacao-profor/exportar')`.

**Observações de manutenção:** o frontend bloqueia exportação quando existem alterações não salvas.

### Orçamento 2026

#### GET /api/orcamento-2026

**Finalidade:** retornar dados consolidados do Orçamento 2026.

**Serviço chamado:** `listarOrcamento2026()`, de `backend/services/orcamento-2026-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna objeto com `arquivo`, `disponivel`, `aba`, `itens`, `itensOficiais`, `outrosProcessos`, `statusPermitidos`, `resumo`, `resumoAparelhamento` e `filtros`.

**Efeito colateral:** pode executar backfills idempotentes no Postgres/Supabase quando necessário pelo serviço; não salva payload da requisição.

**Publicação estática:** não.

**Frontend consumidor:** `carregarDadosOrcamento()` em `backend/services/data-service.js`, usado pela view `orcamento` em `frontend/js/app.js`.

**Observações de manutenção:** a API local é a fonte editável; o modo estático usa `frontend/data/publicados/orcamento-2026.json`.

#### POST /api/orcamento-2026/salvar

**Finalidade:** salvar alterações gerais do Orçamento 2026, incluindo alterações em itens, novos processos e inativação.

**Serviço chamado:** `salvarOrcamento2026(payload)`, de `backend/services/orcamento-2026-service.js`.

**Tipo:** escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O serviço espera `password`, `changes`, `novos` e `inativos`. O frontend envia `changes` por ID de processo, `novos` com campos operacionais de novos processos e `inativos` como lista de IDs.

**Resposta:** confirmada. Em sucesso, retorna `success: true`, `message`, `updatedAt` e `backupPath`; o roteador acrescenta `publicacaoEstatica` quando a publicação conclui.

**Efeito colateral:** grava Postgres/Supabase pelo backend via `DATABASE_URL`; registra histórico de criação, alteração ou inativação; aciona publicação estática se `success: true`.

**Publicação estática:** sim, via `publicarAposSalvamento`.

**Frontend consumidor:** `salvarOrcamentoComSenha()` em `frontend/js/app.js`.

**Observações de manutenção:** mudanças de payload devem ser validadas contra o frontend e o serviço, pois esta rota concentra edições gerais da tela.

#### POST /api/orcamento-2026/processos-vinculados/criar

**Finalidade:** criar processo vinculado a um processo principal do Orçamento 2026.

**Serviço chamado:** `criarProcessoVinculadoOrcamento2026(payload)`, de `backend/services/orcamento-2026-service.js`.

**Tipo:** escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O serviço aceita `password` ou `senha`, `processoPaiId` ou `processo_pai_id`, `descricao`, `valorAlocado` ou `valor_alocado`, `status`, `tipoRastreio` ou `tipo_rastreio`, `processoSei`, `linkProcessoSei`, `dataProcessoSei`, `observacao` e alguns campos opcionais herdáveis do pai. O frontend envia `password`, `processoPaiId`, `descricao`, `valorAlocado`, dados SEI, `status` e `observacao`.

**Resposta:** confirmada. Em sucesso, retorna `success: true`, `message`, `updatedAt`, `backupPath` e `item`; o roteador acrescenta `publicacaoEstatica` quando a publicação conclui.

**Efeito colateral:** grava Postgres/Supabase pelo backend via `DATABASE_URL`; registra histórico; aciona publicação estática se `success: true`.

**Publicação estática:** sim, via `publicarAposSalvamento`.

**Frontend consumidor:** `abrirModalDividirRecursoOrcamento()` em `frontend/js/app.js`.

**Observações de manutenção:** o serviço valida senha, processo pai, saldo básico, status e tipo de rastreio; filhos não compõem novamente o total global do orçamento.

#### POST /api/orcamento-2026/saldos/alocar

**Finalidade:** registrar alocação de saldo entre processos do Orçamento 2026.

**Serviço chamado:** `alocarSaldoOrcamento2026(payload)`, de `backend/services/orcamento-2026-service.js`.

**Tipo:** escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O serviço aceita `password` ou `senha`, `origemId` ou `origem_id`, `destinoId` ou `destino_id`, `valor`, `justificativa` e `criadoPor` ou `criado_por`. O frontend envia `password`, `origemId`, `destinoId`, `valor` e `justificativa`.

**Resposta:** confirmada. Em sucesso, retorna `success: true`, `message`, `backupPath` e `movimentacao`; o roteador acrescenta `publicacaoEstatica` quando a publicação conclui.

**Efeito colateral:** grava Postgres/Supabase na tabela de movimentações do Orçamento 2026 pelo backend via `DATABASE_URL`; registra histórico; aciona publicação estática se `success: true`.

**Publicação estática:** sim, via `publicarAposSalvamento`.

**Frontend consumidor:** `abrirModalAlocarSaldoOrcamento()` em `frontend/js/app.js`.

**Observações de manutenção:** a alocação não altera o valor original dos processos; o backend valida categoria, saldo transferível e rastreabilidade por justificativa.

#### GET /api/orcamento-2026/movimentacoes

**Finalidade:** retornar movimentações do Orçamento 2026, incluindo alocações de saldo.

**Serviço chamado:** `listarMovimentacoesOrcamento2026()`, de `backend/services/orcamento-2026-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna `{ success: true, movimentacoes: [...] }`, com campos normalizados como `origemId`, `destinoId`, `valor`, `justificativa`, `criadoEm`, `criadoPor` e `ativo`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** `carregarMovimentacoesOrcamento2026()` em `frontend/js/app.js`.

**Observações de manutenção:** o frontend usa essas movimentações para resumo visual; o backend continua sendo fonte de verdade para saldo real.

#### GET /api/orcamento-2026/historico

**Finalidade:** retornar histórico recente do Orçamento 2026.

**Serviço chamado:** `listarHistoricoOrcamento2026()`, de `backend/services/orcamento-2026-service.js`.

**Tipo:** histórico; leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna `{ success: true, historico: [...] }`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** `abrirHistoricoOrcamento()` em `frontend/js/app.js`.

**Observações de manutenção:** não há rota de reversão de histórico para Orçamento 2026 confirmada em `backend/server.js`.

#### GET /api/orcamento-2026/exportar

**Finalidade:** exportar Orçamento 2026 para Excel.

**Serviço chamado:** `exportarOrcamento2026Excel()`, de `backend/services/excel-export-service.js`.

**Tipo:** exportação.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna buffer `.xlsx` com `Content-Type` de planilha e `Content-Disposition: attachment; filename="orcamento-2026.xlsx"`.

**Efeito colateral:** exporta arquivo; não grava dados.

**Publicação estática:** não.

**Frontend consumidor:** botão de exportação da view `orcamento`, que aponta para `obterUrlApiOnasp('/api/orcamento-2026/exportar')`.

**Observações de manutenção:** o frontend bloqueia exportação quando existem alterações não salvas.

### PROFOR 2022 — Carteira de convênios monitorados

#### GET /api/profor-2022/convenios-monitorados

**Finalidade:** retornar a lista de convênios monitorados. Por padrão, retorna apenas os ativos. Aceita query `?incluirInativos=true` para incluir inativos.

**Serviço chamado:** `listarConveniosMonitorados(opcoes)`, de `backend/services/profor-2022/convenios-monitorados-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica.

**Resposta:** `{ success: true, convenios: [...] }`. Cada item em camelCase: `id`, `numeroConvenio`, `ano`, `uf`, `instrumento`, `programaOrigem`, `ativo`, `idConvenioTransferegov`, `observacao`, `criadoEm`, `atualizadoEm`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** nenhum ainda; rota disponível para uso futuro pelo frontend da página PROFOR 2022.

**Observações de manutenção:** rota exclusiva do modo local/API. O modo estático não usa esta rota.

#### POST /api/profor-2022/convenios-monitorados

**Finalidade:** criar novo convênio na carteira de acompanhamento.

**Serviço chamado:** `criarConvenioMonitorado(payload)`, de `backend/services/profor-2022/convenios-monitorados-service.js`.

**Tipo:** escrita.

**Payload:** camelCase. Campos aceitos: `numeroConvenio` (obrigatório, apenas dígitos), `ano` (4 dígitos), `uf` (2 caracteres), `instrumento`, `programaOrigem`, `idConvenioTransferegov`, `observacao`.

**Resposta:** `{ success: true, convenio: { ... } }` com o registro criado em camelCase. Em erro de validação ou duplicidade: `{ success: false, message: "..." }` com status `400`.

**Efeito colateral:** grava `profor_convenios_monitorados` no Postgres/Supabase pelo backend via `DATABASE_URL`.

**Publicação estática:** não.

**Frontend consumidor:** nenhum ainda; rota disponível para uso futuro.

**Observações de manutenção:** `numero_convenio + ano` é único; inserção de convênio duplicado retorna erro controlado sem stack trace.

#### POST /api/profor-2022/convenios-monitorados/:id/salvar

**Finalidade:** atualizar campos editáveis de um convênio monitorado existente.

**Serviço chamado:** `atualizarConvenioMonitorado(id, payload)`, de `backend/services/profor-2022/convenios-monitorados-service.js`.

**Tipo:** escrita.

**Payload:** camelCase. Campos editáveis: `numeroConvenio`, `ano`, `uf`, `instrumento`, `programaOrigem`, `idConvenioTransferegov`, `observacao`. `atualizado_em` é definido automaticamente.

**Resposta:** `{ success: true, convenio: { ... } }` com o registro atualizado. Em erro: `{ success: false, message: "..." }` com status `400`.

**Efeito colateral:** grava `profor_convenios_monitorados` no Postgres/Supabase pelo backend via `DATABASE_URL`; atualiza `atualizado_em`.

**Publicação estática:** não.

**Frontend consumidor:** nenhum ainda; rota disponível para uso futuro.

**Observações de manutenção:** id inexistente retorna erro `400` controlado; campos fora da whitelist são ignorados silenciosamente.

#### POST /api/profor-2022/convenios-monitorados/:id/inativar

**Finalidade:** inativar logicamente um convênio monitorado, definindo `ativo = 0`. Não exclui o registro.

**Serviço chamado:** `inativarConvenioMonitorado(id)`, de `backend/services/profor-2022/convenios-monitorados-service.js`.

**Tipo:** escrita.

**Payload:** não obrigatório (body ignorado).

**Resposta:** `{ success: true, convenio: { ... } }` com o registro inativado. Em erro: `{ success: false, message: "..." }` com status `400`.

**Efeito colateral:** atualiza `ativo = 0` e `atualizado_em` em `profor_convenios_monitorados`.

**Publicação estática:** não.

**Frontend consumidor:** nenhum ainda; rota disponível para uso futuro.

**Observações de manutenção:** id inexistente ou já inativo retorna erro `400` controlado; a exclusão física nunca deve ocorrer nesta rota.

#### POST /api/profor-2022/detru/atualizar

**Finalidade:** disparar administrativamente a atualização do cache DETRU da carteira PROFOR 2022.

**Serviço chamado:** `atualizarCacheDetruProfor2022(opcoes)`, de `backend/services/profor-2022/profor-detru-update-service.js`.

**Tipo:** escrita local/API.

**Payload:** opcional. Aceita `{ caminhoZip }` em camelCase. Quando ausente, o serviço usa o arquivo configurado ou local por meio de `garantirArquivoDetruAtualizado()`.

**Resposta:** confirmada. Em sucesso retorna `{ success: true, message, totalSalvos, resultadoResumo, ultimaAtualizacao }`. Em erro retorna `{ success: false, message }` com status controlado.

**Efeito colateral:** lê o ZIP configurado/local, calcula hash, registra início e fim da atualização, faz cruzamento com a carteira e salva o snapshot no cache DETRU do Postgres/Supabase. Não publica JSONs estáticos e não altera o schema.

**Publicação estática:** não.

**Frontend consumidor:** botão "Atualizar DETRU" na Carteira Monitorada da página PROFOR 2022.

**Observações de manutenção:** rota local/API בלבד. Não existe no modo estático/GitHub Pages. Não processa ZIP no frontend e não deve ser usada para download direto pelo navegador. Exige os guards de ambiente/localidade e `PROFOR_ADMIN_TOKEN`; ver a seção 11 de `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md`.

#### POST /api/profor-2022/atualizar — legada/descontinuada

**Finalidade:** manter resposta explícita para clientes legados. Esta rota não executa atualização consolidada.

**Serviço chamado:** nenhum.

**Tipo:** endpoint descontinuado.

**Payload:** ignorado.

**Resposta:** HTTP `410 Gone`, com `success: false` e mensagem que orienta o uso dos fluxos dedicados.

**Efeito colateral:** nenhum. Não chama serviço, não consulta rede, não grava cache e não publica dados.

**Fluxos atuais separados:** `POST /api/profor-2022/detru/atualizar`, `POST /api/profor-2022/rendimentos/atualizar`, `POST /api/profor-2022/pad/atualizar-transferegov`, `POST /api/profor-2022/pad/recarregar` e `POST /api/profor-2022/pad/recarregar-operacional`. Para leitura, usar `GET /api/profor-2022/consolidado`.

**Token administrativo:** as cinco rotas sensíveis de escrita listadas acima exigem `PROFOR_ADMIN_TOKEN`, além dos guards existentes. Os headers aceitos e o procedimento operacional estão documentados na seção 11 de `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md`.

**Observações de manutenção:** chamadas antigas devem migrar para o fluxo dedicado correspondente; o retorno `410` é intencional.

#### GET /api/profor-2022/atualizacao/status

**Finalidade:** retornar diagnóstico agregado, somente leitura, dos fluxos separados do PROFOR 2022: origem efetiva, última atualização DETRU, última consulta de rendimentos e diagnóstico do consolidado.

**Serviço chamado:** `resolverOrigemDadosProfor2022({ detalhado: true })`, `obterUltimaAtualizacaoDetru()`, `obterUltimaConsultaRendimentos()` e `montarConsolidadoProfor2022({ origemDados: "banco-cache", planoAplicacao })` em modo somente leitura.

**Tipo:** leitura local/API.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna `{ success: true, origemDados, origemAvisos, ultimaAtualizacaoDetru, ultimaConsultaRendimentos, diagnosticoConsolidado, geradoEmConsolidado, avisos }`. `ultimaAtualizacaoDetru` e `ultimaConsultaRendimentos` podem vir `null` quando não houver registro. Falhas pontuais em cada bloco são agregadas em `avisos`, mantendo a resposta com `success: true`.

**Efeito colateral:** nenhum. Não consulta rede externa, não atualiza cache, não publica JSONs. A montagem do consolidado em memória lê a planilha local apenas para extrair o plano de aplicação.

**Publicação estática:** não.

**Frontend consumidor:** linha de status "Última atualização consolidada" no painel da Carteira Monitorada (apenas no modo local/API).

**Observações de manutenção:** rota local/API. Não existe no modo estático/GitHub Pages.

#### GET /api/profor-2022/detru/ultima-atualizacao

**Finalidade:** retornar o status básico da última atualização DETRU registrada.

**Serviço chamado:** `obterUltimaAtualizacaoDetru()`, de `backend/services/profor-2022/profor-detru-cache-service.js`.

**Tipo:** leitura local/API.

**Payload:** não se aplica.

**Resposta:** confirmada. Em sucesso retorna `{ success: true, ultimaAtualizacao }`; quando não houver registro, `ultimaAtualizacao` vem como `null`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** status da Carteira Monitorada na página PROFOR 2022.

**Observações de manutenção:** rota local/API בלבד. Não existe no modo estático/GitHub Pages. O frontend deve tratar ausência de atualização sem quebrar a tela.

### FAF 2021

#### GET /api/faf2021

**Finalidade:** retornar itens FAF 2021 persistidos no Postgres/Supabase.

**Serviço chamado:** `listarFaf2021()`, de `backend/services/faf-2021-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica.

**Resposta:** confirmada. Retorna `{ success: true, itens: [...] }`.

**Efeito colateral:** nenhum.

**Publicação estática:** não.

**Frontend consumidor:** consumidor direto não confirmado nesta inspeção. A tela FAF 2021 usa `obterDadosFaf2021()` e dados carregados por `carregarDadosAplicacao`; a rota existe no backend local.

**Observações de manutenção:** antes de remover ou alterar esta rota, buscar consumidores externos ou futuros, pois ela está confirmada no servidor.

#### POST /api/faf2021/salvar

**Finalidade:** salvar valor executado e observação de execução de item FAF 2021.

**Serviço chamado:** `salvarExecucaoFaf2021(payload)`, de `backend/services/faf-2021-service.js`.

**Tipo:** escrita; publicação indireta.

**Payload:** confirmado. Usa `lerJsonBody`. O frontend envia `password`, `itemId`, `uf`, `objeto`, `valorExecutado` e `observacaoExecucao`.

**Resposta:** confirmada. Em sucesso, o serviço retorna `success: true`, `message`, `itemId` e `atualizadoEm`.

**Efeito colateral:** grava Postgres/Supabase pelo backend via `DATABASE_URL`; não publica automaticamente os dados estáticos nesta rota.

**Publicação estática:** não.

**Frontend consumidor:** `salvarExecucaoFaf2021()` em `frontend/js/app.js`.

**Observações de manutenção:** este fluxo não usa o SQLite legado nem grava `backend/data/aplicacao.json`; a persistência atual ocorre no Postgres/Supabase.

## Rotas de arquivos estáticos

O mesmo servidor local entrega arquivos estáticos por `enviarArquivoEstatico(req, res, pathname)`.

Comportamento confirmado:

- `/` resolve para `index.html`;
- demais caminhos removem barras iniciais e tentam resolver arquivo relativo à raiz do repositório;
- há proteção contra path traversal por `path.resolve(...)` e verificação `startsWith(rootDir)`;
- caminho fora da raiz retorna `403` JSON com `success: false`;
- arquivo inexistente retorna `404` JSON com `success: false`;
- arquivo existente retorna `200`, `Cache-Control: no-store` e `Content-Type` conforme extensão conhecida.

Observação de manutenção: como a entrega estática parte da raiz do repositório local, não colocar arquivos sensíveis acessíveis sob caminhos servidos pelo servidor.

## Rotas não confirmadas ou inexistentes

Não há rota local específica confirmada em `backend/server.js` para:

- Dashboard geral, como `/api/dashboard` ou equivalente;
- Contatos das UFs, como `/api/contatos` ou equivalente;
- Status do Sistema, como `/api/status-sistema` ou equivalente.

Essas áreas usam dados carregados pelo frontend, serviços de dados ou JSONs publicados, conforme documentado em `fluxo-dados.md`.

Não há rota de reversão de histórico confirmada para:

- Formalização PROFOR;
- Orçamento 2026.

Não há rota de exportação Excel confirmada para:

- Dashboard geral;
- FAF 2021;
- Contatos das UFs;
- Status do Sistema.

## Publicação estática por rota

Rotas que acionam `publicarAposSalvamento` quando o serviço retorna `success: true`:

- `POST /api/orcamento-2026/salvar`;
- `POST /api/orcamento-2026/processos-vinculados/criar`;
- `POST /api/orcamento-2026/saldos/alocar`;
- `POST /api/orcamento-2026/frentes/salvar`.

Parâmetros Mínimos, Formalização PROFOR e FAF 2021 não acionam publicação estática automática nas rotas de salvamento atuais. Rotas de leitura, histórico e exportação também não acionam publicação estática.

`publicarAposSalvamento` chama `publicarDadosEstaticos()` de `backend/services/static-publication-service.js`. Em sucesso, adiciona `publicacaoEstatica` à resposta. Em falha de publicação, mantém a alteração local e retorna `warning: true` com detalhes da falha de publicação.

## Exportações

Exportações Excel confirmadas:

- `GET /api/parametros-minimos/exportar` → `exportarParametrosMinimosExcel()` → `parametros-minimos.xlsx`;
- `GET /api/formalizacao-profor/exportar` → `exportarFormalizacaoProforExcel()` → `formalizacao-profor.xlsx`;
- `GET /api/orcamento-2026/exportar` → `exportarOrcamento2026Excel()` → `orcamento-2026.xlsx`.

As exportações usam `backend/services/excel-export-service.js` e retornam buffer com `Content-Type` de planilha.

## Códigos de resposta e tratamento de erro

Padrões confirmados em `backend/server.js`:

- `enviarJson` define `Content-Type: application/json; charset=utf-8` e cabeçalhos CORS básicos.
- `OPTIONS` em qualquer caminho iniciado por `/api/` retorna `204`.
- Rotas `GET` de leitura e histórico retornam `200` quando executadas sem exceção.
- Rotas `POST` de escrita retornam `200` quando `resposta.success` é verdadeiro e `400` quando é falso.
- Rotas de exportação retornam `200` com buffer `.xlsx`.
- Endpoint `/api/` não mapeado retorna `404` com `{ success: false, message: "Endpoint não encontrado." }`.
- Exceções dentro de `rotearApi` retornam `500` com `{ success: false, message }`.
- JSON inválido em `lerJsonBody` cai no tratamento geral de exceção no estado atual.

## Relação com o frontend

`frontend/js/app.js` consome as rotas locais por `fetchJsonApiOnasp` ou por navegação direta para exportação.

Chamadas confirmadas no frontend:

- Parâmetros Mínimos: salvar, histórico, reversão e exportação.
- Formalização PROFOR: salvar, histórico e exportação.
- Orçamento 2026: movimentações, alocação de saldo, criação de processo vinculado, salvamento geral, histórico e exportação.
- FAF 2021: salvamento de execução.

`backend/services/data-service.js` também chama:

- `GET /api/parametros-minimos`;
- `GET /api/formalizacao-profor`;
- `GET /api/orcamento-2026`.

Consumidor frontend direto de `GET /api/faf2021` não foi confirmado nesta inspeção.

No modo estático/GitHub Pages, `frontend/js/core/static-mode.js` bloqueia controles com `data-requer-backend="true"` e a aplicação usa JSONs publicados em vez das rotas locais.

## Relação com o banco e serviços

Relação em alto nível:

- Parâmetros Mínimos usa `parametros-minimos-service.js` e Postgres/Supabase via `DATABASE_URL`.
- Formalização PROFOR usa `formalizacao-profor-service.js` e Postgres/Supabase via `DATABASE_URL`.
- Orçamento 2026 usa `orcamento-2026-service.js` e Postgres/Supabase via `DATABASE_URL`, incluindo movimentações de saldo.
- PROFOR 2022 — carteira, caches DETRU/rendimentos e revisão PAD usam serviços em `backend/services/profor-2022/` sobre Postgres/Supabase; scripts SQLite remanescentes são legados e protegidos por guard específico.
- FAF 2021 usa `faf-2021-service.js` e Postgres/Supabase via `DATABASE_URL`.
- Histórico usa `historico-service.js`.
- Exportações usam `excel-export-service.js`.
- Publicação estática usa `static-publication-service.js`.

O schema completo das tabelas, tipos, chaves, constraints e evolução incremental não deve ser detalhado neste arquivo.

### Sistema — Logs operacionais (local/API)

#### GET /api/sistema/logs-operacionais

**Finalidade:** listar os últimos logs operacionais gravados em `logs_operacionais`, ordenados do mais recente para o mais antigo.

**Serviço chamado:** `listarLogsOperacionais(filtros)`, de `backend/services/logs-operacionais-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica. Aceita query string com `modulo`, `tipo_evento`, `status`, `limite` (limite máximo 200; padrão 50).

**Resposta:** confirmada. Retorna `{ success: true, total, logs }`, onde cada log expõe `id`, `modulo`, `tipoEvento`, `status`, `iniciadoEm`, `concluidoEm`, `duracaoMs`, `resumo`, `criadoEm`.

**Efeito colateral:** nenhum.

**Publicação estática:** não. Indisponível no modo estático.

**Frontend consumidor:** painel "Logs operacionais" em `frontend/js/app.js` (apenas modo local/API).

**Observações de manutenção:** não retornar payload bruto nesta rota; usar `/:id` para detalhe. Não expor no GitHub Pages.

#### GET /api/sistema/logs-operacionais/:id

**Finalidade:** retornar o detalhe sanitizado de um log operacional específico.

**Serviço chamado:** `obterLogOperacionalPorId(id)`, de `backend/services/logs-operacionais-service.js`.

**Tipo:** leitura.

**Payload:** não se aplica. `id` numérico positivo na URL.

**Resposta:** confirmada. Retorna `{ success: true, log: { ..., payload } }` com payload já sanitizado por `sanitizarPayloadLog`.

**Efeito colateral:** nenhum.

**Publicação estática:** não. Indisponível no modo estático.

**Frontend consumidor:** botão opcional "Ver detalhe" do painel "Logs operacionais" em `frontend/js/app.js`.

**Observações de manutenção:** nunca incluir cookies, SAML, tokens, segredos de ambiente ou caminhos locais. A sanitização ocorre no serviço; alterações devem preservar a lista de padrões proibidos.

#### GET /api/sistema/logs-operacionais/export

**Finalidade:** exportar logs operacionais em JSON ou CSV para análise externa.

**Serviço chamado:** `exportarLogsOperacionaisJson(filtros)` ou `exportarLogsOperacionaisCsv(filtros)`, de `backend/services/logs-operacionais-service.js`.

**Tipo:** exportação.

**Payload:** não se aplica. Query string com `formato=json|csv` (padrão `json`), além de `modulo`, `tipo_evento`, `status`, `limite` (limite máximo 2000; padrão 500).

**Resposta:** confirmada. Retorna arquivo com `Content-Disposition: attachment` (`logs-operacionais.json` ou `logs-operacionais.csv`). Formato inválido devolve `400`.

**Efeito colateral:** nenhum.

**Publicação estática:** não. Indisponível no modo estático.

**Frontend consumidor:** botões "Exportar JSON" e "Exportar CSV" do painel "Logs operacionais" em `frontend/js/app.js`.

**Observações de manutenção:** payload sanitizado tanto no JSON quanto no JSON compactado dentro do CSV. CSV usa `;` como delimitador e escapa aspas/quebras de linha conforme convenção brasileira.

## O que deve ser detalhado em schema-banco.md

`schema-banco.md` deve documentar:

- tabelas usadas pelas rotas;
- colunas;
- tipos;
- chaves primárias;
- chaves únicas;
- constraints;
- campos de auditoria;
- colunas adicionadas por evolução;
- relações entre tabelas e serviços;
- riscos de migração e rollback.

Este arquivo deve manter foco em rotas, payloads operacionais e efeitos colaterais.

## Riscos e cuidados ao alterar rotas

- Quebrar payload esperado pelo frontend.
- Alterar formato de resposta sem atualizar consumidores.
- Salvar dados sem registrar histórico quando o fluxo exige rastreabilidade.
- Salvar dados sem acionar publicação estática em rota que alimenta modo publicado.
- Acionar publicação estática indevidamente em rota de leitura ou exportação.
- Quebrar exportação Excel por mudança de serviço ou `Content-Type`.
- Quebrar modo local/API ao alterar caminhos sob `/api/`.
- Presumir que GitHub Pages usa API local.
- Alterar status code sem validar consumidores.
- Remover rota existente sem buscar referências no frontend, serviços, testes e memória.
- Expor arquivos locais sensíveis pela entrega estática ao adicionar arquivos sob a raiz servida.

## Critérios para atualizar este arquivo

Atualizar este arquivo quando houver:

- nova rota em `backend/server.js`;
- remoção ou renomeação de rota;
- mudança de método HTTP;
- mudança em payload esperado;
- mudança em formato de resposta;
- mudança em serviço chamado por endpoint;
- mudança em publicação estática após salvamento;
- nova exportação;
- novo fluxo de histórico ou reversão;
- alteração relevante no modo local/API ou no bloqueio do modo estático;
- mudança em tratamento de erro ou status code.
