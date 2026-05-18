# PROFOR 2022 — Documentação técnica da funcionalidade

## Identificação da funcionalidade

| Campo | Valor |
| --- | --- |
| Nome da funcionalidade | PROFOR 2022 |
| Arquivo deste documento | `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` |
| Status do documento | rascunho técnico |
| Última revisão | 18/05/2026 |
| Responsável pela revisão | ONASP / FOMENTO-ONASP |
| Funcionalidade crítica? | sim |
| Requer atualização quando alterar código? | sim |

## 1. Spec — Especificação funcional

### 1.1. Problema do usuário

A funcionalidade PROFOR 2022 depende atualmente da aba `Geral` da planilha de gestão financeira para montar os dados gerais dos convênios. Essa aba concentra dados cadastrais, dados financeiros, fórmulas e campos manuais, o que dificulta atualização recorrente, rastreabilidade, auditoria e futura inclusão de novos convênios para acompanhamento.

A necessidade técnica é substituir a aba `Geral` por uma origem mais confiável e operacional: uma carteira de convênios monitorados mantida no banco SQLite local, enriquecida por dados oficiais do DETRU, dados públicos do Transferegov e cálculos internos da aplicação.

### 1.2. Objetivo da funcionalidade

A funcionalidade deve permitir o acompanhamento dos convênios PROFOR 2022, exibindo dados gerais, dados financeiros, plano de aplicação, execução por área, saldos e informações de gestão de forma rastreável.

O objetivo da migração é fazer com que a página deixe de depender da aba `Geral` da planilha como fonte primária. A carteira de convênios acompanhados deve ficar no banco local, e os dados variáveis devem ser atualizados por rotinas automáticas ou semiautomáticas.

### 1.3. Perfil de usuário e uso esperado

O usuário esperado é servidor da ONASP/SENAPPEN responsável por acompanhar convênios, execução financeira, aparelhamento, recortes por área e situação de instrumentos vinculados ao PROFOR.

O uso esperado inclui consultar a carteira de convênios, atualizar dados gerais a partir do DETRU, capturar saldo atual de rendimentos no Transferegov público, visualizar execução por área e futuramente cadastrar novos convênios para acompanhamento.

### 1.4. Escopo incluído

Inclui a documentação técnica da funcionalidade PROFOR 2022, a decisão de manter a carteira de convênios em banco local, o mapeamento da substituição da aba `Geral`, as fontes previstas, o fluxo futuro de dados, os riscos e a trilha de migração.

Também inclui a premissa de preservar os nomes dos campos consumidos pelo front-end durante a fase de transição, reduzindo risco de regressão visual.

### 1.5. Fora do escopo

Não inclui, nesta etapa documental, criação de tabela, alteração de código, alteração de banco, alteração de JSON publicado, alteração de layout, criação de rotas, criação de modal ou automação efetiva do Transferegov.

Também não inclui eliminar as abas estaduais da planilha. A substituição inicial tem como alvo a aba `Geral`. A automação do PAD detalhado e a redução da dependência das abas estaduais ficam para etapa futura.

### 1.6. Regras de negócio

1. A carteira de convênios monitorados pertence à aplicação, não ao DETRU.
2. O número do convênio é a chave operacional principal para consultas automáticas.
3. O usuário poderá futuramente inserir novos convênios para acompanhamento.
4. O DETRU será usado como fonte de atualização de dados cadastrais e financeiros dos convênios já monitorados.
5. O Transferegov público será usado para dados não identificados diretamente no DETRU, especialmente saldo atual de rendimentos.
6. Campos calculáveis não devem permanecer como valores manuais na aba `Geral`.
7. A migração deve preservar o modo local/API e o modo estático/GitHub Pages.
8. A nova origem deve ser ativada por etapas, com fallback para a origem atual até validação completa.

### 1.7. Critérios de aceite funcionais

1. A documentação deve deixar claro que a aba `Geral` é fonte transitória.
2. A documentação deve registrar que os convênios monitorados serão mantidos em banco local.
3. A documentação deve listar as fontes substitutas de cada grupo de campo.
4. A documentação deve diferenciar dados importados, dados capturados, dados calculados e campos eliminados.
5. A documentação deve indicar riscos, validações e rollback.
6. Nenhuma alteração funcional deve ser feita nesta etapa.

## 2. Plan — Planejamento técnico

### 2.1. Arquivos front-end relacionados

| Arquivo | Papel |
| --- | --- |
| `frontend/js/app.js` | Renderização da interface e consumo dos dados da página. |
| `frontend/css/app.css` | Estilos da página e de futuros controles de carteira. |
| `index.html` | Estrutura base da SPA. |

Observação: nesta etapa documental, esses arquivos não devem ser alterados.

### 2.2. Arquivos back-end relacionados

| Arquivo | Papel |
| --- | --- |
| `backend/services/data-service.js` | Fonte atual de montagem dos dados PROFOR 2022. |
| `backend/services/dashboard-publication-service.js` | Publicação/geração de dados estáticos relacionados. |
| `backend/services/static-publication-service.js` | Serviço geral de publicação estática. |
| `backend/server.js` | Futuras rotas locais da carteira e atualização. |
| `backend/db/init-db.js` | Futuras migrations aditivas para a carteira de convênios. |
| `backend/db/database.js` | Acesso ao banco SQLite local. |

### 2.3. Arquivos de memória relacionados

| Arquivo | Papel |
| --- | --- |
| `AGENTS.md` | Protocolo obrigatório para agentes. |
| `memoria/INDEX.md` | Roteador da memória operacional. |
| `memoria/00_CONTEXTO_AGENTES/entrada-agente.md` | Entrada rápida e roteiros por tipo de tarefa. |
| `memoria/01_PROJETO_APLICACAO/decisoes-tecnicas.md` | Decisões técnicas vigentes. |
| `memoria/00_DIARIO_DE_BORDO/diario-atual.md` | Registro incremental das alterações. |
| `memoria/01_PROJETO_APLICACAO/pendencias.md` | Pendências reais evidenciadas. |
| `memoria/08_ROTAS_BANCO_API/schema-banco.md` | Referência documental do banco local. |

### 2.4. Rotas/API atuais e futuras

As rotas específicas da carteira PROFOR 2022 ainda não foram implementadas. Devem ser criadas em etapa posterior, em escopo próprio.

Rotas futuras sugeridas:

| Método | Rota | Situação |
| --- | --- | --- |
| GET | `/api/profor-2022/convenios-monitorados` | futura |
| POST | `/api/profor-2022/convenios-monitorados` | futura |
| POST | `/api/profor-2022/convenios-monitorados/:id/salvar` | futura |
| POST | `/api/profor-2022/convenios-monitorados/:id/inativar` | futura |
| POST | `/api/profor-2022/atualizar-detru` | futura |
| POST | `/api/profor-2022/atualizar-saldos-rendimentos` | futura |

### 2.5. Banco de dados relacionado

O banco SQLite local já é usado pelo projeto no modo local/API. A carteira de convênios monitorados deverá ser adicionada por migration aditiva futura.

Tabela futura sugerida:

```sql
CREATE TABLE IF NOT EXISTS profor_convenios_monitorados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_convenio TEXT NOT NULL,
  ano TEXT,
  uf TEXT,
  instrumento TEXT DEFAULT 'Convênio',
  programa_origem TEXT DEFAULT 'PROFOR 2022',
  ativo INTEGER DEFAULT 1,
  id_convenio_transferegov TEXT,
  observacao TEXT,
  criado_em TEXT,
  atualizado_em TEXT,
  UNIQUE (numero_convenio, ano)
);
```

Tabela futura sugerida para cache online:

```sql
CREATE TABLE IF NOT EXISTS profor_convenios_cache_online (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  convenio_monitorado_id INTEGER,
  numero_convenio TEXT NOT NULL,
  ano TEXT,
  fonte TEXT NOT NULL,
  payload_json TEXT,
  consultado_em TEXT,
  sucesso INTEGER DEFAULT 1,
  erro TEXT
);
```

