# PLANO TÉCNICO — REGISTROS DO PAD / PROFOR 2022

> Documento de execução técnica para o repositório `Masselorc/FOMENTO-ONASP`.
>
> Escopo fechado em 29/09/2026.
>
> Este arquivo deve ser colocado na raiz da branch `main` como plano de implementação. Ele não substitui `AGENTS.md`, `memoria/INDEX.md` nem a inspeção do código real antes da execução.

---

## 0. Status e decisões já fechadas

Este documento consolida decisões funcionais que **não devem ser rediscutidas pela IA executora**, salvo se o código atual tornar algum ponto tecnicamente impossível. Nesse caso, a IA deve explicar a incompatibilidade objetiva antes de alterar a arquitetura.

Decisões:

1. O histórico será implementado **somente para o PAD do PROFOR 2022**.
2. A origem principal das atualizações históricas será a rotina existente de atualização do PAD via Transferegov:
   - `POST /api/profor-2022/pad/atualizar-transferegov`.
3. O histórico ficará dentro do contexto da página **PROFOR 2022**.
4. Haverá uma tela interna própria chamada **“Registros do PAD”**.
5. A tela “Registros do PAD” será acessível:
   - a partir da página PROFOR 2022;
   - por botão **“Ver alterações”** após uma atualização do PAD;
   - sem criar uma nova seção global fora do módulo PROFOR 2022.
6. Atualizações em que **nenhuma alteração seja encontrada também serão registradas**.
7. O histórico terá **retenção por prazo indeterminado**.
8. Snapshots e registros históricos serão **imutáveis e append-only**.
9. Quando houver item antigo ausente e item novo aparentemente substituto:
   - usar vinculação automática apenas quando a identidade/substituição for **inequívoca** segundo mecanismos já existentes;
   - casos ambíguos vão para revisão humana;
   - não criar heurística paralela baseada apenas em semelhança textual.
10. Para as áreas do PAD:
    - preservar automaticamente classificação já conhecida quando a identidade do item for segura;
    - reaproveitar memória já existente de rateios, decisões e vínculos de substituição;
    - item novo sem correspondência segura deve permanecer como **classificação pendente**;
    - não adivinhar `Ouvidoria`, `Corregedoria` ou `Escola de Serviços Penais`.
11. Cada atualização mostrará resumo geral e comparação detalhada “Antes × Depois”.
12. A senha operacional deixará de ser exigida **nas ações administrativas locais do PROFOR 2022**:
    - a interface local não deverá solicitar senha;
    - chamadas originadas de loopback continuarão sendo reconhecidas por `ehRequisicaoLocal(req)`;
    - chamadas remotas/não locais continuarão protegidas por `PROFOR_ADMIN_TOKEN` e pelos guards já existentes;
    - a autenticação de outros módulos do FOMENTO-ONASP não faz parte desta tarefa.
13. O modo estático/GitHub Pages continuará somente leitura e **não publicará o histórico operacional do PAD**.

---

# 1. Objetivo final

Criar no módulo PROFOR 2022 uma camada persistente e auditável de versionamento das atualizações do Plano de Aplicação Detalhado — PAD, capaz de responder com precisão:

- quando cada atualização foi executada;
- se houve ou não mudança;
- qual era o estado imediatamente anterior;
- qual passou a ser o estado imediatamente posterior;
- quais itens foram incluídos;
- quais itens foram removidos;
- quais itens foram alterados;
- quais campos de cada item mudaram;
- qual era e qual passou a ser a classificação por área;
- quando a classificação foi herdada da memória existente;
- quando um item permanece pendente de classificação/revisão;
- quando um item novo foi reconhecido inequivocamente como substituto de item anterior;
- qual convênio/UF foi afetado;
- quais totais financeiros mudaram;
- qual execução do Transferegov originou o registro.

O resultado visual deve seguir o conceito da tela **Registros** do projeto PROFOR-2026:

- calendário com marcação dos dias em que houve atualizações;
- seleção de data;
- agrupamento por execução/horário;
- resumo de alterações;
- comparação “ANTES | DEPOIS”;
- expansão do detalhe por item.

A arquitetura, porém, deverá ser própria do FOMENTO-ONASP, usando **Postgres/Supabase**, e não o sistema de arquivos/versionamento JSON do PROFOR-2026.

---

# 2. Princípios obrigatórios de implementação

## 2.1. Não reconstruir o que já existe

A IA executora deve partir do princípio de que grande parte da lógica difícil já está implementada.

É proibido criar um segundo motor independente para:

- identificar itens;
- normalizar descrições;
- calcular identidade material;
- comparar snapshots;
- detectar item novo;
- detectar item removido;
- comparar valor, quantidade, saldo, área ou natureza;
- classificar divergências;
- preservar rateios;
- vincular substitutos;
- decidir automaticamente área de item novo.

Deve ser reutilizado o código existente.

---

## 2.2. Fontes de verdade técnicas

Antes de alterar qualquer arquivo, executar obrigatoriamente a leitura, nesta ordem:

1. `AGENTS.md`
2. `memoria/INDEX.md`
3. `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`
4. `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`
5. `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md`
6. `memoria/08_ROTAS_BANCO_API/schema-banco.md`
7. `memoria/08_ROTAS_BANCO_API/rotas.md`
8. `memoria/09_ERROS_E_CORRECOES/historico-erros.md`, apenas nas partes pertinentes
9. arquivos reais afetados descritos neste plano.

Não usar `backend/db/init-db.js` como fonte do banco atual. Ele é legado SQLite.

O banco operacional atual é PostgreSQL/Supabase por `DATABASE_URL`.

As fontes de verdade para banco são:

- `supabase/migrations/`;
- `backend/db/postgres-client.js`;
- `backend/db/preparar-banco.js`;
- SQL dos services ativos.

---

## 2.3. Preservar o fluxo atual

A atualização já existente:

`Transferegov -> cache -> recarga operacional -> publicação`

não deve ser reescrita do zero.

O histórico deve ser acoplado de forma incremental ao fluxo existente.

Os principais componentes atuais são:

- `backend/services/profor-2022/profor-pad-atualizacao-transferegov-job-service.js`
- `backend/services/profor-2022/profor-pad-atualizacao-transferegov-orquestrador-service.js`
- `backend/services/profor-2022/profor-pad-carregador-operacional-service.js`
- `backend/services/profor-2022/profor-pad-fotografia-service.js`
- `backend/services/profor-2022/profor-pad-comparador-snapshots-service.js`

Não criar um novo atualizador Transferegov.

---

# 3. Estado atual relevante

## 3.1. Job assíncrono existente

A atualização do PAD já é gerenciada por:

`GerenciadorAtualizacaoTransferegov`

em:

`backend/services/profor-2022/profor-pad-atualizacao-transferegov-job-service.js`

Características que devem ser preservadas:

- `jobId`;
- exclusividade por chave;
- chave padrão `global`;
- prevenção de duas atualizações simultâneas;
- status `em_andamento`, `concluido`, `erro`;
- eventos de progresso;
- publicação estática após atualização;
- logs operacionais;
- endpoint de status.

O histórico persistente **não substitui** o job em memória.

O job em memória continua responsável pelo acompanhamento em tempo real.

O novo histórico fica responsável pela persistência permanente do resultado.

---

## 3.2. Orquestrador existente

Arquivo:

`backend/services/profor-2022/profor-pad-atualizacao-transferegov-orquestrador-service.js`

Fluxo atual:

1. obtém lista canônica de convênios;
2. extrai PAD do Transferegov;
3. valida integridade;
4. monta cache;
5. valida cache;
6. salva cache;
7. executa recarga operacional;
8. retorna resumo.

Esse fluxo deve permanecer como o motor da atualização.

---

## 3.3. Recarga operacional e memória de classificação

Arquivo:

`backend/services/profor-2022/profor-pad-carregador-operacional-service.js`

O serviço já:

- lê o PAD;
- confronta itens com a memória;
- carrega `profor_2022_item_rateios`;
- aplica rateios existentes;
- preserva `area` e `natureza`;
- separa itens reconhecidos de itens pendentes;
- não deixa item novo sem rateio bloquear toda a recarga;
- gera `pendenciasRevisao`;
- gera `planoAplicacaoReconstruido`.

Esse comportamento deve ser aproveitado.

---

## 3.4. Snapshot canônico existente

Arquivo:

`backend/services/profor-2022/profor-pad-fotografia-service.js`

Reutilizar:

- `gerarFotografiaCanonica`;
- `calcularHashItem`;
- chaves de identidade já existentes;
- checksum do snapshot;
- versão do snapshot;
- parser versionado.

Não criar novo hash de item para substituir o atual.

---

## 3.5. Comparador de snapshots existente

Arquivo:

`backend/services/profor-2022/profor-pad-comparador-snapshots-service.js`

O comparador já reconhece, entre outros:

- item novo;
- item removido;
- descrição alterada;
- descrição alterada apenas por diacrítico;
- área alterada;
- natureza alterada;
- quantidade alterada;
- valor unitário alterado;
- valor previsto alterado;
- valor executado alterado;
- saldo alterado.

Também possui múltiplas etapas de pareamento e tratamento de colisões por `hashItem`.

Esse comparador é a base obrigatória do histórico.

---

## 3.6. Memória e revisão existentes

Já existem, entre outras:

- `profor_2022_itens_conhecidos`;
- `profor_2022_item_rateios`;
- `profor_2022_revisao_lotes`;
- `profor_2022_revisao_divergencias`;
- `profor_2022_revisao_decisoes`;
- `profor_2022_revisao_logs`.

Já existe mecanismo de saneamento que registra:

`payloadDecisao.tipoSaneamento = "vinculo_item_substituto"`

O histórico deve **consultar e referenciar** essas decisões, nunca criar outro sistema de memória concorrente.

---

# 4. Arquitetura proposta

Criar três entidades persistentes exclusivas do histórico do PAD:

1. `profor_2022_pad_atualizacoes`
2. `profor_2022_pad_snapshots`
3. `profor_2022_pad_alteracoes`

Relação conceitual:

```text
profor_2022_pad_atualizacoes
           |
           | 1:N
           v
profor_2022_pad_snapshots
  - ANTES
  - DEPOIS

profor_2022_pad_atualizacoes
           |
           | 1:N
           v
profor_2022_pad_alteracoes
  - NOVO
  - REMOVIDO
  - ALTERADO
```

Não usar `historico_alteracoes` como tabela principal desta funcionalidade.

`historico_alteracoes` é histórico genérico de campos de outras telas e não contém:

- agrupamento por execução;
- snapshot completo;
- identidade material;
- inclusão/remoção;
- relação antes/depois;
- contexto de atualização Transferegov.

Também não usar apenas `logs_operacionais`.

Os logs permanecem como auditoria de evento, mas não substituem o histórico estruturado.

---

# 5. Migration do Supabase/Postgres

Criar uma nova migration em:

`supabase/migrations/`

Usar o padrão de timestamp já adotado pelo projeto no momento da execução.

Não inventar nome fora da convenção real.

Nome lógico sugerido:

`create_profor_2022_pad_historico`

---

## 5.1. Tabela `profor_2022_pad_atualizacoes`

Finalidade: representar **uma execução completa** da atualização PAD/Transferegov.

Schema alvo:

