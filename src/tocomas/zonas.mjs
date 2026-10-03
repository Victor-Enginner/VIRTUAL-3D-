// Política de 3 zonas (B3; System One, arXiv 2609.33401): a Nova só age sozinha nos extremos da
// probabilidade; o meio é seu. Limiares do paper (10,5% / 89,5%) como ponto de partida.
//
// Só liga num nicho depois que a calibração dele (B10) mostrar que as probabilidades valem:
// com pouca amostra ou ECE alto, nada é automático — tudo continua passando por você.
// Mesmo na zona alta nada é enviado sem a sua aprovação (inviolável); "alta" só marca confiança.
import crypto from 'node:crypto';
import { metricas, MIN_AMOSTRA } from './calibracao.mjs';

export const LIMITES = { descartar_abaixo: 0.105, confiante_acima: 0.895, ece_max: 0.1 };
// Viés de seleção: o que a Nova descarta sozinha você nunca rotula, e a calibração da zona baixa
// pararia de ser medida. 1 em cada 10 da zona baixa vem para você mesmo assim (sorteio fixo pelo id,
// para o mesmo lead cair sempre do mesmo lado).
export const AMOSTRA_ZONA_BAIXA = 10;
export const naAmostra = (leadId) => crypto.createHash('sha1').update(String(leadId)).digest().readUInt32BE(0) % AMOSTRA_ZONA_BAIXA === 0;

// só as decisões recentes contam: as primeiras previsões (cabeça ainda sem dados, tudo perto de
// 50%) não podem segurar as zonas desligadas para sempre depois que a Nova aprendeu
export const JANELA_CALIBRACAO = 60;

// a Nova já pode decidir sozinha neste nicho?
export function prontidao(db, nicho) {
  const pares = db.prepare("SELECT p_cabeca, y FROM previsoes WHERE alvo = 'aprovacao' AND nicho IS ? ORDER BY id DESC LIMIT ?")
    .all(nicho ?? null, JANELA_CALIBRACAO).map((r) => [r.p_cabeca, r.y]);
  const m = metricas(pares);
  const pronta = m.n >= MIN_AMOSTRA && m.ece <= LIMITES.ece_max;
  return { nicho: nicho ?? null, pronta, n: m.n, ece: m.ece, faltam: Math.max(0, MIN_AMOSTRA - m.n) };
}

// zona de uma probabilidade de aprovação, dado o estado de calibração do nicho
export function zona(p, pr, leadId = null) {
  if (!pr.pronta) return { zona: 'sem_calibracao', p, n: pr.n, faltam: pr.faltam, ece: pr.ece };
  const z = p < LIMITES.descartar_abaixo ? 'baixa' : p > LIMITES.confiante_acima ? 'alta' : 'meio';
  if (z === 'baixa' && leadId != null && naAmostra(leadId)) return { zona: 'meio', amostra: true, p, n: pr.n, ece: pr.ece };
  return { zona: z, p, n: pr.n, ece: pr.ece };
}

// resumo para a Base do Mestre: cada nicho com leads, ligado ou quanto falta
export function resumoZonas(db) {
  return db.prepare('SELECT DISTINCT nicho FROM leads WHERE nicho IS NOT NULL').all().map((r) => prontidao(db, r.nicho));
}
