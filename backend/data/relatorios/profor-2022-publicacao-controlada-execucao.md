# PROFOR 2022 — Relatório de Execução da Publicação Controlada

- **Data da Execução:** 2026-05-23T20:07:02.163Z
- **Origem Ativa:** `reconstrucao-pad` (via `.env`)
- **Comando Autorizado e Executado:** `node backend/scripts/publicar-dados-estaticos.js` (correspondente ao script `npm run publicar:dados`)
- **Responsáveis:** Marcelo Cortez (operação solo com aceite cruzado concentrado sob responsabilidade do operador)
- **Status da Publicação:** **SUCESSO**

---

## 1. Conferências Iniciais e Pré-condições

Todas as pré-condições da Seção 3 do roteiro de publicação controlada foram satisfeitas e auditadas antes do início da publicação:
- Branch ativa: `main`
- Working tree limpa (antes de rodar dry-runs de pré-voo)
- Sem alterações nos arquivos SQLite locais (`onasp.sqlite`, WAL, SHM) e no arquivo `.env`
- Origem efetiva detectada via Node: `reconstrucao-pad`
- `validar:syntax` retornou OK para 76 arquivos
- `validar:services` retornou OK para 153/153 testes passados
- `git diff --check` sem erros

---

## 2. Snaphots de Segurança (Backups)

Os backups foram gerados e armazenados localmente no diretório fora do repositório:
`C:\BACKUPS-FOMENTO-ONASP\PAD-PROFOR-2022\PUBLICACAO-20260523-170600`

Foram incluídos no backup:
- Cópia integral de `frontend/data/publicados/` pré-publicação
- Arquivo de hashes agregados SHA-256 pré-publicação
- Cópia de `backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json`
- Hashes SHA-256 do JSON reconstruído
- Status do Git (`git status --short`) e logs recentes (`git log --oneline -20`)

---

## 3. Hashes SHA-256 de Publicação (Antes × Depois)

| Arquivo | Hash Pré-Publicação | Hash Pós-Publicação | Status |
|---|---|---|---|
| `aplicacao.json` | `20a9cb478e7cd7a30a668d5a3e815501f2cb458ef1f2c9b77768d51b5cfdaf0b` | `41b90503ca966b305d30324b9f0debdc22e3aeaa58a60b3438dba2c05282226e` | Alterado (Origem PAD) |
| `dashboard-geral.json` | `44b331c98971bb754f11132c63d27b9c0bea2b7155c84d53942ede917ba69f28` | `fa57880e4cbbdb9c7066a3ed2b1da25b3b69b1ffb955d1c5e9e9b5282ff24d08` | Alterado (Origem PAD) |
| `formalizacao-profor.json` | `d9eaf6360398d86ab5e60bebfdcee6389048c5a4047714dfbec853c25bd545a1` | `d9eaf6360398d86ab5e60bebfdcee6389048c5a4047714dfbec853c25bd545a1` | Preservado |
| `orcamento-2026.json` | `74afab7ac9bbd28da416744ed74dd78072aa2619e9ba1bff93bc8e0b58a2a926` | `74afab7ac9bbd28da416744ed74dd78072aa2619e9ba1bff93bc8e0b58a2a926` | Preservado |
| `parametros-minimos.json` | `501562d4bcad885c47bcef15f469794da8a74017bc3054b0df9850d9701b1431` | `501562d4bcad885c47bcef15f469794da8a74017bc3054b0df9850d9701b1431` | Preservado |
| `resumo-publicacao.json` | `bdc40661b14a6ed149d55c8c0ebb590a974bff222d86f6ce95b83abd5f8910b2` | `22bcfebc4716baf271cdd7f88678ce9d23cfacfb30258687fe88a418bde5cea4` | Alterado (Timestamp/Origem) |

---

## 4. Validações e Auditorias Pós-Publicação

Após a execução da publicação:
1. `git status --short` confirmou modificação em exatamente 3 arquivos em `frontend/data/publicados/` (`aplicacao.json`, `dashboard-geral.json`, `resumo-publicacao.json`). Os outros 3 arquivos permaneceram com os mesmos hashes do início.
2. Nenhuma alteração foi realizada no SQLite, nos arquivos WAL/SHM temporários ou no arquivo `.env`.
3. Hashes pós-publicação foram salvos no backup em `publicados.pos-publicacao-hashes.txt`.
4. Os scripts de validação de sintaxe, serviços e JSONs publicados retornaram **sucesso absoluto** (`validar:syntax` OK para 76 arquivos, `validar:services` 153/153 OK, `validar:json` OK).
5. As auditorias dry-run pós-publicação mantiveram a consistência perfeita: `pendenciaOperacionalReal = 0`, 15 convênios, 568 linhas reconstruídas.
6. A conferência de `resumo-publicacao.json` atestou que a contagem de convênios/UFs PROFOR 2022 é exatamente 15.
7. O `aplicacao.json` contém `"origemDados": "reconstrucao-pad"` e `"origemDadosEfetiva": "reconstrucao-pad"`.

---

## 5. Garantias de Segurança

- O processo de publicação não realizou nenhuma chamada externa nem acionou serviços do Transferegov ou do DETRU (nenhuma chamada proibida mapeada em `publicar:profor-2022` ou `atualizar:profor-2022` foi executada).
- Não houve qualquer reativação ou alteração da origem ativa no `.env`.
- `backend/data/onasp.sqlite` não sofreu nenhuma alteração material.
- O backup local garante rollback imediato ao estado anterior em caso de qualquer regressão futura.

---
**Assinado:** Marcelo Cortez (Responsável Técnico / Operador)
**Data:** 2026-05-23
