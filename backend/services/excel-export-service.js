const XLSX = require("xlsx");
const { PARAMETROS_MINIMOS, statusParaTela, normalizarStatusParametroMinimo } = require("./parametros-minimos-config");
const { listarParametrosMinimos } = require("./parametros-minimos-service");
const { ETAPAS_FORMALIZACAO, listarFormalizacaoProfor } = require("./formalizacao-profor-service");
const { listarOrcamento2026 } = require("./orcamento-2026-service");

function statusParaExcel(statusTela) {
  const status = normalizarStatusParametroMinimo(statusTela);
  if (status.startsWith("FALTA +")) return status;

  const mapa = {
    "TEM": "TEM",
    "NÃO TEM": "NÃO TEM",
    "PARCIAL": "PARCIAL",
    "VALIDAR": "VALIDAR",
    "NÃO INFORMADO": "NÃO INFORMADO",
    "DÉFICIT": "DÉFICIT"
  };

  return mapa[status] || "NÃO INFORMADO";
}

function exportarParametrosMinimosExcel() {
  const dados = listarParametrosMinimos();
  const linhas = dados.respostas.map((resposta) => {
    const linha = { UF: resposta.uf };

    PARAMETROS_MINIMOS.forEach((config) => {
      const item = resposta.parametrosMinimos.find((parametro) => parametro.idParametro === config.key);
      linha[config.label] = statusParaExcel(item?.respostaOriginal || item?.statusNormalizado || statusParaTela("NÃO INFORMADO"));
    });

    return linha;
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(linhas, {
    header: ["UF", ...PARAMETROS_MINIMOS.map((item) => item.label)]
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "VALIDACAO");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function exportarFormalizacaoProforExcel() {
  const dados = listarFormalizacaoProfor();
  const linhas = dados.propostas.map((proposta) => {
    const linha = { UF: proposta.uf };

    ETAPAS_FORMALIZACAO.forEach((etapa) => {
      const item = proposta.etapasFormalizacao.find((registro) => registro.key === etapa.key);
      linha[etapa.label] = item?.status || "PENDENTE";
    });
    linha["Observação"] = proposta.observacoes || "";

    return linha;
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(linhas, {
    header: ["UF", ...ETAPAS_FORMALIZACAO.map((item) => item.label), "Observação"]
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "FORMALIZACAO");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function exportarOrcamento2026Excel() {
  const dados = listarOrcamento2026();
  const workbook = XLSX.utils.book_new();
  const linhasOrcamento = dados.itensOficiais.map((item) => ({
    ID: item.id,
    Categoria: item.categoria,
    "Descrição": item.descricao,
    "Ação orçamentária": item.acaoOrcamentaria,
    "Plano orçamentário": item.planoOrcamentario,
    Natureza: item.natureza,
    "Valor previsto": item.valorPrevisto,
    "Valor disponibilizado": item.valorDisponibilizado,
    "Valor estimado pesquisa de preço": item.valorEstimadoPesquisaPreco,
    "Valor empenhado": item.valorEmpenhado,
    "Valor executado": item.valorExecutado,
    "Processo autuado": item.processoAutuado ? "Sim" : "Não",
    "Processo SEI": item.processoSei,
    "Link Processo SEI": item.linkProcessoSei,
    "Data Processo SEI": item.dataProcessoSei,
    "Valor em execução considerado": item.valorEstimadoPesquisaPreco,
    "Classificação gerencial": item.classificacaoGerencial === "APARELHAMENTO" ? "Aparelhamento" : "Não aparelhamento",
    "É aparelhamento": item.ehAparelhamento ? "Sim" : "Não",
    "Saldo de aparelhamento": item.saldoAparelhamento || 0,
    "DFD/Demanda": item.demandaFormalizada,
    "ETP/Especificação": item.estudoTecnico,
    "Termo de Referência": item.termoReferencia,
    "Pesquisa de Preços": item.pesquisaPrecos,
    "Parecer Jurídico": item.parecerJuridico,
    Status: item.status,
    "Observação": item.observacao
  }));
  const linhasOutros = dados.outrosProcessos.map((item) => ({
    ID: item.id,
    Categoria: item.categoria,
    "Descrição": item.descricao,
    "Processo SEI": item.processoSei,
    "Valor estimado pesquisa de preço": item.valorEstimadoPesquisaPreco,
    "Valor empenhado": item.valorEmpenhado,
    "Valor executado": item.valorExecutado,
    "Processo autuado": item.processoAutuado ? "Sim" : "Não",
    "Classificação gerencial": "Não aparelhamento",
    "É aparelhamento": "Não",
    "Saldo de aparelhamento": 0,
    Status: item.status,
    "Observação": item.observacao
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhasOrcamento), "ORCAMENTO_2026");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhasOutros), "OUTROS_PROCESSOS");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  exportarParametrosMinimosExcel,
  exportarFormalizacaoProforExcel,
  exportarOrcamento2026Excel
};
