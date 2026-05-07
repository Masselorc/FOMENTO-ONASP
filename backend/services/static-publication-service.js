const fs = require("fs");
const path = require("path");

const { listarParametrosMinimos } = require("./parametros-minimos-service");
const { listarFormalizacaoProfor } = require("./formalizacao-profor-service");
const { listarOrcamento2026 } = require("./orcamento-2026-service");
const { consolidarCatalogoDashboard } = require("./dashboard-publication-service");

const publicDir = path.join(__dirname, "..", "..", "frontend", "data", "publicados");
const catalogoAplicacaoPath = path.join(__dirname, "..", "data", "aplicacao.json");

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

function sanitizarParametrosMinimos(dados) {
  const { respostasBrutas, ...resto } = dados || {};
  return resto;
}

function sanitizarFormalizacaoProfor(dados) {
  const { registros, ...resto } = dados || {};
  return resto;
}

function sanitizarOrcamento2026(dados) {
  const { arquivo, ...resto } = dados || {};
  return resto;
}

function carregarCatalogoAplicacao() {
  return JSON.parse(fs.readFileSync(catalogoAplicacaoPath, "utf8"));
}

async function publicarDadosEstaticos() {
  const catalogoAplicacao = carregarCatalogoAplicacao();
  const parametrosMinimos = await listarParametrosMinimos();
  const formalizacaoProfor = await listarFormalizacaoProfor();
  const orcamento2026 = await listarOrcamento2026();
  const publicadoEm = new Date().toISOString();
  const dashboard = consolidarCatalogoDashboard(catalogoAplicacao, publicadoEm);

  const parametrosMinimosPublicos = sanitizarParametrosMinimos(parametrosMinimos);
  const formalizacaoProforPublico = sanitizarFormalizacaoProfor(formalizacaoProfor);
  const orcamento2026Publico = sanitizarOrcamento2026(orcamento2026);

  escreverJsonAtomico("aplicacao.json", dashboard.catalogoPublicado);
  escreverJsonAtomico("dashboard-geral.json", dashboard.dashboardGeral);
  escreverJsonAtomico("parametros-minimos.json", parametrosMinimosPublicos);
  escreverJsonAtomico("formalizacao-profor.json", formalizacaoProforPublico);
  escreverJsonAtomico("orcamento-2026.json", orcamento2026Publico);
  escreverJsonAtomico("resumo-publicacao.json", {
    publicadoEm,
    fonte: "Dados locais ONASP",
    arquivos: [
      "aplicacao.json",
      "dashboard-geral.json",
      "parametros-minimos.json",
      "formalizacao-profor.json",
      "orcamento-2026.json"
    ],
    totais: {
      aplicacaoDadosBase: contarItensPublicados(dashboard.catalogoPublicado, ["dadosBase"]),
      dashboard: dashboard.resumoDashboard,
      itensConvenio: dashboard.totaisExtracao.itensConvenio,
      conveniosProfor2022: dashboard.totaisExtracao.conveniosProfor2022,
      parametrosMinimos: contarItensPublicados(parametrosMinimosPublicos, ["respostas", "ufs"]),
      formalizacaoProfor: contarItensPublicados(formalizacaoProforPublico, ["propostas", "ufs"]),
      orcamento2026: contarItensPublicados(orcamento2026Publico, ["itens", "itensOficiais"])
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
