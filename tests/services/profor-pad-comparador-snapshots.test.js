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

test("Comparador v0.3 - ordem diferente dos mesmos itens não gera divergência", () => {
  const anterior = [linha({ numero: "1" }), linha({ numero: "2", descricao: "Mesa" })];
  const novo = [linha({ numero: "2", descricao: "Mesa" }), linha({ numero: "1" })];
  const rel = comparar(anterior, novo);

  assert.equal(rel.versaoComparador, "0.3");
  assert.equal(rel.checksumsValidos, true);
  assert.equal(rel.resumo.totalIguais, 2);
  assert.equal(rel.divergencias.length, 0);
});

test("Comparador v0.3 - acento diferente gera descricao_apenas_diacritico", () => {
  const rel = comparar(
    [linha({ descricao: "Câmera fotográfica" })],
    [linha({ descricao: "Camera fotográfica" })]
  );
  assert.ok(tipos(rel).includes("descricao_apenas_diacritico"));
  assert.equal(rel.resumo.totalNovos, 0);
  assert.equal(rel.resumo.totalRemovidos, 0);
});

test("Comparador v0.3 - espaços, caixa e pontuação leve geram descricao_apenas_textual", () => {
  const rel = comparar(
    [linha({ descricao: "Camera fotografica" })],
    [linha({ descricao: " camera,   fotografica! " })]
  );
  assert.ok(tipos(rel).includes("descricao_apenas_textual"));
});

test("Comparador v0.3 - descrição substantiva gera descricao_alterada", () => {
  const rel = comparar(
    [linha({ descricao: "Notebook" })],
    [linha({ descricao: "Desktop" })]
  );
  assert.ok(tipos(rel).includes("descricao_alterada"));
});

