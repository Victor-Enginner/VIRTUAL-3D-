// Partes puras da TV (sem Three): ler o link da Famelack e validar o sinal. Testadas no Node.
// link da Famelack → país e id do canal (o resto do texto colado é ignorado)
export function lerLinkFamelack(texto) {
  const m = String(texto || '').match(/famelack\.com\/tv\/([a-z]{2})\/([a-z0-9]{6,32})/i);
  return m ? { pais: m[1].toLowerCase(), id: m[2] } : null;
}
// só aceita stream HTTPS de playlist HLS (é dado de terceiro, não executa nada)
export const streamValido = (u) => /^https:\/\/[^\s"'<>]+\.m3u8(\?[^\s"'<>]*)?$/i.test(String(u || ''));

