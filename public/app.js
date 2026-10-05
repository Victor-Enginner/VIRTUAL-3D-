// Painel do Prospector. Tudo que vem da API pode conter texto de terceiros (fichas do Maps,
// títulos de sites), então todo valor passa por esc() antes de entrar no HTML.
import { montarShell, atualizarShell } from './ui/shell.js';
import { abrirCartoes } from './cartoes.js';

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
  ['respondeu', 'Responderam'], ['fechado', 'Fechados'], ['perdido', 'Não fecharam'], ['sem_resposta', 'Sem resposta'], ['sem_contato', 'Sem telefone'], ['descartado', 'Descartados'], ['', 'Todos'],
];
let estado = null;
let etapaAtual = 'mensagem';
let soFraco = false; // filtro do funil: só quem tem site fraco ou nenhum
let leadAberto = null;

// ---------------------------------------------------------------- estado geral

async function carregarEstado() {
  estado = await api('/api/estado');
  atualizarShell(estado);
  desenharSaude();
  desenharFoco();
  desenharFunil();
  desenharAbas();
  $('#btn-pausa').textContent = estado.pausado ? 'Retomar agentes' : 'Pausar agentes';
  if (!$('#sel-nicho').options.length) {
    montarFormVarredura(estado); // estado, cidade e ramo vêm do catálogo (IBGE + 4 grupos); cai no formato antigo se a API não responder
    $('#sel-fonte').innerHTML = Object.entries(estado.fontes).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
  }
}

