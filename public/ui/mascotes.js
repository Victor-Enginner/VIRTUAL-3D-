// Mascotes peludinhos: os cinco agentes visitam a tela de vez em quando, olham para você, às vezes brincam entre si
// e somem "como mágica". Ficam MAIS AUSENTES que presentes (2 a 6 min fora, 10 a 24 s na tela), são pequenos (64 px),
// ficam nas bordas, não tocam som e nunca bloqueiam um clique (pointer-events: none).
// Desligados por padrão: ligar em "Voz e conforto". Somem no modo calmo, em "reduzir movimento", quando a Alva fala
// e quando a aba fica escondida. Não aparecem na Sala 3D (ela já tem seus próprios agentes).
// O pelo é desenhado uma vez num canvas (semente fixa por agente); depois só se mexe o elemento, o que é barato.
import { preferencias } from './audio.js';
import { AGENTES, motivoDeNaoAparecer, olhar, planejarVisita, proximaAusencia } from './mascotes-logica.js';

const COR = { alva: '#d9468f', atlas: '#0e9fb8', nova: '#3b5bdb', maia: '#7c3aed', leo: '#16a34a' };
const TAM = 64;

// ---------------------------------------------------------------- desenho
function semente(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

export function desenharBicho(id) {
  const S = 2, W = 64 * S * 2; // 128 px de desenho para 64 px na tela (nítido em tela densa)
  const c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d');
  const rng = semente([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const [H, Sat, L] = hsl(COR[id]);
  const cx = W / 2, cy = W * 0.55, rx = W * 0.31, ry = W * 0.28;
  const raio = (t) => (rx * ry) / Math.hypot(ry * Math.cos(t), rx * Math.sin(t)) * (1 + 0.035 * Math.sin(3 * t + 1.7));
  const cor = (dl, a = 1) => `hsla(${H},${Sat}%,${Math.max(8, Math.min(92, L + dl))}%,${a})`;
  // corpo
  g.beginPath();
  for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2; const r = raio(t); g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(t) * r, cy + Math.sin(t) * r); }
  g.closePath();
  const fundo = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.35, rx * 0.1, cx, cy, rx * 1.05);
  fundo.addColorStop(0, cor(14)); fundo.addColorStop(1, cor(-10));
  g.fillStyle = fundo; g.fill();
  // pelo: traços curtos, dentro (volume) e na borda (silhueta felpuda)
  g.lineCap = 'round';
  for (let i = 0; i < 1100; i++) {
    const t = rng() * Math.PI * 2, dentro = rng() < 0.62;
    const k = dentro ? 0.35 + rng() * 0.65 : 0.96 + rng() * 0.1;
    const r = raio(t) * k, x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r;
    const comp = (dentro ? 5 : 7) * S * (0.6 + rng() * 0.8), ang = t + (rng() - 0.5) * 0.9;
    g.strokeStyle = cor((rng() - 0.42) * 22, 0.5 + rng() * 0.4);
    g.lineWidth = (0.9 + rng() * 1.1) * S;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * comp, y + Math.sin(ang) * comp); g.stroke();
  }
  // bochechas e sorriso
  g.fillStyle = 'rgba(255,120,150,.32)';
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * rx * 0.62, cy + ry * 0.22, rx * 0.13, ry * 0.09, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(20,12,24,.8)'; g.lineWidth = 2.2 * S; g.beginPath(); g.arc(cx, cy + ry * 0.12, rx * 0.12, 0.2, Math.PI - 0.2); g.stroke();
  // acessório de cada um
  g.lineWidth = 2 * S;
  if (id === 'nova') { g.strokeStyle = '#f2c14e'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * rx * 0.36, cy - ry * 0.18, rx * 0.2, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(cx - rx * 0.16, cy - ry * 0.18); g.lineTo(cx + rx * 0.16, cy - ry * 0.18); g.stroke(); }
  if (id === 'atlas') { g.fillStyle = '#16324a'; g.beginPath(); g.ellipse(cx, cy - ry * 0.92, rx * 0.5, ry * 0.3, 0, Math.PI, 0); g.fill(); g.fillStyle = '#f4f4f5'; g.beginPath(); g.arc(cx, cy - ry * 1.24, 3.4 * S, 0, 7); g.fill(); }
  if (id === 'maia') { g.fillStyle = '#ffd1e8'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + rx * 0.5, cy - ry * 0.92); g.lineTo(cx + rx * 0.5 + sx * rx * 0.3, cy - ry * 1.12); g.lineTo(cx + rx * 0.5 + sx * rx * 0.3, cy - ry * 0.72); g.closePath(); g.fill(); } g.beginPath(); g.arc(cx + rx * 0.5, cy - ry * 0.92, 2.6 * S, 0, 7); g.fill(); }
  if (id === 'leo') { g.fillStyle = '#0d5c2a'; g.beginPath(); g.ellipse(cx, cy - ry * 0.9, rx * 0.46, ry * 0.2, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + rx * 0.28, cy - ry * 0.74, rx * 0.3, ry * 0.07, 0, 0, 7); g.fill(); }
  if (id === 'alva') { g.strokeStyle = cor(-22); g.beginPath(); g.moveTo(cx, cy - ry * 0.95); g.lineTo(cx, cy - ry * 1.3); g.stroke(); const b = g.createRadialGradient(cx, cy - ry * 1.38, 1, cx, cy - ry * 1.38, 6 * S); b.addColorStop(0, '#fff'); b.addColorStop(1, '#ff9ccf'); g.fillStyle = b; g.beginPath(); g.arc(cx, cy - ry * 1.38, 5 * S, 0, 7); g.fill(); }
  return c;
}

