const crypto = require("node:crypto");
const cacheService = require("./profor-pad-transferegov-cache-service");

/**
 * Valida a estrutura básica do cache do PAD Transferegov.
 * @param {Object} cache
 * @param {Object} [opcoes]
 * @returns {Array<Object>} Lista de achados de validação
 */
function validarEstruturaCachePadTransferegov(cache, opcoes = {}) {
  const achados = [];

  if (!cache || typeof cache !== "object") {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "cache",
      mensagem: "O cache está vazio ou não é um objeto válido."
    });
    return achados;
  }

  // 1. Origem deve ser "transferegov"
  if (cache.origem !== "transferegov") {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "origem",
      mensagem: `Origem do cache inválida. Esperado: "transferegov", Obtido: "${cache.origem}"`
    });
  }

  // 2. Versão deve ser 1
  if (cache.versao !== 1) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "versao",
      mensagem: `Versão do cache inválida. Esperado: 1, Obtido: "${cache.versao}"`
    });
  }

  // Verificar presença dos campos principais
  if (cache.totalConvenios === undefined || typeof cache.totalConvenios !== "number") {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "totalConvenios",
      mensagem: "Campo totalConvenios ausente ou não numérico."
    });
  }

  if (cache.totalItens === undefined || typeof cache.totalItens !== "number") {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "totalItens",
      mensagem: "Campo totalItens ausente ou não numérico."
    });
  }

  if (!cache.hashGlobal || typeof cache.hashGlobal !== "string") {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "hashGlobal",
      mensagem: "Campo hashGlobal ausente ou inválido."
    });
  }

  if (!cache.convenios || !Array.isArray(cache.convenios)) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "convenios",
      mensagem: "Campo convenios ausente ou não é um array."
    });
    return achados; // Não dá pra validar convênios individualmente se não for array
  }

  // 3. totalConvenios deve bater com convenios.length
  if (cache.totalConvenios !== cache.convenios.length) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "totalConvenios",
      mensagem: `Divergência de total de convênios. Declarado: ${cache.totalConvenios}, Presente: ${cache.convenios.length}`
    });
  }

  // Validar cada convênio individualmente
  cache.convenios.forEach((c, idx) => {
    const ident = c.numeroConvenio || `Índice ${idx}`;

    // 7. Todos os convênios devem ter numeroConvenio
    if (!c.numeroConvenio || typeof c.numeroConvenio !== "string" || c.numeroConvenio.trim() === "") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${idx}].numeroConvenio`,
        mensagem: `Convênio no índice ${idx} não possui número identificador.`
      });
    }

    // 8. Todos os convênios devem ter uf
    if (!c.uf || typeof c.uf !== "string" || c.uf.trim() === "") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${idx}].uf`,
        mensagem: `Convênio ${ident} não possui UF.`
      });
    }

    // 9. Todos os convênios devem ter origemUsada
    if (!c.origemUsada || typeof c.origemUsada !== "string") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${idx}].origemUsada`,
        mensagem: `Convênio ${ident} não possui origemUsada.`
      });
    }

    if (c.totalItens === undefined || typeof c.totalItens !== "number") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${idx}].totalItens`,
        mensagem: `Convênio ${ident} não possui totalItens ou não é numérico.`
      });
    }

    if (!c.itens || !Array.isArray(c.itens)) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${idx}].itens`,
        mensagem: `Convênio ${ident} não possui lista de itens.`
      });
      return;
    }

    // Validar itens do convênio
    c.itens.forEach((item, itemIdx) => {
      const itemIdent = `Convênio ${ident}, Item ${itemIdx}`;

      // 16. Cada item deve ter descricao
      if (!item.descricao || typeof item.descricao !== "string" || item.descricao.trim() === "") {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].descricao`,
          mensagem: `Item sem descrição no ${itemIdent}.`
        });
      }

      // 17. Cada item deve ter codigoNaturezaDespesa ou codigoNaturezaNormalizado
      const temNatureza = (item.codigoNaturezaDespesa && typeof item.codigoNaturezaDespesa === "string" && item.codigoNaturezaDespesa.trim() !== "") ||
                          (item.codigoNaturezaNormalizado && typeof item.codigoNaturezaNormalizado === "string" && item.codigoNaturezaNormalizado.trim() !== "");
      if (!temNatureza) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].codigoNatureza`,
          mensagem: `Item sem código de natureza de despesa (ou normalizado) no ${itemIdent}.`
        });
      }

      // 18. Quantidade deve ser número finito
      if (item.quantidade === undefined || typeof item.quantidade !== "number" || !Number.isFinite(item.quantidade)) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].quantidade`,
          mensagem: `Quantidade inválida ou não numérica no ${itemIdent}.`
        });
      }

      // 19. ValorUnitario deve ser número finito
      if (item.valorUnitario === undefined || typeof item.valorUnitario !== "number" || !Number.isFinite(item.valorUnitario)) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].valorUnitario`,
          mensagem: `Valor unitário inválido ou não numérico no ${itemIdent}.`
        });
      }

      // 20. ValorTotalPrevisto deve ser número finito
      if (item.valorTotalPrevisto === undefined || typeof item.valorTotalPrevisto !== "number" || !Number.isFinite(item.valorTotalPrevisto)) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].valorTotalPrevisto`,
          mensagem: `Valor total previsto inválido ou não numérico no ${itemIdent}.`
        });
      }

      // 21. ValorTotalExecutado deve ser número finito
      if (item.valorTotalExecutado === undefined || typeof item.valorTotalExecutado !== "number" || !Number.isFinite(item.valorTotalExecutado)) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].valorTotalExecutado`,
          mensagem: `Valor total executado inválido ou não numérico no ${itemIdent}.`
        });
      }

      // 22. Saldo deve ser número finito
      if (item.saldo === undefined || typeof item.saldo !== "number" || !Number.isFinite(item.saldo)) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${idx}].itens[${itemIdx}].saldo`,
          mensagem: `Saldo inválido ou não numérico no ${itemIdent}.`
        });
      }
    });
  });

  return achados;
}

