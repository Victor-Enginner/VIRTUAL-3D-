import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, estatisticasDecide, zerarEstatisticasDecide } from '../src/decide/index.mjs';

test('B14: o gateway conta chamadas e erros por papel e modelo, com latência', async () => {
  zerarEstatisticasDecide();
  await assert.rejects(decide({ state: {}, questions: {} }));
  await assert.rejects(decide({ state: {}, questions: null, papel: 'comando' }));
  await assert.rejects(decide({ state: {}, questions: {} }));
  const por = Object.fromEntries(estatisticasDecide().map((e) => [e.chave.split(':')[0], e]));
  assert.equal(por.decisao.chamadas, 2);
  assert.equal(por.decisao.erros, 2);
  assert.equal(por.comando.chamadas, 1);
  assert.ok(Number.isFinite(por.decisao.p50_ms) && por.decisao.p95_ms >= por.decisao.p50_ms);
  assert.match(por.decisao.ultimo_erro, /questions/);
});
