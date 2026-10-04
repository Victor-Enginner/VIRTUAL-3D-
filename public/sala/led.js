// Telão de LED de verdade: o conteúdo é desenhado numa matriz baixa (192×84 "LEDs") com uma fonte
// 5×7 de painel de rua, e um shader transforma cada pixel num LED redondo — aceso com brilho em volta,
// apagado como um ponto escuro visível (como um painel real de perto). O letreiro de baixo rola com
// o último evento dos agentes. Tudo é dado real de /api/estado e do fluxo de eventos.
import * as THREE from 'three';

export const COLUNAS = 192, LINHAS = 84;

// fonte 5×7 (cada glifo: 7 linhas de 5 bits, '#' aceso). Acentos caem na letra base.
const G = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'], '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'], ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'], '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'], ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '%': ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'], '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'], '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'], '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
};
const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[“”]/g, '"').replace(/[—–]/g, '-');
export const larguraTexto = (t, e = 1) => normalizar(t).length * 6 * e - e;

// escreve texto na matriz (x, y = canto de cima); e = escala (2 = números grandes)
function escrever(g, texto, x, y, cor, e = 1) {
  g.fillStyle = cor;
  let cx = x;
  for (const ch of normalizar(texto)) {
    const gl = G[ch] || G['?'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r][c] === '#') g.fillRect(cx + c * e, y + r * e, e, e);
    cx += 6 * e;
  }
  return cx;
}

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// cada célula da matriz vira um LED: ponto redondo aceso + halo; apagado = ponto escuro
const FRAG = `
uniform sampler2D mapa; uniform vec2 res; uniform float tempo;
varying vec2 vUv;
void main() {
  vec2 cel = vUv * res;
  vec2 centro = (floor(cel) + 0.5) / res;
  vec3 cor = texture2D(mapa, centro).rgb;
  float d = length(fract(cel) - 0.5);
  float ponto = smoothstep(0.46, 0.30, d);
  float halo = smoothstep(0.75, 0.0, d) * 0.35;
  float aceso = max(cor.r, max(cor.g, cor.b));
  vec3 apagado = vec3(0.045, 0.05, 0.06) * ponto;
  vec3 luz = cor * (ponto * 1.55 + halo);
  float pisca = 0.97 + 0.03 * sin(tempo * 90.0 + vUv.y * 40.0); // leve cintilação de refresh
  gl_FragColor = vec4(mix(apagado, luz * pisca, step(0.02, aceso)), 1.0);
}`;

export function criarPainelLed() {
  const canvas = document.createElement('canvas');
  canvas.width = COLUNAS; canvas.height = LINHAS;
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.NearestFilter; textura.minFilter = THREE.NearestFilter; textura.generateMipmaps = false;
  const material = new THREE.ShaderMaterial({ uniforms: { mapa: { value: textura }, res: { value: new THREE.Vector2(COLUNAS, LINHAS) }, tempo: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG, toneMapped: false });
  return { canvas, textura, material, estado: null, letreiro: 'PROSPECTOR · ESCRITORIO DE AGENTES', x: COLUNAS, acum: 0 };
}

// fila do letreiro: o último evento dos agentes (chamado pela Sala a cada evento novo)
export function letreiroLed(painel, texto) { if (texto) painel.letreiro = texto; }

function desenhar(p) {
  const g = p.canvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, COLUNAS, LINHAS);
  const e = p.estado;
  if (!e) { escrever(g, 'CONECTANDO...', 4, 38, '#00b8c8'); return; }
  const f = e.funil || {}, s = e.situacoes || {};
  const soma = (...k) => k.reduce((a, x) => a + (f[x] || 0), 0);
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  const fraco = Object.entries(s).filter(([k]) => k !== 'site_proprio').reduce((a, [, n]) => a + n, 0);
  const nums = [[total, 'LEADS', '#f4f4f5'], [fraco, 'FRACOS', '#f4f4f5'], [soma('mensagem', 'aprovado', 'enviado', 'respondeu', 'fechado', 'perdido', 'sem_resposta'), 'MSGS', '#c9a2ff'],
    [soma('enviado', 'respondeu', 'fechado', 'perdido', 'sem_resposta'), 'ENVIOS', '#00edff'], [soma('respondeu', 'fechado', 'perdido'), 'RESP.', '#b7ff00']];
  const trab = Object.values(e.agentes || {}).filter((a) => a.status === 'trabalhando');
  // topo: título em ciano e o estado da equipe à direita (pisca "AO VIVO" quando alguém trabalha)
  escrever(g, 'FUNIL DE PROSPECCAO', 3, 2, '#00b8c8');
  const status = e.pausado ? 'PAUSADO' : trab.length ? 'AO VIVO' : 'OCIOSO';
  const corSt = e.pausado ? '#ff963b' : trab.length ? (Math.floor(p.acum * 2) % 2 ? '#b7ff00' : '#3a5a00') : '#6b6b74';
  escrever(g, status, COLUNAS - 3 - larguraTexto(status), 2, corSt);
  g.fillStyle = '#1a2a30'; g.fillRect(3, 11, COLUNAS - 6, 1);
  // números grandes (2×) e rótulos
  const col = (COLUNAS - 6) / nums.length;
  nums.forEach(([n, rot, cor], i) => {
    const x0 = 3 + i * col;
    const txt = String(n).slice(0, 3);
    escrever(g, txt, Math.round(x0 + (col - larguraTexto(txt, 2)) / 2), 16, cor, 2);
    escrever(g, rot, Math.round(x0 + (col - larguraTexto(rot)) / 2), 34, '#7c7c86');
  });
  g.fillStyle = '#1a2a30'; g.fillRect(3, 44, COLUNAS - 6, 1);
  // linha de status do envio
  const env = e.envio || {};
  escrever(g, `HOJE ${env.enviados_hoje ?? 0}/${env.limite ?? 10}  FILA ${env.na_fila ?? 0}  APROVAR ${f.mensagem || 0}`, 3, 49, '#ff963b');
  g.fillStyle = '#1a2a30'; g.fillRect(3, 59, COLUNAS - 6, 1);
  // letreiro rolando
  escrever(g, p.letreiro, Math.round(p.x), 66, '#b7ff00');
  // quem está trabalhando, embaixo de tudo
  const quem = trab.length ? trab.map((a) => a.nome).join(' ') : 'EQUIPE NA MESA';
  escrever(g, quem, 3, 76, '#3f6f78');
}

export function desenharPainelLed(painel, estado) { if (estado) painel.estado = estado; }

// por quadro: o letreiro anda ~28 LEDs/s; a matriz é redesenhada a ~20 fps (192×84 é barato)
// parado = movimento reduzido: o letreiro fica fixo no começo em vez de rolar (senão nunca aparece)
export function animarPainelLed(painel, dt, t, parado = false) {
  painel.material.uniforms.tempo.value = parado ? 0 : t;
  painel.acum += dt;
  if (parado) painel.x = 3;
  else {
    painel.x -= dt * 28;
    if (painel.x < -larguraTexto(painel.letreiro)) painel.x = COLUNAS;
  }
  if ((painel.ultimo ?? -1) + 0.05 > t) return;
  painel.ultimo = t;
  desenhar(painel);
  painel.textura.needsUpdate = true;
}
