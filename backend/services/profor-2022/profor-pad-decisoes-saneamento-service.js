const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const {
  normalizarNumeroConvenio,
  normalizarTextoProfor,
} = require("./profor-plano-aplicacao-service");
const {
  CAMINHO_DECISOES_PADRAO,
  VERSAO_ESQUEMA_DECISOES,
  DECISAO_PENDENTE,
} = require("./profor-pad-saneamento-service");

const CAMINHO_RATEIOS_DRY_RUN_PADRAO = "backend/data/relatorios/profor-2022-pad-rateios-dry-run.json";

// Áreas válidas para rateio. Exportado para reuso na Etapa E.
const AREAS_VALIDAS = ["OUVIDORIA", "CORREGEDORIA", "ESCOLA PENAL", "N/A"];

// Tolerância para a soma de percentuais de rateio (centavos / arredondamento).
const TOLERANCIA_PERCENTUAL = 0.01;

// Regex que identifica descrições de saldo residual/remanescente.
const REGEX_SALDO_RESIDUAL = /\bSALDO\s+(RESIDUAL|REMANESCENTE)\b/;

const SECOES_DECISAO = [
  "equivalenciasConfirmadas",
  "rateiosNovos",
  "correcoesItensNaoAptos",
  "ausenciasValidadas",
  "substituicoes",
];

function repoRootPadrao() {
  return path.resolve(__dirname, "../../..");
}

function lerJson(caminhoAbsoluto) {
  return JSON.parse(fs.readFileSync(caminhoAbsoluto, "utf8"));
}

function garantirArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function textoPreenchido(valor) {
  return typeof valor === "string" && valor.trim().length > 0;
}

function ehDecisao(decisao) {
  return textoPreenchido(decisao) && decisao.trim().toUpperCase() !== DECISAO_PENDENTE;
}

function problema({ secao, id, codigo, nivel, mensagem }) {
  return { secao, id: id ?? null, codigo, nivel, mensagem };
}

/** Carrega o arquivo de decisões e valida o esquema básico. */
function carregarDecisoesSaneamento(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || repoRootPadrao();
  const caminhoRelativo = opcoes.caminhoDecisoes || CAMINHO_DECISOES_PADRAO;
  const caminhoAbsoluto = path.isAbsolute(caminhoRelativo)
    ? caminhoRelativo
    : path.join(repoRoot, caminhoRelativo);

  if (!fs.existsSync(caminhoAbsoluto)) {
    throw new Error(
      `Arquivo de decisões não encontrado: ${caminhoAbsoluto}. ` +
      "Execute 'npm run profor:pad:gerar-template-decisoes-saneamento' antes."
    );
  }

  const dados = lerJson(caminhoAbsoluto);
  if (!dados || typeof dados !== "object") {
    throw new Error("Arquivo de decisões inválido: conteúdo ausente.");
  }
  const versao = dados?.metadados?.versaoEsquema;
  if (versao !== VERSAO_ESQUEMA_DECISOES) {
    throw new Error(
      `Versão de esquema incompatível no arquivo de decisões (esperado ${VERSAO_ESQUEMA_DECISOES}, ` +
      `encontrado ${versao}). Regenere o template.`
    );
  }
  for (const secao of [...SECOES_DECISAO, "observacoes"]) {
    if (!Array.isArray(dados[secao])) {
      throw new Error(`Arquivo de decisões inválido: '${secao}' deve ser um array.`);
    }
  }

  return { repoRoot, caminhoRelativo, caminhoAbsoluto, dados };
}

/** Carrega o contexto de validação: carteira, itens conhecidos e itens PAD atuais. */
function carregarContextoValidacao(repoRoot, opcoes = {}) {
  const conveniosCarteira = new Set(
    db.prepare("SELECT numero_convenio FROM profor_convenios_monitorados WHERE ativo = 1")
      .all()
      .map((linha) => normalizarNumeroConvenio(linha.numero_convenio))
      .filter(Boolean)
  );

  const itensConhecidosPorId = new Map(
    db.prepare("SELECT id, chave_item, ativo FROM profor_2022_itens_conhecidos")
      .all()
      .map((linha) => [Number(linha.id), linha])
  );

  const caminhoRateios = path.join(
    repoRoot,
    opcoes.caminhoRateiosDryRun || CAMINHO_RATEIOS_DRY_RUN_PADRAO
  );
  const itensPadPorChave = new Set();
  let fonteRateios = null;
  if (fs.existsSync(caminhoRateios)) {
    const rateios = lerJson(caminhoRateios);
    fonteRateios = opcoes.caminhoRateiosDryRun || CAMINHO_RATEIOS_DRY_RUN_PADRAO;
    const todos = [
      ...garantirArray(rateios.itensPadReconhecidos),
      ...garantirArray(rateios.itensPadSemRateio),
    ];
    for (const item of todos) {
      if (item.chaveItem) itensPadPorChave.add(String(item.chaveItem).trim());
      if (item.chaveDescricaoOriginal) itensPadPorChave.add(String(item.chaveDescricaoOriginal).trim());
    }
  }

  return { conveniosCarteira, itensConhecidosPorId, itensPadPorChave, fonteRateios };
}

