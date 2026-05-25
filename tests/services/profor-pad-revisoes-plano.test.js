const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  montarRevisoesPlanoPad,
} = require("../../backend/services/profor-2022/profor-pad-revisoes-plano-service");

function recargaBase() {
  return {
    dataHora: "2026-05-25T10:00:00.000Z",
    sucesso: true,
    planoAplicacaoReconstruido: [
      {
        uf: "DF",
        numero: "900001",
        area: "OUVIDORIA",
        natureza: "CUSTEIO",
        descricao: "Notebook operacional",
        quantidade: 6,
        valorUnitario: 3000,
        valorPrevisto: 18000,
        origemReconstrucao: "memoria_rateio_operacional",
        chaveItem: "900001::notebook",
        itemConhecidoId: 1,
        codigoNaturezaDespesa: "339030",
      },
      {
        uf: "DF",
        numero: "900001",
        area: "CORREGEDORIA",
        natureza: "CUSTEIO",
        descricao: "Notebook operacional",
        quantidade: 4,
        valorUnitario: 3000,
        valorPrevisto: 12000,
        origemReconstrucao: "memoria_rateio_operacional",
        chaveItem: "900001::notebook",
        itemConhecidoId: 1,
        codigoNaturezaDespesa: "339030",
      },
      {
        uf: "AC",
        numero: "900002",
        area: "N/A",
        natureza: "CAPITAL",
        descricao: "Saldo residual de capital",
        quantidade: 1,
        valorUnitario: 5000,
        valorPrevisto: 5000,
        origemReconstrucao: "saldo-residual-tecnico",
        chaveItem: "900002::saldo",
        itemConhecidoId: 2,
        codigoNaturezaDespesa: "449052",
        saldoResidualTecnico: true,
      },
    ],
    impedimentos: [
      {
        tipo: "item_novo_sem_rateio_memorizado",
        uf: "DF",
        numeroConvenio: "900001",
        descricao: "Drone novo",
        natureza: "CAPITAL",
        codigoNaturezaDespesa: "449052",
        quantidade: 1,
        valorUnitario: 10000,
        chaveItem: "900001::drone",
        detalhe: "Item PAD sem rateio memorizado.",
      },
    ],
    alertas: [
      {
        tipo: "item_suprimido_historico",
        uf: "DF",
        numeroConvenio: "900001",
        descricao: "Item antigo suprimido",
        natureza: "CUSTEIO",
        codigoNaturezaDespesa: "339039",
        chaveItem: "900001::antigo",
        detalhe: "Item da memória não veio no PAD atual.",
      },
    ],
  };
}

test("estrutura revisoes PAD por UF", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });

  assert.deepEqual(resultado.ufs, ["AC", "DF"]);
  assert.ok(resultado.resumoPorUf.DF);
  assert.ok(Array.isArray(resultado.linhasMae.DF));
  assert.ok(Array.isArray(resultado.linhasFilhas.DF));
  assert.ok(Array.isArray(resultado.pendencias.DF));
});

test("linhas OK iniciam recolhidas e pendentes iniciam expandidas", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });
  const ok = resultado.linhasMae.DF.find((linha) => linha.descricao === "Notebook operacional");
  const pendente = resultado.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const suprimido = resultado.linhasMae.DF.find((linha) => linha.tipo === "ITEM_SUPRIMIDO");

  assert.equal(ok.expandidoPorPadrao, false);
  assert.equal(pendente.expandidoPorPadrao, true);
  assert.equal(suprimido.expandidoPorPadrao, false);
});

test("linhas-filhas ficam agrupadas sob a linha-mae", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });
  const mae = resultado.linhasMae.DF.find((linha) => linha.descricao === "Notebook operacional");

  assert.ok(mae);
  assert.equal(mae.filhos.length, 2);
  assert.equal(resultado.linhasFilhas.DF.filter((linha) => linha.parentId === mae.id).length, 2);
});

test("item novo sem rateio aparece como pendencia sem rateio inventado", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });
  const mae = resultado.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = resultado.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);

  assert.equal(mae.status, "ITEM_NOVO_SEM_RATEIO");
  assert.equal(filha.area, "NAO_CLASSIFICADO");
  assert.equal(filha.origem, "PENDENCIA_OPERACIONAL");
  assert.ok(resultado.pendencias.DF.some((item) => item.tipo === "item_novo_sem_rateio_memorizado"));
});

test("item suprimido aparece como historico", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });
  const mae = resultado.linhasMae.DF.find((linha) => linha.tipo === "ITEM_SUPRIMIDO");

  assert.ok(mae);
  assert.equal(mae.status, "ITEM_SUPRIMIDO_HISTORICO");
});

test("nenhuma origem antiga e chamada pelo servico", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-revisoes-plano-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  assert.equal(source.includes("compararPlanosPadDryRun"), false);
  assert.equal(source.includes("gestao_financeira_ouvidoria"), false);
  assert.equal(source.includes("comparar-origens"), false);
});

test("mae e filha pendente preservam quantidade, valor e natureza do PAD", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });
  const mae = resultado.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = resultado.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);

  assert.equal(mae.quantidadeOriginal, 1);
  assert.equal(mae.valorUnitario, 10000);
  assert.equal(mae.valorTotalOriginal, 10000);
  assert.equal(mae.natureza, "CAPITAL");
  assert.equal(mae.codigoNatureza, "449052");
  assert.equal(mae.descricao, "Drone novo");

  assert.equal(filha.quantidade, 1);
  assert.equal(filha.valorUnitario, 10000);
  assert.equal(filha.valorTotal, 10000);
  assert.equal(filha.natureza, "CAPITAL");
  assert.equal(filha.codigoNatureza, "449052");
  assert.equal(filha.area, "NAO_CLASSIFICADO");
  assert.equal(filha.status, "AREA_NAO_CLASSIFICADA");
});

test("mae e filha pendente aceitam valorTotalPrevisto quando o impedimento usa esse nome", () => {
  const recarga = recargaBase();
  recarga.impedimentos = [{
    tipo: "item_pad_sem_rateio_memorizado",
    uf: "DF",
    numeroConvenio: "900001",
    descricao: "Computador Desktop completo",
    natureza: "CAPITAL",
    codigoNaturezaDespesa: "44905200",
    quantidade: 2,
    valorUnitario: 6552.67,
    valorTotalPrevisto: 13105.34,
    chaveItem: "900001::computador",
    detalhe: "Item PAD reconhecido, mas sem rateio ativo memorizado.",
  }];
  const resultado = montarRevisoesPlanoPad({ recarga });
  const mae = resultado.linhasMae.DF.find((linha) => linha.descricao === "Computador Desktop completo");
  assert.ok(mae);
  assert.equal(mae.quantidadeOriginal, 2);
  assert.equal(mae.valorUnitario, 6552.67);
  assert.equal(mae.valorTotalOriginal, 13105.34);
  assert.equal(mae.codigoNatureza, "44905200");
});

test("nenhum rateio e inventado", () => {
  const resultado = montarRevisoesPlanoPad({ recarga: recargaBase() });
  const nova = resultado.linhasFilhas.DF.find((linha) => linha.origem === "PENDENCIA_OPERACIONAL");

  assert.equal(nova.area, "NAO_CLASSIFICADO");
  assert.notEqual(nova.area, "OUVIDORIA");
  assert.notEqual(nova.area, "CORREGEDORIA");
  assert.notEqual(nova.area, "ESCOLA_PENAL");
});
