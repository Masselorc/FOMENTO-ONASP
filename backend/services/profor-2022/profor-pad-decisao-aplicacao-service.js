const { query } = require("../../db/postgres-client");
const {
  DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA,
  ehSaldoResidualProfor,
  areaSaldoResidualEhOperacional,
  naturezaSaldoResidualValida,
  normalizarNaturezaSaldoResidual,
} = require("./profor-saldo-residual-service");

/**
 * Etapa 8.1 — Motor de aplicação material das decisões de revisão em dry-run.
 *
 * Este serviço interpreta as decisões resolutivas registradas na revisão
 * assistida (`profor_2022_revisao_decisoes`) e as transforma em regras técnicas
 * de reconstrução. As regras só valem na camada dry-run: não alteram a origem
 * ativa, não publicam, não alteram `frontend/data/publicados` e não modificam
 * nenhuma tabela do SQLite.
 */

const DECISOES_RESOLUTIVAS = ["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"];

// Tipos de alerta agrupados por efeito técnico.
const TIPOS_EQUIVALENCIA = new Set(["equivalencia_por_descricao_normalizada"]);
const TIPOS_RATEIO = new Set([
  "item_pad_sem_rateio",
  "item_novo_sem_rateio",
  "rateio_novo",
  "correcao_de_rateio",
]);
const TIPOS_AUSENCIA = new Set(["item_ausente_no_pad", "item_substituido"]);
// `item_nao_apto` é o tipo de divergência gerado na fila de revisão;
// `item_conhecido_nao_apto` é o tipo do alerta do leitor/matching;
// `item_conhecido_nao_apto_usado` é o tipo do impedimento interno da
// reconstrução — incluído aqui como alias para evitar incompatibilidade caso
// uma divergência futura chegue à fila com esse rótulo.
const TIPOS_NAO_APTO = new Set([
  "item_nao_apto",
  "item_conhecido_nao_apto",
  "item_conhecido_nao_apto_usado",
]);
const TIPOS_CONSISTENCIA = new Set(["quantidade_valor_unitario_inconsistente"]);
const TIPOS_CAMPO = new Set([
  "valor_diferente",
  "quantidade_diferente",
  "valor_unitario_diferente",
  "saldo_inconsistente",
  "descricao_divergente",
  "natureza_divergente",
]);

