const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const {
  lerRelatoriosPadProfor2022,
} = require("./profor-pad-report-reader");
const {
  conferirItensPadComRateiosProfor2022,
} = require("./profor-pad-matching-service");
const {
  gerarLinhasItem,
} = require("./profor-pad-plano-reconstrucao-service");

const RELATORIO_JSON = "backend/data/relatorios/profor-2022-pad-recarga-operacional-v2.json";
const RELATORIO_MD = "backend/data/relatorios/profor-2022-pad-recarga-operacional-v2.md";
const TOTAL_PAD_ESPERADO = 15;

function agoraIso() {
  return new Date().toISOString();
}

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

function montarRegistro({
  tipo,
  nivel = "impeditivo",
  numeroConvenio = null,
  uf = null,
  descricao = null,
  chaveItem = null,
  detalhe,
  natureza = null,
  codigoNaturezaDespesa = null,
  quantidade = null,
  valorUnitario = null,
  valorTotalPrevisto = null,
  valorTotalExecutado = null,
  itemConhecidoId = null,
}) {
  return {
    tipo,
    nivel,
    numeroConvenio,
    uf,
    descricao,
    chaveItem,
    detalhe,
    natureza,
    codigoNaturezaDespesa,
    quantidade,
    valorUnitario,
    valorTotalPrevisto,
    valorTotalExecutado,
    itemConhecidoId,
  };
}

function dadosOriginaisDoItemPad(item) {
  if (!item) return {};
  return {
    natureza: item.natureza ?? null,
    codigoNaturezaDespesa: item.codigoNaturezaDespesa ?? item.codigoNatureza ?? null,
    quantidade: item.quantidade ?? null,
    valorUnitario: item.valorUnitario ?? null,
    valorTotalPrevisto: item.valorTotalPrevisto ?? item.valorPrevisto ?? null,
    valorTotalExecutado: item.valorTotalExecutado ?? null,
    itemConhecidoId: item.itemConhecidoId ?? null,
  };
}

function rateioTemPesoOperacional(rateios) {
  return (rateios || []).some((rateio) => {
    return Number(rateio.percentual_valor) > 0
      || Number(rateio.valor_previsto_referencia) > 0
      || Number(rateio.percentual_quantidade) > 0
      || Number(rateio.quantidade_referencia) > 0;
  });
}

function agruparAlertasPorTipo(alertas) {
  const grupos = new Map();
  for (const alerta of alertas || []) {
    const tipo = alerta.tipo || "alerta";
    if (!grupos.has(tipo)) {
      grupos.set(tipo, {
        tipo,
        total: 0,
        porConvenio: {},
        exemplos: [],
      });
    }
    const grupo = grupos.get(tipo);
    grupo.total += 1;
    const convenio = alerta.numeroConvenio || alerta.instrumento || "sem_convenio";
    grupo.porConvenio[convenio] = (grupo.porConvenio[convenio] || 0) + 1;
    if (grupo.exemplos.length < 5) grupo.exemplos.push(alerta);
  }
  return Array.from(grupos.values()).sort((a, b) => b.total - a.total || a.tipo.localeCompare(b.tipo));
}

// Pendências revisáveis não devem bloquear a recarga operacional.
// São redirecionadas para `pendenciasRevisao` e tratadas na tela
// "Revisões PAD — Plano de Aplicação Detalhado".
const TIPOS_PENDENCIA_REVISAO = new Set([
  "item_novo_sem_rateio_memorizado",
  "item_pad_sem_rateio_memorizado",
  "rateio_memorizado_sem_peso_operacional",
  "distribuicao_igual_provisoria_bloqueada",
  "instrumento_fora_da_carteira",
  "item_conhecido_nao_apto",
  "item_conhecido_nao_apto_usado",
  "item_conhecido_sem_rateio_ativo",
  "item_conhecido_ausente_no_pad",
  "item_suprimido_historico",
  "quantidade_valor_unitario_inconsistente",
  "saldo_inconsistente",
  "natureza_divergente",
  "descricao_original_divergente_da_memoria_rateio",
]);

