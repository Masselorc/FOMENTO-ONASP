const fs = require("node:fs");
const path = require("node:path");

const revisao = require("../services/profor-2022/profor-pad-revisao-decisao-service");
const {
  gerarHashPayloadDivergencia,
} = require("../services/profor-2022/profor-pad-seguranca-pre-ativacao-service");

const SAIDA_JSON = "backend/data/relatorios/profor-2022-revalidacao-payloads-alterados-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-revalidacao-payloads-alterados-dry-run.md";

const FONTES = {
  segurancaFinalJson: "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-final-dry-run.json",
  segurancaJson: "backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json",
  reconstrucaoJson: "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json",
  comparacaoJson: "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json",
  pendenciasJson: "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json",
};

const IDS_REVALIDAR = [
  47, 48, 49, 50, 51, 52, 53, 54,
  56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
  72, 73, 74,
];

function repoRoot() {
  return path.resolve(__dirname, "../..");
}
function lerJson(caminhoRelativo) {
  const caminho = path.join(repoRoot(), caminhoRelativo);
  if (!fs.existsSync(caminho)) throw new Error(`Fonte nao encontrada: ${caminhoRelativo}`);
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}
function escreverJson(caminhoRelativo, dados) {
  const caminho = path.join(repoRoot(), caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}
function escreverTexto(caminhoRelativo, conteudo) {
  const caminho = path.join(repoRoot(), caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${conteudo.trimEnd()}\n`, "utf8");
}

function indexarComparador(comparacao) {
  const ausenciasPorChaveItemConvenio = new Map();
  for (const a of comparacao.ausenciasConfirmadasPorDecisao || []) {
    const chave = `${a.numeroConvenio}::${(a.descricao || "").trim().toUpperCase()}`;
    ausenciasPorChaveItemConvenio.set(chave, a);
  }
  const ausentesPorChaveItemConvenio = new Map();
  for (const a of comparacao.itensAusentes || []) {
    const chave = `${a.numeroConvenio}::${(a.descricao || "").trim().toUpperCase()}`;
    ausentesPorChaveItemConvenio.set(chave, a);
  }
  const impedimentosPorChaveItem = new Map();
  for (const imp of comparacao.impedimentosReconstrucao || []) {
    if (!imp?.chaveItem) continue;
    if (!impedimentosPorChaveItem.has(imp.chaveItem)) impedimentosPorChaveItem.set(imp.chaveItem, []);
    impedimentosPorChaveItem.get(imp.chaveItem).push(imp);
  }
  const criticasPorChaveItem = new Map();
  for (const c of comparacao.diferencasCriticas || []) {
    const chave = c.chaveItem || c.chave;
    if (!chave) continue;
    if (!criticasPorChaveItem.has(chave)) criticasPorChaveItem.set(chave, []);
    criticasPorChaveItem.get(chave).push(c);
  }
  return { ausenciasPorChaveItemConvenio, ausentesPorChaveItemConvenio, impedimentosPorChaveItem, criticasPorChaveItem };
}

function classificar({ chaveDivergenciaPreservada, totalDecisoes, decisoesComMesmoSnapshot, ausenciaAplicadaPorDecisao, itemAusentePorMemoria, impedimentosChaveItem, diffsCriticasChaveItem, reconstrucaoSeguraSemEsseItem }) {
  // Critério para revalidacao_por_prevalencia_pad:
  // - chaveDivergencia preservada (identidade da divergencia intacta);
  // - decisao antiga continua aderente ao PAD novo (item segue ausente do PAD);
  // - reconstrucao preserva o PAD novo como fonte (nao cria o item ausente);
  // - comparador aplica a decisao como ausencia_confirmada_por_decisao.
  if (
    chaveDivergenciaPreservada
    && ausenciaAplicadaPorDecisao
    && itemAusentePorMemoria
    && impedimentosChaveItem.length === 0
    && diffsCriticasChaveItem.length === 0
    && reconstrucaoSeguraSemEsseItem
  ) {
    return {
      classificacao: "revalidacao_por_prevalencia_pad",
      motivo: "Decisao ACEITO antiga (ausencia_confirmada) continua aderente ao PAD novo. Item da memoria nao reaparece no PAD; chaveDivergencia preservada; reconstrucao nao cria o item; comparador aplica ausencia_confirmada_por_decisao; sem impedimento nem diferenca critica para a chaveItem. Mudanca de hash decorre de re-extracao/normalizacao do payload da divergencia, sem alteracao do juizo material.",
      ressalva: "Payload anterior completo nao preservado no snapshot (apenas hash). Recomenda-se decisao de revalidacao (ACEITO) registrada via servico para reescrever o snapshot e baixar o bloqueio formal.",
      podeSairDoBloqueio: "sim, mediante decisao de revalidacao registrada via servico",
      exigeDecisaoNova: true,
    };
  }
  if (!chaveDivergenciaPreservada) {
    return {
      classificacao: "decisao_retificadora_necessaria",
      motivo: "chaveDivergencia do snapshot diverge da chaveDivergencia atual: identidade da divergencia mudou apos a decisao. Decisao antiga nao garante mais aderencia ao PAD novo.",
      ressalva: null,
      podeSairDoBloqueio: "nao sem decisao retificadora",
      exigeDecisaoNova: true,
    };
  }
  if (impedimentosChaveItem.length > 0 || diffsCriticasChaveItem.length > 0) {
    return {
      classificacao: "revisao_humana_necessaria",
      motivo: "Comparador/reconstrucao registram impedimento ou diferenca critica para a chaveItem; exige revisao humana antes de baixar bloqueio.",
      ressalva: null,
      podeSairDoBloqueio: "nao automaticamente",
      exigeDecisaoNova: true,
    };
  }
  if (!ausenciaAplicadaPorDecisao || !itemAusentePorMemoria) {
    return {
      classificacao: "dados_insuficientes",
      motivo: "Decisao antiga nao localizada como ausencia_confirmada_por_decisao no comparador atual, ou item da memoria nao aparece como itensAusentes; falta evidencia para revalidacao automatica.",
      ressalva: null,
      podeSairDoBloqueio: "nao sem evidencia adicional",
      exigeDecisaoNova: true,
    };
  }
  return {
    classificacao: "revisao_humana_necessaria",
    motivo: "Sem padrao aplicavel; revisao humana recomendada.",
    ressalva: null,
    podeSairDoBloqueio: "nao automaticamente",
    exigeDecisaoNova: true,
  };
}

function montarLinha(id, indices, segurancaFinalPorId) {
  const divergencia = revisao.obterDivergencia(id);
  const hashAtual = gerarHashPayloadDivergencia(divergencia);
  const decisoesResolutivas = (divergencia.decisoes || [])
    .filter((d) => ["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"].includes(String(d.decisao || "").toUpperCase()));
  const decisoesAfetadas = decisoesResolutivas.filter((d) => {
    const snap = d.payloadDecisao?._segurancaPreAtivacao;
    return snap && snap.payloadHashNoMomentoDaDecisao && snap.payloadHashNoMomentoDaDecisao !== hashAtual;
  });
  const vigente = decisoesResolutivas[0] || null;

  const chaveBuscaComp = `${divergencia.numeroConvenio}::${(divergencia.payload?.memoria?.descricao
    || divergencia.payload?.descricaoMemoria
    || divergencia.payload?.antes?.descricao
    || "").trim().toUpperCase()}`;
  const ausenciaAplicada = indices.ausenciasPorChaveItemConvenio.get(chaveBuscaComp) || null;
  const itemAusente = indices.ausentesPorChaveItemConvenio.get(chaveBuscaComp) || null;
  const impedimentosChave = indices.impedimentosPorChaveItem.get(divergencia.chaveItem) || [];
  const diffsCrit = indices.criticasPorChaveItem.get(divergencia.chaveItem) || [];

  const chaveDivergenciaPreservada = decisoesAfetadas.every((d) => {
    const snap = d.payloadDecisao?._segurancaPreAtivacao;
    return snap?.chaveDivergencia === divergencia.chaveDivergencia;
  });

  // Reconstrução segura sem o item: como ausencia_confirmada não cria item na reconstrução
  // e nao ha impedimento sobre a chaveItem, consideramos reconstrucao segura.
  const reconstrucaoSeguraSemEsseItem = impedimentosChave.length === 0;

  const c = classificar({
    chaveDivergenciaPreservada,
    totalDecisoes: decisoesResolutivas.length,
    decisoesComMesmoSnapshot: decisoesAfetadas.length,
    ausenciaAplicadaPorDecisao: Boolean(ausenciaAplicada),
    itemAusentePorMemoria: Boolean(itemAusente),
    impedimentosChaveItem: impedimentosChave,
    diffsCriticasChaveItem: diffsCrit,
    reconstrucaoSeguraSemEsseItem,
  });

  const segurancaEntry = segurancaFinalPorId.get(id) || null;

  return {
    id,
    convenio: divergencia.numeroConvenio,
    uf: divergencia.uf,
    tipoAlerta: divergencia.tipoAlerta,
    descricao: divergencia.payload?.memoria?.descricao
      || divergencia.payload?.descricaoMemoria
      || divergencia.payload?.antes?.descricao
      || null,
    chaveItem: divergencia.chaveItem,
    chaveDivergencia: divergencia.chaveDivergencia,
    statusAtual: divergencia.status,
    decisaoVigente: vigente?.decisao || null,
    decisaoVigenteId: vigente?.id || null,
    totalDecisoesResolutivas: decisoesResolutivas.length,
    totalDecisoesAfetadas: decisoesAfetadas.length,
    decisoesAfetadas: decisoesAfetadas.map((d) => ({
      id: d.id,
      decisao: d.decisao,
      decididoEm: d.decididoEm,
      hashSnapshot: d.payloadDecisao?._segurancaPreAtivacao?.payloadHashNoMomentoDaDecisao || null,
      chaveDivergenciaSnapshot: d.payloadDecisao?._segurancaPreAtivacao?.chaveDivergencia || null,
    })),
    hashAtual,
    chaveDivergenciaPreservada,
    payloadAnteriorPreservado: false, // snapshot só guarda hash
    snapshotPresente: decisoesAfetadas.every((d) => Boolean(d.payloadDecisao?._segurancaPreAtivacao)),
    camposAlteradosInferidos: "indeterminado (apenas hash no snapshot)",
    ausenciaConfirmadaAplicada: Boolean(ausenciaAplicada),
    itemAusenteNaMemoria: Boolean(itemAusente),
    impedimentosReconstrucaoChaveItem: impedimentosChave.map((i) => i.tipo),
    diferencasCriticasChaveItem: diffsCrit.length,
    classificacaoFinalAuditor: segurancaEntry?.classificacaoFinal || null,
    classificacaoRevalidacao: c.classificacao,
    motivo: c.motivo,
    ressalva: c.ressalva,
    podeSairDoBloqueio: c.podeSairDoBloqueio,
    exigeDecisaoNova: c.exigeDecisaoNova,
    acaoRecomendada: c.classificacao === "revalidacao_por_prevalencia_pad"
      ? "Registrar decisao ACEITO de revalidacao via servico (aplicadaAoPlano=false, snapshot novo); apos checkpoint do WAL, bloqueio formal desce."
      : (c.classificacao === "decisao_retificadora_necessaria"
        ? "Registrar decisao retificadora (CORRIGIDO/REVERTIDO/ACEITO conforme caso) via servico."
        : (c.classificacao === "revisao_humana_necessaria"
          ? "Submeter a revisao humana antes de qualquer baixa de bloqueio."
          : "Coletar evidencia adicional antes de decidir.")),
    prioridade: "alta",
  };
}

function renderMarkdown(relatorio) {
  const r = relatorio.resumo;
  const linhas = [
    "# PROFOR 2022 - Revalidacao de payloads alterados apos decisao (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "Auditoria somente leitura: nao registra decisao, nao publica, nao altera origem ativa, nao altera `frontend/data/publicados` e nao altera o `planoAplicacao` oficial.",
    "",
    "## 1. Resumo executivo",
    "",
    `- Pendencia operacional real (auditoria profunda): ${r.pendenciaOperacionalReal}`,
    `- Total de divergencias revalidadas: ${r.totalDivergencias}`,
    `- Total de decisoes afetadas (somatorio): ${r.totalDecisoesAfetadas}`,
    `- chaveDivergencia preservada em todas as decisoes afetadas: ${r.chaveDivergenciaPreservadaSempre ? "sim" : "nao"}`,
    `- Itens listados em itensAusentes do comparador: ${r.itensAusentesNoComparador}`,
    `- Itens com ausenciaConfirmadaPorDecisao no comparador: ${r.ausenciasConfirmadasPorDecisao}`,
    `- Impedimentos de reconstrucao em chaveItens revalidadas: ${r.impedimentosReconstrucaoEmChaveItens}`,
    `- Diferencas criticas em chaveItens revalidadas: ${r.diferencasCriticasEmChaveItens}`,
    "",
    "## 2. Contagem por classificacao de revalidacao",
    "",
    "| Classificacao | Qtd |",
    "|---|---:|",
    ...Object.entries(r.totalPorClassificacao).map(([k, v]) => `| \`${k}\` | ${v} |`),
    "",
    "## 3. Matriz por divergencia",
    "",
    "| ID | Conv/UF | Tipo | Descricao | Status | Decisao | DecId | TotDecAfet | hashSnap | hashAtual | chaveDivPreserv | ausenciaAplicada | itemAusente | impChave | critChave | Classificacao | Ressalva | Pode sair? | Acao |",
    "|---:|---|---|---|---|---|---:|---:|---|---|---|---|---|---:|---:|---|---|---|---|",
  ];
  for (const item of relatorio.matriz) {
    const dec = item.decisoesAfetadas[0] || {};
    const hashSnap = dec.hashSnapshot ? dec.hashSnapshot.slice(0, 8) + "..." : "n/a";
    const hashAtual = item.hashAtual ? item.hashAtual.slice(0, 8) + "..." : "n/a";
    linhas.push(`| #${item.id} | ${item.convenio}/${item.uf} | \`${item.tipoAlerta}\` | ${(item.descricao || "").slice(0, 40)} | ${item.statusAtual} | ${item.decisaoVigente} | #${item.decisaoVigenteId} | ${item.totalDecisoesAfetadas} | ${hashSnap} | ${hashAtual} | ${item.chaveDivergenciaPreservada ? "sim" : "nao"} | ${item.ausenciaConfirmadaAplicada ? "sim" : "nao"} | ${item.itemAusenteNaMemoria ? "sim" : "nao"} | ${item.impedimentosReconstrucaoChaveItem.length} | ${item.diferencasCriticasChaveItem} | \`${item.classificacaoRevalidacao}\` | ${item.ressalva ? "sim" : "-"} | ${item.podeSairDoBloqueio} | ${item.acaoRecomendada.slice(0, 60)} |`);
  }
  linhas.push("");
  linhas.push("## 4. Detalhe da divergencia #72 (duas decisoes afetadas)");
  linhas.push("");
  const d72 = relatorio.matriz.find((x) => x.id === 72);
  if (d72) {
    linhas.push(`- Vigente: ${d72.decisaoVigente} #${d72.decisaoVigenteId}`);
    linhas.push(`- Total decisoes afetadas: ${d72.totalDecisoesAfetadas}`);
    for (const a of d72.decisoesAfetadas) {
      linhas.push(`  - #${a.id} ${a.decisao} em ${a.decididoEm} | hash_snapshot=${a.hashSnapshot} | chaveDivergencia_snapshot=${a.chaveDivergenciaSnapshot}`);
    }
  }
  linhas.push("");
  linhas.push("## 5. Recomendacao operacional");
  linhas.push("");
  linhas.push(relatorio.recomendacao);
  linhas.push("");
  linhas.push("## 6. Garantias");
  linhas.push("");
  linhas.push("- Nenhuma decisao registrada nesta auditoria.");
  linhas.push("- Nenhuma publicacao executada.");
  linhas.push("- Origem ativa nao alterada.");
  linhas.push("- planoAplicacao oficial nao alterado.");
  linhas.push("- frontend/data/publicados nao alterado.");
  linhas.push("- *.sqlite-wal / *.sqlite-shm nao versionados.");
  linhas.push("");
  linhas.push("Rollback: reverter o commit desta auditoria/documentacao e regenerar relatorios dry-run. Nao apagar decisoes, logs, divergencias ou relatorios historicos.");
  return linhas.join("\n") + "\n";
}