```sql
CREATE TABLE IF NOT EXISTS public.profor_2022_pad_atualizacoes (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,

  job_id text,
  origem text NOT NULL DEFAULT 'TRANSFEREGOV',

  status text NOT NULL,
  resultado text,

  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,

  total_itens_antes integer,
  total_itens_depois integer,

  total_novos integer NOT NULL DEFAULT 0,
  total_removidos integer NOT NULL DEFAULT 0,
  total_alterados integer NOT NULL DEFAULT 0,

  total_valor_previsto_antes numeric(18,2),
  total_valor_previsto_depois numeric(18,2),
  delta_valor_previsto numeric(18,2),

  total_valor_executado_antes numeric(18,2),
  total_valor_executado_depois numeric(18,2),
  delta_valor_executado numeric(18,2),

  total_saldo_antes numeric(18,2),
  total_saldo_depois numeric(18,2),
  delta_saldo numeric(18,2),

  tem_pendencias_revisao boolean NOT NULL DEFAULT false,
  total_pendencias_revisao integer NOT NULL DEFAULT 0,

  versao_snapshot text,
  versao_comparador text,

  mensagem_erro text,
  metadados_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_profor_2022_pad_atualizacoes_status
    CHECK (status IN ('EM_EXECUCAO', 'CONCLUIDA', 'FALHOU')),

  CONSTRAINT ck_profor_2022_pad_atualizacoes_resultado
    CHECK (
      resultado IS NULL
      OR resultado IN ('SEM_ALTERACOES', 'COM_ALTERACOES')
    )
);
```

### Regras

- `job_id` deve receber o `jobId` do `GerenciadorAtualizacaoTransferegov`.
- uma execução sem mudança:
  - `status = 'CONCLUIDA'`;
  - `resultado = 'SEM_ALTERACOES'`;
  - contagens de alteração = 0.
- uma execução com mudanças:
  - `status = 'CONCLUIDA'`;
  - `resultado = 'COM_ALTERACOES'`.
- erro:
  - `status = 'FALHOU'`;
  - `resultado = NULL`;
  - `mensagem_erro` sanitizada.
- não armazenar stack completa em campo destinado à interface.
- stack técnica, se necessária, permanece em log operacional sanitizado.

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_atualizacoes_iniciado
  ON public.profor_2022_pad_atualizacoes (iniciado_em DESC);

CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_atualizacoes_job
  ON public.profor_2022_pad_atualizacoes (job_id);

CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_atualizacoes_resultado
  ON public.profor_2022_pad_atualizacoes (resultado);
```

---

## 5.2. Tabela `profor_2022_pad_snapshots`

Finalidade: guardar o estado completo imutável imediatamente **ANTES** e **DEPOIS** da execução.

Schema alvo:

```sql
CREATE TABLE IF NOT EXISTS public.profor_2022_pad_snapshots (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,

  atualizacao_id bigint NOT NULL,
  momento text NOT NULL,

  checksum text NOT NULL,
  versao_snapshot text,
  parser_versao text,
  origem text,

  gerado_em timestamptz NOT NULL,
  snapshot_json jsonb NOT NULL,
  resumo_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  criado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_profor_2022_pad_snapshot_atualizacao
    FOREIGN KEY (atualizacao_id)
    REFERENCES public.profor_2022_pad_atualizacoes(id)
    ON DELETE RESTRICT,

  CONSTRAINT ck_profor_2022_pad_snapshot_momento
    CHECK (momento IN ('ANTES', 'DEPOIS')),

  CONSTRAINT uq_profor_2022_pad_snapshot_momento
    UNIQUE (atualizacao_id, momento)
);
```

### Regra crítica

**Não criar `UNIQUE(checksum)`.**

Em uma atualização sem alterações, os snapshots `ANTES` e `DEPOIS` podem e devem ter o mesmo checksum.

Eles continuam sendo dois eventos históricos distintos dentro de uma mesma execução.

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_snapshots_atualizacao
  ON public.profor_2022_pad_snapshots (atualizacao_id);

CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_snapshots_checksum
  ON public.profor_2022_pad_snapshots (checksum);
```

---

## 5.3. Tabela `profor_2022_pad_alteracoes`

Finalidade: armazenar cada divergência material entre snapshots.

Schema alvo:

```sql
CREATE TABLE IF NOT EXISTS public.profor_2022_pad_alteracoes (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,

  atualizacao_id bigint NOT NULL,
  chave_alteracao text NOT NULL,

  tipo text NOT NULL,

  numero_convenio text,
  uf text,

  chave_item_anterior text,
  chave_item_nova text,

  origem_pareamento text,

  descricao_anterior text,
  descricao_nova text,

  area_anterior text,
  area_nova text,

  natureza_anterior text,
  natureza_nova text,

  classificacao_estado text NOT NULL DEFAULT 'NAO_APLICAVEL',

  revisao_divergencia_id bigint,
  decisao_substituto_id bigint,

  campos_alterados_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_anterior_json jsonb,
  item_novo_json jsonb,

  criado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_profor_2022_pad_alteracao_atualizacao
    FOREIGN KEY (atualizacao_id)
    REFERENCES public.profor_2022_pad_atualizacoes(id)
    ON DELETE RESTRICT,

  CONSTRAINT ck_profor_2022_pad_alteracao_tipo
    CHECK (tipo IN ('NOVO', 'REMOVIDO', 'ALTERADO')),

  CONSTRAINT ck_profor_2022_pad_classificacao_estado
    CHECK (
      classificacao_estado IN (
        'NAO_APLICAVEL',
        'PRESERVADA',
        'HERDADA_SUBSTITUTO',
        'PENDENTE_REVISAO'
      )
    ),

  CONSTRAINT uq_profor_2022_pad_alteracao_chave
    UNIQUE (atualizacao_id, chave_alteracao)
);
```

### `chave_alteracao`

Criar uma chave estável no service.

Ela deve ser determinística e derivada de:

- tipo;
- chave anterior;
- chave nova;
- convênio;
- UF;
- conjunto de campos alterados.

Usar hash criptográfico já disponível no Node (`node:crypto`).

Objetivo:

- idempotência;
- impedir gravação duplicada se a finalização for repetida;
- permitir recuperação segura.

Não substituir `hashItem`.

---

## 5.4. Foreign keys opcionais

Antes de criar FK para:

- `revisao_divergencia_id`;
- `decisao_substituto_id`;

confirmar nomes, tipos e schema reais nas migrations vigentes.

Se a FK puder ser criada com segurança, criar.

Caso haja incompatibilidade histórica ou risco de migration, manter bigint indexado sem FK formal e documentar a relação operacional em `schema-banco.md`.

Não adivinhar.

---

## 5.5. RLS

As três tabelas pertencem ao schema `public`.

Como o acesso será backend-only via `DATABASE_URL`:

1. habilitar RLS;
2. **não criar policy genérica `allow all`**;
3. não disponibilizar leitura direta a `anon`;
4. não disponibilizar escrita direta a `authenticated`;
5. seguir exatamente o padrão de grants/revokes das migrations atuais.

Exemplo conceitual:

```sql
ALTER TABLE public.profor_2022_pad_atualizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profor_2022_pad_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profor_2022_pad_alteracoes ENABLE ROW LEVEL SECURITY;
```

O backend continuará acessando pelo mecanismo atual de conexão direta.

---

# 6. Novo repositório de persistência

Criar:

`backend/services/profor-2022/profor-pad-historico-repository.js`

Responsabilidade exclusiva:

- SQL;
- leitura;
- inserção;
- atualização do status da execução;
- paginação/filtros de histórico.

Não colocar regra de negócio de comparação nesse arquivo.

---

## 6.1. Funções mínimas sugeridas

```js
async function criarAtualizacao(executor, dados)
async function concluirAtualizacao(executor, id, dados)
async function falharAtualizacao(executor, id, dados)

async function inserirSnapshot(executor, dados)
async function inserirAlteracoes(executor, alteracoes)

async function buscarAtualizacaoPorId(id)
async function listarAtualizacoesPorMes({ mes })
async function listarAtualizacoesPorData({ data, uf, convenio, tipo, area })
async function buscarDetalheAtualizacao(id)
```

O parâmetro `executor` deve aceitar:

- pool/client padrão;
- client transacional vindo de `withTransaction`.

Reutilizar o padrão real de `backend/db/postgres-client.js`.

---

# 7. Novo service de histórico

Criar:

`backend/services/profor-2022/profor-pad-historico-service.js`

Responsabilidades:

- abrir a execução histórica;
- gerar estado canônico;
- persistir snapshot ANTES;
- executar o motor atual;
- gerar snapshot DEPOIS;
- comparar;
- normalizar diferenças;
- consultar memória/classificação;
- persistir alterações;
- fechar a execução;
- montar objetos seguros para API.

Não executar SQL direto fora do repository, salvo padrão já adotado pelo projeto que justifique o contrário.

---

# 8. Construção do estado completo para o histórico

Este é um ponto crítico.

O histórico **não pode registrar apenas `planoAplicacaoReconstruido`**, porque itens novos sem rateio podem não estar presentes nesse array.

Caso isso aconteça, a funcionalidade esconderia precisamente o item novo que precisa de revisão.

Portanto, criar no histórico uma função conceitualmente semelhante a:

```js
function montarPlanoCompletoParaHistorico(resultadoRecarga)
```

Ela deve combinar:

1. linhas classificadas/reconstruídas;
2. itens PAD pendentes sem rateio/classificação.

---

## 8.1. Linhas classificadas

Fonte:

`resultadoRecarga.planoAplicacaoReconstruido`

Manter:

- área;
- natureza;
- quantidade;
- valores;
- descrição;
- convênio;
- UF;
- identidade já existente.

---

## 8.2. Itens pendentes

Fonte:

`resultadoRecarga.pendenciasRevisao`

Incluir no snapshot apenas pendências que representem efetivamente item PAD atual sem classificação/rateio suficiente.

Não transformar qualquer alerta técnico em item.

Para item pendente:

- preservar descrição original;
- preservar chave;
- preservar convênio;
- preservar UF;
- preservar natureza quando conhecida;
- preservar quantidade;
- preservar valor unitário;
- preservar valor previsto;
- preservar valor executado;
- usar internamente a área existente já adotada pelo projeto para não classificado, atualmente observada como:

`NAO_CLASSIFICADO`

Na interface, **não exibir `NAO_CLASSIFICADO` cru**.

Exibir:

**Classificação pendente**

---

## 8.3. Evitar duplicação

Antes de acrescentar pendência ao estado completo:

- verificar se a identidade já está presente no array reconstruído;
- usar a identidade material/chave já calculada;
- nunca duplicar um item reconhecido.

---

# 9. Geração dos snapshots

Reutilizar:

`gerarFotografiaCanonica()`

Fluxo:

```text
estado operacional atual
        |
        v
montarPlanoCompletoParaHistorico()
        |
        v
gerarFotografiaCanonica()
        |
        v
snapshot ANTES
```

Após atualização:

```text
resultadoRecarga novo
        |
        v
montarPlanoCompletoParaHistorico()
        |
        v
gerarFotografiaCanonica()
        |
        v
snapshot DEPOIS
```

---

# 10. Captura do snapshot ANTES

O snapshot ANTES deve ser obtido **antes de salvar o novo cache do Transferegov**.

A preferência é encapsular o fluxo completo em um wrapper de histórico.

Sugestão:

```js
async function executarAtualizacaoTransferegovComHistorico(opcoes = {})
```

Fluxo:

1. criar registro `EM_EXECUCAO`;
2. gerar fotografia do estado operacional atual;
3. persistir snapshot `ANTES`;
4. chamar o orquestrador atual;
5. receber `resultadoRecarga`;
6. gerar snapshot `DEPOIS`;
7. comparar;
8. persistir snapshot DEPOIS + alterações + resumo;
9. finalizar registro.

---

## 10.1. Como obter o estado atual sem mutação

