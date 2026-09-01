const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicadosDir = path.resolve(__dirname, "../../frontend/data/publicados");

function carregar(nome) {
  const filePath = path.join(publicadosDir, nome);
  assert.ok(fs.existsSync(filePath), "Arquivo ausente: " + nome);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const UFS_OFICIAIS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
]);

test("CHALLENGE 1: Aritmetica exata de centavos em aplicacao.json e dashboard-geral.json", () => {
  const aplicacao = carregar("aplicacao.json");
  const dash = carregar("dashboard-geral.json");

  // 1.1 Verificacao estrutural e paridade profunda de dadosBase
  assert.equal(aplicacao.dadosBase.length, 180, "dadosBase de aplicacao deve ter 180 itens");
  assert.equal(dash.dadosBase.length, 180, "dadosBase de dashboard deve ter 180 itens");
  assert.deepEqual(aplicacao.dadosBase, dash.dadosBase, "dadosBase deve ser identico entre aplicacao e dashboard");

  // 1.2 Soma centavo a centavo (BigInt) de dadosBase
  let totalCentavos = 0n;
  const porInstrumento = {};

  dash.dadosBase.forEach((item, idx) => {
    const valor = item.valorTotal ?? item.valor;
    assert.ok(typeof valor === "number" && Number.isFinite(valor), "Item " + idx + " possui valor invalido: " + valor);
    assert.ok(valor >= 0, "Item " + idx + " possui valor negativo: " + valor);
    
    // Converter para centavos inteiros
    const centavos = BigInt(Math.round(valor * 100));
    totalCentavos += centavos;

    const inst = item.instrumento || "OUTROS";
    if (!porInstrumento[inst]) porInstrumento[inst] = { count: 0, centavos: 0n };
    porInstrumento[inst].count++;
    porInstrumento[inst].centavos += centavos;
  });

  const totalCalculado = Number(totalCentavos) / 100;
  assert.equal(totalCentavos, 1502237224n, "Soma exata em centavos de dadosBase deve ser 1502237224 (R$ 15.022.372,24)");
  assert.equal(totalCalculado, 15022372.24);
  assert.equal(dash.resumoEsperado.totalFomento, 15022372.24);

  // 1.3 Verificacao das particoes por instrumento
  assert.equal(porInstrumento["Convênio"]?.count, 15, "Devem existir 15 convenios em dadosBase");
  assert.equal(porInstrumento["FAF 2021"]?.count, 148, "Devem existir 148 itens FAF 2021 em dadosBase");
  assert.equal(porInstrumento["Doação"]?.count, 17, "Devem existir 17 doacoes em dadosBase");

  assert.equal(porInstrumento["Convênio"]?.centavos, 1066401524n, "Soma convenios deve ser R$ 10.664.015,24");
  assert.equal(porInstrumento["FAF 2021"]?.centavos, 175735700n, "Soma FAF deve ser R$ 1.757.357,00");
  assert.equal(porInstrumento["Doação"]?.centavos, 260100000n, "Soma doacoes deve ser R$ 2.601.000,00");

  assert.equal(
    porInstrumento["Convênio"].centavos + porInstrumento["FAF 2021"].centavos + porInstrumento["Doação"].centavos,
    1502237224n,
    "Soma das 3 categorias deve fechar exatamente em 1502237224 centavos (R$ 15.022.372,24)"
  );

  // 1.4 Convenios PROFOR 2022 em aplicacao.dadosProfor2022
  const convs = aplicacao.dadosProfor2022.convenios;
  assert.equal(convs.length, 15, "Devem existir exatamente 15 convenios PROFOR 2022");
  
  let somaRepasseConvenios = 0n;
  let somaGlobalConvenios = 0n;
  convs.forEach((c, idx) => {
    assert.ok(c.uf && UFS_OFICIAIS.has(c.uf), "Convenio " + idx + " com UF invalida: " + c.uf);
    assert.ok(Array.isArray(c.planoAplicacao) && c.planoAplicacao.length > 0, "Convenio " + c.uf + " sem plano de aplicacao");
    assert.ok(c.fontesUtilizadas.some(f => f.includes("DETRU")), "Convenio " + c.uf + " sem fonte DETRU");
    assert.ok(c.fontesUtilizadas.some(f => f.includes("Transferegov")), "Convenio " + c.uf + " sem fonte Transferegov");
    
    const repasse = c.valorRepasse ?? 0;
    const global = c.valorGlobal ?? 0;
    somaRepasseConvenios += BigInt(Math.round(repasse * 100));
    somaGlobalConvenios += BigInt(Math.round(global * 100));
  });

  assert.equal(somaGlobalConvenios, 1066401524n, "Soma do valorGlobal dos 15 convenios deve ser exatamente R$ 10.664.015,24");
  assert.equal(somaRepasseConvenios, 1021725454n, "Soma dos repasses federais dos 15 convenios deve ser exatamente R$ 10.217.254,54");
});

