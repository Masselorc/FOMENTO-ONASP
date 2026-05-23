const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

const VERSAO_SNAPSHOT = "0.2";
const PARSER_VERSAO = "profor-pad-fotografia-service@0.2";

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

const CAMPOS_ESSENCIAIS = ["numero", "uf", "natureza", "descricao"];
const VALORES_VAZIOS = new Set(["", "-", "N/A", "NA", "NULL", "UNDEFINED"]);

function ehVazioSemantico(valor) {
  if (valor === null || valor === undefined) return true;
  return VALORES_VAZIOS.has(String(valor).trim().toUpperCase());
}

function normalizarTextoCanonico(valor) {
  if (ehVazioSemantico(valor)) return "";
  return String(valor)
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function removerDiacriticos(valor) {
  if (ehVazioSemantico(valor)) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

function normalizarTextoParaChave(valor) {
  return removerDiacriticos(normalizarTextoCanonico(valor))
    .replace(/[.,;:()[\]{}"'`´^~\\/|_+=*!?<>@#$%&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizarTextoParaChave(valor) {
  const tokens = normalizarTextoParaChave(valor)
    .split(" ")
    .filter(Boolean);
  return [...new Set(tokens)].sort((a, b) => a.localeCompare(b)).join(" ");
}

function arredondarQuantidade(valor) {
  if (ehVazioSemantico(valor)) return 0;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round((numero + Number.EPSILON) * 1e6) / 1e6;
}

function normalizarMoeda(valor) {
  if (ehVazioSemantico(valor)) return 0;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return arredondarMoedaProfor(numero);
}

function stableStringify(valor) {
  if (Array.isArray(valor)) {
    return `[${valor.map(stableStringify).join(",")}]`;
  }
  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor).sort().map((chave) => (
      `${JSON.stringify(chave)}:${stableStringify(valor[chave])}`
    )).join(",")}}`;
  }
  return JSON.stringify(valor);
}

function sha256Objeto(objeto) {
  return crypto.createHash("sha256").update(stableStringify(objeto)).digest("hex");
}

function criarChaveMaterial(linha) {
  return [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.natureza),
    normalizarTextoParaChave(linha.area),
    normalizarTextoParaChave(linha.descricaoOriginal ?? linha.descricao),
  ].join("|");
}

function criarChaveComparacao(linha) {
  return [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.natureza),
    normalizarTextoParaChave(linha.area),
    tokenizarTextoParaChave(linha.descricaoOriginal ?? linha.descricao),
  ].join("|");
}

function criarChaveContexto(linha) {
  return [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.natureza),
    normalizarTextoParaChave(linha.area),
  ].join("|");
}

function calcularHashItem(linha) {
  return sha256Objeto({
    numero: normalizarTextoParaChave(linha.numero),
    uf: normalizarTextoParaChave(linha.uf),
    area: normalizarTextoParaChave(linha.area),
    natureza: normalizarTextoParaChave(linha.natureza),
    descricaoNormalizada: normalizarTextoCanonico(linha.descricaoOriginal ?? linha.descricao),
    quantidade: linha.quantidade,
    valorUnitario: linha.valorUnitario,
    valorPrevisto: linha.valorPrevisto,
    valorExecutado: linha.valorExecutado,
    saldo: linha.saldo,
  });
}

function normalizarLinhaPadCanonica(linhaOriginal) {
  const linha = linhaOriginal || {};
  const avisos = [];
  const erros = [];

  const descricaoOriginal = ehVazioSemantico(linha.descricao) ? "" : String(linha.descricao).replace(/\s+/g, " ").trim();
  const quantidade = arredondarQuantidade(linha.quantidade);
  const valorPrevisto = normalizarMoeda(linha.valorPrevisto);
  const valorExecutado = normalizarMoeda(linha.valorExecutado);
  const saldoInformado = normalizarMoeda(linha.saldo);
  const saldoEconomicidade = normalizarMoeda(linha.saldoEconomicidade);

  if (quantidade === null) erros.push({ tipo: "quantidade_invalida", campo: "quantidade", valor: linha.quantidade });
  for (const campo of ["valorPrevisto", "valorExecutado", "saldo", "saldoEconomicidade", "valorUnitario"]) {
    if (!ehVazioSemantico(linha[campo]) && normalizarMoeda(linha[campo]) === null) {
      erros.push({ tipo: "valor_invalido", campo, valor: linha[campo] });
    }
  }

  const qtd = quantidade === null ? 0 : quantidade;
  const previsto = valorPrevisto === null ? 0 : valorPrevisto;
  const executado = valorExecutado === null ? 0 : valorExecutado;
  const saldo = saldoInformado === null || ehVazioSemantico(linha.saldo)
    ? arredondarMoedaProfor(previsto - executado)
    : saldoInformado;
  const valorUnitarioInformado = normalizarMoeda(linha.valorUnitario);
  const valorUnitario = valorUnitarioInformado === null || ehVazioSemantico(linha.valorUnitario)
    ? (qtd > 0 ? Math.round((previsto / qtd + Number.EPSILON) * 1e6) / 1e6 : 0)
    : valorUnitarioInformado;
  const percentualExecucaoInformado = normalizarMoeda(linha.percentualExecucao);
  const percentualExecucao = percentualExecucaoInformado === null || ehVazioSemantico(linha.percentualExecucao)
    ? (previsto > 0 ? Math.round((executado / previsto) * 10000) / 100 : 0)
    : percentualExecucaoInformado;

  const canonica = {
    uf: normalizarTextoCanonico(linha.uf),
    instrumento: normalizarTextoCanonico(linha.instrumento),
    numero: normalizarTextoCanonico(linha.numero),
    ano: normalizarTextoCanonico(linha.ano),
    area: normalizarTextoCanonico(linha.area),
    natureza: normalizarTextoCanonico(linha.natureza),
    descricao: normalizarTextoCanonico(descricaoOriginal),
    descricaoOriginal,
    descricaoNormalizada: normalizarTextoCanonico(descricaoOriginal),
    quantidade: qtd,
    valorUnitario,
    valorPrevisto: previsto,
    valorExecutado: executado,
    saldo,
    saldoEconomicidade: saldoEconomicidade === null ? 0 : saldoEconomicidade,
    percentualExecucao,
    avisos,
  };

  for (const campo of CAMPOS_ESSENCIAIS) {
    if (!canonica[campo]) {
      avisos.push({ tipo: "dados_insuficientes", campo });
    }
  }

  canonica.chaveMaterial = criarChaveMaterial(canonica);
  canonica.chaveComparacao = criarChaveComparacao(canonica);
  canonica.chaveContexto = criarChaveContexto(canonica);
  canonica.hashItem = calcularHashItem(canonica);

  if (erros.length) {
    canonica.erros = erros;
  }

  return canonica;
}

function ordenarPlanoCanonico(linhas) {
  return [...linhas].sort((a, b) => {
    const campos = ["numero", "uf", "natureza", "area", "descricaoNormalizada", "hashItem"];
    for (const campo of campos) {
      const av = String(a[campo] || "");
      const bv = String(b[campo] || "");
      if (av !== bv) return av.localeCompare(bv);
    }
    return 0;
  });
}

function calcularChecksumSnapshot(linhasOrdenadas) {
  const base = linhasOrdenadas.map((linha) => ({
    uf: linha.uf,
    instrumento: linha.instrumento,
    numero: linha.numero,
    ano: linha.ano,
    area: linha.area,
    natureza: linha.natureza,
    descricaoOriginal: linha.descricaoOriginal,
    descricaoNormalizada: linha.descricaoNormalizada,
    quantidade: linha.quantidade,
    valorUnitario: linha.valorUnitario,
    valorPrevisto: linha.valorPrevisto,
    valorExecutado: linha.valorExecutado,
    saldo: linha.saldo,
    saldoEconomicidade: linha.saldoEconomicidade,
    percentualExecucao: linha.percentualExecucao,
    chaveMaterial: linha.chaveMaterial,
    chaveComparacao: linha.chaveComparacao,
    hashItem: linha.hashItem,
  }));
  return sha256Objeto(base);
}

function registrarColisoes(linhas, campoChave, tipo, destinoAvisos) {
  const mapa = new Map();
  for (const linha of linhas) {
    const chave = linha[campoChave];
    if (!chave) continue;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(linha);
  }

  for (const [chave, grupo] of mapa.entries()) {
    if (grupo.length <= 1) continue;
    const hashes = new Set(grupo.map((item) => item.hashItem));
    const registro = {
      tipo,
      chave,
      totalItens: grupo.length,
      hashesDistintos: hashes.size,
    };
    destinoAvisos.push(registro);
    for (const item of grupo) {
      item.avisos.push(registro);
    }
  }
}

function gerarFotografiaCanonica(planoReconstruido) {
  if (!Array.isArray(planoReconstruido)) {
    throw new Error("O plano de aplicação fornecido deve ser um array.");
  }

  const avisos = [];
  const erros = [];
  const linhasOrdenadas = ordenarPlanoCanonico(planoReconstruido.map(normalizarLinhaPadCanonica));

  registrarColisoes(linhasOrdenadas, "chaveMaterial", "colisao_chave", avisos);
  registrarColisoes(linhasOrdenadas, "chaveComparacao", "chave_ambigua", avisos);

  let totalValorPrevisto = 0;
  let totalValorExecutado = 0;
  let totalQuantidade = 0;

  for (const linha of linhasOrdenadas) {
    totalValorPrevisto = arredondarMoedaProfor(totalValorPrevisto + linha.valorPrevisto);
    totalValorExecutado = arredondarMoedaProfor(totalValorExecutado + linha.valorExecutado);
    totalQuantidade = arredondarQuantidade(totalQuantidade + linha.quantidade);
    if (linha.avisos.length) avisos.push(...linha.avisos.filter((aviso) => aviso.tipo === "dados_insuficientes"));
    if (Array.isArray(linha.erros)) erros.push(...linha.erros);
  }

  const totalSaldo = arredondarMoedaProfor(totalValorPrevisto - totalValorExecutado);
  const checksum = calcularChecksumSnapshot(linhasOrdenadas);

  return {
    versaoSnapshot: VERSAO_SNAPSHOT,
    geradoEm: new Date().toISOString(),
    origem: "reconstrucao-pad",
    parserVersao: PARSER_VERSAO,
    checksum,
    resumo: {
      totalLinhas: linhasOrdenadas.length,
      totalValorPrevisto,
      totalValorExecutado,
      totalSaldo,
      totalQuantidade,
      totalAvisos: avisos.length,
      totalErros: erros.length,
      valorPrevistoTotal: totalValorPrevisto,
      valorExecutadoTotal: totalValorExecutado,
      saldoTotal: totalSaldo,
      quantidadeTotal: totalQuantidade,
    },
    avisos,
    erros,
    planoAplicacao: linhasOrdenadas,
  };
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function montarMarkdownFotografia(fotografia) {
  const r = fotografia.resumo || {};
  return [
    "# PROFOR 2022 - Fotografia canônica PAD",
    "",
    `Gerado em: ${fotografia.geradoEm || "-"}`,
    `Versão do snapshot: ${fotografia.versaoSnapshot || "-"}`,
    `Parser: ${fotografia.parserVersao || "-"}`,
    `Origem: ${fotografia.origem || "-"}`,
    `Checksum: \`${fotografia.checksum || "-"}\``,
    "",
    "## Resumo",
    "",
    `- Total de linhas: ${r.totalLinhas || 0}`,
    `- Valor previsto total: R$ ${formatarMoeda(r.totalValorPrevisto ?? r.valorPrevistoTotal)}`,
    `- Valor executado total: R$ ${formatarMoeda(r.totalValorExecutado ?? r.valorExecutadoTotal)}`,
    `- Saldo total: R$ ${formatarMoeda(r.totalSaldo ?? r.saldoTotal)}`,
    `- Quantidade total: ${r.totalQuantidade ?? r.quantidadeTotal ?? 0}`,
    `- Avisos: ${r.totalAvisos || 0}`,
    `- Erros: ${r.totalErros || 0}`,
    "",
    "## Garantias",
    "",
    "- Relatório gerado em dry-run.",
    "- Não publica dados.",
    "- Não altera `frontend/data/publicados/`.",
    "- Não altera SQLite, WAL ou SHM.",
  ].join("\n") + "\n";
}

function salvarFotografia(caminho, fotografia) {
  const dir = path.dirname(caminho);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(caminho, `${JSON.stringify(fotografia, null, 2)}\n`, "utf8");
}

function salvarMarkdownFotografia(caminho, fotografia) {
  const dir = path.dirname(caminho);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(caminho, montarMarkdownFotografia(fotografia), "utf8");
}

module.exports = {
  CAMPOS_CANONICOS,
  VERSAO_SNAPSHOT,
  gerarFotografiaCanonica,
  salvarFotografia,
  normalizarTextoCanonico,
  normalizarTextoParaChave,
  removerDiacriticos,
  criarChaveMaterial,
  criarChaveComparacao,
  calcularHashItem,
  normalizarLinhaPadCanonica,
  calcularChecksumSnapshot,
  montarMarkdownFotografia,
  salvarMarkdownFotografia,
};
