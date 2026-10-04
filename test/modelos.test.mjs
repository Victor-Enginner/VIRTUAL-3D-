// Modelo por papel (modelos.json): trocar, herdar, desligar com null e sobrescrever por variável de ambiente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PADRAO_MODELO, resolverModelos } from '../src/config.mjs';
import { decide, promptLocal, TEMPLATES } from '../src/decide/index.mjs';
import { gerarTexto } from '../src/llm.mjs';

const PERG = { ativo: { type: 'noul', instructions: 'Está ativo?', criteria: { true: 'sim', false: 'não' } } };

test('sem arquivo nem ambiente: todos os papéis usam o padrão', () => {
  const m = resolverModelos({}, {});
  for (const p of ['decisao', 'escrita', 'comando']) assert.equal(m[p].modelo, PADRAO_MODELO);
  assert.equal(m.decisao.template, 'qwen3');
});

test('escrita e comando herdam o modelo da decisão se não forem citados', () => {
  const m = resolverModelos({ decisao: { modelo: 'x/modelo:1b', template: 'chatml' } }, {});
  assert.equal(m.escrita.modelo, 'x/modelo:1b');
  assert.equal(m.comando.modelo, 'x/modelo:1b');
});

test('null desliga só aquele papel', () => {
  const m = resolverModelos({ decisao: { modelo: null }, escrita: { modelo: null }, comando: { modelo: 'a:1b' } }, {});
  assert.equal(m.decisao.modelo, null);
  assert.equal(m.escrita.modelo, null);
  assert.equal(m.comando.modelo, 'a:1b');
});

test('variável de ambiente vence o arquivo, e não religa um papel por engano', () => {
  const m = resolverModelos({ decisao: { modelo: 'arquivo:1b' }, escrita: { modelo: null } }, { DECIDE_MODEL: 'env:2b', DECIDE_TEMPLATE: 'llama3' });
  assert.equal(m.decisao.modelo, 'env:2b');
  assert.equal(m.decisao.template, 'llama3');
  assert.equal(m.escrita.modelo, null); // a escrita desligada continua desligada
});

test('decide recusa papel desligado sem tocar na rede', async () => {
  await assert.rejects(decide({ state: {}, questions: PERG, perfil: { modelo: null, template: 'qwen3' } }), /desligado em modelos\.json/);
});

test('gerarTexto recusa quando a escrita está desligada', async () => {
  await assert.rejects(gerarTexto({ sistema: 's', usuario: 'u', modelo: null }), /desligado em modelos\.json/);
});

test('todo template termina onde a resposta começa e mostra as opções', () => {
  const q = { instructions: 'Pergunta?' };
  const ordem = [['a', 'primeira'], ['b', 'segunda']];
  for (const t of Object.keys(TEMPLATES)) {
    const p = promptLocal({ x: 1 }, q, ordem, t);
    assert.ok(p.endsWith('['), `${t} termina em "["`);
    assert.ok(p.includes('[1] primeira') && p.includes('[2] segunda'), `${t} lista as opções`);
  }
  assert.throws(() => promptLocal({}, q, ordem, 'inexistente'), /desconhecido/);
});
