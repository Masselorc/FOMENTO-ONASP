# 14/08/2026 — Contatos no GitHub Pages

- **Tarefa:** disponibilizar a página Contatos UFs na publicação online.
- **Problema:** a tela dependia diretamente de `Planilhas/Contatos.xlsx`, arquivo deliberadamente ausente do artefato público.
- **Decisão:** gerar `frontend/data/publicados/contatos.json` por lista positiva de campos e carregar esse arquivo no GitHub Pages em modo somente leitura.
- **Segurança:** CPF, celular do titular e metadados internos usados para expedição de ofícios não são publicados. A planilha original continua fora do site.
- **Arquivos afetados:** serviço de publicação de contatos, publicação estática, carregamento de dados, validação dos JSONs, cache-busters do frontend e o JSON público gerado.
- **Validações realizadas:** JSON gerado com 27 UFs e 150 contatos nominais; teste focal e auditoria de publicação com 12/12 aprovações; `npm run validar:json`; `npm run validar:syntax` com 110 arquivos; `git diff --check`; conferência do artefato com todos os arquivos obrigatórios e nenhum SQLite no frontend.
- **Limitação de ambiente:** a suíte completa avançou por 531 testes, mas três arquivos de teste legados não puderam carregar `better-sqlite3` porque o binário local foi compilado para outra versão do Node. O teste de publicação afetado por este lote foi corrigido e reexecutado com sucesso.
- **Risco de regressão:** baixo a moderado, limitado ao carregamento da tela de contatos e ao pipeline de publicação.
- **Rollback:** reverter o commit desta tarefa; nenhum banco ou planilha original é alterado.
