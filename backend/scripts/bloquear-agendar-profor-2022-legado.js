console.error(
  [
    "O comando 'agendar:profor-2022' esta bloqueado como entrada operacional ordinaria.",
    "Ele iniciaria processo persistente e poderia acionar rotinas externas sensiveis.",
    "Use fluxos PAD/reconstrucao e dry-runs PROFOR/PAD para validacao controlada.",
    "Este wrapper falha antes de banco, rede, DETRU, Transferegov ou workbook.",
  ].join("\n")
);

process.exit(2);
