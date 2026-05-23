const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const {
  CAMPOS_CANONICOS,
  gerarFotografiaCanonica,
  salvarFotografia,
} = require("../../backend/services/profor-2022/profor-pad-fotografia-service");

test("Fotografia Canônica - Validações Básicas", () => {
  assert.throws(() => {
    gerarFotografiaCanonica(null);
  }, /fornecido deve ser um array/i);

  assert.throws(() => {
    gerarFotografiaCanonica("não-é-um-array");
  }, /fornecido deve ser um array/i);
});

test("Fotografia Canônica - Filtragem estrita dos 14 campos canônicos", () => {
  const planoMock = [
    {
      uf: "DF",
      instrumento: "Convênio",
      numero: "123456",
      ano: "2022",
      area: "Ouvidoria",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 5,
      valorUnitario: 1000,
      valorPrevisto: 5000,
      valorExecutado: 3000,
      saldo: 2000,
      saldoEconomicidade: 0,
      percentualExecucao: 60,
      // Metadados extras que devem ser descartados
      chaveItem: "DF::Notebook",
      origemReconstrucao: "teste",
      linhaOrigem: 42,
    },
  ];

  const foto = gerarFotografiaCanonica(planoMock);

  assert.equal(foto.resumo.totalLinhas, 1);
  const item = foto.planoAplicacao[0];

  // Verifica que todos os 14 campos canônicos estão presentes
  for (const campo of CAMPOS_CANONICOS) {
    assert.ok(campo in item, `Campo ${campo} deveria estar presente na linha filtrada`);
  }

  // Verifica que os campos extras foram descartados
  assert.equal(item.chaveItem, undefined);
  assert.equal(item.origemReconstrucao, undefined);
  assert.equal(item.linhaOrigem, undefined);
});

test("Fotografia Canônica - Ordenação Determinística", () => {
  const planoMock = [
    {
      uf: "DF",
      numero: "222222",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 1,
    },
    {
      uf: "DF",
      numero: "111111",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 1,
    },
    {
      uf: "AC",
      numero: "111111",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 1,
    },
    {
      uf: "AC",
      numero: "111111",
      area: "CORREGEDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 1,
    },
    {
      uf: "AC",
      numero: "111111",
      area: "CORREGEDORIA",
      natureza: "CAPITAL",
      descricao: "Notebook",
      quantidade: 1,
    },
    {
      uf: "AC",
      numero: "111111",
      area: "CORREGEDORIA",
      natureza: "CAPITAL",
      descricao: "Cadeira",
      quantidade: 1,
    },
  ];

  const foto = gerarFotografiaCanonica(planoMock);
  const ordenado = foto.planoAplicacao;

  // Verificações de ordem:
  // 1. numero: "111111" vem antes de "222222"
  // 2. uf: AC vem antes de DF
  // 3. area: CORREGEDORIA vem antes de OUVIDORIA
  // 4. natureza: CAPITAL vem antes de CUSTEIO
  // 5. descricao: Cadeira vem antes de Notebook

  assert.equal(ordenado[0].uf, "AC");
  assert.equal(ordenado[0].numero, "111111");
  assert.equal(ordenado[0].area, "CORREGEDORIA");
  assert.equal(ordenado[0].natureza, "CAPITAL");
  assert.equal(ordenado[0].descricao, "Cadeira");

  assert.equal(ordenado[1].descricao, "Notebook"); // mesmo nº, uf, area, nat, desc diferente

  assert.equal(ordenado[2].natureza, "CUSTEIO"); // mesmo nº, uf, area, nat diferente

  assert.equal(ordenado[3].area, "OUVIDORIA"); // mesmo nº, uf, area diferente

  assert.equal(ordenado[4].uf, "DF"); // mesmo nº, uf diferente

  assert.equal(ordenado[5].numero, "222222"); // nº diferente
});

test("Fotografia Canônica - Estabilidade do Checksum", () => {
  const planoMockA = [
    {
      uf: "DF",
      numero: "123456",
      area: "Ouvidoria",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 2,
      valorPrevisto: 1000,
    },
  ];

  const planoMockB = [
    {
      uf: "DF",
      numero: "123456",
      area: "Ouvidoria",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 2.0, // Equivalente numericamente
      valorPrevisto: 1000.0, // Equivalente numericamente
    },
  ];

  const planoMockC = [
    {
      uf: "DF",
      numero: "123456",
      area: "Ouvidoria",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 2,
      valorPrevisto: 1000.01, // Modificado em centavos
    },
  ];

  const fotoA = gerarFotografiaCanonica(planoMockA);
  const fotoB = gerarFotografiaCanonica(planoMockB);
  const fotoC = gerarFotografiaCanonica(planoMockC);

  // A e B devem ter checksums idênticos
  assert.equal(fotoA.checksum, fotoB.checksum);

  // A e C devem ter checksums diferentes
  assert.notEqual(fotoA.checksum, fotoC.checksum);
});

test("Fotografia Canônica - Arredondamento e Resumos Financeiros", () => {
  const planoMock = [
    {
      uf: "DF",
      numero: "123",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Item 1",
      quantidade: 1.3333333, // Deve arredondar para 1.333333
      valorPrevisto: 100.004, // Deve arredondar para 100.00
      valorExecutado: 50.006, // Deve arredondar para 50.01
    },
  ];

  const foto = gerarFotografiaCanonica(planoMock);
  const item = foto.planoAplicacao[0];

  assert.equal(item.quantidade, 1.333333);
  assert.equal(item.valorPrevisto, 100);
  assert.equal(item.valorExecutado, 50.01);
  assert.equal(item.saldo, 49.99); // 100 - 50.01

  // Resumo deve bater
  assert.equal(foto.resumo.totalLinhas, 1);
  assert.equal(foto.resumo.valorPrevistoTotal, 100);
  assert.equal(foto.resumo.valorExecutadoTotal, 50.01);
  assert.equal(foto.resumo.saldoTotal, 49.99);
  assert.equal(foto.resumo.quantidadeTotal, 1.333333);
});

test("Fotografia Canônica - Persistência em disco", () => {
  const dirTemporario = path.join(__dirname, "../../backend/data/relatorios/test_temp");
  const caminhoArquivo = path.join(dirTemporario, "foto_teste.json");

  const planoMock = [
    {
      uf: "DF",
      numero: "123",
      area: "OUVIDORIA",
      natureza: "CUSTEIO",
      descricao: "Notebook",
      quantidade: 1,
    },
  ];

  const foto = gerarFotografiaCanonica(planoMock);

  try {
    salvarFotografia(caminhoArquivo, foto);

    assert.ok(fs.existsSync(caminhoArquivo), "Arquivo de snapshot deveria ter sido salvo.");
    const conteudo = fs.readFileSync(caminhoArquivo, "utf8");
    const fotoLida = JSON.parse(conteudo);

    assert.equal(fotoLida.checksum, foto.checksum);
    assert.equal(fotoLida.resumo.totalLinhas, 1);
  } finally {
    // Cleanup
    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }
    if (fs.existsSync(dirTemporario)) {
      fs.rmdirSync(dirTemporario);
    }
  }
});
