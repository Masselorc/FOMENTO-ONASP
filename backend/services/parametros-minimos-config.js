const PARAMETROS_MINIMOS = [
  { key: "atoNormativoEspecifico", label: "Ato normativo específico", trilha: "Institucionalização" },
  { key: "ouvidorFormalmenteDesignado", label: "Ouvidor formalmente designado", trilha: "Pessoas" },
  { key: "dedicacaoEquipe", label: "Dedicação da equipe", trilha: "Pessoas" },
  { key: "salaAmbienteReservado", label: "Sala/ambiente reservado", trilha: "Estrutura" },
  { key: "computadoresNotebooks", label: "Computadores/notebooks", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-17"], ideal: ["M2-18"], unidadeProvidencia: "computadores/notebooks" },
  { key: "impressoraMultifuncional", label: "Impressora multifuncional", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-19"], ideal: ["M2-20"], unidadeProvidencia: "impressora(s) multifuncional(is)" },
  { key: "scanner", label: "Scanner", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-21", "Scanner atual", "Scanners atuais"], ideal: ["M2-22", "Scanner ideal", "Scanners ideais"], unidadeProvidencia: "scanner(s)" },
  { key: "mobiliarioEstacoesTrabalho", label: "Mobiliário/estações de trabalho", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-29"], ideal: ["M2-30"], unidadeProvidencia: "estação(ões) de trabalho ou mobiliário equivalente" },
  { key: "armariosArquivosChave", label: "Armários/arquivos com chave", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-31"], ideal: ["M2-32"], unidadeProvidencia: "armário(s)/arquivo(s) com chave" },
  { key: "emailInstitucional", label: "E-mail institucional", trilha: "Canais" },
  { key: "linhaTelefonica", label: "Linha telefônica", trilha: "Canais" },
  { key: "canalEletronicoRegistro", label: "Canal eletrônico de registro", trilha: "Canais" },
  { key: "falaBr", label: "Fala.BR", trilha: "Canais" },
  { key: "enderecoPostal", label: "Endereço postal", trilha: "Canais" },
  { key: "fluxoInternoTratamento", label: "Fluxo interno de tratamento", trilha: "Fluxo" }
];

const STATUS_FIXOS_PARAMETROS_MINIMOS = new Map([
  ["TEM", "TEM"],
  ["NAO TEM", "NÃO TEM"],
  ["NÃO TEM", "NÃO TEM"],
  ["PARCIAL", "PARCIAL"],
  ["VALIDAR", "VALIDAR"],
  ["NAO INFORMADO", "NÃO INFORMADO"],
  ["NÃO INFORMADO", "NÃO INFORMADO"],
  ["DEFICIT", "DÉFICIT"],
  ["DÉFICIT", "DÉFICIT"]
]);

function normalizarStatusParametroMinimo(status) {
  const valor = String(status || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!valor) return "NÃO INFORMADO";

  const falta = valor.match(/^FALTA\s*\+\s*(\d+)$/);
  if (falta) return `FALTA +${Number(falta[1])}`;

  return STATUS_FIXOS_PARAMETROS_MINIMOS.get(valor) || "NÃO INFORMADO";
}

function isStatusParametroMinimo(status) {
  const valor = normalizarStatusParametroMinimo(status);
  return STATUS_FIXOS_PARAMETROS_MINIMOS.has(valor) || /^FALTA \+\d+$/.test(valor);
}

function statusParaTela(status) {
  const valor = normalizarStatusParametroMinimo(status);
  const mapa = {
    "TEM": "Tem",
    "NÃO TEM": "Não tem",
    "PARCIAL": "Parcial",
    "VALIDAR": "Validar",
    "NÃO INFORMADO": "Não informado",
    "DÉFICIT": "Déficit"
  };

  if (valor.startsWith("FALTA +")) {
    return valor.replace("FALTA", "Falta");
  }

  return mapa[valor] || "Não informado";
}

module.exports = {
  PARAMETROS_MINIMOS,
  isStatusParametroMinimo,
  normalizarStatusParametroMinimo,
  statusParaTela
};
