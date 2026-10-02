// Configurador de Agentes: conversa guiada com o servidor (src/configurador.mjs).
// Todo texto vindo da API passa por esc() antes de entrar no HTML.
import { montarShell, atualizarShell, ic } from './ui/shell.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(caminho, corpo) {
  const r = await fetch(caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}

function relativo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 10) return 'agora';
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const ICONE_SISTEMA = '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>';
const ICONE_OPERADOR = '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';

let lista = { agentes: [], ferramentas: {} };
let atual = null;       // id do agente aberto
let dados = null;       // { agente, mensagens, prompt }
let selecionadas = new Set();

// ---------------------------------------------------------------- lista na barra lateral compartilhada
async function carregarLista() {
  const [l, estado] = await Promise.all([api('/api/config-agentes'), api('/api/estado')]);
  lista = l;
  atualizarShell(estado);
  desenharLista();
}

function desenharLista() {
  const q = ($('#busca')?.value || '').trim().toLowerCase();
  const casa = (...t) => !q || t.join(' ').toLowerCase().includes(q);
  const criados = lista.agentes.filter((a) => casa(a.ficha.nome || 'novo agente', a.ficha.papel || ''));
  const item = (a) => {
    const nome = a.ficha.nome || 'Novo agente';
    const rascunho = a.status === 'em_criacao';
    const marca = rascunho ? `<span class="marca-item rascunho">${ic('<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h4"/>')}</span>`
      : `<span class="marca-item" style="background:${esc(a.cor)}">${esc(nome[0])}</span>`;
    const sub = rascunho ? `<small class="rascunho">Em criação · ${esc(a.etapa)}</small>` : `<small>${esc(a.ficha.papel || '')}</small>`;
    return `<button class="item" data-id="${esc(a.id)}" aria-current="${a.id === atual}">${marca}<span><strong>${esc(nome)}</strong>${sub}</span></button>`;
  };
  const alvo = $('#lista');
  if (alvo) alvo.innerHTML = criados.length ? criados.map(item).join('') : `<p class="vazio">${q ? 'Nenhum agente com esse nome.' : 'Nenhum agente criado ainda.'}</p>`;
}

// ---------------------------------------------------------------- conversa
async function abrir(id) {
  atual = id;
  selecionadas = new Set();
  dados = await api(`/api/config-agentes/${encodeURIComponent(id)}`);
  desenharLista();
  desenharChat();
  const f = dados.agente.ficha;
  $('#titulo-agente').textContent = f.nome || 'Novo agente';
  $('#subtitulo').textContent = dados.agente.status === 'ativo' ? `${f.papel} · ativo` : 'Em criação — responda às perguntas para montar a ficha.';
  history.replaceState(null, '', `#${id}`);
  $('#app').classList.remove('menu-aberto');
}

function bolha(m) {
  const operador = m.papel === 'operador';
  let corpo = '';
  if (m.anexo) {
    const url = `/api/anexos/${encodeURIComponent(m.anexo.arquivo)}`;
    corpo = m.anexo.tipo.startsWith('image/')
      ? `<img src="${url}" alt="${esc(m.anexo.nome)}" loading="lazy">`
      : `<a class="arquivo" href="${url}"><svg class="ic" viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/></svg>${esc(m.anexo.nome)} · ${Math.round(m.anexo.bytes / 1024)} KB</a>`;
  }
  const texto = m.texto ? (m.texto.startsWith('Erro:') ? `<span class="erro">${esc(m.texto)}</span>` : esc(m.texto)) : '';
  const cor = !operador && dados?.agente?.cor ? ` style="--cor-ag:${esc(dados.agente.cor)}"` : '';
  return `<div class="msg ${operador ? 'operador' : 'agente'}"${cor}><span class="quem" aria-hidden="true">${operador ? ICONE_OPERADOR : ICONE_SISTEMA}</span>
    <div class="bolha">${corpo}${texto}<time data-ts="${esc(m.ts)}">${relativo(m.ts)}</time></div></div>`;
}