Preferir reuso do carregador operacional com opções que impeçam efeitos colaterais desnecessários.

Se tecnicamente seguro no código atual:

```js
carregarPadsOperacional({
  salvarRelatorio: false,
  registrarLogOperacional: async () => {}
})
```

Objetivo:

- reconstruir o estado atual a partir do cache vigente;
- não regravar relatório;
- não gerar ruído de log.

Antes de usar esse padrão, confirmar que a função não possui outro efeito colateral.

Se houver efeito colateral não desejado, extrair **um helper puro e pequeno** do carregador atual em vez de duplicar sua lógica.

Não criar outro parser.

---

## 10.2. Regra de integridade

Se o estado ANTES não puder ser reconstruído com segurança:

**não iniciar a mutação do cache.**

A atualização deve falhar antes de substituir o estado operacional.

Mensagem sugerida:

`Não foi possível capturar o estado anterior do PAD com segurança. A atualização foi interrompida antes de alterar a base operacional.`

---

# 11. Integração com o job atual

Modificar:

`backend/services/profor-2022/profor-pad-atualizacao-transferegov-job-service.js`

Sem reescrever a classe.

O ponto de extensão preferencial é substituir a função padrão usada como orquestrador por um wrapper que adicione histórico.

Conceitualmente:

```js
const {
  atualizarPadsTransferegovComHistorico
} = require("./profor-pad-historico-service");
```

ou nome equivalente consistente com o projeto.

O `GerenciadorAtualizacaoTransferegov` deve continuar controlando:

- exclusividade;
- job;
- eventos;
- status;
- publicação;
- logs.

---

## 11.1. Associação job ↔ histórico

Assim que o job possuir `jobId`, passá-lo ao histórico.

Exemplo:

```js
orquestrador({
  jobId,
  ...
})
```

O registro em `profor_2022_pad_atualizacoes.job_id` deve ficar ligado ao job.

Adicionar no objeto público do job:

```js
registroPadId
```

ou nome semanticamente equivalente.

---

## 11.2. Status endpoint

O endpoint existente:

`GET /api/profor-2022/pad/atualizar-transferegov/status/:jobId`

deve continuar funcionando.

Acrescentar, sem quebrar campos atuais:

```json
{
  "registroPadId": 123,
  "resultadoHistorico": "COM_ALTERACOES"
}
```

quando disponível.

---

# 12. Comparador de snapshots

Modificar somente se necessário:

`backend/services/profor-2022/profor-pad-comparador-snapshots-service.js`

Atualmente o resultado usa conceito de `dry-run`.

Não duplicar o comparador para criar “comparador de histórico”.

Refatoração permitida:

```js
compararSnapshotsPad(anterior, novo, {
  modo = "dry-run"
})
```

Comportamento:

- chamadas antigas sem opções continuam exatamente como hoje;
- scripts e testes atuais continuam recebendo `modo: "dry-run"`;
- histórico chama com `modo: "historico"`.

Essa alteração deve ser retrocompatível.

---

# 13. Normalização das diferenças

Criar função no histórico:

```js
normalizarAlteracoesComparador(comparacao)
```

Mapeamento:

### item novo

```text
comparador: item_novo
histórico: NOVO
```

### item removido

```text
comparador: item_removido
histórico: REMOVIDO
```

### item alterado

```text
comparador: itensAlterados / divergência com valores
histórico: ALTERADO
```

Nunca transformar item igual em registro de alteração.

---

# 14. Campos alterados

Para `ALTERADO`, persistir em `campos_alterados_json`.

Shape sugerido:

```json
[
  {
    "campo": "quantidade",
    "antes": 10,
    "depois": 12
  },
  {
    "campo": "valorPrevisto",
    "antes": 25000,
    "depois": 30000
  }
]
```

Usar os nomes retornados/normalizados pelo comparador atual.

Não construir lista por comparação manual duplicada.

---

# 15. Política de classificação por área

O histórico observa a classificação, mas **não deve virar o motor principal de classificação**.

---

## 15.1. Item existente com identidade segura

Se o item continua sendo reconhecido:

- preservar os rateios existentes;
- preservar área;
- preservar natureza;
- marcar:

`classificacao_estado = 'PRESERVADA'`

---

## 15.2. Item alterado mas inequivocamente o mesmo material

Quando o comparador/matching atual demonstrar identidade segura:

- não criar novo item conhecido desnecessariamente;
- manter memória existente;
- preservar rateio;
- registrar mudança no histórico.

O histórico não deve interpretar mudança textual como item novo se o comparador já o pareou.

---

## 15.3. Substituto inequivocamente compatível

Se o fluxo existente já reconhecer o vínculo como substituto seguro e houver decisão/memória do tipo:

`vinculo_item_substituto`

então:

- reutilizar a decisão;
- herdar classificação apenas quando a regra atual considerar o vínculo seguro;
- marcar:

`classificacao_estado = 'HERDADA_SUBSTITUTO'`

- guardar referência ao ID da decisão quando possível.

---

## 15.4. Item novo ambíguo

Quando não houver correspondência segura:

- não atribuir Ouvidoria;
- não atribuir Corregedoria;
- não atribuir Escola;
- não usar semelhança textual isolada;
- não copiar área do item “mais parecido”.

O item entra como:

`classificacao_estado = 'PENDENTE_REVISAO'`

e deve reutilizar/criar a divergência pertinente no fluxo atual de revisão.

Na UI:

**Classificação pendente**

---

## 15.5. Item removido

A remoção no PAD:

- deve ser registrada no histórico;
- não deve apagar a memória histórica do item;
- não deve excluir automaticamente decisões antigas;
- não deve apagar rateio histórico;
- deve guardar a classificação anterior no registro `REMOVIDO`.

---

# 16. Regra C para substituições

Decisão fechada:

> vincular automaticamente somente quando o vínculo for matematicamente/semanticamente inequívoco segundo os mecanismos já existentes; encaminhar os demais casos para revisão.

Portanto:

### permitido automaticamente

- identidade material segura já reconhecida;
- pareamento determinístico do comparador;
- decisão antiga explícita de `vinculo_item_substituto`;
- mecanismo existente que classifique o candidato como `substituto_compativel` sem ambiguidade.

### proibido automaticamente

- maior similaridade textual;
- mesma palavra principal;
- valor “parecido”;
- mesmo convênio apenas;
- mesma natureza apenas;
- aproximação por IA generativa;
- fuzzy match isolado;
- “parece ser o mesmo item”.

---

# 17. Atualização sem alterações

Essa execução deve aparecer normalmente no histórico.

Fluxo:

- snapshot ANTES;
- atualização;
- snapshot DEPOIS;
- checksums iguais;
- `total_novos = 0`;
- `total_removidos = 0`;
- `total_alterados = 0`;
- `resultado = 'SEM_ALTERACOES'`.

Na tela:

```text
14:32
Atualização via Transferegov
Nenhuma alteração identificada.
```

O dia continua marcado no calendário.

---

# 18. Totais e resumo de cada execução

Persistir e exibir:

- total de itens antes;
- total de itens depois;
- quantidade de itens novos;
- quantidade de itens removidos;
- quantidade de itens alterados;
- valor previsto antes;
- valor previsto depois;
- variação do valor previsto;
- valor executado antes;
- valor executado depois;
- variação do executado;
- saldo antes;
- saldo depois;
- variação do saldo;
- quantidade de pendências de revisão.

Exemplo visual:

```text
568 → 570 itens

+3 novos
-1 removido
4 alterados

Valor previsto:
R$ 2.104.221,00 → R$ 2.133.550,00
Δ +R$ 29.329,00
```

Não recalcular totais no frontend se eles já estiverem disponíveis no backend.

---

# 19. API de histórico

Criar endpoints backend-only.

---

## 19.1. Resumo mensal

```http
GET /api/profor-2022/pad/historico?mes=2026-09
```

Resposta sugerida:

```json
{
  "success": true,
  "mes": "2026-09",
  "dias": [
    {
      "data": "2026-09-29",
      "totalExecucoes": 2,
      "comAlteracoes": 1,
      "semAlteracoes": 1
    }
  ]
}
```

Uso:

- calendário;
- pontos nos dias;
- contador.

---

## 19.2. Execuções de uma data

```http
GET /api/profor-2022/pad/historico?data=2026-09-29
```

Filtros opcionais:

```text
uf
convenio
tipo
area
```

Exemplo:

```http
GET /api/profor-2022/pad/historico?data=2026-09-29&uf=RN&tipo=ALTERADO
```

Resposta resumida, sem enviar snapshots completos desnecessariamente.

---

## 19.3. Detalhe de uma execução

```http
GET /api/profor-2022/pad/historico/:id
```

Resposta:

```json
{
  "success": true,
  "atualizacao": {
    "id": 123,
    "jobId": "atualizacao-pad-...",
    "iniciadoEm": "...",
    "concluidoEm": "...",
    "resultado": "COM_ALTERACOES",
    "resumo": {}
  },
  "alteracoes": [],
  "snapshots": {
    "antes": {
      "checksum": "...",
      "resumo": {}
    },
    "depois": {
      "checksum": "...",
      "resumo": {}
    }
  }
}
```

Por padrão, **não enviar `snapshot_json` integral para a tela**.

Enviar:

- metadados;
- resumo;
- alterações estruturadas.

Snapshot integral deve permanecer disponível para auditoria backend/banco, mas não precisa trafegar em toda abertura da tela.

---

# 20. Segurança das rotas de leitura

O histórico é operacional.

As rotas:

`/api/profor-2022/pad/historico`

não devem ser publicadas em JSON estático.

Elas devem existir apenas no modo backend local/API.

Não criar arquivo como:

`frontend/data/publicados/profor-2022-pad-historico.json`

Não incluir histórico no GitHub Pages.

---

# 21. Retirada da senha operacional no PROFOR 2022 local

## 21.1. Comportamento desejado

Hoje o servidor possui:

`autorizarAcaoAdminProforLocal(req, body, contexto)`

e usa `ONASP_EDIT_PASSWORD` para liberar ações PROFOR locais.

Novo comportamento:

**requisição estritamente loopback deve ser suficiente para as ações locais do PROFOR 2022.**

Conceitualmente:

```js
function autorizarAcaoAdminProforLocal(req) {
  return ehRequisicaoLocal(req);
}
```

ou implementação equivalente, preservando a estrutura atual.

---

## 21.2. Não remover proteção remota

O fluxo deve continuar:

```text
se requisição local/loopback
    permitir sem senha
senão
    validar PROFOR_ADMIN_TOKEN
    aplicar guards de endpoint
```

Não enfraquecer:

- `assertEndpointAdminPermitido`;
- `assertTokenAdminProforValido`;
- flags de endpoints remotos;
- flags de chamadas externas;
- bloqueios conservadores de produção.

---

## 21.3. Frontend

Eliminar dos fluxos PROFOR 2022:

- modal de senha;
- `prompt()` de senha;
- campo de senha;
- envio de `password`;
- envio de `senha`.

O botão de atualização deve chamar a rota diretamente no modo local.

---

## 21.4. `.env.example`

Não apagar automaticamente `ONASP_EDIT_PASSWORD` do projeto inteiro.

Outros módulos ainda podem depender dessa variável.

Ajustar apenas a documentação referente ao PROFOR 2022.

Exemplo:

```text
# ONASP_EDIT_PASSWORD permanece utilizado por módulos legados/edições que ainda
# exigem senha. As ações administrativas locais do PROFOR 2022 não dependem
# mais desta variável.
```

---

## 21.5. Fora do escopo

Não remover senha de:

