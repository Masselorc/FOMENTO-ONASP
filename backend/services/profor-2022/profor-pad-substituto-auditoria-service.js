/**
 * Serviço de auditoria de itens ausentes com substituto provável no PAD —
 * PROFOR 2022.
 *
 * Quando um item da memória é marcado como `item_ausente_no_pad`, ele pode, na
 * verdade, ter sido reapresentado no PAD com alteração de descrição/especificação
 * (ex.: "Notebook 2.4ghz" → "Notebook 4.2ghz"). Nesse caso não há ausência real:
 * existe um item novo correspondente, possivelmente já tratado/aceito noutra
 * divergência.
 *
 * Este módulo é puro (sem acesso a banco) para ser testável de forma isolada.
 * A leitura da fila e a geração de relatórios ficam no script
 * `backend/scripts/auditar-ausentes-com-substituto-pad-profor-2022.js`.
 *
 * NÃO aplica decisão, NÃO publica, NÃO confirma ausência automaticamente e
 * NÃO usa fuzzy matching amplo: o vínculo exige travas materiais e financeiras.
 */

// Tolerância monetária para considerar valores compatíveis.
const TOLERANCIA_VALOR = 0.01;

// Status que já têm decisão resolutiva registrada.
const STATUS_RESOLUTIVOS = ["ACEITO", "REJEITADO", "CORRIGIDO", "APLICADO", "REVERTIDO"];

// Tipos de divergência que podem conter o item novo correspondente no PAD.
const TIPOS_CANDIDATO_PAD = [
  "item_novo_sem_rateio",
  "item_pad_sem_rateio",
  "rateio_novo",
  "correcao_de_rateio",
  "equivalencia_por_descricao_normalizada",
];

/** Normaliza a natureza de despesa para CAPITAL/CUSTEIO comparáveis. */
function normalizarNatureza(valor) {
  const str = String(valor ?? "").toUpperCase().trim();
  if (str.includes("CAPITAL")) return "CAPITAL";
  if (str.includes("CUSTEIO") || str.includes("CORRENTE")) return "CUSTEIO";
  return str;
}

/** Remove acentos e normaliza espaços/caixa, sem alterar a grafia base. */
function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Dois números monetários são compatíveis dentro da tolerância de R$ 0,01. */
function valorCompativel(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= TOLERANCIA_VALOR;
}

/** Quantidades compatíveis (tolerância mínima para arredondamento). */
function quantidadeCompativel(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= 0.001;
}

/**
 * Descrições compatíveis "por alteração controlada": iguais após normalização,
 * OU divergindo apenas em um token técnico curto (ex.: frequência 2.4ghz x
 * 4.2ghz) — nunca fuzzy amplo. Travas: mesmo número de tokens e diferença em
 * no máximo UM token, e esse token contém dígitos.
 */
function descricaoCompativelPorAlteracaoControlada(descA, descB) {
  const a = normalizarTexto(descA);
  const b = normalizarTexto(descB);
  if (!a || !b) return false;
  if (a === b) return true;
  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  if (tokensA.length !== tokensB.length) return false;
  let divergentes = 0;
  let tokenDivergenteTemDigito = true;
  for (let i = 0; i < tokensA.length; i += 1) {
    if (tokensA[i] !== tokensB[i]) {
      divergentes += 1;
      if (!/\d/.test(tokensA[i]) || !/\d/.test(tokensB[i])) {
        tokenDivergenteTemDigito = false;
      }
    }
  }
  return divergentes <= 1 && tokenDivergenteTemDigito;
}

/**
 * Extrai os valores materiais da memória de uma divergência item_ausente_no_pad.
 */
