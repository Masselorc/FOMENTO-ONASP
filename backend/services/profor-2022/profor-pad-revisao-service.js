const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const repo = require("./profor-pad-revisao-repository");

const CAMINHO_SANEAMENTO = "backend/data/relatorios/profor-2022-pad-saneamento.json";
const CAMINHO_SANEAMENTO_DETALHADO = "backend/data/relatorios/profor-2022-pad-saneamento-detalhado.json";
const CAMINHO_RATEIOS_DRY_RUN = "backend/data/relatorios/profor-2022-pad-rateios-dry-run.json";
const CAMINHO_PAD_RELATORIOS = "backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json";

function repoRootPadrao() {
  return path.resolve(__dirname, "../../..");
}

function lerJsonSeExistir(caminhoAbsoluto) {
  if (!fs.existsSync(caminhoAbsoluto)) return null;
  return JSON.parse(fs.readFileSync(caminhoAbsoluto, "utf8"));
}

function garantirArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function texto(valor) {
  if (valor === null || valor === undefined) return null;
  return String(valor);
}

/**
 * Chave de divergência estável: numeroConvenio + tipo_alerta + chave_item (ou
 * descrição normalizada) + campo_afetado. Hash curto para uso como UNIQUE,
 * com prefixo legível do tipo.
 */
function criarChaveDivergencia({ numeroConvenio, tipoAlerta, chaveItemOuDescricao, campoAfetado }) {
  const base = [
    numeroConvenio || "sem-convenio",
    tipoAlerta || "sem-tipo",
    chaveItemOuDescricao || "sem-item",
    campoAfetado || "sem-campo",
  ].join("::");
  const hash = crypto.createHash("sha1").update(base).digest("hex").slice(0, 16);
  return `${tipoAlerta}:${hash}`;
}

/* ----------------------- conversão dos relatórios em divergências ----------------------- */

/** Itens PAD sem rateio (excluindo coincidências normalizadas) → item_novo_sem_rateio. */
function divergenciasItensSemRateio(saneamento) {
  return garantirArray(saneamento.itensPadSemRateio)
    .filter((item) => item.motivo !== "descricao_original_divergente_da_memoria_rateio")
    .map((item) => {
      const tipoAlerta = "item_novo_sem_rateio";
      return {
        chaveDivergencia: criarChaveDivergencia({
          numeroConvenio: item.numeroConvenio,
          tipoAlerta,
          chaveItemOuDescricao: item.chaveItem,
          campoAfetado: "rateio",
        }),
        numeroConvenio: texto(item.numeroConvenio),
        uf: texto(item.uf),
        chaveItem: texto(item.chaveItem),
        tipoAlerta,
        nivel: "impeditivo",
        campoAfetado: "rateio",
        valorAnterior: null,
        valorNovo: texto(item.descricaoOriginal),
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "item PAD sem rateio na memória",
        motivoProvavel: "Item presente no PAD não tem rateio persistido na memória.",
        acaoSugerida: "Definir rateio por área para o item antes da reconstrução.",
        impactoReconstrucao: "Impede a reconstrução automática da linha do planoAplicacao.",
        bloqueiaPublicacao: true,
        payload: {
          campoAfetado: "rateio",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          chaveItem: item.chaveItem,
          descricaoPad: item.descricaoOriginal,
          naturezaPad: item.natureza,
          quantidadePad: item.quantidade,
          valorUnitarioPad: item.valorUnitario,
          valorPrevistoPad: item.valorTotalPrevisto,
          valorExecutadoPad: item.valorTotalExecutado,
          saldoPad: item.saldo,
          origemRelatorio: item.arquivo,
          linhaOrigem: item.linha,
          acaoSugerida: "definir_rateio",
          bloqueiaPublicacao: true,
        },
      };
    });
}

