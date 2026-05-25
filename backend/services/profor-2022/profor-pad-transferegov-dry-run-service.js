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

function criarBloqueioTecnico(tipo, detalhe, dados = null) {
  return {
    tipo,
    detalhe,
    ...(dados ? { dados } : {}),
  };
}

function validarIntegridadeTecnicaPadAtual(extracao) {
  const bloqueios = [];
  const itens = extracao?.dados?.itens;
  if (!Array.isArray(itens) || itens.length === 0) {
    bloqueios.push(criarBloqueioTecnico("zero_itens_extraidos", "Nenhum item PAD foi extraído da fonte atual."));
    return bloqueios;
  }

  itens.forEach((item, indice) => {
    const contexto = { indice, descricao: item?.descricao || null };
    if (!String(item?.descricao || "").trim()) {
      bloqueios.push(criarBloqueioTecnico("item_sem_descricao", "Item extraído sem descrição.", contexto));
    }
    if (!String(item?.codigoNaturezaDespesa || "").trim()) {
      bloqueios.push(criarBloqueioTecnico("item_sem_codigo_natureza", "Item extraído sem código de natureza.", contexto));
    }
    if (!Number.isFinite(Number(item?.quantidade))) {
      bloqueios.push(criarBloqueioTecnico("quantidade_nao_parseavel", "Quantidade do item não é numérica.", contexto));
    }
    if (!Number.isFinite(Number(item?.valorTotalPrevisto))) {
      bloqueios.push(criarBloqueioTecnico("valor_total_previsto_nao_parseavel", "Valor total previsto do item não é numérico.", contexto));
    }
  });

  return bloqueios;
}

function resumoComparacao(instrumento, extracao, comparacao, relatorioExcel) {
  const bloqueiosTecnicos = validarIntegridadeTecnicaPadAtual(extracao);
  const aptoParaImportacaoTecnica = bloqueiosTecnicos.length === 0;
  const comparacaoHistoricaExcel = comparacao.comparacaoHistoricaExcel || {
    equivalenteHistorico: true,
    diferencas: [],
  };
  return {
    instrumento,
    origemUsada: extracao.origem,
    sucesso: true,
    aptoParaImportacaoTecnica,
    bloqueiosTecnicos,
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
    diferencasHistoricas: comparacaoHistoricaExcel.diferencas.length,
    atualizacoesDetectadas: comparacao.atualizacoesDetectadas.length,
    comparacaoHistoricaExcel,
    equivalenteHistorico: comparacaoHistoricaExcel.equivalenteHistorico,
    equivalente: aptoParaImportacaoTecnica,
    arquivoExcel: relatorioExcel?.arquivo || null,
  };
}

function montarResumoGeral(resultados, totalEsperado) {
  const extraidos = resultados.filter((resultado) => resultado.sucesso);
  const comFalhaTecnica = resultados.filter((resultado) => !resultado.sucesso || resultado.aptoParaImportacaoTecnica === false);
  const aptos = extraidos.filter((resultado) => resultado.aptoParaImportacaoTecnica === true);
  const comAtualizacoes = extraidos.filter((resultado) => (resultado.atualizacoesDetectadas || 0) > 0);
  const comDiferencaHistorica = extraidos.filter((resultado) => resultado.comparacaoHistoricaExcel?.equivalenteHistorico === false);
  return {
    totalConveniosEsperados: totalEsperado,
    totalConveniosExtraidos: extraidos.length,
    totalConveniosComFalha: comFalhaTecnica.length,
    totalConveniosEquivalentes: aptos.length,
    totalConveniosComDivergenciaCritica: 0,
    totalFalhasTecnicas: comFalhaTecnica.length,
    totalAptosParaImportacaoTecnica: aptos.length,
    totalComAtualizacoesDetectadas: comAtualizacoes.length,
    totalComDiferencaHistoricaExcel: comDiferencaHistorica.length,
    bloqueiosTecnicos: comFalhaTecnica.flatMap((resultado) => resultado.bloqueiosTecnicos || resultado.errosTecnicos || []),
    aptoParaImportacaoTecnica: comFalhaTecnica.length === 0,
    aptoParaCacheTransferegov: comFalhaTecnica.length === 0,
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
        const bloqueiosTecnicos = (extracao.erros || []).map((erro) => criarBloqueioTecnico(
          erro.codigo || "falha_extracao_transferegov",
          erro.mensagem || "Falha técnica na extração PAD Transferegov.",
          { origem: erro.origem || extracao.origem || "falhou" }
        ));
        resultados.push({
          instrumento,
          origemUsada: extracao.origem || "falhou",
          sucesso: false,
          errosTecnicos: extracao.erros || [],
          aptoParaImportacaoTecnica: false,
          bloqueiosTecnicos,
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
      const bloqueio = criarBloqueioTecnico("erro_interno_dry_run", erro?.message || String(erro));
      resultados.push({
        instrumento,
        origemUsada: "falhou",
        sucesso: false,
        errosTecnicos: [{
          origem: "dry-run",
          mensagem: erro?.message || String(erro),
        }],
        aptoParaImportacaoTecnica: false,
        bloqueiosTecnicos: [bloqueio],
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
