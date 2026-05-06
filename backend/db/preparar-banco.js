const db = require("./database");
const { inicializarBanco } = require("./init-db");
const { importarParametrosMinimos } = require("../scripts/importar-parametros-minimos");
const { inicializarFormalizacaoProfor } = require("../services/formalizacao-profor-service");
const { inicializarOrcamento2026 } = require("../services/orcamento-2026-service");

function prepararBanco() {
  inicializarBanco();

  const total = db.prepare("SELECT COUNT(*) AS total FROM parametros_minimos").get().total;
  if (total === 0) {
    importarParametrosMinimos();
  }

  inicializarFormalizacaoProfor();
  inicializarOrcamento2026();
}

module.exports = {
  prepararBanco
};
