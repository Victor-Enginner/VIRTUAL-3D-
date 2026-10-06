// Acesso remoto (celular via túnel). Quem chega pelo próprio PC entra direto, como sempre;
// quem chega pelo túnel precisa da senha (ACESSO_SENHA no .env).
import crypto from 'node:crypto';

const COOKIE = 'prospector_sessao';
const DURACAO_S = 7 * 24 * 3600;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// O túnel (cloudflared) também conecta pelo 127.0.0.1, mas acrescenta estes cabeçalhos.
// Sem eles e vindo do loopback = alguém no próprio PC.
export function ehLocal(req) {
  const h = req.headers;
  // o túnel chega pelo loopback, mas com o endereço público no Host: se o Host não é o do próprio PC, é remoto
  const hostLocal = !h.host || /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(h.host);
  return LOOPBACK.has(req.socket.remoteAddress) && hostLocal && !h['cf-connecting-ip'] && !h['cf-ray'] && !h['x-forwarded-for'];
}

export const ipDe = (req) => String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '?');

// sessão sem estado: validade + assinatura HMAC com chave derivada da senha.
// Reiniciar o servidor não desloga; trocar a senha invalida todas as sessões.
const chave = (senha) => crypto.createHash('sha256').update(`prospector:${senha}`).digest();
const assinatura = (senha, exp) => crypto.createHmac('sha256', chave(senha)).update(String(exp)).digest('base64url');

export function criarSessao(senha, agoraS = Math.floor(Date.now() / 1000)) {
  const exp = agoraS + DURACAO_S;
  return `${exp}.${assinatura(senha, exp)}`;
}

export function sessaoValida(senha, valor, agoraS = Math.floor(Date.now() / 1000)) {
  const m = /^(\d{10})\.([\w-]{43})$/.exec(String(valor || ''));
  if (!m || Number(m[1]) < agoraS) return false;
  return iguais(m[2], assinatura(senha, m[1]));
}

export function iguais(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

export function lerCookie(req, nome = COOKIE) {
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return null;
}

export const COOKIE_ESPECTADOR = 'prospector_espectador';
export function cookieSessao(valor, https, nome = COOKIE) {
  return `${nome}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_S}${https ? '; Secure' : ''}`;
}
export const cookieSair = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

// tentativas erradas: 5 por IP e 20 no total a cada 10 min (o link do túnel é público)
export function criarLimitador({ porIp = 5, total = 20, janelaMs = 10 * 60_000, relogio = Date.now } = {}) {
  const erros = [];
  const recentes = () => { const t = relogio() - janelaMs; while (erros.length && erros[0].t < t) erros.shift(); return erros; };
  return {
    bloqueado: (ip) => { const r = recentes(); return r.length >= total || r.filter((e) => e.ip === ip).length >= porIp; },
    errou: (ip) => { erros.push({ ip, t: relogio() }); },
  };
}

// o que a tela de entrada precisa carregar antes do login
export const LIVRES = new Set(['/entrar.html', '/api/entrar', '/ui/tokens.css', '/ui/base.css']);
