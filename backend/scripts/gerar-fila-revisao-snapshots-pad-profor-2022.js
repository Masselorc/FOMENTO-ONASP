const fs = require("node:fs");
const path = require("node:path");

const {
  gerarFilaRevisaoSnapshots,
  montarMarkdownFilaRevisaoSnapshots,
} = require("../services/profor-2022/profor-pad-fila-revisao-snapshots-service");

const RELATORIOS_DIR = path.join(__dirname, "../data/relatorios");
const ENTRADA_COMPARACAO = path.join(RELATORIOS_DIR, "profor-2022-pad-comparacao-snapshots-dry-run.json");
const SAIDA_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-fila-revisao-snapshots-dry-run.json");
const SAIDA_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-fila-revisao-snapshots-dry-run.md");

function lerComparacaoSeExistir() {
  if (!fs.existsSync(ENTRADA_COMPARACAO)) return null;
  return JSON.parse(fs.readFileSync(ENTRADA_COMPARACAO, "utf8"));
}

function escreverRelatorio(relatorio) {
  fs.mkdirSync(RELATORIOS_DIR, { recursive: true });
  fs.writeFileSync(SAIDA_JSON, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
  fs.writeFileSync(SAIDA_MD, montarMarkdownFilaRevisaoSnapshots(relatorio), "utf8");
}

function main() {
  const comparacao = lerComparacaoSeExistir();
  const relatorio = gerarFilaRevisaoSnapshots(comparacao, {
    snapshotAnteriorOficialPromovido: Boolean(comparacao),
  });
  escreverRelatorio(relatorio);

  console.log("Fila de revisão por snapshots PAD concluída (dry-run).");
  console.log(`JSON: ${path.relative(process.cwd(), SAIDA_JSON)}`);
  console.log(`MD:   ${path.relative(process.cwd(), SAIDA_MD)}`);
  console.log(`Status: ${relatorio.status}`);
  console.log(`Candidatos: ${relatorio.resumo.totalCandidatos}`);
  console.log(`Bloqueios técnicos: ${relatorio.resumo.totalBloqueiosTecnicos}`);
}

if (require.main === module) {
  try {
    main();
  } catch (erro) {
    console.error("Falha ao gerar fila de revisão por snapshots PAD.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}
