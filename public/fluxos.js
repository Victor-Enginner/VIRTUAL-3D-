// Fluxos — o fluxo VIVO do sistema: o caminho de um lead, peça por peça, na ordem em que acontece
// (Maps/OSM → auditoria → banco → Nova → Maia → você → fila → WhatsApp), com o estado de verdade lido de
// /api/estado e /api/varreduras. Cada peça é clicável: abre o detalhe com os números e o atalho para a tela certa.
// Nada é simulado: sem dado, a peça diz que não sabe.
import { montarShell, atualizarShell, ICONES, ic } from './ui/shell.js';
import { api, esc, aCada } from './ui/util.js';

montarShell('fluxos');
const $ = (s) => document.querySelector(s);
document.body.classList.add('v-fluxos');

const ROTULO = { ok: 'Funcionando', espera: 'Esperando você', parcial: 'Funciona com limite', parado: 'Parado', falha: 'Com falha', desligado: 'Desligado' };
// ícones técnicos: traço fino, detalhes em lima (.ac) e ciano (.ac2), pontos de luz (.pt). Pequenos dentro da peça.
const I = {
  maps: ic('<path d="M12 21c-3.6-3.5-6-6.4-6-9.6a6 6 0 1112 0c0 3.2-2.4 6.1-6 9.6z"/><circle class="ac" cx="12" cy="11.2" r="2.1"/><path class="ac2" d="M4 20.5c2.2 1.1 5 1.5 8 1.5s5.8-.4 8-1.5" opacity=".7"/>'),
  osm: ic('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 2.4 2.8 14.6 0 17M12 3.5c-2.8 2.4-2.8 14.6 0 17" opacity=".75"/><circle class="pt" cx="8" cy="8.5" r="1.3"/><circle class="pt" cx="16.2" cy="14.5" r="1.3"/><path class="ac" d="M8 8.5l8.2 6"/>'),
  site: ic('<rect x="3.5" y="4.5" width="17" height="13" rx="2.5"/><path d="M3.5 8.5h17" opacity=".75"/><circle class="pt" cx="6.3" cy="6.5" r=".8"/><circle class="pt" cx="8.8" cy="6.5" r=".8"/><circle class="ac" cx="11.5" cy="13.2" r="2.6"/><path class="ac" d="M13.4 15.1l2.4 2.4"/><path d="M8 21h8" opacity=".6"/>'),
  banco: ic('<ellipse cx="12" cy="6.2" rx="7" ry="2.8"/><path d="M5 6.2v5.6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.2M5 11.8v5.8c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5.8" opacity=".85"/><circle class="pt" cx="8.2" cy="17.4" r=".9"/><circle class="pt" cx="11" cy="17.4" r=".9"/><path class="ac" d="M15 17.4h1.8"/>'),
  modelo: ic('<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" opacity=".7"/><path class="ac" d="M9.5 14.2l2.5-4.4 2.5 4.4"/><circle class="pt" cx="12" cy="9.8" r="1"/>'),
  texto: ic('<path d="M5 5.5h9M5 10h6M5 14.5h5"/><path class="ac" d="M15.5 11.5l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/><circle class="pt" cx="18.5" cy="6.5" r="1.1"/>'),
  voce: ic('<circle cx="12" cy="8.5" r="3.3"/><path d="M5.5 20c.7-3.7 3.2-5.7 6.5-5.7s5.8 2 6.5 5.7" opacity=".85"/><path class="ac" d="M9.8 8.7l1.6 1.6 3-3.1"/>'),
  fila: ic('<rect x="4" y="4.5" width="12" height="4" rx="1.5"/><rect x="4" y="10.5" width="12" height="4" rx="1.5" opacity=".8"/><rect x="4" y="16.5" width="12" height="3.5" rx="1.5" opacity=".6"/><path class="ac" d="M18.5 6.5l2 2-2 2M18.5 12.5l2 2-2 2" /><circle class="pt" cx="7" cy="6.5" r=".8"/>'),
  zap: ic('<path d="M4.5 19.5l1.2-3.8A7.8 7.8 0 1112 19.8a7.8 7.8 0 01-3.7-.9z"/><path class="ac" d="M8.8 10.5c.2 2.8 2.3 4.7 5 5l1.2-1.5-2-1-.9.8a3.4 3.4 0 01-1.5-1.5l.8-.9-1-2z"/><circle class="pt" cx="17.5" cy="5" r="1"/>'),
  equipe: ic('<rect x="5.5" y="8" width="13" height="10.5" rx="3.5"/><path d="M12 8V5.3" opacity=".85"/><circle class="ac2" cx="12" cy="4.2" r="1.2"/><path d="M3.5 12.5v2.5M20.5 12.5v2.5" opacity=".7"/><rect class="olho" x="8.3" y="11" width="2.2" height="3" rx="1.1"/><rect class="olho" x="13.5" y="11" width="2.2" height="3" rx="1.1"/><path d="M9.8 16.5h4.4" opacity=".7"/>'),
};

