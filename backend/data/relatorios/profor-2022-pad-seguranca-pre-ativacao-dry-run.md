# PROFOR 2022 — Segurança pré-ativação PAD (dry-run)

Gerado em: 2026-05-21T21:08:06.361Z
Modo: dry-run

## Resumo

- Decisões resolutivas auditadas: 24
- Payload preservado: 20
- Payload alterado após a decisão: 4
- Decisões sem snapshot de payload: 0
- Decisões com divergência não encontrada: 0
- Divergências existentes: 145
- Divergências reapresentadas: 139
- Divergências não reapresentadas: 6
- Divergências com reapresentação indeterminada: 0
- Bloqueios de ativação: 10
- Avisos: 0
- Geração atual da fila disponível: sim
- Apto para prosseguir ativação: não

## Bloqueios de ativação

- [payload_alterado_apos_decisao] payload_decisao | divergência 72 (item_ausente_no_pad:bdf5314acea3f24d) | Payload da divergência mudou após a decisão; a decisão precisa ser revalidada.
- [payload_alterado_apos_decisao] payload_decisao | divergência 72 (item_ausente_no_pad:bdf5314acea3f24d) | Payload da divergência mudou após a decisão; a decisão precisa ser revalidada.
- [payload_alterado_apos_decisao] payload_decisao | divergência 73 (item_ausente_no_pad:ecb3d1cdb44b3bab) | Payload da divergência mudou após a decisão; a decisão precisa ser revalidada.
- [payload_alterado_apos_decisao] payload_decisao | divergência 74 (item_ausente_no_pad:66458163e66df12a) | Payload da divergência mudou após a decisão; a decisão precisa ser revalidada.
- [nao_reapresentada_com_decisao_resolutiva] divergencia_nao_reapresentada | divergência 25 (equivalencia_por_descricao_normalizada:86b5ea3a6ef8831d) | Divergência com decisão resolutiva não aparece na geração atual da fila.
- [nao_reapresentada_com_decisao_resolutiva] divergencia_nao_reapresentada | divergência 26 (equivalencia_por_descricao_normalizada:f812a27863b7408a) | Divergência com decisão resolutiva não aparece na geração atual da fila.
- [nao_reapresentada_com_decisao_resolutiva] divergencia_nao_reapresentada | divergência 27 (equivalencia_por_descricao_normalizada:a55de103e70ebde1) | Divergência com decisão resolutiva não aparece na geração atual da fila.
- [nao_reapresentada_com_decisao_resolutiva] divergencia_nao_reapresentada | divergência 75 (item_ausente_no_pad:ce97612ee9b9e3ce) | Divergência com decisão resolutiva não aparece na geração atual da fila.
- [nao_reapresentada_com_decisao_resolutiva] divergencia_nao_reapresentada | divergência 77 (item_ausente_no_pad:48844ea18c1d3543) | Divergência com decisão resolutiva não aparece na geração atual da fila.
- [nao_reapresentada_com_decisao_resolutiva] divergencia_nao_reapresentada | divergência 78 (item_ausente_no_pad:d8099a1f5573201b) | Divergência com decisão resolutiva não aparece na geração atual da fila.

## Payload alterado após a decisão

- decisão 107 | divergência 72 | ACEITO
- decisão 108 | divergência 72 | ACEITO
- decisão 109 | divergência 73 | ACEITO
- decisão 110 | divergência 74 | ACEITO

## Divergências não reapresentadas

- [nao_reapresentada_com_decisao_resolutiva] divergência 25 (equivalencia_por_descricao_normalizada:86b5ea3a6ef8831d)
- [nao_reapresentada_com_decisao_resolutiva] divergência 26 (equivalencia_por_descricao_normalizada:f812a27863b7408a)
- [nao_reapresentada_com_decisao_resolutiva] divergência 27 (equivalencia_por_descricao_normalizada:a55de103e70ebde1)
- [nao_reapresentada_com_decisao_resolutiva] divergência 75 (item_ausente_no_pad:ce97612ee9b9e3ce)
- [nao_reapresentada_com_decisao_resolutiva] divergência 77 (item_ausente_no_pad:48844ea18c1d3543)
- [nao_reapresentada_com_decisao_resolutiva] divergência 78 (item_ausente_no_pad:d8099a1f5573201b)

## Divergências com reapresentação indeterminada

- (nenhum)

Etapa dry-run: não altera origem ativa, não publica e não aplica decisões ao planoAplicacao.
