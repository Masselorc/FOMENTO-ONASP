// ============================================================================
// Serviço de dados
// ----------------------------------------------------------------------------
// Este módulo é a fronteira entre os arquivos de dados (JSON e planilhas XLSX)
// e o restante da aplicação. A UI não deve conhecer detalhes como nomes de abas,
// posições de colunas ou regras de validação; ela consome os objetos já
// normalizados exportados daqui.
// ============================================================================

const JSON_APLICACAO_URL = new URL('../data/aplicacao.json', import.meta.url);
// Versão única dos dados: evita que HTML/JS atualizados leiam planilhas antigas em cache.
const VERSAO_DADOS = '20260505-1';
const ABA_RESUMO_CONVENIOS = 'Geral';
const ARQUIVO_PLANILHA_ORCAMENTO = 'Planilhas/orcamento_onasp.xlsx';
const ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR = 'Planilhas/Planilha_Formalizacao_PROFOR_2026.xlsx';
const ARQUIVO_PLANILHA_CONTATOS = 'Planilhas/Contatos.xlsx';
const ARQUIVO_PLANILHA_DIAGNOSTICO = 'Planilhas/Diagnostico.xlsx';
const ABA_ORCAMENTO_DADOS = 'Base_Dados';
const ABA_ORCAMENTO_PROCESSOS_NORMAIS = 'Processos_Normais';
const ABA_ORCAMENTO_PROFOR = 'Andamento_CONV_PROFOR';
const ABA_FORMALIZACAO_PAINEL = 'Painel_Propostas';
const ABA_FORMALIZACAO_CHECKLIST = 'Checklist_Documentos';
const ABA_FORMALIZACAO_DICIONARIO = 'Dicionario_Documentos';
const ABA_CONTATOS_UF = 'Contatos_UF';
const ABA_CONTATOS_PESSOAS = 'Contatos_Pessoas';
const ABAS_DIAGNOSTICO_OUVIDORIAS = ['Diagnostico', 'Diagnóstico', 'Respostas', 'Sheet1'];
const ABAS_ORCAMENTO_IGNORADAS = new Set(['DICIONARIO_CAMPOS', 'RESUMO']);
const COLUNA_VALOR_OUVIDORIA_GERAL = 18; // Coluna S
const TOLERANCIA_VALIDACAO_CENTAVOS = 1;
const UFS_FORMALIZACAO_PROFOR = ['AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MG', 'PA', 'PE', 'RN', 'RR', 'RS', 'SE'];
const UFS_CONDICAO_SUSPENSIVA_PROFOR = new Set(['PA', 'RR', 'RS', 'SE']);
const VALOR_REPASSE_PROFOR = 200000;
const STATUS_CHECKLIST_DIAGNOSTICO = {
    CONFORME: 'Conforme',
    PARCIAL: 'Parcialmente conforme',
    NAO_CONFORME: 'Não conforme',
    NAO_INFORMADO: 'Não informado',
    PENDENTE_VALIDACAO: 'Pendente de validação ONASP'
};
const VALIDACOES_ONASP_DIAGNOSTICO = ['Validado', 'Pendente', 'Inconsistente', 'Não se aplica'];
const TODAS_UFS_BRASIL = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// O checklist abaixo é propositalmente fechado: só contém parâmetros previstos
// no manual normativo informado e ainda será filtrado pelas colunas realmente
// existentes em Diagnostico.xlsx. Assim evitamos extrapolação normativa.
const PARAMETROS_DIAGNOSTICO_ONASP = [
    { id: 'FORM_001', eixo: 'Formalização', nome: 'Existência de ato normativo específico da Ouvidoria de Serviços Penais ou núcleo especializado', fundamentoIn: 'Art. 5º, caput', perguntas: ['M1-11', 'M1-14', 'M1-15'], essencial: true, requerValidacao: true, providencia: 'Apresentar ato normativo específico publicado', prioridade: 'Alta' },
    { id: 'FORM_002', eixo: 'Formalização', nome: 'Conteúdo mínimo do ato de criação', fundamentoIn: 'Art. 5º, §1º, I a IV', perguntas: ['M1-12'], requerValidacao: true, providencia: 'Comprovar que o ato de criação contempla o conteúdo mínimo previsto na IN', prioridade: 'Alta' },
    { id: 'FORM_003', eixo: 'Formalização', nome: 'Públicos atendidos pela Ouvidoria de Serviços Penais', fundamentoIn: 'Art. 4º, III; art. 10, I', perguntas: ['M1-13'], providencia: 'Detalhar os públicos atendidos pela Ouvidoria de Serviços Penais', prioridade: 'Média' },
    { id: 'FORM_004', eixo: 'Formalização', nome: 'Vinculação institucional da Ouvidoria', fundamentoIn: 'Art. 5º, §1º, I; art. 5º, §3º', perguntas: ['M3-56'], essencial: true, requerValidacao: true, providencia: 'Comprovar a vinculação institucional da Ouvidoria', prioridade: 'Alta' },
    { id: 'FORM_005', eixo: 'Formalização', nome: 'Autonomia técnica e funcional', fundamentoIn: 'Art. 4º, I; art. 5º, §3º', perguntas: ['M1-12', 'M3-56'], essencial: true, requerValidacao: true, providencia: 'Comprovar autonomia técnica e funcional da Ouvidoria', prioridade: 'Alta' },
    { id: 'EQUIPE_006', eixo: 'Ouvidor e equipe', nome: 'Existência/designação formal do ouvidor ou responsável', fundamentoIn: 'Art. 8º, caput', perguntas: ['M0-06', 'M0-07', 'M3-57'], essencial: true, requerValidacao: true, providencia: 'Comprovar designação formal do ouvidor ou responsável', prioridade: 'Alta' },
    { id: 'EQUIPE_007', eixo: 'Ouvidor e equipe', nome: 'Mandato do ouvidor, quando houver', fundamentoIn: 'Art. 5º, §2º; art. 8º, §2º', perguntas: ['M0-08'], requerValidacao: true, providencia: 'Informar ou comprovar o mandato do ouvidor, quando aplicável', prioridade: 'Média' },
    { id: 'EQUIPE_008', eixo: 'Ouvidor e equipe', nome: 'Requisitos de perfil do ouvidor', fundamentoIn: 'Art. 8º, §1º', perguntas: ['M3-58'], providencia: 'Comprovar atendimento aos requisitos de perfil do ouvidor', prioridade: 'Média' },
    { id: 'EQUIPE_009', eixo: 'Ouvidor e equipe', nome: 'Existência de equipe própria', fundamentoIn: 'Art. 9º, caput', perguntas: ['M3-59'], essencial: true, providencia: 'Instituir ou comprovar equipe própria da Ouvidoria', prioridade: 'Alta' },
    { id: 'EQUIPE_010', eixo: 'Ouvidor e equipe', nome: 'Dedicação da equipe à Ouvidoria', fundamentoIn: 'Art. 9º, caput', perguntas: ['M3-60'], providencia: 'Comprovar dedicação da equipe às atividades da Ouvidoria', prioridade: 'Média' },
    { id: 'EQUIPE_011', eixo: 'Ouvidor e equipe', nome: 'Perfil técnico da equipe', fundamentoIn: 'Art. 9º, caput', perguntas: ['M3-61'], providencia: 'Comprovar perfil técnico adequado da equipe', prioridade: 'Média' },
    { id: 'EQUIPE_012', eixo: 'Ouvidor e equipe', nome: 'Capacitação específica da equipe', fundamentoIn: 'Art. 7º, X; art. 9º, §1º', perguntas: ['M3-62'], providencia: 'Promover ou comprovar capacitação específica da equipe', prioridade: 'Média' },
    { id: 'EQUIPE_013', eixo: 'Ouvidor e equipe', nome: 'Compromisso de sigilo da equipe', fundamentoIn: 'Art. 4º, II; art. 9º, §2º; art. 10, III', perguntas: ['M3-63'], essencial: true, requerValidacao: true, providencia: 'Comprovar compromisso de sigilo da equipe', prioridade: 'Alta' },
    { id: 'ESTRUTURA_014', eixo: 'Estrutura física e tecnológica', nome: 'Espaço físico adequado/reservado', fundamentoIn: 'Art. 6º, §1º, I; art. 7º, VII', perguntas: ['M2-16'], essencial: true, providencia: 'Adequar ou comprovar espaço físico reservado para atendimento', prioridade: 'Alta' },
    { id: 'ESTRUTURA_015', eixo: 'Estrutura física e tecnológica', nome: 'Computadores com acesso à internet', fundamentoIn: 'Art. 7º, I', perguntas: ['M2-17', 'M2-18'], providencia: 'Comprovar disponibilidade de computadores com acesso à internet', prioridade: 'Alta' },
    { id: 'ESTRUTURA_016', eixo: 'Estrutura física e tecnológica', nome: 'Impressora multifuncional', fundamentoIn: 'Art. 7º, II', perguntas: ['M2-19', 'M2-20'], providencia: 'Comprovar disponibilidade de impressora multifuncional', prioridade: 'Média' },
    { id: 'ESTRUTURA_017', eixo: 'Estrutura física e tecnológica', nome: 'Mobiliário/estações de trabalho', fundamentoIn: 'Art. 7º, III', perguntas: ['M2-29', 'M2-30'], providencia: 'Comprovar mobiliário e estações de trabalho suficientes', prioridade: 'Média' },
    { id: 'ESTRUTURA_018', eixo: 'Estrutura física e tecnológica', nome: 'Armários/arquivos para guarda de documentos sigilosos', fundamentoIn: 'Art. 7º, III; art. 4º, II', perguntas: ['M2-31', 'M2-32'], providencia: 'Comprovar guarda adequada de documentos sigilosos', prioridade: 'Alta' },
    { id: 'ESTRUTURA_019', eixo: 'Estrutura física e tecnológica', nome: 'Licenças de suíte de edição de texto, planilhas e apresentações', fundamentoIn: 'Art. 7º, VIII', perguntas: ['M2-33', 'M2-34'], providencia: 'Comprovar licenças de software necessárias à rotina da Ouvidoria', prioridade: 'Média' },
    { id: 'ESTRUTURA_020', eixo: 'Estrutura física e tecnológica', nome: 'Recursos de segurança da informação', fundamentoIn: 'Art. 7º, V; art. 13, parágrafo único', perguntas: ['M2-37'], requerValidacao: true, providencia: 'Comprovar recursos de segurança da informação', prioridade: 'Alta' },
    { id: 'ESTRUTURA_021', eixo: 'Estrutura física e tecnológica', nome: 'Placas/cartazes de divulgação dos canais', fundamentoIn: 'Art. 4º, IV; art. 7º, VI', perguntas: ['M2-35'], providencia: 'Comprovar divulgação visual dos canais de Ouvidoria', prioridade: 'Média' },
    { id: 'ESTRUTURA_022', eixo: 'Estrutura física e tecnológica', nome: 'Materiais adicionais de divulgação e educação em direitos', fundamentoIn: 'Art. 4º, IV; art. 7º, VI', perguntas: ['M2-36'], providencia: 'Comprovar materiais de divulgação e educação em direitos', prioridade: 'Média' },
    { id: 'CANAIS_023', eixo: 'Canais institucionais', nome: 'E-mail institucional exclusivo', fundamentoIn: 'Art. 6º, §2º, I', perguntas: ['M2-41', 'M2-42'], providencia: 'Instituir ou comprovar e-mail institucional exclusivo', prioridade: 'Alta' },
    { id: 'CANAIS_024', eixo: 'Canais institucionais', nome: 'Linha telefônica funcional', fundamentoIn: 'Art. 6º, §2º, II; art. 7º, IV', perguntas: ['M2-43', 'M2-44'], providencia: 'Instituir ou comprovar linha telefônica funcional', prioridade: 'Média' },
    { id: 'CANAIS_025', eixo: 'Canais institucionais', nome: 'Formulário eletrônico, sistema ou canal eletrônico de registro', fundamentoIn: 'Art. 6º, §2º, III; art. 6º, §3º', perguntas: ['M2-45', 'M2-49', 'M2-52'], essencial: true, requerValidacao: true, providencia: 'Inserir ou comprovar canal eletrônico de registro', prioridade: 'Alta' },
    { id: 'CANAIS_026', eixo: 'Canais institucionais', nome: 'Uso da Plataforma Fala.BR', fundamentoIn: 'Art. 4º, V; art. 6º, §2º, III; art. 6º, §3º', perguntas: ['M2-46'], requerValidacao: true, providencia: 'Comprovar uso da Plataforma Fala.BR ou saneamento do canal institucional', prioridade: 'Alta' },
    { id: 'CANAIS_027', eixo: 'Canais institucionais', nome: 'Endereço postal para recebimento de correspondência', fundamentoIn: 'Art. 6º, §2º, IV', perguntas: ['M2-47', 'M2-48'], providencia: 'Comprovar endereço postal para recebimento de correspondência', prioridade: 'Média' },
    { id: 'FLUXO_028', eixo: 'Fluxo de manifestações', nome: 'Tipos de manifestações tratados', fundamentoIn: 'Art. 10, I', perguntas: ['M4-65'], providencia: 'Detalhar os tipos de manifestações tratados pela Ouvidoria', prioridade: 'Média' },
    { id: 'FLUXO_029', eixo: 'Fluxo de manifestações', nome: 'Registro, protocolo e classificação das manifestações', fundamentoIn: 'Art. 11; art. 6º, §3º', perguntas: ['M4-66'], essencial: true, requerValidacao: true, providencia: 'Comprovar rotina de registro, protocolo e classificação das manifestações', prioridade: 'Alta' },
    { id: 'FLUXO_030', eixo: 'Fluxo de manifestações', nome: 'Fluxo interno de trabalho', fundamentoIn: 'Art. 13, I a V', perguntas: ['M4-67'], essencial: true, requerValidacao: true, providencia: 'Comprovar fluxo interno de trabalho', prioridade: 'Alta' },
    { id: 'FLUXO_031', eixo: 'Fluxo de manifestações', nome: 'Prazos e qualidade das respostas', fundamentoIn: 'Art. 5º, §1º, IV; art. 10, II e IV', perguntas: ['M4-68'], providencia: 'Comprovar rotina de acompanhamento de prazos e qualidade das respostas', prioridade: 'Média' },
    { id: 'FLUXO_032', eixo: 'Fluxo de manifestações', nome: 'Tratamento sigiloso de denúncias ou manifestações sensíveis', fundamentoIn: 'Art. 4º, II; art. 10, III; art. 12, §2º; art. 13, parágrafo único', perguntas: ['M4-69'], essencial: true, requerValidacao: true, providencia: 'Comprovar rotina de sigilo e proteção das manifestações sensíveis', prioridade: 'Alta' },
    { id: 'FLUXO_033', eixo: 'Fluxo de manifestações', nome: 'Monitoramento, relatórios e melhoria da gestão', fundamentoIn: 'Art. 10, V e VI; art. 12, §3º', perguntas: ['M4-71'], providencia: 'Comprovar rotina de monitoramento, relatórios e melhoria da gestão', prioridade: 'Média' }
];

// Pares quantitativos usados apenas para déficit declarado. Eles não geram,
// por si só, descumprimento da IN; servem como insumo de planejamento.
const ITENS_DEFICIT_DIAGNOSTICO = [
    { item: 'Computadores', atual: ['M2-17'], ideal: ['M2-18'], fundamentoIn: 'Art. 7º, I', prioridade: 'Alta', providencia: 'Prever aquisição de computadores' },
    { item: 'Impressoras multifuncionais', atual: ['M2-19'], ideal: ['M2-20'], fundamentoIn: 'Art. 7º, II', prioridade: 'Média', providencia: 'Prever aquisição de impressora multifuncional' },
    { item: 'Mobiliário/estações de trabalho', atual: ['M2-29'], ideal: ['M2-30'], fundamentoIn: 'Art. 7º, III', prioridade: 'Média', providencia: 'Prever adequação de mobiliário e estações de trabalho' },
    { item: 'Armários/arquivos', atual: ['M2-31'], ideal: ['M2-32'], fundamentoIn: 'Art. 7º, III; art. 4º, II', prioridade: 'Alta', providencia: 'Prever armários ou arquivos para guarda de documentos' },
    { item: 'Licenças de software', atual: ['M2-33'], ideal: ['M2-34'], fundamentoIn: 'Art. 7º, VIII', prioridade: 'Média', providencia: 'Prever licenças de software necessárias' }
];
const COLUNAS_GERAL_PROFOR = {
    uf: 0,
    instrumento: 1,
    numero: 2,
    ano: 3,
    processoSei: 4,
    vencimento: 5,
    quantidadeTa: 6,
    solicitouProrrogacao: 7,
    valorGlobal: 8,
    valorRepasse: 9,
    valorContrapartida: 10,
    repasseDesembolsado: 11,
    rendimentoAprovado: 12,
    saldoRendimentosAtual: 13,
    saldoResidualCapital: 14,
    saldoResidualCusteio: 15,
    contrapartidaIntegralizada: 16,
    valorExecutadoGeral: 17,
    previstoOuvidoria: 18,
    previstoCorregedoria: 19,
    previstoEscolaPenal: 20,
    valorRelativoOuvidoria: 21,
    execucaoOuvidoriaPercentual: 22,
    execucaoCorregedoriaPercentual: 23,
    execucaoEscolaPenalPercentual: 24,
    saldoDisponivelOuvidoria: 25
};
const COLUNAS_PLANO_PROFOR = {
    uf: 0,
    instrumento: 1,
    numero: 2,
    ano: 3,
    area: 4,
    natureza: 5,
    descricao: 6,
    quantidade: 7,
    valorUnitario: 8,
    valorPrevisto: 9,
    valorExecutado: 10,
    saldo: 11,
    saldoEconomicidade: 12
};
const COLUNAS_CONVENIO = {
    uf: 0,
    classificacao: 4,
    objeto: 6,
    quantidade: 7,
    valorUnitario: 8,
    valorTotal: 9,
    valorExecutado: 10
};

let catalogoAplicacaoCache = null;
let dadosOrcamentoCache = null;
let dadosProfor2022Cache = null;
let dadosFaf2021Cache = null;
let dadosDoacoes2023Cache = null;
let dadosFormalizacaoProforCache = null;
let dadosContatosCache = null;
let dadosDiagnosticoOuvidoriasCache = null;

export function obterDadosOrcamento() {
    return dadosOrcamentoCache;
}

export function obterDadosProfor2022() {
    return dadosProfor2022Cache;
}

export function obterDadosFaf2021() {
    return dadosFaf2021Cache;
}

export function obterDadosDoacoes2023() {
    return dadosDoacoes2023Cache;
}

export function obterDadosFormalizacaoProfor() {
    return dadosFormalizacaoProforCache;
}

export function obterDadosContatos() {
    return dadosContatosCache;
}

export function obterDadosDiagnosticoOuvidorias() {
    return dadosDiagnosticoOuvidoriasCache;
}

// A biblioteca XLSX é carregada pelo index.html. Mantemos esta guarda para
// falhar cedo caso alguém remova o script CDN ou tente abrir a página sem ele.
function obterXlsxGlobal() {
    if (typeof window.XLSX === 'undefined') {
        throw new Error('A biblioteca de leitura da planilha nao foi carregada.');
    }

    return window.XLSX;
}

