# Roadmap do Prospector

Fontes: `docs/TOCOMAS.md` (papers, só o que foi lido), `lista-243 (1).txt` (os 227 repositórios do GitHub
conferidos pela API em 02/10/2026 — todos existem) e o código atual. Cada item diz de onde veio:
`[P:id]` paper, `[R:n]` número na lista-243, `[C]` código/uso atual.

## Objetivos

1. **Agentes que se coordenam por estrutura, não por conversa** — TOCOMAS + belief state + controlador.
2. **Leads 100% reais e auditáveis** — todo dado com fonte e validade; nada inventado.
3. **WhatsApp sem banimento** — ritmo humano, aprovação, opt-out, aprendizado com respostas.
4. **Escritório 3D que mostra o sistema de verdade** — cada animação corresponde a um evento real.
5. **Operável do celular** — você aprova, acompanha e corrige de qualquer lugar.

## Fases (tarefas → funções → pronto quando)

### F1 — Fundação TOCOMAS (sem modelo novo, sem treino) — **feita em 02/10/2026** (`src/tocomas/`, `test/tocomas.test.mjs`)
| Tarefa | Funções / arquivos | Pronto quando |
|---|---|---|
| Validador de contratos | `src/tocomas/contratos.mjs`: `validar(nome, obj)` lendo `src/tocomas/contratos.schema.json` | testes cobrem válido/inválido de cada contrato |
| Belief state por lead | tabela `crencas`; `src/tocomas/crenca.mjs`: `registrarFato`, `pendencias`, `vencidos`, `detectarPreso` | um lead sem novidade em N ciclos sai da fila com motivo |
| Grafo de tarefas e domínios | `src/tocomas/grafo.mjs`: `NOS`, `DOMINIOS`, `podeHandoff(de, para)` | handoff fora da aresta lança erro em teste |
| Checagem de fidelidade | `src/tocomas/fidelidade.mjs`: `declarar(plano)`, `usar(ferramenta)`, `fechar()` | evento `fidelidade` aparece no Painel |
| Controlador em modo regra | `src/tocomas/controlador.mjs`: `opcoes(estado)`, `valor(op)`, `escolher()` | `criarOrquestrador` passa a perguntar ao controlador o próximo job |

### F2 — Aprender com o Victor (meta-skills) — **feita em 02/10/2026** (`src/tocomas/habilidades.mjs`, `test/habilidades.test.mjs`)
| Tarefa | Funções | Pronto quando |
|---|---|---|
| Motivo do descarte | botão "por quê?" no Painel (opções fixas) → evento | 1 clique, sem texto obrigatório |
| Banco de habilidades | tabela `habilidades`; `propor()`, `ativar()`, `aplicar(lead)` | uma regra aprendida muda a fila e mostra a evidência |
| Revisão semanal | tela na Base do Mestre: aceitar/descartar habilidades propostas | nada entra em vigor sem você aceitar |

### F3 — Mensagens e envio real
| Tarefa | Funções | Pronto quando |
|---|---|---|
| OpenWA instalado e testado | `saudeOpenwa`, webhook | 1 envio real para o seu próprio número |
| Modelo maior | `qwen3:4b` (só quando você mandar baixar) | taxa de recusa de `contradicoes` < 30% |
| Painel de respostas | caixa de entrada por lead | resposta aparece em < 5 s |

### F4 — Sala 3D fiel ao sistema
Verificação visual da área de espera e lounge; cada estado do agente ligado a evento real; Base do Mestre com
dados vivos nos monitores; desempenho em notebook sem GPU dedicada (≥ 45 fps).

### F5 — Celular
Painel responsivo de verdade (aprovar em 1 toque), notificação quando há mensagem para aprovar, Remote Control.

### F6 — Avaliação contínua
Conjunto fixo de leads de teste, métricas de calibração das decisões (`[R:62]` jev-benchmarks), relatório semanal.

---

## 215 melhorias

