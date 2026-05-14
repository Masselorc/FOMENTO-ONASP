const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const db = require("../db/database");
const { criarBackupBanco } = require("./backup-service");
const { registrarHistorico } = require("./historico-service");
const { validarSenhaEdicao } = require("./auth-service");

const PAGINA = "orcamento-2026";
const PLANILHA_ORCAMENTO = path.join(__dirname, "..", "..", "Planilhas", "orcamento_onasp.xlsx");
const ABA_BASE = "Base_Dados";
const ABA_PROCESSOS_NORMAIS = "Processos_Normais";
const ABA_PROFOR = "Andamento_CONV_PROFOR";

const STATUS_ORCAMENTO = [
  "PLANEJADO",
  "PROCESSO AUTUADO",
  "EM PESQUISA DE PREÇOS",
  "EM EXECUÇÃO",
  "EXECUTADO",
  "SUSPENSO",
  "CANCELADO",
  "VALIDAR"
];

const CAMPOS_EDITAVEIS_BASE = [
  "categoria",
  "descricao",
  "acao_orcamentaria",
  "plano_orcamentario",
  "natureza",
  "valor_previsto",
  "valor_disponibilizado",
  "valor_empenhado",
  "valor_executado",
  "valor_estimado_pesquisa_preco",
  "processo_autuado",
  "processo_sei",
  "status",
  "observacao",
  "classificacao_gerencial"
];

const CAMPOS_EDITAVEIS_RASTREIO = [
  "link_processo_sei",
  "data_processo_sei",
  "demanda_formalizada",
  "link_demanda_formalizada",
  "data_demanda_formalizada",
  "estudo_tecnico",
  "link_estudo_tecnico",
  "data_estudo_tecnico",
  "termo_referencia",
  "link_termo_referencia",
  "data_termo_referencia",
  "pesquisa_precos",
  "link_pesquisa_precos",
  "data_pesquisa_precos",
  "autorizacao_autoridade",
  "link_autorizacao_autoridade",
  "data_autorizacao_autoridade",
  "parecer_juridico",
  "link_parecer_juridico",
  "data_parecer_juridico",
  "empenho",
  "link_empenho",
  "data_empenho",
  "contrato",
  "link_contrato",
  "data_contratacao",
  "ordem_servico",
  "link_ordem_servico",
  "data_ordem_servico",
  "data_entrega",
  "ordem_bancaria",
  "link_ordem_bancaria",
  "data_ordem_bancaria",
  "profor_autuacao",
  "link_profor_autuacao",
  "data_profor_autuacao",
  "profor_parecer_tecnico",
  "link_profor_parecer_tecnico",
  "data_profor_parecer_tecnico",
  "profor_minuta_edital",
  "link_profor_minuta_edital",
  "data_profor_minuta_edital",
  "profor_ddo_cgof",
  "link_profor_ddo_cgof",
  "data_profor_ddo_cgof",
  "profor_abertura_programa",
  "link_profor_abertura_programa",
  "data_profor_abertura_programa",
  "profor_parecer_conjur",
  "link_profor_parecer_conjur",
  "data_profor_parecer_conjur",
  "profor_publicacao_gabsec",
  "link_profor_publicacao_gabsec",
  "data_profor_publicacao_gabsec"
];

const CAMPOS_EDITAVEIS = new Set([
  ...CAMPOS_EDITAVEIS_BASE,
  ...CAMPOS_EDITAVEIS_RASTREIO
]);

const COLUNAS_ORCAMENTO = [
  "id",
  "categoria",
  "descricao",
  "acao_orcamentaria",
  "plano_orcamentario",
  "natureza",
  "valor_previsto",
  "valor_disponibilizado",
  "valor_empenhado",
  "valor_executado",
  "valor_estimado_pesquisa_preco",
  "processo_autuado",
  "processo_sei",
  "status",
  "observacao",
  "compoe_orcamento",
  "processo_pai_id",
  "tipo_processo",
  "origem_recurso_id",
  "ordem_exibicao",
  "valor_alocado_origem",
  "classificacao_gerencial",
  "ativo",
  "tipo_rastreio",
  "abrangencia",
  "quantidade",
  "unidade",
  "valor_unitario",
  "link_processo_sei",
  "data_processo_sei",
  "demanda_formalizada",
  "link_demanda_formalizada",
  "data_demanda_formalizada",
  "estudo_tecnico",
  "link_estudo_tecnico",
  "data_estudo_tecnico",
  "termo_referencia",
  "link_termo_referencia",
  "data_termo_referencia",
  "pesquisa_precos",
  "link_pesquisa_precos",
  "data_pesquisa_precos",
  "autorizacao_autoridade",
  "link_autorizacao_autoridade",
  "data_autorizacao_autoridade",
  "parecer_juridico",
  "link_parecer_juridico",
  "data_parecer_juridico",
  "empenho",
  "link_empenho",
  "data_empenho",
  "contrato",
  "link_contrato",
  "data_contratacao",
  "ordem_servico",
  "link_ordem_servico",
  "data_ordem_servico",
  "data_entrega",
  "ordem_bancaria",
  "link_ordem_bancaria",
  "data_ordem_bancaria",
  "profor_autuacao",
  "link_profor_autuacao",
  "data_profor_autuacao",
  "profor_parecer_tecnico",
  "link_profor_parecer_tecnico",
  "data_profor_parecer_tecnico",
  "profor_minuta_edital",
  "link_profor_minuta_edital",
  "data_profor_minuta_edital",
  "profor_ddo_cgof",
  "link_profor_ddo_cgof",
  "data_profor_ddo_cgof",
  "profor_abertura_programa",
  "link_profor_abertura_programa",
  "data_profor_abertura_programa",
  "profor_parecer_conjur",
  "link_profor_parecer_conjur",
  "data_profor_parecer_conjur",
  "profor_publicacao_gabsec",
  "link_profor_publicacao_gabsec",
  "data_profor_publicacao_gabsec"
];

const CAMPOS_BACKFILL_SE_NAO_PREENCHIDOS = COLUNAS_ORCAMENTO.filter((campo) => (
  !["id", "valor_estimado_pesquisa_preco", "observacao", "ativo", "compoe_orcamento"].includes(campo)
));

