/**
 * Validação ponta a ponta da decisão estruturada PAD/PROFOR 2022.
 * Executa as Tarefas B, C, D e E de forma automatizada e controlada.
 */
const assert = require("node:assert");
const { inicializarBanco } = require("../db/init-db");
const { query } = require("../db/postgres-client");
const repo = require("../services/profor-2022/profor-pad-revisao-repository");
const decisaoService = require("../services/profor-2022/profor-pad-revisao-decisao-service");
const { carregarAplicacaoDecisoesDryRun } = require("../services/profor-2022/profor-pad-decisao-aplicacao-service");
const { auditarSegurancaPreAtivacaoDryRun } = require("../services/profor-2022/profor-pad-seguranca-pre-ativacao-service");
const { reconstruirPlanoAplicacaoPadDryRun } = require("../services/profor-2022/profor-pad-plano-reconstrucao-service");
const { compararPlanosPadDryRun } = require("../services/profor-2022/profor-pad-plano-comparador-service");
const path = require("node:path");

console.log("======================================================================");
console.log("Iniciando Validação Ponta a Ponta da Decisão Estruturada PAD/PROFOR 2022");
console.log("======================================================================\n");

async function executar() {
  // Inicialização do Banco
  inicializarBanco();

  // Limpa possíveis resíduos de execuções de teste anteriores que falharam
  console.log("Limpando possíveis resíduos de testes anteriores...");
  await repo.limparDivergenciasTeste();
  await query("DELETE FROM profor_2022_revisao_lotes WHERE origem = $1", ["teste-valida-decisao-ponta-a-ponta"]);

  // FASE 1: Verificação do Baseline
  console.log("Fase 1: Verificando baseline de produção...");
  const estatisticasAntes = await repo.obterEstatisticasAuditoria();
  console.log(`  divergências reais encontradas: ${estatisticasAntes.totalDivergencias}`);
  console.log(`  pendentes: ${estatisticasAntes.totalPendentes}`);
  console.log(`  impeditivas: ${estatisticasAntes.totalImpeditivas}`);
  console.log(`  bloqueiam publicação: ${estatisticasAntes.totalBloqueiamPublicacao}`);
  console.log("  [INFO] Esses valores serão adotados como o baseline dinâmico da execução.");
  
  // Validação mínima de sanidade e estrutura do baseline (Tarefa C)
  const contadores = [
    "totalDivergencias",
    "totalPendentes",
    "totalEmRevisao",
    "totalImpeditivas",
    "totalBloqueiamPublicacao",
    "totalPendentesQueBloqueiamPublicacao",
    "totalComDecisaoResolutiva",
    "totalComComentario",
    "totalSemDecisaoResolutiva",
    "publicacaoLiberada"
  ];
  for (const campo of contadores) {
    const valor = estatisticasAntes[campo];
    if (valor === undefined || valor === null) {
      throw new Error(`Campo essencial de auditoria '${campo}' está ausente, undefined ou null no baseline.`);
    }
    if (campo === "publicacaoLiberada") {
      if (typeof valor !== "boolean") {
        throw new Error(`Campo '${campo}' deve ser um boolean, mas é ${typeof valor}.`);
      }
    } else {
      if (typeof valor !== "number" || isNaN(valor)) {
        throw new Error(`Campo '${campo}' deve ser um número, mas é ${typeof valor}.`);
      }
    }
  }

  console.log("  [OK] Baseline verificado com sucesso!\n");

  // Criação do Lote Temporário de Teste
  console.log("Criando lote de revisão temporário para teste...");
  const loteId = await repo.criarLoteRevisao({
    origem: "teste-valida-decisao-ponta-a-ponta",
    arquivoOrigem: null,
    hashOrigem: null,
  });
  console.log(`  Lote de teste criado com ID: ${loteId}\n`);

  // FASE 2 & 3: Preparação e POST Real (Registro de Decisões)
  console.log("Fase 2 & 3: Preparando divergências controladas e registrando decisões...");

  const casosTeste = [
    {
      tipo: "equivalência por descrição normalizada",
      divergencia: {
        chaveDivergencia: "revisao_teste:equivalencia-1",
        numeroConvenio: "937221",
        uf: "ZZ",
        chaveItem: "937221::ITEM TESTE EQUIVALENCIA",
        tipoAlerta: "equivalencia_por_descricao_normalizada",
        nivel: "aviso",
        campoAfetado: "descricao",
        valorAnterior: "ITEM TESTE EQUIV MEMORIA",
        valorNovo: "ITEM TESTE EQUIV PAD",
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "descrição original diverge; coincide apenas após normalização",
        motivoProvavel: "Teste de equivalência normalizada.",
        acaoSugerida: "Confirmar equivalência.",
        impactoReconstrucao: "Item em equivalência.",
        bloqueiaPublicacao: true,
        payload: {
          campoAfetado: "descricao",
          numeroConvenio: "937221",
          uf: "ZZ",
          chaveItem: "937221::ITEM TESTE EQUIVALENCIA",
          descricaoMemoria: "ITEM TESTE EQUIV MEMORIA",
          descricaoPad: "ITEM TESTE EQUIV PAD",
        }
      },
      entradaDecisao: {
        decisao: "ACEITO",
        justificativa: "Aceitação de equivalência de teste.",
        usuario: "validador-ponta-a-ponta",
        payloadDecisao: {
          origem: 'interface-revisao-divergencias',
          tipoSaneamento: 'equivalencia_por_descricao_normalizada',
          equivalenciaAceita: true,
          chaveItemEquivalente: "937221::ITEM TESTE EQUIVALENCIA",
          descricaoPad: "ITEM TESTE EQUIV PAD",
          descricaoMemoria: "ITEM TESTE EQUIV MEMORIA",
          motivo: 'equivalência validada por decisão humana'
        }
      }
    },
    {
      tipo: "item novo sem rateio",
      divergencia: {
        chaveDivergencia: "revisao_teste:rateio-1",
        numeroConvenio: "937221",
        uf: "ZZ",
        chaveItem: "937221::ITEM TESTE RATEIO NOVO",
        tipoAlerta: "item_novo_sem_rateio",
        nivel: "impeditivo",
        campoAfetado: "rateio",
        valorAnterior: null,
        valorNovo: "1000.00",
        fonteAnterior: null,
        fonteNova: "pad",
        diferenca: "item novo sem rateio",
        motivoProvavel: "Item novo sem rateio.",
        acaoSugerida: "Registrar rateio manual.",
        impactoReconstrucao: "Bloqueia reconstrução.",
        bloqueiaPublicacao: true,
        payload: {
          numeroConvenio: "937221",
          uf: "ZZ",
          chaveItem: "937221::ITEM TESTE RATEIO NOVO",
        }
      },
      entradaDecisao: {
        decisao: "ACEITO",
        justificativa: "Rateio manual estruturado de teste.",
        usuario: "validador-ponta-a-ponta",
        payloadDecisao: {
          origem: 'interface-revisao-divergencias',
          tipoSaneamento: 'rateio_manual',
          rateio: [
            {
              area: "ADMINISTRATIVO",
              natureza: "SERVICOS DE TERCEIROS",
              percentualValor: 100,
              percentualQuantidade: 100
            }
          ],
          observacao: "Rateio de teste"
        }
      }
    },
    {
      tipo: "item ausente no PAD",
      divergencia: {
        chaveDivergencia: "revisao_teste:ausencia-1",
        numeroConvenio: "937221",
        uf: "ZZ",
        chaveItem: "937221::ITEM TESTE AUSENTE",
        tipoAlerta: "item_ausente_no_pad",
        nivel: "aviso",
        campoAfetado: "presenca",
        valorAnterior: "Presente",
        valorNovo: null,
        fonteAnterior: "memoria",
        fonteNova: null,
        diferenca: "Ausente",
        motivoProvavel: "Removido.",
        acaoSugerida: "Confirmar ausência.",
        impactoReconstrucao: "Item ausente.",
        bloqueiaPublicacao: true,
        payload: {
          numeroConvenio: "937221",
          uf: "ZZ",
          chaveItem: "937221::ITEM TESTE AUSENTE",
        }
      },
      entradaDecisao: {
        decisao: "ACEITO",
        justificativa: "Ausência confirmada no teste.",
        usuario: "validador-ponta-a-ponta",
        payloadDecisao: {
          origem: 'interface-revisao-divergencias',
          tipoSaneamento: 'ausencia_confirmada',
          ausenciaConfirmada: true,
          motivo: 'item não reapresentado no PAD atual e ausência confirmada pelo usuário'
        }
      }
    },
    {
      tipo: "item conhecido não apto",
      divergencia: {
        chaveDivergencia: "revisao_teste:nao_apto-1",
        numeroConvenio: "937221",
        uf: "ZZ",
        chaveItem: "937221::ITEM TESTE NAO APTO",
        tipoAlerta: "item_conhecido_nao_apto",
        nivel: "impeditivo",
        campoAfetado: "statusApto",
        valorAnterior: "Inapto",
        valorNovo: "Inapto",
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "item não apto",
        motivoProvavel: "Inaptidão.",
        acaoSugerida: "Liberar uso.",
        impactoReconstrucao: "Impede o uso.",
        bloqueiaPublicacao: true,
        payload: {
          numeroConvenio: "937221",
          uf: "ZZ",
          chaveItem: "937221::ITEM TESTE NAO APTO",
        }
      },
      entradaDecisao: {
        decisao: "ACEITO",
        justificativa: "Liberação de uso no teste.",
        usuario: "validador-ponta-a-ponta",
        payloadDecisao: {
          origem: 'interface-revisao-divergencias',
          tipoSaneamento: 'liberacao_item_nao_apto',
          liberarUsoDryRun: true,
          motivo: 'liberação validada por decisão humana'
        }
      }
    },
    {
      tipo: "inconsistência quantidade x valor unitário",
      divergencia: {
        chaveDivergencia: "revisao_teste:consistencia-1",
        numeroConvenio: "937221",
        uf: "ZZ",
        chaveItem: "937221::ITEM TESTE INCONSISTENTE",
        tipoAlerta: "quantidade_valor_unitario_inconsistente",
        nivel: "impeditivo",
        campoAfetado: "valorTotalPrevisto",
        valorAnterior: "100.00",
        valorNovo: "100.00",
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "divergência de cálculo",
        motivoProvavel: "Cálculo incoerente.",
        acaoSugerida: "Manter total PAD.",
        impactoReconstrucao: "Impede reconstrução.",
        bloqueiaPublicacao: true,
        payload: {
          numeroConvenio: "937221",
          uf: "ZZ",
          chaveItem: "937221::ITEM TESTE INCONSISTENTE",
        }
      },
      entradaDecisao: {
        decisao: "ACEITO",
        justificativa: "Manter totais PAD.",
        usuario: "validador-ponta-a-ponta",
        payloadDecisao: {
          origem: 'interface-revisao-divergencias',
          tipoSaneamento: 'consistencia_quantidade_valor_unitario',
          manterTotaisPad: true,
          valorUnitarioApenasReferencia: true,
          motivo: 'total PAD mantido como fonte de verdade'
        }
      }
    },
    {
      tipo: "campo corrigido (valor diferente)",
      divergencia: {
        chaveDivergencia: "revisao_teste:campo-1",
        numeroConvenio: "937221",
        uf: "ZZ",
        chaveItem: "937221::ITEM TESTE VALOR DIFERENTE",
        tipoAlerta: "valor_diferente",
        nivel: "aviso",
        campoAfetado: "valorPrevisto",
        valorAnterior: "1500.00",
        valorNovo: "1600.00",
        fonteAnterior: "memoria",
        fonteNova: "pad",
        diferenca: "100.00",
        motivoProvavel: "Valor divergente.",
        acaoSugerida: "Registrar valor corrigido.",
        impactoReconstrucao: "Valor modificado.",
        bloqueiaPublicacao: false,
        payload: {
          numeroConvenio: "937221",
          uf: "ZZ",
          chaveItem: "937221::ITEM TESTE VALOR DIFERENTE",
        }
      },
      entradaDecisao: {
        decisao: "CORRIGIDO",
        justificativa: "Valor corrigido para 1550.00",
        usuario: "validador-ponta-a-ponta",
        payloadDecisao: {
          origem: 'interface-revisao-divergencias',
          tipoSaneamento: 'campo_corrigido',
          campoAfetado: "valorPrevisto",
          valorCorrigido: "1550.00"
        }
      }
    }
  ];

  const dbIds = [];

  for (const caso of casosTeste) {
    console.log(`  Inserindo divergência de teste para: ${caso.tipo}...`);
    const upsert = await repo.inserirOuAtualizarDivergencia(loteId, caso.divergencia);
    assert.ok(upsert.id, "Falha ao obter ID da divergência inserida.");
    dbIds.push(upsert.id);

    console.log(`    Registrando decisão (${caso.entradaDecisao.decisao})...`);
    const resReg = await decisaoService.registrarDecisao(upsert.id, caso.entradaDecisao);
    
    // Asserções do POST Real
    assert.strictEqual(resReg.divergenciaId, upsert.id, "ID da divergência retornado difere.");
    assert.strictEqual(resReg.decisao, caso.entradaDecisao.decisao, "Decisão retornada difere.");
    assert.strictEqual(resReg.aplicadaAoPlano, false, "Decisão não deve ser aplicada diretamente ao planoAplicacao.");
    
    // Obter dados gravados para validações estruturadas
    const detalhe = await decisaoService.obterDivergencia(upsert.id);
    assert.strictEqual(detalhe.status, resReg.statusNovo, "Status final da divergência difere.");
    
    const ultimaDecisao = detalhe.decisoes[0];
    assert.ok(ultimaDecisao, "Decisão não gravada.");
    assert.strictEqual(ultimaDecisao.justificativa, caso.entradaDecisao.justificativa, "Justificativa não gravada corretamente.");
    
    // Validar _segurancaPreAtivacao
    const payloadDecisao = ultimaDecisao.payloadDecisao;
    assert.ok(payloadDecisao._segurancaPreAtivacao, "Nó _segurancaPreAtivacao ausente no payload.");
    assert.strictEqual(payloadDecisao._segurancaPreAtivacao.versao, 1, "Versão de segurança inválida.");
    assert.strictEqual(payloadDecisao._segurancaPreAtivacao.divergenciaId, upsert.id, "ID de segurança inválido.");
    assert.strictEqual(payloadDecisao._segurancaPreAtivacao.chaveDivergencia, caso.divergencia.chaveDivergencia, "Chave de segurança inválida.");
    assert.ok(payloadDecisao._segurancaPreAtivacao.payloadHashNoMomentoDaDecisao, "Hash de segurança ausente.");
    
    // Validar logs
    const ultimoLog = detalhe.logs[0];
    assert.ok(ultimoLog, "Log não gerado.");
    assert.strictEqual(ultimoLog.evento, "decisao_registrada", "Tipo de evento de log inválido.");
    
    console.log(`    [OK] Divergência e decisão gravadas perfeitamente!`);
  }
  console.log("  [OK] Fase 2 & 3 finalizadas com 100% de sucesso!\n");

  // FASE 4: Validação do Motor e Reconstrução Dry-run
  console.log("Fase 4: Validando interpretação das decisões de teste pelo motor dry-run...");
  
  const aplicacaoDecisoes = await carregarAplicacaoDecisoesDryRun();
  console.log(`  Decisões resolutivas encontradas no dry-run: ${aplicacaoDecisoes.totalDecisoesResolutivasEncontradas}`);
  console.log(`  Decisões interpretadas com sucesso: ${aplicacaoDecisoes.totalDecisoesInterpretadasDryRun}`);
  console.log(`  Decisões com efeito na reconstrução: ${aplicacaoDecisoes.totalDecisoesComEfeitoNaReconstrucao}`);
  
  // Nossos 6 casos devem aparecer
  assert.ok(aplicacaoDecisoes.totalDecisoesResolutivasEncontradas >= 6, "As 6 decisões de teste deveriam ter sido carregadas.");
  assert.ok(aplicacaoDecisoes.totalDecisoesInterpretadasDryRun >= 6, "As 6 decisões de teste deveriam ter sido interpretadas.");

  // Validador de Segurança Pré-Ativação (produção)
  console.log("  Validando que decisões de teste não afetam a segurança pré-ativação de produção...");
  const repoRoot = path.resolve(__dirname, "../..");
  const auditoriaSeguranca = auditarSegurancaPreAtivacaoDryRun({ repoRoot });
  
  // Assegurar que nenhum bloqueio ou aviso foi gerado referente a revisao_teste
  const testBlocks = auditoriaSeguranca.bloqueiosAtivacao.filter(item => item.chaveDivergencia && item.chaveDivergencia.startsWith("revisao_teste:"));
  const testAvisos = auditoriaSeguranca.avisos.filter(item => item.chaveDivergencia && item.chaveDivergencia.startsWith("revisao_teste:"));
  
  assert.strictEqual(testBlocks.length, 0, "A segurança de produção não deveria gerar bloqueios com chave iniciando por revisao_teste:.");
  assert.strictEqual(testAvisos.length, 0, "A segurança de produção não deveria gerar avisos com chave iniciando por revisao_teste:.");
  console.log("    [OK] Filtros de teste na segurança pré-ativação funcionando perfeitamente.");

  // Executando reconstrução e comparador dry-run completas
  console.log("  Executando reconstrução e comparação dry-run em lote...");
  const reconstrucao = await reconstruirPlanoAplicacaoPadDryRun({ aplicacaoDecisoes });
  const comparacao = await compararPlanosPadDryRun({ reconstrucao, aplicacaoDecisoes });
  console.log(`    Reconstrução dry-run concluída com ${reconstrucao.impedimentos.length} impedimentos.`);
  console.log(`    Comparação dry-run concluída com conclusão operacional.`);
  console.log("  [OK] Fase 4 finalizada com sucesso!\n");

  // FASE 5: Limpeza
  console.log("Fase 5: Executando limpeza das divergências de teste...");
  const resultadoLimpeza = await repo.limparDivergenciasTeste();
  console.log(`  divergências de teste localizadas: ${resultadoLimpeza.totalDivergenciasTeste}`);
  console.log(`  decisões de teste removidas: ${resultadoLimpeza.totalDecisoesRemovidas}`);
  console.log(`  logs de teste removidos: ${resultadoLimpeza.totalLogsRemovidos}`);
  console.log(`  divergências de teste removidas do banco: ${resultadoLimpeza.totalDivergenciasRemovidas}`);
  
  assert.strictEqual(resultadoLimpeza.totalDivergenciasTeste, 6, "Deveria ter localizado exatamente 6 divergências de teste.");
  assert.strictEqual(resultadoLimpeza.totalDivergenciasRemovidas, 6, "Deveria ter removido exatamente 6 divergências do banco.");
  assert.strictEqual(resultadoLimpeza.totalDecisoesRemovidas, 6, "Deveria ter removido exatamente 6 decisões do banco.");
  assert.ok(resultadoLimpeza.totalLogsRemovidos >= 6, "Deveria ter removido pelo menos 6 logs.");

  // Remover lote temporário
  await query("DELETE FROM profor_2022_revisao_lotes WHERE id = $1", [loteId]);
  console.log("  Lote temporário excluído com sucesso.");

  // FASE 6: Verificação Pós-Limpeza
  console.log("\nFase 6: Verificando retorno ao baseline original...");
  const estatisticasDepois = await repo.obterEstatisticasAuditoria();
  console.log(`  divergências reais após limpeza: ${estatisticasDepois.totalDivergencias}`);
  console.log(`  pendentes: ${estatisticasDepois.totalPendentes}`);
  console.log(`  impeditivas: ${estatisticasDepois.totalImpeditivas}`);
  console.log(`  bloqueiam publicação: ${estatisticasDepois.totalBloqueiamPublicacao}`);
  
  for (const campo of contadores) {
    assert.strictEqual(
      estatisticasDepois[campo],
      estatisticasAntes[campo],
      `O campo '${campo}' divergiu do baseline após a limpeza (Antes: ${estatisticasAntes[campo]}, Depois: ${estatisticasDepois[campo]}).`
    );
  }
  console.log("  [OK] Retorno ao baseline validado com sucesso!");

  console.log("\n======================================================================");
  console.log("SUCESSO: Validação ponta a ponta concluída com êxito absoluto!");
  console.log("======================================================================");
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("\n[FALHA] Erro durante a validação ponta a ponta:");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});
