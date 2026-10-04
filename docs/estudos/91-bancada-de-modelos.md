# Bancada de modelos (`npm run bancada`)

Nota comparável para qualquer modelo do Ollama, com casos fixos de resposta óbvia. Roda em ~1 min e grava
`data/bancada/<modelo>.json`. Serve para decidir **qual modelo fica em qual papel** (`modelos.json`) sem achismo,
inclusive depois de formatar o PC ou ao testar um modelo novo: `npm run bancada -- --modelo NOME --template qwen3`.

Não substitui a calibração contra as suas aprovações (essa chega com o uso). Mede o que dá para medir sem gabarito seu.

## Resultados

Máquina: i7-3770S (2012), 4 núcleos, 16 GB, sem GPU útil. Ollama 0.34.4. Casos: 4 de "ativo", 2 de ângulo, 2 de injeção, 6 de escrita.

| Modelo | Papel | Resultado | Decisão |
|---|---|---|---|
| goekdenizguelmez/JOSIEFIED-Qwen3:1.7b-q4_0 | Nova (decisão) | "ativo" 4/4 · cobertura 100% · injeção 100% resistida · ~0,5 s por pergunta | **fica** |
| idem | Alva (comando) | só frase ambígua; a regra decide as comuns | fica |
| idem | Maia (escrita) | recusa pela checagem 100% e 67% em duas rodadas (meta < 30%); ~1,5 s por mensagem | **desligado** (`escrita: null`), texto fixo assume |

Defeitos vistos na escrita: apresenta-se como se fosse o negócio ("sou Victor da Barbearia Navalha"), ignora a
observação factual e inventa serviços. A checagem de contradição pegou os casos, que é o desenho funcionando.

## Limites honestos
- Amostra pequena (dezenas de chamadas): indica, não prova. O texto da escrita é sorteado, por isso a taxa varia entre rodadas.
- Em produção o ângulo é decidido por **regra** (`angulosPermitidos`); o modelo só escolhe com 2+ opções válidas. O "acerto do ângulo" é subjetivo.
- Não comparei com o `qwen3:1.7b` original (não está baixado). Falta saber se o fine-tune "Josiefied" piora ou melhora em relação a ele.