// ---------------------------------------------------------------- DOM
const CSS = `
.mascote{position:fixed;z-index:60;width:${TAM}px;height:${TAM}px;pointer-events:none;user-select:none;opacity:0;transform:scale(.2);transition:opacity .5s ease,transform .5s cubic-bezier(.2,.9,.3,1.15)}
.mascote.dentro{opacity:1;transform:scale(1)}
.mascote.saindo{opacity:0;transform:scale(.25) rotate(10deg);transition-duration:.45s}
.mascote canvas{width:100%;height:100%;display:block;animation:mascote-respira 3.4s ease-in-out infinite}
.mascote .olho{position:absolute;top:47%;width:11%;height:11%;border-radius:50%;background:#15121a;transition:transform .12s linear}
.mascote .olho::after{content:"";position:absolute;left:18%;top:14%;width:34%;height:34%;border-radius:50%;background:#fff;opacity:.9}
.mascote .olho.e{left:37%}.mascote .olho.d{left:54%}
.mascote .brilho{position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.55),rgba(255,255,255,0) 70%);opacity:0;animation:mascote-poof .55s ease-out 1}
.mascote.brinca canvas{animation:mascote-pulinho 1.5s ease-in-out 3}
/* o bloco global de "reduzir movimento" (base.css) corta tudo para 1ms; quem escolheu ver os mascotes ganha a duração normal só neles */
.mascote.livre{transition-duration:.5s !important}.mascote.livre.saindo{transition-duration:.45s !important}
.mascote.livre canvas{animation-duration:3.4s !important;animation-iteration-count:infinite !important}
.mascote.livre.brinca canvas{animation-duration:1.5s !important;animation-iteration-count:3 !important}
.mascote.livre .brilho{animation-duration:.55s !important;animation-iteration-count:1 !important}
.mascote.livre .olho{transition-duration:.12s !important}
@keyframes mascote-respira{0%,100%{transform:scale(1,1)}50%{transform:scale(1.03,.97)}}
@keyframes mascote-pulinho{0%,100%{transform:translateY(0)}35%{transform:translateY(-9px) rotate(-3deg)}65%{transform:translateY(0) rotate(3deg)}}
@keyframes mascote-poof{0%{opacity:.7;transform:scale(.4)}100%{opacity:0;transform:scale(1.5)}}
`;
// Lugares que não cobrem nada importante: cantos de baixo (acima do chip de status do canto) e o terço de baixo das laterais.
const POSICAO = {
  'esq-baixo': (i) => ({ left: `${14 + i * (TAM + 10)}px`, bottom: '64px' }),
  'dir-baixo': (i) => ({ right: `${14 + i * (TAM + 10)}px`, bottom: '64px' }),
  'esq-meio': (i) => ({ left: '10px', top: `calc(70vh - ${i * (TAM + 10)}px)` }),
  'dir-meio': (i) => ({ right: '10px', top: `calc(70vh - ${i * (TAM + 10)}px)` }),
};