### A. Agentes e TOCOMAS (30)
1. Validador de contratos JSON Schema sem dependência `[P:2609.37953]`
2. Tabela `crencas` com fatos versionados `[P:2610.01415]`
3. Fato com `valido_ate`: telefone 180 dias, site 30 dias, avaliação 14 dias `[P:2610.01415]`
4. Pendências explícitas por lead (`falta_dado`, `conflito`, `aguardando_humano`) `[P:2610.01415]`
5. Detector de trapping: N ciclos sem fato novo → sai da fila com motivo `[P:2610.01415]`
6. Recuperação por tipo de pendência (refazer auditoria vs pedir ao operador) `[P:2610.01415]`
7. Checagem de consistência: dois fatos conflitantes viram pendência `conflito` `[P:2610.01415]`
8. Grafo de tarefas T1–T8 como dado, não como `if` espalhado `[P:2609.37953]`
9. `podeHandoff`: handoff só por aresta do grafo `[P:2609.37953]`
10. Visibilidade de memória por domínio (Maia nunca lê HTML bruto) `[P:2609.37953]`
11. Escalada para verificador quando confiança < limiar `[P:2609.37953]`
12. Agente novo do Configurador ganha domínio e nós, não "acesso a tudo" `[P:2609.37953]`
13. Auto-evolução: mudança só fica se respeitar o grafo e melhorar a métrica `[P:2609.37953]`
14. Controlador com opções e valor sob orçamento `[P:2609.38147]`
15. Modo regra quando o orçamento é pequeno (o paper alerta para o custo extra) `[P:2609.38147]`
16. Resumo compacto do expediente em vez de histórico completo `[P:2609.38147]`
17. Resultados completos em memória persistente, buscados só quando necessários `[P:2609.38147]`
18. Plano declarado por job (modo + ferramentas) `[P:2609.38108]`
19. Roteador determinístico de modo (predefinido/busca) — nunca escolhido pelo modelo `[P:2609.38108]`
20. Métrica de fidelidade (ferramentas declaradas vs usadas) `[P:2609.38108]`
21. Compactação por regra ao terminar cada nó (o que manter: fatos; o que jogar fora: HTML, tentativas) `[P:2610.02163]`
22. Padrão "aconselhar ou abster" para a Nova revisar a Maia `[P:2609.38142]`
23. Banco de meta-skills aprendido do feedback do operador `[P:2609.38143]`
24. Habilidades com evidência (ids de eventos) e estado `[P:2609.38143]`
25. Banco congelado por semana; revisão manual `[P:2609.38143]`
26. Alva: briefing gerado do belief state, não do log `[C]`
27. Fila com prioridade por valor esperado, não por ordem de chegada `[C]`
28. Cancelamento limpo de varredura (job órfão nunca fica `rodando`) `[C]`
29. Reentrada idempotente: reiniciar o servidor não duplica job `[C]`
30. Linha do tempo por lead (todos os eventos, fatos e decisões) `[C]`

### B. Decisão e aprendizado (25)
31. Divisão do prior de rótulo do AnyJev (hoje não implementada) `[R:221]`
32. Calibração de temperatura das probabilidades `[R:221]`
33. Métricas de calibração (ECE, risco seletivo) `[R:62]`
34. Abster quando a probabilidade máxima < limiar → vai para o Victor `[R:62]`
35. Registrar cada decisão com probabilidades completas (auditoria) `[C]`
36. Comparar 1.7B × 4B no mesmo conjunto fixo antes de trocar `[P:2610.02076]`
37. Fine-tune só se a comparação mostrar ganho (o paper diz: ganho é pontual, não universal) `[P:2610.02076]`
38. Cabeça de resposta com decaimento temporal (dados velhos pesam menos) `[C]`
39. Validação: separar 20% das suas decisões para medir a cabeça `[C]`
40. Mostrar no Painel "por que este lead está no topo" (contribuições) `[C]`
41. Característica nova: distância até você (atendimento presencial) `[C]`
42. Característica nova: hora/dia do envio × taxa de resposta `[C]`
43. Característica nova: número de fotos no Maps `[C]`
44. Detector de deriva: taxa de aprovação caindo → alerta `[C]`
45. Teto de α configurável (hoje 0,3) `[C]`
46. Exportar pesos para CSV (você ver no Excel) `[C]`
47. Reset de cabeça por nicho `[C]`
48. Bandit simples para escolher o ângulo da mensagem (explorar × aproveitar) `[C]`
49. Teste A/B de abertura com significância antes de declarar vencedor `[C]`
50. Previsão de volume de respostas por semana `[R:6]` TimesFM
51. Classificador tabular de lead com modelo de fundação tabular (estudo) `[R:26]` TabFM
52. Extração de entidades de texto de site com NER leve `[R:22]` GLiNER / `[R:29]` GLiNER2
53. Extração estruturada de cardápio/serviços `[R:44]` NuExtract
54. Roteamento de modelo barato vs caro por tarefa (estudo) `[R:39]` jev-router
55. Anti-repetição de mensagem (loops de texto) `[R:40]` antidoom

