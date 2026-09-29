const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const postgresClient = require("../../backend/db/postgres-client");
const repository = require("../../backend/services/profor-2022/profor-pad-historico-repository");
const fotografia = require("../../backend/services/profor-2022/profor-pad-fotografia-service");
const comparador = require("../../backend/services/profor-2022/profor-pad-comparador-snapshots-service");
const historico = require("../../backend/services/profor-2022/profor-pad-historico-service");
const carregador = require("../../backend/services/profor-2022/profor-pad-carregador-operacional-service");
const orquestrador = require("../../backend/services/profor-2022/profor-pad-atualizacao-transferegov-orquestrador-service");

const originais = {
  withTransaction: postgresClient.withTransaction,
  criarAtualizacao: repository.criarAtualizacao,
  inserirSnapshot: repository.inserirSnapshot,
  inserirAlteracoes: repository.inserirAlteracoes,
  concluirAtualizacao: repository.concluirAtualizacao,
  falharAtualizacao: repository.falharAtualizacao,
  listarRateiosAtivosPorChavesItem: repository.listarRateiosAtivosPorChavesItem,
  listarDivergenciasPorChavesItem: repository.listarDivergenciasPorChavesItem,
  listarVinculosSubstitutoPorDivergenciasSubstitutas: repository.listarVinculosSubstitutoPorDivergenciasSubstitutas,
  carregarPadsOperacional: carregador.carregarPadsOperacional,
  atualizarPadsTransferegovEOperacional: orquestrador.atualizarPadsTransferegovEOperacional,
};

afterEach(() => {
  for (const [nome, funcao] of Object.entries(originais)) {
    if (nome === "withTransaction") postgresClient[nome] = funcao;
    else if (nome === "carregarPadsOperacional") carregador[nome] = funcao;
    else if (nome === "atualizarPadsTransferegovEOperacional") orquestrador[nome] = funcao;
    else repository[nome] = funcao;
  }
});

function notebook(opcoes = {}) {
  return {
    uf: "SP", numero: "900001/2022", instrumento: "Convênio", ano: "2022",
    area: "OUVIDORIA", natureza: "CAPITAL", descricao: "Notebook",
    chaveItem: "pad-notebook", quantidade: 1, valorUnitario: 100,
    valorPrevisto: 100, valorExecutado: 20,
    ...opcoes,
  };
}

function pendencia(opcoes = {}) {
  return {
    tipo: "item_novo_sem_rateio_memorizado", numeroConvenio: "900001/2022",
    uf: "SP", natureza: "CAPITAL", descricao: "Câmera nova", chaveItem: "pad-camera",
    quantidade: 2, valorUnitario: 50, valorTotalPrevisto: 100,
    valorTotalExecutado: 10,
    ...opcoes,
  };
}

function recarga(linhas = [notebook()], pendencias = []) {
  return {
    planoAplicacaoReconstruido: linhas,
    pendenciasRevisao: pendencias,
    totalPendenciasRevisao: pendencias.length,
  };
}

function simularPersistencia({ falhaEm, falhaAoMarcar = false } = {}) {
  const eventos = [];
  const clients = [];
  const snapshots = [];
  const alteracoes = [];
  let resumoFinal;
  const erroTransacao = new Error("Falha simulada na transação");
  repository.listarRateiosAtivosPorChavesItem = async () => [];
  repository.listarDivergenciasPorChavesItem = async () => [];
  repository.listarVinculosSubstitutoPorDivergenciasSubstitutas = async () => [];
  postgresClient.withTransaction = async (callback) => {
    const client = { numero: clients.length + 1 };
    clients.push(client);
    eventos.push("BEGIN");
    try {
      const retorno = await callback(client);
      eventos.push("COMMIT");
      return retorno;
    } catch (erro) {
      eventos.push("ROLLBACK");
      throw erro;
    }
  };
  repository.criarAtualizacao = async (client, dados) => {
    eventos.push("CRIAR");
    assert.equal(client, clients.at(-1));
    assert.equal(dados.status, "EM_EXECUCAO");
    return { id: 41, ...dados };
  };
  repository.inserirSnapshot = async (client, dados) => {
    eventos.push(dados.momento);
    assert.equal(client, clients.at(-1));
    snapshots.push(dados);
    if (falhaEm === dados.momento) throw erroTransacao;
    return dados;
  };
  repository.inserirAlteracoes = async (client, dados) => {
    eventos.push("ALTERACOES");
    assert.equal(client, clients.at(-1));
    alteracoes.push(...dados);
    if (falhaEm === "ALTERACOES") throw erroTransacao;
    return dados;
  };
  repository.concluirAtualizacao = async (client, id, dados) => {
    eventos.push("CONCLUIR");
    assert.equal(client, clients.at(-1));
    assert.equal(id, 41);
    resumoFinal = dados;
    if (falhaEm === "CONCLUIR") throw erroTransacao;
    return { id, ...dados };
  };
  repository.falharAtualizacao = async (executor, id, dados) => {
    eventos.push("FALHOU");
    assert.equal(executor, null);
    assert.equal(id, 41);
    if (falhaAoMarcar) throw new Error("Falha secundária");
    return { id, ...dados, status: "FALHOU" };
  };
  return { eventos, clients, snapshots, alteracoes, erroTransacao, get resumoFinal() { return resumoFinal; } };
}

