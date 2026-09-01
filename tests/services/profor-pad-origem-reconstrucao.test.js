const test = require("node:test");
// Estes testes exercitam fluxo integrado Postgres/Supabase e exigem DATABASE_URL.
const testPostgres = process.env.DATABASE_URL ? test : test.skip;
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
const {
  montarDadosProfor2022Publicacao,
  consolidarCatalogoDashboard,
} = require("../../backend/services/dashboard-publication-service");

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
  assert.match(CAMINHO_PADRAO_RECONSTRUCAO_PAD, /profor-2022-pad-recarga-operacional-v2\.json$/);
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

test("carregarPlanoAplicacaoReconstrucaoPad usa recarga v2 atual nos itens alterados do Tocantins", () => {
  const r = carregarPlanoAplicacaoReconstrucaoPad({
    conveniosEsperados: 15,
    minimoLinhasExigido: 568,
  });
  const itensTocantins = r.planoAplicacao.filter((item) => item.numero === "937468");
  const porDescricao = new Map(itensTocantins.map((item) => [item.descricao, item]));

  const tablet = porDescricao.get("ETAPA 2 - CORREGEDORIA - Tablet, tela su");
  assert.equal(tablet.valorExecutado, 21868);
  assert.equal(tablet.saldo, 0);
  assert.equal(tablet.percentualExecucao, 100);

  const monitorEtapa1 = porDescricao.get("ETAPA 1 - OUVIDORIA - Monitor");
  assert.equal(monitorEtapa1.valorExecutado, 0);
  assert.equal(monitorEtapa1.saldo, 3539.97);
  assert.equal(monitorEtapa1.percentualExecucao, 0);

  const monitorEtapa2 = porDescricao.get("ETAPA 2 - CORREGEDORIA - Monitor");
  assert.equal(monitorEtapa2.valorExecutado, 10619.91);
  assert.equal(monitorEtapa2.saldo, -3539.97);
  assert.equal(monitorEtapa2.percentualExecucao, 150);
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

testPostgres("montarDadosProfor2022Publicacao inclui convenios reconstruidos com valor total positivo", async () => {
  const dados = await montarDadosProfor2022Publicacao(null, {}, { origemDados: "reconstrucao-pad" });
  assert.ok(Array.isArray(dados.convenios) && dados.convenios.length > 0);

  const totalConvenios = dados.convenios.reduce((acc, convenio) => {
    const valor = Number(convenio.previstoOuvidoria ?? convenio.valorGlobal ?? convenio.valorTotal) || 0;
    return acc + valor;
  }, 0);
  const ufsComConvenio = new Set(
    dados.convenios
      .map((convenio) => String(convenio.uf || "").trim())
      .filter(Boolean)
  );

  assert.ok(totalConvenios > 0, "Total de convenios reconstruidos deve ser maior que zero.");
  assert.ok(ufsComConvenio.size > 0, "UFs de convenios reconstruidos nao podem ficar zeradas.");
});

testPostgres("consolidarCatalogoDashboard inclui convenios PROFOR/PAD no total geral do painel", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const catalogoPath = path.join(repoRoot, "backend/data/aplicacao.json");
  const catalogo = JSON.parse(fs.readFileSync(catalogoPath, "utf8"));

  const consolidado = await consolidarCatalogoDashboard(catalogo, new Date().toISOString());
  const { resumoDashboard } = consolidado;

  assert.ok(resumoDashboard.totalConvenios > 0, "Total em convenios nao pode ficar zerado.");
  assert.ok(resumoDashboard.quantidadeUfsConvenios > 0, "UFs com convenios nao podem ficar zeradas.");
  assert.equal(
    resumoDashboard.totalFomento,
    resumoDashboard.totalConvenios + resumoDashboard.totalFaf + resumoDashboard.totalDoacoes,
    "Total de fomento deve somar convenios + FAF + doacoes."
  );
});

testPostgres("Home: resumo de instrumentos nao pode zerar convenios quando consolidado PAD tem convenios e UFs", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const catalogoPath = path.join(repoRoot, "backend/data/aplicacao.json");
  const catalogo = JSON.parse(fs.readFileSync(catalogoPath, "utf8"));
  const analytics = await import("../../backend/services/analytics.js");

  const dadosProfor = await montarDadosProfor2022Publicacao(null, catalogo, { origemDados: "reconstrucao-pad" });
  const itensProfor = (dadosProfor.convenios || []).map((convenio) => ({
    uf: convenio.uf,
    instrumento: "Convênio PROFOR 2022",
    objeto: `PROFOR 2022 - Convênio ${convenio.numero || convenio.numeroConvenio || ""}/${convenio.ano || ""}`.trim(),
    quantidade: Number(convenio.totalItensOuvidoria ?? convenio.totalItens) || 1,
    valorTotal: Number(convenio.previstoOuvidoria ?? convenio.valorGlobal ?? convenio.valorTotal) || 0,
    valorExecutado: Number(convenio.valorExecutadoOuvidoria ?? convenio.valorExecutadoGeral ?? convenio.valorExecutado) || 0,
    valorUnitario: Number(convenio.previstoOuvidoria ?? convenio.valorGlobal ?? convenio.valorTotal) || 0,
  }));

  const dadosBaseSemConvenios = (catalogo.dadosBase || []).filter((item) => {
    const instrumento = String(item?.instrumento || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return !instrumento.includes("CONV");
  });
  const dadosHome = [...dadosBaseSemConvenios, ...itensProfor];
  const resumo = analytics.calcularResumoInstrumentos(dadosHome);

  assert.ok(resumo.convenios.total > 0, "Resumo da Home nao pode manter total de convenios em zero.");
  assert.ok(resumo.convenios.quantidadeUfs > 0, "Resumo da Home nao pode manter UFs de convenios em zero.");
  assert.equal(
    resumo.convenios.total + resumo.faf.total + resumo.doacao.total > 0,
    true,
    "Total de fomento (convenios + FAF + doacoes) deve permanecer positivo."
  );
});

test("Menu lateral exibe item Sistema e aponta para status-sistema", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const indexPath = path.join(repoRoot, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");

  assert.match(html, /<span>\s*Sistema\s*<\/span>/i);
  assert.match(html, /data-view=\"status-sistema\"/i);
  assert.match(html, /toggleView\('status-sistema'\)/i);
});

test("Tela de recarga PAD continua vinculada a status-sistema e recarrega a Home apos sucesso", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const appPath = path.join(repoRoot, "frontend/js/app.js");
  const appCode = fs.readFileSync(appPath, "utf8");

  assert.match(appCode, /id=\"secao-recarga-pad-operacional\"/i);
  assert.match(appCode, /await garantirDadosBaseAplicacao\(\);/i);
});

test("Atualizacao Transferegov publica dados e recarrega cache da aplicacao na UI", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const appPath = path.join(repoRoot, "frontend/js/app.js");
  const appCode = fs.readFileSync(appPath, "utf8");

  const blocoInicio = appCode.indexOf("async function executarAtualizacaoPadsTransferegovUI");
  assert.notEqual(blocoInicio, -1, "Fluxo de atualização Transferegov deve existir");
  const bloco = appCode.slice(blocoInicio, blocoInicio + 5000);

  assert.match(appCode, /publicando_dados_estaticos/);
  assert.match(bloco, /catalogoAplicacao\s*=\s*\{\}/);
  assert.match(bloco, /dadosFaf\s*=\s*\[\]/);
  assert.match(bloco, /await garantirDadosBaseAplicacao\(\);/);
});

test("UI da recarga PAD nao fala mais em substituir os 15 Excel nem em fluxo Excel antigo", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const appPath = path.join(repoRoot, "frontend/js/app.js");
  const appCode = fs.readFileSync(appPath, "utf8");

  const blocoInicio = appCode.indexOf("renderBlocoRecargaOperacionalPadStatusSistema");
  assert.notEqual(blocoInicio, -1, "Bloco da UI da recarga PAD deve existir");
  const trechoBloco = appCode.slice(blocoInicio, blocoInicio + 4000);

  assert.equal(trechoBloco.includes("Substitua os 15"), false, "UI nao deve instruir a substituir os 15 Excel");
  assert.equal(trechoBloco.includes("PADs Excel atuais"), false, "UI nao deve falar em PADs Excel atuais");
  assert.equal(trechoBloco.includes("Planilhas/profor-2022/instrumentos"), false, "UI nao deve referenciar pasta Excel antiga");
  assert.equal(trechoBloco.includes("Fluxo operacional limpo para reconstruir"), false, "UI nao deve manter texto antigo");
});

