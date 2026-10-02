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

// Painel LED da parede: funil real e quem está trabalhando. A grade escura por cima simula a
// matriz de LEDs (de perto se vê o "pixel"); de longe lê como uma tela acesa.
export function desenharPainelLed(painel, estado) {
  if (!estado) return;
  const g = painel.canvas.getContext('2d');
  const W = painel.canvas.width, H = painel.canvas.height;
  g.fillStyle = '#05070b'; g.fillRect(0, 0, W, H);
  const f = estado.funil || {}, s = estado.situacoes || {};
  const soma = (...k) => k.reduce((a, x) => a + (f[x] || 0), 0);
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  const oportunidade = Object.entries(s).filter(([k]) => k !== 'site_proprio').reduce((a, [, n]) => a + n, 0);
  const etapas = [[total, 'encontrados'], [oportunidade, 'site fraco'], [soma('mensagem', 'aprovado', 'enviado', 'respondeu', 'sem_resposta'), 'mensagens'],
    [soma('enviado', 'respondeu', 'sem_resposta'), 'enviados'], [f.respondeu || 0, 'responderam']];
  g.fillStyle = '#948a7b'; g.font = '500 26px "Bricolage Grotesque", system-ui, sans-serif';
  g.fillText('Funil de prospecção', 40, 58);
  const trabalhando = Object.values(estado.agentes || {}).filter((a) => a.status === 'trabalhando');
  g.textAlign = 'right';
  g.fillStyle = trabalhando.length ? '#4ad69a' : '#948a7b';
  g.fillText(estado.pausado ? 'agentes pausados' : trabalhando.length ? `${trabalhando.map((a) => a.nome).join(', ')} trabalhando` : 'equipe ociosa', W - 40, 58);
  g.textAlign = 'left';
  const col = (W - 80) / etapas.length;
  etapas.forEach(([n, rot], i) => {
    const x = 40 + i * col;
    g.fillStyle = i === etapas.length - 1 && n ? '#ffc98c' : '#f3eee5';
    g.font = '600 120px "Bricolage Grotesque", system-ui, sans-serif';
    g.fillText(String(n), x, 250);
    g.fillStyle = '#948a7b'; g.font = '400 26px "Bricolage Grotesque", system-ui, sans-serif';
    g.fillText(rot, x + 4, 300);
  });
  g.fillStyle = '#1b1e26'; g.fillRect(40, 350, W - 80, 2);
  g.fillStyle = '#948a7b'; g.font = '400 22px "JetBrains Mono", ui-monospace, monospace';
  const e = estado.envio || {};
  g.fillText(`envios hoje ${e.enviados_hoje ?? 0}/${e.limite ?? 10}  ·  na fila ${e.na_fila ?? 0}  ·  para aprovar ${f.mensagem || 0}`, 40, 396);
  // matriz de LEDs
  g.fillStyle = 'rgba(0,0,0,0.38)';
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  painel.textura.needsUpdate = true;
}
