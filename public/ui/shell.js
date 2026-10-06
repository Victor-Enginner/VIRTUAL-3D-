// Barra lateral única das três telas. Mostra a equipe com o status REAL de /api/estado.
import './conforto.js'; // aplica o modo calmo (data-calmo) em toda página, antes de qualquer animação
import { iniciarMascotes } from './mascotes.js'; // desligados por padrão; ver docs/ACESSIBILIDADE.md
import { montarAsciiFluid } from './ascii-fluid.js'; // fundo: tinta de letras que segue o cursor (a rede neural antiga fica em neural.js)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ic = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICONES = {
  painel: ic('<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>'),
  sala: ic('<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>'),
  base: ic('<path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z"/><path d="M9 12l2 2 4-4"/>'),
  configurador: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><path d="M18 8v6M15 11h6"/>'),
  ajustes: ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  menu: ic('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  inicio: ic('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  producao: ic('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9 4v16M15 4v16M3.5 9h17"/>'),
  agentes: ic('<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V5M9 13h.01M15 13h.01M9.5 16.5h5"/><circle cx="12" cy="4" r="1"/>'),
  nichos: ic('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  engine: ic('<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>'),
  fluxos: ic('<circle cx="5" cy="6" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="18" r="2"/><path d="M7 6h4a4 4 0 014 4v0M7 18h4a4 4 0 004-4v0M15 12h2"/>'),
  conforto: ic('<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>'),
  mais: ic('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
};

const MARCA = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#b7ff00"/><path d="M10 23V9h6.5a4.5 4.5 0 010 9H10" fill="none" stroke="#111900" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21.5" cy="22.5" r="2" fill="#111900"/></svg>`;
let neural = null; // rede do fundo (não nas telas que já têm cena 3D)

// Workspace (as abas no estilo do Órbita) e o Escritório (o que já existia, nada removido)
// 5º item = nome curto, que cabe embaixo do ícone no trilho de vidro (o nome inteiro continua no celular e nos títulos)
const PAGINAS = [
  ['inicio', '/inicio.html', 'Visão geral', 'workspace', 'Início'],
  ['painel', '/', 'Painel', 'workspace', 'Painel'],
  ['producao', '/producao.html', 'Produção', 'workspace', 'Produção'],
  ['agentes', '/agentes.html', 'Agentes', 'workspace', 'Agentes'],
  ['nichos', '/nichos.html', 'Nichos', 'workspace', 'Nichos'],
  ['engine', '/engine.html', 'Engine', 'workspace', 'Engine'],
  ['sala', '/sala.html', 'Sala 3D', 'escritorio', 'Sala 3D'],
  ['base', '/base.html', 'Base do Mestre', 'escritorio', 'Base'],
  ['configurador', '/configurador.html', 'Configurador', 'escritorio', 'Config.'],
  ['fluxos', '/fluxos.html', 'Fluxos', 'workspace', 'Fluxos'],
  ['conforto', '/conforto.html', 'Conforto', 'workspace', 'Conforto'],
];
const GRUPOS = { workspace: 'Workspace', escritorio: 'Escritório' };
// celular: 4 destinos + "Mais" (abre a barra lateral com o resto)
const NO_POLEGAR = ['inicio', 'painel', 'producao', 'sala'];

export function montarShell(ativa, { extra = false, fundoNeural = true } = {}) {
  // trilho de vidro (computador): folha de estilo própria, para a barra larga de antes continuar valendo no celular
  for (const href of ['/ui/trilho.css', '/ui/vidro-paginas.css', ...(['sala', 'base'].includes(ativa) ? ['/ui/vidro-sala.css'] : [])]) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.append(l);
  }
  if (fundoNeural) montarAsciiFluid();
  if (!['sala', 'base'].includes(ativa)) iniciarMascotes(); // a Sala 3D já tem os agentes dela
  const lateral = document.querySelector('#lateral');
  lateral.innerHTML = `
    <div class="marca">${MARCA}<div><strong>Prospector</strong><small id="shell-status"><span class="ponto"></span>conectando…</small></div></div>
    <nav class="navegacao" aria-label="Seções">
      ${Object.entries(GRUPOS).map(([g, rot]) => `<p class="nav-grupo">${rot}</p>${PAGINAS.filter((p) => p[3] === g).map(([id, href, r, , curto]) => `<a href="${href}" data-sec="${id}" ${id === ativa ? 'aria-current="page"' : ''}>${ICONES[id]}<span class="rot"><span class="rot-longo">${r}</span><span class="rot-curto">${curto}</span></span>${id === 'painel' ? '<span class="contador" id="shell-aprovar"></span>' : id === 'agentes' ? '<span class="contador" id="shell-agentes"></span>' : ''}</a>`).join('')}`).join('')}
    </nav>
    <button type="button" class="rail-mais" data-rail-mais aria-expanded="false" aria-controls="mais-painel">${ICONES.mais}<span>Mais</span></button>
    <div class="mais-painel" id="mais-painel">
      ${extra ? '<div class="extra" id="shell-extra"></div>' : ''}
      <div class="equipe" id="shell-equipe" aria-live="polite"></div>
      <div class="rodape-lateral"><div><span id="shell-operador">Operador</span><small>dono da conta</small><small>Feito por Victor Borsari</small></div>
        <a class="btn icone fantasma" href="/#ajustes" title="Ajustes" aria-label="Ajustes">${ICONES.ajustes}</a></div>
    </div>`;
  // celular: as 4 telas numa barra embaixo, ao alcance do polegar (o menu lateral fica para a equipe)
  if (!document.querySelector('.nav-inferior')) {
    const curto = { inicio: 'Início', painel: 'Painel', producao: 'Produção', sala: 'Sala' };
    const nav = document.createElement('nav');
    nav.className = 'nav-inferior';
    nav.setAttribute('aria-label', 'Seções');
    const noMais = !NO_POLEGAR.includes(ativa) && ativa;
    nav.innerHTML = PAGINAS.filter(([id]) => NO_POLEGAR.includes(id)).map(([id, href]) => `<a href="${href}" ${id === ativa ? 'aria-current="page"' : ''}>${ICONES[id]}<span>${curto[id]}</span>${id === 'painel' ? '<b class="selo-cont" id="nav-aprovar" hidden></b>' : ''}</a>`).join('')
      + `<button type="button" class="nav-mais" data-abrir-menu ${noMais ? 'aria-current="page"' : ''} aria-label="Mais seções">${ICONES.mais}<span>Mais</span></button>`;
    document.body.append(nav);
    document.body.classList.add('com-nav-inferior');
  }
  // trilho (computador): o "Mais" abre o painel de vidro com a equipe e o cartão do operador
  const app = document.querySelector('.app');
  const botaoMais = document.querySelector('[data-rail-mais]');
  const fecharMais = () => { app.classList.remove('rail-mais'); botaoMais?.setAttribute('aria-expanded', 'false'); };
  botaoMais?.addEventListener('click', (e) => { e.stopPropagation(); const aberto = app.classList.toggle('rail-mais'); botaoMais.setAttribute('aria-expanded', String(aberto)); });
  document.addEventListener('click', (e) => { if (app.classList.contains('rail-mais') && !e.target.closest('.lateral')) fecharMais(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMais(); });
  document.querySelectorAll('[data-abrir-menu]').forEach((b) => b.addEventListener('click', () => document.querySelector('.app').classList.toggle('menu-aberto')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelector('.app').classList.remove('menu-aberto'); });
  document.querySelector('.app').addEventListener('click', (e) => { if (e.target.classList.contains('app')) e.target.classList.remove('menu-aberto'); });
}

const TEXTO_STATUS = { trabalhando: 'trabalhando', ocioso: 'ocioso', pausado: 'pausado' };

export function atualizarShell(estado) {
  if (!estado) return;
  if (estado.demo && !document.querySelector('.faixa-demo')) {
    const f = document.createElement('div');
    f.className = 'faixa-demo';
    f.setAttribute('role', 'note');
    f.innerHTML = '<b>Demonstração</b> · empresas fictícias, nada é enviado. Os agentes trabalham sozinhos; aprove ou descarte à vontade. <a href="/creditos.html">Créditos dos modelos 3D</a>';
    document.body.prepend(f);
    document.body.classList.add('com-faixa-demo');
  }
  const ags = Object.values(estado.agentes);
  const trabalhando = ags.filter((a) => a.status === 'trabalhando').length;
  neural?.atividade(estado.pausado ? 0 : trabalhando); // a rede só se mexe quando a equipe trabalha
  const st = document.querySelector('#shell-status');
  if (st) {
    const cls = estado.pausado ? 'alerta' : trabalhando ? 'vivo' : 'ok';
    st.innerHTML = `<span class="ponto ${cls}"></span>${estado.pausado ? 'agentes pausados' : trabalhando ? `${trabalhando} trabalhando agora` : 'equipe ociosa'}`;
  }
  const ap = document.querySelector('#shell-aprovar');
  if (ap) ap.innerHTML = estado.funil?.mensagem ? `<b>${estado.funil.mensagem}</b><span class="txt"> p/ aprovar</span>` : ''; // trilho: só o número; gaveta do celular: número e texto
  const na = document.querySelector('#nav-aprovar');
  if (na) { na.textContent = estado.funil?.mensagem > 99 ? '99+' : estado.funil?.mensagem || ''; na.hidden = !estado.funil?.mensagem; }
  const ag = document.querySelector('#shell-agentes');
  if (ag) ag.textContent = ags.length + (estado.agentes_custom?.length || 0);
  const op = document.querySelector('#shell-operador');
  if (op) op.textContent = estado.ajustes?.remetente_nome || 'Operador';
  const membro = (a, href) => {
    const status = estado.pausado ? 'pausado' : a.status || 'ocioso';
    const ponto = status === 'trabalhando' ? 'vivo' : status === 'pausado' ? 'alerta' : '';
    const sub = a.tarefas?.length ? a.tarefas.map((t) => t.texto).join(' · ') : a.fila ? `${a.fila} na fila` : a.papel;
    return `<a class="membro" href="${href}"><span class="avatar" style="background:${esc(a.cor)}">${esc(a.nome[0])}<span class="ponto ${ponto}" title="${TEXTO_STATUS[status] || status}"></span></span>
      <span><strong>${esc(a.nome)}</strong><small>${esc(sub)}</small></span></a>`;
  };
  const eq = document.querySelector('#shell-equipe');
  if (eq) {
    // na tela do Configurador a lista própria (com os em criação) já mostra os criados
    const custom = document.querySelector('#shell-extra') ? [] : estado.agentes_custom || [];
    eq.innerHTML = `<h2>Equipe do pipeline</h2>${ags.map((a) => membro(a, '/sala.html')).join('')}
      ${custom.length ? `<h2>Criados por você</h2>${custom.map((a) => membro({ ...a, status: 'ocioso' }, `/configurador.html#${encodeURIComponent(a.id)}`)).join('')}` : ''}`;
  }
}
