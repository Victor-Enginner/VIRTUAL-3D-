// Auditor de site: mede fatos (status, HTTPS, viewport, ano no rodapé, tecnologias)
// sem opinião. A URL vem de dado de terceiros (ficha do Maps), então a busca é
// protegida contra SSRF: só http/https, DNS conferido antes, faixas internas recusadas,
// cada redirecionamento revalidado, teto de bytes e de tempo.
// B15 (arXiv 2610.01768, "Innocent Courier"): a busca na web é um canal de saída. Por isso (1) só se busca URL
// que veio de fonte de coleta (ORIGENS_CONFIAVEIS) — nunca texto de modelo, de site ou de resposta de cliente —
// e (2) a requisição não leva dado do lead: só cabeçalhos fixos.
// DNS rebinding: o IP é validado no `lookup` da própria conexão, então o IP checado é o IP usado.

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';

const BLOQUEADAS = new net.BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]]) BLOQUEADAS.addSubnet(ip, bits, 'ipv4');
for (const [ip, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) BLOQUEADAS.addSubnet(ip, bits, 'ipv6');

export function ipBloqueado(ip) {
  const v4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4) return BLOQUEADAS.check(v4[1], 'ipv4');
  return BLOQUEADAS.check(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4');
}

const TETO_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_SALTOS = 5;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

export const ORIGENS_CONFIAVEIS = new Set(['maps', 'osm']);

// lookup usado na conexão real: resolve, recusa faixa interna e devolve o IP já validado
export function lookupSeguro(host, opcoes, cb) {
  dns.lookup(host, { ...opcoes, all: true }, (err, lista) => {
    if (err) return cb(err);
    if (!lista.length) return cb(new Error('DNS sem resposta'));
    for (const { address } of lista) if (ipBloqueado(address)) return cb(new Error(`destino interno recusado (${address})`));
    if (opcoes?.all) return cb(null, lista);
    cb(null, lista[0].address, lista[0].family);
  });
}

function conferirEsquema(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`esquema recusado: ${url.protocol}`);
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && ipBloqueado(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error(`destino interno recusado (${url.hostname})`);
}

// uma requisição: sem fetch para controlar o lookup da conexão. Devolve {status, headers, location, html}
function requisitar(url, ler) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET', lookup: lookupSeguro, timeout: TIMEOUT_MS,
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', 'Accept-Encoding': 'gzip, deflate, br' },
    }, (res) => {
      const headers = { get: (k) => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v.join(', ') : (v ?? null); } };
      const base = { status: res.statusCode, headers, location: res.headers.location || null };
      const tipo = res.headers['content-type'] || 'text/html';
      if ((res.statusCode >= 300 && res.statusCode < 400 && base.location) || !(ler && /html|text/.test(tipo))) { res.destroy(); return resolve({ ...base, html: '' }); }
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      const fluxo = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
      const partes = []; let total = 0;
      const fim = () => resolve({ ...base, html: Buffer.concat(partes).toString('utf8') });
      fluxo.on('data', (c) => { total += c.length; partes.push(c); if (total >= TETO_BYTES) { res.destroy(); fim(); } });
      fluxo.on('end', fim);
      fluxo.on('error', () => fim()); // corpo truncado ainda serve para medir
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError' })));
    req.on('error', reject);
    req.end();
  });
}

export async function buscarSeguro(endereco, { origem } = {}) {
  if (!ORIGENS_CONFIAVEIS.has(origem)) throw new Error(`origem da URL não confiável (${origem ?? 'sem origem'}): só se busca URL vinda de ${[...ORIGENS_CONFIAVEIS].join(' ou ')}`);
  let url = new URL(/^https?:\/\//i.test(endereco) ? endereco : `http://${endereco}`);
  const t0 = performance.now();
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    conferirEsquema(url);
    const r = await requisitar(url, true);
    if (r.location) { url = new URL(r.location, url); continue; }
    return { status: r.status, urlFinal: url.href, headers: r.headers, html: r.html, tempo_ms: Math.round(performance.now() - t0) };
  }
  throw new Error('redirecionamentos demais');
}

// Extrai fatos do HTML. Função pura: testável com fixtures.
export function analisarHtml(html, anoAtual = new Date().getFullYear()) {
  const h = html || '';
  const anos = [...h.matchAll(/(?:©|&copy;|&#169;|copyright)[^<]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .map((m) => Number(m[2] || m[1])).filter((a) => a >= 1995 && a <= anoAtual);
  const gerador = h.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] || null;
  const tecnologias = [];
  if (/wp-content|wp-includes/i.test(h)) tecnologias.push('WordPress');
  if (/elementor/i.test(h)) tecnologias.push('Elementor');
  if (/static\.wixstatic\.com|wix\.com/i.test(h)) tecnologias.push('Wix');
  if (/squarespace/i.test(h)) tecnologias.push('Squarespace');
  if (/_next\/static/i.test(h)) tecnologias.push('Next.js');
  if (/shopify/i.test(h)) tecnologias.push('Shopify');
  return {
    titulo: h.match(/<title[^>]*>([^<]{0,160})/i)?.[1]?.trim() || null,
    descricao: h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})/i)?.[1] || null,
    viewport: /<meta[^>]+name=["']viewport["']/i.test(h),
    ano_copyright: anos.length ? Math.max(...anos) : null,
    gerador,
    jquery: h.match(/jquery[.-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i)?.[1] || null,
    flash: /\.swf["'?]|application\/x-shockwave-flash/i.test(h),
    link_whatsapp: /wa\.me\/|api\.whatsapp\.com\/send/i.test(h),
    formulario: /<form[\s>]/i.test(h),
    tecnologias,
    tamanho_kb: Math.round(Buffer.byteLength(h) / 1024),
    texto_curto: h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length < 400,
  };
}

export async function auditarSite(site, origem) {
  try {
    const r = await buscarSeguro(site, { origem });
    const fatos = analisarHtml(r.html);
    const original = new URL(/^https?:\/\//i.test(site) ? site : `http://${site}`);
    const final = new URL(r.urlFinal);
    return {
      url: site,
      url_final: r.urlFinal,
      status_http: r.status,
      erro: r.status >= 400 ? `HTTP ${r.status}` : null,
      https: final.protocol === 'https:',
      redireciona_para: final.hostname.replace(/^www\./, '') !== original.hostname.replace(/^www\./, '') ? r.urlFinal : null,
      ultima_modificacao: r.headers.get('last-modified'),
      servidor: r.headers.get('server'),
      tempo_ms: r.tempo_ms,
      ...fatos,
      medido_em: new Date().toISOString(),
    };
  } catch (e) {
    const causa = e.cause?.code || e.code || e.name;
    return { url: site, erro: causa === 'TimeoutError' ? 'não respondeu em 15 s' : `${causa && causa !== 'Error' ? `${causa}: ` : ''}${e.message}`.slice(0, 200), medido_em: new Date().toISOString() };
  }
}
