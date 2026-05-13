const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "frontend", "data", "publicados");

const arquivosEsperados = [
  "aplicacao.json",
  "dashboard-geral.json",
  "parametros-minimos.json",
  "formalizacao-profor.json",
  "orcamento-2026.json",
  "resumo-publicacao.json"
];

const erros = [];

for (const nomeArquivo of arquivosEsperados) {
  const caminhoArquivo = path.join(publicDir, nomeArquivo);

  if (!fs.existsSync(caminhoArquivo)) {
    erros.push(`Arquivo ausente: ${path.relative(rootDir, caminhoArquivo)}`);
    continue;
  }

  try {
    const conteudo = fs.readFileSync(caminhoArquivo, "utf8");
    JSON.parse(conteudo);
  } catch (error) {
    erros.push(`JSON invalido: ${path.relative(rootDir, caminhoArquivo)} (${error.message})`);
  }
}

if (erros.length > 0) {
  console.error("Falha na validacao dos JSONs publicados:");
  erros.forEach((erro) => console.error(`- ${erro}`));
  process.exit(1);
}

console.log("OK: todos os JSONs publicados esperados existem e sao validos.");
