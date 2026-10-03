# Jev, Awesome Jev e JEV Showcase (material local)

## O que é o Jev
Modelo de **decisões** da TypeSafe (`typesafe/jev-1.13`, via OpenRouter): recebe um **estado** e **perguntas tipadas**
— `choice` (escolha), `score` (nota numa escala), `noul` (sim/não) — e devolve **probabilidades**, em ~0,2–0,5 s, com
dezenas de perguntas por chamada. Não gera texto. (Fonte: `JEV SHOWCASE/jev-showcase/README.md`.)
Ideia "System 1 × System 2": decisões pequenas e frequentes num modelo rápido e tipado; o modelo de raciocínio
pesado fica para planejamento aberto. (Fonte: `AGENTES WEB SITE SKILL COMPLEX/JEV.md`, radar Awesome Jev.)
Os números de latência e custo do radar são **do próprio radar — não verificados por nós**.

## Awesome Jev (radar, 799 projetos) — `AGENTES WEB SITE SKILL COMPLEX/JEV.md`
Categorias que conversam com o Prospector: **Decision Tools**, **Model Routing**, **Evaluation & Observability**,
**Security & Guardrails**, **Context GC**, **SDK & Decision Frameworks**. Há uma skill local:
`opensource-marketplace/.agents/skills/awesome-jev/SKILL.md` (consulta o catálogo público; trata código de terceiros como dado não confiável).

## JEV Showcase — `opensource-marketplace/JEV SHOWCASE/jev-showcase/`
4 apps + plataforma, **Node 22 sem dependências** (mesmo estilo do Prospector):

| App | Padrão de decisão que podemos reaproveitar |
|---|---|
| Planilha Preditiva | preencher uma coluna inteira por decisões em lote (ex.: classificar centenas de leads de uma vez) |
| Busca que Entende | avaliar o catálogo inteiro por pergunta (ex.: "quais leads combinam com este serviço") |
| Site que Lê Intenções | página que se monta conforme o que a pessoa abre → **base para o mini-site de demonstração do lead** |
| Estúdio por Voz | site, marca e anúncios a partir de uma fala → gerador de proposta para o lead |

Infra que vale copiar: **gateway único** que guarda a chave, aplica orçamento, limite por IP, cache e re-tentativa e
registra custo/latência de cada decisão (`gateway/`); **inspetor "Ver o que o Jev vê"** (estado, perguntas e respostas
reais de cada chamada) — o mesmo que a gaveta do lead faz em "Como a Nova decidiu".

## No Prospector
- `src/decide/index.mjs` implementa a mesma interface (choice/score/noul + probabilidades) com modelo **local**
  (Qwen pelo Ollama, leitura de logprobs — ver 06) e, opcional e **pago**, o Jev real (`DECIDE_BACKEND=jev`).
- Backlog: gateway com orçamento/estatísticas no estilo do Showcase (B14); mini-site do lead a partir do "Site que Lê Intenções".
