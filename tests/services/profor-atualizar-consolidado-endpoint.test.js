const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverSource = fs.readFileSync(
  path.resolve(__dirname, "../../backend/server.js"),
  "utf8"
);
const appSource = fs.readFileSync(
  path.resolve(__dirname, "../../frontend/js/app.js"),
  "utf8"
);

test("POST /api/profor-2022/atualizar nao retorna 410 nem mensagem de removida", () => {
  assert.ok(
    serverSource.includes("/api/profor-2022/atualizar"),
    "endpoint /api/profor-2022/atualizar precisa existir"
  );
  const idx = serverSource.indexOf("pathname === \"/api/profor-2022/atualizar\"");
  assert.ok(idx > 0, "handler do endpoint precisa estar registrado");
  const trecho = serverSource.slice(idx, idx + 2000);
  assert.equal(
    trecho.includes("410"),
    false,
    "handler nao pode mais retornar 410"
  );
  assert.equal(
    trecho.includes("Atualizacao consolidada legada"),
    false,
    "mensagem legada nao pode mais aparecer"
  );
  assert.ok(
    trecho.includes("montarConsolidadoProfor2022PorOrigemAtiva"),
    "handler precisa consolidar via origem ativa (reconstrucao-pad)"
  );
});

test("handler retorna origemPlano reconstrucao-pad e nao chama workbook/PAD recarga", () => {
  const idx = serverSource.indexOf("pathname === \"/api/profor-2022/atualizar\"");
  const trecho = serverSource.slice(idx, idx + 2000);
  assert.ok(trecho.includes("origemPlano: \"reconstrucao-pad\""));
  assert.equal(trecho.includes("carregarPadsOperacional"), false,
    "atualizar consolidado nao pode chamar carregarPadsOperacional");
  assert.equal(trecho.includes("recarregarPadsOperacional"), false,
    "atualizar consolidado nao pode chamar recarregarPadsOperacional");
  assert.equal(trecho.includes("readWorkbook") || trecho.includes("lerWorkbook"), false,
    "atualizar consolidado nao pode ler workbook antigo");
});

test("frontend mantem botoes separados para DETRU, Transferegov, Atualizar PROFOR e Recarregar PAD", () => {
  assert.ok(appSource.includes("btnAtualizarProfor2022"));
  assert.ok(appSource.includes("btnAtualizarDetruProfor"));
  assert.ok(appSource.includes("btnAtualizarRendimentosProfor"));
  assert.ok(appSource.includes("/api/profor-2022/pad/recarregar-operacional"));
  assert.ok(appSource.includes("/api/profor-2022/atualizar"));
});

test("frontend Recarregar PAD nao chama DETRU nem Transferegov no mesmo fluxo", () => {
  const idx = appSource.indexOf("/api/profor-2022/pad/recarregar-operacional");
  assert.ok(idx > 0);
  const trecho = appSource.slice(Math.max(0, idx - 600), idx + 600);
  assert.equal(trecho.includes("/api/profor-2022/detru/atualizar"), false);
  assert.equal(trecho.includes("/api/profor-2022/rendimentos/atualizar"), false);
});

test("frontend Atualizar PROFOR nao dispara DETRU/Transferegov diretamente", () => {
  // Localiza o bloco da funcao atualizarProfor2022ConsolidadoUI, do "async function"
  // ate a proxima definicao "async function".
  const marco = "async function atualizarProfor2022ConsolidadoUI";
  const idx = appSource.indexOf(marco);
  assert.ok(idx > 0, "funcao atualizarProfor2022ConsolidadoUI deve existir");
  const proximaFuncao = appSource.indexOf("async function ", idx + marco.length);
  const trecho = appSource.slice(idx, proximaFuncao > 0 ? proximaFuncao : idx + 4000);
  // O proprio endpoint /atualizar e esperado; o que nao pode acontecer e disparar
  // o endpoint que chama DETRU/Transferegov externamente.
  assert.equal(trecho.includes("/api/profor-2022/detru/atualizar"), false,
    "Atualizar PROFOR nao deve POSTar /api/profor-2022/detru/atualizar");
  assert.equal(trecho.includes("/api/profor-2022/rendimentos/atualizar"), false,
    "Atualizar PROFOR nao deve POSTar /api/profor-2022/rendimentos/atualizar");
  assert.ok(trecho.includes("/api/profor-2022/atualizar"));
});
