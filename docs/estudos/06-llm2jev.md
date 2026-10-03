# LLM2Jev — LLMs Are Already Jev-Style Decision Models (arXiv 2610.02076)

- **Autores:** Yinheng Li, Justin Wagle (Microsoft). · **Lido:** método (seções 2–3) e conclusões.

## Mecanismo
- Decisão = distribuição sobre opções fixas. Os 3 formatos do Jev cabem num só: **choice**, **noul** (sim/não com
  critérios de aceite) e **score** (opções ordenadas).
- **Interface sem treino:** chat template com *thinking* desligado; o prompt lista `[1] … [K]`; o turno do assistente
  começa com o prefixo fixo **`Best answer: [`**; a opção k é a continuação **`k]`**. O colchete de fechamento torna o
  conjunto **livre de prefixo** (1] não é prefixo de 12]) → aceita K grande. Sufixos avaliados em paralelo com o
  KV-cache do prefixo.
- **Viés de posição:** reconhecido; no fine-tune embaralham a ordem; a média por permutações (AnyJev) reduz mais o
  viés, ao custo de chamadas proporcionais.
- **Fine-tune:** loss listwise fatorada em árvore + âncora de KL no modelo base; vale para modelos pequenos e domínios
  específicos; aplicado indiscriminadamente em modelo capaz pode **piorar**.
- **Calibração:** medem **ECE** e **Brier** direto das probabilidades, sem escalonamento posterior — porque o sistema
  usa a probabilidade para mandar casos de baixa confiança para revisão humana.

## Números
Qwen3.5-4B sem treino iguala modelos Jev comunitários da mesma base e supera leitura por letra; o "jev-local"
(uma passada por opção) fica em 74,9% contra 81,4% da leitura em lista (JevBench público, diagnóstico).

## No Prospector (`src/decide/index.mjs`)
| Conceito | Status |
|---|---|
| Opções `[1]..[n]` e leitura de logprobs do próximo token | feito (até 9 opções, um token por opção) |
| Rotação cíclica das opções (AnyJev L0) | feito (`combinarRotacoes`) — custa n chamadas |
| Formato `k]` para mais de 9 opções | não precisamos hoje (máx. 5 ângulos) |
| **ECE / Brier** das decisões da Nova | backlog B10 |
| Política de 3 zonas com a probabilidade (ver 09) | backlog B3 |
