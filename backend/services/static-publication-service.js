const fs = require("fs");
const path = require("path");

const { listarParametrosMinimos } = require("./parametros-minimos-service");
const { listarFormalizacaoProfor } = require("./formalizacao-profor-service");
const { listarOrcamento2026 } = require("./orcamento-2026-service");

const publicDir = path.join(__dirname, "..", "..", "frontend", "data", "publicados");

function escreverJsonAtomico(nomeArquivo, dados) {
  fs.mkdirSync(publicDir, { recursive: true });

  const finalPath = path.join(publicDir, nomeArquivo);
  const tempPath = `${finalPath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(dados, null, 2), "utf8");
  fs.renameSync(tempPath, finalPath);
}

function contarItensPublicados(dados, chavesPreferenciais = []) {
  for (const chave of chavesPreferenciais) {
    if (Array.isArray(dados?.[chave])) return dados[chave].length;
  }

  return Array.isArray(dados) ? dados.length : null;
}

async function publicarDadosEstaticos() {
  const parametrosMinimos = await listarParametrosMinimos();
  const formalizacaoProfor = await listarFormalizacaoProfor();
  const orcamento2026 = await listarOrcamento2026();
  const publicadoEm = new Date().toISOString();

  escreverJsonAtomico("parametros-minimos.json", parametrosMinimos);
  escreverJsonAtomico("formalizacao-profor.json", formalizacaoProfor);
  escreverJsonAtomico("orcamento-2026.json", orcamento2026);
  escreverJsonAtomico("resumo-publicacao.json", {
    publicadoEm,
    fonte: "SQLite local",
    arquivos: [
      "parametros-minimos.json",
      "formalizacao-profor.json",
      "orcamento-2026.json"
    ],
    totais: {
      parametrosMinimos: contarItensPublicados(parametrosMinimos, ["respostas", "ufs"]),
      formalizacaoProfor: contarItensPublicados(formalizacaoProfor, ["propostas", "ufs"]),
      orcamento2026: contarItensPublicados(orcamento2026, ["itens", "itensOficiais"])
    }
  });

  return {
    success: true,
    publicadoEm
  };
}

module.exports = {
  publicarDadosEstaticos
};