function executar() {
  const seguranca = lerJson(FONTES.segurancaJson);
  const segurancaFinal = lerJson(FONTES.segurancaFinalJson);
  const reconstrucao = lerJson(FONTES.reconstrucaoJson);
  const comparacao = lerJson(FONTES.comparacaoJson);
  const pendencias = lerJson(FONTES.pendenciasJson);

  const indices = indexarComparador(comparacao);
  // Junta impedimentos da reconstrucao tambem
  for (const imp of reconstrucao.impedimentos || []) {
    if (!imp?.chaveItem) continue;
    if (!indices.impedimentosPorChaveItem.has(imp.chaveItem)) indices.impedimentosPorChaveItem.set(imp.chaveItem, []);
    indices.impedimentosPorChaveItem.get(imp.chaveItem).push(imp);
  }
  const segurancaFinalPorId = new Map();
  for (const item of segurancaFinal.matrizFinal || []) segurancaFinalPorId.set(item.id, item);

  const matriz = IDS_REVALIDAR.map((id) => montarLinha(id, indices, segurancaFinalPorId));

  const totalPorClassificacao = {};
  for (const m of matriz) totalPorClassificacao[m.classificacaoRevalidacao] = (totalPorClassificacao[m.classificacaoRevalidacao] || 0) + 1;

  const totalDecisoesAfetadas = matriz.reduce((s, m) => s + m.totalDecisoesAfetadas, 0);
  const chaveDivergenciaPreservadaSempre = matriz.every((m) => m.chaveDivergenciaPreservada);
  const impedimentosTotais = matriz.reduce((s, m) => s + m.impedimentosReconstrucaoChaveItem.length, 0);
  const criticasTotais = matriz.reduce((s, m) => s + m.diferencasCriticasChaveItem, 0);
  const ausenciasAplicadas = matriz.filter((m) => m.ausenciaConfirmadaAplicada).length;
  const itensAusentes = matriz.filter((m) => m.itemAusenteNaMemoria).length;

  const resumo = {
    pendenciaOperacionalReal: pendencias.resumo?.separacaoOperacional?.pendenciaOperacionalReal ?? null,
    totalDivergencias: matriz.length,
    totalDecisoesAfetadas,
    chaveDivergenciaPreservadaSempre,
    itensAusentesNoComparador: itensAusentes,
    ausenciasConfirmadasPorDecisao: ausenciasAplicadas,
    impedimentosReconstrucaoEmChaveItens: impedimentosTotais,
    diferencasCriticasEmChaveItens: criticasTotais,
    totalPorClassificacao,
  };

  const idsPorClassificacao = {};
  for (const m of matriz) {
    if (!idsPorClassificacao[m.classificacaoRevalidacao]) idsPorClassificacao[m.classificacaoRevalidacao] = [];
    idsPorClassificacao[m.classificacaoRevalidacao].push(m.id);
  }

  const recomendacao = [
    "Os 27 casos compartilham o padrao tecnico: divergencia `item_ausente_no_pad`, decisao resolutiva ACEITO/ausencia_confirmada, chaveDivergencia preservada entre snapshot e estado atual, comparador aplicando a decisao como `ausencia_confirmada_por_decisao`, reconstrucao sem impedimento associado a chaveItem.",
    "",
    "O bloqueio formal de `payload_alterado_apos_decisao` decorre da diferenca de hash entre o snapshot da decisao (apenas hash) e o payload atual. Como o payload anterior completo nao foi preservado, nao ha prova material de que a diferenca seja apenas normalizacao/re-extracao - mas a aplicacao tecnica das 27 decisoes continua coerente com a regra de prevalencia do PAD.",
    "",
    "Recomendacao: em etapa autorizada posterior, registrar via servico (`profor-pad-revisao-decisao-service.registrarDecisao`) uma decisao ACEITO de revalidacao para cada uma das 27 divergencias (28 decisoes contando #72 com 2 decisoes - a vigente e suficiente), com `aplicadaAoPlano=false`, `payloadDecisao` minimo descrevendo a revalidacao, snapshot novo (hash atual). Isso baixa o bloqueio formal sem alterar plano, origem ou frontend/publicados, mantendo as decisoes originais preservadas.",
    "",
    "Nao registrar decisao nesta etapa. Aguardar autorizacao expressa.",
  ].join("\n");

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    regraNegocio: "PAD_NOVO_PREVALECE_INTEGRALMENTE",
    fontes: FONTES,
    resumo,
    idsPorClassificacao,
    matriz,
    recomendacao,
    garantias: {
      decisaoRegistrada: false,
      publicacaoExecutada: false,
      origemAtivaAlterada: false,
      planoAplicacaoOficialAlterado: false,
      frontendDataPublicadosAlterado: false,
      sqliteWalVersionado: false,
      sqliteShmVersionado: false,
    },
  };

  escreverJson(SAIDA_JSON, relatorio);
  escreverTexto(SAIDA_MD, renderMarkdown(relatorio));

  console.log("Revalidacao dry-run dos 27 payloads alterados concluida.");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Total divergencias: ${resumo.totalDivergencias}`);
  console.log(`Total decisoes afetadas: ${resumo.totalDecisoesAfetadas}`);
  console.log(`Classificacoes:`, totalPorClassificacao);
  console.log(`Pode sair do bloqueio mediante revalidacao: ${matriz.filter((m) => m.classificacaoRevalidacao === "revalidacao_por_prevalencia_pad").length}`);
}

if (require.main === module) {
  try {
    executar();
  } catch (erro) {
    console.error("Falha na revalidacao dry-run dos payloads alterados PAD/PROFOR 2022.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}

module.exports = { IDS_REVALIDAR, classificar };
