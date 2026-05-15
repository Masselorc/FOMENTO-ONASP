const fs = require("fs");
const path = require("path");
const db = require("../db/database");
const { dbPath } = require("../db/database");

function normalizarSegmentoBackup(valor) {
  const texto = String(valor || "geral").trim();
  if (!texto) {
    throw new Error("Nome de pagina invalido para backup.");
  }

  if (texto.includes("..") || texto.includes("/") || texto.includes("\\")) {
    throw new Error("Nome de pagina invalido para backup.");
  }

  const segmento = texto.replace(/\s+/g, "-");
  if (!/^[A-Za-z0-9_-]+$/.test(segmento)) {
    throw new Error("Nome de pagina invalido para backup.");
  }

  return segmento;
}

function criarBackupBanco(pagina) {
  const paginaSegura = normalizarSegmentoBackup(pagina);
  const dataDir = path.join(__dirname, "..", "data");
  const backupDir = path.join(dataDir, "backups", paginaSegura);
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `onasp-${timestamp}.sqlite`);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Banco SQLite nao encontrado para backup: ${dbPath}`);
  }

  // Garante que alteracoes em WAL sejam consolidadas antes da copia fisica.
  db.pragma("wal_checkpoint(FULL)");
  fs.copyFileSync(dbPath, backupPath);

  const stats = fs.statSync(backupPath);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`Backup SQLite invalido (arquivo vazio): ${backupPath}`);
  }

  return backupPath;
}

module.exports = {
  criarBackupBanco
};
