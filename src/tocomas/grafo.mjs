// Grafo de tarefas do Prospector (TOCOMAS, arXiv 2609.37953): o grafo define de uma vez quem é
// dono de cada nó, quais ferramentas pode usar, com quem passa trabalho e que memória enxerga.
import { parse } from '../db.mjs';

export const NOS = {
  T1_varrer: { dominio: 'coleta', dono: 'atlas', job: 'varrer', ferramentas: ['coletor_maps', 'overpass'] },
  T2_auditar: { dominio: 'coleta', dono: 'atlas', job: 'auditar', ferramentas: ['buscar_seguro'] },
  T3_qualificar: { dominio: 'juizo', dono: 'nova', job: 'qualificar', ferramentas: ['regras', 'decide'] },
  T4_redigir: { dominio: 'escrita', dono: 'maia', job: 'redigir', ferramentas: ['gerar_texto', 'checar_contradicao', 'texto_fixo'] },
  T5_aprovar: { dominio: 'decisao_humana', dono: 'operador', job: null, ferramentas: [] },
  T6_despachar: { dominio: 'envio', dono: 'leo', job: 'despachar', ferramentas: ['openwa'] },
  T7_acompanhar: { dominio: 'envio', dono: 'leo', job: null, ferramentas: ['webhook'] },
  T8_aprender: { dominio: 'juizo', dono: 'nova', job: null, ferramentas: ['aprendizado'] },
};

// só existe handoff onde há dependência entre tarefas
export const ARESTAS = [
  ['T1_varrer', 'T2_auditar'], ['T2_auditar', 'T3_qualificar'], ['T3_qualificar', 'T4_redigir'],
  ['T4_redigir', 'T5_aprovar'], ['T5_aprovar', 'T6_despachar'], ['T6_despachar', 'T7_acompanhar'], ['T7_acompanhar', 'T8_aprender'],
];

export const noDoJob = (tipo) => Object.keys(NOS).find((n) => NOS[n].job === tipo) || null;

export function podeHandoff(de, para) {
  return ARESTAS.some(([a, b]) => a === de && b === para);
}

export class HandoffInvalido extends Error {}

// passa o trabalho adiante só por aresta do grafo; o Controle (Alva) pode reabrir qualquer nó
export function exigirHandoff(deJob, paraJob) {
  const de = deJob === 'controle' ? 'controle' : noDoJob(deJob);
  const para = noDoJob(paraJob);
  if (!para) throw new HandoffInvalido(`job sem nó no grafo: ${paraJob}`);
  if (de !== 'controle' && !podeHandoff(de, para)) throw new HandoffInvalido(`handoff fora do grafo: ${de} → ${para}`);
  return { de, para };
}

// Portão de handoff (TOCOMAS, arXiv 2609.37953 — sem ele, VHS −40,85): antes de passar o lead,
// confere na crença se o próximo nó tem o que precisa para trabalhar. É regra, custo zero (V-model,
// arXiv 2609.31937: 8 de 9 correções vieram de portões determinísticos).
export const REQUISITOS = {
  T3_qualificar: ['situacao_site'],
  T4_redigir: ['telefone', 'situacao_site', 'angulo'],
};

// recebe a crença (contrato "crenca") e devolve o que falta; vazio = pode passar
export function conferirHandoff(crenca, paraJob) {
  const precisa = REQUISITOS[noDoJob(paraJob)] || [];
  const falta = [];
  for (const chave of precisa) {
    const p = crenca.pendencias.find((x) => x.chave === chave && (x.tipo === 'falta_dado' || x.tipo === 'conflito'));
    if (p) falta.push({ chave, tipo: p.tipo });
    else if (!crenca.fatos.some((f) => f.chave === chave)) falta.push({ chave, tipo: 'falta_dado' });
  }
  return falta;
}

// Fronteira de memória por domínio: o que cada um enxerga do lead.
// A Escrita (Maia) recebe só os sinais de atraso, nunca o HTML/tecnologias medidos pela Coleta.
const CAMPOS_ESCRITA = ['id', 'nome', 'categoria', 'nicho', 'cidade', 'uf', 'telefone', 'situacao_site', 'rating', 'avaliacoes', 'decisao', 'etapa'];

export function visao(lead, dominio) {
  if (!lead) return lead;
  if (dominio !== 'escrita') return lead;
  const v = Object.fromEntries(CAMPOS_ESCRITA.map((k) => [k, lead[k] ?? null]));
  const aud = parse(lead.auditoria);
  v.auditoria = aud ? JSON.stringify({ sinais: aud.sinais || [] }) : null;
  return v;
}
