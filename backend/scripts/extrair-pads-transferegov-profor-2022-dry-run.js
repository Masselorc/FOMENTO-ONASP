const fs = require("node:fs");
const path = require("node:path");

const {
  executarDryRunPadsTransferegov,
} = require("../services/profor-2022/profor-pad-transferegov-dry-run-service");

const CAMINHO_JSON_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-15-dry-run.json";
const CAMINHO_MD_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-15-dry-run.md";

function obterArgumento(nome) {
  const prefixo = `--${nome}=`;
  const arg = process.argv.find((item) => item.startsWith(prefixo));
  return arg ? arg.slice(prefixo.length) : null;
}

function argumentos() {
  return {
    convenio: obterArgumento("convenio"),
    limite: obterArgumento("limite"),
    salvarRelatorio: process.argv.includes("--salvar-relatorio"),
    fallbackPlaywright: process.argv.includes("--fallback-playwright"),
  };
}

function linhaResumo(resultado) {
  if (!resultado.sucesso) {
    const erro = (resultado.errosTecnicos || []).map((item) => `${item.origem}: ${item.mensagem}`).join(" | ");
    return `${resultado.instrumento}: falha origem=${resultado.origemUsada} erro=${erro}`;
  }
  return [
    `${resultado.instrumento}:`,
    `origem=${resultado.origemUsada}`,
    `itensTransferegov=${resultado.totalItensTransferegov}`,
    `itensExcel=${resultado.totalItensExcel}`,
    `previstoTransferegov=${resultado.totalPrevistoTransferegov}`,
    `previstoExcel=${resultado.totalPrevistoExcel}`,
    `executadoTransferegov=${resultado.totalExecutadoTransferegov}`,
    `executadoExcel=${resultado.totalExecutadoExcel}`,
    `saldoTransferegov=${resultado.saldoTransferegov}`,
    `saldoExcel=${resultado.saldoExcel}`,
    `divergenciasCriticas=${resultado.divergenciasCriticas}`,
    `equivalente=${resultado.equivalente ? "sim" : "nao"}`,
  ].join(" ");
}

function imprimirResumo(resultado) {
  console.log(`dataHora=${resultado.dataHora}`);
  console.log(`totalConveniosEsperados=${resultado.resumo.totalConveniosEsperados}`);
  console.log(`totalConveniosExtraidos=${resultado.resumo.totalConveniosExtraidos}`);
  console.log(`totalConveniosComFalha=${resultado.resumo.totalConveniosComFalha}`);
  console.log(`totalConveniosEquivalentes=${resultado.resumo.totalConveniosEquivalentes}`);
  console.log(`totalConveniosComDivergenciaCritica=${resultado.resumo.totalConveniosComDivergenciaCritica}`);
  console.log(`aptoParaCacheTransferegov=${resultado.resumo.aptoParaCacheTransferegov ? "true" : "false"}`);
  for (const item of resultado.resultados) console.log(linhaResumo(item));
}

function gerarMarkdown(resultado) {
  const linhas = [
    "# Dry-run PAD Transferegov PROFOR 2022",
    "",
    `- Data/hora: ${resultado.dataHora}`,
    `- Total convênios esperados: ${resultado.resumo.totalConveniosEsperados}`,
    `- Total convênios extraídos: ${resultado.resumo.totalConveniosExtraidos}`,
    `- Total convênios com falha: ${resultado.resumo.totalConveniosComFalha}`,
    `- Total convênios equivalentes: ${resultado.resumo.totalConveniosEquivalentes}`,
    `- Total convênios com divergência crítica: ${resultado.resumo.totalConveniosComDivergenciaCritica}`,
    `- Apto para cache Transferegov: ${resultado.resumo.aptoParaCacheTransferegov ? "sim" : "não"}`,
    "",
    "| Convênio | Origem | Sucesso | Itens Tgov | Itens Excel | Previsto Tgov | Previsto Excel | Executado Tgov | Executado Excel | Saldo Tgov | Saldo Excel | Divergências críticas | Equivalente |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const item of resultado.resultados) {
    linhas.push([
      item.instrumento,
      item.origemUsada,
      item.sucesso ? "sim" : "não",
      item.totalItensTransferegov ?? "-",
      item.totalItensExcel ?? "-",
      item.totalPrevistoTransferegov ?? "-",
      item.totalPrevistoExcel ?? "-",
      item.totalExecutadoTransferegov ?? "-",
      item.totalExecutadoExcel ?? "-",
      item.saldoTransferegov ?? "-",
      item.saldoExcel ?? "-",
      item.divergenciasCriticas ?? "-",
      item.equivalente ? "sim" : "não",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  return `${linhas.join("\n")}\n`;
}

function salvarRelatorios(repoRoot, resultado) {
  const caminhoJson = path.join(repoRoot, CAMINHO_JSON_RELATIVO);
  const caminhoMd = path.join(repoRoot, CAMINHO_MD_RELATIVO);
  fs.mkdirSync(path.dirname(caminhoJson), { recursive: true });
  fs.writeFileSync(caminhoJson, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
  fs.writeFileSync(caminhoMd, gerarMarkdown(resultado), "utf8");
  console.log(`saidaJson=${CAMINHO_JSON_RELATIVO}`);
  console.log(`saidaMarkdown=${CAMINHO_MD_RELATIVO}`);
}

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const opcoes = argumentos();
  const resultado = await executarDryRunPadsTransferegov({
    repoRoot,
    convenio: opcoes.convenio,
    limite: opcoes.limite,
    fallbackPlaywright: opcoes.fallbackPlaywright,
  });
  imprimirResumo(resultado);
  if (opcoes.salvarRelatorio) salvarRelatorios(repoRoot, resultado);
}

executar().catch((erro) => {
  console.error("Falha no dry-run PAD Transferegov PROFOR 2022.");
  console.error(erro?.message || erro);
  process.exit(1);
});