test("CHALLENGE 2: Aritmetica e integridade de orcamento-2026.json", () => {
  const orc = carregar("orcamento-2026.json");

  assert.equal(orc.disponivel, true);
  assert.equal(orc.itensOficiais.length, 9, "Devem existir exatamente 9 itens oficiais");
  assert.equal(orc.itens.length, 9, "itens deve ter 9 registros");

  let somaPrevistoProcessos = 0n;

  orc.itensOficiais.forEach((it, idx) => {
    assert.ok(it.id || it.item, "Item " + idx + " deve ter identificador");
    const prev = it.valorPrevisto ?? it.valor_previsto ?? 0;
    assert.ok(prev >= 0, "Item " + idx + " com valor previsto negativo");
    somaPrevistoProcessos += BigInt(Math.round(prev * 100));
  });

  // 9 processos oficiais autuados somam R$ 6.054.600,00
  assert.equal(somaPrevistoProcessos, 605460000n, "Soma de valor previsto nos processos deve ser R$ 6.054.600,00");

  // Validar frentes
  assert.equal(orc.resumoFrentes.length, 3, "Devem existir exatamente 3 frentes");
  let somaFrentesTotal = 0n;
  let somaFrentesPrevisto = 0n;
  let somaFrentesExec = 0n;
  let somaFrentesSaldoDisp = 0n;
  let somaFrentesItens = 0;

  orc.resumoFrentes.forEach((f) => {
    somaFrentesTotal += BigInt(Math.round(f.total * 100));
    somaFrentesPrevisto += BigInt(Math.round(f.valorPrevistoProcessos * 100));
    somaFrentesExec += BigInt(Math.round(f.valorEmExecucao * 100));
    somaFrentesSaldoDisp += BigInt(Math.round(f.saldoDisponivel * 100));
    somaFrentesItens += f.itens;
  });

  assert.equal(somaFrentesTotal, 610000000n, "Dotacao global das frentes deve totalizar R$ 6.100.000,00");
  assert.equal(somaFrentesPrevisto, 605460000n, "Previsto nas frentes deve totalizar R$ 6.054.600,00");
  assert.equal(somaFrentesExec, 527447600n, "Execucao nas frentes deve totalizar R$ 5.274.476,00");
  assert.equal(somaFrentesSaldoDisp, 4540000n, "Saldo disponivel nao autuado deve ser R$ 45.400,00");
  assert.equal(somaFrentesItens, 9, "Soma dos itens das frentes deve ser 9");

  // Invariante de saldo planejado: Dotacao Global - Em Execucao = Saldo Planejado
  const saldoPlanejadoCalculado = somaFrentesTotal - somaFrentesExec;
  assert.equal(saldoPlanejadoCalculado, 82552400n, "Saldo planejado calculado deve ser exatamente R$ 825.524,00");

  // Validar resumo do orcamento
  assert.equal(orc.resumo.totalGeral, 6100000);
  assert.equal(orc.resumo.totalEmExecucao, 5274476);
  assert.equal(orc.resumo.saldoPlanejado, 825524);
  assert.equal(orc.resumo.processosAutuados, 9);

  // Verificacao dimensional: porStatus, porNatureza, porModalidade fecham em R$ 6.054.600,00
  const somaStatus = orc.resumo.porStatus.reduce((acc, s) => acc + BigInt(Math.round(s.total * 100)), 0n);
  const somaNatureza = orc.resumo.porNatureza.reduce((acc, n) => acc + BigInt(Math.round(n.total * 100)), 0n);
  const somaModalidade = orc.resumo.porModalidade.reduce((acc, m) => acc + BigInt(Math.round(m.total * 100)), 0n);

  assert.equal(somaStatus, 605460000n, "Soma porStatus deve fechar em R$ 6.054.600,00");
  assert.equal(somaNatureza, 605460000n, "Soma porNatureza deve fechar em R$ 6.054.600,00");
  assert.equal(somaModalidade, 605460000n, "Soma porModalidade deve fechar em R$ 6.054.600,00");
});

