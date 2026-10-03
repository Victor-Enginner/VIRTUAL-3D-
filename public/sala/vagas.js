// Lugares da sala com RESERVA: cada lugar tem um id estável ("copa:roda:2"), e só um agente por
// lugar. Corrige o bug antigo em que a conversa trocava o objeto do ponto e o lugar parecia livre
// (dois bonecos no mesmo lugar).
//
// Rodas de conversa = F-formation (Kendon; arXiv 1907.10384): as pessoas ficam num círculo em volta
// de um espaço comum ("o-space"), cada uma virada para o centro. Turno de fala ~2 s (mesmo paper).
// Módulo puro (sem three.js).
import { livre, paraCelula } from './caminhos.js';

export const RAIO_RODA = 0.8;    // m — raio do o-space para 2–4 pessoas
export const TURNO_MS = 2200;    // duração média de um turno de fala

// lugares numa roda: círculo em volta do centro, todos olhando para o meio; descarta os que caem em móvel
export function roda(grade, cx, cz, n = 4, raio = RAIO_RODA, fase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = fase + (i * 2 * Math.PI) / n;
    const x = cx + Math.sin(ang) * raio, z = cz + Math.cos(ang) * raio;
    if (grade && !livre(grade, ...paraCelula(grade, x, z))) continue;
    out.push({ x, z, rot: Math.atan2(cx - x, cz - z), roda: `${cx.toFixed(1)},${cz.toFixed(1)}` });
  }
  return out;
}

// areas: { copa: [{x,z,rot,roda?}], ... } → vagas com id estável
export function criarVagas(areas) {
  const lugares = new Map();
  for (const [area, lista] of Object.entries(areas)) lista.forEach((p, i) => lugares.set(`${area}:${i}`, { ...p, id: `${area}:${i}`, area, dono: null }));
  return { lugares };
}

export const livresEm = (v, area) => [...v.lugares.values()].filter((l) => l.area === area && !l.dono);
export const lugarDe = (v, agente) => [...v.lugares.values()].find((l) => l.dono === agente) || null;

export function liberarVaga(v, agente) {
  for (const l of v.lugares.values()) if (l.dono === agente) l.dono = null;
}

// reserva um lugar livre na área; numa roda, prefere a que já tem gente (para conversar)
export function reservar(v, agente, area) {
  liberarVaga(v, agente);
  const livres = livresEm(v, area);
  if (!livres.length) return null;
  // roda primeiro (gente junta conversa), a mais cheia antes; lugar solo (balcão, janela) só quando a roda enche
  const nota = (l) => (l.roda ? 10 + [...v.lugares.values()].filter((o) => o.roda === l.roda && o.dono).length : 0);
  livres.sort((a, b) => nota(b) - nota(a));
  livres[0].dono = agente;
  return livres[0];
}

// quem está junto numa roda agora (só quem já chegou no lugar)
export function grupos(v, chegou) {
  const g = new Map();
  for (const l of v.lugares.values()) if (l.roda && l.dono && chegou(l.dono)) g.set(l.roda, [...(g.get(l.roda) || []), l.dono]);
  return [...g.values()].filter((m) => m.length >= 2);
}

// de quem é a vez de falar na roda (alterna a cada turno; o resto escuta)
export const quemFala = (membros, agoraMs) => membros[Math.floor(agoraMs / TURNO_MS) % membros.length];
