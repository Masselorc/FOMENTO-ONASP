const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  carregarPadsOperacional,
} = require("../../backend/services/profor-2022/profor-pad-carregador-operacional-service");

function leitura(overrides = {}) {
  return {
    alertas: overrides.alertas || [],
    resumo: {
      totalArquivosEncontrados: overrides.totalArquivosEncontrados ?? 15,
      totalRelatoriosLidos: overrides.totalRelatoriosLidos ?? 15,
      totalItensExtraidos: overrides.totalItensExtraidos ?? 1,
    },
  };
}

function itemPad(overrides = {}) {
  return {
    itemConhecidoId: overrides.itemConhecidoId ?? 1,
    numeroConvenio: overrides.numeroConvenio || "900001",
    uf: overrides.uf || "DF",
    descricaoOriginal: overrides.descricaoOriginal || "Item PAD conhecido",
    chaveItem: overrides.chaveItem || "900001::item-pad-conhecido",
    quantidade: overrides.quantidade ?? 2,
    valorTotalPrevisto: overrides.valorTotalPrevisto ?? 200,
    valorTotalExecutado: overrides.valorTotalExecutado ?? 100,
    valorUnitario: overrides.valorUnitario ?? 100,
    natureza: overrides.natureza || "CUSTEIO",
    codigoNaturezaDespesa: overrides.codigoNaturezaDespesa || "339030",
    aptoParaImportacaoFutura: true,
  };
}

function conferencia(overrides = {}) {
  return {
    itensPadReconhecidos: overrides.itensPadReconhecidos || [itemPad()],
    itensPadSemRateio: overrides.itensPadSemRateio || [],
    itensConhecidosAusentesNoPad: overrides.itensConhecidosAusentesNoPad || [],
    instrumentosNaoEncontradosNaCarteira: overrides.instrumentosNaoEncontradosNaCarteira || [],
    alertas: overrides.alertas || [],
    resumo: {
      totalItensPadConferidos: overrides.totalItensPadConferidos ?? 1,
      totalItensPadComRateio: overrides.totalItensPadComRateio ?? 1,
      totalItensPadSemRateio: overrides.totalItensPadSemRateio ?? 0,
      totalItensConhecidosAusentesNoPad: overrides.totalItensConhecidosAusentesNoPad ?? 0,
    },
  };
}

function rateiosMemoria(rateios = [{ area: "OUVIDORIA", natureza: "CUSTEIO", percentual_valor: 100, percentual_quantidade: 100 }]) {
  return new Map([[1, rateios]]);
}

function executar(opcoes = {}) {
  return carregarPadsOperacional({
    repoRoot: path.resolve(__dirname, "../.."),
    salvarRelatorio: false,
    lerRelatoriosPad: () => opcoes.leitura || leitura(),
    conferirItensPadComRateios: () => opcoes.conferencia || conferencia(),
    carregarMemoriaRateios: () => opcoes.rateios || rateiosMemoria(),
    gerarLinhasItem: opcoes.gerarLinhasItem || ((item, rateios) => ({
      linhas: [{
        numero: item.numeroConvenio,
        area: rateios[0].area,
        natureza: rateios[0].natureza,
        descricao: item.descricaoOriginal,
        valorPrevisto: item.valorTotalPrevisto,
        valorExecutado: item.valorTotalExecutado,
        baseRateioValor: "percentual",
        baseRateioQuantidade: "percentual",
      }],
      alertasItem: [],
      impedimentosItem: [],
    })),
  });
}

test("carregador operacional exige 15 arquivos lidos", () => {
  const resultado = executar({ leitura: leitura({ totalArquivosEncontrados: 14, totalRelatoriosLidos: 14 }) });

  assert.equal(resultado.arquivosEncontrados, 14);
  assert.ok(resultado.impedimentos.some((item) => item.tipo === "quantidade_arquivos_pad_invalida"));
  assert.ok(resultado.impedimentos.some((item) => item.tipo === "quantidade_relatorios_pad_lidos_invalida"));
});

test("instrumento duplicado gera impedimento", () => {
  const resultado = executar({
    leitura: leitura({
      alertas: [{
        tipo: "arquivo_duplicado_para_mesmo_instrumento",
        nivel: "impeditivo",
        instrumento: "900001",
        detalhe: "Instrumento duplicado.",
      }],
    }),
  });

  assert.ok(resultado.impedimentos.some((item) => item.tipo === "arquivo_duplicado_para_mesmo_instrumento"));
});

test("item novo sem rateio vira pendencia de revisao e nao impede a recarga", () => {
  const novo = itemPad({ itemConhecidoId: null, descricaoOriginal: "Item novo", chaveItem: "900001::item-novo" });
  const resultado = executar({
    conferencia: conferencia({
      itensPadReconhecidos: [],
      itensPadSemRateio: [novo],
      totalItensPadComRateio: 0,
      totalItensPadSemRateio: 1,
    }),
  });

  assert.equal(resultado.itensNovosSemRateio, 1);
  assert.equal(resultado.impedimentos.some((item) => item.tipo === "item_novo_sem_rateio_memorizado"), false);
  assert.ok(resultado.pendenciasRevisao.some((item) => item.tipo === "item_novo_sem_rateio_memorizado"));
  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.aptoParaPublicacao, false);
});