function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function limparTexto(valor) {
    return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

function converterNumeroPlanilha(valor) {
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    if (typeof valor !== 'string') {
        return 0;
    }

    const texto = valor.trim();
    if (!texto) {
        return 0;
    }

    const numeroNormalizado = texto
        .replace(/\s+/g, '')
        .replace(/^R\$/i, '')
        .replace(/%$/, '');

    if (numeroNormalizado.includes(',') && numeroNormalizado.includes('.')) {
        return Number.parseFloat(numeroNormalizado.replace(/\./g, '').replace(',', '.')) || 0;
    }

    if (numeroNormalizado.includes(',')) {
        return Number.parseFloat(numeroNormalizado.replace(',', '.')) || 0;
    }

    return Number.parseFloat(numeroNormalizado) || 0;
}

function arredondarMoeda(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function moedaParaCentavos(valor) {
    return Math.round((Number(valor) || 0) * 100);
}

function centavosParaMoeda(centavos) {
    return centavos / 100;
}

function obterNomeEstadoCatalogo(catalogoAplicacao, uf) {
    return catalogoAplicacao?.nomesEstados?.[uf] || uf || '';
}

function normalizarItemBaseFomento(item, catalogoAplicacao) {
    const valorTotal = arredondarMoeda(converterNumeroPlanilha(item.valorTotal));
    const valorExecutado = arredondarMoeda(converterNumeroPlanilha(item.valorExecutado));
    const uf = normalizarTexto(item.uf);

    return {
        uf,
        nomeEstado: obterNomeEstadoCatalogo(catalogoAplicacao, uf),
        instrumento: limparTexto(item.instrumento),
        objeto: limparTexto(item.objeto),
        quantidade: converterNumeroPlanilha(item.quantidade),
        valorUnitario: arredondarMoeda(converterNumeroPlanilha(item.valorUnitario)),
        valorTotal,
        valorExecutado,
        saldo: arredondarMoeda(valorTotal - valorExecutado),
        percentualExecucao: valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0
    };
}

function montarResumoItensFomento(itens) {
    const totalCentavos = itens.reduce((total, item) => total + moedaParaCentavos(item.valorTotal), 0);
    const executadoCentavos = itens.reduce((total, item) => total + moedaParaCentavos(item.valorExecutado), 0);
    const ufs = Array.from(new Set(itens.map((item) => item.uf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
        totalItens: itens.length,
        totalUfs: ufs.length,
        ufs,
        valorTotal: centavosParaMoeda(totalCentavos),
        valorExecutado: centavosParaMoeda(executadoCentavos),
        saldo: centavosParaMoeda(totalCentavos - executadoCentavos),
        percentualExecucao: totalCentavos > 0 ? (executadoCentavos / totalCentavos) * 100 : 0
    };
}

function montarDadosFaf2021(catalogoAplicacao) {
    const itens = (catalogoAplicacao?.dadosBase || [])
        .filter((item) => normalizarTexto(item.instrumento) === 'FAF 2021')
        .map((item) => normalizarItemBaseFomento(item, catalogoAplicacao));

    return {
        resumo: montarResumoItensFomento(itens),
        itens,
        filtros: {
            ufs: Array.from(new Set(itens.map((item) => item.uf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
    };
}

function montarDadosDoacoes2023(catalogoAplicacao) {
    const itens = (catalogoAplicacao?.dadosBase || [])
        .filter((item) => normalizarTexto(item.instrumento).includes('DOA'))
        .map((item) => normalizarItemBaseFomento(item, catalogoAplicacao));
    const resumoBase = montarResumoItensFomento(itens);
    const valorMedioPorUf = resumoBase.totalUfs > 0 ? resumoBase.valorTotal / resumoBase.totalUfs : 0;
    const totaisPorUf = itens.reduce((acc, item) => {
        acc[item.uf] = (acc[item.uf] || 0) + (Number(item.valorTotal) || 0);
        return acc;
    }, {});
    const [ufMaiorConcentracao = '', valorMaiorConcentracao = 0] = Object.entries(totaisPorUf)
        .sort((a, b) => b[1] - a[1])[0] || [];

    return {
        resumo: {
            ...resumoBase,
            valorMedioPorUf: arredondarMoeda(valorMedioPorUf),
            ufMaiorConcentracao,
            nomeUfMaiorConcentracao: obterNomeEstadoCatalogo(catalogoAplicacao, ufMaiorConcentracao),
            valorMaiorConcentracao: arredondarMoeda(valorMaiorConcentracao)
        },
        itens,
        filtros: {
            ufs: Array.from(new Set(itens.map((item) => item.uf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
    };
}

function formatarMoedaMensagem(centavos) {
    return centavosParaMoeda(centavos).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function obterLinhasPlanilha(sheet) {
    const xlsx = obterXlsxGlobal();
    return xlsx.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false
    });
}

function obterIndiceColuna(headers, regras) {
    return headers.findIndex((header) => (
        regras.some((regra) => (
            regra.tipo === 'igual'
                ? header === regra.valor
                : header.includes(regra.valor)
        ))
    ));
}

// Localiza colunas por termos normalizados, aceitando pequenas variações de
// cabeçalho. Ex.: "Link DDO (CGOF)" e "Link CGOF" podem alimentar o mesmo campo.
function obterIndiceColunaComTodos(headers, conjuntosTermos, termosIgnorados = []) {
    const conjuntos = Array.isArray(conjuntosTermos[0]) ? conjuntosTermos : [conjuntosTermos];
    return headers.findIndex((header) => (
        !termosIgnorados.some((termo) => header.includes(termo))
            && conjuntos.some((termos) => termos.every((termo) => header.includes(termo)))
    ));
}

function obterTextoCelula(linha, indice, fallback = '-') {
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return fallback;
    }

    const texto = limparTexto(linha[indice]);
    return texto || fallback;
}

function formatarDataPtBr(data, usarUtc = false) {
    const dia = usarUtc ? data.getUTCDate() : data.getDate();
    const mes = usarUtc ? data.getUTCMonth() + 1 : data.getMonth() + 1;
    const ano = usarUtc ? data.getUTCFullYear() : data.getFullYear();
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function formatarDataPlanilha(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return '';
    }

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return formatarDataPtBr(valor);
    }

    if (typeof valor === 'number' && Number.isFinite(valor)) {
        if (valor <= 0) return '';
        const xlsx = typeof window !== 'undefined' ? window.XLSX : null;
        const dataFormatada = xlsx?.SSF?.format?.('dd/mm/yyyy', valor);
        if (dataFormatada) return limparTexto(dataFormatada);

        // Datas do Excel podem chegar como número serial quando a planilha é
        // lida com raw:true. A origem 1899-12-30 é o padrão de compatibilidade.
        const data = new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400000));
        return formatarDataPtBr(data, true);
    }

    const texto = limparTexto(valor);
    const textoNumerico = texto.replace(',', '.');
    if (/^\d+([.,]\d+)?$/.test(texto) && Number(textoNumerico) > 20000 && Number(textoNumerico) < 80000) {
        return formatarDataPlanilha(Number(textoNumerico));
    }

    return texto;
}

function obterDataCelula(linha, indice) {
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return '';
    }

    return formatarDataPlanilha(linha[indice]);
}

function obterNomeAbaWorkbook(workbook, nomes) {
    const nomesNormalizados = nomes.map((nome) => normalizarTexto(nome));
    return workbook.SheetNames.find((sheetName) => nomesNormalizados.includes(normalizarTexto(sheetName)));
}

// Monta um mapa { ID -> campos normalizados } a partir de uma aba de andamento.
// A Base_Dados guarda valores financeiros; as abas auxiliares guardam etapas,
// datas e links. O ID é o vínculo entre esses dois mundos.
function montarMapaCamposPorId(workbook, nomesAba, campos) {
    const nomeAba = obterNomeAbaWorkbook(workbook, nomesAba);
    const mapa = new Map();

    if (!nomeAba) {
        return mapa;
    }

    const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAba]);
    const headerRowIndex = linhas.findIndex((linha) => (
        (linha || []).some((celula) => normalizarTexto(celula) === 'ID')
    ));

    if (headerRowIndex === -1) {
        console.warn(`A aba ${nomeAba} nao possui coluna ID e foi ignorada no rastreio orcamentario.`);
        return mapa;
    }

    const headers = (linhas[headerRowIndex] || []).map((header) => normalizarTexto(header));
    const colId = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'ID' }]);
    const indices = Object.entries(campos).map(([propriedade, config]) => ({
        propriedade,
        data: Boolean(config.data),
        indice: obterIndiceColunaComTodos(headers, config.regras, config.ignorar || [])
    }));

    linhas.slice(headerRowIndex + 1).forEach((linha) => {
        const id = obterTextoCelula(linha, colId, '');
        if (!id) return;

        const dados = {};
        indices.forEach(({ propriedade, data, indice }) => {
            const valor = data ? obterDataCelula(linha, indice) : obterTextoCelula(linha, indice, '');
            if (valor && valor !== '-') {
                dados[propriedade] = valor;
            }
        });

        mapa.set(id, {
            ...(mapa.get(id) || {}),
            ...dados
        });
    });

    return mapa;
}

// Fluxo padrão de contratação/aquisição. Cada propriedade retornada aqui é
// consumida pelo rastreio visual em frontend/js/app.js.
function montarMapaRastreioProcessosNormais(workbook) {
    return montarMapaCamposPorId(workbook, [ABA_ORCAMENTO_PROCESSOS_NORMAIS], {
        status: { regras: ['STATUS'] },
        processoSei: { regras: ['PROCESSO', 'SEI'], ignorar: ['DATA', 'LINK'] },
        linkProcessoSei: { regras: ['LINK', 'PROCESSO', 'SEI'] },
        dataProcessoSei: { regras: ['DATA', 'PROCESSO', 'SEI'], data: true },
        demandaFormalizada: { regras: [['DEMANDA'], ['DFD'], ['FORMALIZACAO', 'DEMANDA']], ignorar: ['DATA', 'LINK'] },
        linkDemandaFormalizada: { regras: [['LINK', 'DEMANDA'], ['LINK', 'DFD']] },
        dataDemandaFormalizada: { regras: [['DATA', 'DEMANDA'], ['DATA', 'DFD']], data: true },
        estudoTecnico: { regras: [['ETP'], ['ESTUDO', 'TECNICO'], ['ESPECIFICACAO']], ignorar: ['DATA', 'LINK'] },
        linkEstudoTecnico: { regras: [['LINK', 'ETP'], ['LINK', 'ESTUDO', 'TECNICO'], ['LINK', 'ESPECIFICACAO']] },
        dataEstudoTecnico: { regras: [['DATA', 'ETP'], ['DATA', 'ESTUDO', 'TECNICO'], ['DATA', 'ESPECIFICACAO']], data: true },
        termoReferencia: { regras: ['TERMO', 'REFERENCIA'], ignorar: ['DATA', 'LINK'] },
        linkTermoReferencia: { regras: ['LINK', 'TERMO', 'REFERENCIA'] },
        dataTermoReferencia: { regras: ['DATA', 'TERMO', 'REFERENCIA'], data: true },
        pesquisaPrecos: { regras: [['PESQUISA', 'PRECO'], ['MAPA', 'PRECO'], ['ORCAMENTO', 'ESTIMADO']], ignorar: ['DATA', 'LINK'] },
        linkPesquisaPrecos: { regras: [['LINK', 'PESQUISA', 'PRECO'], ['LINK', 'MAPA', 'PRECO'], ['LINK', 'ORCAMENTO', 'ESTIMADO']] },
        dataPesquisaPrecos: { regras: [['DATA', 'PESQUISA', 'PRECO'], ['DATA', 'MAPA', 'PRECO'], ['DATA', 'ORCAMENTO', 'ESTIMADO']], data: true },
        autorizacaoAutoridade: { regras: [['AUTORIZ'], ['APROVACAO'], ['APROVADO']], ignorar: ['DATA', 'LINK'] },
        linkAutorizacaoAutoridade: { regras: [['LINK', 'AUTORIZ'], ['LINK', 'APROVACAO'], ['LINK', 'APROVADO']] },
        dataAutorizacaoAutoridade: { regras: [['DATA', 'AUTORIZ'], ['DATA', 'APROVACAO'], ['DATA', 'APROVADO']], data: true },
        parecerJuridico: { regras: [['PARECER', 'JURIDICO'], ['PARECER']], ignorar: ['DATA', 'LINK', 'TECNICO'] },
        linkParecerJuridico: { regras: ['LINK', 'PARECER'] },
        dataParecerJuridico: { regras: ['DATA', 'PARECER'], data: true },
        empenho: { regras: ['EMPENHO'], ignorar: ['DATA', 'LINK'] },
        linkEmpenho: { regras: ['LINK', 'EMPENHO'] },
        dataEmpenho: { regras: ['DATA', 'EMPENHO'], data: true },
        contrato: { regras: ['CONTRAT'], ignorar: ['DATA', 'LINK'] },
        linkContrato: { regras: ['LINK', 'CONTRAT'] },
        dataContratacao: { regras: ['DATA', 'CONTRAT'], data: true },
        ordemServico: { regras: ['ORDEM', 'SERVICO'], ignorar: ['DATA', 'LINK'] },
        linkOrdemServico: { regras: ['LINK', 'ORDEM', 'SERVICO'] },
        dataOrdemServico: { regras: ['DATA', 'ORDEM', 'SERVICO'], data: true },
        dataEntrega: { regras: ['DATA', 'ENTREG'], data: true },
        ordemBancaria: { regras: ['ORDEM', 'BANCARIA'], ignorar: ['DATA', 'LINK'] },
        linkOrdemBancaria: { regras: ['LINK', 'ORDEM', 'BANCARIA'] },
        dataOrdemBancaria: { regras: [['DATA', 'ORDEM', 'BANCARIA'], ['DATA', 'OB']], data: true }
    });
}

// Fluxo exclusivo do item CONV-001 / PROFOR. Ele não segue o fluxo normal de
// contratação, por isso fica isolado em uma aba e em campos próprios.
function montarMapaRastreioProfor(workbook) {
    return montarMapaCamposPorId(workbook, [ABA_ORCAMENTO_PROFOR], {
        status: { regras: ['STATUS'] },
        processoSei: { regras: ['PROCESSO', 'SEI'], ignorar: ['DATA', 'LINK'] },
        linkProcessoSei: { regras: ['LINK', 'PROCESSO', 'SEI'] },
        dataProcessoSei: { regras: ['DATA', 'PROCESSO', 'SEI'], data: true },
        proforAutuacao: { regras: ['AUTUACAO'], ignorar: ['DATA', 'LINK'] },
        linkProforAutuacao: { regras: ['LINK', 'AUTUACAO'] },
        dataProforAutuacao: { regras: ['DATA', 'AUTUACAO'], data: true },
        proforParecerTecnico: { regras: ['PARECER', 'TECNICO'], ignorar: ['DATA', 'LINK'] },
        linkProforParecerTecnico: { regras: ['LINK', 'PARECER', 'TECNICO'] },
        dataProforParecerTecnico: { regras: ['DATA', 'PARECER', 'TECNICO'], data: true },
        proforMinutaEdital: { regras: ['MINUTA', 'EDITAL'], ignorar: ['DATA', 'LINK'] },
        linkProforMinutaEdital: { regras: ['LINK', 'MINUTA', 'EDITAL'] },
        dataProforMinutaEdital: { regras: ['DATA', 'MINUTA', 'EDITAL'], data: true },
        proforDdoCgof: { regras: [['DDO'], ['CGOF']], ignorar: ['DATA', 'LINK'] },
        linkProforDdoCgof: { regras: [['LINK', 'DDO'], ['LINK', 'CGOF']] },
        dataProforDdoCgof: { regras: [['DATA', 'DDO'], ['DATA', 'CGOF']], data: true },
        proforAberturaPrograma: { regras: [['ABERTURA', 'PROGRAMA'], ['CGGIR']], ignorar: ['DATA', 'LINK'] },
        linkProforAberturaPrograma: { regras: [['LINK', 'ABERTURA', 'PROGRAMA'], ['LINK', 'CGGIR']] },
        dataProforAberturaPrograma: { regras: [['DATA', 'ABERTURA', 'PROGRAMA'], ['DATA', 'CGGIR']], data: true },
        proforParecerConjur: { regras: [['PARECER', 'CONJUR'], ['CONJUR']], ignorar: ['DATA', 'LINK'] },
        linkProforParecerConjur: { regras: [['LINK', 'PARECER', 'CONJUR'], ['LINK', 'CONJUR']] },
        dataProforParecerConjur: { regras: [['DATA', 'PARECER', 'CONJUR'], ['DATA', 'CONJUR']], data: true },
        proforPublicacaoGabsec: { regras: [['PUBLICACAO'], ['GABSEC']], ignorar: ['DATA', 'LINK'] },
        linkProforPublicacaoGabsec: { regras: [['LINK', 'PUBLICACAO'], ['LINK', 'GABSEC']] },
        dataProforPublicacaoGabsec: { regras: [['DATA', 'PUBLICACAO'], ['DATA', 'GABSEC']], data: true }
    });
}

function incrementarResumoOrcamento(resumo, chave, item) {
    const nome = item[chave] && item[chave] !== '-' ? item[chave] : 'Não informado';
    const resumoItem = resumo[nome] || { nome, itens: 0, total: 0 };
    resumoItem.itens += 1;
    resumoItem.total = arredondarMoeda(resumoItem.total + item.valorTotal);
    resumo[nome] = resumoItem;
}

function ordenarResumoOrcamento(resumo) {
    return Object.values(resumo).sort((a, b) => (
        b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')
    ));
}

function montarResumoOrcamento(itens) {
    const porStatus = {};
    const porNatureza = {};
    const porModalidade = {};
    const porFrente = {};
    
    let totalEmpenhado = 0;
    let totalExecutado = 0;

    itens.forEach((item) => {
        incrementarResumoOrcamento(porStatus, 'status', item);
        incrementarResumoOrcamento(porNatureza, 'natureza', item);
        incrementarResumoOrcamento(porModalidade, 'modalidade', item);
        incrementarResumoOrcamento(porFrente, 'frente', item);
        
        // Soma itens que possuem empenho
        if (item.empenho) {
            totalEmpenhado += item.valorTotal;
        }
        
        // Soma valores já executados
        totalExecutado += item.valorExecutado || 0;
    });

    return {
        totalGeral: arredondarMoeda(itens.reduce((total, item) => total + item.valorTotal, 0)),
        totalItens: itens.length,
        totalEmpenhado: arredondarMoeda(totalEmpenhado),
        totalExecutado: arredondarMoeda(totalExecutado),
        porStatus: ordenarResumoOrcamento(porStatus),
        porNatureza: ordenarResumoOrcamento(porNatureza),
        porModalidade: ordenarResumoOrcamento(porModalidade),
        porFrente: ordenarResumoOrcamento(porFrente)
    };
}

function obterValoresUnicosOrcamento(itens, chave) {
    return Array.from(new Set(
        itens
            .map((item) => item[chave])
            .filter((valor) => valor && valor !== '-')
    )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function converterPercentualPlanilha(valor) {
    const numero = converterNumeroPlanilha(valor);
    return Math.abs(numero) <= 1.5 ? numero * 100 : numero;
}

function somarCampoMoeda(itens, campo) {
    const totalCentavos = itens.reduce((total, item) => (
        total + moedaParaCentavos(item[campo])
    ), 0);

    return centavosParaMoeda(totalCentavos);
}

function extrairPlanoAplicacaoProforDaAba(sheet, uf) {
    if (!sheet) {
        return [];
    }

    const linhas = obterLinhasPlanilha(sheet);
    const ufEsperada = normalizarTexto(uf);

    return linhas.slice(1).map((linha) => {
        const ufLinha = normalizarTexto(linha[COLUNAS_PLANO_PROFOR.uf]);
        const descricao = limparTexto(linha[COLUNAS_PLANO_PROFOR.descricao]);

        if (ufLinha !== ufEsperada || !descricao) {
            return null;
        }

        const valorPrevisto = arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.valorPrevisto]));
        const valorExecutado = arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.valorExecutado]));

        return {
            uf: ufEsperada,
            instrumento: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.instrumento, ''),
            numero: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.numero, ''),
            ano: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.ano, ''),
            area: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.area, 'Não informado'),
            natureza: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.natureza, 'Não informado'),
            descricao,
            quantidade: converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.quantidade]),
            valorUnitario: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.valorUnitario])),
            valorPrevisto,
            valorExecutado,
            saldo: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.saldo])),
            saldoEconomicidade: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.saldoEconomicidade])),
            percentualExecucao: valorPrevisto > 0 ? (valorExecutado / valorPrevisto) * 100 : 0
        };
    }).filter(Boolean);
}

function resumirPlanoAplicacaoProfor(planoAplicacao) {
    const itensOuvidoria = planoAplicacao.filter((item) => (
        normalizarTexto(item.area) === 'OUVIDORIA'
    ));

    return {
        totalItens: planoAplicacao.length,
        totalItensOuvidoria: itensOuvidoria.length,
        valorPrevistoOuvidoriaPlano: somarCampoMoeda(itensOuvidoria, 'valorPrevisto'),
        valorExecutadoOuvidoria: somarCampoMoeda(itensOuvidoria, 'valorExecutado'),
        previstoCapitalOuvidoria: somarCampoMoeda(
            itensOuvidoria.filter((item) => normalizarTexto(item.natureza) === 'CAPITAL'),
            'valorPrevisto'
        ),
        previstoCusteioOuvidoria: somarCampoMoeda(
            itensOuvidoria.filter((item) => normalizarTexto(item.natureza) === 'CUSTEIO'),
            'valorPrevisto'
        )
    };
}

function montarResumoProfor2022(convenios) {
    const totalPrevistoOuvidoriaCentavos = convenios.reduce((total, convenio) => (
        total + moedaParaCentavos(convenio.previstoOuvidoria)
    ), 0);
    const totalExecutadoOuvidoriaCentavos = convenios.reduce((total, convenio) => (
        total + moedaParaCentavos(convenio.valorExecutadoOuvidoria)
    ), 0);

    return {
        totalConvenios: convenios.length,
        valorGlobal: somarCampoMoeda(convenios, 'valorGlobal'),
        valorRepasse: somarCampoMoeda(convenios, 'valorRepasse'),
        valorContrapartida: somarCampoMoeda(convenios, 'valorContrapartida'),
        repasseDesembolsado: somarCampoMoeda(convenios, 'repasseDesembolsado'),
        rendimentoAprovado: somarCampoMoeda(convenios, 'rendimentoAprovado'),
        saldoRendimentosAtual: somarCampoMoeda(convenios, 'saldoRendimentosAtual'),
        saldoResidualCapital: somarCampoMoeda(convenios, 'saldoResidualCapital'),
        saldoResidualCusteio: somarCampoMoeda(convenios, 'saldoResidualCusteio'),
        contrapartidaIntegralizada: somarCampoMoeda(convenios, 'contrapartidaIntegralizada'),
        valorExecutadoGeral: somarCampoMoeda(convenios, 'valorExecutadoGeral'),
        previstoOuvidoria: centavosParaMoeda(totalPrevistoOuvidoriaCentavos),
        previstoCorregedoria: somarCampoMoeda(convenios, 'previstoCorregedoria'),
        previstoEscolaPenal: somarCampoMoeda(convenios, 'previstoEscolaPenal'),
        valorExecutadoOuvidoria: centavosParaMoeda(totalExecutadoOuvidoriaCentavos),
        execucaoGeralPercentual: somarCampoMoeda(convenios, 'valorGlobal') > 0
            ? (somarCampoMoeda(convenios, 'valorExecutadoGeral') / somarCampoMoeda(convenios, 'valorGlobal')) * 100
            : 0,
        execucaoOuvidoriaPercentual: totalPrevistoOuvidoriaCentavos > 0
            ? (totalExecutadoOuvidoriaCentavos / totalPrevistoOuvidoriaCentavos) * 100
            : 0,
        saldoDisponivelOuvidoria: somarCampoMoeda(convenios, 'saldoDisponivelOuvidoria')
    };
}

