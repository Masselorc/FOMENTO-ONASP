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

test("Comparador Snapshots - Itens novos, ausentes e alterados", () => {
  // Snapshot Anterior Mock
  const planoAnterior = [
    {
      uf: "DF",
      numero: "111111",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 5,
      valorPrevisto: 5000,
      valorExecutado: 3000,
      saldo: 2000,
    },
    {
      uf: "DF",
      numero: "111111",
      area: "CORREGEDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 3,
      valorPrevisto: 3000,
      valorExecutado: 3000,
      saldo: 0,
    },
  ];

  // Snapshot Novo Mock
  const planoNovo = [
    // 1. Item inalterado (DF::111111::CORREGEDORIA::CUSTEIO::Notebook)
    {
      uf: "DF",
      numero: "111111",
      area: "CORREGEDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 3,
      valorPrevisto: 3000,
      valorExecutado: 3000,
      saldo: 0,
    },
    // 2. Item alterado (DF::111111::OUVIDORIA::CUSTEIO::Notebook) - Mudança de previsto e executado
    {
      uf: "DF",
      numero: "111111",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 5,
      valorPrevisto: 5500, // Era 5000 (+500)
      valorExecutado: 3200, // Era 3000 (+200)
      saldo: 2300, // Era 2000 (+300)
    },
    // 3. Item Novo (DF::111111::ESCOLA PENAL::CAPITAL::Notebook)
    {
      uf: "DF",
      numero: "111111",
      area: "ESCOLA PENAL",
      natureza: "CAPITAL",
      descricao: "Notebook",
      quantidade: 2,
      valorPrevisto: 4000,
      valorExecutado: 0,
      saldo: 4000,
    },
  ];

  // Gera fotografias canônicas completas
  const fotoAnterior = gerarFotografiaCanonica(planoAnterior);
  const fotoNova = gerarFotografiaCanonica(planoNovo);

  // Executa comparação
  const rel = compararSnapshotsPad(fotoAnterior, fotoNova);

  // Verificações
  assert.equal(rel.checksumsValidos, true, "Os checksums deveriam ser válidos.");

  // Itens ausentes (O plano anterior tinha 2 itens, o novo tem 2 iguais/alterados e 1 novo. Nenhum item foi removido.)
  assert.equal(rel.resumo.totalAusentes, 0);

  // Itens novos
  assert.equal(rel.resumo.totalNovos, 1);
  assert.equal(rel.itensNovos[0].area, "ESCOLA PENAL");
  assert.equal(rel.itensNovos[0].natureza, "CAPITAL");
  assert.equal(rel.itensNovos[0].valorPrevisto, 4000);

  // Itens alterados
  assert.equal(rel.resumo.totalAlterados, 1);
  assert.equal(rel.itensAlterados[0].area, "OUVIDORIA");
  assert.equal(rel.itensAlterados[0].valores.valorPrevisto.anterior, 5000);
  assert.equal(rel.itensAlterados[0].valores.valorPrevisto.novo, 5500);
  assert.equal(rel.itensAlterados[0].valores.valorPrevisto.delta, 500);

  // Totais agregados das diferenças (Novo - Anterior)
  // Anterior Previsto = 8000. Novo Previsto = 12500. Delta = 4500.
  // Anterior Executado = 6000. Novo Executado = 6200. Delta = 200.
  // Anterior Saldo = 2000. Novo Saldo = 6300. Delta = 4300.
  assert.equal(rel.diferencasAgregadas.valorPrevisto, 4500);
  assert.equal(rel.diferencasAgregadas.valorExecutado, 200);
  assert.equal(rel.diferencasAgregadas.saldo, 4300);
  assert.equal(rel.diferencasAgregadas.linhas, 1); // 3 linhas - 2 linhas
});

test("Comparador Snapshots - Detecção de item ausente (removido)", () => {
  const planoAnterior = [
    {
      uf: "DF",
      numero: "111111",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 5,
      valorPrevisto: 5000,
      valorExecutado: 3000,
    },
  ];

  const planoNovo = []; // Item Notebook foi removido

  const fotoAnterior = gerarFotografiaCanonica(planoAnterior);
  const fotoNova = gerarFotografiaCanonica(planoNovo);

  const rel = compararSnapshotsPad(fotoAnterior, fotoNova);

  assert.equal(rel.resumo.totalAusentes, 1);
  assert.equal(rel.resumo.totalNovos, 0);
  assert.equal(rel.resumo.totalAlterados, 0);
  assert.equal(rel.itensAusentes[0].descricao, "Notebook");
});

test("Comparador Snapshots - Verificação de falha de checksum", () => {
  const planoAnterior = [
    { uf: "DF", numero: "111", area: "OUVIDORIA", natureza: "CUSTEIO", descricao: "A", quantidade: 1 },
  ];
  const planoNovo = [
    { uf: "DF", numero: "111", area: "OUVIDORIA", natureza: "CUSTEIO", descricao: "A", quantidade: 1 },
  ];

  const fotoAnterior = gerarFotografiaCanonica(planoAnterior);
  const fotoNova = gerarFotografiaCanonica(planoNovo);

  // Corrompe deliberadamente o checksum no metadado
  fotoAnterior.checksum = "hash-corrompido";

  const rel = compararSnapshotsPad(fotoAnterior, fotoNova);

  assert.equal(rel.checksumsValidos, false, "checksumsValidos deveria ser false após corromper metadado.");
  assert.equal(rel.checksumAnterior, "hash-corrompido");
  assert.notEqual(rel.checksumCalculadoAnterior, "hash-corrompido");
});

test("Comparador Snapshots - Salvando relatórios no disco", () => {
  const dirTemporario = path.join(__dirname, "../../backend/data/relatorios/test_temp_comp");
  const caminhoJson = path.join(dirTemporario, "comp_teste.json");
  const caminhoMd = path.join(dirTemporario, "comp_teste.md");

  const plano = [{ uf: "DF", numero: "111", area: "OUVIDORIA", natureza: "CUSTEIO", descricao: "Notebook", quantidade: 1 }];

  const foto = gerarFotografiaCanonica(plano);
  const rel = compararSnapshotsPad(foto, foto); // Compara consigo mesmo (tudo idêntico)

  try {
    salvarRelatorioComparacaoSnapshots(rel, caminhoJson, caminhoMd);

    assert.ok(fs.existsSync(caminhoJson), "Relatório JSON deveria ter sido salvo.");
    assert.ok(fs.existsSync(caminhoMd), "Relatório Markdown deveria ter sido salvo.");

    const jsonConteudo = fs.readFileSync(caminhoJson, "utf8");
    const relLido = JSON.parse(jsonConteudo);
    assert.equal(relLido.resumo.totalIguais, 1);
    assert.equal(relLido.resumo.totalNovos, 0);

    const mdConteudo = fs.readFileSync(caminhoMd, "utf8");
    assert.match(mdConteudo, /# PROFOR 2022 — Comparação de Snapshots PAD/i);
    assert.match(mdConteudo, /Itens idênticos: \*\*1\*\*/i);
  } finally {
    // Cleanup
    if (fs.existsSync(caminhoJson)) fs.unlinkSync(caminhoJson);
    if (fs.existsSync(caminhoMd)) fs.unlinkSync(caminhoMd);
    if (fs.existsSync(dirTemporario)) fs.rmdirSync(dirTemporario);
  }
});
