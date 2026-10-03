// Rede neural do fundo — adaptada do Órbita Studio do Victor (src/neural-background.js).
// Diferença: aqui ela é VIVA de verdade. A quantidade de impulsos e o piscar dos neurônios seguem
// quantos agentes estão trabalhando agora (/api/estado). Equipe parada = rede estática, sem animação.
// Canvas 2D fixo, fora da árvore de acessibilidade, ≤ 30 fps, densidade de pixels limitada,
// pausa com a aba escondida e respeita "movimento reduzido".
const CHAVE = 'prospector-neural:v1';
const CIANO = '#00edff', VIOLETA = '#b46cff', LIMA = '#b7ff00';

// mesma topologia do Órbita: hubs nas bordas e no centro, cada um com 5 ramos bifurcados
export function construirRede(largura, altura) {
  let semente = 72841;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const celular = largura < 700;
  const nos = [], arestas = [];
  const prender = (v, max) => Math.max(4, Math.min(max - 4, v));
  const novo = (x, y, hub = false) => { nos.push({ x: prender(x, largura), y: prender(y, altura), hub, brilho: 0 }); return nos.length - 1; };
  const ligar = (a, b) => {
    const de = nos[a], para = nos[b], curva = (aleatorio() - 0.5) * 60;
    arestas.push({ a, b, cx: (de.x + para.x) / 2 + curva, cy: (de.y + para.y) / 2 - curva, cor: aleatorio() > 0.65 ? VIOLETA : CIANO });
  };
  const hubs = [];
  const n = celular ? 5 : 9;
  const raio = Math.min(largura, altura) * (celular ? 0.19 : 0.16);
  for (let i = 0; i < n; i++) {
    const x = largura * (i % 3 === 0 ? 0.1 : i % 3 === 1 ? 0.88 : 0.5);
    const y = altura * (0.12 + (i / (n - 1)) * 0.78);
    const hub = novo(x + (aleatorio() - 0.5) * raio, y, true);
    hubs.push(hub);
    for (let r = 0; r < 5; r++) {
      const ang = (r * Math.PI * 2) / 5 + aleatorio();
      const comp = raio * (0.55 + aleatorio() * 0.6);
      const ponta = novo(nos[hub].x + Math.cos(ang) * comp, nos[hub].y + Math.sin(ang) * comp);
      ligar(hub, ponta);
      for (const lado of [-1, 1]) {
        const folha = novo(nos[ponta].x + Math.cos(ang + lado * 0.65) * comp * 0.45, nos[ponta].y + Math.sin(ang + lado * 0.65) * comp * 0.45);
        ligar(ponta, folha);
      }
    }
    if (i) ligar(hubs[i - 1], hub);
    if (i > 2) ligar(hubs[i - 3], hub);
  }
  return { nos, arestas, maxImpulsos: celular ? 10 : 18 };
}

export function pontoNaAresta(rede, a, t) {
  const p = rede.nos[a.a], q = rede.nos[a.b], u = 1 - t;
  return { x: u * u * p.x + 2 * u * t * a.cx + t * t * q.x, y: u * u * p.y + 2 * u * t * a.cy + t * t * q.y };
}

// impulsos por nível de atividade: 0 agentes = 0 (estática); cada agente trabalhando acende mais
export const impulsosPara = (trabalhando, max) => (trabalhando <= 0 ? 0 : Math.min(max, 3 + trabalhando * 3));