function ehPendenciaRevisao(tipo) {
  return TIPOS_PENDENCIA_REVISAO.has(tipo);
}

function montarResumoBase({ dataHora, leitura, conferencia }) {
  return {
    dataHora,
    sucesso: false,
    aptoParaUsoLocal: false,
    aptoParaPublicacao: false,
    arquivosEncontrados: Number(leitura?.resumo?.totalArquivosEncontrados || 0),
    arquivosLidos: Number(leitura?.resumo?.totalRelatoriosLidos || 0),
    itensProcessados: Number(leitura?.resumo?.totalItensExtraidos || conferencia?.resumo?.totalItensPadConferidos || 0),
    linhasReconstruidas: 0,
    conveniosReconstruidos: 0,
    rateiosAplicados: 0,
    itensNovosSemRateio: Number(conferencia?.resumo?.totalItensPadSemRateio || 0),
    itensSuprimidos: Number(conferencia?.resumo?.totalItensConhecidosAusentesNoPad || 0),
    totalArquivosPad: Number(leitura?.resumo?.totalArquivosEncontrados || 0),
    totalRelatoriosLidos: Number(leitura?.resumo?.totalRelatoriosLidos || 0),
    totalItensPad: Number(leitura?.resumo?.totalItensExtraidos || conferencia?.resumo?.totalItensPadConferidos || 0),
    totalLinhasReconstruidas: 0,
    totalConveniosReconstruidos: 0,
    totalItensComRateioAplicado: 0,
    totalItensSemRateio: Number(conferencia?.resumo?.totalItensPadSemRateio || 0),
    totalItensNovos: Number(conferencia?.resumo?.totalItensPadSemRateio || 0),
    totalItensSuprimidos: Number(conferencia?.resumo?.totalItensConhecidosAusentesNoPad || 0),
    totalImpedimentos: 0,
    totalAlertas: 0,
    totalPendenciasRevisao: 0,
    impedimentos: [],
    alertas: [],
    pendenciasRevisao: [],
    alertasAgrupados: [],
    pendenciasRevisaoAgrupadas: [],
    planoAplicacaoReconstruido: [],
    caminhosRelatorios: {
      recargaJson: RELATORIO_JSON,
      recargaMd: RELATORIO_MD,
    },
  };
}