const MAPA_CAMEL = {
  tipo_rastreio: "tipoRastreio",
  acao_orcamentaria: "acaoOrcamentaria",
  plano_orcamentario: "planoOrcamentario",
  valor_previsto: "valorPrevisto",
  valor_disponibilizado: "valorDisponibilizado",
  valor_empenhado: "valorEmpenhado",
  valor_executado: "valorExecutado",
  valor_estimado_pesquisa_preco: "valorEstimadoPesquisaPreco",
  processo_sei: "processoSei",
  processo_autuado: "processoAutuadoNumero",
  compoe_orcamento: "compoeOrcamentoNumero",
  processo_pai_id: "processoPaiId",
  tipo_processo: "tipoProcesso",
  origem_recurso_id: "origemRecursoId",
  ordem_exibicao: "ordemExibicao",
  valor_alocado_origem: "valorAlocadoOrigem",
  classificacao_gerencial: "classificacaoGerencial",
  link_processo_sei: "linkProcessoSei",
  data_processo_sei: "dataProcessoSei",
  demanda_formalizada: "demandaFormalizada",
  link_demanda_formalizada: "linkDemandaFormalizada",
  data_demanda_formalizada: "dataDemandaFormalizada",
  estudo_tecnico: "estudoTecnico",
  link_estudo_tecnico: "linkEstudoTecnico",
  data_estudo_tecnico: "dataEstudoTecnico",
  termo_referencia: "termoReferencia",
  link_termo_referencia: "linkTermoReferencia",
  data_termo_referencia: "dataTermoReferencia",
  pesquisa_precos: "pesquisaPrecos",
  link_pesquisa_precos: "linkPesquisaPrecos",
  data_pesquisa_precos: "dataPesquisaPrecos",
  autorizacao_autoridade: "autorizacaoAutoridade",
  link_autorizacao_autoridade: "linkAutorizacaoAutoridade",
  data_autorizacao_autoridade: "dataAutorizacaoAutoridade",
  parecer_juridico: "parecerJuridico",
  link_parecer_juridico: "linkParecerJuridico",
  data_parecer_juridico: "dataParecerJuridico",
  link_empenho: "linkEmpenho",
  data_empenho: "dataEmpenho",
  link_contrato: "linkContrato",
  data_contratacao: "dataContratacao",
  ordem_servico: "ordemServico",
  link_ordem_servico: "linkOrdemServico",
  data_ordem_servico: "dataOrdemServico",
  data_entrega: "dataEntrega",
  ordem_bancaria: "ordemBancaria",
  link_ordem_bancaria: "linkOrdemBancaria",
  data_ordem_bancaria: "dataOrdemBancaria",
  profor_autuacao: "proforAutuacao",
  link_profor_autuacao: "linkProforAutuacao",
  data_profor_autuacao: "dataProforAutuacao",
  profor_parecer_tecnico: "proforParecerTecnico",
  link_profor_parecer_tecnico: "linkProforParecerTecnico",
  data_profor_parecer_tecnico: "dataProforParecerTecnico",
  profor_minuta_edital: "proforMinutaEdital",
  link_profor_minuta_edital: "linkProforMinutaEdital",
  data_profor_minuta_edital: "dataProforMinutaEdital",
  profor_ddo_cgof: "proforDdoCgof",
  link_profor_ddo_cgof: "linkProforDdoCgof",
  data_profor_ddo_cgof: "dataProforDdoCgof",
  profor_abertura_programa: "proforAberturaPrograma",
  link_profor_abertura_programa: "linkProforAberturaPrograma",
  data_profor_abertura_programa: "dataProforAberturaPrograma",
  profor_parecer_conjur: "proforParecerConjur",
  link_profor_parecer_conjur: "linkProforParecerConjur",
  data_profor_parecer_conjur: "dataProforParecerConjur",
  profor_publicacao_gabsec: "proforPublicacaoGabsec",
  link_profor_publicacao_gabsec: "linkProforPublicacaoGabsec",
  data_profor_publicacao_gabsec: "dataProforPublicacaoGabsec"
};

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarStatusOrcamento(status) {
  const texto = normalizarTexto(status).replace(/\s+/g, " ");
  const mapa = {
    PLANEJADO: "PLANEJADO",
    "PROCESSO AUTUADO": "PROCESSO AUTUADO",
    "EM PESQUISA DE PRECOS": "EM PESQUISA DE PREÇOS",
    "EM EXECUCAO": "EM EXECUÇÃO",
    EXECUTADO: "EXECUTADO",
    SUSPENSO: "SUSPENSO",
    CANCELADO: "CANCELADO",
    VALIDAR: "VALIDAR"
  };

  if (mapa[texto]) return mapa[texto];
  if (texto.includes("EXECUCAO")) return "EM EXECUÇÃO";
  if (texto.includes("AUTUADO") || texto.includes("PROCESSO")) return "PROCESSO AUTUADO";
  if (texto.includes("PESQUISA")) return "EM PESQUISA DE PREÇOS";
  if (texto.includes("EXECUTADO")) return "EXECUTADO";
  if (texto.includes("SUSPENS")) return "SUSPENSO";
  if (texto.includes("CANCEL")) return "CANCELADO";
  if (texto.includes("VALID")) return "VALIDAR";
  return "PLANEJADO";
}

function statusIndicaProcessoAutuado(status) {
  const normalizado = normalizarStatusOrcamento(status);
  return normalizado !== "PLANEJADO" && normalizado !== "VALIDAR";
}

function normalizarClassificacaoGerencial(valor) {
  const texto = normalizarTexto(valor).replace(/\s+/g, "_");

  if (
    texto === "APARELHAMENTO"
    || texto === "SIM"
    || texto === "S"
    || texto === "1"
    || texto === "TRUE"
  ) {
    return "APARELHAMENTO";
  }

  if (
    texto === "NAO_APARELHAMENTO"
    || texto === "NAO"
    || texto === "N"
    || texto === "0"
    || texto === "FALSE"
  ) {
    return "NAO_APARELHAMENTO";
  }

  return "NAO_APARELHAMENTO";
}

function classificarGerencialmenteItemOrcamento(item) {
  const id = normalizarTexto(item?.id);
  const idsAparelhamento = new Set([
    "APON-001",
    "APON-002",
    "APON-003",
    "APON-004",
    "APON-005",
    "CONV-001"
  ]);

  return idsAparelhamento.has(id) ? "APARELHAMENTO" : "NAO_APARELHAMENTO";
}

function converterNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const normalizado = texto.replace(/\s+/g, "").replace(/^R\$/i, "");
  if (normalizado.includes(",") && normalizado.includes(".")) {
    return Number.parseFloat(normalizado.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (normalizado.includes(",")) return Number.parseFloat(normalizado.replace(",", ".")) || 0;
  return Number.parseFloat(normalizado) || 0;
}

function arredondarMoeda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function converterNumeroEstrito(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : Number.NaN;
  const texto = String(valor ?? "").trim();
  if (!texto) return Number.NaN;
  const normalizado = texto.replace(/\s+/g, "").replace(/^R\$/i, "");
  if (normalizado.includes(",") && normalizado.includes(".")) {
    return Number.parseFloat(normalizado.replace(/\./g, "").replace(",", "."));
  }
  if (normalizado.includes(",")) return Number.parseFloat(normalizado.replace(",", "."));
  return Number.parseFloat(normalizado);
}

function obterTextoOpcional(payload, ...nomes) {
  for (const nome of nomes) {
    const valor = limparTexto(payload?.[nome]);
    if (valor) return valor;
  }
  return "";
}

function normalizarStatusParaCriacao(status) {
  const texto = normalizarTexto(status).replace(/\s+/g, " ");
  if (!texto) {
    return { status: "PLANEJADO", valido: true, informado: false };
  }

  const mapa = {
    PLANEJADO: "PLANEJADO",
    "PROCESSO AUTUADO": "PROCESSO AUTUADO",
    "EM PESQUISA DE PRECOS": "EM PESQUISA DE PREÇOS",
    "EM EXECUCAO": "EM EXECUÇÃO",
    EXECUTADO: "EXECUTADO",
    SUSPENSO: "SUSPENSO",
    CANCELADO: "CANCELADO",
    VALIDAR: "VALIDAR"
  };

  if (mapa[texto]) return { status: mapa[texto], valido: true, informado: true };
  if (texto.includes("EXECUCAO")) return { status: "EM EXECUÇÃO", valido: true, informado: true };
  if (texto.includes("AUTUADO") || texto.includes("PROCESSO")) return { status: "PROCESSO AUTUADO", valido: true, informado: true };
  if (texto.includes("PESQUISA")) return { status: "EM PESQUISA DE PREÇOS", valido: true, informado: true };
  if (texto.includes("EXECUTADO")) return { status: "EXECUTADO", valido: true, informado: true };
  if (texto.includes("SUSPENS")) return { status: "SUSPENSO", valido: true, informado: true };
  if (texto.includes("CANCEL")) return { status: "CANCELADO", valido: true, informado: true };
  if (texto.includes("VALID")) return { status: "VALIDAR", valido: true, informado: true };

  return { status: "PLANEJADO", valido: false, informado: true };
}

function normalizarTipoRastreioParaCriacao(tipoRastreio) {
  const texto = normalizarTexto(tipoRastreio).replace(/\s+/g, " ");
  if (!texto) {
    return { tipoRastreio: "PROCESSO NORMAL", valido: true, informado: false };
  }

  if (texto === "PROCESSO NORMAL") {
    return { tipoRastreio: "PROCESSO NORMAL", valido: true, informado: true };
  }

  if (texto === "CONVENIO / PROFOR" || texto === "CONVÊNIO / PROFOR" || texto === "PROFOR / CONVENIO" || texto === "PROFOR / CONVÊNIO") {
    return { tipoRastreio: "CONVÊNIO / PROFOR", valido: true, informado: true };
  }

  return { tipoRastreio: "PROCESSO NORMAL", valido: false, informado: true };
}

function sanitizarIdProcesso(id) {
  return limparTexto(id)
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .toUpperCase();
}

function gerarIdProcessoVinculado(processoPaiId, registros) {
  const base = sanitizarIdProcesso(processoPaiId);
  if (!base) return "";

  const usados = new Set(
    (Array.isArray(registros) ? registros : [])
      .map((registro) => String(registro?.id || "").trim().toUpperCase())
      .filter(Boolean)
  );

  let sequencial = 1;
  while (sequencial < 10_000) {
    const candidato = `${base}-F${String(sequencial).padStart(2, "0")}`;
    if (!usados.has(candidato.toUpperCase())) return candidato;
    sequencial += 1;
  }

  return "";
}

function calcularSaldoBasicoParaVinculo(processoPai, registros) {
  const filhosAtivos = (Array.isArray(registros) ? registros : []).filter((registro) => (
    String(registro?.processo_pai_id || "").trim() === String(processoPai?.id || "").trim()
    && Number(registro?.ativo) === 1
  ));

  const totalFilhos = filhosAtivos.reduce((total, registro) => total + (Number(registro?.valor_previsto) || 0), 0);
  const totalPai = Number(processoPai?.valor_previsto) || 0;
  const empenhadoPai = Number(processoPai?.valor_empenhado) || 0;
  const executadoPai = Number(processoPai?.valor_executado) || 0;

  // Saldo básico considera filhos já criados; movimentações entre processos serão tratadas em etapa própria.
  return arredondarMoeda(totalPai - empenhadoPai - executadoPai - totalFilhos);
}

function formatarDataPlanilha(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const data = new Date(Math.round((valor - 25569) * 86400 * 1000));
    return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  return limparTexto(valor);
}

function obterLinhas(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false
  });
}