test("CHALLENGE 3: Aritmetica e integridade de formalizacao-profor.json", () => {
  const formal = carregar("formalizacao-profor.json");

  assert.equal(formal.disponivel, true);
  assert.equal(formal.propostas.length, 14, "Devem existir 14 propostas");
  assert.equal(formal.ufsAutorizadas.length, 14, "Devem existir 14 UFs autorizadas");
  assert.equal(formal.ufsCondicaoSuspensiva.length, 4, "Devem existir 4 UFs em condicao suspensiva");
  assert.equal(formal.valorRepassePadrao, 200000, "Valor repasse padrao deve ser R$ 200.000,00");

  let somaRepasse = 0n;
  let somaContrapartida = 0n;
  let somaGlobal = 0n;

  const ufsPropostas = new Set();

  formal.propostas.forEach((p, idx) => {
    assert.ok(UFS_OFICIAIS.has(p.uf), "Proposta " + idx + " com UF invalida: " + p.uf);
    ufsPropostas.add(p.uf);

    const rep = p.valorRepasse ?? p.valor_repasse ?? 0;
    const cp = p.valorContrapartida ?? p.valor_contrapartida ?? 0;
    const glob = p.valorGlobal ?? p.valor_global ?? (rep + cp);

    assert.equal(rep, 200000, "Proposta " + p.uf + " deve ter repasse de R$ 200.000,00");
    assert.equal(cp, 0, "Proposta " + p.uf + " contrapartida deve ser 0");
    assert.equal(glob, 200000, "Proposta " + p.uf + " valor global deve ser R$ 200.000,00");

    somaRepasse += BigInt(Math.round(rep * 100));
    somaContrapartida += BigInt(Math.round(cp * 100));
    somaGlobal += BigInt(Math.round(glob * 100));
  });

  assert.equal(somaRepasse, 280000000n, "Soma de repasse deve ser exatamente R$ 2.800.000,00");
  assert.equal(somaContrapartida, 0n, "Soma de contrapartida deve ser R$ 0,00");
  assert.equal(somaGlobal, 280000000n, "Soma de valor global deve ser R$ 2.800.000,00");

  // Consistencia de UFs autorizadas e propostas
  assert.equal(ufsPropostas.size, 14, "Devem existir 14 UFs distintas nas propostas");
  assert.deepEqual([...ufsPropostas].sort(), [...formal.ufsAutorizadas].sort(), "UFs das propostas devem bater com ufsAutorizadas");

  // Condicao suspensiva deve ser subconjunto das UFs autorizadas
  for (const uf of formal.ufsCondicaoSuspensiva) {
    assert.ok(ufsPropostas.has(uf), "UF em condicao suspensiva " + uf + " nao esta nas propostas");
  }
  assert.deepEqual(formal.ufsCondicaoSuspensiva.sort(), ["PA", "RR", "RS", "SE"].sort());
});

