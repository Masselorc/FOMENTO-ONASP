const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const {
  reconstruirPlanoAplicacaoPadDryRun,
} = require("./profor-pad-plano-reconstrucao-service");
const {
  arredondarMoedaProfor,
  normalizarNumeroConvenio,
} = require("./profor-plano-aplicacao-service");
const {
  criarChaveItemRateioProfor,
  normalizarDescricaoRateioProfor,
} = require("./profor-rateio-extracao-service");
const {
  carregarAplicacaoDecisoesDryRun,
} = require("./profor-pad-decisao-aplicacao-service");
const {
  ehSaldoResidualProfor,
  normalizarAreaSaldoResidual,
  normalizarNaturezaSaldoResidual,
  criarChaveSaldoResidual,
} = require("./profor-saldo-residual-service");

// Caminhos padrão dos relatórios dry-run de comparação.
const CAMINHO_RELATORIO_COMPARACAO_JSON =
  "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json";
const CAMINHO_RELATORIO_COMPARACAO_MD =
  "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.md";

const TOLERANCIA_MOEDA = 0.01;
const TOLERANCIA_QUANTIDADE = 0.000001;

function agoraIso() {
  return new Date().toISOString();
}

/** Limpeza técnica de descrição: apenas espaços; não remove acentuação. */
function limparDescricao(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function textoChave(valor) {
  return String(valor ?? "").trim().toUpperCase();
}

/** Chave estável de linha: numeroConvenio + descrição + área + natureza (exata, sem fuzzy). */
function criarChaveLinhaComparacao(linha) {
  const saldoResidual = ehSaldoResidualProfor(linha.descricao);
  return [
    normalizarNumeroConvenio(linha.numero ?? linha.numeroConvenio) || "sem-convenio",
    limparDescricao(linha.descricao),
    saldoResidual ? normalizarAreaSaldoResidual(linha.area) : textoChave(linha.area),
    saldoResidual ? normalizarNaturezaSaldoResidual(linha.natureza) : textoChave(linha.natureza),
  ].join("::");
}

/** Carrega a carteira monitorada ativa indexada por número de convênio. */
function carregarCarteiraMonitorada() {
  const linhas = db.prepare(`
    SELECT numero_convenio, ano, uf, instrumento
    FROM profor_convenios_monitorados
    WHERE ativo = 1
  `).all();
  const carteira = new Map();
  for (const linha of linhas) {
    const numero = normalizarNumeroConvenio(linha.numero_convenio);
    if (numero) carteira.set(numero, { uf: linha.uf, ano: linha.ano, instrumento: linha.instrumento });
  }
  return carteira;
}

/**
 * Monta o planoAplicacao da origem antiga.
 *
 * A origem antiga é representada pela memória de rateio persistida — itens
 * conhecidos e rateios ativos —, que captura as abas por UF da planilha antiga
 * agregadas por item/área/natureza. Esta etapa não relê a planilha antiga nem
 * altera a origem ativa.
 */
function montarPlanoOrigemAntiga() {
  const carteira = carregarCarteiraMonitorada();
  const linhas = db.prepare(`
    SELECT i.numero_convenio, i.descricao_original_referencia, i.uf AS item_uf,
           i.ano AS item_ano, r.area, r.natureza, r.quantidade_referencia,
           r.valor_previsto_referencia, r.valor_executado_referencia
    FROM profor_2022_itens_conhecidos i
    JOIN profor_2022_item_rateios r
      ON r.item_conhecido_id = i.id AND r.ativo = 1
    WHERE i.ativo = 1
    ORDER BY i.numero_convenio, i.descricao_original_referencia, r.area, r.natureza
  `).all();

  return linhas.map((linha) => {
    const numero = normalizarNumeroConvenio(linha.numero_convenio);
    const carteiraConvenio = numero ? carteira.get(numero) : null;
    const valorPrevisto = arredondarMoedaProfor(linha.valor_previsto_referencia);
    const valorExecutado = arredondarMoedaProfor(linha.valor_executado_referencia);
    const quantidade = Number(linha.quantidade_referencia) || 0;
    const saldoResidual = ehSaldoResidualProfor(linha.descricao_original_referencia);
    return {
      uf: carteiraConvenio?.uf || linha.item_uf || null,
      instrumento: carteiraConvenio?.instrumento || null,
      numero,
      ano: carteiraConvenio?.ano || linha.item_ano || null,
      area: saldoResidual ? normalizarAreaSaldoResidual(linha.area) : linha.area,
      natureza: saldoResidual ? normalizarNaturezaSaldoResidual(linha.natureza) : linha.natureza,
      descricao: linha.descricao_original_referencia || "",
      quantidade,
      valorUnitario: quantidade > 0
        ? Math.round((valorPrevisto / quantidade + Number.EPSILON) * 1e6) / 1e6
        : 0,
      valorPrevisto,
      valorExecutado,
      saldo: arredondarMoedaProfor(valorPrevisto - valorExecutado),
      percentualExecucao: valorPrevisto > 0
        ? Math.round((valorExecutado / valorPrevisto) * 10000) / 100
        : 0,
    };
  });
}

function consolidarLinhasSaldoResidual(linhas) {
  const resultado = [];
  const mapa = new Map();

  for (const linha of linhas) {
    if (!ehSaldoResidualProfor(linha.descricao)) {
      resultado.push(linha);
      continue;
    }
    const chave = criarChaveSaldoResidual({
      numeroConvenio: linha.numero ?? linha.numeroConvenio,
      descricao: linha.descricao,
      natureza: linha.natureza,
    });
    if (!chave) {
      resultado.push({
        ...linha,
        area: normalizarAreaSaldoResidual(linha.area),
        natureza: normalizarNaturezaSaldoResidual(linha.natureza),
      });
      continue;
    }
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        ...linha,
        area: "NAO INFORMADO",
        natureza: normalizarNaturezaSaldoResidual(linha.natureza),
        quantidade: 0,
        valorPrevisto: 0,
        valorExecutado: 0,
        saldo: 0,
        saldoResidualTecnico: true,
      });
      resultado.push(mapa.get(chave));
    }
    const agregado = mapa.get(chave);
    agregado.quantidade += Number(linha.quantidade) || 0;
    agregado.valorPrevisto = arredondarMoedaProfor(agregado.valorPrevisto + (Number(linha.valorPrevisto) || 0));
    agregado.valorExecutado = arredondarMoedaProfor(agregado.valorExecutado + (Number(linha.valorExecutado) || 0));
    agregado.saldo = arredondarMoedaProfor(agregado.valorPrevisto - agregado.valorExecutado);
    agregado.valorUnitario = agregado.quantidade > 0
      ? Math.round((agregado.valorPrevisto / agregado.quantidade + Number.EPSILON) * 1e6) / 1e6
      : 0;
    agregado.percentualExecucao = agregado.valorPrevisto > 0
      ? Math.round((agregado.valorExecutado / agregado.valorPrevisto) * 10000) / 100
      : 0;
  }

  return resultado;
}

