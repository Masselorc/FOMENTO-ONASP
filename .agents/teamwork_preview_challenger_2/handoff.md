# Laudo Pericial de Auditoria Empírica e Aritmética Contábil (Challenger Verdict)

**Agente**: `teamwork_preview_challenger_2` (Empirical Challenger / Critic)  
**Data/Hora**: 2026-09-01T13:25:00Z  
**Diretório de Trabalho**: `.agents/teamwork_preview_challenger_2/`  
**Veredito Oficial**: **APPROVE** (100% de Aritmética Exata, Paridade Integral e Blindagem Validada)

---

## 1. Observation

### 1.1. Execução de Oráculos de Teste Empírico Próprios
Foi desenvolvido e executado o oráculo de testes adversariais `tests/services/challenger-auditoria-paridade-empirica.test.js`, com 10 testes independentes cobrindo exaustivamente:
1. **CHALLENGE 1: Aritmética exata de centavos em aplicacao.json e dashboard-geral.json**:
   - `dadosBase`: 180 registros.
   - Soma exata calculada em centavos inteiros (`BigInt`): `1502237224n` centavos = **R$ 15.022.372,24**.
   - Partição por instrumento:
     - 15 Convênios PROFOR: `1066401524n` centavos = **R$ 10.664.015,24** (100% paridade).
     - 148 itens FAF 2021: `175735700n` centavos = **R$ 1.757.357,00** (100% paridade).
     - 17 Doações de Bens: `260100000n` centavos = **R$ 2.601.000,00** (100% paridade).
     - Invariante contábil: `1066401524n + 175735700n + 260100000n === 1502237224n` (diferença de R$ 0,00).
   - 15 Convênios PROFOR 2022 em `dadosProfor2022.convenios`:
     - Soma de `valorGlobal`: `1066401524n` centavos = **R$ 10.664.015,24**.
     - Soma de `valorRepasse` (União): `1021725454n` centavos = **R$ 10.217.254,54**.
     - Soma de `valorContrapartida` (Estados): `27241411n` centavos = **R$ 272.414,11**.
     - Cobertura de 15/15/15: 15 com DETRU, 15 com Transferegov e 15 com planos de aplicação não vazios.
   - Paridade profunda (`assert.deepEqual`) entre `aplicacao.json.dadosBase` e `dashboard-geral.json.dadosBase`: **PASS**.

2. **CHALLENGE 2: Aritmética e integridade de orcamento-2026.json**:
   - 9 processos oficiais autuados em `itensOficiais`: soma de `valorPrevisto` = `605460000n` centavos = **R$ 6.054.600,00**.
   - 3 frentes estratégicas em `resumoFrentes`:
     - Frente 1 (Aparelhamento): Total R$ 5.500.000,00 | Previsto R$ 5.500.000,00 | Em Execução R$ 4.889.876,00 | Saldo Disp R$ 0,00 | 6 itens.
     - Frente 2 (Campanha): Total R$ 300.000,00 | Previsto R$ 300.000,00 | Em Execução R$ 130.000,00 | Saldo Disp R$ 0,00 | 1 item.
     - Frente 3 (Capacitação): Total R$ 300.000,00 | Previsto R$ 254.600,00 | Em Execução R$ 254.600,00 | Saldo Disp R$ 45.400,00 | 2 itens.
   - Soma da dotação global das 3 frentes: `610000000n` centavos = **R$ 6.100.000,00**.
   - Soma da execução das 3 frentes: `527447600n` centavos = **R$ 5.274.476,00**.
   - Saldo planejado apurado: `610000000n - 527447600n = 82552400n` centavos = **R$ 825.524,00**.
   - Fechamento dimensional das 3 visões do resumo:
     - `porStatus` (7 em execução + 2 autuados): `605460000n` centavos = R$ 6.054.600,00.
     - `porNatureza` (Capital R$ 5.500.000 + Custeio R$ 554.600): `605460000n` centavos = R$ 6.054.600,00.
     - `porModalidade` (Convênios R$ 2.8M + Doações R$ 2.7M + Gráficos R$ 300k + Capacitação R$ 254.6k): `605460000n` centavos = R$ 6.054.600,00.