test("estado completo inclui linhas reconstruídas e mantém novo array", () => {
  const origem = recarga();
  const plano = historico.montarPlanoCompletoParaHistorico(origem);
  assert.notEqual(plano, origem.planoAplicacaoReconstruido);
  assert.deepEqual(plano, origem.planoAplicacaoReconstruido);
});

test("inclui item novo sem rateio como NAO_CLASSIFICADO", () => {
  const plano = historico.montarPlanoCompletoParaHistorico(recarga([], [pendencia()]));
  assert.equal(plano.length, 1);
  assert.equal(plano[0].area, "NAO_CLASSIFICADO");
  assert.equal(plano[0].valorPrevisto, 100);
});

test("inclui item reconhecido sem rateio como NAO_CLASSIFICADO", () => {
  const plano = historico.montarPlanoCompletoParaHistorico(recarga([], [
    pendencia({ tipo: "item_pad_sem_rateio_memorizado" }),
  ]));
  assert.equal(plano[0].area, "NAO_CLASSIFICADO");
});

test("alerta técnico não vira item material", () => {
  const plano = historico.montarPlanoCompletoParaHistorico(recarga([], [
    pendencia({ tipo: "instrumento_fora_da_carteira" }),
  ]));
  assert.equal(plano.length, 0);
});

test("deduplica pendência por chaveItem sem eliminar linhas de rateio", () => {
  const plano = historico.montarPlanoCompletoParaHistorico(recarga([
    notebook(), notebook({ area: "CORREGEDORIA" }),
  ], [pendencia({ chaveItem: "pad-notebook" })]));
  assert.equal(plano.length, 2);
});

test("não muta recarga nem seus arrays", () => {
  const origem = recarga([notebook()], [pendencia()]);
  const copia = structuredClone(origem);
  historico.montarPlanoCompletoParaHistorico(origem);
  assert.deepEqual(origem, copia);
});

test("pendência material sem identidade mínima falha explicitamente", () => {
  assert.throws(() => historico.montarPlanoCompletoParaHistorico(recarga([], [
    pendencia({ chaveItem: null }),
  ])), (erro) => erro.codigo === "pendencia_pad_sem_identidade_material");
});

test("item novo sem classificação surge como NOVO com revisão pendente", () => {
  const antes = historico.gerarSnapshotHistorico(recarga());
  const depois = historico.gerarSnapshotHistorico(recarga([notebook()], [pendencia()]));
  const comparacao = comparador.compararSnapshotsPad(antes, depois, { modo: "historico" });
  const alteracoes = historico.normalizarAlteracoesComparador(comparacao, 41);
  assert.equal(comparacao.resumo.totalNovos, 1);
  assert.equal(comparacao.itensNovos[0].descricaoOriginal, "Câmera nova");
  assert.equal(comparacao.itensNovos[0].area, "NAO_CLASSIFICADO");
  assert.equal(alteracoes[0].tipo, "NOVO");
  assert.equal(alteracoes[0].classificacaoEstado, "PENDENTE_REVISAO");
});

test("comparador preserva modo padrão e aceita modo historico", () => {
  const foto = fotografia.gerarFotografiaCanonica([notebook()]);
  assert.equal(comparador.compararSnapshotsPad(foto, foto).modo, "dry-run");
  assert.equal(comparador.compararSnapshotsPad(foto, foto, { modo: "historico" }).modo, "historico");
  assert.equal(comparador.compararSnapshotsPad(foto, foto).resumo.totalIguais, 1);
});

