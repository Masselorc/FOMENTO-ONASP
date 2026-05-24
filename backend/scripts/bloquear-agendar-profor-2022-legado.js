console.error(
  [
    "O comando 'agendar:profor-2022' esta bloqueado como entrada operacional ordinaria.",
    "Ele inicia processo persistente e pode acionar DETRU, Transferegov e o orquestrador legado.",
    "Use fluxos PAD/reconstrucao e dry-runs PROFOR/PAD para validacao controlada.",
    "Para auditoria local excepcional, execute o agendador legado dedicado com guards explicitos.",
  ].join("\n")
);

process.exit(2);
