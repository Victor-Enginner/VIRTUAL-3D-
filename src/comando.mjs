// Comando falado ou digitado → ação. Igual ao Estúdio por Voz do Jev Showcase:
// o modelo de decisão escolhe a INTENÇÃO; o código só extrai literais (nicho, cidade, UF).
import { CONFIG } from './config.mjs';
import { decide } from './decide/index.mjs';
import { NICHOS } from './nichos.mjs';
import { ESTADOS } from './localidades.mjs';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// O motor lê a probabilidade do PRÓXIMO TOKEN sobre os rótulos 1..9 (LLM2Jev, arXiv 2610.02076): no máximo 9 opções.
// Com 10 intenções a pergunta estourava o limite e o erro era engolido ("não entendi" para toda frase ambígua).
// Solução: decisão HIERÁRQUICA — primeiro o grupo, depois a intenção dentro dele. P(intenção) = P(grupo) × P(intenção | grupo).
// Escala para o chatbot: grupo ou intenção nova cabe sem mexer no motor.
export const GRUPOS_INTENCAO = {
  buscar: { descricao: 'Buscar empresas: varrer um ramo numa cidade, pedir mais um lote da busca atual ou trocar a cidade', intencoes: ['varrer', 'mais_leads', 'cidade'] },
  controle: { descricao: 'Ligar/retomar ou pausar/parar a equipe de agentes', intencoes: ['pausar', 'retomar'] },
  fila: { descricao: 'Aprovar ou descartar o próximo cartão de mensagem da fila', intencoes: ['aprovar_proximo', 'descartar_proximo'] },
  consulta: { descricao: 'Perguntar como está o dia (resumo) ou quantos leads quentes existem', intencoes: ['resumo', 'quentes'] },
  outro: { descricao: 'Outra coisa que não tem a ver com a prospecção', intencoes: ['outro'] },
};
// catálogo das descrições de cada intenção (o motor recebe só o pedaço de cada etapa)
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
      mais_leads: 'Buscar mais empresas (o próximo lote) na busca que já está em andamento, sem trocar cidade nem ramo',
      outro: 'Outra coisa que não é nenhuma dessas',
    },
  },
};

// "Lisboa Portugal", "Asunción no Paraguai": o país dito junto da cidade sai dela e vira `pais`
const PAIS_POR_PALAVRA = { portugal: 'PT', paraguai: 'PY', paraguay: 'PY', brasil: 'BR' };
export function separarPais(cidade) {
  if (!cidade) return { cidade, pais: null };
  const m = cidade.match(/\s+(?:no |na |em |de |do )?(portugal|paraguai|paraguay|brasil)$/i);
  return m ? { cidade: cidade.slice(0, m.index).trim(), pais: PAIS_POR_PALAVRA[m[1].toLowerCase()] } : { cidade, pais: null };
}

