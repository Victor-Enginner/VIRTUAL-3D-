// B18 (2601.19055): exporta o que você ensinou aos agentes, sem dado pessoal, para treino fora do PC (B19).
// Cada linha é um exemplo: edição (original da Maia × seu texto), aprovação/descarte do texto, resposta ou fechamento.
// Anonimiza: nome do negócio → [NEGOCIO], seu nome → [REMETENTE], telefone/e-mail/link/endereço sumidos.
import { lerAjustes, parse } from './db.mjs';

const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GENERICAS = /^(barbearia|restaurante|clinica|estetica|studio|academia|oficina|padaria|salao)$/;

export function anonimizador(lead, ajustes) {
  const palavras = (lead?.nome || '').split(/\s+/).filter((w) => w.length >= 4 && !GENERICAS.test(sem(w)));
  const primeiro = (ajustes?.remetente_nome || '').split(/\s+/)[0];
  return (texto) => {
    if (texto == null) return null;
    let t = String(texto);
    if (lead?.nome) t = t.replace(new RegExp(esc(lead.nome), 'gi'), '[NEGOCIO]');
    for (const w of palavras) t = t.replace(new RegExp(`\\b${esc(w)}\\b`, 'gi'), '[NEGOCIO]');
    if (ajustes?.remetente_nome) t = t.replace(new RegExp(esc(ajustes.remetente_nome), 'gi'), '[REMETENTE]');
    if (primeiro.length >= 3) t = t.replace(new RegExp(`\\b${esc(primeiro)}\\b`, 'gi'), '[REMETENTE]');
    if (lead?.endereco) t = t.replace(new RegExp(esc(lead.endereco), 'gi'), '[ENDERECO]');
    return t
      .replace(/https?:\/\/\S+|www\.\S+/gi, '[LINK]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
      .replace(/\+?\d[\d\s().-]{7,}\d/g, '[TELEFONE]');
  };
}

export function exportarTreino(db) {
  const ajustes = lerAjustes(db);
  const out = [];
  const lead = (id) => db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  const base = (l) => ({ nicho: l.nicho ?? null, angulo: parse(l.decisao)?.answers?.abordagem?.choice ?? null, situacao_site: l.situacao_site ?? null });

  for (const e of db.prepare('SELECT * FROM edicoes').all()) {
    const l = lead(e.lead_id); if (!l) continue;
    const a = anonimizador(l, ajustes);
    out.push({ tipo: 'edicao', ...base(l), origem_original: e.origem_original, original: a(e.original), editado: a(e.editado) });
  }
  // textos que passaram por você: foram para a fila (aprovado = 1) ou foram descartados (0, com o motivo)
  for (const l of db.prepare("SELECT * FROM leads WHERE mensagem IS NOT NULL AND etapa NOT IN ('descoberto', 'auditado', 'qualificado', 'mensagem')").all()) {
    const a = anonimizador(l, ajustes);
    const aprovou = db.prepare("SELECT 1 FROM envios WHERE lead_id = ? AND status IN ('aprovado','enviado')").get(l.id);
    const motivo = l.etapa === 'descartado' ? parse(db.prepare("SELECT dados FROM eventos WHERE lead_id = ? AND tipo = 'descartado' ORDER BY id DESC LIMIT 1").get(l.id)?.dados)?.motivo ?? null : null;
    out.push({ tipo: 'aprovacao', ...base(l), mensagem_origem: l.mensagem_origem, texto: a(l.mensagem), aprovado: aprovou ? 1 : 0, motivo_descarte: motivo });
    if (db.prepare("SELECT 1 FROM envios WHERE lead_id = ? AND status = 'enviado'").get(l.id)) {
      out.push({ tipo: 'resposta', ...base(l), texto: a(l.mensagem), respondeu: ['respondeu', 'fechado', 'perdido'].includes(l.etapa) ? 1 : 0 });
    }
  }
  for (const n of db.prepare('SELECT * FROM negocios').all()) {
    const l = lead(n.lead_id); if (!l) continue;
    out.push({ tipo: 'fechamento', ...base(l), valor: n.valor, servico: anonimizador(l, ajustes)(n.servico) });
  }
  return out;
}

// confere o resultado: nada que pareça telefone, e-mail ou link pode sobrar
export const temDadoPessoal = (linhas) => linhas.some((o) => /\d{8,}|@|https?:\/\//.test(Object.values(o).filter((v) => typeof v === 'string').join(' ')));
