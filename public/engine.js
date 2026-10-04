// Engine — o "Production Engine" do Órbita, aqui é o motor TOCOMAS real do Prospector:
// etapas T1–T8 com portões, crença/presos, controlador, calibração, regras aprendidas e os papers por trás.
import { montarShell, atualizarShell, ICONES, ic } from './ui/shell.js';
import { api, esc, pct, aCada, vazio } from './ui/util.js';

montarShell('engine');
const $ = (s) => document.querySelector(s);

const DOMINIO = { coleta: 'Coleta', juizo: 'Juízo', escrita: 'Escrita', decisao_humana: 'Decisão humana', envio: 'Envio' };
const NOME_NO = { T1_varrer: 'Varrer o mapa', T2_auditar: 'Auditar o site', T3_qualificar: 'Qualificar', T4_redigir: 'Redigir a mensagem', T5_aprovar: 'Sua aprovação', T6_despachar: 'Enviar', T7_acompanhar: 'Acompanhar respostas', T8_aprender: 'Aprender com você' };
const ENTREGA = { T1_varrer: 'Leads novos com fonte (Maps/OSM)', T2_auditar: 'Situação do site + sinais de atraso medidos', T3_qualificar: 'Oportunidade (regra), atividade e ângulo (modelo), prioridade', T4_redigir: 'Mensagem checada contra contradições', T5_aprovar: 'Aprovar ou descartar com motivo', T6_despachar: 'Envio no ritmo seguro', T7_acompanhar: 'Resposta, SAIR ou silêncio de 72 h', T8_aprender: 'Cabeças, calibração e propostas de regra' };
const DONO = { atlas: 'Atlas', nova: 'Nova', maia: 'Maia', leo: 'Leo', operador: 'Você' };
const ROT_REQ = { telefone: 'telefone', situacao_site: 'situação do site', angulo: 'ângulo', telefone_celular: 'celular (se "só celular" estiver ligado)' };
const FERRAMENTA = { coletor_maps: 'coletor do Maps', overpass: 'OpenStreetMap', buscar_seguro: 'abrir site com proteções', regras: 'regras de fato', decide: 'decide()', gerar_texto: 'modelo de escrita', checar_contradicao: 'checagem de contradições', texto_fixo: 'texto pronto', openwa: 'WhatsApp', webhook: 'webhook', aprendizado: 'aprendizado' };
const PAPERS = [
  ['2609.37953', 'TOCOMAS', 'Grafo de tarefas, handoff só por aresta e portão de passagem (sem ele: −40,85)', 'Etapas · Portões'],
  ['2610.01415', 'PoS: crença explícita', 'Fatos com fonte e validade; preso por estagnação, recorrência e persistência', 'Portões e presos'],
  ['2609.38147', 'Meta-Reasoning', 'Com orçamento pequeno, controlador por regra vence o por modelo', 'Controlador'],
  ['2609.33401', 'System One', 'Política de 3 zonas e calibração por grupo (a média esconde falhas)', 'Calibração'],
  ['2609.38143', 'Meta-skills', 'Regra aprendida = quando, o que fornecer, o que continua seu; com evidência', 'Regras aprendidas'],
  ['2609.38108', 'Planning-as-Routing', 'Fidelidade ao plano: ferramenta fora do plano é desvio', 'Fidelidade'],
  ['2609.31937', 'V-model', 'Portões determinísticos fizeram 8 de 9 correções; só veredito escreve na memória', 'Portões'],
  ['2610.02001', 'Mingbird', 'Harness local para modelos pequenos: prompt enxuto, anti-loop, término checado', 'Próximos passos'],
];
const ABAS = [
  ['etapas', 'Etapas', ICONES.producao], ['portoes', 'Portões e presos', ic('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>')],
  ['controlador', 'Controlador', ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>')],
  ['calibracao', 'Calibração', ic('<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>')], ['regras', 'Regras aprendidas', ICONES.engine], ['papers', 'Papers', ic('<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>')],
];

const pct1 = (p) => `${(p * 100).toFixed(1).replace('.', ',')}%`; // 10,5% não pode virar 11%
let aba = location.hash.slice(1) || 'etapas';
let noSel = 'T3_qualificar';
let dados = null;

$('#pagina').innerHTML = `
  <div class="o-topo"><div><p class="eyebrow violeta">TOCOMAS / ENGINE</p><h1>Um lead. Oito passos com portões.</h1>
    <p class="o-sub">O motor que move cada lead: quem pode fazer o quê, o que precisa existir antes de cada passo e o que a equipe aprende com você.</p></div></div>
  <section class="o-motor" id="motor"></section>
  <div class="o-abas" role="tablist" aria-label="Partes do motor" style="--aba:var(--violeta)" id="abas"></div>
  <div id="corpo" role="tabpanel" aria-live="polite"></div>`;
$('#pagina').removeAttribute('aria-busy');

$('#abas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; history.replaceState(null, '', `#${aba}`); desenhar(); } });
$('#abas').addEventListener('keydown', (ev) => {
  if (!['ArrowRight', 'ArrowLeft'].includes(ev.key)) return;
  const i = ABAS.findIndex(([k]) => k === aba);
  aba = ABAS[(i + (ev.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length][0];
  history.replaceState(null, '', `#${aba}`); desenhar(); $(`[data-aba="${aba}"]`)?.focus();
});
$('#corpo').addEventListener('click', async (ev) => {
  const no = ev.target.closest('[data-no]');
  if (no) { noSel = no.dataset.no; desenhar(); return; }
  const r = ev.target.closest('[data-regra]');
  if (r) {
    r.setAttribute('aria-busy', 'true');
    try { await api(`/api/habilidades/${encodeURIComponent(r.dataset.regra)}/${r.dataset.acao}`, {}); } catch { /* o estado novo mostra o que valeu */ }
    await atualizar();
  }
});

function contagem(no, d) {
  const f = d.estado.funil || {};
  return { T1_varrer: d.varreduras.filter((v) => v.ativa).length, T2_auditar: f.descoberto || 0, T3_qualificar: f.auditado || 0, T4_redigir: f.qualificado || 0,
    T5_aprovar: f.mensagem || 0, T6_despachar: f.aprovado || 0, T7_acompanhar: (f.enviado || 0) + (f.respondeu || 0) + (f.fechado || 0) + (f.perdido || 0), T8_aprender: d.aprendizado.aprovacao.exemplos }[no];
}
const ROT_CONT = { T1_varrer: 'varreduras ativas', T8_aprender: 'decisões suas' };

function abaEtapas(d) {
  const nos = Object.entries(d.grafo.nos);
  const [id, n] = nos.find(([k]) => k === noSel) || nos[2];
  const idx = nos.findIndex(([k]) => k === id);
  const recebe = d.grafo.arestas.filter(([, b]) => b === id).map(([a]) => a);
  const passa = d.grafo.arestas.filter(([a]) => a === id).map(([, b]) => b);
  const req = d.grafo.requisitos[id] || [];
  return `<div class="o-linha-prod">
    <div class="o-indice"><div class="o-secao"><h2>LINHA DO PIPELINE</h2><span class="selo-o">${nos.length} etapas</span></div>
      ${nos.map(([k, x], i) => `<button class="o-passo" data-no="${k}" data-agente="${x.dono}" aria-current="${k === id}"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="info"><strong>${esc(NOME_NO[k])}</strong><small>${esc(DONO[x.dono] || x.dono)} · ${esc(DOMINIO[x.dominio])}</small></span><b>${contagem(k, d)}</b></button>`).join('')}</div>
    <article class="o-etapa o-painel" data-agente="${n.dono}">
      <div class="o-etapa-topo"><div><p class="eyebrow">ETAPA ${String(idx + 1).padStart(2, '0')} / ${esc(DOMINIO[n.dominio].toUpperCase())}</p><h2>${esc(NOME_NO[id])}</h2><p class="o-texto">Entrega: ${esc(ENTREGA[id])}</p></div>
        <span class="selo-o ${n.dono === 'operador' ? 'pessego' : 'violeta'}">${esc(DONO[n.dono] || n.dono)}</span></div>
      <div class="o-grade-itens">
        <div><span class="i">01</span>Agora nesta etapa: <b>${contagem(id, d)}</b> ${esc(ROT_CONT[id] || 'leads')}</div>
        <div><span class="i">02</span>Recebe de: ${recebe.map((k) => esc(NOME_NO[k])).join(', ') || 'Controle (Alva) ou varredura agendada'}</div>
        <div><span class="i">03</span>Passa para: ${passa.map((k) => esc(NOME_NO[k])).join(', ') || 'fim do ciclo (volta como aprendizado)'}</div>
        <div><span class="i">04</span>Ferramentas: ${n.ferramentas.map((f) => esc(FERRAMENTA[f] || f)).join(', ') || 'nenhuma (decisão sua)'}</div>
      </div>
      <section><p class="eyebrow">PORTÃO DE ENTRADA (B1 · arXiv 2609.37953)</p><p class="o-texto">${req.length ? `Só começa se a crença do lead tiver, válidos e sem conflito: <b>${req.map((k) => esc(ROT_REQ[k] || k)).join(', ')}</b>. Sem isso, o lead fica com a pendência "parado no portão" em vez de virar um trabalho que vai falhar.` : n.dono === 'operador' ? 'Inviolável: nada segue para envio sem você aprovar.' : 'Sem requisito de fato: a etapa cria os fatos que as próximas vão exigir.'}</p></section>
    </article></div>`;
}

function abaPortoes(d) {
  const presos = d.estado.tocomas?.presos || [];
  const PADRAO = { parado: ['Parado', 'estagnação: 3 ciclos sem fato novo'], ciclo: ['Ciclo', 'recorrência: o estado volta (A→B→A→B)'], deriva: ['Deriva', 'persistência: muda, mas a lacuna não fecha'] };
  return `<div class="o-tres">${Object.entries(PADRAO).map(([k, [r, s]]) => `<div class="o-painel o-padrao"><p class="eyebrow violeta">${r.toUpperCase()}</p><strong>${presos.filter((p) => p.padrao === k).length}</strong><small>${esc(s)}</small></div>`).join('')}</div>
    <section><div class="o-secao"><div><h2>Leads fora da fila</h2><p>Cada padrão tem a sua recuperação (PoS · arXiv 2610.01415). "Refazer auditoria" na gaveta libera.</p></div></div>
    ${presos.length ? `<ul class="o-lista">${presos.map((p) => `<li><b><a href="/#lead=${encodeURIComponent(p.lead_id)}">${esc(p.nome || p.lead_id)}</a></b> ${p.padrao ? `<span class="selo-o violeta">${esc(p.padrao)}</span>` : ''}<small>${esc(p.motivo || '')}${p.recuperacao ? ` → ${esc(p.recuperacao)}` : ''}</small></li>`).join('')}</ul>` : vazio('Nenhum lead preso', 'Quando um lead travar, ele aparece aqui com o diagnóstico e a ação certa.')}</section>`;
}

function abaControlador(d) {
  const c = Object.values(d.estado.tocomas?.controlador || {});
  const f = d.estado.tocomas?.fidelidade || { total: 0, preservados: 0, ultimos_desvios: [] };
  return `<div class="o-tres">${c.map((x) => `<div class="o-painel o-padrao"><p class="eyebrow ${x.escolhida === 'esperar' || x.escolhida === 'parar_varredura' ? 'violeta' : 'vivo'}">${esc(x.laco === 'varrer' ? 'VARREDURA' : 'ESCRITA')}</p><strong class="txt">${esc(x.escolhida.replace('_', ' '))}</strong><small>${esc(x.motivo)}</small></div>`).join('')}
      <div class="o-painel o-padrao"><p class="eyebrow vivo">FIDELIDADE AOS PLANOS</p><strong>${f.total ? Math.round((100 * f.preservados) / f.total) : 100}%</strong><small>${f.total} job(s) · ferramenta fora do plano conta como desvio (arXiv 2609.38108)</small></div></div>
    <p class="o-texto">O controlador é regra de propósito: com orçamento pequeno, regra vence controlador por modelo (arXiv 2609.38147, §7.3). Ele segura a escrita quando já há mensagens para ${'2'} dias de envio e a varredura quando há leads para ${'4'} dias.</p>
    ${f.ultimos_desvios?.length ? `<section><p class="eyebrow">ÚLTIMOS DESVIOS</p><ul class="o-lista">${f.ultimos_desvios.map((x) => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul></section>` : ''}`;
}

function abaCalibracao(d) {
  const z = d.estado.tocomas?.zonas || { limites: {}, nichos: [] };
  const g = d.calibracao.aprovacao.p_cabeca.geral;
  return `<div class="o-tres">
      <div class="o-painel o-padrao"><p class="eyebrow">DECISÕES SUAS MEDIDAS</p><strong>${d.calibracao.total}</strong><small>cada Aprovar/Descartar grava o que a Nova previa antes (B10)</small></div>
      <div class="o-painel o-padrao"><p class="eyebrow">ERRO DE CALIBRAÇÃO (ECE)</p><strong>${g.ece == null ? '—' : g.ece}</strong><small>${g.confiavel ? 'confiável' : `pouca amostra (mínimo ${d.calibracao.min_amostra})`}</small></div>
      <div class="o-painel o-padrao"><p class="eyebrow">ZONAS (SYSTEM ONE)</p><strong class="txt">&lt;${pct1(z.limites.descartar_abaixo || 0)} · &gt;${pct1(z.limites.confiante_acima || 0)}</strong><small>abaixo: Nova descarta sozinha (1 em 10 vem para você) · meio: você decide</small></div></div>
    <section><div class="o-secao"><div><h2>Por nicho</h2><p>A média esconde falhas concentradas: cada nicho liga sozinho (30 decisões, ECE ≤ ${z.limites.ece_max ?? 0.1}).</p></div></div>
      ${z.nichos.map((n) => `<div class="o-progresso"><span>${esc(d.estado.nichos?.[n.nicho] || n.nicho)}</span><span class="o-barra" style="--cor:${n.pronta ? 'var(--acento)' : 'var(--violeta)'}"><i style="width:${Math.min(100, (100 * n.n) / ((n.n + n.faltam) || 1))}%"></i></span><small>${n.pronta ? 'ligada' : `${n.n}/${n.n + n.faltam}`}</small></div>`).join('') || vazio('Nenhum nicho com leads', 'Crie uma varredura para começar.')}</section>`;
}

function abaRegras(d) {
  const EST = { proposta: ['proposta', 'pessego'], ativa: ['ativa', 'lima'], revisada: ['desativada', ''], recusada: ['recusada', ''] };
  const BOT = { proposta: [['aceitar', 'Aceitar', 'primario'], ['recusar', 'Recusar', '']], ativa: [['desativar', 'Desativar', '']], revisada: [['reativar', 'Reativar', '']] };
  return `<p class="o-texto">Quando você descarta leads pelo mesmo motivo, a equipe propõe uma regra com as evidências. Nada vale sem você aceitar (meta-skills · arXiv 2609.38143).</p>
    ${d.habilidades.length ? `<ul class="o-lista">${d.habilidades.map((h) => `<li><span><span class="selo-o ${EST[h.estado]?.[1] || ''}">${esc(EST[h.estado]?.[0] || h.estado)}</span> Quando <b>${esc(h.quando)}</b> → ${esc(h.fornecer)}</span>
      <small>${h.evidencias.length} descarte(s) seu(s) como evidência${h.aplicada ? ` · aplicada ${h.aplicada}×` : ''}</small>
      <span class="o-botoes">${(BOT[h.estado] || []).map(([a, r, c]) => `<button class="btn ${c}" data-regra="${esc(h.id)}" data-acao="${a}">${r}</button>`).join('')}</span></li>`).join('')}</ul>`
    : vazio('Nenhuma regra ainda', 'Descarte leads com motivo nos cartões; motivos repetidos viram proposta aqui.', '<a class="btn primario" href="/?cartoes=1">Abrir os cartões</a>')}`;
}

function abaPapers() {
  return `<p class="o-texto">Cada parte do motor saiu de um estudo lido por inteiro (docs/estudos/). O código cita o id do arXiv.</p>
    <div class="o-papers">${PAPERS.map(([id, t, s, onde]) => `<a class="o-paper" href="https://arxiv.org/abs/${id}" target="_blank" rel="noopener noreferrer"><span class="mono">${id}</span><strong>${esc(t)}</strong><small>${esc(s)}</small><span class="selo-o violeta">${esc(onde)}</span></a>`).join('')}</div>`;
}

function desenhar() {
  if (!dados) return;
  if (!ABAS.some(([k]) => k === aba)) aba = 'etapas';
  const d = dados, f = d.estado.tocomas?.fidelidade || { total: 0, preservados: 0 };
  const ligados = (d.estado.tocomas?.zonas?.nichos || []).filter((n) => n.pronta).length;
  const fid = f.total ? Math.round((100 * f.preservados) / f.total) : 100;
  $('#motor').innerHTML = `<div><p class="eyebrow violeta"><span class="o-ponto ${Object.values(d.estado.agentes).some((a) => a.status === 'trabalhando') ? 'on' : ''}"></span> MOTOR ${d.estado.pausado ? 'PAUSADO' : 'LIGADO'}</p>
      <h2>${d.estado.briefing?.leads ?? 0} leads passaram pelo motor</h2>
      <div class="o-chips"><span class="selo-o lima">fidelidade ${fid}%</span><span class="selo-o violeta">${d.estado.tocomas?.presos?.length || 0} preso(s)</span><span class="selo-o">${ligados ? `decide sozinha em ${ligados} nicho(s)` : 'decide sozinha: desligado'}</span><span class="selo-o pessego">revisão humana obrigatória</span></div></div>
    <div class="o-contador"><strong>${String(d.estado.funil?.mensagem || 0).padStart(2, '0')}</strong><small>esperando você · ${d.estado.funil?.aprovado || 0} aprovada(s) na fila</small>
      <span class="o-barra" style="--cor:var(--acento)"><i style="width:${fid}%"></i></span></div>`;
  $('#abas').innerHTML = ABAS.map(([k, r, i]) => `<button role="tab" data-aba="${k}" aria-selected="${k === aba}" tabindex="${k === aba ? 0 : -1}">${i}${r}</button>`).join('');
  $('#corpo').innerHTML = { etapas: abaEtapas, portoes: abaPortoes, controlador: abaControlador, calibracao: abaCalibracao, regras: abaRegras, papers: abaPapers }[aba](d);
}

async function atualizar() {
  const [estado, grafo, varr, apr, cal, hab] = await Promise.all([api('/api/estado'), dados?.grafo || api('/api/grafo'), api('/api/varreduras'), api('/api/aprendizado'), api('/api/calibracao'), api('/api/habilidades')]);
  dados = { estado, grafo, varreduras: varr.varreduras, aprendizado: apr.cabecas, calibracao: cal, habilidades: hab.habilidades };
  atualizarShell(estado);
  if (!document.activeElement?.closest('#corpo, #abas')) desenhar();
}
aCada(6000, atualizar);
