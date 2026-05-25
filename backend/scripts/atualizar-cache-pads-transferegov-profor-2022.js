const path = require("node:path");
const fs = require("node:fs");

const {
  carregarReferenciaPadExcel,
  selecionarConvenios,
} = require("../services/profor-2022/profor-pad-transferegov-dry-run-service");
const {
  extrairPadTransferegov,
} = require("../services/profor-2022/profor-pad-transferegov-extracao-service");
const {
  montarCachePadTransferegov,
  validarCachePadTransferegov,
  salvarCachePadTransferegov,
  obterCaminhoCache,
} = require("../services/profor-2022/profor-pad-transferegov-cache-service");
const db = require("../db/database");

function obterArgumento(nome) {
  const prefixo = `--${nome}=`;
  const arg = process.argv.find((item) => item.startsWith(prefixo));
  return arg ? arg.slice(prefixo.length) : null;
}

function argumentos() {
  const args = {
    convenio: obterArgumento("convenio"),
    dryRun: process.argv.includes("--dry-run"),
    salvarCache: process.argv.includes("--salvar-cache"),
  };

  // Sem argumentos específicos, comporta-se como --dry-run
  if (!args.dryRun && !args.salvarCache && !args.convenio) {
    args.dryRun = true;
  }
  return args;
}

