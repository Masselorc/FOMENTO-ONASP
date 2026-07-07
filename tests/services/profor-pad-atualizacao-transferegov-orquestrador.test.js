const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  FASES,
  atualizarPadsTransferegovEOperacional,
} = require("../../backend/services/profor-2022/profor-pad-atualizacao-transferegov-orquestrador-service");
const {
  GerenciadorAtualizacaoTransferegov,
} = require("../../backend/services/profor-2022/profor-pad-atualizacao-transferegov-job-service");

function criarRepoRootTemporario() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fomento-orq-"));
  fs.mkdirSync(path.join(dir, "backend", "data", "cache"), { recursive: true });
  return dir;
}

function colaboradoresFake({
  convenios = ["900001", "900002"],
  extrairFn,
  recargaResultado,
  capturarSalvar,
} = {}) {
  const chamadas = {
    extrair: [],
    salvar: [],
    recarga: [],
  };
  const carregarReferenciaPadExcel = () => ({ relatorios: convenios.map((c) => ({ codigoInstrumento: c })) });
  const selecionarConvenios = (ref) => (ref.relatorios || []).map((r) => r.codigoInstrumento);
  const extrair = async (numero, opcoes) => {
    chamadas.extrair.push({ numero, opcoes });
    if (typeof extrairFn === "function") return extrairFn(numero, opcoes);
    return {
      sucesso: true,
      origem: "http",
      dados: {
        itens: [{
          instrumento: numero,
          descricao: `Item teste ${numero}`,
          codigoNaturezaDespesa: "33903799",
          natureza: "CUSTEIO",
          quantidade: 1,
          valorUnitario: 100,
          valorTotalPrevisto: 100,
          valorTotalExecutado: 0,
          saldo: 100,
        }],
        totais: { valorTotalPrevisto: 100, valorTotalExecutado: 0, saldo: 100 },
        hashConteudo: `hash-${numero}`,
      },
    };
  };
  const salvarCache = (cache, opcoes) => {
    chamadas.salvar.push({ cache, opcoes });
    if (capturarSalvar) capturarSalvar(cache, opcoes);
  };
  const carregarPadsOperacional = (opcoes) => {
    chamadas.recarga.push({ opcoes });
    return recargaResultado || {
      sucesso: true, origem: "cache_transferegov",
      arquivosLidos: convenios.length, totalConvenios: convenios.length,
      itensProcessados: convenios.length,
      totalAlertas: 0, totalImpedimentos: 0, totalPendenciasRevisao: 0,
      aptoParaPublicacao: false,
      pendenciasRevisaoResumo: [],
    };
  };
  const db = { prepare: () => ({ all: () => [] }) };
  const obterMapaUfs = async () => new Map();
  return { chamadas, colaboradores: {
    carregarReferenciaPadExcel, selecionarConvenios,
    extrairPadTransferegov: extrair,
    salvarCache,
    carregarPadsOperacional,
    obterMapaUfs,
    db,
  } };
}

function criarGerenciadorTeste(dependencias = {}) {
  return new GerenciadorAtualizacaoTransferegov({
    publicarDadosEstaticos: async () => ({ success: true, publicadoEm: "2026-07-07T00:00:00.000Z" }),
    ...dependencias,
  });
}

test("orquestrador chama extracao para cada convenio e salva cache validado antes da recarga", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { chamadas, colaboradores } = colaboradoresFake({ convenios: ["900001", "900002", "900003"] });
  const eventos = [];
  const resumo = await atualizarPadsTransferegovEOperacional({
    repoRoot,
    onProgress: (e) => eventos.push(e),
    ...colaboradores,
  });
  assert.equal(chamadas.extrair.length, 3, "esperava 3 extracoes (uma por convenio)");
  assert.equal(chamadas.salvar.length, 1, "esperava 1 gravacao de cache");
  assert.equal(chamadas.recarga.length, 1, "esperava 1 recarga operacional");
  assert.equal(resumo.totalConveniosAtualizados, 3);
  assert.equal(resumo.totalItensExtraidos, 3);
  assert.equal(resumo.cacheSalvo, true);
  assert.ok(resumo.caminhoCache);

  // ordem: salvar_cache vem antes de recarga_inicio
  const idxSalvar = eventos.findIndex((e) => e.etapa === "salvar_cache");
  const idxRecargaInicio = eventos.findIndex((e) => e.etapa === "recarga_inicio");
  assert.ok(idxSalvar >= 0 && idxRecargaInicio > idxSalvar, "salvar_cache deve preceder recarga_inicio");
});

