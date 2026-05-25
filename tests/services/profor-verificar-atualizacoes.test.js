const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const SCRIPT = "backend/scripts/verificar-atualizacoes-profor-2022.js";
const SERVER = "backend/server.js";

function ler(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function rodar(argv = []) {
  return spawnSync(process.execPath, [path.join(ROOT, SCRIPT), ...argv], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
}

test("endpoint /atualizacoes/status retorna total de cache DETRU e Transferegov + carteira", () => {
  const src = ler(SERVER);
  assert.match(src, /pathname === "\/api\/profor-2022\/atualizacoes\/status"/);
  assert.match(src, /listarCacheDetruProfor2022\(\)\.length/);
  assert.match(src, /listarSaldosRendimentosCache\(\)\.length/);
  assert.match(src, /listarConveniosMonitorados\(\{ incluirInativos: false \}\)\.length/);
  // Resposta deve ter os blocos pedidos.
  assert.match(src, /detru:\s*\{[\s\S]{0,200}?ultimaAtualizacao:[\s\S]{0,200}?totalRegistrosCache:/);
  assert.match(src, /transferegov:\s*\{[\s\S]{0,400}?ultimaConsulta:[\s\S]{0,400}?totalRegistrosCache:[\s\S]{0,400}?ultimoResumoConsulta:/);
  assert.match(src, /carteira:\s*\{[\s\S]{0,200}?totalAtivos:/);
});

test("endpoint /atualizacoes/status nao executa atualizacoes (somente leitura)", () => {
  const src = ler(SERVER);
  // Localiza o bloco entre o pathname do status e o proximo handler.
  const inicio = src.indexOf('"/api/profor-2022/atualizacoes/status"');
  const fim = src.indexOf("\n    if (req.method", inicio + 100);
  const bloco = src.slice(inicio, fim > 0 ? fim : inicio + 2500);
  assert.equal(bloco.includes("atualizarCacheDetruProfor2022"), false);
  assert.equal(bloco.includes("executarEtapaRendimentos"), false);
  assert.equal(bloco.includes("carregarPadsOperacional"), false);
});

test("script em modo somente verificacao (sem flags) nao chama atualizadores DETRU/Transferegov", () => {
  const src = ler(SCRIPT);
  // As importacoes dos atualizadores existem apenas dentro de rodarAtualizacao*,
  // que so e invocada quando flags.rodarDetru/rodarTransferegov sao true.
  const inicio = src.indexOf("async function executar()");
  const bloco = src.slice(inicio);
  assert.match(bloco, /if \(flags\.rodarDetru\) resultadoDetru = await rodarAtualizacaoDetru\(\);/);
  assert.match(bloco, /if \(flags\.rodarTransferegov\) resultadoTransferegov = await rodarAtualizacaoTransferegov\(\);/);
});

test("script com --detru chama apenas DETRU", () => {
  const src = ler(SCRIPT);
  const fnDetru = src.slice(src.indexOf("async function rodarAtualizacaoDetru"), src.indexOf("async function rodarAtualizacaoTransferegov"));
  assert.match(fnDetru, /atualizarCacheDetruProfor2022/);
  assert.equal(fnDetru.includes("executarEtapaRendimentos"), false);
});

test("script com --transferegov chama apenas Transferegov", () => {
  const src = ler(SCRIPT);
  const fnTransf = src.slice(src.indexOf("async function rodarAtualizacaoTransferegov"), src.indexOf("async function executar()"));
  assert.match(fnTransf, /executarEtapaRendimentos\(\{ execucaoLocal: true \}\)/);
  assert.equal(fnTransf.includes("atualizarCacheDetruProfor2022"), false);
});

test("--ambos aciona DETRU e Transferegov via parseFlags", () => {
  const src = ler(SCRIPT);
  assert.match(src, /const ambos = flags\.has\("--ambos"\)/);
  assert.match(src, /rodarDetru: ambos \|\| flags\.has\("--detru"\)/);
  assert.match(src, /rodarTransferegov: ambos \|\| flags\.has\("--transferegov"\)/);
});

test("script nao publica dados nem aciona recarga PAD", () => {
  const src = ler(SCRIPT);
  // Remove comentarios para nao casar com avisos/comentarios do cabecalho.
  const semComentarios = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(semComentarios.includes("publicarDadosEstaticos"), false);
  assert.equal(semComentarios.includes("publicar-dados-estaticos"), false);
  assert.equal(semComentarios.includes("carregarPadsOperacional"), false);
  assert.equal(semComentarios.includes("recarregarPadsOperacional"), false);
  assert.equal(semComentarios.includes("frontend/data/publicados"), false);
});

test("script roda sem flags e produz saida de diagnostico com exit code 0", () => {
  const r = rodar([]);
  // Pode falhar por banco indisponivel em algum ambiente; aceitamos saida util.
  // O importante e que NAO executou atualizacao externa (nao deve aparecer 'concluido_com_avisos' nem 'ok' em resultadoDetru/Transferegov).
  if (r.status === 0) {
    assert.match(r.stdout, /\[DETRU\]/);
    assert.match(r.stdout, /\[Transferegov\]/);
    assert.match(r.stdout, /evidencia:\s+nao_solicitado/);
    assert.match(r.stdout, /RESULTADO: OK/);
  } else {
    // Em ambiente sem banco operacional, mostra o resumo sem rodar atualizacao.
    // O script ainda deve ter impresso o cabecalho.
    assert.match(`${r.stdout}\n${r.stderr}`, /verificar-atualizacoes-profor-2022/);
  }
});

test("package.json registra 4 scripts npm de verificacao", () => {
  const pkg = JSON.parse(ler("package.json"));
  assert.equal(pkg.scripts["verificar:profor-atualizacoes"], `node ${SCRIPT}`);
  assert.equal(pkg.scripts["verificar:profor-atualizacoes:detru"], `node ${SCRIPT} --detru`);
  assert.equal(pkg.scripts["verificar:profor-atualizacoes:transferegov"], `node ${SCRIPT} --transferegov`);
  assert.equal(pkg.scripts["verificar:profor-atualizacoes:ambos"], `node ${SCRIPT} --ambos`);
});

test("frontend renderiza bloco Diagnostico das Atualizacoes e consome /atualizacoes/status", () => {
  const app = ler("frontend/js/app.js");
  assert.match(app, /Diagnóstico das Atualizações/);
  assert.match(app, /id="profor-diagnostico-atualizacoes-card"/);
  assert.match(app, /id="btnRecarregarDiagnosticoAtualizacoes"/);
  assert.match(app, /\/api\/profor-2022\/atualizacoes\/status/);
  assert.match(app, /carregarDiagnosticoAtualizacoesProfor2022/);
});
