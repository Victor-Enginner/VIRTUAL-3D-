// Nichos — os "Perfis" do Órbita viram os universos de prospecção: cada nicho com seus leads,
// varreduras por cidade e quanto falta para a Nova decidir sozinha nele (B3/B10).
import { montarShell, atualizarShell, ic } from './ui/shell.js';
import { api, esc, quando, aCada, ETAPAS } from './ui/util.js';

montarShell('nichos');
const $ = (s) => document.querySelector(s);
const CORES = ['lima', 'ciano', 'violeta', 'pessego'];
const SETA = ic('<path d="M5 12h14M13 6l6 6-6 6"/>');
const iniciais = (t) => t.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || t.slice(0, 2).toUpperCase();

$('#pagina').innerHTML = `
  <div class="o-topo"><div><p class="eyebrow" style="color:#ffb070">UNIVERSOS</p><h1>Seus nichos de prospecção.</h1>
    <p class="o-sub">Cada ramo é um universo: onde o Atlas varre, quantos leads viraram mensagem e quando a Nova poderá decidir sozinha nele.</p></div>
    <a class="btn primario" href="/#varredura">${ic('<path d="M12 5v14M5 12h14"/>')}Nova varredura</a></div>
  <p class="o-aviso">${ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')}Os números vêm do banco local. A calibração por nicho é a do B10: 30 decisões suas, erro baixo, e a Nova pode decidir os extremos sozinha.</p>
  <div class="o-universos" id="universos" aria-live="polite"></div>
  <section><div class="o-secao"><div><h2>Ainda não prospectados</h2><p>Ramos que o Atlas sabe buscar e você ainda não varreu.</p></div></div><div class="o-chips" id="livres"></div></section>`;
$('#pagina').removeAttribute('aria-busy');

function universo(n, i) {
  const cor = CORES[i % CORES.length];
  const c = n.calibracao;
  const total = n.total || 0;
  const barras = ETAPAS.map(([id, rot, dono]) => [rot, dono, n.etapas[id] || 0]).filter(([, , v]) => v);
  const fora = (n.etapas.descartado || 0) + (n.etapas.sem_contato || 0);
  return `<article class="o-universo">
    <div class="o-capa ${cor}"><img class="foto" src="/img/nichos/${esc(n.id)}.jpg" alt="" loading="lazy" decoding="async"><span class="aneis" aria-hidden="true"></span><span class="palavra">${esc(n.rotulo)}</span><span class="monograma ${cor}">${esc(iniciais(n.rotulo))}</span><span class="selo-o">${n.varreduras.some((v) => v.ativa) ? 'EM VARREDURA' : 'PARADO'}</span></div>
    <div class="o-universo-corpo">
      <div class="o-universo-titulo"><div><h2>${esc(n.rotulo)}</h2><p>${total} lead(s)${fora ? ` · ${fora} fora do fluxo` : ''}</p></div><a class="btn icone" href="/producao.html?nicho=${encodeURIComponent(n.id)}" aria-label="Ver ${esc(n.rotulo)} no quadro" title="Ver no quadro">${SETA}</a></div>
      <div class="o-funil-mini" role="img" aria-label="Leads por etapa: ${barras.map(([r, , v]) => `${r} ${v}`).join(', ') || 'nenhum'}">${barras.map(([rot, dono, v]) => `<span data-agente="${dono}" style="flex:${v}" title="${esc(rot)}: ${v}"></span>`).join('') || '<span class="vazio"></span>'}</div>
      <ul class="o-legenda">${barras.map(([rot, dono, v]) => `<li data-agente="${dono}"><i></i>${esc(rot)} <b>${v}</b></li>`).join('')}</ul>
      <div class="o-cal"><span>Nova decide sozinha</span><span class="o-barra" style="--cor:${c.pronta ? 'var(--acento)' : 'var(--violeta)'}"><i style="width:${Math.min(100, (100 * c.n) / ((c.n + c.faltam) || 1))}%"></i></span><b>${c.pronta ? 'ligada' : `${c.n}/${c.n + c.faltam}`}</b></div>
      <div class="o-varreduras">${n.varreduras.map((v) => `<span class="selo-o ${v.ativa ? 'ciano' : ''}" title="${v.ultima_execucao ? `última: ${esc(quando(v.ultima_execucao))}` : 'ainda não rodou'}">${esc(v.cidade)}-${esc(v.uf)} · ${esc(v.fonte)}</span>`).join('') || '<span class="selo-o">sem varredura</span>'}</div>
    </div>
  </article>`;
}

async function atualizar() {
  const [estado, { nichos }] = await Promise.all([api('/api/estado'), api('/api/nichos')]);
  atualizarShell(estado);
  const usados = nichos.filter((n) => n.usado).sort((a, b) => b.total - a.total);
  $('#universos').innerHTML = usados.map(universo).join('')
    + `<a class="o-criar" href="/#varredura"><span>${ic('<path d="M12 5v14M5 12h14"/>')}</span><h3>Um novo universo</h3><p>Escolha um ramo e uma cidade.<br>O Atlas começa a varrer.</p></a>`;
  $('#livres').innerHTML = nichos.filter((n) => !n.usado).map((n) => `<a class="selo-o" href="/#varredura">${esc(n.rotulo)}</a>`).join('') || '<span class="o-texto">Todos os ramos já têm varredura.</span>';
}
aCada(8000, atualizar);
// foto do ramo é opcional: sem o arquivo em public/img/nichos/<id>.jpg a capa fica só com o degradê
document.addEventListener('error', (e) => { if (e.target.matches?.('.o-capa .foto')) e.target.remove(); }, true);
