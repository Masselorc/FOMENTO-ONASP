const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const {
  isAmbienteProducao,
  assertEndpointDevPermitido,
  assertEndpointAdminPermitido,
  assertChamadaExternaPermitida,
  assertAgendadorPermitido,
} = require("../../backend/services/profor-2022/profor-workbook-fallback-guard-service");

const ROOT = path.resolve(__dirname, "../..");

function envDev(extra = {}) {
  return {
    FOMENTO_AMBIENTE: "",
    NODE_ENV: "development",
    APP_ENV: "",
    AMBIENTE: "",
    ...extra,
  };
}

function envProd(extra = {}) {
  return {
    FOMENTO_AMBIENTE: "producao",
    NODE_ENV: "development",
    APP_ENV: "",
    AMBIENTE: "",
    ...extra,
  };
}

function ler(relativo) {
  return fs.readFileSync(path.join(ROOT, relativo), "utf8");
}

test("FOMENTO_AMBIENTE=producao prevalece sobre NODE_ENV=development", () => {
  assert.equal(isAmbienteProducao(envProd()), true);
});

test("endpoint dev/auditoria bloqueia em produção mesmo com flag", () => {
  assert.throws(
    () => assertEndpointDevPermitido("comparar_origens", {
      env: envProd({ ALLOW_PROFOR_2022_ENDPOINTS_DEV: "1" }),
    }),
    /bloqueado em produção/,
  );
});

test("endpoint dev/auditoria exige flag em desenvolvimento", () => {
  assert.throws(
    () => assertEndpointDevPermitido("comparar_origens", { env: envDev() }),
    /Endpoint dev\/auditoria bloqueado/,
  );
  assert.doesNotThrow(() => assertEndpointDevPermitido("comparar_origens", {
    env: envDev({ ALLOW_PROFOR_2022_ENDPOINTS_DEV: "1" }),
  }));
});

test("endpoint administrativo exige flag em desenvolvimento e bloqueia produção", () => {
  assert.throws(
    () => assertEndpointAdminPermitido("detru_atualizar", { env: envDev() }),
    /Endpoint administrativo PROFOR 2022 bloqueado/,
  );
  assert.doesNotThrow(() => assertEndpointAdminPermitido("detru_atualizar", {
    env: envDev({ ALLOW_PROFOR_2022_ADMIN_ENDPOINTS: "1" }),
  }));
  assert.throws(
    () => assertEndpointAdminPermitido("detru_atualizar", {
      env: envProd({ ALLOW_PROFOR_2022_ADMIN_ENDPOINTS: "1" }),
    }),
    /bloqueado em produção/,
  );
});

test("chamada externa DETRU/Transferegov bloqueia sem flag", () => {
  assert.throws(
    () => assertChamadaExternaPermitida("detru", { env: envDev(), tipo: "DETRU" }),
    /Chamada externa DETRU bloqueada/,
  );
});

test("chamada externa bloqueia em produção mesmo com flag", () => {
  assert.throws(
    () => assertChamadaExternaPermitida("rendimentos", {
      env: envProd({ ALLOW_PROFOR_2022_EXTERNAL_CALLS: "1" }),
      tipo: "Transferegov",
    }),
    /bloqueada por política de governança em produção/,
  );
});

test("chamada externa bloqueia em teste mesmo com flag", () => {
  assert.throws(
    () => assertChamadaExternaPermitida("rendimentos", {
      env: envDev({
        NODE_ENV: "test",
        ALLOW_PROFOR_2022_EXTERNAL_CALLS: "1",
      }),
      tipo: "Transferegov",
    }),
    /bloqueada por política de governança em teste/,
  );
});

test("agendador PROFOR bloqueia sem flag e bloqueia produção", () => {
  assert.throws(
    () => assertAgendadorPermitido("agendar_profor", { env: envDev() }),
    /Agendador PROFOR 2022 bloqueado/,
  );
  assert.doesNotThrow(() => assertAgendadorPermitido("agendar_profor", {
    env: envDev({ ALLOW_PROFOR_2022_SCHEDULER: "1" }),
  }));
  assert.throws(
    () => assertAgendadorPermitido("agendar_profor", {
      env: envProd({ ALLOW_PROFOR_2022_SCHEDULER: "1" }),
    }),
    /bloqueado em produção/,
  );
});

test("server aplica guard admin e externo antes dos endpoints DETRU/Transferegov", () => {
  const server = ler("backend/server.js");
  assert.match(server, /assertEndpointAdminPermitido\("api_profor_2022_detru_atualizar"\)/);
  assert.match(server, /assertChamadaExternaPermitida\("api_profor_2022_detru_atualizar", \{ tipo: "DETRU" \}\)/);
  assert.match(server, /assertEndpointAdminPermitido\("api_profor_2022_rendimentos_atualizar"\)/);
  assert.match(server, /tipo: "Transferegov"/);
});

test("/api/profor-2022/consolidado continua por origem ativa", () => {
  const server = ler("backend/server.js");
  assert.match(server, /montarConsolidadoProfor2022PorOrigemAtiva/);
  assert.match(server, /origemAtiva === "reconstrucao-pad"/);
  assert.match(server, /montarDadosProfor2022Publicacao\(null, catalogoAplicacao/);
});

test("comparar-origens continua dev/auditoria, não operacional", () => {
  const server = ler("backend/server.js");
  assert.match(server, /assertEndpointDevPermitido\("api_profor_2022_comparar_origens"\)/);
  assert.doesNotMatch(server, /\/api\/profor-2022\/comparar-origens[\s\S]{0,400}assertEndpointAdminPermitido/);
});

test("scripts npm sensíveis apontam para entradas governadas", () => {
  const pacote = JSON.parse(ler("package.json"));
  assert.equal(
    pacote.scripts["atualizar:profor-2022"],
    "node backend/scripts/bloquear-atualizar-profor-2022-legado.js",
  );
  assert.equal(
    pacote.scripts["agendar:profor-2022"],
    "node backend/scripts/bloquear-agendar-profor-2022-legado.js",
  );
  assert.equal(
    pacote.scripts["agendar:detru-profor"],
    "node backend/scripts/agendar-atualizacao-detru-profor-2022.js",
  );
});

test("wrapper de agendar:profor-2022 falha cedo sem banco, rede ou Transferegov", () => {
  const resultado = spawnSync(process.execPath, [
    path.join(ROOT, "backend/scripts/bloquear-agendar-profor-2022-legado.js"),
  ], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  assert.equal(resultado.status, 2);
  assert.match(resultado.stderr, /bloqueado/);
  assert.doesNotMatch(`${resultado.stdout}\n${resultado.stderr}`, /conclu[ií]d|Cache atualizado/i);
});

test("scripts externos e agendadores carregam guards antes das dependências operacionais", () => {
  const arquivos = [
    "backend/scripts/atualizar-cache-detru-profor-2022.js",
    "backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js",
    "backend/scripts/agendar-atualizacao-detru-profor-2022.js",
    "backend/scripts/agendar-atualizacao-profor-2022.js",
  ];

  for (const arquivo of arquivos) {
    const conteudo = ler(arquivo);
    const posGuard = conteudo.indexOf("profor-workbook-fallback-guard-service");
    const posDb = conteudo.indexOf("require(\"../db/init-db\")");
    assert.ok(posGuard >= 0, `${arquivo} deve importar guard`);
    assert.ok(posDb === -1 || posGuard < posDb, `${arquivo} deve carregar guard antes do banco`);
  }
});
