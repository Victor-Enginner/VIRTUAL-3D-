# Conforto sensorial e acessibilidade

O Prospector mostra muita coisa ao mesmo tempo (Sala 3D, TV, agentes andando, painéis). Para quem tem TDAH, ansiedade,
sensibilidade a som e movimento, ou qualquer transtorno que torne isso cansativo, a regra é: **o sistema nunca disputa
a atenção da pessoa**. Vale para quem usa e para quem programa (inclusive agentes de código como o Claude).

## Regras (cada uma tem teste em `test/conforto.test.mjs`)
1. **Nada toca sozinho.** Sem `autoplay`, a TV nasce sem som, o som da Sala nasce desligado.
2. **Quem fala é um só lugar:** `public/ui/audio.js`. Nenhum outro arquivo usa `speechSynthesis`.
3. **A voz só sai por pedido:** clique em "Ouvir" ou resposta a um comando que a pessoa falou, e esta só se ela ligar
   "ler as respostas" (desligado por padrão). Todo `falar()` declara `origem: 'clique'` ou `'resposta'`; o teste barra o resto.
4. **Um canal por vez:** ao falar, a TV e o som da sala pausam e voltam depois. Falar de novo interrompe a fala anterior (sem fila).
5. **O texto sempre aparece** (legenda com botão Parar). Esc para. Trocar de aba para. Falas de até ~300 caracteres.
6. **Modo calmo** (página "Voz e conforto"): sem transições, sem animação decorativa, sem fundo neural animado, sem confete,
   agentes sem multidão andando, sem som da sala, sem voz automática. "Reduzir movimento" do sistema operacional já vale sozinho.
7. **A fala vem de regra com dado real** (briefing, confirmação de comando). Modelo nunca improvisa o que a voz diz.
8. Preferências ficam só no navegador (`localStorage`); sem ele, tudo funciona com o padrão silencioso.

## Ao criar algo novo
- Pergunte antes: isso se mexe, pisca, toca ou fala sozinho? Se sim, precisa de um botão para ligar e de um jeito de desligar.
- Animação nova entra por trás de `movimentoReduzido()` (JS) ou do bloco `[data-calmo="1"]` / `prefers-reduced-motion` (CSS).
- Nada pisca mais de 3 vezes por segundo (WCAG 2.3.1). Não medimos isso ainda: item aberto.
- Cor nunca é o único sinal (sempre texto junto). Contraste mínimo 4,5:1.

## Limites honestos
- Não houve teste com pessoas reais usando leitor de tela ou com TDAH; estas regras são cuidado de projeto, não certificação.
- A qualidade da voz depende das vozes instaladas no navegador (as "Natural" aparecem no Edge). Piper/Kokoro locais ficam como evolução.