// ---------------------------------------------------------------- foco do dia
// Estudo (MANUS.AI.WEBSITES.3D.md): "uma ideia curta no topo" e "uma ação principal por painel".
// O topo do Painel diz o que importa AGORA e oferece um botão só.
async function desenharFoco() {
  const n = estado.funil?.mensagem || 0;
  const vivos = Object.values(estado.agentes).flatMap((a) => (a.tarefas || []).map((t) => ({ nome: a.nome, cor: a.cor, texto: t.texto })));
  const aoVivo = vivos.length
    ? `<p class="ao-vivo"><span class="ponto vivo"></span>${vivos.slice(0, 2).map((v) => `<b style="color:${esc(v.cor)}">${esc(v.nome)}</b> ${esc(v.texto.charAt(0).toLowerCase() + v.texto.slice(1))}`).join(' · ')}</p>`
    : `<p class="ao-vivo"><span class="ponto ${estado.pausado ? 'alerta' : 'ok'}"></span>${estado.pausado ? 'Agentes pausados' : 'Equipe em espera'}</p>`;
  let html;
  if (n) {
    let topo = null;
    try { topo = (await api('/api/leads?etapa=mensagem')).leads[0]; } catch {}
    html = `<div class="foco-texto"><h2><b>${n}</b> ${n === 1 ? 'mensagem esperando' : 'mensagens esperando'} você</h2>
      <p>${topo ? `A mais promissora agora: <strong>${esc(topo.nome)}</strong> · prioridade ${esc(topo.score)}${topo.situacao_rotulo ? ` · ${esc(topo.situacao_rotulo.toLowerCase())}` : ''}` : 'Revise e aprove para entrarem na fila de envio.'}</p>${aoVivo}</div>
      <div class="foco-acao"><button class="btn primario magnetico" id="foco-comecar">Começar a aprovar</button><span class="sub">um cartão por vez · A aprova · D descarta · <button class="link" id="foco-gaveta">ver na lista</button></span></div>`;
  } else if (vivos.length) {
    html = `<div class="foco-texto"><h2>Os agentes estão trabalhando</h2><p>Nada para você aprovar ainda. As mensagens aparecem aqui assim que a Maia terminar.</p>${aoVivo}</div>`;
  } else {
    const total = Object.values(estado.funil || {}).reduce((a, b) => a + b, 0);
    html = `<div class="foco-texto"><h2>${total ? 'Tudo aprovado por enquanto' : 'Comece pela primeira busca'}</h2>
      <p>${total ? 'Quer mais leads? Peça uma varredura nova abaixo ou fale um comando.' : 'Diga uma cidade e um ramo, por exemplo "varre barbearias em Franca SP". O Atlas busca, audita e passa para a Nova.'}</p>${aoVivo}</div>
      <div class="foco-acao"><button class="btn primario magnetico" id="foco-varrer">${total ? 'Nova varredura' : 'Fazer a primeira busca'}</button></div>`;
  }
  $('#foco').innerHTML = html;
  // a fila em cartões é o caminho rápido; a gaveta continua para quem quer ver tudo do lead
  $('#foco-comecar')?.addEventListener('click', () => abrirCartoes({ motivos: MOTIVOS, avisar, aoFechar: atualizarTudo }));
  $('#foco-gaveta')?.addEventListener('click', async () => {
    etapaAtual = 'mensagem'; soFraco = false; desenharAbas(); desenharFunil();
    await carregarLeads();
    const primeiro = idsNaTela()[0];
    if (primeiro) abrirLead(primeiro);
  });
  $('#foco-varrer')?.addEventListener('click', () => { $('#comando').focus(); $('#comando').scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  ligarMagnetico();
}

// botão "magnético" (Manus: MagneticButton com limites e sem efeito no toque)
function ligarMagnetico() {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const b of document.querySelectorAll('.magnetico:not([data-mag])')) {
    b.dataset.mag = '1';
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.transform = `translate(${(dx * 6).toFixed(1)}px, ${(dy * 4).toFixed(1)}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  }
}

// números do funil contam até o valor novo (MetricStory: número grande com escala)
const valoresAnteriores = new Map();
function contar(el, de, ate) {
  if (de === ate || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = ate; return; }
  const t0 = performance.now(), dur = 700;
  const passo = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; el.textContent = Math.round(de + (ate - de) * e); if (k < 1) requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
}

// linha de saúde no cabeçalho: o que está ligado, sem pílulas coloridas competindo com o conteúdo
function desenharSaude() {
  const { ollama, openwa, motor } = estado.saude;
  const motorOk = motor.backend === 'jev' || (ollama.ok && ollama.decide);
  const item = (cls, txt) => `<span class="estado-linha"><span class="ponto ${cls}"></span>${esc(txt)}</span>`;
  $('#saude').innerHTML = [
    item(ollama.ok ? 'ok' : 'erro', ollama.ok ? 'Ollama ligado' : 'Ollama desligado'),
    item(motorOk ? 'ok' : 'alerta', `decisão: ${motor.backend === 'jev' ? 'Jev (pago)' : motor.modelo_decisao}${motorOk ? '' : ' (indisponível)'}`),
    item(openwa.ok ? 'ok' : openwa.configurado ? 'erro' : 'alerta', openwa.ok ? 'WhatsApp conectado' : !openwa.configurado ? 'WhatsApp não configurado' : openwa.erro ? 'WhatsApp desligado' : `WhatsApp ${openwa.status || 'desconectado'}`),
    item(estado.envio.enviados_hoje >= estado.envio.limite ? 'alerta' : 'ok', `${estado.envio.enviados_hoje} de ${estado.envio.limite} envios hoje`),
  ].join('');
}

// funil com números reais do banco e a conversão entre etapas
// linhas-fantasma enquanto a lista chega (mesma altura das reais: a página não pula)
function esqueletoLinhas(n = 6) {
  return Array.from({ length: n }, () => `<tr class="esqueleto" aria-hidden="true"><td><i style="width:62%"></i><i style="width:38%"></i></td><td><i style="width:70px"></i></td><td><i style="width:48px"></i></td><td><i style="width:110px"></i></td><td><i style="width:40px"></i></td></tr>`).join('');
}

function desenharFunil() {
  const f = estado.funil, s = estado.situacoes;
  const soma = (...ks) => ks.reduce((a, k) => a + (f[k] || 0), 0);
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  const oportunidade = Object.entries(s).filter(([k]) => k !== 'site_proprio').reduce((a, [, n]) => a + n, 0);
  const prontas = soma('mensagem', 'aprovado', 'enviado', 'respondeu', 'fechado', 'perdido', 'sem_resposta', 'nao_contatar');
  const enviados = soma('enviado', 'respondeu', 'fechado', 'perdido', 'sem_resposta', 'nao_contatar');
  const responderam = soma('respondeu', 'fechado', 'perdido');
  // cada número é também um filtro da lista (toque para ver só esses leads)
  const etapas = [
    [total, 'encontrados', { etapa: '' }], [oportunidade, 'com site fraco ou sem site', { etapa: '', fraco: true }], [prontas, 'mensagens escritas', { etapa: 'mensagem' }],
    [enviados, 'enviados', { etapa: 'enviado' }], [responderam, 'responderam', { etapa: 'respondeu' }],
  ];
  $('#kpis').innerHTML = etapas.map(([n, rot, filtro], i) => {
    const ant = i ? etapas[i - 1][0] : 0;
    const conv = i && ant ? `<span class="conv">${Math.round((100 * n) / ant)}%</span>` : '';
    const ativo = filtro.etapa === etapaAtual && Boolean(filtro.fraco) === soFraco;
    const escala = total ? Math.max(2, Math.round((100 * n) / total)) : 0;
    return `<button class="etapa ${i === 4 && n ? 'destaque' : ''}" data-funil='${JSON.stringify(filtro)}' aria-pressed="${ativo}" title="Mostrar só estes na lista"><b data-valor="${n}">${valoresAnteriores.get(i) ?? 0}</b><span>${esc(rot)}</span>${conv}<i class="escala" style="--p:${escala}%" aria-hidden="true"></i></button>`;
  }).join('');
  $('#kpis').querySelectorAll('b[data-valor]').forEach((b, i) => { const ate = Number(b.dataset.valor); contar(b, valoresAnteriores.get(i) ?? 0, ate); valoresAnteriores.set(i, ate); });
}

function desenharAbas() {
  const f = estado.funil;
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  $('#abas').innerHTML = ETAPAS.map(([k, rot]) => `<button class="aba" role="tab" aria-selected="${k === etapaAtual}" data-etapa="${k}">${esc(rot)}<em>${k ? f[k] || 0 : total}</em></button>`).join('');
}

// ---------------------------------------------------------------- leads

// quem está com o lead agora (a faixa colorida da linha, mesma cor do agente na Sala 3D)
const DONO_DA_ETAPA = { descoberto: 'atlas', auditado: 'nova', qualificado: 'maia', mensagem: 'operador', sem_contato: 'operador', aprovado: 'leo', enviado: 'leo', respondeu: 'leo', fechado: 'operador', perdido: 'operador', sem_resposta: 'leo' };
const NOME_AGENTE = { atlas: 'o Atlas', nova: 'a Nova', maia: 'a Maia', leo: 'o Leo', operador: 'você' };

async function carregarLeads() {
  const q = $('#busca').value.trim();
  if (!$('#linhas').children.length) $('#linhas').innerHTML = esqueletoLinhas(); // primeira carga: esqueleto, não tela vazia
  const { leads } = await api(`/api/leads?etapa=${encodeURIComponent(etapaAtual)}&q=${encodeURIComponent(q)}${soFraco ? '&fraco=1' : ''}`);
  $('#linhas').innerHTML = leads.map((l) => `<tr data-id="${esc(l.id)}" data-agente="${DONO_DA_ETAPA[l.etapa] || ''}" tabindex="0" title="Com ${esc(NOME_AGENTE[DONO_DA_ETAPA[l.etapa]] || '—')} agora">
    <td><div class="nome">${esc(l.nome)}</div><div class="sub">${esc(l.categoria || '')} · <span class="sem-quebra">${esc(l.cidade)}-${esc(l.uf)}</span></div></td>
    <td>${l.situacao_site ? `<span class="selo s-${esc(l.situacao_site)}">${esc(l.situacao_rotulo)}</span>` : '<span class="sub">auditando…</span>'}</td>
    <td>${l.score == null ? '<span class="sub">—</span>' : `<span class="prio"><b>${Number(l.score)}</b><span class="barra"><i style="width:${Number(l.score)}%"></i></span></span>`}${l.decisao?.zona?.zona === 'meio' && ['qualificado', 'mensagem'].includes(l.etapa) ? '<div class="selo-zona" title="Chance de aprovação no meio: a Nova deixou para você">pediu sua opinião</div>' : ''}</td>
    <td>${l.telefone ? `<span class="tel">${esc(l.telefone_fmt)}</span><div class="sub">${esc(l.telefone_tipo || '')}</div>` : '<span class="sub">sem telefone</span>'}</td>
    <td>${l.rating ? `<span class="nota">${esc(String(l.rating).replace('.', ','))} ★</span>${l.avaliacoes != null ? `<div class="sub">${esc(l.avaliacoes)} avaliações</div>` : ''}` : '<span class="sub">—</span>'}</td>
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
  }).join('') + blocoAprendizado(decisao.aprendizado, decisao.score_regra) + blocoZona(decisao.zona) + `<p class="meta">${esc(decisao.backend)} · ${esc(decisao.model || '—')} · ${esc(decisao.latency_ms)} ms${decisao.formula ? ` · prioridade = ${esc(decisao.formula)}` : ''}</p>`;
}

