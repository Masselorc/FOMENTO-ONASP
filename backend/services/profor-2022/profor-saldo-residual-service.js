/**
 * Regras centrais para Saldo Residual/Saldo Remanescente no PROFOR 2022.
 *
 * Esses itens sao tecnicos, nao setorializados por area operacional, e devem
 * ser segregados por natureza orcamentaria. CAPITAL e CUSTEIO nunca sao
 * equivalentes entre si.
 */

const AREAS_OPERACIONAIS_PROFOR = new Set([
  "OUVIDORIA",
  "CORREGEDORIA",
  "ESCOLA",
  "ESCOLA PENAL",
  "ESCOLA PENAL NACIONAL",
  "ACADEMIA",
  "ACADEPEN",
]);

const AREAS_TECNICAS_SALDO_RESIDUAL = new Set([
  "",
  "N/A",
  "N/A NAO INFORMADO",
  "NA",
  "NAO INFORMADO",
  "NAO INFORMADA",
  "NAO SE APLICA",
  "NAO APLICAVEL",
  "SEM AREA",
  "SEM AREA INFORMADA",
  "SEM SETOR",
  "NULL",
]);

const DESCRITORES_SALDO_RESIDUAL = [
  "SALDO RESIDUAL",
  "SALDO REMANESCENTE",
  "SALDO REMANESCENTE DE APLICACAO",
  "SALDO DE APLICACAO",
  "SOBRA DE SALDO",
  "RESIDUAL",
];

const DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA =
  "Saldo residual/remanescente e item tecnico nao setorializado por area, mas segregado por natureza. CAPITAL e CUSTEIO nao devem ser pareados nem consolidados como equivalentes.";

function normalizarTextoSaldoResidual(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function ehSaldoResidualProfor(descricao) {
  const texto = normalizarTextoSaldoResidual(descricao);
  if (!texto) return false;
  return DESCRITORES_SALDO_RESIDUAL.some((descritor) => texto.includes(descritor));
}

function normalizarNaturezaSaldoResidual(natureza) {
  const texto = normalizarTextoSaldoResidual(natureza);
  if (texto.includes("CAPITAL")) return "CAPITAL";
  if (texto.includes("CUSTEIO")) return "CUSTEIO";
  return texto || "";
}

function naturezaSaldoResidualValida(natureza) {
  return ["CAPITAL", "CUSTEIO"].includes(normalizarNaturezaSaldoResidual(natureza));
}

function normalizarAreaSaldoResidual(area) {
  const texto = normalizarTextoSaldoResidual(area);
  if (areaSaldoResidualEhTecnica(texto)) return "NAO INFORMADO";
  if (AREAS_TECNICAS_SALDO_RESIDUAL.has(texto)) return "NAO INFORMADO";
  return texto;
}

function areaSaldoResidualEhTecnica(area) {
  const texto = normalizarTextoSaldoResidual(area);
  if (AREAS_TECNICAS_SALDO_RESIDUAL.has(texto)) return true;
  const partes = texto.split(/[,;/|]+/).map((parte) => parte.trim()).filter(Boolean);
  return partes.length > 0 && partes.every((parte) => AREAS_TECNICAS_SALDO_RESIDUAL.has(parte));
}

function areaSaldoResidualEhOperacional(area) {
  const texto = normalizarTextoSaldoResidual(area);
  if (!texto) return false;
  return Array.from(AREAS_OPERACIONAIS_PROFOR).some((areaOperacional) => {
    const regex = new RegExp(`(^|\\b)${areaOperacional.replace(/\s+/g, "\\s+")}(\\b|$)`);
    return regex.test(texto);
  });
}

function criarChaveSaldoResidual({ numeroConvenio, descricao, natureza }) {
  const numero = normalizarTextoSaldoResidual(numeroConvenio).replace(/\D/g, "");
  const desc = normalizarTextoSaldoResidual(descricao);
  const nat = normalizarNaturezaSaldoResidual(natureza) || "SEM_NATUREZA";
  if (!numero || !desc) return null;
  return `${numero}::${desc}::${nat}`;
}

function avaliarSaldoResidual(registro = {}) {
  const descricao = registro.descricao
    ?? registro.descricaoOriginal
    ?? registro.descricaoMemoria
    ?? registro.descricaoPad
    ?? registro.chaveItem
    ?? "";
  const saldoResidual = ehSaldoResidualProfor(descricao);
  const natureza = normalizarNaturezaSaldoResidual(registro.natureza);
  const area = normalizarAreaSaldoResidual(registro.area);
  return {
    saldoResidual,
    areaTecnicaNaoSetorializada: saldoResidual ? areaSaldoResidualEhTecnica(registro.area) : false,
    areaOperacionalIndevida: saldoResidual ? areaSaldoResidualEhOperacional(registro.area) : false,
    naturezaValida: saldoResidual ? naturezaSaldoResidualValida(natureza) : true,
    natureza,
    areaTecnica: area,
  };
}

module.exports = {
  AREAS_OPERACIONAIS_PROFOR,
  AREAS_TECNICAS_SALDO_RESIDUAL,
  DESCRITORES_SALDO_RESIDUAL,
  DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA,
  normalizarTextoSaldoResidual,
  ehSaldoResidualProfor,
  normalizarNaturezaSaldoResidual,
  naturezaSaldoResidualValida,
  normalizarAreaSaldoResidual,
  areaSaldoResidualEhTecnica,
  areaSaldoResidualEhOperacional,
  criarChaveSaldoResidual,
  avaliarSaldoResidual,
};
