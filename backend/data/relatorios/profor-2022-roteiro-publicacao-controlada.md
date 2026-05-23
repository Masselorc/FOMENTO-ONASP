# PROFOR 2022 — Roteiro de publicação controlada (documentação, NÃO EXECUTAR nesta etapa)

- **Versão do roteiro:** 1.0
- **Data de elaboração:** 2026-05-23
- **Estado de pré-requisito:** ativação controlada da origem `reconstrucao-pad` concluída e versionada no commit `7ed2633 chore(profor-2022): registra ativacao controlada da origem reconstrucao-pad`; capacidade implementada em `2889024 feat(profor-2022): implementa origem reconstrucao pad`.
- **Origem ativa local/controlada:** `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` (via `.env` gitignored). Default no código permanece `banco-cache`. Fallbacks `planilha` e `banco-cache` preservados.
- **Status deste roteiro:** **DOCUMENTAÇÃO**. Nenhum comando deste roteiro foi executado e nenhum comando deste roteiro deve ser executado pela elaboração ou revisão do próprio roteiro.
- **Aviso de segurança global:** todo bloco rotulado `[NÃO EXECUTAR NESTA ETAPA]` exige **autorização expressa por escrito** do responsável funcional e do revisor de segurança técnica antes de ser executado em qualquer momento futuro.
- **Separação obrigatória vs. ativação:** este roteiro **NÃO ativa nada**. A ativação já está vigente no ambiente local; aqui só se publica o efeito da ativação para os JSONs estáticos consumidos pelo frontend.

---

## 1. Escopo

Este roteiro descreve a sequência operacional **futura** para publicar os dados PAD/PROFOR 2022 em `frontend/data/publicados/`, refletindo a nova origem `reconstrucao-pad` já ativa. A publicação consiste em:

1. confirmação do estado pré-publicação (auditorias, sintaxe, serviços, isolamento e origem ativa);
2. snapshots e backups íntegros de `frontend/data/publicados/` (será sobrescrito) e do SQLite (não deve mudar, mas é fotografado para rollback de defesa em profundidade);
3. execução isolada **apenas** de `npm run publicar:dados` (script `backend/scripts/publicar-dados-estaticos.js`) — **não** o orquestrador `publicar:profor-2022`, que aciona `atualizar:profor-2022` e portanto Transferegov;
4. validações pós-publicação imediatas (`validar:json`, `validar:syntax`, `validar:services`) e auditoria de vazamento dos JSONs publicados;
5. conferência visual mínima dos 6 JSONs gerados (tamanhos, hashes, campos-chave);
6. critérios objetivos de aceite, parada e rollback;
7. encerramento sem encadeamento automático para qualquer outra etapa (em particular, sem Transferegov, sem reativação da origem antiga, sem alteração da origem ativa).

## 2. Fora de escopo

- Execução de `npm run publicar:profor-2022` (chama `atualizar:profor-2022` → Transferegov: **proibido**).
- Execução de `npm run atualizar:profor-2022` (Transferegov: **proibido**).
- Execução de `npm run atualizar:detru-profor`, `npm run atualizar:rendimentos-profor`, `npm run agendar:*` (Transferegov/DETRU: **proibido**).
- Qualquer alteração no `.env` (a origem ativa permanece `reconstrucao-pad`; **não reativar** outras origens nesta janela).
- Qualquer alteração em `backend/data/onasp.sqlite` (a publicação é leitura para escrever JSON; não deve tocar SQLite).
- Registro de novas decisões, exclusão de decisões/divergências/logs, criação de migration, SQL direto.
- Alteração do `planoAplicacao` oficial (a publicação serializa o consolidado em JSON; não muda planilha-origem nem decisões persistidas).
- Roteamento para outras instâncias/máquinas — esta publicação reflete o ambiente local onde a ativação foi feita (vide diário do commit `7ed2633`).

## 3. Pré-condições obrigatórias

Antes de executar qualquer bloco rotulado `[NÃO EXECUTAR NESTA ETAPA]`, todas as condições abaixo precisam estar simultaneamente satisfeitas e registradas:

1. branch `main`;
2. `git status --short` vazio;
3. último commit é o da ativação `7ed2633` ou commit posterior **que apenas atualize relatórios dry-run ou documentação** (qualquer mudança no código de serviços/scripts exige novo pré-voo de publicação);
4. `.env` contém literalmente a linha `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad`, com SHA-256 idêntico ao snapshot pós-ativação registrado no diário (`457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648`);
5. `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json` presente e com hash idêntico ao snapshot da janela de ativação (`ed1639ece4258e1fd9a5e524f6604c5f70010d779eccd553c7f11dd49d6f0886`) — qualquer divergência exige decisão explícita do operador antes de prosseguir;
6. `backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json` com `resumo.pendenciaOperacionalReal = 0`, `resumo.totalBloqueiosAtivos = 0` e `resumo.aptoParaAtivacaoControlada = true`;
7. `validar:syntax` OK e `validar:services` OK rodados dentro da janela imediatamente anterior à publicação (preferencialmente até 1 h antes);
8. `git diff --check` limpo;
9. `frontend/data/publicados/`, `backend/data/onasp.sqlite`, `*.sqlite-wal` e `*.sqlite-shm` sem alteração e sem stage **antes** do bloco 10;
10. **autorização expressa por escrito** do responsável funcional e do revisor de segurança técnica (ou declaração formal de operação solo, conforme padrão já estabelecido na ativação), com janela definida e horário de início e fim;
11. ambiente confirmadamente **fora do horário de uso** dos usuários finais.

Qualquer pré-condição que falhe ou esteja indeterminada **inviabiliza a publicação e exige re-execução do pré-voo antes de nova tentativa**.

## 4. Responsáveis

| Papel | Responsabilidade |
|---|---|
| Responsável funcional (Ouvidoria/SENAPPEN) | Autorizar a janela, validar interpretação visual dos números nos JSONs publicados e aprovar/rejeitar o aceite formal pós-publicação. |
| Responsável técnico (operador da publicação) | Executar comandos exatos, registrar evidências, abortar à primeira falha de critério de parada e acionar rollback quando aplicável. |
| Revisor de segurança técnica (par) | Acompanhar a janela em modo leitura, validar pré-condições, conferir hashes, conferir a auditoria de vazamento dos JSONs publicados e atestar integridade dos backups. |
| Custódia de backups | Guardar localmente e fora do repositório (`<RET>/`) os snapshots de `frontend/data/publicados/` e do SQLite, com hash registrado, **antes** do bloco 10. |

> Nesta etapa, o roteiro **não nomeia pessoas**. A designação nominal será feita no momento da autorização da janela. Se a operação for solo, a autorização escrita deve declarar isso explicitamente, como já foi feito na ativação (commit `7ed2633`).

## 5. Janela recomendada

- **Duração estimada do bloco crítico de publicação:** até 45 min, sendo até 15 min de pré-checks, até 10 min de backup, até 5 min de publicação (`npm run publicar:dados` típico é < 60 s) e até 15 min de validações pós + conferência visual.
- **Horário recomendado:** fora do horário de uso (preferencialmente noturno em dia útil ou diurno em fim de semana, conforme política institucional).
- **Buffer mínimo de rollback:** **+45 min** reservados após o término do bloco crítico, exclusivamente para eventual rollback do `frontend/data/publicados/`.
- **Janela total recomendada (bloco crítico + buffer de rollback):** **90 min**.
- **Pré-aviso interno:** mínimo de 24 h ao responsável funcional e ao revisor de segurança técnica.

## 6. Backups obrigatórios

Todos os backups devem ser feitos **antes** do bloco 10, com **hash SHA-256 registrado** e **fora do repositório git**, em pasta de retenção combinada com a custódia de backups.

1. **Diretório `frontend/data/publicados/`** — cópia integral. **Crítico:** será sobrescrito pela publicação.
2. **`backend/data/onasp.sqlite`** — cópia integral (defesa em profundidade; não deve mudar, mas vale para rollback se algo inesperado tocar o banco).
3. **`backend/data/onasp.sqlite-wal`** e **`backend/data/onasp.sqlite-shm`**, se existirem no instante do backup (não versionar nunca).
4. **`.env`** — snapshot do estado da origem ativa no momento da publicação. Hash esperado: `457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648`.
5. **`backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json`** — fonte material que será consumida pela publicação. Hash esperado: `ed1639ece4258e1fd9a5e524f6604c5f70010d779eccd553c7f11dd49d6f0886`.
6. **Cópia dos relatórios** de prontidão, segurança final e ativação (`profor-2022-prontidao-ativacao-controlada-dry-run.{json,md}`, `profor-2022-seguranca-pre-ativacao-final-dry-run.json`, `profor-2022-roteiro-ativacao-controlada.md`, `profor-2022-roteiro-publicacao-controlada.md`).
7. Saída completa de `git log --oneline -20` e `git status --short` registrada como evidência antes da publicação.

Para cada artefato, registrar: caminho de origem, caminho de retenção, tamanho em bytes, hash SHA-256, data e hora, responsável.

## 7. Arquivos publicados a proteger (serão sobrescritos pela publicação)