function validarIntegridadeTecnica(extracao) {
  const bloqueios = [];
  const itens = extracao?.dados?.itens;
  if (!Array.isArray(itens) || itens.length === 0) {
    bloqueios.push({ tipo: "zero_itens_extraidos", detalhe: "Nenhum item PAD foi extraído da fonte atual." });
    return bloqueios;
  }

  itens.forEach((item, indice) => {
    const contexto = { indice, descricao: item?.descricao || null };
    if (!String(item?.descricao || "").trim()) {
      bloqueios.push({ tipo: "item_sem_descricao", detalhe: "Item extraído sem descrição.", contexto });
    }
    if (!String(item?.codigoNaturezaDespesa || "").trim()) {
      bloqueios.push({ tipo: "item_sem_codigo_natureza", detalhe: "Item extraído sem código de natureza.", contexto });
    }
    if (!Number.isFinite(Number(item?.quantidade))) {
      bloqueios.push({ tipo: "quantidade_nao_parseavel", detalhe: "Quantidade do item não é numérica.", contexto });
    }
    if (!Number.isFinite(Number(item?.valorTotalPrevisto))) {
      bloqueios.push({ tipo: "valor_total_previsto_nao_parseavel", detalhe: "Valor total previsto do item não é numérico.", contexto });
    }
  });

  return bloqueios;
}

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const opcoes = argumentos();
  const dataHora = new Date().toISOString();

  console.log(`[Cache Transferegov] Iniciando atualização isolada do cache...`);

  // Carregar lista de convênios a partir do dry-run
  const referencia = carregarReferenciaPadExcel(repoRoot);
  const conveniosFiltro = selecionarConvenios(referencia, { convenio: opcoes.convenio });
  const totalConveniosMonitorados = selecionarConvenios(referencia).length;

  if (conveniosFiltro.length === 0) {
    console.error(`[Cache Transferegov] Nenhum convênio encontrado.`);
    process.exit(1);
  }

  // Carregar UFs dos convênios ativos no banco
  const linhasUf = db.prepare("SELECT numero_convenio, uf FROM profor_convenios_monitorados WHERE ativo = 1").all();
  const mapaUfs = new Map(linhasUf.map((l) => [String(l.numero_convenio), l.uf]));

  const resultadosExtracao = [];
  let totalBloqueiosTecnicos = 0;
  let totalItens = 0;

  for (const numConvenio of conveniosFiltro) {
    const uf = mapaUfs.get(numConvenio) || "UF";
    console.log(`[Cache Transferegov] Extraindo convênio ${numConvenio} via HTTP...`);
    
    try {
      const extracao = await extrairPadTransferegov(numConvenio, {
        fallbackPlaywright: false,
        repoRoot,
      });

      if (!extracao.sucesso) {
        totalBloqueiosTecnicos += 1;
        resultadosExtracao.push({
          numeroConvenio: numConvenio,
          uf,
          origemUsada: "falhou",
          extraidoEm: dataHora,
          totalItens: 0,
          totalizadores: {},
          hashConteudo: "",
          aptoParaImportacaoTecnica: false,
          bloqueiosTecnicos: (extracao.erros || []).map((e) => ({
            tipo: e.codigo || "falha_extracao_transferegov",
            detalhe: e.mensagem || "Erro na extração."
          })),
          avisos: [],
          itens: [],
        });
        continue;
      }

      const bloqueiosTecnicos = validarIntegridadeTecnica(extracao);
      if (bloqueiosTecnicos.length > 0) {
        totalBloqueiosTecnicos += bloqueiosTecnicos.length;
      }
      
      const totais = extracao.dados.totais || {};
      const totalItensConvenio = extracao.dados.itens.length;
      totalItens += totalItensConvenio;

      resultadosExtracao.push({
        numeroConvenio: numConvenio,
        uf,
        origemUsada: extracao.origem,
        extraidoEm: dataHora,
        totalItens: totalItensConvenio,
        totalizadores: {
          concedente: totais.concedente || "",
          convenente: totais.convenente || "",
          situacao: totais.situacao || "",
          valorTotalPrevisto: totais.valorTotalPrevisto || 0,
          valorTotalExecutado: totais.valorTotalExecutado || 0,
          saldoTotal: totais.saldo || 0,
        },
        hashConteudo: extracao.dados.hashConteudo || "",
        aptoParaImportacaoTecnica: bloqueiosTecnicos.length === 0,
        bloqueiosTecnicos,
        avisos: extracao.dados.erros || [],
        itens: extracao.dados.itens,
      });

    } catch (erro) {
      totalBloqueiosTecnicos += 1;
      resultadosExtracao.push({
        numeroConvenio: numConvenio,
        uf,
        origemUsada: "falhou",
        extraidoEm: dataHora,
        totalItens: 0,
        totalizadores: {},
        hashConteudo: "",
        aptoParaImportacaoTecnica: false,
        bloqueiosTecnicos: [{ tipo: "erro_inesperado", detalhe: erro.message || String(erro) }],
        avisos: [],
        itens: [],
      });
    }
  }

  const cache = montarCachePadTransferegov(resultadosExtracao);
  const validacao = validarCachePadTransferegov(cache);

  const totalConveniosExtraidos = resultadosExtracao.length;
  const totalAptosTecnicos = resultadosExtracao.filter((c) => c.aptoParaImportacaoTecnica).length;

  let cacheApto = validacao.valido && totalAptosTecnicos === totalConveniosMonitorados && !opcoes.convenio;
  let cacheSalvo = false;
  let cacheAnteriorPreservado = false;

  const caminhoCache = obterCaminhoCache({ repoRoot });
  const existeAnterior = fs.existsSync(caminhoCache);

  if (opcoes.salvarCache) {
    if (opcoes.convenio) {
      console.warn(`[Cache Transferegov] Não é permitido salvar o cache ao processar um único convênio (--convenio). Operação abortada.`);
    } else if (cacheApto) {
      try {
        salvarCachePadTransferegov(cache, { repoRoot });
        cacheSalvo = true;
      } catch (e) {
        console.error(`[Cache Transferegov] Erro ao salvar cache: ${e.message}`);
        cacheAnteriorPreservado = existeAnterior;
      }
    } else {
      console.error(`[Cache Transferegov] Cache inabilitado para gravação (nem todos os convênios estão aptos ou houve erros).`);
      cacheAnteriorPreservado = existeAnterior;
    }
  } else {
    cacheAnteriorPreservado = existeAnterior;
  }

  console.log("\n====== RESUMO DA EXECUÇÃO ======");
  console.log(`totalConveniosExtraidos=${totalConveniosExtraidos}`);
  console.log(`totalAptosTecnicos=${totalAptosTecnicos}`);
  console.log(`totalBloqueiosTecnicos=${totalBloqueiosTecnicos}`);
  console.log(`totalItens=${totalItens}`);
  console.log(`caminhoCache=${cacheSalvo ? caminhoCache : "não_salvo"}`);
  console.log(`cacheAnteriorPreservado=${cacheAnteriorPreservado ? "true" : "false"}`);
  console.log(`cacheApto=${cacheApto ? "true" : "false"}`);

  if (!cacheApto && !opcoes.convenio) {
    console.error(`\n[Cache Transferegov] Execução malsucedida para formação de cache completo.`);
    process.exit(1);
  }
}

executar().catch((erro) => {
  console.error("Erro na execução do script:", erro);
  process.exit(1);
});