let estiloPronto = false, iniciado = false, timer = null, ativos = [], ultimos = [], ponteiro = null, ponteiroEm = 0, quadro = 0;
const bichos = new Map();
const reduzido = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const falando = () => { const l = document.getElementById('legenda-voz'); return Boolean(l && !l.hidden); };
// "Mostrar animações" desligado no Windows (comum em PC antigo, por velocidade) faz todo navegador dizer "reduzir movimento".
// Por padrão respeitamos; quem escolhe de propósito em Voz e conforto pode ver os mascotes mesmo assim. O modo calmo sempre vence.
const reduzidoEfetivo = () => reduzido() && !preferencias().mascotesApesarDoSistema;
const motivo = () => { const p = preferencias(); return motivoDeNaoAparecer({ ligado: p.mascotes, calmo: p.calmo, reduzido: reduzidoEfetivo(), abaOculta: document.hidden, falando: falando() }); };

function criarElemento(id) {
  if (!estiloPronto) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); estiloPronto = true; }
  if (!bichos.has(id)) bichos.set(id, desenharBicho(id));
  const el = document.createElement('div');
  el.className = reduzido() ? 'mascote livre' : 'mascote'; el.setAttribute('aria-hidden', 'true'); el.dataset.agente = id;
  const cv = document.createElement('canvas'); cv.width = cv.height = bichos.get(id).width;
  cv.getContext('2d').drawImage(bichos.get(id), 0, 0);
  el.append(cv);
  for (const lado of ['e', 'd']) { const o = document.createElement('i'); o.className = `olho ${lado}`; el.append(o); }
  const b = document.createElement('i'); b.className = 'brilho'; el.append(b);
  document.body.append(el);
  return el;
}

function olhos() {
  if (!ativos.length) { quadro = 0; return; }
  const parado = !ponteiro || performance.now() - ponteiroEm > 4000; // ponteiro parado: olha para você (centro)
  for (const el of ativos) {
    const r = el.getBoundingClientRect();
    const { dx, dy } = olhar(r.left + r.width / 2, r.top + r.height * 0.5, parado ? null : ponteiro);
    for (const o of el.querySelectorAll('.olho')) o.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  quadro = requestAnimationFrame(olhos);
}

function tirar(el, rapido = false) {
  ativos = ativos.filter((x) => x !== el);
  if (rapido) return el.remove();
  el.classList.remove('dentro'); el.classList.add('saindo');
  setTimeout(() => el.remove(), 520);
}
const limpar = () => { for (const el of [...ativos]) tirar(el, true); document.querySelectorAll('.mascote').forEach((e) => e.remove()); ativos = []; };

function visitar() {
  timer = null;
  if (motivo()) return agendar(30_000); // agora não: tenta de novo em 30 s, sem aparecer
  const plano = planejarVisita(Math.random, ultimos);
  ultimos = plano.agentes;
  plano.agentes.forEach((id, i) => {
    const el = criarElemento(id);
    Object.assign(el.style, POSICAO[plano.borda](i));
    ativos.push(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('dentro');
      if (plano.brincam) setTimeout(() => el.classList.add('brinca'), 900 + i * 350);
    }));
  });
  if (!quadro) quadro = requestAnimationFrame(olhos);
  const vigia = setInterval(() => { if (motivo()) { clearInterval(vigia); limpar(); } }, 1000); // alguém pediu calma/voz no meio da visita
  setTimeout(() => { clearInterval(vigia); for (const el of [...ativos]) tirar(el); agendar(); }, plano.duracaoMs);
}

function agendar(ms = proximaAusencia()) { clearTimeout(timer); timer = setTimeout(visitar, ms); }

export function chamarMascote() { // botão "Chamar um agora" da página de conforto: pedido explícito, ignora a espera
  if (motivo() === 'desligados') return false;
  clearTimeout(timer); visitar(); return true;
}

export function iniciarMascotes() {
  if (iniciado || typeof document === 'undefined') return;
  iniciado = true;
  addEventListener('pointermove', (e) => { ponteiro = { x: e.clientX, y: e.clientY }; ponteiroEm = performance.now(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) limpar(); });
  addEventListener('conforto', () => {
    if (motivo()) { clearTimeout(timer); timer = null; limpar(); } else if (!timer && !ativos.length) agendar();
  });
  if (!motivo()) agendar(); // a primeira visita também espera: ninguém aparece no instante em que a página abre
}
export { AGENTES };
