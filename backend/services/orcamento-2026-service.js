const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const db = require("../db/database");
const { criarBackupBanco } = require("./backup-service");
const { registrarHistorico } = require("./historico-service");
const { validarSenhaEdicao } = require("./auth-service");

const PAGINA = "orcamento-2026";
const PLANILHA_ORCAMENTO = path.join(__dirname, "..", "..", "Planilhas", "orcamento_onasp.xlsx");
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
const CAMPOS_EDITAVEIS = new Set([
  "categoria",
  "descricao",
  "acao_orcamentaria",
  "plano_orcamentario",
  "natureza",
  "valor_previsto",
  "valor_disponibilizado",
  "valor_executado",
  "valor_estimado_pesquisa_preco",
  "processo_autuado",
  "processo_sei",
  "status",
  "observacao"
]);

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

function obterLinhas(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false
  });
}

function obterIndice(headers, termos, ignorar = []) {
  const conjuntos = Array.isArray(termos[0]) ? termos : [termos];
  return headers.findIndex((header) => (
    !ignorar.some((termo) => header.includes(normalizarTexto(termo)))
      && conjuntos.some((grupo) => grupo.every((termo) => header.includes(normalizarTexto(termo))))
  ));
}

function textoCelula(linha, indice, fallback = "") {
  if (indice < 0 || linha[indice] === null || linha[indice] === undefined) return fallback;
  return limparTexto(linha[indice]) || fallback;
}

function montarMapaRastreio(sheet) {
  if (!sheet) return new Map();
  const linhas = obterLinhas(sheet);
  if (!linhas.length) return new Map();

  const headers = (linhas[0] || []).map(normalizarTexto);
  const colId = obterIndice(headers, ["ID"]);
  const colStatus = obterIndice(headers, ["STATUS"]);
  const colProcesso = obterIndice(headers, ["PROCESSO", "SEI"], ["DATA", "LINK"]);
  const mapa = new Map();

  linhas.slice(1).forEach((linha) => {
    const id = textoCelula(linha, colId);
    if (!id) return;
    mapa.set(id, {
      status: textoCelula(linha, colStatus),
      processoSei: textoCelula(linha, colProcesso)
    });
  });

  return mapa;
}

function obterRegistrosIniciaisDaPlanilha() {
  if (!fs.existsSync(PLANILHA_ORCAMENTO)) return [];
  const workbook = XLSX.readFile(PLANILHA_ORCAMENTO, { cellDates: false });
  const sheet = workbook.Sheets.Base_Dados;
  if (!sheet) return [];

  const rastreioNormal = montarMapaRastreio(workbook.Sheets.Processos_Normais);
  const rastreioProfor = montarMapaRastreio(workbook.Sheets.Andamento_CONV_PROFOR);
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
  const colValorPrevisto = obterIndice(headers, ["VALOR", "TOTAL"]);
  const colValorExecutado = obterIndice(headers, [["VALOR", "EXECUTADO"], ["EXECUTADO"], ["PAGO"]]);
  const colStatus = obterIndice(headers, ["STATUS"]);

  return linhas.slice(1).map((linha, index) => {
    const id = textoCelula(linha, colId, `ORC-${String(index + 1).padStart(3, "0")}`);
    const descricao = textoCelula(linha, colDescricao);
    const valorPrevisto = arredondarMoeda(converterNumero(linha[colValorPrevisto]));
    if (!descricao || normalizarTexto(descricao).includes("TOTAL") || valorPrevisto <= 0) return null;

    const tipoRastreio = textoCelula(linha, colTipoRastreio);
    const rastreio = normalizarTexto(tipoRastreio).includes("PROFOR")
      ? rastreioProfor.get(id)
      : rastreioNormal.get(id);
    const processoSei = rastreio?.processoSei || "";
    const status = normalizarStatusOrcamento(rastreio?.status || textoCelula(linha, colStatus));

    return {
      id,
      categoria: textoCelula(linha, colFrente, "Não informado"),
      descricao,
      acao_orcamentaria: textoCelula(linha, colModalidade),
      plano_orcamentario: textoCelula(linha, colAbrangencia),
      natureza: textoCelula(linha, colNatureza),
      valor_previsto: valorPrevisto,
      valor_disponibilizado: 0,
      valor_executado: arredondarMoeda(converterNumero(linha[colValorExecutado])),
      valor_estimado_pesquisa_preco: 0,
      processo_autuado: processoSei ? 1 : 0,
      processo_sei: processoSei,
      status,
      observacao: "",
      compoe_orcamento: 1,
      ativo: 1
    };
  }).filter(Boolean);
}

