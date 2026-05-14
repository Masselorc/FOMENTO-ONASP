# Modelo — Dicionário de Dados

Uso: bases CSV/XLSX, bases de planejamento, orçamento, contatos, UFs, diagnósticos, execução FAF, formalização PROFOR e demais bases estruturadas.

## 1. Identificação da base

- Nome da base:
- Arquivo original:
- Formato:
- Origem:
- Responsável:
- Data da versão:
- Periodicidade de atualização:
- Uso principal:
- Localização/referência do original:

## 2. Finalidade do dicionário

Registrar a estrutura da base, suas colunas, regras de cálculo, limitações, sensibilidade e uso na aplicação ou em análises institucionais.

## 3. Síntese da base

[Resumo objetivo da base e do que ela representa.]

## 4. Unidade de análise

Exemplos:

- UF;
- instrumento;
- processo SEI;
- item de plano de aplicação;
- ação orçamentária;
- manifestação;
- contato institucional.

## 5. Chave principal

- Chave identificada:
- Chave composta, se houver:
- Risco de duplicidade:
- Observação:

## 6. Colunas

| Coluna | Tipo aparente | Descrição | Obrigatória | Sensível | Observações |
|---|---|---|---|---|---|
|  |  |  | sim/não | sim/não |  |

## 7. Regras de cálculo

| Campo calculado | Regra | Observação |
|---|---|---|
|  |  |  |

## 8. Campos sensíveis

| Campo | Sensibilidade | Cautela |
|---|---|---|
|  |  |  |

## 9. Uso na aplicação

[Indicar se a base alimenta dashboard, orçamento, UFs, PROFOR, formalização, contatos, JSON publicado ou outro fluxo.]

## 10. Relação com banco, rotas ou JSONs publicados

| Elemento | Relação |
|---|---|
| Banco SQLite |  |
| Serviço backend |  |
| Rota/API |  |
| JSON publicado |  |

## 11. Validações recomendadas

- Conferir totais.
- Conferir duplicidades.
- Conferir valores nulos.
- Conferir chaves por UF/processo/item.
- Conferir formato de datas.
- Conferir valores monetários.
- Conferir percentuais.
- Conferir origem e versão da base.

## 12. Limitações conhecidas

- [Limitação 1]
- [Limitação 2]

## 13. Risco de incompletude

- Risco: baixo | médio | alto
- Justificativa:

## 14. Controle de completude

- Base analisada integralmente: sim | não
- Todas as colunas descritas: sim | não
- Regras de cálculo confirmadas: sim | não
- Campos sensíveis identificados: sim | não
- Necessita revisão humana: sim | não

## 15. Uso recomendado

Este dicionário pode subsidiar:

- dashboard;
- relatórios;
- validações;
- integração com aplicação;
- conferência de dados;
- análise orçamentária;
- acompanhamento de UFs.
