const fs = require("node:fs");
const path = require("node:path");

const {
  normalizarItemPadPublico,
} = require("../services/profor-2022/profor-pad-transferegov-parser");
const {
  extrairPadTransferegov,
} = require("../services/profor-2022/profor-pad-transferegov-extracao-service");
const {
  lerRelatorioPad,
} = require("../services/profor-2022/profor-pad-report-reader");

const INSTRUMENTO = "937782";
const TOTAL_ESPERADO = {
  totalItens: 34,
  valorTotalPrevisto: 396423.71,
  valorTotalExecutado: 97141.55,
  saldo: 299282.16,
};
const CAMINHO_EXCEL_RELATIVO = "Planilhas/profor-2022/instrumentos/RelatorioItensDespesasPAD_2026_05_20-13_52677604170748071673.xls";
const CAMINHO_SAIDA_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-poc-937782.json";
const TOLERANCIA = 0.01;
const USAR_FALLBACK_PLAYWRIGHT = process.argv.includes("--fallback-playwright");

function arredondar(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function somar(itens, campo) {
  return arredondar((itens || []).reduce((total, item) => total + (Number(item[campo]) || 0), 0));
}

function totaisDeItens(itens) {
  return {
    totalItens: itens.length,
    valorTotalPrevisto: somar(itens, "valorTotalPrevisto"),
    valorTotalExecutado: somar(itens, "valorTotalExecutado"),
    saldo: somar(itens, "saldo"),
  };
}

function normalizarItensExcel(itens, instrumento) {
  return (itens || [])
    .filter((item) => String(item.instrumento || "") === String(instrumento))
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
      textoOriginal: item.descricao,
    }, instrumento));
}

function compararNumero(a, b) {
  return Math.abs(arredondar(a) - arredondar(b)) <= TOLERANCIA;
}

function chaveMaterial(item) {
  return [
    item.codigoNaturezaNormalizado,
    item.descricaoNormalizada,
    item.quantidade.toFixed(6),
    item.valorUnitario.toFixed(2),
  ].join("|");
}

function agruparPorChave(itens, montarChave) {
  const mapa = new Map();
  for (const item of itens) {
    const chave = montarChave(item);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(item);
  }
  return mapa;
}

function compararItens(transferegov, excel) {
  const divergencias = [];
  const mapaExcelHash = agruparPorChave(excel, (item) => item.hashItem);
  const hashesTransferegov = new Set(transferegov.map((item) => item.hashItem));

  for (const item of transferegov) {
    const grupo = mapaExcelHash.get(item.hashItem);
    if (grupo?.length) {
      grupo.shift();
      continue;
    }
    divergencias.push({
      tipo: "item_transferegov_sem_equivalente_exato_excel",
      hashItem: item.hashItem,
      descricao: item.descricao,
      codigoNaturezaDespesa: item.codigoNaturezaDespesa,
    });
  }

  for (const item of excel) {
    if (hashesTransferegov.has(item.hashItem)) continue;
    divergencias.push({
      tipo: "item_excel_sem_equivalente_exato_transferegov",
      hashItem: item.hashItem,
      descricao: item.descricao,
      codigoNaturezaDespesa: item.codigoNaturezaDespesa,
    });
  }

  const porMaterialTransferegov = agruparPorChave(transferegov, chaveMaterial);
  const porMaterialExcel = agruparPorChave(excel, chaveMaterial);
  for (const [chave, itensTransferegov] of porMaterialTransferegov.entries()) {
    const itensExcel = porMaterialExcel.get(chave) || [];
    if (itensTransferegov.length !== itensExcel.length) continue;
    for (let i = 0; i < itensTransferegov.length; i += 1) {
      const a = itensTransferegov[i];
      const b = itensExcel[i];
      for (const campo of ["valorTotalPrevisto", "valorTotalExecutado", "saldo"]) {
        if (!compararNumero(a[campo], b[campo])) {
          divergencias.push({
            tipo: "campo_material_divergente",
            campo,
            descricao: a.descricao,
            transferegov: a[campo],
            excel: b[campo],
          });
        }
      }
    }
  }

  return divergencias;
}

function validarTotaisEsperados(totais) {
  const divergencias = [];
  if (totais.totalItens !== TOTAL_ESPERADO.totalItens) {
    divergencias.push({ campo: "totalItens", esperado: TOTAL_ESPERADO.totalItens, obtido: totais.totalItens });
  }
  for (const campo of ["valorTotalPrevisto", "valorTotalExecutado", "saldo"]) {
    if (!compararNumero(totais[campo], TOTAL_ESPERADO[campo])) {
      divergencias.push({ campo, esperado: TOTAL_ESPERADO[campo], obtido: totais[campo] });
    }
  }
  return divergencias;
}