function extrairProfor2022DoWorkbook(workbook, catalogoAplicacao) {
    const sheetGeral = workbook.Sheets[ABA_RESUMO_CONVENIOS];
    if (!sheetGeral) {
        throw new Error(`A aba ${ABA_RESUMO_CONVENIOS} nao foi encontrada na planilha.`);
    }

    const linhas = obterLinhasPlanilha(sheetGeral);
    const convenios = linhas.slice(1).map((linha) => {
        const uf = normalizarTexto(linha[COLUNAS_GERAL_PROFOR.uf]);
        const instrumento = obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.instrumento, '');
        const ano = obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.ano, '');

        if (!uf || !catalogoAplicacao.nomesEstados[uf] || !normalizarTexto(instrumento).includes('CONV') || ano !== '2022') {
            return null;
        }

        const planoAplicacao = extrairPlanoAplicacaoProforDaAba(workbook.Sheets[uf], uf);
        const resumoPlano = resumirPlanoAplicacaoProfor(planoAplicacao);

        return {
            uf,
            instrumento,
            numero: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.numero, ''),
            ano,
            processoSei: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.processoSei, ''),
            vencimento: obterDataCelula(linha, COLUNAS_GERAL_PROFOR.vencimento),
            quantidadeTa: converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.quantidadeTa]),
            solicitouProrrogacao: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.solicitouProrrogacao, ''),
            valorGlobal: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorGlobal])),
            valorRepasse: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorRepasse])),
            valorContrapartida: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorContrapartida])),
            repasseDesembolsado: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.repasseDesembolsado])),
            rendimentoAprovado: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.rendimentoAprovado])),
            saldoRendimentosAtual: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoRendimentosAtual])),
            saldoResidualCapital: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoResidualCapital])),
            saldoResidualCusteio: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoResidualCusteio])),
            contrapartidaIntegralizada: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.contrapartidaIntegralizada])),
            valorExecutadoGeral: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorExecutadoGeral])),
            previstoOuvidoria: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.previstoOuvidoria])),
            previstoCorregedoria: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.previstoCorregedoria])),
            previstoEscolaPenal: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.previstoEscolaPenal])),
            valorRelativoOuvidoria: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.valorRelativoOuvidoria]),
            execucaoOuvidoriaPercentual: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.execucaoOuvidoriaPercentual]),
            execucaoCorregedoriaPercentual: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.execucaoCorregedoriaPercentual]),
            execucaoEscolaPenalPercentual: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.execucaoEscolaPenalPercentual]),
            saldoDisponivelOuvidoria: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoDisponivelOuvidoria])),
            valorExecutadoOuvidoria: resumoPlano.valorExecutadoOuvidoria,
            valorPrevistoOuvidoriaPlano: resumoPlano.valorPrevistoOuvidoriaPlano,
            previstoCapitalOuvidoria: resumoPlano.previstoCapitalOuvidoria,
            previstoCusteioOuvidoria: resumoPlano.previstoCusteioOuvidoria,
            totalItensPlano: resumoPlano.totalItens,
            totalItensOuvidoria: resumoPlano.totalItensOuvidoria,
            planoAplicacao
        };
    }).filter(Boolean);

    if (convenios.length === 0) {
        throw new Error('Nenhum convenio PROFOR 2022 foi encontrado na aba Geral.');
    }

    return {
        resumo: montarResumoProfor2022(convenios),
        convenios,
        filtros: {
            ufs: convenios.map((convenio) => convenio.uf).sort(),
            areas: Array.from(new Set(
                convenios.flatMap((convenio) => convenio.planoAplicacao.map((item) => item.area))
            )).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
            naturezas: Array.from(new Set(
                convenios.flatMap((convenio) => convenio.planoAplicacao.map((item) => item.natureza))
            )).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
    };
}

// Extrai somente itens de convênio classificados como OUVIDORIA nas abas de UF.
// A planilha de gestão financeira é ampla; esta aplicação mostra o recorte da
// Ouvidoria, por isso a classificação é uma regra de negócio importante.
function extrairItensConvenioDaAba(sheet, uf, configuracao) {
    const linhas = obterLinhasPlanilha(sheet);
    const ufEsperada = normalizarTexto(uf);
    const classificacaoEsperada = normalizarTexto(configuracao.classificacaoPlanilhaConvenios);

    return linhas
        .map((linha) => {
            const ufLinha = normalizarTexto(linha[COLUNAS_CONVENIO.uf]);
            const classificacao = normalizarTexto(linha[COLUNAS_CONVENIO.classificacao]);
            const objeto = limparTexto(linha[COLUNAS_CONVENIO.objeto]);

            if (ufLinha !== ufEsperada || classificacao !== classificacaoEsperada || !objeto) {
                return null;
            }

            return {
                uf: ufEsperada,
                objeto,
                quantidade: converterNumeroPlanilha(linha[COLUNAS_CONVENIO.quantidade]),
                valorUnitario: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_CONVENIO.valorUnitario])),
                valorTotal: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_CONVENIO.valorTotal])),
                valorExecutado: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_CONVENIO.valorExecutado])),
                instrumento: 'Convênio'
            };
        })
        .filter(Boolean);
}

function somarConveniosExtraidosPorUf(dadosConvenio) {
    return dadosConvenio.reduce((totais, item) => {
        const uf = normalizarTexto(item.uf);
        const acumulado = totais.get(uf) || 0;
        totais.set(uf, acumulado + moedaParaCentavos(item.valorTotal));
        return totais;
    }, new Map());
}

function extrairTotaisOuvidoriaDaAbaGeral(workbook, catalogoAplicacao) {
    const sheet = workbook.Sheets[ABA_RESUMO_CONVENIOS];
    if (!sheet) {
        throw new Error(`A aba ${ABA_RESUMO_CONVENIOS} nao foi encontrada na planilha.`);
    }

    const linhas = obterLinhasPlanilha(sheet);
    const totais = new Map();

    linhas.slice(1).forEach((linha) => {
        const uf = normalizarTexto(linha[0]);
        const instrumento = normalizarTexto(linha[1]);

        if (!uf || !catalogoAplicacao.nomesEstados[uf] || !instrumento.includes('CONV')) {
            return;
        }

        const valorOuvidoria = arredondarMoeda(
            converterNumeroPlanilha(linha[COLUNA_VALOR_OUVIDORIA_GERAL])
        );
        totais.set(uf, (totais.get(uf) || 0) + moedaParaCentavos(valorOuvidoria));
    });

    return totais;
}

function validarConveniosContraAbaGeral(workbook, dadosConvenio, catalogoAplicacao) {
    const totaisExtraidos = somarConveniosExtraidosPorUf(dadosConvenio);
    const totaisGeral = extrairTotaisOuvidoriaDaAbaGeral(workbook, catalogoAplicacao);
    const ufs = new Set([...totaisGeral.keys(), ...totaisExtraidos.keys()]);
    const divergencias = [];

    ufs.forEach((uf) => {
        const totalExtraido = totaisExtraidos.get(uf) || 0;
        const totalGeral = totaisGeral.get(uf) || 0;
        const diferenca = totalExtraido - totalGeral;

        if (Math.abs(diferenca) > TOLERANCIA_VALIDACAO_CENTAVOS) {
            divergencias.push(
                `${uf}: extraido ${formatarMoedaMensagem(totalExtraido)}, Geral ${formatarMoedaMensagem(totalGeral)}`
            );
        }
    });

    if (divergencias.length > 0) {
        throw new Error(
            `A soma dos convenios extraidos diverge da coluna S da aba Geral. ${divergencias.join('; ')}.`
        );
    }
}

// Lê todas as abas estaduais válidas e valida os totais contra a aba "Geral".
// Isso evita exibir um painel aparentemente correto com dados parciais.
function extrairConveniosDoWorkbook(workbook, catalogoAplicacao) {
    const { configuracao, nomesEstados } = catalogoAplicacao;
    const abasIgnoradas = new Set([
        ABA_RESUMO_CONVENIOS,
        'IND_PRORROG',
        ...(configuracao.abasPlanilhaIgnoradas || [])
    ].map((nomeAba) => normalizarTexto(nomeAba)));
    const abasDeEstado = workbook.SheetNames.filter((sheetName) => (
        nomesEstados[normalizarTexto(sheetName)] && !abasIgnoradas.has(normalizarTexto(sheetName))
    ));

    const dadosConvenio = abasDeEstado.flatMap((sheetName) => (
        extrairItensConvenioDaAba(workbook.Sheets[sheetName], sheetName, configuracao)
    ));

    if (dadosConvenio.length === 0) {
        throw new Error('Nenhum item classificado como OUVIDORIA foi encontrado na planilha.');
    }

    validarConveniosContraAbaGeral(workbook, dadosConvenio, catalogoAplicacao);

    return dadosConvenio;
}

function montarDadosComConvenios(catalogoAplicacao, dadosConvenio) {
    return [...catalogoAplicacao.dadosBase, ...dadosConvenio];
}

function extrairDadosFinanceirosDoWorkbook(workbook, catalogoAplicacao) {
    dadosProfor2022Cache = null;
    const dadosConvenio = extrairConveniosDoWorkbook(workbook, catalogoAplicacao);
    dadosProfor2022Cache = extrairProfor2022DoWorkbook(workbook, catalogoAplicacao);
    return dadosConvenio;
}

function normalizarCabecalhoPlanilha(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[ºª]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toUpperCase();
}

function obterTabelaFormalizacao(workbook, nomesAba, termosCabecalho = []) {
    const nomeAba = obterNomeAbaWorkbook(workbook, Array.isArray(nomesAba) ? nomesAba : [nomesAba]);
    if (!nomeAba) return null;

    const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAba]);
    const termosNormalizados = termosCabecalho.map((termo) => normalizarCabecalhoPlanilha(termo));
    const headerRowIndex = linhas.findIndex((linha) => {
        const linhaNormalizada = (linha || []).map((celula) => normalizarCabecalhoPlanilha(celula));
        return termosNormalizados.every((termo) => linhaNormalizada.includes(termo));
    });

    if (headerRowIndex === -1) {
        return null;
    }

    const headers = (linhas[headerRowIndex] || []).map((header) => normalizarCabecalhoPlanilha(header));
    const cacheIndices = new Map();
    const indice = (aliases) => {
        const listaAliases = Array.isArray(aliases) ? aliases : [aliases];
        const chave = listaAliases.join('|');
        if (cacheIndices.has(chave)) return cacheIndices.get(chave);

        const aliasesNormalizados = listaAliases.map((alias) => normalizarCabecalhoPlanilha(alias));
        let encontrado = headers.findIndex((header) => aliasesNormalizados.includes(header));
        if (encontrado < 0) {
            encontrado = headers.findIndex((header) => aliasesNormalizados.some((alias) => header.includes(alias)));
        }
        cacheIndices.set(chave, encontrado);
        return encontrado;
    };

    return {
        nomeAba,
        headers,
        linhas: linhas.slice(headerRowIndex + 1),
        indice
    };
}

function obterCelulaFormalizacao(linha, tabela, aliases, fallback = '') {
    const indice = tabela?.indice?.(aliases) ?? -1;
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return fallback;
    }
    const valor = linha[indice];
    if (valor instanceof Date) {
        return formatarDataPlanilha(valor);
    }
    const texto = limparTexto(valor);
    return texto || fallback;
}

function obterNumeroFormalizacao(linha, tabela, aliases) {
    const indice = tabela?.indice?.(aliases) ?? -1;
    return indice >= 0 ? arredondarMoeda(converterNumeroPlanilha(linha[indice])) : 0;
}

function obterDataFormalizacao(linha, tabela, aliases) {
    const indice = tabela?.indice?.(aliases) ?? -1;
    return indice >= 0 ? obterDataCelula(linha, indice) : '';
}

function valorEhSim(valor) {
    const texto = normalizarTexto(valor);
    return ['SIM', 'S', 'TRUE', 'VERDADEIRO', '1', 'VALIDADO', 'PUBLICADO', 'RESOLVIDO'].includes(texto);
}

function valorEhNao(valor) {
    const texto = normalizarTexto(valor);
    return ['NAO', 'N', 'FALSE', 'FALSO', '0'].includes(texto);
}

function valorNaoSeAplica(valor) {
    const texto = normalizarTexto(valor);
    return texto.includes('NAO SE APLICA') || texto === 'N/A';
}

function textoPossuiValor(valor) {
    const texto = normalizarTexto(valor);
    return Boolean(texto && texto !== '-' && texto !== 'NAO INFORMADO' && texto !== 'N/A');
}

function primeiroTextoComValor(valores) {
    return valores.find((valor) => textoPossuiValor(valor)) || '';
}

function documentoAplicavelAUf(documento, uf) {
    const aplicavel = normalizarTexto(documento?.aplicavelUfs || '');
    if (!aplicavel || aplicavel === 'TODAS' || aplicavel === 'TODOS') {
        return true;
    }
    return aplicavel.split(/[^A-Z]+/).includes(uf);
}

function extrairDicionarioDocumentosFormalizacao(workbook) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_DICIONARIO, ['Código']);
    const documentos = new Map();

    if (!tabela) {
        return documentos;
    }

    tabela.linhas.forEach((linha) => {
        const codigo = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['Código do Documento', 'Código']));
        if (!codigo) return;

        documentos.set(codigo, {
            codigo,
            etapa: obterCelulaFormalizacao(linha, tabela, ['Etapa']),
            nome: obterCelulaFormalizacao(linha, tabela, ['Nome do Documento', 'Nome Documento']),
            descricao: obterCelulaFormalizacao(linha, tabela, ['Descrição', 'Observação']),
            obrigatorio: !valorEhNao(obterCelulaFormalizacao(linha, tabela, ['Obrigatório?'])),
            aplicavelUfs: obterCelulaFormalizacao(linha, tabela, ['Aplicável a quais UFs', 'Aplicável']),
            ordem: converterNumeroPlanilha(obterCelulaFormalizacao(linha, tabela, ['Ordem de Exibição', 'Ordem']))
        });
    });

    return documentos;
}

function extrairChecklistFormalizacao(workbook) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_CHECKLIST, ['ID_Checklist']);
    const porProposta = new Map();

    if (!tabela) {
        return porProposta;
    }

    tabela.linhas.forEach((linha) => {
        const idProposta = obterCelulaFormalizacao(linha, tabela, ['ID_Proposta', 'ID Proposta']);
        const codigo = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['Código Documento', 'Código do Documento', 'Código']));
        if (!idProposta || !codigo) return;

        const enviadoRaw = obterCelulaFormalizacao(linha, tabela, ['Enviado?']);
        const item = {
            idChecklist: obterCelulaFormalizacao(linha, tabela, ['ID_Checklist', 'ID Checklist']),
            idProposta,
            uf: normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF'])),
            etapa: obterCelulaFormalizacao(linha, tabela, ['Etapa']),
            codigo,
            nome: obterCelulaFormalizacao(linha, tabela, ['Nome Documento', 'Nome do Documento']),
            obrigatorio: !valorEhNao(obterCelulaFormalizacao(linha, tabela, ['Obrigatório?'])),
            enviado: valorEhSim(enviadoRaw),
            enviadoRaw,
            dataEnvio: obterDataFormalizacao(linha, tabela, ['Data de Envio', 'Data Envio']),
            statusAnalise: obterCelulaFormalizacao(linha, tabela, ['Status de Análise', 'Status Análise'], 'Não enviado'),
            unidadeResponsavel: obterCelulaFormalizacao(linha, tabela, ['Unidade Responsável pela Análise', 'Unidade Responsável']),
            link: obterCelulaFormalizacao(linha, tabela, ['Link SEI/Transferegov', 'Link SEI', 'Link']),
            pendencia: obterCelulaFormalizacao(linha, tabela, ['Pendência']),
            dataValidacao: obterDataFormalizacao(linha, tabela, ['Data de Validação', 'Data Validação']),
            observacao: obterCelulaFormalizacao(linha, tabela, ['Observação'])
        };

        if (!porProposta.has(idProposta)) {
            porProposta.set(idProposta, new Map());
        }
        porProposta.get(idProposta).set(codigo, item);
    });

    return porProposta;
}

function criarContatosFormalizacaoVazios(erro = '') {
    return {
        cadastroPorUf: new Map(),
        pessoasPorUf: new Map(),
        disponivel: false,
        erro
    };
}

function ufContatoValida(uf) {
    return TODAS_UFS_BRASIL.includes(normalizarTexto(uf));
}

function linhaPlanilhaPossuiValor(linha) {
    return (linha || []).some((valor) => textoPossuiValor(valor));
}

function registrarLinhaContatoInvalida(registros, origem, linha, uf) {
    if (!linhaPlanilhaPossuiValor(linha)) return;
    registros.push({
        origem,
        uf: uf || '',
        motivo: uf ? 'UF inválida' : 'UF ausente'
    });
}

