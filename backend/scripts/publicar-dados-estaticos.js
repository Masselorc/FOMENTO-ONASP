require("dotenv").config();

const { prepararBanco } = require("../db/preparar-banco");
const { publicarDadosEstaticos } = require("../services/static-publication-service");

prepararBanco();

publicarDadosEstaticos()
  .then((resultado) => {
    console.log("Dados estaticos publicados com sucesso.", resultado);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Erro ao publicar dados estaticos:", error);
    process.exit(1);
  });
