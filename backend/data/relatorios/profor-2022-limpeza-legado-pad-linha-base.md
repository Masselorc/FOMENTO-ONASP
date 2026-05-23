# PROFOR 2022 — Relatório de Inventário de Resíduos e Linha de Base Técnica

- **Frente:** PAD/PROFOR 2022
- **Data da Execução:** 2026-05-23
- **Branch Atual:** `main`
- **Último Commit:** `f484dbe docs(profor-2022): registra baseline pos-homologacao`
- **Status do Git Inicial:** Working tree limpa (nada a commitar)
- **Status Final:** **AUDITADO E DOCUMENTADO**

---

## 1. Escopo e Propósito

Este relatório documenta a fase de inventário de resíduos legados do ciclo PAD/PROFOR 2022 no projeto FOMENTO-ONASP. O objetivo é mapear todas as referências a planilhas Excel locais, métodos de parsing, chamadas de fallback de fontes e scripts de sincronização legados, classificando-os sob regras de depreciação e identificando eventuais riscos de fallback silencioso.

---

## 2. Linha de Base do Ambiente (Read-Only)

Os seguintes parâmetros e hashes físicos foram atestados no início da execução:

### A. Arquivos Publicados Principais (`frontend/data/publicados/`)
Hashes SHA-256 calculados:
- `aplicacao.json`: `41B90503CA966B305D30324B9F0DEBDC22E3AEAA58A60B3438DBA2C05282226E`
- `dashboard-geral.json`: `FA57880E4CBBDB9C7066A3ED2B1DA25B3B69B1FFB955D1C5E9E9B5282FF24D08`
- `resumo-publicacao.json`: `22BCFEBC4716BAF271CDD7F88678CE9D23CFACFB30258687FE88A418BDE5CEA4`
- `formalizacao-profor.json`: `D9EAF6360398D86AB5E60BEBFDCEE6389048C5A4047714DFBEC853C25BD545A1`
- `orcamento-2026.json`: `74AFAB7AC9BBD28DA416744ED74DD78072AA2619E9BA1BFF93BC8E0B58A2A926`
- `parametros-minimos.json`: `501562D4BCAD885C47BCEF15F469794DA8A74017BC3054B0DF9850D9701B1431`

### B. Arquivos de Banco de Dados local (`backend/data/`)
Situação física dos arquivos:
- `onasp.sqlite`: `2.453.504 bytes` (intacto, íntegro)
- `onasp.sqlite-shm`: `32.768 bytes` (intacto)
- `onasp.sqlite-wal`: `0 bytes` (vazio, checkpoint concluído)

---

## 3. Inventário de Resíduos e Classificação de Ocorrências

Abaixo encontram-se as principais referências mapeadas em arquivos ativos de código (`.js`) e configuração (`.json`):

### 1. `arquivoPlanilhaConvenios` e `Planilhas/gestao_financeira_ouvidoria.xlsx`
- **Arquivo:** `backend/data/aplicacao.json` (linha 3), `backend/services/data-service.js` (linha 3860), `backend/services/dashboard-publication-service.js` (linhas 654-681), `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` (linhas 49-51) e `backend/server.js` (linha 296).
- **Função/Serviço:** Resolução e endereçamento da planilha de convênios do PROFOR 2022.
- **Tipo:** Leitura operacional / Fallback.
- **Classificação:** **Manter temporariamente como fallback explícito** (necessário para o funcionamento dos modos legados locais clássicos `planilha` e `banco-cache`).

### 2. `carregarPlanoAplicacaoLocal` e `extrairPlanoAplicacaoProforDoWorkbook`
- **Arquivo:** `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` (linhas 47, 228), `backend/services/dashboard-publication-service.js` (linhas 513, 602) e `backend/server.js` (linhas 56, 307).
- **Função/Serviço:** Mapeador e leitor de abas por UF do Excel clássico.
- **Tipo:** Parsing operacional.
- **Classificação:** **Manter temporariamente como fallback explícito** (usado quando o backend roda localmente sob o modo `banco-cache`).