test("orquestrador emite progresso por convenio com indice/total/numeroConvenio", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { colaboradores } = colaboradoresFake({ convenios: ["900001", "900002"] });
  const eventos = [];
  await atualizarPadsTransferegovEOperacional({
    repoRoot,
    onProgress: (e) => eventos.push(e),
    ...colaboradores,
  });
  const concluidos = eventos.filter((e) => e.etapa === "convenio_concluido");
  assert.equal(concluidos.length, 2);
  assert.equal(concluidos[0].indice, 1);
  assert.equal(concluidos[0].total, 2);
  assert.equal(concluidos[0].numeroConvenio, "900001");
  assert.equal(concluidos[0].itensExtraidos, 1);
  assert.equal(concluidos[1].indice, 2);
  assert.equal(concluidos[1].numeroConvenio, "900002");
});

test("falha em qualquer convenio impede salvar cache e impede recarga", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { chamadas, colaboradores } = colaboradoresFake({
    convenios: ["900001", "900002"],
    extrairFn: async (numero) => {
      if (numero === "900002") return { sucesso: false, erros: [{ codigo: "http_500", mensagem: "Falha HTTP" }] };
      return { sucesso: true, origem: "http", dados: { itens: [{ instrumento: numero, descricao: "x", codigoNaturezaDespesa: "33903799", quantidade: 1, valorTotalPrevisto: 10 }], totais: {}, hashConteudo: "h" } };
    },
  });
  await assert.rejects(
    atualizarPadsTransferegovEOperacional({ repoRoot, ...colaboradores }),
    /Cache (inválido|não está tecnicamente apto)/i
  );
  assert.equal(chamadas.salvar.length, 0, "cache nao deve ser salvo se extracao falhou");
  assert.equal(chamadas.recarga.length, 0, "recarga nao deve ocorrer se cache nao foi salvo");
});

test("recarga sucesso retorna resultadoRecarga com origem cache_transferegov e aptoParaPublicacao=false", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { colaboradores } = colaboradoresFake({
    convenios: ["900001"],
    recargaResultado: {
      sucesso: true, origem: "cache_transferegov",
      arquivosLidos: 1, totalConvenios: 1, itensProcessados: 1,
      totalAlertas: 0, totalImpedimentos: 0, totalPendenciasRevisao: 0,
      aptoParaPublicacao: false,
    },
  });
  const resumo = await atualizarPadsTransferegovEOperacional({ repoRoot, ...colaboradores });
  assert.equal(resumo.resultadoRecarga.origem, "cache_transferegov");
  assert.equal(resumo.resultadoRecarga.aptoParaPublicacao, false);
});

test("orquestrador nao chama DETRU/rendimentos/publicacao", async () => {
  // Verifica por construcao: o service-file nao importa nada disso.
  const fonte = fs.readFileSync(
    path.join(__dirname, "../../backend/services/profor-2022/profor-pad-atualizacao-transferegov-orquestrador-service.js"),
    "utf8"
  );
  assert.ok(!/cache[-_]detru/i.test(fonte), "nao deve referenciar cache-detru");
  assert.ok(!/rendimentos[-_]transferegov/i.test(fonte), "nao deve referenciar rendimentos-transferegov");
  assert.ok(!/static[-_]publication/i.test(fonte), "nao deve referenciar static-publication");
  assert.ok(!/publicarDadosEstaticos/.test(fonte), "nao deve publicar");
  assert.ok(!/frontend\/data\/publicados/.test(fonte), "nao deve mexer em publicados");
});

test("gerenciador inicia job e retorna jobId", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { colaboradores } = colaboradoresFake({ convenios: ["900001"] });
  const gerenciador = criarGerenciadorTeste();
  const orquestrador = (opcoes) => atualizarPadsTransferegovEOperacional({
    ...opcoes, ...colaboradores,
  });
  const { jobId, jaEstavaEmAndamento, job } = gerenciador.iniciar({ repoRoot, orquestrador });
  assert.ok(jobId);
  assert.equal(jaEstavaEmAndamento, false);
  assert.equal(job.status, "em_andamento");
  // aguarda conclusao
  await new Promise((r) => setTimeout(r, 50));
  const final = gerenciador.publico(gerenciador.obter(jobId));
  assert.equal(final.status, "concluido");
  assert.ok(final.resumo);
  assert.ok(final.resultadoRecarga);
  assert.equal(final.resultadoRecarga.origem, "cache_transferegov");
  assert.equal(final.resultadoPublicacao.success, true);
});

test("gerenciador publica dados estaticos depois da recarga do job completo", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { colaboradores } = colaboradoresFake({ convenios: ["900001"] });
  const chamadasPublicacao = [];
  const gerenciador = criarGerenciadorTeste({
    publicarDadosEstaticos: async () => {
      chamadasPublicacao.push(new Date().toISOString());
      return { success: true, publicadoEm: "2026-07-07T12:00:00.000Z" };
    },
  });
  const orquestrador = (opcoes) => atualizarPadsTransferegovEOperacional({
    ...opcoes, ...colaboradores,
  });
  const { jobId } = gerenciador.iniciar({ repoRoot, orquestrador });
  await new Promise((r) => setTimeout(r, 50));

  const final = gerenciador.publico(gerenciador.obter(jobId));
  assert.equal(final.status, "concluido");
  assert.equal(chamadasPublicacao.length, 1);
  assert.equal(final.resultadoPublicacao.publicadoEm, "2026-07-07T12:00:00.000Z");
  assert.ok(final.eventos.some((evento) => evento.fase === "publicando_dados_estaticos"));
});

