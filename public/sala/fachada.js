// Fachada de vidro do piso ao teto (blindex) nas paredes do fundo e da esquerda, no lugar das janelinhas do kit.
// Montantes de alumínio escovado, viga de topo com faixa de LED, rodapé escuro.
// Atrás do vidro: a foto "Paraíso Artificial" (fundo do Windows do Victor) como vista do prédio; sem a foto, um céu em degradê.
// Sobre o vidro: o vídeo de chuva em mistura aditiva (só os brilhos das gotas aparecem). Foto e vídeo são arquivos locais que não vão
// para o git; sem eles a fachada funciona do mesmo jeito. Nenhuma luz nova na cena (PointLight multiplicava o tempo de compilação).
import * as THREE from 'three';

function texturaCeu(noite) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  if (noite) { gr.addColorStop(0, '#060912'); gr.addColorStop(0.55, '#101a36'); gr.addColorStop(0.85, '#27355f'); gr.addColorStop(1, '#4a4f7a'); }
  else { gr.addColorStop(0, '#8fb8e6'); gr.addColorStop(0.6, '#bcd6ee'); gr.addColorStop(1, '#e9eff5'); }
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// vídeo de chuva como textura: 15 quadros por segundo bastam e cortam o envio de imagem para a placa de vídeo
function texturaChuva(url) {
  const video = document.createElement('video');
  video.src = url; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
  video.disablePictureInPicture = true; video.disableRemotePlayback = true;
  const t = new THREE.VideoTexture(video);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  let ultimo = 0;
  Object.defineProperty(t, 'needsUpdate', { set(v) { if (v !== true) return; const agora = performance.now(); if (agora - ultimo < 66) return; ultimo = agora; this.version++; } });
  // pausa com a aba escondida (e volta sozinha): não gasta decodificação à toa
  const tocar = () => { if (!document.hidden) video.play().catch(() => {}); else video.pause(); };
  document.addEventListener('visibilitychange', tocar);
  tocar();
  return t;
}