Essas tabelas ainda não existem no momento deste documento. Elas devem ser criadas em etapas específicas, com validação de banco e rollback.

### 2.6. JSONs publicados e modo estático

A funcionalidade deve preservar o modo estático/GitHub Pages como somente leitura. A publicação estática deve continuar gerando JSONs consumíveis pelo front-end, mas a origem futura desses JSONs deverá passar pela composição consolidada.

Durante a migração, a publicação estática deve manter fallback para a fonte atual. Não se deve rodar `npm run publicar:dados` por hábito em etapas documentais ou de infraestrutura.

### 2.7. Dependências e imports relevantes

Não há dependência nova nesta etapa documental.

Futuras etapas podem exigir leitura de ZIP/CSV do DETRU. Qualquer nova dependência deve ser justificada quanto a necessidade, alternativa nativa, impacto e risco de manutenção.

## 3. Research — Decisões, fundamentos e restrições

### 3.1. Decisões técnicas já identificadas

| Decisão | Status | Fonte |
| --- | --- | --- |
| Carteira de convênios em banco local | vigente | `decisoes-tecnicas.md` |
| Aba `Geral` como fonte transitória | vigente | decisão de migração |
| DETRU como fonte de dados atualizados | vigente | decisão de migração |
| Transferegov público para saldo de rendimento | vigente | diagnóstico técnico |
| Ativação por etapas com fallback | vigente | estratégia conservadora |
| Modo estático somente leitura | vigente | arquitetura do projeto |

### 3.2. Fundamentos técnicos da decisão

O número do convênio não é um dado derivado do DETRU para fins de carteira. Ele é a chave de acompanhamento escolhida pelo usuário. O DETRU pode confirmar e atualizar dados do convênio, mas não deve definir sozinho quais instrumentos a ONASP acompanha.

Por isso, o banco local deve guardar a carteira de convênios monitorados. A partir dessa carteira, a aplicação faz consultas automáticas ao DETRU e ao Transferegov.

### 3.3. Restrições técnicas

1. Não usar login, senha, certificado ou área restrita do Transferegov.
2. Não usar cookies fixos, `JSESSIONID` capturado ou qualquer token colado em código.
3. Não burlar captcha, autenticação, limitação técnica ou mecanismo de segurança.
4. Não apagar registros da carteira; usar inativação lógica.
5. Não preencher valores estimados quando uma consulta falhar.
6. Não alterar JSONs publicados sem necessidade material.
7. Não remover fallback da planilha antes de validação comparativa.

### 3.4. Limites de conhecimento

1. A origem padrão ainda é `planilha`; `banco-cache` permanece desativado por padrão.
2. A captura de saldo de rendimento já existe no modo local/API, mas depende do fluxo público do Transferegov e pode falhar se o site alterar SAML, sessão ou tela.
3. O fallback local com Playwright/Chromium para sessão pública precisa ser validado como mecanismo operacional antes de agendamento recorrente.
4. A automação do PAD detalhado ainda não foi implementada.
5. A eliminação completa da planilha depende de futura automação do plano de aplicação detalhado e validação de governança das divergências.

## 4. Fluxo de dados

### 4.1. Fluxo atual

```text
Planilha de gestão financeira
└── Aba Geral
    └── backend/services/data-service.js
        └── objeto PROFOR 2022
            └── front-end / publicação estática
```

A aplicação também extrai o plano de aplicação das abas por UF, mas a aba `Geral` ainda concentra dados gerais, campos calculados e campos manuais.

### 4.2. Fluxo futuro desejado

```text
Banco local: profor_convenios_monitorados
↓
Números dos convênios acompanhados
↓
Consulta DETRU: siconv_convenio.csv.zip
↓
Consulta Transferegov público: saldo de rendimentos
↓
Plano de aplicação detalhado
↓
Cálculos internos por área/natureza
↓
Objeto PROFOR 2022 consolidado
↓
API local / publicação estática / front-end
```

### 4.3. Entrada pela interface

Entrada futura prevista: cadastro de novo convênio monitorado pelo usuário no modo local/API.

Campos mínimos previstos:

- número do convênio;
- ano;
- UF;
- instrumento;
- observação.

No modo estático, essa edição deve ficar bloqueada ou indisponível.

### 4.4. Persistência no banco

A persistência futura deverá ocorrer em tabela própria de convênios monitorados. O número do convênio e o ano devem compor restrição de unicidade para evitar duplicidade.

A exclusão física não é recomendada. Convênios removidos do acompanhamento devem ser marcados como inativos.

### 4.5. Publicação estática

A publicação estática deverá consumir dados consolidados já calculados. O GitHub Pages não deve depender do banco local em tempo real.

O fluxo esperado é:

```text
Banco local + DETRU + Transferegov + cálculos
↓
JSON publicado
↓
GitHub Pages somente leitura
```

## 5. Mapeamento da substituição da aba `Geral`

### 5.1. Campos substituídos por DETRU

| Campo atual | Substituição |
| --- | --- |
| `numero` | `NR_CONVENIO` |
| `ano` | `ANO` |
| `processoSei` | `NR_PROCESSO` |
| `vencimento` | `DIA_FIM_VIGENC_CONV` |
| `quantidadeTa` | `QTD_TA` |
| `valorGlobal` | `VL_GLOBAL_CONV` |
| `valorRepasse` | `VL_REPASSE_CONV` |
| `valorContrapartida` | `VL_CONTRAPARTIDA_CONV` |
| `repasseDesembolsado` | `VL_DESEMBOLSADO_CONV` |
| `rendimentoAprovado` | `VL_RENDIMENTO_APLICACAO` |
| `contrapartidaIntegralizada` | `VL_INGRESSO_CONTRAPARTIDA` |

### 5.2. Campos substituídos por banco local

| Campo atual | Substituição |
| --- | --- |
| `uf` | `profor_convenios_monitorados.uf` |
| `instrumento` | `profor_convenios_monitorados.instrumento` |
| carteira de acompanhamento | `profor_convenios_monitorados` |

A fonte de verdade da carteira será o banco local. O DETRU poderá conferir ou enriquecer dados, mas não substituir a decisão de acompanhamento.

### 5.3. Campo substituído por Transferegov público

| Campo atual | Substituição |
| --- | --- |
| `saldoRendimentosAtual` | tela pública de Rendimento de Aplicação |

Bloco 14 criou a base técnica para que `saldoRendimentosAtual` tenha origem planejada no Transferegov público, por consulta local/API e cache SQLite. Em 18/05/2026 o cliente foi evoluído para posicionar a sessão pública por consulta de número do convênio, extrair `idConvenio`, selecionar o instrumento e ler a tela de rendimentos. Não há login, senha, captcha, certificado, área restrita ou bypass. A página PROFOR 2022 ainda não usa esse cache como origem padrão.

A captura futura deve armazenar também:

- valor formatado;
- data de referência;
- data da última movimentação;
- data/hora da captura;
- fonte;
- erro da última tentativa, se houver.

### 5.4. Campos calculados pela aplicação

| Campo atual | Regra futura |
| --- | --- |
| `valorExecutadoGeral` | soma de `valorExecutado` dos itens do plano |
| `previstoOuvidoria` | soma de `valorPrevisto` da área OUVIDORIA |
| `previstoCorregedoria` | soma de `valorPrevisto` da área CORREGEDORIA |
| `previstoEscolaPenal` | soma de `valorPrevisto` da área ESCOLA PENAL |
| `execucaoOuvidoriaPercentual` | executado / previsto da área |
| `execucaoCorregedoriaPercentual` | executado / previsto da área |
| `execucaoEscolaPenalPercentual` | executado / previsto da área |
| `saldoDisponivelOuvidoria` | pendente até fórmula segura ou compositor |
| `saldoResidualCapital` | saldo calculado para natureza CAPITAL |
| `saldoResidualCusteio` | saldo calculado para natureza CUSTEIO |

