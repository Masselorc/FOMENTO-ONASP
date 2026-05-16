# Modelo de Documentação Técnica por Funcionalidade

## Instruções de uso do modelo

Este arquivo deve ser copiado para um novo MD de funcionalidade e preenchido somente com base em inspeção real do código, dos dados, das rotas e da documentação global da memória.

- Não inventar arquivos, rotas, tabelas, serviços, campos, dependências ou regras.
- Quando faltar informação, usar `Não identificado ainda.`
- Quando o item não se aplicar, usar `Não aplicável.`
- Não copiar trechos longos de arquitetura, rotas, schema ou fluxo de dados.
- Usar este modelo para documentar uma funcionalidade por vez.
- Atualizar o MD da funcionalidade sempre que houver mudança relevante no código ou nos dados relacionados.

## Identificação da funcionalidade

| Campo | Valor |
| --- | --- |
| Nome da funcionalidade | `<nome-da-funcionalidade>` |
| Arquivo deste documento | `memoria/01_PROJETO_APLICACAO/funcionalidades/<nome>.md` |
| Status do documento | `rascunho / validado / desatualizado` |
| Última revisão | `<data>` |
| Responsável pela revisão | `<nome ou unidade>` |
| Funcionalidade crítica? | `sim / não` |
| Requer atualização quando alterar código? | `sim / não` |

## 1. Spec — Especificação funcional

### 1.1. Problema do usuário

| Campo | Valor |
| --- | --- |
| Problema real do usuário | `Não identificado ainda.` |
| Evidência observada | `Não identificado ainda.` |
| Impacto prático | `Não identificado ainda.` |

### 1.2. Objetivo da funcionalidade

| Campo | Valor |
| --- | --- |
| Objetivo prático | `Não identificado ainda.` |
| Resultado esperado | `Não identificado ainda.` |

### 1.3. Perfil de usuário e uso esperado

| Campo | Valor |
| --- | --- |
| Perfil de usuário | `Não identificado ainda.` |
| Uso esperado | `Não identificado ainda.` |

### 1.4. Escopo incluído

| Campo | Valor |
| --- | --- |
| Incluído | `Não identificado ainda.` |

### 1.5. Fora do escopo

| Campo | Valor |
| --- | --- |
| Excluído | `Não identificado ainda.` |

### 1.6. Regras de negócio

| Campo | Valor |
| --- | --- |
| Regra 1 | `Não identificado ainda.` |
| Regra 2 | `Não aplicável.` |

### 1.7. Critérios de aceite funcionais

| Campo | Valor |
| --- | --- |
| Critério 1 | `Não identificado ainda.` |
| Critério 2 | `Não aplicável.` |

## 2. Plan — Planejamento técnico

### 2.1. Arquivos front-end relacionados

| Camada | Arquivo | Papel na funcionalidade | Observação |
| ------ | ------- | ----------------------- | ---------- |
| front-end | `<arquivo>` | `<papel>` | `Não identificado ainda.` |

### 2.2. Arquivos back-end relacionados

| Camada | Arquivo | Papel na funcionalidade | Observação |
| ------ | ------- | ----------------------- | ---------- |
| back-end | `<arquivo>` | `<papel>` | `Não identificado ainda.` |

### 2.3. Rotas/API relacionadas

| Método | Rota | Arquivo/função responsável | Entrada esperada | Saída esperada | Observação |
| ------ | ---- | -------------------------- | ---------------- | -------------- | ---------- |
| `<método>` | `<rota>` | `<arquivo/função>` | `<entrada>` | `<saída>` | `Não identificado ainda.` |

### 2.4. Serviços, controllers ou módulos envolvidos

| Camada | Arquivo | Papel na funcionalidade | Observação |
| ------ | ------- | ----------------------- | ---------- |
| serviço | `<arquivo>` | `<papel>` | `Não identificado ainda.` |
| controller | `<arquivo>` | `<papel>` | `Não aplicável.` |
| módulo | `<arquivo>` | `<papel>` | `Não identificado ainda.` |

### 2.5. Banco de dados relacionado

| Tabela | Coluna/campo | Uso na funcionalidade | Risco | Observação |
| ------ | ------------ | --------------------- | ----- | ---------- |
| `<tabela>` | `<campo>` | `<uso>` | `<risco>` | `Não identificado ainda.` |

### 2.6. JSONs publicados e modo estático

