const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  ORIGENS_DADOS_PROFOR_2022,
  ORIGEM_PADRAO_PROFOR_2022,
  normalizarOrigemDadosProfor2022,
  resolverOrigemDadosProfor2022,
  deveUsarBancoCacheProfor2022,
  deveUsarPlanilhaProfor2022,
  deveUsarReconstrucaoPadProfor2022,
} = require("../../backend/services/profor-2022/profor-origem-service");

const {
  CAMINHO_PADRAO_RECONSTRUCAO_PAD,
  CAMPOS_OBRIGATORIOS_ITEM,
  ReconstrucaoPadIndisponivelError,
  ReconstrucaoPadInvalidaError,
  resolverCaminhoReconstrucaoPad,
  validarEstruturaReconstrucaoPad,
  adaptarItemReconstrucaoPad,
  carregarPlanoAplicacaoReconstrucaoPad,
} = require("../../backend/services/profor-2022/profor-pad-origem-reconstrucao-service");

function itemReconstrucaoValido(overrides = {}) {
  return {
    uf: "MT",
    instrumento: "Convênio",
    numero: "937698",
    ano: "2022",
    area: "OUVIDORIA",
    natureza: "CUSTEIO",
    descricao: "Item de teste",
    quantidade: 10,
    valorUnitario: 5.5,
    valorPrevisto: 55,
    valorExecutado: 22,
    saldo: 33,
    saldoEconomicidade: 33,
    percentualExecucao: 40,
    ...overrides,
  };
}

function escreverArquivoTemporario(payload) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "profor-reconstrucao-pad-"));
  const caminho = path.join(tmp, "reconstrucao.json");
  fs.writeFileSync(caminho, typeof payload === "string" ? payload : JSON.stringify(payload), "utf8");
  return caminho;
}

test("ORIGENS_DADOS_PROFOR_2022 aceita apenas reconstrucao-pad como origem operacional", () => {
  assert.deepEqual(ORIGENS_DADOS_PROFOR_2022, ["reconstrucao-pad"]);
});

test("ORIGEM_PADRAO_PROFOR_2022 e reconstrucao-pad", () => {
  assert.equal(ORIGEM_PADRAO_PROFOR_2022, "reconstrucao-pad");
});

test("normalizarOrigemDadosProfor2022 aceita reconstrucao-pad em variacoes de caixa/espaco", () => {
  assert.equal(normalizarOrigemDadosProfor2022("reconstrucao-pad"), "reconstrucao-pad");
  assert.equal(normalizarOrigemDadosProfor2022("RECONSTRUCAO-PAD"), "reconstrucao-pad");
  assert.equal(normalizarOrigemDadosProfor2022("  reconstrucao-pad  "), "reconstrucao-pad");
});

test("normalizarOrigemDadosProfor2022 nao preserva origens legadas", () => {
  assert.equal(normalizarOrigemDadosProfor2022("planilha"), "reconstrucao-pad");
  assert.equal(normalizarOrigemDadosProfor2022("banco-cache"), "reconstrucao-pad");
});

test("normalizarOrigemDadosProfor2022 cai para reconstrucao-pad quando origem invalida", () => {
  assert.equal(normalizarOrigemDadosProfor2022("origem-inexistente"), ORIGEM_PADRAO_PROFOR_2022);
  assert.equal(normalizarOrigemDadosProfor2022(""), ORIGEM_PADRAO_PROFOR_2022);
  assert.equal(normalizarOrigemDadosProfor2022(undefined), ORIGEM_PADRAO_PROFOR_2022);
  assert.equal(normalizarOrigemDadosProfor2022(null), ORIGEM_PADRAO_PROFOR_2022);
});

test("resolverOrigemDadosProfor2022 emite aviso ao receber origem invalida e usa fallback", () => {
  const r = resolverOrigemDadosProfor2022({ origemDados: "xyz", detalhado: true });
  assert.equal(r.origemDados, ORIGEM_PADRAO_PROFOR_2022);
  assert.ok(Array.isArray(r.avisos) && r.avisos.length === 1);
  assert.match(r.avisos[0], /invalida/i);
});

test("resolverOrigemDadosProfor2022 aceita reconstrucao-pad sem avisos", () => {
  const r = resolverOrigemDadosProfor2022({ origemDados: "reconstrucao-pad", detalhado: true });
  assert.equal(r.origemDados, "reconstrucao-pad");
  assert.deepEqual(r.avisos, []);
});

