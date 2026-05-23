# PROFOR 2022 — Consolidação documental dos bloqueios pós-promoção do snapshot anterior oficial

## 1. Contexto

Após a promoção controlada do snapshot anterior oficial (commit `93f2b98`), o comparador `profor:pad:comparar-snapshots:dry-run` reportou 568 vs 568 linhas, 555 iguais, 13 itens "novos", 13 itens "removidos", 0 alterados, **R$ 0,00** de diferença financeira líquida e **81 bloqueios técnicos** (38 colisões de chave + 43 chaves ambíguas). A fila dry-run derivada gerou 107 candidatos. **Fila oficial real não foi tocada.**

Estes 81 bloqueios e os 13+13 "novos/removidos" **não constituem problema novo**. Esta consolidação documenta que todos eles têm causa estrutural já registrada em `memoria/09_ERROS_E_CORRECOES/historico-erros.md` e no diário; nenhuma auditoria nova do zero foi feita nesta etapa.

## 2. Causas estruturais já documentadas (mapeamento por categoria)

| Causa estrutural | Onde está documentada | Como se manifesta nos 81 bloqueios |
|---|---|---|
| Chave frágil por descrição (apenas `numero::descricaoNormalizada`) | `historico-erros.md` — "RR-001/RR-004" + auditoria identidade material 22/05/2026 | Pares de itens com mesma chave material (`numero|uf|natureza|area|descricaoNormalizada`) mas conteúdo distinto. Geram `colisao_chave` no índice e impedem pareamento 1:1 pelo `parearPorIndice`. |
| Itens PAD em múltiplas linhas (mesma descrição em ≥ 2 linhas físicas no PAD) | `historico-erros.md` — "Calça Tática" (22/05/2026), "duplicação de rateios #24" | Grupos de 2+ linhas com mesma chave material colidem no índice. Listados como `colisao_chave` e, após pareamento, como `chave_ambigua` por contexto. |
| Saldo residual/remanescente com segregação por natureza obrigatória | `historico-erros.md` — "Saldo Residual pareado sem segregação por natureza" (22/05/2026); "#44 prevalência PAD" | Linhas com `chaveContexto = numero|uf|NAO_INFORMADO|NAO_INFORMADO` agrupam-se em colisão técnica, pois `NAO_INFORMADO` aparece em UF/natureza/área quando o saldo é técnico. Por isso a coluna `porUf` mostra `NAO_INFORMADO: 81`. |
| CAPITAL e CUSTEIO não podem ser fundidos | `historico-erros.md` — "Saldo Residual" | Mantido: nenhum pareamento cross-natureza foi feito. Quando colidem por descrição mas têm naturezas distintas, ficam como `colisao_chave` e/ou `chave_ambigua`. |
| Rateio antigo multiplicava linhas indevidamente | `historico-erros.md` — "duplicação de rateios em itens multi-linha (#24)" (22/05/2026) | Já corrigido na reconstrução (commit do dia 22/05). Não gera bloqueios novos; o que aparece é o reflexo material no snapshot pareado. |
| Falso positivo por quantidade, valor unitário e arredondamento | `historico-erros.md` — "#88/#89/#97/#115 arredondamento" (22/05/2026) | Já tratado por `profor-pad-consistencia-quantidade-service.js`. Não dispara `colisao_chave` aqui; é trilha financeira. |
| Diferença textual/diacrítica não deve virar divergência material | `historico-erros.md` — "CA-004 diacrítico" + comparador `descricao_apenas_diacritico`/`descricao_apenas_textual` | Já tratado pelo próprio comparador. Não aparece nos 81 bloqueios. |
| Item ausente pode ter substituto compatível no PAD | `historico-erros.md` — "CA-005 substitutos" | Já tratado por `profor-pad-substituto-auditoria-service.js`. Não aparece nos 81 bloqueios deste snapshot. |
| Identidade material deve prevalecer sobre chave textual simples | `historico-erros.md` — auditoria identidade material 22/05/2026 | É exatamente o critério aplicado no ajuste do comparador desta etapa (vide §4 e o relatório `profor-2022-pad-ajuste-comparador-bloqueios-controlados.md`). |

## 3. Por que os 13 "novos" e 13 "removidos" não indicam alteração material

