// Mascotes: criaturas da história da computação, em neon. Cada agente é uma:
//   Alva = Daemon (o processo de fundo) · Atlas = Wumpus (Hunt the Wumpus, 1973) · Nova = Grue (Zork, 1977)
//   Maia = Fantasma (ghostwriter) · Leo = Verme (worm, o que leva a mensagem)
// Visitam a tela de vez em quando, olham para você (os olhos vermelhos seguem o cursor), às vezes brincam em dupla e
// somem "como mágica". Ficam MAIS AUSENTES que presentes (2 a 6 min fora, 10 a 24 s na tela), são pequenos (64 px),
// ficam nas bordas, não tocam som e nunca bloqueiam um clique (pointer-events: none).
// Desligados por padrão: ligar em "Conforto". Somem no modo calmo, em "reduzir movimento" e quando a aba fica escondida. Não aparecem na Sala 3D (ela já tem seus próprios agentes).
// Cada criatura é desenhada uma vez num canvas (traço neon com brilho); depois só se mexe o elemento, o que é barato.
import { preferencias } from './conforto.js';
import { AGENTES, motivoDeNaoAparecer, olhar, planejarVisita, proximaAusencia } from './mascotes-logica.js';

const TAM = 64;
// cor de cada agente em neon (a mesma identidade do menu, mais viva) e onde ficam os olhos vermelhos [x%, y%, tamanho%]
const NEON = { alva: '#ff3d9a', atlas: '#00edff', nova: '#6f8bff', maia: '#b366ff', leo: '#39ff6a' };
const OLHOS = {
  alva: [[34, 49, 11], [57, 49, 11]],
  atlas: [[33, 37, 11], [57, 37, 11]],
  nova: [[42, 46, 16]],
  maia: [[34, 41, 11], [57, 41, 11]],
  leo: [[66, 41, 10], [78, 41, 10]],
};

// formas em uma grade de 128x128; espelhar = copiar o lado esquerdo para o direito
const esp = (pts) => pts.map(([x, y]) => [128 - x, y]);
function linha(g, pts, fechar = false) { g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); if (fechar) g.closePath(); }
const FORMAS = {
  alva(g) { // Daemon: cabeça de escudo, chifres curvos, presas, trilhas de circuito
    g.beginPath(); linha(g, [[64, 30], [40, 40], [32, 66], [38, 92], [52, 108], [64, 114], [76, 108], [90, 92], [96, 66], [88, 40]], true);
    for (const m of [false, true]) {
      const X = (x) => (m ? 128 - x : x);
      g.moveTo(X(42), 40); g.bezierCurveTo(X(26), 38, X(16), 24, X(24), 8); g.bezierCurveTo(X(34), 22, X(44), 26, X(54), 32);
      g.moveTo(X(32), 66); g.lineTo(X(18), 66); g.lineTo(X(18), 84);
    }
    g.moveTo(64, 30); g.lineTo(64, 52);
    linha(g, [[46, 92], [52, 102], [58, 94], [64, 104], [70, 94], [76, 102], [82, 92]]);
  },
  atlas(g) { // Wumpus: bolha peluda com espinhos, bocarra de dentes e perninhas
    g.beginPath();
    g.moveTo(30, 70); g.bezierCurveTo(24, 40, 44, 30, 64, 34); g.bezierCurveTo(84, 30, 104, 40, 98, 70);
    g.bezierCurveTo(104, 96, 84, 108, 64, 106); g.bezierCurveTo(44, 108, 24, 96, 30, 70);
    linha(g, [[40, 40], [34, 14], [54, 34]]); linha(g, esp([[40, 40], [34, 14], [54, 34]]));
    g.moveTo(40, 80); g.quadraticCurveTo(64, 108, 88, 80);
    for (const x of [48, 56, 64, 72, 80]) { g.moveTo(x, 90 + (x === 64 ? 4 : 0)); g.lineTo(x, 97 + (x === 64 ? 5 : 0)); }
    for (const x of [40, 56, 72, 88]) { g.moveTo(x, 106); g.lineTo(x - 3, 122); }
  },
  nova(g) { // Grue: sombra de espinhos com um olho enorme e dentes
    g.beginPath();
    for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, r = 44 + (i % 2 ? 11 : 0); g[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.92); }
    g.moveTo(26, 62); g.quadraticCurveTo(64, 30, 102, 62); g.quadraticCurveTo(64, 94, 26, 62);
    linha(g, [[38, 98], [44, 108], [50, 98], [56, 108], [62, 98], [68, 108], [74, 98], [80, 108], [86, 98]]);
  },
  maia(g) { // Fantasma (ghostwriter): lençol com barra ondulada e uma pena
    g.beginPath();
    g.moveTo(34, 112); g.lineTo(34, 54); g.bezierCurveTo(34, 20, 94, 20, 94, 54); g.lineTo(94, 112);
    linha(g, [[84, 102], [74, 112], [64, 102], [54, 112], [44, 102], [34, 112]]);
    g.moveTo(64, 70); g.ellipse(64, 78, 6, 8, 0, 0, Math.PI * 2);
    linha(g, [[100, 40], [120, 10]]); linha(g, [[100, 40], [108, 26], [118, 14]]); linha(g, [[100, 40], [96, 46]]);
  },
  leo(g) { // Verme: corpo em gomos erguendo a cabeça, presas e antenas
    g.beginPath();
    for (const [x, y, r] of [[28, 98, 11], [45, 106, 12], [64, 102, 13], [82, 88, 14]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
    g.moveTo(114, 62); g.arc(96, 62, 18, 0, Math.PI * 2);
    linha(g, [[92, 46], [84, 28]]); linha(g, [[104, 46], [114, 28]]);
    linha(g, [[88, 72], [90, 80], [94, 72], [98, 80], [102, 72]]);
  },
};

export function desenharBicho(id) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const cor = NEON[id];
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = cor; g.shadowColor = cor; g.shadowBlur = 9; g.lineWidth = 5;
  FORMAS[id](g); g.stroke();                       // brilho
  g.shadowBlur = 0; g.lineWidth = 2; g.strokeStyle = '#ffffff'; g.globalAlpha = 0.6;
  FORMAS[id](g); g.stroke();                       // núcleo claro do neon
  return c;
}

