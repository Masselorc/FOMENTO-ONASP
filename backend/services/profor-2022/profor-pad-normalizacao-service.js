const {
  normalizarTextoProfor,
  moedaParaNumeroProfor,
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

const ENTIDADES_HTML = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
};

function limparEntidadesHtml(valor) {
  return String(valor ?? "").replace(/&(?:nbsp|amp|lt|gt|quot);|&#39;/g, (entidade) => ENTIDADES_HTML[entidade] || entidade);
}

function limparTextoPad(valor) {
  return limparEntidadesHtml(valor).replace(/\s+/g, " ").trim();
}

function normalizarRotuloPad(valor) {
  return normalizarTextoProfor(limparTextoPad(valor))
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigoNaturezaPad(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function derivarNaturezaPad(codigoNaturezaDespesa) {
  const codigo = normalizarCodigoNaturezaPad(codigoNaturezaDespesa);
  if (codigo.startsWith("33")) return "CUSTEIO";
  if (codigo.startsWith("44")) return "CAPITAL";
  return "NAO_CLASSIFICADO";
}

function converterNumeroPad(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return { valor: 0, valido: true };
  }
  if (typeof valor === "number") {
    return { valor: Number.isFinite(valor) ? valor : 0, valido: Number.isFinite(valor) };
  }

  const texto = limparTextoPad(valor);
  if (!texto) return { valor: 0, valido: true };

  const possuiDigito = /\d/.test(texto);
  const numero = moedaParaNumeroProfor(texto);
  return {
    valor: arredondarMoedaProfor(numero),
    valido: possuiDigito && Number.isFinite(numero),
  };
}

function converterDataPad(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString();
  }
  return limparTextoPad(valor) || null;
}

module.exports = {
  limparTextoPad,
  normalizarRotuloPad,
  normalizarCodigoNaturezaPad,
  derivarNaturezaPad,
  converterNumeroPad,
  converterDataPad,
};
