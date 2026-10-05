// Lotes de busca. Regra do Victor: o Atlas busca N empresas (padrão 50) de uma cidade e ramo; elas passam pelo fluxo dos agentes;
// só depois que TODAS foram tratadas por você (aprovou e enviou à mão, ou descartou) é que se busca o próximo lote.
// Nenhum agente sai buscando sem parar, e o histórico de cada busca (cidade, ramo, fonte, lote) nunca se perde.
//
// "Lote tratado" = nenhum lead dele está esperando alguém: nem agente (descoberto, auditado, qualificado) nem você (mensagem, aprovado).
// É calculado olhando os leads; não depende de ninguém lembrar de "fechar" o lote.
import { agora } from './db.mjs';

export const META_PADRAO = 50;
export const META_MAXIMA = 100;
// etapas em que o lead ainda espera alguém trabalhar nele
export const ETAPAS_ABERTAS = ['descoberto', 'auditado', 'qualificado', 'mensagem', 'aprovado'];
const EM = `(${ETAPAS_ABERTAS.map((e) => `'${e}'`).join(',')})`;

export const ultimoLote = (db, varreduraId) => db.prepare('SELECT * FROM lotes WHERE varredura_id = ? ORDER BY numero DESC LIMIT 1').get(varreduraId) || null;

export function pendenciasDoLote(db, loteId) {
  const linhas = db.prepare(`SELECT etapa, COUNT(*) n FROM leads WHERE lote_id = ? AND etapa IN ${EM} GROUP BY etapa`).all(loteId);
  const porEtapa = Object.fromEntries(linhas.map((r) => [r.etapa, r.n]));
  return { total: linhas.reduce((a, r) => a + r.n, 0), porEtapa };
}

// pode buscar mais empresas nesta varredura agora?
export function podeAbrirLote(db, varreduraId) {
  const ult = ultimoLote(db, varreduraId);
  if (!ult) return { ok: true, proximo: 1 };
  if (ult.status === 'rodando') return { ok: false, motivo: `o lote ${ult.numero} ainda está sendo buscado`, proximo: ult.numero + 1 };
  if (ult.fim) return { ok: false, motivo: 'esta busca já trouxe tudo o que a fonte tem. Tente outro ramo, outra cidade ou outra fonte', esgotada: true, proximo: ult.numero + 1 };
  const p = pendenciasDoLote(db, ult.id);
  if (p.total) {
    const partes = [];
    if (p.porEtapa.mensagem) partes.push(`${p.porEtapa.mensagem} para você aprovar`);
    if (p.porEtapa.aprovado) partes.push(`${p.porEtapa.aprovado} aprovada(s) para você enviar`);
    const agentes = (p.porEtapa.descoberto || 0) + (p.porEtapa.auditado || 0) + (p.porEtapa.qualificado || 0);
    if (agentes) partes.push(`${agentes} ainda com os agentes`);
    return { ok: false, motivo: `o lote ${ult.numero} ainda tem ${p.total} lead(s) abertos (${partes.join(', ')})`, pendentes: p, proximo: ult.numero + 1 };
  }
  return { ok: true, proximo: ult.numero + 1 };
}

// quantos resultados mandar o coletor trazer: tudo o que já veio nos lotes anteriores (os repetidos são descartados) + a meta
export function pedidoDoProximoLote(db, varreduraId, meta) {
  const ja = db.prepare('SELECT COALESCE(SUM(coletados), 0) n FROM lotes WHERE varredura_id = ?').get(varreduraId).n;
  return ja + meta;
}