### C. Coleta e auditoria (25)
56. Fila de cidades com rotação para não repetir área `[C]`
57. Ritmo do Maps adaptativo (desacelera ao sinal de bloqueio) `[C]`
58. Detectar captcha e **parar** (nunca resolver) `[C]`
59. Deduplicação por telefone além de nome+cidade `[C]`
60. Fonte OSM com mais tags (`contact:whatsapp`, `contact:instagram`) `[C]`
61. Auditoria: tempo de carregamento real `[C]`
62. Auditoria: imagem sem `alt`, título vazio, meta description `[C]`
63. Auditoria: botão de WhatsApp presente? `[C]`
64. Auditoria: SSL expirando em < 30 dias `[C]`
65. Auditoria: site fora do ar há X dias (2 checagens) `[C]`
66. Lighthouse local opcional (só se você instalar) `[R:141]` Playwright
67. Screenshot do site para a ficha do lead `[R:141]` Playwright
68. Ler PDF de cardápio com OCR local (estudo) `[R:8]` surya / `[R:3]` MinerU / `[R:4]` docling
69. Converter documentos para Markdown no Configurador `[R:93]` anydoc / `[R:86]` marker
70. Instagram: só sinal público (bio com link?) — sem login `[C]`
71. Corrigir lacuna de DNS rebinding (fixar IP entre checagem e conexão) `[C]`
72. Fonte nova: listas públicas de CNPJ (estudo de licença antes) `[R:240]`
73. Nicho como dado editável no Painel `[C]`
74. Mapa de calor de leads por bairro `[C]`
75. Estimativa de "tamanho do negócio" por nº de avaliações `[C]`
76. Marcar leads que já são clientes seus `[C]`
77. Lista negra (nunca contatar) `[C]`
78. Reauditoria automática de leads antigos (fato vencido) `[P:2610.01415]`
79. Relatório de cobertura por cidade/nicho `[C]`
80. Proteção: nunca auditar IP privado (já existe — adicionar teste de regressão) `[C]`

### D. Mensagens e WhatsApp (25)
81. Instalar e testar OpenWA (com sua aprovação) `[C]`
82. QR code do OpenWA dentro do Painel `[C]`
83. Teto diário escalonado (5 → 10 em 2 semanas, conta nova) `[C]`
84. Pausa automática se 2 pessoas pedirem SAIR no mesmo dia `[C]`
85. Variação de mensagem com bloco de abertura/fecho maior `[C]`
86. Prévia exata da mensagem como aparece no WhatsApp `[C]`
87. Edição da mensagem antes de aprovar, com recheck de contradição `[C]`
88. Follow-up único após 72 h, só com aprovação `[C]`
89. Classificar resposta (interessado/dúvida/não) por `decide()` `[P:2610.02076]`
90. Sugerir resposta para "quanto custa?" a partir do seu catálogo `[C]`
91. Catálogo de serviços e preços seus (fonte única para a Maia) `[C]`
92. Link para portfólio (victor-ai-enginner.vercel.app) com rastreio de clique `[C]`
93. Horário de envio por nicho (barbearia ≠ restaurante) `[C]`
94. Feriados nacionais/municipais no bloqueio de envio `[C]`
95. Registro LGPD: base legal e como o contato pede remoção `[C]`
96. Mensagem de áudio gerada localmente (estudo, só com seu ok) `[R:181]` VoiceStudio
97. Transcrever áudio recebido localmente `[R:188]` OpenWhispr
98. Integração com outros canais (Telegram) — estudo `[R:167]` ChannelsSDK
    - Alternativa oficial ao OpenWA: `david-lev/pywa` (MIT) sobre a WhatsApp Cloud API da Meta — sem risco de banimento,
      mas exige número dedicado, conta Meta Business e modelo aprovado (pago) para a 1ª mensagem a quem nunca falou com você.
