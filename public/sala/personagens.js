// Personagens humanos: Xbot (rig Mixamo, repositório oficial do three.js) com as animações
// originais walk/idle/agree/headShake. "Sentado digitando" e "sentado relaxado" não existem
// livres para esse rig, então são geradas aqui: para cada osso dizemos para onde ele deve
// apontar (direção no espaço do personagem) e calculamos a rotação local a partir da pose de
// repouso. Isso funciona para qualquer personagem com nomes de osso Mixamo.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const URL_XBOT = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Xbot.glb';
const ALTURA = 1.75;

const osso = (raiz, nome) => {
  let achado = null;
  raiz.traverse((o) => { if (!achado && o.isBone && new RegExp(`${nome}$`).test(o.name)) achado = o; });
  return achado;
};

// Pose "sentado": direções-alvo de cada osso no espaço do personagem (olhando para +Z).
function direcoesSentado({ digitando, fase = 0 }) {
  const t = Math.sin(fase * Math.PI * 2), u = Math.sin(fase * Math.PI * 2 + Math.PI);
  return {
    Spine: [0, 1, digitando ? 0.18 : -0.05],
    Spine2: [0, 1, digitando ? 0.12 : -0.08],
    Neck: [0, 1, digitando ? 0.25 : 0.05],
    Head: [0, 1, digitando ? 0.18 + 0.03 * t : 0.08],
    LeftUpLeg: [0.12, -0.05, 1], RightUpLeg: [-0.12, -0.05, 1],
    LeftLeg: [0.02, -1, 0.08], RightLeg: [-0.02, -1, 0.08],
    LeftFoot: [0, -0.35, 1], RightFoot: [0, -0.35, 1],
    LeftArm: digitando ? [0.3, -0.85, 0.42] : [0.22, -0.95, 0.2],
    RightArm: digitando ? [-0.3, -0.85, 0.42] : [-0.22, -0.95, 0.2],
    LeftForeArm: digitando ? [-0.18, -0.08 + 0.06 * t, 1] : [-0.1, -0.35, 1],
    RightForeArm: digitando ? [0.18, -0.08 + 0.06 * u, 1] : [0.1, -0.35, 1],
    LeftHand: digitando ? [-0.05, -0.45 + 0.25 * Math.max(0, t), 1] : [0, -0.4, 1],
    RightHand: digitando ? [0.05, -0.45 + 0.25 * Math.max(0, u), 1] : [0, -0.4, 1],
  };
}

const ORDEM = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const FILHO = { Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', Head: 'HeadTop_End', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand',
  LeftHand: 'LeftHandMiddle1', RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandMiddle1', LeftUpLeg: 'LeftLeg',
  LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };

// Calcula os quaternions locais de uma pose a partir da pose de repouso do modelo.
function resolverPose(modelo, direcoes) {
  modelo.updateMatrixWorld(true);
  const raizInv = new THREE.Quaternion();
  modelo.getWorldQuaternion(raizInv).invert();
  const repouso = {}, alvo = {}, locais = {};
  const posRaiz = (b) => modelo.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  for (const nome of ORDEM) {
    const b = osso(modelo, nome);
    if (!b) continue;
    repouso[nome] = { b, q: raizInv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())) };
  }
  for (const nome of ORDEM) {
    const r = repouso[nome];
    if (!r) continue;
    const pai = r.b.parent;
    const nomePai = ORDEM.find((n) => repouso[n]?.b === pai);
    const qPaiRepouso = nomePai ? repouso[nomePai].q : raizInv.clone().multiply(pai.getWorldQuaternion(new THREE.Quaternion()));
    const qPaiAlvo = nomePai ? alvo[nomePai] : qPaiRepouso;
    const dir = direcoes[nome];
    const filho = FILHO[nome] && osso(modelo, FILHO[nome]);
    if (dir && filho) {
      const dRepouso = posRaiz(filho).sub(posRaiz(r.b)).normalize();
      const giro = new THREE.Quaternion().setFromUnitVectors(dRepouso, new THREE.Vector3(...dir).normalize());
      alvo[nome] = giro.multiply(r.q);
    } else {
      // sem direção: mantém a rotação local de repouso em relação ao pai já posado
      const local = qPaiRepouso.clone().invert().multiply(r.q);
      alvo[nome] = qPaiAlvo.clone().multiply(local);
    }
    locais[r.b.name] = qPaiAlvo.clone().invert().multiply(alvo[nome]);
  }
  return locais;
}

