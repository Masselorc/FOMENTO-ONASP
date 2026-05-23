const fs = require("node:fs");
const path = require("node:path");

const {
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

const {
  calcularChecksumSnapshot,
  normalizarTextoCanonico,
  normalizarTextoParaChave,
  removerDiacriticos,
} = require("./profor-pad-fotografia-service");

const VERSAO_COMPARADOR = "0.3";
const TOLERANCIA_MOEDA = 0.01;
const TOLERANCIA_QUANTIDADE = 0.000001;

function obterSnapshot(origem) {
  if (typeof origem === "string") {
    if (!fs.existsSync(origem)) {
      throw new Error(`Arquivo de snapshot não encontrado: ${origem}`);
    }
    return JSON.parse(fs.readFileSync(origem, "utf8"));
  }
  if (origem && typeof origem === "object") {
    return origem;
  }
  throw new Error("Origem de snapshot inválida (deve ser caminho de arquivo ou objeto).");
}

function criarBloqueioTecnico(tipo, mensagem, detalhes = {}) {
  return {
    tipo,
    mensagem,
    severidade: "alta",
    ...detalhes,
  };
}

function chaveLegada(linha) {
  return [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.natureza),
    normalizarTextoParaChave(linha.area),
    normalizarTextoParaChave(linha.descricaoOriginal ?? linha.descricao),
  ].join("|");
}

function chaveComparacaoLegada(linha) {
  return linha.chaveComparacao || chaveLegada(linha);
}

function chaveMaterialLegada(linha) {
  return linha.chaveMaterial || chaveLegada(linha);
}

function chaveContexto(linha) {
  return linha.chaveContexto || [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.natureza),
    normalizarTextoParaChave(linha.area),
  ].join("|");
}

function chaveSemNatureza(linha) {
  return [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.area),
    normalizarTextoParaChave(linha.descricaoOriginal ?? linha.descricao),
  ].join("|");
}

function chaveSemArea(linha) {
  return [
    normalizarTextoParaChave(linha.numero),
    normalizarTextoParaChave(linha.uf),
    normalizarTextoParaChave(linha.natureza),
    normalizarTextoParaChave(linha.descricaoOriginal ?? linha.descricao),
  ].join("|");
}

function adicionarAoIndice(mapa, chave, item) {
  if (!mapa.has(chave)) mapa.set(chave, []);
  mapa.get(chave).push(item);
}

function indexarSnapshotPorChaves(snapshot, nomeSnapshot = "snapshot") {
  const porMaterial = new Map();
  const porComparacao = new Map();
  const porContexto = new Map();
  const porSemNatureza = new Map();
  const porSemArea = new Map();
  const bloqueiosTecnicos = [];
  const itens = Array.isArray(snapshot.planoAplicacao) ? snapshot.planoAplicacao : [];

  for (const item of itens) {
    adicionarAoIndice(porMaterial, chaveMaterialLegada(item), item);
    adicionarAoIndice(porComparacao, chaveComparacaoLegada(item), item);
    adicionarAoIndice(porContexto, chaveContexto(item), item);
    adicionarAoIndice(porSemNatureza, chaveSemNatureza(item), item);
    adicionarAoIndice(porSemArea, chaveSemArea(item), item);
  }

  for (const [chave, grupo] of porMaterial.entries()) {
    if (grupo.length > 1) {
      bloqueiosTecnicos.push(criarBloqueioTecnico(
        "colisao_chave",
        `Colisão de chave material em ${nomeSnapshot}.`,
        { chave, totalItens: grupo.length, snapshot: nomeSnapshot }
      ));
    }
  }

  for (const [chave, grupo] of porComparacao.entries()) {
    if (grupo.length > 1) {
      bloqueiosTecnicos.push(criarBloqueioTecnico(
        "chave_ambigua",
        `Chave de comparação ambígua em ${nomeSnapshot}.`,
        { chave, totalItens: grupo.length, snapshot: nomeSnapshot }
      ));
    }
  }

  for (const item of itens) {
    const avisos = Array.isArray(item.avisos) ? item.avisos : [];
    const erros = Array.isArray(item.erros) ? item.erros : [];
    for (const aviso of avisos) {
      if (["dados_insuficientes", "chave_ambigua", "colisao_chave"].includes(aviso.tipo)) {
        bloqueiosTecnicos.push(criarBloqueioTecnico(aviso.tipo, `Aviso técnico em ${nomeSnapshot}.`, {
          chave: item.chaveMaterial || null,
          snapshot: nomeSnapshot,
          aviso,
        }));
      }
    }
    for (const erro of erros) {
      bloqueiosTecnicos.push(criarBloqueioTecnico(erro.tipo || "dados_insuficientes", `Erro técnico em ${nomeSnapshot}.`, {
        chave: item.chaveMaterial || null,
        snapshot: nomeSnapshot,
        erro,
      }));
    }
  }

  return {
    itens,
    porMaterial,
    porComparacao,
    porContexto,
    porSemNatureza,
    porSemArea,
    bloqueiosTecnicos,
  };
}

