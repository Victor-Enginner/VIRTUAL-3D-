// Conversa com o lead: o que entra e sai pelo WhatsApp, com o estado de entrega de cada mensagem enviada.
// Independente do provedor (OpenWA hoje, outro amanhã): quem fala com o provedor é src/envio/canal.mjs.
//  - wa_id é a chave: webhook que repete (os provedores tentam de novo) não duplica mensagem nem reaprende a mesma resposta.
//  - o estado de entrega só avança: registrada → enviada → entregue → lida. "falhou" vale em qualquer ponto antes de "lida".
import { agora, lerFlag, salvarFlag } from './db.mjs';

const ORDEM = { registrada: 0, enviada: 1, entregue: 2, lida: 3 };
// recibos do provedor (nomes do OpenWA e do Baileys/WhatsApp) → nosso estado
const DO_RECIBO = { sent: 'enviada', server: 'enviada', delivered: 'entregue', delivery: 'entregue', read: 'lida', played: 'lida', failed: 'falhou', error: 'falhou' };
export const estadoDoRecibo = (r) => DO_RECIBO[String(r ?? '').toLowerCase()] || null;

export function registrarMensagem(db, m) {
  const t = agora();
  const wa = m.waId || null;
  let status = m.status || (m.direcao === 'entrada' ? 'recebida' : 'registrada');
  if (wa && m.direcao === 'saida') { // recibo que chegou antes do registro
    const o = db.prepare('SELECT status FROM acks_orfaos WHERE wa_id = ?').get(wa);
    if (o && (ORDEM[o.status] > ORDEM[status] || o.status === 'falhou')) status = o.status;
    if (o) db.prepare('DELETE FROM acks_orfaos WHERE wa_id = ?').run(wa);
  }
  const r = db.prepare(`INSERT OR IGNORE INTO mensagens (lead_id, telefone, direcao, origem, texto, wa_id, status, envio_id, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(m.leadId ?? null, m.telefone, m.direcao, m.origem, m.texto == null ? null : String(m.texto).slice(0, 4000), wa, status, m.envioId ?? null, t, t);
  return { inserido: r.changes > 0, id: r.changes ? Number(r.lastInsertRowid) : null };
}

export const jaRegistrada = (db, waId) => Boolean(waId && db.prepare('SELECT 1 FROM mensagens WHERE wa_id = ?').get(waId));

// Recibo de entrega. Devolve 'avancou' | 'ignorado' (já estava igual ou além) | 'guardado' (a mensagem ainda não foi registrada).
export function avancarEstado(db, waId, recibo, erro = null) {
  const novo = estadoDoRecibo(recibo);
  if (!waId || !novo) return 'ignorado';
  const m = db.prepare('SELECT id, status FROM mensagens WHERE wa_id = ? AND direcao = ?').get(waId, 'saida');
  if (!m) {
    const o = db.prepare('SELECT status FROM acks_orfaos WHERE wa_id = ?').get(waId);
    if (!o || novo === 'falhou' || ORDEM[novo] > ORDEM[o.status]) db.prepare('INSERT OR REPLACE INTO acks_orfaos (wa_id, status, em) VALUES (?, ?, ?)').run(waId, novo, agora());
    db.prepare("DELETE FROM acks_orfaos WHERE em < ?").run(new Date(Date.now() - 86_400_000).toISOString()); // recibo de mensagem que nunca foi nossa
    return 'guardado';
  }
  if (m.status === 'lida' || m.status === 'falhou') return 'ignorado';
  if (novo !== 'falhou' && ORDEM[novo] <= ORDEM[m.status]) return 'ignorado';
  db.prepare('UPDATE mensagens SET status = ?, erro = ?, atualizado_em = ? WHERE id = ?').run(novo, novo === 'falhou' ? String(erro ?? 'o WhatsApp informou falha na entrega').slice(0, 300) : null, agora(), m.id);
  return 'avancou';
}

export const conversaDoLead = (db, leadId, limite = 100) =>
  db.prepare('SELECT id, direcao, origem, texto, status, erro, criado_em FROM mensagens WHERE lead_id = ? ORDER BY id DESC LIMIT ?').all(leadId, limite).reverse().map((r) => ({ ...r }));

// quantas das mensagens enviadas pelo sistema estão em cada estado (para o Painel e a saúde)
export function resumoDeEntrega(db) {
  const base = { registrada: 0, enviada: 0, entregue: 0, lida: 0, falhou: 0 };
  for (const r of db.prepare("SELECT status, COUNT(*) n FROM mensagens WHERE direcao = 'saida' GROUP BY status").all()) base[r.status] = r.n;
  return base;
}

// ---- conexão do WhatsApp, vinda dos eventos do provedor. Restrição da conta e laço de reconexão PAUSAM o envio até a sessão voltar.
const CAIDA = new Set(['disconnected', 'reconnect_loop', 'logged_out', 'failed']);
export function registrarConexao(db, { status = null, restricao = null }) {
  const antes = lerFlag(db, 'whatsapp_conexao', {});
  const depois = { ...antes, em: agora() };
  if (status) depois.estado = status;
  if (restricao !== null) depois.restricao = restricao || null;
  salvarFlag(db, 'whatsapp_conexao', depois);
  return { antes, depois, mudou: antes.estado !== depois.estado || Boolean(antes.restricao) !== Boolean(depois.restricao) };
}
export function envioPausadoPelaConexao(db) {
  const c = lerFlag(db, 'whatsapp_conexao', {});
  if (c.restricao) return `a conta do WhatsApp está com restrição (${typeof c.restricao === 'string' ? c.restricao : 'veja o celular'})`;
  if (c.estado === 'reconnect_loop') return 'o WhatsApp está falhando para reconectar';
  return null;
}
export const sessaoCaida = (estado) => CAIDA.has(String(estado));

// telefones para os quais o Leo está enviando NESTE instante: o webhook "message.sent" do nosso próprio envio pode chegar antes
// de a mensagem ser registrada, e não pode ser confundido com "você mandou pelo celular".
export const emEnvio = new Set();
