const fs = require("node:fs");
const path = require("node:path");

const revisao = require("../services/profor-2022/profor-pad-revisao-decisao-service");
const {
  gerarHashPayloadDivergencia,
} = require("../services/profor-2022/profor-pad-seguranca-pre-ativacao-service");

const SAIDA_JSON = "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.md";

const FONTES = {
  pendenciasJson: "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json",
  pendenciasMd: "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.md",
  segurancaDetalhadaJson: "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-detalhada-dry-run.json",
  segurancaDetalhadaMd: "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-detalhada-dry-run.md",
  segurancaJson: "backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json",
  reconstrucaoJson: "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json",
  comparacaoJson: "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json",
  comparacaoMd: "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.md",
  regressaoJson: "backend/data/relatorios/profor-2022-regressao-saneamentos-dry-run.json",
  regressaoMd: "backend/data/relatorios/profor-2022-regressao-saneamentos-dry-run.md",
};

const IDS_PAYLOAD_ALTERADO_ESPERADOS = [
  47, 48, 49, 50, 51, 52, 53, 54, 56, 57, 58, 59, 60, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
];

const IDS_PENDENCIA_TECNICA_ESPERADOS = [18, 25, 26, 27, 28, 75, 77, 78];

function repoRoot() {
  return path.resolve(__dirname, "../..");
}

function caminhoAbsoluto(caminhoRelativo) {
  return path.join(repoRoot(), caminhoRelativo);
}

function lerTexto(caminhoRelativo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  if (!fs.existsSync(caminho)) {
    throw new Error(`Fonte obrigatoria nao encontrada: ${caminhoRelativo}`);
  }
  return fs.readFileSync(caminho, "utf8");
}

function lerJson(caminhoRelativo) {
  return JSON.parse(lerTexto(caminhoRelativo));
}

