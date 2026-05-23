# PROFOR 2022 - Política de snapshots PAD

## Estado desta etapa

Snapshot anterior oficial ainda não promovido nesta etapa.

Esta política define o uso de snapshots PAD como artefatos técnicos de comparação, sem efeito automático sobre decisões humanas, banco de dados, publicação ou `planoAplicacao` oficial.

## Conceitos

- `snapshot_atual`: fotografia canônica PAD gerada pelo dry-run corrente.
- `snapshot_candidato`: snapshot atual que atende aos critérios técnicos mínimos para análise de promoção.
- `snapshot_anterior_oficial`: fotografia homologada usada como base de comparação futura.
- `snapshot_temporario`: snapshot gerado para teste, investigação ou simulação, sem validade oficial.
- `snapshot_homologado`: snapshot aprovado humanamente e vinculado a commit de referência.
- `snapshot_rejeitado`: snapshot que falhou em validação técnica, material ou operacional.

## Requisitos mínimos para promoção

Um snapshot só pode ser promovido a `snapshot_anterior_oficial` se possuir:

- `versaoSnapshot`;
- `checksum`;
- `parserVersao`;
- `origem`;
- `geradoEm`;
- `resumo.totalLinhas`;
- `planoAplicacao` não vazio;
- checksum validável contra o conteúdo do snapshot;
- origem rastreável;
- commit de referência;
- relatório Markdown correspondente;
- validações registradas;
- ausência de erros críticos não tratados;
- avisos classificados;
- aprovação humana expressa registrada no diário de bordo ou relatório próprio.

## Proibições

- Não promover snapshot temporário.
- Não promover snapshot com checksum inválido.
- Não promover snapshot sem origem.
- Não promover snapshot sem commit de referência.
- Não sobrescrever snapshot anterior oficial silenciosamente.
- Não usar snapshot anterior oficial para publicar dados automaticamente.
- Não tratar snapshot anterior oficial como decisão humana.
- Não tratar snapshot anterior oficial como `planoAplicacao` oficial.

## Padrão de arquivos

Snapshot atual:

- `backend/data/relatorios/profor-2022-pad-fotografia-canonica.json`;
- `backend/data/relatorios/profor-2022-pad-fotografia-canonica.md`.

Snapshot anterior oficial:

- `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json`;
- `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.md`.

Registro de promoção:

- `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.md`;
- `backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.json`.

## Processo de promoção

1. Gerar snapshot atual.
2. Validar checksum.
3. Validar sintaxe.
4. Validar serviços.
5. Executar comparador dry-run.
6. Revisar avisos e erros.
7. Confirmar preservação de `frontend/data/publicados/`, `.env`, SQLite/WAL/SHM e Transferegov.
8. Registrar aprovação humana expressa.
9. Copiar snapshot atual para snapshot anterior oficial.
10. Registrar hash antes/depois.
11. Registrar commit.
12. Atualizar diário de bordo.

## Imutabilidade

O snapshot anterior oficial não deve ser editado manualmente. Qualquer substituição deve ser documentada, vinculada a commit, validada por checksum e registrada sem sobrescrita silenciosa.

## Política de comparação

Se não houver snapshot anterior oficial, o comparador deve gerar apenas snapshot atual e aviso de impossibilidade de comparação. Não deve inventar divergências nem usar snapshot temporário como oficial sem promoção formal.

## Preservações

Esta política não autoriza publicação, decisão, alteração de origem ativa, escrita no banco, migration ou acionamento do Transferegov.
