const fs = require("node:fs");
const path = require("node:path");

const {
  executarDryRunPadsTransferegov,
} = require("../services/profor-2022/profor-pad-transferegov-dry-run-service");

const CAMINHO_JSON_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-15-dry-run.json";
const CAMINHO_MD_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-15-dry-run.md";
const CAMINHO_DIVERGENCIAS_JSON_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-divergencias-938128-937817.json";
const CAMINHO_DIVERGENCIAS_MD_RELATIVO = "backend/data/relatorios/profor-2022-pad-transferegov-divergencias-938128-937817.md";
const CONVENIOS_INVESTIGACAO_DIVERGENCIAS = ["938128", "937817"];

function obterArgumento(nome) {
  const prefixo = `--${nome}=`;
  const arg = process.argv.find((item) => item.startsWith(prefixo));
  return arg ? arg.slice(prefixo.length) : null;
}

function argumentos() {
  return {
    convenio: obterArgumento("convenio"),
    limite: obterArgumento("limite"),
    detalhado: process.argv.includes("--detalhado"),
    salvarRelatorio: process.argv.includes("--salvar-relatorio"),
    fallbackPlaywright: process.argv.includes("--fallback-playwright"),
  };
}

function linhaResumo(resultado) {
  if (!resultado.sucesso) {
    const erro = (resultado.errosTecnicos || []).map((item) => `${item.origem}: ${item.mensagem}`).join(" | ");
    return `${resultado.instrumento}: falha origem=${resultado.origemUsada} erro=${erro}`;
  }
  return [
    `${resultado.instrumento}:`,
    `origem=${resultado.origemUsada}`,
    `itensTransferegov=${resultado.totalItensTransferegov}`,
    `itensExcel=${resultado.totalItensExcel}`,
    `previstoTransferegov=${resultado.totalPrevistoTransferegov}`,
    `previstoExcel=${resultado.totalPrevistoExcel}`,
    `executadoTransferegov=${resultado.totalExecutadoTransferegov}`,
    `executadoExcel=${resultado.totalExecutadoExcel}`,
    `saldoTransferegov=${resultado.saldoTransferegov}`,
    `saldoExcel=${resultado.saldoExcel}`,
    `aptoParaImportacaoTecnica=${resultado.aptoParaImportacaoTecnica ? "sim" : "nao"}`,
    `diferencasHistoricas=${resultado.diferencasHistoricas}`,
    `equivalenteHistorico=${resultado.equivalenteHistorico ? "sim" : "nao"}`,
  ].join(" ");
}

function imprimirResumo(resultado) {
  console.log(`dataHora=${resultado.dataHora}`);
  console.log(`totalConveniosEsperados=${resultado.resumo.totalConveniosEsperados}`);
  console.log(`totalConveniosExtraidos=${resultado.resumo.totalConveniosExtraidos}`);
  console.log(`totalFalhasTecnicas=${resultado.resumo.totalFalhasTecnicas}`);
  console.log(`totalAptosParaImportacaoTecnica=${resultado.resumo.totalAptosParaImportacaoTecnica}`);
  console.log(`totalComAtualizacoesDetectadas=${resultado.resumo.totalComAtualizacoesDetectadas}`);
  console.log(`totalComDiferencaHistoricaExcel=${resultado.resumo.totalComDiferencaHistoricaExcel}`);
  console.log(`aptoParaImportacaoTecnica=${resultado.resumo.aptoParaImportacaoTecnica ? "true" : "false"}`);
  for (const item of resultado.resultados) console.log(linhaResumo(item));
}