function extrairMateriaisAusente(payloadAusente = {}) {
  return {
    numeroConvenio: payloadAusente.numeroConvenio,
    uf: payloadAusente.uf,
    descricao: payloadAusente.descricaoMemoria,
    natureza: payloadAusente.naturezaMemoria,
    quantidade: payloadAusente.quantidadeMemoria,
    valorUnitario: payloadAusente.valorUnitarioMemoria,
    valorPrevisto: payloadAusente.valorPrevistoMemoria,
    valorExecutado: payloadAusente.valorExecutadoMemoria,
    saldo: payloadAusente.saldoMemoria,
  };
}

/**
 * Extrai os valores materiais do PAD de um candidato (item novo / sem rateio).
 * Cobre os diferentes nomes de campo usados nos payloads de PAD.
 */
function extrairMateriaisCandidato(divCandidato, payloadCandidato = {}) {
  return {
    numeroConvenio: payloadCandidato.numeroConvenio || divCandidato.numero_convenio,
    uf: payloadCandidato.uf || divCandidato.uf,
    descricao: payloadCandidato.descricaoPad || divCandidato.valor_novo,
    natureza: payloadCandidato.naturezaPad || payloadCandidato.natureza,
    quantidade: payloadCandidato.quantidadePad ?? payloadCandidato.quantidade,
    valorUnitario: payloadCandidato.valorUnitarioPad ?? payloadCandidato.valorUnitario,
    valorPrevisto: payloadCandidato.valorPrevistoPad ?? payloadCandidato.valorPrevisto,
    valorExecutado: payloadCandidato.valorExecutadoPad ?? payloadCandidato.valorExecutado,
    saldo: payloadCandidato.saldoPad ?? payloadCandidato.saldo,
  };
}

/**
 * Avalia a compatibilidade material entre o item ausente e um candidato do PAD.
 * Retorna { criterios, todosCompativeis, materiaisDivergem }.
 */
function avaliarCompatibilidadeSubstituto(ausente, candidato) {
  const criterios = {
    mesmoConvenio: String(ausente.numeroConvenio || "") === String(candidato.numeroConvenio || ""),
    mesmaUf: !ausente.uf || !candidato.uf
      ? true
      : String(ausente.uf).toUpperCase() === String(candidato.uf).toUpperCase(),
    naturezaCompativel: !ausente.natureza || !candidato.natureza
      ? false
      : normalizarNatureza(ausente.natureza) === normalizarNatureza(candidato.natureza),
    quantidadeCompativel: quantidadeCompativel(ausente.quantidade, candidato.quantidade),
    valorUnitarioCompativel: valorCompativel(ausente.valorUnitario, candidato.valorUnitario),
    valorPrevistoCompativel: valorCompativel(ausente.valorPrevisto, candidato.valorPrevisto),
    valorExecutadoCompativel: valorCompativel(ausente.valorExecutado, candidato.valorExecutado),
    saldoCompativel: valorCompativel(ausente.saldo, candidato.saldo),
    descricaoCompativel: descricaoCompativelPorAlteracaoControlada(ausente.descricao, candidato.descricao),
  };
  const materiais = [
    criterios.naturezaCompativel,
    criterios.quantidadeCompativel,
    criterios.valorUnitarioCompativel,
    criterios.valorPrevistoCompativel,
    criterios.valorExecutadoCompativel,
    criterios.saldoCompativel,
  ];
  const todosCompativeis = criterios.mesmoConvenio
    && criterios.mesmaUf
    && materiais.every(Boolean)
    && criterios.descricaoCompativel;
  // "possível substituto com divergência": convênio bate e a maioria material
  // bate, mas há ao menos uma trava material falhando.
  const materiaisDivergem = criterios.mesmoConvenio
    && materiais.filter(Boolean).length >= 4
    && !todosCompativeis;
  return { criterios, todosCompativeis, materiaisDivergem };
}

