# Orçamento 2026 — fluxo operacional

## 1. Finalidade da página

A página Orçamento 2026 acompanha processos orçamentários de 2026 e permite observar valores, status, SEI, execução, processos vinculados e alocações de saldo.

Ela deve ser usada como visão operacional da carteira orçamentária, preservando o valor original do processo e registrando as movimentações como leitura e rastreio.

## 2. Conceitos principais

### Processo principal

É o processo base do Orçamento 2026. Ele concentra o valor original do envelope, pode receber processos vinculados e pode participar de alocações de saldo.

O processo principal continua sendo a referência do orçamento global da linha.

### Processo vinculado

É o processo criado por meio de "Dividir recurso" a partir de um processo principal.

O processo vinculado:

- fica associado ao processo pai;
- recebe valor próprio;
- aparece logo abaixo do pai na tabela;
- mantém linha completa, status, SEI, edição e rastreio próprios;
- não deve duplicar o orçamento global.

### Valor original ou envelope original

É o valor base do processo antes de qualquer divisão ou alocação.

O valor original é preservado no banco. Ele não deve ser sobrescrito pela leitura visual do saldo.

### Envelope visual ajustado

É o valor apresentado na coluna "Valor previsto" quando há filhos vinculados ou movimentações de saldo.

Ele representa a leitura operacional do processo depois de considerar:

- valor original;
- valor recebido por alocação;
- valor cedido por alocação;
- valor vinculado a filhos.

O envelope visual ajustado é um cálculo de leitura. Ele não substitui o valor original armazenado.

### Valor vinculado

É a parcela do envelope distribuída para processos vinculados criados a partir do processo principal.

Na prática, corresponde ao valor alocado para os filhos vinculados, que passa a ser exibido como parte do raciocínio visual da linha do pai.

### Valor recebido por alocação

É o valor que o processo recebeu a partir de uma movimentação de saldo vinda de outro processo.

### Valor cedido por alocação

É o valor que o processo transferiu para outro processo por meio de alocação de saldo.

### Saldo transferível estimado

É a estimativa visual do saldo que ainda pode ser transferido a partir do processo.

Essa estimativa ajuda a orientar o uso do botão "Alocar saldo", mas a validação final continua sendo do backend.

## 3. Dividir recurso

Use "Dividir recurso" quando um processo principal precisar ser repartido em um novo processo vinculado com valor próprio.

Exemplo operacional:

- processo de materiais gráficos de R$ 300.000,00;
- divisão para criar novo processo vinculado de R$ 14.416,00.

O efeito esperado é:

- o processo filho aparece abaixo do pai;
- o pai passa a exibir saldo visual descontado;
- o filho passa a ter linha completa, status, SEI, edição e rastreio próprios;
- o filho não deve exibir o botão "Dividir recurso".

Essa ação cria um novo processo vinculado sem duplicar o orçamento global da carteira.

## 4. Alocar saldo

Use "Alocar saldo" quando for necessário mover saldo entre processos elegíveis da mesma frente ou categoria.

Exemplo operacional:

- mover saldo de "Aquisição de notebooks" para "Kits para leitura de cartas".

Regras de uso:

- a transferência deve ocorrer entre processos da mesma frente/categoria;
- o formulário exige valor, destino, justificativa e senha;
- o backend valida o saldo real antes de concluir a operação;
- a origem passa a exibir valor cedido;
- o destino passa a exibir valor recebido;
- o valor original dos processos não é alterado.

A movimentação é registrada como evento de saldo, não como reescrita do valor original.

## 5. Como interpretar a coluna "Valor previsto"

A coluna "Valor previsto" pode representar três situações:

- valor original, quando não há movimentação;
- envelope visual ajustado, quando há filhos ou alocações;
- detalhe compacto com:
  - `Orig.`;
  - `Rec.`;
  - `Ced.`;
  - `Vinc.`.

Exemplo numérico:

- Original: R$ 300.000,00
- Vinculado: R$ 14.416,00
- Envelope ajustado: R$ 285.584,00

Com alocação cedida adicional de R$ 20.000,00:

- Envelope ajustado: R$ 265.584,00

Regra prática:

- `Orig.` mostra o valor original;
- `Rec.` mostra o que entrou por alocação;
- `Ced.` mostra o que saiu por alocação;
- `Vinc.` mostra o que foi distribuído para processos vinculados.

## 6. Regras de segurança e rastreabilidade

- Não editar JSON publicado manualmente.
- Não commitar dados de teste.
- Sempre limpar alterações em `frontend/data/publicados/*.json` quando forem churn indevido.
- Usar `SKIP_PUBLICAR_DADOS=1` quando o commit não for de publicação.
- Só rodar `npm run publicar:dados` quando a etapa for de publicação controlada.
- Antes de cada etapa, executar `git status`.
- Depois de teste que crie dado local, remover a movimentação/processo de teste ou restaurar o backup.

## 7. Testes recomendados antes de novas mudanças

Executar:

```bash
npm run validar:json
npm run validar:syntax
npm run validar:agente
npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"
```

Teste manual mínimo:

- abrir Orçamento 2026;
- verificar `Valor previsto` e `Ações`;
- abrir modal `Dividir recurso`;
- abrir modal `Alocar saldo`;
- conferir console do navegador;
- conferir logs do backend;
- não persistir dados de teste sem necessidade.

## 8. Publicação estática

`npm run publicar:dados` atualiza os JSONs publicados.

Antes de commitar, conferir o diff e separar apenas o que for esperado.

Se houver apenas churn semântico desnecessário, restaurar o arquivo afetado.

Se a etapa for de publicação, commitar apenas JSONs publicados e memória.

Depois da publicação, validar com `npm run validar:agente`.

## 9. Arquivos principais envolvidos

- `frontend/js/app.js` - renderização da tela, modais, leitura de saldo e ações do Orçamento 2026.
- `frontend/css/app.css` - estilos da tabela, modais e blocos visuais da view.
- `backend/services/orcamento-2026-service.js` - regras de leitura, persistência e normalização do Orçamento 2026.
- `backend/server.js` - rotas HTTP da aplicação local.
- `backend/db/init-db.js` - schema local e evolução aditiva do banco SQLite.
- `tests/e2e/app.spec.js` - cobertura E2E da SPA e do Orçamento 2026 sem persistência.
- `frontend/data/publicados/*.json` - dados consumidos pelo modo estático/publicado.
- `memoria/00_DIARIO_DE_BORDO/diario-atual.md` - registro operacional do andamento das etapas.

## 10. Riscos conhecidos

- Churn de `publicadoEm` em JSONs publicados.
- Dado de teste local esquecido após uma validação manual.
- Alteração visual em tabela larga ou em view com muitos botões.
- Divergência entre cálculo visual e validação do backend.
- Necessidade de manter o backend como fonte de verdade.
- Mudança futura nos seletores do E2E.