function clipeDePoses(nome, poses, duracao) {
  const nomes = Object.keys(poses[0]);
  const tempos = poses.map((_, i) => (i / (poses.length - 1)) * duracao);
  const trilhas = nomes.map((n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, tempos, poses.flatMap((p) => p[n].toArray())));
  return new THREE.AnimationClip(nome, duracao, trilhas);
}

export async function carregarBase(aoProgresso) {
  const gltf = await new GLTFLoader().loadAsync(URL_XBOT, (e) => e.total && aoProgresso?.(e.loaded / e.total));
  const modelo = gltf.scene;
  const caixa = new THREE.Box3().setFromObject(modelo);
  const escala = ALTURA / (caixa.max.y - caixa.min.y);
  const clipes = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  // as poses são resolvidas no modelo original, em repouso, antes de qualquer animação tocar
  const quadros = 8;
  clipes.digitando = clipeDePoses('digitando', [...Array(quadros + 1)].map((_, i) => resolverPose(modelo, direcoesSentado({ digitando: true, fase: i / quadros }))), 0.55);
  const relaxado = resolverPose(modelo, direcoesSentado({ digitando: false }));
  clipes.sentado = clipeDePoses('sentado', [relaxado, relaxado], 1);
  // agree/headShake do Xbot são parciais; viram camadas aditivas sobre o idle (como no exemplo oficial)
  for (const n of ['agree', 'headShake']) if (clipes[n]) THREE.AnimationUtils.makeClipAdditive(clipes[n]);
  return { modelo, escala, clipes };
}

// Pinta o Xbot com a cor do agente (os dois materiais: articulações e superfícies).
function vestir(raiz, cor) {
  const c = new THREE.Color(cor);
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned mesh se move além da caixa original
    o.material = o.material.clone();
    if (/Joints/i.test(o.material.name)) o.material.color.set(0x2a2a30);
    else { o.material.color.copy(c); o.material.roughness = 0.55; o.material.metalness = 0.05; }
  });
}

export function criarPersonagem(base, cor) {
  const raiz = SkeletonUtils.clone(base.modelo);
  raiz.scale.setScalar(base.escala);
  vestir(raiz, cor);
  const grupo = new THREE.Group();
  grupo.add(raiz);
  const mixer = new THREE.AnimationMixer(raiz);
  const acoes = {};
  for (const [nome, clip] of Object.entries(base.clipes)) {
    const a = mixer.clipAction(clip);
    if (nome === 'agree' || nome === 'headShake') { a.blendMode = THREE.AdditiveAnimationBlendMode; a.setLoop(THREE.LoopRepeat); }
    acoes[nome] = a;
  }
  let atual = null;
  function tocar(nome, fade = 0.35) {
    const a = acoes[nome];
    if (!a || atual === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    atual?.fadeOut(fade);
    atual = a;
  }
  function gesto(nome, ligado) {
    const a = acoes[nome];
    if (!a) return;
    if (ligado && !a.isRunning()) a.reset().setEffectiveWeight(0.8).fadeIn(0.4).play();
    if (!ligado && a.isRunning()) a.fadeOut(0.4);
  }
  // passo da animação acompanha a velocidade real (sem pé deslizando nem "correria")
  const V_CLIPE = 1.0; // m/s em que o ciclo de caminhada do modelo parece natural
  function ritmoPasso(v) { if (acoes.walk) acoes.walk.timeScale = Math.min(1.25, Math.max(0.55, v / V_CLIPE)); }
  // "para onde o rosto aponta" no espaço do osso da cabeça, medido na pose de repouso (o personagem
  // olha para +Z): não dá para presumir um eixo fixo, o Xbot tem a cabeça com eixos girados
  const cabeca = osso(raiz, 'Head');
  let frenteCabeca = null;
  if (cabeca) {
    grupo.updateMatrixWorld(true);
    const q = cabeca.getWorldQuaternion(new THREE.Quaternion()).invert();
    frenteCabeca = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
  }
  tocar('idle', 0);
  return { grupo, raiz, mixer, tocar, gesto, ritmoPasso, cabeca, frenteCabeca };
}
