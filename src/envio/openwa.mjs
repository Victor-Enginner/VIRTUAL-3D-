// Cliente do OpenWA (https://github.com/rmyndharis/OpenWA, MIT). Endpoints conforme o README do projeto:
//   POST /api/sessions/{id}/messages/send-text  { chatId: "5516999999999@c.us", text }
// Autenticação: cabeçalho X-API-Key.
import { CONFIG } from '../config.mjs';

export const openwaConfigurado = () => Boolean(CONFIG.openwa.apiKey && CONFIG.openwa.sessionId);

async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${CONFIG.openwa.url}${caminho}`, {
    method: metodo,
    signal: AbortSignal.timeout(30_000),
    headers: { 'X-API-Key': CONFIG.openwa.apiKey, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let j; try { j = JSON.parse(texto); } catch { j = { bruto: texto.slice(0, 300) }; }
  if (!r.ok) throw new Error(`OpenWA ${r.status}: ${j?.message || j?.error || j?.bruto || ''}`.slice(0, 300));
  return j;
}

export async function enviarTexto(telefone, texto) {
  if (!openwaConfigurado()) throw new Error('OpenWA não configurado (OPENWA_API_KEY e OPENWA_SESSION_ID)');
  return chamar('POST', `/api/sessions/${encodeURIComponent(CONFIG.openwa.sessionId)}/messages/send-text`, { chatId: `${telefone}@c.us`, text: texto });
}

export async function saudeOpenwa() {
  if (!openwaConfigurado()) return { ok: false, configurado: false };
  // /api/docs é o único GET documentado no README; prova que o servidor está de pé,
  // não que a sessão do WhatsApp está conectada (isso aparece no painel do OpenWA).
  try {
    const r = await fetch(`${CONFIG.openwa.url}/api/docs`, { signal: AbortSignal.timeout(4000) });
    return { ok: r.ok, configurado: true, status: r.ok ? 'servidor respondeu' : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, configurado: true, erro: e.message };
  }
}

// O formato exato do evento message.received não está no README; extraímos de forma
// defensiva e o payload bruto vai para o log de eventos para conferência.
export function lerMensagemRecebida(payload) {
  const p = payload?.data || payload?.payload || payload || {};
  const de = p.from || p.chatId || p.message?.from || p.key?.remoteJid || '';
  const texto = p.body || p.text || p.message?.body || p.message?.conversation || '';
  const telefone = String(de).split('@')[0].replace(/\D/g, '') || null;
  return { evento: payload?.event || payload?.type || null, telefone, texto: String(texto), deMim: Boolean(p.fromMe ?? p.key?.fromMe) };
}

export const PEDIU_PARA_SAIR = /\b(sair|parar|pare|remover|remova|descadastr|n[aã]o (tenho interesse|quero|me mande|mande)|stop)\b/i;
