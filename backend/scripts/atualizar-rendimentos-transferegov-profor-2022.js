// Rotina local para atualizar o cache de saldo de rendimentos do PROFOR 2022.
// Usa apenas acesso público ao Transferegov. Não usa credenciais, captcha ou área restrita.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const {
  assertChamadaExternaPermitida,
} = require("../services/profor-2022/profor-workbook-fallback-guard-service");

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
  let idConsulta = null;
  let registrarConsultaRendimentosErro = null;
  try {
    assertChamadaExternaPermitida("script_atualizar_rendimentos_transferegov_profor_2022", {
      tipo: "Transferegov",
      execucaoLocal: true,
    });

    const { inicializarBanco } = require("../db/init-db");
    const {
      listarConveniosMonitorados,
    } = require("../services/profor-2022/convenios-monitorados-service");
    const {
      consultarSaldoRendimentosConvenio,
    } = require("../services/profor-2022/transferegov-rendimentos-client");
    const cacheService = require("../services/profor-2022/transferegov-rendimentos-cache-service");
    const {
      salvarSaldoRendimentoTransferegov,
      registrarConsultaRendimentosInicio,
      registrarConsultaRendimentosFim,
    } = cacheService;
    registrarConsultaRendimentosErro = cacheService.registrarConsultaRendimentosErro;

    inicializarBanco();

    const convenios = await listarConveniosMonitorados({ incluirInativos: false });
    const inicioExecucao = Date.now();
    idConsulta = await registrarConsultaRendimentosInicio({
      totalCarteiraAtiva: convenios.length,
    });
    const falhas = [];
    const fluxosPorConvenio = [];
    let totalFetchPublico = 0;
    let totalPlaywrightPublico = 0;
    let totalSemFluxo = 0;
    let totalSucesso = 0;

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
        await salvarSaldoRendimentoTransferegov(resultadoComCarteira, {
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

    await registrarConsultaRendimentosFim(idConsulta, resumo);

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
    if (idConsulta && typeof registrarConsultaRendimentosErro === "function") {
      try {
        await registrarConsultaRendimentosErro(idConsulta, error);
      } catch (_) {
        // ignore secondary error
      }
    }
    console.error("Falha na atualização de rendimentos Transferegov:", error.message);
    process.exit(1);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definida. Este script agora depende do Postgres/Supabase.");
    process.exit(1);
  }
  await executar();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
