const test = require("node:test");
const assert = require("node:assert/strict");

const {
  decodificarEntidadesHtmlBasicas,
  normalizarDescricaoParaComparacaoCosmetica,
  diferencaApenasCosmetica,
  diferencaApenasAcentuacaoOuDiacritico,
} = require("../../backend/services/profor-2022/profor-pad-matching-service");

test("decodificarEntidadesHtmlBasicas converte &#039;, &apos;, &quot;, &amp; e &nbsp;", () => {
  assert.equal(decodificarEntidadesHtmlBasicas("Monitor 18,5 &#039; resolucao"), "Monitor 18,5 ' resolucao");
  assert.equal(decodificarEntidadesHtmlBasicas("Monitor &apos;A&apos;"), "Monitor 'A'");
  assert.equal(decodificarEntidadesHtmlBasicas("Texto &quot;X&quot;"), `Texto "X"`);
  assert.equal(decodificarEntidadesHtmlBasicas("A &amp; B"), "A & B");
  assert.equal(decodificarEntidadesHtmlBasicas("A&nbsp;B"), "A B");
  assert.equal(decodificarEntidadesHtmlBasicas(null), "");
  assert.equal(decodificarEntidadesHtmlBasicas(undefined), "");
});

test("normalizarDescricaoParaComparacaoCosmetica decodifica + strip diacritico + caixa + espacos", () => {
  const a = normalizarDescricaoParaComparacaoCosmetica("Monitor de led 18,5 &#039; resolução 192");
  const b = normalizarDescricaoParaComparacaoCosmetica("Monitor de led 18,5 ' RESOLUCAO 192");
  assert.equal(a, b);
});

test("diferencaApenasCosmetica detecta entidade HTML (Monitor 18,5)", () => {
  assert.equal(
    diferencaApenasCosmetica(
      "Monitor de led 18,5 &#039; resolução 192",
      "Monitor de led 18,5 ' resolução 192"
    ),
    true,
    "entidade HTML deve ser tratada como diferenca cosmetica"
  );
});

test("diferencaApenasCosmetica detecta diferenca apenas de capitalizacao (Meia Militar)", () => {
  assert.equal(
    diferencaApenasCosmetica("Meia Militar", "Meia militar"),
    true,
    "diferenca apenas de caixa deve ser cosmetica"
  );
});

test("diferencaApenasCosmetica detecta diferenca de acentuacao", () => {
  assert.equal(diferencaApenasCosmetica("Resolução", "Resolucao"), true);
});

test("diferencaApenasCosmetica considera trim/collapse: textos identicos apos collapse nao geram diferenca", () => {
  // O conferidor ja aplica collapse antes da comparacao, entao "Item  X" e
  // "Item X" entram como cleanA == cleanB e a funcao retorna false (sem
  // necessidade de saneamento porque ja sao iguais para fins praticos).
  assert.equal(diferencaApenasCosmetica("Item  X", "Item X"), false);
});

test("diferencaApenasCosmetica retorna false para textos identicos", () => {
  assert.equal(diferencaApenasCosmetica("Meia Militar", "Meia Militar"), false);
});

test("diferencaApenasCosmetica retorna false para diferenca real de descricao", () => {
  assert.equal(
    diferencaApenasCosmetica("Monitor de led 18,5'", "Monitor de led 24'"),
    false,
    "tamanhos diferentes nao podem ser cosmetica"
  );
  assert.equal(
    diferencaApenasCosmetica("Notebook 8GB", "Notebook 16GB"),
    false
  );
});

test("diferencaApenasAcentuacaoOuDiacritico segue funcionando para diacritico puro", () => {
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("Resolução", "Resolucao"), true);
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("Texto", "Texto"), false);
});
