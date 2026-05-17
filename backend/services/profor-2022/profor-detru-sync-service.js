// Cruzamento da carteira local de convênios monitorados com o arquivo DETRU.
// Uso: rotina backend de atualização — NÃO deve ser chamado no carregamento da página.
// O arquivo siconv_convenio.csv.zip é grande; o fluxo correto é:
//   atualização diária → leitura backend → filtro → mapeamento → cache/snapshot
//   → páginas consomem apenas o cache, nunca o ZIP diretamente.
// Esta etapa não grava dados no banco e não cria cache ainda.

const fs = require("fs");
const { listarConveniosMonitorados } = require("./convenios-monitorados-service");
const { lerCsvDetruConvenio } = require("./detru-convenio-reader");
const {
  validarColunasObrigatoriasDetru,
  mapearConveniosDetruParaProfor,
} = require("./detru-convenio-mapper");

function obterNumerosConveniosAtivos() {
  return listarConveniosMonitorados({ incluirInativos: false });
}

function filtrarLinhasDetruPorCarteira(rowsDetru, conveniosMonitorados) {
  // Monta índice: numeroConvenio → Set<ano|null> com todos os anos registrados na carteira.
  // null no Set significa "sem restrição de ano" — aceita qualquer ANO do DETRU.
  const carteiraPorNumero = new Map();
  for (const c of conveniosMonitorados) {
    if (!carteiraPorNumero.has(c.numeroConvenio)) {
      carteiraPorNumero.set(c.numeroConvenio, new Set());
    }
    carteiraPorNumero.get(c.numeroConvenio).add(c.ano ?? null);
  }

  const encontradas = [];
  const numerosEncontrados = new Set();

  for (const row of rowsDetru) {
    const nr = String(row.NR_CONVENIO ?? "").trim();
    if (!nr || !carteiraPorNumero.has(nr)) continue;

    const anosCarteira = carteiraPorNumero.get(nr);
    const anoDetru = String(row.ANO ?? "").trim() || null;

    // Aceitar se a carteira tem null (sem restrição de ano) ou se o ano DETRU coincide
    if (anosCarteira.has(null) || anosCarteira.has(anoDetru)) {
      encontradas.push(row);
      numerosEncontrados.add(nr);
    }
  }

  const naoEncontrados = conveniosMonitorados.filter(
    (c) => !numerosEncontrados.has(c.numeroConvenio)
  );

  return { encontradas, naoEncontrados };
}

function cruzarCarteiraComDetru(caminhoZip) {
  const consultadoEm = new Date().toISOString();

  const rowsDetru = lerCsvDetruConvenio(caminhoZip);
  const colunas = rowsDetru.length ? Object.keys(rowsDetru[0]) : [];
  const validacaoColunas = validarColunasObrigatoriasDetru(colunas);

  const carteira = obterNumerosConveniosAtivos();
  const { encontradas, naoEncontrados } = filtrarLinhasDetruPorCarteira(rowsDetru, carteira);
  const conveniosEncontrados = mapearConveniosDetruParaProfor(encontradas);

  return {
    sucesso: true,
    consultadoEm,
    totalCarteiraAtiva: carteira.length,
    totalLinhasDetruLidas: rowsDetru.length,
    totalEncontrados: conveniosEncontrados.length,
    totalNaoEncontrados: naoEncontrados.length,
    conveniosEncontrados,
    conveniosNaoEncontrados: naoEncontrados.map((c) => ({
      numeroConvenio: c.numeroConvenio,
      ano: c.ano,
      uf: c.uf,
    })),
    colunas,
    validacaoColunas,
  };
}

function resumirCruzamentoDetru(resultado) {
  const linhas = [
    "--- Cruzamento carteira × DETRU ---",
    `Consultado em:            ${resultado.consultadoEm}`,
    `Carteira ativa:           ${resultado.totalCarteiraAtiva}`,
    `Linhas DETRU lidas:       ${resultado.totalLinhasDetruLidas}`,
    `Encontrados:              ${resultado.totalEncontrados}`,
    `Não encontrados:          ${resultado.totalNaoEncontrados}`,
  ];

  if (resultado.totalNaoEncontrados > 0) {
    linhas.push("Não encontrados no DETRU:");
    resultado.conveniosNaoEncontrados.forEach((c) => {
      linhas.push(`  - ${c.numeroConvenio}/${c.ano ?? "s/ano"} (${c.uf ?? "s/UF"})`);
    });
  }

  if (resultado.validacaoColunas && !resultado.validacaoColunas.ok) {
    linhas.push(`Colunas ausentes: ${resultado.validacaoColunas.ausentes.join(", ")}`);
  }

  linhas.push("-----------------------------------");
  return linhas.join("\n");
}

function validarArquivoDetruParaCarteira(caminhoZip) {
  if (!fs.existsSync(caminhoZip)) {
    return {
      ok: false,
      erro: `Arquivo não encontrado: ${caminhoZip}`,
      totalLinhas: 0,
      colunas: [],
      validacaoColunas: null,
    };
  }

  try {
    const rowsDetru = lerCsvDetruConvenio(caminhoZip);
    const colunas = rowsDetru.length ? Object.keys(rowsDetru[0]) : [];
    const validacaoColunas = validarColunasObrigatoriasDetru(colunas);
    return {
      ok: validacaoColunas.ok,
      totalLinhas: rowsDetru.length,
      colunas,
      validacaoColunas,
      erro: null,
    };
  } catch (err) {
    return {
      ok: false,
      totalLinhas: 0,
      colunas: [],
      validacaoColunas: null,
      erro: err.message,
    };
  }
}

module.exports = {
  obterNumerosConveniosAtivos,
  filtrarLinhasDetruPorCarteira,
  cruzarCarteiraComDetru,
  resumirCruzamentoDetru,
  validarArquivoDetruParaCarteira,
};
