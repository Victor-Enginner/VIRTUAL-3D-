// Mascotes: ficam mais ausentes que presentes e nunca aparecem quando alguém pediu calma (docs/ACESSIBILIDADE.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AGENTES, BORDAS, CFG, motivoDeNaoAparecer, olhar, planejarVisita, proximaAusencia } from '../public/ui/mascotes-logica.js';
import { preferencias } from '../public/ui/audio.js';

const PUBLIC = path.resolve(import.meta.dirname, '..', 'public');
const fonte = (f) => fs.readFileSync(path.join(PUBLIC, f), 'utf8');

// gerador fixo: o teste não pode depender de sorte
function semente(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('a ausência é de 2 a 6 minutos e a visita de 10 a 24 segundos', () => {
  const r = semente(1);
  for (let i = 0; i < 2000; i++) {
    const a = proximaAusencia(r), v = planejarVisita(r).duracaoMs;
    assert.ok(a >= 120_000 && a <= 360_000, `ausência ${a}`);
    assert.ok(v >= 10_000 && v <= 24_000, `visita ${v}`);
  }
});

test('mais ausentes do que presentes: no máximo ~15% do tempo na tela, no pior caso e na média', () => {
  const pior = CFG.visitaMaxMs / (CFG.visitaMaxMs + CFG.ausenciaMinMs);
  assert.ok(pior < 0.2, `pior caso ${pior}`);
  const r = semente(7); let tela = 0, total = 0;
  for (let i = 0; i < 5000; i++) { const v = planejarVisita(r).duracaoMs; tela += v; total += v + proximaAusencia(r); }
  assert.ok(tela / total < 0.1, `média ${(tela / total).toFixed(3)}`);
});

test('no máximo 2 por vez, sempre agentes reais, em dupla só quando brincam', () => {
  const r = semente(3); let duplas = 0;
  for (let i = 0; i < 3000; i++) {
    const v = planejarVisita(r);
    assert.ok(v.agentes.length >= 1 && v.agentes.length <= 2);
    assert.equal(new Set(v.agentes).size, v.agentes.length, 'sem repetir o mesmo na dupla');
    assert.ok(v.agentes.every((a) => AGENTES.includes(a)) && BORDAS.includes(v.borda));
    assert.equal(v.brincam, v.agentes.length === 2);
    if (v.brincam) duplas++;
  }
  assert.ok(duplas / 3000 > 0.15 && duplas / 3000 < 0.25, `duplas ${duplas / 3000}`);
});

test('não repete o mesmo mascote na visita seguinte', () => {
  const r = semente(9);
  let ultimos = [];
  for (let i = 0; i < 500; i++) { const v = planejarVisita(r, ultimos); assert.ok(!v.agentes.some((a) => ultimos.includes(a)), `${v.agentes} após ${ultimos}`); ultimos = v.agentes; }
});

test('qualquer pedido de calma vence: desligado, modo calmo, reduzir movimento, aba escondida, Alva falando', () => {
  const livre = { ligado: true, calmo: false, reduzido: false, abaOculta: false, falando: false };
  assert.equal(motivoDeNaoAparecer(livre), null);
  for (const [k, v] of [['ligado', false], ['calmo', true], ['reduzido', true], ['abaOculta', true], ['falando', true]]) {
    assert.ok(motivoDeNaoAparecer({ ...livre, [k]: v }), `${k} deveria bloquear`);
  }
});

test('o olhar acompanha o ponteiro com limite e fica no centro quando não há ponteiro', () => {
  assert.deepEqual(olhar(100, 100, null), { dx: 0, dy: 0 });
  const longe = olhar(100, 100, { x: 5000, y: 100 });
  assert.ok(Math.abs(longe.dx) <= 2.2 && longe.dy === 0 && longe.dx > 2);
  const perto = olhar(100, 100, { x: 130, y: 100 });
  assert.ok(perto.dx > 0 && perto.dx < longe.dx);
  assert.deepEqual(olhar(100, 100, { x: 100, y: 100 }), { dx: 0, dy: 0 });
});

test('mascotes vêm desligados e as travas de conforto estão no código', () => {
  assert.equal(preferencias().mascotes, false);
  assert.equal(preferencias().mascotesApesarDoSistema, false, 'respeitar o sistema é o padrão');
  const m = fonte('ui/mascotes.js');
  assert.match(m, /pointer-events:none/, 'nunca bloqueiam um clique');
  assert.match(m, /aria-hidden/, 'são decorativos para leitor de tela');
  assert.doesNotMatch(m, /AudioContext|speechSynthesis|new Audio|autoplay/, 'sem som');
  assert.match(m, /reduzidoEfetivo = \(\) => reduzido\(\) && !preferencias\(\)\.mascotesApesarDoSistema/, 'só a escolha explícita vence o sistema');
  assert.match(m, /motivoDeNaoAparecer\(\{ ligado: p\.mascotes, calmo: p\.calmo/, 'o modo calmo sempre é checado');
  assert.match(m, /document\.hidden/, 'somem com a aba escondida');
  assert.match(fonte('ui/shell.js'), /\['sala', 'base'\]\.includes\(ativa\)\) iniciarMascotes/, 'fora da Sala 3D e da Base');
  const tam = Number(m.match(/const TAM = (\d+)/)[1]);
  assert.ok(tam <= 72, `tamanho ${tam}px`);
});
