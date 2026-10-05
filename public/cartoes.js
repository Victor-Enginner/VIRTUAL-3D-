// Fila de aprovação em cartões (evolução de frontend nº 1, docs/producao/grafo-semantico.json).
// Um lead por vez, botões grandes, gesto no celular: arrastar para a direita aprova, para a esquerda
// abre os motivos de descarte. Cada decisão só vai para o servidor 5 s depois — dá para desfazer.
// Nada aqui envia mensagem: aprovar põe na fila do Leo, que continua exigindo o WhatsApp conectado.

import { vestirAviao } from './ui/botao-aviao.js';

const ESPERA_DESFAZER_MS = 5000;
const LIMIAR_GESTO = 110; // px de arrasto para valer como decisão

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduzirMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

async function postar(caminho, corpo, keepalive = false) {
  const r = await fetch(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), keepalive });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}

// abre a fila; motivos = MOTIVOS do painel; aoFechar recarrega o painel
export async function abrirCartoes({ motivos, avisar, aoFechar }) {
  const [{ leads }, est] = await Promise.all(['/api/leads?etapa=mensagem', '/api/estado'].map((u) => fetch(u).then((r) => r.json())));
  // com "só celular" ligado, fixo não pode ser aprovado (aprovarEnvio recusa): vai para o fim, explicado
  const soCelular = est.ajustes?.envio?.so_celular !== false;
  const barrado = (l) => soCelular && l.telefone_tipo !== 'celular';
  const comMsg = leads.filter((l) => l.mensagem && l.telefone);
  let fila = [...comMsg.filter((l) => !barrado(l)), ...comMsg.filter(barrado)];
  if (!fila.length) { avisar('Nada esperando aprovação agora'); return; }

  let i = 0;
  let pendente = null; // decisão esperando os 5 s de desfazer
  const decididos = new Map(); // id → 'aprovado' | 'descartado'
  const pulados = new Set();
  const textos = new Map(); // edições feitas no cartão
  const voltarFoco = document.activeElement;

  const raiz = document.createElement('div');
  raiz.className = 'cartoes';
  raiz.innerHTML = `
    <div class="cartoes-fundo" data-fechar></div>
    <section class="cartoes-palco" role="dialog" aria-modal="true" aria-labelledby="c-nome">
      <header class="cartoes-topo">
        <p class="cartoes-pos" id="c-pos" aria-live="polite"></p>
        <button class="btn icone fantasma" data-fechar aria-label="Fechar (Esc)"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="cartoes-progresso" aria-hidden="true"><i id="c-barra"></i></div>
      </header>
      <div class="cartoes-pilha" id="c-pilha"></div>
      <div class="cartoes-desfazer" id="c-desfazer" hidden role="status">
        <span id="c-desfazer-texto"></span><button class="btn" id="c-desfazer-btn">Desfazer</button>
        <i class="cartoes-tempo" aria-hidden="true"></i>
      </div>
    </section>`;
  document.body.append(raiz);
  document.body.classList.add('sem-rolagem');
  const $ = (s) => raiz.querySelector(s);

  // ------------------------------------------------------------ decisões com desfazer
  async function executarPendente(keepalive = false) {
    if (!pendente) return;
    const p = pendente;
    pendente = null;
    clearTimeout(p.timer);
    $('#c-desfazer').hidden = true;
    try {
      await p.executar(keepalive);
    } catch (e) {
      decididos.delete(p.lead.id);
      pulados.add(p.lead.id); // volta na rodada dos pulados para você ver de novo
      avisar(`${p.lead.nome}: não deu certo (${e.message}). Ficou entre os pulados.`);
    }
  }

  function agendar(lead, tipo, executar, rotulo) {
    executarPendente(); // a anterior vale já: só uma decisão desfazível por vez
    decididos.set(lead.id, tipo);
    pendente = { lead, indice: i, executar, timer: setTimeout(() => executarPendente(), ESPERA_DESFAZER_MS) };
    $('#c-desfazer-texto').textContent = rotulo;
    const barra = $('#c-desfazer');
    barra.hidden = false;
    barra.classList.remove('correndo'); void barra.offsetWidth; barra.classList.add('correndo');
    avancar(tipo === 'aprovado' ? 1 : -1);
  }

  function desfazer() {
    if (!pendente) return;
    clearTimeout(pendente.timer);
    decididos.delete(pendente.lead.id);
    i = pendente.indice;
    pendente = null;
    $('#c-desfazer').hidden = true;
    desenhar(0);
  }

  const aprovar = (l) => {
    const texto = textos.get(l.id) ?? l.mensagem;
    agendar(l, 'aprovado', (k) => postar(`/api/leads/${encodeURIComponent(l.id)}/aprovar`, { texto }, k), `${l.nome}: aprovado`);
  };
  const descartar = (l, motivo) => agendar(l, 'descartado', (k) => postar(`/api/leads/${encodeURIComponent(l.id)}/descartar`, { motivo }, k),
    `${l.nome}: descartado (${motivos[motivo].toLowerCase()})`);
  const pular = (l) => { pulados.add(l.id); avancar(0); };

  // ------------------------------------------------------------ navegação
  function avancar(direcao) {
    const atual = $('.cartao');
    i += 1;
    if (atual && !reduzirMovimento()) {
      atual.style.transition = 'transform 260ms var(--curva-saida), opacity 260ms';
      atual.style.transform = `translateX(${direcao * 120}%) rotate(${direcao * 8}deg)`;
      atual.style.opacity = '0';
      setTimeout(() => desenhar(direcao), 200);
    } else desenhar(direcao);
  }

  function chips(l) {
    const d = l.decisao || {};
    const z = d.zona;
    const google = l.rating ? `${String(l.rating).replace('.', ',')} ★${l.avaliacoes != null ? ` · ${l.avaliacoes}` : ''}` : null;
    return [
      l.situacao_site ? `<li><span class="selo s-${esc(l.situacao_site)}">${esc(l.situacao_rotulo)}</span></li>` : '',
      l.score != null ? `<li>prioridade <b>${esc(l.score)}</b></li>` : '',
      z?.zona === 'meio' ? '<li class="selo-zona">pediu sua opinião</li>' : '',
      // a chance só aparece com o nicho calibrado (B10/B3): com 3 exemplos, "93%" seria confiança falsa
      z && z.zona !== 'sem_calibracao' ? `<li>chance de você aprovar <b>${Math.round(z.p * 100)}%</b></li>` : '',
      google ? `<li>${esc(google)}</li>` : '',
      `<li><span class="tel">${esc(l.telefone_fmt)}</span> ${esc(l.telefone_tipo || '')}</li>`,
    ].join('');
  }

  function fim() {
    const ap = [...decididos.values()].filter((v) => v === 'aprovado').length;
    const de = decididos.size - ap;
    const restam = fila.filter((l) => pulados.has(l.id) && !decididos.has(l.id));
    $('#c-pilha').innerHTML = `<article class="cartao cartao-fim">
      <h2 id="c-nome">Fila revisada</h2>
      <p><b>${ap}</b> aprovada(s) · <b>${de}</b> descartada(s)${restam.length ? ` · <b>${restam.length}</b> pulada(s)` : ''}</p>
      <p class="sub" id="c-calibracao"></p>
      <div class="cartao-acoes">${restam.length ? '<button class="btn" id="c-rever">Rever os pulados</button>' : ''}<button class="btn primario" data-fechar>Voltar ao painel</button></div>
    </article>`;
    $('#c-pos').textContent = 'Terminou';
    $('#c-barra').style.width = '100%';
    $('#c-rever')?.addEventListener('click', () => { fila = restam; pulados.clear(); i = 0; desenhar(0); });
    (raiz.querySelector('#c-rever') || raiz.querySelector('.cartao-fim [data-fechar]')).focus();
    // quanto falta para a Nova poder decidir sozinha (B3), depois que a última decisão gravar
    setTimeout(async () => {
      try {
        const e = await (await fetch('/api/estado')).json();
        const z = e.tocomas?.zonas?.nichos || [];
        const alvo = raiz.querySelector('#c-calibracao');
        if (alvo && z.length) alvo.textContent = 'Para a Nova decidir sozinha: ' + z.map((n) => `${e.nichos?.[n.nicho] || n.nicho} ${n.pronta ? 'pronta' : `${n.n} de ${n.n + n.faltam}`}`).join(' · ');
      } catch { /* só informativo */ }
    }, ESPERA_DESFAZER_MS + 400);
  }

  function desenhar(direcao) {
    while (i < fila.length && decididos.has(fila[i].id)) i++;
    if (i >= fila.length) { fim(); return; }
    const l = fila[i];
    $('#c-pos').textContent = `${i + 1} de ${fila.length}`;
    $('#c-barra').style.width = `${(100 * i) / fila.length}%`;
    const texto = textos.get(l.id) ?? l.mensagem;
    $('#c-pilha').innerHTML = `<article class="cartao" data-agente="operador" tabindex="-1">
      <div class="cartao-carimbo aprova" aria-hidden="true">Aprovar</div><div class="cartao-carimbo descarta" aria-hidden="true">Descartar</div>
      <header>
        <h2 id="c-nome">${esc(l.nome)}</h2>
        <p class="sub">${esc(l.categoria || '')} · <span class="sem-quebra">${esc(l.cidade)}-${esc(l.uf)}</span></p>
        <ul class="g-resumo">${chips(l)}</ul>
        ${l.motivo ? `<p class="cartao-porque"><span>Por que a Nova escolheu:</span> ${esc(l.motivo)}</p>` : ''}
        ${barrado(l) ? '<p class="aviso">Telefone fixo: com "só celular" ligado nos Ajustes, este lead não pode ser aprovado. Descarte, ou desligue "só celular" se este número tiver WhatsApp.</p>' : ''}
      </header>
      <div class="balao-wa"><textarea id="c-msg" aria-label="Mensagem (pode editar antes de aprovar)">${esc(texto)}</textarea>
        <div class="balao-rodape"><span id="c-contagem">${texto.length} caracteres${textos.has(l.id) ? ' · editada' : ''}</span></div></div>
      <div class="motivos" id="c-motivos" hidden>
        <p>Por que descartar? Um toque.</p>
        <div>${Object.entries(motivos).map(([k, v]) => `<button class="btn" data-motivo="${k}">${esc(v)}</button>`).join('')}</div>
      </div>
      <div class="cartao-acoes">
        <button class="btn perigo" id="c-descartar" aria-expanded="false" aria-controls="c-motivos" title="Atalho: D">Descartar</button>
        <button class="btn fantasma" id="c-pular" title="Atalho: J">Pular</button>
        <button class="btn primario" id="c-aprovar" title="Atalho: A" ${barrado(l) ? 'disabled' : ''}>Aprovar</button>
      </div>
      <p class="cartao-dica sub">Arraste o cartão: direita aprova, esquerda descarta · A / D / J · Ctrl+Z desfaz</p>
    </article>`;
    const cartao = $('.cartao');
    if (!reduzirMovimento() && direcao !== undefined) cartao.classList.add('entrando');
    const msg = $('#c-msg');
    msg.addEventListener('input', () => {
      if (msg.value === l.mensagem) textos.delete(l.id); else textos.set(l.id, msg.value);
      $('#c-contagem').textContent = `${msg.value.length} caracteres${textos.has(l.id) ? ' · editada' : ''}`;
    });
    vestirAviao($('#c-aprovar'), { texto: 'Aprovar', icone: 'aviao' });
    $('#c-aprovar').addEventListener('click', () => aprovar(l));
    $('#c-pular').addEventListener('click', () => pular(l));
    $('#c-descartar').addEventListener('click', (ev) => abrirMotivos(ev.currentTarget));
    $('#c-motivos').addEventListener('click', (ev) => { const b = ev.target.closest('[data-motivo]'); if (b) descartar(l, b.dataset.motivo); });
    ligarGesto(cartao, l);
    (barrado(l) ? $('#c-descartar') : $('#c-aprovar')).focus({ preventScroll: true });
  }

  function abrirMotivos(botao = $('#c-descartar')) {
    const m = $('#c-motivos');
    if (!m) return;
    m.hidden = !m.hidden;
    botao?.setAttribute('aria-expanded', String(!m.hidden));
    if (!m.hidden) { m.scrollIntoView({ block: 'nearest' }); m.querySelector('button').focus(); }
  }

  // arrastar com dedo ou mouse; começar dentro do texto não conta (é para editar)
  function ligarGesto(cartao, l) {
    let x0 = null, y0 = 0, dx = 0, id = null;
    cartao.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('textarea, button, a') || ev.button > 0) return;
      x0 = ev.clientX; y0 = ev.clientY; dx = 0; id = ev.pointerId;
    });
    cartao.addEventListener('pointermove', (ev) => {
      if (x0 == null || ev.pointerId !== id) return;
      dx = ev.clientX - x0;
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(ev.clientY - y0)) return; // rolagem vertical tem prioridade
      cartao.setPointerCapture(id);
      cartao.style.transition = 'none';
      cartao.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
      cartao.style.setProperty('--forca', String(Math.min(1, Math.abs(dx) / LIMIAR_GESTO)));
      cartao.dataset.gesto = dx > 0 ? 'aprova' : 'descarta';
    });
    const soltar = () => {
      if (x0 == null) return;
      x0 = null;
      cartao.style.transition = '';
      if (dx > LIMIAR_GESTO && !barrado(l)) { aprovar(l); return; }
      cartao.style.transform = '';
      delete cartao.dataset.gesto;
      if (dx < -LIMIAR_GESTO) abrirMotivos(); // descartar sempre pede o motivo: é o que ensina a Nova
    };
    cartao.addEventListener('pointerup', soltar);
    cartao.addEventListener('pointercancel', soltar);
  }

  // ------------------------------------------------------------ teclado, fechar
  function tecla(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); fechar(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && pendente) { ev.preventDefault(); desfazer(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey || /^(TEXTAREA|INPUT)$/.test(document.activeElement?.tagName)) return;
    const k = ev.key.toLowerCase();
    if (k === 'tab') { // foco preso no diálogo
      const f = [...raiz.querySelectorAll('button:not([hidden]), textarea, [href]')].filter((e) => e.offsetParent);
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f.at(-1).focus(); }
      else if (!ev.shiftKey && document.activeElement === f.at(-1)) { ev.preventDefault(); f[0].focus(); }
      return;
    }
    const alvo = { a: '#c-aprovar', d: '#c-descartar', j: '#c-pular', arrowright: '#c-pular' }[k];
    if (alvo && $(alvo)) { ev.preventDefault(); $(alvo).click(); }
  }

  // fechar a página no meio dos 5 s não perde a decisão
  const aoSair = () => executarPendente(true);

  async function fechar() {
    document.removeEventListener('keydown', tecla, true);
    removeEventListener('pagehide', aoSair);
    await executarPendente();
    raiz.remove();
    document.body.classList.remove('sem-rolagem');
    // o painel redesenha o botão de origem a cada atualização: se ele sumiu, o foco vai para o conteúdo
    (voltarFoco?.isConnected ? voltarFoco : document.querySelector('#foco-comecar') || document.querySelector('#conteudo'))?.focus?.();
    aoFechar?.();
  }

  raiz.addEventListener('click', (ev) => { if (ev.target.closest('[data-fechar]')) fechar(); });
  $('#c-desfazer-btn').addEventListener('click', desfazer);
  document.addEventListener('keydown', tecla, true);
  addEventListener('pagehide', aoSair);
  desenhar(undefined);
}
