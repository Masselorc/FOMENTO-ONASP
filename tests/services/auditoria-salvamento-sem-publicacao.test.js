const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Salvamentos operacionais gerais com historico/logs nao devem publicar dados
// estaticos. Orçamento 2026 e excecao porque alimenta a pagina estatica do
// GitHub Pages a partir dos JSONs publicados.

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
  }
];

const rotasOrcamentoPublicadas = [
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

for (const { rota, service } of rotasOrcamentoPublicadas) {
  test(`POST ${rota} usa o service operacional esperado`, () => {
    const handler = extrairHandler(serverCode, rota);
    assert.match(
      handler,
      new RegExp(`${service}\\s*\\(`),
      `O handler ${rota} deve persistir via ${service}`
    );
  });

  test(`POST ${rota} publica dados estaticos apos sucesso`, () => {
    const handler = extrairHandler(serverCode, rota);
    assert.match(
      handler,
      new RegExp(`const\\s+resultado\\s*=\\s*await\\s+${service}\\s*\\(`),
      `O handler ${rota} deve obter o resultado de ${service}`
    );
    assert.match(
      handler,
      /const\s+resultadoPublicado\s*=\s*await\s+publicarAposSalvamento\s*\(\s*resultado\s*\)/,
      `O handler ${rota} deve publicar dados estaticos apos salvamento bem-sucedido`
    );
    assert.match(
      handler,
      /enviarJson\s*\(\s*res\s*,\s*resultadoPublicado\.success\s*\?\s*200\s*:\s*400\s*,\s*resultadoPublicado\s*\)/,
      `O handler ${rota} deve responder com o resultado publicado`
    );
  });
}
