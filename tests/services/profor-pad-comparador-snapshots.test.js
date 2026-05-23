const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const {
  compararSnapshotsPad,
  montarMarkdownComparacaoSnapshots,
  salvarRelatorioComparacaoSnapshots,
} = require("../../backend/services/profor-2022/profor-pad-comparador-snapshots-service");

const {
  gerarFotografiaCanonica,
} = require("../../backend/services/profor-2022/profor-pad-fotografia-service");

function linha(overrides = {}) {
  return {
    uf: "DF",
    numero: "111111",
    area: "OUVIDORIA",
    natureza: "CUSTEIO",
    descricao: "Notebook",
    quantidade: 1,
    valorPrevisto: 1000,
    valorExecutado: 100,
    saldo: 900,
    ...overrides,
  };
}

function comparar(planoAnterior, planoNovo) {
  return compararSnapshotsPad(
    gerarFotografiaCanonica(planoAnterior),
    gerarFotografiaCanonica(planoNovo)
  );
}

function tipos(rel) {
  return rel.divergencias.flatMap((item) => item.tipos || [item.tipo]);
}

test("Comparador v0.2 - ordem diferente dos mesmos itens não gera divergência", () => {
  const anterior = [linha({ numero: "1" }), linha({ numero: "2", descricao: "Mesa" })];
  const novo = [linha({ numero: "2", descricao: "Mesa" }), linha({ numero: "1" })];
  const rel = comparar(anterior, novo);

  assert.equal(rel.versaoComparador, "0.2");
  assert.equal(rel.checksumsValidos, true);
  assert.equal(rel.resumo.totalIguais, 2);
  assert.equal(rel.divergencias.length, 0);
});

test("Comparador v0.2 - acento diferente gera descricao_apenas_diacritico", () => {
  const rel = comparar(
    [linha({ descricao: "Câmera fotográfica" })],
    [linha({ descricao: "Camera fotográfica" })]
  );
  assert.ok(tipos(rel).includes("descricao_apenas_diacritico"));
  assert.equal(rel.resumo.totalNovos, 0);
  assert.equal(rel.resumo.totalRemovidos, 0);
});

test("Comparador v0.2 - espaços, caixa e pontuação leve geram descricao_apenas_textual", () => {
  const rel = comparar(
    [linha({ descricao: "Camera fotografica" })],
    [linha({ descricao: " camera,   fotografica! " })]
  );
  assert.ok(tipos(rel).includes("descricao_apenas_textual"));
});

test("Comparador v0.2 - descrição substantiva gera descricao_alterada", () => {
  const rel = comparar(
    [linha({ descricao: "Notebook" })],
    [linha({ descricao: "Desktop" })]
  );
  assert.ok(tipos(rel).includes("descricao_alterada"));
});

test("Comparador v0.2 - quantidade e valores materiais são classificados", () => {
  const rel = comparar(
    [linha({ quantidade: 1, valorUnitario: 1000, valorPrevisto: 1000, valorExecutado: 100, saldo: 900 })],
    [linha({ quantidade: 2, valorUnitario: 600, valorPrevisto: 1200, valorExecutado: 200, saldo: 1000 })]
  );

  assert.ok(tipos(rel).includes("quantidade_alterada"));
  assert.ok(tipos(rel).includes("valor_unitario_alterado"));
  assert.ok(tipos(rel).includes("valor_previsto_alterado"));
  assert.ok(tipos(rel).includes("valor_executado_alterado"));
  assert.ok(tipos(rel).includes("saldo_alterado"));
});

test("Comparador v0.2 - natureza e área alteradas são classificadas", () => {
  const relNatureza = comparar(
    [linha({ natureza: "CUSTEIO" })],
    [linha({ natureza: "CAPITAL" })]
  );
  assert.ok(tipos(relNatureza).includes("natureza_alterada"));
  assert.equal(relNatureza.resumo.totalNovos, 0);
  assert.equal(relNatureza.resumo.totalRemovidos, 0);

  const relArea = comparar(
    [linha({ area: "OUVIDORIA" })],
    [linha({ area: "CORREGEDORIA" })]
  );
  assert.ok(tipos(relArea).includes("area_alterada"));
});

test("Comparador v0.2 - item novo e item removido continuam detectados", () => {
  const relNovo = comparar([], [linha({ descricao: "Novo item" })]);
  assert.equal(relNovo.resumo.totalNovos, 1);
  assert.ok(tipos(relNovo).includes("item_novo"));

  const relRemovido = comparar([linha({ descricao: "Item removido" })], []);
  assert.equal(relRemovido.resumo.totalRemovidos, 1);
  assert.equal(relRemovido.resumo.totalAusentes, 1);
  assert.ok(tipos(relRemovido).includes("item_removido"));
});

test("Comparador v0.2 - checksum inválido gera bloqueio técnico", () => {
  const fotoAnterior = gerarFotografiaCanonica([linha()]);
  const fotoNova = gerarFotografiaCanonica([linha()]);
  fotoAnterior.checksum = "hash-corrompido";

  const rel = compararSnapshotsPad(fotoAnterior, fotoNova);
  assert.equal(rel.checksumsValidos, false);
  assert.ok(rel.bloqueiosTecnicos.some((bloqueio) => bloqueio.tipo === "checksum_invalido"));
  assert.equal(rel.resumo.totalBloqueiosTecnicos, 1);
});

test("Comparador v0.2 - colisão de chave e dados insuficientes geram bloqueio técnico", () => {
  const fotoAnterior = gerarFotografiaCanonica([
    linha({ descricao: "Camera", valorPrevisto: 100 }),
    linha({ descricao: "Câmera", valorPrevisto: 200 }),
  ]);
  const fotoNova = gerarFotografiaCanonica([linha({ descricao: "" })]);

  const rel = compararSnapshotsPad(fotoAnterior, fotoNova);
  assert.ok(rel.bloqueiosTecnicos.some((bloqueio) => bloqueio.tipo === "colisao_chave"));
  assert.ok(rel.bloqueiosTecnicos.some((bloqueio) => bloqueio.tipo === "chave_ambigua"));
  assert.ok(rel.bloqueiosTecnicos.some((bloqueio) => bloqueio.tipo === "dados_insuficientes"));
});

test("Comparador v0.2 - salva relatórios no disco", () => {
  const dirTemporario = path.join(__dirname, "../../backend/data/relatorios/test_temp_comp");
  const caminhoJson = path.join(dirTemporario, "comp_teste.json");
  const caminhoMd = path.join(dirTemporario, "comp_teste.md");
  const rel = comparar([linha()], [linha()]);

  try {
    salvarRelatorioComparacaoSnapshots(rel, caminhoJson, caminhoMd);
    assert.ok(fs.existsSync(caminhoJson));
    assert.ok(fs.existsSync(caminhoMd));

    const relLido = JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
    assert.equal(relLido.resumo.totalIguais, 1);

    const mdConteudo = fs.readFileSync(caminhoMd, "utf8");
    assert.match(mdConteudo, /# PROFOR 2022 - Comparação de Snapshots PAD/i);
    assert.match(montarMarkdownComparacaoSnapshots(rel), /Itens idênticos: 1/i);
  } finally {
    if (fs.existsSync(caminhoJson)) fs.unlinkSync(caminhoJson);
    if (fs.existsSync(caminhoMd)) fs.unlinkSync(caminhoMd);
    if (fs.existsSync(dirTemporario)) fs.rmdirSync(dirTemporario);
  }
});