test("gerenciador bloqueia execucao concorrente (mesma chave)", async () => {
  const repoRoot = criarRepoRootTemporario();
  // Orquestrador lento: ja cria o resolvedor antes do primeiro iniciar para
  // garantir que esta disponivel quando o microtask chamar orquestrador.
  let resolverLento;
  const promessaLenta = new Promise((resolve) => { resolverLento = resolve; });
  const orquestrador = () => promessaLenta;

  const gerenciador = criarGerenciadorTeste();
  const primeiro = gerenciador.iniciar({ repoRoot, orquestrador });
  assert.equal(primeiro.jaEstavaEmAndamento, false);

  const segundo = gerenciador.iniciar({ repoRoot, orquestrador });
  assert.equal(segundo.jaEstavaEmAndamento, true, "segundo iniciar deve devolver job existente");
  assert.equal(segundo.jobId, primeiro.jobId);

  // libera o primeiro para nao deixar promise pendurada
  resolverLento({
    totalConveniosAtualizados: 1, totalAptosTecnicos: 1, totalBloqueiosTecnicos: 0,
    totalItensExtraidos: 1, cacheSalvo: true, caminhoCache: "x", hashGlobal: "h", geradoEm: "z",
    resultadoRecarga: { origem: "cache_transferegov", aptoParaPublicacao: false },
  });
  await new Promise((r) => setTimeout(r, 30));
});

test("gerenciador registra erro quando orquestrador falha", async () => {
  const orquestrador = () => Promise.reject(new Error("boom Transferegov"));
  const gerenciador = criarGerenciadorTeste();
  const { jobId } = gerenciador.iniciar({ orquestrador });
  await new Promise((r) => setTimeout(r, 30));
  const final = gerenciador.publico(gerenciador.obter(jobId));
  assert.equal(final.status, "erro");
  assert.match(final.erro.mensagem, /boom Transferegov/);
});

test("gerenciador acumula eventos com fase, indice, total, convenio, status", async () => {
  const repoRoot = criarRepoRootTemporario();
  const { colaboradores } = colaboradoresFake({ convenios: ["A", "B", "C"] });
  const orquestrador = (opcoes) => atualizarPadsTransferegovEOperacional({ ...opcoes, ...colaboradores });
  const gerenciador = criarGerenciadorTeste();
  const { jobId } = gerenciador.iniciar({ repoRoot, orquestrador });
  await new Promise((r) => setTimeout(r, 50));
  const final = gerenciador.publico(gerenciador.obter(jobId));
  assert.equal(final.status, "concluido");
  const concluidos = final.eventos.filter((e) => e.etapa === "convenio_concluido");
  assert.equal(concluidos.length, 3);
  assert.equal(concluidos[2].numeroConvenio, "C");
  assert.equal(concluidos[2].status, "sucesso");
  assert.equal(final.totalConvenios, 3);
});

test("orquestrador nao altera frontend/data/publicados (smoke test de path)", async () => {
  const repoRoot = criarRepoRootTemporario();
  const dirPub = path.join(repoRoot, "frontend", "data", "publicados");
  fs.mkdirSync(dirPub, { recursive: true });
  const marcador = path.join(dirPub, "marcador.json");
  fs.writeFileSync(marcador, '{"intocado":true}', "utf8");
  const conteudoAntes = fs.readFileSync(marcador, "utf8");

  const { colaboradores } = colaboradoresFake({ convenios: ["900001"] });
  await atualizarPadsTransferegovEOperacional({ repoRoot, ...colaboradores });

  const conteudoDepois = fs.readFileSync(marcador, "utf8");
  assert.equal(conteudoDepois, conteudoAntes);
});

test("FASES expostas tem chaves esperadas", () => {
  assert.equal(FASES.INICIANDO, "iniciando");
  assert.equal(FASES.ATUALIZANDO_TRANSFEREGOV, "atualizando_transferegov");
  assert.equal(FASES.SALVANDO_CACHE, "salvando_cache");
  assert.equal(FASES.VALIDANDO_CACHE, "validando_cache");
  assert.equal(FASES.RECARREGANDO_VISAO_LOCAL, "recarregando_visao_local");
  assert.equal(FASES.CONCLUIDO, "concluido");
  assert.equal(FASES.ERRO, "erro");
});
