import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.mjs';
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

test('frase ambígua com o Ollama fora do ar vira "não entendi", não erro', async () => {
  const antes = CONFIG.ollamaUrl;
  CONFIG.ollamaUrl = 'http://127.0.0.1:9'; // porta morta: o teste não depende de o Ollama estar ligado ou não
  try {
    const r = await interpretar('qual a capital da França');
    assert.equal(r.intencao, 'outro'); assert.equal(r.confianca, 0);
  } finally { CONFIG.ollamaUrl = antes; }
});

test('comandos novos por regra: quentes, aprovar, descartar, trocar cidade', () => {
  const casos = [
    ['quantos leads quentes eu tenho?', 'quentes'],
    ['quantos quentes', 'quentes'],
    ['aprova o próximo', 'aprovar_proximo'],
    ['aprovar o próximo cartão', 'aprovar_proximo'],
    ['descarta o próximo', 'descartar_proximo'],
    ['descartar', 'descartar_proximo'],
    ['troca a cidade para Ribeirão Preto SP', 'cidade'],
    ['mudar a cidade pra Franca', 'cidade'],
    ['varre barbearias em Franca SP', 'varrer'], // não regride
    ['pare de varrer', 'pausar'],
  ];
  for (const [fala, esperado] of casos) assert.equal(intencaoPorRegra(fala), esperado, fala);
});

test('trocar a cidade extrai cidade e UF depois de "para"', async () => {
  const a = await interpretar('troca a cidade para Ribeirão Preto SP');
  assert.deepEqual([a.intencao, a.cidade, a.uf], ['cidade', 'Ribeirão Preto', 'SP']);
  const b = await interpretar('mudar a cidade pra Franca');
  assert.deepEqual([b.cidade, b.uf], ['Franca', null]);
});
