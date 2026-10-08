// 2º andar: lanhouse cyberpunk do Etbaal (agentes/etbaal.json). Página isolada: não importa nada que o Paraíso altere,
// só lê módulos (shell, conforto, personagem). Móveis = Kenney Furniture Kit (CC0, modelos prontos, public/assets/kenney).
// Cada tela de computador mostra uma auditoria REAL de /api/etbaal; nada de texto de enfeite.
// Conforto (docs/ACESSIBILIDADE.md): neon FIXO (nada pisca), sem som; com movimento reduzido o Etbaal fica parado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
const VERDE = 0x39ff88, CIANO = 0x00e5ff, MAGENTA = 0xff2bd6;
const ESCALA_KIT = 2; // o kit Kenney é ~1:2
const L = 16, P = 11, A = 3; // sala em metros

montarShell('sala', { fundoNeural: false });

// ------------------------------------------------------------ renderização
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { $('#sem-webgl').hidden = false; $('#dica').hidden = true; }
const alvo = $('#cena');
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x020406);
cena.fog = new THREE.Fog(0x020406, 14, 30);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
camera.position.set(-5.5, 5.2, 9.5);
let composer, controles;
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); // RX 580: bloom custa por pixel
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  alvo.appendChild(renderer.domElement);
  controles = new OrbitControls(camera, renderer.domElement);
  controles.target.set(0.5, 1, -1);
  controles.enableDamping = !semMovimento;
  controles.maxPolarAngle = Math.PI * 0.47;
  controles.minDistance = 3; controles.maxDistance = 18;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(cena, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.5, 0.82)); // só o neon e as telas brilham
  composer.addPass(new OutputPass());
}
function redimensionar() {
  if (!renderer) return;
  const { clientWidth: w, clientHeight: h } = alvo;
  if (!w || !h) return; // a barra lateral injeta CSS depois: com 0 de altura a câmera ficaria com proporção 0/0 para sempre
  renderer.setSize(w, h); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
// observa o PRÓPRIO elemento (não a janela): pega a mudança quando o CSS da barra lateral chega
new ResizeObserver(redimensionar).observe(alvo);

// ------------------------------------------------------------ sala: concreto escuro + faixas de neon fixas
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0.1, ...extra });
const piso = new THREE.Mesh(new THREE.PlaneGeometry(L, P), mat(0x0a0d10, { roughness: 0.35, metalness: 0.4 }));
piso.rotation.x = -Math.PI / 2; cena.add(piso);
const parede = mat(0x07090c);
for (const [w, x, z, ry] of [[L, 0, -P / 2, 0], [L, 0, P / 2, Math.PI], [P, -L / 2, 0, Math.PI / 2], [P, L / 2, 0, -Math.PI / 2]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, A), parede); m.position.set(x, A / 2, z); m.rotation.y = ry; cena.add(m);
}
const teto = new THREE.Mesh(new THREE.PlaneGeometry(L, P), mat(0x040506)); teto.rotation.x = Math.PI / 2; teto.position.y = A; cena.add(teto);
// faixa de neon = tubo emissivo + luz da mesma cor (iluminação real, não só desenho)
function neon(cor, de, ate, intensidade = 40) {
  const v = new THREE.Vector3().subVectors(ate, de);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, v.length(), 8), new THREE.MeshBasicMaterial({ color: cor }));
  tubo.position.copy(de).add(ate).multiplyScalar(0.5);
  tubo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
  cena.add(tubo);
  const luz = new THREE.PointLight(cor, intensidade, 7, 1.6); luz.position.copy(tubo.position); cena.add(luz);
}
neon(CIANO, new THREE.Vector3(-L / 2 + 0.05, 2.7, -P / 2 + 0.6), new THREE.Vector3(-L / 2 + 0.05, 2.7, P / 2 - 0.6));
neon(MAGENTA, new THREE.Vector3(L / 2 - 0.05, 2.7, -P / 2 + 0.6), new THREE.Vector3(L / 2 - 0.05, 2.7, P / 2 - 0.6));
neon(VERDE, new THREE.Vector3(-L / 2 + 1, 2.85, -P / 2 + 0.05), new THREE.Vector3(L / 2 - 1, 2.85, -P / 2 + 0.05), 60);
neon(CIANO, new THREE.Vector3(-L / 2 + 1, 0.04, -P / 2 + 0.1), new THREE.Vector3(L / 2 - 1, 0.04, -P / 2 + 0.1), 15);
cena.add(new THREE.AmbientLight(0x334455, 0.9));
cena.add(new THREE.HemisphereLight(0x2a3d55, 0x0a0a0a, 1.2));
// luminárias sobre as fileiras e o deck (luz de trabalho fria, como lanhouse à noite)
for (const [x, z, cor, i] of [[-3.2, 1, 0x9fe8ff, 25], [1.2, 1, 0x9fe8ff, 25], [4.6, -3.4, 0x39ff88, 30], [-5, 4, 0xff2bd6, 18]]) {
  const s = new THREE.SpotLight(cor, i, 9, Math.PI / 3.2, 0.6, 1.4); s.position.set(x, A - 0.1, z); s.target.position.set(x, 0, z); cena.add(s, s.target);
}