function normalizarOpcoesTermos(opcoes) {
  if (!Array.isArray(opcoes[0])) return [opcoes];
  return opcoes;
}

function obterIndice(headers, opcoes, ignorar = []) {
  const ignorados = ignorar.map(normalizarTexto);
  const conjuntos = normalizarOpcoesTermos(opcoes).map((grupo) => grupo.map(normalizarTexto));
  return headers.findIndex((header) => (
    !ignorados.some((termo) => header.includes(termo))
      && conjuntos.some((grupo) => grupo.every((termo) => header.includes(termo)))
  ));
}

function textoCelula(linha, indice, fallback = "") {
  if (indice < 0 || linha[indice] === null || linha[indice] === undefined) return fallback;
  return limparTexto(linha[indice]) || fallback;
}

function lerValor(linha, indice, tipo = "texto") {
  if (tipo === "numero") return arredondarMoeda(converterNumero(linha[indice]));
  if (tipo === "data") return formatarDataPlanilha(indice < 0 ? "" : linha[indice]);
  return textoCelula(linha, indice);
}

function montarMapaCamposPorId(sheet, definicoes) {
  const mapa = new Map();
  if (!sheet) return mapa;

  const linhas = obterLinhas(sheet);
  if (!linhas.length) return mapa;

  const headers = (linhas[0] || []).map(normalizarTexto);
  const colId = obterIndice(headers, ["ID"]);
  const indices = Object.entries(definicoes).map(([campo, config]) => ({
    campo,
    indice: obterIndice(headers, config.termos, config.ignorar || []),
    tipo: config.tipo || "texto"
  }));

  linhas.slice(1).forEach((linha) => {
    const id = textoCelula(linha, colId);
    if (!id) return;

    const dados = {};
    indices.forEach(({ campo, indice, tipo }) => {
      const valor = lerValor(linha, indice, tipo);
      if (valor !== "" && valor !== 0) dados[campo] = valor;
    });
    mapa.set(id, dados);
  });

  return mapa;
}

function montarMapaRastreioProcessosNormais(workbook) {
  return montarMapaCamposPorId(workbook.Sheets[ABA_PROCESSOS_NORMAIS], {
    status: { termos: ["STATUS"] },
    processo_sei: { termos: ["PROCESSO", "SEI"], ignorar: ["DATA", "LINK"] },
    link_processo_sei: { termos: ["LINK", "PROCESSO", "SEI"] },
    data_processo_sei: { termos: ["DATA", "PROCESSO", "SEI"], tipo: "data" },
    demanda_formalizada: { termos: [["DEMANDA"], ["DFD"], ["FORMALIZACAO", "DEMANDA"]], ignorar: ["DATA", "LINK"] },
    link_demanda_formalizada: { termos: [["LINK", "DEMANDA"], ["LINK", "DFD"]] },
    data_demanda_formalizada: { termos: [["DATA", "DEMANDA"], ["DATA", "DFD"]], tipo: "data" },
    estudo_tecnico: { termos: [["ETP"], ["ESTUDO", "TECNICO"], ["ESPECIFICACAO"]], ignorar: ["DATA", "LINK"] },
    link_estudo_tecnico: { termos: [["LINK", "ETP"], ["LINK", "ESTUDO", "TECNICO"], ["LINK", "ESPECIFICACAO"]] },
    data_estudo_tecnico: { termos: [["DATA", "ETP"], ["DATA", "ESTUDO", "TECNICO"], ["DATA", "ESPECIFICACAO"]], tipo: "data" },
    termo_referencia: { termos: ["TERMO", "REFERENCIA"], ignorar: ["DATA", "LINK"] },
    link_termo_referencia: { termos: ["LINK", "TERMO", "REFERENCIA"] },
    data_termo_referencia: { termos: ["DATA", "TERMO", "REFERENCIA"], tipo: "data" },
    pesquisa_precos: { termos: [["PESQUISA", "PRECO"], ["MAPA", "PRECO"], ["ORCAMENTO", "ESTIMADO"]], ignorar: ["DATA", "LINK"] },
    link_pesquisa_precos: { termos: [["LINK", "PESQUISA", "PRECO"], ["LINK", "MAPA", "PRECO"], ["LINK", "ORCAMENTO", "ESTIMADO"]] },
    data_pesquisa_precos: { termos: [["DATA", "PESQUISA", "PRECO"], ["DATA", "MAPA", "PRECO"], ["DATA", "ORCAMENTO", "ESTIMADO"]], tipo: "data" },
    autorizacao_autoridade: { termos: [["AUTORIZ"], ["APROVACAO"], ["APROVADO"]], ignorar: ["DATA", "LINK"] },
    link_autorizacao_autoridade: { termos: [["LINK", "AUTORIZ"], ["LINK", "APROVACAO"], ["LINK", "APROVADO"]] },
    data_autorizacao_autoridade: { termos: [["DATA", "AUTORIZ"], ["DATA", "APROVACAO"], ["DATA", "APROVADO"]], tipo: "data" },
    parecer_juridico: { termos: [["PARECER", "JURIDICO"], ["PARECER"]], ignorar: ["DATA", "LINK", "TECNICO"] },
    link_parecer_juridico: { termos: ["LINK", "PARECER"] },
    data_parecer_juridico: { termos: ["DATA", "PARECER"], tipo: "data" },
    empenho: { termos: ["EMPENHO"], ignorar: ["DATA", "LINK"] },
    link_empenho: { termos: ["LINK", "EMPENHO"] },
    data_empenho: { termos: ["DATA", "EMPENHO"], tipo: "data" },
    contrato: { termos: ["CONTRAT"], ignorar: ["DATA", "LINK"] },
    link_contrato: { termos: ["LINK", "CONTRAT"] },
    data_contratacao: { termos: ["DATA", "CONTRAT"], tipo: "data" },
    ordem_servico: { termos: ["ORDEM", "SERVICO"], ignorar: ["DATA", "LINK"] },
    link_ordem_servico: { termos: ["LINK", "ORDEM", "SERVICO"] },
    data_ordem_servico: { termos: ["DATA", "ORDEM", "SERVICO"], tipo: "data" },
    data_entrega: { termos: ["DATA", "ENTREG"], tipo: "data" },
    ordem_bancaria: { termos: [["ORDEM", "BANCARIA"], ["OB"]], ignorar: ["DATA", "LINK"] },
    link_ordem_bancaria: { termos: [["LINK", "ORDEM", "BANCARIA"], ["LINK", "OB"]] },
    data_ordem_bancaria: { termos: [["DATA", "ORDEM", "BANCARIA"], ["DATA", "OB"]], tipo: "data" }
  });
}

