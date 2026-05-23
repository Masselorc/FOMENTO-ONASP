# PROFOR 2022 - Política de snapshots, fila de revisão e rateio fixo

## 1. Contexto

Continuação da frente de fotografia canônica PAD v0.2 e comparador de snapshots PAD v0.2. Esta etapa mantém o trabalho em dry-run, sem decisão automática, sem banco e sem publicação.

## 2. Objetivo

Definir política de snapshots PAD, converter divergências e bloqueios do comparador em candidatos de revisão dry-run e implementar simulação pura de rateio por área + quantidade fixa.

## 3. Política de snapshots PAD

A política foi registrada em:

- `backend/data/relatorios/profor-2022-pad-politica-snapshots.md`;
- `backend/data/relatorios/profor-2022-pad-politica-snapshots.json`.

O snapshot anterior oficial não foi promovido nesta etapa.

## 4. Requisitos de snapshot anterior oficial

Para promoção futura são exigidos `versaoSnapshot`, `checksum`, `parserVersao`, `origem`, `geradoEm`, `resumo.totalLinhas`, `planoAplicacao` não vazio, checksum validável, origem rastreável, commit de referência, relatório Markdown correspondente, validações registradas, ausência de erros críticos não tratados, avisos classificados e aprovação humana expressa.

## 5. Promoção, imutabilidade e substituição

Snapshot temporário não pode ser promovido. Snapshot anterior oficial não deve ser editado manualmente nem sobrescrito silenciosamente. Toda substituição deve registrar checksum antes/depois, commit de referência, validações e aprovação humana.

## 6. Política de comparação

Sem snapshot anterior oficial, o comparador gera apenas snapshot atual e aviso de impossibilidade de comparação. A fila de revisão por snapshots preserva esse estado e não cria divergências artificiais.

## 7. Integração do comparador com fila de revisão

Foi criado o serviço:

- `backend/services/profor-2022/profor-pad-fila-revisao-snapshots-service.js`.

Foi criado o script:

- `backend/scripts/gerar-fila-revisao-snapshots-pad-profor-2022.js`.

O script lê `backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.json`, quando existir, e gera a fila dry-run em:

- `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.md`.

Nesta execução, a comparação estava indisponível porque o snapshot anterior oficial ainda não foi promovido; o relatório saiu com 0 candidatos.

## 8. Mapeamento de divergências

- `descricao_apenas_diacritico`: falso positivo saneável.
- `descricao_apenas_textual`: falso positivo saneável.
- `descricao_alterada`: revalidação necessária.
- `quantidade_alterada`: pendência operacional real.
- `valor_unitario_alterado`: revalidação necessária.
- `valor_previsto_alterado`: pendência operacional real.
- `valor_executado_alterado`: revalidação necessária.
- `saldo_alterado`: revalidação necessária.
- `area_alterada`: revalidação necessária.
- `natureza_alterada`: bloqueio técnico de segurança.
- `item_novo`: pendência operacional real.
- `item_removido`: pendência operacional real.
- `checksum_invalido`: bloqueio técnico de segurança.
- `colisao_chave`: bloqueio técnico de segurança.
- `chave_ambigua`: bloqueio técnico de segurança.
- `dados_insuficientes`: bloqueio técnico de segurança.

## 9. Regras de bloqueio técnico

Bloqueios técnicos impedem decisão humana direta no dry-run e exigem revisão técnica prévia. Nenhum candidato é marcado como ACEITO, REJEITADO, CORRIGIDO ou REVERTIDO.

## 10. Modelo de item candidato

Cada candidato contém `idCandidato`, `origem`, `tipoDivergencia`, `categoriaOperacional`, `severidade`, `uf`, `numero`, `area`, `natureza`, descrições anterior/nova, chaves, hashes, valores, bloqueios técnicos, ação sugerida, flags de decisão/rateio/revisão, motivo, referência de snapshot e data de criação.

## 11. Rateio por área + quantidade fixa

Foi criado o serviço puro:

- `backend/services/profor-2022/profor-pad-rateio-quantidade-fixa-service.js`.

Foi criado o script:

- `backend/scripts/simular-rateio-quantidade-fixa-pad-profor-2022.js`.

Regras implementadas:

- quantidade é fonte primária;
- percentual é derivado;
- soma superior à quantidade total gera erro;
- soma inferior gera aviso;
- quantidade negativa gera erro;
- valor rateado = quantidade x valor unitário;
- residual de arredondamento é explícito;
- CAPITAL e CUSTEIO não podem ser misturados;
- nenhuma decisão, banco, reconstrução oficial ou publicação é alterada.

## 12. Scripts dry-run

- `npm run profor:pad:snapshots:gerar-fila-revisao:dry-run`;
- `npm run profor:pad:rateio-quantidade-fixa:dry-run`.

## 13. Relatórios gerados

- `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-fila-revisao-snapshots-dry-run.md`;
- `backend/data/relatorios/profor-2022-pad-rateio-quantidade-fixa-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-rateio-quantidade-fixa-dry-run.md`;
- `backend/data/relatorios/profor-2022-pad-politica-snapshots-fila-revisao-e-rateio-fixo-implementacao.md`.

## 14. Testes executados

- `tests/services/profor-pad-politica-snapshots.test.js`;
- `tests/services/profor-pad-fila-revisao-snapshots.test.js`;
- `tests/services/profor-pad-rateio-quantidade-fixa.test.js`.

## 15. Validações

- `git diff --check` - OK, apenas avisos LF/CRLF.
- `npm run validar:syntax` - OK, 89 arquivos.
- `npm run validar:services` - OK, 188/188 testes.
- `npm run profor:pad:comparar-snapshots:dry-run` - OK.
- `npm run profor:pad:snapshots:gerar-fila-revisao:dry-run` - OK, comparação indisponível sem divergência artificial.
- `npm run profor:pad:rateio-quantidade-fixa:dry-run` - OK, simulação apta.

## 16. Arquivos preservados

- `frontend/data/publicados/`;
- `.env`;
- SQLite/WAL/SHM;
- Transferegov.

## 17. Limitações

- Não há snapshot anterior oficial promovido.
- A fila de revisão por snapshots ainda não grava na fila oficial.
- O rateio por quantidade fixa ainda não altera reconstrução oficial.

## 18. Risco de regressão

Risco baixo: os novos serviços são puros e os scripts escrevem somente relatórios em `backend/data/relatorios/`. A integração futura com fila oficial e reconstrução deve passar por etapa própria.

## 19. Rollback

Reverter os commits desta etapa e regenerar dry-runs. Não apagar relatórios históricos, decisões, divergências, logs ou snapshots oficiais.

## 20. Próximos passos

- Promover snapshot anterior oficial apenas com aprovação humana expressa.
- Integrar candidatos de snapshots com a fila oficial de revisão, quando autorizado.
- Integrar rateio por quantidade fixa à reconstrução dry-run, sem publicação.
