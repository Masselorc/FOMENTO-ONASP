const fs = require("fs");
const path = require("path");

const { listarParametrosMinimos } = require("./parametros-minimos-service");
const { listarFormalizacaoProfor } = require("./formalizacao-profor-service");
const { listarOrcamento2026 } = require("./orcamento-2026-service");
const { listarContatosPublicos } = require("./contatos-publication-service");
const { consolidarCatalogoDashboard } = require("./dashboard-publication-service");
const { registrarLogOperacional } = require("./logs-operacionais-service");

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

function sanitizarCatalogoAplicacaoPublico(dados) {
  const { detru, ...resto } = dados || {};
  return resto;
}

function carregarCatalogoAplicacao() {
  return JSON.parse(fs.readFileSync(catalogoAplicacaoPath, "utf8"));
}

function calcularDuracaoMs(iniciadoEm, concluidoEm = new Date().toISOString()) {
  const inicio = new Date(iniciadoEm).getTime();
  const fim = new Date(concluidoEm).getTime();
  return Number.isFinite(inicio) && Number.isFinite(fim) ? Math.max(0, fim - inicio) : null;
}

async function registrarLogPublicacaoSeguro(log, opcoes = {}) {
  const registrar = opcoes.registrarLogOperacional || registrarLogOperacional;
  try {
    await registrar(log);
  } catch {
    // Falha de auditoria nao pode bloquear a publicacao explicita.
  }
}

function arquivosPublicacaoEstatica() {
  return [
    "aplicacao.json",
    "dashboard-geral.json",
    "parametros-minimos.json",
    "formalizacao-profor.json",
    "orcamento-2026.json",
    "contatos.json",
    "resumo-publicacao.json"
  ];
}

async function publicarDadosEstaticos(opcoes = {}) {
  const iniciadoEm = new Date().toISOString();
  await registrarLogPublicacaoSeguro({
    modulo: "profor-2022",
    tipoEvento: "publicacao_estatica_inicio",
    status: "sucesso",
    iniciadoEm,
    concluidoEm: iniciadoEm,
    resumo: "Publicação estática explícita iniciada.",
    payload: {
      arquivosGerados: arquivosPublicacaoEstatica(),
    },
  }, opcoes);

  try {
    const carregarCatalogo = opcoes.carregarCatalogoAplicacao || carregarCatalogoAplicacao;
    const listarParametros = opcoes.listarParametrosMinimos || listarParametrosMinimos;
    const listarFormalizacao = opcoes.listarFormalizacaoProfor || listarFormalizacaoProfor;
    const listarOrcamento = opcoes.listarOrcamento2026 || listarOrcamento2026;
    const listarContatos = opcoes.listarContatosPublicos || listarContatosPublicos;
    const consolidarDashboard = opcoes.consolidarCatalogoDashboard || consolidarCatalogoDashboard;
    const escreverJson = opcoes.escreverJsonAtomico || escreverJsonAtomico;

    const catalogoAplicacao = carregarCatalogo();
    const parametrosMinimos = await listarParametros();
    const formalizacaoProfor = await listarFormalizacao();
    const orcamento2026 = await listarOrcamento();
    const contatos = await listarContatos();
    const publicadoEm = new Date().toISOString();
    const dashboard = await consolidarDashboard(catalogoAplicacao, publicadoEm);

    const catalogoAplicacaoPublico = sanitizarCatalogoAplicacaoPublico(dashboard.catalogoPublicado);
    const parametrosMinimosPublicos = sanitizarParametrosMinimos(parametrosMinimos);
    const formalizacaoProforPublico = sanitizarFormalizacaoProfor(formalizacaoProfor);
    const orcamento2026Publico = sanitizarOrcamento2026(orcamento2026);

    escreverJson("aplicacao.json", catalogoAplicacaoPublico);
    escreverJson("dashboard-geral.json", dashboard.dashboardGeral);
    escreverJson("parametros-minimos.json", parametrosMinimosPublicos);
    escreverJson("formalizacao-profor.json", formalizacaoProforPublico);
    escreverJson("orcamento-2026.json", orcamento2026Publico);
    escreverJson("contatos.json", { ...contatos, publicadoEm });
    escreverJson("resumo-publicacao.json", {
      publicadoEm,
      fonte: "Dados locais ONASP",
      arquivos: arquivosPublicacaoEstatica().filter((arquivo) => arquivo !== "resumo-publicacao.json"),
      totais: {
        aplicacaoDadosBase: contarItensPublicados(catalogoAplicacaoPublico, ["dadosBase"]),
        dashboard: dashboard.resumoDashboard,
        itensConvenio: dashboard.totaisExtracao.itensConvenio,
        conveniosProfor2022: dashboard.totaisExtracao.conveniosProfor2022,
        parametrosMinimos: contarItensPublicados(parametrosMinimosPublicos, ["respostas", "ufs"]),
        formalizacaoProfor: contarItensPublicados(formalizacaoProforPublico, ["propostas", "ufs"]),
        orcamento2026: contarItensPublicados(orcamento2026Publico, ["itens", "itensOficiais"]),
        contatos: contatos?.totais || null
      }
    });

    const concluidoEm = new Date().toISOString();
    await registrarLogPublicacaoSeguro({
      modulo: "profor-2022",
      tipoEvento: "publicacao_estatica_sucesso",
      status: "sucesso",
      iniciadoEm,
      concluidoEm,
      duracaoMs: calcularDuracaoMs(iniciadoEm, concluidoEm),
      resumo: `Publicação estática concluída: ${arquivosPublicacaoEstatica().length} arquivo(s).`,
      payload: {
        arquivosGerados: arquivosPublicacaoEstatica(),
        resumo: {
          publicadoEm,
          totais: {
            parametrosMinimos: contarItensPublicados(parametrosMinimosPublicos, ["respostas", "ufs"]),
            formalizacaoProfor: contarItensPublicados(formalizacaoProforPublico, ["propostas", "ufs"]),
            orcamento2026: contarItensPublicados(orcamento2026Publico, ["itens", "itensOficiais"]),
            contatos: contatos?.totais || null,
          },
        },
        duracaoMs: calcularDuracaoMs(iniciadoEm, concluidoEm),
      },
    }, opcoes);

    return {
      success: true,
      publicadoEm
    };
  } catch (erro) {
    const concluidoEm = new Date().toISOString();
    await registrarLogPublicacaoSeguro({
      modulo: "profor-2022",
      tipoEvento: "publicacao_estatica_erro",
      status: "falha",
      iniciadoEm,
      concluidoEm,
      duracaoMs: calcularDuracaoMs(iniciadoEm, concluidoEm),
      resumo: `Erro na publicação estática: ${erro?.message || erro}`,
      payload: {
        arquivosGerados: arquivosPublicacaoEstatica(),
        duracaoMs: calcularDuracaoMs(iniciadoEm, concluidoEm),
        erro: erro?.message || String(erro),
      },
    }, opcoes);
    throw erro;
  }
}

module.exports = {
  publicarDadosEstaticos,
  sanitizarCatalogoAplicacaoPublico,
  arquivosPublicacaoEstatica
};