// 3 zonas (B3): o que a Nova pôde decidir sozinha neste lead, e por quê
const TEXTO_ZONA = {
  baixa: 'Zona baixa: a Nova descartou sozinha.',
  meio: 'Zona do meio: a Nova pediu sua opinião.',
  alta: 'Zona alta: a Nova está confiante (o envio continua dependendo de você).',
};
function blocoZona(z) {
  if (!z) return '';
  const corpo = z.zona === 'sem_calibracao'
    ? `A Nova ainda não decide sozinha neste nicho: ${esc(z.n)} de ${esc(z.n + z.faltam)} decisões suas${z.n && z.ece != null ? ` · erro de calibração ${esc(z.ece)}` : ''}.`
    : `${esc(z.amostra ? 'Zona baixa, mas este lead caiu na amostra de conferência (1 em 10): ele vem para você para a Nova continuar sendo medida.' : TEXTO_ZONA[z.zona])} Chance de você aprovar: ${pct(z.p)} · calibrada com ${esc(z.n)} decisões (erro ${esc(z.ece)}).`;
  return `<div class="pergunta"><span>Decidir sozinha ou perguntar · <em>3 zonas</em></span><p>${corpo}</p></div>`;
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

// crença do lead (TOCOMAS): cada fato com fonte e validade, o que falta, e se saiu da fila
const ROTULO_FATO = { telefone_celular: 'Telefone celular', telefone: 'Telefone', site: 'Site', rating: 'Nota', avaliacoes: 'Avaliações', situacao_site: 'Situação do site', sinais_atraso: 'Sinais de atraso', nivel_oportunidade: 'Oportunidade (0–4)', ativo: 'Ativo (prob.)', angulo: 'Ângulo' };
const ROTULO_PADRAO = { parado: 'parado', ciclo: 'andando em círculo', deriva: 'mudando sem resolver' };
const ROTULO_PEND = { falta_dado: 'falta', conflito: 'fontes discordam', aguardando_humano: 'esperando você', aguardando_resposta: 'esperando resposta', handoff_bloqueado: 'parado no portão' };

// mesmos motivos de src/tocomas/habilidades.mjs (a API recusa qualquer outro)
const MOTIVOS = { nicho: 'Ramo que não atendo', regiao: 'Fora da minha região', site_bom: 'Já tem site bom', grande: 'Negócio grande demais', mensagem: 'Mensagem ruim', outro: 'Outro motivo' };

// rótulos em português claro (a gaveta não mostra nome de coluna nem código interno)
const ROTULO_ETAPA = { descoberto: 'Na auditoria do Atlas', auditado: 'Com a Nova para decidir', qualificado: 'Com a Maia para escrever', mensagem: 'Esperando sua aprovação',
  sem_contato: 'Sem telefone', aprovado: 'Na fila de envio', enviado: 'Enviado, esperando resposta', respondeu: 'Respondeu', fechado: 'Negócio fechado', perdido: 'Conversou e não fechou', sem_resposta: 'Sem resposta em 72 h', descartado: 'Descartado', nao_contatar: 'Pediu para não receber' };
function valorFato(f, l) {
  if (f.chave === 'telefone') return l.telefone_fmt || f.valor;
  if (f.chave === 'situacao_site') return estado?.situacoes_rotulos?.[f.valor] || f.valor;
  if (f.chave === 'angulo') return estado?.abordagens?.[f.valor] || f.valor;
  if (f.chave === 'rating') return `${String(f.valor).replace('.', ',')} ★`;
  if (f.chave === 'ativo') return `${Math.round(f.valor * 100)}%`;
  if (Array.isArray(f.valor)) return f.valor.length ? f.valor.join(', ') : 'nenhum';
  return String(f.valor);
}
function blocoCrencaGaveta(c, l) {
  if (!c || !c.fatos.length) return '<p class="sub">Os agentes ainda não registraram fatos sobre este lead.</p>';
  const d = c.progresso.diagnostico;
  const preso = c.progresso.preso ? `<p class="aviso">Fora da fila${d ? ` · ${esc(ROTULO_PADRAO[d.padrao] || d.padrao)}` : ''}: ${esc(c.progresso.motivo || '')}.<br>${esc(d?.recuperacao || '"Refazer auditoria" tenta de novo')}.</p>` : '';
  const bloq = c.pendencias.find((p) => p.tipo === 'handoff_bloqueado');
  const soPolitica = bloq?.falta?.length === 1 && bloq.falta[0] === 'telefone_celular';
  const portao = bloq ? `<p class="aviso">Parado antes de "${esc(bloq.chave)}": falta ${esc((bloq.falta || []).map((k) => ROTULO_FATO[k] || k).join(', '))}. ${soPolitica ? 'O número é fixo e "só celular" está ligado: desligue nos Ajustes se ele tiver WhatsApp.' : '"Refazer auditoria" busca de novo.'}</p>` : '';
  const pend = c.pendencias.filter((p) => p.tipo !== 'handoff_bloqueado');
  return `${preso}${portao}<ul class="crenca">${c.fatos.map((f) => `<li><span>${esc(ROTULO_FATO[f.chave] || f.chave)}</span><b>${esc(valorFato(f, l))}</b><small>${esc(f.fonte)} · vale até ${esc(f.valido_ate ? new Date(f.valido_ate).toLocaleDateString('pt-BR') : '—')}</small></li>`).join('')}</ul>
    ${['epistemica', 'realizacao'].map((nat) => { const l = pend.filter((p) => p.natureza === nat); return l.length ? `<p class="sub">${nat === 'epistemica' ? 'Falta saber' : 'Falta fazer'}: ${l.map((p) => `${esc(ROTULO_FATO[p.chave] || p.chave)} (${esc(ROTULO_PEND[p.tipo])})`).join(' · ')}</p>` : ''; }).join('')}`;
}

// ---------------------------------------------------------------- linha do tempo do lead
// Tudo o que aconteceu com o lead, em ordem: achado → auditoria → decisão → mensagem → você → envio.
// Cada passo com a cor do agente; marcos (sua decisão, envio, resposta) em destaque.
const MARCO_TIPO = { aprovado: 'voce', descartado: 'voce', enviado: 'envio', resposta: 'resposta', opt_out: 'sair', handoff_bloqueado: 'portao', preso: 'portao', zona_baixa: 'portao' };
const ROTULO_TIPO = { auditoria: 'auditou o site', decisao: 'decidiu', mensagem: 'escreveu a mensagem', aprovado: 'você aprovou', descartado: 'você descartou', enviado: 'enviou',
  resposta: 'o negócio respondeu', opt_out: 'pediu para sair', handoff_bloqueado: 'parou no portão', preso: 'tirou da fila', aprendizado: 'aprendeu', habilidade_aplicada: 'aplicou uma regra sua',
  zona_baixa: 'descartou sozinha', aviso: 'aviso', erro: 'erro', reavaliacao: 'reavaliou' };
// Cadeia de causa (B5): cada passo aponta para o que o causou. Tudo vem de fatos gravados, nada de modelo.
const NOME_CURTO = { atlas: 'Atlas', nova: 'Nova', maia: 'Maia', leo: 'Leo', alva: 'Alva' };
function detalheDaCausa(p) {
  const d = p.dados || {};
  if (p.tipo === 'decisao' && d.angulo) return `ângulo ${d.angulo}${d.confianca != null && d.de === 'modelo' ? ` (${Math.round(d.confianca * 100)}%)` : ' (único válido, por regra)'}`;
  if (p.tipo === 'mensagem' && d.observacao) return `escrita a partir do fato: «${d.observacao}»`;
  return '';
}
function blocoCausa(causa) {
  if (!causa.length) return '<p class="sub">Ainda não há uma cadeia de causa para este lead (ela começa na próxima auditoria).</p>';
  return `<ol class="causa">${causa.map((p, i) => `<li>${i ? '<span class="seta" aria-hidden="true">↳ por causa disso:</span> ' : ''}<b>${esc(NOME_CURTO[p.agente] || p.agente)}</b> ${esc(p.msg)}${detalheDaCausa(p) ? `<small>${esc(detalheDaCausa(p))}</small>` : ''}</li>`).join('')}</ol>`;
}

function linhaDoTempo(l, eventos, envios) {
  const itens = [{ ts: l.criado_em, agente: 'atlas', tipo: 'achado', msg: `Encontrado no ${l.fonte === 'osm' ? 'OpenStreetMap' : 'Google Maps'} em ${l.cidade}-${l.uf}` }]
    .concat(eventos.map((e) => ({ ts: e.ts, agente: e.agente, tipo: e.tipo, msg: e.msg })));
  // envio feito à mão ou erro de envio que não virou evento do lead
  for (const e of envios) if (e.status === 'erro' && !eventos.some((x) => x.tipo === 'erro')) itens.push({ ts: e.criado_em, agente: 'leo', tipo: 'erro', msg: `Envio com erro${e.resposta?.erro ? `: ${e.resposta.erro}` : ''}` });
  itens.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  let dia = '';
  return `<ol class="tempo">${itens.map((it) => {
    const d = new Date(it.ts);
    const rotDia = Number.isNaN(+d) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    const cab = rotDia && rotDia !== dia ? `<li class="tempo-dia">${esc((dia = rotDia))}</li>` : '';
    const ag = it.tipo === 'aprovado' || it.tipo === 'descartado' ? 'operador' : it.agente;
    const quem = ag === 'operador' ? 'Você' : estado?.agentes?.[ag]?.nome || ag;
    const marco = MARCO_TIPO[it.tipo] || '';
    return `${cab}<li class="tempo-item ${marco ? `marco ${marco}` : ''}" data-agente="${esc(ag)}"><span class="tempo-no" aria-hidden="true">${esc(quem[0])}</span>
      <div><p><b>${esc(quem)}</b> <span class="tempo-acao">${esc(ROTULO_TIPO[it.tipo] || (it.tipo === 'achado' ? 'achou o lead' : it.tipo))}</span> <time>${esc(hora(it.ts))}</time></p><p class="tempo-msg">${esc(it.msg)}</p></div></li>`;
  }).join('')}</ol>`;
}

// aviso curto no canto (o que acabou de acontecer)
function avisar(texto) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = texto; t.classList.add('visivel');
  clearTimeout(avisar.timer); avisar.timer = setTimeout(() => t.classList.remove('visivel'), 2600);
}

