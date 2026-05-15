const { test, expect } = require("@playwright/test");

const LOCAL_ORIGIN = `http://localhost:${process.env.PORT || 8790}`;
const METODOS_ESCRITA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const paginasPrincipais = [
  { view: "dashboard", selector: "#view-dashboard", menu: 'button[data-view="dashboard"]' },
  { view: "detalhamento", selector: "#view-detalhamento", menu: 'button[data-view="detalhamento"]' },
  { view: "formalizacao", selector: "#view-formalizacao-profor", menu: 'button[data-view="formalizacao"]' },
  { view: "profor2022", selector: "#view-profor-2022", menu: 'button[data-view="profor2022"]' },
  { view: "faf2021", selector: "#view-faf-2021", menu: 'button[data-view="faf2021"]' },
  { view: "doacoes2023", selector: "#view-doacoes-2023", menu: 'button[data-view="doacoes2023"]' },
  { view: "contatos", selector: "#view-contatos", menu: 'button[data-view="contatos"]' },
  { view: "diagnostico-ouvidorias", selector: "#view-diagnostico-ouvidorias", menu: 'button[data-view="diagnostico-ouvidorias"]' },
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

async function bloquearEscritasReais(page, { permitir = [] } = {}) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const metodo = request.method().toUpperCase();

    if (!METODOS_ESCRITA.has(metodo)) {
      await route.continue();
      return;
    }

    const url = request.url();
    const permitido = permitir.some((regra) => {
      if (typeof regra === "string") return url.includes(regra);
      if (regra instanceof RegExp) return regra.test(url);
      if (typeof regra === "function") return regra(request);
      return false;
    });

    if (permitido) {
      await route.continue();
      return;
    }

    throw new Error(`Escrita real bloqueada em teste E2E: ${metodo} ${url}`);
  });
}

test("carrega a SPA e acessa paginas principais sem erro critico", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

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

test("modo estático mantém a aplicação somente leitura e bloqueia escrita real", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.route("**/api/orcamento-2026", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "API local do orçamento indisponível no teste E2E." })
    });
  });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");

  await page.evaluate(() => window.toggleView("orcamento"));

  const viewOrcamento = page.locator("#view-orcamento");
  await expect(viewOrcamento).toBeVisible();
  await expect(viewOrcamento.locator(".budget-loading-state")).toHaveCount(0, { timeout: 10000 });
  await expect(viewOrcamento.locator(".app-error-state")).toHaveCount(0);
  await expect(page.locator("body")).toHaveClass(/modo-publicacao-estatica/);

  const controlesBackend = viewOrcamento.locator('[data-requer-backend="true"]');
  const totalControles = await controlesBackend.count();
  expect(totalControles).toBeGreaterThan(0);

  const estados = await controlesBackend.evaluateAll((elementos) =>
    elementos.map((elemento) => ({
      disabledAttr: elemento.getAttribute("disabled"),
      ariaDisabled: elemento.getAttribute("aria-disabled"),
      possuiClasseDisabled: elemento.classList.contains("disabled")
    }))
  );

  for (const estado of estados) {
    expect(estado.disabledAttr).toBe("disabled");
    expect(estado.ariaDisabled).toBe("true");
    expect(estado.possuiClasseDisabled).toBe(true);
  }

  const falhasNaoEsperadas = falhasCriticas.filter((falha) => (
    !falha.includes("console.error: Failed to load resource: the server responded with a status of 503")
  ));
  expect(falhasNaoEsperadas).toEqual([]);
});

test("orcamento 2026 expõe ações de divisão e alocação sem erro crítico", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();

  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("orcamento"));

  const viewOrcamento = page.locator("#view-orcamento");
  await expect(viewOrcamento).toBeVisible();
  await expect(viewOrcamento.locator(".budget-loading-state")).toHaveCount(0, { timeout: 10000 });
  await expect(viewOrcamento.locator(".app-error-state")).toHaveCount(0);
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
