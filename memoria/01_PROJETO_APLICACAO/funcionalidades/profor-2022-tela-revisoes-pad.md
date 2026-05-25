# Tela de Revisões PAD — Notação Técnica Consolidada

## 1. Objetivo da interface

A **Tela de Revisões PAD** deve permitir revisar, classificar e ajustar diretamente o plano de aplicação detalhado reconstruído a partir dos arquivos PAD Excel dos convênios PROFOR 2022.

A tela deve trabalhar sobre o **plano de aplicação reconstruído a partir dos PADs**, com aplicação da memória de rateios e classificações por área já existente na aplicação.

A unidade principal de trabalho não é o alerta técnico, mas o **item do plano de aplicação**.

A tela não deve funcionar como uma lista bruta de divergências, alertas, histórico ou comparações antigas. Deve funcionar como uma **grade hierárquica editável**, por UF e convênio, com linhas originais do PAD e suas linhas-filhas de rateio.

## 2. Premissas operacionais

1. A origem operacional é o conjunto de arquivos PAD Excel localizados em `Planilhas/profor-2022/instrumentos`.
2. A planilha antiga por abas não deve ser usada, comparada, consultada ou reintroduzida nesse fluxo.
3. A tela deve usar o resultado da recarga operacional limpa dos PADs.
4. A aplicação deve aplicar a memória de rateios e classificações por área já existente.
5. O sistema não deve inventar rateio.
6. O sistema não deve usar distribuição igual provisória.
7. Item novo sem rateio memorizado deve virar pendência operacional.
8. Item suprimido no PAD atual deve ser tratado como histórico/suprimido, sem erro indevido.
9. Alterações humanas devem ser auditáveis.
10. Nenhuma alteração feita nesta tela deve publicar dados automaticamente.

## 3. Fluxo principal do usuário

1. Usuário abre a tela **Sistema**.
2. Usuário aciona a **Recarga Operacional dos PADs**.
3. O sistema lê os 15 arquivos Excel em `Planilhas/profor-2022/instrumentos`.
4. O sistema aplica a memória de rateios e classificações por área.
5. O sistema reconstrói o plano de aplicação local.
6. Usuário acessa a **Tela de Revisões PAD**.
7. Usuário seleciona uma UF.
8. O sistema exibe o plano de aplicação detalhado da UF/convênio.
9. As linhas originais do PAD aparecem expandidas por padrão, mostrando suas linhas-filhas de rateio.
10. Usuário edita diretamente na tabela apenas os campos permitidos:
    - Área;
    - Quantidade/rateio.
11. O sistema valida as alterações.
12. O sistema salva a decisão pela camada de serviço existente.
13. O sistema revalida o grupo afetado.

## 4. Estrutura visual da tela

```text
[TÍTULO]
Tela de Revisões PAD

[FILTRO POR UF]
AC | AL | AM | AP | BA | CE | DF | ES | GO | ...

[SUBTÍTULO]
Plano de Aplicação Detalhado da UF — Convênio nº XXXXX/2022

[RESUMO DA UF]
Total PAD | Total rateado | Itens sem classificação | Itens novos | Itens suprimidos | Pendências reais

[TABELA EDITÁVEL]
Linhas-mãe do PAD + linhas-filhas de rateio já expandidas por padrão
```

## 5. Filtros principais

A tela deve conter filtros para navegação e análise operacional:

- UF;
- Convênio;
- Área;
- Natureza;
- Situação;
- Tipo;
- Texto da descrição;
- Somente pendências;
- Mostrar históricos/suprimidos.

## 6. Seleção por UF

A seleção por UF deve aparecer no topo da tela em formato de chips/botões.

Exemplo:

```text
[AC] [AL] [AM] [AP] [BA] [CE] [DF] [ES] [GO] [...]
```

Ao clicar em uma UF:

1. O sistema identifica o convênio correspondente.
2. O sistema carrega o plano de aplicação reconstruído daquela UF.
3. O sistema exibe a tabela hierárquica de itens.
4. O sistema atualiza o resumo superior da UF.

## 7. Resumo superior da UF

Ao selecionar uma UF, a tela deve exibir um resumo operacional da UF/convênio.

Campos sugeridos:

