const fs = require("node:fs");
const path = require("node:path");

const {
  extrairRateioInicialProfor2022DryRun,
} = require("../services/profor-2022/profor-rateio-extracao-service");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(resultado, arquivoSaidaRelativo) {
  const { resumo } = resultado;
  console.log("Dry-run de rateio inicial PROFOR 2022");
  console.log(`Planilha: ${resumo.arquivoPlanilha}`);
  console.log(`Saida JSON: ${arquivoSaidaRelativo}`);
  console.log(`Abas por UF: ${resumo.abasProcessadas.length}`);
  console.log(`Linhas lidas: ${resumo.totalLinhasLidas}`);
  console.log(`Itens conhecidos: ${resumo.totalItensConhecidos}`);
  console.log(`Rateios: ${resumo.totalRateios}`);
  console.log(`Alertas: ${resumo.totalAlertas}`);
  console.log(`Alertas impeditivos: ${resumo.totalAlertasImpedativos}`);
  console.log(`Naturezas conflitantes: ${resumo.totalNaturezasConflitantes}`);
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoSaida = path.join(repoRoot, "backend/data/relatorios/profor-2022-rateio-inicial-dry-run.json");
  const diretorioSaida = path.dirname(caminhoSaida);

  const resultado = extrairRateioInicialProfor2022DryRun({ repoRoot });

  fs.mkdirSync(diretorioSaida, { recursive: true });
  fs.writeFileSync(caminhoSaida, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");

  imprimirResumo(resultado, caminhoRelativo(repoRoot, caminhoSaida));

  if (resultado.alertas.length > 0) {
    const amostra = resultado.alertas.slice(0, 10);
    console.log("Amostra de alertas:");
    for (const alerta of amostra) {
      console.log(`- [${alerta.nivel}] ${alerta.tipo} | ${alerta.chaveItem || "sem-chave"} | ${alerta.detalhe}`);
    }
  }
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao extrair rateios iniciais do PROFOR 2022 em dry-run.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}
