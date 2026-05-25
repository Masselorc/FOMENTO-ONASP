const crypto = require("node:crypto");

const {
  limparTextoPad,
  normalizarRotuloPad,
  normalizarCodigoNaturezaPad,
  derivarNaturezaPad,
  converterNumeroPad,
  converterQuantidadePad,
} = require("./profor-pad-normalizacao-service");
const {
  normalizarDescricaoRateioProfor,
} = require("./profor-rateio-extracao-service");

const COLUNAS_PAD_PUBLICO = {
  tipoDespesa: ["TIPO DESPESA", "TIPO DA DESPESA"],
  descricao: ["DESCRICAO"],
  codigoNaturezaDespesa: ["COD NAT DESPESA", "CODIGO NAT DESPESA", "COD NATUREZA DESPESA", "CODIGO NATUREZA DESPESA"],
  unidade: ["UNID", "UNIDADE"],
  quantidade: ["QUANTIDADE"],
  valorUnitario: ["VALOR UNIT", "VALOR UNITARIO"],
  valorTotalPrevisto: ["VALOR TOTAL PREVISTO"],
  valorTotalExecutado: ["VALOR TOTAL EXECUTADO"],
  saldo: ["SALDO"],
};

function arredondarMoeda(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function arredondarQuantidade(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function decodificarEntidadesHtml(valor) {
  return String(valor ?? "")
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo) => String.fromCodePoint(parseInt(codigo, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&#039;/gi, "'");
}

function textoCelula(html) {
  return limparTextoPad(
    decodificarEntidadesHtml(String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "))
  );
}

function extrairAtributo(tag, nome) {
  const match = String(tag || "").match(new RegExp(`\\b${nome}=["']([^"']*)["']`, "i"));
  return match ? decodificarEntidadesHtml(match[1]) : null;
}

function extrairTabelas(html) {
  const tabelas = [];
  const pilha = [];
  const conteudo = String(html || "");
  const padrao = /<\/?table\b[^>]*>/gi;
  let match;
  while ((match = padrao.exec(conteudo)) !== null) {
    const tag = match[0];
    if (/^<table\b/i.test(tag)) {
      pilha.push(match.index);
      continue;
    }
    const inicio = pilha.pop();
    if (inicio !== undefined) tabelas.push(conteudo.slice(inicio, padrao.lastIndex));
  }
  return tabelas.sort((a, b) => a.length - b.length);
}

function extrairLinhasTabela(tabelaHtml) {
  const linhas = [];
  const padraoTr = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let trMatch;
  while ((trMatch = padraoTr.exec(tabelaHtml)) !== null) {
    const trHtml = trMatch[0];
    const celulas = [];
    const padraoCelula = /<(td|th)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let celulaMatch;
    while ((celulaMatch = padraoCelula.exec(trHtml)) !== null) {
      const tag = celulaMatch[0].match(/^<[^>]+>/)?.[0] || "";
      const colspan = Number(extrairAtributo(tag, "colspan") || 1);
      const texto = textoCelula(celulaMatch[0]);
      celulas.push(texto);
      for (let i = 1; i < colspan; i += 1) celulas.push("");
    }
    if (celulas.length) linhas.push(celulas);
  }
  return linhas;
}

function localizarCabecalho(linhas) {
  for (let i = 0; i < linhas.length; i += 1) {
    const normalizada = linhas[i].map(normalizarRotuloPad);
    const temDescricao = normalizada.some((valor) => valor === "DESCRICAO");
    const temQuantidade = normalizada.some((valor) => valor === "QUANTIDADE");
    const temPrevisto = normalizada.some((valor) => valor === "VALOR TOTAL PREVISTO");
    if (!temDescricao || !temQuantidade || !temPrevisto) continue;

    const colunas = {};
    for (const [campo, rotulos] of Object.entries(COLUNAS_PAD_PUBLICO)) {
      const alvos = rotulos.map(normalizarRotuloPad);
      const indice = normalizada.findIndex((valor) => alvos.some((alvo) => valor === alvo || valor.includes(alvo)));
      if (indice >= 0) colunas[campo] = indice;
    }
    return { indiceLinha: i, colunas };
  }
  return null;
}

function linhaEhTotalGeral(linha) {
  return (linha || []).some((celula) => normalizarRotuloPad(celula).includes("TOTAL GERAL"));
}

function textoDaColuna(linha, indice) {
  if (indice === undefined || indice === null) return "";
  return limparTextoPad(linha[indice]);
}

function numeroDaColuna(linha, indice) {
  return converterNumeroPad(textoDaColuna(linha, indice)).valor;
}

function quantidadeDaColuna(linha, indice) {
  return converterQuantidadePad(textoDaColuna(linha, indice)).valor;
}

function criarHashItemPad({ instrumento, descricaoNormalizada, codigoNaturezaDespesa, quantidade, valorUnitario, valorTotalPrevisto, valorTotalExecutado, saldo }) {
  const partes = [
    instrumento,
    descricaoNormalizada,
    normalizarCodigoNaturezaPad(codigoNaturezaDespesa),
    arredondarQuantidade(quantidade).toFixed(6),
    arredondarMoeda(valorUnitario).toFixed(2),
    arredondarMoeda(valorTotalPrevisto).toFixed(2),
    arredondarMoeda(valorTotalExecutado).toFixed(2),
    arredondarMoeda(saldo).toFixed(2),
  ];
  return crypto.createHash("sha1").update(partes.join("|")).digest("hex");
}

function normalizarItemPadPublico(item, instrumento) {
  const descricao = limparTextoPad(decodificarEntidadesHtml(item.descricao));
  const codigoNaturezaDespesa = limparTextoPad(decodificarEntidadesHtml(item.codigoNaturezaDespesa));
  const descricaoNormalizada = normalizarDescricaoRateioProfor(descricao);
  const quantidade = arredondarQuantidade(item.quantidade);
  const valorUnitario = arredondarMoeda(item.valorUnitario);
  const valorTotalPrevisto = arredondarMoeda(item.valorTotalPrevisto);
  const valorTotalExecutado = arredondarMoeda(item.valorTotalExecutado);
  const saldo = arredondarMoeda(item.saldo ?? (valorTotalPrevisto - valorTotalExecutado));

  return {
    instrumento: String(instrumento || item.instrumento || "").trim(),
    tipoDespesa: limparTextoPad(decodificarEntidadesHtml(item.tipoDespesa)),
    descricao,
    descricaoNormalizada,
    codigoNaturezaDespesa,
    codigoNaturezaNormalizado: normalizarCodigoNaturezaPad(codigoNaturezaDespesa),
    natureza: derivarNaturezaPad(codigoNaturezaDespesa),
    unidade: limparTextoPad(decodificarEntidadesHtml(item.unidade)),
    quantidade,
    valorUnitario,
    valorTotalPrevisto,
    valorTotalExecutado,
    saldo,
    textoOriginal: limparTextoPad(decodificarEntidadesHtml(item.textoOriginal || descricao)),
    hashItem: criarHashItemPad({
      instrumento,
      descricaoNormalizada,
      codigoNaturezaDespesa,
      quantidade,
      valorUnitario,
      valorTotalPrevisto,
      valorTotalExecutado,
      saldo,
    }),
  };
}

function parsearTabelaPad(tabelaHtml, instrumento) {
  const linhas = extrairLinhasTabela(tabelaHtml);
  const cabecalho = localizarCabecalho(linhas);
  if (!cabecalho) return null;

  const itens = [];
  let totaisTabela = null;
  for (let i = cabecalho.indiceLinha + 1; i < linhas.length; i += 1) {
    const linha = linhas[i];
    if (!linha.some((celula) => limparTextoPad(celula))) continue;
    if (linhaEhTotalGeral(linha)) {
      totaisTabela = {
        valorTotalPrevisto: arredondarMoeda(numeroDaColuna(linha, cabecalho.colunas.valorTotalPrevisto)),
        valorTotalExecutado: arredondarMoeda(numeroDaColuna(linha, cabecalho.colunas.valorTotalExecutado)),
        saldo: arredondarMoeda(numeroDaColuna(linha, cabecalho.colunas.saldo)),
      };
      if (itens.length > 0) break;
      continue;
    }

    const descricao = textoDaColuna(linha, cabecalho.colunas.descricao);
    if (!descricao) continue;
    itens.push(normalizarItemPadPublico({
      tipoDespesa: textoDaColuna(linha, cabecalho.colunas.tipoDespesa),
      descricao,
      codigoNaturezaDespesa: textoDaColuna(linha, cabecalho.colunas.codigoNaturezaDespesa),
      unidade: textoDaColuna(linha, cabecalho.colunas.unidade),
      quantidade: quantidadeDaColuna(linha, cabecalho.colunas.quantidade),
      valorUnitario: numeroDaColuna(linha, cabecalho.colunas.valorUnitario),
      valorTotalPrevisto: numeroDaColuna(linha, cabecalho.colunas.valorTotalPrevisto),
      valorTotalExecutado: numeroDaColuna(linha, cabecalho.colunas.valorTotalExecutado),
      saldo: numeroDaColuna(linha, cabecalho.colunas.saldo),
      textoOriginal: linha.join(" | "),
    }, instrumento));
  }

  return { itens, totaisTabela };
}

function somarItens(itens, campo) {
  return arredondarMoeda((itens || []).reduce((total, item) => total + (Number(item[campo]) || 0), 0));
}

function parsearRelatorioPadTransferegov(html, opcoes = {}) {
  const instrumento = String(opcoes.instrumento || "").trim();
  const tabelas = extrairTabelas(html);
  for (const tabela of tabelas) {
    const resultado = parsearTabelaPad(tabela, instrumento);
    if (!resultado) continue;
    if (resultado.itens.length === 0) continue;
    const totais = resultado.totaisTabela || {
      valorTotalPrevisto: somarItens(resultado.itens, "valorTotalPrevisto"),
      valorTotalExecutado: somarItens(resultado.itens, "valorTotalExecutado"),
      saldo: somarItens(resultado.itens, "saldo"),
    };
    return {
      instrumento,
      totalItens: resultado.itens.length,
      totais,
      itens: resultado.itens,
    };
  }
  throw new Error("Tabela obrigatória de itens PAD não localizada no HTML do Transferegov.");
}

module.exports = {
  COLUNAS_PAD_PUBLICO,
  criarHashItemPad,
  decodificarEntidadesHtml,
  normalizarItemPadPublico,
  parsearRelatorioPadTransferegov,
};