3. **CHALLENGE 3: Aritmética e integridade de formalizacao-profor.json**:
   - 14 propostas de celebração, cada uma com repasse exato de R$ 200.000,00 e contrapartida R$ 0,00.
   - Soma de repasse: `280000000n` centavos = **R$ 2.800.000,00**.
   - 14 UFs autorizadas (AM, AP, BA, CE, DF, ES, GO, MG, PA, PE, RN, RR, RS, SE), idênticas ao conjunto das 14 propostas.
   - 4 UFs em condição suspensiva (PA, RR, RS, SE), subconjunto estrito das 14 autorizadas.

4. **CHALLENGE 4: Integridade e contabilidade de parametros-minimos.json**:
   - 15 parâmetros mínimos disponíveis em 5 eixos temáticos.
   - 28 unidades diagnosticadas (26 estados + DF + desdobramento ES_1 e ES_2).
   - Cada uma das 28 respostas avalia os 15 parâmetros (`r.parametrosMinimos.length === 15`).
   - A soma individual dos déficits dos 15 parâmetros por unidade coincide com precisão de 100% com `r.resumoParametrosMinimos.deficitMaterial` para todas as 28 unidades (0 divergências).
   - Soma total dos déficits materiais declarados: exatamente **186 déficits**.

5. **CHALLENGE 5: Integridade e contabilidade de contatos.json**:
   - 27 UFs únicas cobertas (100% das UFs oficiais do Brasil).
   - 29 cadastros institucionais em `cadastroPorUf`: 25 UFs com 1 órgão + 2 UFs com 2 órgãos (ES: PPES e SEJUS/ES; PR: DEPEN/PR e SESP/PR).
   - 150 contatos nominais públicos em `pessoasPorUf`.
   - Correspondência profunda (`deepEqual`) com o serviço `listarContatosPublicos()`.

6. **CHALLENGE 6: Consistência referencial cruzada com resumo-publicacao.json**:
   - Todos os 6 datasets publicados em disco estão catalogados no manifesto `resumo-publicacao.json`.
   - Todos os totalizadores (`aplicacaoDadosBase: 180`, `conveniosProfor2022: 15`, `parametrosMinimos: 28`, `formalizacaoProfor: 14`, `orcamento2026: 9`, `contatos: { ufs: 27, cadastrosInstitucionais: 29, contatosNominais: 150 }`, `dashboard: { totalFomento: 15022372.24, totalConvenios: 10664015.24, totalFaf: 1757357, totalDoacoes: 2601000, quantidadeUfsConvenios: 15 }`) coincidem 1:1 com os dados estáticos.

7. **CHALLENGE 7: Mapeamento e consistência de UFs (27 UFs + ES_1/ES_2)**:
   - Conjunto oficial de 27 UFs do IBGE validado em todos os datasets.
   - `parametros-minimos.json` utiliza exclusivamente a partição canônica de 28 unidades (`ES_1` e `ES_2` no lugar do ES genérico).
   - Zero UFs inválidas, nulas ou corrompidas.

8. **CHALLENGE 8: Segurança, ausência de PII e blindagem estática**:
   - Zero ocorrências de strings de conexão Postgres (`postgres://`, `postgresql://`).
   - Zero tokens Bearer, senhas ou tokens administrativos (`PROFOR_ADMIN_TOKEN`, `ONASP_EDIT_PASSWORD`).
   - Zero endereços de host locais/privados (`localhost`, `127.0.0.1`, `192.168.x.x`, `10.x.x.x`).
   - Zero vetores de injeção XSS/HTML (`<script>`, `<iframe>`, `javascript:`, `onerror=`, `onload=`).
   - Zero CPFs formatados expostos.

9. **CHALLENGE 9: Sanitização estrutural e expurgo de estruturas brutas**:
   - Confirmada a ausência de `detru` em `aplicacao.json`.
   - Confirmada a ausência de `respostasBrutas` em `parametros-minimos.json`.
   - Confirmada a ausência de `registros` em `formalizacao-profor.json`.
   - Confirmada a ausência de `arquivo` (caminho local) em `orcamento-2026.json`.