/** Coincidências apenas por descrição normalizada → equivalencia_por_descricao_normalizada. */
function divergenciasEquivalencias(saneamento) {
  return garantirArray(saneamento.itensPadCoincidemApenasPorDescricaoNormalizada)
    .map((item) => {
      const tipoAlerta = "equivalencia_por_descricao_normalizada";
      const indicio = item.indicioEquivalencia || {};
      return {
        chaveDivergencia: criarChaveDivergencia({
          numeroConvenio: item.numeroConvenio,
          tipoAlerta,
          chaveItemOuDescricao: item.chaveItem,
          campoAfetado: "descricao",
        }),
        numeroConvenio: texto(item.numeroConvenio),
        uf: texto(item.uf),
        chaveItem: texto(item.chaveItem),
        tipoAlerta,
        nivel: "aviso",
        campoAfetado: "descricao",
        valorAnterior: texto(item.descricaoOriginalReferencia),
        valorNovo: texto(item.descricaoOriginal),
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "descrição original diverge; coincide apenas após normalização",
        motivoProvavel: indicio.valorUnitarioCoincide === true
          ? "Descrição diverge (possível acentuação/grafia); valor unitário coincide, reforçando equivalência."
          : "Descrição diverge; coincidência apenas por normalização exige validação humana.",
        acaoSugerida: "Confirmar ou rejeitar equivalência manualmente; não aceitar automaticamente.",
        impactoReconstrucao: "Item não é considerado rateado até a equivalência ser decidida.",
        bloqueiaPublicacao: true,
        payload: {
          campoAfetado: "descricao",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          chaveItem: item.chaveItem,
          descricaoMemoria: item.descricaoOriginalReferencia,
          descricaoPad: item.descricaoOriginal,
          valorUnitarioMemoria: indicio.valorUnitarioReferenciaMemoria ?? null,
          valorUnitarioPad: indicio.valorUnitarioPad ?? null,
          naturezaPad: indicio.naturezaPad ?? item.natureza ?? null,
          naturezaMemoria: garantirArray(indicio.naturezasEncontradasMemoria).join(", ") || null,
          riscoFalsoPositivo: indicio.valorUnitarioCoincide === true ? "baixo" : "medio",
          evidencias: {
            valorUnitarioCoincide: indicio.valorUnitarioCoincide ?? null,
            diferencaValorUnitario: indicio.diferencaValorUnitario ?? null,
          },
          origemRelatorio: item.arquivo,
          linhaOrigem: item.linha,
          acaoSugerida: "validar_equivalencia",
          bloqueiaPublicacao: true,
        },
      };
    });
}

function numeroOuZero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function arredondarValorMonetario(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round((numero + Number.EPSILON) * 100) / 100;
}

function arredondarQuantidade(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round((numero + Number.EPSILON) * 1000000) / 1000000;
}

function juntarUnicosNaoVazios(valores) {
  const unicos = [];
  const vistos = new Set();
  for (const valor of valores) {
    const textoValor = texto(valor)?.trim();
    if (!textoValor) continue;
    const chave = textoValor.toLocaleUpperCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(textoValor);
  }
  return unicos.length ? unicos.join(", ") : null;
}