- Parâmetros Mínimos;
- Orçamento 2026;
- Formalização;
- FAF 2021;
- outros módulos.

Se isso for desejado futuramente, fazer em tarefa separada.

---

# 22. Tela “Registros do PAD”

A tela deve ficar **dentro do módulo PROFOR 2022**.

Não criar novo item global no menu lateral principal.

---

## 22.1. Navegação

Na página PROFOR 2022, adicionar botão:

**Registros do PAD**

Sugestão de ícone existente Font Awesome:

`fa-clock-rotate-left`

ou equivalente já disponível.

Ao clicar:

- manter o contexto de PROFOR 2022;
- trocar para subview interna de registros;
- oferecer botão **Voltar ao PROFOR 2022**.

---

## 22.2. Estado de subview

Evitar criar rota global desnecessária.

Criar estado interno conceitual:

```js
profor2022Subview = "principal" | "registros-pad"
```

Funções sugeridas:

```js
abrirRegistrosPadProfor2022()
fecharRegistrosPadProfor2022()
carregarRegistrosPadProfor2022()
```

Adaptar nomes ao padrão real do `frontend/js/app.js`.

---

# 23. Layout da tela

Desktop:

```text
┌───────────────────────────────────────────────────────────────┐
│ Registros do PAD                         Voltar ao PROFOR 2022│
├───────────────────────────────────────┬───────────────────────┤
│                                       │                       │
│ EXECUÇÕES DO DIA                      │      CALENDÁRIO       │
│                                       │                       │
│ 09:14                                 │   Setembro 2026       │
│ +2 novos · -1 removido · 3 alterados  │   D S T Q Q S S       │
│                                       │                       │
│ [resumo]                              │       • dias          │
│ [alterações]                          │       atualizados      │
│                                       │                       │
├───────────────────────────────────────┴───────────────────────┤
```

Mobile:

- calendário passa para cima ou para baixo;
- não manter duas colunas espremidas;
- cartões “Antes/Depois” podem virar blocos verticais.

---

# 24. Calendário

Inspirar a UX no PROFOR-2026.

Funcionalidades:

- mês atual;
- mês anterior;
- mês seguinte;
- dia selecionado;
- ponto visual em dias com atualização;
- quantidade opcional de execuções;
- clique no dia carrega execuções;
- mês sem registros deve exibir estado vazio.

Estado frontend sugerido:

```js
let proforPadHistoricoMes = null;
let proforPadHistoricoDataSelecionada = null;
let proforPadHistoricoAtualizacoes = [];
let proforPadHistoricoAtualizacaoSelecionada = null;
```

Não copiar o storage file-based do PROFOR-2026.

Copiar apenas o padrão visual/comportamental.

---

# 25. Card de execução

Cada execução deve mostrar:

- horário;
- origem `Transferegov`;
- status;
- duração, se disponível;
- número de itens antes/depois;
- novos;
- removidos;
- alterados;
- pendências;
- variação financeira.

Estados:

### com alterações

```text
Atualização via Transferegov
09:14

+2 novos
-1 removido
3 alterados

[Ver detalhes]
```

### sem alterações

```text
Atualização via Transferegov
14:32

Nenhuma alteração identificada.

[Ver registro]
```

### falha

Se for decidido exibir falhas no calendário:

```text
Atualização não concluída
16:11

A operação falhou antes da consolidação do estado posterior.
```

Recomendação: exibir falhas com estilo neutro de auditoria, sem misturá-las às atualizações concluídas.

---

# 26. Filtros

Na tela de detalhe/data:

- UF;
- convênio;
- tipo:
  - Novo;
  - Removido;
  - Alterado;
- área:
  - Ouvidoria;
  - Corregedoria;
  - Escola de Serviços Penais;
  - Classificação pendente.

Os valores internos de área devem ser lidos do estado real do projeto.

Não inventar constantes internas.

---

# 27. Comparação “Antes × Depois”

## 27.1. Item alterado

Exemplo:

```text
Convênio 937216 — GO
Notebook

ANTES                         DEPOIS
Quantidade: 10                Quantidade: 12
Valor unitário: R$ 4.200      Valor unitário: R$ 4.050
Área: Ouvidoria               Área: Ouvidoria
```

Campos alterados devem receber destaque visual.

Campos iguais podem:

- ser omitidos na visão compacta; ou
- aparecer discretamente na visão expandida.

---

## 27.2. Item novo

```text
NOVO

ANTES
Item inexistente no snapshot anterior

DEPOIS
Descrição: ...
Quantidade: ...
Valor: ...
Área: Classificação pendente
```

---

## 27.3. Item removido

```text
REMOVIDO

ANTES
Descrição: ...
Área: Ouvidoria
...

DEPOIS
Item não consta mais no PAD atual
```

Não escrever que o item foi “apagado da memória”.

Apenas que está ausente no PAD atual.

---

# 28. Botão “Ver alterações” após atualização

Quando o polling do job indicar `concluido`:

- se houver `registroPadId`, mostrar botão:

**Ver alterações**

Ao clicar:

```js
abrirRegistrosPadProfor2022({ atualizacaoId: registroPadId })
```

A tela deve:

- abrir a subview;
- selecionar automaticamente a data;
- abrir a execução recém-concluída.

Mesmo quando `SEM_ALTERACOES`, o botão deve existir.

Texto aceitável:

**Ver registro**

ou:

**Ver alterações**

Preferência: manter **Ver alterações** como padrão solicitado, mesmo que o detalhe mostre que não houve mudança.

---

# 29. Fluxo completo esperado

```text
Usuário clica “Atualizar PAD”
        |
        v
POST /api/profor-2022/pad/atualizar-transferegov
        |
        v
GerenciadorAtualizacaoTransferegov cria jobId
        |
        v
Histórico cria atualização EM_EXECUCAO
        |
        v
Reconstrói estado atual
        |
        v
Gera snapshot ANTES
        |
        v
Persiste snapshot ANTES
        |
        v
Executa atualização Transferegov existente
        |
        v
Salva cache validado
        |
        v
Recarga operacional existente
        |
        v
Obtém estado completo novo
        |
        v
Gera snapshot DEPOIS
        |
        v
compararSnapshotsPad()
        |
        v
normalizarAlteracoesComparador()
        |
        v
consulta memória / decisões / revisão
        |
        v
transaction:
  snapshot DEPOIS
  alterações
  resumo da atualização
  status CONCLUIDA
        |
        v
job publica dados estáticos atuais
        |
        v
status endpoint expõe registroPadId
        |
        v
frontend mostra “Ver alterações”
```

---

# 30. Transações

Reutilizar `withTransaction` do `backend/db/postgres-client.js`, se esse for o helper vigente.

A finalização do histórico deve ser atômica:

```text
BEGIN

insert snapshot DEPOIS
insert alterações
update atualização -> CONCLUIDA

COMMIT
```

Se qualquer inserção falhar:

```text
ROLLBACK
```

O registro deve ser marcado como `FALHOU` em tentativa separada e segura.

---

# 31. Snapshot ANTES deve ser persistido antes da mutação

O snapshot ANTES não deve esperar o final da operação.

Motivo:

se a atualização falhar depois de substituir o cache, o estado anterior precisa continuar conhecido.

Fluxo:

```text
criar atualização
persistir ANTES
somente então permitir gravação do novo cache
```

---

# 32. Falhas

## 32.1. Falha antes da alteração do cache

- atualização = `FALHOU`;
- snapshot ANTES pode existir;
- snapshot DEPOIS não existe;
- alterações não existem.

---

## 32.2. Falha na extração Transferegov

Preservar comportamento atual:

- cache novo não deve ser salvo se tecnicamente inapto;
- histórico registra falha;
- estado anterior permanece.

---

## 32.3. Falha após cache atualizado

Não executar rollback destrutivo improvisado.

Registrar:

- execução `FALHOU`;
- log operacional;
- mensagem sanitizada.

A IA deve avaliar se o fluxo atual permite compensação segura sem ampliar escopo.

Não implementar cópia/restauração automática do cache sem testes específicos.

---

# 33. Concorrência

O job atual já impede duas atualizações simultâneas por chave `global`.

Preservar essa exclusividade.

Além disso, o history service deve evitar duplicidade acidental por `job_id`.

Se fizer sentido no schema real, considerar índice único parcial/constraint em `job_id`, após confirmar que um job não é legitimamente reutilizado.

Não criar segundo lock se o gerenciador atual já resolve o caso.

---

# 34. Idempotência

A persistência da finalização deve suportar retry seguro.

Mecanismos:

- `UNIQUE(atualizacao_id, momento)` para snapshots;
- `UNIQUE(atualizacao_id, chave_alteracao)` para alterações;
- atualização de status por ID;
- não criar nova execução se o mesmo `jobId` já estiver associado.

---

# 35. Logs operacionais

Manter uso de:

`backend/services/logs-operacionais-service.js`

Adicionar, se necessário, eventos específicos:

```text
profor_pad_historico_inicio
profor_pad_historico_concluido
profor_pad_historico_erro
```

Payload permitido:

- atualização ID;
- jobId;
- checksum ANTES;
- checksum DEPOIS;
- contagens;
- duração;
- total de pendências.

Não colocar:

- `DATABASE_URL`;
- token;
- senha;
- cookies;
- sessão;
- headers de autorização;
- dados do SAML;
- stack sensível.

---

# 36. Publicação estática

O histórico não é fonte de publicação.

Não alterar `frontend/data/publicados/` para armazenar os registros.

No GitHub Pages:

- botão “Registros do PAD” deve ficar oculto ou desabilitado;
- botão “Atualizar” já deve continuar indisponível;
- nenhuma chamada às rotas de histórico deve ser disparada;
- nenhum erro de console deve ocorrer.

Usar o mecanismo existente de `static-mode.js` e `data-requer-backend="true"` quando compatível.

---

# 37. Arquivos novos previstos

Criar, preferencialmente:

```text
backend/services/profor-2022/profor-pad-historico-repository.js
backend/services/profor-2022/profor-pad-historico-service.js
tests/services/profor-pad-historico.test.js
```

Migration:

```text
supabase/migrations/<timestamp>_create_profor_2022_pad_historico.sql
```

O timestamp deve ser gerado conforme o padrão real no momento da execução.

---

# 38. Arquivos que provavelmente serão modificados

Obrigatórios ou muito prováveis:

```text
backend/server.js
backend/services/profor-2022/profor-pad-atualizacao-transferegov-job-service.js
backend/services/profor-2022/profor-pad-comparador-snapshots-service.js
frontend/js/app.js
frontend/css/app.css
index.html
tests/services/profor-admin-endpoint-guard.test.js
tests/services/profor-pad-atualizacao-transferegov-orquestrador.test.js
scripts/validar-syntax.js
memoria/08_ROTAS_BANCO_API/schema-banco.md
memoria/08_ROTAS_BANCO_API/rotas.md
memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md
memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md
memoria/00_DIARIO_DE_BORDO/diario-atual.md
```

Possíveis, somente se tecnicamente necessário:

```text
backend/services/profor-2022/profor-pad-carregador-operacional-service.js
backend/services/profor-2022/profor-pad-fotografia-service.js
backend/services/profor-2022/profor-pad-revisao-repository.js
backend/services/profor-2022/profor-pad-revisao-service.js
backend/services/profor-2022/profor-pad-revisao-decisao-service.js
```

Não alterar esses últimos por conveniência.

---

# 39. Referência visual PROFOR-2026

Usar apenas como referência de UX.

Arquivos de referência:

