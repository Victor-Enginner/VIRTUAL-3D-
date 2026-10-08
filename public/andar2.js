// 2º andar: lanhouse cyberpunk do Etbaal (agentes/etbaal.json). Página isolada: só LÊ módulos do Paraíso (shell, conforto,
// personagem); nada aqui altera a Sala. Móveis = Kenney Furniture Kit (CC0, public/assets/kenney).
// Telas mostram auditorias REAIS (/api/etbaal). Conversa com o Etbaal: terminal preto e vermelho, só texto.
//
// Luz (o que deu errado na v1 e o porquê da troca): tubo de neon solto + PointLight forte + bloom baixo = neon "flutuando"
// e bolas estouradas. Agora: fita de LED PRESA na parede junto ao teto, iluminando com RectAreaLight (luz de área,
// lava a parede de forma suave), paredes com textura de concreto (aparecem), bloom só no que é luz de verdade.
// Conforto: nada pisca, sem som; com movimento reduzido o Etbaal fica parado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { montarShell } from './ui/shell.js';
import { movimentoReduzido } from './ui/conforto.js';
import { carregarBase, criarPersonagem } from './sala/personagens.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semMovimento = movimentoReduzido();
const VERMELHO = 0xff2a3d, CIANO = 0x00e5ff, MAGENTA = 0xff2bd6;
const ESCALA_KIT = 2; // o kit Kenney é ~1:2
const L = 16, P = 11, A = 3; // sala em metros
const DECK = { x: 4.2, z: -3.4 }; // canto do Etbaal

montarShell('sala', { fundoNeural: false });

// ------------------------------------------------------------ renderização
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { $('#sem-webgl').hidden = false; $('#dica').hidden = true; }
const alvo = $('#cena');
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x030405);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
camera.position.set(-2.5, 3.6, 7.2);
let composer, controles;
if (renderer) {
  RectAreaLightUniformsLib.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); // RX 580: o bloom custa por pixel
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  alvo.appendChild(renderer.domElement);
  controles = new OrbitControls(camera, renderer.domElement);
  controles.target.set(2.2, 0.9, -2.4);
  controles.enableDamping = !semMovimento;
  controles.maxPolarAngle = Math.PI * 0.48;
  controles.minDistance = 1.5; controles.maxDistance = 14;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(cena, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.42, 0.35, 0.9)); // limiar alto: só fita, tela e LED brilham
  composer.addPass(new OutputPass());
}
function redimensionar() {
  if (!renderer) return;
  const { clientWidth: w, clientHeight: h } = alvo;
  if (!w || !h) return; // a barra lateral injeta CSS depois: com 0 de altura a câmera ficaria 0/0 para sempre
  renderer.setSize(w, h); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(redimensionar).observe(alvo); // observa o PRÓPRIO elemento, não a janela

// ------------------------------------------------------------ sala: concreto escuro com textura + fitas de LED
// textura de concreto gerada uma vez (ruído suave), para a parede ter superfície que segure a luz
function concreto(base) {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const x = c.getContext('2d'), img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const n = base + (Math.random() - 0.5) * 18; img.data[i] = n; img.data[i + 1] = n + 2; img.data[i + 2] = n + 5; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05, ...o });
const piso = new THREE.Mesh(new THREE.PlaneGeometry(L, P), mat({ color: 0x15181c, roughness: 0.32, metalness: 0.5, map: concreto(40) }));
piso.rotation.x = -Math.PI / 2; cena.add(piso);
const paredeMat = mat({ color: 0x2a2f36, map: concreto(60) });
for (const [w, x, z, ry] of [[L, 0, -P / 2, 0], [L, 0, P / 2, Math.PI], [P, -L / 2, 0, Math.PI / 2], [P, L / 2, 0, -Math.PI / 2]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, A), paredeMat); m.position.set(x, A / 2, z); m.rotation.y = ry; cena.add(m);
}
const teto = new THREE.Mesh(new THREE.PlaneGeometry(L, P), mat({ color: 0x0b0d10 })); teto.rotation.x = Math.PI / 2; teto.position.y = A; cena.add(teto);

