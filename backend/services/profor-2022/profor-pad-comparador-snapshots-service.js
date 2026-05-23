const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

const {
  ehSaldoResidualProfor,
  normalizarAreaSaldoResidual,
  normalizarNaturezaSaldoResidual,
  criarChaveSaldoResidual,
} = require("./profor-saldo-residual-service");

const TOLERANCIA_MOEDA = 0.01;
const TOLERANCIA_QUANTIDADE = 0.000001;

/**
 * Calcula o checksum SHA-256 do plano de aplicação canônico.
 */
function calcularChecksumSnapshot(linhas) {
  const jsonStr = JSON.stringify(linhas);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

/**
 * Cria a chave única e estável para a linha do plano.
 */
function criarChaveLinha(linha) {
  const num = String(linha.numero || "").trim().toUpperCase();
  const desc = String(linha.descricao || "").trim().toUpperCase();
  const area = String(linha.area || "").trim().toUpperCase();
  const nat = String(linha.natureza || "").trim().toUpperCase();
  return [num, desc, area, nat].join("::");
}

/**
 * Consolida as linhas de saldo residual do plano (agrupando por convênio e natureza).
 */
function consolidarLinhasSaldoResidual(linhas) {
  const resultado = [];
  const mapa = new Map();

  for (const linha of linhas) {
    if (!ehSaldoResidualProfor(linha.descricao)) {
      resultado.push(linha);
      continue;
    }
    const chave = criarChaveSaldoResidual({
      numeroConvenio: linha.numero ?? linha.numeroConvenio,
      descricao: linha.descricao,
      natureza: linha.natureza,
    });
    if (!chave) {
      resultado.push({
        ...linha,
        area: normalizarAreaSaldoResidual(linha.area),
        natureza: normalizarNaturezaSaldoResidual(linha.natureza),
      });
      continue;
    }
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        ...linha,
        area: "NAO INFORMADO",
        natureza: normalizarNaturezaSaldoResidual(linha.natureza),
        quantidade: 0,
        valorPrevisto: 0,
        valorExecutado: 0,
        saldo: 0,
      });
      resultado.push(mapa.get(chave));
    }
    const agregado = mapa.get(chave);
    agregado.quantidade += Number(linha.quantidade) || 0;
    agregado.valorPrevisto = arredondarMoedaProfor(agregado.valorPrevisto + (Number(linha.valorPrevisto) || 0));
    agregado.valorExecutado = arredondarMoedaProfor(agregado.valorExecutado + (Number(linha.valorExecutado) || 0));
    agregado.saldo = arredondarMoedaProfor(agregado.valorPrevisto - agregado.valorExecutado);
    agregado.valorUnitario = agregado.quantidade > 0
      ? Math.round((agregado.valorPrevisto / agregado.quantidade + Number.EPSILON) * 1e6) / 1e6
      : 0;
    agregado.percentualExecucao = agregado.valorPrevisto > 0
      ? Math.round((agregado.valorExecutado / agregado.valorPrevisto) * 10000) / 100
      : 0;
  }

  return resultado;
}

/**
 * Lê uma fotografia canônica de um caminho do disco ou retorna o objeto se já for um.
 */
function obterSnapshot(origem) {
  if (typeof origem === "string") {
    if (!fs.existsSync(origem)) {
      throw new Error(`Arquivo de snapshot não encontrado: ${origem}`);
    }
    const conteudo = fs.readFileSync(origem, "utf8");
    return JSON.parse(conteudo);
  }
  if (origem && typeof origem === "object") {
    return origem;
  }
  throw new Error("Origem de snapshot inválida (deve ser caminho de arquivo ou objeto).");
}

/**
 * Compara duas fotografias canônicas do PAD (anterior e nova).
 *
 * @param {string|Object} anterior Snapshot anterior (caminho ou objeto).
 * @param {string|Object} novo Snapshot novo (caminho ou objeto).
 * @returns {Object} Resultado detalhado da comparação.
 */
