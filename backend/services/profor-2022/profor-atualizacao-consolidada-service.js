// Serviço orquestrador da rotina diária consolidada PROFOR 2022.
// Executa, em sequência: DETRU → rendimentos Transferegov → montagem do consolidado → validação.
// Não publica dados estáticos. Não altera JSONs publicados. Não apaga cache anterior.
// Em caso de falha de uma etapa, registra o erro e preserva o último cache válido (upserts).

const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const { atualizarCacheDetruProfor2022 } = require("./profor-detru-update-service");
const { listarConveniosMonitorados } = require("./convenios-monitorados-service");
const { consultarSaldoRendimentosConvenio } = require("./transferegov-rendimentos-client");
const {
  salvarSaldoRendimentoTransferegov,
  registrarConsultaRendimentosInicio,
  registrarConsultaRendimentosFim,
  registrarConsultaRendimentosErro,
} = require("./transferegov-rendimentos-cache-service");
const { montarConsolidadoProfor2022 } = require("./profor-consolidado-service");
const { resolverOrigemDadosProfor2022 } = require("./profor-origem-service");
const {
  assertOrquestradorLegadoPermitido,
} = require("./profor-workbook-fallback-guard-service");
const {
  extrairPlanoAplicacaoProforDoWorkbook,
} = require("../dashboard-publication-service");
const { registrarLogOperacional } = require("../logs-operacionais-service");

const ROOT_DIR = path.join(__dirname, "..", "..", "..");
const CATALOGO_APLICACAO_PATH = path.join(__dirname, "..", "..", "data", "aplicacao.json");
const INTERVALO_RENDIMENTOS_PADRAO_MS = 500;

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extrairFluxoConsultaRendimentos(resultado) {
  return (
    resultado?.payload?.fluxo ??
    resultado?.payload?.payload?.fluxo ??
    resultado?.fluxo ??
    "sem-fluxo"
  );
}

function carregarCatalogoAplicacaoLocal() {
  return JSON.parse(fs.readFileSync(CATALOGO_APLICACAO_PATH, "utf8"));
}

// Legado interno do orquestrador descontinuado. Não deve ser usado por fluxo
// operacional; `atualizarProfor2022Consolidado` bloqueia cedo pelo guard.
function carregarPlanoAplicacaoLocal() {
  const catalogo = carregarCatalogoAplicacaoLocal();
  const planilhaRelativa = catalogo?.configuracao?.arquivoPlanilhaConvenios;
  if (!planilhaRelativa) {
    throw new Error("Catalogo da aplicacao sem configuracao.arquivoPlanilhaConvenios.");
  }
  const workbook = xlsx.readFile(path.join(ROOT_DIR, planilhaRelativa), { cellDates: true });
  return extrairPlanoAplicacaoProforDoWorkbook(workbook, catalogo);
}

async function executarEtapaComProtecao(nome, fn) {
  const iniciadoEm = new Date().toISOString();
  try {
    const dados = await fn();
    return {
      nome,
      executado: true,
      sucesso: true,
      iniciadoEm,
      finalizadoEm: new Date().toISOString(),
      erro: null,
      avisos: dados?.avisos || [],
      ...dados,
    };
  } catch (error) {
    return {
      nome,
      executado: true,
      sucesso: false,
      iniciadoEm,
      finalizadoEm: new Date().toISOString(),
      erro: error?.message || String(error),
      avisos: [],
    };
  }
}

async function executarEtapaDetru(opcoes = {}) {
  return executarEtapaComProtecao("detru", async () => {
    const carteira = listarConveniosMonitorados({ incluirInativos: false });
    const totalCarteiraAtiva = carteira.length;
    const resultado = await atualizarCacheDetruProfor2022(opcoes.detru || {});
    const totalEncontrados = resultado?.resultado?.totalEncontrados ?? 0;
    const totalNaoEncontrados = resultado?.resultado?.totalNaoEncontrados ?? 0;
    const avisos = [];
    if (totalCarteiraAtiva > 0 && totalEncontrados < totalCarteiraAtiva) {
      avisos.push(
        `DETRU encontrou ${totalEncontrados}/${totalCarteiraAtiva} convenios da carteira ativa.`
      );
    }
    return {
      totalCarteiraAtiva,
      totalEncontrados,
      totalNaoEncontrados,
      totalSalvos: resultado?.totalSalvos ?? null,
      avisos,
    };
  });
}