function parseJsonSeguro(texto, padrao) {
  if (texto === null || texto === undefined || texto === "") return padrao;
  if (typeof texto === "object") return texto;
  try {
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
}

/** Extrai um rateio manual do payload da decisão, normalizado para o formato dos rateios. */
function extrairRateioManual(payloadDecisao) {
  const lista = Array.isArray(payloadDecisao?.rateio)
    ? payloadDecisao.rateio
    : (Array.isArray(payloadDecisao?.rateios) ? payloadDecisao.rateios : null);
  if (!lista || !lista.length) return null;
  return lista.map((item) => ({
    area: String(item?.area ?? "").trim(),
    natureza: String(item?.natureza ?? "").trim(),
    percentual_valor: Number(item?.percentualValor ?? item?.percentual_valor) || 0,
    percentual_quantidade: Number(item?.percentualQuantidade ?? item?.percentual_quantidade) || 0,
    valor_previsto_referencia: Number(item?.valorPrevistoReferencia ?? item?.valor_previsto_referencia) || 0,
    valor_executado_referencia: Number(item?.valorExecutadoReferencia ?? item?.valor_executado_referencia) || 0,
    quantidade_referencia: Number(item?.quantidadeReferencia ?? item?.quantidade_referencia) || 0,
  }));
}

/** Valida um rateio manual: áreas/naturezas preenchidas e percentuais coerentes. */
function validarRateioManual(rateios) {
  if (!Array.isArray(rateios) || !rateios.length) {
    return { valido: false, motivo: "rateio vazio no payload da decisão" };
  }
  for (const rateio of rateios) {
    if (!rateio.area) return { valido: false, motivo: "rateio com área vazia" };
    if (!rateio.natureza) return { valido: false, motivo: "rateio com natureza vazia" };
  }
  const somaValor = rateios.reduce((total, rateio) => total + (Number(rateio.percentual_valor) || 0), 0);
  const somaQuantidade = rateios.reduce((total, rateio) => total + (Number(rateio.percentual_quantidade) || 0), 0);
  const somaReferencia = rateios.reduce((total, rateio) => total + (Number(rateio.valor_previsto_referencia) || 0), 0);
  if (somaValor > 0 || somaQuantidade > 0) {
    if (somaValor > 0 && Math.abs(somaValor - 100) > 0.5) {
      return { valido: false, motivo: `soma de percentualValor (${somaValor}) diferente de 100` };
    }
    if (somaQuantidade > 0 && Math.abs(somaQuantidade - 100) > 0.5) {
      return { valido: false, motivo: `soma de percentualQuantidade (${somaQuantidade}) diferente de 100` };
    }
    return { valido: true };
  }
  if (somaReferencia > 0) return { valido: true };
  return { valido: false, motivo: "rateio sem percentuais nem valores de referência" };
}

function obterDescricaoSaldoResidualDivergencia(divergencia) {
  const payload = divergencia?.payload || {};
  return payload.descricaoPad
    || payload.descricaoMemoria
    || payload.pad?.descricao
    || payload.depois?.descricao
    || payload.memoria?.descricao
    || payload.antes?.descricao
    || divergencia?.valorNovo
    || divergencia?.valorAnterior
    || divergencia?.chaveItem
    || "";
}

function validarRateioSaldoResidual(divergencia, rateios) {
  const descricao = obterDescricaoSaldoResidualDivergencia(divergencia);
  if (!ehSaldoResidualProfor(descricao)) return { valido: true };

  const naturezas = new Set();
  for (const rateio of rateios) {
    if (areaSaldoResidualEhOperacional(rateio.area)) {
      return {
        valido: false,
        motivo: `${DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA} Rateio informou area operacional '${rateio.area}'.`,
      };
    }
    const natureza = normalizarNaturezaSaldoResidual(rateio.natureza);
    if (!naturezaSaldoResidualValida(natureza)) {
      return {
        valido: false,
        motivo: `${DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA} Natureza obrigatoria ausente ou invalida no rateio.`,
      };
    }
    naturezas.add(natureza);
  }
  if (naturezas.size > 1) {
    return {
      valido: false,
      motivo: `${DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA} Rateio mistura naturezas: ${Array.from(naturezas).join(", ")}.`,
    };
  }
  return { valido: true };
}

function obterCampoCorrigido(decisao) {
  const payload = decisao.payloadDecisao || {};
  const valor = payload.valorCorrigido !== undefined ? payload.valorCorrigido
    : (payload.valor !== undefined ? payload.valor : decisao.valorAplicado);
  return valor === undefined || valor === null ? null : valor;
}

/**
 * Interpreta uma decisão resolutiva sobre uma divergência e devolve o efeito
 * técnico a ser usado na reconstrução/comparador dry-run. Função pura: não
 * acessa o banco.
 *
 * Retorna { aplicavel, efeito, motivoNaoAplicavel }.
 * - `aplicavel = true`: a decisão foi traduzida num efeito técnico determinístico
 *   (inclui REJEITADO/REVERTIDO, que mantêm o impedimento de forma intencional);
 * - `aplicavel = false`: não foi possível derivar efeito (payload ausente,
 *   rateio inválido, decisão sem valor corrigido ou tipo não suportado).
 */
function interpretarDecisaoRevisao(divergencia, decisao) {
  const tipo = String(divergencia?.tipoAlerta || "");
  const acao = String(decisao?.decisao || "").toUpperCase();
  const campo = divergencia?.campoAfetado || null;

  if (!DECISOES_RESOLUTIVAS.includes(acao)) {
    return {
      aplicavel: false,
      efeito: { tipo: "decisao_nao_resolutiva", afetaReconstrucao: false },
      motivoNaoAplicavel: `Decisão '${acao || "vazia"}' não é resolutiva.`,
    };
  }

  if (TIPOS_EQUIVALENCIA.has(tipo)) {
    if (acao === "ACEITO") {
      return { aplicavel: true, efeito: { tipo: "equivalencia_aceita", afetaReconstrucao: true }, motivoNaoAplicavel: null };
    }
    if (acao === "REJEITADO" || acao === "REVERTIDO") {
      return { aplicavel: true, efeito: { tipo: "equivalencia_rejeitada", afetaReconstrucao: false }, motivoNaoAplicavel: null };
    }
    return {
      aplicavel: false,
      efeito: { tipo: "decisao_sem_efeito_definido", afetaReconstrucao: false },
      motivoNaoAplicavel: "CORRIGIDO não tem efeito definido para equivalência por descrição normalizada.",
    };
  }

  if (TIPOS_RATEIO.has(tipo)) {
    if (acao === "ACEITO" || acao === "CORRIGIDO") {
      const rateios = extrairRateioManual(decisao?.payloadDecisao);
      if (!rateios) {
        return {
          aplicavel: false,
          efeito: { tipo: "decisao_sem_rateio_aplicavel", afetaReconstrucao: false },
          motivoNaoAplicavel: "Decisão de rateio sem rateio no payloadDecisao.",
        };
      }
      const validacao = validarRateioManual(rateios);
      if (!validacao.valido) {
        return {
          aplicavel: false,
          efeito: { tipo: "decisao_rateio_invalido", afetaReconstrucao: false },
          motivoNaoAplicavel: `Rateio do payloadDecisao inválido: ${validacao.motivo}.`,
        };
      }
      const validacaoSaldoResidual = validarRateioSaldoResidual(divergencia, rateios);
      if (!validacaoSaldoResidual.valido) {
        return {
          aplicavel: false,
          efeito: { tipo: "saldo_residual_rateio_invalido", afetaReconstrucao: false },
          motivoNaoAplicavel: validacaoSaldoResidual.motivo,
        };
      }
      return { aplicavel: true, efeito: { tipo: "rateio_manual", afetaReconstrucao: true, rateios }, motivoNaoAplicavel: null };
    }
    return { aplicavel: true, efeito: { tipo: "rateio_recusado", afetaReconstrucao: false }, motivoNaoAplicavel: null };
  }

  if (TIPOS_AUSENCIA.has(tipo)) {
    if (acao === "ACEITO") {
      return {
        aplicavel: true,
        efeito: { tipo: "ausencia_confirmada", afetaReconstrucao: false, afetaComparador: true },
        motivoNaoAplicavel: null,
      };
    }
    if (acao === "REJEITADO" || acao === "REVERTIDO") {
      return { aplicavel: true, efeito: { tipo: "ausencia_rejeitada", afetaReconstrucao: false }, motivoNaoAplicavel: null };
    }
    return {
      aplicavel: false,
      efeito: { tipo: "decisao_sem_efeito_definido", afetaReconstrucao: false },
      motivoNaoAplicavel: "CORRIGIDO não tem efeito definido para item ausente no PAD.",
    };
  }

  if (TIPOS_NAO_APTO.has(tipo)) {
    if (acao === "ACEITO" || acao === "CORRIGIDO") {
      return { aplicavel: true, efeito: { tipo: "nao_apto_liberado", afetaReconstrucao: true }, motivoNaoAplicavel: null };
    }
    return { aplicavel: true, efeito: { tipo: "nao_apto_mantido", afetaReconstrucao: false }, motivoNaoAplicavel: null };
  }

  if (TIPOS_CONSISTENCIA.has(tipo)) {
    if (acao === "ACEITO") {
      return { aplicavel: true, efeito: { tipo: "consistencia_saneada", afetaReconstrucao: true }, motivoNaoAplicavel: null };
    }
    if (acao === "REJEITADO" || acao === "REVERTIDO") {
      return { aplicavel: true, efeito: { tipo: "consistencia_mantida", afetaReconstrucao: false }, motivoNaoAplicavel: null };
    }
    return {
      aplicavel: false,
      efeito: { tipo: "decisao_sem_efeito_definido", afetaReconstrucao: false },
      motivoNaoAplicavel: "CORRIGIDO não recalcula total previsto; sem efeito definido para inconsistência quantidade × valor unitário.",
    };
  }

  if (TIPOS_CAMPO.has(tipo)) {
    if (acao === "ACEITO") {
      return {
        aplicavel: true,
        efeito: { tipo: "campo_pad_aceito", campo, afetaReconstrucao: false, afetaComparador: true },
        motivoNaoAplicavel: null,
      };
    }
    if (acao === "CORRIGIDO") {
      const valor = obterCampoCorrigido(decisao);
      if (valor === null) {
        return {
          aplicavel: false,
          efeito: { tipo: "decisao_corrigido_sem_valor", afetaReconstrucao: false },
          motivoNaoAplicavel: "Decisão CORRIGIDO sem valor corrigido no payloadDecisao.",
        };
      }
      return {
        aplicavel: true,
        efeito: { tipo: "campo_corrigido", campo, valor, afetaReconstrucao: true, afetaComparador: true },
        motivoNaoAplicavel: null,
      };
    }
    return { aplicavel: true, efeito: { tipo: "campo_pad_rejeitado", campo, afetaReconstrucao: false }, motivoNaoAplicavel: null };
  }

  return {
    aplicavel: false,
    efeito: { tipo: "tipo_alerta_nao_suportado", afetaReconstrucao: false },
    motivoNaoAplicavel: `Tipo de alerta '${tipo || "vazio"}' ainda não tem efeito técnico definido.`,
  };
}

/** Carrega a última decisão resolutiva de cada divergência que tem alguma. */
async function carregarUltimasDecisoesResolutivas(client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const p1 = DECISOES_RESOLUTIVAS.map((_, i) => `$${i + 1}`).join(", ");
  const p2 = DECISOES_RESOLUTIVAS.map((_, i) => `$${DECISOES_RESOLUTIVAS.length + i + 1}`).join(", ");
  const result = await exec(`
    SELECT
      d.id AS divergencia_id, d.chave_divergencia, d.numero_convenio, d.uf,
      d.chave_item, d.tipo_alerta, d.nivel, d.status, d.campo_afetado,
      d.bloqueia_publicacao, d.payload_json,
      dec.id AS decisao_id, dec.decisao, dec.valor_aplicado, dec.justificativa,
      dec.usuario, dec.decidido_em, dec.payload_decisao_json
    FROM profor_2022_revisao_divergencias d
    JOIN profor_2022_revisao_decisoes dec ON dec.divergencia_id = d.id
    WHERE dec.decisao IN (${p1})
      AND dec.id = (
        SELECT MAX(x.id) FROM profor_2022_revisao_decisoes x
        WHERE x.divergencia_id = d.id AND x.decisao IN (${p2})
      )
    ORDER BY d.id
  `, [...DECISOES_RESOLUTIVAS, ...DECISOES_RESOLUTIVAS]);
  return result.rows;
}

function criarRegrasVazias() {
  return {
    equivalenciasAceitas: new Map(),
    equivalenciasRejeitadas: new Set(),
    rateiosManuais: new Map(),
    rateiosRecusados: new Set(),
    naoAptoLiberado: new Map(),
    naoAptoMantido: new Set(),
    ausenciasConfirmadas: new Map(),
    ausenciasRejeitadas: new Set(),
    consistenciaSaneadaPorDivergencia: new Map(),
    camposSaneadosPorChaveItem: new Map(),
  };
}

function indexarRegraPorEfeito(regras, registro) {
  const chaveItem = registro.chaveItem;
  const efeito = registro.efeito;
  switch (efeito.tipo) {
    case "equivalencia_aceita":
      if (chaveItem) regras.equivalenciasAceitas.set(chaveItem, registro);
      break;
    case "equivalencia_rejeitada":
      if (chaveItem) regras.equivalenciasRejeitadas.add(chaveItem);
      break;
    case "rateio_manual":
      if (chaveItem) regras.rateiosManuais.set(chaveItem, registro);
      break;
    case "rateio_recusado":
      if (chaveItem) regras.rateiosRecusados.add(chaveItem);
      break;
    case "nao_apto_liberado":
      if (chaveItem) regras.naoAptoLiberado.set(chaveItem, registro);
      break;
    case "nao_apto_mantido":
      if (chaveItem) regras.naoAptoMantido.add(chaveItem);
      break;
    case "ausencia_confirmada":
      if (chaveItem) regras.ausenciasConfirmadas.set(chaveItem, registro);
      break;
    case "ausencia_rejeitada":
      if (chaveItem) regras.ausenciasRejeitadas.add(chaveItem);
      break;
    case "consistencia_saneada":
      regras.consistenciaSaneadaPorDivergencia.set(registro.chaveDivergencia, registro);
      break;
    case "campo_pad_aceito":
    case "campo_corrigido":
      if (chaveItem) {
        if (!regras.camposSaneadosPorChaveItem.has(chaveItem)) {
          regras.camposSaneadosPorChaveItem.set(chaveItem, []);
        }
        regras.camposSaneadosPorChaveItem.get(chaveItem).push(registro);
      }
      break;
    default:
      break;
  }
}

/**
 * Carrega as decisões resolutivas, interpreta cada uma e devolve as regras de
 * aplicação dry-run, além das listas serializáveis de decisões encontradas,
 * aplicadas e não aplicáveis.
 *
 * Modo somente leitura: não escreve em nenhuma tabela.
 */
async function carregarAplicacaoDecisoesDryRun(client = null) {
  const linhas = await carregarUltimasDecisoesResolutivas(client);
  const regras = criarRegrasVazias();
  const decisoesResolutivasEncontradas = [];
  const decisoesAplicadasDryRun = [];
  const decisoesNaoAplicaveis = [];

  for (const linha of linhas) {
    const divergencia = {
      divergenciaId: linha.divergencia_id,
      chaveDivergencia: linha.chave_divergencia,
      numeroConvenio: linha.numero_convenio,
      uf: linha.uf,
      chaveItem: linha.chave_item,
      tipoAlerta: linha.tipo_alerta,
      nivel: linha.nivel,
      campoAfetado: linha.campo_afetado,
      bloqueiaPublicacao: linha.bloqueia_publicacao === true || linha.bloqueia_publicacao === 1,
      payload: parseJsonSeguro(linha.payload_json, {}),
    };
    const decisao = {
      decisaoId: linha.decisao_id,
      decisao: linha.decisao,
      valorAplicado: linha.valor_aplicado,
      justificativa: linha.justificativa,
      usuario: linha.usuario,
      decididoEm: linha.decidido_em,
      payloadDecisao: parseJsonSeguro(linha.payload_decisao_json, {}),
    };

    const interpretacao = interpretarDecisaoRevisao(divergencia, decisao);
    const registro = {
      divergenciaId: divergencia.divergenciaId,
      chaveDivergencia: divergencia.chaveDivergencia,
      numeroConvenio: divergencia.numeroConvenio,
      uf: divergencia.uf,
      chaveItem: divergencia.chaveItem,
      tipoAlerta: divergencia.tipoAlerta,
      campoAfetado: divergencia.campoAfetado,
      bloqueiaPublicacao: divergencia.bloqueiaPublicacao,
      decisao: decisao.decisao,
      decisaoId: decisao.decisaoId,
      usuario: decisao.usuario,
      decididoEm: decisao.decididoEm,
      efeito: interpretacao.efeito,
      aplicavel: interpretacao.aplicavel,
      motivoNaoAplicavel: interpretacao.motivoNaoAplicavel,
      payload: divergencia.payload,
      payloadDecisao: decisao.payloadDecisao,
    };

    decisoesResolutivasEncontradas.push({
      divergenciaId: registro.divergenciaId,
      chaveDivergencia: registro.chaveDivergencia,
      tipoAlerta: registro.tipoAlerta,
      decisao: registro.decisao,
      decisaoId: registro.decisaoId,
    });

    if (interpretacao.aplicavel) {
      decisoesAplicadasDryRun.push(registro);
      indexarRegraPorEfeito(regras, registro);
    } else {
      decisoesNaoAplicaveis.push(registro);
    }
  }

  // Métricas desambiguadas: uma decisão "interpretada" foi traduzida num efeito
  // técnico determinístico; nem toda interpretada altera a reconstrução —
  // REJEITADO/REVERTIDO mantêm o impedimento (afetaReconstrucao = false).
  const totalDecisoesComEfeitoNaReconstrucao = decisoesAplicadasDryRun.filter(
    (registro) => registro.efeito && registro.efeito.afetaReconstrucao === true
  ).length;
  const totalDecisoesSemEfeitoNaReconstrucao =
    decisoesAplicadasDryRun.length - totalDecisoesComEfeitoNaReconstrucao;

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    regras,
    decisoesResolutivasEncontradas,
    decisoesAplicadasDryRun,
    decisoesNaoAplicaveis,
    totalDecisoesResolutivasEncontradas: decisoesResolutivasEncontradas.length,
    // `totalDecisoesInterpretadasDryRun` é a contagem semântica clara das
    // decisões traduzidas em efeito técnico; `totalDecisoesAplicadasDryRun` é
    // mantido como alias dela para compatibilidade com relatórios existentes.
    totalDecisoesInterpretadasDryRun: decisoesAplicadasDryRun.length,
    totalDecisoesAplicadasDryRun: decisoesAplicadasDryRun.length,
    totalDecisoesNaoAplicaveis: decisoesNaoAplicaveis.length,
    totalDecisoesComEfeitoNaReconstrucao,
    totalDecisoesSemEfeitoNaReconstrucao,
  };
}

module.exports = {
  DECISOES_RESOLUTIVAS,
  interpretarDecisaoRevisao,
  extrairRateioManual,
  validarRateioManual,
  validarRateioSaldoResidual,
  carregarAplicacaoDecisoesDryRun,
};