test("UI da recarga PAD menciona cache Transferegov validado e tela Revisoes PAD", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const appPath = path.join(repoRoot, "frontend/js/app.js");
  const appCode = fs.readFileSync(appPath, "utf8");

  const blocoInicio = appCode.indexOf("renderBlocoRecargaOperacionalPadStatusSistema");
  const trechoBloco = appCode.slice(blocoInicio, blocoInicio + 4000);

  assert.ok(/cache.*Transferegov.*validado/i.test(trechoBloco) || /cache Transferegov validado/i.test(trechoBloco),
    "UI deve mencionar cache Transferegov validado");
  assert.ok(/Revis(õ|o)es PAD/i.test(trechoBloco),
    "UI deve orientar revisao pela tela Revisoes PAD");
});

test("UI da recarga PAD filtra alertas de auditoria mesmo de payload antigo", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const appPath = path.join(repoRoot, "frontend/js/app.js");
  const appCode = fs.readFileSync(appPath, "utf8");

  assert.ok(appCode.includes("TIPOS_ALERTA_RECARGA_PAD_SUPRIMIDOS"),
    "UI deve declarar lista de tipos suprimidos para defesa contra payload antigo");
  assert.ok(appCode.includes("ehAlertaRecargaPadSuprimido"),
    "UI deve filtrar alertas antes de renderizar");

  const tiposSuprimidos = [
    "item_conhecido_ausente_no_pad",
    "item_suprimido_historico",
    "item_conhecido_nao_apto",
    "quantidade_valor_unitario_inconsistente",
    "saldo_residual_nao_setorializado",
    "saldo_residual_natureza_sem_rateio_memoria",
    "equivalencia_por_diacritico_saneada_automaticamente",
    "item_pad_coincide_apenas_por_descricao_normalizada",
    "item_pad_sem_rateio"
  ];
  const blocoInicio = appCode.indexOf("TIPOS_ALERTA_RECARGA_PAD_SUPRIMIDOS");
  const bloco = appCode.slice(blocoInicio, blocoInicio + 1500);
  for (const tipo of tiposSuprimidos) {
    assert.ok(bloco.includes(`'${tipo}'`) || bloco.includes(`"${tipo}"`),
      `Lista de tipos suprimidos da UI deve incluir ${tipo}`);
  }
});

test("Detalhamento estadual usa itens de Ouvidoria do plano PAD nos convenios", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const appPath = path.join(repoRoot, "frontend/js/app.js");
  const appCode = fs.readFileSync(appPath, "utf8");

  const blocoInicio = appCode.indexOf("function montarItensDashboardProforBancoCache");
  assert.notEqual(blocoInicio, -1, "Montagem de itens PROFOR para dashboard deve existir");
  const bloco = appCode.slice(blocoInicio, blocoInicio + 5000);

  assert.match(bloco, /\.flatMap\(\(convenio\)/);
  assert.match(bloco, /convenio\.planoAplicacao/);
  assert.match(bloco, /normalizarBusca\(item\.area\)\s*===\s*['"]ouvidoria['"]/);
  assert.match(bloco, /objeto:\s*item\.descricao/);
  assert.match(bloco, /valorTotal\s*=\s*parseNumeroMonetarioFrontend\(item\.valorPrevisto/);
});