/** Conjunto de convênios com divergência pendente que bloqueia publicação. */
function carregarConveniosComPendenciaBloqueante() {
  const linhas = db.prepare(`
    SELECT DISTINCT numero_convenio
    FROM profor_2022_revisao_divergencias
    WHERE status IN ('PENDENTE', 'EM_REVISAO') AND bloqueia_publicacao = 1
  `).all();
  return new Set(linhas.map((linha) => normalizarNumeroConvenio(linha.numero_convenio)).filter(Boolean));
}

function indexarPorChave(linhas) {
  const indice = new Map();
  for (const linha of linhas) {
    const chave = criarChaveLinhaComparacao(linha);
    if (!indice.has(chave)) indice.set(chave, []);
    indice.get(chave).push(linha);
  }
  return indice;
}

function diferenteMoeda(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) > TOLERANCIA_MOEDA;
}

function diferenteQuantidade(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) > TOLERANCIA_QUANTIDADE;
}

function acumularTotais(mapa, chave, linha, lado) {
  if (!mapa.has(chave)) {
    mapa.set(chave, {
      chave,
      antigo: { linhas: 0, valorPrevisto: 0, valorExecutado: 0, saldo: 0 },
      novo: { linhas: 0, valorPrevisto: 0, valorExecutado: 0, saldo: 0 },
    });
  }
  const registro = mapa.get(chave)[lado];
  registro.linhas += 1;
  registro.valorPrevisto = arredondarMoedaProfor(registro.valorPrevisto + (Number(linha.valorPrevisto) || 0));
  registro.valorExecutado = arredondarMoedaProfor(registro.valorExecutado + (Number(linha.valorExecutado) || 0));
  registro.saldo = arredondarMoedaProfor(registro.saldo + (Number(linha.saldo) || 0));
}

