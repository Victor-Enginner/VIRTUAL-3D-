// Veste um <button> existente com o visual "avião" (ui/botao-aviao.css). O botão, o id e os atalhos continuam os mesmos.
//   vestirAviao(botao, { texto: 'Aprovar', pronto: 'Aprovado', icone: 'aviao' | 'x', manter: false })
// No clique o avião decola (~0,65 s) SEM atrasar a ação do botão. Com `manter: true` o botão fica em "pronto" até `desvestirPronto`.
const ICONES = {
  aviao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const letras = (t) => [...t].map((c, i) => `<span class="l" style="--i:${i}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');

export function vestirAviao(botao, { texto, pronto = null, icone = 'aviao', manter = false } = {}) {
  if (!botao || botao.classList.contains('btn-aviao')) return botao;
  texto = texto ?? botao.textContent.trim();
  botao.classList.remove('btn', 'primario', 'fantasma'); // 'perigo' fica: muda a cor do acento
  botao.classList.add('btn-aviao');
  botao.innerHTML = `<span class="luz"></span>
    <span class="estado normal"><span class="icone">${ICONES[icone] || ICONES.aviao}</span><p aria-hidden="true">${letras(texto)}</p><span class="oculto">${esc(texto)}</span></span>
    ${pronto ? `<span class="estado pronto"><span class="icone">${ICONES.check}</span><p aria-hidden="true">${letras(pronto)}</p><span class="oculto">${esc(pronto)}</span></span>` : ''}`;
  botao.addEventListener('click', () => {
    if (botao.disabled || botao.classList.contains('decolando')) return;
    botao.classList.add('decolando');
    setTimeout(() => {
      botao.classList.remove('decolando');
      if (pronto && manter) botao.classList.add('enviado');
    }, 650);
  });
  return botao;
}

export const desvestirPronto = (botao) => botao?.classList.remove('enviado');
