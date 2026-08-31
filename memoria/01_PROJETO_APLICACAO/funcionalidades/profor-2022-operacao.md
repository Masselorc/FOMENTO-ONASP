# PROFOR 2022 — Guia Operacional

## 1. Estado final da arquitetura

O estado operacional final do PROFOR 2022 ficou consolidado com origem principal em `banco-cache`.

Pontos finais da arquitetura:

- a aba `Geral` não é mais fallback operacional;
- a aba `Geral` permanece fisicamente na planilha apenas como histórico e controle;
- o comparador planilha x banco-cache continua como ferramenta técnica interna;
- a home principal, a página PROFOR 2022 e a publicação estática consomem o consolidado da aplicação;
- a publicação estática depende do consolidado fechado e validado antes de gerar os JSONs públicos.

## 2. Fontes de dados

### DETRU

O DETRU é a fonte oficial para dados cadastrais e financeiros dos convênios monitorados.

Uso operacional:

- carteira de convênios monitorados;
- dados oficiais atualizáveis por rotina;
- cache local no banco SQLite;
- atualização automática ou controlada conforme o fluxo do projeto.

### Transferegov Acesso Livre

O Transferegov é a fonte usada para o saldo atual de rendimentos.

Estado operacional atual:

- a rotina depende do ambiente com Playwright/Chromium disponível;
- `playwright-publico` é o fluxo observado hoje;
- `fetch-publico` existe como caminho de coleta quando disponível;
- a diferença entre os fluxos deve ser monitorada nos logs operacionais.

Classificação do lote de rendimentos:

- `sucesso`: todos os convênios foram consultados com sucesso; o booleano `sucesso` é `true`;
- `parcial`: há sucessos e falhas no mesmo lote; o booleano `sucesso` é `false` e `statusResultado` é `parcial`;
- `falha`: nenhum convênio foi consultado com sucesso; o booleano `sucesso` é `false` e `statusResultado` é `falha`.

Somente resultados individuais com sucesso atualizam o cache. Em falha individual, o último cache válido do convênio é preservado. Os logs operacionais registram o status textual do lote sem payload de autenticação ou conteúdo sensível.

### Plano de aplicação

O plano de aplicação permanece vindo das abas estaduais da planilha.

Regra operacional:

- filtrar por UF + número + ano;
- a aba `Geral` não é fonte operacional;
- o plano estadual alimenta os cálculos de execução, saldos e previstos por área.

### Cálculos internos

A aplicação passou a assumir os cálculos que antes dependiam de fórmulas antigas da planilha.

Campos típicos calculados internamente:

- `valorExecutadoGeral`;
- `valorPrevistoGeral`;
- percentuais de execução;
- saldos residuais por natureza;
- previstos e executados por área;
- saldos por área.

## 3. Comandos operacionais

### `npm run import:profor-convenios`

Finalidade: importar ou sincronizar a carteira base de convênios monitorados.

Quando usar: quando houver entrada, atualização ou manutenção da carteira de acompanhamento.

Resultado esperado: carteira atualizada no banco local.

Risco principal: importação incorreta alterar a base monitorada.

### `npm run atualizar:detru-profor`

Finalidade: atualizar o cache DETRU dos convênios PROFOR 2022.

Quando usar: após mudanças na carteira ou em rotina de atualização oficial.

Resultado esperado: dados DETRU prontos para consumo pelo consolidado.

Risco principal: dependência de disponibilidade e aderência da fonte oficial.

### `npm run atualizar:rendimentos-profor`

Finalidade: consultar o saldo atual de rendimentos no Transferegov.

Quando usar: rotina de atualização do saldo de rendimentos.

Resultado esperado: consultas concluídas e fluxo operacional registrado.

Risco principal: falha no Playwright ou mudança na coleta pública.

### `npm run atualizar:profor-2022`

Finalidade: consolidar DETRU, rendimentos e plano em um único estado operacional.

Quando usar: atualização diária, validação manual ou preparação para publicação.

Resultado esperado: consolidado com diagnóstico `15/15/15`.

Risco principal: algum dos blocos não fechar ou gerar aviso crítico.

### `npm run agendar:profor-2022`

Finalidade: agendar a rotina diária de atualização consolidada.

Quando usar: operação recorrente em máquina/servidor local ativo.

Resultado esperado: execução automática no horário configurado.

Risco principal: ambiente desligado, sessão encerrada ou Playwright indisponível.

### `npm run publicar:profor-2022`

Finalidade: atualizar o consolidado e publicar os JSONs estáticos.

Quando usar: somente quando o consolidado estiver validado.

Resultado esperado: publicação estática concluída e auditada.

Risco principal: publicar estado incompleto ou com falha de auditoria.

### `npm run validar:json`

Finalidade: validar a estrutura dos JSONs gerados/publicados.

Quando usar: antes de publicar ou após alteração documental que toque o fluxo operacional.

Resultado esperado: JSONs válidos.

Risco principal: JSON inválido impedir consumo da interface estática.

### `npm run validar:syntax`

Finalidade: validar sintaxe dos arquivos relevantes do projeto.

Quando usar: antes de commit, especialmente após alterações em serviços e scripts.

Resultado esperado: arquivos válidos para execução.

Risco principal: sintaxe quebrada passar despercebida.

## 4. Rotina diária

Rotina recomendada:

1. manter a máquina/servidor local ligado;
2. garantir Playwright/Chromium disponível;
3. executar `npm run agendar:profor-2022` ou deixar o agendamento ativo;
4. acompanhar o resultado do consolidado;
5. conferir logs operacionais quando houver falha ou divergência.

O horário de execução é configurável por `.env`.

