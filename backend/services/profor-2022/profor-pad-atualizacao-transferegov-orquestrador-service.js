const path = require("node:path");

const { query } = require("../../db/postgres-client");
const {
  carregarReferenciaPadExcel,
  selecionarConvenios,
} = require("./profor-pad-transferegov-dry-run-service");
const {
  extrairPadTransferegov: extrairPadTransferegovPadrao,
} = require("./profor-pad-transferegov-extracao-service");
const {
  montarCachePadTransferegov,
  validarCachePadTransferegov,
  salvarCachePadTransferegov,
  obterCaminhoCache,
} = require("./profor-pad-transferegov-cache-service");
const {
  carregarPadsOperacional: carregarPadsOperacionalPadrao,
} = require("./profor-pad-carregador-operacional-service");

const FASES = Object.freeze({
  INICIANDO: "iniciando",
  ATUALIZANDO_TRANSFEREGOV: "atualizando_transferegov",
  SALVANDO_CACHE: "salvando_cache",
  VALIDANDO_CACHE: "validando_cache",
  RECARREGANDO_VISAO_LOCAL: "recarregando_visao_local",
  CONCLUIDO: "concluido",
  ERRO: "erro",
});

function repoRootPadrao() {
  return path.resolve(__dirname, "../../..");
}

function validarIntegridadeTecnica(extracao) {
  const bloqueios = [];
  const itens = extracao?.dados?.itens;
  if (!Array.isArray(itens) || itens.length === 0) {
    bloqueios.push({ tipo: "zero_itens_extraidos", detalhe: "Nenhum item PAD foi extraído da fonte atual." });
    return bloqueios;
  }
  itens.forEach((item, indice) => {
    const contexto = { indice, descricao: item?.descricao || null };
    if (!String(item?.descricao || "").trim()) {
      bloqueios.push({ tipo: "item_sem_descricao", detalhe: "Item extraído sem descrição.", contexto });
    }
    if (!String(item?.codigoNaturezaDespesa || "").trim()) {
      bloqueios.push({ tipo: "item_sem_codigo_natureza", detalhe: "Item extraído sem código de natureza.", contexto });
    }
    if (!Number.isFinite(Number(item?.quantidade))) {
      bloqueios.push({ tipo: "quantidade_nao_parseavel", detalhe: "Quantidade do item não é numérica.", contexto });
    }
    if (!Number.isFinite(Number(item?.valorTotalPrevisto))) {
      bloqueios.push({ tipo: "valor_total_previsto_nao_parseavel", detalhe: "Valor total previsto do item não é numérico.", contexto });
    }
  });
  return bloqueios;
}

async function obterMapaUfs() {
  try {
    const linhas = await query(
      "SELECT numero_convenio, uf FROM profor_convenios_monitorados WHERE ativo = true"
    );
    return new Map(linhas.rows.map((l) => [String(l.numero_convenio), l.uf]));
  } catch (erro) {
    throw new Error(`Falha ao obter UFs da carteira monitorada no Postgres: ${erro?.message || erro}`);
  }
}

function pontuarDetalheTecnico(texto) {
  const detalhe = String(texto || "").trim();
  if (!detalhe) return "Sem detalhe técnico.";
  return /[.!?]$/.test(detalhe) ? detalhe : `${detalhe}.`;
}

function formatarPrimeiroBloqueioTecnico(cache) {
  const convenios = Array.isArray(cache?.convenios) ? cache.convenios : [];
  const convenio = convenios.find((item) => (
    item?.aptoParaImportacaoTecnica === false
    || (Array.isArray(item?.bloqueiosTecnicos) && item.bloqueiosTecnicos.length > 0)
  ));
  const bloqueio = Array.isArray(convenio?.bloqueiosTecnicos)
    ? convenio.bloqueiosTecnicos[0]
    : null;

  if (!convenio || !bloqueio) return null;

  const numeroConvenio = convenio.numeroConvenio || "convênio";
  const uf = convenio.uf && convenio.uf !== "UF" ? `/${convenio.uf}` : "";
  const tipo = bloqueio.tipo || "bloqueio_tecnico";
  const detalhe = pontuarDetalheTecnico(bloqueio.detalhe || bloqueio.mensagem);
  return `${numeroConvenio}${uf} — ${tipo}: ${detalhe}`;
}

/**
 * Orquestra: atualizar cache Transferegov (convênio por convênio) → salvar →
 * validar → recarregar visão operacional. Emite progresso via callback.
 *
 * @param {Object} opcoes
 * @param {string} [opcoes.repoRoot]
 * @param {(evento: Object) => void} [opcoes.onProgress]
 * @param {Function} [opcoes.extrairPadTransferegov]
 * @param {Function} [opcoes.carregarPadsOperacional]
 * @param {Function} [opcoes.salvarCache] (cache, opcoes) => void
 * @param {Function} [opcoes.carregarReferenciaPadExcel]
 * @param {Function} [opcoes.selecionarConvenios]
 * @param {Function} [opcoes.obterMapaUfs]
 */
