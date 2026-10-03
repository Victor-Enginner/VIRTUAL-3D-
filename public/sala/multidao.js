// Movimento dos agentes como multidão por posição (Position-Based Dynamics), seguindo
// Weiss et al., "Position-Based Multi-Agent Dynamics for Real-Time Crowd Simulation" (arXiv 1802.02673)
// e o modelo de força social de Helbing & Molnár (arXiv cond-mat/9805244).
// Módulo puro (sem three.js): roda nos testes do Node.
//
// Por quadro: (1) velocidade preferida vem do caminho A* com chegada suave; (2) a velocidade
// atual relaxa em direção a ela (τ = 0,5 s, Helbing) — nada de arranque instantâneo; (3) posição
// prevista; (4) desvio antecipado: se duas pessoas vão se tocar nos próximos segundos, cada uma
// desliza de lado (só a componente tangencial, §4.5 do paper — não freiam uma contra a outra);
// (5) contato: ninguém ocupa o espaço do outro (restrição de distância, §4.2); (6) paredes e
// móveis pela grade; (7) limite de velocidade e aceleração de gente de verdade (§4.6).

import { buscarCaminho, livre, paraCelula } from './caminhos.js';

export const PARAMS = {
  raio: 0.27,         // meia largura dos ombros (~0,55 m)
  vMax: 1.05,         // m/s andando dentro de um escritório (Helbing usa 1,34 m/s média na rua)
  aMax: 1.4,          // m/s² — acelerar e frear como gente, não como carro
  tau: 0.5,           // s — tempo de relaxamento para a velocidade desejada (Helbing)
  horizonte: 2.5,     // s — a partir de quando começa a desviar de alguém (tempo até a colisão)
  chegada: 0.9,       // m — começa a desacelerar perto do destino
  alcance: 0.35,      // m — distância para considerar um ponto do caminho alcançado
  iteracoes: 4,       // passes do solucionador de restrições
  cedeParado: 0.5,    // quanto quem está parado num lugar cede quando alguém precisa passar (volta sozinho depois)
  travadoS: 1.5,      // s sem avançar 10 cm = travado → recalcula o caminho contornando quem está parado
};

export const criarMultidao = (grade) => ({ grade, agentes: new Map() });

// massaInv: 1 andando, 0,15 parado num lugar (cede pouco), 0 sentado (não se mexe)
export function entrar(m, id, x, z, { ritmo = 1 } = {}) {
  const a = { id, x, z, vx: 0, vz: 0, caminho: null, chegou: true, massaInv: PARAMS.cedeParado, vMax: PARAMS.vMax * ritmo, fixo: false };
  m.agentes.set(id, a);
  return a;
}
export function seguir(m, id, caminho) {
  const a = m.agentes.get(id);
  if (!a) return;
  a.caminho = caminho?.length ? caminho.map(([x, z]) => [x, z]) : null;
  a.alvo = a.caminho ? a.caminho.at(-1).slice() : null;
  a.marco = [a.x, a.z]; a.semAvancar = 0;
  a.chegou = !a.caminho;
  a.massaInv = a.caminho ? 1 : PARAMS.cedeParado;
}
export function fixar(m, id, fixo, x, z) {
  const a = m.agentes.get(id);
  if (!a) return;
  a.fixo = fixo; a.massaInv = fixo ? 0 : a.caminho ? 1 : PARAMS.cedeParado;
  if (x != null) { a.x = x; a.z = z; }
  if (fixo) { a.vx = 0; a.vz = 0; a.caminho = null; a.chegou = true; a.alvo = null; }
}

// tempo até duas pessoas se tocarem (eq. 4–7 do paper); Infinity se não vão se tocar
export function tempoAteColisao(a, b, r) {
  const px = a.x - b.x, pz = a.z - b.z, vx = a.vx - b.vx, vz = a.vz - b.vz;
  const A = vx * vx + vz * vz, B = px * vx + pz * vz, C = px * px + pz * pz - r * r;
  if (C < 0) return 0;
  if (A < 1e-9 || B >= 0) return Infinity;
  const disc = B * B - A * C;
  if (disc <= 0) return Infinity;
  return (-B - Math.sqrt(disc)) / A;
}

function velocidadePreferida(a) {
  // já chegou: ajuste fino para o ponto exato (sem escorregar depois de parar)
  if (!a.caminho) {
    if (!a.alvo) return [0, 0];
    const dx = a.alvo[0] - a.x, dz = a.alvo[1] - a.z, d = Math.hypot(dx, dz);
    if (d < 0.015) return [0, 0];
    const v = Math.min(0.35, d / 0.3);
    return [(dx / d) * v, (dz / d) * v];
  }
  let [tx, tz] = a.caminho[0];
  let dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  while (d < PARAMS.alcance && a.caminho.length > 1) { a.caminho.shift(); [tx, tz] = a.caminho[0]; dx = tx - a.x; dz = tz - a.z; d = Math.hypot(dx, dz); }
  if (a.caminho.length === 1 && d < 0.05) { a.caminho = null; a.chegou = true; a.massaInv = PARAMS.cedeParado; return [0, 0]; }
  // chegada ("arrive" de jogos): no último trecho a velocidade segue a curva de frenagem √(2·a·d),
  // então ele para no ponto em vez de passar dele
  const v = a.caminho.length === 1 ? Math.min(a.vMax, Math.sqrt(2 * PARAMS.aMax * 0.6 * d), a.vMax * (d / PARAMS.chegada) + 0.15) : a.vMax;
  return [(dx / d) * v, (dz / d) * v];
}

