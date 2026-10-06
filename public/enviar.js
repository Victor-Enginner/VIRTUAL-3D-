// Envio guiado: depois de aprovar, a fila de envio precisa de um caminho. Sem o WhatsApp conectado (modo "só escuta")
// quem envia é você, então este fluxo leva um lead por vez: abre o WhatsApp com a mensagem já escrita, você aperta
// enviar lá e volta para marcar "Já enviei". O sistema registra o envio e passa a esperar a resposta.
// Nada aqui envia sozinho. O ritmo recomendado (intervalo entre mensagens e teto diário) aparece na tela e não é imposto.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function postar(caminho, corpo = {}) {
  const r = await fetch(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}
const pegar = (u) => fetch(u).then((r) => r.json());

const link = (e) => `https://wa.me/${encodeURIComponent(e.telefone)}?text=${encodeURIComponent(e.texto)}`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

export async function abrirEnvio({ avisar, aoFechar }) {
  const [{ envios, situacao }, est] = await Promise.all([pegar('/api/envios'), pegar('/api/estado')]);
  // um item por lead: o mais recente que ainda está na fila
  const vistos = new Set();
  const fila = envios.filter((e) => e.status === 'aprovado' && !vistos.has(e.lead_id) && vistos.add(e.lead_id)).reverse();
  if (!fila.length) { avisar('Nada na fila de envio agora'); return; }

  const limite = situacao.limite ?? est.envio?.limite ?? 50;
  const intervaloMin = Math.round((est.ajustes?.envio?.intervalo_min_s ?? 360) / 60);
  let enviadosHoje = situacao.enviados_hoje ?? 0;
  let i = 0, abriu = false, ultimoEnvio = null, tick = null;
  const feitos = new Set(), pulados = new Set();
  const voltarFoco = document.activeElement;

  const raiz = document.createElement('div');
  raiz.className = 'cartoes';
  raiz.innerHTML = `<div class="cartoes-fundo" data-fechar></div>
    <section class="cartoes-palco" role="dialog" aria-modal="true" aria-labelledby="e-nome">
      <header class="cartoes-topo">
        <p class="cartoes-pos" id="e-pos" aria-live="polite"></p>
        <button class="btn icone fantasma" data-fechar aria-label="Fechar (Esc)"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="cartoes-progresso" aria-hidden="true"><i id="e-barra"></i></div>
      </header>
      <div class="cartoes-pilha" id="e-pilha"></div>
    </section>`;
  document.body.append(raiz);
  document.body.classList.add('sem-rolagem');
  const $ = (s) => raiz.querySelector(s);

  function fechar() {
    clearInterval(tick);
    removeEventListener('keydown', teclas);
    raiz.remove();
    document.body.classList.remove('sem-rolagem');
    voltarFoco?.focus?.();
    aoFechar?.();
  }

  const atual = () => { while (i < fila.length && (feitos.has(fila[i].id) || pulados.has(fila[i].id))) i++; return fila[i]; };

  function ritmo() {
    if (enviadosHoje >= limite) return `Teto de hoje atingido (${enviadosHoje} de ${limite}). O resto fica para amanhã.`;
    if (ultimoEnvio) {
      const falta = intervaloMin * 60 - Math.round((Date.now() - ultimoEnvio) / 1000);
      if (falta > 0) return `Ritmo seguro: espere cerca de ${mmss(falta)} antes da próxima (intervalo de ${intervaloMin} min). É uma recomendação, não trava.`;
    }
    return `Hoje: ${enviadosHoje} de ${limite} enviados. Intervalo recomendado entre mensagens: ${intervaloMin} min.`;
  }

  function desenhar() {
    const e = atual();
    if (!e) return fim();
    abriu = false;
    $('#e-pos').textContent = `${feitos.size + pulados.size + 1} de ${fila.length}`;
    $('#e-barra').style.width = `${(100 * (feitos.size + pulados.size)) / fila.length}%`;
    $('#e-pilha').innerHTML = `<article class="cartao" tabindex="-1">
      <header><h2 id="e-nome">${esc(e.nome)}</h2><p class="sub"><span class="tel">${esc(e.telefone_fmt)}</span></p></header>
      <div class="balao-wa"><textarea readonly rows="7" aria-label="Mensagem que vai para o WhatsApp">${esc(e.texto)}</textarea><div class="balao-rodape"><span>${e.texto.length} caracteres</span></div></div>
      <p class="cartao-dica" id="e-ritmo" aria-live="polite">${esc(ritmo())}</p>
      <div class="cartao-acoes cartao-acoes-envio">
        <button class="btn" id="e-cancelar" title="Tira da fila e volta para aprovação">Cancelar envio</button>
        <button class="btn" id="e-pular">Pular</button>
        <a class="btn primario" id="e-abrir" href="${esc(link(e))}" target="_blank" rel="noopener">Abrir no WhatsApp</a>
        <button class="btn primario" id="e-feito" hidden>Já enviei</button>
      </div>
      <p class="cartao-dica">O WhatsApp abre com a mensagem pronta. Aperte enviar lá, volte e marque. · O abre · J já enviei · P pula</p>
    </article>`;
    $('#e-abrir').addEventListener('click', () => { abriu = true; $('#e-feito').hidden = false; $('#e-feito').focus(); });
    $('#e-feito').addEventListener('click', () => marcar(e));
    $('#e-pular').addEventListener('click', () => { pulados.add(e.id); desenhar(); });
    $('#e-cancelar').addEventListener('click', async () => {
      try { await postar(`/api/envios/${e.id}/cancelar`); feitos.add(e.id); avisar(`${e.nome}: voltou para aprovação`); } catch (er) { avisar(er.message); }
      desenhar();
    });
    $('#e-abrir').focus();
  }

  async function marcar(e) {
    try {
      await postar(`/api/leads/${encodeURIComponent(e.lead_id)}/enviado-manual`);
      feitos.add(e.id); enviadosHoje++; ultimoEnvio = Date.now();
      avisar(`${e.nome}: marcado como enviado`);
    } catch (er) { avisar(`${e.nome}: não deu certo (${er.message})`); return; }
    desenhar();
  }

  function fim() {
    const restam = fila.filter((e) => pulados.has(e.id) && !feitos.has(e.id));
    $('#e-pos').textContent = 'Terminou';
    $('#e-barra').style.width = '100%';
    $('#e-pilha').innerHTML = `<article class="cartao cartao-fim"><h2 id="e-nome">Fila de envio revisada</h2>
      <p><b>${feitos.size}</b> enviada(s) agora · <b>${restam.length}</b> pulada(s)</p>
      <p class="sub">Quem responder aparece em "Responderam" no Painel (ou marque "Respondeu" no lead). Sem resposta em 72 h o sistema aprende que a abordagem não funcionou.</p>
      <div class="cartao-acoes">${restam.length ? '<button class="btn" id="e-rever">Rever os pulados</button>' : ''}<button class="btn primario" data-fechar>Voltar ao painel</button></div></article>`;
    $('#e-rever')?.addEventListener('click', () => { pulados.clear(); i = 0; desenhar(); });
    ($('#e-rever') || $('.cartao-fim [data-fechar]')).focus();
  }

  function teclas(ev) {
    if (!raiz.isConnected) return;
    if (ev.key === 'Escape') return fechar();
    if (ev.target.closest?.('textarea, input')) return;
    const e = atual();
    if (!e) return;
    const k = ev.key.toLowerCase();
    if (k === 'o') { window.open(link(e), '_blank', 'noopener'); abriu = true; const f = $('#e-feito'); if (f) { f.hidden = false; f.focus(); } }
    else if (k === 'j' && abriu) marcar(e);
    else if (k === 'p') { pulados.add(e.id); desenhar(); }
  }
  addEventListener('keydown', teclas);
  raiz.addEventListener('click', (ev) => { if (ev.target.closest('[data-fechar]')) fechar(); });
  tick = setInterval(() => { const r = $('#e-ritmo'); if (r) r.textContent = ritmo(); }, 1000);
  desenhar();
}
