// A Sala 3D continua de onde parou quando você sai da página e volta (antes "tudo mudava novamente").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CHAVE, VALIDADE_MS, lerCena, salvarCena } from '../public/sala/cena-salva.js';

const armazem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const agora = 10_000_000;
const cena = () => ({ ag: { alva: { x: 3.5, z: -2, rot: 1.2, pontoDePausa: 'copa', ultimaArea: 'janela', ultimaAtividade: agora - 5000 }, maia: { x: -6, z: 4, rot: 0, pontoDePausa: 'lounge' } }, equipe: agora - 1000, cam: { mexida: true, p: [10, 12, 14], t: [0, 0.6, -0.5] } });

test('o que foi salvo volta igual: posição, ponto de pausa, atividade e câmera', () => {
  const a = armazem();
  assert.equal(salvarCena(a, cena(), agora), true);
  const c = lerCena(a, agora + 30_000);
  assert.deepEqual([c.ag.alva.x, c.ag.alva.z, c.ag.alva.pontoDePausa, c.ag.alva.ultimaArea], [3.5, -2, 'copa', 'janela']);
  assert.equal(c.ag.alva.ultimaAtividade, agora - 5000);
  assert.deepEqual(c.cam, { p: [10, 12, 14], t: [0, 0.6, -0.5] });
  assert.equal(c.equipe, agora - 1000);
  assert.equal(c.ag.maia.ultimaAtividade, null, 'campo ausente vira null, não quebra');
});

test('cena velha (mais de 15 min) ou "do futuro" é descartada: a sala recomeça do zero', () => {
  const a = armazem();
  salvarCena(a, cena(), agora);
  assert.ok(lerCena(a, agora + VALIDADE_MS - 1));
  assert.equal(lerCena(a, agora + VALIDADE_MS + 1), null);
  assert.equal(lerCena(a, agora - 120_000), null);
});

test('lixo no armazenamento nunca derruba a sala', () => {
  for (const ruim of ['', 'não é json', '{"em":"x"}', 'null', '[1,2]', '{"em":10000000,"ag":5}']) {
    const a = armazem(); a.setItem(CHAVE, ruim);
    assert.doesNotThrow(() => lerCena(a, agora));
  }
  assert.equal(lerCena(null, agora), null, 'sem armazenamento (aba privada) funciona');
  assert.equal(salvarCena({ setItem() { throw new Error('cheio'); } }, cena(), agora), false);
});

test('posição fora da sala ou inválida: aquele agente recomeça na mesa; os outros voltam', () => {
  const a = armazem();
  salvarCena(a, { ag: { alva: { x: 99, z: 0 }, atlas: { x: 'a', z: 1 }, nova: { x: 2, z: 2 }, leo: null }, cam: null }, agora);
  const c = lerCena(a, agora);
  assert.deepEqual(Object.keys(c.ag), ['nova']);
});

test('câmera que você não mexeu não é restaurada (a vista geral se ajusta ao tamanho da janela)', () => {
  const a = armazem();
  salvarCena(a, { ...cena(), cam: { mexida: false, p: [1, 2, 3], t: [0, 0, 0] } }, agora);
  assert.equal(lerCena(a, agora).cam, null);
  salvarCena(a, { ...cena(), cam: { mexida: true, p: [1, 2], t: [0, 0, 0] } }, agora);
  assert.equal(lerCena(a, agora).cam, null, 'câmera mal formada é ignorada');
});

test('a Sala usa o retrato: lê ao abrir, grava a cada poucos segundos e ao sair', () => {
  const s = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'public', 'sala.js'), 'utf8');
  assert.match(s, /lerCena\(armazem\)/);
  assert.match(s, /setInterval\(gravarCena, 4000\)/);
  assert.match(s, /addEventListener\('pagehide', gravarCena\)/);
  assert.match(s, /if \(volta\) a\.destino = null/, 'quem volta de outra página é levado ao destino certo, sem teletransporte');
  assert.match(s, /if \(!Object\.keys\(ag\)\.length\) return/, 'nunca sobrescreve um retrato bom com um vazio');
});
