/**
 * Serviço de auditoria de pendências residuais de diacrítico — PAD/PROFOR 2022.
 *
 * Classifica divergências da fila de revisão quanto à possibilidade de
 * saneamento automático quando a diferença entre memória e PAD é
 * EXCLUSIVAMENTE de acentuação/diacrítico, com dados materiais compatíveis.
 *
 * Este módulo é puro (sem acesso a banco) para ser testável de forma isolada.
 * A leitura da fila e a geração de relatórios ficam no script
 * `backend/scripts/auditar-pendencias-diacritico-pad-profor-2022.js`.
 *
 * NÃO aplica decisão, NÃO publica e NÃO usa fuzzy matching amplo.
 */

const TOLERANCIA_VALOR_UNITARIO = 0.01;

// Status que já têm decisão resolutiva registrada.
const STATUS_RESOLUTIVOS = ["ACEITO", "REJEITADO", "CORRIGIDO", "APLICADO", "REVERTIDO"];

/** Remove acentos/diacríticos e normaliza espaços, sem alterar a grafia base. */
function stripDiacritics(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verdadeiro somente se `a` e `b` diferem APENAS por acentuação/diacrítico.
 * Textos idênticos retornam false (não há divergência a sanear).
 */
function diferencaApenasAcentuacaoOuDiacritico(a, b) {
  const cleanA = String(a ?? "").replace(/\s+/g, " ").trim();
  const cleanB = String(b ?? "").replace(/\s+/g, " ").trim();
  if (cleanA === cleanB) return false;
  return stripDiacritics(cleanA).toLowerCase() === stripDiacritics(cleanB).toLowerCase();
}

/** Normaliza a natureza de despesa para CAPITAL/CUSTEIO comparáveis. */
function normalizarNatureza(valor) {
  const str = String(valor ?? "").toUpperCase().trim();
  if (str.includes("CAPITAL")) return "CAPITAL";
  if (str.includes("CUSTEIO") || str.includes("CORRENTE")) return "CUSTEIO";
  return str;
}

/** Valores monetários compatíveis dentro da tolerância de R$ 0,01. */
function valorUnitarioCompativel(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= TOLERANCIA_VALOR_UNITARIO;
}

/**
 * Classifica UMA divergência. Recebe a linha bruta do banco (com payload já
 * parseado) e o `saneadasMap` (Map de equivalências de diacrítico já
 * detectadas pelo matching atual, chaveado por `convenio::descricaoMemoriaSemAcento`).
 *
 * Retorna { classificacao, motivo }. Classificações possíveis:
 *  - saneavel_automaticamente_por_diacritico
 *  - divergencia_material
 *  - historico_nao_reapresentado_sem_correspondencia
 *  - dados_insuficientes
 *  - ja_decidido
 */
function classificarDivergenciaDiacritico(div, payload = {}, saneadasMap = new Map()) {
  if (STATUS_RESOLUTIVOS.includes(div.status)) {
    return {
      classificacao: "ja_decidido",
      motivo: `Divergência já possui decisão resolutiva com status ${div.status}.`,
    };
  }

  if (div.tipo_alerta === "equivalencia_por_descricao_normalizada") {
    const descMemoria = payload.descricaoMemoria || div.valor_anterior;
    const descPad = payload.descricaoPad || div.valor_novo;
    if (!descMemoria || !descPad) {
      return { classificacao: "dados_insuficientes", motivo: "Campos de descrição ausentes no payload." };
    }
    if (!diferencaApenasAcentuacaoOuDiacritico(descMemoria, descPad)) {
      return {
        classificacao: "divergencia_material",
        motivo: "Divergência de descrição normalizada com diferença material/técnica além de acentuação.",
      };
    }
    const vuMemoria = Number(payload.valorUnitarioMemoria);
    const vuPad = Number(payload.valorUnitarioPad);
    const vuCompativel = valorUnitarioCompativel(vuMemoria, vuPad);
    const natMemoria = payload.naturezaMemoria;
    const natPad = payload.naturezaPad;
    const natCompativel = !natMemoria || !natPad || normalizarNatureza(natMemoria) === normalizarNatureza(natPad);

    if (vuCompativel && natCompativel) {
      return {
        classificacao: "saneavel_automaticamente_por_diacritico",
        motivo: `Diferença apenas de acentuação/diacrítico e dados materiais compatíveis (preço memória R$ ${Number.isFinite(vuMemoria) ? vuMemoria.toFixed(2) : "?"}, PAD R$ ${Number.isFinite(vuPad) ? vuPad.toFixed(2) : "?"}).`,
      };
    }
    return {
      classificacao: "divergencia_material",
      motivo: `Diferença de acentuação, mas há divergência material (preço memória R$ ${vuMemoria || 0}, PAD R$ ${vuPad || 0}; natureza memória ${natMemoria}, PAD ${natPad}).`,
    };
  }

  if (div.tipo_alerta === "item_ausente_no_pad") {
    const descMemoria = payload.descricaoMemoria
      || (div.valor_anterior !== "presente_na_memoria" ? div.valor_anterior : null);
    if (!descMemoria) {
      return { classificacao: "dados_insuficientes", motivo: "Descrição da memória ausente no payload/valor_anterior." };
    }
    // Sinal primário: flag saneadoPorDiacritico no payload (gerada pelo matching).
    // Sinal secundário: cruzar com equivalenciasDiacriticoSaneadas.
    const flagPayload = payload.saneadoPorDiacritico === true;
    const chaveSaneada = `${div.numero_convenio}::${stripDiacritics(descMemoria).toLowerCase()}`;
    const correspondente = saneadasMap.get(chaveSaneada);
    if (flagPayload || correspondente) {
      const descPad = correspondente
        ? correspondente.descricaoOriginalPad
        : "(item correspondente identificado pelo matching atual)";
      return {
        classificacao: "saneavel_automaticamente_por_diacritico",
        motivo: `Item marcado como ausente reaparece no PAD com diferença apenas de acentuação: '${descPad}'. Não há ausência real.`,
      };
    }
    return {
      classificacao: "historico_nao_reapresentado_sem_correspondencia",
      motivo: "Item conhecido da memória ausente no PAD sem correspondência de acentuação no matching atual.",
    };
  }

  return {
    classificacao: "historico_nao_reapresentado_sem_correspondencia",
    motivo: `Divergência do tipo '${div.tipo_alerta}' não é tratada por saneamento de diacrítico.`,
  };
}

/** Constrói o Map de equivalências de diacrítico já saneadas pelo matching. */
function montarSaneadasMap(equivalenciasDiacriticoSaneadas = []) {
  const mapa = new Map();
  for (const item of equivalenciasDiacriticoSaneadas) {
    const chave = `${item.numeroConvenio}::${stripDiacritics(item.descricaoOriginalMemoria).toLowerCase()}`;
    mapa.set(chave, item);
  }
  return mapa;
}

module.exports = {
  TOLERANCIA_VALOR_UNITARIO,
  STATUS_RESOLUTIVOS,
  stripDiacritics,
  diferencaApenasAcentuacaoOuDiacritico,
  normalizarNatureza,
  valorUnitarioCompativel,
  classificarDivergenciaDiacritico,
  montarSaneadasMap,
};