export function abrirLote(db, varreduraId, meta = META_PADRAO) {
  const podeAbrir = podeAbrirLote(db, varreduraId);
  if (!podeAbrir.ok) { const e = new Error(`Ainda não dá para buscar mais: ${podeAbrir.motivo}.`); e.status = 409; e.detalhe = podeAbrir; throw e; }
  const m = Math.min(Math.max(Math.round(Number(meta)) || META_PADRAO, 1), META_MAXIMA);
  const r = db.prepare('INSERT INTO lotes (varredura_id, numero, meta, pedido, status, iniciado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(varreduraId, podeAbrir.proximo, m, pedidoDoProximoLote(db, varreduraId, m), 'rodando', agora());
  return db.prepare('SELECT * FROM lotes WHERE id = ?').get(Number(r.lastInsertRowid));
}

// o coletor terminou: guarda o resultado. `fim` = veio menos do que o pedido (a fonte acabou) ou nada de novo.
// `fim` vem do coletor quando ele sabe (cada termo devolveu menos do que o pedido); sem ele vale a conta simples pelo total.
export function concluirLote(db, loteId, { coletados, novos, repetidos, aviso = null, erro = null, fim: fimDoColetor }) {
  const l = db.prepare('SELECT * FROM lotes WHERE id = ?').get(loteId);
  if (!l) return null;
  const semNada = novos === 0;
  const curto = fimDoColetor === undefined ? coletados < Math.floor((l.pedido || coletados) * 0.9) : Boolean(fimDoColetor);
  const fim = !erro && (semNada || curto) ? 1 : 0;
  db.prepare('UPDATE lotes SET status = ?, coletados = ?, novos = ?, repetidos = ?, fim = ?, aviso = ?, coletado_em = ? WHERE id = ?')
    .run(erro ? 'erro' : 'coletado', coletados, novos, repetidos, fim, erro ? String(erro).slice(0, 300) : aviso, agora(), loteId);
  return db.prepare('SELECT * FROM lotes WHERE id = ?').get(loteId);
}

// um lote que ficou "rodando" porque o servidor caiu no meio: volta a poder ser tentado
export function destravarLotesOrfaos(db) {
  return db.prepare("UPDATE lotes SET status = 'erro', aviso = 'o servidor parou no meio da busca' WHERE status = 'rodando' AND varredura_id NOT IN (SELECT CAST(ref AS INTEGER) FROM jobs WHERE tipo = 'varrer' AND status IN ('pendente', 'rodando') AND ref IS NOT NULL)").run().changes;
}

// Cobertura: uma linha por busca (cidade x ramo x fonte), com o que já foi feito e o que dá para fazer agora.
export function cobertura(db) {
  const varreduras = db.prepare('SELECT * FROM varreduras ORDER BY id DESC').all();
  return varreduras.map((v) => {
    const lotes = db.prepare('SELECT * FROM lotes WHERE varredura_id = ? ORDER BY numero').all(v.id).map((l) => {
      const p = pendenciasDoLote(db, l.id);
      return { ...l, pendentes: p.total, fechado: l.status === 'coletado' && p.total === 0 };
    });
    const c = db.prepare(`SELECT
      COUNT(*) leads,
      SUM(CASE WHEN situacao_site IS NOT NULL AND situacao_site != 'site_proprio' THEN 1 ELSE 0 END) sem_site_ou_fraco,
      SUM(CASE WHEN etapa IN ('enviado', 'respondeu', 'sem_resposta', 'fechado', 'perdido') THEN 1 ELSE 0 END) enviados,
      SUM(CASE WHEN etapa IN ('respondeu', 'fechado', 'perdido') THEN 1 ELSE 0 END) responderam,
      SUM(CASE WHEN etapa = 'fechado' THEN 1 ELSE 0 END) fechados
      FROM leads WHERE varredura_id = ?`).get(v.id);
    return { varredura_id: v.id, cidade: v.cidade, uf: v.uf, pais: v.pais || 'BR', nicho: v.nicho, fonte: v.fonte, meta: v.limite, criado_em: v.criado_em,
      lotes, ...Object.fromEntries(Object.entries(c).map(([k, n]) => [k, n || 0])), proximo: podeAbrirLote(db, v.id) };
  });
}
