const fs = require("node:fs");
const path = require("node:path");

const {
  simularReconstrucaoComRateioQuantidadeFixa,
  montarMarkdownReconstrucaoRateioFixo,
} = require("../services/profor-2022/profor-pad-rateio-quantidade-fixa-reconstrucao-dry-run-service");

const RELATORIOS_DIR = path.join(__dirname, "../data/relatorios");
const SAIDA_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-reconstrucao-com-rateio-quantidade-fixa-dry-run.json");
const SAIDA_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-reconstrucao-com-rateio-quantidade-fixa-dry-run.md");

const AMOSTRAS_CONTROLADAS = [
  {
    item: {
      numero: "AMOSTRA-DRY-RUN-1",
      uf: "NA",
      descricao: "Item apto para rateio fixo",
      natureza: "CAPITAL",
      quantidade: 10,
      valorUnitario: 1000,
      valorPrevisto: 10000,
    },
    rateios: [
      { area: "Ouvidoria", quantidade: 4 },
      { area: "Gestao", quantidade: 6 },
    ],
  },
  {
    item: {
      numero: "AMOSTRA-DRY-RUN-2",
      uf: "NA",
      descricao: "Item com saldo nao rateado",
      natureza: "CUSTEIO",
      quantidade: 5,
      valorUnitario: 100,
      valorPrevisto: 500,
    },
    rateios: [
      { area: "Ouvidoria", quantidade: 2 },
    ],
  },
  {
    item: {
      numero: "AMOSTRA-DRY-RUN-3",
      uf: "NA",
      descricao: "Item bloqueado por excesso de quantidade",
      natureza: "CAPITAL",
      quantidade: 3,
      valorUnitario: 100,
      valorPrevisto: 300,
    },
    rateios: [
      { area: "Ouvidoria", quantidade: 4 },
    ],
  },
];

function main() {
  const relatorio = simularReconstrucaoComRateioQuantidadeFixa(AMOSTRAS_CONTROLADAS);
  fs.writeFileSync(SAIDA_JSON, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
  fs.writeFileSync(SAIDA_MD, montarMarkdownReconstrucaoRateioFixo(relatorio), "utf8");

  console.log("Simulação de reconstrução com rateio fixo concluída (dry-run).");
  console.log(`JSON: ${path.relative(process.cwd(), SAIDA_JSON)}`);
  console.log(`MD:   ${path.relative(process.cwd(), SAIDA_MD)}`);
  console.log(`Itens simulados: ${relatorio.resumo.totalItensSimulados}`);
  console.log(`Bloqueios: ${relatorio.resumo.totalBloqueios}`);
}

if (require.main === module) {
  try {
    main();
  } catch (erro) {
    console.error("Falha na simulação de reconstrução com rateio fixo.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}
