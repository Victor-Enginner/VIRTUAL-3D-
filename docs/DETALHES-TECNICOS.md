# Detalhes técnicos do Prospector

> README completo de apresentação: [`../README.md`](../README.md). Este arquivo guarda os detalhes técnicos (instalação portátil, lotes, agentes, decisão, Sala 3D, modelos 3D).

# Prospector — agentes de prospecção com modelos abertos

Agentes locais que acham empresas sem site (ou com site fraco), medem os fatos, decidem com
probabilidades no estilo Jev, escrevem a primeira mensagem e enviam no WhatsApp num ritmo seguro —
com um escritório 3D onde a equipe aparece trabalhando de verdade.

Zero dependência npm: Node 22.5+ (`node:sqlite`, `node:http`). Python + Playwright só para a fonte Google Maps.

## Instalar em outro computador (pendrive, Drive, VPS)

```bash
npm run empacotar                 # gera data/pacotes/prospector-AAAA-MM-DD.zip (só código e assets, nunca .env/banco/chaves)
npm run empacotar -- --com-banco  # inclui o banco criptografado (AES-256-GCM, senha na hora)
```
No computador novo: descompactar e dar duplo clique em `instalacao.bat` (confere Node, Python/Playwright, Ollama,
modelos e disco; cria o `.env`; pergunta antes de instalar qualquer coisa; sobe o servidor e abre a Sala 3D).
Só conferir: `instalacao.bat /checar` ou `npm run instalar -- --checar`. Banco com versão: `src/migracoes.mjs`
(backup automático em `data/backups/` antes de migrar um banco com dados).
Depois disso, o servidor guarda uma cópia por dia (`data/backups/diario-AAAA-MM-DD.db`, as 7 últimas; `src/backup.mjs`).
`GET /api/saude` diz se o processo e o banco estão de pé (versão do banco, nº de leads, último backup).
Todas as respostas levam CSP, `nosniff` e `Referrer-Policy` (CSP em `src/server.mjs`; se uma página nova precisar de outra origem, ajuste lá).

## Rodar

```bash
cp .env.example .env      # tudo é opcional
npm start                 # http://127.0.0.1:4300
npm test                  # 212 testes (node:test), inclusive o de integração HTTP (test/http.test.mjs)
npm run verificar         # testes + sintaxe + páginas + servidor de verdade; tem que passar antes de commit
npm run exportar-treino  # data/treino/*.jsonl anonimizado (edições, aprovações, respostas, fechamentos)
npm run estado -- "nota"  # salva um estado de produção (tag + cópia do banco)
```

| Página | O que é |
|---|---|
| `/` | Painel: leads, aprovação de mensagens, fila de envio, comando por voz/texto |
| `/sala.html` | Sala 3D: o mesmo estado, desenhado como escritório vivo |
| `/configurador.html` | Configurador de Agentes: cria agentes por conversa guiada |

O servidor só escuta em `127.0.0.1`. Quem usa o próprio PC entra direto; acesso pelo celular é por túnel
(`cloudflared tunnel --url http://127.0.0.1:4300`) e exige a senha `ACESSO_SENHA` do `.env` (`src/acesso.mjs`:
sessão assinada por 7 dias, 5 tentativas erradas por IP a cada 10 min). Sem `ACESSO_SENHA`, o acesso remoto fica desligado. O Ollama é opcional: sem ele, a decisão e a
escrita das mensagens ficam indisponíveis e o painel mostra isso; o resto funciona.

## Prospecção ampla (`src/nichos.mjs`, `src/localidades.mjs`)
- **24 nichos em 4 grupos** (decisão cara, vende mostrando, agendamento e cardápio, urgência), cada um com 4 a 6 termos de busca. O Atlas roda até 3 termos por varredura no Maps (o limite de leads se divide e os repetidos caem) e todas as tags no OpenStreetMap.
- **IBGE:** 27 estados e 5.571 municípios em `src/dados/localidades.json`. Toda varredura valida a cidade: corrige erro de digitação ou de voz ("Ribeirão Preot" → "Ribeirão Preto"), acha o estado quando só há uma cidade com aquele nome e pede o estado quando há várias ("Bom Jesus").
- API: `GET /api/catalogo`, `GET /api/localidades/cidades?uf=SP`, `GET /api/localidades/resolver?cidade=…`, `POST /api/varreduras/lote` (um grupo inteiro, até 8 nichos).
- Fonte dos nichos e das tags: o Repass AI (`backend/osm_engine.py`, `src/views/LeadsView.jsx`), só lido, nunca alterado.

