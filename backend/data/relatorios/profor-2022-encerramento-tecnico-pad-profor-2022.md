# PROFOR 2022 — Relatório de Encerramento Técnico do Ciclo

- **Ciclo:** PAD/PROFOR 2022
- **Data de Encerramento:** 2026-05-23
- **Responsável Técnico / Operador:** Marcelo Cortez
- **Status Geral:** **ENCERRADO E HOMOLOGADO**

---

## 1. Introdução e Contexto

Este relatório documenta a consolidação técnica de encerramento do ciclo PAD/PROFOR 2022 no projeto FOMENTO-ONASP. O ciclo teve como principal objetivo substituir a origem de dados das abas por UF da planilha antiga de gestão financeira pela nova sistemática baseada em relatórios PAD reconstruídos. 

A transição foi planejada, executada e validada em fases estritas de segurança, culminando na publicação controlada dos dados estáticos e na subsequente homologação funcional na aplicação web.

---

## 2. Fase 1: Saneamento e Segurança Pré-Ativação

A fase de saneamento resolveu as pendências e bloqueios identificados no plano de aplicação reconstruído e na base decisória do SQLite local:

1.  **Divergência #18 (Saldo Residual / 937221 AL):** Tratada com a decisão retificadora `CORRIGIDO #185` que redefiniu o rateio do item como não setorializado (área `NAO INFORMADO`, natureza `CAPITAL`, 100%), reduzindo a diferença líquida de saldo total para apenas `R$ -0,24`.
2.  **Divergência #39 (SP/938128):** Reconstituída decisão `ACEITO #186` sob a regra de prevalência integral do PAD novo (CUSTEIO/R$ 1.134,27), sanando o gap técnico de banco pré-existente.
3.  **Divergência #44 (SP/938128):** Reconstituída decisão `CORRIGIDO #187` sob a regra de prevalência integral do PAD novo (CUSTEIO/R$ 71,36) com saldo residual mantido como não setorializado.
4.  **Revalidação de 27 Payloads Alterados (#47 a #74):** Após a normalização e re-extração do PAD, as 27 divergências únicas (28 decisões afetadas) tiveram seus hashes de payload atualizados no banco local por decisões explícitas de revalidação `ACEITO` (Decisões #188 a #214), reduzindo os bloqueios de segurança de 27 para 0.
5.  **Aptidão Final:** Com a resolução dos bloqueios e `pendencia_operacional_real = 0`, a aptidão para a ativação controlada foi atestada como **sim** no relatório de segurança final.

---

## 3. Fase 2: Ativação Controlada da Origem `reconstrucao-pad`

A ativação da origem de dados foi executada em conformidade com o roteiro v1.1 e registrada no commit `7ed2633`:

-   **Mecanismo de Ativação:** Ajustada a linha de configuração de origem no arquivo `.env` local (gitignored):
    -   `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad`
-   **Isolamento:** A ativação permaneceu estritamente no ambiente local e não afetou o código de default (`banco-cache`), garantindo integridade e prevenindo vazamento de dados de configuração não versionados.
-   **Validação pós-ativação:** Conferido que o backend carrega com sucesso as 568 linhas e 15 convênios adaptados para a projeção canônica do `planoAplicacao`, com total integridade e sem falhas nos testes unitários (153/153 OK).

---

## 4. Fase 3: Publicação Controlada de Dados

A publicação dos dados estáticos para consumo do frontend em modo somente leitura (GitHub Pages) foi executada e commitada sob o hash `06c4cd7`:

-   **Mecanismo de Publicação:** Comando direto `node backend/scripts/publicar-dados-estaticos.js` (mapeado de `npm run publicar:dados`).
-   **Arquivos Publicados:**
    -   `frontend/data/publicados/aplicacao.json` (origem ativa `"reconstrucao-pad"`)
    -   `frontend/data/publicados/dashboard-geral.json` (totais agregados de fomento)
    -   `frontend/data/publicados/resumo-publicacao.json` (metadados da publicação)
-   **Arquivos Preservados:**
    -   `formalizacao-profor.json`, `orcamento-2026.json` e `parametros-minimos.json` foram mantidos com os hashes inalterados.
-   **Garantias:** A publicação ocorreu sem qualquer chamada a scripts Transferegov ou alterações estruturais no banco SQLite.

---

## 5. Fase 4: Homologação Pós-Publicação

Realizada validação em ambiente local no servidor local (porta `8790`) após a publicação estática, atestando:

-   **Carregamento de Telas:** Dashboard Geral e Painel PROFOR 2022 integrados com sucesso.
-   **Consistência de Indicadores:**
    -   15 Convênios carregados de `reconstrucao-pad`.
    -   568 Itens de plano de aplicação reconstruídos e expostos.
    -   Valor de repasse PROFOR totalizando `R$ 10.217.254,54` e Valor Global de `R$ 10.664.015,24`.
    -   Total Fomento Geral exibindo `R$ 6.028.180,90` no dashboard inicial.
-   **Saúde da Aplicação:** Console livre de erros HTTP (404), erros de parse de arquivos JSON ou propriedades `undefined`.
-   **Status de Homologação:** **HOMOLOGADO POS-PUBLICACAO PAD/PROFOR 2022**.

---

## 6. Mecanismos de Rollback e Segurança

A integridade do ciclo é assegurada pelo modelo de publicação estática e isolamento:

1.  **Rollback de Publicação:** A pasta `frontend/data/publicados/` pode ser reestabelecida para o estado pré-publicação restaurando os arquivos originais salvos no diretório de backup externo `C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\PUBLICACAO-20260523-170600\`.
2.  **Rollback da Origem:** A origem de dados pode ser repontada para `banco-cache` revertendo a alteração na linha 6 do `.env`.
3.  **Restauração do SQLite:** Backup físico do arquivo `onasp.sqlite` da pré-ativação preservado em segurança fora do repositório.

---

## 7. Próximos Passos Futuros

Com o encerramento do ciclo técnico do PAD/PROFOR 2022, as próximas etapas sugeridas para o projeto envolvem:

1.  **Frente Orçamento 2026 e Formalização PROFOR:** Iniciar planejamento de evolução e auditoria para o novo ciclo de 2026.
2.  **Interface de Gestão de Rateios:** Implementar componentes no frontend que permitam visualização interativa e edição das decisões e justificativas registradas no banco local de forma simplificada pelo usuário final.
3.  **Integração Automatizada (Futuro a Longo Prazo):** Avaliar requisitos e viabilidade técnica para consumo direto da API do Transferegov para ciclos futuros, mantendo a arquitetura atual de segurança e isolamento por dry-runs.

---
**Encerramento do Ciclo Técnico Documentado e Aprovado.**
**Data:** 2026-05-23