function finalizarTotais(mapa) {
  return [...mapa.values()]
    .map((registro) => ({
      chave: registro.chave,
      antigo: registro.antigo,
      novo: registro.novo,
      diferenca: {
        valorPrevisto: arredondarMoedaProfor(registro.novo.valorPrevisto - registro.antigo.valorPrevisto),
        valorExecutado: arredondarMoedaProfor(registro.novo.valorExecutado - registro.antigo.valorExecutado),
        saldo: arredondarMoedaProfor(registro.novo.saldo - registro.antigo.saldo),
        linhas: registro.novo.linhas - registro.antigo.linhas,
      },
    }))
    .sort((a, b) => String(a.chave).localeCompare(String(b.chave), "pt-BR"));
}

function montarTotais(planoAntigo, planoNovo, chaveFn) {
  const mapa = new Map();
  for (const linha of planoAntigo) acumularTotais(mapa, chaveFn(linha), linha, "antigo");
  for (const linha of planoNovo) acumularTotais(mapa, chaveFn(linha), linha, "novo");
  return finalizarTotais(mapa);
}

/** Agrupa um plano por numeroConvenio + descrição, retornando o conjunto de áreas/naturezas. */
function indexarAreasNaturezaPorItem(linhas) {
  const indice = new Map();
  for (const linha of linhas) {
    const saldoResidual = ehSaldoResidualProfor(linha.descricao);
    const natureza = saldoResidual ? normalizarNaturezaSaldoResidual(linha.natureza) : "";
    const chave = [
      normalizarNumeroConvenio(linha.numero ?? linha.numeroConvenio) || "sem-convenio",
      limparDescricao(linha.descricao),
      saldoResidual ? natureza : null,
    ].filter((parte) => parte !== null).join("::");
    if (!indice.has(chave)) indice.set(chave, { areas: new Set(), naturezas: new Set() });
    indice.get(chave).areas.add(saldoResidual ? normalizarAreaSaldoResidual(linha.area) : textoChave(linha.area));
    indice.get(chave).naturezas.add(saldoResidual ? natureza : textoChave(linha.natureza));
  }
  return indice;
}

function diferencaConjuntos(setA, setB) {
  const apenasA = [...setA].filter((valor) => !setB.has(valor));
  const apenasB = [...setB].filter((valor) => !setA.has(valor));
  return { apenasAntigo: apenasA, apenasNovo: apenasB };
}

/** Recria a chave_item (numeroConvenio + descrição normalizada) de uma linha. */
function chaveItemDeLinha(numeroConvenio, descricao, natureza = null) {
  const numero = normalizarNumeroConvenio(numeroConvenio);
  if (!numero) return null;
  if (ehSaldoResidualProfor(descricao)) {
    return criarChaveSaldoResidual({ numeroConvenio: numero, descricao, natureza });
  }
  return criarChaveItemRateioProfor(numero, normalizarDescricaoRateioProfor(descricao));
}

function normalizarDescricoesPlanosPorEquivalencia(linhas, equivalenciasAceitas) {
  if (!equivalenciasAceitas || equivalenciasAceitas.size === 0) return;
  for (const linha of linhas) {
    const chaveItem = chaveItemDeLinha(linha.numero ?? linha.numeroConvenio, linha.descricao, linha.natureza);
    if (chaveItem && equivalenciasAceitas.has(chaveItem)) {
      const eq = equivalenciasAceitas.get(chaveItem);
      const descricaoMemoria = eq.payload?.descricaoMemoria || eq.payloadDecisao?.descricaoMemoria;
      if (descricaoMemoria) {
        linha.descricao = descricaoMemoria;
      }
    }
  }
}

/**
 * Compara, em dry-run, o planoAplicacao da origem antiga com o planoAplicacao
 * reconstruído pelos relatórios PAD. Não usa fuzzy matching, não consolida
 * itens ambíguos silenciosamente e não altera a origem ativa.
 */
