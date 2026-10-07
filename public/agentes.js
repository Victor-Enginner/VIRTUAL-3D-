// Agentes — o diretório + detalhe do Órbita, com o que cada agente faz DE VERDADE:
// atividade (eventos reais), função no grafo TOCOMAS (nós, ferramentas, portões, handoffs) e como decide.
import { montarShell, atualizarShell, ICONES, ic } from './ui/shell.js';
import { api, esc, quando, pct, aCada, vazio } from './ui/util.js';

montarShell('agentes');
const $ = (s) => document.querySelector(s);

const FERRAMENTA = {
  coletor_maps: 'Coletor do Google Maps (navegador local)', overpass: 'OpenStreetMap (Overpass)', buscar_seguro: 'Abrir o site com proteções (sem IP interno)',
  regras: 'Regras de fato (determinísticas)', decide: 'decide(): probabilidades sobre opções fechadas', gerar_texto: 'Modelo local de escrita',
  checar_contradicao: 'Checagem de contradições', texto_fixo: 'Texto pronto verdadeiro (quando o modelo falha)', openwa: 'WhatsApp (OpenWA)',
  webhook: 'Respostas recebidas', aprendizado: 'Aprendizado com suas decisões',
};
const ROT_REQ = { telefone: 'telefone', situacao_site: 'situação do site', angulo: 'ângulo da mensagem' };
const ABAS = [['atividade', 'Atividade', ic('<path d="M3 12h4l2-6 4 12 2-6h6"/>')], ['funcao', 'Função e ferramentas', ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>')], ['decide', 'Como decide', ICONES.engine]];

let selecionado = decodeURIComponent(location.hash.slice(1)) || 'alva';
let aba = 'atividade';
let estado = null, grafo = null;

$('#pagina').innerHTML = `
  <div class="o-topo"><div><p class="eyebrow ciano">EQUIPE</p><h1>Sua equipe de prospecção.</h1>
    <p class="o-sub">Cinco agentes, cada um dono de uma etapa. O que aparece aqui é o que eles estão fazendo agora no seu PC.</p></div>
    <a class="btn primario" href="/configurador.html">${ic('<path d="M12 5v14M5 12h14"/>')}Criar agente</a></div>
  <div class="o-equipe">
    <section class="o-diretorio o-painel" aria-label="Agentes"><div class="o-secao"><h2>Seus agentes</h2><span class="selo-o" id="qtd">…</span></div><div id="lista" class="o-lista-ag"></div>
      <a class="o-adicionar" href="/configurador.html">${ic('<path d="M12 5v14M5 12h14"/>')}Adicionar à equipe</a></section>
    <section class="o-detalhe o-painel" id="detalhe" aria-live="polite"></section>
  </div>`;
$('#pagina').removeAttribute('aria-busy');

addEventListener('hashchange', () => { selecionado = decodeURIComponent(location.hash.slice(1)) || 'alva'; desenhar(); });
$('#lista').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ag]'); if (b) { location.hash = b.dataset.ag; aba = 'atividade'; } });
$('#detalhe').addEventListener('click', (ev) => { const b = ev.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; desenhar(); } });
$('#detalhe').addEventListener('keydown', (ev) => { // setas trocam de aba (padrão de tablist)
  if (!ev.target.closest('[role="tab"]') || !['ArrowRight', 'ArrowLeft'].includes(ev.key)) return;
  const i = ABAS.findIndex(([id]) => id === aba);
  aba = ABAS[(i + (ev.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length][0];
  desenhar(); $(`[data-aba="${aba}"]`)?.focus();
});

function statusDe(a) { return estado.pausado ? ['pausa', 'Pausado', 'pessego'] : a.status === 'trabalhando' ? ['on', 'Trabalhando agora', 'lima'] : ['', 'Na mesa, aguardando', '']; }

function desenharLista() {
  const ags = Object.entries(estado.agentes);
  const custom = estado.agentes_custom || [];
  $('#qtd').textContent = String(ags.length + custom.length);
  $('#lista').innerHTML = ags.map(([id, a]) => {
    const [cls] = statusDe(a);
    return `<button class="o-agente" data-ag="${id}" style="--cor:${esc(a.cor)}" aria-current="${id === selecionado}"><span class="o-avatar">${esc(a.nome[0])}</span><span class="info"><strong>${esc(a.nome)}</strong><small>${esc(a.papel)}</small></span><span class="o-ponto ${cls}"></span></button>`;
  }).join('') + (custom.length ? `<p class="eyebrow espaco-p">CRIADOS POR VOCÊ</p>${custom.map((a) => `<a class="o-agente" href="/configurador.html#${encodeURIComponent(a.id)}" style="--cor:${esc(a.cor)}"><span class="o-avatar">${esc(a.nome[0])}</span><span class="info"><strong>${esc(a.nome)}</strong><small>${esc(a.papel || 'agente criado no Configurador')}</small></span></a>`).join('')}` : '');
}

async function corpoAtividade(id) {
  const { eventos } = await api(`/api/eventos?agente=${encodeURIComponent(id)}&limite=30`);
  const a = estado.agentes[id];
  const agora = a.tarefas?.length ? `<p class="o-agora"><span class="o-ponto on"></span>${esc(a.tarefas.map((t) => t.texto).join(' · '))}</p>` : '';
  return agora + (eventos.length ? `<ol class="o-atividade" style="--cor:${esc(a.cor)}">${eventos.map((e) => `<li><span class="o-no">${esc(a.nome[0])}</span><div><p>${esc(e.msg)}</p><time>${esc(quando(e.ts))} · ${esc(e.tipo)}</time></div></li>`).join('')}</ol>`
    : vazio('Sem atividade registrada', `${a.nome} ainda não registrou nenhum evento.`));
}

function corpoFuncao(id) {
  const a = estado.agentes[id];
  const nos = Object.entries(grafo.nos).filter(([, n]) => n.dono === id);
  const recebe = grafo.arestas.filter(([, b]) => nos.some(([n]) => n === b)).map(([x]) => x);
  const passa = grafo.arestas.filter(([x]) => nos.some(([n]) => n === x)).map(([, b]) => b);
  const nomeNo = (n) => `${n.split('_')[0]} · ${n.split('_')[1]}`;
  const ferr = [...new Set(nos.flatMap(([, n]) => n.ferramentas))];
  const reqs = nos.map(([n]) => grafo.requisitos[n] && `<li><b>${esc(nomeNo(n))}</b> só começa com: ${grafo.requisitos[n].map((k) => esc(ROT_REQ[k] || k)).join(', ')} <small>(portão B1 · arXiv 2609.37953)</small></li>`).filter(Boolean);
  return `<section><p class="eyebrow">MISSÃO</p><p class="o-texto">${esc(a.funcao)}</p></section>
    ${nos.length ? `<section><p class="eyebrow">ETAPAS QUE SÃO DELE</p><div class="o-chips">${nos.map(([n]) => `<span class="selo-o ciano">${esc(nomeNo(n))}</span>`).join('')}</div></section>` : `<section><p class="eyebrow">PAPEL</p><p class="o-texto">Controle: abre o expediente, reabre varreduras e pode reabrir qualquer etapa (o "Controle" do grafo).</p></section>`}
    ${ferr.length ? `<section><p class="eyebrow">FERRAMENTAS PERMITIDAS</p><ul class="o-lista">${ferr.map((f) => `<li>${esc(FERRAMENTA[f] || f)}<small>${esc(f)}</small></li>`).join('')}</ul></section>` : ''}
    ${recebe.length || passa.length ? `<section><p class="eyebrow">COM QUEM PASSA TRABALHO</p><dl class="o-kv">${recebe.length ? `<dt>recebe de</dt><dd>${recebe.map((n) => esc(nomeNo(n))).join(', ')}</dd>` : ''}${passa.length ? `<dt>passa para</dt><dd>${passa.map((n) => esc(nomeNo(n))).join(', ')}</dd>` : ''}</dl></section>` : ''}
    ${reqs.length ? `<section><p class="eyebrow">PORTÕES</p><ul class="o-lista">${reqs.join('')}</ul></section>` : ''}`;
}

async function corpoDecide(id) {
  if (id === 'nova') {
    const [{ cabecas }, { nichos }] = await Promise.all([api('/api/aprendizado'), api('/api/nichos')]);
    const ap = cabecas.aprovacao;
    const usados = nichos.filter((n) => n.usado);
    return `<section><p class="eyebrow">FATO É REGRA, JULGAMENTO É MODELO</p><p class="o-texto">O nível de oportunidade sai de regra (situação do site + sinais medidos). O modelo só escolhe entre opções válidas: se o negócio está ativo e qual ângulo usar.</p></section>
      <section><p class="eyebrow">O QUE APRENDEU COM VOCÊ</p><p class="o-texto"><b class="o-num">${ap.exemplos}</b> decisões suas · peso na prioridade ${pct(ap.alfa)}</p>
        ${ap.pesos.length ? `<ul class="o-lista">${ap.pesos.slice(0, 5).map((p) => `<li>${esc(p.nome)}<small>${p.peso > 0 ? 'puxa para aprovar' : 'puxa para descartar'} (${p.peso > 0 ? '+' : ''}${esc(p.peso)})</small></li>`).join('')}</ul>` : ''}</section>
      <section><p class="eyebrow">DECIDIR SOZINHA (3 ZONAS · arXiv 2609.33401)</p>${usados.map((n) => `<div class="o-progresso"><span>${esc(n.rotulo)}</span><span class="o-barra" style="--cor:${n.calibracao.pronta ? 'var(--acento)' : 'var(--violeta)'}"><i style="width:${Math.min(100, (100 * n.calibracao.n) / (n.calibracao.n + n.calibracao.faltam || 1))}%"></i></span><small>${n.calibracao.pronta ? 'ligada' : `${n.calibracao.n} de ${n.calibracao.n + n.calibracao.faltam}`}</small></div>`).join('') || '<p class="o-texto">Nenhum nicho com leads ainda.</p>'}</section>`;
  }
  if (id === 'alva') {
    const ctrl = Object.values(estado.tocomas?.controlador || {});
    return `<section><p class="eyebrow">CONTROLADOR POR REGRA (arXiv 2609.38147)</p><p class="o-texto">Com orçamento pequeno, regra ganha de controlador por modelo. A Alva segura a varredura e a escrita quando já há estoque suficiente.</p></section>
      ${ctrl.length ? `<ul class="o-lista">${ctrl.map((d) => `<li><b>${esc(d.laco === 'varrer' ? 'Varredura' : 'Escrita')}: ${esc(d.escolhida.replace('_', ' '))}</b><small>${esc(d.motivo)}</small></li>`).join('')}</ul>` : vazio('Sem decisões ainda', 'Aparecem assim que os laços rodarem.')}
      <section><p class="eyebrow">LEADS FORA DA FILA</p>${estado.tocomas?.presos?.length ? `<ul class="o-lista">${estado.tocomas.presos.map((p) => `<li><b>${esc(p.nome || p.lead_id)}</b><small>${esc(p.motivo)}${p.recuperacao ? ` · ${esc(p.recuperacao)}` : ''}</small></li>`).join('')}</ul>` : '<p class="o-texto">Nenhum lead preso.</p>'}</section>`;
  }
  if (id === 'leo') {
    const { situacao: s } = await api('/api/envios');
    return `<section><p class="eyebrow">RITMO SEGURO</p><dl class="o-kv"><dt>hoje</dt><dd>${esc(s.enviados_hoje)} de ${esc(s.limite)}</dd><dt>na fila</dt><dd>${esc(s.na_fila)}</dd><dt>agora</dt><dd>${esc(s.pode ? 'pode enviar' : s.motivo)}</dd></dl></section>
      <section><p class="eyebrow">LIMITES</p><p class="o-texto">Só envia o que você aprovou, dentro da janela de horário, com intervalo aleatório entre mensagens e parada imediata em "SAIR".</p></section>`;
  }
  if (id === 'maia') {
    return `<section><p class="eyebrow">ESCREVE SÓ COM FATO MEDIDO</p><p class="o-texto">A Maia vê só o que o domínio Escrita pode ver (sem o HTML do site). Toda mensagem passa por checagens antes de chegar a você:</p>
      <ul class="o-lista"><li>não dizer que o site está fora do ar se não estiver</li><li>não falar de um site que não existe</li><li>não citar nota sem ter nota</li><li>se apresentar e citar o nome do negócio</li><li>nunca se passar pelo próprio negócio</li></ul><p class="o-texto">Se o modelo falhar, entra um texto pronto e verdadeiro.</p></section>`;
  }
  return `<section><p class="eyebrow">COLETA COM SEGURANÇA</p><p class="o-texto">O Atlas só abre endereços que vieram do Maps/OSM, bloqueia IP interno e mede o site (HTTPS, celular, ano no rodapé, tecnologias) sem executar nada da página.</p></section>`;
}

let pedido = 0;
async function desenhar() {
  if (!estado) return;
  if (!estado.agentes[selecionado]) selecionado = 'alva';
  desenharLista();
  const id = selecionado, a = estado.agentes[id];
  const [cls, rot, cor] = statusDe(a);
  const meu = ++pedido;
  const corpo = aba === 'atividade' ? await corpoAtividade(id) : aba === 'funcao' ? corpoFuncao(id) : await corpoDecide(id);
  if (meu !== pedido) return; // chegou resposta de uma troca de aba antiga
  $('#detalhe').innerHTML = `<div class="o-detalhe-topo" style="--cor:${esc(a.cor)}"><span class="o-avatar grande">${esc(a.nome[0])}</span><div><h2>${esc(a.nome)} <span class="selo-o ${cor}"><span class="o-ponto ${cls}"></span>${rot}</span></h2><p>${esc(a.papel)}</p></div>
      <a class="btn icone fantasma" href="/sala.html" title="Ver ${esc(a.nome)} no Paraíso Artificial" aria-label="Ver ${esc(a.nome)} no Paraíso Artificial">${ICONES.sala}</a></div>
    <div class="o-abas" role="tablist" aria-label="Detalhes de ${esc(a.nome)}" style="--aba:${esc(a.cor)}">${ABAS.map(([k, r, i]) => `<button role="tab" data-aba="${k}" aria-selected="${k === aba}" tabindex="${k === aba ? 0 : -1}">${i}${r}</button>`).join('')}</div>
    <div class="o-corpo" role="tabpanel">${corpo}</div>`;
}

async function atualizar() {
  const [e, g] = await Promise.all([api('/api/estado'), grafo ? grafo : api('/api/grafo')]);
  estado = e; grafo = g;
  atualizarShell(estado);
  if (!document.activeElement?.closest('#detalhe')) await desenhar(); // não redesenha enquanto você navega no detalhe
  else desenharLista();
}
aCada(6000, atualizar);