/* ----------------------------- validadores ----------------------------- */

function validarConveniosNaCarteira(dados, ctx) {
  const problemas = [];
  for (const secao of SECOES_DECISAO) {
    for (const entrada of garantirArray(dados[secao])) {
      const numero = normalizarNumeroConvenio(entrada.numeroConvenio);
      if (!numero) continue;
      if (!ctx.conveniosCarteira.has(numero)) {
        problemas.push(problema({
          secao, id: entrada.id, codigo: "convenio_fora_da_carteira", nivel: "erro",
          mensagem: `Convênio ${entrada.numeroConvenio} não está na carteira monitorada ativa.`,
        }));
      }
    }
  }
  return problemas;
}

function validarItensPadExistem(dados, ctx) {
  const problemas = [];
  if (!ctx.fonteRateios) {
    problemas.push(problema({
      secao: "metadados", id: null, codigo: "relatorio_pad_ausente", nivel: "aviso",
      mensagem: "Relatório PAD atual não encontrado; a existência dos itens PAD não pôde ser verificada.",
    }));
    return problemas;
  }
  // rateiosNovos e substituicoes citam itens PAD.
  for (const entrada of garantirArray(dados.rateiosNovos)) {
    if (!ctx.itensPadPorChave.has(String(entrada.id || "").trim())) {
      problemas.push(problema({
        secao: "rateiosNovos", id: entrada.id, codigo: "item_pad_inexistente", nivel: "erro",
        mensagem: `Item PAD '${entrada.id}' não existe no relatório PAD atual (${ctx.fonteRateios}).`,
      }));
    }
  }
  return problemas;
}

function validarSubstituicoesReferenciamItemPad(dados, ctx) {
  const problemas = [];
  for (const entrada of garantirArray(dados.substituicoes)) {
    if (!ehDecisao(entrada.decisao) && !textoPreenchido(entrada.descricaoItemPadNovo)) continue;
    const ref = String(entrada.idItemPadNovo || entrada.descricaoItemPadNovo || "").trim();
    if (ctx.fonteRateios && ref && entrada.idItemPadNovo
      && !ctx.itensPadPorChave.has(ref)) {
      problemas.push(problema({
        secao: "substituicoes", id: entrada.id, codigo: "substituicao_item_pad_inexistente", nivel: "erro",
        mensagem: `Substituição referencia item PAD '${ref}' que não existe no relatório PAD atual.`,
      }));
    }
  }
  return problemas;
}

function validarItensConhecidosExistem(dados, ctx) {
  const problemas = [];
  const checar = (secao, entrada, campo) => {
    const id = entrada[campo];
    if (id === null || id === undefined) return;
    if (!ctx.itensConhecidosPorId.has(Number(id))) {
      problemas.push(problema({
        secao, id: entrada.id, codigo: "item_conhecido_inexistente", nivel: "erro",
        mensagem: `Campo ${campo}=${id} não corresponde a nenhum item em profor_2022_itens_conhecidos.`,
      }));
    }
  };
  for (const entrada of garantirArray(dados.equivalenciasConfirmadas)) {
    checar("equivalenciasConfirmadas", entrada, "itemConhecidoNormalizadoId");
  }
  for (const entrada of garantirArray(dados.correcoesItensNaoAptos)) {
    checar("correcoesItensNaoAptos", entrada, "itemConhecidoId");
  }
  for (const entrada of garantirArray(dados.ausenciasValidadas)) {
    checar("ausenciasValidadas", entrada, "itemConhecidoId");
  }
  return problemas;
}

function validarJustificativas(dados) {
  const problemas = [];
  for (const secao of SECOES_DECISAO) {
    for (const entrada of garantirArray(dados[secao])) {
      if (ehDecisao(entrada.decisao) && !textoPreenchido(entrada.justificativa)) {
        problemas.push(problema({
          secao, id: entrada.id, codigo: "justificativa_ausente", nivel: "erro",
          mensagem: `Decisão '${entrada.decisao}' sem justificativa. Toda decisão exige justificativa.`,
        }));
      }
    }
  }
  return problemas;
}

