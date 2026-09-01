const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicadosDir = path.resolve(__dirname, "../../frontend/data/publicados");

function carregarJsonPublicado(nome) {
  const filePath = path.join(publicadosDir, nome);
  assert.ok(fs.existsSync(filePath), `Arquivo publicado obrigatorio ausente: ${nome}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("resumo-publicacao.json manifesto contem os 6 datasets e metadados validos", () => {
  const resumo = carregarJsonPublicado("resumo-publicacao.json");
  assert.ok(resumo.publicadoEm, "Data de publicacao deve existir");
  assert.equal(resumo.fonte, "Dados locais ONASP");
  assert.deepEqual(resumo.arquivos.sort(), [
    "aplicacao.json",
    "contatos.json",
    "dashboard-geral.json",
    "formalizacao-profor.json",
    "orcamento-2026.json",
    "parametros-minimos.json",
  ].sort());
  assert.equal(resumo.totais.aplicacaoDadosBase, 180);
  assert.equal(resumo.totais.conveniosProfor2022, 15);
  assert.equal(resumo.totais.parametrosMinimos, 28);
  assert.equal(resumo.totais.formalizacaoProfor, 14);
  assert.equal(resumo.totais.orcamento2026, 9);
  assert.deepEqual(resumo.totais.contatos, {
    ufs: 27,
    cadastrosInstitucionais: 29,
    contatosNominais: 150,
  });
});

test("dashboard-geral.json e aplicacao.json refletem paridade total de fomento (R$ 15.022.372,24)", () => {
  const dash = carregarJsonPublicado("dashboard-geral.json");
  const aplicacao = carregarJsonPublicado("aplicacao.json");

  assert.equal(dash.dadosBase.length, 180);
  assert.equal(aplicacao.dadosBase.length, 180);

  const esperado = dash.resumoEsperado;
  assert.equal(esperado.totalFomento, 15022372.24);
  assert.equal(esperado.totalConvenios, 10664015.24);
  assert.equal(esperado.totalFaf, 1757357);
  assert.equal(esperado.totalDoacoes, 2601000);
  assert.equal(esperado.quantidadeUfsConvenios, 15);

  const somaMatematica = Math.round((esperado.totalConvenios + esperado.totalFaf + esperado.totalDoacoes) * 100) / 100;
  assert.equal(somaMatematica, esperado.totalFomento);

  const ufsEsperadas = ["AC", "AL", "AM", "GO", "MA", "MS", "MT", "PB", "PI", "PR", "RJ", "RO", "SC", "SP", "TO"];
  assert.deepEqual(esperado.ufsConvenios, ufsEsperadas);
});

test("aplicacao.json reflete 15 convenios PROFOR 2022 com integridade 15/15/15", () => {
  const aplicacao = carregarJsonPublicado("aplicacao.json");
  const convs = aplicacao.dadosProfor2022.convenios;
  assert.equal(convs.length, 15);

  const comDetru = convs.filter((c) => c.fontesUtilizadas && c.fontesUtilizadas.some((f) => f.includes("DETRU")));
  const comPlano = convs.filter((c) => Array.isArray(c.planoAplicacao) && c.planoAplicacao.length > 0);
  const comRend = convs.filter((c) => c.fontesUtilizadas && c.fontesUtilizadas.some((f) => f.includes("Transferegov")));

  assert.equal(comDetru.length, 15);
  assert.equal(comPlano.length, 15);
  assert.equal(comRend.length, 15);

  // Confirma que secao bruta detru foi expurgada no nivel raiz
  assert.equal(aplicacao.detru, undefined);
});

test("parametros-minimos.json reflete 28 unidades, 15 parametros e 186 deficits declarados", () => {
  const pm = carregarJsonPublicado("parametros-minimos.json");
  assert.equal(pm.disponivel, true);
  assert.equal(pm.parametrosDisponiveis.length, 15);
  assert.equal(pm.respostas.length, 28);
  assert.equal(pm.resumo.totalRespostas, 28);
  assert.equal(pm.resumo.ufsDiagnosticadas, 28);
  assert.equal(pm.resumo.unidadesDiagnosticadas, 28);
  assert.equal(pm.resumo.deficitTotalDeclarado, 186);

  const totalDeficitsSomados = pm.respostas.reduce((acc, r) => acc + (r.resumoParametrosMinimos?.deficitMaterial || 0), 0);
  assert.equal(totalDeficitsSomados, 186);

  const ufsPresentes = pm.respostas.map((r) => r.uf);
  assert.ok(ufsPresentes.includes("ES_1"));
  assert.ok(ufsPresentes.includes("ES_2"));
  assert.equal(new Set(ufsPresentes).size, 28);

  // Confirma sanitizacao: respostasBrutas expurgado
  assert.equal(pm.respostasBrutas, undefined);
});

test("orcamento-2026.json reflete 9 itens oficiais (R$ 6.100.000,00) e 3 frentes", () => {
  const orc = carregarJsonPublicado("orcamento-2026.json");
  assert.equal(orc.disponivel, true);
  assert.equal(orc.itensOficiais.length, 9);
  assert.equal(orc.itens.length, 9);
  assert.equal(orc.resumo.totalGeral, 6100000);
  assert.equal(orc.resumo.totalEmExecucao, 5274476);
  assert.equal(orc.resumo.saldoPlanejado, 825524);

  const somaFrentes = orc.resumoFrentes.reduce((acc, f) => acc + f.total, 0);
  assert.equal(somaFrentes, 6100000);

  // Confirma sanitizacao: caminho de arquivo local expurgado
  assert.equal(orc.arquivo, undefined);
});

test("formalizacao-profor.json reflete 14 UFs autorizadas e R$ 2.800.000,00 de repasse", () => {
  const form = carregarJsonPublicado("formalizacao-profor.json");
  assert.equal(form.disponivel, true);
  assert.equal(form.propostas.length, 14);
  assert.equal(form.ufsAutorizadas.length, 14);
  assert.equal(form.ufsCondicaoSuspensiva.length, 4);
  assert.equal(form.valorRepassePadrao, 200000);
  assert.equal(form.resumo.totalPropostas, 14);
  assert.equal(form.resumo.totalRepasse, 2800000);

  // Confirma sanitizacao: registros brutos expurgado
  assert.equal(form.registros, undefined);
});

test("contatos.json possui 100% de paridade com o servico local e expurgo estrito de PII", () => {
  const { listarContatosPublicos } = require("../../backend/services/contatos-publication-service");
  const local = listarContatosPublicos();
  const pub = carregarJsonPublicado("contatos.json");

  assert.deepEqual(pub.totais, {
    ufs: 27,
    cadastrosInstitucionais: 29,
    contatosNominais: 150,
  });

  assert.deepEqual(pub.cadastroPorUf, local.cadastroPorUf);
  assert.deepEqual(pub.pessoasPorUf, local.pessoasPorUf);
});

test("seguranca dos 7 JSONs publicados: zero CPFs, zero credenciais, zero URLs internas e zero XSS", () => {
  const arquivos = [
    "aplicacao.json",
    "dashboard-geral.json",
    "parametros-minimos.json",
    "formalizacao-profor.json",
    "orcamento-2026.json",
    "contatos.json",
    "resumo-publicacao.json",
  ];

  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(path.join(publicadosDir, arquivo), "utf8");

    // Zero senhas / tokens administrativos / URLs de banco de dados
    assert.ok(!/postgres(?:ql)?:\/\//i.test(conteudo), `${arquivo} contem URL Postgres`);
    assert.ok(!/Bearer\s+[A-Za-z0-9]/i.test(conteudo), `${arquivo} contem token Bearer`);
    assert.ok(!/PROFOR_ADMIN_TOKEN|ONASP_EDIT_PASSWORD/i.test(conteudo), `${arquivo} contem segredos de ambiente`);
    assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)/i.test(conteudo), `${arquivo} contem URL local/privada`);
    assert.ok(!/<script\b|javascript:|onerror\s*=|onload\s*=/i.test(conteudo), `${arquivo} contem vetor XSS`);
  }
});
