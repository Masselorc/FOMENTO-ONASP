const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = require("../../backend/services/profor-2022/profor-pad-historico-repository");
const consulta = require("../../backend/services/profor-2022/profor-pad-historico-consulta-service");

const ROOT = path.resolve(__dirname, "../..");
const originais = {
  listarAtualizacoesPorMes: repository.listarAtualizacoesPorMes,
  listarAtualizacoesPorData: repository.listarAtualizacoesPorData,
  buscarDetalheAtualizacao: repository.buscarDetalheAtualizacao,
};

test.afterEach(() => {
  Object.assign(repository, originais);
});

function rejeicaoStatus(statusCode) {
  return (erro) => erro instanceof consulta.HistoricoPadConsultaError
    && erro.statusCode === statusCode;
}

test("consulta mensal valida YYYY-MM, encaminha mês e retorna dias", async () => {
  const executor = { query: true };
  const dias = [{ data: "2026-09-29", totalExecucoes: 2, comAlteracoes: 1, semAlteracoes: 1, falhas: 0 }];
  repository.listarAtualizacoesPorMes = async (filtros, repassado) => {
    assert.deepEqual(filtros, { mes: "2026-09" });
    assert.equal(repassado, executor);
    return dias;
  };
  assert.deepEqual(await consulta.consultarHistoricoPad({ mes: "2026-09" }, executor), { mes: "2026-09", dias });
});

test("mês inválido, ausente, combinado com data ou malformado retorna 400", async () => {
  for (const mes of ["0000-01", "2026-00", "2026-13", "2026-9", "texto"]) {
    await assert.rejects(consulta.consultarHistoricoPad({ mes }), rejeicaoStatus(400));
  }
  await assert.rejects(consulta.consultarHistoricoPad({}), rejeicaoStatus(400));
  await assert.rejects(consulta.consultarHistoricoPad({ mes: "2026-09", data: "2026-09-29" }), rejeicaoStatus(400));
});

test("data civil válida consulta repository sem reordenar e repassa executor", async () => {
  const executor = { tx: true };
  const execucoes = [{ id: 9 }, { id: 4 }];
  let parametrosRecebidos;
  repository.listarAtualizacoesPorData = async (parametros, repassado) => {
    parametrosRecebidos = parametros;
    assert.equal(repassado, executor);
    return execucoes;
  };
  const resposta = await consulta.consultarHistoricoPad({ data: "2026-09-29" }, executor);
  assert.deepEqual(parametrosRecebidos, { data: "2026-09-29" });
  assert.deepEqual(resposta, { data: "2026-09-29", filtros: {}, execucoes });
  assert.equal(resposta.execucoes, execucoes);
});

test("data civil impossível retorna 400", async () => {
  await assert.rejects(consulta.consultarHistoricoPad({ data: "2026-02-31" }), rejeicaoStatus(400));
  await assert.rejects(consulta.consultarHistoricoPad({ data: "2026-2-01" }), rejeicaoStatus(400));
  await assert.rejects(consulta.consultarHistoricoPad({ data: "2025-02-29" }), rejeicaoStatus(400));
});

test("normaliza UF e tipo, preserva convênio e área como filtros exatos", async () => {
  let parametrosRecebidos;
  const execucoes = [{ id: 1, resultado: "SEM_ALTERACOES" }];
  repository.listarAtualizacoesPorData = async (parametros) => {
    parametrosRecebidos = parametros;
    return execucoes;
  };
  const resposta = await consulta.consultarHistoricoPad({
    data: "2026-09-29", uf: " rn ", convenio: " 001/2022-ABC ",
    tipo: " alterado ", area: " Escola Penal ",
  });
  assert.deepEqual(parametrosRecebidos, {
    data: "2026-09-29", uf: "RN", convenio: "001/2022-ABC",
    tipo: "ALTERADO", area: "Escola Penal",
  });
  assert.deepEqual(resposta.filtros, {
    uf: "RN", convenio: "001/2022-ABC", tipo: "ALTERADO", area: "Escola Penal",
  });
  assert.equal(resposta.execucoes[0].resultado, "SEM_ALTERACOES");
});

test("rejeita UF e tipo inválidos e aceita os três tipos permitidos", async () => {
  repository.listarAtualizacoesPorData = async () => [];
  await assert.rejects(consulta.consultarHistoricoPad({ data: "2026-09-29", uf: "RNN" }), rejeicaoStatus(400));
  await assert.rejects(consulta.consultarHistoricoPad({ data: "2026-09-29", tipo: "NOVO OU 1=1" }), rejeicaoStatus(400));
  for (const tipo of ["NOVO", "REMOVIDO", "ALTERADO"]) {
    await assert.doesNotReject(consulta.consultarHistoricoPad({ data: "2026-09-29", tipo }));
  }
});

test("strings vazias viram filtros ausentes", async () => {
  repository.listarAtualizacoesPorData = async (parametros) => {
    assert.deepEqual(parametros, { data: "2026-09-29" });
    return [];
  };
  const resposta = await consulta.consultarHistoricoPad({
    data: "2026-09-29", uf: "  ", convenio: "", tipo: " ", area: "",
  });
  assert.deepEqual(resposta.filtros, {});
});

test("detalhe existente retorna objeto estruturado e repassa executor", async () => {
  const executor = { tx: "executor explícito" };
  const detalhe = {
    atualizacao: { id: 123, resultado: "SEM_ALTERACOES" },
    alteracoes: [],
    snapshots: { antes: { checksum: "a", resumo: {} }, depois: { checksum: "a", resumo: {} } },
  };
  repository.buscarDetalheAtualizacao = async (id, repassado) => {
    assert.equal(id, 123);
    assert.equal(repassado, executor);
    return detalhe;
  };
  assert.equal(await consulta.obterDetalheHistoricoPad("123", executor), detalhe);
  assert.equal(Object.hasOwn(detalhe.snapshots.antes, "snapshot"), false);
});

test("ID inválido retorna 400 e execução ausente retorna 404", async () => {
  for (const id of [0, -1, "0", "1.5", "1abc", "9007199254740992", null]) {
    await assert.rejects(consulta.obterDetalheHistoricoPad(id), rejeicaoStatus(400));
  }
  repository.buscarDetalheAtualizacao = async () => null;
  await assert.rejects(consulta.obterDetalheHistoricoPad(12), (erro) =>
    rejeicaoStatus(404)(erro) && erro.message === "Execução histórica do PAD não encontrada."
  );
});

test("server expõe somente GET backend-only de lista e detalhe sem snapshot integral", () => {
  const server = fs.readFileSync(path.join(ROOT, "backend/server.js"), "utf8");
  assert.match(server, /req\.method === "GET" && pathname === "\/api\/profor-2022\/pad\/historico"/);
  assert.match(server, /req\.method === "GET" && rotaDetalheHistorico/);
  assert.match(server, /historicoPadConsultaService\.consultarHistoricoPad/);
  assert.match(server, /historicoPadConsultaService\.obterDetalheHistoricoPad/);
  assert.doesNotMatch(server, /req\.method === "POST" && pathname === "\/api\/profor-2022\/pad\/historico/);
  assert.doesNotMatch(server, /\/api\/profor-2022\/pad\/historico\/[^\s"']*(?:snapshot|download)/i);
  assert.doesNotMatch(server, /snapshot_json|snapshotJson|snapshotIntegral/);
  assert.equal(fs.existsSync(path.join(ROOT, "frontend/data/publicados/profor-2022-pad-historico.json")), false);
});
