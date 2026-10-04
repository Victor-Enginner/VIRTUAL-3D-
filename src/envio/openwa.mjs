// Cliente do OpenWA (https://github.com/rmyndharis/OpenWA, MIT), conforme docs/06-api-specification.md do
// próprio projeto (v0.24): sessões por UUID, QR em data URL PNG, webhook com evento no corpo
// { event, sessionId, data }. Autenticação: cabeçalho X-API-Key (gerada no 1º boot em data/.api-key).
import { CONFIG } from '../config.mjs';

export const NOME_SESSAO = 'prospector';
let sessaoAtual = CONFIG.openwa.sessionId || null; // .env manda; senão a que o Painel conectou (salva no banco)

export const definirSessao = (id) => { sessaoAtual = id || null; };
export const sessaoId = () => sessaoAtual;
export const temChave = () => Boolean(CONFIG.openwa.apiKey);
export const openwaConfigurado = () => Boolean(CONFIG.openwa.apiKey && sessaoAtual);

async function chamar(metodo, caminho, corpo, timeout = 30_000) {
  const r = await fetch(`${CONFIG.openwa.url}/api${caminho}`, {
    method: metodo,
    signal: AbortSignal.timeout(timeout),
    headers: { 'X-API-Key': CONFIG.openwa.apiKey, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let j; try { j = JSON.parse(texto); } catch { j = { bruto: texto.slice(0, 300) }; }
  if (!r.ok) {
    const e = new Error(`OpenWA ${r.status}: ${[].concat(j?.message || j?.error || j?.bruto || '').join('; ')}`.slice(0, 300));
    e.status = r.status;
    throw e;
  }
  return j;
}

const sid = () => {
  if (!sessaoAtual) throw new Error('WhatsApp não conectado: use "Conectar WhatsApp" no Painel');
  return encodeURIComponent(sessaoAtual);
};

export async function enviarTexto(telefone, texto) {
  if (!openwaConfigurado()) throw new Error('OpenWA não configurado (falta a chave ou a sessão)');
  return chamar('POST', `/sessions/${sid()}/messages/send-text`, { chatId: `${telefone}@c.us`, text: texto });
}

// acha a sessão "prospector" ou cria; devolve o UUID
export async function garantirSessao() {
  const lista = await chamar('GET', `/sessions?name=${NOME_SESSAO}`);
  const ja = (Array.isArray(lista) ? lista : []).find((s) => s.name === NOME_SESSAO);
  return (ja || (await chamar('POST', '/sessions', { name: NOME_SESSAO }))).id;
}

export const iniciarSessao = () => chamar('POST', `/sessions/${sid()}/start`, null, 60_000);
export const statusSessao = () => chamar('GET', `/sessions/${sid()}`, null, 5000);
export const qrSessao = () => chamar('GET', `/sessions/${sid()}/qr`, null, 10_000);

// webhook de volta para o Prospector (só cria se ainda não houver um para a mesma URL)
export async function garantirWebhook(url, segredo) {
  const atuais = await chamar('GET', `/sessions/${sid()}/webhooks`);
  const base = url.split('?')[0];
  if ((Array.isArray(atuais) ? atuais : []).some((w) => String(w.url).split('?')[0] === base)) return 'já existia';
  await chamar('POST', `/sessions/${sid()}/webhooks`, { url, events: ['message.received', 'message.sent', 'session.status'], ...(segredo?.length >= 16 ? { secret: segredo } : {}) });
  return 'criado';
}

export async function saudeOpenwa() {
  if (!temChave()) return { ok: false, configurado: false };
  if (!sessaoAtual) return { ok: false, configurado: true, status: 'sem sessão' };
  try {
    const s = await statusSessao();
    return { ok: s.status === 'ready', configurado: true, status: s.status, telefone: s.phone || null, restricao: s.restriction || null };
  } catch (e) {
    return { ok: false, configurado: true, erro: e.message };
  }
}

// corpo do webhook: { event, sessionId, data: { from, to, chatId, body, fromMe, isGroup, kind, senderPhone? } }.
// Remetente com id de privacidade (@lid) só vira telefone com RESOLVE_LID_TO_PHONE=true no OpenWA.
// Só vale conversa 1 a 1 com um número. Grupo, comunidade (que é um grupo "@g.us"), canal, lista de transmissão e
// status são ignorados pelo `kind` E pelo formato do id, para não depender de um campo só (docs/06 e 03 do OpenWA).
const ID_ESPECIAL = /@(g\.us|newsletter|broadcast)$|^status@/i;
export function ehConversaIndividual(d = {}) {
  if (d.isGroup || d.isStatusBroadcast) return false;
  if (d.kind != null && d.kind !== 'individual') return false;
  return ![d.chatId, d.from, d.to].some((id) => ID_ESPECIAL.test(String(id || '')));
}

export function lerMensagemRecebida(payload) {
  const evento = payload?.event || null;
  const d = payload?.data || {};
  const mensagem = evento === 'message.received' || evento === 'message.sent';
  const deMim = Boolean(d.fromMe) || evento === 'message.sent';
  // o outro lado da conversa: em mensagem minha é o destinatário (chatId), em mensagem recebida é quem enviou
  const jid = (ids) => ids.map((x) => String(x || '')).find((x) => x.endsWith('@c.us')) || '';
  const de = deMim ? jid([d.chatId, d.to]) : (d.senderPhone || jid([d.from, d.chatId]));
  const telefone = mensagem && ehConversaIndividual(d) ? String(de).split('@')[0].replace(/\D/g, '') || null : null;
  return { evento, telefone, texto: String(d.body || ''), deMim, status: evento === 'session.status' ? d.status : null };
}

export const PEDIU_PARA_SAIR = /\b(sair|parar|pare|remover|remova|descadastr|n[aã]o (tenho interesse|quero|me mande|mande)|stop)\b/i;