function extrairCadastroInstitucionalContatos(workbook, linhasInvalidas = []) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_CONTATOS_UF, ['UF', 'Órgão_Entidade']);
    if (!tabela) {
        throw new Error(`A aba ${ABA_CONTATOS_UF} nao foi encontrada ou nao possui os cabecalhos esperados.`);
    }

    const porUf = new Map();
    tabela.linhas.forEach((linha) => {
        const uf = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF']));
        if (!ufContatoValida(uf)) {
            registrarLinhaContatoInvalida(linhasInvalidas, ABA_CONTATOS_UF, linha, uf);
            return;
        }

        const celularTitular = obterCelulaFormalizacao(linha, tabela, ['Celular_Titular', 'Celular Titular']);
        const telefoneTitular = obterCelulaFormalizacao(linha, tabela, ['Telefone_Titular', 'Telefone Titular']);
        const emailTitular = obterCelulaFormalizacao(linha, tabela, ['Email_Titular', 'E-mail Titular']);
        const emailGabinete = obterCelulaFormalizacao(linha, tabela, ['Email_Gabinete', 'E-mail Gabinete']);
        const contatoChefe = obterCelulaFormalizacao(linha, tabela, ['Contato_Chefe', 'Contato Chefe']);
        const contatoSecretaria = obterCelulaFormalizacao(linha, tabela, ['Contato_Secretaria', 'Contato Secretaria']);
        const ramaisGabinete = obterCelulaFormalizacao(linha, tabela, ['Ramais_Gabinete', 'Ramais Gabinete']);

        porUf.set(uf, {
            uf,
            estado: obterCelulaFormalizacao(linha, tabela, ['Estado']),
            regiao: obterCelulaFormalizacao(linha, tabela, ['Região', 'Regiao']),
            orgao: obterCelulaFormalizacao(linha, tabela, ['Órgão_Entidade', 'Órgão Entidade', 'Orgao Entidade']),
            sigla: obterCelulaFormalizacao(linha, tabela, ['Sigla']),
            tipoOrgao: obterCelulaFormalizacao(linha, tabela, ['Tipo_Órgão', 'Tipo Órgão', 'Tipo Orgao']),
            cnpj: obterCelulaFormalizacao(linha, tabela, ['CNPJ']),
            endereco: obterCelulaFormalizacao(linha, tabela, ['Endereço', 'Endereco']),
            cep: obterCelulaFormalizacao(linha, tabela, ['CEP']),
            cargoTitular: obterCelulaFormalizacao(linha, tabela, ['Cargo_Titular', 'Cargo Titular']),
            nomeTitular: obterCelulaFormalizacao(linha, tabela, ['Nome_Titular', 'Nome Titular']),
            cpfTitular: obterCelulaFormalizacao(linha, tabela, ['CPF_Titular', 'CPF Titular']),
            celularTitular,
            telefoneTitular,
            emailTitular,
            emailGabinete,
            chefeGabinete: obterCelulaFormalizacao(linha, tabela, ['Chefe_Gabinete', 'Chefe Gabinete']),
            contatoChefe,
            secretariaGabinete: obterCelulaFormalizacao(linha, tabela, ['Secretaria_Gabinete', 'Secretaria Gabinete']),
            contatoSecretaria,
            ramaisGabinete,
            assessor: obterCelulaFormalizacao(linha, tabela, ['Assessor']),
            contatoAssessor: obterCelulaFormalizacao(linha, tabela, ['Contato_Assessor', 'Contato Assessor']),
            cargoSubstituto: obterCelulaFormalizacao(linha, tabela, ['Cargo_Substituto', 'Cargo Substituto']),
            nomeSubstituto: obterCelulaFormalizacao(linha, tabela, ['Nome_Substituto', 'Nome Substituto']),
            contatoSubstituto: obterCelulaFormalizacao(linha, tabela, ['Contato_Substituto', 'Contato Substituto']),
            emailSubstituto: obterCelulaFormalizacao(linha, tabela, ['Email_Substituto', 'E-mail Substituto']),
            atoNomeacao: obterCelulaFormalizacao(linha, tabela, ['Ato_Nomeação', 'Ato Nomeação', 'Ato Nomeacao']),
            observacoes: obterCelulaFormalizacao(linha, tabela, ['Observações', 'Observacoes', 'Observação']),
            tratamentoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Tratamento_Destinatario', 'Tratamento Destinatario', 'Tratamento Destinatário']),
            nomeDestinatario: obterCelulaFormalizacao(linha, tabela, ['Nome_Destinatario', 'Nome Destinatario', 'Nome Destinatário']),
            cargoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Cargo_Destinatario', 'Cargo Destinatario', 'Cargo Destinatário']),
            enderecoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Endereco_Destinatario', 'Endereço_Destinatario', 'Endereco Destinatario', 'Endereço Destinatário']),
            complementoEnderecoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Complemento_Endereco_Destinatario', 'Complemento Endereco Destinatario', 'Complemento Endereço Destinatário']),
            bairroDestinatario: obterCelulaFormalizacao(linha, tabela, ['Bairro_Destinatario', 'Bairro Destinatario', 'Bairro Destinatário']),
            cepDestinatario: obterCelulaFormalizacao(linha, tabela, ['CEP_Destinatario', 'CEP Destinatario', 'CEP Destinatário']),
            cidadeDestinatario: obterCelulaFormalizacao(linha, tabela, ['Cidade_Destinatario', 'Cidade Destinatario', 'Cidade Destinatário']),
            siglaUfDestinatario: obterCelulaFormalizacao(linha, tabela, ['Sigla_UF_Destinatario', 'Sigla UF Destinatario', 'Sigla UF Destinatário']),
            telefoneFixoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Telefone_Fixo_Destinatario', 'Telefone Fixo Destinatario', 'Telefone Fixo Destinatário']),
            telefoneCelularDestinatario: obterCelulaFormalizacao(linha, tabela, ['Telefone_Celular_Destinatario', 'Telefone Celular Destinatario', 'Telefone Celular Destinatário']),
            emailDestinatario: obterCelulaFormalizacao(linha, tabela, ['Email_Destinatario', 'E-mail_Destinatario', 'Email Destinatario', 'E-mail Destinatário']),
            destinatarioOficioFlag: obterCelulaFormalizacao(linha, tabela, ['Destinatario_Oficio', 'Destinatário_Ofício', 'Destinatario Oficio', 'Destinatário Ofício']),
            tipoContato: obterCelulaFormalizacao(linha, tabela, ['Tipo_Contato', 'Tipo Contato']),
            emailInstitucional: primeiroTextoComValor([emailTitular, emailGabinete]),
            telefoneInstitucional: primeiroTextoComValor([celularTitular, telefoneTitular, contatoChefe, contatoSecretaria, ramaisGabinete])
        });
    });

    return porUf;
}

function extrairPessoasContatos(workbook, linhasInvalidas = []) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_CONTATOS_PESSOAS, ['UF', 'Papel', 'Nome']);
    if (!tabela) {
        throw new Error(`A aba ${ABA_CONTATOS_PESSOAS} nao foi encontrada ou nao possui os cabecalhos esperados.`);
    }

    const porUf = new Map();
    tabela.linhas.forEach((linha) => {
        const uf = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF']));
        if (!ufContatoValida(uf)) {
            registrarLinhaContatoInvalida(linhasInvalidas, ABA_CONTATOS_PESSOAS, linha, uf);
            return;
        }

        const pessoa = {
            uf,
            estado: obterCelulaFormalizacao(linha, tabela, ['Estado']),
            orgao: obterCelulaFormalizacao(linha, tabela, ['Órgão_Entidade', 'Órgão Entidade', 'Orgao Entidade']),
            sigla: obterCelulaFormalizacao(linha, tabela, ['Sigla']),
            tipoOrgao: obterCelulaFormalizacao(linha, tabela, ['Tipo_Órgão', 'Tipo Órgão', 'Tipo Orgao']),
            papel: obterCelulaFormalizacao(linha, tabela, ['Papel']),
            cargo: obterCelulaFormalizacao(linha, tabela, ['Cargo/Função', 'Cargo Função', 'Cargo Funcao']),
            nome: obterCelulaFormalizacao(linha, tabela, ['Nome']),
            cpf: obterCelulaFormalizacao(linha, tabela, ['CPF']),
            telefone: obterCelulaFormalizacao(linha, tabela, ['Telefone/Contato', 'Telefone Contato', 'Telefone']),
            email: obterCelulaFormalizacao(linha, tabela, ['E-mail', 'Email']),
            tipoContato: obterCelulaFormalizacao(linha, tabela, ['Tipo_Contato', 'Tipo Contato']),
            destinatarioOficioFlag: obterCelulaFormalizacao(linha, tabela, ['Destinatario_Oficio', 'Destinatário_Ofício', 'Destinatario Oficio', 'Destinatário Ofício']),
            tratamentoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Tratamento_Destinatario', 'Tratamento Destinatario', 'Tratamento Destinatário']),
            enderecoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Endereco_Destinatario', 'Endereço_Destinatario', 'Endereco Destinatario', 'Endereço Destinatário']),
            complementoEnderecoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Complemento_Endereco_Destinatario', 'Complemento Endereco Destinatario', 'Complemento Endereço Destinatário']),
            bairroDestinatario: obterCelulaFormalizacao(linha, tabela, ['Bairro_Destinatario', 'Bairro Destinatario', 'Bairro Destinatário']),
            cepDestinatario: obterCelulaFormalizacao(linha, tabela, ['CEP_Destinatario', 'CEP Destinatario', 'CEP Destinatário']),
            cidadeDestinatario: obterCelulaFormalizacao(linha, tabela, ['Cidade_Destinatario', 'Cidade Destinatario', 'Cidade Destinatário']),
            siglaUfDestinatario: obterCelulaFormalizacao(linha, tabela, ['Sigla_UF_Destinatario', 'Sigla UF Destinatario', 'Sigla UF Destinatário']),
            telefoneFixoDestinatario: obterCelulaFormalizacao(linha, tabela, ['Telefone_Fixo_Destinatario', 'Telefone Fixo Destinatario', 'Telefone Fixo Destinatário']),
            telefoneCelularDestinatario: obterCelulaFormalizacao(linha, tabela, ['Telefone_Celular_Destinatario', 'Telefone Celular Destinatario', 'Telefone Celular Destinatário']),
            emailDestinatario: obterCelulaFormalizacao(linha, tabela, ['Email_Destinatario', 'E-mail_Destinatario', 'Email Destinatario', 'E-mail Destinatário']),
            observacoes: obterCelulaFormalizacao(linha, tabela, ['Observações', 'Observacoes', 'Observação'])
        };

        if (!textoPossuiValor(pessoa.papel) && !textoPossuiValor(pessoa.nome) && !textoPossuiValor(pessoa.email) && !textoPossuiValor(pessoa.telefone)) {
            return;
        }

        if (!porUf.has(uf)) {
            porUf.set(uf, []);
        }
        porUf.get(uf).push(pessoa);
    });

    return porUf;
}

function campoDestinatarioExplicito(valor) {
    return textoPossuiValor(valor);
}

function contatoMarcadoComoDestinatario(contato = {}) {
    const tipo = normalizarTexto(contato.tipoContato).replace(/[^A-Z0-9]+/g, '');
    const flag = normalizarTexto(contato.destinatarioOficioFlag).replace(/[^A-Z0-9]+/g, '');
    return valorEhSim(contato.destinatarioOficioFlag)
        || flag === 'DESTINATARIO'
        || flag === 'DESTINATARIOOFICIO'
        || tipo === 'SECRETARIOTITULAR'
        || tipo === 'DESTINATARIOOFICIO';
}

function cadastroTemDestinatarioExplicito(cadastro = {}) {
    return [
        cadastro.tratamentoDestinatario,
        cadastro.nomeDestinatario,
        cadastro.cargoDestinatario,
        cadastro.enderecoDestinatario,
        cadastro.emailDestinatario,
        cadastro.telefoneFixoDestinatario,
        cadastro.telefoneCelularDestinatario
    ].some(campoDestinatarioExplicito) || contatoMarcadoComoDestinatario(cadastro);
}

function valoresUnicosComValor(valores) {
    return Array.from(new Set(
        valores
            .flatMap((valor) => String(valor ?? '').split(/[;|]+/))
            .map((valor) => valor.replace(/\s+/g, ' ').trim())
            .filter(textoPossuiValor)
    ));
}

function extrairEmailsTexto(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return [];
    return texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

function emailTemFormatoValido(valor) {
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(valor || '').trim());
}

function coletarEmailsContato(valores) {
    return Array.from(new Set(
        valores
            .flatMap((valor) => extrairEmailsTexto(valor))
            .map((email) => email.trim())
            .filter(emailTemFormatoValido)
    ));
}

function coletarEmailsInvalidosContato(uf, origem, valores) {
    return valores.flatMap((valor) => {
        const texto = String(valor ?? '').trim();
        if (!texto) return [];

        const tokens = texto
            .split(/[;,|\s]+/)
            .map((token) => token.trim())
            .filter(Boolean)
            .filter((token) => token.includes('@'));

        if (!tokens.length && textoPossuiValor(texto)) {
            return [{ uf, origem, valor: texto }];
        }

        return tokens
            .filter((token) => !emailTemFormatoValido(token))
            .map((token) => ({ uf, origem, valor: token }));
    });
}

function telefoneTemPadraoMinimo(valor) {
    return String(valor ?? '').replace(/\D/g, '').length >= 8;
}

// Consolida o destinatário do ofício com precedência determinística:
// campos explícitos da UF, contato nominal marcado e, por último, legado do titular.
function normalizarDestinatarioOficioContato(cadastro = {}, pessoas = []) {
    const pessoasDestinatarias = pessoas.filter(contatoMarcadoComoDestinatario);
    const candidatosOficiais = [
        ...(cadastroTemDestinatarioExplicito(cadastro) ? [cadastro] : []),
        ...pessoasDestinatarias
    ];
    const origemOficial = cadastroTemDestinatarioExplicito(cadastro)
        ? 'cadastro_destinatario'
        : pessoasDestinatarias.length
            ? 'pessoa_destinataria'
            : '';
    const fonteOficial = candidatosOficiais[0];
    const fonteLegada = campoDestinatarioExplicito(cadastro.nomeTitular) || campoDestinatarioExplicito(cadastro.cargoTitular)
        ? cadastro
        : null;
    const fonte = fonteOficial || fonteLegada || {};
    const origem = origemOficial || (fonteLegada ? 'cadastro_legado' : '');

    const destinatario = {
        origem,
        inferido: origem === 'cadastro_legado',
        duplicado: candidatosOficiais.length > 1,
        tratamento: primeiroTextoComValor([fonte.tratamentoDestinatario, cadastro.tratamentoDestinatario]),
        nome: primeiroTextoComValor([fonte.nomeDestinatario, fonte.nome, cadastro.nomeDestinatario, cadastro.nomeTitular]),
        cargo: primeiroTextoComValor([fonte.cargoDestinatario, fonte.cargo, cadastro.cargoDestinatario, cadastro.cargoTitular]),
        endereco: primeiroTextoComValor([fonte.enderecoDestinatario, cadastro.enderecoDestinatario, cadastro.endereco]),
        complemento: primeiroTextoComValor([fonte.complementoEnderecoDestinatario, cadastro.complementoEnderecoDestinatario]),
        bairro: primeiroTextoComValor([fonte.bairroDestinatario, cadastro.bairroDestinatario]),
        cep: primeiroTextoComValor([fonte.cepDestinatario, cadastro.cepDestinatario, cadastro.cep]),
        cidade: primeiroTextoComValor([fonte.cidadeDestinatario, cadastro.cidadeDestinatario, cadastro.estado]),
        uf: primeiroTextoComValor([fonte.siglaUfDestinatario, fonte.uf, cadastro.siglaUfDestinatario, cadastro.uf]),
        telefones: valoresUnicosComValor([
            cadastro.contatoSecretaria,
            fonte.telefoneFixoDestinatario,
            fonte.telefoneCelularDestinatario,
            fonte.telefone,
            cadastro.telefoneFixoDestinatario,
            cadastro.telefoneCelularDestinatario,
            cadastro.telefoneTitular,
            cadastro.celularTitular,
            cadastro.ramaisGabinete
        ]),
        emails: coletarEmailsContato([
            fonte.emailDestinatario,
            cadastro.emailDestinatario,
            cadastro.emailGabinete,
            cadastro.emailTitular,
            fonte.email
        ])
    };

    const camposFaltantes = [];
    if (!textoPossuiValor(destinatario.nome)) camposFaltantes.push('nome');
    if (!textoPossuiValor(destinatario.cargo)) camposFaltantes.push('cargo');
    if (!textoPossuiValor(destinatario.endereco)) camposFaltantes.push('endereço');
    if (!destinatario.telefones.some(telefoneTemPadraoMinimo)) camposFaltantes.push('telefone');
    if (!destinatario.emails.length) camposFaltantes.push('e-mail');

    destinatario.camposFaltantes = camposFaltantes;
    destinatario.completo = camposFaltantes.length === 0;
    destinatario.temDados = [
        destinatario.tratamento,
        destinatario.nome,
        destinatario.cargo,
        destinatario.endereco,
        destinatario.cep,
        destinatario.cidade,
        destinatario.uf,
        ...destinatario.telefones,
        ...destinatario.emails
    ].some(textoPossuiValor);

    return destinatario;
}

// Gera o diagnóstico consumido pela tela de Contatos; a UI apenas renderiza estes achados.
function montarDiagnosticoContatos(cadastroPorUf, pessoasPorUf, linhasInvalidas = []) {
    const ufs = Array.from(new Set([...cadastroPorUf.keys(), ...pessoasPorUf.keys()])).sort();
    const ufsComCadastro = Array.from(cadastroPorUf.keys()).sort();
    const ufsSemCadastro = ufs.filter((uf) => !cadastroPorUf.has(uf));
    const ufsSemDestinatario = [];
    const ufsComDestinatarioIncompleto = [];
    const destinatariosDuplicados = [];
    const telefonesAusentes = [];
    const emailsInvalidos = [];

    ufs.forEach((uf) => {
        const cadastro = cadastroPorUf.get(uf) || { uf };
        const pessoas = pessoasPorUf.get(uf) || [];
        const destinatario = normalizarDestinatarioOficioContato(cadastro, pessoas);

        if (cadastroPorUf.has(uf)) {
            cadastro.destinatarioOficio = destinatario;
        }

        if (!destinatario.temDados) {
            ufsSemDestinatario.push(uf);
        } else if (!destinatario.completo) {
            ufsComDestinatarioIncompleto.push({
                uf,
                camposFaltantes: destinatario.camposFaltantes,
                origem: destinatario.origem
            });
        }

        if (!destinatario.telefones.some(telefoneTemPadraoMinimo)) {
            telefonesAusentes.push(uf);
        }

        if (destinatario.duplicado) {
            const quantidadeDestinatarios = (cadastroTemDestinatarioExplicito(cadastro) ? 1 : 0)
                + pessoas.filter(contatoMarcadoComoDestinatario).length;
            destinatariosDuplicados.push({
                uf,
                quantidade: quantidadeDestinatarios
            });
        }

        emailsInvalidos.push(
            ...coletarEmailsInvalidosContato(uf, ABA_CONTATOS_UF, [
                cadastro.emailDestinatario,
                cadastro.emailGabinete,
                cadastro.emailTitular,
                cadastro.emailSubstituto
            ]),
            ...pessoas.flatMap((pessoa) => coletarEmailsInvalidosContato(uf, ABA_CONTATOS_PESSOAS, [
                pessoa.emailDestinatario,
                pessoa.email
            ]))
        );
    });

    const severidadeGeral = linhasInvalidas.length || ufsSemCadastro.length || ufsSemDestinatario.length || destinatariosDuplicados.length
        ? 'danger'
        : ufsComDestinatarioIncompleto.length || emailsInvalidos.length || telefonesAusentes.length
            ? 'warning'
            : 'success';

    return {
        ufsComCadastro,
        ufsSemCadastro,
        ufsSemDestinatario,
        ufsComDestinatarioIncompleto,
        destinatariosDuplicados,
        emailsInvalidos,
        telefonesAusentes,
        linhasIgnoradasPorUfInvalida: linhasInvalidas,
        severidadeGeral
    };
}

function extrairDadosContatosFormalizacao(workbookContatos) {
    const linhasInvalidas = [];
    const cadastroPorUf = extrairCadastroInstitucionalContatos(workbookContatos, linhasInvalidas);
    const pessoasPorUf = extrairPessoasContatos(workbookContatos, linhasInvalidas);

    return {
        cadastroPorUf,
        pessoasPorUf,
        diagnostico: montarDiagnosticoContatos(cadastroPorUf, pessoasPorUf, linhasInvalidas),
        disponivel: true,
        erro: ''
    };
}

function extrairPlanoAplicacaoFormalizacao(workbook, uf) {
    const tabela = obterTabelaFormalizacao(workbook, `Plano_${uf}`, ['ID_Item']);
    if (!tabela) {
        return [];
    }

    return tabela.linhas.map((linha, index) => {
        const item = obterCelulaFormalizacao(linha, tabela, ['Item']);
        const descricao = obterCelulaFormalizacao(linha, tabela, ['Descrição detalhada', 'Descrição']);
        const idProposta = obterCelulaFormalizacao(linha, tabela, ['ID_Proposta', 'ID Proposta']);
        const quantidade = converterNumeroPlanilha(obterCelulaFormalizacao(linha, tabela, ['Quantidade']));
        const valorUnitario = obterNumeroFormalizacao(linha, tabela, ['Valor Unitário', 'Valor Unitario']);
        const valorTotalInformado = obterNumeroFormalizacao(linha, tabela, ['Valor Total']);
        const valorTotalCalculado = arredondarMoeda(quantidade * valorUnitario);
        const valorTotal = valorTotalCalculado > 0 ? valorTotalCalculado : valorTotalInformado;

        if (!item && !descricao && !valorTotal && !idProposta) {
            return null;
        }

        return {
            idItem: obterCelulaFormalizacao(linha, tabela, ['ID_Item', 'ID Item'], `${uf}-${index + 1}`),
            idProposta,
            uf: normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF'], uf)),
            categoria: obterCelulaFormalizacao(linha, tabela, ['Categoria']),
            item,
            descricao,
            unidade: obterCelulaFormalizacao(linha, tabela, ['Unidade de Medida', 'Unidade']),
            quantidade,
            valorUnitario,
            valorTotal,
            valorTotalInformado,
            valorTotalCalculado,
            divergenciaItem: arredondarMoeda(valorTotalCalculado - valorTotalInformado),
            fonteRecurso: obterCelulaFormalizacao(linha, tabela, ['Fonte do Recurso', 'Fonte']),
            naturezaDespesa: obterCelulaFormalizacao(linha, tabela, ['Natureza da Despesa', 'Natureza']),
            elegivel: obterCelulaFormalizacao(linha, tabela, ['Elegível ao PROFOR?', 'Elegível?'], 'Sim'),
            observacao: obterCelulaFormalizacao(linha, tabela, ['Observação'])
        };
    }).filter(Boolean);
}

function somarValoresPorCampo(itens, campo) {
    const mapa = itens.reduce((acc, item) => {
        const chave = item[campo] || 'Não informado';
        acc[chave] = acc[chave] || { nome: chave, total: 0, itens: 0 };
        acc[chave].total = arredondarMoeda(acc[chave].total + (Number(item.valorTotal) || 0));
        acc[chave].itens += 1;
        return acc;
    }, {});

    return Object.values(mapa).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function planoContemItemIncompativel(item) {
    const texto = normalizarTexto(`${item.categoria} ${item.item} ${item.descricao} ${item.observacao}`);
    return valorEhNao(item.elegivel) || /\bOBRAS?\b|\bREFORMAS?\b/.test(texto);
}

function montarResumoPlanoFormalizacao(itens, valorGlobal) {
    const totalCentavos = itens.reduce((total, item) => total + moedaParaCentavos(item.valorTotal), 0);
    const valorGlobalCentavos = moedaParaCentavos(valorGlobal);
    const diferencaCentavos = totalCentavos - valorGlobalCentavos;
    const itensInelegiveis = itens.filter(planoContemItemIncompativel);

    return {
        itens,
        total: centavosParaMoeda(totalCentavos),
        valorGlobal,
        diferenca: centavosParaMoeda(diferencaCentavos),
        fechaComValorGlobal: Math.abs(diferencaCentavos) <= TOLERANCIA_VALIDACAO_CENTAVOS,
        quantidadeItens: itens.length,
        porCategoria: somarValoresPorCampo(itens, 'categoria'),
        porNatureza: somarValoresPorCampo(itens, 'naturezaDespesa'),
        porFonte: somarValoresPorCampo(itens, 'fonteRecurso'),
        itensInelegiveis
    };
}

function obterCodigosDocumentosPorEtapa(dicionario, etapa, uf) {
    const etapaNormalizada = normalizarTexto(etapa);
    return Array.from(dicionario.values())
        .filter((documento) => normalizarTexto(documento.etapa).includes(etapaNormalizada))
        .filter((documento) => documento.obrigatorio && documentoAplicavelAUf(documento, uf))
        .sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || a.codigo.localeCompare(b.codigo))
        .map((documento) => documento.codigo);
}

