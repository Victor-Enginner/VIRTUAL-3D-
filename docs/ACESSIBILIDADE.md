# Conforto sensorial e acessibilidade

O Prospector mostra muita coisa ao mesmo tempo (Sala 3D, TV, agentes andando, painéis). Para quem tem TDAH, ansiedade,
sensibilidade a som e movimento, ou qualquer transtorno que torne isso cansativo, a regra é: **o sistema nunca disputa
a atenção da pessoa**. Vale para quem usa e para quem programa (inclusive agentes de código como o Claude).

## Regras (cada uma tem teste em `test/conforto.test.mjs` e `test/mascotes.test.mjs`)
1. **Os agentes não falam.** Eles só trabalham e mostram o que fazem em texto. Nada no front usa voz sintetizada
   (decisão do Victor em 04/10/2026; o teste barra `speechSynthesis` em qualquer arquivo).
2. **Você pode falar com eles:** o comando de voz do Painel usa só o microfone (reconhecimento do navegador) e a intenção
   é decidida por regra primeiro (`src/comando.mjs`). A resposta volta escrita.
3. **Nada toca sozinho.** Sem `autoplay`, a TV nasce sem som, o som da Sala nasce desligado e só existe atrás do botão.
4. **Modo calmo** (página "Conforto"): sem transições, sem animação decorativa, sem fundo neural animado, sem confete,
   agentes sem multidão andando, sem som da sala, sem mascotes. "Reduzir movimento" do sistema operacional já vale sozinho.
5. **Mascotes são opcionais e começam desligados** (`public/ui/mascotes.js`): criaturas pequenas (64 px) nas bordas, mais
   ausentes que presentes (2 a 6 min fora, 10 a 24 s na tela), sem som, sem bloquear clique, fora da Sala 3D.
   Quem tem "reduzir movimento" no sistema só os vê se marcar a opção explícita.
6. Preferências ficam só no navegador (`localStorage`); sem ele, tudo funciona com o padrão silencioso e parado.

## Ao criar algo novo
- Pergunte antes: isso se mexe, pisca ou toca sozinho? Se sim, precisa de um botão para ligar e de um jeito de desligar.
- Animação nova entra por trás de `movimentoReduzido()` (JS) ou do bloco `[data-calmo="1"]` / `prefers-reduced-motion` (CSS).
- Nada pisca mais de 3 vezes por segundo (WCAG 2.3.1). Não medimos isso ainda: item aberto.
- Cor nunca é o único sinal (sempre texto junto). Contraste mínimo 4,5:1.

## Limites honestos
- Não houve teste com pessoas reais usando leitor de tela ou com TDAH; estas regras são cuidado de projeto, não certificação.
