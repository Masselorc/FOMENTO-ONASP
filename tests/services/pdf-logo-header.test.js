const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

function lerDimensoesPng(caminho) {
  const buffer = fs.readFileSync(caminho);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("cabecalho PDF preserva proporcao real do logo SENAPPEN", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const logoPath = path.join(repoRoot, "frontend/assets/senappen-logo.png");
  const indexPath = path.join(repoRoot, "index.html");
  const cssPath = path.join(repoRoot, "frontend/css/app.css");
  const appPath = path.join(repoRoot, "frontend/js/app.js");

  const logo = lerDimensoesPng(logoPath);
  const alturaCabecalho = 64;
  const larguraEsperada = Math.round((logo.width / logo.height) * alturaCabecalho);

  assert.equal(larguraEsperada, 90);

  const html = fs.readFileSync(indexPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const appCode = fs.readFileSync(appPath, "utf8");

  assert.match(html, /id="img-logo-senappen"[^>]*width="90"[^>]*height="64"/);
  assert.match(css, /\.senappen-logo\s*\{[^}]*aspect-ratio:\s*1526\s*\/\s*1080;[^}]*height:\s*64px;[^}]*width:\s*90px;/s);
  assert.match(css, /\.senappen-logo\s*\{[^}]*max-width:\s*90px;/s);
  assert.match(appCode, /logoImg\.width\s*=\s*90;/);
  assert.match(appCode, /logoImg\.height\s*=\s*64;/);
});

test("relatorio PDF usa texto solido nos KPIs sem barras de gradiente", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const cssPath = path.join(repoRoot, "frontend/css/app.css");
  const css = fs.readFileSync(cssPath, "utf8");

  const blocoInicio = css.indexOf(".report-content .kpi-card");
  assert.notEqual(blocoInicio, -1, "CSS do relatorio deve ter bloco proprio para KPIs");
  const bloco = css.slice(blocoInicio, blocoInicio + 2400);

  assert.match(bloco, /\.report-content \.kpi-value/);
  assert.match(bloco, /background:\s*none\s*!important/);
  assert.match(bloco, /-webkit-text-fill-color:\s*currentColor\s*!important/);
  assert.match(bloco, /text-shadow:\s*none\s*!important/);
  assert.match(bloco, /\.is-exporting \.report-content \.kpi-value/);
  assert.match(bloco, /\.report-content \.text-muted/);
  assert.match(bloco, /\.report-content \.small\.text-uppercase\.fw-bold/);
});