// Fala real termina com enfeite ("pra mim", "por favor", "aí") e diz o estado por extenso ("Campinas São Paulo").
const ENFEITES = /(?:\s+(?:pra mim|para mim|por favor|ai|aí|agora|hoje|ok|beleza|valeu))+\s*[.!?]*$/i;
const ESTADO_POR_NOME = ESTADOS.map((e) => ({ sigla: e.sigla, nome: sem(e.nome) })).sort((a, b) => b.nome.length - a.nome.length);
const titulo = (c) => c.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && ['de', 'da', 'do', 'das', 'dos'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
const MARCADORES_LUGAR = ['na cidade de', 'no municipio de', 'no município de', 'em', 'por'];

// O lugar fica no FIM da frase, depois do ÚLTIMO marcador: "hotel para pets em Campinas" → "Campinas".
function cidadeDoFim(texto, marcadores = MARCADORES_LUGAR) {
  const limpo = texto.replace(ENFEITES, '').replace(/[.!?]+$/, '').trim();
  const alternativas = marcadores.map((m) => m.replace(/ /g, '\\s+')).join('|');
  const re = new RegExp(`(?:^|\\s)(?:${alternativas})\\s+([A-Za-zÀ-ÿ' ,/-]+)$`, 'i');
  let m = limpo.match(re);
  while (m) { const dentro = m[1].match(re); if (!dentro) break; m = dentro; }
  if (!m) return { cidade: null, uf: null };
  let lugar = m[1].replace(/^(?:a|o)\s+/i, '').replace(/[,/-]+/g, ' ').replace(/\s+/g, ' ').trim(), uf = null;
  const sigla = lugar.match(/\s([A-Za-z]{2})$/);
  if (sigla && UFS.includes(sigla[1].toUpperCase())) { uf = sigla[1].toUpperCase(); lugar = lugar.slice(0, sigla.index).trim(); }
  else {
    const s = sem(lugar);
    const est = ESTADO_POR_NOME.find((e) => s.endsWith(` ${e.nome}`));
    if (est) { uf = est.sigla; lugar = lugar.slice(0, lugar.length - est.nome.length).trim(); }
  }
  return lugar ? { cidade: titulo(lugar), uf } : { cidade: null, uf: null };
}

// "trocar a cidade para Ribeirão Preto SP": a cidade vem depois de "para/pra/pro/em/:"
function cidadeDepoisDe(texto) {
  const c = cidadeDoFim(texto.replace(/:/g, ' para '), ['para', 'pra', 'pro', 'em']);
  return c.cidade ? c : null;
}

export function extrairLiterais(texto, intencao = null) {
  if (intencao === 'cidade') { const c = cidadeDepoisDe(texto) || { cidade: null, uf: null }; const sp = separarPais(c.cidade); return { nicho: null, fonte: 'maps', ...c, cidade: sp.cidade, pais: sp.pais }; }
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
  const { cidade, uf } = cidadeDoFim(texto);
  const fonte = /openstreet|\bosm\b/.test(t) ? 'osm' : 'maps';
  const sp = separarPais(cidade);
  return { nicho, cidade: sp.cidade, uf: uf || null, fonte, pais: sp.pais };
}

// Fato é regra: os 5 comandos têm palavras inequívocas, então a regra decide primeiro (instantâneo, sem modelo).
// O LLM só entra em frase ambígua. Ordem importa: "pare de varrer" é pausar, não varrer; "Pará" (estado) não é "pare".
export function intencaoPorRegra(texto) {
  const t = sem(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // "busca mais 50", "próximo lote": continua a busca atual. Se a frase traz cidade ("em Franca"), é uma varredura normal.
  if (/\b(mais|proximo lote|outro lote)\b/.test(t) && /\b(busc|varr|procur|traz|pega|lote)/.test(t) && !/\bem [a-z]/.test(t)) return 'mais_leads';
  if (/\b(quantos|quantas|numero de|tem algum)\b.*\bquente/.test(t) || /\bleads? quentes?\b/.test(t)) return 'quentes';
  if (/\b(aprov\w*|manda\w* ver)\b.*\b(proxim\w*|cartao|mensagem|seguinte)\b|^aprov\w*$/.test(t)) return 'aprovar_proximo';
  if (/\b(descart\w*|joga\w* fora|recus\w*)\b.*\b(proxim\w*|cartao|mensagem|seguinte)\b|^descart\w*$/.test(t)) return 'descartar_proximo';
  if (/\b(troc\w*|mud\w*|alter\w*) (a |de )?cidade\b/.test(t)) return 'cidade';
  if (/\b(pare|parar|para|pausa|pausar|chega) de (varr|busc|procur|miner|trabalh)/.test(t) || /\bpara tudo\b/.test(t)) return 'pausar';
  if (/\b(varr|vare|busc|procur|miner|pesquis|vasculh)\w*/.test(t)) return 'varrer';
  // "liga" sozinho é ambíguo ("liga a luz"): só conta quando fala dos agentes/equipe
  if ((/\b(retoma\w*|continu\w*|volta\w*|religa\w*|reinicia\w*|bora)\b/.test(t) || /\bliga\w* (os |a )?(agentes|equipe|tudo|time)\b/.test(t)) && !/\bdesliga/.test(t)) return 'retomar';
  if (/\b(pausa\w*|pare|parar|desliga\w*|segura|congela\w*|chega)\b/.test(t)) return 'pausar';
  if (/\b(resum\w*|relatorio|status|placar|como (esta|foi|ta|vai)|o que (rolou|aconteceu)|novidades?)\b/.test(t)) return 'resumo';
  return null;
}

const DESCRICAO = PERGUNTA_INTENCAO.intencao.criteria;
// Predição seletiva (arXiv 2607.03528, 2603.21172): abaixo do limiar o sistema NÃO executa e pergunta.
// 0,5 medido em test/fixtures/comandos-reais.json: os erros do 1.7B vieram com 0,30–0,34; acertos ≥ 0,59.
export const LIMIAR_COMANDO = 0.5;
// frase curta para "você quis dizer…?" quando o sistema se abstém
export const SUGESTAO = { varrer: 'varrer um ramo numa cidade', mais_leads: 'buscar mais um lote', cidade: 'trocar a cidade', pausar: 'pausar os agentes', retomar: 'retomar os agentes', resumo: 'ver o resumo do dia', quentes: 'ver os leads quentes', aprovar_proximo: 'aprovar o próximo cartão', descartar_proximo: 'descartar o próximo cartão' };
const perguntaGrupo = () => ({ grupo: { type: 'choice', instructions: 'Que tipo de pedido a pessoa está fazendo para os agentes de prospecção?', criteria: Object.fromEntries(Object.entries(GRUPOS_INTENCAO).map(([k, g]) => [k, g.descricao])) } });
const perguntaDentro = (g) => ({ intencao: { type: 'choice', instructions: 'Qual destes pedidos exatamente?', criteria: Object.fromEntries(GRUPOS_INTENCAO[g].intencoes.map((i) => [i, DESCRICAO[i]])) } });

// Os literais também são fato: ramo + cidade reconhecidos na frase é pedido de busca ("acha uns dentistas em Franca").
function intencaoPorLiterais(texto) {
  const l = extrairLiterais(texto);
  return l.nicho && l.cidade ? 'varrer' : null;
}

export async function interpretar(texto) {
  const porRegra = intencaoPorRegra(texto) || intencaoPorLiterais(texto);
  if (porRegra) return { intencao: porRegra, confianca: 1, probabilidades: { [porRegra]: 1 }, origem: 'regra', ...extrairLiterais(texto, porRegra), latency_ms: 0 };
  if (!CONFIG.modelos.comando.modelo) return { intencao: 'outro', confianca: 0, probabilidades: {}, origem: 'sem_modelo', ...extrairLiterais(texto), latency_ms: 0 };
  const state = { fala_da_pessoa: texto, contexto: 'transcrição de voz ou texto digitado no painel de prospecção' };
  let ms = 0, g, dentro;
  try {
    const r1 = await decide({ state, questions: perguntaGrupo(), papel: 'comando' });
    ms += r1.latency_ms; g = r1.answers.grupo;
    const opcoes = GRUPOS_INTENCAO[g.choice].intencoes;
    if (opcoes.length > 1) {
      const r2 = await decide({ state, questions: perguntaDentro(g.choice), papel: 'comando' });
      ms += r2.latency_ms; dentro = r2.answers.intencao;
    } else dentro = { choice: opcoes[0], confidence: 1, probabilities: { [opcoes[0]]: 1 } };
  } catch (e) {
    // Ollama fora do ar: "não entendi", sem erro 500. O motivo agora aparece (antes era engolido e escondeu um bug).
    console.error('comando: o LLM falhou:', e.message);
    return { intencao: 'outro', confianca: 0, probabilidades: {}, origem: 'modelo_indisponivel', erro: e.message, ...extrairLiterais(texto), latency_ms: ms };
  }
  const pg = g.probabilities[g.choice];
  const probabilidades = Object.fromEntries(Object.entries(dentro.probabilities).map(([k, p]) => [k, p * pg]));
  return { origem: 'modelo', grupo: g.choice, intencao: dentro.choice, confianca: g.confidence * dentro.confidence, probabilidades, ...extrairLiterais(texto, dentro.choice), latency_ms: ms };
}
