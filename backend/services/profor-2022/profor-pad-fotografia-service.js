const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

// Os 14 campos canônicos do plano de aplicação
const CAMPOS_CANONICOS = [
  "uf",
  "instrumento",
  "numero",
  "ano",
  "area",
  "natureza",
  "descricao",
  "quantidade",
  "valorUnitario",
  "valorPrevisto",
  "valorExecutado",
  "saldo",
  "saldoEconomicidade",
  "percentualExecucao",
];

/**
 * Arredonda quantidade com precisão de 6 casas (quantidade pode ser fracionária).
 */
function arredondarQuantidade(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round((numero + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * Filtra apenas os 14 campos canônicos de uma linha do plano de aplicação.
 */
function filtrarCamposCanonicos(linha) {
  const filtrado = {};

  const previsto = linha.valorPrevisto !== null && linha.valorPrevisto !== undefined
    ? arredondarMoedaProfor(linha.valorPrevisto)
    : 0;
  const executado = linha.valorExecutado !== null && linha.valorExecutado !== undefined
    ? arredondarMoedaProfor(linha.valorExecutado)
    : 0;
  const quantidade = linha.quantidade !== null && linha.quantidade !== undefined
    ? arredondarQuantidade(linha.quantidade)
    : 0;

  for (const campo of CAMPOS_CANONICOS) {
    let valor = linha[campo];

    if (campo === "quantidade") {
      valor = quantidade;
    } else if (campo === "valorPrevisto") {
      valor = previsto;
    } else if (campo === "valorExecutado") {
      valor = executado;
    } else if (campo === "saldo") {
      valor = valor !== null && valor !== undefined
        ? arredondarMoedaProfor(valor)
        : arredondarMoedaProfor(previsto - executado);
    } else if (campo === "percentualExecucao") {
      valor = valor !== null && valor !== undefined
        ? arredondarMoedaProfor(valor)
        : (previsto > 0 ? Math.round((executado / previsto) * 10000) / 100 : 0);
    } else if (campo === "valorUnitario") {
      valor = valor !== null && valor !== undefined
        ? arredondarMoedaProfor(valor)
        : (quantidade > 0 ? Math.round((previsto / quantidade + Number.EPSILON) * 1e6) / 1e6 : 0);
    } else if (campo === "saldoEconomicidade") {
      valor = valor !== null && valor !== undefined ? arredondarMoedaProfor(valor) : 0;
    } else {
      // Campos de texto (uf, instrumento, numero, ano, area, natureza, descricao)
      valor = valor !== null && valor !== undefined ? String(valor).trim() : "";
    }

    filtrado[campo] = valor;
  }
  return filtrado;
}

/**
 * Ordena deterministicamente o array de linhas canônicas.
 */
function ordenarPlanoCanonico(linhas) {
  return [...linhas].sort((a, b) => {
    const numA = String(a.numero || "");
    const numB = String(b.numero || "");
    if (numA !== numB) return numA.localeCompare(numB);

    const ufA = String(a.uf || "").toUpperCase();
    const ufB = String(b.uf || "").toUpperCase();
    if (ufA !== ufB) return ufA.localeCompare(ufB);

    const areaA = String(a.area || "").toUpperCase();
    const areaB = String(b.area || "").toUpperCase();
    if (areaA !== areaB) return areaA.localeCompare(areaB);

    const natA = String(a.natureza || "").toUpperCase();
    const natB = String(b.natureza || "").toUpperCase();
    if (natA !== natB) return natA.localeCompare(natB);

    const descA = String(a.descricao || "").trim().toUpperCase();
    const descB = String(b.descricao || "").trim().toUpperCase();
    return descA.localeCompare(descB);
  });
}

/**
 * Calcula o checksum SHA-256 do plano de aplicação canônico serializado em JSON estável.
 */
function calcularChecksumSnapshot(linhasOrdenadas) {
  const jsonStr = JSON.stringify(linhasOrdenadas);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

/**
 * Gera uma fotografia canônica estruturada a partir de um plano de aplicação reconstruído.
 *
 * @param {Array} planoReconstruido Array de linhas de plano de aplicação.
 * @returns {Object} A fotografia canônica estruturada.
 */
function gerarFotografiaCanonica(planoReconstruido) {
  if (!Array.isArray(planoReconstruido)) {
    throw new Error("O plano de aplicação fornecido deve ser um array.");
  }

  // 1. Filtrar apenas os campos canônicos
  const linhasFiltradas = planoReconstruido.map(filtrarCamposCanonicos);

  // 2. Ordenar deterministicamente
  const linhasOrdenadas = ordenarPlanoCanonico(linhasFiltradas);

  // 3. Calcular resumo financeiro
  let valorPrevistoTotal = 0;
  let valorExecutadoTotal = 0;
  let quantidadeTotal = 0;

  for (const linha of linhasOrdenadas) {
    valorPrevistoTotal = arredondarMoedaProfor(valorPrevistoTotal + linha.valorPrevisto);
    valorExecutadoTotal = arredondarMoedaProfor(valorExecutadoTotal + linha.valorExecutado);
    quantidadeTotal = arredondarQuantidade(quantidadeTotal + linha.quantidade);
  }

  const saldoTotal = arredondarMoedaProfor(valorPrevistoTotal - valorExecutadoTotal);

  // 4. Calcular o checksum estável das linhas
  const checksum = calcularChecksumSnapshot(linhasOrdenadas);

  return {
    geradoEm: new Date().toISOString(),
    checksum,
    resumo: {
      totalLinhas: linhasOrdenadas.length,
      valorPrevistoTotal,
      valorExecutadoTotal,
      saldoTotal,
      quantidadeTotal,
    },
    planoAplicacao: linhasOrdenadas,
  };
}

/**
 * Salva a fotografia canônica em formato JSON no caminho especificado.
 */
function salvarFotografia(caminho, fotografia) {
  const dir = path.dirname(caminho);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(caminho, `${JSON.stringify(fotografia, null, 2)}\n`, "utf8");
}

module.exports = {
  CAMPOS_CANONICOS,
  gerarFotografiaCanonica,
  salvarFotografia,
};
