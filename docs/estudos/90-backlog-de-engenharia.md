# Backlog de engenharia vindo dos estudos

Cada item diz **o que muda**, **onde**, **de qual paper** e **como saber que funcionou**. Ordem = impacto para o
Prospector agora (modelos locais pequenos, 10 envios/dia, você aprova tudo).

| # | Mudança | Onde | Fonte | Pronto quando |
|---|---|---|---|---|
| **B3** ✅ 03/10 | **Política de 3 zonas** nas decisões da Nova: decide sozinha só nos extremos de probabilidade; o meio vai para você ("revisar") | `src/agentes.mjs` (qualificar) + Painel | 2609.33401 (System One), 2610.02076 | leads no meio aparecem marcados "a Nova pediu sua opinião" |
| **B1** ✅ 03/10 | **Portão de handoff:** antes de passar para o próximo nó, conferir se ele consegue consumir (ex.: redigir exige telefone + ângulo + situação do site válidos na crença); senão bloqueia com motivo | `passar()` + `src/tocomas/grafo.mjs` (requisitos por aresta) | 2609.37953 (VHS −40,85 sem isso) | teste: handoff sem fato obrigatório é recusado e vira pendência |
| **B7** ✅ 03/10 | **Preso com 3 sinais** (persistência da lacuna, estagnação, recorrência) e padrão **Parado/Ciclo/Deriva**, cada um com recuperação própria (não só "tirar da fila") | `src/tocomas/crenca.mjs` | 2610.01415 (PoS) | teste com sequências artificiais classifica os 3 padrões |
| **B6** | Separar pendência **epistêmica** (falta saber) de **realização** (falta fazer) e escolher **uma lacuna ativa** por lead | `pendencias()` | 2610.01415 | gaveta mostra "falta saber" × "falta fazer" |
| **B13** | **Só veredito escreve:** rejeições da Maia/Atlas registradas por **componente e causa** (índice), aceitos num registro | `src/agentes.mjs` + tabela `rejeicoes` | 2609.31937 (V-model) | Base do Mestre mostra "por que mensagens foram recusadas" |
| **B10** ✅ 03/10 | **Calibração** das decisões (ECE, Brier) **por nicho**, não só média | script `npm run calibracao` sobre suas aprovações | 2610.02076, 2609.33401 | relatório por nicho |
| **B9** | Regras aprendidas ganham o campo **"usar"** (o que continua decisão sua) e **uma mudança por descarte** com evidência citada | `src/tocomas/habilidades.mjs` | 2609.38143 | contrato `habilidade` com `usar`; teste de 1 proposta por evento |
| **B2** | Memória por lead limitada aos **3** fatos mais relevantes ao montar prompt | `observacao()` / prompts | 2609.37953 (pico em k = 3) | prompt da Maia com ≤ 3 fatos |
| **B12** | **Orçamento de prompt** com teste: prompt da Nova/Maia não pode crescer além de N tokens | `test/` | 2610.02001 (Mingbird M1) | teste falha se o prompt engordar |
| **B5** | **Grafo de artefatos:** cada mensagem registra de quais fatos/decisões veio | `envios`/`eventos` | 2609.38147 | gaveta mostra "esta frase veio do fato X" |
| **B11** | Nova **aconselha ou se abstém** sobre o texto da Maia | pipeline T3→T4 | 2609.38142 (padrão AdviSD) | só quando houver modelo ≥ 4B |
| **B4** | Controlador com **Propor (sem orçamento) → Avaliar (com orçamento)** | `src/tocomas/controlador.mjs` | 2609.38147 | só com modelo maior; com orçamento pequeno o paper mostra que regra vence |
| **B8** | Verificar **ordem** dos passos de planos com vários passos | `fidelidade.mjs` | 2609.38108 | quando existir plano multi-passo |
| **B14** | **Gateway de decisões** com orçamento, cache e estatística de custo/latência (estilo JEV Showcase) | `src/decide/` | JEV Showcase `gateway/` | `/api/decide/stats` |
| **B15** | Revisar o fetch do Atlas contra vazamento pela web: URL só vem do Maps/OSM, nunca de texto gerado por modelo | `src/auditoria.mjs` | 2610.01768 | teste: URL vinda de texto livre é recusada |

## Decisões de implementação (03/10/2026)
- **B3 só liga por nicho calibrado** (B10: 30+ decisões suas nas últimas 60, ECE ≤ 0,10). Antes disso tudo passa por você.
- **Zona baixa** = a Nova descarta sozinha; **zona alta** só marca confiança — envio continua exigindo sua aprovação.
- **Amostra de conferência:** 1 em 10 leads da zona baixa vem para você mesmo assim, senão a calibração dessa faixa
  pararia de ser medida (viés de seleção).

## O que os estudos dizem para NÃO fazer
- Não trocar o controlador por regra por um controlador LLM com orçamento pequeno (2609.38147, §7.3).
- Não confiar que o modelo escolha o modo de plano (2609.38108) nem que compacte sozinho só porque o prompt pediu (2610.02163).
- Não deixar toda a memória visível a todos os agentes (2609.37953, ICS −19,96).
- Não ler a média de calibração como garantia: falhas se concentram em grupos (2609.33401).
- Não usar pressão/ameaça em prompt (2609.16247).
- Não usar entropia de roteamento como detector de alucinação (2610.01495 — resultado nulo).
