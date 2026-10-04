// Mascotes: a parte de DECISÃO (quando aparecem, quem, onde, por quanto tempo), sem tocar na tela.
// Pura de propósito: os testes provam que eles ficam mais ausentes do que presentes e que nunca aparecem quando
// alguém pediu calma. Regras de conforto em docs/ACESSIBILIDADE.md.
export const AGENTES = ['alva', 'atlas', 'nova', 'maia', 'leo'];
export const BORDAS = ['esq-baixo', 'dir-baixo', 'esq-meio', 'dir-meio'];

export const CFG = {
  ausenciaMinMs: 120_000,   // somem por 2 a 6 minutos entre uma visita e outra
  ausenciaMaxMs: 360_000,
  visitaMinMs: 10_000,      // e ficam 10 a 24 segundos
  visitaMaxMs: 24_000,
  chanceDeDupla: 0.2,       // 1 em 5 visitas vem em dupla (e aí eles brincam)
};

const entre = (rng, a, b) => a + rng() * (b - a);

export const proximaAusencia = (rng = Math.random, cfg = CFG) => Math.round(entre(rng, cfg.ausenciaMinMs, cfg.ausenciaMaxMs));

// Quem vem, onde fica e por quanto tempo. `ultimos` evita repetir o mesmo mascote duas visitas seguidas.
export function planejarVisita(rng = Math.random, ultimos = [], cfg = CFG) {
  const dupla = rng() < cfg.chanceDeDupla;
  const pool = AGENTES.filter((a) => !ultimos.includes(a));
  const base = pool.length >= (dupla ? 2 : 1) ? pool : AGENTES;
  const agentes = [];
  const sobra = [...base];
  for (let i = 0; i < (dupla ? 2 : 1); i++) agentes.push(sobra.splice(Math.floor(rng() * sobra.length), 1)[0]);
  return {
    agentes,
    borda: BORDAS[Math.floor(rng() * BORDAS.length)],
    duracaoMs: Math.round(entre(rng, cfg.visitaMinMs, cfg.visitaMaxMs)),
    brincam: dupla,
  };
}

// Por que NÃO podem aparecer agora (null = podem). Qualquer pedido de calma vence.
export function motivoDeNaoAparecer({ ligado, calmo, reduzido, abaOculta }) {
  if (!ligado) return 'desligados';
  if (calmo) return 'modo calmo';
  if (reduzido) return 'sistema pede menos movimento';
  if (abaOculta) return 'aba escondida';
  return null;
}

// Para onde os olhos viram: acompanha o ponteiro, limitado a `raio` px dentro da cabeça.
// Sem ponteiro recente (parado, celular) o olhar fica no centro: olhando para você.
export function olhar(centroX, centroY, ponteiro, raio = 2.2) {
  if (!ponteiro) return { dx: 0, dy: 0 };
  const vx = ponteiro.x - centroX, vy = ponteiro.y - centroY;
  const d = Math.hypot(vx, vy);
  if (d < 1) return { dx: 0, dy: 0 };
  const forca = Math.min(1, d / 220); // perto do mascote olha mais de leve; longe, até o limite
  return { dx: +(vx / d * raio * forca).toFixed(2), dy: +(vy / d * raio * forca).toFixed(2) };
}
