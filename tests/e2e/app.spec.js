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

async function bloquearRotasEscritaOrcamento2026(page) {
  const rotasBloqueadas = [
    '**/api/orcamento-2026/processos-vinculados/criar',
    '**/api/orcamento-2026/saldos/alocar',
    '**/api/orcamento-2026/salvar'
  ];

  for (const rota of rotasBloqueadas) {
    await page.route(rota, () => {
      throw new Error('O teste E2E não deve persistir dados reais no Orçamento 2026.');
    });
  }
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

test("orcamento 2026 expõe ações de divisão e alocação sem erro crítico", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearRotasEscritaOrcamento2026(page);

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();

  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("orcamento"));

  const viewOrcamento = page.locator("#view-orcamento");
  await expect(viewOrcamento).toBeVisible();
  await expect(viewOrcamento.locator("table.budget-main-table")).toBeVisible();
  await expect(viewOrcamento.locator("#budget-table-body tr").first()).toBeVisible();
  await expect(viewOrcamento.locator('th[title="Valor previsto"]').first()).toBeVisible();
  await expect(viewOrcamento.getByRole("columnheader", { name: /Ações/i }).first()).toBeVisible();

  const botaoDividir = viewOrcamento.locator("[data-orcamento-dividir-recurso]");
  if (await botaoDividir.count()) {
    await botaoDividir.first().click();

    const modalDividir = page.locator("#modalDividirRecursoOrcamento");
    await expect(modalDividir).toBeVisible();
    await expect(modalDividir.getByRole("heading", { name: "Dividir recurso" })).toBeVisible();
    await modalDividir.locator('[data-bs-dismiss="modal"]').first().click();
    await expect(modalDividir).toBeHidden();
  }

  const botaoAlocar = viewOrcamento.locator("[data-orcamento-alocar-saldo]");
  if (await botaoAlocar.count()) {
    await botaoAlocar.first().click();

    const modalAlocar = page.locator("#modalAlocarSaldoOrcamento");
    await expect(modalAlocar).toBeVisible();
    await expect(modalAlocar.getByRole("heading", { name: "Alocar saldo" })).toBeVisible();
    await modalAlocar.locator('[data-bs-dismiss="modal"]').first().click();
    await expect(modalAlocar).toBeHidden();
  }

  const badgeProcessoVinculado = viewOrcamento.locator(".budget-linked-badge");
  if (await badgeProcessoVinculado.count()) {
    await expect(badgeProcessoVinculado.first()).toBeVisible();
  }

  await expect(viewOrcamento.locator("table.budget-main-table")).toBeVisible();
  expect(falhasCriticas).toEqual([]);
});