/**
 * Valida a segurança do cache contra dados sensíveis e tags HTML.
 * @param {Object} cache
 * @returns {Array<Object>} Lista de achados de validação
 */
function validarSegurancaCachePadTransferegov(cache) {
  const achados = [];
  if (!cache) return achados;

  const raw = JSON.stringify(cache);
  const rawLower = raw.toLowerCase();

  // 23 & 32. Cache não pode conter HTML bruto ("<html")
  if (rawLower.includes("<html")) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache contém marcas HTML brutas ('<html')."
    });
  }

  // 24 & 25. Cache não pode conter ViewState
  if (rawLower.includes("viewstate")) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache contém dados de ViewState (javax.faces.ViewState)."
    });
  }

  // 26. Cache não pode conter "cookie"
  if (rawLower.includes("cookie")) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache contém menção ou valor de cookie."
    });
  }

  // 27 & 28. Cache não pode conter authorization ou bearer
  if (rawLower.includes("authorization") || rawLower.includes("bearer")) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache contém tokens de autorização (Authorization/Bearer)."
    });
  }

  // 29. Cache não pode conter JSESSIONID
  if (rawLower.includes("jsessionid")) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache contém identificadores de sessão JSESSIONID."
    });
  }

  // 30. Cache não pode conter headers HTTP sensíveis (ex: sec-ch-ua, user-agent, referer nas propriedades)
  const headersSensiveis = ["sec-ch-ua", "user-agent", "referer", "x-auth", "cookie"];
  for (const header of headersSensiveis) {
    if (rawLower.includes(`"${header}"`) || rawLower.includes(`"${header}:`)) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: "seguranca",
        mensagem: `O cache contém header HTTP sensível: "${header}".`
      });
    }
  }

  // 31. Cache não pode conter HAR
  // Verifica se possui estrutura típica de HAR (log, entries, creator)
  if (cache.log && cache.log.entries && Array.isArray(cache.log.entries)) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache parece ser um arquivo HAR (HTTP Archive)."
    });
  }
  // Check boundary word "har" inside raw JSON
  if (/\bhar\b/i.test(raw)) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "seguranca",
      mensagem: "O cache contém a palavra isolada 'har' ou padrão associado a HAR."
    });
  }

  return achados;
}

