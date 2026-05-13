# Checklist de Validação — FOMENTO-ONASP

## Finalidade

Este arquivo consolida validações operacionais para reduzir regressões no FOMENTO-ONASP, preservar dados, orientar Codex/IA e facilitar manutenção futura.

O checklist organiza comandos, verificações manuais, critérios de aceite, riscos e rollback por tipo de tarefa. Ele não substitui a leitura do código, dos serviços, das rotas, do banco ou das memórias técnicas.

## Como usar este checklist

- Aplicar de forma proporcional ao tipo de tarefa.
- Para tarefa documental, validar escopo e diff; não rodar aplicação sem necessidade.
- Para alteração de código, validar sintaxe, fluxo afetado, modo local/API e modo estático quando aplicável.
- Para dados ou publicação, validar origem, diff dos JSONs publicados e estrutura mínima.
- Para banco, prever backup, validação e rollback antes de qualquer alteração real.
- Registrar no diário de bordo quando a tarefa for relevante e o escopo permitir.
- Não tratar checklist futuro como teste já executado; registrar apenas o que foi realmente rodado.

## Regra geral de validação

- Validar primeiro o escopo solicitado.
- Conferir se o workspace está limpo ou conscientemente controlado.
- Não misturar documentação, código, dados, banco e JSONs publicados sem justificativa.
- Rodar apenas validações proporcionais ao risco da mudança.
- Conferir `git diff --check` antes de concluir.
- Registrar resultado, pendências, risco de regressão e rollback no diário quando previsto.
- Se aparecer arquivo fora do escopo, parar e diagnosticar antes de continuar.

## Checklist inicial antes de qualquer tarefa

Comandos:

```bash
git fetch origin
git status --short
git branch --show-current
git log --oneline -5
```

Verificar:

- Branch correta.
- Working tree limpo antes do patch.
- Arquivos modificados fora do escopo.
- Divergência com `origin/main`.
- JSON publicado modificado sem tarefa de publicação.
- Banco SQLite, WAL, SHM, backup, log ou planilha no status.
- Se a tarefa permite alterar memória, código, dados ou apenas documentação.

Critério de aceite:

- Prosseguir somente se o estado inicial estiver limpo ou se a sujeira estiver explicitamente autorizada e compreendida.

Rollback inicial:

- Se houver arquivo fora do escopo, não limpar automaticamente sem autorização ou sem regra expressa.
- Para artefato derivado claramente indevido, preferir `git restore <arquivo>` quando o usuário autorizar.

## Checklist para tarefa documental

Comandos:

```bash
git status --short
git diff --name-only
git diff --check
```

Verificar:

- Apenas arquivos documentais permitidos foram alterados.
- Diário de bordo atualizado, quando previsto.
- Nenhum código, banco, planilha, teste, script ou JSON publicado foi alterado.
- Conteúdo não inventa arquivo, rota, endpoint, tabela, coluna, payload, valor, UF ou dado.
- Lacunas estão marcadas como "não confirmado" quando necessário.
- O texto diferencia fato, risco, recomendação e validação futura.

Critério de aceite:

- Diff restrito ao escopo documental e sem erro de whitespace.

Rollback:

```bash
git restore <arquivo_documental>
```

Após commit enviado:

```bash
git revert <hash_do_commit>
git push origin HEAD
```

## Checklist para alteração de frontend

Comandos conforme arquivo alterado:

```bash
node --check frontend/js/app.js
npm run validar:syntax
npm run validar:agente
git diff --check
```

Verificar:

- A mudança está restrita à página ou componente solicitado.
- `frontend/js/app.js` e `frontend/css/app.css` foram alterados apenas quando necessário.
- Navegação da SPA continua funcionando.
- Console do navegador não registra erro crítico.
- Modo local/API funciona quando a tarefa envolve edição.
- Modo estático/GitHub Pages continua somente leitura quando aplicável.
- Controles que exigem backend usam ou preservam `data-requer-backend="true"`.
- Modais abrem e fecham.
- Tabelas permanecem legíveis.
- Responsividade básica foi conferida.
- Acessibilidade básica foi conferida.
- Comentários de código explicam apenas razão técnica não óbvia.
- Não há comentário redundante que repita o que o código já faz.

Critério de aceite:

- Fluxo principal afetado funciona sem quebrar páginas críticas ou modo estático.

Rollback:

```bash
git restore frontend/js/app.js frontend/css/app.css
```

Após commit enviado, usar `git revert <hash_do_commit>`.

## Checklist para alteração de backend/API

Comandos conforme arquivo alterado:

```bash
node --check backend/server.js
node --check backend/services/<servico-alterado>.js
npm start
git diff --check
```

Verificar:

- Serviço responsável foi identificado antes da alteração.
- Rota, serviço e frontend consumidor continuam compatíveis.
- Entradas são validadas no backend.
- Erros esperados retornam resposta controlada.
- Status code esperado foi conferido.
- Resposta JSON mantém campos consumidos pelo frontend.
- Logs do backend não mostram exceção.
- Escritas criam backup, histórico e publicação quando o fluxo exigir.
- Nenhum dado de teste ficou persistido.

Critério de aceite:

- Endpoint afetado responde corretamente em caso de sucesso e erro esperado.

Rollback:

```bash
git restore backend/server.js backend/services/<servico-alterado>.js
```

Após commit enviado, usar `git revert <hash_do_commit>`.

## Checklist para alteração de rotas

Verificar:

- `backend/server.js` contém a rota real.
- Método HTTP está correto.
- Serviço chamado foi conferido.
- Payload esperado foi confirmado no serviço e no frontend consumidor.
- Resposta esperada foi confirmada.
- Rota de escrita usa `lerJsonBody`, quando recebe JSON.
- Rota de escrita chama `publicarAposSalvamento` quando altera dado que alimenta publicação.
- Rota de leitura não aciona publicação.
- Rota de exportação retorna arquivo `.xlsx` quando aplicável.
- `memoria/08_ROTAS_BANCO_API/rotas.md` foi atualizado se a rota mudou.
- `memoria/08_ROTAS_BANCO_API/fluxo-dados.md` foi atualizado se o fluxo mudou.
- `memoria/08_ROTAS_BANCO_API/schema-banco.md` foi atualizado se houver impacto em banco.

Comandos possíveis:

```bash
node --check backend/server.js
npm start
git diff --check
```

Critério de aceite:

- Rota documentada, serviço confirmado e efeito colateral explícito.

Rollback:

- Reverter rota e serviço juntos para não deixar endpoint órfão.

## Checklist para alteração de banco SQLite

Antes de alterar:

- Confirmar que a tarefa permite mexer em banco.
- Não abrir ou alterar `backend/data/onasp.sqlite` se a tarefa for documental.
- Não versionar `backend/data/onasp.sqlite`, WAL, SHM ou backups.
- Prever backup antes de migration real.
- Não executar migration destrutiva sem confirmação expressa.

Comandos quando aplicável:

```bash
npm run init-db
npm start
git status --short
git diff --check
```

Verificar:

- Tabela ou coluna existe em `backend/db/init-db.js`.
- Serviço que usa a tabela foi validado.
- Rota que grava foi validada.
- Exportação Excel foi validada se depender do campo.
- Publicação estática foi validada se a mudança afetar JSON publicado.
- `schema-banco.md` foi atualizado.
- SQLite, WAL, SHM e backups não aparecem no Git.

Critério de aceite:

- Schema evolui de forma aditiva ou com migration explicitamente aprovada, com rollback definido.

Rollback:

- Restaurar backup do SQLite quando houver alteração real de banco.
- Reverter código versionado com `git restore` antes do commit ou `git revert` após push.

## Checklist para dados, planilhas e importações

Verificar:

- Fonte do dado foi identificada.
- Planilha, CSV ou JSON de origem foi confirmado.
- Serviço de normalização foi identificado.
- Nenhum dado, UF, valor, percentual, processo ou métrica foi inventado.
- Dado simulado não foi misturado com dado real.
- Formatação brasileira foi usada para moeda, data, número e percentual.
- Totais e percentuais foram recalculados quando a tarefa exigir.
- Planilha bruta não foi copiada para `memoria/`.
- Planilha não entrou no commit sem tarefa específica de dados.
- Diário registra fonte, limitação e validações quando a tarefa alterar dado.

Comandos possíveis:

```bash
git status --short
git diff --name-only
npm run validar:json
git diff --check
```

Critério de aceite:

- Dado alterado é rastreável até fonte real e não gera arquivo fora do escopo.

Rollback:

- Restaurar arquivo de dados alterado indevidamente.
- Reverter commit se publicação ou dado derivado já tiver sido enviado.

## Checklist para JSONs publicados

Comandos:

```bash
git diff -- frontend/data/publicados/
npm run validar:json
git diff --check
```

Verificar:

- Alteração é material ou apenas `publicadoEm`/metadado.
- JSONs esperados existem:
- `frontend/data/publicados/aplicacao.json`.
- `frontend/data/publicados/dashboard-geral.json`.
- `frontend/data/publicados/parametros-minimos.json`.
- `frontend/data/publicados/formalizacao-profor.json`.
- `frontend/data/publicados/orcamento-2026.json`.
- `frontend/data/publicados/resumo-publicacao.json`.
- Estrutura mínima passa em `scripts/validar-json-publicados.js`.
- Não houve edição manual sem justificativa clara.
- Churn semântico desnecessário foi restaurado.
- Arquivos publicados entram no commit apenas em etapa de publicação ou alteração de dados justificada.

Critério de aceite:

- Diff dos JSONs publicados foi analisado e explicado.

Rollback:

```bash
git restore frontend/data/publicados/*.json
```

Após commit enviado, usar `git revert <hash_do_commit>`.

## Checklist para publicação estática/GitHub Pages

Comandos quando a tarefa exigir publicação:

```bash
npm run publicar:dados
git status --short
git diff -- frontend/data/publicados/
npm run validar:json
```

Verificar:

- `npm run publicar:dados` só foi executado quando necessário.
- `backend/scripts/publicar-dados-estaticos.js` prepara o banco e chama `publicarDadosEstaticos`.
- `frontend/data/publicados/` foi conferido.
- `resumo-publicacao.json` reflete a publicação.
- Modo estático consome JSONs publicados.
- Controles dependentes de backend ficam bloqueados por `data-requer-backend="true"` e `static-mode.js`.
- Commits documentais usam ou preservam a regra de não republicar.
- `SKIP_PUBLICAR_DADOS=1` foi usado quando necessário para evitar publicação automática indevida.

Critério de aceite:

- Modo publicado permanece somente leitura e renderiza dados esperados.

Rollback:

- Restaurar JSONs publicados antes do commit.
- Após push, `git revert <hash_do_commit>` e `git push origin HEAD`.

## Checklist por área funcional

### Dashboard geral

Verificar:

- KPIs carregam.
- Origem dos dados foi confirmada.
- Planilha configurada foi conferida quando afetada.
- `dashboard-geral.json` foi validado se a publicação mudou.
- Não há rota local específica de dashboard documentada como confirmada sem evidência.

Validações possíveis:

```bash
npm run validar:json
npm run validar:agente
```

### Parâmetros Mínimos

Verificar:

- Tela Parâmetros Mínimos carrega.
- Nome visível `Parâmetros Mínimos` foi preservado.
- Chave interna `diagnostico-ouvidorias` não foi renomeada sem pedido explícito.
- Edição de status/quantidades foi testada no modo local/API quando a tarefa exigir.
- Histórico foi conferido quando afetado.
- Reversão foi conferida quando afetada.
- Exportação Excel foi conferida quando afetada.
- `parametros-minimos.json` foi validado se a publicação mudou.

Rotas relevantes documentadas:

- `GET /api/parametros-minimos`.
- `POST /api/parametros-minimos/salvar`.
- `GET /api/parametros-minimos/historico`.
- `POST /api/parametros-minimos/historico/reverter`.
- `GET /api/parametros-minimos/exportar`.

### Formalização PROFOR

Verificar:

- Lista carrega.
- Detalhe por UF carrega.
- Status e observação salvam quando a tarefa exigir escrita.
- Histórico foi conferido quando afetado.
- Exportação Excel foi conferida quando afetada.
- `formalizacao-profor.json` foi validado se a publicação mudou.

Rotas relevantes documentadas:

- `GET /api/formalizacao-profor`.
- `POST /api/formalizacao-profor/salvar`.
- `GET /api/formalizacao-profor/historico`.
- `GET /api/formalizacao-profor/exportar`.

### Orçamento 2026

Verificar:

- Tela Orçamento 2026 carrega.
- Tabela principal aparece.
- Colunas `Valor previsto` e `Ações` aparecem.
- Filtros básicos funcionam quando afetados.
- Edição geral funciona quando a tarefa exigir.
- Processo vinculado aparece junto ao pai.
- Modal `Dividir recurso` abre e fecha.
- Modal `Alocar saldo` abre e fecha.
- Alocação de saldo foi validada no backend quando a tarefa exigir escrita.
- Movimentações aparecem quando a tarefa envolver saldo.
- Histórico foi conferido quando afetado.
- Exportação Excel foi conferida quando afetada.
- `orcamento-2026.json` foi validado se a publicação mudou.
- Teste E2E específico do Orçamento 2026 bloqueia POSTs de escrita quando o objetivo for navegação sem persistência.

Rotas relevantes documentadas:

