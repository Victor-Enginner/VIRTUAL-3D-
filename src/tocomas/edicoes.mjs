// Edições do operador (dado de treino futuro). Quando você muda o texto que a Maia escreveu, o original era
// sobrescrito e se perdia. O par "original da Maia × versão sua" é exatamente o sinal que a literatura usa para
// ensinar um modelo a escrever do seu jeito (arXiv 2601.19055, aprender com edições do usuário; 2610.00061,
// preferência personalizada). Guardar custa quase nada e NÃO dá para recuperar depois.
// Um par por lead: o original fica o da primeira versão da Maia; a edição acompanha a sua última versão.
import { agora } from '../db.mjs';

export const igual = (a, b) => String(a ?? '').trim().replace(/\s+/g, ' ') === String(b ?? '').trim().replace(/\s+/g, ' ');

// `lead` é o lead ANTES da troca de texto (lead.mensagem ainda é a versão anterior).
export function registrarEdicao(db, lead, novoTexto) {
  const antes = lead?.mensagem;
  if (!lead || !antes || !novoTexto) return null;
  const jaTem = db.prepare('SELECT original FROM edicoes WHERE lead_id = ?').get(lead.id);
  const original = jaTem ? jaTem.original : antes;
  if (igual(original, novoTexto)) { // voltou ao texto da Maia: não há mais edição
    if (jaTem) db.prepare('DELETE FROM edicoes WHERE lead_id = ?').run(lead.id);
    return null;
  }
  if (!jaTem && igual(antes, novoTexto)) return null;
  const angulo = (() => { try { return JSON.parse(lead.decisao)?.answers?.abordagem?.choice ?? null; } catch { return null; } })();
  db.prepare(`INSERT INTO edicoes (lead_id, original, editado, origem_original, nicho, angulo, em) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lead_id) DO UPDATE SET editado = excluded.editado, em = excluded.em`)
    .run(lead.id, original, novoTexto, jaTem ? null : (lead.mensagem_origem ?? null), lead.nicho ?? null, angulo, agora());
  return { original, editado: novoTexto };
}

export const contarEdicoes = (db) => db.prepare('SELECT COUNT(*) n FROM edicoes').get().n;
