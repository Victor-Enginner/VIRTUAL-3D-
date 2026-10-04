// Globo do Início: a parte de CÁLCULO (pontos, batida do coração, ritmo), sem tocar na tela.
// Pura de propósito: os testes provam que a batida é suave (nada de flash), limitada e só existe com o sistema fluindo.

// n pontos distribuídos por igual numa esfera de raio 1 (espiral de Fibonacci). Float32Array [x0,y0,z0, x1,...]
export function pontosFibonacci(n) {
  const p = new Float32Array(n * 3);
  const ouro = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), a = ouro * i;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = y; p[i * 3 + 2] = Math.sin(a) * r;
  }
  return p;
}

// batidas por minuto: parado = 0 (sem pulso); fluindo = de 50 a 72, como um coração em repouso a leve esforço.
export const bpmDoFluxo = (f) => (f <= 0.02 ? 0 : Math.round(50 + 22 * Math.min(1, f)));

// Envelope de um batimento "tum-tá": dois pulsos suaves por ciclo (gaussianas largas, sem borda dura).
// Devolve 0..~1,1. Largura de propósito: mais de ~3 variações bruscas por segundo seria desconfortável (WCAG 2.3.1).
export function batida(t, bpm) {
  if (!bpm) return 0;
  const T = 60 / bpm;
  let fase = (t % T) / T;
  if (fase < 0) fase += 1;
  const g = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  // pulsos centrados longe das bordas do ciclo (0.2 e 0.44) para o valor ser ~0 em fase 0 e 1: sem salto na virada
  return g(fase, 0.2, 0.085) + 0.6 * g(fase, 0.44, 0.1);
}

// mistura de cor lima (183,255,0) -> ciano (0,237,255) pela latitude 0..1
export function corDaLatitude(t, claro = 0) {
  const m = (a, b) => Math.round(a + (b - a) * t);
  const c = [m(183, 0), m(255, 237), m(0, 255)];
  return c.map((v) => Math.round(v + (255 - v) * claro)); // claro = mistura com branco
}

// velocidade de giro (rad/s): devagar parado, um pouco mais viva fluindo
export const giro = (fluxo) => 0.1 + 0.12 * Math.min(1, Math.max(0, fluxo));
