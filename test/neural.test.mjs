// Rede neural do fundo (public/ui/neural.js): só as partes puras — topologia e quanto ela "vive".
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirRede, impulsosPara, pontoNaAresta } from '../public/ui/neural.js';

test('rede: mesma topologia sempre (semente fixa), menor no celular', () => {
  const a = construirRede(1400, 900), b = construirRede(1400, 900);
  assert.deepEqual(a.nos.map((n) => [n.x, n.y]), b.nos.map((n) => [n.x, n.y]));
  const cel = construirRede(390, 844);
  assert.ok(cel.nos.length < a.nos.length);
  assert.equal(cel.maxImpulsos, 10);
  for (const n of a.nos) assert.ok(n.x >= 4 && n.x <= 1396 && n.y >= 4 && n.y <= 896);
  for (const e of a.arestas) assert.ok(a.nos[e.a] && a.nos[e.b]);
});

test('viva só com agente trabalhando: parada = estática, mais agentes = mais impulsos, com teto', () => {
  assert.equal(impulsosPara(0, 18), 0);
  assert.ok(impulsosPara(1, 18) < impulsosPara(3, 18));
  assert.equal(impulsosPara(5, 18), 18);
  assert.equal(impulsosPara(5, 10), 10);
  assert.equal(impulsosPara(-2, 18), 0);
});

test('impulso percorre a aresta da ponta de origem até a de destino', () => {
  const r = construirRede(1400, 900);
  const e = r.arestas[0];
  assert.deepEqual(pontoNaAresta(r, e, 0), { x: r.nos[e.a].x, y: r.nos[e.a].y });
  const fim = pontoNaAresta(r, e, 1);
  assert.ok(Math.abs(fim.x - r.nos[e.b].x) < 1e-9 && Math.abs(fim.y - r.nos[e.b].y) < 1e-9);
});
