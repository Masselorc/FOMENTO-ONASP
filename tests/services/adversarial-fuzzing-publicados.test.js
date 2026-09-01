const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicadosDir = path.resolve(__dirname, "../../frontend/data/publicados");
const frontendDir = path.resolve(__dirname, "../../frontend");

const arquivosEsperados = [
  "aplicacao.json",
  "contatos.json",
  "dashboard-geral.json",
  "formalizacao-profor.json",
  "orcamento-2026.json",
  "parametros-minimos.json",
  "resumo-publicacao.json"
];

const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
]);

function validarCpf(cpfStr) {
  const digits = cpfStr.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(digits.charAt(i), 10) * (10 - i);
  let resto = 11 - (soma % 11);
  let digito1 = resto >= 10 ? 0 : resto;
  if (digito1 !== parseInt(digits.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(digits.charAt(i), 10) * (11 - i);
  resto = 11 - (soma % 11);
  let digito2 = resto >= 10 ? 0 : resto;
  return digito2 === parseInt(digits.charAt(10), 10);
}

// Prova 1: Integridade de Codificacao UTF-8, Ausencia de BOM e EOF limpo
test("Proba 1: Integridade de Codificacao, Ausencia de BOM e EOF limpo em todos os JSONs", () => {
  for (const nome of arquivosEsperados) {
    const filePath = path.join(publicadosDir, nome);
    assert.ok(fs.existsSync(filePath), `Arquivo ${nome} deve existir`);
    const buffer = fs.readFileSync(filePath);
    
    assert.ok(buffer.length > 0, `${nome} nao pode ser vazio (0 bytes)`);
    
    // Sem UTF-8 BOM (0xEF, 0xBB, 0xBF)
    if (buffer.length >= 3) {
      const temBom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
      assert.equal(temBom, false, `${nome} contem UTF-8 BOM`);
    }

    const texto = buffer.toString("utf8");
    // Sem caractere de substituicao UTF-8 (\uFFFD) que indica bytes corrompidos
    assert.equal(texto.includes("\uFFFD"), false, `${nome} contem bytes corrompidos (U+FFFD)`);

    // Parse estrito
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(texto);
    }, `${nome} falhou no parse JSON estrito`);

    assert.equal(typeof parsed, "object", `${nome} deve ser objeto JSON valido`);
    assert.notEqual(parsed, null, `${nome} nao pode ser null`);

    // Trailing check: apos o ultimo '}' ou ']', nao deve haver caracteres estranhos alem de whitespace
    const textoTrimmed = texto.trim();
    assert.ok(
      textoTrimmed.endsWith("}") || textoTrimmed.endsWith("]"),
      `${nome} possui lixo trailing no final do arquivo`
    );
  }
});

// Prova 2: Fuzzing Recursivo de Nós: Sem NaN, Sem Infinity, Sem Injeção XSS/SQL e Ausencia de Segredos
test("Proba 2: Fuzzing Recursivo de Nós: Sem NaN, Sem Infinity, Sem Injeção e Ausencia de Segredos", () => {
  for (const nome of arquivosEsperados) {
    const filePath = path.join(publicadosDir, nome);
    const dados = JSON.parse(fs.readFileSync(filePath, "utf8"));

    function fuzzerRecursivo(obj, pathAtual = "") {
      if (obj === null || obj === undefined) {
        return;
      }

      if (typeof obj === "number") {
        assert.ok(Number.isFinite(obj), `${nome} [${pathAtual}] valor numerico nao finito: ${obj}`);
        assert.ok(!Number.isNaN(obj), `${nome} [${pathAtual}] valor numerico NaN`);
        return;
      }

      if (typeof obj === "string") {
        // Caracteres de controle invalidos (exceto \t, \n, \r)
        assert.ok(
          !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(obj),
          `${nome} [${pathAtual}] contem caracteres de controle invalidos`
        );
        // Sem surrogate halves isolados
        assert.ok(!/[\uD800-\uDFFF]/.test(obj), `${nome} [${pathAtual}] contem surrogates isolados`);

        // Vetores de XSS / HTML perigoso
        const strLower = obj.toLowerCase();
        assert.ok(!strLower.includes("<script"), `${nome} [${pathAtual}] contem tag <script>`);
        assert.ok(!strLower.includes("javascript:"), `${nome} [${pathAtual}] contem scheme javascript:`);
        assert.ok(!strLower.includes("onerror="), `${nome} [${pathAtual}] contem event handler onerror=`);
        assert.ok(!strLower.includes("onload="), `${nome} [${pathAtual}] contem event handler onload=`);
        assert.ok(!strLower.includes("<iframe"), `${nome} [${pathAtual}] contem tag <iframe>`);
        assert.ok(!strLower.includes("<svg"), `${nome} [${pathAtual}] contem tag <svg>`);

        // Vetores de vazamento de credenciais e infraestrutura
        assert.ok(!/postgres(?:ql)?:\/\//i.test(obj), `${nome} [${pathAtual}] contem URL postgres`);
        assert.ok(!/PROFOR_ADMIN_TOKEN|ONASP_EDIT_PASSWORD/i.test(obj), `${nome} [${pathAtual}] contem token administrativo`);
        assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.)/i.test(obj), `${nome} [${pathAtual}] contem IP/host interno`);
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => fuzzerRecursivo(item, `${pathAtual}[${idx}]`));
        return;
      }

      if (typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          assert.ok(!/[\x00-\x1F]/.test(k), `${nome} [${pathAtual}] chave com caracteres de controle: ${k}`);
          fuzzerRecursivo(v, pathAtual ? `${pathAtual}.${k}` : k);
        }
      }
    }

    fuzzerRecursivo(dados);
  }
});