// posição de cada peça no mapa (caixa 800×520) e as ligações, na ordem em que o lead anda
const POS = {
  maps: [90, 105], osm: [90, 215], auditoria: [265, 160], banco: [440, 160], nova: [615, 160], maia: [740, 160],
  voce: [740, 390], fila: [565, 390], whatsapp: [390, 390], equipe: [90, 390],
};
const LIGA = [['maps', 'auditoria'], ['osm', 'auditoria'], ['auditoria', 'banco'], ['banco', 'nova'], ['nova', 'maia'], ['maia', 'voce'], ['voce', 'fila'], ['fila', 'whatsapp']];
const R = 30; // meia-largura de uma peça, com folga para a seta
function caminho(a, b) {
  const [x1, y1] = POS[a], [x2, y2] = POS[b];
  if (y1 === y2) { const s = Math.sign(x2 - x1); return `M ${x1 + s * R} ${y1} H ${x2 - s * R}`; }
  if (x1 === x2) { const s = Math.sign(y2 - y1); return `M ${x1} ${y1 + s * R} V ${y2 - s * R}`; }
  // alturas diferentes (Maps/OSM → auditoria): sai reto, dobra no meio e entra reto
  return `M ${x1 + R} ${y1} H ${(x1 + x2) / 2} V ${y2} H ${x2 - R}`;
}