99. Caixa de entrada única por lead `[R:123]` pizza-bot (estudo de UX)
100. Proposta em PDF gerada a partir do lead `[C]`
101. Mini-site de demonstração gerado para o lead (mostrar antes de vender) `[C]`
102. Medir tempo até a primeira resposta `[C]`
103. Funil por ângulo de mensagem `[C]`
104. Botão "marcar como fechado" com valor do contrato `[C]`
105. Receita por nicho/cidade no Painel `[C]`

### E. Sala 3D (35)
106. Conferir no navegador a área de espera e o lounge novos `[C]`
107. Sombra só nos objetos grandes (desempenho) `[C]`
108. LOD: modelos simplificados à distância `[C]`
109. Instancing para objetos repetidos (cadeiras, teclados) `[C]`
110. Medidor de fps escondido (tecla F) `[C]`
111. ✅ Qualidade automática: baixa DPR se fps < 38 `[C]`
112. KTX2/Basis nas texturas (menos memória de GPU) `[C]`
113. Agente caminha até a porta para "entregar" mensagem à Base `[C]`
114. Agente da varredura olha o mapa na parede quando o Maps está rodando `[C]`
115. Monitor mostra a URL que o Atlas está auditando `[C]`
116. Monitor da Maia mostra o rascunho sendo escrito `[C]`
117. Painel LED com receita do mês `[C]`
118. ✅ Agente preso (trapping) com indicador visual — Alva mostra quantos saíram da fila; Maia/Atlas mostram quando o controlador segura `[P:2610.01415]`
119. ✅ Linha de handoff desenhada entre mesas quando há envelope `[P:2609.37953]`
120. Controlador (Alva) na mesa central apontando a próxima tarefa `[P:2609.38147]`
121. OfficeBot patrulha com rota por waypoints e para perto de quem está ocioso `[C]`
122. Clique no agente → ficha com belief state do lead atual `[C]`
123. Clique no monitor → zoom da tela `[C]`
124. ✅ Câmera com pontos de vista salvos (mesa, lounge, reunião) `[C]`
125. Modo apresentação: câmera passeia sozinha `[C]`
126. Ciclo dia/noite com luz da janela `[C]`
127. Som ambiente opcional (digitação, café) `[C]`
128. Agentes do Configurador com cor e nome na cadeira `[C]`
129. ✅ Animação de comemoração quando um lead responde `[C]`
130. Reunião real: quando o briefing roda, todos vão à mesa de reunião `[C]`
131. Colisão melhor (agentes não atravessam a mesa de centro) `[C]`
132. Pose sentada ajustada à altura real da cadeira gamer `[C]`
133. Mais animações Mixamo (alongar, beber café) — só de fonte com licença clara `[C]`
134. Teste visual automatizado (screenshot comparado) `[R:141]` Playwright
135. Estudo WebGPU (renderer three.js WebGPU) `[R:217]` vgpu
136. Estudo de mundo gerado/expansível `[R:193]` lingbot-world-v2
137. Estudo de composição espaço-temporal para cena `[R:17]` cordis
138. Créditos 3D com licença por arquivo na própria sala `[C]`
139. Versão sem modelos NC para mostrar a clientes `[C]`
140. Página de "tour" gravável para portfólio (sem NC) `[R:183]` Recordly

### F. Base do Mestre (15)
141. Monitores da base com dados reais (fila, respostas, receita) `[C]`
142. Lista de aprovações direto na Base `[C]`
143. Revisão das habilidades propostas `[P:2609.38143]`
144. Relatório semanal gerado `[C]`
145. Metas do mês (contatos, respostas, fechamentos) `[C]`
146. Linha do tempo do que os agentes fizeram hoje `[C]`
147. Controle "pausar tudo" num botão `[C]`
148. Ajuste do teto diário de envios `[C]`
149. Saúde dos serviços (Ollama, OpenWA, Maps) `[C]`
150. Câmera orbitando a base com hotspots clicáveis `[C]`
151. Diorama com iluminação própria (não a do escritório) `[C]`
152. Caminho visual Base ↔ Escritório (porta) `[C]`
153. Notas pessoais do mestre (persistentes) `[C]`
154. Painel de decisões que os agentes escalaram para você `[P:2609.37953]`
155. Modo celular da Base (sem 3D, só fila) `[C]`