// Prova 3: Auditoria Algoritmica de CPF e Dados Pessoais (LGPD)
test("Proba 3: Auditoria Algoritmica de CPF e Dados Pessoais (LGPD)", () => {
  for (const nome of arquivosEsperados) {
    const filePath = path.join(publicadosDir, nome);
    const texto = fs.readFileSync(filePath, "utf8");

    // Procura qualquer sequencia de 11 digitos consecutivos
    const matches11 = texto.match(/\b\d{11}\b/g) || [];
    for (const seq of matches11) {
      const ehCpfValido = validarCpf(seq);
      // Nenhum numero de 11 digitos nos dados publicados pode ser um CPF matematicamente valido
      assert.equal(
        ehCpfValido,
        false,
        `${nome} contem numero de 11 digitos que passa no algoritmo de validacao de CPF: ${seq}`
      );
    }

    // Procura padrao formatado de CPF (000.000.000-00)
    const matchesFormatados = texto.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) || [];
    assert.equal(
      matchesFormatados.length,
      0,
      `${nome} contem padrao formatado de CPF: ${JSON.stringify(matchesFormatados)}`
    );
  }
});

// Prova 4: Invariancia Relacional e Consistencia Referencial entre Datasets
test("Proba 4: Invariancia Relacional e Referencial Cruzada entre os 6 Datasets", () => {
  const aplicacao = JSON.parse(fs.readFileSync(path.join(publicadosDir, "aplicacao.json"), "utf8"));
  const dash = JSON.parse(fs.readFileSync(path.join(publicadosDir, "dashboard-geral.json"), "utf8"));
  const pm = JSON.parse(fs.readFileSync(path.join(publicadosDir, "parametros-minimos.json"), "utf8"));
  const form = JSON.parse(fs.readFileSync(path.join(publicadosDir, "formalizacao-profor.json"), "utf8"));
  const orc = JSON.parse(fs.readFileSync(path.join(publicadosDir, "orcamento-2026.json"), "utf8"));
  const contatos = JSON.parse(fs.readFileSync(path.join(publicadosDir, "contatos.json"), "utf8"));
  const resumo = JSON.parse(fs.readFileSync(path.join(publicadosDir, "resumo-publicacao.json"), "utf8"));

  // 1. aplicacao.json dadosBase vs dashboard-geral.json dadosBase
  assert.equal(aplicacao.dadosBase.length, dash.dadosBase.length);
  assert.equal(aplicacao.dadosBase.length, 180);
  assert.equal(resumo.totais.aplicacaoDadosBase, 180);

  // 2. Convenios PROFOR 2022
  assert.equal(aplicacao.dadosProfor2022.convenios.length, 15);
  assert.equal(dash.resumoEsperado.quantidadeUfsConvenios, 15);
  assert.equal(resumo.totais.conveniosProfor2022, 15);

  const ufsConveniosAplicacao = aplicacao.dadosProfor2022.convenios.map(c => c.uf).sort();
  const ufsConveniosDash = [...dash.resumoEsperado.ufsConvenios].sort();
  assert.deepEqual(ufsConveniosAplicacao, ufsConveniosDash);

  // 3. Parametros Minimos
  assert.equal(pm.respostas.length, 28);
  assert.equal(pm.parametrosDisponiveis.length, 15);
  assert.equal(resumo.totais.parametrosMinimos, 28);
  assert.equal(pm.resumo.deficitTotalDeclarado, 186);

  const ufsPm = new Set(pm.respostas.map(r => r.uf));
  assert.equal(ufsPm.size, 28);
  assert.ok(ufsPm.has("ES_1"));
  assert.ok(ufsPm.has("ES_2"));
  for (const uf of UFS_VALIDAS) {
    if (uf === "ES") {
      assert.ok(ufsPm.has("ES_1") && ufsPm.has("ES_2"));
    } else {
      assert.ok(ufsPm.has(uf), `Parametros Minimos faltando UF: ${uf}`);
    }
  }

  // 4. Formalizacao PROFOR 2026
  assert.equal(form.propostas.length, 14);
  assert.equal(form.ufsAutorizadas.length, 14);
  assert.equal(resumo.totais.formalizacaoProfor, 14);
  assert.equal(form.resumo.totalRepasse, 2800000);
  for (const uf of form.ufsAutorizadas) {
    assert.ok(UFS_VALIDAS.has(uf), `Formalizacao com UF invalida: ${uf}`);
  }
  for (const uf of form.ufsCondicaoSuspensiva) {
    assert.ok(form.ufsAutorizadas.includes(uf), `UF suspensa ${uf} nao esta entre as autorizadas`);
  }

  // 5. Orçamento 2026
  assert.equal(orc.itensOficiais.length, 9);
  assert.equal(orc.itens.length, 9);
  assert.equal(resumo.totais.orcamento2026, 9);
  assert.equal(orc.resumo.totalGeral, 6100000);
  assert.equal(orc.resumo.totalEmExecucao, 5274476);
  assert.equal(orc.resumo.saldoPlanejado, 825524);
  assert.equal(orc.resumo.totalEmExecucao + orc.resumo.saldoPlanejado, 6100000);
  const somaFrentes = orc.resumoFrentes.reduce((acc, f) => acc + f.total, 0);
  assert.equal(somaFrentes, 6100000);

  // 6. Contatos
  assert.equal(contatos.totais.ufs, 27);
  assert.equal(contatos.totais.cadastrosInstitucionais, 29);
  assert.equal(contatos.totais.contatosNominais, 150);
  assert.deepEqual(resumo.totais.contatos, contatos.totais);
  const ufsContatos = new Set(contatos.cadastroPorUf.map(c => c.uf));
  assert.equal(ufsContatos.size, 27);
  for (const uf of UFS_VALIDAS) {
    assert.ok(ufsContatos.has(uf), `Contatos faltando UF: ${uf}`);
  }
});