// fita de LED presa na parede (perto do teto) + luz de área apontando para a parede/sala
function fita(cor, x, z, largura, rotY, intensidade = 6) {
  const g = new THREE.Group(); g.position.set(x, A - 0.12, z); g.rotation.y = rotY; cena.add(g);
  const tira = new THREE.Mesh(new THREE.BoxGeometry(largura, 0.035, 0.03), new THREE.MeshBasicMaterial({ color: cor }));
  tira.position.z = 0.02; g.add(tira);
  // luz de área na posição da fita, apontando para um ponto 2 m para dentro da sala e 2 m abaixo (lava parede e chão)
  g.updateMatrixWorld(true);
  const luz = new THREE.RectAreaLight(cor, intensidade, largura, 0.35);
  luz.position.copy(new THREE.Vector3(0, -0.1, 0.08).applyMatrix4(g.matrixWorld));
  luz.lookAt(new THREE.Vector3(0, -2, 2).applyMatrix4(g.matrixWorld));
  cena.add(luz);
}
fita(CIANO, 0, -P / 2 + 0.01, L - 2, 0, 14);            // fundo
fita(MAGENTA, -L / 2 + 0.01, 0, P - 2, Math.PI / 2, 12); // esquerda
fita(CIANO, L / 2 - 0.01, 0, P - 2, -Math.PI / 2, 9);    // direita
fita(MAGENTA, 0, P / 2 - 0.01, L - 2, Math.PI, 9);       // frente
// ambiente: o suficiente para as silhuetas existirem no escuro (sem isso a v2 virou breu)
cena.add(new THREE.HemisphereLight(0x5a6e8c, 0x140c10, 1.5));
cena.add(new THREE.AmbientLight(0x1c2230, 1.2));
// luz de trabalho sobre as fileiras (fria, lanhouse à noite)
for (const x of [-4, 0]) { const s = new THREE.SpotLight(0xbfe9ff, 40, 8, Math.PI / 3, 0.7, 1.5); s.position.set(x, A - 0.05, 1); s.target.position.set(x, 0, 1); cena.add(s, s.target); }

// ------------------------------------------------------------ modelos prontos
const loader = new GLTFLoader();
const cache = new Map();
async function modelo(nome, x, z, rot = 0, { y = 0, tingir = null, cor = null } = {}) {
  if (!cache.has(nome)) cache.set(nome, loader.loadAsync(`/assets/kenney/${nome}.glb`).then((g) => g.scene));
  const m = (await cache.get(nome)).clone(true);
  m.scale.setScalar(ESCALA_KIT);
  m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (cor) o.material.color.setHex(cor); else if (tingir) o.material.color.multiplyScalar(tingir); } });
  const g = new THREE.Group(); g.add(m);
  const caixa = new THREE.Box3().setFromObject(m); m.position.y -= caixa.min.y; // aterra pelo chão real do modelo
  g.position.set(x, y, z); g.rotation.y = rot; cena.add(g);
  return g;
}

