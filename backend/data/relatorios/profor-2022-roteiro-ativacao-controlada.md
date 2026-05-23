# PROFOR 2022 — Roteiro de ativação controlada (documentação, NÃO EXECUTAR nesta etapa)

- **Versão do roteiro:** 1.0
- **Data de elaboração:** 2026-05-23
- **Estado de pré-requisito:** auditoria integrada final de prontidão concluída e versionada no commit `6b89b8c commit` (vide `backend/data/relatorios/profor-2022-prontidao-ativacao-controlada-dry-run.md`).
- **Classificação de prontidão:** `PRONTO_PARA_PREPARAR_ATIVACAO_CONTROLADA`.
- **Status deste roteiro:** **DOCUMENTAÇÃO**. Nenhum comando deste roteiro foi executado e nenhum comando deste roteiro deve ser executado pela elaboração ou revisão do próprio roteiro.
- **Aviso de segurança global:** todo bloco rotulado `[NÃO EXECUTAR NESTA ETAPA]` exige **autorização expressa por escrito** do responsável funcional e do responsável técnico antes de ser executado em qualquer momento futuro.

---

## 1. Escopo

Este roteiro descreve a sequência operacional **futura** para realizar a ativação controlada da nova origem PAD/PROFOR 2022 como fonte do `planoAplicacao`, substituindo as abas/guias por UF da planilha antiga referenciada em `catalogoAplicacao.configuracao.arquivoPlanilhaConvenios`.

A ativação controlada compreende:

1. confirmação do estado pré-ativação (auditorias, sintaxe, serviços e isolamento de artefatos sensíveis);
2. snapshots e backups íntegros do estado anterior;
3. execução isolada da substituição da origem (em momento posterior, com janela e autorização específicas);
4. validações pós-ativação imediatas;
5. comparação pós-ativação contra os totais reconstruídos esperados;
6. critérios objetivos de aceite, parada e rollback;
7. **separação total** entre ativação e publicação: a publicação é etapa posterior, exige autorização própria, não é automática e **não faz parte deste roteiro**.

## 2. Fora de escopo

- Publicação para `frontend/data/publicados/` (etapa posterior, autorização própria).
- Avanço para automação Transferegov (frente separada, fora desta janela).
- Alteração das decisões registradas, dos logs de auditoria ou das divergências persistidas.
- Criação de novas migrations.
- SQL direto em `backend/data/onasp.sqlite`.
- Reabertura ou reescrita de decisões já consolidadas (`#18`, `#25–#28`, `#75`, `#77`, `#78`, `#47–#74`).
- Qualquer alteração em `frontend/data/publicados/`.
- Qualquer alteração no `planoAplicacao` oficial **fora** da ativação controlada formalmente autorizada.

## 3. Pré-condições obrigatórias

Antes de executar qualquer bloco rotulado `[NÃO EXECUTAR NESTA ETAPA]`, todas as condições abaixo precisam estar simultaneamente satisfeitas e registradas:

1. branch `main`;
2. `git status --short` vazio;
3. último commit é o da auditoria de prontidão (`6b89b8c commit`) ou commit posterior que apenas atualize relatórios dry-run;
4. relatório `backend/data/relatorios/profor-2022-prontidao-ativacao-controlada-dry-run.json` presente e com `classificacaoFinal = "PRONTO_PARA_PREPARAR_ATIVACAO_CONTROLADA"`;
5. `backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json` com `resumo.pendenciaOperacionalReal = 0`, `resumo.totalBloqueiosAtivos = 0` e `resumo.aptoParaAtivacaoControlada = true`;
6. `validar:syntax` OK e `validar:services` OK rodados dentro da janela imediatamente anterior à ativação (preferencialmente até 24 h antes);
7. `git diff --check` limpo;
8. `frontend/data/publicados/`, `backend/data/onasp.sqlite`, `*.sqlite-wal` e `*.sqlite-shm` sem alteração e sem stage;
9. **autorização expressa por escrito** do responsável funcional e do responsável técnico, com janela definida e horário de início e fim;
10. ambiente confirmadamente **fora do horário de uso** dos usuários finais.

