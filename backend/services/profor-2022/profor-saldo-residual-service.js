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

// Marcador de natureza mista: o texto trazia CAPITAL e CUSTEIO juntos. Nunca e
// uma natureza valida de comparacao; sinaliza que a memoria precisa ser
// separada por natureza antes de comparar com o PAD.
const NATUREZA_SALDO_RESIDUAL_MISTA = "MISTA";

const NATUREZAS_SALDO_RESIDUAL = ["CAPITAL", "CUSTEIO"];

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

/**
 * Normaliza a natureza orcamentaria de um saldo residual/remanescente.
 *
 * CAPITAL e CUSTEIO sao naturezas distintas e nunca equivalentes. Quando o
 * texto traz as duas juntas (ex.: "CAPITAL, CUSTEIO"), retorna o marcador
 * MISTA: a memoria foi consolidada indevidamente e precisa ser separada por
 * natureza antes de qualquer comparacao com o PAD. Tratar texto misto como
 * uma unica natureza (CAPITAL) gerava falso positivo de divergencia.
 */
function normalizarNaturezaSaldoResidual(natureza) {
  const texto = normalizarTextoSaldoResidual(natureza);
  const temCapital = texto.includes("CAPITAL");
  const temCusteio = texto.includes("CUSTEIO");
  if (temCapital && temCusteio) return NATUREZA_SALDO_RESIDUAL_MISTA;
  if (temCapital) return "CAPITAL";
  if (temCusteio) return "CUSTEIO";
  return texto || "";
}

/** Lista de naturezas individuais presentes no texto, sem consolidar. */
function naturezasSaldoResidualDoTexto(natureza) {
  const texto = normalizarTextoSaldoResidual(natureza);
  return NATUREZAS_SALDO_RESIDUAL.filter((nat) => texto.includes(nat));
}

/** True quando a natureza informada mistura CAPITAL e CUSTEIO. */
function naturezaSaldoResidualEhMista(natureza) {
  return normalizarNaturezaSaldoResidual(natureza) === NATUREZA_SALDO_RESIDUAL_MISTA;
}

function naturezaSaldoResidualValida(natureza) {
  return NATUREZAS_SALDO_RESIDUAL.includes(normalizarNaturezaSaldoResidual(natureza));
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

function arredondarMoedaSaldoResidual(valor) {
  return Math.round(((Number(valor) || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Separa uma memoria consolidada de saldo residual/remanescente em uma linha
 * por natureza, usando os rateios ativos como fonte de cada parcela.
 *
 * O saldo residual nunca e setorializado por area, mas e obrigatoriamente
 * segregado por natureza: CAPITAL e CUSTEIO sao unidades de comparacao
 * distintas. Quando a memoria chega consolidada ("CAPITAL, CUSTEIO"), os
 * valores precisam ser reconstituidos a partir dos rateios antes de comparar
 * com o PAD, sob pena de comparar o total contra uma unica natureza.
 *
 * Retorna { natureza, valorPrevisto, valorExecutado, saldo, quantidade } por
 * natureza encontrada nos rateios. Sem rateios utilizaveis, retorna [].
 */
function separarMemoriaSaldoResidualPorNatureza(memoria = {}, rateios = []) {
  const linhasPorNatureza = new Map();
  for (const rateio of Array.isArray(rateios) ? rateios : []) {
    const natureza = normalizarNaturezaSaldoResidual(rateio?.natureza);
    if (!naturezaSaldoResidualValida(natureza)) continue;
    if (!linhasPorNatureza.has(natureza)) {
      linhasPorNatureza.set(natureza, {
        natureza,
        quantidade: 0,
        valorPrevisto: 0,
        valorExecutado: 0,
        saldo: 0,
      });
    }
    const linha = linhasPorNatureza.get(natureza);
    linha.quantidade += Number(rateio.quantidadeReferencia ?? rateio.quantidade) || 0;
    linha.valorPrevisto = arredondarMoedaSaldoResidual(
      linha.valorPrevisto + (Number(rateio.valorPrevistoReferencia ?? rateio.valorPrevisto) || 0)
    );
    linha.valorExecutado = arredondarMoedaSaldoResidual(
      linha.valorExecutado + (Number(rateio.valorExecutadoReferencia ?? rateio.valorExecutado) || 0)
    );
  }
  for (const linha of linhasPorNatureza.values()) {
    linha.saldo = arredondarMoedaSaldoResidual(linha.valorPrevisto - linha.valorExecutado);
  }
  return Array.from(linhasPorNatureza.values())
    .sort((a, b) => a.natureza.localeCompare(b.natureza, "pt-BR"));
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
    naturezaMista: saldoResidual ? naturezaSaldoResidualEhMista(registro.natureza) : false,
    natureza,
    areaTecnica: area,
  };
}

module.exports = {
  AREAS_OPERACIONAIS_PROFOR,
  AREAS_TECNICAS_SALDO_RESIDUAL,
  DESCRITORES_SALDO_RESIDUAL,
  DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA,
  NATUREZA_SALDO_RESIDUAL_MISTA,
  NATUREZAS_SALDO_RESIDUAL,
  normalizarTextoSaldoResidual,
  ehSaldoResidualProfor,
  normalizarNaturezaSaldoResidual,
  naturezasSaldoResidualDoTexto,
  naturezaSaldoResidualEhMista,
  naturezaSaldoResidualValida,
  normalizarAreaSaldoResidual,
  areaSaldoResidualEhTecnica,
  areaSaldoResidualEhOperacional,
  criarChaveSaldoResidual,
  separarMemoriaSaldoResidualPorNatureza,
  avaliarSaldoResidual,
};