- `GET /api/orcamento-2026`.
- `POST /api/orcamento-2026/salvar`.
- `POST /api/orcamento-2026/processos-vinculados/criar`.
- `POST /api/orcamento-2026/saldos/alocar`.
- `GET /api/orcamento-2026/movimentacoes`.
- `GET /api/orcamento-2026/historico`.
- `GET /api/orcamento-2026/exportar`.

Validações possíveis:

```bash
npx playwright test tests/e2e/app.spec.js -g "orcamento 2026"
npm run validar:agente
```

### FAF 2021

Verificar:

- Lista carrega.
- Detalhe carrega.
- Salvamento de execução foi testado quando a tarefa exigir escrita.
- `backend/data/aplicacao.json` foi conferido se a tarefa alterou FAF 2021.
- Publicação estática foi conferida se a alteração precisa aparecer no modo publicado.
- Cuidado extra: o serviço atual de FAF 2021 grava em `backend/data/aplicacao.json`, não em SQLite.

Rotas relevantes documentadas:

- `GET /api/faf2021`.
- `POST /api/faf2021/salvar`.

### Contatos das UFs

Verificar:

- Tela de contatos carrega.
- Fonte foi confirmada antes de alterar dados.
- Mapa/lista permanece navegável.
- Não documentar rota local de contatos sem evidência, pois não há rota `/api/contatos` confirmada em `backend/server.js`.
- Não inventar UF, contato, e-mail ou telefone.

### Status do Sistema

Verificar:

- View carrega.
- Indicação de modo local/API ou estático faz sentido.
- Dados de publicação são exibidos quando disponíveis.
- Ausência de backend no modo estático não quebra a página.
- `resumo-publicacao.json` foi conferido se a publicação mudou.

## Checklist de testes automatizados e validações locais

Scripts reais confirmados em `package.json`:

```bash
npm start
npm run init-db
npm run import:parametros-minimos
npm run publicar:dados
npm run setup:hooks
npm run validar:setup
npm run validar:json
npm run validar:syntax
npm run validar:agente
```

Uso recomendado:

- `npm start`: validar servidor local, API e entrega de arquivos quando a tarefa exigir.
- `npm run init-db`: validar criação/evolução do banco quando a tarefa tocar schema ou depender do banco.
- `npm run import:parametros-minimos`: usar apenas em tarefa de importação de Parâmetros Mínimos.
- `npm run publicar:dados`: usar apenas em tarefa de publicação controlada ou alteração real de dados que exija JSON publicado.
- `npm run setup:hooks`: configurar hook local quando necessário.
- `npm run validar:setup`: instalar Chromium do Playwright quando o ambiente precisar.
- `npm run validar:json`: validar JSONs publicados esperados.
- `npm run validar:syntax`: checar sintaxe de `scripts/validar-json-publicados.js`, `playwright.config.js` e `tests/e2e/app.spec.js`.
- `npm run validar:agente`: rodar JSON, sintaxe e Playwright.

Observação:

- Este checklist documenta comandos reais; não significa que todos devam ser executados em toda tarefa.

## Checklist de acessibilidade e responsividade

Verificar manualmente quando a tarefa afetar interface:

- Navegação por teclado alcança controles principais.
- Foco visível em botões, links e campos.
- Botões possuem rótulo claro, `title`, texto ou ícone compreensível.
- Modais podem ser fechados sem salvar.
- Conteúdo de modal não fica inacessível em tela menor.
- Tabelas permanecem utilizáveis em tela menor.
- Texto e badges continuam legíveis.
- Contraste visual não prejudica leitura.
- Estados desabilitados são perceptíveis.
- Controles bloqueados no modo estático indicam que exigem modo local.

Critério de aceite:

- Fluxo principal pode ser usado sem mouse em operações básicas e sem corte grave de conteúdo em tela menor.

## Checklist de segurança, sigilo e LGPD

Verificar:

- Nenhuma senha, token, chave ou credencial foi versionada.
- `.env` e variações continuam ignorados.
- SQLite, WAL, SHM e backups continuam ignorados.
- Logs e dumps não entraram no diff.
- Planilhas brutas, PDFs, DOCX, imagens e anexos sensíveis não foram copiados para `memoria/`.
- Memória contém síntese operacional, não fonte bruta.
- Dados pessoais sensíveis não foram expostos no frontend ou em JSON publicado sem análise específica.
- Exemplos e testes não persistem dado real sem necessidade.
- `.gitignore` cobre artefatos locais relevantes.

Critério de aceite:

- Nenhum artefato sensível ou dado bruto indevido aparece em `git status --short`.

