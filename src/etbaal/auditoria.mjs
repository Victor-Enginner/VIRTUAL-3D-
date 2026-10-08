// Etbaal — auditoria de segurança PASSIVA do site e do e-mail do domínio de um lead (especificação: agentes/etbaal.json).
// Passiva = o mesmo que um navegador faz: uma visita HTTP, um aperto de mão TLS e consultas públicas de DNS.
// Nada de varrer portas, testar senha, enviar formulário ou explorar falha (lista "proibido" da especificação).
//
// Cada achado traz EVIDÊNCIA (o valor visto) e a NORMA de origem; sem evidência não existe achado (regra do eval).
// Base: RFC 6797 (HSTS), RFC 7208 (SPF), RFC 7489 (DMARC), OWASP Secure Headers; 55,66% de sites populares tiram F em
// cabeçalhos (arXiv 2410.14924); DMARC em só ~3% dos domínios (arXiv 1711.06654).
//
// Dependências injetáveis (`dep`) para o teste rodar sem rede: fetch, resolverTxt, certificado.
import dns from 'node:dns/promises';
import tls from 'node:tls';
import { classificarUrl } from '../regras.mjs';
import { autorizar } from '../especificacao.mjs';

const TEMPO = 10000;
const UA = 'Mozilla/5.0 (compatible; Etbaal-auditoria-passiva/1.0)';

export const SEVERIDADE = { alta: 3, media: 2, baixa: 1 };

function hostDe(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase(); } catch { return null; }
}
// domínio de e-mail: tira o "www." (SPF/DMARC moram no domínio, não no subdomínio do site)
const dominioDe = (host) => host.replace(/^www\./, '');

async function certificadoReal(host) {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: TEMPO, rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate();
      resolve({ valido: s.authorized, erro: s.authorizationError ? String(s.authorizationError) : null, expira: c?.valid_to ? new Date(c.valid_to).toISOString() : null });
      s.end();
    });
    s.on('error', (e) => resolve({ valido: false, erro: e.code || e.message, expira: null }));
    s.on('timeout', () => { s.destroy(); resolve({ valido: false, erro: 'tempo esgotado', expira: null }); });
  });
}

// Erro de REDE não é erro de certificado (falso positivo visto em 08/10: domínio inexistente virou "certificado inválido")
const TRANSITORIO = /^(EAI_AGAIN|ETIMEDOUT|ECONNRESET|tempo esgotado)$/;
const SEM_TLS = /^(ECONNREFUSED|EHOSTUNREACH|ENETUNREACH)$/;
const CADEIA_INCOMPLETA = /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT/;

const DEP_REAL = {
  existe: async (host) => { try { await dns.lookup(host); return { ok: true }; } catch (e) { return { ok: false, erro: e.code || e.message }; } },
  fetch: (url, op = {}) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TEMPO), headers: { 'user-agent': UA }, ...op }),
  resolverTxt: async (nome) => { try { return (await dns.resolveTxt(nome)).map((partes) => partes.join('')); } catch { return []; } },
  certificado: certificadoReal,
};

