const {
  URL_RELATORIO_PAD,
  URL_SESSAO_PUBLICA,
} = require("./profor-pad-transferegov-http-client");

function carregarPlaywright() {
  try {
    return require("playwright");
  } catch (erro) {
    const error = new Error("Playwright não está disponível neste projeto. Instale/prepare a dependência antes de habilitar o fallback.");
    error.causa = erro?.message || null;
    error.codigo = "PLAYWRIGHT_INDISPONIVEL";
    throw error;
  }
}

async function obterHtmlRelatorioPadTransferegovPlaywright(instrumento, opcoes = {}) {
  const { chromium } = carregarPlaywright();
  let browser = null;
  const headless = opcoes.headless !== false;

  try {
    browser = await chromium.launch({ headless });
    const page = await browser.newPage({
      locale: "pt-BR",
      userAgent: "ONASP-SENAPPEN-FOMENTO/1.0 poc-pad-publico-transferegov-playwright",
    });

    await page.goto(URL_SESSAO_PUBLICA, { waitUntil: "domcontentloaded", timeout: opcoes.timeout || 45_000 });
    await page.goto(URL_RELATORIO_PAD, { waitUntil: "domcontentloaded", timeout: opcoes.timeout || 45_000 });
    await page.locator('input[name="formRelatorioItensDespesasPAD:idInstrumento"]').fill(String(instrumento));
    await page.locator('input[name="formRelatorioItensDespesasPAD:_idJsp88"], input[value*="Gerar"]').first().click();
    await page.waitForSelector("table", { timeout: opcoes.timeout || 45_000 });
    await page.waitForFunction(() => document.body?.innerText?.includes("Total Geral"), null, { timeout: opcoes.timeout || 45_000 });

    return {
      html: await page.content(),
      diagnostico: {
        instrumento: String(instrumento),
        origem: "playwright",
        urlFinal: page.url(),
      },
    };
  } catch (erro) {
    const error = new Error(`Falha no fallback Playwright PAD Transferegov: ${erro?.message || erro}`);
    error.codigo = erro?.codigo || "PLAYWRIGHT_FALHOU";
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  carregarPlaywright,
  obterHtmlRelatorioPadTransferegovPlaywright,
};