// ------------------------------------------------------------ modelos prontos
const loader = new GLTFLoader();
const cache = new Map();
async function modelo(nome, x, z, rot = 0, { y = 0, tingir = null } = {}) {
  if (!cache.has(nome)) cache.set(nome, loader.loadAsync(`/assets/kenney/${nome}.glb`).then((g) => g.scene));
  const m = (await cache.get(nome)).clone(true);
  m.scale.setScalar(ESCALA_KIT);
  m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (tingir) o.material.color.multiplyScalar(tingir); } });
  const g = new THREE.Group(); g.add(m);
  const caixa = new THREE.Box3().setFromObject(m); m.position.y -= caixa.min.y; // aterra pelo chão real do modelo
  g.position.set(x, y, z); g.rotation.y = rot; cena.add(g);
  return g;
}

// tela = plano com canvas na frente do monitor; textura redesenhada só quando os dados mudam
const telas = [];
function tela(grupoMonitor, largura = 0.62, altura = 0.36) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 300 });
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const caixa = new THREE.Box3().setFromObject(grupoMonitor);
  const centro = caixa.getCenter(new THREE.Vector3());
  plano.position.copy(centro); plano.position.y = caixa.min.y + (caixa.max.y - caixa.min.y) * 0.62;
  plano.rotation.y = grupoMonitor.rotation.y;
  plano.translateZ(0.06);
  cena.add(plano);
  const t = { canvas, tex, plano, ctx: canvas.getContext('2d'), dado: null };
  telas.push(t);
  return t;
}
function escreverTela(t, linhas, cor = '#39ff88') {
  const { ctx, canvas } = t;
  ctx.fillStyle = '#020806'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '22px Consolas, monospace';
  linhas.slice(0, 10).forEach((l, i) => { ctx.fillStyle = typeof l === 'object' ? l.cor : (i === 0 ? '#ffffff' : cor); ctx.fillText(typeof l === 'object' ? l.t : l, 16, 34 + i * 27); });
  t.tex.needsUpdate = true;
}