function escreverJson(caminhoRelativo, dados) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function escreverTexto(caminhoRelativo, conteudo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${conteudo.trimEnd()}\n`, "utf8");
}

function ultimoResolutivo(divergencia) {
  // `divergencia.decisoes` chega ordenada DESC por id (mais recente primeiro),
  // conforme `listarDecisoesDaDivergencia` no repositório. Para devolver a
  // decisão resolutiva mais recente, pegamos a primeira correspondência —
  // assim retificadoras (CORRIGIDO/REVERTIDO) posteriores prevalecem sobre
  // o ACEITO original.
  const resolutivas = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"]);
  return (divergencia.decisoes || [])
    .find((decisao) => resolutivas.has(String(decisao.decisao || "").toUpperCase())) || null;
}

function obterLogDecisao(divergencia, decisaoId) {
  return (divergencia.logs || []).find((log) => (
    log.evento === "decisao_registrada"
    && JSON.stringify(log.estadoNovo || {}).includes(String(decisaoId))
  )) || null;
}

function hashAtual(divergencia) {
  return gerarHashPayloadDivergencia(divergencia);
}

function fonteObrigatoriaResumo(caminhoRelativo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  const stat = fs.statSync(caminho);
  return {
    caminho: caminhoRelativo,
    existe: true,
    tamanhoBytes: stat.size,
  };
}

function indexarPendencias(relatorio) {
  const mapa = new Map();
  for (const item of Array.isArray(relatorio.itens) ? relatorio.itens : []) {
    mapa.set(Number(item.id), item);
  }
  return mapa;
}

function indexarRegressao(relatorio) {
  const mapa = new Map();
  for (const item of Array.isArray(relatorio.achados) ? relatorio.achados : []) {
    mapa.set(Number(item.divergenciaId), item);
  }
  return mapa;
}

function agruparPayloadPorDivergencia(itens) {
  const mapa = new Map();
  for (const item of itens || []) {
    const id = Number(item.divergenciaId);
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(item);
  }
  return mapa;
}

async function montarDiagnosticoPayloadAlterado(id, entradasSeguranca, pendencia, regressao) {
  const divergencia = await revisao.obterDivergencia(id);
  const decisaoVigente = ultimoResolutivo(divergencia);
  const hashes = entradasSeguranca.map((item) => ({
    decisaoId: Number(item.decisaoId),
    hashAnterior: item.payloadHashNoMomentoDaDecisao || null,
    hashAtual: item.payloadHashAtual || hashAtual(divergencia),
    payloadPreservado: false,
    snapshotPresente: item.temSnapshot !== false,
  }));

  const logsDecisao = hashes
    .map((item) => obterLogDecisao(divergencia, item.decisaoId))
    .filter(Boolean);

  const vigentePreservado = Boolean(
    decisaoVigente &&
    !entradasSeguranca.some((item) => Number(item.decisaoId) === Number(decisaoVigente.id))
  );

  const classificacaoFinal = vigentePreservado
    ? "decisao_historica_nao_vigente_com_payload_alterado"
    : "revalidacao_humana_necessaria";

  const prioridade = vigentePreservado ? "baixa" : "alta";

  const acaoNecessaria = vigentePreservado
    ? "nenhuma_historico_preservado"
    : "registrar decisao de revalidacao em etapa posterior, se confirmada a aderencia ao PAD novo";

  const recomendacao = vigentePreservado
    ? "Decisão vigente com payload revalidado. Decisões antigas preservadas apenas para histórico."
    : "Revalidar humanamente a decisão anterior contra o payload atual; nao mascarar o hash divergente.";

  const impactoMaterial = vigentePreservado
    ? "historico_revalidado_sem_bloqueio"
    : "indeterminado_sem_payload_anterior_completo";

  return {
    id,
    numeroConvenio: divergencia.numeroConvenio,
    uf: divergencia.uf,
    tipoAlerta: divergencia.tipoAlerta,
    statusAtual: divergencia.status,
    decisaoVigente: decisaoVigente?.decisao || null,
    decisaoId: decisaoVigente?.id || null,
    decisoesComPayloadAlterado: hashes,
    payloadPreservado: vigentePreservado,
    snapshotPresente: hashes.every((item) => item.snapshotPresente),
    hashAnterior: hashes.map((item) => `#${item.decisaoId}:${item.hashAnterior}`).join("; "),
    hashAtual: hashAtual(divergencia),
    campoAlteradoInferido: divergencia.campoAfetado || "payload_tecnico",
    tipoBloqueio: "payload_alterado_apos_decisao",
    classificacaoFinal,
    classificacaoAlteracao: "dados_insuficientes",
    impactoMaterial,
    recomendacao,
    prioridade,
    acaoNecessaria,
    categoriaOperacional: pendencia?.classificacaoOperacional || null,
    classificacoesOperacionais: pendencia?.classificacoes || [],
    regressao: regressao?.classificacaoRegressao || null,
    logDecisaoRegistradaPresente: logsDecisao.length === hashes.length,
  };
}