Bloco 15 criou os cálculos internos em serviços puros, sem substituir a origem atual da página. As premissas conservadoras são: previstos por área somam `valorPrevisto`; executados por área somam `valorExecutado`; `valorExecutadoGeral` soma `valorExecutado` do plano filtrado; saldos residuais por natureza somam `saldo` e, quando `saldo` não existe, usam `valorPrevisto - valorExecutado`; percentuais usam `valorExecutado / valorPrevisto * 100` quando o previsto é maior que zero. A regra de filtro seguro exige número do convênio quando houver mais de um número na mesma UF e considera UF, número e ano quando informados.

`saldoDisponivelOuvidoria` permanece pendente e não é inventado nos serviços do Bloco 15; deve ser tratado apenas quando houver fórmula segura ou no compositor consolidado.

### 5.5. Campos eliminados ou opcionais

| Campo atual | Decisão |
| --- | --- |
| `solicitouProrrogacao` | eliminar como campo manual |
| `valorRelativoOuvidoria` | calcular sob demanda, se necessário |

## 6. Estados da interface e experiência do usuário

### 6.1. Estados esperados

| Estado | Descrição |
| --- | --- |
| carregado | dados PROFOR 2022 exibidos normalmente |
| vazio | nenhum convênio monitorado cadastrado |
| erro DETRU | dados DETRU indisponíveis ou arquivo ausente |
| erro Transferegov | saldo de rendimento não capturado |
| modo estático | leitura sem edição da carteira |
| modo local/API | leitura e futura edição da carteira |

### 6.2. Mensagens futuras recomendadas

Mensagens específicas ainda não foram implementadas. Recomenda-se que erros de atualização online sejam claros e não apaguem o último dado válido.

Exemplo de mensagem futura:

```text
Não foi possível atualizar o saldo de rendimentos deste convênio agora. Mantido o último valor capturado com sucesso.
```

### 6.3. Acessibilidade e responsividade

Qualquer modal futuro de cadastro de convênio deve ter rótulos claros, foco controlado, botão de cancelamento, mensagens de erro visíveis e funcionamento em tela pequena.

## 7. Validação e tratamento de erros

### 7.1. Validações obrigatórias futuras

1. Número do convênio deve ser obrigatório.
2. Número do convênio deve ser tratado como string numérica.
3. Ano deve ser validado quando informado.
4. A combinação número + ano não deve ser duplicada.
5. Convênio inativado não deve ser atualizado automaticamente, salvo decisão futura.
6. Consulta DETRU sem correspondência deve gerar inconsistência, não dado estimado.
7. Consulta Transferegov deve validar se a página retornada pertence ao convênio esperado.
8. Falha de captura não deve zerar valores em cache.

### 7.2. Erros esperados

| Erro | Tratamento esperado |
| --- | --- |
| convênio duplicado | bloquear gravação |
| convênio não encontrado no DETRU | registrar inconsistência |
| Transferegov indisponível | preservar último sucesso |
| saldo não encontrado na página | erro controlado |
| divergência entre planilha e nova origem | registrar em relatório |
| modo estático | bloquear edição |

### 7.3. Logs e diagnóstico

Rotinas futuras devem registrar erros de forma suficiente para diagnóstico, sem gravar cookies, tokens, `JSESSIONID`, credenciais ou HTML bruto sensível na memória ou no repositório.

## 8. Test plan — Plano de testes

### 8.1. Testes obrigatórios por etapa

- `git status --short` antes e depois.
- `git diff --check` antes de commit.
- `npm run validar:json` quando afetar JSONs ou publicação.
- `npm run validar:syntax` quando alterar JavaScript.
- `npm run validar:agente` quando alteração afetar fluxo de tela.
- `npm start` quando houver nova rota ou serviço backend.
- Teste manual da página PROFOR 2022 quando a origem de dados for alterada.

### 8.2. Testes específicos da migração

1. Comparar dados da aba `Geral` com dados consolidados.
2. Verificar convênio existente na carteira.
3. Verificar cadastro de novo convênio no modo local/API.
4. Verificar bloqueio de edição no modo estático.
5. Verificar consulta DETRU por número do convênio.
6. Verificar captura de saldo de rendimento por número do convênio.
7. Verificar preservação de último valor válido em falha de consulta.
8. Verificar cálculos por área contra a planilha atual.
9. Verificar publicação estática após migração.

## 9. Riscos e rollback

### 9.1. Riscos principais

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Quebra do formato consumido pelo front-end | alto | preservar nomes dos campos |
| Divergência entre planilha e cálculo interno | alto | criar comparador antes de ativar |
| Transferegov mudar fluxo público | médio | cache e erro controlado |
| DETRU alterar layout/colunas | médio | validação de cabeçalho |
| Publicação estática quebrar | alto | fallback para origem planilha |
| Duplicidade de convênio monitorado | médio | UNIQUE número + ano |

### 9.2. Rollback

Durante a transição, o rollback principal será manter a origem antiga por flag:

```text
PROFOR_2022_ORIGEM_DADOS=planilha
```

Bloco 16 criou `backend/services/profor-2022/profor-origem-service.js` com as origens permitidas `planilha` e `banco-cache`. O padrão obrigatório permanece `planilha`; a flag `PROFOR_2022_ORIGEM_DADOS=banco-cache` existe apenas para ativação futura controlada e não é consumida pela página PROFOR 2022 nesta etapa.

Bloco 17 integrou a seleção de origem de forma conservadora no fluxo de dados e publicação. A origem padrão continua `planilha`; o fluxo antigo da aba `Geral` foi preservado e recebeu apenas metadados seguros (`origemDados`, `origemDadosEfetiva`, `fallbackUsado`, `avisos`, `diagnostico`). A origem `banco-cache` passou a ser suportada no fluxo Node de consolidação/publicação por `dashboard-publication-service.js`, usando o compositor consolidado e o plano de aplicação extraído das abas estaduais, sem fazer o compositor ler a planilha diretamente. Em falha do `banco-cache`, o serviço retorna a origem `planilha` com aviso de fallback.

Por restrição técnica, `backend/services/data-service.js` também é importado diretamente pelo navegador como módulo da aplicação. Portanto, ele não importa serviços Node/SQLite do compositor; no navegador e com a origem padrão, a página PROFOR 2022 segue usando a origem `planilha`. A ativação visual/local por `banco-cache` deve ocorrer apenas por rota/API local, sem levar dependências Node para o browser.

A publicação estática foi preparada em código para remover a seção interna `detru` do catálogo público antes de gerar `frontend/data/publicados/aplicacao.json`. O comando `npm run publicar:dados` não foi executado neste bloco e nenhum JSON publicado foi alterado.

Bloco 18 criou duas rotas locais/API somente leitura para validar a nova origem sem ativá-la como padrão:

- `GET /api/profor-2022/consolidado`: monta o consolidado `banco-cache` no backend Node, usando o compositor e o plano de aplicação extraído da planilha local, sem importar dependências Node/SQLite no navegador.
- `GET /api/profor-2022/comparar-origens`: monta a origem antiga `planilha`, monta a origem nova `banco-cache` e compara as bases pelo comparador PROFOR 2022.

A validação inicial do Bloco 18 retornou 15 convênios na origem `planilha` e 15 convênios na origem `banco-cache`, sem ausentes, mas ainda com caches incompletos. Após a validação operacional posterior do DETRU e a correção do fluxo Transferegov em 18/05/2026, o consolidado local passou a indicar `totalComDetru = 15`, `totalComPlano = 15` e `totalComRendimentos = 15`. A comparação continua com `totalIguais = 0` e `totalComDivergencia = 15`, agora por diferenças entre fontes oficiais/cálculos/cache atual e valores manuais antigos da aba `Geral`. Esse resultado mantém a ativação de `banco-cache` bloqueada por governança, não por ausência técnica de cache.

