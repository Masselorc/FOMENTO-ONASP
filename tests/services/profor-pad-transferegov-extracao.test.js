const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  extrairPadTransferegov,
} = require("../../backend/services/profor-2022/profor-pad-transferegov-extracao-service");

function htmlValido(descricao = "Item HTTP") {
  return `
    <table>
      <tr>
        <th>Tipo Despesa</th><th>Descrição</th><th>Cód Nat Despesa</th><th>Unid</th><th>Quantidade</th>
        <th>Valor Unitário</th><th>Valor Total Previsto</th><th>Valor Total Executado</th><th>Saldo</th>
      </tr>
      <tr>
        <td>Bem</td><td>${descricao}</td><td>44.90.52</td><td>UN</td><td>1.0</td>
        <td>R$ 10,00</td><td>R$ 10,00</td><td>R$ 0,00</td><td>R$ 10,00</td>
      </tr>
    </table>
  `;
}

test("usa HTTP quando HTTP retorna HTML valido e nao chama Playwright", async () => {
  let chamouPlaywright = false;
  const resultado = await extrairPadTransferegov("937782", {
    obterHtmlHttp: async () => ({ html: htmlValido("Item HTTP"), diagnostico: { status: 200 } }),
    obterHtmlPlaywright: async () => {
      chamouPlaywright = true;
      return { html: htmlValido("Item Playwright") };
    },
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.origem, "http");
  assert.equal(resultado.dados.itens[0].descricao, "Item HTTP");
  assert.equal(chamouPlaywright, false);
});

test("nao chama Playwright quando HTTP falha e fallback nao esta habilitado", async () => {
  let chamouPlaywright = false;
  const resultado = await extrairPadTransferegov("937782", {
    obterHtmlHttp: async () => {
      throw new Error("HTTP indisponivel");
    },
    obterHtmlPlaywright: async () => {
      chamouPlaywright = true;
      return { html: htmlValido("Item Playwright") };
    },
  });

  assert.equal(resultado.sucesso, false);
  assert.equal(resultado.origem, "falhou");
  assert.equal(chamouPlaywright, false);
  assert.equal(resultado.erros[0].origem, "http");
});

test("chama Playwright quando HTTP falha e fallback esta habilitado", async () => {
  let chamadasParser = 0;
  const resultado = await extrairPadTransferegov("937782", {
    fallbackPlaywright: true,
    obterHtmlHttp: async () => {
      throw new Error("HTTP indisponivel");
    },
    obterHtmlPlaywright: async () => ({ html: htmlValido("Item Playwright"), diagnostico: { origem: "playwright" } }),
    parser: (html, opcoes) => {
      chamadasParser += 1;
      return require("../../backend/services/profor-2022/profor-pad-transferegov-parser").parsearRelatorioPadTransferegov(html, opcoes);
    },
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.origem, "playwright");
  assert.equal(resultado.dados.itens[0].descricao, "Item Playwright");
  assert.equal(chamadasParser, 1);
});

test("usa o mesmo parser para HTML vindo do HTTP e do Playwright", async () => {
  const origensParseadas = [];
  await extrairPadTransferegov("937782", {
    obterHtmlHttp: async () => ({ html: htmlValido("HTTP") }),
    parser: (html, opcoes) => {
      origensParseadas.push(html.includes("HTTP") ? "http" : "outro");
      return require("../../backend/services/profor-2022/profor-pad-transferegov-parser").parsearRelatorioPadTransferegov(html, opcoes);
    },
  });
  await extrairPadTransferegov("937782", {
    fallbackPlaywright: true,
    obterHtmlHttp: async () => {
      throw new Error("HTTP falhou");
    },
    obterHtmlPlaywright: async () => ({ html: htmlValido("PLAYWRIGHT") }),
    parser: (html, opcoes) => {
      origensParseadas.push(html.includes("PLAYWRIGHT") ? "playwright" : "outro");
      return require("../../backend/services/profor-2022/profor-pad-transferegov-parser").parsearRelatorioPadTransferegov(html, opcoes);
    },
  });

  assert.deepEqual(origensParseadas, ["http", "playwright"]);
});

test("retorna erro estruturado quando HTTP e Playwright falham", async () => {
  const resultado = await extrairPadTransferegov("937782", {
    fallbackPlaywright: true,
    obterHtmlHttp: async () => {
      throw new Error("HTTP falhou");
    },
    obterHtmlPlaywright: async () => {
      throw new Error("Playwright falhou");
    },
  });

  assert.equal(resultado.sucesso, false);
  assert.equal(resultado.origem, "falhou");
  assert.deepEqual(resultado.erros.map((erro) => erro.origem), ["http", "playwright"]);
});

test("orquestrador nao salva banco, nao cria cache nem chama fluxos externos indevidos", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-transferegov-extracao-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  assert.equal(source.includes("database"), false);
  assert.equal(source.includes("sqlite"), false);
  assert.equal(source.includes("writeFile"), false);
  assert.equal(source.includes("cache"), false);
  assert.equal(source.includes("detru"), false);
  assert.equal(source.includes("rendimentos"), false);
  assert.equal(source.includes("carregarPadsOperacional"), false);
});
