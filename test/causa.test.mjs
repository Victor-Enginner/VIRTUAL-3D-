// B5: cadeia de causa. Cada evento aponta para o que o causou; a pergunta "por que isso aconteceu?" vira consulta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { abrirBanco } from '../src/db.mjs';
import { registrar } from '../src/eventos.mjs';
import { cadeia, CAUSA_DE, causaDe, TIPOS_DA_CADEIA } from '../src/tocomas/causa.mjs';
import { fecharNegocio } from '../src/agentes.mjs';
import { VERSAO_ATUAL, versaoDoBanco } from '../src/migracoes.mjs';

function banco() {
  const db = abrirBanco(':memory:');
  db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho, telefone, situacao_site)
    VALUES ('L1','Barbearia Teste','maps','descoberto','t','t','Franca','SP','barbearia','5516999990000','sem_site')`).run();
  return db;
}
const ev = (db, agente, tipo, extra = {}) => registrar(db, agente, tipo, `${tipo} de teste`, { lead_id: 'L1', ...extra });
const lista = (db) => db.prepare("SELECT * FROM eventos WHERE lead_id = 'L1' ORDER BY id").all();

test('cada passo do pipeline aponta para o que o causou', () => {
  const db = banco();
  const a = ev(db, 'atlas', 'auditoria'), d = ev(db, 'nova', 'decisao'), m = ev(db, 'maia', 'mensagem'), ap = ev(db, 'leo', 'aprovado'), e = ev(db, 'leo', 'enviado');
  assert.deepEqual([a.causa_id, d.causa_id, m.causa_id, ap.causa_id, e.causa_id], [null, a.id, d.id, m.id, ap.id]);
});

test('a cadeia sai na ordem em que aconteceu e chega até o fechamento', () => {
  const db = banco();
  for (const [ag, t] of [['atlas', 'auditoria'], ['nova', 'decisao'], ['maia', 'mensagem'], ['leo', 'aprovado'], ['leo', 'enviado'], ['leo', 'resposta']]) ev(db, ag, t);
  db.prepare("UPDATE leads SET etapa = 'respondeu' WHERE id = 'L1'").run();
  fecharNegocio(db, 'L1', { valor: 900 });
  const c = cadeia(lista(db));
  assert.deepEqual(c.map((p) => p.tipo), ['auditoria', 'decisao', 'mensagem', 'aprovado', 'enviado', 'resposta', 'fechado']);
  assert.equal(c.at(-1).causa_id, c.at(-2).id);
});

test('envio detectado sem aprovação aponta direto para a mensagem', () => {
  const db = banco();
  ev(db, 'atlas', 'auditoria'); ev(db, 'nova', 'decisao'); const m = ev(db, 'maia', 'mensagem');
  assert.equal(ev(db, 'leo', 'enviado').causa_id, m.id);
});

test('reprocessar: a decisão nova aponta para a auditoria nova, não para a velha', () => {
  const db = banco();
  ev(db, 'atlas', 'auditoria'); ev(db, 'nova', 'decisao');
  const a2 = ev(db, 'atlas', 'auditoria'); const d2 = ev(db, 'nova', 'decisao');
  assert.equal(d2.causa_id, a2.id);
});

test('evento de outro lead nunca vira causa', () => {
  const db = banco();
  db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho) VALUES ('L2','Outro','maps','descoberto','t','t','Franca','SP','barbearia')`).run();
  registrar(db, 'atlas', 'auditoria', 'do outro', { lead_id: 'L2' });
  assert.equal(ev(db, 'nova', 'decisao').causa_id, null);
  assert.equal(causaDe(db, 'L1', 'decisao'), null);
});

test('causa explícita vence a automática, e tipo fora do pipeline não tem causa', () => {
  const db = banco();
  ev(db, 'atlas', 'auditoria');
  assert.equal(ev(db, 'nova', 'decisao', { causa: null }).causa_id, null);
  assert.equal(ev(db, 'nova', 'aviso').causa_id, null);
  assert.equal(registrar(db, 'alva', 'briefing', 'sem lead').causa_id, null);
});

test('sem eventos com causa a cadeia é vazia, e um ciclo mal formado não trava', () => {
  assert.deepEqual(cadeia([]), []);
  const ciclo = [{ id: 1, causa_id: 2, tipo: 'a', agente: 'x', msg: '', ts: '', dados: null }, { id: 2, causa_id: 1, tipo: 'b', agente: 'x', msg: '', ts: '', dados: null }];
  assert.equal(cadeia(ciclo).length, 2);
});

test('toda causa citada é um tipo que a cadeia conhece', () => {
  for (const tipos of Object.values(CAUSA_DE)) for (const t of tipos) assert.ok(TIPOS_DA_CADEIA.includes(t), t);
});

test('banco antigo ganha a coluna causa_id e os dados antigos continuam', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'prospector-causa-'));
  let db = abrirBanco(d);
  registrar(db, 'atlas', 'auditoria', 'antigo');
  db.exec('DROP INDEX eventos_causa; DROP INDEX eventos_lead; ALTER TABLE eventos DROP COLUMN causa_id; PRAGMA user_version = 3');
  db.close();
  db = abrirBanco(d);
  assert.equal(versaoDoBanco(db), VERSAO_ATUAL);
  assert.equal(db.prepare('SELECT msg FROM eventos').get().msg, 'antigo');
  assert.ok(db.prepare('PRAGMA table_info(eventos)').all().some((c) => c.name === 'causa_id'));
  db.close();
});