Qualquer pré-condição que falhe ou esteja indeterminada **inviabiliza a ativação e exige re-execução do bloco de prontidão antes de nova tentativa**.

## 4. Responsáveis

| Papel | Responsabilidade |
|---|---|
| Responsável funcional (Ouvidoria/SENAPPEN) | Autorizar a janela, validar interpretação de números e aprovar/rejeitar aceite formal pós-ativação. |
| Responsável técnico (operador da ativação) | Executar comandos exatos, registrar evidências, abortar à primeira falha de critério de parada e acionar rollback quando aplicável. |
| Revisor de segurança técnica (par) | Acompanhar a janela em modo leitura, validar pré-condições, conferir hashes e atestar integridade dos backups. |
| Custódia de backups | Guardar localmente e fora do repositório (pasta de retenção combinada) os snapshots do SQLite e do diretório `publicados/`, com hash registrado. |

> Nesta etapa, o roteiro **não nomeia pessoas**. A designação nominal será feita no momento da autorização da janela.

## 5. Janela recomendada

- **Duração estimada do bloco crítico de ativação:** até 60 min, sendo até 20 min de pré-checks, até 15 min de backup, até 10 min de ativação controlada e até 15 min de validações pós-ativação.
- **Horário recomendado:** fora do horário de uso (preferencialmente noturno em dia útil ou diurno em fim de semana, conforme política institucional).
- **Buffer mínimo de rollback:** **+60 min** reservados após o término do bloco crítico, exclusivamente para eventual rollback e re-execução das auditorias dry-run.
- **Janela total recomendada (bloco crítico + buffer de rollback):** **120 min**.
- **Pré-aviso interno:** mínimo de 24 h ao responsável funcional e ao revisor de segurança técnica.

## 6. Backups obrigatórios

Todos os backups devem ser feitos **antes** da ativação, com **hash registrado** e **fora do repositório git**, em pasta de retenção combinada com a custódia de backups.

1. `backend/data/onasp.sqlite` — cópia integral.
2. `backend/data/onasp.sqlite-wal` e `backend/data/onasp.sqlite-shm`, **se existirem no instante do backup** (mesmo que não sejam versionados).
3. Diretório `frontend/data/publicados/` — cópia integral.
4. Snapshot do catálogo da aplicação efetivamente lido pela origem ativa (arquivo apontado por `catalogoAplicacao.configuracao.arquivoPlanilhaConvenios`).
5. Cópia do relatório dry-run de prontidão (`profor-2022-prontidao-ativacao-controlada-dry-run.json` e `.md`) e do `profor-2022-seguranca-pre-ativacao-final-dry-run.json` no momento da janela.
6. Saída completa de `git log --oneline -20` e `git status --short` registrada como evidência.

Para cada artefato, registrar: caminho de origem, caminho de retenção, tamanho em bytes, hash SHA-256, data e hora, responsável.

## 7. Arquivos a proteger

Qualquer comando que tente modificar os caminhos abaixo durante a ativação caracteriza **violação do escopo** e dispara `git restore`/abortar imediatamente:

- `frontend/data/publicados/**` (proibido alterar nesta etapa, em qualquer hipótese);
- `backend/data/onasp.sqlite` (proibido alterar via SQL direto ou comando ad-hoc; alteração só por serviço padrão e somente se a ativação a exigir explicitamente);
- `*.sqlite-wal`, `*.sqlite-shm` (não versionar; nunca);
- decisões e logs persistidos (proibido apagar, mascarar ou rebatizar);
- planilha referenciada por `catalogoAplicacao.configuracao.arquivoPlanilhaConvenios` (a substituição é controlada e auditável, **não** uma edição livre);
- todos os relatórios dry-run anteriores a esta janela (preservar como histórico imutável).

## 8. Comandos de auditoria prévia

Estes comandos **podem ser executados em qualquer momento** (são leitura/dry-run) e **devem** ser executados na abertura da janela como verificação imediata das pré-condições.