function montarMapaRastreioProfor(workbook) {
  return montarMapaCamposPorId(workbook.Sheets[ABA_PROFOR], {
    status: { termos: ["STATUS"] },
    processo_sei: { termos: ["PROCESSO", "SEI"], ignorar: ["DATA", "LINK"] },
    link_processo_sei: { termos: ["LINK", "PROCESSO", "SEI"] },
    data_processo_sei: { termos: ["DATA", "PROCESSO", "SEI"], tipo: "data" },
    profor_autuacao: { termos: ["AUTUACAO"], ignorar: ["DATA", "LINK"] },
    link_profor_autuacao: { termos: ["LINK", "AUTUACAO"] },
    data_profor_autuacao: { termos: ["DATA", "AUTUACAO"], tipo: "data" },
    profor_parecer_tecnico: { termos: ["PARECER", "TECNICO"], ignorar: ["DATA", "LINK"] },
    link_profor_parecer_tecnico: { termos: ["LINK", "PARECER", "TECNICO"] },
    data_profor_parecer_tecnico: { termos: ["DATA", "PARECER", "TECNICO"], tipo: "data" },
    profor_minuta_edital: { termos: ["MINUTA", "EDITAL"], ignorar: ["DATA", "LINK"] },
    link_profor_minuta_edital: { termos: ["LINK", "MINUTA", "EDITAL"] },
    data_profor_minuta_edital: { termos: ["DATA", "MINUTA", "EDITAL"], tipo: "data" },
    profor_ddo_cgof: { termos: [["DDO"], ["CGOF"]], ignorar: ["DATA", "LINK"] },
    link_profor_ddo_cgof: { termos: [["LINK", "DDO"], ["LINK", "CGOF"]] },
    data_profor_ddo_cgof: { termos: [["DATA", "DDO"], ["DATA", "CGOF"]], tipo: "data" },
    profor_abertura_programa: { termos: [["ABERTURA", "PROGRAMA"], ["CGGIR"]], ignorar: ["DATA", "LINK"] },
    link_profor_abertura_programa: { termos: [["LINK", "ABERTURA", "PROGRAMA"], ["LINK", "CGGIR"]] },
    data_profor_abertura_programa: { termos: [["DATA", "ABERTURA", "PROGRAMA"], ["DATA", "CGGIR"]], tipo: "data" },
    profor_parecer_conjur: { termos: [["PARECER", "CONJUR"], ["CONJUR"]], ignorar: ["DATA", "LINK"] },
    link_profor_parecer_conjur: { termos: [["LINK", "PARECER", "CONJUR"], ["LINK", "CONJUR"]] },
    data_profor_parecer_conjur: { termos: [["DATA", "PARECER", "CONJUR"], ["DATA", "CONJUR"]], tipo: "data" },
    profor_publicacao_gabsec: { termos: [["PUBLICACAO"], ["GABSEC"]], ignorar: ["DATA", "LINK"] },
    link_profor_publicacao_gabsec: { termos: [["LINK", "PUBLICACAO"], ["LINK", "GABSEC"]] },
    data_profor_publicacao_gabsec: { termos: [["DATA", "PUBLICACAO"], ["DATA", "GABSEC"]], tipo: "data" }
  });
}

function obterRegistrosIniciaisDaPlanilha() {
  if (!fs.existsSync(PLANILHA_ORCAMENTO)) return [];
  const workbook = XLSX.readFile(PLANILHA_ORCAMENTO, { cellDates: false });
  const sheet = workbook.Sheets[ABA_BASE];
  if (!sheet) return [];

  const rastreiosProcessosNormais = montarMapaRastreioProcessosNormais(workbook);
  const rastreiosProfor = montarMapaRastreioProfor(workbook);
  const linhas = obterLinhas(sheet);
  if (!linhas.length) return [];

  const headers = (linhas[0] || []).map(normalizarTexto);
  const colId = obterIndice(headers, ["ID"]);
  const colTipoRastreio = obterIndice(headers, ["TIPO", "RASTREIO"]);
  const colFrente = obterIndice(headers, ["FRENTE"]);
  const colDescricao = obterIndice(headers, [["ITENS"], ["ITEM"], ["DESCRI"], ["OBJETO"]]);
  const colNatureza = obterIndice(headers, ["NATUREZA"]);
  const colModalidade = obterIndice(headers, ["MODALIDADE"]);
  const colAbrangencia = obterIndice(headers, [["ABRANGENCIA"], ["UF"]]);
  const colQuantidade = obterIndice(headers, ["QUANTIDADE"]);
  const colUnidade = obterIndice(headers, ["UNIDADE"]);
  const colValorPrevisto = obterIndice(headers, ["VALOR", "TOTAL"]);
  const colValorUnitario = obterIndice(headers, ["VALOR", "UNITARIO"]);
  const colValorExecutado = obterIndice(headers, [["VALOR", "EXECUTADO"], ["EXECUTADO"], ["PAGO"]]);
  const colStatus = obterIndice(headers, ["STATUS"]);

  return linhas.slice(1).map((linha, index) => {
    const id = textoCelula(linha, colId, `ORC-${String(index + 1).padStart(3, "0")}`);
    const descricao = textoCelula(linha, colDescricao);
    const valorPrevisto = arredondarMoeda(converterNumero(linha[colValorPrevisto]));
    if (!descricao || normalizarTexto(descricao).includes("TOTAL") || valorPrevisto <= 0) return null;

    const tipoRastreio = textoCelula(linha, colTipoRastreio);
    const ehProfor = normalizarTexto(tipoRastreio).includes("PROFOR")
      || normalizarTexto(tipoRastreio).includes("CONVENIO")
      || normalizarTexto(descricao).includes("PROFOR");
    const dadosRastreio = ehProfor
      ? rastreiosProfor.get(id)
      : rastreiosProcessosNormais.get(id);
    const processoSei = dadosRastreio?.processo_sei || "";
    const status = normalizarStatusOrcamento(dadosRastreio?.status || textoCelula(linha, colStatus));

    return preencherColunas({
      id,
      categoria: textoCelula(linha, colFrente, "Não informado"),
      descricao,
      acao_orcamentaria: textoCelula(linha, colModalidade),
      plano_orcamentario: textoCelula(linha, colAbrangencia),
      natureza: textoCelula(linha, colNatureza),
      valor_previsto: valorPrevisto,
      valor_disponibilizado: 0,
      valor_empenhado: 0,
      valor_executado: arredondarMoeda(converterNumero(linha[colValorExecutado])),
      valor_estimado_pesquisa_preco: 0,
      processo_autuado: processoSei ? 1 : 0,
      processo_sei: processoSei,
      status,
      observacao: "",
      compoe_orcamento: 1,
      classificacao_gerencial: classificarGerencialmenteItemOrcamento({ id, descricao }),
      ativo: 1,
      tipo_rastreio: tipoRastreio,
      abrangencia: textoCelula(linha, colAbrangencia),
      quantidade: textoCelula(linha, colQuantidade),
      unidade: textoCelula(linha, colUnidade),
      valor_unitario: arredondarMoeda(converterNumero(linha[colValorUnitario])),
      ...(dadosRastreio || {})
    });
  }).filter(Boolean);
}

