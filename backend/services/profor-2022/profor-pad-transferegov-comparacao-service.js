const {
  normalizarItemPadPublico,
} = require("./profor-pad-transferegov-parser");

const TOLERANCIA_MOEDA = 0.01;
const TOLERANCIA_QUANTIDADE = 0.000001;

function arredondarMoeda(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function arredondarQuantidade(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function numerosIguais(a, b, tolerancia = TOLERANCIA_MOEDA) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tolerancia;
}

function normalizarItensPadExcel(itens, instrumento) {
  return (itens || [])
    .filter((item) => String(item.instrumento || item.codigoInstrumento || "") === String(instrumento))
    .map((item) => normalizarItemPadPublico({
      tipoDespesa: item.tipoDespesa,
      descricao: item.descricao,
      codigoNaturezaDespesa: item.codigoNaturezaDespesa,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotalPrevisto: item.valorTotalPrevisto,
      valorTotalExecutado: item.valorTotalExecutado,
      saldo: item.saldo,
      textoOriginal: item.textoOriginal || item.descricao,
    }, instrumento));
}

function totaisDeItens(itens) {
  return {
    totalItens: (itens || []).length,
    valorTotalPrevisto: arredondarMoeda((itens || []).reduce((total, item) => total + Number(item.valorTotalPrevisto || 0), 0)),
    valorTotalExecutado: arredondarMoeda((itens || []).reduce((total, item) => total + Number(item.valorTotalExecutado || 0), 0)),
    saldo: arredondarMoeda((itens || []).reduce((total, item) => total + Number(item.saldo || 0), 0)),
  };
}

function chaveMaterial(item) {
  return [
    item.descricaoNormalizada,
    item.codigoNaturezaNormalizado,
  ].join("|");
}

function chaveDescricao(item) {
  return item.descricaoNormalizada || "";
}

function agrupar(itens, montarChave) {
  const mapa = new Map();
  for (const item of itens || []) {
    const chave = montarChave(item);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(item);
  }
  return mapa;
}

function ordenarItensComparacao(itens) {
  return [...(itens || [])].sort((a, b) => [
    a.codigoNaturezaNormalizado,
    a.descricaoNormalizada,
    String(arredondarQuantidade(a.quantidade).toFixed(6)),
    String(arredondarMoeda(a.valorUnitario).toFixed(2)),
    String(arredondarMoeda(a.valorTotalPrevisto).toFixed(2)),
  ].join("|").localeCompare([
    b.codigoNaturezaNormalizado,
    b.descricaoNormalizada,
    String(arredondarQuantidade(b.quantidade).toFixed(6)),
    String(arredondarMoeda(b.valorUnitario).toFixed(2)),
    String(arredondarMoeda(b.valorTotalPrevisto).toFixed(2)),
  ].join("|")));
}

function itemResumo(item) {
  return {
    descricao: item.descricao,
    descricaoNormalizada: item.descricaoNormalizada,
    codigoNaturezaDespesa: item.codigoNaturezaDespesa,
    codigoNaturezaNormalizado: item.codigoNaturezaNormalizado,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotalPrevisto: item.valorTotalPrevisto,
    valorTotalExecutado: item.valorTotalExecutado,
    saldo: item.saldo,
  };
}

function compararTotais(totaisTransferegov, totaisExcel) {
  const divergencias = [];
  if (totaisTransferegov.totalItens !== totaisExcel.totalItens) {
    divergencias.push({
      tipo: "total_itens_divergente",
      campo: "totalItens",
      transferegov: totaisTransferegov.totalItens,
      excel: totaisExcel.totalItens,
    });
  }
  for (const campo of ["valorTotalPrevisto", "valorTotalExecutado", "saldo"]) {
    if (!numerosIguais(totaisTransferegov[campo], totaisExcel[campo])) {
      divergencias.push({
        tipo: `total_${campo}_divergente`,
        campo,
        transferegov: totaisTransferegov[campo],
        excel: totaisExcel[campo],
      });
    }
  }
  return divergencias;
}

function compararPorItens(itensTransferegov, itensExcel) {
  const itensAusentesNoTransferegov = [];
  const itensAusentesNoExcel = [];
  const itensComValorDivergente = [];
  const itensComQuantidadeDivergente = [];
  const itensComCodigoNaturezaDivergente = [];
  const porMaterialTransferegov = agrupar(itensTransferegov, chaveMaterial);
  const porMaterialExcel = agrupar(itensExcel, chaveMaterial);
  const chaves = new Set([...porMaterialTransferegov.keys(), ...porMaterialExcel.keys()]);

  for (const chave of chaves) {
    const grupoTransferegov = ordenarItensComparacao(porMaterialTransferegov.get(chave) || []);
    const grupoExcel = ordenarItensComparacao(porMaterialExcel.get(chave) || []);
    const pares = Math.min(grupoTransferegov.length, grupoExcel.length);

    for (let i = pares; i < grupoTransferegov.length; i += 1) {
      itensAusentesNoExcel.push(itemResumo(grupoTransferegov[i]));
    }
    for (let i = pares; i < grupoExcel.length; i += 1) {
      itensAusentesNoTransferegov.push(itemResumo(grupoExcel[i]));
    }
    for (let i = 0; i < pares; i += 1) {
      const itemTransferegov = grupoTransferegov[i];
      const itemExcel = grupoExcel[i];
      if (!numerosIguais(itemTransferegov.quantidade, itemExcel.quantidade, TOLERANCIA_QUANTIDADE)) {
        itensComQuantidadeDivergente.push({
          descricao: itemTransferegov.descricao,
          transferegov: itemTransferegov.quantidade,
          excel: itemExcel.quantidade,
        });
      }
      for (const campo of ["valorUnitario", "valorTotalPrevisto", "valorTotalExecutado", "saldo"]) {
        if (!numerosIguais(itemTransferegov[campo], itemExcel[campo])) {
          itensComValorDivergente.push({
            campo,
            descricao: itemTransferegov.descricao,
            transferegov: itemTransferegov[campo],
            excel: itemExcel[campo],
          });
        }
      }
    }
  }

  const porDescricaoTransferegov = agrupar(itensTransferegov, chaveDescricao);
  const porDescricaoExcel = agrupar(itensExcel, chaveDescricao);
  for (const [descricao, grupoTransferegov] of porDescricaoTransferegov.entries()) {
    const codigosTransferegov = new Set(grupoTransferegov.map((item) => item.codigoNaturezaNormalizado));
    const codigosExcel = new Set((porDescricaoExcel.get(descricao) || []).map((item) => item.codigoNaturezaNormalizado));
    if (!codigosExcel.size) continue;
    for (const codigo of codigosTransferegov) {
      if (!codigosExcel.has(codigo)) {
        itensComCodigoNaturezaDivergente.push({
          descricao,
          codigoTransferegov: codigo,
          codigosExcel: [...codigosExcel],
        });
      }
    }
  }

  return {
    itensAusentesNoTransferegov,
    itensAusentesNoExcel,
    itensComValorDivergente,
    itensComQuantidadeDivergente,
    itensComCodigoNaturezaDivergente,
  };
}

function compararPadTransferegovComExcel({ instrumento, itensTransferegov, itensExcel }) {
  const itensExcelNormalizados = normalizarItensPadExcel(itensExcel, instrumento);
  const itensTransferegovNormalizados = (itensTransferegov || []).map((item) => normalizarItemPadPublico(item, instrumento));
  const totaisTransferegov = totaisDeItens(itensTransferegovNormalizados);
  const totaisExcel = totaisDeItens(itensExcelNormalizados);
  const divergenciasTotais = compararTotais(totaisTransferegov, totaisExcel);
  const divergenciasItens = compararPorItens(itensTransferegovNormalizados, itensExcelNormalizados);
  const divergenciasCriticas = [
    ...divergenciasTotais,
    ...divergenciasItens.itensAusentesNoTransferegov.map((item) => ({ tipo: "item_ausente_no_transferegov", item })),
    ...divergenciasItens.itensAusentesNoExcel.map((item) => ({ tipo: "item_ausente_no_excel", item })),
    ...divergenciasItens.itensComValorDivergente.map((item) => ({ tipo: "valor_item_divergente", ...item })),
    ...divergenciasItens.itensComQuantidadeDivergente.map((item) => ({ tipo: "quantidade_item_divergente", ...item })),
    ...divergenciasItens.itensComCodigoNaturezaDivergente.map((item) => ({ tipo: "codigo_natureza_item_divergente", ...item })),
  ];

  return {
    instrumento: String(instrumento),
    totaisTransferegov,
    totaisExcel,
    divergenciasCriticas,
    divergenciasNaoCriticas: [],
    ...divergenciasItens,
    equivalente: divergenciasCriticas.length === 0,
  };
}

module.exports = {
  compararPadTransferegovComExcel,
  normalizarItensPadExcel,
  totaisDeItens,
};
