const postgresClient = require("../../db/postgres-client");
const historicoRepository = require("./profor-pad-historico-repository");
const fotografiaService = require("./profor-pad-fotografia-service");
const comparadorService = require("./profor-pad-comparador-snapshots-service");
const carregadorOperacionalService = require("./profor-pad-carregador-operacional-service");
const orquestradorTransferegovService = require("./profor-pad-atualizacao-transferegov-orquestrador-service");

const TIPOS_PENDENCIA_MATERIAL = new Set([
  "item_novo_sem_rateio_memorizado",
  "item_pad_sem_rateio_memorizado",
  "rateio_memorizado_sem_peso_operacional",
  "distribuicao_igual_provisoria_bloqueada",
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
    chavesReconstruidas.add(pendencia.chaveItem);
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

function areaOperacional(valor) {
  const area = fotografiaService.normalizarTextoCanonico(valor);
  const normalizada = area === "ESCOLA PENAL" ? "ESCOLA_PENAL" : area;
  return ["OUVIDORIA", "CORREGEDORIA", "ESCOLA_PENAL"].includes(normalizada)
    ? normalizada : null;
}

function naturezaCanonica(valor) {
  return fotografiaService.normalizarTextoCanonico(valor);
}

function agruparPor(lista, chave) {
  const grupos = new Map();
  for (const item of lista) {
    const id = item[chave];
    if (!grupos.has(id)) grupos.set(id, []);
    grupos.get(id).push(item);
  }
  return grupos;
}

async function enriquecerAlteracoesComClassificacao({ alteracoes, resultadoRecargaDepois }) {
  if (!Array.isArray(alteracoes)) throw new TypeError("alteracoes deve ser um array.");
  const linhas = montarPlanoCompletoParaHistorico(resultadoRecargaDepois);
  const chavesPorMaterial = new Map();
  for (const linha of linhas) {
    if (!linha.chaveItem) continue;
    const chaveMaterial = fotografiaService.normalizarLinhaPadCanonica(linha).chaveMaterial;
    if (!chavesPorMaterial.has(chaveMaterial)) chavesPorMaterial.set(chaveMaterial, new Set());
    chavesPorMaterial.get(chaveMaterial).add(linha.chaveItem);
  }
  const chaveOperacional = (chaveMaterial) => {
    const candidatas = chavesPorMaterial.get(chaveMaterial);
    return candidatas?.size === 1 ? [...candidatas][0] : null;
  };

  const chavesAtuais = [...new Set(alteracoes.map((alteracao) =>
    chaveOperacional(alteracao.chaveItemNova)
  ).filter(Boolean))];
  const rateiosAtuais = agruparPor(
    await historicoRepository.listarRateiosAtivosPorChavesItem(chavesAtuais), "chaveItem"
  );
  const chavesPendentes = [...new Set(alteracoes.filter((alteracao) =>
    alteracao.areaNova === "NAO_CLASSIFICADO"
  ).map((alteracao) => chaveOperacional(alteracao.chaveItemNova)).filter(Boolean))];
  const divergencias = agruparPor(
    await historicoRepository.listarDivergenciasPorChavesItem(chavesPendentes), "chaveItem"
  );
  const idsDivergencias = [...new Set([...divergencias.values()].flat().map((item) => item.id))];
  const vinculos = agruparPor(
    await historicoRepository.listarVinculosSubstitutoPorDivergenciasSubstitutas(idsDivergencias),
    "divergenciaSubstitutaId"
  );
  const chavesAntigas = [...new Set([...vinculos.values()].flat().map((vinculo) =>
    vinculo.chaveItemAusente
  ).filter(Boolean))];
  const rateiosAntigos = agruparPor(
    await historicoRepository.listarRateiosAtivosPorChavesItem(chavesAntigas), "chaveItem"
  );

  return alteracoes.map((original) => {
    const alteracao = { ...original };
    const areaAnterior = areaOperacional(alteracao.areaAnterior);
    const areaNova = areaOperacional(alteracao.areaNova);
    if (areaAnterior) alteracao.areaAnterior = areaAnterior;
    if (areaNova) alteracao.areaNova = areaNova;

    if (alteracao.tipo === "REMOVIDO") {
      if (areaAnterior) alteracao.classificacaoEstado = "PRESERVADA";
      return alteracao;
    }
    if (alteracao.tipo === "ALTERADO" && areaAnterior && areaAnterior === areaNova) {
      alteracao.classificacaoEstado = "PRESERVADA";
      return alteracao;
    }

    const chaveAtual = chaveOperacional(alteracao.chaveItemNova);
    if (areaNova && chaveAtual) {
      const confirmou = (rateiosAtuais.get(chaveAtual) || []).some((rateio) =>
        areaOperacional(rateio.area) === areaNova
        && naturezaCanonica(rateio.natureza) === naturezaCanonica(alteracao.naturezaNova)
      );
      if (confirmou) alteracao.classificacaoEstado = "PRESERVADA";
      return alteracao;
    }
    if (alteracao.areaNova !== "NAO_CLASSIFICADO") return alteracao;
    alteracao.classificacaoEstado = "PENDENTE_REVISAO";
    if (!chaveAtual) return alteracao;

    const candidatas = divergencias.get(chaveAtual) || [];
    if (candidatas.length !== 1) return alteracao;
    const divergencia = candidatas[0];
    alteracao.revisaoDivergenciaId = divergencia.id;
    const vinculosEfetivos = (vinculos.get(divergencia.id) || []).filter((vinculo) =>
      ["ACEITO", "CORRIGIDO", "APLICADO"].includes(vinculo.decisao)
      && !["REJEITADO", "REVERTIDO"].includes(vinculo.statusDivergenciaAusente)
      && vinculo.payload?.tipoSaneamento === "vinculo_item_substituto"
      && Number(vinculo.divergenciaAusenteId) === Number(vinculo.payload.divergenciaAusenteId)
      && Number(divergencia.id) === Number(vinculo.payload.divergenciaSubstitutaId)
    );
    if (vinculosEfetivos.length !== 1) return alteracao;
    const vinculo = vinculosEfetivos[0];
    const areas = new Set((rateiosAntigos.get(vinculo.chaveItemAusente) || [])
      .filter((rateio) => naturezaCanonica(rateio.natureza) === naturezaCanonica(alteracao.naturezaNova))
      .map((rateio) => areaOperacional(rateio.area)).filter(Boolean));
    if (areas.size !== 1) return alteracao;
    alteracao.areaNova = [...areas][0];
    alteracao.classificacaoEstado = "HERDADA_SUBSTITUTO";
    alteracao.decisaoSubstitutoId = vinculo.decisaoId;
    return alteracao;
  });
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
  const existente = await historicoRepository.buscarAtualizacaoPorId(atualizacaoId);
  if (!existente) throw new Error("Atualização histórica não encontrada na finalização.");
  if (existente.status === "CONCLUIDA") {
    return { atualizacao: existente, snapshotDepois: null, comparacao: null, alteracoes: [], idempotente: true };
  }
  if (existente.status === "FALHOU") {
    const erro = new Error("Atualização histórica já finalizada como FALHOU.");
    erro.codigo = "historico_atualizacao_ja_falhou";
    throw erro;
  }
  if (existente.status !== "EM_EXECUCAO") {
    throw new Error(`Status inválido da atualização histórica: ${existente.status}.`);
  }
  try {
    if (!snapshotAntes) throw new TypeError("snapshotAntes é obrigatório.");
    if (!resultadoRecargaDepois) throw new TypeError("resultadoRecargaDepois é obrigatório.");
    const snapshotDepois = gerarSnapshotHistorico(resultadoRecargaDepois);
    const comparacao = comparadorService.compararSnapshotsPad(snapshotAntes, snapshotDepois, { modo: "historico" });
    const alteracoesBase = normalizarAlteracoesComparador(comparacao, atualizacaoId);
    const alteracoes = await enriquecerAlteracoesComClassificacao({
      alteracoes: alteracoesBase, resultadoRecargaDepois,
    });
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

async function atualizarPadsTransferegovComHistorico(opcoes = {}) {
  const onProgress = typeof opcoes.onProgress === "function" ? opcoes.onProgress : () => {};
  const emitir = (evento) => {
    try { onProgress(evento); } catch (_) { /* progresso não interrompe a atualização */ }
  };
  const erroAntes = "Não foi possível capturar o estado anterior do PAD com segurança. A atualização foi interrompida antes de alterar a base operacional.";
  let resultadoRecargaAntes;
  try {
    resultadoRecargaAntes = await carregadorOperacionalService.carregarPadsOperacional({
      repoRoot: opcoes.repoRoot,
      salvarRelatorio: false,
      registrarLogOperacional: async () => {},
    });
    if (resultadoRecargaAntes?.sucesso !== true
      || Number(resultadoRecargaAntes.totalImpedimentos || 0) > 0
      || (resultadoRecargaAntes.impedimentos || []).length > 0) {
      throw new Error(erroAntes);
    }
  } catch (_) {
    throw new Error(erroAntes);
  }

  const { atualizacao, snapshotAntes } = await iniciarHistoricoPad({
    jobId: opcoes.jobId ?? null,
    resultadoRecargaAntes,
    origem: "TRANSFEREGOV",
    metadados: { jobId: opcoes.jobId ?? null },
  });
  emitir({ etapa: "historico_antes_persistido", fase: "historico", registroPadId: atualizacao.id });

  let resumo;
  try {
    resumo = await orquestradorTransferegovService.atualizarPadsTransferegovEOperacional(opcoes);
    const resultadoRecargaDepois = resumo?.resultadoRecarga;
    if (!resultadoRecargaDepois
      || resultadoRecargaDepois.sucesso !== true
      || Number(resultadoRecargaDepois.totalImpedimentos || 0) !== 0
      || (resultadoRecargaDepois.impedimentos || []).length !== 0
      || !Array.isArray(resultadoRecargaDepois.planoAplicacaoReconstruido)) {
      throw new Error("Recarga operacional posterior à atualização do Transferegov falhou. O histórico foi marcado como falho e o estado retornado não foi utilizado como snapshot DEPOIS.");
    }
  } catch (erro) {
    try {
      await falharHistoricoPad({ atualizacaoId: atualizacao.id, erro, metadados: { jobId: opcoes.jobId ?? null } });
    } catch (_) {
      // Não substituir a falha operacional pelo erro do registro de falha.
    }
    throw erro;
  }

  const finalizacao = await finalizarHistoricoPad({
    atualizacaoId: atualizacao.id,
    snapshotAntes,
    resultadoRecargaDepois: resumo.resultadoRecarga,
    metadados: { jobId: opcoes.jobId ?? null },
  });
  const resultadoHistorico = finalizacao.atualizacao.resultado;
  emitir({ etapa: "historico_concluido", fase: "historico", registroPadId: atualizacao.id, resultadoHistorico });
  return { ...resumo, registroPadId: atualizacao.id, resultadoHistorico };
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
  enriquecerAlteracoesComClassificacao,
  iniciarHistoricoPad,
  finalizarHistoricoPad,
  falharHistoricoPad,
  atualizarPadsTransferegovComHistorico,
};