function preencherColunas(item) {
  return COLUNAS_ORCAMENTO.reduce((acc, coluna) => {
    if (coluna === "classificacao_gerencial") {
      acc[coluna] = normalizarClassificacaoGerencial(item[coluna]);
      return acc;
    }
    if (coluna === "tipo_processo") {
      acc[coluna] = item[coluna] || "PRINCIPAL";
      return acc;
    }
    if (coluna === "valor_alocado_origem") {
      acc[coluna] = Number(item[coluna]) || 0;
      return acc;
    }
    if (coluna === "ordem_exibicao") {
      acc[coluna] = item[coluna] ?? null;
      return acc;
    }
    acc[coluna] = item[coluna] ?? (coluna.startsWith("valor_") || ["processo_autuado", "compoe_orcamento", "ativo"].includes(coluna) ? 0 : "");
    return acc;
  }, {});
}

function valorAtualVazio(valor) {
  if (valor === null || valor === undefined || valor === "") return true;
  return false;
}

function devePreencherBackfill(atual, novo, campo) {
  if (novo === null || novo === undefined || novo === "") return false;
  if (["valor_previsto", "valor_disponibilizado", "valor_empenhado", "valor_executado", "valor_unitario"].includes(campo)) {
    return (Number(atual) || 0) === 0 && Number(novo) > 0;
  }
  if (campo === "processo_autuado") {
    return Number(atual) !== 1 && Number(novo) === 1;
  }
  return valorAtualVazio(atual);
}

function executarBackfillOrcamento() {
  const registros = obterRegistrosIniciaisDaPlanilha();
  if (!registros.length) return;

  const selectAtual = db.prepare("SELECT * FROM orcamento_2026 WHERE id = ?");
  const insert = db.prepare(`
    INSERT OR IGNORE INTO orcamento_2026 (${COLUNAS_ORCAMENTO.join(", ")}, atualizado_em)
    VALUES (${COLUNAS_ORCAMENTO.map(() => "?").join(", ")}, ?)
  `);
  const updatedAt = new Date().toISOString();

  db.transaction((items) => {
    items.forEach((item) => {
      const atual = selectAtual.get(item.id);
      if (!atual) {
        insert.run(...COLUNAS_ORCAMENTO.map((coluna) => item[coluna]), updatedAt);
        return;
      }

      const updates = CAMPOS_BACKFILL_SE_NAO_PREENCHIDOS.filter((campo) => (
        devePreencherBackfill(atual[campo], item[campo], campo)
      ));
      if (!updates.length) return;

      const sql = `
        UPDATE orcamento_2026
        SET ${updates.map((campo) => `${campo} = ?`).join(", ")}, atualizado_em = ?
        WHERE id = ?
      `;
      db.prepare(sql).run(...updates.map((campo) => item[campo]), updatedAt, item.id);
    });
  })(registros);
}

function executarBackfillClassificacaoGerencial() {
  const linhas = db.prepare("SELECT id, classificacao_gerencial FROM orcamento_2026").all();
  if (!linhas.length) return;

  const update = db.prepare(`
    UPDATE orcamento_2026
    SET classificacao_gerencial = ?, atualizado_em = ?
    WHERE id = ?
  `);
  const updatedAt = new Date().toISOString();

  db.transaction((items) => {
    items.forEach((linha) => {
      const classificacaoAtual = normalizarClassificacaoGerencial(linha.classificacao_gerencial);
      const classificacaoAutomatica = classificarGerencialmenteItemOrcamento({ id: linha.id });
      const deveAtualizar = !linha.classificacao_gerencial || classificacaoAtual === "NAO_APARELHAMENTO";

      if (deveAtualizar && classificacaoAutomatica === "APARELHAMENTO") {
        update.run(classificacaoAutomatica, updatedAt, linha.id);
      }
    });
  })(linhas);
}

function inicializarOrcamento2026() {
  executarBackfillOrcamento();
  executarBackfillClassificacaoGerencial();
}

function linhaParaItem(linha) {
  const valorPrevisto = Number(linha.valor_previsto) || 0;
  const valorEstimadoPesquisaPreco = Number(linha.valor_estimado_pesquisa_preco) || 0;
  const compoeOrcamento = Number(linha.compoe_orcamento) === 1;
  const statusNormalizado = normalizarStatusOrcamento(linha.status);
  // O badge e os totais seguem o estágio salvo quando o campo bruto ainda não
  // foi sincronizado com a coluna `processo_autuado`.
  const processoAutuado = Number(linha.processo_autuado) === 1 || statusIndicaProcessoAutuado(statusNormalizado);
  const classificacaoGerencial = normalizarClassificacaoGerencial(
    linha.classificacao_gerencial || classificarGerencialmenteItemOrcamento(linha)
  );
  const deveConsiderarEmExecucao = compoeOrcamento
    && processoAutuado
    && !statusNormalizado.includes("CANCELADO")
    && !statusNormalizado.includes("SUSPENSO");
  const valorEmExecucaoConsiderado = deveConsiderarEmExecucao ? valorEstimadoPesquisaPreco : 0;
  const saldoAparelhamento = classificacaoGerencial === "APARELHAMENTO"
    ? Math.max(0, arredondarMoeda(valorPrevisto - valorEmExecucaoConsiderado))
    : 0;
  const item = {
    id: linha.id,
    categoria: linha.categoria || "",
    frente: linha.categoria || "",
    descricao: linha.descricao || "",
    acaoOrcamentaria: linha.acao_orcamentaria || "",
    modalidade: linha.acao_orcamentaria || "-",
    planoOrcamentario: linha.plano_orcamentario || "",
    abrangencia: linha.abrangencia || linha.plano_orcamentario || "-",
    natureza: linha.natureza || "",
    quantidade: linha.quantidade || "",
    unidade: linha.unidade || "",
    valorPrevisto,
    valorTotal: valorPrevisto,
    valorUnitario: Number(linha.valor_unitario) || valorPrevisto,
    valorDisponibilizado: Number(linha.valor_disponibilizado) || 0,
    valorEmpenhado: Number(linha.valor_empenhado ?? linha.valor_disponibilizado) || 0,
    valorExecutado: Number(linha.valor_executado) || 0,
    valorEstimadoPesquisaPreco,
    processoAutuado,
    processoAutuadoNumero: processoAutuado ? 1 : 0,
    processoSei: linha.processo_sei || "",
    status: normalizarStatusOrcamento(linha.status || "PLANEJADO"),
    observacao: linha.observacao || "",
    compoeOrcamento,
    compoeOrcamentoNumero: compoeOrcamento ? 1 : 0,
    classificacaoGerencial,
    ehAparelhamento: classificacaoGerencial === "APARELHAMENTO",
    ativo: Number(linha.ativo) === 1,
    valorEmExecucaoConsiderado,
    saldoAparelhamento,
    atualizadoEm: linha.atualizado_em || ""
  };

  Object.entries(MAPA_CAMEL).forEach(([coluna, propriedade]) => {
    if (item[propriedade] === undefined) item[propriedade] = linha[coluna] ?? "";
  });

  // Campos de vínculo expostos na API; as regras de criação e saldo serão implementadas em etapas posteriores.
  item.processoPaiId = linha.processo_pai_id || "";
  item.tipoProcesso = linha.tipo_processo || "PRINCIPAL";
  item.origemRecursoId = linha.origem_recurso_id || "";
  item.ordemExibicao = linha.ordem_exibicao === "" || linha.ordem_exibicao === null || linha.ordem_exibicao === undefined
    ? null
    : Number(linha.ordem_exibicao);
  item.valorAlocadoOrigem = Number(linha.valor_alocado_origem) || 0;

  return item;
}

