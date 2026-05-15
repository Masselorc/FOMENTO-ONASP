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

function filtrarFalhasEsperadasDeFallback(falhasCriticas) {
  return falhasCriticas.filter((falha) => (
    !falha.includes("console.error: Failed to load resource: the server responded with a status of 503")
  ));
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

  const falhasNaoEsperadas = filtrarFalhasEsperadasDeFallback(falhasCriticas);
  expect(falhasNaoEsperadas).toEqual([]);
});

test("formalização PROFOR faz fallback para JSON publicado quando API local falha", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.route("**/api/formalizacao-profor", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "API local de formalização indisponível no teste E2E." })
    });
  });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("formalizacao"));

  const viewFormalizacao = page.locator("#view-formalizacao-profor");
  await expect(viewFormalizacao).toBeVisible();
  await expect(viewFormalizacao.locator(".app-error-state")).toHaveCount(0);
  await expect(page.locator("body")).toHaveClass(/modo-publicacao-estatica/);
  await expect(viewFormalizacao.getByText(/Formalização PROFOR|Formalização/i).first()).toBeVisible();

  const falhasNaoEsperadas = filtrarFalhasEsperadasDeFallback(falhasCriticas);
  expect(falhasNaoEsperadas).toEqual([]);
});

test("parâmetros mínimos faz fallback para JSON publicado quando API local falha", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.route("**/api/parametros-minimos", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "API local de parâmetros mínimos indisponível no teste E2E." })
    });
  });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("diagnostico-ouvidorias"));

  const viewDiagnostico = page.locator("#view-diagnostico-ouvidorias");
  await expect(viewDiagnostico).toBeVisible();
  await expect(viewDiagnostico.locator(".app-error-state")).toHaveCount(0);
  await expect(page.locator("body")).toHaveClass(/modo-publicacao-estatica/);
  await expect(viewDiagnostico.getByText(/Parâmetros Mínimos|Diagnóstico/i).first()).toBeVisible();

  const falhasNaoEsperadas = filtrarFalhasEsperadasDeFallback(falhasCriticas);
  expect(falhasNaoEsperadas).toEqual([]);
});

test("renderiza campos livres como texto seguro sem executar XSS", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  const PAYLOAD_XSS = '<img src=x onerror="window.__xssExecutado = true">';
  const PAYLOAD_LINK_XSS = "javascript:window.__xssExecutado = true";

  await page.addInitScript(() => {
    window.__xssExecutado = false;
  });

  await page.route("**/api/orcamento-2026", async (route) => {
    const respostaOriginal = await route.fetch();
    const payload = await respostaOriginal.json();

    if (Array.isArray(payload?.itens) && payload.itens.length) {
      payload.itens[0].observacao = PAYLOAD_XSS;
      payload.itens[0].descricao = PAYLOAD_XSS;
      payload.itens[0].processoSei = PAYLOAD_LINK_XSS;
    }

    await route.fulfill({
      response: respostaOriginal,
      json: payload
    });
  });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("orcamento"));

  const viewOrcamento = page.locator("#view-orcamento");
  await expect(viewOrcamento).toBeVisible();
  await expect(viewOrcamento.locator(".app-error-state")).toHaveCount(0);
  await expect(viewOrcamento.locator("table.budget-main-table")).toBeVisible();
  await expect(viewOrcamento.getByText(PAYLOAD_XSS).first()).toBeVisible();

  await expect(viewOrcamento.locator('img[src="x"]')).toHaveCount(0);
  await expect(viewOrcamento.locator("script")).toHaveCount(0);
  await expect(viewOrcamento.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.__xssExecutado)).toBe(false);

  expect(falhasCriticas).toEqual([]);
});

test("faf 2021 abre fluxo editável sem persistir dados reais", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("faf2021"));

  const viewFaf = page.locator("#view-faf-2021");
  await expect(viewFaf).toBeVisible();
  await expect(viewFaf.locator(".app-error-state")).toHaveCount(0);

  const botaoEdicao = viewFaf.locator("[data-faf2021-editar-item]");
  await expect(botaoEdicao.first()).toBeVisible();
  await botaoEdicao.first().click();

  const modalExecucao = page.locator("#modalFaf2021Execucao");
  await expect(modalExecucao).toBeVisible();
  await expect(modalExecucao.locator("#faf2021SalvarExecucao")).toBeVisible();
  await modalExecucao.locator('[data-bs-dismiss="modal"]').first().click();
  await expect(modalExecucao).toBeHidden();

  expect(falhasCriticas).toEqual([]);
});