function compararPlanosPadDryRun(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const reconstrucao = opcoes.reconstrucao
    || reconstruirPlanoAplicacaoPadDryRun({ repoRoot, pastaRelativa: opcoes.pastaRelativa });

  const planoAntigo = consolidarLinhasSaldoResidual(montarPlanoOrigemAntiga());
  const planoNovo = consolidarLinhasSaldoResidual(reconstrucao.planoAplicacaoReconstruido);
  const conveniosComPendencia = carregarConveniosComPendenciaBloqueante();
  const aplicacaoDecisoes = opcoes.aplicacaoDecisoes || carregarAplicacaoDecisoesDryRun();
  const regras = aplicacaoDecisoes.regras;

  normalizarDescricoesPlanosPorEquivalencia(planoAntigo, regras.equivalenciasAceitas);
  normalizarDescricoesPlanosPorEquivalencia(planoNovo, regras.equivalenciasAceitas);

  const indiceAntigo = indexarPorChave(planoAntigo);
  const indiceNovo = indexarPorChave(planoNovo);
  const chaves = new Set([...indiceAntigo.keys(), ...indiceNovo.keys()]);

  const itensIguais = [];
  const itensNovos = [];
  const itensAusentes = [];
  const itensQuantidadeDivergente = [];
  const itensValorPrevistoDivergente = [];
  const itensValorExecutadoDivergente = [];
  const itensSaldoDivergente = [];
  const itensAmbiguos = [];
  const diferencas = [];

  for (const chave of chaves) {
    const antigos = indiceAntigo.get(chave) || [];
    const novos = indiceNovo.get(chave) || [];

    if (antigos.length > 1 || novos.length > 1) {
      itensAmbiguos.push({
        chave,
        ocorrenciasAntigo: antigos.length,
        ocorrenciasNovo: novos.length,
        detalhe: "Chave com mais de uma linha; não consolidada automaticamente.",
      });
      continue;
    }

    const antigo = antigos[0] || null;
    const novo = novos[0] || null;
    const numeroConvenio = normalizarNumeroConvenio(
      (novo || antigo).numero ?? (novo || antigo).numeroConvenio
    );
    const temPendencia = conveniosComPendencia.has(numeroConvenio);
    const base = {
      chave,
      numeroConvenio,
      uf: (novo || antigo).uf || null,
      area: (novo || antigo).area || null,
      natureza: (novo || antigo).natureza || null,
      descricao: (novo || antigo).descricao || null,
    };

    if (antigo && !novo) {
      const chaveItem = chaveItemDeLinha(numeroConvenio, base.descricao, base.natureza);
      const ausenciaConfirmada = chaveItem && regras.ausenciasConfirmadas.has(chaveItem);
      const registro = {
        ...base,
        situacao: "ausente",
        valorPrevistoAntigo: antigo.valorPrevisto,
        valorExecutadoAntigo: antigo.valorExecutado,
        classificacao: ausenciaConfirmada
          ? "ausencia_confirmada_por_decisao"
          : (temPendencia ? "diferenca_por_pendencia_de_decisao" : "aviso"),
        observacao: ausenciaConfirmada
          ? "Ausência confirmada por decisão resolutiva registrada na revisão assistida (dry-run)."
          : "Linha da origem antiga sem correspondência na reconstrução PAD; validar ciclo de vida do item.",
      };
      itensAusentes.push(registro);
      diferencas.push(registro);
      continue;
    }

    if (novo && !antigo) {
      const registro = {
        ...base,
        situacao: "novo",
        valorPrevistoNovo: novo.valorPrevisto,
        valorExecutadoNovo: novo.valorExecutado,
        classificacao: "critica",
        observacao: "Linha reconstruída sem correspondência na origem antiga; revisar rateio/área.",
      };
      itensNovos.push(registro);
      diferencas.push(registro);
      continue;
    }

    // Linha presente nos dois planos: comparar campo a campo.
    const campos = [];
    if (diferenteQuantidade(antigo.quantidade, novo.quantidade)) {
      campos.push({ campo: "quantidade", valorAntigo: antigo.quantidade, valorNovo: novo.quantidade });
    }
    if (diferenteMoeda(antigo.valorPrevisto, novo.valorPrevisto)) {
      campos.push({
        campo: "valorPrevisto",
        valorAntigo: antigo.valorPrevisto,
        valorNovo: novo.valorPrevisto,
        diferenca: arredondarMoedaProfor(novo.valorPrevisto - antigo.valorPrevisto),
      });
    }
    if (diferenteMoeda(antigo.valorExecutado, novo.valorExecutado)) {
      campos.push({
        campo: "valorExecutado",
        valorAntigo: antigo.valorExecutado,
        valorNovo: novo.valorExecutado,
        diferenca: arredondarMoedaProfor(novo.valorExecutado - antigo.valorExecutado),
      });
    }
    if (diferenteMoeda(antigo.saldo, novo.saldo)) {
      campos.push({
        campo: "saldo",
        valorAntigo: antigo.saldo,
        valorNovo: novo.saldo,
        diferenca: arredondarMoedaProfor(novo.saldo - antigo.saldo),
      });
    }

    if (!campos.length) {
      itensIguais.push(base);
      continue;
    }

    const temCampoFinanceiro = campos.some((campo) => campo.campo !== "quantidade");
    const chaveItemDivergente = chaveItemDeLinha(numeroConvenio, base.descricao, base.natureza);
    const saneadoPorDecisao = chaveItemDivergente
      && regras.camposSaneadosPorChaveItem.has(chaveItemDivergente);
    let classificacao;
    if (saneadoPorDecisao) {
      classificacao = "diferenca_saneada_por_decisao";
    } else if (temPendencia) {
      classificacao = "diferenca_por_pendencia_de_decisao";
    } else if (temCampoFinanceiro) {
      classificacao = "diferenca_esperada_por_atualizacao_pad";
    } else {
      classificacao = "aviso";
    }

    const registro = { ...base, situacao: "divergente", campos, classificacao };
    diferencas.push(registro);
    if (campos.some((campo) => campo.campo === "quantidade")) itensQuantidadeDivergente.push(registro);
    if (campos.some((campo) => campo.campo === "valorPrevisto")) itensValorPrevistoDivergente.push(registro);
    if (campos.some((campo) => campo.campo === "valorExecutado")) itensValorExecutadoDivergente.push(registro);
    if (campos.some((campo) => campo.campo === "saldo")) itensSaldoDivergente.push(registro);
  }

  // Divergências de área e natureza: comparação por numeroConvenio + descrição.
  const areasAntigo = indexarAreasNaturezaPorItem(planoAntigo);
  const areasNovo = indexarAreasNaturezaPorItem(planoNovo);
  const itensAreaDivergente = [];
  const itensNaturezaDivergente = [];
  for (const chaveItem of new Set([...areasAntigo.keys()].filter((chave) => areasNovo.has(chave)))) {
    const antigo = areasAntigo.get(chaveItem);
    const novo = areasNovo.get(chaveItem);
    const difAreas = diferencaConjuntos(antigo.areas, novo.areas);
    const difNaturezas = diferencaConjuntos(antigo.naturezas, novo.naturezas);
    if (difAreas.apenasAntigo.length || difAreas.apenasNovo.length) {
      itensAreaDivergente.push({ chaveItem, ...difAreas, classificacao: "aviso" });
    }
    if (difNaturezas.apenasAntigo.length || difNaturezas.apenasNovo.length) {
      itensNaturezaDivergente.push({ chaveItem, ...difNaturezas, classificacao: "aviso" });
    }
  }

  const diferencasCriticas = diferencas.filter((item) => item.classificacao === "critica");
  const avisos = diferencas.filter((item) => item.classificacao === "aviso");

  const somar = (linhas, campo) => arredondarMoedaProfor(
    linhas.reduce((total, linha) => total + (Number(linha[campo]) || 0), 0)
  );
  const totaisAntigoNovo = {
    antigo: {
      linhas: planoAntigo.length,
      valorPrevisto: somar(planoAntigo, "valorPrevisto"),
      valorExecutado: somar(planoAntigo, "valorExecutado"),
      saldo: somar(planoAntigo, "saldo"),
    },
    novo: {
      linhas: planoNovo.length,
      valorPrevisto: somar(planoNovo, "valorPrevisto"),
      valorExecutado: somar(planoNovo, "valorExecutado"),
      saldo: somar(planoNovo, "saldo"),
    },
  };
  const diferencaTotal = {
    linhas: totaisAntigoNovo.novo.linhas - totaisAntigoNovo.antigo.linhas,
    valorPrevisto: arredondarMoedaProfor(totaisAntigoNovo.novo.valorPrevisto - totaisAntigoNovo.antigo.valorPrevisto),
    valorExecutado: arredondarMoedaProfor(totaisAntigoNovo.novo.valorExecutado - totaisAntigoNovo.antigo.valorExecutado),
    saldo: arredondarMoedaProfor(totaisAntigoNovo.novo.saldo - totaisAntigoNovo.antigo.saldo),
  };

  const aptoParaPublicacao = reconstrucao.aptoParaAtivacao === true
    && reconstrucao.auditoriaRevisao.publicacaoLiberada === true
    && diferencasCriticas.length === 0;

  const resumo = {
    totalLinhasAntigo: planoAntigo.length,
    totalLinhasNovo: planoNovo.length,
    totalItensIguais: itensIguais.length,
    totalItensNovos: itensNovos.length,
    totalItensAusentes: itensAusentes.length,
    totalItensQuantidadeDivergente: itensQuantidadeDivergente.length,
    totalItensValorPrevistoDivergente: itensValorPrevistoDivergente.length,
    totalItensValorExecutadoDivergente: itensValorExecutadoDivergente.length,
    totalItensSaldoDivergente: itensSaldoDivergente.length,
    totalItensAreaDivergente: itensAreaDivergente.length,
    totalItensNaturezaDivergente: itensNaturezaDivergente.length,
    totalItensAmbiguos: itensAmbiguos.length,
    totalDiferencas: diferencas.length,
    totalDiferencasCriticas: diferencasCriticas.length,
    totalAvisos: avisos.length,
    totalDiferencasEsperadasPorAtualizacaoPad: diferencas.filter(
      (item) => item.classificacao === "diferenca_esperada_por_atualizacao_pad"
    ).length,
    totalDiferencasPorPendenciaDeDecisao: diferencas.filter(
      (item) => item.classificacao === "diferenca_por_pendencia_de_decisao"
    ).length,
    totalDiferencasSaneadasPorDecisao: diferencas.filter(
      (item) => item.classificacao === "diferenca_saneada_por_decisao"
    ).length,
    totalAusenciasConfirmadasPorDecisao: diferencas.filter(
      (item) => item.classificacao === "ausencia_confirmada_por_decisao"
    ).length,
    totalDecisoesResolutivasEncontradas: aplicacaoDecisoes.totalDecisoesResolutivasEncontradas,
    totalDecisoesInterpretadasDryRun: aplicacaoDecisoes.totalDecisoesInterpretadasDryRun,
    totalDecisoesAplicadasDryRun: aplicacaoDecisoes.totalDecisoesAplicadasDryRun,
    totalDecisoesNaoAplicaveis: aplicacaoDecisoes.totalDecisoesNaoAplicaveis,
    totalDecisoesComEfeitoNaReconstrucao: aplicacaoDecisoes.totalDecisoesComEfeitoNaReconstrucao,
    totalDecisoesSemEfeitoNaReconstrucao: aplicacaoDecisoes.totalDecisoesSemEfeitoNaReconstrucao,
    totalBloqueiosSegurancaPreAtivacao:
      reconstrucao.segurancaPreAtivacao && reconstrucao.segurancaPreAtivacao.resumo
        ? reconstrucao.segurancaPreAtivacao.resumo.totalBloqueiosAtivacao
        : null,
  };

  const conclusaoOperacional = montarConclusaoOperacional({
    reconstrucao,
    diferencaTotal,
    diferencasCriticas,
    itensAmbiguos,
    aptoParaPublicacao,
  });

  return {
    geradoEm: agoraIso(),
    modo: "dry-run",
    origemAntiga: "memoria-rateio-persistida (abas-uf capturadas)",
    origemNova: "relatorios-pad-rateados",
    resumo,
    totaisAntigoNovo,
    diferencaTotal,
    diferencasPorConvenio: montarTotais(
      planoAntigo,
      planoNovo,
      (linha) => normalizarNumeroConvenio(linha.numero ?? linha.numeroConvenio) || "sem-convenio"
    ),
    diferencasPorUf: montarTotais(planoAntigo, planoNovo, (linha) => textoChave(linha.uf) || "SEM-UF"),
    diferencasPorArea: montarTotais(planoAntigo, planoNovo, (linha) => textoChave(linha.area) || "SEM-AREA"),
    diferencasPorNatureza: montarTotais(
      planoAntigo,
      planoNovo,
      (linha) => textoChave(linha.natureza) || "SEM-NATUREZA"
    ),
    itensNovos,
    itensAusentes,
    itensQuantidadeDivergente,
    itensValorPrevistoDivergente,
    itensValorExecutadoDivergente,
    itensSaldoDivergente,
    itensAreaDivergente,
    itensNaturezaDivergente,
    itensAmbiguos,
    diferencasCriticas,
    avisos,
    diferencasSaneadasPorDecisao: diferencas.filter(
      (item) => item.classificacao === "diferenca_saneada_por_decisao"
    ),
    ausenciasConfirmadasPorDecisao: diferencas.filter(
      (item) => item.classificacao === "ausencia_confirmada_por_decisao"
    ),
    amostraDivergencias: diferencas.slice(0, 50),
    decisoesResolutivasEncontradas: aplicacaoDecisoes.decisoesResolutivasEncontradas,
    decisoesAplicadasDryRun: aplicacaoDecisoes.decisoesAplicadasDryRun,
    decisoesNaoAplicaveis: aplicacaoDecisoes.decisoesNaoAplicaveis,
    auditoriaRevisao: reconstrucao.auditoriaRevisao,
    segurancaPreAtivacao: reconstrucao.segurancaPreAtivacao,
    reconstrucaoResumo: reconstrucao.resumo,
    impedimentosReconstrucao: reconstrucao.impedimentos,
    conclusaoOperacional,
    aptoParaAtivacao: reconstrucao.aptoParaAtivacao,
    aptoParaPublicacao,
  };
}

