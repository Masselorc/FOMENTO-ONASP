# PROFOR 2022 — Auditoria de regressão dos saneamentos por chave de pareamento frágil (dry-run)

Gerado em: 2026-05-22T21:10:55.212Z
Modo: dry-run — somente leitura. Não publica, não registra decisão, não reabre divergência, não altera SQLite, origem ativa nem `planoAplicacao` oficial.

> Diagnostico da #44 (938128/SP): o PAD tinha multiplas linhas para a mesma descricao. Reavaliacao transversal dos saneamentos que dependem de pareamento de linha PAD.

## 1. Resumo Geral

- Total de divergências analisadas: 145
- Sensíveis a pareamento de linha PAD: 46
- Saneamentos concluídos reavaliados (com decisão resolutiva ou status resolutivo): 72
  - Permanecem confiáveis (saneamento confirmado): 71
  - Exigem revalidação manual (suspeitos de chave frágil ou pendência material decidida): 0
- Divergências abertas com alerta de pareamento (sem decisão resolutiva): 0
- Pendências materiais potenciais abertas (sem decisão resolutiva): 0
- Riscos confirmados já diagnosticados (#44): 1

> [!IMPORTANT]
> Nenhuma divergência foi reaberta automaticamente. A reabertura automática exige prova material inequívoca e decisão humana.

## 2. Saneamentos Concluídos Reavaliados

Saneamentos concluídos (ACEITO/CORRIGIDO) que foram reavaliados. Aqueles sob grupo PAD de linha única ou não sensíveis a pareamento de descrição são considerados confiáveis.

Total de saneamentos confiáveis: **71**

| Divergência | Convênio | UF | Tipo Alerta | Status | Recomendação |
|---|---|---|---|---|---|
| #1 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #2 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #3 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #4 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #5 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #6 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #7 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #8 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #9 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #10 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #11 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #12 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #13 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #14 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| #15 | 937221 | AL | item_novo_sem_rateio | ACEITO | Confiável |
| ... | ... | ... | ... | ... | + 56 outros saneamentos confirmados |

## 3. Saneamentos Suspeitos por Chave Frágil

Saneamentos concluídos cuja chave de pareamento (descrição/itemConhecido) corresponde a mais de uma linha PAD no mesmo convênio, sem divergência de natureza/código. Exigem revalidação técnica da correspondência.

- Nenhum saneamento suspeito por chave frágil.

## 4. Divergências Abertas com Alerta de Pareamento

Divergências que continuam abertas (status PENDENTE) e cujos grupos PAD possuem mais de uma linha com a mesma descrição normalizada (mas com mesma natureza/código). **Não são regressão de saneamento**, pois nunca foram decididas.

- Nenhuma divergência aberta com alerta de pareamento.

## 5. Pendências Materiais Potenciais Abertas

Divergências abertas (status PENDENTE) cujos grupos PAD possuem múltiplas naturezas/códigos (risco material alto/médio). Exigem segregação material no pareamento.

- Nenhuma pendência material potencial aberta.

## 6. Casos Já Diagnosticados

Casos de risco material que já foram formalmente diagnosticados ou corrigidos.

| Divergência | Convênio | UF | Tipo Alerta | Status | Descrição do Diagnóstico |
|---|---|---|---|---|---|
| #44 | 938128 | SP | item_nao_apto | ACEITO | Caso ja diagnosticado e corrigido em auditoria anterior; manter como referencia. |

## 7. Conclusão

- **Saneamentos concluídos reavaliados:** 72 saneamentos foram analisados.
- **Saneamentos concluídos confiáveis:** 71 permanecem confiáveis e sem risco de pareamento frágil.
- **Revalidação técnica necessária:** 0 saneamentos exigem revalidação manual devido a chave de pareamento frágil ou risco de conflito material (por exemplo, a divergência #24).
- **Divergências abertas com alerta:** As divergências #31, #32, #33 e #34 já têm alerta de pareamento por caírem em grupo PAD multi-linha, mas **não são regressão de saneamento**, pois continuam em aberto e sem decisão resolutiva.
- **Pendência material aberta:** A divergência #46 continua em aberto e foi classificada como `pendencia_material_potencial_aberta` devido à divergência de natureza/código de despesa no grupo do saldo residual.
- **Garantia de segurança:** Nenhuma divergência foi reaberta automaticamente no banco de dados. Os dados originais permanecem inalterados.

Rollback: reverter o commit e regenerar os relatórios dry-run; não apagar decisões, logs, divergências nem relatórios históricos.
