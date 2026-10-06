// Início — a "Visão geral" do Órbita com os dados reais do Prospector (nada simulado).
import { montarShell, atualizarShell, ICONES, ic } from './ui/shell.js';
import { api, esc, dois, quando, aCada, vazio } from './ui/util.js';
import { montarErosao } from './ui/erosao.js';
import { ligarVoz } from './ui/voz.js';

const SETA = ic('<path d="M5 12h14M13 6l6 6-6 6"/>');
const DIAGONAL = ic('<path d="M7 17L17 7M8 7h9v9"/>');
const PULSO = ic('<path d="M3 12h4l2-6 4 12 2-6h6"/>');
const ESTRELA = ICONES.engine;

montarShell('inicio');
const $ = (s) => document.querySelector(s);
const pagina = $('#pagina');

document.body.classList.add('v-inicio'); // vidro só aqui por enquanto (public/ui/inicio-vidro.css)
const MODOS = [
  ['/#varredura', 'Varrer', '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'],
  ['/?cartoes=1', 'Aprovar', '<path d="M5 12l5 5 9-10"/>', 'selo-aprovar'],
  ['/?enviar=1', 'Enviar', '<path d="M4 12l16-8-6 16-3-6.5z"/><path d="M11 13.5L20 4"/>', 'selo-enviar'],
  ['/producao.html', 'Quadro', '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 4v16"/>'],
  ['/agentes.html', 'Equipe', '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'],
  ['/nichos.html', 'Nichos', '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'],
  ['/sala.html', 'Sala 3D', '<path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6"/>'],
];
pagina.innerHTML = `
  <section class="v-hero" aria-labelledby="t-hero">
    <div class="o-globo" id="globo" aria-hidden="true"></div>
    <p class="eyebrow">SEU ESCRITÓRIO. SUA PROSPECÇÃO.</p>
    <h1 id="t-hero">O que vamos <em>prospectar</em> hoje?</h1>
    <p class="o-sub">Do primeiro achado no mapa à resposta no WhatsApp: a equipe trabalha, você decide.</p>
    <div class="o-linha-comando">
      <button class="mic-voz" id="i-mic" type="button" aria-label="Falar um comando">${ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')}<span>Falar</span></button>
      <form class="o-compositor" id="f-comando">
        <label class="sr" for="i-comando">Comando para a equipe</label>
        <input id="i-comando" type="text" maxlength="300" autocomplete="off" placeholder='Ex.: "varre dentistas em Lisboa Portugal", "busca mais 50", "resumo do dia"'>
        <button class="btn primario" type="submit">Enviar ${SETA}</button>
      </form>
    </div>
    <p class="o-resposta" id="resposta" aria-live="polite"></p>
    <nav class="v-modos" aria-label="Atalhos">
      ${MODOS.map(([href, rot, d, selo]) => `<a class="v-modo" href="${href}"><span class="bola"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg></span>${selo ? `<b class="selo" id="${selo}"></b>` : ''}${rot}</a>`).join('')}
    </nav>
  </section>

  <section class="v-sec">
    <div class="o-secao"><div><h2>Hoje</h2><p>O resumo do escritório, com os números do seu banco.</p></div></div>
    <div class="o-stats" id="stats"></div>
  </section>

  <section class="v-sec">
    <div class="o-secao"><div><h2>Suas buscas</h2><p>Cada cidade e ramo, com o que já foi tratado. Nada se perde.</p></div><a class="o-link" href="/#varredura">Nova busca ${SETA}</a></div>
    <div class="v-buscas" id="buscas"></div>
  </section>

  <div class="o-duas">
    <section>
      <div class="o-secao"><div><h2>Sua equipe</h2><p>Cada agente, uma etapa do pipeline.</p></div><a class="o-link" href="/agentes.html">Ver equipe ${SETA}</a></div>
      <div class="o-agentes" id="equipe"></div>
      <div class="o-secao espaco"><div><h2>Na sua mesa</h2><p>As mensagens mais promissoras esperando você.</p></div><span id="selo-mesa"></span></div>
      <div class="o-mesa" id="mesa"></div>
    </section>
    <section class="o-painel o-movimento">
      <div class="o-secao"><h2>Movimento do escritório</h2>${PULSO}</div>
      <p class="eyebrow">AO VIVO · EVENTOS DOS AGENTES</p>
      <ol class="o-atividade" id="atividade"></ol>
      <p class="o-dica">${ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')}<span>Tudo aqui vem do seu banco local e dos agentes rodando no PC. Nenhum número é demonstração.</span></p>
    </section>
  </div>

  <a class="o-engine" href="/engine.html"><span class="simbolo">${ESTRELA}</span><div><p class="eyebrow">TOCOMAS ENGINE</p><h2>Um lead. Oito passos com portões.</h2><p>Crença, controlador, calibração e regras aprendidas no mesmo motor.</p></div><span class="btn">Abrir o motor ${SETA}</span></a>`;
