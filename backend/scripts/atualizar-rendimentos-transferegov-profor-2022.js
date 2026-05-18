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
  const idConsulta = registrarConsultaRendimentosInicio({
    totalCarteiraAtiva: convenios.length,
  });
  const falhas = [];
  let totalSucesso = 0;

  try {
    for (const convenio of convenios) {
      const resultado = await consultarSaldoRendimentosConvenio(convenio.numeroConvenio);
      const resultadoComCarteira = {
        ...resultado,
        ano: convenio.ano ?? null,
        uf: convenio.uf ?? null,
      };

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
      falhas,
    };

    registrarConsultaRendimentosFim(idConsulta, resumo);

    console.log("--- Atualização de rendimentos Transferegov PROFOR 2022 ---");
    console.log(`Carteira ativa:     ${resumo.totalCarteiraAtiva}`);
    console.log(`Consultados:        ${resumo.totalConsultados}`);
    console.log(`Sucesso:            ${resumo.totalSucesso}`);
    console.log(`Falha:              ${resumo.totalFalha}`);
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