| JSON | Origem | Consumidor | Quando é atualizado | Risco |
| ---- | ------ | ---------- | ------------------- | ----- |
| `<json>` | `<origem>` | `<consumidor>` | `<quando>` | `<risco>` |

### 2.7. Dependências e imports relevantes

| Tipo | Nome | Papel | Observação |
| ---- | ---- | ----- | ---------- |
| dependência | `<dependência>` | `<papel>` | `Não identificado ainda.` |
| import | `<import>` | `<papel>` | `Não identificado ainda.` |

## 3. Research — Decisões, fundamentos e restrições

### 3.1. Decisões técnicas já identificadas

| Decisão | Status | Fonte | Observação |
| ------- | ------ | ----- | ---------- |
| `<decisão>` | `<vigente / provisória / a revisar / não decidida>` | `<arquivo>` | `Não identificado ainda.` |

### 3.2. Fundamentos institucionais ou normativos relacionados

| Base | Papel na funcionalidade | Cautela |
| ---- | ----------------------- | ------- |
| `<base>` | `<papel>` | `Não identificado ainda.` |

### 3.3. Restrições técnicas

| Restrição | Impacto | Observação |
| --------- | ------- | ---------- |
| `<restrição>` | `<impacto>` | `Não identificado ainda.` |

### 3.4. Limites de conhecimento

| Ponto | Status | Observação |
| ----- | ------ | ---------- |
| `<ponto>` | `Não identificado ainda.` | `Não inventar conteúdo para este item.` |

## 4. Fluxo de dados

### 4.1. Origem dos dados

| Fonte | Papel | Observação |
| ----- | ---- | ---------- |
| `<fonte>` | `<papel>` | `Não identificado ainda.` |

### 4.2. Entrada pela interface

| Campo | Valor |
| --- | --- |
| Ponto de entrada | `Não identificado ainda.` |
| Ação do usuário | `Não identificado ainda.` |

### 4.3. Validação no front-end

| Validação | Regra | Observação |
| --------- | ----- | ---------- |
| `<validação>` | `<regra>` | `Não identificado ainda.` |

### 4.4. Requisição à API

| Campo | Valor |
| --- | --- |
| Método | `Não identificado ainda.` |
| Rota | `Não identificado ainda.` |
| Payload | `Não identificado ainda.` |

### 4.5. Validação no back-end

| Validação | Regra | Observação |
| --------- | ----- | ---------- |
| `<validação>` | `<regra>` | `Não identificado ainda.` |

### 4.6. Persistência no banco

| Tabela | Operação | Observação |
| ------ | -------- | ---------- |
| `<tabela>` | `<insert / update / delete / select>` | `Não identificado ainda.` |

### 4.7. Publicação estática, se houver

| JSON | Origem | Atualização | Observação |
| ---- | ------ | ----------- | ---------- |
| `<json>` | `<origem>` | `<quando>` | `Não aplicável.` |

### 4.8. Exibição ao usuário

| Saída | Local | Observação |
| ----- | ----- | ---------- |
| `<saída>` | `<tela/componente>` | `Não identificado ainda.` |

## 5. Estados da interface e experiência do usuário

### 5.1. Estados esperados da tela

| Estado | Descrição | Observação |
| ------ | --------- | ---------- |
| `<estado>` | `<descrição>` | `Não identificado ainda.` |

### 5.2. Mensagens de sucesso, erro e vazio

| Tipo | Mensagem | Observação |
| ---- | -------- | ---------- |
| sucesso | `<mensagem>` | `Não identificado ainda.` |
| erro | `<mensagem>` | `Não identificado ainda.` |
| vazio | `<mensagem>` | `Não aplicável.` |

### 5.3. Responsividade

| Ponto | Status | Observação |
| ----- | ------ | ---------- |
| `<ponto>` | `Não identificado ainda.` | `Não identificado ainda.` |

### 5.4. Acessibilidade

| Ponto | Status | Observação |
| ----- | ------ | ---------- |
| `<ponto>` | `Não identificado ainda.` | `Não identificado ainda.` |

### 5.5. Pontos de atenção de UX

| Ponto | Risco | Observação |
| ----- | ----- | ---------- |
| `<ponto>` | `<risco>` | `Não identificado ainda.` |

## 6. Validação e tratamento de erros

### 6.1. Validações obrigatórias

| Validação | Regra | Observação |
| --------- | ----- | ---------- |
| `<validação>` | `<regra>` | `Não identificado ainda.` |

### 6.2. Erros esperados

| Erro | Causa provável | Observação |
| ---- | ------------- | ---------- |
| `<erro>` | `<causa>` | `Não identificado ainda.` |

