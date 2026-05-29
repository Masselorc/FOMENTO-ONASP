const path = require("node:path");

const { inicializarBanco } = require("../db/init-db");
const {
  CAMINHO_RELATORIO_RECONSTRUCAO,
  reconstruirPlanoAplicacaoPadDryRun,
  salvarRelatorioReconstrucao,
} = require("../services/profor-2022/profor-pad-plano-reconstrucao-service");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(resultado, arquivoSaidaRelativo) {
  const { resumo, auditoriaRevisao } = resultado;

  console.log("Dry-run de reconstrução do planoAplicacao PAD PROFOR 2022");
  console.log(`Saida JSON: ${arquivoSaidaRelativo}`);
  console.log(`Relatórios PAD lidos: ${resumo.totalRelatoriosPad}`);
  console.log(`Itens PAD processados: ${resumo.totalItensPadProcessados}`);
  console.log(`Itens PAD com rateio aplicado: ${resumo.totalItensPadComRateioAplicado}`);
  console.log(`Itens PAD sem rateio: ${resumo.totalItensPadSemRateio}`);
  console.log(`Linhas reconstruídas: ${resumo.totalLinhasReconstruidas}`);
  console.log(`Convênios reconstruídos: ${resumo.totalConveniosReconstruidos}`);
  console.log(`Decisões resolutivas encontradas: ${resumo.totalDecisoesResolutivasEncontradas}`);
  console.log(`Decisões interpretadas em dry-run: ${resumo.totalDecisoesInterpretadasDryRun}`);
  console.log(`  com efeito na reconstrução: ${resumo.totalDecisoesComEfeitoNaReconstrucao}`);
  console.log(`  sem efeito na reconstrução: ${resumo.totalDecisoesSemEfeitoNaReconstrucao}`);
  console.log(`Decisões não aplicáveis: ${resumo.totalDecisoesNaoAplicaveis}`);
  console.log(`Itens não aptos usados: ${resumo.totalItensConhecidosNaoAptosUsados}`);
  console.log(`Instrumentos fora da carteira: ${resumo.totalInstrumentosForaCarteira}`);
  console.log(`Erros críticos de leitura: ${resumo.totalErrosCriticosLeitura}`);
  console.log(`Impedimentos: ${resumo.totalImpedimentos}`);
  console.log(`Alertas: ${resumo.totalAlertas}`);
  console.log(`Valor previsto reconstruído: ${resumo.valorPrevistoReconstruidoTotal}`);
  console.log(`Valor executado reconstruído: ${resumo.valorExecutadoReconstruidoTotal}`);
  console.log(`Saldo reconstruído: ${resumo.saldoReconstruidoTotal}`);
  console.log(`Auditoria revisão — pendentes que bloqueiam publicação: ${auditoriaRevisao.totalPendentesQueBloqueiamPublicacao}`);
  console.log(`Auditoria revisão — publicação liberada: ${auditoriaRevisao.publicacaoLiberada ? "sim" : "não"}`);
  console.log(`Apto para ativação: ${resultado.aptoParaAtivacao ? "sim" : "não"}`);
  console.log(`Apto para publicação: ${resultado.aptoParaPublicacao ? "sim" : "não"}`);

  if (resultado.impedimentos.length > 0) {
    console.log("Amostra de impedimentos:");
    for (const impedimento of resultado.impedimentos.slice(0, 10)) {
      console.log(`- [${impedimento.nivel}] ${impedimento.tipo} | ${impedimento.numeroConvenio || "sem-convênio"} | ${impedimento.detalhe}`);
    }
  }
}

async function executar() {
  inicializarBanco();
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoSaida = path.join(repoRoot, CAMINHO_RELATORIO_RECONSTRUCAO);
  const resultado = await reconstruirPlanoAplicacaoPadDryRun({ repoRoot });

  salvarRelatorioReconstrucao(resultado, caminhoSaida);
  imprimirResumo(resultado, caminhoRelativo(repoRoot, caminhoSaida));
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Falha na reconstrução dry-run do planoAplicacao PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});
