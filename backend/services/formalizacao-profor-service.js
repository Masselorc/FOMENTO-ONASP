const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const db = require("../db/database");
const { criarBackupBanco } = require("./backup-service");
const { registrarHistorico } = require("./historico-service");
const { validarSenhaEdicao } = require("./auth-service");

const PAGINA = "formalizacao-profor";
const PLANILHA_FORMALIZACAO = path.join(__dirname, "..", "..", "Planilhas", "Planilha_Formalizacao_PROFOR_2026.xlsx");

const UFS_FORMALIZACAO_PROFOR = ["AM", "AP", "BA", "CE", "DF", "ES", "GO", "MG", "PA", "PE", "RN", "RR", "RS", "SE"];
const VALOR_REPASSE_PROFOR = 200000;
const STATUS_PERMITIDOS = ["PENDENTE", "EM ANDAMENTO", "CONCLUÍDO", "COM PENDÊNCIA", "NÃO SE APLICA", "VALIDAR"];
const ETAPAS_FORMALIZACAO = [
  { key: "propostaCadastrada", label: "Proposta cadastrada" },
  { key: "planoTrabalho", label: "Plano de trabalho" },
  { key: "analiseOnasp", label: "Análise ONASP" },
  { key: "ajustesSolicitados", label: "Ajustes solicitados" },
  { key: "ajustesAtendidos", label: "Ajustes atendidos" },
  { key: "analiseOperacional", label: "Análise operacional" },
  { key: "declaracaoOrcamentaria", label: "Declaração orçamentária" },
  { key: "minutaTermo", label: "Minuta/termo" },
  { key: "celebracao", label: "Celebração" },
  { key: "publicacao", label: "Publicação" }
];

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizarStatusFormalizacao(status) {
  const texto = normalizarTexto(status).replace(/\s+/g, " ");
  const mapa = {
    PENDENTE: "PENDENTE",
    "EM ANDAMENTO": "EM ANDAMENTO",
    CONCLUIDO: "CONCLUÍDO",
    "COM PENDENCIA": "COM PENDÊNCIA",
    "NAO SE APLICA": "NÃO SE APLICA",
    VALIDAR: "VALIDAR"
  };

  return mapa[texto] || "PENDENTE";
}

function obterLinhasPlanilha(caminho, nomeAba) {
  if (!fs.existsSync(caminho)) return [];
  const workbook = XLSX.readFile(caminho, { cellDates: false });
  const sheet = workbook.Sheets[nomeAba];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false
  });
}

function obterIndice(headers, nomes) {
  const normalizados = nomes.map(normalizarTexto);
  return headers.findIndex((header) => normalizados.includes(normalizarTexto(header)));
}

function textoCelula(linha, indice, fallback = "") {
  if (indice < 0 || linha[indice] === null || linha[indice] === undefined) return fallback;
  const texto = String(linha[indice]).replace(/\s+/g, " ").trim();
  return texto || fallback;
}

function statusInicialPorEtapa(statusGeral) {
  const status = normalizarTexto(statusGeral);
  const projetoAprovado = status.includes("PROJETO APROVADO") || status.includes("FORMALIZACAO") || status.includes("CELEBR");
  const emAnalise = status.includes("ANALISE") || status.includes("COMPLEMENTACAO") || status.includes("ELABORACAO");
  const publicado = status.includes("PUBLIC");
  const celebrado = status.includes("CELEBR");

  return {
    propostaCadastrada: status.includes("NAO INICIADA") ? "PENDENTE" : "CONCLUÍDO",
    planoTrabalho: projetoAprovado ? "CONCLUÍDO" : emAnalise ? "EM ANDAMENTO" : "PENDENTE",
    analiseOnasp: projetoAprovado ? "CONCLUÍDO" : emAnalise ? "EM ANDAMENTO" : "PENDENTE",
    ajustesSolicitados: status.includes("COMPLEMENTACAO") ? "COM PENDÊNCIA" : "NÃO SE APLICA",
    ajustesAtendidos: status.includes("COMPLEMENTACAO") ? "PENDENTE" : "NÃO SE APLICA",
    analiseOperacional: status.includes("FORMALIZACAO") ? "EM ANDAMENTO" : projetoAprovado ? "CONCLUÍDO" : "PENDENTE",
    declaracaoOrcamentaria: status.includes("FORMALIZACAO") ? "EM ANDAMENTO" : "PENDENTE",
    minutaTermo: celebrado || publicado ? "CONCLUÍDO" : "PENDENTE",
    celebracao: celebrado || publicado ? "CONCLUÍDO" : "PENDENTE",
    publicacao: publicado ? "CONCLUÍDO" : "PENDENTE"
  };
}

