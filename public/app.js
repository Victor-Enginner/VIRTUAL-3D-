// Painel do Prospector. Tudo que vem da API pode conter texto de terceiros (fichas do Maps,
// títulos de sites), então todo valor passa por esc() antes de entrar no HTML.
import { montarShell, atualizarShell } from './ui/shell.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const pct = (p) => `${Math.round(p * 100)}%`;

async function api(caminho, corpo) {
  const r = await fetch(caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}

const ETAPAS = [
  ['mensagem', 'Para aprovar'], ['qualificado', 'Qualificados'], ['aprovado', 'Na fila'], ['enviado', 'Enviados'],
  ['respondeu', 'Responderam'], ['sem_resposta', 'Sem resposta'], ['sem_contato', 'Sem telefone'], ['descartado', 'Descartados'], ['', 'Todos'],
];
let estado = null;
let etapaAtual = 'mensagem';
let leadAberto = null;

// ---------------------------------------------------------------- estado geral

async function carregarEstado() {
  estado = await api('/api/estado');
  atualizarShell(estado);
  desenharSaude();
  desenharFunil();
  desenharAbas();
  $('#btn-pausa').textContent = estado.pausado ? 'Retomar agentes' : 'Pausar agentes';
  if (!$('#sel-nicho').options.length) {
    $('#sel-nicho').innerHTML = Object.entries(estado.nichos).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
    $('#sel-fonte').innerHTML = Object.entries(estado.fontes).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
  }
}

// linha de saúde no cabeçalho: o que está ligado, sem pílulas coloridas competindo com o conteúdo
function desenharSaude() {
  const { ollama, openwa, motor } = estado.saude;
  const motorOk = motor.backend === 'jev' || (ollama.ok && ollama.decide);
  const item = (cls, txt) => `<span class="estado-linha"><span class="ponto ${cls}"></span>${esc(txt)}</span>`;
  $('#saude').innerHTML = [
    item(ollama.ok ? 'ok' : 'erro', ollama.ok ? 'Ollama ligado' : 'Ollama desligado'),
    item(motorOk ? 'ok' : 'alerta', `decisão: ${motor.backend === 'jev' ? 'Jev (pago)' : motor.modelo_decisao}${motorOk ? '' : ' (indisponível)'}`),
    item(openwa.ok ? 'ok' : openwa.configurado ? 'erro' : 'alerta', openwa.configurado ? `OpenWA: ${openwa.status || openwa.erro || '?'}` : 'OpenWA não configurado'),
    item(estado.envio.enviados_hoje >= estado.envio.limite ? 'alerta' : 'ok', `${estado.envio.enviados_hoje} de ${estado.envio.limite} envios hoje`),
  ].join('');
}

// funil com números reais do banco e a conversão entre etapas
function desenharFunil() {
  const f = estado.funil, s = estado.situacoes;
  const soma = (...ks) => ks.reduce((a, k) => a + (f[k] || 0), 0);
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  const oportunidade = Object.entries(s).filter(([k]) => k !== 'site_proprio').reduce((a, [, n]) => a + n, 0);
  const prontas = soma('mensagem', 'aprovado', 'enviado', 'respondeu', 'sem_resposta', 'nao_contatar');
  const enviados = soma('enviado', 'respondeu', 'sem_resposta', 'nao_contatar');
  const responderam = soma('respondeu');
  const etapas = [
    [total, 'encontrados'], [oportunidade, 'com site fraco ou sem site'], [prontas, 'mensagens escritas'],
    [enviados, 'enviados'], [responderam, 'responderam'],
  ];
  $('#kpis').innerHTML = etapas.map(([n, rot], i) => {
    const ant = i ? etapas[i - 1][0] : 0;
    const conv = i && ant ? `<span class="conv">${Math.round((100 * n) / ant)}%</span>` : '';
    return `<div class="etapa ${i === 4 && n ? 'destaque' : ''}"><b>${n}</b><span>${esc(rot)}</span>${conv}</div>`;
  }).join('');
}

function desenharAbas() {
  const f = estado.funil;
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  $('#abas').innerHTML = ETAPAS.map(([k, rot]) => `<button class="aba" role="tab" aria-selected="${k === etapaAtual}" data-etapa="${k}">${esc(rot)}<em>${k ? f[k] || 0 : total}</em></button>`).join('');
}

// ---------------------------------------------------------------- leads

async function carregarLeads() {
  const q = $('#busca').value.trim();
  const { leads } = await api(`/api/leads?etapa=${encodeURIComponent(etapaAtual)}&q=${encodeURIComponent(q)}`);
  $('#linhas').innerHTML = leads.map((l) => `<tr data-id="${esc(l.id)}" tabindex="0">
    <td><div class="nome">${esc(l.nome)}</div><div class="sub">${esc(l.categoria || '')} · ${esc(l.cidade)}-${esc(l.uf)}</div></td>
    <td>${l.situacao_site ? `<span class="selo s-${esc(l.situacao_site)}">${esc(l.situacao_rotulo)}</span>` : '<span class="sub">auditando…</span>'}</td>
    <td>${l.score == null ? '<span class="sub">—</span>' : `<span class="barra"><i style="width:${Number(l.score)}%"></i></span><span class="num">${Number(l.score)}</span>`}</td>
    <td>${l.telefone ? `${esc(l.telefone_fmt)}<div class="sub">${esc(l.telefone_tipo || '')}</div>` : '<span class="sub">sem telefone</span>'}</td>
    <td>${l.rating ? `${esc(String(l.rating).replace('.', ','))} ★<div class="sub">${esc(l.avaliacoes ?? '?')} avaliações</div>` : '<span class="sub">—</span>'}</td>
  </tr>`).join('');
  const vazio = $('#vazio-leads');
  vazio.hidden = leads.length > 0;
  if (!leads.length) {
    const temAlgum = Object.values(estado?.funil || {}).some(Boolean);
    vazio.innerHTML = temAlgum
      ? '<strong>Nada nesta etapa agora</strong>Os leads aparecem aqui quando os agentes chegam nesta etapa.'
      : '<strong>Nenhum lead ainda</strong>Crie uma varredura em “Nova varredura” ou diga “varre barbearias em Franca SP”. O Atlas busca, audita e passa para a Nova.';
  }
}

// ---------------------------------------------------------------- gaveta do lead

function blocoDecisao(decisao) {
  if (!decisao?.answers) return '<p>Ainda não decidido.</p>';
  const perguntas = { oportunidade: 'Oportunidade (nível)', ativo: 'Está ativo?', abordagem: 'Ângulo da mensagem' };
  const rotulos = {
    oportunidade: ['Nada', 'Pouco', 'Médio', 'Alto', 'Muito alto'],
    ativo: { true: 'Sim', false: 'Não' },
    abordagem: estado.abordagens,
  };
  return Object.entries(decisao.answers).map(([id, a]) => {
    const linhas = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1]).map(([k, p], i) => {
      const r = Array.isArray(rotulos[id]) ? rotulos[id][Number(k)] : rotulos[id]?.[k] ?? k;
      return `<div class="prob ${i === 0 ? 'top' : ''}"><span>${esc(r)}</span><span class="trilho"><i style="width:${pct(p)}"></i></span><b>${pct(p)}</b></div>`;
    }).join('');
    const cob = a.coverage != null && a.coverage < 0.8 ? ` · <span title="massa de probabilidade que caiu nas opções">cobertura ${pct(a.coverage)}</span>` : '';
    const fonte = a.origem === 'regra' ? ' · <em>definido por regra (fato medido)</em>' : ' · <em>modelo</em>';
    return `<div class="pergunta"><span>${esc(perguntas[id] || id)}${fonte}${cob}</span>${linhas}</div>`;
  }).join('') + blocoAprendizado(decisao.aprendizado, decisao.score_regra) + `<p class="meta">${esc(decisao.backend)} · ${esc(decisao.model || '—')} · ${esc(decisao.latency_ms)} ms${decisao.formula ? ` · prioridade = ${esc(decisao.formula)}` : ''}</p>`;
}

