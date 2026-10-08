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
import { criarColocador } from './sala/modelos.js';

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
// câmera DENTRO da sala (na v2 começava atrás da parede da frente: de fora, a fita de LED parecia uma linha no ar)
camera.position.set(-0.6, 2.3, 3.9);
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
  controles.minDistance = 1.2; controles.maxDistance = 7.5; // não deixa a câmera atravessar as paredes
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
for (const x of [-5.2, -1]) { const s = new THREE.SpotLight(0xbfe9ff, 14, 8, Math.PI / 2.6, 0.9, 1.6); /* suave: na v2 estourava as mesas */ s.position.set(x, A - 0.05, 1); s.target.position.set(x, 0, 1); cena.add(s, s.target); }

// ------------------------------------------------------------ modelos: o MESMO kit das mesas dos agentes do Paraíso
// (public/assets/modelos, escolhidos pelo Victor, normalizados por medida real em sala/modelos.js). Na v2 usei o Kenney
// básico e ficou pobre; o Etbaal merece no mínimo o setup dos agentes. Kenney só onde não há peça própria (balcão, rack).
const pendentes = [];
const porModelo = criarColocador({ cena, grade: null, pendentes });
const kenney = new GLTFLoader();
const cacheK = new Map();
async function modeloKenney(nome, x, z, rot = 0, { y = 0, cor = null, tingir = null } = {}) {
  if (!cacheK.has(nome)) cacheK.set(nome, kenney.loadAsync(`/assets/kenney/${nome}.glb`).then((g) => g.scene));
  const m = (await cacheK.get(nome)).clone(true);
  m.scale.setScalar(ESCALA_KIT);
  m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (cor) o.material.color.setHex(cor); else if (tingir) o.material.color.multiplyScalar(tingir); } });
  const g = new THREE.Group(); g.add(m);
  m.position.y -= new THREE.Box3().setFromObject(m).min.y;
  g.position.set(x, y, z); g.rotation.y = rot; cena.add(g);
  return g;
}