```bash
git status --short
git log --oneline -8

npm run profor:pad:auditar-pendencias-profundo
npm run profor:pad:seguranca-pre-ativacao:final
npm run profor:pad:reconstruir-plano:dry-run
npm run profor:pad:comparar-plano:dry-run

npm run validar:syntax
npm run validar:services

git diff --check
git status --short frontend/data/publicados
git status --short "*.sqlite*"
git status --short "*.sqlite-wal"
git status --short "*.sqlite-shm"
```

**Resultados esperados nesta janela** (qualquer divergência aborta a ativação):

- `pendenciaOperacionalReal = 0`;
- `totalBloqueiosAtivos = 0`;
- `aptoParaAtivacaoControlada = true`;
- reconstrução: 568 linhas, 15 convênios, 31 impedimentos técnicos categorizados, 0 erros críticos, 0 instrumentos fora carteira;
- comparador: 25 diferenças críticas explicadas, diferença líquida total de saldo entre −R$ 15.043,84 e o valor congelado pela auditoria de prontidão (tolerância ≤ R$ 1,00 sobre o valor congelado, qualquer variação maior aborta);
- `validar:syntax` OK (76 arquivos);
- `validar:services` OK (130/130);
- `git diff --check` limpo;
- `frontend/data/publicados/`, `*.sqlite*`, `*.sqlite-wal`, `*.sqlite-shm` todos vazios.

## 9. Comandos de backup

> Comandos abaixo são **rotulados e parametrizáveis**; substituir `<RET>` pelo caminho de retenção combinado com a custódia de backups. Executar com diretório de retenção **fora** do repositório git.

```bash
# 9.1. Backup do SQLite (íntegro, com fsync)
cp -p backend/data/onasp.sqlite "<RET>/onasp.sqlite.pre-ativacao-$(Get-Date -Format yyyyMMdd-HHmmss)"
# Se existirem WAL/SHM no momento do backup, copiar também (não versionar nunca):
test -f backend/data/onasp.sqlite-wal && cp -p backend/data/onasp.sqlite-wal "<RET>/onasp.sqlite-wal.pre-ativacao-$(Get-Date -Format yyyyMMdd-HHmmss)"
test -f backend/data/onasp.sqlite-shm && cp -p backend/data/onasp.sqlite-shm "<RET>/onasp.sqlite-shm.pre-ativacao-$(Get-Date -Format yyyyMMdd-HHmmss)"

# 9.2. Hash SHA-256 dos backups do banco
Get-FileHash "<RET>/onasp.sqlite.pre-ativacao-*" -Algorithm SHA256 | Format-List

# 9.3. Backup do diretório publicados (preservando atributos)
robocopy frontend/data/publicados "<RET>/publicados.pre-ativacao-$(Get-Date -Format yyyyMMdd-HHmmss)" /E /COPY:DAT /R:1 /W:1

# 9.4. Hash agregado do diretório publicados (somente arquivos, ordem estável)
Get-ChildItem -Recurse -File "<RET>/publicados.pre-ativacao-*" |
  Sort-Object FullName |
  Get-FileHash -Algorithm SHA256 |
  Tee-Object "<RET>/publicados.pre-ativacao-hashes.txt"

# 9.5. Snapshot da planilha apontada pela origem ativa (caminho via catalogoAplicacao.configuracao.arquivoPlanilhaConvenios)
#     Substituir <CAMINHO_PLANILHA> pelo caminho lido do catálogo no momento da janela.
cp -p "<CAMINHO_PLANILHA>" "<RET>/planilha-origem-ativa.pre-ativacao-$(Get-Date -Format yyyyMMdd-HHmmss)"
Get-FileHash "<RET>/planilha-origem-ativa.pre-ativacao-*" -Algorithm SHA256 | Format-List

# 9.6. Cópia dos relatórios de prontidão e segurança final no instante da janela
cp -p backend/data/relatorios/profor-2022-prontidao-ativacao-controlada-dry-run.json "<RET>/"
cp -p backend/data/relatorios/profor-2022-prontidao-ativacao-controlada-dry-run.md "<RET>/"
cp -p backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json "<RET>/"

# 9.7. Evidência git
git log --oneline -20 | Tee-Object "<RET>/git-log-pre-ativacao.txt"
git status --short      | Tee-Object "<RET>/git-status-pre-ativacao.txt"
```

