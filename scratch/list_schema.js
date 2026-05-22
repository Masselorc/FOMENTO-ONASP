const db = require("../backend/db/database");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables in database:");
console.log(tables.map(t => t.name).join("\n"));
