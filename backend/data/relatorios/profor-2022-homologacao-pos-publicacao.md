# PROFOR 2022 — Relatório de Homologação Pós-Publicação

- **Ciclo:** PAD/PROFOR 2022
- **Data da Homologação:** 2026-05-23
- **Commit de Publicação:** `06c4cd7` (mensagem: `publish(profor-2022): publica dados da origem reconstrucao-pad`)
- **Status de Homologação:** **HOMOLOGADO POS-PUBLICACAO PAD/PROFOR 2022**

---

## 1. Escopo e Propósito

Este relatório registra a homologação técnica e funcional do ciclo de publicação controlada dos dados do PROFOR 2022, alimentado pela origem `reconstrucao-pad`. A homologação confirma que as saídas geradas em `frontend/data/publicados/` estão integradas sem regressões e são carregadas corretamente pela aplicação frontend.

---

## 2. Arquivos Publicados Conferidos

A publicação alterou e homologou exatamente os 3 arquivos abaixo, enquanto os outros 3 foram integralmente preservados:

- **Modificados:**
  - `frontend/data/publicados/aplicacao.json` (origem ativa `"reconstrucao-pad"`)
  - `frontend/data/publicados/dashboard-geral.json` (totais agregados de fomento)
  - `frontend/data/publicados/resumo-publicacao.json` (metadados da publicação)
- **Preservados:**
  - `frontend/data/publicados/formalizacao-profor.json`
  - `frontend/data/publicados/orcamento-2026.json`
  - `frontend/data/publicados/parametros-minimos.json`

---

## 3. Telas e Funcionalidades Verificadas

1.  **Dashboard Geral (Home):**
    - Carregamento imediato sem erros.
    - O card de **Total de Fomento** exibe corretamente `R$ 6.028.180,90` (soma de FAF + Convênios + Doações).
    - O card de **Total em Convênios (Ouvidoria)** reflete com precisão `R$ 1.669.823,90`.
    - A contagem de **UFs com Convênios** indica `15` estados monitorados pelo PROFOR.
2.  **Painel PROFOR 2022:**
    - Acessado com sucesso via SPA (`toggleView('profor2022')`).
    - Exibe total de `15 convênios` e ano de referência `2022`.
    - O card de **Valor Global** exibe `R$ 10.664.015,24`, e **Valor de Repasse** exibe `R$ 10.217.254,54`, batendo 100% com a base do plano reconstruído da origem `reconstrucao-pad`.
    - Os cards de **Saldo Disponível da Ouvidoria** (`R$ 1.314.099,25`) e **Potencial Destinável à Ouvidoria** (`R$ 3.096.211,00`) renderizam corretamente.
3.  **Filtros por UF:**
    - Carregam a lista de 15 UFs associadas aos relatórios PAD reconstruídos.
4.  **Informações da Publicação:**
    - `resumo-publicacao.json` lido corretamente com timestamp `2026-05-23T20:07:02.163Z` e as 5 entradas de arquivos.

---

## 4. Testes e Console do Navegador

-   **Console do Navegador:**
    - 0 erros 404 detectados.
    - 0 erros de parsing JSON.
    - 0 erros de campos `undefined`.
    - Log de bootstrap exibido com sucesso: `Convenios carregados da planilha: 144 itens.`
-   **Testes Automatizados:**
    - `validar:syntax` retornado com **sucesso** (76 arquivos validados).
    - `validar:services` retornado com **sucesso** (153/153 testes passados, 0 falhas).

---

## 5. Garantias de Isolamento e Segurança

-   **Sem nova publicação:** Nenhuma nova execução de `npm run publicar:dados` foi realizada.
-   **Modo somente leitura:** Confirmado o isolamento total de `backend/data/onasp.sqlite` (não modificado nem staged).
-   **Controle de Envs:** O arquivo `.env` permaneceu inalterado e protegido pelo `.gitignore`.
-   **Sem conexões externas:** Nenhum script integrado ao Transferegov (`atualizar:profor-2022` ou `publicar:profor-2022`) foi acionado.

---

## 6. Conclusão

Os dados publicados no commit `06c4cd7` estão tecnicamente e funcionalmente consistentes com a origem `reconstrucao-pad`. Nenhuma regressão foi detectada na aplicação.

O ciclo está homologado como:
**HOMOLOGADO POS-PUBLICACAO PAD/PROFOR 2022**

---
**Assinado:** Marcelo Cortez (Responsável Técnico / Operador)
**Data:** 2026-05-23