function imprimirResumo(comparacao) {
  console.log(`totalItensTransferegov=${comparacao.totalItensTransferegov}`);
  console.log(`totalItensExcel=${comparacao.totalItensExcel}`);
  console.log(`totalPrevistoTransferegov=${comparacao.totalPrevistoTransferegov}`);
  console.log(`totalPrevistoExcel=${comparacao.totalPrevistoExcel}`);
  console.log(`totalExecutadoTransferegov=${comparacao.totalExecutadoTransferegov}`);
  console.log(`totalExecutadoExcel=${comparacao.totalExecutadoExcel}`);
  console.log(`saldoTransferegov=${comparacao.saldoTransferegov}`);
  console.log(`saldoExcel=${comparacao.saldoExcel}`);
  console.log(`divergenciasCriticas=${comparacao.divergenciasCriticas}`);
  console.log(`vereditoEquivalente=${comparacao.equivalente ? "sim" : "nao"}`);
}

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoExcel = path.join(repoRoot, CAMINHO_EXCEL_RELATIVO);
  const caminhoSaida = path.join(repoRoot, CAMINHO_SAIDA_RELATIVO);

  const extracao = await extrairPadTransferegov(INSTRUMENTO, {
    fallbackPlaywright: USAR_FALLBACK_PLAYWRIGHT,
  });
  if (!extracao.sucesso) {
    const detalhe = (extracao.erros || []).map((erro) => `${erro.origem}: ${erro.mensagem}`).join(" | ");
    throw new Error(`Extração PAD Transferegov falhou. ${detalhe}`);
  }
  const padTransferegov = extracao.dados;
  const relatorioExcel = lerRelatorioPad(caminhoExcel, repoRoot);
  const itensExcel = normalizarItensExcel(relatorioExcel.itens, INSTRUMENTO);

  const totaisTransferegov = totaisDeItens(padTransferegov.itens);
  const totaisExcel = totaisDeItens(itensExcel);
  const divergenciasItens = compararItens(padTransferegov.itens, itensExcel);
  const divergenciasTotaisEsperados = validarTotaisEsperados(totaisTransferegov);
  const divergenciasTotaisExcel = [];
  for (const campo of ["totalItens", "valorTotalPrevisto", "valorTotalExecutado", "saldo"]) {
    if (campo === "totalItens") {
      if (totaisTransferegov[campo] !== totaisExcel[campo]) divergenciasTotaisExcel.push({ campo, transferegov: totaisTransferegov[campo], excel: totaisExcel[campo] });
    } else if (!compararNumero(totaisTransferegov[campo], totaisExcel[campo])) {
      divergenciasTotaisExcel.push({ campo, transferegov: totaisTransferegov[campo], excel: totaisExcel[campo] });
    }
  }

  const divergenciasCriticas = [
    ...divergenciasItens,
    ...divergenciasTotaisEsperados.map((item) => ({ tipo: "total_transferegov_diverge_do_esperado_manual", ...item })),
    ...divergenciasTotaisExcel.map((item) => ({ tipo: "total_transferegov_diverge_do_excel", ...item })),
  ];
  const comparacao = {
    dataHora: new Date().toISOString(),
    instrumento: INSTRUMENTO,
    origemTransferegov: extracao.origem,
    origemExcel: CAMINHO_EXCEL_RELATIVO,
    totalItensTransferegov: totaisTransferegov.totalItens,
    totalItensExcel: totaisExcel.totalItens,
    totalPrevistoTransferegov: totaisTransferegov.valorTotalPrevisto,
    totalPrevistoExcel: totaisExcel.valorTotalPrevisto,
    totalExecutadoTransferegov: totaisTransferegov.valorTotalExecutado,
    totalExecutadoExcel: totaisExcel.valorTotalExecutado,
    saldoTransferegov: totaisTransferegov.saldo,
    saldoExcel: totaisExcel.saldo,
    divergenciasCriticas: divergenciasCriticas.length,
    equivalente: divergenciasCriticas.length === 0,
  };

  const saida = {
    comparacao,
    diagnosticoExtracao: extracao.diagnostico,
    totaisEsperadosManuais: TOTAL_ESPERADO,
    divergenciasCriticas,
    itensTransferegov: padTransferegov.itens,
    itensExcel,
  };

  fs.mkdirSync(path.dirname(caminhoSaida), { recursive: true });
  fs.writeFileSync(caminhoSaida, `${JSON.stringify(saida, null, 2)}\n`, "utf8");
  imprimirResumo(comparacao);
  console.log(`saidaJson=${CAMINHO_SAIDA_RELATIVO}`);
}

executar().catch((erro) => {
  console.error("Falha na POC HTTP PAD Transferegov 937782.");
  console.error(erro?.message || erro);
  process.exit(1);
});
