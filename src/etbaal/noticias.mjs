// Notícias de hacking e tecnologia para o telão do 2º andar (pedido do Victor: "sempre hacking ou tecnologia").
// Fontes RSS públicas, buscadas pelo SERVIDOR a cada 15 min (cache): o navegador não fala com sites de terceiros.
// Texto de site é DADO, não instrução (docs/TOCOMAS.md §6): só título, link, fonte e data, sem nenhum HTML.
// só fontes de SEGURANÇA: o feed geral do Olhar Digital foi tirado (trazia futebol e astronomia; pedido é "sempre hacking/tecnologia")
export const FONTES = [
  { nome: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', idioma: 'en' },
  { nome: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', idioma: 'en' },
  { nome: 'Canaltech · Segurança', url: 'https://canaltech.com.br/rss/seguranca/', idioma: 'pt' },
];
const CACHE_MS = 15 * 60_000;

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
export function textoLimpo(s) {
  return String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ') // nada de HTML: só o texto
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entidades[e.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ').trim();
}

// RSS 2.0: <item><title/><link/><pubDate/></item>. Só links http(s).
export function lerRss(xml, fonte) {
  return [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([item]) => {
    const campo = (n) => textoLimpo(item.match(new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)</${n}>`, 'i'))?.[1]);
    const link = campo('link');
    const data = new Date(campo('pubDate'));
    return { titulo: campo('title').slice(0, 160), link: /^https?:\/\//i.test(link) ? link : null, fonte: fonte.nome, idioma: fonte.idioma, em: isNaN(data) ? null : data.toISOString() };
  }).filter((n) => n.titulo);
}

let cache = { em: 0, noticias: [], falhas: [] };
export async function noticias({ buscar = (u) => fetch(u, { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'Mozilla/5.0 (Prospector; leitor RSS)' } }), agora = Date.now() } = {}) {
  if (agora - cache.em < CACHE_MS && cache.noticias.length) return cache;
  const falhas = [];
  const listas = await Promise.all(FONTES.map(async (f) => {
    try { const r = await buscar(f.url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return lerRss(await r.text(), f).slice(0, 12); }
    catch (e) { falhas.push(`${f.nome}: ${e.message}`); return []; }
  }));
  const todas = listas.flat().sort((a, b) => (b.em || '').localeCompare(a.em || ''));
  cache = { em: agora, noticias: todas.slice(0, 40), falhas, atualizado: new Date(agora).toISOString() };
  return cache;
}
