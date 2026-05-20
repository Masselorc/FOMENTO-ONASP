const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const {
  limparTextoPad,
  normalizarRotuloPad,
  normalizarCodigoNaturezaPad,
  derivarNaturezaPad,
  converterNumeroPad,
  converterDataPad,
} = require("./profor-pad-normalizacao-service");

const PADRAO_ARQUIVO_PAD = /^RelatorioItensDespesasPAD_.*\.xls$/i;
const LIMITE_AVISO_DIFERENCA = 1;
const TOLERANCIA_CENTAVOS = 0.01;

const ROTULOS_CABECALHO = {
  codigoInstrumento: ["CODIGO DO INSTRUMENTO"],
  concedente: ["CONCEDENTE"],
  convenente: ["CONVENENTE"],
  situacao: ["SITUACAO"],
  valorTotalPrevisto: ["VALOR TOTAL PREVISTO"],
  valorTotalExecutado: ["VALOR TOTAL EXECUTADO"],
  saldoTotal: ["SALDO TOTAL"],
  geradoEm: ["DATA HORA DE GERACAO", "DATA HORA GERACAO", "DATA DE GERACAO", "GERADO DIA"],
};

const COLUNAS_ITENS = {
  tipoDespesa: ["TIPO DESPESA"],
  descricao: ["DESCRICAO"],
  codigoNaturezaDespesa: ["COD NAT DESPESA", "CODIGO NAT DESPESA", "COD NATUREZA DESPESA"],
  unidade: ["UNID", "UNIDADE"],
  quantidade: ["QUANTIDADE"],
  valorUnitario: ["VALOR UNIT", "VALOR UNITARIO"],
  valorTotalPrevisto: ["VALOR TOTAL PREVISTO"],
  valorTotalExecutado: ["VALOR TOTAL EXECUTADO"],
  saldo: ["SALDO"],
};

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function arredondar(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function criarAlerta({ tipo, nivel = "aviso", arquivo = null, instrumento = null, aba = null, linha = null, detalhe }) {
  return {
    tipo,
    nivel,
    instrumento,
    detalhe,
    origem: { arquivo, aba, linha },
  };
}

function listarArquivosPad(repoRoot, pastaRelativa = "Planilhas/profor-2022/instrumentos") {
  const pastaAbsoluta = path.join(repoRoot, pastaRelativa);
  if (!fs.existsSync(pastaAbsoluta)) {
    return { pastaAbsoluta, arquivos: [] };
  }

  const arquivos = fs.readdirSync(pastaAbsoluta, { withFileTypes: true })
    .filter((entrada) => entrada.isFile())
    .map((entrada) => entrada.name)
    .filter((nome) => !nome.startsWith("~$") && PADRAO_ARQUIVO_PAD.test(nome))
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome) => path.join(pastaAbsoluta, nome));

  return { pastaAbsoluta, arquivos };
}

function obterLinhasPlanilha(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function celulaPreenchida(valor) {
  return limparTextoPad(valor) !== "";
}

function extrairValorRotuloMesmaCelula(valor, alvo) {
  const texto = limparTextoPad(valor);
  if (!texto) return null;

  const indiceSeparador = texto.indexOf(":");
  if (indiceSeparador >= 0) {
    const rotulo = normalizarRotuloPad(texto.slice(0, indiceSeparador));
    if (rotulo === alvo || rotulo.includes(alvo)) {
      return texto.slice(indiceSeparador + 1).trim();
    }
  }

  const rotuloCompleto = normalizarRotuloPad(texto);
  if (!rotuloCompleto.startsWith(alvo)) return null;

  return texto.slice(alvo.length).replace(/^[:\s-]+/, "").trim() || null;
}

function encontrarValorPorRotulo(linhas, rotulos) {
  const alvos = rotulos.map(normalizarRotuloPad);
  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i] || [];
    for (let j = 0; j < linha.length; j += 1) {
      const rotulo = normalizarRotuloPad(linha[j]);
      const valorMesmaCelula = alvos
        .map((alvo) => extrairValorRotuloMesmaCelula(linha[j], alvo))
        .find((valor) => celulaPreenchida(valor));
      if (valorMesmaCelula) return valorMesmaCelula;

      if (!alvos.some((alvo) => rotulo === alvo || rotulo.includes(alvo))) continue;

      for (let k = j + 1; k < linha.length; k += 1) {
        if (celulaPreenchida(linha[k])) return linha[k];
      }
      if (linhas[i + 1] && celulaPreenchida(linhas[i + 1][j])) return linhas[i + 1][j];
    }
  }
  return null;
}

