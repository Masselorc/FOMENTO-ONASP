const path = require("path");
const { inicializarBanco } = require("../db/init-db");
const {
  simularImportacaoRateioInicialJson,
  importarRateioInicialJson,
} = require("../services/profor-2022/profor-rateio-import-service");

function lerArgumento(prefixo) {
  const argumento = process.argv.find((item) => item.startsWith(`${prefixo}=`));
  if (!argumento) return null;
  return argumento.slice(prefixo.length + 1);
}

function executar() {
  inicializarBanco();

  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoJson = lerArgumento("--arquivo");
  const observacao = lerArgumento("--observacao");
  const modoDryRun = process.argv.includes("--dry-run");
  const permitirReimportacao = process.argv.includes("--forcar");

  if (modoDryRun) {
    const simulacao = simularImportacaoRateioInicialJson({
      repoRoot,
      caminhoJson,
    });
    console.log("Simulação de importação de rateio inicial (sem persistência):");
    console.log(`JSON: ${simulacao.caminhoJson}`);
    console.log(`Hash: ${simulacao.hashArquivo}`);
    console.log(`Arquivo origem planilha: ${simulacao.arquivoOrigemPlanilha || "não informado"}`);
    console.log(`Itens: ${simulacao.totalItens}`);
    console.log(`Rateios: ${simulacao.totalRateios}`);
    console.log(`Alertas: ${simulacao.totalAlertas}`);
    console.log(`Alertas impeditivos: ${simulacao.totalAlertasImpeditivos}`);
    if (simulacao.loteExistente) {
      console.log(
        `Lote com hash idêntico já existe: ${simulacao.loteExistente.id} ` +
        `(${simulacao.loteExistente.status}) em ${simulacao.loteExistente.criadoEm}`
      );
    }
    return;
  }

  const resultado = importarRateioInicialJson({
    repoRoot,
    caminhoJson,
    observacao,
    permitirReimportacao,
  });
  console.log(`Lote criado: ${resultado.loteId}`);
  console.log(`JSON importado: ${resultado.caminhoJson}`);
  console.log(`Hash: ${resultado.hashArquivo}`);
  console.log(`Arquivo origem planilha: ${resultado.arquivoOrigemPlanilha || "não informado"}`);
  console.log(`Itens importados: ${resultado.totalItens}`);
  console.log(`Rateios importados: ${resultado.totalRateios}`);
  console.log(`Alertas importados: ${resultado.totalAlertas}`);
  console.log(`Alertas impeditivos: ${resultado.totalAlertasImpeditivos}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha na importação do rateio inicial PROFOR 2022:", erro?.message || erro);
  process.exit(1);
}