A publicação atômica (via `escreverJsonAtomico` em [backend/services/static-publication-service.js](FOMENTO-ONASP/backend/services/static-publication-service.js#L12)) sobrescreve estes 6 arquivos em `frontend/data/publicados/`:

| Arquivo | Conteúdo esperado | Sensibilidade |
|---|---|---|
| `aplicacao.json` | Catálogo público com `dadosBase` consolidado + `dadosProfor2022` (campos `dadosProfor2022.convenios[*]` agora vêm da reconstrução PAD) | Alta — fonte principal do frontend |
| `dashboard-geral.json` | Dashboard agregado a partir de `dadosBase` + `dadosProfor2022` | Alta |
| `formalizacao-profor.json` | Formalização PROFOR (não afetado materialmente pela troca de origem PAD) | Média |
| `orcamento-2026.json` | Orçamento 2026 (não afetado) | Média |
| `parametros-minimos.json` | Parâmetros mínimos (não afetado) | Média |
| `resumo-publicacao.json` | Metadados da publicação: `publicadoEm`, `arquivos[]`, totais por origem | Baixa |

**Snapshots dos hashes atuais (pré-publicação, capturados em 2026-05-23):**

```
20a9cb478e7cd7a30a668d5a3e815501f2cb458ef1f2c9b77768d51b5cfdaf0b  aplicacao.json
44b331c98971bb754f11132c63d27b9c0bea2b7155c84d53942ede917ba69f28  dashboard-geral.json
d9eaf6360398d86ab5e60bebfdcee6389048c5a4047714dfbec853c25bd545a1  formalizacao-profor.json
74afab7ac9bbd28da416744ed74dd78072aa2619e9ba1bff93bc8e0b58a2a926  orcamento-2026.json
501562d4bcad885c47bcef15f469794da8a74017bc3054b0df9850d9701b1431  parametros-minimos.json
bdc40661b14a6ed149d55c8c0ebb590a974bff222d86f6ce95b83abd5f8910b2  resumo-publicacao.json
```

**Mudança esperada pela publicação:** `aplicacao.json`, `dashboard-geral.json` e `resumo-publicacao.json` devem mudar de hash (origem PAD reconstruída produz `dadosProfor2022` com `origemDadosEfetiva = "reconstrucao-pad"`). Os outros 3 devem permanecer com o mesmo hash, salvo evolução nos serviços de parâmetros/formalização/orçamento.

## 8. Comandos de auditoria pré-publicação

Estes comandos **podem ser executados em qualquer momento** (leitura/dry-run) e **devem** ser executados na abertura da janela como verificação imediata das pré-condições.

```bash
git status --short
git log --oneline -8

# Conferir que a origem ativa local é reconstrucao-pad
grep "^PROFOR_2022_ORIGEM_DADOS" .env

# Conferir hash do .env e do JSON reconstruído
sha256sum .env
sha256sum backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json

# Auditorias dry-run
npm run profor:pad:auditar-pendencias-profundo
npm run profor:pad:seguranca-pre-ativacao:final
npm run profor:pad:reconstruir-plano:dry-run
npm run profor:pad:comparar-plano:dry-run

# Validações de código
npm run validar:syntax
npm run validar:services

# Isolamento de artefatos sensíveis
git diff --check
git status --short frontend/data/publicados
git status --short "*.sqlite*"
git status --short "*.sqlite-wal"
git status --short "*.sqlite-shm"
```

**Resultados esperados nesta janela** (qualquer divergência aborta):

- `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` no `.env`;
- SHA-256 `.env` = `457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648`;
- SHA-256 reconstruído = `ed1639ece4258e1fd9a5e524f6604c5f70010d779eccd553c7f11dd49d6f0886`;
- `pendenciaOperacionalReal = 0`, `totalBloqueiosAtivos = 0`, `aptoParaAtivacaoControlada = true`;
- reconstrução: 568 linhas, 15 convênios, 31 impedimentos categorizados, 0 erros críticos;
- comparador: 25 diferenças críticas explicadas, diff líquido saldo ≈ −R$ 15.043,84;
- `validar:syntax` OK (76 arquivos);
- `validar:services` OK (153/153);
- `git diff --check` limpo;
- `frontend/data/publicados/`, `*.sqlite*`, `*.sqlite-wal`, `*.sqlite-shm` todos vazios.

## 9. Comandos de backup

> `<RET>` = pasta de retenção combinada com a custódia de backups, **fora do repositório git**. Sugestão: `C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\publicacao-<ISO-8601-da-janela-efetiva>`. **Usar o timestamp da janela efetiva no nome do diretório raiz** (lição registrada após a ativação, vide diário do commit `7ed2633`).

```bash
RET="/c/BACKUPS-FOMENTO-ONASP/PAD-PROFOR-2022/publicacao-<TS-JANELA>"
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$RET"

# 9.1. Backup do diretório publicados (será sobrescrito) — antes de qualquer coisa
cp -rp frontend/data/publicados/. "$RET/publicados.pre-publicacao-$TS/"

# 9.2. Hashes agregados do publicados pré-publicação
( cd "$RET/publicados.pre-publicacao-$TS" && find . -type f | sort | xargs sha256sum ) > "$RET/publicados.pre-publicacao-hashes.txt"

# 9.3. Backup do SQLite (defesa em profundidade)
cp -p backend/data/onasp.sqlite "$RET/onasp.sqlite.pre-publicacao-$TS"
test -f backend/data/onasp.sqlite-wal && cp -p backend/data/onasp.sqlite-wal "$RET/onasp.sqlite-wal.pre-publicacao-$TS"
test -f backend/data/onasp.sqlite-shm && cp -p backend/data/onasp.sqlite-shm "$RET/onasp.sqlite-shm.pre-publicacao-$TS"
sha256sum "$RET/onasp.sqlite.pre-publicacao-$TS" \
          "$RET/onasp.sqlite-wal.pre-publicacao-$TS" \
          "$RET/onasp.sqlite-shm.pre-publicacao-$TS" \
   > "$RET/sqlite-hashes-pre-publicacao.txt" 2>/dev/null

# 9.4. Snapshot do .env (estado da origem ativa)
cp -p .env "$RET/.env.pre-publicacao-$TS"
sha256sum .env "$RET/.env.pre-publicacao-$TS"

# 9.5. Snapshot do JSON reconstruído (fonte material da publicação)
cp -p backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json "$RET/"
sha256sum backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json "$RET/profor-2022-pad-plano-reconstruido-dry-run.json"

# 9.6. Cópia dos relatórios de referência
cp -p backend/data/relatorios/profor-2022-prontidao-ativacao-controlada-dry-run.{json,md} "$RET/"
cp -p backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json "$RET/"
cp -p backend/data/relatorios/profor-2022-roteiro-ativacao-controlada.md "$RET/"
cp -p backend/data/relatorios/profor-2022-roteiro-publicacao-controlada.md "$RET/"

# 9.7. Evidência git
git log --oneline -20 > "$RET/git-log-pre-publicacao.txt"
git status --short    > "$RET/git-status-pre-publicacao.txt"

ls -la "$RET"
```

> **Aceite do backup:** o bloco 10 só pode iniciar após (1) todos os hashes registrados em arquivo, (2) conferência cruzada origem↔backup (hashes devem ser idênticos), (3) inspeção manual de `<RET>/`, (4) assinatura/registro do revisor de segurança técnica (ou aceite concentrado no operador, se operação solo declarada).

## 10. Comandos de publicação futura — `[NÃO EXECUTAR NESTA ETAPA]`

> Cada comando deste bloco está **proibido nesta etapa**. Estão listados apenas como referência operacional para futura execução autorizada.

> **Forma esperada da publicação:** executar **apenas** `npm run publicar:dados`, que invoca `backend/scripts/publicar-dados-estaticos.js` → `static-publication-service.publicarDadosEstaticos()` → `consolidarCatalogoDashboard()` → `montarDadosProfor2022Publicacao()`. Com a env `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` já carregada via `dotenv`, o serviço entra no branch da reconstrução PAD e grava 6 JSONs em `frontend/data/publicados/` atomicamente (`.tmp` + `rename`).

```text
# 10.1. [NÃO EXECUTAR NESTA ETAPA]
#       Confirmar que a env está carregada na sessão de shell:
#         grep "^PROFOR_2022_ORIGEM_DADOS" .env
#         # esperado: PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad
#       (Para o processo Node, dotenv carrega .env automaticamente; nada extra a fazer.)

# 10.2. [NÃO EXECUTAR NESTA ETAPA]
#       Executar APENAS publicar:dados (caminho direto, sem orquestrador):
#         npm run publicar:dados
#       Saída esperada: "Dados estaticos publicados com sucesso. { success: true, publicadoEm: '<ISO>' }"

# 10.3. [NÃO EXECUTAR NESTA ETAPA]
#       Comandos PROIBIDOS nesta janela:
#         npm run publicar:profor-2022   # orquestrador chama atualizar:profor-2022 → Transferegov
#         npm run atualizar:profor-2022  # Transferegov direto
#         npm run atualizar:detru-profor
#         npm run atualizar:rendimentos-profor
#         npm run agendar:detru-profor
#         npm run agendar:profor-2022
#         Qualquer alteração em .env, banco SQLite ou origem ativa.

# 10.4. [NÃO EXECUTAR NESTA ETAPA]
#       Recarregar serviços que mantêm cache em memória (se aplicável),
#       sem reiniciar processos em produção sem aviso.
```

> **Garantia de não-Transferegov:** o caminho `publicar:dados → static-publication-service.publicarDadosEstaticos` **não importa** nenhum cliente Transferegov, não chama nenhum dos serviços `transferegov-*`, e não dispara `atualizar:profor-2022`. Cobertura: o script `publicar-dados-estaticos.js` tem apenas 17 linhas e só requer `prepararBanco` (somente leitura) e `publicarDadosEstaticos`.

> **Garantia de atomicidade:** todas as escritas em `frontend/data/publicados/` passam por `escreverJsonAtomico` (escreve `.tmp` + `fs.renameSync`); um crash a meio caminho deixa o arquivo antigo intacto.

## 11. Validações pós-publicação

Imediatamente após o bloco 10, **rodar nesta ordem**:

```bash
# 11.1. Isolamento — só publicados/ deve ter mudado
git status --short
git diff --check
git status --short frontend/data/publicados   # deve mostrar 3 a 6 arquivos modificados
git status --short "*.sqlite*"                # deve ser vazio
git status --short "*.sqlite-wal"             # deve ser vazio
git status --short "*.sqlite-shm"             # deve ser vazio

# 11.2. Validações nativas
npm run validar:json     # valida JSONs publicados
npm run validar:syntax   # mantém em 76 arquivos OK
npm run validar:services # mantém em 153/153

# 11.3. Auditorias dry-run pós (não devem mudar)
npm run profor:pad:auditar-pendencias-profundo
npm run profor:pad:seguranca-pre-ativacao:final
npm run profor:pad:reconstruir-plano:dry-run
npm run profor:pad:comparar-plano:dry-run

# 11.4. Hashes pós-publicação
sha256sum frontend/data/publicados/*.json > "$RET/publicados.pos-publicacao-hashes.txt"
diff "$RET/publicados.pre-publicacao-hashes.txt" "$RET/publicados.pos-publicacao-hashes.txt"

# 11.5. Hash do resumo de publicação (sentinel)
cat frontend/data/publicados/resumo-publicacao.json | head -20
```

> **Tolerâncias e expectativas:**
> - `git status --short frontend/data/publicados` deve listar **3 a 6 arquivos** modificados; o mínimo crítico é `aplicacao.json`, `dashboard-geral.json` e `resumo-publicacao.json` (sempre mudam: contém `publicadoEm` e `dadosProfor2022`). Se nenhum arquivo mudar, **abortar** (publicação não rodou). Se mais de 6 mudarem (ex.: arquivo novo), **abortar** (escopo violado).
> - `resumo-publicacao.json` deve conter `publicadoEm` ISO-8601 dentro da janela autorizada e `arquivos` com a lista canônica de 5 arquivos (não inclui o próprio resumo).
> - `aplicacao.json::dadosProfor2022.origemDados` deve ser `"reconstrucao-pad"` e `origemDadosEfetiva` deve ser `"reconstrucao-pad"`.
> - `validar:json`, `validar:syntax` e `validar:services` devem manter os mesmos resultados do pré-check.
> - Auditorias dry-run devem produzir números idênticos ao pré-check (a publicação não altera SQLite nem decisões).
> - `*.sqlite*`, WAL e SHM devem permanecer vazios no `git status`.

## 12. Conferência visual mínima

Após o bloco 11, antes do aceite formal:

1. Abrir `frontend/data/publicados/resumo-publicacao.json` e conferir:
   - `publicadoEm` dentro da janela autorizada;
   - lista `arquivos` com 5 entradas canônicas;
   - `totais.dashboard.totalConvenios` e `totais.conveniosProfor2022` ambos igual a **15**.
2. Abrir `frontend/data/publicados/aplicacao.json` e conferir:
   - `dadosProfor2022.origemDados === "reconstrucao-pad"`;
   - `dadosProfor2022.origemDadosEfetiva === "reconstrucao-pad"`;
   - `dadosProfor2022.convenios.length === 15`;
   - amostra de 2 convênios com `previstoOuvidoria`, `valorExecutadoOuvidoria`, `saldoDisponivelOuvidoria` numéricos coerentes (sem `NaN`, sem `null` em campos monetários).
3. Abrir `frontend/data/publicados/dashboard-geral.json` e conferir que `resumoEsperado.totalConvenios === 15`.
4. Se o servidor for iniciado para visualização manual: subir `npm start` em outra sessão, abrir o frontend, conferir que a tela do PROFOR 2022 mostra 15 convênios e que números visíveis batem com o `aplicacao.json`. **Não fazer interações de escrita no servidor** durante a conferência.

> Se qualquer um desses checks falhar, **abortar** e ir para rollback (§15).

## 13. Critérios de sucesso

A publicação é considerada **bem-sucedida** **somente se** todas as condições abaixo forem verdadeiras, **na mesma janela**:

1. todas as pré-condições da §3 estavam satisfeitas no início da janela;
2. todos os backups da §6/§9 foram concluídos com hash registrado e aceitos pelo revisor (ou pelo operador, em operação solo declarada);
3. apenas os arquivos previstos em `frontend/data/publicados/` foram alterados (3 a 6 arquivos canônicos); nenhum arquivo de `backend/data/onasp.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `.env`, decisões, divergências ou logs foi tocado;
4. `git status --short` pós-publicação contém **somente** arquivos da lista canônica de `frontend/data/publicados/`;
5. todas as validações da §11 retornaram dentro das tolerâncias declaradas;
6. conferência visual mínima da §12 passou em todos os pontos;
7. revisor de segurança técnica atestou por escrito o aceite formal (ou aceite concentrado no operador em operação solo declarada);
8. responsável funcional atestou por escrito o aceite formal;
9. nenhum aviso real foi mascarado, suprimido ou rebatizado;
10. nenhuma chamada a Transferegov, DETRU ou serviços externos foi feita durante a janela.

Sem todos os dez itens, **a janela termina em rollback obrigatório**.

## 14. Critérios de parada (abortar e ir direto para rollback)

Abortar imediatamente e acionar a §15 se qualquer um dos eventos abaixo ocorrer:

1. qualquer pré-condição da §3 falhar dentro da janela;
2. qualquer backup da §9 falhar, retornar tamanho zero ou divergir em hash entre origem e cópia;
3. publicação tentar alterar `backend/data/onasp.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `.env`, decisões, divergências ou logs;
4. qualquer chamada Transferegov, DETRU ou serviço externo detectada nos logs do processo de publicação;
5. `validar:json`, `validar:syntax` ou `validar:services` falhar pós-publicação;
6. auditorias dry-run pós-publicação reportarem mudança em `pendenciaOperacionalReal`, `totalBloqueiosAtivos`, contagem de linhas/convênios ou diff líquido de saldo;
7. conferência visual falhar (qualquer item da §12);
8. `git status --short frontend/data/publicados` listar **mais** ou **menos** arquivos que o esperado (3 a 6);
9. `aplicacao.json::dadosProfor2022.origemDados` **não** for `"reconstrucao-pad"` (sinal de que a publicação não usou a origem ativa);
10. surgir mensagem operacional cujo significado não tenha sido confirmado pelo revisor (ou pelo operador, em operação solo declarada);
11. perda de comunicação com responsável funcional ou revisor antes do aceite formal.

## 15. Critérios e procedimento de rollback

> Rollback deve restaurar `frontend/data/publicados/` ao estado **idêntico** ao início da janela, sem perda de decisões, divergências ou logs e sem reverter a ativação (a origem ativa permanece `reconstrucao-pad`).

```bash
RET="/c/BACKUPS-FOMENTO-ONASP/PAD-PROFOR-2022/publicacao-<TS-JANELA>"
DIR_BACKUP=$(ls -d "$RET"/publicados.pre-publicacao-*)

# 15.1. Restaurar diretório publicados a partir do backup íntegro
#       Conferir hashes ANTES de sobrescrever
sha256sum frontend/data/publicados/*.json
cat "$RET/publicados.pre-publicacao-hashes.txt"

#       Apagar arquivos atuais (apenas dentro de publicados/) e copiar do backup
rm -f frontend/data/publicados/*.json
cp -p "$DIR_BACKUP"/*.json frontend/data/publicados/

# 15.2. Conferir restauração (hashes devem bater com o backup)
sha256sum frontend/data/publicados/*.json

# 15.3. Se houve alteração inesperada no SQLite, restaurar a partir do backup
#       (não deveria ocorrer; defesa em profundidade)
sha256sum backend/data/onasp.sqlite
sha256sum "$RET/onasp.sqlite.pre-publicacao-<TS>"
# Se divergir: cp -p "$RET/onasp.sqlite.pre-publicacao-<TS>" backend/data/onasp.sqlite

# 15.4. Reexecutar bateria pós para confirmar restauro
npm run validar:json
npm run validar:syntax
npm run validar:services
npm run profor:pad:auditar-pendencias-profundo
npm run profor:pad:seguranca-pre-ativacao:final
git diff --check
git status --short frontend/data/publicados
```

**Pós-rollback:** registrar entrada em `memoria/00_DIARIO_DE_BORDO/diario-atual.md` com gatilho da §14 que disparou, hashes pré/pós restauro e SHA de eventual commit relacionado. **Somente se houver erro novo**, registrar em `memoria/09_ERROS_E_CORRECOES/historico-erros.md`. Nenhuma decisão, log ou divergência pode ser apagada durante o rollback.

> **Atenção:** o rollback **não** desfaz a ativação da origem `reconstrucao-pad`. Se houver decisão de reverter também a ativação, executar separadamente o §14 do roteiro de ativação (`profor-2022-roteiro-ativacao-controlada.md` v1.1), com sua própria autorização.

## 16. Evidências a guardar

Guardar em `<RET>/`, fora do repositório, durante o tempo de retenção institucional:

1. Saídas completas dos comandos da §8 (pré-checks).
2. Hashes SHA-256 de `frontend/data/publicados/` (agregado), SQLite, WAL/SHM (se existirem), `.env`, JSON reconstruído.
3. Arquivo de hashes agregados do `publicados/` **pré** e **pós**-publicação, com `diff` entre os dois.
4. Saídas completas dos comandos da §11 (pós-publicação).
5. Cópia local dos relatórios de prontidão, segurança final, roteiro de ativação e este roteiro no instante da janela.
6. Texto integral do aceite formal (revisor e responsável funcional) ou, em caso de aborto, do gatilho que disparou a parada.
7. `git log --oneline -20` e `git status --short` antes e depois.
8. Em caso de rollback: SHA do `git revert` (se aplicável), hashes pós-restauro e nova bateria validar+dry-run.
9. Captura de tela ou texto do `resumo-publicacao.json` exibido pós-publicação (para registro do `publicadoEm` e dos totais).

## 17. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Publicação acoplar Transferegov por engano (executar `publicar:profor-2022` em vez de `publicar:dados`) | Baixa | Crítico | §10.3 lista explicitamente os scripts proibidos; revisor confere antes do bloco 10; §14 critério 4 aborta se logs mostrarem chamada externa. |
| R2 | Origem ativa local mudar entre a ativação e a publicação | Baixa | Alto | §3 critério 4 exige hash idêntico do `.env`; se diferir, abortar e refazer pré-voo. |
| R3 | Arquivo de reconstrução PAD ser regenerado com hash diferente entre janela de ativação e janela de publicação | Média | Alto | §3 critério 5 + §6 item 5: comparar hash atual com hash da ativação (`ed1639ec...0886`); divergência exige decisão explícita do operador. |
| R4 | Backup do `publicados/` falhar e a publicação sobrescrever sem rollback possível | Baixa | Crítico | §9.1 exige cópia + hashes agregados; §13 critério 2 bloqueia §10 sem aceite do backup. |
| R5 | Outro processo escrever em `publicados/` durante a janela | Baixa | Alto | §3 critério 11 exige fora do horário de uso; revisor monitora `git status --short publicados/` antes/durante/depois. |
| R6 | Auditoria de vazamento (`publicar:dados` interno) acusar padrão proibido (sessão, cookie, path) | Baixa | Crítico | Auditoria já é nativa do script `publicar-profor-2022-estatico.js` (mesmo módulo de padrões proibidos), e também roda em `publicar:dados` se for parametrizada. Se vazamento for detectado, abortar e rollback. |
| R7 | `dotenv` não recarregar a env entre janelas (cache de processo) | Baixa | Médio | Cada `npm run` cria um processo novo; não há cache persistente. Mitigação: §10.1 confirma `grep "^PROFOR_2022_ORIGEM_DADOS" .env` antes do bloco 10. |
| R8 | Publicação produzir arquivos com `dadosProfor2022.origemDados = "planilha"` (sinal de que env não foi lida) | Baixa | Crítico | §14 critério 9 aborta se origem efetiva não for `reconstrucao-pad`. |
| R9 | Sobrescrita parcial por crash entre `.tmp` e `rename` | Baixíssima | Médio | `escreverJsonAtomico` faz `.tmp + rename` (operação atômica); um crash deixa arquivo antigo intacto. |
| R10 | Reativação inadvertida de outra origem (operador edita `.env` por engano) | Baixa | Alto | §2 fora de escopo proíbe alterar `.env` nesta janela; §14 critério 3 aborta se `.env` for tocado. |

## 18. Proibição expressa de Transferegov

Dentro desta janela e dentro do escopo deste roteiro, **estão proibidos**:

- `npm run publicar:profor-2022` (orquestrador acoplado a Transferegov);
- `npm run atualizar:profor-2022` (Transferegov direto);
- `npm run atualizar:rendimentos-profor`;
- `npm run atualizar:detru-profor`;
- `npm run agendar:detru-profor` e `npm run agendar:profor-2022`;
- quaisquer chamadas a serviços Transferegov, DETRU, autenticação federada ou jobs automáticos correlatos.

Qualquer log do processo de publicação que mencione `transferegov`, `detru`, `siconv` ou `gov.br/login` dispara o §14 critério 4 (abortar e rollback).

## 19. Proibição expressa de nova ativação nesta etapa

Esta janela **não reativa nada** e **não altera a origem ativa**. Em particular:

- `.env` **não deve ser editado** nesta janela. Hash de entrada e saída devem ser idênticos: `457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648`.
- A flag `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` permanece como única origem ativa local; nenhuma volta para `banco-cache` ou `planilha` nesta janela.
- Caso seja necessário **reverter** a ativação por algum motivo, fazer **fora** desta janela de publicação, usando o §14 do roteiro de ativação (com sua própria autorização).

## 20. Texto de autorização expressa de publicação

Para liberar a publicação controlada, preencher e enviar exatamente o texto abaixo (campos entre `<>` preenchidos):

```
AUTORIZAÇÃO EXPRESSA DE PUBLICAÇÃO CONTROLADA PAD/PROFOR 2022
(origem ativa: reconstrucao-pad)

Autorizo a execução, em janela única e isolada, dos blocos 8, 9, 10, 11 e 12
do roteiro versionado em
backend/data/relatorios/profor-2022-roteiro-publicacao-controlada.md
(v1.0), com base nos commits:
- 2889024 (feat: implementa origem reconstrucao pad)
- 7ed2633 (chore: registra ativacao controlada da origem reconstrucao-pad)
e rollback obrigatório ao primeiro gatilho da seção 14.

Janela autorizada: <data> das <hora-início> às <hora-fim> (fora do horário de uso).
Responsável funcional: <nome / matrícula>.
Responsável técnico (operador): <nome / matrícula>.
Revisor de segurança técnica: <nome / matrícula>  OU  <declaração explícita de operação solo, com aceite cruzado concentrado>.
Custódia de backups: <nome / matrícula>.
Diretório de retenção de backups (fora do repositório, com TIMESTAMP DA JANELA EFETIVA): <caminho absoluto de <RET>>.

Mecanismo §10: APENAS `npm run publicar:dados` (caminho direto).
PROIBIDOS: publicar:profor-2022, atualizar:profor-2022, atualizar:*-profor, agendar:*, qualquer chamada Transferegov/DETRU/siconv.

Hashes esperados na abertura da janela:
- .env → 457a06639c0cba917461c8ee61c50cfa6595bf4cb258529bdd60467fd6eef648
- backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json
  → ed1639ece4258e1fd9a5e524f6604c5f70010d779eccd553c7f11dd49d6f0886

Confirmo expressamente:
- esta autorização NÃO inclui Transferegov, DETRU ou qualquer integração externa;
- esta autorização NÃO altera .env, SQLite, decisões, divergências ou logs;
- esta autorização NÃO desfaz nem altera a ativação da origem reconstrucao-pad;
- o único efeito esperado é a regravação dos JSONs de frontend/data/publicados/
  (3 a 6 arquivos canônicos);
- qualquer gatilho da seção 14 do roteiro dispara rollback imediato (seção 15);
- após a publicação aceita, NÃO há etapa seguinte automática:
  monitoramento operacional é feito separadamente.

Assinado: <nome do responsável funcional>     Data/hora: <ISO-8601 com fuso>.
```

---

## Checklist objetivo para execução manual futura

> Imprimir/exportar; marcar item a item durante a janela. **Não executar nada nesta etapa.**

- [ ] **Pré-condições** (§3) — todas verificadas e registradas: `__ / 11`.
- [ ] **Autorização escrita** do responsável funcional (e do revisor, ou declaração formal de operação solo) recebida.
- [ ] **Pré-checks** (§8) — comandos executados e resultados dentro das tolerâncias.
- [ ] **Backups** (§9) — `publicados/`, SQLite, `.env`, JSON reconstruído copiados, com hash SHA-256 registrado em `<RET>/`.
- [ ] **Aceite do backup** pelo revisor de segurança técnica (ou pelo operador, em operação solo).
- [ ] **Publicação** (§10) — executado **somente** `npm run publicar:dados`; nenhum outro script foi acionado.
- [ ] **Validações pós-publicação** (§11) — `validar:json`, `validar:syntax`, `validar:services`, auditorias dry-run e hashes pós dentro das tolerâncias.
- [ ] **Conferência visual mínima** (§12) — `resumo-publicacao.json`, `aplicacao.json`, `dashboard-geral.json` conferidos.
- [ ] **Critérios de sucesso** (§13) — todos os 10 itens satisfeitos.
- [ ] **Aceite formal** do responsável funcional e do revisor (ou do operador, em operação solo) registrado por escrito.
- [ ] **Evidências** (§16) — todas guardadas em `<RET>/`.
- [ ] **Diário** atualizado com `publicadoEm`, hashes pré/pós e SHA de eventual commit que registre os JSONs modificados.
- [ ] **Documentação da funcionalidade** atualizada com a publicação concluída.
- [ ] **Nada de Transferegov nem reativação:** confirmado por inspeção dos logs e do `.env` (hash igual ao de entrada).
- [ ] **Em caso de falha de qualquer critério** — §15 (rollback) executada integralmente; janela encerrada com registro do gatilho.

---

## Bloco final — confirmação de aplicabilidade

Este roteiro é **apenas documentação**. A próxima etapa concreta é a **autorização expressa por escrito** do responsável funcional (e do revisor de segurança técnica, ou declaração formal de operação solo) para a execução, em janela separada, dos blocos 8 → 9 → 10 → 11 → 12 → 13 deste roteiro, na ordem apresentada, com **rollback obrigatório** ao primeiro gatilho da §14.
