// Motor de decisão com a mesma interface do Jev (TypeSafe):
//   decide({ state, questions }) → { answers, backend, model, latency_ms }
//   questions = { id: { type: 'choice' | 'score' | 'noul', instructions, criteria } }
//     choice: criteria = { chave: 'descrição', ... }  (2 a 9 opções)
//     score:  criteria = ['nível mais baixo', ..., 'nível mais alto'] (2 a 9 níveis)
//     noul:   criteria = { true: '...', false: '...' }
//
// Backend "local" (padrão, open source): lê a distribuição do próximo token de um
// modelo aberto no Ollama sobre os identificadores [1]..[n] — o método do LLM2Jev
// (arXiv 2610.02076). Nenhum texto é gerado; a resposta são probabilidades.
// Backend "jev" (opcional, pago): o Jev real pelo endpoint de decisões do OpenRouter.

import { CONFIG } from '../config.mjs';

const MAX_OPCOES = 9; // um dígito = um token; acima disso a leitura deixaria de ser de um token só

export function validarPerguntas(questions) {
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) return 'questions deve ser um objeto';
  const ids = Object.keys(questions);
  if (!ids.length) return 'questions vazio';
  for (const id of ids) {
    const q = questions[id];
    if (!q || !['choice', 'score', 'noul'].includes(q.type)) return `${id}: type deve ser choice|score|noul`;
    if (typeof q.instructions !== 'string' || !q.instructions.trim()) return `${id}: instructions obrigatório`;
    const n = opcoes(q).length;
    if (n < 2 || n > MAX_OPCOES) return `${id}: precisa de 2 a ${MAX_OPCOES} opções`;
  }
  return null;
}

// Lista ordenada [chave, descrição] para qualquer tipo de pergunta.
export function opcoes(q) {
  if (q.type === 'score') return Array.isArray(q.criteria) ? q.criteria.map((d, i) => [String(i), d]) : [];
  if (q.type === 'noul') {
    const c = q.criteria || {};
    return [['true', c.true || 'Sim'], ['false', c.false || 'Não']];
  }
  return q.criteria && typeof q.criteria === 'object' ? Object.entries(q.criteria) : [];
}

// top_logprobs do primeiro token → probabilidades normalizadas sobre as n opções.
// `cobertura` = massa de probabilidade que caiu em algum identificador válido; baixa
// cobertura significa que o modelo queria responder outra coisa (decisão pouco confiável).
export function lerProbabilidades(topLogprobs, n) {
  const massa = new Array(n).fill(0);
  for (const t of topLogprobs || []) {
    const tok = String(t.token).trim();
    if (!/^[1-9]$/.test(tok)) continue;
    const i = Number(tok) - 1;
    if (i < n) massa[i] += Math.exp(t.logprob);
  }
  const total = massa.reduce((a, b) => a + b, 0);
  if (total <= 0) return { probs: new Array(n).fill(1 / n), cobertura: 0 };
  return { probs: massa.map((m) => m / total), cobertura: Math.min(1, total) };
}

export function montarResposta(q, probs, cobertura) {
  const ops = opcoes(q);
  const probabilities = Object.fromEntries(ops.map(([k], i) => [k, +probs[i].toFixed(4)]));
  const melhor = probs.indexOf(Math.max(...probs));
  const base = { type: q.type, probabilities, confidence: +probs[melhor].toFixed(4), coverage: +cobertura.toFixed(4) };
  if (q.type === 'noul') return { ...base, noul: +probs[0].toFixed(4) };
  if (q.type === 'score') {
    // valor esperado do nível, de 0 (primeiro) a 1 (último)
    const esperado = probs.reduce((acc, p, i) => acc + p * i, 0) / (probs.length - 1);
    return { ...base, score: +esperado.toFixed(4), level: melhor };
  }
  return { ...base, choice: ops[melhor][0] };
}

// Cada família de modelo tem seu formato de conversa. Em modo raw o prompt termina onde a resposta começa ("[").
// qwen3 e chatml foram testados; llama3 e gemma seguem o formato oficial mas ainda NÃO foram testados aqui.
export const TEMPLATES = {
  qwen3: (sys, user) => `<|im_start|>system\n${sys}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n[`,
  chatml: (sys, user) => `<|im_start|>system\n${sys}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n[`,
  llama3: (sys, user) => `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${sys}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n[`,
  gemma: (sys, user) => `<bos><start_of_turn>user\n${sys}\n\n${user}<end_of_turn>\n<start_of_turn>model\n[`,
};

export function promptLocal(state, q, ordem, template) {
  const ops = ordem.map(([, d], i) => `[${i + 1}] ${d}`).join('\n');
  const user = `ESTADO (dados do momento, em JSON):\n${JSON.stringify(state, null, 1)}\n\nPERGUNTA: ${q.instructions}\n\nOPÇÕES:\n${ops}\n\nResponda apenas com o número da opção.`;
  const sys = 'Você é um modelo de decisão. Leia o estado com atenção e escolha a opção correta. Use somente o que está no estado.';
  const montar = TEMPLATES[template];
  if (!montar) throw new Error(`template "${template}" desconhecido (use: ${Object.keys(TEMPLATES).join(', ')})`);
  return montar(sys, user);
}

