import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG } from '../src/config.mjs';
import { extrairLiterais, GRUPOS_INTENCAO, intencaoPorRegra, interpretar, PERGUNTA_INTENCAO } from '../src/comando.mjs';

const { casos } = JSON.parse(fs.readFileSync(new URL('./fixtures/comandos-reais.json', import.meta.url), 'utf8'));
const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// O motor lê 1 token (rótulos 1..9). Uma 10ª opção quebrava o LLM do comando EM SILÊNCIO; isto impede de novo.
test('decisão hierárquica: cada etapa tem de 2 a 9 opções e cobre todas as intenções', () => {
  const grupos = Object.keys(GRUPOS_INTENCAO);
  assert.ok(grupos.length >= 2 && grupos.length <= 9);
  const todas = Object.values(GRUPOS_INTENCAO).flatMap((g) => g.intencoes);
  for (const g of Object.values(GRUPOS_INTENCAO)) assert.ok(g.intencoes.length <= 9);
  assert.deepEqual([...todas].sort(), Object.keys(PERGUNTA_INTENCAO.intencao.criteria).sort());
});

// Sem o Ollama (o teste não depende dele): o que a regra decide tem que estar certo; o resto vira "não entendi", nunca ação errada.
test('frases reais: com o LLM desligado nada executa errado', async () => {
  const antes = CONFIG.modelos.comando.modelo;
  CONFIG.modelos.comando.modelo = null;
  try {
    for (const c of casos) {
      const r = await interpretar(c.frase);
      if (r.origem !== 'regra') { assert.equal(r.confianca, 0, c.frase); continue; }
      for (const [k, v] of Object.entries(c.esperado)) assert.equal(sem(r[k]), sem(v), `${c.frase} → ${k}`);
    }
  } finally { CONFIG.modelos.comando.modelo = antes; }
});

test('extração: estado por extenso, "por", "na cidade de", enfeite no fim e último "em"', () => {
  const x = (f) => { const l = extrairLiterais(f); return [l.cidade, l.uf]; };
  assert.deepEqual(x('busca restaurante em belo horizonte minas gerais'), ['Belo Horizonte', 'MG']);
  assert.deepEqual(x('busca restaurantes em campinas são paulo'), ['Campinas', 'SP']);
  assert.deepEqual(x('procura barbearia por franca'), ['Franca', null]);
  assert.deepEqual(x('quero 50 barbearias na cidade de franca'), ['Franca', null]);
  assert.deepEqual(x('acha uns dentistas em franca pra mim'), ['Franca', null]);
  assert.deepEqual(x('procura hotel para pets em Campinas'), ['Campinas', null]);
  assert.deepEqual(x('varre pizzaria em Santo André'), ['Santo André', null]);
  assert.equal(intencaoPorRegra('liga a luz'), null); // "liga" sem falar dos agentes não religa nada
  assert.equal(intencaoPorRegra('liga os agentes'), 'retomar');
});
