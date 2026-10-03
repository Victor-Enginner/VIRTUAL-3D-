// Produção — o "quadro de produção" do Órbita, aqui é o pipeline real: uma coluna por etapa,
// com a cor do agente que está com o lead. Clicar abre o lead na gaveta do Painel.
import { montarShell, atualizarShell, ICONES, ic } from './ui/shell.js';
import { api, esc, aCada, ETAPAS, ETAPAS_FORA } from './ui/util.js';

montarShell('producao');
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let filtroNicho = params.get('nicho') || '';
let busca = '';
let verFora = false;
const POR_COLUNA = 40; // acima disso a coluna mostra "+N" (a API devolve até 300 leads)

$('#pagina').innerHTML = `
  <div class="o-topo"><div><p class="eyebrow ciano">PIPELINE</p><h1>Seu quadro de produção.</h1>
    <p class="o-sub">Cada lead na etapa em que está. A cor da faixa é o agente que está com ele agora.</p></div>
    <a class="btn primario" href="/?cartoes=1">Aprovar mensagens</a></div>
  <div class="o-ferramentas">
    <div class="o-modo">${ICONES.producao}Quadro do pipeline <span class="selo-o" id="total">…</span></div>
    <div class="filtros">
      <label class="sr" for="f-busca">Buscar lead</label><input id="f-busca" type="search" placeholder="Buscar empresa, cidade ou ramo…">
      <label class="sr" for="f-nicho">Filtrar por nicho</label><select id="f-nicho"><option value="">Todos os nichos</option></select>
      <button class="btn" id="f-fora" aria-pressed="false">Ver fora do fluxo</button>
    </div>
  </div>
  <div class="o-kanban" id="quadro" aria-live="polite"></div>
  <p class="o-rodape">${ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')}Os agentes movem os cartões sozinhos; você decide na coluna "Para aprovar". Nada é enviado sem a sua aprovação.</p>`;
$('#pagina').removeAttribute('aria-busy');

$('#f-busca').addEventListener('input', (e) => { busca = e.target.value.trim().toLocaleLowerCase('pt-BR'); desenhar(); });
$('#f-nicho').addEventListener('change', (e) => {
  filtroNicho = e.target.value;
  const u = new URL(location.href); filtroNicho ? u.searchParams.set('nicho', filtroNicho) : u.searchParams.delete('nicho'); history.replaceState(null, '', u);
  desenhar();
});
$('#f-fora').addEventListener('click', (e) => { verFora = !verFora; e.currentTarget.setAttribute('aria-pressed', String(verFora)); desenhar(); });

let leads = [], estado = null;
const COR_SITUACAO = { sem_site: 'perigo', site_fora_do_ar: 'perigo', so_rede_social: 'pessego', so_agendamento: 'pessego', site_gratuito: 'violeta', site_proprio: 'ciano' };

function cartao(l) {
  const zona = l.decisao?.zona?.zona === 'meio' && ['qualificado', 'mensagem'].includes(l.etapa) ? '<span class="selo-o lima">pediu sua opinião</span>' : '';
  return `<a class="o-card" href="/#lead=${encodeURIComponent(l.id)}" title="Abrir ${esc(l.nome)}">
    <strong>${esc(l.nome)}</strong>
    <small>${esc(l.categoria || estado?.nichos?.[l.nicho] || '')} · ${esc(l.cidade)}-${esc(l.uf)}</small>
    <span class="linha">${l.situacao_rotulo ? `<span class="selo-o ${COR_SITUACAO[l.situacao_site] || ''}">${esc(l.situacao_rotulo)}</span>` : ''}${zona}${l.score != null ? `<span class="prio-n">${esc(l.score)}</span>` : ''}</span>
  </a>`;
}

function desenhar() {
  const visiveis = leads.filter((l) => (!filtroNicho || l.nicho === filtroNicho)
    && (!busca || `${l.nome} ${l.cidade} ${l.categoria || ''}`.toLocaleLowerCase('pt-BR').includes(busca)));
  $('#total').textContent = String(visiveis.length);
  const colunas = [...ETAPAS.map(([id, rot, dono, desc]) => ({ id, rot, dono, desc })),
    ...(verFora ? ETAPAS_FORA.map(([id, rot]) => ({ id, rot, dono: '', desc: 'fora do fluxo' })) : [])];
  $('#quadro').innerHTML = colunas.map((c) => {
    const daqui = visiveis.filter((l) => l.etapa === c.id);
    const corpo = daqui.slice(0, POR_COLUNA).map(cartao).join('') + (daqui.length > POR_COLUNA ? `<p class="o-mais">+${daqui.length - POR_COLUNA} nesta etapa</p>` : '');
    return `<section class="o-coluna" data-agente="${c.dono}" aria-label="${esc(c.rot)}"><h2><i aria-hidden="true"></i>${esc(c.rot)}<span class="n">${daqui.length}</span></h2><p>${esc(c.desc)}</p>
      <div class="corpo">${corpo || `<div class="o-coluna-vazia">${ICONES.nichos}<span>${busca || filtroNicho ? 'Nada neste filtro.' : 'Espaço para o próximo lead.'}</span></div>`}</div></section>`;
  }).join('');
}

async function atualizar() {
  const [e, r] = await Promise.all([api('/api/estado'), api('/api/leads')]);
  estado = e; leads = r.leads;
  atualizarShell(estado);
  const sel = $('#f-nicho');
  if (sel.options.length === 1) {
    const usados = new Set(leads.map((l) => l.nicho));
    sel.innerHTML += Object.entries(estado.nichos).filter(([k]) => usados.has(k)).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
    sel.value = filtroNicho;
  }
  desenhar();
}
aCada(5000, atualizar);
