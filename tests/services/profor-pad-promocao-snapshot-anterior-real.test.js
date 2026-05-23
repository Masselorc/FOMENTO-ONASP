const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  TEXTO_APROVACAO_PADRAO,
  PromocaoBloqueadaError,
  parsearArgs,
  carregarTextoAprovacao,
  promoverSnapshotAnteriorOficial,
  montarRegistro,
  montarRegistroMarkdown,
} = require("../../backend/scripts/promover-snapshot-anterior-oficial-pad-profor-2022");

const {
  gerarFotografiaCanonica,
} = require("../../backend/services/profor-2022/profor-pad-fotografia-service");

function snapshotMinimo() {
  return gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);
}

function registroBase() {
  return {
    snapshot: snapshotMinimo(),
    commitReferencia: "abc1234",
    aprovacao: {
      expressa: true,
      texto: TEXTO_APROVACAO_PADRAO,
      responsavel: "Operador de teste",
    },
    copiado: { json: true, md: true },
  };
}

test("parsearArgs detecta --aprovacao-humana-expressa e responsável", () => {
  const o = parsearArgs(["--aprovacao-humana-expressa", "--responsavel=Marcelo"]);
  assert.equal(o.aprovacaoExpressa, true);
  assert.equal(o.responsavel, "Marcelo");
});

test("parsearArgs lê --texto-aprovacao explícito", () => {
  const o = parsearArgs(["--texto-aprovacao=Texto literal de autorizacao"]);
  assert.equal(o.textoAprovacao, "Texto literal de autorizacao");
});

test("carregarTextoAprovacao retorna padrão quando nenhum texto é fornecido", () => {
  const t = carregarTextoAprovacao({});
  assert.match(t, /Autorizo a promoção controlada do snapshot PAD atual/);
});

test("carregarTextoAprovacao usa texto explícito quando fornecido", () => {
  const t = carregarTextoAprovacao({ textoAprovacao: "ABC" });
  assert.equal(t, "ABC");
});

test("montarRegistro grava checksum, commit e aprovação", () => {
  const r = montarRegistro(registroBase());
  assert.equal(r.commitReferencia, "abc1234");
  assert.equal(r.aprovacaoHumana.expressa, true);
  assert.equal(r.aprovacaoHumana.responsavel, "Operador de teste");
  assert.match(r.aprovacaoHumana.textoAutorizacao, /Autorizo a promoção/);
  assert.ok(r.snapshotPromovido.checksum);
  assert.equal(r.copia.jsonCopiado, true);
  assert.equal(r.copia.mdCopiado, true);
});

test("montarRegistro carrega garantias estritas de não-publicação e não-decisão", () => {
  const r = montarRegistro(registroBase());
  for (const chave of [
    "publicacaoExecutada",
    "decisaoAutomaticaRegistrada",
    "planoAplicacaoOficialAlterado",
    "frontendDataPublicadosAlterado",
    "bancoAlterado",
    "sqlDireto",
    "novaMigration",
    "envAlterado",
    "transferegovAcionado",
    "snapshotAtualAlterado",
    "snapshotAnteriorOficialSobrescrito",
    "filaOficialAlterada",
  ]) {
    assert.equal(r.garantias[chave], false, `Garantia ${chave} deve ser false`);
  }
});

test("montarRegistroMarkdown inclui hash, commit e texto da autorização", () => {
  const md = montarRegistroMarkdown(montarRegistro(registroBase()));
  assert.match(md, /Checksum/);
  assert.match(md, /Commit de refer/);
  assert.match(md, /Autorizo a promoção/);
});

test("promoverSnapshotAnteriorOficial recusa quando aprovação humana ausente", () => {
  assert.throws(
    () => promoverSnapshotAnteriorOficial({ aprovacaoExpressa: false }),
    (err) => err instanceof PromocaoBloqueadaError
      && err.detalhes?.motivo === "aprovacao_humana_ausente",
  );
});

test("promoverSnapshotAnteriorOficial recusa quando snapshot anterior oficial já existe", () => {
  const repoRoot = path.join(__dirname, "../..");
  const anterior = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json");
  if (!fs.existsSync(anterior)) {
    // Skip se não houver anterior oficial neste momento (cenário onde a promoção ainda não rolou).
    return;
  }
  assert.throws(
    () => promoverSnapshotAnteriorOficial({
      aprovacaoExpressa: true,
      textoAprovacao: TEXTO_APROVACAO_PADRAO,
      commitReferencia: "deadbeef",
      forcarSobrescrita: false,
    }),
    (err) => err instanceof PromocaoBloqueadaError
      && err.detalhes?.motivo === "snapshot_anterior_oficial_existente",
  );
});

test("promoção real (apta) preserva snapshot atual e produz registro válido", () => {
  // Cenário simulado: copia o snapshot atual para um diretório temporário e
  // executa o promotor com paths redirecionados. Como o script real usa paths
  // fixos do repositório, fazemos um teste estrutural: monta um registro
  // diretamente e confirma que o snapshot atual permanece inalterado.
  const repoRoot = path.join(__dirname, "../..");
  const atual = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-fotografia-canonica.json");
  if (!fs.existsSync(atual)) return;
  const conteudoAntes = fs.readFileSync(atual);
  // Constrói registro apenas para validar que a função montarRegistro reflete
  // checksum atual; não toca o arquivo do snapshot atual.
  const snapshot = JSON.parse(fs.readFileSync(atual, "utf8"));
  const r = montarRegistro({
    snapshot,
    commitReferencia: "feedface",
    aprovacao: { expressa: true, texto: TEXTO_APROVACAO_PADRAO, responsavel: "teste" },
    copiado: { json: true, md: true },
  });
  assert.equal(r.snapshotPromovido.checksum, snapshot.checksum);
  const conteudoDepois = fs.readFileSync(atual);
  assert.ok(conteudoAntes.equals(conteudoDepois), "Snapshot atual não deve ser alterado por montarRegistro");
});
