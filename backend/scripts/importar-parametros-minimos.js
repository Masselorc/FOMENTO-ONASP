const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const db = require("../db/database");
const { inicializarBanco } = require("../db/init-db");
const {
  PARAMETROS_MINIMOS,
  normalizarStatusParametroMinimo
} = require("../services/parametros-minimos-config");

const caminhoPlanilha = path.join(__dirname, "..", "..", "Planilhas", "Parametros_Minimos.xlsx");
const caminhoDiagnostico = path.join(__dirname, "..", "..", "Planilhas", "Diagnostico.xlsx");

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

function normalizarCabecalho(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizarUf(valor) {
  const match = normalizarCabecalho(valor).match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  return match ? match[1] : "";
}

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function converterNumero(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function obterTextoPorAliases(linha, tabela, aliases) {
  const lista = Array.isArray(aliases) ? aliases : [aliases];
  for (const alias of lista) {
    const indice = tabela.indice(alias);
    const texto = indice >= 0 ? limparTexto(linha[indice]) : "";
    if (texto) return texto;
  }

  return "";
}

function converterDataParaTimestamp(valor) {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "number") {
    return Math.round((valor - 25569) * 86400 * 1000);
  }

  const data = Date.parse(String(valor || ""));
  return Number.isFinite(data) ? data : 0;
}

function montarTabelaDiagnostico(workbook) {
  const perguntasQuantitativas = PARAMETROS_MINIMOS
    .filter((parametro) => parametro.tipo === "quantitativo")
    .flatMap((parametro) => [...(parametro.atual || []), ...(parametro.ideal || [])])
    .map(normalizarCabecalho);

  for (const nomeAba of workbook.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], { header: 1, defval: "", raw: true });
    const headerRowIndex = linhas.findIndex((linha) => {
      const cabecalhos = linha.map(normalizarCabecalho);
      const possuiUf = cabecalhos.some((cabecalho) => ["UF", "UNIDADE FEDERATIVA", "ESTADO"].includes(cabecalho) || cabecalho.includes("UNIDADE DA FEDERACAO"));
      const possuiPergunta = cabecalhos.some((cabecalho) => perguntasQuantitativas.some((pergunta) => cabecalho.includes(pergunta)));
      return possuiUf || possuiPergunta;
    });

    if (headerRowIndex < 0) continue;

    const headersOriginais = linhas[headerRowIndex] || [];
    const headers = headersOriginais.map(normalizarCabecalho);
    const indice = (aliases) => {
      const lista = Array.isArray(aliases) ? aliases : [aliases];
      const normalizados = lista.map(normalizarCabecalho);
      let encontrado = headers.findIndex((header) => normalizados.includes(header));
      if (encontrado < 0) {
        encontrado = headers.findIndex((header) => normalizados.some((alias) => header.includes(alias)));
      }
      return encontrado;
    };

    return {
      linhas: linhas.slice(headerRowIndex + 1),
      indice
    };
  }

  return null;
}

function montarRespostaOriginalDiagnostico(linha, tabela, parametro) {
  const perguntas = parametro.tipo === "quantitativo"
    ? [...(parametro.atual || []), ...(parametro.ideal || [])]
    : parametro.perguntas || [];

  return perguntas
    .map((pergunta) => {
      const texto = obterTextoPorAliases(linha, tabela, pergunta);
      return texto ? `${pergunta}: ${texto}` : null;
    })
    .filter(Boolean)
    .join(" | ");
}

function carregarContextoDiagnosticoParametros() {
  if (!fs.existsSync(caminhoDiagnostico)) return new Map();

  const workbook = XLSX.readFile(caminhoDiagnostico, { raw: true, cellDates: true });
  const tabela = montarTabelaDiagnostico(workbook);
  if (!tabela) return new Map();

  const respostasPorUf = new Map();
  tabela.linhas.forEach((linha, index) => {
    const colUf = tabela.indice(["UF", "Unidade Federativa", "Estado", "Sigla UF"]);
    const uf = normalizarUf(colUf >= 0 ? linha[colUf] : "");
    if (!uf || !UFS.has(uf)) return;

    const colData = tabela.indice([
      "Data/Hora de Conclusão",
      "Data de Conclusão",
      "Data/Hora da resposta",
      "Carimbo de data/hora",
      "Timestamp",
      "Hora de conclusão"
    ]);
    const timestamp = colData >= 0 ? converterDataParaTimestamp(linha[colData]) : 0;
    const resposta = { uf, linha, linhaOrigem: index + 1, timestamp };

    if (!respostasPorUf.has(uf)) respostasPorUf.set(uf, []);
    respostasPorUf.get(uf).push(resposta);
  });

  const selecionadas = [];
  respostasPorUf.forEach((respostas, uf) => {
    if (uf === "ES") {
      respostas.forEach((resposta, index) => selecionadas.push([`ES_${index + 1}`, resposta]));
      return;
    }

    const maisRecente = respostas.sort((a, b) => b.timestamp - a.timestamp || b.linhaOrigem - a.linhaOrigem)[0];
    selecionadas.push([uf, maisRecente]);
  });

  const contextoPorUf = new Map();
  selecionadas.forEach(([codigo, resposta]) => {
    const porParametro = {};
    PARAMETROS_MINIMOS.forEach((parametro) => {
      const colAtual = tabela.indice(parametro.atual || []);
      const colIdeal = tabela.indice(parametro.ideal || []);
      porParametro[parametro.key] = {
        atual: colAtual >= 0 ? converterNumero(resposta.linha[colAtual]) : null,
        ideal: colIdeal >= 0 ? converterNumero(resposta.linha[colIdeal]) : null,
        respostaOriginal: montarRespostaOriginalDiagnostico(resposta.linha, tabela, parametro)
      };
    });
    contextoPorUf.set(codigo, porParametro);
    if (codigo === "ES_1") contextoPorUf.set("ES", porParametro);
    if (!codigo.includes("_")) contextoPorUf.set(resposta.uf, porParametro);
  });

  return contextoPorUf;
}