export async function auditar(especificacao, siteDoLead, dep = DEP_REAL, agora = new Date()) {
  const tipo = classificarUrl(siteDoLead);
  if (tipo !== 'site_proprio') return { auditado: false, motivo: `não é site próprio (${tipo}): o dono não controla esse domínio`, achados: [] };
  const host = hostDe(siteDoLead);
  if (!host) return { auditado: false, motivo: 'endereço inválido', achados: [] };
  // o domínio existe? Se não existe, não há o que auditar (é "site fora do ar", não falha de segurança)
  const ex = await dep.existe(host);
  if (!ex.ok) return TRANSITORIO.test(ex.erro) ? { auditado: false, transitorio: true, motivo: `falha temporária de DNS (${ex.erro}); tentar de novo`, achados: [] } : { auditado: false, motivo: `o domínio ${host} não existe no DNS (${ex.erro}): site fora do ar`, achados: [] };
  const achados = [];
  const achar = (id, severidade, titulo, evidencia, norma) => achados.push({ id, severidade, titulo, evidencia: String(evidencia).slice(0, 200), norma });

  // 1. HTTP → HTTPS
  autorizar(especificacao, 'http_get_publico');
  try {
    const r = await dep.fetch(`http://${host}/`);
    const destino = r.headers.get('location') || '';
    if (!(r.status >= 300 && r.status < 400 && /^https:\/\//i.test(destino))) achar('sem_redirecionamento_https', 'media', 'Quem digita o endereço sem "https" fica numa conexão sem criptografia', `http://${host}/ respondeu ${r.status}${destino ? ` → ${destino}` : ''}`, 'RFC 6797 §7.2');
  } catch (e) { /* sem porta 80 aberta não é falha */ }

  // 2. certificado
  autorizar(especificacao, 'tls_handshake');
  const cert = await dep.certificado(host);
  if (!cert.valido && TRANSITORIO.test(cert.erro || '')) return { auditado: false, transitorio: true, motivo: `conexão segura não respondeu (${cert.erro}); tentar de novo`, achados: [] };
  if (!cert.valido && SEM_TLS.test(cert.erro || '')) achar('sem_https', 'alta', 'O site não aceita conexão segura (HTTPS): tudo trafega sem criptografia', `TLS em ${host}:443 → ${cert.erro}`, 'RFC 2818');
  else if (!cert.valido && CADEIA_INCOMPLETA.test(cert.erro || '')) achar('cadeia_incompleta', 'media', 'O certificado está incompleto: alguns celulares e navegadores mostram aviso', `TLS em ${host}:443 → ${cert.erro}`, 'RFC 5246 §7.4.2');
  else if (!cert.valido) achar('certificado_invalido', 'alta', 'O navegador mostra aviso de "site não seguro" para os clientes', `TLS em ${host}:443 → ${cert.erro || 'não confiável'}`, 'RFC 5280 / CA/B Forum');
  else if (cert.expira) {
    const dias = Math.floor((new Date(cert.expira) - agora) / 86400000);
    if (dias < 15) achar('certificado_vencendo', 'media', `O certificado vence em ${dias} dia(s)`, `válido até ${cert.expira}`, 'CA/B Forum');
  }

  // 3. página principal por HTTPS: cabeçalhos e software exposto
  let html = '', cab = null;
  if (cert.valido) {
    try {
      const r = await dep.fetch(`https://${host}/`, { redirect: 'follow' });
      cab = r.headers;
      html = (await r.text()).slice(0, 300000);
    } catch (e) { achar('https_sem_resposta', 'media', 'A página não respondeu por HTTPS', e.message, 'RFC 2818'); }
  }
  if (cab) {
    const falta = (h) => !cab.get(h);
    if (falta('strict-transport-security')) achar('sem_hsts', 'media', 'O navegador não é obrigado a sempre usar conexão segura (HSTS ausente)', 'cabeçalho Strict-Transport-Security não enviado', 'RFC 6797');
    if (falta('content-security-policy')) achar('sem_csp', 'baixa', 'Sem política que bloqueie scripts injetados (CSP ausente)', 'cabeçalho Content-Security-Policy não enviado', 'OWASP Secure Headers');
    if (falta('x-frame-options') && !/frame-ancestors/i.test(cab.get('content-security-policy') || '')) achar('sem_anti_clickjacking', 'baixa', 'O site pode ser embutido em outra página para enganar o cliente (clickjacking)', 'sem X-Frame-Options nem frame-ancestors', 'OWASP Secure Headers');
    if (falta('x-content-type-options')) achar('sem_nosniff', 'baixa', 'Falta proteção contra o navegador "adivinhar" o tipo de arquivo', 'cabeçalho X-Content-Type-Options não enviado', 'OWASP Secure Headers');
    for (const h of ['server', 'x-powered-by']) {
      const v = cab.get(h) || '';
      if (/\d+\.\d+/.test(v)) achar(`versao_exposta_${h.replace(/-/g, '_')}`, 'media', 'O servidor anuncia a versão exata do software (facilita achar falha conhecida)', `${h}: ${v}`, 'OWASP Secure Headers');
    }
  }
  const gerador = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (gerador && /\d+\.\d+/.test(gerador)) achar('versao_cms_exposta', 'media', 'A página anuncia o sistema e a versão (ex.: WordPress)', `meta generator: ${gerador}`, 'OWASP Secure Headers');
  if (cab && /src=["']http:\/\//i.test(html)) achar('conteudo_misto', 'baixa', 'A página segura carrega arquivo por conexão sem criptografia', html.match(/src=["'](http:\/\/[^"']+)/i)?.[1] || 'src="http://…"', 'W3C Mixed Content');

  // 4. e-mail do domínio: SPF e DMARC (impedem golpe com e-mail falso em nome da empresa)
  autorizar(especificacao, 'dns_txt');
  const dominio = dominioDe(host);
  const txt = await dep.resolverTxt(dominio);
  const spf = txt.find((t) => /^v=spf1\b/i.test(t));
  if (!spf) achar('sem_spf', 'alta', 'Qualquer um pode mandar e-mail "em nome" da empresa (SPF ausente)', `TXT de ${dominio} sem v=spf1`, 'RFC 7208');
  else if (/\+all\b/.test(spf)) achar('spf_permissivo', 'alta', 'O SPF autoriza qualquer servidor a enviar como a empresa (+all)', spf, 'RFC 7208 §5.1');
  const dmarc = (await dep.resolverTxt(`_dmarc.${dominio}`)).find((t) => /^v=DMARC1\b/i.test(t));
  if (!dmarc) achar('sem_dmarc', 'alta', 'Golpe de e-mail falso em nome da empresa não é bloqueado (DMARC ausente)', `TXT de _dmarc.${dominio} sem v=DMARC1`, 'RFC 7489');
  else if (/\bp=none\b/i.test(dmarc)) achar('dmarc_so_monitora', 'media', 'O DMARC só observa: e-mail falso ainda chega ao cliente (p=none)', dmarc, 'RFC 7489 §6.3');

  const peso = achados.reduce((a, x) => a + SEVERIDADE[x.severidade], 0);
  return { auditado: true, host, dominio, nota: Math.max(0, 100 - peso * 8), achados: achados.sort((a, b) => SEVERIDADE[b.severidade] - SEVERIDADE[a.severidade]), em: agora.toISOString() };
}
