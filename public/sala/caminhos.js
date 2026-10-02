// Navegação dos personagens: grade de ocupação construída a partir dos móveis + A*.
// Módulo puro (sem three.js) para rodar também nos testes do Node.

export function criarGrade({ largura, profundidade, celula = 0.5, origemX = -largura / 2, origemZ = -profundidade / 2 }) {
  const cols = Math.ceil(largura / celula), lins = Math.ceil(profundidade / celula);
  return { cols, lins, celula, origemX, origemZ, bloqueado: new Uint8Array(cols * lins) };
}

export const paraCelula = (g, x, z) => [Math.floor((x - g.origemX) / g.celula), Math.floor((z - g.origemZ) / g.celula)];
export const paraMundo = (g, c, l) => [g.origemX + (c + 0.5) * g.celula, g.origemZ + (l + 0.5) * g.celula];
const dentro = (g, c, l) => c >= 0 && l >= 0 && c < g.cols && l < g.lins;
export const livre = (g, c, l) => dentro(g, c, l) && !g.bloqueado[l * g.cols + c];

// Marca um retângulo (em metros, alinhado aos eixos) como obstáculo, com folga para o corpo passar.
export function bloquear(g, minX, minZ, maxX, maxZ, folga = 0.25) {
  const [c0, l0] = paraCelula(g, minX - folga, minZ - folga);
  const [c1, l1] = paraCelula(g, maxX + folga, maxZ + folga);
  for (let l = Math.max(0, l0); l <= Math.min(g.lins - 1, l1); l++)
    for (let c = Math.max(0, c0); c <= Math.min(g.cols - 1, c1); c++) g.bloqueado[l * g.cols + c] = 1;
}

export function liberar(g, x, z, raio = 0.5) {
  const [c0, l0] = paraCelula(g, x - raio, z - raio), [c1, l1] = paraCelula(g, x + raio, z + raio);
  for (let l = Math.max(0, l0); l <= Math.min(g.lins - 1, l1); l++)
    for (let c = Math.max(0, c0); c <= Math.min(g.cols - 1, c1); c++) g.bloqueado[l * g.cols + c] = 0;
}

// Célula livre mais próxima (busca em anéis); destinos dentro de móvel viram o ponto acessível mais perto.
export function celulaLivreProxima(g, c, l, raioMax = 12) {
  if (livre(g, c, l)) return [c, l];
  for (let r = 1; r <= raioMax; r++)
    for (let dl = -r; dl <= r; dl++)
      for (let dc = -r; dc <= r; dc++)
        if (Math.max(Math.abs(dc), Math.abs(dl)) === r && livre(g, c + dc, l + dl)) return [c + dc, l + dl];
  return null;
}

const VIZ = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// A* com 8 vizinhos; diagonal só se as duas laterais estão livres (não corta quina de móvel).
export function buscarCaminho(g, de, para) {
  const a = celulaLivreProxima(g, ...paraCelula(g, de[0], de[1]));
  const b = celulaLivreProxima(g, ...paraCelula(g, para[0], para[1]));
  if (!a || !b) return null;
  const id = (c, l) => l * g.cols + c;
  const h = (c, l) => Math.hypot(c - b[0], l - b[1]);
  const custo = new Float64Array(g.cols * g.lins).fill(Infinity);
  const veio = new Int32Array(g.cols * g.lins).fill(-1);
  const aberto = [[h(...a), a[0], a[1]]];
  custo[id(...a)] = 0;
  while (aberto.length) {
    let mi = 0;
    for (let i = 1; i < aberto.length; i++) if (aberto[i][0] < aberto[mi][0]) mi = i;
    const [, c, l] = aberto.splice(mi, 1)[0];
    if (c === b[0] && l === b[1]) {
      const cel = [];
      for (let k = id(c, l); k !== -1; k = veio[k]) cel.push([k % g.cols, Math.floor(k / g.cols)]);
      cel.reverse();
      const pontos = suavizar(g, cel).map(([cc, ll]) => paraMundo(g, cc, ll));
      pontos[pontos.length - 1] = [para[0], para[1]];
      return pontos;
    }
    for (const [dc, dl, w] of VIZ) {
      const nc = c + dc, nl = l + dl;
      if (!livre(g, nc, nl)) continue;
      if (dc && dl && (!livre(g, c + dc, l) || !livre(g, c, l + dl))) continue;
      const nk = id(nc, nl), novo = custo[id(c, l)] + w;
      if (novo < custo[nk]) { custo[nk] = novo; veio[nk] = id(c, l); aberto.push([novo + h(nc, nl), nc, nl]); }
    }
  }
  return null;
}

// Linha de visada na grade (supercover): se o segmento só passa por células livres, dá para ir reto.
export function visada(g, [c0, l0], [c1, l1]) {
  const passos = Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(l1 - l0)) * 3) || 1;
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    const x = c0 + (c1 - c0) * t + 0.5, z = l0 + (l1 - l0) * t + 0.5;
    for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]])
      if (!livre(g, Math.floor(x + ox), Math.floor(z + oz))) return false;
  }
  return true;
}

// Remove pontos intermediários quando há visada direta: o personagem anda em retas naturais.
export function suavizar(g, cel) {
  if (cel.length <= 2) return cel;
  const out = [cel[0]];
  let i = 0;
  while (i < cel.length - 1) {
    let j = cel.length - 1;
    while (j > i + 1 && !visada(g, cel[i], cel[j])) j--;
    out.push(cel[j]);
    i = j;
  }
  return out;
}