test("CHALLENGE 4: Integridade e contabilidade de parametros-minimos.json", () => {
  const pm = carregar("parametros-minimos.json");

  assert.equal(pm.disponivel, true);
  assert.equal(pm.parametrosDisponiveis.length, 15, "Devem existir 15 parametros minimos");
  assert.equal(pm.respostas.length, 28, "Devem existir 28 unidades diagnosticadas");
  assert.equal(pm.resumo.totalRespostas, 28);
  assert.equal(pm.resumo.ufsDiagnosticadas, 28);
  assert.equal(pm.resumo.unidadesDiagnosticadas, 28);
  assert.equal(pm.resumo.deficitTotalDeclarado, 186, "Deficit total deve ser 186");

  // Soma exata dos deficits em dois niveis (parametros individuais e resumo de cada unidade)
  let totalDeficitsResumo = 0;
  let totalDeficitsParametros = 0;
  const ufsEncontradas = new Set();

  pm.respostas.forEach((r, idx) => {
    assert.ok(r.uf, "Resposta " + idx + " sem UF");
    ufsEncontradas.add(r.uf);
    const defResumo = r.resumoParametrosMinimos?.deficitMaterial ?? 0;
    assert.ok(Number.isInteger(defResumo) && defResumo >= 0, "Deficit material invalido na UF " + r.uf + ": " + defResumo);
    totalDeficitsResumo += defResumo;

    assert.equal(r.parametrosMinimos.length, 15, "Cada resposta deve ter 15 parametros diagnosticados");
    let defPorParam = 0;
    r.parametrosMinimos.forEach(p => {
      defPorParam += (p.deficit || 0);
    });
    assert.equal(defPorParam, defResumo, "Deficits dos parametros na UF " + r.uf + " deve ser igual a deficitMaterial do resumo");
    totalDeficitsParametros += defPorParam;
  });

  assert.equal(totalDeficitsResumo, 186, "Soma individual de deficits materiais de todas as 28 unidades deve fechar em 186");
  assert.equal(totalDeficitsParametros, 186, "Soma dos deficits dos 15 parametros de todas as 28 unidades deve fechar em 186");
  assert.equal(ufsEncontradas.size, 28, "Devem existir 28 chaves unicas de unidades");
});

test("CHALLENGE 5: Integridade e contabilidade de contatos.json", () => {
  const cont = carregar("contatos.json");

  assert.equal(cont.disponivel, true);
  assert.equal(cont.totais.ufs, 27, "Totais deve indicar 27 UFs");
  assert.equal(cont.totais.cadastrosInstitucionais, 29, "Totais deve indicar 29 orgaos");
  assert.equal(cont.totais.contatosNominais, 150, "Totais deve indicar 150 contatos");

  assert.equal(cont.cadastroPorUf.length, 29, "cadastroPorUf deve ter 29 registros");
  assert.equal(cont.pessoasPorUf.length, 150, "pessoasPorUf deve ter 150 pessoas");

  // Verificar conjunto de UFs unicas
  const ufsCadastro = new Set(cont.cadastroPorUf.map(c => c.uf));
  const ufsPessoas = new Set(cont.pessoasPorUf.map(p => p.uf));

  assert.equal(ufsCadastro.size, 27, "cadastroPorUf deve conter todas as 27 UFs do Brasil");
  assert.deepEqual([...ufsCadastro].sort(), [...UFS_OFICIAIS].sort(), "UFs do cadastro devem ser exatamente as 27 oficiais");
  assert.deepEqual([...ufsPessoas].sort(), [...UFS_OFICIAIS].sort(), "UFs de contatos devem ser exatamente as 27 oficiais");

  // Quais UFs possuem 2 cadastros institucionais?
  const contagemUf = {};
  cont.cadastroPorUf.forEach(c => {
    contagemUf[c.uf] = (contagemUf[c.uf] || 0) + 1;
  });
  const ufsDuplas = Object.entries(contagemUf).filter(([_, count]) => count > 1).map(([uf]) => uf);
  assert.equal(ufsDuplas.length, 2, "Exatamente 2 UFs devem ter desdobramento institucional (ES e PR)");
  assert.deepEqual(ufsDuplas.sort(), ["ES", "PR"].sort(), "UFs desdobradas devem ser ES e PR");
  assert.equal(ufsCadastro.size + ufsDuplas.length, 29, "27 UFs + 2 orgaos adicionais = 29 cadastros");
});

