# Arquitetura de deploy remoto — Backend Node + Supabase Postgres

## 1. Resumo executivo

O banco de dados operacional do FOMENTO-ONASP já foi migrado para Supabase/Postgres, mas o servidor da aplicação ainda é o backend Node definido em `backend/server.js` e iniciado por `node backend/server.js`.

O Supabase não hospeda diretamente esse servidor Node monolítico. O caminho recomendado para retirar a dependência do servidor local, sem reescrever a aplicação agora, é hospedar o backend Node em um provedor externo e manter o Supabase como banco Postgres.

## 2. Situação atual

A aplicação ainda depende de um servidor Node que concentra mais responsabilidades do que uma API SQL simples:

- serve o frontend localmente;
- expõe APIs em `backend/server.js`;
- lê e escreve arquivos no filesystem local;
- depende de relatórios, caches e planilhas;
- mantém rotas administrativas e sensíveis;
- não possui sistema de login/autenticação de usuário final.

Também existem fluxos que dependem de diretórios e arquivos versionados ou locais, como relatórios, caches, planilhas de instrumentos e dados publicados.

## 3. Por que não migrar tudo para Supabase Edge Functions agora

Supabase Edge Functions não executam `backend/server.js` como um servidor Node completo. Converter todo o backend exigiria redesenhar partes relevantes da aplicação antes do deploy remoto.

Os principais bloqueios são:

- o filesystem local precisaria ser substituído por Supabase Storage, Postgres ou outro armazenamento remoto;
- scripts `npm run profor:*` precisariam virar jobs, funções ou rotinas operacionais controladas;
- exportações Excel podem ser pesadas para execução serverless;
- rotas sensíveis exigiriam autenticação, autorização e guarda operacional mais robustas;
- misturar Edge Functions cedo aumentaria complexidade sem resolver os fluxos que dependem de arquivos.

Edge Functions são viáveis em fase posterior para endpoints pequenos, SQL puros e transacionais, desde que não dependam de filesystem local.

## 4. Arquitetura recomendada — fase 1

A fase 1 recomendada é manter a aplicação como backend Node, mas executar esse backend em ambiente remoto:

- frontend estático ou servido pelo próprio backend remoto;
- backend Node hospedado em provedor externo;
- Supabase mantido como Postgres operacional;
- variáveis de ambiente configuradas no provedor;
- CORS restrito às origens autorizadas;
- rotas administrativas protegidas por flags, guards e camada de acesso;
- publicação automática desabilitada por padrão.

Destinos possíveis incluem Render, Railway, Fly.io, Azure App Service, Google Cloud Run ou VPS institucional.

## 5. Variáveis de ambiente necessárias

As variáveis devem ser configuradas como secrets do provedor, sem valores sensíveis em arquivos versionados:

- `DATABASE_URL`;
- `NODE_EXTRA_CA_CERTS`, se aplicável ao certificado TLS usado pelo ambiente;
- `PORT`;
- `CORS_ORIGIN` ou variável equivalente;
- flags de bloqueio ou liberação de publicação, quando existirem no projeto;
- variáveis de DETRU e Transferegov apenas quando esses fluxos forem efetivamente usados.

Não inserir senha, token, certificado privado ou URL real completa em código, frontend, Markdown versionado ou arquivos `.env` commitados.

## 6. Rotas que podem permanecer no backend Node

Devem permanecer inicialmente no backend Node remoto os fluxos que dependem de filesystem, scripts, geração de artefatos ou operação administrativa:

- recarga PAD;
- reconstrução;
- exportações;
- relatórios;
- publicação estática, se mantida;
- rotas administrativas;
- endpoints que dependem de filesystem;
- scripts e fluxos que dependem de arquivos locais.

Essa abordagem reduz risco porque preserva o desenho atual enquanto remove a necessidade de executar o servidor na máquina do usuário.

## 7. Rotas candidatas futuras a Edge Functions

Podem ser avaliadas em fase posterior, de forma incremental:

- listagens SQL puras;
- leitura de revisão PAD;
- decisões e logs simples;
- endpoints de status;
- endpoints pequenos e transacionais sem filesystem.

A migração para Edge Functions deve ocorrer por rota, com testes específicos e sem misturar com fluxos de publicação, recarga ou saneamento.

## 8. Pontos críticos de segurança

A aplicação não possui login, portanto a exposição remota do backend muda o perfil de risco.

Pontos obrigatórios antes de tornar o backend público:

- não expor rotas administrativas publicamente sem camada de proteção;
- restringir CORS às origens esperadas;
- proteger endpoints de publicação, atualização, saneamento e manutenção;
- não colocar secrets no frontend;
- não usar `sslmode=no-verify` como configuração permanente;
- usar secrets do provedor para `DATABASE_URL`;
- manter publicação e scripts sensíveis bloqueados por padrão.

## 9. Plano faseado sugerido

Fase 1 — documentação e decisão do provedor.

Fase 2 — parametrizar `API_BASE_URL` no frontend.

Fase 3 — preparar backend para deploy remoto.

Fase 4 — configurar secrets e CORS.

Fase 5 — homologar recarga PAD em ambiente remoto.

Fase 6 — avaliar Edge Functions para rotas SQL puras.

## 10. Fora do escopo

Esta etapa não cobre:

- reescrever backend;
- migrar tudo para Edge Functions;
- criar autenticação;
- publicar dados;
- alterar planoAplicacao oficial;
- alterar `frontend/data/publicados`;
- executar DETRU ou Transferegov;
- executar scripts com `--aplicar`.

## 11. Próximo PR técnico recomendado

O próximo PR técnico recomendado é parametrizar `API_BASE_URL` no frontend, mantendo fallback local e sem mudar o comportamento funcional das rotas.

Esse PR deve:

- permitir que o frontend aponte para uma API remota;
- preservar o modo local atual;
- não alterar contratos de API;
- não alterar regras de negócio;
- preparar CORS no backend para origens autorizadas;
- manter rotas administrativas bloqueadas ou protegidas.

## 12. Rollback

Como esta etapa é apenas documental, o rollback é feito com:

```bash
git revert <commit>
```
