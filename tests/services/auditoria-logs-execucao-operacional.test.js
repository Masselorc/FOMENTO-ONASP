const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const postgresClient = require("../../backend/db/postgres-client");
const logsService = require("../../backend/services/logs-operacionais-service");
const {
  carregarPadsOperacional,
} = require("../../backend/services/profor-2022/profor-pad-carregador-operacional-service");
const {
  GerenciadorAtualizacaoTransferegov,
} = require("../../backend/services/profor-2022/profor-pad-atualizacao-transferegov-job-service");
const {
  publicarDadosEstaticos,
} = require("../../backend/services/static-publication-service");

const repoRoot = path.resolve(__dirname, "../..");
const queryOriginal = postgresClient.query;
const withTransactionOriginal = postgresClient.withTransaction;

test.afterEach(() => {
  postgresClient.query = queryOriginal;
  postgresClient.withTransaction = withTransactionOriginal;
});

const TIPOS_EXECUCAO_OPERACIONAL = [
  "profor_pad_recarga_operacional_inicio",
  "profor_pad_recarga_operacional_sucesso",
  "profor_pad_recarga_operacional_erro",
  "profor_pad_transferegov_atualizacao_inicio",
  "profor_pad_transferegov_atualizacao_sucesso",
  "profor_pad_transferegov_atualizacao_erro",
  "profor_detru_atualizacao_inicio",
  "profor_detru_atualizacao_sucesso",
  "profor_detru_atualizacao_erro",
  "profor_rendimentos_atualizacao_inicio",
  "profor_rendimentos_atualizacao_sucesso",
  "profor_rendimentos_atualizacao_erro",
  "publicacao_estatica_inicio",
  "publicacao_estatica_sucesso",
  "publicacao_estatica_erro",
];

function assertSemSegredo(payload) {
  const sanitizado = logsService.sanitizarPayloadLog(payload);
  const texto = JSON.stringify(sanitizado);
  assert.doesNotMatch(texto, /postgres:\/\/usuario:segredo@host/i);
  assert.doesNotMatch(texto, /DATABASE_URL=postgres/i);
  assert.doesNotMatch(texto, /bearer-secreto/i);
  assert.doesNotMatch(texto, /senha exposta/i);
  return sanitizado;
}

function leituraPad(overrides = {}) {
  return {
    alertas: [],
    resumo: {
      totalArquivosEncontrados: overrides.totalArquivosEncontrados ?? 15,
      totalRelatoriosLidos: overrides.totalRelatoriosLidos ?? 15,
      totalItensExtraidos: overrides.totalItensExtraidos ?? 1,
      origem: "cache_transferegov",
    },
  };
}

function conferenciaPad() {
  return {
    itensPadReconhecidos: [{
      itemConhecidoId: 1,
      numeroConvenio: "900001",
      uf: "DF",
      descricaoOriginal: "Item PAD conhecido",
      chaveItem: "900001::item-pad-conhecido",
      quantidade: 1,
      valorTotalPrevisto: 100,
      valorTotalExecutado: 0,
      valorUnitario: 100,
      natureza: "CUSTEIO",
      codigoNaturezaDespesa: "339030",
      aptoParaImportacaoFutura: true,
    }],
    itensPadSemRateio: [],
    instrumentosNaoEncontradosNaCarteira: [],
    alertas: [],
    resumo: {
      totalItensPadConferidos: 1,
      totalItensPadComRateio: 1,
      totalItensPadSemRateio: 0,
      totalItensConhecidosAusentesNoPad: 0,
    },
  };
}

function rateiosPad() {
  return new Map([[1, [{ area: "OUVIDORIA", natureza: "CUSTEIO", percentual_valor: 100, percentual_quantidade: 100 }]]]);
}

