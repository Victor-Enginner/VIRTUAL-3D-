// Conforto sensorial (docs/ACESSIBILIDADE.md): travas para a interface não virar uma bagunça de sons e movimentos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { falar, parar, preferencias, recortar, salvar } from '../public/ui/audio.js';

const PUBLIC = path.resolve(import.meta.dirname, '..', 'public');
const arquivos = (ext) => fs.readdirSync(PUBLIC, { recursive: true }).filter((f) => ext.some((e) => f.endsWith(e)) && !f.includes('assets')).map((f) => path.join(PUBLIC, f));
const fonte = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(PUBLIC, f).split(path.sep).join('/');

test('só ui/audio.js sabe falar (speechSynthesis)', () => {
  for (const f of arquivos(['.js', '.html'])) {
    if (rel(f) === 'ui/audio.js') continue;
    assert.doesNotMatch(fonte(f), /speechSynthesis\.speak|new SpeechSynthesisUtterance/, `${rel(f)} fala por conta própria`);
  }
});

test('todo falar() fora do módulo diz de onde veio o pedido (clique ou resposta)', () => {
  for (const f of arquivos(['.js'])) {
    if (['ui/audio.js'].includes(rel(f))) continue;
    for (const [linha] of fonte(f).matchAll(/\bfalar\([^\n]*\)/g)) {
      if (/function falar|import/.test(linha)) continue;
      assert.match(linha, /origem:\s*'(clique|resposta)'/, `${rel(f)}: ${linha}`);
    }
  }
});

test('nada toca sozinho: sem autoplay e AudioContext só na Sala, atrás do botão de som', () => {
  for (const f of arquivos(['.js', '.html'])) {
    const t = fonte(f);
    assert.doesNotMatch(t, /\bautoplay\b/i, `${rel(f)} usa autoplay`);
    if (rel(f) !== 'sala.js') assert.doesNotMatch(t, /new (webkitA|a)?AudioContext/i, `${rel(f)} cria áudio`);
  }
  assert.match(fonte(path.join(PUBLIC, 'sala.js')), /const som = \(\(\) => \{\r?\n\s+let ctx = null, ligado = false/, 'o som da Sala começa desligado');
  assert.match(fonte(path.join(PUBLIC, 'sala/tv.js')), /video\.muted = true/, 'a TV começa sem som');
});

test('a voz só sai por pedido: origem ausente ou inventada é recusada', async () => {
  for (const origem of [undefined, 'auto', 'evento', 'sala', 'briefing']) {
    const r = await falar('Bom dia', { origem });
    assert.equal(r.falou, false); assert.match(r.motivo, /só fala quando você pede/);
  }
});

test('resposta falada fica desligada por padrão e some no modo calmo', async () => {
  assert.equal(preferencias().respostas, false);
  assert.equal((await falar('ok', { origem: 'resposta' })).falou, false);
  salvar({ respostas: true, calmo: true });
  assert.match((await falar('ok', { origem: 'resposta' })).motivo, /desligadas/);
  salvar({ respostas: false, calmo: false });
});

test('falas são curtas, sem ocupar a tela nem o ouvido', () => {
  const longo = 'Esta é uma frase de teste. '.repeat(40);
  const r = recortar(longo);
  assert.ok(r.length <= 300, `${r.length}`);
  assert.match(r, /[.…]$/);
  assert.equal(recortar('  curta  '), 'curta');
  assert.equal(recortar(''), '');
});

test('velocidade e volume ficam dentro de limites confortáveis', () => {
  salvar({ velocidade: 9, volume: 5 });
  assert.deepEqual([preferencias().velocidade, preferencias().volume], [1.3, 1]);
  salvar({ velocidade: 0.1, volume: -2 });
  assert.deepEqual([preferencias().velocidade, preferencias().volume], [0.6, 0]);
  salvar({ velocidade: 0.95, volume: 0.9 });
  parar();
});

test('o modo calmo vale em todas as páginas (CSS + shell)', () => {
  assert.match(fonte(path.join(PUBLIC, 'ui/base.css')), /\[data-calmo="1"\][^{]*\{[^}]*animation-duration:\s*1ms/);
  assert.match(fonte(path.join(PUBLIC, 'ui/shell.js')), /import '\.\/audio\.js'/);
  assert.match(fonte(path.join(PUBLIC, 'ui/neural.js')), /dataset\.calmo/);
});
