import { EventEmitter } from 'node:events';
import { agora } from './db.mjs';
import { causaDe } from './tocomas/causa.mjs';

export const barramento = new EventEmitter();
barramento.setMaxListeners(100);

export function registrar(db, agente, tipo, msg, { lead_id = null, dados = null, causa } = {}) {
  const causa_id = causa !== undefined ? causa : causaDe(db, lead_id, tipo); // B5: o que causou este evento
  const ev = { ts: agora(), agente, tipo, lead_id, msg, dados, causa_id };
  const r = db.prepare('INSERT INTO eventos (ts, agente, tipo, lead_id, msg, dados, causa_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ev.ts, agente, tipo, lead_id, msg, dados == null ? null : JSON.stringify(dados), causa_id);
  ev.id = Number(r.lastInsertRowid);
  barramento.emit('evento', ev);
  return ev;
}
