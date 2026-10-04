import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { abrirBanco } from '../src/db.mjs';
import { MIGRACOES, VERSAO_ATUAL, versaoDoBanco } from '../src/migracoes.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prospector-mig-'));

test('versões são crescentes e sem buraco (só se acrescenta ao fim)', () => {
  MIGRACOES.forEach((m, i) => assert.equal(m.v, i + 1));
});

test('banco novo chega na versão atual sem backup', () => {
  const d = tmp(); const db = abrirBanco(d);
  assert.equal(versaoDoBanco(db), VERSAO_ATUAL);
  assert.equal(fs.existsSync(path.join(d, 'backups')), false);
  db.close();
});

test('banco antigo (versão 0, sem colunas novas) migra, guarda os dados e faz backup antes', () => {
  const d = tmp();
  let db = abrirBanco(d);
  db.exec('ALTER TABLE crencas DROP COLUMN bloqueio; ALTER TABLE crencas DROP COLUMN historico; ALTER TABLE crencas DROP COLUMN diagnostico; PRAGMA user_version = 0');
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho) VALUES ('x1','Padaria Teste','maps','descoberto','t','t','Franca','SP','estetica')").run();
  db.close();
  db = abrirBanco(d);
  assert.equal(versaoDoBanco(db), VERSAO_ATUAL);
  assert.equal(db.prepare("SELECT nome FROM leads WHERE id = 'x1'").get().nome, 'Padaria Teste');
  assert.ok(db.prepare('PRAGMA table_info(crencas)').all().some((c) => c.name === 'diagnostico'));
  const bk = fs.readdirSync(path.join(d, 'backups'));
  assert.equal(bk.length, 1);
  const copia = new DatabaseSync(path.join(d, 'backups', bk[0]));
  assert.equal(copia.prepare("SELECT nome FROM leads WHERE id = 'x1'").get().nome, 'Padaria Teste');
  copia.close(); db.close();
});

test('abrir de novo é idempotente: nada a migrar, sem backup novo', () => {
  const d = tmp(); abrirBanco(d).close(); abrirBanco(d).close();
  assert.equal(fs.existsSync(path.join(d, 'backups')), false);
});

test('banco de versão maior que o código é recusado', () => {
  const d = tmp(); const db = abrirBanco(d);
  db.exec(`PRAGMA user_version = ${VERSAO_ATUAL + 5}`); db.close();
  assert.throws(() => abrirBanco(d), /só entende até/);
});
