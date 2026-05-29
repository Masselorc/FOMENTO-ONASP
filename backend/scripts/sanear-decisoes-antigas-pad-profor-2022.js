const {
  planejarSaneamentoDecisoesAntigas,
  aplicarSaneamentoDecisoesAntigas,
} = require("../services/profor-2022/profor-pad-saneamento-decisoes-antigas-service");

function obterArgumentos() {
  const args = process.argv.slice(2);
  const flags = {
    aplicar: args.includes("--aplicar"),
    dryRun: args.includes("--dry-run"),
    convenios: [],
  };
  for (const arg of args) {
    const m = /^--convenio=(.+)$/.exec(arg);
    if (m) flags.convenios.push(String(m[1]).trim());
  }
  // Padrao seguro: se nenhuma flag de modo foi passada, comporta-se como dry-run.
  if (!flags.aplicar && !flags.dryRun) flags.dryRun = true;
  return flags;
}

function rotuloIgnorada(item) {
  const partes = [item.motivo];
  if (item.tipoSaneamento) partes.push(`tipoSaneamento=${item.tipoSaneamento}`);
  if (item.decisao) partes.push(`decisao=${item.decisao}`);
  if (item.somaRateio !== undefined) partes.push(`somaRateio=${item.somaRateio}`);
  if (item.quantidadeTotalItem !== undefined) partes.push(`quantidadeTotalItem=${item.quantidadeTotalItem}`);
  return partes.join(" | ");
}

function imprimirCabecalho(opcoes) {
  console.log("===========================================================");
  console.log("Saneamento de decisões antigas — PAD PROFOR/2022");
  console.log(`Modo: ${opcoes.aplicar ? "APLICAR (escreve no banco)" : "DRY-RUN (somente leitura)"}`);
  if (opcoes.convenios.length) console.log(`Convênios filtrados: ${opcoes.convenios.join(", ")}`);
  else console.log("Convênios filtrados: (todos)");
  console.log("-----------------------------------------------------------");
}

function imprimirResumo(plano) {
  console.log(`Total de decisões lidas: ${plano.totalDecisoesLidas}`);
  console.log(`Já materializadas (item conhecido + rateio ativo): ${plano.jaMaterializadas.length}`);
  console.log(`Aplicáveis: ${plano.candidatas.length}`);
  console.log(`Ignoradas: ${plano.ignoradas.length}`);
  if (plano.aplicadas) console.log(`Aplicadas: ${plano.aplicadas.length}`);
  if (plano.erros) console.log(`Erros: ${plano.erros.length}`);
}

function imprimirDetalhe(plano) {
  if (plano.candidatas.length) {
    console.log("\n--- Candidatas a aplicação ---");
    for (const c of plano.candidatas) {
      const ctx = c.contexto;
      console.log(` div=${c.registro.divergencia_id} dec=${c.registro.decisao_id} | ${ctx.numeroConvenio}/${ctx.uf} | qtd=${ctx.quantidadeOriginal} | ${ctx.chaveItem}`);
      c.linhasPersistencia.forEach((l) => {
        console.log(`     -> area=${l.area} nat=${l.natureza} qtd=${l.quantidade} vlrTotal=${l.valorTotal}`);
      });
    }
  }
  if (plano.jaMaterializadas.length) {
    console.log("\n--- Já materializadas (ignoradas com segurança) ---");
    for (const c of plano.jaMaterializadas) {
      console.log(` div=${c.registro.divergencia_id} dec=${c.registro.decisao_id} | ${c.registro.numero_convenio}/${c.registro.uf} | itemConhecidoId=${c.estadoAtual.itemConhecidoId} | ${c.registro.chave_item}`);
    }
  }
  if (plano.ignoradas.length) {
    console.log("\n--- Ignoradas ---");
    for (const i of plano.ignoradas) {
      console.log(` div=${i.registro?.divergencia_id} dec=${i.registro?.decisao_id} | ${i.registro?.chave_item || "(sem chave)"} | motivo=${rotuloIgnorada(i)}`);
    }
  }
  if (plano.aplicadas?.length) {
    console.log("\n--- Aplicadas ---");
    for (const a of plano.aplicadas) {
      console.log(` div=${a.divergenciaId} dec=${a.decisaoId} | ${a.numeroConvenio}/${a.uf} | itemConhecidoId=${a.itemConhecidoId} | ${a.chaveItem}`);
    }
  }
  if (plano.erros?.length) {
    console.log("\n--- Erros ---");
    for (const e of plano.erros) {
      console.log(` div=${e.divergenciaId} dec=${e.decisaoId} | ${e.chaveItem} | ${e.mensagem}`);
    }
  }
}

const CONFIRMACAO_APLICAR = "CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS";

async function executar() {
  const opcoes = obterArgumentos();
  imprimirCabecalho(opcoes);

  if (opcoes.aplicar && process.env[CONFIRMACAO_APLICAR] !== "SIM") {
    throw new Error(
      `Modo --aplicar exige confirmacao explicita. Defina ${CONFIRMACAO_APLICAR}=SIM para autorizar a escrita. ` +
      "Sem essa variavel, o saneamento real fica bloqueado por seguranca."
    );
  }

  const resultado = opcoes.aplicar
    ? await aplicarSaneamentoDecisoesAntigas({ convenios: opcoes.convenios })
    : await planejarSaneamentoDecisoesAntigas({ convenios: opcoes.convenios });

  imprimirDetalhe(resultado);
  console.log("\n===== RESUMO =====");
  imprimirResumo(resultado);
  if (!opcoes.aplicar) {
    console.log("\n(*) Nada foi escrito no banco. Use --aplicar para materializar.");
  }
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error("Falha ao sanear decisões antigas PAD/PROFOR 2022.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  });
}

module.exports = {
  obterArgumentos,
  executar,
};