> **Aceite do backup:** o bloco de ativação só pode iniciar após:
> 1. todos os hashes registrados em arquivo;
> 2. inspeção manual da pasta `<RET>/`;
> 3. assinatura/registro do revisor de segurança técnica atestando a integridade dos backups.

## 10. Comandos de ativação futura — `[NÃO EXECUTAR NESTA ETAPA]`

> Cada comando deste bloco está **proibido nesta etapa**. Estão listados apenas como referência operacional para futura execução autorizada. A ativação **não** chama `npm run publicar:*` nem dispara automação Transferegov.

> **Forma esperada da ativação:** substituição controlada da origem ativa do `planoAplicacao` (planilha das abas/guias por UF) pela origem reconstruída a partir dos relatórios PAD/PROFOR 2022, **preservando fallback**. A ativação consiste em (i) repointar `catalogoAplicacao.configuracao.arquivoPlanilhaConvenios` para a nova fonte ou (ii) ativar a flag de leitura da reconstrução PAD prevista na frente, conforme decisão técnica formalizada na janela.

```text
# 10.1. [NÃO EXECUTAR NESTA ETAPA]
#       Repontar a origem ativa para a nova fonte PAD reconstruída,
#       OU ativar a flag formal de leitura da reconstrução PAD,
#       conforme decisão técnica formalizada na janela.
#       O patch a ser aplicado deve:
#         - alterar APENAS o catálogo da aplicação (campo arquivoPlanilhaConvenios)
#           OU a flag de origem prevista;
#         - preservar fallback explícito para a origem antiga;
#         - não tocar em decisões, divergências, logs nem relatórios;
#         - ser revisado em PR exclusivo de ativação, sem outros arquivos.

# 10.2. [NÃO EXECUTAR NESTA ETAPA]
#       Recarregar serviços que mantêm cache em memória (se aplicável),
#       sem reiniciar processos em produção sem aviso.

# 10.3. [NÃO EXECUTAR NESTA ETAPA]
#       NÃO chamar: npm run publicar:dados
#       NÃO chamar: npm run publicar:profor-2022
#       NÃO chamar: npm run atualizar:profor-2022
#       NÃO chamar: nenhum script Transferegov.
```

> **Garantia de não-publicação acoplada:** a ativação **não pode** disparar publicação. Se o script de ativação a ser implementado fizer qualquer chamada direta a `publicar-*` ou a fluxos Transferegov, **abortar e tratar como bug bloqueante**.

## 11. Comandos de validação pós-ativação

Imediatamente após o bloco 10, **rodar nesta ordem**:

```bash
# 11.1. Estado git e isolamento de artefatos
git status --short
git diff --check
git status --short frontend/data/publicados
git status --short "*.sqlite*"
git status --short "*.sqlite-wal"
git status --short "*.sqlite-shm"

# 11.2. Auditorias após ativação (todas em dry-run)
npm run profor:pad:auditar-pendencias-profundo
npm run profor:pad:seguranca-pre-ativacao:final
npm run profor:pad:reconstruir-plano:dry-run
npm run profor:pad:comparar-plano:dry-run

# 11.3. Validações de sintaxe e serviços
npm run validar:syntax
npm run validar:services
```

> **Tolerâncias de comparação pós-ativação contra a fotografia da janela (mesma execução de pré-checks):**
> - reconstrução: mesma contagem de linhas (568), mesma contagem de convênios (15) e mesmo conjunto de impedimentos categorizados;
> - comparador: diferença líquida total de saldo idêntica à da pré-checagem (tolerância ≤ R$ 1,00);
> - segurança final: `pendenciaOperacionalReal = 0`, `totalBloqueiosAtivos = 0`, `aptoParaAtivacaoControlada = true`;
> - validações: `validar:syntax` OK e `validar:services` OK (130/130).

## 12. Critérios de sucesso

A ativação é considerada **bem-sucedida** **somente se** todas as condições abaixo forem verdadeiras, **na mesma janela**:

