const fs = require("node:fs");
const path = require("node:path");

const {
  simularIntegracaoFilaOficialSnapshots,
  montarMarkdownIntegracaoFilaOficial,
} = require("../services/profor-2022/profor-pad-integracao-fila-oficial-dry-run-service");

const RELATORIOS_DIR = path.join(__dirname, "../data/relatorios");
const ENTRADA_FILA = path.join(RELATORIOS_DIR, "profor-2022-pad-fila-revisao-snapshots-dry-run.json");
const SAIDA_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-integracao-fila-oficial-snapshots-dry-run.json");
const SAIDA_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-integracao-fila-oficial-snapshots-dry-run.md");

function lerFilaSeExistir() {
  if (!fs.existsSync(ENTRADA_FILA)) return null;
  return JSON.parse(fs.readFileSync(ENTRADA_FILA, "utf8"));
}

function main() {
  const filaSnapshots = lerFilaSeExistir();
  const relatorio = simularIntegracaoFilaOficialSnapshots(filaSnapshots);
  fs.writeFileSync(SAIDA_JSON, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
  fs.writeFileSync(SAIDA_MD, montarMarkdownIntegracaoFilaOficial(relatorio), "utf8");

  console.log("Simulação de integração com fila oficial concluída (dry-run).");
  console.log(`JSON: ${path.relative(process.cwd(), SAIDA_JSON)}`);
  console.log(`MD:   ${path.relative(process.cwd(), SAIDA_MD)}`);
  console.log(`Status: ${relatorio.status}`);
  console.log(`Integráveis: ${relatorio.resumo.totalIntegraveis}`);
}

if (require.main === module) {
  try {
    main();
  } catch (erro) {
    console.error("Falha na simulação de integração com fila oficial.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}