function agruparResumo(itens, chave, campoValor = "valorPrevisto") {
  const mapa = new Map();
  itens.forEach((item) => {
    const nome = item[chave] || "Não informado";
    const atual = mapa.get(nome) || { nome, itens: 0, total: 0 };
    atual.itens += 1;
    atual.total = arredondarMoeda(atual.total + (Number(item[campoValor]) || 0));
    mapa.set(nome, atual);
  });
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

function montarResumo(itensOficiais) {
  const totalOrcamento = arredondarMoeda(itensOficiais.reduce((total, item) => total + item.valorPrevisto, 0));
  const valorEmExecucao = arredondarMoeda(itensOficiais.reduce((total, item) => total + item.valorEmExecucaoConsiderado, 0));
  const valorEmpenhado = arredondarMoeda(itensOficiais.reduce((total, item) => total + item.valorEmpenhado, 0));
  const valorExecutado = arredondarMoeda(itensOficiais.reduce((total, item) => total + item.valorExecutado, 0));
  const saldoPlanejado = arredondarMoeda(totalOrcamento - valorEmExecucao);
  const processosAutuados = itensOficiais.filter((item) => item.processoAutuado).length;

  return {
    totalGeral: totalOrcamento,
    totalOrcamento,
    totalItens: itensOficiais.length,
    totalEmpenhado: valorEmpenhado,
    valorEmpenhado,
    totalEmExecucao: valorEmExecucao,
    valorEmExecucao,
    totalExecutado: valorExecutado,
    valorExecutado,
    saldoPlanejado,
    percentualEmExecucao: totalOrcamento > 0 ? (valorEmExecucao / totalOrcamento) * 100 : 0,
    processosAutuados,
    porStatus: agruparResumo(itensOficiais, "status"),
    porNatureza: agruparResumo(itensOficiais, "natureza"),
    porModalidade: agruparResumo(itensOficiais, "modalidade"),
    porFrente: agruparResumo(itensOficiais, "frente")
  };
}

function calcularResumoAparelhamento(itens) {
  const itensAparelhamento = itens.filter((item) => (
    item.ativo
    && item.compoeOrcamento
    && item.classificacaoGerencial === "APARELHAMENTO"
  ));

  const previstoAparelhamento = arredondarMoeda(
    itensAparelhamento.reduce((total, item) => total + (Number(item.valorPrevisto) || 0), 0)
  );
  const emExecucaoAparelhamento = arredondarMoeda(
    itensAparelhamento.reduce((total, item) => total + (Number(item.valorEmExecucaoConsiderado) || 0), 0)
  );
  const saldoAparelhamento = arredondarMoeda(previstoAparelhamento - emExecucaoAparelhamento);
  const pendentesPesquisaPreco = itensAparelhamento.filter((item) => {
    const status = normalizarTexto(item.status);
    return Boolean(item.processoAutuado)
      && (Number(item.valorEstimadoPesquisaPreco) || 0) <= 0
      && !status.includes("CANCELADO")
      && !status.includes("SUSPENSO");
  });

  return {
    previstoAparelhamento,
    emExecucaoAparelhamento,
    saldoAparelhamento,
    quantidadeItensAparelhamento: itensAparelhamento.length,
    quantidadePendentesPesquisaPreco: pendentesPesquisaPreco.length,
    itensPendentesPesquisaPreco: pendentesPesquisaPreco.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      processoSei: item.processoSei || ""
    }))
  };
}