// ------------------------------------------------------------ montagem: duas fileiras de estações + deck + balcão + rack
const estacoes = [];
async function montar() {
  // fileiras de estações (lanhouse): monitor de frente para quem senta, cadeira gamer do lado de cá
  const fileiras = [{ z: -0.6, rot: 0 }, { z: 2.6, rot: Math.PI }];
  for (const f of fileiras) for (let i = 0; i < 4; i++) {
    const x = -4.8 + i * 2.1;
    await modelo('desk', x, f.z, f.rot, { tingir: 0.35 });
    const mon = await modelo('computerScreen', x, f.z - Math.cos(f.rot) * 0.25, f.rot + Math.PI, { y: 0.76 * 1, tingir: 0.4 });
    await modelo('computerKeyboard', x, f.z + Math.cos(f.rot) * 0.12, f.rot + Math.PI, { y: 0.76 });
    await modelo('chairDesk', x, f.z + Math.cos(f.rot) * 0.9, f.rot + Math.PI, { tingir: 0.5 });
    estacoes.push(tela(mon));
  }
  // deck do Etbaal ao fundo: mesa de canto com três telas
  await modelo('deskCorner', 4.6, -3.6, 0, { tingir: 0.3 });
  const deck = [];
  for (const [dx, r] of [[-0.75, 0.35], [0, 0], [0.75, -0.35]]) deck.push(tela(await modelo('computerScreen', 4.6 + dx, -3.95, Math.PI + r, { y: 0.76, tingir: 0.4 })));
  // rack de servidores (estante escurecida) e caixas de som
  for (const x of [-7.2, -6.3]) await modelo('bookcaseClosedWide', x, -4.9, 0, { tingir: 0.18 });
  for (const x of [-7.4, 7.4]) await modelo('speaker', x, 4.6, x < 0 ? Math.PI / 4 : -Math.PI / 4, { tingir: 0.4 });
  // balcão da lanhouse com banquetas
  for (const x of [-5.5, -4.5]) await modelo('kitchenBar', x, 4.4, Math.PI, { tingir: 0.35 });
  for (const x of [-5.6, -4.4]) await modelo('stoolBar', x, 3.6, 0, { tingir: 0.5 });
  // telão na parede do fundo (resumo)
  const tela0 = { canvas: Object.assign(document.createElement('canvas'), { width: 1024, height: 420 }) };
  tela0.ctx = tela0.canvas.getContext('2d'); tela0.tex = new THREE.CanvasTexture(tela0.canvas); tela0.tex.colorSpace = THREE.SRGBColorSpace;
  const telao = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.1), new THREE.MeshBasicMaterial({ map: tela0.tex, toneMapped: false }));
  telao.position.set(-1.2, 1.75, -P / 2 + 0.06); cena.add(telao);
  return { deck, telao: tela0 };
}

// ------------------------------------------------------------ Etbaal (mesmo personagem do Paraíso, em verde)
let etbaal = null;
async function chamarEtbaal() {
  try {
    const base = await carregarBase();
    etbaal = criarPersonagem(base, '#39ff88');
    etbaal.grupo.position.set(4.6, 0, -2.7);
    etbaal.grupo.rotation.y = Math.PI;
    cena.add(etbaal.grupo);
  } catch { /* sem o personagem a cena segue: as telas são o que importa */ }
}

// ------------------------------------------------------------ dados reais
let dados = null, escolhido = null, partes = null;
async function carregar() {
  const r = await fetch('/api/etbaal?sessao=todas');
  dados = await r.json();
  const ev = await fetch('/api/eventos?agente=etbaal').then((x) => x.json()).catch(() => ({ eventos: [] }));
  desenharPainel();
  if (!partes) return;
  const aud = dados.ultimas.filter((a) => a.auditado);
  estacoes.forEach((t, i) => {
    const a = aud[i];
    if (!a) return escreverTela(t, ['ESTAÇÃO LIVRE', '', 'aguardando auditoria'], '#5d7d6a');
    const cor = a.nota < 40 ? '#ff5c7a' : a.nota < 70 ? '#ffc44d' : '#39ff88';
    escreverTela(t, [a.nome.slice(0, 34), { t: `NOTA ${a.nota}/100  ${a.host}`, cor }, '', ...a.achados.slice(0, 6).map((x) => ({ t: `[${x.severidade.toUpperCase()}] ${x.id}`, cor: x.severidade === 'alta' ? '#ff5c7a' : x.severidade === 'media' ? '#ffc44d' : '#7fd1ff' }))]);
    t.dado = a;
  });
  const log = (ev.eventos || []).slice(0, 27);
  partes.deck.forEach((t, i) => escreverTela(t, ['etbaal@deck:~$ tail auditoria', ...log.slice(i * 9, i * 9 + 9).map((e) => e.msg.slice(0, 40))]));
  const { ctx, canvas, tex } = partes.telao;
  ctx.fillStyle = '#020806'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#39ff88'; ctx.font = 'bold 54px Consolas, monospace'; ctx.fillText('ETBAAL // SEGURANÇA', 40, 80);
  ctx.font = '34px Consolas, monospace'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`${dados.auditados} sites auditados · nota média ${dados.nota_media ?? '—'}/100`, 40, 150);
  ctx.fillStyle = '#ff5c7a'; ctx.fillText(`${dados.com_falha_grave} com falha grave`, 40, 200);
  ctx.fillStyle = '#7fd1ff'; ctx.font = '28px Consolas, monospace';
  dados.mais_comuns.slice(0, 5).forEach((m, i) => ctx.fillText(`${String(m.n).padStart(3)}× ${m.id}`, 40, 255 + i * 34));
  ctx.fillStyle = '#5d7d6a'; ctx.font = '22px Consolas, monospace'; ctx.fillText(`origem: tabela seguranca · ${new Date().toLocaleTimeString('pt-BR')}`, 40, 405);
  tex.needsUpdate = true;
}

