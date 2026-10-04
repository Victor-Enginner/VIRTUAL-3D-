import test from 'node:test';
import assert from 'node:assert/strict';
import { intencaoPorRegra, interpretar } from '../src/comando.mjs';

const casos = [
  ['varre barbearias em Franca SP', 'varrer'],
  ['busca clínicas de estética em Ribeirão Preto', 'varrer'],
  ['procura dentistas em Belém Pará', 'varrer'], // "Pará" é estado, não "pare"
  ['pare de varrer', 'pausar'],
  ['para de buscar', 'pausar'],
  ['pausa os agentes', 'pausar'],
  ['desliga tudo', 'pausar'],
  ['retoma os agentes', 'retomar'],
  ['pode continuar', 'retomar'],
  ['liga os agentes de novo', 'retomar'],
  ['me dá um resumo do dia', 'resumo'],
  ['como está o dia?', 'resumo'],
  ['qual o relatório de hoje', 'resumo'],
  ['qual a capital da França', null],
];
for (const [fala, esperado] of casos) test(`voz: "${fala}" → ${esperado}`, () => assert.equal(intencaoPorRegra(fala), esperado));

test('com a regra não precisa de modelo nem de rede', async () => {
  const r = await interpretar('varre barbearias em Franca SP');
  assert.equal(r.intencao, 'varrer'); assert.equal(r.origem, 'regra'); assert.equal(r.confianca, 1);
  assert.equal(r.cidade, 'Franca'); assert.equal(r.uf, 'SP'); assert.equal(r.nicho, 'barbearia');
});

test('frase ambígua com o Ollama desligado vira "não entendi", não erro', async () => {
  const r = await interpretar('qual a capital da França');
  assert.equal(r.intencao, 'outro'); assert.equal(r.confianca, 0);
});
