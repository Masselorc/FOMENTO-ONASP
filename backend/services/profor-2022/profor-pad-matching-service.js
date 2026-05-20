const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const {
  lerRelatoriosPadProfor2022,
} = require("./profor-pad-report-reader");
const {
  normalizarNumeroConvenio,
} = require("./profor-plano-aplicacao-service");
const {
  normalizarDescricaoRateioProfor,
  criarChaveItemRateioProfor,
} = require("./profor-rateio-extracao-service");

function criarAlerta({ tipo, nivel = "aviso", chaveItem = null, instrumento = null, uf = null, ano = null, descricao = null, detalhe, origem = null }) {
  return {
    tipo,
    nivel,
    chaveItem,
    instrumento,
    uf,
    ano,
    descricao,
    detalhe,
    origem,
  };
}

function limparDescricaoOriginalConferencia(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function criarChaveDescricaoOriginal(numeroConvenio, descricaoOriginal) {
  const numero = normalizarNumeroConvenio(numeroConvenio);
  const descricao = limparDescricaoOriginalConferencia(descricaoOriginal);
  return numero && descricao ? `${numero}::${descricao}` : null;
}

function carregarCarteiraMonitorada() {
  const linhas = db.prepare(`
    SELECT id, numero_convenio, ano, uf, instrumento, programa_origem, ativo
    FROM profor_convenios_monitorados
    WHERE ativo = 1
    ORDER BY numero_convenio, ano
  `).all();

  return new Map(linhas.map((linha) => [
    String(linha.numero_convenio),
    {
      id: linha.id,
      numeroConvenio: linha.numero_convenio,
      ano: linha.ano,
      uf: linha.uf,
      instrumento: linha.instrumento,
      programaOrigem: linha.programa_origem,
      ativo: linha.ativo,
    },
  ]));
}

function interpretarJsonArray(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== "string" || !valor.trim()) return [];
  try {
    const interpretado = JSON.parse(valor);
    return Array.isArray(interpretado) ? interpretado : [];
  } catch {
    return [];
  }
}

function carregarItensConhecidos() {
  const linhas = db.prepare(`
    SELECT
      i.id,
      i.chave_item,
      i.numero_convenio,
      i.descricao_normalizada,
      i.descricao_original_referencia,
      i.uf,
      i.ano,
      i.valor_unitario_referencia,
      i.naturezas_encontradas_json,
      i.apto_para_importacao_futura,
      i.possui_pendencia_impeditiva,
      i.status_item,
      i.ativo,
      COUNT(r.id) AS total_rateios_ativos
    FROM profor_2022_itens_conhecidos i
    LEFT JOIN profor_2022_item_rateios r
      ON r.item_conhecido_id = i.id
     AND r.ativo = 1
    WHERE i.ativo = 1
    GROUP BY i.id
    ORDER BY i.numero_convenio, i.descricao_normalizada
  `).all();

  const porDescricaoOriginal = new Map();
  const porChaveNormalizada = new Map();
  const todos = [];

  for (const linha of linhas) {
    const valorUnitario = Number(linha.valor_unitario_referencia);
    const item = {
      id: linha.id,
      chaveItem: linha.chave_item,
      chaveDescricaoOriginal: criarChaveDescricaoOriginal(linha.numero_convenio, linha.descricao_original_referencia),
      numeroConvenio: linha.numero_convenio,
      descricaoNormalizada: linha.descricao_normalizada,
      descricaoOriginalReferencia: linha.descricao_original_referencia,
      uf: linha.uf,
      ano: linha.ano,
      valorUnitarioReferencia: Number.isFinite(valorUnitario) ? valorUnitario : null,
      naturezasEncontradas: interpretarJsonArray(linha.naturezas_encontradas_json),
      aptoParaImportacaoFutura: linha.apto_para_importacao_futura === 1,
      possuiPendenciaImpedativa: linha.possui_pendencia_impeditiva === 1,
      statusItem: linha.status_item,
      ativo: linha.ativo === 1,
      totalRateiosAtivos: Number(linha.total_rateios_ativos) || 0,
    };

    todos.push(item);
    if (item.chaveDescricaoOriginal) porDescricaoOriginal.set(item.chaveDescricaoOriginal, item);
    porChaveNormalizada.set(item.chaveItem, item);
  }

  return { porDescricaoOriginal, porChaveNormalizada, todos };
}

