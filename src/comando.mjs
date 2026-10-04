// Comando falado ou digitado → ação. Igual ao Estúdio por Voz do Jev Showcase:
// o modelo de decisão escolhe a INTENÇÃO; o código só extrai literais (nicho, cidade, UF).
import { decide } from './decide/index.mjs';
import { NICHOS } from './nichos.mjs';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const PERGUNTA_INTENCAO = {
  intencao: {
    type: 'choice',
    instructions: 'O que a pessoa está pedindo para os agentes de prospecção fazerem?',
    criteria: {
      varrer: 'Buscar/varrer/procurar/minerar empresas de um ramo numa cidade',
      pausar: 'Pausar, parar ou desligar os agentes',
      retomar: 'Retomar, continuar ou ligar os agentes',
      resumo: 'Pedir um resumo, relatório ou como está o dia',
      outro: 'Outra coisa que não é nenhuma dessas',
    },
  },
};

export function extrairLiterais(texto) {
  const t = sem(texto);
  let nicho = null;
  for (const [k, n] of Object.entries(NICHOS)) {
    const termos = [k.replace('_', ' '), sem(n.maps), ...sem(n.rotulo).split(/\s*[&,]\s*/)];
    if (termos.some((x) => x.length > 3 && t.includes(x.replace(/s$/, '')))) { nicho = k; break; }
  }
  const m = texto.match(/\bem\s+([A-Za-zÀ-ÿ' ]+?)(?:\s*[-,/]?\s*\b([A-Za-z]{2})\b)?\s*[.!?]*$/);
  let cidade = m?.[1]?.trim() || null;
  let uf = m?.[2]?.toUpperCase();
  if (uf && !UFS.includes(uf)) { cidade = `${cidade} ${m[2]}`; uf = null; }
  if (cidade) {
    cidade = cidade.toLowerCase().split(/\s+/)
      .map((p, i) => (i > 0 && ['de', 'da', 'do', 'das', 'dos'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
  }
  const fonte = /openstreet|\bosm\b/.test(t) ? 'osm' : 'maps';
  return { nicho, cidade, uf: uf || null, fonte };
}

export async function interpretar(texto) {
  const r = await decide({ state: { fala_da_pessoa: texto, contexto: 'transcrição de voz ou texto digitado no painel de prospecção' }, questions: PERGUNTA_INTENCAO, papel: 'comando' });
  return { intencao: r.answers.intencao.choice, confianca: r.answers.intencao.confidence, probabilidades: r.answers.intencao.probabilities, ...extrairLiterais(texto), latency_ms: r.latency_ms };
}