1. todas as pré-condições da seção 3 estavam satisfeitas no início da janela;
2. todos os backups da seção 9 foram concluídos com hash registrado e aceitos pelo revisor de segurança técnica;
3. apenas os arquivos previstos na ativação (ex.: catálogo/flag de origem) foram alterados; nenhum arquivo de `frontend/data/publicados/`, `*.sqlite*`, decisões, divergências ou logs foi tocado;
4. `git status --short` pós-ativação contém **somente** o arquivo da ativação prevista;
5. todas as auditorias da seção 11 retornaram dentro das tolerâncias declaradas;
6. `validar:syntax` OK e `validar:services` OK;
7. revisor de segurança técnica atestou por escrito o aceite formal;
8. responsável funcional atestou por escrito o aceite formal;
9. nenhum aviso real foi mascarado, suprimido ou rebatizado.

Sem todos os nove itens, **a janela termina em rollback obrigatório**.

## 13. Critérios de parada (abortar e ir direto para rollback)

Abortar imediatamente e acionar a seção 14 se qualquer um dos eventos abaixo ocorrer:

1. qualquer pré-condição da seção 3 falhar dentro da janela;
2. qualquer backup da seção 9 falhar, retornar tamanho zero ou divergir em hash entre origem e cópia;
3. ativação tentar alterar `frontend/data/publicados/`, `backend/data/onasp.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, decisões, divergências ou logs;
4. ativação disparar (ou conter referência ativa a) qualquer script de publicação ou Transferegov;
5. auditorias pós-ativação reportarem `pendenciaOperacionalReal > 0` ou `totalBloqueiosAtivos > 0`;
6. comparador pós-ativação apresentar diferença líquida total de saldo divergente da pré-checagem além da tolerância de R$ 1,00;
7. `validar:syntax` falhar ou `validar:services` apresentar qualquer teste em falha;
8. surgir divergência nova ou regressão de divergência previamente saneada (`#18`, `#25–#28`, `#75`, `#77`, `#78`, `#39`, `#44`, `#47–#74`);
9. surgir mensagem operacional cujo significado não tenha sido confirmado pelo revisor de segurança técnica e pelo responsável funcional;
10. perda de comunicação com responsável funcional ou revisor de segurança técnica antes do aceite formal.

## 14. Critérios e procedimento de rollback

> Rollback deve restaurar o estado **idêntico** ao início da janela, sem perda de decisões, divergências ou logs.

```bash
# 14.1. Reverter o commit de ativação (se houve commit)
git revert <sha-do-commit-de-ativacao>

# 14.2. Se houve alteração no SQLite, restaurar a partir do backup íntegro
#       Conferir hash antes de substituir
Get-FileHash backend/data/onasp.sqlite -Algorithm SHA256
Get-FileHash "<RET>/onasp.sqlite.pre-ativacao-<TS>" -Algorithm SHA256
cp -p "<RET>/onasp.sqlite.pre-ativacao-<TS>" backend/data/onasp.sqlite

# 14.3. Se houve alteração em frontend/data/publicados (não deveria), restaurar a partir do backup
robocopy "<RET>/publicados.pre-ativacao-<TS>" frontend/data/publicados /E /COPY:DAT /PURGE /R:1 /W:1

# 14.4. Reexecutar a bateria dry-run completa para confirmar restauro
npm run profor:pad:auditar-pendencias-profundo
npm run profor:pad:seguranca-pre-ativacao:final
npm run profor:pad:reconstruir-plano:dry-run
npm run profor:pad:comparar-plano:dry-run
npm run validar:syntax
npm run validar:services
git diff --check
git status --short frontend/data/publicados
git status --short "*.sqlite*"
git status --short "*.sqlite-wal"
git status --short "*.sqlite-shm"
```

**Pós-rollback:** registrar entrada em `memoria/00_DIARIO_DE_BORDO/diario-atual.md` e, **somente se houver erro novo**, em `memoria/09_ERROS_E_CORRECOES/historico-erros.md`. Nenhuma decisão, log ou divergência pode ser apagada durante o rollback.