10. **CHALLENGE 10: Verificação independente dos Critérios de Aceitação**:
    - AC1 (Estrutura e Esquemas): APROVADO.
    - AC2 (Paridade Total de Valores do Dashboard): APROVADO.
    - AC3 (Diagnóstico de Fidelidade): APROVADO.

---

### 1.2. Resultado da Suite de Testes Oficiais

| Comando | Total de Testes | Aprovados | Falhas | Skipped | Exit Code | Status |
|---|---|---|---|---|---|---|
| `node --test tests/services/challenger-auditoria-paridade-empirica.test.js` | 10 | 10 | 0 | 0 | 0 | **PASS** |
| `npm run validar:json` | 7 datasets | 7 | 0 | 0 | 0 | **PASS** |
| `npm run validar:syntax` | 110 arquivos JS | 110 | 0 | 0 | 0 | **PASS** |
| `npm run validar:services` | 578 testes | 558 | 0 | 20 (DB offline) | 0 | **PASS** |

---

## 2. Logic Chain

1. **Aritmética Exata de Centavos**:
   - A conversão de todos os valores monetários para inteiros de centavos (`Math.round(v * 100)`) e o cômputo via `BigInt` comprovam que a soma de fomento em `dadosBase` (R$ 15.022.372,24) é idêntica à soma de suas parcelas (Convênios R$ 10.664.015,24 + FAF R$ 1.757.357,00 + Doações R$ 2.601.000,00), com erro zero (R$ 0,00).
   - O saldo planejado do Orçamento 2026 fecha com exatidão em R$ 825.524,00 (R$ 6.100.000,00 de dotação global - R$ 5.274.476,00 em execução).
   - A Formalização PROFOR fecha com exatidão em R$ 2.800.000,00 (14 x R$ 200.000,00).
2. **Consistência Relacional e Mapeamento Geográfico**:
   - As 28 unidades de Parâmetros Mínimos fecham os 186 déficits tanto na soma direta dos 15 parâmetros quanto no somatório dos resumos estaduais.
   - O desdobramento institucional de Contatos (27 UFs / 29 órgãos) decorre com precisão da duplicidade de órgãos de segurança pública em ES (PPES/SEJUS) e PR (DEPEN/SESP).
3. **Integridade Referencial e Sanitização**:
   - O arquivo `resumo-publicacao.json` atua como manifesto estrito, refletindo os valores consolidados de todos os 6 datasets sem desvios.
   - As rotinas de sanitização expurgaram com sucesso dados brutos de backend e caminhos locais antes da entrega ao GitHub Pages.

---

## 3. Caveats

1. **20 Testes de Integração com Banco Postgres Ignorados**:
   - Os 20 testes que exigem conexão ao vivo com Postgres/Supabase foram ignorados de forma controlada através de guards (`isPostgresConfigured()`), o que é o comportamento esperado em ambiente de auditoria de publicação estática.
2. **Nenhum Caveat Adicional**:
   - Não foram identificadas inconsistências, desvios de arredondamento ou divergências de esquema nos arquivos estáticos auditados.

---

## 4. Conclusion

**VEREDITO OFICIAL**: **APPROVE**

1. A publicação estática contida em `frontend/data/publicados/` possui **100% de conformidade, paridade matemática estrita de centavos e integridade referencial completa** em relação às bases e serviços da ONASP.
2. Todos os requisitos (`R1`, `R2`, `R3`) e critérios de aceitação foram cumpridos integralmente e comprovados empiricamente.

---

## 5. Verification Method

Para reproduzir empiricamente este laudo de auditoria:

```pwsh
# 1. Execucao do oraculo de testes adversariais do challenger
node --test tests/services/challenger-auditoria-paridade-empirica.test.js

# 2. Execucao da suite oficial de validacao estrutural dos JSONs
npm run validar:json

# 3. Execucao da suite oficial de sintaxe
npm run validar:syntax

# 4. Execucao de toda a suite de servicos (578 testes)
npm run validar:services
```