test("orcamento exibe vinculo Pena Justa na tela e no PDF", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const assetPath = path.join(repoRoot, "frontend/assets/pena-justa-logo.svg");
  const cssPath = path.join(repoRoot, "frontend/css/app.css");
  const appPath = path.join(repoRoot, "frontend/js/app.js");

  const asset = fs.readFileSync(assetPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const appCode = fs.readFileSync(appPath, "utf8");

  assert.match(asset, /<svg[^>]*viewBox="0 0 370 192"/);
  assert.doesNotMatch(asset, /background/i);
  assert.match(asset, /PENA/);
  assert.match(asset, /JUSTA/);

  assert.match(appCode, /PENA_JUSTA_LOGO_SRC/);
  assert.match(appCode, /calcularResumoPenaJustaOrcamento/);
  assert.match(appCode, /renderizarCardsPenaJustaOrcamento/);
  assert.match(appCode, /Valor total Pena Justa/);
  assert.match(appCode, /Valor em execução/);
  assert.match(appCode, /data-orcamento-campo="\$\{campo\}"/);
  assert.match(appCode, /renderizarLogoPenaJustaOrcamento\(item\)/);
  assert.match(appCode, /obterLogoPenaJustaParaPdf/);
  assert.match(appCode, /pdf\.addImage\(logoPenaJusta\.dataUrl,\s*'PNG'/);
  assert.match(appCode, /desenharResumoPenaJustaPdf/);
  assert.match(appCode, /RECORTE PENA JUSTA/);
  assert.match(appCode, /cardsPenaJusta/);
  assert.match(appCode, /Valor total Pena Justa/);
  assert.match(appCode, /Itens vinculados/);
  assert.match(appCode, /Valor executado/);
  assert.match(appCode, /budget-insight-grid-five/);
  assert.match(appCode, /row-cols-xl-6/);

  assert.match(css, /\.budget-pena-justa-logo/);
  assert.match(css, /\.budget-pena-justa-summary/);
  assert.match(css, /\.budget-pena-justa-card/);
  assert.match(css, /\.budget-edit-checkbox/);
  assert.match(css, /\.budget-insight-grid-five/);

  const blocoResumoInicio = css.indexOf(".budget-pena-justa-summary");
  assert.notEqual(blocoResumoInicio, -1, "CSS do resumo Pena Justa deve existir");
  const blocoResumo = css.slice(blocoResumoInicio, blocoResumoInicio + 2600);

  assert.match(blocoResumo, /background:\s*linear-gradient\(180deg,\s*#162233/);
  assert.match(blocoResumo, /\.budget-pena-justa-summary-header h3\s*\{[^}]*color:\s*#f4f7fb;/s);
  assert.match(blocoResumo, /\.budget-pena-justa-summary-header \.section-eyebrow\s*\{[^}]*color:\s*#f4b63f;/s);
  assert.match(blocoResumo, /\.budget-pena-justa-card\s*\{[^}]*background:\s*#101b2a\s*!important;/s);
  assert.match(blocoResumo, /\.budget-pena-justa-card \.kpi-value/);
  assert.match(blocoResumo, /-webkit-text-fill-color:\s*currentColor\s*!important/);
  assert.doesNotMatch(blocoResumo, /rgba\(255,\s*255,\s*255,\s*0\.72\)/);

  const blocoFinalInicio = css.indexOf("Correção final de contraste do recorte Pena Justa");
  assert.notEqual(blocoFinalInicio, -1, "CSS deve ter override final contra gradientes globais");
  const blocoFinal = css.slice(blocoFinalInicio, blocoFinalInicio + 2600);
  assert.match(blocoFinal, /\.budget-pena-justa-summary \.budget-pena-justa-card\s*\{[^}]*background-image:\s*none\s*!important;/s);
  assert.match(blocoFinal, /\.budget-pena-justa-summary \.budget-pena-justa-card \.kpi-value/);
  assert.match(blocoFinal, /background-image:\s*none\s*!important/);
  assert.match(blocoFinal, /-webkit-text-fill-color:\s*currentColor\s*!important/);
});

test("PDF completo do orcamento expande andamentos e pagina a captura", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const css = fs.readFileSync(path.join(repoRoot, "frontend/css/app.css"), "utf8");
  const appCode = fs.readFileSync(path.join(repoRoot, "frontend/js/app.js"), "utf8");
  const inicio = appCode.indexOf("async function exportarOrcamentoPDF()");
  const fim = appCode.indexOf("async function obterLogoSenappenParaPdf()", inicio);

  assert.notEqual(inicio, -1, "Exportacao completa do Orçamento 2026 deve existir");
  assert.notEqual(fim, -1, "Bloco da exportacao completa deve ter limite identificavel");

  const bloco = appCode.slice(inicio, fim);
  assert.match(bloco, /rastreiosAbertosAntes/);
  assert.match(bloco, /idsRastreioExportacao/);
  assert.match(bloco, /itemPodeExibirRastreioOrcamento/);
  assert.match(bloco, /atualizarTabelaOrcamento\(budgetData\)/);
  assert.match(bloco, /atualizarTabelaOutrosOrcamento\(budgetData\)/);
  assert.match(bloco, /\.budget-tracking-row/);
  assert.match(bloco, /const blocosRastreioCss/);
  assert.match(bloco, /onclone:/);
  assert.match(bloco, /metricasPaginacao = obterMetricasPaginacao\(elementoClonado\)/);
  assert.match(bloco, /const blocoInterceptado/);
  assert.match(bloco, /fimFatia = blocoInterceptado\.inicio/);
  assert.match(bloco, /const escalaCanvasVertical = canvas\.height/);
  assert.match(bloco, /const alturaCapturaUtil = Math\.min/);
  assert.match(bloco, /metricasPaginacao\.fimConteudoCss/);
  assert.match(bloco, /const fatias = \[\]/);
  assert.match(bloco, /canvasPagina\.toDataURL\('image\/jpeg', 0\.92\)/);
  assert.match(bloco, /pdf\.setFillColor\(237, 242, 247\)/);
  assert.match(bloco, /Relatório completo com andamentos e atualizações cadastradas/);
  assert.match(bloco, /orcamentoItensRastreioAbertos = new Set\(rastreiosAbertosAntes\)/);

  assert.match(
    css,
    /\.is-exporting-budget #view-orcamento \.budget-tracking-row\.pdf-hidden\s*\{[^}]*display:\s*table-row\s*!important;/s
  );
  assert.match(css, /\.is-exporting-budget #view-orcamento\s*\{[^}]*background:\s*#edf2f7\s*!important;/s);
  assert.match(css, /\.is-exporting-budget #view-orcamento > \.action-buttons-floating/);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-data-table\s*\{[^}]*min-width:\s*0\s*!important;/s);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-pena-justa-summary\s*\{[^}]*background:\s*#fff8e8\s*!important;/s);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-data-table thead th[^{]*\{[^}]*background:\s*#244764\s*!important;/s);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.text-money[^{]*\{[^}]*background-image:\s*none\s*!important;/s);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-main-table th:last-child/);
  assert.match(css, /#budget-other-content thead th:last-child/);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-tracking-status\s*\{[^}]*background:\s*#e7edf3\s*!important;/s);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-tracking-label/);
  assert.match(css, /\.is-exporting-budget #view-orcamento \.budget-tracking-management/);
  assert.match(css, /grid-template-columns:\s*repeat\(var\(--budget-tracking-steps, 13\), minmax\(0, 1fr\)\)\s*!important/);
  assert.match(css, /color:\s*#1f2937\s*!important/);
});
