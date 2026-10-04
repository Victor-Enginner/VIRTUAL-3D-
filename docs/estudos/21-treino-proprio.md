# Treinar um modelo nosso (estudo de 04/10/2026)

**Lido: só o resumo** (abstract do arXiv). Nada abaixo vai além do que a página dos papers diz.

## Onde estamos
- O que "aprende" hoje são duas **cabeças logísticas** (aprovação e resposta) sobre os seus rótulos (`src/aprendizado.mjs`). Pequeno, mas é aprendizado nosso.
- **Nenhum LLM foi treinado por nós.** A Nova e o comando usam o Josiefied-Qwen3 1.7B (terceiros). A Maia está desligada no LLM (recusa 67-100% na bancada).
- Já temos no estudo o 2610.02076 (LLM2Jev: *quando* e *como* afinar um LLM para decidir) e o 2609.38143 (meta-skills).

## Papers novos desta busca
| arXiv | O que diz (resumo) | Serve para |
|---|---|---|
| [2601.19055](https://arxiv.org/abs/2601.19055) (NeurIPS 2025) | Afinar LLMs com **edições do usuário** (o texto que a pessoa muda ao revisar). Une preferências, rótulos supervisionados e custo num procedimento simples de *ensembling*; supera aprender de um tipo só | a Maia aprender o **seu** jeito de escrever a partir do que você corrige |
| [2610.00061](https://arxiv.org/abs/2610.00061) | **GAP-DPO**: otimização de preferência personalizada com seleção de pares guiada pela utilidade do usuário; melhora fidelidade de estilo | escolher quais pares (original × editado) valem mais para treinar |

As páginas **não informam** quantos pares são necessários nem o tamanho dos modelos testados. Não afirmamos número.

## O dado que já estamos juntando (e o que estava se perdendo)
| Sinal | Onde fica | Estado |
|---|---|---|
| Aprovou / descartou (com motivo) | `eventos`, cabeça de aprovação | já gravado |
| Respondeu / pediu para sair | cabeça de resposta | já gravado (webhook ou botões) |
| Fechou por R$ X / não fechou | `negocios`, funil | já gravado (04/10) |
| **Original da Maia × texto editado por você** | tabela `edicoes` | **passou a ser gravado em 04/10** (antes o original era sobrescrito e perdido) |

A aprovação sem mexer **não** conta como edição (a linha do SAIR e a limpeza de links são do sistema).

## Caminho (sem pular etapa)
1. **Juntar** (agora): edições, aprovações, respostas, fechamentos. Hoje: 7 rótulos e 0 edições, longe de qualquer treino.
2. **Exportar** o conjunto, anonimizado (sem telefone nem nome de pessoa): item B18.
3. **Treinar fora do PC** (sem GPU Nvidia): GPU gratuita de nuvem, com LoRA num modelo pequeno; volta como GGUF para o Ollama. Limites da nuvem gratuita **não verificados**.
4. **Aceitar só se a bancada aprovar** (`npm run bancada`): recusa da Maia < 30% e Nova sem regressão. Então troca em `modelos.json`.

## Riscos
- Poucos pares → o modelo decora e piora. Por isso o passo 4 é obrigatório.
- Dados de leads indo para a nuvem de treino: anonimizar antes (passo 2).
- Licença do modelo base (o Josiefied não declara; preferir base com licença clara).