function fichaHtml() {
  const a = dados.agente, f = a.ficha;
  const ferr = (f.ferramentas || []).map((k) => lista.ferramentas[k] || k);
  return `<article class="ficha" aria-label="Ficha do agente">
    <header><span class="marca-item" style="background:${esc(a.cor)}">${esc((f.nome || '?')[0])}</span><div><h2>${esc(f.nome)}</h2><p>${esc(f.papel || '')}</p></div>
      ${a.status === 'ativo' ? '<span class="ativo"><span class="ponto ok"></span>ativo · mesa na Sala 3D</span>' : ''}</header>
    <dl>
      <dt>Função</dt><dd>${esc(f.papel || '—')}</dd>
      <dt>Modos</dt><dd>${esc((f.modos || []).join(', ') || '—')}</dd>
      <dt>Identidade</dt><dd>${esc(f.identidade || '—')}</dd>
      <dt>Regras</dt><dd><ul>${(f.regras || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul></dd>
      <dt>Ferramentas</dt><dd>${ferr.length ? `<ul>${ferr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : 'nenhuma (só conversa)'}</dd>
      <dt>Aprendizado</dt><dd>${esc(f.aprendizado || '—')}</dd>
      <dt>Conhecimento</dt><dd>${(f.conhecimento || []).length ? esc(f.conhecimento.map((c) => c.nome).join(', ')) : 'nenhum anexo'}</dd>
    </dl>
    ${dados.prompt ? `<details><summary>Prompt de sistema gerado</summary><pre>${esc(dados.prompt)}</pre></details>` : ''}
  </article>`;
}

const ETAPAS_CONVITE = [
  ['Nome', 'como ele vai aparecer na equipe'], ['Papel', 'o que ele faz, em uma frase'], ['Modos', 'consultivo, operacional, pesquisa…'],
  ['Identidade', 'o tom de voz'], ['Regras', 'o que ele nunca faz'], ['Ferramentas', 'o que ele pode usar'],
  ['Aprendizado', 'com que frequência revisa o que aprendeu'], ['Revisão', 'você confere a ficha e ativa'],
];

function desenharChat() {
  const chat = $('#chat');
  if (!dados) {
    // estado vazio = convite: o que a conversa vai perguntar, na ordem (é uma sequência de verdade)
    chat.innerHTML = `<section class="boas-vindas" aria-labelledby="bv-titulo">
      <h2 id="bv-titulo">Monte um agente conversando</h2>
      <p>São 8 perguntas curtas. No fim você revisa a ficha e o agente ganha uma mesa na Sala 3D.</p>
      <ol class="etapas-config">${ETAPAS_CONVITE.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <div class="bv-acoes"><button class="btn primario" data-comecar>Começar um agente novo</button>
      ${document.querySelector('#lista .item') ? '<span class="sub">ou continue um da lista ao lado</span>' : ''}</div>
    </section>`;
    chat.querySelector('[data-comecar]')?.addEventListener('click', novo);
    $('#faixa').hidden = true;
    return;
  }
  const { agente, mensagens } = dados;
  $('#faixa').hidden = !(agente.status === 'em_criacao' && mensagens.some((m) => m.papel === 'operador'));
  let html = mensagens.map(bolha).join('');
  const ultima = mensagens.at(-1);
  if (agente.etapa === 'revisao' || agente.status === 'ativo') html += fichaHtml();
  if (agente.status === 'em_criacao' && ultima?.papel === 'sistema' && ultima.opcoes) {
    const { lista: ops, multipla } = ultima.opcoes;
    html += `<div class="opcoes">${ops.map((o) => `<button class="opcao" data-opcao="${esc(o)}" aria-pressed="${selecionadas.has(o)}">${esc(o)}</button>`).join('')}
      ${multipla ? `<button class="opcao confirmar" data-confirmar ${selecionadas.size ? '' : 'disabled'}>Confirmar (${selecionadas.size})</button>` : ''}</div>`;
  }
  chat.innerHTML = html;
  chat.scrollTop = chat.scrollHeight;
}

async function enviar(texto) {
  if (!atual || !texto.trim()) return;
  $('#btn-enviar').disabled = true;
  try {
    await api(`/api/config-agentes/${encodeURIComponent(atual)}/mensagem`, { texto });
    $('#texto').value = '';
    selecionadas = new Set();
    await abrir(atual);
    await carregarLista();
  } catch (e) {
    dados.mensagens.push({ papel: 'sistema', texto: `Erro: ${e.message}`, ts: new Date().toISOString() });
    desenharChat();
  } finally { $('#btn-enviar').disabled = false; $('#texto').focus(); }
}

async function novo() {
  const r = await api('/api/config-agentes', {});
  await carregarLista();
  await abrir(r.id);
}

// ---------------------------------------------------------------- anexos e voz
const TIPOS_OK = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/markdown'];
async function anexar(arquivo) {
  if (!atual) await novo();
  const tipo = arquivo.type || (arquivo.name.endsWith('.md') ? 'text/markdown' : '');
  const erro = (msg) => { dados.mensagens.push({ papel: 'sistema', texto: `Erro: ${msg}`, ts: new Date().toISOString() }); desenharChat(); };
  if (!TIPOS_OK.includes(tipo)) return erro('aceito PNG, JPG, WEBP, PDF, TXT e MD.');
  if (arquivo.size > 2 * 1024 * 1024) return erro('o arquivo passa de 2 MB.');
  const base64 = await new Promise((ok, falha) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.onerror = () => falha(fr.error);
    fr.readAsDataURL(arquivo);
  });
  try {
    await api(`/api/config-agentes/${encodeURIComponent(atual)}/anexo`, { nome: arquivo.name, tipo, base64 });
    await abrir(atual);
  } catch (e) { erro(e.message); }
}

function prepararVoz() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('#btn-mic');
  if (!Rec) { mic.disabled = true; mic.title = 'Este navegador não tem reconhecimento de voz (use Chrome ou Edge)'; return; }
  let rec = null;
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new Rec();
    rec.lang = 'pt-BR'; rec.interimResults = true;
    mic.classList.add('ouvindo');
    rec.onresult = (ev) => { $('#texto').value = [...ev.results].map((r) => r[0].transcript).join(' '); };
    rec.onend = () => { mic.classList.remove('ouvindo'); rec = null; $('#texto').focus(); };
    rec.onerror = () => { mic.classList.remove('ouvindo'); rec = null; };
    rec.start();
  });
}

// ---------------------------------------------------------------- eventos
$('#compositor').addEventListener('submit', (ev) => { ev.preventDefault(); enviar($('#texto').value); });
$('#chat').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-opcao], [data-confirmar]');
  if (!b) return;
  const multipla = dados.mensagens.at(-1)?.opcoes?.multipla;
  if (b.hasAttribute('data-confirmar')) return enviar([...selecionadas].join(', '));
  if (multipla) {
    const o = b.dataset.opcao;
    if (o === 'Nenhuma') return enviar('Nenhuma');
    selecionadas.has(o) ? selecionadas.delete(o) : selecionadas.add(o);
    desenharChat();
  } else enviar(b.dataset.opcao);
});
montarShell('configurador', { extra: true });
$('#shell-extra').innerHTML = `<h2>Seus agentes</h2>
  <label class="busca"><span class="sr">Buscar agente</span>${ic('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>')}<input id="busca" placeholder="Buscar agente…" autocomplete="off"></label>
  <div id="lista"></div>`;
$('#lista').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-id]'); if (b) abrir(b.dataset.id); });
$('#busca').addEventListener('input', desenharLista);
$('#btn-novo-topo').addEventListener('click', novo);
$('#btn-descartar').addEventListener('click', async () => {
  if (!atual || !confirm('Descartar este agente em criação e começar do zero?')) return;
  await api(`/api/config-agentes/${encodeURIComponent(atual)}/descartar`, {});
  atual = null; dados = null;
  await novo();
});
$('#btn-anexo').addEventListener('click', () => $('#arquivo').click());
$('#arquivo').addEventListener('change', (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) anexar(f); });
setInterval(() => document.querySelectorAll('time[data-ts]').forEach((t) => { t.textContent = relativo(t.dataset.ts); }), 5000);

prepararVoz();
await carregarLista();
const doHash = decodeURIComponent(location.hash.slice(1));
const emCriacao = lista.agentes.some((a) => a.id === doHash) ? doHash : lista.em_criacao || lista.agentes.at(-1)?.id;
if (emCriacao) await abrir(emCriacao); else desenharChat();
setInterval(() => api('/api/estado').then(atualizarShell).catch(() => {}), 5000);
