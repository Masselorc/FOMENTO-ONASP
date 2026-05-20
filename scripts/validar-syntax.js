const { spawnSync } = require("node:child_process");

const ARQUIVOS = [
  "backend/server.js",
  "backend/db/database.js",
  "backend/db/init-db.js",
  "backend/db/preparar-banco.js",
  "backend/services/auth-service.js",
  "backend/services/parametros-minimos-service.js",
  "backend/services/formalizacao-profor-service.js",
  "backend/services/orcamento-2026-service.js",
  "backend/services/faf-2021-service.js",
  "backend/services/historico-service.js",
  "backend/services/backup-service.js",
  "backend/services/static-publication-service.js",
  "backend/services/excel-export-service.js",
  "backend/services/dashboard-publication-service.js",
  "backend/services/profor-2022/profor-rateio-extracao-service.js",
  "backend/services/profor-2022/profor-rateio-import-service.js",
  "backend/services/profor-2022/profor-pad-normalizacao-service.js",
  "backend/services/profor-2022/profor-pad-report-reader.js",
  "backend/services/profor-2022/profor-pad-matching-service.js",
  "backend/services/profor-2022/profor-pad-saneamento-service.js",
  "backend/services/profor-2022/profor-pad-decisoes-saneamento-service.js",
  "backend/services/profor-2022/profor-pad-revisao-repository.js",
  "backend/services/profor-2022/profor-pad-revisao-service.js",
  "backend/services/profor-2022/profor-pad-revisao-decisao-service.js",
  "backend/services/profor-2022/profor-pad-plano-reconstrucao-service.js",
  "backend/services/profor-2022/profor-pad-plano-comparador-service.js",
  "backend/services/data-service.js",
  "backend/services/analytics.js",
  "backend/scripts/extrair-rateios-profor-2022.js",
  "backend/scripts/importar-rateio-inicial-profor-2022.js",
  "backend/scripts/rollback-rateio-inicial-profor-2022.js",
  "backend/scripts/ler-relatorios-pad-profor-2022.js",
  "backend/scripts/conferir-itens-pad-rateios-profor-2022.js",
  "backend/scripts/gerar-relatorio-saneamento-pad-profor-2022.js",
  "backend/scripts/gerar-relatorio-saneamento-detalhado-pad-profor-2022.js",
  "backend/scripts/gerar-template-decisoes-saneamento-pad-profor-2022.js",
  "backend/scripts/validar-decisoes-saneamento-pad-profor-2022.js",
  "backend/scripts/gerar-fila-revisao-pad-profor-2022.js",
  "backend/scripts/auditar-fila-revisao-pad-profor-2022.js",
  "backend/scripts/limpar-divergencias-teste-revisao-pad-profor-2022.js",
  "backend/scripts/sanear-status-orfaos-revisao-pad-profor-2022.js",
  "backend/scripts/testar-decisao-revisao-pad-profor-2022.js",
  "backend/scripts/reconstruir-plano-pad-profor-2022.js",
  "backend/scripts/comparar-plano-pad-profor-2022.js",
  "frontend/js/app.js",
  "frontend/js/core/static-mode.js",
  "frontend/js/core/ui-components.js",
  "frontend/js/core/view-errors.js",
  "scripts/validar-json-publicados.js",
  "scripts/configurar-git-hooks.js",
  "playwright.config.js",
  "tests/e2e/app.spec.js",
  "tests/services/validacoes-services.test.js"
];

for (const arquivo of ARQUIVOS) {
  console.log(`Validando sintaxe: ${arquivo}`);
  const resultado = spawnSync(process.execPath, ["--check", arquivo], {
    stdio: "inherit"
  });

  if (resultado.status !== 0) {
    process.exit(resultado.status || 1);
  }
}

console.log(`OK: ${ARQUIVOS.length} arquivo(s) validados.`);