test("CHALLENGE 6: Consistencia referencial cruzada com resumo-publicacao.json", () => {
  const resumo = carregar("resumo-publicacao.json");
  const aplicacao = carregar("aplicacao.json");
  const dash = carregar("dashboard-geral.json");
  const param = carregar("parametros-minimos.json");
  const formal = carregar("formalizacao-profor.json");
  const orc = carregar("orcamento-2026.json");
  const cont = carregar("contatos.json");

  // Arquivos listados
  assert.equal(resumo.arquivos.length, 6, "resumo deve listar os 6 arquivos principais");
  const arquivosDisco = fs.readdirSync(publicadosDir).filter(f => f.endsWith(".json") && f !== "resumo-publicacao.json");
  assert.deepEqual(resumo.arquivos.sort(), arquivosDisco.sort(), "Lista de arquivos deve coincidir exatamente com os arquivos em disco");

  // Totais referenciados
  assert.equal(resumo.totais.aplicacaoDadosBase, aplicacao.dadosBase.length);
  assert.equal(resumo.totais.conveniosProfor2022, aplicacao.dadosProfor2022.convenios.length);
  assert.equal(resumo.totais.parametrosMinimos, param.respostas.length);
  assert.equal(resumo.totais.formalizacaoProfor, formal.propostas.length);
  assert.equal(resumo.totais.orcamento2026, orc.itensOficiais.length);
  assert.deepEqual(resumo.totais.contatos, cont.totais);

  // Dashboard totais
  assert.equal(resumo.totais.dashboard.totalFomento, dash.resumoEsperado.totalFomento);
  assert.equal(resumo.totais.dashboard.totalConvenios, dash.resumoEsperado.totalConvenios);
  assert.equal(resumo.totais.dashboard.totalFaf, dash.resumoEsperado.totalFaf);
  assert.equal(resumo.totais.dashboard.totalDoacoes, dash.resumoEsperado.totalDoacoes);
  assert.equal(resumo.totais.dashboard.quantidadeUfsConvenios, dash.resumoEsperado.quantidadeUfsConvenios);
  assert.deepEqual(resumo.totais.dashboard.ufsConvenios, dash.resumoEsperado.ufsConvenios);
});

test("CHALLENGE 7: Mapeamento e consistencia de UFs (27 UFs + ES_1/ES_2) em todos os datasets", () => {
  const param = carregar("parametros-minimos.json");
  const cont = carregar("contatos.json");
  const formal = carregar("formalizacao-profor.json");
  const aplicacao = carregar("aplicacao.json");

  // Parametros Minimos: 26 UFs + DF + ES_1 + ES_2 = 28
  const ufsPm = param.respostas.map(r => r.uf);
  assert.equal(ufsPm.length, 28);
  assert.ok(ufsPm.includes("ES_1"), "Parametros Minimos deve ter ES_1");
  assert.ok(ufsPm.includes("ES_2"), "Parametros Minimos deve ter ES_2");
  assert.ok(!ufsPm.includes("ES"), "Parametros Minimos nao deve ter 'ES' generico solto");

  const ufsSemEsPm = ufsPm.filter(u => !u.startsWith("ES_"));
  assert.equal(ufsSemEsPm.length, 26, "Parametros Minimos deve ter 26 outras unidades");
  for (const uf of ufsSemEsPm) {
    assert.ok(UFS_OFICIAIS.has(uf), "UF " + uf + " em parametros-minimos nao e oficial");
  }

  // Contatos: 27 UFs oficiais
  const ufsCont = new Set(cont.cadastroPorUf.map(c => c.uf));
  assert.equal(ufsCont.size, 27);
  assert.ok(ufsCont.has("ES"), "Contatos deve ter ES oficial");

  // Formalizacao: 14 UFs oficiais
  for (const uf of formal.ufsAutorizadas) {
    assert.ok(UFS_OFICIAIS.has(uf), "UF " + uf + " em formalizacao nao e oficial");
  }

  // Convenios: 15 UFs oficiais
  for (const c of aplicacao.dadosProfor2022.convenios) {
    assert.ok(UFS_OFICIAIS.has(c.uf), "UF " + c.uf + " em convenios nao e oficial");
  }
});

