# PROFOR 2022 — Segurança pré-ativação PAD: detalhamento de bloqueios (dry-run)

Gerado em: 2026-05-22T19:31:53.234Z
Fonte: `backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json` (gerado em 2026-05-22T19:31:52.782Z).

Etapa somente leitura: não registra decisão, não altera status, não publica e não altera o `planoAplicacao` oficial.

## 1. Resumo executivo

- Total de bloqueios de segurança pré-ativação: 35
- Bloqueios por payload alterado após a decisão: 28
- Bloqueios por divergência não reapresentada com decisão resolutiva: 7
- Decisões distintas com payload alterado: 28
- Divergências distintas com payload alterado: 27
- Divergências não reapresentadas: 7
- Bloqueios que exigem revalidação humana: 28
- Bloqueios com mudança provável por correção do parser de quantidade: 0
- Apto para prosseguir ativação: não

## 2. Bloqueios por tipo

| Tipo de bloqueio | Quantidade |
|---|---:|
| `payload_alterado_apos_decisao` | 28 |
| `nao_reapresentada_com_decisao_resolutiva` | 7 |

## 3. Decisões com payload alterado após a decisão

| Divergência | Decisão | Tipo alerta | Convênio/UF | Status | Usuário | Data decisão | Origem provável | Parser qtd? | Revalidar? | Prioridade |
|---:|---:|---|---|---|---|---|---|---|---|---|
| #72 | 107 | `item_ausente_no_pad` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:54:58.387Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #72 | 108 | `item_ausente_no_pad` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:55:11.354Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #73 | 109 | `item_ausente_no_pad` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:55:23.586Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #74 | 110 | `item_ausente_no_pad` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:55:35.322Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #47 | 153 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.555Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #48 | 154 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.555Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #49 | 155 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.568Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #50 | 156 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.569Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #51 | 157 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.570Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #52 | 158 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.570Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #53 | 159 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.570Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #54 | 160 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.571Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #56 | 161 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.571Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #57 | 162 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.572Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #58 | 163 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.572Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #59 | 164 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.572Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #60 | 165 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.573Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #61 | 166 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.574Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #62 | 167 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.574Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #63 | 168 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.575Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #64 | 169 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.575Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #65 | 170 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.575Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #67 | 171 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.575Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #68 | 172 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.575Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #69 | 173 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.575Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #70 | 174 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.576Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #71 | 175 | `item_ausente_no_pad` | 937221/AL | ACEITO | sistema-saneamento-pad-al-937221 | 2026-05-21T21:41:09.576Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |
| #66 | 182 | `item_ausente_no_pad` | 937221/AL | ACEITO | usuario-local | 2026-05-21T21:45:25.004Z | provavel_reextracao_ou_regeracao_pad | não | sim | alta |

## 4. Divergências não reapresentadas com decisão resolutiva

| Divergência | Decisão | Tipo alerta | Convênio/UF | Status | Usuário | Data decisão | Origem provável | Parser qtd? | Revalidar? | Prioridade |
|---:|---:|---|---|---|---|---|---|---|---|---|
| #25 | 104 | `equivalencia_por_descricao_normalizada` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:53:51.853Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |
| #26 | 105 | `equivalencia_por_descricao_normalizada` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:54:12.082Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |
| #27 | 106 | `equivalencia_por_descricao_normalizada` | 937782/AC | ACEITO | usuario-local | 2026-05-21T19:54:27.692Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |
| #28 | 60 | `item_nao_apto` | 937216/GO | ACEITO | sistema-auditoria-item-nao-apto | 2026-05-21T17:36:22.923Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |
| #75 | 117 | `item_ausente_no_pad` | 937782/AC | CORRIGIDO | sistema-saneamento-diacritico | 2026-05-21T20:15:50.259Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |
| #77 | 118 | `item_ausente_no_pad` | 937782/AC | CORRIGIDO | sistema-saneamento-diacritico | 2026-05-21T20:15:50.259Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |
| #78 | 119 | `item_ausente_no_pad` | 937782/AC | CORRIGIDO | sistema-saneamento-diacritico | 2026-05-21T20:15:50.260Z | historico_nao_reapresentado_na_geracao_atual | não | não | media |

## 5. Plano de revalidação por grupo

### Bloqueios de segurança por payload alterado após a decisão

- Prioridade: alta
- Total de bloqueios: 28
- Divergências afetadas: 47, 48, 49, 50, 51, 52, 53, 54, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74
  - Revalidar cada decisão afetada confrontando o payload no momento da decisão com o payload atual.
  - Confirmar se a alteração decorreu de correção técnica (parser de quantidade) ou de reextração/regeração do PAD.
  - Registrar nova decisão resolutiva apenas em etapa posterior, com decisão humana auditável — não nesta etapa dry-run.

### Divergências não reapresentadas com decisão resolutiva

- Prioridade: media
- Total de bloqueios: 7
- Divergências afetadas: 25, 26, 27, 28, 75, 77, 78
  - Manter como histórico: já houve decisão resolutiva e o item não reaparece na geração atual.
  - Avaliar, em etapa posterior, se ainda devem bloquear a segurança pré-ativação ou se podem ser liberadas como histórico.
  - Não exibir como pendência operacional na fila de revisão.

### Pendências reais bloqueantes

- Prioridade: alta
- Observação: Detalhadas na auditoria profunda (profor-2022-pendencias-profundo-dry-run); exigem decisão humana substantiva.
  - Manter para revisão humana real; não sanear por regra automática.

### Falsos positivos saneáveis por regra

- Prioridade: baixa
- Observação: Detalhados na auditoria profunda; candidatos a saneamento sistêmico auditável.
  - Propor saneamento sistêmico auditável em etapa posterior, sem decisão automática nesta etapa.

## 6. Próximos passos

1. Tratar primeiro os bloqueios por payload alterado (prioridade alta): revalidação humana auditável.
2. Classificar as divergências não reapresentadas como histórico e decidir, em etapa posterior, se ainda devem bloquear a ativação.
3. Manter a separação: bloqueio técnico de segurança ≠ pendência operacional real.
4. Repetir esta auditoria após cada rodada de revalidação até zerar os bloqueios.