function classificarDivergencia(resultado) {
  if (!resultado.sucesso) {
    return {
      classificacao: "dado_insuficiente",
      provavelCausa: "Falha tecnica na extracao impediu comparacao material.",
      recomendacao: "Reexecutar HTTP direto e analisar erro tecnico antes de qualquer cache.",
      bloqueiaImportacaoTecnica: true,
      exigeCorrecaoParserComparador: false,
      diferencaRealFonte: false,
    };
  }

  const comparacao = resultado.comparacaoHistoricaExcel || resultado.comparacao || {};
  const diferencas = comparacao.diferencas || [];
  const totaisDiferem = !resultado.equivalenteHistorico
    && (resultado.totalPrevistoTransferegov !== resultado.totalPrevistoExcel
      || resultado.totalExecutadoTransferegov !== resultado.totalExecutadoExcel
      || resultado.saldoTransferegov !== resultado.saldoExcel
      || resultado.totalItensTransferegov !== resultado.totalItensExcel);
  const temAusencias = diferencas.some((item) => item.tipo === "item_suprimido_na_fonte_atual" || item.tipo === "item_novo_na_fonte_atual");
  const temQuantidadeOuCodigo = diferencas.some((item) => item.subtipo === "quantidade_diferente" || item.subtipo === "codigo_natureza_diferente");
  const soValores = !temAusencias && !temQuantidadeOuCodigo && diferencas.some((item) => item.tipo === "valor_atualizado_na_fonte_atual");

  if (soValores && totaisDiferem) {
    return {
      classificacao: "diferenca_historica_excel",
      provavelCausa: "O Transferegov publico atual informa valores executados/saldos diferentes do Excel PAD processado; item, descricao, codigo e quantidade foram pareados.",
      recomendacao: "Tratar como atualizacao da fonte atual; nao bloquear importacao tecnica por divergencia contra Excel historico.",
      bloqueiaImportacaoTecnica: false,
      exigeCorrecaoParserComparador: false,
      diferencaRealFonte: true,
    };
  }

  if (soValores && !totaisDiferem) {
    return {
      classificacao: "valor_atualizado_na_fonte_atual",
      provavelCausa: "Os totais gerais batem, mas a distribuicao de valor executado/saldo entre itens pareados difere entre o Transferegov atual e o Excel PAD processado.",
      recomendacao: "Registrar como auditoria historica; nao bloquear importacao tecnica do PAD atual.",
      bloqueiaImportacaoTecnica: false,
      exigeCorrecaoParserComparador: false,
      diferencaRealFonte: true,
    };
  }

  return {
    classificacao: resultado.equivalenteHistorico ? "sem_diferenca_historica" : "atualizacao_detectada",
    provavelCausa: resultado.equivalenteHistorico ? "PAD atual equivalente ao Excel historico." : "O PAD atual difere da referencia historica do Excel.",
    recomendacao: "Usar o PAD atual como fonte bruta; manter a diferenca apenas como auditoria.",
    bloqueiaImportacaoTecnica: false,
    exigeCorrecaoParserComparador: false,
    diferencaRealFonte: !resultado.equivalenteHistorico,
  };
}

