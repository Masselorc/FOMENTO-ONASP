const {
  obterHtmlRelatorioPadTransferegov,
} = require("./profor-pad-transferegov-http-client");
const {
  obterHtmlRelatorioPadTransferegovPlaywright,
} = require("./profor-pad-transferegov-playwright-client");
const {
  parsearRelatorioPadTransferegov,
  validarHtmlPadExtraido,
} = require("./profor-pad-transferegov-parser");

function erroEstruturado(origem, erro) {
  return {
    origem,
    codigo: erro?.codigo || "ERRO_EXTRACAO_PAD_TRANSFEREGOV",
    mensagem: erro?.message || String(erro),
  };
}

function validarEParsearHtml({ html, instrumento, origem, diagnostico, parser, validador }) {
  const validacao = validador(html, { instrumento });
  if (!validacao.valido) {
    const error = new Error(`HTML PAD inválido via ${origem}: ${validacao.erros.join("; ")}`);
    error.codigo = "HTML_PAD_INVALIDO";
    throw error;
  }
  const dados = parser(html, { instrumento });
  return {
    sucesso: true,
    origem,
    dados,
    diagnostico: {
      ...(diagnostico || {}),
      validacao: {
        totalItens: validacao.totalItens,
        totaisTabela: validacao.totaisTabela || null,
      },
    },
  };
}

async function extrairPadTransferegov(instrumento, opcoes = {}) {
  const parser = opcoes.parser || parsearRelatorioPadTransferegov;
  const validador = opcoes.validadorHtml || validarHtmlPadExtraido;
  const obterHttp = opcoes.obterHtmlHttp || obterHtmlRelatorioPadTransferegov;
  const obterPlaywright = opcoes.obterHtmlPlaywright || obterHtmlRelatorioPadTransferegovPlaywright;
  const erros = [];

  try {
    const resultadoHttp = await obterHttp(instrumento, opcoes.http || {});
    return validarEParsearHtml({
      html: resultadoHttp.html,
      instrumento,
      origem: "http",
      diagnostico: resultadoHttp.diagnostico,
      parser,
      validador,
    });
  } catch (erro) {
    erros.push(erroEstruturado("http", erro));
  }

  if (!opcoes.fallbackPlaywright) {
    return {
      sucesso: false,
      origem: "falhou",
      dados: null,
      erros,
    };
  }

  try {
    const resultadoPlaywright = await obterPlaywright(instrumento, opcoes.playwright || {});
    return validarEParsearHtml({
      html: resultadoPlaywright.html,
      instrumento,
      origem: "playwright",
      diagnostico: resultadoPlaywright.diagnostico,
      parser,
      validador,
    });
  } catch (erro) {
    erros.push(erroEstruturado("playwright", erro));
  }

  return {
    sucesso: false,
    origem: "falhou",
    dados: null,
    erros,
  };
}

module.exports = {
  extrairPadTransferegov,
  validarEParsearHtml,
};
