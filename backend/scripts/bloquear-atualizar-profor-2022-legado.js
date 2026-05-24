console.error(
  [
    "O comando 'atualizar:profor-2022' esta aposentado.",
    "Ele pertencia ao orquestrador legado que aciona Transferegov e le workbook da planilha antiga.",
    "Use o fluxo PAD/reconstrucao e os dry-runs PROFOR/PAD apropriados.",
    "Para auditoria local excepcional, use o script legado dedicado de desenvolvimento, nunca este comando operacional.",
  ].join("\n")
);

process.exit(2);
