# Documentação Técnica por Funcionalidade

## 1. Finalidade desta pasta

Esta pasta contém a documentação técnica das funcionalidades criticas do FOMENTO-ONASP. O objetivo e permitir que agentes entendam rapidamente uma funcionalidade sem precisar varrer frontend, backend, rotas, banco e JSONs publicados.

## 2. Relação com a entrada rápida dos agentes

O agente deve primeiro ler `memoria/00_CONTEXTO_AGENTES/entrada-agente.md`. Se a tarefa for de tela ou funcionalidade, deve procurar o MD correspondente nesta pasta antes de abrir codigo.

## 3. Quando criar um arquivo de funcionalidade

Criar um MD de funcionalidade quando houver pelo menos um destes fatores:

- tem banco
- tem API
- tem JSON publicado
- tem regra institucional propria
- tem risco de regressao
- tem historico de bug
- tem fluxo local/API/estatico
- envolve multiplos arquivos
- exige validacoes especificas

## 4. Quando nao criar um arquivo de funcionalidade

Nao criar MD proprio para:

- pagina simples sem logica relevante
- conteudo estatistico sem regra propria
- ajuste visual isolado e trivial
- componente pequeno sem fluxo de dados proprio
- funcionalidade sem risco de regressao relevante

## 5. O que cada arquivo de funcionalidade deve resolver

Cada MD deve responder, no minimo:

- qual problema do usuario a funcionalidade resolve
- quais arquivos de frontend estao envolvidos
- quais arquivos de backend estao envolvidos
- quais rotas/API sao usadas
- quais tabelas/colunas do banco participam
- quais JSONs publicados sao afetados
- qual o fluxo de dados
- quais validacoes sao obrigatorias
- quais riscos existem
- como testar
- o que nao alterar

## 6. Relação com Spec-Driven Development adaptado

Cada documento de funcionalidade deve conter blocos equivalentes a:

- spec
- plan
- research
- tasks
- test plan
- riscos e rollback

## 7. Relação com arquitetura, rotas, banco e fluxo de dados

Os arquivos desta pasta nao devem duplicar integralmente `memoria/01_PROJETO_APLICACAO/arquitetura-atual.md`, `memoria/08_ROTAS_BANCO_API/fluxo-dados.md`, `memoria/08_ROTAS_BANCO_API/rotas.md` ou `memoria/08_ROTAS_BANCO_API/schema-banco.md`. Devem apontar para esses arquivos e resumir apenas o necessario para a funcionalidade.

## 8. Regra contra duplicação de documentação

- nao copiar trechos longos de schema, rotas ou arquitetura
- resumir o minimo necessario
- apontar o arquivo global como fonte tecnica
- atualizar a documentacao global quando a alteracao for sistemica

## 9. Regra de atualização obrigatoria

Quando uma funcionalidade documentada sofrer alteracao relevante, o MD correspondente deve ser revisado se houver mudanca em:

- tela
- componente
- rota
- servico
- controller
- schema
- tabela
- coluna
- JSON publicado
- fluxo local/API/estatico
- validacao
- tratamento de erro
- regra de negocio
- teste obrigatorio

## 10. Funcionalidades criticas previstas

Arquivos previstos, ainda nao criados:

- `parametros-minimos.md`
- `orcamento-2026.md`
- `formalizacao-profor.md`
- `publicacao-estatica.md`
- `dashboard-geral.md`

Outras funcionalidades so devem ser documentadas quando houver necessidade real de manutencao, risco ou complexidade.

## 11. Como agentes devem usar esta pasta

- nao varrer todos os MDs da pasta
- abrir apenas o MD da funcionalidade relacionada
- se o MD nao existir, usar a entrada rapida e os mapas globais
- se for criada funcionalidade nova critica, criar o MD usando o futuro `_modelo-funcionalidade.md`
- nunca inventar arquivos, rotas, tabelas ou dependencias

## 12. Limites de uso

Esta pasta nao substitui:

- o codigo
- os testes
- o schema real
- as rotas reais
- a validacao no navegador e no backend
- a conferencia da fonte real antes de alterar dados
