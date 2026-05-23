# PROFOR 2022 — Registro de Baseline Estável Pós-Homologação

- **Frente:** PAD/PROFOR 2022
- **Data do Registro:** 2026-05-23
- **Autor:** Marcelo Cortez (Responsável Técnico / Operador)
- **Status da Baseline:** **ESTÁVEL E HOMOLOGADO**

---

## 1. Commits de Referência do Ciclo

O ciclo operacional foi consolidado através de dois marcos principais no repositório:

1.  **Commit de Publicação:** `06c4cd7`
    - *Mensagem:* `publish(profor-2022): publica dados da origem reconstrucao-pad`
    - *Descrição:* Executou a consolidação física dos JSONs estáticos a partir da origem `reconstrucao-pad`.
2.  **Commit de Homologação:** `288fb99`
    - *Mensagem:* `docs(profor-2022): registra homologacao pos-publicacao`
    - *Descrição:* Registrou a homologação técnica pós-publicação e a consolidação de encerramento do ciclo técnico.

---

## 2. Arquivos de Dados Estáticos Afetados

A publicação controlada alterou estritamente os 3 arquivos listados a seguir. Todos os demais arquivos de publicação e configurações locais foram preservados:

- **Modificados:**
  - `frontend/data/publicados/aplicacao.json` (aponta para `"origemDados": "reconstrucao-pad"`)
  - `frontend/data/publicados/dashboard-geral.json` (contém totais consolidados da Ouvidoria)
  - `frontend/data/publicados/resumo-publicacao.json` (índice e metadados de publicação)
- **Preservados (Sem Modificações):**
  - `frontend/data/publicados/formalizacao-profor.json`
  - `frontend/data/publicados/orcamento-2026.json`
  - `frontend/data/publicados/parametros-minimos.json`

---

## 3. Estado Final dos Testes e Sintaxe

A integridade do código e a estabilidade das funções de mapeamento de dados do backend foram validadas:

- **Testes de Serviço:** 153/153 testes unitários passaram com 100% de sucesso (`npm run validar:services`).
- **Verificação de Sintaxe:** Todos os arquivos de script JavaScript foram validados sem erros estruturais (`npm run validar:syntax`).
- **Navegador:** O console permaneceu livre de erros de carregamento (404), erros de parse JSON ou referências a campos `undefined`.

---

## 4. Rollback Disponível

Caso seja necessário reverter o ambiente para o estado anterior à transição da origem de dados, os seguintes caminhos estão assegurados:

1.  **Restauração dos JSONs Públicos:** Cópia de segurança física de `frontend/data/publicados/` pré-publicação armazenada no diretório de retenção externa `C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\PUBLICACAO-20260523-170600\`.
2.  **Reversão da Origem Ativa:** Alteração da variável `PROFOR_2022_ORIGEM_DADOS=reconstrucao-pad` para `banco-cache` no arquivo de configuração local `.env` (gitignored).
3.  **Restauração do SQLite:** Backup físico do banco `onasp.sqlite` pré-saneamento de segurança mantido fora do repositório.

---

## 5. Próximos Passos Futuros

As atividades futuras após o fechamento deste ciclo envolvem:

1.  **Orçamento 2026 e Formalização PROFOR:** Início das análises pré-operacionais e de parametrização de regras para o ciclo de fomento de 2026.
2.  **Interface de Gestão de Rateios:** Planejar o desenvolvimento de painéis administrativos locais para visualização e facilitação de rateios e tomadas de decisão.

---

## 6. Proibição de Automação Transferegov

> [!WARNING]
> Fica terminantemente **proibido** o acionamento direto ou indireto de rotinas automáticas de sincronização com o Transferegov (comandos `npm run atualizar:profor-2022` ou `npm run publicar:profor-2022`) fora de uma frente de trabalho especificamente autorizada para esse fim. Qualquer interação com a API do Transferegov ou cargas externas deve ser isolada e protegida sob dry-runs formais para mitigar riscos de integridade sobre a base local estável.
