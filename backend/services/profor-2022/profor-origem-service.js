const ORIGENS_DADOS_PROFOR_2022 = Object.freeze(["planilha", "banco-cache"]);
const ORIGEM_PADRAO_PROFOR_2022 = "planilha";

function listarOrigensDadosProfor2022() {
  return [...ORIGENS_DADOS_PROFOR_2022];
}

function normalizarOrigemDadosProfor2022(valor) {
  const origem = String(valor ?? "").trim().toLowerCase();
  return ORIGENS_DADOS_PROFOR_2022.includes(origem) ? origem : ORIGEM_PADRAO_PROFOR_2022;
}

function resolverOrigemDadosProfor2022(opcoes = {}) {
  const valorInformado = opcoes.origemDados ?? process.env.PROFOR_2022_ORIGEM_DADOS;
  const origemDados = normalizarOrigemDadosProfor2022(valorInformado);
  const avisos = [];

  if (
    valorInformado !== undefined &&
    valorInformado !== null &&
    String(valorInformado).trim() !== "" &&
    !ORIGENS_DADOS_PROFOR_2022.includes(String(valorInformado).trim().toLowerCase())
  ) {
    avisos.push(`Origem de dados PROFOR 2022 invalida: ${String(valorInformado)}. Usando planilha.`);
  }

  if (opcoes.detalhado) {
    return {
      origemDados,
      origem: origemDados,
      fonte: opcoes.origemDados !== undefined ? "opcoes" : "env",
      avisos,
    };
  }

  return origemDados;
}

function deveUsarBancoCacheProfor2022(opcoes = {}) {
  return resolverOrigemDadosProfor2022(opcoes) === "banco-cache";
}

function deveUsarPlanilhaProfor2022(opcoes = {}) {
  return resolverOrigemDadosProfor2022(opcoes) === "planilha";
}

module.exports = {
  ORIGENS_DADOS_PROFOR_2022,
  ORIGEM_PADRAO_PROFOR_2022,
  listarOrigensDadosProfor2022,
  normalizarOrigemDadosProfor2022,
  resolverOrigemDadosProfor2022,
  deveUsarBancoCacheProfor2022,
  deveUsarPlanilhaProfor2022,
};
