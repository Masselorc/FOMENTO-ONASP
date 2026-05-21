const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const repoRevisao = require("./profor-pad-revisao-repository");
const {
  conferirItensPadComRateiosProfor2022,
} = require("./profor-pad-matching-service");
const {
  arredondarMoedaProfor,
  calcularEconomicidadeItem,
} = require("./profor-plano-aplicacao-service");
const { criarChaveDivergencia } = require("./profor-pad-revisao-service");
const {
  carregarAplicacaoDecisoesDryRun,
} = require("./profor-pad-decisao-aplicacao-service");
const {
  auditarSegurancaPreAtivacaoDryRun,
  resumoSegurancaParaRelatorio,
} = require("./profor-pad-seguranca-pre-ativacao-service");

// Caminho padrão do relatório dry-run de reconstrução.
const CAMINHO_RELATORIO_RECONSTRUCAO =
  "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json";

// Alertas impeditivos do leitor PAD tratados como erro crítico de leitura.
const TIPOS_ERRO_CRITICO_LEITURA = new Set([
  "codigo_instrumento_nao_encontrado",
  "cabecalho_tabela_nao_encontrado",
  "nenhum_item_encontrado",
  "valor_previsto_invalido",
  "valor_executado_invalido",
  "arquivo_duplicado_para_mesmo_instrumento",
  "natureza_nao_classificada",
  "total_geral_divergente",
]);

function agoraIso() {
  return new Date().toISOString();
}

/** Arredonda quantidade com precisão de 6 casas (a quantidade pode ser fracionária). */
function arredondarQuantidadeProfor(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round((numero + Number.EPSILON) * 1e6) / 1e6;
}