async function executarEtapaRendimentos(opcoes = {}) {
  return executarEtapaComProtecao("rendimentos", async () => {
    const convenios = listarConveniosMonitorados({ incluirInativos: false });
    const intervaloMs = Number.isFinite(opcoes.intervaloEntreConsultasMs)
      ? Math.max(0, opcoes.intervaloEntreConsultasMs)
      : INTERVALO_RENDIMENTOS_PADRAO_MS;
    const inicioEtapa = Date.now();
    const idConsulta = registrarConsultaRendimentosInicio({
      totalCarteiraAtiva: convenios.length,
    });
    const falhas = [];
    const fluxosPorConvenio = [];
    let totalFetchPublico = 0;
    let totalPlaywrightPublico = 0;
    let totalSemFluxo = 0;
    let totalSucesso = 0;

    try {
      for (const convenio of convenios) {
        try {
          const resultado = await consultarSaldoRendimentosConvenio(convenio.numeroConvenio);
          const resultadoComCarteira = {
            ...resultado,
            ano: convenio.ano ?? null,
            uf: convenio.uf ?? null,
          };
          const fluxo = extrairFluxoConsultaRendimentos(resultadoComCarteira);

          fluxosPorConvenio.push({
            numeroConvenio: convenio.numeroConvenio,
            ano: convenio.ano ?? null,
            uf: convenio.uf ?? null,
            fluxo,
            sucesso: Boolean(resultadoComCarteira.sucesso),
            etapa: resultadoComCarteira.etapa ?? null,
          });

          if (fluxo === "fetch-publico") {
            totalFetchPublico += 1;
          } else if (fluxo === "playwright-publico") {
            totalPlaywrightPublico += 1;
          } else {
            totalSemFluxo += 1;
          }

          if (resultadoComCarteira.sucesso) {
            salvarSaldoRendimentoTransferegov(resultadoComCarteira, {
              numeroConvenio: convenio.numeroConvenio,
              ano: convenio.ano ?? null,
            });
            totalSucesso += 1;
          } else {
            falhas.push({
              numeroConvenio: convenio.numeroConvenio,
              ano: convenio.ano ?? null,
              uf: convenio.uf ?? null,
              etapa: resultadoComCarteira.etapa ?? null,
              erro: resultadoComCarteira.erro || "Consulta sem sucesso.",
            });
          }
        } catch (err) {
          falhas.push({
            numeroConvenio: convenio.numeroConvenio,
            ano: convenio.ano ?? null,
            uf: convenio.uf ?? null,
            etapa: null,
            erro: err?.message || String(err),
          });
        }

        if (intervaloMs > 0) {
          await aguardar(intervaloMs);
        }
      }

      const resumo = {
        totalCarteiraAtiva: convenios.length,
        totalConsultados: convenios.length,
        totalSucesso,
        totalFalha: falhas.length,
        totalFetchPublico,
        totalPlaywrightPublico,
        totalSemFluxo,
        fluxosPorConvenio,
        duracaoMsTotal: Date.now() - inicioEtapa,
        tempoMedioMsPorConvenio: convenios.length
          ? Math.round((Date.now() - inicioEtapa) / convenios.length)
          : 0,
        falhas,
      };
      registrarConsultaRendimentosFim(idConsulta, resumo);

      const avisos = [];
      if (falhas.length > 0) {
        avisos.push(
          `Rendimentos Transferegov: ${falhas.length} falha(s) em ${convenios.length} consulta(s).`
        );
      }

      return {
        totalConsultados: convenios.length,
        totalSucessos: totalSucesso,
        totalFalhas: falhas.length,
        totalFetchPublico,
        totalPlaywrightPublico,
        totalSemFluxo,
        fluxosPorConvenio,
        duracaoMsTotal: resumo.duracaoMsTotal,
        tempoMedioMsPorConvenio: resumo.tempoMedioMsPorConvenio,
        avisos,
        falhas,
      };
    } catch (error) {
      registrarConsultaRendimentosErro(idConsulta, error);
      throw error;
    }
  });
}

