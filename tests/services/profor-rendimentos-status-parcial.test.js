const test = require("node:test");
const assert = require("node:assert/strict");

const {
  executarEtapaRendimentos,
} = require("../../backend/services/profor-2022/profor-atualizacao-consolidada-service");
const {
  classificarResultadoRendimentos,
} = require("../../backend/services/profor-2022/transferegov-rendimentos-cache-service");

function criarCenario(resultados) {
  const convenios = resultados.map((_, indice) => ({
    numeroConvenio: String(900001 + indice),
    ano: "2022",
    uf: "DF",
  }));
  const salvos = [];
  const encerramentos = [];
  const errosFatais = [];

  return {
    salvos,
    encerramentos,
    errosFatais,
    dependencias: {
      assertChamadaExternaPermitida: () => {},
      listarConveniosMonitorados: async () => convenios,
      consultarSaldoRendimentosConvenio: async (numeroConvenio) => {
        const indice = convenios.findIndex((item) => item.numeroConvenio === numeroConvenio);
        return resultados[indice];
      },
      salvarSaldoRendimentoTransferegov: async (_resultado, metadados) => {
        salvos.push(metadados.numeroConvenio);
      },
      registrarConsultaRendimentosInicio: async () => 77,
      registrarConsultaRendimentosFim: async (_id, resumo) => {
        encerramentos.push(resumo);
      },
      registrarConsultaRendimentosErro: async (_id, erro) => {
        errosFatais.push(erro);
      },
    },
  };
}

async function executarCenario(resultados) {
  const cenario = criarCenario(resultados);
  const resultado = await executarEtapaRendimentos(
    { intervaloEntreConsultasMs: 0 },
    cenario.dependencias
  );
  return { ...cenario, resultado };
}

test("rendimentos não classifica resumo incompleto como sucesso integral", () => {
  assert.equal(classificarResultadoRendimentos({
    totalConsultados: 2,
    totalSucesso: 1,
    totalFalha: 0,
  }), "parcial");
});

test("rendimentos classifica lote integral como sucesso", async () => {
  const cenario = await executarCenario([
    { sucesso: true, fluxo: "fetch-publico", saldoRendimentosAtual: 10 },
    { sucesso: true, fluxo: "fetch-publico", saldoRendimentosAtual: 20 },
  ]);

  assert.equal(cenario.resultado.sucesso, true);
  assert.equal(cenario.resultado.statusResultado, "sucesso");
  assert.equal(cenario.encerramentos[0].statusResultado, "sucesso");
  assert.deepEqual(cenario.salvos, ["900001", "900002"]);
  assert.equal(cenario.errosFatais.length, 0);
});

test("rendimentos classifica lote misto como parcial e preserva cache da falha", async () => {
  const cenario = await executarCenario([
    { sucesso: true, fluxo: "fetch-publico", saldoRendimentosAtual: 10 },
    { sucesso: false, fluxo: "sem-fluxo", erro: "falha controlada" },
  ]);

  assert.equal(cenario.resultado.sucesso, false);
  assert.equal(cenario.resultado.statusResultado, "parcial");
  assert.equal(cenario.resultado.totalSucessos, 1);
  assert.equal(cenario.resultado.totalFalhas, 1);
  assert.equal(cenario.encerramentos[0].statusResultado, "parcial");
  assert.deepEqual(cenario.salvos, ["900001"]);
  assert.equal(cenario.errosFatais.length, 0);
});

test("rendimentos classifica lote sem sucesso como falha e não sobrescreve cache", async () => {
  const cenario = await executarCenario([
    { sucesso: false, fluxo: "sem-fluxo", erro: "falha controlada 1" },
    { sucesso: false, fluxo: "sem-fluxo", erro: "falha controlada 2" },
  ]);

  assert.equal(cenario.resultado.sucesso, false);
  assert.equal(cenario.resultado.statusResultado, "falha");
  assert.equal(cenario.resultado.totalSucessos, 0);
  assert.equal(cenario.resultado.totalFalhas, 2);
  assert.equal(cenario.encerramentos[0].statusResultado, "falha");
  assert.deepEqual(cenario.salvos, []);
  assert.equal(cenario.errosFatais.length, 0);
});
