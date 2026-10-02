import { EventEmitter } from 'node:events';
import { agora } from './db.mjs';

export const barramento = new EventEmitter();
barramento.setMaxListeners(100);

export function registrar(db, agente, tipo, msg, { lead_id = null, dados = null } = {}) {
  const ev = { ts: agora(), agente, tipo, lead_id, msg, dados };
  const r = db.prepare('INSERT INTO eventos (ts, agente, tipo, lead_id, msg, dados) VALUES (?, ?, ?, ?, ?, ?)')
    .run(ev.ts, agente, tipo, lead_id, msg, dados == null ? null : JSON.stringify(dados));
  ev.id = Number(r.lastInsertRowid);
  barramento.emit('evento', ev);
  return ev;
}
