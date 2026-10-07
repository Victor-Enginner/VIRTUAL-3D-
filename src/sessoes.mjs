// Sessões de rastreamento: cada "rodada" de prospecção começa zerada na tela sem apagar a anterior.
// Todo lead nasce com o sessao_id da sessão ativa; as telas mostram só a ativa.
// Um negócio já encontrado numa sessão antiga NÃO volta como novo (evita abordar a mesma empresa duas vezes).
import { agora, lerFlag, salvarFlag } from './db.mjs';

export const sessaoAtiva = (db) => {
  const id = lerFlag(db, 'sessao_ativa', null);
  return (id && db.prepare('SELECT * FROM sessoes WHERE id = ?').get(id)) || db.prepare('SELECT * FROM sessoes ORDER BY id DESC LIMIT 1').get() || null;
};
export const idSessaoAtiva = (db) => sessaoAtiva(db)?.id ?? null;

export function listarSessoes(db) {
  const ativa = idSessaoAtiva(db);
  return db.prepare(`SELECT s.*, COUNT(l.id) leads,
      SUM(l.etapa IN ('aprovado', 'enviado', 'sem_resposta', 'respondeu', 'fechado', 'perdido')) aprovados,
      SUM(l.etapa = 'fechado') fechados
    FROM sessoes s LEFT JOIN leads l ON l.sessao_id = s.id GROUP BY s.id ORDER BY s.id DESC`).all()
    .map((s) => ({ ...s, aprovados: s.aprovados || 0, fechados: s.fechados || 0, ativa: s.id === ativa }));
}

export function novaSessaoDeRastreio(db, nome) {
  const n = db.prepare('SELECT COUNT(*) n FROM sessoes').get().n + 1;
  const t = agora();
  const anterior = idSessaoAtiva(db);
  if (anterior) db.prepare('UPDATE sessoes SET encerrada_em = COALESCE(encerrada_em, ?) WHERE id = ?').run(t, anterior);
  const r = db.prepare('INSERT INTO sessoes (nome, criada_em) VALUES (?, ?)').run(String(nome || '').trim().slice(0, 60) || `Sessão ${n}`, t);
  salvarFlag(db, 'sessao_ativa', Number(r.lastInsertRowid));
  return sessaoAtiva(db);
}

export function ativarSessao(db, id) {
  const s = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(Number(id));
  if (!s) return null;
  db.prepare('UPDATE sessoes SET encerrada_em = NULL WHERE id = ?').run(s.id);
  salvarFlag(db, 'sessao_ativa', s.id);
  return sessaoAtiva(db);
}