function blocoAprendizado(a, regra) {
  if (!a) return '';
  const semDados = !a.alfa_aprovacao && !a.alfa_resposta;
  const contrib = a.contribuicoes?.length
    ? `<ul class="sinais">${a.contribuicoes.map((c) => `<li>${esc(c.nome)}: ${c.valor > 0 ? '+' : ''}${esc(c.valor)}</li>`).join('')}</ul>` : '';
  return `<div class="pergunta"><span>O que os agentes aprenderam com você · <em>regressão logística online</em></span>
    <p>${semDados ? `Ainda sem exemplos: a prioridade é só a regra (${esc(regra)}). Cada aprovação ou descarte seu ensina o modelo.`
      : `Regra ${esc(regra)} → final ${esc(a.score)} · chance de você aprovar ${pct(a.p_aprovacao)} (peso ${pct(a.alfa_aprovacao)}) · chance de responder ${pct(a.p_resposta)} (peso ${pct(a.alfa_resposta)})`}</p>${contrib}</div>`;
}

function blocoAuditoria(l) {
  const a = l.auditoria;
  if (!l.site) return '<p>O Google Maps não mostra nenhum site para este negócio.</p>';
  if (!a) return `<p>Site: ${esc(l.site)} — classificado só pelo endereço (${esc(l.situacao_rotulo)}).</p>`;
  if (a.erro) return `<p>Tentei abrir <b>${esc(a.url)}</b> e falhou: ${esc(a.erro)}.</p>`;
  const sinais = a.sinais?.length ? `<ul class="sinais">${a.sinais.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p>Nenhum sinal de atraso medido.</p>';
  return `<dl class="fatos">
    <div><dt>Título</dt><dd>${esc(a.titulo || '—')}</dd></div>
    <div><dt>Endereço final</dt><dd>${esc(a.url_final)}</dd></div>
    <div><dt>HTTPS</dt><dd>${a.https ? 'sim' : 'não'}</dd></div>
    <div><dt>Adaptado ao celular</dt><dd>${a.viewport ? 'sim' : 'não'}</dd></div>
    <div><dt>Ano no rodapé</dt><dd>${esc(a.ano_copyright || '—')}</dd></div>
    <div><dt>Tecnologias</dt><dd>${esc(a.tecnologias?.join(', ') || '—')}</dd></div>
    <div><dt>Resposta</dt><dd>HTTP ${esc(a.status_http)} em ${esc(a.tempo_ms)} ms</dd></div>
    <div><dt>Link de WhatsApp no site</dt><dd>${a.link_whatsapp ? 'sim' : 'não'}</dd></div>
  </dl>${sinais}<p class="meta">medido em ${esc(dataHora(a.medido_em))}</p>`;
}

async function abrirLead(id) {
  leadAberto = id;
  const { lead: l, eventos, envios } = await api(`/api/leads/${encodeURIComponent(id)}`);
  const podeAprovar = l.telefone && l.mensagem && ['mensagem', 'qualificado'].includes(l.etapa);
  const naFila = envios.find((e) => e.status === 'aprovado');
  const origem = { modelo: 'escrita pelo modelo local e conferida', modelo_recusado: 'texto fixo (o texto do modelo não passou na checagem)', operador: 'editada por você' }[l.mensagem_origem] || '';
  $('#gaveta-conteudo').innerHTML = `
    <div class="g-titulo"><h1 id="g-nome">${esc(l.nome)}</h1>
      <p>${esc(l.categoria || '')} · ${esc(l.endereco || `${l.cidade}-${l.uf}`)}</p></div>
    <dl class="fatos">
      <div><dt>Telefone</dt><dd>${l.telefone ? `${esc(l.telefone_fmt)} (${esc(l.telefone_tipo)})` : 'não encontrado'}</dd></div>
      <div><dt>Google</dt><dd>${l.rating ? `${esc(l.rating)} ★ · ${esc(l.avaliacoes ?? '?')} avaliações` : '—'}</dd></div>
      <div><dt>Situação do site</dt><dd>${l.situacao_site ? `<span class="selo s-${esc(l.situacao_site)}">${esc(l.situacao_rotulo)}</span>` : '—'}</dd></div>
      <div><dt>Etapa</dt><dd>${esc(l.etapa)}</dd></div>
      <div><dt>Fonte</dt><dd>${/^https:\/\//.test(l.maps_url || '') ? `<a href="${esc(l.maps_url)}" target="_blank" rel="noopener noreferrer">${esc(l.fonte)}</a>` : esc(l.fonte)}</dd></div>
      <div><dt>Prioridade</dt><dd>${l.score ?? '—'}</dd></div>
    </dl>
    <section class="bloco"><h3>O que o Atlas mediu</h3>${blocoAuditoria(l)}</section>
    <section class="bloco"><h3>O que a Nova decidiu (probabilidades)</h3>${blocoDecisao(l.decisao)}</section>
    <section class="bloco"><h3>Mensagem da Maia ${origem ? `<span class="meta">· ${esc(origem)}</span>` : ''}</h3>
      ${l.mensagem ? `<textarea id="g-msg">${esc(l.mensagem)}</textarea>` : '<p>Sem mensagem ainda.</p>'}
      <p class="erro-msg" id="g-erro"></p>
      <div class="botoes">
        ${l.mensagem ? '<button class="btn" id="g-salvar">Salvar texto</button>' : ''}
        ${podeAprovar ? '<button class="btn ok" id="g-aprovar">Aprovar para envio</button>' : ''}
        ${l.wa_link && l.mensagem ? `<a class="btn" id="g-wa" href="${esc(l.wa_link)}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>` : ''}
        ${naFila ? '<button class="btn" id="g-manual">Já enviei à mão</button>' : ''}
        <button class="btn" id="g-reprocessar">Refazer auditoria</button>
        ${!['descartado', 'nao_contatar'].includes(l.etapa) ? '<button class="btn perigo" id="g-descartar">Descartar</button>' : ''}
      </div>
    </section>
    <section class="bloco"><h3>Histórico</h3><ol class="feed">${eventos.map((e) => `<li><time>${esc(hora(e.ts))}</time><span>${esc(e.msg)}</span></li>`).join('') || '<li><span>—</span></li>'}</ol></section>`;
  $('#gaveta').hidden = false;
  const acao = async (fn) => { try { await fn(); await atualizarTudo(); await abrirLead(id); } catch (e) { $('#g-erro').textContent = e.message; } };
  $('#g-salvar')?.addEventListener('click', () => acao(() => api(`/api/leads/${id}/mensagem`, { texto: $('#g-msg').value })));
  $('#g-aprovar')?.addEventListener('click', () => acao(() => api(`/api/leads/${id}/aprovar`, { texto: $('#g-msg').value })));
  $('#g-manual')?.addEventListener('click', () => acao(() => api(`/api/leads/${id}/enviado-manual`, {})));
  $('#g-reprocessar')?.addEventListener('click', () => acao(() => api(`/api/leads/${id}/reprocessar`, {})));
  $('#g-descartar')?.addEventListener('click', () => acao(() => api(`/api/leads/${id}/descartar`, {})));
}

function fecharGaveta() { $('#gaveta').hidden = true; leadAberto = null; }

// ---------------------------------------------------------------- lateral

async function carregarVarreduras() {
  const { varreduras } = await api('/api/varreduras');
  $('#varreduras').innerHTML = varreduras.map((v) => {
    const r = v.ultimo_resultado;
    const info = v.ultima_execucao ? `${dataHora(v.ultima_execucao)} · ${r?.coletados ?? 0} achados, ${r?.novos ?? 0} novos${r?.aviso ? ` · ${r.aviso}` : ''}` : 'na fila';
    return `<li><div><strong>${esc(v.nicho_rotulo)}</strong> · ${esc(v.cidade)}-${esc(v.uf)}<small>${esc(v.fonte)} · ${esc(info)}</small></div>
      <button class="btn" data-varredura="${v.id}" data-ativa="${v.ativa ? 0 : 1}">${v.ativa ? 'Desativar' : 'Ativar'}</button></li>`;
  }).join('') || '<li><span class="sub">Nenhuma varredura. Varreduras ativas rodam de novo a cada 24 h quando o painel está ligado.</span></li>';
}

async function carregarEnvios() {
  const { envios, situacao: s } = await api('/api/envios');
  const prox = s.pode ? 'pode enviar agora' : `próximo: ${dataHora(s.proximo)} (${s.motivo})`;
  $('#envio-status').innerHTML = `
    <div>${s.enviados_hoje} de ${s.limite} hoje · ${s.na_fila} na fila · ${esc(prox)}</div>
    <div class="medidor"><i style="width:${Math.min(100, (100 * s.enviados_hoje) / s.limite)}%"></i></div>
    ${s.openwa ? '' : '<div class="aviso">OpenWA não configurado: nada sai sozinho. Aprove e use "Abrir no WhatsApp" para enviar à mão, ou configure o OpenWA no .env.</div>'}`;
  const rot = { aprovado: 'na fila', enviado: 'enviado', erro: 'erro', cancelado: 'cancelado' };
  $('#envios').innerHTML = envios.slice(0, 15).map((e) => `<li><div><strong>${esc(e.nome)}</strong><small>${esc(e.telefone_fmt)} · ${esc(rot[e.status] || e.status)}${e.enviado_em ? ` ${esc(dataHora(e.enviado_em))}` : e.agendado_para ? ` · ${esc(dataHora(e.agendado_para))}` : ''}${e.resposta?.erro ? ` · ${esc(e.resposta.erro)}` : ''}</small></div>
    ${e.status === 'aprovado' ? `<button class="btn" data-cancelar="${e.id}">Cancelar</button>` : ''}</li>`).join('');
}

const corDe = (ag) => estado?.agentes?.[ag]?.cor || 'var(--tinta-2)';
const nomeDe = (ag) => estado?.agentes?.[ag]?.nome || ag;
function linhaFeed(e) {
  return `<li><time>${esc(hora(e.ts))}</time><span class="${e.tipo === 'erro' ? 'erro' : ''}"><b style="--cor:${esc(corDe(e.agente))}">${esc(nomeDe(e.agente))}</b>${esc(e.msg)}</span></li>`;
}
async function carregarFeed() {
  const { eventos } = await api('/api/eventos');
  $('#feed').innerHTML = eventos.map(linhaFeed).join('');
}

// ---------------------------------------------------------------- voz e comandos

async function executarComando(texto) {
  if (!texto.trim()) return;
  $('#resposta-comando').textContent = 'Pensando…';
  try {
    const r = await api('/api/comando', { texto });
    $('#resposta-comando').textContent = `${r.resposta}  (intenção "${r.comando.intencao}" ${pct(r.comando.confianca)} · ${r.comando.latency_ms} ms)`;
    await atualizarTudo();
  } catch (e) { $('#resposta-comando').textContent = `Erro: ${e.message}`; }
}

function prepararVoz() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('#mic');
  if (!Rec) { mic.title = 'Este navegador não tem reconhecimento de voz (use Chrome ou Edge) — digite o comando'; mic.disabled = true; return; }
  // Aviso honesto: no Chrome/Edge o áudio é processado pelo serviço do navegador (Google/Microsoft), não localmente.
  mic.title = 'Falar um comando (o reconhecimento é do navegador: no Chrome o áudio vai para o Google)';
  let rec = null;
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new Rec();
    rec.lang = 'pt-BR'; rec.interimResults = true; rec.maxAlternatives = 1;
    mic.classList.add('ouvindo');
    rec.onresult = (ev) => {
      const t = [...ev.results].map((r) => r[0].transcript).join(' ');
      $('#comando').value = t;
      if (ev.results[ev.results.length - 1].isFinal) executarComando(t);
    };
    rec.onerror = (ev) => { $('#resposta-comando').textContent = ev.error === 'not-allowed' ? 'Permissão de microfone negada.' : `Voz: ${ev.error}`; };
    rec.onend = () => { mic.classList.remove('ouvindo'); rec = null; };
    rec.start();
  });
}

// ---------------------------------------------------------------- ajustes

function abrirAjustes() {
  const a = estado.ajustes, f = $('#form-ajustes');
  f.remetente_nome.value = a.remetente_nome; f.remetente_oferta.value = a.remetente_oferta; f.remetente_portfolio.value = a.remetente_portfolio || '';
  f.limite_diario.value = a.envio.limite_diario;
  f.intervalo_min_m.value = Math.round(a.envio.intervalo_min_s / 60); f.intervalo_max_m.value = Math.round(a.envio.intervalo_max_s / 60);
  f.janela_inicio_h.value = a.envio.janela_inicio_h; f.janela_fim_h.value = a.envio.janela_fim_h;
  f.exigir_aprovacao.checked = a.envio.exigir_aprovacao; f.so_celular.checked = a.envio.so_celular;
  $('#dlg-ajustes').showModal();
}

async function salvarAjustes(ev) {
  ev.preventDefault();
  const f = $('#form-ajustes');
  await api('/api/ajustes', {
    remetente_nome: f.remetente_nome.value, remetente_oferta: f.remetente_oferta.value, remetente_portfolio: f.remetente_portfolio.value,
    envio: {
      limite_diario: Number(f.limite_diario.value), intervalo_min_s: Number(f.intervalo_min_m.value) * 60, intervalo_max_s: Number(f.intervalo_max_m.value) * 60,
      janela_inicio_h: Number(f.janela_inicio_h.value), janela_fim_h: Number(f.janela_fim_h.value),
      exigir_aprovacao: f.exigir_aprovacao.checked, so_celular: f.so_celular.checked,
    },
  });
  $('#dlg-ajustes').close();
  await atualizarTudo();
}

// ---------------------------------------------------------------- ciclo

async function atualizarTudo() {
  await carregarEstado();
  await Promise.all([carregarLeads(), carregarVarreduras(), carregarEnvios()]);
}

let agendado = null;
const atualizarEmBreve = () => { clearTimeout(agendado); agendado = setTimeout(() => atualizarTudo().catch(() => {}), 600); };

function ligarEventos() {
  const fonte = new EventSource('/api/stream');
  fonte.onmessage = (m) => {
    const e = JSON.parse(m.data);
    $('#feed').insertAdjacentHTML('afterbegin', linhaFeed(e));
    while ($('#feed').children.length > 150) $('#feed').lastElementChild.remove();
    atualizarEmBreve();
    if (leadAberto && e.lead_id === leadAberto) abrirLead(leadAberto).catch(() => {});
  };
}

$('#abas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-etapa]');
  if (!b) return;
  etapaAtual = b.dataset.etapa;
  desenharAbas();
  carregarLeads();
});
$('#busca').addEventListener('input', () => { clearTimeout(window.__busca); window.__busca = setTimeout(carregarLeads, 250); });
$('#linhas').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr) abrirLead(tr.dataset.id); });
$('#gaveta').addEventListener('click', (ev) => { if (ev.target.closest('[data-fechar]')) fecharGaveta(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#gaveta').hidden) fecharGaveta(); });
$('#form-comando').addEventListener('submit', (ev) => { ev.preventDefault(); executarComando($('#comando').value); });
$('#form-varredura').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const d = Object.fromEntries(new FormData(ev.target));
  try { await api('/api/varreduras', d); await atualizarTudo(); } catch (e) { alert(e.message); }
});
$('#varreduras').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-varredura]');
  if (b) { await api(`/api/varreduras/${b.dataset.varredura}/ativa`, { ativa: b.dataset.ativa === '1' }); carregarVarreduras(); }
});
$('#envios').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-cancelar]');
  if (b) { await api(`/api/envios/${b.dataset.cancelar}/cancelar`, {}); atualizarTudo(); }
});
$('#btn-pausa').addEventListener('click', async () => { await api(estado.pausado ? '/api/agentes/retomar' : '/api/agentes/pausar', {}); atualizarTudo(); });
$('#btn-ajustes').addEventListener('click', abrirAjustes);
$('#form-ajustes').addEventListener('submit', (ev) => { if (ev.submitter?.value === 'salvar') salvarAjustes(ev).catch((e) => alert(e.message)); });

$('#linhas').addEventListener('keydown', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirLead(tr.dataset.id); } });

montarShell('painel');
prepararVoz();
atualizarTudo().then(carregarFeed).then(ligarEventos).then(() => { if (location.hash === '#ajustes') abrirAjustes(); });
setInterval(() => carregarEstado().catch(() => {}), 5000);
