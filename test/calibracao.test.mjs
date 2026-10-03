// B10 — calibração por nicho (arXiv 2609.33401): a média pode esconder um grupo muito errado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora } from '../src/db.mjs';
import { aprender } from '../src/aprendizado.mjs';
import { metricas, MIN_AMOSTRA, registrarPrevisao, relatorio } from '../src/tocomas/calibracao.mjs';

test('métricas: previsão perfeita tem ECE 0; sempre 50% num 50/50 tem Brier 0,25', () => {
  const certo = [[0.1, 0], [0.1, 0], [0.9, 1], [0.9, 1]];
  assert.equal(metricas(certo).brier, 0.01);
  const meio = Array.from({ length: 10 }, (_, i) => [0.5, i % 2]);
  assert.deepEqual([metricas(meio).brier, metricas(meio).ece], [0.25, 0]);
  // 90% de confiança, acerta 50%: ECE 0,4
  assert.equal(metricas(Array.from({ length: 10 }, (_, i) => [0.9, i % 2])).ece, 0.4);
  assert.equal(metricas([]).n, 0);
});

test('relatório: média aceitável esconde o nicho ruim, e o pior nicho é apontado', () => {
  const db = abrirBanco(':memory:');
  const n = MIN_AMOSTRA;
  for (let i = 0; i < n; i++) {
    // solar: bem calibrado (80% previsto, 80% aprovado)
    registrarPrevisao(db, { leadId: `s${i}`, nicho: 'energia_solar', alvo: 'aprovacao', pCabeca: 0.8, y: i % 5 ? 1 : 0, nAntes: i });
    // estética: 80% previsto, 20% aprovado
    registrarPrevisao(db, { leadId: `e${i}`, nicho: 'estetica', alvo: 'aprovacao', pCabeca: 0.8, y: i % 5 ? 0 : 1, nAntes: i });
  }
  const r = relatorio(db).aprovacao.p_cabeca;
  assert.equal(r.por_nicho.energia_solar.ece, 0);
  assert.equal(r.por_nicho.estetica.ece, 0.6);
  assert.equal(r.geral.ece, 0.3); // só a média sugere "mais ou menos"
  assert.equal(r.pior_nicho, 'estetica');
});

test('pouca amostra não aponta pior nicho', () => {
  const db = abrirBanco(':memory:');
  registrarPrevisao(db, { leadId: 'x', nicho: 'estetica', alvo: 'aprovacao', pCabeca: 0.9, y: 0, nAntes: 0 });
  const r = relatorio(db).aprovacao.p_cabeca;
  assert.equal(r.geral.confiavel, false);
  assert.equal(r.pior_nicho, null);
});

test('aprender registra a previsão de ANTES do exemplo (prequencial)', () => {
  const db = abrirBanco(':memory:');
  const lead = { id: 'L', nicho: 'estetica', situacao_site: 'sem_site', rating: 4.5, avaliacoes: 30, score: 72, decisao: '{}', criado_em: agora() };
  aprender(db, 'aprovacao', lead, 1);
  aprender(db, 'aprovacao', lead, 1);
  const linhas = db.prepare('SELECT * FROM previsoes ORDER BY id').all();
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].p_cabeca, 0.5); // cabeça zerada: 50%
  assert.equal(linhas[0].n_antes, 0);
  assert.ok(linhas[1].p_cabeca > 0.5); // já aprendeu com o primeiro
  assert.equal(linhas[0].p_score, 0.72);
});
