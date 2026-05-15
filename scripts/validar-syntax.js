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
  "backend/services/data-service.js",
  "backend/services/analytics.js",
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