test("início persiste execução e ANTES no mesmo client", async () => {
  const mock = simularPersistencia();
  const retorno = await historico.iniciarHistoricoPad({ jobId: "job-1", resultadoRecargaAntes: recarga() });
  assert.deepEqual(mock.eventos, ["BEGIN", "CRIAR", "ANTES", "COMMIT"]);
  assert.equal(mock.clients.length, 1);
  assert.equal(retorno.atualizacao.id, 41);
  assert.equal(mock.snapshots[0].snapshot, retorno.snapshotAntes);
});

test("falha ao persistir ANTES provoca rollback da criação", async () => {
  const mock = simularPersistencia({ falhaEm: "ANTES" });
  await assert.rejects(historico.iniciarHistoricoPad({ resultadoRecargaAntes: recarga() }), mock.erroTransacao);
  assert.deepEqual(mock.eventos, ["BEGIN", "CRIAR", "ANTES", "ROLLBACK"]);
});

test("sem mudanças registra os dois snapshots, zero alterações e SEM_ALTERACOES", async () => {
  const mock = simularPersistencia();
  const { snapshotAntes } = await historico.iniciarHistoricoPad({ resultadoRecargaAntes: recarga() });
  const retorno = await historico.finalizarHistoricoPad({
    atualizacaoId: 41, snapshotAntes, resultadoRecargaDepois: recarga(),
  });
  assert.deepEqual(mock.eventos, ["BEGIN", "CRIAR", "ANTES", "COMMIT", "BEGIN", "DEPOIS", "ALTERACOES", "CONCLUIR", "COMMIT"]);
  assert.equal(mock.clients.length, 2);
  assert.equal(mock.snapshots[0].checksum, mock.snapshots[1].checksum);
  assert.equal(mock.alteracoes.length, 0);
  assert.equal(mock.resumoFinal.resultado, "SEM_ALTERACOES");
  assert.equal(retorno.comparacao.resumo.totalIguais, 1);
});

test("item novo classificado gera NOVO", () => {
  const antes = historico.gerarSnapshotHistorico(recarga([]));
  const depois = historico.gerarSnapshotHistorico(recarga([notebook()]));
  const alteracoes = historico.normalizarAlteracoesComparador(comparador.compararSnapshotsPad(antes, depois), 41);
  assert.equal(alteracoes[0].tipo, "NOVO");
  assert.equal(alteracoes[0].classificacaoEstado, "NAO_APLICAVEL");
  assert.deepEqual(alteracoes[0].camposAlterados, []);
});

test("item removido permanece no ANTES e gera REMOVIDO", () => {
  const antes = historico.gerarSnapshotHistorico(recarga([notebook()]));
  const depois = historico.gerarSnapshotHistorico(recarga([]));
  const alteracoes = historico.normalizarAlteracoesComparador(comparador.compararSnapshotsPad(antes, depois), 41);
  assert.equal(depois.planoAplicacao.length, 0);
  assert.equal(alteracoes[0].tipo, "REMOVIDO");
  assert.equal(alteracoes[0].itemAnterior.descricaoOriginal, "Notebook");
  assert.equal(alteracoes[0].itemNovo, null);
});

test("ALTERADO conserva itens canônicos e campos do comparador", () => {
  const antes = historico.gerarSnapshotHistorico(recarga([notebook()]));
  const depois = historico.gerarSnapshotHistorico(recarga([notebook({ quantidade: 2, valorPrevisto: 200 })]));
  const comparacao = comparador.compararSnapshotsPad(antes, depois);
  const alteracoes = historico.normalizarAlteracoesComparador(comparacao, 41);
  assert.equal(comparacao.resumo.totalAlterados, 1);
  assert.equal(alteracoes[0].tipo, "ALTERADO");
  assert.equal(alteracoes[0].itemAnterior.quantidade, 1);
  assert.equal(alteracoes[0].itemNovo.quantidade, 2);
  assert.deepEqual(alteracoes[0].camposAlterados, Object.keys(comparacao.itensAlterados[0].valores));
});

