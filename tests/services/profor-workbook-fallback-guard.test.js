const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAmbienteProducao,
  assertWorkbookFallbackPermitido,
  assertOrquestradorLegadoPermitido,
} = require("../../backend/services/profor-2022/profor-workbook-fallback-guard-service");

// Os testes usam env-stubs locais (opcoes.env) para evitar mutação global.

function envDev(extra = {}) {
  return { NODE_ENV: "development", APP_ENV: "", AMBIENTE: "", ...extra };
}

function envProd(extra = {}) {
  return { NODE_ENV: "production", APP_ENV: "", AMBIENTE: "", ...extra };
}

test("isAmbienteProducao reconhece NODE_ENV=production", () => {
  assert.equal(isAmbienteProducao({ NODE_ENV: "production" }), true);
  assert.equal(isAmbienteProducao({ NODE_ENV: "prod" }), true);
});

test("isAmbienteProducao reconhece APP_ENV=production/producao", () => {
  assert.equal(isAmbienteProducao({ APP_ENV: "production" }), true);
  assert.equal(isAmbienteProducao({ APP_ENV: "producao" }), true);
  assert.equal(isAmbienteProducao({ APP_ENV: "prod" }), true);
});

test("isAmbienteProducao reconhece AMBIENTE=producao", () => {
  assert.equal(isAmbienteProducao({ AMBIENTE: "producao" }), true);
  assert.equal(isAmbienteProducao({ AMBIENTE: "production" }), true);
});

test("isAmbienteProducao falsifica em development/staging/teste/vazio", () => {
  assert.equal(isAmbienteProducao({ NODE_ENV: "development" }), false);
  assert.equal(isAmbienteProducao({ NODE_ENV: "test" }), false);
  assert.equal(isAmbienteProducao({ APP_ENV: "staging" }), false);
  assert.equal(isAmbienteProducao({ AMBIENTE: "homologacao" }), false);
  assert.equal(isAmbienteProducao({}), false);
});

// --- assertWorkbookFallbackPermitido ---

test("workbook gate: origem != reconstrucao-pad → não age (planilha)", () => {
  assert.doesNotThrow(() => assertWorkbookFallbackPermitido("teste", {
    env: envDev(), origemAtiva: "planilha",
  }));
});

test("workbook gate: origem != reconstrucao-pad → não age (banco-cache)", () => {
  assert.doesNotThrow(() => assertWorkbookFallbackPermitido("teste", {
    env: envDev(), origemAtiva: "banco-cache",
  }));
});

test("workbook gate: origem=reconstrucao-pad sem flag em dev → BLOQUEIA", () => {
  assert.throws(
    () => assertWorkbookFallbackPermitido("teste", {
      env: envDev(), origemAtiva: "reconstrucao-pad",
    }),
    /Leitura de workbook bloqueada/,
  );
});

test("workbook gate: origem=reconstrucao-pad com flag=1 em dev → LIBERA", () => {
  assert.doesNotThrow(() => assertWorkbookFallbackPermitido("teste", {
    env: envDev({ ALLOW_PROFOR_2022_WORKBOOK_FALLBACK: "1" }),
    origemAtiva: "reconstrucao-pad",
  }));
});

test("workbook gate: origem=reconstrucao-pad SEM flag em PRODUÇÃO → BLOQUEIA por produção", () => {
  assert.throws(
    () => assertWorkbookFallbackPermitido("teste", {
      env: envProd(), origemAtiva: "reconstrucao-pad",
    }),
    /PROIBIDA em produção/,
  );
});

test("workbook gate: origem=reconstrucao-pad COM flag=1 em PRODUÇÃO → BLOQUEIA (flag não libera)", () => {
  assert.throws(
    () => assertWorkbookFallbackPermitido("teste", {
      env: envProd({ ALLOW_PROFOR_2022_WORKBOOK_FALLBACK: "1" }),
      origemAtiva: "reconstrucao-pad",
    }),
    /PROIBIDA em produção/,
  );
});

