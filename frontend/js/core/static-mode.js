// ============================================================================
// Static publication mode helpers.
// ============================================================================

import {
    obterModoDadosOnasp,
    estaEmModoPublicacaoEstatica
} from '../../../backend/services/data-service.js?v=20260612-17-orcamento-executado-resumo-v2';
import { renderPublicationNotice } from './ui-components.js?v=20260811-01';

export const MENSAGEM_MODO_PUBLICACAO = 'Modo publicação: dados somente leitura. Para editar, execute a aplicação localmente.';

export function dadosPaginaEmModoEstatico(chave) {
    return obterModoDadosOnasp(chave) === 'estatico';
}

export function renderizarAvisoModoPublicacao() {
    return renderPublicationNotice(MENSAGEM_MODO_PUBLICACAO);
}

export function aplicarModoSomenteLeitura() {
    document.body.classList.toggle('modo-publicacao-estatica', estaEmModoPublicacaoEstatica());

    if (!estaEmModoPublicacaoEstatica()) return;

    document
        .querySelectorAll('[data-requer-backend="true"]')
        .forEach((elemento) => {
            elemento.setAttribute('disabled', 'disabled');
            elemento.setAttribute('aria-disabled', 'true');
            elemento.classList.add('disabled');
            if (!elemento.title) {
                elemento.title = 'Disponível apenas no modo local.';
            }
        });
}