```text
Sistema PROFOR 2026/PROFOR_2026/app.js
Sistema PROFOR 2026/PROFOR_2026/storage.js
Sistema PROFOR 2026/PROFOR_2026/workspace-store.cjs
Sistema PROFOR 2026/PROFOR_2026/styles.css
Sistema PROFOR 2026/PROFOR_2026/PROFOR_2026.html
```

Conceitos úteis:

- calendário;
- dot em dia com registro;
- agrupamento por execução;
- comparação Antes/Depois;
- painel de registros;
- navegação temporal.

Não copiar:

- persistência em `dados/registros`;
- cadeia `parent`;
- hash de arquivos como ID;
- storage baseado em JSON local.

FOMENTO deve persistir em Postgres/Supabase.

---

# 40. Não usar `historico_alteracoes` como substituto

Pode continuar existindo para outras telas.

Não alterar sua semântica.

O PAD terá histórico próprio.

Razões:

1. um item pode ser removido;
2. um item pode ser criado;
3. uma atualização possui dezenas de alterações;
4. é necessário agrupar tudo por execução;
5. é necessário guardar snapshots;
6. é necessário correlacionar com job;
7. é necessário preservar identidade material.

---

# 41. Testes obrigatórios

Executar apenas testes proporcionais, mas os cenários abaixo são críticos.

---

## 41.1. Snapshot sem alteração

Dado:

- ANTES e DEPOIS idênticos.

Esperar:

- dois snapshots;
- checksum igual;
- zero alterações;
- atualização concluída;
- resultado `SEM_ALTERACOES`;
- dia aparece no calendário.

---

## 41.2. Item novo

Esperar:

- alteração `NOVO`;
- item visível na UI;
- se sem classificação segura:
  - `PENDENTE_REVISAO`;
  - área visual “Classificação pendente”;
  - revisão existente reutilizada/criada conforme fluxo atual.

---

## 41.3. Item removido

Esperar:

- `REMOVIDO`;
- valores anteriores preservados;
- área anterior preservada;
- memória não apagada.

---

## 41.4. Item alterado

Testar pelo menos:

- quantidade;
- valor unitário;
- valor previsto;
- valor executado;
- saldo;
- descrição.

Esperar:

- um único registro `ALTERADO`;
- `campos_alterados_json` correto;
- não converter em novo + removido quando pareamento seguro existe.

---

## 41.5. Alteração apenas textual

Quando o comparador classificar como alteração textual/diacrítico:

- respeitar a classificação atual;
- não criar item novo artificial.

---

## 41.6. Preservação de área

Item reconhecido com área OUVIDORIA antes:

- alteração de quantidade não pode apagar OUVIDORIA;
- `classificacao_estado = PRESERVADA`.

Repetir com áreas existentes reais equivalentes a:

- Corregedoria;
- Escola de Serviços Penais.

Não hardcodar rótulo se o banco usar outra chave interna.

---

## 41.7. Substituto seguro

Com decisão `vinculo_item_substituto` válida:

- histórico associa;
- classificação herdada;
- `HERDADA_SUBSTITUTO`;
- decisão referenciada.

---

## 41.8. Substituto ambíguo

Dois candidatos plausíveis:

- não herdar;
- não escolher automaticamente;
- `PENDENTE_REVISAO`.

---

## 41.9. Falha antes da atualização

Simular erro antes do save do cache.

Esperar:

- `FALHOU`;
- ANTES preservado;
- ausência de DEPOIS;
- nenhuma alteração estruturada.

---

## 41.10. Retry/idempotência

Executar finalização duas vezes.

Esperar:

- sem duplicar snapshot;
- sem duplicar alteração.

---

## 41.11. Concorrência

Disparar duas atualizações.

Esperar comportamento atual:

- primeira aceita;
- segunda recebe job já em andamento/409;
- não cria duas execuções históricas concorrentes para o mesmo job lógico.

---

# 42. Testes de autenticação

Atualizar:

`tests/services/profor-admin-endpoint-guard.test.js`

Cenários:

### local

Requisição loopback:

- sem `password`;
- sem `senha`;
- rota PROFOR 2022 permitida.

### remoto sem token

- continua bloqueado.

### remoto com token inválido

- continua bloqueado.

### remoto com token válido e flags permitidas

- preserva comportamento atual.

### produção

- preservar bloqueios conservadores já existentes.

---

# 43. Testes de frontend

Cobrir, quando possível:

1. botão Registros do PAD aparece no modo local;
2. botão fica indisponível no estático;
3. calendário carrega;
4. dia com atualização recebe marcador;
5. clique em dia carrega execuções;
6. execução sem mudança é exibida;
7. execução com mudança abre detalhe;
8. novo item mostra Antes ausente;
9. removido mostra Depois ausente;
10. alterado mostra Antes/Depois;
11. classificação pendente aparece corretamente;
12. filtros funcionam;
13. botão “Ver alterações” após update abre registro correto;
14. navegação de volta funciona;
15. mobile não gera overflow horizontal indevido.

---

# 44. Validações técnicas finais

Executar conforme disponibilidade do projeto:

```bash
npm run validar:syntax
npm run validar:services
```

Rodar testes focados primeiro.

Exemplos:

```bash
node --test tests/services/profor-pad-historico.test.js
node --test tests/services/profor-pad-comparador-snapshots.test.js
node --test tests/services/profor-pad-atualizacao-transferegov-orquestrador.test.js
node --test tests/services/profor-admin-endpoint-guard.test.js
```

Depois, se custo aceitável:

```bash
npm run validar:services
```

Também:

```bash
git diff --check
```

Não executar `npm run publicar:dados` apenas por hábito.

Executar somente se a alteração realmente exigir regeneração pública.

Este histórico não deve exigir.

---

# 45. Validação manual mínima

## backend

1. iniciar aplicação;
2. abrir PROFOR 2022;
3. executar atualização sem senha;
4. acompanhar progresso;
5. confirmar conclusão;
6. clicar Ver alterações;
7. validar registro criado no banco;
8. recarregar navegador;
9. confirmar que histórico persiste.

---

## banco

Confirmar:

```text
1 linha em profor_2022_pad_atualizacoes
2 linhas em profor_2022_pad_snapshots
N linhas em profor_2022_pad_alteracoes
```

Para atualização sem mudança:

```text
1 atualização
2 snapshots
0 alterações
```

---

# 46. Critérios de aceite funcionais

A tarefa só está concluída quando todos os itens abaixo forem verdadeiros.

- [ ] Existe uma tela interna “Registros do PAD” dentro do PROFOR 2022.
- [ ] Existe botão para abrir a tela a partir do PROFOR 2022.
- [ ] Existe botão “Ver alterações” após atualização.
- [ ] Atualização local não pede senha.
- [ ] Segurança remota por token continua existente.
- [ ] Cada execução gera registro permanente.
- [ ] Execução sem mudança também gera registro.
- [ ] Snapshot ANTES é persistido.
- [ ] Snapshot DEPOIS é persistido.
- [ ] Novo item é detectado.
- [ ] Item removido é detectado.
- [ ] Item alterado é detectado.
- [ ] Campos alterados são exibidos Antes/Depois.
- [ ] Histórico conserva convênio e UF.
- [ ] Histórico conserva área anterior.
- [ ] Classificação existente não é perdida.
- [ ] Substituto seguro pode herdar classificação.
- [ ] Substituto ambíguo não é classificado automaticamente.
- [ ] Item novo ambíguo aparece como Classificação pendente.
- [ ] Registros persistem após reinício do backend.
- [ ] Histórico não depende do estado em memória do job.
- [ ] GitHub Pages não recebe histórico operacional.
- [ ] Nenhum token/senha é exposto no frontend.
- [ ] RLS permanece coerente com backend-only.
- [ ] Testes críticos passam.
- [ ] Documentação técnica é atualizada.

---

# 47. Critérios de aceite de integridade

- [ ] Nenhum histórico antigo é sobrescrito.
- [ ] Nenhum registro histórico é apagado durante atualização normal.
- [ ] Não existe `DELETE` automático das três novas tabelas.
- [ ] Não existe `UPDATE` do conteúdo de snapshot após persistido.
- [ ] Apenas status/resumo da execução pode ser finalizado.
- [ ] Snapshot integral permanece imutável.
- [ ] Alterações permanecem imutáveis.
- [ ] `checksum` não é usado como unicidade global.
- [ ] Retry não duplica dados.
- [ ] Comparador existente continua passando testes antigos.

---

# 48. Regras de imutabilidade

Após inserir:

`profor_2022_pad_snapshots`

não executar UPDATE do payload.

Após inserir:

`profor_2022_pad_alteracoes`

não executar UPDATE do conteúdo histórico.

O único objeto mutável durante uma execução é:

`profor_2022_pad_atualizacoes`

e somente enquanto transita:

```text
EM_EXECUCAO
   ->
CONCLUIDA
```

ou:

```text
EM_EXECUCAO
   ->
FALHOU
```

Depois de concluída, tratar como registro histórico.

---

# 49. Retenção

Não implementar:

- TTL;
- limpeza automática;
- purge mensal;
- compactação destrutiva;
- exclusão após X dias.

Retenção é indefinida.

Se no futuro houver necessidade de arquivamento, será outra tarefa.

---

# 50. Performance

Volume esperado é baixo/moderado.

Não antecipar micro-otimizações.

Índices devem cobrir:

- data;
- job;
- atualização;
- UF;
- convênio;
- tipo.

Para `profor_2022_pad_alteracoes`:

```sql
CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_alt_atualizacao
  ON public.profor_2022_pad_alteracoes (atualizacao_id);

CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_alt_uf
  ON public.profor_2022_pad_alteracoes (uf);

CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_alt_convenio
  ON public.profor_2022_pad_alteracoes (numero_convenio);

CREATE INDEX IF NOT EXISTS idx_profor_2022_pad_alt_tipo
  ON public.profor_2022_pad_alteracoes (tipo);
```

Não criar GIN em JSONB sem necessidade medida.

---

# 51. Datas e timezone

Persistir datas em `timestamptz`.

Backend/API retorna ISO 8601.

Frontend exibe no timezone do usuário.

Agrupamento de calendário deve seguir o timezone operacional usado pela interface, evitando que uma atualização perto da meia-noite apareça no dia errado.

Como o projeto é utilizado no Brasil, não converter ingenuamente `YYYY-MM-DD` usando UTC sem verificar o timezone local.

Criar helper centralizado de data do histórico no frontend.

---

# 52. Sanitização de erros

API não deve retornar:

- stack completa;
- SQL;
- URL com credencial;
- headers;
- token;
- cookie;
- dados de sessão.

Resposta:

```json
{
  "success": false,
  "message": "Não foi possível carregar o histórico do PAD."
}
```

Detalhes técnicos ficam em logs internos sanitizados.

---

# 53. Compatibilidade retroativa

A implementação não deve quebrar:

- `GET /api/profor-2022/consolidado`;
- atualização DETRU;
- atualização de rendimentos;
- recarga PAD;
- recarga operacional;
- tela Revisão de divergências;
- publicação atual;
- relatórios existentes;
- scripts dry-run;
- testes do comparador.

---

# 54. Mudança mínima no comparador

Se `modo: "dry-run"` estiver hardcoded, alterar apenas a forma de montar metadado.

Exemplo:

```js
function compararSnapshotsPad(snapshotAnterior, snapshotNovo, opcoes = {}) {
  const modo = opcoes.modo || "dry-run";

  // lógica existente intacta

  return {
    modo,
    ...
  };
}
```

Não alterar algoritmos de pareamento sem teste que prove necessidade para esta funcionalidade.

---

# 55. Documentação do banco