- UF selecionada;
- Número do convênio;
- Total de itens PAD;
- Total de linhas rateadas;
- Total por área;
- Total por natureza;
- Itens pendentes;
- Itens novos;
- Itens suprimidos;
- Status da revisão.

Exemplo:

```text
AC — Convênio 937XXX/2022
Itens PAD: 42
Linhas rateadas: 58
Pendências: 2
Ouvidoria: R$ 120.000,00
Corregedoria: R$ 80.000,00
Escola Penal: R$ 50.000,00
N/A: R$ 10.000,00
```

## 8. Ordem das colunas da tabela

A tabela deve obedecer à seguinte ordem:

1. Tipo;
2. Área;
3. Descrição;
4. Natureza;
5. Código Natureza;
6. Quantidade;
7. Valor Unitário;
8. Valor Total;
9. Situação;
10. Ações/Observações.

## 9. Definição técnica das colunas

### 9.1 Tipo

Campo não editável.

Indica o tipo operacional da linha.

Valores possíveis:

- `ITEM_PAD`;
- `ITEM_RATEADO`;
- `SALDO_RESIDUAL`;
- `REMANESCENTE`;
- `ITEM_SUPRIMIDO`;
- `ITEM_NOVO`.

Rótulos visuais sugeridos:

- Item PAD;
- Rateio;
- Saldo residual;
- Remanescente;
- Item suprimido;
- Item novo.

### 9.2 Área

Campo editável.

A célula deve funcionar como dropdown/lista suspensa ao clique.

Valores permitidos:

- `OUVIDORIA`;
- `CORREGEDORIA`;
- `ESCOLA_PENAL`;
- `N/A`;
- `NAO_CLASSIFICADO`.

Rótulos visuais:

- Ouvidoria;
- Corregedoria;
- Escola Penal;
- N/A;
- Não classificado.

Regras:

1. `OUVIDORIA`, `CORREGEDORIA` e `ESCOLA_PENAL` representam áreas operacionais finalísticas.
2. `N/A` representa item sem setorialização por área, especialmente saldo residual, remanescente ou item técnico não atribuível.
3. `NAO_CLASSIFICADO` representa item novo ou pendente de decisão humana.
4. Alterar a área não deve alterar automaticamente a quantidade.
5. Alterar a área deve gerar decisão auditável.
6. A alteração deve ser persistida por serviço existente, nunca por SQL direto.

### 9.3 Descrição

Campo não editável.

Representa a descrição do item conforme extraída do PAD.

A interface pode exibir a descrição normalizada para leitura, mas deve preservar a descrição original no detalhe técnico.

### 9.4 Natureza

Campo não editável.

Valores esperados:

- `CUSTEIO`;
- `CAPITAL`;
- `NAO_INFORMADO`.

Regra crítica:

- Itens de naturezas diferentes não devem ser fundidos.
- `CAPITAL` e `CUSTEIO` não podem ser pareados artificialmente.

### 9.5 Código Natureza

Campo não editável.

Exemplos:

- `339030`;
- `339039`;
- `449052`.

Quando ausente, exibir:

- `N/A`.

### 9.6 Quantidade

Campo editável com comportamento especial.

A célula de quantidade deve permitir abrir uma ação de rateio.

Ao clicar na quantidade, o sistema deve oferecer a opção:

```text
Ratear quantidade
```

Ao selecionar essa opção, deve abrir um editor inline, modal ou painel lateral para dividir a quantidade em duas ou mais linhas-filhas.

Exemplo:

```text
Quantidade original: 10

Rateio:
- Ouvidoria: 6
- Corregedoria: 4
```

Após confirmar, a linha original permanece como linha-mãe e as linhas-filhas aparecem abaixo, agrupadas/aglutinadas.

### 9.7 Valor Unitário

Campo não editável.

Deve refletir o valor unitário do item conforme PAD ou conforme regra de reconstrução vigente.

Em regra, o valor unitário é herdado da linha original do PAD.

### 9.8 Valor Total

Campo calculado, não editável diretamente.

Para linha-filha:

```text
valorTotalLinhaFilha = quantidadeLinhaFilha × valorUnitario
```

Para linha-mãe:

```text
valorTotalLinhaMae = valorTotalOriginalPAD
```