function compararSnapshotsPad(anterior, novo) {
  const snapAnterior = obterSnapshot(anterior);
  const snapNovo = obterSnapshot(novo);

  if (!Array.isArray(snapAnterior.planoAplicacao) || !Array.isArray(snapNovo.planoAplicacao)) {
    throw new Error("Estrutura de fotografia canônica inválida: 'planoAplicacao' ausente ou malformado.");
  }

  // Validação dos checksums
  const checksumCalculadoAnterior = calcularChecksumSnapshot(snapAnterior.planoAplicacao);
  const checksumCalculadoNovo = calcularChecksumSnapshot(snapNovo.planoAplicacao);

  const checksumsValidos =
    checksumCalculadoAnterior === snapAnterior.checksum &&
    checksumCalculadoNovo === snapNovo.checksum;

  // Consolidação de saldos residuais antes de indexar e comparar
  const planoAnteriorConsolidado = consolidarLinhasSaldoResidual(snapAnterior.planoAplicacao);
  const planoNovoConsolidado = consolidarLinhasSaldoResidual(snapNovo.planoAplicacao);

  // Indexar planos
  const indiceAnterior = new Map();
  for (const linha of planoAnteriorConsolidado) {
    const chave = criarChaveLinha(linha);
    indiceAnterior.set(chave, linha);
  }

  const indiceNovo = new Map();
  for (const linha of planoNovoConsolidado) {
    const chave = criarChaveLinha(linha);
    indiceNovo.set(chave, linha);
  }

  const chavesAnterior = new Set(indiceAnterior.keys());
  const chavesNovo = new Set(indiceNovo.keys());
  const todasChaves = new Set([...chavesAnterior, ...chavesNovo]);

  const itensIguais = [];
  const itensNovos = [];
  const itensAusentes = [];
  const itensAlterados = [];

  for (const chave of todasChaves) {
    const linhaAnterior = indiceAnterior.get(chave) || null;
    const linhaNova = indiceNovo.get(chave) || null;

    if (linhaAnterior && !linhaNova) {
      itensAusentes.push(linhaAnterior);
      continue;
    }

    if (!linhaAnterior && linhaNova) {
      itensNovos.push(linhaNova);
      continue;
    }

    // Item em ambos: verificar se há divergências
    const difs = {};
    let alterado = false;

    // Comparar quantidade
    const diffQty = (linhaNova.quantidade || 0) - (linhaAnterior.quantidade || 0);
    if (Math.abs(diffQty) > TOLERANCIA_QUANTIDADE) {
      difs.quantidade = {
        anterior: linhaAnterior.quantidade,
        novo: linhaNova.quantidade,
        delta: Math.round(diffQty * 1e6) / 1e6,
      };
      alterado = true;
    }

    // Comparar valorPrevisto
    const diffPrevisto = (linhaNova.valorPrevisto || 0) - (linhaAnterior.valorPrevisto || 0);
    if (Math.abs(diffPrevisto) > TOLERANCIA_MOEDA) {
      difs.valorPrevisto = {
        anterior: linhaAnterior.valorPrevisto,
        novo: linhaNova.valorPrevisto,
        delta: arredondarMoedaProfor(diffPrevisto),
      };
      alterado = true;
    }

    // Comparar valorExecutado
    const diffExecutado = (linhaNova.valorExecutado || 0) - (linhaAnterior.valorExecutado || 0);
    if (Math.abs(diffExecutado) > TOLERANCIA_MOEDA) {
      difs.valorExecutado = {
        anterior: linhaAnterior.valorExecutado,
        novo: linhaNova.valorExecutado,
        delta: arredondarMoedaProfor(diffExecutado),
      };
      alterado = true;
    }

    // Comparar saldo
    const diffSaldo = (linhaNova.saldo || 0) - (linhaAnterior.saldo || 0);
    if (Math.abs(diffSaldo) > TOLERANCIA_MOEDA) {
      difs.saldo = {
        anterior: linhaAnterior.saldo,
        novo: linhaNova.saldo,
        delta: arredondarMoedaProfor(diffSaldo),
      };
      alterado = true;
    }

    if (alterado) {
      itensAlterados.push({
        chave,
        uf: linhaNova.uf,
        numero: linhaNova.numero,
        area: linhaNova.area,
        natureza: linhaNova.natureza,
        descricao: linhaNova.descricao,
        valores: difs,
      });
    } else {
      itensIguais.push(linhaNova);
    }
  }

  // Agregações financeiras globais (Novo - Anterior)
  const totalPrevistoAnterior = snapAnterior.resumo.valorPrevistoTotal;
  const totalPrevistoNovo = snapNovo.resumo.valorPrevistoTotal;
  const totalExecutadoAnterior = snapAnterior.resumo.valorExecutadoTotal;
  const totalExecutadoNovo = snapNovo.resumo.valorExecutadoTotal;
  const totalSaldoAnterior = snapAnterior.resumo.saldoTotal;
  const totalSaldoNovo = snapNovo.resumo.saldoTotal;
  const totalQuantidadeAnterior = snapAnterior.resumo.quantidadeTotal;
  const totalQuantidadeNovo = snapNovo.resumo.quantidadeTotal;

  const diferencasAgregadas = {
    valorPrevisto: arredondarMoedaProfor(totalPrevistoNovo - totalPrevistoAnterior),
    valorExecutado: arredondarMoedaProfor(totalExecutadoNovo - totalExecutadoAnterior),
    saldo: arredondarMoedaProfor(totalSaldoNovo - totalSaldoAnterior),
    quantidade: Math.round((totalQuantidadeNovo - totalQuantidadeAnterior) * 1e6) / 1e6,
    linhas: snapNovo.resumo.totalLinhas - snapAnterior.resumo.totalLinhas,
  };

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    checksumAnterior: snapAnterior.checksum,
    checksumNovo: snapNovo.checksum,
    checksumsValidos,
    checksumCalculadoAnterior,
    checksumCalculadoNovo,
    resumo: {
      totalLinhasAnterior: snapAnterior.resumo.totalLinhas,
      totalLinhasNovo: snapNovo.resumo.totalLinhas,
      totalIguais: itensIguais.length,
      totalNovos: itensNovos.length,
      totalAusentes: itensAusentes.length,
      totalAlterados: itensAlterados.length,
    },
    diferencasAgregadas,
    itensNovos,
    itensAusentes,
    itensAlterados,
  };
}