test("mudança apenas textual continua identificada pelo comparador real", () => {
  const antes = historico.gerarSnapshotHistorico(recarga([notebook({ descricao: "Câmera" })]));
  const depois = historico.gerarSnapshotHistorico(recarga([notebook({ descricao: "Camera" })]));
  const comparacao = comparador.compararSnapshotsPad(antes, depois);
  assert.equal(comparacao.resumo.totalAlterados, 1);
  assert.ok(Object.hasOwn(comparacao.itensAlterados[0].valores, "descricao"));
});

test("resumo financeiro usa totais do snapshot e calcula deltas", () => {
  const snapshotAntes = historico.gerarSnapshotHistorico(recarga([notebook()]));
  const snapshotDepois = historico.gerarSnapshotHistorico(recarga([notebook({ valorPrevisto: 150, valorExecutado: 40 })]));
  const comparacao = comparador.compararSnapshotsPad(snapshotAntes, snapshotDepois);
  const resumo = historico.montarResumoAtualizacaoHistorico({
    snapshotAntes, snapshotDepois, comparacao, resultadoRecargaDepois: recarga([], [pendencia()]),
  });
  assert.equal(resumo.totalValorPrevistoAntes, 100);
  assert.equal(resumo.totalValorPrevistoDepois, 150);
  assert.equal(resumo.deltaValorPrevisto, 50);
  assert.equal(resumo.deltaValorExecutado, 20);
  assert.equal(resumo.deltaSaldo, 30);
  assert.equal(resumo.resultado, "COM_ALTERACOES");
  assert.equal(resumo.temPendenciasRevisao, true);
});

test("finalização usa um client para DEPOIS, alterações e conclusão em ordem", async () => {
  const mock = simularPersistencia();
  const antes = historico.gerarSnapshotHistorico(recarga());
  const retorno = await historico.finalizarHistoricoPad({
    atualizacaoId: 41, snapshotAntes: antes,
    resultadoRecargaDepois: recarga([notebook()], [pendencia()]),
  });
  assert.deepEqual(mock.eventos, ["BEGIN", "DEPOIS", "ALTERACOES", "CONCLUIR", "COMMIT"]);
  assert.equal(mock.clients.length, 1);
  assert.equal(mock.alteracoes[0].tipo, "NOVO");
  assert.equal(retorno.atualizacao.resultado, "COM_ALTERACOES");
  assert.equal(mock.resumoFinal.metadados.modoComparador, "historico");
});

test("falha final aciona rollback, marca FALHOU separadamente e relança erro original", async () => {
  const mock = simularPersistencia({ falhaEm: "ALTERACOES" });
  const antes = historico.gerarSnapshotHistorico(recarga());
  await assert.rejects(historico.finalizarHistoricoPad({
    atualizacaoId: 41, snapshotAntes: antes, resultadoRecargaDepois: recarga(),
  }), mock.erroTransacao);
  assert.deepEqual(mock.eventos, ["BEGIN", "DEPOIS", "ALTERACOES", "ROLLBACK", "FALHOU"]);
});

test("falha secundária ao marcar FALHOU não encobre erro original", async () => {
  const mock = simularPersistencia({ falhaEm: "CONCLUIR", falhaAoMarcar: true });
  const antes = historico.gerarSnapshotHistorico(recarga());
  await assert.rejects(historico.finalizarHistoricoPad({
    atualizacaoId: 41, snapshotAntes: antes, resultadoRecargaDepois: recarga(),
  }), mock.erroTransacao);
  assert.deepEqual(mock.eventos.at(-2), "ROLLBACK");
  assert.deepEqual(mock.eventos.at(-1), "FALHOU");
});

test("mensagem de falha remove segredos conhecidos e limita comprimento", async () => {
  const mock = simularPersistencia();
  const anterior = process.env.PROFOR_ADMIN_TOKEN;
  process.env.PROFOR_ADMIN_TOKEN = "segredo-de-teste";
  try {
    const retorno = await historico.falharHistoricoPad({
      atualizacaoId: 41, erro: new Error(`Falha segredo-de-teste ${"x".repeat(600)}`),
    });
    assert.ok(retorno.mensagemErro.includes("[REDACTED]"));
    assert.ok(!retorno.mensagemErro.includes("segredo-de-teste"));
    assert.ok(retorno.mensagemErro.length <= 500);
    assert.deepEqual(mock.eventos, ["FALHOU"]);
  } finally {
    if (anterior === undefined) delete process.env.PROFOR_ADMIN_TOKEN;
    else process.env.PROFOR_ADMIN_TOKEN = anterior;
  }
});

