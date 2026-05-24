console.error(
  [
    "O comando 'atualizar:profor-2022' esta aposentado.",
    "O orquestrador legado foi removido como caminho executavel.",
    "Use o fluxo PAD/reconstrucao e os dry-runs PROFOR/PAD apropriados.",
    "Este wrapper falha antes de banco, rede, Transferegov ou leitura de workbook.",
  ].join("\n")
);

process.exit(2);