function montarRelatorioDivergencias(resultado) {
  const resultados = resultado.resultados
    .filter((item) => CONVENIOS_INVESTIGACAO_DIVERGENCIAS.includes(String(item.instrumento)))
    .map((item) => ({
      instrumento: item.instrumento,
      resumo: {
        origemUsada: item.origemUsada,
        sucesso: item.sucesso,
        totalItensTransferegov: item.totalItensTransferegov,
        totalItensExcel: item.totalItensExcel,
        totalPrevistoTransferegov: item.totalPrevistoTransferegov,
        totalPrevistoExcel: item.totalPrevistoExcel,
        totalExecutadoTransferegov: item.totalExecutadoTransferegov,
        totalExecutadoExcel: item.totalExecutadoExcel,
        saldoTransferegov: item.saldoTransferegov,
        saldoExcel: item.saldoExcel,
        aptoParaImportacaoTecnica: item.aptoParaImportacaoTecnica,
        diferencasHistoricas: item.diferencasHistoricas,
        equivalenteHistorico: item.equivalenteHistorico,
      },
      classificacao: classificarDivergencia(item),
      comparacaoHistoricaExcel: item.comparacaoHistoricaExcel,
      divergencias: item.comparacao ? {
        itensAusentesNoTransferegov: item.comparacao.itensAusentesNoTransferegov,
        itensAusentesNoExcel: item.comparacao.itensAusentesNoExcel,
        itensComValorDivergente: item.comparacao.itensComValorDivergente,
        itensComQuantidadeDivergente: item.comparacao.itensComQuantidadeDivergente,
        itensComCodigoNaturezaDivergente: item.comparacao.itensComCodigoNaturezaDivergente,
        itensComDescricaoSemelhanteHashDiferente: item.comparacao.itensComDescricaoSemelhanteHashDiferente,
        divergenciasCriticas: item.comparacao.divergenciasCriticas,
        divergenciasNaoCriticas: item.comparacao.divergenciasNaoCriticas,
      } : null,
      errosTecnicos: item.errosTecnicos || [],
    }));

  return {
    dataHora: resultado.dataHora,
    objetivo: "Investigacao das divergencias Transferegov x Excel PAD PROFOR 2022.",
    conveniosInvestigados: CONVENIOS_INVESTIGACAO_DIVERGENCIAS,
    resumoGeral: {
      totalInvestigados: resultados.length,
      totalComDiferencaHistoricaExcel: resultados.filter((item) => !item.resumo.equivalenteHistorico).length,
      totalExigeCorrecaoParserComparador: resultados.filter((item) => item.classificacao.exigeCorrecaoParserComparador).length,
      totalDiferencaRealFonte: resultados.filter((item) => item.classificacao.diferencaRealFonte).length,
      bloqueiaImportacaoTecnica: resultados.some((item) => item.classificacao.bloqueiaImportacaoTecnica),
    },
    resultados,
  };
}