function montar(estado, varreduras) {
  const s = estado.saude || {}, env = estado.envio || {}, b = estado.briefing || {}, f = estado.funil || {};
  const ollama = !!s.ollama?.ok;
  const wa = s.openwa || {};
  const ativas = varreduras.filter((v) => v.ativa);
  const maps = ativas.filter((v) => v.fonte === 'maps'), osm = ativas.filter((v) => v.fonte === 'osm');
  const avisoMaps = maps.some((v) => v.ultimo_resultado?.aviso);
  const sitesAuditados = Object.values(estado.situacoes || {}).reduce((t, n) => t + n, 0);
  const nomeModelo = (s.motor?.modelo_decisao || '').split('/').pop();
  return [
    { id: 'maps', icone: I.maps, nome: 'Google Maps (navegador local)', curto: 'Google Maps', st: avisoMaps ? 'parcial' : maps.length ? 'ok' : 'parado',
      info: maps.length ? `${maps.length} varredura(s) usam o Maps. ${avisoMaps ? 'A última rodada trouxe um aviso.' : 'Sem aviso na última rodada.'}` : 'Nenhuma varredura do Maps ativa agora.',
      acao: maps.length ? '' : 'Crie uma varredura em "Nova varredura" no Painel.', num: [['varreduras', maps.length], ['leads achados', b.leads ?? 0]], ir: ['/#varredura', 'Abrir Nova varredura'] },
    { id: 'osm', icone: I.osm, nome: 'OpenStreetMap (Overpass)', curto: 'OpenStreetMap', st: osm.length ? 'ok' : 'parado',
      info: osm.length ? `${osm.length} varredura(s) usam o OSM.` : 'Sem varredura do OSM ativa (é a fonte reserva do Maps).', acao: '', num: [['varreduras', osm.length]], ir: ['/#varredura', 'Abrir Nova varredura'] },
    { id: 'auditoria', icone: I.site, nome: 'Auditoria de site (Atlas)', curto: 'Auditoria', st: sitesAuditados ? 'ok' : 'parado',
      info: sitesAuditados ? `${sitesAuditados} empresas já têm a situação do site conferida.` : 'Nenhum site conferido ainda.', acao: '',
      num: [['sem site', estado.situacoes?.sem_site ?? 0], ['site fora do ar', estado.situacoes?.site_fora_do_ar ?? 0], ['só rede social', estado.situacoes?.so_rede_social ?? 0]], ir: ['/producao.html', 'Ver no quadro de produção'] },
    { id: 'banco', icone: I.banco, nome: 'Banco local (SQLite)', curto: 'Banco local', st: 'ok',
      info: `${b.leads ?? 0} leads guardados no seu PC. Backup automático antes de cada migração.`, acao: '',
      num: [['leads', b.leads ?? 0], ['no fluxo', (f.descoberto || 0) + (f.auditado || 0) + (f.qualificado || 0) + (f.mensagem || 0) + (f.aprovado || 0)]], ir: ['/producao.html', 'Ver os leads'] },
    { id: 'nova', icone: I.modelo, nome: 'Nova · decisão', curto: 'Nova', st: ollama ? 'ok' : 'parcial',
      info: ollama ? `Modelo local ligado (${esc(nomeModelo)}).` : `Modelo local desligado (${esc(nomeModelo || 'Ollama')}): a Nova decide só pelas regras do motor.`,
      acao: ollama ? '' : 'Ligue o Ollama quando quiser a decisão com modelo; o fluxo já anda sem ele.',
      num: [['qualificados', f.qualificado ?? 0], ['descartados', f.descartado ?? 0]], ir: ['/engine.html', 'Ver o motor de decisão'] },
    { id: 'maia', icone: I.texto, nome: 'Maia · mensagem', curto: 'Maia', st: ollama ? 'ok' : 'parcial',
      info: ollama ? 'Escrevendo com o modelo local.' : 'Sem modelo: a Maia usa o texto padrão do idioma de cada país.',
      acao: ollama ? '' : 'Os textos padrão funcionam; o modelo só os deixa mais variados.', num: [['mensagens escritas', (f.mensagem || 0) + (f.aprovado || 0)]], ir: ['/engine.html', 'Ver regras e recusas'] },
    { id: 'voce', icone: I.voce, nome: 'Sua aprovação', curto: 'Você', st: b.para_aprovar ? 'espera' : 'ok',
      info: b.para_aprovar ? `${b.para_aprovar} mensagens esperando você.` : 'Nada esperando aprovação.', acao: b.para_aprovar ? 'Abra "Começar a aprovar" no Painel.' : '',
      num: [['esperando', b.para_aprovar ?? 0], ['aprovadas', f.aprovado ?? 0]], ir: ['/?cartoes=1', 'Começar a aprovar'] },
    { id: 'fila', icone: I.fila, nome: 'Fila de envio (Leo)', curto: 'Fila (Leo)', st: env.pode ? 'ok' : (env.na_fila ? 'parado' : 'ok'),
      info: `${env.na_fila ?? 0} na fila · ${env.enviados_hoje ?? 0} de ${env.limite ?? 50} enviados hoje.${env.pode ? '' : ` ${esc(env.motivo || '')}`}`, acao: '',
      num: [['na fila', env.na_fila ?? 0], ['enviados hoje', `${env.enviados_hoje ?? 0}/${env.limite ?? 50}`]], ir: ['/', 'Abrir a fila no Painel'] },
    { id: 'whatsapp', icone: I.zap, nome: 'WhatsApp (OpenWA)', curto: 'WhatsApp', st: wa.status === 'failed' ? 'falha' : wa.configurado === false ? 'desligado' : wa.ok ? 'ok' : 'falha',
      info: wa.ok ? `Conectado${wa.telefone ? ` (${esc(wa.telefone)})` : ''}.` : `Não conectou (${esc(wa.status || 'sem resposta')}). ${env.so_escuta ? 'Modo só escuta: você envia à mão.' : ''}`,
      acao: wa.ok ? '' : 'Conecte pelo QR no Painel quando a engine voltar; até lá o envio é manual.', num: [['respostas', b.responderam ?? 0]], ir: ['/', 'Abrir o WhatsApp no Painel'] },
    { id: 'equipe', icone: I.equipe, nome: 'Equipe de agentes', curto: 'Equipe', st: estado.pausado ? 'parado' : 'ok',
      info: estado.pausado ? 'Todos pausados: só começam quando você manda uma varredura ou aprova.' : 'Trabalhando no ritmo seguro.',
      acao: estado.pausado ? 'Use "Retomar agentes" no Painel ou mande um comando de voz.' : '',
      num: [['agentes', Object.keys(estado.agentes || {}).length], ...(estado.agentes_custom?.length ? [['criados por você', estado.agentes_custom.length]] : [])], ir: ['/agentes.html', 'Ver a equipe'] },
  ];
}

