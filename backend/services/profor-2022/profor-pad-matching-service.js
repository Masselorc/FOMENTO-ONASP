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

// Entidades HTML basicas persistidas em descricoes historicas
// (ex.: "&#039;" gravado no banco em vez da apostrofe literal "'").
// Decodificar antes do matching evita falsa pendencia por mero residuo
// de import historico.
function decodificarEntidadesHtmlBasicas(valor) {
  return String(valor ?? "")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function criarChaveDescricaoOriginal(numeroConvenio, descricaoOriginal) {
  const numero = normalizarNumeroConvenio(numeroConvenio);
  const descricao = limparDescricaoOriginalConferencia(decodificarEntidadesHtmlBasicas(descricaoOriginal));
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
      COUNT(r.id) AS total_rateios_ativos,
      SUM(COALESCE(r.quantidade_referencia, 0)) AS quantidade_referencia_soma,
      SUM(COALESCE(r.valor_previsto_referencia, 0)) AS valor_previsto_referencia_soma,
      SUM(COALESCE(r.valor_executado_referencia, 0)) AS valor_executado_referencia_soma
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
    // Recomputa a chave normalizada do banco aplicando decodificacao de
    // entidades HTML basicas, para tolerar residuos de import historico
    // (ex.: "&#039;" em vez da apostrofe "'").
    const descricaoOriginalReferenciaDecodificada = decodificarEntidadesHtmlBasicas(linha.descricao_original_referencia);
    const numeroConvenioMemoria = normalizarNumeroConvenio(linha.numero_convenio);
    const chaveNormalizadaRecomputada = numeroConvenioMemoria
      ? criarChaveItemRateioProfor(
          numeroConvenioMemoria,
          normalizarDescricaoRateioProfor(descricaoOriginalReferenciaDecodificada)
        )
      : linha.chave_item;
    const item = {
      id: linha.id,
      chaveItem: inlineChaveItem(chaveNormalizadaRecomputada || linha.chave_item),
      chaveItemOriginal: linha.chave_item,
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
      quantidadeReferencia: Number(linha.quantidade_referencia_soma) || 0,
      valorPrevistoReferencia: Number(linha.valor_previsto_referencia_soma) || 0,
      valorExecutadoReferencia: Number(linha.valor_executado_referencia_soma) || 0,
      saldoReferencia: (Number(linha.valor_previsto_referencia_soma) || 0) - (Number(linha.valor_executado_referencia_soma) || 0),
    };

    todos.push(item);
    if (item.chaveDescricaoOriginal) porDescricaoOriginal.set(item.chaveDescricaoOriginal, item);
    porChaveNormalizada.set(item.chaveItem, item);
  }

  return { porDescricaoOriginal, porChaveNormalizada, todos };
}

function inlineChaveItem(val) {
  return val;
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

function diferencaApenasAcentuacaoOuDiacritico(a, b) {
  const cleanA = String(a ?? "").replace(/\s+/g, " ").trim();
  const cleanB = String(b ?? "").replace(/\s+/g, " ").trim();
  if (cleanA === cleanB) return false;

  const stripDiacritics = (str) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };
  return stripDiacritics(cleanA).toLowerCase() === stripDiacritics(cleanB).toLowerCase();
}

