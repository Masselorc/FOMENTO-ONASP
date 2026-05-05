const fs = require("fs");
const path = require("path");
const { dbPath } = require("../db/database");

function criarBackupBanco(pagina) {
  const dataDir = path.join(__dirname, "..", "data");
  const backupDir = path.join(dataDir, "backups", pagina);
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `onasp-${timestamp}.sqlite`);

  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

module.exports = {
  criarBackupBanco
};
