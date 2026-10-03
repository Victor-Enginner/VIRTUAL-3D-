// Modelos escolhidos pelo Victor (Sketchfab, licenças em /assets/creditos.json), otimizados com
// glTF-Transform para /assets/modelos (texturas WebP ≤ 2048, geometria meshopt).
// Cada arquivo vem numa unidade diferente (cm, mm, "unidades"); aqui cada um é normalizado por uma
// medida real e girado para que a frente olhe para +Z.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { bloquear } from './caminhos.js';

// eixo: altura ('y'), largura ('x'), profundidade ('z') ou a maior medida; m: metros; giro: rad
export const MEDIDAS = {
  'base-do-mestre': null, // já está em metros
  'mesa-moderna': { eixo: 'y', m: 0.75, giro: Math.PI / 2 },
  'cadeira-gamer': { eixo: 'y', m: 1.3, giro: Math.PI },
  // tem esqueleto: o giro vai no grupo de fora (girar a raiz não move os ossos). Tela olha para +X.
  'monitor-iiyama-nc': { eixo: 'z', m: 0.62 },
  'teclado-mecanico-azul': { eixo: 'x', m: 0.44 },
  'teclado-vortex': { eixo: 'x', m: 0.44 },
  'celular-xiaomi': { eixo: 'maior', m: 0.163, deitar: true },
  'celular-iphone-nc': { eixo: 'maior', m: 0.15 },
  'caixas-som': { eixo: 'y', m: 0.24 },
  'caixas-razer': { eixo: 'y', m: 0.24, giro: Math.PI / 2 }, // o par vem alinhado em Z
  airpods: { eixo: 'maior', m: 0.062 },
  'lata-monster': { eixo: 'y', m: 0.157 },
  'gabinete-pc': { eixo: 'y', m: 0.46 },
  lixeira: { eixo: 'y', m: 0.38 },
  'caixa-pedestal': { eixo: 'y', m: 1.25 },
  'caixa-jbl': { eixo: 'maior', m: 0.21 },
  'caixa-bluetooth': { eixo: 'y', m: 0.2 },
  xbox: { eixo: 'y', m: 0.3 },
  'mesa-reuniao': { eixo: 'y', m: 0.75 },
  'cadeira-anos60': { eixo: 'y', m: 1.05 },
  'maquete-predio': { eixo: 'y', m: 0.42 },
  'officebot-nc': { eixo: 'y', m: 1.45 },
  // mesa de centro oval de vidro (vem em cm; tampo a ~34 cm): peça principal do lounge
  'mesa-principal': { eixo: 'z', m: 1.45 },
  'mesa-centro-vidro': { eixo: 'y', m: 0.42 },
  'cadeira-avulsa': { eixo: 'y', m: 0.8 },
  tapete: { eixo: 'x', m: 2.41 },
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

export async function carregarModelo(slug) {
  if (!cache.has(slug)) cache.set(slug, loader.loadAsync(`/assets/modelos/${slug}.glb`));
  const g = await cache.get(slug);
  const cena = SkeletonUtils.clone(g.scene); // preserva o esqueleto do monitor (modelo com rig)
  cena.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    o.material = o.material.clone();
    // vidro com "transmission" faz o three renderizar a cena duas vezes por quadro: caro demais
    // sem GPU dedicada. Vira vidro transparente com reflexo do ambiente (aparência parecida).
    if (o.material.transmission > 0) {
      Object.assign(o.material, { transmission: 0, transparent: true, opacity: 0.32, roughness: Math.min(o.material.roughness, 0.08), depthWrite: false });
      o.castShadow = false;
    }
    o.material = simplificar(o.material);
    padronizar(o);
  });
  return cena;
}

// caixa "precisa": em modelos com esqueleto (monitor), mede a pose atual dos ossos, não a de repouso
function medir(o) {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o, true);
}

// devolve um grupo com a base no chão (y = 0), centrado em x/z, na escala real
export function normalizar(obj, slug) {
  const med = MEDIDAS[slug];
  const raiz = new THREE.Group();
  if (med?.deitar) obj.rotation.x = -Math.PI / 2;
  if (med?.giro) obj.rotation.y = med.giro;
  raiz.add(obj);
  if (med) {
    const t = medir(raiz).getSize(new THREE.Vector3());
    const atual = med.eixo === 'maior' ? Math.max(t.x, t.y, t.z) : t[med.eixo];
    if (atual > 0) obj.scale.multiplyScalar(med.m / atual);
  }
  const c = medir(raiz);
  const centro = c.getCenter(new THREE.Vector3());
  obj.position.x -= centro.x; obj.position.z -= centro.z; obj.position.y -= c.min.y;
  return raiz;
}

// "colocador" para um cenário: põe o modelo em (x, z), girado, opcionalmente dentro de um grupo pai
// e registrando o obstáculo na grade de navegação.
export function criarColocador({ cena, grade, pendentes }) {
  return function porModelo(slug, x, z, rot = 0, { y = 0, pai = cena, obstaculo = true, folga = 0.2, aoCarregar } = {}) {
    const grupo = new THREE.Group();
    grupo.position.set(x, y, z);
    grupo.rotation.y = rot;
    pai.add(grupo);
    const p = carregarModelo(slug).then((m) => {
      const n = normalizar(m, slug);
      grupo.add(n);
      grupo.updateMatrixWorld(true);
      if (obstaculo) {
        const c = new THREE.Box3().setFromObject(grupo);
        bloquear(grade, c.min.x, c.min.z, c.max.x, c.max.z, folga);
      }
      aoCarregar?.(n, grupo);
      return grupo;
    }).catch((e) => { console.warn(`modelo ${slug} não carregou:`, e.message); return grupo; });
    pendentes.push(p);
    return grupo;
  };
}

// O modelo de caixas vem em par, lado a lado. Cada cópia mostra só uma metade (recorte por plano),
// assim fica uma caixa de cada lado do monitor. Chamar depois que o objeto está na posição final.
export function metade(n, lado) {
  n.updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3());
  const eixoX = new THREE.Vector3(1, 0, 0).applyQuaternion(n.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(eixoX.clone().multiplyScalar(-lado), c);
  n.traverse((o) => { if (o.isMesh) { o.material.clippingPlanes = [plano]; o.material.clipShadows = true; } });
}

// Material "físico" sem nenhum recurso físico em uso vira "standard": mesma aparência, shader bem menor.
// (Na medição de 02/10/2026, compilar shaders levava 25,8 s dos 29 s de carga da sala.)
function simplificar(m) {
  if (!m.isMeshPhysicalMaterial) return m;
  const usa = m.clearcoat > 0 || m.sheen > 0 || m.iridescence > 0 || m.transmission > 0 || m.dispersion > 0 || m.anisotropy > 0;
  if (usa) return m;
  const s = new THREE.MeshStandardMaterial().copy(m); // copy() da Standard leva só os campos que ela conhece
  s.name = m.name;
  m.dispose();
  return s;
}

// Menos variações de shader = menos programas para a placa compilar: o shader calcula as tangentes sozinho.
// (O lado das faces NÃO é mexido: dioramas como a Base do Mestre dependem de as paredes da frente
// só existirem por um lado — forçar os dois lados fechava o cômodo numa caixa.)
export function padronizar(o) {
  if (o.geometry.attributes.tangent) o.geometry.deleteAttribute('tangent');
}