async function montarDiagnosticoPendenciaTecnica(
  id,
  pendencia,
  regressao,
  segurancaNaoReapresentada,
  impedimentosPorChaveItem,
  diferencasCriticasPorChaveItem,
  impedimentosComparacaoPorChaveItem,
  impedimentosComparacaoPorDivergenciaId
) {
  const divergencia = await revisao.obterDivergencia(id);
  const decisaoVigente = ultimoResolutivo(divergencia);
  const snapshot = decisaoVigente?.payloadDecisao?._segurancaPreAtivacao || null;
  const atual = hashAtual(divergencia);
  const payloadPreservado = snapshot?.payloadHashNoMomentoDaDecisao
    ? snapshot.payloadHashNoMomentoDaDecisao === atual
    : null;
  const ehSaldoResidual = Boolean(pendencia?.saldoResidualTecnico);
  const naoReapresentada = Boolean(segurancaNaoReapresentada);
  const classificacoesOperacionais = pendencia?.classificacoes || [];
  const temSaldoResidualIncompativel = classificacoesOperacionais.includes(
    "saldo_residual_decisao_anterior_incompativel"
  );
  // Reconstrução ainda emite impedimento `decisao_nao_aplicavel:saldo_residual_rateio_invalido`
  // para esta chaveItem? Se sim, o efeito técnico da decisão antiga continua
  // incompatível; se não, uma retificadora (CORRIGIDO/REVERTIDO) já saneou o
  // efeito e o bloqueio residual é puramente classificatório.
  const impedimentosChave = impedimentosPorChaveItem?.get(divergencia.chaveItem) || [];
  const impedimentoSaldoResidualAtivo = impedimentosChave.some(
    (imp) => imp.tipo === "decisao_nao_aplicavel:saldo_residual_rateio_invalido"
  );
  const decisaoVigenteRetificadora = decisaoVigente
    && ["CORRIGIDO", "REVERTIDO"].includes(String(decisaoVigente.decisao || "").toUpperCase());
  const saldoResidualRetificado = temSaldoResidualIncompativel
    && decisaoVigenteRetificadora
    && !impedimentoSaldoResidualAtivo;

  const blocoSaldoResidualPendente = temSaldoResidualIncompativel && impedimentoSaldoResidualAtivo;
  const temDiferencaCriticaMaterial = (
    diferencasCriticasPorChaveItem?.get(divergencia.chaveItem)?.length || 0
  ) > 0;
  const impedimentosComparacaoChave = impedimentosComparacaoPorChaveItem?.get(divergencia.chaveItem) || [];
  const impedimentosComparacaoId = impedimentosComparacaoPorDivergenciaId?.get(id) || [];
  const impedimentosComparacaoMaterial = [...impedimentosComparacaoChave, ...impedimentosComparacaoId]
    .filter((imp) => imp?.tipo !== "decisao_nao_aplicavel:decisao_sem_efeito_definido");
  const temImpedimentoReconstrucao = impedimentosComparacaoMaterial.length > 0;
  const decisaoResolutivaValida = Boolean(
    decisaoVigente
    && ["ACEITO", "CORRIGIDO", "REVERTIDO", "REJEITADO"].includes(
      String(decisaoVigente.decisao || "").toUpperCase()
    )
  );
  const historicoNaoReapresentadoRevalidado = naoReapresentada
    && decisaoResolutivaValida
    && payloadPreservado === true
    && Boolean(snapshot)
    && Boolean(obterLogDecisao(divergencia, decisaoVigente?.id))
    && !temDiferencaCriticaMaterial
    && !temImpedimentoReconstrucao;

  let classificacaoFinal;
  let impactoMaterial;
  let recomendacao;
  let prioridade;
  let acaoNecessaria;
  if (blocoSaldoResidualPendente) {
    classificacaoFinal = "decisao_retificadora_necessaria";
    impactoMaterial = "tecnico_residual_saldo_residual_rateio_operacional";
    recomendacao = "Revalidar/retificar o efeito da decisao antiga de saldo residual para impedir rateio por area operacional.";
    prioridade = "alta";
    acaoNecessaria = "decisao_retificadora_futura_ou_neutralizacao_tecnica_do_efeito";
  } else if (saldoResidualRetificado) {
    classificacaoFinal = "bloqueio_tecnico_residual_retificado";
    impactoMaterial = "tecnico_residual_saldo_residual_saneado_por_retificadora";
    recomendacao = "Saldo residual ja saneado por decisao retificadora (CORRIGIDO/REVERTIDO); manter como historico tecnico, sem nova decisao.";
    prioridade = "media";
    acaoNecessaria = "revalidacao_tecnica_sem_decisao";
  } else if (historicoNaoReapresentadoRevalidado) {
    classificacaoFinal = "historico_nao_reapresentado_revalidado_sem_bloqueio";
    impactoMaterial = "historico_nao_reapresentado_sem_efeito_operacional_ativo";
    recomendacao = "Nao reapresentacao historica com decisao resolutiva preservada, sem diferenca critica material e sem impedimento de reconstrucao vinculado.";
    prioridade = "baixa";
    acaoNecessaria = "nenhuma_historico_revalidado";
  } else {
    classificacaoFinal = "bloqueio_tecnico_residual";
    impactoMaterial = "historico_nao_reapresentado_sem_pendencia_operacional";
    recomendacao = "Tratar como historico saneado; definir em etapa posterior se o bloqueio de nao reapresentacao pode ser baixado sem nova decisao.";
    prioridade = "media";
    acaoNecessaria = "revalidacao_tecnica_sem_decisao";
  }

  return {
    id,
    numeroConvenio: divergencia.numeroConvenio,
    uf: divergencia.uf,
    tipoAlerta: divergencia.tipoAlerta,
    statusAtual: divergencia.status,
    decisaoVigente: decisaoVigente?.decisao || null,
    decisaoId: decisaoVigente?.id || null,
    payloadPreservado,
    snapshotPresente: Boolean(snapshot),
    hashAnterior: snapshot?.payloadHashNoMomentoDaDecisao || null,
    hashAtual: atual,
    tipoBloqueio: naoReapresentada
      ? "nao_reapresentada_com_decisao_resolutiva"
      : "decisao_resolutiva_com_pendencia_tecnica",
    classificacaoFinal,
    impactoMaterial,
    recomendacao,
    prioridade,
    acaoNecessaria,
    categoriaOperacional: pendencia?.classificacaoOperacional || null,
    classificacoesOperacionais,
    regressao: regressao?.classificacaoRegressao || null,
    logDecisaoRegistradaPresente: Boolean(decisaoVigente && obterLogDecisao(divergencia, decisaoVigente.id)),
    saldoResidualTecnico: ehSaldoResidual,
    naoReapresentada,
    saldoResidualRetificado,
    temDiferencaCriticaMaterial,
    temImpedimentoReconstrucao,
  };
}

