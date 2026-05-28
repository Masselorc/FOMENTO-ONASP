// Verificação objetiva das atualizações PROFOR 2022 (DETRU e Transferegov).
//
// Uso:
//   node backend/scripts/verificar-atualizacoes-profor-2022.js
//   node backend/scripts/verificar-atualizacoes-profor-2022.js --detru
//   node backend/scripts/verificar-atualizacoes-profor-2022.js --transferegov
//   node backend/scripts/verificar-atualizacoes-profor-2022.js --ambos
//
// Sem flags: apenas le o estado atual (antes == depois) e relata.
// Com --detru / --transferegov / --ambos: executa a(s) atualizacao(oes) entre
// a leitura ANTES e a leitura DEPOIS, e compara.
//
// Exit codes:
//   0 - verificacao passou (sem flag, ou com flag e atualizacao bem-sucedida)
//   1 - alguma atualizacao falhou
//   2 - foi solicitada atualizacao mas nao ha evidencia clara de mudanca
//
// NAO publica dados. NAO aciona PAD. NAO altera frontend/data/publicados.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const {
  obterUltimaAtualizacaoDetru,
  listarCacheDetruProfor2022,
} = require("../services/profor-2022/profor-detru-cache-service");
const {
  obterUltimaConsultaRendimentos,
  listarSaldosRendimentosCache,
} = require("../services/profor-2022/transferegov-rendimentos-cache-service");
const {
  listarConveniosMonitorados,
} = require("../services/profor-2022/convenios-monitorados-service");
const {
  assertEndpointAdminPermitido,
  assertChamadaExternaPermitida,
} = require("../services/profor-2022/profor-workbook-fallback-guard-service");

function assertExecucaoLocalPermitida(contexto, opcoes = {}) {
  // Bloqueia producao/teste; em ambiente local libera sem flag.
  assertEndpointAdminPermitido(contexto, { execucaoLocal: true, ...opcoes });
  assertChamadaExternaPermitida(contexto, { execucaoLocal: true, tipo: opcoes.tipo, ...opcoes });
}

function parseFlags(argv) {
  const flags = new Set(argv.slice(2).map((a) => String(a).toLowerCase()));
  const ambos = flags.has("--ambos");
  return {
    rodarDetru: ambos || flags.has("--detru"),
    rodarTransferegov: ambos || flags.has("--transferegov"),
  };
}

async function lerEstado() {
  const safe = async (fn, fallback) => {
    try { return await fn(); } catch (e) { return fallback; }
  };
  const [
    detruUltima,
    detruCache,
    transferegovUltima,
    transferegovCache,
    carteiraAtivos,
  ] = await Promise.all([
    safe(() => obterUltimaAtualizacaoDetru(), null),
    safe(async () => (await listarCacheDetruProfor2022()).length, 0),
    safe(() => obterUltimaConsultaRendimentos(), null),
    safe(async () => (await listarSaldosRendimentosCache()).length, 0),
    safe(async () => (await listarConveniosMonitorados({ incluirInativos: false })).length, 0),
  ]);
  return {
    detru: { ultima: detruUltima, totalCache: detruCache },
    transferegov: { ultima: transferegovUltima, totalCache: transferegovCache },
    carteira: { totalAtivos: carteiraAtivos },
  };
}

function diff(antes, depois) {
  return {
    detru: {
      mudouTimestamp: (antes.detru.ultima?.iniciadoEm || null) !== (depois.detru.ultima?.iniciadoEm || null)
        || (antes.detru.ultima?.id || null) !== (depois.detru.ultima?.id || null),
      cacheAntes: antes.detru.totalCache,
      cacheDepois: depois.detru.totalCache,
    },
    transferegov: {
      mudouTimestamp: (antes.transferegov.ultima?.iniciadoEm || null) !== (depois.transferegov.ultima?.iniciadoEm || null)
        || (antes.transferegov.ultima?.id || null) !== (depois.transferegov.ultima?.id || null),
      cacheAntes: antes.transferegov.totalCache,
      cacheDepois: depois.transferegov.totalCache,
    },
  };
}

function classificarEvidencia({ rodou, sucessoExterno, mudouTimestamp, cacheAntes, cacheDepois }) {
  if (!rodou) return "nao_solicitado";
  if (sucessoExterno === false) return "falhou";
  if (mudouTimestamp || cacheDepois !== cacheAntes) return "atualizado";
  // Rodou mas nada mudou e nao houve falha clara -> evidencia insuficiente.
  return "sem_evidencia";
}

function formatarTimestamp(linha) {
  if (!linha) return "(nunca executado)";
  const ini = linha.iniciadoEm || linha.iniciado_em || null;
  const fim = linha.concluidoEm || linha.concluido_em || null;
  return `id=${linha.id ?? "?"} iniciadoEm=${ini || "?"} concluidoEm=${fim || "?"} sucesso=${linha.sucesso}`;
}