// Tela = plano com canvas colado na FRENTE do monitor. A frente é achada medindo o modelo (lado de onde está quem
// usa), não presumida: na v1 as telas do deck ficaram viradas para a parede e pareciam "não funcionar".
const telas = [];
function tela(monitor, olharDe, { w = 512, h = 300, larg = 0.6, alt = 0.34 } = {}) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  monitor.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(monitor);
  const centro = caixa.getCenter(new THREE.Vector3());
  plano.position.set(centro.x, caixa.min.y + (caixa.max.y - caixa.min.y) * 0.6, centro.z);
  plano.lookAt(olharDe.x, plano.position.y, olharDe.z);       // vira para quem senta
  plano.translateZ(Math.max(caixa.max.x - caixa.min.x, caixa.max.z - caixa.min.z) * 0.18); // sai da carcaça
  cena.add(plano);
  const t = { canvas, tex, plano, ctx: canvas.getContext('2d'), dado: null };
  telas.push(t);
  return t;
}
function escreverTela(t, linhas, { fundo = '#050102', cor = '#ff4d5e', titulo = '#ffffff', fonte = 22 } = {}) {
  const { ctx, canvas } = t;
  ctx.fillStyle = fundo; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fonte}px Consolas, monospace`;
  const passo = fonte * 1.22;
  linhas.slice(0, Math.floor((canvas.height - 12) / passo)).forEach((l, i) => {
    ctx.fillStyle = typeof l === 'object' ? l.cor : (i === 0 ? titulo : cor);
    ctx.fillText(typeof l === 'object' ? l.t : l, 14, fonte + 10 + i * passo);
  });
  t.tex.needsUpdate = true;
}

// LED fixo (não pisca): pequeno ponto emissivo
function led(x, y, z, cor) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: cor })); m.position.set(x, y, z); cena.add(m); }

// ------------------------------------------------------------ montagem
const estacoes = [];
async function montar() {
  // fileiras da lanhouse (clientes): monitor de frente para a cadeira
  const fileiras = [{ z: -0.2, rot: 0 }, { z: 2.8, rot: Math.PI }];
  for (const f of fileiras) for (let i = 0; i < 4; i++) {
    const x = -6 + i * 2.1;
    const s = Math.cos(f.rot); // 1 = cadeira em +z
    await modelo('desk', x, f.z, f.rot, { tingir: 0.3 });
    const mon = await modelo('computerScreen', x, f.z - s * 0.25, f.rot + Math.PI, { y: 0.76, tingir: 0.35 });
    await modelo('computerKeyboard', x, f.z + s * 0.12, f.rot + Math.PI, { y: 0.76 });
    await modelo('chairDesk', x, f.z + s * 0.9, f.rot + Math.PI, { tingir: 0.45 });
    estacoes.push(tela(mon, { x, z: f.z + s * 1.5 }));
  }

  // ---- deck do Etbaal: estação de comando (o setup mais forte do prédio)
  const { x: dx, z: dz } = DECK;
  const sentado = { x: dx, z: dz + 1.35 };
  for (const off of [-1.05, 1.05]) await modelo('desk', dx + off, dz, 0, { cor: 0x111316 }); // bancada larga, preta
  // 6 monitores: 3 embaixo (o do meio reto, laterais angulados) e 3 em cima
  const deck = [];
  for (const [ox, oy, oz] of [[-0.95, 0.76, 0.12], [0, 0.76, -0.05], [0.95, 0.76, 0.12], [-0.95, 1.27, 0.0], [0, 1.27, -0.15], [0.95, 1.27, 0.0]]) {
    const m = await modelo('computerScreen', dx + ox, dz - 0.2 + oz, Math.PI + Math.atan2(ox, 1.4), { y: oy, cor: 0x0c0c0e });
    deck.push(tela(m, sentado));
  }
  await modelo('computerKeyboard', dx, dz + 0.3, Math.PI, { y: 0.76, cor: 0x1a1a1d });
  await modelo('computerMouse', dx + 0.42, dz + 0.32, Math.PI, { y: 0.76, cor: 0x1a1a1d });
  await modelo('laptop', dx - 1.5, dz + 0.15, Math.PI - 0.4, { y: 0.76, cor: 0x18181b });
  for (const sx of [-1.75, 1.75]) await modelo('speaker', dx + sx, dz - 0.15, Math.PI, { y: 0.76, cor: 0x101012 });
  // cadeira própria (não a da equipe): modelo diferente, couro preto
  await modelo('chairModernCushion', sentado.x, sentado.z, Math.PI, { cor: 0x141416 });
  await modelo('rugRound', sentado.x, dz + 0.9, 0, { cor: 0x2a0a0e });
  // fita vermelha sob a bancada e luz de destaque do deck
  const fitaDeck = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: VERMELHO }));
  fitaDeck.position.set(dx, 0.7, dz + 0.42); cena.add(fitaDeck);
  const luzDeck = new THREE.RectAreaLight(VERMELHO, 8, 4.1, 0.2); luzDeck.position.set(dx, 0.68, dz + 0.42); luzDeck.lookAt(dx, 0, dz + 1.4); cena.add(luzDeck);
  // recorte (rim) vermelho atrás do Etbaal: separa a silhueta do fundo
  const rim = new THREE.SpotLight(0xff2a3d, 30, 7, Math.PI / 5, 0.6, 1.4); rim.position.set(dx + 1.8, 2.6, dz - 0.8); rim.target.position.set(dx + 0.5, 1, dz + 1.5); cena.add(rim, rim.target);
  const spotDeck = new THREE.SpotLight(0xffd0d4, 34, 6, Math.PI / 4, 0.8, 1.6); spotDeck.position.set(dx, A - 0.05, dz + 1.2); spotDeck.target.position.set(dx, 0.8, dz); cena.add(spotDeck, spotDeck.target);

  // racks de servidor atrás do deck, com LEDs fixos
  for (const rx of [dx - 2.6, dx + 2.6]) {
    await modelo('bookcaseClosedWide', rx, -P / 2 + 0.45, 0, { cor: 0x0d0e10 });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) led(rx - 0.45 + j * 0.3, 0.35 + i * 0.27, -P / 2 + 0.98, (i + j) % 3 ? VERMELHO : 0x39ff88);
  }
  // balcão da lanhouse com banquetas e caixas de som
  for (const x of [-6, -5]) await modelo('kitchenBar', x, 4.5, Math.PI, { tingir: 0.35 });
  for (const x of [-6.1, -4.9]) await modelo('stoolBar', x, 3.75, 0, { tingir: 0.5 });
  for (const x of [-7.4, 7.4]) await modelo('speaker', x, 4.6, x < 0 ? Math.PI / 4 : -Math.PI / 4, { tingir: 0.4 });

  // telão na parede do fundo (resumo)
  const tc = Object.assign(document.createElement('canvas'), { width: 1024, height: 420 });
  const telao = { canvas: tc, ctx: tc.getContext('2d'), tex: new THREE.CanvasTexture(tc) };
  telao.tex.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.9), new THREE.MeshBasicMaterial({ map: telao.tex, toneMapped: false }));
  pl.position.set(-3.4, 1.75, -P / 2 + 0.05); cena.add(pl);
  return { deck, telao, sentado };
}

// ------------------------------------------------------------ Etbaal (provisório: personagem do Paraíso em vermelho;
// o orc entra quando estiver otimizado e com esqueleto — ver docs/PLATAFORMA-AGENTES.md)
let etbaal = null;
async function chamarEtbaal(sentado) {
  try {
    etbaal = criarPersonagem(await carregarBase(), '#ff2a3d');
    etbaal.grupo.position.set(sentado.x + 0.55, 0, sentado.z + 0.15);
    etbaal.grupo.rotation.y = Math.PI - 0.5;
    cena.add(etbaal.grupo);
  } catch { /* sem o personagem a cena segue: as telas são o que importa */ }
}

// ------------------------------------------------------------ dados reais nas telas
let dados = null, partes = null;
const corNota = (n) => (n < 40 ? '#ff4d5e' : n < 70 ? '#ffc44d' : '#5dff9b');
const corSev = { alta: '#ff4d5e', media: '#ffc44d', baixa: '#7fd1ff' };
async function carregar() {
  dados = await fetch('/api/etbaal?sessao=todas').then((r) => r.json());
  $('#chips').textContent = `${dados.auditados} auditados · ${dados.com_falha_grave} com falha grave · ${dados.pendentes} na fila · auditoria passiva (sem ataque)`;
  if (!partes) return;
  const ev = await fetch('/api/eventos?agente=etbaal&limite=40').then((x) => x.json()).catch(() => ({ eventos: [] }));
  const aud = dados.ultimas.filter((a) => a.auditado);
  estacoes.forEach((t, i) => {
    const a = aud[i];
    if (!a) return escreverTela(t, ['ESTAÇÃO LIVRE', '', 'aguardando auditoria'], { cor: '#5a3a3e' });
    escreverTela(t, [a.nome.slice(0, 34), { t: `NOTA ${a.nota}/100  ${a.host}`, cor: corNota(a.nota) }, '',
      ...a.achados.slice(0, 6).map((x) => ({ t: `[${x.severidade.toUpperCase()}] ${x.id}`, cor: corSev[x.severidade] }))]);
    t.dado = a;
  });
  // as 6 telas do Etbaal: log, piores, falhas comuns, fila, regras, placar
  const [log, piores, comuns, fila, regras, placar] = partes.deck;
  escreverTela(log, ['etbaal@deck:~$ tail -f auditoria', ...(ev.eventos || []).slice(0, 9).map((e) => e.msg.slice(0, 38))], { fonte: 19 });
  escreverTela(piores, ['MAIS VULNERÁVEIS', ...[...aud].sort((a, b) => a.nota - b.nota).slice(0, 8).map((a) => ({ t: `${String(a.nota).padStart(3)}  ${a.nome.slice(0, 28)}`, cor: corNota(a.nota) }))], { fonte: 19 });
  escreverTela(comuns, ['FALHAS MAIS COMUNS', ...dados.mais_comuns.slice(0, 8).map((m) => `${String(m.n).padStart(3)}× ${m.id}`)], { fonte: 19 });
  escreverTela(fila, ['FILA', '', { t: `${dados.pendentes}`, cor: '#ffffff' }, 'sites próprios', 'sem auditoria'], { fonte: 30 });
  escreverTela(regras, ['REGRAS', 'passivo: GET, TLS, DNS', { t: 'proibido: portas, senha,', cor: '#ff4d5e' }, { t: 'formulário, exploração', cor: '#ff4d5e' }, 'só domínio próprio', 'evidência + norma'], { fonte: 20 });
  escreverTela(placar, ['PLACAR', { t: `${dados.auditados} auditados`, cor: '#ffffff' }, { t: `nota média ${dados.nota_media ?? '—'}`, cor: corNota(dados.nota_media ?? 100) }, { t: `${dados.com_falha_grave} com falha grave`, cor: '#ff4d5e' }], { fonte: 24 });
  const { ctx, canvas, tex } = partes.telao;
  ctx.fillStyle = '#050102'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff2a3d'; ctx.font = 'bold 54px Consolas, monospace'; ctx.fillText('ETBAAL // SEGURANÇA', 40, 80);
  ctx.font = '34px Consolas, monospace'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`${dados.auditados} sites auditados · nota média ${dados.nota_media ?? '—'}/100`, 40, 150);
  ctx.fillStyle = '#ff4d5e'; ctx.fillText(`${dados.com_falha_grave} com falha grave`, 40, 200);
  ctx.fillStyle = '#ffb3ba'; ctx.font = '28px Consolas, monospace';
  dados.mais_comuns.slice(0, 5).forEach((m, i) => ctx.fillText(`${String(m.n).padStart(3)}× ${m.id}`, 40, 255 + i * 34));
  ctx.fillStyle = '#6b4146'; ctx.font = '22px Consolas, monospace'; ctx.fillText(`origem: tabela seguranca · ${new Date().toLocaleTimeString('pt-BR')}`, 40, 405);
  tex.needsUpdate = true;
}

// ------------------------------------------------------------ terminal (conversa com o Etbaal, só texto)
const saida = $('#term-saida'), entrada = $('#term-entrada');
function imprimir(linhas, classe = '') {
  for (const l of linhas) { const p = document.createElement('div'); p.className = classe; p.textContent = l; saida.append(p); }
  saida.scrollTop = saida.scrollHeight;
}
const historico = [];
let posHist = 0;
$('#term').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cmd = entrada.value.trim();
  entrada.value = '';
  imprimir([`victor@deck:~$ ${cmd}`], 'eco');
  if (!cmd) return;
  historico.push(cmd); posHist = historico.length;
  entrada.disabled = true;
  try {
    const r = await fetch('/api/etbaal/terminal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comando: cmd }) }).then((x) => x.json());
    if (r.limpar) saida.innerHTML = '';
    else imprimir(r.linhas || [r.erro || 'sem resposta'], r.erro ? 'erro' : '');
    if (/^auditar/i.test(cmd)) await carregar();
  } catch (err) { imprimir([`erro: ${err.message}`], 'erro'); }
  finally { entrada.disabled = false; entrada.focus(); }
});
entrada.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && posHist > 0) { entrada.value = historico[--posHist]; e.preventDefault(); }
  if (e.key === 'ArrowDown') { posHist = Math.min(historico.length, posHist + 1); entrada.value = historico[posHist] || ''; e.preventDefault(); }
});
// barra do terminal minimiza/abre (em tela estreita ele cobre a cena)
$('.term-barra').addEventListener('click', () => $('#term').classList.toggle('fechado'));
imprimir(['ETBAAL // deck de segurança · auditoria passiva', 'digite "ajuda" para ver os comandos.', '']);

// clique numa tela 3D: mostra a auditoria completa no terminal
const raio = new THREE.Raycaster();
renderer?.domElement.addEventListener('click', async (ev) => {
  const r = renderer.domElement.getBoundingClientRect();
  raio.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
  const t = estacoes.find((x) => raio.intersectObject(x.plano).length);
  if (!t?.dado) return;
  entrada.value = `ver ${t.dado.nome.split(/\s+/).slice(0, 2).join(' ')}`;
  $('#term').requestSubmit();
});

// ------------------------------------------------------------ ciclo
const relogio = new THREE.Clock();
function quadro() {
  const dt = relogio.getDelta();
  if (etbaal && !semMovimento) etbaal.mixer.update(dt);
  controles?.update();
  composer?.render();
  requestAnimationFrame(quadro);
}
(async () => {
  if (!renderer) { await carregar().catch(() => {}); return; }
  redimensionar();
  quadro();
  partes = await montar();
  await chamarEtbaal(partes.sentado);
  await carregar().catch((e) => { $('#chips').textContent = `Sem dados do Etbaal: ${e.message}`; });
  $('#carregando').hidden = true;
  alvo.classList.add('pronta'); // sala.css deixa a cena com opacidade 0 até estar montada
  setInterval(() => carregar().catch(() => {}), 15000);
})();

// diagnóstico: /andar2.html?debug expõe a cena no console (sem o parâmetro, nada muda)
if (new URLSearchParams(location.search).has('debug')) window.__andar2 = { THREE, renderer, cena, camera, composer, estacoes, controles };