function atualizarRespostasOriginaisParametrosMinimos() {
  inicializarBanco();

  const contextoDiagnostico = carregarContextoDiagnosticoParametros();
  if (contextoDiagnostico.size === 0) {
    return { atualizados: 0, disponivel: false };
  }

  const update = db.prepare(`
    UPDATE parametros_minimos
    SET resposta_original = ?
    WHERE uf = ? AND parametro = ?
  `);

  let atualizados = 0;
  const transaction = db.transaction(() => {
    contextoDiagnostico.forEach((porParametro, uf) => {
      PARAMETROS_MINIMOS.forEach((parametro) => {
        const respostaOriginal = limparTexto(porParametro[parametro.key]?.respostaOriginal);
        if (!respostaOriginal) return;
        const resultado = update.run(respostaOriginal, uf, parametro.key);
        atualizados += resultado.changes;
      });
    });
  });

  transaction();

  return { atualizados, disponivel: true };
}

function importarParametrosMinimos() {
  inicializarBanco();

  const workbook = XLSX.readFile(caminhoPlanilha, { raw: true });
  const sheet = workbook.Sheets.VALIDACAO;
  const contextoDiagnostico = carregarContextoDiagnosticoParametros();

  if (!sheet) {
    throw new Error("A planilha Planilhas/Parametros_Minimos.xlsx precisa conter a aba VALIDACAO.");
  }

  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const upsert = db.prepare(`
    INSERT INTO parametros_minimos (uf, parametro, status, quantidade_atual, quantidade_ideal, resposta_original, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uf, parametro) DO UPDATE SET
      status = excluded.status,
      quantidade_atual = excluded.quantidade_atual,
      quantidade_ideal = excluded.quantidade_ideal,
      resposta_original = COALESCE(NULLIF(excluded.resposta_original, ''), parametros_minimos.resposta_original),
      atualizado_em = excluded.atualizado_em
  `);
  const importadoEm = new Date().toISOString();
  const transaction = db.transaction((rows) => {
    rows.forEach((linha) => {
      const uf = String(linha.UF || "").trim();
      if (!uf) return;

      PARAMETROS_MINIMOS.forEach((parametro) => {
        const status = normalizarStatusParametroMinimo(linha[parametro.label]);
        const contexto = contextoDiagnostico.get(uf)?.[parametro.key] || {};
        upsert.run(
          uf,
          parametro.key,
          status,
          contexto.atual ?? null,
          contexto.ideal ?? null,
          contexto.respostaOriginal || "",
          importadoEm
        );
      });
    });
  });

  transaction(linhas);

  return {
    registros: linhas.filter((linha) => String(linha.UF || "").trim()).length,
    parametros: PARAMETROS_MINIMOS.length
  };
}

if (require.main === module) {
  // Este script importa a planilha de parametros minimos para o SQLite legado
  // (backend/data/onasp.sqlite). Apos a migracao para Postgres, a escrita aqui
  // nao reflete o Postgres/Supabase. Bloqueado por seguranca: exige confirmacao
  // explicita ate a migracao definitiva da importacao para Postgres.
  if (process.env.CONFIRMAR_IMPORTACAO_PARAMETROS_MINIMOS !== "SIM") {
    console.error(
      "Importacao de parametros minimos bloqueada: escreve no SQLite legado, " +
      "ja migrado para Postgres. Defina CONFIRMAR_IMPORTACAO_PARAMETROS_MINIMOS=SIM " +
      "apenas se realmente quiser popular o SQLite local. Migracao para Postgres pendente."
    );
    process.exit(1);
  }
  const resultado = importarParametrosMinimos();
  console.log(`Parâmetros mínimos importados: ${resultado.registros} registro(s), ${resultado.parametros} parâmetro(s).`);
}

module.exports = {
  importarParametrosMinimos,
  atualizarRespostasOriginaisParametrosMinimos
};
