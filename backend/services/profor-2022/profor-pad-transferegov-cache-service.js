const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const NOME_ARQUIVO_CACHE = "profor-2022-pad-transferegov-cache.json";

function obterCaminhoCache(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  return path.join(repoRoot, "backend", "data", "cache", NOME_ARQUIVO_CACHE);
}

function calcularHashConteudo(itens) {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(itens || []));
  return hash.digest("hex");
}

function calcularHashGlobal(convenios) {
  const hash = crypto.createHash("sha256");
  const hashes = (convenios || []).map((c) => c.hashConteudo || "").sort();
  hash.update(hashes.join("|"));
  return hash.digest("hex");
}

function montarCachePadTransferegov(resultadosExtracao) {
  const convenios = (resultadosExtracao || []).map((c) => {
    const hash = c.hashConteudo || calcularHashConteudo(c.itens);
    return {
      numeroConvenio: String(c.numeroConvenio || "").trim(),
      uf: String(c.uf || "").trim(),
      origemUsada: String(c.origemUsada || "http").trim(),
      extraidoEm: String(c.extraidoEm || new Date().toISOString()),
      totalItens: Number(c.totalItens ?? (c.itens ? c.itens.length : 0)),
      totalizadores: c.totalizadores || {},
      hashConteudo: hash,
      aptoParaImportacaoTecnica: c.aptoParaImportacaoTecnica !== false && (!c.bloqueiosTecnicos || c.bloqueiosTecnicos.length === 0),
      bloqueiosTecnicos: c.bloqueiosTecnicos || [],
      avisos: c.avisos || [],
      itens: (c.itens || []).map((item) => ({
        instrumento: String(item.instrumento || "").trim(),
        tipoDespesa: String(item.tipoDespesa || "").trim(),
        descricao: String(item.descricao || "").trim(),
        codigoNaturezaDespesa: String(item.codigoNaturezaDespesa || "").trim(),
        codigoNaturezaNormalizado: String(item.codigoNaturezaNormalizado || "").trim(),
        natureza: String(item.natureza || "").trim(),
        unidade: String(item.unidade || "").trim(),
        quantidade: Number(item.quantidade || 0),
        valorUnitario: Number(item.valorUnitario || 0),
        valorTotalPrevisto: Number(item.valorTotalPrevisto || 0),
        valorTotalExecutado: Number(item.valorTotalExecutado || 0),
        saldo: Number(item.saldo || 0),
      })),
    };
  });

  const totalItens = convenios.reduce((acc, c) => acc + c.totalItens, 0);

  return {
    versao: 1,
    origem: "transferegov",
    geradoEm: new Date().toISOString(),
    totalConvenios: convenios.length,
    totalItens: totalItens,
    hashGlobal: calcularHashGlobal(convenios),
    convenios: convenios,
  };
}

function validarCachePadTransferegov(cache) {
  if (!cache || typeof cache !== "object") {
    return { valido: false, erro: "Cache vazio ou não é um objeto." };
  }
  if (cache.versao !== 1) {
    return { valido: false, erro: "Versão do cache inválida." };
  }
  if (cache.origem !== "transferegov") {
    return { valido: false, erro: "Origem do cache inválida." };
  }
  if (!cache.convenios || !Array.isArray(cache.convenios)) {
    return { valido: false, erro: "O cache não possui a lista de convênios." };
  }
  if (cache.convenios.length === 0) {
    return { valido: false, erro: "O cache não possui convênios." };
  }

  // Verificar se há itens vazios ou convênios não aptos
  for (const c of cache.convenios) {
    if (c.aptoParaImportacaoTecnica === false) {
      return {
        valido: false,
        erro: `Convênio ${c.numeroConvenio} não está tecnicamente apto para importação.`,
        numeroConvenio: c.numeroConvenio,
        bloqueiosTecnicos: c.bloqueiosTecnicos || [],
      };
    }
    if (c.bloqueiosTecnicos && c.bloqueiosTecnicos.length > 0) {
      return {
        valido: false,
        erro: `Convênio ${c.numeroConvenio} possui bloqueios técnicos.`,
        numeroConvenio: c.numeroConvenio,
        bloqueiosTecnicos: c.bloqueiosTecnicos,
      };
    }
    if (!c.itens || !Array.isArray(c.itens) || c.itens.length === 0) {
      return {
        valido: false,
        erro: `Convênio ${c.numeroConvenio} não possui itens de despesa no cache.`,
        numeroConvenio: c.numeroConvenio,
      };
    }
  }

  // Verificar que não contém dados sensíveis ou HTML bruto na estrutura do JSON
  const raw = JSON.stringify(cache);
  if (raw.includes("<html") || raw.includes("ViewState") || raw.includes("cookie") || raw.includes("Authorization")) {
    return { valido: false, erro: "Cache contém dados proibidos (HTML, cookies ou headers sensíveis)." };
  }

  return { valido: true };
}

function salvarCachePadTransferegov(cache, opcoes = {}) {
  const validacao = validarCachePadTransferegov(cache);
  if (!validacao.valido) {
    throw new Error(`Falha na validação do cache: ${validacao.erro}`);
  }

  const caminhoCache = obterCaminhoCache(opcoes);
  const pastaCache = path.dirname(caminhoCache);

  if (!fs.existsSync(pastaCache)) {
    fs.mkdirSync(pastaCache, { recursive: true });
  }

  // Escrita atômica
  const caminhoTmp = `${caminhoCache}.tmp`;
  fs.writeFileSync(caminhoTmp, JSON.stringify(cache, null, 2), "utf8");
  fs.renameSync(caminhoTmp, caminhoCache);
  return true;
}

function lerCachePadTransferegov(opcoes = {}) {
  const caminhoCache = obterCaminhoCache(opcoes);
  if (!fs.existsSync(caminhoCache)) {
    return null;
  }

  try {
    const conteudo = fs.readFileSync(caminhoCache, "utf8");
    const cache = JSON.parse(conteudo);
    const validacao = validarCachePadTransferegov(cache);
    if (!validacao.valido) {
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function existeCachePadTransferegov(opcoes = {}) {
  const caminhoCache = obterCaminhoCache(opcoes);
  return fs.existsSync(caminhoCache);
}

module.exports = {
  obterCaminhoCache,
  calcularHashConteudo,
  calcularHashGlobal,
  montarCachePadTransferegov,
  validarCachePadTransferegov,
  salvarCachePadTransferegov,
  lerCachePadTransferegov,
  existeCachePadTransferegov,
};
