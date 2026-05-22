const fs = require("node:fs");
const path = require("node:path");

const db = require("../db/database");

const ENTRADA = "backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json";
const SAIDA_JSON = "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-detalhada-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-seguranca-pre-ativacao-detalhada-dry-run.md";

const DECISOES_RESOLUTIVAS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"]);

function repoRoot() {
  return path.resolve(__dirname, "../..");
}

function caminhoAbsoluto(caminhoRelativo) {
  return path.join(repoRoot(), caminhoRelativo);
}

function lerJson(caminhoRelativo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  if (!fs.existsSync(caminho)) {
    throw new Error(`Relatório de entrada não encontrado: ${caminhoRelativo}. Execute antes 'npm run profor:pad:seguranca-pre-ativacao:dry-run'.`);
  }
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
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

function garantirArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function carregarDivergencias() {
  const linhas = db.prepare(`
    SELECT id, chave_divergencia, numero_convenio, uf, tipo_alerta, campo_afetado,
           status, nivel, bloqueia_publicacao
    FROM profor_2022_revisao_divergencias
  `).all();
  const mapa = new Map();
  for (const linha of linhas) mapa.set(linha.id, linha);
  return mapa;
}

function carregarDecisoes() {
  const linhas = db.prepare(`
    SELECT id, divergencia_id, decisao, usuario, decidido_em, criado_em
    FROM profor_2022_revisao_decisoes
    ORDER BY id
  `).all();
  const porDivergencia = new Map();
  const porId = new Map();
  for (const linha of linhas) {
    porId.set(linha.id, linha);
    if (!porDivergencia.has(linha.divergencia_id)) porDivergencia.set(linha.divergencia_id, []);
    porDivergencia.get(linha.divergencia_id).push(linha);
  }
  return { porDivergencia, porId };
}

function ultimaDecisaoResolutiva(decisoes) {
  const resolutivas = garantirArray(decisoes).filter((d) => DECISOES_RESOLUTIVAS.has(String(d.decisao || "").toUpperCase()));
  return resolutivas.length ? resolutivas[resolutivas.length - 1] : null;
}

// Heurística: a mudança de payload após a decisão decorre da correção do parser
// de quantidade quando o alerta/campo afetado está ligado a quantidade/valor.
function inferirOrigemMudanca(tipoAlerta, campoAfetado) {
  const texto = `${tipoAlerta || ""} ${campoAfetado || ""}`.toLowerCase();
  if (/quantidade|valor_unitario|valor unit|inconsistente/.test(texto)) {
    return "provavel_correcao_parser_quantidade";
  }
  if (/ausente|equivalencia|descricao|rateio|saldo|valor/.test(texto)) {
    return "provavel_reextracao_ou_regeracao_pad";
  }
  return "indeterminada";
}

function detalharPayloadAlterado(itensSeguranca, divergencias, decisoesPorId) {
  return garantirArray(itensSeguranca).map((item) => {
    const divergencia = divergencias.get(Number(item.divergenciaId)) || {};
    const decisao = decisoesPorId.get(Number(item.decisaoId)) || {};
    const origem = inferirOrigemMudanca(item.tipoAlerta || divergencia.tipo_alerta, item.campoAfetado || divergencia.campo_afetado);
    return {
      tipoBloqueio: "payload_alterado_apos_decisao",
      divergenciaId: Number(item.divergenciaId),
      decisaoId: Number(item.decisaoId),
      chaveDivergencia: item.chaveDivergencia || divergencia.chave_divergencia || null,
      tipoAlerta: item.tipoAlerta || divergencia.tipo_alerta || null,
      campoAfetado: item.campoAfetado || divergencia.campo_afetado || null,
      numeroConvenio: divergencia.numero_convenio || null,
      uf: divergencia.uf || null,
      statusAtual: divergencia.status || null,
      bloqueiaPublicacao: Boolean(divergencia.bloqueia_publicacao),
      decisaoValor: item.decisao || decisao.decisao || null,
      usuarioDecisao: item.usuario || decisao.usuario || null,
      dataDecisao: item.decididoEm || decisao.decidido_em || null,
      motivoBloqueio: "Payload da divergência mudou após a decisão; a decisão precisa ser revalidada.",
      temSnapshot: item.temSnapshot !== false,
      payloadHashNoMomentoDaDecisao: item.payloadHashNoMomentoDaDecisao || null,
      payloadHashAtual: item.payloadHashAtual || null,
      origemProvavelMudanca: origem,
      pareceCorrecaoParserQuantidade: origem === "provavel_correcao_parser_quantidade",
      exigeRevalidacaoHumana: true,
      prioridadeTratamento: "alta",
    };
  });
}

function detalharNaoReapresentadas(itensSeguranca, divergencias, decisoesPorDivergencia) {
  return garantirArray(itensSeguranca).map((item) => {
    const divergencia = divergencias.get(Number(item.divergenciaId)) || {};
    const decisao = ultimaDecisaoResolutiva(decisoesPorDivergencia.get(Number(item.divergenciaId))) || {};
    return {
      tipoBloqueio: "nao_reapresentada_com_decisao_resolutiva",
      divergenciaId: Number(item.divergenciaId),
      decisaoId: decisao.id ? Number(decisao.id) : null,
      chaveDivergencia: item.chaveDivergencia || divergencia.chave_divergencia || null,
      tipoAlerta: item.tipoAlerta || divergencia.tipo_alerta || null,
      campoAfetado: divergencia.campo_afetado || null,
      numeroConvenio: item.numeroConvenio || divergencia.numero_convenio || null,
      uf: item.uf || divergencia.uf || null,
      statusAtual: divergencia.status || item.status || null,
      bloqueiaPublicacao: Boolean(divergencia.bloqueia_publicacao ?? item.bloqueiaPublicacao),
      decisaoValor: decisao.decisao || null,
      usuarioDecisao: decisao.usuario || null,
      dataDecisao: decisao.decidido_em || null,
      motivoBloqueio: "Divergência com decisão resolutiva não foi reapresentada na geração atual da fila; tratar como histórico antes da ativação.",
      origemProvavelMudanca: "historico_nao_reapresentado_na_geracao_atual",
      pareceCorrecaoParserQuantidade: false,
      exigeRevalidacaoHumana: false,
      exigeAvaliacaoHistorica: true,
      prioridadeTratamento: "media",
    };
  });
}

function montarPlanoRevalidacao(payloadAlterado, naoReapresentadas) {
  const idsPayload = Array.from(new Set(payloadAlterado.map((i) => i.divergenciaId))).sort((a, b) => a - b);
  const idsNaoReap = Array.from(new Set(naoReapresentadas.map((i) => i.divergenciaId))).sort((a, b) => a - b);
  return [
    {
      grupo: "1_bloqueios_por_payload_alterado",
      titulo: "Bloqueios de segurança por payload alterado após a decisão",
      totalBloqueios: payloadAlterado.length,
      divergenciasAfetadas: idsPayload,
      prioridade: "alta",
      acoes: [
        "Revalidar cada decisão afetada confrontando o payload no momento da decisão com o payload atual.",
        "Confirmar se a alteração decorreu de correção técnica (parser de quantidade) ou de reextração/regeração do PAD.",
        "Registrar nova decisão resolutiva apenas em etapa posterior, com decisão humana auditável — não nesta etapa dry-run.",
      ],
    },
    {
      grupo: "2_nao_reapresentadas_com_decisao_resolutiva",
      titulo: "Divergências não reapresentadas com decisão resolutiva",
      totalBloqueios: naoReapresentadas.length,
      divergenciasAfetadas: idsNaoReap,
      prioridade: "media",
      acoes: [
        "Manter como histórico: já houve decisão resolutiva e o item não reaparece na geração atual.",
        "Avaliar, em etapa posterior, se ainda devem bloquear a segurança pré-ativação ou se podem ser liberadas como histórico.",
        "Não exibir como pendência operacional na fila de revisão.",
      ],
    },
    {
      grupo: "3_pendencias_reais",
      titulo: "Pendências reais bloqueantes",
      observacao: "Detalhadas na auditoria profunda (profor-2022-pendencias-profundo-dry-run); exigem decisão humana substantiva.",
      prioridade: "alta",
      acoes: [
        "Manter para revisão humana real; não sanear por regra automática.",
      ],
    },
    {
      grupo: "4_falsos_positivos_saneaveis",
      titulo: "Falsos positivos saneáveis por regra",
      observacao: "Detalhados na auditoria profunda; candidatos a saneamento sistêmico auditável.",
      prioridade: "baixa",
      acoes: [
        "Propor saneamento sistêmico auditável em etapa posterior, sem decisão automática nesta etapa.",
      ],
    },
  ];
}

function renderTabelaBloqueios(itens) {
  if (!itens.length) return "_Nenhum bloqueio neste grupo._";
  const linhas = [
    "| Divergência | Decisão | Tipo alerta | Convênio/UF | Status | Usuário | Data decisão | Origem provável | Parser qtd? | Revalidar? | Prioridade |",
    "|---:|---:|---|---|---|---|---|---|---|---|---|",
  ];
  for (const i of itens) {
    linhas.push(`| #${i.divergenciaId} | ${i.decisaoId ?? "-"} | \`${i.tipoAlerta || "-"}\` | ${i.numeroConvenio || "-"}/${i.uf || "-"} | ${i.statusAtual || "-"} | ${i.usuarioDecisao || "-"} | ${i.dataDecisao || "-"} | ${i.origemProvavelMudanca} | ${i.pareceCorrecaoParserQuantidade ? "sim" : "não"} | ${i.exigeRevalidacaoHumana ? "sim" : "não"} | ${i.prioridadeTratamento} |`);
  }
  return linhas.join("\n");
}

function renderMarkdown(relatorio) {
  const r = relatorio.resumo;
  const linhas = [
    "# PROFOR 2022 — Segurança pré-ativação PAD: detalhamento de bloqueios (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    `Fonte: \`${relatorio.fonte.seguranca}\` (gerado em ${relatorio.fonte.segurancaGeradoEm || "-"}).`,
    "",
    "Etapa somente leitura: não registra decisão, não altera status, não publica e não altera o `planoAplicacao` oficial.",
    "",
    "## 1. Resumo executivo",
    "",
    `- Total de bloqueios de segurança pré-ativação: ${r.totalBloqueios}`,
    `- Bloqueios por payload alterado após a decisão: ${r.totalPorTipo.payload_alterado_apos_decisao || 0}`,
    `- Bloqueios por divergência não reapresentada com decisão resolutiva: ${r.totalPorTipo.nao_reapresentada_com_decisao_resolutiva || 0}`,
    `- Decisões distintas com payload alterado: ${r.totalDecisoesPayloadAlterado}`,
    `- Divergências distintas com payload alterado: ${r.totalDivergenciasPayloadAlterado}`,
    `- Divergências não reapresentadas: ${r.totalDivergenciasNaoReapresentadas}`,
    `- Bloqueios que exigem revalidação humana: ${r.totalExigemRevalidacaoHumana}`,
    `- Bloqueios com mudança provável por correção do parser de quantidade: ${r.totalProvavelCorrecaoParser}`,
    `- Apto para prosseguir ativação: ${r.aptoParaProsseguirAtivacao ? "sim" : "não"}`,
    "",
    "## 2. Bloqueios por tipo",
    "",
    "| Tipo de bloqueio | Quantidade |",
    "|---|---:|",
    ...Object.entries(r.totalPorTipo).map(([tipo, qtd]) => `| \`${tipo}\` | ${qtd} |`),
    "",
    "## 3. Decisões com payload alterado após a decisão",
    "",
    renderTabelaBloqueios(relatorio.decisoesPayloadAlterado),
    "",
    "## 4. Divergências não reapresentadas com decisão resolutiva",
    "",
    renderTabelaBloqueios(relatorio.divergenciasNaoReapresentadas),
    "",
    "## 5. Plano de revalidação por grupo",
    "",
    ...relatorio.planoRevalidacao.flatMap((grupo) => [
      `### ${grupo.titulo}`,
      "",
      `- Prioridade: ${grupo.prioridade}`,
      grupo.totalBloqueios !== undefined ? `- Total de bloqueios: ${grupo.totalBloqueios}` : null,
      Array.isArray(grupo.divergenciasAfetadas) ? `- Divergências afetadas: ${grupo.divergenciasAfetadas.join(", ") || "nenhuma"}` : null,
      grupo.observacao ? `- Observação: ${grupo.observacao}` : null,
      ...grupo.acoes.map((acao) => `  - ${acao}`),
      "",
    ].filter((linha) => linha !== null)),
    "## 6. Próximos passos",
    "",
    "1. Tratar primeiro os bloqueios por payload alterado (prioridade alta): revalidação humana auditável.",
    "2. Classificar as divergências não reapresentadas como histórico e decidir, em etapa posterior, se ainda devem bloquear a ativação.",
    "3. Manter a separação: bloqueio técnico de segurança ≠ pendência operacional real.",
    "4. Repetir esta auditoria após cada rodada de revalidação até zerar os bloqueios.",
  ];
  return `${linhas.filter((linha) => linha !== null).join("\n")}\n`;
}

function executar() {
  const seguranca = lerJson(ENTRADA);
  const divergencias = carregarDivergencias();
  const { porDivergencia, porId } = carregarDecisoes();

  const decisoesPayloadAlterado = detalharPayloadAlterado(seguranca.payloadAlteradoAposDecisao, divergencias, porId);
  const divergenciasNaoReapresentadas = detalharNaoReapresentadas(seguranca.divergenciasNaoReapresentadas, divergencias, porDivergencia);
  const bloqueios = [...decisoesPayloadAlterado, ...divergenciasNaoReapresentadas];

  const totalPorTipo = {};
  for (const bloqueio of bloqueios) {
    totalPorTipo[bloqueio.tipoBloqueio] = (totalPorTipo[bloqueio.tipoBloqueio] || 0) + 1;
  }

  const planoRevalidacao = montarPlanoRevalidacao(decisoesPayloadAlterado, divergenciasNaoReapresentadas);

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    fonte: {
      seguranca: ENTRADA,
      segurancaGeradoEm: seguranca.geradoEm || null,
      sqlite: db.dbPath || "backend/data/onasp.sqlite",
    },
    resumo: {
      totalBloqueios: bloqueios.length,
      totalPorTipo,
      totalDecisoesPayloadAlterado: new Set(decisoesPayloadAlterado.map((i) => i.decisaoId)).size,
      totalDivergenciasPayloadAlterado: new Set(decisoesPayloadAlterado.map((i) => i.divergenciaId)).size,
      totalDivergenciasNaoReapresentadas: new Set(divergenciasNaoReapresentadas.map((i) => i.divergenciaId)).size,
      totalExigemRevalidacaoHumana: bloqueios.filter((i) => i.exigeRevalidacaoHumana).length,
      totalProvavelCorrecaoParser: bloqueios.filter((i) => i.pareceCorrecaoParserQuantidade).length,
      aptoParaProsseguirAtivacao: Boolean(seguranca.resumo?.aptoParaProsseguirAtivacao),
    },
    bloqueios,
    decisoesPayloadAlterado,
    divergenciasNaoReapresentadas,
    planoRevalidacao,
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

  console.log("Detalhamento de segurança pré-ativação PAD/PROFOR 2022 concluído (dry-run).");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Total de bloqueios: ${relatorio.resumo.totalBloqueios}`);
  console.log(`  payload_alterado_apos_decisao: ${totalPorTipo.payload_alterado_apos_decisao || 0}`);
  console.log(`  nao_reapresentada_com_decisao_resolutiva: ${totalPorTipo.nao_reapresentada_com_decisao_resolutiva || 0}`);
  console.log(`Exigem revalidação humana: ${relatorio.resumo.totalExigemRevalidacaoHumana}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha no detalhamento de segurança pré-ativação PAD/PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}
