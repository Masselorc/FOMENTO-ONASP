const path = require("node:path");

const {
  conferirItensPadComRateiosProfor2022,
  salvarConferenciaPadRateios,
} = require("../services/profor-2022/profor-pad-matching-service");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(resultado, arquivoSaidaRelativo) {
  const { resumo, alertas } = resultado;

  console.log("Dry-run de conferência PAD x rateios PROFOR 2022");
  console.log(`Saida JSON: ${arquivoSaidaRelativo}`);
  console.log(`Relatórios PAD lidos: ${resumo.totalRelatoriosPad}`);
  console.log(`Itens PAD conferidos: ${resumo.totalItensPadConferidos}`);
  console.log(`Itens PAD com rateio: ${resumo.totalItensPadComRateio}`);
  console.log(`Itens PAD sem rateio: ${resumo.totalItensPadSemRateio}`);
  console.log(`Itens conhecidos ausentes no PAD: ${resumo.totalItensConhecidosAusentesNoPad}`);
  console.log(`Itens conhecidos não aptos: ${resumo.totalItensConhecidosNaoAptos}`);
  console.log(`Instrumentos não encontrados na carteira: ${resumo.totalInstrumentosNaoEncontradosNaCarteira}`);
  console.log(`Alertas: ${resumo.totalAlertas}`);
  console.log(`Alertas impeditivos: ${resumo.totalAlertasImpeditivos}`);

  if (alertas.length > 0) {
    console.log("Amostra de alertas:");
    for (const alerta of alertas.slice(0, 10)) {
      console.log(`- [${alerta.nivel}] ${alerta.tipo} | ${alerta.instrumento || "sem-instrumento"} | ${alerta.detalhe}`);
    }
  }
}

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoSaida = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-rateios-dry-run.json");
  const resultado = await conferirItensPadComRateiosProfor2022({ repoRoot });

  salvarConferenciaPadRateios(resultado, caminhoSaida);
  imprimirResumo(resultado, caminhoRelativo(repoRoot, caminhoSaida));
}

executar().catch((erro) => {
  console.error("Falha na conferência dry-run dos itens PAD com rateios PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});
