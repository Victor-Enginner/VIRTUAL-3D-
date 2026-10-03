// Tela de cada monitor: um canvas desenhado com o que o agente está fazendo DE VERDADE
// (tarefa atual e as últimas linhas de evento dele). Pausado = tela apagada.
import * as THREE from 'three';

export function criarTela(cor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 320;
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: textura, toneMapped: false });
  return { canvas, textura, material, cor, ultimo: '' };
}

function quebrar(g, texto, largura) {
  const palavras = String(texto).split(' '), linhas = [];
  let l = '';
  for (const p of palavras) {
    const t = l ? `${l} ${p}` : p;
    if (g.measureText(t).width > largura && l) { linhas.push(l); l = p; } else l = t;
  }
  if (l) linhas.push(l);
  return linhas;
}

export function desenharTela(tela, { nome, estado, tarefa, linhas = [], relogio = 0 }) {
  const chave = `${estado}|${tarefa}|${linhas.join('|')}|${estado === 'trabalhando' ? Math.floor(relogio * 2) : ''}`;
  if (chave === tela.ultimo) return;
  tela.ultimo = chave;
  const g = tela.canvas.getContext('2d');
  const W = tela.canvas.width, H = tela.canvas.height;
  if (estado === 'desligado') {
    g.fillStyle = '#050507'; g.fillRect(0, 0, W, H);
    tela.textura.needsUpdate = true;
    return;
  }
  g.fillStyle = '#0f1117'; g.fillRect(0, 0, W, H);
  g.fillStyle = tela.cor; g.fillRect(0, 0, W, 34);
  g.fillStyle = '#fff'; g.font = '600 20px system-ui, sans-serif';
  g.fillText(`${nome} · ${estado === 'trabalhando' ? 'trabalhando' : estado === 'na_mesa' ? 'aguardando tarefa' : 'fora da mesa'}`, 14, 24);

  g.font = '600 22px system-ui, sans-serif';
  g.fillStyle = '#e8e8f0';
  const linhasTarefa = quebrar(g, tarefa || 'Sem tarefa agora', W - 28).slice(0, 2);
  linhasTarefa.forEach((l, i) => g.fillText(l, 14, 70 + i * 28));

  g.font = '16px ui-monospace, Consolas, monospace';
  g.fillStyle = '#8fd19e';
  linhas.slice(0, 6).forEach((l, i) => g.fillText(`> ${l}`.slice(0, 54), 14, 150 + i * 24));
  if (estado === 'trabalhando' && Math.floor(relogio * 2) % 2) {
    g.fillStyle = '#8fd19e'; g.fillRect(14 + 9.6 * 2, 150 + Math.min(linhas.length, 6) * 24 - 14, 10, 18); // cursor piscando
  }
  tela.textura.needsUpdate = true;
}