function contagemPorCampo(lista, campo) {
  const contagem = {};
  for (const item of lista) {
    const chave = item[campo] || "nao_classificado";
    contagem[chave] = (contagem[chave] || 0) + 1;
  }
  return contagem;
}

function renderTabela(lista) {
  if (!lista.length) return "- Nenhum item.";
  const linhas = [
    "| ID | Convênio/UF | Tipo | Status | Decisão | Payload preservado | Snapshot | Tipo bloqueio | Classificação final | Impacto material | Prioridade | Ação |",
    "|---:|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const item of lista) {
    linhas.push(`| #${item.id} | ${item.numeroConvenio || "-"}/${item.uf || "-"} | \`${item.tipoAlerta || "-"}\` | ${item.statusAtual || "-"} | ${item.decisaoVigente || "-"} #${item.decisaoId || "-"} | ${item.payloadPreservado === null ? "n/a" : (item.payloadPreservado ? "sim" : "não")} | ${item.snapshotPresente ? "sim" : "não"} | \`${item.tipoBloqueio}\` | \`${item.classificacaoFinal}\` | ${item.impactoMaterial} | ${item.prioridade} | ${item.acaoNecessaria} |`);
  }
  return linhas.join("\n");
}

function renderMarkdown(relatorio) {
  const r = relatorio.resumo;
  return [
    "# PROFOR 2022 - Segurança pré-ativação final (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "Auditoria somente leitura: não registra decisão, não publica, não altera origem ativa, não altera `frontend/data/publicados` e não altera o `planoAplicacao` oficial.",
    "",
    "## 1. Resumo executivo",
    "",
    `- Pendência operacional real: ${r.pendenciaOperacionalReal}`,
    `- Bloqueios técnicos de segurança pré-ativação (ativos): ${r.totalBloqueiosAtivos}`,
    `- Divergências únicas na matriz final: ${r.totalDivergenciasUnicasMatriz}`,
    `- Decisões vigentes revalidadas com sucesso (não bloqueantes): ${r.totalPayloadsRevalidados}`,
    `- Decisões vigentes com payload alterado (bloqueantes): ${r.totalPayloadsAlteradosAtivos}`,
    `- Decisões resolutivas com pendência técnica ativa: ${r.totalPendenciasTecnicasAtivas}`,
    `- Decisões resolutivas com pendência técnica retificada (não bloqueante): ${r.totalPendenciasTecnicasRetificadas}`,
    `- Apto para ativação controlada: ${r.aptoParaAtivacaoControlada ? "sim" : "não"}`,
    "",
    "## 2. Contagem por classificação final",
    "",
    "| Classificação | Qtd |",
    "|---|---:|",
    ...Object.entries(r.totalPorClassificacaoFinal).map(([chave, valor]) => `| \`${chave}\` | ${valor} |`),
    "",
    "## 3. Bloqueios ativos vigentes",
    "",
    renderTabela(relatorio.bloqueiosAtivos),
    "",
    "## 4. Histórico de decisões vigentes revalidadas (não bloqueantes)",
    "",
    renderTabela(relatorio.payloadsRevalidados),
    "",
    "## 5. Histórico de pendências técnicas retificadas (não bloqueantes)",
    "",
    renderTabela(relatorio.decisoesComPendenciaTecnicaRetificadas),
    "",
    "## 6. Conclusão",
    "",
    relatorio.conclusao,
    "",
    "## 7. Garantias",
    "",
    `- Nenhuma decisão registrada: ${relatorio.garantias.decisaoRegistrada ? "não conforme" : "conforme"}`,
    `- Nenhuma publicação executada: ${relatorio.garantias.publicacaoExecutada ? "não conforme" : "conforme"}`,
    `- Origem ativa alterada: ${relatorio.garantias.origemAtivaAlterada ? "sim" : "não"}`,
    `- Plano oficial alterado: ${relatorio.garantias.planoAplicacaoOficialAlterado ? "sim" : "não"}`,
    `- frontend/data/publicados alterado: ${relatorio.garantias.frontendDataPublicadosAlterado ? "sim" : "não"}`,
    "",
    "Rollback: reverter o commit desta auditoria e regenerar relatórios dry-run. Não apagar decisões, logs, divergências ou relatórios históricos.",
  ].join("\n") + "\n";
}

