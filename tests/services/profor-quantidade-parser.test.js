const test = require("node:test");
const assert = require("node:assert/strict");

const {
  moedaParaNumeroProfor,
  quantidadeParaNumeroProfor,
} = require("../../backend/services/profor-2022/profor-plano-aplicacao-service");
const { converterQuantidadePad } = require("../../backend/services/profor-2022/profor-pad-normalizacao-service");

test("moedaParaNumeroProfor mantem semantica monetaria existente", () => {
  assert.equal(moedaParaNumeroProfor("1.234,56"), 1234.56);
  assert.equal(moedaParaNumeroProfor("726,00"), 726);
  assert.equal(moedaParaNumeroProfor("1.0"), 10);
});

test("quantidadeParaNumeroProfor nao infla decimal simples", () => {
  assert.equal(quantidadeParaNumeroProfor("1.0"), 1);
  assert.equal(quantidadeParaNumeroProfor("1,0"), 1);
  assert.equal(quantidadeParaNumeroProfor("2.5"), 2.5);
  assert.equal(quantidadeParaNumeroProfor("2,5"), 2.5);
});

test("quantidadeParaNumeroProfor trata separadores mistos", () => {
  assert.equal(quantidadeParaNumeroProfor("1,234.56"), 1234.56);
  assert.equal(quantidadeParaNumeroProfor("1.234,56"), 1234.56);
  assert.equal(quantidadeParaNumeroProfor("5.700.000"), 5700);
});

test("converterQuantidadePad preserva decimal dos relatorios PAD", () => {
  const quantidade = converterQuantidadePad("57.0");
  assert.equal(quantidade.valido, true);
  assert.equal(quantidade.valor, 57);
});