Correção pequena aplicada no Bloco 18: `quantidadeTa` passou a ser comparado como número simples no comparador, e não como moeda. Nenhuma fórmula pendente foi inventada; `saldoDisponivelOuvidoria` continua sem cálculo seguro.

Integração visual local/API do consolidado em 18/05/2026:

- A origem padrão continua `planilha`.
- Foi criada a rota local/API `GET /api/profor-2022/origem` para o navegador consultar a origem resolvida pelo backend sem acessar `.env` diretamente e sem expor configuração interna.
- Quando a origem local/API é `banco-cache`, o frontend chama `GET /api/profor-2022/consolidado` e substitui o cache PROFOR 2022 em memória pelo objeto consolidado.
- Se a chamada ao consolidado falhar, a tela mantém a origem `planilha` já carregada e registra aviso controlado de fallback.
- Em modo estático/GitHub Pages, a aplicação não tenta acionar a API local e mantém o comportamento atual com dados publicados.
- A página PROFOR 2022 passou a exibir origem efetiva, data de geração quando disponível, diagnóstico básico (`DETRU`, `Plano`, `Rendimentos`) e aviso de fallback quando aplicável.
- O campo `saldoRendimentosAtual`, quando vindo de `banco-cache`, é identificado como saldo capturado no Transferegov Acesso Livre, com referência local baseada na data de geração do consolidado quando não houver data específica por convênio.
- A home principal foi integrada no modo local/API com `banco-cache`: os itens de convênio usados nos indicadores nacionais são substituídos por itens derivados do consolidado PROFOR 2022, preservando FAF e Doações.
- A publicação estática ainda não usa `banco-cache` como origem publicada; essa ativação depende de decisão posterior e execução controlada de publicação.

As tabelas novas devem ser aditivas e não devem interferir no fluxo atual até a origem nova ser ativada.

Após commits específicos, usar:

```bash
git revert <hash_do_commit>
git push origin HEAD
```

## 10. Tasks — Trilha de implementação

### 10.1. Concluído