pagina.removeAttribute('aria-busy');
// comando de voz: o microfone só liga quando você clica; ao terminar de falar, o comando é enviado como se você tivesse digitado
ligarVoz($('#i-mic'), {
  aoMudar: (ouvindo) => { if (ouvindo) $('#resposta').textContent = 'Ouvindo… fale o comando.'; },
  aoParcial: (t) => { $('#i-comando').value = t; },
  aoFinal: () => $('#f-comando').requestSubmit(),
  aoErro: (m) => { $('#resposta').textContent = m; },
});
const globo = montarErosao($('#globo'), { lado: 340 }); // pulsa como coração só quando os agentes estão trabalhando

$('#f-comando').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const texto = $('#i-comando').value.trim();
  if (!texto) return;
  const btn = ev.submitter;
  btn?.setAttribute('aria-busy', 'true');
  $('#resposta').textContent = 'A equipe está lendo…';
  try {
    const r = await api('/api/comando', { texto });
    $('#resposta').textContent = r.resposta;
    $('#i-comando').value = '';
    atualizar();
  } catch (e) { $('#resposta').textContent = `Não deu: ${e.message}`; }
  btn?.removeAttribute('aria-busy');
});

const NO_FLUXO = ['descoberto', 'auditado', 'qualificado', 'mensagem', 'aprovado'];

