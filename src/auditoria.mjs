// Auditor de site: mede fatos (status, HTTPS, viewport, ano no rodapé, tecnologias)
// sem opinião. A URL vem de dado de terceiros (ficha do Maps), então a busca é
// protegida contra SSRF: só http/https, DNS conferido antes, faixas internas recusadas,
// cada redirecionamento revalidado, teto de bytes e de tempo.
// Limite conhecido: DNS rebinding entre a checagem e a conexão (mesma lacuna documentada
// no buscador_de_pagina.py do Repass). Aceitável aqui porque nada da resposta é executado.

import dns from 'node:dns/promises';
import net from 'node:net';

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

async function conferirDestino(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`esquema recusado: ${url.protocol}`);
  const ips = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
  if (!ips.length) throw new Error('DNS sem resposta');
  for (const { address } of ips) if (ipBloqueado(address)) throw new Error(`destino interno recusado (${address})`);
}

async function lerCorpo(resp) {
  const leitor = resp.body?.getReader();
  if (!leitor) return '';
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    partes.push(value);
    if (total >= TETO_BYTES) { await leitor.cancel(); break; }
  }
  return Buffer.concat(partes).toString('utf8');
}

export async function buscarSeguro(endereco) {
  let url = new URL(/^https?:\/\//i.test(endereco) ? endereco : `http://${endereco}`);
  const t0 = performance.now();
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    await conferirDestino(url);
    const resp = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
      url = new URL(resp.headers.get('location'), url);
      continue;
    }
    const html = /html|text/.test(resp.headers.get('content-type') || 'text/html') ? await lerCorpo(resp) : '';
    return { status: resp.status, urlFinal: url.href, headers: resp.headers, html, tempo_ms: Math.round(performance.now() - t0) };
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

export async function auditarSite(site) {
  try {
    const r = await buscarSeguro(site);
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
    const causa = e.cause?.code || e.name;
    return { url: site, erro: causa === 'TimeoutError' ? 'não respondeu em 15 s' : `${causa && causa !== 'Error' ? `${causa}: ` : ''}${e.message}`.slice(0, 200), medido_em: new Date().toISOString() };
  }
}