## 15. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Substituição da origem alterar inadvertidamente o `planoAplicacao` exibido na aplicação antes do aceite formal | Baixa | Alto | Rodar ativação fora de horário de uso; manter fallback explícito para origem antiga; abortar à primeira divergência inesperada. |
| R2 | Script de ativação acoplar publicação automática | Baixa | Crítico | PR de ativação **exclusivo**, sem outros arquivos; review obrigatório do revisor de segurança técnica; critério de parada n.º 4. |
| R3 | Backup do SQLite gerado durante checkpoint WAL incompleto | Baixa | Crítico | Confirmar ausência de processo escrevendo no SQLite no instante do backup; copiar também WAL/SHM se existirem; conferir hash. |
| R4 | Diferenças críticas pós-ativação fora da tolerância (regressão de saneamento) | Baixa | Alto | Comparar contagens e diferença líquida com a pré-checagem; abortar e rollback se divergir além da tolerância. |
| R5 | Perda de comunicação com responsável funcional/revisor durante a janela | Média | Alto | Pré-aviso de 24 h; janela acordada por escrito; abortar e rollback ao primeiro sinal de indisponibilidade. |
| R6 | Tentativa indevida de avançar para automação Transferegov dentro da janela | Baixa | Crítico | Proibição expressa neste roteiro (seção 20); critério de parada n.º 4. |
| R7 | Alteração em `frontend/data/publicados/` causada por hook, watcher ou script colateral | Baixa | Crítico | Monitorar `git status --short frontend/data/publicados` antes, durante e depois; critério de parada n.º 3. |
| R8 | Versionamento acidental de `*.sqlite-wal`/`*.sqlite-shm` | Baixa | Médio | Conferir `git status --short "*.sqlite-wal"` e `"*.sqlite-shm"`; critério de parada n.º 3. |
| R9 | Mascaramento involuntário de alerta real por reclassificação rápida | Baixa | Alto | Toda reclassificação na janela exige aceite do responsável funcional e do revisor de segurança técnica; proibido criar nova categoria sem PR específico fora da janela. |

## 16. Plano de comunicação

1. **D-1 (24 h antes da janela):** envio formal por escrito ao responsável funcional, revisor de segurança técnica e custódia de backups com: janela, escopo, este roteiro, hashes do estado atual de SQLite e `publicados/`, e ponto de contato durante a janela.
2. **D-0 abertura:** check-in textual confirmando presença dos três papéis; reexecução completa da seção 8 ao vivo; leitura cruzada dos resultados.
3. **Durante a janela:** registro textual de cada bloco executado, com horário, comando exato e resumo do retorno.
4. **Após backup (seção 9) e antes da ativação (seção 10):** aceite explícito do revisor de segurança técnica autorizando o início da seção 10.
5. **Após validação pós-ativação (seção 11):** aceite explícito do responsável funcional autorizando o encerramento da janela com sucesso; **ou** acionamento imediato da seção 14.
6. **Pós-janela (até D+1):** envio do registro consolidado da janela ao responsável funcional e ao revisor; atualização do diário e da documentação da funcionalidade.

## 17. Evidências a guardar

Guardar em `<RET>/`, fora do repositório, durante o tempo de retenção institucional:

1. Saídas completas dos comandos da seção 8 (pré-checks).
2. Hashes SHA-256 de SQLite, WAL/SHM (se existirem), planilha de origem ativa e diretório `publicados/`.
3. Arquivo de hashes agregados do `publicados/` pré-ativação.
4. Saídas completas dos comandos da seção 11 (pós-ativação).
5. Cópia local dos relatórios de prontidão e segurança final no instante da janela.
6. Texto integral do aceite formal (revisor e responsável funcional) ou, em caso de aborto, do gatilho que disparou a parada.
7. `git log --oneline -20` e `git status --short` antes e depois.
8. Em caso de rollback: SHA do `git revert`, hashes pós-restauro e nova bateria dry-run completa.

## 18. Próxima etapa após ativação validada

> Estas etapas **só** podem ser planejadas após a ativação ter sido formalmente aceita conforme seção 12 e o registro consolidado da janela ter sido publicado no diário e na documentação da funcionalidade.