test("flags por origem retornam true apenas para reconstrucao-pad", () => {
  assert.equal(deveUsarBancoCacheProfor2022({ origemDados: "banco-cache" }), false);
  assert.equal(deveUsarBancoCacheProfor2022({ origemDados: "planilha" }), false);
  assert.equal(deveUsarBancoCacheProfor2022({ origemDados: "reconstrucao-pad" }), false);

  assert.equal(deveUsarPlanilhaProfor2022({ origemDados: "planilha" }), false);
  assert.equal(deveUsarPlanilhaProfor2022({ origemDados: "banco-cache" }), false);
  assert.equal(deveUsarPlanilhaProfor2022({ origemDados: "reconstrucao-pad" }), false);

  assert.equal(deveUsarReconstrucaoPadProfor2022({ origemDados: "reconstrucao-pad" }), true);
  assert.equal(deveUsarReconstrucaoPadProfor2022({ origemDados: "banco-cache" }), true);
  assert.equal(deveUsarReconstrucaoPadProfor2022({ origemDados: "planilha" }), true);
});

test("resolverCaminhoReconstrucaoPad usa padrao quando nada e informado", () => {
  assert.equal(resolverCaminhoReconstrucaoPad(), CAMINHO_PADRAO_RECONSTRUCAO_PAD);
  assert.equal(resolverCaminhoReconstrucaoPad({}), CAMINHO_PADRAO_RECONSTRUCAO_PAD);
});

test("CAMPOS_OBRIGATORIOS_ITEM cobre os campos minimos esperados pelo planoAplicacao", () => {
  const esperados = [
    "uf",
    "instrumento",
    "numero",
    "ano",
    "area",
    "natureza",
    "descricao",
    "quantidade",
    "valorUnitario",
    "valorPrevisto",
    "valorExecutado",
    "saldo",
    "saldoEconomicidade",
    "percentualExecucao",
  ];
  for (const campo of esperados) {
    assert.ok(CAMPOS_OBRIGATORIOS_ITEM.includes(campo), `Campo obrigatorio ausente: ${campo}`);
  }
});

test("validarEstruturaReconstrucaoPad rejeita payload sem planoAplicacaoReconstruido", () => {
  assert.throws(
    () => validarEstruturaReconstrucaoPad({ geradoEm: "x", modo: "dry-run" }),
    ReconstrucaoPadInvalidaError
  );
});

test("validarEstruturaReconstrucaoPad rejeita planoAplicacaoReconstruido vazio", () => {
  assert.throws(
    () => validarEstruturaReconstrucaoPad({ planoAplicacaoReconstruido: [] }),
    ReconstrucaoPadInvalidaError
  );
});

test("validarEstruturaReconstrucaoPad rejeita item com campo obrigatorio ausente", () => {
  const item = itemReconstrucaoValido();
  delete item.uf;
  assert.throws(
    () => validarEstruturaReconstrucaoPad({ planoAplicacaoReconstruido: [item] }),
    /campo obrigatorio 'uf'/i
  );
});

test("validarEstruturaReconstrucaoPad rejeita item com numerico invalido (sem mascarar)", () => {
  const item = itemReconstrucaoValido({ valorPrevisto: "N/A" });
  assert.throws(
    () => validarEstruturaReconstrucaoPad({ planoAplicacaoReconstruido: [item] }),
    /'valorPrevisto'/
  );
});

test("validarEstruturaReconstrucaoPad rejeita quando minimoLinhasExigido nao e atingido", () => {
  const payload = { planoAplicacaoReconstruido: [itemReconstrucaoValido()] };
  assert.throws(
    () => validarEstruturaReconstrucaoPad(payload, { minimoLinhasExigido: 2 }),
    /menor que o minimo/i
  );
});

test("validarEstruturaReconstrucaoPad rejeita quando conveniosEsperados nao bate", () => {
  const payload = {
    planoAplicacaoReconstruido: [
      itemReconstrucaoValido({ numero: "A" }),
      itemReconstrucaoValido({ numero: "B" }),
    ],
  };
  assert.throws(
    () => validarEstruturaReconstrucaoPad(payload, { conveniosEsperados: 5 }),
    /difere do esperado/i
  );
});