export function montarNeural() {
  if (document.querySelector('#neural')) return { atividade() {} };
  const canvas = document.createElement('canvas');
  canvas.id = 'neural';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctrl = document.createElement('div');
  ctrl.className = 'neural-controle';
  ctrl.innerHTML = '<button type="button" aria-pressed="false"><span class="neural-icone" aria-hidden="true">✧</span><span>Neural <span data-estado>estática</span></span></button>';
  document.body.append(ctrl);
  const botao = ctrl.querySelector('button');
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: true }); } catch { /* fica o fundo preto */ }
  if (!ctx) { canvas.remove(); ctrl.remove(); return { atividade() {} }; }

  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
  let ligado = true;
  try { ligado = localStorage.getItem(CHAVE) !== 'off'; } catch { /* preferência opcional */ }
  let trabalhando = 0, quadro = 0, ultimo = -Infinity, tempo = 0, L = 0, A = 0, rede;
  const camada = document.createElement('canvas');
  const tinta = camada.getContext('2d');
  const anima = () => ligado && !reduzido.matches && !document.hidden && trabalhando > 0;
  const caminho = (c, a) => { const p = rede.nos[a.a], q = rede.nos[a.b]; c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(a.cx, a.cy, q.x, q.y); };

  // dendritos estáticos numa camada em cache: por quadro é só um blit + poucos impulsos
  function estatica() {
    tinta.clearRect(0, 0, L, A);
    for (const a of rede.arestas) { caminho(tinta, a); tinta.strokeStyle = a.cor; tinta.globalAlpha = 0.13; tinta.lineWidth = 0.65; tinta.stroke(); }
    for (const n of rede.nos) {
      tinta.globalAlpha = n.hub ? 0.65 : 0.25;
      tinta.fillStyle = n.hub ? '#75fff5' : '#29a6ba';
      tinta.beginPath(); tinta.arc(n.x, n.y, n.hub ? 1.9 : 0.85, 0, Math.PI * 2); tinta.fill();
      if (n.hub) { tinta.globalAlpha = 0.14; tinta.strokeStyle = CIANO; tinta.lineWidth = 0.7; tinta.beginPath(); tinta.arc(n.x, n.y, 7, 0, Math.PI * 2); tinta.stroke(); }
    }
    tinta.globalAlpha = 1;
  }

  function desenhar(dt) {
    ctx.clearRect(0, 0, L, A);
    ctx.drawImage(camada, 0, 0, L, A);
    const k = anima() ? impulsosPara(trabalhando, rede.maxImpulsos) : 0;
    for (let i = 0; i < k; i++) {
      const ciclo = tempo / (0.65 + (i % 4) * 0.17) + i * 0.618;
      const a = rede.arestas[(i * 17 + Math.floor(ciclo) * 7) % rede.arestas.length];
      const t = ciclo % 1;
      if (t > 0.94) rede.nos[a.b].brilho = 1; // o impulso chega: o neurônio pisca
      for (let cauda = 5; cauda >= 0; cauda--) {
        const p = pontoNaAresta(rede, a, Math.max(0, t - cauda * 0.022));
        ctx.globalAlpha = (1 - cauda / 6) * 0.65;
        ctx.fillStyle = cauda ? a.cor : '#baffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, cauda ? 1 : 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // neurônios que receberam impulso brilham e apagam devagar (lima nos hubs, ciano nas folhas)
    for (const n of rede.nos) {
      if (n.brilho <= 0.02) { n.brilho = 0; continue; }
      ctx.globalAlpha = n.brilho * 0.8;
      ctx.fillStyle = n.hub ? LIMA : CIANO;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10 * n.brilho;
      ctx.beginPath(); ctx.arc(n.x, n.y, (n.hub ? 2.6 : 1.6) + n.brilho * 1.5, 0, Math.PI * 2); ctx.fill();
      n.brilho *= Math.exp(-dt * 3.2);
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  function passo(agora) {
    quadro = 0;
    if (!anima()) { desenhar(1); return; }
    if (agora - ultimo >= 1000 / 30) {
      const dt = Number.isFinite(ultimo) ? Math.min((agora - ultimo) / 1000, 0.08) : 0;
      tempo += dt * (0.8 + trabalhando * 0.1); // mais agentes, impulsos um pouco mais rápidos
      ultimo = agora;
      desenhar(dt);
    }
    quadro = requestAnimationFrame(passo);
  }

  function sincronizar() {
    if (quadro) cancelAnimationFrame(quadro);
    quadro = 0; ultimo = -Infinity;
    const rotulo = reduzido.matches ? 'reduzida' : !ligado ? 'pausada' : trabalhando ? `viva · ${trabalhando} trabalhando` : 'estática · equipe parada';
    botao.querySelector('[data-estado]').textContent = rotulo;
    botao.setAttribute('aria-pressed', String(ligado && !reduzido.matches));
    botao.disabled = reduzido.matches;
    botao.title = reduzido.matches ? 'Movimento reduzido nas preferências do aparelho' : ligado ? 'Pausar a animação do fundo' : 'Ligar a animação do fundo';
    ctrl.classList.toggle('viva', anima());
    desenhar(1);
    if (anima()) quadro = requestAnimationFrame(passo);
  }

  function redimensionar() {
    L = Math.max(32, innerWidth); A = Math.max(32, innerHeight);
    const dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2_500_000 / (L * A)));
    canvas.width = camada.width = Math.round(L * dpr);
    canvas.height = camada.height = Math.round(A * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tinta.setTransform(dpr, 0, 0, dpr, 0, 0);
    rede = construirRede(L, A);
    estatica();
    sincronizar();
  }

  botao.addEventListener('click', () => { ligado = !ligado; try { localStorage.setItem(CHAVE, ligado ? 'on' : 'off'); } catch { /* sem armazenamento */ } sincronizar(); });
  addEventListener('resize', redimensionar);
  document.addEventListener('visibilitychange', sincronizar);
  reduzido.addEventListener('change', sincronizar);
  addEventListener('pagehide', () => { if (quadro) cancelAnimationFrame(quadro); quadro = 0; });
  addEventListener('pageshow', sincronizar);
  redimensionar();

  // chamado pelo shell a cada /api/estado: só re-sincroniza quando a atividade muda
  return { atividade(n) { const v = Math.max(0, n | 0); if (v !== trabalhando) { trabalhando = v; sincronizar(); } } };
}
