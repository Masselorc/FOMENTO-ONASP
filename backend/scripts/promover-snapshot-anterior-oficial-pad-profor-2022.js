// Promoção controlada do snapshot PAD/PROFOR 2022 atual como snapshot anterior
// oficial. Exige aprovação humana expressa (flag de linha de comando) e commit
// de referência (HEAD). Recusa se o anterior oficial já existir. Não publica,
// não altera banco, não decide e não toca frontend/data/publicados.

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const {
  STATUS_SNAPSHOT,
  POLITICA_SNAPSHOTS_PAD,
  validarChecksum,
  avaliarSnapshotCandidato,
} = require("../services/profor-2022/profor-pad-politica-snapshots-service");

const REPO_ROOT = path.join(__dirname, "..", "..");
const RELATORIOS_DIR = path.join(__dirname, "..", "data", "relatorios");
const SNAPSHOT_ATUAL_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica.json");
const SNAPSHOT_ATUAL_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica.md");
const SNAPSHOT_ANTERIOR_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica-anterior.json");
const SNAPSHOT_ANTERIOR_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-fotografia-canonica-anterior.md");
const REGISTRO_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-snapshot-anterior-oficial-registro.json");
const REGISTRO_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-snapshot-anterior-oficial-registro.md");

const TEXTO_APROVACAO_PADRAO =
  "Autorizo a promoção controlada do snapshot PAD atual como snapshot anterior oficial " +
  "para fins exclusivos de comparação dry-run futura, sem publicação, sem alteração do " +
  "plano oficial, sem decisão automática, sem alteração de banco e sem acionamento do Transferegov.";

class PromocaoBloqueadaError extends Error {
  constructor(message, detalhes = {}) {
    super(message);
    this.name = "PromocaoBloqueadaError";
    this.detalhes = detalhes;
  }
}

function obterCommitReferencia() {
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    return sha || null;
  } catch (_erro) {
    return null;
  }
}

function lerSnapshotAtual() {
  if (!fs.existsSync(SNAPSHOT_ATUAL_JSON)) {
    throw new PromocaoBloqueadaError("Snapshot atual não encontrado para promoção.", {
      caminho: SNAPSHOT_ATUAL_JSON,
    });
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_ATUAL_JSON, "utf8"));
}

function montarRegistro({ snapshot, commitReferencia, aprovacao, copiado }) {
  return {
    geradoEm: new Date().toISOString(),
    politica: {
      versaoPolitica: POLITICA_SNAPSHOTS_PAD.versaoPolitica,
      snapshotAnteriorOficialPromovidoNestaEtapa: true,
    },
    snapshotPromovido: {
      caminhoOrigemJson: path.relative(REPO_ROOT, SNAPSHOT_ATUAL_JSON),
      caminhoOrigemMd: path.relative(REPO_ROOT, SNAPSHOT_ATUAL_MD),
      caminhoDestinoJson: path.relative(REPO_ROOT, SNAPSHOT_ANTERIOR_JSON),
      caminhoDestinoMd: path.relative(REPO_ROOT, SNAPSHOT_ANTERIOR_MD),
      versaoSnapshot: snapshot.versaoSnapshot || null,
      parserVersao: snapshot.parserVersao || null,
      origem: snapshot.origem || null,
      geradoEm: snapshot.geradoEm || null,
      checksum: snapshot.checksum || null,
      totalLinhas: snapshot.resumo?.totalLinhas || 0,
      totalAvisos: snapshot.resumo?.totalAvisos || 0,
      totalErros: snapshot.resumo?.totalErros || 0,
    },
    commitReferencia,
    aprovacaoHumana: {
      expressa: Boolean(aprovacao?.expressa),
      textoAutorizacao: aprovacao?.texto || null,
      responsavel: aprovacao?.responsavel || null,
    },
    copia: {
      jsonCopiado: Boolean(copiado?.json),
      mdCopiado: Boolean(copiado?.md),
    },
    garantias: {
      publicacaoExecutada: false,
      decisaoAutomaticaRegistrada: false,
      planoAplicacaoOficialAlterado: false,
      frontendDataPublicadosAlterado: false,
      bancoAlterado: false,
      sqlDireto: false,
      novaMigration: false,
      envAlterado: false,
      transferegovAcionado: false,
      snapshotAtualAlterado: false,
      snapshotAnteriorOficialSobrescrito: false,
      filaOficialAlterada: false,
    },
  };
}