A soma dos valores das linhas-filhas deve ser compatível com o valor total da linha-mãe, admitida apenas tolerância de arredondamento.

### 9.9 Situação

Campo não editável, calculado pelo sistema.

Valores possíveis:

- `OK`;
- `RATEIO_MEMORIZADO_APLICADO`;
- `AREA_ALTERADA`;
- `QUANTIDADE_RATEADA`;
- `ITEM_NOVO_SEM_RATEIO`;
- `ITEM_SUPRIMIDO_HISTORICO`;
- `AREA_NAO_CLASSIFICADA`;
- `RATEIO_INCONSISTENTE`;
- `SALDO_RESIDUAL_NAO_SETORIALIZADO`;
- `PENDENTE_REVISAO`.

### 9.10 Ações/Observações

Campo com ações contextuais.

Exemplos:

- Salvar alteração;
- Reverter alteração;
- Ratear quantidade;
- Ver histórico;
- Confirmar N/A;
- Exibir detalhe técnico.

## 10. Estrutura hierárquica das linhas

A tabela deve ser hierárquica, com linha-mãe e linhas-filhas.

### 10.1 Linha-mãe

Representa o item original do PAD.

Características:

- Tipo: `ITEM_PAD`;
- Mostra quantidade e valor total originais do PAD;
- Serve como agrupador do rateio;
- Pode ser expandida ou recolhida;
- Deve iniciar expandida por padrão;
- Não deve ser tratada como linha final quando houver rateio em linhas-filhas.

### 10.2 Linha-filha

Representa uma fração rateada/classificada da linha-mãe.

Características:

- Tipo: `ITEM_RATEADO`;
- Fica visualmente agrupada abaixo da linha-mãe;
- Exibe área, natureza, quantidade rateada, valor unitário e valor total calculado;
- Área é editável por dropdown;
- Quantidade pode ser ajustada via editor de rateio;
- Herda descrição, natureza, código de natureza e valor unitário da linha-mãe, salvo regra técnica específica.

## 11. Estado expandido padrão

Ao carregar a página:

```text
Todas as linhas-mãe devem vir expandidas por padrão.
```

O usuário pode recolher manualmente uma linha-mãe para reduzir a visualização.

Comportamento esperado:

- Clique na linha-mãe: recolhe/expande filhos;
- Clique no ícone de expansão: recolhe/expande filhos;
- Estado padrão: expandido.

## 12. Comportamento de edição da Área

Ao clicar na célula Área de uma linha-filha:

1. Abre dropdown;
2. Usuário escolhe a área;
3. Sistema marca a linha como alterada localmente;
4. Usuário confirma/salva;
5. Sistema registra decisão auditável;
6. Sistema atualiza a memória de classificação/rateio;
7. Sistema revalida o grupo da linha-mãe.

Valores do dropdown:

- Ouvidoria;
- Corregedoria;
- Escola Penal;
- N/A;
- Não classificado.

Regras:

1. Se área = `Não classificado`, a linha permanece pendente.
2. Se área = `N/A`, sistema deve exigir confirmação quando o item não for saldo residual/remanescente.
3. Alteração de área não pode alterar quantidade automaticamente.
4. Alteração de área não pode publicar dados.

## 13. Comportamento de edição da Quantidade/rateio

Ao clicar na célula Quantidade de uma linha-mãe ou linha-filha:

1. Mostrar opção `Ratear quantidade`;
2. Abrir editor de rateio;
3. Permitir adicionar duas ou mais linhas;
4. Cada linha de rateio deve exigir:
   - Área;
   - Quantidade;
5. Valor unitário é herdado;
6. Valor total é calculado;
7. Sistema valida se a soma das quantidades equivale à quantidade original;
8. Se a soma não bater, bloquear salvamento;
9. Se a soma bater, salvar rateio como memória operacional;
10. Atualizar as linhas-filhas imediatamente na tabela.

Exemplo:

```text
Linha-mãe:
ITEM_PAD | - | Notebook | CAPITAL | 449052 | 10 | R$ 3.000,00 | R$ 30.000,00

Linhas-filhas:
ITEM_RATEADO | Ouvidoria    | Notebook | CAPITAL | 449052 | 6 | R$ 3.000,00 | R$ 18.000,00
ITEM_RATEADO | Corregedoria | Notebook | CAPITAL | 449052 | 4 | R$ 3.000,00 | R$ 12.000,00
```

