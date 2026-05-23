const {
  calcularChecksumSnapshot,
} = require("./profor-pad-fotografia-service");

const STATUS_SNAPSHOT = Object.freeze({
  ATUAL: "snapshot_atual",
  CANDIDATO: "snapshot_candidato",
  ANTERIOR_OFICIAL: "snapshot_anterior_oficial",
  TEMPORARIO: "snapshot_temporario",
  HOMOLOGADO: "snapshot_homologado",
  REJEITADO: "snapshot_rejeitado",
});

const POLITICA_SNAPSHOTS_PAD = Object.freeze({
  versaoPolitica: "1.0",
  snapshotAnteriorOficialPromovidoNestaEtapa: false,
  caminhos: {
    snapshotAtualJson: "backend/data/relatorios/profor-2022-pad-fotografia-canonica.json",
    snapshotAtualMarkdown: "backend/data/relatorios/profor-2022-pad-fotografia-canonica.md",
    snapshotAnteriorOficialJson: "backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json",
    snapshotAnteriorOficialMarkdown: "backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.md",
    registroPromocaoMarkdown: "backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.md",
    registroPromocaoJson: "backend/data/relatorios/profor-2022-pad-snapshot-anterior-oficial-registro.json",
  },
  proibicoes: [
    "nao_promover_snapshot_temporario",
    "nao_promover_checksum_invalido",
    "nao_promover_sem_origem",
    "nao_promover_sem_commit_referencia",
    "nao_sobrescrever_snapshot_anterior_oficial_silenciosamente",
    "nao_usar_snapshot_anterior_oficial_para_publicar_dados_automaticamente",
    "nao_tratar_snapshot_anterior_oficial_como_decisao_humana",
    "nao_tratar_snapshot_anterior_oficial_como_planoAplicacao_oficial",
  ],
});

function validarChecksum(snapshot) {
  if (!snapshot?.checksum || !Array.isArray(snapshot?.planoAplicacao)) {
    return false;
  }
  return calcularChecksumSnapshot(snapshot.planoAplicacao) === snapshot.checksum;
}

function avaliarSnapshotCandidato(snapshot, contexto = {}) {
  const impedimentos = [];
  const avisos = [];

  if (!snapshot || typeof snapshot !== "object") {
    return {
      podeSerCandidato: false,
      podePromover: false,
      impedimentos: ["snapshot_ausente"],
      avisos,
    };
  }

  for (const campo of ["versaoSnapshot", "checksum", "parserVersao", "origem", "geradoEm"]) {
    if (!snapshot[campo]) impedimentos.push(`campo_obrigatorio_ausente:${campo}`);
  }

  if (!snapshot.resumo?.totalLinhas) impedimentos.push("total_linhas_ausente_ou_zero");
  if (!Array.isArray(snapshot.planoAplicacao) || snapshot.planoAplicacao.length === 0) {
    impedimentos.push("plano_aplicacao_vazio");
  }
  if (!validarChecksum(snapshot)) impedimentos.push("checksum_invalido");
  if (!contexto.commitReferencia) impedimentos.push("commit_referencia_ausente");
  if (!contexto.relatorioMarkdownPresente) impedimentos.push("relatorio_markdown_ausente");
  if (!contexto.validacoesRegistradas) impedimentos.push("validacoes_nao_registradas");
  if (!contexto.aprovacaoHumanaExpressa) impedimentos.push("aprovacao_humana_ausente");
  if (contexto.statusSnapshot === STATUS_SNAPSHOT.TEMPORARIO) impedimentos.push("snapshot_temporario_nao_promovivel");
  if (contexto.sobrescreverSemRegistro) impedimentos.push("sobrescrita_silenciosa_proibida");

  const totalErros = Number(snapshot.resumo?.totalErros ?? snapshot.erros?.length ?? 0);
  if (totalErros > 0 && !contexto.errosCriticosTratados) {
    impedimentos.push("erros_criticos_nao_tratados");
  }

  const totalAvisos = Number(snapshot.resumo?.totalAvisos ?? snapshot.avisos?.length ?? 0);
  if (totalAvisos > 0 && !contexto.avisosClassificados) {
    avisos.push("avisos_nao_classificados");
  }

  return {
    podeSerCandidato: impedimentos.length === 0 || impedimentos.every((item) => item === "aprovacao_humana_ausente"),
    podePromover: impedimentos.length === 0,
    impedimentos,
    avisos,
  };
}

function ausenciaSnapshotAnteriorNaoGeraDivergencia(snapshotAnteriorExiste) {
  return snapshotAnteriorExiste === false;
}

module.exports = {
  STATUS_SNAPSHOT,
  POLITICA_SNAPSHOTS_PAD,
  validarChecksum,
  avaliarSnapshotCandidato,
  ausenciaSnapshotAnteriorNaoGeraDivergencia,
};
