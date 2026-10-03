# Base de estudos — engenharia de software com IA no Prospector

O que está aqui é o **conhecimento que sustenta as decisões de arquitetura** do Prospector: os papers do arXiv que
você baixou (lidos por inteiro), uma busca nova no arXiv (300 resultados, 53 selecionados) e o JEV / JEV Showcase.

Regra de todos os arquivos: cada afirmação diz de onde veio e quanto foi lido. **"lido: completo"** = texto inteiro
(seções de método, resultados e limitações). **"lido: resumo"** = só o abstract do arXiv — nesses, nada além do
resumo é afirmado. Números de terceiros que não conferimos aparecem como **não verificado**.

## Mapa: do paper ao código

| # | Arquivo | Paper | Lido | No Prospector |
|---|---|---|---|---|
| 01 | [01-tocomas.md](01-tocomas.md) | 2609.37953 TOCOMAS | completo | `src/tocomas/grafo.mjs` (domínios, arestas, visão por domínio) |
| 02 | [02-meta-reasoning.md](02-meta-reasoning.md) | 2609.38147 Meta-Reasoning | completo | `src/tocomas/controlador.mjs` (modo regra) |
| 03 | [03-pos-crenca.md](03-pos-crenca.md) | 2610.01415 PoS | completo | `src/tocomas/crenca.mjs` (fatos, pendências, preso) |
| 04 | [04-planning-as-routing.md](04-planning-as-routing.md) | 2609.38108 Planning-as-Routing | completo | `src/tocomas/fidelidade.mjs` |
| 05 | [05-meta-skills.md](05-meta-skills.md) | 2609.38143 Meta-Skills | completo | `src/tocomas/habilidades.mjs` |
| 06 | [06-llm2jev.md](06-llm2jev.md) | 2610.02076 LLM2Jev | completo (método) | `src/decide/index.mjs` |
| 07 | [07-autocompact-advisd.md](07-autocompact-advisd.md) | 2610.02163 AutoCompact · 2609.38142 AdviSD | método · parcial | padrões (compactação por regra; aconselhar ou abster) |
| 08 | [08-fora-do-escopo.md](08-fora-do-escopo.md) | Pain Axis, Routing Entropy, DRelay, NeuronEye, SCORAS, World Models, QTT, 2609.31917 | 1–2 págs. | alertas e descarte justificado |
| 09 | [09-novos-aplicaveis.md](09-novos-aplicaveis.md) | 2610.02001 Mingbird · 2609.33401 System One · 2609.31937 V-model | completo | backlog (§ 11) |
| 10 | [10-jev-e-showcase.md](10-jev-e-showcase.md) | Jev, Awesome Jev, JEV Showcase (locais) | completo | `src/decide/` e gateway futuro |
| 11 | [11-movimento-e-cognicao.md](11-movimento-e-cognicao.md) | Multidão por posição (1802.02673), força social, F-formation, Generative Agents, BTs | método do 1802.02673; resumos | `public/sala/multidao.js`, `vagas.js` |
| 20 | [20-radar-arxiv-2026-10.md](20-radar-arxiv-2026-10.md) | 50 papers por tema (busca de 03/10/2026) | resumo | leitura futura |
| 90 | [90-backlog-de-engenharia.md](90-backlog-de-engenharia.md) | o que muda no código por causa disso | — | próximo trabalho |

## Onde estão os PDFs

- `opensource-marketplace/pdf estudos agentes/` — 15 papers (o 2609.37953 tem uma cópia "(1)").
- `opensource-marketplace/2609.16247v2 (1).pdf` e `.sixth/recon/2609.16247v2.pdf` — Pain Axis (duas cópias).
- Extração antiga (só págs. 1–2): `~/.gemini/antigravity/scratch/arxiv_file_finder/extracted_papers.json`.
- Papers novos (09 e 20) não foram baixados: lidos pela página HTML/abstract do arXiv.

## Como atualizar

1. Buscar: API `https://export.arxiv.org/api/query?search_query=...&sortBy=submittedDate` (os 12 temas estão no 20).
2. Ler completo antes de implementar (método + limitações), não só o abstract.
3. Toda mudança de código motivada por paper entra no 90 com o id do paper.
