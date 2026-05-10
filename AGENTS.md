# AGENTS.md

## Contexto obrigatório

Antes de qualquer alteração no projeto, leia:

- `memoria/INDEX.md`

A pasta `memoria/` contém a memória local do projeto, mantida em Markdown e usada também como vault do Obsidian.

## Ausência da memória local

Se a pasta `memoria/` ou o arquivo `memoria/INDEX.md` não existir no ambiente atual, não inventar seu conteúdo.

Nesse caso:

- informar que a memória local não está disponível;
- prosseguir apenas com a análise dos arquivos reais do repositório;
- não criar a pasta `memoria/` automaticamente sem solicitação expressa;
- não tentar versionar arquivos da memória local.

## Regras de trabalho

- Analisar a estrutura existente antes de propor ou aplicar código.
- Não inventar arquivos, rotas, endpoints, tabelas, colunas, funções, variáveis ou dependências.
- Não alterar arquitetura sem justificar tecnicamente.
- Não criar dependências novas sem demonstrar necessidade, alternativa nativa e risco de manutenção.
- Priorizar alterações pequenas, testáveis e reversíveis.
- Não expor credenciais, tokens, senhas, dados pessoais ou informações sensíveis.
- Ao final de cada tarefa relevante, atualizar `memoria/00_DIARIO_DE_BORDO/diario-atual.md`.

## Entrega esperada

Sempre que revisar, corrigir ou implementar algo, registrar:

1. Problema encontrado.
2. Evidência no código ou comportamento observado.
3. Impacto prático.
4. Correção aplicada ou recomendada.
5. Testes executados ou recomendados.
6. Risco de regressão.
7. Rollback, quando aplicável.

## Antes de finalizar

Verificar, quando fizer sentido:

- build do projeto;
- console do navegador;
- logs do backend;
- fluxo manual afetado;
- responsividade;
- acessibilidade básica;
- impacto no banco de dados;
- necessidade de atualização do diário de bordo.
