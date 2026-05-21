const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classificarDivergenciaDiacritico,
  montarSaneadasMap,
  diferencaApenasAcentuacaoOuDiacritico,
  valorUnitarioCompativel,
} = require("../../backend/services/profor-2022/profor-pad-diacritico-auditoria-service");

/* ----------------------- helpers de diferença textual ----------------------- */

test("acento simples é detectado como diferença apenas de diacrítico", () => {
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("video", "vídeo"), true);
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("minimo", "mínimo"), true);
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("Camera", "Câmera"), true);
});

test("diferença numérica/técnica NÃO é diferença apenas de diacrítico", () => {
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("Notebook 2.4ghz", "Notebook 4.2ghz"), false);
});

test("textos idênticos não contam como divergência de diacrítico", () => {
  assert.equal(diferencaApenasAcentuacaoOuDiacritico("Meia militar", "Meia militar"), false);
});

test("valor unitário compatível respeita tolerância de R$ 0,01", () => {
  assert.equal(valorUnitarioCompativel(14849.0, 14849.0), true);
  assert.equal(valorUnitarioCompativel(14849.0, 14849.009), true);
  assert.equal(valorUnitarioCompativel(37.15, 37.59), false);
});

/* --------------- classificação: equivalencia_por_descricao_normalizada --------------- */

test("equivalência com acento simples e dados materiais compatíveis é saneável", () => {
  const div = {
    id: 25,
    tipo_alerta: "equivalencia_por_descricao_normalizada",
    status: "PENDENTE",
    numero_convenio: "937782",
  };
  const payload = {
    descricaoMemoria: "Desktop para edição de video",
    descricaoPad: "Desktop para edição de vídeo",
    valorUnitarioMemoria: 14849.0,
    valorUnitarioPad: 14849.0,
    naturezaMemoria: "CAPITAL",
    naturezaPad: "CAPITAL",
  };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "saneavel_automaticamente_por_diacritico");
});

test("divergência de valor impede saneamento mesmo com acento simples (#24 Meia militar)", () => {
  const div = {
    id: 24,
    tipo_alerta: "equivalencia_por_descricao_normalizada",
    status: "PENDENTE",
    numero_convenio: "937265",
  };
  const payload = {
    descricaoMemoria: "Meia Militar",
    descricaoPad: "Meia militar",
    valorUnitarioMemoria: 37.15,
    valorUnitarioPad: 37.59,
    naturezaMemoria: "CUSTEIO",
    naturezaPad: "CUSTEIO",
  };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "divergencia_material");
});

test("divergência técnica numérica (2.4ghz x 4.2ghz) impede saneamento", () => {
  const div = {
    id: 99,
    tipo_alerta: "equivalencia_por_descricao_normalizada",
    status: "PENDENTE",
    numero_convenio: "937782",
  };
  const payload = {
    descricaoMemoria: "Notebook 2.4ghz",
    descricaoPad: "Notebook 4.2ghz",
    valorUnitarioMemoria: 3599.99,
    valorUnitarioPad: 3599.99,
    naturezaMemoria: "CAPITAL",
    naturezaPad: "CAPITAL",
  };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "divergencia_material");
});

test("natureza divergente impede saneamento mesmo com acento simples", () => {
  const div = {
    id: 88,
    tipo_alerta: "equivalencia_por_descricao_normalizada",
    status: "PENDENTE",
    numero_convenio: "937782",
  };
  const payload = {
    descricaoMemoria: "Switcher de video",
    descricaoPad: "Switcher de vídeo",
    valorUnitarioMemoria: 1000.0,
    valorUnitarioPad: 1000.0,
    naturezaMemoria: "CUSTEIO",
    naturezaPad: "CAPITAL",
  };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "divergencia_material");
});

test("divergência já decidida é classificada como ja_decidido (não saneável)", () => {
  const div = {
    id: 25,
    tipo_alerta: "equivalencia_por_descricao_normalizada",
    status: "ACEITO",
    numero_convenio: "937782",
  };
  const payload = {
    descricaoMemoria: "Desktop para edição de video",
    descricaoPad: "Desktop para edição de vídeo",
    valorUnitarioMemoria: 14849.0,
    valorUnitarioPad: 14849.0,
  };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "ja_decidido");
});

/* ---------------------- classificação: item_ausente_no_pad ---------------------- */

test("item ausente com correspondência por diacrítico (flag payload) é saneável", () => {
  const div = {
    id: 75,
    tipo_alerta: "item_ausente_no_pad",
    status: "PENDENTE",
    numero_convenio: "937782",
    valor_anterior: "presente_na_memoria",
  };
  const payload = {
    descricaoMemoria: "Desktop para edição de video",
    saneadoPorDiacritico: true,
  };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "saneavel_automaticamente_por_diacritico");
});

test("item ausente com correspondência no mapa de equivalências é saneável", () => {
  const div = {
    id: 75,
    tipo_alerta: "item_ausente_no_pad",
    status: "PENDENTE",
    numero_convenio: "937782",
    valor_anterior: "presente_na_memoria",
  };
  const payload = { descricaoMemoria: "Desktop para edição de video" };
  const saneadasMap = montarSaneadasMap([
    {
      numeroConvenio: "937782",
      descricaoOriginalMemoria: "Desktop para edição de video",
      descricaoOriginalPad: "Desktop para edição de vídeo",
    },
  ]);
  const r = classificarDivergenciaDiacritico(div, payload, saneadasMap);
  assert.equal(r.classificacao, "saneavel_automaticamente_por_diacritico");
});

test("item ausente real sem correspondência fica como histórico não reapresentado", () => {
  const div = {
    id: 120,
    tipo_alerta: "item_ausente_no_pad",
    status: "PENDENTE",
    numero_convenio: "937221",
    valor_anterior: "presente_na_memoria",
  };
  const payload = { descricaoMemoria: "Ar condicionado Split 24000 BTUs", saneadoPorDiacritico: false };
  const r = classificarDivergenciaDiacritico(div, payload, new Map());
  assert.equal(r.classificacao, "historico_nao_reapresentado_sem_correspondencia");
});

test("item_ausente_no_pad NÃO usa descrição em valorAnterior (marcador de estado)", () => {
  // valor_anterior é o marcador 'presente_na_memoria', nunca a descrição textual.
  const div = {
    id: 75,
    tipo_alerta: "item_ausente_no_pad",
    status: "PENDENTE",
    numero_convenio: "937782",
    valor_anterior: "presente_na_memoria",
    valor_novo: "ausente_no_pad",
  };
  assert.equal(div.valor_anterior, "presente_na_memoria");
  assert.notEqual(div.valor_anterior, "Desktop para edição de video");
  // A descrição vem do payload, não do valor_anterior.
  const payload = { descricaoMemoria: "Desktop para edição de video", saneadoPorDiacritico: true };
  const r = classificarDivergenciaDiacritico(div, payload);
  assert.equal(r.classificacao, "saneavel_automaticamente_por_diacritico");
});

test("item ausente sem descrição no payload fica como dados_insuficientes", () => {
  const div = {
    id: 130,
    tipo_alerta: "item_ausente_no_pad",
    status: "PENDENTE",
    numero_convenio: "937221",
    valor_anterior: "presente_na_memoria",
  };
  const r = classificarDivergenciaDiacritico(div, {}, new Map());
  assert.equal(r.classificacao, "dados_insuficientes");
});
