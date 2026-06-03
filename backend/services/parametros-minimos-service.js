const { query, withTransaction } = require("../db/postgres-client");
const { registrarHistoricoPostgres } = require("./historico-service");
const { validarSenhaEdicao } = require("./auth-service");
const logsOperacionaisService = require("./logs-operacionais-service");
const {
  PARAMETROS_MINIMOS,
  isStatusParametroMinimo,
  normalizarStatusParametroMinimo,
  statusParaTela
} = require("./parametros-minimos-config");

const PAGINA = "parametros-minimos";
const UFS_BRASIL = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

function ehObjetoPlano(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

async function registrarLogParametrosMinimosSeguro(payload) {
  try {
    await logsOperacionaisService.registrarLogOperacional({
      modulo: "sistema",
      tipoEvento: "parametros_minimos_edicao",
      status: "sucesso",
      resumo: "Parâmetros mínimos atualizados",
      payload,
    });
  } catch (error) {
    console.warn(`[logs-operacionais] Falha ao registrar parametros_minimos_edicao: ${error?.message || "erro desconhecido"}`);
  }
}

function normalizarUf(uf) {
  return String(uf || "").trim().toUpperCase();
}

function validarUf(uf) {
  return UFS_BRASIL.has(normalizarUf(uf));
}

function extrairDeficit(status) {
  const falta = String(status || "").match(/^FALTA \+(\d+)$/);
  if (falta) return Number(falta[1]);
  return normalizarStatusParametroMinimo(status) === "DÉFICIT" ? 1 : 0;
}

function calcularStatusQuantitativo(quantidadeAtual, quantidadeIdeal, statusFallback) {
  if (quantidadeAtual === null || quantidadeAtual === undefined || quantidadeIdeal === null || quantidadeIdeal === undefined) {
    return normalizarStatusParametroMinimo(statusFallback);
  }

  const deficit = Math.max(0, Number(quantidadeIdeal) - Number(quantidadeAtual));
  return deficit > 0 ? `FALTA +${deficit}` : "TEM";
}

function calcularQuantidadeAtual(config, statusBanco, deficit) {
  if (config.tipo !== "quantitativo") return null;
  const ideal = Number(config.idealMinimo || config.quantidadeIdeal) || 0;

  // Fallback para bancos antigos: antes das colunas quantitativas, só existia o status final.
  if (statusBanco === "TEM") return ideal;
  if (deficit > 0) return Math.max(0, ideal - deficit);
  return null;
}

function obterClasseStatusGeral(parametros) {
  const possuiPendencia = parametros.some((item) => item.statusNormalizado !== "Tem");
  if (!possuiPendencia) return "Tem";

  const somenteValidar = parametros.every((item) => ["Tem", "Validar"].includes(item.statusNormalizado));
  return somenteValidar ? "Validar" : "Parcial";
}

function obterFalta(config, statusTela, deficit) {
  if (statusTela === "Tem") return "-";
  if (statusTela === "Déficit") return "Déficit material";
  if (statusTela.startsWith("Falta +")) {
    return `+${deficit} ${config.unidadeProvidencia || config.label.toLowerCase()}`;
  }
  if (statusTela === "Não informado") return "Informação insuficiente";
  return config.label;
}

function obterProvidencia(config, statusTela, deficit) {
  if (statusTela === "Tem") return "Não se aplica";
  if (config.providencias?.[statusTela]) return config.providencias[statusTela];
  if (statusTela === "Não tem") return `Providenciar ${config.label.toLowerCase()}`;
  if (statusTela === "Parcial") return `Adequar/complementar ${config.label.toLowerCase()}`;
  if (statusTela === "Validar") return `Validar/comprovar ${config.label.toLowerCase()}`;
  if (statusTela === "Não informado") return `Informar ${config.label.toLowerCase()}`;
  if (statusTela === "Déficit") return `Corrigir déficit em ${config.label.toLowerCase()}`;
  if (statusTela.startsWith("Falta +")) {
    return `Prever aquisição/complementação de ${deficit} ${config.unidadeProvidencia || config.label.toLowerCase()}`;
  }

  return `Verificar ${config.label.toLowerCase()}`;
}

function obterPerguntasDiagnostico(config) {
  if (Array.isArray(config.perguntas) && config.perguntas.length) return config.perguntas;
  if (config.tipo === "quantitativo") return [...(config.atual || []), ...(config.ideal || [])];
  return [config.label];
}

function montarRespostaUf(linha, config, statusTela, atualDeclarado, idealDeclarado) {
  if (linha.resposta_original && String(linha.resposta_original).trim()) {
    return String(linha.resposta_original).trim();
  }

  if (config.tipo === "quantitativo") {
    const atual = atualDeclarado === null || atualDeclarado === undefined ? "Não informado" : atualDeclarado;
    const ideal = idealDeclarado === null || idealDeclarado === undefined ? "Não informado" : idealDeclarado;
    return `Atual: ${atual} | Ideal: ${ideal}`;
  }

  return `Resultado consolidado: ${statusTela}`;
}

function obterValidacaoOnasp(config, statusTela) {
  if (!config.requerValidacao) return "Não se aplica";
  if (statusTela === "Tem") return "Validado";
  if (statusTela === "Validar") return "Pendente";
  return "Não validado";
}

function montarResumoParametros(parametros) {
  const parametrosAtendidos = parametros.filter((item) => item.statusNormalizado === "Tem").length;
  const itensParaValidar = parametros.filter((item) => item.statusNormalizado === "Validar").length;
  const pendencias = parametros.filter((item) => item.statusNormalizado !== "Tem").length;
  const deficitMaterial = parametros.reduce((total, item) => total + (Number(item.deficit) || 0), 0);

  return {
    total: parametros.length,
    parametrosAtendidos,
    pendencias,
    deficitMaterial,
    itensParaValidar,
    statusGeral: obterClasseStatusGeral(parametros)
  };
}

function montarResposta(uf, linhas) {
  const porParametro = new Map(linhas.map((linha) => [linha.parametro, linha]));
  const parametrosMinimos = PARAMETROS_MINIMOS.map((config) => {
    const linha = porParametro.get(config.key) || {};
    const quantidadeAtual = linha.quantidade_atual === null || linha.quantidade_atual === undefined ? null : Number(linha.quantidade_atual);
    const quantidadeIdeal = linha.quantidade_ideal === null || linha.quantidade_ideal === undefined ? null : Number(linha.quantidade_ideal);
    const statusBanco = config.tipo === "quantitativo"
      ? calcularStatusQuantitativo(quantidadeAtual, quantidadeIdeal, linha.status)
      : normalizarStatusParametroMinimo(linha.status);
    const statusTela = statusParaTela(statusBanco);
    const deficit = extrairDeficit(statusBanco);
    const atualDeclarado = config.tipo === "quantitativo"
      ? (quantidadeAtual === null || Number.isNaN(quantidadeAtual) ? calcularQuantidadeAtual(config, statusBanco, deficit) : quantidadeAtual)
      : null;
    const idealDeclarado = config.tipo === "quantitativo"
      ? (quantidadeIdeal === null || Number.isNaN(quantidadeIdeal) ? null : quantidadeIdeal)
      : null;

    return {
      arquivoOrigem: "Dados consolidados ONASP",
      uf,
      idResposta: uf,
      idParametro: config.key,
      trilha: config.trilha,
      eixo: config.trilha,
      parametro: config.label,
      parametroCurto: config.label,
      tipo: config.tipo === "quantitativo" ? "quantitativo" : "qualitativo",
      fundamentoIn: config.fundamentoIn || "Referência normativa ONASP",
      perguntasDiagnostico: obterPerguntasDiagnostico(config),
      respostaUf: montarRespostaUf(linha, config, statusTela, atualDeclarado, idealDeclarado),
      respostaOriginal: montarRespostaUf(linha, config, statusTela, atualDeclarado, idealDeclarado),
      statusOperacional: statusTela,
      statusNormalizado: statusTela,
      faltaObjetiva: obterFalta(config, statusTela, deficit),
      providenciaObjetiva: obterProvidencia(config, statusTela, deficit),
      atualDeclarado,
      idealDeclarado,
      deficit,
      validacaoOnasp: obterValidacaoOnasp(config, statusTela),
      prioridade: statusTela === "Tem" ? "Média" : "Alta"
    };
  });
  const resumoParametrosMinimos = montarResumoParametros(parametrosMinimos);

  return {
    arquivoOrigem: "Dados consolidados ONASP",
    idResposta: uf,
    codigoValidacao: uf,
    uf,
    unidadeDiagnosticada: `Ouvidoria de Serviços Penais - ${uf}`,
    dataResposta: "Dados consolidados ONASP",
    statusGeral: resumoParametrosMinimos.statusGeral,
    statusGeralParametrosMinimos: resumoParametrosMinimos.statusGeral,
    resumoParametrosMinimos,
    parametrosMinimos,
    faltasParametrosMinimos: parametrosMinimos
      .filter((item) => item.statusNormalizado !== "Tem")
      .map((item) => ({
        item: item.parametro,
        status: item.statusNormalizado,
        falta: item.faltaObjetiva,
        providencia: item.providenciaObjetiva
      })),
    providenciasParametrosMinimos: parametrosMinimos
      .filter((item) => item.statusNormalizado !== "Tem")
      .map((item) => ({
        item: item.parametro,
        situacao: item.statusNormalizado,
        providencia: item.providenciaObjetiva,
        prioridade: item.prioridade
      }))
  };
}

function montarResumoGeral(respostas) {
  const ufs = respostas.map((resposta) => resposta.uf).sort();
  return {
    totalRespostas: respostas.length,
    ufsDiagnosticadas: new Set(ufs).size,
    unidadesDiagnosticadas: respostas.length,
    conformes: respostas.filter((resposta) => resposta.statusGeralParametrosMinimos === "Tem").length,
    parcialmenteConformes: respostas.filter((resposta) => resposta.statusGeralParametrosMinimos === "Parcial").length,
    naoConformes: respostas.filter((resposta) => resposta.parametrosMinimos.some((item) => ["Não tem", "Déficit"].includes(item.statusNormalizado) || item.statusNormalizado.startsWith("Falta +"))).length,
    naoInformadas: respostas.filter((resposta) => resposta.parametrosMinimos.some((item) => item.statusNormalizado === "Não informado")).length,
    deficitTotalDeclarado: respostas.reduce((total, resposta) => total + resposta.resumoParametrosMinimos.deficitMaterial, 0),
    filtros: {
      ufs,
      unidades: ufs,
      statusGerais: ["Tem", "Parcial", "Validar"],
      eixos: ["Institucionalização", "Pessoas", "Estrutura", "Canais", "Fluxo"],
      statusParametros: ["Tem", "Parcial", "Não tem", "Validar", "Não informado", "Déficit", "Falta +X"],
      validacoesOnasp: ["Validado", "Pendente", "Não validado", "Não se aplica"]
    }
  };
}

async function listarParametrosMinimos() {
  const { rows: linhas } = await query(`
    SELECT uf, parametro, status, quantidade_atual, quantidade_ideal, resposta_original, atualizado_em
    FROM parametros_minimos
    ORDER BY uf, parametro
  `);
  const porUf = new Map();

  linhas.forEach((linha) => {
    if (!porUf.has(linha.uf)) porUf.set(linha.uf, []);
    porUf.get(linha.uf).push(linha);
  });

  const respostas = Array.from(porUf.entries()).map(([uf, itens]) => montarResposta(uf, itens));

  return {
    arquivo: "Dados consolidados ONASP",
    disponivel: true,
    erro: "",
    aba: "parametros_minimos",
    parametrosDisponiveis: PARAMETROS_MINIMOS,
    respostasBrutas: linhas,
    respostas,
    resumo: montarResumoGeral(respostas),
    diagnostico: {
      colunasDisponiveis: ["UF", ...PARAMETROS_MINIMOS.map((item) => item.label)],
      perguntasDisponiveis: PARAMETROS_MINIMOS.map((item) => item.label),
      respostasDescartadasPorDuplicidade: 0,
      aviso: ""
    }
  };
}

async function salvarParametrosMinimos({ password, changes }) {
  if (!validarSenhaEdicao(password)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  if (!ehObjetoPlano(changes)) {
    return { success: false, message: "Alteração inválida. Nenhuma alteração foi salva." };
  }

  const parametrosPermitidos = new Set(PARAMETROS_MINIMOS.map((item) => item.key));
  const parametrosMap = new Map(PARAMETROS_MINIMOS.map((item) => [item.key, item]));
  const atualizacao = [];

  try {
    Object.entries(changes).forEach(([uf, campos]) => {
      const ufNormalizada = normalizarUf(uf);
      if (!ufNormalizada || !validarUf(ufNormalizada)) {
        throw new Error(`UF inválida: ${uf}`);
      }
      if (!ehObjetoPlano(campos)) {
        throw new Error("Registro de alteração inválido.");
      }

      Object.entries(campos).forEach(([parametro, payload]) => {
        if (!parametrosPermitidos.has(parametro)) {
          throw new Error(`Parâmetro não permitido: ${parametro}`);
        }
        if (ehObjetoPlano(payload) && Object.keys(payload).length === 0) {
          throw new Error(`Payload inválido para ${parametro}.`);
        }

        const config = parametrosMap.get(parametro);
        const status = ehObjetoPlano(payload) ? payload.status : payload;
        if (!isStatusParametroMinimo(status)) {
          throw new Error(`Status inválido para ${parametro}: ${status}`);
        }

        const quantidadeAtual = ehObjetoPlano(payload) && payload.quantidadeAtual !== undefined
          ? Number(payload.quantidadeAtual)
          : undefined;
        const quantidadeIdeal = ehObjetoPlano(payload) && payload.quantidadeIdeal !== undefined
          ? Number(payload.quantidadeIdeal)
          : undefined;

        if (config?.tipo === "quantitativo" && (quantidadeAtual !== undefined || quantidadeIdeal !== undefined)) {
          if (!Number.isFinite(quantidadeAtual) || quantidadeAtual < 0 || !Number.isFinite(quantidadeIdeal) || quantidadeIdeal < 0) {
            throw new Error(`Quantidade inválida para ${parametro}.`);
          }
        }

        atualizacao.push({
          uf: ufNormalizada,
          parametro,
          status: normalizarStatusParametroMinimo(status),
          quantidadeAtual,
          quantidadeIdeal
        });
      });
    });
  } catch (error) {
    return { success: false, message: error.message };
  }

  if (!atualizacao.length) {
    return { success: false, message: "Não há alterações para salvar." };
  }

  const updatedAt = new Date().toISOString();
  const selectAtualSql = "SELECT status, quantidade_atual, quantidade_ideal FROM parametros_minimos WHERE uf = $1 AND parametro = $2";
  const upsertSql = `
    INSERT INTO parametros_minimos (uf, parametro, status, quantidade_atual, quantidade_ideal, atualizado_em)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (uf, parametro) DO UPDATE SET
      status = excluded.status,
      quantidade_atual = COALESCE(excluded.quantidade_atual, parametros_minimos.quantidade_atual),
      quantidade_ideal = COALESCE(excluded.quantidade_ideal, parametros_minimos.quantidade_ideal),
      atualizado_em = excluded.atualizado_em
  `;

  const camposAlterados = new Set();
  const registrosAfetados = new Set();
  let totalAlteracoes = 0;

  await withTransaction(async (client) => {
    for (const item of atualizacao) {
      const { rows: [anterior] } = await client.query(selectAtualSql, [item.uf, item.parametro]);
      const valorAnterior = anterior
        ? `${anterior.status}${anterior.quantidade_atual !== null && anterior.quantidade_atual !== undefined ? ` | atual ${anterior.quantidade_atual}` : ""}${anterior.quantidade_ideal !== null && anterior.quantidade_ideal !== undefined ? ` | ideal ${anterior.quantidade_ideal}` : ""}`
        : "";
      const valorNovo = `${item.status}${item.quantidadeAtual !== undefined ? ` | atual ${item.quantidadeAtual}` : ""}${item.quantidadeIdeal !== undefined ? ` | ideal ${item.quantidadeIdeal}` : ""}`;
      const houveAlteracao = String(valorAnterior) !== String(valorNovo);

      await client.query(upsertSql, [
        item.uf,
        item.parametro,
        item.status,
        item.quantidadeAtual === undefined ? null : item.quantidadeAtual,
        item.quantidadeIdeal === undefined ? null : item.quantidadeIdeal,
        updatedAt
      ]);
      await registrarHistoricoPostgres(client, {
        pagina: PAGINA,
        registro: item.uf,
        campo: item.parametro,
        valorAnterior,
        valorNovo
      });
      if (houveAlteracao) {
        totalAlteracoes += 1;
        camposAlterados.add(item.parametro);
        registrosAfetados.add(item.uf);
      }
    }
  });

  if (totalAlteracoes > 0) {
    await registrarLogParametrosMinimosSeguro({
      totalAlteracoes,
      registrosAfetados: Array.from(registrosAfetados).sort(),
      ufsAfetadas: Array.from(registrosAfetados).sort(),
      camposAlterados: Array.from(camposAlterados).sort(),
      origem: "interface",
    });
  }

  return {
    success: true,
    message: "Alterações salvas com sucesso.",
    updatedAt
  };
}

function extrairValorHistorico(valor) {
  const partes = String(valor || "").split("|").map((parte) => parte.trim()).filter(Boolean);
  const status = normalizarStatusParametroMinimo(partes[0] || "");
  const resultado = {
    status,
    quantidadeAtual: undefined,
    quantidadeIdeal: undefined
  };

  partes.slice(1).forEach((parte) => {
    const atual = parte.match(/^atual\s+(-?\d+(?:[.,]\d+)?)$/i);
    const ideal = parte.match(/^ideal\s+(-?\d+(?:[.,]\d+)?)$/i);

    if (atual) resultado.quantidadeAtual = Number(atual[1].replace(",", "."));
    if (ideal) resultado.quantidadeIdeal = Number(ideal[1].replace(",", "."));
  });

  return resultado;
}

async function reverterHistoricoParametrosMinimos({ password, historicoId }) {
  if (!validarSenhaEdicao(password)) {
    return { success: false, message: "Senha inválida. Alteração não foi revertida." };
  }

  const id = Number(historicoId);
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Histórico inválido. Nenhuma alteração foi revertida." };
  }

  const { rows: [historico] } = await query(`
    SELECT id, registro, campo, valor_anterior AS "valorAnterior", valor_novo AS "valorNovo"
    FROM historico_alteracoes
    WHERE id = $1 AND pagina = $2
  `, [id, PAGINA]);

  if (!historico) {
    return { success: false, message: "Registro de histórico não localizado." };
  }

  const parametrosPermitidos = new Set(PARAMETROS_MINIMOS.map((item) => item.key));
  if (!parametrosPermitidos.has(historico.campo)) {
    return { success: false, message: "Campo do histórico não é mais editável." };
  }
  if (!validarUf(historico.registro)) {
    return { success: false, message: "UF inválida no registro de histórico." };
  }

  const valorReversao = extrairValorHistorico(historico.valorAnterior);
  if (!isStatusParametroMinimo(valorReversao.status)) {
    return { success: false, message: "Valor anterior inválido. Alteração não foi revertida." };
  }

  const updatedAt = new Date().toISOString();
  const selectAtualSql = "SELECT status, quantidade_atual, quantidade_ideal FROM parametros_minimos WHERE uf = $1 AND parametro = $2";
  const upsertSql = `
    INSERT INTO parametros_minimos (uf, parametro, status, quantidade_atual, quantidade_ideal, atualizado_em)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (uf, parametro) DO UPDATE SET
      status = excluded.status,
      quantidade_atual = excluded.quantidade_atual,
      quantidade_ideal = excluded.quantidade_ideal,
      atualizado_em = excluded.atualizado_em
  `;

  await withTransaction(async (client) => {
    const { rows: [atual] } = await client.query(selectAtualSql, [historico.registro, historico.campo]);
    const valorAtual = atual
      ? `${atual.status}${atual.quantidade_atual !== null && atual.quantidade_atual !== undefined ? ` | atual ${atual.quantidade_atual}` : ""}${atual.quantidade_ideal !== null && atual.quantidade_ideal !== undefined ? ` | ideal ${atual.quantidade_ideal}` : ""}`
      : "";
    const valorNovo = `${valorReversao.status}${valorReversao.quantidadeAtual !== undefined ? ` | atual ${valorReversao.quantidadeAtual}` : ""}${valorReversao.quantidadeIdeal !== undefined ? ` | ideal ${valorReversao.quantidadeIdeal}` : ""}`;

    await client.query(upsertSql, [
      historico.registro,
      historico.campo,
      valorReversao.status,
      valorReversao.quantidadeAtual === undefined ? null : valorReversao.quantidadeAtual,
      valorReversao.quantidadeIdeal === undefined ? null : valorReversao.quantidadeIdeal,
      updatedAt
    ]);
    await registrarHistoricoPostgres(client, {
      pagina: PAGINA,
      registro: historico.registro,
      campo: historico.campo,
      valorAnterior: valorAtual,
      valorNovo: `${valorNovo} | reversão #${historico.id}`
    });
  });

  return {
    success: true,
    message: "Alteração revertida com sucesso.",
    updatedAt
  };
}

async function listarHistoricoParametrosMinimos() {
  const { rows } = await query(`
    SELECT id, pagina, registro, campo, valor_anterior AS "valorAnterior",
           valor_novo AS "valorNovo", alterado_em AS "alteradoEm"
    FROM historico_alteracoes
    WHERE pagina = $1
    ORDER BY id DESC
    LIMIT 200
  `, [PAGINA]);
  return rows;
}

module.exports = {
  listarParametrosMinimos,
  salvarParametrosMinimos,
  reverterHistoricoParametrosMinimos,
  listarHistoricoParametrosMinimos
};
