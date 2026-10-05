// Comando falado ou digitado → ação. Igual ao Estúdio por Voz do Jev Showcase:
// o modelo de decisão escolhe a INTENÇÃO; o código só extrai literais (nicho, cidade, UF).
import { CONFIG } from './config.mjs';
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
      quentes: 'Perguntar quantos leads quentes (de alta prioridade) existem',
      aprovar_proximo: 'Aprovar o próximo cartão de mensagem da fila',
      descartar_proximo: 'Descartar o próximo cartão de mensagem da fila',
      cidade: 'Trocar a cidade das varreduras',
      outro: 'Outra coisa que não é nenhuma dessas',
    },
  },
};

// "trocar a cidade para Ribeirão Preto SP": a cidade vem depois de "para/pra/pro/em/:"
function cidadeDepoisDe(texto) {
  const m = texto.match(/(?:\bpara|\bpra|\bpro|\bem|:)\s+([A-Za-zÀ-ÿ' ]+?)(?:\s*[-,/]?\s*\b([A-Za-z]{2})\b)?\s*[.!?]*$/i);
  if (!m) return null;
  let cidade = m[1].trim(), uf = m[2]?.toUpperCase();
  if (uf && !UFS.includes(uf)) { cidade = `${cidade} ${m[2]}`; uf = null; }
  cidade = cidade.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && ['de', 'da', 'do', 'das', 'dos'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
  return { cidade, uf: uf || null };
}

export function extrairLiterais(texto, intencao = null) {
  if (intencao === 'cidade') return { nicho: null, fonte: 'maps', ...(cidadeDepoisDe(texto) || { cidade: null, uf: null }) };
  const t = sem(texto);
  // vale o termo mais ESPECÍFICO que casar: "hotel para pets" é Pet shop, não Hospedagem
  let nicho = null, melhor = 0;
  for (const [k, n] of Object.entries(NICHOS)) {
    const termos = [k.replace(/_/g, ' '), ...(n.termos || [n.maps]), ...n.rotulo.split(/\s*[&,]\s*/)].map(sem);
    for (const x of termos) {
      const base = x.replace(/s$/, '');
      if (x.length > 3 && t.includes(base) && base.length > melhor) { nicho = k; melhor = base.length; }
    }
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

// Fato é regra: os 5 comandos têm palavras inequívocas, então a regra decide primeiro (instantâneo, sem modelo).
// O LLM só entra em frase ambígua. Ordem importa: "pare de varrer" é pausar, não varrer; "Pará" (estado) não é "pare".
export function intencaoPorRegra(texto) {
  const t = sem(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(quantos|quantas|numero de|tem algum)\b.*\bquente/.test(t) || /\bleads? quentes?\b/.test(t)) return 'quentes';
  if (/\b(aprov\w*|manda\w* ver)\b.*\b(proxim\w*|cartao|mensagem|seguinte)\b|^aprov\w*$/.test(t)) return 'aprovar_proximo';
  if (/\b(descart\w*|joga\w* fora|recus\w*)\b.*\b(proxim\w*|cartao|mensagem|seguinte)\b|^descart\w*$/.test(t)) return 'descartar_proximo';
  if (/\b(troc\w*|mud\w*|alter\w*) (a |de )?cidade\b/.test(t)) return 'cidade';
  if (/\b(pare|parar|para|pausa|pausar|chega) de (varr|busc|procur|miner|trabalh)/.test(t)) return 'pausar';
  if (/\b(varr|busc|procur|miner|pesquis)\w*/.test(t)) return 'varrer';
  if (/\b(retoma\w*|continu\w*|volta\w*|religa\w*|liga\w*|reinicia\w*)\b/.test(t) && !/\bdesliga/.test(t)) return 'retomar';
  if (/\b(pausa\w*|pare|parar|desliga\w*|segura|congela\w*|chega)\b/.test(t)) return 'pausar';
  if (/\b(resum\w*|relatorio|status|placar|como (esta|foi|ta|vai)|o que (rolou|aconteceu)|novidades?)\b/.test(t)) return 'resumo';
  return null;
}

export async function interpretar(texto) {
  const porRegra = intencaoPorRegra(texto);
  if (porRegra) return { intencao: porRegra, confianca: 1, probabilidades: { [porRegra]: 1 }, origem: 'regra', ...extrairLiterais(texto, porRegra), latency_ms: 0 };
  if (!CONFIG.modelos.comando.modelo) return { intencao: 'outro', confianca: 0, probabilidades: {}, origem: 'sem_modelo', ...extrairLiterais(texto), latency_ms: 0 };
  let r;
  try { r = await decide({ state: { fala_da_pessoa: texto, contexto: 'transcrição de voz ou texto digitado no painel de prospecção' }, questions: PERGUNTA_INTENCAO, papel: 'comando' }); }
  catch { return { intencao: 'outro', confianca: 0, probabilidades: {}, origem: 'modelo_indisponivel', ...extrairLiterais(texto), latency_ms: 0 }; } // Ollama desligado: a frase ambígua vira "não entendi", sem erro 500
  return { origem: 'modelo', intencao: r.answers.intencao.choice, confianca: r.answers.intencao.confidence, probabilidades: r.answers.intencao.probabilities, ...extrairLiterais(texto), latency_ms: r.latency_ms };
}
