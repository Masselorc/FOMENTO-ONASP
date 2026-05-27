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

test("pendenciasRevisao geram ITEM_NOVO na tela Revisoes PAD (ponte pos-febb8a4)", () => {
  const recarga = {
    dataHora: "2026-05-27T17:00:00.000Z",
    sucesso: true,
    planoAplicacaoReconstruido: [],
    impedimentos: [],
    alertas: [],
    pendenciasRevisao: [
      {
        tipo: "item_novo_sem_rateio_memorizado",
        nivel: "pendencia_revisao",
        numeroConvenio: "937221",
        uf: "AL",
        descricao: "Ar condicionado Split 60.000 BTUs (ESCOLA)",
        chaveItem: "937221::AR CONDICIONADO SPLIT 60.000 BTUS (ESCOLA)",
        detalhe: "Item PAD sem rateio memorizado (item_pad_nao_existe_na_memoria_rateio).",
        natureza: "CAPITAL",
        codigoNaturezaDespesa: "44905299",
        quantidade: 1,
        valorUnitario: 9501,
        valorTotalPrevisto: 9501,
      },
      {
        tipo: "item_novo_sem_rateio_memorizado",
        nivel: "pendencia_revisao",
        numeroConvenio: "937782",
        uf: "AC",
        descricao: "Notebook 4 núcleos 4.2ghz ram ddr 4 8gb",
        chaveItem: "937782::NOTEBOOK 4 NUCLEOS 4.2GHZ RAM DDR 4 8GB",
        detalhe: "Item PAD sem rateio memorizado.",
        natureza: "CAPITAL",
        codigoNaturezaDespesa: "44905200",
        quantidade: 2,
        valorUnitario: 3599.99,
        valorTotalPrevisto: 7199.98,
      },
    ],
  };

  const resultado = montarRevisoesPlanoPad({ recarga });

  const maeAl = (resultado.linhasMae.AL || []).find((l) => l.tipo === "ITEM_NOVO" && l.numeroConvenio === "937221");
  const maeAc = (resultado.linhasMae.AC || []).find((l) => l.tipo === "ITEM_NOVO" && l.numeroConvenio === "937782");

  assert.ok(maeAl, "esperava linha-mae ITEM_NOVO para 937221/AL");
  assert.ok(maeAc, "esperava linha-mae ITEM_NOVO para 937782/AC");
  assert.equal(maeAl.status, "ITEM_NOVO_SEM_RATEIO");
  assert.equal(maeAc.status, "ITEM_NOVO_SEM_RATEIO");
  assert.equal(maeAl.expandidoPorPadrao, true);
  assert.equal(maeAl.codigoNatureza, "44905299");
  assert.equal(maeAc.valorUnitario, 3599.99);

  assert.equal((resultado.pendencias.AL || []).length, 1);
  assert.equal((resultado.pendencias.AC || []).length, 1);
});

test("nao duplica ITEM_NOVO quando a mesma chave aparece em pendenciasRevisao e impedimentos", () => {
  const ocorrencia = {
    tipo: "item_novo_sem_rateio_memorizado",
    numeroConvenio: "900001",
    uf: "DF",
    descricao: "Drone novo",
    chaveItem: "900001::drone",
    natureza: "CAPITAL",
    codigoNaturezaDespesa: "449052",
    quantidade: 1,
    valorUnitario: 10000,
  };
  const recarga = {
    dataHora: "2026-05-27T17:00:00.000Z",
    sucesso: true,
    planoAplicacaoReconstruido: [],
    pendenciasRevisao: [ocorrencia],
    impedimentos: [ocorrencia],
    alertas: [],
  };

  const resultado = montarRevisoesPlanoPad({ recarga });
  const novos = (resultado.linhasMae.DF || []).filter((l) => l.tipo === "ITEM_NOVO");
  assert.equal(novos.length, 1, "esperava uma unica linha-mae ITEM_NOVO");
  assert.equal((resultado.pendencias.DF || []).length, 1);
});

test("compatibilidade preservada: impedimentos sozinhos ainda geram ITEM_NOVO", () => {
  const recarga = {
    dataHora: "2026-05-27T17:00:00.000Z",
    sucesso: true,
    planoAplicacaoReconstruido: [],
    impedimentos: [{
      tipo: "item_novo_sem_rateio_memorizado",
      uf: "DF",
      numeroConvenio: "900001",
      descricao: "Drone novo",
      chaveItem: "900001::drone",
      natureza: "CAPITAL",
      codigoNaturezaDespesa: "449052",
      quantidade: 1,
      valorUnitario: 10000,
    }],
    alertas: [],
  };
  const resultado = montarRevisoesPlanoPad({ recarga });
  const novos = (resultado.linhasMae.DF || []).filter((l) => l.tipo === "ITEM_NOVO");
  assert.equal(novos.length, 1);
});

test("itens ja materializados em planoAplicacaoReconstruido nao sao re-listados como ITEM_NOVO", () => {
  // Quando uma decisao foi promovida e o item passou a ter rateio ativo,
  // ele entra em planoAplicacaoReconstruido (linha-mae normal) e nao
  // aparece mais em pendenciasRevisao.
  const recarga = {
    dataHora: "2026-05-27T17:00:00.000Z",
    sucesso: true,
    planoAplicacaoReconstruido: [
      {
        uf: "AL",
        numero: "937221",
        area: "ESCOLA_PENAL",
        natureza: "CAPITAL",
        descricao: "Ar condicionado Split 60.000 BTUs (ESCOLA)",
        quantidade: 1,
        valorUnitario: 9501,
        valorPrevisto: 9501,
        origemReconstrucao: "memoria_rateio_operacional",
        chaveItem: "937221::AR CONDICIONADO SPLIT 60.000 BTUS (ESCOLA)",
        itemConhecidoId: 9999,
        codigoNaturezaDespesa: "44905299",
      },
    ],
    pendenciasRevisao: [],
    impedimentos: [],
    alertas: [],
  };
  const resultado = montarRevisoesPlanoPad({ recarga });
  const novos = (resultado.linhasMae.AL || []).filter((l) => l.tipo === "ITEM_NOVO");
  assert.equal(novos.length, 0);
  const linhasPad = (resultado.linhasMae.AL || []).filter((l) => l.tipo === "ITEM_PAD");
  assert.equal(linhasPad.length, 1);
});
