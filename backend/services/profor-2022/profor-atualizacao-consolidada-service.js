// Serviço para atualização controlada de rendimentos Transferegov PROFOR 2022.
// Não publica dados estáticos. Não altera JSONs publicados. Não apaga cache anterior.
// Em caso de falha, registra o erro e preserva o último cache válido (upserts).

const { listarConveniosMonitorados } = require("./convenios-monitorados-service");
const { consultarSaldoRendimentosConvenio } = require("./transferegov-rendimentos-client");
const {
  salvarSaldoRendimentoTransferegov,
  registrarConsultaRendimentosInicio,
  registrarConsultaRendimentosFim,
  registrarConsultaRendimentosErro,
  classificarResultadoRendimentos,
} = require("./transferegov-rendimentos-cache-service");
const {
  assertChamadaExternaPermitida,
} = require("./profor-workbook-fallback-guard-service");

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
      statusResultado: "falha",
      iniciadoEm,
      finalizadoEm: new Date().toISOString(),
      erro: error?.message || String(error),
      avisos: [],
    };
  }
}

async function executarEtapaRendimentos(opcoes = {}, dependencias = {}) {
  const deps = {
    assertChamadaExternaPermitida,
    listarConveniosMonitorados,
    consultarSaldoRendimentosConvenio,
    salvarSaldoRendimentoTransferegov,
    registrarConsultaRendimentosInicio,
    registrarConsultaRendimentosFim,
    registrarConsultaRendimentosErro,
    ...dependencias,
  };

  return executarEtapaComProtecao("rendimentos", async () => {
    deps.assertChamadaExternaPermitida("executarEtapaRendimentos", {
      tipo: "Transferegov",
      requisicaoLocal: opcoes.requisicaoLocal,
      execucaoLocal: opcoes.execucaoLocal,
    });
    const convenios = await deps.listarConveniosMonitorados({ incluirInativos: false });
    const intervaloMs = Number.isFinite(opcoes.intervaloEntreConsultasMs)
      ? Math.max(0, opcoes.intervaloEntreConsultasMs)
      : INTERVALO_RENDIMENTOS_PADRAO_MS;
    const inicioEtapa = Date.now();
    const idConsulta = await deps.registrarConsultaRendimentosInicio({
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
          const resultado = await deps.consultarSaldoRendimentosConvenio(convenio.numeroConvenio);
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
            await deps.salvarSaldoRendimentoTransferegov(resultadoComCarteira, {
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

      const statusResultado = classificarResultadoRendimentos({
        totalConsultados: convenios.length,
        totalSucesso,
        totalFalha: falhas.length,
      });
      const sucesso = statusResultado === "sucesso";
      const resumo = {
        statusResultado,
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
      await deps.registrarConsultaRendimentosFim(idConsulta, resumo);

      const avisos = [];
      if (falhas.length > 0) {
        avisos.push(
          `Rendimentos Transferegov: ${falhas.length} falha(s) em ${convenios.length} consulta(s).`
        );
      }

      return {
        sucesso,
        statusResultado,
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
      await deps.registrarConsultaRendimentosErro(idConsulta, error);
      throw error;
    }
  });
}

module.exports = {
  executarEtapaComProtecao,
  executarEtapaRendimentos,
};