export function criarFachada(cena, { X0, X1, Z0, Z1, altura = 3.3, fundoUrl = null, chuvaUrl = null, animar = true }) {
  const vidro = new THREE.MeshPhysicalMaterial({ color: 0xc7e0f0, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6, depthWrite: false });
  const aluminio = new THREE.MeshStandardMaterial({ color: 0xa7b0ba, roughness: 0.32, metalness: 0.9 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5, metalness: 0.6 });
  const led = new THREE.MeshBasicMaterial({ color: 0xe6f1ff });
  const grupo = new THREE.Group();
  const caixa = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); grupo.add(m); return m; };

  // textura da chuva (uma só, repetida ao longo de cada parede) e material aditivo
  const chuva = chuvaUrl && animar ? texturaChuva(chuvaUrl) : null;
  const matChuva = chuva ? new THREE.MeshBasicMaterial({ map: chuva, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7, color: 0xffffff }) : null;

  for (const lado of ['fundo', 'esquerda']) {
    const comp = lado === 'fundo' ? X1 - X0 : Z1 - Z0;
    const eixoX = lado === 'fundo';
    const pos = (t, y, e = 0) => (eixoX ? [X0 + t, y, Z0 + 0.06 + e] : [X0 + 0.06 + e, y, Z0 + t]);
    const dim = (w, h, d) => (eixoX ? [w, h, d] : [d, h, w]);
    const [px, py, pz] = pos(comp / 2, altura / 2);
    caixa(...dim(comp, altura, 0.02), vidro, px, py, pz).renderOrder = 3;           // vidro corrido
    const n = Math.round(comp / 2.17);
    for (let i = 0; i <= n; i++) { const [x, y, z] = pos((i * comp) / n, altura / 2); caixa(...dim(0.06, altura, 0.1), aluminio, x, y, z); } // montantes
    { const [x, y, z] = pos(comp / 2, 0.07); caixa(...dim(comp, 0.14, 0.14), escuro, x, y, z); }                                         // rodapé escuro
    { const [x, y, z] = pos(comp / 2, altura - 0.13); caixa(...dim(comp, 0.26, 0.16), escuro, x, y, z); }                                // viga de topo
    { const [x, y, z] = pos(comp / 2, altura - 0.29, 0.02); caixa(...dim(comp, 0.022, 0.03), led, x, y, z); }                           // faixa de LED sob a viga
    if (matChuva) {
      // gotas coladas no vidro, por dentro: a textura se repete para a proporção 16:9 do vídeo não esticar
      const geo = new THREE.PlaneGeometry(comp, altura - 0.45);
      const m = new THREE.Mesh(geo, matChuva);
      const [x, y, z] = pos(comp / 2, (altura - 0.45) / 2 + 0.15, 0.05);
      m.position.set(x, y, z);
      if (!eixoX) m.rotation.y = Math.PI / 2;
      m.renderOrder = 4;
      grupo.add(m);
      // repete a textura: o plano é largo e baixo, o vídeo é 16:9
      geo.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = v * (comp / ((altura - 0.45) * (16 / 9))); });
      geo.attributes.uv.needsUpdate = true;
    }
  }
  caixa(0.42, altura, 0.42, escuro, X0 + 0.21, altura / 2, Z0 + 0.21); // pilar da quina
  cena.add(grupo);

  // vista atrás do vidro
  const noite = texturaCeu(true), dia = texturaCeu(false);
  const NOITE = new THREE.Color(0x394468), CLARO = new THREE.Color(0xffffff);

  // Com a foto: ela vira o FUNDO DA CENA (como um pano de fundo preso à tela, "cover"): o mar fica embaixo e as montanhas em cima,
  // do jeito que a foto foi tirada (de cima, olhando para a baía), e o vidro mostra esse mesmo fundo. Sem a foto: céu em degradê.
  if (fundoUrl) {
    const IA = 1672 / 941; // proporção da foto
    let foto = null, aspecto = 16 / 9;
    const enquadrar = () => {
      if (!foto) return;
      if (aspecto > IA) { foto.repeat.set(1, IA / aspecto); foto.offset.set(0, (1 - IA / aspecto) * 0.4); }   // tela mais larga: corta em cima (sobra mar embaixo)
      else { foto.repeat.set(aspecto / IA, 1); foto.offset.set((1 - aspecto / IA) * 0.5, 0); }                // tela mais estreita: corta dos lados
    };
    new THREE.TextureLoader().load(fundoUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      foto = t; enquadrar(); cena.background = foto;
    });
    return {
      ajustarAspecto(a) { aspecto = a; enquadrar(); },
      // de dia a foto aparece inteira; à noite a mesma foto escurece (intensidade do fundo), sem trocar de imagem
      aplicarHora(valorDia) {
        if (foto) { cena.background = foto; cena.backgroundIntensity = 0.42 + 0.58 * Math.min(1, valorDia * 1.6); }
        if (matChuva) matChuva.opacity = 0.45 + 0.35 * (1 - valorDia);
      },
    };
  }

  const matFundo = new THREE.MeshBasicMaterial({ map: noite, fog: false, depthWrite: false });
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 14, 30), matFundo);
  fundo.position.set((X0 + X1) / 2 - 4, 11, Z0 - 8);
  const esquerda = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0 + 14, 30), matFundo);
  esquerda.position.set(X0 - 8, 11, (Z0 + Z1) / 2 + 4); esquerda.rotation.y = Math.PI / 2;
  cena.add(fundo, esquerda);
  return {
    ajustarAspecto() {},
    aplicarHora(valorDia) {
      const m = valorDia > 0.35 ? dia : noite;
      if (matFundo.map !== m) { matFundo.map = m; matFundo.needsUpdate = true; }
      if (matChuva) matChuva.opacity = 0.45 + 0.35 * (1 - valorDia);
    },
  };
}