function montarItemPadConferido(item, carteira, chaveItem, descricaoNormalizada, chaveDescricaoOriginal) {
  return {
    chaveItem,
    chaveDescricaoOriginal,
    numeroConvenio: normalizarNumeroConvenio(item.instrumento),
    descricaoNormalizada,
    descricaoOriginal: item.descricao,
    uf: carteira?.uf || null,
    ano: carteira?.ano || null,
    instrumento: carteira?.instrumento || null,
    arquivo: item.arquivo,
    aba: item.aba,
    linha: item.linha,
    natureza: item.natureza,
    codigoNaturezaDespesa: item.codigoNaturezaDespesa,
    unidade: item.unidade,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotalPrevisto: item.valorTotalPrevisto,
    valorTotalExecutado: item.valorTotalExecutado,
    saldo: item.saldo,
  };
}

// Tolerância para considerar dois valores unitários coincidentes (centavos).
const TOLERANCIA_VALOR_UNITARIO = 0.01;

/**
 * Compara o valor unitário do item PAD com o valor unitário de referência da
 * memória. É apenas um indício para decisão humana — NÃO autoriza equivalência
 * automática.
 */
function compararValorUnitario(valorUnitarioPad, valorUnitarioMemoria) {
  const pad = Number(valorUnitarioPad);
  const memoria = Number(valorUnitarioMemoria);
  const padValido = Number.isFinite(pad);
  const memoriaValida = Number.isFinite(memoria);
  if (!padValido || !memoriaValida) {
    return {
      valorUnitarioPad: padValido ? pad : null,
      valorUnitarioReferenciaMemoria: memoriaValida ? memoria : null,
      valorUnitarioCoincide: null,
      diferencaValorUnitario: null,
    };
  }
  const diferenca = Math.round((pad - memoria + Number.EPSILON) * 100) / 100;
  return {
    valorUnitarioPad: pad,
    valorUnitarioReferenciaMemoria: memoria,
    valorUnitarioCoincide: Math.abs(diferenca) <= TOLERANCIA_VALOR_UNITARIO,
    diferencaValorUnitario: diferenca,
  };
}

function registrarInstrumentoNaoEncontrado(registro, instrumentosNaoEncontrados, alertas, chavesInstrumentosSemCarteira) {
  const instrumento = registro.numeroConvenio || registro.instrumento || null;
  if (!instrumento || chavesInstrumentosSemCarteira.has(instrumento)) return;

  chavesInstrumentosSemCarteira.add(instrumento);
  const item = {
    numeroConvenio: instrumento,
    arquivo: registro.arquivo,
    aba: registro.aba,
    detalhe: "Instrumento do PAD não foi encontrado na carteira monitorada ativa.",
  };
  instrumentosNaoEncontrados.push(item);
  alertas.push(criarAlerta({
    tipo: "instrumento_nao_encontrado_na_carteira",
    nivel: "impeditivo",
    instrumento,
    detalhe: item.detalhe,
    origem: { arquivo: registro.arquivo, aba: registro.aba, linha: registro.linha || null },
  }));
}

