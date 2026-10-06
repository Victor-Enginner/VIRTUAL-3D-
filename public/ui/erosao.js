// "Recursive Erosion" do Início: esfera de pontos que se desgasta, com trilhas brilhantes correndo pela superfície.
// Visual do componente recursive-erosion do OriginKit, portado para JS puro (sem React) com as regras de conforto:
// anda devagar por conta própria (a pedido do Victor) e acelera um pouco com o mouse em cima; arrastar gira; no modo calmo vira UM quadro estático;
// ≤ 30 fps, pausa com a aba escondida, quadro único no modo calmo / movimento reduzido.
import { movimentoReduzido } from './conforto.js';

const DUR = 3.99, WORMS = 7, TAIL = 14, WN = WORMS * TAIL, PEARL = 34, TN = WORMS * PEARL, TSTRIDE = 5, PERSP = 0.14, SPHERE_FIT = 0.672;
const COR = { dim: '#FFFFFF', mid: '#7500FF', hot: '#8A3DFF' };
const PRESET = { fit: 0.59, density: 2500, dotSize: 1, speed: 1, morph: 2.5, tumble: 1.8, erosion: 0, trailCount: 4, trailLength: 2, trailGlow: 3 };

const VERT = `
precision highp float;
attribute vec3 a_dir; attribute vec2 a_rand;
uniform mat3 uRot; uniform float uTh, uPx, uPass, uThr, uTrail; uniform vec2 uOff, uScale; uniform vec3 uDim, uMid, uHot;
uniform float uMorph, uGlow, uChroma; uniform vec4 uWorm[${WN}];
varying vec3 v_col; varying float v_a, v_ca, v_k;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
void main(){
  vec3 dir=a_dir; vec2 c=vec2(cos(uTh),sin(uTh));
  float n1=snoise(dir*1.30+vec3(c*0.95,0.0));
  float n2=snoise(dir*2.70+vec3(0.0,c*0.80));
  float n3=snoise(dir*5.60+vec3(c.y*0.62,0.0,c.x*0.62));
  float ridge=1.0-abs(n2);
  float disp=0.54*n1+0.44*(ridge-0.5)+0.20*n3;
  float R=1.0+0.305*uMorph*disp;
  float e=0.66*snoise(dir*1.45+vec3(c*1.30,0.4))+0.34*snoise(dir*3.10+vec3(0.3,c*1.05));
  float alive=smoothstep(uThr-0.05,uThr+0.06,e+0.5);
  vec3 n=uRot*dir; vec3 p=uRot*(dir*R);
  float persp=1.0/(1.0-${PERSP.toFixed(2)}*p.z);
  float face=smoothstep(-0.10,0.06,n.z);
  float boost=0.0;
  if(uTrail>0.5){ boost=a_rand.x*1.5; }
  else{ for(int i=0;i<${WN};i++){ vec3 d=dir-uWorm[i].xyz; boost+=uWorm[i].w*exp(-dot(d,d)*260.0); } boost=min(boost,1.5); }
  float live=(uTrail>0.5?1.0:max(alive,min(1.0,boost*0.9)))*face;
  float sz=uPx*persp*(uTrail>0.5?(0.72+0.55*a_rand.y)*(1.0+boost*1.50):(0.78+0.50*a_rand.y)*(1.0+boost*1.2));
  vec3 col=mix(uDim,uMid,a_rand.x*a_rand.x);
  if(uTrail>0.5) col=mix(uMid,uHot,clamp(boost,0.0,1.0)); else col=mix(col,uHot,clamp(boost*1.1,0.0,1.0));
  float rim=1.0+0.12*pow(1.0-abs(n.z),4.0);
  float a=(uTrail>0.5?(0.52+0.20*a_rand.y)*clamp(boost,0.0,1.22):(0.92+0.28*a_rand.y)*(0.85+0.60*min(boost,1.2)))*rim*live;
  if(uPass>0.5){ sz*=4.6; a*=0.115*uGlow*smoothstep(0.15,0.70,boost); }
  v_col=col; v_a=a;
  v_k=(uPass>0.5)?3.0:(uTrail>0.5?0.0:2.1);
  v_ca=((uPass>0.5)?0.0:(uTrail>0.5?0.02:clamp(2.0/max(sz,3.0),0.015,0.055)))*uChroma;
  gl_PointSize=(a<0.004)?0.0:clamp(sz,0.0,140.0);
  gl_Position=vec4(p.xy*persp*uScale+uOff,0.0,1.0);
}`;
const FRAG = `
precision mediump float; varying vec3 v_col; varying float v_a, v_ca, v_k;
float sp(vec2 c,float k){ float d=length(c)*2.0; if(k<0.5) return 1.0-smoothstep(0.42,1.0,d); return pow(max(0.0,1.0-d),k); }
void main(){
  vec2 q=gl_PointCoord-0.5; vec2 o=vec2(v_ca,v_ca*0.35);
  float aR=sp(q+o,v_k), aG=sp(q,v_k), aB=sp(q-o,v_k);
  vec3 c=vec3(v_col.r*aR,v_col.g*aG,v_col.b*aB)*v_a;
  gl_FragColor=vec4(min(c,vec3(1.0)),clamp(max(max(aR,aG),aB)*v_a,0.0,1.0));
}`;