function gerarMarkdownDivergencias(relatorio) {
  const linhas = [
    "# Investigacao de divergencias PAD Transferegov",
    "",
    `- Data/hora: ${relatorio.dataHora}`,
    `- Convenios investigados: ${relatorio.conveniosInvestigados.join(", ")}`,
    `- Bloqueia importacao tecnica: ${relatorio.resumoGeral.bloqueiaImportacaoTecnica ? "sim" : "nao"}`,
    "",
  ];
  for (const item of relatorio.resultados) {
    linhas.push(`## ${item.instrumento}`);
    linhas.push("");
    linhas.push(`- Classificacao: ${item.classificacao.classificacao}`);
    linhas.push(`- Provavel causa: ${item.classificacao.provavelCausa}`);
    linhas.push(`- Recomendacao: ${item.classificacao.recomendacao}`);
    linhas.push(`- Exige correcao parser/comparador: ${item.classificacao.exigeCorrecaoParserComparador ? "sim" : "nao"}`);
    linhas.push(`- Diferenca real da fonte: ${item.classificacao.diferencaRealFonte ? "sim" : "nao"}`);
    linhas.push(`- Apto para importacao tecnica: ${item.resumo.aptoParaImportacaoTecnica ? "sim" : "nao"}`);
    linhas.push(`- Itens Transferegov/Excel: ${item.resumo.totalItensTransferegov}/${item.resumo.totalItensExcel}`);
    linhas.push(`- Previsto Transferegov/Excel: ${item.resumo.totalPrevistoTransferegov}/${item.resumo.totalPrevistoExcel}`);
    linhas.push(`- Executado Transferegov/Excel: ${item.resumo.totalExecutadoTransferegov}/${item.resumo.totalExecutadoExcel}`);
    linhas.push(`- Saldo Transferegov/Excel: ${item.resumo.saldoTransferegov}/${item.resumo.saldoExcel}`);
    linhas.push("");
    if (item.divergencias?.itensComValorDivergente?.length) {
      linhas.push("| Campo | Descricao | Transferegov | Excel | Codigo | Quantidade |");
      linhas.push("|---|---|---:|---:|---|---:|");
      for (const divergencia of item.divergencias.itensComValorDivergente) {
        linhas.push([
          divergencia.campo,
          divergencia.descricao,
          divergencia.transferegov,
          divergencia.excel,
          divergencia.evidencia?.transferegov?.codigoNaturezaDespesa || "-",
          divergencia.evidencia?.transferegov?.quantidade ?? "-",
        ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
      }
      linhas.push("");
    }
  }
  return `${linhas.join("\n")}\n`;
}

function gerarMarkdown(resultado) {
  const linhas = [
    "# Dry-run PAD Transferegov PROFOR 2022",
    "",
    `- Data/hora: ${resultado.dataHora}`,
    `- Total convênios esperados: ${resultado.resumo.totalConveniosEsperados}`,
    `- Total convênios extraídos: ${resultado.resumo.totalConveniosExtraidos}`,
    `- Total falhas técnicas: ${resultado.resumo.totalFalhasTecnicas}`,
    `- Total aptos para importação técnica: ${resultado.resumo.totalAptosParaImportacaoTecnica}`,
    `- Total com atualizações detectadas: ${resultado.resumo.totalComAtualizacoesDetectadas}`,
    `- Total com diferença histórica Excel: ${resultado.resumo.totalComDiferencaHistoricaExcel}`,
    `- Apto para importação técnica: ${resultado.resumo.aptoParaImportacaoTecnica ? "sim" : "não"}`,
    "",
    "| Convênio | Origem | Sucesso | Apto técnico | Itens Tgov | Itens Excel | Previsto Tgov | Previsto Excel | Executado Tgov | Executado Excel | Saldo Tgov | Saldo Excel | Diferenças históricas | Equivalente histórico |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const item of resultado.resultados) {
    linhas.push([
      item.instrumento,
      item.origemUsada,
      item.sucesso ? "sim" : "não",
      item.aptoParaImportacaoTecnica ? "sim" : "não",
      item.totalItensTransferegov ?? "-",
      item.totalItensExcel ?? "-",
      item.totalPrevistoTransferegov ?? "-",
      item.totalPrevistoExcel ?? "-",
      item.totalExecutadoTransferegov ?? "-",
      item.totalExecutadoExcel ?? "-",
      item.saldoTransferegov ?? "-",
      item.saldoExcel ?? "-",
      item.diferencasHistoricas ?? "-",
      item.equivalenteHistorico ? "sim" : "não",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  return `${linhas.join("\n")}\n`;
}

function salvarRelatorios(repoRoot, resultado) {
  const detalhado = resultado.detalhado === true;
  const caminhoJson = path.join(repoRoot, detalhado ? CAMINHO_DIVERGENCIAS_JSON_RELATIVO : CAMINHO_JSON_RELATIVO);
  const caminhoMd = path.join(repoRoot, detalhado ? CAMINHO_DIVERGENCIAS_MD_RELATIVO : CAMINHO_MD_RELATIVO);
  const conteudo = detalhado ? montarRelatorioDivergencias(resultado) : resultado;
  fs.mkdirSync(path.dirname(caminhoJson), { recursive: true });
  fs.writeFileSync(caminhoJson, `${JSON.stringify(conteudo, null, 2)}\n`, "utf8");
  fs.writeFileSync(caminhoMd, detalhado ? gerarMarkdownDivergencias(conteudo) : gerarMarkdown(resultado), "utf8");
  console.log(`saidaJson=${detalhado ? CAMINHO_DIVERGENCIAS_JSON_RELATIVO : CAMINHO_JSON_RELATIVO}`);
  console.log(`saidaMarkdown=${detalhado ? CAMINHO_DIVERGENCIAS_MD_RELATIVO : CAMINHO_MD_RELATIVO}`);
}

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const opcoes = argumentos();
  const resultado = await executarDryRunPadsTransferegov({
    repoRoot,
    convenio: opcoes.convenio,
    limite: opcoes.limite,
    fallbackPlaywright: opcoes.fallbackPlaywright,
  });
  if (opcoes.detalhado) resultado.detalhado = true;
  imprimirResumo(resultado);
  if (opcoes.salvarRelatorio) salvarRelatorios(repoRoot, resultado);
}

executar().catch((erro) => {
  console.error("Falha no dry-run PAD Transferegov PROFOR 2022.");
  console.error(erro?.message || erro);
  process.exit(1);
});
