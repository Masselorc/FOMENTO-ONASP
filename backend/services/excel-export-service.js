const XLSX = require("xlsx");
const { PARAMETROS_MINIMOS, statusParaTela, normalizarStatusParametroMinimo } = require("./parametros-minimos-config");
const { listarParametrosMinimos } = require("./parametros-minimos-service");

function statusParaExcel(statusTela) {
  const status = normalizarStatusParametroMinimo(statusTela);
  if (status.startsWith("FALTA +")) return status;

  const mapa = {
    "TEM": "TEM",
    "NÃO TEM": "NÃO TEM",
    "PARCIAL": "PARCIAL",
    "VALIDAR": "VALIDAR",
    "NÃO INFORMADO": "NÃO INFORMADO",
    "DÉFICIT": "DÉFICIT"
  };

  return mapa[status] || "NÃO INFORMADO";
}

function exportarParametrosMinimosExcel() {
  const dados = listarParametrosMinimos();
  const linhas = dados.respostas.map((resposta) => {
    const linha = { UF: resposta.uf };

    PARAMETROS_MINIMOS.forEach((config) => {
      const item = resposta.parametrosMinimos.find((parametro) => parametro.idParametro === config.key);
      linha[config.label] = statusParaExcel(item?.respostaOriginal || item?.statusNormalizado || statusParaTela("NÃO INFORMADO"));
    });

    return linha;
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(linhas, {
    header: ["UF", ...PARAMETROS_MINIMOS.map((item) => item.label)]
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "VALIDACAO");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  exportarParametrosMinimosExcel
};
