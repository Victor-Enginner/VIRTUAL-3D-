import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora, json } from '../src/db.mjs';
import { registrar } from '../src/eventos.mjs';
import { aplicar, listar, MIN_EVIDENCIAS, mudarEstado, propor, retrato } from '../src/tocomas/habilidades.mjs';
import { validar } from '../src/tocomas/contratos.mjs';

function banco() {
  const db = abrirBanco(':memory:');
  const ins = db.prepare(`INSERT INTO leads (id, nome, nicho, cidade, uf, telefone, situacao_site, avaliacoes, decisao, fonte, etapa, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 'SP', ?, ?, ?, ?, 'maps', 'mensagem', ?, ?)`);
  const lead = (id, nicho, cidade, extra = {}) => {
    ins.run(id, `Negócio ${id}`, nicho, cidade, `55169${id.padStart(8, '0').slice(-8)}`, extra.situacao || 'sem_site', extra.avaliacoes ?? null,
      json({ answers: { abordagem: { choice: extra.angulo || 'ser_encontrado' } } }), agora(), agora());
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  };
  const descartar = (l, motivo) => registrar(db, 'leo', 'descartado', `${l.nome}: descartado`, { lead_id: l.id, dados: { motivo, retrato: retrato(l) } });
  return { db, lead, descartar };
}

test('um descarte só não vira regra; o segundo pelo mesmo motivo e ramo vira proposta', () => {
  const { db, lead, descartar } = banco();
  descartar(lead('1', 'energia_solar', 'Franca'), 'nicho');
  assert.equal(propor(db).length, 0);
  descartar(lead('2', 'energia_solar', 'Franca'), 'nicho');
  const [h] = propor(db);
  assert.equal(MIN_EVIDENCIAS, 2);
  assert.equal(h.estado, 'proposta');
  assert.match(h.quando, /Energia solar/);
  assert.equal(h.evidencias.length, 2);
  assert.equal(validar('habilidade', h).ok, true);
  assert.equal(propor(db).length, 0); // não propõe duas vezes
});

test('proposta não vale até você aceitar; aceita, descarta o lead do ramo', () => {
  const { db, lead, descartar } = banco();
  descartar(lead('1', 'academia', 'Franca'), 'nicho');
  descartar(lead('2', 'academia', 'Franca'), 'nicho');
  const [h] = propor(db);
  const novo = lead('3', 'academia', 'Franca');
  assert.equal(aplicar(db, novo).descartar, null);
  mudarEstado(db, h.id, 'aceitar');
  assert.equal(aplicar(db, novo).descartar.id, h.id);
  assert.equal(aplicar(db, lead('4', 'barbearia', 'Franca')).descartar, null);
  assert.equal(listar(db, 'ativa')[0].aplicada, 1);
  mudarEstado(db, h.id, 'desativar');
  assert.equal(aplicar(db, novo).descartar, null);
  assert.throws(() => mudarEstado(db, h.id, 'aceitar'), /já mudou/);
});

test('lead parecido que você aprovou impede a regra (contraexemplo)', () => {
  const { db, lead, descartar } = banco();
  descartar(lead('1', 'padaria', 'Franca'), 'nicho');
  descartar(lead('2', 'padaria', 'Franca'), 'nicho');
  const aprovado = lead('3', 'padaria', 'Franca');
  db.prepare("INSERT INTO envios (lead_id, telefone, texto, status, criado_em) VALUES (?, ?, 'oi', 'aprovado', ?)").run(aprovado.id, aprovado.telefone, agora());
  assert.equal(propor(db).length, 0);
});

test('negócio grande rebaixa a partir do menor nº de avaliações descartado; mensagem ruim evita o ângulo', () => {
  const { db, lead, descartar } = banco();
  descartar(lead('1', 'restaurante', 'Franca', { avaliacoes: 900 }), 'grande');
  descartar(lead('2', 'restaurante', 'Franca', { avaliacoes: 400 }), 'grande');
  descartar(lead('3', 'oficina', 'Franca', { angulo: 'reputacao' }), 'mensagem');
  descartar(lead('4', 'oficina', 'Franca', { angulo: 'reputacao' }), 'mensagem');
  const hs = [...propor(db), ...propor(db)]; // B9: uma proposta por chamada
  assert.equal(hs.length, 2);
  for (const h of hs) mudarEstado(db, h.id, 'aceitar');
  const r = aplicar(db, lead('5', 'oficina', 'Franca', { avaliacoes: 450 }), ['independencia', 'reputacao']);
  assert.equal(r.rebaixar, 30);
  assert.deepEqual(r.evitar, ['reputacao']);
  assert.equal(aplicar(db, lead('6', 'oficina', 'Franca', { avaliacoes: 100 }), []).rebaixar, 0);
});

test('motivo "outro" nunca vira regra', () => {
  const { db, lead, descartar } = banco();
  for (const id of ['1', '2', '3']) descartar(lead(id, 'pet_shop', 'Franca'), 'outro');
  assert.equal(propor(db).length, 0);
});

test('B9: cada regra diz o que vai usar e que a decisão é sua; uma proposta por chamada, citando evidência real', () => {
  const { db, lead, descartar } = banco();
  descartar(lead('1', 'academia', 'Franca'), 'nicho'); descartar(lead('2', 'academia', 'Franca'), 'nicho');
  descartar(lead('3', 'padaria', 'Franca'), 'nicho'); descartar(lead('4', 'padaria', 'Franca'), 'nicho');
  const primeira = propor(db);
  assert.equal(primeira.length, 1, 'uma mudança por vez');
  assert.match(primeira[0].usar, /Só passa a valer se você aceitar/);
  assert.match(primeira[0].quando, /Padaria|padaria/i); // a que cita o descarte mais recente
  const ids = db.prepare("SELECT id FROM eventos WHERE tipo = 'descartado'").all().map((e) => e.id);
  assert.ok(primeira[0].evidencias.every((e) => ids.includes(e)));
  const segunda = propor(db);
  assert.equal(segunda.length, 1);
  assert.match(segunda[0].quando, /Academia/i);
  mudarEstado(db, primeira[0].id, 'aceitar');
  assert.match(listar(db, 'ativa')[0].usar, /Em uso, por decisão sua/);
});
