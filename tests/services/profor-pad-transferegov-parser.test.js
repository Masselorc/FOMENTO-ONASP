const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  criarHashItemPad,
  decodificarEntidadesHtml,
  parsearRelatorioPadTransferegov,
  validarHtmlPadExtraido,
} = require("../../backend/services/profor-2022/profor-pad-transferegov-parser");

function htmlAmostra() {
  return `
    <html>
      <body>
        <table id="irrelevante"><tr><td>Sem dados PAD</td></tr></table>
        <table id="formRelatorioItensDespesasPAD:tabela">
          <tr>
            <th>Tipo Despesa</th>
            <th>Descrição</th>
            <th>Cód Nat Despesa</th>
            <th>Unid</th>
            <th>Quantidade</th>
            <th>Valor Unitário</th>
            <th>Valor Total Previsto</th>
            <th>Valor Total Executado</th>
            <th>Saldo</th>
          </tr>
          <tr>
            <td>Bem</td>
            <td>Kit &#039;Ouvidoria&#039; &amp; Atendimento</td>
            <td>44.90.52</td>
            <td>UN</td>
            <td>2.0</td>
            <td>R$ 1.234,56</td>
            <td>R$ 2.469,12</td>
            <td>R$ 469,12</td>
            <td>R$ 2.000,00</td>
          </tr>
          <tr>
            <td>Serviço</td>
            <td>Capacitação técnica</td>
            <td>33.90.39</td>
            <td>UN</td>
            <td>10,5</td>
            <td>100,00</td>
            <td>1.050,00</td>
            <td>0,00</td>
            <td>1.050,00</td>
          </tr>
          <tr>
            <td colspan="6">Total Geral</td>
            <td>R$ 3.519,12</td>
            <td>R$ 469,12</td>
            <td>R$ 3.050,00</td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function htmlComCabecalhoVariado() {
  return `
    <table>
      <tr>
        <th>Tipo da Despesa</th><th>Descricao</th><th>Codigo Natureza Despesa</th><th>Unidade</th>
        <th>Quantidade</th><th>Valor Unit</th><th>Valor Total Previsto</th><th>Valor Total Executado</th><th>Saldo</th>
      </tr>
      <tr>
        <td>Outros</td><td>Item simples</td><td>33.90.30</td><td>UN</td>
        <td>1.0</td><td>R$ 10,00</td><td>R$ 10,00</td><td>R$ 0,00</td><td>R$ 10,00</td>
      </tr>
    </table>
  `;
}

test("localiza tabela PAD e extrai colunas normalizadas", () => {
  const resultado = parsearRelatorioPadTransferegov(htmlAmostra(), { instrumento: "937782" });

  assert.equal(resultado.instrumento, "937782");
  assert.equal(resultado.totalItens, 2);
  assert.equal(resultado.itens[0].tipoDespesa, "Bem");
  assert.equal(resultado.itens[0].descricao, "Kit 'Ouvidoria' & Atendimento");
  assert.equal(resultado.itens[0].codigoNaturezaDespesa, "44.90.52");
  assert.equal(resultado.itens[0].codigoNaturezaNormalizado, "449052");
  assert.equal(resultado.itens[0].natureza, "CAPITAL");
  assert.equal(resultado.itens[1].natureza, "CUSTEIO");
});

test("normaliza moeda brasileira, quantidade e totalizadores", () => {
  const resultado = parsearRelatorioPadTransferegov(htmlAmostra(), { instrumento: "937782" });

  assert.equal(resultado.itens[0].quantidade, 2);
  assert.equal(resultado.itens[0].valorUnitario, 1234.56);
  assert.equal(resultado.itens[0].valorTotalPrevisto, 2469.12);
  assert.equal(resultado.itens[0].valorTotalExecutado, 469.12);
  assert.equal(resultado.itens[0].saldo, 2000);
  assert.equal(resultado.itens[1].quantidade, 10.5);
  assert.deepEqual(resultado.totais, {
    valorTotalPrevisto: 3519.12,
    valorTotalExecutado: 469.12,
    saldo: 3050,
  });
});

test("aceita variacoes simples de cabecalho para mapear colunas", () => {
  const resultado = parsearRelatorioPadTransferegov(htmlComCabecalhoVariado(), { instrumento: "937782" });

  assert.equal(resultado.totalItens, 1);
  assert.equal(resultado.itens[0].tipoDespesa, "Outros");
  assert.equal(resultado.itens[0].codigoNaturezaNormalizado, "339030");
  assert.equal(resultado.itens[0].valorTotalPrevisto, 10);
});

test("decodifica HTML entities numericas e nomeadas", () => {
  assert.equal(decodificarEntidadesHtml("Jo&#227;o &#039;Teste&#039; &amp; Cia"), "João 'Teste' & Cia");
});

test("falha claramente quando tabela obrigatoria nao existe", () => {
  assert.throws(
    () => parsearRelatorioPadTransferegov("<html><table><tr><td>Sem PAD</td></tr></table></html>", { instrumento: "937782" }),
    /Tabela obrigatória de itens PAD não localizada/
  );
});

test("detecta colunas obrigatorias ausentes", () => {
  const html = `
    <table>
      <tr><th>Descricao</th><th>Quantidade</th><th>Valor Total Previsto</th></tr>
      <tr><td>Item</td><td>1.0</td><td>R$ 10,00</td></tr>
    </table>
  `;

  assert.throws(
    () => parsearRelatorioPadTransferegov(html, { instrumento: "937782" }),
    /Colunas obrigatórias ausentes/
  );
});

test("detecta tabela PAD sem itens", () => {
  const html = `
    <table>
      <tr>
        <th>Tipo Despesa</th><th>Descrição</th><th>Cód Nat Despesa</th><th>Unid</th><th>Quantidade</th>
        <th>Valor Unitário</th><th>Valor Total Previsto</th><th>Valor Total Executado</th><th>Saldo</th>
      </tr>
    </table>
  `;

  assert.throws(
    () => parsearRelatorioPadTransferegov(html, { instrumento: "937782" }),
    /Tabela PAD localizada, mas sem itens/
  );
});

test("validacao de HTML detecta total geral incompatível", () => {
  const html = htmlAmostra().replace("R$ 3.519,12", "R$ 3.500,00");
  const validacao = validarHtmlPadExtraido(html, { instrumento: "937782" });

  assert.equal(validacao.valido, false);
  assert.ok(validacao.erros.some((erro) => erro.includes("Total geral valorTotalPrevisto")));
});

test("gera hash estavel do item", () => {
  const entrada = {
    instrumento: "937782",
    descricaoNormalizada: "KIT OUVIDORIA",
    codigoNaturezaDespesa: "44.90.52",
    quantidade: 2,
    valorUnitario: 1234.56,
    valorTotalPrevisto: 2469.12,
    valorTotalExecutado: 469.12,
    saldo: 2000,
  };

  assert.equal(criarHashItemPad(entrada), criarHashItemPad({ ...entrada }));
  assert.notEqual(criarHashItemPad(entrada), criarHashItemPad({ ...entrada, saldo: 1999.99 }));
});

test("parser reutiliza normalizadores PAD e nao aplica area ou rateio", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-transferegov-parser.js");
  const source = fs.readFileSync(servicePath, "utf8");
  const resultado = parsearRelatorioPadTransferegov(htmlAmostra(), { instrumento: "937782" });

  assert.equal(source.includes('require("./profor-pad-normalizacao-service")'), true);
  assert.equal(source.includes("converterNumeroPad"), true);
  assert.equal(source.includes("converterQuantidadePad"), true);
  assert.equal(source.includes("codigo.startsWith(\"33\")"), false);
  assert.equal(source.includes("moedaParaNumeroProfor"), false);
  assert.equal(source.includes("percentual"), false);
  assert.equal(Object.hasOwn(resultado.itens[0], "area"), false);
  assert.equal(Object.hasOwn(resultado.itens[0], "rateio"), false);
});