async function atualizarPadsTransferegovEOperacional(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || repoRootPadrao();
  const onProgress = typeof opcoes.onProgress === "function" ? opcoes.onProgress : () => {};
  const extrair = opcoes.extrairPadTransferegov || extrairPadTransferegovPadrao;
  const recarga = opcoes.carregarPadsOperacional || carregarPadsOperacionalPadrao;
  const salvar = opcoes.salvarCache || salvarCachePadTransferegov;
  const carregarReferencia = opcoes.carregarReferenciaPadExcel || carregarReferenciaPadExcel;
  const escolherConvenios = opcoes.selecionarConvenios || selecionarConvenios;
  const obterUfs = opcoes.obterMapaUfs || obterMapaUfs;

  function emitir(evento) {
    try {
      onProgress({ ...evento, em: new Date().toISOString() });
    } catch {
      // callback do consumidor nao pode quebrar o orquestrador
    }
  }

  emitir({ etapa: "inicio", fase: FASES.INICIANDO, mensagem: "Iniciando atualização dos PADs no Transferegov." });

  // 1. Lista canônica de convênios.
  const referencia = carregarReferencia(repoRoot);
  const convenios = escolherConvenios(referencia, opcoes.filtroConvenio ? { convenio: opcoes.filtroConvenio } : {});
  if (!Array.isArray(convenios) || convenios.length === 0) {
    const erro = { mensagem: "Nenhum convênio monitorado encontrado para atualizar.", codigo: "lista_convenios_vazia" };
    emitir({ etapa: "erro", fase: FASES.ERRO, mensagem: erro.mensagem, erro });
    throw new Error(erro.mensagem);
  }
  const total = convenios.length;
  const mapaUfs = await obterUfs();

  emitir({
    etapa: "lista_convenios",
    fase: FASES.ATUALIZANDO_TRANSFEREGOV,
    total,
    mensagem: `Atualizando ${total} convênios no Transferegov.`,
  });

  // 2. Extração HTTP por convênio.
  const dataHora = new Date().toISOString();
  const resultadosExtracao = [];
  let totalBloqueiosTecnicos = 0;
  let totalItens = 0;

  for (let i = 0; i < convenios.length; i += 1) {
    const numeroConvenio = convenios[i];
    const uf = mapaUfs.get(numeroConvenio) || null;
    const indice = i + 1;

    emitir({
      etapa: "convenio_iniciado",
      fase: FASES.ATUALIZANDO_TRANSFEREGOV,
      indice,
      total,
      numeroConvenio,
      uf,
      mensagem: `Atualizando convênio ${indice}/${total} — ${numeroConvenio}${uf ? "/" + uf : ""}.`,
    });

    try {
      const extracao = await extrair(numeroConvenio, { fallbackPlaywright: false, repoRoot });
      if (!extracao || !extracao.sucesso) {
        const erros = (extracao && extracao.erros) || [];
        totalBloqueiosTecnicos += 1;
        resultadosExtracao.push({
          numeroConvenio, uf: uf || "UF", origemUsada: "falhou", extraidoEm: dataHora,
          totalItens: 0, totalizadores: {}, hashConteudo: "",
          aptoParaImportacaoTecnica: false,
          bloqueiosTecnicos: erros.map((e) => ({
            tipo: e.codigo || "falha_extracao_transferegov",
            detalhe: e.mensagem || "Erro na extração.",
          })),
          avisos: [], itens: [],
        });
        emitir({
          etapa: "convenio_concluido", fase: FASES.ATUALIZANDO_TRANSFEREGOV,
          indice, total, numeroConvenio, uf, status: "falha",
          itensExtraidos: 0,
          mensagem: `Falha ao atualizar convênio ${numeroConvenio}.`,
        });
        continue;
      }

      const bloqueiosTecnicos = validarIntegridadeTecnica(extracao);
      if (bloqueiosTecnicos.length > 0) totalBloqueiosTecnicos += bloqueiosTecnicos.length;

      const totais = (extracao.dados && extracao.dados.totais) || {};
      const totalItensConvenio = (extracao.dados && extracao.dados.itens && extracao.dados.itens.length) || 0;
      totalItens += totalItensConvenio;

      resultadosExtracao.push({
        numeroConvenio, uf: uf || "UF",
        origemUsada: extracao.origem,
        extraidoEm: dataHora,
        totalItens: totalItensConvenio,
        totalizadores: {
          concedente: totais.concedente || "",
          convenente: totais.convenente || "",
          situacao: totais.situacao || "",
          valorTotalPrevisto: totais.valorTotalPrevisto || 0,
          valorTotalExecutado: totais.valorTotalExecutado || 0,
          saldoTotal: totais.saldo || 0,
        },
        hashConteudo: (extracao.dados && extracao.dados.hashConteudo) || "",
        aptoParaImportacaoTecnica: bloqueiosTecnicos.length === 0,
        bloqueiosTecnicos,
        avisos: (extracao.dados && extracao.dados.erros) || [],
        itens: (extracao.dados && extracao.dados.itens) || [],
      });

      emitir({
        etapa: "convenio_concluido", fase: FASES.ATUALIZANDO_TRANSFEREGOV,
        indice, total, numeroConvenio, uf,
        status: bloqueiosTecnicos.length === 0 ? "sucesso" : "alerta",
        itensExtraidos: totalItensConvenio,
        mensagem: bloqueiosTecnicos.length === 0
          ? `Convênio ${numeroConvenio} atualizado (${totalItensConvenio} itens).`
          : `Convênio ${numeroConvenio} atualizado com ${bloqueiosTecnicos.length} alerta(s) técnico(s).`,
      });
    } catch (erro) {
      totalBloqueiosTecnicos += 1;
      resultadosExtracao.push({
        numeroConvenio, uf: uf || "UF", origemUsada: "falhou", extraidoEm: dataHora,
        totalItens: 0, totalizadores: {}, hashConteudo: "",
        aptoParaImportacaoTecnica: false,
        bloqueiosTecnicos: [{ tipo: "erro_inesperado", detalhe: erro.message || String(erro) }],
        avisos: [], itens: [],
      });
      emitir({
        etapa: "convenio_concluido", fase: FASES.ATUALIZANDO_TRANSFEREGOV,
        indice, total, numeroConvenio, uf, status: "falha",
        itensExtraidos: 0,
        mensagem: `Erro inesperado no convênio ${numeroConvenio}: ${erro?.message || erro}`,
      });
    }
  }

  // 3. Monta e valida o cache.
  emitir({ etapa: "montar_cache", fase: FASES.VALIDANDO_CACHE, mensagem: "Validando cache antes de gravar." });
  const cache = montarCachePadTransferegov(resultadosExtracao);
  const totalAptosTecnicos = resultadosExtracao.filter((c) => c.aptoParaImportacaoTecnica).length;
  const cacheTecnicamenteApto = totalAptosTecnicos === resultadosExtracao.length
    && totalBloqueiosTecnicos === 0
    && resultadosExtracao.length === total;
  const validacao = validarCachePadTransferegov(cache);

  if (!validacao.valido || !cacheTecnicamenteApto) {
    const motivoBase = !validacao.valido
      ? `Cache inválido: ${validacao.erro}`
      : "Cache não está tecnicamente apto (extração com falhas) — gravação abortada.";
    const detalheTecnico = formatarPrimeiroBloqueioTecnico(cache);
    const motivo = detalheTecnico
      ? `${motivoBase} Detalhe técnico: ${detalheTecnico}`
      : motivoBase;
    emitir({
      etapa: "cache_invalido", fase: FASES.ERRO,
      mensagem: motivo,
      erro: {
        codigo: "cache_invalido_ou_inapto",
        totalBloqueiosTecnicos,
        totalAptosTecnicos,
        totalConveniosExtraidos: resultadosExtracao.length,
        totalConveniosEsperados: total,
      },
    });
    throw new Error(motivo);
  }

  // 4. Salva o cache.
  emitir({ etapa: "salvar_cache", fase: FASES.SALVANDO_CACHE, mensagem: "Gravando cache local validado." });
  salvar(cache, { repoRoot });
  const caminhoCache = obterCaminhoCache({ repoRoot });

  // 5. Recarga operacional a partir do cache recém-salvo.
  emitir({ etapa: "recarga_inicio", fase: FASES.RECARREGANDO_VISAO_LOCAL, mensagem: "Reconstruindo visão operacional local." });
  const resultadoRecarga = await recarga({ repoRoot });
  emitir({ etapa: "recarga_concluida", fase: FASES.RECARREGANDO_VISAO_LOCAL, mensagem: "Recarga operacional concluída." });

  // 6. Conclusão.
  const resumo = {
    totalConveniosAtualizados: resultadosExtracao.length,
    totalAptosTecnicos,
    totalBloqueiosTecnicos,
    totalItensExtraidos: totalItens,
    cacheSalvo: true,
    caminhoCache,
    hashGlobal: cache.hashGlobal,
    geradoEm: cache.geradoEm,
    resultadoRecarga,
  };
  emitir({ etapa: "fim", fase: FASES.CONCLUIDO, mensagem: "Atualização completa.", resumo });
  return resumo;
}

module.exports = {
  FASES,
  atualizarPadsTransferegovEOperacional,
  // expostos para teste e para reuso pontual
  validarIntegridadeTecnica,
};