function montarDocumentoFormalizacao(codigo, etapa, propostaBase, dicionario, checklistPorCodigo) {
    const detalhes = checklistPorCodigo?.get(codigo);
    const catalogo = dicionario.get(codigo);
    const valorPainel = propostaBase.documentosPainel[codigo];
    const enviadoPainel = valorEhSim(valorPainel);
    const naoSeAplica = valorNaoSeAplica(valorPainel) || valorNaoSeAplica(detalhes?.statusAnalise);
    const enviado = !naoSeAplica && (detalhes?.enviado || enviadoPainel);
    const statusAnalise = naoSeAplica
        ? 'Não se aplica'
        : detalhes?.statusAnalise || (enviado ? 'Enviado' : 'Não enviado');

    return {
        codigo,
        etapa,
        nome: detalhes?.nome || catalogo?.nome || codigo,
        descricao: catalogo?.descricao || detalhes?.observacao || '',
        obrigatorio: detalhes?.obrigatorio ?? catalogo?.obrigatorio ?? true,
        enviado,
        enviadoPainel,
        valorPainel,
        statusAnalise,
        dataEnvio: detalhes?.dataEnvio || '',
        unidadeResponsavel: detalhes?.unidadeResponsavel || '',
        link: detalhes?.link || '',
        pendencia: detalhes?.pendencia || '',
        dataValidacao: detalhes?.dataValidacao || '',
        observacao: detalhes?.observacao || ''
    };
}

function calcularProgressoDocumentos(documentos) {
    const exigidos = documentos.filter((documento) => documento.obrigatorio && !valorNaoSeAplica(documento.statusAnalise));
    const enviados = exigidos.filter((documento) => documento.enviado);
    const validados = exigidos.filter((documento) => normalizarTexto(documento.statusAnalise) === 'VALIDADO');

    return {
        total: exigidos.length,
        enviados: enviados.length,
        validados: validados.length,
        percentual: exigidos.length ? (enviados.length / exigidos.length) * 100 : 0,
        percentualValidado: exigidos.length ? (validados.length / exigidos.length) * 100 : 0,
        completo: exigidos.length > 0 && enviados.length === exigidos.length,
        validado: exigidos.length > 0 && validados.length === exigidos.length
    };
}

function gerarAlertasFormalizacao(proposta) {
    const alertas = [];
    const adicionar = (severidade, tipo, mensagem) => {
        alertas.push({ severidade, tipo, mensagem });
    };

    if (!UFS_FORMALIZACAO_PROFOR.includes(proposta.uf)) {
        adicionar('critico', 'UF não elegível', 'UF fora da lista das 14 Unidades Federativas autorizadas para esta rodada.');
    }

    if (!proposta.validacoes.valorRepasseOk) {
        adicionar('critico', 'Valor de repasse', 'Valor de repasse diferente de R$ 200.000,00.');
    }

    if (!proposta.validacoes.valorGlobalOk) {
        adicionar('critico', 'Valor global', 'Valor global diferente da soma entre repasse e contrapartida.');
    }

    if (!proposta.plano.fechaComValorGlobal) {
        adicionar('critico', 'Divergência financeira', 'Plano de aplicação não fecha com o valor global da proposta.');
    }

    if (proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida) {
        adicionar('critico', 'Condição suspensiva pendente', 'Ato normativo publicado ainda não foi comprovado para a UF.');
    }

    if (!proposta.falaBr.previsto) {
        adicionar('critico', 'Fala.BR não previsto', 'A proposta não registra previsão de adesão, integração ou indicação da Plataforma Fala.BR.');
    }

    if (!proposta.progressoDocumentosProjeto.completo) {
        adicionar('critico', 'Documento pendente', 'Há documento essencial da etapa de projeto ainda não enviado.');
    }

    if (proposta.plano.itensInelegiveis.length > 0) {
        adicionar('critico', 'Item incompatível', `${proposta.plano.itensInelegiveis.length} item(ns) do plano podem estar fora do objeto do PROFOR/ONASP.`);
    }

    if (!proposta.progressoDocumentosFormalizacao.completo) {
        adicionar('moderado', 'Formalização pendente', 'Documentos de formalização ainda não foram enviados integralmente.');
    }

    const documentosNaoValidados = [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
        .filter((documento) => documento.enviado && normalizarTexto(documento.statusAnalise) !== 'VALIDADO' && normalizarTexto(documento.statusAnalise) !== 'NAO SE APLICA');
    if (documentosNaoValidados.length > 0) {
        adicionar('moderado', 'Documento em análise', `${documentosNaoValidados.length} documento(s) enviado(s) ainda não estão validados.`);
    }

    const documentosComPendencia = [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
        .filter((documento) => textoPossuiValor(documento.pendencia) || ['REPROVADO', 'PENDENTE DE CORRECAO'].includes(normalizarTexto(documento.statusAnalise)));
    if (documentosComPendencia.length > 0) {
        adicionar('moderado', 'Pendência documental', `${documentosComPendencia.length} documento(s) possuem pendência ou necessidade de correção.`);
    }

    if (!proposta.contatosDisponiveis) {
        adicionar('moderado', 'Contatos indisponíveis', 'Cadastro institucional ou contatos da UF não foram localizados na planilha Contatos.');
    } else {
        const temEmailContato = textoPossuiValor(proposta.gestor.email)
            || textoPossuiValor(proposta.cadastroInstitucional?.emailGabinete)
            || proposta.contatosPessoas.some((pessoa) => textoPossuiValor(pessoa.email));
        const temTelefoneContato = textoPossuiValor(proposta.gestor.telefone)
            || proposta.contatosPessoas.some((pessoa) => textoPossuiValor(pessoa.telefone));

        if (!temEmailContato || !temTelefoneContato) {
            adicionar('moderado', 'Contato incompleto', 'Há e-mail institucional ou telefone/contato ausente no cadastro da UF.');
        }
    }

    const documentosSemLink = [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
        .filter((documento) => documento.enviado && !textoPossuiValor(documento.link));
    if (documentosSemLink.length > 0) {
        adicionar('moderado', 'Link ausente', `${documentosSemLink.length} documento(s) enviado(s) não possuem link SEI/Transferegov informado.`);
    }

    const status = normalizarTexto(proposta.situacaoGeral);
    if (status.includes('ELABORACAO') || status.includes('ANALISE')) {
        adicionar('informativo', 'Proposta em tramitação', `Status informado: ${proposta.situacaoGeral}.`);
    }

    if (proposta.progressoGeral > 0 && proposta.progressoGeral < 100) {
        adicionar('informativo', 'Avanço parcial', `Progresso geral calculado em ${proposta.progressoGeral.toFixed(1).replace('.', ',')}%.`);
    }

    return alertas;
}

function calcularTrilhaFormalizacao(proposta) {
    const status = normalizarTexto(proposta.situacaoGeral);
    const semAlertasCriticos = !proposta.alertas.some((alerta) => alerta.severidade === 'critico');
    const aptaPelasRegras = proposta.progressoDocumentosProjeto.completo
        && proposta.progressoDocumentosFormalizacao.completo
        && proposta.plano.fechaComValorGlobal
        && proposta.falaBr.previsto
        && proposta.condicaoSuspensiva.resolvida
        && proposta.validacoes.valorRepasseOk
        && proposta.validacoes.valorGlobalOk
        && semAlertasCriticos;

    const etapas = [
        {
            chave: 'proposta-cadastrada',
            rotulo: 'Proposta cadastrada',
            concluida: textoPossuiValor(proposta.numeroProposta)
        },
        {
            chave: 'docs-projeto',
            rotulo: 'Documentos do projeto enviados',
            concluida: proposta.progressoDocumentosProjeto.completo
        },
        {
            chave: 'projeto-aprovado',
            rotulo: 'Projeto aprovado',
            concluida: proposta.progressoDocumentosProjeto.validado || status.includes('PROJETO APROVADO') || status.includes('APTA')
        },
        {
            chave: 'docs-formalizacao',
            rotulo: 'Documentos de formalização enviados',
            concluida: proposta.progressoDocumentosFormalizacao.completo
        },
        {
            chave: 'condicao-suspensiva',
            rotulo: 'Condição suspensiva resolvida',
            concluida: proposta.condicaoSuspensiva.resolvida,
            naoSeAplica: !proposta.condicaoSuspensiva.exige
        },
        {
            chave: 'plano-validado',
            rotulo: 'Plano de aplicação validado',
            concluida: proposta.plano.fechaComValorGlobal
        },
        {
            chave: 'apta-celebracao',
            rotulo: 'Apta à celebração',
            concluida: aptaPelasRegras || status.includes('APTA A CELEBRACAO')
        },
        {
            chave: 'convenio-celebrado',
            rotulo: 'Convênio celebrado',
            concluida: status.includes('CELEBRADO') || status.includes('PUBLICADO') || status.includes('EXECUCAO')
        },
        {
            chave: 'instrumento-publicado',
            rotulo: 'Instrumento publicado',
            concluida: status.includes('PUBLICADO') || status.includes('EXECUCAO')
        }
    ];

    let etapaAtualMarcada = false;
    return etapas.map((etapa) => {
        if (etapa.naoSeAplica) {
            return { ...etapa, estado: 'nao-aplica' };
        }
        if (etapa.concluida) {
            return { ...etapa, estado: 'concluida' };
        }
        if (!etapaAtualMarcada) {
            etapaAtualMarcada = true;
            return { ...etapa, estado: 'atual' };
        }
        return { ...etapa, estado: 'pendente' };
    });
}

function calcularProgressoGeralFormalizacao(proposta) {
    const projeto = proposta.progressoDocumentosProjeto.percentual / 100;
    const formalizacao = proposta.progressoDocumentosFormalizacao.percentual / 100;
    const plano = proposta.plano.fechaComValorGlobal ? 1 : 0;
    const falaBr = proposta.falaBr.previsto ? 1 : 0;
    const condicao = proposta.condicaoSuspensiva.resolvida ? 1 : 0;

    return Math.max(0, Math.min(100, (projeto * 30) + (formalizacao * 40) + (plano * 15) + (falaBr * 5) + (condicao * 10)));
}

function montarPropostasFormalizacao(workbook, contatosFormalizacao = criarContatosFormalizacaoVazios()) {
    const painel = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_PAINEL, ['ID_Proposta', 'UF']);
    if (!painel) {
        throw new Error(`A aba ${ABA_FORMALIZACAO_PAINEL} nao foi encontrada ou nao possui os cabecalhos esperados.`);
    }

    const dicionario = extrairDicionarioDocumentosFormalizacao(workbook);
    const checklist = extrairChecklistFormalizacao(workbook);

    return painel.linhas.map((linha) => {
        const idProposta = obterCelulaFormalizacao(linha, painel, ['ID_Proposta', 'ID Proposta']);
        const uf = normalizarTexto(obterCelulaFormalizacao(linha, painel, ['UF']));
        if (!idProposta || !uf) return null;

        const valorRepasse = obterNumeroFormalizacao(linha, painel, ['Valor de Repasse', 'Valor Repasse']);
        const valorContrapartida = obterNumeroFormalizacao(linha, painel, ['Valor de Contrapartida', 'Valor Contrapartida']);
        const valorGlobal = obterNumeroFormalizacao(linha, painel, ['Valor Global']);
        const documentosPainel = {};
        painel.headers.forEach((header, index) => {
            if (/^DOC (PROJ|FORM) \d+$/i.test(header)) {
                documentosPainel[header.replace(/ /g, '_')] = obterCelulaFormalizacao(linha, { indice: () => index }, header);
            }
        });

        const planoItens = extrairPlanoAplicacaoFormalizacao(workbook, uf).filter((item) => (
            !item.idProposta || item.idProposta === idProposta
        ));
        const plano = montarResumoPlanoFormalizacao(planoItens, valorGlobal);
        const checklistProposta = checklist.get(idProposta) || new Map();
        const codigosProjeto = obterCodigosDocumentosPorEtapa(dicionario, 'Projeto', uf);
        const codigosFormalizacao = obterCodigosDocumentosPorEtapa(dicionario, 'Formalização', uf);
        const codigosProjetoBase = codigosProjeto.length ? codigosProjeto : Object.keys(documentosPainel).filter((codigo) => codigo.startsWith('DOC_PROJ'));
        const codigosFormalizacaoBase = codigosFormalizacao.length ? codigosFormalizacao : Object.keys(documentosPainel).filter((codigo) => codigo.startsWith('DOC_FORM'));

        const propostaBase = { documentosPainel };
        const documentosProjeto = codigosProjetoBase.map((codigo) => montarDocumentoFormalizacao(codigo, 'Projeto', propostaBase, dicionario, checklistProposta));
        const documentosFormalizacao = codigosFormalizacaoBase.map((codigo) => montarDocumentoFormalizacao(codigo, 'Formalização', propostaBase, dicionario, checklistProposta));
        const progressoDocumentosProjeto = calcularProgressoDocumentos(documentosProjeto);
        const progressoDocumentosFormalizacao = calcularProgressoDocumentos(documentosFormalizacao);
        const cadastroInstitucional = contatosFormalizacao.cadastroPorUf.get(uf) || {
            uf,
            estado: obterCelulaFormalizacao(linha, painel, ['Estado'], uf),
            regiao: '',
            orgao: '',
            sigla: '',
            tipoOrgao: '',
            cnpj: '',
            endereco: '',
            cep: '',
            emailGabinete: '',
            chefeGabinete: '',
            contatoChefe: '',
            secretariaGabinete: '',
            contatoSecretaria: '',
            ramaisGabinete: '',
            observacoes: ''
        };
        const contatosPessoas = contatosFormalizacao.pessoasPorUf.get(uf) || [];
        const contatosDisponiveis = contatosFormalizacao.disponivel && contatosFormalizacao.cadastroPorUf.has(uf);
        const condicaoPendenteRaw = obterCelulaFormalizacao(linha, painel, ['Condição Suspensiva Pendente?']);
        const exigeCondicao = UFS_CONDICAO_SUSPENSIVA_PROFOR.has(uf)
            || valorEhSim(obterCelulaFormalizacao(linha, painel, ['Exige Ato Normativo?', 'Ato normativo exigido?']));
        const atoEnviado = valorEhSim(obterCelulaFormalizacao(linha, painel, ['Ato Normativo Enviado?', 'Ato normativo enviado?']));
        const atoPublicadoRaw = obterCelulaFormalizacao(linha, painel, ['Ato Normativo Publicado?', 'Ato normativo publicado?']);
        const condicaoPendente = exigeCondicao
            ? (textoPossuiValor(condicaoPendenteRaw) ? valorEhSim(condicaoPendenteRaw) : !valorEhSim(atoPublicadoRaw))
            : false;
        const atoPublicado = valorEhSim(atoPublicadoRaw) || (exigeCondicao && atoEnviado && !condicaoPendente);
        const condicaoResolvida = !exigeCondicao || (!condicaoPendente && (atoPublicado || atoEnviado));

        const proposta = {
            idProposta,
            uf,
            estado: obterCelulaFormalizacao(linha, painel, ['Estado'], cadastroInstitucional.estado || uf),
            grupo: obterCelulaFormalizacao(linha, painel, ['Grupo']),
            numeroProposta: obterCelulaFormalizacao(linha, painel, ['Número da Proposta', 'Nº Proposta', 'N Proposta']),
            ano: obterCelulaFormalizacao(linha, painel, ['Ano']),
            processoSei: obterCelulaFormalizacao(linha, painel, ['Processo SEI']),
            situacaoGeral: obterCelulaFormalizacao(linha, painel, ['Situação Geral', 'Status Geral'], 'Não informado'),
            ultimaAtualizacao: obterDataFormalizacao(linha, painel, ['Última Atualização', 'Data da Última Atualização']),
            observacoes: obterCelulaFormalizacao(linha, painel, ['Observações', 'Observação']),
            fonteOrigem: obterCelulaFormalizacao(linha, painel, ['Fonte/Origem', 'Fonte']),
            gestor: {
                nome: cadastroInstitucional.nomeTitular || '',
                cargo: cadastroInstitucional.cargoTitular || '',
                orgao: cadastroInstitucional.orgao || '',
                email: primeiroTextoComValor([cadastroInstitucional.emailTitular, cadastroInstitucional.emailGabinete]),
                telefone: primeiroTextoComValor([
                    cadastroInstitucional.celularTitular,
                    cadastroInstitucional.telefoneTitular,
                    cadastroInstitucional.contatoChefe,
                    cadastroInstitucional.contatoSecretaria,
                    cadastroInstitucional.ramaisGabinete
                ])
            },
            responsavelTecnico: { nome: '', cargo: '', email: '', telefone: '' },
            responsaveisAtivos: contatosPessoas.map((pessoa) => ({
                uf,
                tipo: pessoa.papel,
                nome: pessoa.nome,
                cargo: pessoa.cargo,
                orgao: pessoa.orgao,
                email: pessoa.email,
                telefone: pessoa.telefone,
                ativo: true,
                observacao: pessoa.observacoes
            })),
            cadastroInstitucional,
            contatosPessoas,
            contatosDisponiveis,
            contatosErro: contatosFormalizacao.erro || '',
            valorRepasse,
            valorContrapartida,
            valorGlobal,
            valorGlobalCalculado: arredondarMoeda(valorRepasse + valorContrapartida),
            percentualContrapartida: valorGlobal > 0 ? (valorContrapartida / valorGlobal) * 100 : 0,
            documentosPainel,
            documentosProjeto,
            documentosFormalizacao,
            progressoDocumentosProjeto,
            progressoDocumentosFormalizacao,
            plano,
            condicaoSuspensiva: {
                exige: exigeCondicao,
                atoEnviado,
                atoPublicado,
                dataPublicacao: obterDataFormalizacao(linha, painel, ['Data de Publicação', 'Data Publicação']),
                linkReferencia: obterCelulaFormalizacao(linha, painel, ['Link/Referência do Ato', 'Link Referência do Ato', 'Link do Ato']),
                pendente: condicaoPendente,
                resolvida: condicaoResolvida,
                situacao: !exigeCondicao
                    ? 'Não se aplica'
                    : condicaoResolvida
                        ? 'Resolvido'
                        : atoEnviado
                            ? 'Enviado, aguardando análise'
                            : 'Pendente'
            },
            falaBr: {
                previsto: valorEhSim(obterCelulaFormalizacao(linha, painel, ['FalaBR_Previsto', 'Fala.BR previsto no cronograma?', 'FalaBR Previsto'])),
                forma: obterCelulaFormalizacao(linha, painel, ['FalaBR_Forma', 'FalaBR Forma', 'Fala.BR Forma']),
                observacao: obterCelulaFormalizacao(linha, painel, ['FalaBR_Observacao', 'FalaBR Observacao', 'Fala.BR Observação'])
            },
            validacoes: {
                ufElegivel: UFS_FORMALIZACAO_PROFOR.includes(uf),
                valorRepasseOk: Math.abs(moedaParaCentavos(valorRepasse) - moedaParaCentavos(VALOR_REPASSE_PROFOR)) <= TOLERANCIA_VALIDACAO_CENTAVOS,
                valorGlobalOk: Math.abs(moedaParaCentavos(valorGlobal) - moedaParaCentavos(valorRepasse + valorContrapartida)) <= TOLERANCIA_VALIDACAO_CENTAVOS
            }
        };

        proposta.progressoGeral = calcularProgressoGeralFormalizacao(proposta);
        proposta.alertas = gerarAlertasFormalizacao(proposta);
        proposta.trilha = calcularTrilhaFormalizacao(proposta);
        proposta.situacaoPlano = proposta.plano.fechaComValorGlobal ? 'Plano de aplicação compatível' : 'Divergência no plano de aplicação';
        proposta.aptaCelebracao = proposta.trilha.find((etapa) => etapa.chave === 'apta-celebracao')?.concluida || false;

        return proposta;
    }).filter((proposta) => proposta && UFS_FORMALIZACAO_PROFOR.includes(proposta.uf))
        .sort((a, b) => a.uf.localeCompare(b.uf, 'pt-BR'));
}

function montarResumoFormalizacao(propostas) {
    const totalValorGlobalCentavos = propostas.reduce((total, proposta) => total + moedaParaCentavos(proposta.valorGlobal), 0);
    const alertas = propostas.flatMap((proposta) => (
        proposta.alertas.map((alerta) => ({
            ...alerta,
            uf: proposta.uf,
            estado: proposta.estado,
            idProposta: proposta.idProposta
        }))
    ));

    return {
        totalPropostas: propostas.length,
        totalValorGlobal: centavosParaMoeda(totalValorGlobalCentavos),
        totalRepasse: propostas.reduce((total, proposta) => total + proposta.valorRepasse, 0),
        totalContrapartida: propostas.reduce((total, proposta) => total + proposta.valorContrapartida, 0),
        aptasCelebracao: propostas.filter((proposta) => proposta.aptaCelebracao).length,
        planosCompativeis: propostas.filter((proposta) => proposta.plano.fechaComValorGlobal).length,
        condicoesPendentes: propostas.filter((proposta) => proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida).length,
        falaBrPendentes: propostas.filter((proposta) => !proposta.falaBr.previsto).length,
        alertasCriticos: alertas.filter((alerta) => alerta.severidade === 'critico').length,
        propostasComAlertaCritico: propostas.filter((proposta) => proposta.alertas.some((alerta) => alerta.severidade === 'critico')).length,
        mediaProgressoGeral: propostas.length
            ? propostas.reduce((total, proposta) => total + proposta.progressoGeral, 0) / propostas.length
            : 0,
        documentosProjetoCompletos: propostas.filter((proposta) => proposta.progressoDocumentosProjeto.completo).length,
        documentosFormalizacaoCompletos: propostas.filter((proposta) => proposta.progressoDocumentosFormalizacao.completo).length,
        alertas,
        filtros: {
            ufs: [...UFS_FORMALIZACAO_PROFOR],
            grupos: Array.from(new Set(propostas.map((proposta) => proposta.grupo).filter(Boolean))).sort(),
            status: Array.from(new Set(propostas.map((proposta) => proposta.situacaoGeral).filter(Boolean))).sort()
        }
    };
}

// A condição suspensiva pode aparecer com nomes diferentes na planilha; esta regra
// identifica o item documental esperado sem depender de um único código rígido.
function documentoRepresentaCondicaoSuspensiva(documento) {
    const texto = normalizarTexto(`${documento.codigo} ${documento.nome} ${documento.descricao}`);
    return texto.includes('ATO NORMATIVO') || texto.includes('CONDICAO SUSPENSIVA');
}

// Valida a planilha de formalização antes do filtro das 14 UFs mascarar erros de base.
function montarDiagnosticoFormalizacao(workbook, propostas) {
    const painel = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_PAINEL, ['ID_Proposta', 'UF']);
    const dicionario = extrairDicionarioDocumentosFormalizacao(workbook);
    const checklist = extrairChecklistFormalizacao(workbook);
    const registrosPainel = painel
        ? painel.linhas.map((linha) => ({
            idProposta: obterCelulaFormalizacao(linha, painel, ['ID_Proposta', 'ID Proposta']),
            uf: normalizarTexto(obterCelulaFormalizacao(linha, painel, ['UF'])),
            valorRepasse: obterNumeroFormalizacao(linha, painel, ['Valor de Repasse', 'Valor Repasse'])
        })).filter((registro) => registro.idProposta || registro.uf || registro.valorRepasse)
        : [];
    const ufsEncontradas = Array.from(new Set(registrosPainel.map((registro) => registro.uf).filter(Boolean))).sort();
    const ufsFaltantes = UFS_FORMALIZACAO_PROFOR.filter((uf) => !ufsEncontradas.includes(uf));
    const ufsExcedentes = ufsEncontradas.filter((uf) => !UFS_FORMALIZACAO_PROFOR.includes(uf));
    const totalRepasseEncontrado = registrosPainel.reduce((total, registro) => total + (Number(registro.valorRepasse) || 0), 0);
    const repassesDivergentes = registrosPainel
        .filter((registro) => UFS_FORMALIZACAO_PROFOR.includes(registro.uf))
        .filter((registro) => Math.abs(moedaParaCentavos(registro.valorRepasse) - moedaParaCentavos(VALOR_REPASSE_PROFOR)) > TOLERANCIA_VALIDACAO_CENTAVOS)
        .map((registro) => ({
            uf: registro.uf,
            idProposta: registro.idProposta,
            valor: registro.valorRepasse,
            esperado: VALOR_REPASSE_PROFOR
        }));
    const condicoesSuspensivasPendentes = propostas
        .filter((proposta) => proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida)
        .map((proposta) => ({
            uf: proposta.uf,
            situacao: proposta.condicaoSuspensiva.situacao,
            idProposta: proposta.idProposta
        }));
    const condicoesSuspensivasSemChecklist = Array.from(UFS_CONDICAO_SUSPENSIVA_PROFOR)
        .filter((uf) => {
            const proposta = propostas.find((item) => item.uf === uf);
            if (!proposta) return true;
            return ![...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
                .some(documentoRepresentaCondicaoSuspensiva);
        })
        .map((uf) => ({ uf, documento: 'Ato normativo publicado' }));
    const documentosObrigatoriosIncompletos = propostas.flatMap((proposta) => (
        [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
            .filter((documento) => documento.obrigatorio && !valorNaoSeAplica(documento.statusAnalise) && !documento.enviado)
            .map((documento) => ({
                uf: proposta.uf,
                codigo: documento.codigo,
                nome: documento.nome,
                etapa: documento.etapa
            }))
    ));
    const documentosEnviadosSemLink = propostas.flatMap((proposta) => (
        [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
            .filter((documento) => documento.enviado && !textoPossuiValor(documento.link))
            .map((documento) => ({
                uf: proposta.uf,
                codigo: documento.codigo,
                nome: documento.nome,
                etapa: documento.etapa
            }))
    ));
    const documentosSemDicionario = [];
    checklist.forEach((documentos, idProposta) => {
        documentos.forEach((documento, codigo) => {
            if (dicionario.has(codigo)) return;
            documentosSemDicionario.push({
                idProposta,
                uf: documento.uf,
                codigo,
                nome: documento.nome
            });
        });
    });

    const severidadeGeral = ufsFaltantes.length || ufsExcedentes.length || repassesDivergentes.length || condicoesSuspensivasSemChecklist.length || documentosSemDicionario.length
        ? 'danger'
        : condicoesSuspensivasPendentes.length || documentosObrigatoriosIncompletos.length || documentosEnviadosSemLink.length
            ? 'warning'
            : 'success';

    return {
        ufsEsperadas: [...UFS_FORMALIZACAO_PROFOR],
        ufsEncontradas,
        ufsFaltantes,
        ufsExcedentes,
        totalRepasseEsperado: UFS_FORMALIZACAO_PROFOR.length * VALOR_REPASSE_PROFOR,
        totalRepasseEncontrado: arredondarMoeda(totalRepasseEncontrado),
        repassesDivergentes,
        condicoesSuspensivasPendentes,
        condicoesSuspensivasSemChecklist,
        documentosObrigatoriosIncompletos,
        documentosSemDicionario,
        documentosEnviadosSemLink,
        severidadeGeral
    };
}

function extrairFormalizacaoProforDoWorkbook(workbook, contatosFormalizacao = criarContatosFormalizacaoVazios()) {
    const propostas = montarPropostasFormalizacao(workbook, contatosFormalizacao);
    return {
        arquivo: ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR,
        arquivoContatos: ARQUIVO_PLANILHA_CONTATOS,
        contatosDisponiveis: contatosFormalizacao.disponivel,
        contatosErro: contatosFormalizacao.erro || '',
        ufsAutorizadas: UFS_FORMALIZACAO_PROFOR,
        ufsCondicaoSuspensiva: Array.from(UFS_CONDICAO_SUSPENSIVA_PROFOR),
        valorRepassePadrao: VALOR_REPASSE_PROFOR,
        propostas,
        diagnostico: montarDiagnosticoFormalizacao(workbook, propostas),
        resumo: montarResumoFormalizacao(propostas)
    };
}

function obterTabelaDiagnosticoOuvidorias(workbook) {
    const nomesPreferenciais = ABAS_DIAGNOSTICO_OUVIDORIAS
        .map((nome) => obterNomeAbaWorkbook(workbook, [nome]))
        .filter(Boolean);
    const nomesParaBuscar = [...new Set([...nomesPreferenciais, ...workbook.SheetNames])];
    const perguntasConhecidas = new Set(PARAMETROS_DIAGNOSTICO_ONASP.flatMap((parametro) => (
        parametro.perguntas.map(normalizarCabecalhoPlanilha)
    )));

    for (const nomeAba of nomesParaBuscar) {
        const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAba]);
        const headerRowIndex = linhas.findIndex((linha) => {
            const cabecalhos = (linha || []).map(normalizarCabecalhoPlanilha);
            const possuiUf = cabecalhos.some((cabecalho) => ['UF', 'UNIDADE FEDERATIVA', 'ESTADO'].includes(cabecalho));
            const possuiPergunta = cabecalhos.some((cabecalho) => perguntasConhecidas.has(cabecalho));
            const possuiIdentificador = cabecalhos.includes('ID') || cabecalhos.includes('IDENTIFICADOR DA RESPOSTA');
            return possuiUf || possuiPergunta || possuiIdentificador;
        });

        if (headerRowIndex < 0) continue;

        const headersOriginais = linhas[headerRowIndex] || [];
        const headers = headersOriginais.map(normalizarCabecalhoPlanilha);
        const cacheIndices = new Map();
        const indice = (aliases) => {
            const listaAliases = Array.isArray(aliases) ? aliases : [aliases];
            const chave = listaAliases.join('|');
            if (cacheIndices.has(chave)) return cacheIndices.get(chave);

            const aliasesNormalizados = listaAliases.map(normalizarCabecalhoPlanilha);
            let encontrado = headers.findIndex((header) => aliasesNormalizados.includes(header));
            if (encontrado < 0) {
                encontrado = headers.findIndex((header) => aliasesNormalizados.some((alias) => header.includes(alias)));
            }

            cacheIndices.set(chave, encontrado);
            return encontrado;
        };

        return {
            nomeAba,
            headers,
            headersOriginais,
            linhas: linhas.slice(headerRowIndex + 1),
            indice
        };
    }

    return null;
}

function obterValorBrutoDiagnostico(linha, tabela, aliases) {
    const indice = tabela?.indice?.(aliases) ?? -1;
    return indice >= 0 ? linha[indice] : undefined;
}

function obterTextoDiagnostico(linha, tabela, aliases, fallback = '') {
    const valor = obterValorBrutoDiagnostico(linha, tabela, aliases);
    if (valor === undefined || valor === null) return fallback;
    if (valor instanceof Date) return formatarDataPlanilha(valor);

    const texto = limparTexto(valor);
    return texto || fallback;
}

function obterNumeroOpcionalDiagnostico(linha, tabela, aliases) {
    const valor = obterValorBrutoDiagnostico(linha, tabela, aliases);
    if (valor === undefined || valor === null || limparTexto(valor) === '') return null;
    const numero = converterNumeroPlanilha(valor);
    return Number.isFinite(numero) ? numero : null;
}

function normalizarUfDiagnostico(valor) {
    const texto = normalizarTexto(valor);
    if (!texto) return '';

    const match = texto.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    return match ? match[1] : '';
}

function converterDataDiagnosticoParaTimestamp(valor) {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return valor.getTime();
    }

    if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) {
        return new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400000)).getTime();
    }

    const texto = limparTexto(valor);
    if (!texto) return 0;

    const partesPtBr = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (partesPtBr) {
        const [, dia, mes, ano, hora = '0', minuto = '0', segundo = '0'] = partesPtBr;
        const data = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo));
        return Number.isNaN(data.getTime()) ? 0 : data.getTime();
    }

    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function normalizarValidacaoOnaspDiagnostico(valor, fallback = 'Pendente') {
    const texto = normalizarTexto(valor);
    if (texto.includes('VALIDADO')) return 'Validado';
    if (texto.includes('INCONSISTENTE')) return 'Inconsistente';
    if (texto.includes('NAO SE APLICA') || texto === 'NA') return 'Não se aplica';
    if (texto.includes('PENDENTE')) return 'Pendente';
    return fallback;
}

