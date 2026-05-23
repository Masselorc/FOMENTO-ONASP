# PROFOR 2022 — Ajuste do comparador de snapshots para reduzir divergências artificiais por colisão de chave preexistente

## 1. Contexto

Comparador de snapshots PAD/PROFOR 2022 v0.3 (`backend/services/profor-2022/profor-pad-comparador-snapshots-service.js`). Etapa de **redução de ruído** identificada após a promoção do snapshot anterior oficial: quando snapshots têm colisões de chave material preexistentes, o algoritmo de pareamento 1:1 falhava para grupos colidentes e produzia `item_novo` + `item_removido` artificiais.

## 2. Problema

`parearPorIndice` exige `disponiveisAnterior.length === 1 && disponiveisNovo.length === 1`. Grupos com 2+ itens no mesmo `chaveMaterial` (situação herdada de chave frágil / multi-linha / saldo residual técnico) **não pareiam**. Cada item pendente vira `item_novo` (no novo) ou `item_removido` (no anterior), mesmo quando os itens são **byte-a-byte idênticos** entre os dois snapshots.

Na fila dry-run (`profor-pad-fila-revisao-snapshots-service.js`), `item_novo` e `item_removido` mapeiam para `categoriaOperacional: "pendencia_operacional_real"` — gerando candidatos operacionais artificiais.

## 3. Critério aplicado (estrito)

Foi adicionada uma **sexta etapa de pareamento** após as 5 etapas existentes, executada **apenas** sob todas as condições:

1. mesma `chaveMaterial` em ambos os snapshots;
2. ambos os grupos colidem (≥ 2 itens em ambos os lados);
3. mesmo número de itens pendentes em ambos os lados;
4. todos os itens têm `hashItem` (identidade material já calculada pelo `profor-pad-fotografia-service`);
5. multiset de `hashItem` do anterior é **bijetivo** com o multiset do novo (idêntica contagem por hash).

Se todos os 5 critérios são satisfeitos, os itens são pareados 1:1 por hash com `origemPareamento: "grupo_material_ruido_chave_preexistente"`, **sem** gerar `item_novo`/`item_removido` para esse grupo.

## 4. O que NÃO foi alterado

- **Bloqueios técnicos não são apagados.** Os bloqueios `colisao_chave` produzidos por `indexarSnapshotPorChaves` permanecem em `bloqueiosTecnicos[]`. Apenas recebem a marca `ruidoTecnicoControlado=true` + `motivoRuido="identidade_material_bijetiva_por_hashItem"` para visibilidade.
- **Validação de segurança não foi reduzida.** Checksum continua sendo validado; `chave_ambigua`, `dados_insuficientes`, divergência de natureza/área/quantidade/valores continuam sendo classificados como antes.
- **Diferença financeira agregada R$ 0,00 não foi usada como critério único.** O critério é `hashItem` bijetivo (identidade material byte-a-byte por item), não diferença agregada.
- **Snapshot atual e snapshot anterior oficial não foram tocados.**
- **`planoAplicacao` oficial e `frontend/data/publicados/` não foram alterados.**
- **Fila oficial real não foi tocada.**

## 5. Resultado antes/depois (snapshots reais)

| Métrica | Antes (v0.2) | Depois (v0.3) |
|---|---:|---:|
| Versão do comparador | 0.2 | **0.3** |
| Itens iguais | 555 | **568** |
| Itens novos | 13 | **0** |
| Itens removidos | 13 | **0** |
| Itens alterados | 0 | 0 |
| Bloqueios técnicos | 81 (38 colisão + 43 ambígua) | **76 (38 colisão + 38 ambígua)** |
| Ruídos técnicos controlados | n/a | **6** |
| Bloqueios `colisao_chave` marcados como ruído controlado | 0 | **38** (todos os do grupo absorvido pelos 6 ruídos) |
| Δ financeiro líquido (previsto / executado / saldo) | R$ 0,00 / R$ 0,00 / R$ 0,00 | R$ 0,00 / R$ 0,00 / R$ 0,00 |
| Candidatos na fila dry-run | 107 | **76** |

Os 5 `chave_ambigua` que sumiram (43 → 38) eram derivados do bloco `for (const [chave, grupoAnterior] of indiceAnterior.porContexto.entries())` (linhas 325–336 do código): como o pareamento por hash bijetivo absorveu os pendentes antes, deixou de haver pendentes para esse loop gerar ambiguidade por contexto. Isso é **redução de derivado**, não supressão de bloqueio estrutural.

## 6. Testes adicionais (6 novos)

`tests/services/profor-pad-comparador-snapshots.test.js`:

1. Colisão preexistente com identidade material bijetiva **não** vira `item_novo`/`item_removido`.
2. Colisão com diferença material **continua** gerando divergência/bloqueio.
3. Diferença financeira R$ 0,00 sozinha **não** oculta divergência.
4. Quantidade de bloqueios técnicos **não é reduzida** pelo ruído controlado.
5. Ruído técnico controlado aparece no relatório JSON e Markdown.
6. Fila dry-run **não** cria pendência operacional artificial para ruído controlado.

Suíte completa: **225/225** testes passando.

## 7. Risco

Baixo. O critério é estrito (`hashItem` bijetivo). Qualquer divergência material — alteração de valor, quantidade, natureza, área ou descrição em qualquer item do grupo — quebra a bijetividade dos hashes e o pareamento por ruído controlado **não dispara**, retornando ao comportamento legado. Os bloqueios técnicos preexistentes seguem 100% visíveis.

## 8. Rollback

`git revert <commit>` reverte o ajuste do comparador e dos testes. Regenerar o relatório dry-run com o comparador v0.2. Não apagar relatórios históricos.
