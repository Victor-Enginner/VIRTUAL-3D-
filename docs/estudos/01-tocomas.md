# TOCOMAS — Topology-Coherent Multi-Agent System (arXiv 2609.37953)

- **Autores:** Zhao, Kong, Zhang, Shen, He, Zhang, Zhang (Chongqing Univ. of Posts and Telecom.; Towngas). Under review.
- **Lido:** completo (seções 3–6).

## Problema
Sistemas multiagente otimizam agentes, comunicação e memória **separadamente**. Nada obriga essas três estruturas a
continuarem compatíveis com a tarefa quando o sistema evolui. Os autores chamam essa exigência de **coerência topológica**.

## Mecanismo (como está no paper)
1. **Grafo da tarefa → ferramentas.** Cada nó da tarefa recebe o menor conjunto válido de ferramentas (cobertura de
   capacidade, compatibilidade de entrada/saída, efeitos colaterais).
2. **Regiões de responsabilidade (quociente).** Nós compatíveis são agrupados em regiões, medindo 4 sinais: sobreposição
   de ferramentas, compatibilidade de E/S, adjacência de dependência e similaridade semântica. Uma fusão só vale se o
   grafo de regiões continuar **acíclico**. Um agente pode ser dono de várias regiões; o papel do agente é definido
   pela região, não por um rótulo de texto.
3. **Orquestração derivada das dependências.** As arestas obrigatórias de comunicação saem das dependências entre
   regiões; arestas extras (por perfil/afinidade) podem ser podadas. O handoff expõe **só o artefato que o próximo
   precisa**, passando por um **portão de handoff** (relevância, confiança, conflito → entrega ou rejeita; predecessor
   com falha → bloqueia/repete; escalada opcional a verificador).
4. **Memória com fronteira.** Cada registro tem dono, região e proveniência. A visibilidade é filtrada pela fronteira
   **antes** da busca semântica (a relevância ordena, mas não fura a fronteira). Se uma região muda de dono, a memória
   privada dela muda junto, com proveniência.
5. **Evolução com restrição.** Uma proposta de mudança estrutural só fica se passar no teste estrutural (todo nó tem
   dono capaz; handoffs e visibilidade respeitam as fronteiras) **e** melhorar a recompensa sobre o pai.

## Números (Tabela 1/2, Qwen3.8-27B)
- BBEH 54,78% · WorkBench 77,68% · SWE-Bench-Verified 48,00% (+8,26 / +15,51 / +8,00 pts sobre o melhor baseline).
- **Ablação:** trocar handoffs derivados por "predecessor fixo" derruba a aceitação de artefatos (VHS) em **40,85 pts**
  e o sucesso no CoMemBench a zero. Tornar todo registro verificado **visível para todos** reduz o isolamento (ICS) em
  **19,96 pts**. Sem evolução, WorkBench cai 6,52 pts.
- **Sensibilidade:** memória com **k = 3** registros é o pico; com k = 8 piora. Afinidade de agrupamento ideal ~0,6.
- **Custo:** abaixo dos outros multiagentes na maioria das faixas de progresso; chamada direta segue mais barata.

## Limitações (dos autores / nossas)
- Avaliado com modelos grandes (27B+); não há resultado com modelos de 1–4B como os nossos.
- O grafo da tarefa vem pronto ("upstream-provided"); o paper não ensina a decompor a tarefa.

## No Prospector
| Conceito | Onde | Status |
|---|---|---|
| Grafo T1–T8, regiões por agente | `src/tocomas/grafo.mjs` (`NOS`, `ARESTAS`) | feito |
| Handoff só por aresta | `exigirHandoff` / `passar()` em `src/agentes.mjs` | feito |
| Fronteira de memória (Maia não vê HTML) | `visao(lead, 'escrita')` | feito |
| **Portão de handoff** (o próximo consegue consumir?) | — | **falta** → backlog B1 |
| Memória limitada a poucos registros relevantes | — | backlog B2 (k = 3) |
| Evolução estrutural com teste + recompensa | só para regras (F2) | parcial |