test("memória preserva classificação existente, inclusive grafia legada, e remoção", async () => {
  const linha = notebook({ area: "ESCOLA PENAL" });
  const material = fotografia.normalizarLinhaPadCanonica(linha).chaveMaterial;
  repository.listarRateiosAtivosPorChavesItem = async () => [{ chaveItem: "pad-notebook", area: "ESCOLA PENAL", natureza: "CAPITAL" }];
  repository.listarDivergenciasPorChavesItem = async () => [];
  repository.listarVinculosSubstitutoPorDivergenciasSubstitutas = async () => [];
  const original = [
    { tipo: "NOVO", chaveItemNova: material, areaNova: "ESCOLA PENAL", naturezaNova: "CAPITAL", classificacaoEstado: "NAO_APLICAVEL" },
    { tipo: "ALTERADO", chaveItemNova: material, areaAnterior: "ESCOLA PENAL", areaNova: "ESCOLA PENAL", classificacaoEstado: "NAO_APLICAVEL" },
    { tipo: "REMOVIDO", areaAnterior: "ESCOLA PENAL", classificacaoEstado: "NAO_APLICAVEL" },
  ];
  const saida = await historico.enriquecerAlteracoesComClassificacao({ alteracoes: original, resultadoRecargaDepois: recarga([linha]) });
  assert.deepEqual(saida.map((a) => a.classificacaoEstado), ["PRESERVADA", "PRESERVADA", "PRESERVADA"]);
  assert.deepEqual(saida.map((a) => a.areaNova), ["ESCOLA_PENAL", "ESCOLA_PENAL", undefined]);
  assert.equal(original[0].areaNova, "ESCOLA PENAL");
});

test("item sem classificação mantém revisão e herda somente vínculo inequívoco efetivo", async () => {
  const linha = pendencia();
  const plano = historico.montarPlanoCompletoParaHistorico(recarga([], [linha]));
  const material = fotografia.normalizarLinhaPadCanonica(plano[0]).chaveMaterial;
  const original = [{ tipo: "NOVO", chaveItemNova: material, areaNova: "NAO_CLASSIFICADO", naturezaNova: "CAPITAL", itemNovo: { area: "NAO_CLASSIFICADO" } }];
  repository.listarRateiosAtivosPorChavesItem = async (chaves) => chaves.includes("pad-antigo")
    ? [{ chaveItem: "pad-antigo", area: "OUVIDORIA", natureza: "CAPITAL" }] : [];
  repository.listarDivergenciasPorChavesItem = async () => [{ id: 8, chaveItem: "pad-camera" }];
  repository.listarVinculosSubstitutoPorDivergenciasSubstitutas = async () => [{
    decisaoId: 9, divergenciaAusenteId: 7, divergenciaSubstitutaId: 8,
    chaveItemAusente: "pad-antigo", decisao: "CORRIGIDO", statusDivergenciaAusente: "CORRIGIDO",
    payload: { tipoSaneamento: "vinculo_item_substituto", divergenciaAusenteId: 7, divergenciaSubstitutaId: 8 },
  }];
  const entrada = { alteracoes: original, resultadoRecargaDepois: recarga([], [linha]) };
  const [herdada] = await historico.enriquecerAlteracoesComClassificacao(entrada);
  assert.equal(herdada.classificacaoEstado, "HERDADA_SUBSTITUTO");
  assert.equal(herdada.areaNova, "OUVIDORIA");
  assert.equal(herdada.revisaoDivergenciaId, 8);
  assert.equal(herdada.decisaoSubstitutoId, 9);
  assert.equal(herdada.itemNovo.area, "NAO_CLASSIFICADO");
  assert.equal(original[0].areaNova, "NAO_CLASSIFICADO");

  repository.listarVinculosSubstitutoPorDivergenciasSubstitutas = async () => [];
  const [pendente] = await historico.enriquecerAlteracoesComClassificacao(entrada);
  assert.equal(pendente.classificacaoEstado, "PENDENTE_REVISAO");
  assert.equal(pendente.revisaoDivergenciaId, 8);
  assert.equal(pendente.areaNova, "NAO_CLASSIFICADO");
});