function desenharPainel() {
  const d = dados;
  $('#chips').textContent = `${d.auditados} auditados · ${d.com_falha_grave} com falha grave · ${d.pendentes} na fila · auditoria passiva (sem ataque)`;
  $('#painel').innerHTML = `<h2>Etbaal · cibersegurança</h2>
    <div class="placar"><div><b>${d.auditados}</b><span>auditados</span></div><div><b>${d.nota_media ?? '—'}</b><span>nota média</span></div><div><b class="alta">${d.com_falha_grave}</b><span>falha grave</span></div></div>
    ${d.ultimas.map((a) => `<div class="aud" data-lead="${esc(a.lead_id)}" aria-current="${escolhido === a.lead_id}">
      <strong>${esc(a.nome)}</strong> ${a.auditado ? `<span class="nota ${a.nota < 40 ? 'alta' : a.nota < 70 ? 'media' : 'baixa'}">${a.nota}</span>` : ''}
      <br><small>${esc(a.cidade || '')} · ${esc(a.host || '')}</small>
      ${a.auditado ? `<ul>${a.achados.map((x) => `<li class="${x.severidade}">${esc(x.titulo)}<br><small>${esc(x.evidencia)} · ${esc(x.norma)}</small></li>`).join('')}</ul>` : `<br><small>${esc(a.motivo)}</small>`}
    </div>`).join('') || '<p>Nenhuma auditoria ainda. Clique em "Auditar próximos 10".</p>'}
    <p class="origem">Origem: tabela seguranca (src/etbaal/auditoria.mjs). Cada achado traz a evidência vista e a norma (RFC/OWASP).</p>`;
}
$('#painel').addEventListener('click', (e) => { const el = e.target.closest('[data-lead]'); if (el) { escolhido = el.dataset.lead; desenharPainel(); } });
$('#btn-auditar').addEventListener('click', async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Auditando… (1 site por vez)';
  try { await fetch('/api/etbaal/auditar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limite: 10, sessao: 'todas' }) }); await carregar(); }
  finally { b.disabled = false; b.textContent = 'Auditar próximos 10'; }
});

// clique numa tela 3D destaca a auditoria na lista
const raio = new THREE.Raycaster();
renderer?.domElement.addEventListener('click', (ev) => {
  const r = renderer.domElement.getBoundingClientRect();
  raio.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
  const t = estacoes.find((x) => raio.intersectObject(x.plano).length);
  if (t?.dado) { escolhido = t.dado.lead_id; desenharPainel(); $(`[data-lead="${CSS.escape(escolhido)}"]`)?.scrollIntoView({ block: 'center' }); }
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
  await chamarEtbaal();
  await carregar().catch((e) => { $('#chips').textContent = `Sem dados do Etbaal: ${e.message}`; });
  $('#carregando').hidden = true;
  alvo.classList.add('pronta'); // sala.css mantém a cena invisível (opacidade 0) até estar montada
  setInterval(() => carregar().catch(() => {}), 15000);
})();
// diagnóstico: /andar2.html?debug expõe a cena no console (não muda nada sem o parâmetro)
if (new URLSearchParams(location.search).has('debug')) window.__andar2 = { THREE, renderer, cena, camera, composer, estacoes };