async function executarEtapaConsolidado() {
  return executarEtapaComProtecao("consolidado", async () => {
    const planoAplicacao = carregarPlanoAplicacaoLocal();
    const consolidado = montarConsolidadoProfor2022({
      origemDados: "banco-cache",
      planoAplicacao,
    });
    const diagnostico = consolidado?.diagnostico || {};
    const avisos = [];
    if ((diagnostico.totalCarteira ?? 0) === 0) {
      avisos.push("Consolidado retornou 0 convenios da carteira ativa.");
    }
    return {
      totalConvenios: diagnostico.totalCarteira ?? 0,
      totalComDetru: diagnostico.totalComDetru ?? 0,
      totalComPlano: diagnostico.totalComPlano ?? 0,
      totalComRendimentos: diagnostico.totalComRendimentos ?? 0,
      totalAvisos: diagnostico.totalAvisos ?? 0,
      avisos,
    };
  });
}

function validarDiagnosticoConsolidado(resultadoConsolidado) {
  const avisos = [];
  const erros = [];

  if (!resultadoConsolidado) {
    erros.push("Consolidado ausente para validacao.");
    return { sucesso: false, avisos, erros };
  }

  const total = Number(resultadoConsolidado.totalConvenios ?? 0);
  if (total === 0) {
    erros.push("Consolidado: 0 convenios. Carteira monitorada vazia ou origem indisponivel.");
    return { sucesso: false, avisos, erros };
  }

  const totalComDetru = Number(resultadoConsolidado.totalComDetru ?? 0);
  const totalComPlano = Number(resultadoConsolidado.totalComPlano ?? 0);
  const totalComRendimentos = Number(resultadoConsolidado.totalComRendimentos ?? 0);

  if (totalComDetru < total) {
    avisos.push(`Diagnostico: ${totalComDetru}/${total} convenios com DETRU.`);
  }
  if (totalComPlano < total) {
    avisos.push(`Diagnostico: ${totalComPlano}/${total} convenios com plano de aplicacao.`);
  }
  if (totalComRendimentos < total) {
    avisos.push(`Diagnostico: ${totalComRendimentos}/${total} convenios com rendimentos.`);
  }

  return { sucesso: true, avisos, erros };
}

