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

function validarJSONArquivo(caminhoArquivo, regras) {
  const conteudo = fs.readFileSync(caminhoArquivo, "utf8");
  const dados = JSON.parse(conteudo);

  for (const regra of regras) {
    const valor = dados?.[regra.chave];
    const ehValido = regra.tipo === "array"
      ? Array.isArray(valor)
      : regra.tipo === "object"
        ? Boolean(valor) && typeof valor === "object" && !Array.isArray(valor)
        : typeof valor === regra.tipo;

    if (!ehValido) {
      throw new Error(`Campo invalido ou ausente: ${regra.chave} (${regra.tipo})`);
    }
  }

  return dados;
}

const erros = [];

for (const nomeArquivo of arquivosEsperados) {
  const caminhoArquivo = path.join(publicDir, nomeArquivo);

  if (!fs.existsSync(caminhoArquivo)) {
    erros.push(`Arquivo ausente: ${path.relative(rootDir, caminhoArquivo)}`);
    continue;
  }

  try {
    if (nomeArquivo === "aplicacao.json") {
      validarJSONArquivo(caminhoArquivo, [{ chave: "dadosBase", tipo: "array" }]);
      continue;
    }

    if (nomeArquivo === "dashboard-geral.json") {
      validarJSONArquivo(caminhoArquivo, [{ chave: "dadosBase", tipo: "array" }]);
      continue;
    }

    if (nomeArquivo === "parametros-minimos.json") {
      const dados = validarJSONArquivo(caminhoArquivo, [
        { chave: "respostas", tipo: "array" },
        { chave: "diagnostico", tipo: "object" }
      ]);

      if (!Array.isArray(dados.parametrosDisponiveis) && !Array.isArray(dados.respostas)) {
        throw new Error("Estrutura insuficiente em parametros-minimos.json");
      }

      continue;
    }

    if (nomeArquivo === "formalizacao-profor.json") {
      const dados = validarJSONArquivo(caminhoArquivo, [
        { chave: "propostas", tipo: "array" }
      ]);

      if (!Array.isArray(dados.ufs) && !Array.isArray(dados.propostas)) {
        throw new Error("Estrutura insuficiente em formalizacao-profor.json");
      }

      continue;
    }

    if (nomeArquivo === "orcamento-2026.json") {
      validarJSONArquivo(caminhoArquivo, [{ chave: "itens", tipo: "array" }]);
      continue;
    }

    if (nomeArquivo === "resumo-publicacao.json") {
      validarJSONArquivo(caminhoArquivo, [{ chave: "arquivos", tipo: "array" }]);
      continue;
    }
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