## 14. Regras de validação do rateio

Antes de salvar, o sistema deve validar:

```text
somaQuantidadesFilhas === quantidadeLinhaMae
```

Se houver decimais, deve ser usada tolerância definida pelo sistema.

Para valores:

```text
somaValoresFilhas ≈ valorTotalLinhaMae
```

admitida apenas tolerância de centavos.

Bloquear salvamento se:

- soma das quantidades for maior que a quantidade original;
- soma das quantidades for menor que a quantidade original;
- alguma linha-filha estiver sem área;
- alguma linha-filha tiver área inválida;
- quantidade for negativa;
- quantidade for zero sem justificativa;
- natureza divergir da linha-mãe;
- código de natureza divergir da linha-mãe.

## 15. Persistência das alterações

Toda edição deve ser salva por serviço existente de decisão/memória, nunca por SQL direto.

Eventos de persistência esperados:

- `ALTERAR_AREA_RATEIO`;
- `ALTERAR_QUANTIDADE_RATEIO`;
- `CRIAR_RATEIO_ITEM`;
- `REVERTER_RATEIO_ITEM`;
- `CONFIRMAR_NA`.

Campos mínimos do registro:

```json
{
  "tipoEvento": "ALTERAR_QUANTIDADE_RATEIO",
  "uf": "AC",
  "numeroConvenio": "937XXX",
  "itemId": "abc123",
  "chaveItem": "hash-ou-chave",
  "descricao": "Notebook...",
  "natureza": "CAPITAL",
  "codigoNatureza": "449052",
  "quantidadeOriginal": 10,
  "rateioAnterior": [
    { "area": "OUVIDORIA", "quantidade": 5 },
    { "area": "CORREGEDORIA", "quantidade": 5 }
  ],
  "rateioNovo": [
    { "area": "OUVIDORIA", "quantidade": 6 },
    { "area": "CORREGEDORIA", "quantidade": 4 }
  ],
  "usuarioResponsavel": "texto informado pelo usuário",
  "justificativa": "texto obrigatório quando alterar memória",
  "dataHora": "ISO"
}
```

## 16. Regras para item novo

Se o PAD trouxer item que não existe na memória:

- Exibir como linha-mãe `ITEM_NOVO`;
- Criar linha-filha pendente com área `Não classificado`;
- Situação: `ITEM_NOVO_SEM_RATEIO`;
- Permitir ao usuário classificar área e quantidade;
- Após salvar, o rateio deve passar a integrar a memória operacional.

Não pode:

- inventar rateio;
- aplicar distribuição igual provisória;
- ocultar o item;
- publicar automaticamente.

## 17. Regras para item suprimido

Se item conhecido da memória não vier no PAD novo:

- Não gerar erro operacional automático;
- Classificar como `ITEM_SUPRIMIDO_HISTORICO`;
- Exibir em aba/filtro histórico, se necessário;
- Não bloquear a revisão da UF, salvo regra material específica.

## 18. Regras para saldo residual/remanescente

Saldo residual/remanescente deve ser tratado com regra própria:

- Pode ser Área = `N/A`;
- Não deve ser forçado para Ouvidoria, Corregedoria ou Escola Penal;
- Não deve fundir `CAPITAL` e `CUSTEIO`;
- Se natureza estiver ausente, mostrar `NAO_INFORMADO`;
- Se o usuário tentar classificar saldo residual para área finalística, exigir confirmação.

## 19. Estados visuais

Estados visuais sugeridos:

- Linha OK: cor neutra;
- Linha nova sem rateio: destaque amarelo;
- Linha sem área: destaque amarelo;
- Linha com erro de soma: destaque vermelho;
- Linha suprimida: cinza/histórico;
- Linha alterada não salva: borda azul ou marcador `alterado`;
- Linha salva: marcador `salvo`.

## 20. Modelo de dados sugerido

### 20.1 Linha-mãe

