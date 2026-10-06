// Fundo "ASCII Fluid": o cursor deixa uma tinta que gira e vira letras. Adaptado do componente ascii-fluid (evilbuttons.com),
// reescrito em JS puro (sem React) e ajustado às regras de conforto do projeto:
// - parado, o fundo fica quieto (nada gira sozinho); a simulação só roda por ~3 s depois que o mouse se mexe;
// - ≤ 30 fps; pausa com a aba escondida; desligado no modo calmo e em "movimento reduzido";
// - fundo transparente: as luzes do body aparecem por baixo e o vidro dos cartões borra as letras.

const CHARSET = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const TINTA = '#6fc4cf';
const SIM = 160, CELULA = 13, DURACAO = 3000, QUADRO = 1000 / 30;

const VERT = `attribute vec2 a_position; varying vec2 v_uv;
void main(){ v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;
const COD = `vec2 dec(vec2 e){ return (e - 0.5) / 0.05; } vec2 enc(vec2 v){ return clamp(v * 0.05 + 0.5, 0.0, 1.0); }
float dec1(float e){ return (e - 0.5) / 0.05; } float enc1(float v){ return clamp(v * 0.05 + 0.5, 0.0, 1.0); }`;
const P = 'precision highp float; varying vec2 v_uv;\n' + COD + '\n';

const FRAG_SPLAT = P + `uniform sampler2D u_target; uniform vec2 u_point; uniform vec3 u_color; uniform float u_radius, u_aspect, u_velocityField;
void main(){
  vec2 p = v_uv - u_point; p.x *= u_aspect;
  float d = exp(-dot(p, p) / max(u_radius, 0.0001));
  vec3 base = texture2D(u_target, v_uv).xyz;
  if (u_velocityField > 0.5) gl_FragColor = vec4(enc(dec(base.xy) + u_color.xy * d), 0.5, 1.0);
  else gl_FragColor = vec4(base + u_color * d, 1.0);
}`;
const FRAG_ADVECT = P + `uniform sampler2D u_velocity, u_source; uniform vec2 u_texel; uniform float u_dt, u_dissipation, u_velocityField;
void main(){
  vec2 vel = dec(texture2D(u_velocity, v_uv).xy);
  vec4 src = texture2D(u_source, clamp(v_uv - u_dt * vel * u_texel * 110.0, 0.0, 1.0));
  if (u_velocityField > 0.5) gl_FragColor = vec4(enc(dec(src.xy) * u_dissipation), 0.5, 1.0);
  else gl_FragColor = vec4(src.xyz * u_dissipation, 1.0);
}`;
const FRAG_DIV = P + `uniform sampler2D u_velocity; uniform vec2 u_texel;
void main(){
  float L = dec(texture2D(u_velocity, v_uv - vec2(u_texel.x, 0.0)).xy).x;
  float R = dec(texture2D(u_velocity, v_uv + vec2(u_texel.x, 0.0)).xy).x;
  float B = dec(texture2D(u_velocity, v_uv - vec2(0.0, u_texel.y)).xy).y;
  float T = dec(texture2D(u_velocity, v_uv + vec2(0.0, u_texel.y)).xy).y;
  gl_FragColor = vec4(0.5 * ((R - L) + (T - B)) * 0.05 + 0.5, 0.0, 0.0, 1.0);
}`;
const FRAG_PRESSAO = P + `uniform sampler2D u_pressure, u_divergence; uniform vec2 u_texel;
void main(){
  float L = dec1(texture2D(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x);
  float R = dec1(texture2D(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x);
  float B = dec1(texture2D(u_pressure, v_uv - vec2(0.0, u_texel.y)).x);
  float T = dec1(texture2D(u_pressure, v_uv + vec2(0.0, u_texel.y)).x);
  float C = dec1(texture2D(u_divergence, v_uv).x);
  gl_FragColor = vec4(enc1((L + R + B + T - C) * 0.25), 0.0, 0.0, 1.0);
}`;
const FRAG_GRAD = P + `uniform sampler2D u_pressure, u_velocity; uniform vec2 u_texel;
void main(){
  float L = dec1(texture2D(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x);
  float R = dec1(texture2D(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x);
  float B = dec1(texture2D(u_pressure, v_uv - vec2(0.0, u_texel.y)).x);
  float T = dec1(texture2D(u_pressure, v_uv + vec2(0.0, u_texel.y)).x);
  vec2 vel = dec(texture2D(u_velocity, v_uv).xy) - vec2(R - L, T - B) * 0.5;
  gl_FragColor = vec4(enc(vel), 0.5, 1.0);
}`;
// saída com alpha: só as letras e um leve halo; o resto é transparente
const FRAG_TELA = `precision highp float; varying vec2 v_uv;
uniform sampler2D u_dye, u_atlas; uniform vec2 u_resolution, u_cell; uniform float u_charCount; uniform vec3 u_ink;
void main(){
  vec2 pixel = v_uv * u_resolution;
  vec2 cell = floor(pixel / u_cell);
  vec2 cellUv = (cell + 0.5) * u_cell / u_resolution;
  float dens = clamp(texture2D(u_dye, cellUv).x, 0.0, 1.0);
  vec2 t = u_cell / u_resolution;
  float glow = dens * 0.40 + (texture2D(u_dye, cellUv + vec2(t.x, 0.0)).x + texture2D(u_dye, cellUv - vec2(t.x, 0.0)).x
    + texture2D(u_dye, cellUv + vec2(0.0, t.y)).x + texture2D(u_dye, cellUv - vec2(0.0, t.y)).x) * 0.15;
  glow = pow(clamp(glow, 0.0, 1.0), 1.35);
  float idx = min(floor(dens * (u_charCount - 0.001)), u_charCount - 1.0);
  vec2 local = fract(pixel / u_cell);
  float glyph = texture2D(u_atlas, vec2((idx + local.x) / u_charCount, local.y)).r * smoothstep(0.02, 0.12, dens);
  float a = clamp(glow * 0.08 + glyph * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(u_ink * a, a);
}`;

function hex(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

function compilar(gl, tipo, fonte) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fonte); gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}
function programa(gl, vs, fonte) {
  const fs = compilar(gl, gl.FRAGMENT_SHADER, fonte);
  if (!fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}
function alvo(gl, w, h, filtro) {
  const tex = gl.createTexture(), fbo = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filtro], [gl.TEXTURE_MAG_FILTER, filtro], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}
function duplo(gl, w, h, filtro) {
  return { read: alvo(gl, w, h, filtro), write: alvo(gl, w, h, filtro), swap() { [this.read, this.write] = [this.write, this.read]; } };
}
function atlas(gl) {
  const n = CHARSET.length, tam = 64, c = document.createElement('canvas');
  c.width = tam * n; c.height = tam;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.floor(tam * 0.72)}px ui-monospace, Consolas, monospace`;
  for (let i = 0; i < n; i++) if (CHARSET[i] !== ' ') ctx.fillText(CHARSET[i], tam * (i + 0.5), tam * 0.55);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  return { tex, n };
}

export function montarAsciiFluid() {
  if (document.getElementById('fundo-ascii')) return null;
  const canvas = document.createElement('canvas');
  canvas.id = 'fundo-ascii';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const vs = compilar(gl, gl.VERTEX_SHADER, VERT);
  const prog = { splat: FRAG_SPLAT, advect: FRAG_ADVECT, div: FRAG_DIV, pressao: FRAG_PRESSAO, grad: FRAG_GRAD, tela: FRAG_TELA };
  for (const k of Object.keys(prog)) prog[k] = vs && programa(gl, vs, prog[k]);
  if (Object.values(prog).some((p) => !p)) return null;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const vel = duplo(gl, SIM, SIM, gl.LINEAR), tinta = duplo(gl, SIM, SIM, gl.LINEAR), pressao = duplo(gl, SIM, SIM, gl.NEAREST);
  const diverg = alvo(gl, SIM, SIM, gl.NEAREST);
  const at = atlas(gl);
  const ink = hex(TINTA);
  const U = (p, n) => gl.getUniformLocation(p, n);

  const usar = (p) => {
    gl.useProgram(p);
    const l = gl.getAttribLocation(p, 'a_position');
    gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  };
  const tex = (unidade, t, p, nome) => { gl.activeTexture(gl.TEXTURE0 + unidade); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U(p, nome), unidade); };
  const desenhar = (a) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, a ? a.fbo : null);
    gl.viewport(0, 0, a ? a.w : canvas.width, a ? a.h : canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const limpar = (a, r = 0, g = 0, b = 0) => { gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo); gl.viewport(0, 0, a.w, a.h); gl.clearColor(r, g, b, 1); gl.clear(gl.COLOR_BUFFER_BIT); };
  const zerar = () => { limpar(vel.read, .5, .5, .5); limpar(vel.write, .5, .5, .5); limpar(tinta.read); limpar(tinta.write); };
  const apagarTela = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  zerar();

  const mouse = { x: .5, y: .5, dx: 0, dy: 0, novo: false };
  let raf = 0, ate = 0, ultimo = 0, pausado = false;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
  const desligado = () => reduzido.matches || document.documentElement.dataset.calmo === '1';

  const redimensionar = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
    apagarTela();
  };
  redimensionar();

  const splat = (alvoFbo, x, y, c, raio, campo, aspecto) => {
    usar(prog.splat);
    tex(0, alvoFbo.read.tex, prog.splat, 'u_target');
    gl.uniform2f(U(prog.splat, 'u_point'), x, y);
    gl.uniform3f(U(prog.splat, 'u_color'), c[0], c[1], c[2]);
    gl.uniform1f(U(prog.splat, 'u_radius'), raio);
    gl.uniform1f(U(prog.splat, 'u_aspect'), aspecto);
    gl.uniform1f(U(prog.splat, 'u_velocityField'), campo);
    desenhar(alvoFbo.write); alvoFbo.swap();
  };

  const passo = (dt) => {
    const t = [1 / SIM, 1 / SIM], aspecto = canvas.width / canvas.height, raio = 0.00012 + 0.55 * 0.0011;
    if (mouse.novo) {
      const rapidez = Math.hypot(mouse.dx, mouse.dy), forca = 18 + rapidez * 120;
      splat(vel, mouse.x, mouse.y, [mouse.dx * forca, mouse.dy * forca, 0], raio, 1, aspecto);
      splat(tinta, mouse.x, mouse.y, [Math.min(1.4, .45 + rapidez * 8), 0, 0], raio * 1.15, 0, aspecto);
      mouse.novo = false; mouse.dx = mouse.dy = 0;
    }
    usar(prog.advect);
    tex(0, vel.read.tex, prog.advect, 'u_velocity'); tex(1, vel.read.tex, prog.advect, 'u_source');
    gl.uniform2f(U(prog.advect, 'u_texel'), t[0], t[1]); gl.uniform1f(U(prog.advect, 'u_dt'), dt);
    gl.uniform1f(U(prog.advect, 'u_dissipation'), 0.88); gl.uniform1f(U(prog.advect, 'u_velocityField'), 1);
    desenhar(vel.write); vel.swap();

    usar(prog.div);
    tex(0, vel.read.tex, prog.div, 'u_velocity'); gl.uniform2f(U(prog.div, 'u_texel'), t[0], t[1]);
    desenhar(diverg);

    limpar(pressao.read, .5, .5, .5); limpar(pressao.write, .5, .5, .5);
    usar(prog.pressao);
    for (let i = 0; i < 12; i++) {
      tex(0, pressao.read.tex, prog.pressao, 'u_pressure'); tex(1, diverg.tex, prog.pressao, 'u_divergence');
      gl.uniform2f(U(prog.pressao, 'u_texel'), t[0], t[1]);
      desenhar(pressao.write); pressao.swap();
    }
    usar(prog.grad);
    tex(0, pressao.read.tex, prog.grad, 'u_pressure'); tex(1, vel.read.tex, prog.grad, 'u_velocity');
    gl.uniform2f(U(prog.grad, 'u_texel'), t[0], t[1]);
    desenhar(vel.write); vel.swap();

    usar(prog.advect);
    tex(0, vel.read.tex, prog.advect, 'u_velocity'); tex(1, tinta.read.tex, prog.advect, 'u_source');
    gl.uniform2f(U(prog.advect, 'u_texel'), t[0], t[1]); gl.uniform1f(U(prog.advect, 'u_dt'), dt);
    gl.uniform1f(U(prog.advect, 'u_dissipation'), 0.93); gl.uniform1f(U(prog.advect, 'u_velocityField'), 0);
    desenhar(tinta.write); tinta.swap();

    usar(prog.tela);
    tex(0, tinta.read.tex, prog.tela, 'u_dye'); tex(1, at.tex, prog.tela, 'u_atlas');
    const cel = CELULA * (canvas.width / innerWidth);
    gl.uniform2f(U(prog.tela, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform2f(U(prog.tela, 'u_cell'), cel, cel);
    gl.uniform1f(U(prog.tela, 'u_charCount'), at.n);
    gl.uniform3f(U(prog.tela, 'u_ink'), ink[0], ink[1], ink[2]);
    desenhar(null);
  };

  const tick = (agora) => {
    raf = 0;
    if (pausado || desligado()) return;
    if (agora >= ate) { zerar(); apagarTela(); return; }   // a tinta acabou: tela limpa e a simulação dorme
    if (agora - ultimo >= QUADRO) { passo(Math.min((agora - ultimo) / 1000, 0.05)); ultimo = agora; }
    raf = requestAnimationFrame(tick);
  };
  const acordar = () => { if (!raf && !pausado) { ultimo = performance.now(); raf = requestAnimationFrame(tick); } };

  const aoMover = (e) => {
    if (desligado()) return;
    const x = e.clientX / innerWidth, y = 1 - e.clientY / innerHeight;
    mouse.dx = x - mouse.x; mouse.dy = y - mouse.y; mouse.x = x; mouse.y = y; mouse.novo = true;
    ate = performance.now() + DURACAO;
    acordar();
  };
  addEventListener('pointermove', aoMover, { passive: true });
  addEventListener('resize', redimensionar);
  document.addEventListener('visibilitychange', () => { pausado = document.hidden; if (pausado) { cancelAnimationFrame(raf); raf = 0; } else if (performance.now() < ate) acordar(); });
  document.body.prepend(canvas);
  return { canvas };
}
