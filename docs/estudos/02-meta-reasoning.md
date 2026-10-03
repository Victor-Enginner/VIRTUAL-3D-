# Thinking Before Thinking — Agentic Meta-Reasoning (arXiv 2609.38147)

- **Autores:** Dahal, Bakhtin, Cohen, Chen, Wu, Fergus, Yih, Synnaeve, Salakhutdinov, Arora, Weston, Goyal (Meta Superintelligence Labs).
- **Lido:** completo (seções 3, 5, 7).

## Problema
Agentes decidem "o que fazer a seguir" no mesmo passo em que trabalham, condicionados a todo o histórico. Decidir
qual resultado parcial aproveitar, quando recomeçar e quando parar é uma tarefa própria.

## Mecanismo
- **Separação:** *workers* fazem o trabalho; o **controlador** decide. Workers recebem só a instrução e os artefatos
  escolhidos — nunca o estado privado do controlador.
- **Artefato:** toda saída (tentativa, crítica, nota do controlador) é guardada com id estável.
- **Ações do controlador:** Read/Write na memória (ações epistêmicas), RunWorkers (lote paralelo com instrução +
  contexto por worker), **Stop(y)** — só pode escolher um artefato **que já existe**; para entregar algo novo, um
  worker precisa produzi-lo antes.
- **Ciclo em 4 etapas:**
  1. **Assess** — reescreve um estado compacto ("o que já sabemos, o que falta");
  2. **Propose** — lista opções **sem ver o orçamento** (para opções caras e boas não serem cortadas cedo);
  3. **Evaluate** — escolhe a opção que vale o custo dado o orçamento restante (julgamento qualitativo por prompt,
     não otimização);
  4. **Dispatch** — monta a instrução e escolhe **quais artefatos** o worker recebe.
- **Grafo de artefatos:** cada artefato registra de quais outros veio (DAG) — mostra reaproveitamento e se a resposta
  correta chegou a existir e não foi escolhida.
- Entre ciclos só o estado compacto persiste (Fig. 8: o histórico do controle direto cresce ~10×; o estado compacto fica estável).

## Números
- ProgramBench: 71,5% (GPT-5.5) vs 58,0% Codex; 67,2% (Opus 4.8) vs 65,5% Claude Code.
- Outros benchmarks: +3,6 a +4,2 pts sobre o controle direto com mesmo orçamento.
- **Continua melhorando** com mais orçamento, onde o controle direto estabiliza.

## Limitações (seção 7.3)
- **Custa mais:** com orçamento pequeno o controle direto vence (cruzamento na Fig. 3).
- Avaliação errada do controlador propaga estado enganoso; estado compacto perde informação.
- **"Reconsideração improdutiva":** no xadrez (LongCoT-mini) checar demais desestabilizou respostas já certas.
- O ganho depende do modelo.

## No Prospector
| Conceito | Onde | Status |
|---|---|---|
| Controlador separado dos agentes | `src/tocomas/controlador.mjs` | feito (modo regra) |
| Modo regra com orçamento pequeno | mesmo arquivo — escolha justificada pela seção 7.3 | feito |
| Opções com p_sucesso, ganho, custo registradas | contrato `decisao-controlador` | feito |
| Propor sem ver orçamento / Avaliar com orçamento | — | backlog B4 (quando houver modelo maior) |
| Grafo de artefatos (de onde veio cada mensagem) | — | backlog B5 |
| "Stop só com artefato existente" | a Maia já só aprova mensagem que existe | equivalente |