let escolhido = null; // peça aberta no detalhe (continua aberta quando a tela atualiza)
let dados = null;

const nomeDe = (id) => dados.find((x) => x.id === id)?.curto || id;
const corDaLiga = (de, para) => {
  const a = dados.find((x) => x.id === de).st, b = dados.find((x) => x.id === para).st;
  if (a === 'ok' && b === 'ok') return 'ok';
  if (a === 'falha' || b === 'falha') return 'falha';
  if (a === 'parado' || b === 'parado' || a === 'desligado' || b === 'desligado') return 'parado';
  return 'parcial';
};

function detalhe(x) {
  const ant = LIGA.filter(([, p]) => p === x.id).map(([d]) => nomeDe(d));
  const dep = LIGA.filter(([d]) => d === x.id).map(([, p]) => nomeDe(p));
  return `<div class="f-det ${x.st}">
    <div class="f-det-cab"><span class="f-bola">${x.icone}</span><div><h2>${esc(x.nome)}</h2><span class="f-pilula ${x.st}"><i></i>${esc(ROTULO[x.st])}</span></div>
      <button class="f-fechar" data-fechar aria-label="Fechar detalhe">${ic('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
    <p>${x.info}</p>${x.acao ? `<p class="f-acao">${esc(x.acao)}</p>` : ''}
    ${x.num?.length ? `<ul class="f-nums">${x.num.map(([r, v]) => `<li><strong>${esc(v)}</strong><span>${esc(r)}</span></li>`).join('')}</ul>` : ''}
    <div class="f-det-pe"><small>${ant.length ? `Recebe de: ${esc(ant.join(', '))}. ` : 'Começo do caminho. '}${dep.length ? `Entrega para: ${esc(dep.join(', '))}.` : 'Fim do caminho.'}</small>
      <a class="btn primario" href="${esc(x.ir[0])}">${esc(x.ir[1])}</a></div></div>`;
}

