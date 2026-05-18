// ============================================================================
// UI components shared by the ONASP frontend.
// ============================================================================

const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[char]);

export const UI_ICONS = {
    edit: 'fa-pen-to-square',
    save: 'fa-floppy-disk',
    cancel: 'fa-xmark',
    history: 'fa-clock-rotate-left',
    exportExcel: 'fa-file-excel',
    exportPdf: 'fa-file-pdf',
    add: 'fa-circle-plus',
    back: 'fa-arrow-left',
    warning: 'fa-triangle-exclamation',
    success: 'fa-check-circle',
    info: 'fa-circle-info',
    lock: 'fa-lock',
    search: 'fa-magnifying-glass',
    filter: 'fa-filter',
    refresh: 'fa-rotate-right'
};

// ----------------------------------------------------------------------------
// Hierarquia de botões — Tema escuro institucional
// ----------------------------------------------------------------------------
// Cada variante mapeia para uma classe utilitária definida em frontend/css/app.css.
// O uso é opcional: chamadas existentes a .btn-primary, .btn-outline-primary e
// .btn-danger continuam funcionando com os tokens do tema escuro.
// ----------------------------------------------------------------------------
export const UI_BUTTON_VARIANTS = Object.freeze({
    action: 'btn-action',
    outline: 'btn-outline-action',
    export: 'btn-export',
    admin: 'btn-admin',
    destructive: 'btn-destructive'
});

export function classeBotaoUi(variant) {
    return UI_BUTTON_VARIANTS[variant] || UI_BUTTON_VARIANTS.action;
}

export function renderBotaoUi({
    variant = 'action',
    label = '',
    icone = '',
    id = '',
    type = 'button',
    extraClass = '',
    title = '',
    disabled = false,
    dataAttrs = {}
} = {}) {
    const classes = ['btn', 'btn-icon-text', classeBotaoUi(variant)];
    if (extraClass) classes.push(extraClass);
    const datasets = Object.entries(dataAttrs)
        .map(([chave, valor]) => ` data-${escapeHtml(chave)}="${escapeHtml(valor)}"`)
        .join('');
    const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const disabledAttr = disabled ? ' disabled' : '';
    const iconeHtml = icone
        ? `<i class="fas ${escapeHtml(icone)}" aria-hidden="true"></i>`
        : '';

    return `
        <button type="${escapeHtml(type)}"${idAttr} class="${classes.join(' ')}"${titleAttr}${disabledAttr}${datasets}>
            ${iconeHtml}<span>${escapeHtml(label)}</span>
        </button>
    `;
}

export function renderPublicationNotice(message) {
    return `
        <div class="publication-mode-notice" role="status">
            <i class="fas ${UI_ICONS.lock}" aria-hidden="true"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

export function renderEmptyStateUi({ icone = UI_ICONS.info, mensagem = '' } = {}) {
    return `
        <div class="empty-state" role="status">
            <i class="fas ${escapeHtml(icone)}" aria-hidden="true"></i>
            <span>${escapeHtml(mensagem)}</span>
        </div>
    `;
}
