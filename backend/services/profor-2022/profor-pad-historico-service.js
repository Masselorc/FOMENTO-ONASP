const postgresClient = require("../../db/postgres-client");
const historicoRepository = require("./profor-pad-historico-repository");
const fotografiaService = require("./profor-pad-fotografia-service");
const comparadorService = require("./profor-pad-comparador-snapshots-service");

const TIPOS_PENDENCIA_MATERIAL = new Set([
  "item_novo_sem_rateio_memorizado",
  "item_pad_sem_rateio_memorizado",
]);

function montarPlanoCompletoParaHistorico(resultadoRecarga) {
  if (!resultadoRecarga || !Array.isArray(resultadoRecarga.planoAplicacaoReconstruido)) {
    throw new TypeError("Resultado de recarga sem planoAplicacaoReconstruido válido.");
  }
  const plano = [...resultadoRecarga.planoAplicacaoReconstruido];
  const chavesReconstruidas = new Set(plano.map((linha) => linha.chaveItem).filter(Boolean));
  const pendencias = resultadoRecarga.pendenciasRevisao || [];
  if (!Array.isArray(pendencias)) {
    throw new TypeError("pendenciasRevisao deve ser um array.");
  }

  for (const pendencia of pendencias) {
    if (!TIPOS_PENDENCIA_MATERIAL.has(pendencia?.tipo)) continue;
    const camposEssenciais = ["numeroConvenio", "uf", "natureza", "descricao", "chaveItem"];
    const ausentes = camposEssenciais.filter((campo) =>
      pendencia[campo] == null || String(pendencia[campo]).trim() === ""
    );
    if (ausentes.length) {
      const erro = new Error(`Pendência PAD sem identidade material: ${ausentes.join(", ")}.`);
      erro.codigo = "pendencia_pad_sem_identidade_material";
      throw erro;
    }
    if (chavesReconstruidas.has(pendencia.chaveItem)) continue;

    plano.push({
      uf: pendencia.uf,
      numero: pendencia.numeroConvenio,
      instrumento: pendencia.instrumento || null,
      ano: pendencia.ano || null,
      area: "NAO_CLASSIFICADO",
      natureza: pendencia.natureza,
      descricao: pendencia.descricao,
      chaveItem: pendencia.chaveItem,
      codigoNaturezaDespesa: pendencia.codigoNaturezaDespesa ?? null,
      itemConhecidoId: pendencia.itemConhecidoId ?? null,
      quantidade: pendencia.quantidade,
      valorUnitario: pendencia.valorUnitario,
      valorPrevisto: pendencia.valorTotalPrevisto,
      valorExecutado: pendencia.valorTotalExecutado,
    });
  }
  return plano;
}

function gerarSnapshotHistorico(resultadoRecarga) {
  return fotografiaService.gerarFotografiaCanonica(montarPlanoCompletoParaHistorico(resultadoRecarga));
}