function obterRegistrosIniciaisDaPlanilha() {
  const linhas = obterLinhasPlanilha(PLANILHA_FORMALIZACAO, "Painel_Propostas");
  if (!linhas.length) return [];

  const headers = linhas[0] || [];
  const colUf = obterIndice(headers, ["UF"]);
  const colStatus = obterIndice(headers, ["Status Geral", "Situação Geral"]);
  const colObservacao = obterIndice(headers, ["Observações", "Observação"]);
  const registros = [];

  linhas.slice(1).forEach((linha) => {
    const uf = normalizarTexto(textoCelula(linha, colUf));
    if (!UFS_FORMALIZACAO_PROFOR.includes(uf)) return;

    const statusGeral = textoCelula(linha, colStatus, "Pendente");
    const observacao = textoCelula(linha, colObservacao);
    const porEtapa = statusInicialPorEtapa(statusGeral);

    ETAPAS_FORMALIZACAO.forEach((etapa) => {
      registros.push({
        uf,
        etapa: etapa.key,
        status: porEtapa[etapa.key] || "PENDENTE",
        observacao
      });
    });
  });

  return registros;
}

function inicializarFormalizacaoProfor() {
  const total = db.prepare("SELECT COUNT(*) AS total FROM formalizacao_profor").get().total;
  if (total > 0) return;

  const registros = obterRegistrosIniciaisDaPlanilha();
  const base = registros.length
    ? registros
    : UFS_FORMALIZACAO_PROFOR.flatMap((uf) => (
      ETAPAS_FORMALIZACAO.map((etapa) => ({
        uf,
        etapa: etapa.key,
        status: "PENDENTE",
        observacao: ""
      }))
    ));

  const insert = db.prepare(`
    INSERT OR IGNORE INTO formalizacao_profor (uf, etapa, status, observacao, atualizado_em)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updatedAt = new Date().toISOString();
  db.transaction((items) => {
    items.forEach((item) => {
      insert.run(item.uf, item.etapa, normalizarStatusFormalizacao(item.status), item.observacao || "", updatedAt);
    });
  })(base);
}

function calcularSituacaoGeral(etapas) {
  if (etapas.every((item) => ["CONCLUÍDO", "NÃO SE APLICA"].includes(item.status))) return "Concluído";
  if (etapas.some((item) => item.status === "COM PENDÊNCIA")) return "Com pendência";
  if (etapas.some((item) => item.status === "VALIDAR")) return "Validar";
  if (etapas.some((item) => item.status === "EM ANDAMENTO")) return "Em andamento";
  return "Pendente";
}

function calcularProgresso(etapas) {
  const aplicaveis = etapas.filter((item) => item.status !== "NÃO SE APLICA");
  if (!aplicaveis.length) return 0;
  const concluidas = aplicaveis.filter((item) => item.status === "CONCLUÍDO").length;
  return Math.round((concluidas / aplicaveis.length) * 100);
}

function montarProposta(uf, linhas) {
  const porEtapa = new Map(linhas.map((linha) => [linha.etapa, linha]));
  const etapas = ETAPAS_FORMALIZACAO.map((etapa) => {
    const linha = porEtapa.get(etapa.key) || {};
    return {
      ...etapa,
      status: normalizarStatusFormalizacao(linha.status),
      observacao: linha.observacao || "",
      atualizadoEm: linha.atualizado_em || ""
    };
  });
  const observacoes = Array.from(new Set(etapas.map((item) => item.observacao).filter(Boolean))).join(" | ");
  const progresso = calcularProgresso(etapas);
  const situacaoGeral = calcularSituacaoGeral(etapas);

  return {
    idProposta: `${uf}-2026`,
    uf,
    estado: uf,
    grupo: "PROFOR/ONASP 2026",
    numeroProposta: `${uf}-2026`,
    ano: "2026",
    processoSei: "",
    situacaoGeral,
    ultimaAtualizacao: etapas.map((item) => item.atualizadoEm).filter(Boolean).sort().pop() || "",
    observacoes,
    gestor: { nome: "", cargo: "", orgao: "", email: "", telefone: "" },
    responsavelTecnico: { nome: "", cargo: "", email: "", telefone: "" },
    responsaveisAtivos: [],
    cadastroInstitucional: { uf, estado: uf, orgao: "", sigla: "", cnpj: "", emailGabinete: "", observacoes: "" },
    contatosPessoas: [],
    contatosDisponiveis: false,
    contatosErro: "",
    valorRepasse: VALOR_REPASSE_PROFOR,
    valorContrapartida: 0,
    valorGlobal: VALOR_REPASSE_PROFOR,
    valorGlobalCalculado: VALOR_REPASSE_PROFOR,
    percentualContrapartida: 0,
    documentosProjeto: [],
    documentosFormalizacao: [],
    progressoDocumentosProjeto: { total: 0, enviados: 0, percentual: progresso, completo: progresso === 100 },
    progressoDocumentosFormalizacao: { total: 0, enviados: 0, percentual: progresso, completo: progresso === 100 },
    plano: { total: VALOR_REPASSE_PROFOR, quantidadeItens: 0, diferenca: 0, fechaComValorGlobal: true, itensInelegiveis: [], itens: [], porCategoria: [], porNatureza: [], porFonte: [] },
    condicaoSuspensiva: { exige: false, atoEnviado: false, atoPublicado: false, pendente: false, resolvida: true, situacao: "Não se aplica" },
    falaBr: { previsto: true, forma: "", observacao: "" },
    validacoes: { ufElegivel: true, valorRepasseOk: true, valorGlobalOk: true },
    progressoGeral: progresso,
    alertas: etapas
      .filter((item) => ["COM PENDÊNCIA", "VALIDAR"].includes(item.status))
      .map((item) => ({ tipo: item.status, severidade: item.status === "COM PENDÊNCIA" ? "critico" : "informativo", mensagem: `${item.label}: ${item.status}` })),
    trilha: etapas.map((item) => ({
      chave: item.key,
      rotulo: item.label,
      estado: item.status === "CONCLUÍDO" ? "concluida" : item.status === "NÃO SE APLICA" ? "nao-aplica" : item.status === "PENDENTE" ? "pendente" : "atual",
      status: item.status,
      observacao: item.observacao
    })),
    situacaoPlano: "Plano de trabalho monitorado no SQLite",
    aptaCelebracao: etapas.find((item) => item.key === "celebracao")?.status === "CONCLUÍDO",
    etapasFormalizacao: etapas
  };
}

function montarResumo(propostas) {
  const alertas = propostas.flatMap((proposta) => (
    proposta.alertas.map((alerta) => ({ ...alerta, uf: proposta.uf, estado: proposta.estado, idProposta: proposta.idProposta }))
  ));

  return {
    totalPropostas: propostas.length,
    totalValorGlobal: propostas.reduce((total, proposta) => total + proposta.valorGlobal, 0),
    totalRepasse: propostas.reduce((total, proposta) => total + proposta.valorRepasse, 0),
    totalContrapartida: 0,
    aptasCelebracao: propostas.filter((proposta) => proposta.aptaCelebracao).length,
    planosCompativeis: propostas.length,
    condicoesPendentes: 0,
    falaBrPendentes: 0,
    alertasCriticos: alertas.filter((alerta) => alerta.severidade === "critico").length,
    propostasComAlertaCritico: propostas.filter((proposta) => proposta.alertas.some((alerta) => alerta.severidade === "critico")).length,
    mediaProgressoGeral: propostas.length ? propostas.reduce((total, proposta) => total + proposta.progressoGeral, 0) / propostas.length : 0,
    documentosProjetoCompletos: propostas.filter((proposta) => proposta.progressoDocumentosProjeto.completo).length,
    documentosFormalizacaoCompletos: propostas.filter((proposta) => proposta.progressoDocumentosFormalizacao.completo).length,
    alertas,
    filtros: {
      ufs: [...UFS_FORMALIZACAO_PROFOR],
      grupos: ["PROFOR/ONASP 2026"],
      status: Array.from(new Set(propostas.map((proposta) => proposta.situacaoGeral))).sort()
    }
  };
}

function listarFormalizacaoProfor() {
  inicializarFormalizacaoProfor();
  const linhas = db.prepare(`
    SELECT uf, etapa, status, observacao, atualizado_em
    FROM formalizacao_profor
    ORDER BY uf, etapa
  `).all();
  const porUf = new Map();
  linhas.forEach((linha) => {
    if (!porUf.has(linha.uf)) porUf.set(linha.uf, []);
    porUf.get(linha.uf).push(linha);
  });
  const propostas = UFS_FORMALIZACAO_PROFOR.map((uf) => montarProposta(uf, porUf.get(uf) || []));

  return {
    arquivo: "backend/data/onasp.sqlite",
    disponivel: true,
    aba: "formalizacao_profor",
    ufsAutorizadas: [...UFS_FORMALIZACAO_PROFOR],
    ufsCondicaoSuspensiva: [],
    valorRepassePadrao: VALOR_REPASSE_PROFOR,
    etapas: ETAPAS_FORMALIZACAO,
    statusPermitidos: STATUS_PERMITIDOS,
    propostas,
    registros: linhas,
    diagnostico: {
      ufsEsperadas: [...UFS_FORMALIZACAO_PROFOR],
      ufsEncontradas: propostas.map((proposta) => proposta.uf),
      ufsFaltantes: [],
      ufsExcedentes: [],
      totalRepasseEsperado: UFS_FORMALIZACAO_PROFOR.length * VALOR_REPASSE_PROFOR,
      totalRepasseEncontrado: UFS_FORMALIZACAO_PROFOR.length * VALOR_REPASSE_PROFOR,
      repassesDivergentes: [],
      condicoesSuspensivasPendentes: [],
      condicoesSuspensivasSemChecklist: [],
      documentosObrigatoriosIncompletos: [],
      documentosSemDicionario: [],
      documentosEnviadosSemLink: [],
      severidadeGeral: "success"
    },
    resumo: montarResumo(propostas)
  };
}

function validarPayloadAlteracoes(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("Alteração inválida. Nenhuma alteração foi salva.");
  }

  const etapasPermitidas = new Set(ETAPAS_FORMALIZACAO.map((item) => item.key));
  const atualizacoes = [];
  Object.entries(changes).forEach(([uf, campos]) => {
    const ufNormalizada = normalizarTexto(uf);
    if (!UFS_FORMALIZACAO_PROFOR.includes(ufNormalizada) || !campos || typeof campos !== "object" || Array.isArray(campos)) {
      throw new Error("Registro de alteração inválido.");
    }

    Object.entries(campos).forEach(([etapa, payload]) => {
      if (!etapasPermitidas.has(etapa)) throw new Error(`Etapa não permitida: ${etapa}`);
      const status = normalizarStatusFormalizacao(payload?.status);
      if (!STATUS_PERMITIDOS.includes(status)) throw new Error(`Status inválido para ${etapa}: ${payload?.status}`);
      atualizacoes.push({
        uf: ufNormalizada,
        etapa,
        status,
        observacao: String(payload?.observacao ?? "").trim()
      });
    });
  });

  return atualizacoes;
}

function salvarFormalizacaoProfor({ password, changes }) {
  if (!validarSenhaEdicao(password)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  let atualizacoes;
  try {
    atualizacoes = validarPayloadAlteracoes(changes);
  } catch (error) {
    return { success: false, message: error.message };
  }

  if (!atualizacoes.length) {
    return { success: false, message: "Não há alterações para salvar." };
  }

  inicializarFormalizacaoProfor();
  const backupPath = criarBackupBanco(PAGINA);
  const updatedAt = new Date().toISOString();
  const selectAtual = db.prepare("SELECT status, observacao FROM formalizacao_profor WHERE uf = ? AND etapa = ?");
  const upsert = db.prepare(`
    INSERT INTO formalizacao_profor (uf, etapa, status, observacao, atualizado_em)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(uf, etapa) DO UPDATE SET
      status = excluded.status,
      observacao = excluded.observacao,
      atualizado_em = excluded.atualizado_em
  `);

  db.transaction((items) => {
    items.forEach((item) => {
      const anterior = selectAtual.get(item.uf, item.etapa);
      upsert.run(item.uf, item.etapa, item.status, item.observacao, updatedAt);
      registrarHistorico(db, {
        pagina: PAGINA,
        registro: item.uf,
        campo: item.etapa,
        valorAnterior: anterior ? anterior.status : "",
        valorNovo: item.status
      });
      registrarHistorico(db, {
        pagina: PAGINA,
        registro: item.uf,
        campo: `${item.etapa}.observacao`,
        valorAnterior: anterior ? anterior.observacao || "" : "",
        valorNovo: item.observacao
      });
    });
  })(atualizacoes);

  return {
    success: true,
    message: "Alterações salvas com sucesso.",
    updatedAt,
    backupPath
  };
}

function listarHistoricoFormalizacaoProfor() {
  return db.prepare(`
    SELECT id, pagina, registro, campo, valor_anterior AS valorAnterior,
           valor_novo AS valorNovo, alterado_em AS alteradoEm
    FROM historico_alteracoes
    WHERE pagina = ?
    ORDER BY id DESC
    LIMIT 200
  `).all(PAGINA);
}

module.exports = {
  ETAPAS_FORMALIZACAO,
  STATUS_PERMITIDOS,
  inicializarFormalizacaoProfor,
  listarFormalizacaoProfor,
  salvarFormalizacaoProfor,
  listarHistoricoFormalizacaoProfor
};