## Como a prospecção é controlada (lotes)
- **A equipe sempre sobe em espera.** Só sai da espera quando você pede uma busca (formulário, comando de voz ou "Buscar mais"), ou clica em Retomar. Nada de varrer sozinho: o Atlas não refaz buscas por conta própria.
- **Lote de 50:** cada busca (ramo × cidade × fonte) traz 50 empresas por vez, que passam pelo fluxo dos agentes. O **próximo lote só abre depois que todos os leads do lote anterior foram tratados** (aprovou e enviou à mão, ou descartou). O motivo do bloqueio aparece na tela.
- **Nada se perde:** a tabela `lotes` guarda cada busca (cidade, ramo, fonte, lote, quantas vieram, quantas eram repetidas). O Painel mostra o mapa de cobertura; `GET /api/cobertura` entrega os mesmos dados. Comando de voz: "busca mais 50" / "próximo lote".
- Quando a fonte não tem mais resultados para a busca, o sistema avisa e sugere outro ramo, cidade ou fonte, em vez de insistir.

## Interface

As três telas são um app só: a mesma barra lateral (`public/ui/shell.js`) mostra navegação e a equipe
com status ao vivo. Design system em `public/ui/tokens.css` (primitivo → semântico → componente, como em
`AGENTES WEB SITE SKILL COMPLEX/example/styles/tokens.css`) e `public/ui/base.css`.

Regras aplicadas, das skills que você indicou:
- **impeccable craft-floor**: sem eyebrow/rótulo em caixa alta, sem texto em gradiente, sem brilho decorativo,
  contraste ≥ 4.5:1, raio 12–16 px em blocos, borda *ou* sombra, estados de hover/ativo/desabilitado/carregando/
  vazio/erro, foco visível, seleção/cursor/rolagem temados, números tabulares, curva de saída exponencial.
- **taste-skill redesign-existing-projects**: fonte com personalidade (Geist / Geist Mono), um acento só
  (violeta sólido), uma família de cinza, nada de 6 cartões iguais (o funil virou uma faixa com conversão),
  seções separadas por espaço em vez de cartão com borda e sombra, `100dvh`, link "pular para o conteúdo".
- **seus .md de sites 3D**: conteúdo no DOM e WebGL como camada (padrão híbrido), 3D com função (o painel LED
  mostra o funil real), DPR ≤ 1,5, estado de carregamento, fallback sem WebGL, movimento reduzido.

## Os agentes (AGENT_FOUNDRY_GEN01)

| Agente | Papel real no pipeline |
|---|---|
| Alva | abre o expediente, reabre varreduras ativas (a cada 24 h), faz o briefing |
| Atlas | varre o Maps/OSM e audita o site (HTTPS, viewport, ano no rodapé, tecnologias) com proteção SSRF |
| Nova | decide: nível de oportunidade (regra), se está ativo e o ângulo (modelo, dentro do espaço de ações válido) |
| Maia | escreve a mensagem a partir de uma observação factual; texto do modelo passa por checagem de contradição |
| Leo | envia via OpenWA: teto diário, espera aleatória, horário comercial, aprovação, opt-out "SAIR" |

Coordenação por fila (`jobs` no SQLite): cada agente pega só jobs do seu tipo.

## Modelo por papel (`modelos.json`)

`comando` (Alva, voz/texto do Painel), `decisao` (Nova) e `escrita` (Maia) têm cada um o seu modelo no Ollama.
`"modelo": null` **desliga** o LLM daquele papel e a regra assume (Nova: primeiro ângulo válido; Maia: texto fixo;
Alva: o comando por voz/texto continua, porque a intenção é decidida por regra primeiro). `.env` (`DECIDE_MODEL`, `WRITE_MODEL`, `COMANDO_MODEL`) tem prioridade. O arquivo viaja
no zip do `npm run empacotar`, então a escolha sobrevive à formatação. Templates de conversa: qwen3, chatml (testados),
llama3, gemma (formato oficial, ainda não testados aqui).

## Decisão estilo Jev com modelo aberto (`src/decide/`)

Mesma interface do Jev (`choice` / `score` / `noul`, respostas como probabilidades):
- **Leitura de probabilidades do próximo token** sobre `[1]..[n]` — método do LLM2Jev (arXiv 2610.02076).
- **Rotação cíclica das opções** para cancelar viés de posição — ideia do nível L0 do AnyJev (arXiv 2610.00831).
  A divisão do prior de rótulo e a calibração de temperatura do AnyJev **não** estão implementadas.
- **Fato é regra, julgamento é modelo** (arXiv 2610.01834). No teste ao vivo de 02/10/2026 o Qwen3-1.7B
  respondeu "nada a melhorar" com 100% para negócios só com Instagram (viés ordinal, arXiv 2609.38827) —
  por isso o nível de oportunidade é regra, e o modelo só escolhe entre ângulos verdadeiros (JevSpawn, arXiv 2610.00437).
