// Conforto sensorial e voz da Alva (regras em docs/ACESSIBILIDADE.md). Este é o ÚNICO lugar que fala.
//
//  1. Nada toca sozinho. A voz só sai por um clique ("Ouvir") ou como resposta a um comando que você deu falando,
//     e esta última só se você ligar "ler as respostas em voz alta" (desligado por padrão).
//  2. Um canal de áudio por vez. Antes de falar, a TV e o som da sala são pausados; depois voltam como estavam.
//  3. Sempre há o texto na tela (legenda) com botão Parar. Esc também para. Trocar de aba para.
//  4. Falas curtas (até ~300 caracteres), uma por vez: pedir outra interrompe a anterior, sem fila.
//  5. Modo calmo: sem animação decorativa, sem confete, sem som da sala, sem voz automática.
//     Quem usa leitor de tela ou "reduzir movimento" no sistema já entra assim.
// Preferências ficam só neste navegador (localStorage) e a página funciona igual se ele estiver bloqueado.
const CHAVE = 'prospector.conforto.v1';
const PADRAO = { respostas: false, voz: null, velocidade: 0.95, volume: 0.9, calmo: false, mascotes: false, mascotesApesarDoSistema: false };
const LIMITE = 300;

function ler() {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return { ...PADRAO }; }
}
let prefs = ler();

export const preferencias = () => ({ ...prefs });

export function aplicarConforto() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.calmo = prefs.calmo ? '1' : '';
}

export function salvar(parcial) {
  prefs = { ...prefs, ...parcial, velocidade: limitar(parcial.velocidade ?? prefs.velocidade, 0.6, 1.3), volume: limitar(parcial.volume ?? prefs.volume, 0, 1) };
  try { localStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch { /* sem armazenamento: vale só nesta página */ }
  aplicarConforto();
  if (prefs.calmo) parar();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('conforto', { detail: { ...prefs } }));
  return { ...prefs };
}
const limitar = (v, a, b) => Math.min(Math.max(Number(v) || 0, a), b);

// "reduzir movimento" do sistema OU modo calmo: quem lê isto não anima nada decorativo
export const movimentoReduzido = () => prefs.calmo || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
export const modoCalmo = () => prefs.calmo;

// ---------------------------------------------------------------- outras fontes de som (TV, sala)
const fontes = new Map();
export function registrarFonte(nome, { tocando, pausar, retomar }) { fontes.set(nome, { tocando, pausar, retomar }); }
let pausadas = [];
let sequencia = 0;
function silenciarOutras() {
  // acumula: se uma fala substituiu outra, quem a anterior pausou continua na lista para voltar no fim
  for (const [nome, f] of fontes) { try { if (f.tocando()) { f.pausar(); if (!pausadas.includes(nome)) pausadas.push(nome); } } catch { /* fonte sumiu */ } }
  return pausadas.slice();
}
function devolverOutras() {
  for (const nome of pausadas) { try { fontes.get(nome)?.retomar(); } catch { /* ok */ } }
  pausadas = [];
}

// ---------------------------------------------------------------- legenda (o texto sempre aparece)
function legenda(texto, aviso = '') {
  let el = document.getElementById('legenda-voz');
  if (!el) {
    el = document.createElement('div');
    el.id = 'legenda-voz'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;max-width:min(560px,calc(100vw - 32px));padding:12px 16px;border-radius:14px;background:#0b0b0d;color:#f4f4f5;border:1px solid #2a2a30;font:15px/1.45 system-ui,sans-serif;display:flex;gap:12px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    el.innerHTML = '<span data-t style="flex:1"></span><button type="button" data-parar style="min-height:36px;padding:0 14px;border-radius:10px;border:1px solid #3a3a42;background:transparent;color:inherit;font:inherit;cursor:pointer">Parar</button>';
    el.querySelector('[data-parar]').addEventListener('click', parar);
    document.body.append(el);
  }
  el.querySelector('[data-t]').textContent = aviso ? `${texto}  ·  ${aviso}` : texto;
  el.hidden = false;
  return el;
}
const esconderLegenda = (ms = 0) => typeof document !== 'undefined' && setTimeout(() => { const el = document.getElementById('legenda-voz'); if (el) el.hidden = true; }, ms);

// ---------------------------------------------------------------- vozes
export const suportaVoz = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function vozesPtBR() {
  if (!suportaVoz()) return Promise.resolve([]);
  const pegar = () => speechSynthesis.getVoices().filter((v) => /^pt[-_]BR/i.test(v.lang));
  const pontuar = (v) => (/natural|neural/i.test(v.name) ? 0 : /online/i.test(v.name) ? 1 : v.localService ? 3 : 2);
  const ordenar = (l) => l.sort((a, b) => pontuar(a) - pontuar(b) || a.name.localeCompare(b.name));
  return new Promise((ok) => {
    const ja = pegar();
    if (ja.length) return ok(ordenar(ja));
    const fim = () => ok(ordenar(pegar()));
    speechSynthesis.addEventListener('voiceschanged', fim, { once: true });
    setTimeout(fim, 1500); // alguns navegadores nunca avisam
  });
}

export function recortar(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= LIMITE) return t;
  const corte = t.slice(0, LIMITE);
  const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('? '));
  return fim > 80 ? corte.slice(0, fim + 1) : `${corte.trimEnd()}…`;
}

// origem: 'clique' (você apertou "Ouvir") ou 'resposta' (resposta a um comando seu). Qualquer outra coisa é recusada.
export async function falar(texto, { origem } = {}) {
  if (origem !== 'clique' && origem !== 'resposta') return { falou: false, motivo: 'só fala quando você pede' };
  if (origem === 'resposta' && (!prefs.respostas || prefs.calmo)) return { falou: false, motivo: 'respostas em voz alta desligadas' };
  const fala = recortar(texto);
  if (!fala) return { falou: false, motivo: 'nada para dizer' };
  if (!suportaVoz()) { legenda(fala, 'este navegador não fala'); esconderLegenda(6000); return { falou: false, motivo: 'sem voz no navegador' }; }
  const meu = ++sequencia; // só a fala mais recente pode devolver o som da TV/sala
  speechSynthesis.cancel();
  const silenciadas = silenciarOutras();
  const vozes = await vozesPtBR();
  const u = new SpeechSynthesisUtterance(fala);
  u.lang = 'pt-BR'; u.rate = prefs.velocidade; u.volume = prefs.volume; u.pitch = 1;
  const escolhida = vozes.find((v) => v.name === prefs.voz) || vozes[0];
  if (escolhida) u.voice = escolhida;
  legenda(fala, silenciadas.length ? 'som da TV/sala pausado enquanto eu falo' : '');
  return new Promise((ok) => {
    const fim = (motivo) => {
      if (meu !== sequencia) return ok({ falou: false, motivo: 'substituída por outra fala' });
      devolverOutras(); esconderLegenda(motivo === 'fim' ? 2500 : 0); ok({ falou: motivo === 'fim', motivo });
    };
    u.onend = () => fim('fim');
    u.onerror = () => fim('erro');
    speechSynthesis.speak(u);
  });
}

export function parar() {
  sequencia++;
  if (suportaVoz()) speechSynthesis.cancel();
  devolverOutras();
  esconderLegenda(0);
}

if (typeof document !== 'undefined') {
  aplicarConforto();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') parar(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });
  addEventListener('pagehide', parar);
}
