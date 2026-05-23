const test = require("node:test");
const assert = require("node:assert/strict");

const { ultimoResolutivo } = require("../../backend/scripts/auditar-seguranca-pre-ativacao-final-pad-profor-2022");

test("ultimoResolutivo retorna a decisao resolutiva mais recente quando ha retificadora (CORRIGIDO) posterior a ACEITO", () => {
  // O repositorio retorna decisoes ordenadas DESC por id (mais recente primeiro).
  const divergencia = {
    decisoes: [
      { id: 185, decisao: "CORRIGIDO" },
      { id: 150, decisao: "ACEITO" },
    ],
  };
  const resolutiva = ultimoResolutivo(divergencia);
  assert.equal(resolutiva.id, 185);
  assert.equal(resolutiva.decisao, "CORRIGIDO");
});

test("ultimoResolutivo ignora COMENTAR (nao resolutiva) e devolve a ultima resolutiva", () => {
  const divergencia = {
    decisoes: [
      { id: 200, decisao: "COMENTAR" },
      { id: 185, decisao: "CORRIGIDO" },
      { id: 150, decisao: "ACEITO" },
    ],
  };
  const resolutiva = ultimoResolutivo(divergencia);
  assert.equal(resolutiva.id, 185);
});

test("ultimoResolutivo aceita decisao em minusculo (defensivo)", () => {
  const divergencia = {
    decisoes: [
      { id: 90, decisao: "revertido" },
      { id: 80, decisao: "aceito" },
    ],
  };
  const resolutiva = ultimoResolutivo(divergencia);
  assert.equal(resolutiva.id, 90);
});

test("ultimoResolutivo devolve null quando nao ha decisao resolutiva", () => {
  assert.equal(ultimoResolutivo({ decisoes: [] }), null);
  assert.equal(ultimoResolutivo({}), null);
  assert.equal(ultimoResolutivo({ decisoes: [{ id: 1, decisao: "COMENTAR" }] }), null);
});

test("ultimoResolutivo nao trata array crescente (id ASC) como invalido, mas preserva intencao de pegar o primeiro match", () => {
  // Caso teorico em que o ordenamento mudasse: o contrato e 'primeira match' a
  // partir do array recebido. O teste documenta que a funcao confia no DESC do
  // repositorio (listarDecisoesDaDivergencia). Se o ordenamento mudar, este
  // teste falha e sinaliza a regressao.
  const divergencia = {
    decisoes: [
      { id: 150, decisao: "ACEITO" },
      { id: 185, decisao: "CORRIGIDO" },
    ],
  };
  const resolutiva = ultimoResolutivo(divergencia);
  // Documenta o contrato: pega a PRIMEIRA correspondencia (assumindo DESC).
  assert.equal(resolutiva.id, 150);
});
