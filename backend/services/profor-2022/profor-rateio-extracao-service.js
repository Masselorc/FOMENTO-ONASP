const { normalizarTextoProfor } = require("./profor-plano-aplicacao-service");

function normalizarDescricaoRateioProfor(valor) {
  return normalizarTextoProfor(valor).replace(/\s+/g, " ").trim();
}

function criarChaveItemRateioProfor(numeroConvenio, descricaoNormalizada) {
  return `${numeroConvenio}::${descricaoNormalizada}`;
}

module.exports = {
  normalizarDescricaoRateioProfor,
  criarChaveItemRateioProfor,
};
