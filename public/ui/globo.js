// Globo do Início: ~1.400 partículas em duas camadas girando, com arcos de dados e uma batida de coração quando os
// agentes estão trabalhando. Canvas 2D (sem biblioteca, leve em PC antigo). Parado, o sistema não pulsa.
// Conforto (docs/ACESSIBILIDADE.md): no modo calmo ou com "reduzir movimento" vira UM quadro estático; pausa com a aba
// escondida; a batida é suave e abaixo de 3 variações por segundo; limite de 30 quadros por segundo.
import { bpmDoFluxo, batida, corDaLatitude, giro, pontosFibonacci } from './globo-logica.js';
import { movimentoReduzido } from './conforto.js';

const ALFA = [0.16, 0.3, 0.5, 0.74, 1];
const TAM = [0.9, 1.15, 1.45, 1.85, 2.35];
const LAT = 8;

export function montarGlobo(alvo, { lado = 240, externos = 1000, internos = 340 } = {}) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = canvas.height = Math.round(lado * dpr);
  canvas.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:1';
  alvo.append(canvas);
  const g = canvas.getContext('2d');
  if (!g) { canvas.remove(); return { fluxo() {}, destruir() {} }; }

  const A = pontosFibonacci(externos), B = pontosFibonacci(internos);
  const W = canvas.width, C = W / 2, R = W * 0.4;
  let alvoFluxo = 0, fluxo = 0, ultimo = 0, t0 = performance.now(), quadro = 0, arcos = [], proximoArco = 0;
  const bins = Array.from({ length: LAT * ALFA.length }, () => []);

  function desenhar(t, dt, estatico) {
    fluxo += (alvoFluxo - fluxo) * Math.min(1, dt * 1.6);
    const bpm = estatico ? 0 : bpmDoFluxo(fluxo);
    const env = batida(t, bpm), amp = 0.05 * Math.min(1, fluxo);
    const respira = bpm ? 0 : 0.006 * Math.sin(t * 1.05); // parado, só respira
    const angY = estatico ? 0.6 : t * giro(fluxo), angX = 0.4 + (estatico ? 0 : 0.05 * Math.sin(t * 0.3));
    const cy = Math.cos(angY), sy = Math.sin(angY), cx = Math.cos(angX), sx = Math.sin(angX);

    g.clearRect(0, 0, W, W);
    // brilho do núcleo: cresce de leve com a batida
    const raioNucleo = R * (1.05 + 0.1 * env);
    const halo = g.createRadialGradient(C, C, 0, C, C, raioNucleo);
    halo.addColorStop(0, `rgba(0,237,255,${0.2 + 0.16 * env})`); halo.addColorStop(0.55, `rgba(120,255,60,${0.06 + 0.05 * env})`); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, W);

    for (const b of bins) b.length = 0;
    const projetar = (P, n, escala, ondaAtiva) => {
      const pos = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x0 = P[i * 3], y0 = P[i * 3 + 1], z0 = P[i * 3 + 2];
        // onda da batida: sai de um polo e desce pela esfera
        const rf = escala * (1 + respira + (ondaAtiva ? amp * batida(t - (1 - y0) * 0.09, bpm) : 0));
        const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
        const y2 = y0 * cx - z1 * sx, z2 = y0 * sx + z1 * cx;
        const persp = 1 + 0.16 * z2;
        const px = C + x1 * rf * R * persp, py = C + y2 * rf * R * persp;
        pos[i * 2] = px; pos[i * 2 + 1] = py;
        const faixa = Math.min(LAT - 1, Math.floor(((y0 + 1) / 2) * LAT));
        const prof = Math.min(ALFA.length - 1, Math.floor(((z2 + 1) / 2) * ALFA.length));
        bins[faixa * ALFA.length + prof].push(px, py, escala < 1 ? 1 : 0);
      }
      return pos;
    };
    const posA = projetar(A, externos, 1, true);
    projetar(B, internos, 0.52, false);

    const clarao = Math.min(0.2, env * 0.18);
    for (let prof = 0; prof < ALFA.length; prof++) {
      for (let faixa = 0; faixa < LAT; faixa++) {
        const lista = bins[faixa * ALFA.length + prof];
        if (!lista.length) continue;
        const [r, gg, b] = corDaLatitude(faixa / (LAT - 1), clarao);
        g.fillStyle = `rgba(${r},${gg},${b},${ALFA[prof]})`;
        const s = TAM[prof] * dpr;
        for (let k = 0; k < lista.length; k += 3) {
          const interno = lista[k + 2];
          if (interno && prof > 2) continue; // por dentro só aparece o que fica atrás: dá profundidade sem poluir
          g.fillRect(lista[k] - s / 2, lista[k + 1] - s / 2, s, s);
        }
      }
    }

    // arcos de dados entre pontos da frente: só com o sistema fluindo
    if (!estatico && fluxo > 0.25) {
      if (t > proximoArco && arcos.length < 3) { arcos.push({ a: (Math.random() * externos) | 0, b: (Math.random() * externos) | 0, nasce: t }); proximoArco = t + 1.2 + Math.random() * 1.2; }
      arcos = arcos.filter((a) => t - a.nasce < 1.2);
      g.lineWidth = 1 * dpr; g.lineCap = 'round';
      for (const a of arcos) {
        const vida = (t - a.nasce) / 1.2, alfa = Math.sin(Math.PI * vida) * 0.5;
        const ax = posA[a.a * 2], ay = posA[a.a * 2 + 1], bx = posA[a.b * 2], by = posA[a.b * 2 + 1];
        g.strokeStyle = `rgba(183,255,0,${alfa})`;
        g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2 * 0.55 + C * 0.45, (ay + by) / 2 * 0.55 + C * 0.45, bx, by); g.stroke();
      }
    }
  }

  function laco(agora) {
    quadro = 0;
    if (document.hidden || movimentoReduzido()) return;
    if (agora - ultimo >= 33) { desenhar((agora - t0) / 1000, Math.min(0.1, (agora - ultimo) / 1000), false); ultimo = agora; }
    quadro = requestAnimationFrame(laco);
  }
  function aplicar() {
    cancelAnimationFrame(quadro); quadro = 0;
    if (movimentoReduzido()) { desenhar(0, 0, true); return; }
    ultimo = 0; quadro = requestAnimationFrame(laco);
  }
  const aoMudar = () => aplicar();
  document.addEventListener('visibilitychange', aoMudar);
  window.addEventListener('conforto', aoMudar);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', aoMudar);
  aplicar();

  return {
    // 0 = parado, 1 = tudo trabalhando. O globo suaviza a troca sozinho.
    fluxo(v) { alvoFluxo = Math.min(1, Math.max(0, Number(v) || 0)); },
    destruir() { cancelAnimationFrame(quadro); document.removeEventListener('visibilitychange', aoMudar); window.removeEventListener('conforto', aoMudar); canvas.remove(); },
  };
}