function somarRateio(rateio, campo) {
  return garantirArray(rateio).reduce((soma, linha) => soma + (Number(linha?.[campo]) || 0), 0);
}

function validarSomaRateios(dados) {
  const problemas = [];
  const checar = (secao, entrada, rateio) => {
    if (!ehDecisao(entrada.decisao)) return;
    const linhas = garantirArray(rateio);
    if (!linhas.length) {
      problemas.push(problema({
        secao, id: entrada.id, codigo: "rateio_vazio", nivel: "erro",
        mensagem: "Decisão de rateio sem nenhuma linha de rateio.",
      }));
      return;
    }
    const somaQtd = somarRateio(linhas, "percentualQuantidade");
    const somaValor = somarRateio(linhas, "percentualValor");
    if (Math.abs(somaQtd - 100) > TOLERANCIA_PERCENTUAL) {
      problemas.push(problema({
        secao, id: entrada.id, codigo: "soma_percentual_quantidade_invalida", nivel: "erro",
        mensagem: `Soma de percentualQuantidade = ${somaQtd} (esperado 100).`,
      }));
    }
    if (Math.abs(somaValor - 100) > TOLERANCIA_PERCENTUAL) {
      problemas.push(problema({
        secao, id: entrada.id, codigo: "soma_percentual_valor_invalida", nivel: "erro",
        mensagem: `Soma de percentualValor = ${somaValor} (esperado 100).`,
      }));
    }
  };
  for (const entrada of garantirArray(dados.rateiosNovos)) {
    checar("rateiosNovos", entrada, entrada.rateio);
  }
  for (const entrada of garantirArray(dados.correcoesItensNaoAptos)) {
    if (entrada.acao === "corrigir_rateio" || garantirArray(entrada.rateiosCorrigidos).length) {
      checar("correcoesItensNaoAptos", entrada, entrada.rateiosCorrigidos);
    }
  }
  for (const entrada of garantirArray(dados.substituicoes)) {
    if (garantirArray(entrada.rateioNovo).length) {
      checar("substituicoes", entrada, entrada.rateioNovo);
    }
  }
  return problemas;
}

function validarAreas(dados) {
  const problemas = [];
  const checar = (secao, entrada, rateio) => {
    for (const linha of garantirArray(rateio)) {
      const area = String(linha?.area || "").trim().toUpperCase();
      if (area && !AREAS_VALIDAS.includes(area)) {
        problemas.push(problema({
          secao, id: entrada.id, codigo: "area_invalida", nivel: "erro",
          mensagem: `Área '${linha.area}' não é válida. Áreas aceitas: ${AREAS_VALIDAS.join(", ")}.`,
        }));
      }
    }
  };
  for (const entrada of garantirArray(dados.rateiosNovos)) checar("rateiosNovos", entrada, entrada.rateio);
  for (const entrada of garantirArray(dados.correcoesItensNaoAptos)) {
    checar("correcoesItensNaoAptos", entrada, entrada.rateiosCorrigidos);
  }
  for (const entrada of garantirArray(dados.substituicoes)) checar("substituicoes", entrada, entrada.rateioNovo);
  return problemas;
}

function validarDecisoesIncompativeis(dados) {
  const problemas = [];
  // Mapeia cada id para as seções em que aparece com decisão tomada.
  const porId = new Map();
  for (const secao of SECOES_DECISAO) {
    for (const entrada of garantirArray(dados[secao])) {
      if (!ehDecisao(entrada.decisao)) continue;
      const id = String(entrada.id ?? "");
      if (!porId.has(id)) porId.set(id, new Set());
      porId.get(id).add(secao);
    }
  }
  for (const [id, secoes] of porId) {
    if (secoes.size > 1) {
      problemas.push(problema({
        secao: [...secoes].join("+"), id, codigo: "decisoes_incompativeis", nivel: "erro",
        mensagem: `Item '${id}' possui decisões em múltiplas seções: ${[...secoes].join(", ")}.`,
      }));
    }
  }
  // Exclusão + substituição no mesmo item dentro de ausenciasValidadas.
  for (const entrada of garantirArray(dados.ausenciasValidadas)) {
    const acao = String(entrada.acao || "").trim();
    if (acao === "confirmar_exclusao" && textoPreenchido(entrada.descricaoItemPadSubstituto)) {
      problemas.push(problema({
        secao: "ausenciasValidadas", id: entrada.id, codigo: "exclusao_com_substituicao", nivel: "erro",
        mensagem: "Item marcado como exclusão não pode ter item PAD substituto preenchido.",
      }));
    }
  }
  return problemas;
}