### G. Painel, UI e Configurador (20)
156. Painel responsivo de verdade em 390 px `[C]`
157. Aprovar/descartar com gesto (deslizar) no celular `[C]`
158. Atalhos de teclado no desktop (A aprovar, D descartar) `[C]`
159. Estados vazios com próxima ação clara `[R:230]` impeccable
160. Revisão de contraste e foco em todas as telas `[R:230]` impeccable
161. Auditoria de "cara de IA genérica" `[R:229]` taste-skill
162. Tokens do design system documentados em página `[R:232]` astryx (estudo)
163. Gráficos do funil leves (canvas próprio) `[R:163]` xy (estudo de API)
164. Configurador: extrair texto de PDF/imagem anexados `[R:7]` Unlimited-OCR / `[R:13]` chandra
165. Configurador: testar o agente num lead de exemplo antes de ativar `[C]`
166. Configurador: escolher domínio TOCOMAS do agente `[P:2609.37953]`
167. Configurador: versão do prompt com diff `[C]`
168. Protocolo AG-UI para eventos de agente na interface (estudo) `[R:152]` ag-ui
169. Busca global (lead, evento, agente) `[C]`
170. Exportar leads CSV `[C]`
171. Tema claro `[C]`
172. Página de ajuda curta por tela `[C]`
173. Notificação do navegador quando há aprovação `[C]`
174. PWA instalável no celular `[C]`
175. Página de status para o Remote Control (o que está rodando) `[C]`

### H. Segurança (15)
176. Delimitar texto externo com id aleatório nos prompts `[C]`
177. Teste de injeção: site com "ignore as instruções" não muda a decisão `[C]`
178. Alerta Pain Axis: nenhum prompt com ameaça/pressão `[P:2609.16247]`
179. Guarda de segredos nos commits `[R:72]` jev-secret-guard (estudo)
180. Token de acesso local se um dia expuser fora de 127.0.0.1 `[C]`
181. CSP nas páginas `[C]`
182. Limite de tamanho em todos os corpos JSON (revisar rotas) `[C]`
183. Logs sem telefone completo `[C]`
184. Backup diário do SQLite `[C]`
185. Rotação de logs `[C]`
186. Checar licença de cada novo GLB antes de usar `[C]`
187. Sandbox para código gerado (estudo) `[R:211]` E2B / `[R:207]` Daytona
188. Guardrails que corrigem em vez de bloquear (estudo) `[R:46]` pi-warden
189. Proxy de agentes/MCP (estudo, só se houver MCP) `[R:159]` agentgateway
190. Revisar `PEDIU_PARA_SAIR` com casos reais `[C]`

### I. Testes e avaliação (15)
191. Testes dos contratos TOCOMAS `[C]`
192. Teste de trapping (lead preso sai da fila) `[P:2610.01415]`
193. Teste de fidelidade (ferramenta não declarada gera desvio) `[P:2609.38108]`
194. Conjunto fixo de 50 leads reais anonimizados para regressão `[C]`
195. Avaliação de mensagens: contradição, tamanho, ângulo `[C]`
196. Harness de avaliação de agentes (estudo) `[R:158]` harbor
197. Evals no estilo Supabase (estudo de formato) `[R:47]` evals
198. Benchmark de agentes web para o coletor (estudo) `[R:218]` webarena
199. Teste de carga do SSE `[C]`
200. Teste E2E do Painel com Playwright `[R:141]`
201. Teste da política de envio com relógio simulado (cobrir feriados) `[C]`
202. Medir latência de `decide()` por rotação `[C]`
203. Simulação de clientes para testar respostas (persona) `[R:115]` MatrAIx-Persona-8B (estudo)
204. Relatório de calibração semanal `[R:62]`
205. CI local (hook antes do commit roda `npm test`) `[C]`

