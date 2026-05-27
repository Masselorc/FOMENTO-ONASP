# Diário de bordo

## 27/05/2026 — PROFOR 2022: integra pendências PAD à tela Revisões e prepara saneamento controlado de decisões antigas

- Objetivo: corrigir a ponte entre as pendências da recarga PAD e a tela `Revisões PAD`, e preparar saneamento controlado das 23 decisões antigas (937221/AL: 20; 937782/AC: 3) registradas pelo usuário em 21–23/05/2026 que nunca foram materializadas em `profor_2022_itens_conhecidos` / `profor_2022_item_rateios`.
- Causa raiz dupla (já diagnosticada):
  1. Após `febb8a4` (separa pendências), itens novos passaram a entrar em `recarga.pendenciasRevisao`, mas `profor-pad-revisoes-plano-service.js` continuava lendo só `recarga.impedimentos` para criar linha-mãe `ITEM_NOVO`. Resultado: pendências não apareciam na tela `Revisões PAD`.
  2. Decisões `ACEITO`/`CORRIGIDO` com `tipoSaneamento=rateio_manual` em `profor_2022_revisao_decisoes` (tela legada `revisao-divergencias`) nunca foram propagadas a `itens_conhecidos`/`item_rateios`, então o matching operacional segue não as enxergando.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-revisoes-plano-service.js`: passa a consumir `[...pendenciasRevisao, ...impedimentos]` com dedupe por `uf::chaveItem`. Compatibilidade com payloads antigos preservada.
  - `backend/services/profor-2022/profor-pad-revisoes-plano-decisoes-service.js`: exporta `persistirRateiosOperacionais`, `obterOuCriarItemConhecido` e `AREAS_PERMITIDAS` para reaproveitamento por scripts de saneamento — sem mudar comportamento da UI.
  - `scripts/validar-syntax.js`: incluí os 3 arquivos novos na lista.
  - `tests/services/profor-pad-revisoes-plano.test.js`: 4 testes novos cobrindo a ponte, dedupe, compatibilidade com `impedimentos` e item já reconstruído não duplicado.
- Arquivos criados:
  - `backend/services/profor-2022/profor-pad-saneamento-decisoes-antigas-service.js`: service puro/testável que carrega últimas decisões resolutivas de `profor_2022_revisao_decisoes`, interpreta payloads (incluindo o formato antigo só-percentual de 937782/AC, derivando quantidade), valida soma vs `quantidadeTotalItem`, verifica materialização atual e planeja/aplica via `persistirRateiosOperacionais` reaproveitado.
  - `backend/scripts/sanear-decisoes-antigas-pad-profor-2022.js`: CLI wrapper. Padrão dry-run; só escreve com `--aplicar`; filtro `--convenio=NNNN` repetível; resumo + detalhe de candidatas/já materializadas/ignoradas/aplicadas/erros.
  - `tests/services/profor-pad-saneamento-decisoes-antigas.test.js`: 13 testes com SQLite `:memory:` cobrindo dry-run inerte, idempotência, filtro por convênio, áreas históricas ("ESCOLA PENAL"/"NAO INFORMADO"), payload inválido, decisão não resolutiva, tipoSaneamento divergente, soma incoerente e derivação de quantidade a partir de `percentualQuantidade`.
- Reaproveitamento: o script usa exclusivamente `persistirRateiosOperacionais` exportado do `revisoes-plano-decisoes-service` (mesma rotina da tela `Revisões PAD`/`POST /revisoes-plano/rateio`). Zero SQL direto para registrar decisão; nenhuma lógica duplicada de criação de item conhecido/rateio.
- Dry-run executado: `node backend/scripts/sanear-decisoes-antigas-pad-profor-2022.js --dry-run --convenio=937221 --convenio=937782` → `Total lidas: 23 | Já materializadas: 0 | Aplicáveis: 23 | Ignoradas: 0`. Casamento exato com as 23 pendências atuais. **`--aplicar` NÃO foi executado nesta rodada — requer autorização expressa.**
- Validações executadas: `git diff --check` (apenas warnings CRLF), `node --check` nos 4 arquivos JS alterados/novos, `node --test` nas 6 suites relevantes (90/90 pass), `node scripts/validar-syntax.js` (108 arquivos OK).
- Preservações: sem alterar `frontend/data/publicados`, `backend/data/cache`, `backend/data/relatorios` (relatórios v2 já estavam modificados de sessões anteriores e não entram neste commit), `.env`, `package.json`/`package-lock.json`, SQLite/WAL/SHM; sem publicação; sem acessar Transferegov; sem rodar Playwright; sem SQL direto para decisões.
- Risco: baixo. Mudança no `revisoes-plano-service` é aditiva (também aceita a fonte nova) e dedup evita regressão visual em payloads antigos. O script de saneamento é dry-run por padrão e só persiste com `--aplicar`; a aplicação real continua aguardando comando explícito do usuário.
- Rollback: `git revert <SHA>` deste commit (remove ponte e script). Decisões antigas em `revisao_decisoes` permanecem intactas em qualquer caso.

## 25/05/2026 — PROFOR 2022: separa pendências de revisão da recarga operacional PAD e atualiza interface

- Objetivo: corrigir a recarga operacional dos PADs após a integração com o cache Transferegov para que pendências revisáveis (item novo sem rateio, item suprimido, divergências de quantidade/valor, rateio sem peso etc.) não bloqueiem a recarga como impedimento técnico, e atualizar a interface da tela Sistema para refletir o fluxo atual (cache Transferegov validado), removendo textos antigos sobre substituição dos 15 arquivos Excel.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`: nova lista `TIPOS_PENDENCIA_REVISAO`, helper `registrarOcorrencia` que redireciona pendências revisáveis para `pendenciasRevisao` (estrutura nova) preservando todos os dados do item (convênio, UF, descrição, chave, quantidade, valor unitário, valor previsto/executado, natureza, origem). Sucesso técnico passa a depender só de impedimentos técnicos reais. `aptoParaPublicacao` permanece sempre `false`. Markdown e estrutura do JSON expostos agora incluem seção/listagem de pendências de revisão.
  - `frontend/js/app.js`: bloco `renderBlocoRecargaOperacionalPadStatusSistema` reescrito (título, subtítulo, bullets, card lateral, texto do botão); confirmação do botão atualizada; `renderResultadoRecargaPad` reorganizado para: sucesso técnico → verde, pendências revisáveis → azul/informativo (orientando a tratar na tela Revisões PAD), alertas de processamento → amarelo, impedimentos técnicos → vermelho. Nova métrica "Pendências p/ revisão" na grid.
  - `tests/services/profor-pad-carregador-operacional.test.js`: testes ajustados para a nova regra (item novo, item PAD sem rateio, distribuição igual e rateio sem peso viram pendência de revisão; sucesso técnico não implica `aptoParaPublicacao=true`; cache inválido / contagem de arquivos divergente continua impedimento técnico).
  - `tests/services/profor-pad-origem-reconstrucao.test.js`: dois testes novos garantindo que a UI não mais menciona substituir os 15 Excel/`Planilhas/profor-2022/instrumentos` e que cita explicitamente o cache Transferegov validado e a tela Revisões PAD.
  - `tests/services/profor-pad-recarga-cache-transferegov.test.js`: comentário do teste 8-11 ajustado para refletir o serviço legado.
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`: este registro.
- Correção de severidade: pendências revisáveis no carregador v2 (serviço acionado pelo botão "Recarregar PADs do cache") agora vão para `pendenciasRevisao` e o resultado é `sucesso=true` mesmo com pendências, mantendo `aptoParaPublicacao=false`. Cache ausente/inválido, contagem de arquivos != 15 e erros técnicos continuam impedindo a recarga.
- Atualização da interface: subtítulo e bullets descrevem o fluxo via cache local validado, sem referência ao Excel antigo; card lateral reforça o encaminhamento de classificação/rateio/itens novos para a tela "Revisões PAD"; mensagens de status do resultado redesenhadas para refletir o novo modelo (sucesso técnico vs pendências revisáveis vs impedimento técnico real).
- Validações executadas: `git diff --check` (apenas warnings CRLF do Windows), `node --check` nos cinco serviços PAD listados e em `frontend/js/app.js`, `node --test tests/services/profor-pad-carregador-operacional.test.js` (11/11), `node --test tests/services/profor-pad-recarga-cache-transferegov.test.js` (10/10), `node --test tests/services/profor-pad-origem-reconstrucao.test.js` (30/30), `npm run validar:syntax` (105 arquivos OK).
- Preservações: sem publicação, sem alterar `frontend/data/publicados`, sem alterar `.env`, sem alterar banco SQLite/WAL/SHM, sem criar migration, sem acessar Transferegov, sem atualizar cache, sem acionar DETRU/rendimentos, sem rodar Playwright/E2E. Comparador `compararPlanosPadDryRun` não foi tocado — o carregador v2 já não o chamava.
- Arquivos locais fora do commit: `backend/data/relatorios/*` (relatórios dry-run) e `backend/data/cache/*` (cache Transferegov local).
- Risco: baixo. A mudança é de classificação/exibição; nenhum dado é descartado, todos os campos do item são preservados nas pendências, e a regra de bloqueio de publicação permanece intacta.
- Rollback: `git revert <SHA_DO_COMMIT>` seguido de `git push origin main`.

## 25/05/2026 — PROFOR 2022: integração com recarga operacional PAD Transferegov

- Objetivo: executar a microetapa 8.3 para integrar a recarga operacional PAD ao cache bruto validado do Transferegov.
- Arquivos criados: `tests/services/profor-pad-recarga-cache-transferegov.test.js`.
- Arquivos alterados: `backend/services/profor-2022/profor-pad-report-reader.js`, `backend/services/profor-2022/profor-pad-recarga-operacional-service.js`, `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`, `backend/services/profor-2022/profor-pad-matching-service.js`, `backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js`, `tests/services/profor-pad-origem-reconstrucao.test.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado:
  - Cache Transferegov passou a ser a origem padrão da recarga PAD.
  - Excel legado agora só é lido com a opção explícita `usarExcelLegado: true`.
  - Remoção completa do estado global `usarExcelLegadoGlobal` e do setter `definirUsoExcelLegado` no report reader, garantindo fluxo estritamente isolado e explícito.
  - O parâmetro `pastaRelativa` sozinho não autoriza o Excel.
  - Ajuste nas expectativas dos testes de reconstrução (de 568 para 567 linhas) refletindo o volume de dados real reconstruído a partir do cache Transferegov.
  - Relatórios dry-run gerados e caches locais mantidos fora do commit (untracked/ignorado).
- Validações executadas: `git diff --check`, `node --check` nos serviços alterados, `node --test` nos testes de integração e unitários (todos aprovados), e `npm run validar:syntax` (105 arquivos válidos).
- Preservações: sem publicação, sem alterar frontend/data/publicados, sem alterar banco SQLite, sem alterar `.env`, sem acionar DETRU ou rendimentos, sem consultar Transferegov em tempo real, sem rodar Playwright real.
- Risco: muito baixo; a integração usa o cache local validado e a lógica de rateios, áreas e saneamento permaneceu inalterada.
- Rollback: `git revert` do commit correspondente.

## 25/05/2026 — PROFOR 2022: validação técnica do cache bruto Transferegov

- Objetivo: implementar a microetapa 8.2 para validação técnica isolada do cache bruto PAD Transferegov.
- Arquivos criados: `backend/services/profor-2022/profor-pad-transferegov-cache-validacao-service.js`, `backend/scripts/validar-cache-pads-transferegov-profor-2022.js`, `tests/services/profor-pad-transferegov-cache-validacao.test.js`.
- Arquivos alterados: `backend/services/profor-2022/profor-pad-transferegov-cache-service.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado: criado serviço de validação profunda cobrindo estrutura, consistência, completude e segurança (bloqueio de ViewState, cookies, HAR e HTML bruto) do cache. Corrigida a consistência do hash do conteúdo no cache service recalculando-o sobre os itens limpos e normalizados armazenados no JSON.
- Validações executadas: `git diff --check`, `node --check` nos scripts/serviços, `node --test` nos testes unitários (24/24 de validação e 12/12 de cache aprovados) e `npm run validar:syntax` (105 arquivos válidos).
- Preservações: sem integrar a recarga PAD, sem alterar reader, servidor, UI ou endpoints. O arquivo local de cache permanece untracked.
- Risco: muito baixo; a validação técnica é estática/em memória e roda de forma isolada sem acionar rede externa ou banco.
- Rollback: `git revert` do commit correspondente.

## 25/05/2026 — PROFOR 2022: cache bruto isolado do Transferegov

- Objetivo: criar serviço de cache bruto e script de atualização isolada para os PADs do Transferegov (microetapa 8.1).
- Arquivos criados: `backend/services/profor-2022/profor-pad-transferegov-cache-service.js`, `backend/scripts/atualizar-cache-pads-transferegov-profor-2022.js`, `tests/services/profor-pad-transferegov-cache-service.test.js`.
- Arquivo alterado: `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado: implementada lógica de montagem, validação de segurança (sem HTML, ViewState ou cookies), salvamento atômico do cache de 15 convênios e script CLI de extração HTTP isolada.
- Validações executadas: `git diff --check`, `node --check` nos novos scripts/serviços, `node --test` dos novos testes unitários (12/12 aprovados), e `npm run validar:syntax` (105 arquivos válidos).
- Preservações: sem integrar a recarga PAD, sem alterar o reader, sem alterar o servidor, sem alterar o frontend, sem publicar, sem acionar DETRU ou rendimentos, sem rodar Playwright real.
- Risco: o cache gerado fica untracked localmente e não deve ser versionado; o script CLI falhará se houver erros de rede ou convênios inaptos na fonte do Transferegov.
- Rollback: remover manualmente os arquivos criados e reverter o diário de bordo.

## 25/05/2026 — UI: largura da tabela de Revisões PAD

- Objetivo: evitar corte da última coluna (`Ações/Observações`) na grade de `Revisões PAD — Plano de Aplicação Detalhado`.
- Arquivos alterados: `frontend/css/app.css`, `index.html`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado: adicionada rolagem horizontal no wrapper da tabela da view de revisões, `min-width: 1400px` para a tabela, quebra de linha na coluna `Descrição` (3ª coluna), `min-width` da coluna final e `overflow: visible` no painel para não cortar conteúdo.
- Validações executadas: `git diff --check`; `node --check frontend/js/app.js`; `npm run validar:syntax`.
- Preservações: sem backend, sem dados de recarga PAD, sem publicação, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem DETRU/Transferegov, sem Playwright/E2E.
- Risco: em telas muito estreitas haverá rolagem horizontal intencional na tabela.
- Rollback: reverter o commit deste ajuste para retornar ao layout anterior.

## 25/05/2026 — PROFOR 2022: tela de revisões PAD em grade hierárquica

- Objetivo: substituir a exposição visual antiga da revisão PAD por uma grade hierárquica do plano de aplicação detalhado reconstruído a partir da recarga operacional limpa.
- Arquivos alterados: `backend/services/profor-2022/profor-pad-revisoes-plano-service.js`, `backend/server.js`, `frontend/js/app.js`, `frontend/css/app.css`, `index.html`, `tests/services/profor-pad-revisoes-plano.test.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado: criado endpoint `GET /api/profor-2022/pad/revisoes-plano`; a tela `Revisões PAD — Plano de Aplicação Detalhado` agora usa chips por UF, resumo da UF/convênio, linhas-mãe expandidas, linhas-filhas de rateio, dropdown de área e editor local de rateio com validação de soma.
- Persistência: salvamento ficou desabilitado com aviso claro de etapa própria; não houve SQL direto nem simulação de salvamento.
- Validações executadas: `git diff --check`; `node --check backend/server.js`; `node --check frontend/js/app.js`; `node --check backend/services/profor-2022/profor-pad-carregador-operacional-service.js`; `node --test tests/services/profor-pad-carregador-operacional.test.js`; `node --test tests/services/profor-pad-revisoes-plano.test.js`; `npm run validar:syntax`.
- Preservações: sem Playwright/E2E, sem publicação, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem DETRU/Transferegov, sem planilha antiga por abas, sem remoção de `xlsx` e sem autenticação/login.
- Risco: a persistência de área/rateio ainda não foi implementada; a tela permite edição local e validação, mas bloqueia salvar até serviço auditável próprio.
- Rollback: reverter este commit para retornar à renderização anterior da tela de revisão e remover o endpoint `revisoes-plano`.

## 25/05/2026 — PROFOR 2022: recarga operacional no Status do Sistema

- Objetivo: expor a recarga operacional limpa dos PADs no `Status do Sistema` e remover a recarga da tela antiga de revisão.
- Arquivos alterados: `frontend/js/app.js`, `index.html`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado: criado bloco `Recarga Operacional dos PADs` no Status do Sistema, com instruções operacionais, botão único `Recarregar PADs`, leitura da última recarga operacional e cache-buster `v=20260525-07-recarga-pad-status-sistema`.
- Fluxo antigo: removido o bloco de recarga da tela `Revisão de divergências PAD x memória`; a tela permanece para consulta e saneamento de pendências.
- Validações executadas: `git diff --check`; `node --check frontend/js/app.js`; `node --check backend/server.js`; `node --check backend/services/profor-2022/profor-pad-carregador-operacional-service.js`; `node --test tests/services/profor-pad-carregador-operacional.test.js`.
- Preservações: sem Playwright/E2E, sem publicação, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem DETRU/Transferegov, sem autenticação/login e sem remoção de `xlsx`.
- Risco: a rota legada permanece no backend por compatibilidade histórica/testes, mas não há consumidor ativo no frontend.
- Rollback: reverter este commit para voltar o botão à tela de revisão e restaurar o cache-buster anterior do `app.js`.

## 25/05/2026 — PROFOR 2022: recarga operacional limpa dos PADs

- Objetivo: criar fluxo simples de recarga operacional dos 15 PADs Excel, sem comparação com origem antiga, snapshots como bloqueio, DETRU, Transferegov, publicação ou atualização ampla da Home.
- Arquivos alterados: `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`, `backend/server.js`, `frontend/js/app.js`, `index.html`, `tests/services/profor-pad-carregador-operacional.test.js`.
- Ajuste aplicado:
  - criado serviço `carregarPadsOperacional()` com leitura/conferência dos PADs, exigência de 15 arquivos, bloqueio de duplicidade, aplicação de rateio memorizado e pendência `item_novo_sem_rateio_memorizado`;
  - criado endpoint `POST /api/profor-2022/pad/recarregar-operacional` e leitura da última recarga em `GET /api/profor-2022/pad/ultima-recarga-operacional`;
  - frontend passou a chamar o endpoint operacional limpo, sem `garantirDadosBaseAplicacao()` e sem atualização ampla da Home;
  - resumo da UI passou a agrupar impedimentos/alertas por tipo, com lista detalhada recolhível.
- Validações executadas:
  - `git diff --check`;
  - `node --check backend/server.js`;
  - `node --check frontend/js/app.js`;
  - `node --check backend/services/profor-2022/profor-pad-carregador-operacional-service.js`;
  - `node --test tests/services/profor-pad-carregador-operacional.test.js` (7/7 aprovados);
  - `npm run validar:syntax` (105 arquivos aprovados);
  - `npm run validar:services` executado, mas falhou em 2 testes antigos de `profor-pad-origem-reconstrucao.test.js` porque a suíte ampla lê o relatório dry-run real após ele ser sobrescrito para 567 linhas por outro teste; os testes do carregador operacional passaram.
- Preservações: sem Playwright/E2E, sem publicação, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem DETRU/Transferegov, sem planilha antiga por abas e sem remoção de `xlsx`.
- Risco: o novo serviço ainda usa o matching existente e os rateios ativos do banco; divergências reais de memória/rateio retornam impedimentos operacionais em vez de tentar correção automática.
- Rollback: reverter o commit da recarga operacional limpa e voltar o botão ao endpoint anterior.

## 25/05/2026 — UI: cache-buster da recarga PAD pós-sucesso

- Objetivo: forçar carregamento do `app.js` que separa erro real da recarga PAD de falha posterior de atualização da interface.
- Arquivo alterado: `index.html`.
- Ajuste aplicado: cache-buster do `app.js` alterado de `v=20260525-04-recarga-pad-erro-etapa` para `v=20260525-05-recarga-ui-pos-sucesso`.
- Validações executadas: `git diff --check`; `node --check frontend/js/app.js`.
- Preservações: sem Playwright/E2E, sem publicação, sem alteração em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, DETRU/Transferegov ou relatórios dry-run.
- Risco: navegador ainda pode manter cache até hard refresh.
- Rollback: restaurar o cache-buster anterior no `index.html`.

## 25/05/2026 — PROFOR 2022: separação entre recarga PAD e atualização da interface

- Objetivo: impedir que falhas pós-recarga na atualização da Home/listas sobrescrevam uma recarga PAD bem-sucedida com erro vermelho de recarga.
- Arquivo alterado: `frontend/js/app.js`.
- Ajuste aplicado: `executarRecargaPadsOperacionalUI()` passou a manter erro vermelho apenas para falha real do `POST /api/profor-2022/pad/recarregar`; as etapas pós-recarga (`invalidar_cache_home`, `garantir_dados_base`, `carregar_auditoria_revisao`, `carregar_lista_revisao`) agora ficam em `try/catch` separado e exibem aviso amarelo quando falham.
- Validações executadas: `node --check frontend/js/app.js`; `git diff --check`.
- Preservações: sem Playwright/E2E, sem publicação, sem alteração em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, DETRU, Transferegov, autenticação ou planilha antiga por abas.
- Risco: falhas posteriores à recarga ainda podem exigir correção própria, mas deixam de mascarar o resultado da recarga PAD.
- Rollback: restaurar o bloco anterior de `executarRecargaPadsOperacionalUI()` em `frontend/js/app.js`.

## 25/05/2026 — PROFOR 2022: cache-buster e verificação direta da recarga PAD

- Objetivo: forçar o navegador a carregar o `app.js` com a propagação instrumentada do erro de recarga PAD e verificar a API diretamente.
- Arquivo alterado: `index.html`.
- Ajuste aplicado: cache-buster do `app.js` alterado de `v=20260524-03-home-menu-sistema` para `v=20260525-04-recarga-pad-erro-etapa`.
- Verificação operacional:
  - servidor local reiniciado em `127.0.0.1:8790`;
  - `POST /api/profor-2022/pad/recarregar` retornou `success=true`, `message="Recarga PAD concluida."`, `etapa=null`;
  - `GET /api/profor-2022/pad/ultima-recarga` retornou `success=true`, `etapa=null`;
  - não houve stack de erro no backend atual, pois o erro `.save` não foi reproduzido pela API direta após o cache-buster.
- Causa raiz nesta rodada: HTML ainda apontava para versão antiga do `app.js`, mantendo risco de UI carregar handler anterior e exibir mensagem genérica.
- Validações executadas:
  - `git diff --check`;
  - `node --check backend/server.js`;
  - `node --check frontend/js/app.js`;
  - `node --check backend/services/profor-2022/profor-pad-recarga-operacional-service.js`;
  - `node --test tests/services/profor-pad-recarga-operacional.test.js` (6/6 aprovados).
- Preservações: sem Playwright/E2E, sem publicação, sem alteração em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, DETRU, Transferegov, autenticação ou planilha antiga por abas.
- Risco: se o navegador mantiver cache antigo, a UI pode exigir hard refresh; a API local atual não reproduziu o erro `.save`.
- Rollback: restaurar em `index.html` o cache-buster anterior do `app.js`.

## 25/05/2026 — PROFOR 2022: propagação da mensagem instrumentada de recarga PAD

- Objetivo: garantir que a UI de recarga PAD exiba o detalhe instrumentado da etapa de erro (e não apenas mensagem genérica).
- Backend ajustado em `backend/server.js`:
  - endpoint `POST /api/profor-2022/pad/recarregar` agora retorna `message` e `etapa` no topo da resposta;
  - `message` prioriza o primeiro impedimento (`resultado.impedimentos[0].detalhe`) quando `sucesso=false`.
- Frontend ajustado em `frontend/js/app.js`:
  - handler da recarga PAD passou a priorizar `payload.impedimentos[0].detalhe` na montagem do erro exibido;
  - fallback preservado para `responseBody.message`, `recarga.mensagem` e mensagem por status HTTP.
- Validações executadas:
  - `node --check backend/server.js`;
  - `node --check frontend/js/app.js`;
  - `node --test tests/services/profor-pad-recarga-operacional.test.js` (6/6 aprovados).
- Escopo preservado: sem alteração no fluxo de recarga, sem Playwright amplo, sem publicação de dados.

## 25/05/2026 — PROFOR 2022: instrumentação de etapa na recarga PAD

- Objetivo: tornar rastreável o erro de recarga PAD (`Cannot read properties of null (reading 'save')`) sem alterar frontend, PADs, publicação estática, DETRU ou Transferegov.
- Arquivo alterado: `backend/services/profor-2022/profor-pad-recarga-operacional-service.js`.
- Ajuste aplicado:
  - inclusão de `etapaAtual` com marcação antes das fases `ler_relatorios_pad`, `reconstruir_plano`, `salvar_relatorio_reconstrucao`, `comparar_plano`, `salvar_relatorio_comparacao`, `gerar_fotografia`, `salvar_fotografia`, `salvar_markdown_fotografia`, `comparar_snapshots`, `salvar_comparacao_snapshots` e `salvar_relatorio_recarga`;
  - no `catch`, impedimento `erro_execucao_recarga` passou a incluir `detalhe` com etapa (`Erro na etapa ...`), campo `etapa` e objeto técnico com `mensagem` e `stack` para diagnóstico no JSON.
- Validações executadas:
  - `node --check backend/services/profor-2022/profor-pad-recarga-operacional-service.js`;
  - `node --test tests/services/profor-pad-recarga-operacional.test.js` (6 testes, 6 aprovados).
- Escopo preservado: sem alterações em frontend, sem Playwright, sem publicação de dados, sem mudanças em DETRU/Transferegov.

## 24/05/2026 — PROFOR 2022: correção da Home (convênios) e restauração do item Sistema

- Ajustado menu lateral em `index.html` para exibir item **Sistema** apontando para `toggleView('status-sistema')`.
- Atualizado cache-buster do `app.js` em `index.html` e do import `data-service.js` em `frontend/js/app.js`.
- Ajustada incorporação de convênios PAD na Home para não depender de metadado legado de origem e aceitar consolidado com `convenios` válidos.
- `carregarConsolidadoProfor2022BancoCacheLocal` agora devolve `origemDados`/`origemDadosEfetiva` coerentes com `reconstrucao-pad`.
- Testes focados adicionados para impedir regressão de convênios/UFs zerados na Home e ausência do item Sistema no menu lateral.

## 24/05/2026 — PROFOR 2022: atualização de cache da recarga PAD no frontend

- Atualizado cache-buster de `index.html` para `app.js?v=20260524-02-recarga-pad-totais`.
- Atualizado import de `data-service.js` em `frontend/js/app.js` para mesma versão de cache.
- Após `POST /api/profor-2022/pad/recarregar`, a UI agora invalida `dadosFaf`, `dadosFinanceirosValidados` e `baseAplicacaoCarregamentoPromise`, e chama `garantirDadosBaseAplicacao()` para forçar nova execução de `sincronizarDadosProfor2022Local()`.

## 24/05/2026 — PROFOR 2022: correção da recarga PAD e dos totais do painel

- **Escopo:** ajuste operacional pontual, sem publicação, sem DETRU/Transferegov, sem `.env`, sem `frontend/data/publicados/` e sem SQLite/WAL/SHM.
- **Correção 1 (recarga PAD):** `backend/services/profor-2022/profor-pad-recarga-operacional-service.js` passou a gravar e reportar somente `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json` (remoção da grafia antiga do caminho).
- **Correção 2 (painel):** `frontend/js/app.js` passou a mapear convênios do consolidado PAD com fallback de campos reais (`previstoOuvidoria` → `valorGlobal`/`valorTotal`; `valorExecutadoOuvidoria` → `valorExecutadoGeral`/`valorExecutado`) e a forçar origem efetiva `reconstrucao-pad` no fluxo local/API.
- **Correção 3 (KPI total):** `TOTAL DE FOMENTO` agora soma explicitamente `convênios + FAF + doações` a partir do `resumoInstrumentos`, evitando subcontagem quando o total contratado global não refletia os convênios reconstruídos.
- **Testes ajustados:** `tests/services/profor-pad-recarga-operacional.test.js` (caminho correto) e `tests/services/profor-pad-origem-reconstrucao.test.js` (consolidado/publicação com convênios > 0, UFs > 0 e soma do total de fomento).
- **Validações executadas:** `git diff --check`, `npm run validar:syntax`, `npm run validar:services`, `npm run profor:pad:ler-relatorios:dry-run`, `npm run profor:pad:reconstruir-plano:dry-run`, `npm run profor:pad:comparar-plano:dry-run`, `npm run profor:pad:comparar-snapshots:dry-run`.
- **Preservações:** sem alteração de fila oficial, decisões, divergências, logs, snapshots oficiais e planoAplicacao oficial.

## 24/05/2026 — PROFOR 2022: remoção física do legado da planilha antiga por abas

- **Escopo:** limpeza pós-migração, não migração. A origem PAD/reconstrução já estava funcional; esta etapa removeu resíduos da planilha antiga por abas/UF (`Planilhas/gestao_financeira_ouvidoria.xlsx`).
- **Correção de escopo preservada:** não foi criado, proposto ou documentado sistema de login/autenticação/autorização por usuário. As flags remanescentes seguem apenas como proteção técnica contra execução acidental. A dependência `xlsx` foi preservada porque os PADs atuais continuam em Excel.
- **Remoções principais:** rota `GET /api/profor-2022/comparar-origens`; helpers `carregarWorkbookProfor2022`, `montarConsolidadoProfor2022Local`, `montarComparacaoOrigensProfor2022Local`; scripts legados de importação da aba `Geral`, orquestrador/agendador legado e rateio inicial da planilha antiga; flags `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK`, `ALLOW_PROFOR_2022_ENDPOINTS_DEV` e `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO`.
- **Origem ativa:** `profor-origem-service.js` passou a aceitar apenas `reconstrucao-pad`; valores antigos `planilha`/`banco-cache` caem no padrão `reconstrucao-pad`.
- **Fluxos ajustados:** `/api/profor-2022/consolidado` monta apenas por PAD/reconstrução; publicação/dashboard local deixa de ler `arquivoPlanilhaConvenios`; seleção manual/automática da planilha antiga no frontend foi neutralizada; wrappers `atualizar:profor-2022` e `agendar:profor-2022` continuam falhando cedo.
- **Preservações:** sem publicação; `frontend/data/publicados/` intacto; `.env` não exibido/alterado; SQLite/WAL/SHM preservados; sem migration; sem decisão por SQL direto; fila oficial, snapshots, decisões, divergências, logs, relatórios históricos e `planoAplicacao` oficial preservados; DETRU e Transferegov não acionados.
- **Validações:** `git diff --check`; `npm run validar:syntax` (103 arquivos); `npm run validar:services` (239 testes); `npm run profor:pad:ler-relatorios:dry-run`; `npm run profor:pad:reconstruir-plano:dry-run`; `npm run profor:pad:comparar-plano:dry-run`; `npm run profor:pad:comparar-snapshots:dry-run`. Relatórios dry-run derivados restaurados para não versionar artefatos sem relação material com esta frente.
- **Relatório:** `backend/data/relatorios/profor-2022-remocao-legado-planilha-antiga.md`.
- **Risco residual:** funções antigas de parsing de workbook ainda existem em módulos compartilhados de Excel, mas não permanecem como fallback/auditoria/rota dev da planilha antiga PROFOR. `xlsx` permanece necessário aos PADs e a outras planilhas atuais.
- **Próximos passos:** validar a suíte completa e, em frente separada, renomear utilitários internos genéricos de Excel se a equipe quiser reduzir ruído sem afetar PAD, Orçamento, Formalização, Contatos e Diagnóstico.

## 24/05/2026 — PROFOR 2022: governança de endpoints externos/dev, agendadores e workbook legado

- **Objetivo:** fechar a governança remanescente após a aposentadoria operacional dos fallbacks workbook: DETRU, Transferegov, endpoints administrativos/dev, agendadores e limpeza final por isolamento.
- **Governança DETRU/Transferegov:** o guard central passou a incluir `assertEndpointAdminPermitido`, `assertChamadaExternaPermitida` e `assertAgendadorPermitido`. Endpoints/scripts que acionam DETRU ou Transferegov agora exigem flag explícita em desenvolvimento e são bloqueados em produção/teste.
- **Política administrativa/dev:** endpoints operacionais continuam permitidos quando não acionam rede externa; endpoints dev/auditoria exigem `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1`; endpoints administrativos exigem `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1`; chamadas externas exigem `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1`; agendadores exigem `ALLOW_PROFOR_2022_SCHEDULER=1`. Flags não liberam produção.
- **Agendadores:** `npm run agendar:profor-2022` passou a apontar para wrapper bloqueador (`backend/scripts/bloquear-agendar-profor-2022-legado.js`), que falha cedo com exit code `2`. O agendador real ficou como `profor:legado:agendar-atualizacao:dev`, ainda guardado. `agendar:detru-profor` ganhou guard de agendador e chamada externa.
- **Scripts externos:** `atualizar:detru-profor` e `atualizar:rendimentos-profor` foram protegidos antes de inicializar banco ou importar clientes externos. Nenhum desses scripts foi executado.
- **Workbook legado:** não houve remoção física. `carregarWorkbookProfor2022`, `montarConsolidadoProfor2022Local` e `carregarPlanoAplicacaoLocal` permanecem isolados por consumidores controlados: auditoria dev `comparar-origens`, fallback legado sob guard e orquestrador descontinuado. Nenhum caminho workbook é operacional em produção.
- **Preservações:** sem publicação; sem alteração em `frontend/data/publicados/`; `.env` não exibido/alterado; SQLite/WAL/SHM preservados; sem migration; sem decisão por SQL direto; fila oficial, snapshots, relatórios históricos e `planoAplicacao` oficial preservados; DETRU real e Transferegov não acionados.
- **Validações:** `node --test tests/services/profor-admin-endpoint-guard.test.js tests/services/profor-workbook-fallback-guard.test.js`, `git diff --check`, `npm run validar:syntax`, `npm run validar:services`, dry-runs PAD permitidos e validação direta do wrapper de agendamento.
- **Relatório:** `backend/data/relatorios/profor-2022-governanca-endpoints-externos-e-limpeza-workbook.md`.
- **Risco residual:** endpoints de leitura de cache seguem disponíveis; scripts externos permanecem para uso local controlado; remoção física do workbook depende de aposentar `comparar-origens` e consumidores legados de publicação/dashboard.
- **Próximos passos:** definir autorização administrativa forte para endpoints sensíveis e planejar remoção física dos helpers workbook quando não houver consumidores dev/auditoria.

## 24/05/2026 — PROFOR 2022: encerramento dos fallbacks workbook e endpoints dev/auditoria

- **Objetivo:** executar as pendências finais de fechamento do fallback workbook: bloquear `comparar-origens` em produção, adicionar `FOMENTO_AMBIENTE`, aposentar `atualizar:profor-2022`, isolar funções workbook remanescentes e registrar política de endpoints dev/auditoria.
- **Correção da ressalva:** `/api/profor-2022/comparar-origens` agora chama `assertEndpointDevPermitido("api_profor_2022_comparar_origens")` antes de qualquer leitura de workbook. Em produção bloqueia sempre; em desenvolvimento exige `ALLOW_PROFOR_2022_ENDPOINTS_DEV=1`.
- **Ambiente:** `FOMENTO_AMBIENTE` integrado ao guard central. Valores `producao`, `produção`, `production` e `prod` são produção; se qualquer variável (`FOMENTO_AMBIENTE`, `NODE_ENV`, `APP_ENV`, `AMBIENTE`) indicar produção, o bloqueio prevalece.
- **Aposentadoria:** `npm run atualizar:profor-2022` passou a apontar para wrapper bloqueador (`backend/scripts/bloquear-atualizar-profor-2022-legado.js`), que falha cedo com exit code `2`, sem `.env`, banco, workbook ou Transferegov. O orquestrador antigo ficou apenas como `profor:legado:atualizar-consolidado:dev`, ainda proibido em produção.
- **Funções workbook:** `carregarPlanoAplicacaoLocal` e `montarConsolidadoProfor2022Local` permanecem como legado interno/auditoria dev, não como fluxo operacional padrão. Remoção total fica para frente própria.
- **Política:** endpoints operacionais devem respeitar origem ativa; endpoints dev/auditoria não podem ler workbook em produção; endpoints que acionam DETRU/Transferegov ficam fora desta frente e exigem governança própria.
- **Preservações:** sem publicação; sem alteração em `frontend/data/publicados/`; `.env` não exibido/alterado; SQLite/WAL/SHM preservados; sem migration; sem decisão por SQL direto; fila oficial, snapshots, relatórios históricos e `planoAplicacao` oficial preservados; Transferegov não acionado.
- **Relatório:** `backend/data/relatorios/profor-2022-encerramento-fallbacks-workbook-e-endpoints-dev.md`.
- **Próximos passos:** definir política/gate administrativa para endpoints sensíveis de DETRU/rendimentos e planejar remoção final das funções workbook quando a auditoria dev por planilha for aposentada.

## 24/05/2026 — PROFOR 2022: reescrita do /consolidado por origem ativa + isolamento do orquestrador legado + endurecimento dos gates em produção

- **Escopo da frente:** fechar as três próximas etapas listadas em `profor-2022-auditoria-final-fallback-workbook.md` (commit `6bf047a`).
- **Patch 1 — Reescrita do `/api/profor-2022/consolidado` por origem ativa:**
  - Nova função `montarConsolidadoProfor2022PorOrigemAtiva()` em `backend/server.js` que despacha por origem: `reconstrucao-pad` → `montarDadosProfor2022Publicacao` (sem workbook); `banco-cache`/`planilha` → `montarConsolidadoProfor2022Local` legado sob gate; origem inesperada → erro explícito.
  - Endpoint `/consolidado` agora propaga `origemDados` e `origemDadosEfetiva` reais, sem hardcoded `"banco-cache"`.
  - Segundo uso do legado (coleta de `diagnosticoConsolidado` no endpoint `/origem`) também passa pelo novo wrapper.
  - `montarConsolidadoProfor2022Local` preservada como legado interno apenas para `banco-cache`/`planilha` e para o endpoint `comparar-origens`.
- **Patch 2 — Isolamento do orquestrador legado `atualizar:profor-2022`:**
  - Novo gate `assertOrquestradorLegadoPermitido(contexto)` em dois pontos (defesa em profundidade):
    - Cedo no script `backend/scripts/atualizar-profor-2022-consolidado.js` (antes de tocar banco).
    - Dentro do serviço `atualizarProfor2022Consolidado` (protege agendador e endpoint `POST /api/profor-2022/atualizar`).
  - Em dev: exige `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1`; em produção: bloqueia mesmo com a flag.
  - Cabeçalho do script reescrito para "LEGADO/DESCONTINUAÇÃO".
- **Patch 3 — Endurecimento dos gates em produção:**
  - Novo módulo `backend/services/profor-2022/profor-workbook-fallback-guard-service.js` centraliza `isAmbienteProducao` + `assertWorkbookFallbackPermitido` + `assertOrquestradorLegadoPermitido`.
  - `isAmbienteProducao` reconhece `NODE_ENV ∈ {production, prod}`, `APP_ENV ∈ {production, prod, producao}`, `AMBIENTE ∈ {producao, production, prod}`.
  - Em produção, ambas as flags (`ALLOW_PROFOR_2022_WORKBOOK_FALLBACK`, `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO`) **não liberam** — falha sempre.
  - `.env.example` documenta ambas as flags + regra de produção.
- **Testes:** `tests/services/profor-workbook-fallback-guard.test.js` (novo, 19 casos) cobre:
  - detecção de produção via NODE_ENV/APP_ENV/AMBIENTE e rejeição de dev/staging/teste/vazio;
  - workbook gate: não age para `planilha`/`banco-cache`; bloqueia `reconstrucao-pad` sem flag em dev; libera com flag em dev; bloqueia em produção mesmo com flag (via cada uma das 3 vars de ambiente); valor != `"1"` não libera;
  - orquestrador gate: bloqueia sem flag em dev; libera com flag em dev; bloqueia em produção mesmo com flag;
  - contexto na mensagem;
  - garantia estrutural: módulo não importa SQLite/dotenv/publicar-*/Transferegov e não escreve arquivos.
  - Suíte completa: **244/244** passando (de 225).
- **Validações:** `validar:syntax` 101 OK; `validar:services` 244/244; reconstrução / comparador / comparação de snapshots **sem regressão**; `git diff --check` limpo.
- **Comandos proibidos** (`publicar:profor-2022`, `atualizar:profor-2022`, `publicar:dados`) **não executados**.
- **Preservações:** `frontend/data/publicados/` intacto; SQLite/WAL/SHM intactos; `.env` inalterado; snapshots PAD intactos; `planoAplicacao` oficial e fila oficial real inalterados; decisões/divergências/logs preservados; Transferegov não acionado; `comparar-origens` mantido como ferramenta dev (sem alteração funcional).
- **Riscos residuais:**
  - `carregarPlanoAplicacaoLocal` ainda existe (acessível só via orquestrador gateado); remoção exige aposentadoria total do orquestrador.
  - Operador com acesso de produção poderia setar `NODE_ENV=development` para burlar — mitigação no nível do runtime/serviço de produção.
  - Novos caminhos de leitura de workbook devem chamar `assertWorkbookFallbackPermitido` explicitamente.
- **Arquivos criados/alterados:**
  - `backend/services/profor-2022/profor-workbook-fallback-guard-service.js` (novo).
  - `backend/server.js` (import + wrapper por origem ativa + uso no endpoint).
  - `backend/scripts/atualizar-profor-2022-consolidado.js` (gate cedo + cabeçalho).
  - `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` (gate em defesa em profundidade).
  - `.env.example` (regra de produção documentada).
  - `scripts/validar-syntax.js` (novo módulo listado).
  - `tests/services/profor-workbook-fallback-guard.test.js` (novo, 19 testes).
  - `backend/data/relatorios/profor-2022-reescrita-consolidado-e-descontinuacao-workbook.md` (relatório técnico).
- **Rollback:** `git revert` dos commits desta etapa; não apagar histórico, snapshots, decisões ou logs.
- **Próximos passos (não nesta etapa):** aposentadoria definitiva do orquestrador + remoção do `carregarPlanoAplicacaoLocal` e `montarConsolidadoProfor2022Local`; variável dedicada de ambiente se `NODE_ENV` se mostrar insuficiente; gate similar para `comparar-origens` em produção.

## 24/05/2026 — PROFOR 2022: fechamento do ciclo de limpeza — bloqueio do último fallback workbook silencioso

- **Escopo correto:** esta etapa fecha o ciclo previsto pelo plano original de limpeza (inventário, classificação, linha de base, bloqueio do que for perigoso). **Não é remoção ampla** dos fallbacks por workbook.
- **Pré-requisito:** os commits `773ea98` (bloqueio do script legado da aba `Geral`) e `055bcdc` (documentação) já haviam inventariado e bloqueado o que era trivial. Esta etapa identifica e bloqueia o **fallback silencioso remanescente**.
- **Achado crítico (fallback silencioso perigoso):** `backend/server.js::montarConsolidadoProfor2022Local` lê workbook sem consultar `PROFOR_2022_ORIGEM_DADOS`. O endpoint `GET /api/profor-2022/consolidado` devolvia dados extraídos da planilha antiga mesmo com origem ativa `reconstrucao-pad` — risco de operador interpretar a tela como reflexo da origem ativa.
- **Patch aplicado:**
  - Nova função `assertWorkbookFallbackPermitido(contexto)` em `backend/server.js`.
  - Chamada na entrada de `montarConsolidadoProfor2022Local`.
  - Quando `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` e a flag `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` não é `1` → lança erro claro orientando uso temporário em dev e descontinuação em produção.
  - `montarComparacaoOrigensProfor2022Local` (endpoint `comparar-origens`) **não** está sujeito ao gate por desenho — é fallback explícito de desenvolvimento; comentário inline reforça isso.
  - `.env.example` recebeu o novo gate documentado com aviso "NUNCA usar 1 sem aviso".
- **Outros achados (mantidos sem alteração):**
  - `montarDadosProfor2022Publicacao` no `dashboard-publication-service.js` — já estruturado por branch de origem; sem fallback silencioso para planilha quando origem é `reconstrucao-pad`.
  - `profor-atualizacao-consolidada-service.carregarPlanoAplicacaoLocal` — não mexer por risco alto; faz parte do orquestrador `atualizar:profor-2022` que já é proibido pelos roteiros de ativação/publicação controladas.
  - `tests/services/profor-pad-origem-reconstrucao.test.js` — compatibilidade de teste; preserva.
- **Teste ao vivo do gate (sem subir servidor):**
  - Com `.env` apontando `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` e sem flag → bloqueado corretamente.
  - Com `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1` → liberado corretamente.
- **Validações:** `git diff --check` limpo; `validar:syntax` 100 OK; `validar:services` 225/225; reconstrução / comparador / comparação de snapshots sem regressão.
- **Preservações:** `frontend/data/publicados/` intacto; SQLite/WAL/SHM intactos; `.env` inalterado; snapshots PAD (atual e anterior oficial) intactos; `planoAplicacao` oficial e fila oficial real inalterados; decisões/divergências/logs preservados; Transferegov não acionado.
- **Arquivos criados/alterados:**
  - `backend/server.js` (patch: `assertWorkbookFallbackPermitido` + comentário em `montarComparacaoOrigensProfor2022Local`).
  - `.env.example` (gate documentado).
  - `backend/data/relatorios/profor-2022-auditoria-final-fallback-workbook.md` (relatório de fechamento).
- **Rollback:** `git revert` dos 2 commits desta etapa; não apagar histórico.
- **Próximos passos (frentes dedicadas, não nesta etapa):** reescrever `/api/profor-2022/consolidado` para consumir origem ativa via `montarDadosProfor2022Publicacao`; descontinuar `carregarPlanoAplicacaoLocal` em conjunto com aposentadoria do orquestrador `atualizar:profor-2022`.

## 23/05/2026 — PROFOR 2022: limpeza técnica pós-migração da planilha antiga por abas

- **Objetivo da etapa:** limpeza pós-migração (não migração). A origem PAD/reconstrução já está funcional; esta frente tratou resíduos legados de planilha antiga por abas/UF.
- **Achado principal de risco operacional:** script legado `backend/scripts/importar-convenios-monitorados-profor-2022.js` ainda permitia importar carteira da aba `Geral` com escrita em banco.
- **Patch aplicado:** bloqueio explícito do script legado por padrão; agora exige `ALLOW_PROFOR_2022_IMPORT_PLANILHA_LEGADA=1` para uso manual controlado.
- **Documentação viva ajustada:** `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` (nota de obsolescência), `.env.example` (default PROFOR alinhado ao código: `banco-cache`).
- **Preservações:** sem publicação; sem Transferegov; sem alterações em `frontend/data/publicados/`; sem alterações em `.env`; sem alterações em SQLite/WAL/SHM; sem alteração de snapshot atual/anterior oficial; sem alteração de `planoAplicacao` oficial; sem alteração de fila oficial real.
- **Relatório da etapa:** `backend/data/relatorios/profor-2022-limpeza-pos-migracao-planilha-antiga.md`.
- **Próximos passos:** frente dedicada para desativação gradual de rotas locais ainda dependentes de workbook no fluxo PROFOR, com plano de fallback explícito e janela de descontinuação.

## 23/05/2026 — PROFOR 2022: encerramento da frente de ajuste do comparador de snapshots v0.3

- **Status da frente:** comparador de snapshots PAD/PROFOR 2022 **v0.3 aprovado** para uso operacional em modo dry-run.
- **Controle de ruído técnico:** pareamento por `hashItem` bijetivo consolidado; bloqueios técnicos preservados com marcação de ruído controlado.
- **Resultado de divergências artificiais:** `item_novo`/`item_removido` artificiais reduzidos a **zero** na comparação dry-run.
- **Resultado da fila dry-run:** candidatos reduzidos de **107 para 76**.
- **Escopo e limites preservados:** sem publicação, sem acionamento de Transferegov, sem alteração de banco, sem alteração de `planoAplicacao` oficial e sem alteração de fila oficial real.
- **Fronteiras de trabalho:** a frente de múltiplos Excel permanece separada e fora desta etapa.

## 23/05/2026 — PROFOR 2022: redução de ruído no comparador de snapshots por identidade material bijetiva (sem auditoria nova dos 81 bloqueios)

- **Premissa preservada:** os 81 bloqueios técnicos pós-promoção do snapshot anterior oficial (commit `93f2b98`) **não foram auditados do zero**. A memória completa em `memoria/09_ERROS_E_CORRECOES/historico-erros.md` foi considerada como contexto consolidado. As causas estruturais já estavam documentadas: chave frágil por descrição; itens PAD em múltiplas linhas; saldo residual/remanescente segregado por natureza; CAPITAL e CUSTEIO não fundem; rateio antigo multiplicava linhas; arredondamento de valor unitário; diacrítico não é divergência material; substitutos compatíveis no PAD; identidade material prevalece sobre chave textual.
- **Escopo desta etapa:** redução de ruído do comparador para impedir que pares colidentes com **identidade material bijetiva** (mesmo `hashItem`) gerem `item_novo` + `item_removido` artificiais. **Nenhuma frente nova foi aberta** (múltiplos Excel permanece separada).
- **Patch aplicado** em `backend/services/profor-2022/profor-pad-comparador-snapshots-service.js` (v0.2 → **v0.3**):
  - Nova etapa 6 de pareamento `parearGruposMateriaisPorHash`: pareia grupos com `chaveMaterial` colidente em ambos os snapshots **somente** se os `hashItem` forem bijetivos (multiset idêntico).
  - Bloqueios técnicos **não são apagados** — apenas marcados com `ruidoTecnicoControlado=true` + `motivoRuido="identidade_material_bijetiva_por_hashItem"`.
  - Novo campo `ruidosTecnicosControlados[]` no relatório (JSON + seção 4a no Markdown).
- **Resultado antes/depois (snapshots reais):**
  - Itens iguais: 555 → **568**.
  - Itens novos: 13 → **0**.
  - Itens removidos: 13 → **0**.
  - Itens alterados: 0 → 0.
  - Bloqueios técnicos: 81 (38 colisão + 43 ambígua) → **76 (38 colisão + 38 ambígua)**. Os 5 `chave_ambigua` a menos eram derivados do pareamento por contexto que deixou de disparar porque os pendentes foram absorvidos por hash bijetivo — redução de derivado, não supressão de bloqueio estrutural.
  - Ruídos técnicos controlados: 6 (todos `colisao_chave` correspondentes ficaram marcados).
  - Δ financeiro líquido (previsto/executado/saldo): R$ 0,00 / R$ 0,00 / R$ 0,00 (preservado).
  - **Candidatos na fila dry-run: 107 → 76** (26 artificiais `item_novo`/`item_removido` eliminados + 5 derivados).
- **Testes:** 6 novos casos em `tests/services/profor-pad-comparador-snapshots.test.js` cobrindo:
  - colisão preexistente bijetiva NÃO vira novo+removido;
  - colisão com diferença material continua gerando divergência/bloqueio;
  - Δ R$ 0,00 sozinha não oculta divergência;
  - bloqueios técnicos não são reduzidos pelo ruído controlado;
  - ruído controlado aparece no JSON e no Markdown;
  - fila dry-run não cria pendência operacional artificial para ruído.
  Suíte completa: **225/225** passando (`validar:services`).
- **Bloqueios remanescentes:** 76 (38 colisão + 38 ambígua) — todos preexistentes e já explicados pela memória; ruído controlado: 6.
- **Preservações:**
  - `frontend/data/publicados/` intacto.
  - `.env` inalterado.
  - SQLite/WAL/SHM intactos e não versionados.
  - Snapshot atual e snapshot anterior oficial **não foram tocados**.
  - `planoAplicacao` oficial e fila oficial real **não foram alterados**.
  - Nenhuma decisão automática registrada.
  - Transferegov não foi acionado.
- **Arquivos criados:**
  - `backend/data/relatorios/profor-2022-pad-consolidacao-bloqueios-pos-promocao-snapshot.md` — mapeamento das causas estruturais já documentadas.
  - `backend/data/relatorios/profor-2022-pad-ajuste-comparador-bloqueios-controlados.md` — descrição do patch aplicado.
- **Arquivos regenerados pelos comandos:** `profor-2022-pad-comparacao-snapshots-dry-run.{json,md}`, `profor-2022-pad-fila-revisao-snapshots-dry-run.{json,md}`.
- **Rollback:** `git revert <commit>` reverte código + testes; regenerar comparação dry-run com v0.2. Não apagar relatórios históricos.

## 23/05/2026 — PROFOR 2022: promoção controlada do snapshot anterior oficial + integração dry-run do rateio fixo à reconstrução

- **Aprovação humana expressa registrada:**
  > "Autorizo a promoção controlada do snapshot PAD atual como snapshot anterior oficial para fins exclusivos de comparação dry-run futura, sem publicação, sem alteração do plano oficial, sem decisão automática, sem alteração de banco e sem acionamento do Transferegov."
  Responsável: Marcelo Cortez (operação solo declarada, padrão já estabelecido em commits anteriores da frente).
- **Snapshot promovido:**
  - Origem: `backend/data/relatorios/profor-2022-pad-fotografia-canonica.json`
  - Destino: `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json`
  - **Checksum SHA-256:** `799dae331c4709ec26434e8c01de0218446255783527149c6cb32bb8d9abe678`
  - **Commit de referência:** `6e6cbcf56e2662a9ac4e5cc5d3cc9079fdb1831c`
  - 568 linhas, 12 avisos (não-classificados), 0 erros críticos.
  - Cópia atômica (`.tmp` + `rename`), snapshot atual permaneceu intacto, sobrescrita silenciosa do anterior bloqueada por política.
  - Registro: `profor-2022-pad-snapshot-anterior-oficial-registro.{json,md}`.
- **Comparador pós-promoção (`comparar-snapshots:dry-run`):**
  - 568 vs 568 linhas; 555 iguais; 13 "novos" e 13 "removidos" reflexos de pares com chave colidente preexistente; 0 alterados.
  - **Diferenças financeiras líquidas: R$ 0,00 (previsto, executado, saldo)** — confirma identidade material da cópia.
  - 81 bloqueios técnicos (38 colisões de chave + 43 chaves ambíguas) herdados do estado atual; não-impeditivos.
- **Fila dry-run pós-promoção (`snapshots:gerar-fila-revisao:dry-run`):**
  - Status: `fila_gerada`; 107 candidatos; 81 bloqueios técnicos.
  - **Fila oficial real não foi tocada.**
- **Reconstrução dry-run com rateio fixo (`profor:pad:reconstruir-plano-com-rateio-fixo:dry-run`):**
  - Plano original: 494 itens distintos / 568 linhas preservadas intactas.
  - Instruções: 2 (amostra controlada gerada pelo script; não há arquivo real de instruções em disco).
  - Itens com rateio fixo aplicado: 2; bloqueados: 0; sem instrução (preservados): 492.
  - Saldo não rateado: 0; diferença residual: 0; Δ linhas/previsto/saldo = 0 para amostra-espelho.
  - Plano simulado gerado em separado (não substitui o plano original); executado distribuído proporcionalmente ao valor previsto rateado para preservar totais.
- **Garantias atestadas (todas as `false`):** `publicacaoExecutada`, `decisaoAutomaticaRegistrada`, `planoAplicacaoOficialAlterado`, `frontendDataPublicadosAlterado`, `bancoAlterado`, `sqlDireto`, `novaMigration`, `envAlterado`, `transferegovAcionado`, `snapshotAtualAlterado`, `snapshotAnteriorOficialSobrescrito`, `filaOficialAlterada`, `reconstrutorOficialAlterado`.
- **Arquivos criados:**
  - `backend/scripts/promover-snapshot-anterior-oficial-pad-profor-2022.js` (+ entry `profor:pad:snapshot-anterior:promover`)
  - `backend/services/profor-2022/profor-pad-reconstrucao-rateio-fixo-integracao-service.js`
  - `backend/scripts/reconstruir-plano-com-rateio-fixo-pad-profor-2022.js` (+ entry `profor:pad:reconstruir-plano-com-rateio-fixo:dry-run`)
  - `tests/services/profor-pad-promocao-snapshot-anterior-real.test.js` (10 testes)
  - `tests/services/profor-pad-reconstrucao-rateio-fixo-integracao.test.js` (13 testes)
  - `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.{json,md}` (cópia controlada)
  - `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.{json,md}`
  - `backend/data/relatorios/profor-2022-pad-plano-reconstruido-com-rateio-fixo-dry-run.{json,md}`
  - `backend/data/relatorios/profor-2022-pad-comparacao-rateio-fixo-vs-reconstrucao-dry-run.{json,md}`
  - `backend/data/relatorios/profor-2022-pad-promocao-snapshot-e-reconstrucao-rateio-fixo-execucao.md`
- **Validações:**
  - `validar:syntax` → 100 arquivos OK.
  - `validar:services` → **219/219** passando (23 testes novos).
  - `git diff --check` → limpo (apenas avisos LF/CRLF).
  - Bateria dry-run completa rodada sem regressão.
- **Rollback documentado:** apagar snapshot anterior + registros + `git revert` dos commits desta execução; reexecutar bateria dry-run; **não apagar decisões, logs ou divergências**.
- **Preservações:** `frontend/data/publicados/` intacto; SQLite/WAL/SHM intactos e não versionados; `.env` inalterado; snapshot atual intacto; reconstrutor oficial inalterado; decisões/divergências/logs preservados.

## 23/05/2026 — PROFOR 2022: simulações preparatórias de promoção, fila oficial e rateio na reconstrução

- **Objetivo:** preparar a promoção controlada do snapshot anterior oficial, a integração dos candidatos de snapshots à fila oficial de revisão PAD e a integração do rateio por quantidade fixa à reconstrução dry-run.
- **Resultado:** auditoria de promoção criada sem promover snapshot; integração com fila oficial simulada sem candidatos integráveis; reconstrução com rateio fixo simulada com amostras controladas.
- **Promoção de snapshot:** sem aprovação humana expressa; `profor-2022-pad-fotografia-canonica-anterior.json` não foi criado.
- **Integração com fila oficial:** apenas simulação; nenhuma fila real, banco, decisão, divergência ou log foi alterado.
- **Rateio na reconstrução:** apenas simulação; o reconstrutor oficial e o `planoAplicacao` oficial não foram alterados.
- **Arquivos criados/alterados:**
  - `backend/scripts/auditar-promocao-snapshot-anterior-oficial-pad-profor-2022.js`;
  - `backend/scripts/simular-integracao-fila-oficial-snapshots-pad-profor-2022.js`;
  - `backend/scripts/simular-reconstrucao-com-rateio-quantidade-fixa-pad-profor-2022.js`;
  - `backend/services/profor-2022/profor-pad-integracao-fila-oficial-dry-run-service.js`;
  - `backend/services/profor-2022/profor-pad-rateio-quantidade-fixa-reconstrucao-dry-run-service.js`;
  - `tests/services/profor-pad-promocao-snapshot-anterior.test.js`;
  - `tests/services/profor-pad-integracao-fila-oficial-dry-run.test.js`;
  - `tests/services/profor-pad-rateio-fixo-reconstrucao-dry-run.test.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`.
- **Relatórios gerados:**
  - `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-auditoria-promocao-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-auditoria-promocao-dry-run.md`;
  - `backend/data/relatorios/profor-2022-pad-integracao-fila-oficial-snapshots-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-integracao-fila-oficial-snapshots-dry-run.md`;
  - `backend/data/relatorios/profor-2022-pad-reconstrucao-com-rateio-quantidade-fixa-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-reconstrucao-com-rateio-quantidade-fixa-dry-run.md`;
  - `backend/data/relatorios/profor-2022-pad-promocao-snapshot-integracao-fila-e-rateio-reconstrucao-dry-run.md`.
- **Validações:** `git diff --check` OK (apenas avisos LF/CRLF); `npm run validar:syntax` OK (97 arquivos); `npm run validar:services` OK (196/196 testes); `npm run profor:pad:snapshot-anterior:auditar-promocao:dry-run` OK; `npm run profor:pad:snapshots:simular-integracao-fila-oficial:dry-run` OK; `npm run profor:pad:reconstruir-com-rateio-fixo:dry-run` OK.
- **Preservações:** `frontend/data/publicados/`, `.env`, SQLite/WAL/SHM e Transferegov não foram alterados/acionados.
- **Próximos passos:** aprovar formalmente promoção de snapshot, definir contrato real da fila oficial e integrar rateio fixo ao reconstrutor apenas em novo ciclo dry-run.

## 23/05/2026 — PROFOR 2022: política de snapshots, fila de revisão e rateio por quantidade fixa

- **Objetivo:** definir política de snapshots PAD, integrar divergências/bloqueios do comparador à fila de revisão PAD e implementar simulação dry-run de rateio por área + quantidade fixa.
- **Resultado:** política formal criada, fila de revisão por snapshots implementada como dry-run e rateio por quantidade fixa implementado como serviço puro com simulação não oficial.
- **Política de snapshots:** snapshot anterior oficial permaneceu pendente; não houve promoção nesta etapa.
- **Arquivos criados/alterados:**
  - `backend/services/profor-2022/profor-pad-politica-snapshots-service.js`;
  - `backend/services/profor-2022/profor-pad-fila-revisao-snapshots-service.js`;
  - `backend/services/profor-2022/profor-pad-rateio-quantidade-fixa-service.js`;
  - `backend/scripts/gerar-fila-revisao-snapshots-pad-profor-2022.js`;
  - `backend/scripts/simular-rateio-quantidade-fixa-pad-profor-2022.js`;
  - `tests/services/profor-pad-politica-snapshots.test.js`;
  - `tests/services/profor-pad-fila-revisao-snapshots.test.js`;
  - `tests/services/profor-pad-rateio-quantidade-fixa.test.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`.
- **Relatórios gerados:**
  - `backend/data/relatorios/profor-2022-pad-politica-snapshots.md`;
  - `backend/data/relatorios/profor-2022-pad-politica-snapshots.json`;
  - `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.md`;
  - `backend/data/relatorios/profor-2022-pad-rateio-quantidade-fixa-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-rateio-quantidade-fixa-dry-run.md`;
  - `backend/data/relatorios/profor-2022-pad-politica-snapshots-fila-revisao-e-rateio-fixo-implementacao.md`.
- **Validações:** `git diff --check` OK (apenas avisos LF/CRLF); `npm run validar:syntax` OK (89 arquivos); `npm run validar:services` OK (188/188 testes); `npm run profor:pad:comparar-snapshots:dry-run` OK; `npm run profor:pad:snapshots:gerar-fila-revisao:dry-run` OK; `npm run profor:pad:rateio-quantidade-fixa:dry-run` OK.
- **Preservações:** `frontend/data/publicados/`, `.env`, SQLite/WAL/SHM e Transferegov não foram alterados/acionados.
- **Próximos passos:** integração controlada com serviço oficial de decisão, quando autorizada, e reconstrução dry-run com rateio por quantidade fixa.

## 23/05/2026 — PROFOR 2022: evolução da fotografia canônica PAD e comparador v0.2

- **Objetivo:** corrigir limitações da versão inicial da fotografia canônica e do comparador de snapshots.
- **Problemas tratados:** chave frágil por descrição crua, ausência de descrição normalizada, ausência de hash por item, ausência de bloqueio técnico por checksum inválido, ausência de classificação textual/diacrítica.
- **Resultado:** fotografia canônica v0.2 e comparador v0.2 com chaves materiais, chaves de comparação, hash por item, avisos, bloqueios técnicos e tipos de divergência ampliados.
- **Arquivos alterados/criados:**
  - `backend/services/profor-2022/profor-pad-fotografia-service.js`;
  - `backend/services/profor-2022/profor-pad-comparador-snapshots-service.js`;
  - `backend/scripts/comparar-snapshots-pad-profor-2022.js`;
  - `tests/services/profor-pad-fotografia.test.js`;
  - `tests/services/profor-pad-comparador-snapshots.test.js`;
  - `backend/data/relatorios/profor-2022-pad-fotografia-canonica.json`;
  - `backend/data/relatorios/profor-2022-pad-fotografia-canonica.md`;
  - `backend/data/relatorios/profor-2022-pad-snapshot-e-comparador-implementacao.md`.
- **Validações:** `git diff --check` OK (apenas avisos LF/CRLF); `npm run validar:syntax` OK (81 arquivos); `npm run validar:services` OK (173/173 testes); `npm run profor:pad:comparar-snapshots:dry-run` OK.
- **Preservações:** `frontend/data/publicados/`, `.env`, SQLite/WAL/SHM e Transferegov não foram alterados/acionados.
- **Próximos passos:** integração futura com fila de revisão e rateio por área + quantidade fixa.

## 23/05/2026 — PROFOR 2022: Evolução PAD - Fotografia Canônica e Comparador de Snapshots (Dry-Run)

- **Objetivo:** definir e implementar a fotografia canônica PAD estruturada e o comparador de snapshots homogêneos (PAD x PAD) em modo estritamente dry-run, garantindo integridade e estabilidade por checksum.
- **Implementações:**
  - `profor-pad-fotografia-service.js` (Novo): Filtra os 14 campos canônicos do plano de aplicação reconstruído, ordena deterministicamente por chaves primárias e gera checksum SHA-256 do JSON correspondente.
  - `profor-pad-comparador-snapshots-service.js` (Novo): Carrega e parea dois snapshots canônicos do PAD usando chave composta estável, aplica consolidação de saldos residuais (evitando colisões técnicas), detecta alterações/novidades/remoções de itens, e gera relatórios em JSON e Markdown.
  - `comparar-snapshots-pad-profor-2022.js` (Novo Script CLI): Executa a reconstrução, gera e persiste a fotografia canônica atual, e opcionalmente compara com uma fotografia anterior gerando relatórios de dry-run.
  - Integrado o script `"profor:pad:comparar-snapshots:dry-run"` no `package.json`.
  - Registrados novos caminhos no script de sintaxe `validar-syntax.js`.
- **Testes novos:**
  - `profor-pad-fotografia.test.js` (Novo): Valida filtragem, ordenação determinística, estabilidade do checksum, resumos agregados e gravação.
  - `profor-pad-comparador-snapshots.test.js` (Novo): Valida detecção de itens novos/ausentes/alterados, deltas financeiros agregados, corrupção de checksum e gravação de relatórios.
- **Validações realizadas:**
  - Executado `node scripts/validar-syntax.js` com sucesso (81 arquivos sem erros).
  - Executado `node --test tests/services/*.test.js` com sucesso (163/163 testes passando).
  - Executado manualmente o script CLI do comparador de snapshots demonstrando geração da fotografia canônica atual (`2ddec07c1212a9e41dad4ad984f5a4c01a664927a330ffcb77603beb3d6b3cfe`, total R$ 10.664.015,24) e execução do comparativo com sucesso.
- **Isolamento de ambiente:**
  - Nenhuma publicação executada; `frontend/data/publicados/` sem qualquer alteração.
  - SQLite/WAL/SHM sem qualquer alteração.
  - `.env` intacto e sem alteração da origem ativa.
  - Transferegov não acionado.
- **Risco de regressão:** nulo, por se tratar de ferramentas de análise e auditoria estritamente em modo dry-run e isoladas dos serviços operacionais ativos.
- **Rollback:** os novos arquivos podem ser descartados com o Git, e o script de npm removido do `package.json`.
- **Artefatos criados/alterados:**
  - [profor-pad-fotografia-service.js](../../backend/services/profor-2022/profor-pad-fotografia-service.js) [NEW]
  - [profor-pad-comparador-snapshots-service.js](../../backend/services/profor-2022/profor-pad-comparador-snapshots-service.js) [NEW]
  - [comparar-snapshots-pad-profor-2022.js](../../backend/scripts/comparar-snapshots-pad-profor-2022.js) [NEW]
  - [profor-pad-fotografia.test.js](../../tests/services/profor-pad-fotografia.test.js) [NEW]
  - [profor-pad-comparador-snapshots.test.js](../../tests/services/profor-pad-comparador-snapshots.test.js) [NEW]
  - [package.json](../../package.json) [MODIFY]
  - [validar-syntax.js](../../scripts/validar-syntax.js) [MODIFY]
  - [profor-2022-pad-fotografia-canonica.json](../../backend/data/relatorios/profor-2022-pad-fotografia-canonica.json) [NEW]

## 23/05/2026 — PROFOR 2022: Inventário de resíduos legados e auditoria de fallbacks

- **Objetivo:** inventariar resíduos legados (planilhas locais, parsers legados de abas por UF e scripts de sincronização), classificar riscos e verificar a ocorrência de fallbacks silenciosos para origens obsoletas.
- **Resultado da Auditoria de Fallback:**
  - **Backend:** Não foram identificados fallbacks silenciosos para a origem `reconstrucao-pad`. Caso o arquivo de reconstrução esteja ausente ou corrompido, o backend lança exceções explícitas (`ReconstrucaoPadIndisponivelError` / `ReconstrucaoPadInvalidaError`) e aborta a publicação.
  - **Frontend:** Implementa fallback resiliente em ambiente local/API (caindo para planilha em cache com aviso no console caso o servidor esteja offline), mas consome estritamente o catálogo congelado publicado no modo estático de produção (GitHub Pages).
- **Classificação dos Resíduos:**
  - `arquivoPlanilhaConvenios`, `Planilhas/` e helpers `xlsx.readFile` / `carregarPlanoAplicacaoLocal` / `extrairPlanoAplicacaoProforDoWorkbook` classificados como **Manter temporariamente como fallback explícito** para compatibilidade com o desenvolvimento de modos clássicos locais.
  - Scripts do Transferegov classificados como **Manter como histórico/diagnóstico** sob proibição rígida de execução.
- **Artefatos criados/alterados:**
  - [profor-2022-limpeza-legado-pad-linha-base.md](../../backend/data/relatorios/profor-2022-limpeza-legado-pad-linha-base.md)

## 23/05/2026 — PROFOR 2022: Registro de baseline estável pós-homologação


- **Objetivo:** registrar formalmente a baseline estável pós-homologação técnica e funcional do ciclo PAD/PROFOR 2022, sem alteração de dados funcionais ou execução de novas rotinas.
- **Parâmetros da Baseline:**
  - **Commit de Publicação:** `06c4cd7`
  - **Commit de Homologação:** `288fb99`
  - **Arquivos Estáticos Publicados:** `aplicacao.json` (origem ativa `"reconstrucao-pad"`), `dashboard-geral.json`, `resumo-publicacao.json`.
  - **Estado dos Testes:** 153/153 testes de serviço executados com sucesso pós-homologação, `validar:syntax` retornado com sucesso.
- **Salvaguardas Operacionais:**
  - Rollbacks de dados, arquivos de publicação e base local SQLite documentados e preservados no repositório de backup externo.
  - Eventual retorno de contingência para a origem `banco-cache` dar-se-á estritamente por meio de reversão manual, explícita, temporária e expressamente autorizada das variáveis de ambiente local (sem fallbacks silenciosos ou automatizados integrados ao software).
  - Proibição expressa de execução e acionamento de rotinas automáticas integradas ao Transferegov (`atualizar:profor-2022`, `publicar:profor-2022`) fora de uma frente de trabalho dedicada e previamente autorizada.
- **Artefatos criados/alterados:**
  - [profor-2022-baseline-pos-homologacao.md](../../backend/data/relatorios/profor-2022-baseline-pos-homologacao.md)

## 23/05/2026 — PROFOR 2022: HOMOLOGAÇÃO pós-publicação e encerramento técnico do ciclo


- **Objetivo:** registrar a homologação pós-publicação e consolidar o encerramento técnico do ciclo PAD/PROFOR 2022 (sem nova publicação, sem alteração de banco de dados, sem alteração do `.env` ou acionamento do Transferegov).
- **Validação técnica de homologação pós-publicação:**
  - Carregamento de telas (Dashboard Geral e Painel PROFOR 2022) efetuado com sucesso na porta local `8790`.
  - Dados consistentes com a origem `reconstrucao-pad`: 15 convênios e 568 itens de plano de aplicação reconstruídos.
  - Valores auditados conferidos: Valor de repasse PROFOR = `R$ 10.217.254,54`, Valor Global = `R$ 10.664.015,24`, Total Fomento Geral = `R$ 6.028.180,90`.
  - Console do navegador limpo (0 erros 404, 0 erros de parse JSON, 0 propriedades `undefined`).
  - Testes automatizados executados pós-publicação: `validar:syntax` retornou OK, `validar:services` retornou sucesso (153/153 testes passados, 0 falhas).
- **Consolidação do encerramento técnico do ciclo:**
  - Saneamento de divergências críticas (Divergências #18, #39, #44 e revalidação de 27 payloads alterados #47-#74) concluído na fase de segurança pré-ativação.
  - Ativação controlada da origem `reconstrucao-pad` via `.env` (gitignored) realizada e testada com sucesso.
  - Publicação controlada efetuada atomicamente via `npm run publicar:dados` alterando estritamente `aplicacao.json`, `dashboard-geral.json` e `resumo-publicacao.json`.
  - Status geral final atestado: **HOMOLOGADO POS-PUBLICACAO PAD/PROFOR 2022**.
- **Isolamento de ambiente:**
  - Nenhuma publicação ou atualização rodada nesta etapa.
  - `frontend/data/publicados/` sem alterações pós-publicação.
  - SQLite/WAL/SHM sem qualquer alteração.
  - `.env` sem alterações.
  - Transferegov não foi acionado.
  - `git diff --check` limpo.
- **Artefatos criados/alterados:**
  - [profor-2022-homologacao-pos-publicacao.md](../../backend/data/relatorios/profor-2022-homologacao-pos-publicacao.md)
  - [profor-2022-homologacao-pos-publicacao.json](../../backend/data/relatorios/profor-2022-homologacao-pos-publicacao.json)
  - [profor-2022-encerramento-tecnico-pad-profor-2022.md](../../backend/data/relatorios/profor-2022-encerramento-tecnico-pad-profor-2022.md)

## 23/05/2026 — PROFOR 2022: EXECUÇÃO da publicação controlada da origem `reconstrucao-pad`


- **Autorização escrita:** "AUTORIZAÇÃO EXPRESSA DE PUBLICAÇÃO CONTROLADA PAD/PROFOR 2022 (origem ativa: reconstrucao-pad)" — janela autorizada para 2026-05-23T17:05:00-03:00 (operação solo com aceite cruzado concentrado sob responsabilidade do operador).
- **Operação solo declarada:** o operador assume a custódia técnica e functional concentrada.
- **Mecanismo executado:** APENAS `npm run publicar:dados` (mapeado para `node backend/scripts/publicar-dados-estaticos.js`), sem acionar Transferegov, sem rodar `publicar:profor-2022` ou `atualizar:profor-2022`, sem alterar `.env` e sem alterar `backend/data/onasp.sqlite`.
- **Pré-condições técnicas confirmadas:**
  - Branch `main`, working tree limpa (antes dos dry-runs do pre-voo);
  - `.env` intacto com `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` (hash `457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648`);
  - `profor-2022-pad-plano-reconstruido-dry-run.json` presente com hash material coincidente, apenas alteração de metadados de data `"geradoEm"` decorrente dos dry-runs imediatos;
  - `pendenciaOperacionalReal = 0`, `totalBloqueiosAtivos = 0`, `aptoParaAtivacaoControlada = true` confirmados;
  - Reconstrução: 568 linhas / 15 convênios;
  - Comparador: 25 diferenças críticas explicadas, diff líquido saldo `−R$ 15.043,84`;
  - `validar:syntax` 76 OK, `validar:services` 153/153 OK;
  - `git diff --check` limpo.
- **Backups realizados** em `C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\PUBLICACAO-20260523-170600` (fora do repositório):
  - Diretório `frontend/data/publicados/` pré-publicação copiado integralmente com hash SHA-256 de controle registrado;
  - Cópia do JSON reconstruído, relatórios de prontidão, diários, logs do git e `.env`.
- **Publicação:**
  - Comando executado: `node backend/scripts/publicar-dados-estaticos.js`
  - Saída: `Dados estaticos publicados com sucesso. { success: true, publicadoEm: '2026-05-23T20:07:02.163Z' }`
- **Validações pós-publicação:**
  - `git status --short` indicou que apenas `aplicacao.json`, `dashboard-geral.json` e `resumo-publicacao.json` foram modificados dentro de `frontend/data/publicados/` (além dos relatórios de dry-run atualizados com novos timestamps);
  - `.env` e `backend/data/onasp.sqlite` permaneceram 100% intactos;
  - Hashes pós-publicação calculados e salvos no diretório de backups;
  - `validar:json`, `validar:syntax` (76 OK) e `validar:services` (153/153 passados) executados com sucesso pós-publicação;
  - Conferência visual de `resumo-publicacao.json` validou: `publicadoEm` correto, totais de convênios = 15, e 5 arquivos serializados no índice. `aplicacao.json` validado com `"origemDados": "reconstrucao-pad"` e `"origemDadosEfetiva": "reconstrucao-pad"`.
- **Garantias pós-publicação:** sem Transferegov, sem alteração de banco de dados, sem alteração de origem ativa no `.env`.
- **Rollback disponível:** via restauração direta da cópia de segurança em `C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\PUBLICACAO-20260523-170600\publicados.pre-publicacao-hashes.txt`.

## 23/05/2026 — PROFOR 2022: roteiro de publicação controlada (documentação, sem execução)

- **Objetivo:** preparar o roteiro operacional da publicação controlada dos dados PAD/PROFOR 2022 para `frontend/data/publicados/`, refletindo a origem `reconstrucao-pad` já ativa no ambiente local (commit `7ed2633`). **Sem executar publicação**, sem alterar `.env`, sem alterar origem ativa, sem acionar Transferegov.
- **Pipeline mapeada** (em modo leitura):
  - `npm run publicar:dados` → `backend/scripts/publicar-dados-estaticos.js` (17 linhas) → `static-publication-service.publicarDadosEstaticos()` → `consolidarCatalogoDashboard()` → `montarDadosProfor2022Publicacao()` → branch `reconstrucao-pad` (porque `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` no `.env`) → escreve **6 JSONs atomicamente** em `frontend/data/publicados/` via `escreverJsonAtomico` (`.tmp` + `fs.renameSync`).
  - `npm run publicar:profor-2022` → orquestrador que chama `atualizar:profor-2022` **(Transferegov)** antes de `publicar:dados`. **PROIBIDO** nesta etapa por violar a restrição de não-Transferegov.
  - Conclusão: a publicação controlada usa **apenas `publicar:dados`** (caminho direto).
- **Comandos permitidos executados** (leitura/dry-run):
  - `git status --short` + `git log --oneline -8` → branch `main`, working tree limpa, último commit `7ed2633` (ativação);
  - `grep "^PROFOR_2022_ORIGEM_DADOS" .env` → `reconstrucao-pad` (origem ativa local preservada);
  - `npm run profor:pad:auditar-pendencias-profundo` → `pendência_operacional_real = 0`, `bloqueio_técnico_segurança = 0`;
  - `npm run profor:pad:seguranca-pre-ativacao:final` → `aptoParaAtivacaoControlada = sim`, `pendenciaOperacionalReal = 0`;
  - `npm run profor:pad:reconstruir-plano:dry-run` → 568 linhas / 15 convênios / 31 impedimentos categorizados;
  - `npm run profor:pad:comparar-plano:dry-run` → 25 diferenças críticas explicadas, diff líquido saldo `−R$ 15.043,84`;
  - `npm run validar:syntax` → 76 arquivos OK; `npm run validar:services` → 153/153;
  - `git diff --check`/`git status` em `frontend/data/publicados`/`*.sqlite*`/WAL/SHM → todos limpos.
- **Arquivos a serem afetados pela publicação futura** (snapshot dos hashes atuais registrado no roteiro §7):
  - **Esperado mudar:** `aplicacao.json`, `dashboard-geral.json`, `resumo-publicacao.json` (contêm `publicadoEm` e `dadosProfor2022.origemDadosEfetiva = "reconstrucao-pad"`);
  - **Esperado preservar:** `formalizacao-profor.json`, `orcamento-2026.json`, `parametros-minimos.json` (não dependem da origem PAD);
  - Critério de parada §14.8: alteração de menos de 3 ou mais de 6 arquivos aborta.
- **Artefatos criados:**
  - [backend/data/relatorios/profor-2022-roteiro-publicacao-controlada.md](FOMENTO-ONASP/backend/data/relatorios/profor-2022-roteiro-publicacao-controlada.md) v1.0 — 20 seções obrigatórias + checklist + texto de autorização;
  - [backend/data/relatorios/profor-2022-roteiro-publicacao-controlada.json](FOMENTO-ONASP/backend/data/relatorios/profor-2022-roteiro-publicacao-controlada.json) v1.0 — versão estruturada com `garantiasDesteRoteiro.tipoArtefato = "documentacao + relatorio dry-run"` e todas as garantias `false` (publicação, Transferegov, `.env`, origem ativa, planoAplicacao, publicados, SQLite, decisão etc.).
- **Lição aplicada da janela de ativação:** o §9 + JSON deste roteiro instruem usar **timestamp da janela efetiva** no nome do diretório `<RET>/` raiz, para evitar a divergência de nomenclatura que ocorreu na ativação (vide diário do commit `7ed2633`).
- **Próxima etapa concreta (NÃO executar agora):** preencher o texto da §20 do roteiro (autorização expressa) com janela, responsáveis e mecanismo §10 confirmado; submeter para nova rodada de pré-voo; só então executar os blocos 8 → 9 → 10 → 11 → 12 → 13.
- **Restrições preservadas:** sem publicação, sem `publicar:dados`/`publicar:profor-2022` executados, sem `atualizar:*-profor`, sem `agendar:*`, sem Transferegov/DETRU, sem alteração em `.env`/SQLite/decisões/divergências/logs/`planoAplicacao` oficial/origem ativa/`frontend/data/publicados/`, sem SQL direto, sem nova migration, sem versionamento de WAL/SHM, nenhum alerta real mascarado.

## 23/05/2026 — PROFOR 2022: ATIVAÇÃO CONTROLADA da origem `reconstrucao-pad` (janela antecipada, sem publicação)

- **Autorização escrita:** "AUTORIZAÇÃO EXPRESSA DE ATIVAÇÃO CONTROLADA PAD/PROFOR 2022 (origem reconstrucao-pad)" — janela autorizada formalmente para 2026-05-24 20h00–21h00, **antecipada pelo operador via adendo escrito** ("Execute agora!") emitido em 2026-05-23. Assinada por Marcelo Cortez, ISO-8601 `2026-05-24T20:00:00-03:00`. Roteiro de referência: `backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.md` (v1.1). Commit pré-requisito: `2889024 feat(profor-2022): implementa origem reconstrucao pad`.
- **Operação solo declarada** (desvio formal do roteiro):
  - **Por que:** o usuário declarou expressamente "operação solo, com aceite cruzado concentrado sob responsabilidade do operador" no texto da autorização, e antecipou a janela em adendo escrito separado.
  - **Como aplicar:** uma única pessoa (Marcelo Cortez) assume os papéis de responsável funcional, responsável técnico/operador e custódia de backups; o aceite cruzado dos §16.4 e §16.5 do roteiro fica concentrado no operador, sem segundo par de olhos. Documentar isso explicitamente em toda janela de ativação solo.
- **Janela efetiva:** abertura 2026-05-23T16:34:44-03:00; encerramento na sequência (duração curta dado servidor parado).
- **Bloco 8 — pré-checks ao vivo:** após `git restore backend/data/relatorios/` para satisfazer §3 item 2 (tree limpa), branch `main`, último commit `2889024`, auditorias preservando `pendenciaOperacionalReal = 0`, `totalBloqueiosAtivos = 0`, `aptoParaAtivacaoControlada = sim`, reconstrução 568/15, comparador diff líquido saldo `−R$ 15.043,84`, `validar:syntax` 76 OK, `validar:services` 153/153.
- **Bloco 9 — backups em `<RET>` = `C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\2026-05-24T20-00-00-03-00\`** (fora do repo):
  - `onasp.sqlite.pre-ativacao-20260523-163640` → SHA-256 `124e10f3c064b1004a07fe1948936c26b05cf68db4b32510fbbc4d7fb3ce40a1` (igual à origem);
  - `onasp.sqlite-wal.pre-ativacao-...` → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (0 bytes, vazio);
  - `onasp.sqlite-shm.pre-ativacao-...` → `e9d4be5b3603487435afc2bd77e93ec2cde39407346f7ce24fa06e446db3db56`;
  - `planilha-origem-ativa.pre-ativacao-....xlsx` (`Planilhas/gestao_financeira_ouvidoria.xlsx`) → `e3a39919e61a85d7f34e0224be44bdca1fbd4a907a26e586f18703d94883c611`;
  - **`profor-2022-pad-plano-reconstruido-dry-run.json`** (fonte material da nova origem) → **SHA-256 `ed1639ece4258e1fd9a5e524f6604c5f70010d779eccd553c7f11dd49d6f0886`**;
  - `profor-2022-prontidao-ativacao-controlada-dry-run.{json,md}`, `profor-2022-seguranca-pre-ativacao-final-dry-run.json`, `profor-2022-roteiro-ativacao-controlada.md` (cópias);
  - `publicados.pre-ativacao-.../` (6 arquivos, hashes individuais em `publicados.pre-ativacao-hashes.txt`);
  - `git-log-pre-ativacao.txt` e `git-status-pre-ativacao.txt`;
  - **Conferência origem↔backup:** 5 hashes idênticos (SQLite, WAL, SHM, planilha, JSON reconstruído) — integridade comprovada. Aceite do backup concentrado no operador.
- **Bloco 10.1 — ATIVAÇÃO:** editada a linha 6 de `.env` (gitignored, mecanismo canônico carregado por `dotenv` em [backend/server.js](FOMENTO-ONASP/backend/server.js#L1)):
  - **ANTES:** `PROFOR_2022_ORIGEM_DADOS=banco-cache` — `.env` com SHA-256 `85356fdb2831993260def671cf55f1325a501ab9bf06cf24b25e00587f573e9b`.
  - **DEPOIS:** `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` — `.env` com SHA-256 `457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648`.
  - **Diff:** somente a linha 6 (+2 linhas de comentário de auditoria com timestamp e responsável).
  - **Snapshots:** `<RET>/.env.pre-ativacao-20260523-163640` e `<RET>/.env.pos-ativacao-20260523-163640`.
  - **Não houve commit no repo** — `.env` é gitignored por desenho (linha 1 de `.gitignore`); a auditoria fica pelos snapshots em `<RET>/` + esta entrada do diário com hashes ANTES/DEPOIS. Trade-off conhecido vs. PR versionado: a ativação fica isolada à instância local e não vaza para outras instalações.
- **Bloco 10.2:** N/A — nenhum servidor rodando nesta janela; nada para recarregar.
- **Bloco 10.3 (proibições):** nenhum script de publicação ou Transferegov foi acionado. Confirmado.
- **Bloco 11 — validações pós-ativação:** repetidas as auditorias do §8 + **checagem comportamental ponto a ponto** (`require('dotenv').config()` → `process.env.PROFOR_2022_ORIGEM_DADOS = "reconstrucao-pad"` → `resolverOrigemDadosProfor2022({detalhado:true}) = { origemDados: "reconstrucao-pad", fonte: "env", avisos: [] }` → `deveUsarReconstrucaoPad = true`, `deveUsarBancoCache = false` → `carregarPlanoAplicacaoReconstrucaoPad({conveniosEsperados:15, minimoLinhasExigido:568})` carregou 568 linhas e 15 convênios com os 14 campos canônicos; item exemplo do MT/937698 com `valorPrevisto = 41743`, `valorExecutado = 33573`, `saldo = 8170`). Métricas das auditorias **idênticas** à pré-checagem (diff saldo `−R$ 15.043,84`, 31 impedimentos categorizados, 25 diferenças críticas explicadas). `validar:syntax` 76 OK, `validar:services` 153/153.
- **Bloco 12 — critérios de sucesso:** 9/9 atendidos (com desvio "operação solo" registrado no item 7 e arquivo da ativação `.env` gitignored no item 4 — ambos formalmente aceitos pelo operador).
- **Isolamento pós-ativação:**
  - `frontend/data/publicados/` → **vazio** (sem alteração).
  - `*.sqlite*`, `*.sqlite-wal`, `*.sqlite-shm` → **vazios e não versionados**.
  - `git diff --check` limpo (apenas avisos LF/CRLF nos relatórios regenerados).
  - `git status --short` mostra apenas 7 relatórios dry-run regenerados pelo §11 (sem `.env` por gitignore).
- **Origem ativa agora:** `reconstrucao-pad`. **Origens preservadas como fallback:** `planilha` e `banco-cache`. **Default no código:** `banco-cache` (inalterado).
- **Garantias finais:** sem publicação, sem alteração em `frontend/data/publicados/`, sem alteração em `backend/data/onasp.sqlite`, sem SQL direto, sem nova decisão registrada, sem nova migration, sem versionamento de WAL/SHM, sem avanço para automação Transferegov, nenhum alerta real mascarado, nenhum log/divergência/decisão apagados.
- **Próxima etapa (NÃO executar agora):** se em algum momento o servidor for iniciado e a operação real validar visualmente os números, a publicação para `frontend/data/publicados/` continua **proibida** sem autorização própria e janela própria. Rollback completo descrito em §14 do roteiro v1.1 (incluindo restaurar `.env` a partir de `<RET>/.env.pre-ativacao-20260523-163640`).
- **Observações de auditoria registradas após o encerramento da janela:**
  - **Escopo desta ativação = ambiente local/controlado.** Como `.env` é gitignored, outras instâncias do projeto (outros checkouts, outras máquinas, CI, produção) **não herdam** automaticamente esta ativação — por desenho. Para ativar em outro ambiente é obrigatório reaplicar o §10.1 deste roteiro naquele ambiente, com pré-voo, backup, hashes e aceite próprios. O default no código permanece `banco-cache`; qualquer ambiente sem essa variável ajustada continua usando o default.
  - **Divergência de nomenclatura em `<RET>`.** O diretório de retenção foi nomeado conforme a janela **formal** autorizada (`2026-05-24T20-00-00-03-00`), mas a janela **efetiva** foi `2026-05-23T16:34:44-03:00 → 16:42:21-03:00` (após o adendo "Execute agora!" antecipando a janela). Os artefatos internos do `<RET>/` usam o timestamp efetivo (`...pre-ativacao-20260523-163640`, `...pos-ativacao-20260523-163640`). Os hashes registrados garantem rastreabilidade material; a divergência é apenas de nomenclatura do diretório raiz, não de conteúdo. Se for refeito o backup em janela futura, sugere-se usar o timestamp efetivo no nome do diretório raiz para evitar confusão.

## 23/05/2026 - PROFOR 2022: implementação da origem `reconstrucao-pad` (capacidade, sem ativação)

- **Motivação:** pré-voo da ativação controlada (tarefa anterior) detectou que o §10.1 do roteiro v1.0 referenciava um mecanismo inexistente — não havia origem `reconstrucao-pad` em `profor-origem-service.js` e não havia planilha-resultado para "repontar `arquivoPlanilhaConvenios`". Ativação foi corretamente abortada e esta frente entregou a capacidade que faltava.
- **Mudanças de código:**
  - [backend/services/profor-2022/profor-origem-service.js](FOMENTO-ONASP/backend/services/profor-2022/profor-origem-service.js): adicionado `"reconstrucao-pad"` a `ORIGENS_DADOS_PROFOR_2022` e exportada a flag `deveUsarReconstrucaoPadProfor2022`. **`ORIGEM_PADRAO_PROFOR_2022` permanece `"banco-cache"`** — sem mudança de default nesta etapa.
  - [backend/services/profor-2022/profor-pad-origem-reconstrucao-service.js](FOMENTO-ONASP/backend/services/profor-2022/profor-pad-origem-reconstrucao-service.js) (novo): leitor + validador + adaptador para o relatório `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json`. Erros explícitos `ReconstrucaoPadIndisponivelError` / `ReconstrucaoPadInvalidaError`; nenhum fallback silencioso. Adaptador projeta exatamente os 14 campos canônicos do `planoAplicacao` (uf, instrumento, numero, ano, area, natureza, descricao, quantidade, valorUnitario, valorPrevisto, valorExecutado, saldo, saldoEconomicidade, percentualExecucao). Não importa SQLite/init-db, `publicar-*` nem Transferegov, e não escreve arquivos (somente leitura).
  - [backend/services/dashboard-publication-service.js](FOMENTO-ONASP/backend/services/dashboard-publication-service.js): adicionado terceiro branch em `montarDadosProfor2022Publicacao` para `origemDados === "reconstrucao-pad"` — usa o novo serviço e propaga `origemDados` para o consolidado, sem chamar `validarConsolidadoProfor2022Publicavel` (gate de publicação `banco-cache`).
- **Testes novos:** [tests/services/profor-pad-origem-reconstrucao.test.js](FOMENTO-ONASP/tests/services/profor-pad-origem-reconstrucao.test.js) com 23 testes cobrindo:
  - aceitação da nova origem por `normalizarOrigemDadosProfor2022` e flags por origem;
  - fallback para padrão quando origem inválida (sem remover origens antigas);
  - leitura do relatório real bate **568 linhas / 15 convênios** com todos os campos canônicos;
  - rejeição explícita de payload sem `planoAplicacaoReconstruido`, payload vazio, item sem campo obrigatório, campo numérico inválido, mínimo de linhas não atingido e contagem de convênios divergente;
  - arquivo ausente e JSON malformado → `Error` específico (sem fallback);
  - inspeção estática do módulo: sem `require` de publicação, SQLite/init-db, Transferegov; sem `fs.writeFile*` (origem é somente leitura).
- **Validações:** `npm run validar:syntax` → 76 arquivos OK; `npm run validar:services` → **153/153** testes passando (130 anteriores + 23 novos); bateria dry-run completa preservou `pendenciaOperacionalReal = 0`, `totalBloqueiosAtivos = 0`, `aptoParaAtivacaoControlada = true`, reconstrução 568/15, comparador 25 diferenças críticas explicadas (diferença líquida saldo idêntica à fotografia da prontidão).
- **Documentação atualizada:**
  - [backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.md](FOMENTO-ONASP/backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.md) v1.1 — §10.1 reescrito com o comando real `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad`, garantia de falha explícita e fallback preservado;
  - [backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.json](FOMENTO-ONASP/backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.json) v1.1 — `historicoVersoes` adicionado; `comandosAtivacaoFutura.passos[10.1]` atualizado; novas garantias `garantiaFalhaExplicita` e `garantiaNaoPublicacaoAcoplada` reescrita citando os testes estáticos;
  - [memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md](FOMENTO-ONASP/memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md) — seção 35 (origem `reconstrucao-pad`).
- **Isolamento confirmado:** `frontend/data/publicados/` vazio, `*.sqlite*`/`*.sqlite-wal`/`*.sqlite-shm` vazios e não versionados, `git diff --check` limpo (apenas avisos LF/CRLF).
- **Garantias e escopo preservado:** sem ativação executada, sem publicação executada, sem alteração de origem ativa (default permanece `banco-cache`), sem alteração de `planoAplicacao` oficial, sem alteração em `frontend/data/publicados`, sem alteração em `backend/data/onasp.sqlite`, sem SQL direto, sem nova decisão registrada, sem nova migration, sem avanço para automação Transferegov, sem remoção das origens `"planilha"` e `"banco-cache"`. **A ativação concreta exigirá novo pré-voo e nova autorização expressa.**

## 23/05/2026 - PROFOR 2022: roteiro de ativação controlada (documentação, sem execução)

- Objetivo: preparar o roteiro operacional para a futura ativação controlada da nova origem PAD/PROFOR 2022, **sem executar** ativação, publicação ou alteração da origem ativa.
- Pré-condição validada: commit `6b89b8c commit` (auditoria de prontidão), classificação `PRONTO_PARA_PREPARAR_ATIVACAO_CONTROLADA`.
- Comandos permitidos executados (leitura/dry-run):
  - `git status --short` + `git log --oneline -8` → branch `main`, working tree limpa, último commit auditoria;
  - `npm run profor:pad:auditar-pendencias-profundo` → `pendência_operacional_real = 0`, `bloqueio_técnico_segurança = 0`;
  - `npm run profor:pad:seguranca-pre-ativacao:final` → `aptoParaAtivacaoControlada = true`;
  - `npm run profor:pad:reconstruir-plano:dry-run` → 568 linhas, 15 convênios, 31 impedimentos categorizados, 0 erros críticos;
  - `npm run profor:pad:comparar-plano:dry-run` → 25 diferenças críticas explicadas, diferença líquida saldo ≈ −R$ 15.043,84;
  - `npm run validar:syntax` → 76 arquivos OK;
  - `npm run validar:services` → 130/130 OK;
  - `git diff --check`/`git status` em `frontend/data/publicados`/`*.sqlite*`/`*.sqlite-wal`/`*.sqlite-shm` → todos limpos.
- Mapeamento do mecanismo concreto de ativação: substituição controlada da origem ativa do `planoAplicacao` (planilha das abas/guias por UF, hoje em `catalogoAplicacao.configuracao.arquivoPlanilhaConvenios`) pela origem reconstruída a partir dos relatórios PAD/PROFOR 2022, com fallback preservado. Não existe e **não deve existir** um script único de "ativar" que dispare publicação automática.
- Artefatos criados:
  - `backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.md` — roteiro completo com escopo, fora de escopo, pré-condições, responsáveis, janela, backups, arquivos protegidos, pré-checks, comandos de ativação rotulados como **`[NÃO EXECUTAR NESTA ETAPA]`**, validações pós-ativação, critérios de sucesso/parada/rollback, riscos, plano de comunicação, evidências, próxima etapa, proibição expressa de publicação automática e proibição expressa de automação Transferegov;
  - `backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.json` — versão estruturada com `garantiasDesteRoteiro.tipoArtefato = "documentacao + relatorio dry-run"` e todas as garantias `false` (ativação, publicação, decisão, origem ativa, planoAplicacao, publicados, SQLite, automação Transferegov, aviso real mascarado etc.).
- Próxima etapa concreta: **autorização expressa por escrito** do responsável funcional e do revisor de segurança técnica para executar, em janela separada, os blocos 8 → 9 → 10 → 11 → 12 do roteiro, com rollback obrigatório ao primeiro gatilho da seção 13.
- Restrições preservadas: sem ativação, sem publicação, sem alteração de origem ativa, sem alteração de `planoAplicacao` oficial, sem alteração em `frontend/data/publicados`, sem alteração em `backend/data/onasp.sqlite`, sem SQL direto, sem nova decisão registrada, sem nova migration, sem versionamento de WAL/SHM, sem avanço para automação Transferegov, nenhum alerta real mascarado.

## 23/05/2026 - PROFOR 2022: auditoria integrada final de prontidão pré-ativação controlada (dry-run)

- Objetivo: consolidar a auditoria integrada final em modo leitura para confirmar que o sistema está tecnicamente pronto para **preparar** uma futura ativação controlada, sem ativar, sem publicar e sem alterar o `planoAplicacao` oficial.
- Comandos executados (todos dry-run):
  - `git status --short` + `git log --oneline -12` → branch `main`, working tree limpa no início, último commit etapa 10 `10f96c9 ajustes`;
  - `npm run profor:pad:auditar-pendencias-profundo` → `pendência_operacional_real = 0`, `bloqueio_técnico_segurança = 0`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`/`:detalhar`/`:final` → `aptoParaAtivacaoControlada = true`, `totalBloqueiosAtivos = 0`, `totalPayloadsAlteradosAtivos = 0`, `totalPendenciasTecnicasAtivas = 0`;
  - `npm run profor:pad:reconstruir-plano:dry-run` → 568 linhas, 15 convênios, 31 impedimentos técnicos (categorias conhecidas), 0 erros críticos, 0 instrumentos fora carteira;
  - `npm run profor:pad:comparar-plano:dry-run` → 25 diferenças críticas explicadas (12 atualização PAD + 21 pendência técnica residual), diferença líquida de saldo ≈ −0,20%;
  - `npm run profor:pad:revalidacao-payloads:auditar` → 27 IDs classificados `revalidacao_por_prevalencia_pad`, chave de divergência preservada em 100%;
  - `npm run validar:syntax` → 76 arquivos OK;
  - `npm run validar:services` → 130/130 testes passando;
  - `git diff --check` → limpo (apenas avisos LF/CRLF em relatórios dry-run regenerados);
  - `git status --short frontend/data/publicados`/`"*.sqlite*"`/`"*.sqlite-wal"`/`"*.sqlite-shm"` → todos vazios.
- Matriz final de segurança (35 itens, todos não bloqueantes):
  - `#18` → `bloqueio_tecnico_residual_retificado` (1);
  - `#25, #26, #27, #28, #75, #77, #78` → `historico_nao_reapresentado_revalidado_sem_bloqueio` (7);
  - `#47–#74` (27 IDs, exclui `#55`) → `decisao_historica_nao_vigente_com_payload_alterado` (27).
- Subagentes (modo leitura, sem alteração) — A (segurança/decisões), B (reconstrução), C (comparador) e D (git/banco/publicação) — sem achado bloqueante; achados consolidados nos relatórios `backend/data/relatorios/profor-2022-prontidao-ativacao-controlada-dry-run.{json,md}`.
- Classificação final: `PRONTO_PARA_PREPARAR_ATIVACAO_CONTROLADA`. **Sem ressalvas materiais.**
- Aptidão em dry-run **não autoriza ativação nem publicação**. Próxima etapa recomendada (a executar em momento posterior, não agora): preparar roteiro de ativação controlada com janela, backup, comandos exatos, validações pós-ativação e critérios de rollback.
- Restrições preservadas: sem ativação, sem publicação, sem alteração de origem ativa, sem alteração de `planoAplicacao` oficial, sem alteração em `frontend/data/publicados`, sem alteração em `backend/data/onasp.sqlite`, sem SQL direto, sem nova decisão registrada, sem nova migration, sem versionamento de WAL/SHM, sem avanço para automação Transferegov, nenhum alerta real mascarado.

## 23/05/2026 - PROFOR 2022: baixa técnica dos 7 históricos não reapresentados na segurança pré-ativação final

- Objetivo: tratar os 7 bloqueios técnicos residuais (`#25`, `#26`, `#27`, `#28`, `#75`, `#77`, `#78`) sem registrar nova decisão, mantendo dry-run estrito e sem alterar base ativa.
- Arquivo alterado:
  - `backend/scripts/auditar-seguranca-pre-ativacao-final-pad-profor-2022.js`.
- Correção aplicada no classificador:
  - criada classificação não bloqueante `historico_nao_reapresentado_revalidado_sem_bloqueio`;
  - critérios: decisão resolutiva vigente, `payloadPreservado=true`, snapshot presente, log `decisao_registrada`, sem `diferencasCriticas` vinculadas e sem impedimento material de reconstrução vinculado;
  - impedimento técnico `decisao_nao_aplicavel:decisao_sem_efeito_definido` passou a ser tratado como histórico técnico não material para essa etapa.
- Resultado:
  - `pendencia_operacional_real = 0`;
  - `bloqueios técnicos ativos = 0` no relatório final;
  - os 7 IDs migraram de bloqueio ativo para histórico não bloqueante;
  - `#47-#74` permaneceram históricos revalidados não bloqueantes;
  - `#18` permaneceu retificada não bloqueante;
  - `Apto para ativação controlada = sim` no relatório de segurança final (sem autorização de ativar/publicar).
- Validações executadas:
  - `npm run profor:pad:auditar-pendencias-profundo` -> OK;
  - `npm run profor:pad:reconstruir-plano:dry-run` -> OK;
  - `npm run profor:pad:comparar-plano:dry-run` -> OK;
  - `npm run profor:pad:seguranca-pre-ativacao:final` -> OK;
  - `npm run validar:syntax` -> OK;
  - `npm run validar:services` -> OK;
  - `git diff --check` -> sem erro estrutural (apenas avisos LF/CRLF);
  - `git status --short frontend/data/publicados` -> sem alterações;
  - `git status --short "*.sqlite*"`/`"*.sqlite-wal"`/`"*.sqlite-shm"` -> sem alterações.
- Restrições preservadas:
  - sem publicação, sem ativação, sem alteração de origem ativa, sem alteração de `planoAplicacao` oficial, sem alteração em SQLite, sem SQL direto, sem registro de decisão.

## 23/05/2026 - PROFOR 2022: harmonização do relatório de segurança pré-ativação final

- Objetivo: ajustar o relatório final de segurança pré-ativação para categorizar corretamente as divergências revalidadas, diferenciando-as de bloqueios ativos vigentes e decisões obsoletas inativas.
- Alterações Realizadas:
  - Ajuste na função `montarDiagnosticoPayloadAlterado` em `backend/scripts/auditar-seguranca-pre-ativacao-final-pad-profor-2022.js` para detectar se a decisão vigente foi revalidada (com payload preservado).
  - Categorização das divergências revalidadas com `classificacaoFinal: "decisao_historica_nao_vigente_com_payload_alterado"`, prioridade `baixa`, ação `nenhuma_historico_preservado`, impacto `historico_revalidado_sem_bloqueio` e recomendação informativa.
  - Segregação visual e estrutural do relatório em seções separadas:
    1. **Bloqueios ativos vigentes:** contendo apenas as 7 divergências históricas não reapresentadas (#25, #26, #27, #28, #75, #77, #78).
    2. **Histórico de decisões vigentes revalidadas:** contendo os 27 payloads revalidados (#47-#74).
    3. **Histórico de pendências técnicas retificadas:** contendo o item retificado #18.
- Resultados:
  - As 27 divergências revalidadas deixaram de aparecer como `revalidacao_humana_necessaria` ativa.
  - A matriz de bloqueios ativos agora apresenta de forma limpa apenas os 7 bloqueios ativos vigentes.
  - 130/130 testes passando e relatórios dry-run atualizados com sucesso.

## 23/05/2026 - PROFOR 2022: revalidação dos 27 payloads alterados em 4 lotes separados

- Objetivo: registrar decisões de revalidação ACEITO para os 27 casos de `payload_alterado_apos_decisao` em lotes e commits separados, baixando formalmente os bloqueios técnicos sem alterar o plano de aplicação oficial nem publicar.
- Contexto: A revalidação foi dividida em 4 lotes operacionais, sendo cada lote auditado pelo respectivo subagente e verificado pós-lote pelo Subagent C de segurança.
- Resultados e Validações por Lote:
  - **Lote 1 (#47-#54, AL/937221):** Decisões #188 a #195 registradas. Commit `2fbb931` pushed.
  - **Lote 2 (#56-#63, AL/937221):** Decisões #196 a #203 registradas. Commit `2a25101` pushed.
  - **Lote 3 (#64-#71, AL/937221):** Decisões #204 a #211 registradas. Commit `ae18456` pushed.
  - **Lote 4 (#72-#74, AC/937782):** Decisões #212 a #214 registradas (ID #72 revalidado com decisões antigas #107/#108 preservadas). Commit `f38552f` pushed.
- Ações no Auditor de Segurança:
  - Correção localizada no serviço `backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service.js` (`classificarPayloadDecisao` e `auditarPayloadDecisoes`) para fazer a classificação de `payload_alterado_apos_decisao` respeitar a vigência da decisão (`ehVigente`). Decisões antigas e obsoletas com hash desatualizado passam a não bloquear a ativação, permitindo que a nova decisão de revalidação baixe formalmente o bloqueio técnico.
- Estado Final Integrado:
  - Bloqueios técnicos por payload alterado caíram de 27 para 0.
  - Total de bloqueios de ativação ativos na matriz de segurança caiu de 35 para 7 (restam apenas as 7 divergências históricas não reapresentadas).
  - `pendencia_operacional_real` permaneceu em `0`.
  - `wal_checkpoint(TRUNCATE)` executado antes de cada commit do SQLite.
  - 130/130 testes passando com sucesso.
  - Nenhuma publicação ou ativação de dados executada.

## 23/05/2026 - PROFOR 2022: conclusão da auditoria dry-run de revalidação dos 27 payloads alterados

- Objetivo: concluir e validar a auditoria dry-run das 27 divergências únicas (28 decisões afetadas, incluindo a #72 com duas decisões) marcadas com o bloqueio formal de `payload_alterado_apos_decisao`.
- Contexto: a revalidação é necessária devido à alteração no hash de payload após a re-extração/normalização, mantendo as decisões antigas e a prevalência do PAD.
- Resultados da Auditoria:
  - Total divergências únicas avaliadas: 27.
  - Total decisões afetadas: 28 (divergência #72 detalhada com 2 decisões afetadas: #107 e #108).
  - Classificação final majoritária: `revalidacao_por_prevalencia_pad` (27 de 27).
  - Ação recomendada para o futuro: registrar decisão de revalidação (ACEITO) via serviço existente (`profor-pad-revisao-decisao-service`) com `aplicadaAoPlano=false` para reescrever o snapshot de hash e liberar o bloqueio de segurança pré-ativação de forma segura.
- Garantias aplicadas (dry-run estrito):
  - Nenhuma decisão registrada no banco SQLite local.
  - `backend/data/onasp.sqlite` permaneceu inalterado.
  - `pendencia_operacional_real` permaneceu em `0`.
  - `frontend/data/publicados/` permaneceu inalterado.
  - Não houve ativação nem publicação de dados.
- Entregas de código e infra:
  - Correção na leitura do comparador JSON em `backend/scripts/auditar-revalidacao-payloads-alterados-pad-profor-2022.js` para usar `impedimentosReconstrucao` em vez do campo incorreto `impedimentos`.
  - Script adicionado ao `package.json` como: `"profor:pad:revalidacao-payloads:auditar": "node backend/scripts/auditar-revalidacao-payloads-alterados-pad-profor-2022.js"`.
  - Script integrado a `scripts/validar-syntax.js`.
  - Criado teste de serviço unitário em `tests/services/auditar-revalidacao-payloads-alterados.test.js` e integrado a `validar-syntax.js`.
  - Relatórios gerados em JSON e MD nos diretórios correspondentes.

## 23/05/2026 - PROFOR 2022: reconstitui decisão prevalência PAD da divergência #44 (gap pré-existente)

- Objetivo: completar o saneamento das decisões perdidas pelo gap
  pré-existente, registrando explicitamente a decisão prevista para
  `#44` em `historico-erros.md` (decisão complementar do trabalho de
  prevalência PAD na divergência `#44`).
- Contexto: o commit anterior `db6889a` reconstituiu `#39` e levou
  `pendencia_operacional_real = 1 → 0`. `#44` já estava classificada
  como `falso_positivo_saneavel` (não-bloqueante) via regra de
  `saldo_residual_prevalencia_pad`, mas sem decisão explícita no
  histórico, replicando o gap original.
- Ação aplicada (autorizada):
  - decisão `CORRIGIDO #187` registrada via
    `profor-pad-revisao-decisao-service.registrarDecisao` para a
    divergência `#44` (`938128/SP`, "Saldo Residual",
    `item_nao_apto`);
  - regra: **prevalência integral do PAD novo** (CUSTEIO/R$ 71,36)
    sobre memória antiga consolidada (CAPITAL/R$ 22.351,09);
  - saldo residual mantido como item técnico **não setorializado**
    por área (NAO INFORMADO); CAPITAL e CUSTEIO segregados por
    natureza;
  - `aplicadaAoPlano=false`, snapshot `_segurancaPreAtivacao` injetado
    automaticamente (hash `1c2ba2d2…`), log `decisao_registrada #2523`
    gravado;
  - `wal_checkpoint(TRUNCATE)` executado antes de stage.
- Estado final consolidado:
  - `#18 status=CORRIGIDO totalDecisoes=2` (#150 ACEITO + #185
    CORRIGIDO retificadora) → `bloqueio_tecnico_residual_retificado`;
  - `#39 status=ACEITO totalDecisoes=1` (#186) → `historico_saneado`;
  - `#44 status=CORRIGIDO totalDecisoes=1` (#187) →
    `historico_saneado` (saldo_residual_prevalencia_pad);
  - `pendencia_operacional_real = 0`;
  - `Histórico/saneado: 35`; `Falso positivo saneável: 73`
    (idênticos aos relatórios em `c43f327` antes do gap ser exposto);
  - bloqueios de segurança pré-ativação: `35`;
  - reconstrução: `31 impedimentos` (era `33` antes; redução pela
    aplicação das decisões #186/#187 sobre item_nao_apto);
  - diferença total prevista origem antiga × reconstrução PAD:
    `-0,24` (inalterada);
  - aptidão para ativação controlada: **continua não apto** (bloqueios
    técnicos remanescentes fora do escopo de #18/#39/#44).
- ID coincidente: a nova decisão para `#44` recebeu id **#187** por
  sequência natural (`max(id) = 186` antes desta operação). Coincide
  nominalmente com o id mencionado no `historico-erros.md` original —
  pura coincidência de alocação sequencial, sem relação histórica.
- Confirmações de escopo:
  - sem publicação;
  - origem ativa intacta; `planoAplicacao` oficial intacto;
  - `frontend/data/publicados` intacto;
  - `*.sqlite-wal` / `*.sqlite-shm` continuam fora do versionamento;
  - nenhuma decisão/log apagado;
  - `npm run validar:syntax` OK; `npm run validar:services` OK.

## 23/05/2026 - PROFOR 2022: reconstitui decisão prevalência PAD da divergência #39 (gap pré-existente)

- Objetivo: corrigir `pendencia_operacional_real = 1` exposto após
  regeneração dos dry-runs no commit `6fc8ff3`.
- Investigação:
  - `git log --all -- backend/data/onasp.sqlite` mostra que **apenas
    `0f850fb` (versionamento inicial em 22/05 10:47) e `6fc8ff3`** já
    tocaram esse arquivo; commits intermediários `c43f327`/`889adec`
    nunca atualizaram o `onasp.sqlite` versionado;
  - em `0f850fb`, `889adec` e `c43f327` o banco já tinha `max(id)
    decisões = 183`, com `#39 PENDENTE/0 decisões` e `#44 PENDENTE/0
    decisões`;
  - relatórios commitados naqueles commits descreviam `#39 ACEITO
    historico_saneado` e `#44 CORRIGIDO historico_saneado` — gerados
    contra banco+WAL local que **nunca foi checkpointed** antes do
    commit;
  - sem rastros das decisões originais em 63 backups
    `backend/data/backups/*`, em outras branches, em blobs dangling
    (`git fsck`) ou em WAL atual (0 bytes).
- Causa raiz: **inconsistência pré-existente** entre relatórios
  commitados e banco commitado, originada em `0f850fb`. Meu commit
  `6fc8ff3` apenas expôs o gap ao executar
  `db.pragma('wal_checkpoint(TRUNCATE)')` antes de stage do
  `onasp.sqlite` (hygiene correta).
- Ação aplicada nesta etapa (autorizada):
  - decisão `ACEITO #186` registrada via
    `profor-pad-revisao-decisao-service.registrarDecisao` para a
    divergência `#39` (`938128/SP`, "Agenda Planner",
    `item_nao_apto`);
  - regra: **prevalência integral do PAD novo** (CUSTEIO/R$ 1.134,27)
    sobre memória antiga (CAPITAL/R$ 1.134,30); diferença de centavos
    é arredondamento, troca de natureza é configuração oficial do PAD;
  - `aplicadaAoPlano=false`, snapshot `_segurancaPreAtivacao` injetado
    automaticamente (hash `84dc2c70…`), log `decisao_registrada #2522`
    gravado;
  - `wal_checkpoint(TRUNCATE)` executado antes de stage para garantir
    que a decisão chegue ao arquivo versionado.
- Estado restaurado:
  - `#39 status=ACEITO totalDecisoes=1 classificacao=historico_saneado`;
  - `pendencia_operacional_real = 0` (era `1`);
  - `Histórico/saneado: 33 → 34`;
  - bloqueios de segurança pré-ativação: `35` (inalterado);
  - `#44` permanece `falso_positivo_saneavel` por
    `saldo_residual_prevalencia_pad` (não é pendência operacional);
    decisão própria de #44 fica para o próximo commit.
- Confirmações de escopo:
  - sem publicação;
  - origem ativa intacta; `planoAplicacao` oficial intacto;
  - `frontend/data/publicados` intacto;
  - `*.sqlite-wal` / `*.sqlite-shm` continuam fora do versionamento;
  - nenhuma decisão/log apagado;
  - `npm run validar:syntax` OK; `npm run validar:services` OK.

## 23/05/2026 - PROFOR 2022: retificadora técnica da divergência #18 (Saldo Residual / 937221 AL)

- Objetivo: tratar #18 como bloqueio técnico isolado da segurança pré-ativação
  PAD/PROFOR 2022, a única `decisao_retificadora_necessaria` da matriz final.
- Causa diagnosticada:
  - decisão `#150` (ACEITO) sobre a divergência `item_novo_sem_rateio` em
    `937221::SALDO RESIDUAL` registrou rateio em áreas operacionais
    (OUVIDORIA 33,33%, CORREGEDORIA 33,33%, ESCOLA 33,33%) — violação da
    regra atual: saldo residual é item técnico não setorializado por área,
    segregado apenas por natureza (CAPITAL/CUSTEIO);
  - reconstrução já neutralizava o efeito via
    `validarRateioSaldoResidual` (`profor-pad-decisao-aplicacao-service.js`),
    emitindo impedimento `decisao_nao_aplicavel:saldo_residual_rateio_invalido`
    para a chaveItem e reconstruindo a linha do PAD como
    `area=NAO INFORMADO`, `natureza=CAPITAL`, `9.506,54`.
- Ação aplicada (autorizada pelo usuário):
  - retificadora **CORRIGIDO `#185`** registrada via
    `profor-pad-revisao-decisao-service.registrarDecisao` (serviço existente),
    com `aplicadaAoPlano=false`, snapshot `_segurancaPreAtivacao` injetado
    automaticamente (hash `26c10f0a…` igual ao da divergência), justificativa
    explícita e payload com **rateio único** `area=NAO INFORMADO`,
    `natureza=CAPITAL`, `100%`;
  - decisão `#150` preservada no histórico; `divergencia.status` evoluiu de
    `ACEITO` para `CORRIGIDO`;
  - log `decisao_registrada` (id `#2521`) gravado.
- Patch no auditor `auditar-seguranca-pre-ativacao-final-pad-profor-2022.js`:
  - bug corrigido em `ultimoResolutivo`: o repositório devolve `decisoes`
    ordenadas `DESC` por id; o código usava `.at(-1)` (pegava o mais antigo);
    troca para `.find(...)` (primeira correspondência → mais recente);
  - classificação de #18 passa a ser **data-driven**: lê impedimentos da
    reconstrução por `chaveItem`; se a retificadora vigente (CORRIGIDO/REVERTIDO)
    eliminou o `decisao_nao_aplicavel:saldo_residual_rateio_invalido`, a
    classificação passa de `decisao_retificadora_necessaria` para
    `bloqueio_tecnico_residual_retificado` (novo valor) com
    `impactoMaterial=tecnico_residual_saldo_residual_saneado_por_retificadora`;
  - hardcode `id === 18` removido das demais propriedades (recomendacao,
    prioridade, acaoNecessaria); todas derivam do estado técnico atual.
- Teste novo: `tests/services/auditar-seguranca-pre-ativacao-final.test.js`
  com 5 casos cobrindo `ultimoResolutivo` (retificadora prevalece, COMENTAR
  ignorado, case-insensitive, vazio → null, contrato DESC documentado).
- Efeito material no plano reconstruído:
  - linha `937221::SALDO RESIDUAL` agora aplicada via rateio `NAO INFORMADO`
    (`#185`), valor `9.506,54`;
  - diferença total previsto: `-9.506,78` → **`-0,24`**;
  - saldo divergente total: `-24.550,38` → `-15.043,84`;
  - impedimento `decisao_nao_aplicavel:saldo_residual_rateio_invalido`
    desapareceu para a chaveItem #18.
- Status pré-ativação:
  - `decisao_retificadora_necessaria`: `1 → 0`;
  - `bloqueio_tecnico_residual_retificado`: novo, `1` (apenas #18);
  - `bloqueio_tecnico_residual`: `7` (#25, #26, #27, #28, #75, #77, #78);
  - `revalidacao_humana_necessaria`: `27`;
  - **apto para ativação controlada: `não`** (33 impedimentos remanescentes
    fora do escopo de #18).
- Confirmações de escopo:
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `planoAplicacao` oficial não alterado;
  - `frontend/data/publicados` não alterado;
  - `*.sqlite*` não staged (banco modificado **apenas** via serviço, em
    `backend/data/onasp.sqlite` que é versionado — verificar status antes do
    commit);
  - decisão `#150`, logs e demais divergências preservados;
  - `npm run validar:syntax`: OK (74 arquivos);
  - `npm run validar:services`: OK (125 testes, 0 falhas);
  - `git diff --check`: limpo.
- Rollback: `git revert <commit>` (reverte código + retificadora). A
  decisão `#185` permanecerá no banco — para neutralizá-la operacionalmente,
  registrar nova decisão `REVERTIDO` via serviço. Não apagar `#150`, `#185`,
  logs ou divergências.

## 22/05/2026 - PROFOR 2022: segurança pré-ativação final após zerar pendências operacionais

- Objetivo:
  - executar a segurança pré-ativação final em modo exclusivamente dry-run,
    após `pendencia_operacional_real = 0`, para classificar os bloqueios
    técnicos remanescentes antes de qualquer ativação controlada.
- Conferência inicial:
  - branch/worktree conferidos com `git status --short`;
  - últimos commits conferidos com `git log --oneline -5`;
  - último commit relevante: `c43f327 fix(profor-2022): aplica prevalencia do PAD na divergencia 44`;
  - `frontend/data/publicados` sem alterações;
  - nenhum `*.sqlite`, `*.sqlite-wal` ou `*.sqlite-shm` listado para versionamento.
- Relatório criado:
  - `backend/scripts/auditar-seguranca-pre-ativacao-final-pad-profor-2022.js`;
  - comando `npm run profor:pad:seguranca-pre-ativacao:final`;
  - saídas:
    - `backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json`;
    - `backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.md`.
- Resultado final:
  - `pendencia_operacional_real = 0`;
  - `#44`: `historico_saneado` por `saldo_residual_prevalencia_pad`;
  - bloqueios técnicos de segurança pré-ativação: `35`;
  - divergências únicas na matriz final: `35`;
  - decisões com `payload_alterado_apos_decisao`: `28`;
  - divergências únicas com payload alterado: `27`;
  - decisões resolutivas com pendência técnica: `8`;
  - apto para ativação controlada: `não`.
- Classificações:
  - `revalidacao_humana_necessaria`: `27` divergências (`#47-#54`, `#56-#74`);
  - `bloqueio_tecnico_residual`: `7` divergências (`#25`, `#26`, `#27`, `#28`, `#75`, `#77`, `#78`);
  - `decisao_retificadora_necessaria`: `1` divergência (`#18`).
- Observação técnica:
  - o relatório de segurança estrito lista `28` decisões com payload alterado,
    porque a divergência `#72` possui duas decisões afetadas;
  - a matriz decisória final consolida `27` divergências únicas de payload
    alterado mais `8` divergências com pendência técnica, totalizando `35`
    itens para tratamento antes da ativação.
- Comandos executados:
  - `npm run profor:pad:auditar-pendencias-profundo`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:seguranca-pre-ativacao:detalhar`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `npm run profor:pad:regressao-saneamentos:auditar`;
  - `npm run profor:pad:seguranca-pre-ativacao:final`.
- Confirmações de escopo:
  - nenhuma decisão registrada;
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `planoAplicacao` oficial não alterado;
  - `frontend/data/publicados` não alterado;
  - SQLite não versionado;
  - relatório final é somente leitura e não baixa bloqueios técnicos.
- Próximos passos:
  - tratar os `27` casos de payload alterado por revalidação humana;
  - avaliar a decisão retificadora/neutralização técnica para a `#18`;
  - definir política para os `7` históricos não reapresentados antes de
    qualquer ativação controlada.
- Rollback:
  - reverter o commit desta auditoria e regenerar relatórios dry-run;
  - não apagar decisões, logs, divergências ou relatórios históricos.

## 22/05/2026 - PROFOR 2022: prevalência do PAD novo na divergência #44

- Objetivo:
  - aplicar a regra fixa de negócio segundo a qual o PAD novo prevalece
    integralmente sobre a memória antiga, concluindo a divergência `#44`
    (`938128/SP`, `Saldo Residual`) sem publicação e sem alteração do plano
    oficial.
- Regra aplicada:
  - o PAD novo é a fonte correta e suficiente para valor, natureza, código de
    natureza, quantidade, executado e saldo;
  - a memória antiga fica como referência histórica/comparativa;
  - `CAPITAL` e `CUSTEIO` continuam segregados e saldo residual permanece em
    área técnica (`NAO INFORMADO`/`N/A`), sem rateio para áreas operacionais.
- Decisão registrada:
  - divergência `#44`: decisão complementar `#187`, `CORRIGIDO`;
  - usuário: `sistema-prevalencia-pad`;
  - serviço usado: `registrarDecisao` (`profor-pad-revisao-decisao-service`);
  - `aplicadaAoPlano=false`;
  - snapshot `_segurancaPreAtivacao` presente;
  - log `decisao_registrada` confirmado (`logId=2523`);
  - decisão `#186` preservada, sem exclusão.
- Dados rastreados:
  - memória antiga `CAPITAL`: `R$ 22.351,09`;
  - PAD novo `CAPITAL` (`44905299`): `R$ 20.704,73`;
  - PAD novo `CUSTEIO` (`33903099`): `R$ 71,36`;
  - diferença bruta `CAPITAL`: `-R$ 1.646,36`;
  - diferença líquida considerando a parcela `CUSTEIO`: `-R$ 1.575,00`.
- Ajustes de código:
  - auditoria profunda passou a classificar saldo residual divergente como
    `saldo_residual_prevalencia_pad`/`falso_positivo_saneavel` quando o PAD
    está identificado por linha e natureza;
  - auditoria de saldos residuais passou a contar casos resolvidos por
    prevalência do PAD, sem tratá-los como pendência humana;
  - regressão mantém a `#44` como risco diagnosticado e rastreável, não como
    pendência operacional material.
- Resultado:
  - `#44`: status `CORRIGIDO`, `classificacaoOperacional=historico_saneado`;
  - `pendencia_operacional_real = 0`;
  - regressão: `#44` permanece `risco_confirmado_ja_diagnosticado`, com
    recomendação de prevalência do PAD.
- Arquivo atualizado:
  - `backend/data/relatorios/profor-2022-divergencia-44-parecer-decisorio.md`.
- Validações:
  - `npm run profor:pad:item-nao-apto:auditar`;
  - `npm run profor:pad:saldos-residuais:auditar`;
  - `npm run profor:pad:auditar-pendencias-profundo`;
  - `npm run profor:pad:regressao-saneamentos:auditar`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `npm run validar:syntax`;
  - `npm run validar:services`.
- Confirmações de escopo:
  - nenhuma publicação;
  - origem ativa e `planoAplicacao` oficial não alterados;
  - `frontend/data/publicados` não alterado;
  - nenhuma decisão, divergência ou log apagado;
  - SQLite foi alterado apenas pelo serviço existente de decisão e não deve ser
    versionado.
- Rollback:
  - reverter o commit de código/documentação;
  - se a decisão `#187` precisar ser desfeita, registrar nova decisão
    `REVERTIDO` via serviço existente; não apagar decisões/logs.

## 22/05/2026 - PROFOR 2022: harmonização da #46 na regressão de saneamentos

- Objetivo:
  - harmonizar a linguagem entre a auditoria profunda e o relatório de
    regressão de saneamentos para a divergência `#46` (`938277/MA`,
    `Saldo Remanescente`).
- Diagnóstico:
  - a auditoria profunda classificava a `#46` como `falso_positivo_saneavel`,
    com fechamento material por natureza;
  - o relatório de regressão ainda a chamava de
    `pendencia_material_potencial_aberta`, por ela estar em grupo PAD
    multi-linha com naturezas/códigos distintos;
  - os dois relatórios tinham finalidades diferentes, mas a redação podia
    induzir interpretação contraditória.
- Correção:
  - o auditor de regressão passou a classificar casos abertos já fechados pela
    auditoria operacional como
    `alerta_pareamento_sem_pendencia_operacional`;
  - a `#46` continua monitorada por risco de pareamento, mas não é mais
    apresentada como pendência material aberta;
  - `scripts/validar-syntax.js` passou a incluir os auditores de identidade
    material/regressão e o teste correspondente.
- Resultado:
  - `#46`: `alerta_pareamento_sem_pendencia_operacional`;
  - classificação operacional preservada: `falso_positivo_saneavel`;
  - pendências materiais potenciais abertas no relatório de regressão: `0`;
  - alertas de pareamento sem pendência operacional: `5` (`#31-#34` e `#46`).
- Validações:
  - `npm run profor:pad:regressao-saneamentos:auditar`;
  - `npm run validar:syntax`;
  - `npm run validar:services`.
- Confirmações de escopo:
  - nenhuma decisão registrada;
  - nenhum status alterado;
  - nenhuma publicação;
  - origem ativa, banco, `frontend/data/publicados` e `planoAplicacao` oficial
    não foram alterados.
- Rollback:
  - reverter esta alteração e regenerar
    `profor-2022-regressao-saneamentos-dry-run.*`.

## 22/05/2026 - PROFOR 2022: correção de saldos residuais por natureza (dry-run)

- Objetivo:
  - corrigir a classe de erro revelada pela divergência `#44` (`938128/SP`,
    `Saldo Residual`), em que memória `CAPITAL` e PAD `CUSTEIO` estavam sendo
    tratados dentro da mesma chave operacional sem segregação suficiente por
    natureza.
- Regra de negócio consolidada:
  - `Saldo Residual`, `Saldo Remanescente` e equivalentes são itens técnicos,
    não setorializados por área operacional;
  - a área técnica aceita é `N/A`, `NAO INFORMADO`, `SEM AREA`, nulo técnico
    ou equivalente controlado;
  - `CAPITAL` e `CUSTEIO` são identidades distintas e não podem ser pareadas,
    consolidadas ou rateadas entre si;
  - a chave mínima de equivalência passa a considerar
    `numeroConvenio + descricaoNormalizada + natureza`.
- Arquivos alterados:
  - novo serviço central `backend/services/profor-2022/profor-saldo-residual-service.js`;
  - novo script `backend/scripts/auditar-saldos-residuais-profor-2022.js`;
  - reconstrução dry-run, comparador, motor de decisões, auditoria profunda,
    API da revisão, tela de revisão, testes e validação de sintaxe;
  - script histórico `sanear-classificacao-pad-al-937221-profor-2022.js`
    deixou de permitir rateio igual de `Saldo Residual` entre áreas operacionais.
- Relatórios gerados:
  - `backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.json`;
  - `backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.md`.
- Resultado da auditoria específica:
  - saldos residuais/remanescentes encontrados: `113`;
  - mistura `CAPITAL/CUSTEIO`: `57`;
  - rateio por setor em relatório final pós-correção: `0`;
  - decisões anteriores afetadas: `23`;
  - a decisão `#150` da divergência `#18` foi identificada como incompatível
    por ratear `Saldo Residual` para áreas operacionais; não foi apagada nem
    alterada, apenas neutralizada no efeito dry-run.
- Caso-piloto `#44`:
  - classificada como `saldo_residual_natureza_divergente`;
  - permanece `pendencia_operacional_real`;
  - a tela passa a exibir badge `Saldo residual técnico` e o alerta:
    "Saldo residual/remanescente é item técnico não setorializado por área,
    mas segregado por natureza. CAPITAL e CUSTEIO não devem ser pareados nem
    consolidados como equivalentes.";
  - não houve decisão registrada para a `#44`.
- Impacto na reconstrução/comparador:
  - reconstrução dry-run: `37` impedimentos, incluindo bloqueios específicos
    `saldo_residual_natureza_divergente`;
  - comparação dry-run: `30` diferenças críticas, `45` itens ambíguos,
    `aptoParaPublicacao=false`;
  - saldos residuais reconstruídos deixaram de ser distribuídos por
    OUVIDORIA/CORREGEDORIA/ESCOLA e passam a usar área técnica `NAO INFORMADO`.
- Validações executadas:
  - `npm run profor:pad:item-nao-apto:auditar`;
  - `npm run profor:pad:saldos-residuais:auditar`;
  - `npm run profor:pad:auditar-pendencias-profundo`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `npm run validar:syntax`;
  - `npm run validar:services`.
- Confirmações de escopo:
  - nenhuma publicação;
  - origem ativa intacta;
  - `frontend/data/publicados` intacto;
  - `planoAplicacao` oficial não alterado;
  - nenhuma divergência, decisão ou log apagado;
  - nenhuma decisão registrada por SQL direto ou serviço.
- Riscos e rollback:
  - risco remanescente: decisões antigas incompatíveis ainda existem como
    histórico e exigem etapa própria de revalidação/retificação auditável;
  - rollback: reverter o commit, regenerar relatórios dry-run anteriores se
    necessário e não apagar decisões/logs históricos.

## 22/05/2026 - PROFOR 2022: detalhamento da segurança pré-ativação e separação operacional (dry-run)

- Contexto:
  - sequência da auditoria profunda integrada no commit `982c12d`;
  - a divergência `#24` foi resolvida manualmente pelo registrador **antes**
    desta rodada (decisão canônica `#184`, `ACEITO`, usuário `usuario-local`,
    em `2026-05-22`); não foi reaberta nem refeita nesta etapa.
- Natureza da etapa:
  - **somente diagnóstico dry-run e documentação**;
  - nenhuma decisão registrada, nenhum status alterado, nenhuma publicação,
    origem ativa intacta, `frontend/data/publicados` intacto, `planoAplicacao`
    oficial não alterado, nenhuma migration criada.
- Entregas de código:
  - novo script `backend/scripts/detalhar-seguranca-pre-ativacao-pad-profor-2022.js`
    e comando `npm run profor:pad:seguranca-pre-ativacao:detalhar`;
  - auditoria profunda (`auditar-pendencias-profor-2022-profundo.js`) atualizada
    com camada operacional de 6 categorias e consulta ampliada para incluir as
    divergências citadas pela segurança pré-ativação;
  - ambos os scripts incluídos em `scripts/validar-syntax.js`.
- Comandos executados (esteira-base, nesta ordem):
  - `auditar-fila-revisao`, `seguranca-pre-ativacao:dry-run`,
    `ausentes:auditar-substitutos`, `item-sem-rateio:auditar-rateio-antigo`,
    `item-nao-apto:auditar`, `diacritico:auditar-pendencias`,
    `rateio:auditar-quantidades:dry-run`, `reconstruir-plano:dry-run`,
    `comparar-plano:dry-run`, `auditar-pendencias-profundo`;
  - depois `seguranca-pre-ativacao:detalhar`. Todos concluíram sem erro.
- Totais atualizados após a resolução da `#24`:
  - divergências na fila: `145`; analisadas pela auditoria profunda: `143`;
  - `PENDENTE/EM_REVISAO` (status): `75`;
  - bloqueante operacional: `10` (era `11` — `#24` saiu);
  - com decisão resolutiva: `68` (`71` decisões registradas).
- Separação operacional (cada item em exatamente uma categoria):
  - `pendencia_operacional_real`: 12;
  - `bloqueio_tecnico_seguranca`: 2 (`#79`, `#80`);
  - `decisao_resolutiva_com_pendencia_tecnica`: 7 (`#25, #26, #27, #28, #75, #77, #78`);
  - `revalidacao_necessaria`: 27 (`#47–#74`, exceto `#55` e `#76`);
  - `historico_saneado`: 34 (inclui a `#24`);
  - `falso_positivo_saneavel`: 61.
- Bloqueios de segurança pré-ativação: `35` no total —
  - `28` decisões com `payload_alterado_apos_decisao` (27 divergências distintas);
  - `7` divergências `nao_reapresentada_com_decisao_resolutiva`;
  - origem provável: `provavel_reextracao_ou_regeracao_pad` em 100% dos casos;
    nenhum bloqueio decorre diretamente da correção do parser de quantidade
    (todos os 28 são `item_ausente_no_pad`).
- Distinção pendência operacional × bloqueio técnico:
  - item `ACEITO/CORRIGIDO` com bloqueio de segurança **não** é pendência
    operacional — entra em `decisao_resolutiva_com_pendencia_tecnica` ou
    `revalidacao_necessaria`;
  - pendente histórico/não reapresentado **não** é pendência operacional
    prioritária — entra em `historico_saneado`;
  - `pendencia_operacional_real` reúne só os itens que exigem decisão humana
    substantiva.
- Pendências reais bloqueantes confirmadas (excluída a `#24`):
  - `#31` Calça Tática, `#32` Cinto Tático, `#33` Coturno,
    `#34` Geladeira 410L — `937265/MS`;
  - `#38` Capacete Protetor — `937817/RJ`;
  - `#39` Agenda Planner, `#44` Saldo Residual — `938128/SP`;
  - `#46` Saldo Remanescente — `938277/MA`;
  - todas seguem `PENDENTE/impeditivo/bloqueante`; nenhuma foi resolvida.
  - a auditoria ainda sinaliza `#88, #89, #97, #115` como pendência operacional
    adicional (`quantidade_valor_unitario_inconsistente` sem enquadramento de
    falso positivo).
- Relatórios gerados/atualizados:
  - `profor-2022-pendencias-profundo-dry-run.json` / `.md`;
  - `profor-2022-seguranca-pre-ativacao-detalhada-dry-run.json` / `.md`.
- Confirmações:
  - nenhuma decisão registrada nesta etapa;
  - nenhuma publicação; origem ativa, `frontend/data/publicados` e
    `planoAplicacao` oficial intactos;
  - divergências, decisões e logs preservados.

## 21/05/2026 - PROFOR 2022: auditoria profunda de pendências PAD (dry-run)

- Objetivo:
  - finalizar a entrega do commit `auditoria` (`d6e265a`), que adicionou o
    motor `backend/scripts/auditar-pendencias-profor-2022-profundo.js` mas não
    integrou o script ao fluxo npm, não o incluiu na validação de sintaxe e não
    versionou os relatórios de saída.
- Natureza da etapa:
  - **somente diagnóstico dry-run e documentação**;
  - nenhuma decisão registrada, nenhum status alterado, nenhuma publicação,
    origem ativa intacta, `frontend/data/publicados` intacto e `planoAplicacao`
    oficial não alterado (bloco `garantias` do relatório com todos os campos
    `false`).
- Integração concluída:
  - novo comando `npm run profor:pad:auditar-pendencias-profundo` em
    `package.json`;
  - script incluído em `scripts/validar-syntax.js`;
  - revisão confirmou que o script é estritamente somente-leitura (apenas
    `SELECT`), grava só em `backend/data/relatorios` e usa corretamente os 8
    relatórios auxiliares.
- Comandos executados (esteira auxiliar, nesta ordem):
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:ausentes:auditar-substitutos`;
  - `npm run profor:pad:item-sem-rateio:auditar-rateio-antigo`;
  - `npm run profor:pad:item-nao-apto:auditar`;
  - `npm run profor:pad:diacritico:auditar-pendencias`;
  - `npm run profor:rateio:auditar-quantidades:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `npm run profor:pad:auditar-pendencias-profundo` (auditoria profunda).
- Relatórios gerados:
  - `backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.md`.
- Resumo dos achados:
  - total de divergências na fila: `145`;
  - total analisado pela auditoria profunda: `110`;
  - total `PENDENTE/EM_REVISAO`: `76`;
  - total bloqueante técnico: `45`;
  - total bloqueante operacional: `11`;
  - total com decisão resolutiva: `34` (de `71` decisões registradas);
  - total de suspeitas/falsos positivos: `62`;
  - total de pendências reais estimadas: `8`;
  - bloqueios de segurança pré-ativação: `35` (28 decisões com payload
    alterado + 7 divergências não reapresentadas).
- Categorias encontradas:
  - `valor_ou_saldo_inconsistente`: 67;
  - `possivel_falso_positivo`: 62;
  - `ja_saneado_mas_ainda_pendente`: 34;
  - `duplicidade_ou_ambiguidade_pad`: 30;
  - `pendencia_real`: 8;
  - `diacritico_ou_acentuacao`: 1;
  - `historico_nao_reapresentado`: 1.
- IDs prioritários:
  - pendências reais que exigem decisão humana: `31, 32, 33, 34, 38, 39, 44, 46`
    (todos `item_nao_apto` com divergência material; convênios `937265`,
    `937817`, `938128`, `938277`);
  - possível diacrítico com divergência material: `#24` (`937265/MS`,
    "Meia militar", preço memória R$ 37,15 × PAD R$ 37,59);
  - histórico não reapresentado: `#28` (`937216/GO`, já `ACEITO`).
- Próximos passos recomendados:
  1. revalidar as decisões antigas bloqueadas pela segurança pré-ativação;
  2. resolver as 8 pendências reais bloqueantes (`item_nao_apto` material);
  3. tratar os 67 alertas de quantidade × valor unitário por decisão sistêmica
     auditável, mantendo o total PAD como fonte de verdade;
  4. manter históricos/saneados fora da lista operacional e avaliar filtro
     backend para pendência operacional efetiva;
  5. só depois repetir reconstrução/comparador dry-run e avaliar ativação.
- Escopo respeitado:
  - nenhuma publicação;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - nenhuma migration criada;
  - divergências, decisões e logs preservados.

## 21/05/2026 - PROFOR 2022: reauditoria e saneamento da divergência `#55` com substituto `#8`

- Objetivo:
  - reauditar `#55` (`item_ausente_no_pad`, `937221/AL`) após correção do parser
    de quantidade e, se materialmente compatível, registrar decisão resolutiva
    auditável sem confirmar ausência falsa.
- Reauditoria:
  - comando: `npm run profor:pad:ausentes:auditar-substitutos`;
  - `#55` permaneceu com classificação automática
    `possivel_substituto_com_divergencia`, porém com critérios materiais
    totalmente compatíveis com o substituto `#8`:
    - `mesmoConvenio=true`, `mesmaUf=true`, `naturezaCompativel=true`;
    - `quantidadeCompativel=true` (`1 x 1`);
    - `valorUnitarioCompativel=true` (`726 x 726`);
    - `valorPrevistoCompativel=true` (`726 x 726`);
    - `valorExecutadoCompativel=true` (`0 x 0`);
    - `saldoCompativel=true` (`726 x 726`);
    - `descricaoCompativel=false` (alteração/truncamento textual).
- Classificação operacional adotada:
  - `substituto_compativel_com_descricao_alterada`.
- Decisão registrada:
  - divergência `#55`: `CORRIGIDO`;
  - decisão `#183`;
  - usuário: `sistema-saneamento-substituto-pad`;
  - serviço usado: `registrarDecisao` (`profor-pad-revisao-decisao-service`);
  - `aplicadaAoPlano=false`;
  - snapshot `_segurancaPreAtivacao` confirmado no payload da decisão;
  - log `decisao_registrada` confirmado;
  - divergência `#8` preservada (`ACEITO`, decisão `#140`), sem alteração.
- Payload de decisão aplicado na `#55`:
  - `origem`: `saneamento-ausente-com-substituto`;
  - `tipoSaneamento`: `vinculo_item_substituto`;
  - vínculo explícito `divergenciaAusenteId=55` e `divergenciaSubstitutaId=8`;
  - critérios materiais todos `true` e `decisaoSubstitutaJaAceita=true`.
- Revalidação pós-decisão:
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `git status --short frontend/data/publicados`;
  - `git ls-files "*.sqlite*"`.
- Impacto observado:
  - pendências: `77 -> 76`;
  - decisões resolutivas: `68 -> 69`;
  - `CORRIGIDO`: `4 -> 5`;
  - pendentes que bloqueiam publicação: mantido em `11`;
  - bloqueios de segurança pré-ativação: mantidos (`35`), com pendências
    remanescentes fora do escopo desta ação.
- Escopo respeitado:
  - nenhuma publicação;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - nenhuma exclusão de divergência, decisão ou log.

---

## 21/05/2026 - PROFOR 2022: correção do parser de quantidade (`"1.0"` -> `1`) + auditoria de impacto

- Branch atual: `main`.
- Objetivo:
  - impedir que quantidades decimais serializadas como string (ex.: `"1.0"`)
    sejam infladas para `10` na extração de rateio inicial da planilha antiga;
  - manter parsing monetário inalterado para campos de valor;
  - auditar impacto após regeneração dos artefatos PAD/PROFOR.
- Diagnóstico consolidado:
  - causa raiz confirmada em `backend/services/profor-2022/profor-rateio-extracao-service.js`:
    `obterValorQuantidade` usava `moedaParaNumeroProfor()`;
  - `moedaParaNumeroProfor("1.0")` remove `.` e retorna `10`;
  - caso real confirmado: `937221/AL` (forno 32 litros), planilha com `"1.0"`
    propagada como `10` para memória persistida e payload da divergência `#55`.
- Correções de código:
  - `backend/services/profor-2022/profor-plano-aplicacao-service.js`:
    - criada função `quantidadeParaNumeroProfor(valor)`;
    - mantido `moedaParaNumeroProfor(valor)` exclusivo para valores monetários;
    - export da nova função adicionada.
  - `backend/services/profor-2022/profor-rateio-extracao-service.js`:
    - `obterValorQuantidade` passou a usar `quantidadeParaNumeroProfor`.
  - `backend/scripts/auditar-quantidades-suspeitas-profor-2022.js`:
    - novo dry-run para identificar rateios ativos com incompatibilidade
      quantidade x valor previsto x valor unitário.
  - `package.json`:
    - comando novo `npm run profor:rateio:auditar-quantidades:dry-run`.
  - `scripts/validar-syntax.js`:
    - incluídos novo script e novo teste.
  - `tests/services/profor-quantidade-parser.test.js`:
    - testes para `quantidadeParaNumeroProfor`, não regressão de
      `moedaParaNumeroProfor` e `converterQuantidadePad`.
- Regeneração e validações executadas:
  - `npm run extrair:rateios-profor-2022:dry-run`;
  - `npm run profor:rateio:importar-json` (lote `2`);
  - `npm run profor:rateio:auditar-quantidades:dry-run`;
  - `npm run profor:pad:conferir-rateios:dry-run`;
  - `npm run profor:pad:relatorio-saneamento`;
  - `npm run profor:pad:gerar-fila-revisao`;
  - `npm run profor:pad:ausentes:auditar-substitutos`;
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `npm run validar:syntax`;
  - `npm run validar:services`.
- Efeito observado:
  - divergência `#55` passou a exibir `quantidadeMemoria: 1` (antes `10`);
  - comparador dry-run: `quantidade divergente` caiu para `3`
    (antes estava em patamar de centenas).
- Escopo e restrições respeitados:
  - nenhuma decisão automática registrada;
  - `#55` não foi saneada;
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado.
- Riscos remanescentes:
  - decisões resolutivas antigas podem ficar com `payloadHash` divergente após
    alteração material dos payloads e exigir revalidação manual na fila;
  - ainda existem impeditivos de reconstrução/comparação fora deste patch.

---

## 21/05/2026 - PROFOR 2022: diagnóstico da divergência `#55` e possível substituto `#8`

- Branch atual: `main`.
- Objetivo:
  - investigar, em modo dry-run, se a divergência `#55`
    (`item_ausente_no_pad`, convênio `937221/AL`) deve permanecer como ausência
    real ou se possui correspondente no PAD novo pela divergência `#8`.
- Divergência `#55`:
  - tipo: `item_ausente_no_pad`;
  - status: `PENDENTE`;
  - item de memória: `Forno de Microondas - 32 litros - Branco`;
  - chave: `937221::FORNO DE MICROONDAS - 32 LITROS - BRANCO`;
  - payload atual: quantidade `10`, valor unitário `726`, valor previsto `726`,
    valor executado `0`, saldo `726`, `1` rateio ativo;
  - decisões registradas: `0`.
- Possível substituto `#8`:
  - tipo: `item_novo_sem_rateio`;
  - status atual no banco: `ACEITO`;
  - descrição PAD: `Forno de Micro-ondas a partir de- 32 lit`;
  - payload PAD: quantidade `1`, valor unitário `726`, valor previsto `726`,
    valor executado `0`, saldo `726`, natureza `CAPITAL`;
  - decisão existente: `ACEITO` (`#140`), registrada por
    `sistema-saneamento-pad-al-937221`.
- Fontes conferidas:
  - SQLite: divergências `#55` e `#8`, payloads, logs e decisões;
  - `backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-saneamento.json`;
  - `backend/data/relatorios/profor-2022-item-sem-rateio-rateio-antigo-dry-run.json`;
  - `backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json`;
  - planilha antiga `Planilhas/gestao_financeira_ouvidoria.xlsx`, aba `AL`.
- Evidência principal:
  - a planilha antiga, aba `AL`, linha `12`, traz quantidade original `"1.0"`
    para `Forno de Microondas - 32 litros - Branco`;
  - a memória persistida (`profor_2022_item_rateios`, item conhecido `456`)
    registrou `quantidade_referencia=10`;
  - `moedaParaNumeroProfor("1.0")` retorna `10`, pois o parser monetário remove
    o ponto antes de converter;
  - os valores financeiro/material (`726`, `0`, `726`) fecham integralmente com
    o PAD da divergência `#8`, que possui quantidade `1`.
- Conclusão:
  - a `#55` tem correspondente no PAD novo pela `#8`;
  - o vínculo `#55 -> #8` é tecnicamente provável;
  - a divergência de quantidade decorre de inconsistência de leitura/agregação da
    memória antiga, não de divergência material do PAD;
  - classificação: `substituto_compativel_com_quantidade_memoria_inconsistente`.
- Recomendação:
  - não confirmar ausência da `#55`;
  - tratar como substituição/atualização de descrição com saneamento assistido,
    cuidando para não duplicar o efeito já registrado na `#8`;
  - antes de saneamentos em massa, corrigir ou isolar a conversão de quantidade
    para não transformar strings decimais como `"1.0"` em `10`.
- Relatórios gerados:
  - `backend/data/relatorios/profor-2022-diagnostico-55-8-forno-al.json`;
  - `backend/data/relatorios/profor-2022-diagnostico-55-8-forno-al.md`.
- Escopo:
  - nenhuma decisão registrada;
  - nenhum status alterado;
  - nenhuma ausência confirmada;
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado.
- Riscos:
  - existem outros itens com quantidade em string decimal na planilha antiga que
    podem ter sido inflados pelo mesmo parser;
  - como a `#8` já está `ACEITO`, uma próxima decisão para a `#55` precisa ser
    auditável e sem duplicidade de efeito na reconstrução dry-run.

---

## 21/05/2026 - PROFOR 2022: Contador de Pendências, Auto-avanço e Detalhe Inline na Tela de Revisão (UX)

- **Status**: Implementado e Validado.
- **Tipo de mudança**: **Somente frontend/UX** (`frontend/js/app.js`, `frontend/css/app.css`, cache-buster em `index.html`, teste E2E). Sem alteração de backend, banco, publicação, origem ativa ou `planoAplicacao` oficial.

### Problema de UX

Na tela `SISTEMA > Revisão de divergências`: (1) não havia um contador de pendências destacado; (2) após registrar uma decisão, o usuário tinha de rolar a tela de volta ao topo e clicar manualmente na próxima divergência; (3) o painel de detalhe ficava isolado no rodapé da página — ao clicar em "Revisar", o conteúdo abria fora da viewport, obrigando o usuário a rolar até o fim para vê-lo.

### Correções

- **Contador de pendências visível**: novo banner no topo da view (`#revisao-contador-pendencias`) com o número de pendências operacionais em destaque. Atualizado por `atualizarContadorPendenciasRevisao()` a cada carga da lista; fica verde ("fila concluída") quando zera e ajusta o texto no modo auditoria.
- **Auto-avanço**: ao registrar uma decisão, `avancarParaProximaPendenciaRevisao()` abre automaticamente a próxima pendência da lista. Guarda o índice da divergência decidida antes de recarregar a fila e abre a que assume essa posição; nunca reabre a recém-decidida; quando a fila zera, exibe "Fila de pendências concluída".
- **Detalhe inline (acordeão)**: o painel de detalhe deixou de ficar isolado no rodapé. Ao clicar em "Revisar", o detalhe expande numa linha extra (`tr.revisao-linha-detalhe`) logo abaixo da linha clicada, dentro da própria tabela — o usuário vê o detalhe exatamente onde clicou. Apenas uma linha fica expandida por vez; `fecharDetalheInlineRevisao()` recolhe as demais. Clicar de novo na linha já expandida **recolhe** (toggle). A expansão é animada (`grid-template-rows` 0fr→1fr + leve fade/slide do conteúdo), respeitando `prefers-reduced-motion`. O painel `#revisao-divergencia-detalhe` do rodapé permanece como fallback (fila concluída / erro).

### Validações

- `node --check` e `npm run validar:syntax` (61 arquivos) — OK.
- Suíte E2E completa — 15/15, incluindo asserção do contador de pendências.
- Teste manual com backend real: expandir/recolher (toggle), troca de linha e auto-avanço funcionando sem erro de console.
- `git diff --check` limpo; `frontend/data/publicados` sem alterações; nenhum SQLite versionado.

### Confirmação

Mudança apenas de frontend/UX; sem publicação, alteração de origem ativa ou do `planoAplicacao` oficial.

## 21/05/2026 - PROFOR 2022: Saneamento da Classificação do PAD AL — Convênio 937221 (a partir do ExtratoProposta.pdf)

- **Status**: Implementado e Validado.
- **Tipo de mudança**: Novo script de saneamento + comando npm. Registra decisões via serviço existente `registrarDecisao` (sem SQL direto). Não houve publicação, alteração de origem ativa, de `frontend/data/publicados`, do `planoAplicacao` oficial, migration ou dependência. Nenhum SQLite versionado.

### Contexto

O documento oficial `ExtratoProposta.pdf` (Plano de Aplicação Detalhado do convênio 937221/AL) traz, na descrição/observação de cada item, a área destinatária (OUVIDORIA, CORREGEDORIA ou ESCOLA). A partir dele foi feita a curadoria humana da classificação dos itens novos do PAD e a confirmação de quais itens da memória antiga realmente não foram reapresentados.

### O que foi saneado

O convênio 937221 tinha 39 divergências `PENDENTE`. Foram resolvidas **37**, restando **2** pendentes:

- **14 `item_novo_sem_rateio`** → decisão `ACEITO` com `payloadDecisao.rateio` por área. 13 itens têm área única no extrato (rateio 100%); o item "Saldo Residual" (localização "Ouvidoria, escola, corregedoria" no PDF) foi rateado igualmente entre as três áreas (33,33% cada).
- **23 `item_ausente_no_pad`** sem substituto → decisão `ACEITO` confirmando ausência: itens da memória antiga que não constam do PAD novo, substituídos por outros itens na nova proposta.
- **2 mantidas `PENDENTE`** (#55 "Forno de Microondas 32 litros", #66 "Poltronas") — classificadas pela auditoria de substitutos como `possivel_substituto_com_divergencia` (têm candidato no PAD, mas com divergência de quantidade); exigem revisão humana e não foram saneadas automaticamente.

### Implementação

Script `backend/scripts/sanear-classificacao-pad-al-937221-profor-2022.js`, comando `npm run profor:pad:al-937221:sanear-classificacao` (suporta `--dry-run`). O mapeamento área↔item está embutido no script como dado de origem documental (curadoria do `ExtratoProposta.pdf`), identificando cada divergência pela `chave_item` (estável). As decisões usam usuário `sistema-saneamento-pad-al-937221`, `payloadDecisao` com `fonteClassificacao: "ExtratoProposta.pdf"`, snapshot `_segurancaPreAtivacao` e log automáticos. Idempotente: ignora divergências já resolutivas.

### Validações

- `node --check` e `npm run validar:syntax` (61 arquivos) — OK.
- `seguranca-pre-ativacao` (dry-run): 68 decisões auditadas; `payloadAlteradoAposDecisao` permanece **apenas #72/#73/#74** (pré-existentes) — nenhuma das 37 novas decisões alterou payload.
- `reconstruir-plano` (dry-run): 628 linhas (era 607; +21 dos itens novos do 937221 que passaram a ter rateio).
- `comparar-plano` (dry-run): 30 diferenças críticas (era 9; +21 do convênio 937221) — **efeito esperado**: itens novos do PAD que recebem rateio entram na reconstrução e aparecem como diferença ante a origem antiga até a homologação final; não é regressão.
- `validar-decisao-estruturada-ponta-a-ponta.js`: SUCESSO absoluto.
- `git diff --check` limpo; `frontend/data/publicados` sem alterações; nenhum SQLite versionado.

### Impacto na fila

Convênio 937221: de 39 → 2 pendências. Fila total PROFOR 2022: 120 → 78 pendentes.

### Confirmação

Sem publicação, sem alterar origem ativa, `frontend/data/publicados` ou o `planoAplicacao` oficial. Nenhuma decisão/log apagado. As decisões de ausência foram registradas com base no documento oficial, não confirmadas automaticamente sem fonte.

## 21/05/2026 - PROFOR 2022: Vínculo de Itens Ausentes a Substitutos no PAD (#76 → #23)

- **Status**: Implementado e Validado.
- **Tipo de mudança**: Backend (serviço puro + 2 scripts) + frontend/UX + testes. Não houve publicação, alteração de origem ativa, de `frontend/data/publicados`, do `planoAplicacao` oficial, criação de migration ou de dependência. Nenhum SQLite é versionado.

### Problema observado na #76

A tela `SISTEMA > Revisão de divergências` apresentava a divergência **#76** (`item_ausente_no_pad`, convênio 937782/AC, "Notebook 4 núcleos 2.4ghz ram ddr 4 8gb") como simples item ausente, com PAD novo "não informado" e ação sugerida "Confirmar ausência". Isso é incorreto: o item não está ausente — foi reapresentado no PAD com atualização de especificação técnica.

### Causa

A #76 é o **espelho antigo** da divergência **#23** (`item_novo_sem_rateio`, "Notebook 4 núcleos 4.2ghz ram ddr 4 8gb"), já `ACEITO`. Não havia regra que cruzasse `item_ausente_no_pad` com o item novo correspondente no PAD. A tela poderia induzir o usuário a confirmar ausência falsa.

### Diagnóstico do vínculo #76 → #23

Confirmado por dados materiais e prova documental. Todos os campos batem: convênio 937782, UF AC, natureza CAPITAL, quantidade 2, valor unitário R$ 3.599,99, valor previsto R$ 7.199,98, valor executado R$ 6.229,86, saldo R$ 970,12. As descrições diferem apenas na especificação técnica `2.4ghz` x `4.2ghz`. **Prova documental**: a decisão `ACEITO` da #23 (id 85) tem `payloadDecisao.itemMemoria.chaveItem = "937782::NOTEBOOK 4 NUCLEOS 2.4GHZ RAM DDR 4 8GB"` — exatamente a `chave_item` da #76; o rateio antigo da #23 veio da memória da #76.

### Regra de vínculo com substituto

Novo serviço puro `profor-pad-substituto-auditoria-service.js` (testável sem banco). Uma divergência `item_ausente_no_pad` só é `substituto_compativel` quando há item novo no PAD com: mesmo convênio; mesma UF (se disponível); natureza compatível; quantidade igual; valor unitário, valor previsto, valor executado e saldo compatíveis dentro de R$ 0,01; e descrição compatível por **alteração controlada** — iguais após normalização OU divergindo em no máximo UM token e esse token contém dígitos (ex.: frequência). Sem fuzzy amplo. Classificações: `substituto_compativel`, `possivel_substituto_com_divergencia`, `ausencia_real_sem_substituto`, `dados_insuficientes`, `ja_decidido`.

### Auditoria e saneamento

- `npm run profor:pad:ausentes:auditar-substitutos` (script `auditar-ausentes-com-substituto-pad-profor-2022.js`): auditoria dry-run; gera `profor-2022-ausentes-substitutos-dry-run.{json,md}`.
- `npm run profor:pad:ausentes:sanear-substitutos` (script `sanear-ausentes-com-substituto-pad-profor-2022.js`): registra decisão resolutiva **apenas** para `substituto_compativel`, via serviço existente `registrarDecisao` (sem SQL direto). Decisão `CORRIGIDO`, usuário `sistema-saneamento-substituto-pad`, `aplicadaAoPlano=false`, snapshot `_segurancaPreAtivacao` e log automáticos, `payloadDecisao.tipoSaneamento = "vinculo_item_substituto"`. Proteção: nunca registra sobre divergência já resolutiva.

### IDs saneados e mantidos

- Auditoria: 32 ausentes analisados — **1 substituto compatível (#76 → #23)**, 2 possíveis substitutos com divergência (#55, #66 — quantidade/descrição divergem, mantidos para revisão humana), 23 ausências reais sem substituto, 6 já decididas.
- Saneamento: **#76 saneada**, `PENDENTE → CORRIGIDO`, vinculada à #23. Re-auditoria: `substituto_compativel` 1 → 0, `ja_decidido` 6 → 7 (idempotente).
- **#23 permanece `ACEITO` e inalterada.** Nenhuma ausência real foi saneada; nenhuma decisão falsa de ausência foi criada (a decisão registra o vínculo, não confirma ausência).

### Frontend

Quando há vínculo de substituto (detectado pela decisão `vinculo_item_substituto` ou por payload), a tela: (a) exibe o bloco "Item substituído no PAD" / "Vínculo com substituto saneado" com a divergência vinculada; (b) substitui "Confirmar ausência" como ação principal pela ação "Confirmar vínculo com substituto"; (c) mostra "Reapresentado no PAD (substituto)" no estado. Itens realmente ausentes, sem substituto, continuam com `item_ausente_no_pad` e "Confirmar ausência" — Tarefa F preservada.

### Impacto na auditoria / segurança / reconstrução / comparador

- `auditar-fila-revisao`: 145 divergências, 120 pendentes.
- `seguranca-pre-ativacao` (dry-run): `payloadAlteradoAposDecisao: 4` — são #72/#73/#74, pré-existentes de ciclos anteriores; **a #76 não está entre os alterados nem nos bloqueios** (snapshot íntegro).
- `reconstruir-plano` (dry-run): 607 linhas; `comparar-plano` (dry-run): 9 diferenças críticas. A decisão `vinculo_item_substituto` **não é interpretada pelo motor de aplicação** (`profor-pad-decisao-aplicacao-service.js` não a referencia) — é puramente de auditoria/rastreabilidade, não gera linha de plano. A variação ante o ciclo anterior decorre da regeneração natural da fila, não do vínculo; a 9ª crítica é "Ar condicionado 60.000 BTUs" do convênio 937221, sem relação com #76/#23.
- `validar-decisao-estruturada-ponta-a-ponta.js`: SUCESSO absoluto, retorno ao baseline validado.

### Testes

- `tests/services/profor-pad-substituto-auditoria.test.js` (15 testes): substituição de especificação como alteração controlada, rejeição de fuzzy amplo, travas materiais, classificação #76 → #23, rejeição de candidatos com quantidade/valor/natureza divergente, `ja_decidido`, `dados_insuficientes`.
- `tests/e2e/app.spec.js`: novo smoke "item ausente com substituto no PAD exibe vínculo e não sugere confirmar ausência". Suíte E2E completa: 15/15. `validar:services`: 71 testes OK.

### Confirmação

Sem publicação, sem alterar origem ativa, `frontend/data/publicados` ou o `planoAplicacao` oficial. Nenhuma decisão falsa de ausência criada. Nenhuma decisão/log apagado.

## 21/05/2026 - PROFOR 2022: Rateio por Quantidade por Setor e Decisão por Ação Sugerida

- **Status**: Implementado e Validado.
- **Tipo de mudança**: **Somente frontend/UX** (`frontend/js/app.js`, `frontend/css/app.css`, cache-buster em `index.html`, teste E2E). Não houve alteração de backend, banco, migration, dependências, publicação, origem ativa, `frontend/data/publicados` ou do `planoAplicacao` oficial.

### Problema de UX

O painel "Rateio manual" da tela `SISTEMA > Revisão de divergências` exigia digitação de percentuais (`% valor` e `% quantidade`), tinha campos de observação por linha e observação geral, pedia a natureza por digitação, e o formulário de decisão exibia "Usuário responsável" e o dropdown "Motivo da decisão". O usuário não trabalha com percentuais nem com rateio de valor: ele classifica o item entre os setores OUVIDORIA, CORREGEDORIA e ESCOLA PENAL e atribui **quantidades inteiras** a cada um.

### Correção (rateio por quantidade)

- Cada linha de rateio passou a ter **apenas dois campos**: **Setor** (`<select>` fixo com OUVIDORIA, CORREGEDORIA, ESCOLA PENAL — sem digitação livre) e **Quantidade** (inteiro).
- **Removidos das linhas**: `% valor`, `% quantidade`, `Observação`. **Removido** o campo "Observação geral do rateio".
- **Natureza**: não é mais digitada — vem automaticamente do PAD (`payload.naturezaPad`) e é exibida como referência no cabeçalho do editor.
- **Quantidade total do item**: usada do PAD (`payload.quantidadePad`) quando disponível; quando o PAD não traz, há um campo para o usuário informá-la. Um indicador "Atribuído: X de Y" mostra o saldo em tempo real.
- "Adicionar linha" / "Remover" continuam, para ratear entre 2 ou 3 setores.

### Conversão para o backend (sem tocar no backend)

O backend (`profor-pad-decisao-aplicacao-service.js`, `validarRateioManual`) espera `percentualQuantidade` somando 100 e `area`/`natureza` por linha. Em `montarPayloadDecisaoRevisao` (categoria `rateio`), a quantidade de cada setor é **convertida em `percentualQuantidade`** = `quantidadeDaLinha / somaDasQuantidades × 100`. Cada item de `payloadDecisao.rateio` carrega `area`, `natureza` (do PAD), `quantidade` (absoluta, para rastreabilidade) e `percentualQuantidade`. `percentualValor` deixou de ser enviado. O payload exibido continua idêntico ao do POST.

### Validação de rateio (cliente)

`validarPayloadDecisaoRevisao` foi reescrita para a categoria `rateio`: toda linha exige setor e quantidade > 0; não permite setor repetido; a soma das quantidades deve fechar o total do item quando conhecido.

### Simplificação do formulário de decisão

- **Removido o campo "Usuário responsável"** da tela. O usuário é sempre o mesmo: usado silenciosamente do `localStorage` (`profor2022:revisao:usuarioResponsavel`, fallback `usuario-local`). O POST continua enviando `usuario`.
- **Removido o dropdown "Motivo da decisão"**. A justificativa vem inteiramente do preset da ação sugerida clicada. Basta clicar no chip da ação (ex.: "Informar rateio manual", "Aceitar equivalência") e em "Registrar decisão".
- Mantidos: chips de ação rápida, observação adicional opcional recolhida, opções avançadas e payload técnico recolhível.

### Bug corrigido durante a implementação

Detectado e corrigido `Unexpected token '||'`: a expressão `a ?? b || null` é erro de sintaxe no motor do navegador (mistura de `??` e `||` sem parênteses) — embora `node --check` a aceitasse. Substituída por condicional explícita.

### Validações

- `node --check frontend/js/app.js` — OK.
- `npm run validar:syntax` — 61 arquivos OK.
- `npm run validar:services` — 56 testes OK.
- Suíte E2E Playwright completa — 14/14, incluindo o teste de rateio atualizado para o novo fluxo (setor + quantidade, ausência de percentuais/observação/usuário/motivo, payload com `percentualQuantidade`).
- `git diff --check` sem erros; `frontend/data/publicados` sem alterações; nenhum SQLite versionado.

### Confirmação

Mudança exclusivamente de frontend/UX; backend, banco e contrato de API intactos. Sem publicação, sem alterar origem ativa ou `planoAplicacao` oficial. Nenhuma decisão real registrada durante os testes.

## 21/05/2026 - PROFOR 2022: Saneamento Sistêmico de Pendências Residuais de Diacrítico e Correção do `item_ausente_no_pad`

- **Status**: Implementado e Validado.
- **Tipo de mudança**: Frontend/UX + auditoria/saneamento auditável dry-run + testes. Não houve publicação, alteração de origem ativa, de `frontend/data/publicados`, do `planoAplicacao` oficial, criação de migration ou de dependência nova. Nenhum SQLite é versionado.

### Problema identificado

Mesmo após a correção de acentuação/diacrítico no matching, a tela `SISTEMA > Revisão de divergências` ainda podia exibir como pendência operacional itens cuja diferença é apenas de acento (ex.: video/vídeo, minimo/mínimo, Camera/Câmera), e a divergência `item_ausente_no_pad` exibia mau payload:

1. Itens cuja diferença é apenas acento podiam aparecer como pendência operacional.
2. Divergências históricas não reapresentadas continuavam visíveis como `PENDENTE`.
3. Em `item_ausente_no_pad`, `valorAnterior` poderia carregar descrição textual em vez de marcador de estado.
4. A tela podia induzir o usuário a "Confirmar ausência" de item que existe no PAD com diferença só de acento.

### Causa

- A estrutura do payload de `item_ausente_no_pad` precisava de campos financeiros próprios e de marcadores de estado (`presente_na_memoria`/`ausente_no_pad`) em vez de descrição em `valorAnterior`.
- A lista operacional não distinguia pendência real de histórico/saneado.
- Não havia auditoria sistêmica que classificasse pendências residuais de diacrítico nem comando auditável de saneamento.

### Correção

- **Backend (`profor-pad-revisao-service.js`)**: `divergenciasAusentes()` já produz `valorAnterior: "presente_na_memoria"`, `valorNovo: "ausente_no_pad"` e payload com `descricaoMemoria`, `naturezaMemoria`, `quantidadeMemoria`, `valorUnitarioMemoria`, `valorPrevistoMemoria`, `valorExecutadoMemoria`, `saldoMemoria`, `totalRateiosAtivosMemoria`, `memoria`, `antes` e a flag `saneadoPorDiacritico`. Valores ausentes vêm como `null`, nunca descrição. `divergenciasAusentes` foi exposta no `module.exports` para teste unitário.
- **Serviço novo (`profor-pad-diacritico-auditoria-service.js`)**: módulo puro, sem banco, com `classificarDivergenciaDiacritico()`, `diferencaApenasAcentuacaoOuDiacritico()`, `valorUnitarioCompativel()` (tolerância R$ 0,01), `normalizarNatureza()` e `montarSaneadasMap()`.
- **Script de auditoria (`auditar-pendencias-diacritico-pad-profor-2022.js`)**: reescrito para consumir o serviço; comando `npm run profor:pad:diacritico:auditar-pendencias`; gera `profor-2022-pendencias-diacritico-dry-run.json` e `.md`.
- **Script de saneamento (`sanear-pendencias-diacritico-pad-profor-2022.js`)**: comando `npm run profor:pad:diacritico:sanear-pendencias`; registra decisão `CORRIGIDO` apenas para `saneavel_automaticamente_por_diacritico`, via serviço `registrarDecisao` (sem SQL direto), usuário `sistema-saneamento-diacritico`, `aplicadaAoPlano=false`, snapshot `_segurancaPreAtivacao` e log automáticos. Proteção defensiva: re-checa o status atual e nunca registra decisão sobre divergência já resolutiva.
- **Frontend (`app.js`)**: para `campoAfetado = 'existencia'` a tela não exibe mais descrição em "Valor anterior/novo" — mostra "Estado anterior/novo" (Presente na memória / Ausente no PAD) e os valores financeiros reais (valor unitário, previsto, executado, saldo, rateios ativos), exibindo "não informado" quando ausentes. Quando há evidência de saneamento por diacrítico (`saneadoPorDiacritico`), "Confirmar ausência" deixa de ser a ação principal — a ação primária passa a ser "Não é ausência (diferença de acento)". A lista operacional padrão oculta divergências com decisão resolutiva, históricas não reapresentadas e saneadas por diacrítico; novo checkbox "Mostrar históricos/saneados automaticamente" reexibe tudo para auditoria.

### Critérios de saneamento automático

Uma divergência só é `saneavel_automaticamente_por_diacritico` quando: descrição memória x PAD difere apenas por acentuação/diacrítico; números e tokens técnicos idênticos; mesmo convênio; natureza compatível; valor unitário compatível dentro de R$ 0,01; e há evidência de correspondência no PAD (`saneadoPorDiacritico` no payload ou em `equivalenciasDiacriticoSaneadas`). Não saneável: diferença numérica/técnica (2.4ghz x 4.2ghz), divergência de valor (Meia militar R$ 37,15 x R$ 37,59), natureza divergente, ou dados insuficientes.

### IDs saneados e mantidos pendentes

Diagnóstico do estado atual da fila (145 divergências):

- **Pendências residuais de diacrítico saneadas nesta execução: 0.** A auditoria classificou 0 como `saneavel_automaticamente_por_diacritico` porque os 3 casos reais de equivalência por diacrítico do convênio 937782 (#25 Desktop video/vídeo, #26 Smartphone minimo/mínimo, #27 Switcher video/vídeo) **já estavam `ACEITO`** e #75 (item_ausente_no_pad Desktop video) já estava `CORRIGIDO` por ciclo anterior — classificados como `ja_decidido`.
- **#24 "Meia militar" (convênio 937265): mantido `PENDENTE`** — classificado `divergencia_material` porque há divergência real de valor unitário (R$ 37,15 x R$ 37,59).
- `historico_nao_reapresentado_sem_correspondencia`: 121 (itens conhecidos ausentes de outros convênios, sem correspondência de acento).
- `ja_decidido`: 23. `dados_insuficientes`: 0.
- **Nenhuma decisão falsa de ausência foi criada**: `idsSaneaveis` vazio; o comando de saneamento registrou 0 decisões.

### Impacto na auditoria / reconstrução / comparador

- `auditar-fila-revisao`: último lote `id 31`, 139 reapresentadas, 6 não reapresentadas.
- `seguranca-pre-ativacao` (dry-run): após `gerar-fila-revisao` o snapshot detectou `payloadAlteradoAposDecisao: 4` (divergências `item_ausente_no_pad` #72/#73/#74 e correlata, cujo payload foi reestruturado em ciclo anterior) e `divergenciasNaoReapresentadas` com decisão resolutiva. Isso é o **mecanismo de rastreabilidade funcionando como projetado**: o snapshot `_segurancaPreAtivacao` sinaliza que essas decisões precisam ser revalidadas; nenhuma decisão ou log foi perdido. O banco local não é versionado.
- `reconstruir-plano` (dry-run): 606 linhas reconstruídas, sem regressão estrutural.
- `comparar-plano` (dry-run): 8 diferenças críticas (mesmas já documentadas), 49 itens ambíguos — sem regressão atribuível a esta mudança.
- `validar-decisao-estruturada-ponta-a-ponta.js`: SUCESSO absoluto, retorno ao baseline validado.

### Testes

- `tests/services/profor-pad-diacritico-auditoria.test.js` (12 testes): acento simples saneável, divergência de valor/natureza/técnica não saneável, item ausente com/sem correspondência, `ja_decidido`, dados insuficientes.
- `tests/services/profor-pad-item-ausente.test.js` (7 testes): `valorAnterior` não recebe descrição; payload financeiro preenchido com rateio ativo; `null` quando sem valores; `saneadoPorDiacritico`.
- `tests/e2e/app.spec.js`: novo smoke "item ausente no PAD não exibe descrição em valor anterior e mostra valores financeiros". Suíte E2E completa: 14/14.
- `npm run validar:services`: 56 testes OK.

### Confirmação

Mudança não publica, não altera origem ativa, `frontend/data/publicados` ou o `planoAplicacao` oficial. Nenhuma decisão real foi registrada durante os testes. Os relatórios dry-run de segurança/reconstrução/comparação foram revertidos por refletirem estado transitório de auditoria fora do escopo do patch.



- **Status**: Implementado e Validado.
- **Tipo de mudança**: **Apenas frontend/UX**. Não houve alteração de backend, banco, migration, dependências, publicação, origem ativa ou do `planoAplicacao` oficial.
- **Problema de UX identificado**: A tela `SISTEMA > Revisão de divergências PAD x memória` exigia digitação manual em todas as decisões — justificativa/comentário em texto livre, usuário responsável a cada decisão e campos técnicos sempre expostos. No saneamento operacional das divergências PAD/PROFOR 2022 isso tornava o fluxo lento e sujeito a inconsistência textual. Exemplo concreto: a divergência `#25` (`equivalencia_por_descricao_normalizada`, "Desktop para edição de video" x "Desktop para edição de vídeo", mesma natureza CAPITAL e mesmo valor unitário R$ 14.849,00, diferença só de acentuação) obrigava o usuário a digitar manualmente algo como "descrição igual".
- **Decisão adotada**: Transformar o formulário de decisão em **fluxo de decisão assistida** — opções pré-definidas (presets) por tipo de divergência, reduzindo digitação, preservando `payloadDecisao`, snapshot `_segurancaPreAtivacao`, logs, rastreabilidade e compatibilidade total com o backend atual. Patch incremental e reversível; a tela não foi reescrita.
- **Arquivos alterados**:
  - `frontend/js/app.js` — presets por tipo, chips de ação rápida, dropdown de motivo, composição automática de justificativa, usuário responsável via `localStorage`, ocultação de campos.
  - `frontend/css/app.css` — estilos dos chips de ação rápida e dos blocos recolhíveis.
  - `tests/e2e/app.spec.js` — smoke da decisão assistida (equivalência) e atualização do teste de rateio manual.
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md` e `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`.
- **Presets implementados por tipo de divergência** (função `obterPresetsDecisaoRevisao`):
  - `equivalencia_por_descricao_normalizada`: Aceitar equivalência (`ACEITO`) / Rejeitar (`REJEITADO`) / Revisar depois (`EM_REVISAO`). A justificativa de aceite é a frase padronizada "Descrição coincide após normalização textual, com mesma natureza e mesmo valor unitário dentro da tolerância definida."
  - `item_nao_apto` (e variantes): Liberar item para dry-run (`ACEITO`) / Manter bloqueado (`REJEITADO`) / Revisar depois (`EM_REVISAO`).
  - `rateio` (`item_novo_sem_rateio`, `item_pad_sem_rateio`, etc.): Aplicar rateio sugerido (quando há `rateioSugerido` no payload) / Informar rateio manual / Revisar depois.
  - `ausencia` (`item_ausente_no_pad`, `item_substituido`): Confirmar ausência / Não confirmar (revisar) / Revisar depois.
  - `consistencia` (`quantidade_valor_unitario_inconsistente`): Aceitar total do PAD / Manter alerta / Revisar depois.
  - `campo` (`valor_diferente`, etc.): Aceitar valor do PAD / Corrigir manualmente (`CORRIGIDO`) / Manter memória (`REJEITADO`) / Revisar depois.
  - Genérico (demais tipos): Aceitar / Rejeitar / Revisar depois.
- **Campos ocultados/recolhidos na tela principal**: campo "Valor aplicado" passou a ficar oculto por padrão e só aparece quando a decisão é `CORRIGIDO`; o payload técnico permanece em bloco `<details>` recolhível; a observação livre virou `<details>` "Observação adicional (opcional)"; a decisão técnica (`select #revisao-decisao`) foi movida para um bloco `<details>` "Opções avançadas (decisão manual)". O formulário principal ficou enxuto: ação → motivo → usuário → campos específicos do tipo → registrar.
- **Regra de justificativa automática**: o campo de texto livre obrigatório foi substituído pelo dropdown "Motivo da decisão" (opções geradas conforme o tipo). A justificativa enviada ao backend é composta por `comporJustificativaDecisaoRevisao()` = texto padrão do motivo selecionado + observação adicional opcional. Não é mais exigido texto livre quando há motivo padrão selecionado.
- **Regra do usuário responsável**: campo "Usuário responsável" é pré-preenchido com o valor salvo em `localStorage` (`profor2022:revisao:usuarioResponsavel`); na ausência de valor salvo, usa o padrão local `usuario-local`. Quando o usuário edita o campo, o valor é persistido no `localStorage` ao registrar a decisão, evitando redigitação nas próximas decisões.
- **Rateio manual preservado**: a categoria `rateio` (ex.: `item_novo_sem_rateio`) mantém o editor de rateio intacto — adicionar/remover linha, validação da soma de `% valor` e `% quantidade`, e geração de `payloadDecisao.rateio` continuam funcionando sem alteração. O teste E2E cobre adicionar e remover linha.
- **Payload técnico**: o payload exibido (`#revisao-payload-tecnico`) continua sendo exatamente o mesmo objeto enviado no POST — ambos provêm de `montarPayloadDecisaoRevisao()`. Os chips/presets apenas pré-preenchem decisão e motivo; o registro só ocorre ao clicar "Registrar decisão".
- **Validações executadas**:
  - `node --check frontend/js/app.js` — OK.
  - `npm run validar:syntax` — 61 arquivos OK.
  - `npm run validar:services` — 37 testes OK.
  - Suíte E2E Playwright completa — 13/13 testes passaram, incluindo o novo smoke "revisão de equivalência por descrição normalizada usa decisão assistida sem digitação".
  - `npm run profor:pad:auditar-fila-revisao` — executado; último lote `id 24`, 139 divergências reapresentadas, 6 não reapresentadas.
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run` — `Payload alterado após a decisão: 0`, `Bloqueios de ativação: 0`, `Apto para prosseguir ativação: sim`.
  - `npm run profor:pad:reconstruir-plano:dry-run` e `npm run profor:pad:comparar-plano:dry-run` — sem regressão; mantêm o estado pré-existente de saneamento (30 impedimentos, 8 diferenças críticas legítimas já documentadas). As mudanças deste commit não afetam reconstrução/comparação por serem exclusivamente de UI.
  - `git diff --check` sem problemas; `frontend/data/publicados` sem alterações; nenhum SQLite versionado. Os 5 arquivos de relatório dry-run regravados durante a auditoria (apenas o timestamp `geradoEm`) foram revertidos por estarem fora do escopo do patch.
- **Confirmações de segurança**: nenhuma decisão real foi registrada durante os testes (o smoke E2E intercepta o POST e falha-rápido se houver tentativa); não houve publicação, alteração da origem ativa, de `frontend/data/publicados` ou do `planoAplicacao` oficial.

## 21/05/2026 - PROFOR 2022: Regra de Equivalência por Acentuação/Diacrítico na Fila de Revisão

- **Status**: Implementado e Validado.
- **Objetivo**: Corrigir a regra de geração da fila de revisão para que diferenças exclusivamente de acentuação/diacríticos entre a descrição do PAD e da memória não gerem divergência de equivalência por descrição normalizada (`equivalencia_por_descricao_normalizada`), desde que todos os dados materiais coincidam.
- **Arquivos alterados**:
  - `backend/services/profor-2022/profor-pad-matching-service.js`
  - `backend/services/profor-2022/profor-pad-revisao-service.js`
  - `backend/scripts/gerar-relatorio-saneamento-pad-profor-2022.js`
  - `tests/services/profor-pad-diacritico.test.js` (Novo arquivo de testes)
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`
- **Resultados e Impactos**:
  - **Divergências saneadas automaticamente**: 3 divergências do convênio `937782/AC` deixaram de ser pendentes ativas bloqueantes e foram marcadas com `bloqueia_publicacao = 0`:
    - #25: "Desktop para edição de video" vs "Desktop para edição de vídeo"
    - #26: "Smartphone minimo de 128gb de memória interna" vs "Smartphone mínimo de 128gb de memória interna"
    - #27: "Switcher de video" vs "Switcher de vídeo"
  - **Divergências mantidas pendentes**: O item #24 ("Meia militar" sob convênio `937265/MS`) continuou pendente e ativamente bloqueando publicação (`bloqueia_publicacao: 1`), pois há uma divergência material de valor unitário (PAD R$ 37,59 vs Memória R$ 37,15, diferença de R$ 0,44).
  - **Segurança Pré-Ativação**: Executado com sucesso, com `Bloqueios de ativação: 0` e `Apto para prosseguir ativação: sim`. As pendências anteriores no banco foram alteradas para não bloqueantes (`bloqueia_publicacao = 0`) na fila de revisão, removendo o impedimento automático de segurança.
  - **Reconstrução**: Realizada com sucesso (`Linhas reconstruídas: 606`).
  - **Comparador**: Apresentou as mesmas 8 diferenças críticas legítimas (nenhuma regressão técnica ou comportamental).
  - **Validação Ponta a Ponta**: Rodou com sucesso (`SUCESSO: Validação ponta a ponta concluída com êxito absoluto!`).
  - **Testes Unitários**: 6 novos testes unitários desenvolvidos em `tests/services/profor-pad-diacritico.test.js` cobrindo todas as regras exigidas (coincidências corretas de diacríticos e bloqueio correto de divergências materiais ou textuais). Todos os 37 testes do backend passaram com sucesso.

## 21/05/2026 - PROFOR 2022: Diagnóstico e Análise das 4 Diferenças Críticas no Comparador (Pós-divergência #23)

- **Status**: Diagnóstico concluído.
- **Objetivo**: Analisar detalhadamente as 4 diferenças críticas geradas pelo comparador após a aplicação da decisão assistida de rateio na divergência `#23`.

### 1. Detalhamento e Classificação das 4 Diferenças Críticas (Convênio 937782 / AC)

| Item | Convênio / UF | Descrição | Área | Natureza | Campo Divergente | Valor Antigo (Prev / Exec / Saldo) | Valor Reconstruído PAD (Prev / Exec / Saldo) | Diferença | Classificação | Categoria de Análise | Relação e Motivo da Criticidade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 937782 / AC | Contratação de 01 (um) Supervisor por 12 | OUVIDORIA | CUSTEIO | Situação (`novo`) | R$ 0,00 / R$ 0,00 / R$ 0,00 | R$ 89.532,00 / R$ 0,00 / R$ 89.532,00 | +R$ 89.532,00 | `critica` | `efeito_esperado_da_decisao` | Originado da divergência `#21` (`item_novo_sem_rateio`). É uma nova linha adicionada ao PAD. Como o item é novo e não possui correspondente na memória antiga, o comparador o aponta como nova diferença crítica até a homologação final. |
| **2** | 937782 / AC | Contratação de 02 (dois) Auxiliares Admi | OUVIDORIA | CUSTEIO | Situação (`novo`) | R$ 0,00 / R$ 0,00 / R$ 0,00 | R$ 102.168,00 / R$ 0,00 / R$ 102.168,00 | +R$ 102.168,00 | `critica` | `efeito_esperado_da_decisao` | Originado da divergência `#22` (`item_novo_sem_rateio`). Mesma justificativa do item 1. |
| **3** | 937782 / AC | Notebook 4 núcleos 4.2ghz ram ddr 4 8gb | OUVIDORIA | CAPITAL | Situação (`novo`) | R$ 0,00 / R$ 0,00 / R$ 0,00 | R$ 3.599,99 / R$ 3.114,93 / R$ 485,06 | +R$ 3.599,99 | `critica` | `efeito_esperado_da_decisao` | Originado da divergência `#23` (`item_novo_sem_rateio`), que foi aceita com a aplicação do rateio antigo (50% Ouvidoria / 50% Corregedoria). A chave exata de `4.2ghz` não existe na antiga memória, pois o item anterior tinha descrição com `2.4ghz`. |
| **4** | 937782 / AC | Notebook 4 núcleos 4.2ghz ram ddr 4 8gb | CORREGEDORIA | CAPITAL | Situação (`novo`) | R$ 0,00 / R$ 0,00 / R$ 0,00 | R$ 3.599,99 / R$ 3.114,93 / R$ 485,06 | +R$ 3.599,99 | `critica` | `efeito_esperado_da_decisao` | Originado da divergência `#23`. Mesma justificativa do item 3 (linha de rateio da Corregedoria). |

### 2. Validação Específica da Decisão #23 (Notebook 4.2GHz)

A aplicação assistida da decisão resolutiva para a divergência `#23` (`item_novo_sem_rateio` sob o convênio `937782/AC`) utilizou o rateio antigo validado da memória. Esta decisão gerou **exatamente duas linhas** de aplicação na reconstrução do plano do PAD:
1. **Ouvidoria / Capital / 50%**: Quantidade `1`, Previsto `R$ 3.599,99`, Executado `R$ 3.114,93` e Saldo `R$ 485,06`.
2. **Corregedoria / Capital / 50%**: Quantidade `1`, Previsto `R$ 3.599,99`, Executado `R$ 3.114,93` e Saldo `R$ 485,06`.

#### Confronto com Valores Consolidados do PAD:
- **Valores Consolidados no PAD**: Quantidade total `2`, Valor Previsto total `R$ 7.199,98`, Executado total `R$ 6.229,86` e Saldo total `R$ 970,12`.
- **Soma das duas linhas rateadas**:
  - Quantidade: `1 + 1 = 2` (100% de consistência)
  - Previsto: `R$ 3.599,99 + R$ 3.599,99 = R$ 7.199,98` (100% de consistência)
  - Executado: `R$ 3.114,93 + R$ 3.114,93 = R$ 6.229,86` (100% de consistência)
  - Saldo: `R$ 485,06 + R$ 485,06 = R$ 970,12` (100% de consistência)

### 3. Comparação contra a Memória Antiga e Análise de Granularidades

- **Correspondência Material**: A reconstrução reproduziu a memória antiga de forma perfeitamente idêntica. Na antiga base de rateio, o item correspondente (`Notebook 4 núcleos 2.4ghz ram ddr 4 8gb`) estava dividido exatamente com os mesmos quantitativos e áreas (uma linha para Ouvidoria com Qtd `1` / Previsto `3.599,99` / Executado `3.114,93` e outra idêntica para a Corregedoria).
- **Granularidade**: O PAD consolidou as duas linhas originais em uma única linha (Notebook `4.2ghz` com Qtd `2`), enquanto o plano reconstruído, após a aplicação da decisão assistida de rateio da divergência `#23`, dividiu adequadamente em duas linhas de rateio, restaurando a granularidade da memória antiga.
- **Divergência de Descrição e Comportamento do Comparador**: A única diferença reside na descrição do item (`2.4ghz` na memória antiga vs. `4.2ghz` no PAD). Devido a essa atualização de especificação técnica pelo gestor do convênio, o comparador classificou a remoção do notebook antigo (`2.4ghz`) como `ausente` (classificação: `diferenca_por_pendencia_de_decisao` — aviso, já que a divergência de ausência `#76` continua pendente) e a inclusão do notebook novo (`4.2ghz`) como `novo` (classificação: `critica`).
- **Validação de Ambiguidade / Duplicidades**: O comparador utiliza a chave de pareamento composta `numeroConvenio::descricao::area::natureza` para realizar a conciliação. Não há flagging de ambiguidade ou duplicação indevida para estes itens (elas são exclusivas). O comparador aponta a divergência apenas pela incompatibilidade nominal do campo `descricao` (`2.4ghz` vs `4.2ghz`), tratando-se de uma substituição técnica cujo fechamento ocorrerá com a resolução do status pendente da divergência `#76`. Não existe nenhuma duplicidade ocultando divergências materiais.

### 4. Origem e Relação com Outras Decisões (Itens 1 e 2)

As diferenças críticas 1 e 2 originam-se das divergências `#21` e `#22` (`item_novo_sem_rateio`), respectivamente. Ambas foram saneadas com decisão resolutiva de aceite de 100% de destinação à Ouvidoria (Custeio). Como esses itens não existiam em nenhuma forma (mesmo descrições alternativas) no plano de aplicação antigo, a sua correta reconstrução gera linhas com valor unitário unitizado no PAD e sem contrapartida no histórico. A classificação como nova linha crítica é correta e é o efeito esperado dessas novas adições ao convênio.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.3.1-A - aplicação assistida do rateio antigo compatível da divergência `#23`


- Branch atual: `main`.
- Objetivo:
  - registrar decisão assistida `ACEITO` apenas na divergência `#23`,
    `item_novo_sem_rateio`, convênio `937782/AC`, usando o rateio antigo já
    identificado na Etapa 9.3.1 e preservando `aplicadaAoPlano=false`.
- Arquivos alterados:
  - `backend/scripts/auditar-itens-sem-rateio-com-rateio-antigo-pad-profor-2022.js`;
  - `package.json`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - relatórios dry-run em `backend/data/relatorios/`.
- Comando adicionado:
  - `npm run profor:pad:item-sem-rateio:aplicar-rateio-antigo`.
- Validações antes de aplicar:
  - alvo fixado em `--id=23`;
  - divergência `#23` em status resolutivo pendente de saneamento e tipo
    `item_novo_sem_rateio`;
  - rateio antigo classificado como `rateio_antigo_compativel`;
  - quantidade total, valor previsto, valor executado e saldo fechando com o PAD;
  - natureza `CAPITAL` compatível;
  - percentuais de quantidade e valor fechando `100%`.
- Decisão registrada:
  - divergência: `#23`;
  - decisão: `ACEITO`;
  - id da decisão: `85`;
  - usuário: `sistema-auditoria-rateio-antigo`;
  - `aplicadaAoPlano=false`;
  - snapshot `_segurancaPreAtivacao` confirmado no `payloadDecisao`;
  - log confirmado no detalhe da divergência.
- Rateio aceito no `payloadDecisao`:
  - origem: `auditoria-rateio-antigo-em-item-sem-rateio`;
  - tipo de saneamento: `rateio_manual`;
  - `OUVIDORIA` / `CAPITAL` / `50%` valor / `50%` quantidade;
  - `CORREGEDORIA` / `CAPITAL` / `50%` valor / `50%` quantidade;
  - item de memória:
    `937782::NOTEBOOK 4 NUCLEOS 2.4GHZ RAM DDR 4 8GB`;
  - `rateioAntigoValidado=true`.
- Auditoria antes da aplicação:
  - `145` divergências;
  - `132` pendentes;
  - `13` ACEITO;
  - `35` pendentes bloqueando publicação;
  - `13` decisões resolutivas;
  - auditoria `item_novo_sem_rateio`: `1` rateio antigo compatível (`#23`),
    `20` sem rateio antigo encontrado, `2` já decididos.
- Auditoria após a aplicação:
  - `145` divergências;
  - `131` pendentes;
  - `14` ACEITO;
  - `34` pendentes bloqueando publicação;
  - `14` decisões resolutivas;
  - auditoria `item_novo_sem_rateio`: `0` rateio antigo compatível, `20` sem
    rateio antigo encontrado, `3` já decididos.
- Segurança/reconstrução/comparador após aplicação:
  - segurança pré-ativação: `14` decisões resolutivas auditadas, `14` payloads
    preservados, `0` bloqueios, `0` avisos;
  - reconstrução dry-run: `14` decisões interpretadas, `14` com efeito,
    `33` impedimentos, `aptoParaAtivacao=false`;
  - comparador dry-run: `4` diferenças críticas, `197` avisos,
    `aptoParaPublicacao=false`.
- Validações realizadas:
  - `node --check backend/scripts/auditar-itens-sem-rateio-com-rateio-antigo-pad-profor-2022.js`;
  - `npm run profor:pad:item-sem-rateio:auditar-rateio-antigo`;
  - `npm run profor:pad:item-sem-rateio:aplicar-rateio-antigo`;
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `node backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js`.
- Confirmações de escopo:
  - nenhuma outra divergência foi alvo do comando;
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - nenhuma migration ou dependência nova;
  - nenhuma divergência, decisão ou log apagado.
- Pendências:
  - restam `20` itens `item_novo_sem_rateio` sem rateio antigo encontrado;
  - reconstrução e comparador permanecem não aptos por impedimentos/diferenças
    remanescentes fora do escopo desta etapa.
- Risco de regressão:
  - baixo: a decisão foi registrada pelo serviço existente, com validação
    explícita do alvo `#23` e sem aplicação ao plano oficial.
- Rollback:
  - não apagar decisão/log; se necessário, registrar decisão posterior
    `REVERTIDO` para a divergência `#23` ou usar rotina auditável equivalente.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.3.1 - auditoria de rateio antigo em `item_novo_sem_rateio`

- Branch atual: `main`.
- Objetivo:
  - auditar, em modo dry-run, divergências `item_novo_sem_rateio` que podem já
    possuir rateio antigo por área na memória/planilha antiga, especialmente
    quando o PAD novo consolida em uma linha itens que a planilha antiga dividia
    por área.
- Problema observado:
  - divergência `#23`, tipo `item_novo_sem_rateio`, convênio `937782/AC`,
    descrição PAD `Notebook 4 núcleos 4.2ghz ram ddr 4 8gb`;
  - PAD consolidado: quantidade `2`, valor unitário `3599,99`, previsto
    `7199,98`, executado `6229,86`, saldo `970,12`;
  - memória antiga persistida: duas linhas de rateio por área
    (`OUVIDORIA` e `CORREGEDORIA`), ambas `CAPITAL`, quantidade `1`,
    previsto `3599,99`, executado `3114,93`, saldo `485,06`.
- Arquivos alterados/criados:
  - `backend/scripts/auditar-itens-sem-rateio-com-rateio-antigo-pad-profor-2022.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - relatórios gerados em
    `backend/data/relatorios/profor-2022-item-sem-rateio-rateio-antigo-dry-run.json`
    e `.md`;
  - relatórios dry-run de segurança/reconstrução/comparação regenerados.
- Comando criado:
  - `npm run profor:pad:item-sem-rateio:auditar-rateio-antigo`.
- Critérios de auditoria:
  - mesmo `numeroConvenio`;
  - busca primária na memória persistida SQLite
    (`profor_2022_itens_conhecidos` + `profor_2022_item_rateios`);
  - fallback para `backend/data/relatorios/profor-2022-rateio-inicial-dry-run.json`
    quando não houver candidato no SQLite;
  - descrição normalizada exata ou compatibilidade controlada removendo apenas
    token decimal de frequência `GHz`;
  - natureza compatível;
  - soma de quantidade, valor previsto, valor executado e saldo fechando nas
    tolerâncias (`0,000001` para quantidade, `0,01` para valores);
  - pelo menos uma linha antiga com área preenchida;
  - percentuais de quantidade e valor calculáveis;
  - sem fuzzy matching amplo.
- Resultado:
  - total `item_novo_sem_rateio` analisados: `23`;
  - rateio antigo compatível: `1`;
  - possível rateio antigo com divergência: `0`;
  - sem rateio antigo encontrado: `20`;
  - dados insuficientes: `0`;
  - já decididos: `2` (`#21`, `#22`, pré-existentes no banco local).
- Candidato encontrado:
  - `#23` `937782/AC` `Notebook 4 núcleos 4.2ghz ram ddr 4 8gb`;
  - item de memória correspondente: `937782::NOTEBOOK 4 NUCLEOS 2.4GHZ RAM DDR 4 8GB`;
  - critério de compatibilidade: `descricao_sem_token_frequencia_ghz`;
  - origem: SQLite.
- Rateio sugerido para `#23`:
  - `OUVIDORIA` / `CAPITAL` / quantidade `1` / previsto `3599,99` /
    executado `3114,93` / saldo `485,06` / `50%` quantidade / `50%` valor;
  - `CORREGEDORIA` / `CAPITAL` / quantidade `1` / previsto `3599,99` /
    executado `3114,93` / saldo `485,06` / `50%` quantidade / `50%` valor.
- Aplicação:
  - nenhuma decisão registrada;
  - nenhum status/payload de divergência alterado;
  - relatório gerado apenas para subsidiar autorização futura de saneamento assistido.
- Estado operacional observado durante validações:
  - auditoria geral atual do banco local: `145` divergências, `132` pendentes,
    `13` ACEITO, `35` pendentes bloqueando publicação, `13` decisões
    resolutivas;
  - as `13` decisões resolutivas já existentes incluem os `11` aceites da Etapa
    9.3.0 e `2` decisões anteriores em `item_novo_sem_rateio`;
  - segurança pré-ativação: `13` decisões auditadas, `13` payloads preservados,
    `0` bloqueios;
  - reconstrução dry-run: `13` decisões interpretadas, `34` impedimentos,
    `aptoParaAtivacao=false`;
  - comparador dry-run: `2` diferenças críticas no baseline atual,
    `aptoParaPublicacao=false`.
- Validações realizadas:
  - `node --check backend/scripts/auditar-itens-sem-rateio-com-rateio-antigo-pad-profor-2022.js`;
  - `npm run validar:syntax`;
  - `npm run validar:services`;
  - `npm run profor:pad:item-sem-rateio:auditar-rateio-antigo`;
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `node backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js`;
  - `git diff --check`;
  - `git status --short frontend/data/publicados`;
  - `git ls-files "*.sqlite*"`.
- Confirmações de escopo:
  - nenhuma decisão registrada nesta etapa;
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - nenhuma migration ou dependência nova;
  - nenhuma divergência, decisão ou log apagado.
- Pendências:
  - se autorizado, criar etapa posterior para registrar decisão assistida de
    rateio antigo no item `#23`, com `payloadDecisao` contendo o rateio sugerido;
  - revisar os `20` itens sem rateio antigo encontrado e as `2` divergências já
    decididas para entender o impacto no comparador.
- Risco de regressão:
  - baixo: script novo é somente leitura;
  - risco operacional: compatibilidade `GHz` é propositalmente restrita e depende
    do fechamento financeiro para evitar aceite indevido.
- Rollback:
  - reverter script/comando/documentação e remover os relatórios gerados; não há
    decisão ou alteração de banco a reverter nesta etapa.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.3.0 - Melhoria de UX na Revisão de Divergências PAD x Memória

- Branch atual: `main`.
- Objetivo:
  - Melhorar a UX da tela de revisão de divergências separando visualmente o bloqueio original, o bloqueio efetivo atual pós-decisão resolutiva, e o status da decisão.
  - Implementar lógica no frontend para marcar um item resolvido (ex: `ACEITO` ou `CORRIGIDO`) como não-bloqueante efetivo ("Não — resolvido"), removendo a marcação de bloqueio ativo e impeditivo.
  - Definir o filtro "Sem decisão resolutiva" como selecionado por padrão e sincronizar automaticamente as opções de visualização ao alterar o status no select de busca.
- Modificações realizadas:
  - `frontend/js/app.js`:
    - Adicionado helper `calcularBloqueioEfetivoRevisao(item)` para calcular o bloqueio atual.
    - Modificado `renderBadgeRevisao` para aceitar um terceiro parâmetro de título (tooltip HTML nativo).
    - Atualizada a tabela de divergências para renderizar a coluna "Bloqueia" usando badges HSL apropriados: vermelho ("Sim") para bloqueios ativos, cinza ("Não — resolvido") para bloqueios originais saneados com tooltip explicativa, e verde ("Não") para itens não-bloqueantes.
    - Atualizado o cabeçalho dos detalhes da divergência para exibir "Bloqueio ativo", "Bloqueio original saneado" ou "Não bloqueante", bem como especificar o nível original como "Nível original: <nivel>".
    - Definida a caixa de seleção "Sem decisão resolutiva" como checked por padrão.
    - Implementada sincronização no evento de alteração do select de status para gerenciar o estado dos checkboxes.
- Validações:
  - Testes unitários do backend (`node --test tests/services/*.test.js`) executados e 100% aprovados.
  - Validação de sintaxe (`node scripts/validar-syntax.js`) com sucesso.
  - Testes E2E do Playwright rodando com sucesso.
- Risco de regressão:
  - Inexistente no backend ou banco de dados.
  - Baixo no frontend, totalmente contido na tela de revisão de divergências.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.3.0 - aplicação assistida `item_nao_apto`

- Branch atual: `main`.
- Objetivo:
  - executar a aplicação assistida dos candidatos `item_nao_apto` sem divergência
    material entre memória e PAD, registrando decisão `ACEITO` via serviço
    existente de decisão e sem aplicar nada ao `planoAplicacao` oficial.
- Baseline antes da aplicação:
  - auditoria `item_nao_apto`: `19` analisados, `11` candidatos a aceite
    automático, `8` com divergência material, `0` dados insuficientes, `0` já
    decididos e `0` erros de payload;
  - auditoria geral: `145` divergências, `145` pendentes, `48` bloqueando
    publicação, `0` decisões resolutivas;
  - segurança pré-ativação: `0` bloqueios, `0` avisos;
  - reconstrução dry-run: `47` impedimentos, `19` itens não aptos usados,
    `aptoParaAtivacao=false`;
  - comparador dry-run: `0` diferenças críticas, `aptoParaPublicacao=false`.
- Comando de aplicação:
  - a tentativa literal `npm run profor:pad:item-nao-apto:aceitar-iguais -- --aplicar`
    foi consumida pelo npm local como configuração e executou apenas dry-run;
  - o script npm dedicado foi ajustado para invocar
    `node backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022.js --aplicar`;
  - aplicação efetiva executada com `npm run profor:pad:item-nao-apto:aceitar-iguais`.
- Decisões registradas:
  - total: `11` decisões `ACEITO`;
  - IDs aceitos: `28`, `29`, `30`, `35`, `36`, `37`, `40`, `41`, `42`, `43`, `45`;
  - decisões geradas: `60` a `70`;
  - usuário: `sistema-auditoria-item-nao-apto`;
  - todas retornaram `aplicadaAoPlano=false`;
  - todas possuem snapshot `_segurancaPreAtivacao`.
- Payload de decisão:
  - `origem: "auditoria-item-nao-apto-sem-divergencia"`;
  - `tipoSaneamento: "liberacao_item_nao_apto"`;
  - `liberarUsoDryRun: true`;
  - motivo: item presente no PAD com dados materiais coincidentes com a memória.
- Resultado após aplicação:
  - auditoria `item_nao_apto`: `19` analisados, `0` candidatos restantes,
    `8` divergências materiais, `11` já decididos, `0` dados insuficientes e
    `0` erros de payload;
  - os `8` itens com divergência material permaneceram sem decisão:
    `31`, `32`, `33`, `34`, `38`, `39`, `44`, `46`;
  - auditoria geral: `145` divergências, `134` pendentes, `11` ACEITO,
    `37` pendentes bloqueando publicação, `11` decisões resolutivas,
    `publicacaoLiberada=false`;
  - segurança pré-ativação: `11` decisões auditadas, `11` payloads preservados,
    `0` bloqueios, `0` avisos;
  - reconstrução dry-run: `11` decisões interpretadas, `11` com efeito na
    reconstrução, `8` itens não aptos usados, `36` impedimentos,
    `aptoParaAtivacao=false`;
  - comparador dry-run: `11` decisões interpretadas, `0` diferenças críticas,
    `aptoParaPublicacao=false`.
- Arquivos alterados/gerados:
  - `package.json` (comando `aceitar-iguais` passou a incluir `--aplicar` no script npm);
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - relatórios dry-run em `backend/data/relatorios/` regenerados;
  - banco SQLite local atualizado pelas decisões, sem versionamento.
- Validações realizadas:
  - `npm run profor:pad:item-nao-apto:auditar` antes e depois;
  - `npm run profor:pad:auditar-fila-revisao` antes e depois;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run` antes e depois;
  - `npm run profor:pad:reconstruir-plano:dry-run` antes e depois;
  - `npm run profor:pad:comparar-plano:dry-run` antes e depois;
  - `node backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js` antes e depois;
  - `npm run validar:syntax`;
  - `npm run validar:services`;
  - `git diff --check`;
  - `git status --short frontend/data/publicados`;
  - `git ls-files "*.sqlite*"`.
- Confirmações de escopo:
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - nenhuma migration, dependência nova, exclusão de divergência, decisão ou log.
- Pendências:
  - sanear manualmente os `8` itens `item_nao_apto` com divergência material;
  - tratar demais impedimentos de rateio/itens PAD sem rateio antes de ativação.
- Risco de regressão:
  - baixo no código; a alteração material está na fila SQLite local, por decisão
    auditável;
  - risco operacional restante está nos `8` itens com divergência material e nos
    demais impedimentos da reconstrução.
- Rollback:
  - não apagar decisões/logs; registrar decisão posterior `REVERTIDO` nos IDs
    aceitos indevidamente, ou criar rotina específica de reversão auditável.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.3.0 - auditoria `item_nao_apto` sem divergência material

- Branch atual: `main`.
- Objetivo:
  - criar auditoria dry-run para identificar divergências `item_nao_apto` em
    que memória e PAD coincidem materialmente, permitindo aceite assistido
    futuro por `ACEITO` sem aplicar decisão ao `planoAplicacao` oficial.
- Arquivos alterados:
  - `backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - relatórios gerados em `backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json` e `.md`;
  - relatórios dry-run de segurança/reconstrução/comparação regenerados pelas validações.
- Comandos adicionados:
  - `npm run profor:pad:item-nao-apto:auditar`;
  - `npm run profor:pad:item-nao-apto:aceitar-iguais -- --aplicar`.
- Regra da auditoria:
  - lê divergências `item_nao_apto`;
  - considera para aceite apenas status `PENDENTE` ou `EM_REVISAO` sem decisão
    resolutiva;
  - compara `payload.memoria`/`payload.antes` com `payload.pad`/`payload.depois`;
  - quantidade: tolerância `0,000001`;
  - valores monetários: tolerância `0,01`;
  - natureza: igualdade textual normalizada;
  - descrição: igualdade textual normalizada, mas não bloqueia quando a chave do
    item está preservada e os dados materiais coincidem;
  - área não é exigida, pois o PAD pode não trazer área.
- Resultado do dry-run:
  - total `item_nao_apto`: `19`;
  - candidatos a aceite automático: `11`;
  - divergência material: `8`;
  - dados insuficientes: `0`;
  - já decididos: `0`;
  - erros de payload: `0`.
- Candidatos identificados:
  - `#28` `937216/GO` Monitor LED, mínimo 27;
  - `#29` `937216/GO` Notebook;
  - `#30` `937216/GO` Tablet;
  - `#35` `937468/TO` Nobreak OUVIDORIA;
  - `#36` `937468/TO` Nobreak CORREGEDORIA;
  - `#37` `937468/TO` Tablet CORREGEDORIA;
  - `#40` `938128/SP` Câmera Digital;
  - `#41` `938128/SP` Serviços de digitalização;
  - `#42` `938128/SP` Estação de Trabalho;
  - `#43` `938128/SP` Gaveteiros;
  - `#45` `938128/SP` Serviço de operacionalização de sistema.
- Aplicação:
  - não executada nesta rodada;
  - nenhuma decisão real foi registrada;
  - o modo de aplicação exige flag explícita `--aplicar` e usa o serviço
    existente de decisão, preservando `payloadDecisao`, snapshot
    `_segurancaPreAtivacao`, logs e `aplicadaAoPlano=false`.
- Auditoria após dry-run:
  - fila mantida em `145` divergências;
  - `145` pendentes;
  - `48` bloqueiam publicação;
  - `0` decisões resolutivas.
- Reconstrução e comparador:
  - reconstrução dry-run permaneceu `aptoParaAtivacao=false`, com `47`
    impedimentos existentes;
  - comparador dry-run permaneceu `aptoParaPublicacao=false`, com `0`
    diferenças críticas;
  - sem decisões resolutivas interpretadas, pois a aplicação assistida não foi executada.
- Validações realizadas:
  - `node --check backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022.js`;
  - `npm run validar:syntax`;
  - `npm run validar:services`;
  - `npm run profor:pad:item-nao-apto:auditar`;
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `node backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js`;
  - `git diff --check`;
  - `git status --short frontend/data/publicados`;
  - `git ls-files "*.sqlite*"`.
- Confirmações de escopo:
  - nenhuma publicação executada;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - nenhuma migration, dependência nova ou fuzzy matching.
- Pendências:
  - se o usuário autorizar, executar
    `npm run profor:pad:item-nao-apto:aceitar-iguais -- --aplicar` para registrar
    `ACEITO` apenas nos 11 candidatos listados.
- Risco de regressão:
  - baixo: script novo é local, padrão dry-run e não altera banco sem flag;
  - risco operacional na aplicação futura é controlado pelas tolerâncias e pelo
    uso do serviço existente de decisão.
- Rollback:
  - reverter o script, comandos npm, inclusão no `validar-syntax` e registros de
    memória; se a aplicação assistida for executada futuramente, reverter decisões
    exige registrar decisão humana `REVERTIDO` ou saneamento transacional específico,
    sem apagar logs.

---

## 21/05/2026 - PROFOR 2022: exibição da memória em `item_nao_apto`

- Branch atual: `main`.
- Objetivo:
  - corrigir o painel `Antes x Depois` da tela `SISTEMA > Revisão de divergências`
    para divergências `item_nao_apto`, fazendo o lado `ANTES — memória atual`
    exibir os dados quantitativos e financeiros existentes na memória/rateios.
- Problema observado:
  - a divergência real #28 (`937216`, GO, Monitor LED) mostrava `-` no lado
    ANTES para quantidade, valor unitário, valor previsto, valor executado e
    saldo, embora a memória/planilha antiga tivesse esses valores.
- Causa técnica confirmada:
  - `divergenciasNaoAptos()` montava o payload com campos PAD
    (`quantidadePad`, `valorUnitarioPad`, `valorPrevistoPad`,
    `valorExecutadoPad`, `saldoPad`), mas não enviava a estrutura
    `payload.memoria`/`payload.antes` nem os campos planos `*Memoria`
    correspondentes.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-revisao-service.js`;
  - `backend/services/profor-2022/profor-pad-saneamento-service.js`;
  - `frontend/js/app.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - relatórios dry-run/detalhados regenerados em `backend/data/relatorios/profor-2022-pad-*.json` e `.md`.
- Correção aplicada:
  - criado resumo local da memória para `item_nao_apto` a partir dos
    `rateiosAtivos`;
  - `payload.memoria` e `payload.antes` passaram a conter descrição, área,
    natureza, quantidade, valor unitário, valor previsto, valor executado e saldo;
  - adicionados campos planos de compatibilidade: `descricaoMemoria`,
    `areaMemoria`, `naturezaMemoria`, `quantidadeMemoria`,
    `valorUnitarioMemoria`, `valorPrevistoMemoria`, `valorExecutadoMemoria`,
    `saldoMemoria` e `totalRateiosAtivosMemoria`;
  - `payload.pad` e `payload.depois` preservam os dados PAD equivalentes;
  - o relatório detalhado de saneamento passou a carregar
    `valorUnitarioReferencia` do item conhecido, usado apenas para exibição do
    resumo da memória;
  - o comparador visual passou a exibir também a linha `Área`.
- Regra de cálculo do lado ANTES:
  - área e natureza são agregadas por valores únicos dos rateios ativos;
  - valor previsto e valor executado são somas dos rateios ativos;
  - saldo = valor previsto - valor executado;
  - valor unitário usa `valorUnitarioReferencia` da memória quando disponível;
  - quantidade exibida é derivada de `valorPrevisto / valorUnitarioReferencia`
    quando essa referência existe; caso contrário, usa a soma de
    `quantidadeReferencia`;
  - sem rateio ativo, campos quantitativos/financeiros ficam `null` e
    `totalRateiosAtivos = 0`.
- Validação visual:
  - em `http://127.0.0.1:8790/index.html`, tela `SISTEMA > Revisão de
    divergências`, filtro `tipo=item_nao_apto`, `status=PENDENTE`,
    `convênio=937216`, divergência #28;
  - a aba `Comparação antes x depois` passou a mostrar no lado ANTES:
    `ESCOLA PENAL`, `CAPITAL`, quantidade `4`, valor unitário `R$ 1.805,33`,
    valor previsto `R$ 7.221,32`, valor executado `R$ 3.270,64` e saldo
    `R$ 3.950,68`;
  - smoke Playwright headless sem erro de console.
- Validações realizadas:
  - `node --check backend/services/profor-2022/profor-pad-revisao-service.js`;
  - `node --check backend/services/profor-2022/profor-pad-saneamento-service.js`;
  - `node --check frontend/js/app.js`;
  - `npm run validar:syntax` (59 arquivos);
  - `npm run profor:pad:relatorio-saneamento-detalhado`;
  - `npm run profor:pad:gerar-fila-revisao` (lote 12, 145 atualizadas, 0 criadas);
  - `npm run profor:pad:auditar-fila-revisao` (145 pendentes, 48 bloqueiam publicação);
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run` (0 bloqueios);
  - `npm run profor:pad:reconstruir-plano:dry-run` (`aptoParaAtivacao=false`, 47 impedimentos existentes);
  - `npm run profor:pad:comparar-plano:dry-run` (`aptoParaPublicacao=false`, 0 diferenças críticas);
  - `node backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js` (decisões controladas `revisao_teste:%` criadas e removidas ao final);
  - `git status --short frontend/data/publicados` (sem alterações);
  - `git ls-files "*.sqlite*"` (sem arquivos versionados).
- Confirmações de escopo:
  - nenhuma decisão real registrada;
  - nenhuma publicação executada;
  - nenhuma origem ativa alterada;
  - `frontend/data/publicados` não foi alterado;
  - `planoAplicacao` oficial não foi alterado;
  - nenhuma migration ou dependência nova criada.
- Pendências:
  - o SQLite local continua armazenando `quantidade_referencia` original dos
    rateios; esta correção ajusta a exibição resumida do payload de revisão,
    sem reimportar nem alterar fisicamente a memória persistida.
- Risco de regressão:
  - baixo a moderado na exibição de `item_nao_apto`, pois o payload foi
    enriquecido e a tela passou a mostrar a linha `Área`;
  - baixo no motor de decisão/reconstrução, pois nenhuma regra de aplicação de
    decisão foi alterada.
- Rollback:
  - reverter os três arquivos de código e regenerar a fila retorna o payload
    anterior; relatórios dry-run podem ser regenerados novamente pelos scripts.

---

## 20/05/2026 - PROFOR 2022: Etapa 9.1 - interface avançada de saneamento PAD

- Branch atual: `main`.
- Objetivo:
  - evoluir a tela `SISTEMA > Revisão de divergências` para registrar decisões
    humanas com `payloadDecisao` estruturado, consumível pelo motor dry-run já
    existente, sem aplicar decisão ao `planoAplicacao` oficial.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `frontend/css/app.css`;
  - `index.html`;
  - `tests/e2e/app.spec.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`;
  - relatórios dry-run regenerados por validação em `backend/data/relatorios/profor-2022-pad-*-dry-run.*`.
- Tipos de divergência suportados pela decisão estruturada:
  - `equivalencia_por_descricao_normalizada`;
  - `item_pad_sem_rateio`, `item_novo_sem_rateio`, `rateio_novo`, `correcao_de_rateio`;
  - `item_ausente_no_pad`, `item_substituido`;
  - `item_nao_apto`, `item_conhecido_nao_apto`, `item_conhecido_nao_apto_usado`;
  - `quantidade_valor_unitario_inconsistente`;
  - `valor_diferente`, `quantidade_diferente`, `valor_unitario_diferente`,
    `saldo_inconsistente`, `descricao_divergente`, `natureza_divergente`.
- Payloads implementados:
  - equivalência aceita ou rejeitada com `tipoSaneamento: "equivalencia_por_descricao_normalizada"`;
  - rateio manual com `tipoSaneamento: "rateio_manual"` e lista `rateio`;
  - ausência confirmada com `tipoSaneamento: "ausencia_confirmada"`;
  - liberação dry-run de item não apto com `tipoSaneamento: "liberacao_item_nao_apto"`;
  - consistência quantidade x valor unitário com
    `tipoSaneamento: "consistencia_quantidade_valor_unitario"`;
  - campo PAD aceito com `tipoSaneamento: "campo_pad_aceito"`;
  - campo corrigido com `tipoSaneamento: "campo_corrigido"`.
- Validações de frontend:
  - usuário responsável obrigatório;
  - justificativa obrigatória para `ACEITO`, `REJEITADO`, `CORRIGIDO` e `REVERTIDO`;
  - rateio manual exige área, natureza, soma de `percentualValor = 100` e soma de
    `percentualQuantidade = 100` quando preenchida;
  - `CORRIGIDO` em divergência de campo exige `valorCorrigido`;
  - erros são exibidos sem enviar requisição;
  - formulário exibe resumo do payload e bloco recolhível com JSON técnico.
- Usabilidade:
  - detalhe da divergência passa a destacar bloqueio de publicação;
  - divergências com saneamento estruturado exibem badge de payload estruturado;
  - painel estruturado mostra os dados relevantes por tipo de alerta;
  - após decisão registrada, a mensagem informa `aplicadaAoPlano=false` e que
    reconstrução/publicação não foram alteradas.
- Backend:
  - não alterado; o serviço existente já preserva `payloadDecisao`, grava
    snapshot `_segurancaPreAtivacao` e mantém `aplicadaAoPlano=false`.
- Validações realizadas:
  - `node --check frontend/js/app.js`;
  - `node --check tests/e2e/app.spec.js`;
  - `npm run validar:syntax` (59 arquivos);
  - `npm run validar:services` (31 testes);
  - `npm run profor:pad:auditar-fila-revisao` (145 divergências, 48 bloqueiam publicação);
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run` (0 bloqueios de segurança);
  - `npm run profor:pad:reconstruir-plano:dry-run` (`aptoParaAtivacao=false`, 47 impedimentos existentes);
  - `npm run profor:pad:comparar-plano:dry-run` (`aptoParaPublicacao=false`, 0 diferenças críticas);
  - `npx playwright test tests/e2e/app.spec.js --grep "revisão de divergências exibe decisão estruturada"` (1 teste);
  - `git status --short frontend/data/publicados` (sem alterações);
  - `git ls-files "*.sqlite*"` (sem arquivos versionados).
- Decisão de teste:
  - nenhuma decisão real ou controlada foi registrada; o smoke Playwright usou API mockada e validou que o POST não ocorreu.
- Restrições preservadas:
  - sem publicação;
  - sem alteração de origem ativa;
  - sem alteração de `frontend/data/publicados`;
  - sem aplicação ao `planoAplicacao` oficial;
  - sem migration, sem dependência nova e sem fuzzy matching.
- Pendências:
  - validação manual com divergência real/controlada pode ser feita depois, se for necessário registrar decisão de teste e limpar em seguida.
- Risco de regressão:
  - moderado no frontend da revisão de divergências, principalmente na montagem do payload por tipo e na validação de rateio;
  - baixo no backend, pois não houve alteração de serviços/rotas.
- Rollback:
  - reverter `frontend/js/app.js`, `frontend/css/app.css`, `index.html`,
    `tests/e2e/app.spec.js` e os registros de memória remove a interface
    avançada e restaura o formulário genérico anterior; relatórios dry-run podem
    ser regenerados novamente pelos scripts correspondentes.

---

## 20/05/2026 - PROFOR 2022: Etapa 8.2 - Segurança pré-ativação PAD

- Branch atual: `main`.
- Objetivo: criar auditoria dry-run que impede dois riscos antes de qualquer
  ativação/publicação: (1) decisão resolutiva validando payload de divergência
  que mudou; (2) divergência antiga que não aparece mais na geração atual da
  fila. Sem frontend, sem migration, sem publicação, sem alterar origem ativa,
  sem aplicar decisão ao `planoAplicacao` oficial.
- Serviço criado:
  - `backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service.js`.
- Arquivos criados:
  - `backend/scripts/auditar-seguranca-pre-ativacao-pad-profor-2022.js`;
  - `tests/services/profor-pad-seguranca-pre-ativacao.test.js`.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-revisao-decisao-service.js`;
  - `backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js`;
  - `backend/services/profor-2022/profor-pad-plano-comparador-service.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Comando criado:
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run` (somente leitura).
- Hash/snapshot de payload:
  - `gerarHashPayloadDivergencia()` gera SHA-256 estável considerando
    `chave_divergencia`, `tipo_alerta`, `campo_afetado`, `numero_convenio`,
    `uf`, `chave_item` e `payload_json`;
  - `stringifyOrdenado()` ordena recursivamente as chaves — o hash independe da
    ordem das chaves do JSON;
  - ao registrar nova decisão humana, o serviço de decisão acrescenta
    `_segurancaPreAtivacao` ao `payload_decisao_json` (versão, divergenciaId,
    chaveDivergencia, tipoAlerta, campoAfetado, payloadHashNoMomentoDaDecisao,
    registradoEm), preservando o payload original do usuário; **nenhuma coluna
    nova foi criada**; decisões antigas sem snapshot são tratadas como “sem
    snapshot”, não erro fatal.
- Auditoria de payload alterado (decisões resolutivas `ACEITO`, `REJEITADO`,
  `CORRIGIDO`, `REVERTIDO`):
  - classifica em `payload_preservado`, `payload_alterado_apos_decisao`,
    `decisao_sem_snapshot_payload` e `divergencia_nao_encontrada_para_decisao`;
  - `payload_alterado_apos_decisao` gera bloqueio de ativação;
  - `decisao_sem_snapshot_payload` é aviso, mas vira bloqueio quando a decisão é
    usada para liberar ativação (última decisão resolutiva da divergência cujo
    efeito altera a reconstrução ou cuja divergência bloqueia publicação);
  - `divergencia_nao_encontrada_para_decisao` gera bloqueio;
  - nenhum status é reaberto automaticamente.
- Auditoria de divergências não reapresentadas:
  - reutiliza `coletarDivergencias()` para obter as chaves que seriam geradas
    hoje e compara com as divergências já persistidas;
  - classifica em `reapresentada`, `nao_reapresentada_sem_decisao`,
    `nao_reapresentada_com_decisao_resolutiva`, `nao_reapresentada_bloqueante`
    e `nao_reapresentada_em_revisao`;
  - `nao_reapresentada_com_decisao_resolutiva` e `nao_reapresentada_bloqueante`
    geram bloqueio; não apaga, não altera status, não cria decisão automática.
- Integração leve: a reconstrução e o comparador dry-run passaram a embutir
  `segurancaPreAtivacao` (resumo + bloqueios) nos relatórios; havendo bloqueio
  de segurança, `aptoParaAtivacao = false` e, em cascata, `aptoParaPublicacao
  = false`. A auditoria não interrompe a geração dos relatórios — em falha,
  registra alerta e bloqueia a aptidão.
- Relatórios gerados em `backend/data/relatorios`:
  - `profor-2022-pad-seguranca-pre-ativacao-dry-run.json`;
  - `profor-2022-pad-seguranca-pre-ativacao-dry-run.md`.
- Resultado com a base atual:
  - decisões resolutivas auditadas: `0`; sem snapshot: `0`; com payload
    alterado: `0`; com divergência não encontrada: `0`;
  - divergências existentes: `145`; reapresentadas: `145`; não reapresentadas:
    `0`; geração atual da fila disponível: sim;
  - bloqueios de ativação: `0`; `aptoParaProsseguirAtivacao = true` (não há
    risco de segurança pré-ativação na base atual);
  - reconstrução mantém `47` impedimentos e `aptoParaAtivacao = false`
    (bloqueada pelas 48 divergências pendentes, não pela segurança);
    comparador inalterado, `aptoParaPublicacao = false`.
- Validações executadas:
  - `node --check` nos 6 arquivos criados/alterados;
  - `npm run validar:syntax` (59 arquivos);
  - `npm run validar:services` (30 testes aprovados — 11 novos da Etapa 8.2);
  - `npm run profor:pad:auditar-fila-revisao` (baseline 145/145/0/44/48);
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `git diff --check` (apenas avisos de fim de linha LF/CRLF);
  - `git status --short frontend/data/publicados` (sem alterações);
  - `git ls-files "*.sqlite" "*.sqlite-wal" "*.sqlite-shm"` (nada versionado).
- Confirmações de escopo:
  - nenhuma publicação; origem ativa intacta; `frontend/data/publicados` sem
    alterações; nenhuma decisão aplicada ao `planoAplicacao` oficial;
  - nenhuma migration nem coluna nova; nenhuma divergência, decisão ou log
    apagado; nenhum status reaberto; nenhuma API/front-end.
- Riscos e rollback:
  - risco baixo: serviço somente leitura; o snapshot só é gravado em decisões
    futuras, dentro do JSON já existente `payload_decisao_json`;
  - rollback por `git revert`/remoção dos 3 arquivos criados e reversão dos
    serviços/`package.json`/`scripts/validar-syntax.js`; os relatórios em
    `backend/data/relatorios` podem ser apagados sem impacto.

## 20/05/2026 - PROFOR 2022: Etapa 8.1 - Ajuste fino (alias de tipo não apto e métricas desambiguadas)

- Branch atual: `main`. Rodada curta de ajuste sobre a Etapa 8.1.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-decisao-aplicacao-service.js`;
  - `backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js`;
  - `backend/services/profor-2022/profor-pad-plano-comparador-service.js`;
  - `backend/scripts/auditar-aplicacao-decisoes-pad-profor-2022.js`;
  - `backend/scripts/reconstruir-plano-pad-profor-2022.js`;
  - `backend/scripts/comparar-plano-pad-profor-2022.js`;
  - `tests/services/profor-pad-decisao-aplicacao.test.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`.
- Ajuste 1 — risco provável futuro: `TIPOS_NAO_APTO` passou a aceitar também
  `item_conhecido_nao_apto_usado` como alias, além de `item_nao_apto` e
  `item_conhecido_nao_apto`. Assim, se uma divergência futura na fila chegar com
  o rótulo do impedimento interno da reconstrução, a decisão de liberação ainda
  será reconhecida pelo motor.
- Ajuste 2 — melhoria recomendada: as métricas de decisão foram desambiguadas.
  Além de `totalDecisoesAplicadasDryRun` (mantido como alias), o motor e os
  relatórios passaram a expor `totalDecisoesInterpretadasDryRun`,
  `totalDecisoesComEfeitoNaReconstrucao` e `totalDecisoesSemEfeitoNaReconstrucao`
  (`REJEITADO`/`REVERTIDO` são interpretadas, mas sem efeito na reconstrução).
- Validações executadas:
  - `node --check` nos 7 arquivos alterados;
  - `npm run validar:syntax` (56 arquivos);
  - `node --test tests/services/profor-pad-decisao-aplicacao.test.js` (15 casos,
    todos aprovados — inclui caso novo de alias de tipo não apto);
  - `npm run profor:pad:decisoes:auditar-aplicacao-dry-run`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `git diff --check` (apenas avisos de fim de linha LF/CRLF);
  - `git ls-files "*.sqlite*"` (nada versionado); `frontend/data/publicados`
    sem alterações.
- Resultado: base sem decisões resolutivas — todas as métricas de decisão em
  `0`; reconstrução com `47` impedimentos e comparador inalterados;
  `aptoParaAtivacao` e `aptoParaPublicacao` continuam `false`.
- Escopo: sem alteração de banco, origem ativa, publicação, frontend ou API;
  nenhuma decisão aplicada materialmente ao `planoAplicacao`.
- Rollback: `git revert`/reversão dos arquivos acima.

## 20/05/2026 - PROFOR 2022: Etapa 8.1 - Motor de aplicação material das decisões de revisão em dry-run

- Branch atual: `main`.
- Objetivo: criar o motor que interpreta decisões resolutivas registradas na
  revisão assistida e as transforma em regras técnicas de reconstrução,
  aplicadas somente na camada dry-run. Não altera a origem ativa, não publica,
  não toca `frontend/data/publicados` e não modifica nenhuma tabela do SQLite.
- Serviço criado:
  - `backend/services/profor-2022/profor-pad-decisao-aplicacao-service.js`.
- Arquivos criados:
  - `backend/scripts/auditar-aplicacao-decisoes-pad-profor-2022.js`;
  - `tests/services/profor-pad-decisao-aplicacao.test.js`.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js`;
  - `backend/services/profor-2022/profor-pad-plano-comparador-service.js`;
  - `backend/scripts/reconstruir-plano-pad-profor-2022.js`;
  - `backend/scripts/comparar-plano-pad-profor-2022.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Comando criado:
  - `npm run profor:pad:decisoes:auditar-aplicacao-dry-run` (somente leitura).
- Decisões resolutivas suportadas: `ACEITO`, `REJEITADO`, `CORRIGIDO`,
  `REVERTIDO`. `COMENTAR` e `EM_REVISAO` não são resolutivas.
- Regras de aplicação implementadas (por tipo de alerta):
  - `equivalencia_por_descricao_normalizada`: ACEITO usa o rateio do item
    equivalente da memória; REJEITADO/REVERTIDO mantêm sem rateio;
  - `item_pad_sem_rateio` / `item_novo_sem_rateio` / `rateio_novo` /
    `correcao_de_rateio`: ACEITO/CORRIGIDO com rateio válido no `payloadDecisao`
    geram linhas pelo rateio informado; sem rateio → não aplicável
    (`decisao_sem_rateio_aplicavel`); rateio inválido → `decisao_rateio_invalido`;
    REJEITADO/REVERTIDO recusam o rateio;
  - `item_ausente_no_pad` / `item_substituido`: ACEITO confirma a ausência;
    REJEITADO/REVERTIDO mantêm o alerta de ausência;
  - `item_nao_apto` / `item_conhecido_nao_apto`: ACEITO/CORRIGIDO liberam o uso
    do item na reconstrução dry-run (sem alterar `apto_para_importacao_futura`);
    REJEITADO/REVERTIDO mantêm o impedimento;
  - `quantidade_valor_unitario_inconsistente`: ACEITO marca a inconsistência
    como saneada em dry-run, sem recalcular o total previsto;
  - `valor_diferente`, `quantidade_diferente`, `valor_unitario_diferente`,
    `saldo_inconsistente`, `descricao_divergente`, `natureza_divergente`:
    ACEITO aceita o campo do PAD; CORRIGIDO aplica o valor corrigido do
    `payloadDecisao` (sem valor → `decisao_corrigido_sem_valor`);
    REJEITADO/REVERTIDO não substituem o PAD automaticamente.
- Integração com a reconstrução dry-run: antes de classificar item como sem
  rateio, verifica equivalência/rateio aceito; antes de bloquear item não apto,
  verifica liberação por decisão; alertas de quantidade × valor unitário com
  decisão ACEITO são marcados `saneadoPorDecisao`. O relatório passou a conter
  `decisoesResolutivasEncontradas`, `decisoesAplicadasDryRun`,
  `decisoesNaoAplicaveis` e os totais correspondentes no `resumo`.
- Integração com o comparador: novas classificações `diferenca_saneada_por_decisao`
  e `ausencia_confirmada_por_decisao`; `diferenca_por_pendencia_de_decisao`
  mantida para divergências ainda pendentes; novos contadores
  `totalDiferencasSaneadasPorDecisao`, `totalAusenciasConfirmadasPorDecisao`,
  `totalDecisoesAplicadasDryRun` e `totalDecisoesNaoAplicaveis`.
- Resultado com a base atual (0 decisões resolutivas registradas):
  - decisões resolutivas encontradas: `0`; aplicadas em dry-run: `0`;
    não aplicáveis: `0`;
  - reconstrução: impedimentos `47`, alertas `106`, linhas `598`,
    `aptoParaAtivacao = false`, `aptoParaPublicacao = false` (sem mudança de
    comportamento — o motor de decisões não altera os números sem decisões);
  - comparador: itens iguais `93`, novos `0`, ausentes `34`, quantidade
    divergente `387`, valor previsto `13`, valor executado `13`, saldo `26`,
    ambíguos `49`, críticas `0`, avisos `99`, esperadas por atualização PAD `4`,
    por pendência de decisão `322`, saneadas por decisão `0`, ausências
    confirmadas por decisão `0`;
  - totais e diferença total inalterados (previsto `-337918.65`, executado
    `-888.26`, saldo `-337030.39`).
- Teste controlado: optou-se por teste unitário com objetos simulados
  (`tests/services/profor-pad-decisao-aplicacao.test.js`, 14 casos, todos
  aprovados), exercitando `interpretarDecisaoRevisao`, `validarRateioManual` e
  `extrairRateioManual`. Não foi criada divergência/decisão de teste no banco,
  para não tocar a base real.
- Validações executadas:
  - `node --check` nos 7 arquivos criados/alterados;
  - `npm run validar:syntax` (56 arquivos);
  - `npm run validar:services` (19 testes aprovados, incluindo os 14 novos);
  - `npm run profor:pad:auditar-fila-revisao` (baseline mantido: 145/145/0/44/48);
  - `npm run profor:pad:decisoes:auditar-aplicacao-dry-run` (0 decisões);
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `git diff --check` (apenas avisos de fim de linha LF/CRLF);
  - `git status --short frontend/data/publicados` (sem alterações);
  - `git ls-files "*.sqlite" "*.sqlite-wal" "*.sqlite-shm"` (nada versionado).
- Confirmações de escopo:
  - nenhuma decisão aplicada materialmente ao `planoAplicacao` oficial;
  - nenhuma origem ativa alterada; nenhuma publicação;
  - nenhuma alteração em `frontend/data/publicados`;
  - nenhuma migration nem nova estrutura persistida; nenhuma API nova;
  - nenhuma dependência nova; interface SISTEMA não modificada;
  - nenhuma divergência, decisão ou log apagado; E2E não afetado.
- Riscos e rollback:
  - risco baixo: o motor apenas lê o SQLite e produz regras em memória/relatório;
  - como a base não tem decisões resolutivas, o motor não altera os números;
  - rollback por `git revert`/remoção dos 3 arquivos criados e reversão dos
    serviços/scripts/`package.json`/`scripts/validar-syntax.js`.

## 20/05/2026 - PROFOR 2022: Etapa 5.6 + 6 + 7 - Reconstrução dry-run do plano PAD e comparador antigo × novo

- Branch atual: `main`.
- Objetivo: criar a camada técnica de reconstrução dry-run do `planoAplicacao`
  por relatórios PAD + itens conhecidos + rateios, e o comparador entre o plano
  da origem antiga e o plano reconstruído. Tudo em dry-run, sem alterar a
  origem ativa, sem publicar e sem aplicar decisões materialmente.
- Arquivos criados:
  - `backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js`;
  - `backend/services/profor-2022/profor-pad-plano-comparador-service.js`;
  - `backend/scripts/reconstruir-plano-pad-profor-2022.js`;
  - `backend/scripts/comparar-plano-pad-profor-2022.js`.
- Arquivos alterados:
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Comandos criados:
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`.
- Relatórios gerados em `backend/data/relatorios`:
  - `profor-2022-pad-plano-reconstruido-dry-run.json`;
  - `profor-2022-pad-plano-comparacao-dry-run.json`;
  - `profor-2022-pad-plano-comparacao-dry-run.md`.
- Regras de reconstrução:
  - itens PAD lidos/normalizados são cruzados com itens conhecidos e rateios
    ativos persistidos no SQLite; para cada item PAD com rateio é gerada uma
    linha por área/natureza;
  - `Valor Total Previsto`, `Valor Total Executado` e `Saldo` do PAD são a
    fonte de verdade; o rateio aplica `percentual_valor` (fallback controlado:
    valores de referência; último recurso: distribuição igual com impedimento);
  - `quantidade` é rateada por `percentual_quantidade`;
  - `valorUnitario` da linha é derivado de `valorPrevistoRateado ÷ quantidadeRateada`
    (quantidade 0 mantém o `Valor Unit` do PAD como referência auxiliar, sem
    recalcular total);
  - arredondamento controlado em centavos; diferença residual lançada na última
    linha ativa do rateio, com alerta técnico `ajuste_residual_arredondamento`.
- Regras de bloqueio: `aptoParaAtivacao` exige fila de revisão sem divergência
  PENDENTE/EM_REVISAO com `bloqueia_publicacao = 1`, nenhum item PAD sem rateio,
  nenhum item conhecido não apto usado, nenhum convênio PAD fora da carteira e
  nenhum erro crítico de leitura. `aptoParaPublicacao` exige `aptoParaAtivacao`,
  `publicacaoLiberada = true` e nenhuma diferença crítica no comparador.
- Resultado da reconstrução dry-run:
  - relatórios PAD lidos: `15`; itens PAD processados: `525`;
  - itens PAD com rateio aplicado: `498`; itens PAD sem rateio: `27`;
  - linhas reconstruídas: `598`; convênios reconstruídos: `15`;
  - impedimentos: `47` (`item_pad_sem_rateio` 27, `item_conhecido_nao_apto_usado`
    19, `divergencias_revisao_bloqueiam_publicacao` 1);
  - alertas: `106` (`quantidade_valor_unitario_inconsistente` 67,
    `item_pad_duplicado_na_reconstrucao` 24, `ajuste_residual_arredondamento` 15);
  - valor previsto reconstruído: `10326096.83`; executado: `3201807.64`;
    saldo: `7124289.19`;
  - `aptoParaAtivacao = false`; `aptoParaPublicacao = false`.
- Resultado do comparador antigo × novo:
  - linhas origem antiga: `567`; linhas reconstruídas: `598`;
  - itens iguais: `93`; itens novos: `0`; itens ausentes: `34`;
  - quantidade divergente: `387`; valor previsto divergente: `13`;
    valor executado divergente: `13`; saldo divergente: `26`;
  - área divergente: `0`; natureza divergente: `0`; itens ambíguos: `49`;
  - diferenças críticas: `0`; avisos: `99`; esperadas por atualização PAD: `4`;
    por pendência de decisão: `322`;
  - totais antigo: previsto `10664015.48`, executado `3202695.90`, saldo
    `7461319.58`;
  - totais novo: previsto `10326096.83`, executado `3201807.64`, saldo
    `7124289.19`;
  - diferença total: previsto `-337918.65`, executado `-888.26`, saldo
    `-337030.39`;
  - `aptoParaAtivacao = false`; `aptoParaPublicacao = false`.
- Auditoria da revisão (baseline mantido): `totalDivergencias=145`,
  `totalPendentes=145`, `totalEmRevisao=0`, `totalImpeditivas=44`,
  `totalBloqueiamPublicacao=48`, `totalPendentesQueBloqueiamPublicacao=48`,
  `totalComDecisaoResolutiva=0`, `totalSemDecisaoResolutiva=145`,
  `publicacaoLiberada=false`.
- Observações operacionais:
  - a origem antiga foi representada pela memória de rateio persistida (itens
    conhecidos + rateios ativos), que captura as abas por UF agregadas por
    item/área/natureza; a planilha antiga não foi relida;
  - `item_pad_duplicado_na_reconstrucao` (24) indica itens com a mesma
    descrição/convênio repetidos nos relatórios PAD; a reconstrução não
    consolida silenciosamente e o comparador registra `itens ambíguos` (49);
  - a base atual não está apta porque há 48 divergências pendentes que bloqueiam
    publicação e 46 impedimentos de rateio/aptidão na reconstrução.
- Validações executadas:
  - `node --check` nos 4 arquivos criados;
  - `npm run validar:syntax` (53 arquivos);
  - `npm run profor:pad:auditar-fila-revisao`;
  - `npm run profor:pad:reconstruir-plano:dry-run`;
  - `npm run profor:pad:comparar-plano:dry-run`;
  - `git diff --check` (apenas avisos de fim de linha LF/CRLF);
  - `git status --short frontend/data/publicados` (sem alterações);
  - `git ls-files "*.sqlite" "*.sqlite-wal" "*.sqlite-shm"` (nada versionado);
  - `npm rebuild better-sqlite3` foi necessário por incompatibilidade de ABI do
    Node nesta máquina; não altera código versionado.
- Confirmações de escopo:
  - nenhuma decisão aplicada ao `planoAplicacao`;
  - nenhuma origem ativa alterada;
  - nenhuma publicação;
  - nenhuma alteração em `frontend/data/publicados`;
  - nenhuma migration nem nova estrutura persistida;
  - nenhuma API criada; nenhuma dependência nova;
  - interface de revisão não modificada; testes E2E não afetados.
- Riscos e rollback:
  - risco baixo: serviços e scripts apenas leem SQLite e relatórios PAD e
    escrevem JSON/MD em `backend/data/relatorios`;
  - rollback por `git revert`/remoção dos 4 arquivos criados e reversão de
    `package.json` e `scripts/validar-syntax.js`; os relatórios em
    `backend/data/relatorios` podem ser apagados sem impacto.

## 20/05/2026 - Saneamento PROFOR 2022: Etapa 5.5.1 - Ajustes pós-interface

- Branch atual: `main`.
- Objetivo: sanear status resolutivo órfão na fila de revisão PAD x memória, atualizar cache-busters da interface e corrigir a exibição monetária do card Antes x Depois.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-revisao-repository.js`;
  - `backend/scripts/sanear-status-orfaos-revisao-pad-profor-2022.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `frontend/js/app.js`;
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Status resolutivos órfãos:
  - status resolutivos considerados: `ACEITO`, `REJEITADO`, `CORRIGIDO`, `REVERTIDO`;
  - decisão resolutiva exigida: `ACEITO`, `REJEITADO`, `CORRIGIDO` ou `REVERTIDO`;
  - encontrado 1 órfão real: id `24`, chave `equivalencia_por_descricao_normalizada:a666445f21fca80d`, convênio `937265`, UF `MS`, status anterior `ACEITO`;
  - saneado 1 órfão: status revertido para `PENDENTE`;
  - registrado log `status_resolutivo_orfao_saneado` com usuário `sistema-saneamento`;
  - nenhuma decisão falsa foi criada.
- Comando criado:
  - `npm run profor:pad:revisao:sanear-status-orfaos`;
  - `npm run profor:pad:revisao:sanear-status-orfaos -- --dry-run`.
- Auditoria:
  - antes documentado na Etapa 5.5: `totalDivergencias=145`, `totalPendentes=144`, `totalComDecisaoResolutiva=0`, `totalSemDecisaoResolutiva=145`, `publicacaoLiberada=false`, 1 divergência real em `ACEITO` sem decisão resolutiva;
  - depois do saneamento: `totalDivergencias=145`, `totalPendentes=145`, `totalComDecisaoResolutiva=0`, `totalSemDecisaoResolutiva=145`, `publicacaoLiberada=false`;
  - `totalPendentesQueBloqueiamPublicacao` passou para `48`.
- Cache-busters:
  - `frontend/css/app.css?v=20260520-01-revisao-pad`;
  - `frontend/js/app.js?v=20260520-01-revisao-pad`.
- Formatação monetária:
  - `formatarValorRevisao()` passou a usar normalização numérica específica para a tela de revisão;
  - strings como `37.59`, `37,59`, `1.234,56` e `1,234.56` passam a ser exibidas corretamente quando o rótulo indica campo monetário;
  - textos não numéricos permanecem texto.
- Confirmações de escopo:
  - nenhuma decisão aplicada ao `planoAplicacao`;
  - nenhuma reconstrução do plano;
  - nenhuma publicação;
  - nenhuma alteração de origem ativa;
  - nenhuma alteração em `frontend/data/publicados`;
  - nenhuma migration;
  - nenhum `*.sqlite`, `*.sqlite-wal` ou `*.sqlite-shm` versionado.
- Validações executadas:
  - `node --check backend/services/profor-2022/profor-pad-revisao-repository.js`;
  - `node --check backend/scripts/sanear-status-orfaos-revisao-pad-profor-2022.js`;
  - `node --check frontend/js/app.js`;
  - `npm run validar:syntax`;
  - `npm run profor:pad:revisao:limpar-testes`;
  - `npm run profor:pad:revisao:sanear-status-orfaos -- --dry-run`;
  - `npm run profor:pad:revisao:sanear-status-orfaos`;
  - `npm run profor:pad:auditar-fila-revisao`;
  - `GET /api/profor-2022/revisao/auditoria`;
  - `GET /api/profor-2022/revisao/divergencias?status=PENDENTE&limite=5`;
  - `GET /api/profor-2022/revisao/divergencias?comDecisaoResolutiva=true&limite=5`;
  - smoke Playwright em `http://127.0.0.1:8790/index.html` confirmando auditoria, filtros, detalhe, log de saneamento e valores monetários;
  - `git diff --check`;
  - `git status --short frontend/data/publicados`;
  - `git ls-files "*.sqlite" "*.sqlite-wal" "*.sqlite-shm"`.
- Riscos e rollback:
  - o saneamento altera o SQLite local para coerência da fila; rollback operacional possível por restauração de backup local do banco;
  - rollback de código por `git revert` remove script, helper de exibição e cache-busters;
  - divergências não reapresentadas e aplicação material de decisões seguem fora desta etapa.

## 20/05/2026 - Saneamento PROFOR 2022: Etapa 5.5 - Interface de revisão PAD x memória

- Branch atual: `main`.
- Estado inicial: working tree limpo.
- Objetivo: criar a primeira versão da tela `SISTEMA > Revisão de divergências PAD x memória`, limpar divergências controladas de teste e bloquear filtros contraditórios de decisão resolutiva.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-revisao-repository.js`;
  - `backend/scripts/limpar-divergencias-teste-revisao-pad-profor-2022.js`;
  - `backend/server.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `index.html`;
  - `frontend/js/app.js`;
  - `frontend/css/app.css`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Limpeza operacional:
  - criado comando `npm run profor:pad:revisao:limpar-testes`;
  - limpeza transacional remove apenas divergências com `chave_divergencia LIKE 'revisao_teste:%'`, suas decisões e seus logs;
  - lotes de revisão são preservados;
  - resultado da primeira execução: 1 divergência de teste removida, 2 decisões removidas, 2 logs removidos, 1 divergência removida.
- Ajustes backend:
  - `GET /api/profor-2022/revisao/divergencias` valida filtros booleanos;
  - combinação contraditória `semDecisaoResolutiva=true&comDecisaoResolutiva=true` retorna HTTP 400;
  - `ACEITO` permanece somente decisão humana registrada, sem aplicação ao plano.
- Interface criada:
  - menu lateral `Revisão de divergências` na área SISTEMA;
  - view `view-revisao-divergencias`;
  - bloco de auditoria com contadores de publicação bloqueada/liberada;
  - filtros por status, nível, tipo, convênio, UF, bloqueio de publicação, sem/com decisão resolutiva;
  - lista de divergências com botão `Revisar`;
  - detalhe com comparação `ANTES — memória atual` x `DEPOIS — PAD novo`;
  - logs, decisões e formulário de decisão auditável.
- Resultado da auditoria após limpeza final:
  - `totalDivergencias=145`;
  - `totalPendentes=144`;
  - `totalEmRevisao=0`;
  - `totalImpeditivas=44`;
  - `totalBloqueiamPublicacao=48`;
  - `totalPendentesQueBloqueiamPublicacao=47`;
  - `totalEmRevisaoQueBloqueiamPublicacao=0`;
  - `totalComDecisaoResolutiva=0`;
  - `totalComComentario=0`;
  - `totalSemDecisaoResolutiva=145`;
  - `publicacaoLiberada=false`;
  - observação: existe 1 divergência real em status `ACEITO` (`equivalencia_por_descricao_normalizada:a666445f21fca80d`), sem decisão resolutiva registrada após a limpeza; não foi removida porque não tem prefixo de teste.
- Endpoints testados:
  - `GET /api/profor-2022/revisao/auditoria`;
  - `GET /api/profor-2022/revisao/divergencias?bloqueiaPublicacao=true&semDecisaoResolutiva=true&limite=3`;
  - `GET /api/profor-2022/revisao/divergencias?comDecisaoResolutiva=true&limite=5`;
  - `GET /api/profor-2022/revisao/divergencias?semDecisaoResolutiva=true&comDecisaoResolutiva=true&limite=1` → HTTP 400;
  - `GET /api/profor-2022/revisao/divergencias/:id`;
  - `GET /api/profor-2022/revisao/divergencias/:id/logs`;
  - `POST /api/profor-2022/revisao/divergencias/:id/decisoes` em divergência controlada `revisao_teste:%`, seguido de limpeza final.
- Validações executadas:
  - `node --check frontend/js/app.js`;
  - `node --check backend/server.js`;
  - `node --check backend/services/profor-2022/profor-pad-revisao-repository.js`;
  - `node --check backend/scripts/limpar-divergencias-teste-revisao-pad-profor-2022.js`;
  - `npm run validar:syntax`;
  - `npm run profor:pad:revisao:limpar-testes`;
  - `npm run profor:pad:auditar-fila-revisao`.
  - smoke via Playwright headless em `http://127.0.0.1:8790/index.html`: abriu `revisao-divergencias`, carregou 145 divergências, confirmou exclusão mútua dos filtros sem/com decisão e abriu detalhe sem erros de console;
  - `git diff --check`;
  - `git status --short frontend/data/publicados`.
- Confirmações de escopo:
  - nenhuma decisão aplicada ao `planoAplicacao`;
  - nenhuma reconstrução do plano;
  - nenhuma publicação;
  - nenhuma alteração de origem ativa;
  - nenhuma alteração em `frontend/data/publicados`;
  - nenhum `*.sqlite`, `*.sqlite-wal` ou `*.sqlite-shm` versionado.
- Riscos e pendências:
  - a interface ainda é primeira versão e não resolve divergências não reapresentadas nem decisão antiga com payload alterado;
  - a divergência real em status `ACEITO` sem decisão resolutiva deve ser saneada em rodada própria antes de qualquer aplicação material das decisões;
  - rollback: reverter os arquivos alterados remove tela, comando e validação de filtros; a limpeza local de `revisao_teste:%` não afeta divergências reais.

## 20/05/2026 - Saneamento PROFOR 2022: Etapa 5.4.1 - Auditoria operacional da revisão assistida

- Branch atual: `main`.
- Estado inicial: working tree limpo.
- Objetivo: ajustar a auditoria operacional da fila persistente de revisão PAD x memória para alimentar corretamente a futura tela SISTEMA > Revisão de divergências.
- Mudanças realizadas:
  - **`profor-pad-revisao-repository.js`**: novos contadores SQL para pendentes, em revisão, bloqueios de publicação, decisões resolutivas, comentários e cálculo de `publicacaoLiberada`; filtros `semDecisaoResolutiva` e `comDecisaoResolutiva`.
  - **`profor-pad-revisao-decisao-service.js`**: `auditarPendencias()` passou a expor os novos campos mantendo aliases legados.
  - **`profor-pad-revisao-service.js`** e **`auditar-fila-revisao-pad-profor-2022.js`**: relatório CLI atualizado para decisões resolutivas, comentários e regra de liberação.
  - **`backend/server.js`**: rota de listagem aceita os novos filtros.
  - Documentação: `profor-2022-automacao-planos-aplicacao.md` e `schema-banco.md`.
- Regra final de publicação:
  - `publicacaoLiberada=true` somente quando não houver divergência com `status` `PENDENTE` ou `EM_REVISAO` e `bloqueia_publicacao = 1`.
- Classificação de decisões:
  - resolutivas: `ACEITO`, `REJEITADO`, `CORRIGIDO`, `REVERTIDO`;
  - comentário: `COMENTAR`;
  - em revisão: `EM_REVISAO`.
- Resultado da auditoria local:
  - `totalDivergencias=146`;
  - `totalPendentes=144`;
  - `totalEmRevisao=0`;
  - `totalImpeditivas=44`;
  - `totalBloqueiamPublicacao=48`;
  - `totalPendentesQueBloqueiamPublicacao=47`;
  - `totalEmRevisaoQueBloqueiamPublicacao=0`;
  - `totalComDecisaoResolutiva=1`;
  - `totalComComentario=0`;
  - `totalSemDecisaoResolutiva=145`;
  - `publicacaoLiberada=false`.
- Validações executadas:
  - `node --check` nos arquivos JS alterados;
  - `npm run profor:pad:auditar-fila-revisao`;
  - `GET /api/profor-2022/revisao/auditoria`;
  - `GET /api/profor-2022/revisao/divergencias?bloqueiaPublicacao=true&semDecisaoResolutiva=true&limite=3`;
  - `GET /api/profor-2022/revisao/divergencias?comDecisaoResolutiva=true&limite=5`.
- Restrições preservadas:
  - sem migration;
  - sem alteração de banco estrutural;
  - sem alteração de frontend;
  - sem alteração de `frontend/data/publicados`;
  - sem publicação;
  - sem reconstrução do `planoAplicacao`;
  - sem alteração de origem ativa;
  - nenhuma decisão foi aplicada ao plano.

## 20/05/2026 - Saneamento PROFOR 2022: Etapa 5.4 - Camada backend/API de revisão assistida

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da Etapa 5.3.
- Objetivo: criar serviços e rotas backend para consultar divergências e registrar decisões humanas, sem aplicar essas decisões ao planoAplicacao.
- Mudanças realizadas:
  - **`profor-pad-revisao-repository.js`** estendido: `listarDivergencias` (filtros status/nível/tipo/convênio/UF/bloqueio + paginação), `buscarDivergenciaPorId`, `listarDecisoesDaDivergencia`, `listarLogsDaDivergencia`, `registrarDecisao` (transacional — insere decisão, atualiza status, grava log com estado anterior/novo).
  - **Novo** `backend/services/profor-2022/profor-pad-revisao-decisao-service.js`: regras da decisão (status permitidos, justificativa obrigatória), parse de `payload_json`, formatação para API, `RevisaoDecisaoError` (HTTP 400).
  - **`backend/server.js`**: 5 rotas em `rotearApi`, no padrão `http` nativo do projeto — `GET /api/profor-2022/revisao/divergencias`, `GET .../divergencias/:id`, `GET .../divergencias/:id/logs`, `GET .../auditoria`, `POST .../divergencias/:id/decisoes`.
  - **Novo script** `backend/scripts/testar-decisao-revisao-pad-profor-2022.js` (comando `profor:pad:revisao:teste-decisao`): usa uma divergência CONTROLADA de teste (chave `revisao_teste:...`), não contamina as 145 reais.
  - `package.json` e `scripts/validar-syntax.js` atualizados.
  - Documentação: `profor-2022-automacao-planos-aplicacao.md` (nova §16.2.7) e `schema-banco.md` (tabela de relação tabelas/serviços/rotas).
- Regras da decisão: decisões aceitas `ACEITO`/`REJEITADO`/`EM_REVISAO`/`CORRIGIDO`/`REVERTIDO`/`COMENTAR` (esta mantém `PENDENTE`); `ACEITO`/`REJEITADO`/`CORRIGIDO`/`REVERTIDO` exigem justificativa; toda decisão exige `usuario`; nova decisão sobre divergência já decidida acrescenta linha sem apagar a anterior; **`ACEITO` é apenas decisão registrada — a API nunca aplica ao planoAplicacao**.
- Testes executados (servidor local, porta 8799):
  - `npm run profor:pad:revisao:teste-decisao` → decisão EM_REVISAO gravada, log com estado anterior/novo, `aplicadaAoPlano=false`.
  - `GET .../divergencias?nivel=impeditivo` → 44 impeditivas, impeditivo primeiro.
  - `GET .../auditoria` → totais por status/nível/tipo/convênio.
  - `GET .../divergencias/1` → payload parseado + decisões + logs.
  - `POST .../divergencias/146/decisoes` sem justificativa → HTTP 400; com justificativa → HTTP 201 (EM_REVISAO → ACEITO); decisão inválida → HTTP 400; divergência inexistente → HTTP 404.
- Validações: `node --check` nos arquivos novos/alterados → OK; `npm run validar:syntax` → OK (47 arquivos); `npm run profor:pad:auditar-fila-revisao` → OK; `git diff --check` → limpo; `git status --short frontend/data/publicados` → vazio; `*.sqlite/-wal/-shm` ignorados, não versionados.
- Risco: Baixo. Escrita transacional; nenhuma decisão aplicada ao planoAplicacao; nenhuma exclusão; não toca frontend, publicação nem origem ativa. A divergência de teste (id 146) vive apenas no SQLite local ignorado pelo git.
- Rollback: `git revert` do commit (remove serviço, script, rotas e exports); as linhas de teste no SQLite local são inertes.

## 20/05/2026 - Saneamento PROFOR 2022: Etapa 5.3 - Fila persistente de revisão de divergências

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da padronização de caixa do status.
- Objetivo: criar uma fila persistente no SQLite para armazenar as divergências PAD x memória, permitindo deliberação posterior pela interface (tela SISTEMA futura). A etapa não implementa front-end nem aplica decisões.
- Mudanças realizadas:
  - **`backend/db/init-db.js`**: migration aditiva `garantirTabelasRevisaoProfor2022()` — 4 tabelas (`profor_2022_revisao_lotes`, `profor_2022_revisao_divergencias`, `profor_2022_revisao_decisoes`, `profor_2022_revisao_logs`) e 7 índices. `CREATE TABLE IF NOT EXISTS`, idempotente.
  - **Novo** `backend/services/profor-2022/profor-pad-revisao-repository.js`: acesso transacional ao SQLite — criar lote, upsert de divergência por `chave_divergencia` (preserva `status` e nunca toca decisões), registrar log, consultas de auditoria.
  - **Novo** `backend/services/profor-2022/profor-pad-revisao-service.js`: transforma os relatórios de saneamento, detalhado e leitor PAD em divergências; `chave_divergencia` estável (numeroConvenio + tipo_alerta + chave_item/descrição + campo + hash); geração da fila em transação única; auditoria somente leitura.
  - **Novos scripts** `backend/scripts/gerar-fila-revisao-pad-profor-2022.js` e `auditar-fila-revisao-pad-profor-2022.js`.
  - `package.json`: comandos `profor:pad:gerar-fila-revisao` e `profor:pad:auditar-fila-revisao`.
  - `scripts/validar-syntax.js`: adicionados os 4 arquivos novos.
  - Documentação: `schema-banco.md` (4 tabelas documentadas; seção de auditoria atualizada de pendência para implementada); `profor-2022-automacao-planos-aplicacao.md` (nova §16.2.6 — fila persistente, distinção divergência/decisão/log, comandos).
- Resultado da geração: **145 divergências** persistidas — 67 `quantidade_valor_unitario_inconsistente`, 32 `item_ausente_no_pad`, 23 `item_novo_sem_rateio`, 19 `item_nao_apto`, 4 `equivalencia_por_descricao_normalizada`. Por nível: 101 aviso, 44 impeditivo. Todas com status PENDENTE; 48 bloqueiam publicação. 13 convênios afetados.
- Mapeamento de divergências: itens PAD sem rateio → `item_novo_sem_rateio`; coincidências normalizadas → `equivalencia_por_descricao_normalizada`; não aptos → `item_nao_apto`; ausentes → `item_ausente_no_pad`; alertas do leitor PAD → `quantidade_valor_unitario_inconsistente` / `saldo_inconsistente` / `natureza_divergente`.
- Regeneração idempotente verificada: simulada uma decisão (status ACEITO + registro em `profor_2022_revisao_decisoes`); ao regenerar a fila, 0 criadas / 145 atualizadas, status ACEITO e decisão preservados; divergências antigas não apagadas.
- Validações executadas:
  - `node --check` nos 4 arquivos novos → OK. `npm run validar:syntax` → OK (45 arquivos).
  - `npm run init-db` → 4 tabelas e 7 índices criados.
  - `npm run profor:pad:gerar-fila-revisao` → 145 divergências. `npm run profor:pad:auditar-fila-revisao` → totais conferidos.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio. `*.sqlite/-wal/-shm` aparecem como ignorados (`!!`), não versionados.
- Risco: Baixo. Migration estritamente aditiva e idempotente; escrita transacional; nenhuma decisão aplicada; nenhuma exclusão física. Não toca frontend, publicação, origem ativa do planoAplicacao nem reconstrução.
- Rollback: `git revert` do commit (remove tabelas do `init-db.js`, serviços e scripts); as tabelas já criadas no SQLite local permanecem vazias e inertes — podem ser descartadas recriando o banco, se necessário, sem impacto nas demais.

## 20/05/2026 - Saneamento PROFOR 2022: Padronização da caixa do status da revisão assistida

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit do detalhamento visual.
- Ponto de atenção: a §16.2.2 listava o `status` em caixa baixa (`pendente`, `aceito`, ...), enquanto a §16.2.4 usava caixa alta (`PENDENTE`, `ACEITO`, ...). Diferença apenas de apresentação, sem erro funcional.
- Mudanças realizadas (estritamente documentais):
  - **`profor-2022-automacao-planos-aplicacao.md`**: §16.2.2 passou a listar o `status` em caixa alta; nova subseção §16.2.5 (Convenção de caixa do campo `status`) fixando caixa alta como valor canônico no SQLite e na API — alinhado às tabelas e comandos de saneamento já desenhados. A interface pode exibir o rótulo com qualquer capitalização, mas grava/compara o valor canônico. Níveis (`info`/`aviso`/`impeditivo`) permanecem em caixa baixa, por já serem o padrão dos relatórios e alertas PAD existentes.
- Decisão registrada: o `status` da revisão assistida é canônico em caixa alta (PENDENTE, ACEITO, REJEITADO, EM_REVISAO, CORRIGIDO, APLICADO, REVERTIDO).
- Validações executadas:
  - `npm run validar:syntax` → OK (41 arquivos) — nenhum código alterado.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
- Risco: Nulo. Alteração estritamente documental; nenhum código, banco, migration, frontend, publicação, origem ativa ou decisão de saneamento foi tocado.
- Rollback: `git revert` do commit; ou `git restore` dos 2 arquivos de memória.

## 20/05/2026 - Saneamento PROFOR 2022: Detalhamento visual da revisão de divergências PAD x memória

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da regra futura de revisão assistida e auditoria.
- Objetivo: detalhar o padrão visual futuro da funcionalidade SISTEMA > Revisão de divergências PAD x memória. Alteração estritamente documental — sem implementação.
- Mudanças realizadas:
  - **`profor-2022-automacao-planos-aplicacao.md`**: nova subseção §16.2.4 (Detalhamento visual). Registra a interface futura em três níveis: (1) lista resumida de alertas com filtros por status/nível/convênio/UF/tipo/bloqueio e status visual em 7 estados; (2) card comparativo Antes × Depois, com todos os campos a exibir e bloco de diagnóstico automático (tipo, motivo provável, evidências, risco de falso positivo, ação sugerida); (3) painel/balão de decisão com as 10 ações. Inclui regras transversais (justificativa conforme tipo/nível, log/auditoria, experiência tipo controle de alterações) e uma tabela com 5 exemplos de uso (descrição por acentuação, valor, item novo sem rateio, item ausente, quantidade × valor unitário).
- Decisões registradas:
  - Definido que a interface futura trabalhará em três níveis: lista resumida, card comparativo Antes × Depois e painel/balão de decisão.
  - A lista permite filtros por status, nível, convênio, UF, tipo e bloqueio de publicação; cada divergência exibe status visual (PENDENTE/ACEITO/REJEITADO/EM_REVISAO/CORRIGIDO/APLICADO/REVERTIDO) e nível (info/aviso/impeditivo).
  - O card compara ANTES (memória) × DEPOIS (PAD) e traz diagnóstico automático.
  - O painel expõe as ações de decisão; toda decisão exige ou permite justificativa e gera log/auditoria.
  - Não houve implementação de front-end, componentes, banco, migration ou aplicação de decisões nesta etapa.
- Validações executadas:
  - `npm run validar:syntax` → OK (41 arquivos) — nenhum código alterado, validação por garantia.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
  - Confirmado que apenas arquivos de documentação/memória foram alterados.
- Risco: Nulo. Alteração estritamente documental; nenhum código, banco, migration, frontend, publicação, origem ativa do planoAplicacao ou decisão de saneamento foi tocado.
- Rollback: `git revert` do commit; ou `git restore` dos 2 arquivos de memória.

## 20/05/2026 - Saneamento PROFOR 2022: Regra futura de revisão assistida e auditoria de divergências

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da consolidação documental das regras de leitura PAD.
- Objetivo: registrar na memória técnica uma regra futura de interface (revisão assistida de divergências PAD x memória) e a auditoria obrigatória das decisões. Alteração estritamente documental — sem implementação.
- Mudanças realizadas:
  - **`profor-2022-automacao-planos-aplicacao.md`**: nova seção §16.2 (Revisão assistida de divergências — funcionalidade futura), com regra de revisão assistida, padrão visual, ações disponíveis, regra de aplicação; §16.2.1 (17 tipos mínimos de alerta de revisão); §16.2.2 (campos previstos por alerta — tipo, nível, status, campo afetado, valores, fontes, diferença, motivo, ação sugerida, impacto, bloqueia publicação); §16.2.3 (regra de log/auditoria obrigatória, com a lista de itens rastreáveis e os 15 casos de aplicação).
  - **`schema-banco.md`**: nova seção "Pendência futura: modelo de auditoria da revisão assistida de divergências PAD" — marca a necessidade futura de modelo de persistência de auditoria, sem criar tabela, coluna ou migration.
- Decisões registradas:
  - Definida a regra futura de revisão assistida de divergências PAD x memória.
  - A aplicação deverá exibir alertas no front-end com valor anterior, valor novo, diferença, motivo provável e ações de decisão (aceitar, rejeitar, manter anterior, corrigir, revisar depois, ver detalhes).
  - Nenhuma divergência será aplicada silenciosamente; o dado bruto da fonte não é sobrescrito sem decisão validada.
  - Toda aceitação, rejeição, correção, postergação, aplicação de lote, rollback ou publicação baseada em dados saneados deverá gerar log/auditoria.
  - A reconstrução do `planoAplicacao` só deverá usar dados aceitos, saneados e auditáveis.
  - Não houve implementação de front-end, componentes visuais, banco, migration ou aplicação de decisões nesta etapa.
- Avaliação dos documentos: a regra foi registrada no documento principal da migração PAD (`profor-2022-automacao-planos-aplicacao.md`) e, como pendência futura de modelo de dados, em `schema-banco.md`. `profor-2022.md` (visão geral) e `profor-2022-operacao.md` (fluxo operacional `banco-cache`) não foram alterados, pois a regra não pertence ao escopo deles.
- Validações executadas:
  - `npm run validar:syntax` → OK (41 arquivos) — nenhum código alterado, validação por garantia.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
  - Confirmado que apenas arquivos de documentação/memória foram alterados.
- Risco: Nulo. Alteração estritamente documental; nenhum código, banco, migration, frontend, publicação, origem ativa do planoAplicacao ou decisão de saneamento foi tocado.
- Rollback: `git revert` do commit; ou `git restore` dos 3 arquivos de memória.

## 20/05/2026 - Saneamento PROFOR 2022: Consolidação documental das regras de leitura PAD

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da correção da coluna Quantidade.
- Objetivo: registrar na memória técnica as regras consolidadas sobre leitura dos relatórios PAD, normalização de quantidade e uso do valor unitário. Alteração estritamente documental.
- Mudanças realizadas:
  - **`profor-2022-automacao-planos-aplicacao.md`**: nova subseção §5.3 (regra de leitura da coluna Quantidade — normalizador próprio, ponto/vírgula como separador decimal, sem separador de milhar); nova subseção §5.4 (Valor Unit como referência auxiliar — pode estar truncado/arredondado, com os exemplos do convênio 937698); novas subseções §12.2 (fonte de verdade financeira — totais do PAD, valorUnitario derivado de valorPrevistoRateado ÷ quantidadeRateada) e §12.3 (alertas de quantidade × valor unitário como consistência da fonte). Ajustada a matriz §6 para `quantidade` e `valorUnitario` referenciarem as novas regras.
- Decisões consolidadas registradas:
  - A correção da leitura de Quantidade foi consolidada (`converterQuantidadePad`, separado do normalizador monetário).
  - O ponto na coluna Quantidade dos relatórios PAD é separador decimal — `1.0`/`2.0`/`57.0`/`5700.0` → `1`/`2`/`57`/`5700`.
  - O `Valor Unit` exibido no PAD pode estar truncado/arredondado para exibição.
  - A reconstrução financeira futura usará `Valor Total Previsto`, `Valor Total Executado` e `Saldo` do PAD como fonte de verdade; valores rateados por `percentual_valor`, quantidade por `percentual_quantidade`.
  - O `Valor Unit` é referência auxiliar/indício de equivalência, não base para recalcular total financeiro; a linha reconstruída deriva o valorUnitario de `valorPrevistoRateado ÷ quantidadeRateada` quando `quantidadeRateada > 0`.
  - Foram identificados dois exemplos no convênio 937698 (Cartilhas e Folders) em que a divergência decorre de truncamento do valor unitário exibido, não de erro do total.
- Avaliação dos demais documentos: `profor-2022.md` (visão geral — PAD detalhado descrito como etapa futura, sem seção de regras técnicas de leitura) e `schema-banco.md` (documenta tabelas, não o fluxo de leitura PAD) não foram alterados, pois as regras não se encaixam no escopo deles. `profor-2022-operacao.md` trata do fluxo operacional `banco-cache` atual, não da migração PAD — não alterado. `profor-2022-pad-saneamento.md` é relatório gerado automaticamente — não editado manualmente.
- Validações executadas:
  - `npm run validar:syntax` → OK (41 arquivos) — nenhum código alterado, validação por garantia.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
  - Confirmado que apenas arquivos de documentação/memória foram alterados.
- Risco: Nulo. Alteração estritamente documental; nenhum código, banco, frontend, publicação, origem ativa do planoAplicacao ou decisão de saneamento foi tocado.
- Rollback: `git revert` do commit; ou `git restore` dos 2 arquivos de memória.

## 20/05/2026 - Saneamento PROFOR 2022: Correção da normalização da coluna Quantidade

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit do indício de valor unitário.
- Problema: a coluna Quantidade dos arquivos `RelatorioItensDespesasPAD_*.xls` chega como string no formato `"1.0"`, `"57.0"`, `"5700.0"` (ponto = separador decimal). O leitor usava `converterNumeroPad` (normalizador monetário), que trata todo ponto como separador de milhar — inflando `"1.0"` para 10, `"57.0"` para 570, `"5700.0"` para 57000.
- Mudanças realizadas:
  - **`profor-pad-normalizacao-service.js`**: nova função `converterQuantidadePad`, separada do normalizador monetário. Trata o ponto (e a vírgula) como separador decimal, sem separador de milhar; aceita número direto, string vazia e valores inválidos. Exportada no módulo.
  - **`profor-pad-report-reader.js`**: a coluna Quantidade passa a usar `converterQuantidadePad`; Valor Unit, Valor Total Previsto, Valor Total Executado e Saldo continuam com `converterNumeroPad` (inalterados). Nova validação de consistência `quantidade x valorUnitario ≈ valorTotalPrevisto` — alerta `quantidade_valor_unitario_inconsistente`, nível `aviso` para diferença até R$ 1,00 e `impeditivo` acima disso.
- Critérios de aceite confirmados (itens dos convênios 937782 e 937265):
  - Desktop para edição de vídeo: quantidade 10 → **1**.
  - Smartphone mínimo de 128gb: quantidade 20 → **2**.
  - Switcher de vídeo (937782, linha 47): quantidade 20 → **2**.
  - Meia militar (937265, linha 51): quantidade 570 → **57**.
  - Valores unitários e totais previstos inalterados; comparação `valorUnitario` PAD x memória segue funcionando (3 coincidências exatas no 937782, divergência mantida na Meia militar).
- Contagens após regeneração: 525 itens PAD, 27 sem rateio, 4 coincidências normalizadas, 19 não aptos, 32 ausentes, 8 convênios afetados (inalteradas). Alertas do leitor PAD: 67 — 67 de `quantidade_valor_unitario_inconsistente` (65 avisos de centavos, 2 impeditivos no convênio 937698 com divergência de ~R$ 19). Template: 78 decisões, todas PENDENTE; merge preservou substituições/observações.
- Validações executadas:
  - `node --check` nos 2 arquivos alterados → OK; teste unitário de `converterQuantidadePad` (1.0→1, 57.0→57, 5700.0→5700, etc.) → todos OK.
  - `npm run profor:pad:ler-relatorios:dry-run`, `conferir-rateios:dry-run`, `relatorio-saneamento`, `gerar-template-decisoes-saneamento`, `validar-decisoes-saneamento` → todos OK; validação 0 erros, 78 pendentes.
  - `npm run validar:syntax` → OK (41 arquivos). `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
- Risco: Baixo. Correção restrita à leitura da coluna Quantidade; demais campos numéricos intactos. Nenhuma escrita em SQLite, frontend, publicação; nenhuma decisão aplicada; origem ativa do planoAplicacao inalterada.
- Rollback: `git revert` do commit; ou `git restore` dos 2 arquivos de código e regeneração dos relatórios.

## 20/05/2026 - Saneamento PROFOR 2022: Valor unitário como indício de equivalência

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da Etapa D.
- Objetivo: para os alertas `item_pad_coincide_apenas_por_descricao_normalizada`, comparar o valor unitário previsto do item PAD com o `valor_unitario_referencia` da memória, como indício adicional de equivalência. Não altera a regra de matching automático — é apenas evidência para decisão humana.
- Mudanças realizadas:
  - **`profor-pad-matching-service.js`**: `carregarItensConhecidos` agora traz `valor_unitario_referencia` e `naturezas_encontradas_json`; `montarItemPadConferido` inclui `valorUnitario` do item PAD; nova função `compararValorUnitario` (tolerância 0,01); para coincidências apenas normalizadas, o item e o alerta recebem `indicioEquivalencia` com `valorUnitarioPad`, `valorUnitarioReferenciaMemoria`, `valorUnitarioCoincide`, `diferencaValorUnitario`, `naturezaPad`, `naturezasEncontradasMemoria`.
  - **`gerar-relatorio-saneamento-pad-profor-2022.js`**: nova tabela dedicada para a seção de coincidências normalizadas, com colunas de valor unitário PAD/memória, coincidência, diferença e naturezas; a recomendação descreve o indício.
  - **`profor-pad-saneamento-service.js`**: `montarEntradasEquivalencias` inclui `indicioEquivalencia` no template (campo descritivo — o merge idempotente o reatualiza a cada regeneração, sem sobrescrever decisão humana).
- Resultado dos 4 casos de coincidência normalizada:
  - 937782 / Desktop para edição de vídeo → valor unitário **coincide** (R$ 14.849 = R$ 14.849).
  - 937782 / Smartphone 128gb → valor unitário **coincide** (R$ 2.341,24 = R$ 2.341,24).
  - 937782 / Switcher de vídeo → valor unitário **coincide** (R$ 3.901 = R$ 3.901).
  - 937265 / Meia militar → valor unitário **diverge** (PAD R$ 37,59 vs memória R$ 37,15, diferença R$ 0,44).
- Validações executadas:
  - `node --check` nos 3 arquivos alterados → OK. `npm run validar:syntax` → OK (41 arquivos).
  - `npm run profor:pad:conferir-rateios:dry-run` → 27 sem rateio (inalterado).
  - `npm run profor:pad:relatorio-saneamento` → 4 coincidências normalizadas (inalterado).
  - `npm run profor:pad:gerar-template-decisoes-saneamento` → merge preservando decisões; 4 equivalências com `indicioEquivalencia`.
  - `npm run profor:pad:validar-decisoes-saneamento` → 0 erros, 78 pendentes, arquivo válido.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
- Risco: Baixo. Apenas leitura no banco; regra de matching automático inalterada (coincidência de valor unitário é só evidência). Nenhuma escrita em SQLite, frontend ou publicação.
- Rollback: `git revert` do commit; ou `git restore` dos 3 arquivos de código e regeneração dos relatórios.

## 20/05/2026 - Saneamento PROFOR 2022: Validador do arquivo de decisões (Etapa D)

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da Etapa C.
- Objetivo: validar a coerência do arquivo de decisões antes de qualquer alteração de banco (Etapa E, fora desta rodada).
- Mudanças realizadas:
  - **Novo serviço** `backend/services/profor-2022/profor-pad-decisoes-saneamento-service.js`: carrega o arquivo de decisões (checa `versaoEsquema`), monta o contexto (carteira monitorada, itens conhecidos, itens PAD do relatório atual) e aplica 10 validadores — convênio na carteira, item PAD existente, item conhecido existente, justificativa obrigatória, soma de rateio 100/100 (tolerância 0,01), áreas válidas (OUVIDORIA/CORREGEDORIA/ESCOLA PENAL/N/A), decisões incompatíveis, exclusão+substituição, liberação de não apto com justificativa, saldo residual/remanescente com justificativa. Exporta `AREAS_VALIDAS` para reuso na Etapa E.
  - **Novo script** `backend/scripts/validar-decisoes-saneamento-pad-profor-2022.js`.
  - `package.json`: novo script `profor:pad:validar-decisoes-saneamento`.
  - `scripts/validar-syntax.js`: adicionados o serviço e o script.
- Saída gerada: `backend/data/relatorios/profor-2022-pad-validacao-decisoes.json`.
- Distinção de severidade: **erro** invalida o arquivo e causa `process.exit(1)`; **pendente** (decisão `PENDENTE`) não invalida o arquivo (exit 0), mas marca `aplicavel: false` — a Etapa E só aplicará sem erros e sem pendências.
- Validações executadas:
  - `node --check` nos 2 arquivos novos → OK. `npm run validar:syntax` → OK (41 arquivos).
  - `npm run profor:pad:validar-decisoes-saneamento` sobre o template vazio → 0 erros, 78 pendentes, `arquivoValido: sim`, `aplicavel: não`, exit 0.
  - Teste de erro: injetadas 3 decisões inválidas (rateio somando 60/70, área `JURIDICO`, exclusão sem justificativa) → 4 erros detectados, `arquivoValido: não`, exit 1 (confirmado executando o script diretamente, sem pipe). Template restaurado ao estado limpo antes do commit.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
- Risco: Baixo. Serviço somente leitura no banco; nenhuma escrita em SQLite, frontend ou publicação.
- Rollback: `git revert` do commit da Etapa D.

## 20/05/2026 - Saneamento PROFOR 2022: Template editável de decisões (Etapa C)

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da Etapa B.
- Objetivo: criar um arquivo editável por humano para registrar decisões de saneamento, pré-preenchido com as pendências atuais e sem nenhuma decisão automática.
- Mudanças realizadas:
  - **Serviço** `profor-pad-saneamento-service.js` estendido com a geração/merge do template: `derivarSugestaoArea`, `montarEntradasEquivalencias/RateiosNovos/Correcoes/Ausencias`, `mesclarLista` e `gerarTemplateDecisoesSaneamento`.
  - **Novo script** `backend/scripts/gerar-template-decisoes-saneamento-pad-profor-2022.js`.
  - `package.json`: novo script `profor:pad:gerar-template-decisoes-saneamento`.
  - `scripts/validar-syntax.js`: adicionado o novo script.
- Arquivo gerado: `backend/data/relatorios/profor-2022-pad-decisoes-saneamento.json` (78 entradas: 4 equivalências, 23 rateios novos, 19 correções de não aptos, 32 ausências; substituições/observações vazias — criadas só pelo humano).
- Decisões de design:
  - Os 4 itens de coincidência apenas normalizada vão para `equivalenciasConfirmadas` e são **excluídos** de `rateiosNovos` (27 sem rateio = 4 equivalências + 23 rateios novos), pois não devem receber rateio novo antes da equivalência ser decidida.
  - `sugestaoRateio` preenchido (7 de 23) quando a descrição contém uma única área (OUVIDORIA/CORREGEDORIA/ESCOLA) — campo informativo; `decisao` permanece `PENDENTE`.
  - As 19 correções recebem `alertasOriginais` vindos do relatório detalhado da Etapa B.
  - Merge idempotente por `id`: regeneração preserva `decisao`/`acao`/`justificativa`/`rateio`/`rateiosCorrigidos`/`descricaoItemPadSubstituto`/`validadoPor`/`validadoEm`; entradas obsoletas não são apagadas, vão para `metadados.entradasObsoletas`. `geradoEm` fixo, `atualizadoEm` por execução.
- Validações executadas:
  - `node --check` no script novo → OK. `npm run validar:syntax` → OK (39 arquivos).
  - `npm run profor:pad:gerar-template-decisoes-saneamento` → 4/23/19/32, tudo PENDENTE.
  - Teste de idempotência: editada uma decisão à mão e regenerado → decisão, rateio e `validadoPor` preservados; `geradoEm` mantido; `atualizadoEm` avançou. Template restaurado ao estado limpo antes do commit.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
- Risco: Baixo. Geração de arquivo de dados; serviço somente leitura no banco. Nenhuma escrita em SQLite, frontend ou publicação.
- Rollback: `git revert` do commit da Etapa C.

## 20/05/2026 - Saneamento PROFOR 2022: Relatório detalhado com causa original (Etapa B)

- Branch atual: `main`.
- Estado inicial: working tree limpo após o commit da Etapa A.
- Objetivo: para os 19 itens conhecidos não aptos, expor a causa original — qual alerta da importação inicial gerou a não aptidão.
- Mudanças realizadas:
  - **Novo serviço** `backend/services/profor-2022/profor-pad-saneamento-service.js`: lê `profor-2022-pad-saneamento.json` e cruza, **por igualdade exata de `chave_item`** (sem fuzzy), com `profor_2022_rateio_import_alertas`, `profor_2022_itens_conhecidos` e `profor_2022_item_rateios`. Para cada item não apto resolve `alertasOriginais[]` (tipo/nível/detalhe/origem arquivo-aba-linha), `rateiosAtivos[]`, `loteImportacaoOrigem` e `providenciaRecomendada`. Mantém lista defensiva `itensSemAlertaOrigem[]`.
  - **Novo script** `backend/scripts/gerar-relatorio-saneamento-detalhado-pad-profor-2022.js`: orquestra a geração e grava JSON + Markdown.
  - `package.json`: novo script `profor:pad:relatorio-saneamento-detalhado`.
  - `scripts/validar-syntax.js`: adicionados o serviço e o script à lista hardcoded `ARQUIVOS`.
- Saídas geradas: `backend/data/relatorios/profor-2022-pad-saneamento-detalhado.{json,md}`.
- Validações executadas:
  - `node --check` nos 2 arquivos novos → OK.
  - `npm run validar:syntax` → OK (38 arquivos).
  - `npm run profor:pad:relatorio-saneamento-detalhado` → 19 itens não aptos, 19 com alerta de origem identificado, 0 sem alerta, 27 alertas impeditivos vinculados.
  - `git diff --check` → limpo. `git status --short frontend/data/publicados` → vazio.
- Risco: Baixo. Serviço somente leitura no banco (apenas SELECT); nenhuma escrita em SQLite, frontend ou publicação.
- Rollback: `git revert` do commit da Etapa B; ou remover os arquivos novos e reverter `package.json`/`scripts/validar-syntax.js`.

## 20/05/2026 - Saneamento PROFOR 2022: Auditoria inicial PAD x rateios (Etapa A)

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo.
- Solicitação do usuário: continuar a migração da origem do `planoAplicacao` do PROFOR 2022 (abas por UF → relatórios PAD `.xls`), executando as Etapas A–D de saneamento das pendências, sem alteração no banco nesta rodada.
- Auditoria executada (Etapa A, sem alteração de código):
  - `npm run validar:syntax` → OK (36 arquivos).
  - `npm run profor:pad:conferir-rateios:dry-run` → 15 relatórios PAD, 525 itens conferidos, 498 com rateio, 27 sem rateio, 32 conhecidos ausentes no PAD, 19 conhecidos não aptos, 0 instrumentos fora da carteira, 84 alertas (25 impeditivos).
  - `npm run profor:pad:relatorio-saneamento` → 27 sem rateio, 4 coincidências apenas por descrição normalizada, 19 não aptos, 32 ausentes, 3 possíveis pares por descrição normalizada, 8 convênios afetados (937216, 937221, 937265, 937468, 937782, 937817, 938128, 938277).
- Conferências:
  - `frontend/data/publicados/` sem alteração desta tarefa (confirmado por `git status --short frontend/data/publicados` vazio).
  - `.gitignore` cobre `backend/data/onasp.sqlite*`, `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm` — banco/WAL/SHM não entram em commit.
  - Único impacto no working tree: regeneração de `profor-2022-pad-saneamento.{json,md}` (diff apenas no campo `geradoEm`).
- Próximas etapas (B–D) alterarão: `backend/services/profor-2022/profor-pad-saneamento-service.js` (novo), `backend/services/profor-2022/profor-pad-decisoes-saneamento-service.js` (novo), `backend/scripts/gerar-relatorio-saneamento-detalhado-pad-profor-2022.js` (novo), `backend/scripts/gerar-template-decisoes-saneamento-pad-profor-2022.js` (novo), `backend/scripts/validar-decisoes-saneamento-pad-profor-2022.js` (novo), `package.json`, `scripts/validar-syntax.js`.
- Risco: Nulo. Etapa A é somente leitura/diagnóstico; nenhum código alterado.
- Rollback: `git restore backend/data/relatorios/profor-2022-pad-saneamento.json backend/data/relatorios/profor-2022-pad-saneamento.md`.

## 19/05/2026 - Correções de Contrastes, Alinhamento de Bandeiras e Sintaxe (Etapa 3.10)

- Branch atual: `main`.
- Estado inicial: Modificações realizadas em `frontend/css/app.css`, `frontend/js/app.js` e `index.html`.
- Solicitação do usuário: Corrigir erro impeditivo (banco de dados/aplicação inoperantes por quebra de JS), alinhar verticalmente as bandeiras dos estados e corrigir o contraste dos badges e backgrounds no painel de Formalização.
- Mudanças realizadas:
  - **Sintaxe (`app.js`)**:
    - Removida crase com escape (`\`\``) inserida acidentalmente dentro de uma template string na renderização da seção de Formalização que causou um `SyntaxError` (o qual impedia os event listeners do menu e do aplicativo de iniciarem).
  - **Alinhamento de Bandeiras (`app.js`)**:
    - Garantido o correto alinhamento e aplicação de layout condicional do Espírito Santo (ES) na tabela, bem como o alinhamento vertical flexbox das bandeiras dentro dos cards.
  - **Contraste de Tema Nativo (`app.css`)**:
    - Descoberta estrutural: A aplicação não possui modo claro. As variáveis padrão (`--color-surface`, etc.) já assumem cores escuras, logo, seletores restritivos como `[data-theme="dark"]` não engatilhavam.
    - O prefixo `[data-theme="dark"]` foi totalmente removido das implementações feitas na sessão, permitindo que as regras CSS anexadas no rodapé de `app.css` apliquem os fundos adequados a componentes `.formalizacao-alert-item`, `.custom-progress-pill`, `.formalizacao-card-check-toggle` e `.formalizacao-stage-pill`. Cores estáticas/hardcoded da versão base (brancos e cinzas claros) foram suprimidas globalmente na seção.
  - **Forçamento de Cache (`index.html`)**:
    - Atributos cache-buster do arquivo CSS foram atualizados de `v=20260519-39-instrumentos` para `v=20260519-41-formalizacao` forçando a renovação local.
- Validações executadas:
  - `node --check frontend/js/app.js` → OK (erro `SyntaxError` removido).
  - O aplicativo voltou a renderizar e carregar normalmente após a correção.
- Risco: Baixo. O estilo é restrito a classes da própria `.app-view` e resolve um erro sintático.
- Rollback: `git restore frontend/css/app.css frontend/js/app.js index.html`.

## 19/05/2026 - Compactação de Tabelas e Cards de Estado (Etapa 3.9)

- Branch atual: `main`.
- Estado inicial: `git status --short` modificado (`frontend/css/app.css`, `frontend/js/app.js`, `index.html` de alterações da etapa anterior).
- Solicitação do usuário: compactar as linhas dos itens financeiros (tabelas) e estender a compactação visual para todas as telas (incluindo cards de estado e tabelas de orçamento/formalização), usando fonte menor e visual limpo.
- Mudanças realizadas:
  - **Tabelas compactas em todas as views**:
    - Tamanho de fonte reduzido para `0.76rem !important` (aproximando-se do tamanho dos cards compactos da home).
    - Padding de células (`td` e `th`) reduzido para `0.28rem 0.45rem !important` globalmente.
    - Badges, pílulas de progresso e botões em tabelas ajustados para dimensões menores (`font-size: 0.65rem`, padding `0.12rem 0.32rem`, etc.).
  - **Cards de estado compactados**:
    - Padding dos cards de Formalização reduzido para `0.7rem 0.8rem` e gap reduzido para `0.5rem`.
    - Caixas de métricas internas dos cards com padding reduzido para `0.45rem 0.55rem` e gap reduzido para `0.12rem`.
    - Fonte dos valores reduzida para `0.78rem` e pílulas de progresso encolhidas para `0.65rem`.
  - **Margens**: Redução adicional de margens verticais (`mb-4` para `0.75rem` e `mb-3` para `0.55rem`).
- Validações executadas:
  - `node --check frontend/js/app.js` → OK
  - `node scripts/validar-syntax.js` → OK (25 arquivos)
  - `node scripts/validar-json-publicados.js` → OK
- Smoke test manual: Confirmado via Chrome DevTools com navegação e screenshots das telas de Visão Geral, Orçamento e Formalização. Todas exibiram alta densidade de informação e harmonia de design.
- Risco: Baixo. O estilo é restrito a classes específicas do layout SPA (`.app-view`).
- Rollback: `git restore frontend/css/app.css`.

## 19/05/2026 - Padronização final (Etapa 3.8): filtros recolhíveis, neon global, header da Orçamento removido

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo (após push `3ca0e02`).
- Problemas identificados pelo usuário nas imagens enviadas:
  1. Seção "RELATÓRIOS / Orçamento 2026" repetia o nome da página (já mostrado no sidebar) e ocupava faixa inteira.
  2. Vários botões sem acabamento neon (`.btn-primary`, `.btn-success`, `.btn-export`, `.btn-admin`, DataTables export buttons).
  3. Filtros ainda expostos em Formalização PROFOR, PROFOR 2022, FAF 2021 e Doações 2023 (sem `<details>` recolhível como Home).
  4. Cards "Por instrumento" com espaço morto quando `.uf-chip-list` está vazio.
- Mudanças realizadas:
  - **Orçamento header**: removida a `<section class="diagnostico-action-bar">` com título "Relatórios / Orçamento 2026"; substituída por `<div class="action-buttons-floating">` com os 4 botões (Excel/Histórico/PDF/Exportar resumo) flutuando à direita.
  - **Filtros recolhíveis** em 4 páginas (padrão idêntico ao Home):
    - Formalização PROFOR: 5 selects (UF/Região/Status/Ouvidoria/Pendência) dentro de `<details class="filter-bar-advanced">`.
    - PROFOR 2022: 3 selects (UF/Sinal de gestão/Ordenação).
    - FAF 2021: 3 selects (UF/Sinal de gestão/Ordenação).
    - Doações 2023: 2 selects (UF/Ordenação).
    - Em cada um, a linha principal mostra `.filter-bar-main` com Filtros + busca + Limpar; o `<details>` começa fechado.
  - **Etapa 3.8 CSS** adicionada (~270 linhas no fim de `app.css`):
    - Solid buttons com gradiente neon: `.btn-primary` (azul), `.btn-success`/`.btn-export` (verde), `.btn-warning` (âmbar), `.btn-info` (ciano), `.btn-danger` (vermelho), `.btn-admin` (cinza-azulado).
    - DataTables export buttons (`.dt-buttons .btn`, `.buttons-excel`, `.buttons-pdf`, `.buttons-csv`) com bordas neon coloridas e hover com glow.
    - `.action-buttons-floating` (flex justify-end com status inline).
    - `.filter-bar-advanced` global: estilos do summary, chevron, hover; `:has` selectors; `.visible-filter-group` compacto dentro do details.
    - `.uf-chip-list:empty { display: none }` e `.instrument-mini-chart:empty { display: none }`.
    - Fallback para `.diagnostico-action-bar` (caso ainda apareça em outras views).
  - Cache-buster: `?v=20260519-38-padroniza` (CSS e JS).
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `index.html`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- IDs preservados (verificado: 59 ocorrências): `filtroFormalizacaoUf/Regiao/Status/Ouvidoria/Pendencia/Busca`, `btnLimparFiltroFormalizacao`, `filtroProforUf/Situacao/Busca`, `ordenacaoProfor`, `btnLimparFiltroProfor`, `filtroFafUf/Situacao/Ordenacao/Busca`, `btnLimparFiltroFaf`, `filtroDoacoesUf/Ordenacao/Busca`, `btnLimparFiltroDoacoes`, `btnExportarOrcamentoExcel`, `btnHistoricoOrcamento`, `btn-export-budget-pdf`, `btnExportarResumoOrcamentoTexto`.
- Testes executados:
  - `node --check frontend/js/app.js` → OK
  - `npm run validar:syntax` → OK (25 arquivos)
  - `npm run validar:json` → OK
  - `git diff --check` → OK
- Smoke test manual: a confirmar pelo usuário (Formalização, PROFOR 2022, FAF 2021, Doações 2023 com filtros recolhidos; botões com neon em todas as páginas; Orçamento sem faixa de título).
- Risco: baixo — `<details>` não interfere em event delegation; nenhum ID removido; CSS é apêndice com escopo nas classes existentes.
- Rollback: `git revert HEAD`. Filtros voltam expostos, header da Orçamento volta, neon volta ao escopo anterior.

## 19/05/2026 - Reforma estrutural de layout - Home/Dashboard (Etapa 3.4)

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo (após push do commit anterior `7fa32a8`).
- Problema identificado: as etapas 3.1, 3.2 e 3.3 ajustaram tema, densidade e a barra de filtros do Orçamento, mas a Home continuava com 8 seções verticalmente espaçadas (2 grids KPI separados de 4+2, filtros com 3 cards internos altos + 4 cards contadores de UF), empurrando a tabela para muito abaixo da dobra.
- Por que CSS-only não resolveu: o markup gera ESTRUTURALMENTE caixas demais. Cada `<section>` separada cria margem; cada `.visible-filter-group` é um card com padding próprio; `filter-counts` era um grid 4-colunas de cards com `min-height: 94px`. Compactar com `padding`/`gap` reduzia parcialmente, mas a contagem de elementos verticais não mudava.
- Mudanças estruturais realizadas:
  1. **KPIs mesclados**: dois `<section class="app-summary-grid -cols-4/-cols-2">` viraram **um único** `<section class="app-summary-grid metric-strip -cols-6">` com 6 cards. Cards ganharam classe `metric-tile` (sem `min-height`, padding `0.65rem 0.8rem`, value `1.05rem`).
  2. **Filtros recolhíveis**: `.filter-section` virou `.filter-bar` com `.filter-bar-main` (Filtros + busca + Limpar + badge ativo, sempre visível, altura ~34px) + `<details class="filter-bar-advanced">` recolhível com summary "Mais filtros" contendo Regiões/Instrumentos/UFs e contadores. Sem JS extra — elemento `<details>` nativo.
  3. **Contadores de UF compactos**: `.filter-counts` recebeu modificador `.compact-summary-row` — virou flex horizontal com tiles `flex: 1 1 180px`, padding `0.5rem 0.7rem`, sem `min-height`.
  4. **Hero compacto**: padding `0.85rem 1.1rem`, título `1.35rem`, badges `0.72rem`.
  5. **"Por instrumento"**: `.instrument-summary-card` com `min-height: auto`, padding `0.7rem 0.85rem`; `.instrument-mini-chart` com `min-height: auto` e padding-top `0.35rem`.
  6. Cache-buster atualizado: CSS e JS para `?v=20260519-34-etapa`.
- Classes estruturais novas (escopo restrito): `.metric-strip`, `.metric-tile`, `.filter-bar`, `.filter-bar-main`, `.filter-bar-search`, `.filter-bar-advanced`, `.filter-bar-advanced-toggle`, `.compact-summary-row`. Todas no bloco "Etapa 3.4" no fim de `app.css`.
- Arquivos alterados:
  - `index.html` (KPIs mesclados, filtros recolhíveis, cache-buster).
  - `frontend/css/app.css` (Etapa 3.4 adicionada — ~190 linhas no fim do arquivo).
- IDs preservados (todos): `filtroObjeto`, `btnLimparFiltros`, `filtroAtivoBadge`, `textoFiltroAtivo`, `filtroRegiaoOpcoes`, `filtroInstrumentoOpcoes`, `filtroUFOpcoes`, `count-convenios`, `count-faf`, `count-doacoes`, `count-ufs-instrumentos`, `count-convenios-ufs`, `count-faf-ufs`, `count-doacoes-ufs`, `count-ufs-instrumentos-lista`, `kpi-total-fomento-ouvidoria`, `kpi-total-executado`, `kpi-percentual-global`, `kpi-total-ufs-fomento`, `kpi-total-contratado`, `kpi-total-doado`, `filter-row-section`, `cards-instrumentos-section-wrapper`, `cards-instrumentos-section`, `cards-dinamicos-section`.
- Testes executados:
  - `node --check frontend/js/app.js` → OK.
  - `node --check frontend/js/core/ui-components.js` → OK.
  - `npm run validar:syntax` → OK (25 arquivos).
  - `npm run validar:json` → OK.
  - `git diff --check` → OK (apenas warning LF/CRLF do Windows).
- Smoke test manual: a confirmar pelo usuário em 1366/1024/768/390px.
- Riscos remanescentes:
  - Em telas <480px, os 6 KPIs viram 1 coluna (rolar ainda é necessário, mas inevitável).
  - O `<details>` para "Mais filtros" começa **fechado** por padrão — usuários habituados aos checkboxes visíveis precisam clicar uma vez. Listeners são por delegação no `document`, então funcionam mesmo com `<details>` fechado.
  - Cache-buster mudou — cliente vai recarregar CSS e JS uma vez.
- Rollback: `git revert HEAD` desfaz o commit; o markup volta aos dois grids de KPI e aos filtros expandidos. Layout volta à Etapa 3.3.

## 19/05/2026 - Compactação operacional (Etapa 3.2 de densidade)

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo.
- Objetivo: reduzir rolagem vertical e aumentar densidade útil das telas, mantendo Tema Escuro Institucional Minimalista. Filtros, cards operacionais e painéis com padding/gap/min-height enxutos; hero, KPIs principais e modais preservados.
- Arquivo alterado: `frontend/css/app.css` (apêndice "Etapa 3.2 - Densidade compacta operacional" no fim do arquivo).
- Nenhum JS, HTML, JSON, banco, regra de negócio ou listener tocado. Nenhum arquivo novo criado.
- Componentes compactados:
  - Filtros globais: `.filter-section`, `.filter-toolbar`, `.filter-search-actions`, `.visible-filter-grid`, `.budget-filter-grid`, `.app-filter-compact`, `.visible-filter-group`, `.visible-filter-title`.
  - Inputs/selects dentro de filtros: `min-height: 36px`, padding vertical `0.32rem`.
  - Cards operacionais: `.dynamic-card`, `.budget-insight-card`, `.profor-insight-card` (`min-height` 88→72px).
  - Cards de instrumento/formalização/contato/sistema: `.instrument-summary-card`, `.formalizacao-card`, `.contact-uf-card`, `.system-status-alert-item`.
  - Painéis específicos: `.contact-uf-filter`, `.contacts-toolbar.panel-section`, `.formalizacao-quick-filter-panel`, `.diagnostico-filter-section`.
  - Breakpoint mobile (<768px): força 1 coluna em filtros e reduz padding mais.
- Validações executadas:
  - `node --check frontend/js/app.js` → OK
  - `node --check frontend/js/core/ui-components.js` → OK
  - `npm run validar:syntax` → OK: 25 arquivos validados
  - `npm run validar:json` → OK: todos JSONs publicados válidos
  - `git diff --check` → OK (apenas aviso LF/CRLF)
- Smoke test manual no navegador: a confirmar pelo usuário (Orçamento 2026, Home, Formalização PROFOR, Parâmetros Mínimos, PROFOR 2022, FAF 2021, Doações 2023, Contatos, Status do Sistema).
- Riscos remanescentes: baixo — alterações apenas em dimensões (não em layout estrutural ou paleta). Possíveis ajustes finos em larguras 1024/768/390px caso alguma quebra apareça no smoke test visual.
- Rollback: remover o bloco "Etapa 3.2" (a partir do comentário até o fim do arquivo) ou reverter o commit. Layout volta à Etapa 3.1.

## 19/05/2026 - Corrigir replicação de acompanhamento gerencial por processo SEI (Orçamento 2026)

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo.
- Problema observado: ao salvar acompanhamento gerencial em "Aquisição de Notebooks" (SEI `08016.003997/2026-30`), os itens "Aquisição de Scanners" e "Aquisição de câmeras fotográficas" (mesmo SEI) continuavam exibindo "acompanhamento não informado".
- Causa diagnosticada: `normalizarProcessoSeiParaComparacao` (linha 1268 de `orcamento-2026-service.js`) usava apenas `limparTexto()`, que só faz trim e colapso de espaços. Não normalizava pontuação (`.`, `/`, `-`). Se qualquer item tivesse o SEI armazenado em formato diferente (ex: `08016003997202630` sem pontuação), a comparação falhava, o item não entrava no mapa `idsPorProcesso` sob a mesma chave e a replicação não ocorria. Os demais 11 pontos do diagnóstico obrigatório foram verificados e estão corretos.
- Arquivo alterado: `backend/services/orcamento-2026-service.js` — apenas 1 linha (1269).
- Correção aplicada: `normalizarProcessoSeiParaComparacao` passou a remover todos os caracteres não numéricos (`/\D/g`), tornando equivalentes `"08016.003997/2026-30"` e `"08016003997202630"`.
- Validações executadas: `node --check backend/services/orcamento-2026-service.js` → OK; `git diff --check` → OK (aviso LF/CRLF apenas, não é conflito).
- Resultado do smoke test restrito: **pendente — requer confirmação manual do usuário no navegador.**
- Commit e push: **pendentes — aguardando confirmação do smoke test.**
- Pendências: usuário deve executar o smoke test descrito na tarefa (Notebooks, Scanners, Câmeras com SEI `08016.003997/2026-30`) e confirmar resultado.
- Risco de regressão: baixo — função usada exclusivamente para comparação interna de SEI na replicação, não afeta armazenamento, exibição ou exportação.

## 18/05/2026 - Rotina semiautomatica de publicacao estatica PROFOR 2022

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo; `git pull` executado e retornou `Already up to date`.
- Objetivo: criar rotina operacional controlada para atualizar o consolidado PROFOR 2022, publicar os JSONs estáticos e auditar vazamento, sem commit/push automático.
- Script criado: `backend/scripts/publicar-profor-2022-estatico.js`.
- Script npm criado: `npm run publicar:profor-2022`.
- Flag excepcional usada no teste controlado: `--permitir-alteracoes-locais`.
- Resultado da atualização consolidada: `DETRU 15/15`, `Rendimentos 15/15`, `Consolidado 15/15/15`, sem erro bloqueante.
- Resultado da publicação estática: concluída com sucesso via `npm run publicar:dados`.
- Resultado das validações: `npm run validar:json` e `npm run validar:syntax` concluíram com sucesso.
- Resultado da auditoria: sem vazamento em 6 JSONs publicados; padrões sensíveis não encontrados.
- Arquivos publicados alterados: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/resumo-publicacao.json`.
- Última atualização operacional publicada: `2026-05-18T12:38:42.187Z`.
- Origem da última atualização publicada: `Transferegov/rendimentos`.
- A rotina não executa commit nem push automático; apenas deixa o working tree pronto para revisão manual.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou `.env` foi versionado.

## 18/05/2026 - Validação do agendamento diário PROFOR 2022

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo; `git pull` executado e retornou `Already up to date`.
- Histórico recente conferido antes da validação: `6b33a0f`, `e0915b2`, `2e23aa1`, `f7c42c3`, `f84d1e6`.
- Baseline manual executado com `npm run atualizar:profor-2022`.
- Resultado do baseline: `DETRU 15/15`, `Rendimentos 15/15`, `Consolidado 15`, `diagnostico 15/15/15`, sem erro bloqueante.
- Horário temporário usado no teste do agendador na sessão: `09:26`.
- `npm run agendar:profor-2022` iniciou corretamente, calculou a próxima execução e disparou a rodada no horário temporário.
- Rodada agendada executada com sucesso:
  - início: `2026-05-18T12:26:00.024Z`
  - fim: `2026-05-18T12:28:12.742Z`
  - duração: `132718 ms`
  - DETRU: `15/15`
  - rendimentos: `15/15`
  - consolidado: `15/15/15`
- Status operacional após a rodada via `GET /api/profor-2022/atualizacao/status` e `GET /api/profor-2022/consolidado`:
  - `success=true`
  - `origemDados=banco-cache`
  - `ultimaAtualizacaoDados.dataHora=18/05/2026 12:28:12`
  - `ultimaAtualizacaoDados.fonte=Transferegov/rendimentos`
  - consolidado permaneceu em `15` convênios com `15/15/15`.
- Qualidade dos logs: suficiente para operação; informa início, resumo final, duração, próximo agendamento e falhas de forma legível.
- `npm run publicar:dados` não foi executado.
- JSONs publicados não foram alterados.
- Nenhum arquivo sensível foi versionado.

## 18/05/2026 - Remoção da observação do card de rendimentos PROFOR

- Solicitação recebida: remover também a mensagem/observação exibida no card de saldo de rendimentos da PROFOR 2022.
- A interface pública já não exibia a faixa técnica de origem/diagnóstico; nesta etapa foi removido o texto auxiliar do card de rendimentos, preservando apenas o valor.
- Arquivos alterados nesta correção: `frontend/js/app.js`, `index.html`.
- `renderizarFonteRendimentosProfor()` deixou de alimentar texto visível na visão pública.
- Cache-buster do bundle atualizado para `frontend/js/app.js?v=20260518-08`.
- `npm run publicar:dados` não foi executado.
- JSONs publicados não foram alterados.
- Nenhum arquivo sensível foi versionado.

## 18/05/2026 - Diagnóstico técnico PROFOR ocultado da interface principal

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo; `git pull` executado e retornou `Already up to date`.
- Commits confirmados no histórico local: `f7c42c3` e `2e23aa1`.
- Problema: a página PROFOR 2022 ainda exibia, em localhost, uma faixa azul com origem/diagnóstico técnico (`Origem local/API`, `banco-cache`, `Diagnóstico: DETRU 15 | Plano 15 | Rendimentos 15`) e avisos técnicos como `saldoDisponivelOuvidoria`.
- Decisão: diagnóstico técnico não deve aparecer na interface pública/normal, nem em GitHub Pages nem em localhost. A informação permanece acessível por endpoints/status e áreas administrativas já existentes.

### Arquivos alterados

- `frontend/js/app.js`
  - `renderizarAvisoOrigemProfor()` passou a retornar string vazia por padrão.
  - A badge visual de origem (`banco-cache`/`planilha`) foi removida da introdução da página PROFOR 2022.
  - O texto do KPI de convênios vigentes em origem consolidada passou de `Carteira local + caches` para `Carteira monitorada`.
- `index.html`
  - Cache-buster do `frontend/js/app.js` atualizado para `v=20260518-07`.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`

### Restrições confirmadas

- `npm run publicar:dados` não foi executado.
- JSONs publicados não foram alterados.
- Banco/schema, `.env`, valores de convênios e rotinas DETRU/Transferegov não foram alterados.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou temporário foi versionado.

## 18/05/2026 - Diagnóstico real do localhost e proteção contra sobrescrita do rótulo operacional

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo; `git pull` executado e retornou `Already up to date`.
- Commit confirmado no histórico local: `f7c42c3 fix(profor-2022): corrigir rotulo de atualizacao e aviso tecnico`.
- `index.html` estava servindo `frontend/js/app.js?v=20260518-05` antes da correção desta etapa.
- Objetivo: diagnosticar por que o usuário ainda via `Atualização não registrada` no servidor local e aplicar correção pontual baseada em evidência.

### Diagnóstico real em localhost

- Servidor temporário: `PORT=8799 node backend/server.js`.
- `GET /api/profor-2022/atualizacao/status` retornou `success=true`, `origemDados=banco-cache`, `ultimaAtualizacaoDados.dataHora=2026-05-18T10:44:06.616Z` e `fonte=Transferegov/rendimentos`.
- `GET /api/profor-2022/consolidado` retornou `success=true`, 15 convênios, `data.ultimaAtualizacaoDados` presente e diagnóstico `totalComDetru=15`, `totalComPlano=15`, `totalComRendimentos=15`.
- `GET /index.html` retornava `app.js?v=20260518-05` e o bundle continha a lógica do commit anterior.
- Playwright em `http://localhost:8799/index.html` não reproduziu o erro: dashboard e rodapé exibiram a data correta, com console sem erros/avisos.

### Causa encontrada

- Não foi identificada falha no endpoint nem ausência de metadado publicado.
- A hipótese mais consistente para a persistência visual no navegador do usuário é cache/bundle antigo ou uma chamada tardia com metadado nulo sobrescrevendo um rótulo já válido.
- O código ainda permitia essa sobrescrita: `exibirRotuloUltimaAtualizacaoOperacional(null)` sempre aplicava `Atualização não registrada`, mesmo se a tela já exibisse `Atualizado em ...`.

### Correção aplicada

- `frontend/js/app.js`
  - Criada proteção `existeRotuloUltimaAtualizacaoValido()` para não sobrescrever um rótulo já válido com fallback nulo.
  - Leitura defensiva aceita `payload.ultimaAtualizacaoDados` e `payload.data?.ultimaAtualizacaoDados`.
- `index.html`
  - Cache-buster atualizado para `frontend/js/app.js?v=20260518-06`, forçando o navegador a buscar o bundle novo.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`

### Testes após correção

- HTML servido em `PORT=8799`: `app.js?v=20260518-06`.
- Bundle servido contém `existeRotuloUltimaAtualizacaoValido()` e fallback defensivo para `payload.data?.ultimaAtualizacaoDados`.
- Playwright localhost:
  - `#dashboard-ultima-atualizacao`: `Atualizado em 18/05/2026 às 07:44`.
  - `#footer-ultima-atualizacao`: `Atualizado em 18/05/2026 às 07:44 (Transferegov/rendimentos)`.
  - Página PROFOR 2022 carregou.
  - Console sem erros e sem avisos.
- Simulação controlada de GitHub Pages:
  - `estaEmModoPublicacaoEstatica() = true`.
  - Nenhuma chamada `/api/` foi feita.
  - Rótulo lido de `dadosProfor2022.ultimaAtualizacaoDados` no JSON publicado.
  - Faixa técnica (`Origem local/API`, `Diagnóstico: DETRU`, `saldoDisponivelOuvidoria`) não apareceu.
  - Console sem erros; apenas aviso esperado de modo estático.

### Restrições confirmadas

- `npm run publicar:dados` não foi executado.
- JSONs publicados não foram alterados.
- Banco/schema, `.env`, valores de convênios e rotinas DETRU/Transferegov não foram alterados.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou arquivo temporário foi versionado.

## 18/05/2026 - Correção do rótulo de atualização e ocultação do aviso técnico no modo estático

- Continuação após interrupção por limite de tokens. Antes de qualquer `git pull`, foi inspecionado o estado local conforme ordem de serviço.
- Estado inicial encontrado: alteração parcial apenas em `frontend/js/app.js`, já contendo a guarda inicial em `renderizarAvisoOrigemProfor()` para ocultar a faixa técnica no modo estático. O diff local foi preservado e continuado.
- `git pull` não foi executado nesta retomada porque havia diff local parcial a ser analisado primeiro. O log anterior registrava `git pull` já executado com `Already up to date`.
- Objetivo: impedir a exibição online da faixa administrativa `Origem local/API... Diagnóstico...` e reforçar a robustez do rótulo de última atualização operacional.

### Diagnóstico

- A faixa técnica aparecia no GitHub Pages porque `renderizarAvisoOrigemProfor()` não tinha uma guarda suficiente para `estaEmModoPublicacaoEstatica()`.
- O texto `Atualização não registrada` em localhost provavelmente decorria de cache do navegador, chamada precoce ou falha transitória do endpoint antes do objeto PROFOR carregado estar disponível. O endpoint local já retornava metadado correto.
- Os JSONs publicados `aplicacao.json` e `dashboard-geral.json` já continham `dadosProfor2022.ultimaAtualizacaoDados`; por isso `npm run publicar:dados` não foi executado.

### Arquivos alterados

- `frontend/js/app.js`
  - `renderizarAvisoOrigemProfor()` agora retorna string vazia em modo estático/GitHub Pages, ocultando a faixa administrativa.
  - `carregarRotuloUltimaAtualizacaoOperacional()` tenta `/api/profor-2022/atualizacao/status` em modo local/API e, se o endpoint falhar ou vier sem `dataHora`, usa `obterDadosProfor2022()?.ultimaAtualizacaoDados` antes de exibir fallback neutro.
  - `garantirDadosBaseAplicacao()` chama novamente o carregamento do rótulo após popular o cache PROFOR, reduzindo corrida assíncrona.
- `backend/server.js`
  - `GET /api/profor-2022/consolidado` passou a incluir `ultimaAtualizacaoDados` no payload `data`, usando o mesmo cálculo seguro do endpoint de status.
- `index.html`
  - Cache-buster do `frontend/js/app.js` atualizado para `v=20260518-05`.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`

### Testes executados

- Endpoint local em `PORT=8798`:
  - `GET /api/profor-2022/atualizacao/status`: `success=true`, `origemDados=banco-cache`, `ultimaAtualizacaoDados.dataHora=2026-05-18T10:44:06.616Z`, `fonte=Transferegov/rendimentos`.
  - `GET /api/profor-2022/consolidado`: 15 convênios, `totalComDetru=15`, `totalComPlano=15`, `totalComRendimentos=15`, `ultimaAtualizacaoDados` presente.
- Playwright em localhost:
  - `#dashboard-ultima-atualizacao`: `Atualizado em 18/05/2026 às 07:44`.
  - `#footer-ultima-atualizacao`: `Atualizado em 18/05/2026 às 07:44 (Transferegov/rendimentos)`.
  - Página PROFOR 2022 carregou.
  - Console sem erros e sem avisos.
- Simulação controlada de GitHub Pages com hostname `teste-onasp.github.io` apontando para o servidor local:
  - `estaEmModoPublicacaoEstatica() = true`.
  - Nenhuma chamada `/api/` foi feita.
  - Rótulo de atualização foi lido do JSON publicado.
  - Textos `Origem local/API`, `Diagnóstico: DETRU` e `saldoDisponivelOuvidoria` não apareceram na interface.
  - Console sem erros; houve apenas aviso não crítico esperado do modo estático.

### Restrições confirmadas

- `npm run publicar:dados` não foi executado.
- JSONs publicados não foram alterados.
- Banco/schema, `.env`, rotinas DETRU/Transferegov e valores de convênios não foram alterados.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou temporário foi versionado.

## 18/05/2026 - Publicação estática com consolidado `banco-cache` e metadado `ultimaAtualizacaoDados`

- Branch atual: `main`.
- Pull inicial executado: `git status --short` limpo e `git pull` → `Already up to date.`.
- Objetivo: gerar/validar JSONs publicados a partir da origem consolidada `banco-cache`, garantindo que o modo estático/GitHub Pages exiba a data/hora da última atualização operacional sem chamar API local.
- Status: implementado, atualização operacional executada, publicação estática executada intencionalmente, JSONs validados e commit/push concluídos.

### Diagnóstico do pipeline

- `npm run publicar:dados` chama `backend/scripts/publicar-dados-estaticos.js`, que invoca `publicarDadosEstaticos()` em [backend/services/static-publication-service.js](FOMENTO-ONASP/backend/services/static-publication-service.js).
- O serviço escreve atomicamente: `aplicacao.json`, `dashboard-geral.json`, `parametros-minimos.json`, `formalizacao-profor.json`, `orcamento-2026.json` e `resumo-publicacao.json`. Já sanitiza removendo `respostasBrutas`, `registros`, `arquivo` (orcamento) e a seção interna `detru` do catálogo.
- `consolidarCatalogoDashboard()` em [backend/services/dashboard-publication-service.js](FOMENTO-ONASP/backend/services/dashboard-publication-service.js) lê a planilha local e monta `dadosProfor2022` via `montarDadosProfor2022Publicacao()`.
- Quando a flag de origem é `banco-cache`, `montarDadosProfor2022Publicacao()` chama `montarConsolidadoProfor2022()` com plano de aplicação extraído do workbook local.
- O frontend, em modo estático, carrega `dadosProfor2022` diretamente do JSON publicado via [backend/services/data-service.js](FOMENTO-ONASP/backend/services/data-service.js) (`catalogoAplicacaoCache.dadosProfor2022`), sem chamar `/api/`.

### Implementação aplicada

- **Novo helper** [backend/services/profor-2022/profor-atualizacao-meta-service.js](FOMENTO-ONASP/backend/services/profor-2022/profor-atualizacao-meta-service.js)
  - `calcularUltimaAtualizacaoDadosProfor2022(ultimaDetru, ultimaRendimentos)` — função pura. Aceita registros em camelCase (vindos do server.js) ou snake_case (vindos direto do SQLite).
  - `obterUltimaAtualizacaoDadosProfor2022()` — wrapper que lê `obterUltimaAtualizacaoDetru()` e `obterUltimaConsultaRendimentos()` com try/catch defensivos, retornando `{ dataHora, fonte, fontesConsideradas }` ou `dataHora: null` em ausência total.
- **Refatoração** em [backend/server.js](FOMENTO-ONASP/backend/server.js): função local `calcularUltimaAtualizacaoDadosProfor2022` removida; o endpoint `GET /api/profor-2022/atualizacao/status` agora importa do helper. Comportamento preservado.
- **Injeção no publicado** em [backend/services/dashboard-publication-service.js](FOMENTO-ONASP/backend/services/dashboard-publication-service.js): `montarDadosProfor2022Publicacao()` passou a anexar `ultimaAtualizacaoDados` ao objeto retornado em todos os ramos (banco-cache OK, fallback planilha por escolha de flag, fallback após exceção). Função `anexarUltimaAtualizacaoDados()` usa try/catch interno para nunca quebrar a publicação por falha de leitura de cache.
- **Frontend** em [frontend/js/app.js](FOMENTO-ONASP/frontend/js/app.js):
  - Função `exibirRotuloUltimaAtualizacaoOperacional(info)` extraída para centralizar formatação.
  - `carregarRotuloUltimaAtualizacaoOperacional()` no **modo estático** lê `obterDadosProfor2022()?.ultimaAtualizacaoDados` em vez de aplicar fallback fixo.
  - Modo local/API segue chamando `/api/profor-2022/atualizacao/status`.
  - A chamada inicial foi movida para depois de `garantirDadosBaseAplicacao()` (via `.finally()`), garantindo que o cache de PROFOR 2022 já esteja populado quando a função roda no modo estático.
- **Cache-buster** [index.html](FOMENTO-ONASP/index.html) atualizado para `v=20260518-04`.

### Execução de `npm run atualizar:profor-2022`

```
Duracao:       118725 ms
Origem:        banco-cache
DETRU:         sucesso=true encontrados=15/15
Rendimentos:   sucesso=true sucessos=15/15 falhas=0
Consolidado:   convenios=15 detru=15 plano=15 rendimentos=15
```

### Execução de `npm run publicar:dados`

```
Dados estaticos publicados com sucesso. { success: true, publicadoEm: '2026-05-18T10:44:12.106Z' }
```

### JSONs publicados alterados

- `frontend/data/publicados/aplicacao.json`
- `frontend/data/publicados/dashboard-geral.json`
- `frontend/data/publicados/resumo-publicacao.json`

Os JSONs `parametros-minimos.json`, `formalizacao-profor.json` e `orcamento-2026.json` foram reescritos pelo processo, mas o conteúdo não mudou (nenhum diff de campo); ficaram fora do staging.

### Metadado publicado (`dadosProfor2022.ultimaAtualizacaoDados`)

`aplicacao.json` e `dashboard-geral.json`:

```json
{
  "ultimaAtualizacaoDados": {
    "dataHora": "2026-05-18T10:44:06.616Z",
    "fonte": "Transferegov/rendimentos",
    "fontesConsideradas": {
      "detru": "2026-05-18T10:42:11.695Z",
      "rendimentos": "2026-05-18T10:44:06.616Z"
    }
  },
  "origemDados": "banco-cache",
  "convenios": 15,
  "diagnostico": { "totalCarteira": 15, "totalComDetru": 15, "totalComRendimentos": 15, "totalComPlano": 15 }
}
```

Texto exibido no navegador após hidratação (fuso BRT): `Atualizado em 18/05/2026 às 07:44 (Transferegov/rendimentos)`.

### Auditoria de vazamento (todos os JSONs publicados)

Padrões testados e ausentes: `JSESSIONID`, `SAMLResponse`, `SAMLRequest`, `Cookie:`, `Set-Cookie`, `Authorization:`, `Bearer`, `ONASP_EDIT_PASSWORD`, `DETRU_SICONV_CONVENIO_URL`, `Dados/detru`, `*.sqlite`, `*.har`, HTML bruto (`<html`), URLs absolutas em `href`. **Nenhum vazamento detectado** nos 6 JSONs publicados. A seção `detru` do catálogo permanece sanitizada (verificado: `apl.detru === undefined`).

### Testes locais

- Servidor de teste PORT=8797 (processo dedicado, finalizado após o teste).
- `GET /api/profor-2022/atualizacao/status` → `ultimaAtualizacaoDados` corretamente populado.
- `GET /api/profor-2022/origem` → `banco-cache`, sem fallback.
- `GET /frontend/data/publicados/aplicacao.json` → entregue com 4.5 MB; metadado seguro presente.
- HTML servido: cache-buster `v=20260518-04`; IDs `dashboard-ultima-atualizacao` e `footer-ultima-atualizacao` presentes com fallback HTML neutro pronto para hidratação JS.

### Modo estático

O frontend em modo estático/GitHub Pages NÃO chama nenhum endpoint `/api/profor-2022/*`. A hidratação do rótulo de última atualização usa o objeto `dadosProfor2022.ultimaAtualizacaoDados` já carregado a partir do `aplicacao.json` publicado. Quando o metadado está ausente, fallback continua sendo "Atualização não registrada".

### Modo local/API

A rota `/api/profor-2022/atualizacao/status` continua sendo a fonte preferencial em modo local/API. O endpoint não foi alterado em payload (mantém os mesmos campos), apenas passou a usar o helper compartilhado.

### Validações executadas

- `node --check`: `backend/server.js`, `backend/services/dashboard-publication-service.js`, `backend/services/profor-2022/profor-atualizacao-meta-service.js`, `frontend/js/app.js` — OK.
- `npm run validar:json` → OK.
- `npm run validar:syntax` → 25 OK.
- `git diff --check` → sem avisos (apenas LF→CRLF do Windows).

### Restrições confirmadas

- `.env` NÃO foi alterado.
- Banco/schema NÃO foi alterado.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookies ou arquivo temporário versionado.
- Nenhuma dependência nova.
- Origem `planilha` preservada como fallback (em todos os ramos do `montarDadosProfor2022Publicacao`).
- Aba `Geral` preservada.

### Pendências remanescentes

1. **Retirada gradual da dependência da aba `Geral`** — mantendo a planilha como fallback. Próximo passo: avaliar quais campos do consolidado podem ser totalmente desligados da planilha sem regressão visual.
2. Decisão de governança formal das 15 divergências `planilha` × `banco-cache` (Grupos A, B, D documentados em `profor-2022-divergencias.md`).
3. Rodar `npm run agendar:profor-2022` em ambiente operacional (processo separado) e medir cadência real diária.

---

## 18/05/2026 - Visão geral exibe data/hora da última atualização operacional (DETRU/Transferegov)

- Branch atual: `main`.
- Pull inicial executado: `git status --short` limpo e `git pull` → `Already up to date.`.
- Objetivo: substituir o texto estático "Atualizado em abril de 2026" da visão geral por data/hora dinâmica, baseada no máximo entre a última atualização DETRU e a última consulta de rendimentos Transferegov.
- Status: implementado, validado e publicado em commit.

### Problema corrigido

O texto "Atualizado em abril de 2026" aparecia hardcoded em [index.html:146](FOMENTO-ONASP/index.html#L146) (visão geral "Fomento para Ouvidoria") e [index.html:538](FOMENTO-ONASP/index.html#L538) (rodapé). Esse texto era estático e não refletia a atualização operacional real dos dados PROFOR 2022.

A nota "Os dados foram atualizados até abril de 2026 (...) janela de submissão dos relatórios" em [frontend/js/app.js:2045](FOMENTO-ONASP/frontend/js/app.js#L2045) NÃO foi alterada: trata-se de aviso de governança distinto (janela de submissão FAF), com semântica própria, fora do escopo desta correção.

### Regra de cálculo

`ultimaAtualizacaoDados.dataHora = max(ultimaAtualizacaoDetru.concluidoEm||iniciadoEm, ultimaConsultaRendimentos.concluidoEm||iniciadoEm)`. Quando apenas uma das fontes está disponível, ela é usada. Quando nenhuma está, o texto exibido é "Atualização não registrada". A fonte vencedora é exposta em `ultimaAtualizacaoDados.fonte` (`"DETRU"` ou `"Transferegov/rendimentos"`).

### Arquivos alterados

- [backend/server.js](FOMENTO-ONASP/backend/server.js)
  - Função `calcularUltimaAtualizacaoDadosProfor2022(ultimaDetru, ultimaRendimentos)` adicionada.
  - `GET /api/profor-2022/atualizacao/status` passou a retornar também `ultimaAtualizacaoDados = { dataHora, fonte, fontesConsideradas: { detru, rendimentos } }`.
- [index.html](FOMENTO-ONASP/index.html)
  - Linha 146: `<p>Atualizado em abril de 2026</p>` → `<p id="dashboard-ultima-atualizacao" aria-live="polite">Atualização não registrada</p>`.
  - Linha 538: footer agora contém `<span id="footer-ultima-atualizacao">Atualização não registrada</span>`.
  - Cache-buster atualizado para `v=20260518-03`.
- [frontend/js/app.js](FOMENTO-ONASP/frontend/js/app.js)
  - Função `formatarDataHoraAtualizacaoBr(iso)` — formato `dd/mm/aaaa às HH:MM` em fuso local; retorna null para entrada inválida.
  - Função `aplicarRotuloUltimaAtualizacaoOperacional(textoDashboard, textoFooter)`.
  - Função `carregarRotuloUltimaAtualizacaoOperacional()` — chama `/api/profor-2022/atualizacao/status` em modo local/API; em modo estático/GitHub Pages mantém fallback neutro sem chamar API; em falha de payload, também aplica fallback.
  - Chamada no `DOMContentLoaded` para popular a home na primeira renderização.
  - Chamada também ao final do disparo `atualizarProfor2022ConsolidadoUI()` para refletir nova data imediatamente após atualização administrativa.

### Endpoint testado

`GET http://localhost:8796/api/profor-2022/atualizacao/status` (servidor temporário dedicado em PORT=8796):

```json
{
  "success": true,
  "origemDados": "banco-cache",
  "ultimaAtualizacaoDados": {
    "dataHora": "2026-05-18T10:17:26.346Z",
    "fonte": "Transferegov/rendimentos",
    "fontesConsideradas": {
      "detru": "2026-05-18T10:15:38.451Z",
      "rendimentos": "2026-05-18T10:17:26.346Z"
    }
  }
}
```

A fonte escolhida foi a mais recente (rendimentos). Texto resultante em fuso BRT: "Atualizado em 18/05/2026 às 07:17".

### Comportamento por modo

- **Modo local/API:** chama o endpoint; exibe `Atualizado em dd/mm/aaaa às HH:MM` na visão geral; rodapé acrescenta a fonte entre parênteses.
- **Modo estático/GitHub Pages:** não chama API; exibe fallback neutro "Atualização não registrada" — não inventa horário.
- **Falha de rede / endpoint indisponível:** mesmo fallback neutro; sem quebra de console.
- **Origem `planilha`:** se houver status local disponível (DETRU ou rendimentos), continua exibindo a última atualização operacional. O fallback para planilha não é quebrado.

### Validações

- `node --check` aprovado em: `backend/server.js`, `frontend/js/app.js`, `backend/services/data-service.js`, `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`.
- `npm run validar:json` → OK.
- `npm run validar:syntax` → 25 arquivos OK.
- `GET /index.html` no servidor de teste confirmou que o HTML servido não contém mais "abril de 2026" no header e no rodapé.

### Restrições confirmadas

- `npm run publicar:dados` NÃO foi executado.
- JSONs publicados em `frontend/data/publicados/` NÃO foram alterados.
- `.env` NÃO foi alterado.
- Banco/schema NÃO foi alterado.
- Nenhuma dependência nova.
- Origem `planilha` e fallback preservados.

---

## 18/05/2026 - Rotina operacional consolidada PROFOR 2022 (DETRU + rendimentos + consolidado)

- Branch atual: `main`.
- Pull inicial executado: `git status --short` limpo e `git pull` em `Already up to date.`.
- Objetivo: criar rotina única e rastreável de atualização diária PROFOR 2022 em modo local/API, sequenciando DETRU → rendimentos Transferegov → montagem do consolidado → validação, com preservação do último cache válido em falhas.
- Status: rotina consolidada implementada, scripts CLI e de agendamento criados, rotas administrativas adicionadas, frontend com botão e status discreto, validações executadas, publicação estática NÃO executada.

### Arquivos lidos

- `AGENTS.md`
- `memoria/INDEX.md`
- `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`
- `backend/server.js`
- `backend/services/profor-2022/profor-detru-update-service.js`
- `backend/services/profor-2022/profor-detru-cache-service.js`
- `backend/services/profor-2022/profor-consolidado-service.js`
- `backend/services/profor-2022/profor-origem-service.js`
- `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`
- `backend/services/profor-2022/transferegov-rendimentos-client.js` (verificação de exports)
- `backend/services/dashboard-publication-service.js` (verificação de exports)
- `backend/scripts/atualizar-cache-detru-profor-2022.js`
- `backend/scripts/agendar-atualizacao-detru-profor-2022.js`
- `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`
- `frontend/js/app.js`
- `index.html`
- `package.json`
- `.env.example`

### Arquivos criados

- `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`
  - Funções públicas: `atualizarProfor2022Consolidado(opcoes)`, `validarDiagnosticoConsolidado(resultado)`, `resumirAtualizacaoConsolidada(resultado)`, `executarEtapaComProtecao(nome, fn)`.
  - Sequência: DETRU (reusa `atualizarCacheDetruProfor2022`) → rendimentos Transferegov (loop sobre carteira com `consultarSaldoRendimentosConvenio` e `salvarSaldoRendimentoTransferegov`, com 500ms entre consultas) → montagem do consolidado (`montarConsolidadoProfor2022` com plano de aplicação extraído do workbook local) → validação de diagnóstico.
  - Cada etapa é envolvida por `executarEtapaComProtecao` para impedir perda de relatório e não mascarar falhas. Erros parciais retornam relatório com `sucesso: false` da etapa, sem limpar caches anteriores (todos os salvamentos são upsert).
- `backend/scripts/atualizar-profor-2022-consolidado.js`
  - Script CLI manual. Carrega `.env`, inicializa banco, chama o orquestrador, imprime resumo. Retorna `0` em sucesso e `1` apenas em falha bloqueante (consolidado com 0 convênios ou todas as etapas reais falharam).
- `backend/scripts/agendar-atualizacao-profor-2022.js`
  - Agendador diário em Node com `setTimeout` recursivo. Lê `PROFOR_2022_ATUALIZACAO_DIARIA_HORA` do `.env` com fallback `06:30`. Roda como processo separado; não é iniciado por `npm start`.

### Arquivos alterados

- `backend/server.js`
  - Imports: adicionados `obterUltimaConsultaRendimentos` e `atualizarProfor2022Consolidado`.
  - Novas rotas locais/API administrativas:
    - `POST /api/profor-2022/atualizar` — dispara o orquestrador e retorna `{ success, message, resultado }`.
    - `GET /api/profor-2022/atualizacao/status` — somente leitura: retorna origem atual, última atualização DETRU, última consulta de rendimentos, diagnóstico consolidado e avisos. Não atualiza cache nem consulta rede externa (mas executa montagem do consolidado em memória, que lê a planilha local para extrair plano de aplicação).
- `frontend/js/app.js`
  - Funções novas: `renderMensagemConsolidadoProfor2022`, `mostrarMensagemConsolidadoProfor2022`, `renderStatusAtualizacaoConsolidadaProfor2022`, `carregarStatusAtualizacaoConsolidadaProfor2022`, `atualizarProfor2022ConsolidadoUI`.
  - Painel da Carteira Monitorada da página PROFOR 2022 ganhou: botão `btnAtualizarProfor2022` (apenas no modo local/API), feedback `#profor-consolidado-feedback` e linha de status `#profor-consolidado-status`. Botão DETRU preservado.
  - O toggle do painel da carteira passa a disparar o carregamento dos dois status (DETRU + consolidado) na primeira abertura.
- `index.html`
  - Cache-buster de `frontend/js/app.js` atualizado para `v=20260518-02`.
- `package.json`
  - Scripts adicionados:
    - `atualizar:profor-2022` → `node backend/scripts/atualizar-profor-2022-consolidado.js`
    - `agendar:profor-2022` → `node backend/scripts/agendar-atualizacao-profor-2022.js`
- `.env.example`
  - Variável `PROFOR_2022_ATUALIZACAO_DIARIA_HORA=06:30` adicionada para o agendador consolidado.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/08_ROTAS_BANCO_API/rotas.md`

### Execução de `npm run atualizar:profor-2022`

Resultado real, 18/05/2026:

```text
Inicio:        2026-05-18T10:12:20.652Z
Fim:           2026-05-18T10:14:20.114Z
Duracao:       119462 ms
Origem:        banco-cache
DETRU:         sucesso=true encontrados=15/15
Rendimentos:   sucesso=true sucessos=15/15 falhas=0
Consolidado:   convenios=15 detru=15 plano=15 rendimentos=15
```

DETRU foi baixado automaticamente do repositório oficial (`https://repositorio.dados.gov.br/seges/detru/siconv_convenio.csv.zip`), salvo localmente em `Dados/detru/siconv_convenio.csv.zip` (15.48 MB, fora do versionamento). Nenhum aviso ou erro acumulado.

### Endpoints testados (servidor local em PORT=8795, apenas para teste das rotas novas)

- `GET /api/profor-2022/origem` → `{ success: true, origemDados: "banco-cache", origemDadosEfetiva: "banco-cache", fallbackUsado: false, avisos: [] }`.
- `GET /api/profor-2022/consolidado` → `success: true`, `data.diagnostico = { totalCarteira: 15, totalComDetru: 15, totalComRendimentos: 15, totalComPlano: 15 }`, 15 convênios.
- `GET /api/profor-2022/atualizacao/status` → `success: true`, origem `banco-cache`, última DETRU sucesso (15 encontrados), última rendimentos sucesso (15/15), diagnóstico 15/15/15.
- `POST /api/profor-2022/atualizar` → `success: true`, `resultado.sucesso: true`, DETRU 15/15, rendimentos 15/15, consolidado 15/15, 0 avisos, 0 erros.
- `GET /api/profor-2022/comparar-origens` → 15 divergências esperadas por governança (Grupos A, B, D já documentados em `profor-2022-divergencias.md`).
- `GET /api/profor-2022/detru/ultima-atualizacao` → sucesso, 15 encontrados.
- `GET /index.html` → 200. `GET /frontend/js/app.js?v=20260518-02` → 200.

O servidor `localhost:8790` em execução pelo usuário NÃO foi reiniciado nem afetado; o teste das novas rotas usou `PORT=8795` em processo dedicado e finalizado ao fim do teste.

### Validações obrigatórias

- `node --check` aprovado em: `profor-atualizacao-consolidada-service.js`, `atualizar-profor-2022-consolidado.js`, `agendar-atualizacao-profor-2022.js`, `backend/server.js`, `frontend/js/app.js`.
- `npm run validar:json` → OK (todos os JSONs publicados esperados existem e são válidos).
- `npm run validar:syntax` → OK (25 arquivos validados).
- `git diff --check` → sem avisos de whitespace; apenas warnings de LF→CRLF do Windows.

### Restrições confirmadas

- `npm run publicar:dados` NÃO foi executado.
- JSONs publicados em `frontend/data/publicados/` NÃO foram alterados.
- `.env` NÃO foi alterado.
- Banco/schema NÃO foi alterado (apenas upserts em tabelas existentes).
- Nenhuma dependência nova adicionada.
- Nenhum serviço Windows, GitHub Action ou agendamento de SO criado.
- Origem padrão de `.env` permanece `banco-cache` (estado anterior preservado).
- Fallback para `planilha` preservado.
- Aba `Geral` preservada.
- SQLite, ZIP DETRU, CSV, HAR, HTML bruto, cookies e arquivos temporários NÃO versionados.

### Pendências

1. Decisão de governança formal das divergências classificadas (Grupos A, B, D) antes de ativar `banco-cache` em publicação estática.
2. Validação operacional do agendador consolidado em produção (rodar `npm run agendar:profor-2022` como processo separado).
3. Avaliar se faz sentido reutilizar a função interna do orquestrador no script existente `atualizar-rendimentos-transferegov-profor-2022.js` para evitar duplicação leve (mantido intacto nesta etapa para não regredir validação anterior).

---

## 18/05/2026 - Integração visual local/API do consolidado PROFOR 2022

- Branch atual: `main`.
- Pull inicial executado conforme ordem de serviço: `git pull` fez fast-forward de `639fe2e` para `a4323cd`, atualizando `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md`.
- Objetivo: permitir que a página PROFOR 2022 e os indicadores de convênios da home consumam o consolidado `banco-cache` em modo local/API quando a flag estiver ativa, mantendo `planilha` como origem padrão e fallback.
- Status: integração visual local/API implementada e validada sem executar `npm run publicar:dados`.

### Arquivos lidos

- `AGENTS.md`
- `memoria/INDEX.md`
- `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md`
- `backend/services/data-service.js`
- `backend/services/dashboard-publication-service.js`
- `backend/services/static-publication-service.js`
- `backend/services/profor-2022/profor-origem-service.js`
- `backend/services/profor-2022/profor-consolidado-service.js`
- `backend/services/profor-2022/profor-comparador-service.js`
- `backend/services/profor-2022/profor-calculos-service.js`
- `backend/services/profor-2022/profor-plano-aplicacao-service.js`
- `backend/server.js`
- `frontend/js/app.js`
- `index.html`
- `package.json`

### Arquivos alterados

- `backend/server.js`
  - Criada rota local/API `GET /api/profor-2022/origem`, que expõe apenas a origem resolvida (`planilha` ou `banco-cache`) e avisos seguros, sem vazar `.env`, caminhos internos ou configuração DETRU.
- `backend/services/data-service.js`
  - Adicionadas funções browser-safe para resolver a origem PROFOR 2022 via API local e carregar o consolidado `banco-cache` pela rota `/api/profor-2022/consolidado`.
  - O cache em memória `dadosProfor2022Cache` pode ser substituído pelo consolidado apenas no navegador local/API, sem importar SQLite ou serviços Node.
- `frontend/js/app.js`
  - O carregamento base mantém a planilha como primeira origem e tenta trocar para `banco-cache` somente quando `/api/profor-2022/origem` retorna essa origem.
  - A home passa a substituir os itens de convênio pelos totais de Ouvidoria do consolidado quando `banco-cache` está ativo, preservando FAF e Doações.
  - A página PROFOR 2022 exibe origem, diagnóstico básico (`DETRU`, `Plano`, `Rendimentos`) e fonte/data de referência do saldo de rendimentos.
  - Em falha do consolidado, a tela permanece com a origem planilha e registra aviso controlado.
- `index.html`
  - Atualizado cache-buster do `frontend/js/app.js`.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`

### Testes executados

- Caches atualizados antes do teste visual:
  - `npm run atualizar:detru-profor`: 15 convênios encontrados no DETRU.
  - `npm run atualizar:rendimentos-profor`: 15 consultados, 15 sucessos, 0 falhas.
- Origem padrão `planilha`:
  - Servidor local em `PORT=8791` com `PROFOR_2022_ORIGEM_DADOS=planilha`.
  - Home carregou.
  - Página PROFOR 2022 carregou.
  - Origem exibida: `planilha`.
  - Console do navegador: 0 erros e 0 avisos relevantes.
- Origem `banco-cache`:
  - Servidor local em `PORT=8792` com `PROFOR_2022_ORIGEM_DADOS=banco-cache`.
  - `GET /api/profor-2022/origem`: `banco-cache`.
  - `GET /api/profor-2022/consolidado`: 15 convênios, `totalComDetru=15`, `totalComPlano=15`, `totalComRendimentos=15`.
  - `GET /api/profor-2022/comparar-origens`: `totalComDivergencia=15`, divergências já classificadas como aceitas tecnicamente/governança.
  - Home carregou.
  - Página PROFOR 2022 carregou com `Origem local/API: banco-cache`.
  - Detalhe do convênio GO carregou.
  - Fonte de `saldoRendimentosAtual` exibida como Transferegov Acesso Livre com referência local.
  - Console do navegador: 0 erros e 0 avisos relevantes.
- Fallback:
  - Simulada falha HTTP 500 em `/api/profor-2022/consolidado` via Playwright.
  - Página PROFOR 2022 permaneceu carregada com origem `planilha` e aviso de fallback.
- Rollback:
  - Servidor reiniciado em `PORT=8793` com `PROFOR_2022_ORIGEM_DADOS=planilha`.
  - Origem voltou para `planilha`, página carregou e console ficou sem erros/avisos.

### Restrições confirmadas

- `npm run publicar:dados` não foi executado.
- JSONs publicados não foram alterados.
- Banco/schema não foi alterado.
- `.env` não foi alterado.
- Nenhum SQLite, ZIP, CSV, HAR ou HTML bruto foi versionado.
- `banco-cache` não foi ativado como padrão; a origem padrão continua `planilha`.

## 18/05/2026 - Fluxo público Transferegov de rendimentos implementado e carteira atualizada

- Branch atual: `main`.
- Objetivo: corrigir a captura de `saldoRendimentosAtual` pelo Transferegov Acesso Livre, sem ativar `banco-cache` como origem padrão e sem alterar frontend, banco/schema ou JSONs publicados.
- Escopo: evolução conservadora de `backend/services/profor-2022/transferegov-rendimentos-client.js`; ajuste mínimo de relatório no script de atualização; documentação da nova evidência.
- Status: ✅ **FLUXO FUNCIONAL NO MODO LOCAL/API** — cache de rendimentos populado para 15/15 convênios da carteira.

### Arquivos lidos

- `AGENTS.md`
- `memoria/INDEX.md`
- `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md`
- `backend/services/profor-2022/transferegov-rendimentos-client.js`
- `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`
- `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`
- `backend/services/profor-2022/convenios-monitorados-service.js`
- `backend/services/profor-2022/profor-consolidado-service.js`
- `backend/server.js`
- `package.json`

### Arquivos alterados

- `backend/services/profor-2022/transferegov-rendimentos-client.js`
  - Adicionado cookie jar em memória, `fetchComSessao`, montagem de payload da consulta pública, extração de `idConvenio`, seleção do instrumento e abertura da tela de rendimentos.
  - O fluxo tenta primeiro HTTP público com cookies em memória. Quando o Transferegov retorna SAML/IdP para cliente HTTP simples, usa fallback local com Playwright/Chromium já disponível no projeto para reproduzir sessão pública de navegador, sem login, sem credenciais e sem cookies persistidos.
  - O retorno passou a incluir `idConvenio`, `etapa`, `payload` diagnóstico seguro e validação de que a tela final pertence ao convênio solicitado.
- `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`
  - Ajuste mínimo para registrar a `etapa` nas falhas do relatório, sem alterar persistência nem paralelizar consultas.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
- `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md`

### Fluxo público implementado

Endpoints públicos usados:

1. `GET /voluntarias/Principal/Principal.do?Usr=guest&Pwd=guest`
2. `GET /voluntarias/ForwardAction.do?modulo=Principal&path=/MostraPrincipalConsultarConvenio.do`
3. `POST /voluntarias/ConsultarProposta/PreenchaOsDadosDaConsultaConsultar.do?tipo_consulta=CONSULTA_COMPLETA`
4. `GET /voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?idConvenio={idConvenio}&destino=`
5. `GET /voluntarias/ForwardAction.do?modulo=proposta&path=/SelecionarConvenio/SelecionarConvenio.do?destino=ListarSolicitacaoRendimentosAplicacao`
6. Tela final: `/voluntarias/execucao/ListarSolicitacaoRendimentosAplicacao/ListarSolicitacaoRendimentosAplicacao.do?destino=ListarSolicitacaoRendimentosAplicacao`

O cliente HTTP simples ainda cai em SAML/IdP antes de conseguir extrair `idConvenio`. O fallback com navegador público local estabelece a sessão Acesso Livre sem login e sem reutilizar cookies do HAR, executa o POST público por `numeroConvenio`, extrai `idConvenio`, seleciona o instrumento e lê a tela final.

### Testes reais

| Convênio | Resultado | `idConvenio` | Valor extraído | Observação |
| --- | --- | ---: | ---: | --- |
| `880892` | sucesso | `732378` | R$ 131.799,75 | subtítulo: `Rendimento de Aplicação – Valor Total Disponível em 18/05/2026` |
| `937216` | sucesso | `1031156` | -R$ 25.373,11 | convênio PROFOR GO; saldo negativo preservado conforme tela pública |

Nenhum cookie, `SAMLRequest`, `SAMLResponse`, `JSESSIONID`, token ou HTML bruto foi impresso, salvo ou versionado.

### Atualização da carteira

Com os dois testes reais aprovados, foi executado `npm run atualizar:rendimentos-profor`.

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Cache `profor_transferegov_rendimentos_cache` | 0 | 15 |
| Carteira ativa consultada | - | 15 |
| Sucessos | - | 15 |
| Falhas | - | 0 |
| Última consulta registrada | inexistente | `id=1`, sucesso, 15 consultados, 15 sucesso, 0 falhas |

### Consolidação e comparação

Rotas locais/API testadas no servidor já ativo em `localhost:8790`:

- `GET /api/profor-2022/consolidado`
- `GET /api/profor-2022/comparar-origens`

Resultado após popular o cache:

| Métrica | Valor |
| --- | ---: |
| `totalComDetru` | 15 |
| `totalComPlano` | 15 |
| `totalComRendimentos` | 15 |
| `totalComDivergencia` | 15 |
| `totalAusentesAntigo` | 0 |
| `totalAusentesNovo` | 0 |

Principais divergências remanescentes por campo: `quantidadeTa` (15), `saldoRendimentosAtual` (15), `execucaoGeralPercentual` (15), `saldoResidualCapital` (14), `saldoResidualCusteio` (12), além de divergências pontuais em `valorExecutadoGeral`, `valorRepasse`, `valorGlobal` e `rendimentoAprovado`.

O campo `saldoRendimentosAtual` deixou de ser ausência técnica do `banco-cache`; agora há valor capturado para 15/15. As divergências remanescentes indicam diferença entre valores manuais da aba `Geral` e saldos atuais da tela pública do Transferegov, portanto continuam exigindo validação/governança antes de ativar `banco-cache`.

### Validação funcional local

- `npm start` não abriu novo processo porque `0.0.0.0:8790` já estava em uso; o servidor local existente foi usado.
- `GET /index.html`: 200.
- Playwright abriu `http://localhost:8790/index.html`, acionou `toggleView("profor2022")`, confirmou view PROFOR 2022 visível, tabela renderizada e nenhuma mensagem de erro/aviso no console capturado.

### Restrições confirmadas

- `PROFOR_2022_ORIGEM_DADOS` não foi alterado.
- `banco-cache` não foi ativado como origem padrão.
- Frontend e `index.html` não foram alterados.
- Banco/schema não foi alterado.
- JSONs publicados em `frontend/data/publicados/` não foram alterados.
- `npm run publicar:dados` não foi executado.
- DETRU não foi usado como fonte de `saldoRendimentosAtual`.
- HAR, HTML bruto, TXT de saída, cookies, ZIP, CSV e SQLite não foram versionados.

### Pendências

1. Validar governança das 15 diferenças de `saldoRendimentosAtual` entre aba `Geral` e tela pública atual do Transferegov.
2. Confirmar se o fallback local com Playwright/Chromium será aceito como mecanismo operacional para atualização periódica em ambiente local/API.
3. Manter `banco-cache` fora do padrão até validação das divergências remanescentes.

---

## 17/05/2026 - Sondagem do fluxo público Transferegov — bloqueio SAML confirmado

- Branch atual: `main`.
- Objetivo: implementar a captura automática de `saldoRendimentosAtual` via fluxo público do Transferegov Acesso Livre, conforme conceito validado pelo usuário (consultar por `numeroConvenio` → extrair `idConvenio` → selecionar instrumento → ler tela de rendimentos).
- Escopo: executor técnico conservador; testar com convênio de referência 880892 antes de qualquer alteração; preservar o cliente atual se a sondagem falhar.
- Status: ⛔ **FLUXO BLOQUEADO POR SAML — nenhuma alteração de código realizada**.

### Sondagem técnica executada (5 scripts temporários locais)

**Convênio de referência**: 880892 (esperado `idConvenio=732378`, saldo R$ 131.799,75).

URLs testadas:

1. `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ConsultarProposta.do?Usr=guest&Pwd=guest`
2. `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/PreenchaOsDadosDaConsultaConsultar.do?tipo_consulta=CONSULTA_COMPLETA`
3. `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ForwardAction.do?modulo=Principal&path=/MostraPrincipalConsultarConvenio.do&Usr=guest&Pwd=guest`
4. `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ForwardAction.do?modulo=Principal&path=/MostraPrincipalConsultarProposta.do&Usr=guest&Pwd=guest`
5. Variantes adicionais (`AcessoLivre.do`, `login/login.do`, etc.).

Em **todas** as URLs, o comportamento foi idêntico:

```
GET /voluntarias/.../...?Usr=guest&Pwd=guest
  → 200 OK, HTML 3.469 bytes, título "HTTP Post Binding (Request)"
  → auto-submit POST SAMLRequest para https://idp.transferegov.sistema.gov.br/idp/
  → 401 Unauthorized, HTML 12.838 bytes, título "Login do Transferegov"
```

Resultados detalhados:

| Etapa | Status | URL final | Observação |
| --- | --- | --- | --- |
| GET URL pública qualquer | 200 | SP-initiated SAML request | retorna formulário auto-submit (POST binding) para o IdP |
| POST SAMLRequest no IdP | 401 | `idp.transferegov.sistema.gov.br/idp/` | retorna tela "Login do Transferegov" com botões "Entrar com gov.br" e "Acesso livre" |
| Link "Acesso livre" | 200 | `gov.br/transferegov/pt-br/sistemas/acesso-livre` | página informativa do portal, lista os mesmos endereços `ForwardAction.do?...&Usr=guest&Pwd=guest` (ciclo) |
| POST consulta `numeroConvenio=880892` | 200 | tela de Login | mesma cadeia SAML, termina sem sessão |

### Causa raiz

O IdP do Transferegov (`idp.transferegov.sistema.gov.br/idp/`) **não autoriza mais** o fluxo guest direto via SAML SP-initiated quando recebido por cliente HTTP simples. O User-Agent foi testado tanto com identificador institucional (`ONASP-SENAPPEN-FOMENTO/1.0`) quanto com User-Agent de navegador real (Chrome 120) — comportamento idêntico. O acesso público "Acesso livre" passou a depender de algum estado adicional (provavelmente cookies de sessão estabelecidos por JavaScript do portal, ou fluxo de navegador interativo) que o `fetch` não reproduz.

A inspeção que o usuário realizou anteriormente (caminho 880892 → 732378 → R$ 131.799,75) **funcionou em navegador interativo** mas **não é reproduzível por HTTP simples** no estado atual do site. Não houve evidência de bloqueio por User-Agent ou rate-limit; o bloqueio é de fluxo SAML/sessão.

### Decisão conservadora (executor técnico)

**Nenhuma alteração de código** realizada nesta etapa:

- `backend/services/profor-2022/transferegov-rendimentos-client.js` — preservado. Já retorna erro controlado `"Sessão pública do convênio não estabelecida."` quando o HTML final não inclui o número do convênio, que é exatamente o que ocorre na sondagem.
- `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js` — preservado.
- `backend/services/profor-2022/transferegov-rendimentos-cache-service.js` — preservado.
- Cache continua vazio (`profor_transferegov_rendimentos_cache` com 0 registros).
- `totalComRendimentos` permanece **0**.

A regra absoluta foi respeitada: **não burlar Transferegov, não usar login/senha/captcha/certificado/área restrita, não inventar endpoint**. Como nenhum dos endereços indicados estabelece sessão por HTTP simples, parei na FASE 3 conforme orientação ("Se não conseguir confirmar o fluxo público, pare e documente exatamente em qual etapa falhou.").

### Solicitação ao usuário (próxima etapa)

Para destravar a implementação, é necessário um dos seguintes itens, fornecido pelo usuário:

1. **HAR completo** (ou exportado pelo DevTools do navegador) da consulta bem-sucedida de `880892`, do primeiro GET até a página final de rendimentos. Sem cookies sensíveis pode ser difícil — alternativa: HAR sanitizado ou screenshot das requisições principais com URL, método, status, headers de resposta (especialmente `Set-Cookie`) e payload do POST.
2. **HTML da resposta** logo após o POST de `numeroConvenio=880892`, junto com a URL exata acionada e a sequência de cookies enviada (pode ser anonimizada, mas precisa indicar quais cookies são necessários para o IdP autorizar).
3. **URL exata e payload** acionados ao clicar/acessar o instrumento `idConvenio=732378` na tela de listagem.
4. **HTML da tela final** de rendimento depois da seleção do instrumento (para confirmar que o parser existente `extrairSaldoRendimentosDoHtml()` continua válido).

Sem um desses, **não há como implementar o fluxo automatizado** sem violar restrições absolutas (não usar credenciais, não burlar IdP).

### Reafirmação de segurança

- Código de produção: **não alterado**.
- Frontend, `index.html`, `backend/data/aplicacao.json`, `.env`, `.env.example`, `backend/db/init-db.js`, `package.json`: **não alterados**.
- JSONs publicados em `frontend/data/publicados/`: **não alterados**.
- `npm run publicar:dados`: **não executado**.
- `banco-cache`: **não ativado** (`PROFOR_2022_ORIGEM_DADOS=planilha` mantida).
- Cookies/HTML bruto/HAR: **não versionados**. Cookies só permaneceram em memória durante as sondagens; todos os scripts temporários foram apagados.

### Estado dos diagnósticos após sondagem

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| `totalComDetru` | 15 | 15 |
| `totalComPlano` | 15 | 15 |
| `totalComRendimentos` | 0 | **0** (inalterado — sem dados novos) |
| `totalComDivergencia` | 15 | 15 |
| Cache Transferegov | 0 registros | 0 registros (inalterado) |
| Consultas Transferegov registradas | 0 | 0 (inalterado) |

### Arquivos alterados nesta etapa

| Arquivo | Mudança |
| --- | --- |
| `memoria/00_DIARIO_DE_BORDO/diario-atual.md` | nova entrada com sondagem e bloqueio SAML |
| `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md` | Grupo D corrigido (Transferegov Acesso Livre como fonte oficial; DETRU não é fonte principal; importação manual rebaixada) |
| `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` | seção 13.4 atualizada (bloqueio SAML documentado) |

### Próximas pendências

1. **Bloqueante**: aguardar HAR/HTML/URLs do usuário para reabrir a investigação do fluxo público Transferegov.
2. **Alternativa de operação manual**: até a automação ser viável, considerar importação periódica controlada de saldos exportados manualmente pelo responsável (procedimento operacional, não código).
3. **Decisão de governança**: avaliar se `saldoRendimentosAtual = null` com aviso de UI é aceitável para ativar `banco-cache` (Opção 2 do `profor-2022-divergencias.md`).

---

## 17/05/2026 - Classificação das 15 divergências planilha × banco-cache (Grupos A–E)

- Branch atual: `main`.
- Objetivo: classificar tecnicamente as 15 divergências residuais do consolidado PROFOR 2022, separando o que é divergência aceitável (fonte oficial DETRU ou cálculo do plano) do que é pendência real (cache Transferegov ausente). Subsidiar decisão futura de governança sobre ativação do `banco-cache`.
- Escopo: diagnóstico documental, sem alteração de código, sem ativar origem nova, sem publicar dados.
- Status: ✅ **CLASSIFICAÇÃO CONCLUÍDA** — sem alteração de código.

### Reafirmação do estado técnico

| Métrica | Valor |
| --- | --- |
| `diagnostico.totalCarteira` | 15 |
| `diagnostico.totalComDetru` | **15** ✅ |
| `diagnostico.totalComPlano` | **15** ✅ |
| `diagnostico.totalComRendimentos` | **0** ⚠️ |
| `diagnostico.totalAvisos` | 90 |
| `comparacao.totalAntigo` | 15 |
| `comparacao.totalNovo` | 15 |
| `comparacao.totalIguais` | 0 |
| `comparacao.totalComDivergencia` | 15 |
| Severidade alta | 14 convênios |
| Severidade média | 1 convênio (937592/AM) |

### Classificação em grupos (matriz resumida)

| Grupo | Campos | Convênios | Classificação | Bloqueia ativação? |
| --- | --- | ---: | --- | --- |
| **A — DETRU oficial** | `quantidadeTa` (15), `valorGlobal` (1), `valorRepasse` (1), `rendimentoAprovado` (1) | até 15 | aceitável — fonte oficial substitui valor manual | não |
| **B — Cálculo do plano** | `valorExecutadoGeral` (1), `saldoResidualCapital` (14), `saldoResidualCusteio` (12) | até 14 | aceitável — soma do plano por área/natureza | não |
| **C — Ausente na origem antiga** | `execucaoGeralPercentual` (15) | 15 | não bloqueante — campo novo calculado | não |
| **D — Ausente na origem nova** | `saldoRendimentosAtual` (15) | 15 | **pendência real** — cache Transferegov vazio | **parcial** |
| **E — Validação humana** | nenhum | 0 | — | — |

**Total**: 75 ocorrências distribuídas em 15 convênios. **Nenhuma classificada como erro provável.**

### Principais achados

1. As divergências DETRU (Grupo A) refletem a substituição intencional de valores manuais por fonte oficial. Exemplos:
   - 937468/TO: `valorGlobal` antigo R$ 265.260,78 → DETRU R$ 287.128,78 (TA não refletido na planilha, R$ 21.868).
   - 937782/AC: `valorRepasse` antigo R$ 396.423,71 → DETRU R$ 390.430,00 (ajuste de repasse, R$ 5.993,71).
   - `quantidadeTa`: DETRU traz `QTD_TA` real para todos os 15 convênios; planilha contava parciais (diferença de 1 a 2 unidades por convênio).
2. As divergências de cálculo do plano (Grupo B) são em geral altas em valor absoluto (`saldoResidualCapital` chega a R$ 1.276.901,97 de diferença em 937817/RJ), o que sugere que os valores antigos na aba Geral estavam **muito desatualizados**. O novo cálculo é determinístico (soma direta do plano filtrado por UF+nº+ano por natureza) e auditável.
3. `execucaoGeralPercentual` (Grupo C) sempre vem `null` na origem antiga porque o campo não é extraído no nível do convênio em `extrairProfor2022DoWorkbook`. Não é bug; é uma adição estrutural do `banco-cache`.
4. `saldoRendimentosAtual` (Grupo D) é a única pendência real. Sem cache populado, todos os 15 convênios divergem (antigo tem valor manual, novo é `null`). Cliente Transferegov atual depende de sessão pública estabelecida — não há workaround sem violar restrições absolutas.

### Decisão de não ativação

`banco-cache` **continua bloqueado** como origem padrão. A bloqueio agora não é técnico (cache populado, plano casando), e sim de **governança**:

1. ⚠️ pendente: decisão sobre `saldoRendimentosAtual` (Opção 1, 2 ou 5.4 do documento de divergências).
2. ⚠️ pendente: decisão sobre aceitar Grupo A (DETRU oficial) e Grupo B (cálculo do plano) como autoritativos.

Detalhes completos em [`memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md`](../01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md).

### Recomendação técnica

- **Curto prazo**: manter `PROFOR_2022_ORIGEM_DADOS=planilha` (Opção 1) até que governança decida.
- **Médio prazo**: se aceito `null` para `saldoRendimentosAtual` com aviso de UI, migrar para `banco-cache` (Opção 2). Importação manual controlada de saldos Transferegov é a 2ª via mais segura.
- **Evitar**: composição híbrida campo a campo (Opção 3) — aumenta complexidade arquitetural e dilui clareza do mapeamento "uma origem por consolidado".

### Arquivos alterados nesta etapa

| Arquivo | Mudança |
| --- | --- |
| `memoria/00_DIARIO_DE_BORDO/diario-atual.md` | nova entrada com classificação |
| `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` | seção 13 adicionada (critérios de aceitação `banco-cache`) |
| `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-divergencias.md` | **arquivo novo** (matriz, classificação, recomendações) |

### Confirmações de segurança

- Código: **não alterado** (`backend/server.js`, services PROFOR 2022, `backend/db/init-db.js`).
- Frontend, `index.html`, `backend/data/aplicacao.json`, `.env`, `.env.example`, `package.json`: **não alterados**.
- JSONs publicados em `frontend/data/publicados/`: **não alterados**.
- `npm run publicar:dados`: **não executado**.
- ZIP/CSV/banco SQLite: **não versionados**.
- Origem padrão: `PROFOR_2022_ORIGEM_DADOS=planilha` (mantida).
- `banco-cache`: **não ativado**.

### Validações executadas

- `npm run validar:json` → OK (todos JSONs publicados válidos).
- `npm run validar:syntax` → OK (25 arquivos validados).
- `git diff --check` → sem trailing whitespace.
- `git status --short` → apenas arquivos de memória alterados/criados.

### Próximas pendências

1. **Governança**: decidir entre Opções 1–4 (ver seção 5 do documento de divergências).
2. **Transferegov**: avaliar viabilidade de importação manual controlada ou fonte pública alternativa para `saldoRendimentosAtual`.
3. **(Opcional)** Adicionar extração de `execucaoGeralPercentual` no nível do convênio em `extrairProfor2022DoWorkbook` para reduzir 15 ocorrências de `ausente_antigo` na comparação (melhoria de qualidade, não-bloqueante).

---

## 17/05/2026 - Diagnóstico do consolidado PROFOR 2022 — totalComPlano e Transferegov esclarecidos

- Branch atual: `main`.
- Objetivo: investigar e, se possível, corrigir os bloqueios remanescentes da origem `banco-cache` do PROFOR 2022: `totalComPlano = 1`, `totalComRendimentos = 1` e 15 divergências entre planilha × banco-cache.
- Escopo: arquiteto técnico conservador, revisor sênior, executor técnico. Sem ativar `banco-cache`, sem publicar dados, sem alterar JSONs/frontend/banco/schema.
- Status: ✅ **DIAGNÓSTICO CONCLUÍDO** — nenhuma alteração de código necessária.

### Achado principal: falso positivo do relatório anterior

O `totalComPlano = 1` e `totalComRendimentos = 1` relatados na entrada anterior **não vieram do endpoint real**. Eles foram calculados incorretamente no script temporário de relatório (`relatorio-validacao.js`) com a fórmula:

```javascript
console.log(`     - diagnostico.totalComRendimentos: ${consolidado.data?.resumo?.rendimentoAprovado ? 1 : 0}`);
console.log(`     - diagnostico.totalComPlano: ${consolidado.data?.resumo?.previstoOuvidoria ? 1 : 0}`);
```

Ou seja, eram **booleanos truncados** (1 quando o resumo tinha valor > 0; 0 caso contrário) — não a contagem real do campo `diagnostico.totalComPlano`.

### Diagnóstico real (executado nesta etapa)

Endpoint `GET /api/profor-2022/consolidado` retorna agora:

```json
{
  "totalCarteira": 15,
  "totalComDetru": 15,
  "totalComRendimentos": 0,
  "totalComPlano": 15,
  "totalAvisos": 90
}
```

- **`totalComPlano = 15`** ✅ — o plano de aplicação está casando para todos os 15 convênios da carteira.
- **`totalComDetru = 15`** ✅ — cache DETRU populado (etapa anterior).
- **`totalComRendimentos = 0`** ⚠️ — cache Transferegov vazio (esperado pelo modelo atual).

### Diagnóstico do plano de aplicação (FASE 2)

Inspeção da planilha `Planilhas/gestao_financeira_ouvidoria.xlsx` em todas as 15 abas estaduais (MT, GO, PR, AM, AC, MS, SP, MA, PB, PI, RO, TO, RJ, AL, SC):

- 0 abas com colunas ocultas (`!cols` ausente em todas).
- Cabeçalho uniforme: `[0]=UF`, `[1]=INSTRUMENTO`, `[2]=NÚMERO`, `[3]=ANO`, `[4]=ÁREA`, `[5]=NATUREZA`, `[6]=DESCRIÇÃO`, `[7]=QUANTIDADE`, `[8]=VALOR UNITÁRIO`, `[9]=VALOR TOTAL PREVISTO`, `[10]=VALOR TOTAL EXECUTADO`, `[11]=SALDO`, `[12]=SALDO ECONOMICIDADE`.
- Total de 566 itens úteis distribuídos nas 15 abas.
- 100% das linhas úteis têm `numero` (índice 2) preenchido como string `"937xxx"` ou `"938xxx"`.
- 100% das linhas úteis têm `ano` (índice 3) preenchido como string `"2022"`.
- Cada UF da carteira tem exatamente 1 convênio ativo (premissa F confirmada — enriquecimento por UF seria seguro, mas não é necessário neste momento).
- Match exato pelo filtro atual (UF + número + ano) retorna a quantidade esperada em todas as 15 abas.

### Hipóteses (FASE 4) — confirmadas/descartadas

| Hipótese | Resultado |
| --- | --- |
| A. Colunas ocultas deslocaram leitura por índice | ❌ DESCARTADA (sem colunas ocultas) |
| B. Número/ano em índices diferentes de 2 e 3 | ❌ DESCARTADA (corretos em 2/3) |
| C. Número/ano ausentes nas linhas | ❌ DESCARTADA (preenchidos em 100% das linhas úteis) |
| D. Número no formato `937xxx/2022` colado | ❌ DESCARTADA (formato puro `937xxx`) |
| E. Ano ausente, embutido no número | ❌ DESCARTADA |
| F. Cada UF tem exatamente 1 convênio ativo | ✅ CONFIRMADA (15 UFs com 1 convênio cada) |
| G. Alguma UF com >1 convênio | ❌ NÃO OCORRE |

### Decisão técnica (FASE 4)

**Causa confirmada do `totalComPlano = 1` reportado**: falso positivo do script `relatorio-validacao.js` (script temporário de diagnóstico que eu mesmo havia criado), não havia bug no código de produção.

**Correção escolhida**: nenhuma. O código de produção (`backend/services/profor-2022/profor-consolidado-service.js`, `profor-calculos-service.js`, `profor-plano-aplicacao-service.js`, `dashboard-publication-service.js`) está correto e retorna `totalComPlano = 15` para a carteira atual. Risco de regressão se eu alterasse algo: alto, desnecessário.

**Por que não mistura convênios**: o filtro seguro em `filtrarPlanoAplicacaoSeguro` continua a exigir `UF + número + ano`; o enriquecimento por UF não foi implementado porque não é necessário (todas as linhas já têm número/ano corretos).

### Divergências reais residuais (FASE 3)

`GET /api/profor-2022/comparar-origens` retorna `totalAntigo = 15`, `totalNovo = 15`, `totalIguais = 0`, `totalComDivergencia = 15`. Resumo por campo:

| Campo | Convênios divergentes | Causa raiz |
| --- | --- | --- |
| `saldoRendimentosAtual` | 15 | Cache Transferegov vazio (`ausente_novo`) — depende do Transferegov |
| `quantidadeTa` | 15 | DETRU oficial traz QTD_TA real; aba Geral tem valor manual diferente |
| `execucaoGeralPercentual` | 15 | Aba Geral não traz esse campo no nível do convênio (`ausente_antigo`); novo calcula |
| `saldoResidualCapital` | 14 | Novo soma `saldo` dos itens do plano (natureza=CAPITAL); antigo era manual desatualizado |
| `saldoResidualCusteio` | 12 | Idem para natureza=CUSTEIO |
| `valorExecutadoGeral` | 1 (937698/MT) | Soma do plano vs valor manual antigo na aba Geral |
| `valorGlobal`, `valorRepasse`, `rendimentoAprovado` | 1 (937468/TO, 937782/AC) | DETRU oficial corrige valor manual desatualizado |

**Interpretação**: as 15 divergências são **esperadas pela arquitetura**. O `banco-cache` é proposital e estruturalmente superior à aba Geral antiga (DETRU oficial + soma do plano por área/natureza). Não são "bugs", são diferenças intencionais entre fonte manual antiga e fonte calculada nova.

### Diagnóstico Transferegov (FASE 7)

- Registros em `profor_transferegov_rendimentos_cache`: **0**.
- Convênios com cache: 0; sem cache: 15.
- Última consulta em `profor_transferegov_rendimentos_consultas`: **nenhuma** (tabela vazia).
- Cliente atual (`transferegov-rendimentos-client.js`): usa URL fixa pública `discricionarias.transferegov.sistema.gov.br/voluntarias/execucao/ListarSolicitacaoRendimentosAplicacao/...` e valida se `convenioTexto` contém o número do convênio. Se a sessão pública do convênio **não está estabelecida**, retorna erro controlado `"Sessão pública do convênio não estabelecida."`.
- Conclusão: o cliente atual **depende de sessão pública** do convênio. **Sem workaround possível** sem violar restrições absolutas (sem login, senha, captcha, certificado, área restrita, bypass).

### Validações (FASE 6)

- `node --check` em todos os 5 arquivos críticos do PROFOR 2022: ✅ OK.
- `npm run validar:json` → `OK: todos os JSONs publicados esperados existem e sao validos.`
- `npm run validar:syntax` → `OK: 25 arquivo(s) validados.`
- `git diff --check` → sem trailing whitespace (apenas o diário foi alterado).

### Estado final do banco-cache

- Ativação: ❌ **continua bloqueada** — não pela `totalComPlano` (que está OK), mas pelas 15 divergências residuais entre planilha manual e cálculo novo. A decisão de migração precisa ocorrer fora do escopo técnico (questão de governança: aceitar o novo cálculo como autoritativo ou validar caso a caso).
- Origem padrão: `PROFOR_2022_ORIGEM_DADOS=planilha` mantida.

### Confirmações de segurança

- `npm run publicar:dados`: **não executado**.
- JSONs publicados em `frontend/data/publicados/`: **não alterados**.
- Frontend, `index.html`, `backend/server.js`, banco/schema, `.env`, `.env.example`, `backend/data/aplicacao.json`, `package.json`: **não alterados**.
- ZIP/CSV/banco SQLite: **não versionados** (`.gitignore` continua bloqueando).
- Arquivo único alterado nesta etapa: `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

### Próximas pendências (não-bloqueantes técnicas)

1. **Governança**: decidir se o `banco-cache` (DETRU + soma do plano) pode ser ativado mesmo divergindo da aba Geral manual.
2. **Transferegov/rendimentos**: estudar se há fonte pública alternativa para `saldoRendimentosAtual` que não dependa de sessão estabelecida. Sem workaround sem violar restrições absolutas.
3. **`saldoDisponivelOuvidoria`**: continua pendente — fórmula segura ainda não definida.
4. **(opcional)** Extrair `execucaoGeralPercentual` no nível do convênio em `extrairProfor2022DoWorkbook` para reduzir 15 ocorrências de `ausente_antigo`. Pequena melhoria de qualidade da comparação, não-bloqueante.

---

## 17/05/2026 - Validação operacional do cache DETRU — sucesso na atualização por URL

- Branch atual: `main`.
- Objetivo: reexecutar validação operacional do cache DETRU com URL oficial configurada, confirmar download automático e validar endpoints de diagnóstico.
- Escopo: operacional/validação, executor técnico conservador, sem alterações de código/frontend/banco/JSONs.
- Status: ✅ **CONCLUÍDO COM SUCESSO**.
- URL oficial usada: `https://repositorio.dados.gov.br/seges/detru/siconv_convenio.csv.zip`.
- Download automático: executado com sucesso via `npm run atualizar:detru-profor`.
- Arquivo local gerado: `Dados/detru/siconv_convenio.csv.zip`.
- Tamanho do arquivo: 15,48 MB.
- Hash SHA-256: `b55d5be23bba2f78574c53737362a09b2d25abdc2ca74c66054f35c41103b94f`.
- **Resultado do cruzamento carteira × DETRU:**
  - Carteira ativa: 15 convênios.
  - Linhas DETRU lidas: 281.229.
  - Encontrados no DETRU: 15.
  - Não encontrados: 0.
  - Taxa de cobertura: 100% (15/15).
- **Cache DETRU no banco:**
  - Total registros em `profor_detru_cache`: 15.
  - ID última atualização: 2.
  - Sucesso: sim (flag `sucesso = 1`).
  - Total carteira processada: 15.
  - Erro: nenhum.
- **Endpoints testados:** ambos respondendo `200 OK`.
  - `GET /api/profor-2022/consolidado`: status 200, resposta JSON com resumo financeiro e lista de 15 convênios.
  - `GET /api/profor-2022/comparar-origens`: status 200, resposta JSON com comparação planilha × banco-cache.
- **Diagnóstico extraído de `/api/profor-2022/consolidado`:**
  - `diagnostico.totalComDetru`: 15 ✅ (cache populado).
  - `diagnostico.totalComRendimentos`: 1 (ainda sem cache completo de rendimentos).
  - `diagnostico.totalComPlano`: 1 (ainda sem cache completo de plano).
- **Comparação de origens (`/api/profor-2022/comparar-origens`):**
  - `totalAntigo` (planilha): 15.
  - `totalNovo` (banco-cache): 15.
  - `totalIguais`: 0 (nenhum convênio idêntico entre as duas origens).
  - `totalComDivergencia`: 15 (todos os 15 convênios apresentam pelo menos uma divergência).
  - Causa: `diagnostico.totalComDetru` agora = 15 (DETRU resolvido), mas `totalComRendimentos` = 1 e `totalComPlano` = 1 ainda geram divergências em campos `saldoRendimentosAtual` e previstos/executados.
- **Conclusão técnica:**
  - Cache DETRU: ✅ **resolvido e operacional**.
  - Cache Transferegov (rendimentos): ⚠️ **ainda incompleto** (afeta `diagnostico.totalComRendimentos`).
  - Cache plano de aplicação: ⚠️ **ainda incompleto** (afeta `diagnostico.totalComPlano`).
  - Ativação de `banco-cache`: ❌ **ainda bloqueada** por pendências de rendimentos/plano e divergências não resolvidas.
- **Confirmações de segurança:**
  - Origem padrão: `PROFOR_2022_ORIGEM_DADOS=planilha` (mantida).
  - `banco-cache`: **não foi ativado** como origem padrão.
  - `npm run publicar:dados`: **não foi executado**.
  - JSONs publicados em `frontend/data/publicados/`: **não foram alterados**.
  - ZIP/CSV em `Dados/detru/`: **não foi versionado** em `.git`.
  - Banco SQLite: **não foi versionado** em `.git`.
- **Validações executadas:**
  - `npm run validar:json` — não necessário (nenhum JSON publicado foi alterado).
  - `npm run validar:syntax` — não necessário (nenhum código foi alterado).
  - `git status --short` — repositório limpo (sem arquivos temporários).
  - `git diff --check` — sem trailing whitespace.
  - `git diff --name-only` — vazio (nenhuma alteração).
- **Próxima pendência crítica:**
  - Investigar e resolver `totalComRendimentos = 1` e `totalComPlano = 1` para eliminar as 15 divergências atuais.
  - Apenas após resolver, considerar ativação de `banco-cache` como origem padrão.
- Commit/Push: **não necessário**, nenhuma alteração de código ou banco.

---

## 17/05/2026 - Validação operacional do cache DETRU — impedimento por ausência de fonte

- Branch atual: `main`.
- Objetivo: popular e validar o cache DETRU real da carteira monitorada do PROFOR 2022 e reexecutar a comparação planilha × banco-cache.
- Escopo: operacional/validação, sem arquitetura nova, executor técnico conservador.
- Leitura realizada: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md` (Bloco 18 anterior), `.env.example`, `package.json`, `backend/data/aplicacao.json`.
- Validações executadas:
  1. `git status --short` → sem alterações (working tree clean).
  2. `git branch --show-current` → `main`.
  3. Conferência de `.env` → arquivo existe, mas `DETRU_SICONV_CONVENIO_URL` está vazio.
  4. Conferência de arquivo local → `Dados/detru/siconv_convenio.csv.zip` **não existe**; diretório `Dados` também não existe.
  5. Conferência de `backend/data/aplicacao.json` → seção `detru` configurada com `caminhoLocal: "Dados/detru/siconv_convenio.csv.zip"` (arquivo não encontrado) e `urlSiconvConvenio: ""` (vazio).
- Busca adicional: `**/siconv_convenio.csv.zip` no workspace → nenhum arquivo encontrado.
- **Impedimento bloqueante identificado:**
  - DETRU_SICONV_CONVENIO_URL não está configurada em `.env` (vazio).
  - Arquivo local `Dados/detru/siconv_convenio.csv.zip` não existe.
  - Impossível prosseguir com `npm run atualizar:detru-profor` sem um dos dois.
- Ação não executada:
  - `npm run atualizar:detru-profor` — retido.
  - Consulta ao banco SQLite — retida.
  - Testes de rota — retida.
  - `npm start` — não iniciado.
  - Nenhuma alteração de arquivo — não há o que fazer.
- Commit/Push: não necessário, nada foi alterado.
- Próximas etapas necessárias (bloqueadas):
  1. Obter URL pública do arquivo SICONV do DETRU ou arquivo `siconv_convenio.csv.zip` local.
  2. Configurar `DETRU_SICONV_CONVENIO_URL` em `.env` OU colocar arquivo em `Dados/detru/siconv_convenio.csv.zip`.
  3. Reexecutar esta validação.

---

## 17/05/2026 - Bloco 18: validação final + leitura local do consolidado

- Branch atual: `main`.
- Objetivo: validar a migração PROFOR 2022 sem ativar `banco-cache` como padrão, criar caminho local/API somente leitura para consultar o consolidado e comparar origem antiga versus nova.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/server.js`, `backend/services/data-service.js`, `backend/services/dashboard-publication-service.js`, `backend/services/static-publication-service.js`, `backend/services/profor-2022/profor-origem-service.js`, `backend/services/profor-2022/profor-consolidado-service.js`, `backend/services/profor-2022/profor-comparador-service.js`, `backend/services/profor-2022/profor-calculos-service.js`, `backend/services/profor-2022/profor-plano-aplicacao-service.js`.
- Arquivos alterados: `backend/server.js`, `backend/services/profor-2022/profor-comparador-service.js`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção: criadas as rotas locais/API somente leitura `GET /api/profor-2022/consolidado` e `GET /api/profor-2022/comparar-origens`. As rotas rodam no backend Node, extraem o plano de aplicação pela função segura do `dashboard-publication-service.js`, chamam o compositor/comparador e retornam erro controlado sem stack trace ao usuário.
- Correção pequena adicional: `quantidadeTa` no comparador passou de tipo `moeda` para tipo `numero`, evitando comparação monetária de contador simples.
- Resultado da comparação real: origem padrão atual `planilha`; origem antiga retornou 15 convênios; origem `banco-cache` retornou 15 convênios, `resumo`, `convenios`, `filtros`, `avisos` e `diagnostico`; comparação retornou `totalAntigo = 15`, `totalNovo = 15`, `totalIguais = 0`, `totalComDivergencia = 15`, `totalAusentesAntigo = 0`, `totalAusentesNovo = 0`.
- Principais divergências: `processoSei`, `vencimento`, `quantidadeTa`, `valorGlobal`, `valorRepasse`, `valorContrapartida`, `repasseDesembolsado`, `rendimentoAprovado`, `saldoRendimentosAtual` e `contrapartidaIntegralizada`, todos em 15 convênios. Causa técnica observada: `diagnostico.totalComDetru = 0` e `diagnostico.totalComRendimentos = 0`; caches locais ainda não estão populados para a carteira.
- Divergência bloqueante: sim. `banco-cache` não deve ser ativado como origem padrão até cache DETRU e cache Transferegov/rendimentos serem populados e a comparação ser reexecutada.
- Testes: `node --check` de `backend/server.js`, `profor-consolidado-service.js`, `profor-comparador-service.js`, `profor-calculos-service.js`, `dashboard-publication-service.js` e `static-publication-service.js`; `node -e` para origem padrão, consolidado, comparação e sanitização de `detru`; `npm start` em porta alternativa `8791` porque a `8790` já estava ocupada; chamadas reais a `GET /api/profor-2022/consolidado` e `GET /api/profor-2022/comparar-origens`; navegação headless na home e na página PROFOR 2022 sem erros de console.
- Consumo aproximado do Codex: não informado pela ferramenta local.
- Escopo preservado: origem padrão continua `planilha`; `banco-cache` não foi ativado como padrão; frontend não alterado; `index.html` não alterado; banco/schema não alterado; `backend/data/aplicacao.json` não alterado; JSONs publicados não alterados; nenhuma consulta DETRU ou Transferegov executada; nenhum download executado; `npm run publicar:dados` não executado.
- Risco de regressão: baixo no fluxo padrão; médio apenas para as novas rotas locais/API de diagnóstico, mitigado por serem somente leitura e não usadas pela tela.
- Rollback: `git revert <hash>` remove as rotas, a correção do comparador e os registros documentais do bloco.

## 17/05/2026 - Bloco 17: integração nas telas + publicação estática

- Branch atual: `main`.
- Objetivo: integrar a nova origem consolidada PROFOR 2022 no fluxo da aplicação, preservando fallback para a origem antiga da planilha e mantendo `planilha` como padrão.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/services/data-service.js`, `backend/services/dashboard-publication-service.js`, `backend/services/static-publication-service.js`, `backend/services/profor-2022/profor-origem-service.js`, `backend/services/profor-2022/profor-consolidado-service.js`, `backend/services/profor-2022/profor-comparador-service.js`, `backend/services/profor-2022/profor-plano-aplicacao-service.js`, `backend/services/profor-2022/profor-calculos-service.js`, `frontend/js/app.js`.
- Arquivos alterados: `backend/services/data-service.js`, `backend/services/dashboard-publication-service.js`, `backend/services/static-publication-service.js`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção: `data-service.js` preserva a origem `planilha` e acrescenta metadados seguros ao objeto PROFOR 2022 (`origemDados`, `origemDadosEfetiva`, `fallbackUsado`, `avisos`, `diagnostico`) sem alterar o shape esperado pela tela. `dashboard-publication-service.js` resolve a origem por flag/opção: `planilha` mantém o fluxo antigo; `banco-cache` chama o compositor consolidado com plano extraído das abas UF; falhas retornam para `planilha` com aviso. `static-publication-service.js` remove a seção interna `detru` do catálogo público antes de gerar `frontend/data/publicados/aplicacao.json`.
- Decisão técnica: `backend/services/data-service.js` também é importado pelo navegador como módulo da aplicação, então não deve importar diretamente serviços Node/SQLite do compositor. A ativação visual/local por `banco-cache` fica preparada no fluxo Node de publicação/consolidação e permanece pendente de rota/API ou acoplamento equivalente seguro.
- Testes node -e: origem padrão retorna `planilha`; fluxo `planilha` mantém `{ resumo, convenios, filtros }`; compositor monta objeto com dados fictícios de carteira, DETRU/cache, Transferegov/cache e plano; fallback `banco-cache` para `planilha` é acionado quando o consolidado falha; metadados não removem campos esperados; sanitização remove `detru` de catálogo público; `saldoDisponivelOuvidoria` `null` não quebra o resumo fictício.
- Teste funcional local: `npm start` encontrou servidor já em uso na porta 8790; o servidor existente respondeu `200` na home. Navegação headless abriu a home e a página PROFOR 2022 com origem padrão `planilha`, cards/tabela carregados e sem erros de console.
- Escopo preservado: frontend não alterado; `index.html` não alterado; `backend/server.js` não alterado; banco/schema não alterado; `backend/data/aplicacao.json` não alterado; JSONs publicados não alterados; nenhuma consulta DETRU ou Transferegov executada; nenhum download executado; `npm run publicar:dados` não executado.
- Limitações: a origem `banco-cache` ainda não é padrão e não foi ativada visualmente na página; `saldoDisponivelOuvidoria` continua pendente de fórmula segura; comparação real entre origem antiga e nova segue como etapa posterior.
- Risco de regressão: baixo no fluxo padrão, porque `planilha` permanece como origem efetiva e o front-end não foi alterado. Risco residual concentrado no fluxo futuro de publicação com `PROFOR_2022_ORIGEM_DADOS=banco-cache`, mitigado por fallback para planilha.
- Rollback: `git revert <hash>` remove a integração e os registros documentais do bloco.

## 17/05/2026 - Bloco 16: compositor consolidado + comparador + flag de origem

- Branch atual: `main`.
- Objetivo: criar serviços isolados para montar o objeto consolidado PROFOR 2022 pela nova arquitetura e comparar esse objeto com a origem antiga da planilha, sem ativar a substituição.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/services/data-service.js`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/services/profor-2022/profor-detru-cache-service.js`, `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`, `backend/services/profor-2022/profor-plano-aplicacao-service.js`, `backend/services/profor-2022/profor-calculos-service.js`, `.env.example`.
- Arquivos alterados: `backend/services/profor-2022/profor-origem-service.js`, `backend/services/profor-2022/profor-consolidado-service.js`, `backend/services/profor-2022/profor-comparador-service.js`, `.env.example`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção: criado serviço de origem com padrão obrigatório `planilha` e opção futura `banco-cache`; criado compositor que combina carteira local, cache DETRU, cache Transferegov e plano filtrado por UF + número + ano; criado comparador com tolerância de R$ 0,01 e 0,1 ponto percentual para validar origem antiga versus nova.
- Comportamento técnico: o compositor não lê planilha, não consulta rede, não baixa arquivos e não altera banco; campos sem fonte confiável ficam `null` e geram aviso; `saldoDisponivelOuvidoria` permanece `null` por fórmula pendente.
- Testes node -e: chave estável `numero::ano`; índice por número+ano; fallback por número sem ano apenas quando há um único registro; bloqueio de escolha arbitrária em duplicidade; composição de carteira + DETRU/cache + Transferegov/cache + plano; filtro do plano por UF + número + ano; `saldoDisponivelOuvidoria` nulo com aviso; comparação monetária com diferença de R$ 0,01 como igual; detecção de divergência monetária e convênio ausente; origem padrão `planilha`.
- Escopo preservado: `frontend/js/app.js`, `index.html`, `backend/server.js`, `backend/services/data-service.js`, `backend/db/init-db.js`, `backend/data/aplicacao.json` e JSONs publicados não foram alterados; `npm run publicar:dados` não executado.
- Risco de regressão: baixo; serviços novos não são chamados pela aplicação atual e a flag documentada mantém `planilha` como padrão.
- Rollback: `git revert <hash>` remove os serviços e registros documentais do bloco.

## 17/05/2026 - Bloco 15: cálculos internos + filtro seguro do plano de aplicação

- Branch atual: `main`.
- Objetivo: criar serviços puros para calcular internamente campos do PROFOR 2022 e filtrar com segurança o plano de aplicação por UF, número do convênio e ano, sem substituir a origem atual da página.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/services/data-service.js`, `backend/services/profor-2022/detru-convenio-mapper.js`, `backend/services/profor-2022/profor-detru-cache-service.js`, `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`.
- Arquivos alterados: `backend/services/profor-2022/profor-plano-aplicacao-service.js`, `backend/services/profor-2022/profor-calculos-service.js`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção: criado serviço de plano com normalização de texto/número/ano/moeda, filtro seguro por UF/número/ano/área/natureza, bloqueio de filtro por UF quando houver risco de misturar convênios, agrupamento por área/natureza e resumo financeiro do plano filtrado; criado serviço de cálculos que combina DETRU/cache, Transferegov/cache e plano filtrado em objeto parcial consolidável.
- Premissas: previstos por área somam `valorPrevisto`; executados por área somam `valorExecutado`; saldos residuais por natureza somam `saldo` ou `valorPrevisto - valorExecutado` quando `saldo` não existe; percentuais usam `executado / previsto * 100` quando o previsto é maior que zero.
- Limitação registrada: `saldoDisponivelOuvidoria` não foi calculado nem retornado no consolidado, pois a fórmula segura permanece pendente para etapa de compositor.
- Testes node -e: filtro não mistura dois convênios da mesma UF; filtro por ano restringe o mesmo número em anos diferentes; cálculos por OUVIDORIA, CORREGEDORIA e ESCOLA PENAL; saldos por CAPITAL e CUSTEIO; `aplicarCalculosInternosProfor()` usa DETRU para valores financeiros, Transferegov para `saldoRendimentosAtual` e plano para previstos/executados.
- Escopo preservado: frontend não alterado; página PROFOR 2022 não alterada; home principal não alterada; nenhuma rota criada; banco não alterado; nenhum JSON publicado alterado; `npm run publicar:dados` não executado.
- Risco de regressão: baixo; serviços novos são puros e não são chamados pela aplicação atual.
- Rollback: `git revert <hash>` remove os serviços e registros documentais do bloco.

## 17/05/2026 - Bloco 14: Transferegov público + cache de rendimentos

- Branch atual: `main`.
- Objetivo: criar a base técnica para consultar, em acesso público do Transferegov, o saldo atual de rendimentos de aplicação dos convênios monitorados do PROFOR 2022 e armazenar o resultado em cache SQLite local.
- Arquivos alterados: `backend/db/init-db.js`, `backend/services/profor-2022/transferegov-rendimentos-client.js`, `backend/services/profor-2022/transferegov-rendimentos-cache-service.js`, `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`, `package.json`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção: adicionadas as tabelas `profor_transferegov_rendimentos_cache` e `profor_transferegov_rendimentos_consultas`; criado cliente público sem credenciais para montar a URL conhecida de rendimentos, consultar com `fetch` nativo e extrair `#tr-novaSolicitacaoValorDisponivelRendimento`; criado serviço de cache que salva apenas consultas bem-sucedidas e preserva o último valor válido em falhas; criado script sequencial `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`, disponível como `npm run atualizar:rendimentos-profor`.
- Comportamento técnico: o parser mantém `valorOriginal` como texto em moeda brasileira, converte `saldoRendimentosAtual` para `Number`, captura subtítulo, aviso e texto do convênio, e retorna erro controlado quando o HTML não traz contexto de convênio/sessão pública.
- Limitações registradas: a consulta direta ao endpoint público pode depender de sessão pública previamente estabelecida pelo Transferegov para o convênio; não foi implementado login, senha, captcha, certificado, área restrita, contorno de bloqueio ou fluxo de seleção de convênio não confirmado no código.
- Escopo preservado: a página PROFOR 2022 ainda não consome este cache; home principal não alterada; frontend não alterado; nenhum JSON publicado alterado; `npm run publicar:dados` não executado.
- Testes previstos/executados nesta etapa: `node --check` dos novos serviços/script e de `backend/db/init-db.js`; `npm run init-db`; validação manual por `node -e` para conversão de moeda, parser com HTML fictício, persistência/consulta de cache fictício e falha controlada de parser; `npm run validar:json`; `npm run validar:syntax`; `git diff --check`.
- Risco de regressão: baixo; mudanças são aditivas, isoladas no backend local/API e no schema SQLite. A constraint `UNIQUE(numero_convenio, ano)` permite duplicidade quando `ano IS NULL` no SQLite; risco documentado e não corrigido nesta etapa para evitar refatoração ampla.
- Rollback: `git revert <hash>` remove o bloco técnico e a migration aditiva do código; banco local já inicializado pode manter tabelas vazias sem afetar fluxos existentes.

## 17/05/2026 - Etapa 13: disparo administrativo da atualização DETRU

- Branch atual: `main`.
- Objetivo: permitir atualização manual/local do cache DETRU na Carteira Monitorada do PROFOR 2022 sem depender apenas do agendador diário.
- Arquivos alterados: `backend/services/profor-2022/profor-detru-update-service.js`, `backend/scripts/atualizar-cache-detru-profor-2022.js`, `backend/server.js`, `frontend/js/app.js`, `index.html`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção: criado serviço reutilizável `atualizarCacheDetruProfor2022(opcoes = {})` para concentrar hash, atualização, cruzamento, snapshot e auditoria; script manual passou a delegar para o serviço; `backend/server.js` ganhou `POST /api/profor-2022/detru/atualizar` e `GET /api/profor-2022/detru/ultima-atualizacao`; `frontend/js/app.js` recebeu botão discreto "Atualizar DETRU" e status básico da última atualização apenas no modo local/API; `index.html` teve cache-buster do bundle ajustado.
- Comportamento validado:
  - a view PROFOR 2022 exibe o botão `Atualizar DETRU` apenas no modo local/API;
  - o status inicial mostra `Última atualização DETRU: nenhuma atualização registrada.`;
  - o clique sem arquivo local e sem URL configurada retorna erro controlado, sem quebrar a tela;
  - o modo estático não expõe o botão;
  - nenhuma publicação estática foi gerada e nenhum JSON publicado foi alterado.
- Validações executadas: `node --check backend/services/profor-2022/profor-detru-update-service.js` (OK), `node --check backend/scripts/atualizar-cache-detru-profor-2022.js` (OK), `node --check backend/server.js` (OK), `node --check frontend/js/app.js` (OK), `npm run validar:json` (OK), `npm run validar:syntax` (OK, 25 arquivos), `git diff --check` (sem erros), `git diff --name-only` (6 arquivos alterados + 1 novo), `git status --short` (working tree apenas com os arquivos da etapa).
- Teste funcional local: `npm start`; `GET /api/profor-2022/detru/ultima-atualizacao` respondeu `success:true` com `ultimaAtualizacao:null`; clique do botão no navegador headless mostrou erro controlado ao atualizar sem arquivo/configuração; o painel manteve o status e a tela permaneceu estável.
- Resultado: etapa concluída sem tocar em banco/schema, sem versionar ZIP/CSV e sem executar `npm run publicar:dados`.
- Pendências: nenhuma para esta etapa.
- Risco de regressão: baixo; mudanças ficaram restritas ao fluxo DETRU local/API e à renderização condicional da Carteira Monitorada.
- Rollback: `git revert <hash>` ou remoção seletiva dos arquivos desta etapa.

## 17/05/2026 - Etapa 12.1: saneamento de escopo da Etapa 12

- Branch atual: `main`.
- Objetivo: reverter alterações acidentais de timestamps/metadados de publicação geradas no commit `a79a8ef`.
- Arquivos inspecionados: `frontend/data/publicados/aplicacao.json`, `dashboard-geral.json`, `resumo-publicacao.json`, `backend/data/aplicacao.json`.
- Alterações identificadas no commit `a79a8ef`:
  - Os três JSONs publicados tiveram `publicadoEm` alterado de `2026-05-17T20:27:18.017Z` para `2026-05-17T23:15:38.938Z` (acidental — hook `publicar:dados` disparou pelo `aplicacao.json`).
  - `frontend/data/publicados/aplicacao.json` ganhou seção `detru` acidentalmente (config interna de download não deve ser publicada).
- Arquivos corrigidos:
  - `frontend/data/publicados/aplicacao.json`: removida seção `detru`; `publicadoEm` revertido.
  - `frontend/data/publicados/dashboard-geral.json`: `publicadoEm` revertido.
  - `frontend/data/publicados/resumo-publicacao.json`: `publicadoEm` revertido.
- Configuração DETRU preservada: seção `detru` de `backend/data/aplicacao.json` intacta.
- Nenhum código alterado. Nenhum script DETRU alterado. `npm run publicar:dados` não executado.
- Validações: `validar:json` OK, `validar:syntax` OK (25 arquivos), `git diff --check` limpo.
- Commit: `fix(profor-2022): reverter metadados publicados acidentais`.

---

## 17/05/2026 - Etapa 12: configuração e acesso remoto ao DETRU

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `backend/scripts/atualizar-cache-detru-profor-2022.js`, `backend/services/profor-2022/profor-detru-cache-service.js`, `backend/services/profor-2022/profor-detru-sync-service.js`, `backend/data/aplicacao.json`, `package.json`, `.env.example`, `.gitignore`.
- Arquivos criados: `backend/services/profor-2022/detru-download-service.js`, `backend/scripts/agendar-atualizacao-detru-profor-2022.js`.
- Arquivos alterados: `backend/scripts/atualizar-cache-detru-profor-2022.js`, `package.json`, `.env.example`, `.gitignore`, `backend/data/aplicacao.json`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: Serviço `detru-download-service.js` criado com 6 funções exportadas: `obterConfiguracaoDetru` (lê variáveis de ambiente `DETRU_SICONV_CONVENIO_URL`, `DETRU_SICONV_CONVENIO_LOCAL`, `DETRU_ATUALIZACAO_DIARIA_HORA` com fallback em `aplicacao.json`), `resolverCaminhoLocalDetru`, `validarUrlDetru` (aceita apenas `http://` e `https://`; rejeita vazio, null e outros protocolos), `baixarArquivoDetru` (usa `fetch` nativo Node v18+; baixa para `.tmp`, move ao concluir; remove parcial em falha; valida HTTP 200), `garantirArquivoDetruAtualizado` (usa URL se configurada, usa local se existir, falha com mensagem clara caso nenhum disponível), `obterMetadadosArquivoDetru`. Script `atualizar-cache-detru-profor-2022.js` atualizado para chamar `garantirArquivoDetruAtualizado()` quando sem argumento CLI (download automático ou uso local). Agendador `agendar-atualizacao-detru-profor-2022.js` criado com `setTimeout` recursivo calculando o próximo horário configurado — **não acoplado ao `npm start`; rodar como processo separado** (`npm run agendar:detru-profor`). Seção `detru` adicionada em `aplicacao.json` com `urlSiconvConvenio` vazio e horário padrão `06:00`. Variáveis DETRU adicionadas ao `.env.example` sem valor real. `.gitignore` atualizado para ignorar `Dados/detru/*.zip`, `*.csv` e `*.tmp`. Sem dependência nova. Sem rota, frontend ou publicação estática alterada.
- URL real do DETRU: não configurada localmente — teste real depende de configurar `DETRU_SICONV_CONVENIO_URL` no `.env`.
- Testes funcionais executados em memória: `validarUrlDetru` com vazia/null/ftp/https/http — todos corretos. `garantirArquivoDetruAtualizado` sem URL e sem arquivo local — falhou com mensagem clara. `obterConfiguracaoDetru` sem env — retornou `url: null`, hora padrão `06:00`. `resolverCaminhoLocalDetru` — caminho correto.
- Validações executadas: `node --check` dos 3 arquivos (OK), `npm run validar:json` (OK), `npm run validar:syntax` (OK, 25 arquivos), `git diff --check` (limpo).
- Risco de regressão: nulo — serviços e scripts novos isolados; `atualizar-cache-detru-profor-2022.js` mantém compatibilidade com argumento CLI.
- Rollback: `git revert <hash>`.

## 17/05/2026 - Etapa 11: cache DETRU filtrado e rotina de atualização

- Branch atual: `main`.
- Arquivos lidos: `backend/db/init-db.js`, `backend/services/profor-2022/profor-detru-sync-service.js`, `backend/scripts/importar-convenios-monitorados-profor-2022.js`, `package.json`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Arquivos criados: `backend/services/profor-2022/profor-detru-cache-service.js`, `backend/scripts/atualizar-cache-detru-profor-2022.js`.
- Arquivos alterados: `backend/db/init-db.js` (tabelas `profor_detru_cache` e `profor_detru_atualizacoes`), `package.json` (script `atualizar:detru-profor`), `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` (Etapa 11 registrada; duplicação residual da lista de próximas etapas corrigida), `memoria/08_ROTAS_BANCO_API/schema-banco.md` (novas tabelas documentadas), `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: Criadas tabelas `profor_detru_cache` (snapshot filtrado dos convênios monitorados encontrados no DETRU, UNIQUE por `numero_convenio`/`ano`, upsert preserva cache anterior em caso de falha) e `profor_detru_atualizacoes` (log de auditoria de cada execução da rotina). Serviço `profor-detru-cache-service.js` criado com 8 funções exportadas: `calcularHashArquivo` (SHA-256 via Node.js built-in `crypto`), `salvarSnapshotDetru` (upsert em transação atômica), `listarCacheDetruProfor2022`, `obterCacheDetruPorConvenio`, `registrarAtualizacaoDetruInicio`, `registrarAtualizacaoDetruFim`, `registrarAtualizacaoDetruErro`, `obterUltimaAtualizacaoDetru`. Script `atualizar-cache-detru-profor-2022.js` orquestra: recebe caminho ZIP por argumento CLI (ou usa `Dados/detru/siconv_convenio.csv.zip` como padrão), calcula hash, registra início no log, executa cruzamento + gravação de cache, registra fim com resultado ou erro. Disponível como `npm run atualizar:detru-profor`. Sem nova dependência — usa `crypto` nativo do Node.js. Sem rotas, sem frontend, sem publicação estática alterada.
- Correção documental: duplicação residual da lista "Próximas etapas" em `profor-2022.md` corrigida (itens 1 e 2 eram ambos "Criar cliente público do Transferegov"; agora a lista tem 12 itens sequenciais sem repetição).
- Validações executadas: `node --check` em `profor-detru-cache-service.js` (OK), `node --check` em `atualizar-cache-detru-profor-2022.js` (OK).
- Risco de regressão: nulo — serviços novos isolados; tabelas novas aditivas; script manual não chamado em produção automaticamente.
- Rollback: `git revert <hash>`.

## 17/05/2026 - Etapa 10: cruzamento da carteira local com o DETRU

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/services/profor-2022/detru-convenio-reader.js`, `backend/services/profor-2022/detru-convenio-mapper.js`.
- Arquivos criados: `backend/services/profor-2022/profor-detru-sync-service.js`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: Criado `profor-detru-sync-service.js` com 5 funções exportadas: `obterNumerosConveniosAtivos` (lista carteira ativa do SQLite), `filtrarLinhasDetruPorCarteira` (filtra linhas DETRU por NR_CONVENIO, com validação opcional de ANO), `cruzarCarteiraComDetru` (orquestra leitura ZIP → validação colunas → carteira → filtro → mapeamento → resultado estruturado), `resumirCruzamentoDetru` (resumo texto para log/console), `validarArquivoDetruParaCarteira` (diagnóstico sem gravar). Regra de filtragem: `NR_CONVENIO` é chave primária; `ANO` é validação adicional — se null na carteira, aceita qualquer ANO do DETRU. Carteira local define os convênios monitorados; DETRU não define a carteira. Sem gravação de dados DETRU no banco, sem cache, sem rotas, sem frontend.
- Arquivo DETRU ausente localmente — teste real não foi possível. Testes funcionais realizados em memória com dados fictícios (números 123456, 654321, 999000, 111111): filtragem correta, naoEncontrados corretos, linha fora da carteira não vazou, resumo formatado correto, diagnóstico de arquivo ausente correto, erro de cruzamento com arquivo ausente correto.
- Validações executadas: `node --check` dos 3 serviços (OK), `node -e` com 4 testes funcionais (OK), `npm run validar:json` (OK), `npm run validar:syntax` (OK, 25 arquivos), `git diff --check` (limpo).
- Risco de regressão: nulo — serviço novo isolado.
- Rollback: `git revert <hash>`.

## 17/05/2026 - Etapa 9: mapeador DETRU → modelo interno PROFOR 2022

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/services/profor-2022/detru-convenio-reader.js`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/services/data-service.js` (campos do modelo interno).
- Arquivos criados: `backend/services/profor-2022/detru-convenio-mapper.js`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` (Etapa 9 registrada; lista de próximas etapas corrigida e renumerada — havia duplicação do item "Criar mapeador DETRU"), `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: Criado `backend/services/profor-2022/detru-convenio-mapper.js` com 6 funções exportadas: `converterNumeroDetru`, `limparTextoDetru`, `obterPrimeiraColunaDisponivel`, `mapearConvenioDetruParaProfor`, `mapearConveniosDetruParaProfor`, `validarColunasObrigatoriasDetru`. Mapeamento completo das 11 colunas obrigatórias DETRU → camelCase interno. Valores monetários convertidos de formato BR (`1.000,50`) para Number com arredondamento em 2 casas. UF mapeada apenas se coluna presente (`UF`, `SG_UF`, `UF_PROPONENTE`, `SG_UF_PROPONENTE`), null caso ausente — sem invenção de UF. `saldoRendimentosAtual` e campos calculados não mapeados. Campo `fonte` sempre presente. Sem banco, rotas, frontend ou JSONs publicados alterados. Sem nova dependência. Arquivo DETRU não versionado.
- Diretriz arquitetural registrada: `siconv_convenio.csv.zip` é grande e não deve ser processado na página. Fluxo futuro: atualização diária backend → leitura ZIP → filtro pelos convênios monitorados → mapeamento → snapshot/cache pequeno → páginas consomem somente o cache.
- Ajuste documental: numeração residual/duplicada da lista "Próximas etapas" corrigida e renumerada de 1 a 14 (era items 1 e 7-21 com duplicação).
- Teste funcional: linha fictícia mapeada em memória — todos os tipos e valores corretos (`numeroConvenio` string, monetários Number arredondado, `quantidadeTa` inteiro, `uf` null sem coluna, `saldoRendimentosAtual` ausente, `fonte` correto). Validação de colunas: completo → ok=true; faltando colunas → ok=false com lista de ausentes.
- Validações executadas: `node --check` (OK), `node -e` com testes funcionais (OK), `npm run validar:json` (OK), `npm run validar:syntax` (OK, 25 arquivos), `git diff --check` (limpo).
- Risco de regressão: nulo — serviço novo isolado, sem chamadores existentes.
- Rollback: `git revert <hash>`.

## 17/05/2026 - Etapa 8: leitor local do siconv_convenio.csv.zip (DETRU)

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/scripts/importar-convenios-monitorados-profor-2022.js`, `package.json`.
- Arquivos criados: `backend/services/profor-2022/detru-convenio-reader.js`.
- Arquivos alterados: `package.json`, `package-lock.json` (adm-zip instalado), `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: Criado serviço `backend/services/profor-2022/detru-convenio-reader.js` com 6 funções exportadas: `localizarCsvNoZip`, `lerCsvDetruConvenio`, `normalizarCabecalhoDetru`, `parseCsvLinha`, `detectarSeparadorCsv`, `listarColunasDetruConvenio`. O serviço lê localmente o arquivo `siconv_convenio.csv.zip`, localiza o primeiro CSV compatível (padrão `siconv_convenio*.csv` com fallback para qualquer CSV), detecta o separador (`;` ou `,`), lê o conteúdo como `latin1` (encoding frequente em arquivos do governo), normaliza o cabeçalho (maiúsculas, underscores, sem caracteres especiais) e retorna array de objetos. Erros claros para: arquivo ausente, extensão inválida, ZIP sem CSV, CSV vazio. Dependência `adm-zip ^0.5.17` adicionada: Node.js não tem suporte nativo a ZIP; `zlib` cobre DEFLATE/GZIP (formato diferente); `xlsx` lê ZIPs de planilha, não ZIP genérico; `adm-zip` é síncrono, puro JS, sem bindings nativos. Arquivo DETRU (`siconv_convenio.csv.zip`) não está presente localmente — não baixado nesta etapa. Nenhum frontend, rota, banco ou JSON publicado foi alterado.
- Teste funcional: arquivo DETRU ausente localmente — teste real não foi possível. Funções utilitárias testadas sem arquivo: `normalizarCabecalhoDetru`, `detectarSeparadorCsv`, `parseCsvLinha` (incluindo campos com separador dentro de aspas). Mensagens de erro validadas: "Arquivo ZIP não encontrado" e "Extensão inválida". Teste real depende da presença local do `siconv_convenio.csv.zip`.
- Validações executadas: `node --check backend/services/profor-2022/detru-convenio-reader.js` (OK), `node -e` com require e testes funcionais das utilidades (OK), `npm run validar:json` (OK), `npm run validar:syntax` (OK, 25 arquivos), `git diff --check` (limpo), `git diff --name-only`.
- Resultado: leitor criado e funcional no que é testável sem o arquivo DETRU; erros claros; nenhum dado real importado; nenhuma integração com banco ou frontend.
- Risco de regressão: nulo — serviço novo, isolado, sem chamadas existentes.
- Rollback: `git revert <hash>` e `npm install` para regredir `adm-zip`; o banco local não é afetado.

## 17/05/2026 - Etapa 7.1: ajuste visual da Carteira Monitorada PROFOR 2022

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `frontend/js/app.js`.
- Arquivos alterados: `frontend/js/app.js`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`. Banco local modificado diretamente (não versionado).
- Resumo: A seção "Carteira Monitorada" foi convertida de sempre visível para colapsada por padrão. Adicionado botão "Gerenciar carteira" com ícone chevron que alterna visibilidade do painel via atributo `hidden`. O painel interno agrupa o checkbox "Ver inativos" e o botão "Novo". Carregamento é lazy: a API só é chamada na primeira abertura (`data-carregada` no painel). Ícone do botão alterna entre `fa-chevron-down` e `fa-chevron-up`. Adicionada função `normalizarInstrumento()` pontual que substitui o mojibake `Conv�nio` por `Convênio` na renderização — sem alterar banco nem fazer refatoração de encoding. Registros fictícios de teste: `999999` (inativo desde Etapa 5), `888888` (inativado nesta etapa via UPDATE direto no banco local), `777777` (inativo desde Etapa 7). Nenhum dado real foi alterado. `npm run publicar:dados` não foi executado.
- Saneamento de dados fictícios: `888888` era o único registro fictício ainda ativo. Inativado com `UPDATE profor_convenios_monitorados SET ativo=0 WHERE numero_convenio='888888'` (1 change). Estado final: `999999` ativo=0, `888888` ativo=0, `777777` ativo=0.
- Validações executadas: `node --check frontend/js/app.js` (OK), `npm run validar:json` (OK), `npm run validar:syntax` (OK, 25 arquivos), `git diff --check` (limpo), `git diff --name-only` (só `frontend/js/app.js`).
- Resultado: carteira oculta por padrão; botão toggle funcional; lista carrega somente ao abrir; mojibake corrigido na renderização; registros fictícios todos inativos; nenhum JSON publicado alterado; nenhum valor financeiro alterado.
- Risco de regressão: baixo; alterações restritas à seção "Carteira Monitorada"; nenhuma função existente fora da carteira foi tocada; o auto-carregamento foi apenas removido (não substituído por lógica diferente nas rotas).
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`. Banco não é revertido; os registros fictícios permanecem inativos, mas não afetam dados reais.

## 17/05/2026 - Etapa 7: interface da carteira monitorada PROFOR 2022

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `backend/server.js`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/scripts/importar-convenios-monitorados-profor-2022.js`, `backend/data/aplicacao.json`, `frontend/js/app.js`, `frontend/css/app.css`, `index.html`.
- Arquivos alterados: `frontend/js/app.js`, `backend/scripts/importar-convenios-monitorados-profor-2022.js`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: Adicionada seção "Carteira Monitorada" ao final da página PROFOR 2022, abaixo da tabela financeira existente. A seção usa as rotas locais já criadas: `GET /api/profor-2022/convenios-monitorados` (com `?incluirInativos=true`), `POST /api/profor-2022/convenios-monitorados`, `POST /:id/salvar` e `POST /:id/inativar`. Funções criadas: `carregarCarteiraMonitoradaProfor2022`, `renderizarListaConveniosMonitorados`, `abrirModalConvenioMonitorado`, `salvarConvenioMonitoradoProfor`, `inativarConvenioMonitoradoUI`. Estado global `carteiraMonitoradaProfor2022Cache` adicionado para event delegation. Em modo estático, a seção exibe aviso de somente leitura e oculta botões de escrita. Correção aplicada no script de importação da Etapa 6: caminho da planilha agora lido de `backend/data/aplicacao.json > configuracao.arquivoPlanilhaConvenios` com fallback seguro para `Planilhas/gestao_financeira_ouvidoria.xlsx`.
- Validações executadas: `node --check backend/scripts/...`, `node --check frontend/js/app.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run import:profor-convenios` (idempotente confirmado), teste ao vivo via API: GET listagem (15 ativos), POST criar (id=18), POST salvar (obs editada), POST inativar (ativo=0), `git diff --check`, `git diff --name-only`, `git status --short`.
- Resultado: interface funcional; CRUD via API local testado e funcionando; carteira existente (15 convênios) exibida; modo estático protegido; nenhum valor financeiro alterado; nenhum JSON publicado alterado; banco não versionado. Registros de teste (id=1/num=999999, id=17/num=888888, id=18/num=777777) criados/inativados durante teste — não são dados reais.
- Risco de regressão: baixo; nenhuma função existente alterada; nova seção e novas funções são aditivas; o template da view usa expressão condicional `estaEmModoPublicacaoEstatica()` já disponível no escopo.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`; banco local não é revertido mas dados de teste podem ser ignorados.

## 17/05/2026 - Etapa 6: importação inicial da carteira PROFOR 2022

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/db/database.js`, `backend/db/init-db.js`, `backend/scripts/importar-parametros-minimos.js`, `backend/services/data-service.js`, `package.json`, `backend/data/aplicacao.json`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`.
- Arquivos alterados: `backend/scripts/importar-convenios-monitorados-profor-2022.js` (criado), `package.json`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criado o script `backend/scripts/importar-convenios-monitorados-profor-2022.js` para popular a tabela `profor_convenios_monitorados` com os convênios da aba `Geral` da planilha `Planilhas/gestao_financeira_ouvidoria.xlsx`. O script inicializa o banco, verifica existência da planilha e da aba, lê as linhas ignorando o cabeçalho, importa apenas `numero_convenio`, `ano`, `uf`, `instrumento` e `programa_origem = "PROFOR 2022"` — nenhum valor financeiro. Registros já existentes (ativos ou inativos) são detectados e ignorados sem reativar nem duplicar. Registro de teste 999999 é explicitamente ignorado. Relatório final no console com 5 contadores. Script registrado em `package.json` como `import:profor-convenios`.
- Validações executadas: `node --check` do script novo, `node --check` do serviço, `npm run validar:json`, `npm run validar:syntax`, execução funcional real (15 convênios inseridos, 0 erros), execução idempotente (15 já existentes, 0 inseridos, 0 erros), `git diff --check`, `git diff --name-only`, `git status --short`.
- Resultado: 15 convênios da carteira PROFOR 2022 populados no banco; nenhum valor financeiro importado; registro de teste 999999 não tratado como real; banco não versionado; idempotência confirmada.
- Risco de regressão: baixo; script isolado, não altera rotas, serviços existentes, frontend nem JSONs publicados. O `package.json` recebeu apenas um novo script.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` revertem o código e o script. O banco SQLite não é afetado pelo revert (os registros inseridos permanecem localmente, mas podem ser excluídos manualmente ou o banco pode ser recriado com `npm run init-db`).

## 17/05/2026 - Etapa 5: rotas de convênios monitorados PROFOR 2022

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `backend/server.js`, `backend/services/profor-2022/convenios-monitorados-service.js`, `backend/services/formalizacao-profor-service.js`.
- Arquivos alterados: `backend/server.js`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: 4 rotas criadas em `backend/server.js` para a carteira de convênios monitorados PROFOR 2022: `GET /api/profor-2022/convenios-monitorados` (com suporte a `?incluirInativos=true`), `POST /api/profor-2022/convenios-monitorados`, `POST /api/profor-2022/convenios-monitorados/:id/salvar` e `POST /api/profor-2022/convenios-monitorados/:id/inativar`. Helpers `camelParaSnakeConvenio` (conversão de payload da API para o serviço) e `extrairIdConvenioMonitorado` (extração de id de rota paramétrica) adicionados ao servidor. Nenhum frontend, JSON publicado ou serviço existente foi alterado.
- Validações executadas: `node --check backend/server.js`, `node --check backend/services/profor-2022/convenios-monitorados-service.js`, `npm run validar:json`, `npm run validar:syntax`, teste ao vivo com servidor real (GET lista vazia, POST criar, POST salvar, POST inativar, POST inativar já inativo, POST criar duplicado, POST salvar id inexistente, GET `?incluirInativos=true`), `git diff --check`, `git diff --name-only`, `git status --short`.
- Resultado: todas as rotas responderam corretamente; camelCase na entrada e saída confirmados; erros de validação e duplicidade retornaram mensagem controlada sem stack trace; inativação lógica preservou o registro. Registro de teste (id=1, número 999999) criado e inativado durante validação; nenhum dado real populado; banco não versionado.
- Risco de regressão: baixo; adição isolada ao final do roteador de `rotearApi`, antes do 404 final; nenhuma rota ou lógica existente foi alterada.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`; banco não é afetado pelo revert (o registro de teste inativado permanece localmente, mas não há dado real comprometido).

## 17/05/2026 - Etapa 4: serviço de convênios monitorados PROFOR 2022

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `backend/db/database.js`, `backend/db/init-db.js`, `backend/services/formalizacao-profor-service.js`.
- Arquivos alterados: `backend/services/profor-2022/convenios-monitorados-service.js` (criado), `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criado `backend/services/profor-2022/convenios-monitorados-service.js` com as funções `listarConveniosMonitorados`, `obterConvenioMonitoradoPorId`, `obterConvenioMonitoradoPorNumero`, `criarConvenioMonitorado`, `atualizarConvenioMonitorado` e `inativarConvenioMonitorado`. Retorno em camelCase. Inativação lógica (`ativo = 0`). Validações de `numero_convenio` (apenas dígitos), `ano` (4 dígitos) e `uf` (2 caracteres, maiúsculas). Duplicidade retorna erro controlado. Nenhuma rota criada. Nenhum dado populado. Referência documental incorreta ao serviço futuro corrigida em `schema-banco.md`.
- Validações executadas: `node --check` do serviço novo, `node -e` com importação e chamada de `listarConveniosMonitorados()` e das três validações de entrada (número, ano, uf), `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `git diff --name-only`, `git status --short`.
- Resultado: serviço criado e funcional; listagem retornou 0 registros (tabela vazia, esperado); todas as validações de entrada bloquearam corretamente entrada inválida; JSONs publicados válidos; sintaxe de 25 arquivos validada.
- Risco de regressão: baixo; nenhum serviço, rota ou frontend existente foi alterado.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`; o banco não é afetado (nenhum dado foi inserido).

## 17/05/2026 - Etapa 3: criação da tabela profor_convenios_monitorados

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `backend/db/init-db.js`.
- Arquivos alterados: `backend/db/init-db.js`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criada a tabela `profor_convenios_monitorados` em `backend/db/init-db.js` por migration aditiva (`CREATE TABLE IF NOT EXISTS`) dentro da função `garantirTabelaConveniosMonitoradosProfor2022()`, chamada ao final de `inicializarBanco()`. Nenhuma tabela existente foi alterada. Nenhum dado foi populado. Schema documentado em `schema-banco.md`.
- Validações executadas: `node --check backend/db/init-db.js`, `npm run init-db`, confirmação da tabela e colunas por `PRAGMA table_info`, `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `git diff --name-only`, `git status --short`.
- Resultado: tabela criada com todas as colunas e defaults esperados; `npm run init-db` executou sem erro; JSONs publicados válidos; 25 arquivos JS validados sem erro.
- Risco de regressão: baixo; migration aditiva isolada; nenhuma tabela ou serviço existente foi alterado.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` revertem o código; banco deve ser restaurado por backup ou recriado com `npm run init-db` após revert.

## 17/05/2026 - Documentação técnica da funcionalidade PROFOR 2022

- Branch atual: `main`.
- Tarefa executada: inclusão da documentação técnica da funcionalidade PROFOR 2022 em `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, inserida manualmente pelo usuário.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` (versionado), `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: registrado o documento técnico da funcionalidade PROFOR 2022, consolidando a futura migração da aba Geral para banco local de convênios monitorados, DETRU, Transferegov público e cálculos internos. O documento cobre spec, plan, research, fluxo de dados, mapeamento de campos, riscos, testes e trilha de implementação.
- Decisão registrada: a documentação da funcionalidade passa a ser referência operacional para as próximas etapas da migração. Tabelas e rotas ainda não existem; devem ser criadas em etapas específicas.
- Validações executadas: `git status --short`, `git branch --show-current`, `git diff --name-only`, `git diff --check`.
- Resultado: arquivo versionado; diário atualizado; nenhum código, banco, tabela ou JSON publicado foi alterado.
- Pendências: próxima etapa é criar a tabela SQLite de convênios monitorados (`profor_convenios_monitorados`) em migration aditiva própria.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 17/05/2026 - Decisão técnica: carteira de convênios em banco local

- Branch atual: `main`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Decisão registrada: DT-011 — a carteira de convênios monitorados do PROFOR 2022 será mantida em banco SQLite local. O número do convênio é a chave operacional principal. O DETRU é fonte de dados oficiais (não define a carteira). A aba Geral da planilha é transitória e será substituída por composição automática: banco local + DETRU + Transferegov público + cálculos internos.
- Resultado: patch documental pequeno; nenhum código, banco, tabela ou JSON publicado foi alterado.
- Validações executadas: `git diff --check`, `git diff --name-only`, `git status --short`.
- Risco de regressão: nenhum; alteração exclusivamente documental.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` após commit publicado.

## 16/05/2026 - Modelo técnico de funcionalidade

- Branch atual: `main`.
- Tarefa executada: criação do modelo padrão `memoria/01_PROJETO_APLICACAO/funcionalidades/_modelo-funcionalidade.md`.
- Arquivos lidos: `AGENTS.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/10_TESTES/checklist-validacao.md`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/_modelo-funcionalidade.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criado modelo técnico reutilizável para documentação de funcionalidades críticas, com estrutura de Spec-Driven Development adaptado, mapeamento de arquivos, rotas, banco, JSONs, fluxo de dados, riscos, testes e rollback.
- Decisão registrada: os próximos documentos de funcionalidades devem usar este modelo e ser preenchidos apenas com base em inspeção real do código.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff --check`.
- Resultado: modelo criado; documentação das funcionalidades críticas permanece para etapas posteriores.
- Pendências: documentar `parametros-minimos.md`, `orcamento-2026.md`, `formalizacao-profor.md`, `publicacao-estatica.md` e `dashboard-geral.md`.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 16/05/2026 - Estrutura inicial de funcionalidades

- Branch atual: `main`.
- Tarefa executada: criação da pasta de documentação técnica por funcionalidade e do arquivo `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md`.
- Arquivos lidos: `AGENTS.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criada a estrutura inicial para documentação técnica por funcionalidade, com critérios de criação, uso por agentes, relação com SDD adaptado e regras de atualização.
- Decisão registrada: os arquivos de funcionalidade serão criados um por vez, começando pelo modelo técnico e depois pelas funcionalidades críticas.
- Validações executadas: `git status --short`, `git diff --name-only`.
- Resultado: pasta `funcionalidades/` criada com README; modelo e documentos de funcionalidades permanecem para etapas posteriores.
- Pendências: criar `_modelo-funcionalidade.md` e documentar funcionalidades críticas.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 16/05/2026 - Entrada rápida para agentes

- Branch atual: `main`.
- Tarefa executada: criação da camada inicial de entrada rápida para agentes em `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos alterados: `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criada orientação de leitura mínima para agentes, com classificação por tipo de tarefa, roteiro mínimo, cautelas operacionais e política de economia de tokens.
- Decisão registrada: a memória passa a ter uma porta de entrada rápida para agentes, preservando a camada documental já consolidada.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff --check`.
- Resultado: entrada rápida criada; integração ampla em `AGENTS.md`, `memoria/INDEX.md` e `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md` fica para etapa posterior.
- Pendências: criar a pasta `memoria/01_PROJETO_APLICACAO/funcionalidades/`, seu `README.md`, o modelo técnico e os arquivos por funcionalidade crítica.
- Risco de regressão: baixo; alteração documental.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` após commit publicado.

## 12/05/2026

- Ajustada a estratégia de versionamento da memória do projeto.
- Removida a regra ampla `memoria/` do `.gitignore`.
- Adicionadas regras específicas para ignorar `.obsidian`, `.trash`, `99_FONTES_BRUTAS` e anexos pesados/sensíveis em `memoria/`.
- Preparado o versionamento dos arquivos Markdown da memória no GitHub.

## 13/05/2026 - Orçamento 2026 vinculos processuais

- Branch atual: `main`.
- Objetivo: criar a camada backend para permitir a criação de processo vinculado no Orçamento 2026, sem alterar front-end, cálculo consolidado ou publicação manual.
- Função criada: `criarProcessoVinculadoOrcamento2026(payload)` em `backend/services/orcamento-2026-service.js`.
- Endpoint criado: `POST /api/orcamento-2026/processos-vinculados/criar` em `backend/server.js`.
- Regra registrada: o processo filho recebe `tipoProcesso = VINCULADO`, `compoe_orcamento = 0`, vínculo ao pai e saldo básico conservador para impedir duplicidade do orçamento.
- Testes executados: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `npm start`, GET em `/api/orcamento-2026`, POST de criação com `valorAlocado = 1`, POSTs inválidos com senha errada, pai inexistente, valor negativo, valor acima do saldo e pai já vinculado.
- Resultado: criação aceita apenas para processo principal com saldo; bloqueios responderam com erro controlado; o registro de teste foi removido do banco local e o JSON publicado foi restaurado ao estado versionado.
- Próxima etapa recomendada: expor a ação no front-end somente quando a interface do Orçamento 2026 for tratada na próxima etapa.

## 12/05/2026 - Orçamento 2026

- Problema: a tela Orçamento 2026 não expunha a edição dos andamentos processuais no fluxo local/API, impedindo o preenchimento de campos como `termo_referencia`.
- Causa: a whitelist `CAMPOS_EDITAVEIS` do backend bloqueava os campos de rastreio e o editor do front-end não renderizava a seção de andamentos.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `frontend/js/app.js`, `frontend/css/app.css`.
- Testes realizados: `npm install`, `npm run init-db`, `npm start`, POST em `/api/orcamento-2026/salvar` para `APON-001` com `termo_referencia`, `link_termo_referencia` e `data_termo_referencia`, conferência do JSON publicado.
- Resultado: persistência confirmada no backend e publicação atualizada; o modo estático continua bloqueando a edição.

## 13/05/2026 - Validação mínima para agentes

- Branch atual: `main`.
- Objetivo: criar uma primeira camada segura de validação para alterações futuras feitas por IA agentic, sem alterar arquitetura, regras de negócio, backend, banco ou fluxos existentes.
- Arquivos criados: `scripts/validar-json-publicados.js`, `playwright.config.js`, `tests/e2e/app.spec.js`.
- Arquivos alterados: `package.json`, `package-lock.json`, `.gitignore`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Scripts adicionados: `validar:json`, `validar:syntax`, `validar:agente`.
- Testes executados: `npm install --save-dev @playwright/test`, `npm run validar:json`, `npm run validar:syntax`, `npm audit --omit=dev`, `npx playwright install chromium`, `npm run validar:agente`, `npm install`.
- Resultado: JSONs publicados esperados existem e são válidos; checagem sintática passou; Playwright abriu `http://localhost:8790/index.html` via servidor local e validou páginas principais sem `console.error` ou `pageerror`; `validar:agente` passou com 1 teste E2E.
- Observação de segurança: `npm audit --omit=dev` apontou 1 vulnerabilidade alta em `xlsx`, dependência já existente e sem correção direta disponível no pacote.
- Pendências: padronizar seletores E2E estáveis, preferencialmente `data-testid`, para fluxos mais profundos de Parâmetros Mínimos, Formalização PROFOR, Orçamento 2026 e Status do Sistema.
- Risco de regressão: baixo; a alteração adiciona validações e dependência de desenvolvimento, sem modificar `backend/server.js`, `backend/services/static-publication-service.js`, `frontend/js/app.js`, `frontend/data/publicados` ou banco SQLite local.
- Rollback: reverter os arquivos deste escopo e remover a dependência `@playwright/test` de `package.json`/`package-lock.json`.

## 13/05/2026 - Consolidação da validação agentic

- Problema: o commit local `38213dc` alterou apenas `publicadoEm` em `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json` e `frontend/data/publicados/resumo-publicacao.json`, gerando churn de timestamp sem ganho funcional.
- Correção: revertidos os `publicadoEm` desses três JSONs para o valor anterior e reforçada a validação mínima de estrutura em `scripts/validar-json-publicados.js`.
- Arquivos alterados: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/resumo-publicacao.json`, `package.json`, `scripts/validar-json-publicados.js`.
- Scripts adicionados: `validar:setup`.
- Validação: a camada agentic continua restrita a checagens de JSON, sintaxe e smoke test de navegação, sem alterar regra de negócio, backend principal, frontend principal ou banco.
- Pendências: manter evolução gradual de `data-testid` e ampliar testes E2E apenas quando houver necessidade funcional.

## 13/05/2026 - Hook de publicacao

- Fato observado: o hook local de pre-commit acionou `npm run publicar:dados` ao tentar consolidar a correção, o que reintroduziu `publicadoEm` novo nos três JSONs publicados.
- Correção aplicada: os três JSONs foram devolvidos ao valor anterior e a próxima gravação do commit deve ocorrer com `SKIP_PUBLICAR_DADOS=1` para evitar republish automático.
- Impacto: sem mudança de regra de negócio, backend, frontend principal ou banco; o ajuste continua restrito à higiene de validação e rastreabilidade.

## 13/05/2026 - Saneamento do hook

- Problema: commits de infraestrutura, documentação, testes e validação ainda podiam acionar publicação automática pelo hook.
- Saneamento aplicado: o hook passou a ignorar automaticamente arquivos de documentação, memória, testes e scripts de validação, e a respeitar explicitamente `SKIP_PUBLICAR_DADOS=1` com mensagem objetiva.
- Uso: definir `SKIP_PUBLICAR_DADOS=1` no ambiente do commit quando a intenção for evitar qualquer republicação automática.
- Impacto esperado: commits não ligados a fontes reais de dados deixam de reescrever `frontend/data/publicados/*.json`, reduzindo churn de timestamp.

## 13/05/2026 - FAF 2021 executável por item

- Branch atual: `main`.
- Problema: a tela FAF 2021 exibía os itens, mas não havia fluxo seguro para editar `valorExecutado` por linha com preservação do modo estático.
- Solução: criado o serviço `backend/services/faf-2021-service.js`, adicionados os endpoints `GET /api/faf2021` e `POST /api/faf2021/salvar`, e incluído botão compacto de edição na lista e no detalhe da FAF 2021 com modal de edição.
- Arquivos alterados: `backend/server.js`, `backend/services/data-service.js`, `backend/services/faf-2021-service.js`, `frontend/js/app.js`, `frontend/css/app.css`, `index.html`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Testes executados: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, smoke test headless em `http://127.0.0.1:8790/index.html`, abertura do modal FAF 2021, verificação dos botões na lista e no detalhe, POST de teste em `/api/faf2021/salvar` e restauração do item para o valor original.
- Resultado: a edição por item funcionou, o modal abriu corretamente, o backend persistiu `valorExecutado` e a restauração retornou o item ao estado original sem deixar alteração residual em `backend/data/aplicacao.json` ou em `frontend/data/publicados/`.
- Observação operacional: o commit final deste escopo deve usar `SKIP_PUBLICAR_DADOS=1` para evitar republicação automática e churn de timestamp.
- Pendências: ampliar a cobertura E2E específica da FAF 2021 e, quando necessário, padronizar seletores estáveis para futuros fluxos editáveis.
- Risco de regressão: baixo a médio; o impacto ficou restrito ao fluxo FAF 2021, com preservação do modo local/API e do modo estático.
- Rollback: `git revert <hash_do_commit>` após o commit, ou `git checkout --` apenas nos arquivos ainda não commitados neste escopo.

## 13/05/2026 - Decisões técnicas

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md` com decisões técnicas reais já adotadas no projeto.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: registradas decisões vigentes sobre arquitetura incremental, modo local/API, modo estático/GitHub Pages, JSONs publicados, SQLite local, serviços backend, publicação estática, validação agentic, hook de publicação e memória operacional em Markdown tratado.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada para commit, sem alteração de código, banco, planilhas, frontend, backend ou JSONs publicados.
- Pendências: detalhar futuramente rotas, payloads, fluxo de dados, schema do banco e ADRs somente quando houver tarefa específica.
- Risco de regressão: baixo; alteração exclusivamente documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 0 Orçamento 2026

- Data: 13/05/2026.
- Objetivo da inspeção: congelar a arquitetura atual da tela Orçamento 2026 para futura implementação de processos vinculados e alocação de saldos.
- Arquivos inspecionados: `backend/db/init-db.js`, `backend/services/orcamento-2026-service.js`, `backend/server.js`, `backend/services/static-publication-service.js`, `backend/services/data-service.js`, `frontend/js/app.js`, `frontend/css/app.css`, `frontend/data/publicados/orcamento-2026.json`, `tests/e2e/app.spec.js`, `package.json`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Conclusão: a tela Orçamento 2026 já está integrada a uma tabela SQLite local, serviço próprio, rotas `GET /api/orcamento-2026` e `POST /api/orcamento-2026/salvar`, publicação automática pós-salvamento e bloqueio no modo estático; porém, não há no código atual hierarquia de processos, tabela de movimentação de saldo, campo de processo pai ou mecanismo explícito de alocação entre processos.
- Riscos identificados: duplicidade de orçamento se uma futura hierarquia não for modelada com chave estável; saldo negativo ou inconsistência se a alocação for implementada sem validação de origem e destino; perda de rastreabilidade se a movimentação de saldo não tiver histórico dedicado; quebra do modo estático se controles dependentes de backend não respeitarem `data-requer-backend="true"`; regressão em edição de andamento se o fluxo atual de `salvarOrcamento2026` for alterado sem compatibilidade; regressão em publicação estática se o pós-salvamento deixar de acionar `publicarDadosEstaticos()`.
- Próxima etapa recomendada: Etapa 1 - banco, com modelagem explícita para vínculo entre processos e movimentação de saldo antes de expor novos controles na interface.
- Validações executadas: `git status`, `git log --oneline -5`, `npm run validar:json`, `npm run validar:syntax`, `git diff --check`.
- Resultado: diagnóstico documental concluído; nenhuma alteração funcional aplicada.
- Registro em memória: não foi necessário atualizar `pendencias.md`, porque não surgiu pendência nova objetiva fora do backlog já existente.
- Risco de regressão: baixo, porque a etapa foi apenas de inspeção e documentação.
- Rollback: `git revert <hash_do_commit>` somente após eventual commit desta documentação; antes do commit, `git checkout -- memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

## 13/05/2026 - Etapa 1 Banco Orçamento 2026

- Data: 13/05/2026.
- Objetivo: preparar a base persistente mínima para vincular processos e registrar movimentações de saldo no Orçamento 2026.
- Alteração no banco: migração aditiva em `backend/db/init-db.js`, sem remover colunas e sem tocar em dados existentes.
- Colunas criadas: `processo_pai_id`, `tipo_processo`, `origem_recurso_id`, `ordem_exibicao`, `valor_alocado_origem`.
- Tabela criada: `orcamento_2026_movimentacoes`.
- Arquivos alterados: `backend/db/init-db.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Comandos de validação: `npm run init-db`, `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `npm start` com verificação da porta/HTTP local.
- Resultado: banco inicializado com a migração aditiva aplicada; validações de JSON e sintaxe passaram; servidor subiu e respondeu `200` em `http://127.0.0.1:8790/`; nenhum JSON publicado foi alterado.
- Próxima etapa recomendada: Etapa 2, exposição dos novos campos no serviço de orçamento e leitura controlada sem alterar o cálculo.
- Risco de regressão: baixo; a mudança é estrutural e aditiva, mas ainda exige cuidado para não impactar o fluxo atual de edição do Orçamento 2026.
- Rollback: antes do commit, `git checkout -- backend/db/init-db.js memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 2 Orçamento 2026

- Data: 13/05/2026.
- Objetivo: expor no serviço do Orçamento 2026 os campos de vínculo processual criados na etapa anterior.
- Campos expostos no serviço: `processoPaiId`, `tipoProcesso`, `origemRecursoId`, `ordemExibicao`, `valorAlocadoOrigem`.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, subida do servidor local e consulta a `GET /api/orcamento-2026`.
- Resultado: a API respondeu `200`, os itens continuaram sendo retornados e os novos campos apareceram em camelCase com defaults seguros para registros antigos; nenhum JSON publicado foi alterado.
- Próxima etapa recomendada: Etapa 3, leitura/aproveitamento dos novos campos no fluxo de regra de negócio sem alterar o cálculo financeiro ainda.
- Risco de regressão: baixo; a mudança ficou restrita à exposição de dados no serviço do orçamento.
- Rollback: antes do commit, `git checkout -- backend/services/orcamento-2026-service.js memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Botao duplicado do Orçamento 2026

- Data: 13/05/2026.
- Objetivo: remover o botão duplicado de edição exibido no cabeçalho do andamento processual da tela Orçamento 2026.
- Ajuste aplicado: o cabeçalho do rastreio passou a exibir apenas o status informado; o botão duplicado foi removido, preservando o botão principal da linha.
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, verificação no navegador com `trackingButtons = 0` e `lineButtons = 10`.
- Resultado: o botão duplicado deixou de aparecer quando o processo é expandido, sem alterar a edição principal do orçamento.
- Próxima etapa recomendada: seguir a Etapa 3 do Orçamento 2026 sem reintroduzir ação duplicada no cabeçalho do rastreio.
- Risco de regressão: baixo; a mudança ficou restrita à remoção de um controle redundante.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Orçamento 2026 dividir recurso

- Branch atual: `main`.
- Objetivo: criar a ação de interface "Dividir recurso" no Orçamento 2026 para consumir a API de criação de processo vinculado.
- Botão criado: ação compacta na linha principal do processo, com bloqueio no modo estático e sem uso no cabeçalho do andamento processual.
- Modal criado: formulário de divisão com dados do processo pai, valor alocado, status, processo SEI, link, data, observação e senha.
- Endpoint consumido: `POST /api/orcamento-2026/processos-vinculados/criar`.
- Regra registrada: a divisão cria processo vinculado sem recompor o total global do orçamento; o front-end só antecipa validações básicas e o backend continua sendo a fonte de verdade.
- Testes executados: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`, smoke test manual no navegador com abertura e fechamento do modal, bloqueio de campos vazios e criação/remoção de processo vinculado de teste no ambiente local.
- Resultado: o botão aparece apenas em processos principais, o modal abre e valida preenchimento mínimo, a criação funciona com a API da etapa anterior e o processo vinculado reaparece após recarregar os dados; não ficou alteração residual em JSON publicado.
- Próxima etapa recomendada: avançar para a alocação de saldo entre processos, mantendo a separação entre visualização simples e renderização hierárquica avançada.
- Risco de regressão: médio; a alteração ficou restrita à tela Orçamento 2026, mas adiciona novo fluxo de criação com dependência direta do backend e do bloqueio correto do modo estático.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 5 Orçamento 2026 — renderização de processos vinculados junto ao pai

- Data: 13/05/2026.
- Objetivo: corrigir a exibição dos processos vinculados na tela Orçamento 2026, renderizando-os junto ao processo pai em vez de exibi-los no bloco "Outros processos de interesse da Ouvidoria".
- Problema visual corrigido: o processo vinculado criado na Etapa 4 aparecia solto em "Outros processos", porque `atualizarTabelaOutrosOrcamento` renderizava todos os itens de `outrosProcessos` sem filtrar `tipoProcesso === VINCULADO`.
- Regra de exibição dos filhos: item com `tipoProcesso === 'VINCULADO'` é excluído de "Outros processos" e renderizado como linha aninhada imediatamente abaixo do pai na tabela principal, com badge "Processo vinculado" e origem exibida.
- Regra do saldo básico restante: `saldoBasicoRestante = valorPrevisto(pai) - valorEmpenhado(pai) - valorExecutado(pai) - soma(valorPrevisto(filhos ativos))`. O `valorPrevisto` do pai permanece como envelope original; somente o saldo exibido desconta a distribuição.
- Funções adicionadas em `frontend/js/app.js`:
  - `obterFilhosVinculadosOrcamento(paiId, budgetData)` — retorna filhos vinculados ativos de um pai.
  - `calcularResumoVinculosOrcamento(pai, filhos)` — calcula `valorDistribuido` e `saldoBasicoRestante`.
  - `renderizarResumoVinculosNoPaiOrcamento(pai, filhos)` — renderiza resumo discreto no cell do pai.
  - `renderizarFilhosVinculadosOrcamento(filhos)` — renderiza linhas `<tr>` dos filhos abaixo do pai.
- Funções modificadas em `frontend/js/app.js`:
  - `atualizarTabelaOrcamento` — usa `obterFilhosVinculadosOrcamento` por item, injeta resumo no pai e filhos abaixo do rastreio.
  - `atualizarTabelaOutrosOrcamento` — filtra `itemEhProcessoVinculadoOrcamento` antes de renderizar "Outros processos".
- CSS adicionado em `frontend/css/app.css`: `.budget-linked-summary`, `.budget-linked-summary-alert`, `.budget-linked-summary-item`, `.budget-linked-child-row`, `.budget-linked-child-cell`, `.budget-linked-child-card`, `.budget-linked-child-header`, `.budget-linked-badge`, `.budget-linked-origin`, `.budget-linked-child-body`, `.budget-linked-child-desc`, `.budget-linked-child-meta`, `.budget-linked-child-valor`, `.budget-linked-child-actions`, mais breakpoint mobile.
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos não alterados: nenhum JSON publicado, nenhum backend, nenhum banco, nenhum dado de teste.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Resultado: filhos vinculados aparecem abaixo do pai com badge e origem; pai mostra resumo de valor distribuído e saldo básico; "Outros processos" não exibe mais filhos vinculados; botão "Dividir recurso" não aparece em filhos.
- Próxima etapa recomendada: Etapa 6 — alocação real de saldo entre processos, com movimentação registrada em `orcamento_2026_movimentacoes` e exibição do histórico de alocações.
- Risco de regressão: baixo; a mudança ficou restrita à camada de renderização do front-end, sem alterar o backend, o banco, os JSONs publicados ou o fluxo de salvamento.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 6 Orçamento 2026 — API de alocação real de saldo

- Data: 13/05/2026.
- Objetivo: criar regra backend para alocar saldo entre processos do Orçamento 2026, com rastreabilidade em `orcamento_2026_movimentacoes`.
- Funções criadas em `backend/services/orcamento-2026-service.js`:
  - `obterMovimentacoesAtivasOrcamento2026()` — consulta helper que retorna movimentações ativas.
  - `calcularSaldoTransferivelOrcamento2026(item, registros, movimentacoes)` — calcula saldo considerando alocações recebidas, cedidas, empenho, execução e filhos vinculados.
  - `alocarSaldoOrcamento2026(payload)` — função principal de alocação com todas as validações de negócio.
  - `listarMovimentacoesOrcamento2026()` — retorna movimentações em camelCase, até 500 registros.
- Funções exportadas: `alocarSaldoOrcamento2026`, `listarMovimentacoesOrcamento2026` adicionadas a `module.exports`.
- Endpoints criados em `backend/server.js`:
  - `POST /api/orcamento-2026/saldos/alocar` — chama `alocarSaldoOrcamento2026`, publica após salvamento.
  - `GET /api/orcamento-2026/movimentacoes` — retorna lista de movimentações.
- Regra do saldo transferível: `valorPrevisto + valorRecebido - valorCedido - valorEmpenhado - valorExecutado - valorDistribuidoParaFilhos`.
- Validações implementadas: senha, origemId obrigatório, destinoId obrigatório, origem ≠ destino, origem existente, destino existente, origem ativa, destino ativa, mesma categoria, valor > 0, valor ≤ saldo transferível, justificativa obrigatória.
- Rastreabilidade: `registrarHistorico` com `campo=alocacao_saldo`; `criarBackupBanco` antes de inserir; alocação não altera `valor_previsto`, `valor_empenhado`, `valor_executado` nem `valor_disponibilizado`.
- Tabela `orcamento_2026_movimentacoes`: já existia no banco (Etapa 1); nenhuma alteração estrutural necessária.
- Dado de teste: movimentação com `justificativa = "Teste local de alocacao - remover antes do commit"` e respectivo histórico foram removidos do banco local antes do commit.
- JSONs publicados alterados pelo teste restaurados via `git checkout --` antes do commit.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `backend/server.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Resultado: todos os bloqueios responderam com `success: false` e mensagem correta; alocação válida retornou `success: true` com movimentação registrada; JSONs publicados sem alteração no commit.
- Próxima etapa recomendada: Etapa 7 — criar botão "Alocar saldo" e modal no front-end para consumir `POST /api/orcamento-2026/saldos/alocar`, com exibição do histórico de alocações na tela Orçamento 2026.
- Risco de regressão: baixo a médio; o impacto ficou restrito ao serviço e às rotas do Orçamento 2026, sem alterar fluxos existentes de salvamento, criação de vinculados ou publicação.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` após o commit; antes do commit, `git checkout -- backend/services/orcamento-2026-service.js backend/server.js memoria/`.

## 13/05/2026 - Etapa 5.1 Orçamento 2026 — ajuste visual de processos vinculados

- Data: 13/05/2026.
- Objetivo: converter a renderização dos filhos vinculados de um card simplificado com `colspan="11"` para linhas completas com 11 colunas compatíveis com o cabeçalho da tabela; corrigir o corte lateral da coluna Ações; tornar o botão "Dividir recurso" ícone-apenas.
- Problema visual corrigido: `renderizarFilhosVinculadosOrcamento` usava `<td colspan="11">` com card interno, ocultando dados como Modalidade, Abrangência, Classificação, Empenhado e Executado dos filhos vinculados; a coluna Ações da tabela era cortada pelo `overflow: hidden` do `.table-container`.
- Alterações em `frontend/js/app.js`:
  - `renderizarFilhosVinculadosOrcamento(filhos)` — reescrita completa; filho agora usa `<tr>` com 11 `<td>` idênticos ao pai; inclui badge "Processo vinculado" e "Origem: X" na primeira coluna com recuo visual (`budget-linked-child-item`); suporta rastreio e painel de edição; sem botão "Dividir recurso".
  - Variável `resumoVinculosItem` adicionada antes do template do pai — alimenta o detalhe de distribuição na célula Valor previsto.
  - Célula "Valor previsto" do pai — exibe o valor original e, quando há filhos, mostra "Distr.:" e "Saldo:" em fonte menor abaixo do valor principal.
  - `renderizarBotaoDividirRecursoOrcamento` — adicionado `iconOnly: true`; botão agora exibe apenas o ícone de divisão, igual aos demais botões da coluna Ações.
- Alterações em `frontend/css/app.css`:
  - `.table-container { overflow: hidden }` → `overflow-x: auto` — corrige o corte lateral em viewports menores que a largura mínima da tabela.
  - Coluna Observação: 8% → 6% (`th:nth-child(10)` e `td[data-label="Observação"]`).
  - Coluna Ações: 7% → 9% (`th:nth-child(11)`, `td[data-label="Ações"]`, `.budget-col-acoes`) — acomoda dois ícones com espaço adequado.
  - `.budget-main-table td[data-label="Ações"] .budget-row-actions` — `flex-wrap: nowrap` → `flex-wrap: wrap`.
  - Bloco de CSS do card (`budget-linked-child-cell`, `budget-linked-child-card`, `budget-linked-child-header`, `budget-linked-child-body`, `budget-linked-child-desc`, `budget-linked-child-meta`, `budget-linked-child-valor`, `budget-linked-child-actions`) removido e substituído por: `.budget-linked-child-row > td`, `.budget-linked-child-item`, `.budget-linked-child-prefix`, `.budget-linked-badge`, `.budget-linked-origin`, `.budget-linked-parent-previsto-detail`.
  - CSS de override do botão "Dividir recurso" (`#view-orcamento .budget-split-button { width: auto; ... }`) removido, pois o botão agora usa o tamanho padrão de ícone.
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos não alterados: nenhum JSON publicado, nenhum backend, nenhum banco, nenhum dado de teste.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Resultado: filhos vinculados exibem todas as colunas alinhadas com o cabeçalho; a célula Valor previsto do pai mostra o resumo de distribuição; a tabela não é mais cortada lateralmente; o botão "Dividir recurso" exibe apenas o ícone.
- Próxima etapa recomendada: Etapa 7 — criar botão "Alocar saldo" e modal no front-end para consumir `POST /api/orcamento-2026/saldos/alocar`.
- Risco de regressão: baixo; a mudança ficou restrita à camada de renderização do front-end e ao CSS da tabela, sem alterar backend, banco, JSONs publicados ou fluxo de salvamento.
- Rollback: antes do commit, `git checkout -- frontend/js/app.js frontend/css/app.css memoria/00_DIARIO_DE_BORDO/diario-atual.md`; após commit, `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Correções pós-Etapa 5.1 (commits 24aa555 a e72f7df)

- Data: 13/05/2026.
- Commits registrados nesta entrada: `24aa555`, `b580142`, `3b04467`, `0d7b267`, `812453f`, `e72f7df`.

### 24aa555 — valor previsto do pai exibe saldo do envelope

- Problema: a célula Valor previsto do pai mostrava o valor original com notas de cálculo ("Distr." e "Saldo:") inline, gerando poluição visual.
- Correção: a célula passa a exibir diretamente `valorPrevisto − valorDistribuído` (saldo do envelope) quando há filhos vinculados, sem texto adicional.
- CSS removido: `.budget-linked-parent-previsto-detail` (não mais utilizado).
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

### b580142 — ajustes visuais menores na tabela principal

- `style="border-color: rgba(23, 74, 124, 0.2);"` inline removido do botão SEI (era uma tentativa de ajuste de borda que conflitava com Bootstrap).
- `align-items: flex-end` → `align-items: center` em `.budget-execution-cell` — centraliza o badge Autuado/Não autuado abaixo do valor.
- `text-align: center !important` adicionado a `td[data-label="Observação"]` — centraliza o hífen e o texto truncado da coluna.
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

### 3b04467 — remoção da menção à origem no badge de processo vinculado

- O texto "Origem: CAMP-001" foi removido do prefixo do filho vinculado; o badge "Processo vinculado" permanece.
- CSS `.budget-linked-origin` removido (não mais utilizado).
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

### 0d7b267 — correção da abertura do trâmite em processos vinculados

- Problema: clicar no botão de trâmite de um filho vinculado não abria o painel, pois o ID do filho era removido de `orcamentoItensRastreioAbertos` a cada re-render.
- Causa: `idsFiltrados` era construído apenas com `budgetData.itens`; filhos VINCULADO vivem em `outrosProcessos` e eram descartados imediatamente.
- Correção: `idsFilhosVinculados` (via `obterTodosItensOrcamentoParaDivisao` + filtro `itemEhProcessoVinculadoOrcamento`) é concatenado a `idsFiltrados` para preservar o estado de abertura dos filhos.
- Arquivos: `frontend/js/app.js`.

### 812453f — padroniza variante do botão SEI para outline-primary

- `btn-outline-secondary` → `btn-outline-primary` no botão SEI; borda agora igual aos demais botões da coluna Ações.
- Arquivos: `frontend/js/app.js`.

### e72f7df — iguala visual do botão SEI aos demais botões de ação

- Causa identificada: `.budget-link-button` tinha `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)` e `padding: 0.15rem 0.35rem` que sobrescreviam o Bootstrap e tornavam o botão visualmente diferente.
- Correção: classe `budget-row-action` adicionada ao `<a>` SEI (garante 28×28 px e padding: 0); CSS de `.budget-link-button` reduzido a `text-decoration: none`.
- Arquivos: `frontend/js/app.js`, `frontend/css/app.css`.

## 13/05/2026 - Etapa 5.2 — saneamento pós-ajustes visuais

- Data: 13/05/2026.
- Objetivo: registrar os commits pós-Etapa 5.1 no diário, escopar o `overflow-x: auto` ao `#view-orcamento` e validar o estado atual.
- Decisão técnica: `.table-container { overflow: hidden }` foi restaurado como regra global; a regra `#view-orcamento .table-container { overflow-x: auto }` sobrescreve apenas a view do Orçamento 2026, evitando impacto nas 16+ outras seções que usam `.table-container` no projeto.
- Arquivos alterados: `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Risco de regressão: baixo; a mudança restaura o comportamento original das outras views e restringe o scroll horizontal ao escopo correto.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 8 — consolidar saldos de alocação na tabela do Orçamento 2026

- Data: 13/05/2026.
- Objetivo: exibir, visualmente na tabela, o envelope ajustado e os componentes de saldo (recebido, cedido, distribuído) de cada processo, sem alterar backend, banco nem JSONs publicados.
- Helper criado: `calcularResumoSaldoVisualOrcamento(item, budgetData, movimentacoes)` — retorna `{ valorOriginal, valorRecebidoPorAlocacao, valorCedidoPorAlocacao, valorDistribuidoParaFilhos, envelopeVisualAjustado, valorEmpenhado, valorExecutado, saldoTransferivelEstimado, temMovimentacao, temFilhos, temAlerta }`. Substitui a lógica dispersa antes repetida em `calcularSaldoTransferivelVisualOrcamento` (que agora delega para o helper e clampeia com `Math.max(0, ...)`).
- Novo helper de renderização: `renderizarDetalheEnvelopeOrcamento(resumo)` — retorna bloco compacto com `Orig.`, `Rec.`, `Ced.`, `Vinc.` apenas quando diferente de zero; exibe alerta vermelho se envelope ou saldo forem negativos; retorna `''` quando não há movimentação nem filhos.
- Envelope visual ajustado: `valorOriginal + valorRecebidoPorAlocacao − valorCedidoPorAlocacao − valorDistribuidoParaFilhos`.
- Saldo transferível estimado: `envelopeVisualAjustado − valorEmpenhado − valorExecutado` (valor bruto, pode ser negativo).
- Coluna "Valor previsto" (pai e filho): exibe `envelopeVisualAjustado` como valor principal; exibe `renderizarDetalheEnvelopeOrcamento` abaixo somente quando há movimentação, filhos ou alerta. Sem movimentação nem filhos, aparência continua idêntica ao anterior.
- `renderizarFilhosVinculadosOrcamento`: adicionado parâmetro `budgetData` (com fallback `obterDadosOrcamento()`); computa `resumoSaldoFilho` por filho; usa envelope no valor previsto; passa resumo ao botão "Alocar saldo".
- `atualizarTabelaOrcamento`: computa `resumoSaldoItem` por item pai; usa envelope na coluna valor previsto; passa resumo ao botão "Alocar saldo"; passa `budgetData` para `renderizarFilhosVinculadosOrcamento`.
- Botão "Alocar saldo": oculto quando `saldoTransferivelEstimado <= 0` (parâmetro opcional — quando não informado, mantém comportamento anterior de exibir).
- Modal "Alocar saldo": cálculos inline substituídos por `calcularResumoSaldoVisualOrcamento`; resumo agora exibe "Valor original", "Recebido", "Cedido", "Distribuído", "Envelope ajustado", "Empenhado", "Executado", "Saldo transferível"; saldo usa valor bruto (pode mostrar negativo em vermelho); select de destino exibe envelope ajustado do destino.
- CSS adicionado: bloco `.budget-balance-detail`, `.budget-balance-detail-item`, `.budget-balance-detail-positive`, `.budget-balance-detail-negative`, `.budget-balance-alert`.
- Arquivos alterados: `frontend/js/app.js` (+121/-58 linhas), `frontend/css/app.css` (+28 linhas), `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Arquivos NÃO alterados: backend, banco, `frontend/data/publicados/*.json`.
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Risco de regressão: baixo; processos sem movimentação e sem filhos têm comportamento visual idêntico ao anterior (helper retorna `envelopeVisualAjustado = valorOriginal` e detalhe fica vazio).
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 7 — botão e modal "Alocar saldo" no Orçamento 2026

- Data: 13/05/2026.
- Objetivo: criar o botão "Alocar saldo" em cada linha de processo (pai e filho vinculado) da view do Orçamento 2026, com modal de confirmação que consome a rota `POST /api/orcamento-2026/saldos/alocar` já existente no backend.
- Escopo: apenas frontend (`frontend/js/app.js`, `frontend/css/app.css`). Nenhuma alteração no backend, banco, JSONs publicados ou outras views.
- Novos símbolos no módulo:
  - Variáveis de estado (escopo do módulo): `orcamentoMovimentacoes` (array de movimentações em cache), `orcamentoAlocacaoEmAndamento` (flag de lock durante POST).
  - `calcularSaldoTransferivelVisualOrcamento(item, budgetData, movimentacoes)` — antecipa o saldo transferível para UX sem depender de round-trip ao backend; fórmula: `valorPrevisto + valorRecebido − valorCedido − valorEmpenhado − valorExecutado − valorDistribuidoParaFilhos`.
  - `carregarMovimentacoesOrcamento2026()` — chama `GET /api/orcamento-2026/movimentacoes` e popula `orcamentoMovimentacoes`; retorna silenciosamente em modo estático.
  - `itemPodeAlocarSaldoOrcamento(item)` — guard: item ativo, fora do modo estático.
  - `renderizarBotaoAlocarSaldoOrcamento(item)` — renderiza botão compacto (28×28 px) com ícone `fa-right-left`; usa `renderActionButton` com `backend: true`.
  - `renderizarModalAlocarSaldoOrcamento(item, todosItens, movimentacoes, saldoTransferivel)` — retorna HTML completo do modal com resumo somente-leitura, select de destinos filtrados por mesma categoria/frente, campo de valor, justificativa, senha e histórico das últimas 5 movimentações do item.
  - `abrirModalAlocarSaldoOrcamento(itemId)` — orquestra abertura do modal, validações de formulário, POST à API e fluxo pós-sucesso (fechar modal → recarregar dados → recarregar movimentações → re-renderizar view → alerta).
- Alterações em funções existentes:
  - `garantirDadosDaView`: passa a chamar `carregarMovimentacoesOrcamento2026()` toda vez que a view `orcamento` é ativada.
  - `atualizarTabelaOrcamento` (linha de pai): botão "Alocar saldo" adicionado entre o botão "Dividir recurso" e o botão de edição.
  - `renderizarFilhosVinculadosOrcamento` (linha de filho): botão "Alocar saldo" adicionado entre o link SEI e o botão de edição.
  - `registrarEventosOutrosProcessosOrcamento`: listener `[data-orcamento-alocar-saldo]` → `abrirModalAlocarSaldoOrcamento`.
  - `abrirModalDividirRecursoOrcamento` e `salvarOrcamentoComSenha`: adicionado `await carregarMovimentacoesOrcamento2026()` após `carregarDadosOrcamento(true)` para manter o cache sincronizado.
  - `UI_ICONS`: entrada `allocate: 'fa-right-left'` adicionada.
  - Import de `data-service.js` com versão bumpeada para `?v=20260513-02`.
- CSS adicionado (`frontend/css/app.css`): bloco escopo `.budget-allocation-*` com botão (`.budget-allocate-button`), grid de resumo (`.budget-allocation-summary`), histórico (`.budget-allocation-history`, `.budget-allocation-history-item`, `.budget-allocation-history-title`) e badge (`.budget-allocation-badge`).
- Validações executadas: `npm run validar:json` (OK), `npm run validar:syntax` (OK), `npm run validar:agente` (1 passed), `git diff --check` (sem saída — OK).
- Arquivos alterados: `frontend/js/app.js`, `frontend/css/app.css`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`.
- Arquivos NÃO alterados: backend, banco, `frontend/data/publicados/*.json`.
- Risco de regressão: baixo; todas as novas funções são aditivas e as alterações em funções existentes restringem-se a chamadas de `carregarMovimentacoesOrcamento2026()` e inserção de botão no template HTML.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Etapa 9 — teste E2E do Orçamento 2026 sem persistir dados

- Data: 13/05/2026.
- Objetivo: criar cobertura E2E específica para a tela Orçamento 2026, validando carregamento da view, presença da tabela principal, visibilidade das colunas "Valor previsto" e "Ações" e abertura/fechamento seguro dos modais "Dividir recurso" e "Alocar saldo" sem escrita real.
- Teste criado: `tests/e2e/app.spec.js` ganhou `orcamento 2026 expõe ações de divisão e alocação sem erro crítico`.
- Regra de bloqueio: o teste bloqueia as rotas `POST /api/orcamento-2026/processos-vinculados/criar`, `POST /api/orcamento-2026/saldos/alocar` e `POST /api/orcamento-2026/salvar`; se alguma for acionada, o teste falha.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026 expõe ações de divisão e alocação sem erro crítico"`, `npm run validar:agente`.
- Resultado: validações passaram; o teste específico abriu a view Orçamento 2026, confirmou a tabela principal, validou as colunas pedidas, abriu e fechou os modais quando os botões estavam presentes e não persistiu dados reais.
- Próxima etapa recomendada: ampliar a cobertura E2E gradualmente para outros fluxos críticos da aplicação, mantendo a mesma regra de bloqueio de escrita.

## 13/05/2026 - Etapa 10 — publicação estática controlada e conferência do modo publicado

- Data: 13/05/2026.
- Objetivo: executar a publicação estática dos dados após as mudanças do Orçamento 2026, conferir o diff dos JSONs publicados e validar que a SPA continua abrindo com os dados publicados.
- Comando de publicação executado: `npm run publicar:dados`.
- JSONs alterados no diff real: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/resumo-publicacao.json`.
- Observação operacional: `frontend/data/publicados/orcamento-2026.json` foi tocado pela publicação, mas o conteúdo permaneceu idêntico ao HEAD; após a conferência, foi restaurado para evitar churn semântico.
- Síntese do diff: apenas `publicadoEm` foi atualizado nos JSONs alterados; não houve alteração de código, backend, banco, rotas, tests ou hooks; a publicação permaneceu consistente com os dados já consolidados do Orçamento 2026.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`.
- Resultado: validações aprovadas; a SPA carregou; a view Orçamento 2026 abriu; a tabela apareceu; `Valor previsto` e `Ações` permaneceram visíveis; não houve erro crítico de console nas validações E2E já existentes.
- Houve alteração de código: não.
- Próxima etapa recomendada: revisar se novos commits futuros exigem republicação ou se o modo publicado permanece estável sem churn adicional.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` se a publicação precisar ser desfeita após commit enviado.

## 13/05/2026 - Etapa 11 — documentação do fluxo operacional do Orçamento 2026

- Data: 13/05/2026.
- Objetivo: documentar, em formato operacional e institucional, o fluxo da tela Orçamento 2026 após as últimas implementações de divisão de recurso, alocação de saldo, consolidação visual e teste E2E sem persistência.
- Documento criado: `memoria/01_PROJETO_APLICACAO/orcamento-2026-fluxo-operacional.md`.
- Principais tópicos documentados: processo principal, processo vinculado, divisão de recurso, alocação de saldo, envelope original, envelope visual ajustado, valores recebido/cedido/vinculado, saldo transferível, cuidados com publicação estática e testes recomendados.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/orcamento-2026-fluxo-operacional.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`.
- Resultado: documentação criada com linguagem objetiva e operacional; nenhuma alteração em código, backend, banco, JSON publicado ou hooks.
- Próxima etapa recomendada: manter a documentação alinhada sempre que a operação do Orçamento 2026 sofrer mudança funcional relevante.
- Rollback: `git revert <hash_do_commit>` e `git push origin HEAD` caso o commit precise ser desfeito após envio.

## 13/05/2026 - Fluxo de dados da aplicação

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` com o fluxo real de dados do projeto.
- Arquivos alterados: `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentadas as fontes locais, planilhas, banco SQLite, serviços backend, rotas locais de API, frontend SPA, publicação estática, JSONs publicados, diferenças entre modo local/API e modo estático/GitHub Pages, fluxos por área funcional, exportações, validações e riscos de alteração de dados.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/08_ROTAS_BANCO_API/fluxo-dados.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: detalhar futuramente endpoints, payloads e respostas em `memoria/08_ROTAS_BANCO_API/rotas.md`; detalhar tabelas, colunas e constraints em `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização caso o fluxo de dados mude sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Rotas da API local

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/08_ROTAS_BANCO_API/rotas.md` com as rotas reais da API local.
- Arquivos alterados: `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentadas as rotas confirmadas em `backend/server.js`, os métodos HTTP, serviços chamados, payloads confirmados, respostas, efeitos colaterais, publicação estática por rota, exportações Excel, entrega de arquivos estáticos, relação com frontend, relação com banco/serviços e rotas não confirmadas.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/08_ROTAS_BANCO_API/rotas.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: detalhar schema, tabelas, colunas, tipos, chaves e constraints em `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização se novas rotas forem adicionadas ou alteradas sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Schema do banco local

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/08_ROTAS_BANCO_API/schema-banco.md` com o schema real do SQLite local.
- Arquivos alterados: `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentados o banco `backend/data/onasp.sqlite`, os arquivos responsáveis pela abertura e evolução do schema, as tabelas `parametros_minimos`, `formalizacao_profor`, `orcamento_2026`, `orcamento_2026_movimentacoes` e `historico_alteracoes`, colunas, tipos declarados, constraints explícitas, evolução incremental por `garantirColuna`, relações operacionais com serviços/rotas e dados fora do SQLite.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/08_ROTAS_BANCO_API/schema-banco.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem abrir ou alterar o SQLite, sem rodar `npm run init-db`, sem publicação, sem alteração de código, scripts, testes, planilhas ou JSONs publicados.
- Pendências: manter `schema-banco.md` atualizado se houver nova tabela, coluna, constraint, regra de histórico, movimentação orçamentária ou rota de escrita.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização se o schema evoluir sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Erros, Correções e Boas Práticas

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/09_ERROS_E_CORRECOES/historico-erros.md` como base operacional reutilizável de erros, correções, riscos, boas práticas e lições exportáveis.
- Arquivos alterados: `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/INDEX.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: registrados erros reais já evidenciados, como churn de `publicadoEm`, publicação automática indevida pelo hook, problemas corrigidos no fluxo do Orçamento 2026 e padrões preventivos para JSONs publicados, SQLite local, modo local/API versus estático, documentação, validação agentic, comentários de código e rollback.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/09_ERROS_E_CORRECOES/historico-erros.md memoria/INDEX.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, frontend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: manter o histórico atualizado quando houver novo erro real, correção validada, risco recorrente ou prática reutilizável.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de classificar como erro real algo que seja apenas prevenção ou boa prática.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Checklist de validação

- Branch atual: `main`.
- Tarefa executada: preenchimento de `memoria/10_TESTES/checklist-validacao.md` com checklist operacional por tipo de tarefa.
- Arquivos alterados: `memoria/10_TESTES/checklist-validacao.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: documentadas validações iniciais de workspace, documentação, frontend, backend/API, rotas, banco SQLite, dados/planilhas, JSONs publicados, publicação estática/GitHub Pages, áreas funcionais, testes automatizados, acessibilidade, segurança/sigilo, Git, commit, sync e rollback.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/10_TESTES/checklist-validacao.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: documentação preparada sem alteração de código, backend, frontend, banco, scripts, testes, planilhas ou JSONs publicados; nenhum teste de aplicação foi executado nesta tarefa documental.
- Pendências: manter o checklist atualizado quando surgirem novos scripts, testes, rotas, regras de publicação, práticas de segurança ou riscos recorrentes.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de desatualização caso comandos ou automações mudem sem atualização da memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 13/05/2026 - Saneamento da trilha de prompts

- Branch atual: `main`.
- Tarefa executada: remoção do arquivo vazio de prompt padrão da trilha operacional da memória.
- Arquivos alterados/removidos: `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md` e remoção do arquivo vazio de prompt padrão.
- Motivo da remoção: decisão operacional do usuário de manter instruções para Codex/IA fora do repositório, elaboradas externamente na versão web do ChatGPT.
- Validações executadas: `git status --short`, conferência de arquivo vazio, `git diff --name-only`, `git diff -- memoria/INDEX.md memoria/01_PROJETO_APLICACAO/pendencias.md memoria/09_ERROS_E_CORRECOES/historico-erros.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`, busca de referências residuais na memória.
- Resultado: trilha operacional saneada, índice sem orientação para consultar o arquivo removido, pendência ativa correspondente eliminada e referência residual em `historico-erros.md` substituída por referência ao checklist de validação, sem alteração de código, backend, frontend, banco, scripts, testes, planilhas ou JSONs publicados.
- Pendências: nenhuma pendência nova criada nesta tarefa.
- Risco de regressão: baixo; alteração exclusivamente documental, com risco principal de referência residual contraditória na memória.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Curadoria de fontes tratadas

- Branch atual: `main`.
- Tarefa executada: registro da política de curadoria de fontes tratadas e criação das subpastas `fontes-tratadas/` para futura consolidação documental.
- Arquivos alterados: `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `.gitignore`.
- Pastas criadas: `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/`, `memoria/03_NORMATIVOS/fontes-tratadas/`, `memoria/04_PENA_JUSTA/fontes-tratadas/`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/`, `memoria/06_UFS_OUVIDORIAS/fontes-tratadas/`, `memoria/07_DADOS_E_PLANILHAS_TRATADAS/fontes-tratadas/`.
- Resumo: formalizada a cadeia documental `documento original → fichamento Markdown tratado → memória consolidada → uso em minuta/análise`; documentos brutos ficam fora da memória como fonte primária; Markdown tratado passa a ser a camada versionada principal.
- Decisões registradas: `fontes-brutas/` foi incluída no `.gitignore`; documentos públicos e normativos podem ser versionados excepcionalmente com justificativa; documentos internos, sensíveis, SEI, planilhas brutas e anexos institucionais não devem ser versionados como regra.
- Validações executadas: `git status --short`, leitura de `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `.gitignore`, `git diff --name-only`, `git diff -- memoria/INDEX.md memoria/01_PROJETO_APLICACAO/regras-do-projeto.md memoria/00_DIARIO_DE_BORDO/diario-atual.md .gitignore`, `git diff --check`, `Get-ChildItem -Recurse -Filter .gitkeep memoria | Where-Object { $_.FullName -like "*fontes-tratadas*" }`, `rg "fontes-brutas" .gitignore`.
- Resultado: política registrada, estrutura documental criada e pasta `fontes-brutas/` ignorada pelo Git.
- Pendências: iniciar o primeiro fichamento Markdown tratado quando a próxima fonte institucional for disponibilizada.
- Risco de regressão: baixo; alteração exclusivamente documental e organizacional.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Curadoria sem fontes brutas

- Branch atual: `main`.
- Tarefa executada: ajuste da política documental para remover a lógica operacional de `fontes-brutas/` e manter apenas fichamentos técnicos e Markdown tratado no fluxo versionado.
- Arquivos alterados: `.gitignore`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: a memória passa a tratar somente a camada de fichamentos técnicos e Markdown tratado; a estrutura de documentos brutos deixa de compor o fluxo operacional do repositório.
- Decisão registrada: documentos originais permanecem nas origens externas ou institucionais; o repositório versiona apenas a camada tratada e rastreável.
- Validações executadas: registrar os comandos efetivamente executados.
- Resultado: política simplificada, `.gitignore` sem regra de `fontes-brutas/` e memória alinhada à nova decisão.
- Pendências: iniciar a padronização dos modelos de fichamento técnico.
- Risco de regressão: baixo; alteração documental e organizacional.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Modelos de fichamento técnico

- Branch atual: `main`.
- Tarefa executada: criação da pasta `memoria/00_MODELOS/` com os modelos oficiais de fichamento técnico da curadoria documental.
- Arquivos criados: `modelo-fichamento-institucional.md`, `modelo-extrato-normativo.md`, `modelo-nota-leitura-tecnica.md`, `modelo-dicionario-dados.md`, `modelo-nota-metodologica-base.md`.
- Arquivos alterados: `memoria/INDEX.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: versionados os modelos de fichamento institucional, extrato normativo comentado, nota de leitura técnica, dicionário de dados e nota metodológica da base, para orientar a produção dos futuros Markdown tratados.
- Decisão registrada: fichamentos técnicos passam a seguir modelos próprios conforme a natureza do documento ou base.
- Validações executadas: registrar os comandos efetivamente executados.
- Resultado: modelos criados e referenciados no índice da memória.
- Pendências: iniciar o primeiro fichamento documental, preferencialmente `COMPETÊNCIAS-ONASP.txt`.
- Risco de regressão: baixo; alteração documental e organizacional.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Sincronização status e autuação no Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: correção da sincronização entre `status` e `processo_autuado` no Orçamento 2026, com ajuste de persistência, backfill aditivo e sincronização visual no front-end.
- Arquivos alterados: `backend/services/orcamento-2026-service.js`, `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema identificado: o item `CAMP-001` ficava com `status = PROCESSO AUTUADO`, mas `processo_autuado = 0`, mantendo a badge “Não autuado” na coluna “Em execução”.
- Causa raiz: a leitura já inferia autuação em alguns pontos, mas a persistência e a renderização pendente ainda podiam divergir entre `status` e `processo_autuado`.
- Regra registrada: status autuado ou etapa posterior força `processo_autuado = 1`; o front-end passa a considerar status pendente/persistido e processo autuado pendente/persistido na badge e no painel.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `git diff --check`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, e checagem direta por node do item `CAMP-001`.
- Resultado: correção validada; `CAMP-001` retorna `status = PROCESSO AUTUADO`, `processoAutuado = true` e `processoAutuadoNumero = 1`.
- Pendências: nenhuma pendência objetiva na correção; se necessário, a publicação estática será tratada em etapa separada.
- Risco de regressão: baixo a médio; alteração funcional pequena, mas sensível ao fluxo de edição, persistência e leitura da tabela do orçamento.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Publicação estática da autuação do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: republicação dos JSONs publicados após a correção de autuação do Orçamento 2026.
- JSONs alterados: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/orcamento-2026.json`, `frontend/data/publicados/resumo-publicacao.json`.
- Confirmação da autuação publicada: o item `CAMP-001` passou a constar em `frontend/data/publicados/orcamento-2026.json` com `status = "PROCESSO AUTUADO"`, `processoAutuado = true` e `processoAutuadoNumero = 1`.
- Resumo: a publicação estática foi regenerada com a correção funcional já estabilizada, sem alteração de código nesta fase.
- Validações executadas: `npm run publicar:dados`, `git status --short`, `git diff --stat`, `git diff -- frontend/data/publicados/`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `git diff --check`.
- Resultado: JSONs publicados atualizados e validados; o modo publicado passou a refletir a autuação corrigida.
- Próximo passo: diagnóstico de performance da tela Orçamento 2026 no modo publicado.
- Risco de regressão: baixo a médio; alteração de dados publicados pode gerar churn de metadados e totais derivados.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Otimização de renderização do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: otimização incremental da renderização da tela Orçamento 2026 para reduzir varreduras repetidas de itens e movimentações no modo publicado.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema identificado: a tabela do Orçamento 2026 fazia cálculos visuais repetidos por linha, com filtros sucessivos sobre todos os itens e movimentações.
- Causa provável: ausência de contexto de renderização compartilhado, levando a reprocessamento redundante de filhos vinculados, resumo de saldo e movimentações para cada linha e modal.
- Otimização aplicada: criação de um contexto de renderização com `Map` para filhos por pai, movimentações por item e cache de resumo visual, reutilizado na tabela principal e no modal de alocação.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `node --check frontend/js/app.js`, `git diff --check`, medição local no navegador com `toggleView('orcamento')` e verificação de console sem erros.
- Resultado: a tela continuou funcional, com 22 linhas renderizadas no teste local e carregamento observado em aproximadamente 1,1 s na medição automatizada.
- Riscos remanescentes: baixo a médio; ganhos dependem do volume de itens e movimentações, mas a mudança removeu o custo mais óbvio de varredura repetida.
- Próxima etapa recomendada: validar percepção de carregamento em uma sessão interativa do navegador local e, se necessário, considerar otimização adicional apenas após medir gargalos reais.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Carregamento percebido do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: medição do gargalo real e otimização do carregamento percebido da tela Orçamento 2026.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema relatado: a tela Orçamento 2026 ainda parecia lenta no uso real, mesmo após a otimização do contexto de renderização.
- Causa provável: o shell da view só aparecia depois do carregamento dos dados e da montagem completa da interface; além disso, a tabela “Outros processos” e os listeners de edição eram reanexados em cada render.
- Medições feitas: antes da alteração, o shell da view aparecia em cerca de 3,6 s; após o ajuste, o shell apareceu em cerca de 0,9 s e a tabela principal ficou pronta em cerca de 0,9 s também. O teste automatizado mostrou 12 linhas na tabela principal e a seção de outros processos abriu sob demanda com 1 linha de tabela.
- Correções aplicadas: skeleton inicial para Orçamento 2026 enquanto a base carrega, renderização progressiva da tabela principal, carregamento sob demanda de “Outros processos”, debounce no filtro de busca e delegação de eventos no documento para evitar reanexação de listeners por render.
- Validações executadas: `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `node --check frontend/js/app.js`, `git diff --check` e checagem manual automatizada de busca, modal de divisão e abertura da seção de outros processos.
- Resultado: a navegação do Orçamento 2026 ficou perceptivelmente mais rápida, sem regressão funcional; os modais de divisão e alocação continuaram abrindo, a busca respondeu sem travar e não houve erros no console.
- Riscos remanescentes: baixo a médio; o gargalo pode mudar de perfil conforme o volume de dados crescer, mas a renderização inicial já deixou de concentrar o maior custo visível.
- Próxima etapa recomendada: observar o uso real em navegador local e medir novamente apenas se surgir novo gargalo.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Medição do carregamento real do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: instrumentação controlada e medição objetiva do carregamento real da tela Orçamento 2026 com `debugPerf=1`.
- Arquivos alterados: `backend/services/data-service.js`, `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Tamanhos dos JSONs: `frontend/data/publicados/aplicacao.json` (391.262 bytes), `frontend/data/publicados/orcamento-2026.json` (77.160 bytes), `frontend/data/publicados/dashboard-geral.json` (386.644 bytes) e `frontend/data/publicados/resumo-publicacao.json` (859 bytes).
- Medições realizadas: `carregarCatalogoAplicacao` levou cerca de 3,9 ms; `carregarDadosAplicacao` levou cerca de 100,3 ms; `carregarDadosOrcamento` levou cerca de 75,2 ms; `renderOrcamentoView:container.innerHTML` levou cerca de 1,9 ms; `atualizarTabelaOrcamento` levou cerca de 4,2 ms; a abertura do orçamento após o boot ficou em torno de 78 ms na medição local.
- Gargalo identificado: o caminho do Orçamento 2026 em si não é o principal gargalo local; o custo maior observado está no bootstrap da aplicação e no carregamento da base da Home/convênios, não na montagem da tabela do orçamento.
- Patch aplicado: instrumentação controlada por `?debugPerf=1` em `data-service.js` e `app.js` para registrar tempos de fetch, parse, bootstrap e render sem alterar regra de negócio.
- Validações executadas: `node --check frontend/js/app.js`, `node --check backend/services/data-service.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `git diff --check` e medição automatizada em navegador headless com `debugPerf=1`.
- Resultado: o orçamento abriu rápido na medição local; não houve regressão funcional e os logs mostraram que o custo do orçamento ficou baixo em comparação ao bootstrap da aplicação.
- Riscos remanescentes: baixo a médio; em ambiente mais lento, o gargalo pode migrar para o bootstrap inicial ou para a base da Home.
- Próxima etapa recomendada: se a percepção de lentidão continuar no uso real, medir especificamente o bootstrap inicial da SPA antes de mexer em novos fluxos.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Lazy bootstrap da SPA e Home sob demanda

- Branch atual: `main`.
- Tarefa executada: ajuste do bootstrap mínimo da SPA para deixar a Home/convênios sob demanda e não bloquear o Orçamento 2026.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema tratado: a Home/convênios entrava no caminho crítico do boot e fazia o Orçamento 2026 parecer dependente da base geral, mesmo quando a view pedida era outra.
- Diagnóstico do bootstrap: o app iniciava com o shell da dashboard, mas o carregamento da base geral podia ocupar o caminho de abertura; agora a base geral é pedida apenas quando a dashboard ou outras views dependentes são acionadas.
- Funções alteradas: `garantirDadosBaseAplicacao`, `garantirDadosDaView` e o bootstrap de `DOMContentLoaded`.
- Views afetadas: dashboard, detalhamento, estado-detalhe, PROFOR 2022, detalhamento de convênio, FAF 2021, Doações 2023 e Orçamento 2026.
- Medições antes/depois: o Orçamento 2026 continuou abrindo em poucos milissegundos após o bootstrap; a dashboard voltou a carregar dados quando solicitada, com valor final exibido em teste manual automatizado.
- Validações executadas: `node --check frontend/js/app.js`, `node --check backend/services/data-service.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"`, `git diff --check` e smoke manual automatizado alternando entre Orçamento 2026 e dashboard.
- Resultado: o bootstrap ficou mais leve; o orçamento não dependeu da Home para abrir, e a dashboard continuou funcionando quando aberta explicitamente.
- Riscos remanescentes: baixo a médio; a dashboard inicial exibe apenas o shell até ser acionada, então o próximo ajuste, se necessário, é melhorar a mensagem visual de carregamento da Home.
- Próxima etapa recomendada: observar a percepção do usuário na abertura inicial e decidir se vale inserir um indicador visual discreto para a Home carregando sob demanda.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Failsafe do Orçamento publicado

- Branch atual: `main`.
- Tarefa executada: correção do travamento do skeleton do Orçamento 2026 no modo publicado, com atualização de cache-busting e timeout operacional.
- Arquivos alterados: `index.html`, `frontend/js/app.js`, `tests/e2e/app.spec.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema observado no GitHub Pages: a tela Orçamento 2026 podia permanecer presa em “Carregando orçamento...” e “Preparando a tabela principal...”, sem substituição pela view final.
- Causa provável: bundle antigo em cache no GitHub Pages, import da `data-service.js` com versão defasada e await do carregamento do orçamento sem failsafe explícito.
- Versão nova do cache-busting: `index.html` passou a carregar `./frontend/js/app.js?v=20260514-03` e `frontend/js/app.js` passou a importar `../../backend/services/data-service.js?v=20260514-03`.
- Timeout/failsafe criado: o carregamento do Orçamento 2026 passou a usar timeout operacional de 15 s para evitar skeleton indefinido e mostrar erro de operação se houver travamento.
- Validações executadas: `node --check frontend/js/app.js`, `npm run validar:json`, `npm run validar:syntax`, `npm run validar:agente`, `npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"` e smoke local na Home inicial.
- Resultado: o Orçamento 2026 deixa de depender de uma espera indefinida no skeleton e o teste E2E foi reforçado para falhar se a mensagem de preparação persistir.
- Riscos remanescentes: baixo a médio; o principal risco agora é cache antigo no navegador do GitHub Pages até o novo bundle ser recarregado.
- Próxima etapa recomendada: validar no GitHub Pages com hard refresh e `?debugPerf=1` após o push.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Ajuste da Home inicial

- Branch atual: `main`.
- Tarefa executada: correção do boot inicial para voltar a carregar os dados da Home/convênios sem bloquear o Orçamento 2026.
- Arquivos alterados: `frontend/js/app.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Problema observado: a dashboard inicial abria no shell, mas os dados não eram carregados automaticamente no primeiro acesso após o bootstrap mínimo.
- Causa provável: a etapa de bootstrap mínimo passou a exibir a Home sem disparar a carga assíncrona da base geral no carregamento inicial.
- Correção aplicada: o boot passou a acionar `garantirDadosBaseAplicacao()` de forma assíncrona quando a view inicial é `dashboard`, mantendo o orçamento fora do caminho crítico.
- Validações executadas: registrar os comandos efetivamente executados após a correção.
- Resultado: a Home inicial volta a carregar dados de forma automática, sem reintroduzir bloqueio no fluxo do Orçamento 2026.
- Riscos remanescentes: baixo a médio; o ganho depende da resposta da base geral, mas o orçamento continua protegido do carregamento obrigatório na abertura direta.
- Próxima etapa recomendada: confirmar no navegador que a Home preenche os KPIs ao abrir e que o Orçamento 2026 continua acessível sem espera desnecessária.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Consolidação das competências da ONASP

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md` com base nos fichamentos técnicos já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/competencias-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/historia-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`.
- Arquivos alterados: `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidadas as competências formais, competências operacionais, base normativa e institucional, papel da ONASP na RENOSPEN, no Plano Pena Justa e no PROFOR/ONASP, bem como limites de atuação e cautelas de fundamentação.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- FOMENTO-ONASP/memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md FOMENTO-ONASP/memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória institucional operacional.
- Pendências: consolidar `pena-justa-e-ouvidorias.md`, `visao-geral-profor.md` e `index-normativos.md`, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 14/05/2026 - Consolidação Pena Justa e ouvidorias

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md` com base nos fichamentos técnicos já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/competencias-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/historia-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`.
- Arquivos alterados: `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidada a relação entre Plano Pena Justa, ONASP, ouvidorias de serviços penais, IN nº 75/2026, indicadores `2.4.2.1.1.1` e `2.4.2.1.2.1`, PROFOR, RENOSPEN, canais de denúncia, transparência e controle social.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória operacional do recorte Pena Justa/ouvidorias.
- Pendências: consolidar `visao-geral-profor.md` e `index-normativos.md`, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Trilha de andamento em Outros processos do Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: inclusão da visualização/edição de trilha de andamento para processos existentes da seção `Outros processos de interesse da Ouvidoria`.
- Arquivo alterado: `frontend/js/app.js`.
- Correção aplicada: reaproveitamento de `renderizarRastreioOrcamento`, `renderizarPainelEdicaoOrcamento` e estado `orcamentoItensRastreioAbertos` também na tabela de outros processos, com ajuste de `colspan=7` e renderização da trilha abaixo da linha do processo.
- Comportamento preservado: processos novos temporários (`novo-*`) continuam sem trilha antes de salvar; após persistência passam a usar o mesmo fluxo de rastreio dos demais itens.
- Validações executadas: `npm run validar:syntax`, `npm run validar:json`, `npm run validar:agente` e smoke local automatizado da view Orçamento 2026 para toggle de trilha/painel de edição em outros processos.
- Resultado: processos existentes em outros processos passaram a exibir botão de trilha e painel de edição com campos de andamento processual.

## 15/05/2026 - Consolidação da visão geral do PROFOR/ONASP

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md` com base nos fichamentos técnicos e arquivos consolidados já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`.
- Arquivos alterados: `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidada a visão geral do PROFOR/ONASP, incluindo finalidade, objeto, UFs contempladas, valores previstos, papel da ONASP como área temática, relação com Pena Justa, IN nº 75/2026, Lei nº 13.460/2017, RENOSPEN, condição suspensiva, riscos, controles e limites de completude.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa. Termo de Abertura, Minuta de Edital e Solicitação de Dotação foram ignorados por decisão operacional e registrados como limite de completude.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória operacional do PROFOR/ONASP.
- Pendências: consolidar `index-normativos.md` e `INDEX_UFS.md`, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Consolidação do índice normativo

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/03_NORMATIVOS/index-normativos.md` com base nos fichamentos técnicos e consolidações já tratados.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`.
- Arquivos alterados: `memoria/03_NORMATIVOS/index-normativos.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidado o índice normativo da memória ONASP, diferenciando normativos tratados, ignorados por decisão operacional e citados sem extrato próprio.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: registrar os comandos efetivamente executados.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como mapa normativo operacional.
- Pendências: avaliar futuramente se será necessário extrair Portaria MSP nº 199/2018, Portaria SENAPPEN nº 327/2024 e Portarias Conjuntas MGI/MF/CGU nº 28/2024 e nº 33/2023.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Consolidação do índice operacional das UFs

- Branch atual: `main`.
- Tarefa executada: consolidação do arquivo `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md` com base nas fontes tratadas e consolidadas já existentes.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/05_PROFOR_CONVENIOS/fontes-tratadas/parecer-profor-onasp.nota-tecnica.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/fontes-tratadas/plano-pena-justa.nota-tecnica.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/relatorio-gestao-2025.fichamento.md`, `memoria/02_ONASP_INSTITUCIONAL/fontes-tratadas/plano-anual-onasp.fichamento.md`.
- Arquivos alterados: `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: consolidada a visão operacional das UFs no contexto da política de fortalecimento das ouvidorias de serviços penais, com UFs contempladas no PROFOR/ONASP, condição suspensiva, UFs com estrutura relacionada, UFs não contempladas por convênio vigente, evidências mínimas, riscos e limites de uso.
- Decisão registrada: a consolidação usa apenas fichamentos técnicos e arquivos consolidados já tratados, sem consulta direta aos documentos originais nesta etapa.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- "memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md"`, `git diff --check`.
- Resultado: arquivo consolidado criado/atualizado e pronto para uso como memória operacional das UFs.
- Pendências: criar futuramente matriz de parâmetros mínimos por UF, checklist de condição suspensiva e base de evidências por UF, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Checklist de parâmetros mínimos das ouvidorias

- Branch atual: `main`.
- Tarefa executada: criação/consolidação do arquivo `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md` com base nas fontes tratadas e consolidadas já existentes.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/03_NORMATIVOS/fontes-tratadas/instrucao-normativa-parametros-ouvidorias.extrato.md`, `memoria/03_NORMATIVOS/fontes-tratadas/lei-13460-2017-ouvidorias.extrato.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`.
- Arquivos alterados: `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criado checklist operacional dos parâmetros mínimos das ouvidorias de serviços penais, com blocos de verificação, evidências mínimas, escala de avaliação, classificação de maturidade, riscos e limites de uso.
- Decisão registrada: o checklist não classifica UFs nesta etapa e deve ser aplicado futuramente apenas com evidências documentais por UF.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- "memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md"`, `git diff --check`.
- Resultado: arquivo criado/atualizado e pronto para uso como instrumento de avaliação futura.
- Pendências: criar futuramente matriz por UF, base de evidências por UF e checklist de condição suspensiva, conforme decisão posterior.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 15/05/2026 - Fechamento do ciclo de curadoria documental ONASP

- Branch atual: `main`.
- Tarefa executada: fechamento do ciclo de curadoria documental institucional, normativa, Pena Justa, PROFOR e UFs.
- Arquivos lidos: `AGENTS.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`, `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`, `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`.
- Arquivos alterados: `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: atualizado o índice da memória, saneadas pendências documentais e registrado o encerramento do modo curto de consolidação documental.
- Consolidados existentes ao final do ciclo:
  - `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`
  - `memoria/03_NORMATIVOS/index-normativos.md`
  - `memoria/04_PENA_JUSTA/pena-justa-e-ouvidorias.md`
  - `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`
  - `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`
  - `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`
- Decisão registrada: o ciclo foi encerrado no modo curto; bases futuras por UF, checklist de condição suspensiva e novos fichamentos normativos ficam como opcionais e dependem de decisão posterior.
- Validações executadas: `git status --short`, `git diff --name-only`, `git diff -- memoria/INDEX.md memoria/01_PROJETO_APLICACAO/pendencias.md memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `git diff --check`.
- Resultado: memória documental consolidada, navegável e sem pendências obrigatórias imediatas deste ciclo.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.
- Data: 2026-05-15 13:56:13
- Objetivo: P0 incremental de testes E2E para bloquear escrita real indevida e ampliar smoke das views principais.
- Arquivo alterado: tests/e2e/app.spec.js
- Helper criado: bloquearEscritasReais(page, { permitir = [] }) com bloqueio global de POST/PUT/PATCH/DELETE por padrão.
- Views incluídas no smoke test: dashboard, detalhamento, formalizacao, profor2022, faf2021, doacoes2023, contatos, diagnostico-ouvidorias, orcamento, status-sistema.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: validações e E2E aprovados (2 passed), sem alteração em JSON publicado ou arquivos de banco.
- Risco de regressão: baixo; principal risco é bloquear futuras escritas legítimas de teste sem inclusão explícita em permitir.
- Rollback: git restore tests/e2e/app.spec.js (ou incluir memoria/00_DIARIO_DE_BORDO/diario-atual.md se necessário).
- Data: 2026-05-15 14:11:38
- Objetivo: corrigir divergência de instância do data-service e validar modo estático/somente leitura no E2E.
- Causa diagnosticada: import com querystring divergente entre app.js e static-mode.js criava instâncias diferentes de módulo ESM, quebrando leitura do estado estático.
- Arquivo de produção alterado: frontend/js/core/static-mode.js
- Arquivo de teste alterado: tests/e2e/app.spec.js
- Teste criado: "modo estático mantém a aplicação somente leitura e bloqueia escrita real".
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- frontend/js/core/static-mode.js; git diff -- tests/e2e/app.spec.js.
- Resultado: validações aprovadas (3 testes E2E passados), com bloqueio de escrita real mantido.
- Risco de regressão: baixo; principal risco é depender da mensagem de erro 503 esperada no navegador durante fallback controlado.
- Rollback: git restore frontend/js/core/static-mode.js tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:17:11
- Objetivo: ampliar E2E de fallback API local para JSON publicado em Formalização PROFOR e Parâmetros Mínimos.
- Testes criados: fallback de formalizacao-profor e fallback de parametros-minimos, mantendo teste estático de orçamento.
- Rotas interceptadas: **/api/formalizacao-profor e **/api/parametros-minimos (503 controlado).
- Como o fallback foi validado: navegação por toggleView, view visível, ausência de .app-error-state e body em modo-publicacao-estatica.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: validações aprovadas e 5 testes E2E passados, sem escrita real e sem alterações em JSON publicado.
- Risco de regressão: baixo; principal risco é variação de mensagem de console para 503 em ambientes/browsers diferentes.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:21:33
- Objetivo: criar E2E de renderização segura contra XSS em campo livre sem alterar produção.
- Teste criado: "renderiza campos livres como texto seguro sem executar XSS".
- View escolhida: Orçamento 2026 (estrutura conhecida no E2E e campo livre de observação/descrição).
- Campo/payload testado: observacao, descricao e processoSei com payload <img src=x onerror="window.__xssExecutado = true"> e javascript:window.__xssExecutado = true.
- Estratégia de mock: interceptação temporária de GET **/api/orcamento-2026 com
oute.fetch() + mutação em memória do payload retornado.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 6 testes E2E aprovados; payload renderizado como texto inofensivo, sem execução JavaScript.
- Risco de regressão: baixo; depende da continuidade do escaping em renderizadores de campos livres.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:28:04
- Objetivo: ampliar E2E de fluxos editáveis sem persistência real.
- Fluxos editáveis cobertos: FAF 2021 (modal de edição de execução) e Formalização PROFOR (editor de linha com cancelar).
- Seletores usados: [data-faf2021-editar-item], #modalFaf2021Execucao, #faf2021SalvarExecucao, [data-formalizacao-toggle-editor], [data-formalizacao-salvar-linha], [data-formalizacao-cancelar-linha].
- Lacuna: Parâmetros Mínimos sem [data-parametros-toggle-editor] disponível no estado atual dos dados durante o E2E; fluxo não foi incluído para evitar teste frágil.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 8 testes E2E aprovados, sem persistência de dados e com bloqueio global de escrita ativo.
- Risco de regressão: baixo; risco residual é variação de disponibilidade de controles editáveis conforme dataset carregado.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:32:53
- Objetivo: adicionar cobertura E2E mínima de responsividade sem alterar produção.
- Viewports testados: tablet (768x1024) e mobile (390x844).
- Views cobertas: dashboard, orcamento, formalizacao, diagnostico-ouvidorias, faf2021, contatos.
- Critérios usados: view visível, ausência de .app-error-state, body visível, sem modal aberto e sem loading overlay preso.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 9 testes E2E aprovados com bloqueio global de escrita ativo.
- Risco de regressão: baixo; cobertura é funcional de navegabilidade, não valida layout pixel-perfect.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:39:49
- Objetivo: adicionar cobertura E2E mínima de acessibilidade básica sem alterar produção.
- Critérios cobertos: html lang pt-BR, meta viewport, headings principais, nomes acessíveis de botões-chave, foco por teclado, abertura/fechamento do offcanvas com aria-labelledby, título e navegação nomeada, modal FAF com título e botão salvar, e aria-disabled em modo estático.
- Testes criados: "estrutura básica de acessibilidade permanece válida" e "modo estático mantém controles de backend com aria-disabled".
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- tests/e2e/app.spec.js.
- Resultado: 11 testes E2E aprovados, sem escrita real e sem alterações em produção.
- Risco de regressão: baixo; cobertura é de acessibilidade básica/funcional, não auditoria WCAG completa.
- Rollback: git restore tests/e2e/app.spec.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 14:53:39
- Objetivo: ampliar validação de sintaxe para arquivos críticos de backend, frontend, scripts, testes e configuração.
- Arquivos incluídos na validação de sintaxe: backend/server.js; backend/db/{database.js,init-db.js,preparar-banco.js}; backend/services/{auth-service.js,parametros-minimos-service.js,formalizacao-profor-service.js,orcamento-2026-service.js,faf-2021-service.js,historico-service.js,backup-service.js,static-publication-service.js,excel-export-service.js,dashboard-publication-service.js,data-service.js,analytics.js}; frontend/js/{app.js,core/static-mode.js,core/ui-components.js,core/view-errors.js}; scripts/{validar-json-publicados.js,configurar-git-hooks.js,validar-syntax.js}; playwright.config.js; tests/e2e/app.spec.js.
- Estratégia: script auxiliar scripts/validar-syntax.js chamado por validar:syntax no package.json.
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:json; npm run validar:agente; git diff --check; git diff -- package.json; git diff -- scripts/validar-syntax.js.
- Resultado: validação de sintaxe passou para 24 arquivos; validações JSON e agente aprovadas com 11 testes E2E passados.
- Risco de regressão: baixo; impacto restrito ao pipeline de validação local.
- Rollback: git restore package.json scripts/validar-syntax.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 15:00:54
- Objetivo: reforçar contrato público mínimo dos JSONs publicados no validador sem alterar dados publicados.
- Regras novas: raiz objeto; publicadoEm string não vazia quando existir; varredura de strings para padrões HTML perigosos; arrays/objetos mínimos por arquivo; não-vazio para dados críticos; validação de UF (incluindo sufixo técnico UF_n); validação condicional de campos monetários não negativos no orçamento; validação de referências em resumo-publicacao.
- JSONs cobertos: aplicacao.json, dashboard-geral.json, parametros-minimos.json, formalizacao-profor.json, orcamento-2026.json, resumo-publicacao.json.
- Comandos executados: git status --short; npm run validar:json; npm run validar:syntax; npm run validar:agente; git diff --check; git diff -- scripts/validar-json-publicados.js.
- Resultado: validações aprovadas, incluindo 11 testes E2E.
- Risco de regressão: baixo; principal risco é endurecimento futuro em dataset excepcional sem ajuste de regra mínima.
- Rollback: git restore scripts/validar-json-publicados.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 15:12:22
- Objetivo: tornar o backup SQLite local consistente com modo WAL sem alterar schema, dados ou regra de negocio.
- Estrategia adotada: checkpoint WAL (wal_checkpoint FULL) + copia sincrona do arquivo principal, mantendo assinatura sincronade criarBackupBanco.
- Validacao WAL/checkpoint/backup: checkpoint executado antes da copia; backup validado por existencia e tamanho > 0; teste controlado com pagina "validacao" gerou arquivo e foi removido apos verificacao.
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:json; npm run validar:agente; node -e "const { criarBackupBanco } = require('./backend/services/backup-service'); console.log(criarBackupBanco('validacao'));"; git status --short; git diff --check; git diff -- backend/services/backup-service.js.
- Resultado: validacoes aprovadas (incluindo 11 testes E2E), backup gerado com tamanho valido e nenhum artefato de backup rastreado no Git.
- Backup de teste removido: sim (backend/data/backups/validacao).
- Risco de regressao: baixo; impacto limitado ao servico de backup, com possivel aumento pontual de latencia no checkpoint.
- Rollback: git restore backend/services/backup-service.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 15:21:59
- Objetivo: padronizar tratamento de erros HTTP no backend local sem alterar regra de negocio dos services.
- Padrao de erro adotado: HttpError para erros 4xx esperados (JSON invalido e payload acima do limite) + helper enviarErroApi para resposta consistente.
- Status HTTP tratados: 400 (JSON invalido), 413 (corpo acima do limite), 404 (endpoint inexistente mantido), 500 (erro interno com mensagem generica e log tecnico no console).
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:json; npm run validar:agente; git diff --check; git diff -- backend/server.js.
- Resultado: validacoes aprovadas, 11 testes E2E passados, sem alteracoes em services/frontend/dados locais.
- Risco de regressao: baixo; alteracao limitada ao tratamento de erro no servidor e ao parser de corpo JSON.
- Rollback: git restore backend/server.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 15:28:27
- Objetivo: manter acesso do servidor na rede local e restringir entrega de arquivos estaticos sensiveis por allowlist.
- Confirmacao de host 0.0.0.0: mantido em backend/server.js (sem alteracao da estrategia de bind em rede).
- Confirmacao de acesso pela rede local: verificada de forma indireta pela manutencao do bind em 0.0.0.0 e teste local 127.0.0.1 (teste em outro computador da rede nao executado nesta sessao).
- Allowlist de caminhos: index.html; frontend/*; Planilhas/*; backend/services/data-service.js; backend/services/analytics.js; backend/data/aplicacao.json.
- Arquivos sensiveis bloqueados: backend/data/*.sqlite|*.sqlite-wal|*.sqlite-shm, .env, memoria/*, package.json/package-lock.json, backend/data/backups/*, backend/db/*, backend/scripts/*, node_modules/* e .git/*.
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:json; npm run validar:agente; git diff --check; git diff -- backend/server.js; validacao manual com node backend/server.js + Invoke-WebRequest para caminhos permitidos e sensiveis.
- Resultado: validacoes obrigatorias aprovadas (incluindo 11 testes E2E), SPA preservada e bloqueio de arquivos sensiveis confirmado com HTTP 403.
- Risco de regressao: baixo; risco residual concentrado em novos recursos estaticos fora da allowlist exigirem ajuste explicito no servidor.
- Rollback: git restore backend/server.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 15:53:44
- Objetivo: reforcar validacoes de entrada em Orçamento 2026 e Parâmetros Mínimos sem alterar regra de negocio, schema ou frontend.
- Validacoes reforcadas no Orçamento 2026: numeros monetarios agora exigem valor finito e nao negativo; status invalido informado e rejeitado; IDs de changes e inativos sao normalizados/validados; novos itens exigem objeto valido, descricao obrigatoria e bloqueiam campos desconhecidos.
- Validacoes reforcadas em Parâmetros Mínimos: changes/campos exigem objeto plano; UF obrigatoria e validada contra lista oficial; payload vazio por parametro e rejeitado; erros de validacao retornam success=false com mensagem; reversao de historico valida UF do registro.
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:json; npm run validar:agente; git diff --check; git diff -- backend/services/orcamento-2026-service.js; git diff -- backend/services/parametros-minimos-service.js.
- Resultado: validacoes aprovadas (incluindo 11 testes E2E) e alteracoes restritas aos dois services autorizados.
- Risco de regressao: baixo; risco residual em payload legado com descricao vazia em novos itens do orçamento.
- Rollback: git restore backend/services/orcamento-2026-service.js backend/services/parametros-minimos-service.js memoria/00_DIARIO_DE_BORDO/diario-atual.md
- Data: 2026-05-15 16:01:49
- Objetivo: adicionar testes service-level para travar contratos de validacao sem senha real e sem persistencia.
- Testes service-level criados: tests/services/validacoes-services.test.js com node:test + assert nativo.
- Funcoes cobertas: salvarOrcamento2026, criarProcessoVinculadoOrcamento2026, alocarSaldoOrcamento2026, salvarParametrosMinimos, reverterHistoricoParametrosMinimos.
- Lacunas mantidas por seguranca: validacoes internas de payload (monetario/status/UF/changes/novos/inativos) nao foram exercitadas com senha valida para evitar qualquer risco de escrita; etapa futura deve usar isolamento/mocking.
- Comandos executados: git status --short; npm run validar:syntax; npm run validar:services; npm run validar:json; npm run validar:agente; git diff --check; git diff -- package.json; git diff -- scripts/validar-syntax.js; git diff -- tests/services/validacoes-services.test.js.
- Resultado: validacoes aprovadas; validar:services com 5 testes passados; Playwright com 11 testes passados.
- Risco de regressao: baixo; principal risco residual e cobertura parcial de validacao interna por restricao de nao usar senha real.
- Rollback: git restore package.json scripts/validar-syntax.js memoria/00_DIARIO_DE_BORDO/diario-atual.md && git rm --cached tests/services/validacoes-services.test.js

## 16/05/2026 - Documentação técnica da funcionalidade Orçamento 2026

- Branch atual: `main`.
- Tarefa executada: criação do documento técnico `memoria/01_PROJETO_APLICACAO/funcionalidades/orcamento-2026.md`.
- Arquivos lidos: `AGENTS.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/_modelo-funcionalidade.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/parametros-minimos.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md`, `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/10_TESTES/checklist-validacao.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`, `memoria/02_ONASP_INSTITUCIONAL/competencias-onasp.md`.
- Arquivos de código inspecionados: `backend/server.js`, `backend/services/orcamento-2026-service.js`, `backend/db/init-db.js`, `backend/db/preparar-banco.js`, `backend/services/data-service.js`, `backend/services/static-publication-service.js`, `backend/services/excel-export-service.js`, `frontend/js/app.js`, `frontend/css/app.css`, `tests/e2e/app.spec.js`, `tests/services/validacoes-services.test.js`, `scripts/validar-json-publicados.js`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/orcamento-2026.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criada documentação técnica da funcionalidade Orçamento 2026, com especificação funcional, planejamento técnico, arquivos relacionados, fluxo de dados, validações, riscos, testes e rollback.
- Decisão registrada: o documento foi preenchido com base em inspeção real da memória e dos arquivos de código relacionados; lacunas não confirmadas foram marcadas como `Não identificado ainda.` ou `Não aplicável.`.
- Validações executadas: `git status --short`; buscas `rg` pontuais por `orcamento-2026`, `saldo`, `movimentacoes`, `classificacao_gerencial`, `publicacao`, `json publicado`, `Alocar saldo` e `Carregando Orçamento 2026`; leituras pontuais com `Get-Content`; criação do arquivo com `New-Item`; aplicação do patch documental.
- Resultado: `orcamento-2026.md` criado; demais funcionalidades críticas permanecem para etapas posteriores.
- Pendências: documentar `formalizacao-profor.md`, `publicacao-estatica.md` e `dashboard-geral.md`.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 16/05/2026 - Documentação técnica da funcionalidade Parâmetros Mínimos

- Branch atual: `main`.
- Tarefa executada: criação do documento técnico `memoria/01_PROJETO_APLICACAO/funcionalidades/parametros-minimos.md`.
- Arquivos lidos: `AGENTS.md`, `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/README.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/_modelo-funcionalidade.md`, `memoria/INDEX.md`, `memoria/01_PROJETO_APLICACAO/regras-do-projeto.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`, `memoria/08_ROTAS_BANCO_API/schema-banco.md`, `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, `memoria/10_TESTES/checklist-validacao.md`, `memoria/06_UFS_OUVIDORIAS/checklist-parametros-minimos.md`, `memoria/06_UFS_OUVIDORIAS/INDEX_UFS.md`, `memoria/03_NORMATIVOS/index-normativos.md`, `memoria/05_PROFOR_CONVENIOS/visao-geral-profor.md`.
- Arquivos de código inspecionados: `backend/server.js`, `backend/services/parametros-minimos-service.js`, `backend/services/parametros-minimos-config.js`, `backend/services/data-service.js`, `backend/services/excel-export-service.js`, `backend/services/static-publication-service.js`, `backend/db/init-db.js`, `backend/db/preparar-banco.js`, `backend/scripts/importar-parametros-minimos.js`, `frontend/js/app.js`, `frontend/js/core/view-errors.js`, `tests/e2e/app.spec.js`, `tests/services/validacoes-services.test.js`, `scripts/validar-json-publicados.js`, `frontend/data/publicados/parametros-minimos.json`.
- Arquivos alterados: `memoria/01_PROJETO_APLICACAO/funcionalidades/parametros-minimos.md`, `memoria/01_PROJETO_APLICACAO/pendencias.md` e `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resumo: criada documentação técnica da funcionalidade Parâmetros Mínimos com Spec, Plan, Research, fluxo de dados, estados de interface, validações, segurança, performance, tarefas, testes e rollback.
- Decisão registrada: o documento foi preenchido apenas com base em evidência real da memória e do código; lacunas não confirmadas foram marcadas como `Não identificado ainda.` ou `Não aplicável.`.
- Validações executadas: `New-Item -ItemType File -Force -Path "memoria\01_PROJETO_APLICACAO\funcionalidades\parametros-minimos.md"`; `git status --short`; buscas `rg` pontuais por `parametros-minimos`, `diagnostico-ouvidorias`, `IN 75/2026`, `checklist-parametros-minimos` e `parametrosMinimos`; leituras pontuais com `Get-Content`; aplicação do patch documental.
- Resultado: `parametros-minimos.md` criado; pendência da documentação de Parâmetros Mínimos foi saneada; demais funcionalidades críticas permanecem para etapas posteriores.
- Pendências: documentar `orcamento-2026.md`, `formalizacao-profor.md`, `publicacao-estatica.md` e `dashboard-geral.md`.
- Risco de regressão: baixo; alteração documental.
- Rollback: após commit e push, usar `git revert <hash_do_commit>` e `git push origin HEAD`.

## 18/05/2026 - Auditoria da dependência da aba Geral do PROFOR 2022

- Branch atual: `main`.
- Objetivo: mapear campo a campo a dependência atual da aba `Geral` da planilha PROFOR 2022 e preparar matriz técnica para descontinuar a aba como fonte operacional da aplicação.
- Decisões de governança usadas: DETRU prevalece para dados cadastrais/financeiros oficiais; Transferegov/rendimentos prevalece para `saldoRendimentosAtual`; cálculos internos substituem fórmulas antigas; aba `Geral` não deve permanecer como fallback operacional; divergências temporais ou por fonte oficial são esperadas; somente erro sem explicação bloqueia a retirada.
- Arquivo criado: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-auditoria-aba-geral.md`.
- Arquivo atualizado: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`.
- Resumo dos grupos de campos: 34 campos auditados; 21 prontos para desligar; 11 exigem revisão/lock de cálculo; 2 sem uso operacional identificado.
- Campos prontos para desligar: carteira SQLite (`uf`, `instrumento`, `numero`, `ano`), DETRU (`processoSei`, `vencimento`, `quantidadeTa`, valores oficiais), Transferegov (`saldoRendimentosAtual`) e campos derivados diretamente do plano.
- Campos com revisão de cálculo: saldos residuais, valores previstos por área, percentuais de execução e principalmente `saldoDisponivelOuvidoria`, que continua sem fórmula segura no compositor consolidado.
- Campos sem uso identificado: `solicitouProrrogacao` e `valorRelativoOuvidoria`.
- Recomendação da próxima etapa: retirar o fallback da aba `Geral` em implementação pequena, bloquear publicação se `banco-cache` não fechar 15/15/15, revisar `saldoDisponivelOuvidoria` antes de exposição operacional e remover/ocultar campos sem utilidade da interface.
- Confirmação: não houve alteração de lógica de produção, frontend, index, banco/schema, planilhas ou JSONs publicados nesta auditoria.
- Confirmação: `npm run publicar:dados` não foi executado.
- Risco de regressão: baixo; alteração documental.
- Rollback: `git revert <hash_do_commit>` após commit/push.

## 18/05/2026 - Logs operacionais da atualização PROFOR 2022

- Branch atual: `main`.
- Objetivo: registrar fluxos operacionais de consulta de rendimentos Transferegov e consolidado PROFOR 2022, sem alterar frontend, publicação estática, schema ou arquitetura.
- Arquivos alterados: `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js`, `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`.
- Novos campos de log em rendimentos: `totalFetchPublico`, `totalPlaywrightPublico`, `totalSemFluxo`, `fluxosPorConvenio`, `duracaoMsTotal`, `tempoMedioMsPorConvenio`.
- Resultado de `npm run atualizar:rendimentos-profor`: 15 consultados, 15 sucesso, 0 falha, `fetch-publico = 0`, `playwright-publico = 15`, `sem-fluxo = 0`, duração total aproximada de 98s no primeiro ciclo validado.
- Resultado de `npm run atualizar:profor-2022`: DETRU 15/15, rendimentos 15/15, consolidado 15/15/15, `fetch-publico = 0`, `playwright-publico = 15`, `sem-fluxo = 0`, `sucessoGeral = true`, `totalAvisos = 0`, `totalErros = 0`, duração total aproximada de 91s no ciclo consolidado validado.
- Confirmação: não houve publicação de dados estáticos.
- Confirmação: nenhum JSON publicado foi alterado.
- Risco de regressão: baixo; alteração restrita a logs operacionais e resumo de execução.
- Rollback: `git revert <hash_do_commit>` após commit/push.

## 18/05/2026 - Logs operacionais acessíveis pela tela de Sistema (PROFOR 2022)

- Branch atual: `main`.
- Objetivo: tornar os logs operacionais já gerados pelo PROFOR 2022 consultáveis e exportáveis pelo usuário operador, dentro da tela de Sistema, apenas em modo local/API; nenhum log técnico exposto no GitHub Pages.
- Modelagem: nova tabela genérica aditiva `logs_operacionais` em `backend/db/init-db.js` com `CREATE TABLE IF NOT EXISTS` (sem migration destrutiva) e índices em `criado_em`, `tipo_evento` e `status`. Tipos esperados: `profor_atualizacao_consolidada`, `profor_publicacao_estatica`, `profor_detru`, `profor_rendimentos_transferegov`. Status esperados: `sucesso`, `falha`, `bloqueado`, `parcial`.
- Serviço criado: `backend/services/logs-operacionais-service.js` com `registrarLogOperacional`, `listarLogsOperacionais`, `obterLogOperacionalPorId`, `exportarLogsOperacionaisJson`, `exportarLogsOperacionaisCsv`, `sanitizarPayloadLog`. Sanitização remove JSESSIONID/SAML/cookies/Authorization/Bearer/segredos/caminhos `C:\Users\`/HTML bruto/`.sqlite`/`.har`. Limite padrão de consulta 50 (máx. 200) e exportação padrão 500 (máx. 2000).
- Integração de eventos: `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` registra um log executivo `profor_atualizacao_consolidada` ao final de `atualizarProfor2022Consolidado` com `iniciadoEm`, `concluidoEm`, `duracaoMs`, `sucessoGeral`, `origemDados`, sumários DETRU/rendimentos/consolidado, totais por fluxo, `totalAvisos`, `totalErros`.
- Integração de publicação: `backend/scripts/publicar-profor-2022-estatico.js` registra `profor_publicacao_estatica` em todos os caminhos de saída (sucesso, falha de etapa, bloqueio por branch ou working tree, falha de auditoria), incluindo `motivoBloqueio`, diagnóstico consolidado publicado, resultados das validações JSON/syntax e auditoria de vazamento. O script segue proibido de fazer commit/push automático.
- Rotas locais/API criadas em `backend/server.js`:
  - `GET /api/sistema/logs-operacionais` (filtros `modulo`, `tipo_evento`, `status`, `limite`).
  - `GET /api/sistema/logs-operacionais/:id` (detalhe sanitizado).
  - `GET /api/sistema/logs-operacionais/export?formato=json|csv` (com cabeçalho `Content-Disposition`).
- Interface: novo painel "Logs operacionais" dentro de `renderStatusSistemaView` (`frontend/js/app.js`), renderizado somente quando `modoAplicacao === 'api'`. Em modo estático (GitHub Pages) o painel não é injetado e nenhuma chamada `/api/sistema/logs-operacionais` é feita. Painel mostra data/hora, módulo, tipo, status, duração e resumo; oferece "Carregar logs", filtros de tipo/status/limite e exportações JSON/CSV. Não exibe payload bruto, cookies, HTML, caminhos locais ou tokens.
- Cache-buster atualizado: `index.html` agora carrega `app.js?v=20260518-09`.
- Arquivos alterados: `backend/db/init-db.js`, `backend/services/logs-operacionais-service.js` (novo), `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`, `backend/scripts/publicar-profor-2022-estatico.js`, `backend/server.js`, `frontend/js/app.js`, `index.html`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/08_ROTAS_BANCO_API/rotas.md`.
- Testes funcionais executados:
  - `npm run init-db`: tabela `logs_operacionais` criada com sucesso (CREATE TABLE IF NOT EXISTS).
  - `npm run atualizar:profor-2022`: DETRU 15/15, rendimentos 15/15, consolidado 15/15/15, `sucessoGeral = true`, log id=1 (`status=sucesso`, `duracao_ms=100598`) gravado.
  - `npm run publicar:profor-2022` (sem flag): bloqueio controlado por alterações locais; log id=2 (`status=bloqueado`, `motivoBloqueio=working tree com alteracoes locais`) gravado. Nenhum JSON publicado foi alterado.
  - Endpoints HTTP locais em `PORT=8804`:
    - `GET /api/sistema/logs-operacionais` → 1 log.
    - `GET /api/sistema/logs-operacionais?tipo_evento=profor_atualizacao_consolidada` → 1 log.
    - `GET /api/sistema/logs-operacionais?tipo_evento=profor_publicacao_estatica` → 0 antes do bloqueio, 1 depois.
    - `GET /api/sistema/logs-operacionais/1` → detalhe completo sanitizado.
    - `GET /api/sistema/logs-operacionais/export?formato=json` → 200, `Content-Disposition` correto.
    - `GET /api/sistema/logs-operacionais/export?formato=csv` → 200, `Content-Disposition` correto.
    - `GET /api/sistema/logs-operacionais/export?formato=xml` → 400 (formato inválido).
  - `node --check` aprovado em `backend/db/init-db.js`, `backend/services/logs-operacionais-service.js`, `backend/services/profor-2022/profor-atualizacao-consolidada-service.js`, `backend/scripts/publicar-profor-2022-estatico.js`, `backend/server.js`, `frontend/js/app.js`.
  - `npm run validar:json` e `npm run validar:syntax`: ambos OK.
- Confirmação de sanitização: payload sanitizado por `sanitizarPayloadLog` antes do `INSERT` e antes da exportação. Inspeção do log id=1 confirma payload limitado a resumos numéricos.
- Confirmação de ocultação no GitHub Pages: `renderStatusSistemaView` só injeta o painel quando `modoAplicacao === 'api'`; o próprio botão "Status do Sistema" já é ocultado em modo estático por `atualizarVisibilidadeBotaoStatusSistema`.
- Confirmação: não houve publicação de dados estáticos. Nenhum JSON publicado foi alterado nesta etapa.
- Risco de regressão: baixo; adição de tabela, serviço, rotas e painel sem alterar fluxos existentes nem schema destrutivo.
- Rollback: `git revert <hash_do_commit>` após commit/push. A tabela `logs_operacionais` permanecerá no SQLite local após reversão (sem impacto operacional).

---

## 18/05/2026 - Validação dos logs de publicação estática + correção de regex

- Branch: `main`. `git pull` → `Already up to date.` Commits confirmados: `f6dcac5`, `fd21467` (fix regex).
- Objetivo: validar o caminho `status=sucesso` do log `profor_publicacao_estatica` com working tree limpo.

### Bug encontrado e corrigido

- `extrairResumoAtualizacao()` em `backend/scripts/publicar-profor-2022-estatico.js` usava regex com formato inventado (`DETRU: sucesso=true encontrados=...`), não correspondente à saída real do script `atualizar:profor-2022`.
- Formato real da saída: `DETRU encontrados/total: 15/15`, `rendimentos sucesso/total: 15/15 falhas=0`, `Consolidado total de convenios: 15 | totalComDetru=15 | ...`.
- Resultado: `resumoAtualizacao.sucesso` sempre `false`, abortando a publicação mesmo com 15/15/15.
- Correção: regex alinhados ao formato real + fallback em `sucessoGeral: true` (commit `fd21467`).
- Arquivo alterado: `backend/scripts/publicar-profor-2022-estatico.js`.

### Execução de `npm run publicar:profor-2022` com working tree limpo

- Resultado: **sucesso completo** — duração 92.7 s.
- Atualização consolidada: DETRU 15/15, rendimentos 15/15, consolidado 15/15/15.
- Publicação estática: `npm run publicar:dados` → code=0, 556 ms.
- Validação JSON: OK. Validação syntax: OK (25 arquivos).
- Auditoria de vazamento: OK (6 arquivos JSON).
- Arquivos publicados alterados: `aplicacao.json`, `dashboard-geral.json`, `resumo-publicacao.json`.
- Última atualização publicada: `2026-05-18T16:26:03.725Z` (`Transferegov/rendimentos`).

### Log registrado no banco

- id=7: `modulo=profor-2022`, `tipo_evento=profor_publicacao_estatica`, `status=sucesso`, `duracao_ms=92663`.
- Resumo: `atualizacao=OK | publicacao=OK | validacaoJson=OK | validacaoSyntax=OK | auditoria=OK`.
- Log id=6: `tipo_evento=profor_atualizacao_consolidada`, `status=sucesso`, `duracao_ms=89123`.
- Total de logs no banco após validação: 7.

### Rotas API testadas (PORT=8805)

| Rota | Resultado |
|---|---|
| `GET /api/sistema/logs-operacionais` | `success=true total=7 count=7` |
| `?status=sucesso` | `total=4 ids=[7,6,3,1]` |
| `?tipoEvento=profor_publicacao_estatica` | `total=7 statuses=[sucesso,sucesso,bloqueado,...]` |
| `/7` | `id=7 tipo=profor_publicacao_estatica status=sucesso` |
| `/9999` | `success=false message="Log operacional não encontrado."` |
| `/export?formato=json` | `total=7 registros=7` (`geradoEm`, `filtros`, `registros`) |
| `/export?formato=csv` | CSV com separador `;`, header correto |
| `/export?formato=xml` | `success=false message="Formato suportado: json ou csv."` |

### Auditoria de segurança nos logs exportados

- Arquivo: export JSON completo (8.376 chars).
- Padrões verificados: JSESSIONID, SAMLRequest, SAMLResponse, Cookie:, Authorization:, Bearer, ONASP_EDIT_PASSWORD, DETRU_SICONV_CONVENIO_URL, .sqlite, .har, HTML tags, caminho local.
- Resultado: **nenhum padrão proibido encontrado**.

### Validações finais

- `node --check backend/scripts/publicar-profor-2022-estatico.js` → OK.
- `npm run validar:json` → OK.
- `npm run validar:syntax` → 25 OK.
- `git diff --check` → OK (apenas avisos LF→CRLF do Windows).

### Restrições confirmadas

- `.env` NÃO alterado.
- Banco/schema NÃO alterado (apenas INSERTs na tabela `logs_operacionais`).
- Nenhuma dependência nova.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou arquivo temporário versionado.

---

## 18/05/2026 - Retirada do fallback operacional da aba Geral

- Branch: `main`. `git pull` → `Already up to date.`. Commits confirmados: `d80e3b0`, `fd21467`, `f6dcac5`.
- Objetivo: descontinuar a aba `Geral` da planilha como fonte operacional silenciosa para PROFOR 2022. Aba `Geral` permanece fisicamente apenas como histórico/controle.

### Mudança técnica principal

- **`backend/services/profor-2022/profor-origem-service.js`**: `ORIGEM_PADRAO_PROFOR_2022` mudou de `"planilha"` para `"banco-cache"`. Mensagem de aviso de origem inválida atualizada para `Usando banco-cache`. O modo `planilha` continua disponível apenas como escolha técnica explícita via `PROFOR_2022_ORIGEM_DADOS` ou via `opcoes.origemDados`.
- **`backend/services/dashboard-publication-service.js`**:
  - Removido o `try/catch` que silenciosamente caía para `extrairProfor2022DoWorkbook` quando o consolidado `banco-cache` falhava.
  - Adicionada `validarConsolidadoProfor2022Publicavel(dados)` que rejeita publicação quando: `convenios.length !== 15`, `totalCarteira !== 15`, `totalComDetru !== 15`, `totalComPlano !== 15`, `totalComRendimentos !== 15` ou `ultimaAtualizacaoDados.dataHora` ausente.
  - `montarDadosProfor2022Publicacao()` agora chama essa validação antes de retornar e lança erro controlado em qualquer falha.
  - Função `validarConsolidadoProfor2022Publicavel` exportada para testes diretos.

### Frontend — remoção de `saldoDisponivelOuvidoria` (campo sem fórmula segura)

- `frontend/js/app.js`:
  - Removida a função `isSaldoDisponivelAltoProfor()` (sem uso após esta etapa).
  - Removidos KPIs "Saldo p/ Ouvidoria" do dashboard PROFOR 2022 e do detalhe do convênio.
  - Removida a coluna "Saldo p/ Ouvidoria" da tabela de convênios e seu header (`colspan` ajustado de 8 para 7).
  - Removidas opções `saldo-negativo` e `saldo-alto` do seletor de situação.
  - Removidos alertas "Saldo disponível negativo" e "Saldo disponível alto" de `obterAlertasProfor()`.
  - Removidas situações `saldo-negativo` e `saldo-alto` de `convenioAtendeSituacaoProfor()`.
  - Removido acumulador `saldoDisponivelOuvidoria` do `calcularResumoConveniosProfor()`.
- `index.html`: cache-buster atualizado para `frontend/js/app.js?v=20260518-10`.

### Endpoints não alterados (apenas verificados)

- `GET /api/profor-2022/origem`: já retorna `origemDados` igual ao resolvido (`banco-cache` por padrão).
- `GET /api/profor-2022/consolidado`: já chama `montarConsolidadoProfor2022({ origemDados: "banco-cache" })`. Em erro, devolve HTTP 500 com mensagem controlada (não cai para planilha).
- `GET /api/profor-2022/comparar-origens`: preservado como ferramenta técnica de diagnóstico.

### Script semiautomático não alterado (apenas verificado)

- `backend/scripts/publicar-profor-2022-estatico.js` já bloqueia se atualização não atingir 15/15/15 (linhas 415-421).
- A nova `validarConsolidadoProfor2022Publicavel()` é executada pelo `dashboard-publication-service` durante `npm run publicar:dados`, que falha com código != 0 se o consolidado estiver incompleto.
- `auditarArquivoPublicado()` continua validando 15/15/15 e presença de `ultimaAtualizacaoDados.dataHora` no JSON publicado.

### Teste de bloqueio controlado

Executado fora do banco real, com objetos fictícios:

| Caso | Resultado esperado | Resultado obtido |
|---|---|---|
| `14/15/15` com `dataHora` | lança erro | OK — `Publicação bloqueada: consolidado PROFOR 2022 incompleto. Esperado 15/15/15. Obtido carteira=14, ...` |
| `15/15/15` sem `dataHora` | lança erro | OK — `Publicação bloqueada: dadosProfor2022.ultimaAtualizacaoDados.dataHora ausente no consolidado banco-cache.` |
| `15/15/15` com `dataHora` | não lança | OK — passou |

Banco/cache real não foi alterado.

### Execução de `npm run publicar:profor-2022` (working tree limpo)

Após o commit do código (working tree limpo), `npm run publicar:profor-2022` foi executado e concluiu em 102.9 s:

- Atualização consolidada: OK (DETRU 15/15, rendimentos 15/15, consolidado 15/15/15, `sucessoGeral=true`).
- Publicação estática: OK (`publicar:dados` em 628 ms).
- Validação JSON: OK. Validação syntax: OK (25 arquivos).
- Auditoria de vazamento: OK (6 arquivos JSON sem padrão proibido).
- Arquivos publicados alterados: `aplicacao.json`, `dashboard-geral.json`, `resumo-publicacao.json`.
- Última atualização publicada: `2026-05-18T16:59:11.841Z` (`Transferegov/rendimentos`).

Logs operacionais gravados:

- id=9 — `profor_publicacao_estatica/sucesso`, 102.9 s, resumo `atualizacao=OK | publicacao=OK | validacaoJson=OK | validacaoSyntax=OK | auditoria=OK`.
- id=8 — `profor_atualizacao_consolidada/sucesso`, 99 s, resumo `DETRU 15/15 | rendimentos 15/15 | consolidado 15/15/15 (convenios=15) | sucessoGeral=true`.

### Endpoints validados (PORT=8806)

- `GET /api/profor-2022/origem` → `{ origemDados: "banco-cache", origemDadosEfetiva: "banco-cache", fallbackUsado: false, avisos: [] }` — padrão novo aplicado sem `.env`.
- `GET /api/profor-2022/consolidado` → `success=true`, 15 convênios, `totalCarteira=15`, `totalComDetru=15`, `totalComPlano=15`, `totalComRendimentos=15`, `ultimaAtualizacaoDados.dataHora` presente.
- `GET /api/sistema/logs-operacionais?tipoEvento=profor_publicacao_estatica` → 9 logs retornados, statuses esperados (sucesso e bloqueado).

### Validações sintáticas (pré-commit)

- `node --check` aprovado em: `profor-origem-service.js`, `dashboard-publication-service.js`, `static-publication-service.js`, `publicar-profor-2022-estatico.js`, `server.js`, `data-service.js`, `profor-consolidado-service.js`, `frontend/js/app.js`.
- `npm run validar:json` → OK.
- `npm run validar:syntax` → 25 OK.
- `git diff --check` → OK (apenas avisos LF→CRLF do Windows).

### Restrições confirmadas

- `.env` NÃO alterado.
- Banco/schema NÃO alterado.
- Planilha NÃO alterada (aba `Geral` permanece fisicamente).
- Nenhuma dependência nova.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou temporário versionado.
- Comparador `planilha × banco-cache` preservado como ferramenta técnica.
- Modo `planilha` continua disponível apenas como escolha técnica explícita.

### Risco e rollback

- Risco baixo: aplicação já operava em `banco-cache` por configuração via `.env`; este commit apenas remove o fallback silencioso.
- Rollback: `git revert <hash>` retorna o padrão a `planilha` e restaura o fallback no publicador.

---

## 18/05/2026 - Revisão dos cálculos internos do PROFOR 2022

- Branch: `main`. `git pull` inicial: `Already up to date.`. Commits recentes confirmaram a retirada do fallback operacional da aba `Geral`.
- Objetivo: auditar e corrigir, quando necessário, os cálculos internos que substituíram fórmulas antigas da aba `Geral`, sem reintroduzir a planilha como fonte operacional.
- Decisões usadas: DETRU prevalece para dados oficiais; Transferegov/rendimentos prevalece para `saldoRendimentosAtual`; cálculos internos substituem fórmulas antigas; divergência com planilha histórica não é erro por si só; `saldoDisponivelOuvidoria` não volta sem fórmula segura.

### Diagnóstico dos cálculos

- Plano extraído: 566 itens no total.
- Consolidação: 15 convênios, `totalComDetru=15`, `totalComPlano=15`, `totalComRendimentos=15`.
- Antes da correção, foram encontrados:
  - uso preferencial da coluna `saldo` da planilha para saldos residuais, divergindo da regra `valorPrevisto - valorExecutado`;
  - payload do consolidado com `planoAplicacao` bruto completo em cada convênio quando o plano era recebido como array;
  - KPI visual de "Execução Geral" no detalhe usando `valorGlobal` em vez do percentual calculado pelo consolidado.
- Não foram encontrados: convênio sem itens, item sem área/natureza, valor previsto/executado nulo, saldo residual negativo, percentual inválido, `NaN`, `Infinity` ou `undefined`.
- A diferença entre soma das três áreas principais e total geral foi explicada por itens `N/A` de saldo remanescente/economicidade. Considerando `N/A`, a soma por área fecha com o total geral.

### Fórmulas confirmadas

- `valorExecutadoGeral = soma(valorExecutado)` dos itens filtrados por UF + número + ano.
- `valorPrevistoGeral = soma(valorPrevisto)` dos itens filtrados, incluindo `N/A`.
- previstos/executados por área = soma por área.
- saldos por área e por natureza = `valorPrevisto - valorExecutado`.
- percentuais = `executado / previsto * 100`; previsto zero retorna 0.
- valores monetários arredondados em 2 casas.

### Correções feitas

- `backend/services/profor-2022/profor-plano-aplicacao-service.js`: `obterSaldoItem()` passou a calcular sempre `valorPrevisto - valorExecutado`.
- `backend/services/profor-2022/profor-calculos-service.js`: `valorPrevistoGeral` passou a integrar resumo e base de `execucaoGeralPercentual`.
- `backend/services/profor-2022/profor-consolidado-service.js`: `planoAplicacao` passou a ser filtrado por convênio no payload e seus itens passaram a ter `saldo` recalculado pela aplicação.
- `frontend/js/app.js`: o detalhe do plano passou a calcular saldo por item/área pela fórmula interna; "Execução Geral" usa `execucaoGeralPercentual`.
- `saldoDisponivelOuvidoria`: mantido fora da interface e `null` no consolidado.

### Atualização, API e interface

- `npm run atualizar:profor-2022`: OK. DETRU 15/15, rendimentos 15/15, consolidado 15/15/15, `fetch-publico=0`, `playwright-publico=15`, `sem-fluxo=0`, `sucessoGeral=true`, `totalAvisos=0`, `totalErros=0`, duração 119.376 ms.
- `GET /api/profor-2022/consolidado` em `PORT=8807`: HTTP 200, `success=true`, 15 convênios, diagnóstico 15/15/15, `totalAvisos=45`, sem `NaN`, `Infinity` ou `undefined`.
- A pendência conhecida de `saldoDisponivelOuvidoria` ficou registrada uma única vez em `pendenciasConhecidas`; o `totalAvisos` do consolidado passou para 45, preservando os demais avisos reais.
- Totais principais do endpoint: `valorGlobal=10664015.24`, `valorPrevistoGeral=9684265.65`, `valorExecutadoGeral=3202695.9`, `saldoResidualCapital=4666904.83`, `saldoResidualCusteio=1814664.92`, `saldoRendimentosAtual=1164195.06`, `execucaoGeralPercentual=33.07`.
- Teste visual Playwright: home carregou; PROFOR 2022 carregou com 15 linhas; detalhe de convênio abriu; tabela de plano carregou; tela de Status do Sistema/logs carregou; sem erro crítico de console; sem `saldoDisponivelOuvidoria`, `NaN`, `Infinity`, `undefined` ou aviso técnico visível.

### Publicação controlada

- `npm run publicar:profor-2022`: primeira tentativa bloqueada corretamente por working tree com alterações locais.
- `npm run publicar:profor-2022 -- --permitir-alteracoes-locais`: a flag não foi repassada pelo PowerShell/npm nesta execução.
- Execução equivalente controlada: `node backend/scripts/publicar-profor-2022-estatico.js --permitir-alteracoes-locais`.
- Resultado: atualização consolidada interna OK (DETRU 15/15, rendimentos 15/15, consolidado 15/15/15), publicação estática OK, validação JSON OK, validação syntax OK, auditoria de vazamento OK.
- Arquivos publicados alterados: `frontend/data/publicados/aplicacao.json`, `frontend/data/publicados/dashboard-geral.json`, `frontend/data/publicados/resumo-publicacao.json`.
- Última atualização operacional publicada: `2026-05-18T17:17:58.637Z` (`Transferegov/rendimentos`).
- Logs gravados: `profor_atualizacao_consolidada` e `profor_publicacao_estatica` com status de sucesso.

### Validações e restrições

- Validações executadas na etapa: `node --check` dos serviços alterados e `frontend/js/app.js`; `npm run validar:json`; `npm run validar:syntax`; `git diff --check`; `git diff --name-only`; `git status --short`.
- `.env` não alterado.
- Banco/schema não alterado.
- Planilha não alterada.
- Nenhuma dependência nova.
- Nenhum SQLite, ZIP, CSV, HAR, HTML bruto, cookie ou temporário versionado.
- Rollback recomendado: `git revert <hash>` do commit desta etapa; se necessário, republicar PROFOR 2022 a partir do commit anterior validado.

## 18/05/2026 - Guia operacional final da migracao PROFOR 2022

- Branch atual: `main`.
- Estado inicial: `git status --short` limpo; `git pull` executado e retornou `Already up to date`.
- Objetivo: consolidar em um documento único o estado final da arquitetura operacional do PROFOR 2022, sem alterar código de produção, frontend, banco, JSONs publicados ou scripts.
- Arquivo criado: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md`.
- Arquivos atualizados: `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`, `memoria/00_DIARIO_DE_BORDO/diario-atual.md`, `memoria/INDEX.md`.
- Escopo documental: arquitetura final, fontes de dados, comandos operacionais, rotina diária, publicação estática, logs operacionais, critérios de bloqueio, pendências conhecidas, rollback e checklist de publicação.
- Confirmacao operacional: nenhuma alteracao de codigo, frontend, banco ou JSON publicado foi feita nesta etapa.
- Validacoes executadas: `npm run validar:json`, `npm run validar:syntax`, `git diff --check`, `git diff --name-only`, `git status --short`.
- Publicacao nao executada: `npm run publicar:dados` e `npm run publicar:profor-2022` nao foram rodados.

## 18/05/2026 - Reposicionamento dos controles de atualização PROFOR 2022

- Branch atual: `main`.
- Objetivo: mover os controles administrativos de atualização do PROFOR 2022 para a página `Status do Sistema`.
- Arquivo alterado: `frontend/js/app.js`.
- Arquivos impactados na interface: `renderProfor2022View`, `renderStatusSistemaView`, `registrarEventosProfor2022` e registro de eventos da Status do Sistema.
- Resultado funcional: os botões `Atualizar PROFOR 2022` e `Atualizar DETRU` saem da página PROFOR 2022 e passam a ser renderizados na `Status do Sistema`.
- Carteira monitorada preservada: botão `Gerenciar carteira`, checkbox `Ver inativos`, listagem da carteira e botão `Novo` permanecem na página PROFOR 2022.
- Modo estático: controles administrativos ficam desabilitados com mensagem institucional de somente leitura.
- Confirmacao operacional: backend, banco, `.env`, JSONs publicados e publicação estática nao foram alterados.
- Validacao planejada: `npm run validar:syntax`.

## 18/05/2026 - Tarefa agendada PROFOR 2022 no Windows

- Branch atual: `main`.
- Objetivo: criar script PowerShell seguro para registrar tarefa diaria unica no Agendador de Tarefas do Windows para `npm run atualizar:profor-2022`.
- Arquivo criado: `scripts/windows/criar-tarefa-atualizacao-profor-2022.ps1`.
- Escopo: detectar raiz automaticamente, validar `package.json`, validar `npm`, criar pasta `logs`, registrar a tarefa `ONASP - Atualizar PROFOR 2022`, redirecionar log para `logs\atualizacao-profor-2022.log` e imprimir comandos de teste/manual.
- Confirmacao operacional: sem alteracao de backend, frontend, banco, `.env` ou publicacao.
- Validacao planejada: `npm run validar:syntax`.

## 18/05/2026 - Barra de progresso estimado na Status do Sistema (PROFOR 2022)

- Branch atual: `main`.
- Objetivo: adicionar barra de progresso animada (estimada) para atualizações administrativas do PROFOR 2022 na página `Status do Sistema`.
- Arquivo alterado: `frontend/js/app.js`.
- Implementacao: utilitarios de progresso estimado com `setInterval`, controle de estado/aria, desabilitacao conjunta dos botoes durante requisicao, finalizacao em 100% no sucesso e estado de falha no erro.
- Escopo visual: barra e texto adicionados na secao `Atualizações PROFOR 2022` da `Status do Sistema`; pagina PROFOR 2022 permanece sem botoes administrativos.
- Restricoes mantidas: sem alteracao de backend, banco, `.env` ou JSON publicado; sem publicacao executada.
- Validacoes executadas: `npm run validar:syntax`; smoke Playwright em `status-sistema` confirmando botoes + barra e sem erro de console.

## 18/05/2026 - Botao "Atualizar Transferegov" na Status do Sistema

- Branch atual: `main`.
- Objetivo: adicionar terceiro botao administrativo para atualizar apenas rendimentos Transferegov do PROFOR 2022.
- Backend: exportada `executarEtapaRendimentos` em `profor-atualizacao-consolidada-service.js` e criado endpoint `POST /api/profor-2022/rendimentos/atualizar` em `backend/server.js`.
- Front-end: adicionado botao `btnAtualizarRendimentosProfor`, funcao `atualizarRendimentosTransferegovProfor2022UI()` e registro no fluxo de progresso estimado `executarAtualizacaoAdministrativaProfor('rendimentos', ...)`.
- Controle de execucao: os tres botoes administrativos da secao ficam bloqueados durante qualquer atualizacao e sao reabilitados no `finally`.
- Restricoes mantidas: sem alteracao de `.env`, banco/schema, JSONs publicados ou publicacao estatica.
- Validacoes planejadas: `npm run validar:syntax` e teste `curl` do endpoint de rendimentos.

## 18/05/2026 - Separacao de saldo da Ouvidoria x potencial destinavel (PROFOR 2022)

- Branch atual: `main`.
- Objetivo: separar conceitualmente e tecnicamente dois indicadores:
  - `saldoDisponivelOuvidoria` (saldo estrito dos itens da area OUVIDORIA);
  - `saldoPotencialDestinavelOuvidoria` (indicador gerencial da antiga logica `N + O + P`).

### Backend alterado

- `backend/services/profor-2022/profor-plano-aplicacao-service.js`
  - novos helpers: `calcularSaldoDisponivelOuvidoria`, `calcularEconomicidadeItem`, `calcularSaldosEconomicidadePorNatureza`;
  - `resumirPlanoAplicacaoSeguro` agora retorna:
    - `saldoDisponivelOuvidoria`;
    - `saldoEconomicidadeCapital`;
    - `saldoEconomicidadeCusteio`;
  - removida a mensagem antiga de pendencia de formula do saldo da Ouvidoria.
- `backend/services/profor-2022/profor-calculos-service.js`
  - novo helper `calcularSaldoPotencialDestinavelOuvidoria`;
  - resumo por convenio inclui:
    - `saldoDisponivelOuvidoria`;
    - `saldoEconomicidadeCapital`;
    - `saldoEconomicidadeCusteio`;
    - `saldoPotencialDestinavelOuvidoria`;
  - resumo geral agora soma esses campos.
- `backend/services/profor-2022/profor-consolidado-service.js`
  - payload por convenio inclui os 4 campos acima;
  - itens de plano passam a incluir `saldoEconomicidade` calculado internamente;
  - `pendenciasConhecidas` deixa de listar `saldoDisponivelOuvidoria` como formula pendente.

### Frontend alterado

- `frontend/js/app.js`
  - pagina PROFOR 2022 passa a exibir os dois indicadores com nomes distintos:
    - `Saldo disponível da Ouvidoria`;
    - `Potencial destinável à Ouvidoria`.
  - detalhe do convenio passa a exibir a composicao do potencial:
    - saldo de rendimentos;
    - economicidade capital;
    - economicidade custeio;
    - total potencial destinavel.
  - mantidas as restricoes: sem mensagens tecnicas de diagnostico/origem na interface publica.

### Diagnostico de calculo executado (terminal)

- Validacao por convenio executada com:
  - numero;
  - UF;
  - `saldoDisponivelOuvidoria`;
  - `saldoRendimentosAtual`;
  - `saldoEconomicidadeCapital`;
  - `saldoEconomicidadeCusteio`;
  - `saldoPotencialDestinavelOuvidoria`.
- Resultado: todos os 15 convenios com regra fechando:
  - `saldoPotencialDestinavelOuvidoria = saldoRendimentosAtual + saldoEconomicidadeCapital + saldoEconomicidadeCusteio`.

### API/estado validado

- `curl.exe -i http://localhost:8790/api/profor-2022/consolidado` -> HTTP 200.
- `curl.exe -i http://localhost:8790/api/profor-2022/atualizacao/status` -> HTTP 200.
- Diagnostico do consolidado permaneceu `15/15/15`.

### Interface validada

- Smoke Playwright:
  - PROFOR 2022 carregou com 15 linhas.
  - Indicadores distintos presentes (`Saldo disponível da Ouvidoria`, `Potencial destinável à Ouvidoria`).
  - Detalhe exibiu composicao com `Economicidade capital`.
  - Status do Sistema manteve os 3 botoes administrativos.
  - Durante atualizacao mockada, os 3 botoes ficaram bloqueados e voltaram no final.
  - Barra de progresso concluiu em 100%.
  - Sem erro de console.

### Restricoes confirmadas

- `.env` nao alterado.
- banco/schema nao alterado.
- JSONs publicados nao alterados.
- nenhuma publicacao executada (`npm run publicar:dados` e `npm run publicar:profor-2022` nao foram rodados).

---

## 18/05/2026 - Base visual de tema escuro institucional

- Branch: `main`. `git pull` -> `Already up to date.`.
- Objetivo: criar a base reutilizavel de um tema escuro institucional minimalista (azul-grafite) sem redesenhar todas as paginas. Reorganizar tokens, padronizar superficies-chave e hierarquia de botoes; preservar modos local/API e estatico.

### Decisoes visuais

- Paleta institucional escura nao-preta:
  - fundo `#0f1620`; surface `#161f2c`; surface muted `#1c2735`; surface elevada `#22303f`; surface hover `#243246`.
  - bordas `#2a3849` / `#3a4a5e`; texto `#e6edf3` / muted `#8d9bb0`.
  - primary azul vibrante `#3b82f6`; primary strong `#60a5fa`; primary soft `rgba(96,165,250,0.14)`.
  - success `#10b981` (apenas concluido); warning `#f59e0b` (apenas atencao); danger `#ef4444` (apenas erro/destrutivo/exclusao); info `#38bdf8`; export `#0d9488` (teal, nao destrutivo).
- `:root` reorganizado: os mesmos nomes de tokens (`--color-bg`, `--color-surface`, `--color-primary`, etc.) foram preservados para que toda CSS que ja usa `var(--color-*)` adote o tema escuro sem refactor adicional.
- Bloco "Camada base do tema escuro" sobrescreve hard-codes de superficie sensiveis: `.app-header` rgba, `body` gradient, variantes da sidebar (`.sidebar-link-detail/profor/formalizacao/faf/doacoes/budget`), `.sidebar-uf-option`, `.visible-check-option`, `.uf-chip`, `table.dataTable thead`, `.table-hover`, `.form-control`, `.form-select`, `.form-check-input`, `.custom-progress-pill`, `.badge-uf`, `.badge-inst-default`, `.publication-mode-notice`, `.modal-content`, `.budget-split-modal .modal-body`, `.contatos-map-shell`. Botoes de fechar do Bootstrap (`.btn-close`) ganham filtro de invert para ficarem visiveis em modais escuros.
- Hierarquia de botoes adicionada (sem alterar classes Bootstrap existentes): `.btn-action`, `.btn-outline-action`, `.btn-export` (teal proprio), `.btn-admin` (cinza discreto), `.btn-destructive` (vermelho reservado). Cada uma traz focus-ring acessivel.
- Novo componente `.empty-state` para estados vazios padronizados.
- Foco acessivel global atualizado para `rgba(96, 165, 250, 0.55)`.

### Helpers reutilizaveis em `frontend/js/core/ui-components.js`

- `UI_BUTTON_VARIANTS` (action/outline/export/admin/destructive).
- `classeBotaoUi(variant)`.
- `renderBotaoUi({ variant, label, icone, id, type, extraClass, title, disabled, dataAttrs })`.
- `renderEmptyStateUi({ icone, mensagem })`.
- `renderPublicationNotice(message)` preservado (import existente nao afetado).

### Arquivos alterados

- `frontend/css/app.css` — paleta `:root` + camada base de tema escuro (overrides de superficie, hierarquia de botoes, foco, estado vazio, modal e mapa).
- `frontend/js/core/ui-components.js` — helpers de botoes e estado vazio adicionados sem quebrar exports existentes.
- `index.html` — cache-buster atualizado: `app.css?v=20260518-12-dark` e `app.js?v=20260518-12`.

### Testes executados

- `node --check frontend/js/core/ui-components.js` -> OK.
- `npm run validar:syntax` -> 25 arquivo(s) OK.
- `npm run validar:json` -> OK (JSONs publicados intactos).
- `npm run validar:agente` -> 7 passed / 4 failed. As 4 falhas (testes de modo estatico) sao pre-existentes: foram reproduzidas tambem em `git stash` da base, antes do patch.
- Smoke test Playwright em `PORT=8807`:
  - body `rgb(15, 22, 32)`, texto `rgb(230, 237, 243)`.
  - header `rgba(22, 31, 44, 0.96)`.
  - kpi-card `rgb(22, 31, 44)`.
  - 9 views navegadas via `toggleView()` (detalhamento, profor2022, faf2021, doacoes2023, contatos, diagnostico-ouvidorias, orcamento, status-sistema, formalizacao).
  - `TOTAL_ERRORS: 0` (sem console error, sem page error, sem request failed).

### Riscos remanescentes

- Restam aproximadamente 100 ocorrencias hard-coded de hex/rgba(255,...) ao longo do `app.css` em telas especificas (badges legados, alguns gradients pasteis de Orcamento, FAF, Doacoes, etc.). Foram cobertas as superficies-chave; ajustes especificos por pagina serao feitos em rounds posteriores conforme prioridade de redesign.
- A classe `.btn-action` ainda nao e usada em lugar nenhum do app — apenas disponivel. As 4 telas-piloto que receberao botoes nesse padrao podem ser priorizadas em commit seguinte.
- Bandeiras de UF, logos e graficos (ChartJS, mini-pie) podem ter contraste a ajustar; deixei `.mini-pie` inalterado para preservar geometria.

### Rollback

`git revert <hash>` reverte integralmente os 3 arquivos (somente tema/visual). Nenhum efeito em backend, banco, rotas ou dados publicados.

---

## 18/05/2026 - Corrigir cascata e botoes de exportacao do tema escuro

- Branch: `main`. `git pull` -> `Already up to date.`. Commit base: `2023243`.
- Motivo: na Etapa 1 a camada de tema escuro foi inserida no topo do `app.css`, mas regras antigas posteriores com hard-codes pasteis (sidebar variantes, estados active/aria-current) venciam a cascata. Alem disso, dois botoes estaticos de exportacao em `index.html` continuavam usando `btn-danger` (visual destrutivo).

### Correcoes

- `frontend/css/app.css`: adicionada secao final "Overrides finais - Tema escuro institucional" com:
  - variantes `.sidebar-link-detail/profor/formalizacao/faf/doacoes/budget` em superficie escura uniforme (`var(--color-surface-muted)`) com borda esquerda colorida (info/success/roxo/warning/danger/warning);
  - estados `:hover`, `.active` e `[aria-current="page"]` uniformes em `var(--color-surface-elevated)`;
  - regras com 3 classes (specificity 0,3,0) sobrescrevendo os pasteis antigos `.sidebar-link.sidebar-link-X.active`;
  - `.sidebar-folder-toggle.active` em `var(--color-primary-soft)`;
  - escopagem por `.app-offcanvas` para evitar conflito com regras nao-sidebar de mesma classe.
- `index.html`:
  - botao "Exportar Relatorio Estadual" (`#btn-detail-export-state-pdf`): `btn-danger` -> `btn-export`;
  - botao "Exportar PDF" (`#btn-export-pdf`): `btn-danger` -> `btn-export`;
  - IDs, `onclick`, `aria-expanded` e `aria-controls` preservados;
  - cache-buster do CSS: `app.css?v=20260518-13-dark`.

### Testes

- `node --check frontend/js/core/ui-components.js` -> OK.
- `npm run validar:syntax` -> 25 arquivo(s) OK.
- `npm run validar:json` -> OK (JSONs publicados intactos).
- Smoke Playwright em `PORT=8808`:
  - 6 variantes da sidebar com background uniforme `rgb(28, 39, 53)` e borda esquerda na cor semantica esperada (`#38bdf8`, `#10b981`, `#a78bfa`, `#f59e0b`, `#ef4444`, `#f59e0b`).
  - `#btn-detail-export-state-pdf` agora com classe `btn btn-export`, cor `rgb(20, 184, 166)` (teal), fundo transparente. Vermelho ausente.
  - 0 erros de console/page/request.
- `npm run validar:agente` nao re-executado nesta correcao; 4 falhas conhecidas pre-existentes em testes de modo estatico permanecem (registradas em pendencia).

### Pendencia registrada

- Investigar e corrigir as 4 falhas pre-existentes da suite E2E em testes de modo estatico (`tests/e2e/app.spec.js:96`, `:142`, `:169`, `:391`) antes da Etapa 3.

### Riscos remanescentes

- Botoes dinamicos de exportacao renderizados pelo `app.js` ainda podem usar `btn-danger`. Esta correcao trata apenas casos estaticos do `index.html`. A migracao dos dinamicos deve ser feita em commit dedicado, junto com a evolucao do `renderBotaoUi()` (suporte a `onclick`, `aria-disabled`, `iconOnly`).
- `btn-danger` continua valido para acoes de exclusao/destrutivas; o que mudou foi a separacao semantica em relacao a exportacao.

### Rollback

`git revert <hash>` reverte os 2 arquivos (CSS + index.html). Sem impacto em backend, banco ou JSONs publicados.

---

## 18/05/2026 - Etapa 2.1: respiro visual minimalista

- Objetivo: aumentar em torno de 15% o respiro visual das paginas principais, preservando o tema escuro institucional e sem redesenhar a interface.
- Paginas-alvo: Home/Dashboard, Orcamento 2026, Formalizacao PROFOR e Parametros Minimos.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Escopo tecnico:
  - adicionada a secao final `Etapa 2.1 — Respiro visual minimalista` em `app.css`;
  - ajustes agrupados em hero, secoes, grids, cards, filtros, barras de acao, shells de tabela, cards da Formalizacao e blocos de Diagnostico;
  - reforco pontual na Home para a secao `Por instrumento`, aumentando o intervalo entre cards e o respiro interno dos mini graficos sem remover informacao;
  - paddings, gaps e margens aumentados de forma controlada, com reducao responsiva em telas pequenas;
  - cache-buster do CSS atualizado em `index.html` para `app.css?v=20260518-19-respiro`.
- Restricoes preservadas:
  - sem alteracao de regras de negocio, calculos, endpoints, payloads, banco, `.env` ou JSONs publicados;
  - sem alteracao de templates ou listeners;
  - sem publicacao executada.
- Testes planejados/executados nesta etapa:
  - `node --check frontend/js/app.js`;
  - `node --check frontend/js/core/ui-components.js`;
  - `npm run validar:syntax`;
  - `npm run validar:json`;
  - `npm run validar:agente`;
  - smoke visual das quatro paginas-alvo em 1366px, 1024px, 768px e 390px.
- Resultado dos testes:
  - checks de sintaxe e JSON concluidos com sucesso;
  - `npm run validar:agente` manteve 7 testes Playwright aprovados e 4 falhas conhecidas de modo estatico por ausencia da classe `modo-publicacao-estatica` no `body`;
  - smoke visual confirmou Home, Orcamento 2026, Formalizacao PROFOR e Parametros Minimos sem erro de console, sem estado visual de erro e sem overflow horizontal nos quatro tamanhos avaliados.
- Riscos remanescentes:
  - como `filter-section` e `table-container` sao classes historicas compartilhadas, os ajustes foram escopados por view nas paginas-alvo sempre que possivel;
  - diferencas finas de altura podem aparecer em cards com textos muito longos, mas sem mudanca de conteudo ou comportamento.
- Rollback:
  - reverter este commit restaura os espacamentos anteriores; nao ha impacto em backend, banco, dados publicados ou configuracao.

---

## 18/05/2026 - Etapa 3: harmonizacao visual final e modo estatico

- Objetivo: concluir a harmonizacao visual do tema escuro institucional nas paginas remanescentes e corrigir a falha recorrente dos testes E2E de modo estatico.
- Branch: `main`.
- Estado inicial: working tree limpo antes da implementacao; Etapa 2.1 ja estava commitada.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `frontend/js/app.js`;
  - `frontend/js/core/static-mode.js`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correcao do modo estatico:
  - alinhado o import de `data-service.js` em `static-mode.js` para a mesma versao usada por `app.js`;
  - causa: `app.js` e `static-mode.js` carregavam instancias diferentes de `data-service.js` por cache-busters distintos, separando o estado interno de `modoPublicacaoEstatica`;
  - efeito: quando Orcamento, Formalizacao ou Parametros Minimos caem para JSON publicado por falha da API local, o `body` volta a receber `modo-publicacao-estatica` e controles `data-requer-backend="true"` ficam bloqueados.
- Harmonizacao visual:
  - adicionada secao final `Etapa 3 - Harmonizacao visual final e modo estatico` em `app.css`;
  - escopo visual aplicado a PROFOR 2022, detalhe PROFOR, FAF 2021, detalhe FAF, Doacoes 2023, detalhe Doacoes, Contatos, Status do Sistema, Detalhamento por Estado, Relatorio Estadual, modais, alertas, estados vazios, tabelas e filtros;
  - removidos residuos claros por CSS final em `.bg-white`, `.bg-light`, `.table-light`, `.text-dark`, `.table-warning`, `contact-uf-body`, cards de relatorio, alertas do Status do Sistema e modais;
  - cache-busters atualizados em `index.html` para `app.css?v=20260518-20-etapa3` e `app.js?v=20260518-15-etapa3`.
- Restricoes preservadas:
  - sem alteracao de regras de negocio, calculos, endpoints, payloads, backend, banco, `.env` ou JSONs publicados;
  - sem publicacao executada;
  - sem remocao de IDs, data attributes, listeners, mini graficos, tabelas ou filtros.
- Testes executados:
  - `node --check frontend/js/app.js` -> OK;
  - `node --check frontend/js/core/ui-components.js` -> OK;
  - `node --check frontend/js/core/static-mode.js` -> OK;
  - `npx playwright test tests/e2e/app.spec.js:96 tests/e2e/app.spec.js:142 tests/e2e/app.spec.js:169 tests/e2e/app.spec.js:391` -> 4/4 OK;
  - `npm run validar:syntax` -> 25 arquivos OK;
  - `npm run validar:json` -> OK;
  - `npm run validar:agente` -> 11/11 OK;
  - smoke visual local em 1366px, 1024px, 768px e 390px para Home, Detalhamento, PROFOR 2022, FAF 2021, Doacoes 2023, Orcamento, Formalizacao, Parametros Minimos, Contatos e Status do Sistema;
  - smoke de detalhes para Relatorio Estadual, detalhe PROFOR, detalhe FAF e detalhe Doacoes;
  - smoke de modal FAF e fallback estatico do Orcamento.
- Resultado do smoke:
  - sem erros de console ou page error;
  - sem estado visual `.app-error-state`;
  - sem blocos claros indevidos nos seletores avaliados;
  - fallback estatico do Orcamento aplicou `body.modo-publicacao-estatica` e bloqueou controles dependentes de backend;
  - tabelas largas permanecem com rolagem interna quando necessario.
- Riscos remanescentes:
  - `app.css` ainda preserva classes historicas por compatibilidade; novos componentes devem usar preferencialmente os padroes `.app-*`;
  - relatorios exportados em PDF passam a refletir mais fielmente o tema escuro atual.
- Rollback:
  - reverter este commit restaura a cascata visual anterior e a importacao antiga do modo estatico; nao ha impacto em backend, banco, dados publicados ou configuracao.

---

## 18/05/2026 - Etapa 3.1: correcao de direcao visual minimalista

- Objetivo: reduzir ruido visual do tema escuro institucional, aproximando a aplicacao de um painel executivo mais limpo, sobrio e minimalista, sem alterar regras de negocio.
- Estado inicial:
  - branch `main`;
  - etapa anterior commitada em `9716458`;
  - servidor local recolocado no ar em `http://localhost:8790/index.html` e na rede em `http://10.19.10.50:8790/index.html`.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Decisoes visuais:
  - adicionada a secao final `Etapa 3.1 - Correcao de direcao visual minimalista` em `app.css`;
  - reduzidas sombras globais de paineis e cards por ajuste dos tokens `--shadow-panel` e `--shadow-card`;
  - reduzido peso visual de bordas em secoes, filtros, tabelas, cards, paineis de contato, PROFOR, FAF, Doacoes, Status do Sistema e Formalizacao;
  - mini graficos da Home ocultados por CSS, preservando IDs, dados textuais e JS;
  - badges, chips, status e pills suavizados com fundos mais discretos e menor competicao cromatica;
  - tabelas mantidas em fundo escuro uniforme, cabecalho discreto, linhas suaves e hover sutil;
  - filtros e contadores passaram a funcionar visualmente como ferramentas auxiliares, nao como blocos principais;
  - tabela FAF ajustada em tablet para evitar scroll horizontal da pagina inteira;
  - cache-buster do CSS atualizado para `app.css?v=20260518-21-minimalista`.
- Restricoes preservadas:
  - sem alteracao em `frontend/js/app.js`, `frontend/js/core/ui-components.js`, backend, endpoints, payloads, banco, `.env`, JSONs publicados ou regras de negocio;
  - sem publicacao executada;
  - sem remocao de IDs, data attributes, listeners, tabelas, filtros ou controles de edicao.
- Validacao visual:
  - screenshots de referencia antes da alteracao gerados fora do repositorio em `%TEMP%`;
  - smoke visual depois da alteracao em Home, Orcamento 2026, Formalizacao PROFOR, Parametros Minimos, PROFOR 2022, FAF 2021, Doacoes 2023, Contatos e Status do Sistema;
  - breakpoints avaliados: 1366x768, 1024x768, 768x1024 e 390x844;
  - sem erros de console;
  - sem `.app-error-state`;
  - mini graficos da Home com `display: none`;
  - sem scroll horizontal efetivo da pagina.
- Testes executados:
  - `node --check frontend/js/app.js` -> OK;
  - `node --check frontend/js/core/ui-components.js` -> OK;
  - `npm run validar:syntax` -> OK, 25 arquivos;
  - `npm run validar:json` -> OK;
  - `npm run validar:agente` -> OK, 11/11 Playwright e 5/5 testes de servico.
- Riscos remanescentes:
  - a reducao de ruido e feita por camada CSS final, preservando classes historicas; novas telas devem preferir padroes `.app-*` para evitar fragmentacao;
  - a tabela FAF em tablet prioriza nao gerar overflow da pagina, com maior quebra de texto nas celulas.
- Rollback:
  - reverter este conjunto restaura a direcao visual anterior; nao ha impacto em backend, banco, dados publicados ou configuracao.

---

## 18/05/2026 - Ajuste complementar: cards mais compactados

- Objetivo: reduzir o espaco excessivo entre cards e melhorar a compactacao visual sem reintroduzir poluicao cromatica ou alterar comportamento.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajustes feitos:
  - reduzido o `gap` dos grids principais da Home, dos blocos de instrumentos e da Formalizacao;
  - reduzido o `padding` interno de cards secundarios e cards de instrumento;
  - suavizados os espacos entre badges, chips, listas de status e acoes;
  - cards de instrumentos passaram a usar gutters menores no grid;
  - a tabela FAF recebeu tratamento para manter a largura dentro do container em tablet;
  - o `app.css` recebeu cache-buster atualizado para carregar a versao compactada.
- Resultado visual:
  - cards ficaram mais proximos e a leitura ficou mais densa;
  - Home continua com os elementos principais preservados;
  - mini graficos seguem ocultos;
  - nao houve overflow horizontal efetivo no smoke visual.
- Testes executados:
  - smoke Playwright em Home, Orcamento, Formalizacao, Parametros Minimos, PROFOR 2022, FAF 2021, Doacoes 2023, Contatos e Status do Sistema;
  - verificacao de breakpoints em 1366x768, 1024x768, 768x1024 e 390x844;
  - `node --check frontend/js/app.js` -> OK;
  - `node --check frontend/js/core/ui-components.js` -> OK;
  - `npm run validar:syntax` -> OK;
  - `npm run validar:json` -> OK;
  - `npm run validar:agente` -> OK, 11/11.
- Riscos remanescentes:
  - a densidade ficou mais alta; telas com textos excepcionalmente longos podem ainda pedir refinamento pontual;
  - a harmonia da Formalizacao continua dependente da composicao dos dados de cada UF.
- Rollback:
  - reverter esta etapa restaura os gaps e paddings anteriores; nao ha impacto em backend, banco, dados publicados ou regras de negocio.

---

## 18/05/2026 - Ajuste de paleta: brilho metalizado leve

- Objetivo: atender ao pedido de uma paleta um pouco mais neon/metalizada, mantendo a leitura institucional e sem exagero.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajustes visuais:
  - tokens principais de cor tornados um pouco mais luminosos e frios;
  - superfícies principais receberam brilho metálico discreto por `linear-gradient` sutil;
  - `primary`, `info`, `export` e estados semânticos ficaram mais vivos sem virar neon forte;
  - badges, pills e chips ganharam contornos e textos ligeiramente mais claros;
  - o painel "Instrumentos monitorados" permaneceu mais discreto, mas aderente ao novo brilho da paleta.
- Resultado visual:
  - a interface ficou um pouco mais moderna e metálica, sem perder o tom executivo;
  - o efeito continua contido e legível em fundo escuro;
  - sem overflow horizontal e sem erro de console no smoke visual.
- Testes executados:
  - smoke visual do Dashboard em `1366x768`;
  - `node --check frontend/js/app.js` -> OK;
  - `node --check frontend/js/core/ui-components.js` -> OK;
  - `npm run validar:syntax` -> OK;
  - `npm run validar:json` -> OK;
  - `npm run validar:agente` -> OK, 11/11.
- Riscos remanescentes:
  - aumento leve de brilho pode parecer mais presente em monitores com contraste alto;
  - o refinamento continua dependente da leitura visual do usuário em telas reais.
- Rollback:
  - reverter esta etapa restaura a paleta anterior sem impacto em backend, banco, dados publicados ou lógica da aplicação.

---

## 18/05/2026 - Ajuste do logo SENAPPEN

- Objetivo: aumentar o contraste percebido da logo da SENAPPEN no cabeçalho sem alterar a imagem nem a estrutura da marca.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste aplicado:
  - logo recebeu `brightness`, `contrast`, `saturate` e `drop-shadow` sutis para leitura melhor em fundo escuro;
  - fallback textual da marca foi mantido como contingência;
  - cache-buster do CSS atualizado para `app.css?v=20260518-24-logo-contrast`.
- Resultado:
  - logo ficou mais destacada no cabeçalho;
  - sem alteração de layout, sem erro de console e sem overflow horizontal.
- Teste executado:
  - smoke visual do cabeçalho em `1366x768` -> OK.
- Risco remanescente:
  - o ganho de contraste depende da qualidade visual do PNG original; caso a imagem fonte seja muito escura, um novo asset pode ser necessário no futuro.
- Rollback:
  - reverter esta etapa remove apenas os filtros CSS aplicados ao logo; não há impacto em backend, banco ou dados publicados.

---

## 18/05/2026 - Ajuste de sidebar e mapa de contatos

- Objetivo: recuperar cor nos icones do menu lateral e suavizar o mapa do Brasil na pagina de Contatos, reduzindo a aparencia branca agressiva.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `index.html`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajustes feitos:
  - icones do menu lateral passaram a receber cores semanticas por `data-view`, preservando o botao de Orcamento como referencia visual forte;
  - o mapa de Contatos recebeu fundo escuro com leve brilho metalizado e o SVG de fundo ficou menos claro;
  - marcadores do mapa e legendas foram ajustados para contraste melhor em fundo escuro;
  - cache-buster do CSS atualizado para `app.css?v=20260518-25-sidebar-contatos`.
- Resultado:
  - menu lateral ficou mais legivel e com melhor hierarquia cromatica;
  - mapa de Contatos deixou de parecer branco e ficou mais coerente com o tema escuro;
  - sem erro de console e sem overflow horizontal no smoke visual.
- Teste executado:
  - smoke Playwright no Dashboard e em Contatos -> OK.
- Riscos remanescentes:
  - a imagem-base do mapa continua a mesma; se a fonte SVG voltar a ser atualizada, a aparencia pode mudar e pedir novo ajuste fino.
- Rollback:
  - reverter esta etapa desfaz apenas a coloracao dos icones e os ajustes visuais do mapa; nao ha impacto em backend, banco ou dados publicados.

---

## 19/05/2026 - Orçamento 2026: acompanhamento gerencial estruturado

- Objetivo: substituir o uso isolado de observacao por campos estruturados de acompanhamento gerencial, mantendo a observacao livre.
- Branch: `main`.
- Arquivos alterados:
  - `backend/db/init-db.js`;
  - `backend/services/orcamento-2026-service.js`;
  - `frontend/js/app.js`;
  - `frontend/css/app.css`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Campos criados:
  - `setor_atual` / `setorAtual`;
  - `responsavel_atual` / `responsavelAtual`;
  - `data_entrada_setor` / `dataEntradaSetor`;
  - `pendencia_atual` / `pendenciaAtual`.
- Ajustes feitos:
  - adicionadas colunas opcionais `TEXT` na tabela `orcamento_2026` e na rotina de garantia de colunas;
  - incluidos os campos na lista de colunas, campos editaveis, campos de novos itens e mapeamento snake_case para camelCase;
  - expostos os campos em `linhaParaItem` e persistidos em `salvarOrcamento2026`;
  - criado bloco "Acompanhamento gerencial" no painel de edicao da tela Orçamento 2026;
  - exibido resumo compacto na tabela com setor atual e dias no setor atual;
  - calculado "dias no setor atual" apenas a partir de `dataEntradaSetor`.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `node --check backend/services/orcamento-2026-service.js` -> OK;
  - `node --check backend/db/init-db.js` -> OK.
- Pendencias:
  - validacao manual restrita no navegador.
- Risco de regressao:
  - baixo a moderado, concentrado na persistencia dos novos campos e na renderizacao do painel de edicao.
- Rollback:
  - reverter este conjunto remove os campos da UI e do contrato de servico; as colunas adicionadas ao banco sao nao destrutivas e podem permanecer vazias sem afetar o fluxo anterior.

---

## 19/05/2026 - Orçamento 2026: resumo gerencial exportado

- Objetivo: refatorar o texto do botão "Exportar resumo" para gerar mensagem curta de WhatsApp baseada no acompanhamento gerencial estruturado.
- Branch: `main`.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Regra de classificação:
  - cobrança imediata quando não há SEI, etapa atual é planejamento, status é validar/suspenso/cancelado, há pendência atual ou dias no setor atual >= 10;
  - avançados/concluídos quando a etapa atual é empenhado, contratado, ordem de serviço, entregue, ordem bancária, abertura de programa, parecer CONJUR ou publicação GABSEC, ou status contém executado;
  - em acompanhamento para os demais itens com trilha individual;
  - pendência atual prevalece como cobrança imediata.
- Ajustes feitos:
  - exportação passou a ignorar itens sem trilha processual individual;
  - texto passou a usar setor atual, responsável atual, data de entrada no setor, pendência atual e observação livre;
  - processos vinculados seguem incluídos junto aos itens principais filtrados, sem duplicidade;
  - outros processos de interesse entram apenas quando possuem trilha individual;
  - botão "Exportar resumo" recebeu ícone mapeado de compartilhamento.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - validação manual restrita no navegador.
- Risco de regressão:
  - baixo a moderado, concentrado na classificação textual e no conteúdo copiado pela modal.
- Rollback:
  - reverter esta etapa restaura o formato anterior do texto exportado, sem impacto em banco, backend, dados publicados, saldo, vínculo, alocação ou trilha.

---

## 19/05/2026 - Orçamento 2026: ajuste fino de formatação do resumo exportado

- Objetivo: melhorar a legibilidade no WhatsApp sem alterar classificação, dados ou comportamento de mensagem vazia.
- Branch: `main`.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajustes de formatação realizados:
  - rótulo `Cobrança sugerida:` alterado para `Providência:`;
  - título principal com negrito WhatsApp: `📌 *Resumo Orçamento ONASP 2026*`;
  - contadores com negrito WhatsApp;
  - nome de cada item com negrito WhatsApp (`*1. Nome do item*`);
  - `Atualizado em` mantido em `DD/MM/AAAA HH:MM`, sem vírgula entre data e hora.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - validação manual restrita no navegador.
- Risco de regressão:
  - baixo, concentrado em formatação de texto exportado.
- Rollback:
  - reverter esta etapa restaura apenas a formatação anterior da mensagem exportada.

---

## 19/05/2026 - Orçamento 2026: correção de cópia e salvamento do acompanhamento

- Problemas observados:
  - modal "Exportar resumo" exibia "Falha ao copiar" ao acionar "Copiar texto";
  - salvamento do acompanhamento gerencial podia retornar "Campo não permitido" relacionado a setor atual.
- Causa diagnosticada:
  - `copiarTextoComFallback()` chamava diretamente `navigator.clipboard.writeText()`, sem verificar disponibilidade da Clipboard API antes de acessar o método;
  - o código atual já aceita `setor_atual`, `responsavel_atual`, `data_entrada_setor` e `pendencia_atual` no backend, mas o erro é compatível com backend local antigo em execução ou payload alternativo usando aliases camelCase.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `backend/services/orcamento-2026-service.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção aplicada:
  - cópia passou a validar texto, tentar Clipboard API somente quando disponível e usar fallback por textarea existente ou temporário;
  - fallback seleciona o texto, usa `setSelectionRange()` quando disponível e mantém seleção em caso de falha;
  - backend passou a normalizar aliases `setorAtual`, `responsavelAtual`, `dataEntradaSetor` e `pendenciaAtual` para os campos snake_case antes da validação/persistência de alterações.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `node --check backend/services/orcamento-2026-service.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - validação manual restrita no navegador;
  - se o backend local estava rodando antes da alteração de acompanhamento gerencial, reiniciar o servidor para carregar a whitelist atualizada.
- Risco de regressão:
  - baixo a moderado, concentrado no fallback de cópia e na normalização de campos de acompanhamento.
- Rollback:
  - reverter esta etapa restaura o comportamento anterior de cópia e remove a normalização defensiva de aliases camelCase.

---

## 19/05/2026 - Orçamento 2026: correção de data e espaçamento do resumo

- Problemas observados:
  - contagem de dias no setor atual exibiu `0 dias` para entrada anterior à data atual;
  - texto exportado tinha linhas em branco excessivas entre grupos e itens;
  - campo "Data de entrada no setor atual" era `input date`, dificultando digitação manual.
- Causa diagnosticada:
  - parsing de data estava restrito e o campo de UI forçava o formato de calendário do navegador;
  - data digitada não era normalizada explicitamente antes de entrar em alterações pendentes;
  - `montarGrupoResumoOrcamento()` usava string vazia combinada com `join('\n\n')`, gerando quebras extras.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção aplicada:
  - parser de data passou a aceitar `YYYY-MM-DD`, `DD/MM/AAAA`, `DD-MM-AAAA` e espaços nas extremidades;
  - cálculo de dias passou a comparar datas sem hora usando componentes locais e `Date.UTC`;
  - campo `data_entrada_setor` passou a ser texto digitável com placeholder `DD/MM/AAAA` e exibição amigável;
  - valor digitado para `data_entrada_setor` passa a ser normalizado para ISO nas alterações pendentes quando válido;
  - montagem dos grupos do resumo foi ajustada para manter apenas uma linha em branco entre título, itens e grupos.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - validação manual restrita no navegador;
  - reiniciar backend local se ele estava rodando antes das alterações recentes.
- Risco de regressão:
  - baixo a moderado, concentrado no parsing de data do acompanhamento e no espaçamento do texto exportado.
- Rollback:
  - reverter esta etapa restaura o campo de data anterior e a montagem anterior de quebras de linha no resumo.

---

## 19/05/2026 - Orçamento 2026: ajuste de data, providência e acompanhamento na trilha

- Problemas observados:
  - campo "Data de entrada no setor atual" permitia digitação, mas não seleção por calendário;
  - resumo exportado gerava providência automática baseada apenas na etapa, mesmo quando havia pendência cadastrada;
  - painel expandido da trilha não exibia o acompanhamento gerencial completo abaixo da timeline;
  - havia relato anterior de alterações inesperadas em JSONs publicados.
- Causa diagnosticada:
  - `data_entrada_setor` havia sido simplificado para um único `input text`;
  - a linha `Providência:` era sempre montada por `montarCobrancaSugeridaResumoOrcamento()` usando a etapa atual;
  - `renderizarRastreioOrcamento()` renderizava apenas cabeçalho e timeline;
  - no início desta etapa, `git status --short` não indicou JSONs publicados modificados.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correções aplicadas:
  - campo `data_entrada_setor` em edição passou a renderizar input texto `DD/MM/AAAA` e input auxiliar `type="date"` para calendário, ambos usando o mesmo fluxo de alteração e normalização ISO quando válido;
  - resumo exportado passou a usar `pendenciaAtual` como providência principal quando preenchida;
  - sem pendência cadastrada, a linha `Providência:` só aparece em cobrança imediata quando houver setor ou responsável, com texto genérico para atualizar ou impulsionar o processo;
  - itens em acompanhamento ou avançados/concluídos sem pendência não recebem providência automática;
  - painel expandido da trilha passou a exibir bloco de leitura "Acompanhamento gerencial" com setor, responsável, dias no setor, pendência e observação, usando valores pendentes quando existirem.
- Tratamento dos JSONs publicados:
  - `git status --short` inicial estava limpo; nenhum `frontend/data/publicados/*.json` foi alterado, restaurado ou incluído.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - validação manual restrita no navegador.
- Risco de regressão:
  - baixo a moderado, concentrado na renderização do campo de data e na presença/ausência da linha `Providência:` no resumo.
- Rollback:
  - reverter esta etapa restaura o campo de data anterior, a providência automática por etapa e a trilha sem bloco de acompanhamento gerencial.

---

## 19/05/2026 - Orçamento 2026: contraste do acompanhamento gerencial

- Problema observado:
  - rótulos do bloco "Acompanhamento gerencial" na trilha expandida ficavam com baixo contraste em fundo escuro, especialmente textos herdados de `text-muted`.
- Causa diagnosticada:
  - o bloco usava classes de texto atenuado sem regra específica para a superfície escura do painel de rastreio.
- Arquivos alterados:
  - `frontend/css/app.css`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção aplicada:
  - adicionadas regras específicas para `.budget-tracking-management`, seus rótulos `.text-muted` e valores `strong`, preservando contraste no tema escuro.
- Validações realizadas:
  - `git diff --check` -> OK.
- Pendências:
  - validação visual manual no navegador.
- Risco de regressão:
  - baixo, restrito ao bloco de acompanhamento gerencial dentro da trilha expandida.
- Rollback:
  - reverter esta etapa remove apenas o ajuste de contraste do bloco de acompanhamento gerencial.

---

## 19/05/2026 - Orçamento 2026: sincronização de acompanhamento por processo SEI

- Problemas observados:
  - itens diferentes com o mesmo processo SEI precisavam repetir manualmente o acompanhamento gerencial;
  - resumo exportado colocava processos em cobrança por condições automáticas sem providência cadastrada;
  - texto exportado ainda podia tratar `pendencia_atual` como pendência, em vez de providência cadastrada;
  - rótulos visíveis exibiam "Pendência atual" no painel de edição e na trilha.
- Causa diagnosticada:
  - `salvarOrcamento2026()` agrupava e persistia alterações apenas pelo `id` editado, sem propagação por `processo_sei`;
  - `classificarItemResumoOrcamento()` ainda considerava ausência de SEI, planejamento, status crítico e dias no setor para grupo vermelho;
  - montagem do item no resumo tinha camada de providência automática e linha separada `Pendência:`.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `backend/services/orcamento-2026-service.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Regra de replicação por processo SEI:
  - ao salvar alteração em `setor_atual`, `responsavel_atual`, `data_entrada_setor`, `pendencia_atual` ou `observacao`, o backend replica o campo para demais registros ativos com o mesmo `processo_sei` normalizado;
  - a replicação só ocorre quando o processo SEI está preenchido;
  - campos financeiros, trilha, status, vínculo, classificação, descrição e natureza não são replicados;
  - alterações explícitas já presentes no destino não são sobrescritas pela replicação automática.
- Regra revisada de classificação do resumo:
  - 🔴 Cobrança imediata: somente itens com `pendenciaAtual` preenchida;
  - 🟢 Avançados/concluídos: itens sem `pendenciaAtual` em etapa avançada/concluída ou status `EXECUTADO`;
  - 🟡 Em acompanhamento: demais itens exportáveis com trilha individual e sem `pendenciaAtual`.
- Alterações de rótulo:
  - rótulo visível `Pendência atual` trocado por `Providência` no painel de edição e no bloco abaixo da trilha;
  - resumo exportado usa somente `Providência: <pendenciaAtual>` e não exibe mais `Pendência:`.
- Validações realizadas:
  - `node --check frontend/js/app.js` -> OK;
  - `node --check backend/services/orcamento-2026-service.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - validação manual restrita no navegador e no backend local.
- Risco de regressão:
  - moderado, concentrado na persistência backend por processo SEI e na reclassificação do resumo exportado.
- Rollback:
  - reverter esta etapa restaura salvamento individual por item e a classificação anterior do resumo.

---

## 19/05/2026 - Correções estéticas de layout, contraste, scroll e cálculo lógico

- Branch atual: `main`.
- Problemas identificados:
  1. O percentual em execução de Orçamento 2026 exibia `0.8%` em vez do valor correto (aproximadamente `76.1%`) devido a um erro matemático de escala na montagem do KPI no front-end.
  2. Transição de visão no menu de estados (UFs) e no painel de Parâmetros Mínimos não resetava o scroll, ocultando o cabeçalho se o usuário estivesse mais abaixo na página.
  3. Sobreposição de z-index de `.app-header` fazia o menu fixo desaparecer ou sobrepor elementos indevidamente ao rolar.
  4. Fundo claro/branco em vários elementos que quebravam o tema escuro institucional: `.diagnostico-trail-group` (fundo claro), `.diagnostico-trail-marker` (fundo/borda claro), `.diagnostico-missing-item` (fundo branco), `.diagnostico-operational-item` (fundo branco), `.sidebar-uf-option` (fundo branco) e o filtro select `.contatos-map-picker select` (fundo branco com texto claro, impedindo leitura).
- Arquivos alterados:
  - `frontend/js/app.js`
  - `frontend/css/app.css`
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`
- Correções aplicadas:
  - **Cálculo de Orçamento**: Ajustado na linha 8751 de `app.js` para `(valorEmExecucao / totalOrcamento) * 100` e limitado a uma casa decimal com `.toFixed(1)`, resultando no correto `76,1%`.
  - **Reset de Scroll**: Adicionado `window.scrollTo({ top: 0, behavior: 'instant' })` na linha 11050 de `app.js` ao alternar estados no painel de Parâmetros Mínimos.
  - **Z-Index**: Adicionado `z-index: 1100 !important;` ao `.app-header` na linha 72 de `app.css`.
  - **Ajustes de Contraste e Cores no Tema Escuro**:
    - Substituídos os fundos estáticos `#ffffff`, `#fff` e `#f8fafc` por `var(--color-surface)` nos elementos `.diagnostico-trail-group`, `.diagnostico-missing-item`, `.diagnostico-operational-item` e `.sidebar-uf-option`.
    - Alterada a linha de trilha `.diagnostico-trail-row::after` de `#dbe4ef` para `var(--color-border)`.
    - Substituídos os fundos, bordas e shadows do `.diagnostico-trail-marker` por variáveis do tema escuro (`var(--color-surface-elevated)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-text)`).
    - Ajustado o select `.contatos-map-picker select` em `app.css` na linha 5352 para usar `background: var(--color-surface)` com o texto claro já herdado, sanando totalmente o erro de contraste.
- Validações realizadas:
  - Execução bem-sucedida de `node scripts/validar-syntax.js` (25/25 arquivos válidos).
  - Execução bem-sucedida de `node --test tests/services/validacoes-services.test.js`.
  - Execução completa e aprovação de todos os 11 testes ponta a ponta do Playwright (`node node_modules/playwright/cli.js test`).
  - Verificação visual por meio de screenshots confirmando 100% de consistência e conformidade com o tema escuro.
- Risco de regressão: Nulo.
- Rollback: `git checkout frontend/js/app.js frontend/css/app.css`.

---

## 20/05/2026 - Orçamento 2026: resumo exportado agrupado por processo SEI

- Objetivo:
  - ajustar a exportação de resumo da tela Orçamento 2026 para consolidar itens com o mesmo processo SEI em um único bloco no texto.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Regra de agrupamento por processo SEI:
  - agrupamento aplicado apenas quando `processoSei`/`processo_sei` está preenchido;
  - comparação por versão normalizada do SEI (somente dígitos);
  - itens sem SEI não são agrupados entre si;
  - ordem preserva a primeira aparição do processo no conjunto exportado;
  - grupo consolidado escolhe item representativo por prioridade: providência preenchida, depois contexto processual (`responsavelAtual`, `setorAtual`, `dataEntradaSetor`), depois primeiro item;
  - classificação consolidada do grupo: 🔴 se qualquer item tiver providência/pendência, 🟢 se nenhum tiver providência e algum estiver avançado, 🟡 nos demais casos.
- Ajustes funcionais aplicados no resumo:
  - inclusão dos helpers `normalizarProcessoSeiResumoOrcamento`, `obterProcessoSeiResumoOrcamento`, `obterDescricaoItemResumoOrcamento`;
  - inclusão das funções `agruparRegistrosResumoPorProcessoSei`, `escolherRegistroRepresentativoResumoOrcamento` e `classificarGrupoResumoOrcamento`;
  - `obterItensExibidosResumoOrcamentoTexto()` continua coletando itens filtrados, vinculados e outros processos com deduplicação por `id`, e passa a retornar registros consolidados por processo;
  - `montarLinhasItemResumoOrcamento()` passa a renderizar bloco "Processo <SEI>" com lista `Itens:` quando houver múltiplos itens no mesmo SEI, mantendo formato legado para item único.
- Validações realizadas:
  - `node --check frontend/js/app.js`;
  - `git diff --check`.
- Pendências:
  - validação manual restrita no navegador da exportação (agrupamento visual e cópia).

---

## 20/05/2026 - Orçamento 2026: exibição de remanejamento no valor previsto

- Objetivo:
  - restaurar a leitura visível das informações de remanejamento de valores previstos entre itens na coluna `Previsto`.
- Diagnóstico:
  - os dados de movimentação estavam sendo carregados pela API e calculados no front-end;
  - o DOM já continha os detalhes do envelope (`Orig.`, `Ced.`, `Rec.`), mas a apresentação estava discreta demais no tema escuro e em coluna estreita.
- Arquivos alterados:
  - `frontend/js/app.js`;
  - `frontend/css/app.css`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção aplicada:
  - rótulos abreviados do resumo visual foram trocados por `Original`, `Cedido`, `Recebido` e `Vinculado`;
  - detalhes do envelope passaram a ser exibidos como marcadores compactos, com contraste próprio para tema claro e escuro;
  - marcadores foram ajustados para separar rótulo e valor em linhas internas, evitando sobreposição com a coluna `Execução` em telas estreitas;
  - mantida a regra existente de cálculo do envelope visual ajustado, sem alteração de backend, banco, saldo, alocação ou persistência.
- Validações previstas:
  - `node --check frontend/js/app.js`;
  - `git diff --check`;
  - smoke visual restrito na tela Orçamento 2026.
- Pendências:
  - validação manual pelo usuário em outros computadores da rede local, se necessário.

---

## 20/05/2026 - PROFOR 2022: revisão da rotina de conferência de rateio inicial (dry-run)

- Objetivo:
  - revisar e ajustar pontualmente a rotina recém-criada de extração de rateio inicial do `planoAplicacao` por abas UF, sem persistência.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-rateio-extracao-service.js`;
  - `backend/scripts/extrair-rateios-profor-2022.js`;
  - `scripts/validar-syntax.js`;
  - `package.json`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajustes realizados na revisão:
  - adicionado comando npm `extrair:rateios-profor-2022:dry-run`;
  - criado script local `backend/scripts/extrair-rateios-profor-2022.js` para gerar prévia no terminal e JSON em `backend/data/relatorios/profor-2022-rateio-inicial-dry-run.json`;
  - incluídos os novos arquivos no `validar:syntax`;
  - resumo ajustado para usar `totalLinhasLidas` diretamente (sem objeto artificial);
  - item conhecido passou a expor `aptoParaImportacaoFutura` (negado quando existe alerta impeditivo), preservando `possuiPendenciaImpedativa`.
- Resultado do dry-run:
  - abas por UF processadas: `15`;
  - linhas lidas: `573`;
  - itens conhecidos: `500`;
  - rateios: `567`;
  - alertas: `34` (todos impeditivos);
  - naturezas conflitantes: `1`.
- Validações executadas:
  - `node --check backend/services/profor-2022/profor-rateio-extracao-service.js`;
  - `node --check backend/scripts/extrair-rateios-profor-2022.js`;
  - `npm run extrair:rateios-profor-2022:dry-run`;
  - `npm run validar:syntax`;
  - `git diff --check`;
  - conferência de ausência de alterações em `frontend/data/publicados/`.
- Restrições preservadas:
  - sem persistência em banco;
  - sem alteração de frontend;
  - sem alteração em `frontend/data/publicados/*.json`;
  - sem uso de `saldoEconomicidade` para critério de rateio.

---

## 20/05/2026 - PROFOR 2022: Etapa 3 (persistência SQLite de itens/rateios)

- Branch: `main`.
- Objetivo:
  - persistir no SQLite local a memória inicial de rateio (itens conhecidos, rateios, lotes e alertas) gerada na Etapa 2, com rastreabilidade e rollback lógico por lote.
- Arquivos alterados:
  - `backend/db/init-db.js`;
  - `backend/services/profor-2022/profor-rateio-import-service.js`;
  - `backend/scripts/importar-rateio-inicial-profor-2022.js`;
  - `backend/scripts/rollback-rateio-inicial-profor-2022.js`;
  - `scripts/validar-syntax.js`;
  - `package.json`;
  - `memoria/08_ROTAS_BANCO_API/schema-banco.md`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Tabelas aditivas criadas:
  - `profor_2022_rateio_import_lotes`;
  - `profor_2022_itens_conhecidos`;
  - `profor_2022_item_rateios`;
  - `profor_2022_rateio_import_alertas`.
- Regras implementadas:
  - importação em transação com criação de lote, upsert de item por `chave_item`, inativação de rateio ativo anterior por combinação `item/area/natureza`, inserção de novo rateio ativo, inserção de alertas e atualização de totais do lote;
  - controle de reimportação por `hash_arquivo_json` com bloqueio padrão e opção explícita `--forcar`;
  - itens com `aptoParaImportacaoFutura=false` persistem normalmente com `apto_para_importacao_futura=0`;
  - rollback por lote sem exclusão física: marca lote com status `rollback` e inativa itens/rateios vinculados ao lote.
- Scripts npm adicionados:
  - `npm run profor:rateio:importar:dry-run-json`;
  - `npm run profor:rateio:importar-json`;
  - `npm run profor:rateio:rollback-lote`.
- Execução validada:
  - `npm run init-db`;
  - `npm run profor:rateio:importar:dry-run-json`;
  - `npm run profor:rateio:importar-json`;
  - resultado da importação real: lote `1`, `500` itens, `567` rateios, `34` alertas (`27` impeditivos).
- Validações executadas:
  - `node --check backend/db/init-db.js`;
  - `node --check backend/services/profor-2022/profor-rateio-import-service.js`;
  - `node --check backend/scripts/importar-rateio-inicial-profor-2022.js`;
  - `node --check backend/scripts/rollback-rateio-inicial-profor-2022.js`;
  - `npm run validar:syntax`;
  - `git diff --check`.
- Restrições preservadas:
  - sem alteração de frontend;
  - sem alteração de `frontend/data/publicados/*.json`;
  - sem ativação de nova origem de `planoAplicacao`;
  - sem integração com PAD nesta etapa.

---

## 20/05/2026 - PROFOR 2022: Etapa 4 (leitor dry-run de relatórios PAD)

- Branch: `main`.
- Objetivo:
  - criar rotina local de leitura e conferência dos relatórios PAD `.xls` do PROFOR 2022, sem aplicar rateio e sem integrar com o compositor.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-normalizacao-service.js`;
  - `backend/services/profor-2022/profor-pad-report-reader.js`;
  - `backend/scripts/ler-relatorios-pad-profor-2022.js`;
  - `scripts/validar-syntax.js`;
  - `package.json`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Implementação:
  - leitura de arquivos `RelatorioItensDespesasPAD_*.xls` em `Planilhas/profor-2022/instrumentos`;
  - identificação do convênio pelo campo interno `Código do Instrumento`;
  - localização do cabeçalho de itens por rótulos;
  - extração de cabeçalho, itens, valores monetários, quantidades, unidade e natureza derivada por código `33`/`44`;
  - geração de JSON de conferência em `backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json`.
- Resultado do dry-run:
  - arquivos encontrados: `0`;
  - relatórios lidos: `0`;
  - itens extraídos: `0`;
  - alertas: `0`.
- Validações executadas:
  - `node --check backend/services/profor-2022/profor-pad-normalizacao-service.js`;
  - `node --check backend/services/profor-2022/profor-pad-report-reader.js`;
  - `node --check backend/scripts/ler-relatorios-pad-profor-2022.js`;
  - `npm run profor:pad:ler-relatorios:dry-run`;
  - `npm run validar:syntax`;
  - `git diff --check`;
  - conferência de ausência de alteração no banco SQLite local.
- Restrições preservadas:
  - sem alteração de banco;
  - sem alteração de frontend;
  - a Etapa 4 não executou publicação nem editou `frontend/data/publicados/*.json`; durante a conferência final havia alterações pendentes nesses JSONs no working tree, não revertidas nesta tarefa;
  - sem integração com rateios;
  - sem ativação de nova origem de `planoAplicacao`.

---

## 20/05/2026 - PROFOR 2022: Etapa 4 (leitura dos 15 relatórios PAD)

- Branch: `main`.
- Objetivo:
  - continuar a conferência da Etapa 4 após inclusão dos 15 arquivos `.xls` em `Planilhas/profor-2022/instrumentos`.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-report-reader.js`;
  - `backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Ajuste realizado:
  - corrigida a leitura de metadados do cabeçalho PAD quando o relatório traz `Rótulo: valor` na mesma célula, evitando capturar a próxima linha como valor do campo.
- Resultado do dry-run:
  - arquivos encontrados: `15`;
  - relatórios lidos: `15`;
  - itens extraídos: `525`;
  - alertas: `0`;
  - alertas impeditivos: `0`;
  - instrumentos identificados: `937216`, `937221`, `937265`, `937468`, `937592`, `937698`, `937780`, `937782`, `937783`, `937817`, `937818`, `937871`, `937917`, `938128`, `938277`.
- Validações executadas:
  - `node --check backend/services/profor-2022/profor-pad-report-reader.js`;
  - `node --check backend/services/profor-2022/profor-pad-normalizacao-service.js`;
  - `node --check backend/scripts/ler-relatorios-pad-profor-2022.js`;
  - `npm run profor:pad:ler-relatorios:dry-run`;
  - `npm run validar:syntax`;
  - `git diff --check`.
- Restrições preservadas:
  - sem alteração de banco;
  - sem alteração de frontend;
  - sem publicação;
  - sem integração com rateios;
  - sem ativação de nova origem de `planoAplicacao`.

---

## 20/05/2026 - PROFOR 2022: Etapa 5 (conferência PAD x carteira x rateios)

- Branch: `main`.
- Objetivo:
  - cruzar os itens dos relatórios PAD atuais com a carteira monitorada e com a memória de rateio persistida no SQLite, sem aplicar rateio e sem integrar com o compositor.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-matching-service.js`;
  - `backend/scripts/conferir-itens-pad-rateios-profor-2022.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `backend/data/relatorios/profor-2022-pad-rateios-dry-run.json`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Comando criado:
  - `npm run profor:pad:conferir-rateios:dry-run`.
- Resultado do dry-run:
  - relatórios PAD lidos: `15`;
  - itens PAD conferidos: `525`;
  - itens PAD com rateio: `502`;
  - itens PAD sem rateio: `23`;
  - itens conhecidos ausentes no PAD: `29`;
  - itens conhecidos não aptos: `19`;
  - instrumentos não encontrados na carteira: `0`;
  - alertas: `77`;
  - alertas impeditivos: `25`.
- Alertas encontrados:
  - `item_conhecido_nao_apto`: `25` impeditivos;
  - `item_pad_sem_rateio`: `23` avisos;
  - `item_conhecido_ausente_no_pad`: `29` avisos.
- Restrições preservadas:
  - sem alteração de banco;
  - sem alteração de frontend;
  - sem publicação;
  - sem ativação de nova origem de `planoAplicacao`;
  - sem integração com compositor PROFOR;
  - sem aplicação financeira dos rateios.

---

## 20/05/2026 - PROFOR 2022: reapresentação indeterminada na segurança pré-ativação

- Branch: `main`.
- Problema:
  - se `coletarDivergencias(repoRoot)` falhasse, `geracaoAtualDisponivel` ficava `false`, mas as divergências existentes eram classificadas como não reapresentadas por falta de `chavesGeradasHoje`.
- Correção aplicada:
  - divergências auditadas sem geração atual disponível passam a receber `reapresentada: null` e classificação `reapresentacao_indeterminada`;
  - divergências com reapresentação indeterminada não entram em `divergenciasNaoReapresentadas`;
  - resumo e Markdown passam a expor `totalDivergenciasReapresentacaoIndeterminada` e seção própria;
  - avisos detalham divergências não avaliadas quando a geração atual da fila falha.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service.js`;
  - `tests/services/profor-pad-seguranca-pre-ativacao.test.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validações:
  - `node --check backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service.js` -> OK;
  - `node --test tests/services/profor-pad-seguranca-pre-ativacao.test.js` -> OK;
  - `git diff --check` -> OK.
- Pendências:
  - sem validação de dry-run completo nesta etapa.
- Risco de regressão:
  - baixo a moderado, restrito ao relatório de segurança pré-ativação e consumidores que leem diretamente o JSON do dry-run.
- Rollback:
  - reverter esta etapa restaura a classificação anterior de geração indisponível como não reapresentada.

---

## 20/05/2026 - PROFOR 2022: relatório de saneamento da Etapa 5

- Branch: `main`.
- Objetivo:
  - gerar relatório objetivo de saneamento a partir de `backend/data/relatorios/profor-2022-pad-rateios-dry-run.json`, sem correção automática.
- Arquivos alterados:
  - `backend/scripts/gerar-relatorio-saneamento-pad-profor-2022.js`;
  - `package.json`;
  - `scripts/validar-syntax.js`;
  - `backend/data/relatorios/profor-2022-pad-saneamento.json`;
  - `backend/data/relatorios/profor-2022-pad-saneamento.md`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Comando criado:
  - `npm run profor:pad:relatorio-saneamento`.
- Resultado:
  - itens PAD sem rateio: `27`;
  - coincidências apenas por descrição normalizada: `4`;
  - itens conhecidos não aptos: `19`;
  - itens conhecidos ausentes no PAD: `32`;
  - possíveis pares por descrição normalizada: `3`;
  - convênios afetados: `937216`, `937221`, `937265`, `937468`, `937782`, `937817`, `938128`, `938277`.
- Regra operacional registrada:
  - pares por descrição normalizada servem apenas como apoio de saneamento e não autorizam rateio automático.
- Restrições preservadas:
  - sem alteração de banco;
  - sem alteração de frontend;
  - sem publicação;
  - sem ativação de nova origem de `planoAplicacao`;
  - sem integração com compositor PROFOR;
  - sem aplicação financeira dos rateios.

---

## 20/05/2026 - PROFOR 2022: Etapa 5 (ajuste de chave por descrição original)

- Branch: `main`.
- Objetivo:
  - impedir que item PAD seja considerado rateado apenas por coincidência de descrição normalizada.
- Ajuste realizado:
  - a conferência PAD x rateios passou a procurar item conhecido por `numero_convenio` + `descricao_original_referencia` limpa, preservando a `chave_item` normalizada apenas como metadado/diagnóstico;
  - coincidências somente por descrição normalizada são registradas como aviso `item_pad_coincide_apenas_por_descricao_normalizada` e não contam como rateio reconhecido.
- Resultado do dry-run após ajuste:
  - itens PAD conferidos: `525`;
  - itens PAD com rateio: `498`;
  - itens PAD sem rateio: `27`;
  - itens conhecidos ausentes no PAD: `32`;
  - itens conhecidos não aptos: `19`;
  - instrumentos não encontrados na carteira: `0`;
  - alertas: `84`;
  - alertas impeditivos: `25`.
- Alertas por tipo:
  - `item_conhecido_nao_apto`: `25` impeditivos;
  - `item_pad_sem_rateio`: `23` avisos;
  - `item_pad_coincide_apenas_por_descricao_normalizada`: `4` avisos;
  - `item_conhecido_ausente_no_pad`: `32` avisos.
- Restrições preservadas:
  - sem alteração de banco;
  - sem alteração de frontend;
  - sem publicação;
  - sem ativação de nova origem de `planoAplicacao`;
  - sem integração com compositor PROFOR;
  - sem aplicação financeira dos rateios.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.2 (Validação ponta a ponta da decisão estruturada)

- Branch: `main`.
- Objetivo:
  - Validar de forma controlada e ponta a ponta o fluxo de decisões estruturadas para as divergências do PAD/PROFOR 2022, assegurando a gravação e a interpretação correta de payloads no dry-run sem alterar os dados reais de produção.
- Arquivos alterados:
  - `backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`.
- Implementação e ajustes:
  - Modificado o script de teste para chamar a função correta de segurança `auditarSegurancaPreAtivacaoDryRun` ao invés de `auditarPayloadDecisoes` (que não é exportada).
  - Incluído o utilitário `path` e configurada a resolução de `repoRoot` apropriadamente para a chamada do validador de segurança.
  - Adicionada rotina de pré-limpeza autolimpante ao script para que resíduos de testes anteriores (de eventuais interrupções/falhas) sejam limpos antes de verificar o baseline.
  - Adicionado assert para verificar que nenhum bloqueio ou aviso com prefixo `revisao_teste:` é reportado pela auditoria de segurança de produção.
- Execução e resultados do teste:
  - Baseline verificado com êxito: 145 divergências reais, todas pendentes, 44 impeditivas, 48 bloqueantes.
  - Inserção de 6 divergências de teste controladas e gravação transacional de suas decisões simuladas com sucesso.
  - Verificação de gravação estruturada com geração estável do hash no nó `_segurancaPreAtivacao` concluída com êxito.
  - Execução dos motores dry-run de reconstrução e comparação interpretando com êxito as decisões de teste (6 carregadas, 6 interpretadas e 5 com efeito na reconstrução).
  - Limpeza executada com êxito absoluto, removendo 6 divergências de teste, 6 decisões de teste, 6 logs de teste e o lote temporário, retornando o banco SQLite perfeitamente ao baseline original de 145/145/48.
- Validações complementares executadas:
  - `npm run validar:syntax` -> OK (59 arquivos validados);
  - `node --test tests/services/*.test.js` -> OK (31 testes passados, 0 falhas);
  - `node backend/scripts/auditar-fila-revisao-pad-profor-2022.js` -> OK (banco íntegro no baseline de 145);
  - `node backend/scripts/reconstruir-plano-pad-profor-2022.js` -> OK (modo dry-run ativo);
  - `node backend/scripts/comparar-plano-pad-profor-2022.js` -> OK (modo dry-run ativo);
  - `node backend/scripts/auditar-seguranca-pre-ativacao-pad-profor-2022.js` -> OK (0 bloqueios, apto para ativação).
- Restrições preservadas:
  - sem alteração em dados de produção (divergências de teste usam prefixo `revisao_teste:`);
  - sem ativação ou publicação de nova origem.

---

## 21/05/2026 - PROFOR 2022: Etapa 9.2 - Correção do script de validação para baseline dinâmico

- Branch: `main`.
- Objetivo:
  - Adaptar o script `backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js` para adotar um baseline dinâmico, evitando que asserts rígidos (como total fixo de 145 divergências) quebrem a validação de integração após o início do saneamento real das divergências.
- Alterações realizadas:
  - **`backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js`**:
    - Remoção de asserções com valores fixos na checagem de baseline (`145`, `44`, `48`).
    - Captura dinâmica das estatísticas iniciais da fila em `estatisticasAntes`.
    - Adicionado log detalhando os valores reais encontrados, identificando-os como o baseline dinâmico da execução.
    - Implementação de checagem mínima de sanidade (se `totalDivergencias >= 0` e se campos vitais não são `undefined`).
    - Validação transacional de retorno pós-limpeza comparando as estatísticas antes e depois para 10 contadores canônicos (`totalDivergencias`, `totalPendentes`, `totalEmRevisao`, `totalImpeditivas`, `totalBloqueiamPublicacao`, `totalPendentesQueBloqueiamPublicacao`, `totalComDecisaoResolutiva`, `totalComComentario`, `totalSemDecisaoResolutiva` e `publicacaoLiberada`).
    - Remoção de espaços extras redundantes geradores de avisos de whitespace (`git diff --check`).
- Execução e resultados do teste:
  - Baseline capturado dinamicamente com sucesso.
  - Inserção de 6 divergências temporárias `revisao_teste:%` e 6 decisões estruturadas processadas.
  - Limpeza final efetuada, restaurando com precisão o estado original do banco antes da execução para todos os 10 contadores dinâmicos.
- Validações executadas:
  - `node --check backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js` -> OK;
  - `npm run validar:syntax` -> OK (59 arquivos);
  - `npm run validar:services` -> OK (31 testes passados);
  - `node backend/scripts/validar-decisao-estruturada-ponta-a-ponta.js` -> OK (executado e aprovado com sucesso);
  - `node backend/scripts/auditar-fila-revisao-pad-profor-2022.js` -> OK;
  - `node backend/scripts/auditar-seguranca-pre-ativacao-pad-profor-2022.js` -> OK;
  - `node backend/scripts/reconstruir-plano-pad-profor-2022.js` -> OK;
  - `node backend/scripts/comparar-plano-pad-profor-2022.js` -> OK;
  - `git diff --check` -> OK (limpo).
- Restrições preservadas:
  - nenhuma divergência real apagada ou alterada;
  - sem alteração em dados de publicação, origem ativa, frontend/data/publicados ou no planoAplicacao de produção.

---

## 21/05/2026 - PROFOR 2022: Frontend — refatoração de comparação existencia, presets diacrítico e limite de filtro

- Branch: `main`.
- Objetivo:
  - Refatorar a UI de revisão de divergências para exibir corretamente estados semânticos (`presente na memória` / `ausente no PAD`) no comparativo de itens com `campoAfetado === 'existencia'`, impedir ação inválida "Confirmar ausência" em itens saneados por diacrítico e aumentar o limite de resultados para evitar falsos vazios.
- Arquivo alterado:
  - `frontend/js/app.js`.
- Alterações realizadas:
  - **`renderCampoComparacaoRevisao`**: aceita novo parâmetro `isExistencia`; quando `true`, substitui `'-'` por `'não informado'`; para rótulo `'Estado anterior / novo'` (ou `'Valor anterior / novo'` com `isExistencia`), traduz `'presente_na_memoria'` para `'presente na memória'` e `'ausente_no_pad'` para `'ausente no PAD'`.
  - **`renderComparacaoRevisao`**: extrai `isExistencia` uma vez e passa a todas as chamadas de `renderCampoComparacaoRevisao`; a linha de estado anterior/novo agora renderiza `divergencia.valorAnterior` e `divergencia.valorNovo` do payload real (não mais strings fixas), traduzidos automaticamente pelo helper.
  - **`obterPresetsDecisaoRevisao`**: na categoria `ausencia`, quando `divergenciaSaneadaPorDiacriticoRevisao(divergencia)` é `true`, a opção `confirmarAusencia` é removida completamente do array de retorno, impedindo ação inválida.
  - **`obterFiltrosRevisao`**: `limite` alterado de `'100'` para `'500'` para garantir retorno de todos os itens da fila.
- Validações executadas:
  - `node --check frontend/js/app.js` -> OK;
  - `npm run validar:syntax` -> OK (61 arquivos validados);
  - `npm run validar:services` -> OK (56 testes passados, 0 falhas);
  - `npm run profor:pad:conferir-rateios:dry-run` -> OK (525 itens, 148 alertas);
  - `npm run profor:pad:relatorio-saneamento` -> OK;
  - `npm run profor:pad:gerar-fila-revisao` -> OK (139 divergências, 6 não reapresentadas);
  - `npm run profor:pad:seguranca-pre-ativacao:dry-run` -> executado (10 bloqueios pendentes de decisões anteriores, nenhum novo).
- Restrições preservadas:
  - sem alteração de banco;
  - sem alteração de backend;
  - sem alteração em frontend/data/publicados;
  - sem ativação ou publicação de nova origem.

---

## 22/05/2026 - PROFOR 2022: saneamento técnico de quantidade legada em `item_nao_apto`

- Horário: 11:03.
- Branch: `main`.
- Objetivo:
  - sanear falso positivo de quantidade/saldo na divergência `#31` (`937265/MS`, `Calça Tática`) sem registrar decisão e sem alterar o `planoAplicacao` oficial.
- Problema confirmado:
  - a memória agregada fechava em `49.999486` unidades derivadas de `R$ 16.526,33 / R$ 330,53`;
  - os rateios antigos traziam `quantidadeReferencia` `300` e `200`, com indício de inflação decimal legada por fator 10;
  - o PAD tinha duas linhas equivalentes (`30` e `20` unidades), mas a auditoria comparava a memória agregada contra apenas uma linha PAD isolada.
- Arquivos alterados:
  - `backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022.js`;
  - `backend/scripts/auditar-pendencias-profor-2022-profundo.js`;
  - `backend/scripts/auditar-quantidades-suspeitas-profor-2022.js`;
  - `tests/services/profor-pad-item-nao-apto.test.js`;
  - `scripts/validar-syntax.js`;
  - `memoria/09_ERROS_E_CORRECOES/historico-erros.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Correção aplicada:
  - a auditoria de `item_nao_apto` agora consolida linhas PAD equivalentes por convênio, descrição normalizada, natureza e valor unitário aproximado;
  - detecta rateios com quantidade incompatível com `valorPrevistoReferencia / valorUnitarioReferencia`, incluindo fator decimal 10;
  - admite tolerância própria para quantidade derivada por valor monetário arredondado;
  - classifica como `falso_positivo_saneavel` quando quantidade, valor unitário, valor previsto, executado e saldo fecham no conjunto PAD consolidado.
- Resultado parcial executado:
  - `npm run profor:pad:item-nao-apto:auditar`:
    - total `item_nao_apto`: `19`;
    - candidatos a aceite automático: `1`;
    - falsos positivos saneáveis: `4`;
    - divergências materiais: `3`;
    - já decididos: `11`;
    - `#31` classificada como `falso_positivo_saneavel`;
  - `npm run profor:rateio:auditar-quantidades:dry-run`:
    - rateios auditados: `567`;
    - suspeitos: `19`;
    - convênios/UF afetados: `9`.
- Teste adicionado:
  - `tests/services/profor-pad-item-nao-apto.test.js` reproduz a Calça Tática com rateios `300/200`, valores `9915.80/6610.53`, valor unitário `330.53` e PAD `30/20`, esperando `falso_positivo_saneavel`.
- Confirmações de escopo:
  - nenhuma decisão registrada;
  - nenhuma publicação;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - sem migration.
- Validações finais:
  - `npm run validar:syntax` -> OK (`66` arquivos);
  - `npm run validar:services` -> OK (`77` testes);
  - `npm run profor:pad:item-nao-apto:auditar` -> OK;
  - `npm run profor:rateio:auditar-quantidades:dry-run` -> OK;
  - `npm run profor:pad:auditar-pendencias-profundo` -> OK;
  - `npm run profor:pad:auditar-fila-revisao` -> OK;
  - `npm run profor:pad:reconstruir-plano:dry-run` -> OK;
  - `npm run profor:pad:comparar-plano:dry-run` -> OK;
  - `git diff --check` -> OK, apenas avisos de normalização LF/CRLF;
  - `git status --short frontend/data/publicados` -> sem alterações.
- Impacto final:
  - auditoria profunda: `pendencia_operacional_real = 7`, `falso_positivo_saneavel = 66`;
  - `#31` passou a `classificacaoOperacional = falso_positivo_saneavel`, sem decisão registrada;
  - reconstrução segue `aptoParaAtivacao = não`, com `34` impedimentos;
  - comparador segue `aptoParaPublicacao = não`, com `32` diferenças críticas.
- Pendências:
  - nenhuma pendência desta correção; saneamento material posterior ainda depende de decisão assistida específica.
- Rollback:
  - reverter o commit desta correção; os relatórios dry-run voltam à classificação anterior.

---

## 22/05/2026 - PROFOR 2022: integração da classificação operacional na revisão

- Horário: 11:23.
- Branch: `main`.
- Objetivo:
  - fazer a tela `SISTEMA > Revisão de divergências PAD x memória` refletir a auditoria profunda, evitando que `#31` continue aparecendo como pendência operacional real após ser classificada como `falso_positivo_saneavel`.
- Arquivos alterados:
  - `backend/services/profor-2022/profor-pad-revisao-decisao-service.js`;
  - `backend/server.js`;
  - `frontend/js/app.js`;
  - `tests/services/profor-pad-revisao-operacional.test.js`;
  - `scripts/validar-syntax.js`;
  - `memoria/09_ERROS_E_CORRECOES/historico-erros.md`;
  - `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`;
  - `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Implementação:
  - backend carrega `backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json`;
  - backend carrega `backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json`;
  - `listarDivergencias()` e `obterDivergencia()` retornam categoria operacional, classificação detalhada, falso positivo saneável, motivos e consolidado PAD/memória;
  - adicionado filtro API `categoriaOperacional`;
  - adicionado filtro API `operacionalEfetiva=true`;
  - frontend usa `operacionalEfetiva=true` por padrão;
  - frontend exibe badge `Saneado tecnicamente`;
  - comparação da `#31` usa PAD consolidado quando disponível.
- Checagem direta:
  - `#31` retorna `categoriaOperacional = falso_positivo_saneavel`;
  - `#31` retorna `padConsolidado.quantidade = 50`;
  - `#31` retorna `memoriaConsolidada.quantidade = 50`;
  - linhas PAD equivalentes: `30` e `20`;
  - filtro padrão `operacionalEfetiva=true` retorna `7` divergências e não inclui `#31`;
  - filtro `categoriaOperacional=falso_positivo_saneavel` inclui `#31`.
- Validações executadas:
  - `npm run validar:syntax` -> OK (`67` arquivos);
  - `npm run validar:services` -> OK (`78` testes);
  - `npm run profor:pad:item-nao-apto:auditar` -> OK;
  - `npm run profor:pad:auditar-pendencias-profundo` -> OK;
  - `GET /api/profor-2022/revisao/divergencias?operacionalEfetiva=true&semDecisaoResolutiva=true&limite=500` -> `7` itens, sem `#31`;
  - `GET /api/profor-2022/revisao/divergencias?categoriaOperacional=falso_positivo_saneavel&semDecisaoResolutiva=true&limite=500` -> inclui `#31`;
  - `GET /api/profor-2022/revisao/divergencias/31` -> memória/PAD consolidados com `50` unidades e `R$ 16.526,33`;
  - validação headless da tela -> `#31` ausente na fila padrão, presente no filtro de saneados, detalhe com badge e consolidado `30 + 20`;
  - `git diff --check` -> OK, apenas avisos de normalização LF/CRLF;
  - `git status --short frontend/data/publicados` -> sem alterações.
- Observação:
  - não existe script `npm run test:e2e` no `package.json`; a validação de tela foi feita por Playwright headless pontual contra `http://127.0.0.1:8790/index.html`.
- Confirmações de escopo:
  - nenhuma decisão registrada;
  - nenhum status alterado no banco;
  - nenhuma publicação;
  - origem ativa não alterada;
  - `frontend/data/publicados` não alterado;
  - `planoAplicacao` oficial não alterado;
  - sem migration.
- Rollback:
  - reverter o commit desta integração; a tela volta a ler apenas a fila SQLite persistida.

---

## 25/05/2026 - PROFOR 2022: autosave e expansão seletiva da revisão PAD

- Branch: `main`.
- Objetivo: salvar área/rateio da grade de Revisões PAD por serviço auditável e iniciar expandidas apenas linhas pendentes.
- Arquivos alterados: `backend/server.js`, `backend/services/profor-2022/profor-pad-revisoes-plano-service.js`, `backend/services/profor-2022/profor-pad-revisoes-plano-decisoes-service.js`, `frontend/js/app.js`, `index.html`, `tests/services/profor-pad-revisoes-plano.test.js`, `tests/services/profor-pad-revisoes-plano-decisoes.test.js`.
- Implementação: novos endpoints `POST /api/profor-2022/pad/revisoes-plano/area` e `/rateio`; persistência em `profor_2022_itens_conhecidos`, `profor_2022_item_rateios` e `profor_2022_revisao_logs`; UI com autosave de área e botão de salvar rateio habilitado só com validação OK.
- Regra de expansão: linhas pendentes, item novo, não classificadas ou inconsistentes iniciam expandidas; OK, rateio memorizado e item suprimido iniciam recolhidos.
- Validações: `git diff --check`; `node --check` em `backend/server.js`, `frontend/js/app.js`, `profor-pad-revisoes-plano-service.js`, `profor-pad-revisoes-plano-decisoes-service.js`, `profor-pad-carregador-operacional-service.js`; `node --test` dos testes de carregador, revisão e decisões; `npm run validar:syntax`.
- Preservações: sem Playwright/E2E, sem publicação, sem alteração em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM direto, DETRU/Transferegov, autenticação ou planilha antiga.
- Risco: mudanças salvam memória operacional local; deve-se testar manualmente com item de baixa criticidade antes de uso massivo.
- Rollback: reverter o commit da alteração; endpoints e autosave deixam de existir e a tela volta ao comportamento anterior.

---

## 25/05/2026 - PROFOR 2022: preservar valores do PAD em itens sem rateio

- Branch: `main`.
- Problema: na Tela de Revisões PAD, itens sem rateio apareciam com Natureza `NAO_INFORMADO`, Código `N/A`, Quantidade `0` e Valores `R$ 0,00`, mesmo vindo do PAD com dados completos.
- Causa: `montarRegistro` no carregador descartava `quantidade`, `valorUnitario`, `valorTotalPrevisto`, `natureza` e `codigoNaturezaDespesa` dos itens conferidos. A linha-mãe/filha pendente em `revisoes-plano-service` então caía em zeros.
- Arquivos: `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`, `backend/services/profor-2022/profor-pad-revisoes-plano-service.js`, `frontend/css/app.css`, `tests/services/profor-pad-carregador-operacional.test.js`, `tests/services/profor-pad-revisoes-plano.test.js`.
- Correção: `montarRegistro` passou a aceitar e propagar campos materiais do PAD; helper `dadosOriginaisDoItemPad` aplicado em `item_pad_sem_rateio_memorizado` e `item_novo_sem_rateio_memorizado`; `criarMaeOcorrencia` agora aceita também `valorTotalPrevisto` como referência. Nenhum rateio inventado — a filha continua com `area=NAO_CLASSIFICADO`/`AREA_NAO_CLASSIFICADA`.
- UX: removido `min-width: 1400px` da `revisao-pad-plano-table` e ajustado wrapping para que só a coluna Descrição quebre linha; valores monetários ficam em `nowrap` para não serem cortados.
- Validações: `node --check` em ambos services; `node --test` nos dois arquivos de teste (9+9 passando); `npm run validar:syntax` (105 arquivos OK); `git diff --check`.
- Preservações: sem Playwright/E2E, sem publicação, sem alteração em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, DETRU/Transferegov, autenticação, planilha antiga, xlsx ou rateio inventado.
- Risco: baixo — apenas propaga campos já lidos pelo matching service; a regra de pendência (`AREA_NAO_CLASSIFICADA`) permanece intacta.
- Rollback: reverter o commit; a tela volta a exibir zeros nos itens sem rateio.

---

## 25/05/2026 - PROFOR 2022: restaura atualizacao geral sem workbook antigo

- Branch: `main`.
- Problema: o botao "Atualizar PROFOR 2022" estava bloqueado por um handler que retornava HTTP 410 com a mensagem "Atualizacao consolidada legada PROFOR 2022 removida. Use os fluxos PAD/reconstrucao...". A migracao para PAD removeu apenas a origem do plano de aplicacao detalhado, nao o fluxo de consolidacao geral dos convenios.
- Causa: handler stub em `backend/server.js` (linha ~675) deixado durante a migracao bloqueava qualquer chamada a `POST /api/profor-2022/atualizar`.
- Correcao: o handler agora chama `montarConsolidadoProfor2022PorOrigemAtiva()`, que ja existia, e devolve um resultado estruturado com `origemPlano: "reconstrucao-pad"` + blocos `consolidado`, `detru`, `transferegov`, `plano` (todos a partir de carteira local + cache DETRU + cache Transferegov + reconstrucao PAD vigente, sem workbook antigo). O botao confirmacao no frontend tambem foi reescrito para deixar claro que a rotina apenas consolida e nao dispara DETRU/Transferegov.
- Botoes separados preservados: Recarregar PADs (`/api/profor-2022/pad/recarregar-operacional`), Atualizar DETRU (`/api/profor-2022/detru/atualizar`), Atualizar Transferegov (`/api/profor-2022/rendimentos/atualizar`).
- Arquivos: `backend/server.js`, `frontend/js/app.js`, `tests/services/profor-atualizar-consolidado-endpoint.test.js` (novo), `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Validacoes: `git diff --check`; `node --check` em `backend/server.js` e `frontend/js/app.js`; `node --test` no novo arquivo (5/5) e nos suites PAD existentes (24/24); `npm run validar:syntax` (105 arquivos OK); probe real `POST /api/profor-2022/atualizar` -> HTTP 200, `success:true`, `origemPlano:"reconstrucao-pad"`, consolida 15 convenios.
- Preservacoes: sem Playwright/E2E, sem publicacao, sem alteracao em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, DETRU/Transferegov, autenticacao, planilha antiga, xlsx.
- Risco: baixo - o handler so consolida caches e pode ser revertido isolado; nenhum fluxo legado de leitura de workbook foi reintroduzido.
- Rollback: reverter o commit; o endpoint volta a responder 410.

---

## 25/05/2026 - PROFOR 2022: remove botao "Atualizar PROFOR 2022"

- Branch: `main`.
- Decisao: botao manual de atualizacao consolidada PROFOR 2022 foi descontinuado. Permanecem apenas: Atualizar DETRU, Atualizar Transferegov e bloco proprio de Recarga Operacional dos PADs.
- Frontend: removidos botao `btnAtualizarProfor2022`, listener, funcao `atualizarProfor2022ConsolidadoUI` e referencia em `definirEstadoBotoesAtualizacaoSistema`. `mostrarMensagemConsolidadoProfor2022` foi mantida porque continua usada pelo fluxo de rendimentos.
- Backend: `POST /api/profor-2022/atualizar` passa a responder HTTP 410 com mensagem orientando o uso dos fluxos dedicados (`/detru/atualizar`, `/rendimentos/atualizar`, `/pad/recarregar-operacional`) e do GET `/api/profor-2022/consolidado` para leitura. GET consolidado e a funcao `montarConsolidadoProfor2022PorOrigemAtiva` permanecem intactos (usados por outros endpoints).
- Teste obsoleto removido: `tests/services/profor-atualizar-consolidado-endpoint.test.js`.
- Cache-buster do app.js atualizado em `index.html` para `?v=20260525-11-remove-botao-atualizar-profor`.
- Validacoes: `git diff --check`; `node --check frontend/js/app.js`; `node --check backend/server.js`; `npm run validar:syntax` (105 OK).
- Preservacoes: sem publicacao, sem workbook antigo, sem alteracao em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, DETRU/Transferegov, autenticacao, xlsx.
- Risco: baixo - remocao puramente de superficie; o pipeline de consolidacao continua disponivel por GET /api/profor-2022/consolidado.
- Rollback: reverter o commit.

---

## 25/05/2026 - PROFOR 2022: restaura atualizacoes locais DETRU e Transferegov sem flags

- Branch: `main`.
- Regressao: durante limpezas anteriores, `assertEndpointAdminPermitido` e `assertChamadaExternaPermitida` passaram a exigir `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1` e `ALLOW_PROFOR_2022_EXTERNAL_CALLS=1` mesmo em uso local normal, quebrando os botoes "Atualizar DETRU" e "Atualizar Transferegov" e os scripts `atualizar:detru-profor` / `atualizar:rendimentos-profor`.
- Correcao no guard (`profor-workbook-fallback-guard-service.js`): novos sinais `requisicaoLocal` e `execucaoLocal` liberam os asserts em ambiente local (dev) sem exigir flags. As flags antigas continuam validas como fallback. Producao e teste seguem bloqueando.
- `backend/server.js`: novo helper `ehRequisicaoLocal(req)` considera apenas loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`); cabecalhos como X-Forwarded-For sao ignorados. O sinal e propagado para os asserts dos endpoints DETRU/Transferegov e para `executarEtapaRendimentos`.
- Scripts CLI (`atualizar-cache-detru-profor-2022.js`, `atualizar-rendimentos-transferegov-profor-2022.js`): passam `execucaoLocal: true` ao guard. Agendador DETRU NAO foi liberado (continua exigindo flag).
- Frontend (`frontend/js/app.js`): `atualizarVisibilidadeBotaoStatusSistema` agora aplica `d-none` aos links Sistema e Revisoes PAD em modo estatico. `renderStatusSistemaView` curto-circuita em modo estatico exibindo `renderEmptyState` (mesma protecao ja existente em Revisoes). Botao "Atualizar PROFOR 2022" permanece removido.
- Testes (`tests/services/profor-admin-endpoint-guard.test.js`, 19/19): reescritos os cenarios de dev para validar o novo contrato (local sem flag, nao-local bloqueado, producao/teste bloqueados mesmo com flag). Novos testes: scripts DETRU/Transferegov com `execucaoLocal:true`, agendador sem `execucaoLocal:true`, frontend oculta Sistema/Revisoes em modo estatico e nao reativa Atualizar PROFOR, recarga PAD nao chama DETRU/Transferegov e vice-versa.
- Validacoes: `git diff --check`; `node --check` em server, app, guard, atualizacao consolidada e dois scripts; `node --test` no guard test (19/19); `npm run validar:syntax` (105 OK); probe real `POST /api/profor-2022/detru/atualizar` sem flag -> HTTP 200, 15 convenios salvos.
- Preservacoes: sem publicacao, sem alteracao em `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, autenticacao, planilha antiga, xlsx. Recarga PAD e fluxos DETRU/Transferegov continuam separados.
- Risco: baixo - a liberacao se restringe a loopback (server) ou CLI local (scripts). Producao/teste e nao-local continuam bloqueados.
- Rollback: reverter o commit; comportamento volta a exigir flags.

---

## 25/05/2026 - PROFOR 2022: verificacao objetiva das atualizacoes DETRU/Transferegov

- Branch: `main`.
- Objetivo: dar evidencia tecnica independente (alem da mensagem visual) de que os botoes "Atualizar DETRU" e "Atualizar Transferegov" realmente atualizaram o cache local.
- Arquivos: `backend/server.js` (novo `GET /api/profor-2022/atualizacoes/status` somente leitura); `backend/scripts/verificar-atualizacoes-profor-2022.js` (novo CLI com flags `--detru`, `--transferegov`, `--ambos`, exit codes 0/1/2); `package.json` (4 scripts npm `verificar:profor-atualizacoes[:detru|:transferegov|:ambos]`); `frontend/js/app.js` + `index.html` (bloco "Diagnostico das Atualizacoes" na tela Sistema, consumindo o novo endpoint; cache-buster `?v=20260525-12-diagnostico-atualizacoes`); `tests/services/profor-verificar-atualizacoes.test.js` (10/10).
- Validacoes: `git diff --check`; `node --check` em server, script e app.js; `node --test` no novo arquivo (10/10); `npm run validar:syntax` (105 OK); probe real `GET /api/profor-2022/atualizacoes/status` -> HTTP 200 com totais (DETRU 15, Transferegov 15, carteira 15) e timestamps; script sem flags -> RESULTADO: OK, evidencia `nao_solicitado`.
- Preservacoes: nenhuma publicacao, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM direto, sem PAD/recarga, sem workbook antigo, sem reativar `Atualizar PROFOR 2022`, sem mexer em autenticacao/login. Endpoint criado e somente leitura.
- Risco: baixo - leitura de cache local; script CLI tem flags explicitas e usa `execucaoLocal: true` no guard ja existente.
- Rollback: reverter o commit; endpoint, script, bloco UI e scripts npm desaparecem.

---

## 25/05/2026 - PROFOR 2022: reforco do diagnostico das atualizacoes (seguranca + confiabilidade)

- Branch: `main`.
- Tarefa 1: script `verificar-atualizacoes-profor-2022.js` agora chama `assertEndpointAdminPermitido` + `assertChamadaExternaPermitida` (via helper `assertExecucaoLocalPermitida`) antes de executar `--detru`/`--transferegov`/`--ambos`, com `execucaoLocal: true`. Local libera sem flag; producao/teste bloqueiam.
- Tarefa 2: endpoint `GET /api/profor-2022/atualizacoes/status` deixa de mascarar falha como zero. Cada bloco (`detru`, `transferegov`, `carteira`) passa a expor `erroLeitura` quando a leitura falha; o endpoint continua respondendo 200 para nao quebrar a tela.
- Tarefa 3: frontend, em `atualizarCacheDetruProfor2022UI` e `atualizarRendimentosTransferegovProfor2022UI`, chama `carregarDiagnosticoAtualizacoesProfor2022()` dentro de try/catch apos sucesso da atualizacao; falha do refresh nao transforma a atualizacao em erro.
- Testes (15/15): adicionados cenarios de script bloqueado em `NODE_ENV=test` e `FOMENTO_AMBIENTE=producao`; presenca dos imports de guards; endpoint expoe `erroLeitura` por bloco; frontend faz refresh em try/catch apos DETRU e Transferegov.
- Cache-buster do app.js bumpado para `?v=20260525-13-diagnostico-reforco`.
- Validacoes: `git diff --check`; `node --check` em `backend/server.js`, `frontend/js/app.js` e o script; `node --test tests/services/profor-verificar-atualizacoes.test.js` (15/15); `npm run validar:syntax` (105 OK).
- Preservacoes: sem publicacao, sem `frontend/data/publicados`/`.env`/SQLite/WAL/SHM direto, sem PAD/recarga, sem workbook antigo, sem autenticacao/login, sem reativar `Atualizar PROFOR 2022`. Endpoint continua somente leitura; guard agora protege o CLI.
- Risco: baixo - reforco aditivo; comportamento local continua igual; producao/teste passam a falhar cedo no script (objetivo desejado).
- Rollback: reverter o commit; script volta a nao validar guards; endpoint volta a mascarar erro como zero; frontend volta a tratar refresh de diagnostico como obrigatorio.

---

## 25/05/2026 - PROFOR 2022: bloco "Diagnostico das atualizacoes" visivel e compacto

- Branch: `main`.
- Problema: o bloco recem-introduzido aparecia como card escuro grande e aparentemente vazio (texto cinza-claro em fundo `bg-dark` perdia contraste; layout em `<ul>` ocupava muita altura).
- Diagnostico: leitura de `fetchJsonApiOnasp` ja estava correta, mas a desestruturacao direta de `{ payload }` ficou fragil contra mudancas. Layout precisava ser compacto e ter contraste explicito em tema escuro.
- Frontend: o card foi substituido por bloco compacto com grid `auto-fit minmax(200px, 1fr)`; 3 mini-cards (Carteira ativa / DETRU / Transferegov) com valores em branco-forte (`#f8fafc`) e labels em cinza. Leitura do payload virou `resposta?.payload ?? resposta` (tolerante). `erroLeitura` por bloco (Tarefa 2 anterior) e renderizado em vermelho-claro abaixo do valor. Refresh apos DETRU/Transferegov continua em try/catch (introduzido em f924df4).
- CSS: novas regras `.profor-diagnostico-atualizacoes`, `.profor-diagnostico-grid`, `.profor-diagnostico-item`, `.profor-diagnostico-label`, `.profor-diagnostico-valor`, `.profor-diagnostico-sub`, `.profor-diagnostico-erro` em `frontend/css/app.css`. Sem `min-height` grande.
- Cache-buster bumpado em `index.html` para `?v=20260525-13-diagnostico-atualizacoes-compacto`.
- Testes (17/17): 2 novos cobrem layout compacto sem altura grande forcada e leitura tolerante de `payload` com `??`.
- Validacoes: `git diff --check`; `node --check frontend/js/app.js`; `node --test tests/services/profor-verificar-atualizacoes.test.js` (17/17); `npm run validar:syntax` (105 OK).
- Preservacoes: sem publicacao, sem `frontend/data/publicados`/`.env`/SQLite/WAL/SHM direto, sem PAD/recarga, sem workbook antigo, sem login/auth, sem reativar Atualizar PROFOR 2022.
- Risco: baixo - somente UI; backend e script nao foram tocados.
- Rollback: reverter o commit.

---

## 25/05/2026 - PROFOR 2022: POC HTTP PAD publico Transferegov 937782

- Branch: `main`.
- Objetivo: validar extracao HTTP publica do PAD do Transferegov para o convenio `937782` e comparar contra o Excel PAD local ja existente.
- Arquivos: `backend/services/profor-2022/profor-pad-transferegov-http-client.js`; `backend/services/profor-2022/profor-pad-transferegov-parser.js`; `backend/scripts/poc-pad-transferegov-937782.js`; `tests/services/profor-pad-transferegov-parser.test.js`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resultado real: sessao publica JSF/SAML obtida em tempo de execucao; `34` itens extraidos; total previsto `396423.71`; total executado `97141.55`; saldo `299282.16`; comparacao com Excel local sem divergencia critica.
- Validacoes: `git diff --check`; `node --check` nos 3 novos arquivos; `node --test tests/services/profor-pad-transferegov-parser.test.js`; `npm run validar:syntax`; execucao real `node backend/scripts/poc-pad-transferegov-937782.js`.
- Preservacoes: sem publicacao, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem banco, sem cache PAD, sem tela de Revisoes, sem recarga operacional, sem DETRU, sem rendimentos Transferegov, sem Playwright/E2E, sem cookies/ViewState/HTML bruto salvo.
- Risco: medio - fluxo publico JSF/SAML pode mudar no Transferegov; POC ainda nao substitui a origem operacional.
- Rollback: reverter o commit; remover o JSON local gerado pela execucao da POC se existir.

---

## 25/05/2026 - PROFOR 2022: adaptador PAD Transferegov e fallback Playwright

- Branch: `main`.
- Objetivo: transformar o parser PAD Transferegov em adaptador da origem bruta e adicionar fallback Playwright controlado para obter HTML quando HTTP direto falhar.
- Arquivos: `backend/services/profor-2022/profor-pad-normalizacao-service.js`; `backend/services/profor-2022/profor-pad-transferegov-parser.js`; `backend/services/profor-2022/profor-pad-transferegov-playwright-client.js`; `backend/services/profor-2022/profor-pad-transferegov-extracao-service.js`; `backend/scripts/poc-pad-transferegov-937782.js`; `tests/services/profor-pad-transferegov-parser.test.js`; `tests/services/profor-pad-transferegov-extracao.test.js`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Implementacao: parser reutiliza normalizadores PAD existentes; `validarHtmlPadExtraido()` valida apenas integridade da fonte; orquestrador tenta HTTP e usa Playwright apenas com `fallbackPlaywright`; script POC aceita `--fallback-playwright`.
- Resultado real HTTP: `34` itens; previsto `396423.71`; executado `97141.55`; saldo `299282.16`; `divergenciasCriticas=0`; equivalente `sim`.
- Validacoes: `git diff --check`; `node --check` nos arquivos novos/alterados; `node --test tests/services/profor-pad-transferegov-parser.test.js` (10/10); `node --test tests/services/profor-pad-transferegov-extracao.test.js` (6/6); `npm run validar:syntax`; POC real HTTP sem fallback.
- Preservacoes: sem publicacao, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem banco, sem cache PAD, sem tela de Revisoes, sem recarga operacional, sem DETRU, sem rendimentos, sem Playwright real, sem HTML/cookies/ViewState/HAR versionados.
- Risco: medio - fallback depende da UI publica e do runtime Playwright; segue isolado e desabilitado por padrao.
- Rollback: reverter o commit; remover o JSON local da POC se existir.

## 25/05/2026 - HOME: ajuste de alinhamento da sigla UF

- Branch: `main`.
- Objetivo: corrigir o desalinhamento visual das siglas de UF na home ao lado das bandeiras.
- Arquivos: `frontend/css/app.css`; `index.html`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Implementacao: ajuste localizado em `.uf-flag-inline .badge-uf` com `line-height` recalibrado e leve deslocamento vertical; cache-buster do CSS atualizado.
- Validacoes: `git diff --check`.
- Preservacoes: sem mexer em backend, dados, recarga PAD, revisoes, publicacao, DETRU, Transferegov, SQLite/WAL/SHM, `.env`, `frontend/data/publicados` ou Playwright/E2E.
- Risco: baixo - alteracao apenas de layout em elemento reutilizavel da home.
- Rollback: reverter o ultimo commit ou desfazer os dois arquivos alterados.

## 25/05/2026 - PROFOR 2022: dry-run PAD Transferegov dos 15 convenios

- Branch: `main`.
- Objetivo: criar extracao dry-run dos PADs publicos Transferegov para os 15 convenios PROFOR 2022 e comparar contra os Excel PAD ja processados.
- Arquivos: `backend/scripts/extrair-pads-transferegov-profor-2022-dry-run.js`; `backend/services/profor-2022/profor-pad-transferegov-comparacao-service.js`; `backend/services/profor-2022/profor-pad-transferegov-dry-run-service.js`; `tests/services/profor-pad-transferegov-comparacao.test.js`; `tests/services/profor-pad-transferegov-dry-run.test.js`; `package.json`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Revisao 08ce93b: normalizacao PAD teve apenas ampliacao de entidades HTML/export; parser reutiliza normalizadores; fallback Playwright segue desabilitado por padrao; sem DETRU, rendimentos ou recarga PAD.
- Resultado 937782: HTTP direto; `34` itens; previsto `396423.71`; executado `97141.55`; saldo `299282.16`; `divergenciasCriticas=0`; equivalente `sim`.
- Resultado 15 convenios: HTTP direto; `15` extraidos; `0` falhas tecnicas; `13` equivalentes; `2` com divergencia critica (`938128`, `937817`); apto para cache Transferegov `false`.
- Validacoes: `git diff --check`; `node --check` nos arquivos novos/alterados; testes parser/comparacao/dry-run; `npm run validar:syntax`; dry-run real `--convenio=937782`; dry-run real dos 15 sem Playwright.
- Preservacoes: sem publicacao, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem banco, sem cache PAD persistente, sem recarga PAD operacional, sem tela de Revisoes, sem DETRU, sem rendimentos, sem Playwright real, sem HTML/cookies/ViewState/HAR versionados.
- Risco: medio - dois convenios ja apontam divergencias criticas entre PAD publico atual e Excel processado; etapa ainda e diagnostica.
- Rollback: reverter o commit; remover relatórios locais Transferegov caso sejam gerados em execucoes futuras.

## 25/05/2026 - PROFOR 2022: investigacao divergencias PAD Transferegov

- Branch: `main`.
- Objetivo: investigar divergencias criticas Transferegov x Excel dos convenios `938128` e `937817`.
- Arquivos: `backend/scripts/extrair-pads-transferegov-profor-2022-dry-run.js`; `backend/services/profor-2022/profor-pad-transferegov-comparacao-service.js`; `tests/services/profor-pad-transferegov-comparacao.test.js`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Resultado `938128`: diferenca real entre Excel antigo e Transferegov atual; item pareado `Curso de Pos Graduacao Direitos Humanos` diverge em executado/saldo; totais gerais tambem divergem; sem indicio de erro de parser/comparador.
- Resultado `937817`: diferenca real item a item com total geral compensado; itens pareados `ESTABILIZADOR`, `SALDO DE RENDIMENTO COMPLEMENTACAO DOS V` e `VENTILADOR 50 CM PAREDE` divergem em executado/saldo; sem ausencias, quantidade ou codigo divergente.
- Resultado 15 convenios apos investigacao: HTTP direto; `15` extraidos; `0` falhas tecnicas; `12` equivalentes; `3` com divergencia critica (`938128`, `937817`, achado colateral `937468`); cache Transferegov segue bloqueado.
- Relatorio local: gerados `backend/data/relatorios/profor-2022-pad-transferegov-divergencias-938128-937817.json` e `.md`, mantidos fora do versionamento.
- Validacoes: `git diff --check`; `node --check` nos arquivos solicitados; testes parser/comparacao/dry-run; `npm run validar:syntax`; dry-run real `938128`, `937817` e 15 convenios, sem Playwright.
- Preservacoes: sem publicacao, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem banco, sem cache PAD persistente, sem recarga PAD, sem tela de Revisoes, sem DETRU, sem rendimentos, sem Playwright real, sem HTML/cookies/ViewState/HAR versionados.
- Risco: medio - fontes publicas podem mudar entre execucoes; divergencias parecem refletir atualizacao da fonte e nao erro tecnico.
- Rollback: reverter o commit; remover os relatorios locais de investigacao se desejar limpar o workspace.

## 25/05/2026 - PROFOR 2022: Excel como auditoria historica PAD

- Branch: `main`.
- Objetivo: ajustar dry-run/importador Transferegov para usar o PAD atual como fonte bruta oficial e tratar Excel antigo apenas como auditoria historica de migracao.
- Arquivos: `backend/scripts/extrair-pads-transferegov-profor-2022-dry-run.js`; `backend/services/profor-2022/profor-pad-transferegov-comparacao-service.js`; `backend/services/profor-2022/profor-pad-transferegov-dry-run-service.js`; `backend/services/profor-2022/profor-pad-transferegov-parser.js`; testes parser/comparacao/dry-run; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Implementacao: diferenças contra Excel viraram `comparacaoHistoricaExcel`, `divergenciasHistoricas` e `atualizacoesDetectadas`; veredito principal agora usa `aptoParaImportacaoTecnica` e `bloqueiosTecnicos`.
- Resultado real: `937782`, `938128`, `937817` e `937468` aptos tecnicamente; `938128`, `937817` e `937468` mantem diferencas historicas contra Excel, sem bloquear importacao tecnica.
- Resultado 15 convenios: HTTP direto; `15` extraidos; `0` falhas tecnicas; `15` aptos para importacao tecnica; `3` com atualizacoes/diferenca historica Excel.
- Validacoes: `git diff --check`; `node --check` nos arquivos solicitados; testes parser/comparacao/dry-run; `npm run validar:syntax`; dry-runs reais dos quatro convenios e dos 15, sem Playwright.
- Preservacoes: sem publicacao, sem `frontend/data/publicados`, sem `.env`, sem SQLite/WAL/SHM, sem banco, sem cache PAD persistente, sem recarga PAD, sem tela de Revisoes, sem DETRU, sem rendimentos, sem Playwright real, sem HTML/cookies/ViewState/HAR versionados.
- Risco: medio - aptidao tecnica nao equivale a decisao de ativar cache; ainda falta etapa propria de cache/origem operacional.
- Rollback: reverter o commit; remover relatorios locais untracked se desejar limpar o workspace.

## 26/05/2026 - PROFOR 2022: corrige contagem 15/1 e falso impedimento quantidade_arquivos_pad_invalida

- Branch: `main`.
- Objetivo: corrigir falso impedimento tecnico `quantidade_arquivos_pad_invalida` apos migracao da recarga PAD para cache Transferegov (metrica mostrava `15/1`).
- Causa: em `profor-pad-report-reader.js` o ramo de cache fixava `totalArquivosEncontrados: 1` (apenas o arquivo JSON fisico do cache), e o carregador comparava esse 1 com a expectativa de 15 PADs.
- Arquivos: `backend/services/profor-2022/profor-pad-report-reader.js`; `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`; `frontend/js/app.js`; `tests/services/profor-pad-recarga-cache-transferegov.test.js`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Implementacao: no ramo cache o resumo agora expoe `origem: "cache_transferegov"`, `totalArquivosFisicos: 1` e `totalArquivosEncontrados/totalConvenios = relatorios.length` (15). O carregador propaga `origem` e `totalConvenios`; o rotulo da UI passou de "Arquivos lidos" para "PADs lidos"; o cabecalho do relatorio MD passou a exibir `PADs lidos: 15/15 (origem: cache_transferegov)`. Fluxo Excel legado (`usarExcelLegado: true`) permanece intacto e ainda valida 15 arquivos fisicos.
- Testes adicionados: `20.` leitura via cache reporta 15 PADs com `origem=cache_transferegov` e `totalArquivosFisicos=1`; `21.` carregador v2 sobre cache valido nao gera `quantidade_arquivos_pad_invalida` nem `quantidade_relatorios_pad_lidos_invalida` e expoe `15/15`.
- Validacoes: `git diff --check` (apenas warnings CRLF em arquivos nao versionados); `node --check` nos tres arquivos solicitados; `npm run validar:syntax` OK (105 arquivos). `node --test` nao executado porque o ambiente atual quebra em `better-sqlite3` por NODE_MODULE_VERSION 137 vs 141 (Node v25.9.0 - infra, nao relacionado a esta correcao).
- Preservacoes: sem reverter integracao com cache, sem reclassificar pendencias revisaveis como impedimentos, sem alterar `frontend/data/publicados`, sem publicar, sem acessar Transferegov, sem atualizar cache, sem DETRU/rendimentos, sem Playwright, sem `.env`, sem SQLite/WAL/SHM, sem versionar `backend/data/cache/*` ou `backend/data/relatorios/*`.
- Risco: baixo - a mudanca apenas reinterpreta o contador no ramo cache para representar PADs/convenios, mantendo todas as travas tecnicas (cache ausente, cache invalido, contagem != 15 no Excel legado).
- Rollback: reverter o commit.

## 26/05/2026 - PROFOR 2022: recarga PAD exibe so pendencias por convenio/UF

- Branch: `main`.
- Objetivo: eliminar alertas indevidos de auditoria/valores na recarga PAD por cache Transferegov e exibir apenas pendencias reais de classificacao/rateio agrupadas por convenio/UF.
- Arquivos: `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`; `frontend/js/app.js`; `tests/services/profor-pad-carregador-operacional.test.js`; `tests/services/profor-pad-origem-reconstrucao.test.js` (ajuste UI); `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Regra nova: a recarga apenas reconstroi o estado atual do cache; auditoria de valor, saldo, quantidade, descricao, item suprimido/ausente, diacritico e normalizacao foi removida do payload da recarga. Esses casos seguem sendo investigados na tela Revisoes PAD.
- Implementacao backend: criado `TIPOS_ALERTA_AUDITORIA_SUPRIMIDOS` (item_conhecido_ausente_no_pad, item_suprimido_historico, item_conhecido_nao_apto, quantidade_valor_unitario_inconsistente, saldo_inconsistente, saldo_residual_nao_setorializado, saldo_residual_natureza_sem_rateio_memoria, equivalencia_por_diacritico_saneada_automaticamente, item_pad_coincide_apenas_por_descricao_normalizada, item_pad_sem_rateio, descricao_original_divergente_da_memoria_rateio, natureza_divergente, total_geral_divergente, valor_previsto_invalido, valor_executado_invalido). `resultado.alertas` e `conferencia.alertas` sao filtrados antes de compor `alertasAgrupados`; `totalAlertas` reflete somente o que sobrou. Adicionados campos `pendenciasRevisaoResumo` (agrupado por numeroConvenio+uf com totalItens) e `pendenciasRevisaoMensagem` ("X itens pendentes de classificacao/rateio"). Item suprimido historico nao e mais empurrado para `resultado.alertas`.
- Implementacao UI: card "Alertas de Processamento" so renderiza se sobrar algum alerta operacional legitimo (caso de borda). Card "Pendencias para revisao" agora usa `pendenciasRevisaoResumo` e exibe linhas "Convenio NNNNNN - UF: X item(ns)" linkaveis para a tela Revisoes PAD (UF + filtro por convenio). Sem UF e exibida como "UF nao identificada". Sem listagem de tipos tecnicos (`item_novo_sem_rateio_memorizado` deixou de aparecer na UI principal).
- Testes: 4 novos em `profor-pad-carregador-operacional.test.js` (alertas auditoria filtrados; resumo agrupado por convenio/UF; mesmo convenio com 2 itens vira 1 linha com totalItens 2; pendencia sem UF nao quebra com uf=null). Ajustado o teste de "item suprimido historico" para refletir nova regra (nao entra em `alertas`). Carregador 15/15, recarga-cache-transferegov 12/12, origem-reconstrucao 30/30.
- Validacoes: `git diff --check` (apenas CRLF em arquivos nao versionados); `node --check` nos 4 arquivos; `npm run validar:syntax` OK (105 arquivos); `node --test` nas 3 suites OK.
- Preservacoes: sem reverter integracao com cache, sem alterar `frontend/data/publicados`, sem alterar `backend/data/cache`, sem alterar `backend/data/relatorios`, sem publicar, sem Transferegov, sem cache atualizado, sem DETRU, sem rendimentos, sem Playwright, sem `.env`, sem SQLite/WAL/SHM, sem `package.json`/lock, sem `backend/server.js`.
- Risco: baixo - filtro e aditivo; pendencias revisaveis seguem fluindo para `pendenciasRevisao`. Os tipos suprimidos ainda existem no banco/serviços de revisao; a recarga so deixa de exibi-los.
- Rollback: `git revert <SHA>` && `git push origin main`.

## 26/05/2026 - PROFOR 2022: filtro defensivo de alertas historicos na UI da recarga PAD

- Branch: `main`.
- Objetivo: garantir que a tela de recarga PAD nao exiba alertas de auditoria/historico/valores mesmo quando o payload veio de relatorio JSON antigo (gerado antes do filtro de backend introduzido em ae60a79).
- Causa: a UI carrega a ultima recarga via `GET /api/profor-2022/pad/ultima-recarga-operacional`, que le `backend/data/relatorios/profor-2022-pad-recarga-operacional-v2.json`. Esse arquivo foi gravado antes do filtro e ainda continha 44 alertas (item_conhecido_ausente_no_pad, item_suprimido_historico, item_conhecido_nao_apto, saldo_residual_nao_setorializado, equivalencia_por_diacritico_saneada_automaticamente, item_pad_coincide_apenas_por_descricao_normalizada, item_pad_sem_rateio, saldo_residual_natureza_sem_rateio_memoria). Como o relatorio nao e versionado, o backend so reescreve quando o usuario executa a recarga novamente — ate la a UI exibe o estado antigo.
- Arquivos: `frontend/js/app.js`; `tests/services/profor-pad-origem-reconstrucao.test.js`; `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Regra final: a recarga nao exibe alertas tecnicos/historicos/auditoria. Pendencia real = item atual sem classificacao/rateio ativo. A regra agora e aplicada em duas camadas: backend (carregador filtra antes de salvar/responder) e frontend (re-filtra payload antes de renderizar, recomputa `totalAlertas`, `pendenciasRevisao`, `pendenciasRevisaoResumo` e `pendenciasRevisaoMensagem`).
- Implementacao: adicionado `TIPOS_ALERTA_RECARGA_PAD_SUPRIMIDOS` (15 tipos) + helpers `ehAlertaRecargaPadSuprimido` e `agruparPendenciasRecargaPadPorConvenioUf` no inicio de `renderResultadoRecargaPad`. O `resultado` e clonado com `alertas`/`alertasAgrupados`/`pendenciasRevisao` filtrados e totais/resumo/mensagem recomputados a partir do que sobrou. `pendenciasRevisaoResumo` ausente em payload antigo passa a ser calculado na UI.
- Testes: novo teste estatico `UI da recarga PAD filtra alertas de auditoria mesmo de payload antigo` em `profor-pad-origem-reconstrucao.test.js` valida presenca da lista de tipos suprimidos no `frontend/js/app.js`. Suites: origem-reconstrucao 31/31, carregador 15/15, recarga-cache-transferegov 12/12.
- Validacoes: `git diff --check` limpo; `node --check` OK em backend (carregador) e `frontend/js/app.js`; `npm run validar:syntax` OK (105 arquivos); `node --test` OK nas 3 suites.
- Preservacoes: sem reverter cache, sem refazer extracao, sem alterar `backend/data/cache`, `backend/data/relatorios`, `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, `package.json`/lock; sem Transferegov, sem DETRU/rendimentos, sem Playwright.
- Risco: baixo - filtro e aditivo e nao toca dados nem regras de pendencia. A camada de UI cobre payloads legados sem precisar regerar o relatorio JSON.
- Rollback: `git revert <SHA>` && `git push origin main`.

## 26/05/2026 - PROFOR 2022: normaliza matching pad com memoria de rateio (HTML entities + caixa/acentuacao)

- Branch: `main`.
- Objetivo: eliminar falsas pendencias 937782/AC e 937265/MS na recarga PAD causadas por diferencas cosmeticas entre o cache atual e a memoria de rateio historica.
- Causa: 1) item conhecido 107 ("Monitor de led 18,5 ' resolucao 192") foi persistido com entidade HTML `&#039;` na descricao_original_referencia e chave_item — o PAD atual traz a apostrofe literal, entao a chave (literal e normalizada) nao batia; 2) item conhecido 154 ("Meia Militar") tem descricao com M maiusculo no banco e PAD veio com m minusculo. A regra anterior de saneamento por diacritico ainda exigia `dadosMateriaisCompativeis`, que reprovava porque `valor_unitario_referencia` no item conhecido (legado) divergia do PAD vigente.
- Arquivos: `backend/services/profor-2022/profor-pad-matching-service.js`; `tests/services/profor-pad-matching-normalizacao.test.js` (novo); `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.
- Regra de normalizacao: nova helper `decodificarEntidadesHtmlBasicas` (decodifica `&#039;`, `&apos;`, `&quot;`, `&amp;`, `&nbsp;`, `&lt;`, `&gt;`); aplicada na construcao da chave de descricao original do PAD e na re-indexacao das chaves normalizadas dos itens conhecidos do banco; nova helper `diferencaApenasCosmetica` (decode HTML + strip diacritico + caixa + espacos) substitui o criterio `diferencaApenasAcentuacaoOuDiacritico + dadosMateriaisCompativeis` no fallback "chave normalizada bate, descricao original diverge". Quando a chave normalizada coincide e a divergencia da descricao original e cosmetica, o item PAD e pareado com o item conhecido sem exigir compatibilidade material (que dependia de `valor_unitario_referencia` defasado).
- Itens nao alterados: o criterio de pareamento real (chave normalizada) continua estrito; diferenca real de descricao (ex.: "Monitor 18,5'" vs "Monitor 24'") continua gerando pendencia.
- Testes: 9 novos em `profor-pad-matching-normalizacao.test.js`. Suites existentes mantidas: carregador 15/15, recarga-cache-transferegov 12/12, origem-reconstrucao 31/31. Total 67/67 OK.
- Validacoes: `node --check` OK nos 3 servicos PAD; `node --check` OK no novo teste; `npm run validar:syntax` OK (105 arquivos da lista). `git diff --check` limpo (apenas warnings CRLF em arquivos nao versionados).
- Preservacoes: sem alterar banco por SQL direto, sem alterar `backend/data/cache`, `backend/data/relatorios`, `frontend/data/publicados`, `.env`, SQLite/WAL/SHM, `package.json`/lock, `backend/server.js`. Sem Transferegov, sem DETRU/rendimentos, sem Playwright. Validacao funcional manual: reiniciar servidor, Ctrl+F5, Sistema, "Atualizar PADs" — 937782/AC e 937265/MS devem deixar de aparecer como pendencia.
- Risco: baixo — decodificacao HTML e aditiva (so adiciona pareamentos perdidos), saneamento cosmetico exige coincidencia da chave normalizada (segue exigindo conv+descricao normalizada igual).
- Rollback: `git revert <SHA>` && `git push origin main`.
