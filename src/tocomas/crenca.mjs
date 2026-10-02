// Belief state explícito por lead (PoS, arXiv 2610.01415): o que os agentes sabem agora, de onde
// veio, até quando vale, e o que ainda falta. "Preso" = ciclos seguidos sem nenhum fato novo
// (no paper, Belief Trapping é continuar agindo sem progresso).
import { agora, json, parse } from '../db.mjs';
import { exigir } from './contratos.mjs';

// quanto tempo cada fato continua valendo (dias)
export const VALIDADE_DIAS = {
  telefone: 180, site: 30, rating: 14, avaliacoes: 14,
  situacao_site: 30, sinais_atraso: 30,
  nivel_oportunidade: 30, ativo: 30, angulo: 30,
};
export const LIMITE_PRESO = 3;

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const vencido = (f, quando) => f.valido_ate && f.valido_ate < quando;

function ler(db, leadId) {
  const r = db.prepare('SELECT * FROM crencas WHERE lead_id = ?').get(leadId);
  return r
    ? { ...r, fatos: parse(r.fatos, []), conflitos: parse(r.conflitos, []), preso: Boolean(r.preso) }
    : { lead_id: leadId, versao: 0, fatos: [], conflitos: [], ciclos_sem_novidade: 0, preso: false, motivo: null };
}

function salvar(db, c) {
  db.prepare(`INSERT INTO crencas (lead_id, versao, fatos, conflitos, ciclos_sem_novidade, preso, motivo, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET versao = excluded.versao, fatos = excluded.fatos,
    conflitos = excluded.conflitos, ciclos_sem_novidade = excluded.ciclos_sem_novidade, preso = excluded.preso,
    motivo = excluded.motivo, atualizado_em = excluded.atualizado_em`)
    .run(c.lead_id, c.versao, json(c.fatos), json(c.conflitos), c.ciclos_sem_novidade, c.preso ? 1 : 0, c.motivo, agora());
}

// Registra fatos novos. Valor nulo não é fato (vira pendência). Mesmo valor só renova a data;
// valor diferente vindo de outra fonte enquanto o antigo ainda vale = conflito.
export function registrarFatos(db, leadId, fatos, quando = agora()) {
  const c = ler(db, leadId);
  let novidade = false;
  for (const f of fatos) {
    if (f.valor == null || (Array.isArray(f.valor) && !f.valor.length && f.chave !== 'sinais_atraso')) continue;
    const dias = VALIDADE_DIAS[f.chave];
    const novo = exigir('fato', {
      chave: f.chave, valor: f.valor, fonte: f.fonte, observado_em: quando,
      valido_ate: dias ? new Date(Date.parse(quando) + dias * 86_400_000).toISOString() : null,
      confianca: f.confianca ?? 1,
    });
    const i = c.fatos.findIndex((x) => x.chave === f.chave);
    const antigo = c.fatos[i];
    if (!antigo) { c.fatos.push(novo); novidade = true; continue; }
    if (igual(antigo.valor, novo.valor)) {
      if (vencido(antigo, quando)) novidade = true; // reconfirmar fato vencido é progresso
      c.fatos[i] = novo;
      continue;
    }
    if (!vencido(antigo, quando) && antigo.fonte !== novo.fonte && !c.conflitos.includes(f.chave)) c.conflitos.push(f.chave);
    c.fatos[i] = novo;
    novidade = true;
  }
  if (novidade) c.versao += 1;
  salvar(db, c);
  return { versao: c.versao, novidade, conflitos: c.conflitos };
}

export function resolverConflito(db, leadId, chave) {
  const c = ler(db, leadId);
  c.conflitos = c.conflitos.filter((k) => k !== chave);
  salvar(db, c);
}

export function pendencias(c, etapa, quando = agora()) {
  const p = [];
  const valido = (k) => c.fatos.some((f) => f.chave === k && !vencido(f, quando));
  for (const k of ['telefone', 'situacao_site']) if (!valido(k)) p.push({ chave: k, tipo: 'falta_dado' });
  for (const f of c.fatos) if (vencido(f, quando) && !p.some((x) => x.chave === f.chave)) p.push({ chave: f.chave, tipo: 'falta_dado' });
  for (const k of c.conflitos) p.push({ chave: k, tipo: 'conflito' });
  if (etapa === 'mensagem') p.push({ chave: 'aprovacao', tipo: 'aguardando_humano' });
  if (etapa === 'enviado') p.push({ chave: 'resposta', tipo: 'aguardando_resposta' });
  return p;
}

// contrato "crenca" completo, como os outros agentes e a tela recebem
export function lerCrenca(db, leadId, etapa = null, quando = agora()) {
  const c = ler(db, leadId);
  return exigir('crenca', {
    lead_id: leadId, versao: c.versao, fatos: c.fatos, pendencias: pendencias(c, etapa, quando),
    progresso: { ciclos_sem_novidade: c.ciclos_sem_novidade, preso: c.preso, ...(c.motivo ? { motivo: c.motivo } : {}) },
  });
}

export const versaoDe = (db, leadId) => db.prepare('SELECT versao FROM crencas WHERE lead_id = ?').get(leadId)?.versao ?? 0;
export const estaPreso = (db, leadId) => Boolean(db.prepare('SELECT preso FROM crencas WHERE lead_id = ?').get(leadId)?.preso);

// fecha um ciclo de trabalho sobre o lead: progrediu se a versão da crença mudou
export function fecharCiclo(db, leadId, versaoAntes, etapa = null) {
  const c = ler(db, leadId);
  if (c.versao > versaoAntes) { c.ciclos_sem_novidade = 0; salvar(db, c); return { preso: false, ciclos: 0 }; }
  c.ciclos_sem_novidade += 1;
  if (c.ciclos_sem_novidade >= LIMITE_PRESO && !c.preso) {
    const falta = pendencias(c, etapa).filter((p) => p.tipo === 'falta_dado' || p.tipo === 'conflito').map((p) => p.chave);
    c.preso = true;
    c.motivo = `${c.ciclos_sem_novidade} ciclos sem fato novo${falta.length ? ` · falta: ${falta.join(', ')}` : ''}`;
  }
  salvar(db, c);
  return { preso: c.preso, ciclos: c.ciclos_sem_novidade, motivo: c.motivo };
}

export function liberar(db, leadId) {
  const c = ler(db, leadId);
  Object.assign(c, { preso: false, motivo: null, ciclos_sem_novidade: 0 });
  salvar(db, c);
}

export function presos(db) {
  return db.prepare('SELECT c.lead_id, c.motivo, l.nome FROM crencas c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.preso = 1 ORDER BY c.atualizado_em DESC').all();
}

// fatos que a Coleta traz da fonte (Maps/OSM)
export function fatosDaFonte(lead) {
  const fonte = lead.fonte === 'osm' ? 'osm' : 'maps';
  return [
    { chave: 'telefone', valor: lead.telefone, fonte },
    { chave: 'site', valor: lead.site, fonte },
    { chave: 'rating', valor: lead.rating, fonte },
    { chave: 'avaliacoes', valor: lead.avaliacoes, fonte },
  ];
}