- Decisão arquitetural definida em conversa técnica.
- Decisão registrada em `decisoes-tecnicas.md` como DT-011.
- Diário atualizado na etapa documental inicial.
- Tabela `profor_convenios_monitorados` criada em `backend/db/init-db.js` por `garantirTabelaConveniosMonitoradosProfor2022()`. Migration aditiva, sem dados populados. `npm run init-db` executou sem erro. Schema documentado em `memoria/08_ROTAS_BANCO_API/schema-banco.md`.
- Serviço `backend/services/profor-2022/convenios-monitorados-service.js` criado com as funções: `listarConveniosMonitorados`, `obterConvenioMonitoradoPorId`, `obterConvenioMonitoradoPorNumero`, `criarConvenioMonitorado`, `atualizarConvenioMonitorado` e `inativarConvenioMonitorado`. Retorno em camelCase. Inativação lógica (`ativo = 0`). Validações de `numero_convenio`, `ano` e `uf`. Sem rota criada nesta etapa.
- Rotas criadas em `backend/server.js` (Etapa 5): `GET /api/profor-2022/convenios-monitorados`, `POST /api/profor-2022/convenios-monitorados`, `POST /api/profor-2022/convenios-monitorados/:id/salvar`, `POST /api/profor-2022/convenios-monitorados/:id/inativar`. API recebe e retorna camelCase. Helpers `camelParaSnakeConvenio` e `extrairIdConvenioMonitorado` adicionados ao servidor. Testado ao vivo com servidor real: GET, POST criar, POST salvar, POST inativar, erros de validação e duplicidade — todos corretos. Registro de teste criado (id=1) e inativado (`ativo=0`) durante a validação.
- Script de importação criado em `backend/scripts/importar-convenios-monitorados-profor-2022.js` (Etapa 6). Fonte: aba `Geral` da planilha `Planilhas/gestao_financeira_ouvidoria.xlsx`. Importa apenas: `numero_convenio`, `ano`, `uf`, `instrumento`, `programa_origem = "PROFOR 2022"`. Não importa valores financeiros. Script idempotente: detecta registros existentes (ativos ou inativos) sem reativar nem duplicar. Registro de teste 999999 explicitamente ignorado. Relatório no console com 5 contadores. Script disponível como `npm run import:profor-convenios`. Resultado da execução inicial: 15 convênios inseridos (carteira completa da aba Geral), 0 erros. Caminho da planilha agora lido dinamicamente de `backend/data/aplicacao.json` com fallback seguro (Etapa 7, correção).
- Interface da Carteira Monitorada criada na página PROFOR 2022 (Etapa 7). Seção "Carteira Monitorada" adicionada ao final da view, abaixo da tabela financeira existente. Lista convênios da tabela `profor_convenios_monitorados` via `GET /api/profor-2022/convenios-monitorados`. Suporte a "Ver inativos" (checkbox). Modal para criar e editar (botão "Novo" + ícone de lápis por linha). Inativação por botão por linha (ícone de proibido). Modo estático mostra aviso de somente leitura e oculta botões de escrita. Validação mínima no frontend: número obrigatório e apenas dígitos, ano com 4 dígitos, UF com 2 caracteres. Testado ao vivo: criação, edição, inativação e listagem com inativos — todos corretos.
- Ajuste visual da Carteira Monitorada (Etapa 7.1). A seção "Carteira Monitorada" é área administrativa local — **não deve ficar aberta por padrão** para evitar duplicação visual com a tabela principal de convênios. Alterações: painel colapsado por padrão (`hidden`); botão "Gerenciar carteira" alterna visibilidade com ícone chevron; carregamento lazy na primeira abertura; checkbox "Ver inativos" e botão "Novo" movidos para dentro do painel. Mojibake `Conv�nio` corrigido pontualmente na renderização com `normalizarInstrumento()`. Registros fictícios de teste (`999999`, `888888`, `777777`) todos inativados localmente — não são dados reais e não devem aparecer como ativos.
- Leitor local do DETRU criado em `backend/services/profor-2022/detru-convenio-reader.js` (Etapa 8). Aceita caminho local para `siconv_convenio.csv.zip`. Funções exportadas: `localizarCsvNoZip`, `lerCsvDetruConvenio`, `normalizarCabecalhoDetru`, `parseCsvLinha`, `detectarSeparadorCsv`, `listarColunasDetruConvenio`. Localiza o primeiro CSV compatível (`siconv_convenio*.csv`) dentro do ZIP com fallback para qualquer CSV. Lê conteúdo como `latin1` (encoding frequente em arquivos do governo). Detecta separador (`;` ou `,`). Retorna array de objetos com chaves normalizadas (maiúsculas, underscores). Erros claros para arquivo ausente, extensão inválida, ZIP sem CSV e CSV vazio. **Não integra ainda com a carteira do banco. Não substitui a aba Geral. Não popula dados. Não altera rotas nem frontend.** Dependência `adm-zip` adicionada (v0.5.17, puro JavaScript, síncrono) — Node.js não tem suporte nativo a ZIP; `zlib` cobre DEFLATE/GZIP; `xlsx` lê ZIPs de planilha, não ZIP genérico. Arquivo DETRU não versionado.
- Mapeador DETRU criado em `backend/services/profor-2022/detru-convenio-mapper.js` (Etapa 9). Recebe objetos já lidos pelo leitor (Etapa 8) e os transforma no modelo interno. Funções exportadas: `converterNumeroDetru`, `limparTextoDetru`, `obterPrimeiraColunaDisponivel`, `mapearConvenioDetruParaProfor`, `mapearConveniosDetruParaProfor`, `validarColunasObrigatoriasDetru`. Mapeamento obrigatório: `NR_CONVENIO → numeroConvenio`, `ANO → ano`, `NR_PROCESSO → processoSei`, `DIA_FIM_VIGENC_CONV → vencimento`, `QTD_TA → quantidadeTa`, `VL_GLOBAL_CONV → valorGlobal`, `VL_REPASSE_CONV → valorRepasse`, `VL_CONTRAPARTIDA_CONV → valorContrapartida`, `VL_DESEMBOLSADO_CONV → repasseDesembolsado`, `VL_RENDIMENTO_APLICACAO → rendimentoAprovado`, `VL_INGRESSO_CONTRAPARTIDA → contrapartidaIntegralizada`. Colunas de UF mapeadas se presentes (`UF`, `SG_UF`, `UF_PROPONENTE`, `SG_UF_PROPONENTE`), null caso ausentes. Valores monetários convertidos de formato BR (`1.000,50`) para Number com 2 casas decimais. `saldoRendimentosAtual` e campos calculados **não mapeados** nesta etapa. Campo `fonte: "DETRU/siconv_convenio.csv.zip"` sempre presente. **Diretriz arquitetural:** o ZIP é grande e não deve ser carregado pela página. Fluxo futuro previsto: atualização diária backend → leitura do ZIP → filtro pelos convênios monitorados → mapeamento → snapshot/cache pequeno → páginas consomem somente o cache. **Sem integração com banco, rotas ou frontend nesta etapa.**
- Serviço de cruzamento criado em `backend/services/profor-2022/profor-detru-sync-service.js` (Etapa 10). Funções exportadas: `obterNumerosConveniosAtivos`, `filtrarLinhasDetruPorCarteira`, `cruzarCarteiraComDetru`, `resumirCruzamentoDetru`, `validarArquivoDetruParaCarteira`. A carteira local (SQLite) define quais convênios acompanhar — o DETRU não define a carteira. O cruzamento usa `NR_CONVENIO` como chave primária; o `ANO` é validação adicional quando preenchido na carteira (null na carteira aceita qualquer ano DETRU). `cruzarCarteiraComDetru(caminhoZip)` retorna `{ sucesso, consultadoEm, totalCarteiraAtiva, totalLinhasDetruLidas, totalEncontrados, totalNaoEncontrados, conveniosEncontrados, conveniosNaoEncontrados, colunas, validacaoColunas }`. **A página PROFOR 2022 e a home não processam o ZIP diretamente.** Cache/snapshot e rotina de atualização diária serão etapas futuras. **Nenhum dado DETRU gravado no banco nesta etapa.**
- Cache DETRU filtrado criado (Etapa 11). Tabelas `profor_detru_cache` (snapshot por convênio com `UNIQUE(numero_convenio, ano)`) e `profor_detru_atualizacoes` (log de auditoria de cada execução) adicionadas a `backend/db/init-db.js`. Serviço `backend/services/profor-2022/profor-detru-cache-service.js` criado com: `calcularHashArquivo` (SHA-256 via `crypto`), `salvarSnapshotDetru` (upsert em transação — cache anterior preservado em falha), `listarCacheDetruProfor2022`, `obterCacheDetruPorConvenio`, `registrarAtualizacaoDetruInicio`, `registrarAtualizacaoDetruFim`, `registrarAtualizacaoDetruErro`, `obterUltimaAtualizacaoDetru`. Script `backend/scripts/atualizar-cache-detru-profor-2022.js` criado: aceita caminho ZIP por argumento CLI ou usa padrão `Dados/detru/siconv_convenio.csv.zip`; calcula hash, registra início/fim/erro, salva snapshot. Disponível como `npm run atualizar:detru-profor`. **Nenhuma rota pública, frontend ou publicação estática alterada nesta etapa.**
- Configuração e acesso remoto ao DETRU criados (Etapa 12). Serviço `backend/services/profor-2022/detru-download-service.js` criado com 6 funções: `obterConfiguracaoDetru` (lê `DETRU_SICONV_CONVENIO_URL`, `DETRU_SICONV_CONVENIO_LOCAL` e `DETRU_ATUALIZACAO_DIARIA_HORA` do `.env` com fallback em `backend/data/aplicacao.json`), `resolverCaminhoLocalDetru`, `validarUrlDetru` (aceita somente `http://` e `https://`; rejeita vazio, nulo e outros protocolos), `baixarArquivoDetru` (fetch nativo Node v18+, baixa para `.tmp` e move ao concluir; remove parcial em falha), `garantirArquivoDetruAtualizado` (usa URL se configurada; usa local se não houver URL; falha com mensagem clara se nenhum disponível), `obterMetadadosArquivoDetru`. Script `atualizar-cache-detru-profor-2022.js` atualizado: sem argumento CLI, chama `garantirArquivoDetruAtualizado()` para download automático ou uso local. Agendador `backend/scripts/agendar-atualizacao-detru-profor-2022.js` criado com `setTimeout` recursivo calculando o próximo horário configurado — **não é acoplado ao `npm start`; deve rodar como processo separado** (`npm run agendar:detru-profor`). Variáveis DETRU adicionadas ao `.env.example` sem valor real. Seção `detru` adicionada em `backend/data/aplicacao.json` com `urlSiconvConvenio` vazio. `.gitignore` atualizado para ignorar `Dados/detru/*.zip`, `*.csv` e `*.tmp`. **Sem nova dependência — usa `fetch` nativo. Sem rota, sem frontend, sem publicação estática alterada.**
- Etapa 13: disparo administrativo da atualização DETRU criado. Serviço reutilizável `backend/services/profor-2022/profor-detru-update-service.js` centraliza hash, cruzamento, snapshot e registro de auditoria; script `backend/scripts/atualizar-cache-detru-profor-2022.js` passou a chamar esse serviço mantendo compatibilidade com argumento CLI; `backend/server.js` ganhou `POST /api/profor-2022/detru/atualizar` e `GET /api/profor-2022/detru/ultima-atualizacao`; `frontend/js/app.js` passou a exibir botão discreto "Atualizar DETRU" apenas no modo local/API, recarregar o status da última atualização e bloquear o fluxo no modo estático; documentação de rotas e diário de bordo foram atualizados. A página continua sem processar ZIP diretamente.
- Bloco 14: base técnica de rendimentos Transferegov público criada. Tabelas `profor_transferegov_rendimentos_cache` e `profor_transferegov_rendimentos_consultas` adicionadas ao SQLite local; cliente `backend/services/profor-2022/transferegov-rendimentos-client.js` criado para montar a URL pública conhecida, consultar por `fetch` nativo e extrair `#tr-novaSolicitacaoValorDisponivelRendimento`; serviço `backend/services/profor-2022/transferegov-rendimentos-cache-service.js` criado para salvar apenas consultas bem-sucedidas e preservar o último cache válido em falhas; script `backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js` criado e exposto como `npm run atualizar:rendimentos-profor`. A captura direta pode depender de sessão pública do convênio no Transferegov; não há login, bypass ou uso de credenciais. A página PROFOR 2022 ainda não consome este cache nesta etapa.
- Bloco 15: cálculos internos e filtro seguro do plano criados em serviços puros. `backend/services/profor-2022/profor-plano-aplicacao-service.js` centraliza normalização, filtro por UF/número/ano/área/natureza, bloqueio de filtro por UF quando há risco de mistura de convênios, agrupamento e resumo do plano. `backend/services/profor-2022/profor-calculos-service.js` consolida valores de DETRU/cache, saldo de rendimentos de Transferegov/cache e cálculos por área/natureza do plano filtrado. A página PROFOR 2022 ainda usa a origem antiga em `data-service.js`; não houve integração com telas, rotas, banco ou publicação. `saldoDisponivelOuvidoria` segue pendente até fórmula segura ou compositor.
- Bloco 16: compositor consolidado, comparador e flag de origem criados sem ativação na página. `backend/services/profor-2022/profor-origem-service.js` mantém a origem padrão `planilha` e reserva `banco-cache` para ativação futura. `backend/services/profor-2022/profor-consolidado-service.js` monta objeto PROFOR 2022 consolidado a partir da carteira local, cache DETRU, cache Transferegov e plano de aplicação filtrado por UF + número + ano. `backend/services/profor-2022/profor-comparador-service.js` compara origem antiga versus nova com tolerâncias monetária e percentual. `data-service.js`, frontend, rotas, banco e publicação estática não foram alterados. `saldoDisponivelOuvidoria` continua pendente e sai como `null` com aviso.
- Bloco 17: integração controlada da origem consolidada com fallback. `backend/services/data-service.js` preserva a origem `planilha` e acrescenta metadados seguros ao objeto PROFOR 2022 sem mudar o shape consumido pela tela. `backend/services/dashboard-publication-service.js` passa a resolver a origem por flag/opção: `planilha` mantém o fluxo antigo; `banco-cache` chama `profor-consolidado-service.js` com plano extraído das abas UF; falhas retornam para `planilha` com aviso. `backend/services/static-publication-service.js` sanitiza o catálogo público para não publicar a seção interna `detru`. Frontend, rotas, banco, `backend/data/aplicacao.json` e JSONs publicados não foram alterados; `npm run publicar:dados` não foi executado.
- Bloco 18: validação final local e rotas somente leitura. `backend/server.js` recebeu `GET /api/profor-2022/consolidado` e `GET /api/profor-2022/comparar-origens`, ambas locais/API e sem consulta externa. O comparador passou a tratar `quantidadeTa` como número simples. A validação real retornou 15 convênios em cada origem, sem ausentes, mas 15 divergentes porque os caches DETRU e Transferegov ainda não possuem dados para a carteira (`totalComDetru = 0`, `totalComRendimentos = 0`). Home e página PROFOR 2022 carregaram com origem padrão `planilha` e sem erro de console. Banco-cache segue bloqueado para ativação como padrão.
- Correção do fluxo público Transferegov (18/05/2026): `backend/services/profor-2022/transferegov-rendimentos-client.js` passou a reproduzir o fluxo público completo de rendimentos por sessão Acesso Livre: inicialização guest, consulta pública por `numeroConvenio`, extração de `idConvenio`, seleção do instrumento e leitura da tela de Rendimento de Aplicação. O cliente tenta HTTP com cookie jar em memória e, quando o IdP/SAML impede sessão por HTTP simples, usa fallback local com Playwright/Chromium já disponível no projeto, sem login, sem credenciais e sem cookies persistidos. Testes reais: `880892` → `idConvenio=732378`, R$ 131.799,75; `937216` → `idConvenio=1031156`, -R$ 25.373,11. `npm run atualizar:rendimentos-profor` populou o cache para 15/15 convênios. `totalComRendimentos` passou a 15. Banco-cache continua fora do padrão.
- Rotina operacional consolidada (18/05/2026): `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` criado como orquestrador único. Executa DETRU → rendimentos Transferegov → montagem do consolidado → validação de diagnóstico, com `executarEtapaComProtecao` envolvendo cada etapa para preservar relatório e nunca apagar caches anteriores (todas as gravações continuam sendo upsert). Funções: `atualizarProfor2022Consolidado()`, `validarDiagnosticoConsolidado()`, `resumirAtualizacaoConsolidada()`, `executarEtapaComProtecao()`. Script CLI `npm run atualizar:profor-2022` e agendador `npm run agendar:profor-2022` adicionados (horário configurável por `PROFOR_2022_ATUALIZACAO_DIARIA_HORA`, fallback `06:30`). Rotas locais/API administrativas criadas: `POST /api/profor-2022/atualizar` e `GET /api/profor-2022/atualizacao/status`. Frontend recebeu botão `btnAtualizarProfor2022` e linha de status, ambos restritos ao modo local/API. Teste real: 15/15 DETRU, 15/15 rendimentos, 15/15 consolidado em 119s. Publicação estática NÃO executada. JSONs publicados NÃO alterados.