async function atualizarProfor2022Consolidado(opcoes = {}) {
  // Defesa em profundidade: o orquestrador é legado/descontinuado. Bloqueia
  // chamadas via API/agendador/script sem flag explícita. Em produção, a flag
  // não libera.
  assertOrquestradorLegadoPermitido("atualizarProfor2022Consolidado");
  const iniciadoEm = new Date().toISOString();
  const inicio = Date.now();
  const origemDados = resolverOrigemDadosProfor2022({ origemDados: opcoes.origemDados });

  const detru = await executarEtapaDetru(opcoes);
  const rendimentos = await executarEtapaRendimentos(opcoes);
  const consolidado = await executarEtapaConsolidado();

  const validacao = consolidado.sucesso
    ? validarDiagnosticoConsolidado({
        totalConvenios: consolidado.totalConvenios,
        totalComDetru: consolidado.totalComDetru,
        totalComPlano: consolidado.totalComPlano,
        totalComRendimentos: consolidado.totalComRendimentos,
      })
    : { sucesso: false, avisos: [], erros: ["Consolidado nao executado com sucesso."] };

  const finalizadoEm = new Date().toISOString();
  const duracaoMs = Date.now() - inicio;

  const avisos = [
    ...(detru.avisos || []),
    ...(rendimentos.avisos || []),
    ...(consolidado.avisos || []),
    ...validacao.avisos,
  ];
  const erros = [];
  if (!detru.sucesso) erros.push(`DETRU: ${detru.erro}`);
  if (!rendimentos.sucesso) erros.push(`Rendimentos: ${rendimentos.erro}`);
  if (!consolidado.sucesso) erros.push(`Consolidado: ${consolidado.erro}`);
  erros.push(...validacao.erros);

  const sucesso =
    detru.sucesso && rendimentos.sucesso && consolidado.sucesso && validacao.sucesso;
  const totalAvisos = avisos.length;
  const totalErros = erros.length;

  const resultado = {
    sucesso,
    sucessoGeral: sucesso,
    iniciadoEm,
    finalizadoEm,
    concluidoEm: finalizadoEm,
    duracaoMs,
    origemDados,
    detru: {
      executado: detru.executado,
      sucesso: detru.sucesso,
      totalCarteiraAtiva: detru.totalCarteiraAtiva ?? null,
      totalEncontrados: detru.totalEncontrados ?? null,
      totalNaoEncontrados: detru.totalNaoEncontrados ?? null,
      totalSalvos: detru.totalSalvos ?? null,
      erro: detru.erro ?? null,
      avisos: detru.avisos || [],
    },
    rendimentos: {
      executado: rendimentos.executado,
      sucesso: rendimentos.sucesso,
      totalConsultados: rendimentos.totalConsultados ?? null,
      totalSucessos: rendimentos.totalSucessos ?? null,
      totalFalhas: rendimentos.totalFalhas ?? null,
      totalFetchPublico: rendimentos.totalFetchPublico ?? null,
      totalPlaywrightPublico: rendimentos.totalPlaywrightPublico ?? null,
      totalSemFluxo: rendimentos.totalSemFluxo ?? null,
      fluxosPorConvenio: rendimentos.fluxosPorConvenio ?? [],
      duracaoMsTotal: rendimentos.duracaoMsTotal ?? null,
      tempoMedioMsPorConvenio: rendimentos.tempoMedioMsPorConvenio ?? null,
      erro: rendimentos.erro ?? null,
      avisos: rendimentos.avisos || [],
    },
    consolidado: {
      executado: consolidado.executado,
      sucesso: consolidado.sucesso,
      totalConvenios: consolidado.totalConvenios ?? 0,
      totalComDetru: consolidado.totalComDetru ?? 0,
      totalComPlano: consolidado.totalComPlano ?? 0,
      totalComRendimentos: consolidado.totalComRendimentos ?? 0,
      erro: consolidado.erro ?? null,
      avisos: consolidado.avisos || [],
    },
    totalAvisos,
    totalErros,
    avisos,
    erros,
  };

  try {
    const resumoLog =
      `DETRU ${resultado.detru.totalEncontrados ?? "-"}/${resultado.detru.totalCarteiraAtiva ?? "-"} | ` +
      `rendimentos ${resultado.rendimentos.totalSucessos ?? "-"}/${resultado.rendimentos.totalConsultados ?? "-"} | ` +
      `consolidado ${resultado.consolidado.totalComDetru}/${resultado.consolidado.totalComPlano}/${resultado.consolidado.totalComRendimentos} ` +
      `(convenios=${resultado.consolidado.totalConvenios}) | sucessoGeral=${sucesso}`;
    registrarLogOperacional({
      modulo: "profor-2022",
      tipoEvento: "profor_atualizacao_consolidada",
      status: sucesso ? "sucesso" : (totalErros > 0 ? "falha" : "parcial"),
      iniciadoEm,
      concluidoEm: finalizadoEm,
      duracaoMs,
      resumo: resumoLog,
      payload: {
        sucessoGeral: sucesso,
        origemDados,
        detru: {
          sucesso: resultado.detru.sucesso,
          totalCarteiraAtiva: resultado.detru.totalCarteiraAtiva,
          totalEncontrados: resultado.detru.totalEncontrados,
          totalNaoEncontrados: resultado.detru.totalNaoEncontrados,
          totalSalvos: resultado.detru.totalSalvos,
        },
        rendimentos: {
          sucesso: resultado.rendimentos.sucesso,
          totalConsultados: resultado.rendimentos.totalConsultados,
          totalSucessos: resultado.rendimentos.totalSucessos,
          totalFalhas: resultado.rendimentos.totalFalhas,
          totalFetchPublico: resultado.rendimentos.totalFetchPublico,
          totalPlaywrightPublico: resultado.rendimentos.totalPlaywrightPublico,
          totalSemFluxo: resultado.rendimentos.totalSemFluxo,
          duracaoMsTotal: resultado.rendimentos.duracaoMsTotal,
          tempoMedioMsPorConvenio: resultado.rendimentos.tempoMedioMsPorConvenio,
        },
        consolidado: {
          totalConvenios: resultado.consolidado.totalConvenios,
          totalComDetru: resultado.consolidado.totalComDetru,
          totalComPlano: resultado.consolidado.totalComPlano,
          totalComRendimentos: resultado.consolidado.totalComRendimentos,
        },
        totalAvisos,
        totalErros,
      },
    });
  } catch (erroLog) {
    console.warn("Falha ao registrar log operacional de atualizacao consolidada:", erroLog?.message || erroLog);
  }

  return resultado;
}

