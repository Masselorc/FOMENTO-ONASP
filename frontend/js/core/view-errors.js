// ============================================================================
// View error and empty states.
// ============================================================================

import { UI_ICONS } from './ui-components.js?v=20260507-05';

const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[char]);

export const VIEW_ERROR_MESSAGES = {
    orcamento: {
        titulo: 'Não foi possível carregar Orçamento 2026.',
        detalhe: 'Verifique se o servidor local está ativo ou se o arquivo orcamento-2026.json foi publicado.'
    },
    formalizacao: {
        titulo: 'Não foi possível carregar Formalização PROFOR.',
        detalhe: 'Verifique a API local ou o arquivo formalizacao-profor.json.'
    },
    'formalizacao-detalhe': {
        titulo: 'Não foi possível carregar o detalhe da Formalização PROFOR.',
        detalhe: 'Verifique os dados da UF selecionada.'
    },
    'diagnostico-ouvidorias': {
        titulo: 'Não foi possível carregar Parâmetros Mínimos.',
        detalhe: 'Verifique a base local ou o arquivo parametros-minimos.json.'
    },
    contatos: {
        titulo: 'Não foi possível carregar Contatos UFs.',
        detalhe: 'Verifique a origem dos dados de contatos.'
    },
    'status-sistema': {
        titulo: 'Não foi possível carregar Status do Sistema.',
        detalhe: 'Verifique se os dados locais ou os arquivos publicados estão disponíveis.'
    }
};

export function renderEmptyState({
    titulo = 'Nenhum dado disponível.',
    descricao = '',
    icon = 'fa-inbox'
}) {
    return `
        <div class="app-empty-state">
            <i class="fas ${icon}" aria-hidden="true"></i>
            <h3>${escapeHtml(titulo)}</h3>
            ${descricao ? `<p>${escapeHtml(descricao)}</p>` : ''}
        </div>
    `;
}

export function renderErrorState({
    titulo = 'Não foi possível carregar esta página.',
    detalhe = '',
    error = null
}) {
    const mensagemErro = error?.message ? escapeHtml(error.message) : '';

    return `
        <div class="app-error-state alert alert-danger m-4">
            <div class="app-error-title">
                <i class="fas ${UI_ICONS.warning}" aria-hidden="true"></i>
                <strong>${escapeHtml(titulo)}</strong>
            </div>
            ${detalhe ? `<div>${escapeHtml(detalhe)}</div>` : ''}
            ${mensagemErro ? `<small class="d-block mt-2 text-muted">${mensagemErro}</small>` : ''}
        </div>
    `;
}