test("vínculo revertido ou múltiplas áreas não herda classificação", async () => {
  const linha = pendencia();
  const material = fotografia.normalizarLinhaPadCanonica(
    historico.montarPlanoCompletoParaHistorico(recarga([], [linha]))[0]
  ).chaveMaterial;
  repository.listarDivergenciasPorChavesItem = async () => [{ id: 8, chaveItem: "pad-camera" }];
  repository.listarVinculosSubstitutoPorDivergenciasSubstitutas = async () => [{
    decisaoId: 9, divergenciaAusenteId: 7, divergenciaSubstitutaId: 8,
    chaveItemAusente: "pad-antigo", decisao: "CORRIGIDO", statusDivergenciaAusente: "REVERTIDO",
    payload: { tipoSaneamento: "vinculo_item_substituto", divergenciaAusenteId: 7, divergenciaSubstitutaId: 8 },
  }];
  repository.listarRateiosAtivosPorChavesItem = async () => [{ chaveItem: "pad-antigo", area: "OUVIDORIA", natureza: "CAPITAL" }];
  const entrada = { alteracoes: [{ tipo: "NOVO", chaveItemNova: material, areaNova: "NAO_CLASSIFICADO", naturezaNova: "CAPITAL" }], resultadoRecargaDepois: recarga([], [linha]) };
  assert.equal((await historico.enriquecerAlteracoesComClassificacao(entrada))[0].classificacaoEstado, "PENDENTE_REVISAO");
  repository.listarVinculosSubstitutoPorDivergenciasSubstitutas = async () => [{
    decisaoId: 9, divergenciaAusenteId: 7, divergenciaSubstitutaId: 8,
    chaveItemAusente: "pad-antigo", decisao: "CORRIGIDO", statusDivergenciaAusente: "CORRIGIDO",
    payload: { tipoSaneamento: "vinculo_item_substituto", divergenciaAusenteId: 7, divergenciaSubstitutaId: 8 },
  }];
  repository.listarRateiosAtivosPorChavesItem = async () => [
    { chaveItem: "pad-antigo", area: "OUVIDORIA", natureza: "CAPITAL" },
    { chaveItem: "pad-antigo", area: "CORREGEDORIA", natureza: "CAPITAL" },
  ];
  assert.equal((await historico.enriquecerAlteracoesComClassificacao(entrada))[0].classificacaoEstado, "PENDENTE_REVISAO");
});

test("integração captura ANTES, usa a única recarga do orquestrador e conclui histórico", async () => {
  const mock = simularPersistencia();
  const eventos = [];
  carregador.carregarPadsOperacional = async (opcoes) => {
    assert.equal(opcoes.salvarRelatorio, false);
    eventos.push("ANTES");
    return { ...recarga(), sucesso: true };
  };
  orquestrador.atualizarPadsTransferegovEOperacional = async (opcoes) => {
    eventos.push("ORQUESTRADOR");
    assert.equal(opcoes.jobId, "job-1");
    return { resultadoRecarga: recarga(), totalConveniosAtualizados: 1 };
  };
  const retorno = await historico.atualizarPadsTransferegovComHistorico({ jobId: "job-1", onProgress: (e) => eventos.push(e.etapa) });
  assert.deepEqual(eventos, ["ANTES", "historico_antes_persistido", "ORQUESTRADOR", "historico_concluido"]);
  assert.equal(retorno.registroPadId, 41);
  assert.equal(retorno.resultadoHistorico, "SEM_ALTERACOES");
  assert.equal(mock.snapshots.length, 2);
});

test("captura anterior insegura aborta sem histórico e sem Transferegov", async () => {
  carregador.carregarPadsOperacional = async () => ({ ...recarga(), sucesso: false, totalImpedimentos: 1 });
  orquestrador.atualizarPadsTransferegovEOperacional = async () => { throw new Error("não deveria executar"); };
  await assert.rejects(historico.atualizarPadsTransferegovComHistorico(), /estado anterior/);
});

test("falha do orquestrador marca histórico FALHOU e relança erro", async () => {
  const mock = simularPersistencia();
  carregador.carregarPadsOperacional = async () => ({ ...recarga(), sucesso: true });
  const erro = new Error("falha operacional");
  orquestrador.atualizarPadsTransferegovEOperacional = async () => { throw erro; };
  await assert.rejects(historico.atualizarPadsTransferegovComHistorico(), erro);
  assert.deepEqual(mock.eventos, ["BEGIN", "CRIAR", "ANTES", "COMMIT", "FALHOU"]);
});
