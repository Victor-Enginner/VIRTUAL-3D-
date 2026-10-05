// Conforto sensorial (docs/ACESSIBILIDADE.md): travas para a interface não virar uma bagunça de sons e movimentos.
// Os agentes NÃO falam. O Victor fala com eles (microfone), eles respondem em texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { movimentoReduzido, preferencias, salvar } from '../public/ui/conforto.js';

const PUBLIC = path.resolve(import.meta.dirname, '..', 'public');
const arquivos = (ext) => fs.readdirSync(PUBLIC, { recursive: true }).filter((f) => ext.some((e) => f.endsWith(e)) && !f.includes('assets') && !f.startsWith('ilhas')).map((f) => path.join(PUBLIC, f));
const fonte = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(PUBLIC, f).split(path.sep).join('/');

test('ninguém fala: nenhum arquivo do front usa voz sintetizada (só o microfone, que é entrada)', () => {
  for (const f of arquivos(['.js', '.html'])) {
    assert.doesNotMatch(fonte(f), /speechSynthesis|SpeechSynthesisUtterance|\.speak\(/, `${rel(f)} faz algo falar`);
  }
  assert.match(fonte(path.join(PUBLIC, 'app.js')), /SpeechRecognition/, 'o comando de voz (microfone) continua');
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

test('preferências: tudo começa desligado, e chaves antigas (voz) são ignoradas', () => {
  assert.deepEqual(preferencias(), { calmo: false, mascotes: false, mascotesApesarDoSistema: false });
  salvar({ voz: 'qualquer', respostas: true, velocidade: 2 });
  assert.deepEqual(Object.keys(preferencias()).sort(), ['calmo', 'mascotes', 'mascotesApesarDoSistema']);
});

test('o modo calmo liga o movimento reduzido e desliga ao sair', () => {
  assert.equal(movimentoReduzido(), false);
  salvar({ calmo: true });
  assert.equal(movimentoReduzido(), true);
  salvar({ calmo: false });
  assert.equal(movimentoReduzido(), false);
});

test('o modo calmo vale em todas as páginas (CSS + shell + fundo neural)', () => {
  assert.match(fonte(path.join(PUBLIC, 'ui/base.css')), /\[data-calmo="1"\][^{]*\{[^}]*animation-duration:\s*1ms/);
  assert.match(fonte(path.join(PUBLIC, 'ui/shell.js')), /import '\.\/conforto\.js'/);
  assert.match(fonte(path.join(PUBLIC, 'ui/neural.js')), /dataset\.calmo/);
});

test('a página de conforto existe e a de voz foi embora', () => {
  assert.ok(fs.existsSync(path.join(PUBLIC, 'conforto.html')) && fs.existsSync(path.join(PUBLIC, 'conforto.js')));
  assert.ok(!fs.existsSync(path.join(PUBLIC, 'voz.html')) && !fs.existsSync(path.join(PUBLIC, 'voz.js')) && !fs.existsSync(path.join(PUBLIC, 'ui/audio.js')));
});

test('toda página do menu tem ícone (senão aparece "undefined" na barra lateral)', async () => {
  const shell = fonte(path.join(PUBLIC, 'ui/shell.js'));
  const ids = [...shell.matchAll(/^\s*\['(\w+)', '\/[^']*', '[^']*', '(?:workspace|escritorio)'\]/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 10, `${ids.length} páginas no menu`);
  for (const id of ids) assert.match(shell, new RegExp(String.raw`^\s+${id}: ic\(`, 'm'), `falta ícone para \"${id}\"`);
});

// As ilhas React (web/src) são compiladas para public/ilhas; o bundle tem código do React, então a regra vale no FONTE.
test('ilhas React: fonte sem voz, sem áudio e sem animação em laço infinito', () => {
  const WEB = path.resolve(import.meta.dirname, '..', 'web', 'src');
  const fontes = fs.readdirSync(WEB, { recursive: true }).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => path.join(WEB, f));
  assert.ok(fontes.length > 0);
  for (const f of fontes) {
    const t = fonte(f), nome = path.relative(WEB, f);
    assert.doesNotMatch(t, /speechSynthesis|SpeechSynthesisUtterance|\.speak\(|new (webkitA|a)?AudioContext|autoplay/i, `${nome} fala ou toca`);
    assert.doesNotMatch(t, /repeat:\s*Infinity|animation[^;]*infinite/, `${nome} anima em laço sozinho`);
  }
  assert.match(fonte(path.join(WEB, 'ilhas.tsx')), /reducedMotion/, 'as ilhas respeitam o modo calmo');
});