function extrairCabecalho(linhas) {
  const bruto = {};
  for (const [campo, rotulos] of Object.entries(ROTULOS_CABECALHO)) {
    bruto[campo] = encontrarValorPorRotulo(linhas, rotulos);
  }

  const previsto = converterNumeroPad(bruto.valorTotalPrevisto);
  const executado = converterNumeroPad(bruto.valorTotalExecutado);
  const saldo = converterNumeroPad(bruto.saldoTotal);

  return {
    codigoInstrumento: limparTextoPad(bruto.codigoInstrumento),
    concedente: limparTextoPad(bruto.concedente),
    convenente: limparTextoPad(bruto.convenente),
    situacao: limparTextoPad(bruto.situacao),
    valorTotalPrevisto: previsto.valor,
    valorTotalExecutado: executado.valor,
    saldoTotal: saldo.valor,
    geradoEm: converterDataPad(bruto.geradoEm),
    camposValidos: {
      valorTotalPrevisto: previsto.valido,
      valorTotalExecutado: executado.valido,
      saldoTotal: saldo.valido,
    },
  };
}

function localizarCabecalhoTabela(linhas) {
  for (let i = 0; i < linhas.length; i += 1) {
    const linhaNormalizada = (linhas[i] || []).map(normalizarRotuloPad);
    const temDescricao = linhaNormalizada.some((valor) => valor === "DESCRICAO");
    const temQuantidade = linhaNormalizada.some((valor) => valor === "QUANTIDADE");
    const temPrevisto = linhaNormalizada.some((valor) => valor === "VALOR TOTAL PREVISTO");
    if (!temDescricao || !temQuantidade || !temPrevisto) continue;

    const mapa = {};
    for (const [campo, rotulos] of Object.entries(COLUNAS_ITENS)) {
      const alvos = rotulos.map(normalizarRotuloPad);
      const indice = linhaNormalizada.findIndex((valor) => alvos.some((alvo) => valor === alvo || valor.includes(alvo)));
      if (indice >= 0) mapa[campo] = indice;
    }
    return { indiceLinha: i, colunas: mapa };
  }

  return null;
}

function linhaEhTotalGeral(linha) {
  return (linha || []).some((celula) => normalizarRotuloPad(celula).includes("TOTAL GERAL"));
}

function linhaVazia(linha) {
  return !(linha || []).some(celulaPreenchida);
}

function validarCampoNumerico(alertas, campo, conversao, contexto) {
  if (conversao.valido) return;
  alertas.push(criarAlerta({
    tipo: campo === "valorTotalPrevisto" ? "valor_previsto_invalido" : "valor_executado_invalido",
    nivel: "impeditivo",
    ...contexto,
    detalhe: `Valor inválido em ${campo}.`,
  }));
}