### 10.1.0. Visão geral exibe data/hora da última atualização operacional

A visão geral da home ("Fomento para Ouvidoria") e o rodapé deixam de exibir o texto estático "Atualizado em abril de 2026" e passam a exibir a data/hora dinâmica calculada como `max(últimaAtualizaçãoDETRU, últimaConsultaRendimentosTransferegov)`. O endpoint `GET /api/profor-2022/atualizacao/status` ganhou o campo `ultimaAtualizacaoDados = { dataHora, fonte, fontesConsideradas: { detru, rendimentos } }`. O frontend formata a data em padrão brasileiro `dd/mm/aaaa às HH:MM` em fuso local do navegador. A nota "Os dados foram atualizados até abril de 2026 (...) janela de submissão dos relatórios" segue inalterada por se tratar de aviso de governança específico do FAF.

A partir do bloco de publicação estática (18/05/2026), o mesmo metadado `ultimaAtualizacaoDados` passou a ser publicado dentro de `dadosProfor2022` em `frontend/data/publicados/aplicacao.json` e `frontend/data/publicados/dashboard-geral.json`. No modo estático/GitHub Pages, o frontend lê esse metadado diretamente do JSON publicado já carregado, sem chamar nenhuma rota `/api/`. Em modo local/API, o endpoint continua sendo a fonte preferencial. Quando o metadado está totalmente ausente (`dataHora: null`), o fallback continua sendo "Atualização não registrada" — sem inventar horário. O helper compartilhado `backend/services/profor-2022/profor-atualizacao-meta-service.js` evita duplicação entre o endpoint e o pipeline de publicação.

Correção de robustez em 18/05/2026: em modo local/API, se `GET /api/profor-2022/atualizacao/status` falhar ou retornar sem `ultimaAtualizacaoDados.dataHora`, o frontend tenta `obterDadosProfor2022()?.ultimaAtualizacaoDados` antes de exibir "Atualização não registrada". Ao final de `garantirDadosBaseAplicacao()`, o rótulo é recalculado depois que o cache PROFOR 2022 já foi populado, reduzindo corrida assíncrona. O endpoint `GET /api/profor-2022/consolidado` também passou a incluir `ultimaAtualizacaoDados` no payload `data` como metadado defensivo.

Complemento operacional: o rótulo da visão geral não deve ser sobrescrito por fallback nulo depois que já estiver exibindo `Atualizado em ...`. Se uma chamada posterior não trouxer `dataHora`, o frontend preserva o rótulo válido existente. O cache-buster do bundle foi atualizado para `v=20260518-06` para forçar navegadores locais a buscar a correção.

Regra de exibição da faixa técnica: a faixa administrativa de origem/diagnóstico (`Origem local/API`, `Diagnóstico`, avisos de campos pendentes como `saldoDisponivelOuvidoria`) não é exibida na visão principal, nem em modo local/API nem em modo estático/GitHub Pages. A informação técnica deve permanecer restrita a endpoints/status ou a área administrativa recolhida, quando houver necessidade operacional. A página PROFOR 2022 não deve mostrar `banco-cache`, contagens DETRU/Plano/Rendimentos ou pendências internas como mensagem visual para o usuário final.

### 10.1.1. Rotina operacional diária consolidada (referência rápida)

| Item | Detalhe |
| --- | --- |
| Comando manual | `npm run atualizar:profor-2022` |
| Comando de agendamento | `npm run agendar:profor-2022` (processo separado) |
| Horário diário | `PROFOR_2022_ATUALIZACAO_DIARIA_HORA` no `.env` (fallback `06:30`) |
| Rota administrativa | `POST /api/profor-2022/atualizar` |
| Rota de status (somente leitura) | `GET /api/profor-2022/atualizacao/status` |
| Botão UI | "Atualizar PROFOR 2022" no painel da Carteira Monitorada (oculto no modo estático) |
| Preservação de cache | Todas as gravações são upsert; em falha de DETRU ou rendimentos, o cache anterior permanece e o relatório registra a falha |
| Não publica dados estáticos | `npm run publicar:dados` NÃO é chamado pela rotina; JSONs públicos não são alterados |

### 10.2. Próximas etapas

