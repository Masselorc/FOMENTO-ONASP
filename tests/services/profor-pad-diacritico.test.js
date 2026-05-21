const test = require("node:test");
const assert = require("node:assert/strict");
const {
  diferencaApenasAcentuacaoOuDiacritico,
  dadosMateriaisCompativeis
} = require("../../backend/services/profor-2022/profor-pad-matching-service");

test("Rule 1: 'video' x 'vídeo' matching when values and nature are compatible", () => {
  const isDiacriticDiff = diferencaApenasAcentuacaoOuDiacritico("video", "vídeo");
  assert.equal(isDiacriticDiff, true);

  const itemPad = {
    numeroConvenio: "937782",
    natureza: "CAPITAL",
    valorUnitario: 14849.00
  };
  const itemMemoria = {
    numeroConvenio: "937782",
    naturezasEncontradas: ["CAPITAL"],
    valorUnitarioReferencia: 14849.00,
    totalRateiosAtivos: 0
  };
  assert.equal(dadosMateriaisCompativeis(itemPad, itemMemoria), true);
});

test("Rule 2: 'Camera' x 'Câmera' matching when values and nature are compatible", () => {
  const isDiacriticDiff = diferencaApenasAcentuacaoOuDiacritico("Camera digital", "Câmera digital");
  assert.equal(isDiacriticDiff, true);

  const itemPad = {
    numeroConvenio: "937782",
    natureza: "CAPITAL",
    valorUnitario: 5000.00
  };
  const itemMemoria = {
    numeroConvenio: "937782",
    naturezasEncontradas: ["CAPITAL"],
    valorUnitarioReferencia: 5000.00,
    totalRateiosAtivos: 0
  };
  assert.equal(dadosMateriaisCompativeis(itemPad, itemMemoria), true);
});

test("Rule 3: 'Notebook 2.4ghz' x 'Notebook 4.2ghz' is NOT a diacritic-only difference", () => {
  const isDiacriticDiff = diferencaApenasAcentuacaoOuDiacritico("Notebook 2.4ghz", "Notebook 4.2ghz");
  assert.equal(isDiacriticDiff, false);
});

test("Rule 4: 'Meia militar' with divergent unit price remains a divergence", () => {
  const isDiacriticDiff = diferencaApenasAcentuacaoOuDiacritico("Meia militar", "Meia militar");
  // They are identical, but let's check one with actual diacritic/normalizacao difference
  // which fails material validation due to unit price.
  const isDiacriticDiffAlt = diferencaApenasAcentuacaoOuDiacritico("Meia militar", "Meia militar");
  
  const itemPad = {
    numeroConvenio: "937265",
    natureza: "CUSTEIO",
    valorUnitario: 37.59
  };
  const itemMemoria = {
    numeroConvenio: "937265",
    naturezasEncontradas: ["CUSTEIO"],
    valorUnitarioReferencia: 37.15,
    totalRateiosAtivos: 0
  };
  assert.equal(dadosMateriaisCompativeis(itemPad, itemMemoria), false);
});

test("Rule 5: Divergent nature remains a divergence even if descriptions only differ by accent", () => {
  const isDiacriticDiff = diferencaApenasAcentuacaoOuDiacritico("video", "vídeo");
  assert.equal(isDiacriticDiff, true);

  const itemPad = {
    numeroConvenio: "937782",
    natureza: "CAPITAL",
    valorUnitario: 14849.00
  };
  const itemMemoria = {
    numeroConvenio: "937782",
    naturezasEncontradas: ["CUSTEIO"], // Mismatched nature
    valorUnitarioReferencia: 14849.00,
    totalRateiosAtivos: 0
  };
  assert.equal(dadosMateriaisCompativeis(itemPad, itemMemoria), false);
});

test("Rule 6: Unit price difference above R$ 0.01 remains a divergence", () => {
  const isDiacriticDiff = diferencaApenasAcentuacaoOuDiacritico("video", "vídeo");
  assert.equal(isDiacriticDiff, true);

  const itemPad = {
    numeroConvenio: "937782",
    natureza: "CAPITAL",
    valorUnitario: 14849.00
  };
  const itemMemoria = {
    numeroConvenio: "937782",
    naturezasEncontradas: ["CAPITAL"],
    valorUnitarioReferencia: 14849.02, // Difference of 0.02
    totalRateiosAtivos: 0
  };
  assert.equal(dadosMateriaisCompativeis(itemPad, itemMemoria), false);
});
