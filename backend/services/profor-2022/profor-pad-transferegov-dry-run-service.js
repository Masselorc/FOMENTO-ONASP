const fs = require("node:fs");
const path = require("node:path");

const {
  extrairPadTransferegov,
} = require("./profor-pad-transferegov-extracao-service");
const {
  compararPadTransferegovComExcel,
} = require("./profor-pad-transferegov-comparacao-service");

const CAMINHO_REFERENCIA_RELATIVO = "backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json";

function lerJson(caminho) {
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

function carregarReferenciaPadExcel(repoRoot, caminhoRelativo = CAMINHO_REFERENCIA_RELATIVO) {
  const caminho = path.join(repoRoot, caminhoRelativo);
  const referencia = lerJson(caminho);
  return {
    caminhoRelativo,
    relatorios: Array.isArray(referencia.relatorios) ? referencia.relatorios : [],
    itens: Array.isArray(referencia.itens) ? referencia.itens : [],
    resumo: referencia.resumo || {},
  };
}

function selecionarConvenios(referencia, opcoes = {}) {
  let convenios = (referencia.relatorios || [])
    .map((relatorio) => String(relatorio.codigoInstrumento || relatorio.aba || "").trim())
    .filter(Boolean);
  convenios = [...new Set(convenios)];
  if (opcoes.convenio) {
    convenios = convenios.filter((instrumento) => instrumento === String(opcoes.convenio));
  }
  if (opcoes.limite) {
    convenios = convenios.slice(0, Number(opcoes.limite));
  }
  return convenios;
}

function itensExcelPorConvenio(referencia, instrumento) {
  return (referencia.itens || []).filter((item) => String(item.instrumento || "") === String(instrumento));
}

function resumoComparacao(instrumento, extracao, comparacao, relatorioExcel) {
  return {
    instrumento,
    origemUsada: extracao.origem,
    sucesso: true,
    totalItensTransferegov: comparacao.totaisTransferegov.totalItens,
    totalItensExcel: comparacao.totaisExcel.totalItens,
    totalPrevistoTransferegov: comparacao.totaisTransferegov.valorTotalPrevisto,
    totalPrevistoExcel: comparacao.totaisExcel.valorTotalPrevisto,
    totalExecutadoTransferegov: comparacao.totaisTransferegov.valorTotalExecutado,
    totalExecutadoExcel: comparacao.totaisExcel.valorTotalExecutado,
    saldoTransferegov: comparacao.totaisTransferegov.saldo,
    saldoExcel: comparacao.totaisExcel.saldo,
    divergenciasCriticas: comparacao.divergenciasCriticas.length,
    divergenciasNaoCriticas: comparacao.divergenciasNaoCriticas.length,
    itensAusentesNoTransferegov: comparacao.itensAusentesNoTransferegov.length,
    itensAusentesNoExcel: comparacao.itensAusentesNoExcel.length,
    itensComValorDivergente: comparacao.itensComValorDivergente.length,
    itensComQuantidadeDivergente: comparacao.itensComQuantidadeDivergente.length,
    itensComCodigoNaturezaDivergente: comparacao.itensComCodigoNaturezaDivergente.length,
    equivalente: comparacao.equivalente,
    arquivoExcel: relatorioExcel?.arquivo || null,
  };
}

function montarResumoGeral(resultados, totalEsperado) {
  const extraidos = resultados.filter((resultado) => resultado.sucesso);
  const comFalha = resultados.filter((resultado) => !resultado.sucesso);
  const equivalentes = extraidos.filter((resultado) => resultado.equivalente);
  const comDivergenciaCritica = extraidos.filter((resultado) => resultado.divergenciasCriticas > 0);
  return {
    totalConveniosEsperados: totalEsperado,
    totalConveniosExtraidos: extraidos.length,
    totalConveniosComFalha: comFalha.length,
    totalConveniosEquivalentes: equivalentes.length,
    totalConveniosComDivergenciaCritica: comDivergenciaCritica.length,
    aptoParaCacheTransferegov: comFalha.length === 0 && comDivergenciaCritica.length === 0,
  };
}

async function executarDryRunPadsTransferegov(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const referencia = opcoes.referencia || carregarReferenciaPadExcel(repoRoot);
  const convenios = selecionarConvenios(referencia, opcoes);
  const extrair = opcoes.extrairPad || extrairPadTransferegov;
  const resultados = [];

  for (const instrumento of convenios) {
    const relatorioExcel = (referencia.relatorios || []).find((relatorio) => String(relatorio.codigoInstrumento) === instrumento);
    try {
      const extracao = await extrair(instrumento, {
        fallbackPlaywright: Boolean(opcoes.fallbackPlaywright),
      });
      if (!extracao.sucesso) {
        resultados.push({
          instrumento,
          origemUsada: extracao.origem || "falhou",
          sucesso: false,
          errosTecnicos: extracao.erros || [],
          arquivoExcel: relatorioExcel?.arquivo || null,
        });
        continue;
      }

      const comparacao = compararPadTransferegovComExcel({
        instrumento,
        itensTransferegov: extracao.dados.itens,
        itensExcel: itensExcelPorConvenio(referencia, instrumento),
      });
      resultados.push({
        ...resumoComparacao(instrumento, extracao, comparacao, relatorioExcel),
        comparacao,
        diagnosticoExtracao: extracao.diagnostico || null,
      });
    } catch (erro) {
      resultados.push({
        instrumento,
        origemUsada: "falhou",
        sucesso: false,
        errosTecnicos: [{
          origem: "dry-run",
          mensagem: erro?.message || String(erro),
        }],
        arquivoExcel: relatorioExcel?.arquivo || null,
      });
    }
  }

  return {
    dataHora: new Date().toISOString(),
    origem: "transferegov-http-dry-run",
    fallbackPlaywrightHabilitado: Boolean(opcoes.fallbackPlaywright),
    referenciaExcel: referencia.caminhoRelativo || CAMINHO_REFERENCIA_RELATIVO,
    resumo: montarResumoGeral(resultados, convenios.length),
    resultados,
  };
}

module.exports = {
  CAMINHO_REFERENCIA_RELATIVO,
  carregarReferenciaPadExcel,
  executarDryRunPadsTransferegov,
  selecionarConvenios,
};