Quando o snapshot anterior oficial e o snapshot atual são **byte-a-byte idênticos** (cópia controlada feita no commit `93f2b98`), valem **todas** as condições abaixo simultaneamente:

- total de linhas fecha (568 vs 568);
- totais financeiros agregados fecham (Δ previsto = Δ executado = Δ saldo = **R$ 0,00**);
- não há itens alterados (`totalAlterados = 0`);
- os hashes individuais (`hashItem`) de cada par colidente são **bijetivos** entre os dois snapshots (multiset de hashes do anterior == multiset do novo).

Sob essas condições, os 13 "novos" e 13 "removidos" eram pares colidentes na mesma chave material (`numero|uf|natureza|area|descricaoNormalizada`) que o algoritmo legado de `parearPorIndice` não conseguia parear 1:1 porque exige `disponiveisAnterior.length === 1 && disponiveisNovo.length === 1`. Como cada grupo colidente tem 2+ itens em ambos os lados, o pareamento legado falhava e cada item ia para `item_novo` ou `item_removido` como falso operacional.

Isso é **ruído técnico** do comparador, não divergência material.

## 4. Risco residual e como ele foi tratado

**Risco residual:** os candidatos `item_novo` + `item_removido` na fila dry-run (mapeados em `profor-pad-fila-revisao-snapshots-service.js` como `categoriaOperacional: "pendencia_operacional_real"`) podem ser interpretados por um operador como pendência operacional real, induzindo decisão indevida.

**Tratamento aplicado nesta etapa** (vide `profor-2022-pad-ajuste-comparador-bloqueios-controlados.md`): o comparador ganhou uma **6ª etapa de pareamento** (`parearGruposMateriaisPorHash`) que absorve grupos materiais com colisão preexistente **somente** quando a identidade é bijetiva por `hashItem`. Bloqueios técnicos **não são apagados** — apenas marcados como `ruidoTecnicoControlado=true` e listados em `ruidosTecnicosControlados[]` no relatório. Quando os hashes não batem ou os grupos têm tamanhos diferentes, o comportamento legado preserva a detecção.

## 5. Por que isso não deve gerar pendência operacional real

- O ruído controlado **só ocorre** quando os hashes individuais provam identidade material byte-a-byte (não é diferença R$ 0,00 sozinha).
- A política conservadora da memória já estabelece que diferença material só deve ser declarada quando há divergência financeira agregada **e/ou** alteração de natureza/área/quantidade/valor unitário/previsto/executado/saldo entre itens efetivamente pareados.
- Bloqueios técnicos preexistentes permanecem 100% visíveis (`bloqueiosTecnicos[]` inalterado em quantidade dos 38 `colisao_chave`).
- Os 5 `chave_ambigua` que sumiram são derivados do pareamento por contexto: como o pareamento por hash absorveu os itens pendentes mais cedo, deixou de haver pendentes para o `for` que gera ambiguidade por contexto. Isso é redução de **derivado**, não supressão de bloqueio estrutural.

## 6. A frente de múltiplos arquivos Excel permanece separada

Esta etapa **não inicia** a frente de múltiplos arquivos PAD. As causas estruturais (chave frágil, multi-linha, identidade material) são tratadas apenas no comparador dentro do mesmo snapshot canônico. Qualquer evolução para múltiplos Excel exige roteiro próprio e autorização própria.

## 7. Garantias

- Nenhuma publicação executada.
- `frontend/data/publicados/` não foi alterado.
- `.env` não foi alterado.
- SQLite/WAL/SHM não alterados, não versionados.
- Snapshot atual e snapshot anterior oficial **não foram tocados**.
- `planoAplicacao` oficial não foi alterado.
- Fila oficial real não foi tocada.
- Nenhuma decisão automática registrada.
- Transferegov não foi acionado.

## 8. Validações executadas

- `npm run validar:syntax` → 100 arquivos OK.
- `npm run validar:services` → **225/225** (6 testes novos do ruído controlado).
- `npm run profor:pad:comparar-snapshots:dry-run` → 568 iguais; 0 novos; 0 removidos; 6 ruídos controlados; 76 bloqueios técnicos (38 colisão + 38 ambígua).
- `npm run profor:pad:snapshots:gerar-fila-revisao:dry-run` → 76 candidatos (eram 107).
- `git diff --check` → limpo.
