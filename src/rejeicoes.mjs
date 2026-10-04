// B13 (2609.31937): toda recusa de texto fica registrada por COMPONENTE e CAUSA, para a Base do Mestre mostrar
// por que a Maia cai no texto fixo em vez de só contar quantas vezes caiu.
import { agora } from './db.mjs';

const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
// código estável a partir da frase do problema: "não cita o nome do negócio" → nao_cita_o_nome_do_negocio
export const codigoDaCausa = (frase) => sem(frase).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'desconhecida';

export function registrarRejeicoes(db, lead, componente, problemas) {
  const ins = db.prepare('INSERT INTO rejeicoes (lead_id, componente, causa, detalhe, nicho, em) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of problemas) ins.run(lead.id, componente, codigoDaCausa(p), String(p).slice(0, 200), lead.nicho ?? null, agora());
  return problemas.length;
}

// recusas por causa, mais frequentes primeiro, e quantos textos distintos foram afetados
export function resumoRejeicoes(db) {
  const causas = db.prepare('SELECT componente, causa, COUNT(*) n, MIN(detalhe) exemplo FROM rejeicoes GROUP BY componente, causa ORDER BY n DESC, causa').all().map((r) => ({ ...r }));
  const textos = db.prepare('SELECT COUNT(DISTINCT lead_id) n FROM rejeicoes').get().n;
  const escritos = db.prepare("SELECT COUNT(*) n FROM leads WHERE mensagem_origem IN ('modelo', 'modelo_recusado')").get().n;
  return { textos_recusados: textos, textos_escritos: escritos, causas };
}