/**
 * Formata um valor de moeda para o padrão brasileiro de visualização.
 */
function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Monta um relatório Markdown legível a partir do resultado da comparação.
 */
function montarMarkdownComparacaoSnapshots(resultado) {
  const { resumo, diferencasAgregadas } = resultado;
  const linhas = [];

  linhas.push("# PROFOR 2022 — Comparação de Snapshots PAD (dry-run)");
  linhas.push("");
  linhas.push(`*Gerado em: ${new Date(resultado.geradoEm).toLocaleString("pt-BR")}*`);
  linhas.push(`*Checksum Anterior: \`${resultado.checksumAnterior}\`*`);
  linhas.push(`*Checksum Novo: \`${resultado.checksumNovo}\`*`);
  linhas.push(`*Checksums íntegros no disco: ${resultado.checksumsValidos ? "SIM" : "NÃO"}*`);
  linhas.push("");
  linhas.push("## 1. Resumo da Comparação");
  linhas.push("");
  linhas.push(`- Itens idênticos: **${resumo.totalIguais}**`);
  linhas.push(`- Itens novos (adicionados): **${resumo.totalNovos}**`);
  linhas.push(`- Itens ausentes (removidos): **${resumo.totalAusentes}**`);
  linhas.push(`- Itens com valores alterados: **${resumo.totalAlterados}**`);
  linhas.push("");
  linhas.push("## 2. Totais Financeiros Comparativos");
  linhas.push("");
  linhas.push("| Métrica | Snapshot Anterior | Snapshot Novo | Diferença Líquida |");
  linhas.push("| --- | ---: | ---: | ---: |");
  linhas.push(`| Linhas do Plano | ${resumo.totalLinhasAnterior} | ${resumo.totalLinhasNovo} | ${diferencasAgregadas.linhas} |`);

  // Para calcular os totais absolutos do anterior e novo, podemos deduzir das diferenças agregadas
  // mas é mais preciso buscar direto do resultado se expusermos as métricas, ou apenas mostrar o delta.
  // Vamos mostrar o delta líquido agregando os valores.
  linhas.push(`| Valor Previsto Total | (ver anterior) | (ver novo) | ${formatarMoeda(diferencasAgregadas.valorPrevisto)} |`);
  linhas.push(`| Valor Executado Total | (ver anterior) | (ver novo) | ${formatarMoeda(diferencasAgregadas.valorExecutado)} |`);
  linhas.push(`| Saldo Total | (ver anterior) | (ver novo) | ${formatarMoeda(diferencasAgregadas.saldo)} |`);
  linhas.push("");

  if (resultado.itensNovos.length > 0) {
    linhas.push("## 3. Itens Novos (Adicionados)");
    linhas.push("");
    linhas.push("| Convênio | UF | Área | Natureza | Descrição | Previsto | Executado |");
    linhas.push("| --- | --- | --- | --- | --- | ---: | ---: |");
    for (const item of resultado.itensNovos) {
      linhas.push(`| ${item.numero} | ${item.uf} | ${item.area} | ${item.natureza} | ${item.descricao} | ${formatarMoeda(item.valorPrevisto)} | ${formatarMoeda(item.valorExecutado)} |`);
    }
    linhas.push("");
  }

  if (resultado.itensAusentes.length > 0) {
    linhas.push("## 4. Itens Ausentes (Removidos)");
    linhas.push("");
    linhas.push("| Convênio | UF | Área | Natureza | Descrição | Previsto | Executado |");
    linhas.push("| --- | --- | --- | --- | --- | ---: | ---: |");
    for (const item of resultado.itensAusentes) {
      linhas.push(`| ${item.numero} | ${item.uf} | ${item.area} | ${item.natureza} | ${item.descricao} | ${formatarMoeda(item.valorPrevisto)} | ${formatarMoeda(item.valorExecutado)} |`);
    }
    linhas.push("");
  }

  if (resultado.itensAlterados.length > 0) {
    linhas.push("## 5. Detalhamento de Itens Alterados");
    linhas.push("");
    for (const item of resultado.itensAlterados) {
      linhas.push(`### ${item.numero} | ${item.uf} | ${item.area} | ${item.natureza} | ${item.descricao}`);
      linhas.push("");
      linhas.push("| Campo | Valor Anterior | Valor Novo | Diferença |");
      linhas.push("| --- | ---: | ---: | ---: |");
      for (const [campo, varInfo] of Object.entries(item.valores)) {
        const fmt = campo === "quantidade" ? (v) => v : formatarMoeda;
        linhas.push(`| ${campo} | ${fmt(varInfo.anterior)} | ${fmt(varInfo.novo)} | ${fmt(varInfo.delta)} |`);
      }
      linhas.push("");
    }
  }

  return linhas.join("\n");
}

/**
 * Salva o resultado da comparação em JSON e Markdown.
 */
function salvarRelatorioComparacaoSnapshots(resultado, caminhoJson, caminhoMarkdown) {
  const dirJson = path.dirname(caminhoJson);
  if (!fs.existsSync(dirJson)) {
    fs.mkdirSync(dirJson, { recursive: true });
  }
  fs.writeFileSync(caminhoJson, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");

  if (caminhoMarkdown) {
    const dirMd = path.dirname(caminhoMarkdown);
    if (!fs.existsSync(dirMd)) {
      fs.mkdirSync(dirMd, { recursive: true });
    }
    fs.writeFileSync(caminhoMarkdown, `${montarMarkdownComparacaoSnapshots(resultado)}\n`, "utf8");
  }
}

module.exports = {
  compararSnapshotsPad,
  montarMarkdownComparacaoSnapshots,
  salvarRelatorioComparacaoSnapshots,
};
