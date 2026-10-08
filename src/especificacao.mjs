// Agente como DADO, não como código (docs/PLATAFORMA-AGENTES.md §3): cada agente é um arquivo agentes/<id>.json no
// formato "agente/1", lido com o sistema rodando. É o "cartão" dos protocolos entre agentes (A2A/MCP, arXiv 2505.02279):
// identidade, habilidades, permissões, limites e como ele é avaliado. Pensado para ser o mesmo formato do Agentes Money.
//
// Permissão mínima (arXiv 2609.14631, 2607.22445): a especificação DECLARA o que o agente pode usar; o runtime recusa
// qualquer ferramenta fora da lista e qualquer item de "proibido". Agente sem avaliação declarada não é carregado.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';

export const FORMATO = 'agente/1';
export const EFEITOS = ['leitura', 'rede_passiva', 'escrita', 'envio'];

// Valida e devolve a lista de erros (vazia = válido). Sem dependência: o schema é este código.
export function validar(e) {
  const erros = [];
  const exigir = (cond, msg) => { if (!cond) erros.push(msg); };
  exigir(e && typeof e === 'object', 'não é um objeto');
  if (!e || typeof e !== 'object') return erros;
  exigir(e.formato === FORMATO, `formato tem que ser "${FORMATO}"`);
  exigir(/^[a-z][a-z0-9-]{1,30}$/.test(e.id || ''), 'id: minúsculas, números e hífen (2 a 31)');
  for (const k of ['nome', 'papel', 'funcao']) exigir(typeof e[k] === 'string' && e[k].trim(), `${k} é obrigatório`);
  exigir(e.identidade?.fala === 'texto', 'identidade.fala tem que ser "texto" (agentes não falam por voz)');
  exigir(Array.isArray(e.habilidades) && e.habilidades.length, 'pelo menos uma habilidade');
  for (const h of e.habilidades || []) {
    exigir(/^[a-z_]+$/.test(h.id || ''), `habilidade sem id válido`);
    exigir(EFEITOS.includes(h.efeito), `habilidade ${h.id}: efeito tem que ser um de ${EFEITOS.join(', ')}`);
  }
  exigir(Array.isArray(e.permissoes?.ferramentas), 'permissoes.ferramentas (lista do que pode usar)');
  exigir(Array.isArray(e.permissoes?.proibido), 'permissoes.proibido (lista explícita, mesmo vazia)');
  // efeito no mundo (escrever, enviar) sem aprovação humana declarada não passa
  const comEfeito = (e.habilidades || []).filter((h) => ['escrita', 'envio'].includes(h.efeito)).map((h) => h.id);
  for (const id of comEfeito) exigir(e.permissoes?.precisa_aprovacao?.includes(id), `habilidade ${id} mexe no mundo e precisa estar em permissoes.precisa_aprovacao`);
  exigir(typeof e.avaliacao?.testes === 'string' && e.avaliacao.testes, 'avaliacao.testes é obrigatório: agente sem teste não entra no ar');
  return erros;
}

// Carrega todos os agentes/<id>.json válidos; os inválidos voltam com o motivo (não somem em silêncio).
export function carregarAgentes(pasta = path.join(ROOT, 'agentes')) {
  const validos = [], invalidos = [];
  let arquivos = [];
  try { arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.json')); } catch { return { validos, invalidos }; }
  for (const f of arquivos) {
    let e;
    try { e = JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')); } catch (err) { invalidos.push({ arquivo: f, erros: [`JSON inválido: ${err.message}`] }); continue; }
    const erros = validar(e);
    if (e?.id && `${e.id}.json` !== f) erros.push(`o arquivo tem que se chamar ${e.id}.json`);
    (erros.length ? invalidos : validos).push(erros.length ? { arquivo: f, erros } : e);
  }
  return { validos, invalidos };
}

// Guarda de permissão: chamada ANTES de cada ferramenta. Recusa alto (erro), nunca segue em silêncio.
export function autorizar(especificacao, ferramenta) {
  if (especificacao.permissoes.proibido.includes(ferramenta)) throw new Error(`${especificacao.nome}: "${ferramenta}" é proibido na especificação`);
  if (!especificacao.permissoes.ferramentas.includes(ferramenta)) throw new Error(`${especificacao.nome}: "${ferramenta}" não está nas ferramentas permitidas`);
  return true;
}
