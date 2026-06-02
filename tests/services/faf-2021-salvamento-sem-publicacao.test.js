const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Garante que o salvamento operacional do FAF 2021 (POST /api/faf2021/salvar)
// persiste no Postgres SEM acionar a publicacao estatica automaticamente.
// A publicacao de frontend/data/publicados deve permanecer como etapa propria.

const repoRoot = path.resolve(__dirname, "../..");
const serverCode = fs.readFileSync(path.join(repoRoot, "backend/server.js"), "utf8");

function extrairHandlerFaf2021Salvar(codigo) {
  const inicio = codigo.indexOf('pathname === "/api/faf2021/salvar"');
  assert.notEqual(inicio, -1, "A rota POST /api/faf2021/salvar deve existir no server.js");
  // Limita o trecho ao bloco do handler (ate a proxima rota /api/).
  const restante = codigo.slice(inicio);
  const proximaRota = restante.indexOf('pathname === "/api/', 1);
  return proximaRota === -1 ? restante : restante.slice(0, proximaRota);
}

test("POST /api/faf2021/salvar chama salvarExecucaoFaf2021", () => {
  const handler = extrairHandlerFaf2021Salvar(serverCode);
  assert.match(
    handler,
    /salvarExecucaoFaf2021\s*\(/,
    "O handler deve persistir via salvarExecucaoFaf2021"
  );
});

test("POST /api/faf2021/salvar NAO aciona publicarAposSalvamento/publicarDadosEstaticos", () => {
  const handler = extrairHandlerFaf2021Salvar(serverCode);
  assert.doesNotMatch(
    handler,
    /publicarAposSalvamento|publicarDadosEstaticos/,
    "Salvar FAF 2021 nao deve disparar publicacao estatica automaticamente"
  );
});

test("publicarDadosEstaticos continua disponivel no projeto (nao foi removida)", () => {
  const servicePath = path.join(repoRoot, "backend/services/static-publication-service.js");
  assert.ok(fs.existsSync(servicePath), "static-publication-service.js deve continuar existindo");
  const code = fs.readFileSync(servicePath, "utf8");
  assert.match(
    code,
    /publicarDadosEstaticos/,
    "A funcao publicarDadosEstaticos deve permanecer no projeto"
  );
});