function normalizarAlteracoesComparador(comparacao, atualizacaoId) {
  const novas = comparacao.itensNovos || [];
  const removidas = comparacao.itensAusentes || comparacao.itensRemovidos || [];
  const alteradas = comparacao.itensAlterados || [];
  const classificacaoEstado = (item) =>
    item?.area === "NAO_CLASSIFICADO" ? "PENDENTE_REVISAO" : "NAO_APLICAVEL";

  return [
    ...novas.map((item, ordinal) => ({
      atualizacaoId,
      chaveAlteracao: `NOVO:${item.chaveMaterial}:${item.hashItem}:${ordinal}`,
      tipo: "NOVO",
      numeroConvenio: item.numero,
      uf: item.uf,
      chaveItemAnterior: null,
      chaveItemNova: item.chaveMaterial,
      origemPareamento: null,
      descricaoAnterior: null,
      descricaoNova: item.descricaoOriginal || item.descricao,
      areaAnterior: null,
      areaNova: item.area,
      naturezaAnterior: null,
      naturezaNova: item.natureza,
      classificacaoEstado: classificacaoEstado(item),
      itemAnterior: null,
      itemNovo: item,
      camposAlterados: [],
    })),
    ...removidas.map((item, ordinal) => ({
      atualizacaoId,
      chaveAlteracao: `REMOVIDO:${item.chaveMaterial}:${item.hashItem}:${ordinal}`,
      tipo: "REMOVIDO",
      numeroConvenio: item.numero,
      uf: item.uf,
      chaveItemAnterior: item.chaveMaterial,
      chaveItemNova: null,
      origemPareamento: null,
      descricaoAnterior: item.descricaoOriginal || item.descricao,
      descricaoNova: null,
      areaAnterior: item.area,
      areaNova: null,
      naturezaAnterior: item.natureza,
      naturezaNova: null,
      classificacaoEstado: "NAO_APLICAVEL",
      itemAnterior: item,
      itemNovo: null,
      camposAlterados: [],
    })),
    ...alteradas.map((alteracao, ordinal) => {
      const anterior = alteracao.itemAnterior;
      const novo = alteracao.itemNovo;
      if (!anterior || !novo) throw new Error("Comparador não forneceu os itens canônicos da alteração.");
      return {
        atualizacaoId,
        chaveAlteracao: `ALTERADO:${anterior.chaveMaterial}:${novo.chaveMaterial}:${ordinal}`,
        tipo: "ALTERADO",
        numeroConvenio: novo.numero || anterior.numero,
        uf: novo.uf || anterior.uf,
        chaveItemAnterior: anterior.chaveMaterial,
        chaveItemNova: novo.chaveMaterial,
        origemPareamento: alteracao.origemPareamento,
        descricaoAnterior: alteracao.descricaoAnterior ?? anterior.descricaoOriginal ?? anterior.descricao,
        descricaoNova: alteracao.descricaoNova ?? novo.descricaoOriginal ?? novo.descricao,
        areaAnterior: anterior.area,
        areaNova: novo.area,
        naturezaAnterior: anterior.natureza,
        naturezaNova: novo.natureza,
        classificacaoEstado: classificacaoEstado(novo),
        itemAnterior: anterior,
        itemNovo: novo,
        camposAlterados: Object.keys(alteracao.valores || {}),
      };
    }),
  ];
}

function montarResumoAtualizacaoHistorico({ snapshotAntes, snapshotDepois, comparacao, resultadoRecargaDepois }) {
  const antes = snapshotAntes.resumo;
  const depois = snapshotDepois.resumo;
  const totalNovos = (comparacao.itensNovos || []).length;
  const totalRemovidos = (comparacao.itensAusentes || comparacao.itensRemovidos || []).length;
  const totalAlterados = (comparacao.itensAlterados || []).length;
  const totalPendenciasRevisao = Number(resultadoRecargaDepois.totalPendenciasRevisao || 0);
  const delta = (valorAntes, valorDepois) => Math.round((valorDepois - valorAntes + Number.EPSILON) * 100) / 100;

  return {
    resultado: totalNovos + totalRemovidos + totalAlterados ? "COM_ALTERACOES" : "SEM_ALTERACOES",
    totalItensAntes: antes.totalLinhas,
    totalItensDepois: depois.totalLinhas,
    totalNovos,
    totalRemovidos,
    totalAlterados,
    totalValorPrevistoAntes: antes.totalValorPrevisto,
    totalValorPrevistoDepois: depois.totalValorPrevisto,
    deltaValorPrevisto: delta(antes.totalValorPrevisto, depois.totalValorPrevisto),
    totalValorExecutadoAntes: antes.totalValorExecutado,
    totalValorExecutadoDepois: depois.totalValorExecutado,
    deltaValorExecutado: delta(antes.totalValorExecutado, depois.totalValorExecutado),
    totalSaldoAntes: antes.totalSaldo,
    totalSaldoDepois: depois.totalSaldo,
    deltaSaldo: delta(antes.totalSaldo, depois.totalSaldo),
    temPendenciasRevisao: totalPendenciasRevisao > 0,
    totalPendenciasRevisao,
    versaoSnapshot: snapshotDepois.versaoSnapshot,
    versaoComparador: comparacao.versaoComparador,
  };
}

function dadosSnapshot(atualizacaoId, momento, snapshot) {
  return {
    atualizacaoId,
    momento,
    checksum: snapshot.checksum,
    versaoSnapshot: snapshot.versaoSnapshot,
    parserVersao: snapshot.parserVersao,
    origem: snapshot.origem,
    geradoEm: snapshot.geradoEm,
    snapshot,
    resumo: snapshot.resumo,
  };
}

