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

const DECISOES_RESOLUTIVAS = ["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"];

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

/**
 * Carrega as decisões resolutivas já registradas na revisão assistida.
 * Esta etapa apenas considera tecnicamente a decisão (registra no relatório);
 * nunca aplica a decisão materialmente ao planoAplicacao.
 */
function carregarDecisoesResolutivas() {
  const placeholders = DECISOES_RESOLUTIVAS.map(() => "?").join(", ");
  const linhas = db.prepare(`
    SELECT d.id, d.numero_convenio, d.chave_item, d.tipo_alerta, d.status, d.campo_afetado
    FROM profor_2022_revisao_divergencias d
    WHERE EXISTS (
      SELECT 1 FROM profor_2022_revisao_decisoes x
      WHERE x.divergencia_id = d.id AND x.decisao IN (${placeholders})
    )
    ORDER BY d.id
  `).all(...DECISOES_RESOLUTIVAS);

  const porChaveItem = new Map();
  for (const linha of linhas) {
    if (!linha.chave_item) continue;
    if (!porChaveItem.has(linha.chave_item)) porChaveItem.set(linha.chave_item, []);
    porChaveItem.get(linha.chave_item).push({
      divergenciaId: linha.id,
      tipoAlerta: linha.tipo_alerta,
      status: linha.status,
      campoAfetado: linha.campo_afetado,
    });
  }
  return { porChaveItem, total: linhas.length };
}

function montarImpedimento({ tipo, nivel = "impeditivo", numeroConvenio = null, uf = null, descricao = null, chaveItem = null, detalhe }) {
  return { tipo, nivel, numeroConvenio, uf, descricao, chaveItem, detalhe };
}

function montarAlerta({ tipo, nivel = "aviso", numeroConvenio = null, uf = null, descricao = null, chaveItem = null, detalhe }) {
  return { tipo, nivel, numeroConvenio, uf, descricao, chaveItem, detalhe };
}

/**
 * Reconstrói, em dry-run, o planoAplicacao do PROFOR 2022 a partir dos
 * relatórios PAD, dos itens conhecidos e dos rateios persistidos.
 *
 * Não altera a origem ativa, não publica e não aplica decisões materialmente.
 * É executável mesmo com divergências pendentes: registra impedimentos e
 * mantém aptoParaAtivacao/aptoParaPublicacao como false enquanto houver
 * pendências.
 */