function conferirItensPadComRateiosProfor2022(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const leituraPad = lerRelatoriosPadProfor2022({ repoRoot, pastaRelativa: opcoes.pastaRelativa });
  const carteiraPorNumero = carregarCarteiraMonitorada();
  const itensConhecidos = carregarItensConhecidos();

  const itensPadReconhecidos = [];
  const itensPadSemRateio = [];
  const itensConhecidosNaoAptos = [];
  const instrumentosNaoEncontradosNaCarteira = [];
  const alertas = [...leituraPad.alertas];
  const idsItensConhecidosPad = new Set();
  const chavesNaoAptas = new Set();
  const instrumentosSemCarteira = new Set();

  for (const item of leituraPad.itens) {
    const numeroConvenio = normalizarNumeroConvenio(item.instrumento);
    const descricaoNormalizada = normalizarDescricaoRateioProfor(item.descricao);
    const chaveItem = numeroConvenio && descricaoNormalizada
      ? criarChaveItemRateioProfor(numeroConvenio, descricaoNormalizada)
      : null;
    const chaveDescricaoOriginal = criarChaveDescricaoOriginal(numeroConvenio, item.descricao);
    const carteira = numeroConvenio ? carteiraPorNumero.get(numeroConvenio) : null;
    const itemPad = montarItemPadConferido(item, carteira, chaveItem, descricaoNormalizada, chaveDescricaoOriginal);

    if (!carteira) {
      registrarInstrumentoNaoEncontrado(itemPad, instrumentosNaoEncontradosNaCarteira, alertas, instrumentosSemCarteira);
    }

    const itemConhecido = chaveDescricaoOriginal
      ? itensConhecidos.porDescricaoOriginal.get(chaveDescricaoOriginal)
      : null;
    const itemComMesmaChaveNormalizada = chaveItem
      ? itensConhecidos.porChaveNormalizada.get(chaveItem)
      : null;
    if (!itemConhecido) {
      const registroSemRateio = {
        ...itemPad,
        motivo: itemComMesmaChaveNormalizada
          ? "descricao_original_divergente_da_memoria_rateio"
          : "item_pad_nao_existe_na_memoria_rateio",
        itemConhecidoNormalizadoId: itemComMesmaChaveNormalizada?.id || null,
        descricaoOriginalReferencia: itemComMesmaChaveNormalizada?.descricaoOriginalReferencia || null,
      };

      // Para coincidências apenas por descrição normalizada, anexa o indício de
      // valor unitário e natureza. É evidência para decisão humana, não autoriza
      // equivalência automática.
      let indicioValorUnitario = null;
      if (itemComMesmaChaveNormalizada) {
        indicioValorUnitario = compararValorUnitario(
          itemPad.valorUnitario,
          itemComMesmaChaveNormalizada.valorUnitarioReferencia
        );
        registroSemRateio.indicioEquivalencia = {
          ...indicioValorUnitario,
          naturezaPad: itemPad.natureza || null,
          naturezasEncontradasMemoria: itemComMesmaChaveNormalizada.naturezasEncontradas || [],
        };
      }
      itensPadSemRateio.push(registroSemRateio);

      const alerta = criarAlerta({
        tipo: itemComMesmaChaveNormalizada
          ? "item_pad_coincide_apenas_por_descricao_normalizada"
          : "item_pad_sem_rateio",
        nivel: "aviso",
        chaveItem,
        instrumento: numeroConvenio,
        uf: carteira?.uf || null,
        ano: carteira?.ano || null,
        descricao: item.descricao,
        detalhe: itemComMesmaChaveNormalizada
          ? "Item PAD coincide pela descrição normalizada, mas a descrição original diverge da referência persistida; não foi considerado rateado."
          : "Item PAD não existe em profor_2022_itens_conhecidos.",
        origem: { arquivo: item.arquivo, aba: item.aba, linha: item.linha },
      });
      if (itemComMesmaChaveNormalizada) {
        alerta.valorUnitarioPad = indicioValorUnitario.valorUnitarioPad;
        alerta.valorUnitarioReferenciaMemoria = indicioValorUnitario.valorUnitarioReferenciaMemoria;
        alerta.valorUnitarioCoincide = indicioValorUnitario.valorUnitarioCoincide;
        alerta.diferencaValorUnitario = indicioValorUnitario.diferencaValorUnitario;
        alerta.naturezaPad = itemPad.natureza || null;
        alerta.naturezasEncontradasMemoria = itemComMesmaChaveNormalizada.naturezasEncontradas || [];
      }
      alertas.push(alerta);
      continue;
    }

    idsItensConhecidosPad.add(itemConhecido.id);

    if (!itemConhecido.aptoParaImportacaoFutura) {
      if (!chavesNaoAptas.has(chaveItem)) {
        chavesNaoAptas.add(chaveItem);
        itensConhecidosNaoAptos.push({
          ...itemPad,
          itemConhecidoId: itemConhecido.id,
          possuiPendenciaImpedativa: itemConhecido.possuiPendenciaImpedativa,
          totalRateiosAtivos: itemConhecido.totalRateiosAtivos,
        });
      }
      alertas.push(criarAlerta({
        tipo: "item_conhecido_nao_apto",
        nivel: "impeditivo",
        chaveItem,
        instrumento: numeroConvenio,
        uf: carteira?.uf || null,
        ano: carteira?.ano || null,
        descricao: item.descricao,
        detalhe: "Item existe na memória, mas está marcado como não apto para importação futura.",
        origem: { arquivo: item.arquivo, aba: item.aba, linha: item.linha },
      }));
    }

    if (itemConhecido.totalRateiosAtivos > 0) {
      itensPadReconhecidos.push({
        ...itemPad,
        itemConhecidoId: itemConhecido.id,
        aptoParaImportacaoFutura: itemConhecido.aptoParaImportacaoFutura,
        totalRateiosAtivos: itemConhecido.totalRateiosAtivos,
      });
    } else {
      itensPadSemRateio.push({
        ...itemPad,
        itemConhecidoId: itemConhecido.id,
        motivo: "item_conhecido_sem_rateio_ativo",
      });
      alertas.push(criarAlerta({
        tipo: "item_conhecido_sem_rateio_ativo",
        nivel: "aviso",
        chaveItem,
        instrumento: numeroConvenio,
        uf: carteira?.uf || null,
        ano: carteira?.ano || null,
        descricao: item.descricao,
        detalhe: "Item existe na memória, mas não possui rateio ativo.",
        origem: { arquivo: item.arquivo, aba: item.aba, linha: item.linha },
      }));
    }
  }

  const itensConhecidosAusentesNoPad = [];
  for (const itemConhecido of itensConhecidos.todos) {
    if (idsItensConhecidosPad.has(itemConhecido.id)) continue;

    itensConhecidosAusentesNoPad.push(itemConhecido);
    alertas.push(criarAlerta({
      tipo: "item_conhecido_ausente_no_pad",
      nivel: "aviso",
      chaveItem: itemConhecido.chaveItem,
      instrumento: itemConhecido.numeroConvenio,
      uf: itemConhecido.uf,
      ano: itemConhecido.ano,
      descricao: itemConhecido.descricaoOriginalReferencia,
      detalhe: "Item conhecido ativo não apareceu nos relatórios PAD atuais; possível exclusão ou substituição exige validação humana.",
    }));
  }

  const resumo = {
    totalRelatoriosPad: leituraPad.resumo.totalRelatoriosLidos,
    totalItensPadConferidos: leituraPad.itens.length,
    totalItensPadComRateio: itensPadReconhecidos.length,
    totalItensPadSemRateio: itensPadSemRateio.length,
    totalItensConhecidosAusentesNoPad: itensConhecidosAusentesNoPad.length,
    totalItensConhecidosNaoAptos: itensConhecidosNaoAptos.length,
    totalInstrumentosNaoEncontradosNaCarteira: instrumentosNaoEncontradosNaCarteira.length,
    totalAlertas: alertas.length,
    totalAlertasImpeditivos: alertas.filter((alerta) => alerta.nivel === "impeditivo").length,
  };

  return {
    itensPadReconhecidos,
    itensPadSemRateio,
    itensConhecidosAusentesNoPad,
    itensConhecidosNaoAptos,
    instrumentosNaoEncontradosNaCarteira,
    alertas,
    resumo,
  };
}

function salvarConferenciaPadRateios(resultado, caminhoSaida) {
  fs.mkdirSync(path.dirname(caminhoSaida), { recursive: true });
  fs.writeFileSync(caminhoSaida, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
}

module.exports = {
  conferirItensPadComRateiosProfor2022,
  salvarConferenciaPadRateios,
};
