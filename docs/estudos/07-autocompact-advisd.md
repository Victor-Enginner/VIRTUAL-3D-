# AutoCompact (arXiv 2610.02163) e AdviSD (arXiv 2609.38142)

## AutoCompact — quando compactar o contexto
- **Autores:** Zhang, Zheng, Du, An, Dong (SMU, NTU, Harvard). · **Lido:** método (seção 2) e resultados.
- Ação `compact()` que o agente chama **antes** do limite; o histórico vira um resumo `# Auto Context Summary`
  (conclusões, estado do código/workspace, próximos passos) e a tarefa original fica intacta.
- 3 decisões supervisionadas: **gatilho** (compactar quando a etapa terminou), **estado de trabalho** (o resumo guarda
  o necessário) e **continuação** (agir bem depois).
- **Achado que importa para nós:** *"só pedir no prompt não induz compactação proativa"* — o modelo base quase nunca
  chamou `compact()` antes do limite, mesmo com regras no prompt. Por isso treinaram (SFT + RL).
- Números: SWE-bench Verified 39,6% (+9,2), SWE-PolyBench Verified 24,5% (+5,0).
- **No Prospector:** compactação **por regra** (cada nó guarda só fatos na crença; HTML e tentativas ficam de fora) —
  justamente porque pedir ao modelo não funciona e não vamos treinar agora.

## AdviSD — aconselhar ou abster
- **Autores:** Agrawal, Cui, Li, Wu, Arık (Google, USC). · **Lido:** págs. 1–2 e figura do método.
- Conselheiro pequeno (Qwen3-8B) que, antes de cada resposta do executor congelado, **dá um conselho ou se abstém**.
  Treino: GRPO + autodestilação **seletiva** (só aprende das correções em que o conselho realmente mudaria a execução).
- +4,2 a 6,4 pts sobre advisor-GRPO no BFCL-v3; generaliza entre famílias de executor.
- **No Prospector:** só o padrão — a Nova poderia revisar o texto da Maia e **abster-se** quando não tiver o que
  acrescentar (backlog B11). Treino fica para quando houver GPU e dados.