function montarConclusaoOperacional({ reconstrucao, diferencaTotal, diferencasCriticas, itensAmbiguos, aptoParaPublicacao }) {
  const linhas = [];
  linhas.push(
    reconstrucao.aptoParaAtivacao
      ? "Reconstrução apta para ativação: nenhum impedimento técnico identificado."
      : `Reconstrução NÃO apta para ativação: ${reconstrucao.impedimentos.length} impedimento(s) registrado(s).`
  );
  linhas.push(
    aptoParaPublicacao
      ? "Comparação apta para publicação."
      : "Comparação NÃO apta para publicação: depende de aptidão para ativação, publicação liberada e ausência de diferença crítica."
  );
  linhas.push(
    `Diferença total origem antiga × reconstrução PAD: previsto ${diferencaTotal.valorPrevisto}, `
    + `executado ${diferencaTotal.valorExecutado}, saldo ${diferencaTotal.saldo}.`
  );
  linhas.push(`Diferenças críticas: ${diferencasCriticas.length}. Itens ambíguos: ${itensAmbiguos.length}.`);
  linhas.push("Etapa dry-run: não altera a origem ativa, não publica e não aplica decisões ao planoAplicacao.");
  return linhas;
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Monta um relatório Markdown resumido da comparação. */
function montarMarkdownComparacao(resultado) {
  const { resumo, totaisAntigoNovo, diferencaTotal } = resultado;
  const linhas = [];
  linhas.push("# PROFOR 2022 — Comparação planoAplicacao antigo × reconstruído PAD (dry-run)");
  linhas.push("");
  linhas.push(`Gerado em: ${resultado.geradoEm}`);
  linhas.push(`Modo: ${resultado.modo}`);
  linhas.push(`Origem antiga: ${resultado.origemAntiga}`);
  linhas.push(`Origem nova: ${resultado.origemNova}`);
  linhas.push("");
  linhas.push("## Resumo geral");
  linhas.push("");
  linhas.push(`- Linhas origem antiga: ${resumo.totalLinhasAntigo}`);
  linhas.push(`- Linhas reconstruídas (PAD): ${resumo.totalLinhasNovo}`);
  linhas.push(`- Itens iguais: ${resumo.totalItensIguais}`);
  linhas.push(`- Itens novos: ${resumo.totalItensNovos}`);
  linhas.push(`- Itens ausentes: ${resumo.totalItensAusentes}`);
  linhas.push(`- Quantidade divergente: ${resumo.totalItensQuantidadeDivergente}`);
  linhas.push(`- Valor previsto divergente: ${resumo.totalItensValorPrevistoDivergente}`);
  linhas.push(`- Valor executado divergente: ${resumo.totalItensValorExecutadoDivergente}`);
  linhas.push(`- Saldo divergente: ${resumo.totalItensSaldoDivergente}`);
  linhas.push(`- Área divergente: ${resumo.totalItensAreaDivergente}`);
  linhas.push(`- Natureza divergente: ${resumo.totalItensNaturezaDivergente}`);
  linhas.push(`- Diferenças críticas: ${resumo.totalDiferencasCriticas}`);
  linhas.push(`- Avisos: ${resumo.totalAvisos}`);
  linhas.push(`- Diferenças esperadas por atualização PAD: ${resumo.totalDiferencasEsperadasPorAtualizacaoPad}`);
  linhas.push(`- Diferenças por pendência de decisão: ${resumo.totalDiferencasPorPendenciaDeDecisao}`);
  linhas.push(`- Diferenças saneadas por decisão (dry-run): ${resumo.totalDiferencasSaneadasPorDecisao}`);
  linhas.push(`- Ausências confirmadas por decisão (dry-run): ${resumo.totalAusenciasConfirmadasPorDecisao}`);
  linhas.push(`- Itens ambíguos: ${resumo.totalItensAmbiguos}`);
  linhas.push("");
  linhas.push("## Decisões de revisão (dry-run)");
  linhas.push("");
  linhas.push(`- Decisões resolutivas encontradas: ${resumo.totalDecisoesResolutivasEncontradas}`);
  linhas.push(`- Decisões interpretadas em dry-run: ${resumo.totalDecisoesInterpretadasDryRun}`);
  linhas.push(`- Decisões com efeito na reconstrução: ${resumo.totalDecisoesComEfeitoNaReconstrucao}`);
  linhas.push(`- Decisões sem efeito na reconstrução: ${resumo.totalDecisoesSemEfeitoNaReconstrucao}`);
  linhas.push(`- Decisões não aplicáveis: ${resumo.totalDecisoesNaoAplicaveis}`);
  linhas.push(`- Bloqueios de segurança pré-ativação: ${resumo.totalBloqueiosSegurancaPreAtivacao ?? "n/d"}`);
  linhas.push("");
  linhas.push("## Totais origem antiga × reconstrução PAD");
  linhas.push("");
  linhas.push("| Plano | Linhas | Valor previsto | Valor executado | Saldo |");
  linhas.push("| --- | ---: | ---: | ---: | ---: |");
  linhas.push(`| Origem antiga | ${totaisAntigoNovo.antigo.linhas} | ${formatarMoeda(totaisAntigoNovo.antigo.valorPrevisto)} | ${formatarMoeda(totaisAntigoNovo.antigo.valorExecutado)} | ${formatarMoeda(totaisAntigoNovo.antigo.saldo)} |`);
  linhas.push(`| Reconstrução PAD | ${totaisAntigoNovo.novo.linhas} | ${formatarMoeda(totaisAntigoNovo.novo.valorPrevisto)} | ${formatarMoeda(totaisAntigoNovo.novo.valorExecutado)} | ${formatarMoeda(totaisAntigoNovo.novo.saldo)} |`);
  linhas.push(`| Diferença | ${diferencaTotal.linhas} | ${formatarMoeda(diferencaTotal.valorPrevisto)} | ${formatarMoeda(diferencaTotal.valorExecutado)} | ${formatarMoeda(diferencaTotal.saldo)} |`);
  linhas.push("");
  linhas.push("## Aptidão");
  linhas.push("");
  linhas.push(`- Apto para ativação: ${resultado.aptoParaAtivacao ? "sim" : "não"}`);
  linhas.push(`- Apto para publicação: ${resultado.aptoParaPublicacao ? "sim" : "não"}`);
  linhas.push("");
  linhas.push("## Conclusão operacional");
  linhas.push("");
  for (const item of resultado.conclusaoOperacional) linhas.push(`- ${item}`);
  if (resultado.diferencasCriticas.length) {
    linhas.push("");
    linhas.push("## Amostra de diferenças críticas");
    linhas.push("");
    for (const item of resultado.diferencasCriticas.slice(0, 20)) {
      linhas.push(`- [${item.situacao}] ${item.numeroConvenio || "sem-convênio"} | ${item.area || "-"} | ${item.descricao || "-"}`);
    }
  }
  linhas.push("");
  return `${linhas.join("\n")}`;
}

/** Persiste o relatório dry-run de comparação (JSON e, se útil, Markdown). */
function salvarRelatorioComparacao(resultado, caminhoJson, caminhoMarkdown) {
  fs.mkdirSync(path.dirname(caminhoJson), { recursive: true });
  fs.writeFileSync(caminhoJson, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
  if (caminhoMarkdown) {
    fs.writeFileSync(caminhoMarkdown, `${montarMarkdownComparacao(resultado)}\n`, "utf8");
  }
}

module.exports = {
  CAMINHO_RELATORIO_COMPARACAO_JSON,
  CAMINHO_RELATORIO_COMPARACAO_MD,
  montarPlanoOrigemAntiga,
  compararPlanosPadDryRun,
  montarMarkdownComparacao,
  salvarRelatorioComparacao,
};