async function lerUmaOrdem(state, q, ordem, perfil) {
  const r = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: perfil.modelo, raw: true, stream: false,
      prompt: promptLocal(state, q, ordem, perfil.template),
      options: { num_predict: 1, temperature: 0 },
      logprobs: true, top_logprobs: 20,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Ollama: ${j.error || r.status}`);
  const top = j.logprobs?.[0]?.top_logprobs;
  if (!top) throw new Error('Ollama não devolveu logprobs (versão antiga?)');
  return lerProbabilidades(top, ordem.length);
}

// Rotação cíclica das opções (ideia do nível L0 do AnyJev, arXiv 2610.00831): a mesma pergunta
// é feita com as opções em cada ordem cíclica; a probabilidade de cada posição volta para a
// opção original e as leituras são combinadas. O viés de posição do modelo se cancela.
// O AnyJev também divide o prior de rótulo e calibra temperatura — isso não está implementado aqui.
export function combinarRotacoes(leituras, n) {
  const acc = new Array(n).fill(0);
  let cobertura = 0;
  for (const { rot, probs, cobertura: c } of leituras) {
    probs.forEach((p, i) => { acc[(i + rot) % n] += p; });
    cobertura += c;
  }
  const total = acc.reduce((a, b) => a + b, 0) || 1;
  return { probs: acc.map((x) => x / total), cobertura: cobertura / leituras.length };
}

async function perguntarLocal(state, q, perfil) {
  const ops = opcoes(q);
  const n = ops.length;
  const leituras = [];
  for (let rot = 0; rot < n; rot++) {
    const ordem = ops.map((_, i) => ops[(i + rot) % n]);
    leituras.push({ rot, ...(await lerUmaOrdem(state, q, ordem, perfil)) });
  }
  const { probs, cobertura } = combinarRotacoes(leituras, n);
  return { ...montarResposta(q, probs, cobertura), rotations: n };
}

async function decidirJev(state, questions) {
  if (!CONFIG.openrouterKey) throw new Error('DECIDE_BACKEND=jev exige OPENROUTER_API_KEY');
  // mesmo endpoint e formato do gateway do Jev Showcase (gateway/server.mjs)
  const r = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST', signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${CONFIG.openrouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'typesafe/jev-1.13', state, questions }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.answers) throw new Error(`Jev: ${j?.error?.message || r.status}`);
  return j.answers;
}

// `papel` escolhe o modelo em modelos.json: decisao (Nova, padrão) ou comando (Alva). `perfil` força um modelo (bancada).
async function decidirSemMedir({ state, questions, papel = 'decisao', perfil = null }) {
  const erro = validarPerguntas(questions);
  if (erro) throw new Error(erro);
  perfil = perfil || CONFIG.modelos[papel];
  if (CONFIG.decideBackend !== 'jev' && !perfil?.modelo) throw new Error(`o LLM do papel "${papel}" está desligado em modelos.json`);
  const t0 = performance.now();
  let answers;
  if (CONFIG.decideBackend === 'jev') {
    answers = await decidirJev(state, questions);
  } else {
    answers = {};
    // o Ollama atende uma requisição por vez neste hardware; sequencial evita fila escondida
    for (const [id, q] of Object.entries(questions)) answers[id] = await perguntarLocal(state, q, perfil);
  }
  return {
    answers,
    backend: CONFIG.decideBackend === 'jev' ? 'jev' : 'local',
    model: CONFIG.decideBackend === 'jev' ? 'typesafe/jev-1.13' : perfil.modelo,
    latency_ms: Math.round(performance.now() - t0),
  };
}

// B14 (gateway do JEV Showcase): custo e latência por papel/modelo, em memória (zera ao reiniciar). /api/decide/stats
const medidas = new Map();
const JANELA = 200;
export function estatisticasDecide() {
  return [...medidas].map(([chave, m]) => {
    const l = [...m.latencias].sort((a, b) => a - b);
    return { chave, chamadas: m.chamadas, erros: m.erros, p50_ms: l.length ? l[Math.floor((l.length - 1) / 2)] : null, p95_ms: l.length ? l[Math.floor((l.length - 1) * 0.95)] : null, max_ms: l.length ? l.at(-1) : null, ultima_em: m.ultima_em, ultimo_erro: m.ultimo_erro };
  });
}
export const zerarEstatisticasDecide = () => medidas.clear();

export async function decide(args) {
  const papel = args.papel || 'decisao';
  const chave = `${papel}:${args.perfil?.modelo || CONFIG.modelos[papel]?.modelo || CONFIG.decideBackend}`;
  const m = medidas.get(chave) || { chamadas: 0, erros: 0, latencias: [], ultima_em: null, ultimo_erro: null };
  medidas.set(chave, m);
  m.chamadas += 1; m.ultima_em = new Date().toISOString();
  const t0 = performance.now();
  try { return await decidirSemMedir(args); }
  catch (e) { m.erros += 1; m.ultimo_erro = String(e.message).slice(0, 120); throw e; }
  finally { m.latencias.push(Math.round(performance.now() - t0)); if (m.latencias.length > JANELA) m.latencias.shift(); }
}
