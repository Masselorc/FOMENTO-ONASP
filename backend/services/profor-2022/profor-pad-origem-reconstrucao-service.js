// Origem "reconstrucao-pad" do planoAplicacao PROFOR 2022.
// Lê o relatório dry-run reconstruído a partir dos relatórios PAD/PROFOR 2022 e
// adapta-o ao formato canônico consumido pelo restante do fluxo (mesma forma
// que extrairPlanoAplicacaoProforDoWorkbook).
//
// Esta origem NÃO publica, NÃO altera frontend/data/publicados, NÃO altera
// backend/data/onasp.sqlite e NÃO altera a origem ativa. Em caso de arquivo
// ausente ou inválido, lança erro explícito — nunca cai silenciosamente para
// a planilha. Esta é a origem operacional padrão do PROFOR 2022.

const fs = require("fs");
const path = require("path");

const CAMINHO_PADRAO_RECONSTRUCAO_PAD = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "relatorios",
  "profor-2022-pad-plano-reconstruido-dry-run.json"
);

const CAMPOS_OBRIGATORIOS_ITEM = Object.freeze([
  "uf",
  "instrumento",
  "numero",
  "ano",
  "area",
  "natureza",
  "descricao",
  "quantidade",
  "valorUnitario",
  "valorPrevisto",
  "valorExecutado",
  "saldo",
  "saldoEconomicidade",
  "percentualExecucao",
]);

class ReconstrucaoPadIndisponivelError extends Error {
  constructor(message, detalhes = {}) {
    super(message);
    this.name = "ReconstrucaoPadIndisponivelError";
    this.detalhes = detalhes;
  }
}

class ReconstrucaoPadInvalidaError extends Error {
  constructor(message, detalhes = {}) {
    super(message);
    this.name = "ReconstrucaoPadInvalidaError";
    this.detalhes = detalhes;
  }
}

function resolverCaminhoReconstrucaoPad(opcoes = {}) {
  if (opcoes.caminho && typeof opcoes.caminho === "string" && opcoes.caminho.trim() !== "") {
    return opcoes.caminho;
  }
  return CAMINHO_PADRAO_RECONSTRUCAO_PAD;
}

function lerArquivoReconstrucaoPad(caminho) {
  if (!fs.existsSync(caminho)) {
    throw new ReconstrucaoPadIndisponivelError(
      `Arquivo de reconstrucao PAD ausente em ${caminho}. ` +
        `Execute 'npm run profor:pad:reconstruir-plano:dry-run' antes de usar a origem reconstrucao-pad.`,
      { caminho }
    );
  }
  let bruto;
  try {
    bruto = fs.readFileSync(caminho, "utf8");
  } catch (erro) {
    throw new ReconstrucaoPadIndisponivelError(
      `Falha ao ler arquivo de reconstrucao PAD em ${caminho}: ${erro?.message || erro}.`,
      { caminho, causa: erro?.message || String(erro) }
    );
  }
  try {
    return JSON.parse(bruto);
  } catch (erro) {
    throw new ReconstrucaoPadInvalidaError(
      `Arquivo de reconstrucao PAD em ${caminho} nao e JSON valido: ${erro?.message || erro}.`,
      { caminho, causa: erro?.message || String(erro) }
    );
  }
}

