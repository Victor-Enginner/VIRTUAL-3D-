import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { abrirLote, cobertura, concluirLote, destravarLotesOrfaos, pedidoDoProximoLote, podeAbrirLote, META_PADRAO } from '../src/lotes.mjs';

function banco() {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, criado_em) VALUES ('Franca', 'SP', 'odontologia', 'maps', 50, 't')").run();
  return db;
}
const lead = (db, id, etapa, lote, extra = {}) => db.prepare("INSERT INTO leads (id, nome, fonte, etapa, varredura_id, lote_id, situacao_site, criado_em, atualizado_em) VALUES (?, ?, 'maps', ?, 1, ?, ?, 't', 't')").run(id, `Lead ${id}`, etapa, lote, extra.situacao ?? null);

test('primeiro lote abre livre, com a meta padrão de 50', () => {
  const db = banco();
  assert.equal(META_PADRAO, 50);
  const l = abrirLote(db, 1);
  assert.deepEqual([l.numero, l.meta, l.pedido, l.status], [1, 50, 50, 'rodando']);
});

test('não abre outro lote enquanto o anterior ainda está sendo buscado', () => {
  const db = banco();
  abrirLote(db, 1);
  const p = podeAbrirLote(db, 1);
  assert.equal(p.ok, false);
  assert.match(p.motivo, /ainda está sendo buscado/);
  assert.throws(() => abrirLote(db, 1), (e) => e.status === 409 && /Ainda não dá para buscar mais/.test(e.message));
});

test('lote com lead esperando você ou os agentes mantém o portão fechado, e diz quantos faltam', () => {
  const db = banco();
  const l = abrirLote(db, 1);
  concluirLote(db, l.id, { coletados: 50, novos: 50, repetidos: 0 });
  ['a', 'b'].forEach((id) => lead(db, id, 'mensagem', l.id));
  lead(db, 'c', 'aprovado', l.id);
  lead(db, 'd', 'qualificado', l.id);
  lead(db, 'e', 'descartado', l.id);
  lead(db, 'f', 'enviado', l.id);
  const p = podeAbrirLote(db, 1);
  assert.equal(p.ok, false);
  assert.equal(p.pendentes.total, 4);
  assert.match(p.motivo, /2 para você aprovar/);
  assert.match(p.motivo, /1 aprovada\(s\) para você enviar/);
  assert.match(p.motivo, /1 ainda com os agentes/);
});

test('quando tudo foi tratado (enviado ou descartado) libera o próximo lote, que pede os já vistos + 50', () => {
  const db = banco();
  const l = abrirLote(db, 1);
  concluirLote(db, l.id, { coletados: 50, novos: 50, repetidos: 0 });
  lead(db, 'a', 'enviado', l.id); lead(db, 'b', 'descartado', l.id); lead(db, 'c', 'sem_contato', l.id);
  assert.equal(podeAbrirLote(db, 1).ok, true);
  assert.equal(pedidoDoProximoLote(db, 1, 50), 100); // os 50 do lote 1 vêm de novo e caem como repetidos
  const l2 = abrirLote(db, 1, 50);
  assert.deepEqual([l2.numero, l2.pedido], [2, 100]);
});

test('fonte sem mais resultados encerra a busca (não insiste em loop)', () => {
  const db = banco();
  const l = abrirLote(db, 1);
  const f = concluirLote(db, l.id, { coletados: 31, novos: 31, repetidos: 0 }); // pediu 50, veio 31
  assert.equal(f.fim, 1);
  const p = podeAbrirLote(db, 1);
  assert.equal(p.ok, false);
  assert.equal(p.esgotada, true);
  assert.match(p.motivo, /outro ramo|outra cidade|outra fonte/);
});

test('erro na coleta não conta como "fim" e deixa tentar de novo', () => {
  const db = banco();
  const l = abrirLote(db, 1);
  const f = concluirLote(db, l.id, { coletados: 0, novos: 0, repetidos: 0, erro: 'coletor Maps: sem internet' });
  assert.deepEqual([f.status, f.fim], ['erro', 0]);
  assert.equal(podeAbrirLote(db, 1).ok, true);
});

test('lote que ficou "rodando" porque o servidor caiu é marcado como erro', () => {
  const db = banco();
  abrirLote(db, 1);
  assert.equal(destravarLotesOrfaos(db), 1);
  assert.equal(db.prepare('SELECT status FROM lotes WHERE id = 1').get().status, 'erro');
});

test('cobertura: uma linha por busca com o histórico dos lotes e os números do funil', () => {
  const db = banco();
  const l = abrirLote(db, 1);
  concluirLote(db, l.id, { coletados: 50, novos: 50, repetidos: 0 });
  lead(db, 'a', 'enviado', l.id, { situacao: 'sem_site' }); lead(db, 'b', 'respondeu', l.id, { situacao: 'site_proprio' }); lead(db, 'c', 'mensagem', l.id, { situacao: 'sem_site' });
  const [c] = cobertura(db);
  assert.deepEqual([c.cidade, c.uf, c.nicho, c.fonte, c.lotes.length], ['Franca', 'SP', 'odontologia', 'maps', 1]);
  assert.deepEqual([c.leads, c.sem_site_ou_fraco, c.enviados, c.responderam], [3, 2, 2, 1]);
  assert.equal(c.lotes[0].pendentes, 1);
  assert.equal(c.lotes[0].fechado, false);
  assert.equal(c.proximo.ok, false);
});

test('a migração põe a busca antiga como lote 1, sem perder histórico', () => {
  const db = abrirBanco(':memory:'); // schema novo
  db.prepare("INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, criado_em, ultima_execucao) VALUES ('Franca', 'SP', 'estetica', 'maps', 20, 'a', 'b')").run();
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, varredura_id, criado_em, atualizado_em) VALUES ('x', 'X', 'maps', 'enviado', 1, 't', 't'), ('y', 'Y', 'maps', 'descartado', 1, 't', 't')").run();
  const mig = import('../src/migracoes.mjs').then(({ MIGRACOES }) => MIGRACOES.find((m) => m.v === 8).up(db));
  return mig.then(() => {
    const l = db.prepare('SELECT * FROM lotes WHERE varredura_id = 1').get();
    assert.deepEqual([l.numero, l.coletados, l.novos, l.status], [1, 2, 2, 'coletado']);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM leads WHERE lote_id = ?').get(l.id).n, 2);
  });
});
