import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { contarQuentes, proximoCartao, trocarCidade } from '../src/comandos-acao.mjs';

const lead = (db, id, etapa, score) => db.prepare("INSERT INTO leads (id, nome, fonte, etapa, score, criado_em, atualizado_em) VALUES (?, ?, 'maps', ?, ?, ?, 't')").run(id, `Lead ${id}`, etapa, score, `2026-10-0${id.length}`);

test('quentes: prioridade >= 70 e fora dos encerrados', () => {
  const db = abrirBanco(':memory:');
  lead(db, 'a', 'mensagem', 90); lead(db, 'b', 'enviado', 70); lead(db, 'c', 'descartado', 95); lead(db, 'd', 'mensagem', 50); lead(db, 'e', 'perdido', 99);
  assert.deepEqual(contarQuentes(db), { quentes: 2, para_aprovar: 2 });
});

test('próximo cartão: maior prioridade entre os que esperam decisão', () => {
  const db = abrirBanco(':memory:');
  assert.equal(proximoCartao(db), null);
  lead(db, 'a', 'mensagem', 40); lead(db, 'b', 'mensagem', 85); lead(db, 'c', 'aprovado', 99);
  assert.equal(proximoCartao(db).id, 'b');
});

test('trocar cidade: copia o ramo, desativa as outras cidades e não apaga nada', () => {
  const db = abrirBanco(':memory:');
  assert.equal(trocarCidade(db, 'Franca', 'SP', () => {}).base, 0);
  db.prepare("INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, ativa, criado_em) VALUES ('Batatais','SP','estetica','maps',20,1,'t')").run();
  const criadas = [];
  const r = trocarCidade(db, 'Franca', 'SP', (v) => { criadas.push(v); db.prepare("INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, criado_em) VALUES (?,?,?,?,?,'t')").run(v.cidade, v.uf, v.nicho, v.fonte, v.limite); });
  assert.deepEqual(criadas, [{ cidade: 'Franca', uf: 'SP', nicho: 'estetica', fonte: 'maps', limite: 20 }]);
  assert.equal(r.desativadas, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM varreduras').get().n, 2);
  assert.equal(db.prepare("SELECT ativa FROM varreduras WHERE cidade = 'Franca'").get().ativa, 1);
});