Atualizar:

`memoria/08_ROTAS_BANCO_API/schema-banco.md`

Adicionar seção exclusiva:

```text
PROFOR 2022 — histórico de atualização PAD
```

Documentar:

- tabelas;
- finalidade;
- colunas;
- constraints;
- índices;
- relação;
- RLS;
- backend-only;
- retenção;
- imutabilidade.

---

# 56. Documentação das rotas

Atualizar:

`memoria/08_ROTAS_BANCO_API/rotas.md`

Adicionar:

```text
GET /api/profor-2022/pad/historico
GET /api/profor-2022/pad/historico/:id
```

Registrar:

- parâmetros;
- resposta;
- modo local/API;
- ausência de publicação estática;
- segurança.

Atualizar a documentação da rota de atualização para indicar:

- não exige senha quando chamada localmente em loopback;
- remoto continua tokenizado;
- gera registro permanente no histórico.

---

# 57. Documentação PROFOR 2022

Atualizar:

`memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022.md`

Adicionar:

- histórico do PAD;
- snapshots;
- calendário;
- antes/depois;
- regra de classificação;
- integração com revisão.

Atualizar:

`memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md`

Remover afirmação de que a interface local do PROFOR 2022 exige senha operacional.

Substituir por:

- loopback autorizado diretamente;
- chamadas não locais exigem token;
- outros módulos podem continuar usando senha.

---

# 58. Diário de bordo

Ao final:

`memoria/00_DIARIO_DE_BORDO/diario-atual.md`

Registrar:

- data;
- branch;
- arquivos;
- migrations;
- comportamento;
- testes;
- riscos;
- rollback.

---

# 59. Rollback

Rollback de código:

1. remover navegação/tela;
2. remover rotas de leitura;
3. restaurar integração anterior do job;
4. restaurar autorização local anterior apenas se explicitamente necessário.

**Não apagar dados históricos como parte do rollback normal.**

As tabelas podem permanecer sem uso.

Drop de tabelas só deve ocorrer com decisão explícita e backup.

---

# 60. Fora do escopo

Não fazer nesta tarefa:

- histórico do DETRU;
- histórico de rendimentos;
- histórico do PROFOR 2026;
- histórico de outros programas;
- autenticação completa de usuários;
- cadastro de usuários;
- login;
- RBAC;
- Supabase Auth;
- migração do backend para Edge Functions;
- novo framework frontend;
- React/Vue/Svelte;
- ORM;
- substituição do Node HTTP server;
- reformulação visual geral;
- refatoração estética de todo `app.js`;
- refatoração estética do banco;
- remoção global de senha dos demais módulos;
- publicação do histórico no GitHub Pages;
- classificação de item via IA.

---

# 61. Proibições explícitas para a IA executora

A IA NÃO deve:

1. criar um banco SQLite novo;
2. usar `backend/db/init-db.js` como banco operacional;
3. criar tabela genérica duplicando `historico_alteracoes`;
4. substituir `profor_2022_item_rateios`;
5. apagar memória de item removido;
6. classificar item por “parecido”;
7. criar uma IA para decidir área;
8. substituir o comparador atual;
9. fazer refactor geral do frontend;
10. alterar regras de outros módulos;
11. versionar `.env`;
12. versionar tokens;
13. versionar cache sensível;
14. publicar snapshots no GitHub Pages;
15. rodar publicação estática sem necessidade;
16. remover guards remotos;
17. remover `PROFOR_ADMIN_TOKEN`;
18. abrir rotas administrativas para rede externa sem autorização;
19. criar dependência npm nova sem necessidade objetiva;
20. sobrescrever registros históricos antigos.

---

# 62. Estratégia de execução por etapas, modelos e economia de tokens

Esta implementação será executada potencialmente em **harnesses diferentes, com modelos diferentes e em sessões independentes**. Por isso, a execução NÃO deve ser tratada como uma tarefa monolítica.

O objetivo desta seção é permitir que cada agente execute apenas uma parcela bem delimitada do trabalho, usando o modelo menos caro que preserve a confiabilidade necessária para aquela etapa.

## 62.1. Princípio central de economia

A maior fonte de desperdício não é o preço nominal do modelo. É a repetição de contexto.

Cada nova sessão NÃO deve:

- reler todo o repositório;
- reler toda a pasta `memoria/`;
- reabrir todos os arquivos mencionados neste documento;
- redescobrir decisões já fechadas;
- refazer a arquitetura;
- executar novamente testes que não são afetados pela etapa;
- pedir ao modelo para produzir explicações extensas quando a tarefa é apenas implementar;
- enviar o `git diff` completo quando apenas 2 ou 3 arquivos são relevantes.

Cada etapa deve receber somente:

1. objetivo daquela etapa;
2. critérios de aceite daquela etapa;
3. seção pertinente deste plano;
4. arquivo de estado/handoff da implementação;
5. arquivos reais estritamente necessários;
6. diff produzido pela etapa imediatamente anterior, quando houver dependência direta;
7. testes específicos que precisam passar.

---

## 62.2. Hierarquia de modelos para este projeto

### GPT-6 Luna

Usar como **worker padrão de baixo custo** para tarefas focadas, leitura, inspeção, testes, documentação, rotas simples e patches pequenos.

Preferência de effort:

- `low`: tarefa mecânica, documentação, atualização de testes simples;
- `medium`: pequena alteração de código com alguma lógica;
- `high`: inspeção ampla ou implementação que exige acompanhar várias referências, mas não redesenhar arquitetura;
- evitar `xhigh` e `max` neste projeto salvo falha comprovada em tarefa específica.

### GPT-6 Sol

Usar quando houver invariantes entre várias camadas ou risco real de erro lógico.

Casos principais neste projeto:

- migrations e integridade referencial;
- transações;
- snapshots ANTES/DEPOIS;
- comparação e persistência atômica;
- integração com o job assíncrono;
- preservação da memória de classificação;
- tratamento de falhas e idempotência.

Preferência de effort:

- `medium`: padrão;
- `high`: somente nas etapas com transação, snapshots ou matching/classificação;
- `xhigh`/`max`: não usar por padrão.

### GPT-6 Astra

Reservar para **auditoria crítica**, não para execução rotineira.

Neste projeto, o uso recomendado é de no máximo uma ou duas sessões curtas:

- revisão final do desenho de persistência/transação, se necessário;
- revisão final do diff consolidado antes de considerar a feature pronta.

Preferência de effort:

- `low`: padrão e suficiente para revisão estrutural;
- `medium`: somente se a auditoria encontrar conflito arquitetural real;
- não usar `high`, `xhigh` ou `max` por padrão.

Astra NÃO deve reler o repositório inteiro e NÃO deve reimplementar a feature. Deve receber um pacote pequeno de revisão.

### Muse Spark 1.3

Usar como worker econômico para implementação agentic delimitada, especialmente:

- frontend;
- integração de UI;
- alterações multi-arquivo claramente especificadas;
- refatoração localizada que já tenha arquitetura fechada.

Preferência:

- `standard`/`normal`: padrão;
- `max`: somente se o harness não conseguir completar uma etapa delimitada após uma tentativa normal.

### DeepSeek 4.1 Flash

Usar para tarefas de execução mecânica e baixo risco, por exemplo:

- pequeno patch isolado;
- CTA;
- ajuste de IDs/DOM;
- teste unitário simples;
- atualização de documentação técnica;
- correção localizada indicada por outro modelo.

Não usar como modelo principal para decidir:

- arquitetura de banco;
- RLS;
- transações;
- identidade de item;
- lógica de substituição;
- classificação por área;
- estratégia de rollback.

Usar effort `normal/default`. Aumentar somente se o próprio harness oferecer nível de raciocínio e a tarefa continuar estritamente delimitada.

### Gemini 3.8 Flash

Tratar como **fallback de grande contexto**, especialmente se a franquia dos modelos OpenAI estiver esgotada ou se for conveniente revisar vários arquivos em uma única sessão.

Preferência:

- `medium`: padrão;
- `low`: inspeção ou tarefa mecânica;
- `high`: somente para uma falha concreta em tarefa complexa;
- não usar `high` por hábito.

Para este projeto, não é necessário usá-lo se Luna/Sol estiverem disponíveis e suficientes.

---

## 62.3. Regra de escalonamento de effort

Nunca iniciar uma etapa em effort máximo.

Usar esta sequência:

```text
1. executar no modelo/effort recomendado;
2. verificar critérios de aceite e testes;
3. se falhar por erro de implementação simples -> corrigir no mesmo modelo/effort;
4. se falhar por raciocínio insuficiente -> aumentar UM nível de effort;
5. se persistir conflito arquitetural -> escalar para Sol;
6. usar Astra apenas para revisão/diagnóstico crítico, não como worker permanente.
```

Não repetir a mesma tarefa inteira em vários modelos “para conferir”.

Se uma etapa passou nos testes e cumpriu o contrato, seguir adiante.

---

## 62.4. Arquivo de handoff entre harnesses

Na primeira etapa de implementação, criar na raiz do repositório o arquivo temporário/operacional:

```text
REGISTROS_PAD_IMPLEMENTACAO_STATUS.md
```

Esse arquivo deve ser curto e funcionar como memória entre sessões.

Estrutura obrigatória:

```md
# Estado da implementação — Registros do PAD / PROFOR 2022

## Última etapa concluída
Etapa N — nome

## Commit/estado
- branch:
- último commit relevante:
- working tree:

## Implementado
- ...

## Arquivos criados
- ...

## Arquivos modificados
- ...

## Migration
- nome:
- aplicada/testada: sim/não

## Testes já executados
- comando — resultado

## Decisões confirmadas durante a execução
- ...

## Pendências objetivas para a próxima etapa
- ...

## Não mexer
- ...
```

Regras:

- máximo recomendado: aproximadamente 120 linhas;
- não copiar grandes trechos de código;
- não copiar este plano inteiro;
- não inserir logs extensos;
- não inserir tokens, senhas ou credenciais;
- cada agente atualiza somente o estado factual da execução;
- o agente seguinte deve ler esse arquivo antes de abrir arquivos adicionais;
- ao final da implementação, o conteúdo relevante pode ser consolidado no diário e o arquivo pode ser removido se não houver utilidade permanente.

---

## 62.5. Regra de contexto para cada nova sessão

Prompt de abertura conceitual para qualquer harness:

```text
Você está executando somente a Etapa N do plano PLANO_REGISTROS_PAD_PROFOR_2022.md.
Não redesenhe a feature e não avance para outras etapas.
Leia AGENTS.md, REGISTROS_PAD_IMPLEMENTACAO_STATUS.md, apenas a seção N do plano e os arquivos explicitamente listados para esta etapa.
Reutilize a arquitetura existente.
Faça o menor patch suficiente.
Execute apenas os testes indicados.
Ao final, atualize REGISTROS_PAD_IMPLEMENTACAO_STATUS.md com fatos objetivos para o próximo agente.
```

A IA não deve carregar o plano completo na conversa quando o harness permitir leitura seletiva por arquivo/trecho.

---

## 62.6. Matriz resumida de execução