function imprimirResumo({ antes, depois, delta, resultadoDetru, resultadoTransferegov, flags }) {
  console.log("=== verificar-atualizacoes-profor-2022 ===");
  console.log(`Flags: detru=${flags.rodarDetru} transferegov=${flags.rodarTransferegov}`);
  console.log("");
  console.log("[Carteira ativa]");
  console.log(`  total convenios ativos: ${antes.carteira.totalAtivos} (depois: ${depois.carteira.totalAtivos})`);
  console.log("");
  console.log("[DETRU]");
  console.log(`  cache antes:    ${antes.detru.totalCache}`);
  console.log(`  cache depois:   ${depois.detru.totalCache}`);
  console.log(`  ultima antes:   ${formatarTimestamp(antes.detru.ultima)}`);
  console.log(`  ultima depois:  ${formatarTimestamp(depois.detru.ultima)}`);
  if (flags.rodarDetru) {
    console.log(`  resultado run:  ${resultadoDetru.status}${resultadoDetru.erro ? ` (erro: ${resultadoDetru.erro})` : ""}`);
  }
  const detruEvid = classificarEvidencia({
    rodou: flags.rodarDetru,
    sucessoExterno: resultadoDetru?.sucesso,
    mudouTimestamp: delta.detru.mudouTimestamp,
    cacheAntes: delta.detru.cacheAntes,
    cacheDepois: delta.detru.cacheDepois,
  });
  console.log(`  evidencia:      ${detruEvid}`);
  console.log("");
  console.log("[Transferegov]");
  console.log(`  cache antes:    ${antes.transferegov.totalCache}`);
  console.log(`  cache depois:   ${depois.transferegov.totalCache}`);
  console.log(`  ultima antes:   ${formatarTimestamp(antes.transferegov.ultima)}`);
  console.log(`  ultima depois:  ${formatarTimestamp(depois.transferegov.ultima)}`);
  if (flags.rodarTransferegov) {
    console.log(`  resultado run:  ${resultadoTransferegov.status}${resultadoTransferegov.erro ? ` (erro: ${resultadoTransferegov.erro})` : ""}`);
  }
  const transfEvid = classificarEvidencia({
    rodou: flags.rodarTransferegov,
    sucessoExterno: resultadoTransferegov?.sucesso,
    mudouTimestamp: delta.transferegov.mudouTimestamp,
    cacheAntes: delta.transferegov.cacheAntes,
    cacheDepois: delta.transferegov.cacheDepois,
  });
  console.log(`  evidencia:      ${transfEvid}`);
  console.log("");
  return { detruEvid, transfEvid };
}

async function rodarAtualizacaoDetru() {
  try {
    // Guard antes de qualquer side-effect: bloqueia producao/teste; local libera sem flag.
    assertExecucaoLocalPermitida("script_verificar_atualizacoes_detru", { tipo: "DETRU" });
    // Imports tardios para evitar inicializar banco em modo somente leitura.
    const {
      atualizarCacheDetruProfor2022,
    } = require("../services/profor-2022/profor-detru-update-service");
    const resultado = await atualizarCacheDetruProfor2022({});
    return { sucesso: true, status: "ok", totalSalvos: resultado?.totalSalvos };
  } catch (erro) {
    return { sucesso: false, status: "falhou", erro: erro?.message || String(erro) };
  }
}

async function rodarAtualizacaoTransferegov() {
  try {
    assertExecucaoLocalPermitida("script_verificar_atualizacoes_transferegov", { tipo: "Transferegov" });
    const {
      executarEtapaRendimentos,
    } = require("../services/profor-2022/profor-atualizacao-consolidada-service");
    const resultado = await executarEtapaRendimentos({ execucaoLocal: true });
    return {
      sucesso: Boolean(resultado?.sucesso),
      status: resultado?.sucesso ? "ok" : "concluido_com_avisos",
      erro: resultado?.erro || null,
    };
  } catch (erro) {
    return { sucesso: false, status: "falhou", erro: erro?.message || String(erro) };
  }
}

async function executar() {
  const flags = parseFlags(process.argv);

  const antes = await lerEstado();

  let resultadoDetru = { sucesso: null, status: "nao_executado" };
  let resultadoTransferegov = { sucesso: null, status: "nao_executado" };

  if (flags.rodarDetru) resultadoDetru = await rodarAtualizacaoDetru();
  if (flags.rodarTransferegov) resultadoTransferegov = await rodarAtualizacaoTransferegov();

  const depois = await lerEstado();
  const delta = diff(antes, depois);

  const { detruEvid, transfEvid } = imprimirResumo({
    antes, depois, delta, resultadoDetru, resultadoTransferegov, flags,
  });

  // Exit code
  if (detruEvid === "falhou" || transfEvid === "falhou") {
    console.log("RESULTADO: FALHA em atualizacao(oes).");
    process.exit(1);
  }
  if (detruEvid === "sem_evidencia" || transfEvid === "sem_evidencia") {
    console.log("RESULTADO: SEM EVIDENCIA suficiente de mudanca apos a atualizacao solicitada.");
    process.exit(2);
  }
  console.log("RESULTADO: OK.");
  process.exit(0);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("=== verificar-atualizacoes-profor-2022 ===");
    console.error("DATABASE_URL não definida. Este script agora depende do Postgres/Supabase.");
    process.exit(1);
  }
  await executar();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
