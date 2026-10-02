// Sala 3D: escritório vivo. O estado vem de /api/estado e /api/stream (o mesmo do painel);
// cada agente decide onde estar pela máquina de estados (sala/comportamento.js), anda pela
// grade com A* (sala/caminhos.js) e mostra no monitor o que está fazendo de verdade.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { criarEscritorio } from './sala/cena.js';
import { carregarBase, criarPersonagem } from './sala/personagens.js';
import { buscarCaminho } from './sala/caminhos.js';
import { proximoEstado, sortearPonto, PERSONALIDADE, APRESENTACAO_MS, TEMPO_NO_PONTO_MS } from './sala/comportamento.js';
import { criarTela, desenharTela, desenharPainelLed } from './sala/telas.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { montarShell, atualizarShell } from './ui/shell.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const escuro = matchMedia('(prefers-color-scheme: dark)').matches;
const AGENTES = ['alva', 'atlas', 'nova', 'maia', 'leo'];

async function api(caminho, corpo) {
  const r = await fetch(caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}

// ------------------------------------------------------------ renderização
const alvo = $('#cena');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch {
  $('#sem-webgl').hidden = false; $('#dica').hidden = true;
  throw new Error('WebGL indisponível');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // sem GPU dedicada: limita o custo por pixel
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// checar erro de shader obriga o navegador a esperar cada compilação terminar (trava a página); em produção não precisa
renderer.debug.checkShaderErrors = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true; // meias caixas de som (recorte por plano)
alvo.appendChild(renderer.domElement);
const rotulos = new CSS2DRenderer();
Object.assign(rotulos.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1' });
alvo.appendChild(rotulos.domElement);

const cena = new THREE.Scene();
// reflexo de ambiente (sala de estúdio procedural do three): vidro, metal e piso refletem a luz
const pmrem = new THREE.PMREMGenerator(renderer);
cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
cena.environmentIntensity = 0.32;
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const controles = new OrbitControls(camera, renderer.domElement);
controles.target.set(0, 0.6, -0.5);
controles.enableDamping = true;
controles.maxPolarAngle = Math.PI * 0.45;
controles.minDistance = 4;
const DIRECAO_CAMERA = new THREE.Vector3(0.55, 0.78, 0.92).normalize();
// celular em pé: câmera mais alta e mais perto, a sala inteira não cabe na largura sem virar miniatura
const DIRECAO_RETRATO = new THREE.Vector3(1.0, 1.15, 0.3).normalize(); // olhando pelo lado: o comprimento da sala vira a altura da tela

const ceu = new THREE.HemisphereLight(0xffffff, 0x8c7a66, 1.2);
cena.add(ceu);
const sol = new THREE.DirectionalLight(0xfff1dc, 2.2);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
sol.shadow.bias = -0.0004;
Object.assign(sol.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 60 });
cena.add(sol, sol.target);
// Sem PointLight: cada luz pontual entra em TODOS os shaders, e no Direct3D 11 (Windows) isso multiplicava o
// tempo de compilação (11 luzes → ~19 s travando a sala). A noite é feita pelo céu esquentando; as
// luminárias das mesas são um brilho desenhado no tampo (cena.js).
const LUZ_NOITE = new THREE.Color(0xffd9a8), LUZ_DIA = new THREE.Color(0xffffff);

const CORES = escuro ? { piso: 0x8a6446, parede: 0xd8d2c6 } : { piso: 0xb5865c, parede: 0xe9e3d8 }; // mesma cor dos segmentos de janela do kit
const escritorio = criarEscritorio(cena, CORES);

// ------------------------------------------------------------ ciclo dia/noite pelo relógio real
const CEU_DIA = new THREE.Color(escuro ? 0x1b2333 : 0xdfe9f2), CEU_NOITE = new THREE.Color(0x070a14);
function aplicarHora(agora = new Date()) {
  const h = agora.getHours() + agora.getMinutes() / 60;
  const dia = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)); // 0 à noite, 1 ao meio-dia
  cena.background = CEU_NOITE.clone().lerp(CEU_DIA, Math.min(1, dia * 1.6));
  const ang = ((h - 6) / 12) * Math.PI;
  sol.position.set(Math.cos(ang) * 16, 4 + Math.max(0, Math.sin(ang)) * 16, 10);
  sol.intensity = 0.35 + 2.0 * dia;
  sol.color.setHSL(0.09, 0.6, 0.62 + 0.3 * dia);
  // à noite o "teto" acende: luz ambiente mais forte e mais quente
  ceu.intensity = 0.45 + 0.9 * dia + 0.55 * (1 - dia);
  ceu.color.copy(LUZ_NOITE).lerp(LUZ_DIA, dia);
  return dia;
}
let fatorDia = aplicarHora();
setInterval(() => { fatorDia = aplicarHora(); }, 60_000);