// pode pisar ali? (no último trecho vale entrar na cadeira/lugar que é dentro de "móvel" na grade)
function podePisar(m, a, x, z) {
  if (!a.caminho || a.caminho.length === 1) return true;
  if (!livre(m.grade, ...paraCelula(m.grade, a.x, a.z))) return true; // saindo da cadeira/mesa: deixa sair
  return livre(m.grade, ...paraCelula(m.grade, x, z));
}

export function passo(m, dt) {
  if (dt <= 0) return;
  destravar(m, dt);
  const lista = [...m.agentes.values()];
  const r2 = PARAMS.raio * 2;
  const k = 1 - Math.exp(-dt / PARAMS.tau);
  // (1–3) velocidade misturada e posição prevista
  for (const a of lista) {
    if (a.fixo) { a.px = a.x; a.pz = a.z; continue; }
    const [pvx, pvz] = velocidadePreferida(a);
    const kk = !a.caminho || a.caminho.length === 1 ? 1 - Math.exp(-dt / (PARAMS.tau / 2.5)) : k; // freando: reage mais rápido
    a.bvx = a.vx + (pvx - a.vx) * kk;
    a.bvz = a.vz + (pvz - a.vz) * kk;
    a.px = a.x + a.bvx * dt; a.pz = a.z + a.bvz * dt;
  }
  // (4) desvio antecipado: só a parte tangencial, e cada um para o seu lado direito (convenção estável)
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = lista[i], b = lista[j];
    if (a.fixo && b.fixo) continue;
    const ta = { x: a.x, z: a.z, vx: a.bvx ?? 0, vz: a.bvz ?? 0 }, tb = { x: b.x, z: b.z, vx: b.bvx ?? 0, vz: b.bvz ?? 0 };
    const t = tempoAteColisao(ta, tb, r2);
    if (!(t > 0 && t < PARAMS.horizonte)) continue;
    const rvx = ta.vx - tb.vx, rvz = ta.vz - tb.vz, rv = Math.hypot(rvx, rvz) || 1;
    const tx = -rvz / rv, tz = rvx / rv; // perpendicular à aproximação
    const forca = Math.exp(-(t * t) / PARAMS.horizonte) * rv * dt;
    const wa = a.massaInv, wb = b.massaInv, w = wa + wb || 1;
    a.px += tx * forca * (wa / w); a.pz += tz * forca * (wa / w);
    b.px -= tx * forca * (wb / w); b.pz -= tz * forca * (wb / w);
  }
  // (5) contato: restrição de distância ≥ 2r, corrigida pelo peso de cada um (sentado não se move)
  for (let it = 0; it < PARAMS.iteracoes; it++) {
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      const wa = a.massaInv, wb = b.massaInv;
      if (wa + wb === 0) continue;
      let dx = a.px - b.px, dz = a.pz - b.pz, d = Math.hypot(dx, dz);
      if (d >= r2) continue;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1e-6; } // exatamente no mesmo ponto: separa para um lado fixo
      const c = (r2 - d) / (wa + wb);
      a.px += (dx / d) * c * wa; a.pz += (dz / d) * c * wa;
      b.px -= (dx / d) * c * wb; b.pz -= (dz / d) * c * wb;
    }
  }
  // (6) paredes/móveis e (7) velocidade/aceleração humanas
  for (const a of lista) {
    if (a.fixo) continue;
    if (!podePisar(m, a, a.px, a.pz)) {
      if (podePisar(m, a, a.px, a.z)) a.pz = a.z; else if (podePisar(m, a, a.x, a.pz)) a.px = a.x; else { a.px = a.x; a.pz = a.z; }
    }
    let vx = (a.px - a.x) / dt, vz = (a.pz - a.z) / dt;
    const dvx = vx - a.vx, dvz = vz - a.vz, dv = Math.hypot(dvx, dvz), dvMax = PARAMS.aMax * dt;
    if (dv > dvMax) { vx = a.vx + (dvx / dv) * dvMax; vz = a.vz + (dvz / dv) * dvMax; }
    const v = Math.hypot(vx, vz), lim = a.vMax * 1.1;
    if (v > lim) { vx *= lim / v; vz *= lim / v; }
    a.vx = vx; a.vz = vz;
    a.x += vx * dt; a.z += vz * dt;
  }
}

// Travamento local (clássico de jogos): quem não avança 10 cm em PARAMS.travadoS recalcula o
// caminho com as pessoas paradas/sentadas marcadas como obstáculo temporário.
export function destravar(m, dt) {
  for (const a of m.agentes.values()) {
    if (!a.caminho || a.fixo) continue;
    if (Math.hypot(a.x - a.marco[0], a.z - a.marco[1]) > 0.1) { a.marco = [a.x, a.z]; a.semAvancar = 0; continue; }
    a.semAvancar += dt;
    if (a.semAvancar < PARAMS.travadoS) continue;
    const g = { ...m.grade, bloqueado: m.grade.bloqueado.slice() };
    for (const o of m.agentes.values()) {
      if (o === a || o.caminho) continue; // só quem está parado vira obstáculo
      const [c, l] = paraCelula(g, o.x, o.z);
      if (c >= 0 && l >= 0 && c < g.cols && l < g.lins) g.bloqueado[l * g.cols + c] = 1;
    }
    const novo = buscarCaminho(g, [a.x, a.z], a.alvo);
    a.semAvancar = 0; a.marco = [a.x, a.z];
    if (novo) { a.caminho = novo; a.replanejou = (a.replanejou || 0) + 1; }
  }
}

export const velocidade = (a) => Math.hypot(a.vx, a.vz);
