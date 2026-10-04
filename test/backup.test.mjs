import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirBanco } from '../src/db.mjs';
import { backupDiario } from '../src/backup.mjs';

test('backup diário: um por dia, rotação das últimas N, não toca nos backups de migração', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prospector-bkp-'));
  const db = abrirBanco(dir);
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'backups', 'pre-v5-x.db'), 'migracao');
  for (let d = 1; d <= 5; d++) backupDiario(db, dir, { manter: 3, agora: new Date(`2026-10-0${d}T12:00:00Z`) });
  const nomes = fs.readdirSync(path.join(dir, 'backups')).sort();
  assert.deepEqual(nomes, ['diario-2026-10-03.db', 'diario-2026-10-04.db', 'diario-2026-10-05.db', 'pre-v5-x.db']);
  assert.equal(backupDiario(db, dir, { manter: 3, agora: new Date('2026-10-05T20:00:00Z') }).criado, false); // mesmo dia: não repete
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