function valoresUnicos(itens, chave) {
  return Array.from(new Set(itens.map((item) => item[chave]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function listarOrcamento2026() {
  inicializarOrcamento2026();
  const linhas = db.prepare(`
    SELECT *
    FROM orcamento_2026
    WHERE ativo = 1
    ORDER BY compoe_orcamento DESC, categoria, descricao
  `).all();
  const itens = linhas.map(linhaParaItem);
  const itensOficiais = itens.filter((item) => item.compoeOrcamento);
  const outrosProcessos = itens.filter((item) => !item.compoeOrcamento);

  return {
    arquivo: "Dados consolidados ONASP",
    disponivel: true,
    aba: "orcamento_2026",
    itens: itensOficiais,
    itensOficiais,
    outrosProcessos,
    statusPermitidos: STATUS_ORCAMENTO,
    resumo: montarResumo(itensOficiais),
    resumoAparelhamento: calcularResumoAparelhamento(itensOficiais),
    filtros: {
      frentes: valoresUnicos(itensOficiais, "frente"),
      status: valoresUnicos(itensOficiais, "status"),
      naturezas: valoresUnicos(itensOficiais, "natureza"),
      modalidades: valoresUnicos(itensOficiais, "modalidade")
    }
  };
}

function criarProcessoVinculadoOrcamento2026(payload = {}) {
  const senha = payload.password ?? payload.senha;
  if (!validarSenhaEdicao(senha)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  const processoPaiId = limparTexto(payload.processoPaiId ?? payload.processo_pai_id);
  if (!processoPaiId) {
    return { success: false, message: "processoPaiId é obrigatório." };
  }

  const descricao = limparTexto(payload.descricao);
  if (!descricao) {
    return { success: false, message: "Descrição é obrigatória." };
  }

  const valorAlocadoBruto = converterNumeroEstrito(payload.valorAlocado ?? payload.valor_alocado);
  if (!Number.isFinite(valorAlocadoBruto) || valorAlocadoBruto <= 0) {
    return { success: false, message: "valorAlocado deve ser um número maior que zero." };
  }
  const valorAlocado = arredondarMoeda(valorAlocadoBruto);

  const validacaoStatus = normalizarStatusParaCriacao(payload.status);
  if (validacaoStatus.informado && !validacaoStatus.valido) {
    return { success: false, message: "Status inválido." };
  }

  const validacaoTipoRastreio = normalizarTipoRastreioParaCriacao(payload.tipoRastreio ?? payload.tipo_rastreio);
  if (validacaoTipoRastreio.informado && !validacaoTipoRastreio.valido) {
    return { success: false, message: "tipoRastreio inválido." };
  }

  inicializarOrcamento2026();
  const registros = db.prepare("SELECT * FROM orcamento_2026").all();
  const processoPaiIdComparavel = processoPaiId.toUpperCase();
  const processoPai = registros.find((registro) => String(registro.id || "").trim().toUpperCase() === processoPaiIdComparavel);

  if (!processoPai) {
    return { success: false, message: "Processo pai não localizado." };
  }

  if (Number(processoPai.ativo) !== 1) {
    return { success: false, message: "Processo pai está inativo." };
  }

  if (normalizarTexto(processoPai.tipo_processo || "PRINCIPAL") === "VINCULADO") {
    return { success: false, message: "Processo pai já é vinculado. Use um processo principal." };
  }

  const saldoBasicoDisponivel = calcularSaldoBasicoParaVinculo(processoPai, registros);
  if (valorAlocado > saldoBasicoDisponivel) {
    return {
      success: false,
      message: "Valor alocado excede o saldo básico disponível do processo pai."
    };
  }

  const idFilho = gerarIdProcessoVinculado(processoPai.id, registros);
  if (!idFilho) {
    return { success: false, message: "Não foi possível gerar um ID válido para o processo vinculado." };
  }
  if (registros.some((registro) => String(registro.id || "").trim().toUpperCase() === idFilho.toUpperCase())) {
    return { success: false, message: "ID de processo vinculado já existe." };
  }

  const processoSei = obterTextoOpcional(payload, "processoSei", "processo_sei");
  const linkProcessoSei = obterTextoOpcional(payload, "linkProcessoSei", "link_processo_sei");
  const dataProcessoSei = obterTextoOpcional(payload, "dataProcessoSei", "data_processo_sei");
  const observacao = obterTextoOpcional(payload, "observacao");

  const filhosAtivos = registros.filter((registro) => (
    String(registro?.processo_pai_id || "").trim().toUpperCase() === String(processoPai.id || "").trim().toUpperCase()
    && Number(registro?.ativo) === 1
  ));
  const ordemExibicao = filhosAtivos.reduce((maximo, registro) => {
    const ordem = Number(registro?.ordem_exibicao);
    return Number.isFinite(ordem) && ordem > maximo ? ordem : maximo;
  }, 0) + 1;
  const agora = new Date().toISOString();

  const item = preencherColunas({
    id: idFilho,
    categoria: limparTexto(processoPai.categoria),
    descricao,
    acao_orcamentaria: obterTextoOpcional(payload, "acaoOrcamentaria", "acao_orcamentaria") || limparTexto(processoPai.acao_orcamentaria),
    plano_orcamentario: obterTextoOpcional(payload, "planoOrcamentario", "plano_orcamentario") || limparTexto(processoPai.plano_orcamentario),
    natureza: obterTextoOpcional(payload, "natureza") || limparTexto(processoPai.natureza),
    valor_previsto: valorAlocado,
    valor_disponibilizado: 0,
    valor_empenhado: 0,
    valor_executado: 0,
    valor_estimado_pesquisa_preco: 0,
    processo_autuado: processoSei ? 1 : 0,
    processo_sei: processoSei,
    status: validacaoStatus.status,
    observacao,
    compoe_orcamento: 0,
    classificacao_gerencial: normalizarClassificacaoGerencial(processoPai.classificacao_gerencial),
    ativo: 1,
    tipo_rastreio: validacaoTipoRastreio.tipoRastreio,
    processo_pai_id: processoPai.id,
    tipo_processo: "VINCULADO",
    origem_recurso_id: processoPai.id,
    ordem_exibicao: ordemExibicao,
    valor_alocado_origem: valorAlocado,
    link_processo_sei: linkProcessoSei,
    data_processo_sei: dataProcessoSei
  });

  const backupPath = criarBackupBanco(PAGINA);
  const insertNovo = db.prepare(`
    INSERT INTO orcamento_2026 (${COLUNAS_ORCAMENTO.join(", ")}, atualizado_em)
    VALUES (${COLUNAS_ORCAMENTO.map(() => "?").join(", ")}, ?)
  `);

  db.transaction(() => {
    insertNovo.run(...COLUNAS_ORCAMENTO.map((coluna) => item[coluna]), agora);
    // Filhos não compõem o total global; apenas detalham a execução do envelope do processo pai.
    registrarHistorico(db, {
      pagina: PAGINA,
      registro: item.id,
      campo: "processo_vinculado",
      valorAnterior: "",
      valorNovo: `pai=${processoPai.id}; valor=${valorAlocado.toFixed(2)}`
    });
  })();

  return {
    success: true,
    message: "Processo vinculado criado com sucesso.",
    updatedAt: agora,
    backupPath,
    item
  };
}

function valorParaBanco(campo, valor) {
  if (["valor_previsto", "valor_disponibilizado", "valor_empenhado", "valor_executado", "valor_estimado_pesquisa_preco"].includes(campo)) {
    return arredondarMoeda(converterNumero(valor));
  }
  if (campo === "processo_autuado") return valor ? 1 : 0;
  if (campo === "status") return normalizarStatusOrcamento(valor);
  if (campo === "classificacao_gerencial") return normalizarClassificacaoGerencial(valor);
  return String(valor ?? "").trim();
}

function obterValorAtual(row, campo) {
  if (!row) return "";
  return row[campo] === null || row[campo] === undefined ? "" : row[campo];
}

function validarAlteracoes(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  return Object.entries(changes).flatMap(([id, campos]) => {
    if (!id || !campos || typeof campos !== "object" || Array.isArray(campos)) {
      throw new Error("Registro de alteração inválido.");
    }
    return Object.entries(campos).map(([campo, valor]) => {
      if (!CAMPOS_EDITAVEIS.has(campo)) throw new Error(`Campo não permitido: ${campo}`);
      return { id, campo, valor: valorParaBanco(campo, valor) };
    });
  });
}

function validarNovos(novos) {
  if (!Array.isArray(novos)) return [];
  return novos.map((item, index) => {
    const id = limparTexto(item.id) || `OUT-${Date.now()}-${index + 1}`;
    return preencherColunas({
      id,
      categoria: limparTexto(item.categoria) || "Outros processos de interesse da Ouvidoria",
      descricao: limparTexto(item.descricao) || "Novo processo",
      natureza: limparTexto(item.natureza),
      valor_estimado_pesquisa_preco: valorParaBanco("valor_estimado_pesquisa_preco", item.valor_estimado_pesquisa_preco),
      processo_autuado: valorParaBanco("processo_autuado", item.processo_autuado),
      processo_sei: limparTexto(item.processo_sei),
      status: normalizarStatusOrcamento(item.status || "PLANEJADO"),
      observacao: limparTexto(item.observacao),
      classificacao_gerencial: "NAO_APARELHAMENTO",
      compoe_orcamento: 0,
      ativo: 1
    });
  });
}

function salvarOrcamento2026({ password, changes, novos, inativos }) {
  if (!validarSenhaEdicao(password)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  let alteracoes = [];
  let novosItens = [];
  try {
    alteracoes = validarAlteracoes(changes);
    novosItens = validarNovos(novos);
  } catch (error) {
    return { success: false, message: error.message };
  }
  const idsInativos = Array.isArray(inativos) ? inativos.map(String).filter(Boolean) : [];

  if (!alteracoes.length && !novosItens.length && !idsInativos.length) {
    return { success: false, message: "Não há alterações para salvar." };
  }

  inicializarOrcamento2026();
  const backupPath = criarBackupBanco(PAGINA);
  const updatedAt = new Date().toISOString();
  const selectAtual = db.prepare("SELECT * FROM orcamento_2026 WHERE id = ?");
  const insertNovo = db.prepare(`
    INSERT INTO orcamento_2026 (${COLUNAS_ORCAMENTO.join(", ")}, atualizado_em)
    VALUES (${COLUNAS_ORCAMENTO.map(() => "?").join(", ")}, ?)
  `);
  const inativar = db.prepare("UPDATE orcamento_2026 SET ativo = 0, atualizado_em = ? WHERE id = ?");

  db.transaction(() => {
    novosItens.forEach((item) => {
      insertNovo.run(...COLUNAS_ORCAMENTO.map((coluna) => item[coluna]), updatedAt);
      registrarHistorico(db, {
        pagina: PAGINA,
        registro: item.id,
        campo: "registro",
        valorAnterior: "",
        valorNovo: "criado"
      });
    });

    alteracoes.forEach((item) => {
      const atual = selectAtual.get(item.id);
      if (!atual) throw new Error(`Item não localizado: ${item.id}`);
      db.prepare(`UPDATE orcamento_2026 SET ${item.campo} = ?, atualizado_em = ? WHERE id = ?`).run(item.valor, updatedAt, item.id);
      registrarHistorico(db, {
        pagina: PAGINA,
        registro: item.id,
        campo: item.campo,
        valorAnterior: obterValorAtual(atual, item.campo),
        valorNovo: item.valor
      });
    });

    idsInativos.forEach((id) => {
      const atual = selectAtual.get(id);
      if (!atual) return;
      inativar.run(updatedAt, id);
      registrarHistorico(db, {
        pagina: PAGINA,
        registro: id,
        campo: "ativo",
        valorAnterior: atual.ativo,
        valorNovo: 0
      });
    });
  })();

  return {
    success: true,
    message: "Alterações salvas com sucesso.",
    updatedAt,
    backupPath
  };
}

function listarHistoricoOrcamento2026() {
  return db.prepare(`
    SELECT id, pagina, registro, campo, valor_anterior AS valorAnterior,
           valor_novo AS valorNovo, alterado_em AS alteradoEm
    FROM historico_alteracoes
    WHERE pagina = ?
    ORDER BY id DESC
    LIMIT 200
  `).all(PAGINA);
}

function obterMovimentacoesAtivasOrcamento2026() {
  return db.prepare(`
    SELECT * FROM orcamento_2026_movimentacoes WHERE ativo = 1
  `).all();
}

// Saldo transferível considera alocações recebidas, alocações cedidas, execução, empenho e filhos vinculados.
function calcularSaldoTransferivelOrcamento2026(item, registros, movimentacoes) {
  const id = String(item.id || "").trim();
  const alocacoes = Array.isArray(movimentacoes) ? movimentacoes : [];

  const valorRecebido = alocacoes
    .filter((m) => String(m.destino_id || "").trim() === id)
    .reduce((t, m) => t + (Number(m.valor) || 0), 0);

  const valorCedido = alocacoes
    .filter((m) => String(m.origem_id || "").trim() === id)
    .reduce((t, m) => t + (Number(m.valor) || 0), 0);

  const filhosAtivos = (Array.isArray(registros) ? registros : []).filter((r) => (
    String(r?.processo_pai_id || "").trim() === id
    && Number(r?.ativo) === 1
  ));
  const valorDistribuidoParaFilhos = filhosAtivos.reduce((t, r) => t + (Number(r?.valor_previsto) || 0), 0);

  return arredondarMoeda(
    (Number(item.valor_previsto) || 0)
    + valorRecebido
    - valorCedido
    - (Number(item.valor_empenhado) || 0)
    - (Number(item.valor_executado) || 0)
    - valorDistribuidoParaFilhos
  );
}

// Alocações não alteram o valor original dos processos; a movimentação preserva rastreabilidade.
function alocarSaldoOrcamento2026(payload = {}) {
  const senha = payload.password ?? payload.senha;
  if (!validarSenhaEdicao(senha)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  const origemId = limparTexto(payload.origemId ?? payload.origem_id);
  if (!origemId) {
    return { success: false, message: "origemId é obrigatório." };
  }

  const destinoId = limparTexto(payload.destinoId ?? payload.destino_id);
  if (!destinoId) {
    return { success: false, message: "destinoId é obrigatório." };
  }

  if (origemId.toUpperCase() === destinoId.toUpperCase()) {
    return { success: false, message: "Origem e destino não podem ser o mesmo processo." };
  }

  const valorBruto = converterNumeroEstrito(payload.valor);
  if (!Number.isFinite(valorBruto) || valorBruto <= 0) {
    return { success: false, message: "Valor deve ser um número maior que zero." };
  }
  const valor = arredondarMoeda(valorBruto);

  const justificativa = limparTexto(payload.justificativa);
  if (!justificativa) {
    return { success: false, message: "Justificativa é obrigatória para rastreabilidade." };
  }

  inicializarOrcamento2026();
  const registros = db.prepare("SELECT * FROM orcamento_2026").all();

  const origem = registros.find((r) => String(r.id || "").trim().toUpperCase() === origemId.toUpperCase());
  if (!origem) {
    return { success: false, message: "Processo de origem não localizado." };
  }
  if (Number(origem.ativo) !== 1) {
    return { success: false, message: "Processo de origem está inativo." };
  }

  const destino = registros.find((r) => String(r.id || "").trim().toUpperCase() === destinoId.toUpperCase());
  if (!destino) {
    return { success: false, message: "Processo de destino não localizado." };
  }
  if (Number(destino.ativo) !== 1) {
    return { success: false, message: "Processo de destino está inativo." };
  }

  const categoriaOrigem = normalizarTexto(origem.categoria || "");
  const categoriaDestino = normalizarTexto(destino.categoria || "");
  if (categoriaOrigem !== categoriaDestino) {
    return { success: false, message: "Origem e destino pertencem a categorias diferentes. Alocação não permitida." };
  }

  const movimentacoes = obterMovimentacoesAtivasOrcamento2026();
  const saldoTransferivel = calcularSaldoTransferivelOrcamento2026(origem, registros, movimentacoes);
  if (valor > saldoTransferivel) {
    return {
      success: false,
      message: `Valor (${valor.toFixed(2)}) excede o saldo transferível da origem (${saldoTransferivel.toFixed(2)}).`
    };
  }

  const agora = new Date().toISOString();
  const criadoPor = limparTexto(payload.criadoPor ?? payload.criado_por) || "";
  const backupPath = criarBackupBanco(PAGINA);

  const inserir = db.prepare(`
    INSERT INTO orcamento_2026_movimentacoes
      (tipo, origem_id, destino_id, valor, justificativa, criado_em, criado_por, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  let movimentacaoId;
  db.transaction(() => {
    const result = inserir.run("ALOCACAO_SALDO", origem.id, destino.id, valor, justificativa, agora, criadoPor);
    movimentacaoId = result.lastInsertRowid;
    registrarHistorico(db, {
      pagina: PAGINA,
      registro: origem.id,
      campo: "alocacao_saldo",
      valorAnterior: "",
      valorNovo: `origem=${origem.id}; destino=${destino.id}; valor=${valor.toFixed(2)}`
    });
  })();

  return {
    success: true,
    message: "Saldo alocado com sucesso.",
    backupPath,
    movimentacao: {
      id: movimentacaoId,
      tipo: "ALOCACAO_SALDO",
      origemId: origem.id,
      destinoId: destino.id,
      valor,
      justificativa,
      criadoEm: agora
    }
  };
}

function listarMovimentacoesOrcamento2026() {
  return db.prepare(`
    SELECT id, tipo,
           origem_id AS origemId, destino_id AS destinoId,
           valor, justificativa,
           criado_em AS criadoEm, criado_por AS criadoPor, ativo
    FROM orcamento_2026_movimentacoes
    ORDER BY id DESC
    LIMIT 500
  `).all();
}

module.exports = {
  STATUS_ORCAMENTO,
  inicializarOrcamento2026,
  listarOrcamento2026,
  criarProcessoVinculadoOrcamento2026,
  alocarSaldoOrcamento2026,
  listarMovimentacoesOrcamento2026,
  salvarOrcamento2026,
  listarHistoricoOrcamento2026
};