A rotina depende de o ambiente local permanecer ativo. Se o host desligar, a coleta e a consolidação param.

## 5. Publicação estática

A publicação estática usa `npm run publicar:profor-2022`.

Fluxo esperado:

1. atualizar o consolidado;
2. validar o estado `15/15/15`;
3. publicar os JSONs públicos;
4. executar validação de vazamento e consistência.

Regras:

- a publicação deve ser bloqueada se o consolidado não fechar `15/15/15`;
- a auditoria de vazamento deve passar;
- os JSONs publicados devem permanecer válidos;
- o script não faz commit nem push automático.

## 6. Critérios de bloqueio

A publicação deve ser bloqueada se:

- `totalComDetru !== 15`;
- `totalComPlano !== 15`;
- `totalComRendimentos !== 15`;
- `convenios.length !== 15`;
- `ultimaAtualizacaoDados.dataHora` estiver ausente;
- houver `NaN`;
- houver `Infinity`;
- houver `undefined` indevido;
- a auditoria de vazamento falhar;
- o working tree estiver sujo, salvo flag controlada.

## 7. Logs operacionais

Os logs operacionais ficam na tabela `logs_operacionais`.

Também existem:

- tela de sistema;
- exportação JSON;
- exportação CSV.

Tipos de log relevantes:

- `profor_atualizacao_consolidada`;
- `profor_publicacao_estatica`;
- `profor_detru`;
- `profor_rendimentos_transferegov`.

Diferenças práticas:

- console: útil para execução imediata e diagnóstico rápido;
- banco local: persistência operacional e histórico;
- tela de sistema: visão do operador;
- GitHub Pages: não expõe esses logs.

## 8. Validação 15/15/15

O critério mínimo operacional é:

- `totalComDetru = 15`;
- `totalComPlano = 15`;
- `totalComRendimentos = 15`.

Esse fechamento indica que a carteira está completa para a rotina corrente e pode seguir para publicação estática, quando os demais critérios também estiverem corretos.

## 9. Dependência do Playwright

O fluxo de rendimentos está funcionando hoje por `playwright-publico`.

Estado atual:

- `fetch-publico = 0`;
- `playwright-publico = 15`;
- esse comportamento deve ser monitorado nos logs.

Consequências:

- outro ambiente precisa ter Playwright/Chromium instalado;
- se o Playwright falhar, a atualização de rendimentos pode falhar;
- a falha deve ser tratada no nível operacional, não mascarada.

## 10. Pendências conhecidas

Pendências conhecidas registradas:

- `saldoDisponivelOuvidoria` continua `null`;
- o campo permanece fora da interface;
- a pendência fica registrada em `pendenciasConhecidas`;
- o campo não deve ser recriado sem fórmula segura;
- o PAD detalhado automático pode ser tratado como evolução futura, se aplicável.

## 11. Autenticação e governança das rotas administrativas

As rotas administrativas abaixo possuem controle de segurança e governança:

- `POST /api/profor-2022/detru/atualizar`;
- `POST /api/profor-2022/rendimentos/atualizar`;
- `POST /api/profor-2022/pad/atualizar-transferegov`;
- `POST /api/profor-2022/pad/recarregar-operacional`;
- `POST /api/profor-2022/pad/recarregar`.

### 11.1. Ações disparadas pela interface local (loopback)

- A interface local coleta a senha operacional `ONASP_EDIT_PASSWORD` em modal seguro (`type="password"`) e a envia no corpo JSON da requisição (`{ password: "..." }`).
- Apenas acessos originados estritamente em loopback (`127.0.0.1`, `::1`) são aceitos com senha.
- Se uma senha for fornecida em loopback e for inválida, a resposta retorna `403` com indicação explícita de senha local inválida.
- O frontend público e a aplicação nunca armazenam nem utilizam `PROFOR_ADMIN_TOKEN`.

### 11.2. Chamadas administrativas externas e automatizadas

- Chamadas externas ou automatizadas via script/API exigem a configuração da variável `PROFOR_ADMIN_TOKEN` no `.env` do backend:

```bash
PROFOR_ADMIN_TOKEN=<token-forte>
```

Não inserir valor real na documentação, não versionar `.env`, não registrar o token em logs e não armazená-lo em arquivo público, no frontend ou em `frontend/data/publicados/`.

Cada chamada externa/controlada por token deve enviar uma destas formas de cabeçalho:

```http
X-Profor-Admin-Token: <token>
```

ou:

```http
Authorization: Bearer <token>
```

Exemplo seguro de chamada via script/PowerShell com placeholder:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8790/api/profor-2022/detru/atualizar" `
  -Headers @{ "X-Profor-Admin-Token" = "<PROFOR_ADMIN_TOKEN>" } `
  -ContentType "application/json" `
  -Body "{}"
```

Se `PROFOR_ADMIN_TOKEN` não estiver configurado ou o header estiver ausente/incorreto em chamadas sem a senha local válida, a resposta esperada é `403`.

## 12. Rollback

Rollback recomendado em caso de regressão:

- usar temporariamente `PROFOR_2022_ORIGEM_DADOS=planilha`, se ainda suportado;
- reverter os commits recentes que introduziram a regressão;
- não apagar caches sem backup;
- não alterar a planilha para compensar erro de código;
- validar home, PROFOR 2022, logs e publicação depois do retorno.

## 13. Checklist antes de publicar

- git limpo;
- `git pull`;
- `npm run atualizar:profor-2022`;
- diagnóstico `15/15/15`;
- logs sem falha;
- `npm run publicar:profor-2022`;
- auditoria OK;
- `npm run validar:json`;
- `npm run validar:syntax`;
- conferir JSONs publicados;
- conferir tela online;
- registrar diário.
