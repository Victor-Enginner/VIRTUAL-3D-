# Learning Meta-Skills for Agent Harness Design (arXiv 2609.38143)

- **Autores:** Qian, Zhu, Li, Wang, Ji. · **Lido:** completo (seções 3 e 5).

## Mecanismo
- **Builder** (constrói o harness) e **Target** (executa a tarefa), ambos com pesos congelados.
- **Meta-skill = (quando, fornecer, usar):** *quando* = condição observável que pede apoio; *fornecer* = capacidade ou
  recurso que o ambiente deve dar; *usar* = como o Target usa esse apoio **e o que continua sendo decisão dele**.
- **Aprendizado:** banco começa vazio; a cada lote de tarefas de desenvolvimento o Builder revê execuções e decide
  **uma** coisa — manter, revisar uma skill ou adicionar uma — e **toda mudança cita a evidência daquele lote**.
- **Teste:** banco **congelado**; cada tarefa recebe o banco inteiro ou só **até 2 skills** recuperadas por BM25.
- 7 famílias de componente de harness: instruções, memória, organização de contexto, ferramentas compostas,
  controle de execução, verificação/recuperação, preparação do espaço de trabalho.

## Números
- Banco completo: 65,31% de média (+8,95 pts vs sem skill; +10,93 vs skills do próprio Target; supera "entregar o
  banco direto ao Target" nos 6 cenários).
- **Ablação:** tirar o **controlador de execução** derruba até 13,36 pts; memória+contexto têm efeito incerto
  (pode até atrapalhar quando traz evidência redundante ou velha).
- NewtonBench: "sem entrega válida" cai 35,5%; 145 recuperações contra 46 regressões.

## No Prospector
| Conceito | Onde | Status |
|---|---|---|
| Regra = quando + fornecer + evidências | `src/tocomas/habilidades.mjs` (`quando`, `fornecer`, `evidencias`) | feito |
| Banco só muda com evidência | proposta exige ≥ 2 descartes e nenhum contraexemplo aprovado | feito |
| Congelar e revisar (você aceita) | estados proposta/ativa/revisada | feito (revisão humana em vez de congelamento por tempo) |
| Campo **"usar"** (o que continua decisão sua/da Nova) | — | backlog B9 |
| **Uma** mudança por lote | hoje `propor()` pode criar várias de uma vez | backlog B9 |
