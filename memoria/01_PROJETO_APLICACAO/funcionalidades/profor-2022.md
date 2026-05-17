# PROFOR 2022 — Documentação técnica da funcionalidade

## Identificação da funcionalidade

| Campo | Valor |
| --- | --- |
| Nome da funcionalidade | PROFOR 2022 |
| Arquivo deste documento | `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md` |
| Status do documento | rascunho técnico |
| Última revisão | 17/05/2026 |
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

1. A tabela local de convênios monitorados ainda não foi criada.
2. As rotas locais da carteira ainda não existem.
3. A captura do saldo de rendimento foi diagnosticada tecnicamente, mas ainda não foi implementada no código.
4. A automação do PAD detalhado ainda não foi implementada.
5. A eliminação completa da planilha depende de futura automação do plano de aplicação detalhado.

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

Bloco 14 criou a base técnica para que `saldoRendimentosAtual` tenha origem planejada no Transferegov público, por consulta local/API e cache SQLite. A captura direta pode depender de sessão pública previamente estabelecida para o convênio no próprio Transferegov; não há login, senha, captcha, certificado, área restrita ou bypass. Nesta etapa, a página PROFOR 2022 ainda não consome esse cache.

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
| `saldoDisponivelOuvidoria` | previsto - executado da área |
| `saldoResidualCapital` | saldo calculado para natureza CAPITAL |
| `saldoResidualCusteio` | saldo calculado para natureza CUSTEIO |

A regra exata de saldo residual deve ser validada por comparação com a planilha antes da ativação definitiva.

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

### 10.2. Próximas etapas

1. Refinar, se necessário, o estabelecimento de sessão pública do convênio no Transferegov.
2. Integrar o cache local de rendimentos ao compositor consolidado do PROFOR 2022.
3. Criar cálculos internos por área/natureza.
4. Ajustar filtro do plano por UF, número e ano.
5. Criar compositor consolidado (objeto PROFOR 2022).
6. Criar comparador entre origem antiga e nova.
7. Criar flag `planilha`/`banco`.
8. Integrar nova origem no `data-service.js`.
9. Ajustar publicação estática.
10. Validar divergências.
11. Ativar origem nova.
12. Remover dependência obrigatória da aba `Geral`.

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