| Etapa | Trabalho | Modelo principal | Effort | Alternativa econômica | Escalar somente se |
| --- | --- | --- | --- | --- | --- |
| 0 | Preparação/handoff | GPT-6 Luna | low | DeepSeek 4.1 Flash normal | houver conflito no estado do repo |
| 1 | Inspeção dirigida | GPT-6 Luna | high | Gemini 3.8 Flash medium | arquitetura real divergir deste plano |
| 2 | Migration/schema/RLS | GPT-6 Sol | medium | Muse Spark 1.3 standard | constraints/transação exigirem revisão |
| 3 | Repository de histórico | GPT-6 Sol | medium | Muse Spark 1.3 standard | persistência fugir do padrão atual |
| 4 | Serviço de histórico/snapshots | GPT-6 Sol | high | nenhum worker barato por padrão | invariantes não fecharem |
| 5 | Estado completo do snapshot | GPT-6 Sol | high | GPT-6 Luna high | item novo/pendente desaparecer do estado |
| 6 | Memória/classificação/substitutos | GPT-6 Sol | high | GPT-6 Luna high | surgir ambiguidade não coberta |
| 7 | Job + atomicidade + falhas | GPT-6 Sol | high | nenhum worker barato por padrão | ordem ANTES/DEPOIS não puder ser garantida |
| 8 | Remoção da senha local PROFOR | GPT-6 Luna | medium | DeepSeek 4.1 Flash normal | guard remoto for afetado |
| 9 | APIs de leitura do histórico | GPT-6 Luna | medium | DeepSeek 4.1 Flash normal | filtros exigirem consulta complexa |
| 10 | Tela Registros do PAD | Muse Spark 1.3 | standard | GPT-6 Luna high | estado/UI ficar difícil de integrar |
| 11 | CTA “Ver alterações” | DeepSeek 4.1 Flash | normal | GPT-6 Luna low | alterar polling/job além do previsto |
| 12 | Testes integrados e regressão focada | GPT-6 Luna | high | Gemini 3.8 Flash medium | falha indicar bug cross-layer |
| 13 | Auditoria final | GPT-6 Astra | low | GPT-6 Sol high | auditoria encontrar risco crítico real |
| 14 | Documentação/commit/finalização | GPT-6 Luna | low | DeepSeek 4.1 Flash normal | documentação revelar inconsistência técnica |

---

## 62.7. Etapa 0 — preparação da execução

### Modelo

`GPT-6 Luna / low`

### Objetivo

Preparar a branch e o mecanismo de handoff sem alterar regra de negócio.

### Ler

- `AGENTS.md`;
- `memoria/INDEX.md`;
- seção 62 deste plano;
- `git status`;
- lista de migrations atuais apenas para identificar convenção de nome.

### Fazer

1. confirmar branch de trabalho;
2. confirmar working tree;
3. criar `REGISTROS_PAD_IMPLEMENTACAO_STATUS.md`;
4. registrar baseline factual;
5. não alterar código funcional.

### Critério de aceite

- handoff criado;
- nenhuma alteração funcional;
- estado inicial claramente registrado.

### Tokens

Muito baixo. Não usar Sol/Astra.

---

## 62.8. Etapa 1 — inspeção dirigida e confirmação do mapa real

### Modelo

`GPT-6 Luna / high`

### Alternativa

`Gemini 3.8 Flash / medium` se for necessário abrir muitos arquivos em uma única janela de contexto ou se a franquia OpenAI estiver indisponível.

### Objetivo

Confirmar somente os pontos necessários para as próximas etapas. Não implementar.

### Ler

- documentos obrigatórios do item 2.2 deste plano;
- migrations atuais relacionadas a PROFOR/RLS;
- `backend/db/postgres-client.js`;
- `backend/db/preparar-banco.js`;
- `backend/server.js` nos blocos PROFOR 2022;
- `profor-pad-atualizacao-transferegov-job-service.js`;
- `profor-pad-atualizacao-transferegov-orquestrador-service.js`;
- `profor-pad-carregador-operacional-service.js`;
- snapshot/comparador/revisão/rateios;
- blocos PROFOR 2022 do frontend;
- testes diretamente relacionados.

### Produzir

No handoff, registrar apenas:

- convenção real de migration;
- funções concretas que serão reutilizadas;
- pontos exatos de integração;
- valores internos reais das áreas;
- eventuais diferenças entre código atual e este plano.

### Critério de aceite

Nenhuma decisão arquitetural nova se o código confirmar o plano.

### Regra de economia

Não produzir relatório narrativo extenso. O produto da etapa é o handoff factual.

---

## 62.9. Etapa 2 — migration das tabelas de histórico

### Modelo

`GPT-6 Sol / medium`

### Alternativa

`Muse Spark 1.3 / standard` somente se a migration estiver integralmente especificada e o padrão de migrations já tiver sido confirmado na Etapa 1.

### Objetivo

Criar as tabelas, constraints, índices e RLS definidos neste plano.

### Ler

Somente:

- migration imediatamente anterior relevante;
- migration que implementa padrão RLS aplicável;
- `schema-banco.md` na seção pertinente;
- seções deste plano sobre tabelas, imutabilidade e RLS;
- handoff.

### Fazer

- migration;
- constraints;
- índices;
- RLS conforme padrão real;
- sem service/frontend.

### Testes

- validação sintática SQL/migration conforme tooling do repo;
- inspeção de diff;
- teste mínimo de criação se houver infraestrutura segura para isso.

### Critério de aceite

Schema suficiente para persistir snapshots, execuções e alterações sem expor Data API publicamente.

### Revisão Astra

Não usar Astra aqui por padrão. Deixar a revisão de arquitetura consolidada para a Etapa 13.

---

## 62.10. Etapa 3 — repository de histórico

### Modelo

`GPT-6 Sol / medium`

### Alternativa

`Muse Spark 1.3 / standard`.

### Objetivo

Implementar a persistência Postgres isolada, sem acoplar ainda ao job.

### Arquivos esperados

Preferencialmente:

```text
backend/services/profor-2022/profor-pad-historico-repository.js
```

ou nome equivalente consistente com a arquitetura real.

### Fazer

- insert de snapshot;
- insert de atualização;
- insert em lote de alterações;
- leitura de calendário/resumo;
- leitura de execução/detalhe;
- funções transacionais aceitando executor/client quando necessário;
- nenhuma regra nova de matching.

### Testes

Repository com client mock ou padrão atual de teste Postgres.

### Critério de aceite

Camada de persistência utilizável sem conhecer frontend ou job.

---

## 62.11. Etapa 4 — serviço de histórico e snapshots ANTES/DEPOIS

### Modelo

`GPT-6 Sol / high`

### Objetivo

Implementar a camada central da feature.

### Fazer

- criar registro de execução;
- materializar snapshot ANTES;
- materializar snapshot DEPOIS;
- chamar o comparador existente;
- converter resultado do comparador para alterações persistíveis;
- registrar atualização sem mudanças;
- preservar checksum/metadados;
- finalizar sucesso/falha;
- não integrar ainda ao frontend.

### Regra crítica

Não duplicar `compararSnapshotsPad()` nem o motor de identidade.

### Testes

- sem alteração;
- item novo;
- item removido;
- item alterado;
- alteração textual controlada;
- persistência dos resumos.

### Critério de aceite

Dado um estado ANTES e um DEPOIS, o serviço produz exatamente um registro histórico consistente e consultável.

---

## 62.12. Etapa 5 — composição do estado completo do snapshot

### Modelo

`GPT-6 Sol / high`

### Alternativa

`GPT-6 Luna / high` se a Etapa 1 tiver demonstrado que a composição é simples e já existe quase pronta.

### Objetivo

Eliminar o risco de o histórico enxergar apenas itens já classificados.

### Garantir

- item classificado entra;
- item com rateio entra;
- item novo sem rateio entra;
- item pendente de revisão entra;
- item removido permanece disponível no snapshot ANTES;
- linha nova sem classificação não é omitida.

### Teste obrigatório

Criar cenário em que um item novo do Transferegov não possua rateio/classificação e comprovar que ele aparece como `novo` no histórico.

### Critério de aceite

O snapshot representa o estado material do PAD, e não apenas a visão já saneada/classificada.

---

## 62.13. Etapa 6 — integração com memória de classificação e substitutos

### Modelo

`GPT-6 Sol / high`

### Objetivo

Associar o histórico às decisões já existentes sem criar classificador novo.

### Reutilizar

- `profor_2022_itens_conhecidos`;
- `profor_2022_item_rateios`;
- revisão/divergências;
- decisões existentes;
- `payloadDecisao.tipoSaneamento = "vinculo_item_substituto"`;
- mecanismos atuais de matching.

### Regras

- identidade segura -> preservar área;
- substituição inequivocamente resolvida -> reaproveitar vínculo;
- ambiguidade -> classificação pendente/revisão;
- nunca inferir área por semelhança semântico-textual isolada.

### Testes

- preservação de Ouvidoria;
- preservação de Corregedoria;
- preservação de Escola de Serviços Penais;
- substituto seguro;
- substituto ambíguo.

### Critério de aceite

O histórico observa a memória existente sem se tornar fonte de classificação.

---

## 62.14. Etapa 7 — integração com o job Transferegov e atomicidade

### Modelo

`GPT-6 Sol / high`

### Objetivo

Conectar a camada histórica ao fluxo real:

```text
estado atual
-> snapshot ANTES
-> atualização Transferegov
-> recarga operacional
-> snapshot DEPOIS
-> comparação
-> persistência/finalização
```

### Arquivos principais

- `profor-pad-atualizacao-transferegov-job-service.js`;
- `profor-pad-atualizacao-transferegov-orquestrador-service.js`;
- history service/repository;
- `postgres-client.js`, apenas se necessário para transação.

### Fazer

- adicionar `registroPadId`/identificador equivalente ao job;
- manter polling atual;
- registrar execução sem mudança;
- tratar falhas por fase;
- garantir ordem correta dos snapshots;
- preservar exclusividade/concurrency guard existente;
- evitar estado em que o PAD mude sem que o histórico consiga indicar o resultado da execução.

### Testes

- sucesso;
- sem mudança;
- falha antes da mutação;
- falha depois da criação do registro;
- retry;
- concorrência;
- rollback/estado de falha conforme desenho aprovado.

### Critério de aceite

O job real passa a gerar histórico auditável sem quebrar o contrato atual de polling e atualização.

---

## 62.15. Etapa 8 — retirar senha local apenas do PROFOR 2022

### Modelo

`GPT-6 Luna / medium`

### Alternativa

`DeepSeek 4.1 Flash / normal` se a Etapa 1 já tiver mapeado exatamente todos os call sites.

### Objetivo

Eliminar a digitação da senha para ações administrativas locais do PROFOR 2022, mantendo proteção remota.

### Fazer

- loopback autorizado sem solicitar `ONASP_EDIT_PASSWORD` para as ações PROFOR definidas no escopo;
- frontend PROFOR não abre modal de senha nessas ações;
- chamadas remotas continuam dependendo de `PROFOR_ADMIN_TOKEN` e guards;
- não alterar autenticação de Parâmetros Mínimos, Formalização, Orçamento, FAF ou outros módulos.

### Testes

- local sem senha -> permitido;
- remoto sem token -> negado;
- remoto com token inválido -> negado;
- remoto com token válido -> comportamento atual preservado;
- módulos externos ao PROFOR continuam exigindo senha quando já exigiam.

### Critério de aceite

Conveniência local sem regressão de segurança remota e sem alteração transversal.

---

## 62.16. Etapa 9 — APIs de leitura do histórico

### Modelo

`GPT-6 Luna / medium`

### Alternativa

`DeepSeek 4.1 Flash / normal`.

### Objetivo

Expor apenas as consultas necessárias para a tela.

### Preferência de contrato

Manter poucas rotas, por exemplo:

```text
GET /api/profor-2022/pad/historico
GET /api/profor-2022/pad/historico/:id
```

Filtros podem ser parâmetros da primeira rota em vez de multiplicar endpoints.

### Testar

