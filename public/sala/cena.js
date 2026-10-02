// Escritório montado com os modelos GLB do Kenney Furniture Kit (CC0, public/assets/kenney/License.txt).
// O kit é modelado em escala ~1:2 (porta = 1,01); ESCALA_KIT = 2 deixa tudo em metros reais.
// Cada modelo é "aterrado" pela caixa delimitadora (ideia do 3D-World-Creator: min.y vira 0).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bloquear, buscarCaminho, criarGrade } from './caminhos.js';
import { criarColocador, metade } from './modelos.js';

const ESCALA_KIT = 2;
const LARGURA = 26, PROFUNDIDADE = 18, ALTURA_PAREDE = 2.6;
const X0 = -LARGURA / 2, X1 = LARGURA / 2, Z0 = -PROFUNDIDADE / 2, Z1 = PROFUNDIDADE / 2;

// Rotação extra por modelo para que a "frente" de todos aponte para +Z (ajustada olhando a cena).
const FRENTE = { computerScreen: Math.PI, chairDesk: Math.PI, desk: 0, laptop: Math.PI };

const cache = new Map();
const loader = new GLTFLoader();
async function modelo(nome) {
  if (!cache.has(nome)) cache.set(nome, loader.loadAsync(`/assets/kenney/${nome}.glb`).then((g) => g.scene));
  const base = await cache.get(nome);
  const m = base.clone(true);
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return m;
}

