const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Salvamentos operacionais com historico/logs nao devem publicar dados estaticos.
// A atualizacao de frontend/data/publicados permanece como etapa explicita.

const repoRoot = path.resolve(__dirname, "../..");
const serverCode = fs.readFileSync(path.join(repoRoot, "backend/server.js"), "utf8");

function extrairHandler(codigo, rota) {
  const marcador = `pathname === "${rota}"`;
  const inicio = codigo.indexOf(marcador);
  assert.notEqual(inicio, -1, `A rota ${rota} deve existir no server.js`);

  const restante = codigo.slice(inicio);
  const proximaRota = restante.indexOf('pathname === "/api/', 1);
  return proximaRota === -1 ? restante : restante.slice(0, proximaRota);
}

const rotasOperacionais = [
  {
    rota: "/api/parametros-minimos/salvar",
    service: "salvarParametrosMinimos"
  },
  {
    rota: "/api/parametros-minimos/historico/reverter",
    service: "reverterHistoricoParametrosMinimos"
  },
  {
    rota: "/api/formalizacao-profor/salvar",
    service: "salvarFormalizacaoProfor"
  },
  {
    rota: "/api/orcamento-2026/salvar",
    service: "salvarOrcamento2026"
  },
  {
    rota: "/api/orcamento-2026/processos-vinculados/criar",
    service: "criarProcessoVinculadoOrcamento2026"
  },
  {
    rota: "/api/orcamento-2026/saldos/alocar",
    service: "alocarSaldoOrcamento2026"
  }
];

for (const { rota, service } of rotasOperacionais) {
  test(`POST ${rota} usa o service operacional esperado`, () => {
    const handler = extrairHandler(serverCode, rota);
    assert.match(
      handler,
      new RegExp(`${service}\\s*\\(`),
      `O handler ${rota} deve persistir via ${service}`
    );
  });

  test(`POST ${rota} NAO publica dados estaticos automaticamente`, () => {
    const handler = extrairHandler(serverCode, rota);
    assert.doesNotMatch(
      handler,
      /publicarAposSalvamento|publicarDadosEstaticos/,
      `O handler ${rota} nao deve disparar publicacao estatica automaticamente`
    );
  });
}