function desenhar() {
  const nos = dados;
  const cont = (st) => nos.filter((x) => x.st === st).length;
  const ruins = nos.filter((x) => ['falha', 'desligado', 'parado'].includes(x.st)).length;
  const sel = nos.find((x) => x.id === escolhido);
  $('#pagina').innerHTML = `
    <section class="f-topo">
      <p class="eyebrow">FLUXO VIVO</p>
      <h1>Do mapa ao <em>WhatsApp</em>, peça por peça.</h1>
      <p class="f-sub">O caminho de cada lead, na ordem em que acontece. Clique numa peça para ver o que ela está fazendo agora. Atualiza sozinho a cada 15 segundos.</p>
      <div class="f-resumo">
        <span class="f-chip ok"><b>${cont('ok')}</b> funcionando</span>
        <span class="f-chip parcial"><b>${cont('parcial') + cont('espera')}</b> com limite / esperando</span>
        <span class="f-chip falha"><b>${ruins}</b> parado ou com falha</span>
      </div>
    </section>
    <section class="f-mapa" aria-label="Mapa do fluxo do lead">
      <div class="f-mapa-caixa">
        <svg viewBox="0 0 800 520" fill="none" aria-hidden="true"><defs>
          <linearGradient id="f-ok" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="0"><stop offset="0" stop-color="#b7ff00"/><stop offset="1" stop-color="#00edff"/></linearGradient>
          ${['ok', 'parcial', 'falha', 'parado'].map((c) => `<marker id="f-seta-${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l8 4-8 4z" class="f-seta ${c}"/></marker>`).join('')}</defs>
          ${LIGA.map(([a, b]) => { const c = corDaLiga(a, b); return `<path d="${caminho(a, b)}" class="f-linha ${c}" marker-end="url(#f-seta-${c})"/>`; }).join('')}
          <text x="90" y="52" class="f-faixa" text-anchor="middle">FONTES</text><text x="440" y="98" class="f-faixa" text-anchor="middle">PREPARO E DECISÃO</text>
          <text x="565" y="448" class="f-faixa" text-anchor="middle">SAÍDA</text><text x="90" y="448" class="f-faixa" text-anchor="middle">CONTROLE</text>
        </svg>
        ${nos.map((x) => { const [px, py] = POS[x.id]; return `<button type="button" class="f-item ${x.st}${x.id === escolhido ? ' sel' : ''}" data-id="${x.id}" style="left:${(px / 800) * 100}%;top:${(py / 520) * 100}%" aria-pressed="${x.id === escolhido}" aria-label="${esc(x.nome)}: ${esc(ROTULO[x.st])}. Abrir detalhe"><span class="f-bola">${x.icone}<i class="f-ponto"></i></span><small>${esc(x.curto)}</small></button>`; }).join('')}
      </div>
      <div class="f-legenda"><span><i class="ok"></i>funcionando</span><span><i class="parcial"></i>com limite / esperando</span><span><i class="falha"></i>com falha</span><span><i class="parado"></i>parado ou desligado</span></div>
    </section>
    <section class="f-detalhe" id="f-detalhe" aria-live="polite">${sel ? detalhe(sel) : '<p class="f-dica">Clique numa peça do mapa para ver os detalhes dela aqui.</p>'}</section>
    <section class="f-grade">
      ${nos.map((x) => `<button type="button" class="f-card ${x.st}${x.id === escolhido ? ' sel' : ''}" data-id="${x.id}">
        <div class="f-card-cab"><span class="f-bola">${x.icone}</span><div><h2>${esc(x.nome)}</h2><span class="f-pilula ${x.st}"><i></i>${esc(ROTULO[x.st])}</span></div></div>
        <p>${x.info}</p>${x.acao ? `<p class="f-acao">${esc(x.acao)}</p>` : ''}
      </button>`).join('')}
    </section>`;
}

$('#pagina').addEventListener('click', (e) => {
  if (e.target.closest('[data-fechar]')) { escolhido = null; desenhar(); return; }
  const el = e.target.closest('[data-id]');
  if (!el) return;
  escolhido = escolhido === el.dataset.id ? null : el.dataset.id;
  desenhar();
  if (escolhido) $('#f-detalhe')?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  document.querySelector(`.f-item[data-id="${escolhido}"]`)?.focus({ preventScroll: true });
});

async function atualizar() {
  const [estado, { varreduras }] = await Promise.all([api('/api/estado'), api('/api/varreduras')]);
  atualizarShell(estado);
  dados = montar(estado, varreduras);
  const foco = document.activeElement?.dataset?.id;
  desenhar();
  if (foco) document.querySelector(`.f-item[data-id="${foco}"]`)?.focus({ preventScroll: true });
  $('#pagina').removeAttribute('aria-busy');
}
aCada(15000, atualizar);