function rng(seed) { let a = seed >>> 0; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hex(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function reticulado(n) {
  const R0 = rng(20260812), dirs = new Float32Array(n * 3), rnds = new Float32Array(n * 2);
  const GA = Math.PI * (3 - Math.sqrt(5)), SP = Math.sqrt((4 * Math.PI) / n);
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = GA * i;
    const vx = Math.cos(th) * r + (R0() * 2 - 1) * SP * 0.08, vy = y + (R0() * 2 - 1) * SP * 0.08, vz = Math.sin(th) * r + (R0() * 2 - 1) * SP * 0.08;
    const il = 1 / Math.hypot(vx, vy, vz);
    dirs[i * 3] = vx * il; dirs[i * 3 + 1] = vy * il; dirs[i * 3 + 2] = vz * il;
    rnds[i * 2] = R0(); rnds[i * 2 + 1] = R0();
  }
  return { dirs, rnds };
}
function caminhos() {
  const R0 = rng(77123), out = [];
  for (let i = 0; i < WORMS; i++) {
    const cz = 0.06 + R0() * 0.86, ca0 = R0() * 6.283, crr = Math.sqrt(Math.max(0, 1 - cz * cz));
    const c = [Math.cos(ca0) * crr, Math.sin(ca0) * crr, cz];
    const t0 = Math.abs(c[1]) < 0.85 ? [0, 1, 0] : [1, 0, 0];
    const d = t0[0] * c[0] + t0[1] * c[1] + t0[2] * c[2];
    let u = [t0[0] - c[0] * d, t0[1] - c[1] * d, t0[2] - c[2] * d];
    const lu = Math.hypot(...u); u = u.map((x) => x / lu);
    const v = [c[1] * u[2] - c[2] * u[1], c[2] * u[0] - c[0] * u[2], c[0] * u[1] - c[1] * u[0]];
    const rho = 0.46 + R0() * 0.42, sr = Math.sin(rho);
    out.push({ c, u, v, sr, cr: Math.cos(rho), m: 1 + Math.floor(R0() * 2), ph: R0() * 6.283, str: 0.9 + R0() * 0.28, arc: (0.78 + R0() * 0.34) / sr, fl: R0() * 6.283 });
  }
  return out;
}

export function montarErosao(alvo, { lado = 320 } = {}) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = canvas.height = Math.round(lado * dpr);
  canvas.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:1;cursor:grab;touch-action:none';
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: true });
  const vazio = { fluxo() {}, destruir() {} };
  if (!gl) return vazio;
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null; };
  const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return vazio;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return vazio;
  gl.useProgram(prog);
  alvo.append(canvas);

  const aDir = gl.getAttribLocation(prog, 'a_dir'), aRand = gl.getAttribLocation(prog, 'a_rand');
  gl.enableVertexAttribArray(aDir); gl.enableVertexAttribArray(aRand);
  const locs = {}; const U = (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(prog, n)));
  const bDir = gl.createBuffer(), bRand = gl.createBuffer(), bTrail = gl.createBuffer();
  const ret = reticulado(PRESET.density);
  gl.bindBuffer(gl.ARRAY_BUFFER, bDir); gl.bufferData(gl.ARRAY_BUFFER, ret.dirs, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, bRand); gl.bufferData(gl.ARRAY_BUFFER, ret.rnds, gl.STATIC_DRAW);
  const pearls = new Float32Array(TN * TSTRIDE), pearlSeed = new Float32Array(TN), sr = rng(4242);
  for (let i = 0; i < TN; i++) pearlSeed[i] = sr();
  gl.bindBuffer(gl.ARRAY_BUFFER, bTrail); gl.bufferData(gl.ARRAY_BUFFER, pearls.byteLength, gl.DYNAMIC_DRAW);
  const paths = caminhos(), wormPos = new Float32Array(WN * 4), tmp = [0, 0, 0];
  const noCaminho = (w, ang, o) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let k = 0; k < 3; k++) o[k] = w.c[k] * w.cr + (w.u[k] * ca + w.v[k] * sa) * w.sr;
  };
  const cd = hex(COR.dim), cm = hex(COR.mid), ch = hex(COR.hot);

  let clock = 1.2, alvoFluxo = 0, sobre = false, raf = 0, ultimo = 0, vivo = true;
  const ptr = { tx: 0, ty: 0, x: 0, y: 0, down: false, lx: 0, ly: 0 };

  const desenhar = () => {
    const th = 2 * Math.PI * (clock / DUR), P = PRESET;
    for (let k = 0; k < WORMS; k++) {
      const w = paths[k], on = k < P.trailCount ? 1 : 0, head = th * w.m + w.ph, arc = w.arc * P.trailLength;
      const flick = 0.76 + 0.24 * Math.sin(th * 2 + w.fl), flickP = 0.86 + 0.14 * Math.sin(th * 2 + w.fl), pstep = arc / PEARL;
      for (let j = 0; j < TAIL; j++) {
        const o = k * TAIL + j; noCaminho(w, head - j * (arc / TAIL), tmp);
        wormPos[o * 4] = tmp[0]; wormPos[o * 4 + 1] = tmp[1]; wormPos[o * 4 + 2] = tmp[2];
        wormPos[o * 4 + 3] = on * w.str * flick * (0.42 + 0.58 * Math.pow(1 - j / TAIL, 0.7)) * (0.8 + 0.2 * Math.sin(j * 1.7 + head * 2));
      }
      for (let j = 0; j < PEARL; j++) {
        const o = k * PEARL + j, b = o * TSTRIDE, uu = j / PEARL;
        const wob = 0.055 * Math.sin(j * 0.42 + head * 2 + w.fl) + 0.03 * Math.sin(j * 0.17 - head);
        noCaminho(w, head - j * pstep + wob, tmp);
        pearls[b] = tmp[0]; pearls[b + 1] = tmp[1]; pearls[b + 2] = tmp[2];
        pearls[b + 3] = on * w.str * flickP * (0.34 + 0.66 * Math.pow(1 - uu, 0.55)) * (0.74 + 0.26 * Math.sin(j * 1.15 + head * 2 + w.fl));
        pearls[b + 4] = pearlSeed[o];
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, bTrail); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pearls);

    const tk = P.tumble;
    const ax = (0.22 * Math.sin(th) + 0.06 * Math.sin(th * 2 + 1.1)) * tk, ay = (0.3 * Math.sin(th + 2.2) + 0.08 * Math.cos(th * 2)) * tk, az = 0.1 * Math.cos(th + 0.6) * tk;
    const axd = ax - ptr.y * 1.1, ayd = ay + ptr.x * 2.0;
    const cx = Math.cos(axd), sx = Math.sin(axd), cy = Math.cos(ayd), sy = Math.sin(ayd), cz = Math.cos(az), sz = Math.sin(az);
    const rot = new Float32Array([cz * cy, sz * cy, -sy, cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx, cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx]);

    const bw = canvas.width, bh = canvas.height;
    gl.viewport(0, 0, bw, bh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix3fv(U('uRot'), false, rot); gl.uniform1f(U('uTh'), th);
    const fit = SPHERE_FIT * P.fit;
    gl.uniform2f(U('uScale'), fit, fit);
    gl.uniform1f(U('uPx'), Math.max(1, (Math.min(bw, bh) / 1080) * 8 * P.dotSize * 2.2));
    gl.uniform1f(U('uThr'), P.erosion + 0.04 * Math.sin(th * 2 + 0.8));
    gl.uniform2f(U('uOff'), 0.006 * Math.sin(th + 1), -0.012 * Math.cos(th));
    gl.uniform1f(U('uMorph'), P.morph); gl.uniform1f(U('uGlow'), P.trailGlow); gl.uniform1f(U('uChroma'), 1);
    gl.uniform4fv(U('uWorm'), wormPos);
    gl.uniform3f(U('uDim'), cd[0], cd[1], cd[2]); gl.uniform3f(U('uMid'), cm[0], cm[1], cm[2]); gl.uniform3f(U('uHot'), ch[0], ch[1], ch[2]);

    gl.bindBuffer(gl.ARRAY_BUFFER, bDir); gl.vertexAttribPointer(aDir, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bRand); gl.vertexAttribPointer(aRand, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(U('uTrail'), 0); gl.uniform1f(U('uPass'), 0);
    gl.drawArrays(gl.POINTS, 0, PRESET.density);
    gl.bindBuffer(gl.ARRAY_BUFFER, bTrail);
    gl.vertexAttribPointer(aDir, 3, gl.FLOAT, false, TSTRIDE * 4, 0); gl.vertexAttribPointer(aRand, 2, gl.FLOAT, false, TSTRIDE * 4, 12);
    gl.uniform1f(U('uTrail'), 1); gl.uniform1f(U('uPass'), 1); gl.drawArrays(gl.POINTS, 0, TN);
    gl.uniform1f(U('uPass'), 0); gl.drawArrays(gl.POINTS, 0, TN);
  };

  const parado = () => movimentoReduzido() || document.hidden;
  const tick = (agora) => {
    raf = 0;
    if (!vivo) return;
    if (parado()) { desenhar(); return; }
    const dt = Math.min((agora - ultimo) / 1000, 0.1);
    if (dt * 1000 >= 33) {
      ultimo = agora;
      clock = (clock + dt * PRESET.speed * (sobre ? 0.55 : 0.2 + 0.1 * alvoFluxo)) % DUR;   // anda devagar sozinha; o mouse acelera um pouco
      const k = Math.min(1, dt * 3.2);
      ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
      desenhar();
    }
    raf = requestAnimationFrame(tick);   // contínuo; para só com aba escondida, modo calmo ou movimento reduzido
  };
  const acordar = () => { if (!raf && vivo && !parado()) { ultimo = performance.now(); raf = requestAnimationFrame(tick); } };

  canvas.addEventListener('pointerenter', () => { sobre = true; acordar(); });
  canvas.addEventListener('pointerleave', () => { sobre = false; acordar(); });
  canvas.addEventListener('pointerdown', (e) => { ptr.down = true; ptr.lx = e.clientX; ptr.ly = e.clientY; canvas.style.cursor = 'grabbing'; try { canvas.setPointerCapture(e.pointerId); } catch { /* sem captura, segue */ } acordar(); });
  const mover = (e) => {
    if (!ptr.down) return;
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0) return;
    ptr.tx = Math.max(-1.5, Math.min(1.5, ptr.tx + (e.clientX - ptr.lx) / r.width)); ptr.ty = Math.max(-1, Math.min(1, ptr.ty + (e.clientY - ptr.ly) / r.height));
    ptr.lx = e.clientX; ptr.ly = e.clientY; acordar();
  };
  const soltar = () => { if (!ptr.down) return; ptr.down = false; ptr.tx = 0; ptr.ty = 0; canvas.style.cursor = 'grab'; acordar(); };
  addEventListener('pointermove', mover); addEventListener('pointerup', soltar); addEventListener('pointercancel', soltar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) acordar(); });
  desenhar();
  acordar();
  return {
    fluxo(v) { alvoFluxo = Math.max(0, Math.min(1, v || 0)); if (alvoFluxo > 0) acordar(); },
    destruir() { vivo = false; cancelAnimationFrame(raf); removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); removeEventListener('pointercancel', soltar); canvas.remove(); },
  };
}
