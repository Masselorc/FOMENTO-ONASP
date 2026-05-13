const { test, expect } = require("@playwright/test");

const LOCAL_ORIGIN = `http://localhost:${process.env.PORT || 8790}`;

const paginasPrincipais = [
  { view: "dashboard", selector: "#view-dashboard", menu: 'button[data-view="dashboard"]' },
  { view: "diagnostico-ouvidorias", selector: "#view-diagnostico-ouvidorias", menu: 'button[data-view="diagnostico-ouvidorias"]' },
  { view: "formalizacao", selector: "#view-formalizacao-profor", menu: 'button[data-view="formalizacao"]' },
  { view: "orcamento", selector: "#view-orcamento", menu: 'button[data-view="orcamento"]' },
  { view: "status-sistema", selector: "#view-status-sistema", menu: 'button[data-view="status-sistema"]' }
];

function registrarFalhasCriticas(page) {
  const falhas = [];

  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") {
      falhas.push(`console.error: ${mensagem.text()}`);
    }
  });

  page.on("pageerror", (erro) => {
    falhas.push(`pageerror: ${erro.message}`);
  });

  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === LOCAL_ORIGIN) {
      falhas.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || "sem detalhe"})`);
    }
  });

  return falhas;
}

test("carrega a SPA e acessa paginas principais sem erro critico", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#main-wrapper")).toBeVisible();
  await expect(page.locator("#view-dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Fomento para Ouvidoria/i })).toBeVisible();

  await page.waitForFunction(() => typeof window.toggleView === "function");

  for (const pagina of paginasPrincipais) {
    await expect(page.locator(pagina.menu)).toHaveCount(1);
    await page.evaluate((view) => window.toggleView(view), pagina.view);
    await expect(page.locator(pagina.selector)).toBeVisible();
  }

  expect(falhasCriticas).toEqual([]);
});
