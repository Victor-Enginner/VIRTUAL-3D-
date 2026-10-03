// Calibração das previsões (B10; arXiv 2609.33401 e 2610.02076): uma probabilidade só serve para
// decidir sozinho (zonas do B3) se "70%" acerta ~70% das vezes. A média pode esconder um nicho
// muito errado, por isso o relatório sai por nicho e aponta o pior grupo.
//
// Cada linha de `previsoes` é o que o sistema previa NO MOMENTO em que o rótulo chegou (antes de
// aprender com ele) — avaliação prequencial, sem olhar o futuro.
import { agora } from '../db.mjs';

export const MIN_AMOSTRA = 30; // abaixo disso, o número existe mas não sustenta limite nenhum
export const FAIXAS = 5;

// p_cabeca: P(aprovação/resposta) da cabeça aprendida · p_score: prioridade final ÷ 100 (o que você vê)
export function registrarPrevisao(db, { leadId, nicho, alvo, pCabeca, pScore, y, peso = 1, nAntes }) {
  db.prepare(`INSERT INTO previsoes (lead_id, nicho, alvo, p_cabeca, p_score, y, peso, n_antes, em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(leadId, nicho || null, alvo, pCabeca, pScore ?? null, y, peso, nAntes, agora());
}

// Brier = média (p − y)²; ECE = Σ (n_faixa / n) · |p médio − taxa real| em faixas iguais de p
export function metricas(pares, faixas = FAIXAS) {
  const n = pares.length;
  if (!n) return { n: 0, taxa: null, brier: null, ece: null, faixas: [], confiavel: false };
  const brier = pares.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / n;
  const caixas = Array.from({ length: faixas }, (_, i) => ({ de: i / faixas, ate: (i + 1) / faixas, n: 0, soma_p: 0, soma_y: 0 }));
  for (const [p, y] of pares) {
    const c = caixas[Math.min(faixas - 1, Math.floor(p * faixas))];
    c.n++; c.soma_p += p; c.soma_y += y;
  }
  let ece = 0;
  const saida = [];
  for (const c of caixas) {
    if (!c.n) continue;
    const pm = c.soma_p / c.n, tx = c.soma_y / c.n;
    ece += (c.n / n) * Math.abs(pm - tx);
    saida.push({ de: c.de, ate: c.ate, n: c.n, p_media: r3(pm), taxa: r3(tx) });
  }
  return { n, taxa: r3(pares.reduce((s, [, y]) => s + y, 0) / n), brier: r3(brier), ece: r3(ece), faixas: saida, confiavel: n >= MIN_AMOSTRA };
}
const r3 = (x) => Math.round(x * 1000) / 1000;

// relatório por alvo × previsor, geral e por nicho; "pior" = nicho com maior ECE entre os confiáveis
export function relatorio(db) {
  const linhas = db.prepare('SELECT alvo, nicho, p_cabeca, p_score, y FROM previsoes').all();
  const out = {};
  for (const alvo of ['aprovacao', 'resposta']) {
    out[alvo] = {};
    for (const prev of ['p_cabeca', 'p_score']) {
      const doAlvo = linhas.filter((l) => l.alvo === alvo && l[prev] != null);
      const porNicho = {};
      for (const nicho of [...new Set(doAlvo.map((l) => l.nicho || 'sem_nicho'))]) {
        porNicho[nicho] = metricas(doAlvo.filter((l) => (l.nicho || 'sem_nicho') === nicho).map((l) => [l[prev], l.y]));
      }
      const confiaveis = Object.entries(porNicho).filter(([, m]) => m.confiavel).sort((a, b) => b[1].ece - a[1].ece);
      out[alvo][prev] = { geral: metricas(doAlvo.map((l) => [l[prev], l.y])), por_nicho: porNicho, pior_nicho: confiaveis[0]?.[0] ?? null };
    }
  }
  return { min_amostra: MIN_AMOSTRA, total: linhas.length, ...out };
}