1. Validar governança das divergências remanescentes entre `planilha` e `banco-cache`, especialmente `saldoRendimentosAtual` agora capturado no Transferegov.
2. Definir fórmula segura para `saldoDisponivelOuvidoria`.
3. Confirmar se o fallback local com Playwright/Chromium é aceitável como mecanismo operacional de atualização em ambiente local/API.
4. Ativar origem nova apenas após divergências bloqueantes serem saneadas e comunicadas.
5. Remover dependência obrigatória da aba `Geral`.

### 10.3. Fase futura

Automatizar o PAD detalhado para reduzir ou eliminar a dependência das abas estaduais da planilha.

## 11. O que não alterar sem nova decisão

1. Não remover a aba `Geral` antes de existir comparador e fallback.
2. Não remover as abas estaduais antes da automação do PAD detalhado.
3. Não substituir nomes de campos consumidos pelo front-end sem revisão completa.
4. Não publicar JSONs por hábito.
5. Não criar dependência nova sem justificativa.
6. Não usar acesso restrito do Transferegov.
7. Não armazenar cookies, tokens ou HTML bruto sensível.

## 12. Histórico de revisões

| Data | Alteração | Observação |
| --- | --- | --- |
| 17/05/2026 | Criação do rascunho técnico | Documento preparado para inserção em `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`. |
| 17/05/2026 | Etapa 3: tabela criada | `profor_convenios_monitorados` adicionada ao banco local por migration aditiva em `backend/db/init-db.js`. Sem dados populados. Schema documentado em `schema-banco.md`. |
| 17/05/2026 | Etapa 4: serviço criado | `backend/services/profor-2022/convenios-monitorados-service.js` criado com funções de listagem, leitura, criação, atualização e inativação. Sem rota nem dados populados. |
| 17/05/2026 | Etapa 5: rotas criadas | 4 rotas adicionadas em `backend/server.js`. API em camelCase. Testadas ao vivo. Registro de teste inativado; nenhum dado real populado. |
| 17/05/2026 | Etapa 6: importação inicial | Script `backend/scripts/importar-convenios-monitorados-profor-2022.js` criado. Importa carteira da aba Geral; 15 convênios inseridos; 0 erros; idempotente. |
| 17/05/2026 | Etapa 7: interface da carteira | Seção "Carteira Monitorada" adicionada ao final da página PROFOR 2022. CRUD completo via API local; modal de criar/editar; inativação por linha; modo estático somente leitura. |
| 17/05/2026 | Etapa 7.1: ajuste visual | Carteira colapsada por padrão; botão "Gerenciar carteira" com toggle; lazy load; mojibake corrigido pontualmente; registros fictícios saneados (888888 inativado localmente). |
| 17/05/2026 | Etapa 8: leitor DETRU | `backend/services/profor-2022/detru-convenio-reader.js` criado. Lê `siconv_convenio.csv.zip`, retorna array de objetos. Sem integração com banco, rotas ou frontend. Dependência `adm-zip` adicionada. |
| 17/05/2026 | Etapa 9: mapeador DETRU | `backend/services/profor-2022/detru-convenio-mapper.js` criado. Transforma linha DETRU em objeto parcial do modelo interno. Sem banco, rotas ou frontend. Lista de próximas etapas corrigida e renumerada. |
| 17/05/2026 | Etapa 10: cruzamento carteira × DETRU | `backend/services/profor-2022/profor-detru-sync-service.js` criado. Cruza carteira ativa SQLite com linhas DETRU filtradas por NR_CONVENIO/ANO. Sem gravação no banco, sem cache, sem frontend. |
| 17/05/2026 | Etapa 11: cache DETRU filtrado | Tabelas `profor_detru_cache` e `profor_detru_atualizacoes` criadas. Serviço `profor-detru-cache-service.js` criado. Script `atualizar-cache-detru-profor-2022.js` e entrada `npm run atualizar:detru-profor` adicionados. Duplicação residual na lista de próximas etapas corrigida. |
| 17/05/2026 | Etapa 12: configuração e acesso remoto ao DETRU | Serviço `detru-download-service.js` criado. Configuração por `.env` e `aplicacao.json`. Download via `fetch` nativo. Agendador `agendar-atualizacao-detru-profor-2022.js` como processo separado. `.gitignore` atualizado. Sem dependência nova, sem rota, sem frontend. |
| 17/05/2026 | Etapa 13: disparo administrativo da atualização DETRU | Serviço reutilizável `profor-detru-update-service.js` criado. Script manual e rotas locais/API para atualização e status adicionados. Botão discreto na Carteira Monitorada ativa apenas no modo local/API. |
| 17/05/2026 | Bloco 14: Transferegov público + cache de rendimentos | Cliente público e parser HTML criados. Tabelas de cache/histórico adicionadas ao SQLite local. Script `atualizar:rendimentos-profor` criado. Página PROFOR 2022 ainda não consome o cache. |
| 17/05/2026 | Bloco 15: cálculos internos + filtro seguro do plano | Serviços puros `profor-plano-aplicacao-service.js` e `profor-calculos-service.js` criados. Filtro seguro por UF/número/ano e cálculos por área/natureza implementados sem integrar na página. |
| 17/05/2026 | Bloco 16: compositor consolidado + comparador + flag | Serviços `profor-origem-service.js`, `profor-consolidado-service.js` e `profor-comparador-service.js` criados. Origem padrão segue `planilha`; `banco-cache` fica reservado para ativação futura. |
| 17/05/2026 | Bloco 17: integração nas telas + publicação estática | Origem padrão `planilha` preservada. Fluxo Node de publicação suporta `banco-cache` com fallback para `planilha`; `data-service.js` mantém compatibilidade da tela; publicação estática sanitiza a seção interna `detru`. |
| 17/05/2026 | Bloco 18: validação final + leitura local do consolidado | Rotas locais/API somente leitura criadas para consolidado e comparação. Comparação real executada; 15 convênios divergentes por ausência de cache DETRU/rendimentos. Banco-cache permanece fora do padrão. |
| 17/05/2026 | Bloco 19: validação operacional do cache DETRU | URL oficial configurada e download automático executado. Cache populado: 15/15 convênios encontrados. `totalComDetru` foi para 15. Sem alteração de código. |
| 17/05/2026 | Bloco 20: diagnóstico do consolidado pós-DETRU | Esclarecido falso positivo de `totalComPlano=1` (era erro do script de relatório temporário, não do código). Endpoint real retorna `totalComPlano=15`. Diagnóstico Transferegov: cache vazio (0/15); cliente depende de sessão pública. Sem alteração de código. |
| 17/05/2026 | Bloco 21: classificação das 15 divergências | Criada matriz de divergências em 5 grupos (A: DETRU oficial, B: cálculo do plano, C: campo novo calculado, D: cache Transferegov ausente, E: validação humana). Documento novo `profor-2022-divergencias.md` criado com matriz, opções de governança e critérios para ativação. Seção 13 adicionada a este documento. Sem alteração de código. |
| 17/05/2026 | Bloco 22: sondagem do fluxo Transferegov Acesso Livre | Testadas 5 URLs públicas (`ConsultarProposta.do?Usr=guest`, `ForwardAction.do?...MostraPrincipalConsultarConvenio.do`, etc.) com convênio de referência 880892. Todas redirecionam via SAML para tela "Login do Transferegov" (401 no IdP). Fluxo guest direto bloqueado por SAML/SSO no IdP. Sem alteração de código de produção. Seção 13.4 reescrita; Grupo D corrigido no documento de divergências (Transferegov é fonte oficial, DETRU não é). Aguardando HAR/HTML do usuário para reabrir investigação. |
| 18/05/2026 | Integração visual local/API do `banco-cache` | Frontend passou a consultar `GET /api/profor-2022/origem` e, somente quando a origem resolvida é `banco-cache`, carregar `GET /api/profor-2022/consolidado`. Página PROFOR 2022 exibe origem, diagnóstico e fonte do saldo de rendimentos. Home usa itens de convênio derivados do consolidado no modo local/API. Origem padrão segue `planilha`; publicação estática não foi executada. |
| 18/05/2026 | Correção do fluxo público de rendimentos | Cliente Transferegov passou a reproduzir o fluxo Acesso Livre completo e popular cache de rendimentos. 880892 e 937216 testados com sucesso; carteira atualizada com 15/15 sucessos; `totalComRendimentos=15`. Origem padrão continua `planilha`; frontend e JSONs publicados não foram alterados. |
| 18/05/2026 | Rotina operacional consolidada (DETRU + rendimentos + consolidado) | Orquestrador `profor-atualizacao-consolidada-service.js` criado. Scripts npm `atualizar:profor-2022` e `agendar:profor-2022`. Rotas administrativas `POST /api/profor-2022/atualizar` e `GET /api/profor-2022/atualizacao/status`. Frontend com botão e status discreto restritos ao modo local/API. Teste real: 15/15/15 em 119s. Publicação estática NÃO executada. |
| 18/05/2026 | Data/hora dinâmica na visão geral | Visão geral e rodapé substituem texto "Atualizado em abril de 2026" pela última atualização operacional efetiva: `max(DETRU, Transferegov/rendimentos)`. Endpoint `/api/profor-2022/atualizacao/status` enriquecido com `ultimaAtualizacaoDados`. Frontend formata `dd/mm/aaaa às HH:MM` em fuso local. Fallback "Atualização não registrada" no modo estático ou em falha. Publicação estática NÃO executada. |
| 18/05/2026 | Publicação estática com `banco-cache` e metadado de atualização | Helper `profor-atualizacao-meta-service.js` criado e reutilizado pelo endpoint e pelo pipeline de publicação. `montarDadosProfor2022Publicacao()` anexa `ultimaAtualizacaoDados` ao objeto publicado. `npm run publicar:dados` executado intencionalmente: `aplicacao.json`, `dashboard-geral.json` e `resumo-publicacao.json` atualizados; 15 convênios; diagnóstico 15/15/15. Auditoria sem vazamento de `.env`, cookies, HAR, HTML bruto, ZIP, CSV ou SQLite. Modo estático passa a exibir a data publicada sem chamar API local. |