/**
 * Classifica UMA divergência item_ausente_no_pad, buscando substituto entre os
 * candidatos. Recebe:
 *  - divAusente: linha bruta da divergência ausente (com payload parseado)
 *  - payloadAusente: payload já parseado
 *  - candidatos: lista de { divergencia, payload, payloadDecisao? } do PAD
 *
 * Retorna { classificacao, motivo, substituto }. Classificações:
 *  - substituto_compativel
 *  - possivel_substituto_com_divergencia
 *  - ausencia_real_sem_substituto
 *  - dados_insuficientes
 *  - ja_decidido
 */
function classificarAusenteComSubstituto(divAusente, payloadAusente, candidatos = []) {
  if (STATUS_RESOLUTIVOS.includes(divAusente.status)) {
    return {
      classificacao: "ja_decidido",
      motivo: `Divergência já possui decisão resolutiva (${divAusente.status}).`,
      substituto: null,
    };
  }
  if (divAusente.tipo_alerta !== "item_ausente_no_pad") {
    return {
      classificacao: "dados_insuficientes",
      motivo: `Tipo '${divAusente.tipo_alerta}' não é item_ausente_no_pad.`,
      substituto: null,
    };
  }

  const ausente = extrairMateriaisAusente(payloadAusente);
  if (!ausente.descricao || ausente.quantidade === undefined || ausente.quantidade === null) {
    return {
      classificacao: "dados_insuficientes",
      motivo: "Item ausente sem descrição ou sem dados materiais no payload.",
      substituto: null,
    };
  }

  let melhorCompativel = null;
  let melhorDivergente = null;
  for (const cand of candidatos) {
    if (!TIPOS_CANDIDATO_PAD.includes(cand.divergencia.tipo_alerta)) continue;
    if (cand.divergencia.id === divAusente.id) continue;
    const candMateriais = extrairMateriaisCandidato(cand.divergencia, cand.payload);
    const { criterios, todosCompativeis, materiaisDivergem } = avaliarCompatibilidadeSubstituto(ausente, candMateriais);
    const substituto = {
      divergenciaSubstitutaId: cand.divergencia.id,
      tipoSubstituto: cand.divergencia.tipo_alerta,
      statusSubstituto: cand.divergencia.status,
      descricaoPadSubstituta: candMateriais.descricao,
      decisaoSubstitutaJaAceita: STATUS_RESOLUTIVOS.includes(cand.divergencia.status),
      criterios,
    };
    if (todosCompativeis && !melhorCompativel) {
      melhorCompativel = substituto;
    } else if (materiaisDivergem && !melhorDivergente) {
      melhorDivergente = substituto;
    }
  }

  if (melhorCompativel) {
    const aceito = melhorCompativel.decisaoSubstitutaJaAceita ? " já aceito na revisão" : "";
    return {
      classificacao: "substituto_compativel",
      motivo: `Item reapresentado no PAD como #${melhorCompativel.divergenciaSubstitutaId}${aceito}: `
        + `"${melhorCompativel.descricaoPadSubstituta}". Convênio, natureza, quantidade e valores fecham. Não há ausência real.`,
      substituto: melhorCompativel,
    };
  }
  if (melhorDivergente) {
    return {
      classificacao: "possivel_substituto_com_divergencia",
      motivo: `Há candidato a substituto (#${melhorDivergente.divergenciaSubstitutaId}), mas com divergência material — exige revisão humana.`,
      substituto: melhorDivergente,
    };
  }
  return {
    classificacao: "ausencia_real_sem_substituto",
    motivo: "Nenhum item correspondente no PAD com dados materiais compatíveis. Tratar como ausência real.",
    substituto: null,
  };
}

module.exports = {
  TOLERANCIA_VALOR,
  STATUS_RESOLUTIVOS,
  TIPOS_CANDIDATO_PAD,
  normalizarNatureza,
  normalizarTexto,
  valorCompativel,
  quantidadeCompativel,
  descricaoCompativelPorAlteracaoControlada,
  extrairMateriaisAusente,
  extrairMateriaisCandidato,
  avaliarCompatibilidadeSubstituto,
  classificarAusenteComSubstituto,
};
