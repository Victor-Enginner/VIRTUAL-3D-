// Início — a "Visão geral" do Órbita com os dados reais do Prospector (nada simulado).
import { montarShell, atualizarShell, ICONES, ic } from './ui/shell.js';
import { api, esc, dois, quando, aCada, vazio } from './ui/util.js';
import { montarGlobo } from './ui/globo.js';
import { vestirAviao } from './ui/botao-aviao.js';
import { ligarVoz } from './ui/voz.js';

const SETA = ic('<path d="M5 12h14M13 6l6 6-6 6"/>');
const DIAGONAL = ic('<path d="M7 17L17 7M8 7h9v9"/>');
const PULSO = ic('<path d="M3 12h4l2-6 4 12 2-6h6"/>');
const ESTRELA = ICONES.engine;

montarShell('inicio');
const $ = (s) => document.querySelector(s);
const pagina = $('#pagina');

pagina.innerHTML = `
  <section class="o-hero" aria-labelledby="t-hero">
    <div class="o-globo" id="globo" aria-hidden="true"></div>
    <p class="eyebrow">SEU ESCRITÓRIO. SUA PROSPECÇÃO.</p>
    <h1 id="t-hero">O que vamos prospectar hoje?</h1>
    <p class="o-sub">Do primeiro achado no Maps à resposta no WhatsApp: a equipe trabalha, você decide.</p>
    <div class="o-linha-comando">
    <button class="mic-voz" id="i-mic" type="button" aria-label="Falar um comando">${ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')}<span>Falar</span></button>
    <form class="o-compositor" id="f-comando">
      <label class="sr" for="i-comando">Comando para os agentes</label>
      <textarea id="i-comando" rows="2" maxlength="300" placeholder='Ex.: "varre barbearias em Franca SP", "resumo do dia", "pausar"'></textarea>
      <div class="o-compositor-base"><span>${ICONES.agentes}Comando para a equipe <span class="o-local">· roda no seu PC</span></span>
        <button class="btn primario" type="submit">Enviar ${SETA}</button></div>
      <p class="o-resposta" id="resposta" aria-live="polite"></p>
    </form>
    </div>
    <div class="o-atalhos" aria-label="Atalhos">
      <a class="btn" href="/?cartoes=1">${ICONES.painel}Aprovar mensagens</a>
      <a class="btn" href="/producao.html">${ICONES.producao}Abrir o quadro</a>
      <a class="btn" href="/sala.html">${ICONES.sala}Entrar na Sala 3D</a>
    </div>
  </section>
  <a class="o-engine" href="/engine.html"><span class="simbolo">${ESTRELA}</span><div><p class="eyebrow">TOCOMAS ENGINE</p><h2>Um lead. Oito passos com portões.</h2><p>Crença, controlador, calibração e regras aprendidas no mesmo motor.</p></div><span class="btn">${SETA}Abrir o motor</span></a>
  <div class="o-ilha-envios" id="ilha-envios"></div>
  <div class="o-stats" id="stats"></div>
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
  </div>`;
pagina.removeAttribute('aria-busy');
vestirAviao($('#f-comando button[type=submit]'), { texto: 'Enviar' }).classList.add('compacto');
// comando de voz: o microfone só liga quando você clica; ao terminar de falar, o comando é enviado como se você tivesse digitado
ligarVoz($('#i-mic'), {
  aoMudar: (ouvindo) => { if (ouvindo) $('#resposta').textContent = 'Ouvindo… fale o comando.'; },
  aoParcial: (t) => { $('#i-comando').value = t; },
  aoFinal: () => $('#f-comando').requestSubmit(),
  aoErro: (m) => { $('#resposta').textContent = m; },
});
try { window.Ilhas?.montar('cartao-envios', $('#ilha-envios')); } catch { /* sem a ilha o Início funciona igual */ }
const globo = montarGlobo($('#globo'), { lado: 280 }); // pulsa como coração só quando os agentes estão trabalhando

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
$('#i-comando').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#f-comando').requestSubmit(); } });

const NO_FLUXO = ['descoberto', 'auditado', 'qualificado', 'mensagem', 'aprovado'];

async function atualizar() {
  const [estado, { eventos }, { leads }, { varreduras }] = await Promise.all([
    api('/api/estado'), api('/api/eventos?limite=8'), api('/api/leads?etapa=mensagem'), api('/api/varreduras'),
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