- intervalo/data;
- UF;
- convênio;
- tipo de alteração;
- área;
- execução sem mudanças;
- execução inexistente;
- ordenação.

### Critério de aceite

Frontend consegue montar calendário, lista de execuções e detalhe sem precisar carregar snapshots completos desnecessariamente.

---

## 62.17. Etapa 10 — frontend “Registros do PAD”

### Modelo

`Muse Spark 1.3 / standard`

### Alternativa

`GPT-6 Luna / high`.

### Objetivo

Implementar somente a subview interna do PROFOR 2022.

### Ler

- bloco PROFOR 2022 de `index.html`;
- funções PROFOR 2022 de `frontend/js/app.js`;
- classes necessárias de `frontend/css/app.css`;
- referência visual específica do PROFOR-2026 indicada neste plano;
- contrato da API criado na Etapa 9.

### Não ler

O restante do frontend salvo quando uma função compartilhada for realmente necessária.

### Implementar

- acesso interno “Registros do PAD”;
- calendário;
- marcação dos dias com execução;
- lista por horário;
- resumo;
- filtros;
- cards Antes/Depois;
- estados sem alteração/falha;
- responsividade;
- acessibilidade básica;
- modo estático sem acesso operacional.

### Critério de aceite

Tela funcional sem refactor global de `app.js` ou mudança visual ampla no sistema.

---

## 62.18. Etapa 11 — CTA pós-atualização e deep-link interno

### Modelo

`DeepSeek 4.1 Flash / normal`

### Alternativa

`GPT-6 Luna / low`.

### Objetivo

Adicionar o menor patch possível para permitir que, ao final do job, o usuário abra o registro gerado.

### Fazer

- consumir `registroPadId` ou identificador equivalente já devolvido pelo backend;
- mostrar “Ver alterações”;
- abrir a subview de histórico focando a execução recém-criada;
- não alterar lógica central do job.

### Testes

- conclusão com mudanças;
- conclusão sem mudanças;
- falha sem registro final navegável;
- refresh não depende de estado volátil do botão.

### Critério de aceite

CTA funciona sem duplicar lógica de histórico no frontend.

---

## 62.19. Etapa 12 — testes integrados e regressão focada

### Modelo

`GPT-6 Luna / high`

### Alternativa

`Gemini 3.8 Flash / medium` para leitura de muitos testes, caso necessário.

### Objetivo

Executar a validação transversal sem reabrir arquitetura.

### Ordem

1. testes novos do repository;
2. testes novos do history service;
3. testes do comparador já existente;
4. testes do job/orquestrador;
5. testes do admin guard;
6. testes de frontend/E2E afetados;
7. `validar:syntax`;
8. demais validações proporcionais previstas neste plano.

### Regra

Se um teste falhar:

- identificar a camada responsável;
- devolver a correção ao modelo recomendado daquela etapa;
- não pedir ao modelo de testes para fazer refactor cross-layer improvisado.

### Critério de aceite

Suite focada verde e ausência de regressão conhecida nas áreas tocadas.

---

## 62.20. Etapa 13 — auditoria final de arquitetura e diff

### Modelo

`GPT-6 Astra / low`

### Alternativa

`GPT-6 Sol / high` se Astra não estiver disponível.

### Objetivo

Usar o modelo mais forte apenas onde o custo tem maior retorno: revisão final.

### Contexto que Astra deve receber

NÃO enviar o repositório inteiro.

Enviar somente:

1. objetivo e decisões da seção 0;
2. critérios de aceite das seções 46 e 47;
3. resumo do handoff;
4. migration criada;
5. history repository/service;
6. diff dos pontos de integração do job;
7. diff do guard de autenticação;
8. contratos das novas rotas;
9. testes novos e resultado;
10. diff frontend somente se houver dúvida arquitetural relevante.

### Perguntas que a auditoria deve responder

- existe cenário de perda de histórico?
- snapshot ANTES realmente antecede a mutação?
- snapshot DEPOIS representa o estado material correto?
- há duplicação do comparador/classificador?
- item novo sem classificação pode desaparecer?
- classificação antiga pode ser perdida indevidamente?
- chamada remota ficou menos protegida?
- o histórico está realmente append-only?
- idempotência/concurrency estão coerentes?
- houve exposição indevida ao modo estático?

### Saída permitida

Astra deve produzir apenas:

```text
APROVADO
```

ou uma lista curta de achados com:

```text
criticidade
arquivo
problema
correção mínima
```

### Regra de economia

Astra não deve aplicar correções por padrão. Se apontar problema, encaminhar o achado à etapa/modelo responsável.

---

## 62.21. Etapa 14 — documentação, handoff final e commit

### Modelo

`GPT-6 Luna / low`

### Alternativa

`DeepSeek 4.1 Flash / normal`.

### Fazer

- atualizar `schema-banco.md`;
- atualizar `rotas.md`;
- atualizar documentação PROFOR 2022 pertinente;
- atualizar diário de bordo quando permitido;
- conferir `git diff --check`;
- registrar testes finais;
- remover informação temporária obsoleta do handoff ou consolidá-la;
- preparar commit objetivo.

### Não fazer

- reformatar arquivos inteiros;
- regenerar publicação estática sem necessidade;
- criar nova documentação redundante;
- reabrir decisões concluídas.

### Critério de aceite

Repositório documentado, diff limpo e estado final reproduzível por outro agente.

---

## 62.22. Estratégia recomendada de distribuição dos modelos

Para este projeto, a divisão padrão deve ser aproximadamente:

```text
GPT-6 Luna        -> maior parte das sessões e tarefas de suporte
GPT-6 Sol         -> núcleo difícil do backend
Muse Spark 1.3    -> frontend e implementação agentic delimitada
DeepSeek 4.1      -> patches mecânicos muito específicos
Gemini 3.8 Flash  -> fallback de contexto/franquia, não etapa obrigatória
GPT-6 Astra       -> uma auditoria final curta
```

Isso evita o erro de usar Astra/Sol para leitura mecânica e, no extremo oposto, usar modelos Flash para decisões de integridade que podem comprometer o histórico.

---

## 62.23. Regra de sessão por etapa

Preferir **uma sessão nova por etapa** quando houver troca de harness ou modelo.

Não continuar uma conversa gigantesca apenas para “preservar contexto”. O contexto necessário deve estar no código e no handoff.

Cada sessão deve terminar com:

```text
1. etapa concluída ou não;
2. arquivos alterados;
3. testes executados;
4. testes pendentes;
5. decisões novas estritamente necessárias;
6. próximo passo exato;
7. atualização do REGISTROS_PAD_IMPLEMENTACAO_STATUS.md.
```

---

## 62.24. Regra de revisão sem duplicação de tokens

Não pedir a um segundo modelo para revisar todo o trabalho após cada etapa.

Revisões intermediárias só são justificadas quando:

- migration altera segurança/RLS de forma não trivial;
- mudança mexe na ordem ANTES/DEPOIS;
- transação não consegue abranger a operação necessária;
- matching existente não atende um caso real;
- alteração de autenticação ultrapassa o loopback;
- testes demonstram comportamento contraditório.

Fora desses casos, os testes são a revisão intermediária.

A revisão inteligente de alto custo fica concentrada na Etapa 13.

---

## 62.25. Regra de commits durante execução multi-harness

Se vários harnesses forem usados na mesma branch, preferir commits de checkpoint somente em fronteiras que deixem o projeto coerente.

Sugestão:

```text
checkpoint 1: migration + repository
checkpoint 2: history service + integração job
checkpoint 3: API + frontend
checkpoint 4: testes + documentação
```

Não criar commit para cada arquivo ou microetapa.

O objetivo é permitir rollback entre blocos sem gerar dezenas de commits artificiais.

---

## 62.26. Resumo operacional para escolha rápida

Se a tarefa for principalmente:

```text
ler / mapear / testar / documentar
=> GPT-6 Luna

SQL / transação / snapshots / backend com invariantes
=> GPT-6 Sol

frontend multi-arquivo já especificado
=> Muse Spark 1.3

patch pequeno e mecânico
=> DeepSeek 4.1 Flash

contexto muito grande ou franquia OpenAI indisponível
=> Gemini 3.8 Flash

auditar o resultado consolidado
=> GPT-6 Astra low
```

O padrão é **escalar por necessidade comprovada**, não por precaução.

---

# 63. Contrato de saída esperado da IA executora

Ao terminar a implementação, a IA deve responder de forma objetiva com:

1. resumo do que foi implementado;
2. arquivos criados;
3. arquivos modificados;
4. migration criada;
5. rotas criadas;
6. mudança na senha local;
7. testes executados;
8. resultado dos testes;
9. riscos residuais;
10. eventual ponto que permaneceu pendente;
11. commit criado, se solicitado.

Não entregar uma narrativa genérica.

---

# 64. Mensagem de commit sugerida

```text
feat(profor-2022): adicionar registros historicos do PAD
```

Se houver commit separado para migration:

```text
feat(db): persistir historico de atualizacoes PAD
```

Evitar múltiplos commits sem necessidade.

---

# 65. Definição de pronto

A implementação está pronta quando a seguinte situação funcionar de ponta a ponta:

1. usuário abre PROFOR 2022;
2. clica para atualizar PAD;
3. nenhuma senha é solicitada;
4. backend captura estado ANTES;
5. Transferegov é consultado;
6. cache válido é atualizado;
7. recarga operacional ocorre;
8. backend captura estado DEPOIS;
9. diferenças são persistidas;
10. classificação conhecida é preservada;
11. item ambíguo vai para revisão;
12. job termina;
13. frontend oferece “Ver alterações”;
14. usuário abre Registros do PAD;
15. calendário mostra o dia;
16. execução aparece pelo horário;
17. resumo mostra novos/removidos/alterados;
18. detalhe mostra Antes/Depois;
19. recarregar a página não apaga o histórico;
20. reiniciar o servidor não apaga o histórico;
21. GitHub Pages permanece sem acesso a esses dados.

---

# 66. Observação final de arquitetura

A tela de Registros deve ser tratada como uma **camada de auditoria temporal sobre o PAD**, e não como uma segunda fonte de verdade.

As fontes continuam sendo:

- PAD atual obtido pelo fluxo Transferegov;
- memória de itens conhecidos;
- rateios;
- decisões de revisão;
- serviços atuais de normalização e matching.

O histórico apenas preserva, para cada execução:

```text
o que existia
+
o que chegou
+
como o sistema interpretou a diferença
+
qual classificação permaneceu ou ficou pendente
```

Essa separação é obrigatória para evitar que, no futuro, o histórico passe a interferir indevidamente no estado operacional.

---

# 67. Checklist inicial para a IA que receber este arquivo

Antes de escrever código:

```text
[ ] Li AGENTS.md
[ ] Li memoria/INDEX.md
[ ] Li profor-2022.md
[ ] Li profor-2022-automacao-planos-aplicacao.md
[ ] Li profor-2022-operacao.md
[ ] Li schema-banco.md
[ ] Li rotas.md
[ ] Inspecionei supabase/migrations/
[ ] Inspecionei postgres-client.js
[ ] Inspecionei server.js
[ ] Inspecionei o job Transferegov
[ ] Inspecionei o orquestrador
[ ] Inspecionei o carregador operacional
[ ] Inspecionei o snapshot service
[ ] Inspecionei o comparador
[ ] Inspecionei revisão/rateio/substitutos
[ ] Inspecionei frontend PROFOR 2022
[ ] Inspecionei testes existentes
[ ] Confirmei valores internos reais das áreas
[ ] Confirmei padrão atual de migration/RLS
```

Somente depois iniciar a implementação.