/**
 * Valida a completude do cache para garantir que todos os dados esperados estão presentes.
 * @param {Object} cache
 * @param {Object} [opcoes]
 * @returns {Array<Object>} Lista de achados de validação
 */
function validarCompletudeCachePadTransferegov(cache, opcoes = {}) {
  const achados = [];
  if (!cache || !cache.convenios) return achados;

  const validacaoCompleta = opcoes.completo !== false;

  // 4. totalConvenios deve ser 15 se for validação completa
  if (validacaoCompleta) {
    if (cache.totalConvenios !== 15) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: "totalConvenios",
        mensagem: `Para validação completa, o cache deve conter exatamente 15 convênios. Obtido: ${cache.totalConvenios}`
      });
    }
  }

  cache.convenios.forEach((c) => {
    const ident = c.numeroConvenio || "Desconhecido";

    // 9. Todos os convênios devem ter origemUsada "http"
    if (c.origemUsada !== "http") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].origemUsada`,
        mensagem: `Convênio ${ident} possui origemUsada inválida ("${c.origemUsada}"). Esperado: "http".`
      });
    }

    // 10. Nenhum convênio pode ter origemUsada "playwright"
    if (c.origemUsada === "playwright") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].origemUsada`,
        mensagem: `Origem usada "playwright" é proibida nesta etapa para o convênio ${ident}.`
      });
    }

    // 11. Todos os convênios devem ter aptoParaImportacaoTecnica = true
    if (c.aptoParaImportacaoTecnica !== true) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].aptoParaImportacaoTecnica`,
        mensagem: `Convênio ${ident} não está marcado como apto para importação técnica.`
      });
    }

    // 12. bloqueiosTecnicos deve estar vazio
    if (c.bloqueiosTecnicos && c.bloqueiosTecnicos.length > 0) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].bloqueiosTecnicos`,
        mensagem: `Convênio ${ident} possui bloqueios técnicos: ${JSON.stringify(c.bloqueiosTecnicos)}`
      });
    }

    // 14. Cada convênio deve ter hashConteudo
    if (!c.hashConteudo || typeof c.hashConteudo !== "string" || c.hashConteudo.trim() === "") {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].hashConteudo`,
        mensagem: `Convênio ${ident} não possui hashConteudo.`
      });
    }

    // Convênio não pode ter zero itens (completude mínima)
    if (!c.itens || c.itens.length === 0) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].itens`,
        mensagem: `Convênio ${ident} possui zero itens de despesa.`
      });
    }
  });

  // 6 & 22. totalItens deve ser 525 no cache completo. Se divergir, gera alerta de revisão, não erro
  if (validacaoCompleta && cache.totalItens !== 525) {
    achados.push({
      tipo: "alerta_revisao",
      campo: "totalItens",
      mensagem: `O total de itens do cache (${cache.totalItens}) difere do esperado histórico (525). Verifique se houve alteração na fonte oficial.`
    });
  }

  return achados;
}

/**
 * Valida a consistência interna das contagens e hashes do cache.
 * @param {Object} cache
 * @returns {Array<Object>} Lista de achados de validação
 */
