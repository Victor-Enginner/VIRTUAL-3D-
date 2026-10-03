# Movimento e cognição dos agentes na Sala 3D (busca de 04/10/2026)

**Problema relatado:** os bonecos "correm", um entra no outro ao ir conversar ou tomar café, e a
conversa não parece conversa. Busquei no arXiv (10 consultas, 115 resultados) como jogos e
simulação de multidões resolvem isso.

## O que estava errado no código (diagnóstico antes da pesquisa)
| Sintoma | Causa no código |
|---|---|
| "Correndo" | 1,25 m/s × ritmo (até 1,5 m/s), sem aceleração nem frenagem; animação de andar fora do ritmo (pé deslizando) |
| Um em cima do outro | reserva de lugar comparava o **objeto** do ponto; a conversa trocava o objeto ao girar → o lugar parecia livre. Áreas com menos lugares que agentes repetiam o ponto |
| Atravessar o colega | só havia desvio de móvel (A\*); nenhum desvio entre pessoas |
| Conversa estranha | "quem está a menos de 2,2 m se vira para o outro", em qualquer lugar |

## Papers usados
| arXiv | Lido | O que tiramos |
|---|---|---|
| [1802.02673](https://arxiv.org/abs/1802.02673) Position-Based Multi-Agent Dynamics (Weiss et al.) | método completo (§3–4.6) | laço PBD: velocidade misturada → posição prevista → **desvio antecipado só tangencial** (§4.5) → **contato** ‖xi−xj‖ ≥ ri+rj (§4.2) → paredes → **limite de velocidade e aceleração** (§4.6). Feito para jogos |
| [cond-mat/9805244](https://arxiv.org/abs/cond-mat/9805244) Social Force Model (Helbing & Molnár) | resumo + parâmetros conhecidos do modelo | aceleração rumo à velocidade desejada com tempo de relaxamento τ ≈ 0,5 s; distância pessoal |
| [1907.10384](https://arxiv.org/abs/1907.10384) Conversation floors within F-formations | resumo | conversa = **F-formation** (círculo em volta de um espaço comum); **turno de fala ≈ 2 s** |
| [1602.03623](https://arxiv.org/abs/1602.03623) Dynamic Group Behaviors for Interactive Crowd Simulation | resumo | grupos coerentes com desvio recíproco; menor esforço |
| [2304.03442](https://arxiv.org/abs/2304.03442) Generative Agents (Park et al.) | resumo | observação → plano → reflexão; agentes "se notam e puxam conversa" — direção futura (rotina do dia por agente) |
| [2005.05842](https://arxiv.org/abs/2005.05842) Survey of Behavior Trees | resumo | BTs substituem máquinas de estado que não escalam — direção futura para o comportamento |
| [2505.20011](https://arxiv.org/abs/2505.20011) Challenges of Human-Like Agents in Games | resumo | 13 desafios de agentes críveis (consistência, variação, tempo) |
| [1908.10107](https://arxiv.org/abs/1908.10107) Fast ORCA on GPU | resumo | ORCA é o padrão em CPU; para 6 agentes não precisamos de GPU |

## O que foi implementado
| Peça | Arquivo | Fonte |
|---|---|---|
| Multidão por posição: mistura de velocidade (τ = 0,5 s), desvio antecipado tangencial, contato, paredes, 1,05 m/s e 1,4 m/s² | `public/sala/multidao.js` | 1802.02673, cond-mat/9805244 |
| Chegada "arrive" (frenagem √(2·a·d)) + ajuste fino no ponto: passava 15 cm do alvo, agora < 2 cm | `multidao.js` | prática de jogos (steering) |
| Destravamento: sem avançar 10 cm em 1,5 s → recalcula A\* com quem está parado como obstáculo; quem está parado cede passagem | `multidao.js` | prática de jogos |
| Reserva de lugar com id estável; área cheia nunca empilha | `public/sala/vagas.js` | — (correção de bug) |
| Rodas de conversa (F-formation, raio 0,8 m, todos virados para o centro), turno de fala de 2,2 s | `vagas.js` + `sala.js` | 1907.10384 |
| Escolha da pausa por utilidade (gosto + gente lá + não repetir + vaga) | `public/sala/comportamento.js` | IA de utilidade de jogos |
| Passo da animação = velocidade real | `public/sala/personagens.js` | — |

**Medido na sala real (grade com os móveis), 5 agentes saindo juntos:** 0 sobreposições
(menor distância 0,54 m = dois corpos), velocidade máxima 1,05 m/s, todos chegam a < 5 cm do
lugar, rodas de conversa formadas; 5 para a copa ao mesmo tempo: 25 s (antes 37 s, com travamento).

## Feito em 04/10/2026 (segunda rodada)
| Peça | Arquivo | Fonte |
|---|---|---|
| **Rotina do dia** (camada de plano dos Generative Agents): café, reunião da Alva às 9h, almoço, café da tarde; muda por dia, estável no dia; trabalho real passa na frente | `public/sala/rotina.js` + `comportamento.js` | 2304.03442 |
| **Reunião diária**: 4 cadeiras da mesa de reunião (quem sobra fica em pé em volta), Alva conduz na TV | `cena.js`, `vagas.js` | — |
| **Olhar**: na roda, olham para quem fala; na reunião, para a Alva. Mede o rosto real depois da animação e gira só a diferença, no eixo vertical do mundo convertido para o osso (P⁻¹·R·P), limite ~55°. Trata pose que reescreve a cabeça (em pé) e pose que não reescreve (sentado) | `sala.js` (`olhar`) | prática de jogos (look-at) |
| **Agenda de hoje** na ficha de cada agente | `sala.js`, `sala.css` | — |

Medido: na reunião os 4 olham para a Alva com erro de 0° (ou no limite do pescoço); o teste pegou um
café da manhã que invadia a reunião em certos dias (corrigido: o café sempre termina antes das 9h).

## Próximos passos sugeridos
- **Behavior Tree** no lugar da máquina de estados quando os comportamentos crescerem (survey 2005.05842).
- **Memória e reflexão** (Generative Agents): o agente lembrar com quem conversou e preferir/evitar a roda.
