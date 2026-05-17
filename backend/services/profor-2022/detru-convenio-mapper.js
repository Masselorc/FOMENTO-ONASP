// Mapeador DETRU → modelo interno PROFOR 2022.
// Recebe objetos já lidos pelo detru-convenio-reader.js (chaves normalizadas, sem ZIP).
// Não consulta banco, não cria rotas, não altera frontend.
// Nota arquitetural: o ZIP siconv_convenio.csv.zip é grande e não deve ser processado
// no carregamento da página. O fluxo futuro previsto é:
//   atualização diária → leitura backend do ZIP → filtro pelos convênios monitorados
//   → mapeamento → snapshot/cache pequeno → páginas consomem somente o cache.

const COLUNAS_OBRIGATORIAS = [
  "NR_CONVENIO",
  "ANO",
  "NR_PROCESSO",
  "DIA_FIM_VIGENC_CONV",
  "QTD_TA",
  "VL_GLOBAL_CONV",
  "VL_REPASSE_CONV",
  "VL_CONTRAPARTIDA_CONV",
  "VL_DESEMBOLSADO_CONV",
  "VL_RENDIMENTO_APLICACAO",
  "VL_INGRESSO_CONTRAPARTIDA",
];

// Candidatos em ordem de preferência para a coluna UF no arquivo DETRU.
// A presença real da coluna depende da versão do arquivo; nunca inventar UF.
const CANDIDATOS_UF = ["UF", "SG_UF", "UF_PROPONENTE", "SG_UF_PROPONENTE"];

function limparTextoDetru(valor) {
  const s = String(valor ?? "").trim();
  return s === "" ? null : s;
}

function converterNumeroDetru(valor) {
  const s = String(valor ?? "").trim();
  return s === "" ? null : s;
}

function converterMoedaBr(valor) {
  const s = String(valor ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function converterInteiroDetru(valor) {
  const s = String(valor ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function obterPrimeiraColunaDisponivel(row, nomes) {
  for (const nome of nomes) {
    if (Object.prototype.hasOwnProperty.call(row, nome)) {
      const val = limparTextoDetru(row[nome]);
      if (val !== null) return val;
    }
  }
  return null;
}

function validarColunasObrigatoriasDetru(colunas) {
  const conjunto = new Set(colunas);
  const ausentes = COLUNAS_OBRIGATORIAS.filter((c) => !conjunto.has(c));
  const presentes = COLUNAS_OBRIGATORIAS.filter((c) => conjunto.has(c));
  return {
    ok: ausentes.length === 0,
    ausentes,
    presentes,
  };
}

function mapearConvenioDetruParaProfor(row) {
  return {
    numeroConvenio: converterNumeroDetru(row.NR_CONVENIO),
    ano: limparTextoDetru(row.ANO),
    uf: obterPrimeiraColunaDisponivel(row, CANDIDATOS_UF),
    processoSei: limparTextoDetru(row.NR_PROCESSO),
    vencimento: limparTextoDetru(row.DIA_FIM_VIGENC_CONV),
    quantidadeTa: converterInteiroDetru(row.QTD_TA),
    valorGlobal: converterMoedaBr(row.VL_GLOBAL_CONV),
    valorRepasse: converterMoedaBr(row.VL_REPASSE_CONV),
    valorContrapartida: converterMoedaBr(row.VL_CONTRAPARTIDA_CONV),
    repasseDesembolsado: converterMoedaBr(row.VL_DESEMBOLSADO_CONV),
    rendimentoAprovado: converterMoedaBr(row.VL_RENDIMENTO_APLICACAO),
    contrapartidaIntegralizada: converterMoedaBr(row.VL_INGRESSO_CONTRAPARTIDA),
    fonte: "DETRU/siconv_convenio.csv.zip",
  };
}

function mapearConveniosDetruParaProfor(rows) {
  return rows.map(mapearConvenioDetruParaProfor);
}

module.exports = {
  converterNumeroDetru,
  limparTextoDetru,
  obterPrimeiraColunaDisponivel,
  mapearConvenioDetruParaProfor,
  mapearConveniosDetruParaProfor,
  validarColunasObrigatoriasDetru,
};
