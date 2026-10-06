// "Petrol Glob" do Início: uma bolha iridescente (óleo na água) feita em shader. Visual inspirado no componente
// petrol-glob do OriginKit, mas escrito aqui (sem baixar nada) e dentro das regras de conforto:
// - parada ela fica num quadro estático; só se mexe com o mouse em cima ou quando a equipe está trabalhando (devagar);
// - ≤ 30 fps, pausa com a aba escondida, um quadro só no modo calmo / movimento reduzido.
import { movimentoReduzido } from './conforto.js';

const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float; varying vec2 uv;
uniform float t, fluxo; uniform vec2 giro;
float campo(vec3 p){
  float b = sin(2.6*p.x + t) * sin(2.9*p.y + 1.3*t) * sin(2.4*p.z + 0.7*t);
  float f = sin(7.0*p.x + 1.7*t) * sin(6.0*p.y - t) * sin(7.5*p.z + 0.5*t);
  float d = length(p) - 0.72 - 0.14*b - 0.025*f;
  return d;
}
vec3 normalEm(vec3 p){ vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(campo(p+e.xyy)-campo(p-e.xyy), campo(p+e.yxy)-campo(p-e.yxy), campo(p+e.yyx)-campo(p-e.yyx))); }
vec3 paleta(float x){ return 0.5 + 0.5*cos(6.2831*(x + vec3(0.0, 0.33, 0.67))); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main(){
  vec3 ro = vec3(0.0, 0.0, 2.6), rd = normalize(vec3(uv * 0.6, -1.6));
  vec3 o = ro, d = rd;
  o.xz *= rot(giro.x); d.xz *= rot(giro.x); o.yz *= rot(giro.y); d.yz *= rot(giro.y);
  float dist = 0.0, brilho = 0.0; bool bateu = false; vec3 p;
  for (int i = 0; i < 56; i++) {
    p = o + d * dist; float h = campo(p);
    brilho += 0.012 / (0.04 + abs(h) * abs(h) * 14.0);
    if (h < 0.002) { bateu = true; break; }
    dist += h * 0.8; if (dist > 5.0) break;
  }
  vec3 cor = vec3(0.0); float a = 0.0;
  vec3 halo = paleta(0.1 + 0.25*uv.x - 0.2*uv.y + 0.1*t) * brilho * 0.1;
  if (bateu) {
    vec3 n = normalEm(p);
    float fres = pow(1.0 - max(dot(n, -d), 0.0), 2.2);
    float fase = dot(n, vec3(0.6, 0.5, 0.4))*0.9 + fres*0.9 + 0.12*t;
    vec3 iris = paleta(fase);
    float luz = pow(max(dot(reflect(d, n), normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 40.0);
    cor = iris * (0.22 + 0.9 * fres) + vec3(luz) * 0.9 + halo * 0.5;
    a = 1.0;
  } else { cor = halo; a = clamp(max(cor.r, max(cor.g, cor.b)), 0.0, 1.0); }
  cor = cor / (1.0 + cor * 0.35);                    // não estoura o branco
  float borda = smoothstep(1.0, 0.6, length(uv));     // some nas bordas do quadro
  gl_FragColor = vec4(cor * borda, a * borda);
}`;

function programa(gl) {
  const mk = (tipo, fonte) => { const s = gl.createShader(tipo); gl.shaderSource(s, fonte); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  return gl.getProgramParameter(pr, gl.LINK_STATUS) ? pr : null;
}

export function montarPetrolGlob(alvo, { lado = 260 } = {}) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = canvas.height = Math.round(lado * dpr);
  canvas.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:1;cursor:grab';
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  const pr = gl && programa(gl);
  if (!pr) return { fluxo() {}, destruir() {} };
  alvo.append(canvas);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(pr);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uT = gl.getUniformLocation(pr, 't'), uF = gl.getUniformLocation(pr, 'fluxo'), uG = gl.getUniformLocation(pr, 'giro');
  gl.viewport(0, 0, canvas.width, canvas.height);

  let tempo = 2.4, alvoFluxo = 0, sobre = false, raf = 0, ultimo = 0;
  const giro = { x: 0.25, y: -0.12, ax: 0.25, ay: -0.12 };
  const desenhar = () => {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, tempo); gl.uniform1f(uF, alvoFluxo); gl.uniform2f(uG, giro.x, giro.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const parado = () => movimentoReduzido() || document.hidden;
  const tick = (agora) => {
    raf = 0;
    if (parado()) { desenhar(); return; }
    const dt = Math.min((agora - ultimo) / 1000, 0.1);
    if (dt * 1000 >= 33) {
      ultimo = agora;
      tempo += dt * (sobre ? 0.55 : 0.18 * Math.min(1, alvoFluxo));       // equipe parada e mouse fora = não anda
      giro.x += (giro.ax - giro.x) * Math.min(1, dt * 4); giro.y += (giro.ay - giro.y) * Math.min(1, dt * 4);
      desenhar();
    }
    if (sobre || alvoFluxo > 0 || Math.abs(giro.ax - giro.x) + Math.abs(giro.ay - giro.y) > 0.002) raf = requestAnimationFrame(tick);
  };
  const acordar = () => { if (!raf && !parado()) { ultimo = performance.now(); raf = requestAnimationFrame(tick); } };

  canvas.addEventListener('pointerenter', () => { sobre = true; acordar(); });
  canvas.addEventListener('pointerleave', () => { sobre = false; giro.ax = 0.25; giro.ay = -0.12; acordar(); });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    giro.ax = 0.25 + ((e.clientX - r.left) / r.width - 0.5) * 1.1; giro.ay = -0.12 + ((e.clientY - r.top) / r.height - 0.5) * 0.8;
    acordar();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) acordar(); });
  desenhar();
  return {
    fluxo(v) { alvoFluxo = Math.max(0, Math.min(1, v || 0)); if (alvoFluxo > 0) acordar(); },
    destruir() { cancelAnimationFrame(raf); canvas.remove(); },
  };
}