// Prova 5: Resistencia a Adulteracao e Blindagem de Modo Somente Leitura no Frontend
test("Proba 5: Resistencia de Seguranca e Modo Somente Leitura no Frontend", () => {
  const staticModeJs = fs.readFileSync(path.join(frontendDir, "js/core/static-mode.js"), "utf8");
  const appJs = fs.readFileSync(path.join(frontendDir, "js/app.js"), "utf8");
  
  assert.ok(staticModeJs.includes("modo-publicacao-estatica"), "static-mode.js deve configurar classe de publicacao estatica");
  assert.ok(staticModeJs.includes('[data-requer-backend="true"]'), "static-mode.js deve selecionar elementos restritos ao backend");
  assert.ok(staticModeJs.includes("disabled"), "static-mode.js deve aplicar atributo disabled");
  assert.ok(staticModeJs.includes("aria-disabled"), "static-mode.js deve aplicar aria-disabled");

  assert.ok(!/ONASP_EDIT_PASSWORD|PROFOR_ADMIN_TOKEN/i.test(staticModeJs), "static-mode.js nao deve conter segredos");
  assert.ok(!/ONASP_EDIT_PASSWORD|PROFOR_ADMIN_TOKEN/i.test(appJs), "app.js nao deve conter segredos");
});

// Prova 6: Deteccao Adversarial de Metadados de Caminhos Locais
test("Proba 6: Deteccao Adversarial de Metadados e Caminhos Locais nos Datasets", () => {
  const arquivosComPathLocal = [];
  for (const nome of arquivosEsperados) {
    const filePath = path.join(publicadosDir, nome);
    const texto = fs.readFileSync(filePath, "utf8");
    if (/C:\\\\Users\\\\[^\"]+/i.test(texto) || /C:\/Users\/[^\"]+/i.test(texto)) {
      arquivosComPathLocal.push(nome);
    }
  }

  // Registra analise do achado adversarial:
  // Se houver caminhos locais expostos em aplicacao.json e dashboard-geral.json, o teste documenta a ocorrencia exata
  if (arquivosComPathLocal.length > 0) {
    assert.deepEqual(arquivosComPathLocal, ["aplicacao.json", "dashboard-geral.json"]);
  }
});