## Checklist de Git, commit, sync e rollback

Antes do commit:

```bash
git status --short
git diff --name-only
git diff --check
git diff --cached --check
```

Stage e commit:

```bash
git add <arquivos>
git commit -m "tipo(escopo): descrição curta"
```

Sync:

```bash
git push origin HEAD
```

Se o push falhar porque o remoto está à frente:

```bash
git pull --rebase origin main
git push origin HEAD
```

Rollback antes do commit:

```bash
git restore <arquivo>
git restore --staged <arquivo>
```

Rollback após push:

```bash
git revert <hash_do_commit>
git push origin HEAD
```

Regras:

- Não usar `git reset --hard` sem autorização expressa.
- Não usar limpeza destrutiva sem autorização expressa.
- Não commitar arquivo fora do escopo.
- Não fazer push se validação obrigatória falhar.
- Conferir hash do commit e working tree limpo após push.

## Critérios mínimos antes de pedir revisão humana

- Escopo está claro.
- Arquivos alterados correspondem ao pedido.
- Diff foi revisado.
- Validações proporcionais foram executadas ou a impossibilidade foi registrada.
- Riscos de regressão foram identificados.
- Rollback foi definido.
- Diário de bordo foi atualizado quando previsto.
- Não há arquivo sensível, banco, planilha ou JSON publicado indevido no diff.

## Critérios mínimos antes de commit

- `git status --short` mostra apenas arquivos esperados.
- `git diff --name-only` confirma o escopo.
- `git diff --check` passa.
- `git diff --cached --check` passa após stage.
- Validações obrigatórias do prompt passaram.
- Arquivos staged foram conferidos.
- Nenhum código entrou em commit documental.
- Nenhum JSON publicado entrou em commit documental.
- Mensagem de commit segue `tipo(escopo): descrição curta`.

## Critérios mínimos após push/sync

Comandos:

```bash
git status
git log --oneline -5
git rev-parse HEAD
```

Verificar:

- Branch está atualizada com `origin/main`.
- Working tree está limpo.
- Commit aparece no topo do log.
- Hash do commit foi registrado no relatório final.
- Rollback pós-push foi informado.

## Quando parar e pedir diagnóstico

Parar quando:

- Arquivo fora do escopo aparece no diff.
- JSON publicado muda sem motivo claro.
- Banco SQLite, WAL, SHM ou backup aparece no status.
- Planilha aparece sem tarefa de dados.
- Teste obrigatório falha.
- `git diff --check` falha.
- Rota, tabela, coluna, payload ou arquivo não é confirmado no código.
- Conflito ocorre em merge ou rebase.
- Alteração exige migration destrutiva.
- Há dúvida entre dado real e dado simulado.
- A validação exige POST de escrita real não autorizado.
- A publicação estática altera módulos não relacionados.
- O modo estático passa a depender de API local.

Conduta:

- Não fazer commit.
- Não fazer push.
- Relatar comando que falhou, erro observado, arquivos alterados, hipótese e recomendação.

## O que não fazer

- Não inventar dados, UFs, processos, rotas, tabelas, colunas, payloads, scripts ou automações.
- Não criar dependência sem justificativa, alternativa nativa e avaliação de risco.
- Não alterar stack sem ganho técnico claro.
- Não editar JSON publicado manualmente sem justificativa.
- Não commitar banco local.
- Não copiar planilhas, PDFs, DOCX, imagens, logs ou documentos brutos para `memoria/`.
- Não misturar tarefa documental com código.
- Não misturar publicação com alteração visual sem necessidade.
- Não comentar código óbvio.
- Não alterar arquivo fora do escopo.
- Não rodar `npm run publicar:dados` por hábito.
- Não rodar `npm run init-db` em tarefa documental.
- Não fazer push se validações obrigatórias falharem.

## Critérios para atualizar este arquivo

Atualizar quando houver:

- novo script real em `package.json`;
- nova validação automatizada;
- novo teste E2E relevante;
- nova rota ou área funcional com checklist próprio;
- nova regra de publicação estática;
- nova regra de banco ou migration;
- nova prática de segurança, sigilo ou LGPD;
- novo risco recorrente registrado em `historico-erros.md`;
- mudança no fluxo de commit, hook, sync ou rollback;
- alteração relevante em modo local/API ou modo estático.

Ao atualizar:

- confirmar comando ou arquivo no repositório;
- não inventar automação futura;
- diferenciar validação obrigatória de validação recomendada;
- atualizar o diário de bordo quando a tarefa permitir.
