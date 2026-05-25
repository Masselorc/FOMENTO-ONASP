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
  return String(valor ?? "")
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo) => String.fromCodePoint(parseInt(codigo, 16)))
    .replace(/&(?:nbsp|amp|lt|gt|quot);|&#39;/g, (entidade) => ENTIDADES_HTML[entidade] || entidade);
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

/**
 * Converte a coluna Quantidade dos relatórios PAD.
 *
 * Diferente de converterNumeroPad (uso monetário), aqui o ponto é SEMPRE
 * separador decimal — os arquivos RelatorioItensDespesasPAD_*.xls exportam a
 * quantidade no formato "1.0", "57.0", "5700.0", sem separador de milhar.
 * Tratar o ponto como milhar (como faz a normalização monetária) inflaria
 * "1.0" para 10, "57.0" para 570, etc.
 */
function converterQuantidadePad(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return { valor: 0, valido: true };
  }
  if (typeof valor === "number") {
    return { valor: Number.isFinite(valor) ? valor : 0, valido: Number.isFinite(valor) };
  }

  const texto = limparTextoPad(valor);
  if (!texto) return { valor: 0, valido: true };

  // Mantém apenas dígitos, ponto, vírgula e sinal; vírgula é tratada como
  // separador decimal (equivalente ao ponto), sem separador de milhar.
  const limpo = texto.replace(/[^\d.,-]/g, "").replace(",", ".");
  const possuiDigito = /\d/.test(limpo);
  const numero = Number(limpo);
  const valido = possuiDigito && Number.isFinite(numero);
  return {
    valor: valido ? numero : 0,
    valido,
  };
}

function converterDataPad(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString();
  }
  return limparTextoPad(valor) || null;
}

module.exports = {
  limparEntidadesHtml,
  limparTextoPad,
  normalizarRotuloPad,
  normalizarCodigoNaturezaPad,
  derivarNaturezaPad,
  converterNumeroPad,
  converterQuantidadePad,
  converterDataPad,
};