### 6.3. Respostas HTTP esperadas

| Status | Situação | Observação |
| ------ | -------- | ---------- |
| `<status>` | `<situação>` | `Não identificado ainda.` |

### 6.4. Logs e diagnóstico

| Fonte | O que observar | Observação |
| ----- | -------------- | ---------- |
| `<log>` | `<o que observar>` | `Não identificado ainda.` |

### 6.5. Falhas que não devem ser silenciadas

| Falha | Motivo | Observação |
| ----- | ------ | ---------- |
| `<falha>` | `<motivo>` | `Não identificado ainda.` |

## 7. Segurança e proteção de dados

### 7.1. Dados sensíveis ou administrativos

| Dado | Risco | Observação |
| ---- | ----- | ---------- |
| `<dado>` | `<risco>` | `Não identificado ainda.` |

### 7.2. Validação de entrada

| Entrada | Regra | Observação |
| ------- | ----- | ---------- |
| `<entrada>` | `<regra>` | `Não identificado ainda.` |

### 7.3. Autorização e exposição indevida

| Ponto | Risco | Observação |
| ----- | ----- | ---------- |
| `<ponto>` | `<risco>` | `Não identificado ainda.` |

### 7.4. Riscos de XSS, SQL injection ou vazamento

| Risco | Origem | Mitigação | Observação |
| ----- | ------ | --------- | ---------- |
| `<risco>` | `<origem>` | `<mitigação>` | `Não identificado ainda.` |

### 7.5. Cuidados com JSONs publicados

| Cuidados | Regra | Observação |
| -------- | ----- | ---------- |
| `<cuidado>` | `<regra>` | `Não identificado ainda.` |

## 8. Performance e manutenibilidade

### 8.1. Pontos de custo computacional

| Ponto | Custo | Observação |
| ----- | ----- | ---------- |
| `<ponto>` | `<custo>` | `Não identificado ainda.` |

### 8.2. Riscos de consultas ou renderizações custosas

| Ponto | Risco | Observação |
| ----- | ----- | ---------- |
| `<ponto>` | `<risco>` | `Não identificado ainda.` |

### 8.3. Acoplamentos relevantes

| Acoplamento | Impacto | Observação |
| ----------- | ------- | ---------- |
| `<acoplamento>` | `<impacto>` | `Não identificado ainda.` |

### 8.4. Oportunidades de simplificação

| Ponto | Benefício | Observação |
| ----- | --------- | ---------- |
| `<ponto>` | `<benefício>` | `Não identificado ainda.` |

## 9. Tasks — Microtarefas típicas

### 9.1. Alteração simples de campo

- `<microtarefa>`

### 9.2. Alteração de regra de negócio

- `<microtarefa>`

### 9.3. Alteração de layout ou componente

- `<microtarefa>`

### 9.4. Alteração de rota/API

- `<microtarefa>`

### 9.5. Alteração de banco/schema

- `<microtarefa>`

### 9.6. Alteração de publicação estática

- `<microtarefa>`

### 9.7. Atualização documental obrigatória

- `<microtarefa>`

## 10. Test Plan — Plano de teste

### 10.1. Testes manuais da interface

| Teste | Passo | Resultado esperado | Observação |
| ----- | ----- | ------------------ | ---------- |
| `<teste>` | `<passo>` | `<resultado>` | `Não identificado ainda.` |

### 10.2. Testes de API

| Teste | Rota | Resultado esperado | Observação |
| ----- | ---- | ------------------ | ---------- |
| `<teste>` | `<rota>` | `<resultado>` | `Não identificado ainda.` |

### 10.3. Testes de banco de dados

| Teste | Tabela | Resultado esperado | Observação |
| ----- | ------ | ------------------ | ---------- |
| `<teste>` | `<tabela>` | `<resultado>` | `Não aplicável.` |

### 10.4. Testes de modo estático

| Teste | JSON | Resultado esperado | Observação |
| ----- | ---- | ------------------ | ---------- |
| `<teste>` | `<json>` | `<resultado>` | `Não aplicável.` |

### 10.5. Testes de responsividade

| Viewport | Cenário | Resultado esperado | Observação |
| -------- | ------- | ------------------ | ---------- |
| `<viewport>` | `<cenário>` | `<resultado>` | `Não identificado ainda.` |

### 10.6. Testes de acessibilidade básica