export function criarEscritorio(cena, cores) {
  const grade = criarGrade({ largura: LARGURA, profundidade: PROFUNDIDADE, celula: 0.5 });
  const pendentes = [];
  const porModelo = criarColocador({ cena, grade, pendentes });

  // coloca um modelo: posição no chão (x, z), rotação em Y, escala extra; opcionalmente vira obstáculo
  function por(nome, x, z, rot = 0, { y = 0, escala = 1, obstaculo = true, folga = 0.2 } = {}) {
    const grupo = new THREE.Group();
    grupo.position.set(x, y, z);
    grupo.rotation.y = rot;
    cena.add(grupo);
    const p = modelo(nome).then((m) => {
      m.scale.setScalar(ESCALA_KIT * escala);
      m.rotation.y = FRENTE[nome] || 0;
      const caixa = new THREE.Box3().setFromObject(m);
      m.position.y -= caixa.min.y;
      // centraliza no ponto pedido (os modelos do kit têm a origem num canto)
      const centro = caixa.getCenter(new THREE.Vector3());
      m.position.x -= centro.x; m.position.z -= centro.z;
      grupo.add(m);
      grupo.updateMatrixWorld(true);
      if (obstaculo) {
        const c = new THREE.Box3().setFromObject(grupo);
        bloquear(grade, c.min.x, c.min.z, c.max.x, c.max.z, folga);
      }
      return grupo;
    }).catch((e) => { console.warn(`modelo ${nome} não carregou:`, e.message); return grupo; });
    pendentes.push(p);
    grupo.userData.pronto = p;
    return grupo;
  }

  // ---------------- casca: piso, paredes com janelas, vidros ----------------
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(LARGURA, PROFUNDIDADE), new THREE.MeshStandardMaterial({ map: texturaTacos(cores), roughness: 0.62, metalness: 0.02 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  cena.add(piso);

  const matParede = new THREE.MeshStandardMaterial({ color: cores.parede, roughness: 0.92 });
  const parede = (w, d, x, z, h = ALTURA_PAREDE) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matParede);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    cena.add(m);
    bloquear(grade, x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.15);
    return m;
  };
  // fundo e lateral esquerda: segmentos de parede com janela do kit (2 m cada)
  const janelas = [];
  for (let x = X0 + 1; x < X1; x += 2) janelas.push(por('wallWindow', x, Z0 + 0.09, 0, { obstaculo: false }));
  for (let z = Z0 + 1; z < Z1; z += 2) janelas.push(por('wallWindow', X0 + 0.09, z, Math.PI / 2, { obstaculo: false }));
  bloquear(grade, X0, Z0, X1, Z0 + 0.3, 0);
  bloquear(grade, X0, Z0, X0 + 0.3, Z1, 0);
  // lateral direita com porta (as mensagens saem por ela)
  const PORTA_Z = 6.2;
  // parede voltada para a câmera fica baixa (corte "casa de bonecas"), senão tapa a copa
  const BAIXA = 0.55;
  parede(0.2, PORTA_Z - 1.1 - Z0, X1, (Z0 + PORTA_Z - 1.1) / 2, BAIXA);
  parede(0.2, Z1 - (PORTA_Z + 1.1), X1, (PORTA_Z + 1.1 + Z1) / 2, BAIXA);
  const soleira = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 2.2), new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.7 }));
  soleira.position.set(X1, 0.01, PORTA_Z);
  cena.add(soleira);

  // vidro: IOR 1,52, quase sem rugosidade, leve tom verde-azulado e reflexo do ambiente (envMap da cena).
  // Sem "transmission": ela renderiza a cena duas vezes por quadro, caro demais sem GPU dedicada.
  const vidro = new THREE.MeshPhysicalMaterial({ color: 0xe3eff2, transparent: true, opacity: 0.2, roughness: 0.03, metalness: 0, ior: 1.52, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, depthWrite: false });
  const perfil = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.22, metalness: 1 }); // alumínio escovado
  function divisoria(x0, z0, x1, z1) {
    const comp = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    g.rotation.y = -ang;
    const painel = new THREE.Mesh(new THREE.BoxGeometry(comp, 2.3, 0.04), vidro);
    painel.position.y = 1.15;
    g.add(painel);
    for (const [w, h, y] of [[comp, 0.06, 2.3], [comp, 0.06, 0.03]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), perfil); b.position.y = y; g.add(b); }
    for (let i = 0; i <= Math.round(comp / 1.5); i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.3, 0.07), perfil); m.position.set(-comp / 2 + (i * comp) / Math.round(comp / 1.5), 1.15, 0); g.add(m); }
    cena.add(g);
    bloquear(grade, Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.15);
  }
  // sala de reunião (fundo esquerdo), com vão de porta
  divisoria(-7, Z0, -7, -4.6); divisoria(X0, -3, -9.6, -3); divisoria(-8.2, -3, -7, -3); divisoria(-7, -3, -7, -3.6);

  // ---------------- postos de trabalho (modelos do Victor) ----------------
  // Parecidos, nunca idênticos (guia de colocação). Os nomes dos arquivos definem: teclado mecânico
  // azul em 2 agentes, celular Xiaomi na mesa de 3, iPhone nas outras.
  const KIT = {
    atlas: { teclado: 'teclado-mecanico-azul', celular: 'celular-xiaomi', som: 'caixas-som', extras: ['lata-monster', 'airpods'] },
    nova: { teclado: 'teclado-vortex', celular: 'celular-xiaomi', som: 'caixas-razer', extras: ['airpods'] },
    maia: { teclado: 'teclado-mecanico-azul', celular: 'celular-iphone-nc', som: 'caixas-som', extras: ['planta'] },
    leo: { teclado: 'teclado-vortex', celular: 'celular-xiaomi', som: 'caixas-razer', extras: ['lata-monster'] },
    alva: { teclado: 'teclado-vortex', celular: 'celular-iphone-nc', som: null, extras: ['airpods', 'planta'] },
    padrao: { teclado: 'teclado-vortex', celular: 'celular-iphone-nc', som: 'caixas-som', extras: [] },
  };
  const TAMPO = 0.75;
  const postos = {};
  function posto(id, x, z, rot) {
    const kit = KIT[id] || KIT.padrao;
    const frente = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const mesa = new THREE.Vector3(x, 0, z).addScaledVector(frente, 0.72);
    // grupo da mesa: o +z local aponta para o agente
    const g = new THREE.Group();
    g.position.copy(mesa);
    g.rotation.y = rot + Math.PI;
    cena.add(g);
    const p = { assento: { x, z, rot }, mesa, tela: null, luz: null, cadeira: null };
    porModelo('mesa-moderna', 0, 0, 0, { pai: g, obstaculo: false });
    // obstáculo da mesa: retângulo do tampo (~1,6 × 0,6 m) girado conforme o posto
    const meiaX = Math.abs(Math.cos(rot)) * 0.82 + Math.abs(Math.sin(rot)) * 0.32, meiaZ = Math.abs(Math.sin(rot)) * 0.82 + Math.abs(Math.cos(rot)) * 0.32;
    bloquear(grade, mesa.x - meiaX, mesa.z - meiaZ, mesa.x + meiaX, mesa.z + meiaZ, 0.12);
    porModelo('monitor-iiyama-nc', 0, -0.12, -Math.PI / 2, { pai: g, y: TAMPO, obstaculo: false,
      aoCarregar: (n) => {
        // a tela do agente é um plano nosso sobre a malha 'screen' do monitor: orientação garantida,
        // sem depender do UV de cada modelo
        let screen = null;
        n.traverse((o) => { if (o.isMesh && o.material?.name === 'screen') screen = o; });
        if (!screen) return;
        g.updateMatrixWorld(true);
        const caixa = new THREE.Box3().setFromObject(screen, true).applyMatrix4(g.matrixWorld.clone().invert());
        const t = caixa.getSize(new THREE.Vector3()), c = caixa.getCenter(new THREE.Vector3());
        const plano = new THREE.Mesh(new THREE.PlaneGeometry(t.x * 0.97, t.y * 0.95));
        plano.position.set(c.x, c.y, caixa.max.z + 0.003);
        g.add(plano);
        p.tela = plano;
      } });
    porModelo(kit.teclado, 0, 0.13, 0, { pai: g, y: TAMPO, obstaculo: false });
    porModelo(kit.celular, 0.5, 0.15, 0.25, { pai: g, y: TAMPO, obstaculo: false });
    if (kit.som) for (const lado of [-1, 1]) porModelo(kit.som, lado * 0.48, -0.12, -lado * 0.15, { pai: g, y: TAMPO, obstaculo: false, aoCarregar: (n) => metade(n, lado) });
    // extras: até dois objetos pessoais, em cantos diferentes da mesa
    kit.extras.forEach((ex, i) => {
      const [ex_x, ex_z] = [[-0.6, 0.14], [0.66, -0.14]][i];
      if (ex === 'planta') {
        const pl = por(['plantSmall1', 'plantSmall2', 'plantSmall3'][Object.keys(postos).length % 3], 0, 0, 0, { obstaculo: false, escala: 0.9 });
        g.add(pl);
        pl.position.set(ex_x, TAMPO, ex_z);
      } else porModelo(ex, ex_x, ex_z, 0.4, { pai: g, y: TAMPO, obstaculo: false });
    });
    porModelo('gabinete-pc', 0.6, -0.05, 0, { pai: g, obstaculo: false }); // no chão, sob o canto direito
    if (id !== 'alva') porModelo('lixeira', -0.98, 0.15, 0, { pai: g, obstaculo: false });
    const luz = new THREE.PointLight(0xffe2b8, 0, 3.2, 2);
    luz.position.set(0, 1.5, 0.15);
    g.add(luz);
    p.luz = luz;
    p.cadeira = porModelo('cadeira-gamer', x, z, rot + Math.PI, { obstaculo: false });
    postos[id] = p;
    return p;
  }
  posto('atlas', -4.6, -4.4, Math.PI);
  posto('nova', -1.55, -4.4, Math.PI);
  posto('maia', 1.55, -4.4, Math.PI);
  posto('leo', 4.6, -4.4, Math.PI);
  posto('alva', 9.4, 6.6, -Math.PI / 2);
  por('sideTableDrawers', -6.4, -6.6, 0);
  por('pottedPlant', 6.0, -8.2, 0);
  por('pottedPlant', -6.3, -8.2, 0);

  // ---------------- área de espera (canto do fundo à direita) ----------------
  // a Base do Mestre agora é um lugar à parte (/base.html); aqui fica a recepção de visitas
  porModelo('tapete', X1 - 3.0, Z0 + 3.0, 0, { obstaculo: false });
  porModelo('mesa-centro-vidro', X1 - 3.0, Z0 + 3.0, 0);
  porModelo('cadeira-avulsa', X1 - 4.4, Z0 + 2.4, Math.PI / 2.4, { folga: 0.1 });
  porModelo('cadeira-avulsa', X1 - 4.4, Z0 + 3.7, Math.PI / 1.7, { folga: 0.1 });
  porModelo('cadeira-branca', X1 - 1.6, Z0 + 2.4, -Math.PI / 2.4, { folga: 0.1 });
  porModelo('cadeira-branca', X1 - 1.6, Z0 + 3.7, -Math.PI / 1.7, { folga: 0.1 });
  por('pottedPlant', X1 - 0.6, Z0 + 0.6, 0);
  por('bookcaseClosedWide', X1 - 3.0, Z0 + 0.35, 0);
  // o "operador" (você) não tem mesa no escritório: o que vai para você sai pela porta, rumo à Base
  postos.operador = { assento: { x: X1 - 1.2, z: PORTA_Z, rot: -Math.PI / 2 }, mesa: new THREE.Vector3(X1 + 0.6, 0, PORTA_Z), tela: null, luz: null, cadeira: null };

  // ---------------- sala de reunião ----------------
  por('rugRectangle', -10, -6, 0, { obstaculo: false, escala: 1.3 });
  porModelo('mesa-reuniao', -10, -6, 0);
  porModelo('maquete-predio', -10, -6, 0.3, { y: 0.75, obstaculo: false });
  for (const [dx, dz, r] of [[-0.45, -0.85, 0], [0.45, -0.85, 0], [-0.45, 0.85, Math.PI], [0.45, 0.85, Math.PI]])
    porModelo('cadeira-anos60', -10 + dx, -6 + dz, r, { obstaculo: false });
  por('televisionModern', -10, Z0 + 0.45, 0, { y: 0.9, obstaculo: false, escala: 1.6 });
  por('speaker', -12.4, -8.4, 0);

  // ---------------- biblioteca (parede esquerda) ----------------
  for (const z of [-1.2, 0.4, 2, 3.6]) por(z === 0.4 || z === 3.6 ? 'bookcaseOpen' : 'bookcaseClosedWide', X0 + 0.5, z, Math.PI / 2);
  por('books', X0 + 0.55, 0.4, Math.PI / 2, { y: 0.9, obstaculo: false });
  por('lampSquareFloor', -11.6, 5.4, 0);
  por('loungeDesignChair', -10.6, 5.6, Math.PI * 0.8);
  por('rugRound', -10.4, 2.2, 0, { obstaculo: false });
  por('sideTable', -9.4, 5.9, 0);

  // ---------------- lounge (frente, centro) ----------------
  porModelo('tapete', -1, 5.5, 0, { obstaculo: false });
  por('sideTable', -1, 2.6, 0);
  por('televisionModern', -1, 2.55, 0, { y: 0.76, obstaculo: false });
  porModelo('xbox', -0.2, 2.6, 0, { y: 0.76, obstaculo: false });
  for (const lado of [-1, 1]) porModelo('caixa-pedestal', -1 + lado * 1.35, 2.75, 0, { aoCarregar: (n) => metade(n, lado) }); // o modelo é um par
  porModelo('mesa-principal', -1, 5.3, Math.PI / 2);
  porModelo('caixa-jbl', -1.55, 2.62, 0.5, { y: 0.76, obstaculo: false });
  por('loungeSofa', -2.1, 7.2, Math.PI);
  por('loungeSofa', 0.1, 7.2, Math.PI);
  por('loungeChair', -4.2, 5.2, Math.PI / 2);
  por('loungeChair', 2.2, 5.2, -Math.PI / 2);
  por('pottedPlant', -5.4, 8.2, 0);
  por('pottedPlant', 3.4, 8.2, 0);
  por('lampSquareFloor', 3.4, 6.6, 0);

  // ---------------- copa (direita) ----------------
  for (const z of [-1.6, -0.74, 0.12, 0.98, 1.84]) por('kitchenCabinet', X1 - 0.6, z, -Math.PI / 2);
  for (const z of [-1.6, -0.74, 0.12, 0.98, 1.84]) por('kitchenCabinetUpper', X1 - 0.35, z, -Math.PI / 2, { y: 1.55, obstaculo: false });
  por('kitchenSink', X1 - 0.6, 2.7, -Math.PI / 2);
  por('kitchenFridge', X1 - 0.55, -2.55, -Math.PI / 2);
  por('kitchenCoffeeMachine', X1 - 0.7, 0.1, -Math.PI / 2, { y: 0.9, obstaculo: false });
  por('kitchenMicrowave', X1 - 0.65, 1.3, -Math.PI / 2, { y: 0.9, obstaculo: false });
  por('tableRound', 9, 0.6, 0);
  for (const [dx, dz, r] of [[0, -0.95, 0], [0, 0.95, Math.PI], [-0.95, 0, Math.PI / 2]]) por('stoolBar', 9 + dx, 0.6 + dz, r, { obstaculo: false });
  por('trashcan', X1 - 0.6, 3.55, 0, { escala: 0.7 });
  porModelo('caixa-bluetooth', X1 - 0.6, -0.74, -Math.PI / 2, { y: 0.9, obstaculo: false });
  porModelo('lata-monster', 9.1, 0.5, 0, { y: 0.74, obstaculo: false });

  // recepção: plantas e cabideiro perto da porta
  por('coatRackStanding', X1 - 0.6, 4.2, 0);
  por('pottedPlant', X1 - 0.6, 8.3, 0);

  // pontos de interesse onde os agentes param (posição + direção do olhar)
  const pontos = {
    copa: [{ x: X1 - 1.7, z: 0.1, rot: Math.PI / 2 }, { x: X1 - 1.7, z: 1.2, rot: Math.PI / 2 }, { x: 8.2, z: 1.5, rot: Math.PI * 0.75 }, { x: 9.8, z: 1.6, rot: -Math.PI * 0.75 }],
    janela: [{ x: -2.8, z: Z0 + 1.0, rot: Math.PI }, { x: 2.8, z: Z0 + 1.0, rot: Math.PI }, { x: X0 + 1.0, z: 6.8, rot: -Math.PI / 2 }],
    biblioteca: [{ x: X0 + 1.6, z: -0.4, rot: -Math.PI / 2 }, { x: X0 + 1.6, z: 2.8, rot: -Math.PI / 2 }],
    lounge: [{ x: -3.2, z: 4.0, rot: Math.PI * 0.7 }, { x: 1.2, z: 4.0, rot: -Math.PI * 0.7 }],
    sofa: [{ x: -2.6, z: 7.15, rot: Math.PI, senta: true }, { x: -1.6, z: 7.15, rot: Math.PI, senta: true }, { x: -0.4, z: 7.15, rot: Math.PI, senta: true },
      { x: 0.6, z: 7.15, rot: Math.PI, senta: true }, { x: -4.2, z: 5.2, rot: Math.PI / 2, senta: true }],
    tv: [{ x: -8.6, z: -7.9, rot: Math.PI * 0.15 }],
  };

  // painel LED de parede (fundo, centro): mostra o funil real — 3D com função, não decoração
  const canvasPainel = document.createElement('canvas');
  canvasPainel.width = 1024; canvasPainel.height = 448;
  const texturaPainel = new THREE.CanvasTexture(canvasPainel);
  texturaPainel.colorSpace = THREE.SRGBColorSpace;
  texturaPainel.anisotropy = 4;
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(3.36, 1.52, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.3, metalness: 1 }));
  moldura.position.set(0, 1.62, Z0 + 0.22);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), new THREE.MeshBasicMaterial({ map: texturaPainel, toneMapped: false }));
  tela.position.set(0, 1.62, Z0 + 0.255);
  cena.add(moldura, tela);
  // faixa de LED difusa no topo das divisórias de vidro (perfil de alumínio aceso)
  const led = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdfe8ff, emissiveIntensity: 0.9 });
  for (const [x0, x1, z0, z1] of [[X0, -7, -3, -3], [-7, -7, Z0, -3], [7, 7, Z0, -3], [7, X1, -3, -3]]) {
    const comp = Math.hypot(x1 - x0, z1 - z0);
    const f = new THREE.Mesh(new THREE.BoxGeometry(comp, 0.02, 0.03), led);
    f.position.set((x0 + x1) / 2, 2.34, (z0 + z1) / 2);
    f.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    cena.add(f);
  }

  // agentes criados no Configurador ganham mesa na segunda fileira de operações
  const VAGAS = [[-4.6, -0.6], [-1.55, -0.6], [1.55, -0.6], [4.6, -0.6]];
  const ocupadas = new Map();
  function adicionarPosto(id) {
    if (postos[id]) return postos[id];
    const vaga = VAGAS.find((v) => ![...ocupadas.values()].includes(v));
    if (!vaga) return null;
    ocupadas.set(id, vaga);
    posto(id, vaga[0], vaga[1], Math.PI);
    return postos[id];
  }

  // ---------------- OfficeBot: patrulha a sala entre os pontos de interesse ----------------
  const robo = { grupo: null, caminho: null, espera: 2, passo: 0 };
  porModelo('officebot-nc', X1 - 2.2, 4.6, -Math.PI / 2, { obstaculo: false, aoCarregar: (_n, grupo) => { robo.grupo = grupo; } });
  const ROTA_ROBO = [...pontos.copa, ...pontos.lounge, ...pontos.biblioteca, ...pontos.janela, { x: 0, z: -1.6 }, { x: X1 - 2.2, z: 4.6 }];
  const giroRobo = new THREE.Quaternion(), eixoY = new THREE.Vector3(0, 1, 0);
  function atualizar(dt, t) {
    const g = robo.grupo;
    if (!g) return;
    if (robo.espera > 0) {
      robo.espera -= dt;
      g.rotation.z = Math.sin(t * 1.3) * 0.015; // parado, "respira"
      return;
    }
    if (!robo.caminho) {
      const alvo = ROTA_ROBO[Math.floor(Math.random() * ROTA_ROBO.length)];
      robo.caminho = buscarCaminho(grade, [g.position.x, g.position.z], [alvo.x + 0.8, alvo.z + 0.8]);
      if (!robo.caminho) { robo.espera = 2; return; }
    }
    const [tx, tz] = robo.caminho[0];
    const dx = tx - g.position.x, dz = tz - g.position.z, dist = Math.hypot(dx, dz), vel = 0.75 * dt;
    if (dist <= vel) {
      g.position.x = tx; g.position.z = tz;
      robo.caminho.shift();
      if (!robo.caminho.length) { robo.caminho = null; robo.espera = 3 + Math.random() * 6; }
      return;
    }
    g.position.x += (dx / dist) * vel; g.position.z += (dz / dist) * vel;
    giroRobo.setFromAxisAngle(eixoY, Math.atan2(dx, dz));
    g.quaternion.slerp(giroRobo, Math.min(1, dt * 4));
    robo.passo += dt * 6;
    g.position.y = Math.abs(Math.sin(robo.passo)) * 0.025; // passada das pernas
  }

  return { grade, postos, pontos, janelas, adicionarPosto, atualizar, painel: { canvas: canvasPainel, textura: texturaPainel }, vagas: VAGAS.length, porta: new THREE.Vector3(X1 + 0.6, 1.2, PORTA_Z), pronto: Promise.all(pendentes) };
}

// piso de tacos: tábuas com tons levemente diferentes e juntas escuras, desenhado no canvas
function texturaTacos(cores) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const base = new THREE.Color(cores.piso);
  const linhas = 16, compTabua = 256;
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let l = 0; l < linhas; l++) {
    const desloc = (l % 2) * (compTabua / 2) + rnd() * 60;
    for (let x = -compTabua; x < 1024 + compTabua; x += compTabua) {
      const t = base.clone().offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.1);
      g.fillStyle = `#${t.getHexString()}`;
      g.fillRect(x + desloc, l * 64, compTabua - 3, 61);
      g.globalAlpha = 0.06;
      for (let k = 0; k < 6; k++) { g.fillStyle = rnd() > 0.5 ? '#000' : '#fff'; g.fillRect(x + desloc, l * 64 + rnd() * 60, compTabua - 3, 1 + rnd() * 2); }
      g.globalAlpha = 1;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(LARGURA / 8, PROFUNDIDADE / 8);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
