# Fechamento tecnico - Migracao PAD/PROFOR 2022 para Postgres

## 1. Resumo executivo

A migracao operacional SQLite -> Postgres do fluxo PAD/PROFOR 2022 foi concluida. Os fluxos ativos de revisao, decisoes, rateios, saneamentos, reconstrucao e recarga operacional nao dependem mais de SQLite.

A homologacao funcional D5 foi aprovada localmente, com recarga PAD concluida sem erro critico e sem publicacao de dados. A pendencia remanescente e de ambiente: a validacao local com `sslmode=require` ainda depende do certificado CA oficial do projeto Supabase configurado via `NODE_EXTRA_CA_CERTS`.

## 2. Escopo migrado

- Revisao PAD.
- Divergencias.
- Decisoes.
- Logs.
- Lotes.
- Rateios.
- Itens conhecidos.
- Carteira monitorada.
- Saneamentos.
- Reconstrucao.
- Recarga operacional.
- Seguranca pre-ativacao.
- Boot Postgres-only.
- Scripts sensiveis com guard.

## 3. PRs e commits

| PR | Branch | Escopo | Merge commit | Resultado |
|---|---|---|---|---|
| #14 | `refactor/profor-2022-pad-rateios-writes-postgres` | Conversao da escrita de rateios PAD para Postgres. | `20c47d1` | Escritas de rateios migradas para Postgres. |
| #15 | `refactor/profor-2022-pad-saneamento-antigo-postgres` | Saneamento antigo de rateios para Postgres. | `7878a09` | Saneamento antigo migrado para Postgres. |
| #16 | `refactor/sqlite-residual-postgres-final` | Eliminacao de residuos SQLite operacionais. | `68e2d79324c8e6500c13e644a33c4b8f34905404` | Fluxos operacionais sem residuos SQLite bloqueantes. |
| #17 | `chore/sqlite-legado-guards-remocao-morta` | Remocao de legados SQLite sem consumidor e guards para scripts remanescentes. | `4fbc263408853700de01de866499cfc0e86bf682` | Legados sem consumidor removidos e scripts sensiveis protegidos. |

## 4. Validacoes realizadas

- `validar:syntax`: aprovado.
- `validar:services` sem `DATABASE_URL`: aprovado.
- `validar:services` com `DATABASE_URL` e Postgres real: aprovado com `sslmode=no-verify` apenas para diagnostico local autorizado, `436/436`.
- Varreduras SQLite pos-merge: sem bloqueantes em fluxo ativo.
- Recarga funcional D5: aprovada com 15 instrumentos, 525 itens, 568 linhas reconstruidas e 525 rateios aplicados.

## 5. Homologacao D5

Resultado da recarga PAD local:

- `sucesso=true`.
- `aptoParaUsoLocal=true`.
- `aptoParaPublicacao=false`.
- Origem: `cache_transferegov`.
- 15 instrumentos encontrados e lidos.
- 525 itens processados.
- 568 linhas reconstruidas.
- 525 rateios aplicados.
- 0 itens novos sem rateio.
- 0 pendencias de revisao na recarga real.
- 0 impedimentos.
- 0 alertas.
- 29 itens suprimidos tratados sem erro indevido.

Confirmacoes negativas de seguranca:

- Nao publicou dados.
- Nao consultou DETRU.
- Nao consultou Transferegov em tempo real.
- Nao alterou `frontend/data/publicados`.
- Nao alterou planoAplicacao oficial.
- Nao executou scripts com `--aplicar`.
- Relatorios regenerados pela validacao foram restaurados.

## 6. Residuos e pendencias

### Pendencia de ambiente

- `sslmode=require` ainda depende do certificado CA oficial do projeto Supabase configurado via `NODE_EXTRA_CA_CERTS`.
- `sslmode=no-verify` foi usado apenas para diagnostico local autorizado.
- A solucao permanente e obter o Server root certificate do projeto Supabase e configurar o ambiente do terminal fora do repositorio.

### Legado tecnico tolerado

- `backend/db/database.js`.
- `backend/db/init-db.js`.
- Dependencia `better-sqlite3`.
- Scripts SQLite remanescentes protegidos por guard.
- Documentacao e memoria historica.

### Scripts legados protegidos por guard

Scripts sensiveis remanescentes exigem confirmacao explicita antes de qualquer acao real. Esse desenho reduz o risco de escrita acidental enquanto o destino definitivo dos legados nao for decidido.

### Documentacao historica

Trechos historicos sobre SQLite, planilha antiga, banco-cache legado e comparadores antigos permanecem como memoria tecnica. Eles nao devem ser tratados como orientacao operacional vigente.

## 7. Riscos residuais

| Risco | Classificacao | Situacao |
|---|---|---|
| Operacional | Baixo | D5 local aprovada e recarga operacional validada. |
| Ambiente | Medio | CA/TLS local ainda pendente para `sslmode=require`. |
| Scripts legados | Controlado | Scripts sensiveis protegidos por guard. |
| Publicacao indevida | Mitigado | Recarga PAD nao publica dados e retornou `aptoParaPublicacao=false`. |

## 8. Rollback

Rollback dos merges principais:

```bash
git revert -m 1 4fbc263
git revert -m 1 68e2d79
git revert -m 1 7878a09
```

Os PRs sao encadeados. Qualquer rollback deve ser planejado, validado em branch propria e acompanhado de nova homologacao funcional do fluxo PAD/PROFOR 2022.

## 9. Proximas etapas recomendadas

- Resolver CA/TLS via certificado oficial Supabase e `NODE_EXTRA_CA_CERTS`, se necessario para uso permanente local.
- Decidir futuramente se scripts SQLite legados serao removidos ou migrados.
- Nao priorizar a remocao de `better-sqlite3` antes de decidir o destino dos scripts legados.
- Manter PAD/reconstrucao como origem operacional do PROFOR 2022.