test("CHALLENGE 8: Seguranca, ausencia de PII e blindagem estatica", () => {
  const arquivos = [
    "aplicacao.json",
    "dashboard-geral.json",
    "parametros-minimos.json",
    "formalizacao-profor.json",
    "orcamento-2026.json",
    "contatos.json",
    "resumo-publicacao.json"
  ];

  for (const nome of arquivos) {
    const raw = fs.readFileSync(path.join(publicadosDir, nome), "utf8");

    // Verificar padroes perigosos
    assert.ok(!/postgres(?:ql)?:\/\//i.test(raw), nome + " contem string de conexao postgres");
    assert.ok(!/PROFOR_ADMIN_TOKEN|ONASP_EDIT_PASSWORD/i.test(raw), nome + " contem segredos de configuracao");
    assert.ok(!/Bearer\s+[A-Za-z0-9_\-\.]{15,}/i.test(raw), nome + " contem token Bearer");
    assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)/i.test(raw), nome + " contem host local");
    assert.ok(!/<script\b|<\/script>|javascript:|onerror\s*=|onload\s*=/i.test(raw), nome + " contem possivel payload XSS");
    assert.ok(!/\b[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}\b/.test(raw), nome + " contem CPF formatado");
  }
});

test("CHALLENGE 9: Sanitizacao estrutural e expurgo de estruturas brutas/locais", () => {
  const aplicacao = carregar("aplicacao.json");
  const pm = carregar("parametros-minimos.json");
  const formal = carregar("formalizacao-profor.json");
  const orc = carregar("orcamento-2026.json");

  // Confirmar expurgos de seguranca estrutural
  assert.equal(aplicacao.detru, undefined, "aplicacao.json nao deve conter detru bruto no topo");
  assert.equal(pm.respostasBrutas, undefined, "parametros-minimos.json nao deve conter respostasBrutas");
  assert.equal(formal.registros, undefined, "formalizacao-profor.json nao deve conter registros brutos");
  assert.equal(orc.arquivo, undefined, "orcamento-2026.json nao deve expor caminho local de arquivo");
});

test("CHALLENGE 10: Verificacao independente de todos os Criterios de Aceitacao (AC1, AC2, AC3)", () => {
  const dash = carregar("dashboard-geral.json");
  const aplicacao = carregar("aplicacao.json");
  const pm = carregar("parametros-minimos.json");
  const orc = carregar("orcamento-2026.json");
  const cont = carregar("contatos.json");

  // AC1: 6 JSONs validados estruturalmente
  assert.ok(dash.dadosBase && dash.resumoEsperado);
  assert.ok(aplicacao.dadosBase && aplicacao.dadosProfor2022);
  assert.ok(pm.parametrosDisponiveis && pm.respostas);
  assert.ok(orc.itensOficiais && orc.resumoFrentes);
  assert.ok(cont.cadastroPorUf && cont.pessoasPorUf);

  // AC2: Metricas chave
  // Total Fomento: R$ 15.022.372,24
  assert.equal(dash.resumoEsperado.totalFomento, 15022372.24);
  // Convenios: 15
  assert.equal(dash.resumoEsperado.quantidadeUfsConvenios, 15);
  assert.equal(aplicacao.dadosProfor2022.convenios.length, 15);
  // Parametros Minimos: 28 UFs/unidades
  assert.equal(pm.resumo.unidadesDiagnosticadas, 28);
  // Orcamento 2026: 9 frentes/itens oficiais
  assert.equal(orc.itensOficiais.length, 9);
  // Contatos: 27 UFs
  assert.equal(cont.totais.ufs, 27);

  // AC3: Fidedignidade
  assert.equal(dash.dadosBase.length, 180);
});