function montarRegistroMarkdown(registro) {
  const linhas = [
    "# PROFOR 2022 - Registro de promoção do snapshot anterior oficial",
    "",
    `Gerado em: ${registro.geradoEm}`,
    `Commit de referência: \`${registro.commitReferencia || "(não identificado)"}\``,
    "",
    "## Snapshot promovido",
    "",
    `- Origem JSON: \`${registro.snapshotPromovido.caminhoOrigemJson}\``,
    `- Origem MD:   \`${registro.snapshotPromovido.caminhoOrigemMd}\``,
    `- Destino JSON: \`${registro.snapshotPromovido.caminhoDestinoJson}\``,
    `- Destino MD:   \`${registro.snapshotPromovido.caminhoDestinoMd}\``,
    `- Versão do snapshot: \`${registro.snapshotPromovido.versaoSnapshot}\``,
    `- Parser: \`${registro.snapshotPromovido.parserVersao}\``,
    `- Origem: \`${registro.snapshotPromovido.origem}\``,
    `- Gerado em: \`${registro.snapshotPromovido.geradoEm}\``,
    `- Checksum: \`${registro.snapshotPromovido.checksum}\``,
    `- Total de linhas: ${registro.snapshotPromovido.totalLinhas}`,
    `- Total de avisos: ${registro.snapshotPromovido.totalAvisos}`,
    `- Total de erros: ${registro.snapshotPromovido.totalErros}`,
    "",
    "## Aprovação humana expressa",
    "",
    `- Expressa: ${registro.aprovacaoHumana.expressa ? "sim" : "não"}`,
    `- Responsável: ${registro.aprovacaoHumana.responsavel || "(não informado)"}`,
    `- Texto da autorização:`,
    "",
    "> " + String(registro.aprovacaoHumana.textoAutorizacao || "(não informado)").split("\n").join("\n> "),
    "",
    "## Cópia realizada",
    "",
    `- JSON copiado: ${registro.copia.jsonCopiado ? "sim" : "não"}`,
    `- MD copiado:   ${registro.copia.mdCopiado ? "sim" : "não"}`,
    "",
    "## Garantias",
    "",
    "- Nenhuma publicação executada.",
    "- Nenhuma decisão automática registrada.",
    "- `planoAplicacao` oficial não foi alterado.",
    "- `frontend/data/publicados/` não foi alterado.",
    "- Banco não foi alterado (sem SQL direto, sem migration).",
    "- `.env` não foi alterado.",
    "- Transferegov não foi acionado.",
    "- Snapshot atual permaneceu intacto.",
    "- Snapshot anterior oficial não foi sobrescrito (recusado se já existia).",
    "- Fila oficial real não foi alterada.",
  ];
  return linhas.join("\n") + "\n";
}

function parsearArgs(argv = process.argv.slice(2)) {
  const opcoes = {
    aprovacaoExpressa: false,
    textoAprovacao: null,
    textoAprovacaoArquivo: null,
    responsavel: null,
    forcarSobrescrita: false,
  };
  for (const arg of argv) {
    if (arg === "--aprovacao-humana-expressa") opcoes.aprovacaoExpressa = true;
    else if (arg.startsWith("--texto-aprovacao=")) opcoes.textoAprovacao = arg.slice("--texto-aprovacao=".length);
    else if (arg.startsWith("--texto-aprovacao-arquivo=")) opcoes.textoAprovacaoArquivo = arg.slice("--texto-aprovacao-arquivo=".length);
    else if (arg.startsWith("--responsavel=")) opcoes.responsavel = arg.slice("--responsavel=".length);
    else if (arg === "--forcar-sobrescrita") opcoes.forcarSobrescrita = true;
  }
  return opcoes;
}

function carregarTextoAprovacao(opcoes) {
  if (opcoes.textoAprovacao && opcoes.textoAprovacao.trim().length > 0) {
    return opcoes.textoAprovacao;
  }
  if (opcoes.textoAprovacaoArquivo && fs.existsSync(opcoes.textoAprovacaoArquivo)) {
    return fs.readFileSync(opcoes.textoAprovacaoArquivo, "utf8");
  }
  return TEXTO_APROVACAO_PADRAO;
}