function resumirMemoriaItemNaoApto(item, detalhado) {
  const rateiosAtivos = garantirArray(detalhado?.rateiosAtivos);
  const descricao = texto(
    detalhado?.descricaoOriginal
    || item?.descricaoOriginal
    || item?.descricaoOriginalReferencia
  );
  const valorUnitarioReferencia = Number(detalhado?.valorUnitarioReferencia ?? item?.valorUnitarioReferencia);

  if (!rateiosAtivos.length) {
    return {
      descricao,
      area: null,
      natureza: null,
      quantidade: null,
      valorUnitario: Number.isFinite(valorUnitarioReferencia)
        ? arredondarValorMonetario(valorUnitarioReferencia)
        : null,
      valorPrevisto: null,
      valorExecutado: null,
      saldo: null,
      totalRateiosAtivos: 0,
    };
  }

  const quantidade = rateiosAtivos.reduce(
    (total, rateio) => total + numeroOuZero(rateio.quantidadeReferencia),
    0
  );
  const valorPrevisto = rateiosAtivos.reduce(
    (total, rateio) => total + numeroOuZero(rateio.valorPrevistoReferencia),
    0
  );
  const valorExecutado = rateiosAtivos.reduce(
    (total, rateio) => total + numeroOuZero(rateio.valorExecutadoReferencia),
    0
  );
  const saldo = valorPrevisto - valorExecutado;
  const valorUnitario = Number.isFinite(valorUnitarioReferencia) && valorUnitarioReferencia > 0
    ? valorUnitarioReferencia
    : (quantidade > 0 ? valorPrevisto / quantidade : null);
  const quantidadeMemoria = valorPrevisto > 0 && Number.isFinite(valorUnitario) && valorUnitario > 0
    ? valorPrevisto / valorUnitario
    : quantidade;

  return {
    descricao,
    area: juntarUnicosNaoVazios(rateiosAtivos.map((rateio) => rateio.area)),
    natureza: juntarUnicosNaoVazios(rateiosAtivos.map((rateio) => rateio.natureza)),
    quantidade: arredondarQuantidade(quantidadeMemoria),
    valorUnitario: arredondarValorMonetario(valorUnitario),
    valorPrevisto: arredondarValorMonetario(valorPrevisto),
    valorExecutado: arredondarValorMonetario(valorExecutado),
    saldo: arredondarValorMonetario(saldo),
    totalRateiosAtivos: rateiosAtivos.length,
  };
}

/** Itens conhecidos não aptos → item_nao_apto. */
function divergenciasNaoAptos(saneamento, detalhadoPorChave) {
  return garantirArray(saneamento.itensConhecidosNaoAptos)
    .map((item) => {
      const tipoAlerta = "item_nao_apto";
      const chave = String(item.chaveItem || "").trim();
      const detalhado = detalhadoPorChave.get(chave) || null;
      const memoria = resumirMemoriaItemNaoApto(item, detalhado);
      const pad = {
        descricao: item.descricaoOriginal ?? null,
        natureza: item.natureza ?? null,
        quantidade: item.quantidade ?? null,
        valorUnitario: item.valorUnitario ?? null,
        valorPrevisto: item.valorTotalPrevisto ?? null,
        valorExecutado: item.valorTotalExecutado ?? null,
        saldo: item.saldo ?? null,
      };
      return {
        chaveDivergencia: criarChaveDivergencia({
          numeroConvenio: item.numeroConvenio,
          tipoAlerta,
          chaveItemOuDescricao: item.chaveItem,
          campoAfetado: "aptidao",
        }),
        numeroConvenio: texto(item.numeroConvenio),
        uf: texto(item.uf),
        chaveItem: texto(item.chaveItem),
        tipoAlerta,
        nivel: "impeditivo",
        campoAfetado: "aptidao",
        valorAnterior: "nao_apto",
        valorNovo: "presente_no_pad",
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "item está no PAD, mas marcado como não apto na memória",
        motivoProvavel: detalhado
          ? (detalhado.providenciaRecomendada || "Item não apto por alerta de origem.")
          : "Item marcado como não apto na memória.",
        acaoSugerida: "Resolver a pendência impeditiva e liberar o item, ou mantê-lo bloqueado.",
        impactoReconstrucao: "Item não pode ser usado na reconstrução até ser liberado.",
        bloqueiaPublicacao: true,
        payload: {
          campoAfetado: "aptidao",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          chaveItem: item.chaveItem,
          memoria,
          antes: memoria,
          pad,
          depois: pad,
          descricaoMemoria: memoria.descricao,
          areaMemoria: memoria.area,
          naturezaMemoria: memoria.natureza,
          quantidadeMemoria: memoria.quantidade,
          valorUnitarioMemoria: memoria.valorUnitario,
          valorPrevistoMemoria: memoria.valorPrevisto,
          valorExecutadoMemoria: memoria.valorExecutado,
          saldoMemoria: memoria.saldo,
          totalRateiosAtivosMemoria: memoria.totalRateiosAtivos,
          descricaoPad: pad.descricao,
          naturezaPad: pad.natureza,
          quantidadePad: pad.quantidade,
          valorUnitarioPad: pad.valorUnitario,
          valorPrevistoPad: pad.valorPrevisto,
          valorExecutadoPad: pad.valorExecutado,
          saldoPad: pad.saldo,
          alertasOriginais: detalhado ? detalhado.alertasOriginais : [],
          rateiosAtivos: detalhado ? detalhado.rateiosAtivos : [],
          riscoFalsoPositivo: "baixo",
          origemRelatorio: item.arquivo,
          linhaOrigem: item.linha,
          acaoSugerida: "liberar_ou_manter_bloqueado",
          bloqueiaPublicacao: true,
        },
      };
    });
}

