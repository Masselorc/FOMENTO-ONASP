# Diagnóstico #55 -> #8 - Forno de Micro-ondas AL

Gerado em: 2026-05-21T22:03:13.410Z

## Conclusão

A #55 tem correspondente no PAD novo pela #8. O vínculo #55 -> #8 é tecnicamente provável. A divergência de quantidade decorre de inconsistência de leitura/agregação da memória, não de divergência material do PAD, pois a quantidade original da planilha é 1.0 e os valores fecham integralmente com o PAD.

Classificação: `substituto_compativel_com_quantidade_memoria_inconsistente`.

## #55 - memória ausente

- Status: `PENDENTE`
- Tipo: `item_ausente_no_pad`
- Convênio/UF: `937221/AL`
- Chave: `937221::FORNO DE MICROONDAS - 32 LITROS - BRANCO`
- Descrição: Forno de Microondas - 32 litros - Branco
- Natureza: CAPITAL
- Quantidade no payload: 10
- Valor unitário: 726
- Valor previsto: 726
- Valor executado: 0
- Saldo: 726
- Rateios ativos: 1
- Decisões: 0

## #8 - item PAD substituto

- Status: `ACEITO`
- Tipo: `item_novo_sem_rateio`
- Convênio/UF: `937221/AL`
- Chave: `937221::FORNO DE MICRO-ONDAS A PARTIR DE- 32 LIT`
- Descrição PAD: Forno de Micro-ondas a partir de- 32 lit
- Natureza PAD: CAPITAL
- Quantidade PAD: 1
- Valor unitário PAD: 726
- Valor previsto PAD: 726
- Valor executado PAD: 0
- Saldo PAD: 726
- Decisão atual: ACEITO (#140)

## Comparação

| Campo | Memória #55 | PAD #8 | Resultado |
|---|---:|---:|---|
| Natureza | CAPITAL | CAPITAL | compatível |
| Quantidade payload | 10 | 1 | divergente |
| Quantidade planilha antiga | 1.0 | 1 | compatível |
| Valor unitário | 726 | 726 | compatível |
| Valor previsto | 726 | 726 | compatível |
| Valor executado | 0 | 0 | compatível |
| Saldo | 726 | 726 | compatível |

## Origem da quantidade 10

A planilha antiga, aba `AL`, linha 12, traz quantidade `1.0` para `Forno de Microondas - 32 litros - Branco`. A rotina de extração de rateio inicial converteu essa string por `moedaParaNumeroProfor`; para `"1.0"`, o parser remove o ponto e retorna `10`. Por isso o banco/payload exibem quantidade `10`, embora o valor previsto `726` e o valor unitário `726` indiquem quantidade efetiva `1`.

## Recomendação

Não confirmar ausência. Tratar como substituição/atualização de descrição com saneamento assistido, usando a #8 já aceita como item PAD e registrando posteriormente decisão auditável para a #55, se autorizado. Antes de saneamentos em massa, corrigir ou isolar o parser de quantidade para não transformar strings decimais como "1.0" em 10.

## Escopo

Nenhuma decisão foi registrada, nenhum status foi alterado, nada foi publicado e o planoAplicacao oficial não foi alterado.