function normalizarRespostaBrutaDiagnostico(linha, tabela, index) {
    const uf = normalizarUfDiagnostico(obterTextoDiagnostico(linha, tabela, [
        'UF',
        'Unidade Federativa',
        'Estado',
        'Sigla UF'
    ]));

    if (!uf) return null;

    const valorData = obterValorBrutoDiagnostico(linha, tabela, [
        'Data/Hora de Conclusão',
        'Data de Conclusão',
        'Data/Hora da resposta',
        'Data da resposta',
        'Carimbo de data/hora',
        'Timestamp',
        'Hora de conclusão',
        'Hora de conclusao',
        'Hora de término',
        'Hora de termino',
        'Concluído em',
        'Data de envio'
    ]);
    const dataTimestamp = converterDataDiagnosticoParaTimestamp(valorData);
    const dataResposta = formatarDataPlanilha(valorData);
    const unidadeDiagnosticada = obterTextoDiagnostico(linha, tabela, [
        'Unidade diagnosticada',
        'Unidade',
        'Ouvidoria',
        'Nome da unidade',
        'Estrutura respondente',
        'M0-02',
        'Órgão gestor do sistema penal na UF',
        'Orgao gestor do sistema penal na UF'
    ], `Ouvidoria de Serviços Penais - ${uf}`);
    const idResposta = obterTextoDiagnostico(linha, tabela, [
        'ID',
        'ID Resposta',
        'Identificador da resposta',
        'ID da resposta',
        'Response ID'
    ], `${uf}-${index + 1}`);
    const responsavelPreenchimento = obterTextoDiagnostico(linha, tabela, [
        'Responsável pelo preenchimento',
        'Responsavel pelo preenchimento',
        'Respondente',
        'Nome do responsável',
        'Nome do responsavel',
        'M0-03'
    ]);
    const validacaoOnasp = normalizarValidacaoOnaspDiagnostico(obterTextoDiagnostico(linha, tabela, [
        'Validação ONASP',
        'Validacao ONASP',
        'Status de validação ONASP',
        'Status de validacao ONASP'
    ]));

    const respostas = {};
    PARAMETROS_DIAGNOSTICO_ONASP
        .flatMap((parametro) => parametro.perguntas)
        .forEach((pergunta) => {
            if (tabela.indice(pergunta) < 0) return;
            respostas[pergunta] = obterTextoDiagnostico(linha, tabela, pergunta);
        });

    return {
        arquivoOrigem: ARQUIVO_PLANILHA_DIAGNOSTICO,
        idResposta,
        uf,
        unidadeDiagnosticada,
        dataResposta,
        dataTimestamp,
        responsavelPreenchimento,
        validacaoOnasp,
        respostas,
        linhaOrigem: index + 1,
        linha
    };
}

function selecionarRespostasValidasDiagnostico(respostas) {
    const porUf = new Map();
    const selecionadas = [];

    respostas.forEach((resposta) => {
        if (resposta.uf === 'ES') {
            selecionadas.push(resposta);
            return;
        }

        const atual = porUf.get(resposta.uf);
        if (!atual || resposta.dataTimestamp > atual.dataTimestamp || (
            resposta.dataTimestamp === atual.dataTimestamp && resposta.linhaOrigem > atual.linhaOrigem
        )) {
            porUf.set(resposta.uf, resposta);
        }
    });

    return [...selecionadas, ...Array.from(porUf.values())].sort((a, b) => (
        a.uf.localeCompare(b.uf) || a.unidadeDiagnosticada.localeCompare(b.unidadeDiagnosticada)
    ));
}

function obterParametrosDisponiveisDiagnostico(tabela) {
    if (!tabela) return [];

    return PARAMETROS_DIAGNOSTICO_ONASP
        .map((parametro) => ({
            ...parametro,
            perguntasDisponiveis: parametro.perguntas.filter((pergunta) => tabela.indice(pergunta) >= 0)
        }))
        .filter((parametro) => parametro.perguntasDisponiveis.length > 0);
}

function respostaDiagnosticoEhNegativa(texto) {
    const valor = normalizarTexto(texto);
    return valor === 'NAO'
        || valor === 'N'
        || valor.includes('NAO POSSUI')
        || valor.includes('NAO UTILIZA')
        || valor.includes('INEXIST')
        || valor.startsWith('SEM ');
}

function respostaDiagnosticoNaoInforma(texto) {
    const valor = normalizarTexto(texto);
    return valor === 'NAO INFORMADO'
        || valor === 'NAO SEI'
        || valor.includes('SEM INFORMACAO')
        || valor.includes('NAO SABE')
        || valor.includes('DESCONHEC');
}

function respostaDiagnosticoEhPositiva(texto) {
    const valor = normalizarTexto(texto);
    if (!valor || respostaDiagnosticoEhNegativa(valor) || respostaDiagnosticoNaoInforma(valor)) {
        return false;
    }

    return valor === 'SIM'
        || valor === 'S'
        || valor.includes('POSSUI')
        || valor.includes('EXISTE')
        || valor.includes('UTILIZA')
        || valor.includes('DISPOE')
        || valor.includes('ADEQUAD')
        || valor.includes('EXCLUSIV')
        || valor.includes('FORMALIZAD');
}

function respostaDiagnosticoEhParcial(texto) {
    const valor = normalizarTexto(texto);
    return valor.includes('PARCIAL')
        || valor.includes('EM PARTE')
        || valor.includes('COMPARTILHAD')
        || valor.includes('EM IMPLANTACAO')
        || valor.includes('INFORMAL')
        || valor.includes('INSUFICIENT')
        || valor.includes('LIMITAC')
        || valor.includes('LIMITAD')
        || valor.includes('INADEQUAD')
        || valor.includes('PRECISA DE')
        || valor.includes('ALGUNS')
        || valor.includes('CONDICIONAD');
}

function classificarRespostasDiagnostico(respostas) {
    const respostasValidas = respostas.map(limparTexto).filter(Boolean);
    if (!respostasValidas.length) return STATUS_CHECKLIST_DIAGNOSTICO.NAO_INFORMADO;

    if (respostasValidas.every(respostaDiagnosticoNaoInforma)) {
        return STATUS_CHECKLIST_DIAGNOSTICO.NAO_INFORMADO;
    }

    const negativas = respostasValidas.filter(respostaDiagnosticoEhNegativa).length;
    const positivas = respostasValidas.filter(respostaDiagnosticoEhPositiva).length;
    const parciais = respostasValidas.filter(respostaDiagnosticoEhParcial).length;

    if (parciais > 0 || (positivas > 0 && negativas > 0)) {
        return STATUS_CHECKLIST_DIAGNOSTICO.PARCIAL;
    }

    if (negativas === respostasValidas.length) {
        return STATUS_CHECKLIST_DIAGNOSTICO.NAO_CONFORME;
    }

    if (positivas > 0) {
        return STATUS_CHECKLIST_DIAGNOSTICO.CONFORME;
    }

    // Respostas descritivas substanciais, como listas de públicos atendidos ou
    // conteúdo do ato normativo, indicam atendimento declaratório do parâmetro.
    return STATUS_CHECKLIST_DIAGNOSTICO.CONFORME;
}