// ---------------------------------------------------------------- DOM
const CSS = `
.mascote{position:fixed;z-index:60;width:${TAM}px;height:${TAM}px;pointer-events:none;user-select:none;opacity:0;transform:scale(.2);transition:opacity .5s ease,transform .5s cubic-bezier(.2,.9,.3,1.15)}
.mascote.dentro{opacity:1;transform:scale(1)}
.mascote.saindo{opacity:0;transform:scale(.25) rotate(10deg);transition-duration:.45s}
.mascote canvas{width:100%;height:100%;display:block;animation:mascote-respira 3.4s ease-in-out infinite}
.mascote .olho{position:absolute;border-radius:50%;background:#ff2a48;box-shadow:0 0 7px 2px #ff2a4899;transition:transform .12s linear}
.mascote .brilho{position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(255,42,72,.45),rgba(255,42,72,0) 70%);opacity:0;animation:mascote-poof .55s ease-out 1}
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
// "Mostrar animações" desligado no Windows (comum em PC antigo, por velocidade) faz todo navegador dizer "reduzir movimento".
// Por padrão respeitamos; quem escolhe de propósito em Conforto pode ver os mascotes mesmo assim. O modo calmo sempre vence.
const reduzidoEfetivo = () => reduzido() && !preferencias().mascotesApesarDoSistema;
const motivo = () => { const p = preferencias(); return motivoDeNaoAparecer({ ligado: p.mascotes, calmo: p.calmo, reduzido: reduzidoEfetivo(), abaOculta: document.hidden }); };

function criarElemento(id) {
  if (!estiloPronto) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); estiloPronto = true; }
  if (!bichos.has(id)) bichos.set(id, desenharBicho(id));
  const el = document.createElement('div');
  el.className = reduzido() ? 'mascote livre' : 'mascote'; el.setAttribute('aria-hidden', 'true'); el.dataset.agente = id;
  const cv = document.createElement('canvas'); cv.width = cv.height = bichos.get(id).width;
  cv.getContext('2d').drawImage(bichos.get(id), 0, 0);
  el.append(cv);
  for (const [x, y, t] of OLHOS[id]) { const o = document.createElement('i'); o.className = 'olho'; Object.assign(o.style, { left: `${x}%`, top: `${y}%`, width: `${t}%`, height: `${t}%` }); el.append(o); }
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
