// Partes puras da TV (sem Three): ler o link da Famelack e validar o sinal. Testadas no Node.
// link da Famelack → país e id do canal (o resto do texto colado é ignorado)
export function lerLinkFamelack(texto) {
  const m = String(texto || '').match(/famelack\.com\/tv\/([a-z]{2})\/([a-z0-9]{6,32})/i);
  return m ? { pais: m[1].toLowerCase(), id: m[2] } : null;
}
// só aceita stream HTTPS de playlist HLS (é dado de terceiro, não executa nada)
// Domínios dos canais que usamos: só eles entram no connect-src do servidor (src/server.mjs), o que permite o hls.js
// limitar a qualidade a 360p. Canal de outro domínio continua tocando pelo HLS nativo (sem o teto de qualidade).
export const HOSTS_HLS = ['cdn.live.br1.jmvstream.com', 'rnw-rn.otteravision.com', 'media.cdntvms.com.br', 'tvbrasil-stream.ebc.com.br'];
export const hostLiberado = (u) => { try { return HOSTS_HLS.includes(new URL(u).hostname); } catch { return false; } };
export const streamValido = (u) => /^https:\/\/[^\s"'<>]+\.m3u8(\?[^\s"'<>]*)?$/i.test(String(u || ''));