1. **Janela isolada de publicação** (autorização própria, com seu próprio roteiro): chamadas controladas a `npm run publicar:profor-2022` e/ou `npm run publicar:dados`, com backup do `frontend/data/publicados/` e validação pós-publicação por amostragem.
2. **Acompanhamento operacional** por pelo menos uma semana após a ativação, com `npm run profor:pad:seguranca-pre-ativacao:final` rodado diariamente; qualquer surgimento de `bloqueio técnico ativo > 0` reabre o ciclo e exige decisão formal.
3. **Documentação de aceite definitivo** da nova origem na seção pertinente de `memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-automacao-planos-aplicacao.md`.
4. **Encerramento formal da frente** PAD/PROFOR 2022 quanto à substituição das abas/guias por UF, mantendo abertas apenas a publicação e o monitoramento.

## 19. Proibição expressa de publicação automática

A ativação controlada **não publica**. O script ou patch de ativação **não pode** chamar, importar, agendar ou enfileirar:

- `backend/scripts/publicar-dados-estaticos.js` (script `publicar:dados`);
- `backend/scripts/publicar-profor-2022-estatico.js` (script `publicar:profor-2022`);
- qualquer outro caminho que escreva em `frontend/data/publicados/`;
- qualquer rotina de atualização consolidada que disparemente, como efeito colateral, gravação em `frontend/data/publicados/`.

A publicação é **etapa posterior**, com **autorização própria** e **janela própria**, descrita resumidamente em §18 e detalhada em roteiro a ser elaborado **após** a ativação aceita.

## 20. Proibição expressa de automação Transferegov nesta fase

Dentro desta janela e dentro do escopo deste roteiro, **estão proibidos**:

- `npm run atualizar:rendimentos-profor`;
- `npm run agendar:detru-profor` e `npm run agendar:profor-2022`;
- quaisquer chamadas a serviços Transferegov, DETRU, autenticação federada ou jobs automáticos correlatos.

O avanço para automação Transferegov é frente separada, **não habilitada** pela conclusão da ativação controlada do PAD/PROFOR 2022. Mesmo após a publicação posterior, a automação Transferegov continuará exigindo **roteiro próprio, autorização própria e janela própria**.

---

## Checklist objetivo para execução manual futura

> Imprimir/exportar; marcar item a item durante a janela. **Não executar nada nesta etapa.**

- [ ] **Pré-condições** (seção 3) — todas verificadas e registradas: `__ / 10`.
- [ ] **Autorização escrita** do responsável funcional e do revisor de segurança técnica recebida.
- [ ] **Pré-checks** (seção 8) — comandos executados e resultados dentro das tolerâncias.
- [ ] **Backups** (seção 9) — todos os artefatos copiados, com hash SHA-256 registrado em `<RET>/`.
- [ ] **Aceite do backup** pelo revisor de segurança técnica.
- [ ] **Ativação** (seção 10) — executada **somente** após aceite do backup; apenas o arquivo da ativação prevista foi modificado.
- [ ] **Validações pós-ativação** (seção 11) — auditorias, sintaxe e serviços dentro das tolerâncias.
- [ ] **Critérios de sucesso** (seção 12) — todos os 9 itens satisfeitos.
- [ ] **Aceite formal** do responsável funcional e do revisor de segurança técnica registrado por escrito.
- [ ] **Evidências** (seção 17) — todas guardadas em `<RET>/`.
- [ ] **Diário** atualizado com SHA do commit de ativação e hashes dos backups.
- [ ] **Documentação da funcionalidade** atualizada com o aceite definitivo.
- [ ] **Próxima etapa de publicação** (seção 18) **não** iniciada na mesma janela.
- [ ] **Em caso de falha de qualquer critério** — seção 14 (rollback) executada integralmente; janela encerrada com registro do gatilho.

---

## Bloco final — confirmação de aplicabilidade

Este roteiro é **apenas documentação**. A próxima etapa concreta é a **autorização expressa por escrito** do responsável funcional e do revisor de segurança técnica para a execução, em janela separada, dos blocos 8 → 9 → 10 → 11 → 12 deste roteiro, na ordem apresentada, com **rollback obrigatório** ao primeiro gatilho da seção 13.
