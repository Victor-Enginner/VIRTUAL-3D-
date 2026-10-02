// Aprendizado contínuo dos agentes, sem LLM: regressão logística online (SGD com L2).
//
// Cada lead vira um vetor x de características medidas (situação do site, nota, avaliações,
// tipo de telefone, sinais de atraso, ramo, ângulo). Duas "cabeças" lineares aprendem com o uso:
//
//   aprovacao  P(você aprova a mensagem)   ← cada "Aprovar" (1) e "Descartar" (0) seu
//   resposta   P(o negócio responde)       ← resposta no WhatsApp (1), SAIR (0, peso 1,5),
//                                            72 h sem resposta (0)
//
//   p = σ(w · x)      atualização:  w ← w − η · (gᵢ · (p − y) · x + λ · w)
//
// A prioridade final mistura a regra com as cabeças, e o peso de cada cabeça cresce com o
// número de exemplos vistos (α = min(0,3; n/60)): sem dados, só a regra manda.

import { NICHOS } from './nichos.mjs';
import { SITUACOES } from './regras.mjs';
import { json, parse } from './db.mjs';

const SIT = Object.keys(SITUACOES);
const RAMOS = Object.keys(NICHOS);
const ANGULOS = ['ser_encontrado', 'modernizar', 'independencia', 'reputacao', 'recuperar'];

export const NOMES = [
  'viés',
  ...SIT.map((s) => `situação: ${SITUACOES[s]}`),
  'nota no Google (centrada em 4)',
  'nota ausente',
  'log(avaliações)',
  'avaliações ausentes',
  'telefone celular',
  'sinais de atraso',
  ...RAMOS.map((r) => `ramo: ${NICHOS[r].rotulo}`),
  ...ANGULOS.map((a) => `ângulo: ${a}`),
];
export const DIM = NOMES.length;

export function caracteristicas(lead) {
  const x = new Float64Array(DIM);
  let i = 0;
  x[i++] = 1;
  for (const s of SIT) x[i++] = lead.situacao_site === s ? 1 : 0;
  x[i++] = lead.rating == null ? 0 : lead.rating - 4;
  x[i++] = lead.rating == null ? 1 : 0;
  x[i++] = lead.avaliacoes == null ? 0 : Math.log1p(lead.avaliacoes) / 7;
  x[i++] = lead.avaliacoes == null ? 1 : 0;
  x[i++] = lead.telefone_tipo === 'celular' ? 1 : 0;
  x[i++] = Math.min((parse(lead.auditoria)?.sinais?.length || 0) / 4, 1);
  for (const r of RAMOS) x[i++] = lead.nicho === r ? 1 : 0;
  const angulo = parse(lead.decisao)?.answers?.abordagem?.choice;
  for (const a of ANGULOS) x[i++] = angulo === a ? 1 : 0;
  return x;
}

const sigmoide = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
const dot = (w, x) => { let s = 0; for (let i = 0; i < x.length; i++) s += w[i] * x[i]; return s; };

export function novaCabeca() { return { w: new Array(DIM).fill(0), n: 0, positivos: 0 }; }

export function prever(cabeca, x) { return sigmoide(dot(cabeca.w, x)); }

// Um passo de SGD. η decai com n para estabilizar quando já há histórico.
export function treinarPasso(cabeca, x, y, peso = 1, { eta0 = 0.5, lambda = 0.01 } = {}) {
  const p = prever(cabeca, x);
  const eta = eta0 / Math.sqrt(1 + cabeca.n / 10);
  const g = peso * (p - y);
  for (let i = 0; i < x.length; i++) cabeca.w[i] -= eta * (g * x[i] + (i === 0 ? 0 : lambda * cabeca.w[i]));
  cabeca.n += 1;
  if (y === 1) cabeca.positivos += 1;
  return p;
}

// Quais características mais empurraram esta previsão (wᵢ·xᵢ), para mostrar na tela.
export function contribuicoes(cabeca, x, k = 4) {
  return [...x].map((xi, i) => ({ nome: NOMES[i], valor: cabeca.w[i] * xi }))
    .filter((c, i) => i > 0 && c.valor !== 0)
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).slice(0, k)
    .map((c) => ({ ...c, valor: +c.valor.toFixed(3) }));
}

export const alfa = (cabeca) => Math.min(0.3, cabeca.n / 60);

export function misturar(regra, cabecas, x) {
  const a = alfa(cabecas.aprovacao), r = alfa(cabecas.resposta);
  const pa = prever(cabecas.aprovacao, x), pr = prever(cabecas.resposta, x);
  const score = Math.round((1 - a - r) * regra + a * 100 * pa + r * 100 * pr);
  return { score, regra, p_aprovacao: +pa.toFixed(3), p_resposta: +pr.toFixed(3), alfa_aprovacao: +a.toFixed(3), alfa_resposta: +r.toFixed(3) };
}

// ---------------- persistência (tabela config) ----------------

export function lerCabecas(db) {
  const salvo = parse(db.prepare("SELECT v FROM config WHERE k = 'aprendizado'").get()?.v, {});
  const ok = (c) => c && Array.isArray(c.w) && c.w.length === DIM;
  // se o vetor de características mudou de tamanho, o modelo antigo não serve: recomeça
  return { aprovacao: ok(salvo.aprovacao) ? salvo.aprovacao : novaCabeca(), resposta: ok(salvo.resposta) ? salvo.resposta : novaCabeca() };
}

function salvarCabecas(db, cabecas) {
  db.prepare("INSERT INTO config (k, v) VALUES ('aprendizado', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(json(cabecas));
}

// Treina, salva e recalcula a prioridade dos leads ainda em aberto (é só um produto interno por lead).
export function aprender(db, qual, lead, y, peso = 1) {
  const cabecas = lerCabecas(db);
  const p = treinarPasso(cabecas[qual], caracteristicas(lead), y, peso);
  salvarCabecas(db, cabecas);
  recalcularAbertos(db, cabecas);
  return { p_antes: +p.toFixed(3), n: cabecas[qual].n };
}

export function recalcularAbertos(db, cabecas = lerCabecas(db)) {
  const abertos = db.prepare("SELECT * FROM leads WHERE etapa IN ('qualificado', 'mensagem', 'sem_contato') AND decisao IS NOT NULL").all();
  const upd = db.prepare('UPDATE leads SET score = ?, decisao = ? WHERE id = ?');
  for (const l of abertos) {
    const d = parse(l.decisao, {});
    if (d.score_regra == null) continue;
    const x = caracteristicas(l);
    const m = misturar(d.score_regra, cabecas, x);
    d.aprendizado = { ...m, contribuicoes: contribuicoes(cabecas.aprovacao, x) };
    upd.run(m.score, json(d), l.id);
  }
}

export function resumoAprendizado(db) {
  const cabecas = lerCabecas(db);
  const top = (c) => c.w.map((w, i) => ({ nome: NOMES[i], peso: +w.toFixed(3) })).filter((p, i) => i > 0 && p.peso !== 0)
    .sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso)).slice(0, 8);
  return Object.fromEntries(Object.entries(cabecas).map(([k, c]) => [k, { exemplos: c.n, positivos: c.positivos, alfa: alfa(c), pesos: top(c) }]));
}