function extrairItens(linhas, tabela, contexto, alertas) {
  const itens = [];
  let totalGeral = null;

  for (let i = tabela.indiceLinha + 1; i < linhas.length; i += 1) {
    const linha = linhas[i] || [];
    if (linhaEhTotalGeral(linha)) {
      totalGeral = linha;
      break;
    }
    if (linhaVazia(linha)) continue;

    const descricao = limparTextoPad(linha[tabela.colunas.descricao]);
    if (!descricao) continue;

    const codigoNaturezaDespesa = limparTextoPad(linha[tabela.colunas.codigoNaturezaDespesa]);
    const codigoNaturezaNormalizado = normalizarCodigoNaturezaPad(codigoNaturezaDespesa);
    const natureza = derivarNaturezaPad(codigoNaturezaDespesa);
    const quantidade = converterNumeroPad(linha[tabela.colunas.quantidade]);
    const valorUnitario = converterNumeroPad(linha[tabela.colunas.valorUnitario]);
    const valorPrevisto = converterNumeroPad(linha[tabela.colunas.valorTotalPrevisto]);
    const valorExecutado = converterNumeroPad(linha[tabela.colunas.valorTotalExecutado]);
    const saldo = converterNumeroPad(linha[tabela.colunas.saldo]);
    const linhaPlanilha = i + 1;

    validarCampoNumerico(alertas, "valorTotalPrevisto", valorPrevisto, { ...contexto, linha: linhaPlanilha });
    validarCampoNumerico(alertas, "valorTotalExecutado", valorExecutado, { ...contexto, linha: linhaPlanilha });

    if (natureza === "NAO_CLASSIFICADO") {
      alertas.push(criarAlerta({
        tipo: "natureza_nao_classificada",
        nivel: "impeditivo",
        ...contexto,
        linha: linhaPlanilha,
        detalhe: `Código de natureza não classificado: ${codigoNaturezaDespesa || "vazio"}.`,
      }));
    }

    const saldoCalculado = arredondar(valorPrevisto.valor - valorExecutado.valor);
    const diferencaSaldo = Math.abs(saldoCalculado - saldo.valor);
    if (diferencaSaldo > TOLERANCIA_CENTAVOS) {
      alertas.push(criarAlerta({
        tipo: "saldo_inconsistente",
        nivel: diferencaSaldo <= LIMITE_AVISO_DIFERENCA ? "aviso" : "impeditivo",
        ...contexto,
        linha: linhaPlanilha,
        detalhe: `Saldo calculado (${saldoCalculado}) diverge do saldo informado (${saldo.valor}).`,
      }));
    }

    itens.push({
      instrumento: contexto.instrumento,
      arquivo: contexto.arquivo,
      aba: contexto.aba,
      linha: linhaPlanilha,
      tipoDespesa: limparTextoPad(linha[tabela.colunas.tipoDespesa]),
      descricao,
      codigoNaturezaDespesa,
      codigoNaturezaNormalizado,
      natureza,
      unidade: limparTextoPad(linha[tabela.colunas.unidade]),
      quantidade: quantidade.valor,
      valorUnitario: valorUnitario.valor,
      valorTotalPrevisto: valorPrevisto.valor,
      valorTotalExecutado: valorExecutado.valor,
      saldo: saldo.valor,
    });
  }

  return { itens, totalGeral };
}

function obterValorTotalGeral(totalGeral, tabela, campo) {
  if (!totalGeral || tabela.colunas[campo] === undefined) return null;
  return converterNumeroPad(totalGeral[tabela.colunas[campo]]).valor;
}

function somarItens(itens, campo) {
  return arredondar(itens.reduce((total, item) => total + (Number(item[campo]) || 0), 0));
}

function alertarDivergenciaTotal(alertas, tipo, informado, calculado, contexto, detalheBase) {
  const diferenca = Math.abs(arredondar(informado) - arredondar(calculado));
  if (diferenca <= TOLERANCIA_CENTAVOS) return;
  alertas.push(criarAlerta({
    tipo,
    nivel: diferenca <= LIMITE_AVISO_DIFERENCA ? "aviso" : "impeditivo",
    ...contexto,
    detalhe: `${detalheBase}: informado ${arredondar(informado)}, calculado ${arredondar(calculado)}.`,
  }));
}

function validarTotaisRelatorio(relatorio, itens, tabela, totalGeral, contexto, alertas) {
  const somaPrevisto = somarItens(itens, "valorTotalPrevisto");
  const somaExecutado = somarItens(itens, "valorTotalExecutado");
  const somaSaldo = somarItens(itens, "saldo");

  alertarDivergenciaTotal(alertas, "total_geral_divergente", relatorio.valorTotalPrevisto, somaPrevisto, contexto, "Total previsto do cabeçalho diverge da soma dos itens");
  alertarDivergenciaTotal(alertas, "total_geral_divergente", relatorio.valorTotalExecutado, somaExecutado, contexto, "Total executado do cabeçalho diverge da soma dos itens");
  alertarDivergenciaTotal(alertas, "total_geral_divergente", relatorio.saldoTotal, somaSaldo, contexto, "Saldo total do cabeçalho diverge da soma dos itens");

  const totalPrevistoGeral = obterValorTotalGeral(totalGeral, tabela, "valorTotalPrevisto");
  const totalExecutadoGeral = obterValorTotalGeral(totalGeral, tabela, "valorTotalExecutado");
  const saldoGeral = obterValorTotalGeral(totalGeral, tabela, "saldo");
  if (totalPrevistoGeral !== null) alertarDivergenciaTotal(alertas, "total_geral_divergente", totalPrevistoGeral, somaPrevisto, contexto, "Total Geral previsto diverge da soma dos itens");
  if (totalExecutadoGeral !== null) alertarDivergenciaTotal(alertas, "total_geral_divergente", totalExecutadoGeral, somaExecutado, contexto, "Total Geral executado diverge da soma dos itens");
  if (saldoGeral !== null) alertarDivergenciaTotal(alertas, "total_geral_divergente", saldoGeral, somaSaldo, contexto, "Total Geral saldo diverge da soma dos itens");
}

