const fs = require("node:fs");
const path = require("node:path");

const {
  lerRelatoriosPadProfor2022,
} = require("../services/profor-2022/profor-pad-report-reader");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(resultado, arquivoSaidaRelativo) {
  const { resumo, alertas } = resultado;
  console.log("Dry-run de leitura de relatórios PAD PROFOR 2022");
  console.log(`Pasta entrada: ${resumo.pastaEntrada}`);
  console.log(`Saida JSON: ${arquivoSaidaRelativo}`);
  console.log(`Arquivos encontrados: ${resumo.totalArquivosEncontrados}`);
  console.log(`Relatórios lidos: ${resumo.totalRelatoriosLidos}`);
  console.log(`Itens extraídos: ${resumo.totalItensExtraidos}`);
  console.log(`Alertas: ${resumo.totalAlertas}`);
  console.log(`Alertas impeditivos: ${resumo.totalAlertasImpeditivos}`);

  if (alertas.length > 0) {
    console.log("Amostra de alertas:");
    for (const alerta of alertas.slice(0, 10)) {
      console.log(`- [${alerta.nivel}] ${alerta.tipo} | ${alerta.instrumento || "sem-instrumento"} | ${alerta.detalhe}`);
    }
  }
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoSaida = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json");
  const resultado = lerRelatoriosPadProfor2022({ repoRoot });

  fs.mkdirSync(path.dirname(caminhoSaida), { recursive: true });
  fs.writeFileSync(caminhoSaida, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");

  imprimirResumo(resultado, caminhoRelativo(repoRoot, caminhoSaida));
}

try {
  executar();
} catch (erro) {
  console.error("Falha na leitura dry-run dos relatórios PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}
