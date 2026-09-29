# Registros do PAD — Status Final

## 1. Objetivo

Histórico persistente das atualizações do PAD do PROFOR 2022, com snapshots
ANTES/DEPOIS, diferenças pelo comparador existente, memória de classificação
preservada e tela interna “Registros do PAD”. Registra também SEM_ALTERACOES.

Especificação completa: `PLANO_REGISTROS_PAD_PROFOR_2022.md`. Este handoff
operacional não substitui o plano; a trajetória anterior permanece no Git.

## 2. Estado final

- Etapa atual: concluída — Etapa 14.
- Última etapa concluída: Etapa 14 — Documentação, handoff final e commit.
- Próxima etapa: nenhuma — implementação encerrada.
- Etapas: 15/15 concluídas.
- Branch: `main`; baseline auditado da Etapa 13: `d7d49eaa42afe5f326d22850dd186826b16ce1d6`.
- Atualizado em: 29/09/2026 (America/Sao_Paulo).
- Auditoria final: APROVADA; A13-01: FECHADO.
- Estado geral: implementação concluída e auditada no repositório.
- Alterações preexistentes: cache/relatórios PAD, JSONs publicados, script
  staged e `tmp-scan.js` não rastreado; preservadas e fora deste commit.

## 3. Arquitetura final

- Postgres/Supabase via backend e `DATABASE_URL`: três tabelas históricas,
  definidas em `supabase/migrations/20260929163637_create_profor_2022_pad_historico.sql`.
- `profor_2022_pad_atualizacoes`: execução, estado e resumo;
  `profor_2022_pad_snapshots`: ANTES/DEPOIS;
  `profor_2022_pad_alteracoes`: diferenças persistidas.
- `profor-pad-fotografia-service.js` produz snapshots canônicos e
  `profor-pad-comparador-snapshots-service.js` calcula mudanças.
- Memória de itens/rateios e decisões de `vinculo_item_substituto` apoiam a
  classificação sem substituir o sistema de revisão.
- Job Transferegov associa `jobId` e expõe `registroPadId` e
  `resultadoHistorico` no polling; publicação estática vem depois do histórico.
- GET `/api/profor-2022/pad/historico` (mês/data) e
  GET `/api/profor-2022/pad/historico/:id` (detalhe) atendem a tela.
- Subview “Registros do PAD” contém calendário, filtros e comparação; deep-link:
  `?proforSubview=registros-pad&registroPadId=<id>`.
- Modo estático/GitHub Pages não consulta nem publica o histórico operacional.

Referências: `memoria/08_ROTAS_BANCO_API/schema-banco.md`,
`memoria/08_ROTAS_BANCO_API/rotas.md` e
`memoria/01_PROJETO_APLICACAO/funcionalidades/profor-2022-operacao.md`.

## 4. Contratos críticos

- Capturar e persistir ANTES antes de qualquer mutação do cache Transferegov;
  falha nessa fase interrompe o orquestrador.
- Após recarga válida, gerar DEPOIS, comparar e persistir snapshot, alterações
  e conclusão numa transação; recarga inválida marca FALHOU.
- Snapshots e alterações são append-only, sem UPDATE ou purge automático;
  checksum não é chave única global. Finalização de CONCLUIDA é idempotente.
- Snapshot completo inclui linhas reconstruídas e quatro pendências materiais:
  `item_novo_sem_rateio_memorizado`, `item_pad_sem_rateio_memorizado`,
  `rateio_memorizado_sem_peso_operacional` e
  `distribuicao_igual_provisoria_bloqueada`.
- Sem área segura: `NAO_CLASSIFICADO`; substituto só herda classificação
  mediante vínculo efetivo inequívoco; ambiguidades seguem à revisão humana.
  A classificação enriquecida não altera snapshots.
- Ações administrativas PROFOR por loopback real dispensam senha; requisições
  não locais mantêm token, guards e flags. O socket define a origem local.
- `snapshot_json` é persistido no banco, mas não é exposto integralmente
  pela API. O frontend não lê diretamente as tabelas.

## 5. Testes e auditoria

- Etapa 13: A13-01 focado **93 pass / 0 fail / 0 skip**;
  `npm run validar:syntax` aprovado em 110 arquivos; `git diff --check` aprovado.
- Última suíte ampla após A13-01: **628 pass / 6 fail / 20 skip**.
- Seis falhas conhecidas: três ligadas ao ABI de `better-sqlite3` e três
  à expectativa legada de 568 linhas frente às 564 atuais. A diferença
  **568 × 564 é legítima por alteração de PAD/rateio**.
- Os skips dependem de `DATABASE_URL` ausente no processo de teste;
  servidor desligado não foi a causa. Não se identificou nova regressão
  da feature nas verificações executadas.
- Auditoria final da Etapa 13 aprovada no commit
  `d7d49eaa42afe5f326d22850dd186826b16ce1d6`.

## 6. Limitações operacionais conhecidas

- Migration do histórico versionada, **não aplicada ao banco remoto** nesta trilha.
- Banco remoto não acessado nas validações finais; persistência real após
  reinício do backend ainda não validada contra Postgres.
- Falhas da suíte ampla e skips constam acima; não caracterizam regressão
  nova do histórico. Nenhuma publicação estática foi executada nesta etapa.

## 7. Ativação futura

Sequência conceitual para o ambiente alvo, ainda não executada:

1. Revisar e aplicar a migration de forma controlada.
2. Conferir grants e RLS efetivos.
3. Executar validação integrada com Postgres real.
4. Confirmar persistência do histórico após reinício do backend.
5. Validar uma execução PAD controlada e seus snapshots.
6. Só então considerar a operação real plenamente validada.

## 8. Etapas

- [x] Etapa 0 — Preparação da execução
- [x] Etapa 1 — Inspeção dirigida e confirmação da arquitetura
- [x] Etapa 2 — Migration das tabelas de histórico
- [x] Etapa 3 — Repository de histórico
- [x] Etapa 4 — Serviço de histórico e snapshots ANTES/DEPOIS
- [x] Etapa 5 — Estado completo do snapshot
- [x] Etapa 6 — Memória de classificação e substitutos
- [x] Etapa 7 — Integração com o job Transferegov e atomicidade
- [x] Etapa 8 — Remoção da senha local do PROFOR 2022
- [x] Etapa 9 — APIs de leitura do histórico
- [x] Etapa 10 — Tela Registros do PAD
- [x] Etapa 11 — Botão Ver alterações e deep-link
- [x] Etapa 12 — Testes integrados e regressão
- [x] Etapa 13 — Auditoria final de arquitetura e diff
- [x] Etapa 14 — Documentação, handoff final e commit

## 9. Encerramento

**IMPLEMENTAÇÃO CONCLUÍDA NO REPOSITÓRIO E AUDITADA.**

**ATIVAÇÃO/PERSISTÊNCIA EM BANCO REAL AINDA DEPENDE DAS VALIDAÇÕES
OPERACIONAIS LISTADAS.** Nenhuma alegação de produção validada.