async function executar() {
  const fontes = Object.fromEntries(
    Object.entries(FONTES).map(([nome, caminho]) => [nome, fonteObrigatoriaResumo(caminho)])
  );
  // Leitura explícita dos Markdown obrigatórios para validar disponibilidade.
  lerTexto(FONTES.pendenciasMd);
  lerTexto(FONTES.segurancaDetalhadaMd);
  lerTexto(FONTES.comparacaoMd);
  lerTexto(FONTES.regressaoMd);

  const pendencias = lerJson(FONTES.pendenciasJson);
  const seguranca = lerJson(FONTES.segurancaJson);
  const segurancaDetalhada = lerJson(FONTES.segurancaDetalhadaJson);
  const reconstrucao = lerJson(FONTES.reconstrucaoJson);
  const comparacao = lerJson(FONTES.comparacaoJson);
  const regressao = lerJson(FONTES.regressaoJson);

  const pendenciasPorId = indexarPendencias(pendencias);
  const regressaoPorId = indexarRegressao(regressao);
  const payloadPorDivergencia = agruparPayloadPorDivergencia(seguranca.payloadAlteradoAposDecisao);
  const naoReapPorId = new Map((seguranca.divergenciasNaoReapresentadas || []).map((item) => [Number(item.divergenciaId), item]));
  const impedimentosPorChaveItem = new Map();
  const diferencasCriticasPorChaveItem = new Map();
  const impedimentosComparacaoPorChaveItem = new Map();
  const impedimentosComparacaoPorDivergenciaId = new Map();
  for (const imp of Array.isArray(reconstrucao.impedimentos) ? reconstrucao.impedimentos : []) {
    if (!imp?.chaveItem) continue;
    if (!impedimentosPorChaveItem.has(imp.chaveItem)) impedimentosPorChaveItem.set(imp.chaveItem, []);
    impedimentosPorChaveItem.get(imp.chaveItem).push(imp);
  }
  for (const dif of Array.isArray(comparacao.diferencasCriticas) ? comparacao.diferencasCriticas : []) {
    if (!dif?.chaveItem) continue;
    if (!diferencasCriticasPorChaveItem.has(dif.chaveItem)) diferencasCriticasPorChaveItem.set(dif.chaveItem, []);
    diferencasCriticasPorChaveItem.get(dif.chaveItem).push(dif);
  }
  for (const imp of Array.isArray(comparacao.impedimentosReconstrucao) ? comparacao.impedimentosReconstrucao : []) {
    if (imp?.chaveItem) {
      if (!impedimentosComparacaoPorChaveItem.has(imp.chaveItem)) {
        impedimentosComparacaoPorChaveItem.set(imp.chaveItem, []);
      }
      impedimentosComparacaoPorChaveItem.get(imp.chaveItem).push(imp);
    }
    if (Number.isFinite(Number(imp?.divergenciaId))) {
      const did = Number(imp.divergenciaId);
      if (!impedimentosComparacaoPorDivergenciaId.has(did)) {
        impedimentosComparacaoPorDivergenciaId.set(did, []);
      }
      impedimentosComparacaoPorDivergenciaId.get(did).push(imp);
    }
  }

  const payloadAlteradoAposDecisao = [];
  for (const id of IDS_PAYLOAD_ALTERADO_ESPERADOS) {
    payloadAlteradoAposDecisao.push(await montarDiagnosticoPayloadAlterado(
      id,
      payloadPorDivergencia.get(id) || [],
      pendenciasPorId.get(id),
      regressaoPorId.get(id)
    ));
  }

  const decisoesResolutivasComPendenciaTecnica = [];
  for (const id of IDS_PENDENCIA_TECNICA_ESPERADOS) {
    decisoesResolutivasComPendenciaTecnica.push(await montarDiagnosticoPendenciaTecnica(
      id,
      pendenciasPorId.get(id),
      regressaoPorId.get(id),
      naoReapPorId.get(id),
      impedimentosPorChaveItem,
      diferencasCriticasPorChaveItem,
      impedimentosComparacaoPorChaveItem,
      impedimentosComparacaoPorDivergenciaId
    ));
  }

  const matrizMap = new Map();
  for (const item of [...payloadAlteradoAposDecisao, ...decisoesResolutivasComPendenciaTecnica]) {
    matrizMap.set(item.id, item);
  }
  const matrizFinal = Array.from(matrizMap.values()).sort((a, b) => a.id - b.id);

  const bloqueiosAtivos = matrizFinal.filter(
    (item) =>
      item.classificacaoFinal !== "decisao_historica_nao_vigente_com_payload_alterado" &&
      item.classificacaoFinal !== "bloqueio_tecnico_residual_retificado" &&
      item.classificacaoFinal !== "historico_nao_reapresentado_revalidado_sem_bloqueio"
  );

  const payloadsRevalidados = payloadAlteradoAposDecisao.filter(
    (item) => item.payloadPreservado === true
  );

  const payloadsAlteradosAtivos = payloadAlteradoAposDecisao.filter(
    (item) => item.payloadPreservado === false
  );

  const decisoesComPendenciaTecnicaAtivas = decisoesResolutivasComPendenciaTecnica.filter(
    (item) =>
      item.classificacaoFinal !== "bloqueio_tecnico_residual_retificado" &&
      item.classificacaoFinal !== "historico_nao_reapresentado_revalidado_sem_bloqueio"
  );

  const decisoesComPendenciaTecnicaRetificadas = decisoesResolutivasComPendenciaTecnica.filter(
    (item) => item.classificacaoFinal === "bloqueio_tecnico_residual_retificado"
  );

  const resumo = {
    pendenciaOperacionalReal: pendencias.resumo?.separacaoOperacional?.pendenciaOperacionalReal ?? null,
    totalBloqueiosSeguranca: seguranca.resumo?.totalBloqueiosAtivacao ?? null,
    totalBloqueiosDetalhados: segurancaDetalhada.resumo?.totalBloqueios ?? null,
    totalDivergenciasUnicasMatriz: matrizFinal.length,
    totalBloqueiosAtivos: bloqueiosAtivos.length,
    totalPayloadsRevalidados: payloadsRevalidados.length,
    totalPayloadsAlteradosAtivos: payloadsAlteradosAtivos.length,
    totalPendenciasTecnicasAtivas: decisoesComPendenciaTecnicaAtivas.length,
    totalPendenciasTecnicasRetificadas: decisoesComPendenciaTecnicaRetificadas.length,
    totalDecisoesPayloadAlterado: seguranca.payloadAlteradoAposDecisao?.length || 0,
    totalDivergenciasPayloadAlterado: payloadAlteradoAposDecisao.length,
    totalDecisoesResolutivasComPendenciaTecnica: decisoesResolutivasComPendenciaTecnica.length,
    totalPorClassificacaoFinal: contagemPorCampo(matrizFinal, "classificacaoFinal"),
    totalPorTipoBloqueio: contagemPorCampo(matrizFinal, "tipoBloqueio"),
    divergencia44ClassificacaoOperacional: pendenciasPorId.get(44)?.classificacaoOperacional || null,
    aptoParaAtivacaoControlada: (
      (pendencias.resumo?.separacaoOperacional?.pendenciaOperacionalReal ?? 1) === 0 &&
      bloqueiosAtivos.length === 0 &&
      payloadsAlteradosAtivos.length === 0
    ),
    reconstrucaoApta: Boolean(reconstrucao.aptoParaAtivacao),
    comparacaoApta: Boolean(comparacao.aptoParaPublicacao),
  };

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    regraNegocio: "PAD_NOVO_PREVALECE_INTEGRALMENTE",
    fontes,
    resumo,
    bloqueiosAtivos,
    payloadsRevalidados,
    payloadsAlteradosAtivos,
    decisoesComPendenciaTecnicaRetificadas,
    payloadAlteradoAposDecisao,
    decisoesResolutivasComPendenciaTecnica,
    matrizFinal,
    conclusao: resumo.aptoParaAtivacaoControlada
      ? "Apto para ativacao controlada do ponto de vista da seguranca pre-ativacao (dry-run): sem pendencia operacional real e sem bloqueios tecnicos ativos. Isso nao autoriza ativacao nem publicacao nesta etapa."
      : "Nao apto para ativacao controlada nesta etapa: a pendencia operacional real esta zerada, mas permanecem bloqueios tecnicos de seguranca pre-ativacao que exigem revalidacao humana ou tratamento tecnico posterior. Nenhuma publicacao deve ser executada.",
    garantias: {
      decisaoRegistrada: false,
      statusAlterado: false,
      publicacaoExecutada: false,
      origemAtivaAlterada: false,
      planoAplicacaoOficialAlterado: false,
      frontendDataPublicadosAlterado: false,
    },
  };

  escreverJson(SAIDA_JSON, relatorio);
  escreverTexto(SAIDA_MD, renderMarkdown(relatorio));

  console.log("Auditoria final de segurança pré-ativação PAD/PROFOR 2022 concluída (dry-run).");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Pendência operacional real: ${resumo.pendenciaOperacionalReal}`);
  console.log(`Bloqueios técnicos de segurança: ${resumo.totalBloqueiosSeguranca}`);
  console.log(`Divergências únicas na matriz final: ${resumo.totalDivergenciasUnicasMatriz}`);
  console.log(`Apto para ativação controlada: ${resumo.aptoParaAtivacaoControlada ? "sim" : "não"}`);
}

async function main() {
  await executar();
}

if (require.main === module) {
  main().catch((erro) => {
    console.error("Falha na auditoria final de segurança pré-ativação PAD/PROFOR 2022.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  });
}

module.exports = {
  ultimoResolutivo,
  montarDiagnosticoPendenciaTecnica,
};
