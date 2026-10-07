import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora } from '../src/db.mjs';
import { salvarLead } from '../src/agentes.mjs';
import { ativarSessao, novaSessaoDeRastreio, idSessaoAtiva, listarSessoes } from '../src/sessoes.mjs';

const v = { id: 1, cidade: 'Franca', uf: 'SP', nicho: 'barbearia', fonte: 'maps', pais: 'BR' };
const prep = (db) => db.prepare("INSERT INTO varreduras (id, cidade, uf, nicho, fonte, limite, criado_em) VALUES (1, 'Franca', 'SP', 'barbearia', 'maps', 50, ?)").run(agora());

test('sessões: banco novo já nasce com a Sessão 1 e o lead entra nela', () => {
  const db = abrirBanco(':memory:');
  prep(db);
  assert.equal(listarSessoes(db).length, 1);
  salvarLead(db, { nome: 'Barbearia A', telefone: '16999990001' }, v);
  assert.equal(db.prepare('SELECT sessao_id FROM leads').get().sessao_id, idSessaoAtiva(db));
});

test('sessões: nova sessão começa zerada, a anterior fica guardada e dá para voltar', () => {
  const db = abrirBanco(':memory:');
  prep(db);
  salvarLead(db, { nome: 'Barbearia A', telefone: '16999990001' }, v);
  const primeira = idSessaoAtiva(db);
  const s2 = novaSessaoDeRastreio(db, 'Outubro');
  assert.equal(s2.nome, 'Outubro');
  assert.notEqual(s2.id, primeira);
  // mesmo negócio de novo: continua na sessão antiga (não aborda a mesma empresa duas vezes)
  assert.equal(salvarLead(db, { nome: 'Barbearia A', telefone: '16999990001' }, v), 'repetido');
  salvarLead(db, { nome: 'Barbearia B', telefone: '16999990002' }, v);
  const lista = listarSessoes(db);
  assert.deepEqual(lista.map((s) => [s.nome, s.leads, s.ativa]), [['Outubro', 1, true], ['Sessão 1', 1, false]]);
  assert.ok(lista[1].encerrada_em);
  ativarSessao(db, primeira);
  assert.equal(idSessaoAtiva(db), primeira);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n, 2); // nada apagado
});
