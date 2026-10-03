// B3 — 3 zonas (System One, arXiv 2609.33401): automático só com o nicho calibrado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { MIN_AMOSTRA, registrarPrevisao } from '../src/tocomas/calibracao.mjs';
import { AMOSTRA_ZONA_BAIXA, JANELA_CALIBRACAO, LIMITES, naAmostra, prontidao, resumoZonas, zona } from '../src/tocomas/zonas.mjs';

// histórico calibrado: previu 10% e aprovou 10%; previu 90% e aprovou 90%
function calibrado(db, nicho, n = MIN_AMOSTRA) {
  for (let i = 0; i < n; i++) {
    const alta = i % 2 === 0;
    const k = Math.floor(i / 2);
    registrarPrevisao(db, { leadId: `${nicho}${i}`, nicho, alvo: 'aprovacao', pCabeca: alta ? 0.9 : 0.1, y: alta ? (k % 10 ? 1 : 0) : (k % 10 ? 0 : 1), nAntes: i });
  }
}
const idFora = (() => { let i = 0; while (naAmostra(`x${i}`)) i++; return `x${i}`; })();
const idDentro = (() => { let i = 0; while (!naAmostra(`x${i}`)) i++; return `x${i}`; })();

test('sem calibração nada é automático, nem com 1%', () => {
  const db = abrirBanco(':memory:');
  const pr = prontidao(db, 'estetica');
  assert.deepEqual([pr.pronta, pr.n, pr.faltam], [false, 0, MIN_AMOSTRA]);
  assert.equal(zona(0.01, pr, idFora).zona, 'sem_calibracao');
});

test('nicho calibrado: extremos automáticos, meio é seu', () => {
  const db = abrirBanco(':memory:');
  calibrado(db, 'estetica');
  const pr = prontidao(db, 'estetica');
  assert.equal(pr.pronta, true);
  assert.equal(zona(0.05, pr, idFora).zona, 'baixa');
  assert.equal(zona(0.5, pr, idFora).zona, 'meio');
  assert.equal(zona(0.95, pr, idFora).zona, 'alta');
  assert.equal(zona(LIMITES.descartar_abaixo, pr, idFora).zona, 'meio'); // limite exato não é extremo
});

test('calibração ruim (ECE alto) mantém desligado mesmo com amostra', () => {
  const db = abrirBanco(':memory:');
  for (let i = 0; i < MIN_AMOSTRA; i++) registrarPrevisao(db, { leadId: `e${i}`, nicho: 'estetica', alvo: 'aprovacao', pCabeca: 0.9, y: i % 2, nAntes: i });
  const pr = prontidao(db, 'estetica');
  assert.equal(pr.pronta, false);
  assert.equal(pr.faltam, 0);
});

test('um nicho calibrado não liga o outro', () => {
  const db = abrirBanco(':memory:');
  calibrado(db, 'energia_solar');
  assert.equal(prontidao(db, 'energia_solar').pronta, true);
  assert.equal(prontidao(db, 'estetica').pronta, false);
});

test('viés de seleção: 1 em 10 da zona baixa vem para você', () => {
  const db = abrirBanco(':memory:');
  calibrado(db, 'estetica');
  const pr = prontidao(db, 'estetica');
  assert.deepEqual(zona(0.05, pr, idDentro), { zona: 'meio', amostra: true, p: 0.05, n: pr.n, ece: pr.ece });
  const ids = Array.from({ length: 2000 }, (_, i) => `lead${i}`);
  const fracao = ids.filter(naAmostra).length / ids.length;
  assert.ok(Math.abs(fracao - 1 / AMOSTRA_ZONA_BAIXA) < 0.03, `fração ${fracao}`);
  assert.equal(naAmostra('abc'), naAmostra('abc')); // sempre o mesmo lado
});

test('janela: o começo sem dados não segura as zonas desligadas para sempre', () => {
  const db = abrirBanco(':memory:');
  // 100 previsões ruins no começo (cabeça zerada)…
  for (let i = 0; i < 100; i++) registrarPrevisao(db, { leadId: `v${i}`, nicho: 'estetica', alvo: 'aprovacao', pCabeca: 0.9, y: 0, nAntes: i });
  // …e depois a Nova aprendeu
  calibrado(db, 'estetica', JANELA_CALIBRACAO);
  assert.equal(prontidao(db, 'estetica').pronta, true);
});

test('resumo da Base do Mestre lista os nichos com leads', () => {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO leads (id, nome, nicho, fonte, etapa, criado_em, atualizado_em) VALUES ('a', 'A', 'estetica', 'maps', 'mensagem', 'x', 'x')").run();
  assert.deepEqual(resumoZonas(db).map((z) => [z.nicho, z.pronta]), [['estetica', false]]);
});
