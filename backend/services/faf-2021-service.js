const fs = require("fs");
const path = require("path");
const { validarSenhaEdicao } = require("./auth-service");

const ARQUIVO_APLICACAO = path.join(__dirname, "..", "data", "aplicacao.json");
const PREFIXO_ITEM_ID = "faf2021_idx_";
const INSTRUMENTO_FAF = "FAF 2021";

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function converterNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;

  const texto = limparTexto(valor);
  if (!texto) return NaN;

  const normalizado = texto.replace(/^R\$/i, "").replace(/\s+/g, "");
  if (normalizado.includes(",") && normalizado.includes(".")) {
    return Number.parseFloat(normalizado.replace(/\./g, "").replace(",", "."));
  }

  if (normalizado.includes(",")) {
    return Number.parseFloat(normalizado.replace(",", "."));
  }

  return Number.parseFloat(normalizado);
}

function lerAplicacaoJson() {
  return JSON.parse(fs.readFileSync(ARQUIVO_APLICACAO, "utf8"));
}

function escreverAplicacaoJson(dados) {
  const tempPath = `${ARQUIVO_APLICACAO}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, ARQUIVO_APLICACAO);
}

function obterIndiceItemFaf2021(itemId) {
  const texto = limparTexto(itemId);
  const match = texto.match(new RegExp(`^${PREFIXO_ITEM_ID}(\\d+)$`));
  if (!match) return null;

  const indice = Number.parseInt(match[1], 10);
  return Number.isInteger(indice) && indice >= 0 ? indice : null;
}

function montarItemFaf2021(item, indiceDadosBase) {
  const valorTotal = Number(item.valorTotal) || 0;
  const valorExecutado = Number(item.valorExecutado) || 0;
  const atualizadoEm = limparTexto(item.atualizadoEm || item.atualizado_em || "");
  const observacaoExecucao = limparTexto(item.observacaoExecucao || item.observacao_execucao || "");

  return {
    itemId: `${PREFIXO_ITEM_ID}${indiceDadosBase}`,
    indiceDadosBase,
    uf: limparTexto(item.uf),
    objeto: limparTexto(item.objeto),
    quantidade: Number(item.quantidade) || 0,
    valorUnitario: Number(item.valorUnitario) || 0,
    valorTotal,
    valorExecutado,
    percentualExecutado: valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0,
    observacaoExecucao,
    atualizadoEm,
    instrumento: limparTexto(item.instrumento)
  };
}

function listarFaf2021() {
  const aplicacao = lerAplicacaoJson();
  const dadosBase = Array.isArray(aplicacao?.dadosBase) ? aplicacao.dadosBase : [];

  return {
    success: true,
    itens: dadosBase
      .map((item, indiceDadosBase) => ({ item, indiceDadosBase }))
      .filter(({ item }) => normalizarTexto(item.instrumento) === INSTRUMENTO_FAF)
      .map(({ item, indiceDadosBase }) => montarItemFaf2021(item, indiceDadosBase))
  };
}

function salvarExecucaoFaf2021(payload = {}) {
  if (!validarSenhaEdicao(payload.password)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  const indiceDadosBase = obterIndiceItemFaf2021(payload.itemId);
  if (indiceDadosBase === null) {
    return { success: false, message: "Item FAF 2021 inválido." };
  }

  const aplicacao = lerAplicacaoJson();
  const dadosBase = Array.isArray(aplicacao?.dadosBase) ? aplicacao.dadosBase : [];
  const item = dadosBase[indiceDadosBase];

  if (!item) {
    return { success: false, message: "Item FAF 2021 não localizado." };
  }

  if (normalizarTexto(item.instrumento) !== INSTRUMENTO_FAF) {
    return { success: false, message: "O item informado não pertence ao FAF 2021." };
  }

  if (normalizarTexto(item.uf) !== normalizarTexto(payload.uf)) {
    return { success: false, message: "UF informada não confere com o item original." };
  }

  if (limparTexto(item.objeto) !== limparTexto(payload.objeto)) {
    return { success: false, message: "Objeto informado não confere com o item original." };
  }

  const valorExecutado = converterNumero(payload.valorExecutado);
  const valorTotal = Number(item.valorTotal) || 0;

  if (!Number.isFinite(valorExecutado)) {
    return { success: false, message: "Valor executado inválido." };
  }

  if (valorExecutado < 0) {
    return { success: false, message: "Valor executado não pode ser negativo." };
  }

  if (valorTotal > 0 && valorExecutado > valorTotal + 0.01) {
    return { success: false, message: "Valor executado não pode ser maior que o valor total do item." };
  }

  if (Object.prototype.hasOwnProperty.call(payload, "observacaoExecucao")) {
    const observacao = limparTexto(payload.observacaoExecucao);
    if (/<[^>]+>/.test(observacao)) {
      return { success: false, message: "Observação não pode conter HTML." };
    }
    item.observacaoExecucao = observacao;
  }

  item.valorExecutado = valorExecutado;
  item.atualizadoEm = new Date().toISOString();

  escreverAplicacaoJson(aplicacao);

  return {
    success: true,
    message: "Execução do item FAF 2021 atualizada com sucesso.",
    itemId: payload.itemId,
    atualizadoEm: item.atualizadoEm
  };
}

module.exports = {
  listarFaf2021,
  salvarExecucaoFaf2021
};
