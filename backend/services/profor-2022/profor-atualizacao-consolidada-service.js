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
  extrairPlanoAplicacaoProforDoWorkbook,
} = require("../dashboard-publication-service");

const ROOT_DIR = path.join(__dirname, "..", "..", "..");
const CATALOGO_APLICACAO_PATH = path.join(__dirname, "..", "..", "data", "aplicacao.json");
const INTERVALO_RENDIMENTOS_PADRAO_MS = 500;

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function carregarCatalogoAplicacaoLocal() {
  return JSON.parse(fs.readFileSync(CATALOGO_APLICACAO_PATH, "utf8"));
}

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
    const idConsulta = registrarConsultaRendimentosInicio({
      totalCarteiraAtiva: convenios.length,
    });
    const falhas = [];
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

  return {
    sucesso,
    iniciadoEm,
    finalizadoEm,
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
    avisos,
    erros,
  };
}

function resumirAtualizacaoConsolidada(resultado) {
  if (!resultado) return "Sem resultado.";
  const linhas = [
    "--- Atualizacao consolidada PROFOR 2022 ---",
    `Inicio:        ${resultado.iniciadoEm}`,
    `Fim:           ${resultado.finalizadoEm}`,
    `Duracao:       ${resultado.duracaoMs} ms`,
    `Origem:        ${resultado.origemDados}`,
    `DETRU:         sucesso=${resultado.detru.sucesso}` +
      ` encontrados=${resultado.detru.totalEncontrados ?? "-"}/${resultado.detru.totalCarteiraAtiva ?? "-"}` +
      (resultado.detru.erro ? ` erro="${resultado.detru.erro}"` : ""),
    `Rendimentos:   sucesso=${resultado.rendimentos.sucesso}` +
      ` sucessos=${resultado.rendimentos.totalSucessos ?? "-"}/${resultado.rendimentos.totalConsultados ?? "-"}` +
      ` falhas=${resultado.rendimentos.totalFalhas ?? "-"}` +
      (resultado.rendimentos.erro ? ` erro="${resultado.rendimentos.erro}"` : ""),
    `Consolidado:   convenios=${resultado.consolidado.totalConvenios}` +
      ` detru=${resultado.consolidado.totalComDetru}` +
      ` plano=${resultado.consolidado.totalComPlano}` +
      ` rendimentos=${resultado.consolidado.totalComRendimentos}` +
      (resultado.consolidado.erro ? ` erro="${resultado.consolidado.erro}"` : ""),
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
};