function salvarRelatorio(resultado, repoRoot) {
  const caminhoJson = path.join(repoRoot, RELATORIO_JSON);
  const caminhoMd = path.join(repoRoot, RELATORIO_MD);
  fs.mkdirSync(path.dirname(caminhoJson), { recursive: true });
  fs.writeFileSync(caminhoJson, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
  fs.writeFileSync(caminhoMd, gerarMarkdown(resultado), "utf8");
}

function gerarMarkdown(resultado) {
  const linhas = [];
  linhas.push("# PROFOR 2022 - Recarga operacional PAD v2");
  linhas.push("");
  linhas.push(`- Data: ${resultado.dataHora}`);
  linhas.push(`- Sucesso: ${resultado.sucesso ? "sim" : "não"}`);
  linhas.push(`- Arquivos: ${resultado.arquivosLidos}/${resultado.arquivosEncontrados}`);
  linhas.push(`- Itens processados: ${resultado.itensProcessados}`);
  linhas.push(`- Linhas reconstruídas: ${resultado.linhasReconstruidas}`);
  linhas.push(`- Convênios reconstruídos: ${resultado.conveniosReconstruidos}`);
  linhas.push(`- Rateios aplicados: ${resultado.rateiosAplicados}`);
  linhas.push(`- Itens novos sem rateio: ${resultado.itensNovosSemRateio}`);
  linhas.push(`- Itens suprimidos: ${resultado.itensSuprimidos}`);
  linhas.push("");
  linhas.push("## Impedimentos técnicos");
  if (!resultado.impedimentos.length) {
    linhas.push("");
    linhas.push("Nenhum impedimento técnico.");
  } else {
    linhas.push("");
    linhas.push("| Tipo | Convênio | Detalhe |");
    linhas.push("| --- | --- | --- |");
    for (const item of resultado.impedimentos) {
      linhas.push(`| ${item.tipo || "-"} | ${item.numeroConvenio || "-"} | ${item.detalhe || "-"} |`);
    }
  }
  linhas.push("");
  linhas.push(`## Pendências para revisão (${resultado.totalPendenciasRevisao || 0})`);
  linhas.push("");
  linhas.push("Tratadas na tela Revisões PAD — Plano de Aplicação Detalhado.");
  if (resultado.pendenciasRevisaoAgrupadas && resultado.pendenciasRevisaoAgrupadas.length) {
    linhas.push("");
    linhas.push("| Tipo | Total |");
    linhas.push("| --- | ---: |");
    for (const grupo of resultado.pendenciasRevisaoAgrupadas) {
      linhas.push(`| ${grupo.tipo} | ${grupo.total} |`);
    }
  }
  linhas.push("");
  linhas.push("## Alertas agrupados");
  if (!resultado.alertasAgrupados.length) {
    linhas.push("");
    linhas.push("Nenhum alerta.");
  } else {
    linhas.push("");
    linhas.push("| Tipo | Total |");
    linhas.push("| --- | ---: |");
    for (const grupo of resultado.alertasAgrupados) {
      linhas.push(`| ${grupo.tipo} | ${grupo.total} |`);
    }
  }
  linhas.push("");
  return `${linhas.join("\n")}\n`;
}

function carregarPadsOperacional(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const dataHora = agoraIso();



  try {
    const lerPads = opcoes.lerRelatoriosPad || lerRelatoriosPadProfor2022;
    const conferir = opcoes.conferirItensPadComRateios || conferirItensPadComRateiosProfor2022;
    const carregarRateios = opcoes.carregarMemoriaRateios || carregarMemoriaRateios;
    const gerarLinhas = opcoes.gerarLinhasItem || gerarLinhasItem;

    const leitura = lerPads(opcoes);
    const conferencia = conferir(opcoes);
    const memoriaRateios = carregarRateios();
    const resultado = montarResumoBase({ dataHora, leitura, conferencia });
    const conveniosReconstruidos = new Set();

    // Classifica como impedimento técnico (bloqueia recarga) ou pendência de
    // revisão (não bloqueia; vai para a tela Revisões PAD).
    const registrarOcorrencia = (registro) => {
      if (ehPendenciaRevisao(registro.tipo)) {
        const ajustado = { ...registro, nivel: registro.nivel === "impeditivo" ? "pendencia_revisao" : registro.nivel };
        resultado.pendenciasRevisao.push(ajustado);
      } else {
        resultado.impedimentos.push(registro);
      }
    };

    if (resultado.arquivosEncontrados !== TOTAL_PAD_ESPERADO) {
      resultado.impedimentos.push(montarRegistro({
        tipo: "quantidade_arquivos_pad_invalida",
        detalhe: `Foram encontrados ${resultado.arquivosEncontrados} arquivos PAD; o esperado é ${TOTAL_PAD_ESPERADO}.`,
      }));
    }
    if (resultado.arquivosLidos !== TOTAL_PAD_ESPERADO) {
      resultado.impedimentos.push(montarRegistro({
        tipo: "quantidade_relatorios_pad_lidos_invalida",
        detalhe: `Foram lidos ${resultado.arquivosLidos} relatórios PAD; o esperado é ${TOTAL_PAD_ESPERADO}.`,
      }));
    }

    const alertasLeituraImpeditivos = (leitura.alertas || []).filter((alerta) => alerta.nivel === "impeditivo");
    for (const alerta of alertasLeituraImpeditivos) {
      registrarOcorrencia(montarRegistro({
        tipo: alerta.tipo || "erro_leitura_pad",
        numeroConvenio: alerta.instrumento || null,
        detalhe: alerta.detalhe || "Alerta impeditivo na leitura PAD.",
      }));
    }

    for (const item of conferencia.itensPadReconhecidos || []) {
      const rateios = memoriaRateios.get(item.itemConhecidoId) || [];
      if (!rateios.length) {
        registrarOcorrencia(montarRegistro({
          tipo: "item_pad_sem_rateio_memorizado",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          descricao: item.descricaoOriginal,
          chaveItem: item.chaveItem,
          detalhe: "Item PAD reconhecido, mas sem rateio ativo memorizado.",
          ...dadosOriginaisDoItemPad(item),
        }));
        continue;
      }
      if (!rateioTemPesoOperacional(rateios)) {
        registrarOcorrencia(montarRegistro({
          tipo: "rateio_memorizado_sem_peso_operacional",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          descricao: item.descricaoOriginal,
          chaveItem: item.chaveItem,
          detalhe: "Rateio memorizado sem percentual, quantidade ou valor de referência; distribuição igual provisória não é permitida.",
        }));
        continue;
      }
      const linhas = gerarLinhas(item, rateios, {
        fonteRateio: "memoria_rateio_operacional",
        itemConhecidoId: item.itemConhecidoId,
        itemAptoParaUso: item.aptoParaImportacaoFutura !== false,
      });
      if ((linhas.linhas || []).some((linha) => linha.baseRateioValor === "distribuicao_igual" || linha.baseRateioQuantidade === "distribuicao_igual")) {
        registrarOcorrencia(montarRegistro({
          tipo: "distribuicao_igual_provisoria_bloqueada",
          numeroConvenio: item.numeroConvenio,
          uf: item.uf,
          descricao: item.descricaoOriginal,
          chaveItem: item.chaveItem,
          detalhe: "Reconstrução tentou usar distribuição igual provisória; item bloqueado.",
        }));
        continue;
      }
      resultado.planoAplicacaoReconstruido.push(...(linhas.linhas || []));
      resultado.alertas.push(...(linhas.alertasItem || []));
      for (const imped of linhas.impedimentosItem || []) {
        registrarOcorrencia(imped);
      }
      resultado.rateiosAplicados += 1;
      if (item.numeroConvenio) conveniosReconstruidos.add(item.numeroConvenio);
    }

    for (const item of conferencia.itensPadSemRateio || []) {
      registrarOcorrencia(montarRegistro({
        tipo: "item_novo_sem_rateio_memorizado",
        numeroConvenio: item.numeroConvenio,
        uf: item.uf,
        descricao: item.descricaoOriginal,
        chaveItem: item.chaveItem,
        detalhe: item.motivo
          ? `Item PAD sem rateio memorizado (${item.motivo}).`
          : "Item PAD sem rateio memorizado.",
        ...dadosOriginaisDoItemPad(item),
      }));
    }

    for (const item of conferencia.itensConhecidosAusentesNoPad || []) {
      resultado.alertas.push(montarRegistro({
        tipo: "item_suprimido_historico",
        nivel: "aviso",
        numeroConvenio: item.numeroConvenio,
        uf: item.uf,
        descricao: item.descricaoOriginalReferencia,
        chaveItem: item.chaveItem,
        detalhe: "Item da memória não veio no PAD atual; tratado como suprimido histórico.",
      }));
    }

    for (const instrumento of conferencia.instrumentosNaoEncontradosNaCarteira || []) {
      registrarOcorrencia(montarRegistro({
        tipo: "instrumento_fora_da_carteira",
        numeroConvenio: instrumento.numeroConvenio,
        detalhe: instrumento.detalhe || "Instrumento do PAD não encontrado na carteira monitorada ativa.",
      }));
    }

    resultado.linhasReconstruidas = resultado.planoAplicacaoReconstruido.length;
    resultado.conveniosReconstruidos = conveniosReconstruidos.size;
    resultado.totalLinhasReconstruidas = resultado.linhasReconstruidas;
    resultado.totalConveniosReconstruidos = resultado.conveniosReconstruidos;
    resultado.totalItensComRateioAplicado = resultado.rateiosAplicados;
    resultado.totalImpedimentos = resultado.impedimentos.length;
    resultado.totalAlertas = resultado.alertas.length;
    resultado.totalPendenciasRevisao = resultado.pendenciasRevisao.length;
    resultado.alertasAgrupados = agruparAlertasPorTipo([...resultado.alertas, ...(conferencia.alertas || [])]);
    resultado.pendenciasRevisaoAgrupadas = agruparAlertasPorTipo(resultado.pendenciasRevisao);
    // Sucesso técnico: cache válido, leitura completa e reconstrução finalizada.
    // Pendências revisáveis (item novo sem rateio, divergências, suprimidos) não
    // bloqueiam a recarga — são tratadas na tela Revisões PAD. Publicação segue
    // bloqueada independentemente.
    resultado.sucesso = resultado.totalImpedimentos === 0;
    resultado.aptoParaUsoLocal = resultado.sucesso && resultado.totalPendenciasRevisao === 0;
    resultado.aptoParaPublicacao = false;

    if (opcoes.salvarRelatorio !== false) salvarRelatorio(resultado, repoRoot);
    return resultado;
  } catch (erro) {
    const resultadoErro = {
      dataHora,
      sucesso: false,
      aptoParaUsoLocal: false,
      aptoParaPublicacao: false,
      arquivosEncontrados: 0,
      arquivosLidos: 0,
      itensProcessados: 0,
      linhasReconstruidas: 0,
      conveniosReconstruidos: 0,
      rateiosAplicados: 0,
      itensNovosSemRateio: 0,
      itensSuprimidos: 0,
      totalArquivosPad: 0,
      totalRelatoriosLidos: 0,
      totalItensPad: 0,
      totalLinhasReconstruidas: 0,
      totalConveniosReconstruidos: 0,
      totalItensComRateioAplicado: 0,
      totalItensSemRateio: 0,
      totalItensNovos: 0,
      totalItensSuprimidos: 0,
      totalImpedimentos: 1,
      totalAlertas: 0,
      totalPendenciasRevisao: 0,
      impedimentos: [
        {
          tipo: erro.codigo || "erro_execucao_recarga",
          nivel: "impeditivo",
          detalhe: erro.codigo === "cache_pad_transferegov_ausente_ou_invalido" ? erro.message : `Erro na recarga operacional: ${erro.message}`,
          etapa: erro.etapa || "leitura_cache_transferegov",
          providencia: erro.providencia || undefined,
          tecnico: {
            mensagem: erro?.message || String(erro),
            stack: erro?.stack || null,
          },
        },
      ],
      alertas: [],
      pendenciasRevisao: [],
      alertasAgrupados: [],
      pendenciasRevisaoAgrupadas: [],
      planoAplicacaoReconstruido: [],
      caminhosRelatorios: {
        recargaJson: RELATORIO_JSON,
        recargaMd: RELATORIO_MD,
      },
    };
    if (opcoes.salvarRelatorio !== false) salvarRelatorio(resultadoErro, repoRoot);
    return resultadoErro;
  }
}

function obterUltimaRecargaOperacionalV2(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const caminhoJson = path.join(repoRoot, RELATORIO_JSON);
  if (!fs.existsSync(caminhoJson)) {
    return { sucesso: false, mensagem: "Nenhuma recarga operacional v2 foi realizada ainda." };
  }
  return JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
}

module.exports = {
  RELATORIO_JSON,
  RELATORIO_MD,
  carregarPadsOperacional,
  obterUltimaRecargaOperacionalV2,
  agruparAlertasPorTipo,
};
