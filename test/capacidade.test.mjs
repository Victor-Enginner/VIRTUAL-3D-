import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, lerAjustes, salvarAjustes } from '../src/db.mjs';
import { AMOSTRA_MINIMA, calcularCapacidade, fraseDaCapacidade, TAXA_DE_PARTIDA, taxaDeAproveitamento } from '../src/capacidade.mjs';

const leads = (db, etapa, n, prefixo) => { for (let i = 0; i < n; i++) db.prepare("INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em) VALUES (?, ?, 'maps', ?, 't', 't')").run(`${prefixo}${i}`, `L${prefixo}${i}`, etapa); };

test('poucos leads: usa a taxa de partida e avisa que é estimativa', () => {
  const db = abrirBanco(':memory:');
  leads(db, 'mensagem', 5, 'a');
  const t = taxaDeAproveitamento(db);
  assert.equal(t.estimativa, true);
  assert.equal(t.taxa, TAXA_DE_PARTIDA);
});

test('com amostra suficiente, a taxa é a real: aproveitados ÷ resolvidos, sem contar quem ainda está com os agentes', () => {
  const db = abrirBanco(':memory:');
  leads(db, 'enviado', 20, 'e'); leads(db, 'mensagem', 10, 'm'); // 30 aproveitados
  leads(db, 'descartado', 40, 'd'); leads(db, 'sem_contato', 30, 's'); // 70 perdidos
  leads(db, 'descoberto', 200, 'x'); // ainda no fluxo: fora da conta
  const t = taxaDeAproveitamento(db);
  assert.equal(t.estimativa, false);
  assert.equal(t.resolvidos, 100);
  assert.ok(Math.abs(t.taxa - 0.3) < 1e-9);
  assert.ok(100 >= AMOSTRA_MINIMA);
});

test('capacidade: empresas por dia = mensagens por dia ÷ taxa, em lotes de 50', () => {
  const db = abrirBanco(':memory:');
  leads(db, 'enviado', 30, 'e'); leads(db, 'descartado', 70, 'd'); // taxa 0,3
  salvarAjustes(db, { ...lerAjustes(db), envio: { ...lerAjustes(db).envio, limite_diario: 15 } });
  const c = calcularCapacidade(db);
  assert.equal(c.mensagens_por_dia, 15);
  assert.equal(c.empresas_por_dia, 50);
  assert.equal(c.lotes_por_dia, 1);
  const c50 = calcularCapacidade(db, { metaDia: 50 });
  assert.equal(c50.empresas_por_dia, 167);
  assert.equal(c50.lotes_por_dia, 4);
  assert.match(fraseDaCapacidade(c50), /50 mensagens por dia.*167 empresas por dia.*4 lotes de 50.*30%/);
});

test('a frase avisa quando é só estimativa', () => {
  const db = abrirBanco(':memory:');
  assert.match(fraseDaCapacidade(calcularCapacidade(db)), /Estimativa inicial/);
});