test("validarEstruturaReconstrucaoPad aceita payload valido e retorna totais", () => {
  const payload = {
    planoAplicacaoReconstruido: [
      itemReconstrucaoValido({ numero: "A" }),
      itemReconstrucaoValido({ numero: "B" }),
      itemReconstrucaoValido({ numero: "B" }),
    ],
  };
  const r = validarEstruturaReconstrucaoPad(payload);
  assert.equal(r.totalLinhas, 3);
  assert.equal(r.totalConvenios, 2);
});

test("adaptarItemReconstrucaoPad projeta exatamente os campos canonicos do planoAplicacao", () => {
  const adaptado = adaptarItemReconstrucaoPad(itemReconstrucaoValido({
    origemReconstrucao: "relatorios-pad-rateados",
    chaveItem: "deve-ser-descartado",
    decisaoAplicada: { id: 1 },
  }));
  assert.deepEqual(Object.keys(adaptado).sort(), [...CAMPOS_OBRIGATORIOS_ITEM].sort());
});

test("carregarPlanoAplicacaoReconstrucaoPad falha explicitamente quando arquivo ausente (sem fallback silencioso)", () => {
  const inexistente = path.join(os.tmpdir(), `profor-${Date.now()}-inexistente.json`);
  assert.throws(
    () => carregarPlanoAplicacaoReconstrucaoPad({ caminho: inexistente }),
    ReconstrucaoPadIndisponivelError
  );
});

test("carregarPlanoAplicacaoReconstrucaoPad falha explicitamente quando JSON e invalido", () => {
  const caminho = escreverArquivoTemporario("{ json invalido aqui");
  assert.throws(
    () => carregarPlanoAplicacaoReconstrucaoPad({ caminho }),
    ReconstrucaoPadInvalidaError
  );
  fs.rmSync(path.dirname(caminho), { recursive: true, force: true });
});

test("carregarPlanoAplicacaoReconstrucaoPad le o relatorio dry-run real e bate 568 linhas / 15 convenios", () => {
  const r = carregarPlanoAplicacaoReconstrucaoPad();
  assert.equal(r.metadados.totalLinhas, 568);
  assert.equal(r.metadados.totalConvenios, 15);
  assert.equal(r.metadados.origemReconstrucao, "relatorios-pad-rateados");
  assert.equal(r.planoAplicacao.length, 568);
  for (const campo of CAMPOS_OBRIGATORIOS_ITEM) {
    assert.ok(campo in r.planoAplicacao[0], `Campo canonico ausente: ${campo}`);
  }
});

test("carregarPlanoAplicacaoReconstrucaoPad respeita conveniosEsperados=15 e minimoLinhasExigido=568", () => {
  const r = carregarPlanoAplicacaoReconstrucaoPad({
    conveniosEsperados: 15,
    minimoLinhasExigido: 568,
  });
  assert.equal(r.metadados.totalConvenios, 15);
  assert.equal(r.metadados.totalLinhas, 568);
});

test("modulo de origem reconstrucao-pad NAO importa publicacao, SQLite, init-db ou Transferegov", () => {
  const conteudo = fs.readFileSync(
    path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-origem-reconstrucao-service.js"),
    "utf8"
  );
  // Considera apenas linhas executaveis (sem comentarios) para inspecionar dependencias e efeitos.
  const codigoExecutavel = conteudo
    .split("\n")
    .filter((linha) => !/^\s*\/\//.test(linha))
    .join("\n");
  const requires = (codigoExecutavel.match(/require\(\s*["'][^"']+["']\s*\)/g) || []).map((m) =>
    m.replace(/^require\(\s*["']/, "").replace(/["']\s*\)$/, "")
  );
  for (const dep of requires) {
    assert.ok(!/publicar-/.test(dep), `require proibido (publicacao): ${dep}`);
    assert.ok(!/init-db|onasp\.sqlite/.test(dep), `require proibido (SQLite/init-db): ${dep}`);
    assert.ok(!/transferegov/i.test(dep), `require proibido (Transferegov): ${dep}`);
    assert.ok(!/publicar-dados-estaticos|publicar-profor-2022-estatico/.test(dep), `require proibido (script publicacao): ${dep}`);
  }
  // Nenhuma escrita em arquivos via fs.writeFile* ou fs.appendFile* — a origem e somente leitura.
  assert.ok(!/fs\.writeFile|fs\.writeFileSync|fs\.appendFile|fs\.appendFileSync/.test(codigoExecutavel),
    "Origem reconstrucao-pad nao pode escrever em arquivos (somente leitura).");
});