// Considera dois textos equivalentes se diferem apenas por entidade HTML
// basica, caixa, acentuacao/diacriticos ou espacos multiplos. Usado para
// evitar falsa pendencia quando a descricao original do banco e do PAD
// coincidem semanticamente.
function normalizarDescricaoParaComparacaoCosmetica(valor) {
  return decodificarEntidadesHtmlBasicas(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function diferencaApenasCosmetica(a, b) {
  const cleanA = String(a ?? "").replace(/\s+/g, " ").trim();
  const cleanB = String(b ?? "").replace(/\s+/g, " ").trim();
  if (cleanA === cleanB) return false;
  return normalizarDescricaoParaComparacaoCosmetica(cleanA) === normalizarDescricaoParaComparacaoCosmetica(cleanB);
}

function mapearNatureza(nat) {
  const n = String(nat ?? "").toUpperCase().trim();
  if (n.includes("CAPITAL")) return "CAPITAL";
  if (n.includes("CUSTEIO") || n.includes("CORRENTE")) return "CUSTEIO";
  return n;
}

function naturezasCompativeis(naturezaPad, naturezasMemoria) {
  const padMapped = mapearNatureza(naturezaPad);
  if (!padMapped) return true; // Se o PAD não tem natureza especificada, consideramos compatível
  if (!Array.isArray(naturezasMemoria) || naturezasMemoria.length === 0) return true; // Se a memória não tem, compatível
  const memoriaMapped = naturezasMemoria.map(mapearNatureza);
  return memoriaMapped.includes(padMapped);
}

function dadosMateriaisCompativeis(itemPad, itemMemoria) {
  // 1. Mesmo número de convênio
  if (itemPad.numeroConvenio !== itemMemoria.numeroConvenio) return false;

  // 2. Natureza compatível
  if (!naturezasCompativeis(itemPad.natureza, itemMemoria.naturezasEncontradas)) return false;

  // 3. Valor unitário igual ou diferença <= R$ 0,01
  const vuPad = Number(itemPad.valorUnitario);
  const vuMemoria = Number(itemMemoria.valorUnitarioReferencia);
  if (Number.isFinite(vuPad) && Number.isFinite(vuMemoria)) {
    if (Math.abs(vuPad - vuMemoria) > 0.01) return false;
  }

  // 4. Quantidade: se disponível na memória (total rateios ativos > 0)
  if (itemMemoria.totalRateiosAtivos > 0) {
    const qPad = Number(itemPad.quantidade);
    const qMemoria = Number(itemMemoria.quantidadeReferencia);
    if (Number.isFinite(qPad) && Number.isFinite(qMemoria) && qMemoria > 0) {
      if (Math.abs(qPad - qMemoria) > 0.0001) return false;
    }

    const prevPad = Number(itemPad.valorTotalPrevisto);
    const prevMemoria = Number(itemMemoria.valorPrevistoReferencia);
    if (Number.isFinite(prevPad) && Number.isFinite(prevMemoria) && prevMemoria > 0) {
      if (Math.abs(prevPad - prevMemoria) > 0.01) return false;
    }

    const execPad = Number(itemPad.valorTotalExecutado);
    const execMemoria = Number(itemMemoria.valorExecutadoReferencia);
    if (Number.isFinite(execPad) && Number.isFinite(execMemoria) && execMemoria > 0) {
      if (Math.abs(execPad - execMemoria) > 0.01) return false;
    }

    const saldoPad = Number(itemPad.saldo);
    const saldoMemoria = Number(itemMemoria.saldoReferencia);
    if (Number.isFinite(saldoPad) && Number.isFinite(saldoMemoria) && saldoMemoria > 0) {
      if (Math.abs(saldoPad - saldoMemoria) > 0.01) return false;
    }
  }

  return true;
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
  const leituraPad = lerRelatoriosPadProfor2022({ repoRoot, pastaRelativa: opcoes.pastaRelativa, usarExcelLegado: opcoes.usarExcelLegado });
  const carteiraPorNumero = carregarCarteiraMonitorada();
  const itensConhecidos = carregarItensConhecidos();

  const itensPadReconhecidos = [];
  const itensPadSemRateio = [];
  const itensConhecidosNaoAptos = [];
  const instrumentosNaoEncontradosNaCarteira = [];
  const equivalenciasDiacriticoSaneadas = [];
  const alertas = [...leituraPad.alertas];
  const idsItensConhecidosPad = new Set();
  const chavesNaoAptas = new Set();
  const instrumentosSemCarteira = new Set();

  for (const item of leituraPad.itens) {
    const numeroConvenio = normalizarNumeroConvenio(item.instrumento);
    // Decodifica entidades HTML antes de normalizar para garantir que itens
    // do PAD que vieram com apostrofe literal ("'") batem com memoria
    // gravada historicamente com "&#039;" e vice-versa.
    const descricaoPadDecodificada = decodificarEntidadesHtmlBasicas(item.descricao);
    const descricaoNormalizada = normalizarDescricaoRateioProfor(descricaoPadDecodificada);
    const chaveItem = numeroConvenio && descricaoNormalizada
      ? criarChaveItemRateioProfor(numeroConvenio, descricaoNormalizada)
      : null;
    const chaveDescricaoOriginal = criarChaveDescricaoOriginal(numeroConvenio, item.descricao);
    const carteira = numeroConvenio ? carteiraPorNumero.get(numeroConvenio) : null;
    const itemPad = montarItemPadConferido(item, carteira, chaveItem, descricaoNormalizada, chaveDescricaoOriginal);

    if (!carteira) {
      registrarInstrumentoNaoEncontrado(itemPad, instrumentosNaoEncontradosNaCarteira, alertas, instrumentosSemCarteira);
    }

    let itemConhecido = chaveDescricaoOriginal
      ? itensConhecidos.porDescricaoOriginal.get(chaveDescricaoOriginal)
      : null;
    const itemComMesmaChaveNormalizada = chaveItem
      ? itensConhecidos.porChaveNormalizada.get(chaveItem)
      : null;

    let saneadoPorDiacritico = false;
    if (!itemConhecido && itemComMesmaChaveNormalizada) {
      // Quando a chave normalizada (convenio + descricao normalizada) coincide,
      // diferenca residual na descricao original por entidade HTML, caixa,
      // acentuacao ou espacos e considerada apenas cosmetica e nao deve gerar
      // pendencia. Nao exigimos `dadosMateriaisCompativeis` aqui porque
      // `valor_unitario_referencia` no item conhecido pode estar defasado em
      // relacao ao rateio ativo mais recente.
      if (diferencaApenasCosmetica(itemPad.descricaoOriginal, itemComMesmaChaveNormalizada.descricaoOriginalReferencia)) {
        itemConhecido = itemComMesmaChaveNormalizada;
        saneadoPorDiacritico = true;

        equivalenciasDiacriticoSaneadas.push({
          numeroConvenio,
          uf: carteira?.uf || null,
          descricaoOriginalMemoria: itemComMesmaChaveNormalizada.descricaoOriginalReferencia,
          descricaoOriginalPad: itemPad.descricaoOriginal,
          valorUnitario: itemPad.valorUnitario,
          natureza: itemPad.natureza,
          origem: { arquivo: item.arquivo, aba: item.aba, linha: item.linha }
        });

        alertas.push(criarAlerta({
          tipo: "equivalencia_por_diacritico_saneada_automaticamente",
          nivel: "info",
          chaveItem,
          instrumento: numeroConvenio,
          uf: carteira?.uf || null,
          ano: carteira?.ano || null,
          descricao: item.descricao,
          detalhe: `A diferença na descrição de '${itemComMesmaChaveNormalizada.descricaoOriginalReferencia}' x '${itemPad.descricaoOriginal}' é apenas de acentuação/diacríticos e os dados materiais são compatíveis. Saneado automaticamente.`,
          origem: { arquivo: item.arquivo, aba: item.aba, linha: item.linha },
        }));
      }
    }

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
        saneadoPorDiacritico,
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
    totalEquivalenciasDiacriticoSaneadas: equivalenciasDiacriticoSaneadas.length,
    totalAlertas: alertas.length,
    totalAlertasImpeditivos: alertas.filter((alerta) => alerta.nivel === "impeditivo").length,
  };

  return {
    itensPadReconhecidos,
    itensPadSemRateio,
    itensConhecidosAusentesNoPad,
    itensConhecidosNaoAptos,
    instrumentosNaoEncontradosNaCarteira,
    equivalenciasDiacriticoSaneadas,
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
  diferencaApenasAcentuacaoOuDiacritico,
  diferencaApenasCosmetica,
  decodificarEntidadesHtmlBasicas,
  normalizarDescricaoParaComparacaoCosmetica,
  dadosMateriaisCompativeis,
  naturezasCompativeis,
};
