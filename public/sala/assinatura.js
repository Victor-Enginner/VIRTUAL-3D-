// Assinatura do autor: uma plaquinha de bronze sob o telão de LED, como a assinatura no canto de baixo de uma obra.
// O telão é o foco do olhar na Sala (o funil real) e o que aparece na prévia do link; a plaquinha fica logo abaixo,
// pequena, sem competir. É objeto, não animação: não se mexe, não brilha, não toca nada.
import * as THREE from 'three';

export const AUTOR = 'Victor Borsari';

export function criarAssinatura({ x = 0, y = 0.62, z, ano = 2026 } = {}) {
  const L = 1024, A = 256;
  const c = document.createElement('canvas');
  c.width = L; c.height = A;
  const g = c.getContext('2d');
  // chapa de bronze escovado
  const fundo = g.createLinearGradient(0, 0, 0, A);
  fundo.addColorStop(0, '#4a3b26'); fundo.addColorStop(0.5, '#33291a'); fundo.addColorStop(1, '#241c11');
  g.fillStyle = fundo; g.fillRect(0, 0, L, A);
  g.globalAlpha = 0.07;
  for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(0, (i * 37) % A, L, 1); } // fios do escovado, fixos (sem aleatório)
  g.globalAlpha = 1;
  // filetes dourados
  g.strokeStyle = '#c9a458'; g.lineWidth = 5; g.strokeRect(14, 14, L - 28, A - 28);
  g.strokeStyle = '#8a6d32'; g.lineWidth = 2; g.strokeRect(26, 26, L - 52, A - 52);
  // assinatura de punho (cursiva do sistema; cai em "cursive" se a fonte não existir)
  g.save();
  g.translate(L / 2, A / 2 + 6); g.rotate(-0.035);
  g.font = "italic 112px 'Segoe Script','Lucida Handwriting','Brush Script MT','Apple Chancery',cursive";
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 5; g.shadowOffsetY = 3;
  g.fillStyle = '#e6c675';
  g.fillText(AUTOR, 0, -8, L - 190);
  g.shadowColor = 'transparent';
  g.strokeStyle = '#e6c675'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-300, 58); g.bezierCurveTo(-120, 78, 120, 38, 310, 54); g.stroke(); // floreio sob o nome
  g.restore();
  g.font = "600 24px system-ui, sans-serif"; g.fillStyle = '#b9975a'; g.textAlign = 'right';
  g.fillText(String(ano), L - 52, A - 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const placa = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.425, 0.03), [
    new THREE.MeshStandardMaterial({ color: 0x241c11, roughness: 0.5, metalness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x241c11, roughness: 0.5, metalness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x241c11, roughness: 0.5, metalness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x241c11, roughness: 0.5, metalness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x241c11 }),
  ]);
  placa.position.set(x, y, z);
  placa.name = 'assinatura-do-autor';
  return placa;
}