function validarConsistenciaInternaCachePadTransferegov(cache) {
  const achados = [];
  if (!cache || !cache.convenios) return achados;

  let somaItens = 0;
  cache.convenios.forEach((c) => {
    const ident = c.numeroConvenio || "Desconhecido";

    // 13. Cada convênio deve ter totalItens igual a itens.length
    if (c.totalItens !== (c.itens ? c.itens.length : 0)) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: `convenios[${c.numeroConvenio}].totalItens`,
        mensagem: `Convênio ${ident} possui totalItens (${c.totalItens}) diferente do tamanho do array de itens (${c.itens ? c.itens.length : 0}).`
      });
    }

    somaItens += c.itens ? c.itens.length : 0;

    // 14. Validar se o hashConteudo é consistente recalculando-o
    if (c.itens && c.hashConteudo) {
      const hashCalculado = cacheService.calcularHashConteudo(c.itens);
      if (hashCalculado !== c.hashConteudo) {
        achados.push({
          tipo: "erro_tecnico_bloqueante",
          campo: `convenios[${c.numeroConvenio}].hashConteudo`,
          mensagem: `Hash do conteúdo do convênio ${ident} é inconsistente. Declarado: ${c.hashConteudo}, Calculado: ${hashCalculado}`
        });
      }
    }
  });

  // 5. totalItens deve bater com a soma dos itens de todos os convênios
  if (cache.totalItens !== somaItens) {
    achados.push({
      tipo: "erro_tecnico_bloqueante",
      campo: "totalItens",
      mensagem: `O totalItens do cache (${cache.totalItens}) diverge da soma de itens de todos os convênios (${somaItens}).`
    });
  }

  // 15. hashGlobal deve ser consistente recalculando-o a partir dos convênios
  if (cache.hashGlobal) {
    const hashGlobalCalculado = cacheService.calcularHashGlobal(cache.convenios);
    if (hashGlobalCalculado !== cache.hashGlobal) {
      achados.push({
        tipo: "erro_tecnico_bloqueante",
        campo: "hashGlobal",
        mensagem: `Hash global do cache é inconsistente. Declarado: ${cache.hashGlobal}, Calculado: ${hashGlobalCalculado}`
      });
    }
  }

  return achados;
}

/**
 * Gera o diagnóstico completo do cache do PAD Transferegov.
 * @param {Object} cache
 * @param {Object} [opcoes]
 * @returns {Object} Diagnóstico formatado
 */
function gerarDiagnosticoCachePadTransferegov(cache, opcoes = {}) {
  const achadosEstrutura = validarEstruturaCachePadTransferegov(cache, opcoes);

  // Se a estrutura básica estiver corrompida, retorna imediatamente com os erros estruturais
  const errosEstruturais = achadosEstrutura.filter((a) => a.tipo === "erro_tecnico_bloqueante");
  if (errosEstruturais.length > 0) {
    return {
      valido: false,
      erros: errosEstruturais,
      alertas: achadosEstrutura.filter((a) => a.tipo === "alerta_revisao"),
      informativos: achadosEstrutura.filter((a) => a.tipo === "informativo"),
      totalErrosBloqueantes: errosEstruturais.length,
      totalAlertas: achadosEstrutura.filter((a) => a.tipo === "alerta_revisao").length,
      totalInformativos: achadosEstrutura.filter((a) => a.tipo === "informativo").length
    };
  }

  const achadosSeguranca = validarSegurancaCachePadTransferegov(cache);
  const achadosCompletude = validarCompletudeCachePadTransferegov(cache, opcoes);
  const achadosConsistencia = validarConsistenciaInternaCachePadTransferegov(cache);

  const todosAchados = [
    ...achadosEstrutura,
    ...achadosSeguranca,
    ...achadosCompletude,
    ...achadosConsistencia
  ];

  const erros = todosAchados.filter((a) => a.tipo === "erro_tecnico_bloqueante");
  const alertas = todosAchados.filter((a) => a.tipo === "alerta_revisao");
  const informativos = todosAchados.filter((a) => a.tipo === "informativo");

  // Adiciona informativos gerais sobre a execução
  informativos.push({
    tipo: "informativo",
    mensagem: `Diagnóstico executado com sucesso em ${new Date().toISOString()}.`
  });

  return {
    valido: erros.length === 0,
    erros: erros,
    alertas: alertas,
    informativos: informativos,
    totalErrosBloqueantes: erros.length,
    totalAlertas: alertas.length,
    totalInformativos: informativos.length
  };
}

module.exports = {
  validarEstruturaCachePadTransferegov,
  validarSegurancaCachePadTransferegov,
  validarCompletudeCachePadTransferegov,
  validarConsistenciaInternaCachePadTransferegov,
  gerarDiagnosticoCachePadTransferegov
};