// ------------------------------------------------------------ agentes
let estado = null;
const agentes = {};
const telas = {};
const ultimasLinhas = Object.fromEntries([...AGENTES, 'operador'].map((a) => [a, []]));
let base = null, offsetSentado = -0.4;

function rotuloPara(id, info) {
  const el = document.createElement('div');
  el.className = 'rotulo';
  el.style.setProperty('--cor', info.cor);
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Abrir ficha de ${info.nome}`);
  el.addEventListener('click', () => abrirFicha(id));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFicha(id); } });
  return el;
}

function criarAgente(id, info) {
  const assento = escritorio.postos[id].assento;
  const p = base ? criarPersonagem(base, info.cor) : bonecoReserva(info.cor);
  p.grupo.position.set(assento.x, 0, assento.z);
  p.grupo.rotation.y = assento.rot;
  p.grupo.userData.id = id;
  cena.add(p.grupo);
  const el = rotuloPara(id, info);
  const r = new CSS2DObject(el);
  r.position.set(0, 2.15, 0);
  p.grupo.add(r);
  const a = {
    id, info, p, el, estado: 'na_mesa', destino: 'mesa', ponto: assento, caminho: null, sentado: false, alturaY: 0,
    ultimaAtividade: Date.now(), pontoDePausa: sortearPonto(id), trocaPontoEm: 0, ritmo: PERSONALIDADE[id]?.ritmo || 1,
  };
  sentar(a, false);
  agentes[id] = a;
}

// reserva se o GLB do personagem não carregar (sem internet): cápsula colorida, mesma lógica
function bonecoReserva(cor) {
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 12), new THREE.MeshStandardMaterial({ color: cor }));
  corpo.position.y = 0.95; corpo.castShadow = true;
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe7c9a6 }));
  cabeca.position.y = 1.6;
  grupo.add(corpo, cabeca);
  return { grupo, mixer: null, tocar() {}, gesto() {}, cabeca };
}

function sentar(a, digitando) {
  a.sentado = true;
  a.alturaY = offsetSentado;
  a.p.tocar(digitando ? 'digitando' : 'sentado');
}
function levantar(a) { a.sentado = false; a.alturaY = 0; a.p.tocar('idle'); }

// escolhe o ponto exato para o destino (cada agente pega um lugar diferente no mesmo ambiente)
function pontoDoDestino(a) {
  if (a.destino === 'mesa') return { ...escritorio.postos[a.id].assento, senta: true };
  const lista = escritorio.pontos[a.destino] || escritorio.pontos.copa;
  const ocupados = new Set(Object.values(agentes).filter((o) => o !== a && o.destino === a.destino).map((o) => o.ponto));
  return lista.find((p) => !ocupados.has(p)) || lista[AGENTES.indexOf(a.id) % lista.length];
}

function irPara(a, ponto) {
  a.ponto = ponto;
  if (a.sentado) levantar(a);
  const pos = a.p.grupo.position;
  a.caminho = buscarCaminho(escritorio.grade, [pos.x, pos.z], [ponto.x, ponto.z]) || [[ponto.x, ponto.z]];
  a.p.tocar('walk');
}

const giroAlvo = new THREE.Quaternion(), eixoY = new THREE.Vector3(0, 1, 0);
function atualizarAgente(a, dt, agoraMs) {
  const info = estado?.agentes?.[a.id];
  const trabalhando = info?.status === 'trabalhando';
  if (trabalhando) a.ultimaAtividade = agoraMs;
  const dec = proximoEstado({
    trabalhando, pausadoGlobal: estado?.pausado, ultimaAtividade: a.ultimaAtividade,
    apresentarAte: a.apresentarAte, chamadoAteMs: a.chamadoAteMs, pontoDePausa: a.pontoDePausa,
  }, agoraMs);
  // na pausa, de tempos em tempos troca de lugar (copa → janela → biblioteca), no ritmo do agente
  if (dec.estado === 'pausa' && agoraMs > a.trocaPontoEm && !a.caminho) {
    a.pontoDePausa = sortearPonto(a.id);
    a.trocaPontoEm = agoraMs + (TEMPO_NO_PONTO_MS[0] + Math.random() * (TEMPO_NO_PONTO_MS[1] - TEMPO_NO_PONTO_MS[0])) / a.ritmo;
    dec.destino = a.pontoDePausa;
  }
  const mudouDestino = dec.destino !== a.destino;
  a.estado = dec.estado;
  if (mudouDestino) { a.destino = dec.destino; irPara(a, pontoDoDestino(a)); }

  const g = a.p.grupo;
  if (a.caminho) {
    const [tx, tz] = a.caminho[0];
    const dx = tx - g.position.x, dz = tz - g.position.z, dist = Math.hypot(dx, dz);
    const passo = 1.25 * a.ritmo * dt;
    if (dist <= passo) {
      g.position.x = tx; g.position.z = tz;
      a.caminho.shift();
      if (!a.caminho.length) chegar(a);
    } else {
      g.position.x += (dx / dist) * passo; g.position.z += (dz / dist) * passo;
      giroAlvo.setFromAxisAngle(eixoY, Math.atan2(dx, dz));
      g.quaternion.slerp(giroAlvo, Math.min(1, dt * 8));
    }
  } else if (a.ponto) {
    giroAlvo.setFromAxisAngle(eixoY, a.ponto.rot);
    g.quaternion.slerp(giroAlvo, Math.min(1, dt * 5));
    if (a.sentado && a.destino === 'mesa') a.p.tocar(trabalhando ? 'digitando' : 'sentado');
  }
  g.position.y += (a.alturaY - g.position.y) * Math.min(1, dt * 6);
  a.p.mixer?.update(dt * (trabalhando ? 1.15 : 1));
}

function chegar(a) {
  a.caminho = null;
  const ponto = a.ponto;
  const g = a.p.grupo;
  if (ponto.senta) {
    // senta encostado: recua um pouco do ponto para as coxas ficarem sobre o assento
    sentar(a, a.estado === 'trabalhando');
  } else a.p.tocar('idle');
  g.rotation.y = ponto.rot ?? g.rotation.y;
}

// conversas: dois agentes em pausa a menos de 2,2 m se viram um para o outro e gesticulam
function atualizarConversas() {
  const emPe = Object.values(agentes).filter((a) => a.estado === 'pausa' && !a.caminho);
  for (const a of Object.values(agentes)) a.conversando = false;
  for (let i = 0; i < emPe.length; i++) for (let j = i + 1; j < emPe.length; j++) {
    const A = emPe[i], B = emPe[j];
    const d = A.p.grupo.position.distanceTo(B.p.grupo.position);
    if (d < 2.2) {
      A.conversando = B.conversando = true;
      A.ponto = { ...A.ponto, rot: Math.atan2(B.p.grupo.position.x - A.p.grupo.position.x, B.p.grupo.position.z - A.p.grupo.position.z) };
      B.ponto = { ...B.ponto, rot: Math.atan2(A.p.grupo.position.x - B.p.grupo.position.x, A.p.grupo.position.z - B.p.grupo.position.z) };
    }
  }
  for (const a of Object.values(agentes)) {
    if (a.conversando) a.estado = 'conversando';
    // um concorda, o outro balança a cabeça, alternando: parece conversa, não coreografia
    const t = Math.floor(performance.now() / 2600 + AGENTES.indexOf(a.id)) % 2;
    a.p.gesto('agree', a.conversando && t === 0);
    a.p.gesto('headShake', a.conversando && t === 1 && a.id !== 'alva');
  }
}

// ------------------------------------------------------------ telas e luminárias das mesas
function atualizarPostos(relogio) {
  for (const id of Object.keys(escritorio.postos)) {
    const posto = escritorio.postos[id];
    if (!telas[id]) telas[id] = criarTela(id === 'operador' ? '#3b3b46' : estado?.agentes?.[id]?.cor || agentes[id]?.info.cor || '#555');
    // a tela do monitor só existe depois que o modelo carrega; o operador usa os monitores da Base do Mestre
    if (posto.tela && posto.tela.material !== telas[id].material) posto.tela.material = telas[id].material;
    let est, tarefa;
    if (id === 'operador') {
      const n = estado?.funil?.mensagem || 0;
      est = n ? 'trabalhando' : 'na_mesa';
      tarefa = n ? `${n} mensagem(ns) esperando sua aprovação` : 'Nada para aprovar';
    } else {
      const a = agentes[id], info = estado?.agentes?.[id];
      est = estado?.pausado ? 'desligado' : a?.estado === 'trabalhando' ? 'trabalhando' : a?.destino === 'mesa' ? 'na_mesa' : 'fora';
      tarefa = info?.tarefas?.map((t) => t.texto).join(' · ') || (info?.fila ? `${info.fila} na fila` : '');
    }
    desenharTela(telas[id], { nome: id === 'operador' ? 'Você' : estado?.agentes?.[id]?.nome || agentes[id]?.info.nome || id, estado: est, tarefa, linhas: ultimasLinhas[id] || [], relogio });
    // luminária: acesa trabalhando, suave esperando, apagada fora da mesa
    const alvoLuz = est === 'trabalhando' ? 2.4 : est === 'na_mesa' ? 0.9 : 0;
    if (posto.luz) posto.luz.intensity += (alvoLuz * (0.4 + 0.6 * (1 - fatorDia)) - posto.luz.intensity) * 0.08;
  }
}

function atualizarRotulos() {
  for (const a of Object.values(agentes)) {
    const info = estado?.agentes?.[a.id] || a.info;
    const txt = {
      trabalhando: info.tarefas?.map((t) => t.texto).join(' · ') || 'Trabalhando', na_mesa: info.fila ? `${info.fila} na fila` : 'Na mesa, aguardando',
      pausa: { copa: 'Tomando um café', janela: 'Olhando pela janela', biblioteca: 'Na biblioteca', lounge: 'No lounge' }[a.destino] || 'Em pausa',
      conversando: 'Conversando', apresentando: 'Apresentando o resumo', desligado: 'Pausado (no sofá)',
    }[a.estado] || '';
    const cls = a.estado === 'trabalhando' ? 'trabalhando' : a.estado === 'desligado' ? 'pausado' : '';
    const html = `<div class="cartao"><strong><i></i>${esc(info.nome)}</strong><small>${esc(info.papel)}</small><div class="tarefa">${esc(txt)}</div></div>`;
    if (a.el.__html !== html) { a.el.innerHTML = html; a.el.__html = html; }
    a.el.className = `rotulo ${cls}`;
  }
}

// ------------------------------------------------------------ estado da API
async function carregar() {
  estado = await api('/api/estado');
  if (!Object.keys(agentes).length) for (const id of AGENTES) criarAgente(id, estado.agentes[id]);
  // agentes criados no Configurador: mesa na segunda fileira; a última conversa conta como atividade
  for (const c of estado.agentes_custom || []) {
    if (!agentes[c.id] && escritorio.adicionarPosto(c.id)) {
      ultimasLinhas[c.id] = [];
      criarAgente(c.id, { nome: c.nome, papel: c.papel, funcao: c.funcao || 'Criado no Configurador', cor: c.cor });
      agentes[c.id].custom = true;
    }
    if (agentes[c.id]) agentes[c.id].ultimaAtividade = Math.max(agentes[c.id].ultimaAtividade, Date.parse(c.ultima_atividade) || 0);
  }
  atualizarShell(estado);
  desenharPainelLed(escritorio.painel, estado);
  const s = estado.saude;
  const item = (cls, txt) => `<span class="estado-linha"><span class="ponto ${cls}"></span>${esc(txt)}</span>`;
  $('#chips').innerHTML = [
    item(s.ollama.ok ? 'ok' : 'erro', s.ollama.ok ? 'Ollama ligado' : 'Ollama desligado'),
    item(s.openwa.ok ? 'ok' : 'alerta', s.openwa.configurado ? 'OpenWA conectado' : 'OpenWA não configurado'),
    item(estado.envio.enviados_hoje < estado.envio.limite ? 'ok' : 'alerta', `${estado.envio.enviados_hoje} de ${estado.envio.limite} envios hoje`),
  ].join('');
  $('#btn-pausa').textContent = estado.pausado ? 'Retomar agentes' : 'Pausar agentes';
  if (fichaAberta) abrirFicha(fichaAberta, false);
}

// ------------------------------------------------------------ envelopes = handoffs reais
const ROTAS = {
  'atlas:varredura_fim': ['porta', 'atlas'], 'atlas:auditoria': ['atlas', 'nova'], 'nova:decisao': ['nova', 'maia'],
  'maia:mensagem': ['maia', 'operador'], 'leo:aprovado': ['operador', 'leo'], 'leo:enviado': ['leo', 'porta'],
  'leo:resposta': ['porta', 'leo'], 'leo:opt_out': ['porta', 'leo'], 'nova:aprendizado': ['operador', 'nova'],
  'alva:briefing': ['alva', 'operador'], 'alva:varredura_agendada': ['alva', 'atlas'],
};
const voando = [];
function posDe(id) {
  if (id === 'porta') return escritorio.porta.clone();
  if (agentes[id]) return agentes[id].p.grupo.position.clone().add(new THREE.Vector3(0, 1.3, 0));
  const m = escritorio.postos[id]?.mesa;
  return m ? m.clone().add(new THREE.Vector3(0, 1.1, 0)) : null;
}
function voar(de, para, cor) {
  const a = posDe(de), b = posDe(para);
  if (!a || !b) return;
  const env = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.24), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(cor), emissiveIntensity: 0.6 }));
  env.castShadow = true;
  cena.add(env);
  voando.push({ env, a, b, t: semMovimento ? 0.999 : 0, dur: 1.4 });
  som.envelope();
}
function animarEnvelopes(dt) {
  for (let i = voando.length - 1; i >= 0; i--) {
    const v = voando[i];
    v.t = Math.min(1, v.t + dt / v.dur);
    const p = v.a.clone().lerp(v.b, v.t);
    p.y += Math.sin(Math.PI * v.t) * 2.0;
    v.env.position.copy(p);
    v.env.rotation.y += dt * 5;
    if (v.t >= 1) { cena.remove(v.env); v.env.geometry.dispose(); v.env.material.dispose(); voando.splice(i, 1); }
  }
}

function aoEvento(e, historico = false) {
  const ag = agentes[e.agente];
  if (ag) ag.ultimaAtividade = Date.now();
  if (ultimasLinhas[e.agente]) { ultimasLinhas[e.agente].unshift(e.msg); ultimasLinhas[e.agente].length = Math.min(6, ultimasLinhas[e.agente].length); }
  if (!historico) {
    const rota = ROTAS[`${e.agente}:${e.tipo}`];
    if (rota && !document.hidden) voar(rota[0], rota[1], estado?.agentes?.[e.agente]?.cor || '#888');
    if (e.agente === 'alva' && e.tipo === 'briefing' && agentes.alva) agentes.alva.apresentarAte = Date.now() + APRESENTACAO_MS;
    // você deu um comando: todos voltam para as mesas, prontos (especificação do escritório vivo)
    if (e.tipo === 'comando') for (const a of Object.values(agentes)) a.chamadoAteMs = Date.now() + 60_000;
  }
  const li = document.createElement('li');
  li.style.setProperty('--cor', estado?.agentes?.[e.agente]?.cor || 'var(--tinta-3)');
  li.innerHTML = `<b>${esc(estado?.agentes?.[e.agente]?.nome || e.agente)}</b>${esc(e.msg)}`;
  $('#trilha').prepend(li);
  while ($('#trilha').children.length > 3) $('#trilha').lastElementChild.remove();
}

// ------------------------------------------------------------ som (opcional, gerado, sem arquivos)
const som = (() => {
  let ctx = null, ligado = false, proximo = 0;
  const clique = (vol) => {
    const n = ctx.createBufferSource(), buf = ctx.createBuffer(1, 600, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 90);
    n.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800 + Math.random() * 1500;
    n.connect(f).connect(g).connect(ctx.destination); n.start();
  };
  return {
    alternar() {
      ligado = !ligado;
      if (ligado && !ctx) ctx = new AudioContext();
      ctx?.[ligado ? 'resume' : 'suspend']();
      return ligado;
    },
    digitacao(nTrabalhando, agora) {
      if (!ligado || !nTrabalhando || agora < proximo) return;
      clique(0.05 + Math.random() * 0.04);
      proximo = agora + (60 + Math.random() * 140) / nTrabalhando;
    },
    envelope() {
      if (!ligado) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(520, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.3);
    },
  };
})();
$('#btn-som').addEventListener('click', (ev) => { const on = som.alternar(); ev.currentTarget.textContent = on ? 'Som ligado' : 'Som desligado'; ev.currentTarget.setAttribute('aria-pressed', String(on)); });

// ------------------------------------------------------------ ficha do agente
let fichaAberta = null;
async function abrirFicha(id, rolar = true) {
  fichaAberta = id;
  const info = id === 'operador' ? { nome: 'Você', papel: 'Operador', funcao: 'Aprova mensagens e ensina os agentes' } : estado.agentes[id] || agentes[id]?.info;
  const { eventos } = await api('/api/eventos');
  const meus = eventos.filter((e) => (id === 'operador' ? ['aprovado', 'descartado', 'aprendizado'].includes(e.tipo) : e.agente === id)).slice(0, 8);
  let extra = '';
  if (id === 'nova' || id === 'operador') {
    const { cabecas } = await api('/api/aprendizado');
    const max = Math.max(0.001, ...Object.values(cabecas).flatMap((c) => c.pesos.map((w) => Math.abs(w.peso))));
    const bloco = (titulo, c) => `<section class="bloco"><h3>${esc(titulo)}</h3>
      <p>${c.exemplos} exemplo(s), ${c.positivos} positivo(s) · peso na prioridade: ${Math.round(c.alfa * 100)}%</p>
      ${c.pesos.length ? `<div class="pesos">${c.pesos.map((w) => {
        const largura = (Math.abs(w.peso) / max) * 50;
        const estilo = w.peso >= 0 ? `left:50%;width:${largura}%;background:var(--ok)` : `right:50%;width:${largura}%;background:var(--perigo)`;
        return `<div class="peso"><span>${esc(w.nome)}</span><span class="eixo"><i style="${estilo}"></i></span><b>${w.peso > 0 ? '+' : ''}${esc(w.peso)}</b></div>`;
      }).join('')}</div>` : '<p>Sem pesos ainda: aprove ou descarte leads no painel para ensinar.</p>'}</section>`;
    extra = bloco('Aprendeu o seu gosto (aprovação)', cabecas.aprovacao) + bloco('Aprendeu quem responde', cabecas.resposta);
  }
  const a = agentes[id];
  $('#ficha-conteudo').innerHTML = `
    <h2>${esc(info.nome)}</h2><p class="papel">${esc(info.papel)} — ${esc(info.funcao)}</p>
    ${a ? `<p class="agora">Agora: <b>${esc(a.el.querySelector('.tarefa')?.textContent || a.estado)}</b></p>` : ''}
    ${id === 'operador' && estado.funil.mensagem ? `<a class="btn primario" href="/">Abrir ${estado.funil.mensagem} mensagem(ns) para aprovar</a>` : ''}
    ${extra}
    <section class="bloco"><h3>Últimos eventos</h3><ol class="feed">${meus.map((e) => `<li><time>${esc(hora(e.ts))}</time><span>${esc(e.msg)}</span></li>`).join('') || '<li><span>Nada ainda.</span></li>'}</ol></section>`;
  $('#ficha').hidden = false;
  if (rolar) $('#ficha').scrollTop = 0;
  if (a && rolar) controles.target.lerp(a.p.grupo.position.clone().setY(0.8), 0.6);
}
$('#fechar-ficha').addEventListener('click', () => { fichaAberta = null; $('#ficha').hidden = true; });

const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
let arrasto = 0;
renderer.domElement.addEventListener('pointerdown', () => { arrasto = 0; });
renderer.domElement.addEventListener('pointermove', () => { arrasto++; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (arrasto > 4) return;
  const r = renderer.domElement.getBoundingClientRect();
  ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raio.setFromCamera(ponteiro, camera);
  const hit = raio.intersectObjects(Object.values(agentes).map((a) => a.p.grupo), true)[0];
  let o = hit?.object;
  while (o && !o.userData.id) o = o.parent;
  if (o) abrirFicha(o.userData.id);
});
$('#btn-pausa').addEventListener('click', async () => { await api(estado.pausado ? '/api/agentes/retomar' : '/api/agentes/pausar', {}); carregar(); });

// ------------------------------------------------------------ câmera e laço
let cameraMexida = false;
controles.addEventListener('start', () => { cameraMexida = true; });
function ajustarTamanho() {
  const { clientWidth: w, clientHeight: h } = alvo;
  if (!w || !h) return;
  renderer.setSize(w, h); rotulos.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (!cameraMexida) {
    const retrato = camera.aspect < 0.8;
    if (retrato) controles.target.set(0, 0.6, -0.5);
    const distancia = retrato ? 24 * Math.min(1.5, 0.8 / camera.aspect) : 24 * Math.min(2.8, Math.max(1, 1.55 / camera.aspect));
    controles.maxDistance = Math.max(42, distancia + 6);
    camera.position.copy(controles.target).addScaledVector(retrato ? DIRECAO_RETRATO : DIRECAO_CAMERA, distancia);
  }
}
new ResizeObserver(ajustarTamanho).observe(alvo);
$('#btn-centralizar').addEventListener('click', () => { cameraMexida = false; controles.target.set(0, 0.6, -0.5); ajustarTamanho(); });

const relogio = new THREE.Clock();
let ultimoConversa = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(relogio.getDelta(), 0.1), t = relogio.elapsedTime, agora = Date.now();
  for (const a of Object.values(agentes)) atualizarAgente(a, semMovimento ? dt * 4 : dt, agora);
  if (t - ultimoConversa > 0.5) { atualizarConversas(); atualizarRotulos(); ultimoConversa = t; }
  atualizarPostos(t);
  som.digitacao(Object.values(agentes).filter((a) => a.estado === 'trabalhando' && a.sentado).length, performance.now());
  animarEnvelopes(dt);
  escritorio.atualizar?.(semMovimento ? 0 : dt, t);
  controles.update();
  renderer.render(cena, camera);
  rotulos.render(cena, camera);
});

// ------------------------------------------------------------ início
montarShell('sala');
window.__sala = { THREE, cena, camera, controles, agentes, escritorio, renderer }; // inspeção pelo console do navegador
const carregando = $('#carregando');
try {
  base = await carregarBase((f) => { carregando.textContent = `Carregando personagens… ${Math.min(100, Math.round(f * 100))}%`; /* o total pode vir do tamanho comprimido */ });
  // altura do quadril em pé → quanto descer o corpo para sentar no assento (0,56 m)
  const teste = criarPersonagem(base, '#888');
  teste.grupo.updateMatrixWorld(true);
  let quadril = null;
  teste.raiz.traverse((o) => { if (!quadril && o.isBone && /Hips$/.test(o.name)) quadril = o; });
  if (quadril) offsetSentado = 0.56 - quadril.getWorldPosition(new THREE.Vector3()).y;
} catch (e) {
  console.warn('personagem GLB não carregou, usando boneco reserva:', e.message);
  base = null;
}
carregando.textContent = 'Montando o escritório…';
await escritorio.pronto;
// compila todos os shaders antes de mostrar (em paralelo no driver, sem travar a página);
// sem isso a cena aparece aos pedaços e congela compilando no primeiro desenho
carregando.textContent = 'Preparando os gráficos…';
try { await renderer.compileAsync(cena, camera); } catch (e) { console.warn('pré-compilação falhou, segue assim mesmo:', e.message); }
alvo.classList.add('pronta');
carregando.hidden = true;
await carregar();
const { eventos } = await api('/api/eventos');
eventos.slice(0, 3).reverse().forEach((e) => aoEvento(e, true));
const fonte = new EventSource('/api/stream');
fonte.onmessage = (m) => { aoEvento(JSON.parse(m.data)); clearTimeout(window.__recarga); window.__recarga = setTimeout(carregar, 400); };
setInterval(() => carregar().catch(() => {}), 3000);
