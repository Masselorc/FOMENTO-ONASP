const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  publicarDadosEstaticos,
  validarAptoParaPublicacaoProfor,
} = require("../../backend/services/static-publication-service");

const repoRoot = path.resolve(__dirname, "../..");

function opcoesBase(arquivosEscritos) {
  return {
    registrarLogOperacional: async () => ({ id: 1 }),
    carregarCatalogoAplicacao: () => ({ dadosBase: [] }),
    listarParametrosMinimos: async () => ({ respostas: [{ uf: "DF" }] }),
    listarFormalizacaoProfor: async () => ({ propostas: [{ uf: "DF" }], registros: [] }),
    listarOrcamento2026: async () => ({ itens: [{ id: 1 }] }),
    listarContatosPublicos: async () => ({ cadastroPorUf: [], pessoasPorUf: [], totais: { ufs: 1 } }),
    consolidarCatalogoDashboard: async (catalogoPublicado) => ({
      catalogoPublicado,
      dashboardGeral: { total: 1 },
      resumoDashboard: { total: 1 },
      totaisExtracao: { itensConvenio: 0, conveniosProfor2022: 0 },
    }),
    escreverJsonAtomico: (nomeArquivo) => { arquivosEscritos.push(nomeArquivo); },
  };
}

test("publicarDadosEstaticos aborta quando aptoParaPublicacao=false e não escreve JSONs publicados", async () => {
  const arquivosEscritos = [];
  await assert.rejects(
    publicarDadosEstaticos({
      ...opcoesBase(arquivosEscritos),
      lerRelatorioComparacaoPlano: () => ({
        disponivel: true,
        relatorio: { aptoParaPublicacao: false, aptoParaUsoLocal: true },
      }),
    }),
    /Publicação PROFOR 2022 bloqueada/
  );
  assert.deepEqual(arquivosEscritos, []);
});

test("aptoParaUsoLocal=true com aptoParaPublicacao=false continua bloqueado", () => {
  assert.throws(
    () => validarAptoParaPublicacaoProfor({
      lerRelatorioComparacaoPlano: () => ({
        disponivel: true,
        relatorio: { aptoParaUsoLocal: true, aptoParaPublicacao: false },
      }),
    }),
    /Publicação PROFOR 2022 bloqueada/
  );
});

test("relatório do comparador ausente bloqueia a publicação", () => {
  assert.throws(
    () => validarAptoParaPublicacaoProfor({
      caminhoRelatorioComparacaoPlano: path.join(
        repoRoot,
        "backend/data/relatorios/relatorio-inexistente.json"
      ),
    }),
    /Publicação PROFOR 2022 bloqueada/
  );
});

test("aptoParaPublicacao=true permite o fluxo de publicação", async () => {
  const arquivosEscritos = [];
  const resultado = await publicarDadosEstaticos({
    ...opcoesBase(arquivosEscritos),
    lerRelatorioComparacaoPlano: () => ({
      disponivel: true,
      relatorio: { aptoParaPublicacao: true },
    }),
  });

  assert.equal(resultado.success, true);
  assert.equal(arquivosEscritos.length, 7);
  assert.ok(arquivosEscritos.includes("aplicacao.json"));
  assert.ok(arquivosEscritos.includes("resumo-publicacao.json"));
});

test("publicar-profor-2022-estatico.js não chama mais atualizar:profor-2022", () => {
  const fonte = fs.readFileSync(
    path.join(repoRoot, "backend/scripts/publicar-profor-2022-estatico.js"),
    "utf8"
  );
  assert.doesNotMatch(fonte, /atualizar:profor-2022/);
  assert.match(fonte, /recarregarPadsOperacional/);
});