async function iniciarHistoricoPad({ jobId = null, resultadoRecargaAntes, origem = "TRANSFEREGOV", metadados = {} }) {
  if (!resultadoRecargaAntes) throw new TypeError("resultadoRecargaAntes é obrigatório.");
  const snapshotAntes = gerarSnapshotHistorico(resultadoRecargaAntes);
  return postgresClient.withTransaction(async (client) => {
    const atualizacao = await historicoRepository.criarAtualizacao(client, {
      jobId,
      origem,
      status: "EM_EXECUCAO",
      versaoSnapshot: snapshotAntes.versaoSnapshot,
      metadados,
    });
    if (!atualizacao?.id) throw new Error("Não foi possível criar a atualização histórica.");
    await historicoRepository.inserirSnapshot(client, dadosSnapshot(atualizacao.id, "ANTES", snapshotAntes));
    return { atualizacao, snapshotAntes };
  });
}

async function finalizarHistoricoPad({ atualizacaoId, snapshotAntes, resultadoRecargaDepois, metadados = {} }) {
  if (!atualizacaoId) throw new TypeError("atualizacaoId é obrigatório.");
  if (!snapshotAntes) throw new TypeError("snapshotAntes é obrigatório.");
  if (!resultadoRecargaDepois) throw new TypeError("resultadoRecargaDepois é obrigatório.");
  const snapshotDepois = gerarSnapshotHistorico(resultadoRecargaDepois);
  const comparacao = comparadorService.compararSnapshotsPad(snapshotAntes, snapshotDepois, { modo: "historico" });
  const alteracoes = normalizarAlteracoesComparador(comparacao, atualizacaoId);
  const resumoFinal = montarResumoAtualizacaoHistorico({
    snapshotAntes, snapshotDepois, comparacao, resultadoRecargaDepois,
  });
  resumoFinal.metadados = {
    ...metadados,
    checksumAntes: snapshotAntes.checksum,
    checksumDepois: snapshotDepois.checksum,
    checksumsValidos: comparacao.checksumsValidos,
    modoComparador: comparacao.modo,
    totalBloqueiosTecnicos: comparacao.bloqueiosTecnicos.length,
    totalRuidosTecnicosControlados: comparacao.ruidosTecnicosControlados.length,
  };

  try {
    const atualizacao = await postgresClient.withTransaction(async (client) => {
      await historicoRepository.inserirSnapshot(client, dadosSnapshot(atualizacaoId, "DEPOIS", snapshotDepois));
      await historicoRepository.inserirAlteracoes(client, alteracoes);
      const concluida = await historicoRepository.concluirAtualizacao(client, atualizacaoId, resumoFinal);
      if (!concluida) throw new Error("Atualização histórica não encontrada na finalização.");
      return concluida;
    });
    return { atualizacao, snapshotDepois, comparacao, alteracoes };
  } catch (erro) {
    try {
      await falharHistoricoPad({ atualizacaoId, erro, metadados });
    } catch (_) {
      // A falha secundária não substitui o erro da transação de finalização.
    }
    throw erro;
  }
}

async function falharHistoricoPad({ atualizacaoId, erro, metadados = {} }) {
  if (!atualizacaoId) throw new TypeError("atualizacaoId é obrigatório.");
  let mensagemErro = erro?.message || String(erro || "Falha não especificada.");
  for (const nome of ["DATABASE_URL", "PROFOR_ADMIN_TOKEN", "ONASP_EDIT_PASSWORD"]) {
    const segredo = process.env[nome];
    if (segredo) mensagemErro = mensagemErro.split(segredo).join("[REDACTED]");
  }
  mensagemErro = mensagemErro.replace(/[\r\n\t]+/g, " ").slice(0, 500);
  return historicoRepository.falharAtualizacao(null, atualizacaoId, { mensagemErro, metadados });
}

module.exports = {
  montarPlanoCompletoParaHistorico,
  gerarSnapshotHistorico,
  normalizarAlteracoesComparador,
  montarResumoAtualizacaoHistorico,
  iniciarHistoricoPad,
  finalizarHistoricoPad,
  falharHistoricoPad,
};
