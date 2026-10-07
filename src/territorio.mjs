// Território inteiro com bandit (evolução 2). Uma CAMPANHA é "um ramo num estado inteiro" (ex.: barbearia em SP, 645 cidades).
// Cada cidade é um BRAÇO. Quando o portão de lotes deixa (regra do Victor, src/lotes.mjs), o Atlas escolhe a PRÓXIMA cidade
// por Thompson Sampling (arXiv 1304.5758): sorteia uma taxa plausível de cada cidade numa Beta e pega a maior.
//
// Recompensa = fração das empresas coletadas que viraram OPORTUNIDADE REAL: site fraco/sem site E telefone celular.
// Só usa o que o Atlas já mediu (auditoria + tipo de telefone) — nada estimado ou inventado.
//
// Partida a frio (645 braços, quase nenhum dado): o prior de cada cidade vem da média do MESMO RAMO nas cidades já
// buscadas (prior hierárquico/empírico, arXiv 2602.15972), com força limitada a FORCA_PRIOR observações para não
// sufocar a exploração (arXiv 2602.00943). Sem histórico nenhum do ramo: Beta(1, 1), a ignorância honesta.
import { cidadesDe } from './localidades.mjs';
import { SITUACOES } from './regras.mjs';

export const FORCA_PRIOR = 6;           // o prior vale "6 empresas" de evidência
// fonte única: toda situação auditada que não é "site próprio" é site fraco/sem site
export const SITE_FRACO = Object.keys(SITUACOES).filter((k) => k !== 'site_proprio');

// --- amostragem Beta sem dependência (Marsaglia & Tsang para a Gamma) ---
function normal(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function gamma(k, rng) {
  if (k < 1) return gamma(k + 1, rng) * rng() ** (1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
    v = v ** 3;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export function beta(a, b, rng = Math.random) { const x = gamma(a, rng), y = gamma(b, rng); return x / (x + y); }

// rng determinístico (testes e "por que escolheu esta cidade" reproduzível)
export function rngSemente(semente) { let s = semente >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296; }

// Evidência por cidade de um ramo: quantas empresas foram auditadas e quantas eram oportunidade real.
export function evidencia(db, { pais, uf, nicho }) {
  const linhas = db.prepare(`SELECT cidade,
      SUM(situacao_site IS NOT NULL) auditados,
      SUM(situacao_site IN (${SITE_FRACO.map(() => '?').join(',')}) AND telefone_tipo = 'celular') oportunidades
    FROM leads WHERE pais = ? AND uf = ? AND nicho = ? GROUP BY cidade`).all(...SITE_FRACO, pais, uf, nicho);
  const esgotadas = new Set(db.prepare(`SELECT v.cidade FROM varreduras v JOIN lotes l ON l.varredura_id = v.id
    WHERE v.pais = ? AND v.uf = ? AND v.nicho = ? AND l.fim = 1`).all(pais, uf, nicho).map((r) => r.cidade));
  return { porCidade: Object.fromEntries(linhas.map((r) => [r.cidade, { n: r.auditados || 0, s: r.oportunidades || 0 }])), esgotadas };
}

// Prior do ramo: média de oportunidade em TODAS as cidades/estados já buscados (empírico), com força limitada.
// Só o MESMO PAÍS: barbearia em Lisboa não diz nada sobre barbearia em SP (antes misturava).
export function priorDoRamo(db, nicho, pais = 'BR') {
  const r = db.prepare(`SELECT SUM(situacao_site IS NOT NULL) n,
      SUM(situacao_site IN (${SITE_FRACO.map(() => '?').join(',')}) AND telefone_tipo = 'celular') s FROM leads WHERE nicho = ? AND pais = ?`).get(...SITE_FRACO, nicho, pais);
  if (!r?.n) return { a: 1, b: 1, media: null, base: 0 };
  const media = Math.min(Math.max(r.s / r.n, 0.02), 0.98);
  return { a: media * FORCA_PRIOR, b: (1 - media) * FORCA_PRIOR, media, base: r.n };
}

// Escolhe as próximas `k` cidades da campanha. Devolve também o "porquê" de cada uma (transparência para o Victor).
export function escolherCidades(db, { pais = 'BR', uf, nicho, k = 1, rng = Math.random, cidades = null }) {
  const todas = cidades || cidadesDe(uf, pais);
  const { porCidade, esgotadas } = evidencia(db, { pais, uf, nicho });
  const prior = priorDoRamo(db, nicho, pais);
  const bracos = todas.filter((c) => !esgotadas.has(c)).map((cidade) => {
    const e = porCidade[cidade] || { n: 0, s: 0 };
    const a = prior.a + e.s, b = prior.b + (e.n - e.s);
    return { cidade, auditados: e.n, oportunidades: e.s, media: a / (a + b), amostra: beta(a, b, rng) };
  });
  bracos.sort((x, y) => y.amostra - x.amostra);
  return { prior, total: todas.length, esgotadas: esgotadas.size, escolhidas: bracos.slice(0, k) };
}

// ---------------------------------------------------------------- campanhas
export function criarCampanha(db, { pais = 'BR', uf, nicho, fonte = 'maps', meta = 50 }) {
  const ja = db.prepare('SELECT * FROM campanhas WHERE pais = ? AND uf = ? AND nicho = ? AND fonte = ?').get(pais, uf, nicho, fonte);
  if (ja) { db.prepare('UPDATE campanhas SET ativa = 1, meta = ? WHERE id = ?').run(meta, ja.id); return db.prepare('SELECT * FROM campanhas WHERE id = ?').get(ja.id); }
  const r = db.prepare('INSERT INTO campanhas (pais, uf, nicho, fonte, meta, criada_em) VALUES (?, ?, ?, ?, ?, ?)').run(pais, uf, nicho, fonte, meta, new Date().toISOString());
  return db.prepare('SELECT * FROM campanhas WHERE id = ?').get(Number(r.lastInsertRowid));
}

// a campanha anda uma cidade por vez: a cidade anterior precisa estar com o lote tratado (o portão de lotes manda)
export function ultimoPasso(db, campanhaId) { return db.prepare('SELECT * FROM campanha_passos WHERE campanha_id = ? ORDER BY id DESC LIMIT 1').get(campanhaId) || null; }

export function registrarPasso(db, campanhaId, varreduraId, escolha, alternativas) {
  db.prepare('INSERT INTO campanha_passos (campanha_id, varredura_id, cidade, amostra, media, auditados, oportunidades, alternativas, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(campanhaId, varreduraId, escolha.cidade, escolha.amostra, escolha.media, escolha.auditados, escolha.oportunidades,
      JSON.stringify(alternativas.map((a) => ({ cidade: a.cidade, amostra: Number(a.amostra.toFixed(3)), media: Number(a.media.toFixed(3)) }))), new Date().toISOString());
}

export function resumoCampanha(db, c) {
  const passos = db.prepare('SELECT * FROM campanha_passos WHERE campanha_id = ? ORDER BY id DESC LIMIT 20').all(c.id).map((p) => ({ ...p, alternativas: JSON.parse(p.alternativas || '[]') }));
  const { prior, total, esgotadas, escolhidas } = escolherCidades(db, { pais: c.pais, uf: c.uf, nicho: c.nicho, k: 5 });
  const visitadas = db.prepare('SELECT COUNT(DISTINCT cidade) n FROM campanha_passos WHERE campanha_id = ?').get(c.id).n;
  return { ...c, total_cidades: total, visitadas, esgotadas, prior, passos, provaveis: escolhidas };
}
