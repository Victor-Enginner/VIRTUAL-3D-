// Fatos verificáveis ficam no código; o modelo só julga o que é julgamento.
// (arXiv 2610.01834, "Code Owns the Simulation, Jev Owns the Evaluation")

const REDES_SOCIAIS = ['instagram.com', 'instagram.com.br', 'facebook.com', 'facebook.com.br', 'fb.com', 'fb.me', 'tiktok.com', 'linktr.ee', 'linkin.bio', 'beacons.ai',
  'wa.me', 'api.whatsapp.com', 'whatsapp.com', 'youtube.com', 'twitter.com', 'x.com', 'kwai.com', 'bio.link', 'linkbio.co'];
const CARDAPIO = ['goomer.app', 'anota.ai', 'ifood.com.br', 'cardapioweb.com', 'menudino.com', 'deliverydireto.com.br', 'aiqfome.com',
  'saipos.com', 'ola.click', 'pedir.delivery', 'neemo.com.br', 'cardapio.menu', 'instadelivery.com.br', 'consumer.com.br', 'mais.delivery'];
const AGENDAMENTO = ['appbarber.com.br', 'cashbarber.com.br', 'booksy.com', 'trinks.com', 'avec.app', 'salaovip.com.br', 'doctoralia.com.br', 'agendasalao.com.br',
  'simplesagenda.com.br', 'gendo.app', 'agendor.com.br', 'belasis.com.br', 'tuagenda.com', 'calendly.com', 'zarpo.com.br'];
const GRATUITO = ['wixsite.com', 'wordpress.com', 'blogspot.com', 'business.site', 'negocio.site', 'sites.google.com', 'webnode.page',
  'webnode.com.br', 'site123.me', 'godaddysites.com', 'weebly.com', 'jimdosite.com', 'carrd.co', 'canva.site', 'my.canva.site'];

export const SITUACOES = {
  sem_site: 'Sem site',
  so_rede_social: 'Só rede social',
  so_cardapio: 'Só cardápio/delivery',
  so_agendamento: 'Só plataforma de agendamento',
  site_gratuito: 'Site em construtor gratuito',
  site_fora_do_ar: 'Site fora do ar',
  site_proprio: 'Site próprio',
};

function host(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}
const casa = (h, lista) => lista.some((d) => h === d || h.endsWith(`.${d}`));

export function classificarUrl(url) {
  const u = String(url || '').trim();
  if (!u) return 'sem_site';
  const h = host(u);
  if (!h) return 'sem_site';
  if (casa(h, REDES_SOCIAIS)) return 'so_rede_social';
  if (casa(h, CARDAPIO) || /(^|\.)cardapio/.test(h)) return 'so_cardapio';
  if (casa(h, AGENDAMENTO)) return 'so_agendamento';
  if (casa(h, GRATUITO)) return 'site_gratuito';
  return 'site_proprio';
}

// Telefone brasileiro → dígitos com DDI 55 e tipo. Não inventa: sem número válido, devolve null.
export function normalizarTelefone(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d) return { telefone: null, tipo: null };
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return { telefone: null, tipo: null };
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return { telefone: null, tipo: null };
  const local = d.slice(2);
  let tipo = null;
  if (local.length === 9 && local[0] === '9') tipo = 'celular';
  else if (local.length === 8 && /[2-5]/.test(local[0])) tipo = 'fixo';
  else if (local.length === 8 && /[6-9]/.test(local[0])) tipo = 'celular'; // número antigo sem o nono dígito
  if (!tipo) return { telefone: null, tipo: null };
  return { telefone: `55${d}`, tipo };
}

export function formatarTelefone(t) {
  if (!t) return '';
  // Portugal (+351, 9 dígitos) e Paraguai (+595): o número guardado traz o DDI. Brasil começa sempre por 55, então o prefixo não se confunde.
  if (t.startsWith('351') && t.length === 12) return `+351 ${t.slice(3, 6)} ${t.slice(6, 9)} ${t.slice(9)}`;
  if (t.startsWith('595')) {
    const n = t.slice(3);
    return n.length === 9 && n[0] === '9' ? `+595 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : `+595 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`.trim();
  }
  const d = t.slice(2);
  const ddd = d.slice(0, 2), l = d.slice(2);
  return l.length === 9 ? `(${ddd}) ${l.slice(0, 5)}-${l.slice(5)}` : `(${ddd}) ${l.slice(0, 4)}-${l.slice(4)}`;
}

// Sinais de site desatualizado medidos na auditoria (fatos, não opinião).
export function sinaisDeAtraso(aud, anoAtual = new Date().getFullYear()) {
  const s = [];
  if (!aud || aud.erro) return s;
  if (aud.https === false) s.push('sem HTTPS (navegador marca como "não seguro")');
  if (aud.viewport === false) s.push('não se adapta ao celular (sem meta viewport)');
  if (aud.ano_copyright && aud.ano_copyright <= anoAtual - 2) s.push(`rodapé com © ${aud.ano_copyright}`);
  if (aud.ultima_modificacao) {
    const ano = new Date(aud.ultima_modificacao).getFullYear();
    if (ano && ano <= anoAtual - 2) s.push(`servidor informa última modificação em ${ano}`);
  }
  if (aud.flash) s.push('usa Flash');
  if (aud.jquery && /^1\./.test(aud.jquery)) s.push(`jQuery ${aud.jquery} (de antes de 2016)`);
  if (aud.tempo_ms > 6000) s.push(`demorou ${(aud.tempo_ms / 1000).toFixed(1)} s para responder`);
  if (aud.redireciona_para && classificarUrl(aud.redireciona_para) !== 'site_proprio') s.push(`redireciona para ${host(aud.redireciona_para)}`);
  return s;
}