/** Deriva o valor unitário da linha reconstruída sem recalcular o total previsto. */
function derivarValorUnitario(valorPrevisto, quantidade) {
  if (!(quantidade > 0)) return null;
  return Math.round((valorPrevisto / quantidade + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * Define os pesos de rateio de um item. Preferência: percentual salvo;
 * fallback controlado: valores de referência; último recurso: distribuição
 * igual (registra impedimento, pois não há rateio aplicável confiável).
 */
function obterPesosRateio(rateios, campoPercentual, campoReferencia) {
  const percentuais = rateios.map((rateio) => Number(rateio[campoPercentual]) || 0);
  const somaPercentual = percentuais.reduce((total, valor) => total + valor, 0);
  if (somaPercentual > 0) {
    return { pesos: percentuais.map((valor) => valor / somaPercentual), base: "percentual" };
  }

  const referencias = rateios.map((rateio) => Number(rateio[campoReferencia]) || 0);
  const somaReferencia = referencias.reduce((total, valor) => total + valor, 0);
  if (somaReferencia > 0) {
    return { pesos: referencias.map((valor) => valor / somaReferencia), base: "valor_referencia" };
  }

  const quantidade = rateios.length || 1;
  return { pesos: rateios.map(() => 1 / quantidade), base: "distribuicao_igual" };
}

/**
 * Distribui um total agregado do PAD pelos pesos do rateio, em centavos
 * controlados. A diferença residual é lançada na última linha ativa.
 */
function distribuirTotal(total, pesos, arredondarFn) {
  const totalNumero = Number(total) || 0;
  if (!pesos.length) return { valores: [], residuo: 0 };

  const valores = pesos.map((peso) => arredondarFn(totalNumero * peso));
  const soma = valores.reduce((acumulado, valor) => acumulado + valor, 0);
  const residuo = arredondarFn(totalNumero - soma);
  if (residuo !== 0) {
    const ultimo = valores.length - 1;
    valores[ultimo] = arredondarFn(valores[ultimo] + residuo);
  }
  return { valores, residuo };
}

/** Carrega os rateios ativos persistidos, agrupados por item conhecido. */
function carregarMemoriaRateios() {
  const linhas = db.prepare(`
    SELECT item_conhecido_id, area, natureza, quantidade_referencia,
           valor_previsto_referencia, valor_executado_referencia,
           percentual_quantidade, percentual_valor
    FROM profor_2022_item_rateios
    WHERE ativo = 1
    ORDER BY item_conhecido_id, area, natureza
  `).all();

  const porItem = new Map();
  for (const linha of linhas) {
    if (!porItem.has(linha.item_conhecido_id)) porItem.set(linha.item_conhecido_id, []);
    porItem.get(linha.item_conhecido_id).push(linha);
  }
  return porItem;
}

function montarImpedimento({ tipo, nivel = "impeditivo", numeroConvenio = null, uf = null, descricao = null, chaveItem = null, detalhe }) {
  return { tipo, nivel, numeroConvenio, uf, descricao, chaveItem, detalhe };
}

function montarAlerta({ tipo, nivel = "aviso", numeroConvenio = null, uf = null, descricao = null, chaveItem = null, detalhe }) {
  return { tipo, nivel, numeroConvenio, uf, descricao, chaveItem, detalhe };
}

/** Resumo serializável da decisão aplicada a uma linha reconstruída. */
function resumoDecisao(registro) {
  if (!registro) return null;
  return {
    divergenciaId: registro.divergenciaId,
    chaveDivergencia: registro.chaveDivergencia,
    decisao: registro.decisao,
    efeito: registro.efeito ? registro.efeito.tipo : null,
  };
}

/**
 * Gera as linhas reconstruídas de um item PAD a partir de um conjunto de
 * rateios, aplicando os totais financeiros do PAD como fonte de verdade.
 */
function gerarLinhasItem(itemPad, rateios, contexto = {}) {
  const alertasItem = [];
  const impedimentosItem = [];
  const linhas = [];

  const pesosValor = obterPesosRateio(rateios, "percentual_valor", "valor_previsto_referencia");
  const pesosQuantidade = obterPesosRateio(rateios, "percentual_quantidade", "quantidade_referencia");
  const previstos = distribuirTotal(itemPad.valorTotalPrevisto, pesosValor.pesos, arredondarMoedaProfor);
  const executados = distribuirTotal(itemPad.valorTotalExecutado, pesosValor.pesos, arredondarMoedaProfor);
  const quantidades = distribuirTotal(itemPad.quantidade, pesosQuantidade.pesos, arredondarQuantidadeProfor);
  const houveAjusteResidual = previstos.residuo !== 0
    || executados.residuo !== 0
    || quantidades.residuo !== 0;

  rateios.forEach((rateio, indice) => {
    const valorPrevisto = previstos.valores[indice];
    const valorExecutado = executados.valores[indice];
    const quantidade = quantidades.valores[indice];
    const saldo = arredondarMoedaProfor(valorPrevisto - valorExecutado);
    const valorUnitarioDerivado = derivarValorUnitario(valorPrevisto, quantidade);
    const percentualExecucao = valorPrevisto > 0
      ? Math.round((valorExecutado / valorPrevisto) * 10000) / 100
      : 0;

    const linha = {
      uf: itemPad.uf || null,
      instrumento: itemPad.instrumento || null,
      numero: itemPad.numeroConvenio || null,
      ano: itemPad.ano || null,
      area: rateio.area,
      natureza: rateio.natureza,
      descricao: itemPad.descricaoOriginal,
      quantidade,
      // Valor Unit do PAD permanece referência auxiliar quando a quantidade
      // rateada é zero; nunca é usado para recalcular o total previsto.
      valorUnitario: valorUnitarioDerivado !== null
        ? valorUnitarioDerivado
        : (Number(itemPad.valorUnitario) || 0),
      valorPrevisto,
      valorExecutado,
      saldo,
      saldoEconomicidade: 0,
      percentualExecucao,
    };
    linha.saldoEconomicidade = calcularEconomicidadeItem(linha, []);

    // Metadados de rastreabilidade da reconstrução (não fazem parte do formato
    // financeiro consumido pelos cálculos do planoAplicacao).
    linha.origemReconstrucao = contexto.fonteRateio || "relatorios-pad-rateados";
    linha.chaveItem = itemPad.chaveItem;
    linha.itemConhecidoId = contexto.itemConhecidoId ?? null;
    linha.codigoNaturezaDespesa = itemPad.codigoNaturezaDespesa || null;
    linha.unidade = itemPad.unidade || null;
    linha.valorUnitarioPadReferencia = Number(itemPad.valorUnitario) || 0;
    linha.valorUnitarioDerivado = valorUnitarioDerivado;
    linha.baseRateioValor = pesosValor.base;
    linha.baseRateioQuantidade = pesosQuantidade.base;
    linha.ajusteResidualAplicado = houveAjusteResidual && indice === rateios.length - 1;
    linha.itemAptoParaUso = contexto.itemAptoParaUso !== false;
    linha.liberadoPorDecisao = Boolean(contexto.liberadoPorDecisao);
    linha.decisaoAplicada = resumoDecisao(contexto.decisaoAplicada);
    linhas.push(linha);
  });

  if (houveAjusteResidual) {
    alertasItem.push(montarAlerta({
      tipo: "ajuste_residual_arredondamento",
      nivel: "info",
      numeroConvenio: itemPad.numeroConvenio,
      uf: itemPad.uf,
      descricao: itemPad.descricaoOriginal,
      chaveItem: itemPad.chaveItem,
      detalhe: `Diferença residual de arredondamento lançada na última linha ativa do rateio `
        + `(previsto ${previstos.residuo}, executado ${executados.residuo}, quantidade ${quantidades.residuo}).`,
    }));
  }
  if (pesosValor.base === "valor_referencia") {
    alertasItem.push(montarAlerta({
      tipo: "rateio_valor_sem_percentual",
      numeroConvenio: itemPad.numeroConvenio,
      uf: itemPad.uf,
      descricao: itemPad.descricaoOriginal,
      chaveItem: itemPad.chaveItem,
      detalhe: "Rateio sem percentual de valor salvo; usados os valores previstos de referência como peso.",
    }));
  }
  if (pesosValor.base === "distribuicao_igual" || pesosQuantidade.base === "distribuicao_igual") {
    impedimentosItem.push(montarImpedimento({
      tipo: "rateio_percentual_indefinido",
      numeroConvenio: itemPad.numeroConvenio,
      uf: itemPad.uf,
      descricao: itemPad.descricaoOriginal,
      chaveItem: itemPad.chaveItem,
      detalhe: "Rateio sem percentual nem valores de referência; reconstrução usou distribuição igual provisória.",
    }));
  }

  return { linhas, alertasItem, impedimentosItem };
}

/**
 * Reconstrói, em dry-run, o planoAplicacao do PROFOR 2022 a partir dos
 * relatórios PAD, dos itens conhecidos, dos rateios persistidos e das decisões
 * resolutivas registradas na revisão assistida.
 *
 * As decisões são aplicadas apenas na camada dry-run: não alteram a origem
 * ativa, não publicam e não modificam o banco. É executável mesmo com
 * divergências pendentes — registra impedimentos e mantém aptoParaAtivacao/
 * aptoParaPublicacao como false enquanto houver pendências.
 */
function reconstruirPlanoAplicacaoPadDryRun(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");

  const conferencia = conferirItensPadComRateiosProfor2022({
    repoRoot,
    pastaRelativa: opcoes.pastaRelativa,
  });
  const memoria = carregarMemoriaRateios();
  const auditoria = repoRevisao.obterEstatisticasAuditoria();
  const aplicacaoDecisoes = opcoes.aplicacaoDecisoes || carregarAplicacaoDecisoesDryRun();
  const regras = aplicacaoDecisoes.regras;

  const plano = [];
  const impedimentos = [];
  const alertas = [];
  const conveniosReconstruidos = new Set();
  const itensNaoAptosUsados = new Set();
  const chavesReconstruidas = new Map();
  const decisoesEfetivamenteAplicadas = new Set();

  function registrarReconstrucao(itemPad, resultadoLinhas) {
    plano.push(...resultadoLinhas.linhas);
    alertas.push(...resultadoLinhas.alertasItem);
    impedimentos.push(...resultadoLinhas.impedimentosItem);
    if (itemPad.numeroConvenio) conveniosReconstruidos.add(itemPad.numeroConvenio);
    if (itemPad.chaveItem) {
      chavesReconstruidas.set(itemPad.chaveItem, (chavesReconstruidas.get(itemPad.chaveItem) || 0) + 1);
    }
  }

  // 1. Itens PAD reconhecidos: já possuem rateio ativo na memória.
  for (const itemPad of conferencia.itensPadReconhecidos) {
    const rateios = memoria.get(itemPad.itemConhecidoId) || [];
    if (!rateios.length) {
      impedimentos.push(montarImpedimento({
        tipo: "item_pad_sem_rateio_aplicavel",
        numeroConvenio: itemPad.numeroConvenio,
        uf: itemPad.uf,
        descricao: itemPad.descricaoOriginal,
        chaveItem: itemPad.chaveItem,
        detalhe: "Item PAD reconhecido na memória, mas sem rateio ativo aplicável.",
      }));
      continue;
    }

    const itemApto = itemPad.aptoParaImportacaoFutura !== false;
    const liberacao = !itemApto ? regras.naoAptoLiberado.get(itemPad.chaveItem) : null;
    const liberadoPorDecisao = Boolean(liberacao);

    const resultado = gerarLinhasItem(itemPad, rateios, {
      fonteRateio: "relatorios-pad-rateados",
      itemConhecidoId: itemPad.itemConhecidoId,
      itemAptoParaUso: itemApto || liberadoPorDecisao,
      liberadoPorDecisao,
      decisaoAplicada: liberacao,
    });
    registrarReconstrucao(itemPad, resultado);

    if (!itemApto) {
      if (liberadoPorDecisao) {
        decisoesEfetivamenteAplicadas.add(liberacao.divergenciaId);
      } else if (!itensNaoAptosUsados.has(itemPad.chaveItem)) {
        itensNaoAptosUsados.add(itemPad.chaveItem);
        impedimentos.push(montarImpedimento({
          tipo: "item_conhecido_nao_apto_usado",
          numeroConvenio: itemPad.numeroConvenio,
          uf: itemPad.uf,
          descricao: itemPad.descricaoOriginal,
          chaveItem: itemPad.chaveItem,
          detalhe: "Item conhecido marcado como não apto foi usado na reconstrução; exige liberação na revisão.",
        }));
      }
    }
  }

  // 2. Itens PAD sem rateio: tenta aplicar equivalência ou rateio manual
  //    proveniente de decisão resolutiva antes de registrar impedimento.
  const itensPadSemRateioRemanescentes = [];
  for (const item of conferencia.itensPadSemRateio) {
    const equivalencia = regras.equivalenciasAceitas.get(item.chaveItem);
    const rateioManual = regras.rateiosManuais.get(item.chaveItem);
    const rateiosEquivalentes = equivalencia
      && item.itemConhecidoNormalizadoId
      && memoria.get(item.itemConhecidoNormalizadoId);

    if (equivalencia && rateiosEquivalentes && rateiosEquivalentes.length) {
      const resultado = gerarLinhasItem(item, rateiosEquivalentes, {
        fonteRateio: "equivalencia_por_decisao",
        itemConhecidoId: item.itemConhecidoNormalizadoId,
        decisaoAplicada: equivalencia,
      });
      registrarReconstrucao(item, resultado);
      decisoesEfetivamenteAplicadas.add(equivalencia.divergenciaId);
      continue;
    }

    if (rateioManual && rateioManual.efeito && Array.isArray(rateioManual.efeito.rateios)) {
      const resultado = gerarLinhasItem(item, rateioManual.efeito.rateios, {
        fonteRateio: "rateio_manual_por_decisao",
        itemConhecidoId: item.itemConhecidoId ?? null,
        decisaoAplicada: rateioManual,
      });
      registrarReconstrucao(item, resultado);
      decisoesEfetivamenteAplicadas.add(rateioManual.divergenciaId);
      continue;
    }

    itensPadSemRateioRemanescentes.push(item);
    impedimentos.push(montarImpedimento({
      tipo: "item_pad_sem_rateio",
      numeroConvenio: item.numeroConvenio,
      uf: item.uf,
      descricao: item.descricaoOriginal,
      chaveItem: item.chaveItem,
      detalhe: item.motivo
        ? `Item PAD sem rateio aplicável (${item.motivo}).`
        : "Item PAD sem rateio aplicável na memória.",
    }));
  }

  // 3. Duplicidade de itens PAD na reconstrução.
  for (const [chaveItem, ocorrencias] of chavesReconstruidas.entries()) {
    if (ocorrencias > 1) {
      alertas.push(montarAlerta({
        tipo: "item_pad_duplicado_na_reconstrucao",
        chaveItem,
        detalhe: `Item com a mesma chave apareceu ${ocorrencias} vezes nos relatórios PAD; verifique duplicidade na fonte.`,
      }));
    }
  }

  // 4. Convênios do PAD fora da carteira monitorada.
  for (const instrumento of conferencia.instrumentosNaoEncontradosNaCarteira) {
    impedimentos.push(montarImpedimento({
      tipo: "instrumento_fora_da_carteira",
      numeroConvenio: instrumento.numeroConvenio,
      detalhe: instrumento.detalhe || "Instrumento do PAD não encontrado na carteira monitorada ativa.",
    }));
  }

  // 5. Erros críticos de leitura dos relatórios PAD.
  const errosCriticosLeitura = (conferencia.alertas || []).filter(
    (alerta) => alerta.nivel === "impeditivo" && TIPOS_ERRO_CRITICO_LEITURA.has(alerta.tipo)
  );
  for (const erro of errosCriticosLeitura) {
    impedimentos.push(montarImpedimento({
      tipo: `erro_leitura_pad:${erro.tipo}`,
      numeroConvenio: erro.instrumento || null,
      detalhe: erro.detalhe || "Erro crítico de leitura do relatório PAD.",
    }));
  }

  // 6. Alertas de consistência da fonte: marca como saneado quando há decisão
  //    resolutiva ACEITO correspondente na revisão assistida.
  let totalConsistenciaSaneadaPorDecisao = 0;
  for (const alerta of conferencia.alertas || []) {
    if (alerta.tipo !== "quantidade_valor_unitario_inconsistente") continue;
    const origem = alerta.origem || {};
    const chaveDivergencia = criarChaveDivergencia({
      numeroConvenio: alerta.instrumento,
      tipoAlerta: "quantidade_valor_unitario_inconsistente",
      chaveItemOuDescricao: `${origem.aba || "sem-aba"}:linha-${origem.linha ?? "?"}`,
      campoAfetado: alerta.tipo,
    });
    const decisaoSaneamento = regras.consistenciaSaneadaPorDivergencia.get(chaveDivergencia);
    const saneado = Boolean(decisaoSaneamento);
    if (saneado) {
      totalConsistenciaSaneadaPorDecisao += 1;
      decisoesEfetivamenteAplicadas.add(decisaoSaneamento.divergenciaId);
    }
    alertas.push({
      ...montarAlerta({
        tipo: "quantidade_valor_unitario_inconsistente",
        nivel: saneado ? "info" : (alerta.nivel === "impeditivo" ? "impeditivo" : "aviso"),
        numeroConvenio: alerta.instrumento || null,
        detalhe: alerta.detalhe,
      }),
      saneadoPorDecisao: saneado,
      decisaoAplicada: saneado ? resumoDecisao(decisaoSaneamento) : null,
    });
  }

  // 7. Impedimentos por decisões resolutivas não aplicáveis.
  for (const decisao of aplicacaoDecisoes.decisoesNaoAplicaveis) {
    impedimentos.push(montarImpedimento({
      tipo: `decisao_nao_aplicavel:${decisao.efeito ? decisao.efeito.tipo : "desconhecido"}`,
      numeroConvenio: decisao.numeroConvenio,
      chaveItem: decisao.chaveItem,
      detalhe: decisao.motivoNaoAplicavel
        || "Decisão resolutiva registrada não pôde ser aplicada em dry-run.",
    }));
  }

  // 8. Divergências pendentes/em revisão que bloqueiam publicação.
  const divergenciasBloqueantes = Number(auditoria.totalPendentesQueBloqueiamPublicacao || 0)
    + Number(auditoria.totalEmRevisaoQueBloqueiamPublicacao || 0);
  if (divergenciasBloqueantes > 0) {
    impedimentos.push(montarImpedimento({
      tipo: "divergencias_revisao_bloqueiam_publicacao",
      detalhe: `Há ${divergenciasBloqueantes} divergência(s) com status PENDENTE/EM_REVISAO e `
        + `bloqueia_publicacao = 1 na fila de revisão assistida.`,
    }));
  }

  // Auditoria de segurança pré-ativação (Etapa 8.2). Não interrompe a geração
  // do relatório: em caso de falha, registra alerta e bloqueia a aptidão.
  let segurancaPreAtivacao = null;
  let segurancaSemBloqueio = false;
  try {
    const seguranca = opcoes.segurancaPreAtivacao
      || auditarSegurancaPreAtivacaoDryRun({ repoRoot });
    segurancaPreAtivacao = resumoSegurancaParaRelatorio(seguranca);
    segurancaSemBloqueio = seguranca.resumo.totalBloqueiosAtivacao === 0;
  } catch (erro) {
    segurancaPreAtivacao = { erro: erro?.message || String(erro) };
    segurancaSemBloqueio = false;
    alertas.push(montarAlerta({
      tipo: "seguranca_pre_ativacao_indisponivel",
      detalhe: `Não foi possível executar a auditoria de segurança pré-ativação: ${erro?.message || erro}.`,
    }));
  }

  const aptoParaAtivacao = auditoria.publicacaoLiberada === true
    && itensPadSemRateioRemanescentes.length === 0
    && itensNaoAptosUsados.size === 0
    && conferencia.instrumentosNaoEncontradosNaCarteira.length === 0
    && errosCriticosLeitura.length === 0
    && aplicacaoDecisoes.decisoesNaoAplicaveis.length === 0
    && segurancaSemBloqueio;

  const valorPrevistoTotal = arredondarMoedaProfor(
    plano.reduce((total, linha) => total + linha.valorPrevisto, 0)
  );
  const valorExecutadoTotal = arredondarMoedaProfor(
    plano.reduce((total, linha) => total + linha.valorExecutado, 0)
  );
  const saldoTotal = arredondarMoedaProfor(valorPrevistoTotal - valorExecutadoTotal);

  const resumo = {
    totalRelatoriosPad: conferencia.resumo.totalRelatoriosPad,
    totalItensPadProcessados: conferencia.resumo.totalItensPadConferidos,
    totalItensPadComRateioAplicado: conferencia.resumo.totalItensPadComRateio,
    totalItensPadSemRateio: conferencia.resumo.totalItensPadSemRateio,
    totalItensPadSemRateioRemanescentes: itensPadSemRateioRemanescentes.length,
    totalItensPadSemRateioReconstruidoPorDecisao:
      conferencia.itensPadSemRateio.length - itensPadSemRateioRemanescentes.length,
    totalLinhasReconstruidas: plano.length,
    totalConveniosReconstruidos: conveniosReconstruidos.size,
    totalItensConhecidosNaoAptosUsados: itensNaoAptosUsados.size,
    totalInstrumentosForaCarteira: conferencia.instrumentosNaoEncontradosNaCarteira.length,
    totalErrosCriticosLeitura: errosCriticosLeitura.length,
    totalImpedimentos: impedimentos.length,
    totalAlertas: alertas.length,
    totalDecisoesResolutivasEncontradas: aplicacaoDecisoes.totalDecisoesResolutivasEncontradas,
    totalDecisoesInterpretadasDryRun: aplicacaoDecisoes.totalDecisoesInterpretadasDryRun,
    totalDecisoesAplicadasDryRun: aplicacaoDecisoes.totalDecisoesAplicadasDryRun,
    totalDecisoesNaoAplicaveis: aplicacaoDecisoes.totalDecisoesNaoAplicaveis,
    totalDecisoesComEfeitoNaReconstrucao: aplicacaoDecisoes.totalDecisoesComEfeitoNaReconstrucao,
    totalDecisoesSemEfeitoNaReconstrucao: aplicacaoDecisoes.totalDecisoesSemEfeitoNaReconstrucao,
    totalDecisoesEfetivamenteAplicadasNaReconstrucao: decisoesEfetivamenteAplicadas.size,
    totalConsistenciaSaneadaPorDecisao,
    totalBloqueiosSegurancaPreAtivacao: segurancaPreAtivacao && segurancaPreAtivacao.resumo
      ? segurancaPreAtivacao.resumo.totalBloqueiosAtivacao
      : null,
    valorPrevistoReconstruidoTotal: valorPrevistoTotal,
    valorExecutadoReconstruidoTotal: valorExecutadoTotal,
    saldoReconstruidoTotal: saldoTotal,
  };

  const auditoriaRevisao = {
    totalDivergencias: auditoria.totalDivergencias,
    totalPendentes: auditoria.totalPendentes,
    totalEmRevisao: auditoria.totalEmRevisao,
    totalImpeditivas: auditoria.totalImpeditivas,
    totalBloqueiamPublicacao: auditoria.totalBloqueiamPublicacao,
    totalPendentesQueBloqueiamPublicacao: auditoria.totalPendentesQueBloqueiamPublicacao,
    totalEmRevisaoQueBloqueiamPublicacao: auditoria.totalEmRevisaoQueBloqueiamPublicacao,
    totalComDecisaoResolutiva: auditoria.totalComDecisaoResolutiva,
    totalComComentario: auditoria.totalComComentario,
    totalSemDecisaoResolutiva: auditoria.totalSemDecisaoResolutiva,
    publicacaoLiberada: auditoria.publicacaoLiberada,
  };

  return {
    geradoEm: agoraIso(),
    modo: "dry-run",
    origem: "relatorios-pad-rateados",
    planoAplicacaoReconstruido: plano,
    resumo,
    impedimentos,
    alertas,
    decisoesResolutivasEncontradas: aplicacaoDecisoes.decisoesResolutivasEncontradas,
    decisoesAplicadasDryRun: aplicacaoDecisoes.decisoesAplicadasDryRun,
    decisoesNaoAplicaveis: aplicacaoDecisoes.decisoesNaoAplicaveis,
    auditoriaRevisao,
    segurancaPreAtivacao,
    // O comparador antigo × novo preenche este campo; vazio na reconstrução isolada.
    comparacao: {},
    aptoParaAtivacao,
    // A publicação depende também do comparador; nesta etapa permanece false.
    aptoParaPublicacao: false,
  };
}

/** Persiste o relatório dry-run de reconstrução em backend/data/relatorios. */
function salvarRelatorioReconstrucao(resultado, caminhoSaida) {
  fs.mkdirSync(path.dirname(caminhoSaida), { recursive: true });
  fs.writeFileSync(caminhoSaida, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
}

module.exports = {
  CAMINHO_RELATORIO_RECONSTRUCAO,
  reconstruirPlanoAplicacaoPadDryRun,
  salvarRelatorioReconstrucao,
};