function textoSemPontuacaoComDiacritico(valor) {
  return normalizarTextoCanonico(valor)
    .replace(/[.,;:()[\]{}"'`´^~\\/|_+=*!?<>@#$%&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compararTextoDescricao(anterior, novo) {
  const originalAnterior = String(anterior?.descricaoOriginal ?? anterior?.descricao ?? "");
  const originalNovo = String(novo?.descricaoOriginal ?? novo?.descricao ?? "");
  if (originalAnterior === originalNovo) return null;

  const textualAnterior = textoSemPontuacaoComDiacritico(originalAnterior);
  const textualNovo = textoSemPontuacaoComDiacritico(originalNovo);
  if (textualAnterior === textualNovo) return "descricao_apenas_textual";

  const chaveAnterior = normalizarTextoParaChave(originalAnterior);
  const chaveNovo = normalizarTextoParaChave(originalNovo);
  if (chaveAnterior === chaveNovo && removerDiacriticos(textualAnterior) === removerDiacriticos(textualNovo)) {
    return "descricao_apenas_diacritico";
  }

  return "descricao_alterada";
}

function registrarDiferenca(lista, tipos, tipo, campo, anterior, novo, delta = null) {
  tipos.add(tipo);
  lista[campo] = { anterior, novo };
  if (delta !== null) lista[campo].delta = delta;
}

function classificarDiferencasItem(anterior, novo) {
  const tipos = new Set();
  const valores = {};
  const tipoDescricao = compararTextoDescricao(anterior, novo);
  if (tipoDescricao) {
    registrarDiferenca(valores, tipos, tipoDescricao, "descricao", anterior.descricaoOriginal ?? anterior.descricao, novo.descricaoOriginal ?? novo.descricao);
  }

  if (normalizarTextoParaChave(anterior.area) !== normalizarTextoParaChave(novo.area)) {
    registrarDiferenca(valores, tipos, "area_alterada", "area", anterior.area, novo.area);
  }

  if (normalizarTextoParaChave(anterior.natureza) !== normalizarTextoParaChave(novo.natureza)) {
    registrarDiferenca(valores, tipos, "natureza_alterada", "natureza", anterior.natureza, novo.natureza);
  }

  const diffQuantidade = (Number(novo.quantidade) || 0) - (Number(anterior.quantidade) || 0);
  if (Math.abs(diffQuantidade) > TOLERANCIA_QUANTIDADE) {
    registrarDiferenca(
      valores,
      tipos,
      "quantidade_alterada",
      "quantidade",
      anterior.quantidade,
      novo.quantidade,
      Math.round(diffQuantidade * 1e6) / 1e6
    );
  }

  for (const [campo, tipo] of [
    ["valorUnitario", "valor_unitario_alterado"],
    ["valorPrevisto", "valor_previsto_alterado"],
    ["valorExecutado", "valor_executado_alterado"],
    ["saldo", "saldo_alterado"],
  ]) {
    const diff = (Number(novo[campo]) || 0) - (Number(anterior[campo]) || 0);
    if (Math.abs(diff) > TOLERANCIA_MOEDA) {
      registrarDiferenca(valores, tipos, tipo, campo, anterior[campo], novo[campo], arredondarMoedaProfor(diff));
    }
  }

  return {
    alterado: tipos.size > 0,
    tipos: [...tipos],
    valores,
  };
}

function resumoVazio() {
  return {
    totalIguais: 0,
    totalNovos: 0,
    totalRemovidos: 0,
    totalAusentes: 0,
    totalAlterados: 0,
    totalBloqueiosTecnicos: 0,
    porTipo: {},
    porUf: {},
    porNatureza: {},
  };
}

function incrementar(contagem, chave, inc = 1) {
  const k = chave || "NAO_INFORMADO";
  contagem[k] = (contagem[k] || 0) + inc;
}

function registrarResumoDivergencia(resumo, divergencia) {
  for (const tipo of divergencia.tipos || [divergencia.tipo]) {
    incrementar(resumo.porTipo, tipo);
  }
  incrementar(resumo.porUf, divergencia.uf);
  incrementar(resumo.porNatureza, divergencia.natureza);
}

function parearPorIndice(indiceAnterior, indiceNovo, usadosAnterior, usadosNovo, pares, origemPareamento) {
  for (const [chave, grupoAnterior] of indiceAnterior.entries()) {
    const grupoNovo = indiceNovo.get(chave) || [];
    const disponiveisAnterior = grupoAnterior.filter((item) => !usadosAnterior.has(item));
    const disponiveisNovo = grupoNovo.filter((item) => !usadosNovo.has(item));
    if (disponiveisAnterior.length === 1 && disponiveisNovo.length === 1) {
      const anterior = disponiveisAnterior[0];
      const novo = disponiveisNovo[0];
      usadosAnterior.add(anterior);
      usadosNovo.add(novo);
      pares.push({ anterior, novo, chave, origemPareamento });
    }
  }
}

// Pareia grupos materiais com colisão de chave (>1 item em ambos os lados)
// usando `hashItem` (identidade material byte-a-byte) como critério bijetivo.
// Atua somente quando: mesmo número de itens pendentes em ambos os lados E
// multiset de hashes do anterior == multiset de hashes do novo. Bloqueios
// técnicos NÃO são apagados — apenas marcados como `ruidoTecnicoControlado`
// nos pares produzidos para visibilidade do relatório. Diferença financeira
// agregada nunca é critério único aqui: a identidade vem do hash do item.
function parearGruposMateriaisPorHash(indiceAnterior, indiceNovo, usadosAnterior, usadosNovo, pares, bloqueiosTecnicos) {
  const ruidos = [];
  for (const [chave, grupoAnterior] of indiceAnterior.entries()) {
    const grupoNovo = indiceNovo.get(chave) || [];
    const pendentesAnterior = grupoAnterior.filter((item) => !usadosAnterior.has(item));
    const pendentesNovo = grupoNovo.filter((item) => !usadosNovo.has(item));
    if (pendentesAnterior.length < 2 || pendentesAnterior.length !== pendentesNovo.length) continue;
    if (pendentesAnterior.some((item) => !item.hashItem) || pendentesNovo.some((item) => !item.hashItem)) continue;

    // Multiset de hashes precisa ser idêntico nos dois lados.
    const contagemAnterior = new Map();
    for (const item of pendentesAnterior) {
      contagemAnterior.set(item.hashItem, (contagemAnterior.get(item.hashItem) || 0) + 1);
    }
    const contagemNovo = new Map();
    for (const item of pendentesNovo) {
      contagemNovo.set(item.hashItem, (contagemNovo.get(item.hashItem) || 0) + 1);
    }
    if (contagemAnterior.size !== contagemNovo.size) continue;
    let bijetivo = true;
    for (const [hash, total] of contagemAnterior.entries()) {
      if (contagemNovo.get(hash) !== total) { bijetivo = false; break; }
    }
    if (!bijetivo) continue;

    // Pareia 1:1 consumindo do novo pelo mesmo hash.
    const fila = new Map();
    for (const item of pendentesNovo) {
      if (!fila.has(item.hashItem)) fila.set(item.hashItem, []);
      fila.get(item.hashItem).push(item);
    }
    for (const anterior of pendentesAnterior) {
      const disponiveis = fila.get(anterior.hashItem) || [];
      const novo = disponiveis.shift();
      if (!novo) continue;
      usadosAnterior.add(anterior);
      usadosNovo.add(novo);
      pares.push({ anterior, novo, chave, origemPareamento: "grupo_material_ruido_chave_preexistente" });
    }
    ruidos.push({
      chave,
      totalItens: pendentesAnterior.length,
      hashesUnicos: contagemAnterior.size,
      criterio: "hashItem_bijetivo",
    });
  }

  // Marca os bloqueios técnicos de colisão de chave correspondentes como
  // ruído controlado, sem removê-los do relatório.
  if (ruidos.length > 0) {
    const chavesRuido = new Set(ruidos.map((r) => r.chave));
    for (const bloqueio of bloqueiosTecnicos) {
      if (bloqueio.tipo === "colisao_chave" && chavesRuido.has(bloqueio.chave)) {
        bloqueio.ruidoTecnicoControlado = true;
        bloqueio.motivoRuido = "identidade_material_bijetiva_por_hashItem";
      }
    }
  }

  return ruidos;
}

function validarChecksum(snapshot, nome) {
  const calculado = calcularChecksumSnapshot(snapshot.planoAplicacao || []);
  const informado = snapshot.checksum || null;
  return {
    nome,
    informado,
    calculado,
    valido: informado === calculado,
  };
}

function compararSnapshotsPad(anterior, novo) {
  const snapAnterior = obterSnapshot(anterior);
  const snapNovo = obterSnapshot(novo);

  if (!Array.isArray(snapAnterior.planoAplicacao) || !Array.isArray(snapNovo.planoAplicacao)) {
    throw new Error("Estrutura de fotografia canônica inválida: 'planoAplicacao' ausente ou malformado.");
  }

  const checksumAnterior = validarChecksum(snapAnterior, "anterior");
  const checksumNovo = validarChecksum(snapNovo, "novo");
  const checksumsValidos = checksumAnterior.valido && checksumNovo.valido;

  const indiceAnterior = indexarSnapshotPorChaves(snapAnterior, "anterior");
  const indiceNovo = indexarSnapshotPorChaves(snapNovo, "novo");
  const bloqueiosTecnicos = [...indiceAnterior.bloqueiosTecnicos, ...indiceNovo.bloqueiosTecnicos];
  const avisos = [];

  if (!checksumAnterior.valido) {
    bloqueiosTecnicos.push(criarBloqueioTecnico("checksum_invalido", "Checksum inválido no snapshot anterior.", checksumAnterior));
  }
  if (!checksumNovo.valido) {
    bloqueiosTecnicos.push(criarBloqueioTecnico("checksum_invalido", "Checksum inválido no snapshot novo.", checksumNovo));
  }

  const usadosAnterior = new Set();
  const usadosNovo = new Set();
  const pares = [];
  parearPorIndice(indiceAnterior.porMaterial, indiceNovo.porMaterial, usadosAnterior, usadosNovo, pares, "chaveMaterial");
  parearPorIndice(indiceAnterior.porComparacao, indiceNovo.porComparacao, usadosAnterior, usadosNovo, pares, "chaveComparacao");
  parearPorIndice(indiceAnterior.porContexto, indiceNovo.porContexto, usadosAnterior, usadosNovo, pares, "chaveContexto");
  parearPorIndice(indiceAnterior.porSemNatureza, indiceNovo.porSemNatureza, usadosAnterior, usadosNovo, pares, "chaveSemNatureza");
  parearPorIndice(indiceAnterior.porSemArea, indiceNovo.porSemArea, usadosAnterior, usadosNovo, pares, "chaveSemArea");
  // Sexta etapa: absorve grupos materiais com colisão preexistente cuja
  // identidade é bijetiva por hashItem. Não apaga bloqueios técnicos — apenas
  // os marca como ruído controlado e impede que virem `item_novo`/`item_removido`.
  const ruidosTecnicosControlados = parearGruposMateriaisPorHash(
    indiceAnterior.porMaterial, indiceNovo.porMaterial,
    usadosAnterior, usadosNovo, pares, bloqueiosTecnicos
  );

  for (const [chave, grupoAnterior] of indiceAnterior.porContexto.entries()) {
    const grupoNovo = indiceNovo.porContexto.get(chave) || [];
    const pendentesAnterior = grupoAnterior.filter((item) => !usadosAnterior.has(item));
    const pendentesNovo = grupoNovo.filter((item) => !usadosNovo.has(item));
    if (pendentesAnterior.length > 1 || pendentesNovo.length > 1) {
      bloqueiosTecnicos.push(criarBloqueioTecnico("chave_ambigua", "Pareamento por contexto ambíguo.", {
        chave,
        totalAnterior: pendentesAnterior.length,
        totalNovo: pendentesNovo.length,
      }));
    }
  }

  const resumo = resumoVazio();
  const itensIguais = [];
  const itensNovos = [];
  const itensAusentes = [];
  const itensAlterados = [];
  const divergencias = [];

  for (const par of pares) {
    const diff = classificarDiferencasItem(par.anterior, par.novo);
    if (!diff.alterado) {
      resumo.totalIguais += 1;
      itensIguais.push(par.novo);
      continue;
    }

    resumo.totalAlterados += 1;
    const divergencia = {
      tipo: diff.tipos[0],
      tipos: diff.tipos,
      chave: par.chave,
      origemPareamento: par.origemPareamento,
      uf: par.novo.uf || par.anterior.uf,
      numero: par.novo.numero || par.anterior.numero,
      area: par.novo.area || par.anterior.area,
      natureza: par.novo.natureza || par.anterior.natureza,
      descricaoAnterior: par.anterior.descricaoOriginal ?? par.anterior.descricao,
      descricaoNova: par.novo.descricaoOriginal ?? par.novo.descricao,
      valores: diff.valores,
    };
    itensAlterados.push(divergencia);
    divergencias.push(divergencia);
    registrarResumoDivergencia(resumo, divergencia);
  }

  for (const item of indiceNovo.itens) {
    if (usadosNovo.has(item)) continue;
    resumo.totalNovos += 1;
    itensNovos.push(item);
    const divergencia = {
      tipo: "item_novo",
      tipos: ["item_novo"],
      chave: chaveMaterialLegada(item),
      uf: item.uf,
      numero: item.numero,
      area: item.area,
      natureza: item.natureza,
      descricaoNova: item.descricaoOriginal ?? item.descricao,
      item,
    };
    divergencias.push(divergencia);
    registrarResumoDivergencia(resumo, divergencia);
  }

  for (const item of indiceAnterior.itens) {
    if (usadosAnterior.has(item)) continue;
    resumo.totalRemovidos += 1;
    resumo.totalAusentes += 1;
    itensAusentes.push(item);
    const divergencia = {
      tipo: "item_removido",
      tipos: ["item_removido"],
      chave: chaveMaterialLegada(item),
      uf: item.uf,
      numero: item.numero,
      area: item.area,
      natureza: item.natureza,
      descricaoAnterior: item.descricaoOriginal ?? item.descricao,
      item,
    };
    divergencias.push(divergencia);
    registrarResumoDivergencia(resumo, divergencia);
  }

  for (const bloqueio of bloqueiosTecnicos) {
    registrarResumoDivergencia(resumo, {
      tipo: bloqueio.tipo,
      tipos: [bloqueio.tipo],
      uf: bloqueio.uf,
      natureza: bloqueio.natureza,
    });
  }

  resumo.totalBloqueiosTecnicos = bloqueiosTecnicos.length;

  const totalPrevistoAnterior = snapAnterior.resumo?.totalValorPrevisto ?? snapAnterior.resumo?.valorPrevistoTotal ?? 0;
  const totalPrevistoNovo = snapNovo.resumo?.totalValorPrevisto ?? snapNovo.resumo?.valorPrevistoTotal ?? 0;
  const totalExecutadoAnterior = snapAnterior.resumo?.totalValorExecutado ?? snapAnterior.resumo?.valorExecutadoTotal ?? 0;
  const totalExecutadoNovo = snapNovo.resumo?.totalValorExecutado ?? snapNovo.resumo?.valorExecutadoTotal ?? 0;
  const totalSaldoAnterior = snapAnterior.resumo?.totalSaldo ?? snapAnterior.resumo?.saldoTotal ?? 0;
  const totalSaldoNovo = snapNovo.resumo?.totalSaldo ?? snapNovo.resumo?.saldoTotal ?? 0;
  const totalQuantidadeAnterior = snapAnterior.resumo?.totalQuantidade ?? snapAnterior.resumo?.quantidadeTotal ?? 0;
  const totalQuantidadeNovo = snapNovo.resumo?.totalQuantidade ?? snapNovo.resumo?.quantidadeTotal ?? 0;

  const diferencasAgregadas = {
    valorPrevisto: arredondarMoedaProfor(totalPrevistoNovo - totalPrevistoAnterior),
    valorExecutado: arredondarMoedaProfor(totalExecutadoNovo - totalExecutadoAnterior),
    saldo: arredondarMoedaProfor(totalSaldoNovo - totalSaldoAnterior),
    quantidade: Math.round((totalQuantidadeNovo - totalQuantidadeAnterior) * 1e6) / 1e6,
    linhas: (snapNovo.resumo?.totalLinhas || 0) - (snapAnterior.resumo?.totalLinhas || 0),
  };

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    versaoComparador: VERSAO_COMPARADOR,
    checksumAnterior: checksumAnterior.informado,
    checksumNovo: checksumNovo.informado,
    checksumCalculadoAnterior: checksumAnterior.calculado,
    checksumCalculadoNovo: checksumNovo.calculado,
    checksumsValidos,
    bloqueiosTecnicos,
    ruidosTecnicosControlados,
    avisos,
    resumo: {
      totalLinhasAnterior: snapAnterior.resumo?.totalLinhas || 0,
      totalLinhasNovo: snapNovo.resumo?.totalLinhas || 0,
      ...resumo,
      totalRuidosTecnicosControlados: ruidosTecnicosControlados.length,
    },
    diferencasAgregadas,
    divergencias,
    itensNovos,
    itensAusentes,
    itensRemovidos: itensAusentes,
    itensAlterados,
    itensIguais,
  };
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function montarMarkdownComparacaoSnapshots(resultado) {
  const { resumo, diferencasAgregadas } = resultado;
  const linhas = [];

  linhas.push("# PROFOR 2022 - Comparação de Snapshots PAD (dry-run)");
  linhas.push("");
  linhas.push(`Gerado em: ${resultado.geradoEm}`);
  linhas.push(`Versão do comparador: ${resultado.versaoComparador || "-"}`);
  linhas.push(`Checksum anterior: \`${resultado.checksumAnterior || "-"}\``);
  linhas.push(`Checksum novo: \`${resultado.checksumNovo || "-"}\``);
  linhas.push(`Checksums válidos: ${resultado.checksumsValidos ? "sim" : "não"}`);
  linhas.push(`Bloqueios técnicos: ${resultado.bloqueiosTecnicos.length}`);
  linhas.push("");
  linhas.push("## 1. Resumo");
  linhas.push("");
  linhas.push(`- Itens idênticos: ${resumo.totalIguais}`);
  linhas.push(`- Itens novos: ${resumo.totalNovos}`);
  linhas.push(`- Itens removidos: ${resumo.totalRemovidos}`);
  linhas.push(`- Itens alterados: ${resumo.totalAlterados}`);
  linhas.push(`- Bloqueios técnicos: ${resumo.totalBloqueiosTecnicos}`);
  linhas.push("");
  linhas.push("## 2. Tipos de divergência");
  linhas.push("");
  linhas.push("| Tipo | Qtd |");
  linhas.push("| --- | ---: |");
  for (const [tipo, total] of Object.entries(resumo.porTipo || {}).sort()) {
    linhas.push(`| \`${tipo}\` | ${total} |`);
  }
  linhas.push("");
  linhas.push("## 3. Totais agregados");
  linhas.push("");
  linhas.push("| Métrica | Diferença líquida |");
  linhas.push("| --- | ---: |");
  linhas.push(`| Linhas | ${diferencasAgregadas.linhas} |`);
  linhas.push(`| Valor previsto | R$ ${formatarMoeda(diferencasAgregadas.valorPrevisto)} |`);
  linhas.push(`| Valor executado | R$ ${formatarMoeda(diferencasAgregadas.valorExecutado)} |`);
  linhas.push(`| Saldo | R$ ${formatarMoeda(diferencasAgregadas.saldo)} |`);
  linhas.push(`| Quantidade | ${diferencasAgregadas.quantidade} |`);
  linhas.push("");

  if (resultado.bloqueiosTecnicos.length) {
    linhas.push("## 4. Bloqueios técnicos");
    linhas.push("");
    linhas.push("| Tipo | Mensagem | Chave | Ruído controlado |");
    linhas.push("| --- | --- | --- | --- |");
    for (const bloqueio of resultado.bloqueiosTecnicos) {
      linhas.push(
        `| \`${bloqueio.tipo}\` | ${bloqueio.mensagem || "-"} | \`${bloqueio.chave || "-"}\` | ${bloqueio.ruidoTecnicoControlado ? "sim" : "não"} |`,
      );
    }
    linhas.push("");
  }

  const ruidos = Array.isArray(resultado.ruidosTecnicosControlados) ? resultado.ruidosTecnicosControlados : [];
  if (ruidos.length) {
    linhas.push("## 4a. Ruído técnico controlado (pareamento por identidade material)");
    linhas.push("");
    linhas.push("| Chave | Itens | Hashes únicos | Critério |");
    linhas.push("| --- | ---: | ---: | --- |");
    for (const ruido of ruidos) {
      linhas.push(`| \`${ruido.chave}\` | ${ruido.totalItens} | ${ruido.hashesUnicos} | \`${ruido.criterio}\` |`);
    }
    linhas.push("");
  }

  if (resultado.divergencias.length) {
    linhas.push("## 5. Divergências");
    linhas.push("");
    linhas.push("| Tipo | Convênio | UF | Natureza | Área | Descrição |");
    linhas.push("| --- | --- | --- | --- | --- | --- |");
    for (const item of resultado.divergencias.slice(0, 200)) {
      linhas.push(`| \`${item.tipo}\` | ${item.numero || "-"} | ${item.uf || "-"} | ${item.natureza || "-"} | ${item.area || "-"} | ${item.descricaoNova || item.descricaoAnterior || "-"} |`);
    }
    if (resultado.divergencias.length > 200) {
      linhas.push(`| ... | ... | ... | ... | ... | ${resultado.divergencias.length - 200} divergência(s) omitida(s) no Markdown |`);
    }
    linhas.push("");
  }

  linhas.push("## 6. Garantias");
  linhas.push("");
  linhas.push("- Comparação executada em dry-run.");
  linhas.push("- Não publica dados.");
  linhas.push("- Não altera `frontend/data/publicados/`.");
  linhas.push("- Não altera SQLite, WAL ou SHM.");

  return `${linhas.join("\n")}\n`;
}

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
    fs.writeFileSync(caminhoMarkdown, montarMarkdownComparacaoSnapshots(resultado), "utf8");
  }
}

module.exports = {
  compararSnapshotsPad,
  montarMarkdownComparacaoSnapshots,
  salvarRelatorioComparacaoSnapshots,
  indexarSnapshotPorChaves,
  classificarDiferencasItem,
  compararTextoDescricao,
  criarBloqueioTecnico,
};