const PARAMETROS_OPERACIONAIS_DIAGNOSTICO = {
    FORM_001: { rotulo: 'Ato normativo', falta: 'Normativo específico', providencia: 'Publicar/anexar ato normativo específico' },
    FORM_002: { rotulo: 'Conteúdo do ato', falta: 'Conteúdo mínimo do ato', providencia: 'Complementar ato ou fluxo' },
    FORM_003: { rotulo: 'Públicos atendidos', falta: 'Públicos atendidos', providencia: 'Detalhar públicos atendidos' },
    FORM_004: { rotulo: 'Vinculação institucional', falta: 'Comprovação de vinculação', providencia: 'Comprovar vinculação institucional' },
    FORM_005: { rotulo: 'Autonomia técnica', falta: 'Comprovação de autonomia', providencia: 'Comprovar autonomia técnica e funcional' },
    EQUIPE_006: { rotulo: 'Ouvidor designado', falta: 'Designação formal', providencia: 'Comprovar designação do ouvidor' },
    EQUIPE_007: { rotulo: 'Mandato do ouvidor', falta: 'Mandato informado', providencia: 'Informar mandato ou registrar ausência' },
    EQUIPE_008: { rotulo: 'Perfil do ouvidor', falta: 'Perfil técnico comprovado', providencia: 'Comprovar perfil técnico do ouvidor' },
    EQUIPE_009: { rotulo: 'Equipe própria', falta: 'Reforço ou formalização de equipe', providencia: 'Instituir/reforçar equipe da ouvidoria' },
    EQUIPE_010: { rotulo: 'Dedicação da equipe', falta: 'Dedicação definida', providencia: 'Comprovar dedicação da equipe' },
    EQUIPE_011: { rotulo: 'Perfil da equipe', falta: 'Perfil técnico da equipe', providencia: 'Comprovar perfil técnico da equipe' },
    EQUIPE_012: { rotulo: 'Capacitação', falta: 'Capacitação específica', providencia: 'Promover/comprovar capacitação' },
    EQUIPE_013: { rotulo: 'Sigilo', falta: 'Termo ou rotina de sigilo', providencia: 'Instituir/comprovar compromisso de sigilo' },
    ESTRUTURA_014: { rotulo: 'Sala reservada', falta: 'Adequação de privacidade/acessibilidade', providencia: 'Adequar espaço físico da ouvidoria' },
    ESTRUTURA_015: { rotulo: 'Computadores', falta: 'Computadores suficientes', providencia: 'Prever aquisição de computadores' },
    ESTRUTURA_016: { rotulo: 'Impressora', falta: 'Impressora multifuncional', providencia: 'Prever aquisição de impressora' },
    ESTRUTURA_017: { rotulo: 'Estações de trabalho', falta: 'Mobiliário/estações suficientes', providencia: 'Adequar mobiliário e estações' },
    ESTRUTURA_018: { rotulo: 'Armários/arquivos', falta: 'Guarda segura de documentos', providencia: 'Prever armários/arquivos' },
    ESTRUTURA_019: { rotulo: 'Licenças de software', falta: 'Licenças necessárias', providencia: 'Prever licenças de software' },
    ESTRUTURA_020: { rotulo: 'Segurança da informação', falta: 'Recursos de segurança', providencia: 'Comprovar segurança da informação' },
    ESTRUTURA_021: { rotulo: 'Placas/cartazes', falta: 'Divulgação visual dos canais', providencia: 'Instalar/divulgar placas e cartazes' },
    ESTRUTURA_022: { rotulo: 'Materiais educativos', falta: 'Materiais de divulgação', providencia: 'Produzir/disponibilizar materiais' },
    CANAIS_023: { rotulo: 'E-mail', falta: 'E-mail institucional exclusivo', providencia: 'Instituir/comprovar e-mail institucional' },
    CANAIS_024: { rotulo: 'Telefone', falta: 'Linha telefônica funcional', providencia: 'Instituir/comprovar telefone' },
    CANAIS_025: { rotulo: 'Canal eletrônico', falta: 'Canal eletrônico de registro', providencia: 'Inserir/comprovar canal eletrônico' },
    CANAIS_026: { rotulo: 'Fala.BR', falta: 'Adesão/integração ao Fala.BR', providencia: 'Incluir meta de adesão ou integração ao Fala.BR' },
    CANAIS_027: { rotulo: 'Endereço postal', falta: 'Endereço postal', providencia: 'Comprovar endereço postal' },
    FLUXO_028: { rotulo: 'Recebe manifestações', falta: 'Tipos de manifestações', providencia: 'Detalhar tipos tratados' },
    FLUXO_029: { rotulo: 'Registro/protocolo', falta: 'Registro, protocolo e classificação', providencia: 'Formalizar registro/protocolo/classificação' },
    FLUXO_030: { rotulo: 'Fluxo interno', falta: 'Fluxo interno formal', providencia: 'Formalizar fluxo interno' },
    FLUXO_031: { rotulo: 'Prazos de resposta', falta: 'Controle de prazos', providencia: 'Definir/controlar prazos de resposta' },
    FLUXO_032: { rotulo: 'Denúncias sensíveis', falta: 'Rotina de proteção e sigilo', providencia: 'Formalizar tratamento sigiloso' },
    FLUXO_033: { rotulo: 'Relatórios', falta: 'Relatórios e recomendações', providencia: 'Criar rotina de relatórios e recomendações' }
};

function normalizarStatusOperacionalDiagnostico(status) {
    if (status === STATUS_CHECKLIST_DIAGNOSTICO.CONFORME) return 'Tem';
    if (status === STATUS_CHECKLIST_DIAGNOSTICO.PARCIAL) return 'Parcial';
    if (status === STATUS_CHECKLIST_DIAGNOSTICO.NAO_CONFORME) return 'Não tem';
    if (status === STATUS_CHECKLIST_DIAGNOSTICO.PENDENTE_VALIDACAO) return 'Validar';
    return 'Não informado';
}

function avaliarParametroDiagnostico(resposta, parametro) {
    const respostasPerguntas = parametro.perguntasDisponiveis.map((pergunta) => ({
        pergunta,
        resposta: limparTexto(resposta.respostas[pergunta])
    })).filter((item) => item.resposta);
    const respostaUf = respostasPerguntas.length
        ? respostasPerguntas.map((item) => `${item.pergunta}: ${item.resposta}`).join(' | ')
        : 'Não informado';
    let statusAutomatico = classificarRespostasDiagnostico(respostasPerguntas.map((item) => item.resposta));
    const validacaoOnasp = parametro.requerValidacao
        ? normalizarValidacaoOnaspDiagnostico(resposta.validacaoOnasp, 'Pendente')
        : 'Não se aplica';

    // Quando o parâmetro depende de comprovação documental, a resposta positiva
    // fica pendente até a validação técnica da ONASP.
    if (
        parametro.requerValidacao
        && statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.CONFORME
        && validacaoOnasp !== 'Validado'
    ) {
        statusAutomatico = STATUS_CHECKLIST_DIAGNOSTICO.PENDENTE_VALIDACAO;
    }

    const configOperacional = PARAMETROS_OPERACIONAIS_DIAGNOSTICO[parametro.id] || {};
    const statusOperacional = normalizarStatusOperacionalDiagnostico(statusAutomatico);

    return {
        arquivoOrigem: ARQUIVO_PLANILHA_DIAGNOSTICO,
        uf: resposta.uf,
        idResposta: resposta.idResposta,
        idParametro: parametro.id,
        eixo: parametro.eixo,
        parametro: parametro.nome,
        parametroCurto: configOperacional.rotulo || parametro.nome,
        fundamentoIn: parametro.fundamentoIn,
        perguntasDiagnostico: parametro.perguntasDisponiveis,
        respostaUf,
        statusAutomatico,
        statusOperacional,
        validacaoOnasp,
        providencia: parametro.providencia,
        providenciaObjetiva: statusOperacional === 'Tem' ? 'Não se aplica' : (configOperacional.providencia || parametro.providencia),
        faltaObjetiva: statusOperacional === 'Tem' ? '-' : (configOperacional.falta || parametro.providencia),
        prioridade: parametro.prioridade,
        essencial: Boolean(parametro.essencial)
    };
}

function montarDeficitsDiagnostico(resposta, tabela) {
    return ITENS_DEFICIT_DIAGNOSTICO
        .filter((config) => tabela.indice(config.atual) >= 0 || tabela.indice(config.ideal) >= 0)
        .map((config) => {
            const atualDeclarado = obterNumeroOpcionalDiagnostico(resposta.linha, tabela, config.atual);
            const idealDeclarado = obterNumeroOpcionalDiagnostico(resposta.linha, tabela, config.ideal);
            const deficit = atualDeclarado === null || idealDeclarado === null
                ? null
                : Math.max(0, idealDeclarado - atualDeclarado);

            return {
                arquivoOrigem: ARQUIVO_PLANILHA_DIAGNOSTICO,
                uf: resposta.uf,
                idResposta: resposta.idResposta,
                item: config.item,
                eixo: 'Estrutura física e tecnológica',
                fundamentoIn: config.fundamentoIn,
                perguntasDiagnostico: [...config.atual, ...config.ideal],
                atualDeclarado,
                idealDeclarado,
                deficit,
                statusOperacional: deficit === null ? 'Não informado' : (deficit > 0 ? `Falta +${deficit}` : 'Tem'),
                faltaObjetiva: deficit === null ? 'Quantidade não informada' : (deficit > 0 ? `+${deficit} ${config.item.toLowerCase()}` : '-'),
                providenciaObjetiva: deficit === null ? 'Informar quantitativo atual e ideal' : (deficit > 0 ? `${config.providencia} (${deficit})` : 'Não se aplica'),
                podeComporPlanoAplicacao: true,
                observacao: 'Déficit declarado no diagnóstico',
                prioridade: config.prioridade
            };
        });
}

function calcularStatusGeralDiagnostico(checklist) {
    if (!checklist.length) return STATUS_CHECKLIST_DIAGNOSTICO.NAO_INFORMADO;

    const possuiEssencialNaoConforme = checklist.some((item) => (
        item.essencial && item.statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.NAO_CONFORME
    ));
    if (possuiEssencialNaoConforme) return STATUS_CHECKLIST_DIAGNOSTICO.NAO_CONFORME;

    const possuiPendencia = checklist.some((item) => item.statusAutomatico !== STATUS_CHECKLIST_DIAGNOSTICO.CONFORME);
    return possuiPendencia ? STATUS_CHECKLIST_DIAGNOSTICO.PARCIAL : STATUS_CHECKLIST_DIAGNOSTICO.CONFORME;
}

function montarResumoConformidadeDiagnostico(checklist, deficits, validacaoOnasp) {
    const contadores = {
        conformes: checklist.filter((item) => item.statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.CONFORME).length,
        parcialmenteConformes: checklist.filter((item) => item.statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.PARCIAL).length,
        naoConformes: checklist.filter((item) => item.statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.NAO_CONFORME).length,
        naoInformados: checklist.filter((item) => item.statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.NAO_INFORMADO).length,
        pendentesValidacao: checklist.filter((item) => item.statusAutomatico === STATUS_CHECKLIST_DIAGNOSTICO.PENDENTE_VALIDACAO).length
    };
    const totalAvaliavel = Object.values(contadores).reduce((total, valor) => total + valor, 0);
    const deficitAparelhamento = deficits.reduce((total, item) => total + (Number(item.deficit) > 0 ? Number(item.deficit) : 0), 0);

    return {
        ...contadores,
        totalAvaliavel,
        conformidadePercentual: totalAvaliavel ? Math.round((contadores.conformes / totalAvaliavel) * 100) : 0,
        deficitAparelhamento,
        validacaoOnasp
    };
}

function montarProvidenciasDiagnostico(checklist, deficits) {
    const providenciasChecklist = checklist
        .filter((item) => item.statusAutomatico !== STATUS_CHECKLIST_DIAGNOSTICO.CONFORME)
        .map((item) => ({
            origem: 'Checklist IN',
            providenciaNecessaria: item.providencia,
            prioridade: item.prioridade,
            statusProvidencia: 'Pendente',
            referencia: item.parametro
        }));
    const providenciasDeficit = deficits
        .filter((item) => Number(item.deficit) > 0)
        .map((item) => ({
            origem: 'Aparelhamento',
            providenciaNecessaria: `Prever aquisição ou adequação de ${item.item.toLowerCase()} conforme déficit declarado`,
            prioridade: item.prioridade,
            statusProvidencia: 'Pendente',
            referencia: item.item
        }));

    return [...providenciasChecklist, ...providenciasDeficit];
}

function montarAnaliseRespostaDiagnostico(resposta, parametrosDisponiveis, tabela) {
    const checklist = parametrosDisponiveis.map((parametro) => avaliarParametroDiagnostico(resposta, parametro));
    const deficits = montarDeficitsDiagnostico(resposta, tabela);
    const statusGeral = calcularStatusGeralDiagnostico(checklist);
    const validacaoOnasp = normalizarValidacaoOnaspDiagnostico(resposta.validacaoOnasp, checklist.some((item) => item.validacaoOnasp === 'Pendente') ? 'Pendente' : 'Não se aplica');

    return {
        ...resposta,
        statusGeral,
        resumo: montarResumoConformidadeDiagnostico(checklist, deficits, validacaoOnasp),
        checklist,
        deficitAparelhamento: deficits,
        providencias: montarProvidenciasDiagnostico(checklist, deficits)
    };
}

function montarResumoGeralDiagnosticoOuvidorias(respostas) {
    const ufs = [...new Set(respostas.map((resposta) => resposta.uf))].sort();
    const unidades = respostas.map((resposta) => resposta.unidadeDiagnosticada).filter(Boolean).sort();

    return {
        totalRespostas: respostas.length,
        ufsDiagnosticadas: ufs.length,
        unidadesDiagnosticadas: unidades.length,
        conformes: respostas.filter((resposta) => resposta.statusGeral === STATUS_CHECKLIST_DIAGNOSTICO.CONFORME).length,
        parcialmenteConformes: respostas.filter((resposta) => resposta.statusGeral === STATUS_CHECKLIST_DIAGNOSTICO.PARCIAL).length,
        naoConformes: respostas.filter((resposta) => resposta.statusGeral === STATUS_CHECKLIST_DIAGNOSTICO.NAO_CONFORME).length,
        naoInformadas: respostas.filter((resposta) => resposta.statusGeral === STATUS_CHECKLIST_DIAGNOSTICO.NAO_INFORMADO).length,
        deficitTotalDeclarado: respostas.reduce((total, resposta) => total + resposta.resumo.deficitAparelhamento, 0),
        filtros: {
            ufs,
            unidades,
            statusGerais: [...new Set(respostas.map((resposta) => resposta.statusGeral))].sort(),
            eixos: [...new Set(respostas.flatMap((resposta) => resposta.checklist.map((item) => item.eixo)))].sort(),
            statusParametros: ['Tem', 'Parcial', 'Não tem', 'Validar', 'Não informado', 'Falta'],
            validacoesOnasp: VALIDACOES_ONASP_DIAGNOSTICO
        }
    };
}

function criarDiagnosticoOuvidoriasVazio(erro = '') {
    return {
        arquivo: ARQUIVO_PLANILHA_DIAGNOSTICO,
        disponivel: false,
        erro,
        aba: '',
        parametrosDisponiveis: [],
        respostasBrutas: [],
        respostas: [],
        resumo: montarResumoGeralDiagnosticoOuvidorias([]),
        diagnostico: {
            colunasDisponiveis: [],
            perguntasDisponiveis: [],
            respostasDescartadasPorDuplicidade: 0,
            aviso: erro || 'Planilha de diagnóstico indisponível.'
        }
    };
}

function extrairDiagnosticoOuvidoriasDoWorkbook(workbook) {
    const tabela = obterTabelaDiagnosticoOuvidorias(workbook);
    if (!tabela) {
        return criarDiagnosticoOuvidoriasVazio('Nenhuma aba com cabeçalho reconhecível foi localizada em Diagnostico.xlsx.');
    }

    const parametrosDisponiveis = obterParametrosDisponiveisDiagnostico(tabela);
    const respostasBrutas = tabela.linhas
        .map((linha, index) => normalizarRespostaBrutaDiagnostico(linha, tabela, index))
        .filter(Boolean);
    const respostasValidas = selecionarRespostasValidasDiagnostico(respostasBrutas);
    const respostas = respostasValidas.map((resposta) => montarAnaliseRespostaDiagnostico(resposta, parametrosDisponiveis, tabela));
    const perguntasDisponiveis = [...new Set(parametrosDisponiveis.flatMap((parametro) => parametro.perguntasDisponiveis))].sort();

    return {
        arquivo: ARQUIVO_PLANILHA_DIAGNOSTICO,
        disponivel: true,
        erro: '',
        aba: tabela.nomeAba,
        parametrosDisponiveis,
        respostasBrutas,
        respostas,
        resumo: montarResumoGeralDiagnosticoOuvidorias(respostas),
        diagnostico: {
            colunasDisponiveis: tabela.headersOriginais.map(limparTexto).filter(Boolean),
            perguntasDisponiveis,
            respostasDescartadasPorDuplicidade: Math.max(0, respostasBrutas.length - respostasValidas.length),
            aviso: perguntasDisponiveis.length
                ? ''
                : 'A planilha foi carregada, mas nenhuma pergunta M0/M1/M2/M3/M4 compatível com o checklist foi localizada.'
        }
    };
}

async function lerWorkbookDeArrayBuffer(arrayBuffer) {
    const xlsx = obterXlsxGlobal();
    return xlsx.read(arrayBuffer, { type: 'array', raw: true });
}

// Aplica cache-busting também nos XLSX, não só nos assets JS/CSS.
function aplicarVersaoDados(url) {
    url.searchParams.set('v', VERSAO_DADOS);
    return url;
}

async function carregarWorkbookPorCaminho(caminhoPlanilha, nomeErro) {
    const planilhaUrl = aplicarVersaoDados(new URL(`../../${caminhoPlanilha}`, import.meta.url));
    const resposta = await fetch(planilhaUrl, { cache: 'no-store' });

    if (!resposta.ok) {
        throw new Error(`${nomeErro} nao encontrada (${resposta.status}).`);
    }

    return lerWorkbookDeArrayBuffer(await resposta.arrayBuffer());
}

async function carregarConveniosDaPlanilha(catalogoAplicacao) {
    if (window.location.protocol === 'file:') {
        throw new Error('Abra a aplicacao por um servidor local ou selecione a planilha manualmente.');
    }

    const planilhaUrl = aplicarVersaoDados(new URL(`../../${catalogoAplicacao.configuracao.arquivoPlanilhaConvenios}`, import.meta.url));
    const resposta = await fetch(planilhaUrl, { cache: 'no-store' });

    if (!resposta.ok) {
        throw new Error(`Nao foi possivel carregar a planilha de convenios (${resposta.status}).`);
    }

    const workbook = await lerWorkbookDeArrayBuffer(await resposta.arrayBuffer());
    return extrairDadosFinanceirosDoWorkbook(workbook, catalogoAplicacao);
}

