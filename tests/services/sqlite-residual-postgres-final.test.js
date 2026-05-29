const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Cobertura unitaria (sem DATABASE_URL) das mudancas do sublote
// "eliminar residuos sqlite operacionais": guard de scripts legados, boot
// Postgres-only e ausencia de imports SQLite em fluxos ativos.

const {
  exigirConfirmacaoAuditoriaSqliteLegado,
  VARIAVEL_CONFIRMACAO,
} = require("../../backend/scripts/_guard-sqlite-legado");

function lerFonte(relativo) {
  return fs.readFileSync(path.resolve(__dirname, "../..", relativo), "utf8");
}

test("guard de auditoria SQLite legado bloqueia sem confirmacao", () => {
  const original = process.env[VARIAVEL_CONFIRMACAO];
  try {
    delete process.env[VARIAVEL_CONFIRMACAO];
    assert.throws(
      () => exigirConfirmacaoAuditoriaSqliteLegado("script-x"),
      /bloqueada|bloqueado|CONFIRMAR_AUDITORIA_SQLITE_LEGADO/i
    );
  } finally {
    if (original === undefined) delete process.env[VARIAVEL_CONFIRMACAO];
    else process.env[VARIAVEL_CONFIRMACAO] = original;
  }
});

test("guard de auditoria SQLite legado libera com CONFIRMAR_AUDITORIA_SQLITE_LEGADO=SIM", () => {
  const original = process.env[VARIAVEL_CONFIRMACAO];
  try {
    process.env[VARIAVEL_CONFIRMACAO] = "SIM";
    assert.doesNotThrow(() => exigirConfirmacaoAuditoriaSqliteLegado("script-x"));
  } finally {
    if (original === undefined) delete process.env[VARIAVEL_CONFIRMACAO];
    else process.env[VARIAVEL_CONFIRMACAO] = original;
  }
});

test("preparar-banco nao importa SQLite (database/init-db/better-sqlite3)", () => {
  const fonte = lerFonte("backend/db/preparar-banco.js");
  assert.equal(fonte.includes("better-sqlite3"), false);
  assert.equal(/require\(["'][^"']*db\/database["']\)/.test(fonte), false);
  assert.equal(fonte.includes("init-db"), false);
  // Deve usar o cliente Postgres.
  assert.equal(fonte.includes("postgres-client"), true);
});

test("server.js trata prepararBanco como async com .catch", () => {
  const fonte = lerFonte("backend/server.js");
  assert.match(fonte, /prepararBanco\(\)\s*\.catch\(/);
});

test("seguranca pre-ativacao usa Postgres (query) e nao SQLite", () => {
  const fonte = lerFonte("backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service.js");
  assert.equal(/require\(["'][^"']*db\/database["']\)/.test(fonte), false);
  assert.equal(fonte.includes("db.prepare"), false);
  assert.equal(fonte.includes("postgres-client"), true);
});

test("services de saneamento residuais usam Postgres (query) e nao SQLite", () => {
  for (const arquivo of [
    "backend/services/profor-2022/profor-pad-saneamento-service.js",
    "backend/services/profor-2022/profor-pad-decisoes-saneamento-service.js",
  ]) {
    const fonte = lerFonte(arquivo);
    assert.equal(/require\(["'][^"']*db\/database["']\)/.test(fonte), false, `${arquivo} nao deve importar db/database`);
    assert.equal(fonte.includes("db.prepare"), false, `${arquivo} nao deve usar db.prepare`);
    assert.equal(fonte.includes("postgres-client"), true, `${arquivo} deve usar postgres-client`);
  }
});

test("script com --aplicar exige CONFIRMAR_SANEAMENTO_PROFOR_2022", () => {
  const fonte = lerFonte("backend/scripts/auditar-itens-sem-rateio-com-rateio-antigo-pad-profor-2022.js");
  assert.equal(fonte.includes("CONFIRMAR_SANEAMENTO_PROFOR_2022"), true);
  // Nao deve mais inicializar o SQLite legado.
  assert.equal(fonte.includes("init-db"), false);
});

test("importar-parametros-minimos exige CONFIRMAR_IMPORTACAO_PARAMETROS_MINIMOS na execucao direta", () => {
  const fonte = lerFonte("backend/scripts/importar-parametros-minimos.js");
  assert.equal(fonte.includes("CONFIRMAR_IMPORTACAO_PARAMETROS_MINIMOS"), true);
});