// Tela DENTRO do monitor Iiyama: plano colado na malha 'screen' do modelo (mesma técnica das mesas do Paraíso).
// Na v2 o plano ficava solto na frente da carcaça e desalinhado.
const telas = [];
function novaTela(w = 512, h = 320) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const t = { canvas, tex, ctx: canvas.getContext('2d'), material: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), plano: null, dado: null };
  telas.push(t);
  return t;
}
function monitor(g, x, z, rot, t) {
  // suporte próprio já girado (arco do deck): a tela segue a frente REAL do monitor. Igual ao Paraíso (sala/cena.js):
  // o Iiyama entra girado -90° e a tela vira um plano no espaço do suporte, colado na face 'screen'.
  const sup = new THREE.Group(); sup.position.set(x, 0, z); sup.rotation.y = rot; g.add(sup);
  porModelo('monitor-iiyama-nc', 0, 0, -Math.PI / 2, { pai: sup, y: TAMPO, obstaculo: false, aoCarregar: (n) => {
    let screen = null;
    n.traverse((o) => { if (o.isMesh && o.material?.name === 'screen') screen = o; });
    if (!screen) return;
    sup.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(screen, true).applyMatrix4(sup.matrixWorld.clone().invert());
    const s2 = caixa.getSize(new THREE.Vector3()), c = caixa.getCenter(new THREE.Vector3());
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(s2.x * 0.97, s2.y * 0.95), t.material);
    plano.position.set(c.x, c.y, caixa.max.z + 0.003);
    sup.add(plano);
    t.plano = plano;
  } });
}
function escreverTela(t, linhas, { fundo = '#050102', cor = '#ff4d5e', titulo = '#ffffff', fonte = 22 } = {}) {
  const { ctx, canvas } = t;
  ctx.fillStyle = fundo; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fonte}px Consolas, monospace`;
  const passo = fonte * 1.22;
  linhas.slice(0, Math.floor((canvas.height - 12) / passo)).forEach((l, i) => {
    ctx.fillStyle = typeof l === 'object' ? l.cor : (i === 0 ? titulo : cor);
    ctx.fillText(typeof l === 'object' ? l.t : l, 16, fonte + 12 + i * passo);
  });
  t.tex.needsUpdate = true;
}
function led(x, y, z, cor) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: cor })); m.position.set(x, y, z); cena.add(m); }

// ------------------------------------------------------------ montagem
const TAMPO = 0.75;
// posto = mesa com o +z local virado para quem senta (mesma convenção do Paraíso, sala/cena.js)
function posto(x, z, rot) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; cena.add(g);
  return g;
}
const estacoes = [];
async function montar() {
  // lanhouse: 8 estações com o kit dos agentes (mesa moderna, Iiyama, teclado Vortex, gabinete, cadeira gamer)
  for (const [fz, rot] of [[-0.4, 0], [2.6, Math.PI]]) for (let i = 0; i < 4; i++) {
    const x = -6.2 + i * 2.1;
    const g = posto(x, fz, rot);
    porModelo('mesa-moderna', 0, 0, 0, { pai: g, obstaculo: false });
    const t = novaTela(); monitor(g, 0, -0.12, 0, t); estacoes.push(t);
    porModelo('teclado-vortex', 0, 0.13, 0, { pai: g, y: TAMPO, obstaculo: false });
    porModelo('gabinete-pc', 0.6, -0.05, 0, { pai: g, obstaculo: false });
    porModelo('cadeira-gamer', 0, 0.72, Math.PI, { pai: g, obstaculo: false });
  }

  // ---- deck do Etbaal: duas mesas modernas juntas, 4 Iiyamas em arco (todos APOIADOS na mesa), periféricos fortes
  const { x: dx, z: dz } = DECK;
  const deck = posto(dx, dz, 0);
  // mesas do Etbaal em preto fosco (as dos agentes são brancas): o deck dele se destaca
  const pretear = (n) => n.traverse((o) => { if (o.isMesh) { o.material.color?.setHex(0x16171a); if ('roughness' in o.material) o.material.roughness = 0.55; } });
  for (const ox of [-0.82, 0.82]) porModelo('mesa-moderna', ox, 0, 0, { pai: deck, obstaculo: false, aoCarregar: pretear });
  const telasDeck = [];
  for (const [ox, oz, r] of [[-1.25, -0.02, 0.42], [-0.42, -0.14, 0.14], [0.42, -0.14, -0.14], [1.25, -0.02, -0.42]]) {
    const t = novaTela(); monitor(deck, ox, oz, r, t); telasDeck.push(t);
  }
  porModelo('teclado-mecanico-azul', 0, 0.16, 0, { pai: deck, y: TAMPO, obstaculo: false });
  porModelo('caixas-razer', 0, -0.05, 0, { pai: deck, y: TAMPO, obstaculo: false, aoCarregar: (n) => n.scale.multiplyScalar(1.0) });
  porModelo('lata-monster', -0.62, 0.18, 0.4, { pai: deck, y: TAMPO, obstaculo: false });
  porModelo('xbox', 1.38, 0.18, -0.3, { pai: deck, y: TAMPO, obstaculo: false });
  for (const ox of [-1.45, 1.45]) porModelo('gabinete-pc', ox, -0.06, 0, { pai: deck, obstaculo: false });
  for (const ox of [-2.05, 2.05]) porModelo('caixa-pedestal', ox, -0.1, ox < 0 ? 0.3 : -0.3, { pai: deck, obstaculo: false });
  porModelo('cadeira-gamer', 0, 0.78, Math.PI, { pai: deck, obstaculo: false });
  porModelo('tapete', 0, 0.9, 0, { pai: deck, obstaculo: false });
  // fita vermelha PRESA na borda da frente do tampo (na v2 ela atravessava a sala no ar)
  const fitaDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: VERMELHO }));
  fitaDeck.position.set(0, TAMPO - 0.035, 0.3); deck.add(fitaDeck);
  const luzDeck = new THREE.RectAreaLight(VERMELHO, 6, 3.2, 0.08); luzDeck.position.set(0, TAMPO - 0.05, 0.3); deck.add(luzDeck);
  deck.updateMatrixWorld(true); luzDeck.lookAt(new THREE.Vector3(0, 0, 1.4).applyMatrix4(deck.matrixWorld));
  const rim = new THREE.SpotLight(0xff2a3d, 26, 7, Math.PI / 5, 0.6, 1.4); rim.position.set(dx + 1.8, 2.6, dz - 0.8); rim.target.position.set(dx + 0.5, 1, dz + 1.5); cena.add(rim, rim.target);
  const spotDeck = new THREE.SpotLight(0xff8a95, 10, 6, Math.PI / 4, 0.8, 1.6); spotDeck.position.set(dx, A - 0.05, dz + 1.2); spotDeck.target.position.set(dx, 0.8, dz); cena.add(spotDeck, spotDeck.target);

  // racks de servidor atrás do deck (estante escurecida) com LEDs fixos
  for (const rx of [dx - 2.9, dx + 2.9]) {
    await modeloKenney('bookcaseClosedWide', rx, -P / 2 + 0.45, 0, { cor: 0x0d0e10 });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) led(rx - 0.45 + j * 0.3, 0.35 + i * 0.27, -P / 2 + 0.98, (i + j) % 3 ? VERMELHO : 0x39ff88);
  }
  // balcão da lanhouse com banquetas e som
  for (const x of [-6, -5]) await modeloKenney('kitchenBar', x, 4.5, Math.PI, { tingir: 0.35 });
  for (const x of [-6.1, -4.9]) await modeloKenney('stoolBar', x, 3.75, 0, { tingir: 0.5 });
  porModelo('caixa-pedestal', -7.3, 4.6, Math.PI / 4, { obstaculo: false });
  porModelo('caixa-pedestal', 7.3, 4.6, -Math.PI / 4, { obstaculo: false });
  for (const [x, z] of [[-7.3, -4.7], [7.3, 4.0]]) porModelo('planta-vaso', x, z, 0, { obstaculo: false });

  // telão na parede do fundo (resumo)
  const tc = Object.assign(document.createElement('canvas'), { width: 1024, height: 420 });
  const telao = { canvas: tc, ctx: tc.getContext('2d'), tex: new THREE.CanvasTexture(tc) };
  telao.tex.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.9), new THREE.MeshBasicMaterial({ map: telao.tex, toneMapped: false }));
  pl.position.set(-3.4, 1.75, -P / 2 + 0.05); cena.add(pl);
  await Promise.all(pendentes);
  return { deck: telasDeck, telao, sentado: { x: dx, z: dz + 0.78 } };
}


// ------------------------------------------------------------ Etbaal (provisório: personagem do Paraíso em vermelho;
// o orc entra quando estiver otimizado e com esqueleto — ver docs/PLATAFORMA-AGENTES.md)
let etbaal = null;
async function chamarEtbaal(sentado) {
  try {
    etbaal = criarPersonagem(await carregarBase(), '#ff2a3d');
    // de pé ao lado da bancada, virado para os monitores (na v2 ficava na frente e tapava as telas)
    etbaal.grupo.position.set(sentado.x + 2.0, 0, sentado.z + 0.3);
    etbaal.grupo.rotation.y = Math.PI + 0.9;
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
