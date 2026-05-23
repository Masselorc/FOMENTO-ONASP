# PROFOR 2022 - Snapshot canônico PAD e comparador v0.2

## Contexto

Esta implementação evolui a fotografia canônica PAD e o comparador de snapshots do PAD/PROFOR 2022 em modo dry-run. A base analisada foi o commit `f277a193 - fotografia`.

## Problemas encontrados na v0.1

- A fotografia não possuía `versaoSnapshot`, `origem`, `parserVersao`, `avisos`, `erros` nem contadores técnicos no resumo.
- Os itens não preservavam `descricaoOriginal` nem expunham `descricaoNormalizada`, `chaveMaterial`, `chaveComparacao` e `hashItem`.
- O comparador usava chave frágil baseada em `numero::descricao::area::natureza`.
- Alterações textuais, acentos e pontuação podiam aparecer como item novo e item removido.
- Checksum inválido apenas alterava `checksumsValidos`, sem bloqueio técnico.
- Colisões de chave podiam ser sobrescritas silenciosamente por `Map.set`.

## Correções implementadas na v0.2

- Fotografia canônica v0.2 com metadados completos e resumo compatível com nomes antigos.
- Normalização controlada de texto, remoção de diacríticos para chaves e preservação da descrição original.
- Geração de `chaveMaterial`, `chaveComparacao`, `chaveContexto` e `hashItem` por linha.
- Checksum estável independente da ordem de entrada.
- Detecção de `dados_insuficientes`, `colisao_chave`, `chave_ambigua`, `valor_invalido` e `quantidade_invalida`.
- Comparador v0.2 com bloqueios técnicos, divergências tipadas e agregações por tipo, UF e natureza.

## Modelo da fotografia canônica

O snapshot gerado em `backend/data/relatorios/profor-2022-pad-fotografia-canonica.json` contém:

- `versaoSnapshot: "0.2"`;
- `origem: "reconstrucao-pad"`;
- `parserVersao: "profor-pad-fotografia-service@0.2"`;
- `checksum`;
- `resumo` com totais novos e aliases antigos;
- `avisos`;
- `erros`;
- `planoAplicacao`.

Cada item contém os campos canônicos anteriores e os campos adicionais:

- `descricaoOriginal`;
- `descricaoNormalizada`;
- `chaveMaterial`;
- `chaveComparacao`;
- `chaveContexto`;
- `hashItem`;
- `avisos`.

## Regras de normalização

- Descrição original é preservada com trim e colapso de espaços.
- Descrição normalizada usa caixa alta, trim e colapso de espaços.
- Chaves removem diacríticos, pontuação leve e espaços duplicados.
- `1.0`, `"1.0"` e `1` normalizam para quantidade `1`.
- Valores monetários usam arredondamento do serviço PROFOR existente.
- `CAPITAL` e `CUSTEIO` permanecem separados.
- Campos vazios, traço e `N/A` são tratados como ausência sem descarte silencioso.

## Regras de chave

- `chaveMaterial`: `numero|uf|natureza|area|descricao sem diacrítico`.
- `chaveComparacao`: `numero|uf|natureza|area|tokens da descrição`.
- `chaveContexto`: `numero|uf|natureza|area`.
- `hashItem`: SHA-256 de campos materiais normalizados.

## Regras do comparador

O comparador usa pareamento em camadas:

- `chaveMaterial`;
- `chaveComparacao`;
- `chaveContexto`;
- chave sem natureza, para detectar `natureza_alterada`;
- chave sem área, para detectar `area_alterada`.

O comparador preserva compatibilidade com `itensNovos`, `itensAusentes`, `itensAlterados` e `diferencasAgregadas`.

## Tipos de divergência implementados

- `item_novo`;
- `item_removido`;
- `descricao_alterada`;
- `descricao_apenas_textual`;
- `descricao_apenas_diacritico`;
- `quantidade_alterada`;
- `valor_unitario_alterado`;
- `valor_previsto_alterado`;
- `valor_executado_alterado`;
- `saldo_alterado`;
- `natureza_alterada`;
- `area_alterada`;
- `chave_ambigua`;
- `colisao_chave`;
- `dados_insuficientes`;
- `checksum_invalido`.

## Bloqueios técnicos

Geram `bloqueiosTecnicos`:

- checksum inválido;
- colisão de chave;
- chave ambígua;
- dados insuficientes;
- valor inválido;
- quantidade inválida.

## Relatórios gerados

- `backend/data/relatorios/profor-2022-pad-fotografia-canonica.json`;
- `backend/data/relatorios/profor-2022-pad-fotografia-canonica.md`;
- `backend/data/relatorios/profor-2022-pad-snapshot-e-comparador-implementacao.md`.

Os relatórios de comparação `profor-2022-pad-comparacao-snapshots-dry-run.{json,md}` só são gerados quando existir `backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json`.

## Testes executados

- `node --test tests/services/profor-pad-fotografia.test.js tests/services/profor-pad-comparador-snapshots.test.js`.
- `npm run validar:services` - OK, 173/173 testes.

## Validações executadas

- `git diff --check` - OK, apenas avisos LF/CRLF.
- `npm run validar:syntax` - OK, 81 arquivos.
- `npm run validar:services` - OK, 173/173 testes.
- `npm run profor:pad:comparar-snapshots:dry-run` - OK, fotografia canônica v0.2 gerada com 568 linhas.

## Arquivos preservados

- `frontend/data/publicados/`;
- `.env`;
- `backend/data/onasp.sqlite`;
- arquivos `*.sqlite-wal`;
- arquivos `*.sqlite-shm`.

Não houve publicação, alteração de origem ativa, migration, SQL direto ou acionamento do Transferegov.

## Limitações remanescentes

- Sem snapshot anterior versionado, a comparação PAD anterior x PAD novo não é emitida neste dry-run.
- Integração com fila de revisão ainda depende de etapa futura.
- Rateio por área e quantidade fixa continuam fora desta implementação.

## Risco de regressão

Risco baixo a moderado no comparador: mudanças de pareamento podem alterar a classificação de divergências futuras. A mitigação aplicada foi manter os campos antigos de saída e ampliar testes unitários sobre normalização, materialidade e bloqueios técnicos.

## Rollback

Reverter os commits desta etapa e regenerar os relatórios dry-run. Não apagar snapshots históricos, decisões, divergências, logs ou relatórios já versionados.

## Próximos passos

- Integrar a classificação de snapshot com fila de revisão PAD, quando autorizada.
- Definir política operacional para manter snapshots anteriores versionados.
- Evoluir tratamento de rateio por área e quantidade fixa em frente própria.
