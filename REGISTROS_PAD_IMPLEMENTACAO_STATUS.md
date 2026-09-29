# Registros do PAD — Status de Implementação

## 1. Objetivo

Implementar histórico persistente e imutável das atualizações do PAD do PROFOR 2022,
com snapshots ANTES/DEPOIS, reaproveitamento do comparador existente, preservação
da memória de classificação e nova tela “Registros do PAD”.

## 2. Fonte de verdade

Especificação completa: `PLANO_REGISTROS_PAD_PROFOR_2022.md` localizado na raiz do repositório.

> Em caso de dúvida, consultar o plano. Este arquivo de status não substitui a especificação completa.

## 3. Escopo fixado

- Recurso exclusivo do PAD do PROFOR 2022, em tela própria dentro do módulo.
- Histórico permanente e imutável, inclusive para atualizações sem mudanças.
- Comparação ANTES × DEPOIS.
- Preservar classificação Ouvidoria / Corregedoria / Escola.
- Correspondências inequívocas podem herdar classificação; ambiguidades seguem para revisão humana.
- Reutilizar comparador e snapshots existentes; não criar mecanismo paralelo.
- Ações locais do PROFOR 2022 deixarão de exigir senha em etapa posterior; chamadas remotas continuarão protegidas.

## 4. Componentes existentes que DEVEM ser reutilizados

- `profor-pad-fotografia-service.js`
- `profor-pad-comparador-snapshots-service.js`
- Memória existente de itens/rateios.
- Sistema existente de revisão de divergências.
- Decisões de `vinculo_item_substituto`.
- PostgreSQL/Supabase operacional.
- Job atual de atualização Transferegov.

Não reimplementar essas responsabilidades.

## 5. Etapas

- [x] Etapa 0 — Preparação da execução
- [ ] Etapa 1 — Inspeção dirigida e confirmação da arquitetura
- [ ] Etapa 2 — Migration das tabelas de histórico
- [ ] Etapa 3 — Repository de histórico
- [ ] Etapa 4 — Serviço de histórico e snapshots ANTES/DEPOIS
- [ ] Etapa 5 — Estado completo do snapshot
- [ ] Etapa 6 — Memória de classificação e substitutos
- [ ] Etapa 7 — Integração com o job Transferegov e atomicidade
- [ ] Etapa 8 — Remoção da senha local do PROFOR 2022
- [ ] Etapa 9 — APIs de leitura do histórico
- [ ] Etapa 10 — Tela Registros do PAD
- [ ] Etapa 11 — Botão Ver alterações e deep-link
- [ ] Etapa 12 — Testes integrados e regressão
- [ ] Etapa 13 — Auditoria final de arquitetura e diff
- [ ] Etapa 14 — Documentação, handoff final e commit

## 6. Estado atual

- Etapa atual: concluída — Etapa 0.
- Última etapa concluída: Etapa 0 — Preparação da execução.
- Próxima etapa: Etapa 1 — Inspeção dirigida e confirmação da arquitetura.
- Atualizado em: 2026-09-29 16:00:02 -03:00.
- Branch: `main`.
- Working tree: com alterações preexistentes staged e unstaged, preservadas.
- Há alterações preexistentes em dados/cache, relatórios e JSONs publicados, além de um script staged; nenhum desses arquivos foi alterado nesta etapa.
- O plano original permanece intacto na raiz do repositório.

## 7. Arquivos alterados pela última etapa

- `REGISTROS_PAD_IMPLEMENTACAO_STATUS.md`

## 8. Decisões que não devem ser rediscutidas

- Usar PostgreSQL/Supabase.
- Histórico específico do PAD, com snapshots imutáveis.
- Reaproveitar o comparador existente.
- Não substituir o sistema de classificação nem duplicar a revisão.
- Não usar `historico_alteracoes` como histórico principal do PAD.
- Não usar `logs_operacionais` como armazenamento principal do histórico.
- Preservar modo estático/GitHub Pages.
- Evitar dependências novas e refatorações não relacionadas.

## 9. Pendências/bloqueios

- Nenhum bloqueio conhecido para iniciar a Etapa 1.

## 10. Instruções para o próximo agente

O próximo agente deve:
1. ler `AGENTS.md`;
2. ler `memoria/INDEX.md`;
3. ler este `REGISTROS_PAD_IMPLEMENTACAO_STATUS.md`;
4. ler somente a seção da Etapa 1 em `PLANO_REGISTROS_PAD_PROFOR_2022.md`;
5. executar a inspeção dirigida prevista;
6. não avançar para a Etapa 2;
7. atualizar este arquivo ao terminar.

## 11. Protocolo de fechamento por etapa

Uma etapa somente é considerada concluída após validação local, commit exclusivo da etapa e push para o repositório remoto. O SHA do commit deve ser informado para auditoria externa antes do início da etapa seguinte.


