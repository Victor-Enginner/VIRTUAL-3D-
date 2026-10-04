// Backup diário do banco: uma cópia consistente por dia em data/backups/diario-AAAA-MM-DD.db,
// guardando só as últimas `manter`. Nunca mexe nos backups de migração (pre-v*.db) nem nos estados.
import fs from 'node:fs';
import path from 'node:path';

const PADRAO = /^diario-\d{4}-\d{2}-\d{2}\.db$/;

export function backupDiario(db, dataDir, { manter = 7, agora = new Date() } = {}) {
  const pasta = path.join(dataDir, 'backups');
  fs.mkdirSync(pasta, { recursive: true });
  const dia = agora.toISOString().slice(0, 10);
  const alvo = path.join(pasta, `diario-${dia}.db`);
  let criado = false;
  if (!fs.existsSync(alvo)) {
    db.exec(`VACUUM INTO '${alvo.replace(/'/g, "''")}'`);
    criado = true;
  }
  const antigos = fs.readdirSync(pasta).filter((f) => PADRAO.test(f)).sort().slice(0, -manter);
  for (const f of antigos) fs.rmSync(path.join(pasta, f), { force: true });
  return { arquivo: alvo, criado, removidos: antigos };
}
