const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const {
  isAmbienteProducao,
  extrairTokenAdminProfor,
  assertTokenAdminProforValido,
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

test("FOMENTO_AMBIENTE reconhece valores de producao suportados", () => {
  for (const valor of ["producao", "produção", "production", "prod"]) {
    assert.equal(isAmbienteProducao(envDev({ FOMENTO_AMBIENTE: valor })), true);
  }
});

test("endpoint administrativo em dev: permite local sem flag, bloqueia nao-local sem flag, bloqueia producao", () => {
  // Requisicao nao-local em dev sem flag continua bloqueada.
  assert.throws(
    () => assertEndpointAdminPermitido("detru_atualizar", { env: envDev() }),
    /Endpoint administrativo PROFOR 2022 bloqueado/,
  );
  // Requisicao local em dev: liberada sem flag (restauracao do comportamento anterior).
  assert.doesNotThrow(() => assertEndpointAdminPermitido("detru_atualizar", {
    env: envDev(),
    requisicaoLocal: true,
  }));
  // Execucao local de script CLI: liberada sem flag.
  assert.doesNotThrow(() => assertEndpointAdminPermitido("detru_atualizar", {
    env: envDev(),
    execucaoLocal: true,
  }));
  // Flag historica continua valida como fallback.
  assert.doesNotThrow(() => assertEndpointAdminPermitido("detru_atualizar", {
    env: envDev({ ALLOW_PROFOR_2022_ADMIN_ENDPOINTS: "1" }),
  }));
  // Producao: bloqueia mesmo com flag e mesmo se local.
  assert.throws(
    () => assertEndpointAdminPermitido("detru_atualizar", {
      env: envProd({ ALLOW_PROFOR_2022_ADMIN_ENDPOINTS: "1" }),
      requisicaoLocal: true,
    }),
    /bloqueado em produção/,
  );
});

test("token administrativo bloqueia configuracao ausente, token ausente e token incorreto", () => {
  assert.throws(
    () => assertTokenAdminProforValido("detru_atualizar", {
      env: envDev(),
      token: "token-informado-sem-configuracao",
    }),
    (erro) => erro?.statusCode === 403 && /token administrativo não configurado/.test(erro.message),
  );

  const env = envDev({ PROFOR_ADMIN_TOKEN: "token-esperado" });
  assert.throws(
    () => assertTokenAdminProforValido("detru_atualizar", { env }),
    (erro) => erro?.statusCode === 403 && /Acesso administrativo PROFOR 2022 negado/.test(erro.message),
  );
  assert.throws(
    () => assertTokenAdminProforValido("detru_atualizar", { env, token: "token-incorreto" }),
    (erro) => erro?.statusCode === 403 && !erro.message.includes("token-esperado"),
  );
});

test("token administrativo correto libera header explicito e Authorization Bearer", () => {
  const env = envDev({ PROFOR_ADMIN_TOKEN: "token-correto" });
  assert.doesNotThrow(() => assertTokenAdminProforValido("detru_atualizar", {
    env,
    headers: { "x-profor-admin-token": "token-correto" },
  }));
  assert.equal(extrairTokenAdminProfor({ authorization: "Bearer token-correto" }), "token-correto");
  assert.doesNotThrow(() => assertTokenAdminProforValido("detru_atualizar", {
    env,
    headers: { authorization: "Bearer token-correto" },
  }));
});

test("chamada externa DETRU/Transferegov: permite local sem flag, bloqueia nao-local sem flag", () => {
  assert.throws(
    () => assertChamadaExternaPermitida("detru", { env: envDev(), tipo: "DETRU" }),
    /Chamada externa DETRU bloqueada/,
  );
  assert.doesNotThrow(() => assertChamadaExternaPermitida("detru", {
    env: envDev(), tipo: "DETRU", requisicaoLocal: true,
  }));
  assert.doesNotThrow(() => assertChamadaExternaPermitida("rendimentos", {
    env: envDev(), tipo: "Transferegov", execucaoLocal: true,
  }));
});

test("chamada externa bloqueia em producao mesmo com flag", () => {
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

test("agendador PROFOR bloqueia sem flag e bloqueia producao", () => {
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

test("server aplica guards antes dos efeitos sensiveis PROFOR 2022", () => {
  const server = ler("backend/server.js");
  const casos = [
    ["api_profor_2022_detru_atualizar", "atualizarCacheDetruProfor2022"],
    ["api_profor_2022_rendimentos_atualizar", "executarEtapaRendimentos"],
    ["api_profor_2022_pad_recarregar", "recarregarPadsOperacional"],
    ["api_profor_2022_pad_recarregar_operacional", "carregarPadsOperacional"],
    ["api_profor_2022_pad_atualizar_transferegov", "gerenciadorAtualizacaoTransferegov.iniciar"],
  ];

  for (const [contexto, efeito] of casos) {
    const inicio = server.indexOf(`assertEndpointAdminPermitido("${contexto}"`);
    const token = server.indexOf(`assertTokenAdminProforValido("${contexto}"`, inicio);
    const sideEffect = server.indexOf(efeito, inicio);
    assert.ok(inicio >= 0, `${contexto} deve aplicar guard de ambiente/localidade`);
    assert.ok(token > inicio, `${contexto} deve validar token depois do guard existente`);
    assert.ok(sideEffect > token, `${contexto} deve validar token antes de ${efeito}`);
  }

  // O helper local deve existir e considerar apenas loopback (sem X-Forwarded-For).
  assert.match(server, /function ehRequisicaoLocal\(req\)/);
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /::1/);
});

test("server usa loopback como host padrao e preserva override por HOST", () => {
  const server = ler("backend/server.js");
  assert.match(server, /const host = process\.env\.HOST \|\| "127\.0\.0\.1";/);
  assert.doesNotMatch(server, /const host = process\.env\.HOST \|\| "0\.0\.0\.0";/);
});

test("/api/profor-2022/consolidado continua operacional por PAD/reconstrucao", () => {
  const server = ler("backend/server.js");
  assert.match(server, /montarConsolidadoProfor2022PorOrigemAtiva/);
  assert.match(server, /origemAtiva !== "reconstrucao-pad"/);
  assert.match(server, /montarDadosProfor2022Publicacao\(null, catalogoAplicacao/);
  assert.doesNotMatch(server, /montarConsolidadoProfor2022Local/);
  assert.doesNotMatch(server, /carregarWorkbookProfor2022/);
});

test("rota comparar-origens foi removida e nao le workbook antigo", () => {
  const server = ler("backend/server.js");
  assert.doesNotMatch(server, /\/api\/profor-2022\/comparar-origens/);
  assert.doesNotMatch(server, /montarComparacaoOrigensProfor2022Local/);
  assert.doesNotMatch(server, /gestao_financeira_ouvidoria\.xlsx/);
});

test("scripts npm ordinarios nao expoem planilha antiga nem legado dev", () => {
  const pacote = JSON.parse(ler("package.json"));
  assert.equal(
    pacote.scripts["atualizar:profor-2022"],
    "node backend/scripts/bloquear-atualizar-profor-2022-legado.js",
  );
  assert.equal(
    pacote.scripts["agendar:profor-2022"],
    "node backend/scripts/bloquear-agendar-profor-2022-legado.js",
  );
  assert.equal(pacote.scripts["import:profor-convenios"], undefined);
  assert.equal(pacote.scripts["profor:legado:atualizar-consolidado:dev"], undefined);
  assert.equal(pacote.scripts["profor:legado:agendar-atualizacao:dev"], undefined);
});

test("wrappers legados falham cedo sem banco, rede ou workbook", () => {
  for (const script of [
    "backend/scripts/bloquear-atualizar-profor-2022-legado.js",
    "backend/scripts/bloquear-agendar-profor-2022-legado.js",
  ]) {
    const resultado = spawnSync(process.execPath, [path.join(ROOT, script)], {
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.equal(resultado.status, 2);
    assert.match(resultado.stderr, /bloquead|aposentado/);
    assert.doesNotMatch(`${resultado.stdout}\n${resultado.stderr}`, /conclu[ií]d|Cache atualizado/i);
  }
});

test("flags antigas de workbook e endpoints dev foram removidas do exemplo de ambiente", () => {
  const exemplo = ler(".env.example");
  assert.doesNotMatch(exemplo, /ALLOW_PROFOR_2022_WORKBOOK_FALLBACK/);
  assert.doesNotMatch(exemplo, /ALLOW_PROFOR_2022_ENDPOINTS_DEV/);
  assert.doesNotMatch(exemplo, /ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO/);
});

test("catalogo local nao aponta mais para a planilha antiga por abas", () => {
  const catalogo = ler("backend/data/aplicacao.json");
  assert.doesNotMatch(catalogo, /arquivoPlanilhaConvenios/);
  assert.doesNotMatch(catalogo, /gestao_financeira_ouvidoria\.xlsx/);
});

test("scripts npm DETRU e Transferegov passam execucaoLocal=true (uso local sem flag)", () => {
  const det = ler("backend/scripts/atualizar-cache-detru-profor-2022.js");
  assert.match(det, /assertChamadaExternaPermitida\([\s\S]*?execucaoLocal:\s*true/);
  const rend = ler("backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js");
  assert.match(rend, /assertChamadaExternaPermitida\([\s\S]*?execucaoLocal:\s*true/);
});

test("agendador DETRU continua exigindo flag (nao foi liberado para uso local)", () => {
  const ag = ler("backend/scripts/agendar-atualizacao-detru-profor-2022.js");
  // Nao deve ter sido marcado como execucao local; agendador continua governado por flag.
  assert.doesNotMatch(ag, /execucaoLocal:\s*true/);
});

test("frontend oculta Sistema e Revisoes em modo estatico e nao reativa Atualizar PROFOR", () => {
  const app = ler("frontend/js/app.js");
  // Toggle d-none condicional ao modo estatico no menu.
  assert.match(app, /classList\.toggle\('d-none', ocultar\)/);
  // renderStatusSistemaView curto-circuita em modo estatico.
  assert.match(app, /renderStatusSistemaView[\s\S]*?estaEmModoPublicacaoEstatica\(\)[\s\S]*?renderEmptyState/);
  // Botao Atualizar PROFOR 2022 nao deve voltar.
  assert.doesNotMatch(app, /btnAtualizarProfor2022/);
  assert.doesNotMatch(app, /atualizarProfor2022ConsolidadoUI/);
});

test("server: recarga PAD nao chama DETRU/Transferegov e vice-versa", () => {
  const server = ler("backend/server.js");
  const blocoPad = server.slice(
    server.indexOf("/api/profor-2022/pad/recarregar-operacional"),
    server.indexOf("/api/profor-2022/pad/recarregar-operacional") + 1500
  );
  assert.doesNotMatch(blocoPad, /atualizarCacheDetruProfor2022/);
  assert.doesNotMatch(blocoPad, /executarEtapaRendimentos/);
  const blocoDetru = server.slice(
    server.indexOf("/api/profor-2022/detru/atualizar"),
    server.indexOf("/api/profor-2022/detru/atualizar") + 1500
  );
  assert.doesNotMatch(blocoDetru, /carregarPadsOperacional|recarregarPadsOperacional/);
});

test("scripts externos e agendador DETRU carregam guards antes das dependencias operacionais", () => {
  const arquivos = [
    "backend/scripts/atualizar-cache-detru-profor-2022.js",
    "backend/scripts/atualizar-rendimentos-transferegov-profor-2022.js",
    "backend/scripts/agendar-atualizacao-detru-profor-2022.js",
  ];

  for (const arquivo of arquivos) {
    const conteudo = ler(arquivo);
    const posGuard = conteudo.indexOf("profor-workbook-fallback-guard-service");
    const posDb = conteudo.indexOf("require(\"../db/init-db\")");
    assert.ok(posGuard >= 0, `${arquivo} deve importar guard`);
    assert.ok(posDb === -1 || posGuard < posDb, `${arquivo} deve carregar guard antes do banco`);
  }
});
