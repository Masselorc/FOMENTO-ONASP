const fs = require("fs");
const path = require("path");

const hooksDir = path.join(__dirname, "..", ".git", "hooks");
const hookPath = path.join(hooksDir, "pre-commit");

if (!fs.existsSync(hooksDir)) {
  console.error("Pasta .git/hooks nao encontrada. Execute este script dentro do repositorio Git.");
  process.exit(1);
}

const hookContent = `#!/bin/sh
echo "Publicando dados estaticos antes do commit..."
npm run publicar:dados
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "Falha ao publicar dados estaticos. Commit cancelado."
  exit $STATUS
fi

git add frontend/data/publicados/*.json
echo "Dados estaticos atualizados e adicionados ao commit."
exit 0
`;

fs.writeFileSync(hookPath, hookContent, "utf8");
fs.chmodSync(hookPath, 0o755);

console.log("Hook pre-commit configurado com sucesso.");