function lerRelatorioPad(caminhoArquivo, repoRoot) {
  const arquivo = caminhoRelativo(repoRoot, caminhoArquivo);
  const workbook = XLSX.readFile(caminhoArquivo, { cellDates: true });
  const aba = workbook.SheetNames[0];
  const linhas = obterLinhasPlanilha(workbook.Sheets[aba]);
  const alertas = [];
  const relatorio = extrairCabecalho(linhas);
  const instrumento = relatorio.codigoInstrumento || null;
  const contexto = { arquivo, instrumento, aba };

  if (!instrumento) {
    alertas.push(criarAlerta({
      tipo: "codigo_instrumento_nao_encontrado",
      nivel: "impeditivo",
      ...contexto,
      detalhe: "Campo Código do Instrumento não encontrado no conteúdo do relatório.",
    }));
  }

  if (instrumento && aba && !normalizarRotuloPad(aba).includes(normalizarRotuloPad(instrumento))) {
    alertas.push(criarAlerta({
      tipo: "aba_divergente_do_codigo_instrumento",
      nivel: "aviso",
      ...contexto,
      detalhe: `Aba "${aba}" não contém o código interno do instrumento ${instrumento}.`,
    }));
  }

  const tabela = localizarCabecalhoTabela(linhas);
  if (!tabela) {
    alertas.push(criarAlerta({
      tipo: "cabecalho_tabela_nao_encontrado",
      nivel: "impeditivo",
      ...contexto,
      detalhe: "Cabeçalho da tabela de itens não encontrado por rótulos.",
    }));
    return { relatorio: { ...relatorio, arquivo, aba, totalItens: 0 }, itens: [], alertas };
  }

  const { itens, totalGeral } = extrairItens(linhas, tabela, contexto, alertas);
  if (!itens.length) {
    alertas.push(criarAlerta({
      tipo: "nenhum_item_encontrado",
      nivel: "impeditivo",
      ...contexto,
      detalhe: "Nenhum item foi encontrado entre o cabeçalho da tabela e a linha Total Geral.",
    }));
  }

  validarTotaisRelatorio(relatorio, itens, tabela, totalGeral, contexto, alertas);

  return {
    relatorio: {
      ...relatorio,
      arquivo,
      aba,
      totalItens: itens.length,
      somaItens: {
        valorTotalPrevisto: somarItens(itens, "valorTotalPrevisto"),
        valorTotalExecutado: somarItens(itens, "valorTotalExecutado"),
        saldo: somarItens(itens, "saldo"),
      },
    },
    itens,
    alertas,
  };
}

function lerRelatoriosPadProfor2022(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const pastaRelativa = opcoes.pastaRelativa || "Planilhas/profor-2022/instrumentos";
  const { arquivos } = listarArquivosPad(repoRoot, pastaRelativa);
  const relatorios = [];
  const itens = [];
  const alertas = [];
  const instrumentos = new Map();

  for (const caminhoArquivo of arquivos) {
    const resultado = lerRelatorioPad(caminhoArquivo, repoRoot);
    relatorios.push(resultado.relatorio);
    itens.push(...resultado.itens);
    alertas.push(...resultado.alertas);

    const instrumento = resultado.relatorio.codigoInstrumento;
    if (!instrumento) continue;
    if (!instrumentos.has(instrumento)) {
      instrumentos.set(instrumento, resultado.relatorio.arquivo);
    } else {
      alertas.push(criarAlerta({
        tipo: "arquivo_duplicado_para_mesmo_instrumento",
        nivel: "impeditivo",
        arquivo: resultado.relatorio.arquivo,
        instrumento,
        aba: resultado.relatorio.aba,
        detalhe: `Instrumento já lido em ${instrumentos.get(instrumento)}.`,
      }));
    }
  }

  const resumo = {
    pastaEntrada: pastaRelativa,
    totalArquivosEncontrados: arquivos.length,
    totalRelatoriosLidos: relatorios.length,
    totalItensExtraidos: itens.length,
    totalAlertas: alertas.length,
    totalAlertasImpeditivos: alertas.filter((alerta) => alerta.nivel === "impeditivo").length,
  };

  return { relatorios, itens, alertas, resumo };
}

module.exports = {
  listarArquivosPad,
  lerRelatorioPad,
  lerRelatoriosPadProfor2022,
};