test("item_novo_sem_rateio_memorizado preserva quantidade, valor e natureza do PAD", () => {
  const novo = itemPad({
    itemConhecidoId: null,
    descricaoOriginal: "Computador Desktop completo",
    chaveItem: "900001::computador",
    quantidade: 2,
    valorUnitario: 6552.67,
    valorTotalPrevisto: 13105.34,
    natureza: "CAPITAL",
    codigoNaturezaDespesa: "44905200",
  });
  const resultado = executar({
    conferencia: conferencia({
      itensPadReconhecidos: [],
      itensPadSemRateio: [novo],
      totalItensPadComRateio: 0,
      totalItensPadSemRateio: 1,
    }),
  });

  const pendencia = resultado.pendenciasRevisao.find((i) => i.tipo === "item_novo_sem_rateio_memorizado");
  assert.ok(pendencia);
  assert.equal(pendencia.quantidade, 2);
  assert.equal(pendencia.valorUnitario, 6552.67);
  assert.equal(pendencia.valorTotalPrevisto, 13105.34);
  assert.equal(pendencia.natureza, "CAPITAL");
  assert.equal(pendencia.codigoNaturezaDespesa, "44905200");
  assert.equal(pendencia.descricao, "Computador Desktop completo");
});

test("item_pad_sem_rateio_memorizado vira pendencia de revisao preservando dados do PAD", () => {
  const item = itemPad({
    itemConhecidoId: 7,
    descricaoOriginal: "Curso de Edição de Vídeos",
    chaveItem: "900001::curso-edicao",
    quantidade: 1,
    valorUnitario: 14700,
    valorTotalPrevisto: 14700,
    natureza: "CUSTEIO",
    codigoNaturezaDespesa: "33903999",
  });
  const resultado = executar({
    rateios: new Map(),
    conferencia: conferencia({
      itensPadReconhecidos: [item],
      totalItensPadComRateio: 1,
    }),
  });

  assert.equal(resultado.impedimentos.some((i) => i.tipo === "item_pad_sem_rateio_memorizado"), false);
  const pendencia = resultado.pendenciasRevisao.find((i) => i.tipo === "item_pad_sem_rateio_memorizado");
  assert.ok(pendencia);
  assert.equal(pendencia.quantidade, 1);
  assert.equal(pendencia.valorUnitario, 14700);
  assert.equal(pendencia.natureza, "CUSTEIO");
  assert.equal(pendencia.codigoNaturezaDespesa, "33903999");
  assert.equal(resultado.sucesso, true);
});

test("item suprimido historico nao gera erro indevido e nao bloqueia recarga", () => {
  const resultado = executar({
    conferencia: conferencia({
      itensConhecidosAusentesNoPad: [{
        numeroConvenio: "900001",
        uf: "DF",
        descricaoOriginalReferencia: "Item antigo",
        chaveItem: "900001::item-antigo",
      }],
      totalItensConhecidosAusentesNoPad: 1,
    }),
  });

  assert.equal(resultado.itensSuprimidos, 1);
  assert.equal(resultado.impedimentos.some((item) => item.tipo === "item_suprimido_historico"), false);
  assert.ok(resultado.alertas.some((item) => item.tipo === "item_suprimido_historico"));
  assert.equal(resultado.sucesso, true);
});

test("rateio memorizado e aplicado", () => {
  const resultado = executar();

  assert.equal(resultado.rateiosAplicados, 1);
  assert.equal(resultado.linhasReconstruidas, 1);
  assert.equal(resultado.planoAplicacaoReconstruido[0].area, "OUVIDORIA");
});

test("distribuicao igual provisoria vira pendencia de revisao (nao impedimento tecnico)", () => {
  let geradorChamado = false;
  const resultado = executar({
    rateios: rateiosMemoria([{ area: "OUVIDORIA", natureza: "CUSTEIO" }]),
    gerarLinhasItem: () => {
      geradorChamado = true;
      return { linhas: [], alertasItem: [], impedimentosItem: [] };
    },
  });

  assert.equal(geradorChamado, false);
  assert.equal(resultado.impedimentos.some((item) => item.tipo === "rateio_memorizado_sem_peso_operacional"), false);
  assert.ok(resultado.pendenciasRevisao.some((item) => item.tipo === "rateio_memorizado_sem_peso_operacional"));
  assert.equal(resultado.sucesso, true);
});

test("cache invalido / contagem de arquivos divergente continua como impedimento tecnico", () => {
  const resultado = executar({ leitura: leitura({ totalArquivosEncontrados: 13, totalRelatoriosLidos: 13 }) });
  assert.ok(resultado.impedimentos.some((i) => i.tipo === "quantidade_arquivos_pad_invalida"));
  assert.equal(resultado.sucesso, false);
  assert.equal(resultado.aptoParaPublicacao, false);
});

test("sucesso tecnico nao implica em aptoParaPublicacao", () => {
  const resultado = executar();
  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.aptoParaPublicacao, false);
});

test("origem antiga, comparacao antiga e snapshot nao sao chamados pelo servico", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-carregador-operacional-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  assert.equal(source.includes("compararPlanosPadDryRun"), false);
  assert.equal(source.includes("compararSnapshotsPad"), false);
  assert.equal(source.includes("profor-pad-plano-comparador-service"), false);
  assert.equal(source.includes("profor-pad-comparador-snapshots-service"), false);
});
