const fs = require("node:fs");
const path = require("node:path");
const db = require("../db/database");

const CAMINHO_SANEAMENTO = "backend/data/relatorios/profor-2022-pad-saneamento.json";
const SAIDA_JSON = "backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.md";

function stripDiacritics(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function diferencaApenasAcentuacaoOuDiacritico(a, b) {
  const cleanA = String(a ?? "").replace(/\s+/g, " ").trim();
  const cleanB = String(b ?? "").replace(/\s+/g, " ").trim();
  if (cleanA === cleanB) return false;
  return stripDiacritics(cleanA).toLowerCase() === stripDiacritics(cleanB).toLowerCase();
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const saneamentoCaminho = path.join(repoRoot, CAMINHO_SANEAMENTO);

  if (!fs.existsSync(saneamentoCaminho)) {
    console.error(`Erro: Relatório de saneamento não encontrado em ${saneamentoCaminho}`);
    console.error("Execute 'npm run profor:pad:relatorio-saneamento' primeiro.");
    process.exit(1);
  }

  const saneamento = JSON.parse(fs.readFileSync(saneamentoCaminho, "utf8"));
  const diacriticoSaneados = saneamento.equivalenciasDiacriticoSaneadas || [];

  // Map para busca rápida das equivalências saneadas por convênio e descrição original da memória
  const saneadasMap = new Map();
  for (const item of diacriticoSaneados) {
    const chave = `${item.numeroConvenio}::${stripDiacritics(item.descricaoOriginalMemoria).toLowerCase()}`;
    saneadasMap.set(chave, item);
  }

  // Obter todas as divergências da base
  const divergencias = db.prepare(`
    SELECT id, lote_revisao_id, chave_divergencia, numero_convenio, uf, chave_item,
           tipo_alerta, nivel, status, campo_afetado, valor_anterior, valor_novo,
           fonte_anterior, fonte_nova, diferenca, payload_json
    FROM profor_2022_revisao_divergencias
  `).all();

  const analisados = [];
  const resumo = {
    totalAnalisado: divergencias.length,
    saneavel_automaticamente_por_diacritico: 0,
    divergencia_material: 0,
    historico_nao_reapresentado_sem_correspondencia: 0,
    dados_insuficientes: 0,
    ja_decidido: 0,
  };

  const idsSaneaveis = [];

  for (const div of divergencias) {
    let payload = {};
    try {
      payload = JSON.parse(div.payload_json || "{}");
    } catch {
      payload = {};
    }

    let classificacao = "dados_insuficientes";
    let motivo = "Dados insuficientes ou divergência não relacionada a acentuação.";

    const statusDecidido = ["ACEITO", "REJEITADO", "CORRIGIDO", "APLICADO", "REVERTIDO"].includes(div.status);

    if (statusDecidido) {
      classificacao = "ja_decidido";
      motivo = `Divergência já possui decisão resolutiva com status ${div.status}.`;
    } else {
      // Relevantes: equivalencia_por_descricao_normalizada e item_ausente_no_pad
      if (div.tipo_alerta === "equivalencia_por_descricao_normalizada") {
        const descMemoria = payload.descricaoMemoria || div.valor_anterior;
        const descPad = payload.descricaoPad || div.valor_novo;

        if (descMemoria && descPad) {
          if (diferencaApenasAcentuacaoOuDiacritico(descMemoria, descPad)) {
            // Verificar compatibilidade material
            const vuMemoria = Number(payload.valorUnitarioMemoria);
            const vuPad = Number(payload.valorUnitarioPad);
            const vuCompativel = Number.isFinite(vuMemoria) && Number.isFinite(vuPad) && Math.abs(vuMemoria - vuPad) <= 0.01;

            const natMemoria = payload.naturezaMemoria;
            const natPad = payload.naturezaPad;
            // Normalizar e comparar naturezas
            const normalizarNat = (n) => {
              const str = String(n ?? "").toUpperCase().trim();
              if (str.includes("CAPITAL")) return "CAPITAL";
              if (str.includes("CUSTEIO") || str.includes("CORRENTE")) return "CUSTEIO";
              return str;
            };
            const natCompativel = !natMemoria || !natPad || normalizarNat(natMemoria) === normalizarNat(natPad);

            if (vuCompativel && natCompativel) {
              classificacao = "saneavel_automaticamente_por_diacritico";
              motivo = `Divergência de equivalência com diferença apenas de acentuação/diacrítico e dados materiais compatíveis (Preço mem: R$ ${vuMemoria.toFixed(2)}, PAD: R$ ${vuPad.toFixed(2)}).`;
            } else {
              classificacao = "divergencia_material";
              motivo = `Diferença de acentuação/diacrítico mas possui divergência material (Preço mem: R$ ${vuMemoria || 0}, PAD: R$ ${vuPad || 0}; Natureza mem: ${natMemoria}, PAD: ${natPad}).`;
            }
          } else {
            classificacao = "divergencia_material";
            motivo = `Divergência de descrição normalizada mas com diferença material/técnica além de acentuação.`;
          }
        } else {
          classificacao = "dados_insuficientes";
          motivo = "Campos de descrição ausentes no payload.";
        }
      } else if (div.tipo_alerta === "item_ausente_no_pad") {
        const descMemoria = payload.descricaoMemoria || (div.valor_anterior !== "presente_na_memoria" ? div.valor_anterior : null);

        if (descMemoria) {
          const chaveSaneada = `${div.numero_convenio}::${stripDiacritics(descMemoria).toLowerCase()}`;
          const correspondente = saneadasMap.get(chaveSaneada);

          if (correspondente) {
            classificacao = "saneavel_automaticamente_por_diacritico";
            motivo = `Item ausente reencontrado no PAD com diferença apenas de acentuação: '${correspondente.descricaoOriginalPad}' (saneado no matching atual).`;
          } else {
            classificacao = "historico_nao_reapresentado_sem_correspondencia";
            motivo = "Item conhecido da memória ausente no PAD sem correspondência de acentuação no matching atual.";
          }
        } else {
          classificacao = "dados_insuficientes";
          motivo = "Descrição da memória ausente no payload/valor_anterior.";
        }
      } else {
        // Outros tipos de divergência não são saneáveis por diacrítico
        classificacao = "historico_nao_reapresentado_sem_correspondencia";
        motivo = `Divergência do tipo '${div.tipo_alerta}' não é tratada por saneamento de diacrítico.`;
      }
    }

    resumo[classificacao]++;
    if (classificacao === "saneavel_automaticamente_por_diacritico") {
      idsSaneaveis.push(div.id);
    }

    analisados.push({
      id: div.id,
      chaveDivergencia: div.chave_divergencia,
      numeroConvenio: div.numero_convenio,
      tipoAlerta: div.tipo_alerta,
      status: div.status,
      descricaoMemoria: payload.descricaoMemoria || div.valor_anterior,
      descricaoPad: payload.descricaoPad || div.valor_novo,
      classificacao,
      motivo,
    });
  }

  const jsonReport = {
    resumo: {
      geradoEm: new Date().toISOString(),
      totalAnalisado: resumo.totalAnalisado,
      saneavelAutomaticamente: resumo.saneavel_automaticamente_por_diacritico,
      divergenciaMaterial: resumo.divergencia_material,
      historicoNaoReapresentado: resumo.historico_nao_reapresentado_sem_correspondencia,
      dadosInsuficientes: resumo.dados_insuficientes,
      jaDecidido: resumo.ja_decidido,
    },
    idsSaneaveis,
    analisados,
  };

  fs.mkdirSync(path.dirname(path.join(repoRoot, SAIDA_JSON)), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, SAIDA_JSON), JSON.stringify(jsonReport, null, 2), "utf8");

  // Gerar Markdown
  let mdContent = `# Relatório de Auditoria — Diacríticos e Acentuação PAD/PROFOR 2022 (Dry-Run)\n\n`;
  mdContent += `*Gerado em:* ${new Date().toLocaleString("pt-BR")}\n\n`;

  mdContent += `## Resumo Estatístico\n\n`;
  mdContent += `| Classificação | Quantidade |\n`;
  mdContent += `| :--- | :---: |\n`;
  mdContent += `| **Saneável Automaticamente** | ${resumo.saneavel_automaticamente_por_diacritico} |\n`;
  mdContent += `| Divergência Material | ${resumo.divergencia_material} |\n`;
  mdContent += `| Histórico Não Reapresentado | ${resumo.historico_nao_reapresentado_sem_correspondencia} |\n`;
  mdContent += `| Dados Insuficientes | ${resumo.dados_insuficientes} |\n`;
  mdContent += `| Já Decidido | ${resumo.ja_decidido} |\n`;
  mdContent += `| **Total Analisado** | **${resumo.totalAnalisado}** |\n\n`;

  mdContent += `## IDs Saneáveis\n\n`;
  if (idsSaneaveis.length > 0) {
    mdContent += `Os seguintes IDs serão saneados automaticamente:\n`;
    mdContent += `\`[${idsSaneaveis.join(", ")}]\`\n\n`;
  } else {
    mdContent += `Nenhum item saneável encontrado.\n\n`;
  }

  mdContent += `## Detalhes das Classificações\n\n`;
  mdContent += `| ID | Convênio | Tipo | Status | Classificação | Motivo |\n`;
  mdContent += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const item of analisados) {
    mdContent += `| #${item.id} | ${item.numeroConvenio} | \`${item.tipoAlerta}\` | \`${item.status}\` | **${item.classificacao}** | ${item.motivo} |\n`;
  }

  fs.writeFileSync(path.join(repoRoot, SAIDA_MD), mdContent, "utf8");

  console.log(`Auditoria concluída.`);
  console.log(`JSON gerado em: ${SAIDA_JSON}`);
  console.log(`MD gerado em: ${SAIDA_MD}`);
  console.log(`Total analisado: ${resumo.totalAnalisado}`);
  console.log(`  Saneáveis automaticamente: ${resumo.saneavel_automaticamente_por_diacritico}`);
  console.log(`  Divergência material: ${resumo.divergencia_material}`);
  console.log(`  Histórico não reapresentado: ${resumo.historico_nao_reapresentado_sem_correspondencia}`);
  console.log(`  Já decidido: ${resumo.ja_decidido}`);
}

try {
  executar();
} catch (erro) {
  console.error("Erro na auditoria de diacríticos:", erro);
  process.exit(1);
}