function resumirAtualizacaoConsolidada(resultado) {
  if (!resultado) return "Sem resultado.";
  const fluxoFetch = Number(resultado.rendimentos?.totalFetchPublico ?? 0);
  const fluxoPlaywright = Number(resultado.rendimentos?.totalPlaywrightPublico ?? 0);
  const fluxoSem = Number(resultado.rendimentos?.totalSemFluxo ?? 0);
  const linhas = [
    "--- Atualizacao consolidada PROFOR 2022 ---",
    `iniciadoEm:    ${resultado.iniciadoEm}`,
    `concluidoEm:    ${resultado.concluidoEm || resultado.finalizadoEm}`,
    `duracaoMs:     ${resultado.duracaoMs} ms`,
    `sucessoGeral:  ${resultado.sucessoGeral ?? resultado.sucesso}`,
    `Origem:        ${resultado.origemDados}`,
    `DETRU encontrados/total: ${resultado.detru.totalEncontrados ?? "-"}/${resultado.detru.totalCarteiraAtiva ?? "-"}` +
      (resultado.detru.erro ? ` erro="${resultado.detru.erro}"` : ""),
    `rendimentos sucesso/total: ${resultado.rendimentos.totalSucessos ?? "-"}/${resultado.rendimentos.totalConsultados ?? "-"}` +
      ` falhas=${resultado.rendimentos.totalFalhas ?? "-"}` +
      (resultado.rendimentos.erro ? ` erro="${resultado.rendimentos.erro}"` : ""),
    `Rendimentos por fluxo: fetch-publico=${fluxoFetch}` +
      ` | playwright-publico=${fluxoPlaywright}` +
      ` | sem-fluxo=${fluxoSem}`,
    `Consolidado total de convenios: ${resultado.consolidado.totalConvenios}` +
      ` | totalComDetru=${resultado.consolidado.totalComDetru}` +
      ` | totalComPlano=${resultado.consolidado.totalComPlano}` +
      ` | totalComRendimentos=${resultado.consolidado.totalComRendimentos}`,
    `totalAvisos:   ${resultado.totalAvisos ?? resultado.avisos.length}`,
    `totalErros:    ${resultado.totalErros ?? resultado.erros.length}`,
  ];

  if (resultado.avisos.length) {
    linhas.push("Avisos:");
    resultado.avisos.forEach((aviso) => linhas.push(`  - ${aviso}`));
  }
  if (resultado.erros.length) {
    linhas.push("Erros:");
    resultado.erros.forEach((erro) => linhas.push(`  - ${erro}`));
  }
  linhas.push("-------------------------------------------");
  return linhas.join("\n");
}

module.exports = {
  atualizarProfor2022Consolidado,
  validarDiagnosticoConsolidado,
  resumirAtualizacaoConsolidada,
  executarEtapaComProtecao,
  executarEtapaRendimentos,
};
