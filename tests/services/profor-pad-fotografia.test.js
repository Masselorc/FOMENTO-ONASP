const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const {
  CAMPOS_CANONICOS,
  gerarFotografiaCanonica,
  salvarFotografia,
  normalizarTextoParaChave,
} = require("../../backend/services/profor-2022/profor-pad-fotografia-service");

function linha(overrides = {}) {
  return {
    uf: "DF",
    instrumento: "Convênio",
    numero: "123456",
    ano: "2022",
    area: "Ouvidoria",
    natureza: "CUSTEIO",
    descricao: "Notebook",
    quantidade: 1,
    valorPrevisto: 1000,
    valorExecutado: 100,
    ...overrides,
  };
}

test("Fotografia canônica v0.2 - valida entrada e metadados", () => {
  assert.throws(() => gerarFotografiaCanonica(null), /fornecido deve ser um array/i);
  assert.throws(() => gerarFotografiaCanonica("não-é-um-array"), /fornecido deve ser um array/i);

  const foto = gerarFotografiaCanonica([linha()]);
  assert.equal(foto.versaoSnapshot, "0.2");
  assert.equal(foto.origem, "reconstrucao-pad");
  assert.equal(foto.parserVersao, "profor-pad-fotografia-service@0.2");
  assert.equal(foto.resumo.totalLinhas, 1);
  assert.equal(foto.resumo.valorPrevistoTotal, foto.resumo.totalValorPrevisto);
});

test("Fotografia canônica v0.2 - itens preservam campos antigos e adicionam chaves", () => {
  const foto = gerarFotografiaCanonica([linha({ descricao: " Câmera   fotográfica " })]);
  const item = foto.planoAplicacao[0];

  for (const campo of CAMPOS_CANONICOS) {
    assert.ok(campo in item, `Campo ${campo} deveria permanecer no item canônico`);
  }

  assert.equal(item.descricaoOriginal, "Câmera fotográfica");
  assert.equal(item.descricaoNormalizada, "CÂMERA FOTOGRÁFICA");
  assert.match(item.chaveMaterial, /CAMERA FOTOGRAFICA/);
  assert.match(item.chaveComparacao, /CAMERA FOTOGRAFICA/);
  assert.match(item.hashItem, /^[a-f0-9]{64}$/);
  assert.deepEqual(item.avisos, []);
});

test("Fotografia canônica v0.2 - quantidade 1.0 vira 1, nunca 10", () => {
  const foto = gerarFotografiaCanonica([
    linha({ quantidade: "1.0" }),
  ]);
  assert.equal(foto.planoAplicacao[0].quantidade, 1);
});

test("Fotografia canônica v0.2 - hashItem muda com valor previsto e quantidade", () => {
  const base = gerarFotografiaCanonica([linha()]);
  const valorAlterado = gerarFotografiaCanonica([linha({ valorPrevisto: 1000.02 })]);
  const quantidadeAlterada = gerarFotografiaCanonica([linha({ quantidade: 2 })]);

  assert.notEqual(base.planoAplicacao[0].hashItem, valorAlterado.planoAplicacao[0].hashItem);
  assert.notEqual(base.planoAplicacao[0].hashItem, quantidadeAlterada.planoAplicacao[0].hashItem);
});

test("Fotografia canônica v0.2 - CAPITAL e CUSTEIO geram chaves diferentes", () => {
  const foto = gerarFotografiaCanonica([
    linha({ natureza: "CAPITAL" }),
    linha({ natureza: "CUSTEIO" }),
  ]);
  const [capital, custeio] = foto.planoAplicacao;
  assert.notEqual(capital.chaveMaterial, custeio.chaveMaterial);
  assert.notEqual(capital.chaveComparacao, custeio.chaveComparacao);
  assert.notEqual(capital.hashItem, custeio.hashItem);
});

test("Fotografia canônica v0.2 - espaços e pontuação leve não alteram chave normalizada", () => {
  assert.equal(
    normalizarTextoParaChave(" Câmera,   fotográfica! "),
    normalizarTextoParaChave("Camera fotografica")
  );
});

test("Fotografia canônica v0.2 - campo essencial ausente gera aviso controlado", () => {
  const foto = gerarFotografiaCanonica([linha({ descricao: "" })]);
  assert.equal(foto.resumo.totalAvisos, 1);
  assert.equal(foto.planoAplicacao[0].avisos[0].tipo, "dados_insuficientes");
});

test("Fotografia canônica v0.2 - checksum é estável com itens em ordem diferente", () => {
  const a = gerarFotografiaCanonica([
    linha({ numero: "222222", descricao: "Mesa" }),
    linha({ numero: "111111", descricao: "Cadeira" }),
  ]);
  const b = gerarFotografiaCanonica([
    linha({ numero: "111111", descricao: "Cadeira" }),
    linha({ numero: "222222", descricao: "Mesa" }),
  ]);

  assert.equal(a.checksum, b.checksum);
});

test("Fotografia canônica v0.2 - colisão e chave ambígua são registradas", () => {
  const foto = gerarFotografiaCanonica([
    linha({ descricao: "Câmera", valorPrevisto: 100 }),
    linha({ descricao: "Camera", valorPrevisto: 200 }),
  ]);
  assert.ok(foto.avisos.some((aviso) => aviso.tipo === "colisao_chave"));
  assert.ok(foto.avisos.some((aviso) => aviso.tipo === "chave_ambigua"));
});

test("Fotografia canônica v0.2 - persistência em disco", () => {
  const dirTemporario = path.join(__dirname, "../../backend/data/relatorios/test_temp");
  const caminhoArquivo = path.join(dirTemporario, "foto_teste.json");
  const foto = gerarFotografiaCanonica([linha()]);

  try {
    salvarFotografia(caminhoArquivo, foto);
    assert.ok(fs.existsSync(caminhoArquivo));
    const fotoLida = JSON.parse(fs.readFileSync(caminhoArquivo, "utf8"));
    assert.equal(fotoLida.checksum, foto.checksum);
    assert.equal(fotoLida.versaoSnapshot, "0.2");
  } finally {
    if (fs.existsSync(caminhoArquivo)) fs.unlinkSync(caminhoArquivo);
    if (fs.existsSync(dirTemporario)) fs.rmdirSync(dirTemporario);
  }
});