### J. Operação e celular (10)
206. `npm run backup` e `npm run restaurar` `[C]`
207. Iniciar com o Windows (só se você pedir) `[C]`
208. Página de saúde `/api/saude` completa `[C]`
209. Aviso no Painel quando o PC vai suspender `[C]`
210. Remote Control documentado no README `[C]`
211. Script para subir ao GitHub privado quando decidir `[C]`
212. Separar modelos NC em pasta própria fora do git, se um dia subir `[C]`
213. Versão do app no rodapé `[C]`
214. Changelog gerado dos commits `[C]`
215. Memória de agente local em Markdown (estudo de formato) `[R:11]` EverOS

---

## Estudo da lista-243

### Verificação
- 227 links do GitHub: **todos existem** (API do GitHub, 02/10/2026). 16 itens são sites/Hugging Face, não conferidos.
- Mudaram de dono (o link redireciona): mcpb → modelcontextprotocol, OpenHands → OpenHands/OpenHands,
  LibreChat → LibreChat-AI, opencode → anomalyco, goose → aaif-goose, harbor → harbor-framework,
  KAI-Scheduler → kai-scheduler, horizon-post-train → ifm-ai/RL360, swarmllm → Nehanth/pooled.
- Duplicados: `[80]` Pi e `[139]` Pi Mono são o mesmo repositório; `[111]` e `[216]` também.
- Arquivado: `[37]` Hermes-Bot-Mode.

### O que estudar primeiro (mais útil ao Prospector)
| # | Repositório | Por quê |
|---|---|---|
| 221 | AnyJev | completar o que falta do nosso `decide()` (prior de rótulo, calibração) |
| 62 | jev-benchmarks | medir calibração das decisões |
| 206 | browser-use | comparar com o coletor Playwright atual |
| 141 | Playwright | testes E2E e visuais |
| 22 / 29 | GLiNER / GLiNER2 | extrair dados de sites sem LLM grande |
| 44 | nuextract | extração estruturada |
| 11 | EverOS | formato de memória local em Markdown |
| 91 | TencentDB-Agent-Memory | ideias de memória de equipe |
| 162 | shepherd | execução reversível tipo git para agentes |
| 18 | Atlas (pacifio) | controle de versão de mudanças de agentes |
| 152 | ag-ui | protocolo agente ↔ interface |
| 228–231 | UI UX Pro Max, Taste, Impeccable, Huashu | qualidade de interface |
| 181 / 188 | VoiceStudio / OpenWhispr | áudio local (enviar e transcrever) |
| 6 / 26 | TimesFM / TabFM | previsão e classificação tabular |
| 40 | antidoom | evitar repetição nas mensagens |
| 158 / 47 | harbor / evals | avaliação de agentes |
| 205 | agency-agents | perfis de agentes prontos para o Configurador |
| 195 | AutoSocial | automação de redes (já citado antes) |
| 199 | SEO Monster | auditoria de SEO para a oferta ao cliente |

### Úteis como referência, sem integração prevista
Agentes e harnesses (73–83, 90, 94, 96, 99, 100, 107, 113, 135–140, 144, 147, 148, 150, 151, 153, 157):
padrões de loop, ferramentas e permissões. Inferência local (79, 88, 116, 143, 149, 155, 5): só se um dia
houver GPU. Documentos/OCR (3, 4, 7, 8, 13, 86, 93, 97): Configurador e cardápios.

### Fora do escopo do Prospector
Genômica/biologia (27, 30, 56), EEG (41), carros autônomos e robótica (33, 36, 45, 210, 226), treino e kernels de
MoE/GPU (15, 38, 51, 54, 55, 67, 156, 165, 170, 172, 177), satélites e infraestrutura de cluster (176, 219, 223),
modelos/tokenizers em hebraico e Jamba (58, 61, 68–70), vídeo generativo (182, 186, 187, 192, 194, 200, 201, 203), áudio benchmark
(42, 175, 202), finanças (98), Wi-Fi sensing (142), saúde (171), tokenizers (14, 21, 184).
Freelance (233–239): canal de vendas para você, não código.
