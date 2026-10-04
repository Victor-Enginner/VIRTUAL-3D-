// Globo do Início: batida suave (sem flash), só pulsa com o sistema fluindo, e as travas de conforto estão no código.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { batida, bpmDoFluxo, corDaLatitude, giro, pontosFibonacci } from '../public/ui/globo-logica.js';

const fonte = (f) => fs.readFileSync(path.resolve(import.meta.dirname, '..', 'public', f), 'utf8');

test('os pontos ficam todos na esfera de raio 1 e bem espalhados nos dois hemisférios', () => {
  const p = pontosFibonacci(1000);
  assert.equal(p.length, 3000);
  let norte = 0;
  for (let i = 0; i < 1000; i++) {
    assert.ok(Math.abs(Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) - 1) < 1e-5);
    if (p[i * 3 + 1] > 0) norte++;
  }
  assert.ok(norte > 480 && norte < 520, `norte ${norte}`);
});

test('parado não pulsa; fluindo bate entre 50 e 72 por minuto', () => {
  assert.equal(bpmDoFluxo(0), 0);
  assert.equal(batida(1.234, 0), 0);
  assert.equal(bpmDoFluxo(0.01), 0);
  assert.equal(bpmDoFluxo(0.05), 51);
  assert.equal(bpmDoFluxo(1), 72);
  assert.equal(bpmDoFluxo(9), 72, 'limitado');
});

test('a batida é suave: nunca passa de ~1,1 e muda devagar entre quadros (sem flash)', () => {
  for (const bpm of [50, 61, 72]) {
    let max = 0, maxPasso = 0, anterior = batida(0, bpm);
    for (let q = 1; q < 60 * 10; q++) { // 10 s a 60 quadros por segundo
      const v = batida(q / 60, bpm);
      max = Math.max(max, v); maxPasso = Math.max(maxPasso, Math.abs(v - anterior)); anterior = v;
    }
    assert.ok(max <= 1.15 && max > 0.9, `pico ${max}`);
    assert.ok(maxPasso < 0.25, `salto entre quadros ${maxPasso} a ${bpm} bpm`); // descontinuidade daria > 0,5
  }
});

test('no máximo 2 pulsos por batida e menos de 3 por segundo (WCAG 2.3.1)', () => {
  const bpm = 72, T = 60 / bpm;
  let picos = 0;
  for (let q = 1; q < Math.round(T * 600) - 1; q++) {
    const a = batida((q - 1) / 600, bpm), b = batida(q / 600, bpm), c = batida((q + 1) / 600, bpm);
    if (b > a && b >= c && b > 0.3) picos++;
  }
  assert.ok(picos <= 2, `${picos} picos por ciclo`);
  assert.ok((picos / T) < 3, `${picos / T} pulsos por segundo`);
});

test('a batida é contínua na virada do ciclo (começa e termina em ~0)', () => {
  for (const bpm of [50, 72]) { const T = 60 / bpm; assert.ok(batida(0, bpm) < 0.02 && batida(T - 1e-6, bpm) < 0.02, `bpm ${bpm}`); }
});

test('a batida é periódica', () => {
  assert.ok(Math.abs(batida(0.3, 60) - batida(3.3, 60)) < 1e-9);
});

test('a cor vai do lima ao ciano e o clarão mistura com branco, sem estourar', () => {
  assert.deepEqual(corDaLatitude(0), [183, 255, 0]);
  assert.deepEqual(corDaLatitude(1), [0, 237, 255]);
  assert.deepEqual(corDaLatitude(1, 1), [255, 255, 255]);
  for (const v of corDaLatitude(0.5, 0.2)) assert.ok(v >= 0 && v <= 255);
});

test('o giro é lento: de 0,1 a 0,22 rad/s', () => {
  assert.equal(giro(0), 0.1);
  assert.ok(Math.abs(giro(1) - 0.22) < 1e-9);
  assert.ok(giro(-3) === 0.1 && Math.abs(giro(9) - 0.22) < 1e-9);
});

test('conforto no código: estático no modo calmo, pausa com a aba escondida, limite de quadros, sem som', () => {
  const g = fonte('ui/globo.js');
  assert.match(g, /movimentoReduzido\(\)/);
  assert.match(g, /document\.hidden/);
  assert.match(g, />= 33/, '30 quadros por segundo no máximo');
  assert.match(g, /conforto/, 'reage ao modo calmo');
  assert.doesNotMatch(g, /AudioContext|speechSynthesis|autoplay/);
  assert.match(fonte('inicio.js'), /globo\.fluxo\(estado\.pausado \? 0/, 'agentes pausados = globo parado');
});
