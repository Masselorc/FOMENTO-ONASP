const PARAMETROS_MINIMOS = [
  {
    key: "atoNormativoEspecifico",
    label: "Ato normativo específico",
    trilha: "Institucionalização",
    perguntas: ["M1-11", "M1-14", "M1-15"],
    fundamentoIn: "IN ONASP - formalização por ato normativo próprio",
    requerValidacao: true,
    falta: "Comprovação documental do ato normativo",
    providencias: {
      Validar: "Anexar ato normativo publicado",
      "Não tem": "Instituir ato normativo específico",
      "Não informado": "Informar situação do ato normativo"
    }
  },
  {
    key: "ouvidorFormalmenteDesignado",
    label: "Ouvidor formalmente designado",
    trilha: "Pessoas",
    perguntas: ["M0-06", "M0-07", "M3-57"],
    fundamentoIn: "IN ONASP - designação formal de ouvidor ou responsável",
    requerValidacao: true,
    falta: "Ato de designação formal",
    providencias: {
      Validar: "Apresentar ato de designação",
      "Não tem": "Designar formalmente ouvidor/responsável",
      "Não informado": "Informar responsável pela ouvidoria"
    }
  },
  {
    key: "dedicacaoEquipe",
    label: "Dedicação da equipe",
    trilha: "Pessoas",
    perguntas: ["M3-60"],
    fundamentoIn: "IN ONASP - dedicação funcional às atividades da ouvidoria",
    falta: "Dedicação funcional definida",
    providencias: {
      Parcial: "Definir dedicação funcional mínima à ouvidoria",
      "Não tem": "Definir dedicação funcional mínima à ouvidoria",
      "Não informado": "Informar dedicação funcional da equipe"
    }
  },
  {
    key: "salaAmbienteReservado",
    label: "Sala/ambiente reservado",
    trilha: "Estrutura",
    perguntas: ["M2-16"],
    fundamentoIn: "IN ONASP - ambiente reservado para atendimento",
    falta: "Ambiente reservado adequado",
    providencias: {
      Parcial: "Adequar espaço para atendimento com privacidade",
      "Não tem": "Destinar sala ou ambiente reservado",
      "Não informado": "Informar estrutura física da ouvidoria"
    }
  },
  { key: "computadoresNotebooks", label: "Computadores/notebooks", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-17"], ideal: ["M2-18"], fundamentoIn: "Art. 7º, I", unidadeProvidencia: "computadores/notebooks" },
  { key: "impressoraMultifuncional", label: "Impressora multifuncional", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-19"], ideal: ["M2-20"], fundamentoIn: "Art. 7º, II", unidadeProvidencia: "impressora(s) multifuncional(is)" },
  { key: "scanner", label: "Scanner", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-21", "Scanner atual", "Scanners atuais"], ideal: ["M2-22", "Scanner ideal", "Scanners ideais"], fundamentoIn: "Art. 7º, II", unidadeProvidencia: "scanner(s)" },
  { key: "mobiliarioEstacoesTrabalho", label: "Mobiliário/estações de trabalho", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-29"], ideal: ["M2-30"], fundamentoIn: "Art. 7º, III", unidadeProvidencia: "estação(ões) de trabalho ou mobiliário equivalente" },
  { key: "armariosArquivosChave", label: "Armários/arquivos com chave", trilha: "Estrutura", tipo: "quantitativo", atual: ["M2-31"], ideal: ["M2-32"], fundamentoIn: "Art. 7º, III; art. 4º, II", unidadeProvidencia: "armário(s)/arquivo(s) com chave" },
  {
    key: "emailInstitucional",
    label: "E-mail institucional",
    trilha: "Canais",
    perguntas: ["M2-41", "M2-42"],
    fundamentoIn: "Art. 6º, §2º, I",
    falta: "E-mail institucional da ouvidoria",
    providencias: {
      Validar: "Comprovar e-mail institucional da ouvidoria",
      "Não tem": "Criar e-mail institucional da ouvidoria",
      "Não informado": "Informar e-mail institucional da ouvidoria"
    }
  },
  {
    key: "linhaTelefonica",
    label: "Linha telefônica",
    trilha: "Canais",
    perguntas: ["M2-43", "M2-44"],
    fundamentoIn: "Art. 6º, §2º, II; art. 7º, IV",
    falta: "Linha telefônica funcional",
    providencias: {
      Validar: "Comprovar linha telefônica funcional",
      "Não tem": "Disponibilizar linha telefônica funcional",
      "Não informado": "Informar linha telefônica de atendimento"
    }
  },
  {
    key: "canalEletronicoRegistro",
    label: "Canal eletrônico de registro",
    trilha: "Canais",
    perguntas: ["M2-45", "M2-49", "M2-52"],
    fundamentoIn: "Art. 6º, §2º, III; art. 6º, §3º",
    requerValidacao: true,
    falta: "Canal eletrônico de registro",
    providencias: {
      Validar: "Comprovar canal eletrônico de registro",
      Parcial: "Implantar canal eletrônico completo de registro",
      "Não tem": "Implantar canal eletrônico de registro de manifestações",
      "Não informado": "Informar canal eletrônico de registro"
    }
  },
  {
    key: "falaBr",
    label: "Fala.BR",
    trilha: "Canais",
    perguntas: ["M2-46"],
    fundamentoIn: "Art. 4º, V; art. 6º, §2º, III; art. 6º, §3º",
    requerValidacao: true,
    falta: "Adesão ou integração ao Fala.BR",
    providencias: {
      Validar: "Comprovar uso ou integração ao Fala.BR",
      Parcial: "Prever integração ou uso direto do Fala.BR",
      "Não tem": "Prever adesão, integração ou indicação da Plataforma Fala.BR",
      "Não informado": "Informar uso da Plataforma Fala.BR"
    }
  },
  {
    key: "enderecoPostal",
    label: "Endereço postal",
    trilha: "Canais",
    perguntas: ["M2-47", "M2-48"],
    fundamentoIn: "Art. 6º, §2º, IV",
    falta: "Endereço postal para correspondências",
    providencias: {
      Validar: "Comprovar endereço postal da ouvidoria",
      "Não tem": "Instituir endereço postal para correspondências",
      "Não informado": "Informar endereço postal da ouvidoria"
    }
  },
  {
    key: "fluxoInternoTratamento",
    label: "Fluxo interno de tratamento",
    trilha: "Fluxo",
    perguntas: ["M4-67"],
    fundamentoIn: "Art. 13, I a V",
    requerValidacao: true,
    falta: "Fluxo interno formalizado",
    providencias: {
      Validar: "Validar documento ou rotina de fluxo interno",
      Parcial: "Formalizar fluxo interno mínimo",
      "Não tem": "Formalizar fluxo interno de tratamento das manifestações",
      "Não informado": "Informar fluxo interno de tratamento"
    }
  }
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
