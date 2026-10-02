// Barra lateral única das três telas. Mostra a equipe com o status REAL de /api/estado.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ic = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICONES = {
  painel: ic('<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>'),
  sala: ic('<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>'),
  base: ic('<path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z"/><path d="M9 12l2 2 4-4"/>'),
  configurador: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><path d="M18 8v6M15 11h6"/>'),
  ajustes: ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  menu: ic('<path d="M4 7h16M4 12h16M4 17h10"/>'),
};

const MARCA = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#f0953a"/><path d="M10 23V9h6.5a4.5 4.5 0 010 9H10" fill="none" stroke="#0c0c11" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21.5" cy="22.5" r="2" fill="#0c0c11"/></svg>`;

const PAGINAS = [
  ['painel', '/', 'Painel'],
  ['sala', '/sala.html', 'Sala 3D'],
  ['configurador', '/configurador.html', 'Configurador'],
  ['base', '/base.html', 'Base do Mestre'],
];

export function montarShell(ativa, { extra = false } = {}) {
  const lateral = document.querySelector('#lateral');
  lateral.innerHTML = `
    <div class="marca">${MARCA}<div><strong>Prospector</strong><small id="shell-status"><span class="ponto"></span>conectando…</small></div></div>
    <nav class="navegacao" aria-label="Seções">
      ${PAGINAS.map(([id, href, rot]) => `<a href="${href}" ${id === ativa ? 'aria-current="page"' : ''}>${ICONES[id]}${rot}${id === 'painel' ? '<span class="contador" id="shell-aprovar"></span>' : ''}</a>`).join('')}
    </nav>
    ${extra ? '<div class="extra" id="shell-extra"></div>' : ''}
    <div class="equipe" id="shell-equipe" aria-live="polite"></div>
    <div class="rodape-lateral"><div><span id="shell-operador">Operador</span><small>dono da conta</small></div>
      <a class="btn icone fantasma" href="/#ajustes" title="Ajustes" aria-label="Ajustes">${ICONES.ajustes}</a></div>`;
  document.querySelectorAll('[data-abrir-menu]').forEach((b) => b.addEventListener('click', () => document.querySelector('.app').classList.toggle('menu-aberto')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelector('.app').classList.remove('menu-aberto'); });
  document.querySelector('.app').addEventListener('click', (e) => { if (e.target.classList.contains('app')) e.target.classList.remove('menu-aberto'); });
}

const TEXTO_STATUS = { trabalhando: 'trabalhando', ocioso: 'ocioso', pausado: 'pausado' };

export function atualizarShell(estado) {
  if (!estado) return;
  const ags = Object.values(estado.agentes);
  const trabalhando = ags.filter((a) => a.status === 'trabalhando').length;
  const st = document.querySelector('#shell-status');
  if (st) {
    const cls = estado.pausado ? 'alerta' : trabalhando ? 'vivo' : 'ok';
    st.innerHTML = `<span class="ponto ${cls}"></span>${estado.pausado ? 'agentes pausados' : trabalhando ? `${trabalhando} trabalhando agora` : 'equipe ociosa'}`;
  }
  const ap = document.querySelector('#shell-aprovar');
  if (ap) ap.textContent = estado.funil?.mensagem ? `${estado.funil.mensagem} p/ aprovar` : '';
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
