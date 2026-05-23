# PROFOR 2022 - Promoção de snapshot, fila oficial e rateio na reconstrução (dry-run)

## Contexto

Continuação preparatória da frente PAD/PROFOR 2022 após a política de snapshots, fila de revisão por snapshots e rateio por quantidade fixa.

## Objetivo

Preparar, sem executar efeitos operacionais:

- auditoria de promoção controlada do snapshot anterior oficial;
- integração de candidatos de snapshots à fila oficial de revisão PAD;
- integração do rateio por quantidade fixa à reconstrução dry-run.

## Promoção de snapshot anterior oficial

Script criado:

- `backend/scripts/auditar-promocao-snapshot-anterior-oficial-pad-profor-2022.js`.

Relatórios:

- `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-auditoria-promocao-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-auditoria-promocao-dry-run.md`.

Resultado: o snapshot atual não foi promovido. A aprovação humana expressa permanece ausente nesta etapa, e o script não copia nem cria `profor-2022-pad-fotografia-canonica-anterior.json`.

## Integração com fila oficial

Serviço criado:

- `backend/services/profor-2022/profor-pad-integracao-fila-oficial-dry-run-service.js`.

Script criado:

- `backend/scripts/simular-integracao-fila-oficial-snapshots-pad-profor-2022.js`.

Relatórios:

- `backend/data/relatorios/profor-2022-pad-integracao-fila-oficial-snapshots-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-integracao-fila-oficial-snapshots-dry-run.md`.

Resultado: como a comparação de snapshots está indisponível, não há candidatos integráveis. Nenhum schema oficial foi inventado e nenhuma fila real foi alterada.

## Rateio fixo na reconstrução dry-run

Serviço criado:

- `backend/services/profor-2022/profor-pad-rateio-quantidade-fixa-reconstrucao-dry-run-service.js`.

Script criado:

- `backend/scripts/simular-reconstrucao-com-rateio-quantidade-fixa-pad-profor-2022.js`.

Relatórios:

- `backend/data/relatorios/profor-2022-pad-reconstrucao-com-rateio-quantidade-fixa-dry-run.json`;
- `backend/data/relatorios/profor-2022-pad-reconstrucao-com-rateio-quantidade-fixa-dry-run.md`.

Resultado: simulação com 3 itens controlados, 2 aptos e 1 bloqueado por soma de rateio superior à quantidade total.

## Testes

- `tests/services/profor-pad-promocao-snapshot-anterior.test.js`;
- `tests/services/profor-pad-integracao-fila-oficial-dry-run.test.js`;
- `tests/services/profor-pad-rateio-fixo-reconstrucao-dry-run.test.js`.

## Validações

- `git diff --check` - OK, apenas avisos LF/CRLF.
- `npm run validar:syntax` - OK, 97 arquivos.
- `npm run validar:services` - OK, 196/196 testes.
- `npm run profor:pad:snapshot-anterior:auditar-promocao:dry-run` - OK, sem promoção.
- `npm run profor:pad:snapshots:simular-integracao-fila-oficial:dry-run` - OK, sem candidatos integráveis.
- `npm run profor:pad:reconstruir-com-rateio-fixo:dry-run` - OK, 3 itens simulados e 1 bloqueio.

## Preservações

- `frontend/data/publicados/` não deve ser alterado.
- `.env` não deve ser alterado nem exibido.
- SQLite/WAL/SHM não devem ser alterados.
- Transferegov não deve ser acionado.
- Nenhuma decisão deve ser registrada.
- Fila oficial real não deve ser alterada.
- Plano de aplicação oficial não deve ser alterado.

## Limitações

- Sem aprovação humana expressa, não há promoção de snapshot anterior oficial.
- Sem comparação de snapshots disponível, não há candidatos integráveis.
- A simulação de reconstrução com rateio fixo usa amostras controladas, sem alterar o reconstrutor oficial.

## Risco de regressão

Baixo. Os fluxos são serviços puros e scripts dry-run com escrita restrita a relatórios.

## Rollback

Reverter os commits desta etapa e regenerar os dry-runs. Não apagar snapshots, relatórios históricos, decisões, divergências ou logs.

## Próximos passos

- Registrar aprovação humana expressa caso o snapshot atual seja promovido futuramente.
- Definir contrato real da fila oficial antes de qualquer persistência.
- Integrar rateio fixo ao reconstrutor oficial apenas em novo ciclo dry-run, com testes de dados reais e sem publicação.