test("formalização PROFOR abre fluxo editável sem persistir dados reais", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("formalizacao"));

  const viewFormalizacao = page.locator("#view-formalizacao-profor");
  await expect(viewFormalizacao).toBeVisible();
  await expect(viewFormalizacao.locator(".app-error-state")).toHaveCount(0);

  const botaoEditor = viewFormalizacao.locator("[data-formalizacao-toggle-editor]");
  await expect(botaoEditor.first()).toBeVisible();
  await botaoEditor.first().click();

  const botaoCancelar = viewFormalizacao.locator("[data-formalizacao-cancelar-linha]");
  const botaoSalvar = viewFormalizacao.locator("[data-formalizacao-salvar-linha]");
  await expect(botaoSalvar.first()).toBeVisible();
  await expect(botaoCancelar.first()).toBeVisible();
  await botaoCancelar.first().click();
  await expect(viewFormalizacao.locator("[data-formalizacao-salvar-linha]")).toHaveCount(0);

  expect(falhasCriticas).toEqual([]);
});

test("views críticas permanecem navegáveis em tablet e mobile", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  const viewportsResponsivos = [
    { nome: "tablet", size: { width: 768, height: 1024 } },
    { nome: "mobile", size: { width: 390, height: 844 } }
  ];

  const viewsResponsivasCriticas = [
    { view: "dashboard", selector: "#view-dashboard" },
    { view: "orcamento", selector: "#view-orcamento" },
    { view: "formalizacao", selector: "#view-formalizacao-profor" },
    { view: "diagnostico-ouvidorias", selector: "#view-diagnostico-ouvidorias" },
    { view: "faf2021", selector: "#view-faf-2021" },
    { view: "contatos", selector: "#view-contatos" }
  ];

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await page.waitForFunction(() => typeof window.toggleView === "function");

  for (const viewport of viewportsResponsivos) {
    await page.setViewportSize(viewport.size);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator(".app-menu-link")).toHaveCount(10);

    for (const pagina of viewsResponsivasCriticas) {
      await page.evaluate((view) => window.toggleView(view), pagina.view);
      const view = page.locator(pagina.selector);
      await expect(view).toBeVisible();
      await expect(view.locator(".app-error-state")).toHaveCount(0);
      await expect(page.locator(".modal.show")).toHaveCount(0);
      await expect(page.locator("#loading-overlay:not(.d-none)")).toHaveCount(0);
    }
  }

  expect(falhasCriticas).toEqual([]);
});

test("estrutura básica de acessibilidade permanece válida", async ({ page }) => {
  const falhasCriticas = registrarFalhasCriticas(page);
  await bloquearEscritasReais(page);

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /width=device-width/);
  await expect(page.locator("#main-wrapper")).toBeVisible();
  await expect(page.locator("#loading-overlay .visually-hidden")).toContainText("Carregando");

  await expect(page.getByRole("heading", { name: /Painel de Acompanhamento/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Fomento para Ouvidoria/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ir para Home|Home/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Detalhamento/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir menu lateral/i })).toBeVisible();

  await page.locator("body").click();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Tab");
  }
  const focoFoiParaElementoFocavel = await page.evaluate(() => {
    const ativo = document.activeElement;
    if (!ativo) return false;
    if (ativo === document.body) return false;
    const tabIndex = Number(ativo.getAttribute("tabindex"));
    return !Number.isNaN(tabIndex) || ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(ativo.tagName);
  });
  expect(focoFoiParaElementoFocavel).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Abrir menu lateral/i }).click();
  const sidebar = page.locator("#app-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveAttribute("aria-labelledby", "app-sidebar-title");
  await expect(page.locator("#app-sidebar-title")).toHaveText("Painel ONASP");
  await expect(page.getByRole("navigation", { name: /Navegação principal/i })).toBeVisible();
  await page.getByRole("button", { name: /Fechar menu/i }).click();
  await expect(sidebar).toBeHidden();

  await page.waitForFunction(() => typeof window.toggleView === "function");
  await page.evaluate(() => window.toggleView("faf2021"));
  const viewFaf = page.locator("#view-faf-2021");
  await expect(viewFaf).toBeVisible();
  await expect(viewFaf.locator("[data-faf2021-editar-item]").first()).toBeVisible();
  await viewFaf.locator("[data-faf2021-editar-item]").first().click();
  const modalFaf = page.locator("#modalFaf2021Execucao");
  await expect(modalFaf).toBeVisible();
  await expect(modalFaf.getByRole("heading", { name: /Editar execução/i })).toBeVisible();
  await expect(modalFaf.getByRole("button", { name: /Salvar/i })).toBeVisible();
  await modalFaf.locator('[data-bs-dismiss="modal"]').first().click();
  await expect(modalFaf).toBeHidden();

  expect(falhasCriticas).toEqual([]);
});

test("modo estático mantém controles de backend com aria-disabled", async ({ page }) => {
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
  await expect(page.locator("body")).toHaveClass(/modo-publicacao-estatica/);

  const controlesBackend = viewOrcamento.locator('[data-requer-backend="true"]');
  const totalControles = await controlesBackend.count();
  expect(totalControles).toBeGreaterThan(0);
  await expect(controlesBackend.first()).toHaveAttribute("aria-disabled", "true");

  const falhasNaoEsperadas = filtrarFalhasEsperadasDeFallback(falhasCriticas);
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