function validarLiberacaoNaoAptos(dados) {
  const problemas = [];
  for (const entrada of garantirArray(dados.correcoesItensNaoAptos)) {
    const acao = String(entrada.acao || "").trim();
    if (acao === "liberar_apos_validacao" && !textoPreenchido(entrada.justificativa)) {
      problemas.push(problema({
        secao: "correcoesItensNaoAptos", id: entrada.id, codigo: "liberacao_sem_justificativa", nivel: "erro",
        mensagem: "Item não apto só pode ser liberado com justificativa e decisão expressa.",
      }));
    }
  }
  return problemas;
}

function validarDescricoesResiduais(dados) {
  const problemas = [];
  const checar = (secao, entrada, descricao) => {
    if (!ehDecisao(entrada.decisao)) return;
    if (REGEX_SALDO_RESIDUAL.test(normalizarTextoProfor(descricao))
      && !textoPreenchido(entrada.justificativa)) {
      problemas.push(problema({
        secao, id: entrada.id, codigo: "saldo_residual_sem_justificativa", nivel: "erro",
        mensagem: "Item de saldo residual/remanescente exige justificativa específica.",
      }));
    }
  };
  for (const entrada of garantirArray(dados.rateiosNovos)) checar("rateiosNovos", entrada, entrada.descricaoPad);
  for (const entrada of garantirArray(dados.equivalenciasConfirmadas)) {
    checar("equivalenciasConfirmadas", entrada, entrada.descricaoPad);
  }
  for (const entrada of garantirArray(dados.ausenciasValidadas)) {
    checar("ausenciasValidadas", entrada, entrada.descricaoItemConhecido);
  }
  return problemas;
}

/** Lista as entradas ainda PENDENTES por seção. */
function listarPendentes(dados) {
  const pendentes = [];
  for (const secao of SECOES_DECISAO) {
    for (const entrada of garantirArray(dados[secao])) {
      if (!ehDecisao(entrada.decisao)) {
        pendentes.push({ secao, id: entrada.id ?? null });
      }
    }
  }
  return pendentes;
}

/** Orquestra todas as regras de validação do arquivo de decisões. */
function validarDecisoesSaneamento(opcoes = {}) {
  const carregado = carregarDecisoesSaneamento(opcoes);
  const { dados, repoRoot, caminhoRelativo } = carregado;
  const ctx = carregarContextoValidacao(repoRoot, opcoes);

  const problemas = [
    ...validarConveniosNaCarteira(dados, ctx),
    ...validarItensPadExistem(dados, ctx),
    ...validarSubstituicoesReferenciamItemPad(dados, ctx),
    ...validarItensConhecidosExistem(dados, ctx),
    ...validarJustificativas(dados),
    ...validarSomaRateios(dados),
    ...validarAreas(dados),
    ...validarDecisoesIncompativeis(dados),
    ...validarLiberacaoNaoAptos(dados),
    ...validarDescricoesResiduais(dados),
  ];

  const erros = problemas.filter((p) => p.nivel === "erro");
  const avisos = problemas.filter((p) => p.nivel === "aviso");
  const pendentes = listarPendentes(dados);

  const resumo = {
    geradoEm: new Date().toISOString(),
    fonteDecisoes: caminhoRelativo,
    fonteRelatorioPad: ctx.fonteRateios,
    totalErros: erros.length,
    totalAvisos: avisos.length,
    totalPendentes: pendentes.length,
    arquivoValido: erros.length === 0,
    aplicavel: erros.length === 0 && pendentes.length === 0,
  };

  return { resumo, erros, avisos, pendentes };
}

/** Persiste o relatório de validação em JSON. */
function salvarRelatorioValidacao(relatorio, caminhoAbsoluto) {
  fs.mkdirSync(path.dirname(caminhoAbsoluto), { recursive: true });
  fs.writeFileSync(caminhoAbsoluto, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
}

module.exports = {
  AREAS_VALIDAS,
  TOLERANCIA_PERCENTUAL,
  CAMINHO_RATEIOS_DRY_RUN_PADRAO,
  carregarDecisoesSaneamento,
  carregarContextoValidacao,
  validarDecisoesSaneamento,
  salvarRelatorioValidacao,
};
