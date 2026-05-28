const { resolverOrigemDadosProfor2022 } = require("./profor-2022/profor-origem-service");
const { montarConsolidadoProfor2022 } = require("./profor-2022/profor-consolidado-service");
const {
  carregarPlanoAplicacaoReconstrucaoPad,
} = require("./profor-2022/profor-pad-origem-reconstrucao-service");
const {
  obterUltimaAtualizacaoDadosProfor2022
} = require("./profor-2022/profor-atualizacao-meta-service");

function moedaParaCentavos(valor) {
  return Math.round((Number(valor) || 0) * 100);
}

function centavosParaMoeda(centavos) {
  return centavos / 100;
}

function anexarMetadadosOrigemProfor2022(dados, metadados = {}) {
  const avisos = Array.isArray(metadados.avisos) ? metadados.avisos : [];

  return {
    ...dados,
    origemDados: metadados.origemDados || "planilha",
    origemDadosEfetiva: metadados.origemDadosEfetiva || "planilha",
    fallbackUsado: Boolean(metadados.fallbackUsado),
    avisos,
    diagnostico: {
      totalConvenios: dados?.convenios?.length || 0,
      totalAvisos: avisos.length,
      ...(metadados.diagnostico || {})
    }
  };
}

async function obterUltimaAtualizacaoDadosSeguro() {
  try {
    return await obterUltimaAtualizacaoDadosProfor2022();
  } catch (_err) {
    return { dataHora: null, fonte: null, fontesConsideradas: { detru: null, rendimentos: null } };
  }
}

async function anexarUltimaAtualizacaoDados(dados) {
  return {
    ...dados,
    ultimaAtualizacaoDados: await obterUltimaAtualizacaoDadosSeguro()
  };
}

async function montarDadosProfor2022Publicacao(workbook, catalogoAplicacao, opcoes = {}) {
  const origemResolvida = resolverOrigemDadosProfor2022({
    origemDados: opcoes.origemDados,
    detalhado: true
  });

  if (origemResolvida.origemDados !== "reconstrucao-pad") {
    throw new Error(
      `[montarDadosProfor2022Publicacao] Origem de dados invalida ou removida: '${origemResolvida.origemDados}'. ` +
        `Use reconstrucao-pad.`
    );
  }

  const carregar = opcoes.carregarPlanoReconstrucaoPad || carregarPlanoAplicacaoReconstrucaoPad;
  const { planoAplicacao: planoReconstruido, metadados } = carregar({
    caminho: opcoes.caminhoReconstrucaoPad,
    conveniosEsperados: opcoes.conveniosEsperadosReconstrucaoPad,
    minimoLinhasExigido: opcoes.minimoLinhasExigidoReconstrucaoPad,
  });
  const montarConsolidado = opcoes.montarConsolidado || montarConsolidadoProfor2022;
  const consolidado = await montarConsolidado({
    origemDados: "reconstrucao-pad",
    planoAplicacao: planoReconstruido,
  });
  return anexarUltimaAtualizacaoDados(anexarMetadadosOrigemProfor2022(consolidado, {
    origemDados: "reconstrucao-pad",
    origemDadosEfetiva: "reconstrucao-pad",
    avisos: origemResolvida.avisos || [],
    diagnostico: {
      reconstrucaoPad: metadados,
    },
  }));
}

function removerConveniosDoDadosBase(dadosBase) {
  if (!dadosBase) return [];
  const regexConv = /conv/i;
  const len = dadosBase.length;
  const resultado = [];
  for (let i = 0; i < len; i++) {
    const item = dadosBase[i];
    if (!regexConv.test(item?.instrumento || "")) {
      resultado.push(item);
    }
  }
  return resultado;
}

function calcularResumoDashboard(dadosBase) {
  const resumo = {
    totalFomentoCentavos: 0,
    totalConveniosCentavos: 0,
    totalFafCentavos: 0,
    totalDoacoesCentavos: 0,
    ufsConvenios: new Set()
  };

  const regexConv = /conv/i;
  const regexFaf = /faf/i;
  const regexDoa = /doa/i;

  const len = dadosBase.length;
  for (let i = 0; i < len; i++) {
    const item = dadosBase[i];
    const instrumento = item?.instrumento || "";
    const valorTotalCentavos = moedaParaCentavos(item?.valorTotal);

    if (regexConv.test(instrumento)) {
      resumo.totalConveniosCentavos += valorTotalCentavos;
      if (item?.uf && valorTotalCentavos > 0) {
        resumo.ufsConvenios.add(item.uf);
      }
    } else if (regexFaf.test(instrumento)) {
      resumo.totalFafCentavos += valorTotalCentavos;
    } else if (regexDoa.test(instrumento)) {
      resumo.totalDoacoesCentavos += valorTotalCentavos;
    }
  }

  resumo.totalFomentoCentavos = resumo.totalConveniosCentavos
    + resumo.totalFafCentavos
    + resumo.totalDoacoesCentavos;

  return {
    totalFomento: centavosParaMoeda(resumo.totalFomentoCentavos),
    totalConvenios: centavosParaMoeda(resumo.totalConveniosCentavos),
    totalFaf: centavosParaMoeda(resumo.totalFafCentavos),
    totalDoacoes: centavosParaMoeda(resumo.totalDoacoesCentavos),
    ufsConvenios: Array.from(resumo.ufsConvenios).sort(),
    quantidadeUfsConvenios: resumo.ufsConvenios.size
  };
}

async function consolidarCatalogoDashboard(catalogoAplicacao, publicadoEm) {
  const dadosBaseConsolidado = removerConveniosDoDadosBase(catalogoAplicacao?.dadosBase);
  const dadosProfor2022 = await montarDadosProfor2022Publicacao(null, catalogoAplicacao, {
    origemDados: "reconstrucao-pad",
  });
  const conveniosProfor = Array.isArray(dadosProfor2022?.convenios)
    ? dadosProfor2022.convenios
    : [];

  const len = conveniosProfor.length;
  for (let i = 0; i < len; i++) {
    const convenio = conveniosProfor[i];
    dadosBaseConsolidado.push({
      instrumento: convenio.instrumento || "Convênio",
      uf: convenio.uf || "",
      numero: convenio.numero || convenio.numeroConvenio || "",
      ano: convenio.ano || "2022",
      valorTotal: convenio.valorGlobal || 0,
      valorExecutado: convenio.valorExecutado || 0,
      saldo: convenio.saldo || 0,
      programaOrigem: "PROFOR 2022"
    });
  }
  const resumoDashboard = calcularResumoDashboard(dadosBaseConsolidado);

  if (resumoDashboard.totalConvenios <= 0 || resumoDashboard.quantidadeUfsConvenios <= 0) {
    throw new Error("Publicacao abortada: dados de convenios ausentes no dadosBase publicado.");
  }

  return {
    catalogoPublicado: {
      ...catalogoAplicacao,
      dadosBase: dadosBaseConsolidado,
      dadosProfor2022,
      metadadosPublicacao: {
        publicadoEm,
        fonteDadosBase: "dados consolidados da Home local",
        origemProfor2022: "reconstrucao-pad"
      }
    },
    dashboardGeral: {
      publicadoEm,
      fonteDadosBase: "dados consolidados da Home local",
      dadosBase: dadosBaseConsolidado,
      dadosProfor2022,
      resumoEsperado: resumoDashboard
    },
    resumoDashboard,
    totaisExtracao: {
      itensConvenio: len,
      conveniosProfor2022: len
    }
  };
}

module.exports = {
  consolidarCatalogoDashboard,
  montarDadosProfor2022Publicacao
};
