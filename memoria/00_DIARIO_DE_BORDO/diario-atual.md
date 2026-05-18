# Diário de bordo

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
