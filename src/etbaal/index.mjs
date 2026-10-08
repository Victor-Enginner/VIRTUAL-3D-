// Etbaal no sistema: grava a auditoria de cada lead e roda em fila, um site por vez (respeita limites da especificação).
import { auditar } from './auditoria.mjs';
import { carregarAgentes } from '../especificacao.mjs';
import { registrar } from '../eventos.mjs';
import { idSessaoAtiva } from '../sessoes.mjs';
import { classificarUrl } from '../regras.mjs';

export function especificacaoEtbaal() {
  const e = carregarAgentes().validos.find((a) => a.id === 'etbaal');
  if (!e) throw new Error('agentes/etbaal.json ausente ou inválido');
  return e;
}

export function salvarAuditoria(db, leadId, r) {
  db.prepare(`INSERT INTO seguranca (lead_id, auditado, motivo, host, nota, achados, em) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lead_id) DO UPDATE SET auditado = excluded.auditado, motivo = excluded.motivo, host = excluded.host, nota = excluded.nota, achados = excluded.achados, em = excluded.em`)
    .run(leadId, r.auditado ? 1 : 0, r.motivo || null, r.host || null, r.nota ?? null, JSON.stringify(r.achados || []), r.em || new Date().toISOString());
}

// leads da sessão ativa com site próprio ainda sem auditoria (a seleção é fato: classificarUrl)
// `todas`: ignora a sessão (auditoria é por empresa e não muda nada no funil)
export function pendentes(db, limite, todas = false) {
  return db.prepare(`SELECT l.id, l.nome, l.site, l.cidade FROM leads l LEFT JOIN seguranca s ON s.lead_id = l.id
    WHERE s.lead_id IS NULL AND l.site IS NOT NULL AND (? OR l.sessao_id IS ?) ORDER BY l.score IS NULL, l.score DESC`).all(todas ? 1 : 0, idSessaoAtiva(db))
    .filter((l) => classificarUrl(l.site) === 'site_proprio').slice(0, limite);
}

let rodando = false;
// audita até `limite` leads (teto diário da especificação), um por vez; devolve o que fez
export async function rodarLote(db, { limite = 10, dep, todas = false } = {}) {
  if (rodando) return { ja_rodando: true };
  rodando = true;
  const esp = especificacaoEtbaal();
  const feitos = [];
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const jaHoje = db.prepare("SELECT COUNT(*) n FROM seguranca WHERE substr(em, 1, 10) = ?").get(hoje).n;
    const fila = pendentes(db, Math.max(0, Math.min(limite, esp.permissoes.por_dia - jaHoje)), todas);
    for (const l of fila) {
      let r;
      try { r = await auditar(esp, l.site, dep); } catch (e) { r = { auditado: false, motivo: `falhou: ${e.message}`, achados: [] }; }
      if (r.transitorio) { feitos.push({ lead_id: l.id, nome: l.nome, ...r }); continue; } // falha passageira: não grava, volta para a fila
      salvarAuditoria(db, l.id, r);
      const altas = r.achados.filter((a) => a.severidade === 'alta').length;
      registrar(db, 'etbaal', 'auditoria', r.auditado ? `${l.nome}: nota ${r.nota}/100 · ${r.achados.length} achado(s), ${altas} grave(s)` : `${l.nome}: não auditado (${r.motivo})`, { lead_id: l.id });
      feitos.push({ lead_id: l.id, nome: l.nome, ...r });
    }
  } finally { rodando = false; }
  return { feitos };
}

export function resumo(db, todas = false) {
  const linhas = db.prepare(`SELECT s.*, l.nome, l.cidade, l.nicho FROM seguranca s JOIN leads l ON l.id = s.lead_id
    WHERE (? OR l.sessao_id IS ?) ORDER BY s.em DESC LIMIT 200`).all(todas ? 1 : 0, idSessaoAtiva(db)).map((r) => ({ ...r, achados: JSON.parse(r.achados || '[]') }));
  const aud = linhas.filter((r) => r.auditado);
  const conta = {};
  for (const r of aud) for (const a of r.achados) conta[a.id] = (conta[a.id] || 0) + 1;
  return {
    auditando: rodando, // o 2º andar usa: auditando → Etbaal no deck; parado → vendo a TV
    auditados: aud.length,
    nota_media: aud.length ? Math.round(aud.reduce((a, r) => a + r.nota, 0) / aud.length) : null,
    com_falha_grave: aud.filter((r) => r.achados.some((a) => a.severidade === 'alta')).length,
    mais_comuns: Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n })),
    pendentes: pendentes(db, 1000, todas).length,
    ultimas: linhas.slice(0, 30),
  };
}