```json
{
  "id": "linha-mae-abc123",
  "tipo": "ITEM_PAD",
  "uf": "AC",
  "numeroConvenio": "937XXX",
  "itemId": "abc123",
  "descricao": "Notebook 4 núcleos...",
  "natureza": "CAPITAL",
  "codigoNatureza": "449052",
  "quantidadeOriginal": 10,
  "valorUnitario": 3000.00,
  "valorTotalOriginal": 30000.00,
  "expandidoPorPadrao": true,
  "status": "RATEIO_MEMORIZADO_APLICADO",
  "filhos": ["linha-filha-1", "linha-filha-2"]
}
```

### 20.2 Linha-filha

```json
{
  "id": "linha-filha-1",
  "parentId": "linha-mae-abc123",
  "tipo": "ITEM_RATEADO",
  "area": "OUVIDORIA",
  "descricao": "Notebook 4 núcleos...",
  "natureza": "CAPITAL",
  "codigoNatureza": "449052",
  "quantidade": 6,
  "valorUnitario": 3000.00,
  "valorTotal": 18000.00,
  "origem": "MEMORIA_RATEIO_OPERACIONAL",
  "status": "OK"
}
```

### 20.3 Item novo sem rateio

```json
{
  "id": "linha-mae-novo-001",
  "tipo": "ITEM_NOVO",
  "uf": "AC",
  "numeroConvenio": "937XXX",
  "descricao": "Novo item do PAD",
  "natureza": "CAPITAL",
  "codigoNatureza": "449052",
  "quantidadeOriginal": 1,
  "valorUnitario": 5000.00,
  "valorTotalOriginal": 5000.00,
  "expandidoPorPadrao": true,
  "status": "ITEM_NOVO_SEM_RATEIO",
  "filhos": [
    {
      "tipo": "ITEM_RATEADO",
      "area": "NAO_CLASSIFICADO",
      "quantidade": 1,
      "valorUnitario": 5000.00,
      "valorTotal": 5000.00,
      "status": "AREA_NAO_CLASSIFICADA"
    }
  ]
}
```

## 21. Critérios de aceite

A interface será considerada adequada se:

1. Usuário consegue selecionar UF;
2. Usuário visualiza o plano detalhado da UF/convênio em tabela;
3. As colunas aparecem na ordem:
   - Tipo;
   - Área;
   - Descrição;
   - Natureza;
   - Código Natureza;
   - Quantidade;
   - Valor Unitário;
   - Valor Total;
   - Situação;
   - Ações/Observações;
4. Linhas-mãe aparecem expandidas por padrão;
5. Linhas-filhas aparecem agrupadas sob a linha-mãe;
6. Área é editável por dropdown;
7. Quantidade permite abrir editor de rateio;
8. Rateio pode gerar duas ou mais linhas-filhas;
9. Soma das quantidades é validada;
10. Sistema não inventa rateio;
11. Item novo sem rateio aparece como pendência;
12. Item suprimido não aparece como erro indevido;
13. Alterações são salvas por serviço de decisão/memória, não por SQL direto;
14. Não há comparação com origem antiga;
15. Não há publicação automática;
16. Não há consulta DETRU/Transferegov;
17. Não há alteração em `frontend/data/publicados` nessa etapa.

## 22. Restrições técnicas

O fluxo não deve:

- Reintroduzir planilha antiga por abas;
- Usar comparação com origem antiga;
- Usar fallback workbook antigo;
- Usar distribuição igual provisória;
- Publicar automaticamente;
- Acionar DETRU;
- Acionar Transferegov;
- Alterar dados publicados;
- Alterar `.env`;
- Alterar SQLite diretamente por SQL manual;
- Registrar decisão por SQL direto.

## 23. Resumo técnico final

A **Tela de Revisões PAD** deve ser uma grade hierárquica editável do plano de aplicação PAD reconstruído.

A unidade de trabalho é o item do plano de aplicação.

A unidade visual principal é a linha-mãe do PAD, expandida por padrão, com suas linhas-filhas de rateio agrupadas abaixo.

As únicas edições diretas permitidas são:

- Área;
- Quantidade/rateio.

Todo o restante deve ser calculado, herdado do PAD ou derivado da memória da aplicação.

A tela deve servir ao fluxo real de trabalho: selecionar UF, revisar o plano detalhado, ajustar área e rateio quando necessário, salvar decisão auditável e manter o sistema pronto para reconstrução local segura, sem publicação automática.
