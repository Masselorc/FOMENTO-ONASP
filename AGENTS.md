# AGENTS.md

## Finalidade

Este arquivo orienta agentes de IA, Codex, Gemini, ChatGPT ou qualquer executor automatizado que atuar no repositório `FOMENTO-ONASP`.

O projeto é uma aplicação institucional da ONASP/SENAPPEN para acompanhamento de orçamento, fomento, formalização PROFOR, parâmetros mínimos, contatos das UFs, status do sistema, convênios, FAF e doações.

A atuação esperada é técnica, conservadora, rastreável e orientada a baixo risco.

## Protocolo obrigatório de leitura

Antes de qualquer alteração no projeto, leia nesta ordem:

1. `AGENTS.md`;
2. `memoria/INDEX.md`;
3. apenas os arquivos de memória indicados pelo `memoria/INDEX.md` para o tipo de tarefa;
4. somente depois, os arquivos reais do código, dados ou documentação afetados.

Não carregue a pasta `memoria/` inteira sem necessidade. A memória existe para economizar contexto, não para consumir todos os tokens da sessão.

## Uso eficiente da memória

- Use `memoria/INDEX.md` como roteador de contexto.
- Para tarefa de código, priorize a memória técnica da aplicação.
- Para tarefa institucional, normativa ou documental, priorize a memória institucional, normativos, Pena Justa e PROFOR.
- Para tarefa de dados, dashboards ou planilhas, priorize dicionário de dados, fluxo de dados, rotas e schema.
- Para correção de erro, consulte também histórico de erros e checklist de validação.
- Se o conteúdo da memória conflitar com o código real, o código real prevalece para diagnóstico técnico.
- Se o conteúdo da memória conflitar com norma, documento SEI ou fonte institucional, prevalece a fonte normativa ou institucional.

## Ausência ou incompletude da memória local

Se a pasta `memoria/` ou o arquivo `memoria/INDEX.md` não existir no ambiente atual, não inventar seu conteúdo.

Nesse caso:

- informar que a memória local não está disponível;
- prosseguir apenas com a análise dos arquivos reais do repositório;
- não criar a pasta `memoria/` automaticamente sem solicitação expressa;
- não tentar versionar arquivos da memória local sem autorização.

Se a memória existir, mas algum arquivo temático estiver vazio ou incompleto:

- declarar que aquele arquivo ainda não possui conteúdo operacional suficiente;
- complementar a análise com inspeção direta do código ou das fontes oficiais;
- não tratar arquivo vazio como evidência.

## Segurança da memória

A pasta `memoria/` pode ser versionada apenas com arquivos Markdown tratados e não sensíveis.

Não registrar na memória:

- senhas, tokens, chaves, credenciais ou segredos;
- dados pessoais sensíveis;
- documentos brutos do SEI;
- anexos pesados;
- PDFs, planilhas, imagens ou bases locais;
- conteúdo integral de documentos protegidos ou desnecessariamente extensos.

Registrar apenas sínteses operacionais, referências, critérios de uso, decisões, riscos, pendências, links internos e orientações de manutenção.

## Regras de trabalho no repositório

- Não trabalhar diretamente no `main` para alterações de código ou documentação relevante.
- Criar branch própria por tarefa.
- Atualizar `main` antes de criar branch.
- Rodar `git status --short` antes de alterar arquivos.
- Analisar a estrutura existente antes de propor ou aplicar código.
- Não inventar arquivos, rotas, endpoints, tabelas, colunas, funções, variáveis, dependências ou serviços.
- Não alterar arquitetura sem justificativa técnica clara.
- Não criar dependências novas sem demonstrar necessidade, alternativa nativa e risco de manutenção.
- Priorizar alterações pequenas, testáveis e reversíveis.
- Não misturar backend, UX, dados, documentação e refatoração ampla no mesmo PR.
- Não alterar JSONs publicados salvo tarefa específica de publicação.
- Se JSONs publicados aparecerem no diff por resíduo de hook, teste ou salvamento local, reverter antes de abrir PR.
- Não versionar arquivos SQLite, SQLite WAL/SHM, logs, backups, `.env` ou anexos locais.
- Não remover serviço, rota, tabela ou arquivo operacional sem busca prévia de referências.
- Todo código novo ou alteração relevante deve ser comentado de forma objetiva para facilitar inspeções e manutenções futuras.

## Regras específicas do modo local e GitHub Pages

A aplicação possui dois modos relevantes:

- modo local editável, com backend disponível;
- modo GitHub Pages, estático e somente leitura.

No GitHub Pages:

- não há backend local;
- os dados vêm de `frontend/data/publicados/*.json`;
- ações de escrita devem permanecer bloqueadas;
- botões dependentes de backend devem usar `data-requer-backend="true"` quando aplicável;
- `aplicarModoSomenteLeitura()` deve preservar o bloqueio das ações de escrita.

Não transformar limitação do GitHub Pages em bug funcional sem verificar o modo de execução.

## Entrega esperada em revisões, correções ou implementações

Sempre que revisar, corrigir ou implementar algo, registrar na resposta:

1. Problema encontrado.
2. Evidência no código ou comportamento observado.
3. Impacto prático.
4. Correção aplicada ou recomendada.
5. Testes executados ou recomendados.
6. Risco de regressão.
7. Rollback, quando aplicável.
8. Nome de commit sugerido, quando houver alteração.

Classificar achados, quando útil, como:

- erro real;
- risco provável;
- melhoria recomendada;
- melhoria opcional;
- refatoração estética.

## Atualização obrigatória da memória

Ao concluir tarefa relevante, atualizar, quando aplicável:

- `memoria/00_DIARIO_DE_BORDO/diario-atual.md`;
- `memoria/01_PROJETO_APLICACAO/pendencias.md`, se houver mudança no backlog;
- o arquivo temático afetado, se a tarefa alterar regra, arquitetura, dado, rota, fluxo, decisão técnica ou orientação institucional.

Não atualizar a memória com conteúdo especulativo. Se houver dúvida, registrar como pendência de confirmação.

## Antes de finalizar uma tarefa

Verificar, quando fizer sentido:

- `git status --short`;
- `git diff --stat`;
- `git diff --name-status`;
- `node --check` nos arquivos JavaScript alterados;
- build ou execução local, se existir script definido;
- console do navegador;
- logs do backend;
- fluxo manual afetado;
- responsividade;
- acessibilidade básica;
- impacto no banco de dados;
- impacto no GitHub Pages;
- necessidade de atualização da memória e do diário de bordo.

## Comandos recorrentes

```bash
git checkout main
git pull origin main
git status --short
git checkout -b nome-do-branch
node --check frontend/js/app.js
node --check backend/server.js
git diff --stat
git diff --name-status
```
