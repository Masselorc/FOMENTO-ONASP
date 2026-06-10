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
