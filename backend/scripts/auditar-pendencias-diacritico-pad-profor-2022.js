/**
 * Auditoria dry-run das pendências residuais de diacrítico — PAD/PROFOR 2022.
 *
 * Lê a fila de revisão e classifica cada divergência quanto à possibilidade de
 * saneamento automático quando a diferença memória x PAD é exclusivamente de
 * acentuação/diacrítico, com dados materiais compatíveis.
 *
 * NÃO altera o banco, NÃO publica, NÃO aplica decisão. Apenas gera relatórios
 * em backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.{json,md}.
 *
 * Comando: npm run profor:pad:diacritico:auditar-pendencias
 */

const fs = require("node:fs");
const path = require("node:path");
const db = require("../db/database");
const { exigirConfirmacaoAuditoriaSqliteLegado } = require("./_guard-sqlite-legado");
const {
  classificarDivergenciaDiacritico,
  montarSaneadasMap,
} = require("../services/profor-2022/profor-pad-diacritico-auditoria-service");

const CAMINHO_SANEAMENTO = "backend/data/relatorios/profor-2022-pad-saneamento.json";
const SAIDA_JSON = "backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.md";

function parseJsonSeguro(texto) {
  try {
    return JSON.parse(texto || "{}");
  } catch {
    return {};
  }
}

function executar() {
  exigirConfirmacaoAuditoriaSqliteLegado("auditar-pendencias-diacritico-pad-profor-2022");
  const repoRoot = path.resolve(__dirname, "../..");
  const saneamentoCaminho = path.join(repoRoot, CAMINHO_SANEAMENTO);

  if (!fs.existsSync(saneamentoCaminho)) {
    console.error(`Erro: Relatório de saneamento não encontrado em ${saneamentoCaminho}`);
    console.error("Execute 'npm run profor:pad:relatorio-saneamento' primeiro.");
    process.exit(1);
  }

  const saneamento = JSON.parse(fs.readFileSync(saneamentoCaminho, "utf8"));
  const saneadasMap = montarSaneadasMap(saneamento.equivalenciasDiacriticoSaneadas || []);

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
    const payload = parseJsonSeguro(div.payload_json);
    const { classificacao, motivo } = classificarDivergenciaDiacritico(div, payload, saneadasMap);

    resumo[classificacao] = (resumo[classificacao] || 0) + 1;
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
      modo: "dry-run",
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

  let md = `# Auditoria de pendências residuais de diacrítico — PAD/PROFOR 2022 (dry-run)\n\n`;
  md += `*Gerado em:* ${new Date().toLocaleString("pt-BR")}\n\n`;
  md += `Esta auditoria é somente leitura: não altera o banco, não publica e não aplica decisão.\n\n`;
  md += `## Resumo estatístico\n\n`;
  md += `| Classificação | Quantidade |\n| :--- | :---: |\n`;
  md += `| **Saneável automaticamente por diacrítico** | ${resumo.saneavel_automaticamente_por_diacritico} |\n`;
  md += `| Divergência material | ${resumo.divergencia_material} |\n`;
  md += `| Histórico não reapresentado sem correspondência | ${resumo.historico_nao_reapresentado_sem_correspondencia} |\n`;
  md += `| Dados insuficientes | ${resumo.dados_insuficientes} |\n`;
  md += `| Já decidido | ${resumo.ja_decidido} |\n`;
  md += `| **Total analisado** | **${resumo.totalAnalisado}** |\n\n`;
  md += `## IDs saneáveis automaticamente\n\n`;
  md += idsSaneaveis.length > 0
    ? `\`[${idsSaneaveis.join(", ")}]\`\n\n`
    : `Nenhum item saneável encontrado nesta execução.\n\n`;
  md += `## Detalhe por divergência\n\n`;
  md += `| ID | Convênio | Tipo | Status | Classificação | Motivo |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const item of analisados) {
    md += `| #${item.id} | ${item.numeroConvenio} | \`${item.tipoAlerta}\` | \`${item.status}\` | **${item.classificacao}** | ${item.motivo} |\n`;
  }
  fs.writeFileSync(path.join(repoRoot, SAIDA_MD), md, "utf8");

  console.log("Auditoria de diacrítico concluída (dry-run).");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Total analisado: ${resumo.totalAnalisado}`);
  console.log(`  Saneáveis automaticamente: ${resumo.saneavel_automaticamente_por_diacritico}`);
  console.log(`  Divergência material: ${resumo.divergencia_material}`);
  console.log(`  Histórico não reapresentado: ${resumo.historico_nao_reapresentado_sem_correspondencia}`);
  console.log(`  Dados insuficientes: ${resumo.dados_insuficientes}`);
  console.log(`  Já decidido: ${resumo.ja_decidido}`);
}

try {
  executar();
} catch (erro) {
  console.error("Erro na auditoria de diacríticos:", erro);
  process.exit(1);
}
