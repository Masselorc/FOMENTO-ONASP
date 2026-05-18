// Rotina local para atualizar o cache de saldo de rendimentos do PROFOR 2022.
// Usa apenas acesso público ao Transferegov. Não usa credenciais, captcha ou área restrita.

const { inicializarBanco } = require("../db/init-db");
const { listarConveniosMonitorados } = require("../services/profor-2022/convenios-monitorados-service");
const {
  consultarSaldoRendimentosConvenio,
} = require("../services/profor-2022/transferegov-rendimentos-client");
const {
  salvarSaldoRendimentoTransferegov,
  registrarConsultaRendimentosInicio,
  registrarConsultaRendimentosFim,
  registrarConsultaRendimentosErro,
} = require("../services/profor-2022/transferegov-rendimentos-cache-service");

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

function montarFalha(convenio, resultado) {
  return {
    numeroConvenio: convenio.numeroConvenio,
    ano: convenio.ano ?? null,
    uf: convenio.uf ?? null,
    etapa: resultado?.etapa ?? null,
    erro: resultado?.erro || "Consulta sem sucesso.",
  };
}

async function executar() {
  inicializarBanco();

  const convenios = listarConveniosMonitorados({ incluirInativos: false });
  const inicioExecucao = Date.now();
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
        falhas.push(montarFalha(convenio, resultadoComCarteira));
      }

      await aguardar(500);
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
      duracaoMsTotal: Date.now() - inicioExecucao,
      tempoMedioMsPorConvenio: convenios.length
        ? Math.round((Date.now() - inicioExecucao) / convenios.length)
        : 0,
      falhas,
    };

    registrarConsultaRendimentosFim(idConsulta, resumo);

    console.log("--- Atualização de rendimentos Transferegov PROFOR 2022 ---");
    console.log(`Carteira ativa:     ${resumo.totalCarteiraAtiva}`);
    console.log(`Consultados:        ${resumo.totalConsultados}`);
    console.log(`Sucesso:            ${resumo.totalSucesso}`);
    console.log(`Falha:              ${resumo.totalFalha}`);
    console.log(`Fluxo fetch-publico:      ${resumo.totalFetchPublico}`);
    console.log(`Fluxo playwright-publico: ${resumo.totalPlaywrightPublico}`);
    console.log(`Fluxo nao identificado:   ${resumo.totalSemFluxo}`);
    console.log(`Duracao total (ms):     ${resumo.duracaoMsTotal}`);
    console.log(`Tempo medio por convênio: ${resumo.tempoMedioMsPorConvenio}`);
    if (falhas.length) {
      console.log("Falhas:");
      falhas.forEach((falha) => {
        console.log(
          `  - ${falha.numeroConvenio}/${falha.ano ?? "s/ano"} (${falha.uf ?? "s/UF"})` +
          ` [${falha.etapa ?? "s/etapa"}]: ${falha.erro}`
        );
      });
    }
    console.log("----------------------------------------------------------");
  } catch (error) {
    registrarConsultaRendimentosErro(idConsulta, error);
    console.error("Falha na atualização de rendimentos Transferegov:", error.message);
    process.exit(1);
  }
}

executar();
