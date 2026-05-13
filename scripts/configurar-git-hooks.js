const fs = require("fs");
const path = require("path");

const hooksDir = path.join(__dirname, "..", ".git", "hooks");
const hookPath = path.join(hooksDir, "pre-commit");

if (!fs.existsSync(hooksDir)) {
  console.error("Pasta .git/hooks nao encontrada. Execute este script dentro do repositorio Git.");
  process.exit(1);
}

const hookContent = `#!/bin/sh
STAGED_FILES=$(git diff --cached --name-only)

if [ "$SKIP_PUBLICAR_DADOS" = "1" ]; then
  echo "SKIP_PUBLICAR_DADOS=1 detectado. Publicacao de dados ignorada neste commit."
  exit 0
fi

if [ -z "$STAGED_FILES" ]; then
  echo "Nenhum arquivo staged encontrado. Publicacao de dados estaticos nao e necessaria."
  exit 0
fi

NEEDS_PUBLICAR=0

while IFS= read -r FILE; do
  case "$FILE" in
    backend/data/aplicacao.json|Planilhas/*|backend/services/static-publication-service.js|backend/services/dashboard-publication-service.js|backend/services/orcamento-2026-service.js|backend/services/formalizacao-profor-service.js|backend/services/parametros-minimos-service.js|backend/scripts/publicar-dados-estaticos.js)
      NEEDS_PUBLICAR=1
      break
      ;;
    AGENTS.md|.gitignore|README.md|*.md|docs/*|memoria/*|scripts/configurar-git-hooks.js|scripts/validar-*.js|package.json|package-lock.json|playwright.config.js|tests/*)
      ;;
    *)
      ;;
  esac
done <<EOF
$STAGED_FILES
EOF

if [ "$NEEDS_PUBLICAR" -ne 1 ]; then
  echo "Nenhuma fonte de dados publicada foi alterada. Publicacao automatica ignorada."
  exit 0
fi

echo "Alteracoes que podem afetar dados publicados detectadas. Executando npm run publicar:dados..."
npm run publicar:dados
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "Falha ao publicar dados estaticos. Commit cancelado."
  exit $STATUS
fi

if ls frontend/data/publicados/*.json >/dev/null 2>&1; then
  git add frontend/data/publicados/*.json
  echo "Dados publicados adicionados ao commit."
else
  echo "Publicacao concluida, mas nenhum arquivo frontend/data/publicados/*.json foi encontrado para adicionar."
fi

exit 0
`;

fs.writeFileSync(hookPath, hookContent, "utf8");
fs.chmodSync(hookPath, 0o755);

console.log("Hook pre-commit configurado com sucesso.");
