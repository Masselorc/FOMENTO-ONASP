const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });

function validarSenhaEdicao(password) {
  const senhaCorreta = process.env.ONASP_EDIT_PASSWORD;

  if (!senhaCorreta) {
    throw new Error("Senha de edição não configurada no backend.");
  }

  return String(password || "") === String(senhaCorreta);
}

module.exports = {
  validarSenhaEdicao
};