test("Comparador v0.3 - quantidade e valores materiais são classificados", () => {
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

test("Comparador v0.3 - natureza e área alteradas são classificadas", () => {
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

test("Comparador v0.3 - item novo e item removido continuam detectados", () => {
  const relNovo = comparar([], [linha({ descricao: "Novo item" })]);
  assert.equal(relNovo.resumo.totalNovos, 1);
  assert.ok(tipos(relNovo).includes("item_novo"));

  const relRemovido = comparar([linha({ descricao: "Item removido" })], []);
  assert.equal(relRemovido.resumo.totalRemovidos, 1);
  assert.equal(relRemovido.resumo.totalAusentes, 1);
  assert.ok(tipos(relRemovido).includes("item_removido"));
});

test("Comparador v0.3 - checksum inválido gera bloqueio técnico", () => {
  const fotoAnterior = gerarFotografiaCanonica([linha()]);
  const fotoNova = gerarFotografiaCanonica([linha()]);
  fotoAnterior.checksum = "hash-corrompido";

  const rel = compararSnapshotsPad(fotoAnterior, fotoNova);
  assert.equal(rel.checksumsValidos, false);
  assert.ok(rel.bloqueiosTecnicos.some((bloqueio) => bloqueio.tipo === "checksum_invalido"));
  assert.equal(rel.resumo.totalBloqueiosTecnicos, 1);
});

test("Comparador v0.3 - colisão de chave e dados insuficientes geram bloqueio técnico", () => {
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

test("Comparador v0.3 - colisão preexistente com identidade material bijetiva NÃO vira item_novo + item_removido", () => {
  // Mesmo grupo material (chaveMaterial idêntica) com 2 itens em cada lado,
  // hashes bijetivos → pareados como ruído controlado, sem item_novo/removido.
  const a = linha({ numero: "999", descricao: "Cadeira", quantidade: 3, valorPrevisto: 300, valorExecutado: 0, saldo: 300, area: "OUVIDORIA" });
  const b = linha({ numero: "999", descricao: "Cadeira", quantidade: 7, valorPrevisto: 700, valorExecutado: 0, saldo: 700, area: "OUVIDORIA" });
  const rel = comparar([a, b], [a, b]);

  assert.equal(rel.resumo.totalNovos, 0, "ruído controlado não deve virar item_novo");
  assert.equal(rel.resumo.totalRemovidos, 0, "ruído controlado não deve virar item_removido");
  assert.equal(rel.resumo.totalAlterados, 0);
  assert.equal(rel.resumo.totalIguais, 2);
  assert.ok(Array.isArray(rel.ruidosTecnicosControlados));
  assert.equal(rel.ruidosTecnicosControlados.length >= 1, true);
  // Bloqueios técnicos NÃO foram apagados:
  assert.ok(rel.bloqueiosTecnicos.some((b) => b.tipo === "colisao_chave"));
  // E receberam a marca de ruído controlado:
  assert.ok(rel.bloqueiosTecnicos.some((b) => b.tipo === "colisao_chave" && b.ruidoTecnicoControlado === true));
});

test("Comparador v0.3 - colisão com DIFERENÇA material continua gerando divergência/bloqueio", () => {
  // Mesmo grupo material com 2 itens em cada lado, mas hashes diferentes
  // (valor alterado em um dos itens do novo). Pareamento por hash não casa
  // → comportamento legado preserva detecção de divergência.
  const a = linha({ numero: "888", descricao: "Mesa", quantidade: 1, valorPrevisto: 100, saldo: 100, area: "OUVIDORIA" });
  const b = linha({ numero: "888", descricao: "Mesa", quantidade: 2, valorPrevisto: 200, saldo: 200, area: "OUVIDORIA" });
  const bAlterado = linha({ numero: "888", descricao: "Mesa", quantidade: 2, valorPrevisto: 250, saldo: 250, area: "OUVIDORIA" });
  const rel = comparar([a, b], [a, bAlterado]);

  // Hashes não bijetivos → não há pareamento por ruído controlado.
  assert.equal(rel.ruidosTecnicosControlados.length, 0);
  // Comportamento legado: itens não pareados aparecem como novo/removido OU alterados.
  assert.ok((rel.resumo.totalNovos + rel.resumo.totalRemovidos + rel.resumo.totalAlterados) >= 1);
  // Bloqueios técnicos de colisão permanecem.
  assert.ok(rel.bloqueiosTecnicos.some((b) => b.tipo === "colisao_chave"));
});

test("Comparador v0.3 - diferença financeira agregada R$ 0,00 sozinha não oculta divergência", () => {
  // Snapshots com mesma soma agregada mas itens materialmente distintos
  // (chaves materiais diferentes; nenhum grupo de colisão se forma).
  const rel = comparar(
    [linha({ numero: "1", descricao: "Cadeira", valorPrevisto: 1000, saldo: 900 })],
    [linha({ numero: "1", descricao: "Mesa", valorPrevisto: 1000, saldo: 900 })],
  );
  // Item descricao diferente → não cai em ruído controlado e divergência aparece.
  assert.equal(rel.ruidosTecnicosControlados.length, 0);
  assert.ok(rel.divergencias.length >= 1);
});

test("Comparador v0.3 - quantidade de bloqueios técnicos NÃO é reduzida pelo ruído controlado", () => {
  const a = linha({ numero: "555", descricao: "Coturno", quantidade: 30, valorPrevisto: 3000, saldo: 3000, area: "OUVIDORIA" });
  const b = linha({ numero: "555", descricao: "Coturno", quantidade: 20, valorPrevisto: 2000, saldo: 2000, area: "OUVIDORIA" });
  const rel = comparar([a, b], [a, b]);
  // 2 itens com mesma chaveMaterial → colisao_chave em ambos os snapshots = 2 bloqueios.
  const colisoes = rel.bloqueiosTecnicos.filter((x) => x.tipo === "colisao_chave");
  assert.ok(colisoes.length >= 2, "colisões em ambos os snapshots permanecem contadas");
  // Mas o ruído controlado foi identificado:
  assert.equal(rel.ruidosTecnicosControlados.length >= 1, true);
});

test("Comparador v0.3 - ruído técnico controlado aparece no relatório markdown e no JSON", () => {
  const a = linha({ numero: "999", descricao: "Cadeira", quantidade: 3, valorPrevisto: 300, area: "OUVIDORIA" });
  const b = linha({ numero: "999", descricao: "Cadeira", quantidade: 7, valorPrevisto: 700, area: "OUVIDORIA" });
  const rel = comparar([a, b], [a, b]);
  assert.equal(rel.resumo.totalRuidosTecnicosControlados, rel.ruidosTecnicosControlados.length);
  const md = montarMarkdownComparacaoSnapshots(rel);
  assert.match(md, /Ruído técnico controlado/);
  assert.match(md, /hashItem_bijetivo/);
});

test("Comparador v0.3 - fila dry-run não cria pendência operacional artificial para ruído controlado", () => {
  // Cobre a integração leve: como o ruído controlado já não gera item_novo/item_removido,
  // a fila construída a partir das divergências não recebe candidatos com tipo item_novo/item_removido.
  const a = linha({ numero: "999", descricao: "Cadeira", quantidade: 3, valorPrevisto: 300, area: "OUVIDORIA" });
  const b = linha({ numero: "999", descricao: "Cadeira", quantidade: 7, valorPrevisto: 700, area: "OUVIDORIA" });
  const rel = comparar([a, b], [a, b]);
  const tiposDiv = rel.divergencias.flatMap((x) => x.tipos || [x.tipo]);
  assert.equal(tiposDiv.includes("item_novo"), false);
  assert.equal(tiposDiv.includes("item_removido"), false);
});

test("Comparador v0.3 - salva relatórios no disco", () => {
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