- `DECIDE_BACKEND=jev` usa o Jev real (pago, não aberto) pelo endpoint do OpenRouter usado no Jev Showcase.

## Aprendizado contínuo (`src/aprendizado.mjs`)

Regressão logística online (SGD + L2) sobre um vetor de características do lead, duas cabeças:
**aprovação** (seus "Aprovar"/"Descartar") e **resposta** (resposta = 1, SAIR = 0 com peso 1,5, 72 h de silêncio = 0).
A prioridade mistura regra e aprendizado; o peso do aprendizado cresce com os exemplos até 30%. Os pesos aparecem
na ficha da Nova na Sala 3D.

## Sala 3D (`public/sala*`)

- Móveis: **Kenney Furniture Kit 2.0**, CC0 (`public/assets/kenney/License.txt`), 52 modelos GLB, escala ×2.
- Personagens: **Xbot** (rig Mixamo) carregado do repositório oficial do three.js (`examples/models/gltf`, tag r170).
  Animações originais: idle, walk, agree, headShake. **Sentado digitando** e **sentado relaxado** são geradas no
  código (`sala/personagens.js`): direção-alvo por osso, resolvida a partir da pose de repouso.
- Navegação: grade de ocupação construída dos móveis + A* com suavização por visada (`sala/caminhos.js`).
- Comportamento (`sala/comportamento.js`): trabalhando → na mesa → pausa (copa/janela/biblioteca/lounge, por
  personalidade) → conversando (dois em pausa a < 2,2 m) → apresentando (briefing) → desligado (pausado, no sofá).
  A pausa começa após 45 s sem tarefa na demonstração (a especificação fala em 15 min; é uma constante).
- Monitores mostram a tarefa real e os últimos eventos de cada agente; luminária acesa conforme o estado.
- Dia/noite pelo relógio da máquina; som de digitação/envelopes gerado no navegador (desligado por padrão).
- Agentes criados no Configurador ganham mesa na segunda fileira (4 vagas).

## Modelos 3D do Victor (`public/assets/modelos/`)

Os GLBs escolhidos (pasta `AGENTES WEB SITE SKILL COMPLEX`) foram otimizados com glTF-Transform 4.5.1 —
os originais não foram alterados:

```bash
npx @gltf-transform/cli@4.5.1 optimize ENTRADA.glb SAIDA.glb --texture-compress webp --texture-size 1024 --compress meshopt --simplify false
# modelos com material spec-gloss antigo: rodar `metalrough` antes; "Base do Mestre": --simplify true --simplify-ratio 0.25
```

607 MB → ~15 MB. A escala real de cada modelo está em `public/sala/modelos.js` (`MEDIDAS`): cada arquivo vem
numa unidade (cm, mm, "unidades") e é normalizado por uma medida conhecida (cadeira 1,30 m, mesa 0,75 m…).
Licenças lidas dos próprios arquivos em `public/assets/creditos.json`, página `/creditos.html`.
**NC (não comercial):** monitor IIyama, iPhone, OfficeBot e props anos 60 — estão por decisão do operador só
para uso pessoal; não usar a Sala 3D com eles para vender. `/visualizar.html?m=slug` mostra qualquer modelo com
medidas reais.

Detalhes de montagem que valem para modelos novos:
- modelo com esqueleto (o monitor): medir com `Box3.setFromObject(obj, true)` e girar pelo grupo de fora;
- a tela do agente é um plano próprio sobre a malha `screen` (orientação garantida, independe do UV);
- caixas de som que vêm em par: duas cópias, cada uma recortada ao meio (`metade()`), uma de cada lado do monitor.

## Configurador de Agentes

Entrevista determinística (não depende de modelo): nome → papel → modos → identidade → regras → ferramentas →
aprendizado → revisão → ativar. Gera a ficha e o prompt de sistema no formato do AGENT_FOUNDRY. Anexos: PNG, JPG,
WEBP, PDF, TXT, MD até 2 MB, tipo conferido pela assinatura do arquivo; texto de TXT/MD entra na base de
conhecimento (texto de imagem/PDF ainda não é extraído). Conversar com um agente já ativo exige o Ollama.

## Limites conhecidos

- Raspar o Google Maps viola os termos do Google; o coletor é lento de propósito e devolve `null` quando a
  página não mostra um dado (nunca inventa). O Google passou a ocultar a contagem de avaliações neste IP.
- O formato do evento `message.received` do OpenWA não está no README dele: o webhook lê de forma defensiva.
- DNS rebinding entre a checagem SSRF e a conexão (mesma lacuna do `buscador_de_pagina.py` do Repass).
- O modelo local de 1.7B escreve mal: a checagem recusa e entra o texto fixo (3 variações). Um modelo maior
  (ex.: `qwen3:4b`) deve melhorar; não foi testado aqui.