async function atualizar() {
  const [estado, { eventos }, { leads }, { varreduras }, { buscas }] = await Promise.all([
    api('/api/estado'), api('/api/eventos?limite=8'), api('/api/leads?etapa=mensagem'), api('/api/varreduras'), api('/api/cobertura'),
  ]);
  atualizarShell(estado);
  const ags = Object.entries(estado.agentes);
  const trabalhando = ags.filter(([, a]) => a.status === 'trabalhando').length;
  globo.fluxo(estado.pausado ? 0 : Math.min(1, trabalhando / 3)); // 3 agentes ou mais trabalhando = pulso pleno
  const noFluxo = NO_FLUXO.reduce((s, e) => s + (estado.funil?.[e] || 0), 0);
  const ativas = varreduras.filter((v) => v.ativa).length;
  const n = estado.funil?.mensagem || 0;
  $('#stats').innerHTML = [
    ['ciano', 'Equipe trabalhando', dois(trabalhando), `${ags.length} agentes no pipeline${estado.agentes_custom?.length ? ` · ${estado.agentes_custom.length} criados por você` : ''}`, ICONES.agentes, '/agentes.html'],
    ['pessego', 'Nichos em varredura', dois(ativas), `${new Set(varreduras.map((v) => v.nicho)).size} nicho(s) · ${estado.briefing?.leads ?? 0} leads achados`, ICONES.nichos, '/nichos.html'],
    ['violeta', 'Leads no fluxo', dois(noFluxo), `${estado.funil?.qualificado || 0} com a Maia · ${estado.funil?.aprovado || 0} na fila do Leo`, ICONES.producao, '/producao.html'],
    ['lima', 'Pedem seu olhar', dois(n), n ? 'mensagens esperando aprovação' : 'nada esperando você', ICONES.engine, '/?cartoes=1'],
  ].map(([cor, rot, v, sub, icone, href]) => `<a class="o-stat ${cor}" href="${href}"><span class="rot">${rot}${icone}</span><strong>${v}</strong><small class="o-cap">${esc(sub)}${DIAGONAL}</small></a>`).join('');

  $('#selo-aprovar').textContent = n ? String(n) : '';
  $('#selo-enviar').textContent = estado.envio?.na_fila ? String(estado.envio.na_fila) : '';
  const PAIS = { BR: 'Brasil', PT: 'Portugal', PY: 'Paraguai' };
  $('#buscas').innerHTML = buscas.map((b) => {
    const total = b.lotes.reduce((t, l) => t + l.novos, 0) || b.leads || 1;
    const abertos = b.lotes.reduce((t, l) => t + (l.pendentes || 0), 0);
    const p = Math.round((100 * (total - abertos)) / total);
    return `<a class="v-busca" href="/#varredura"><div class="cab"><div><h3>${esc(b.nicho_rotulo)}</h3><p class="onde">${esc(b.cidade)}-${esc(b.uf)} · ${esc(PAIS[b.pais] || b.pais)}</p></div>
      <div class="v-anel" style="--p:${p}" title="${p}% tratado"><i></i>${p}%</div></div>
      <div class="v-chips"><span class="v-chip">${b.leads} empresas</span><span class="v-chip">${b.sem_site_ou_fraco} sem site ou fraco</span><span class="v-chip ${abertos ? 'aberto' : 'ok'}">${abertos ? `${abertos} em aberto` : 'tratado ✓'}</span></div></a>`;
  }).join('') || vazio('Nenhuma busca ainda', 'Diga um comando, por exemplo "varre dentistas em Lisboa Portugal". A equipe só começa quando você pede.');

  $('#equipe').innerHTML = ags.map(([id, a]) => {
    const on = a.status === 'trabalhando', pausa = estado.pausado;
    const sub = a.tarefas?.length ? a.tarefas[0].texto : a.fila ? `${a.fila} na fila` : a.papel;
    return `<a class="o-agente" href="/agentes.html#${id}" style="--cor:${esc(a.cor)}"><span class="o-avatar">${esc(a.nome[0])}</span><span class="info"><strong>${esc(a.nome)}</strong><small>${esc(sub)}</small></span>
      <span class="o-ponto ${pausa ? 'pausa' : on ? 'on' : ''}" title="${pausa ? 'pausado' : on ? 'trabalhando' : 'na mesa'}"></span>${ic('<path d="M9 6l6 6-6 6"/>')}</a>`;
  }).join('');

  $('#selo-mesa').innerHTML = n ? `<span class="selo-o pessego">${n} PARA APROVAR</span>` : '<span class="selo-o lima">EM DIA</span>';
  $('#mesa').innerHTML = leads.slice(0, 3).map((l) => `<a class="o-mesa-linha" href="/#lead=${encodeURIComponent(l.id)}">
      <span class="o-mesa-icone">${ic('<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>')}</span>
      <span class="info"><small>${esc(l.categoria || '')} · ${esc(l.cidade)}</small><strong>${esc(l.nome)}</strong><span>prioridade <b>${esc(l.score)}</b>${l.situacao_rotulo ? ` · ${esc(l.situacao_rotulo.toLowerCase())}` : ''}</span></span>${SETA}</a>`).join('')
    + (n ? `<a class="btn primario o-mesa-acao" href="/?cartoes=1">Começar a aprovar ${SETA}</a>` : '')
    || vazio('Tudo em dia por aqui', 'Quando a Maia terminar uma mensagem, ela aparece nesta mesa.');

  $('#atividade').innerHTML = eventos.map((e) => {
    const a = estado.agentes[e.agente];
    return `<li style="--cor:${esc(a?.cor || 'var(--texto-3)')}"><span class="o-no">${esc((a?.nome || e.agente)[0])}</span><div><p><b>${esc(a?.nome || e.agente)}</b>${esc(e.msg)}</p><time>${esc(quando(e.ts))}</time></div></li>`;
  }).join('') || '<li><span class="o-no">·</span><div><p>Nenhum evento ainda.</p></div></li>';
}

aCada(5000, atualizar);