function gerarLinhasPad(item) {
  return {
    linhas: [{
      numero: item.numeroConvenio,
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: item.descricaoOriginal,
      baseRateioValor: "percentual",
      baseRateioQuantidade: "percentual",
    }],
    alertasItem: [],
    impedimentosItem: [],
  };
}

function recarregarModulo(caminho) {
  delete require.cache[require.resolve("../../backend/services/logs-operacionais-service")];
  delete require.cache[require.resolve(caminho)];
  return require(caminho);
}

async function aguardarMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

test("logs-operacionais aceita tipos de execução operacional da Prioridade 3", () => {
  for (const tipo of TIPOS_EXECUCAO_OPERACIONAL) {
    assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has(tipo), `Tipo ausente: ${tipo}`);
  }
});

test("sanitizarPayloadLog remove DATABASE_URL e segredo textual", () => {
  const sanitizado = assertSemSegredo({
    DATABASE_URL: "postgres://usuario:segredo@host/db",
    token: "bearer-secreto",
    erro: "Falha com DATABASE_URL=postgres://usuario:segredo@host/db",
  });
  assert.equal(sanitizado.DATABASE_URL, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(sanitizado.token, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(sanitizado.erro, "[REMOVIDO_POR_SANITIZACAO]");
});

test("Recarga PAD registra início e sucesso sem publicar", async () => {
  const logs = [];
  const resultado = await carregarPadsOperacional({
    repoRoot,
    salvarRelatorio: false,
    lerRelatoriosPad: () => leituraPad(),
    conferirItensPadComRateios: async () => conferenciaPad(),
    carregarMemoriaRateios: async () => rateiosPad(),
    gerarLinhasItem: gerarLinhasPad,
    registrarLogOperacional: async (log) => { logs.push(log); return { id: logs.length }; },
  });

  assert.equal(resultado.sucesso, true);
  assert.deepEqual(logs.map((log) => log.tipoEvento), [
    "profor_pad_recarga_operacional_inicio",
    "profor_pad_recarga_operacional_sucesso",
  ]);
  assert.equal(logs[1].payload.totalRelatoriosLidos, 15);
  assert.equal(logs[1].payload.totalLinhasReconstruidas, 1);
  assert.equal(logs[1].payload.caminhosRelatorios.recargaJson.includes("frontend/data/publicados"), false);
});

test("Recarga PAD registra erro e sanitização remove segredo do payload", async () => {
  const logs = [];
  const resultado = await carregarPadsOperacional({
    repoRoot,
    salvarRelatorio: false,
    lerRelatoriosPad: () => { throw new Error("DATABASE_URL=postgres://usuario:segredo@host/db"); },
    registrarLogOperacional: async (log) => { logs.push(log); return { id: logs.length }; },
  });

  assert.equal(resultado.sucesso, false);
  assert.equal(logs[1].tipoEvento, "profor_pad_recarga_operacional_erro");
  assert.equal(logs[1].status, "falha");
  assertSemSegredo(logs[1].payload);
});

test("Atualização PAD/Transferegov registra início e sucesso no job com mock", async () => {
  const logs = [];
  const gerenciador = new GerenciadorAtualizacaoTransferegov({
    registrarLogOperacional: async (log) => { logs.push(log); return { id: logs.length }; },
    publicarDadosEstaticos: async () => ({ success: true, publicadoEm: "2026-07-07T12:00:00.000Z" }),
  });
  const resumo = {
    totalConveniosAtualizados: 2,
    totalAptosTecnicos: 2,
    totalBloqueiosTecnicos: 0,
    totalItensExtraidos: 10,
    cacheSalvo: true,
    hashGlobal: "hash-ok",
    resultadoRecarga: { origem: "cache_transferegov", aptoParaPublicacao: false },
  };
  const { jobId } = gerenciador.iniciar({ orquestrador: () => Promise.resolve(resumo) });
  await aguardarMicrotasks();

  assert.ok(jobId);
  assert.deepEqual(logs.map((log) => log.tipoEvento), [
    "profor_pad_transferegov_atualizacao_inicio",
    "profor_pad_transferegov_atualizacao_sucesso",
  ]);
  assert.equal(logs[1].payload.totalItensExtraidos, 10);
  assert.equal(logs[1].payload.cacheSalvo, true);
  assert.equal(logs[1].payload.publicacaoEstatica, true);
  assert.equal(logs[1].payload.publicadoEm, "2026-07-07T12:00:00.000Z");
});

test("Atualização PAD/Transferegov registra erro no job com mock", async () => {
  const logs = [];
  const gerenciador = new GerenciadorAtualizacaoTransferegov({
    registrarLogOperacional: async (log) => { logs.push(log); return { id: logs.length }; },
  });
  gerenciador.iniciar({ orquestrador: () => Promise.reject(new Error("token bearer-secreto")) });
  await aguardarMicrotasks();

  assert.equal(logs[1].tipoEvento, "profor_pad_transferegov_atualizacao_erro");
  assert.equal(logs[1].status, "falha");
  assertSemSegredo(logs[1].payload);
});

test("DETRU: registrar início/fim/erro também chama log operacional", async () => {
  const logs = [];
  postgresClient.query = async (sql, params = []) => {
    if (/INSERT INTO profor_detru_atualizacoes/i.test(sql)) return { rows: [{ id: 77 }] };
    if (/UPDATE profor_detru_atualizacoes/i.test(sql)) return { rows: [] };
    if (/INSERT INTO logs_operacionais/i.test(sql)) {
      logs.push({ tipoEvento: params[1], status: params[2], payload: params[7] ? JSON.parse(params[7]) : null });
      return { rows: [{ id: logs.length }] };
    }
    throw new Error(`SQL inesperado DETRU: ${sql}`);
  };
  const service = recarregarModulo("../../backend/services/profor-2022/profor-detru-cache-service");

  const id = await service.registrarAtualizacaoDetruInicio({ caminhoArquivo: "C:\\Users\\teste\\detru.csv", arquivoHash: "hash-detru" });
  await service.registrarAtualizacaoDetruFim(id, {
    totalCarteiraAtiva: 3,
    totalLinhasDetruLidas: 10,
    totalEncontrados: 2,
    totalNaoEncontrados: 1,
  });
  await service.registrarAtualizacaoDetruErro(id, new Error("senha exposta"));

  assert.deepEqual(logs.map((log) => log.tipoEvento), [
    "profor_detru_atualizacao_inicio",
    "profor_detru_atualizacao_sucesso",
    "profor_detru_atualizacao_erro",
  ]);
  assert.equal(logs[1].payload.totalEncontrados, 2);
  assertSemSegredo(logs[2].payload);
});

test("Rendimentos: logs distinguem sucesso, parcial e falha", async () => {
  const logs = [];
  const atualizacoes = [];
  postgresClient.query = async (sql, params = []) => {
    if (/INSERT INTO profor_transferegov_rendimentos_consultas/i.test(sql)) return { rows: [{ id: 88 }] };
    if (/UPDATE profor_transferegov_rendimentos_consultas/i.test(sql)) {
      atualizacoes.push(params);
      return { rows: [] };
    }
    if (/INSERT INTO logs_operacionais/i.test(sql)) {
      logs.push({ tipoEvento: params[1], status: params[2], payload: params[7] ? JSON.parse(params[7]) : null });
      return { rows: [{ id: logs.length }] };
    }
    throw new Error(`SQL inesperado Rendimentos: ${sql}`);
  };
  const service = recarregarModulo("../../backend/services/profor-2022/transferegov-rendimentos-cache-service");

  const id = await service.registrarConsultaRendimentosInicio({ totalCarteiraAtiva: 4 });
  await service.registrarConsultaRendimentosFim(id, {
    totalCarteiraAtiva: 4,
    totalConsultados: 4,
    totalSucesso: 4,
    totalFalha: 0,
  });
  await service.registrarConsultaRendimentosFim(id, {
    totalCarteiraAtiva: 4,
    totalConsultados: 4,
    totalSucesso: 3,
    totalFalha: 1,
  });
  await service.registrarConsultaRendimentosFim(id, {
    totalCarteiraAtiva: 4,
    totalConsultados: 4,
    totalSucesso: 0,
    totalFalha: 4,
  });
  await service.registrarConsultaRendimentosErro(id, new Error("token bearer-secreto"));

  assert.deepEqual(logs.map((log) => log.tipoEvento), [
    "profor_rendimentos_atualizacao_inicio",
    "profor_rendimentos_atualizacao_sucesso",
    "profor_rendimentos_transferegov",
    "profor_rendimentos_atualizacao_erro",
    "profor_rendimentos_atualizacao_erro",
  ]);
  assert.deepEqual(logs.slice(1, 4).map((log) => log.status), ["sucesso", "parcial", "falha"]);
  assert.equal(logs[2].payload.statusResultado, "parcial");
  assert.deepEqual(atualizacoes.slice(0, 3).map((params) => params[1]), [true, false, false]);
  assertSemSegredo(logs[4].payload);
});

test("Publicação estática explícita registra início/sucesso com mocks sem escrever arquivos reais", async () => {
  const logs = [];
  const arquivosEscritos = [];
  const resultado = await publicarDadosEstaticos({
    registrarLogOperacional: async (log) => { logs.push(log); return { id: logs.length }; },
    carregarCatalogoAplicacao: () => ({ dadosBase: [] }),
    listarParametrosMinimos: async () => ({ respostas: [{ uf: "DF" }] }),
    listarFormalizacaoProfor: async () => ({ propostas: [{ uf: "DF" }], registros: [{ segredo: "interno" }] }),
    listarOrcamento2026: async () => ({ itens: [{ id: 1 }], arquivo: "interno" }),
    consolidarCatalogoDashboard: async (catalogoPublicado) => ({
      catalogoPublicado,
      dashboardGeral: { total: 1 },
      resumoDashboard: { total: 1 },
      totaisExtracao: { itensConvenio: 0, conveniosProfor2022: 0 },
    }),
    escreverJsonAtomico: (nomeArquivo) => { arquivosEscritos.push(nomeArquivo); },
  });

  assert.equal(resultado.success, true);
  assert.deepEqual(logs.map((log) => log.tipoEvento), [
    "publicacao_estatica_inicio",
    "publicacao_estatica_sucesso",
  ]);
  assert.equal(arquivosEscritos.length, 6);
  assert.ok(arquivosEscritos.includes("resumo-publicacao.json"));
});

test("Publicação estática explícita registra erro com mock sem escrever em frontend/data/publicados", async () => {
  const logs = [];
  await assert.rejects(
    publicarDadosEstaticos({
      registrarLogOperacional: async (log) => { logs.push(log); return { id: logs.length }; },
      carregarCatalogoAplicacao: () => { throw new Error("DATABASE_URL=postgres://usuario:segredo@host/db"); },
      escreverJsonAtomico: () => { throw new Error("nao deve escrever"); },
    }),
    /DATABASE_URL/
  );

  assert.deepEqual(logs.map((log) => log.tipoEvento), [
    "publicacao_estatica_inicio",
    "publicacao_estatica_erro",
  ]);
  assert.equal(logs[1].status, "falha");
  assertSemSegredo(logs[1].payload);
});

test("Tela Sistema/Logs contém os tipos novos nos filtros", () => {
  const app = fs.readFileSync(path.join(repoRoot, "frontend/js/app.js"), "utf8");
  for (const tipo of TIPOS_EXECUCAO_OPERACIONAL) {
    assert.match(app, new RegExp(tipo), `Filtro ausente na tela Sistema/Logs: ${tipo}`);
  }
});