### 3. `xlsx.readFile`
- **Arquivo:** `backend/server.js` (linha 301), `backend/services/dashboard-publication-service.js` (linha 660) e `backend/services/profor-2022/profor-atualizacao-consolidada-service.js` (linha 53).
- **Função/Serviço:** Ingestão física de arquivos do Excel.
- **Tipo:** Dependência externa (`xlsx.js`).
- **Classificação:** **Manter temporariamente como fallback explícito** (necessário para a leitura das planilhas de orçamentos e outros parâmetros ainda ativos).

### 4. `publicar:profor-2022` e `atualizar:profor-2022`
- **Arquivo:** `package.json` (linhas de script).
- **Função/Serviço:** Sincronização externa automatizada com o Transferegov.
- **Tipo:** Script auxiliar.
- **Classificação:** **Manter como histórico/diagnóstico** (com proibição rígida de acionamento em janelas comuns).

---

## 4. Diagnóstico de Risco e Mecanismo de Fallback Silencioso

Foi realizada uma análise estática e de reachability detalhada no backend e frontend para apurar o comportamento do sistema caso a origem `reconstrucao-pad` falhe.

### A. Diagnóstico de Fallback no Backend
O backend **não possui fallbacks silenciosos para a origem `reconstrucao-pad`**.
- Caso a variável `PROFOR_2022_ORIGEM_DADOS` esteja configurada como `reconstrucao-pad` no `.env` e o arquivo JSON em `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json` esteja ausente ou malformado:
  - O serviço `profor-pad-origem-reconstrucao-service.js` (linhas 65-90) lança erros explícitos de sistema: `ReconstrucaoPadIndisponivelError` ou `ReconstrucaoPadInvalidaError`.
  - Estes erros não são capturados de forma tolerante pelo orquestrador de publicação `dashboard-publication-service.js` em `montarDadosProfor2022Publicacao` (linha 570), resultando no aborto imediato do script de publicação com log de stacktrace no console.
- **Conclusão:** O backend é seguro contra fallbacks silenciosos neste fluxo.

### B. Diagnóstico de Fallback no Frontend
O frontend SPA (`frontend/js/app.js` linha 1523) implementa um mecanismo de fallback resiliente a falhas:
- Se o servidor de API local estiver fora do ar ou retornar erro ao carregar a origem, o frontend intercepta a falha e aplica fallback de segurança transparente definindo `origemDadosEfetiva = 'planilha'` a partir dos caches locais, emitindo avisos no console do navegador (`avisoFallbackProfor2022`).
- Este comportamento é aceito em desenvolvimento local para evitar que o operador fique bloqueado por falta de conexões com o servidor local.
- No modo estático (`estaEmModoPublicacaoEstatica() = true` — correspondente ao GitHub Pages), o frontend lê o catálogo publicado estaticamente em `frontend/data/publicados/aplicacao.json` de forma congelada e sem fallbacks dinâmicos.

---

## 5. Conclusão e Recomendações

1.  **Nenhuma alteração de código realizada:** Como a origem `reconstrucao-pad` possui mecanismos de falha explícita no backend e a integridade de dados estáticos congelados é mantida em produção, não houve necessidade de aplicar patches emergenciais nesta etapa.
2.  **Próximos Passos (Depreciação Total):** Planejar em janelas futuras a transferência do plano de aplicação detalhado das planilhas físicas locais diretamente para tabelas relacionais do SQLite local, o que permitirá a depreciação final definitiva da biblioteca `xlsx.js` no backend e a eliminação dos arquivos na pasta `Planilhas/`.
3.  **Proibição do Transferegov:** Reitera-se a proibição de rodar comandos de sincronização automática com o Transferegov no ambiente comum sem aprovação prévia.

---
**Homologação da Baseline Documental de Resíduos Legados Concluída.**
**Data:** 2026-05-23