function reconstruirPlanoAplicacaoPadDryRun(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");

  const conferencia = conferirItensPadComRateiosProfor2022({
    repoRoot,
    pastaRelativa: opcoes.pastaRelativa,
  });
  const memoria = carregarMemoriaRateios();
  const decisoes = carregarDecisoesResolutivas();
  const auditoria = repoRevisao.obterEstatisticasAuditoria();

  const plano = [];
  const impedimentos = [];
  const alertas = [];
  const conveniosReconstruidos = new Set();
  const itensNaoAptosUsados = new Set();
  const chavesReconstruidas = new Map();

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

    chavesReconstruidas.set(itemPad.chaveItem, (chavesReconstruidas.get(itemPad.chaveItem) || 0) + 1);

    const pesosValor = obterPesosRateio(rateios, "percentual_valor", "valor_previsto_referencia");
    const pesosQuantidade = obterPesosRateio(rateios, "percentual_quantidade", "quantidade_referencia");
    const previstos = distribuirTotal(itemPad.valorTotalPrevisto, pesosValor.pesos, arredondarMoedaProfor);
    const executados = distribuirTotal(itemPad.valorTotalExecutado, pesosValor.pesos, arredondarMoedaProfor);
    const quantidades = distribuirTotal(itemPad.quantidade, pesosQuantidade.pesos, arredondarQuantidadeProfor);
    const houveAjusteResidual = previstos.residuo !== 0
      || executados.residuo !== 0
      || quantidades.residuo !== 0;
    const decisoesItem = decisoes.porChaveItem.get(itemPad.chaveItem) || [];
    const itemApto = itemPad.aptoParaImportacaoFutura !== false;

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

      // Metadados de rastreabilidade da reconstrução (não fazem parte do
      // formato financeiro consumido pelos cálculos do planoAplicacao).
      linha.origemReconstrucao = "relatorios-pad-rateados";
      linha.chaveItem = itemPad.chaveItem;
      linha.itemConhecidoId = itemPad.itemConhecidoId;
      linha.codigoNaturezaDespesa = itemPad.codigoNaturezaDespesa || null;
      linha.unidade = itemPad.unidade || null;
      linha.valorUnitarioPadReferencia = Number(itemPad.valorUnitario) || 0;
      linha.valorUnitarioDerivado = valorUnitarioDerivado;
      linha.baseRateioValor = pesosValor.base;
      linha.baseRateioQuantidade = pesosQuantidade.base;
      linha.ajusteResidualAplicado = houveAjusteResidual && indice === rateios.length - 1;
      linha.itemAptoParaUso = itemApto;
      linha.decisoesResolutivasConsideradas = decisoesItem;
      plano.push(linha);
    });

    if (itemPad.numeroConvenio) conveniosReconstruidos.add(itemPad.numeroConvenio);

    if (houveAjusteResidual) {
      alertas.push(montarAlerta({
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
      alertas.push(montarAlerta({
        tipo: "rateio_valor_sem_percentual",
        numeroConvenio: itemPad.numeroConvenio,
        uf: itemPad.uf,
        descricao: itemPad.descricaoOriginal,
        chaveItem: itemPad.chaveItem,
        detalhe: "Rateio sem percentual de valor salvo; usados os valores previstos de referência como peso.",
      }));
    }
    if (pesosValor.base === "distribuicao_igual" || pesosQuantidade.base === "distribuicao_igual") {
      impedimentos.push(montarImpedimento({
        tipo: "rateio_percentual_indefinido",
        numeroConvenio: itemPad.numeroConvenio,
        uf: itemPad.uf,
        descricao: itemPad.descricaoOriginal,
        chaveItem: itemPad.chaveItem,
        detalhe: "Rateio sem percentual nem valores de referência; reconstrução usou distribuição igual provisória.",
      }));
    }
    if (!itemApto && !itensNaoAptosUsados.has(itemPad.chaveItem)) {
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

  for (const [chaveItem, ocorrencias] of chavesReconstruidas.entries()) {
    if (ocorrencias > 1) {
      alertas.push(montarAlerta({
        tipo: "item_pad_duplicado_na_reconstrucao",
        chaveItem,
        detalhe: `Item com a mesma chave apareceu ${ocorrencias} vezes nos relatórios PAD; verifique duplicidade na fonte.`,
      }));
    }
  }

  // Itens PAD sem rateio: não geram linha reconstruída e impedem a ativação.
  for (const item of conferencia.itensPadSemRateio) {
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

  // Convênios do PAD fora da carteira monitorada.
  for (const instrumento of conferencia.instrumentosNaoEncontradosNaCarteira) {
    impedimentos.push(montarImpedimento({
      tipo: "instrumento_fora_da_carteira",
      numeroConvenio: instrumento.numeroConvenio,
      detalhe: instrumento.detalhe || "Instrumento do PAD não encontrado na carteira monitorada ativa.",
    }));
  }

  // Erros críticos de leitura dos relatórios PAD.
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

  // Alertas de consistência da fonte (não bloqueiam reconstrução).
  for (const alerta of conferencia.alertas || []) {
    if (alerta.tipo === "quantidade_valor_unitario_inconsistente") {
      alertas.push(montarAlerta({
        tipo: "quantidade_valor_unitario_inconsistente",
        nivel: alerta.nivel === "impeditivo" ? "impeditivo" : "aviso",
        numeroConvenio: alerta.instrumento || null,
        detalhe: alerta.detalhe,
      }));
    }
  }

  // Divergências pendentes/em revisão que bloqueiam publicação.
  const divergenciasBloqueantes = Number(auditoria.totalPendentesQueBloqueiamPublicacao || 0)
    + Number(auditoria.totalEmRevisaoQueBloqueiamPublicacao || 0);
  if (divergenciasBloqueantes > 0) {
    impedimentos.push(montarImpedimento({
      tipo: "divergencias_revisao_bloqueiam_publicacao",
      detalhe: `Há ${divergenciasBloqueantes} divergência(s) com status PENDENTE/EM_REVISAO e `
        + `bloqueia_publicacao = 1 na fila de revisão assistida.`,
    }));
  }

  const aptoParaAtivacao = auditoria.publicacaoLiberada === true
    && conferencia.itensPadSemRateio.length === 0
    && itensNaoAptosUsados.size === 0
    && conferencia.instrumentosNaoEncontradosNaCarteira.length === 0
    && errosCriticosLeitura.length === 0;

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
    totalLinhasReconstruidas: plano.length,
    totalConveniosReconstruidos: conveniosReconstruidos.size,
    totalItensConhecidosNaoAptosUsados: itensNaoAptosUsados.size,
    totalInstrumentosForaCarteira: conferencia.instrumentosNaoEncontradosNaCarteira.length,
    totalErrosCriticosLeitura: errosCriticosLeitura.length,
    totalImpedimentos: impedimentos.length,
    totalAlertas: alertas.length,
    totalDecisoesResolutivasConsideradas: decisoes.total,
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
    auditoriaRevisao,
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
