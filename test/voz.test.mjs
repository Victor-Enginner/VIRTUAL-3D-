import test from 'node:test';
import assert from 'node:assert/strict';

// navegador de mentira: um botão e um reconhecedor de voz que o teste controla
function botaoFalso() {
  const classes = new Set(), attrs = {}, ouvintes = {};
  return {
    disabled: false, title: '',
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    setAttribute: (k, v) => { attrs[k] = v; }, attrs,
    addEventListener: (ev, fn) => { ouvintes[ev] = fn; },
    clicar: () => ouvintes.click(),
  };
}
class Reconhecedor {
  static ultimo = null;
  constructor() { Reconhecedor.ultimo = this; }
  start() { this.ligado = true; }
  stop() { this.ligado = false; this.onend?.(); }
  dizer(texto, final = true) { this.onresult({ results: [Object.assign([{ transcript: texto }], { isFinal: final })] }); }
}

test('voz: sem suporte do navegador o botão fica desabilitado e explica', async () => {
  delete globalThis.SpeechRecognition; delete globalThis.webkitSpeechRecognition;
  const { ligarVoz, vozDisponivel } = await import('../public/ui/voz.js?sem-suporte');
  const b = botaoFalso();
  assert.equal(vozDisponivel(), false);
  assert.equal(ligarVoz(b), null);
  assert.equal(b.disabled, true);
  assert.match(b.title, /Chrome ou Edge/);
});

test('voz: só escuta depois do clique; parcial preenche, final executa; segundo clique encerra', async () => {
  globalThis.webkitSpeechRecognition = Reconhecedor;
  const { ligarVoz } = await import('../public/ui/voz.js?com-suporte');
  const b = botaoFalso(), vistos = { parcial: [], final: [], ouvindo: [] };
  const v = ligarVoz(b, { aoParcial: (t) => vistos.parcial.push(t), aoFinal: (t) => vistos.final.push(t), aoMudar: (o) => vistos.ouvindo.push(o) });
  assert.equal(Reconhecedor.ultimo, null, 'nada escuta antes do clique');
  b.clicar();
  assert.equal(Reconhecedor.ultimo.lang, 'pt-BR');
  assert.equal(b.classList.contains('ouvindo'), true);
  assert.equal(b.attrs['aria-pressed'], 'true');
  Reconhecedor.ultimo.dizer('varre dentista em franca', false);
  assert.deepEqual(vistos.final, []);
  Reconhecedor.ultimo.dizer('varre dentista em franca sp', true);
  assert.deepEqual(vistos.final, ['varre dentista em franca sp']);
  assert.equal(v.ouvindo(), true);
  b.clicar(); // segundo clique para
  assert.equal(b.classList.contains('ouvindo'), false);
  assert.equal(v.ouvindo(), false);
  assert.deepEqual(vistos.ouvindo, [true, false]);
});

test('voz: erro vira mensagem em português para o Victor', async () => {
  globalThis.webkitSpeechRecognition = Reconhecedor;
  const { ligarVoz, mensagemDeErroDeVoz } = await import('../public/ui/voz.js?erro');
  const b = botaoFalso(), erros = [];
  ligarVoz(b, { aoErro: (m) => erros.push(m) });
  b.clicar();
  Reconhecedor.ultimo.onerror({ error: 'not-allowed' });
  assert.match(erros[0], /Permissão de microfone negada/);
  assert.match(mensagemDeErroDeVoz('no-speech'), /Não ouvi nada/);
  assert.match(mensagemDeErroDeVoz('algo-novo'), /algo-novo/);
});
