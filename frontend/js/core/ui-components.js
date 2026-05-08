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

export function renderPublicationNotice(message) {
    return `
        <div class="publication-mode-notice" role="status">
            <i class="fas ${UI_ICONS.lock}" aria-hidden="true"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}
