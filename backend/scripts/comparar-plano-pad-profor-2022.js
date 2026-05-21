const path = require("node:path");

const { inicializarBanco } = require("../db/init-db");
const {
  CAMINHO_RELATORIO_RECONSTRUCAO,
  reconstruirPlanoAplicacaoPadDryRun,
  salvarRelatorioReconstrucao,
} = require("../services/profor-2022/profor-pad-plano-reconstrucao-service");
const {
  CAMINHO_RELATORIO_COMPARACAO_JSON,
  CAMINHO_RELATORIO_COMPARACAO_MD,
  compararPlanosPadDryRun,
  salvarRelatorioComparacao,
} = require("../services/profor-2022/profor-pad-plano-comparador-service");
const {
  carregarAplicacaoDecisoesDryRun,
} = require("../services/profor-2022/profor-pad-decisao-aplicacao-service");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(resultado, arquivoJson, arquivoMarkdown) {
  const { resumo, totaisAntigoNovo, diferencaTotal } = resultado;

  console.log("Dry-run de comparação planoAplicacao antigo × reconstruído PAD PROFOR 2022");
  console.log(`Saida JSON: ${arquivoJson}`);
  console.log(`Saida MD: ${arquivoMarkdown}`);
  console.log(`Linhas origem antiga: ${resumo.totalLinhasAntigo}`);
  console.log(`Linhas reconstruídas (PAD): ${resumo.totalLinhasNovo}`);
  console.log(`Itens iguais: ${resumo.totalItensIguais}`);
  console.log(`Itens novos: ${resumo.totalItensNovos}`);
  console.log(`Itens ausentes: ${resumo.totalItensAusentes}`);
  console.log(`Quantidade divergente: ${resumo.totalItensQuantidadeDivergente}`);
  console.log(`Valor previsto divergente: ${resumo.totalItensValorPrevistoDivergente}`);
  console.log(`Valor executado divergente: ${resumo.totalItensValorExecutadoDivergente}`);
  console.log(`Saldo divergente: ${resumo.totalItensSaldoDivergente}`);
  console.log(`Área divergente: ${resumo.totalItensAreaDivergente}`);
  console.log(`Natureza divergente: ${resumo.totalItensNaturezaDivergente}`);
  console.log(`Itens ambíguos: ${resumo.totalItensAmbiguos}`);
  console.log(`Diferenças críticas: ${resumo.totalDiferencasCriticas}`);
  console.log(`Avisos: ${resumo.totalAvisos}`);
  console.log(`Diferenças esperadas por atualização PAD: ${resumo.totalDiferencasEsperadasPorAtualizacaoPad}`);
  console.log(`Diferenças por pendência de decisão: ${resumo.totalDiferencasPorPendenciaDeDecisao}`);
  console.log(`Diferenças saneadas por decisão (dry-run): ${resumo.totalDiferencasSaneadasPorDecisao}`);
  console.log(`Ausências confirmadas por decisão (dry-run): ${resumo.totalAusenciasConfirmadasPorDecisao}`);
  console.log(`Decisões resolutivas encontradas: ${resumo.totalDecisoesResolutivasEncontradas}`);
  console.log(`Decisões interpretadas em dry-run: ${resumo.totalDecisoesInterpretadasDryRun}`);
  console.log(`  com efeito na reconstrução: ${resumo.totalDecisoesComEfeitoNaReconstrucao}`);
  console.log(`  sem efeito na reconstrução: ${resumo.totalDecisoesSemEfeitoNaReconstrucao}`);
  console.log(`Decisões não aplicáveis: ${resumo.totalDecisoesNaoAplicaveis}`);
  console.log(
    `Totais — antigo: previsto ${totaisAntigoNovo.antigo.valorPrevisto}, `
    + `executado ${totaisAntigoNovo.antigo.valorExecutado}, saldo ${totaisAntigoNovo.antigo.saldo}`
  );
  console.log(
    `Totais — novo: previsto ${totaisAntigoNovo.novo.valorPrevisto}, `
    + `executado ${totaisAntigoNovo.novo.valorExecutado}, saldo ${totaisAntigoNovo.novo.saldo}`
  );
  console.log(
    `Diferença total: previsto ${diferencaTotal.valorPrevisto}, `
    + `executado ${diferencaTotal.valorExecutado}, saldo ${diferencaTotal.saldo}`
  );
  console.log(`Apto para ativação: ${resultado.aptoParaAtivacao ? "sim" : "não"}`);
  console.log(`Apto para publicação: ${resultado.aptoParaPublicacao ? "sim" : "não"}`);
  for (const linha of resultado.conclusaoOperacional) {
    console.log(`- ${linha}`);
  }
}

function executar() {
  inicializarBanco();
  const repoRoot = path.resolve(__dirname, "../..");

  // Carrega o motor de decisões uma única vez e o compartilha entre a
  // reconstrução e o comparador, garantindo coerência na mesma rodada.
  const aplicacaoDecisoes = carregarAplicacaoDecisoesDryRun();

  // Executa a reconstrução dry-run e também a salva, para manter os dois
  // relatórios coerentes na mesma rodada.
  const reconstrucao = reconstruirPlanoAplicacaoPadDryRun({ repoRoot, aplicacaoDecisoes });
  const caminhoReconstrucao = path.join(repoRoot, CAMINHO_RELATORIO_RECONSTRUCAO);
  salvarRelatorioReconstrucao(reconstrucao, caminhoReconstrucao);

  const resultado = compararPlanosPadDryRun({ repoRoot, reconstrucao, aplicacaoDecisoes });
  const caminhoJson = path.join(repoRoot, CAMINHO_RELATORIO_COMPARACAO_JSON);
  const caminhoMarkdown = path.join(repoRoot, CAMINHO_RELATORIO_COMPARACAO_MD);
  salvarRelatorioComparacao(resultado, caminhoJson, caminhoMarkdown);

  imprimirResumo(
    resultado,
    caminhoRelativo(repoRoot, caminhoJson),
    caminhoRelativo(repoRoot, caminhoMarkdown)
  );
}

try {
  executar();
} catch (erro) {
  console.error("Falha na comparação dry-run do planoAplicacao PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}
