// Conforto sensorial (regras em docs/ACESSIBILIDADE.md). Os agentes NÃO falam: só trabalham. Você fala com eles
// (comando de voz no Painel, que usa só o microfone), eles respondem em texto.
//
//  1. Nada toca, pisca ou se mexe sozinho sem você ter pedido.
//  2. Modo calmo: sem animação decorativa, sem confete, sem som da sala, sem mascotes.
//     Quem tem "reduzir movimento" no sistema já entra assim.
//  3. Mascotes são opcionais e desligados por padrão (ver ui/mascotes.js).
// Preferências ficam só neste navegador (localStorage) e a página funciona igual se ele estiver bloqueado.
const CHAVE = 'prospector.conforto.v1';
const PADRAO = { calmo: false, mascotes: false, mascotesApesarDoSistema: false };

function ler() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { ...PADRAO, ...Object.fromEntries(Object.entries(salvo).filter(([k]) => k in PADRAO)) }; // chaves antigas (voz) são ignoradas
  } catch { return { ...PADRAO }; }
}
let prefs = ler();

export const preferencias = () => ({ ...prefs });

export function aplicarConforto() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.calmo = prefs.calmo ? '1' : '';
}

export function salvar(parcial) {
  prefs = { ...prefs, ...Object.fromEntries(Object.entries(parcial).filter(([k]) => k in PADRAO)) };
  try { localStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch { /* sem armazenamento: vale só nesta página */ }
  aplicarConforto();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('conforto', { detail: { ...prefs } }));
  return { ...prefs };
}

// "reduzir movimento" do sistema OU modo calmo: quem lê isto não anima nada decorativo
export const movimentoReduzido = () => prefs.calmo || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
export const modoCalmo = () => prefs.calmo;

if (typeof document !== 'undefined') aplicarConforto();