function ehNumeroValido(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

function validarEstruturaReconstrucaoPad(payload, opcoes = {}) {
  if (!payload || typeof payload !== "object") {
    throw new ReconstrucaoPadInvalidaError(
      "Reconstrucao PAD invalida: payload nao e objeto JSON.",
      { tipo: typeof payload }
    );
  }
  const linhas = payload.planoAplicacaoReconstruido;
  if (!Array.isArray(linhas)) {
    throw new ReconstrucaoPadInvalidaError(
      "Reconstrucao PAD invalida: campo 'planoAplicacaoReconstruido' ausente ou nao e array.",
      { chavesPresentes: Object.keys(payload) }
    );
  }
  if (linhas.length === 0) {
    throw new ReconstrucaoPadInvalidaError(
      "Reconstrucao PAD invalida: 'planoAplicacaoReconstruido' esta vazio.",
      { totalLinhas: 0 }
    );
  }
  const minimoLinhasExigido = Number.isInteger(opcoes.minimoLinhasExigido)
    ? opcoes.minimoLinhasExigido
    : 1;
  if (linhas.length < minimoLinhasExigido) {
    throw new ReconstrucaoPadInvalidaError(
      `Reconstrucao PAD invalida: total de linhas (${linhas.length}) menor que o minimo exigido (${minimoLinhasExigido}).`,
      { totalLinhas: linhas.length, minimoLinhasExigido }
    );
  }
  for (let indice = 0; indice < linhas.length; indice += 1) {
    const item = linhas[indice];
    if (!item || typeof item !== "object") {
      throw new ReconstrucaoPadInvalidaError(
        `Reconstrucao PAD invalida: item [${indice}] nao e objeto.`,
        { indice }
      );
    }
    for (const campo of CAMPOS_OBRIGATORIOS_ITEM) {
      if (!(campo in item)) {
        throw new ReconstrucaoPadInvalidaError(
          `Reconstrucao PAD invalida: item [${indice}] (numero=${item.numero ?? "?"}) sem campo obrigatorio '${campo}'.`,
          { indice, campo, numero: item.numero }
        );
      }
    }
    const camposNumericos = [
      "quantidade",
      "valorUnitario",
      "valorPrevisto",
      "valorExecutado",
      "saldo",
      "saldoEconomicidade",
      "percentualExecucao",
    ];
    for (const campo of camposNumericos) {
      if (!ehNumeroValido(item[campo])) {
        throw new ReconstrucaoPadInvalidaError(
          `Reconstrucao PAD invalida: item [${indice}] (numero=${item.numero ?? "?"}) com campo numerico '${campo}' invalido (${String(item[campo])}).`,
          { indice, campo, valor: item[campo], numero: item.numero }
        );
      }
    }
  }
  const conveniosUnicos = new Set(linhas.map((item) => String(item.numero ?? "").trim()));
  conveniosUnicos.delete("");
  const totalConvenios = conveniosUnicos.size;
  const conveniosEsperados = Number.isInteger(opcoes.conveniosEsperados)
    ? opcoes.conveniosEsperados
    : null;
  if (conveniosEsperados !== null && totalConvenios !== conveniosEsperados) {
    throw new ReconstrucaoPadInvalidaError(
      `Reconstrucao PAD invalida: total de convenios distintos (${totalConvenios}) difere do esperado (${conveniosEsperados}).`,
      { totalConvenios, conveniosEsperados }
    );
  }
  return { totalLinhas: linhas.length, totalConvenios };
}

function adaptarItemReconstrucaoPad(item) {
  return {
    uf: item.uf,
    instrumento: item.instrumento,
    numero: item.numero,
    ano: item.ano,
    area: item.area,
    natureza: item.natureza,
    descricao: item.descricao,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorPrevisto: item.valorPrevisto,
    valorExecutado: item.valorExecutado,
    saldo: item.saldo,
    saldoEconomicidade: item.saldoEconomicidade,
    percentualExecucao: item.percentualExecucao,
  };
}

function adaptarPlanoAplicacaoReconstrucaoPad(linhas) {
  return linhas.map(adaptarItemReconstrucaoPad);
}

function carregarPlanoAplicacaoReconstrucaoPad(opcoes = {}) {
  const caminho = resolverCaminhoReconstrucaoPad(opcoes);
  const payload = lerArquivoReconstrucaoPad(caminho);
  const validacao = validarEstruturaReconstrucaoPad(payload, opcoes);
  const planoAplicacao = adaptarPlanoAplicacaoReconstrucaoPad(payload.planoAplicacaoReconstruido);
  const metadados = {
    caminho,
    geradoEm: payload.geradoEm || null,
    modo: payload.modo || null,
    totalLinhas: validacao.totalLinhas,
    totalConvenios: validacao.totalConvenios,
    origemReconstrucao: "relatorios-pad-rateados",
  };
  return { planoAplicacao, metadados };
}

module.exports = {
  CAMINHO_PADRAO_RECONSTRUCAO_PAD,
  CAMPOS_OBRIGATORIOS_ITEM,
  ReconstrucaoPadIndisponivelError,
  ReconstrucaoPadInvalidaError,
  resolverCaminhoReconstrucaoPad,
  lerArquivoReconstrucaoPad,
  validarEstruturaReconstrucaoPad,
  adaptarItemReconstrucaoPad,
  adaptarPlanoAplicacaoReconstrucaoPad,
  carregarPlanoAplicacaoReconstrucaoPad,
};