function inicializarOrcamento2026() {
  const total = db.prepare("SELECT COUNT(*) AS total FROM orcamento_2026").get().total;
  if (total > 0) return;

  const registros = obterRegistrosIniciaisDaPlanilha();
  if (!registros.length) return;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO orcamento_2026 (
      id, categoria, descricao, acao_orcamentaria, plano_orcamentario, natureza,
      valor_previsto, valor_disponibilizado, valor_executado, valor_estimado_pesquisa_preco,
      processo_autuado, processo_sei, status, observacao, compoe_orcamento, ativo, atualizado_em
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updatedAt = new Date().toISOString();

  db.transaction((items) => {
    items.forEach((item) => {
      insert.run(
        item.id,
        item.categoria,
        item.descricao,
        item.acao_orcamentaria,
        item.plano_orcamentario,
        item.natureza,
        item.valor_previsto,
        item.valor_disponibilizado,
        item.valor_executado,
        item.valor_estimado_pesquisa_preco,
        item.processo_autuado,
        item.processo_sei,
        item.status,
        item.observacao,
        item.compoe_orcamento,
        item.ativo,
        updatedAt
      );
    });
  })(registros);
}

function linhaParaItem(linha) {
  const valorPrevisto = Number(linha.valor_previsto) || 0;
  const valorEstimadoPesquisaPreco = Number(linha.valor_estimado_pesquisa_preco) || 0;
  const processoAutuado = Number(linha.processo_autuado) === 1;

  return {
    id: linha.id,
    categoria: linha.categoria || "",
    frente: linha.categoria || "",
    descricao: linha.descricao || "",
    acaoOrcamentaria: linha.acao_orcamentaria || "",
    modalidade: linha.acao_orcamentaria || "-",
    planoOrcamentario: linha.plano_orcamentario || "",
    abrangencia: linha.plano_orcamentario || "-",
    natureza: linha.natureza || "",
    quantidade: "",
    unidade: "",
    valorPrevisto,
    valorTotal: valorPrevisto,
    valorUnitario: valorPrevisto,
    valorDisponibilizado: Number(linha.valor_disponibilizado) || 0,
    valorExecutado: Number(linha.valor_executado) || 0,
    valorEstimadoPesquisaPreco,
    processoAutuado,
    processoAutuadoNumero: processoAutuado ? 1 : 0,
    processoSei: linha.processo_sei || "",
    status: linha.status || "PLANEJADO",
    observacao: linha.observacao || "",
    compoeOrcamento: Number(linha.compoe_orcamento) === 1,
    ativo: Number(linha.ativo) === 1,
    valorEmExecucaoConsiderado: Number(linha.compoe_orcamento) === 1 && processoAutuado ? valorEstimadoPesquisaPreco : 0,
    atualizadoEm: linha.atualizado_em || ""
  };
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
  const saldoPlanejado = arredondarMoeda(totalOrcamento - valorEmExecucao);
  const processosAutuados = itensOficiais.filter((item) => item.processoAutuado).length;

  return {
    totalGeral: totalOrcamento,
    totalOrcamento,
    totalItens: itensOficiais.length,
    totalEmpenhado: valorEmExecucao,
    totalEmExecucao: valorEmExecucao,
    valorEmExecucao,
    totalExecutado: arredondarMoeda(itensOficiais.reduce((total, item) => total + item.valorExecutado, 0)),
    saldoPlanejado,
    percentualEmExecucao: totalOrcamento > 0 ? (valorEmExecucao / totalOrcamento) * 100 : 0,
    processosAutuados,
    porStatus: agruparResumo(itensOficiais, "status"),
    porNatureza: agruparResumo(itensOficiais, "natureza"),
    porModalidade: agruparResumo(itensOficiais, "modalidade"),
    porFrente: agruparResumo(itensOficiais, "frente")
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
    arquivo: "backend/data/onasp.sqlite",
    disponivel: true,
    aba: "orcamento_2026",
    itens: itensOficiais,
    itensOficiais,
    outrosProcessos,
    statusPermitidos: STATUS_ORCAMENTO,
    resumo: montarResumo(itensOficiais),
    filtros: {
      frentes: valoresUnicos(itensOficiais, "frente"),
      status: valoresUnicos(itensOficiais, "status"),
      naturezas: valoresUnicos(itensOficiais, "natureza"),
      modalidades: valoresUnicos(itensOficiais, "modalidade")
    }
  };
}

function valorParaBanco(campo, valor) {
  if (["valor_previsto", "valor_disponibilizado", "valor_executado", "valor_estimado_pesquisa_preco"].includes(campo)) {
    return arredondarMoeda(converterNumero(valor));
  }
  if (campo === "processo_autuado") return valor ? 1 : 0;
  if (campo === "status") return normalizarStatusOrcamento(valor);
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
    return {
      id,
      categoria: limparTexto(item.categoria) || "Outros processos de interesse da Ouvidoria",
      descricao: limparTexto(item.descricao) || "Novo processo",
      acao_orcamentaria: "",
      plano_orcamentario: "",
      natureza: limparTexto(item.natureza),
      valor_previsto: 0,
      valor_disponibilizado: 0,
      valor_executado: 0,
      valor_estimado_pesquisa_preco: valorParaBanco("valor_estimado_pesquisa_preco", item.valor_estimado_pesquisa_preco),
      processo_autuado: valorParaBanco("processo_autuado", item.processo_autuado),
      processo_sei: limparTexto(item.processo_sei),
      status: normalizarStatusOrcamento(item.status || "PLANEJADO"),
      observacao: limparTexto(item.observacao),
      compoe_orcamento: 0,
      ativo: 1
    };
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
    INSERT INTO orcamento_2026 (
      id, categoria, descricao, acao_orcamentaria, plano_orcamentario, natureza,
      valor_previsto, valor_disponibilizado, valor_executado, valor_estimado_pesquisa_preco,
      processo_autuado, processo_sei, status, observacao, compoe_orcamento, ativo, atualizado_em
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inativar = db.prepare("UPDATE orcamento_2026 SET ativo = 0, atualizado_em = ? WHERE id = ?");

  db.transaction(() => {
    novosItens.forEach((item) => {
      insertNovo.run(
        item.id,
        item.categoria,
        item.descricao,
        item.acao_orcamentaria,
        item.plano_orcamentario,
        item.natureza,
        item.valor_previsto,
        item.valor_disponibilizado,
        item.valor_executado,
        item.valor_estimado_pesquisa_preco,
        item.processo_autuado,
        item.processo_sei,
        item.status,
        item.observacao,
        item.compoe_orcamento,
        item.ativo,
        updatedAt
      );
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

module.exports = {
  STATUS_ORCAMENTO,
  inicializarOrcamento2026,
  listarOrcamento2026,
  salvarOrcamento2026,
  listarHistoricoOrcamento2026
};
