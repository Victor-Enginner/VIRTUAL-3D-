# Radar arXiv — busca de 03/10/2026

API oficial do arXiv, 12 temas × 25 resultados mais recentes (300), 53 selecionados. **Lido: só o resumo** —
nada abaixo vai além do abstract. Os 3 mais aplicáveis foram lidos por inteiro em [09](09-novos-aplicaveis.md).

Temas pesquisados: orquestração, memória/crença, meta-raciocínio/orçamento, planejamento/fidelidade, harness/skills,
decisão/calibração, contexto longo, engenharia de software com agentes, avaliação, injeção de prompt, roteamento, vendas/persuasão.

## Orquestração multiagente

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.01017](https://arxiv.org/abs/2610.01017) | Pay for the Fault, Not the Flow: Label-Free In-Flow Multi-Agent Workflow Optimization | achar a falha dentro do workflow sem gabarito e consertar só ela — útil quando um agente do pipeline erra |
| [2610.00905](https://arxiv.org/abs/2610.00905) | Understanding Issues, Causes and Solutions in Open-Source LLM-based Multi-Agent Systems | estudo de 22.848 issues de 21 projetos multiagente abertos: problemas, causas e soluções reais |
| [2609.38662](https://arxiv.org/abs/2609.38662) | CollabFlow: Recursive Self-Improvement of Agent Collaboration | auto-melhoria da colaboração entre agentes (quem trabalha com quem) a partir dos resultados |
| [2609.38661](https://arxiv.org/abs/2609.38661) | EvoSteer: Online Self-Evolving Graph Orchestration via Reference-Anchored Credit Assignment | orquestração que evolui durante a execução e repara passos plausíveis mas errados; crédito por ação |
| [2609.38482](https://arxiv.org/abs/2609.38482) | PANDA: A Decentralized Architecture with Flexible Orchestration for Scalable, Fault-Tolerant Multi-Agent Systems | arquitetura descentralizada e tolerante a falhas para muitos agentes |
| [2609.36855](https://arxiv.org/abs/2609.36855) | When Upstream Messages Override Correct Answers: A Controlled Study of Multi-Agent LLM Collaboration | mensagem errada de um agente anterior faz o seguinte abandonar a resposta certa — cuidado com handoffs |
| [2610.02036](https://arxiv.org/abs/2610.02036) | Global Coherence: When Every Agent Is Right and the Team Is Still Wrong - A Local-to-Global Semantic Foundation for Multi-Agent Collaboration | "todo agente certo e o time errado": limite por observação ambígua; estado compartilhado importa |
| [2609.32700](https://arxiv.org/abs/2609.32700) | CAIRN: Dynamic Fact-Intent DAGs for Multi-Agent Exploration | grafo de fatos e intenções (DAG) entre raciocinador e workers — parecido com nossa crença + jobs |

## Memória, crença e contexto

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.00872](https://arxiv.org/abs/2610.00872) | MemFit: Efficient Long-Term Agentic Memory | memória longa barata: guarda cada turno literal e indexa por resumos de segmento, sem LLM na escrita |
| [2609.37743](https://arxiv.org/abs/2609.37743) | ContextRender: From Execution Dependencies to Agent Context | contexto montado pelo grafo de dependências de execução (o que foi reaproveitado depois) |
| [2609.36319](https://arxiv.org/abs/2609.36319) | StateTape: Action-Conditioned Evidence Lifecycle Modeling for Long-Horizon Coding Agents | ciclo de vida da evidência ligado às ações (uma escrita pode invalidar o que se sabia) |
| [2609.35540](https://arxiv.org/abs/2609.35540) | Continuous Context Management | compactar a cada turno: tarefa + memória retida + observação nova, nunca o histórico todo |
| [2609.34649](https://arxiv.org/abs/2609.34649) | Beyond Skill Evolution: Self-Evolving Context Management Policies for Long-Horizon Agent Harnesses | aprender a política de contexto a partir de falhas (parte do harness open-source Pi) |
| [2609.27298](https://arxiv.org/abs/2609.27298) | StateComp: Learning When to Compress History in Long Horizon Agents | quando um trecho do histórico pode ser comprimido com segurança, conforme o estado |
| [2609.16461](https://arxiv.org/abs/2609.16461) | Protocol-Preserving Context Trimming for Agentic Workflows: Benefits, Failure Regimes, and Budget Guardrails | 5 estratégias de corte de contexto comparadas, com limites de orçamento que preservam o protocolo |
| [2608.21690](https://arxiv.org/abs/2608.21690) | Context as an Environment: Programmatic Context Management for Long-Horizon Agents | contexto como ambiente: log só de inclusão + variáveis tipadas em vez de colar tudo no prompt |
| [2609.36789](https://arxiv.org/abs/2609.36789) | GitHarness: Git Init Your Harness Working Memory for Perpetual User Requirements | memória de trabalho versionada como git para requisitos que mudam |
| [2609.37125](https://arxiv.org/abs/2609.37125) | When Should Agents Check External State? Budgeting Observations for Stored Intentions | quando vale gastar para checar o mundo externo de novo — orçamento de observações (scorer logístico) |

## Controle, orçamento e custo

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.01110](https://arxiv.org/abs/2610.01110) | How Much Can Language Models Gain from Test-Time Computation? | quanto o test-time compute realmente rende, cobrando a seleção no orçamento |
| [2609.35760](https://arxiv.org/abs/2609.35760) | TokenCast: Forecasting Token Consumption During LLM Agent Execution | prever o consumo de tokens durante a execução do agente |
| [2609.38648](https://arxiv.org/abs/2609.38648) | StateFork: Branchable Infrastructure for Agent Exploration | ramificar e restaurar o estado do ambiente para explorar caminhos (agentes de terminal) |

## Harness e habilidades

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.01235](https://arxiv.org/abs/2610.01235) | Harness Annealing: Learning to Act with Less External Control | ensinar o modelo a assumir decisões de controle que hoje o harness faz |
| [2610.00917](https://arxiv.org/abs/2610.00917) | Finding the Right Fit: Model-Harness Interactions across Agent Tasks | 66 combinações modelo × harness: os rankings de modelo se invertem conforme o harness |
| [2609.20804](https://arxiv.org/abs/2609.20804) | An Empirical Study of Harness Design for Coding Agents | estudo por componente (planejamento, ações, contexto) de harness de código |
| [2609.32459](https://arxiv.org/abs/2609.32459) | Beyond the Model: Demystifying Harness Effects in Software Engineering Agents | efeito do harness em agentes de engenharia de software com modelos abertos Qwen/DeepSeek |
| [2610.00704](https://arxiv.org/abs/2610.00704) | SkillSpec: Consensus-Gated Agent Skill Evolution via Representation Specialization | skills evoluem só com consenso e evidência de execução; separa o que guardar de como organizar |
| [2608.29596](https://arxiv.org/abs/2608.29596) | A Systematic Survey of Agentic Skills: Architecture, Lifecycle, and Security | survey de "agentic skills": arquitetura, ciclo de vida e segurança |
| [2610.01787](https://arxiv.org/abs/2610.01787) | Not All Experience Belongs in the Weights: Component Routing for Self-Improving GUI Agents | que parte da experiência vai para os pesos e que parte vai para o contexto |
| [2610.01073](https://arxiv.org/abs/2610.01073) | Safety Must Survive Self-Improvement: Why Failures Persist and How Agents Recover | segurança precisa sobreviver à auto-melhoria; falhas persistem por pontuação histórica |

## Decisões, calibração e confiança

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.02005](https://arxiv.org/abs/2610.02005) | Counting Moves, Weighing Voices: Bayesian Dialectical Argumentation for Calibrated Multi-LLM Councils under Persistent Adversaries | conselho de LLMs com argumentação bayesiana: confiança = probabilidade de acertar, robusta a agentes ruins |
| [2609.33886](https://arxiv.org/abs/2609.33886) | LLMs learn different forms of metacognition when trained to predict their own accuracy | LLMs aprendem metacognição (prever o próprio acerto) quando treinados para isso |
| [2609.33671](https://arxiv.org/abs/2609.33671) | COGNIT-Guard: Calibrated Standalone Direct-Decision Guardrails with Heterogeneous CPU-NPU Confidence Cascading under Explicit Latency and False-Positive Constraints | guardrail que decide direto (sem gerar texto) com calibração e limite de latência |

## Verificação e autoridade

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.00972](https://arxiv.org/abs/2610.00972) | VeriHarness: Scaling Agentic Verification for Long-Horizon Tasks | verificador agêntico: discordância entre tentativas expõe a resposta certa; consenso pode esconder erro |
| [2609.34268](https://arxiv.org/abs/2609.34268) | SAGE: Symbolic Action-Gating and Editing for LLM Task Planners | portão simbólico (~250 linhas, zero tokens) que bloqueia ação que viola pré-condição + edição local do plano |
| [2609.32378](https://arxiv.org/abs/2609.32378) | AuthorityLens: Rethinking LLM-Based Agent Systems Through the Lens of Authority | medir a estrutura de autoridade real de um sistema de agentes (quem pode o quê, com quem) |

## Avaliação e qualidade

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.00651](https://arxiv.org/abs/2610.00651) | Agent Evaluation Reliability: More Tasks Won't (Always) Fix An Agent Leaderboard | mais tarefas nem sempre consertam um leaderboard; decompor variância |
| [2609.17698](https://arxiv.org/abs/2609.17698) | A Large-Scale Empirical Study of Quality Assurance Practices and Gaps in AI Agents | QA em 157 projetos de agentes open-source: o que testam e as lacunas |
| [2610.00954](https://arxiv.org/abs/2610.00954) | Beyond Leaderboards: Tokenomics of Agentic Small Language Model Ensembles | custo por amostra de conjuntos de modelos pequenos com juiz pequeno, além da acurácia |

## Roteamento de modelos

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2609.32917](https://arxiv.org/abs/2609.32917) | Planner-as-Router: Joint Plan-Time Model Routing for Cost-Efficient Multi-Agent Workflows | o planejador já escolhe o tamanho de modelo de cada subtarefa (pequeno/médio/fronteira) |
| [2609.37402](https://arxiv.org/abs/2609.37402) | Routing Should Pay for Itself: Sparse Supervision for Economical LLM Routing | roteador que se paga: supervisão esparsa basta |
| [2609.34326](https://arxiv.org/abs/2609.34326) | Routing Without Embeddings: Fast And Interpretable Routing With Regular Expressions | roteamento por expressões regulares interpretáveis, sem embeddings |
| [2609.13470](https://arxiv.org/abs/2609.13470) | OrchSLM: Probing the Dynamics of Small Language Model Orchestration | dinâmica de orquestração só com modelos pequenos |

## Segurança de agentes

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2610.01768](https://arxiv.org/abs/2610.01768) | The Innocent Courier: Covert Exfiltration Through Legitimate LLM Web Fetching | vazamento de dados por agentes que buscam páginas na web (o Atlas busca sites — revisar) |
| [2609.37196](https://arxiv.org/abs/2609.37196) | ToolFence: Fine-Grained Authorization for Secure Tool-Using LLM Agents | autorização fina por efeito da ferramenta, compilada antes da execução |
| [2609.30657](https://arxiv.org/abs/2609.30657) | Prompt Injection Detection for Email Agents Through Attack Chain Modeling | detecção de injeção modelando a cadeia de ataque (vale para respostas recebidas no WhatsApp) |
| [2609.33910](https://arxiv.org/abs/2609.33910) | When Consent Outlives Context: Residual Authority Replay in Long-Lived Agents | consentimento que sobrevive ao contexto: aprovação antiga reaproveitada indevidamente |

## Negócio, vendas e persuasão

| arXiv | Título | Por que importa para o Prospector |
|---|---|---|
| [2608.30730](https://arxiv.org/abs/2608.30730) | E-Commerce Bench: Evaluating LLM Agents on Long-Horizon Autonomous Business Operation | benchmark de um ano operando lojas: negociação, estoque, fluxo de caixa |
| [2609.01188](https://arxiv.org/abs/2609.01188) | PersuaRL: Reinforcement Learning-Driven Multi-Expert Selection for Persuasive Dialogue Generation in Insurance | diálogo persuasivo com seleção de especialistas por RL (seguros) |
| [2607.07721](https://arxiv.org/abs/2607.07721) | Context Graphs for Proactive Enterprise Agents | agentes proativos com grafo de contexto e detector de mudanças — ideia para alertas da Alva |
| [2607.28330](https://arxiv.org/abs/2607.28330) | Paying for Honesty Without Knowing the Truth: Reputation-Penalty Design for LLM Marketplace Agents | agentes vendedores inventam atributos sob pressão; mecanismo de reputação sem verdade de base |