/** Itens conhecidos ausentes no PAD → item_ausente_no_pad. */
function divergenciasAusentes(saneamento) {
  const diacriticoSaneados = saneamento.equivalenciasDiacriticoSaneadas || [];
  const stripDiacritics = (str) => {
    return String(str ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  return garantirArray(saneamento.itensConhecidosAusentesNoPad)
    .map((item) => {
      const tipoAlerta = "item_ausente_no_pad";
      const memoria = {
        descricao: item.descricaoOriginalReferencia ?? null,
        natureza: Array.isArray(item.naturezasEncontradas) ? item.naturezasEncontradas.join(", ") : null,
        quantidade: item.quantidadeReferencia !== undefined ? arredondarQuantidade(item.quantidadeReferencia) : null,
        valorUnitario: item.valorUnitarioReferencia !== undefined ? arredondarValorMonetario(item.valorUnitarioReferencia) : null,
        valorPrevisto: item.valorPrevistoReferencia !== undefined ? arredondarValorMonetario(item.valorPrevistoReferencia) : null,
        valorExecutado: item.valorExecutadoReferencia !== undefined ? arredondarValorMonetario(item.valorExecutadoReferencia) : null,
        saldo: item.saldoReferencia !== undefined ? arredondarValorMonetario(item.saldoReferencia) : null,
        totalRateiosAtivos: item.totalRateiosAtivos ?? null,
      };

      const descMemoria = item.descricaoOriginalReferencia;
      let saneadoPorDiacritico = false;
      if (descMemoria) {
        const chaveSaneada = `${item.numeroConvenio}::${stripDiacritics(descMemoria).toLowerCase()}`;
        const correspondente = diacriticoSaneados.find(x => 
          `${x.numeroConvenio}::${stripDiacritics(x.descricaoOriginalMemoria).toLowerCase()}` === chaveSaneada
        );
        if (correspondente) {
          saneadoPorDiacritico = true;
        }
      }

      return {
        chaveDivergencia: criarChaveDivergencia({
          numeroConvenio: item.numeroConvenio,
          tipoAlerta,
          chaveItemOuDescricao: item.chaveItem,
          campoAfetado: "existencia",
        }),
        numeroConvenio: texto(item.numeroConvenio),
        uf: texto(item.uf),
        chaveItem: texto(item.chaveItem),
        tipoAlerta,
        nivel: "aviso",
        campoAfetado: "existencia",
        valorAnterior: "presente_na_memoria",
        valorNovo: "ausente_no_pad",
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "item conhecido não apareceu no PAD atual",
        motivoProvavel: "Item da memória ausente no PAD; possível exclusão ou substituição.",
        acaoSugerida: "Confirmar exclusão, vincular substituto ou manter em observação.",
        impactoReconstrucao: "Não bloqueia a reconstrução dos itens PAD atuais; exige validação de ciclo de vida.",
        bloqueiaPublicacao: false,
        payload: {
          campoAfetado: "existencia",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          chaveItem: item.chaveItem,
          descricaoMemoria: memoria.descricao,
          naturezaMemoria: memoria.natureza,
          quantidadeMemoria: memoria.quantidade,
          valorUnitarioMemoria: memoria.valorUnitario,
          valorPrevistoMemoria: memoria.valorPrevisto,
          valorExecutadoMemoria: memoria.valorExecutado,
          saldoMemoria: memoria.saldo,
          totalRateiosAtivosMemoria: memoria.totalRateiosAtivos,
          memoria,
          antes: memoria,
          itemConhecidoId: item.id ?? null,
          totalRateiosAtivos: item.totalRateiosAtivos ?? null,
          riscoFalsoPositivo: "medio",
          acaoSugerida: "validar_ciclo_de_vida",
          bloqueiaPublicacao: false,
          saneadoPorDiacritico,
        },
      };
    });
}

/** Alertas do leitor PAD → quantidade_valor_unitario_inconsistente / saldo_inconsistente / natureza_divergente. */
function divergenciasAlertasLeitorPad(padRelatorios) {
  const mapaTipo = {
    quantidade_valor_unitario_inconsistente: "quantidade_valor_unitario_inconsistente",
    saldo_inconsistente: "saldo_inconsistente",
    natureza_nao_classificada: "natureza_divergente",
  };
  const divergencias = [];
  for (const alerta of garantirArray(padRelatorios.alertas)) {
    const tipoAlerta = mapaTipo[alerta.tipo];
    if (!tipoAlerta) continue;
    const origem = alerta.origem || {};
    const chaveItemOuDescricao = `${origem.aba || "sem-aba"}:linha-${origem.linha ?? "?"}`;
    divergencias.push({
      chaveDivergencia: criarChaveDivergencia({
        numeroConvenio: alerta.instrumento,
        tipoAlerta,
        chaveItemOuDescricao,
        campoAfetado: alerta.tipo,
      }),
      numeroConvenio: texto(alerta.instrumento),
      uf: null,
      chaveItem: null,
      tipoAlerta,
      nivel: ["info", "aviso", "impeditivo"].includes(alerta.nivel) ? alerta.nivel : "aviso",
      campoAfetado: alerta.tipo,
      valorAnterior: null,
      valorNovo: null,
      fonteAnterior: "pad",
      fonteNova: "pad",
      diferenca: texto(alerta.detalhe),
      motivoProvavel: tipoAlerta === "quantidade_valor_unitario_inconsistente"
        ? "Quantidade x valor unitário exibido diverge do total previsto; pode ser truncamento do valor unitário exibido."
        : texto(alerta.detalhe),
      acaoSugerida: tipoAlerta === "quantidade_valor_unitario_inconsistente"
        ? "Confirmar que o total previsto do PAD é o dado confiável; não recalcular pelo valor unitário."
        : "Conferir o relatório PAD de origem.",
      impactoReconstrucao: tipoAlerta === "quantidade_valor_unitario_inconsistente"
        ? "Não altera os totais financeiros do PAD; é alerta de consistência da fonte."
        : "Pode afetar a totalização; conferir antes da reconstrução.",
      bloqueiaPublicacao: alerta.nivel === "impeditivo",
      payload: {
        campoAfetado: alerta.tipo,
        numeroConvenio: alerta.instrumento,
        diferenca: alerta.detalhe,
        evidencias: { detalhe: alerta.detalhe },
        origemRelatorio: origem.arquivo || null,
        linhaOrigem: origem.linha ?? null,
        alertasOriginais: [alerta],
        // Dados estruturados do item PAD: identificam o item na tela e
        // permitem reavaliar a consistencia quantidade x valor unitario.
        dadosConsistencia: alerta.dados || null,
        riscoFalsoPositivo: tipoAlerta === "quantidade_valor_unitario_inconsistente" ? "alto" : "medio",
        acaoSugerida: "conferir_fonte",
        bloqueiaPublicacao: alerta.nivel === "impeditivo",
      },
    });
  }
  return divergencias;
}

/** Coleta todas as divergências das fontes disponíveis. */
function coletarDivergencias(repoRoot) {
  const saneamento = lerJsonSeExistir(path.join(repoRoot, CAMINHO_SANEAMENTO));
  if (!saneamento) {
    throw new Error(
      `Relatório de saneamento não encontrado em ${CAMINHO_SANEAMENTO}. ` +
      "Execute 'npm run profor:pad:relatorio-saneamento' antes."
    );
  }
  const detalhado = lerJsonSeExistir(path.join(repoRoot, CAMINHO_SANEAMENTO_DETALHADO));
  const padRelatorios = lerJsonSeExistir(path.join(repoRoot, CAMINHO_PAD_RELATORIOS));

  const detalhadoPorChave = new Map();
  for (const item of garantirArray(detalhado && detalhado.itensNaoAptosDetalhados)) {
    detalhadoPorChave.set(String(item.chaveItem || "").trim(), item);
  }

  const divergencias = [
    ...divergenciasItensSemRateio(saneamento),
    ...divergenciasEquivalencias(saneamento),
    ...divergenciasNaoAptos(saneamento, detalhadoPorChave),
    ...divergenciasAusentes(saneamento),
  ];
  if (padRelatorios) {
    divergencias.push(...divergenciasAlertasLeitorPad(padRelatorios));
  }
  return { divergencias, temPadRelatorios: Boolean(padRelatorios) };
}

/** Hash da composição das fontes, para rastrear a geração do lote. */
function calcularHashOrigem(repoRoot) {
  const hash = crypto.createHash("sha256");
  for (const caminho of [CAMINHO_SANEAMENTO, CAMINHO_SANEAMENTO_DETALHADO, CAMINHO_RATEIOS_DRY_RUN, CAMINHO_PAD_RELATORIOS]) {
    const absoluto = path.join(repoRoot, caminho);
    if (fs.existsSync(absoluto)) hash.update(fs.readFileSync(absoluto));
  }
  return hash.digest("hex");
}

/**
 * Gera (ou atualiza) a fila de revisão a partir dos relatórios atuais.
 * Toda a operação ocorre em uma única transação.
 */
function gerarFilaRevisao(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || repoRootPadrao();
  const { divergencias } = coletarDivergencias(repoRoot);
  const hashOrigem = calcularHashOrigem(repoRoot);

  const executar = db.transaction(() => {
    const loteId = repo.criarLoteRevisao({
      origem: "relatorios-saneamento-pad",
      arquivoOrigem: CAMINHO_SANEAMENTO,
      hashOrigem,
    });

    const chavesAntes = new Set(repo.listarChavesExistentes());
    const chavesGeradas = new Set();
    let criadas = 0;
    let atualizadas = 0;

    for (const divergencia of divergencias) {
      chavesGeradas.add(divergencia.chaveDivergencia);
      const resultado = repo.inserirOuAtualizarDivergencia(loteId, divergencia);
      if (resultado.acao === "criada") criadas += 1;
      else atualizadas += 1;
      repo.registrarLog({
        entidadeTipo: "divergencia",
        entidadeId: resultado.id,
        evento: resultado.acao === "criada" ? "divergencia_criada" : "divergencia_atualizada",
        estadoNovo: {
          loteGeracaoId: loteId,
          chaveDivergencia: divergencia.chaveDivergencia,
          tipoAlerta: divergencia.tipoAlerta,
          nivel: divergencia.nivel,
        },
        detalhe: `Divergência ${resultado.acao} a partir dos relatórios de saneamento.`,
      });
    }

    // Divergências antigas não reapresentadas: não são apagadas; apenas registradas em log.
    const naoReapresentadas = [...chavesAntes].filter((chave) => !chavesGeradas.has(chave));
    for (const chave of naoReapresentadas) {
      const existente = repo.buscarDivergenciaPorChave(chave);
      if (existente && existente.status === "PENDENTE" && existente.bloqueia_publicacao === 1) {
        db.prepare(`
          UPDATE profor_2022_revisao_divergencias
          SET bloqueia_publicacao = 0, atualizado_em = ?
          WHERE id = ?
        `).run(new Date().toISOString(), existente.id);
      }
      repo.registrarLog({
        entidadeTipo: "divergencia",
        entidadeId: existente ? existente.id : null,
        evento: "divergencia_nao_reapresentada",
        estadoNovo: { loteGeracaoId: loteId, chaveDivergencia: chave },
        detalhe: "Divergência não reapareceu nesta geração; mantida no histórico sem alteração.",
      });
    }

    const estatisticas = repo.obterEstatisticasAuditoria();
    repo.atualizarTotaisLote(loteId, {
      totalDivergencias: estatisticas.totalDivergencias,
      totalPendentes: estatisticas.totalPendentes,
      totalImpeditivas: estatisticas.totalImpeditivas,
    });
    repo.registrarLog({
      entidadeTipo: "lote",
      entidadeId: loteId,
      evento: "lote_gerado",
      estadoNovo: {
        loteGeracaoId: loteId,
        divergenciasNaGeracao: divergencias.length,
        criadas,
        atualizadas,
        naoReapresentadas: naoReapresentadas.length,
      },
      detalhe: "Lote de revisão gerado.",
    });

    return {
      loteId,
      divergenciasNaGeracao: divergencias.length,
      criadas,
      atualizadas,
      naoReapresentadas: naoReapresentadas.length,
      estatisticas,
    };
  });

  return executar();
}

/** Monta o relatório de auditoria da fila de revisão (somente leitura). */
async function auditarFilaRevisao() {
  // obterEstatisticasAuditoria ainda é SQLite (pendente Lote B — compartilha
  // fluxo com a transação SQLite de gerarFilaRevisao). Os demais já vêm do
  // Postgres.
  const estatisticas = repo.obterEstatisticasAuditoria();
  const ultimoLote = await repo.obterUltimoLote();
  const comDecisao = await repo.contarDivergenciasComDecisao();

  let criadasUltimoLote = 0;
  let atualizadasUltimoLote = 0;
  let naoReapresentadasUltimoLote = 0;
  if (ultimoLote) {
    [criadasUltimoLote, atualizadasUltimoLote, naoReapresentadasUltimoLote] = await Promise.all([
      repo.contarEventosDoLote(ultimoLote.id, "divergencia_criada"),
      repo.contarEventosDoLote(ultimoLote.id, "divergencia_atualizada"),
      repo.contarEventosDoLote(ultimoLote.id, "divergencia_nao_reapresentada"),
    ]);
  }

  return {
    estatisticas,
    divergenciasComDecisao: comDecisao,
    divergenciasComDecisaoResolutiva: estatisticas.totalComDecisaoResolutiva,
    divergenciasComComentario: estatisticas.totalComComentario,
    divergenciasSemDecisaoResolutiva: estatisticas.totalSemDecisaoResolutiva,
    divergenciasSemDecisao: estatisticas.totalSemDecisaoResolutiva,
    ultimoLote,
    criadasUltimoLote,
    atualizadasUltimoLote,
    reapresentadasUltimoLote: atualizadasUltimoLote,
    naoReapresentadasUltimoLote,
  };
}

module.exports = {
  criarChaveDivergencia,
  coletarDivergencias,
  gerarFilaRevisao,
  auditarFilaRevisao,
  // Exposto para testes unitários do payload de item_ausente_no_pad.
  divergenciasAusentes,
};
