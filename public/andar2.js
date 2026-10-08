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
import { criarColocador, metade } from './sala/modelos.js';
import { montarTV } from './sala/tv.js';

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
  // o UV da malha 'screen' do Iiyama é girado 90°: +90 deixa o texto em pé (testado renderizando 0, +90 e -90)
  tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2;
  const t = { canvas, tex, ctx: canvas.getContext('2d'), material: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), plano: null, dado: null };
  telas.push(t);
  return t;
}
function monitor(g, x, z, rot, t) {
  // A tela é a PRÓPRIA malha 'screen' do Iiyama pintada com os dados. Na v3 eu media a caixa da tela e punha um plano
  // na frente: com o monitor girado (arco do deck) a caixa alinhada aos eixos ficava maior e à frente, e o plano
  // flutuava solto. Pintar a malha acompanha o monitor em qualquer ângulo.
  const sup = new THREE.Group(); sup.position.set(x, 0, z); sup.rotation.y = rot; g.add(sup);
  porModelo('monitor-iiyama-nc', 0, 0, -Math.PI / 2, { pai: sup, y: TAMPO, obstaculo: false, aoCarregar: (n) => {
    n.traverse((o) => { if (o.isMesh && o.material?.name === 'screen') { o.material = t.material; t.plano = o; } });
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
    porModelo('cadeira-gamer', 0, 0.72, 0, { pai: g, obstaculo: false }); // de frente para a mesa
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
  for (const lado of [-1, 1]) porModelo('caixas-razer', lado * 1.72, -0.14, -lado * 0.25, { pai: deck, y: TAMPO, obstaculo: false, aoCarregar: (n) => metade(n, lado) });
  porModelo('lata-monster', -0.62, 0.18, 0.4, { pai: deck, y: TAMPO, obstaculo: false });
  porModelo('xbox', 1.05, 0.2, -0.3, { pai: deck, y: TAMPO, obstaculo: false });
  for (const ox of [-1.45, 1.45]) porModelo('gabinete-pc', ox, -0.06, 0, { pai: deck, obstaculo: false });
  for (const ox of [-2.55, 2.55]) porModelo('caixa-pedestal', ox, -0.25, ox < 0 ? 0.35 : -0.35, { pai: deck, obstaculo: false });
  porModelo('cadeira-gamer', 0, 0.78, 0, { pai: deck, obstaculo: false }); // de frente para os monitores
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

  // TV ao vivo na parede da direita: o MESMO canal do Paraíso (sala/tv.js). Começa desligada (conforto: nada toca sozinho)
  // sem giro e virada para +Z, igual às TVs do Paraíso (o montarTV mede a tela assumindo isso; girada, a tela saía de lado)
  const tvGrupo = new THREE.Group(); tvGrupo.position.set(0.6, 1.05, -P / 2 + 0.25); cena.add(tvGrupo);
  tvGrupo.userData.pronto = modeloKenney('televisionModern', 0, 0, 0, { cor: 0x0c0c0e }).then((m) => { cena.remove(m); m.position.set(0, 0, 0); m.scale.multiplyScalar(1.6); tvGrupo.add(m); });
  await tvGrupo.userData.pronto;
  // TV do deck: na parede do fundo, acima dos 4 monitores, de frente para quem está nos computadores
  const tvDeck = new THREE.Group(); tvDeck.position.set(dx, 1.62, -P / 2 + 0.2); cena.add(tvDeck);
  tvDeck.userData.pronto = modeloKenney('televisionModern', 0, 0, 0, { cor: 0x0c0c0e }).then((m) => { cena.remove(m); m.position.set(0, 0, 0); m.scale.multiplyScalar(1.35); tvDeck.add(m); });
  await tvDeck.userData.pronto;

  // telão na parede do fundo (resumo)
  const tc = Object.assign(document.createElement('canvas'), { width: 1024, height: 420 });
  const telao = { canvas: tc, ctx: tc.getContext('2d'), tex: new THREE.CanvasTexture(tc) };
  telao.tex.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.9), new THREE.MeshBasicMaterial({ map: telao.tex, toneMapped: false }));
  pl.position.set(-3.4, 1.75, -P / 2 + 0.05); cena.add(pl);
  await Promise.all(pendentes);
  return { deck: telasDeck, telao, tvGrupo, tvDeck, sentado: { x: dx, z: dz + 0.78 } };
}


// ------------------------------------------------------------ Etbaal (provisório: personagem do Paraíso em vermelho;
// o orc entra quando estiver otimizado e com esqueleto — ver docs/PLATAFORMA-AGENTES.md)
let etbaal = null;
// Etbaal = "Miss Galaxy" (Donte_Loves_Art, CC-BY 4.0, crédito em /assets/creditos.json), otimizada com glTF-Transform.
// Animação: reaplicar as do Xbot NÃO deu certo (testado: cópia direta de rotações estica a malha; SkeletonUtils.retargetClip
// corrige a pose de repouso mas o Sketchfab gira a raiz 90° e ela fica de cabeça para baixo). Ela JÁ tem esqueleto Mixamo,
// então as animações virão do próprio Mixamo, feitas para o esqueleto dela. Até lá: de pé, parada, na pose de ligação.
// carrega um personagem GLB, deixa com a altura pedida, de pé no chão; devolve raiz + mixer com as animações DELE
async function personagemGlb(url, altura) {
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const modelo = gltf.scene;
  modelo.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  const raiz = new THREE.Group(); raiz.add(modelo);
  const t = new THREE.Box3().setFromObject(raiz).getSize(new THREE.Vector3());
  modelo.scale.multiplyScalar(altura / t.y);
  const c = new THREE.Box3().setFromObject(raiz), centro = c.getCenter(new THREE.Vector3());
  modelo.position.x -= centro.x; modelo.position.z -= centro.z; modelo.position.y -= c.min.y;
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(modelo) : null;
  return { raiz, modelo, mixer, animacoes: gltf.animations };
}

// Etbaal, por ordem de preferência:
//  1. "Vampire" do Mixamo com a animação "Catwalk Idle To Twist R" (escolha do Victor; Mixamo não permite redistribuir
//     o arquivo solto → fica SÓ no PC, .gitignore). Animação feita PARA esse esqueleto: nada de retarget.
//  2. Miss Galaxy (CC-BY 4.0, no git), parada na pose de ligação.
//  3. o personagem padrão do Paraíso, em vermelho.
// Comportamento (pedido do Victor): AUDITANDO → no deck, de frente para os monitores; SEM TRABALHO → em frente à TV ao vivo.
// A animação "Catwalk" do Mixamo não serve para isso: fica parada no primeiro quadro (postura de pé). As animações
// "Typing" e "Sitting/Watching" virão do Mixamo para o mesmo personagem.
let lugares = null;
function posicionar(auditando) {
  if (!etbaal || !lugares) return;
  const l = auditando ? lugares.deck : lugares.tv;
  etbaal.grupo.position.set(l.x, 0, l.z); etbaal.grupo.rotation.y = l.rot;
  etbaal.estado = auditando ? 'auditando' : 'tv';
}
async function chamarEtbaal(sentado) {
  lugares = {
    deck: { x: sentado.x, z: sentado.z + 0.55, rot: Math.PI },           // atrás da cadeira, olhando os 4 monitores
    tv: { x: 0.6, z: -P / 2 + 2.6, rot: Math.PI },                       // a ~2,3 m da TV da parede do fundo, olhando para ela
  };
  const pronto = (g, extra = {}) => { cena.add(g); etbaal = { grupo: g, mixer: null, ...extra }; posicionar(false); };
  try {
    const v = await personagemGlb('/assets/modelos/etbaal-vampire.glb', 1.9);
    if (v.mixer) { const a = v.mixer.clipAction(v.animacoes[0]); a.play(); v.mixer.setTime(0); a.paused = true; } // postura do 1º quadro, sem desfile
    pronto(v.raiz, { modelo: v.modelo, mixerParado: v.mixer });
    return;
  } catch (e) { console.info('Etbaal vampire indisponível:', e.message); }
  try {
    const g = await personagemGlb('/assets/modelos/etbaal-galaxy.glb', 1.75);
    g.modelo.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
    pronto(g.raiz, { modelo: g.modelo });
    return;
  } catch (e) { console.info('Etbaal galaxy indisponível:', e.message); }
  try { const p = criarPersonagem(await carregarBase(), '#ff2a3d'); pronto(p.grupo); } catch { /* a cena segue */ }
}

// ------------------------------------------------------------ dados reais nas telas
let dados = null, partes = null;
const corNota = (n) => (n < 40 ? '#ff4d5e' : n < 70 ? '#ffc44d' : '#5dff9b');
const corSev = { alta: '#ff4d5e', media: '#ffc44d', baixa: '#7fd1ff' };
async function carregar() {
  dados = await fetch('/api/etbaal?sessao=todas').then((r) => r.json());
  posicionar(Boolean(dados.auditando));
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
  // as 4 telas do Etbaal (arco): log ao vivo, mais vulneráveis, falhas comuns, placar + fila
  const [log, piores, comuns, placar] = partes.deck;
  escreverTela(log, ['etbaal@deck:~$ tail -f auditoria', ...(ev.eventos || []).slice(0, 10).map((e) => e.msg.slice(0, 40))], { fonte: 19 });
  escreverTela(piores, ['MAIS VULNERÁVEIS', ...[...aud].sort((a, b) => a.nota - b.nota).slice(0, 9).map((a) => ({ t: `${String(a.nota).padStart(3)}  ${a.nome.slice(0, 28)}`, cor: corNota(a.nota) }))], { fonte: 19 });
  escreverTela(comuns, ['FALHAS MAIS COMUNS', ...dados.mais_comuns.slice(0, 9).map((m) => `${String(m.n).padStart(3)}× ${m.id}`)], { fonte: 19 });
  escreverTela(placar, ['PLACAR', { t: `${dados.auditados} auditados`, cor: '#ffffff' }, { t: `nota média ${dados.nota_media ?? '—'}/100`, cor: corNota(dados.nota_media ?? 100) }, { t: `${dados.com_falha_grave} com falha grave`, cor: '#ff4d5e' }, '', { t: `fila: ${dados.pendentes} sites próprios`, cor: '#ffb3ba' }, { t: 'passivo: GET · TLS · DNS', cor: '#6b4146' }], { fonte: 24 });
  desenharTelao();
}

// telão principal: manchetes REAIS de hacking e tecnologia (servidor lê RSS; aqui só texto). Troca quando o servidor
// atualiza (15 min), sem rolar nem piscar (conforto).
let manchetes = { noticias: [] };
async function carregarNoticias() { try { manchetes = await fetch('/api/etbaal/noticias').then((r) => r.json()); desenharTelao(); } catch { /* fica a última */ } }
function desenharTelao() {
  if (!partes) return;
  const { ctx, canvas, tex } = partes.telao;
  ctx.fillStyle = '#050102'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff2a3d'; ctx.font = 'bold 40px Consolas, monospace'; ctx.fillText('ETBAAL // HACKING & TECNOLOGIA', 32, 56);
  const corta = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  (manchetes.noticias || []).slice(0, 6).forEach((n, i) => {
    const y = 108 + i * 46;
    ctx.fillStyle = '#ffffff'; ctx.font = '25px Consolas, monospace'; ctx.fillText(corta(n.titulo, 62), 32, y);
    ctx.fillStyle = '#ff8a95'; ctx.font = '17px Consolas, monospace';
    ctx.fillText(`${n.fonte}${n.em ? ' · ' + new Date(n.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}`, 32, y + 20);
  });
  if (!(manchetes.noticias || []).length) { ctx.fillStyle = '#6b4146'; ctx.font = '24px Consolas, monospace'; ctx.fillText('buscando manchetes…', 32, 120); }
  ctx.fillStyle = '#6b4146'; ctx.font = '18px Consolas, monospace';
  ctx.fillText(`Etbaal: ${dados?.auditados ?? '—'} auditados · nota média ${dados?.nota_media ?? '—'} · ${dados?.com_falha_grave ?? '—'} com falha grave · fontes: RSS públicos`, 32, 405);
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
  if (/^auditar/i.test(cmd)) posicionar(true);
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
  if (etbaal?.mixer && !semMovimento) etbaal.mixer.update(dt);
  controles?.update();
  composer?.render();
  requestAnimationFrame(quadro);
}
(async () => {
  if (!renderer) { await carregar().catch(() => {}); return; }
  redimensionar();
  quadro();
  partes = await montar();
  // TVs do 2º andar: cada uma com o próprio canal (sinais públicos com CORS liberado, conferidos em 08/10/2026)
  const CANAIS = {
    sala: { nome: 'Record News', pagina: 'https://famelack.com/tv/br/TPTBqvtnc5kyaM', stream: 'https://rnw-rn.otteravision.com/rnw/rn/rnw_rn.m3u8' },
    deck: { nome: 'Band', pagina: 'https://famelack.com/tv/br/DWCfWX1a4zLh6X', stream: 'https://media.cdntvms.com.br/band_sat/index.m3u8' },
  };
  const rotuloTv = () => { const ss = tvs.map((t) => t.estado()); const b = $('#btn-tv'); const lig = ss.some((x) => x.ligada);
    b.textContent = ss.some((x) => x.carregando) ? 'Sintonizando…' : lig ? 'Desligar TVs' : 'Ligar TVs';
    b.title = ss.map((x) => `${x.canal.nome}${x.erro ? ` (erro: ${x.erro})` : ''}`).join(' · '); };
  const tvs = [
    montarTV({ grupos: [partes.tvGrupo], canal: CANAIS.sala, chave: 'prospector-tv-andar2-sala:v1', aoMudar: () => tvs && rotuloTv() }),
    montarTV({ grupos: [partes.tvDeck], canal: CANAIS.deck, chave: 'prospector-tv-andar2-deck:v1', aoMudar: () => tvs && rotuloTv() }),
  ];
  rotuloTv();
  $('#btn-tv').addEventListener('click', () => { const lig = tvs.some((t) => t.estado().ligada); for (const t of tvs) lig ? t.desligar() : t.ligar(); });
  await chamarEtbaal(partes.sentado);
  await carregar().catch((e) => { $('#chips').textContent = `Sem dados do Etbaal: ${e.message}`; });
  $('#carregando').hidden = true;
  alvo.classList.add('pronta'); // sala.css deixa a cena com opacidade 0 até estar montada
  setInterval(() => carregar().catch(() => {}), 15000);
  carregarNoticias(); setInterval(carregarNoticias, 15 * 60_000);
})();

// diagnóstico: /andar2.html?debug expõe a cena no console (sem o parâmetro, nada muda)
if (new URLSearchParams(location.search).has('debug')) window.__andar2 = { THREE, renderer, cena, camera, composer, estacoes, controles, get etbaal() { return etbaal; } };