function promoverSnapshotAnteriorOficial(opcoes = {}) {
  const snapshot = lerSnapshotAtual();
  const commitReferencia = opcoes.commitReferencia || obterCommitReferencia();
  const aprovacao = {
    expressa: Boolean(opcoes.aprovacaoExpressa),
    texto: opcoes.textoAprovacao || null,
    responsavel: opcoes.responsavel || null,
  };

  if (!aprovacao.expressa) {
    throw new PromocaoBloqueadaError(
      "Promoção recusada: aprovação humana expressa ausente. Use --aprovacao-humana-expressa.",
      { motivo: "aprovacao_humana_ausente" }
    );
  }
  if (!commitReferencia) {
    throw new PromocaoBloqueadaError(
      "Promoção recusada: commit de referência não pôde ser identificado.",
      { motivo: "commit_referencia_ausente" }
    );
  }
  if (fs.existsSync(SNAPSHOT_ANTERIOR_JSON) && !opcoes.forcarSobrescrita) {
    throw new PromocaoBloqueadaError(
      "Promoção recusada: snapshot anterior oficial já existe; sobrescrita silenciosa proibida pela política.",
      { motivo: "snapshot_anterior_oficial_existente", caminho: SNAPSHOT_ANTERIOR_JSON }
    );
  }

  const totalErros = Number(snapshot.resumo?.totalErros ?? 0);
  const totalAvisos = Number(snapshot.resumo?.totalAvisos ?? 0);
  const contexto = {
    commitReferencia,
    relatorioMarkdownPresente: fs.existsSync(SNAPSHOT_ATUAL_MD),
    validacoesRegistradas: true,
    aprovacaoHumanaExpressa: true,
    errosCriticosTratados: totalErros === 0,
    avisosClassificados: totalAvisos === 0,
    statusSnapshot: STATUS_SNAPSHOT.CANDIDATO,
    sobrescreverSemRegistro: false,
  };
  const avaliacao = avaliarSnapshotCandidato(snapshot, contexto);
  if (!avaliacao.podePromover) {
    throw new PromocaoBloqueadaError(
      "Promoção recusada pela política de snapshots PAD.",
      { motivo: "politica_bloqueou", impedimentos: avaliacao.impedimentos, avisos: avaliacao.avisos }
    );
  }
  if (!validarChecksum(snapshot)) {
    throw new PromocaoBloqueadaError(
      "Promoção recusada: checksum do snapshot atual é inválido.",
      { motivo: "checksum_invalido" }
    );
  }

  // Cópia atômica: escreve .tmp e renomeia
  const tmpJson = `${SNAPSHOT_ANTERIOR_JSON}.tmp`;
  fs.copyFileSync(SNAPSHOT_ATUAL_JSON, tmpJson);
  fs.renameSync(tmpJson, SNAPSHOT_ANTERIOR_JSON);

  let mdCopiado = false;
  if (fs.existsSync(SNAPSHOT_ATUAL_MD)) {
    const tmpMd = `${SNAPSHOT_ANTERIOR_MD}.tmp`;
    fs.copyFileSync(SNAPSHOT_ATUAL_MD, tmpMd);
    fs.renameSync(tmpMd, SNAPSHOT_ANTERIOR_MD);
    mdCopiado = true;
  }

  const registro = montarRegistro({
    snapshot,
    commitReferencia,
    aprovacao,
    copiado: { json: true, md: mdCopiado },
  });
  fs.writeFileSync(REGISTRO_JSON, `${JSON.stringify(registro, null, 2)}\n`, "utf8");
  fs.writeFileSync(REGISTRO_MD, montarRegistroMarkdown(registro), "utf8");

  return registro;
}

function main() {
  const opcoes = parsearArgs();
  const textoAprovacao = carregarTextoAprovacao(opcoes);

  try {
    const registro = promoverSnapshotAnteriorOficial({
      aprovacaoExpressa: opcoes.aprovacaoExpressa,
      textoAprovacao,
      responsavel: opcoes.responsavel,
      forcarSobrescrita: opcoes.forcarSobrescrita,
    });
    console.log("Snapshot anterior oficial promovido (cópia controlada).");
    console.log(`Snapshot atual:       ${path.relative(REPO_ROOT, SNAPSHOT_ATUAL_JSON)}`);
    console.log(`Snapshot anterior:    ${path.relative(REPO_ROOT, SNAPSHOT_ANTERIOR_JSON)}`);
    console.log(`Registro JSON:        ${path.relative(REPO_ROOT, REGISTRO_JSON)}`);
    console.log(`Registro MD:          ${path.relative(REPO_ROOT, REGISTRO_MD)}`);
    console.log(`Commit de referência: ${registro.commitReferencia}`);
    console.log(`Checksum promovido:   ${registro.snapshotPromovido.checksum}`);
    return 0;
  } catch (erro) {
    if (erro instanceof PromocaoBloqueadaError) {
      console.error("Promoção bloqueada.");
      console.error(`Motivo: ${erro.detalhes?.motivo || "desconhecido"}`);
      if (erro.detalhes?.impedimentos) {
        console.error(`Impedimentos: ${erro.detalhes.impedimentos.join(", ")}`);
      }
      console.error(erro.message);
      return 2;
    }
    console.error("Falha na promoção do snapshot anterior oficial.");
    console.error(erro?.stack || erro?.message || erro);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  TEXTO_APROVACAO_PADRAO,
  PromocaoBloqueadaError,
  parsearArgs,
  carregarTextoAprovacao,
  obterCommitReferencia,
  promoverSnapshotAnteriorOficial,
  montarRegistro,
  montarRegistroMarkdown,
};