// Carrega o banco orçamentário 2026. A estrutura esperada é:
// - Base_Dados: cadastro financeiro dos itens;
// - Processos_Normais: andamento dos itens comuns;
// - Andamento_CONV_PROFOR: andamento especial do PROFOR.
// As abas de andamento são mescladas à base pelo campo ID.
async function carregarPlanilhaOrcamento() {
    try {
        if (dadosOrcamentoCache) {
            return dadosOrcamentoCache;
        }

        const planilhaUrl = aplicarVersaoDados(new URL(`../../${ARQUIVO_PLANILHA_ORCAMENTO}`, import.meta.url));
        const resposta = await fetch(planilhaUrl, { cache: 'no-store' });
        
        if (!resposta.ok) {
            throw new Error(
                `Planilha orçamentária não encontrada. URL tentada: ${planilhaUrl.href}. Status HTTP: ${resposta.status}.`
            );
        }
        
        const arrayBuffer = await resposta.arrayBuffer();
        const workbook = await lerWorkbookDeArrayBuffer(arrayBuffer);
        const rastreiosProcessosNormais = montarMapaRastreioProcessosNormais(workbook);
        const rastreiosProfor = montarMapaRastreioProfor(workbook);

        const nomeAbaOrcamento = workbook.SheetNames.find((sheetName) => (
            normalizarTexto(sheetName) === normalizarTexto(ABA_ORCAMENTO_DADOS)
        )) || workbook.SheetNames.find((sheetName) => (
            !ABAS_ORCAMENTO_IGNORADAS.has(normalizarTexto(sheetName))
        ));

        if (!nomeAbaOrcamento) {
            throw new Error(`A aba ${ABA_ORCAMENTO_DADOS} nao foi encontrada na planilha de orcamento.`);
        }

        const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAbaOrcamento]);
        if (linhas.length < 2) {
            throw new Error(`A aba ${nomeAbaOrcamento} nao contem linhas de dados.`);
        }

        const headerRowIndex = linhas.findIndex((linha) => {
            const rowText = (linha || []).map((celula) => normalizarTexto(celula)).join(' ');
            return rowText.includes('FRENTE') && rowText.includes('VALOR TOTAL');
        });

        if (headerRowIndex === -1) {
            throw new Error(`Nao foi possivel identificar o cabecalho da aba ${nomeAbaOrcamento}.`);
        }

        const headers = (linhas[headerRowIndex] || []).map((header) => normalizarTexto(header));
        const colId = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'ID' }]);
        const colTipoRastreio = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'TIPO DE RASTREIO' }]);
        const colFrente = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'FRENTE' }]);
        const colDescricao = obterIndiceColuna(headers, [
            { tipo: 'igual', valor: 'ITENS' },
            { tipo: 'igual', valor: 'ITEM' },
            { tipo: 'inclui', valor: 'DESCRI' },
            { tipo: 'inclui', valor: 'OBJETO' }
        ]);
        const colNatureza = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'NATUREZA' }]);
        const colModalidade = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'MODALIDADE' }]);
        const colAbrangencia = obterIndiceColuna(headers, [
            { tipo: 'inclui', valor: 'ABRANGENCIA' },
            { tipo: 'igual', valor: 'UF' }
        ]);
        const colQuantidade = obterIndiceColuna(headers, [{ tipo: 'inclui', valor: 'QUANTIDADE' }]);
        const colUnidade = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'UNIDADE' }]);
        const colValorTotal = obterIndiceColuna(headers, [{ tipo: 'inclui', valor: 'VALOR TOTAL' }]);
        const colValorUnitario = obterIndiceColuna(headers, [{ tipo: 'inclui', valor: 'VALOR UNITARIO' }]);
        const colValorExecutado = obterIndiceColuna(headers, [
            { tipo: 'inclui', valor: 'VALOR EXECUTADO' },
            { tipo: 'inclui', valor: 'EXECUTADO' },
            { tipo: 'inclui', valor: 'PAGO' }
        ]);
        const colStatus = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'STATUS' }]);
        const colProcessoSei = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'PROCESSO SEI' }]);
        const colLinkProcessoSei = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'LINK DO PROCESSO SEI' }]);
        const colDataProcessoSei = obterIndiceColunaComTodos(headers, ['DATA', 'PROCESSO', 'SEI']);
        const colProforAutuacao = obterIndiceColunaComTodos(headers, ['AUTUACAO'], ['DATA', 'LINK']);
        const colLinkProforAutuacao = obterIndiceColunaComTodos(headers, ['LINK', 'AUTUACAO']);
        const colDataProforAutuacao = obterIndiceColunaComTodos(headers, ['DATA', 'AUTUACAO']);
        const colProforParecerTecnico = obterIndiceColunaComTodos(headers, ['PARECER', 'TECNICO'], ['DATA', 'LINK']);
        const colLinkProforParecerTecnico = obterIndiceColunaComTodos(headers, ['LINK', 'PARECER', 'TECNICO']);
        const colDataProforParecerTecnico = obterIndiceColunaComTodos(headers, ['DATA', 'PARECER', 'TECNICO']);
        const colProforMinutaEdital = obterIndiceColunaComTodos(headers, ['MINUTA', 'EDITAL'], ['DATA', 'LINK']);
        const colLinkProforMinutaEdital = obterIndiceColunaComTodos(headers, ['LINK', 'MINUTA', 'EDITAL']);
        const colDataProforMinutaEdital = obterIndiceColunaComTodos(headers, ['DATA', 'MINUTA', 'EDITAL']);
        const colProforDdoCgof = obterIndiceColunaComTodos(headers, [
            ['DDO'],
            ['CGOF']
        ], ['DATA', 'LINK']);
        const colLinkProforDdoCgof = obterIndiceColunaComTodos(headers, [
            ['LINK', 'DDO'],
            ['LINK', 'CGOF']
        ]);
        const colDataProforDdoCgof = obterIndiceColunaComTodos(headers, [
            ['DATA', 'DDO'],
            ['DATA', 'CGOF']
        ]);
        const colProforAberturaPrograma = obterIndiceColunaComTodos(headers, [
            ['ABERTURA', 'PROGRAMA'],
            ['CGGIR']
        ], ['DATA', 'LINK']);
        const colLinkProforAberturaPrograma = obterIndiceColunaComTodos(headers, [
            ['LINK', 'ABERTURA', 'PROGRAMA'],
            ['LINK', 'CGGIR']
        ]);
        const colDataProforAberturaPrograma = obterIndiceColunaComTodos(headers, [
            ['DATA', 'ABERTURA', 'PROGRAMA'],
            ['DATA', 'CGGIR']
        ]);
        const colProforParecerConjur = obterIndiceColunaComTodos(headers, [
            ['PARECER', 'CONJUR'],
            ['CONJUR']
        ], ['DATA', 'LINK']);
        const colLinkProforParecerConjur = obterIndiceColunaComTodos(headers, [
            ['LINK', 'PARECER', 'CONJUR'],
            ['LINK', 'CONJUR']
        ]);
        const colDataProforParecerConjur = obterIndiceColunaComTodos(headers, [
            ['DATA', 'PARECER', 'CONJUR'],
            ['DATA', 'CONJUR']
        ]);
        const colProforPublicacaoGabsec = obterIndiceColunaComTodos(headers, [
            ['PUBLICACAO'],
            ['GABSEC']
        ], ['DATA', 'LINK']);
        const colLinkProforPublicacaoGabsec = obterIndiceColunaComTodos(headers, [
            ['LINK', 'PUBLICACAO'],
            ['LINK', 'GABSEC']
        ]);
        const colDataProforPublicacaoGabsec = obterIndiceColunaComTodos(headers, [
            ['DATA', 'PUBLICACAO'],
            ['DATA', 'GABSEC']
        ]);
        const colDemandaFormalizada = obterIndiceColunaComTodos(headers, [
            ['DEMANDA'],
            ['DFD'],
            ['FORMALIZACAO', 'DEMANDA']
        ], ['DATA', 'LINK']);
        const colLinkDemandaFormalizada = obterIndiceColunaComTodos(headers, [
            ['LINK', 'DEMANDA'],
            ['LINK', 'DFD']
        ]);
        const colDataDemandaFormalizada = obterIndiceColunaComTodos(headers, [
            ['DATA', 'DEMANDA'],
            ['DATA', 'DFD']
        ]);
        const colEstudoTecnico = obterIndiceColunaComTodos(headers, [
            ['ETP'],
            ['ESTUDO', 'TECNICO'],
            ['ESPECIFICACAO']
        ], ['DATA', 'LINK']);
        const colLinkEstudoTecnico = obterIndiceColunaComTodos(headers, [
            ['LINK', 'ETP'],
            ['LINK', 'ESTUDO', 'TECNICO'],
            ['LINK', 'ESPECIFICACAO']
        ]);
        const colDataEstudoTecnico = obterIndiceColunaComTodos(headers, [
            ['DATA', 'ETP'],
            ['DATA', 'ESTUDO', 'TECNICO'],
            ['DATA', 'ESPECIFICACAO']
        ]);
        const colTermoReferencia = obterIndiceColunaComTodos(headers, ['TERMO', 'REFERENCIA'], ['DATA', 'LINK']);
        const colLinkTermoReferencia = obterIndiceColunaComTodos(headers, ['LINK', 'TERMO', 'REFERENCIA']);
        const colDataTermoReferencia = obterIndiceColunaComTodos(headers, ['DATA', 'TERMO', 'REFERENCIA']);
        const colPesquisaPrecos = obterIndiceColunaComTodos(headers, [
            ['PESQUISA', 'PRECO'],
            ['MAPA', 'PRECO'],
            ['ORCAMENTO', 'ESTIMADO']
        ], ['DATA', 'LINK']);
        const colLinkPesquisaPrecos = obterIndiceColunaComTodos(headers, [
            ['LINK', 'PESQUISA', 'PRECO'],
            ['LINK', 'MAPA', 'PRECO'],
            ['LINK', 'ORCAMENTO', 'ESTIMADO']
        ]);
        const colDataPesquisaPrecos = obterIndiceColunaComTodos(headers, [
            ['DATA', 'PESQUISA', 'PRECO'],
            ['DATA', 'MAPA', 'PRECO'],
            ['DATA', 'ORCAMENTO', 'ESTIMADO']
        ]);
        const colAutorizacaoAutoridade = obterIndiceColunaComTodos(headers, [
            ['AUTORIZ'],
            ['APROVACAO'],
            ['APROVADO']
        ], ['DATA', 'LINK']);
        const colLinkAutorizacaoAutoridade = obterIndiceColunaComTodos(headers, [
            ['LINK', 'AUTORIZ'],
            ['LINK', 'APROVACAO'],
            ['LINK', 'APROVADO']
        ]);
        const colDataAutorizacaoAutoridade = obterIndiceColunaComTodos(headers, [
            ['DATA', 'AUTORIZ'],
            ['DATA', 'APROVACAO'],
            ['DATA', 'APROVADO']
        ]);
        const colParecerJuridico = obterIndiceColunaComTodos(headers, [
            ['PARECER', 'JURIDICO'],
            ['PARECER', 'CONJUR'],
            ['PARECER']
        ], ['DATA', 'LINK', 'TECNICO']);
        const colLinkParecerJuridico = obterIndiceColunaComTodos(headers, ['LINK', 'PARECER']);
        const colDataParecerJuridico = obterIndiceColunaComTodos(headers, ['DATA', 'PARECER']);
        const colEmpenho = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'EMPENHO' }]);
        const colLinkEmpenho = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'LINK DO EMPENHO' }]);
        const colDataEmpenho = obterIndiceColunaComTodos(headers, ['DATA', 'EMPENHO']);
        const colContrato = obterIndiceColunaComTodos(headers, ['CONTRAT'], ['DATA', 'LINK']);
        const colLinkContrato = obterIndiceColunaComTodos(headers, ['LINK', 'CONTRAT']);
        const colDataContratacao = obterIndiceColunaComTodos(headers, ['DATA', 'CONTRAT']);
        const colOrdemServico = obterIndiceColunaComTodos(headers, ['ORDEM', 'SERVICO'], ['DATA', 'LINK']);
        const colLinkOrdemServico = obterIndiceColunaComTodos(headers, ['LINK', 'ORDEM', 'SERVICO']);
        const colDataOrdemServico = obterIndiceColunaComTodos(headers, ['DATA', 'ORDEM', 'SERVICO']);
        const colDataEntrega = obterIndiceColunaComTodos(headers, ['DATA', 'ENTREG']);
        const colOrdemBancaria = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'ORDEM BANCARIA' }]);
        const colLinkOrdemBancaria = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'LINK ORDEM BANCARIA' }]);
        const colDataOrdemBancaria = obterIndiceColunaComTodos(headers, [
            ['DATA', 'ORDEM', 'BANCARIA'],
            ['DATA', 'OB']
        ]);

        if (colFrente < 0 || colDescricao < 0 || colValorTotal < 0) {
            throw new Error('A planilha de orcamento precisa conter as colunas Frente, Itens e Valor Total (R$).');
        }

        const itens = linhas.slice(headerRowIndex + 1).map((linha, index) => {
            const descricao = obterTextoCelula(linha, colDescricao, '');
            const valorTotal = arredondarMoeda(converterNumeroPlanilha(linha[colValorTotal]));

            if (!descricao || normalizarTexto(descricao).includes('TOTAL') || valorTotal <= 0) {
                return null;
            }

            const quantidade = obterTextoCelula(linha, colQuantidade, '');
            const valorUnitarioInformado = converterNumeroPlanilha(linha[colValorUnitario]);
            const id = obterTextoCelula(linha, colId, `${nomeAbaOrcamento}-${index + 1}`);
            const tipoRastreio = obterTextoCelula(linha, colTipoRastreio, '');
            // A coluna "Tipo de Rastreio" é a forma preferencial de decidir o
            // fluxo. Os testes por descrição ficam como compatibilidade.
            const ehProfor = normalizarTexto(tipoRastreio).includes('PROFOR')
                || normalizarTexto(tipoRastreio).includes('CONVENIO')
                || normalizarTexto(descricao).includes('PROFOR');
            const dadosRastreio = ehProfor
                ? rastreiosProfor.get(id)
                : rastreiosProcessosNormais.get(id);

            const itemBase = {
                id,
                tipoRastreio,
                frente: obterTextoCelula(linha, colFrente, 'Não informado'),
                descricao,
                natureza: obterTextoCelula(linha, colNatureza),
                modalidade: obterTextoCelula(linha, colModalidade),
                abrangencia: obterTextoCelula(linha, colAbrangencia),
                quantidade,
                unidade: obterTextoCelula(linha, colUnidade),
                valorTotal,
                valorUnitario: arredondarMoeda(valorUnitarioInformado),
                valorExecutado: arredondarMoeda(converterNumeroPlanilha(linha[colValorExecutado])),
                status: obterTextoCelula(linha, colStatus, 'Não informado'),
                processoSei: obterTextoCelula(linha, colProcessoSei, ''),
                linkProcessoSei: obterTextoCelula(linha, colLinkProcessoSei, ''),
                dataProcessoSei: obterDataCelula(linha, colDataProcessoSei),
                proforAutuacao: obterTextoCelula(linha, colProforAutuacao, ''),
                linkProforAutuacao: obterTextoCelula(linha, colLinkProforAutuacao, ''),
                dataProforAutuacao: obterDataCelula(linha, colDataProforAutuacao),
                proforParecerTecnico: obterTextoCelula(linha, colProforParecerTecnico, ''),
                linkProforParecerTecnico: obterTextoCelula(linha, colLinkProforParecerTecnico, ''),
                dataProforParecerTecnico: obterDataCelula(linha, colDataProforParecerTecnico),
                proforMinutaEdital: obterTextoCelula(linha, colProforMinutaEdital, ''),
                linkProforMinutaEdital: obterTextoCelula(linha, colLinkProforMinutaEdital, ''),
                dataProforMinutaEdital: obterDataCelula(linha, colDataProforMinutaEdital),
                proforDdoCgof: obterTextoCelula(linha, colProforDdoCgof, ''),
                linkProforDdoCgof: obterTextoCelula(linha, colLinkProforDdoCgof, ''),
                dataProforDdoCgof: obterDataCelula(linha, colDataProforDdoCgof),
                proforAberturaPrograma: obterTextoCelula(linha, colProforAberturaPrograma, ''),
                linkProforAberturaPrograma: obterTextoCelula(linha, colLinkProforAberturaPrograma, ''),
                dataProforAberturaPrograma: obterDataCelula(linha, colDataProforAberturaPrograma),
                proforParecerConjur: obterTextoCelula(linha, colProforParecerConjur, ''),
                linkProforParecerConjur: obterTextoCelula(linha, colLinkProforParecerConjur, ''),
                dataProforParecerConjur: obterDataCelula(linha, colDataProforParecerConjur),
                proforPublicacaoGabsec: obterTextoCelula(linha, colProforPublicacaoGabsec, ''),
                linkProforPublicacaoGabsec: obterTextoCelula(linha, colLinkProforPublicacaoGabsec, ''),
                dataProforPublicacaoGabsec: obterDataCelula(linha, colDataProforPublicacaoGabsec),
                demandaFormalizada: obterTextoCelula(linha, colDemandaFormalizada, ''),
                linkDemandaFormalizada: obterTextoCelula(linha, colLinkDemandaFormalizada, ''),
                dataDemandaFormalizada: obterDataCelula(linha, colDataDemandaFormalizada),
                estudoTecnico: obterTextoCelula(linha, colEstudoTecnico, ''),
                linkEstudoTecnico: obterTextoCelula(linha, colLinkEstudoTecnico, ''),
                dataEstudoTecnico: obterDataCelula(linha, colDataEstudoTecnico),
                termoReferencia: obterTextoCelula(linha, colTermoReferencia, ''),
                linkTermoReferencia: obterTextoCelula(linha, colLinkTermoReferencia, ''),
                dataTermoReferencia: obterDataCelula(linha, colDataTermoReferencia),
                pesquisaPrecos: obterTextoCelula(linha, colPesquisaPrecos, ''),
                linkPesquisaPrecos: obterTextoCelula(linha, colLinkPesquisaPrecos, ''),
                dataPesquisaPrecos: obterDataCelula(linha, colDataPesquisaPrecos),
                autorizacaoAutoridade: obterTextoCelula(linha, colAutorizacaoAutoridade, ''),
                linkAutorizacaoAutoridade: obterTextoCelula(linha, colLinkAutorizacaoAutoridade, ''),
                dataAutorizacaoAutoridade: obterDataCelula(linha, colDataAutorizacaoAutoridade),
                parecerJuridico: obterTextoCelula(linha, colParecerJuridico, ''),
                linkParecerJuridico: obterTextoCelula(linha, colLinkParecerJuridico, ''),
                dataParecerJuridico: obterDataCelula(linha, colDataParecerJuridico),
                empenho: obterTextoCelula(linha, colEmpenho, ''),
                linkEmpenho: obterTextoCelula(linha, colLinkEmpenho, ''),
                dataEmpenho: obterDataCelula(linha, colDataEmpenho),
                contrato: obterTextoCelula(linha, colContrato, ''),
                linkContrato: obterTextoCelula(linha, colLinkContrato, ''),
                dataContratacao: obterDataCelula(linha, colDataContratacao),
                ordemServico: obterTextoCelula(linha, colOrdemServico, ''),
                linkOrdemServico: obterTextoCelula(linha, colLinkOrdemServico, ''),
                dataOrdemServico: obterDataCelula(linha, colDataOrdemServico),
                dataEntrega: obterDataCelula(linha, colDataEntrega),
                ordemBancaria: obterTextoCelula(linha, colOrdemBancaria, ''),
                linkOrdemBancaria: obterTextoCelula(linha, colLinkOrdemBancaria, ''),
                dataOrdemBancaria: obterDataCelula(linha, colDataOrdemBancaria)
            };

            return {
                ...itemBase,
                ...(dadosRastreio || {}),
                // A aba de andamento pode ter status mais atualizado que a base.
                status: dadosRastreio?.status || itemBase.status
            };
        }).filter(Boolean);

        dadosOrcamentoCache = {
            arquivo: ARQUIVO_PLANILHA_ORCAMENTO,
            aba: nomeAbaOrcamento,
            itens,
            resumo: montarResumoOrcamento(itens),
            filtros: {
                frentes: obterValoresUnicosOrcamento(itens, 'frente'),
                status: obterValoresUnicosOrcamento(itens, 'status'),
                naturezas: obterValoresUnicosOrcamento(itens, 'natureza'),
                modalidades: obterValoresUnicosOrcamento(itens, 'modalidade')
            }
        };

        return dadosOrcamentoCache;
    } catch (error) {
        dadosOrcamentoCache = null;
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_ORCAMENTO}:`, error);
        return null;
    }
}

export async function carregarDadosOrcamento() {
    return carregarPlanilhaOrcamento();
}

export async function carregarDadosContatos() {
    if (dadosContatosCache && dadosContatosCache.disponivel) {
        return dadosContatosCache;
    }

    try {
        if (window.location.protocol === 'file:') {
            throw new Error('Abra a aplicacao por um servidor local para carregar a planilha de contatos.');
        }
        const workbookContatos = await carregarWorkbookPorCaminho(ARQUIVO_PLANILHA_CONTATOS, 'Planilha de contatos');
        dadosContatosCache = extrairDadosContatosFormalizacao(workbookContatos);
        return dadosContatosCache;
    } catch (error) {
        dadosContatosCache = criarContatosFormalizacaoVazios(error.message);
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_CONTATOS}:`, error);
        return dadosContatosCache;
    }
}

export async function carregarDadosDiagnosticoOuvidorias() {
    if (dadosDiagnosticoOuvidoriasCache) {
        return dadosDiagnosticoOuvidoriasCache;
    }

    try {
        if (window.location.protocol === 'file:') {
            throw new Error('Abra a aplicacao por um servidor local para carregar a planilha de diagnostico.');
        }

        const workbook = await carregarWorkbookPorCaminho(ARQUIVO_PLANILHA_DIAGNOSTICO, 'Planilha de diagnostico');
        dadosDiagnosticoOuvidoriasCache = extrairDiagnosticoOuvidoriasDoWorkbook(workbook);
        return dadosDiagnosticoOuvidoriasCache;
    } catch (error) {
        dadosDiagnosticoOuvidoriasCache = criarDiagnosticoOuvidoriasVazio(error.message);
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_DIAGNOSTICO}:`, error);
        return dadosDiagnosticoOuvidoriasCache;
    }
}

export async function carregarDadosFormalizacaoProfor() {
    if (dadosFormalizacaoProforCache) {
        return dadosFormalizacaoProforCache;
    }

    try {
        if (window.location.protocol === 'file:') {
            throw new Error('Abra a aplicacao por um servidor local para carregar a planilha de formalizacao.');
        }

        const workbook = await carregarWorkbookPorCaminho(ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR, 'Planilha de formalizacao');
        let contatosFormalizacao = await carregarDadosContatos();
        if (!contatosFormalizacao) {
            contatosFormalizacao = criarContatosFormalizacaoVazios('Planilha de contatos não carregada.');
        }

        dadosFormalizacaoProforCache = extrairFormalizacaoProforDoWorkbook(workbook, contatosFormalizacao);
        return dadosFormalizacaoProforCache;
    } catch (error) {
        dadosFormalizacaoProforCache = null;
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR}:`, error);
        return null;
    }
}

export async function carregarCatalogoAplicacao() {
    if (catalogoAplicacaoCache) {
        return catalogoAplicacaoCache;
    }

    const resposta = await fetch(JSON_APLICACAO_URL, { cache: 'no-store' });
    if (!resposta.ok) {
        throw new Error(`Nao foi possivel carregar os dados estaticos da aplicacao (${resposta.status}).`);
    }

    catalogoAplicacaoCache = await resposta.json();
    dadosFaf2021Cache = montarDadosFaf2021(catalogoAplicacaoCache);
    dadosDoacoes2023Cache = montarDadosDoacoes2023(catalogoAplicacaoCache);
    return catalogoAplicacaoCache;
}

export async function carregarDadosAplicacao(catalogoAplicacao = null) {
    const catalogo = catalogoAplicacao || await carregarCatalogoAplicacao();
    await carregarPlanilhaOrcamento();
    const dadosConvenio = await carregarConveniosDaPlanilha(catalogo);
    console.log(`Convenios carregados da planilha: ${dadosConvenio.length} itens.`);
    return montarDadosComConvenios(catalogo, dadosConvenio);
}

// Usado quando o usuário escolhe manualmente a planilha de convênios no browser.
// O arquivo selecionado não é persistido; ele só substitui os dados em memória.
export async function processarArquivoPlanilhaSelecionado(arquivoSelecionado, catalogoAplicacao = null) {
    const catalogo = catalogoAplicacao || await carregarCatalogoAplicacao();
    await carregarPlanilhaOrcamento();
    const workbook = await lerWorkbookDeArrayBuffer(await arquivoSelecionado.arrayBuffer());
    const dadosConvenio = extrairDadosFinanceirosDoWorkbook(workbook, catalogo);
    return montarDadosComConvenios(catalogo, dadosConvenio);
}