test("workbook gate: produção via APP_ENV/AMBIENTE também bloqueia mesmo com flag", () => {
  assert.throws(
    () => assertWorkbookFallbackPermitido("teste", {
      env: { APP_ENV: "production", ALLOW_PROFOR_2022_WORKBOOK_FALLBACK: "1" },
      origemAtiva: "reconstrucao-pad",
    }),
    /PROIBIDA em produção/,
  );
  assert.throws(
    () => assertWorkbookFallbackPermitido("teste", {
      env: { AMBIENTE: "producao", ALLOW_PROFOR_2022_WORKBOOK_FALLBACK: "1" },
      origemAtiva: "reconstrucao-pad",
    }),
    /PROIBIDA em produção/,
  );
});

test("workbook gate: flag com valor != '1' não libera (ex.: 'true', '0', '')", () => {
  for (const valor of ["true", "0", "", "yes", "sim"]) {
    assert.throws(
      () => assertWorkbookFallbackPermitido("teste", {
        env: envDev({ ALLOW_PROFOR_2022_WORKBOOK_FALLBACK: valor }),
        origemAtiva: "reconstrucao-pad",
      }),
      /Leitura de workbook bloqueada/,
      `valor '${valor}' não deveria liberar`,
    );
  }
});

// --- assertOrquestradorLegadoPermitido ---

test("orquestrador gate: sem flag em dev → BLOQUEIA com mensagem de descontinuação", () => {
  assert.throws(
    () => assertOrquestradorLegadoPermitido("teste", { env: envDev() }),
    /descontinuação/,
  );
});

test("orquestrador gate: com flag=1 em dev → LIBERA", () => {
  assert.doesNotThrow(() => assertOrquestradorLegadoPermitido("teste", {
    env: envDev({ ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO: "1" }),
  }));
});

test("orquestrador gate: em produção SEMPRE bloqueia, mesmo com flag=1", () => {
  assert.throws(
    () => assertOrquestradorLegadoPermitido("teste", {
      env: envProd({ ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO: "1" }),
    }),
    /PROIBIDA em produção/,
  );
});

test("orquestrador gate: produção via APP_ENV/AMBIENTE também bloqueia com flag", () => {
  assert.throws(
    () => assertOrquestradorLegadoPermitido("teste", {
      env: { APP_ENV: "production", ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO: "1" },
    }),
    /PROIBIDA em produção/,
  );
  assert.throws(
    () => assertOrquestradorLegadoPermitido("teste", {
      env: { AMBIENTE: "producao", ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO: "1" },
    }),
    /PROIBIDA em produção/,
  );
});

test("orquestrador gate: contexto aparece na mensagem", () => {
  assert.throws(
    () => assertOrquestradorLegadoPermitido("ctx_especifico", { env: envDev() }),
    /\[ctx_especifico\]/,
  );
});

test("workbook gate: contexto aparece na mensagem", () => {
  assert.throws(
    () => assertWorkbookFallbackPermitido("ctx_workbook", {
      env: envDev(), origemAtiva: "reconstrucao-pad",
    }),
    /\[ctx_workbook\]/,
  );
});

// Garantia estrutural: o módulo não deve importar SQLite, dotenv, scripts de
// publicação ou clientes Transferegov. É um guard puro sobre process.env e
// origem ativa.
test("modulo de guard NAO importa SQLite/dotenv/publicar-*/transferegov*", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const conteudo = fs.readFileSync(
    path.resolve(__dirname, "../../backend/services/profor-2022/profor-workbook-fallback-guard-service.js"),
    "utf8",
  );
  const linhas = conteudo.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const requires = (linhas.match(/require\(\s*["'][^"']+["']\s*\)/g) || []).map((m) =>
    m.replace(/^require\(\s*["']/, "").replace(/["']\s*\)$/, ""),
  );
  for (const dep of requires) {
    assert.ok(!/dotenv/.test(dep), `proibido requerer dotenv: ${dep}`);
    assert.ok(!/sqlite|init-db|database/.test(dep), `proibido tocar SQLite: ${dep}`);
    assert.ok(!/publicar-/.test(dep), `proibido importar scripts de publicacao: ${dep}`);
    assert.ok(!/transferegov/i.test(dep), `proibido importar Transferegov: ${dep}`);
  }
  // Sem escrita em arquivos:
  assert.ok(!/fs\.writeFile|fs\.appendFile/.test(linhas), "guard deve ser puramente leitura");
});