| Critério | Resultado esperado | Observação |
| -------- | ------------------ | ---------- |
| `<critério>` | `<resultado>` | `Não identificado ainda.` |

### 10.7. Verificação de console e logs

| Verificação | O que procurar | Observação |
| ----------- | -------------- | ---------- |
| `<verificação>` | `<o que procurar>` | `Não identificado ainda.` |

### 10.8. Checklist antes do commit

- conferir `git status --short`
- conferir `git diff --name-only`
- conferir `git diff --check`
- validar escopo
- registrar pendências se houver

## 11. Riscos conhecidos

### 11.1. Riscos de regressão

| Risco | Classificação | Observação |
| ----- | ------------- | ---------- |
| `<risco>` | `erro real / risco provável / melhoria recomendada / melhoria opcional / refatoração estética` | `Não identificado ainda.` |

### 11.2. Riscos de dados

| Risco | Impacto | Observação |
| ----- | ------- | ---------- |
| `<risco>` | `<impacto>` | `Não identificado ainda.` |

### 11.3. Riscos de publicação estática

| Risco | Impacto | Observação |
| ----- | ------- | ---------- |
| `<risco>` | `<impacto>` | `Não aplicável.` |

### 11.4. Riscos de UX

| Risco | Impacto | Observação |
| ----- | ------- | ---------- |
| `<risco>` | `<impacto>` | `Não identificado ainda.` |

### 11.5. Riscos institucionais ou normativos

| Risco | Impacto | Observação |
| ----- | ------- | ---------- |
| `<risco>` | `<impacto>` | `Não identificado ainda.` |

## 12. Como alterar esta funcionalidade com segurança

1. Ler `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`.
2. Ler este MD da funcionalidade.
3. Confirmar os arquivos-alvo.
4. Conferir `git status --short`.
5. Alterar o mínimo necessário.
6. Validar localmente.
7. Atualizar este MD se a mudança afetar rota, banco, JSON, regra, fluxo ou teste.
8. Validar o diff.
9. Comitar com mensagem objetiva.
10. Prever rollback.

## 13. O que não fazer

- não varrer o projeto inteiro sem necessidade
- não alterar banco sem backup e rollback
- não alterar JSONs publicados sem escopo claro
- não alterar rotas sem conferir consumidores
- não alterar schema sem avaliar migração
- não inventar dados
- não misturar refatoração estética com correção funcional
- não criar dependência nova sem justificativa

## 14. Rollback

| Tipo de alteração | Estratégia de rollback | Observação |
| ----------------- | ---------------------- | ---------- |
| documento | `git restore <arquivo>` ou `git revert <hash_do_commit>` | `Não identificado ainda.` |
| front-end | `git restore <arquivo>` | `Não identificado ainda.` |
| back-end | `git restore <arquivo>` | `Não identificado ainda.` |
| banco/schema | restaurar backup ou reverter migration | `Não identificado ainda.` |
| JSON publicado | restaurar o JSON ao estado anterior ou `git revert <hash_do_commit>` | `Não identificado ainda.` |
| script | `git restore <arquivo>` | `Não identificado ainda.` |
| dependência | reverter `package.json` e `package-lock.json` | `Não identificado ainda.` |

## 15. Histórico de decisões e bugs relacionados

| Item | Tipo | Referência | Observação |
| ---- | ---- | ---------- | ---------- |
| `<item>` | `<decisão / bug / risco>` | `<arquivo ou commit>` | `Não identificado ainda.` |

## 16. Arquivos que devem ser atualizados junto com esta funcionalidade

| Arquivo | Quando atualizar | Observação |
| ------- | ---------------- | ---------- |
| `memoria/01_PROJETO_APLICACAO/funcionalidades/<nome>.md` | sempre que a funcionalidade mudar | arquivo principal |
| `memoria/08_ROTAS_BANCO_API/rotas.md` | se rota/API mudar | fonte global |
| `memoria/08_ROTAS_BANCO_API/schema-banco.md` | se schema ou tabela mudar | fonte global |
| `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` | se o fluxo mudar | fonte global |
| `memoria/09_ERROS_E_CORRECOES/historico-erros.md` | se surgir bug, risco ou correção relevante | fonte global |
| `memoria/10_TESTES/checklist-validacao.md` | se mudar validação obrigatória | fonte global |
| `memoria/01_PROJETO_APLICACAO/pendencias.md` | se surgir ou encerrar pendência | fonte operacional |
| `memoria/00_DIARIO_DE_BORDO/diario-atual.md` | se houver alteração relevante | trilha operacional |
