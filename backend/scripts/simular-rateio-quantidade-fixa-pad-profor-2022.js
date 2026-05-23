const fs = require("node:fs");
const path = require("node:path");

const {
  simularRateioQuantidadeFixa,
  montarMarkdownRateioQuantidadeFixa,
} = require("../services/profor-2022/profor-pad-rateio-quantidade-fixa-service");

const RELATORIOS_DIR = path.join(__dirname, "../data/relatorios");
const SAIDA_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-rateio-quantidade-fixa-dry-run.json");
const SAIDA_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-rateio-quantidade-fixa-dry-run.md");

const AMOSTRA_NAO_OFICIAL = {
  item: {
    numero: "AMOSTRA-DRY-RUN",
    uf: "NA",
    descricao: "Item de simulação de rateio por quantidade fixa",
    natureza: "CAPITAL",
    quantidade: 10,
    valorUnitario: 1000,
    valorPrevisto: 10000,
  },
  rateios: [
    { area: "Ouvidoria", quantidade: 4 },
    { area: "Gestao", quantidade: 6 },
  ],
};

function main() {
  const resultado = simularRateioQuantidadeFixa(AMOSTRA_NAO_OFICIAL);
  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    origem: "amostra_nao_oficial",
    entrada: AMOSTRA_NAO_OFICIAL,
    resultado,
    garantias: {
      decisaoRegistrada: false,
      bancoAlterado: false,
      publicacaoExecutada: false,
      reconstrucaoOficialAlterada: false,
    },
  };

  fs.mkdirSync(RELATORIOS_DIR, { recursive: true });
  fs.writeFileSync(SAIDA_JSON, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
  fs.writeFileSync(SAIDA_MD, montarMarkdownRateioQuantidadeFixa(relatorio), "utf8");

  console.log("Simulação de rateio por quantidade fixa concluída (dry-run).");
  console.log(`JSON: ${path.relative(process.cwd(), SAIDA_JSON)}`);
  console.log(`MD:   ${path.relative(process.cwd(), SAIDA_MD)}`);
  console.log(`Apto: ${resultado.apto ? "sim" : "não"}`);
}

if (require.main === module) {
  try {
    main();
  } catch (erro) {
    console.error("Falha na simulação de rateio por quantidade fixa.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}
