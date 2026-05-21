/**
 * Auditoria dry-run de itens ausentes com substituto provável no PAD —
 * PROFOR 2022.
 *
 * Para cada divergência `item_ausente_no_pad` PENDENTE/EM_REVISAO sem decisão
 * resolutiva, busca um item novo correspondente no PAD (item_novo_sem_rateio,
 * item_pad_sem_rateio, etc.) com dados materiais e financeiros compatíveis.
 *
 * NÃO altera o banco, NÃO publica, NÃO aplica decisão e NÃO confirma ausência.
 * Gera relatórios em backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.{json,md}.
 *
 * Comando: npm run profor:pad:ausentes:auditar-substitutos
 */

const fs = require("node:fs");
const path = require("node:path");
const db = require("../db/database");
const {
  classificarAusenteComSubstituto,
} = require("../services/profor-2022/profor-pad-substituto-auditoria-service");

const SAIDA_JSON = "backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.md";

function parseJsonSeguro(texto) {
  try {
    return JSON.parse(texto || "{}");
  } catch {
    return {};
  }
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");

  // Todas as divergências da fila (com payload).
  const divergencias = db.prepare(`
    SELECT id, numero_convenio, uf, chave_item, tipo_alerta, nivel, status,
           campo_afetado, valor_anterior, valor_novo, payload_json
    FROM profor_2022_revisao_divergencias
  `).all();

  // Candidatos a substituto: itens do PAD (qualquer status — o vínculo pode
  // apontar para um item novo já aceito).
  const candidatos = divergencias.map((div) => ({
    divergencia: div,
    payload: parseJsonSeguro(div.payload_json),
  }));

  const ausentes = divergencias.filter((div) => div.tipo_alerta === "item_ausente_no_pad");

  const analisados = [];
  const resumo = {
    totalAusentesAnalisados: ausentes.length,
    substituto_compativel: 0,
    possivel_substituto_com_divergencia: 0,
    ausencia_real_sem_substituto: 0,
    dados_insuficientes: 0,
    ja_decidido: 0,
  };
  const vinculosSugeridos = [];

  for (const div of ausentes) {
    const payload = parseJsonSeguro(div.payload_json);
    const { classificacao, motivo, substituto } = classificarAusenteComSubstituto(div, payload, candidatos);

    resumo[classificacao] = (resumo[classificacao] || 0) + 1;
    if (classificacao === "substituto_compativel" && substituto) {
      vinculosSugeridos.push({
        divergenciaAusenteId: div.id,
        divergenciaSubstitutaId: substituto.divergenciaSubstitutaId,
        descricaoMemoria: payload.descricaoMemoria || div.valor_anterior,
        descricaoPadSubstituta: substituto.descricaoPadSubstituta,
        decisaoSubstitutaJaAceita: substituto.decisaoSubstitutaJaAceita,
      });
    }

    analisados.push({
      id: div.id,
      numeroConvenio: div.numero_convenio,
      uf: div.uf,
      chaveItem: div.chave_item,
      status: div.status,
      descricaoMemoria: payload.descricaoMemoria || div.valor_anterior,
      classificacao,
      motivo,
      substituto: substituto || null,
    });
  }

  const jsonReport = {
    resumo: {
      geradoEm: new Date().toISOString(),
      modo: "dry-run",
      ...resumo,
    },
    vinculosSugeridos,
    analisados,
  };

  fs.mkdirSync(path.dirname(path.join(repoRoot, SAIDA_JSON)), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, SAIDA_JSON), JSON.stringify(jsonReport, null, 2), "utf8");

  let md = `# Auditoria de itens ausentes com substituto provável no PAD — PROFOR 2022 (dry-run)\n\n`;
  md += `*Gerado em:* ${new Date().toLocaleString("pt-BR")}\n\n`;
  md += `Auditoria somente leitura: não altera o banco, não publica, não confirma ausência.\n\n`;
  md += `## Resumo estatístico\n\n`;
  md += `| Classificação | Quantidade |\n| :--- | :---: |\n`;
  md += `| **Substituto compatível** | ${resumo.substituto_compativel} |\n`;
  md += `| Possível substituto com divergência | ${resumo.possivel_substituto_com_divergencia} |\n`;
  md += `| Ausência real sem substituto | ${resumo.ausencia_real_sem_substituto} |\n`;
  md += `| Dados insuficientes | ${resumo.dados_insuficientes} |\n`;
  md += `| Já decidido | ${resumo.ja_decidido} |\n`;
  md += `| **Total de ausentes analisados** | **${resumo.totalAusentesAnalisados}** |\n\n`;
  md += `## Vínculos sugeridos (ausente → substituto)\n\n`;
  if (vinculosSugeridos.length > 0) {
    md += `| Ausente | Substituto | Descrição memória | Descrição PAD | Substituto já aceito? |\n`;
    md += `| :--- | :--- | :--- | :--- | :---: |\n`;
    for (const v of vinculosSugeridos) {
      md += `| #${v.divergenciaAusenteId} | #${v.divergenciaSubstitutaId} | ${v.descricaoMemoria} | ${v.descricaoPadSubstituta} | ${v.decisaoSubstitutaJaAceita ? "sim" : "não"} |\n`;
    }
    md += `\n`;
  } else {
    md += `Nenhum vínculo sugerido nesta execução.\n\n`;
  }
  md += `## Detalhe por divergência ausente\n\n`;
  md += `| ID | Convênio | Status | Classificação | Substituto | Motivo |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const item of analisados) {
    const sub = item.substituto ? `#${item.substituto.divergenciaSubstitutaId}` : "—";
    md += `| #${item.id} | ${item.numeroConvenio} | \`${item.status}\` | **${item.classificacao}** | ${sub} | ${item.motivo} |\n`;
  }
  fs.writeFileSync(path.join(repoRoot, SAIDA_MD), md, "utf8");

  console.log("Auditoria de ausentes com substituto concluída (dry-run).");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Total de ausentes analisados: ${resumo.totalAusentesAnalisados}`);
  console.log(`  Substituto compatível: ${resumo.substituto_compativel}`);
  console.log(`  Possível substituto com divergência: ${resumo.possivel_substituto_com_divergencia}`);
  console.log(`  Ausência real sem substituto: ${resumo.ausencia_real_sem_substituto}`);
  console.log(`  Dados insuficientes: ${resumo.dados_insuficientes}`);
  console.log(`  Já decidido: ${resumo.ja_decidido}`);
  for (const v of vinculosSugeridos) {
    console.log(`  Vínculo: #${v.divergenciaAusenteId} -> #${v.divergenciaSubstitutaId}`);
  }
}

try {
  executar();
} catch (erro) {
  console.error("Erro na auditoria de ausentes com substituto:", erro);
  process.exit(1);
}