## 13. Critérios de aceitação da futura origem `banco-cache`

Após a conclusão do diagnóstico de 17/05/2026 (DETRU resolvido, plano de aplicação casando), a ativação do `banco-cache` como origem padrão deixou de ser problema técnico e passou a ser **decisão de governança**.

### 13.1. Princípio operativo

Divergência entre `planilha` e `banco-cache` **não é automaticamente erro**. As 15 divergências atuais são todas explicáveis pela arquitetura definida nos blocos 14–18:

- valores oficiais do DETRU substituem valores manuais antigos da aba Geral;
- saldos e execuções por área/natureza são recalculados a partir dos itens do plano filtrados por UF + número + ano;
- `saldoRendimentosAtual` vem do cache Transferegov populado pela tela pública de Rendimento de Aplicação e ainda diverge dos valores manuais antigos da aba Geral.

Classificar uma divergência como erro requer evidência. Aceitar uma divergência como esperada requer decisão registrada (preferencialmente em ata).

### 13.2. Distinção entre fontes

| Tipo | Origem | Quando é autoritativa |
| --- | --- | --- |
| DETRU oficial | Plataforma SICONV/DETRU (`siconv_convenio.csv.zip`) | Sempre, para campos cadastrais e financeiros oficiais |
| Cálculo do plano | Soma `valorPrevisto`/`valorExecutado`/`saldo` dos itens do plano filtrado por UF + nº + ano | Sempre, para campos por área/natureza |
| Transferegov público | Página pública de Rendimento de Aplicação (sessão pública do convênio) | Quando a sessão pública estiver estabelecida; sem login/captcha |
| Aba `Geral` (manual) | Planilha `Planilhas/gestao_financeira_ouvidoria.xlsx` aba `Geral` | Transitória; deve ser substituída pelas três anteriores |

### 13.3. Critérios para ativação

A ativação como padrão (`PROFOR_2022_ORIGEM_DADOS=banco-cache`) só deve ocorrer quando **todos** os critérios abaixo forem atendidos:

1. ✅ `totalComDetru = 15` (técnico — atingido).
2. ✅ `totalComPlano = 15` (técnico — atingido).
3. ✅ `totalComRendimentos = 15` (técnico — atingido em 18/05/2026 via Transferegov Acesso Livre).
4. ⚠️ Decisão de governança formalizada sobre Grupo A (DETRU oficial): aceitar `quantidadeTa`, `valorGlobal`, `valorRepasse`, `rendimentoAprovado` da fonte oficial.
5. ⚠️ Decisão de governança formalizada sobre Grupo B (cálculo do plano): aceitar `saldoResidualCapital`, `saldoResidualCusteio`, `valorExecutadoGeral` calculados.
6. ⚠️ Decisão de governança formalizada sobre Grupo D (Transferegov): aceitar diferenças entre o saldo manual da aba `Geral` e o saldo atual capturado na tela pública.
7. ⚠️ Validação visual no modo local/API antes da publicação estática.
8. ⚠️ Comunicação aos usuários da SENAPPEN/ONASP sobre mudança de origem.

A matriz completa por campo e as quatro opções de governança (não ativar; ativar parcialmente; ativar híbrido; validar humanamente) estão em [`profor-2022-divergencias.md`](profor-2022-divergencias.md).

### 13.4. Situação específica do Transferegov

`saldoRendimentosAtual` tem fonte técnica definida no **Transferegov Acesso Livre**, na tela de Rendimento de Aplicação, após posicionar sessão pública no convênio. O fluxo implementado em 18/05/2026 é:

1. Inicializar sessão pública Acesso Livre.
2. Consultar Pré-Instrumento/Instrumento por `numeroConvenio`.
3. Extrair `idConvenio` da resposta.
4. Acessar/selecionar o instrumento por `idConvenio` mantendo a sessão pública.
5. Acessar a tela `ListarSolicitacaoRendimentosAplicacao.do` e extrair `valorDisponivelRendimento` (linha `tr-novaSolicitacaoValorDisponivelRendimento`).

DETRU **não** é fonte deste campo. O SICONV traz `VL_RENDIMENTO_APLICACAO` (rendimento aprovado, Grupo A), que é diferente do saldo disponível atual de rendimentos.

**Estado em 18/05/2026**:

- O cliente em `backend/services/profor-2022/transferegov-rendimentos-client.js` tenta primeiro o fluxo HTTP público com cookies em memória.
- Como o cliente HTTP simples ainda recebe SAML/IdP antes de estabelecer a sessão de convênio, o cliente usa fallback local com Playwright/Chromium já disponível no projeto para reproduzir sessão pública de navegador.
- O fallback não usa login, senha, gov.br, certificado, captcha, cookies do HAR, cookie persistido ou área restrita.
- O caso de referência `880892` extraiu `idConvenio=732378`, `Instrumento 880892` e `R$ 131.799,75`.
- O convênio PROFOR `937216` extraiu `idConvenio=1031156` e `-R$ 25.373,11`.
- `npm run atualizar:rendimentos-profor` populou o cache de rendimentos para 15/15 convênios monitorados.
- `/api/profor-2022/consolidado` passou a retornar `totalComRendimentos=15`.

O bloqueio atual deixou de ser captura técnica ausente. A pendência passou a ser de validação/governança: a comparação ainda marca 15 divergências em `saldoRendimentosAtual`, porque a aba `Geral` guarda valores manuais antigos e o `banco-cache` guarda o saldo atual da tela pública do Transferegov.

**Fluxo conceitual preservado**:

1. Consultar Pré-Instrumento/Instrumento por `numeroConvenio`.
2. Extrair `idConvenio` da resposta.
3. Acessar/selecionar o instrumento por `idConvenio` (mantendo cookies de sessão).
4. Acessar a tela `ListarSolicitacaoRendimentosAplicacao.do` e extrair `valorDisponivelRendimento` (linha `tr-novaSolicitacaoValorDisponivelRendimento`).
