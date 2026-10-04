// Cadeia de causa (B5): cada evento aponta para o que o causou, então dá para responder "por que isso aconteceu?"
// com fatos do banco, sem modelo. Ideia do rastro causal do Semantica (graph.add_causal_relationship), em SQL puro.
// A causa é DETERMINÍSTICA: o evento anterior mais recente do mesmo lead, de um tipo que pode causar este.
import { parse } from '../db.mjs';

export const CAUSA_DE = {
  decisao: ['auditoria'],
  zona_baixa: ['auditoria'],
  mensagem: ['decisao'],
  aprovado: ['mensagem'],
  enviado: ['aprovado', 'mensagem', 'decisao'],
  resposta: ['enviado'],
  opt_out: ['enviado'],
  fechado: ['resposta', 'enviado'],
  perdido: ['resposta', 'enviado'],
};
export const TIPOS_DA_CADEIA = ['auditoria', ...Object.keys(CAUSA_DE)];

// id do evento que causou um evento novo de `tipo` neste lead (ou null)
export function causaDe(db, leadId, tipo) {
  const tipos = CAUSA_DE[tipo];
  if (!leadId || !tipos) return null;
  const r = db.prepare(`SELECT id FROM eventos WHERE lead_id = ? AND tipo IN (${tipos.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`).get(leadId, ...tipos);
  return r?.id ?? null;
}

// do evento mais recente com causa até a raiz, em ordem de acontecimento
export function cadeia(eventos) {
  const porId = new Map(eventos.map((e) => [e.id, e]));
  const folha = eventos.filter((e) => e.causa_id != null).sort((a, b) => b.id - a.id)[0];
  const caminho = [];
  const vistos = new Set();
  for (let e = folha; e && !vistos.has(e.id); e = porId.get(e.causa_id)) { vistos.add(e.id); caminho.unshift(e); }
  return caminho.map((e) => ({ id: e.id, ts: e.ts, agente: e.agente, tipo: e.tipo, msg: e.msg, causa_id: e.causa_id ?? null, dados: parse(e.dados, null) }));
}
