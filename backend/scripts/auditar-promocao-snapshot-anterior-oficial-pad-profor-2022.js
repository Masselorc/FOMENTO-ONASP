const fs = require("node:fs");
const path = require("node:path");

const {
  STATUS_SNAPSHOT,
  POLITICA_SNAPSHOTS_PAD,
  validarChecksum,
  avaliarSnapshotCandidato,
} = require("../services/profor-2022/profor-pad-politica-snapshots-service");

const RELATORIOS_DIR = path.join(__dirname, "../data/relatorios");
const SNAPSHOT_ATUAL = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica.json");
const SNAPSHOT_ATUAL_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica.md");
const SNAPSHOT_ANTERIOR_OFICIAL = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica-anterior.json");
const SAIDA_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-snapshot-anterior-oficial-auditoria-promocao-dry-run.json");
const SAIDA_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-snapshot-anterior-oficial-auditoria-promocao-dry-run.md");

function lerSnapshotAtual() {
  if (!fs.existsSync(SNAPSHOT_ATUAL)) {
    throw new Error("Snapshot atual não encontrado para auditoria de promoção.");
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_ATUAL, "utf8"));
}

function montarRelatorio(snapshot) {
  const relatorioMarkdownPresente = fs.existsSync(SNAPSHOT_ATUAL_MD);
  const snapshotAnteriorExisteAntes = fs.existsSync(SNAPSHOT_ANTERIOR_OFICIAL);
  const totalErros = Number(snapshot.resumo?.totalErros ?? snapshot.erros?.length ?? 0);
  const totalAvisos = Number(snapshot.resumo?.totalAvisos ?? snapshot.avisos?.length ?? 0);

  const contexto = {
    commitReferencia: null,
    relatorioMarkdownPresente,
    validacoesRegistradas: true,
    aprovacaoHumanaExpressa: false,
    errosCriticosTratados: totalErros === 0,
    avisosClassificados: totalAvisos === 0,
    statusSnapshot: STATUS_SNAPSHOT.CANDIDATO,
    sobrescreverSemRegistro: false,
  };

  const avaliacao = avaliarSnapshotCandidato(snapshot, contexto);
  const validacoes = {
    checksumValido: validarChecksum(snapshot),
    origemValida: snapshot.origem === "reconstrucao-pad",
    parserVersaoPresente: Boolean(snapshot.parserVersao),
    versaoSnapshotPresente: Boolean(snapshot.versaoSnapshot),
    planoAplicacaoNaoVazio: Array.isArray(snapshot.planoAplicacao) && snapshot.planoAplicacao.length > 0,
    relatorioMarkdownPresente,
    errosCriticos: totalErros,
    avisosNaoClassificados: totalAvisos,
    aprovacaoHumanaExpressa: false,
    snapshotAnteriorOficialExisteAntes: snapshotAnteriorExisteAntes,
    snapshotAnteriorOficialCriadoNestaEtapa: false,
  };

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    politica: {
      versaoPolitica: POLITICA_SNAPSHOTS_PAD.versaoPolitica,
      snapshotAnteriorOficialPromovidoNestaEtapa: false,
    },
    snapshot: {
      caminho: path.relative(process.cwd(), SNAPSHOT_ATUAL),
      versaoSnapshot: snapshot.versaoSnapshot || null,
      parserVersao: snapshot.parserVersao || null,
      origem: snapshot.origem || null,
      geradoEm: snapshot.geradoEm || null,
      checksum: snapshot.checksum || null,
      totalLinhas: snapshot.resumo?.totalLinhas || 0,
      totalAvisos,
      totalErros,
    },
    validacoes,
    avaliacao: {
      podeSerCandidato: avaliacao.podeSerCandidato,
      podePromover: avaliacao.podePromover,
      impedimentos: avaliacao.impedimentos,
      avisos: avaliacao.avisos,
    },
    conclusao: avaliacao.podePromover
      ? "Snapshot apto para promoção futura, mas promoção não executada neste dry-run."
      : "Snapshot não pode ser promovido nesta etapa; aprovação humana expressa e/ou requisitos pendentes bloqueiam a promoção.",
    garantias: {
      snapshotCopiado: false,
      snapshotAnteriorOficialCriado: false,
      bancoAlterado: false,
      publicacaoExecutada: false,
      decisaoRegistrada: false,
    },
  };
}

function montarMarkdown(relatorio) {
  return [
    "# PROFOR 2022 - Auditoria de promoção de snapshot anterior oficial (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "## Resultado",
    "",
    `- Pode ser candidato: ${relatorio.avaliacao.podeSerCandidato ? "sim" : "não"}`,
    `- Pode ser promovido agora: ${relatorio.avaliacao.podePromover ? "sim" : "não"}`,
    `- Aprovação humana expressa: ${relatorio.validacoes.aprovacaoHumanaExpressa ? "sim" : "não"}`,
    `- Snapshot anterior oficial criado nesta etapa: ${relatorio.validacoes.snapshotAnteriorOficialCriadoNestaEtapa ? "sim" : "não"}`,
    "",
    "## Validações",
    "",
    `- Checksum válido: ${relatorio.validacoes.checksumValido ? "sim" : "não"}`,
    `- Origem válida: ${relatorio.validacoes.origemValida ? "sim" : "não"}`,
    `- Parser presente: ${relatorio.validacoes.parserVersaoPresente ? "sim" : "não"}`,
    `- Versão presente: ${relatorio.validacoes.versaoSnapshotPresente ? "sim" : "não"}`,
    `- Plano não vazio: ${relatorio.validacoes.planoAplicacaoNaoVazio ? "sim" : "não"}`,
    `- Markdown correspondente: ${relatorio.validacoes.relatorioMarkdownPresente ? "sim" : "não"}`,
    `- Erros críticos: ${relatorio.validacoes.errosCriticos}`,
    `- Avisos não classificados: ${relatorio.validacoes.avisosNaoClassificados}`,
    "",
    "## Impedimentos",
    "",
    ...(relatorio.avaliacao.impedimentos.length
      ? relatorio.avaliacao.impedimentos.map((item) => `- \`${item}\``)
      : ["- Nenhum impedimento técnico."]),
    "",
    "## Garantias",
    "",
    "- Nenhum arquivo de snapshot anterior oficial foi criado.",
    "- Nenhum arquivo foi copiado.",
    "- Banco não alterado.",
    "- Nenhuma publicação executada.",
    "- Nenhuma decisão registrada.",
    "",
    `Conclusão: ${relatorio.conclusao}`,
  ].join("\n") + "\n";
}

function main() {
  const snapshot = lerSnapshotAtual();
  const relatorio = montarRelatorio(snapshot);
  fs.writeFileSync(SAIDA_JSON, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
  fs.writeFileSync(SAIDA_MD, montarMarkdown(relatorio), "utf8");

  console.log("Auditoria de promoção de snapshot anterior oficial concluída (dry-run).");
  console.log(`JSON: ${path.relative(process.cwd(), SAIDA_JSON)}`);
  console.log(`MD:   ${path.relative(process.cwd(), SAIDA_MD)}`);
  console.log(`Pode ser candidato: ${relatorio.avaliacao.podeSerCandidato ? "sim" : "não"}`);
  console.log(`Pode promover: ${relatorio.avaliacao.podePromover ? "sim" : "não"}`);
}

if (require.main === module) {
  try {
    main();
  } catch (erro) {
    console.error("Falha na auditoria de promoção de snapshot anterior oficial.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}

module.exports = {
  montarRelatorio,
  montarMarkdown,
};
