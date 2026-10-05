// Canal de WhatsApp: o ÚNICO ponto que conhece o provedor (hoje o OpenWA). O resto do sistema fala com `canal` e lê
// eventos normalizados de `lerEvento`; trocar de provedor (ex.: Evolution API) é escrever outro arquivo com esta mesma forma:
//   canal = { nome, configurado(), saude(), enviarTexto(telefone, texto), idDaResposta(resp) }
//   lerEvento(payload) → { tipo: 'mensagem' | 'recibo' | 'conexao' | 'ignorado', ... }
import { enviarTexto, lerMensagemRecebida, openwaConfigurado, saudeOpenwa } from './openwa.mjs';

export const canal = {
  nome: 'openwa',
  configurado: openwaConfigurado,
  saude: saudeOpenwa,
  enviarTexto,
  // o OpenWA responde ao envio com o id da mensagem no WhatsApp (messageId); é com ele que os recibos chegam depois
  idDaResposta: (resp) => resp?.messageId ?? resp?.waMessageId ?? resp?.id ?? null,
};

// Restrição da conta: o formato exato do evento `session.restriction` não está nos exemplos da documentação do OpenWA, então
// qualquer valor que não seja "sem restrição" conta como restrição. Errar para esse lado só pausa o envio, nunca o libera.
const restricaoDe = (d) => {
  const r = d.restriction ?? d.restricted ?? d.type ?? d.reason;
  if (r === false || r == null || r === 'none' || r === 'lifted') return null;
  return typeof r === 'string' ? r : 'ativa';
};

export function lerEvento(payload) {
  const ev = payload?.event || null;
  const d = payload?.data || {};
  if (ev === 'message.ack' || ev === 'message.failed') {
    return { tipo: 'recibo', evento: ev, waId: d.messageId ?? d.id ?? null, recibo: ev === 'message.failed' ? 'failed' : (d.status ?? null), erro: d.error ?? d.reason ?? null };
  }
  if (ev === 'session.status') return { tipo: 'conexao', evento: ev, status: d.status ?? null, restricao: null };
  if (ev === 'session.restriction') return { tipo: 'conexao', evento: ev, status: null, restricao: restricaoDe(d) ?? false };
  if (ev === 'session.disconnected' || ev === 'session.reconnect_loop' || ev === 'session.authenticated') {
    return { tipo: 'conexao', evento: ev, status: ev === 'session.authenticated' ? 'ready' : ev.slice('session.'.length), restricao: null };
  }
  if (ev === 'message.received' || ev === 'message.sent') {
    const m = lerMensagemRecebida(payload);
    return { tipo: 'mensagem', evento: ev, telefone: m.telefone, texto: m.texto, deMim: m.deMim, waId: d.id ?? d.messageId ?? null };
  }
  return { tipo: 'ignorado', evento: ev };
}