// a ordem da tabela é a fila de trabalho: depois de decidir, a gaveta vai para o próximo
const idsNaTela = () => [...document.querySelectorAll('#linhas tr[data-id]')].map((tr) => tr.dataset.id);
function vizinho(id, passo) {
  const ids = idsNaTela(); const i = ids.indexOf(id);
  return i < 0 ? null : ids[i + passo] || null;
}

async function abrirLead(id) {
  leadAberto = id;
  const { lead: l, eventos, envios, crenca, causa = [] } = await api(`/api/leads/${encodeURIComponent(id)}`);
  const podeAprovar = l.telefone && l.mensagem && ['mensagem', 'qualificado'].includes(l.etapa);
  const naFila = envios.find((e) => e.status === 'aprovado');
  const podeDescartar = !['descartado', 'nao_contatar'].includes(l.etapa);
  const origem = { modelo: 'escrita pela Maia e conferida', modelo_recusado: 'texto pronto da Maia', operador: 'editada por você' }[l.mensagem_origem] || '';
  const ids = idsNaTela(), pos = ids.indexOf(id);
  const google = l.rating ? `${String(l.rating).replace('.', ',')} ★${l.avaliacoes != null ? ` · ${l.avaliacoes} avaliações` : ''}` : null;
  $('#gaveta-conteudo').innerHTML = `
    <header class="g-titulo" data-agente="${DONO_DA_ETAPA[l.etapa] || ''}">
      <p class="g-etapa">${esc(ROTULO_ETAPA[l.etapa] || l.etapa)}${pos >= 0 ? ` · ${pos + 1} de ${ids.length}` : ''}</p>
      <h1 id="g-nome">${esc(l.nome)}</h1>
      <p>${esc(l.categoria || '')} · <span class="sem-quebra">${esc(l.cidade)}-${esc(l.uf)}</span></p>
      <ul class="g-resumo">
        ${l.situacao_site ? `<li><span class="selo s-${esc(l.situacao_site)}">${esc(l.situacao_rotulo)}</span></li>` : ''}
        ${l.score != null ? `<li>prioridade <b>${esc(l.score)}</b></li>` : ''}
        <li>${l.telefone ? `<span class="tel">${esc(l.telefone_fmt)}</span> ${esc(l.telefone_tipo || '')}` : 'sem telefone'}</li>
        ${google ? `<li>${esc(google)}</li>` : ''}
        ${/^https:\/\//.test(l.maps_url || '') ? `<li><a href="${esc(l.maps_url)}" target="_blank" rel="noopener noreferrer">ver no Maps</a></li>` : ''}
      </ul>
    </header>

    <section class="g-mensagem" aria-labelledby="t-msg">
      <h2 id="t-msg">Mensagem${origem ? ` <span class="meta">${esc(origem)}</span>` : ''}</h2>
      ${l.mensagem ? `<div class="balao-wa"><textarea id="g-msg" aria-label="Texto da mensagem (pode editar antes de aprovar)">${esc(l.mensagem)}</textarea>
        <div class="balao-rodape"><span id="g-contagem">${l.mensagem.length} caracteres</span><button class="btn fantasma" id="g-salvar" hidden>Salvar edição</button></div></div>`
        : '<p class="sub">A Maia ainda não escreveu a mensagem deste lead.</p>'}
      ${['enviado', 'sem_resposta', 'respondeu'].includes(l.etapa) ? `<div class="g-resultado">
        <p class="sub">Como foi a conversa no WhatsApp? Um toque ensina o sistema.</p>
        <div class="g-resultado-botoes">
          ${l.etapa !== 'respondeu' ? '<button class="btn" id="g-respondeu">Respondeu</button>' : ''}
          <span class="g-valor"><input id="g-valor" type="number" min="0" step="50" inputmode="decimal" placeholder="Valor em R$" aria-label="Valor fechado em reais"><button class="btn primario" id="g-fechou">Fechou</button></span>
          <button class="btn fantasma" id="g-perdeu">Não fechou</button>
          <button class="btn perigo" id="g-sair">Pediu para sair</button>
        </div></div>` : ''}
      <p class="erro-msg" id="g-erro"></p>
      <div class="motivos" id="g-motivos" hidden>
        <p>Por que descartar? Um toque. Motivos repetidos viram proposta de regra na Base do Mestre.</p>
        <div>${Object.entries(MOTIVOS).map(([k, v]) => `<button class="btn" data-motivo="${k}">${esc(v)}</button>`).join('')}</div>
      </div>
    </section>

    <details class="g-detalhe"><summary>O que os agentes sabem <span class="meta">versão ${crenca?.versao ?? 0}</span></summary>${blocoCrencaGaveta(crenca, l)}</details>
    <details class="g-detalhe"><summary>O que o Atlas mediu no site</summary>${blocoAuditoria(l)}</details>
    <details class="g-detalhe"><summary>Como a Nova decidiu</summary>${blocoDecisao(l.decisao)}</details>
    <details class="g-detalhe"><summary>Por que isso aconteceu <span class="meta">${causa.length} passo(s)</span></summary>${blocoCausa(causa)}</details>
    <details class="g-detalhe" open><summary>Linha do tempo <span class="meta">${eventos.length + 1} passo(s)</span></summary>${linhaDoTempo(l, eventos, envios)}</details>
    <p class="g-mais"><button class="btn fantasma" id="g-reprocessar">Refazer auditoria</button>${naFila ? '<button class="btn fantasma" id="g-manual">Já enviei à mão</button>' : ''}</p>

    <footer class="g-acoes">
      <div class="g-nav">
        <button class="btn icone" id="g-ant" aria-label="Lead anterior (K)" ${vizinho(id, -1) ? '' : 'disabled'}><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
        <button class="btn icone" id="g-prox" aria-label="Próximo lead (J)" ${vizinho(id, 1) ? '' : 'disabled'}><svg class="ic" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
      ${podeDescartar ? '<button class="btn perigo" id="g-descartar" aria-expanded="false" aria-controls="g-motivos" title="Atalho: D">Descartar</button>' : ''}
      ${l.wa_link && l.mensagem ? `<a class="btn" id="g-wa" href="${esc(l.wa_link)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}
      ${podeAprovar ? '<button class="btn primario" id="g-aprovar" title="Atalho: A">Aprovar envio</button>' : ''}
    </footer>`;
  $('#gaveta').hidden = false;

  // depois de decidir: atualiza a lista e já abre o próximo da fila (ou fecha, se acabou)
  const decidir = async (fn, aviso) => {
    const proximo = vizinho(id, 1) || vizinho(id, -1);
    try { await fn(); } catch (e) { $('#g-erro').textContent = e.message; return; }
    avisar(aviso);
    await atualizarTudo();
    const ainda = idsNaTela();
    const alvoId = ainda.includes(proximo) ? proximo : ainda.includes(id) ? id : ainda[0];
    if (alvoId) abrirLead(alvoId); else fecharGaveta();
  };
  const ficar = async (fn, aviso) => { try { await fn(); avisar(aviso); await atualizarTudo(); await abrirLead(id); } catch (e) { $('#g-erro').textContent = e.message; } };
  const msg = $('#g-msg');
  msg?.addEventListener('input', () => { $('#g-contagem').textContent = `${msg.value.length} caracteres`; $('#g-salvar').hidden = msg.value === l.mensagem; });
  $('#g-salvar')?.addEventListener('click', () => ficar(() => api(`/api/leads/${id}/mensagem`, { texto: msg.value }), 'Edição salva'));
  $('#g-aprovar')?.addEventListener('click', () => decidir(() => api(`/api/leads/${id}/aprovar`, { texto: msg.value }), `${l.nome}: aprovado para envio`));
  $('#g-manual')?.addEventListener('click', () => ficar(() => api(`/api/leads/${id}/enviado-manual`, {}), 'Marcado como enviado'));
  $('#g-respondeu')?.addEventListener('click', () => ficar(() => api(`/api/leads/${id}/respondeu`, {}), `${l.nome}: respondeu`));
  $('#g-sair')?.addEventListener('click', () => ficar(() => api(`/api/leads/${id}/respondeu`, { sair: true }), `${l.nome}: não quer receber mensagens`));
  $('#g-perdeu')?.addEventListener('click', () => ficar(() => api(`/api/leads/${id}/perdeu`, {}), `${l.nome}: conversa encerrada sem fechar`));
  $('#g-fechou')?.addEventListener('click', () => {
    const v = Number(String($('#g-valor').value).replace(',', '.'));
    if (!Number.isFinite(v) || $('#g-valor').value === '') { $('#g-erro').textContent = 'Digite o valor fechado em reais (pode ser 0).'; $('#g-valor').focus(); return; }
    ficar(() => api(`/api/leads/${id}/fechou`, { valor: v }), `${l.nome}: fechado por R$ ${v.toLocaleString('pt-BR')}`);
  });
  $('#g-reprocessar')?.addEventListener('click', () => ficar(() => api(`/api/leads/${id}/reprocessar`, {}), 'Auditoria refeita: o lead voltou para o Atlas'));
  $('#g-descartar')?.addEventListener('click', (ev) => {
    const m = $('#g-motivos'); m.hidden = !m.hidden; ev.currentTarget.setAttribute('aria-expanded', String(!m.hidden));
    if (!m.hidden) { m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); m.querySelector('button').focus(); }
  });
  $('#g-motivos')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-motivo]');
    if (b) decidir(() => api(`/api/leads/${id}/descartar`, { motivo: b.dataset.motivo }), `${l.nome}: descartado (${MOTIVOS[b.dataset.motivo].toLowerCase()})`);
  });
  $('#g-ant')?.addEventListener('click', () => { const v = vizinho(id, -1); if (v) abrirLead(v); });
  $('#g-prox')?.addEventListener('click', () => { const v = vizinho(id, 1); if (v) abrirLead(v); });
  $('.gaveta-corpo').scrollTop = 0;
}

// atalhos com a gaveta aberta (fora de campo de texto): A aprova, D descarta, J/K próximo/anterior
document.addEventListener('keydown', (ev) => {
  if ($('#gaveta').hidden || ev.ctrlKey || ev.metaKey || ev.altKey || /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement?.tagName)) return;
  const k = ev.key.toLowerCase();
  const alvo = { a: '#g-aprovar', d: '#g-descartar', j: '#g-prox', k: '#g-ant' }[k];
  if (alvo && $(alvo) && !$(alvo).disabled) { ev.preventDefault(); $(alvo).click(); }
});

function fecharGaveta() { $('#gaveta').hidden = true; leadAberto = null; if (location.hash.startsWith('#lead=')) history.replaceState(null, '', location.pathname); }

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
  f.exigir_aprovacao.checked = a.envio.exigir_aprovacao; f.so_celular.checked = a.envio.so_celular; f.so_escuta.checked = a.envio.so_escuta !== false;
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
      exigir_aprovacao: f.exigir_aprovacao.checked, so_celular: f.so_celular.checked, so_escuta: f.so_escuta.checked,
    },
  });
  $('#dlg-ajustes').close();
  await atualizarTudo();
}

// ---------------------------------------------------------------- ciclo

document.querySelector('#conteudo')?.classList.add('entrada');
setTimeout(() => document.querySelector('#conteudo')?.classList.remove('entrada'), 1200);

async function atualizarTudo() {
  await carregarEstado();
  await Promise.all([carregarLeads(), carregarVarreduras(), carregarEnvios()]);
}

let agendado = null;
const atualizarEmBreve = () => { clearTimeout(agendado); agendado = setTimeout(() => atualizarTudo().catch(() => {}), 600); };

function ligarEventos() {
  const fonte = new EventSource('/api/stream');
  // se um proxy segurar o fluxo ao vivo, a lista continua atualizando a cada 8 s
  let falhas = 0, reserva = null;
  fonte.onerror = () => { if (++falhas >= 2 && !reserva) reserva = setInterval(() => atualizarTudo().catch(() => {}), 8000); };
  fonte.onopen = () => { falhas = 0; };
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
  etapaAtual = b.dataset.etapa; soFraco = false;
  desenharAbas(); desenharFunil();
  carregarLeads();
});
$('#kpis').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-funil]');
  if (!b) return;
  const f = JSON.parse(b.dataset.funil);
  etapaAtual = f.etapa; soFraco = Boolean(f.fraco);
  desenharAbas(); desenharFunil();
  carregarLeads();
  document.querySelector('.leads').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
$('#busca').addEventListener('input', () => { clearTimeout(window.__busca); window.__busca = setTimeout(carregarLeads, 250); });
$('#linhas').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr) abrirLead(tr.dataset.id); });
$('#gaveta').addEventListener('click', (ev) => { if (ev.target.closest('[data-fechar]')) fecharGaveta(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#gaveta').hidden) fecharGaveta(); });
$('#form-comando').addEventListener('submit', (ev) => { ev.preventDefault(); executarComando($('#comando').value); });
// ---- formulário de varredura: estado → cidades (IBGE) → ramo (4 grupos), com correção de digitação
async function montarFormVarredura(estado) {
  const fallback = () => { $('#sel-nicho').innerHTML = Object.entries(estado.nichos).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join(''); };
  try {
    const cat = await api('/api/catalogo');
    $('#sel-uf').innerHTML = cat.estados.map((e) => `<option value="${e.sigla}"${e.sigla === 'SP' ? ' selected' : ''}>${esc(e.nome)} (${e.sigla})</option>`).join('');
    $('#sel-nicho').innerHTML = cat.grupos.map((g) => `<optgroup label="${esc(g.rotulo)}"><option value="grupo:${esc(g.id)}">★ Grupo inteiro (${g.nichos.length} ramos)</option>${g.nichos.map((n) => `<option value="${esc(n.id)}">${esc(n.rotulo)}</option>`).join('')}</optgroup>`).join('');
    $('#sel-nicho').value = 'odontologia';
    await carregarCidades();
  } catch { fallback(); }
}
async function carregarCidades() {
  const uf = $('#sel-uf').value;
  if (!uf) return;
  const { cidades } = await api(`/api/localidades/cidades?uf=${encodeURIComponent(uf)}`);
  $('#lista-cidades').innerHTML = cidades.map((c) => `<option value="${esc(c)}">`).join('');
  verCidade();
}
let temporizadorCidade = null;
function verCidade() {
  clearTimeout(temporizadorCidade);
  const dica = $('#dica-cidade'), q = $('#inp-cidade').value.trim();
  if (!q) { dica.textContent = ''; dica.className = 'dica-cidade largo'; return; }
  temporizadorCidade = setTimeout(async () => {
    const r = await api(`/api/localidades/resolver?cidade=${encodeURIComponent(q)}&uf=${encodeURIComponent($('#sel-uf').value)}`).catch(() => null);
    if (!r) return;
    if (r.ok && r.corrigido) { dica.textContent = `Vou usar "${r.cidade}-${r.uf}" (corrigi a digitação).`; dica.className = 'dica-cidade largo ok'; }
    else if (r.ok) { dica.textContent = `${r.cidade}-${r.uf} ✓`; dica.className = 'dica-cidade largo ok'; }
    else { dica.textContent = r.mensagem; dica.className = 'dica-cidade largo aviso'; }
  }, 250);
}
$('#sel-uf').addEventListener('change', () => { $('#inp-cidade').value = ''; carregarCidades(); });
$('#inp-cidade').addEventListener('input', verCidade);

$('#form-varredura').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const d = Object.fromEntries(new FormData(ev.target));
  const msg = $('#msg-varredura');
  try {
    if (String(d.nicho).startsWith('grupo:')) {
      const r = await api('/api/varreduras/lote', { ...d, grupo: d.nicho.slice(6), nichos: undefined });
      msg.textContent = `${r.varreduras.length} varreduras do grupo entraram na fila do Atlas em ${r.varreduras[0].cidade}-${r.varreduras[0].uf}.`;
    } else {
      const { varredura: v } = await api('/api/varreduras', d);
      msg.textContent = `Na fila: ${v.cidade}-${v.uf}${v.correcao ? ` (corrigi "${v.correcao.de}")` : ''}.`;
    }
    msg.className = 'dica-cidade largo ok';
    $('#inp-cidade').value = '';
    await atualizarTudo();
  } catch (e) { msg.textContent = e.message; msg.className = 'dica-cidade largo aviso'; }
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
// links das abas do Workspace: /#lead=ID abre a gaveta, /?cartoes=1 abre a fila em cartões, /#varredura leva ao formulário
function seguirLink() {
  if (location.hash === '#ajustes') abrirAjustes();
  else if (location.hash.startsWith('#lead=')) abrirLead(decodeURIComponent(location.hash.slice(6))).catch(() => avisar('Lead não encontrado'));
  else if (location.hash === '#varredura') { const f = $('#form-varredura'); f?.scrollIntoView({ block: 'center' }); f?.querySelector('input, select')?.focus(); }
  if (new URLSearchParams(location.search).get('cartoes') === '1') {
    history.replaceState(null, '', location.pathname + location.hash);
    abrirCartoes({ motivos: MOTIVOS, avisar, aoFechar: atualizarTudo });
  }
}
addEventListener('hashchange', seguirLink);
atualizarTudo().then(carregarFeed).then(ligarEventos).then(seguirLink);
setInterval(() => carregarEstado().catch(() => {}), 5000);

// ---------------------------------------------------------------- WhatsApp (OpenWA)
// Conectar = criar/iniciar a sessão "prospector" e mostrar o QR até o celular escanear.
const ROTULO_WA = { ready: 'Conectado', qr_ready: 'Esperando você escanear o QR', initializing: 'Iniciando…', authenticating: 'Autenticando…', disconnected: 'Desconectado', failed: 'Falhou', created: 'Criada', action_required: 'Precisa de ação no celular' };
let qrTimer = null;
async function desenharWhatsapp() {
  const caixa = $('#whatsapp');
  if (!caixa) return;
  let w;
  try { w = await api('/api/whatsapp'); } catch (e) { caixa.innerHTML = `<p class="aviso">${esc(e.message)}</p>`; return; }
  if (!w.chave) { caixa.innerHTML = '<p class="aviso">OpenWA sem chave: defina OPENWA_API_KEY no .env.</p>'; return; }
  if (w.erro && !w.status) { caixa.innerHTML = `<p class="aviso">O serviço do WhatsApp (OpenWA) está desligado. Ligue-o no PC para conectar; enquanto isso, use "Abrir no WhatsApp" em cada lead.</p>`; return; }
  const st = w.status || 'sem sessão';
  let html = `<p><span class="selo ${w.ok ? 's-site_proprio' : 's-so_rede_social'}">${esc(ROTULO_WA[st] || st)}</span>${w.telefone ? ` · ${esc(w.telefone)}` : ''}</p>`;
  if (w.restricao) html += `<p class="aviso">O WhatsApp aplicou uma restrição à conta. Pare os envios.</p>`;
  if (w.ok) html += '<button class="btn" id="wa-teste">Enviar teste para o meu número</button>';
  else html += '<button class="btn primario" id="wa-conectar">Conectar WhatsApp</button>';
  if (st === 'qr_ready') {
    const q = await api('/api/whatsapp/qr').catch(() => ({}));
    if (q.qrCode?.startsWith('data:image/png;base64,')) html += `<img class="qr" src="${q.qrCode}" alt="QR para conectar o WhatsApp"><p class="dica-qr">No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.</p>`;
  }
  caixa.innerHTML = html + '<p class="erro-msg" id="wa-erro"></p>';
  $('#wa-conectar')?.addEventListener('click', async (ev) => {
    ev.currentTarget.setAttribute('aria-busy', 'true');
    try { await api('/api/whatsapp/conectar', {}); } catch (e) { $('#wa-erro').textContent = e.message; }
    desenharWhatsapp();
  });
  $('#wa-teste')?.addEventListener('click', async (ev) => {
    ev.currentTarget.setAttribute('aria-busy', 'true');
    try { const r = await api('/api/whatsapp/teste', {}); $('#wa-erro').textContent = `Teste enviado para ${r.telefone}. Confira no seu WhatsApp.`; }
    catch (e) { $('#wa-erro').textContent = e.message; }
    ev.currentTarget?.removeAttribute('aria-busy');
  });
  clearTimeout(qrTimer);
  // enquanto não conecta, o QR muda a cada ~20 s: atualiza sozinho
  if (!w.ok && ['qr_ready', 'initializing', 'authenticating'].includes(st)) qrTimer = setTimeout(desenharWhatsapp, 4000);
}
desenharWhatsapp();
